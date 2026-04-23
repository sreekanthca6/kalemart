const router = require('express').Router();
const { queryAsTenant } = require('../db/tenantQuery');

// Quebec tax rates
const TPS_RATE = 0.05;       // GST  5%
const TVQ_RATE = 0.09975;    // QST  9.975%

// Zero-rated categories (basic groceries — no TPS/TVQ collected)
// Per Excise Tax Act: basic groceries are zero-rated
// For KaleMart24: fresh produce and basic dairy are zero-rated
// Prepared food, beverages, supplements, personal care are taxable
const ZERO_RATED_CATEGORIES = new Set(['fresh']);
const ZERO_RATED_PRODUCTS   = new Set(['prod_017', 'prod_018', 'prod_019']); // kefir, yogourt, milk

// ── Tax calculation for a period ─────────────────────────────────────────────

async function calcPeriodTax(start, end) {
  // TPS/TVQ collected on taxable sales
  const { rows: salesRows } = await queryAsTenant(`
    SELECT
      p.category,
      p.id AS product_id,
      SUM(oi.line_total)::float AS revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o   ON o.id = oi.order_id
    WHERE o.created_at::date BETWEEN $1 AND $2
      AND o.status = 'completed'
    GROUP BY p.category, p.id
  `, [start, end]);

  let taxableRevenue    = 0;
  let zeroRatedRevenue  = 0;

  for (const r of salesRows) {
    const isZeroRated = ZERO_RATED_CATEGORIES.has(r.category) || ZERO_RATED_PRODUCTS.has(r.product_id);
    if (isZeroRated) zeroRatedRevenue += r.revenue;
    else taxableRevenue += r.revenue;
  }

  // Revenue in our DB is already inclusive of tax? No — Shopify POS
  // typically shows pre-tax subtotal. Our seed data uses pre-tax prices.
  // So collected tax = taxableRevenue * rate
  const tpsCollected = taxableRevenue * TPS_RATE;
  const tvqCollected = taxableRevenue * TVQ_RATE;

  // ITCs/ITRs from expenses
  const { rows: expRows } = await queryAsTenant(`
    SELECT
      SUM(e.tps_paid)::float AS tps_paid,
      SUM(e.tvq_paid)::float AS tvq_paid
    FROM expenses e
    JOIN expense_categories ec ON ec.id = e.category_id
    WHERE e.date BETWEEN $1 AND $2
      AND ec.itc_eligible = true
  `, [start, end]);

  const tpsITC = expRows[0]?.tps_paid || 0;
  const tvqITR = expRows[0]?.tvq_paid || 0;

  const tpsNet = tpsCollected - tpsITC;
  const tvqNet = tvqCollected - tvqITR;

  return {
    taxableRevenue:   +taxableRevenue.toFixed(2),
    zeroRatedRevenue: +zeroRatedRevenue.toFixed(2),
    totalRevenue:     +(taxableRevenue + zeroRatedRevenue).toFixed(2),
    tpsCollected:     +tpsCollected.toFixed(2),
    tvqCollected:     +tvqCollected.toFixed(2),
    tpsITC:           +tpsITC.toFixed(2),
    tvqITR:           +tvqITR.toFixed(2),
    tpsNet:           +tpsNet.toFixed(2),
    tvqNet:           +tvqNet.toFixed(2),
    totalOwing:       +(tpsNet + tvqNet).toFixed(2),
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// All tax periods with calculated amounts
router.get('/periods', async (req, res, next) => {
  try {
    const { rows: periods } = await queryAsTenant(
      'SELECT * FROM tax_periods ORDER BY period_start'
    );

    const result = await Promise.all(periods.map(async p => {
      const calc = await calcPeriodTax(p.period_start, p.period_end);
      return { ...p, ...calc };
    }));

    res.json(result);
  } catch (e) { next(e); }
});

// Single period detail — used to render the return form
router.get('/periods/:id', async (req, res, next) => {
  try {
    const { rows } = await queryAsTenant(
      'SELECT * FROM tax_periods WHERE id = $1', [req.params.id]
    );
    if (!rows.length) { const e = new Error('Period not found'); e.status = 404; throw e; }
    const p = rows[0];
    const calc = await calcPeriodTax(p.period_start, p.period_end);

    // Breakdown by category
    const { rows: breakdown } = await queryAsTenant(`
      SELECT
        p.category,
        SUM(oi.line_total)::float AS revenue,
        COUNT(DISTINCT o.id)::int AS orders
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o   ON o.id = oi.order_id
      WHERE o.created_at::date BETWEEN $1 AND $2
        AND o.status = 'completed'
      GROUP BY p.category ORDER BY revenue DESC
    `, [p.period_start, p.period_end]);

    const { rows: topExp } = await queryAsTenant(`
      SELECT ec.name, ec.account_code,
             SUM(e.amount)::float AS amount,
             SUM(e.tps_paid)::float AS tps_paid,
             SUM(e.tvq_paid)::float AS tvq_paid
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      WHERE e.date BETWEEN $1 AND $2
      GROUP BY ec.name, ec.account_code ORDER BY amount DESC
    `, [p.period_start, p.period_end]);

    res.json({ ...p, ...calc, revenueBreakdown: breakdown, expenseBreakdown: topExp });
  } catch (e) { next(e); }
});

// Mark period as filed
router.post('/periods/:id/file', async (req, res, next) => {
  try {
    const calc = await (async () => {
      const { rows } = await queryAsTenant('SELECT * FROM tax_periods WHERE id = $1', [req.params.id]);
      if (!rows.length) { const e = new Error('Not found'); e.status = 404; throw e; }
      return { period: rows[0], calc: await calcPeriodTax(rows[0].period_start, rows[0].period_end) };
    })();

    const { rows } = await queryAsTenant(`
      UPDATE tax_periods
      SET status = 'filed', filed_at = NOW(),
          tps_collected = $2, tvq_collected = $3,
          tps_itc = $4, tvq_itr = $5,
          tps_net = $6, tvq_net = $7,
          notes = $8
      WHERE id = $1
      RETURNING *
    `, [req.params.id,
        calc.calc.tpsCollected, calc.calc.tvqCollected,
        calc.calc.tpsITC, calc.calc.tvqITR,
        calc.calc.tpsNet, calc.calc.tvqNet,
        req.body.notes || null]);

    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Quick summary — current open periods
router.get('/summary', async (req, res, next) => {
  try {
    const { rows: open } = await queryAsTenant(
      "SELECT * FROM tax_periods WHERE status != 'paid' ORDER BY period_start"
    );

    const summaries = await Promise.all(open.map(async p => {
      const calc = await calcPeriodTax(p.period_start, p.period_end);
      const daysUntilDue = Math.ceil((new Date(p.filing_due) - Date.now()) / 86400000);
      return {
        id: p.id, status: p.status,
        period: `${p.period_start} → ${p.period_end}`,
        filingDue: p.filing_due,
        daysUntilDue,
        urgent: daysUntilDue <= 14 && p.status !== 'filed',
        ...calc,
      };
    }));

    res.json(summaries);
  } catch (e) { next(e); }
});

module.exports = router;

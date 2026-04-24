const router = require('express').Router();
const { queryAsTenant, currentTenantId } = require('../db/tenantQuery');

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
// Pass tenant_id as an explicit SQL parameter ($3) so PostgreSQL can use
// column statistics for the composite index (tenant_id, created_at).
// RLS still enforces the tenant boundary as a security backstop.

async function calcPeriodTax(start, end) {
  const tenantId = currentTenantId();

  // TPS/TVQ collected on taxable sales
  const { rows: salesRows } = await queryAsTenant(`
    SELECT
      p.category,
      p.id AS product_id,
      SUM(oi.line_total)::float AS revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o   ON o.id = oi.order_id
    WHERE o.tenant_id = $3
      AND o.created_at >= $1::date
      AND o.created_at <  $2::date + interval '1 day'
      AND o.status = 'completed'
    GROUP BY p.category, p.id
  `, [start, end, tenantId]);

  let taxableRevenue    = 0;
  let zeroRatedRevenue  = 0;

  for (const r of salesRows) {
    const isZeroRated = ZERO_RATED_CATEGORIES.has(r.category) || ZERO_RATED_PRODUCTS.has(r.product_id);
    if (isZeroRated) zeroRatedRevenue += r.revenue;
    else taxableRevenue += r.revenue;
  }

  const tpsCollected = taxableRevenue * TPS_RATE;
  const tvqCollected = taxableRevenue * TVQ_RATE;

  // ITCs/ITRs from expenses
  const { rows: expRows } = await queryAsTenant(`
    SELECT
      SUM(e.tps_paid)::float AS tps_paid,
      SUM(e.tvq_paid)::float AS tvq_paid
    FROM expenses e
    JOIN expense_categories ec ON ec.id = e.category_id
    WHERE e.tenant_id = $3
      AND e.date >= $1::date
      AND e.date <= $2::date
      AND ec.itc_eligible = true
  `, [start, end, tenantId]);

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

// Batch version: compute all periods in 2 queries instead of 2×N
async function calcAllPeriodTax(periods) {
  if (!periods.length) return {};
  const tenantId = currentTenantId();

  // Single sales query across all periods, grouped by period
  const { rows: salesRows } = await queryAsTenant(`
    SELECT
      p.category,
      p.id AS product_id,
      SUM(oi.line_total)::float AS revenue,
      tp.id AS period_id
    FROM tax_periods tp
    JOIN orders o ON o.tenant_id = $2
                 AND o.created_at >= tp.period_start::date
                 AND o.created_at <  tp.period_end::date + interval '1 day'
                 AND o.status = 'completed'
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p     ON p.id = oi.product_id
    WHERE tp.id = ANY($1)
    GROUP BY tp.id, p.category, p.id
  `, [periods.map(p => p.id), tenantId]);

  // Single expenses query across all periods
  const { rows: expRows } = await queryAsTenant(`
    SELECT
      tp.id AS period_id,
      SUM(e.tps_paid)::float AS tps_paid,
      SUM(e.tvq_paid)::float AS tvq_paid
    FROM tax_periods tp
    JOIN expenses e ON e.tenant_id = $2
                   AND e.date >= tp.period_start::date
                   AND e.date <= tp.period_end::date
    JOIN expense_categories ec ON ec.id = e.category_id
                              AND ec.itc_eligible = true
    WHERE tp.id = ANY($1)
    GROUP BY tp.id
  `, [periods.map(p => p.id), tenantId]);

  // Aggregate per period
  const expMap = Object.fromEntries(expRows.map(r => [r.period_id, r]));
  const salesMap = {};
  for (const r of salesRows) {
    if (!salesMap[r.period_id]) salesMap[r.period_id] = [];
    salesMap[r.period_id].push(r);
  }

  const result = {};
  for (const p of periods) {
    let taxableRevenue = 0, zeroRatedRevenue = 0;
    for (const r of (salesMap[p.id] || [])) {
      const isZeroRated = ZERO_RATED_CATEGORIES.has(r.category) || ZERO_RATED_PRODUCTS.has(r.product_id);
      if (isZeroRated) zeroRatedRevenue += r.revenue;
      else taxableRevenue += r.revenue;
    }
    const tpsCollected = taxableRevenue * TPS_RATE;
    const tvqCollected = taxableRevenue * TVQ_RATE;
    const tpsITC = expMap[p.id]?.tps_paid || 0;
    const tvqITR = expMap[p.id]?.tvq_paid || 0;
    const tpsNet = tpsCollected - tpsITC;
    const tvqNet = tvqCollected - tvqITR;
    result[p.id] = {
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
  return result;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// All tax periods with calculated amounts — 2 queries total regardless of period count
router.get('/periods', async (req, res, next) => {
  try {
    const { rows: periods } = await queryAsTenant(
      'SELECT * FROM tax_periods ORDER BY period_start'
    );

    const calcs = await calcAllPeriodTax(periods);
    const result = periods.map(p => ({ ...p, ...calcs[p.id] }));

    res.json(result);
  } catch (e) { next(e); }
});

// Single period detail — used to render the return form
router.get('/periods/:id', async (req, res, next) => {
  try {
    const tenantId = currentTenantId();
    const { rows } = await queryAsTenant(
      'SELECT * FROM tax_periods WHERE id = $1', [req.params.id]
    );
    if (!rows.length) { const e = new Error('Period not found'); e.status = 404; throw e; }
    const p = rows[0];

    // Run all 3 heavy queries concurrently, each with explicit tenant_id for planner
    const [calc, { rows: breakdown }, { rows: topExp }] = await Promise.all([
      calcPeriodTax(p.period_start, p.period_end),

      queryAsTenant(`
        SELECT
          p.category,
          SUM(oi.line_total)::float AS revenue,
          COUNT(DISTINCT o.id)::int AS orders
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o   ON o.id = oi.order_id
        WHERE o.tenant_id = $3
          AND o.created_at >= $1::date
          AND o.created_at <  $2::date + interval '1 day'
          AND o.status = 'completed'
        GROUP BY p.category ORDER BY revenue DESC
      `, [p.period_start, p.period_end, tenantId]),

      queryAsTenant(`
        SELECT ec.name, ec.account_code,
               SUM(e.amount)::float AS amount,
               SUM(e.tps_paid)::float AS tps_paid,
               SUM(e.tvq_paid)::float AS tvq_paid
        FROM expenses e
        JOIN expense_categories ec ON ec.id = e.category_id
        WHERE e.tenant_id = $3
          AND e.date >= $1::date
          AND e.date <= $2::date
        GROUP BY ec.name, ec.account_code ORDER BY amount DESC
      `, [p.period_start, p.period_end, tenantId]),
    ]);

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

// Quick summary — current open periods — 2 queries total
router.get('/summary', async (req, res, next) => {
  try {
    const { rows: open } = await queryAsTenant(
      "SELECT * FROM tax_periods WHERE status != 'paid' ORDER BY period_start"
    );

    const calcs = await calcAllPeriodTax(open);
    const summaries = open.map(p => {
      const daysUntilDue = Math.ceil((new Date(p.filing_due) - Date.now()) / 86400000);
      return {
        id: p.id, status: p.status,
        period: `${p.period_start} → ${p.period_end}`,
        filingDue: p.filing_due,
        daysUntilDue,
        urgent: daysUntilDue <= 14 && p.status !== 'filed',
        ...calcs[p.id],
      };
    });

    res.json(summaries);
  } catch (e) { next(e); }
});

module.exports = router;

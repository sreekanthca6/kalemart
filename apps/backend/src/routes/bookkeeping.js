const router = require('express').Router();
const { queryAsTenant } = require('../db/tenantQuery');
const { randomUUID } = require('crypto');

// ── Expense categories ────────────────────────────────────────────────────────

router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await queryAsTenant(
      'SELECT * FROM expense_categories ORDER BY account_code'
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// ── Expenses ──────────────────────────────────────────────────────────────────

router.get('/expenses', async (req, res, next) => {
  try {
    const { month, year, category } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (month && year) {
      params.push(`${year}-${String(month).padStart(2,'0')}-01`);
      params.push(`${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`);
      where += ` AND e.date BETWEEN $${params.length-1} AND $${params.length}`;
    } else if (year) {
      where += ` AND EXTRACT(YEAR FROM e.date) = $${params.length+1}`;
      params.push(year);
    }
    if (category) {
      where += ` AND e.category_id = $${params.length+1}`;
      params.push(category);
    }
    const { rows } = await queryAsTenant(`
      SELECT e.*, ec.name AS category_name, ec.account_code, ec.itc_eligible
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      ${where}
      ORDER BY e.date DESC, e.created_at DESC
      LIMIT 500
    `, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/expenses', async (req, res, next) => {
  try {
    const { categoryId, description, amount, tpsPaid = 0, tvqPaid = 0, vendor, reference, date } = req.body;
    if (!categoryId || !description || !amount || !date) {
      const e = new Error('categoryId, description, amount, date are required'); e.status = 400; throw e;
    }
    const id = randomUUID();
    const { rows } = await queryAsTenant(`
      INSERT INTO expenses (id, tenant_id, category_id, description, amount, tps_paid, tvq_paid, vendor, reference, date, source)
      VALUES ($1, current_setting('app.current_tenant_id'), $2,$3,$4,$5,$6,$7,$8,$9,'manual')
      RETURNING *
    `, [id, categoryId, description, parseFloat(amount), parseFloat(tpsPaid), parseFloat(tvqPaid), vendor || null, reference || null, date]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/expenses/:id', async (req, res, next) => {
  try {
    await queryAsTenant('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Ledger — income + expenses combined ──────────────────────────────────────

router.get('/ledger', async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const y = parseInt(year)  || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const start = `${y}-${String(m).padStart(2,'0')}-01`;
    const end   = `${y}-${String(m).padStart(2,'0')}-${new Date(y, m, 0).getDate()}`;

    // Revenue entries (from orders)
    const { rows: salesRows } = await queryAsTenant(`
      SELECT
        created_at::date AS date,
        'income'         AS type,
        'Sales Revenue'  AS category,
        '4000'           AS account_code,
        COUNT(*)::int    AS txn_count,
        SUM(total)::float AS amount,
        NULL             AS vendor,
        NULL             AS reference
      FROM orders
      WHERE created_at::date BETWEEN $1 AND $2
        AND status = 'completed'
      GROUP BY created_at::date
      ORDER BY date
    `, [start, end]);

    // Expense entries
    const { rows: expRows } = await queryAsTenant(`
      SELECT
        e.date,
        'expense'          AS type,
        ec.name            AS category,
        ec.account_code,
        1                  AS txn_count,
        e.amount::float,
        e.vendor,
        e.reference,
        e.tps_paid::float,
        e.tvq_paid::float,
        e.id
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      WHERE e.date BETWEEN $1 AND $2
      ORDER BY e.date, ec.account_code
    `, [start, end]);

    // Summary
    const totalIncome   = salesRows.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expRows.reduce((s, r) => s + r.amount, 0);
    const netIncome     = totalIncome - totalExpenses;

    res.json({
      period: { year: y, month: m, start, end },
      summary: {
        totalIncome:   +totalIncome.toFixed(2),
        totalExpenses: +totalExpenses.toFixed(2),
        netIncome:     +netIncome.toFixed(2),
      },
      entries: [
        ...salesRows.map(r => ({ ...r, amount: +r.amount.toFixed(2) })),
        ...expRows.map(r => ({ ...r, amount: +r.amount.toFixed(2) })),
      ].sort((a, b) => new Date(a.date) - new Date(b.date)),
    });
  } catch (e) { next(e); }
});

// ── Monthly P&L summary (all months) ─────────────────────────────────────────

router.get('/summary', async (req, res, next) => {
  try {
    const { rows: salesByMonth } = await queryAsTenant(`
      SELECT
        date_trunc('month', created_at) AS month,
        SUM(total)::float AS revenue,
        COUNT(*)::int     AS orders
      FROM orders
      GROUP BY 1 ORDER BY 1
    `);

    const { rows: expByMonth } = await queryAsTenant(`
      SELECT
        date_trunc('month', date) AS month,
        ec.name                   AS category,
        ec.account_code,
        SUM(e.amount)::float      AS amount,
        SUM(e.tps_paid)::float    AS tps_paid,
        SUM(e.tvq_paid)::float    AS tvq_paid
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      GROUP BY 1, 2, 3 ORDER BY 1, 3
    `);

    // Group expenses by month
    const expMap = new Map();
    for (const r of expByMonth) {
      const key = r.month.toISOString().slice(0,7);
      if (!expMap.has(key)) expMap.set(key, { total: 0, itcs_tps: 0, itcs_tvq: 0, breakdown: [] });
      const m = expMap.get(key);
      m.total   += r.amount;
      m.itcs_tps += r.tps_paid;
      m.itcs_tvq += r.tvq_paid;
      m.breakdown.push({ category: r.category, account_code: r.account_code, amount: +r.amount.toFixed(2) });
    }

    const result = salesByMonth.map(s => {
      const key = new Date(s.month).toISOString().slice(0,7);
      const exp = expMap.get(key) || { total: 0, itcs_tps: 0, itcs_tvq: 0, breakdown: [] };
      return {
        month: key,
        label: new Date(s.month).toLocaleString('en-CA', { month: 'short', year: 'numeric' }),
        revenue:    +s.revenue.toFixed(2),
        orders:     s.orders,
        expenses:   +exp.total.toFixed(2),
        netIncome:  +(s.revenue - exp.total).toFixed(2),
        itcs_tps:   +exp.itcs_tps.toFixed(2),
        itcs_tvq:   +exp.itcs_tvq.toFixed(2),
        breakdown:  exp.breakdown,
      };
    });

    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;

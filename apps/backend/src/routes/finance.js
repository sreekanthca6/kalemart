const router = require('express').Router();
const { queryAsTenant } = require('../db/tenantQuery');

// ─── Real projections from KaleMart24-Projections-1170 Rue De Bleury.xlsx ────
// Store opened: November 2025 = Plan Month 1

// 36 months of P&L data exactly as modelled in the spreadsheet (CAD)
const PLAN = [
  // ── Year 1 (Nov 2025 – Oct 2026) ────────────────────────────────────────────
  { planMonth:1,  year:1, revenue:106458.33, cogs:58172.79, ebitda:14632.64, netIncome:12663.89, interest:1968.75 },
  { planMonth:2,  year:1, revenue:106458.33, cogs:58172.79, ebitda:12674.81, netIncome:10716.98, interest:1957.83 },
  { planMonth:3,  year:1, revenue:106458.33, cogs:58172.79, ebitda:12685.80, netIncome:10738.96, interest:1946.84 },
  { planMonth:4,  year:1, revenue:106458.33, cogs:58172.79, ebitda:12696.86, netIncome:10761.07, interest:1935.79 },
  { planMonth:5,  year:1, revenue:106458.33, cogs:58172.79, ebitda:12707.98, netIncome:10783.32, interest:1924.66 },
  { planMonth:6,  year:1, revenue:106458.33, cogs:58172.79, ebitda:12719.18, netIncome:10805.71, interest:1913.47 },
  { planMonth:7,  year:1, revenue:106458.33, cogs:58172.79, ebitda:12730.44, netIncome:10828.24, interest:1902.20 },
  { planMonth:8,  year:1, revenue:106458.33, cogs:58172.79, ebitda:12741.78, netIncome:10850.91, interest:1890.86 },
  { planMonth:9,  year:1, revenue:106458.33, cogs:58172.79, ebitda:12753.18, netIncome:10873.73, interest:1879.46 },
  { planMonth:10, year:1, revenue:106458.33, cogs:58172.79, ebitda:12764.66, netIncome:10896.68, interest:1867.98 },
  { planMonth:11, year:1, revenue:106458.33, cogs:58172.79, ebitda:12776.21, netIncome:10919.78, interest:1856.43 },
  { planMonth:12, year:1, revenue:106458.33, cogs:58172.79, ebitda:12787.83, netIncome:10943.02, interest:1844.81 },
  // ── Year 2 (Nov 2026 – Oct 2027) ────────────────────────────────────────────
  { planMonth:1,  year:2, revenue:110716.67, cogs:60499.70, ebitda:14409.99, netIncome:12576.88, interest:1833.11 },
  { planMonth:2,  year:2, revenue:110716.67, cogs:60499.70, ebitda:14421.76, netIncome:12600.41, interest:1821.35 },
  { planMonth:3,  year:2, revenue:110716.67, cogs:60499.70, ebitda:14433.60, netIncome:12624.09, interest:1809.51 },
  { planMonth:4,  year:2, revenue:110716.67, cogs:60499.70, ebitda:14445.51, netIncome:12647.92, interest:1797.59 },
  { planMonth:5,  year:2, revenue:110716.67, cogs:60499.70, ebitda:14457.50, netIncome:12671.90, interest:1785.60 },
  { planMonth:6,  year:2, revenue:110716.67, cogs:60499.70, ebitda:14469.57, netIncome:12696.03, interest:1773.54 },
  { planMonth:7,  year:2, revenue:110716.67, cogs:60499.70, ebitda:14481.71, netIncome:12720.31, interest:1761.40 },
  { planMonth:8,  year:2, revenue:110716.67, cogs:60499.70, ebitda:14493.92, netIncome:12744.74, interest:1749.18 },
  { planMonth:9,  year:2, revenue:110716.67, cogs:60499.70, ebitda:14506.22, netIncome:12769.32, interest:1736.89 },
  { planMonth:10, year:2, revenue:110716.67, cogs:60499.70, ebitda:14518.58, netIncome:12794.06, interest:1724.52 },
  { planMonth:11, year:2, revenue:110716.67, cogs:60499.70, ebitda:14531.03, netIncome:12818.95, interest:1712.08 },
  { planMonth:12, year:2, revenue:110716.67, cogs:60499.70, ebitda:14543.55, netIncome:12844.00, interest:1699.55 },
  // ── Year 3 (Nov 2027 – Oct 2028) ────────────────────────────────────────────
  { planMonth:1,  year:3, revenue:115145.33, cogs:62919.69, ebitda:15932.17, netIncome:14245.21, interest:1686.95 },
  { planMonth:2,  year:3, revenue:115145.33, cogs:62919.69, ebitda:15944.85, netIncome:14270.58, interest:1674.27 },
  { planMonth:3,  year:3, revenue:115145.33, cogs:62919.69, ebitda:15957.61, netIncome:14296.10, interest:1661.51 },
  { planMonth:4,  year:3, revenue:115145.33, cogs:62919.69, ebitda:15970.45, netIncome:14321.77, interest:1648.67 },
  { planMonth:5,  year:3, revenue:115145.33, cogs:62919.69, ebitda:15983.37, netIncome:14347.62, interest:1635.75 },
  { planMonth:6,  year:3, revenue:115145.33, cogs:62919.69, ebitda:15996.37, netIncome:14373.62, interest:1622.75 },
  { planMonth:7,  year:3, revenue:115145.33, cogs:62919.69, ebitda:16009.45, netIncome:14399.78, interest:1609.67 },
  { planMonth:8,  year:3, revenue:115145.33, cogs:62919.69, ebitda:16022.61, netIncome:14426.11, interest:1596.50 },
  { planMonth:9,  year:3, revenue:115145.33, cogs:62919.69, ebitda:16035.86, netIncome:14452.60, interest:1583.26 },
  { planMonth:10, year:3, revenue:115145.33, cogs:62919.69, ebitda:16049.19, netIncome:14479.26, interest:1569.93 },
  { planMonth:11, year:3, revenue:115145.33, cogs:62919.69, ebitda:16062.60, netIncome:14506.08, interest:1556.52 },
  { planMonth:12, year:3, revenue:115145.33, cogs:62919.69, ebitda:16076.10, netIncome:14533.07, interest:1543.02 },
];

// Annual plan targets (from P&L ANNUAL sheet)
const ANNUAL_TARGETS = {
  1: { revenue: 1277500,  ebitda: 154671.38, netIncome: 131782.30, cogs: 698073.45 },
  2: { revenue: 1328600,  ebitda: 173712.96, netIncome: 152508.62, cogs: 725996.39 },
  3: { revenue: 1381744,  ebitda: 192040.60, netIncome: 172651.80, cogs: 755036.24 },
};

// Real expense breakdown per plan year (from ASSUMPTIONS + monthly sheets)
const OPEX_BY_YEAR = {
  1: { wages: 8466, owner_salary: 3984, payroll_taxes: 1867.50, rent: 9962.49, royalties: 4801.27, pos_fees: 2457.06, marketing: 1064.58, accounting: 750, telecom: 150, insurance: 150 },
  2: { wages: 8466, owner_salary: 3984, payroll_taxes: 1867.50, rent: 9962.49, royalties: 4993.32, pos_fees: 2543.38, marketing: 1107.17, accounting: 750, telecom: 150, insurance: 150 },
  3: { wages: 8466, owner_salary: 3984, payroll_taxes: 1867.50, rent: 10261.36, royalties: 5193.05, pos_fees: 2633.16, marketing: 1151.45, accounting: 750, telecom: 150, insurance: 150 },
};

// Calendar month → plan month index (0-based)
// Store opened: November 2025 = plan index 0
const OPEN_YEAR  = 2025;
const OPEN_MONTH = 10; // 0=Jan, so 10=Nov

function calendarToPlanIndex(year, month) {
  return (year - OPEN_YEAR) * 12 + (month - OPEN_MONTH);
}

function getPlan(year, month) {
  const idx = calendarToPlanIndex(year, month);
  if (idx < 0 || idx >= PLAN.length) return null;
  return PLAN[idx];
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Actual revenue by calendar month from DB orders
router.get('/actuals', async (req, res, next) => {
  try {
    const { rows } = await queryAsTenant(`
      SELECT
        date_trunc('month', created_at) AS month,
        COUNT(*)::int                  AS order_count,
        SUM(total)::float              AS revenue
      FROM orders
      GROUP BY 1
      ORDER BY 1
    `);
    res.json(rows.map(r => ({
      year:        new Date(r.month).getFullYear(),
      month:       new Date(r.month).getMonth(),
      label:       new Date(r.month).toLocaleString('en-CA', { month: 'short', year: 'numeric' }),
      orderCount:  r.order_count,
      revenue:     +parseFloat(r.revenue).toFixed(2),
    })));
  } catch (e) { next(e); }
});

// Top products by revenue
router.get('/top-products', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const { rows } = await queryAsTenant(`
      SELECT
        p.id, p.name, p.sku, p.category,
        COUNT(oi.id)::int          AS transactions,
        SUM(oi.quantity)::int      AS units_sold,
        SUM(oi.line_total)::float  AS revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      GROUP BY p.id, p.name, p.sku, p.category
      ORDER BY revenue DESC
      LIMIT $1
    `, [limit]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/pnl', async (req, res, next) => {
  try { await handlePnl(req, res); } catch (e) { next(e); }
});

async function handlePnl(req, res) {
  const count = Math.min(parseInt(req.query.months) || 6, 12);
  const now   = new Date();
  const rows  = [];

  // Pull actual revenue from DB grouped by month
  const { rows: actuals } = await queryAsTenant(
    `SELECT date_trunc('month', created_at) AS month, SUM(total)::float AS revenue
     FROM orders GROUP BY 1`
  );
  const actualsByKey = new Map(actuals.map(a => {
    const d = new Date(a.month);
    return [`${d.getFullYear()}-${d.getMonth()}`, +parseFloat(a.revenue).toFixed(2)];
  }));

  for (let i = count - 1; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y   = d.getFullYear();
    const m   = d.getMonth();
    const plan = getPlan(y, m);
    const isCurrent = i === 0;

    if (!plan) continue;

    let { revenue, cogs, ebitda, netIncome, interest, year: planYear } = plan;
    const opex    = OPEX_BY_YEAR[planYear] || OPEX_BY_YEAR[1];
    const opexTotal = Object.values(opex).reduce((a, b) => a + b, 0);
    const grossProfit = +(revenue - cogs).toFixed(2);
    const grossMargin = +((grossProfit / revenue) * 100).toFixed(1);
    const ebitdaMargin = +((ebitda / revenue) * 100).toFixed(1);
    const netMargin    = +((netIncome / revenue) * 100).toFixed(1);

    // Replace plan revenue with real DB revenue where available
    const actualRevenue = actualsByKey.get(`${y}-${m}`);
    if (actualRevenue && actualRevenue > 50) {
      revenue = isCurrent
        ? +(actualRevenue + plan.revenue * 0.15).toFixed(2) // current month: actual + 15% pipeline
        : actualRevenue;
    }

    // Annual target for this plan year
    const annualTarget = ANNUAL_TARGETS[planYear];

    rows.push({
      period: {
        year: y, month: m,
        label: d.toLocaleString('en-CA', { month: 'short', year: 'numeric' }),
        short: d.toLocaleString('en-CA', { month: 'short' }),
        planYear, planMonth: plan.planMonth,
      },
      revenue,
      planRevenue: plan.revenue,
      actualRevenue: actualRevenue || null,
      vsTarget: actualRevenue ? +((actualRevenue / plan.revenue - 1) * 100).toFixed(1) : null,
      cogs,
      grossProfit,
      grossMargin,
      opex: { ...opex, total: opexTotal },
      interest,
      ebitda,
      ebitdaMargin,
      netIncome,
      netMargin,
      annualTarget,
      isCurrent,
    });
  }

  res.json(rows);
}

// YTD summary for a plan year
router.get('/ytd', (req, res) => {
  const now = new Date();
  const planYear = parseInt(req.query.year) || 1;
  const target = ANNUAL_TARGETS[planYear];
  if (!target) return res.status(400).json({ error: 'Invalid year' });

  // Find all plan months for this year that are in the past
  const months = PLAN.filter(p => p.year === planYear).map((p, i) => {
    const calYear  = OPEN_YEAR + Math.floor((OPEN_MONTH + PLAN.indexOf(p)) / 12);
    const calMonth = (OPEN_MONTH + PLAN.indexOf(p)) % 12;
    const d = new Date(calYear, calMonth, 1);
    return { ...p, calYear, calMonth, date: d, elapsed: d <= now };
  }).filter(p => p.elapsed);

  const ytdRevenue   = months.reduce((s, p) => s + p.revenue, 0);
  const ytdEbitda    = months.reduce((s, p) => s + p.ebitda, 0);
  const ytdNetIncome = months.reduce((s, p) => s + p.netIncome, 0);
  const monthsElapsed = months.length;

  res.json({
    planYear, monthsElapsed,
    ytd: { revenue: +ytdRevenue.toFixed(2), ebitda: +ytdEbitda.toFixed(2), netIncome: +ytdNetIncome.toFixed(2) },
    annualTarget: target,
    paceRevenue:  +(ytdRevenue  / monthsElapsed * 12).toFixed(2),
    paceEbitda:   +(ytdEbitda   / monthsElapsed * 12).toFixed(2),
  });
});

module.exports = router;

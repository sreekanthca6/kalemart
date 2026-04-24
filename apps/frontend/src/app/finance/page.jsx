'use client';
import { useState, useEffect } from 'react';
import { authFetch } from '../../lib/api';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, BarChart,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAD = n =>
  n === null || n === undefined ? '—'
  : `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const CADF = n =>
  n === null || n === undefined ? '—'
  : `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = n => n === null || n === undefined ? '—' : `${n}%`;

function delta(curr, prev) {
  if (!prev || prev === 0) return null;
  return (((curr - prev) / Math.abs(prev)) * 100).toFixed(1);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, change, dark, positive }) {
  const up   = change !== null && parseFloat(change) > 0;
  const down = change !== null && parseFloat(change) < 0;
  return (
    <div className="rounded-2xl p-5"
      style={{ background: dark ? '#1c1c1e' : '#ffffff', boxShadow: dark ? 'none' : '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: dark ? '#636366' : '#aeaeb2' }}>{label}</p>
      <p className="text-[26px] font-bold tracking-tight leading-none"
        style={{ color: dark ? '#ffffff' : positive === false ? '#ff3b30' : '#1d1d1f' }}>
        {value}
      </p>
      {sub && <p className="text-[12px] mt-1.5" style={{ color: dark ? '#636366' : '#8e8e93' }}>{sub}</p>}
      {change !== null && (
        <span className="inline-flex items-center gap-1 mt-2 text-[12px] font-semibold"
          style={{ color: up ? '#34c759' : down ? '#ff3b30' : '#8e8e93' }}>
          {up ? '↑' : down ? '↓' : '→'} {Math.abs(change)}% vs last month
        </span>
      )}
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-[13px]"
      style={{ background: '#1c1c1e', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
      <p className="font-semibold text-white mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="leading-relaxed" style={{ color: p.color }}>
          {p.name}: {CAD(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── P&L row ──────────────────────────────────────────────────────────────────

function Row({ label, value, indent, bold, line, muted, color }) {
  return (
    <>
      {line && <tr><td colSpan={2}><div className="my-1.5" style={{ borderTop: '1px solid #f0f0f0' }} /></td></tr>}
      <tr>
        <td className="py-1" style={{ paddingLeft: indent ? 18 : 0 }}>
          <span className={`text-[13px] ${bold ? 'font-bold' : ''}`}
            style={{ color: muted ? '#aeaeb2' : '#3a3a3c' }}>{label}</span>
        </td>
        {value !== null && value !== undefined ? (
          <td className="py-1 text-right">
            <span className={`text-[13px] font-mono ${bold ? 'font-bold' : ''}`}
              style={{ color: color || (value < 0 ? '#ff3b30' : '#1d1d1f') }}>
              {value < 0 ? `(${CADF(value)})` : CADF(value)}
            </span>
          </td>
        ) : <td />}
      </tr>
    </>
  );
}

// ─── Expense bar ──────────────────────────────────────────────────────────────

const EXPENSE_COLORS = {
  wages: '#ff9f0a', owner_salary: '#ff6b35', payroll_taxes: '#ffcc00',
  rent: '#0071e3', royalties: '#6366f1', pos_fees: '#8e8e93',
  marketing: '#ff3b30', accounting: '#34c759', telecom: '#5ac8fa', insurance: '#aeaeb2',
};

const EXPENSE_LABELS = {
  wages: 'Staff Wages', owner_salary: "Owner's Salary", payroll_taxes: 'Payroll Taxes',
  rent: 'Rent', royalties: 'Royalties', pos_fees: 'POS Fees',
  marketing: 'Marketing', accounting: 'Accounting', telecom: 'Telecom & WiFi', insurance: 'Insurance',
};

function ExpBar({ name, value, max }) {
  const w = (value / max) * 100;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-[12px] shrink-0 w-28" style={{ color: '#6e6e73' }}>
        {EXPENSE_LABELS[name] || name}
      </span>
      <div className="flex-1 h-2 rounded-full" style={{ background: '#f5f5f7' }}>
        <div className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${w}%`, background: EXPENSE_COLORS[name] || '#aeaeb2' }} />
      </div>
      <span className="text-[12px] font-semibold font-mono w-20 text-right" style={{ color: '#1d1d1f' }}>
        {CADF(value)}
      </span>
    </div>
  );
}

// ─── YTD Progress ─────────────────────────────────────────────────────────────

function YtdBar({ label, actual, target, months }) {
  const annualPace = months > 0 ? (actual / months * 12) : 0;
  const trackPct   = Math.min(+(annualPace / target * 100).toFixed(0), 150);
  const ytdTarget  = target / 12 * months;
  const ytdPct     = Math.min(+(actual / ytdTarget * 100).toFixed(0), 150);
  const on = ytdPct >= 95;
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between mb-1.5">
        <span className="text-[12px] font-medium" style={{ color: '#3a3a3c' }}>{label}</span>
        <span className="text-[12px] font-bold font-mono" style={{ color: on ? '#1b8a5f' : '#ff9f0a' }}>
          {ytdPct}% of {months}m target
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ background: '#f0f0f0' }}>
        <div className="h-2 rounded-full transition-all"
          style={{ width: `${Math.min(ytdPct, 100)}%`, background: on ? '#34c759' : '#ff9f0a' }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[11px]" style={{ color: '#8e8e93' }}>YTD actual {CAD(actual)}</span>
        <span className="text-[11px]" style={{ color: '#8e8e93' }}>Annual target {CAD(target)}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [data,       setData]       = useState([]);
  const [ytd,        setYtd]        = useState(null);
  const [topProds,   setTopProds]   = useState([]);
  const [months,     setMonths]     = useState(6);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      authFetch(`/api/finance/pnl?months=${months}`).then(r => r.json()),
      authFetch('/api/finance/ytd?year=1').then(r => r.json()),
      authFetch('/api/finance/top-products?limit=8').then(r => r.json()),
    ]).then(([pnl, ytdData, tp]) => {
      setData(pnl);
      setYtd(ytdData);
      setTopProds(tp);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [months]);

  const cur  = data[data.length - 1];
  const prev = data[data.length - 2];

  const chart = data.map(d => ({
    name:          d.period.short,
    Actual:        d.actualRevenue || d.revenue,
    Plan:          d.planRevenue,
    'Gross Profit': d.grossProfit,
    EBITDA:        d.ebitda,
    'Net Income':  d.netIncome,
  }));

  const opex    = cur?.opex || {};
  const opexMax = Math.max(...Object.entries(opex).filter(([k]) => k !== 'total').map(([, v]) => v));
  const opexSorted = Object.entries(opex).filter(([k]) => k !== 'total').sort((a, b) => b[1] - a[1]);

  if (loading) return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-white animate-pulse" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} />
      ))}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-7 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1d1d1f]">Financials</h1>
          <p className="text-[14px] text-[#6e6e73] mt-1">
            P&amp;L — 1170 Rue de Bleury · Montréal
            {cur && (
              <span className="ml-2 px-2 py-0.5 rounded-lg text-[12px] font-semibold"
                style={{ background: '#f0faf4', color: '#1b8a5f' }}>
                Year {cur.period.planYear} · Month {cur.period.planMonth}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[3, 6, 12].map(n => (
            <button key={n} onClick={() => setMonths(n)}
              className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
              style={months === n
                ? { background: '#1c1c1e', color: '#fff' }
                : { background: '#fff', color: '#6e6e73', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {n}M
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {cur && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Revenue"     value={CAD(cur.actualRevenue || cur.revenue)}
            sub={cur.vsTarget !== null
              ? `${cur.vsTarget > 0 ? '+' : ''}${cur.vsTarget}% vs $${Math.round(cur.planRevenue/1000)}k plan`
              : (cur.period.planMonth === 1 ? 'Opening month' : 'In-store + delivery')}
            change={delta(cur.revenue, prev?.revenue)} />
          <KpiCard label="Gross Profit" value={CAD(cur.grossProfit)}
            sub={`${cur.grossMargin}% margin on sales`}
            change={delta(cur.grossProfit, prev?.grossProfit)} />
          <KpiCard label="EBITDA"       value={CAD(cur.ebitda)}
            sub={`${cur.ebitdaMargin}% EBITDA margin`}
            change={delta(cur.ebitda, prev?.ebitda)}
            positive={cur.ebitda >= 0} />
          <KpiCard label="Net Income"   value={CAD(cur.netIncome)}
            sub={`After $${Math.round(cur.interest).toLocaleString('en-CA')} interest`}
            change={delta(cur.netIncome, prev?.netIncome)}
            positive={cur.netIncome >= 0} dark />
        </div>
      )}

      {/* Trend Chart */}
      <div className="rounded-2xl p-6 mb-6"
        style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)' }}>
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#1d1d1f]">Revenue & Profit Trend</h2>
            <p className="text-[12px] text-[#8e8e93] mt-0.5">Last {months} months · from KaleMart24 financial model (CAD)</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[12px]">
            {[
              { color: 'rgba(27,138,95,0.75)', label: 'Actual', bar: true },
              { color: 'rgba(174,174,178,0.4)', label: 'Plan', bar: true },
              { color: '#1b8a5f',               label: 'Gross Profit' },
              { color: '#0071e3',               label: 'EBITDA' },
              { color: '#ff9f0a',               label: 'Net Income', dash: true },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5" style={{ color: '#6e6e73' }}>
                {l.bar
                  ? <span className="w-3 h-3 rounded inline-block" style={{ background: l.color }} />
                  : <span className="w-5 h-0.5 inline-block rounded-full" style={{ background: l.color, borderTop: l.dash ? '2px dashed' : 'none' }} />}
                {l.label}
              </span>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chart} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#aeaeb2' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: '#aeaeb2' }} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="Plan" radius={[4,4,0,0]} maxBarSize={42} fill="rgba(174,174,178,0.35)" />
            <Bar dataKey="Actual" radius={[4,4,0,0]} maxBarSize={42}>
              {chart.map((_, i) => (
                <Cell key={i} fill={i === chart.length-1 ? 'rgba(27,138,95,0.5)' : 'rgba(27,138,95,0.75)'} />
              ))}
            </Bar>
            <Line dataKey="Gross Profit" stroke="#1b8a5f" strokeWidth={2.5} dot={{ r:3, fill:'#1b8a5f', strokeWidth:0 }} activeDot={{ r:5 }} />
            <Line dataKey="EBITDA" stroke="#0071e3" strokeWidth={2} dot={{ r:3, fill:'#0071e3', strokeWidth:0 }} activeDot={{ r:5 }} />
            <Line dataKey="Net Income" stroke="#ff9f0a" strokeWidth={2} strokeDasharray="5 3" dot={{ r:3, fill:'#ff9f0a', strokeWidth:0 }} activeDot={{ r:5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* P&L + Expenses + YTD */}
      {cur && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Income Statement */}
          <div className="rounded-2xl p-6"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)' }}>
            <h2 className="text-[15px] font-bold text-[#1d1d1f] mb-0.5">Income Statement</h2>
            <p className="text-[12px] text-[#8e8e93] mb-5">{cur.period.label} · CAD</p>
            <table className="w-full">
              <tbody>
                <Row label="Revenue"          value={cur.revenue}      bold />
                <Row label="Cost of Goods Sold" value={-cur.cogs}      indent muted />
                <Row label="Gross Profit"     value={cur.grossProfit}  bold line color="#1b8a5f" />
                <Row label={`Gross Margin ${pct(cur.grossMargin)}`} value={null} muted />

                <tr><td colSpan={2}><p className="text-[10px] font-bold uppercase tracking-widest mt-4 mb-1" style={{ color: '#aeaeb2' }}>Operating Expenses</p></td></tr>
                {opexSorted.map(([k, v]) => (
                  <Row key={k} label={EXPENSE_LABELS[k] || k} value={-v} indent muted />
                ))}
                <Row label="Total OpEx"       value={-opex.total}      bold line />

                <Row label="EBITDA"           value={cur.ebitda}       bold line color={cur.ebitda >= 0 ? '#1b8a5f' : '#ff3b30'} />
                <Row label={`EBITDA Margin ${pct(cur.ebitdaMargin)}`} value={null} muted />
                <Row label="Interest Expense" value={-cur.interest}    indent muted />
                <Row label="Net Income"       value={cur.netIncome}    bold line color={cur.netIncome >= 0 ? '#0071e3' : '#ff3b30'} />
                <Row label={`Net Margin ${pct(cur.netMargin)}`}        value={null} muted />
              </tbody>
            </table>

            {/* Insight */}
            <div className="mt-5 rounded-xl p-3.5"
              style={{ background: cur.ebitda >= 0 ? '#f0faf4' : '#fff0ef' }}>
              <p className="text-[12px] leading-relaxed"
                style={{ color: cur.ebitda >= 0 ? '#1b8a5f' : '#ff3b30' }}>
                {cur.ebitda >= 0
                  ? `✦ On track. Each $1 of additional revenue adds ~$0.45 in gross profit. A 5% uplift adds ${CAD(cur.revenue * 0.05 * 0.4536)} to EBITDA this month.`
                  : `⚠ Below plan. Need ${CAD(Math.abs(cur.ebitda) / 0.4536)} more revenue at 45.4% gross margin to break even.`}
              </p>
            </div>
          </div>

          {/* OpEx Breakdown */}
          <div className="rounded-2xl p-6"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)' }}>
            <h2 className="text-[15px] font-bold text-[#1d1d1f] mb-0.5">Operating Expenses</h2>
            <p className="text-[12px] text-[#8e8e93] mb-5">
              {CADF(opex.total)}/month · Year {cur.period.planYear} plan
            </p>

            <div className="space-y-0.5">
              {opexSorted.map(([k, v]) => (
                <ExpBar key={k} name={k} value={v} max={opexMax} />
              ))}
            </div>

            <div className="flex justify-between items-center mt-4 pt-4"
              style={{ borderTop: '1px solid #f5f5f7' }}>
              <span className="text-[13px] font-bold text-[#1d1d1f]">Total OpEx</span>
              <span className="text-[15px] font-bold font-mono text-[#1d1d1f]">{CADF(opex.total)}</span>
            </div>

            {/* Wages ratio callout */}
            <div className="mt-4 rounded-xl p-3.5" style={{ background: '#f5f5f7' }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#aeaeb2' }}>Labour Cost Ratio</p>
              {(() => {
                const totalLabour = opex.wages + opex.owner_salary + opex.payroll_taxes;
                const labourPct = ((totalLabour / cur.revenue) * 100).toFixed(1);
                const ok = parseFloat(labourPct) < 14;
                return (
                  <>
                    <div className="flex justify-between mb-1">
                      <span className="text-[12px]" style={{ color: '#6e6e73' }}>Labour / Revenue</span>
                      <span className="text-[12px] font-bold" style={{ color: ok ? '#1b8a5f' : '#ff9f0a' }}>{labourPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: '#e5e5ea' }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(parseFloat(labourPct) * 4, 100)}%`, background: ok ? '#34c759' : '#ff9f0a' }} />
                    </div>
                    <p className="text-[11px] mt-1.5" style={{ color: '#8e8e93' }}>
                      {ok ? 'Healthy ratio — under 14% threshold' : 'Watch: aim to keep under 14% of revenue'}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          {/* YTD vs Plan */}
          <div className="rounded-2xl p-6"
            style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)' }}>
            <h2 className="text-[15px] font-bold text-[#1d1d1f] mb-0.5">YTD vs Plan</h2>
            <p className="text-[12px] text-[#8e8e93] mb-5">
              {ytd ? `Year 1 · ${ytd.monthsElapsed} months elapsed` : 'Year 1'}
            </p>

            {ytd && (
              <>
                <YtdBar label="Revenue"    actual={ytd.ytd.revenue}   target={ytd.annualTarget.revenue}   months={ytd.monthsElapsed} />
                <YtdBar label="EBITDA"     actual={ytd.ytd.ebitda}    target={ytd.annualTarget.ebitda}    months={ytd.monthsElapsed} />
                <YtdBar label="Net Income" actual={ytd.ytd.netIncome} target={ytd.annualTarget.netIncome} months={ytd.monthsElapsed} />

                {/* Annual run rate */}
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid #f5f5f7' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#aeaeb2' }}>Annual Run Rate</p>
                  {[
                    { label: 'Revenue',    pace: ytd.paceRevenue,  target: ytd.annualTarget.revenue },
                    { label: 'EBITDA',     pace: ytd.paceEbitda,   target: ytd.annualTarget.ebitda },
                  ].map(({ label, pace, target }) => (
                    <div key={label} className="flex items-center justify-between mb-2">
                      <span className="text-[12px]" style={{ color: '#6e6e73' }}>{label} pace</span>
                      <div className="text-right">
                        <span className="text-[13px] font-bold font-mono text-[#1d1d1f]">{CAD(pace)}</span>
                        <span className="text-[11px] ml-1.5" style={{ color: '#aeaeb2' }}>/ yr</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 3-year targets */}
            <div className="mt-5 rounded-xl p-4" style={{ background: '#1c1c1e' }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#636366' }}>3-Year Projections</p>
              {[
                { yr: 'Year 1', rev: 1277500,  ebitda: 154671  },
                { yr: 'Year 2', rev: 1328600,  ebitda: 173713  },
                { yr: 'Year 3', rev: 1381744,  ebitda: 192041  },
              ].map(({ yr, rev, ebitda }) => (
                <div key={yr} className="flex items-center justify-between mb-2 last:mb-0">
                  <span className="text-[12px]" style={{ color: '#636366' }}>{yr}</span>
                  <div className="text-right">
                    <span className="text-[12px] font-semibold text-white">{CAD(rev)}</span>
                    <span className="text-[11px] ml-2" style={{ color: '#34c759' }}>EBITDA {CAD(ebitda)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Products */}
      {topProds.length > 0 && (
        <div className="mt-6 rounded-2xl p-6"
          style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)' }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-bold text-[#1d1d1f]">Top Products by Revenue</h2>
              <p className="text-[12px] text-[#8e8e93] mt-0.5">All-time · from 6 months of real sales data</p>
            </div>
          </div>
          <div className="space-y-2">
            {topProds.map((p, i) => {
              const maxRev = topProds[0]?.revenue || 1;
              const barW = (p.revenue / maxRev) * 100;
              const catColor = {
                beverages: '#5b9fd4', 'grab-n-go': '#7ec87a', snacks: '#ff9f0a',
                chilled: '#5ac8fa', 'hot-drinks': '#d4903d', health: '#9b5de5',
                fresh: '#34c759', 'personal-care': '#ff6b35',
              }[p.category] || '#aeaeb2';
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-[12px] font-mono w-5 text-right shrink-0" style={{ color: '#aeaeb2' }}>{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[13px] font-medium truncate" style={{ color: '#1d1d1f' }}>{p.name}</span>
                      <span className="text-[13px] font-bold font-mono ml-3 shrink-0" style={{ color: '#1d1d1f' }}>{CAD(p.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: '#f5f5f7' }}>
                        <div className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${barW}%`, background: catColor }} />
                      </div>
                      <span className="text-[11px] shrink-0 font-mono" style={{ color: '#aeaeb2' }}>
                        {p.units_sold.toLocaleString()} units
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

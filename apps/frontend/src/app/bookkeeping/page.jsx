'use client';
import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../lib/api';

const CAD = n => n == null ? '—' : `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CAT_COLORS = {
  '5000': '#ff6b35', // COGS — orange
  '6100': '#ff9f0a', // wages
  '6110': '#ffcc00',
  '6120': '#ffd60a',
  '6200': '#0071e3', // rent
  '6300': '#6366f1', // royalties
  '6400': '#8e8e93', // POS
  '6500': '#ff3b30', // marketing
  '6600': '#34c759', // accounting
  '6700': '#5ac8fa', // telecom
  '6800': '#aeaeb2',
  '6900': '#30d158', // utilities
  '6950': '#64d2ff', // supplies
  '7000': '#636366', // bank
};

function MonthPicker({ year, month, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => {
        const d = new Date(year, month - 2, 1);
        onChange(d.getFullYear(), d.getMonth() + 1);
      }} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: 'var(--text-2)', fontSize: 14 }}>‹</button>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', minWidth: 90, textAlign: 'center' }}>
        {MONTHS[month-1]} {year}
      </span>
      <button onClick={() => {
        const d = new Date(year, month, 1);
        onChange(d.getFullYear(), d.getMonth() + 1);
      }} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: 'var(--text-2)', fontSize: 14 }}>›</button>
    </div>
  );
}

function AddExpenseModal({ categories, onSave, onClose }) {
  const [form, setForm] = useState({
    categoryId: categories[0]?.id || '',
    description: '',
    amount: '',
    tpsPaid: '',
    tvqPaid: '',
    vendor: '',
    reference: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-calculate tax when amount changes
  const handleAmountChange = v => {
    set('amount', v);
    const cat = categories.find(c => c.id === form.categoryId);
    if (cat?.itc_eligible && v) {
      set('tpsPaid', (parseFloat(v) * 0.05).toFixed(2));
      set('tvqPaid', (parseFloat(v) * 0.09975).toFixed(2));
    }
  };

  const handleSubmit = async () => {
    if (!form.categoryId || !form.description || !form.amount || !form.date) return;
    await authFetch('/api/bookkeeping/expenses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        categoryId: form.categoryId, description: form.description,
        amount: parseFloat(form.amount), tpsPaid: parseFloat(form.tpsPaid || 0),
        tvqPaid: parseFloat(form.tvqPaid || 0), vendor: form.vendor,
        reference: form.reference, date: form.date,
      }),
    });
    onSave();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 28, width: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, fontStyle: 'italic' }}>Add Expense</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)' }}>×</button>
        </div>
        {[
          { label: 'Category', key: 'categoryId', type: 'select' },
          { label: 'Description', key: 'description', placeholder: 'e.g. KeHE Invoice #1234' },
          { label: 'Vendor', key: 'vendor', placeholder: 'e.g. KeHE Distributors' },
          { label: 'Date', key: 'date', type: 'date' },
          { label: 'Amount (before tax)', key: 'amount', type: 'number', placeholder: '0.00', onChange: handleAmountChange },
          { label: 'TPS/GST Paid (ITC)', key: 'tpsPaid', type: 'number', placeholder: '0.00' },
          { label: 'TVQ/QST Paid (ITR)', key: 'tvqPaid', type: 'number', placeholder: '0.00' },
          { label: 'Reference / Invoice #', key: 'reference', placeholder: 'INV-2026-001' },
        ].map(({ label, key, type = 'text', placeholder, onChange }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</label>
            {type === 'select' ? (
              <select value={form[key]} onChange={e => set(key, e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--text)' }}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.account_code} — {c.name}</option>)}
              </select>
            ) : (
              <input type={type} value={form[key]} placeholder={placeholder}
                onChange={e => (onChange || (v => set(key, v)))(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            )}
          </div>
        ))}
        <button onClick={handleSubmit} style={{ width: '100%', marginTop: 8, padding: '11px', background: 'var(--brand)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#0c1510' }}>
          Save Expense
        </button>
      </div>
    </div>
  );
}

export default function BookkeepingPage() {
  const now = new Date();
  const [year,     setYear]     = useState(now.getFullYear());
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [ledger,   setLedger]   = useState(null);
  const [summary,  setSummary]  = useState([]);
  const [cats,     setCats]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [filter,   setFilter]   = useState('all'); // all | income | expense

  const load = useCallback(async () => {
    setLoading(true);
    const [l, s, c] = await Promise.all([
      authFetch(`/api/bookkeeping/ledger?year=${year}&month=${month}`).then(r => r.json()),
      authFetch('/api/bookkeeping/summary').then(r => r.json()),
      authFetch('/api/bookkeeping/categories').then(r => r.json()),
    ]);
    setLedger(l);
    setSummary(s);
    setCats(c);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const handleMonthChange = (y, m) => { setYear(y); setMonth(m); };

  const entries = (ledger?.entries || []).filter(e =>
    filter === 'all' || e.type === filter
  );

  const cur = summary.find(s => s.month === `${year}-${String(month).padStart(2,'0')}`);

  return (
    <div>
      {showAdd && cats.length > 0 && (
        <AddExpenseModal categories={cats} onSave={() => { setShowAdd(false); load(); }} onClose={() => setShowAdd(false)} />
      )}

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>General Ledger</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 400, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1 }}>Bookkeeping</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>Income &amp; expenses — 1170 Rue de Bleury · CAD</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <MonthPicker year={year} month={month} onChange={handleMonthChange} />
          <button onClick={() => setShowAdd(true)}
            style={{ background: 'var(--brand)', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#0c1510' }}>
            + Add Expense
          </button>
        </div>
      </div>

      {/* Month KPIs */}
      {ledger && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Income',   value: ledger.summary.totalIncome,   color: 'var(--brand)' },
            { label: 'Total Expenses', value: ledger.summary.totalExpenses,  color: 'var(--red)' },
            { label: 'Net Income',     value: ledger.summary.netIncome,      color: ledger.summary.netIncome >= 0 ? '#0071e3' : 'var(--red)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: '18px 22px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, color, lineHeight: 1 }}>{CAD(value)}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

        {/* Ledger table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Filter bar */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            {['all','income','expense'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: filter === f ? 'var(--brand)' : 'var(--surface-2)', color: filter === f ? '#0c1510' : 'var(--text-2)' }}>
                {f === 'all' ? 'All' : f === 'income' ? 'Income' : 'Expenses'}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Date','Category','Description / Vendor','Amount','TPS','TVQ',''].map(h => (
                    <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const isIncome = e.type === 'income';
                  const dotColor = CAT_COLORS[e.account_code] || 'var(--text-3)';
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}
                      onMouseEnter={el => el.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={el => el.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                        {String(e.date).slice(0, 10)}
                      </td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 2, background: isIncome ? 'var(--brand)' : dotColor, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{e.category}</span>
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text)' }}>
                        <div style={{ fontWeight: 500 }}>{e.description || (isIncome ? `${e.txn_count} transactions` : e.vendor)}</div>
                        {!isIncome && e.vendor && e.description !== e.vendor && (
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{e.vendor}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: isIncome ? 'var(--brand)' : 'var(--text)', whiteSpace: 'nowrap' }}>
                        {isIncome ? '+' : '−'}{CAD(e.amount)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                        {e.tps_paid ? CAD(e.tps_paid) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                        {e.tvq_paid ? CAD(e.tvq_paid) : '—'}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {e.id && (
                          <button onClick={async () => {
                            await authFetch(`/api/bookkeeping/expenses/${e.id}`, { method: 'DELETE' });
                            load();
                          }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14, padding: '2px 6px' }}>×</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>No entries for this period</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Right panel — expense breakdown + 6-month summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Expense breakdown this month */}
          {cur && (
            <div className="card" style={{ padding: '20px 22px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Expenses by Category</p>
              {cur.breakdown.map(b => {
                const pct = cur.expenses > 0 ? (b.amount / cur.expenses) * 100 : 0;
                const color = CAT_COLORS[b.account_code] || 'var(--text-3)';
                return (
                  <div key={b.account_code} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{b.category}</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>{CAD(b.amount)}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: 'var(--surface-2)' }}>
                      <div style={{ height: 4, borderRadius: 99, background: color, width: `${Math.min(pct, 100)}%`, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 6-month net income mini chart */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>6-Month Net Income</p>
            {summary.slice(-6).map(s => {
              const maxAbs = Math.max(...summary.slice(-6).map(x => Math.abs(x.netIncome)), 1);
              const w = Math.abs(s.netIncome) / maxAbs * 100;
              const positive = s.netIncome >= 0;
              const isSelected = s.month === `${year}-${String(month).padStart(2,'0')}`;
              return (
                <div key={s.month} onClick={() => { const [y,m] = s.month.split('-'); handleMonthChange(parseInt(y), parseInt(m)); }}
                  style={{ marginBottom: 8, cursor: 'pointer', opacity: isSelected ? 1 : 0.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: isSelected ? 'var(--text)' : 'var(--text-3)', fontWeight: isSelected ? 600 : 400 }}>{s.label}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: positive ? 'var(--brand)' : 'var(--red)', fontWeight: 600 }}>{positive ? '+' : ''}{CAD(s.netIncome)}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 99, background: 'var(--surface-2)' }}>
                    <div style={{ height: 3, borderRadius: 99, background: positive ? 'var(--brand)' : 'var(--red)', width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

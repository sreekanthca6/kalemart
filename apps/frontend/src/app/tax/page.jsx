'use client';
import { useState, useEffect } from 'react';
import { authFetch } from '../../lib/api';

const CAD = n => n == null ? '—' : `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = n => `${(n * 100).toFixed(3)}%`;

function StatusBadge({ status, urgent }) {
  const cfg = {
    open:  { bg: urgent ? 'var(--red-dim)'   : 'var(--amber-dim)', color: urgent ? 'var(--red)' : 'var(--amber)', label: urgent ? 'DUE SOON' : 'OPEN'   },
    filed: { bg: 'var(--brand-dim)',                                color: 'var(--brand)',                        label: 'FILED'                          },
    paid:  { bg: 'rgba(0,113,227,0.1)',                             color: '#0071e3',                             label: 'PAID'                           },
  }[status] || { bg: 'var(--surface-2)', color: 'var(--text-3)', label: status.toUpperCase() };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontFamily: 'var(--font-mono)' }}>
      {cfg.label}
    </span>
  );
}

function ReturnModal({ period, onClose, onFiled }) {
  const [detail, setDetail] = useState(null);
  const [filing, setFiling] = useState(false);

  useEffect(() => {
    authFetch(`/api/tax/periods/${period.id}`).then(r => r.json()).then(setDetail);
  }, [period.id]);

  const handleFile = async () => {
    setFiling(true);
    await authFetch(`/api/tax/periods/${period.id}/file`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
    onFiled();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 32, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TPS/TVQ Return</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, fontStyle: 'italic', marginTop: 4 }}>{period.period}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-3)' }}>×</button>
        </div>

        {!detail ? (
          <p style={{ textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Calculating…</p>
        ) : (
          <>
            {/* Line A — Total sales */}
            <Section label="SECTION A — SALES">
              <Line label="Total sales (incl. zero-rated)"    value={CAD(detail.totalRevenue)}    />
              <Line label="Zero-rated sales (basic groceries)" value={`(${CAD(detail.zeroRatedRevenue)})`} muted />
              <Line label="Taxable sales"                      value={CAD(detail.taxableRevenue)} bold />
            </Section>

            {/* Line B — Tax collected */}
            <Section label="SECTION B — TAX COLLECTED">
              <Line label={`TPS collected (${pct(0.05)} × ${CAD(detail.taxableRevenue)})`} value={CAD(detail.tpsCollected)} />
              <Line label={`TVQ collected (${pct(0.09975)} × ${CAD(detail.taxableRevenue)})`} value={CAD(detail.tvqCollected)} />
              <Line label="Total tax collected" value={CAD(detail.tpsCollected + detail.tvqCollected)} bold />
            </Section>

            {/* Line C — ITCs / ITRs */}
            <Section label="SECTION C — INPUT TAX CREDITS">
              <Line label="TPS paid on eligible expenses (ITC)" value={`(${CAD(detail.tpsITC)})`} color="var(--brand)" />
              <Line label="TVQ paid on eligible expenses (ITR)" value={`(${CAD(detail.tvqITR)})`} color="var(--brand)" />
              <Line label="Total credits"                        value={`(${CAD(detail.tpsITC + detail.tvqITR)})`} bold color="var(--brand)" />
            </Section>

            {/* Expense breakdown */}
            {detail.expenseBreakdown?.length > 0 && (
              <Section label="ELIGIBLE EXPENSES">
                {detail.expenseBreakdown.map(e => (
                  <Line key={e.account_code} label={e.name} value={CAD(e.amount)} sub={`TPS ${CAD(e.tps_paid)} · TVQ ${CAD(e.tvq_paid)}`} muted />
                ))}
              </Section>
            )}

            {/* Net owing */}
            <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: detail.totalOwing > 0 ? 'var(--red-dim)' : 'var(--brand-dim)', border: `1px solid ${detail.totalOwing > 0 ? 'rgba(217,91,71,0.2)' : 'rgba(126,200,122,0.2)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>TPS Net Owing</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: detail.tpsNet > 0 ? 'var(--red)' : 'var(--brand)' }}>{CAD(detail.tpsNet)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>TVQ Net Owing</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: detail.tvqNet > 0 ? 'var(--red)' : 'var(--brand)' }}>{CAD(detail.tvqNet)}</span>
              </div>
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Total Owing to CRA/RQ</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: detail.totalOwing > 0 ? 'var(--red)' : 'var(--brand)' }}>{CAD(detail.totalOwing)}</span>
              </div>
            </div>

            <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                <strong>TPS</strong> → File with CRA via My Business Account or netfile.cra.gc.ca<br />
                <strong>TVQ</strong> → File with Revenu Québec via clicSEQUR-Express or clic.revenuquebec.ca<br />
                Filing due: <strong style={{ color: 'var(--text)' }}>{detail.filing_due}</strong>
              </p>
            </div>

            {period.status === 'open' && (
              <button onClick={handleFile} disabled={filing}
                style={{ width: '100%', marginTop: 16, padding: 12, background: 'var(--brand)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: filing ? 'default' : 'pointer', color: '#0c1510', opacity: filing ? 0.6 : 1 }}>
                {filing ? 'Marking as Filed…' : 'Mark as Filed ✓'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>{label}</p>
      <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function Line({ label, value, bold, muted, color, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 14px', borderBottom: '1px solid var(--border)', lastChild: { borderBottom: 'none' } }}>
      <div>
        <span style={{ fontSize: 13, color: muted ? 'var(--text-3)' : 'var(--text)', fontWeight: bold ? 600 : 400 }}>{label}</span>
        {sub && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{sub}</p>}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: bold ? 700 : 500, color: color || (muted ? 'var(--text-3)' : 'var(--text)'), whiteSpace: 'nowrap', marginLeft: 16 }}>{value}</span>
    </div>
  );
}

export default function TaxPage() {
  const [periods,    setPeriods]    = useState([]);
  const [summary,    setSummary]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);

  const load = async () => {
    setLoading(true);
    const [p, s] = await Promise.all([
      authFetch('/api/tax/periods').then(r => r.json()),
      authFetch('/api/tax/summary').then(r => r.json()),
    ]);
    setPeriods(p);
    setSummary(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedPeriod = selected ? summary.find(s => s.id === selected) : null;

  return (
    <div>
      {selectedPeriod && (
        <ReturnModal period={selectedPeriod} onClose={() => setSelected(null)} onFiled={() => { setSelected(null); load(); }} />
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Revenu Québec · CRA</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 400, fontStyle: 'italic', color: 'var(--text)', lineHeight: 1 }}>Tax Filing</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>TPS (GST) 5% · TVQ (QST) 9.975% · Quarterly returns</p>
      </div>

      {/* Urgent banner */}
      {summary.some(s => s.urgent) && (
        <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 12, background: 'var(--red-dim)', border: '1px solid rgba(217,91,71,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--red)' }}>Return due soon</p>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
              {summary.filter(s => s.urgent).map(s => `${s.period} (due ${s.filingDue})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Period cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Calculating…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 28 }}>
          {periods.map(p => (
            <div key={p.id} className="card" style={{ padding: 24, cursor: 'pointer' }}
              onClick={() => setSelected(p.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {p.period_start?.slice(0,7)} → {p.period_end?.slice(0,7)}
                  </p>
                  <p style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>
                    {new Date(p.period_start).toLocaleString('en-CA', { month: 'short', year: 'numeric' })} –{' '}
                    {new Date(p.period_end).toLocaleString('en-CA', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <StatusBadge status={p.status} urgent={summary.find(s=>s.id===p.id)?.urgent} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Taxable Sales',   value: CAD(p.taxableRevenue)  },
                  { label: 'Tax Collected',   value: CAD((p.tpsCollected||0) + (p.tvqCollected||0)) },
                  { label: 'ITCs / ITRs',     value: `−${CAD((p.tpsITC||0) + (p.tvqITR||0))}`, color: 'var(--brand)' },
                  { label: 'Net Owing',       value: CAD(p.totalOwing), color: (p.totalOwing||0) > 0 ? 'var(--red)' : 'var(--brand)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)' }}>
                    <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: color || 'var(--text)' }}>{value}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Due {p.filing_due} · {summary.find(s=>s.id===p.id)?.daysUntilDue > 0 ? `${summary.find(s=>s.id===p.id)?.daysUntilDue}d remaining` : 'Overdue'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>View Return →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="card" style={{ padding: 24 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>How Your Tax Is Calculated</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { step: '01', title: 'Tax Collected', body: 'TPS (5%) + TVQ (9.975%) collected on taxable sales. Fresh produce and basic dairy are zero-rated — no tax collected.' },
            { step: '02', title: 'Input Tax Credits', body: 'TPS/TVQ you paid on eligible business expenses (rent, marketing, supplies) is recovered as ITCs/ITRs, reducing what you owe.' },
            { step: '03', title: 'Net Owing', body: 'Tax Collected − ITCs = what you remit to CRA (TPS) and Revenu Québec (TVQ) by the quarterly due date.' },
          ].map(({ step, title, body }) => (
            <div key={step} style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--surface-2)' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brand)', fontWeight: 700, marginBottom: 6 }}>{step}</p>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{title}</p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

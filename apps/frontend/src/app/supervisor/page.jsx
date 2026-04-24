'use client';
import { useState, useEffect } from 'react';
import { authFetch } from '../../lib/api';

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE = {
  expiry:   { label: 'Expiry',   color: '#ff3b30', bg: '#fff0ef', dot: '#ff3b30',  icon: '⏰' },
  restock:  { label: 'Restock',  color: '#ff9f0a', bg: '#fff8ee', dot: '#ff9f0a',  icon: '📦' },
  try_new:  { label: 'Try New',  color: '#1b8a5f', bg: '#f0faf4', dot: '#34c759',  icon: '✨' },
  review:   { label: 'Review',   color: '#8e8e93', bg: '#f5f5f7', dot: '#aeaeb2',  icon: '🔍' },
  combo:    { label: 'Combo',    color: '#6366f1', bg: '#f0f0ff', dot: '#818cf8',  icon: '💡' },
  promo:    { label: 'Promo',    color: '#0071e3', bg: '#f0f6ff', dot: '#60a5fa',  icon: '📣' },
};
const PRIORITY = {
  urgent: { label: 'URGENT', color: '#ff3b30', bg: '#fff0ef' },
  high:   { label: 'HIGH',   color: '#ff9f0a', bg: '#fff8ee' },
  normal: { label: '',       color: '',        bg: '' },
};

// ─── Context bar ─────────────────────────────────────────────────────────────
function ContextBar({ context, runAt, running, onRun }) {
  const w = context?.weather || {};
  const events = context?.events || [];
  const lastRun = runAt
    ? new Date(runAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="rounded-2xl p-5 mb-6 flex flex-wrap items-center justify-between gap-4"
      style={{ background: '#1c1c1e', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
      <div className="flex flex-wrap items-center gap-4 text-[13px]">
        {w.weekend && (
          <span className="flex items-center gap-1.5 text-white/80">
            <span>{w.temp > 18 ? '☀️' : w.temp > 12 ? '⛅' : '🌧'}</span>
            {w.weekend}
          </span>
        )}
        {events.map((e, i) => (
          <span key={i} className="flex items-center gap-1.5 text-white/80">
            <span>🛒</span> {e.name} · {e.distance}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {lastRun && (
          <span className="text-[12px] text-white/40">Last run {lastRun}</span>
        )}
        <button
          onClick={onRun}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: running ? '#2a2a2e' : '#1b8a5f' }}
        >
          {running ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              Analysing…
            </>
          ) : (
            <> ▶ Run Analysis </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────
function FilterTabs({ recs, active, onChange }) {
  const counts = {};
  for (const r of recs) counts[r.type] = (counts[r.type] || 0) + 1;
  const tabs = [{ key: 'all', label: 'All', count: recs.length }, ...Object.entries(TYPE).map(([k, v]) => ({ key: k, label: v.label, count: counts[k] || 0, icon: v.icon }))];

  return (
    <div className="flex gap-2 flex-wrap mb-6">
      {tabs.filter(t => t.count > 0 || t.key === 'all').map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-medium transition-all"
          style={active === t.key
            ? { background: '#1c1c1e', color: '#ffffff' }
            : { background: '#ffffff', color: '#6e6e73', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
          }
        >
          {t.icon && <span>{t.icon}</span>}
          {t.label}
          {t.count > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={active === t.key ? { background: 'rgba(255,255,255,0.15)', color: '#fff' } : { background: '#f5f5f7', color: '#8e8e93' }}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Recommendation card ──────────────────────────────────────────────────────
function RecCard({ rec, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const t = TYPE[rec.type] || TYPE.restock;
  const p = PRIORITY[rec.priority] || PRIORITY.normal;
  const done = rec.status === 'approved' || rec.status === 'rejected';

  // Bold **text** in reasoning
  function renderReasoning(text) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith('**') ? <strong key={i} style={{ color: '#1d1d1f' }}>{p.slice(2, -2)}</strong> : p
    );
  }

  return (
    <div
      className="rounded-2xl transition-all duration-200"
      style={{
        background: '#ffffff',
        boxShadow: done ? 'none' : '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)',
        opacity: done ? 0.5 : 1,
        borderLeft: `3px solid ${t.color}`,
      }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
              style={{ background: t.bg, color: t.color }}>
              {t.icon} {t.label}
            </span>
            {p.label && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: p.bg, color: p.color }}>
                {p.label}
              </span>
            )}
            {rec.status !== 'pending' && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={rec.status === 'approved'
                  ? { background: '#f0faf4', color: '#1b8a5f' }
                  : { background: '#f5f5f7', color: '#8e8e93' }}>
                {rec.status === 'approved' ? '✓ Approved' : '✗ Dismissed'}
              </span>
            )}
          </div>
        </div>

        {/* Title & summary */}
        <h3 className="text-[15px] font-bold text-[#1d1d1f] leading-snug">{rec.title}</h3>
        <p className="text-[13px] text-[#6e6e73] mt-1">{rec.summary}</p>

        {/* Reasoning (collapsible) */}
        <div className="mt-3">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[12px] text-[#0071e3] font-medium hover:underline"
          >
            {expanded ? '▾ Hide reasoning' : '▸ Show reasoning'}
          </button>
          {expanded && (
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: '#3a3a3c' }}>
              {renderReasoning(rec.reasoning)}
            </p>
          )}
        </div>

        {/* Metrics */}
        {rec.metrics && (
          <div className="flex flex-wrap gap-3 mt-4 pt-3" style={{ borderTop: '1px solid #f5f5f7' }}>
            {Object.entries(rec.metrics).map(([k, v]) => (
              <div key={k} className="text-center">
                <p className="text-[11px] uppercase tracking-wide" style={{ color: '#aeaeb2' }}>
                  {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </p>
                <p className="text-[13px] font-semibold text-[#1d1d1f]">{String(v)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {rec.status === 'pending' && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onAction(rec.id, 'approved')}
              className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-white transition-all"
              style={{ background: '#1b8a5f' }}
            >
              ✓ Approve{rec.action?.qty ? ` · ${rec.action.qty} units` : rec.action?.type === 'combo' ? ' Combo' : ''}
            </button>
            <button
              onClick={() => onAction(rec.id, 'rejected')}
              className="px-4 py-2 rounded-xl text-[13px] font-medium transition-all"
              style={{ background: '#f5f5f7', color: '#8e8e93' }}
            >
              ✗
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onRun, running }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5"
        style={{ background: '#f0faf4' }}>
        🧠
      </div>
      <h3 className="text-[18px] font-bold text-[#1d1d1f]">Ready to analyse</h3>
      <p className="text-[14px] text-[#6e6e73] mt-2 max-w-sm">
        The supervisor will analyse your inventory, local weather, and nearby events to generate actionable recommendations.
      </p>
      <button
        onClick={onRun}
        disabled={running}
        className="mt-6 px-6 py-3 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-50"
        style={{ background: '#1b8a5f' }}
      >
        {running ? 'Analysing…' : '▶ Run First Analysis'}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SupervisorPage() {
  const [analysis, setAnalysis]   = useState(null);
  const [running, setRunning]     = useState(false);
  const [filter, setFilter]       = useState('all');
  const [error, setError]         = useState(null);

  useEffect(() => {
    authFetch('/api/supervisor/latest')
      .then(r => r.json())
      .then(d => { if (d.recommendations?.length) setAnalysis(d); })
      .catch(() => {});
  }, []);

  async function runAnalysis() {
    setRunning(true);
    setError(null);
    try {
      const res = await authFetch('/api/supervisor/analyze', { method: 'POST' });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setAnalysis(data);
      setFilter('all');
    } catch (e) {
      setError('Analysis failed. Make sure all services are running.');
    } finally {
      setRunning(false);
    }
  }

  async function handleAction(id, status) {
    const res = await authFetch(`/api/supervisor/recommendations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAnalysis(prev => ({
        ...prev,
        recommendations: prev.recommendations.map(r => r.id === id ? updated : r),
      }));
    }
  }

  const recs = analysis?.recommendations || [];
  const filtered = filter === 'all' ? recs : recs.filter(r => r.type === filter);
  const pending = recs.filter(r => r.status === 'pending').length;
  const approved = recs.filter(r => r.status === 'approved').length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1d1d1f]">AI Supervisor</h1>
          <p className="text-[14px] text-[#6e6e73] mt-1">
            Autonomous inventory intelligence — analyses stock, weather, and local events.
          </p>
        </div>
        {recs.length > 0 && (
          <div className="flex items-center gap-4 text-[13px]">
            <span style={{ color: '#8e8e93' }}>{pending} pending · {approved} approved</span>
          </div>
        )}
      </div>

      {/* Context bar */}
      <ContextBar
        context={analysis?.context}
        runAt={analysis?.runAt}
        running={running}
        onRun={runAnalysis}
      />

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 mb-5 text-[13px] font-medium"
          style={{ background: '#fff0ef', color: '#ff3b30' }}>
          {error}
        </div>
      )}

      {/* Mode badge */}
      {analysis?.mode && (
        <div className="mb-5 flex items-center gap-2">
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={analysis.mode === 'claude'
              ? { background: '#f0faf4', color: '#1b8a5f' }
              : { background: '#f0f0ff', color: '#6366f1' }}>
            {analysis.mode === 'claude' ? '✦ Powered by Claude AI' : '◈ Demo mode — connect API key for live Claude reasoning'}
          </span>
        </div>
      )}

      {/* Empty or results */}
      {recs.length === 0 ? (
        <EmptyState onRun={runAnalysis} running={running} />
      ) : (
        <>
          <FilterTabs recs={recs} active={filter} onChange={setFilter} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(rec => (
              <RecCard key={rec.id} rec={rec} onAction={handleAction} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

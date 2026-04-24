'use client';
import { useState, useEffect } from 'react';
import { authFetch } from '../../lib/api';

const CAD = n =>
  n == null ? '—' : `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Countdown timer ──────────────────────────────────────────────────────────

function Countdown({ cutoffDate, isPastCutoff }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    function tick() {
      const diff = new Date(cutoffDate) - Date.now();
      if (isPastCutoff || diff <= 0) { setLabel('Cut-off passed'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(`${h}h ${m}m until cut-off`);
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [cutoffDate, isPastCutoff]);
  return <span>{label}</span>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const styles = {
    critical: { background: 'rgba(255,59,48,0.12)', color: '#ff3b30' },
    order:    { background: 'rgba(255,159,10,0.12)', color: '#ff9f0a' },
    ok:       { background: 'rgba(52,199,89,0.12)',  color: '#34c759' },
  };
  const labels = { critical: 'Critical', order: 'Order', ok: 'OK' };
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={styles[status] || styles.ok}>
      {labels[status] || status}
    </span>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ItemRow({ item, qty, onQty }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13px] font-medium text-white truncate">{item.product.name}</span>
          <StatusBadge status={item.status} />
        </div>
        <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: '#636366' }}>
          <span>Stock: <b style={{ color: item.currentStock === 0 ? '#ff3b30' : '#aeaeb2' }}>{item.currentStock}</b></span>
          <span>Min: {item.minQuantity}</span>
          <span>Sold/day: {item.dailyRate}</span>
          {item.daysLeft !== null && (
            <span style={{ color: item.daysLeft < 3 ? '#ff3b30' : '#aeaeb2' }}>
              Days left: {item.daysLeft}
            </span>
          )}
          {item.expiryDate && (() => {
            const days = Math.ceil((new Date(item.expiryDate) - Date.now()) / 86400000);
            const color = days <= 0 ? '#ff3b30' : days <= 2 ? '#ff3b30' : days <= 5 ? '#ff9f0a' : '#636366';
            const label = days <= 0 ? 'EXPIRED' : `Exp ${days}d`;
            return <span style={{ color, fontWeight: days <= 5 ? 600 : 400 }}>{label}</span>;
          })()}
          <span style={{ color: '#636366' }}>{item.product.category}</span>
        </div>
      </div>

      {/* Cost estimate */}
      <div className="text-right shrink-0 w-20 hidden md:block">
        <p className="text-[11px]" style={{ color: '#636366' }}>Unit cost</p>
        <p className="text-[13px]" style={{ color: '#aeaeb2' }}>{CAD(item.estCostUnit)}</p>
      </div>

      {/* Qty input */}
      <div className="shrink-0 flex flex-col items-center gap-0.5">
        <p className="text-[10px]" style={{ color: '#636366' }}>Qty</p>
        <input
          type="number"
          min="0"
          step="1"
          value={qty}
          onChange={e => onQty(item.invId, Math.max(0, parseInt(e.target.value) || 0))}
          className="w-16 text-center text-[13px] font-semibold rounded-lg px-2 py-1.5 outline-none"
          style={{ background: '#2c2c2e', color: '#ffffff', border: '1px solid rgba(255,255,255,0.08)' }}
        />
      </div>

      {/* Line cost */}
      <div className="text-right shrink-0 w-20">
        <p className="text-[11px]" style={{ color: '#636366' }}>Line</p>
        <p className="text-[13px] font-semibold" style={{ color: '#ffffff' }}>
          {CAD(qty * item.estCostUnit)}
        </p>
      </div>
    </div>
  );
}

// ─── PO Modal ─────────────────────────────────────────────────────────────────

function POModal({ po, onClose }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(po.emailBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-2xl rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: '#1c1c1e', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white font-semibold text-[15px]">Purchase Order Generated</p>
            <p className="text-[12px] mt-0.5" style={{ color: '#636366' }}>
              {po.id} · {CAD(po.totalCost)} total
            </p>
          </div>
          <button onClick={onClose}
            className="text-[#8e8e93] hover:text-white transition-colors text-[20px] leading-none shrink-0">
            ×
          </button>
        </div>

        {/* Email preview */}
        <div className="flex-1 overflow-auto rounded-xl p-4 font-mono text-[12px] leading-relaxed"
          style={{ background: '#000000', color: '#34c759', whiteSpace: 'pre-wrap', minHeight: '200px' }}>
          {po.emailBody}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={copy}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
            style={{ background: copied ? 'rgba(52,199,89,0.2)' : 'rgba(255,255,255,0.08)', color: copied ? '#34c759' : '#ffffff' }}>
            {copied ? 'Copied!' : 'Copy Email'}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-colors"
            style={{ background: '#2c2c2e', color: '#8e8e93' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, color, items, quantities, onQty, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items.length) return null;
  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ background: '#1c1c1e' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-[13px] font-semibold text-white">{title}</span>
          <span className="text-[12px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#8e8e93' }}>
            {items.length}
          </span>
        </div>
        <span style={{ color: '#636366' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-2">
          {items.map(item => (
            <ItemRow
              key={item.invId}
              item={item}
              qty={quantities[item.invId] ?? item.suggestedQty}
              onQty={onQty}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RestockPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [approving, setApproving] = useState(false);
  const [po, setPo] = useState(null);

  useEffect(() => {
    authFetch('/api/order-basket')
      .then(r => r.json())
      .then(d => {
        setData(d);
        const init = {};
        [...(d.critical || []), ...(d.order || [])].forEach(item => {
          init[item.invId] = item.suggestedQty;
        });
        setQuantities(init);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  function handleQty(invId, val) {
    setQuantities(q => ({ ...q, [invId]: val }));
  }

  const orderItems = data ? [...data.critical, ...data.order] : [];
  const totalCost = orderItems.reduce((s, item) => {
    const q = quantities[item.invId] ?? item.suggestedQty;
    return s + q * item.estCostUnit;
  }, 0);

  async function approve() {
    setApproving(true);
    try {
      const items = orderItems
        .filter(item => (quantities[item.invId] ?? item.suggestedQty) > 0)
        .map(item => ({ ...item, suggestedQty: quantities[item.invId] ?? item.suggestedQty }));
      const res = await authFetch('/api/order-basket/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, schedule: data?.schedule }),
      });
      const result = await res.json();
      setPo(result);
    } finally {
      setApproving(false);
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={{ color: '#636366' }}>
      Loading order basket…
    </div>
  );

  if (error) return (
    <div className="flex-1 flex items-center justify-center" style={{ color: '#ff3b30' }}>
      Error: {error}
    </div>
  );

  const { schedule, summary } = data;
  const next = schedule?.next;

  return (
    <div className="flex-1 overflow-auto p-6" style={{ background: '#000000' }}>
      {po && <POModal po={po} onClose={() => setPo(null)} />}

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-white leading-tight">Weekly Order Basket</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#636366' }}>
          KeHE Montréal — delivery-aware restocking for KaleMart24
        </p>
      </div>

      {/* Delivery schedule strip */}
      {next && (
        <div className="rounded-2xl p-5 mb-6 flex flex-wrap gap-6"
          style={{ background: '#1c1c1e' }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: '#636366' }}>Next Delivery</p>
            <p className="text-[20px] font-bold text-white">
              {next.name} · {new Date(next.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: '#8e8e93' }}>
              {next.daysAway} day{next.daysAway !== 1 ? 's' : ''} away
            </p>
          </div>

          <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: '#636366' }}>Order Cut-off</p>
            <p className="text-[20px] font-bold"
              style={{ color: next.isPastCutoff ? '#ff3b30' : next.hoursToCutoff < 6 ? '#ff9f0a' : '#34c759' }}>
              <Countdown cutoffDate={next.cutoffDate} isPastCutoff={next.isPastCutoff} />
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: '#8e8e93' }}>
              {new Date(next.cutoffDate).toLocaleString('en-CA', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>

          <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: '#636366' }}>After-Next</p>
            <p className="text-[20px] font-bold text-white">
              {schedule.afterNext.name} · {new Date(schedule.afterNext.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: '#8e8e93' }}>
              Stocking target: {schedule.stockTargetDays}d
            </p>
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Critical', value: summary.critical, color: '#ff3b30' },
          { label: 'To Order', value: summary.order,    color: '#ff9f0a' },
          { label: 'Sufficient', value: summary.sufficient, color: '#34c759' },
          { label: 'Est. PO Cost', value: CAD(totalCost), color: '#0071e3' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: '#1c1c1e' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: '#636366' }}>{label}</p>
            <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Item sections */}
      <Section
        title="Critical — Won't Survive to Next Delivery"
        color="#ff3b30"
        items={data.critical}
        quantities={quantities}
        onQty={handleQty}
        defaultOpen={true}
      />
      <Section
        title="Order — Running Low Before After-Next"
        color="#ff9f0a"
        items={data.order}
        quantities={quantities}
        onQty={handleQty}
        defaultOpen={true}
      />
      <Section
        title="Sufficient Stock"
        color="#34c759"
        items={data.sufficient}
        quantities={quantities}
        onQty={handleQty}
        defaultOpen={false}
      />

      {/* Footer */}
      {orderItems.length > 0 && (
        <div className="sticky bottom-0 -mx-6 px-6 py-4 flex items-center justify-between gap-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-[11px]" style={{ color: '#636366' }}>
              {orderItems.filter(i => (quantities[i.invId] ?? i.suggestedQty) > 0).length} SKUs · estimated cost
            </p>
            <p className="text-[22px] font-bold text-white">{CAD(totalCost)}</p>
          </div>
          <button
            onClick={approve}
            disabled={approving || totalCost === 0}
            className="px-6 py-3 rounded-xl text-[14px] font-semibold transition-all"
            style={{
              background: approving ? 'rgba(0,113,227,0.5)' : '#0071e3',
              color: '#ffffff',
              opacity: totalCost === 0 ? 0.4 : 1,
              cursor: totalCost === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {approving ? 'Generating…' : 'Approve & Generate PO'}
          </button>
        </div>
      )}
    </div>
  );
}

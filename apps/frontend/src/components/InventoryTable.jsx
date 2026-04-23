'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, api } from '../lib/api';

function StatusPill({ qty, min }) {
  if (qty === 0) return (
    <span style={{ background: 'var(--red-dim)', color: 'var(--critical)', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
      Out
    </span>
  );
  if (qty < min) return (
    <span style={{ background: 'var(--amber-dim)', color: 'var(--amber)', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
      Low
    </span>
  );
  return (
    <span style={{ background: 'var(--brand-dim)', color: 'var(--brand)', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
      OK
    </span>
  );
}

function ExpiryBadge({ expiryDate }) {
  if (!expiryDate) return <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>;
  const days = Math.ceil((new Date(expiryDate) - Date.now()) / 86400000);
  const label = days <= 0 ? 'Expired' : days === 1 ? '1d' : `${days}d`;
  const color = days <= 0 ? 'var(--critical)' : days <= 2 ? 'var(--critical)' : days <= 5 ? 'var(--amber)' : 'var(--text-3)';
  const bg    = days <= 0 ? 'var(--red-dim)' : days <= 2 ? 'var(--red-dim)' : days <= 5 ? 'var(--amber-dim)' : 'transparent';
  return (
    <span style={{
      color, background: bg,
      fontSize: 11, fontWeight: days <= 5 ? 600 : 400,
      padding: days <= 5 ? '2px 8px' : '0',
      borderRadius: 99,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.04em',
    }}>{label}</span>
  );
}

const TH = ({ children }) => (
  <th style={{
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 10,
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-3)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    background: 'var(--surface-2)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  }}>{children}</th>
);

export default function InventoryTable() {
  const { data, isLoading, mutate } = useSWR('/api/inventory', fetcher, { refreshInterval: 15000 });
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);

  async function handleAdjust(id, delta) {
    setUpdating(id);
    try {
      await api.updateQuantity(id, delta, 'manual-adjustment');
      mutate();
    } finally {
      setUpdating(null);
    }
  }

  const rows = (Array.isArray(data) ? data : []).filter(item =>
    !search || item.product?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 320 }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-3)' }}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '9px 14px 9px 36px',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            color: 'var(--text)',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--brand)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Product', 'SKU', 'Category', 'Location', 'Qty', 'Min', 'Expiry', 'Status', ''].map(h => (
                <TH key={h}>{h}</TH>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  Loading…
                </td>
              </tr>
            )}
            {rows.map((item, idx) => {
              const isExpired = item.expiryDate && item.quantity > 0 && new Date(item.expiryDate) < new Date();
              return (
                <tr
                  key={item.id}
                  style={{
                    borderTop: '1px solid var(--border)',
                    background: isExpired ? 'rgba(217,91,71,0.04)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => !isExpired && (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => e.currentTarget.style.background = isExpired ? 'rgba(217,91,71,0.04)' : 'transparent'}
                >
                  <td style={{ padding: '11px 16px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>
                    {item.product?.name ?? item.productId}
                  </td>
                  <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.04em' }}>
                    {item.product?.sku}
                  </td>
                  <td style={{ padding: '11px 16px', color: 'var(--text-2)', fontSize: 12, textTransform: 'capitalize' }}>
                    {item.product?.category}
                  </td>
                  <td style={{ padding: '11px 16px', color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {item.location}
                  </td>
                  <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 16, color: item.quantity === 0 ? 'var(--critical)' : 'var(--text)' }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-3)' }}>
                    {item.minQuantity}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <ExpiryBadge expiryDate={item.expiryDate} />
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <StatusPill qty={item.quantity} min={item.minQuantity} />
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => handleAdjust(item.id, -1)}
                        disabled={updating === item.id || item.quantity === 0}
                        style={{
                          width: 28, height: 28,
                          borderRadius: 8,
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-2)',
                          fontSize: 16,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.12s',
                          opacity: (updating === item.id || item.quantity === 0) ? 0.3 : 1,
                        }}
                      >−</button>
                      <button
                        onClick={() => handleAdjust(item.id, 1)}
                        disabled={updating === item.id}
                        style={{
                          width: 28, height: 28,
                          borderRadius: 8,
                          background: 'var(--brand)',
                          border: 'none',
                          color: '#0c1510',
                          fontSize: 16,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.12s',
                          opacity: updating === item.id ? 0.4 : 1,
                        }}
                      >+</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

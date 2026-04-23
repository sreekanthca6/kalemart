'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher } from '../lib/api';
import LowStockAlert from '../components/LowStockAlert';
import OrdersFeed from '../components/OrdersFeed';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accentColor, icon, delay = 0 }) {
  return (
    <div
      className="animate-fade-up"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '20px 22px',
        animationDelay: `${delay}ms`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent glow top-right */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 80, height: 80,
        background: `radial-gradient(circle at 100% 0%, ${accentColor}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          color: 'var(--text-3)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>{label}</p>
        <span style={{ fontSize: 16, opacity: 0.5 }}>{icon}</span>
      </div>

      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 38,
        fontWeight: 600,
        color: accentColor,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>{value}</p>

      {sub && (
        <p style={{
          marginTop: 8,
          fontSize: 11,
          fontFamily: 'var(--font-body)',
          color: 'var(--text-3)',
        }}>{sub}</p>
      )}
    </div>
  );
}

// ─── Stock chart ──────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--s3)',
      border: '1px solid var(--border-mid)',
      borderRadius: 10,
      padding: '8px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
    }}>
      <p style={{ color: 'var(--text-2)', marginBottom: 2 }}>{label}</p>
      <p style={{ color: 'var(--brand)', fontWeight: 600 }}>{payload[0].value} units</p>
    </div>
  );
}

function StockChart({ data }) {
  if (!data?.length) return null;
  const chartData = data.slice(0, 12).map(item => ({
    name: item.product?.name?.split(' ')[0] ?? item.productId,
    qty: item.quantity,
    min: item.minQuantity,
  }));
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}
          axisLine={false} tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(126,200,122,0.04)', radius: 6 }} />
        <Bar dataKey="qty" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.qty === 0 ? '#d95b47' : entry.qty < entry.min ? '#d4903d' : '#7ec87a'}
              opacity={entry.qty === 0 ? 0.7 : 0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState('');
  const [d, setD] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      setT(now.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }));
      setD(now.toLocaleDateString('en-CA', { weekday: 'long', day: 'numeric', month: 'long' }));
    }
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 28,
        fontWeight: 500,
        color: 'var(--brand)',
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>{t}</p>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        color: 'var(--text-3)',
        marginTop: 4,
        letterSpacing: '0.03em',
      }}>{d}</p>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 500,
        color: 'var(--text-3)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>{title}</p>
      {right}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: inventory } = useSWR('/api/inventory', fetcher, { refreshInterval: 15000 });
  const { data: orders }    = useSWR('/api/orders',    fetcher, { refreshInterval: 10000 });

  const total      = inventory?.length ?? 0;
  const lowStock   = inventory?.filter(i => i.quantity > 0 && i.quantity < i.minQuantity).length ?? 0;
  const outOfStock = inventory?.filter(i => i.quantity === 0).length ?? 0;
  const expired    = inventory?.filter(i => i.expiryDate && i.quantity > 0 && new Date(i.expiryDate) < new Date()).length ?? 0;
  const todayOrders = Array.isArray(orders)
    ? orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString()).length
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div className="animate-fade-up" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--text-3)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>KaleMart24 · 1170 Rue de Bleury</p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 42,
            fontWeight: 400,
            fontStyle: 'italic',
            color: 'var(--text)',
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}>{greeting()}</h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--text-2)',
            marginTop: 6,
          }}>Here's what's happening at your store today.</p>
        </div>
        <LiveClock />
      </div>

      {/* Expired banner */}
      {expired > 0 && (
        <div className="animate-fade-up" style={{
          background: 'var(--red-dim)',
          border: '1px solid rgba(217,91,71,0.25)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          animationDelay: '50ms',
        }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: '#d95b47',
            fontWeight: 600,
          }}>{expired} item{expired > 1 ? 's' : ''} expired — remove from shelf immediately.</p>
          <a href="/supervisor" style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: '#d95b47',
            textDecoration: 'none',
            letterSpacing: '0.06em',
            opacity: 0.8,
          }}>→ VIEW IN SUPERVISOR</a>
        </div>
      )}

      {/* KPI grid */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard label="Total SKUs"     value={total}       sub="in catalogue"    accentColor="var(--brand)"    icon="▦"  delay={0}   />
        <KpiCard label="Low Stock"      value={lowStock}    sub="below minimum"   accentColor="var(--amber)"    icon="⚠"  delay={60}  />
        <KpiCard label="Out of Stock"   value={outOfStock}  sub="needs reorder"   accentColor="var(--critical)" icon="✕"  delay={120} />
        <KpiCard label="Today's Orders" value={todayOrders} sub="completed today" accentColor="var(--info)"     icon="↗"  delay={180} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>

        {/* Stock chart */}
        <div className="card animate-fade-up" style={{ padding: '22px 24px', animationDelay: '100ms' }}>
          <SectionHeader
            title="Stock Levels"
            right={
              <div style={{ display: 'flex', gap: 14 }}>
                {[['var(--brand)', 'Good'], ['var(--amber)', 'Low'], ['var(--critical)', 'Out']].map(([c, l]) => (
                  <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: c, display: 'inline-block' }} />
                    {l}
                  </span>
                ))}
              </div>
            }
          />
          <StockChart data={inventory} />
        </div>

        {/* Stock alerts */}
        <div className="card animate-fade-up" style={{ padding: '22px 24px', animationDelay: '140ms', overflow: 'hidden' }}>
          <SectionHeader title="Alerts" />
          <LowStockAlert />
        </div>
      </div>

      {/* Orders */}
      <div className="card animate-fade-up" style={{ padding: '22px 24px', animationDelay: '180ms' }}>
        <SectionHeader title="Recent Orders" />
        <OrdersFeed limit={5} />
      </div>

    </div>
  );
}

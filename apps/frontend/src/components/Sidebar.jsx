'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '../lib/api';

const icons = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <rect x="2" y="2" width="7" height="7" rx="1.5"/>
      <rect x="11" y="2" width="7" height="7" rx="1.5"/>
      <rect x="2" y="11" width="7" height="7" rx="1.5"/>
      <rect x="11" y="11" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  inventory: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M10 2L18 6v8l-8 4L2 14V6l8-4z"/>
      <path d="M10 10l8-4M10 10L2 6M10 10v8"/>
    </svg>
  ),
  products: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M10.5 2.5H5.5A1.5 1.5 0 004 4v5l7 7a2 2 0 002.83 0l3.5-3.5a2 2 0 000-2.83L10.5 2.5z"/>
      <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="w-4 h-4">
      <rect x="3.5" y="2" width="13" height="16" rx="2"/>
      <path d="M7 7h6M7 10.5h6M7 14h4"/>
    </svg>
  ),
  restock: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 5h14M3 5l2.5-2.5M3 5l2.5 2.5"/>
      <rect x="5" y="8" width="10" height="9" rx="1.5"/>
      <path d="M8 12.5h4M10 10.5v4"/>
    </svg>
  ),
  finance: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M10 2v16M13.5 4.5H8A2.5 2.5 0 005.5 7 2.5 2.5 0 008 9.5h4A2.5 2.5 0 0114.5 12 2.5 2.5 0 0112 14.5H5.5"/>
    </svg>
  ),
  bookkeeping: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="3" y="2" width="14" height="16" rx="2"/>
      <path d="M7 6h6M7 9.5h6M7 13h4"/>
      <path d="M13 13l1.5 1.5L17 12" strokeWidth="1.4"/>
    </svg>
  ),
  tax: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M4 4h12v3H4zM4 9h5v7H4zM11 9h5v3h-5zM11 14h5v2h-5z"/>
    </svg>
  ),
  supervisor: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="10" cy="10" r="8"/>
      <path d="M7 10l2 2 4-4"/>
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 1.5l2 6h6.5l-5.3 3.8 2 6.2L10 13.7l-5.2 3.8 2-6.2L1.5 7.5H8l2-6z"/>
    </svg>
  ),
  setup: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="10" cy="10" r="2.5"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"/>
    </svg>
  ),
  ops: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 11h3l2-6 4 12 2-6h3"/>
      <path d="M3 17h14"/>
    </svg>
  ),
};

const nav = [
  { href: '/',           label: 'Dashboard',  icon: 'dashboard'  },
  { href: '/inventory',  label: 'Inventory',  icon: 'inventory'  },
  { href: '/products',   label: 'Products',   icon: 'products'   },
  { href: '/orders',     label: 'Orders',     icon: 'orders',    divider: true },
  { href: '/restock',    label: 'Restock',    icon: 'restock'    },
  { href: '/finance',     label: 'Financials',  icon: 'finance'                },
  { href: '/bookkeeping', label: 'Bookkeeping', icon: 'bookkeeping'            },
  { href: '/tax',         label: 'Tax Filing',  icon: 'tax',       divider: true },
  { href: '/supervisor', label: 'Supervisor', icon: 'supervisor', ai: true },
  { href: '/ai',         label: 'AI Insights',icon: 'ai',        divider: true },
  { href: '/ops',        label: 'Ops',        icon: 'ops'        },
  { href: '/setup',      label: 'Setup',      icon: 'setup'      },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 228,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#1c1c1e',
      borderRight: '1px solid rgba(255,255,255,0.06)',
    }}>

      {/* Brand */}
      <div style={{ padding: '28px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 34, height: 34,
            borderRadius: 10,
            background: 'var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 18,
              color: '#0c1510',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>K</span>
          </div>
          <div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 17,
              color: '#ffffff',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
            }}>KaleMart24</p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: '#636366',
              marginTop: 2,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>Rue de Bleury</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {nav.map(({ href, label, icon, divider, ai }) => {
          const active = pathname === href;
          return (
            <div key={href}>
              <Link
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'var(--font-body)',
                  color: active ? 'var(--brand)' : ai ? 'var(--brand)' : '#8e8e93',
                  background: active ? 'var(--brand-dim)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = ai ? 'var(--brand)' : '#8e8e93';
                  }
                }}
              >
                {/* Active indicator bar */}
                {active && (
                  <span style={{
                    position: 'absolute',
                    left: 0, top: '20%', bottom: '20%',
                    width: 3, borderRadius: 99,
                    background: 'var(--brand)',
                  }} />
                )}
                <span style={{ opacity: active ? 1 : 0.7 }}>{icons[icon]}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {ai && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    padding: '2px 6px',
                    borderRadius: 99,
                    background: 'var(--brand-dim)',
                    color: 'var(--brand)',
                    fontFamily: 'var(--font-mono)',
                  }}>AI</span>
                )}
              </Link>
              {divider && (
                <div style={{
                  margin: '8px 12px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 10px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => auth.logout()}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            color: '#636366',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,48,0.1)'; e.currentTarget.style.color = '#ff3b30'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#636366'; }}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, opacity: 0.7 }}>
            <path d="M13 3h4v14h-4M9 14l4-4-4-4M13 10H3"/>
          </svg>
          Sign Out
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px 0' }}>
          <span style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: 'var(--brand)',
            display: 'inline-block',
            animation: 'pulse-dot 2.5s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: '#636366',
            letterSpacing: '0.04em',
          }}>live · local</span>
        </div>
      </div>
    </aside>
  );
}

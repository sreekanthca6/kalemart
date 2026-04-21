'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const nav = [
  { href: '/',           label: 'Dashboard',  icon: '▦' },
  { href: '/inventory',  label: 'Inventory',  icon: '📦' },
  { href: '/products',   label: 'Products',   icon: '🏷️' },
  { href: '/orders',     label: 'Orders',     icon: '🧾' },
  { href: '/ai',         label: 'AI Insights',icon: '✦' },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 bg-slate-900 text-slate-100 flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-slate-700">
        <span className="text-xl font-bold tracking-tight text-white">kalemart</span>
        <p className="text-xs text-slate-400 mt-0.5">Inventory Management</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-brand text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <span className="text-base w-5 text-center">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-slate-700 text-xs text-slate-500">
        v0.0.1 · local
      </div>
    </aside>
  );
}

'use client';
import useSWR from 'swr';
import { fetcher } from '../lib/api';

export default function OrdersFeed({ limit = 10 }) {
  const { data, isLoading } = useSWR('/api/orders', fetcher, { refreshInterval: 10000 });
  const orders = Array.isArray(data) ? data.slice(-limit).reverse() : [];

  if (isLoading) return (
    <div className="space-y-2">
      {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-[#f5f5f7] animate-pulse" />)}
    </div>
  );

  if (!orders.length) return (
    <p className="text-[13px] text-[#8e8e93] py-4">No orders yet.</p>
  );

  return (
    <ul className="space-y-2">
      {orders.map(order => (
        <li key={order.id}
          className="flex items-center justify-between rounded-xl px-4 py-3 transition-all hover:bg-[#f5f5f7]"
          style={{ background: '#fafafa' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: '#1b8a5f' }}>
              #
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#1d1d1f] font-mono">
                {order.id.split('-')[0].toUpperCase()}
              </p>
              <p className="text-[11px] text-[#8e8e93]">
                {new Date(order.createdAt).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                {' · '}{order.items.length} item{order.items.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold text-[#1d1d1f]">${order.total.toFixed(2)}</p>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: '#f0faf4', color: '#1b8a5f' }}>
              {order.status}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

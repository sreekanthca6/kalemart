'use client';
import useSWR from 'swr';
import { fetcher } from '../lib/api';

export default function OrdersFeed({ limit = 10 }) {
  const { data, isLoading } = useSWR('/api/orders', fetcher, { refreshInterval: 10000 });
  const orders = (data || []).slice(-limit).reverse();

  if (isLoading) return <p className="text-sm text-gray-400 animate-pulse">Loading orders…</p>;
  if (!orders.length) return <p className="text-sm text-gray-400">No orders yet.</p>;

  return (
    <ul className="space-y-2">
      {orders.map(order => (
        <li key={order.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-medium text-gray-800">
              #{order.id.split('-')[0].toUpperCase()}
            </p>
            <p className="text-xs text-gray-400">
              {new Date(order.createdAt).toLocaleString()} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">£{order.total.toFixed(2)}</p>
            <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-0.5 font-medium capitalize">
              {order.status}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

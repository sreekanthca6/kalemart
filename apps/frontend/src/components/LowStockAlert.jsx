'use client';
import useSWR from 'swr';
import { fetcher } from '../lib/api';

export default function LowStockAlert() {
  const { data, isLoading } = useSWR('/api/inventory/low-stock', fetcher, { refreshInterval: 30000 });

  if (isLoading) return <p className="text-sm text-gray-400 animate-pulse">Loading alerts…</p>;
  if (!data?.length) return (
    <div className="text-sm text-green-600 font-medium flex items-center gap-2">
      <span>✓</span> All stock levels healthy
    </div>
  );

  return (
    <ul className="space-y-2">
      {data.map(item => (
        <li key={item.id} className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5">
          <div>
            <p className="text-sm font-medium text-amber-900">{item.product?.name ?? item.productId}</p>
            <p className="text-xs text-amber-600">{item.location}</p>
          </div>
          <div className="text-right">
            <span className={`text-sm font-bold ${item.quantity === 0 ? 'text-red-600' : 'text-amber-700'}`}>
              {item.quantity === 0 ? 'OUT OF STOCK' : `${item.quantity} left`}
            </span>
            <p className="text-xs text-amber-500">min: {item.minQuantity}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

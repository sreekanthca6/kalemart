'use client';
import useSWR from 'swr';
import { fetcher } from '../lib/api';

export default function LowStockAlert() {
  const { data, isLoading } = useSWR('/api/inventory/low-stock', fetcher, { refreshInterval: 30000 });

  if (isLoading) return (
    <div className="space-y-2">
      {[1,2,3].map(i => (
        <div key={i} className="h-12 rounded-xl bg-[#f5f5f7] animate-pulse" />
      ))}
    </div>
  );

  if (!data?.length) return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: '#f0faf4' }}>
      <span className="text-brand-light text-lg">✓</span>
      <p className="text-[13px] font-medium text-brand-dark">All stock levels healthy</p>
    </div>
  );

  return (
    <ul className="space-y-2">
      {data.map(item => {
        const isOut = item.quantity === 0;
        return (
          <li key={item.id} className="flex items-center justify-between rounded-xl px-4 py-3 transition-all"
            style={{ background: isOut ? '#fff0ef' : '#fff8ee' }}>
            <div className="min-w-0 mr-3">
              <p className="text-[13px] font-medium truncate" style={{ color: isOut ? '#c0392b' : '#92400e' }}>
                {item.product?.name ?? item.productId}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: isOut ? '#e57373' : '#b45309' }}>
                {item.location}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[13px] font-bold" style={{ color: isOut ? '#ff3b30' : '#ff9f0a' }}>
                {isOut ? 'OUT' : `${item.quantity} left`}
              </p>
              <p className="text-[11px]" style={{ color: '#aeaeb2' }}>min {item.minQuantity}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

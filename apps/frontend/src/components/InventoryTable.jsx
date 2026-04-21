'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, api } from '../lib/api';
import clsx from 'clsx';

function stockBadge(qty, min) {
  if (qty === 0)    return 'bg-red-100 text-red-700';
  if (qty < min)    return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

function stockLabel(qty, min) {
  if (qty === 0)    return 'Out of stock';
  if (qty < min)    return 'Low stock';
  return 'In stock';
}

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

  const rows = (data || []).filter(item =>
    !search || item.product?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <input
        type="search"
        placeholder="Search products…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Product', 'SKU', 'Category', 'Location', 'Qty', 'Min', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            )}
            {rows.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {item.product?.name ?? item.productId}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.product?.sku}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{item.product?.category}</td>
                <td className="px-4 py-3 text-gray-500">{item.location}</td>
                <td className="px-4 py-3 font-bold text-gray-800">{item.quantity}</td>
                <td className="px-4 py-3 text-gray-400">{item.minQuantity}</td>
                <td className="px-4 py-3">
                  <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', stockBadge(item.quantity, item.minQuantity))}>
                    {stockLabel(item.quantity, item.minQuantity)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAdjust(item.id, -1)}
                      disabled={updating === item.id || item.quantity === 0}
                      className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold disabled:opacity-40 transition"
                    >−</button>
                    <button
                      onClick={() => handleAdjust(item.id, 1)}
                      disabled={updating === item.id}
                      className="w-7 h-7 rounded bg-brand text-white hover:bg-brand-dark font-bold disabled:opacity-40 transition"
                    >+</button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No items found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

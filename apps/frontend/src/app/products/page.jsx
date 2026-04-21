'use client';
import useSWR from 'swr';
import { fetcher } from '../../lib/api';

export default function ProductsPage() {
  const { data, isLoading } = useSWR('/api/products', fetcher);
  const byCategory = (data || []).reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="text-sm text-gray-500 mt-0.5">Master product catalogue</p>
      </div>

      {isLoading && <p className="text-sm text-gray-400 animate-pulse">Loading products…</p>}

      {Object.entries(byCategory).map(([category, products]) => (
        <div key={category}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 capitalize">{category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map(p => (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition">
                <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{p.sku}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">{p.category}</span>
                  <span className="text-sm font-bold text-gray-800">£{Number(p.price).toFixed(2)}</span>
                </div>
                {p.barcode && <p className="text-xs text-gray-300 font-mono mt-2">{p.barcode}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

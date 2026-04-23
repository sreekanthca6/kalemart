'use client';
import useSWR from 'swr';
import { fetcher } from '../../lib/api';

const categoryLabels = {
  beverages:       'Beverages',
  'hot-drinks':    'Hot Drinks & Matcha',
  snacks:          'Snacks',
  chilled:         'Chilled',
  fresh:           'Fresh Produce',
  health:          'Health & Wellness',
  'grab-n-go':     'Grab & Go',
  'personal-care': 'Personal Care',
  household:       'Household',
};

export default function ProductsPage() {
  const { data, isLoading } = useSWR('/api/products', fetcher);
  const byCategory = (Array.isArray(data) ? data : []).reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[28px] font-bold tracking-tight text-[#1d1d1f]">Products</h1>
        <p className="text-[14px] text-[#6e6e73] mt-1">Master catalogue — {data?.length ?? '—'} SKUs across {Object.keys(byCategory).length || '—'} categories.</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-white animate-pulse" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} />
          ))}
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(byCategory).map(([category, products]) => (
          <div key={category}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#8e8e93]">
                {categoryLabels[category] || category}
              </h2>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#f5f5f7', color: '#8e8e93' }}>
                {products.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map(p => (
                <div key={p.id}
                  className="rounded-2xl p-4 transition-all duration-200 cursor-default group"
                  style={{ background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.10), 0 0 1px rgba(0,0,0,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)'}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-semibold text-[#1d1d1f] leading-snug">{p.name}</p>
                    {p.organic && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: '#f0faf4', color: '#1b8a5f' }}>
                        organic
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono mt-1.5" style={{ color: '#aeaeb2' }}>{p.sku}</p>
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #f5f5f7' }}>
                    <span className="text-[11px] capitalize" style={{ color: '#8e8e93' }}>{p.category}</span>
                    <span className="text-[15px] font-bold" style={{ color: '#1d1d1f' }}>${Number(p.price).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

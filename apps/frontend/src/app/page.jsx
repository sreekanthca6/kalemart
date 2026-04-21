'use client';
import useSWR from 'swr';
import { fetcher } from '../lib/api';
import StatsCard from '../components/StatsCard';
import LowStockAlert from '../components/LowStockAlert';
import OrdersFeed from '../components/OrdersFeed';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function StockChart({ data }) {
  if (!data?.length) return null;
  const chartData = data.slice(0, 10).map(item => ({
    name: item.product?.name?.split(' ')[0] ?? item.productId,
    qty: item.quantity,
    min: item.minQuantity,
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="qty" name="Stock" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.qty === 0 ? '#ef4444' : entry.qty < entry.min ? '#f59e0b' : '#4F46E5'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Dashboard() {
  const { data: inventory } = useSWR('/api/inventory', fetcher, { refreshInterval: 15000 });
  const { data: orders }    = useSWR('/api/orders', fetcher, { refreshInterval: 10000 });

  const total      = inventory?.length ?? 0;
  const lowStock   = inventory?.filter(i => i.quantity > 0 && i.quantity < i.minQuantity).length ?? 0;
  const outOfStock = inventory?.filter(i => i.quantity === 0).length ?? 0;
  const todayOrders = (orders || []).filter(o => {
    const d = new Date(o.createdAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kalemart Convenience Store — live inventory overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Products"  value={total}      color="indigo" sub="distinct SKUs" />
        <StatsCard label="Low Stock"       value={lowStock}   color="amber"  sub="below minimum" />
        <StatsCard label="Out of Stock"    value={outOfStock} color="red"    sub="needs reorder" />
        <StatsCard label="Today's Orders"  value={todayOrders}color="green"  sub="completed" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock level chart */}
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Stock Levels</h2>
          <StockChart data={inventory} />
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" /> In stock</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" /> Low</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500 inline-block" /> Out</span>
          </div>
        </div>

        {/* Low stock alerts */}
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Stock Alerts</h2>
          <LowStockAlert />
        </div>
      </div>

      {/* Recent orders */}
      <div className="rounded-xl bg-white border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Orders</h2>
        <OrdersFeed limit={5} />
      </div>
    </div>
  );
}

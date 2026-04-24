import OrdersFeed from '../../components/OrdersFeed';

export const metadata = { title: 'Orders · Kalemart' };

export default function OrdersPage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[28px] font-bold tracking-tight text-[#1d1d1f]">Orders</h1>
        <p className="text-[14px] text-[#6e6e73] mt-1">All completed transactions, newest first.</p>
      </div>
      <div className="max-w-2xl rounded-2xl bg-white p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)' }}>
        <OrdersFeed limit={50} />
      </div>
    </div>
  );
}

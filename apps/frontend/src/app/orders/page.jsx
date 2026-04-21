import OrdersFeed from '../../components/OrdersFeed';

export const metadata = { title: 'Orders · Kalemart' };

export default function OrdersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">All completed orders, newest first</p>
      </div>
      <div className="max-w-2xl">
        <OrdersFeed limit={50} />
      </div>
    </div>
  );
}

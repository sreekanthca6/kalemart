import InventoryTable from '../../components/InventoryTable';

export const metadata = { title: 'Inventory · Kalemart' };

export default function InventoryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-sm text-gray-500 mt-0.5">All stock — live quantities, adjustable inline</p>
      </div>
      <InventoryTable />
    </div>
  );
}

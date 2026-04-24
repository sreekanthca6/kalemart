import InventoryTable from '../../components/InventoryTable';

export const metadata = { title: 'Inventory · KaleMart24' };

export default function InventoryPage() {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--text-3)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>Stock Management</p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 38,
          fontWeight: 400,
          fontStyle: 'italic',
          color: 'var(--text)',
          lineHeight: 1,
        }}>Inventory</h1>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--text-2)',
          marginTop: 6,
        }}>Live quantities across all SKUs — adjust inline.</p>
      </div>
      <InventoryTable />
    </div>
  );
}

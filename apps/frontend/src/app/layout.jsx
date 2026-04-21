import './globals.css';
import Sidebar from '../components/Sidebar';

export const metadata = { title: 'Kalemart', description: 'Inventory Management System' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}

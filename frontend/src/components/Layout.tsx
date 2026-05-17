import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#07090f' }}>
      {/* Desktop sidebar (hidden on mobile) */}
      <div className="hidden sm:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 sm:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}

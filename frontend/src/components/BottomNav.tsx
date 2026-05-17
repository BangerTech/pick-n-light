import { NavLink } from 'react-router-dom';
import { LayoutGrid, Search, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutGrid, label: 'Magazine' },
  { to: '/search', icon: Search, label: 'Suche' },
  { to: '/settings', icon: Settings, label: 'Einstellungen' },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 sm:hidden pb-safe"
      style={{
        background: 'rgba(7,9,15,0.97)',
        borderTop: '1px solid rgba(99,102,241,0.15)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl transition-all',
                isActive ? 'text-accent-light' : 'text-slate-500'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'w-10 h-8 flex items-center justify-center rounded-xl transition-all',
                    isActive ? 'bg-accent-DEFAULT/20' : ''
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

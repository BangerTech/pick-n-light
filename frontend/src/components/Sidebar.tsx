import { NavLink } from 'react-router-dom';
import { LayoutGrid, Search, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutGrid, label: 'Magazine' },
  { to: '/search', icon: Search, label: 'Suche' },
  { to: '/settings', icon: Settings, label: 'Einstellungen' },
];

export default function Sidebar() {
  return (
    <aside
      className="w-16 lg:w-56 flex flex-col h-screen flex-shrink-0"
      style={{
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <img
          src="/logo.png"
          alt="Pick·n·Light"
          className="w-9 h-9 rounded-xl flex-shrink-0 object-cover"
          style={{ boxShadow: '0 0 14px rgba(245,158,11,0.35)' }}
        />
        <div className="hidden lg:block overflow-hidden">
          <p className="text-sm font-bold text-white leading-tight tracking-wide">Pick·n·Light</p>
          <p className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>LED Lager System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                isActive
                  ? 'bg-accent/20 text-accent-light border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'w-5 h-5 flex-shrink-0 transition-all',
                    isActive && 'text-accent-light'
                  )}
                />
                <span className="hidden lg:block text-sm font-medium">{label}</span>
                {isActive && (
                  <div
                    className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: '#818cf8', boxShadow: '0 0 6px #818cf8' }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

    </aside>
  );
}

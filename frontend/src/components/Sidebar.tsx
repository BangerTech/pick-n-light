import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Search, Settings } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutGrid, label: 'Magazine' },
  { to: '/search', icon: Search, label: 'Suche' },
  { to: '/settings', icon: Settings, label: 'Einstellungen' },
];

export default function Sidebar() {
  const { data: mqttStatus } = useQuery({
    queryKey: ['mqtt-status'],
    queryFn: api.wled.status,
    refetchInterval: 8000,
  });

  const isConnected = mqttStatus?.status === 'connected';

  return (
    <aside
      className="w-16 lg:w-56 flex flex-col h-screen flex-shrink-0"
      style={{
        background: 'rgba(7, 9, 15, 0.95)',
        borderRight: '1px solid rgba(99,102,241,0.12)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-white/5">
        <img
          src="/logo.png"
          alt="Pick·n·Light"
          className="w-9 h-9 rounded-xl flex-shrink-0 object-cover"
          style={{ boxShadow: '0 0 14px rgba(245,158,11,0.35)' }}
        />
        <div className="hidden lg:block overflow-hidden">
          <p className="text-sm font-bold text-white leading-tight tracking-wide">Pick·n·Light</p>
          <p className="text-xs text-slate-500 leading-tight">LED Lager System</p>
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
                  ? 'bg-accent-DEFAULT/20 text-accent-light border border-accent-DEFAULT/30'
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

      {/* MQTT Status */}
      <div
        className="mx-2 mb-4 px-3 py-2.5 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              isConnected ? 'bg-emerald-400' : 'bg-slate-600'
            )}
            style={isConnected ? { boxShadow: '0 0 6px rgba(52,211,153,0.8)' } : {}}
          />
          <div className="hidden lg:block overflow-hidden">
            <p className="text-xs font-medium text-slate-300 leading-tight">MQTT Broker</p>
            <p
              className={cn(
                'text-xs leading-tight',
                isConnected ? 'text-emerald-400' : 'text-slate-500'
              )}
            >
              {isConnected ? 'Verbunden' : 'Getrennt'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

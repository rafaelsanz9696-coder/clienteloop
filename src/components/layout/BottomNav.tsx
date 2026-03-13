import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  CalendarDays,
  Menu,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { to: '/app',              icon: LayoutDashboard, label: 'Inicio',    end: true },
  { to: '/app/inbox',        icon: MessageSquare,   label: 'Inbox',     end: false },
  { to: '/app/contacts',     icon: Users,           label: 'Contactos', end: false },
  { to: '/app/appointments', icon: CalendarDays,    label: 'Citas',     end: false },
];

interface BottomNavProps {
  onMenuClick: () => void;
}

/**
 * Mobile-only bottom navigation bar (hidden on lg+).
 * Shows 4 primary nav items + hamburger for the full sidebar.
 */
export default function BottomNav({ onMenuClick }: BottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-area-inset-bottom">
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('w-5 h-5', isActive && 'stroke-[2.5px]')} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* "More" — opens the sidebar which has all nav items */}
        <button
          onClick={onMenuClick}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span>Más</span>
        </button>
      </div>
    </nav>
  );
}

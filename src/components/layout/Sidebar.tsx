import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Kanban,
  CheckCircle2,
  Settings,
  X,
  ChevronDown,
  Plus,
  Building2,
  LogOut,
  BarChart2,
  CalendarDays,
  Megaphone,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useBusiness } from '../../contexts/BusinessContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/inbox', icon: MessageSquare, label: 'Inbox' },
  { to: '/app/contacts', icon: Users, label: 'Contactos' },
  { to: '/app/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/app/tasks', icon: CheckCircle2, label: 'Tareas' },
  { to: '/app/appointments', icon: CalendarDays, label: 'Citas' },
  { to: '/app/broadcast', icon: Megaphone, label: 'Difusión' },
  { to: '/app/reports', icon: BarChart2, label: 'Reportes' },
  { to: '/app/settings', icon: Settings, label: 'Ajustes' },
];

const NICHOS = [
  { value: 'salon',        label: 'Salón de Belleza' },
  { value: 'barberia',     label: 'Barbería' },
  { value: 'clinica',      label: 'Clínica / Consultorio' },
  { value: 'inmobiliaria', label: 'Inmobiliaria' },
  { value: 'restaurante',  label: 'Restaurante' },
  { value: 'academia',     label: 'Academia' },
  { value: 'taller',       label: 'Taller Mecánico' },
  { value: 'courier',      label: 'Courier / Mensajería' },
  { value: 'agencia_ia',   label: 'Agencia de IA' },
];

// ─── NuevoNegocioModal ────────────────────────────────────────────────────────
function NuevoNegocioModal({ onClose }: { onClose: () => void }) {
  const { createBusiness } = useBusiness();
  const [name, setName] = useState('');
  const [nicho, setNicho] = useState('salon');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createBusiness(name.trim(), nicho);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Nuevo Negocio</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Nombre del negocio *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="Ej: Barbería El Navajero"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Nicho / Industria
            </label>
            <select
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {NICHOS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── BusinessSelector ─────────────────────────────────────────────────────────
function BusinessSelector() {
  const { businesses, activeBusiness, switchBusiness } = useBusiness();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="px-3 py-2 border-b border-slate-800">
        {/* Trigger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
        >
          <div className="w-7 h-7 bg-blue-500/20 rounded-md flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-slate-500 leading-none mb-0.5 uppercase tracking-wider">Negocio activo</div>
            <div className="text-sm font-semibold text-white truncate leading-tight">
              {activeBusiness?.name ?? '...'}
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150',
              open && 'rotate-180'
            )}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="mt-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
            {businesses.map((b) => (
              <button
                key={b.id}
                onClick={() => { switchBusiness(b.id); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors',
                  b.id === activeBusiness?.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                )}
              >
                <span className="flex-1 truncate font-medium">{b.name}</span>
                <span className={cn(
                  'text-[10px] shrink-0 capitalize px-1.5 py-0.5 rounded',
                  b.id === activeBusiness?.id ? 'bg-blue-500/50 text-blue-100' : 'bg-slate-700 text-slate-400'
                )}>
                  {b.nicho}
                </span>
              </button>
            ))}
            <button
              onClick={() => { setOpen(false); setShowModal(true); }}
              className="w-full text-left px-3 py-2.5 text-sm text-blue-400 hover:bg-slate-700 flex items-center gap-2 border-t border-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo negocio...</span>
            </button>
          </div>
        )}
      </div>

      {showModal && <NuevoNegocioModal onClose={() => setShowModal(false)} />}
    </>
  );
}

// ─── SidebarFooter ────────────────────────────────────────────────────────────
function SidebarFooter() {
  const { user, signOut } = useAuth();
  const initial = user?.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="p-4 border-t border-slate-800 space-y-2">
      <div className="flex items-center gap-2 px-1">
        {/* Avatar */}
        <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
          {initial}
        </div>
        {/* Email */}
        <span className="text-xs text-slate-400 truncate flex-1">{user?.email}</span>
        {/* Sign-out */}
        <button
          onClick={signOut}
          title="Cerrar sesión"
          className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      <div className="text-xs text-slate-700 px-1">ClienteLoop v1.0</div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { totalUnread } = useSocket();
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-50 flex flex-col transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo — links to landing page */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm">
              CL
            </div>
            <span className="font-bold text-lg tracking-tight">ClienteLoop</span>
          </a>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Business Selector */}
        <BusinessSelector />

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/app'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="flex-1">{label}</span>
              {to === '/app/inbox' && totalUnread > 0 && (
                <span className="bg-blue-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer — user email + sign out */}
        <SidebarFooter />
      </aside>
    </>
  );
}

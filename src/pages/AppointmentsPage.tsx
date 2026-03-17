import { useState, useEffect, useCallback } from 'react';
import { toast } from '../lib/toast';
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2, CalendarDays,
  CheckCircle2, XCircle, Clock, Trash2, Edit2, User, Wrench, Smartphone,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import AppointmentBlock from '../components/appointments/AppointmentBlock';
import type { Appointment, Service, Contact } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const PX_PER_MIN   = 1.2;
const DAY_START_H  = 8;
const DAY_END_H    = 20;
const TOTAL_MINS   = (DAY_END_H - DAY_START_H) * 60; // 720 min
const GRID_HEIGHT  = TOTAL_MINS * PX_PER_MIN;         // 864 px
const HOUR_LABELS  = Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => DAY_START_H + i);
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function startOfWeek(d: Date): Date {
  const day = new Date(d);
  const dow = day.getDay(); // 0=Sun
  day.setDate(day.getDate() - dow + 1); // Monday
  day.setHours(0, 0, 0, 0);
  return day;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

/** Detect overlapping appointments within a list and return a Set of conflicting ids */
function detectConflicts(appts: Appointment[]): Set<number> {
  const ids = new Set<number>();
  for (let i = 0; i < appts.length; i++) {
    for (let j = i + 1; j < appts.length; j++) {
      const a = appts[i], b = appts[j];
      const aStart = new Date(a.start_time).getTime();
      const aEnd   = new Date(a.end_time).getTime();
      const bStart = new Date(b.start_time).getTime();
      const bEnd   = new Date(b.end_time).getTime();
      if (aStart < bEnd && aEnd > bStart) {
        if (a.status !== 'cancelled' && b.status !== 'cancelled') {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
  }
  return ids;
}

/** Group appointments by day key and assign columns for side-by-side rendering */
function groupByDay(appts: Appointment[]): Record<string, { appt: Appointment; col: number; total: number }[]> {
  const groups: Record<string, Appointment[]> = {};
  appts.forEach((a) => {
    const key = toDateStr(new Date(a.start_time));
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });

  const result: Record<string, { appt: Appointment; col: number; total: number }[]> = {};
  Object.entries(groups).forEach(([key, list]) => {
    // Simple greedy column assignment
    const cols: number[] = [];
    const ends: number[] = [];
    const assigned = list.map((a) => {
      const start = new Date(a.start_time).getTime();
      let col = 0;
      for (let c = 0; c < ends.length; c++) {
        if (ends[c] <= start) { col = c; break; }
        col = c + 1;
      }
      if (col >= ends.length) ends.push(0);
      ends[col] = new Date(a.end_time).getTime();
      cols.push(col);
      return col;
    });
    const total = Math.max(...assigned) + 1;
    result[key] = list.map((a, i) => ({ appt: a, col: assigned[i], total }));
  });
  return result;
}

// ─── MONTH VIEW HELPERS ────────────────────────────────────────────────────────

/** Returns 42 Date[] for a 6×7 month grid, always starting on Monday */
function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const dow = first.getDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow; // shift to Monday
  const start = new Date(first);
  start.setDate(first.getDate() + offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Build YYYY-MM-DD → Appointment[] map for O(1) day lookup */
function buildAppointmentsByDate(appts: Appointment[]): Record<string, Appointment[]> {
  return appts.reduce<Record<string, Appointment[]>>((m, a) => {
    const k = toDateStr(new Date(a.start_time));
    (m[k] ??= []).push(a);
    return m;
  }, {});
}

// ─── MONTH VIEW CONSTANTS ──────────────────────────────────────────────────────
const CHIP_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-500 text-white',
  pending:   'bg-amber-400 text-amber-900',
  cancelled: 'bg-slate-300 text-slate-500 line-through',
  completed: 'bg-emerald-500 text-white',
};
const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DAY_HEADERS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

// ─── MONTH GRID COMPONENT ─────────────────────────────────────────────────────
interface MonthGridProps {
  year: number;
  month: number;
  appointmentsByDate: Record<string, Appointment[]>;
  onDayClick: (d: Date) => void;
  onChipClick: (a: Appointment) => void;
}

function MonthGrid({ year, month, appointmentsByDate, onDayClick, onChipClick }: MonthGridProps) {
  const todayStr = toDateStr(new Date());
  const grid = getMonthGrid(year, month);
  const weeks = Array.from({ length: 6 }, (_, i) => grid.slice(i * 7, i * 7 + 7));
  return (
    <div className="flex flex-col h-full">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-white shrink-0">
        {DAY_HEADERS.map((n) => (
          <div key={n} className="py-2 text-center text-[10px] font-semibold uppercase text-slate-400 tracking-wide">
            {n}
          </div>
        ))}
      </div>
      {/* 6-row grid */}
      <div className="grid grid-rows-6 flex-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
            {week.map((date, di) => {
              const key = toDateStr(date);
              const isToday = key === todayStr;
              const isThisMonth = date.getMonth() === month;
              const dayAppts = appointmentsByDate[key] ?? [];
              const visible = dayAppts.slice(0, 3);
              const overflow = dayAppts.length - visible.length;
              return (
                <div
                  key={di}
                  onClick={() => onDayClick(date)}
                  className={cn(
                    'border-r border-slate-100 last:border-r-0 p-1 cursor-pointer hover:bg-slate-50 transition-colors',
                    isToday && 'bg-blue-50/60',
                    !isThisMonth && 'bg-slate-50/40',
                  )}
                >
                  <div className={cn(
                    'text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center mb-0.5',
                    isToday ? 'bg-blue-600 text-white' : isThisMonth ? 'text-slate-700' : 'text-slate-300',
                  )}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {visible.map((a) => (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); onChipClick(a); }}
                        title={a.title}
                        className={cn(
                          'w-full truncate text-[10px] leading-none px-1 py-0.5 rounded cursor-pointer hover:opacity-80',
                          CHIP_COLORS[a.status] ?? CHIP_COLORS.confirmed,
                        )}
                      >
                        {a.contact_name ?? a.title}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div
                        onClick={(e) => { e.stopPropagation(); onDayClick(date); }}
                        className="text-[10px] text-blue-600 font-medium cursor-pointer hover:underline pl-1"
                      >
                        +{overflow} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmada',  cls: 'bg-blue-100 text-blue-700' },
  pending:   { label: 'Pendiente',   cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelada',   cls: 'bg-red-100 text-red-600' },
  completed: { label: 'Completada',  cls: 'bg-emerald-100 text-emerald-700' },
};

// ─── CREATE MODAL ─────────────────────────────────────────────────────────────
interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
  defaultDate?: string;
}
function CreateAppointmentModal({ onClose, onCreated, defaultDate }: CreateModalProps) {
  const { activeBusinessId } = useBusiness();
  const { data: services } = useApi(() => api.getServices(), [activeBusinessId]);
  const { data: contacts } = useApi(() => api.getContacts(), [activeBusinessId]);

  const [title, setTitle]       = useState('');
  const [contactId, setContactId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate]         = useState(defaultDate ?? toDateStr(new Date()));
  const [time, setTime]         = useState('');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes]       = useState('');
  const [slots, setSlots]       = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Auto-fill title from contact + service
  useEffect(() => {
    const c = contacts?.find((x: Contact) => String(x.id) === contactId);
    const s = services?.find((x: Service) => String(x.id) === serviceId);
    if (c && s) setTitle(`${s.name} — ${c.name}`);
    else if (c) setTitle(c.name);
    else if (s) setTitle(s.name);
  }, [contactId, serviceId, contacts, services]);

  // Auto-fill duration from service
  useEffect(() => {
    const s = services?.find((x: Service) => String(x.id) === serviceId);
    if (s) setDuration(s.duration_minutes);
  }, [serviceId, services]);

  // Load available slots when date + duration changes
  useEffect(() => {
    if (!date) return;
    setLoadingSlots(true);
    setTime('');
    api.getAvailableSlots(date, duration)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, duration]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !date || !time) return;
    setSaving(true);
    setError('');
    try {
      await api.createAppointment({
        title,
        contact_id: contactId ? Number(contactId) : undefined,
        service_id: serviceId ? Number(serviceId) : undefined,
        start_time: `${date}T${time}:00`,
        duration_minutes: duration,
        notes,
      } as any);
      onCreated();
      onClose();
    } catch (err: any) {
      if (err.message?.includes('Conflict') || err.message?.includes('409')) {
        setError('⚠️ Conflicto de horario: ese slot ya está ocupado. Elige otro horario.');
      } else {
        setError(err.message ?? 'Error al guardar');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">Nueva Cita</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Contact */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Cliente</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sin cliente —</option>
              {contacts?.map((c: Contact) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Service */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Servicio</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sin servicio —</option>
              {services?.filter((s: Service) => s.active).map((s: Service) => (
                <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Título *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Corte — María"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Fecha *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Duración (min)</label>
              <input
                type="number"
                min={15} max={480} step={15}
                value={duration}
                onChange={(e) => setDuration(Math.min(480, Math.max(15, Number(e.target.value))))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Time slots */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1">
              Hora disponible *
              {loadingSlots && <Loader2 className="w-3 h-3 animate-spin" />}
            </label>
            {slots.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {slots.map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => setTime(s)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors',
                      time === s
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-200 text-slate-700 hover:border-blue-400'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2">
                {loadingSlots ? 'Cargando horarios...' : 'Sin disponibilidad para ese día.'}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Notas (opcional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales, preferencias..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !title || !time}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium">
              {saving ? 'Guardando...' : 'Crear Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── VIEW / EDIT MODAL ────────────────────────────────────────────────────────
interface ViewModalProps {
  appointment: Appointment;
  onClose: () => void;
  onRefresh: () => void;
}
function ViewAppointmentModal({ appointment, onClose, onRefresh }: ViewModalProps) {
  const [acting, setActing] = useState('');
  const [reminderSentAt, setReminderSentAt] = useState<string | null>(
    appointment.reminder_sent_at ?? null
  );

  async function changeStatus(status: string) {
    setActing(status);
    try {
      await api.updateAppointmentStatus(appointment.id, status);
      onRefresh();
      onClose();
    } finally { setActing(''); }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta cita?')) return;
    setActing('delete');
    try {
      await api.deleteAppointment(appointment.id);
      onRefresh();
      onClose();
    } finally { setActing(''); }
  }

  async function handleSendReminder() {
    setActing('remind');
    try {
      const result = await api.sendReminder(appointment.id);
      if (result.sent) {
        toast.success('Recordatorio enviado');
        setReminderSentAt(result.appointment?.reminder_sent_at ?? new Date().toISOString());
        onRefresh();
      } else {
        toast.error(`No se pudo enviar el recordatorio: ${result.reason}`);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Error al enviar recordatorio');
    } finally {
      setActing('');
    }
  }

  const sb = STATUS_LABELS[appointment.status] ?? STATUS_LABELS.confirmed;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-base truncate max-w-[220px]">{appointment.title}</h3>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', sb.cls)}>{sb.label}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Time */}
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              {new Date(appointment.start_time).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {formatTime(appointment.start_time)} – {formatTime(appointment.end_time)}
              {' · '}{appointment.duration_minutes} min
            </span>
          </div>

          {/* Contact */}
          {appointment.contact_name && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{appointment.contact_name}</span>
            </div>
          )}

          {/* Service */}
          {appointment.service_name && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Wrench className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{appointment.service_name}</span>
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{appointment.notes}</p>
          )}

          {/* Reminder status */}
          <div className={cn(
            'flex items-center gap-2 text-xs px-3 py-2 rounded-lg',
            reminderSentAt ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'
          )}>
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            {reminderSentAt
              ? `📱 Recordatorio enviado · ${new Date(reminderSentAt).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}`
              : 'Sin recordatorio enviado'}
          </div>

          {/* Action buttons */}
          <div className="pt-2 space-y-2">
            {appointment.status === 'pending' && (
              <button onClick={() => changeStatus('confirmed')} disabled={!!acting}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                <CheckCircle2 className="w-4 h-4" />
                {acting === 'confirmed' ? 'Confirmando...' : 'Confirmar'}
              </button>
            )}
            {(appointment.status === 'confirmed' || appointment.status === 'pending') && (
              <button onClick={() => changeStatus('completed')} disabled={!!acting}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                <CheckCircle2 className="w-4 h-4" />
                {acting === 'completed' ? 'Marcando...' : 'Marcar como Completada'}
              </button>
            )}
            {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
              <button onClick={() => changeStatus('cancelled')} disabled={!!acting}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
                <XCircle className="w-4 h-4" />
                {acting === 'cancelled' ? 'Cancelando...' : 'Cancelar Cita'}
              </button>
            )}
            {/* Send reminder manually — only if contact has phone & not yet sent */}
            {!reminderSentAt && appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
              <button onClick={handleSendReminder} disabled={!!acting}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">
                <Smartphone className="w-4 h-4" />
                {acting === 'remind' ? 'Enviando...' : 'Enviar recordatorio ahora'}
              </button>
            )}

            <button onClick={handleDelete} disabled={!!acting}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors">
              <Trash2 className="w-4 h-4" />
              {acting === 'delete' ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const { activeBusinessId } = useBusiness();
  const [viewMode, setViewMode]       = useState<'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [showCreate, setShowCreate]   = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [viewing, setViewing]         = useState<Appointment | null>(null);

  // Derived from currentDate
  const weekStart = startOfWeek(currentDate);
  const weekEnd   = addDays(weekStart, 6);
  const days      = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch range changes based on view mode
  const monthGrid = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
  const fetchFrom = viewMode === 'week' ? weekStart : monthGrid[0];
  const fetchTo   = viewMode === 'week' ? weekEnd   : monthGrid[41];

  const { data: appointments, refetch } = useApi(
    () => api.getAppointments(toDateStr(fetchFrom), toDateStr(fetchTo)),
    [fetchFrom.toISOString(), viewMode, activeBusinessId],
  );

  const apptList: Appointment[] = appointments ?? [];
  const conflicts = detectConflicts(apptList);
  const grouped   = groupByDay(apptList);

  // Week navigation
  const prevWeek = useCallback(() => setCurrentDate((d) => addDays(d, -7)),  []);
  const nextWeek = useCallback(() => setCurrentDate((d) => addDays(d, 7)),   []);
  const goToday  = useCallback(() => setCurrentDate(new Date()),              []);

  // Month navigation
  const prevMonth = useCallback(() => setCurrentDate((d) => {
    const r = new Date(d); r.setDate(1); r.setMonth(r.getMonth() - 1); return r;
  }), []);
  const nextMonth = useCallback(() => setCurrentDate((d) => {
    const r = new Date(d); r.setDate(1); r.setMonth(r.getMonth() + 1); return r;
  }), []);

  const weekLabel = `${formatDateLabel(weekStart)} – ${formatDateLabel(weekEnd)} ${weekEnd.getFullYear()}`;
  const monthLabel = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const isCurrentWeek  = toDateStr(weekStart) === toDateStr(startOfWeek(new Date()));
  const isCurrentMonth = currentDate.getFullYear() === new Date().getFullYear()
                      && currentDate.getMonth()    === new Date().getMonth();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shrink-0 flex-wrap gap-2">
        {/* Left: navigation (changes per view) */}
        <div className="flex items-center gap-2">
          <button
            onClick={viewMode === 'week' ? prevWeek : prevMonth}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            disabled={viewMode === 'week' ? isCurrentWeek : isCurrentMonth}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={viewMode === 'week' ? nextWeek : nextMonth}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-700 ml-1 capitalize">
            {viewMode === 'week' ? weekLabel : monthLabel}
          </span>
        </div>

        {/* Center: view toggle pill */}
        <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
          {(['month', 'week'] as const).map((v, i) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={cn(
                'px-3 py-1.5 transition-colors',
                i > 0 && 'border-l border-slate-200',
                viewMode === v ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {v === 'month' ? 'Mes' : 'Semana'}
            </button>
          ))}
        </div>

        {/* Right: Nueva Cita */}
        <button
          onClick={() => { setSelectedDate(undefined); setShowCreate(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva Cita
        </button>
      </div>

      {/* ── Calendar body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Month view ── */}
        {viewMode === 'month' && (
          <div className="h-full min-h-[520px]">
            <MonthGrid
              year={currentDate.getFullYear()}
              month={currentDate.getMonth()}
              appointmentsByDate={buildAppointmentsByDate(apptList)}
              onDayClick={(date) => { setCurrentDate(date); setViewMode('week'); }}
              onChipClick={setViewing}
            />
          </div>
        )}

        {/* ── Week view — horizontally scrollable on mobile ── */}
        {viewMode === 'week' && <div className="overflow-x-auto"><div className="min-w-[680px]">
          {/* Day headers */}
          <div className="grid border-b border-slate-200 bg-white sticky top-0 z-10"
            style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            <div className="border-r border-slate-100" />
            {days.map((d, i) => {
              const isToday = toDateStr(d) === toDateStr(new Date());
              return (
                <div key={i}
                  className={cn(
                    'py-2 px-1 text-center border-r border-slate-100 last:border-r-0',
                    isToday && 'bg-blue-50'
                  )}>
                  <div className={cn('text-[10px] font-medium uppercase', isToday ? 'text-blue-600' : 'text-slate-400')}>
                    {DAY_NAMES_SHORT[d.getDay()]}
                  </div>
                  <div className={cn(
                    'text-sm font-bold mt-0.5 w-6 h-6 rounded-full mx-auto flex items-center justify-center',
                    isToday ? 'bg-blue-600 text-white' : 'text-slate-700'
                  )}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Body: time column + day columns */}
          <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            {/* Time labels */}
            <div className="relative border-r border-slate-100" style={{ height: `${GRID_HEIGHT}px` }}>
              {HOUR_LABELS.map((h) => {
                const top = (h - DAY_START_H) * 60 * PX_PER_MIN;
                return (
                  <div key={h} style={{ position: 'absolute', top: `${top - 8}px`, right: 6 }}
                    className="text-[10px] text-slate-400 text-right leading-none">
                    {String(h).padStart(2, '0')}:00
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {days.map((d, di) => {
              const key   = toDateStr(d);
              const isToday = key === toDateStr(new Date());
              const dayAppts = grouped[key] ?? [];

              return (
                <div key={di}
                  className={cn(
                    'relative border-r border-slate-100 last:border-r-0',
                    isToday && 'bg-blue-50/40'
                  )}
                  style={{ height: `${GRID_HEIGHT}px` }}
                  onClick={(e) => {
                    // Click on empty space → open create modal pre-filled with this date
                    if ((e.target as HTMLElement).closest('[role="button"]')) return;
                    setSelectedDate(key);
                    setShowCreate(true);
                  }}
                >
                  {/* Hour grid lines */}
                  {HOUR_LABELS.map((h) => (
                    <div key={h}
                      style={{ position: 'absolute', top: `${(h - DAY_START_H) * 60 * PX_PER_MIN}px`, left: 0, right: 0 }}
                      className="border-t border-slate-100"
                    />
                  ))}

                  {/* Current time indicator */}
                  {isToday && (() => {
                    const now = new Date();
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (nowMin < DAY_START_H * 60 || nowMin > DAY_END_H * 60) return null;
                    const top = (nowMin - DAY_START_H * 60) * PX_PER_MIN;
                    return (
                      <div style={{ position: 'absolute', top: `${top}px`, left: 0, right: 0, zIndex: 5 }}
                        className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                        <div className="flex-1 h-px bg-red-400" />
                      </div>
                    );
                  })()}

                  {/* Appointment blocks */}
                  {dayAppts.map(({ appt, col, total }) => (
                    <AppointmentBlock
                      key={appt.id}
                      appointment={appt}
                      hasConflict={conflicts.has(appt.id)}
                      column={col}
                      totalColumns={total}
                      onClick={setViewing}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div></div>}

        {/* Empty state — week only */}
        {viewMode === 'week' && apptList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-400">Sin citas esta semana</p>
            <p className="text-xs text-slate-300 mt-1">Haz clic en un espacio del calendario o en "Nueva Cita"</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateAppointmentModal
          defaultDate={selectedDate}
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
        />
      )}
      {viewing && (
        <ViewAppointmentModal
          appointment={viewing}
          onClose={() => setViewing(null)}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}

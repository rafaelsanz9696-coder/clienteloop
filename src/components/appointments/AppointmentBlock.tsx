import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Appointment } from '../../types';

const PX_PER_MIN = 1.2;
const DAY_START_HOUR = 8; // 8:00 AM

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-blue-500 border-blue-600 text-white',
  pending:   'bg-amber-400 border-amber-500 text-amber-900',
  cancelled: 'bg-slate-300 border-slate-400 text-slate-600 opacity-60',
  completed: 'bg-emerald-500 border-emerald-600 text-white',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

interface Props {
  appointment: Appointment;
  hasConflict: boolean;
  /** 0-based column index within a day (for side-by-side conflict layout) */
  column?: number;
  /** Total columns in this day slot (for side-by-side conflict layout) */
  totalColumns?: number;
  onClick: (a: Appointment) => void;
}

export default function AppointmentBlock({
  appointment,
  hasConflict,
  column = 0,
  totalColumns = 1,
  onClick,
}: Props) {
  const start = new Date(appointment.start_time);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const topPx = (startMin - DAY_START_HOUR * 60) * PX_PER_MIN;
  const heightPx = Math.max(appointment.duration_minutes * PX_PER_MIN, 22); // min 22px

  const widthPct = 100 / totalColumns;
  const leftPct  = column * widthPct;

  const statusStyle = STATUS_STYLES[appointment.status] ?? STATUS_STYLES.confirmed;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(appointment)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(appointment)}
      style={{
        position: 'absolute',
        top:    `${topPx}px`,
        height: `${heightPx}px`,
        left:   `${leftPct + 1}%`,
        width:  `${widthPct - 2}%`,
      }}
      className={cn(
        'rounded-md border text-[10px] leading-tight px-1 py-0.5 cursor-pointer',
        'overflow-hidden select-none transition-opacity hover:opacity-90',
        statusStyle,
        hasConflict && 'ring-2 ring-red-500 ring-offset-1'
      )}
      title={`${appointment.title} — ${formatTime(appointment.start_time)} a ${formatTime(appointment.end_time)}`}
    >
      {/* Conflict badge */}
      {hasConflict && (
        <span className="absolute top-0.5 right-0.5">
          <AlertTriangle className="w-3 h-3 text-red-500" />
        </span>
      )}

      <div className="font-semibold truncate pr-4">
        {appointment.contact_name ?? appointment.title}
      </div>

      {heightPx > 32 && (
        <div className="truncate opacity-80">
          {appointment.service_name ?? appointment.title}
        </div>
      )}

      {heightPx > 46 && (
        <div className="opacity-70">
          {formatTime(appointment.start_time)} – {formatTime(appointment.end_time)}
        </div>
      )}
    </div>
  );
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function getChannelLabel(channel: string): string {
  switch (channel) {
    case 'whatsapp': return 'WhatsApp';
    case 'instagram': return 'Instagram';
    case 'email': return 'Email';
    case 'web': return 'Web';
    default: return channel;
  }
}

export function getChannelColor(channel: string): string {
  switch (channel) {
    case 'whatsapp': return 'bg-green-100 text-green-700';
    case 'instagram': return 'bg-pink-100 text-pink-700';
    case 'email': return 'bg-blue-100 text-blue-700';
    case 'web': return 'bg-slate-100 text-slate-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}

export function getStageLabel(stage: string): string {
  switch (stage) {
    case 'new': return 'Nuevo';
    case 'in_progress': return 'En Proceso';
    case 'closed': return 'Cerrado';
    default: return stage;
  }
}

export function getStageColor(stage: string): string {
  switch (stage) {
    case 'new': return 'bg-blue-100 text-blue-700';
    case 'in_progress': return 'bg-amber-100 text-amber-700';
    case 'closed': return 'bg-green-100 text-green-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}

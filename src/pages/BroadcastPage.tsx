import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Plus, X, Send, Users, Tag, Kanban, Loader2,
  CheckCircle2, AlertCircle, Trash2, RefreshCw, ChevronRight,
  Clock, BarChart2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import type { Broadcast } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_CHARS = 1024;

const STAGE_LABELS: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', qualified: 'Calificado',
  proposal: 'Propuesta', won: 'Ganado', lost: 'Perdido',
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  draft:     { label: 'Borrador',  cls: 'bg-slate-100 text-slate-600',    icon: Clock },
  sending:   { label: 'Enviando',  cls: 'bg-amber-100 text-amber-700',    icon: Loader2 },
  completed: { label: 'Enviado',   cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  failed:    { label: 'Fallido',   cls: 'bg-red-100 text-red-600',         icon: AlertCircle },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── New Broadcast Modal ──────────────────────────────────────────────────────
interface NewBroadcastModalProps {
  onClose: () => void;
  onCreated: () => void;
}
function NewBroadcastModal({ onClose, onCreated }: NewBroadcastModalProps) {
  const { activeBusinessId } = useBusiness();

  // Step 1: compose — Step 2: audience — Step 3: confirm
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [name, setName]       = useState('');
  const [message, setMessage] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'stage' | 'tag'>('all');
  const [filterValue, setFilterValue] = useState('');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [sending, setSending] = useState(false);
  const [doneId, setDoneId]   = useState<number | null>(null);

  // Preview recipient count
  useEffect(() => {
    setLoadingCount(true);
    const val = filterType !== 'all' ? filterValue : undefined;
    api.previewBroadcastCount(filterType, val)
      .then((r) => setRecipientCount(r.count))
      .catch(() => setRecipientCount(null))
      .finally(() => setLoadingCount(false));
  }, [filterType, filterValue]);

  async function handleCreate(andSend: boolean) {
    setSaving(true);
    setError('');
    try {
      const broadcast = await api.createBroadcast({
        name: name.trim() || `Difusión ${new Date().toLocaleDateString('es-MX')}`,
        message,
        filter: { type: filterType, value: filterValue || undefined },
      });

      if (andSend) {
        setSending(true);
        await api.sendBroadcast(broadcast.id);
      }

      setDoneId(broadcast.id);
      onCreated();
    } catch (err: any) {
      setError(err.message ?? 'Error al crear');
    } finally {
      setSaving(false);
      setSending(false);
    }
  }

  // ── Step 3: Confirmation screen ────────────────────────────────────────────
  if (doneId !== null) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center p-8" onClick={(e) => e.stopPropagation()}>
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-base mb-1">
            {sending ? '¡Enviando difusión!' : 'Difusión creada'}
          </h3>
          <p className="text-sm text-slate-400 mb-5">
            {sending
              ? 'Los mensajes se están enviando en segundo plano. Puedes cerrar esta ventana.'
              : 'Guardada como borrador. Puedes enviarla desde el historial.'}
          </p>
          <button onClick={onClose} className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800">Nueva Difusión</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-slate-100">
          {(['Mensaje', 'Audiencia', 'Confirmar'] as const).map((label, i) => (
            <div
              key={label}
              className={cn(
                'flex-1 py-2.5 text-xs font-medium text-center transition-colors',
                step === i + 1 ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'
              )}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="p-5 space-y-4">

          {/* ── STEP 1: Message composer ────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre de la difusión</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Difusión ${new Date().toLocaleDateString('es-MX')}`}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">Mensaje *</label>
                  <span className={cn('text-[10px]', message.length > MAX_CHARS * 0.9 ? 'text-red-500' : 'text-slate-400')}>
                    {message.length}/{MAX_CHARS}
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                  placeholder={'Hola {{nombre}} 👋\n\nTe escribimos desde [tu negocio]...\n\nUsa {{nombre}} para personalizar con el nombre del contacto.'}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                />
                {/* Variable chip */}
                <button
                  type="button"
                  onClick={() => setMessage((m) => m + '{{nombre}}')}
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-100 transition-colors"
                >
                  {'+ {{nombre}}'}
                </button>
                <p className="text-[10px] text-slate-400 mt-1">
                  <strong>{'{{nombre}}'}</strong> se reemplaza con el nombre de cada contacto automáticamente.
                </p>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!message.trim()}
                className="w-full py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                Elegir audiencia <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* ── STEP 2: Audience filter ─────────────────────────────────────── */}
          {step === 2 && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">¿A quién enviar?</label>
                <div className="space-y-2">
                  {[
                    { value: 'all', icon: Users, label: 'Todos los contactos con teléfono' },
                    { value: 'stage', icon: Kanban, label: 'Por etapa del pipeline' },
                    { value: 'tag', icon: Tag, label: 'Por etiqueta' },
                  ].map(({ value, icon: Icon, label }) => (
                    <label
                      key={value}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-all',
                        filterType === value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="filter"
                        value={value}
                        checked={filterType === value as any}
                        onChange={() => { setFilterType(value as any); setFilterValue(''); }}
                        className="sr-only"
                      />
                      <Icon className={cn('w-4 h-4 shrink-0', filterType === value ? 'text-blue-600' : 'text-slate-400')} />
                      <span className={cn('text-sm font-medium', filterType === value ? 'text-blue-700' : 'text-slate-700')}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sub-filter values */}
              {filterType === 'stage' && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Etapa</label>
                  <select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Todas las etapas —</option>
                    {Object.entries(STAGE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              )}

              {filterType === 'tag' && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Etiqueta</label>
                  <input
                    type="text"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder="Ej: vip, promo, cliente-nuevo"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Recipient count preview */}
              <div className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium',
                loadingCount ? 'bg-slate-50 text-slate-400' :
                (recipientCount ?? 0) === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
              )}>
                {loadingCount
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculando...</>
                  : <><Users className="w-4 h-4" /> {recipientCount ?? 0} contacto{recipientCount !== 1 ? 's' : ''} recibirán este mensaje</>
                }
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                  Atrás
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={loadingCount || (recipientCount ?? 0) === 0}
                  className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  Confirmar <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Confirm & send ──────────────────────────────────────── */}
          {step === 3 && (
            <>
              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <Megaphone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-slate-400">Nombre</span>
                    <p className="font-medium text-slate-800">{name.trim() || `Difusión ${new Date().toLocaleDateString('es-MX')}`}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-slate-400">Destinatarios</span>
                    <p className="font-medium text-slate-800">
                      {recipientCount} contacto{recipientCount !== 1 ? 's' : ''}
                      {filterType !== 'all' && filterValue && ` · ${filterType === 'stage' ? STAGE_LABELS[filterValue] : filterValue}`}
                    </p>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-2">
                  <span className="text-xs text-slate-400 block mb-1">Mensaje</span>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-4 font-mono">{message}</p>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Solo envía a contactos que hayan dado su consentimiento para recibir mensajes de tu negocio. El envío masivo sin consentimiento puede suspender tu cuenta de WhatsApp.</span>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                  Atrás
                </button>
                <button
                  onClick={() => handleCreate(false)}
                  disabled={saving}
                  className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {saving && !sending ? 'Guardando...' : 'Guardar borrador'}
                </button>
                <button
                  onClick={() => handleCreate(true)}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {saving && sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><Send className="w-4 h-4" /> Enviar ahora</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Broadcast row ────────────────────────────────────────────────────────────
function BroadcastRow({ broadcast, onSend, onDelete, onRefresh }: {
  broadcast: Broadcast;
  onSend: (id: number) => void;
  onDelete: (id: number) => void;
  onRefresh: () => void;
}) {
  const cfg = STATUS_CONFIG[broadcast.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;
  const isSending = broadcast.status === 'sending';
  const progress = broadcast.recipient_count > 0
    ? Math.round(((broadcast.sent_count + broadcast.failed_count) / broadcast.recipient_count) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-sm text-slate-800 truncate">{broadcast.name}</p>
            <span className={cn('shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
              <StatusIcon className={cn('w-3 h-3', isSending && 'animate-spin')} />
              {cfg.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">{formatDate(broadcast.created_at)}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isSending && (
            <button onClick={onRefresh} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Actualizar estado">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {broadcast.status === 'draft' && (
            <button
              onClick={() => onSend(broadcast.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Send className="w-3 h-3" /> Enviar
            </button>
          )}
          {(broadcast.status === 'completed' || broadcast.status === 'failed') && (
            <button
              onClick={() => onDelete(broadcast.id)}
              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{broadcast.recipient_count} contactos</span>
        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" />{broadcast.sent_count} enviados</span>
        {broadcast.failed_count > 0 && (
          <span className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3.5 h-3.5" />{broadcast.failed_count} fallidos</span>
        )}
      </div>

      {/* Progress bar */}
      {(isSending || broadcast.status === 'completed') && broadcast.recipient_count > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', isSending ? 'bg-amber-400' : 'bg-emerald-500')}
              style={{ width: `${progress}%` }}
            />
          </div>
          {isSending && (
            <p className="text-[10px] text-slate-400">
              {broadcast.sent_count + broadcast.failed_count} / {broadcast.recipient_count} procesados
            </p>
          )}
        </div>
      )}

      {/* Message preview */}
      <p className="text-[11px] text-slate-400 line-clamp-2 italic bg-slate-50 rounded-lg px-3 py-1.5">
        "{broadcast.message.slice(0, 100)}{broadcast.message.length > 100 ? '...' : ''}"
      </p>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function BroadcastPage() {
  const { activeBusinessId } = useBusiness();
  const [showNew, setShowNew] = useState(false);

  const { data: broadcasts, refetch, loading } = useApi(
    () => api.getBroadcasts(),
    [activeBusinessId]
  );

  const list: Broadcast[] = broadcasts ?? [];

  // Poll sending broadcasts every 5s
  useEffect(() => {
    const hasSending = list.some((b) => b.status === 'sending');
    if (!hasSending) return;
    const t = setInterval(refetch, 5000);
    return () => clearInterval(t);
  }, [list, refetch]);

  async function handleSend(id: number) {
    try {
      await api.sendBroadcast(id);
      refetch();
    } catch (err: any) {
      alert(err.message ?? 'Error al enviar');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta difusión?')) return;
    try {
      await api.deleteBroadcast(id);
      refetch();
    } catch (err: any) {
      alert(err.message ?? 'Error al eliminar');
    }
  }

  // Summary stats for header
  const totalSent      = list.reduce((s, b) => s + b.sent_count, 0);
  const totalRecipients = list.reduce((s, b) => s + b.recipient_count, 0);
  const completedCount = list.filter((b) => b.status === 'completed').length;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600" /> Difusión Masiva
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Envía un WhatsApp a múltiples contactos a la vez</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva Difusión
        </button>
      </div>

      {/* ── Summary stats ── */}
      {list.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Difusiones', value: list.length, icon: Megaphone, color: 'text-blue-600 bg-blue-50' },
            { label: 'Mensajes enviados', value: totalSent, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Tasa de éxito', value: totalRecipients > 0 ? `${Math.round((totalSent / totalRecipients) * 100)}%` : '—', icon: BarChart2, color: 'text-violet-600 bg-violet-50' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5', color)}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-lg font-bold text-slate-800">{value}</p>
              <p className="text-[10px] text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : list.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Megaphone className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-400 mb-1">Sin difusiones aún</p>
          <p className="text-xs text-slate-300 mb-4">Crea tu primera campaña masiva de WhatsApp</p>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            Crear primera difusión
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <BroadcastRow
              key={b.id}
              broadcast={b}
              onSend={handleSend}
              onDelete={handleDelete}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}

      {showNew && (
        <NewBroadcastModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); refetch(); }}
        />
      )}
    </div>
  );
}

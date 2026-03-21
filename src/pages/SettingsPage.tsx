import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Allow TypeScript to recognise window.FB injected by Facebook SDK
declare global {
  interface Window { FB: any; fbAsyncInit: any; }
}
import { toast } from '../lib/toast';
import { useSearchParams } from 'react-router-dom';
import { Save, CheckCircle2, History, Upload, Sparkles, X, Plus, Trash2, MessageSquare, Mail, Phone, CalendarDays, Edit2, Link, Copy, ExternalLink, Users2, UserPlus, Shield, Crown, UserX, ChevronDown, Loader2 } from 'lucide-react';
import { cn, formatRelativeTime } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { parseWhatsAppChat, formatChatForAnalysis, getChatStats } from '../lib/chatParser';
import QuickRepliesTab from '../components/settings/QuickRepliesTab';
import MemoriesTab from '../components/settings/MemoriesTab';
import AISetupAssistant from '../components/AISetupAssistant';
import type { TeamMember, TeamInvitation } from '../types/index';

const NICHOS = [
  { value: 'salon', label: 'Salón de Belleza / Estética' },
  { value: 'barberia', label: 'Barbería' },
  { value: 'clinica', label: 'Clínica / Consultorio Médico' },
  { value: 'inmobiliaria', label: 'Inmobiliaria / Bienes Raíces' },
  { value: 'restaurante', label: 'Restaurante / Taquería' },
  { value: 'academia', label: 'Academia / Centro Educativo' },
  { value: 'taller', label: 'Taller Mecánico' },
  { value: 'courier', label: 'Courier / Mensajería' },
  { value: 'agencia_ia',   label: 'Agencia de IA / Automatización' },
  { value: 'vidrieria',    label: 'Vidriería / Cristalería / Espejos' },
  { value: 'carpinteria',  label: 'Carpintería / Ebanistería' },
  { value: 'construccion', label: 'Construcción / Remodelación' },
];

// ─── Channel config icons ────────────────────────────────────────────────────
const CHANNEL_OPTS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, placeholder: 'Ej: 1000177549846403' },
  { value: 'sms', label: 'SMS', icon: Phone, placeholder: '+521234567890' },
  { value: 'email', label: 'Email', icon: Mail, placeholder: 'soporte@minegocio.com' },
] as const;

// ─── Channels Tab ────────────────────────────────────────────────────────────
function ChannelsTab() {
  const { activeBusinessId } = useBusiness();
  const { data: channels, refetch } = useApi(() => api.getChannelNumbers(), [activeBusinessId]);
  const [adding, setAdding] = useState(false);
  const [newChannel, setNewChannel] = useState('sms');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Determine if WhatsApp is already connected via Embedded Signup
  const waChannel = useMemo(
    () => channels?.find((ch: any) => ch.channel === 'whatsapp'),
    [channels]
  );
  const waConnectedViaMeta = !!(waChannel?.waba_id);

  // Load Facebook SDK once
  useEffect(() => {
    if (window.FB) return;
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: import.meta.env.VITE_FACEBOOK_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v21.0',
      });
    };
  }, []);

  async function handleEmbeddedSignup() {
    if (!window.FB) {
      toast.error('Facebook SDK aún cargando, intenta en un momento');
      return;
    }
    if (!import.meta.env.VITE_FACEBOOK_CONFIG_ID) {
      toast.error('VITE_FACEBOOK_CONFIG_ID no configurado en Vercel');
      return;
    }
    setConnecting(true);
    // Safety timeout — reset if FB popup is blocked or never returns
    const timeout = setTimeout(() => {
      setConnecting(false);
      toast.error('El popup de Facebook fue bloqueado. Permite popups para este sitio e intenta de nuevo.');
    }, 15000);
    try {
      window.FB.login(
        (response: any) => {
          clearTimeout(timeout);
          if (!response.authResponse) {
            toast.error('Conexión cancelada');
            setConnecting(false);
            return;
          }
          const code   = response.authResponse.code;
          const wabaId = response.authResponse.waba_id;
          if (!code || !wabaId) {
            toast.error('Meta no devolvió el código de autorización. Revisa la configuración del App.');
            setConnecting(false);
            return;
          }
          api.connectWhatsApp(code, wabaId)
            .then((result) => {
              toast.success(`✅ WhatsApp conectado: ${result.display_phone_number}`);
              refetch();
            })
            .catch((err: any) => {
              toast.error('Error al conectar: ' + (err.message || 'Intenta de nuevo'));
            })
            .finally(() => setConnecting(false));
        },
        {
          config_id: import.meta.env.VITE_FACEBOOK_CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            feature: 'whatsapp_embedded_signup',
            sessionInfoVersion: 2,
          },
        }
      );
    } catch (err: any) {
      clearTimeout(timeout);
      setConnecting(false);
      toast.error('Error al abrir Facebook: ' + (err.message || 'Intenta de nuevo'));
    }
  }

  async function handleAdd() {
    if (!newIdentifier.trim()) return;
    setSaving(true);
    try {
      await api.saveChannelNumber({ channel: newChannel, identifier: newIdentifier.trim(), label: newLabel.trim() });
      toast.success('Canal guardado');
      setNewIdentifier('');
      setNewLabel('');
      setAdding(false);
      refetch();
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'Intenta de nuevo'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Eliminar este canal?')) return;
    await api.deleteChannelNumber(id);
    refetch();
  }

  // For manual channels (SMS, Email): only show non-whatsapp CHANNEL_OPTS
  const MANUAL_CHANNEL_OPTS = CHANNEL_OPTS.filter((c) => c.value !== 'whatsapp');
  const opt = MANUAL_CHANNEL_OPTS.find((c) => c.value === newChannel) ?? MANUAL_CHANNEL_OPTS[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-1">Canales Conectados</h3>
        <p className="text-xs text-slate-400">
          Conecta tu WhatsApp Business y otros canales para recibir mensajes de clientes en el inbox.
        </p>
      </div>

      {/* ── WhatsApp section (Embedded Signup) ── */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-slate-800">WhatsApp Business</span>
          {waConnectedViaMeta && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Conectado via Meta
            </span>
          )}
        </div>

        {waConnectedViaMeta ? (
          /* Connected state */
          <div className="flex items-center gap-3 px-3 py-2.5 bg-green-50 rounded-lg border border-green-100">
            <MessageSquare className="w-4 h-4 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-700">{waChannel?.identifier}</span>
              {waChannel?.label && (
                <span className="text-xs text-slate-400 ml-2">{waChannel.label}</span>
              )}
            </div>
            <button
              onClick={() => handleDelete(waChannel!.id)}
              className="text-slate-300 hover:text-red-500 transition-colors"
              title="Desconectar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : waChannel ? (
          /* Legacy manual entry — show existing row + option to upgrade */
          <>
            <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <MessageSquare className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700">{waChannel.identifier}</span>
                {waChannel.label && <span className="text-xs text-slate-400 ml-2">{waChannel.label}</span>}
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">manual</span>
              <button onClick={() => handleDelete(waChannel.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              ¿Quieres conectar por Meta para habilitar Coexistence?
            </p>
            <button
              onClick={handleEmbeddedSignup}
              disabled={connecting}
              className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] text-white text-sm font-semibold rounded-lg hover:bg-[#166ee1] disabled:opacity-60 transition-colors"
            >
              {connecting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
                : <><MessageSquare className="w-4 h-4" /> Conectar con Facebook</>}
            </button>
          </>
        ) : (
          /* Not connected */
          <>
            <p className="text-xs text-slate-500">
              Conecta tu número de WhatsApp Business en segundos. Tu número sigue activo en la app del teléfono (Coexistence) y el CRM recibe y envía mensajes con IA en paralelo.
            </p>
            <button
              onClick={handleEmbeddedSignup}
              disabled={connecting}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1877F2] text-white text-sm font-semibold rounded-lg hover:bg-[#166ee1] disabled:opacity-60 transition-colors shadow-sm"
            >
              {connecting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
                : <><MessageSquare className="w-4 h-4" /> Conectar con Facebook</>}
            </button>
            <p className="text-[11px] text-slate-400">
              🔒 Tu número permanece activo en WhatsApp Business App. No necesitas migrar nada.
            </p>
          </>
        )}
      </div>

      {/* ── Other channels (SMS, Email) ── */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Otros canales</h4>

        {channels && channels.filter((ch: any) => ch.channel !== 'whatsapp').length > 0 ? (
          <div className="space-y-2">
            {channels.filter((ch: any) => ch.channel !== 'whatsapp').map((ch: any) => {
              const cfg = CHANNEL_OPTS.find((c) => c.value === ch.channel);
              const Icon = cfg?.icon ?? MessageSquare;
              return (
                <div key={ch.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <Icon className="w-4 h-4 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700">{ch.identifier}</span>
                    {ch.label && <span className="text-xs text-slate-400 ml-2">{ch.label}</span>}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                    {ch.channel}
                  </span>
                  <button onClick={() => handleDelete(ch.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Add form for SMS/Email */}
        {adding ? (
          <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MANUAL_CHANNEL_OPTS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={newIdentifier}
                onChange={(e) => setNewIdentifier(e.target.value)}
                placeholder={opt.placeholder}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Etiqueta (opcional)"
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !newIdentifier.trim()}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar canal'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar SMS / Email
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────
function ServicesTab() {
  const { activeBusinessId } = useBusiness();
  const { data: services, refetch } = useApi(() => api.getServices(), [activeBusinessId]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', duration_minutes: 60, price: '' });
  const [saving, setSaving] = useState(false);

  function resetForm() { setForm({ name: '', duration_minutes: 60, price: '' }); setAdding(false); setEditingId(null); }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = { name: form.name.trim(), duration_minutes: form.duration_minutes, price: form.price ? Number(form.price) : undefined };
      if (editingId) {
        await api.updateService(editingId, data);
      } else {
        await api.createService(data);
      }
      toast.success(editingId ? 'Servicio actualizado' : 'Servicio creado');
      resetForm();
      refetch();
    } catch (err: any) { toast.error('Error: ' + (err.message || 'Intenta de nuevo')); }
    finally { setSaving(false); }
  }

  async function handleToggle(svc: any) {
    await api.updateService(svc.id, { active: !svc.active });
    refetch();
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este servicio?')) return;
    await api.deleteService(id);
    refetch();
  }

  function startEdit(svc: any) {
    setEditingId(svc.id);
    setForm({ name: svc.name, duration_minutes: svc.duration_minutes, price: svc.price ?? '' });
    setAdding(true);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-1">Catálogo de Servicios</h3>
        <p className="text-xs text-slate-400">Define los servicios que ofreces con su duración. El AI usará esto para calcular disponibilidad y detectar conflictos de horario.</p>
      </div>

      {/* List */}
      {services && services.length > 0 ? (
        <div className="space-y-2">
          {services.map((svc: any) => (
            <div key={svc.id} className={cn('flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100', !svc.active && 'opacity-50')}>
              <CalendarDays className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700">{svc.name}</span>
                <span className="text-xs text-slate-400 ml-2">{svc.duration_minutes} min</span>
                {svc.price && <span className="text-xs text-slate-400 ml-2">${Number(svc.price).toLocaleString('es-MX')}</span>}
              </div>
              <button onClick={() => handleToggle(svc)} title={svc.active ? 'Desactivar' : 'Activar'}
                className={cn('text-xs px-2 py-0.5 rounded font-medium', svc.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500')}>
                {svc.active ? 'Activo' : 'Inactivo'}
              </button>
              <button onClick={() => startEdit(svc)} className="text-slate-400 hover:text-blue-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(svc.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 py-4 text-center">No hay servicios. Agrega uno para comenzar.</p>
      )}

      {/* Add / Edit form */}
      {adding ? (
        <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700">{editingId ? 'Editar servicio' : 'Nuevo servicio'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre del servicio" autoFocus
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="number" value={form.duration_minutes} min={5} step={5}
              onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
              placeholder="Duración (min)"
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="number" value={form.price} step={0.01}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="Precio (opcional)"
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={resetForm} className="flex-1 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Agregar'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setAdding(true); }}
          className="w-full py-2 text-sm border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Agregar Servicio
        </button>
      )}
    </div>
  );
}

// ─── Booking Tab ─────────────────────────────────────────────────────────────
function BookingTab() {
  const { activeBusinessId, activeBusiness } = useBusiness();
  const { data: business, refetch } = useApi(() => api.getBusiness(), [activeBusinessId]);

  const [slug, setSlug] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync slug from loaded business
  useEffect(() => {
    if (business) {
      setSlug(business.booking_slug ?? String(business.id));
    }
  }, [business]);

  const bookingUrl = `${window.location.origin}/book/${slug || (business?.id ?? '')}`;

  async function handleSaveSlug() {
    setSaving(true);
    setError('');
    try {
      await api.updateBookingSlug(slug);
      await refetch();
      setEditing(false);
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-5">
      {/* Booking link card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <Link className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-0.5">Tu link de reserva</h3>
            <p className="text-xs text-slate-400">Comparte este link con tus clientes para que reserven citas sin llamarte.</p>
          </div>
        </div>

        {/* Link display */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-2">
          <span className="flex-1 text-sm text-slate-700 font-mono truncate">{bookingUrl}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {copied ? (
              <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Copiado</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copiar</>
            )}
          </button>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Abrir en nueva pestaña"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Slug editor */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">URL personalizada</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <span className="px-2.5 py-2 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap">/book/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setEditing(true); }}
                placeholder={String(business?.id ?? '')}
                className="flex-1 px-2.5 py-2 text-sm focus:outline-none bg-white"
                maxLength={50}
              />
            </div>
            {editing && (
              <>
                <button
                  onClick={handleSaveSlug}
                  disabled={saving || slug.length < 3}
                  className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => { setSlug(business?.booking_slug ?? String(business?.id ?? '')); setEditing(false); setError(''); }}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <p className="text-[10px] text-slate-400 mt-1.5">Solo letras minúsculas, números y guiones. Mínimo 3 caracteres.</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-blue-700">¿Cómo funciona?</p>
        <div className="space-y-2">
          {[
            { n: 1, text: 'El cliente abre tu link de reserva' },
            { n: 2, text: 'Elige el servicio, fecha y hora disponible' },
            { n: 3, text: 'Ingresa su nombre y teléfono' },
            { n: 4, text: 'La cita aparece en tu Calendario automáticamente' },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-center gap-2.5 text-xs text-blue-700">
              <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center font-bold text-blue-700 shrink-0 text-[10px]">{n}</span>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* Share tips */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
        <p className="text-xs font-bold text-slate-700 mb-2">💡 Dónde compartir tu link</p>
        {[
          'Descripción de tu perfil de WhatsApp Business',
          'Bio de Instagram / TikTok',
          'Botón en tu sitio web',
          'Mensaje de bienvenida automático',
          'Tarjetas de presentación (QR)',
        ].map((tip) => (
          <div key={tip} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="text-emerald-500">✓</span> {tip}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────
const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise',
};
const ROLE_LABELS: Record<string, string> = { admin: 'Admin', agent: 'Agente' };

function TeamTab() {
  const { activeBusinessId } = useBusiness();
  const { data: team, loading, refetch } = useApi(() => api.getTeam(), [activeBusinessId]);
  const { data: invitations, refetch: refetchInvites } = useApi(() => api.getTeamInvitations(), [activeBusinessId]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent'>('agent');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [roleMenuId, setRoleMenuId] = useState<number | null>(null);

  const isAdmin = team?.my_role === 'admin';

  async function handleInvite() {
    setInviting(true);
    try {
      const result = await api.inviteMember({ email: inviteEmail.trim() || undefined, role: inviteRole });
      setInviteLink(result.link);
      refetchInvites();
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'Intenta de nuevo'));
      setShowInviteModal(false);
    } finally {
      setInviting(false);
    }
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleRoleChange(memberId: number, role: 'admin' | 'agent') {
    try {
      await api.updateMemberRole(memberId, role);
      toast.success('Rol actualizado');
      setRoleMenuId(null);
      refetch();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  }

  async function handleRemove(memberId: number, email: string) {
    if (!confirm(`¿Remover a ${email} del equipo?`)) return;
    try {
      await api.removeMember(memberId);
      toast.success(`${email} removido del equipo`);
      refetch();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  }

  async function handleRevokeInvite(id: number) {
    try {
      await api.revokeInvitation(id);
      toast.success('Invitación revocada');
      refetchInvites();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  }

  if (loading) return <LoadingSpinner text="Cargando equipo..." />;

  return (
    <div className="space-y-5">
      {/* Plan + limits card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users2 className="w-4 h-4 text-blue-500" />
              Equipo
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Plan <span className="font-semibold text-slate-600">{PLAN_LABELS[team?.plan ?? 'starter']}</span>
              {' — '}{team?.total ?? 1}/{team?.limit ?? 2} miembro{(team?.limit ?? 2) > 1 ? 's' : ''}
            </p>
          </div>
          {isAdmin && (team?.total ?? 1) < (team?.limit ?? 2) && (
            <button
              onClick={() => { setInviteLink(''); setInviteEmail(''); setShowInviteModal(true); }}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invitar
            </button>
          )}
          {isAdmin && (team?.total ?? 1) >= (team?.limit ?? 2) && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg font-medium">
              Límite alcanzado
            </span>
          )}
        </div>

        {/* Members list */}
        <div className="space-y-2">
          {/* Owner */}
          {team?.owner && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <div className="w-7 h-7 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
                <Crown className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">
                  {team.owner.name || team.owner.email}
                </div>
                {team.owner.email && team.owner.name && (
                  <div className="text-xs text-slate-400 truncate">{team.owner.email}</div>
                )}
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
                Dueño
              </span>
            </div>
          )}

          {/* Agent members */}
          {(team?.members ?? []).map((m: TeamMember) => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-slate-500 uppercase">
                {m.email.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">{m.email}</div>
                <div className="text-xs text-slate-400">
                  Unido {new Date(m.joined_at).toLocaleDateString('es', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {/* Role badge / dropdown (admin only) */}
              {isAdmin ? (
                <div className="relative">
                  <button
                    onClick={() => setRoleMenuId(roleMenuId === m.id ? null : m.id)}
                    className={cn(
                      'flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wide transition-colors',
                      m.role === 'admin'
                        ? 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100'
                        : 'text-slate-500 bg-slate-100 border-slate-200 hover:bg-slate-200'
                    )}
                  >
                    {m.role === 'admin' ? <Shield className="w-3 h-3" /> : null}
                    {ROLE_LABELS[m.role]}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {roleMenuId === m.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden text-xs">
                      {(['agent', 'admin'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => handleRoleChange(m.id, r)}
                          className={cn(
                            'w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2',
                            m.role === r && 'font-bold text-blue-600'
                          )}
                        >
                          {r === 'admin' ? <Shield className="w-3 h-3" /> : <Users2 className="w-3 h-3" />}
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide',
                  m.role === 'admin' ? 'text-purple-600 bg-purple-50 border-purple-200' : 'text-slate-500 bg-slate-100 border-slate-200'
                )}>
                  {ROLE_LABELS[m.role]}
                </span>
              )}

              {isAdmin && (
                <button
                  onClick={() => handleRemove(m.id, m.email)}
                  className="text-slate-300 hover:text-red-500 transition-colors ml-1"
                  title="Remover del equipo"
                >
                  <UserX className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending invitations (admin only) */}
      {isAdmin && invitations && invitations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Invitaciones pendientes
          </h4>
          <div className="space-y-2">
            {invitations.map((inv: TeamInvitation) => (
              <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">
                    {inv.email || 'Sin email especificado'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {ROLE_LABELS[inv.role]} · Expira {new Date(inv.expires_at).toLocaleDateString('es')}
                  </div>
                </div>
                <button
                  onClick={() => copyLink(`${window.location.origin}/app/settings?join=${inv.token}`)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Link
                </button>
                <button
                  onClick={() => handleRevokeInvite(inv.id)}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                  title="Revocar invitación"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-500" />
                Invitar al equipo
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!inviteLink ? (
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block uppercase tracking-wide">
                    Email (opcional)
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colaborador@empresa.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Solo como referencia. Cualquiera con el link puede unirse.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block uppercase tracking-wide">Rol</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['agent', 'admin'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setInviteRole(r)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all',
                          inviteRole === r
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 hover:border-slate-300 text-slate-500'
                        )}
                      >
                        {r === 'admin' ? <Shield className="w-5 h-5" /> : <Users2 className="w-5 h-5" />}
                        <span className="font-bold">{ROLE_LABELS[r]}</span>
                        <span className="text-[10px] text-center leading-tight opacity-70">
                          {r === 'admin' ? 'Acceso total + puede invitar' : 'Puede ver y responder mensajes'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {inviting ? 'Generando...' : 'Generar link de invitación'}
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                  <CheckCircle2 className="w-5 h-5" />
                  Link generado — válido 7 días
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1.5">Comparte este link con tu colaborador:</p>
                  <p className="text-xs font-mono text-slate-700 break-all">{inviteLink}</p>
                </div>
                <button
                  onClick={() => copyLink(inviteLink)}
                  className={cn(
                    'w-full py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors',
                    linkCopied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  )}
                >
                  <Copy className="w-4 h-4" />
                  {linkCopied ? '¡Copiado!' : 'Copiar link'}
                </button>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Settings Page ──────────────────────────────────────────────────────
export default function SettingsPage() {
  const { activeBusinessId } = useBusiness();
  const { data: business, loading } = useApi(() => api.getBusiness(), [activeBusinessId]);
  const { data: aiLogs } = useApi(() => api.getAiLogs(), [activeBusinessId]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'general' | 'channels' | 'templates' | 'memory' | 'services' | 'booking' | 'team'>('general');

  // Join-invite banner state
  const joinToken = searchParams.get('join');
  const [joinPreview, setJoinPreview] = useState<{ business_name: string; role: string } | null>(null);
  const [joinStatus, setJoinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [joinError, setJoinError] = useState('');
  const { businesses, switchBusiness } = useBusiness();
  const [form, setForm] = useState({
    name: '',
    nicho: 'salon',
    owner_name: '',
    email: '',
    phone: '',
    working_hours: '',
    ai_context: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSetupAssistant, setShowSetupAssistant] = useState(false);

  // Train AI state
  const [chatInput, setChatInput] = useState('');
  const [trainStatus, setTrainStatus] = useState<'idle' | 'analyzing' | 'preview' | 'saved'>('idle');
  const [styleProfile, setStyleProfile] = useState('');
  const [mergeMode, setMergeMode] = useState(true);
  const [chatStats, setChatStats] = useState<{ total: number; fromBusiness: number; fromClients: number; detectedBusinessName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || '',
        nicho: business.nicho || 'salon',
        owner_name: business.owner_name || '',
        email: business.email || '',
        phone: business.phone || '',
        working_hours: business.working_hours || '',
        ai_context: business.ai_context || '',
      });
    }
  }, [business]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 5 MB limit — WhatsApp exports are rarely larger than 1 MB without media
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      toast.error('Archivo muy grande. Exporta el chat sin adjuntos (máx. 5 MB).');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || '';
      setChatInput(text);
      setChatStats(null);
    };
    reader.readAsText(file, 'UTF-8');
    // Reset so same file can be uploaded again
    e.target.value = '';
  }

  async function handleAnalyzeChats() {
    if (!business || !chatInput.trim()) return;
    setTrainStatus('analyzing');
    try {
      // Parse locally first to get stats and format for API
      const parsed = parseWhatsAppChat(chatInput);
      const formatted = parsed.length > 0
        ? formatChatForAnalysis(parsed)
        : chatInput.trim().slice(0, 15000); // fallback: send raw text

      const stats = parsed.length > 0 ? getChatStats(parsed) : null;
      setChatStats(stats);

      const result = await api.analyzeChats({
        chatText: formatted,
        businessName: form.name || business.name,
        nicho: form.nicho || business.nicho || 'general',
      });
      setStyleProfile(result.styleProfile);
      setTrainStatus('preview');
    } catch (err: any) {
      toast.error('Error al analizar los chats: ' + (err.message || 'Intenta de nuevo'));
      setTrainStatus('idle');
    }
  }

  async function handleUseProfile() {
    if (!business) return;
    const newContext = mergeMode && form.ai_context.trim()
      ? form.ai_context.trim() + '\n\n---\n\n' + styleProfile
      : styleProfile;

    const updatedForm = { ...form, ai_context: newContext };
    setForm(updatedForm);

    try {
      await api.updateBusiness(business.id, updatedForm as any);
      setTrainStatus('saved');
      setTimeout(() => {
        setTrainStatus('idle');
        setChatInput('');
        setStyleProfile('');
        setChatStats(null);
      }, 3500);
    } catch (err: any) {
      toast.error('Error al guardar el perfil: ' + (err.message || 'Intenta de nuevo'));
    }
  }

  function handleDiscardProfile() {
    setTrainStatus('idle');
    setChatInput('');
    setStyleProfile('');
    setChatStats(null);
  }

  async function handleSave() {
    if (!business) return;
    setSaving(true);
    try {
      await api.updateBusiness(business.id, form as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  // If URL contains ?join=TOKEN, load preview info for the join banner
  useEffect(() => {
    if (!joinToken) return;
    api.previewInvite(joinToken)
      .then((data) => setJoinPreview({ business_name: data.business_name, role: data.role }))
      .catch(() => setJoinPreview(null));
  }, [joinToken]);

  const handleJoin = useCallback(async () => {
    if (!joinToken) return;
    setJoinStatus('loading');
    try {
      const result = await api.joinBusiness(joinToken);
      setJoinStatus('success');
      // Remove the join param and reload businesses
      setSearchParams({});
      // Switch to the newly joined business after a brief delay
      setTimeout(() => switchBusiness(result.business_id), 800);
    } catch (err: any) {
      setJoinStatus('error');
      setJoinError(err.message || 'Error al unirse');
    }
  }, [joinToken, setSearchParams, switchBusiness]);

  if (loading) return <LoadingSpinner text="Cargando ajustes..." />;

  return (
    <>
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">Ajustes</h2>
      </div>

      {/* Join-invite banner */}
      {joinToken && joinPreview && joinStatus !== 'success' && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Users2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-800">
              Invitación: unirte a <span className="text-blue-600">{joinPreview.business_name}</span>
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Rol: <strong>{joinPreview.role === 'admin' ? 'Admin' : 'Agente'}</strong>
            </p>
            {joinStatus === 'error' && (
              <p className="text-xs text-red-600 mt-1">{joinError}</p>
            )}
          </div>
          <button
            onClick={handleJoin}
            disabled={joinStatus === 'loading'}
            className="shrink-0 text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {joinStatus === 'loading' ? 'Uniéndose...' : 'Aceptar'}
          </button>
        </div>
      )}
      {joinToken && joinStatus === 'success' && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <p className="text-sm font-semibold text-emerald-800">¡Te uniste al negocio! Cambiando...</p>
        </div>
      )}

      <div className="flex gap-4 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors relative',
            activeTab === 'general' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          General y Análisis IA
          {activeTab === 'general' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors relative',
            activeTab === 'templates' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Plantillas y Respuestas
          {activeTab === 'templates' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors relative',
            activeTab === 'channels' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Canales Conectados
          {activeTab === 'channels' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('memory')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors relative',
            activeTab === 'memory' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Memoria IA
          {activeTab === 'memory' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors relative',
            activeTab === 'services' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Servicios
          {activeTab === 'services' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('booking')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors relative',
            activeTab === 'booking' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Citas Online
          {activeTab === 'booking' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors relative',
            activeTab === 'team' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Equipo
          {activeTab === 'team' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'channels' ? (
        <ChannelsTab />
      ) : activeTab === 'templates' ? (
        <QuickRepliesTab />
      ) : activeTab === 'memory' ? (
        <MemoriesTab />
      ) : activeTab === 'services' ? (
        <ServicesTab />
      ) : activeTab === 'booking' ? (
        <BookingTab />
      ) : activeTab === 'team' ? (
        <TeamTab />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Nombre del Negocio</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Dueno/a</label>
              <input
                type="text"
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Nicho / Industria</label>
            <select
              value={form.nicho}
              onChange={(e) => setForm({ ...form, nicho: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {NICHOS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Telefono</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Horarios de Atencion</label>
            <input
              type="text"
              value={form.working_hours}
              onChange={(e) => setForm({ ...form, working_hours: e.target.value })}
              placeholder='Ej: Lun-Vie 9:00-18:00, Sab 9:00-14:00'
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">Contexto para la IA</label>
              <button
                type="button"
                onClick={() => setShowSetupAssistant(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Configurar con IA
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Describe tu negocio, servicios, precios, etc. La IA usara esta informacion para responder a tus clientes.
            </p>
            <textarea
              value={form.ai_context}
              onChange={(e) => setForm({ ...form, ai_context: e.target.value })}
              rows={5}
              placeholder="Ej: Somos un salon de belleza ubicado en CDMX. Ofrecemos cortes desde $200, tintes desde $500..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ── Train AI with real chats ── */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  Entrenar con chats reales
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pega una exportación de WhatsApp y la IA aprenderá exactamente tu tono, frases y respuestas.
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wide ml-3">
                NUEVO
              </span>
            </div>

            {/* Input area — shown when idle or analyzing */}
            {(trainStatus === 'idle' || trainStatus === 'analyzing') && (
              <>
                <textarea
                  value={chatInput}
                  onChange={(e) => { setChatInput(e.target.value); setChatStats(null); }}
                  rows={5}
                  placeholder={`[25/02/26, 10:30] Juan: cuanto cuesta un envio a Santiago?\n[25/02/26, 10:31] Courier Express: Bro son 300 pesos para Santiago 📦 te lo llevamos hoy\n\n👆 Abre el chat → ⋮ → Exportar chat → Sin archivos`}
                  disabled={trainStatus === 'analyzing'}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-slate-50 placeholder:text-slate-300 disabled:opacity-60"
                />
                <div className="flex items-center justify-between mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={trainStatus === 'analyzing'}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir .txt
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={handleAnalyzeChats}
                    disabled={!chatInput.trim() || trainStatus === 'analyzing'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                  >
                    {trainStatus === 'analyzing' ? (
                      <>
                        <span className="animate-spin inline-block">⏳</span>
                        Analizando conversaciones...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Analizar y aprender
                      </>
                    )}
                  </button>
                </div>
                {chatInput.trim() && trainStatus === 'idle' && (
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {chatInput.trim().length.toLocaleString()} caracteres listos para analizar
                  </p>
                )}
              </>
            )}

            {/* Preview — shown after analysis */}
            {trainStatus === 'preview' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Perfil extraído — revisa antes de aplicar
                </p>
                {chatStats && (
                  <div className="flex gap-3 text-[11px] text-slate-500">
                    <span>📨 {chatStats.total} mensajes</span>
                    <span>🏢 {chatStats.fromBusiness} del negocio</span>
                    <span>👤 {chatStats.fromClients} de clientes</span>
                    {chatStats.detectedBusinessName && (
                      <span className="text-blue-600 font-medium">Negocio: {chatStats.detectedBusinessName}</span>
                    )}
                  </div>
                )}
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-56 overflow-y-auto bg-white rounded border border-blue-100 p-3">
                  {styleProfile}
                </pre>
                <div className="flex items-center gap-3 pt-1 border-t border-blue-100">
                  <label className={cn(
                    "flex items-center gap-1.5 text-xs cursor-pointer flex-1",
                    form.ai_context.trim() ? "text-slate-600" : "text-slate-400 pointer-events-none"
                  )}>
                    <input
                      type="checkbox"
                      checked={mergeMode}
                      onChange={(e) => setMergeMode(e.target.checked)}
                      disabled={!form.ai_context.trim()}
                      className="rounded accent-blue-600"
                    />
                    {form.ai_context.trim()
                      ? 'Fusionar con contexto actual (recomendado)'
                      : 'Reemplazar contexto (no hay contexto previo)'}
                  </label>
                  <button
                    type="button"
                    onClick={handleDiscardProfile}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded"
                  >
                    <X className="w-3 h-3" />
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleUseProfile}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Usar este perfil
                  </button>
                </div>
              </div>
            )}

            {/* Success state */}
            {trainStatus === 'saved' && (
              <div className="flex items-center gap-2 text-sm text-green-600 font-semibold py-2 px-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-4 h-4" />
                ¡IA actualizada! Ya responde exactamente como tú 🎉
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Guardado
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      )}

      {/* AI Logs Section */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-800">Logs de Inteligencia Artificial</h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Últimas 48h</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3">Nicho</th>
                <th className="px-4 py-3">Tokens (I/O)</th>
                <th className="px-4 py-3">Latencia</th>
                <th className="px-4 py-3 text-center">Escalado</th>
                <th className="px-4 py-3 text-right">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!aiLogs || aiLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No hay logs de IA registrados aun del negocio
                  </td>
                </tr>
              ) : (
                aiLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700 capitalize">{log.nicho}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">
                      {log.input_tokens} / {log.output_tokens}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{(log.latency_ms / 1000).toFixed(1)}s</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
                        log.escalated ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"
                      )}>
                        {log.escalated ? "Si" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-right">
                      {formatRelativeTime(log.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="p-3 bg-slate-50/30 text-center border-t border-slate-100">
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">Ver historial completo ➔</button>
          </div>
        </div>
      </div>
    </div >

    {showSetupAssistant && (
      <AISetupAssistant
        onClose={() => {
          setShowSetupAssistant(false);
          window.location.reload();
        }}
      />
    )}
    </>
  );
}

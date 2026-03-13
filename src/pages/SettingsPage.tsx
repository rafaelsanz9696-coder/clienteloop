import { useState, useEffect, useRef } from 'react';
import { Save, CheckCircle2, History, Upload, Sparkles, X, Plus, Trash2, MessageSquare, Mail, Phone, CalendarDays, Edit2, Link, Copy, ExternalLink } from 'lucide-react';
import { cn, formatRelativeTime } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { parseWhatsAppChat, formatChatForAnalysis, getChatStats } from '../lib/chatParser';
import QuickRepliesTab from '../components/settings/QuickRepliesTab';
import MemoriesTab from '../components/settings/MemoriesTab';
import AISetupAssistant from '../components/AISetupAssistant';

const NICHOS = [
  { value: 'salon', label: 'Salón de Belleza / Estética' },
  { value: 'barberia', label: 'Barbería' },
  { value: 'clinica', label: 'Clínica / Consultorio Médico' },
  { value: 'inmobiliaria', label: 'Inmobiliaria / Bienes Raíces' },
  { value: 'restaurante', label: 'Restaurante / Taquería' },
  { value: 'academia', label: 'Academia / Centro Educativo' },
  { value: 'taller', label: 'Taller Mecánico' },
  { value: 'courier', label: 'Courier / Mensajería' },
  { value: 'agencia_ia', label: 'Agencia de IA / Automatización' },
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
  const [newChannel, setNewChannel] = useState('whatsapp');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!newIdentifier.trim()) return;
    setSaving(true);
    try {
      await api.saveChannelNumber({ channel: newChannel, identifier: newIdentifier.trim(), label: newLabel.trim() });
      setNewIdentifier('');
      setNewLabel('');
      setAdding(false);
      refetch();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Intenta de nuevo'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Eliminar este canal?')) return;
    await api.deleteChannelNumber(id);
    refetch();
  }

  const opt = CHANNEL_OPTS.find((c) => c.value === newChannel) ?? CHANNEL_OPTS[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-1">Canales Conectados</h3>
        <p className="text-xs text-slate-400">
          Registra tus numeros de WhatsApp, SMS o emails para recibir mensajes de clientes en el inbox.
        </p>
      </div>

      {/* Existing channels */}
      {channels && channels.length > 0 ? (
        <div className="space-y-2">
          {channels.map((ch: any) => {
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
      ) : (
        <p className="text-sm text-slate-400 py-4 text-center">
          No hay canales configurados. Agrega uno para empezar a recibir mensajes.
        </p>
      )}

      {/* Add form */}
      {adding ? (
        <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CHANNEL_OPTS.map((c) => (
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
          {newChannel === 'whatsapp' && (
            <p className="text-[11px] text-amber-600 col-span-3 -mt-1">
              ⚠ Ingresa el <strong>Phone Number ID</strong> de Meta, no el número de teléfono.
              Lo encuentras en Meta Developer Console → WhatsApp → API Setup.
            </p>
          )}
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
          Agregar canal
        </button>
      )}
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
      resetForm();
      refetch();
    } catch (err: any) { alert('Error: ' + (err.message || 'Intenta de nuevo')); }
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

// ─── Main Settings Page ──────────────────────────────────────────────────────
export default function SettingsPage() {
  const { activeBusinessId } = useBusiness();
  const { data: business, loading } = useApi(() => api.getBusiness(), [activeBusinessId]);
  const { data: aiLogs } = useApi(() => api.getAiLogs(), [activeBusinessId]);
  const [activeTab, setActiveTab] = useState<'general' | 'channels' | 'templates' | 'memory' | 'services' | 'booking'>('general');
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
      alert('El archivo es muy grande. Exporta el chat sin archivos adjuntos (máximo 5 MB).');
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
      alert('Error al analizar los chats: ' + (err.message || 'Intenta de nuevo'));
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
      alert('Error al guardar el perfil: ' + (err.message || 'Intenta de nuevo'));
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

  if (loading) return <LoadingSpinner text="Cargando ajustes..." />;

  return (
    <>
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">Ajustes</h2>
      </div>

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

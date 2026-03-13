import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, CheckCircle2, History, Upload, Sparkles, X, Plus, Trash2, MessageSquare, Mail, Phone, CreditCard, Users, AlertTriangle, ExternalLink, Zap } from 'lucide-react';
import { cn, formatRelativeTime } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { parseWhatsAppChat, formatChatForAnalysis, getChatStats } from '../lib/chatParser';
import QuickRepliesTab from '../components/settings/QuickRepliesTab';

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
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, placeholder: '+521234567890' },
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

// ─── Billing Tab ─────────────────────────────────────────────────────────────
function BillingTab() {
  const { data: sub, loading, refetch } = useApi(() => api.getBillingSubscription(), []);
  const [seats, setSeats] = useState(3);
  const [seatsBusy, setSeatsBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    if (sub) setSeats(sub.seats);
  }, [sub]);

  async function handleCheckout() {
    setCheckoutBusy(true);
    try {
      const { url } = await api.createCheckoutSession(seats);
      window.location.href = url!;
    } catch (err: any) {
      alert('Error al abrir el checkout: ' + err.message);
      setCheckoutBusy(false);
    }
  }

  async function handlePortal() {
    setPortalBusy(true);
    try {
      const { url } = await api.createBillingPortal();
      window.location.href = url!;
    } catch (err: any) {
      alert('Error al abrir el portal: ' + err.message);
      setPortalBusy(false);
    }
  }

  async function handleUpdateSeats() {
    setSeatsBusy(true);
    try {
      await api.updateBillingSeats(seats);
      refetch();
    } catch (err: any) {
      alert('Error al actualizar seats: ' + err.message);
    } finally {
      setSeatsBusy(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Cargando info de facturación...</div>;

  const isActive = sub?.status === 'active';
  const isPastDue = sub?.status === 'past_due';
  const isCanceled = sub?.status === 'canceled' || sub?.status === 'inactive';
  const totalDisplay = sub ? `$${(sub.monthly_total_cents / 100).toFixed(0)}/mes` : '$100/mes';

  return (
    <div className="space-y-5">
      {/* Current Plan Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              ClienteLoop Pro
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">IA agéntica incluida · $100/mes base + $20/seat extra</p>
          </div>
          {isActive && (
            <span className="text-[10px] font-bold bg-green-100 text-green-600 px-2 py-0.5 rounded-full uppercase tracking-wide">Activo</span>
          )}
          {isPastDue && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Pago pendiente
            </span>
          )}
          {isCanceled && (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wide">Sin suscripción</span>
          )}
        </div>

        {/* Billing summary */}
        <div className="grid grid-cols-3 gap-3 py-4 border-y border-slate-100 mb-4">
          <div className="text-center">
            <p className="text-lg font-bold text-slate-800">{totalDisplay}</p>
            <p className="text-[11px] text-slate-400">Total mensual</p>
          </div>
          <div className="text-center border-x border-slate-100">
            <p className="text-lg font-bold text-slate-800">{sub?.seats ?? 3}</p>
            <p className="text-[11px] text-slate-400">Seats activos</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-800">{sub?.extra_seats ?? 0}</p>
            <p className="text-[11px] text-slate-400">Seats extra (+$20/c.u.)</p>
          </div>
        </div>

        {/* Period info */}
        {sub?.period_end && (
          <p className="text-xs text-slate-400 mb-4">
            Próximo cobro: <span className="text-slate-600 font-medium">{new Date(sub.period_end).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </p>
        )}

        {/* Actions */}
        {isActive || isPastDue ? (
          <button
            onClick={handlePortal}
            disabled={portalBusy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {portalBusy ? 'Abriendo portal...' : 'Gestionar suscripción'}
          </button>
        ) : (
          <button
            onClick={handleCheckout}
            disabled={checkoutBusy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            {checkoutBusy ? 'Redirigiendo...' : 'Suscribirse — $100/mes'}
          </button>
        )}
      </div>

      {/* Seat Manager (only if active) */}
      {isActive && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            Gestión de Empleados (Seats)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Los primeros 3 seats están incluidos en el plan base. Cada seat adicional cuesta $20/mes.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSeats((s) => Math.max(3, s - 1))}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-lg flex items-center justify-center transition-colors"
              >
                −
              </button>
              <span className="text-xl font-bold text-slate-800 w-8 text-center">{seats}</span>
              <button
                onClick={() => setSeats((s) => s + 1)}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-lg flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500">
                {seats <= 3
                  ? '3 seats incluidos (sin costo extra)'
                  : `3 incluidos + ${seats - 3} extras × $20 = +$${(seats - 3) * 20}/mes`}
              </p>
            </div>
            <button
              onClick={handleUpdateSeats}
              disabled={seatsBusy || seats === (sub?.seats ?? 3)}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {seatsBusy ? 'Actualizando...' : 'Aplicar cambio'}
            </button>
          </div>
        </div>
      )}

      {/* Pricing breakdown */}
      {isCanceled && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-3">¿Qué incluye el plan?</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {[
              'IA agéntica para respuesta automática de clientes',
              'Inbox multicanal (WhatsApp, Instagram, SMS)',
              'CRM completo: contactos, pipeline, tareas',
              'Dashboard y métricas en tiempo real',
              '3 seats incluidos (empleados)',
              'Soporte por WhatsApp',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
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
  const [activeTab, setActiveTab] = useState<'general' | 'channels' | 'templates' | 'billing'>(() => {
    const tab = searchParams.get('tab');
    return (tab === 'billing' || tab === 'channels' || tab === 'templates') ? tab : 'general';
  });
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
          onClick={() => setActiveTab('billing')}
          className={cn(
            'pb-3 text-sm font-medium transition-colors relative flex items-center gap-1.5',
            activeTab === 'billing' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Facturación
          {activeTab === 'billing' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'billing' ? (
        <BillingTab />
      ) : activeTab === 'channels' ? (
        <ChannelsTab />
      ) : activeTab === 'templates' ? (
        <QuickRepliesTab />
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
            <label className="text-sm font-medium text-slate-700 mb-1 block">Contexto para la IA</label>
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
  );
}

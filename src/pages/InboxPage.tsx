import { useState, useEffect, useRef } from 'react';
import { toast } from '../lib/toast';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Phone,
  Mail,
  Globe,
  Search,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  Wand2,
  Zap,
  X,
  User,
  Tag,
  Clock,
  CheckCircle2,
  Calendar,
  FileText,
  MapPin,
  Paperclip,
} from 'lucide-react';
import { cn, formatRelativeTime, getChannelColor, getChannelLabel, getStageLabel, getStageColor } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import { useSocket } from '../contexts/SocketContext';
import type { Conversation, Message, Contact, QuickReply } from '../types/index';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorBoundary from '../components/ui/ErrorBoundary';

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  switch (channel) {
    case 'whatsapp':
      return <Phone className={cn('w-4 h-4', className)} />;
    case 'instagram':
      return <Globe className={cn('w-4 h-4', className)} />;
    case 'email':
      return <Mail className={cn('w-4 h-4', className)} />;
    default:
      return <MessageSquare className={cn('w-4 h-4', className)} />;
  }
}

// ─── Intent helpers ───────────────────────────────────────────────────────────
const INTENT_COLORS: Record<string, string> = {
  'compra shein':          'bg-emerald-100 text-emerald-700',
  'shein':                 'bg-emerald-100 text-emerald-700',
  'envío local':           'bg-blue-100 text-blue-700',
  'envio local':           'bg-blue-100 text-blue-700',
  'envío internacional':   'bg-orange-100 text-orange-700',
  'envio internacional':   'bg-orange-100 text-orange-700',
  'personal shopper':      'bg-purple-100 text-purple-700',
  'reserva cita':          'bg-pink-100 text-pink-700',
  'consulta precio':       'bg-yellow-100 text-yellow-700',
  'problema entrega':      'bg-red-100 text-red-700',
};

function getIntentColor(label: string): string {
  const key = label.toLowerCase();
  return INTENT_COLORS[key] || 'bg-slate-100 text-slate-600';
}

function IntentBadge({ label, small = false }: { label: string; small?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium',
        small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        getIntentColor(label),
      )}
    >
      {label}
    </span>
  );
}

// ─── Nicho-aware intent presets ───────────────────────────────────────────────
const INTENT_PRESETS: Record<string, string[]> = {
  salon: [
    'Reserva cita', 'Corte de cabello', 'Tinte / Color', 'Manicura / Uñas',
    'Depilación', 'Tratamiento capilar', 'Precio servicio', 'Información general',
  ],
  barberia: [
    'Reserva cita', 'Corte clásico', 'Arreglo de barba', 'Fade / Degradado',
    'Precio servicio', 'Horario disponible', 'Servicios combo', 'Información general',
  ],
  clinica: [
    'Agendar consulta', 'Resultado de examen', 'Seguimiento paciente', 'Urgencia médica',
    'Precio consulta', 'Especialista disponible', 'Historia clínica', 'Información general',
  ],
  inmobiliaria: [
    'Comprar propiedad', 'Rentar propiedad', 'Precio / Valuación', 'Visita inmueble',
    'Documentación requerida', 'Financiamiento', 'Inversión', 'Información general',
  ],
  restaurante: [
    'Reserva mesa', 'Pedido delivery', 'Menú del día', 'Precio platillo',
    'Evento / Catering', 'Horario apertura', 'Domicilio disponible', 'Información general',
  ],
  academia: [
    'Información curso', 'Inscripción', 'Horarios clase', 'Precio / Beca',
    'Certificación', 'Duda académica', 'Modalidad online', 'Información general',
  ],
  taller: [
    'Diagnóstico vehículo', 'Cotización reparación', 'Cambio aceite / Filtros', 'Cita taller',
    'Garantía servicio', 'Recogida a domicilio', 'Refacciones', 'Información general',
  ],
  courier: [
    'Compra Shein', 'Envío local', 'Envío internacional', 'Personal shopper',
    'Rastrear paquete', 'Cotización envío', 'Problema entrega', 'Información general',
  ],
  agencia_ia: [
    'Cotización proyecto', 'Demo plataforma', 'Integración CRM', 'Automatización',
    'Soporte técnico', 'Consultoría IA', 'Plan y precios', 'Información general',
  ],
};

const DEFAULT_INTENT_PRESETS = [
  'Consulta precio', 'Reserva / Cita', 'Soporte', 'Compra / Pedido',
  'Problema / Queja', 'Información general',
];

// ─── Intent Selector (dropdown for setting intent) ────────────────────────────
function IntentSelector({
  conversationId,
  currentIntent,
  onIntentChange,
}: {
  conversationId: number;
  currentIntent: string | null | undefined;
  onIntentChange: (label: string | null) => void;
}) {
  const { activeBusiness } = useBusiness();
  const [open, setOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const nicho = activeBusiness?.nicho ?? 'general';
  const QUICK_LABELS = INTENT_PRESETS[nicho] ?? DEFAULT_INTENT_PRESETS;

  async function handleAutoDetect() {
    setDetecting(true);
    setOpen(false);
    try {
      const result = await api.detectConversationIntent(conversationId);
      onIntentChange(result.intent_label);
    } catch (err) {
      console.error('detect-intent failed:', err);
    } finally {
      setDetecting(false);
    }
  }

  async function handleSet(label: string | null) {
    setOpen(false);
    try {
      await api.setConversationIntent(conversationId, label);
      onIntentChange(label);
    } catch (err) {
      console.error('set-intent failed:', err);
    }
  }

  async function handleCustomSubmit() {
    if (!customInput.trim()) return;
    await handleSet(customInput.trim());
    setCustomInput('');
    setShowCustom(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={detecting}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-colors',
          detecting
            ? 'animate-pulse bg-purple-50 border-purple-200 text-purple-400'
            : currentIntent
              ? cn('border-transparent', getIntentColor(currentIntent))
              : 'border-slate-200 text-slate-500 hover:bg-slate-50',
        )}
        title="Clasificar intención del lead"
      >
        {detecting ? (
          <><Wand2 className="w-3 h-3" /> Detectando...</>
        ) : currentIntent ? (
          <>{currentIntent} <ChevronDown className="w-3 h-3 opacity-60" /></>
        ) : (
          <><Tag className="w-3 h-3" /> Clasificar lead</>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg w-52 overflow-hidden">
            {/* AI auto-detect */}
            <button
              onClick={handleAutoDetect}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-purple-600 hover:bg-purple-50 border-b border-slate-100 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Detectar con IA
            </button>

            {/* Quick labels */}
            <div className="py-1 max-h-52 overflow-y-auto">
              {QUICK_LABELS.map((label) => (
                <button
                  key={label}
                  onClick={() => handleSet(label)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors flex items-center justify-between',
                    currentIntent?.toLowerCase() === label.toLowerCase() && 'font-bold text-blue-600',
                  )}
                >
                  <IntentBadge label={label} small />
                  {currentIntent?.toLowerCase() === label.toLowerCase() && (
                    <CheckCircle2 className="w-3 h-3 text-blue-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Custom label */}
            {showCustom ? (
              <div className="p-2 border-t border-slate-100 flex gap-1">
                <input
                  autoFocus
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                  placeholder="Ej: Consulta devolución"
                  className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={handleCustomSubmit} className="px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium">
                  OK
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustom(true)}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 border-t border-slate-100 transition-colors"
              >
                + Etiqueta personalizada
              </button>
            )}

            {/* Clear */}
            {currentIntent && (
              <button
                onClick={() => handleSet(null)}
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-50 border-t border-slate-100 transition-colors"
              >
                Quitar etiqueta
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Conversation List
function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  intentFilter,
  onIntentFilterChange,
}: {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  filter: string;
  onFilterChange: (f: string) => void;
  intentFilter: string;
  onIntentFilterChange: (f: string) => void;
}) {
  const [search, setSearch] = useState('');

  // Collect unique intent labels present in the list
  const intentLabels = Array.from(
    new Set(conversations.map((c) => c.intent_label).filter(Boolean) as string[])
  ).sort();

  const filtered = conversations.filter((c) => {
    const matchSearch =
      !search ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.last_message?.toLowerCase().includes(search.toLowerCase());
    const matchIntent =
      !intentFilter ||
      (c.intent_label?.toLowerCase() === intentFilter.toLowerCase());
    return matchSearch && matchIntent;
  });

  return (
    <div className="flex flex-col h-full border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <h2 className="font-bold text-slate-800 mb-3">Conversaciones</h2>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { key: 'all',      label: 'Todos' },
            { key: 'open',     label: 'Abiertos' },
            { key: 'resolved', label: 'Resueltos' },
            { key: 'followup', label: '🕐 Seguimiento' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { onFilterChange(key); onIntentFilterChange(''); }}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                filter === key
                  ? key === 'followup'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                  : 'text-slate-500 hover:bg-slate-100'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Intent filter chips — only shown when there are labeled conversations */}
        {intentLabels.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2">
            {intentFilter && (
              <button
                onClick={() => onIntentFilterChange('')}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
              >
                <X className="w-2.5 h-2.5" /> Limpiar
              </button>
            )}
            {intentLabels.map((label) => (
              <button
                key={label}
                onClick={() => onIntentFilterChange(intentFilter === label ? '' : label)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-semibold rounded-full transition-colors',
                  intentFilter === label
                    ? getIntentColor(label) + ' ring-1 ring-current'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-slate-400">
            <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium text-slate-500">Sin conversaciones</p>
            <p className="text-xs mt-1">Los mensajes entrantes aparecerán aquí</p>
          </div>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                'w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors',
                selectedId === conv.id && 'bg-blue-50 hover:bg-blue-50'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
                  {conv.contact_name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-sm text-slate-800 truncate">
                      {conv.contact_name || 'Sin nombre'}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                      {formatRelativeTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                        getChannelColor(conv.channel)
                      )}
                    >
                      <ChannelIcon channel={conv.channel} className="w-3 h-3" />
                      {getChannelLabel(conv.channel)}
                    </span>
                    {conv.intent_label && (
                      <IntentBadge label={conv.intent_label} small />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{conv.last_message}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {conv.unread_count > 0 && (
                    <span className="bg-blue-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {conv.unread_count}
                    </span>
                  )}
                  {filter === 'followup' && (conv as any).hours_since_last != null && (
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                      <Clock className="w-2.5 h-2.5" />
                      {(conv as any).hours_since_last >= 24
                        ? `${Math.floor((conv as any).hours_since_last / 24)}d`
                        : `${Math.floor((conv as any).hours_since_last)}h`}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Media renderer inside a bubble ─────────────────────────────────────────
function MediaContent({
  message,
  onExpandImage,
}: {
  message: Message;
  onExpandImage: (url: string) => void;
}) {
  const { media_type, media_url, media_mime, media_name, media_caption,
    location_lat, location_lng, location_name } = message;

  if (!media_type || !media_type) return <p className="whitespace-pre-wrap">{message.content}</p>;

  switch (media_type) {
    case 'image':
    case 'sticker':
      return (
        <div>
          <img
            src={media_url!}
            alt={media_caption || 'imagen'}
            className="rounded-xl max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onExpandImage(media_url!)}
          />
          {media_caption && <p className="text-sm mt-1.5">{media_caption}</p>}
        </div>
      );

    case 'video':
      return (
        <div>
          <video controls className="rounded-xl max-w-full max-h-48" preload="metadata">
            <source src={media_url!} type={media_mime || 'video/mp4'} />
          </video>
          {media_caption && <p className="text-sm mt-1.5">{media_caption}</p>}
        </div>
      );

    case 'audio':
      return (
        <audio controls className="w-full min-w-[200px]">
          <source src={media_url!} type={media_mime || 'audio/ogg'} />
        </audio>
      );

    case 'document':
      return (
        <a
          href={media_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-[180px]">{media_name || 'documento'}</span>
        </a>
      );

    case 'location':
      return (
        <a
          href={`https://www.google.com/maps?q=${location_lat},${location_lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span>{location_name || `${location_lat?.toFixed(5)}, ${location_lng?.toFixed(5)}`}</span>
        </a>
      );

    default:
      return <p className="whitespace-pre-wrap">{message.content}</p>;
  }
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  message,
  onExpandImage,
}: {
  message: Message;
  onExpandImage: (url: string) => void;
}) {
  const isClient = message.sender === 'client';
  return (
    <div className={cn('flex mb-3', isClient ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm',
          isClient
            ? 'bg-slate-100 text-slate-800 rounded-bl-md'
            : message.is_ai_generated
              ? 'bg-purple-500 text-white rounded-br-md'
              : 'bg-blue-500 text-white rounded-br-md'
        )}
      >
        {message.is_ai_generated === 1 && (
          <div className="flex items-center gap-1 mb-1 opacity-80">
            <Sparkles className="w-3 h-3" />
            <span className="text-[10px] font-medium">IA</span>
          </div>
        )}
        <MediaContent message={message} onExpandImage={onExpandImage} />
        <p
          className={cn(
            'text-[10px] mt-1',
            isClient ? 'text-slate-400' : 'text-white/60'
          )}
        >
          {formatRelativeTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

// Helpers
function injectVariables(text: string, contact: any): string {
  if (!contact) return text;
  return text
    .replace(/\{\{nombre\}\}/g, contact.name || 'Cliente')
    .replace(/\{\{canal\}\}/g, contact.channel || 'chat')
    .replace(/\{\{etapa\}\}/g, contact.stage || 'nuevo');
}

// Conversation Thread
function ConversationThread({
  conversationId,
  onBack,
}: {
  conversationId: number;
  onBack: () => void;
}) {
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEscalate, setAiEscalate] = useState(false);
  const [taskExtracting, setTaskExtracting] = useState(false);
  const [intentLabel, setIntentLabel] = useState<string | null | undefined>(undefined);
  const [followupGenerating, setFollowupGenerating] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversation } = useApi(
    () => api.getConversation(conversationId),
    [conversationId]
  );

  // Sync intent from loaded conversation
  useEffect(() => {
    if (conversation) {
      setIntentLabel(conversation.intent_label ?? null);
    }
  }, [conversation]);
  const {
    data: messages,
    loading: messagesLoading,
    refetch: refetchMessages,
  } = useApi(() => api.getMessages(conversationId), [conversationId]);
  const { data: quickReplies } = useApi(() => api.getQuickReplies(), []);
  const { socket, refetchUnread } = useSocket();

  // Handle incoming websocket messages for this specific conversation thread
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (payload: { conversation_id: number; message: Message }) => {
      if (payload.conversation_id === conversationId) {
        // We know we are inside this conversation, add it to the list
        // Note: useApi does not expose a raw mutate, so we will trigger a refetch for simplicity,
        // or we could manage a local copy. For a robust app, a local copy is better.
        // But since we have refetch:
        refetchMessages();
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, conversationId, refetchMessages]);

  useEffect(() => {
    api.markConversationRead(conversationId).then(() => {
      refetchUnread(); // Refresh global unread badge after marking read
    }).catch(() => {
      // Non-critical, ignore errors silently
    });
  }, [conversationId, refetchUnread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!messageText.trim() || sending) return;
    setSending(true);
    try {
      await api.sendMessage({
        conversation_id: conversationId,
        content: messageText.trim(),
        sender: 'agent',
      });
      setMessageText('');
      refetchMessages();
    } finally {
      setSending(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // allow re-selecting same file
    setUploadingMedia(true);
    try {
      const { url, name, mime } = await api.uploadMedia(file);
      const mediaType = mime.startsWith('image/') ? 'image'
        : mime.startsWith('video/') ? 'video'
        : mime.startsWith('audio/') ? 'audio'
        : 'document';
      const content = mediaType === 'document' ? `[documento: ${name}]` : `[${mediaType}]`;
      await api.sendMediaMessage({
        conversation_id: conversationId,
        content,
        media_type: mediaType,
        media_url: url,
        media_mime: mime,
        media_name: mediaType === 'document' ? name : undefined,
        sender: 'agent',
      });
      refetchMessages();
    } catch (err) {
      console.error('[Media Send]', err);
      toast.error('Error al enviar el archivo. Intenta de nuevo.');
    } finally {
      setUploadingMedia(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function insertQuickReply(qr: QuickReply) {
    const content = injectVariables(qr.content, contact);
    setMessageText(content);
    setAiEscalate(false);
    setShowQuickReplies(false);
  }

  async function handleAiSuggest(tone?: 'corto' | 'formal' | 'persuasivo') {
    if (aiLoading) return;
    setAiLoading(true);
    setAiSuggestion(null);
    setAiEscalate(false);
    try {
      const result = await api.getAiSuggestion({
        conversation_id: conversationId,
        tone
      });
      if (result.escalate) {
        setAiEscalate(true);
      } else if (result.suggestion) {
        setAiSuggestion(result.suggestion);
      }
    } catch (err) {
      console.error('AI suggestion failed:', err);
    } finally {
      setAiLoading(false);
    }
  }

  function useAiSuggestion() {
    if (aiSuggestion) {
      const content = injectVariables(aiSuggestion, contact);
      setMessageText(content);
      setAiSuggestion(null);
    }
  }

  function dismissAiSuggestion() {
    setAiSuggestion(null);
    setAiEscalate(false);
  }

  async function handleGenerateFollowup() {
    if (followupGenerating) return;
    setFollowupGenerating(true);
    try {
      const result = await api.generateFollowupMessage(conversationId);
      if (result.suggestion) {
        setMessageText(result.suggestion);
        setAiSuggestion(null);
      }
    } catch (err) {
      console.error('generate-followup failed:', err);
    } finally {
      setFollowupGenerating(false);
    }
  }

  async function handleExtractTask() {
    if (taskExtracting) return;
    setTaskExtracting(true);
    try {
      const task = await api.extractAiTask(conversationId);
      if (task && task.confidence > 0.6) {
        if (confirm(`¿Deseas crear esta tarea automáticamente?\n\n"${task.title}"`)) {
          await api.createTask({
            contact_id: conversation?.contact_id,
            title: task.title,
            due_time: task.due_time || undefined
          });
          toast.success('Tarea creada con éxito');
        }
      } else {
        toast.info('No se detectó ninguna tarea clara en los últimos mensajes.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al extraer tarea.');
    } finally {
      setTaskExtracting(false);
    }
  }

  const contact = conversation
    ? {
      name: conversation.contact_name,
      phone: conversation.contact_phone,
      channel: conversation.contact_channel || conversation.channel,
      stage: conversation.pipeline_stage,
      notes: conversation.contact_notes,
    }
    : null;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <button onClick={onBack} className="lg:hidden text-slate-500 hover:text-slate-700">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm font-bold text-slate-500">
          {contact?.name?.charAt(0) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 truncate">{contact?.name}</h3>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                getChannelColor(contact?.channel || '')
              )}
            >
              {getChannelLabel(contact?.channel || '')}
            </span>
            {contact?.stage && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                  getStageColor(contact.stage)
                )}
              >
                {getStageLabel(contact.stage)}
              </span>
            )}
          </div>
        </div>
        <IntentSelector
          conversationId={conversationId}
          currentIntent={intentLabel}
          onIntentChange={setIntentLabel}
        />
        <button
          onClick={handleGenerateFollowup}
          disabled={followupGenerating}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-colors",
            followupGenerating
              ? "bg-amber-50 border-amber-200 text-amber-400 animate-pulse"
              : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
          )}
          title="Generar mensaje de seguimiento con IA"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {followupGenerating ? 'Generando...' : 'Seguimiento IA'}
        </button>
        <button
          onClick={handleExtractTask}
          disabled={taskExtracting}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold uppercase tracking-wider transition-colors",
            taskExtracting
              ? "bg-slate-50 text-slate-400"
              : "bg-white text-slate-600 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200"
          )}
        >
          <Calendar className="w-3.5 h-3.5" />
          {taskExtracting ? 'Analizando...' : 'Extraer Tarea'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messagesLoading ? (
          <LoadingSpinner />
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onExpandImage={setLightboxUrl} />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <p className="text-sm text-slate-400 text-center py-8">
            Sin mensajes aun
          </p>
        )}
      </div>

      {/* Quick replies dropdown */}
      {showQuickReplies && quickReplies && quickReplies.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 max-h-48 overflow-y-auto">
          {quickReplies.map((qr) => (
            <button
              key={qr.id}
              onClick={() => insertQuickReply(qr)}
              className="w-full text-left px-4 py-2.5 hover:bg-white border-b border-slate-100 last:border-0"
            >
              <span className="text-xs font-medium text-blue-600">{qr.title}</span>
              <p className="text-xs text-slate-500 truncate mt-0.5">{qr.content}</p>
            </button>
          ))}
        </div>
      )}

      {/* AI Suggestion */}
      {(aiSuggestion || aiEscalate) && (
        <div className="mx-3 mt-2 p-3 rounded-xl border border-purple-200 bg-purple-50">
          {aiEscalate ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-amber-700 font-medium">
                Este mensaje requiere atencion humana. Considera asignarlo a un miembro del equipo.
              </span>
              <button onClick={dismissAiSuggestion} className="text-slate-400 hover:text-slate-600 ml-auto shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-medium text-purple-600">Sugerencia IA</span>
                <button onClick={dismissAiSuggestion} className="text-slate-400 hover:text-slate-600 ml-auto shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-700 mb-2">{aiSuggestion}</p>
              <div className="flex gap-2">
                <button
                  onClick={useAiSuggestion}
                  className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                >
                  Insertar respuesta
                </button>
                <button
                  onClick={dismissAiSuggestion}
                  className="px-3 py-1.5 text-xs font-medium bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Descartar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className={cn(
              'p-2 rounded-lg transition-colors shrink-0',
              showQuickReplies
                ? 'bg-amber-100 text-amber-600'
                : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
            )}
            title="Respuestas rapidas"
          >
            <Zap className="w-5 h-5" />
          </button>
          <div className="relative group">
            <button
              disabled={aiLoading}
              className={cn(
                'p-2 rounded-lg transition-colors shrink-0',
                aiLoading
                  ? 'bg-purple-100 text-purple-400 animate-pulse'
                  : 'text-slate-400 hover:text-purple-500 hover:bg-purple-50'
              )}
              title="Sugerencia IA"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl p-1 z-10 w-40">
              <button
                onClick={() => handleAiSuggest()}
                className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 rounded-lg flex items-center gap-2"
              >
                <Sparkles className="w-3 h-3 text-purple-500" /> General
              </button>
              <button
                onClick={() => handleAiSuggest('corto')}
                className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 rounded-lg"
              >
                ⚡ Corto y Directo
              </button>
              <button
                onClick={() => handleAiSuggest('formal')}
                className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 rounded-lg"
              >
                👔 Profesional
              </button>
              <button
                onClick={() => handleAiSuggest('persuasivo')}
                className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 rounded-lg"
              >
                💰 Persuasivo / Venta
              </button>
            </div>
          </div>

          {/* Hidden file input for media uploads */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
          />
          {/* Paperclip button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingMedia}
            title="Adjuntar archivo"
            className={cn(
              'p-2 rounded-lg transition-colors shrink-0',
              uploadingMedia
                ? 'bg-blue-100 text-blue-400 animate-pulse cursor-not-allowed'
                : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'
            )}
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || sending}
            className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-2 flex justify-center">
          <button
            onClick={async () => {
              // Simulate incoming message via API (requires a new endpoint or using the mock adapter directly)
              // For simplicity and to not break "delicate" backend, we'll just log it 
              // but since user wants Extra Polish, let's add a test endpoint in routes/messages.ts
              try {
                await api.sendMessage({
                  conversation_id: conversationId,
                  content: "Hola, me gustaría pedir informes de sus servicios por favor.",
                  sender: 'client'
                });
                refetchMessages();
              } catch (e) {
                console.error(e);
              }
            }}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-blue-500 transition-colors"
          >
            • Simular Mensaje Entrante •
          </button>
        </div>
      </div>

      {/* Lightbox overlay for images */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-1 hover:bg-black/60 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  );
}

// Main Inbox Page
export default function InboxPage() {
  const { activeBusinessId } = useBusiness();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [intentFilter, setIntentFilter] = useState('');

  const { data: conversations, loading, refetch: refetchConversations } = useApi(
    () =>
      filter === 'followup'
        ? api.getFollowUpConversations()
        : filter === 'all'
          ? api.getConversations()
          : api.getConversations({ status: filter }),
    [filter, activeBusinessId]
  );

  const { socket } = useSocket();

  // Handle incoming websocket messages for the conversation list
  useEffect(() => {
    if (!socket) return;

    const handleNewMessageList = (_payload: { conversation_id: number; message: Message }) => {
      // Something changed, let's just refetch the list so it order correctly and updates unread count
      refetchConversations();
    };

    socket.on('new_message', handleNewMessageList);
    return () => {
      socket.off('new_message', handleNewMessageList);
    };
  }, [socket, refetchConversations]);

  const selectedId = conversationId ? Number(conversationId) : null;

  function handleSelect(id: number) {
    navigate(`/app/inbox/${id}`);
  }

  if (loading) return <LoadingSpinner text="Cargando conversaciones..." />;

  return (
    <div className="flex h-full">
      {/* List - hidden on mobile when conversation selected */}
      <div
        className={cn(
          'w-full lg:w-96 shrink-0',
          selectedId ? 'hidden lg:block' : 'block'
        )}
      >
        <ConversationList
          conversations={conversations || []}
          selectedId={selectedId}
          onSelect={handleSelect}
          filter={filter}
          onFilterChange={setFilter}
          intentFilter={intentFilter}
          onIntentFilterChange={setIntentFilter}
        />
      </div>

      {/* Thread */}
      <div className={cn('flex-1', !selectedId ? 'hidden lg:flex' : 'flex')}>
        {selectedId ? (
          <div className="flex-1">
            <ErrorBoundary>
              <ConversationThread
                key={selectedId}
                conversationId={selectedId}
                onBack={() => navigate('/app/inbox')}
              />
            </ErrorBoundary>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Selecciona una conversacion para comenzar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

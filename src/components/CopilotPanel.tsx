/**
 * CopilotPanel.tsx — AI Copilot Flotante
 *
 * Floating button (bottom-right) + slide-in panel that lets the business
 * owner operate the CRM via natural language using Anthropic tool use.
 */

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

/** Renders **bold** markdown without adding external deps */
function renderMarkdown(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}
import { Bot, X, Send, Loader2, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useBusiness } from '../contexts/BusinessContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  isThinking?: boolean;
}

interface PendingAction {
  action: 'create_task' | 'create_quick_reply' | 'update_ai_context' | 'create_contact' | 'compose_followup' | 'move_contact_stage';
  data: {
    // create_task
    title?: string;
    contact_name?: string;
    due_time?: string | null;
    // create_quick_reply
    content?: string;
    category?: string;
    // update_ai_context
    preview?: string;
    mode?: 'replace' | 'append';
    new_context?: string;
    // create_contact (title = contact name)
    phone?: string;
    channel?: string;
    // compose_followup
    conversation_id?: number;
    message?: string;
    // move_contact_stage
    contact_id?: number;
    new_stage?: string;
  };
  requiresConfirm: boolean;
}

// Human-readable labels for each tool — shown in the thinking indicator
const TOOL_LABELS: Record<string, string> = {
  get_stats: 'estadísticas',
  get_contacts: 'contactos',
  get_pending_followups: 'seguimientos pendientes',
  get_pipeline_summary: 'el pipeline',
  search_conversations: 'conversaciones',
  create_task: 'nueva tarea',
  move_contact_stage: 'el pipeline',
  create_quick_reply: 'plantillas',
  update_ai_context: 'contexto IA',
  add_memory: 'memoria',
  create_contact: 'contactos',
  compose_followup: 'historial de mensajes',
};

const NICHO_QUICK_PROMPTS: Record<string, string[]> = {
  courier: [
    '¿Cuántos leads nuevos tengo hoy?',
    '¿Quién no ha respondido en 3 días?',
    'Crea respuesta rápida para cotización Shein',
    'Genera seguimiento para un cliente silencioso',
  ],
  salon: [
    '¿Cuántas citas tengo esta semana?',
    '¿Quién no ha respondido en 3 días?',
    'Crea respuesta rápida para reserva de cita',
    'Resumen del pipeline de leads',
  ],
  barberia: [
    '¿Cuántos leads nuevos esta semana?',
    'Lista clientes sin respuesta hace 2 días',
    'Crea respuesta rápida para precios de corte',
    'Mueve a "en proceso" los leads nuevos activos',
  ],
  clinica: [
    '¿Cuántas consultas agendadas hoy?',
    '¿Quién no ha confirmado su cita?',
    'Crea respuesta rápida para agendar consulta',
    'Resumen de leads por etapa',
  ],
  inmobiliaria: [
    '¿Cuántos prospectos tengo en proceso?',
    'Lista leads sin respuesta hace 3 días',
    'Crea respuesta rápida para visita a propiedad',
    '¿Cuál es el deal más valioso del pipeline?',
  ],
  restaurante: [
    '¿Cuántas reservas tengo hoy?',
    '¿Quién no ha confirmado su reserva?',
    'Crea respuesta rápida para pedidos a domicilio',
    'Resumen de conversaciones abiertas',
  ],
  academia: [
    '¿Cuántos leads de inscripción tengo?',
    'Lista interesados sin respuesta hace 2 días',
    'Crea respuesta rápida con info del curso',
    'Mueve leads que confirmaron a "en proceso"',
  ],
  taller: [
    '¿Cuántos diagnósticos pendientes tengo?',
    '¿Quién no ha respondido la cotización?',
    'Crea respuesta rápida para cotizaciones',
    'Genera seguimiento para cliente con cotización enviada',
  ],
  agencia_ia: [
    '¿Cuántos prospectos nuevos esta semana?',
    'Lista demos pendientes de seguimiento',
    'Crea respuesta rápida para cotización de proyecto',
    '¿Cuál es el deal más valioso en proceso?',
  ],
};

const DEFAULT_QUICK_PROMPTS = [
  '¿Cuántos leads nuevos tengo hoy?',
  '¿Quién no me ha respondido en 3 días?',
  'Resumen del pipeline esta semana',
  'Genera seguimiento para un cliente silencioso',
];

export default function CopilotPanel() {
  const { activeBusiness } = useBusiness();
  const QUICK_PROMPTS = NICHO_QUICK_PROMPTS[activeBusiness?.nicho ?? ''] ?? DEFAULT_QUICK_PROMPTS;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];

    setMessages([...newMessages, { role: 'assistant', content: '', isThinking: true }]);
    setInput('');
    setLoading(true);
    setCurrentTool(null);
    setPendingAction(null);
    setConfirmDone(false);

    const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));

    try {
      await api.copilotStream(apiMessages, {
        onToolStart: (name) => {
          setCurrentTool(name);
        },

        onDelta: (deltaText) => {
          // First delta: remove thinking placeholder and start building the message
          setCurrentTool(null);
          setMessages((prev) => {
            const msgs = prev.filter((m) => !m.isThinking);
            const last = msgs[msgs.length - 1];
            if (last?.role === 'assistant') {
              return [...msgs.slice(0, -1), { ...last, content: last.content + deltaText }];
            }
            return [...msgs, { role: 'assistant', content: deltaText }];
          });
        },

        onDone: ({ toolsUsed, pendingAction: pa, reply }) => {
          // Attach toolsUsed badge to the last assistant message
          // Also handle edge case where no delta was received (pure tool-action responses)
          setMessages((prev) => {
            const msgs = prev.filter((m) => !m.isThinking);
            const last = msgs[msgs.length - 1];
            if (last?.role === 'assistant' && (last.content || reply)) {
              return [
                ...msgs.slice(0, -1),
                {
                  ...last,
                  content: last.content || reply,
                  toolsUsed: toolsUsed?.length ? toolsUsed : undefined,
                },
              ];
            }
            // Fallback: no text streamed yet
            return [
              ...msgs,
              { role: 'assistant', content: reply || '✅ Listo.', toolsUsed: toolsUsed?.length ? toolsUsed : undefined },
            ];
          });
          if (pa) setPendingAction(pa);
          if (!isOpen) setHasUnread(true);
          setCurrentTool(null);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 100);
        },

        onError: (message) => {
          setMessages((prev) => {
            const msgs = prev.filter((m) => !m.isThinking);
            return [...msgs, { role: 'assistant', content: `❌ Error: ${message}` }];
          });
          setCurrentTool(null);
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 100);
        },
      });
    } catch (err: any) {
      setMessages((prev) => {
        const msgs = prev.filter((m) => !m.isThinking);
        return [...msgs, { role: 'assistant', content: `❌ ${err.message || 'No se pudo conectar'}` }];
      });
      setCurrentTool(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, loading, isOpen]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  async function handleConfirmAction() {
    if (!pendingAction || confirmLoading) return;
    setConfirmLoading(true);

    try {
      switch (pendingAction.action) {
        case 'create_task':
          await api.createTask({
            title: pendingAction.data.title || 'Tarea de seguimiento',
            due_time: pendingAction.data.due_time ?? undefined,
          });
          break;

        case 'create_quick_reply':
          await api.createQuickReply({
            title: pendingAction.data.title,
            content: pendingAction.data.content,
            category: pendingAction.data.category || 'general',
          });
          break;

        case 'update_ai_context':
          if (activeBusiness?.id) {
            await api.updateBusiness(activeBusiness.id, { ai_context: pendingAction.data.preview });
          }
          break;

        case 'create_contact':
          await api.createContact({
            name: pendingAction.data.title,
            phone: pendingAction.data.phone || undefined,
            channel: (pendingAction.data.channel as any) || 'whatsapp',
            pipeline_stage: 'new',
          });
          break;

        case 'compose_followup':
          await api.sendMessage({
            conversation_id: pendingAction.data.conversation_id!,
            content: pendingAction.data.message!,
            sender: 'agent',
          });
          break;

        case 'move_contact_stage':
          await api.updateContactStage(
            pendingAction.data.contact_id!,
            pendingAction.data.new_stage!,
          );
          break;
      }
      setConfirmDone(true);
      setPendingAction(null);
    } catch (err: any) {
      console.error('[Copilot] confirm action error:', err);
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <>
      {/* ── Floating button ── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-200',
          'bg-gradient-to-br from-purple-600 to-blue-600 text-white hover:shadow-xl hover:scale-105',
          isOpen && 'scale-0 opacity-0 pointer-events-none',
        )}
        aria-label="Abrir Copilot"
      >
        <Bot className="w-6 h-6" />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {/* ── Slide-in panel ── */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-96 z-50 shadow-2xl flex flex-col bg-white transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white shrink-0">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm leading-none">Copilot</p>
            <p className="text-white/70 text-xs mt-0.5">Tu empleado virtual</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">

          {/* Empty state — quick prompts */}
          {messages.length === 0 && !loading && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm text-slate-700 leading-relaxed space-y-2">
                  <p>¡Hola! 👋 Soy tu Copilot{activeBusiness?.name ? ` de ${activeBusiness.name}` : ''}.</p>
                  <p>Puedo consultar tus datos en tiempo real, crear respuestas rápidas, actualizar tu IA, guardar memorias, agregar contactos y redactar seguimientos listos para enviar — todo desde aquí.</p>
                  <p className="text-slate-500 text-xs">Si algo está fuera de mis capacidades, te lo digo al instante. ¿En qué te ayudo hoy?</p>
                </div>
              </div>

              <div className="pl-9 space-y-2">
                <p className="text-xs text-slate-400 font-medium">Sugerencias rápidas</p>
                <div className="flex flex-col gap-1.5">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-left text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn('flex items-start gap-2.5', msg.role === 'user' && 'flex-row-reverse')}
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                  msg.role === 'assistant' ? 'bg-purple-100' : 'bg-blue-100',
                )}
              >
                <Bot className={cn('w-4 h-4', msg.role === 'assistant' ? 'text-purple-600' : 'text-blue-600')} />
              </div>

              <div className={cn('max-w-[80%]', msg.role === 'user' && 'items-end flex flex-col')}>
                {msg.isThinking ? (
                  <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                      <span className="text-xs text-slate-500">
                        {currentTool
                          ? `Consultando ${TOOL_LABELS[currentTool] ?? currentTool}...`
                          : 'Pensando...'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                      msg.role === 'assistant'
                        ? 'bg-slate-100 text-slate-800 rounded-tl-md'
                        : 'bg-blue-500 text-white rounded-tr-md',
                    )}
                  >
                    {renderMarkdown(msg.content)}
                  </div>
                )}

                {/* Tool usage badge */}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 pl-1">
                    {msg.toolsUsed.map((tool) => (
                      <span
                        key={tool}
                        className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-500 rounded-md font-mono"
                      >
                        ⚙ {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Pending action confirm card */}
          {pendingAction && pendingAction.requiresConfirm && !confirmDone && (
            <div className="ml-9 border border-purple-200 bg-purple-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-purple-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold">Acción pendiente</span>
              </div>

              {/* create_task */}
              {pendingAction.action === 'create_task' && (
                <>
                  <p className="text-xs font-semibold text-purple-700">📋 Crear tarea</p>
                  <p className="text-xs text-slate-700">{pendingAction.data.title}</p>
                  {pendingAction.data.due_time && (
                    <p className="text-[10px] text-slate-500">⏰ {new Date(pendingAction.data.due_time).toLocaleString('es')}</p>
                  )}
                </>
              )}

              {/* create_quick_reply */}
              {pendingAction.action === 'create_quick_reply' && (
                <>
                  <p className="text-xs font-semibold text-purple-700">⚡ Nueva respuesta rápida</p>
                  <p className="text-xs font-medium text-slate-700">{pendingAction.data.title}</p>
                  <p className="text-xs text-slate-600 bg-white rounded p-2 border border-purple-100 italic">
                    &ldquo;{pendingAction.data.content}&rdquo;
                  </p>
                  <p className="text-[10px] text-slate-400">Categoría: {pendingAction.data.category}</p>
                </>
              )}

              {/* update_ai_context */}
              {pendingAction.action === 'update_ai_context' && (
                <>
                  <p className="text-xs font-semibold text-purple-700">
                    🧠 {pendingAction.data.mode === 'replace' ? 'Reemplazar' : 'Actualizar'} contexto IA
                  </p>
                  <pre className="text-[10px] text-slate-600 bg-white rounded p-2 border border-purple-100 whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {pendingAction.data.preview}
                  </pre>
                </>
              )}

              {/* create_contact */}
              {pendingAction.action === 'create_contact' && (
                <>
                  <p className="text-xs font-semibold text-purple-700">👤 Agregar contacto</p>
                  <p className="text-xs text-slate-700 font-medium">{pendingAction.data.title}</p>
                  {pendingAction.data.phone && (
                    <p className="text-[10px] text-slate-500">📱 {pendingAction.data.phone}</p>
                  )}
                  <p className="text-[10px] text-slate-500">Canal: {pendingAction.data.channel}</p>
                </>
              )}

              {/* compose_followup */}
              {pendingAction.action === 'compose_followup' && (
                <>
                  <p className="text-xs font-semibold text-purple-700">
                    💬 Enviar seguimiento a {pendingAction.data.contact_name}
                  </p>
                  <p className="text-xs text-slate-600 bg-white rounded p-2 border border-purple-100 italic">
                    &ldquo;{pendingAction.data.message}&rdquo;
                  </p>
                </>
              )}

              {/* move_contact_stage */}
              {pendingAction.action === 'move_contact_stage' && (
                <>
                  <p className="text-xs font-semibold text-purple-700">🔀 Mover en pipeline</p>
                  <p className="text-xs text-slate-700">
                    <span className="font-medium">{pendingAction.data.title}</span>
                    {' → '}
                    <span className="font-medium capitalize">{pendingAction.data.new_stage}</span>
                  </p>
                </>
              )}

              {/* Confirm / Cancel buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleConfirmAction}
                  disabled={confirmLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors"
                >
                  {confirmLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  Confirmar y ejecutar
                </button>
                <button
                  onClick={() => setPendingAction(null)}
                  className="flex-1 py-1.5 text-xs font-medium border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Confirm success */}
          {confirmDone && (
            <div className="ml-9 flex items-center gap-1.5 text-green-600 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>✅ Acción ejecutada correctamente</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input composer */}
        <div className="p-3 border-t border-slate-100 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta algo o da una instrucción..."
              rows={1}
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 max-h-28"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="p-2.5 bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shrink-0"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-1.5">
            Powered by Claude · Datos reales de tu negocio
          </p>
        </div>
      </div>

      {/* Backdrop (closes panel on click) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

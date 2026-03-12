/**
 * CopilotPanel.tsx — AI Copilot Flotante
 *
 * Floating button (bottom-right) + slide-in panel that lets the business
 * owner operate the CRM via natural language using Anthropic tool use.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Loader2, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  isThinking?: boolean;
}

interface PendingAction {
  action: string;
  data: {
    title?: string;
    contact_name?: string;
    due_time?: string | null;
  };
  requiresConfirm: boolean;
}

const QUICK_PROMPTS = [
  '¿Cuántos leads nuevos tengo hoy?',
  '¿Quién no me ha respondido en 3 días?',
  'Resumen del pipeline esta semana',
  '¿Cuál es mi deal más valioso en proceso?',
];

export default function CopilotPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

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
    const thinkingMessage: ChatMessage = { role: 'assistant', content: '', isThinking: true };

    const newMessages = [...messages, userMessage];
    setMessages([...newMessages, thinkingMessage]);
    setInput('');
    setLoading(true);
    setPendingAction(null);
    setConfirmDone(false);

    try {
      // Build message history for the API (exclude thinking placeholder)
      const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));

      const { reply, toolsUsed, pendingAction: pa } = await api.copilotChat(apiMessages);

      // Replace thinking placeholder with real reply
      setMessages((prev) => {
        const withoutThinking = prev.filter((m) => !m.isThinking);
        return [
          ...withoutThinking,
          { role: 'assistant', content: reply, toolsUsed: toolsUsed?.length ? toolsUsed : undefined },
        ];
      });

      if (pa) {
        setPendingAction(pa);
      }

      if (!isOpen) {
        setHasUnread(true);
      }
    } catch (err: any) {
      setMessages((prev) => {
        const withoutThinking = prev.filter((m) => !m.isThinking);
        return [
          ...withoutThinking,
          { role: 'assistant', content: `Error: ${err.message || 'No se pudo conectar con el servidor'}` },
        ];
      });
    } finally {
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
      if (pendingAction.action === 'create_task') {
        await api.createTask({
          title: pendingAction.data.title || 'Tarea de seguimiento',
          due_time: pendingAction.data.due_time ?? undefined,
        });
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
                <div className="bg-slate-100 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm text-slate-700 leading-relaxed">
                  ¡Hola! Soy tu Copilot. Puedo consultar datos reales de tu negocio, crear tareas y mover leads. ¿Qué necesitas?
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
                      <span className="text-xs text-slate-500">Consultando datos...</span>
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
                    {msg.content}
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
              {pendingAction.action === 'create_task' && (
                <p className="text-xs text-slate-700">
                  Crear tarea: <strong>{pendingAction.data.title}</strong>
                  {pendingAction.data.due_time && (
                    <> · {new Date(pendingAction.data.due_time).toLocaleString('es')}</>
                  )}
                </p>
              )}
              <button
                onClick={handleConfirmAction}
                disabled={confirmLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors"
              >
                {confirmLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                Confirmar y guardar
              </button>
            </div>
          )}

          {/* Confirm success */}
          {confirmDone && (
            <div className="ml-9 flex items-center gap-1.5 text-green-600 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Tarea creada correctamente</span>
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

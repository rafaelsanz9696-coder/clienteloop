import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, CheckCircle2, Loader2, Bot, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Phase = 'chatting' | 'confirm' | 'finalizing' | 'done';

interface FinalizeResult {
  memoriesCreated: number;
  quickRepliesCreated: number;
  contextUpdated: boolean;
}

interface Props {
  onClose: () => void;
  onDone?: () => void;
}

export default function AISetupAssistant({ onClose, onDone }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('chatting');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FinalizeResult | null>(null);
  const [finalizingStep, setFinalizingStep] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Send the first greeting on mount
  useEffect(() => {
    sendToAI([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase]);

  async function sendToAI(history: Message[]) {
    setLoading(true);
    try {
      const { reply, setupComplete } = await api.setupAssistantChat(history);

      if (setupComplete) {
        setPhase('confirm');
        return;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Ups, tuve un problema de conexión. Intenta de nuevo.' },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || phase !== 'chatting') return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    await sendToAI(newMessages);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleFinalize() {
    setPhase('finalizing');
    setFinalizingStep(0);

    // Animate the steps
    const steps = [0, 1, 2];
    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 800));
      setFinalizingStep(step + 1);
    }

    try {
      const data = await api.setupAssistantFinalize(messages);
      setResult(data);
      setPhase('done');
    } catch (err) {
      console.error('[SetupAssistant] finalize error:', err);
      // Still show done screen even if partially failed
      setResult({ memoriesCreated: 0, quickRepliesCreated: 0, contextUpdated: false });
      setPhase('done');
    }
  }

  const finalizingSteps = [
    'Analizando la conversación...',
    'Guardando memorias del negocio...',
    'Generando plantillas de respuesta...',
    'Activando tu asistente de IA...',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-slate-100 bg-gradient-to-r from-purple-600 to-blue-600 text-white shrink-0">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-base">Asistente de Configuración</h2>
            <p className="text-white/70 text-xs">Configura tu IA en una conversación</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Phase: chatting ── */}
        {(phase === 'chatting' || phase === 'confirm') && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 && loading && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn('flex items-start gap-2', msg.role === 'user' && 'flex-row-reverse')}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                      msg.role === 'assistant' ? 'bg-purple-100' : 'bg-blue-100'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <Bot className="w-4 h-4 text-purple-600" />
                    ) : (
                      <User className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                      msg.role === 'assistant'
                        ? 'bg-slate-100 text-slate-800 rounded-tl-md'
                        : 'bg-blue-500 text-white rounded-tr-md'
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && messages.length > 0 && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm button */}
              {phase === 'confirm' && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="max-w-[78%]">
                    <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-tl-md px-4 py-2.5 text-sm mb-3">
                      ¡Perfecto! Ya tengo todo lo que necesito. 🎉 ¿Configuro tu asistente ahora con esta información?
                    </div>
                    <button
                      onClick={handleFinalize}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md"
                    >
                      <Sparkles className="w-4 h-4" />
                      Sí, configura mi asistente
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            {phase === 'chatting' && (
              <div className="p-3 border-t border-slate-100 shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu respuesta..."
                    rows={1}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Phase: finalizing ── */}
        {phase === 'finalizing' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-800 text-lg mb-1">Configurando tu cuenta...</h3>
              <p className="text-slate-500 text-sm">Esto toma solo unos segundos</p>
            </div>
            <div className="w-full max-w-xs space-y-3">
              {finalizingSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-500',
                      finalizingStep > i
                        ? 'bg-green-500'
                        : finalizingStep === i
                          ? 'bg-purple-500'
                          : 'bg-slate-200'
                    )}
                  >
                    {finalizingStep > i ? (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    ) : finalizingStep === i ? (
                      <Loader2 className="w-3 h-3 text-white animate-spin" />
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'text-sm transition-colors',
                      finalizingStep > i
                        ? 'text-green-600 font-medium'
                        : finalizingStep === i
                          ? 'text-purple-600 font-medium'
                          : 'text-slate-400'
                    )}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Phase: done ── */}
        {phase === 'done' && result && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-xl mb-1">¡Tu asistente está listo! 🚀</h3>
              <p className="text-slate-500 text-sm">Configuramos tu IA con la información de tu negocio</p>
            </div>

            <div className="w-full max-w-xs bg-slate-50 rounded-xl p-4 text-left space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className={cn('w-2 h-2 rounded-full', result.memoriesCreated > 0 ? 'bg-green-500' : 'bg-slate-300')} />
                <span className="text-sm text-slate-700">
                  <strong>{result.memoriesCreated}</strong> memorias guardadas
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className={cn('w-2 h-2 rounded-full', result.quickRepliesCreated > 0 ? 'bg-green-500' : 'bg-slate-300')} />
                <span className="text-sm text-slate-700">
                  <strong>{result.quickRepliesCreated}</strong> plantillas de respuesta creadas
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className={cn('w-2 h-2 rounded-full', result.contextUpdated ? 'bg-green-500' : 'bg-slate-300')} />
                <span className="text-sm text-slate-700">
                  Contexto de IA <strong>{result.contextUpdated ? 'actualizado' : 'sin cambios'}</strong>
                </span>
              </div>
            </div>

            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={() => { onDone?.(); onClose(); }}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Ir al Inbox
              </button>
              <button
                onClick={onClose}
                className="px-4 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Phone,
  Mail,
  Globe,
  Search,
  ChevronLeft,
  Sparkles,
  Zap,
  X,
  User,
  Tag,
  Clock,
  CheckCircle2,
  Calendar,
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

// Conversation List
function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
}: {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  filter: string;
  onFilterChange: (f: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = conversations.filter(
    (c) =>
      !search ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.last_message?.toLowerCase().includes(search.toLowerCase())
  );

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
        <div className="flex gap-1">
          {['all', 'open', 'resolved'].map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                filter === f
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-500 hover:bg-slate-100'
              )}
            >
              {f === 'all' ? 'Todos' : f === 'open' ? 'Abiertos' : 'Resueltos'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Sin conversaciones</p>
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
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                        getChannelColor(conv.channel)
                      )}
                    >
                      <ChannelIcon channel={conv.channel} className="w-3 h-3" />
                      {getChannelLabel(conv.channel)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{conv.last_message}</p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// Message Bubble
function MessageBubble({ message }: { message: Message }) {
  const isClient = message.sender === 'client';
  return (
    <div className={cn('flex mb-3', isClient ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm',
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
        <p className="whitespace-pre-wrap">{message.content}</p>
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversation } = useApi(
    () => api.getConversation(conversationId),
    [conversationId]
  );
  const {
    data: messages,
    loading: messagesLoading,
    refetch: refetchMessages,
  } = useApi(() => api.getMessages(conversationId), [conversationId]);
  const { data: quickReplies } = useApi(() => api.getQuickReplies(), []);
  const { socket } = useSocket();

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
    api.markConversationRead(conversationId).catch(() => {
      // Non-critical, ignore errors silently
    });
  }, [conversationId]);

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
          alert('Tarea creada con éxito');
        }
      } else {
        alert('No se detectó ninguna tarea clara en los últimos mensajes.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al extraer tarea.');
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
              <MessageBubble key={msg.id} message={msg} />
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
    </div>
  );
}

// Main Inbox Page
export default function InboxPage() {
  const { activeBusinessId } = useBusiness();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const { data: conversations, loading, refetch: refetchConversations } = useApi(
    () =>
      filter === 'all'
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
        />
      </div>

      {/* Thread */}
      <div className={cn('flex-1', !selectedId ? 'hidden lg:flex' : 'flex')}>
        {selectedId ? (
          <div className="flex-1">
            <ErrorBoundary>
              <ConversationThread
                conversationId={selectedId}
                onBack={() => navigate('/inbox')}
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

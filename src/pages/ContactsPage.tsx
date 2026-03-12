import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, Plus, Phone, Mail, X, ChevronLeft, MessageSquare,
  Edit2, Trash2, Download, MoreVertical, StickyNote, Kanban,
  Clock, Activity, Tag, Send, CheckCircle2, DollarSign,
} from 'lucide-react';
import { cn, getChannelColor, getChannelLabel, getStageLabel, getStageColor, formatRelativeTime, formatCurrency } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import type { Contact, ContactNote, PipelineDeal, Task, Conversation, ActivityEntry } from '../types/index';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const COUNTRY_CODES = [
  { label: '🇩🇴 +1 (RD)', code: '1' },   { label: '🇲🇽 +52 (MX)', code: '52' },
  { label: '🇨🇴 +57 (CO)', code: '57' },  { label: '🇻🇪 +58 (VE)', code: '58' },
  { label: '🇦🇷 +54 (AR)', code: '54' },  { label: '🇵🇷 +1 (PR)', code: '1787' },
  { label: '🇺🇸 +1 (USA)', code: '1' },   { label: '🇪🇸 +34 (ES)', code: '34' },
  { label: '🇨🇱 +56 (CL)', code: '56' },  { label: '🇵🇪 +51 (PE)', code: '51' },
  { label: '🇪🇨 +593 (EC)', code: '593' },{ label: '🇬🇹 +502 (GT)', code: '502' },
  { label: '🇵🇦 +507 (PA)', code: '507' },
];

function parsePhone(full: string) {
  const digits = full.replace(/\D/g, '');
  for (const cc of COUNTRY_CODES) {
    if (digits.startsWith(cc.code)) return { countryCode: cc.code, local: digits.slice(cc.code.length) };
  }
  return { countryCode: '1', local: digits };
}

const ACTIVITY_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
  contact_created:    { icon: Plus,          color: 'text-emerald-500 bg-emerald-50' },
  note_added:         { icon: StickyNote,    color: 'text-blue-500 bg-blue-50' },
  deal_created:       { icon: DollarSign,    color: 'text-orange-500 bg-orange-50' },
  deal_stage_changed: { icon: Kanban,        color: 'text-purple-500 bg-purple-50' },
  task_completed:     { icon: CheckCircle2,  color: 'text-green-500 bg-green-50' },
};

// ─── Edit Contact Modal ───────────────────────────────────────────────────────
function EditContactModal({ contact, onClose, onSaved }: { contact: Contact; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(contact.name);
  const parsed = parsePhone(contact.phone || '');
  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [localPhone, setLocalPhone] = useState(parsed.local);
  const [email, setEmail] = useState(contact.email || '');
  const [channel, setChannel] = useState<string>(contact.channel || 'whatsapp');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const fullPhone = localPhone.trim() ? `${countryCode}${localPhone.replace(/\D/g, '')}` : '';
    try {
      await api.updateContact(contact.id, { name, phone: fullPhone, email, channel: channel as any });
      onSaved(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Editar Contacto</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Nombre *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Teléfono WhatsApp</label>
            <div className="flex gap-2">
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0">
                {COUNTRY_CODES.map(cc => <option key={cc.label} value={cc.code}>{cc.label}</option>)}
              </select>
              <input type="tel" value={localPhone} onChange={(e) => setLocalPhone(e.target.value)} placeholder="8095551234" className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {localPhone && <p className="text-xs text-slate-400 mt-1">Se guardará como: {countryCode}{localPhone.replace(/\D/g, '')}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Canal</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option>
              <option value="email">Email</option><option value="web">Web</option>
            </select>
          </div>
          <button type="submit" disabled={saving || !name.trim()} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors">
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Create Contact Modal ─────────────────────────────────────────────────────
function CreateContactModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('1');
  const [localPhone, setLocalPhone] = useState('');
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const fullPhone = localPhone.trim() ? `${countryCode}${localPhone.replace(/\D/g, '')}` : '';
    try {
      await api.createContact({ name, phone: fullPhone, email, channel: channel as any });
      onCreated(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Nuevo Contacto</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Nombre *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Teléfono WhatsApp</label>
            <div className="flex gap-2">
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0">
                {COUNTRY_CODES.map(cc => <option key={cc.label} value={cc.code}>{cc.label}</option>)}
              </select>
              <input type="tel" value={localPhone} onChange={(e) => setLocalPhone(e.target.value)} placeholder="8095551234" className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {localPhone && <p className="text-xs text-slate-400 mt-1">Se guardará como: {countryCode}{localPhone.replace(/\D/g, '')}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Canal</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option>
              <option value="email">Email</option><option value="web">Web</option>
            </select>
          </div>
          <button type="submit" disabled={saving || !name.trim()} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors">
            {saving ? 'Guardando...' : 'Crear Contacto'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Tag Editor ───────────────────────────────────────────────────────────────
function TagEditor({ contactId, initialTags, onChange }: { contactId: number; initialTags: string[]; onChange: () => void }) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState('');

  async function saveTags(next: string[]) {
    setTags(next);
    await api.updateContact(contactId, { tags: JSON.stringify(next) } as any);
    onChange();
  }

  function addTag() {
    const val = input.trim();
    if (!val || tags.includes(val)) { setInput(''); return; }
    saveTags([...tags, val]);
    setInput('');
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
            {tag}
            <button onClick={() => saveTags(tags.filter(t => t !== tag))} className="hover:text-blue-900 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-slate-400 italic">Sin etiquetas</span>}
      </div>
      <div className="flex gap-1.5">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder="Nueva etiqueta + Enter..."
          className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={addTag} disabled={!input.trim()} className="px-2.5 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Contact Detail Panel ─────────────────────────────────────────────────────
type DetailTab = 'info' | 'notas' | 'deals' | 'historial' | 'actividad';

const TABS: { key: DetailTab; label: string; icon: typeof Activity }[] = [
  { key: 'info',      label: 'Info',      icon: Tag },
  { key: 'notas',     label: 'Notas',     icon: StickyNote },
  { key: 'deals',     label: 'Deals',     icon: DollarSign },
  { key: 'historial', label: 'Historial', icon: MessageSquare },
  { key: 'actividad', label: 'Actividad', icon: Activity },
];

function ContactDetail({ contactId, onClose, onUpdated }: { contactId: number; onClose: () => void; onUpdated: () => void }) {
  const { data: contact, loading, refetch: refetchContact } = useApi(() => api.getContact(contactId), [contactId]);
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const navigate = useNavigate();

  const [notes, setNotes]                   = useState<ContactNote[]>([]);
  const [deals, setDeals]                   = useState<PipelineDeal[]>([]);
  const [tasks, setTasks]                   = useState<Task[]>([]);
  const [conversations, setConversations]   = useState<Conversation[]>([]);
  const [activity, setActivity]             = useState<ActivityEntry[]>([]);
  const [tabLoading, setTabLoading]         = useState(false);
  const [noteText, setNoteText]             = useState('');
  const [savingNote, setSavingNote]         = useState(false);

  // Dummy ref to satisfy useRef import (used to avoid unused import warning)
  const _ref = useRef<boolean>(false);
  void _ref;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setTabLoading(true);
      try {
        if (activeTab === 'notas')     { const d = await api.getNotes(contactId);                                                   if (!cancelled) setNotes(d); }
        if (activeTab === 'deals')     { const d = await api.getContactDeals(contactId);                                            if (!cancelled) setDeals(d); }
        if (activeTab === 'historial') { const [cv, t] = await Promise.all([api.getContactConversations(contactId), api.getContactTasks(contactId)]); if (!cancelled) { setConversations(cv); setTasks(t); } }
        if (activeTab === 'actividad') { const d = await api.getActivity(contactId);                                                if (!cancelled) setActivity(d); }
      } finally { if (!cancelled) setTabLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [activeTab, contactId]);

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const note = await api.createNote(contactId, noteText.trim());
      setNotes((p) => [note, ...p]);
      setNoteText('');
    } finally { setSavingNote(false); }
  }

  async function handleStageChange(stage: string) {
    await api.updateContactStage(contactId, stage);
    refetchContact();
    onUpdated();
  }

  if (loading || !contact) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
        <div className="bg-white w-full max-w-md h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  const tags: string[] = (() => { try { return JSON.parse(contact.tags); } catch { return []; } })();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h3 className="font-bold text-slate-800 leading-tight">{contact.name}</h3>
            <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', getChannelColor(contact.channel))}>
              {getChannelLabel(contact.channel)}
            </span>
          </div>
          <button onClick={() => navigate('/app/inbox')} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Ver en Inbox">
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Quick info bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {contact.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{contact.phone}</span>}
            {contact.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{contact.email}</span>}
            <span className="flex items-center gap-1 ml-auto shrink-0"><Clock className="w-3 h-3" />{formatRelativeTime(contact.last_contact_at)}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0 overflow-x-auto scrollbar-none">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn('flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium whitespace-nowrap transition-colors relative shrink-0',
                activeTab === key ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600')}>
              <Icon className="w-3.5 h-3.5" />{label}
              {activeTab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tabLoading && activeTab !== 'info' ? (
            <div className="flex items-center justify-center h-32"><LoadingSpinner /></div>
          ) : (
            <>
              {/* INFO */}
              {activeTab === 'info' && (
                <div className="p-5 space-y-5">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Etapa del Pipeline</label>
                    <div className="flex gap-2">
                      {(['new', 'in_progress', 'closed'] as const).map((stage) => (
                        <button key={stage} onClick={() => handleStageChange(stage)}
                          className={cn('flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors',
                            contact.pipeline_stage === stage ? getStageColor(stage) : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                          {getStageLabel(stage)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Etiquetas
                    </label>
                    <TagEditor contactId={contactId} initialTags={tags} onChange={() => { refetchContact(); onUpdated(); }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Nota rápida</label>
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 min-h-[56px]">
                      {contact.notes || <span className="text-slate-400 italic text-xs">Sin nota rápida — usa la pestaña Notas para notas detalladas</span>}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">Creado el {new Date(contact.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              )}

              {/* NOTAS */}
              {activeTab === 'notas' && (
                <div className="p-5 space-y-4">
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Escribe una nota sobre este cliente..."
                      rows={3} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    <button onClick={handleSaveNote} disabled={savingNote || !noteText.trim()}
                      className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {savingNote ? 'Guardando...' : '+ Guardar nota'}
                    </button>
                  </div>
                  {notes.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No hay notas todavía</p>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="bg-white border border-slate-100 rounded-xl p-3 group">
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-slate-400">{formatRelativeTime(note.created_at)}</span>
                            <button onClick={() => { api.deleteNote(note.id); setNotes(p => p.filter(n => n.id !== note.id)); }}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* DEALS */}
              {activeTab === 'deals' && (
                <div className="p-5 space-y-3">
                  {deals.length === 0 ? (
                    <div className="text-center py-8">
                      <DollarSign className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Sin deals para este contacto</p>
                      <button onClick={() => navigate('/app/pipeline')} className="mt-3 text-xs text-blue-500 hover:text-blue-600 font-medium">Ir al Pipeline →</button>
                    </div>
                  ) : deals.map((deal) => (
                    <div key={deal.id} className="bg-white border border-slate-100 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{deal.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(deal.created_at)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-800">{formatCurrency(deal.value)}</p>
                          <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded', getStageColor(deal.stage))}>
                            {getStageLabel(deal.stage)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* HISTORIAL */}
              {activeTab === 'historial' && (
                <div className="p-5 space-y-3">
                  {tasks.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tareas</p>
                      {tasks.map((task) => (
                        <div key={task.id} className={cn('flex items-center gap-3 p-3 rounded-xl mb-2', task.status === 'done' ? 'bg-green-50' : 'bg-amber-50')}>
                          <CheckCircle2 className={cn('w-4 h-4 shrink-0', task.status === 'done' ? 'text-green-500' : 'text-amber-400')} />
                          <div>
                            <p className={cn('text-xs font-medium', task.status === 'done' ? 'text-green-700 line-through' : 'text-amber-700')}>{task.title}</p>
                            {task.due_time && <p className="text-[11px] text-slate-400">{task.due_time}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Conversaciones</p>
                  {conversations.length === 0 ? (
                    <div className="text-center py-6">
                      <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Sin conversaciones registradas</p>
                    </div>
                  ) : conversations.map((conv) => (
                    <button key={conv.id} onClick={() => navigate(`/app/inbox/${conv.id}`)}
                      className="w-full text-left bg-white border border-slate-100 rounded-xl p-3 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded', getChannelColor(conv.channel))}>{getChannelLabel(conv.channel)}</span>
                        <span className="text-[11px] text-slate-400">{formatRelativeTime(conv.last_message_at)}</span>
                      </div>
                      <p className="text-xs text-slate-600 truncate">{conv.last_message || 'Sin mensajes'}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* ACTIVIDAD */}
              {activeTab === 'actividad' && (
                <div className="p-5">
                  {activity.length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Sin actividad registrada aún</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-slate-100" />
                      <div className="space-y-4">
                        {activity.map((entry) => {
                          const cfg = ACTIVITY_ICONS[entry.type] ?? { icon: Activity, color: 'text-slate-500 bg-slate-50' };
                          const Icon = cfg.icon;
                          return (
                            <div key={entry.id} className="flex items-start gap-3 relative">
                              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10', cfg.color)}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 pt-1.5">
                                <p className="text-sm text-slate-700 leading-snug">{entry.description}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{formatRelativeTime(entry.created_at)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Contacts Page ───────────────────────────────────────────────────────
export default function ContactsPage() {
  const { activeBusinessId } = useBusiness();
  const { contactId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [menuOpen, setMenuOpen] = useState<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const close = () => setMenuOpen(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, []);

  const { data: contacts, loading, refetch } = useApi(
    () => api.getContacts({ search: search || undefined, stage: stageFilter || undefined, tag: tagFilter || undefined }),
    [search, stageFilter, tagFilter, activeBusinessId],
  );

  const allTags = Array.from(
    new Set((contacts ?? []).flatMap((c) => { try { return JSON.parse(c.tags) as string[]; } catch { return []; } }))
  );

  function handleDownloadCSV() {
    if (!contacts || contacts.length === 0) return;
    const headers = ['Nombre', 'Telefono', 'Email', 'Canal', 'Etapa', 'Notas', 'Creado'];
    const rows = contacts.map(c => [c.name, c.phone || '', c.email || '', c.channel, c.pipeline_stage, (c.notes || '').replace(/\n/g, ' '), new Date(c.created_at).toLocaleDateString('es-MX')]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `contactos_clienteloop_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-slate-800">Contactos</h2>
        <div className="flex gap-2">
          <button onClick={handleDownloadCSV} disabled={!contacts || contacts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Nuevo Contacto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar por nombre, telefono, email..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {[{ value: '', label: 'Todos' }, { value: 'new', label: 'Nuevos' }, { value: 'in_progress', label: 'En Proceso' }, { value: 'closed', label: 'Cerrados' }].map(({ value, label }) => (
              <button key={value} onClick={() => setStageFilter(value)}
                className={cn('px-3 py-2 text-xs font-medium rounded-lg transition-colors',
                  stageFilter === value ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tag chips */}
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {tagFilter && (
              <button onClick={() => setTagFilter('')} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-full text-xs font-medium">
                {tagFilter} <X className="w-3 h-3" />
              </button>
            )}
            {allTags.filter(t => t !== tagFilter).map((tag) => (
              <button key={tag} onClick={() => setTagFilter(tag)}
                className="px-2 py-1 bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-full text-xs font-medium transition-colors">
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? <LoadingSpinner /> : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Nombre</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Contacto</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Canal</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Etapa</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Etiquetas</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Último Contacto</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {(!contacts || contacts.length === 0) ? (
                  <tr><td colSpan={7} className="text-sm text-slate-400 text-center py-8">No se encontraron contactos</td></tr>
                ) : contacts.map((contact) => {
                  const ctags: string[] = (() => { try { return JSON.parse(contact.tags); } catch { return []; } })();
                  return (
                    <tr key={contact.id} onClick={() => { if (menuOpen?.id !== contact.id) navigate(`/app/contacts/${contact.id}`); }}
                      className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                            {contact.name.charAt(0)}
                          </div>
                          <span className="font-medium text-sm text-slate-800">{contact.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="text-xs text-slate-500">
                          {contact.phone && <div>{contact.phone}</div>}
                          {contact.email && <div>{contact.email}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium', getChannelColor(contact.channel))}>
                          {getChannelLabel(contact.channel)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium', getStageColor(contact.pipeline_stage))}>
                          {getStageLabel(contact.pipeline_stage)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {ctags.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">{tag}</span>
                          ))}
                          {ctags.length > 3 && <span className="text-[10px] text-slate-400">+{ctags.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-slate-400">{formatRelativeTime(contact.last_contact_at)}</span>
                      </td>
                      <td className="px-2 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          setMenuOpen(menuOpen?.id === contact.id ? null : { id: contact.id, x: rect.right, y: rect.bottom + 4 });
                        }} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreateContactModal onClose={() => setShowCreate(false)} onCreated={refetch} />}
      {editingContact && <EditContactModal contact={editingContact} onClose={() => setEditingContact(null)} onSaved={refetch} />}
      {contactId && <ContactDetail contactId={Number(contactId)} onClose={() => navigate('/app/contacts')} onUpdated={refetch} />}

      {menuOpen && (() => {
        const contact = contacts?.find(c => c.id === menuOpen.id);
        if (!contact) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
            <div className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[180px]"
              style={{ top: menuOpen.y, right: window.innerWidth - menuOpen.x }}>
              <button onClick={() => { setEditingContact(contact); setMenuOpen(null); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                <Edit2 className="w-4 h-4 text-blue-500" /> Editar contacto
              </button>
              <button onClick={() => { navigate(`/app/contacts/${contact.id}`); setMenuOpen(null); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                <MessageSquare className="w-4 h-4 text-green-500" /> Ver perfil
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button onClick={async () => {
                if (confirm(`¿Eliminar a ${contact.name}?`)) { await api.deleteContact(contact.id); refetch(); }
                setMenuOpen(null);
              }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

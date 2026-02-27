import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Phone,
  Mail,
  X,
  ChevronLeft,
  MessageSquare,
  Edit2,
  Trash2,
  Save,
  Download,
} from 'lucide-react';
import { cn, getChannelColor, getChannelLabel, getStageLabel, getStageColor, formatRelativeTime } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import type { Contact } from '../types/index';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Create Contact Modal
function CreateContactModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createContact({ name, phone, email, channel: channel as any });
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
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
            <label className="text-sm font-medium text-slate-700 mb-1 block">Telefono</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Canal</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="email">Email</option>
              <option value="web">Web</option>
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

// Contact Detail Panel
function ContactDetail({ contactId, onClose, onUpdated }: { contactId: number; onClose: () => void; onUpdated: () => void }) {
  const { data: contact, loading } = useApi(() => api.getContact(contactId), [contactId]);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const navigate = useNavigate();

  if (loading || !contact) return <LoadingSpinner />;

  async function handleSaveNotes() {
    await api.updateContact(contactId, { notes } as any);
    setEditing(false);
    // Optimistically update the local display before the parent refetch
    if (contact) contact.notes = notes;
    onUpdated();
  }

  async function handleStageChange(stage: string) {
    await api.updateContactStage(contactId, stage);
    onUpdated();
  }

  const tags: string[] = (() => {
    try { return JSON.parse(contact.tags); } catch { return []; }
  })();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
          <h3 className="font-bold text-slate-800">Detalle del Contacto</h3>
          <div />
        </div>

        <div className="p-5 space-y-5">
          {/* Avatar & Name */}
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500 mx-auto mb-2">
              {contact.name.charAt(0)}
            </div>
            <h2 className="text-lg font-bold text-slate-800">{contact.name}</h2>
            <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1', getChannelColor(contact.channel))}>
              {getChannelLabel(contact.channel)}
            </span>
          </div>

          {/* Info */}
          <div className="space-y-3">
            {contact.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">{contact.phone}</span>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Pipeline Stage */}
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">Etapa</label>
            <div className="flex gap-2">
              {['new', 'in_progress', 'closed'].map((stage) => (
                <button
                  key={stage}
                  onClick={() => handleStageChange(stage)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                    contact.pipeline_stage === stage
                      ? getStageColor(stage)
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {getStageLabel(stage)}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">Etiquetas</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Notas</label>
              <button onClick={() => { setEditing(!editing); setNotes(contact.notes); }} className="text-xs text-blue-500 hover:text-blue-600">
                {editing ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            {editing ? (
              <div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={handleSaveNotes} className="mt-2 px-4 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600">
                  <Save className="w-3 h-3 inline mr-1" /> Guardar
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-600">{contact.notes || 'Sin notas'}</p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => navigate('/inbox')}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <MessageSquare className="w-4 h-4" /> Ver Conversaciones
            </button>
          </div>

          <div className="text-xs text-slate-400 text-center">
            Creado: {new Date(contact.created_at).toLocaleDateString('es-MX')}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Contacts Page
export default function ContactsPage() {
  const { activeBusinessId } = useBusiness();
  const { contactId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: contacts, loading, refetch } = useApi(
    () => api.getContacts({ search: search || undefined, stage: stageFilter || undefined }),
    [search, stageFilter, activeBusinessId]
  );

  function handleDownloadCSV() {
    if (!contacts || contacts.length === 0) return;

    const headers = ['Nombre', 'Telefono', 'Email', 'Canal', 'Etapa', 'Notas', 'Creado'];
    const rows = contacts.map(c => [
      c.name,
      c.phone || '',
      c.email || '',
      c.channel,
      c.pipeline_stage,
      (c.notes || '').replace(/\n/g, ' '),
      new Date(c.created_at).toLocaleDateString('es-MX')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `contactos_clienteloop_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-slate-800">Contactos</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadCSV}
            disabled={!contacts || contacts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo Contacto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, telefono, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
          {[
            { value: '', label: 'Todos' },
            { value: 'new', label: 'Nuevos' },
            { value: 'in_progress', label: 'En Proceso' },
            { value: 'closed', label: 'Cerrados' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStageFilter(value)}
              className={cn(
                'px-3 py-2 text-xs font-medium rounded-lg transition-colors',
                stageFilter === value
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Nombre</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Contacto</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Canal</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Etapa</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Ultimo Contacto</th>
                </tr>
              </thead>
              <tbody>
                {(!contacts || contacts.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="text-sm text-slate-400 text-center py-8">
                      No se encontraron contactos
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                      className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
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
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-slate-400">
                          {formatRelativeTime(contact.last_contact_at)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateContactModal onClose={() => setShowCreate(false)} onCreated={refetch} />}
      {contactId && <ContactDetail contactId={Number(contactId)} onClose={() => navigate('/contacts')} onUpdated={refetch} />}
    </div>
  );
}

import { useState } from 'react';
import { Plus, GripVertical, X, Trash2, DollarSign, Search } from 'lucide-react';
import { cn, formatCurrency, getChannelColor, getChannelLabel } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import type { PipelineDeal, Contact } from '../types/index';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const STAGES = [
  { key: 'new', label: 'Nuevos', color: 'bg-blue-500' },
  { key: 'in_progress', label: 'En Proceso', color: 'bg-amber-500' },
  { key: 'closed', label: 'Cerrados', color: 'bg-green-500' },
] as const;

// ─── Create Deal Modal ────────────────────────────────────────────────────────
function CreateDealModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState<'new' | 'in_progress' | 'closed'>('new');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: contacts } = useApi(
    () => api.getContacts({ search: contactSearch || undefined }),
    [contactSearch],
  );

  const filtered = (contacts ?? []).slice(0, 6);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContact) return;
    setSaving(true);
    try {
      await api.createDeal({
        contact_id: selectedContact.id,
        title: title || `Deal — ${selectedContact.name}`,
        stage,
        value: parseFloat(value) || 0,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Intenta de nuevo'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Nuevo Deal</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Contact picker */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Contacto <span className="text-red-500">*</span>
            </label>
            {selectedContact ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{selectedContact.name}</p>
                  <p className="text-xs text-slate-500">{selectedContact.phone || selectedContact.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedContact(null); setContactSearch(''); }}
                  className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Buscar contacto por nombre..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {filtered.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-44 overflow-y-auto">
                    {filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => { setSelectedContact(c); setContactSearch(c.name); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left transition-colors first:rounded-t-xl last:rounded-b-xl"
                        >
                          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                            <p className="text-xs text-slate-400 truncate">{c.phone || c.email || c.channel}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Título del deal</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={selectedContact ? `Deal — ${selectedContact.name}` : 'Ej: Servicio gold — Trimestre Q2'}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Value + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Valor ($)</label>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Etapa inicial</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !selectedContact}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 transition-colors shadow-lg shadow-blue-100 mt-1"
          >
            {saving ? 'Creando...' : 'Crear Deal'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Deal Card ────────────────────────────────────────────────────────────────
function DealCard({
  deal,
  onDragStart,
  onDelete,
}: {
  deal: PipelineDeal;
  onDragStart: (e: React.DragEvent, dealId: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      className="bg-white rounded-xl border border-slate-200 p-3 mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between mb-1.5 gap-1">
        <span className="font-semibold text-sm text-slate-800 truncate">
          {deal.contact_name || 'Sin contacto'}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(deal.id); }}
            className="p-1 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
            title="Eliminar deal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-2 truncate">{deal.title}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-emerald-600">
          {formatCurrency(deal.value)}
        </span>
        {deal.channel && (
          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', getChannelColor(deal.channel))}>
            {getChannelLabel(deal.channel)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Pipeline Column ──────────────────────────────────────────────────────────
function PipelineColumn({
  stageKey, label, color, deals, onDragStart, onDrop, onDragOver, onDelete,
}: {
  stageKey: string;
  label: string;
  color: string;
  deals: PipelineDeal[];
  onDragStart: (e: React.DragEvent, dealId: number) => void;
  onDrop: (e: React.DragEvent, stage: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDelete: (id: number) => void;
}) {
  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);
  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stageKey)}
      className="flex flex-col min-w-[280px] flex-1"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('w-3 h-3 rounded-full', color)} />
          <h3 className="font-bold text-sm text-slate-800">{label}</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{deals.length}</span>
        </div>
        <span className="text-xs font-medium text-slate-500">{formatCurrency(totalValue)}</span>
      </div>
      <div className="flex-1 bg-slate-50 rounded-xl p-2 min-h-[200px]">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} onDelete={onDelete} />
        ))}
        {deals.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-8">Arrastra deals aquí</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const { activeBusinessId } = useBusiness();
  const { data: pipeline, loading, refetch } = useApi(() => api.getPipeline(), [activeBusinessId]);
  const [draggedDealId, setDraggedDealId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function handleDragStart(e: React.DragEvent, dealId: number) {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e: React.DragEvent, newStage: string) {
    e.preventDefault();
    if (draggedDealId === null) return;
    try {
      await api.updateDealStage(draggedDealId, newStage);
      refetch();
    } finally {
      setDraggedDealId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este deal?')) return;
    await api.deleteDeal(id);
    refetch();
  }

  if (loading) return <LoadingSpinner text="Cargando pipeline..." />;

  const allDeals = [
    ...((pipeline as any)?.new ?? []),
    ...((pipeline as any)?.in_progress ?? []),
    ...((pipeline as any)?.closed ?? []),
  ];
  const totalValue = allDeals.reduce((sum: number, d: PipelineDeal) => sum + d.value, 0);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Pipeline de Ventas</h2>
          {allDeals.length > 0 && (
            <p className="text-sm text-slate-400 mt-0.5">
              {allDeals.length} deal{allDeals.length !== 1 ? 's' : ''} · <span className="font-semibold text-emerald-600">{formatCurrency(totalValue)}</span> total
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-blue-100"
        >
          <Plus className="w-4 h-4" />
          Nuevo Deal
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {STAGES.map(({ key, label, color }) => (
          <PipelineColumn
            key={key}
            stageKey={key}
            label={label}
            color={color}
            deals={(pipeline as any)?.[key] || []}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showCreate && (
        <CreateDealModal onClose={() => setShowCreate(false)} onCreated={refetch} />
      )}
    </div>
  );
}

import { useState } from 'react';
import { Plus, GripVertical, X } from 'lucide-react';
import { cn, formatCurrency, getChannelColor, getChannelLabel } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import type { PipelineDeal } from '../types/index';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const STAGES = [
  { key: 'new', label: 'Nuevos', color: 'bg-blue-500' },
  { key: 'in_progress', label: 'En Proceso', color: 'bg-amber-500' },
  { key: 'closed', label: 'Cerrados', color: 'bg-green-500' },
] as const;

function DealCard({
  deal,
  onDragStart,
}: {
  deal: PipelineDeal;
  onDragStart: (e: React.DragEvent, dealId: number) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      className="bg-white rounded-xl border border-slate-200 p-3 mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between mb-1.5">
        <span className="font-semibold text-sm text-slate-800 truncate">
          {deal.contact_name || 'Sin contacto'}
        </span>
        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0" />
      </div>
      <p className="text-xs text-slate-500 mb-2 truncate">{deal.title}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-emerald-600">
          {formatCurrency(deal.value)}
        </span>
        {deal.channel && (
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-medium',
              getChannelColor(deal.channel)
            )}
          >
            {getChannelLabel(deal.channel)}
          </span>
        )}
      </div>
    </div>
  );
}

function PipelineColumn({
  stageKey,
  label,
  color,
  deals,
  onDragStart,
  onDrop,
  onDragOver,
}: {
  stageKey: string;
  label: string;
  color: string;
  deals: PipelineDeal[];
  onDragStart: (e: React.DragEvent, dealId: number) => void;
  onDrop: (e: React.DragEvent, stage: string) => void;
  onDragOver: (e: React.DragEvent) => void;
}) {
  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stageKey)}
      className="flex flex-col min-w-[280px] flex-1"
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('w-3 h-3 rounded-full', color)} />
          <h3 className="font-bold text-sm text-slate-800">{label}</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {deals.length}
          </span>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {formatCurrency(totalValue)}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 bg-slate-50 rounded-xl p-2 min-h-[200px]">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} />
        ))}
        {deals.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-8">
            Arrastra deals aqui
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { activeBusinessId } = useBusiness();
  const { data: pipeline, loading, refetch } = useApi(() => api.getPipeline(), [activeBusinessId]);
  const [draggedDealId, setDraggedDealId] = useState<number | null>(null);

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

  if (loading) return <LoadingSpinner text="Cargando pipeline..." />;

  return (
    <div className="p-4 md:p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-slate-800">Pipeline de Ventas</h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100%-60px)]">
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
          />
        ))}
      </div>
    </div>
  );
}

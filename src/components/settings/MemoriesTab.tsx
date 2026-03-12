import { useState } from 'react';
import {
    Brain,
    Plus,
    Trash2,
    Sparkles,
    MessageSquare,
    BookOpen,
    TrendingUp,
    User,
    ChevronUp,
    ChevronDown,
    X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useBusiness } from '../../contexts/BusinessContext';
import type { BusinessMemory, MemoryType } from '../../types/index';

const MEMORY_TYPES: { value: MemoryType; label: string; icon: any; color: string; description: string }[] = [
    {
        value: 'faq',
        label: 'Pregunta Frecuente',
        icon: MessageSquare,
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        description: 'P: <pregunta> | R: <respuesta>',
    },
    {
        value: 'style',
        label: 'Estilo de Comunicación',
        icon: Sparkles,
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        description: 'Cómo le gusta comunicarse al negocio',
    },
    {
        value: 'pattern',
        label: 'Patrón Detectado',
        icon: TrendingUp,
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        description: 'Comportamiento recurrente de clientes',
    },
    {
        value: 'client_insight',
        label: 'Insight de Cliente',
        icon: User,
        color: 'bg-green-100 text-green-700 border-green-200',
        description: 'Observación específica sobre un cliente',
    },
];

function MemoryBadge({ type }: { type: MemoryType }) {
    const cfg = MEMORY_TYPES.find((t) => t.value === type);
    if (!cfg) return null;
    const Icon = cfg.icon;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0',
                cfg.color,
            )}
        >
            <Icon className="w-2.5 h-2.5" />
            {cfg.label}
        </span>
    );
}

function RelevanceDots({ value }: { value: number }) {
    return (
        <span className="flex items-center gap-0.5 shrink-0" title={`Relevancia: ${value}/10`}>
            {Array.from({ length: 10 }).map((_, i) => (
                <span
                    key={i}
                    className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        i < value ? 'bg-blue-500' : 'bg-slate-200',
                    )}
                />
            ))}
        </span>
    );
}

export default function MemoriesTab() {
    const { activeBusinessId } = useBusiness();
    const { data: memories, loading, refetch } = useApi(() => api.getMemories(), [activeBusinessId]);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<{ type: MemoryType; content: string; relevance: number }>({
        type: 'faq',
        content: '',
        relevance: 5,
    });
    const [saving, setSaving] = useState(false);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!form.content.trim()) return;
        setSaving(true);
        try {
            await api.createMemory({
                type: form.type,
                content: form.content.trim(),
                relevance: form.relevance,
            });
            setForm({ type: 'faq', content: '', relevance: 5 });
            setShowForm(false);
            refetch();
        } catch (err: any) {
            alert('Error: ' + (err.message || 'Intenta de nuevo'));
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('¿Eliminar esta memoria?')) return;
        await api.deleteMemory(id);
        refetch();
    }

    async function handleRelevance(mem: BusinessMemory, delta: number) {
        const next = Math.min(10, Math.max(1, mem.relevance + delta));
        if (next === mem.relevance) return;
        await api.updateMemory(mem.id, { relevance: next });
        refetch();
    }

    const grouped = MEMORY_TYPES.reduce(
        (acc, t) => {
            acc[t.value] = (memories ?? []).filter((m) => m.type === t.value);
            return acc;
        },
        {} as Record<MemoryType, BusinessMemory[]>,
    );

    const total = memories?.length ?? 0;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                            <Brain className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Memoria de la IA</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Hechos permanentes que la IA recuerda entre conversaciones.{' '}
                                <span className="font-medium text-indigo-600">{total} memoria{total !== 1 ? 's' : ''}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm((v) => !v)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar
                    </button>
                </div>

                {/* Add form */}
                {showForm && (
                    <form onSubmit={handleCreate} className="mt-4 bg-white rounded-lg border border-indigo-200 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-700">Nueva memoria</p>
                            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {MEMORY_TYPES.map((t) => {
                                    const Icon = t.icon;
                                    return (
                                        <button
                                            key={t.value}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                                            className={cn(
                                                'flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all',
                                                form.type === t.value
                                                    ? cn(t.color, 'shadow-sm')
                                                    : 'border-slate-200 text-slate-500 hover:border-slate-300',
                                            )}
                                        >
                                            <Icon className="w-3.5 h-3.5 shrink-0" />
                                            {t.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                                {MEMORY_TYPES.find((t) => t.value === form.type)?.description}
                            </p>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Contenido</label>
                            <textarea
                                value={form.content}
                                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                                required
                                rows={3}
                                placeholder={
                                    form.type === 'faq'
                                        ? 'P: ¿Cuánto cuesta el servicio gold? | R: $150 por sesión'
                                        : form.type === 'style'
                                            ? 'Prefiere respuestas cortas, usa emojis 🎯, trata de tú'
                                            : form.type === 'pattern'
                                                ? '3 clientes esta semana preguntaron por descuento de estudiante'
                                                : 'Rafael prefiere que lo llamen, no mensajes de texto'
                                }
                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">
                                Relevancia: {form.relevance}/10
                            </label>
                            <input
                                type="range"
                                min={1}
                                max={10}
                                value={form.relevance}
                                onChange={(e) => setForm((f) => ({ ...f, relevance: Number(e.target.value) }))}
                                className="w-full accent-indigo-600"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Baja prioridad</span>
                                <span>Crítica</span>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end pt-1">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving || !form.content.trim()}
                                className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                            >
                                {saving ? 'Guardando...' : 'Guardar memoria'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Memory list grouped by type */}
            {loading ? (
                <p className="text-sm text-slate-400 text-center py-8">Cargando memorias...</p>
            ) : total === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Sin memorias aún.</p>
                    <p className="text-xs mt-1">Agrega una manualmente o activa la IA agentic para que aprenda automáticamente.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {MEMORY_TYPES.filter((t) => grouped[t.value]?.length > 0).map((t) => {
                        const Icon = t.icon;
                        const mems = grouped[t.value];
                        return (
                            <div key={t.value} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60')}>
                                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{t.label}</span>
                                    <span className="ml-auto text-[10px] text-slate-400">{mems.length}</span>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {mems.map((mem) => (
                                        <div key={mem.id} className="flex items-start gap-3 p-3 group hover:bg-slate-50/50 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-slate-700 leading-relaxed">{mem.content}</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <RelevanceDots value={mem.relevance} />
                                                    {mem.source === 'auto_learned' && (
                                                        <span className="text-[10px] text-indigo-500 font-medium">auto-aprendido</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleRelevance(mem, 1)}
                                                    className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                                                    title="Aumentar relevancia"
                                                >
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleRelevance(mem, -1)}
                                                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                    title="Reducir relevancia"
                                                >
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(mem.id)}
                                                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

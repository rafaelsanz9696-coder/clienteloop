import { useState } from 'react';
import { toast } from '../../lib/toast';
import { Plus, Trash2, Edit2, Zap, Sparkles, Loader2, Search, HelpCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useBusiness } from '../../contexts/BusinessContext';
import type { QuickReply } from '../../types/index';

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    saludo: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20' },
    servicios: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20' },
    ubicacion: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', border: 'border-indigo-500/20' },
    horarios: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20' },
    seguimiento: { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-500/20' },
    general: { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-500/20' },
};

export default function QuickRepliesTab() {
    const { activeBusinessId } = useBusiness();
    const { data: replies, refetch } = useApi(() => api.getQuickReplies(), [activeBusinessId]);

    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState({ title: '', content: '', category: 'general' });
    const [saving, setSaving] = useState(false);
    const [loadingPresets, setLoadingPresets] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

    async function handleSave() {
        if (!form.title.trim() || !form.content.trim()) return;
        setSaving(true);
        try {
            if (editingId) {
                await api.updateQuickReply(editingId, form);
            } else {
                await api.createQuickReply(form);
            }
            setAdding(false);
            setEditingId(null);
            setForm({ title: '', content: '', category: 'general' });
            toast.success(editingId ? 'Plantilla actualizada con éxito' : '¡Plantilla creada con éxito!');
            refetch();
        } catch (err: any) {
            toast.error('Error: ' + (err.message || 'Intenta de nuevo'));
        } finally {
            setSaving(false);
        }
    }

    async function handleLoadPresets() {
        if (
            replies &&
            replies.length > 0 &&
            !confirm(
                '¿Deseas cargar las 5 plantillas premium para tu negocio? Esto reemplazará tus respuestas rápidas actuales por una biblioteca premium optimizada.'
            )
        ) {
            return;
        }
        setLoadingPresets(true);
        try {
            await api.loadQuickReplyPresets();
            toast.success('¡Respuestas Rápidas Premium cargadas con éxito!');
            refetch();
        } catch (err: any) {
            toast.error('Error al cargar plantillas: ' + (err.message || 'Intenta de nuevo'));
        } finally {
            setLoadingPresets(false);
        }
    }

    function handleEdit(qr: QuickReply) {
        setForm({ title: qr.title, content: qr.content, category: qr.category || 'general' });
        setEditingId(qr.id);
        setAdding(true);
    }

    async function handleDelete(id: number) {
        if (!confirm('¿Eliminar esta plantilla definitivamente?')) return;
        try {
            await api.deleteQuickReply(id);
            toast.success('Plantilla eliminada');
            refetch();
        } catch (err) {
            toast.error('Error al eliminar');
        }
    }

    // Categories present in replies for filter chips
    const categories = ['all', ...Array.from(new Set((replies || []).map(r => r.category || 'general')))];

    // Filtered replies
    const filteredReplies = (replies || []).filter(qr => {
        const matchesSearch =
            qr.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            qr.content.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory =
            selectedCategoryFilter === 'all' || (qr.category || 'general') === selectedCategoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-6">
            {/* Header premium banner */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200/50 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
                <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                        Biblioteca de Respuestas Rápidas Premium
                    </h3>
                    <p className="text-sm text-slate-500 max-w-xl">
                        Crea, gestiona e inyecta respuestas comerciales de alta calidad en tu Inbox de WhatsApp con variables automáticas como <code className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs font-mono">{"{{nombre}}"}</code> o <code className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-xs font-mono">{"{{booking_link}}"}</code>.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button
                        onClick={handleLoadPresets}
                        disabled={loadingPresets}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold rounded-xl shadow-md shadow-amber-500/10 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                        {loadingPresets ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generando Plantillas...
                            </>
                        ) : (
                            <>
                                <Zap className="w-4 h-4" />
                                Cargar Plantillas Premium (1-Click)
                            </>
                        )}
                    </button>
                    {!adding && (
                        <button
                            onClick={() => setAdding(true)}
                            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva Plantilla
                        </button>
                    )}
                </div>
            </div>

            {/* Adding or Editing form */}
            {adding && (
                <div className="bg-white border border-amber-200/70 rounded-2xl p-6 shadow-md space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                            {editingId ? 'Editar Plantilla Existente' : 'Diseñar Nueva Respuesta Rápida'}
                        </h4>
                        <span className="text-xs text-slate-400">Campos interactivos soportados</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Título de la Plantilla</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder="Ej: 👋 Saludo e Bienvenida"
                                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 bg-slate-50/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Categoría (Filtro rápido)</label>
                            <select
                                value={form.category}
                                onChange={e => setForm({ ...form, category: e.target.value })}
                                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 bg-slate-50/50"
                            >
                                <option value="saludo">👋 saludo (Saludos y bienvenidas)</option>
                                <option value="servicios">📋 servicios (Precios, catálogo y ofertas)</option>
                                <option value="ubicacion">📍 ubicacion (Dirección, mapas y accesos)</option>
                                <option value="horarios">🕒 horarios (Calendario y turnos libres)</option>
                                <option value="seguimiento">🚀 seguimiento (Re-engagement y dudas)</option>
                                <option value="general">⚙️ general (Respuestas de uso general)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-700 block">Cuerpo del Mensaje (Soporta Markdown)</label>
                            <div className="flex gap-1 text-[10px] text-slate-400 items-center">
                                <HelpCircle className="w-3 h-3" />
                                Tip: Escribe {"{{nombre}}"} para personalizar automáticamente
                            </div>
                        </div>
                        <textarea
                            value={form.content}
                            onChange={e => setForm({ ...form, content: e.target.value })}
                            rows={4}
                            placeholder="¡Hola, {{nombre}}! Es un gusto saludarte. ¿Cómo te podemos asistir hoy en nuestro espacio?"
                            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 bg-slate-50/50 font-sans leading-relaxed"
                        />
                    </div>

                    <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                        <button
                            onClick={() => {
                                setAdding(false);
                                setEditingId(null);
                                setForm({ title: '', content: '', category: 'general' });
                            }}
                            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !form.title.trim() || !form.content.trim()}
                            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors shadow-sm"
                        >
                            {saving ? 'Guardando...' : editingId ? 'Actualizar Plantilla' : 'Guardar Plantilla'}
                        </button>
                    </div>
                </div>
            )}

            {/* Filter and search bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 border border-slate-200/80 rounded-2xl shadow-sm">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar plantilla por título o palabra clave..."
                        className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 bg-slate-50/30"
                    />
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {categories.map(cat => {
                        const style = CATEGORY_STYLES[cat] || CATEGORY_STYLES.general;
                        const isSelected = selectedCategoryFilter === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategoryFilter(cat)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all border shrink-0 ${
                                    isSelected
                                        ? 'bg-slate-900 border-slate-900 text-white'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {cat === 'all' ? 'Ver Todos' : cat}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Grid List */}
            {filteredReplies.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredReplies.map(qr => {
                        const style = CATEGORY_STYLES[qr.category || 'general'] || CATEGORY_STYLES.general;
                        return (
                            <div
                                key={qr.id}
                                className="relative group p-5 border border-slate-200 rounded-2xl bg-white hover:border-amber-500/50 hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-bold text-slate-800 group-hover:text-slate-900 transition-colors">
                                                {qr.title}
                                            </h4>
                                            <span
                                                className={`text-[9px] font-extrabold uppercase ${style.bg} ${style.text} px-2 py-0.5 rounded-full border ${style.border} tracking-wide inline-block`}
                                            >
                                                {qr.category || 'general'}
                                            </span>
                                        </div>

                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                            <button
                                                onClick={() => handleEdit(qr)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors shadow-sm bg-white"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(qr.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-100 hover:border-red-200 transition-colors shadow-sm bg-white"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                        {qr.content}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-6 h-6 text-amber-500" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">
                        {searchTerm || selectedCategoryFilter !== 'all'
                            ? 'No se encontraron plantillas'
                            : 'No tienes respuestas rápidas aún'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                        {searchTerm || selectedCategoryFilter !== 'all'
                            ? 'Prueba modificando tus filtros de búsqueda o categoría.'
                            : 'Crea una nueva plantilla manualmente o haz clic en "Cargar Plantillas Premium" arriba para rellenar automáticamente la biblioteca de tu negocio.'}
                    </p>
                    {(!searchTerm && selectedCategoryFilter === 'all') && (
                        <button
                            onClick={handleLoadPresets}
                            disabled={loadingPresets}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl shadow transition-colors inline-flex items-center gap-1.5"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Cargar Biblioteca Premium
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

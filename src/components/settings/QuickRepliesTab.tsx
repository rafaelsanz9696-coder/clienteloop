import { useState } from 'react';
import { Plus, Trash2, Edit2, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useBusiness } from '../../contexts/BusinessContext';
import type { QuickReply } from '../../types/index';

export default function QuickRepliesTab() {
    const { activeBusinessId } = useBusiness();
    const { data: replies, refetch } = useApi(() => api.getQuickReplies(), [activeBusinessId]);

    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState({ title: '', content: '', category: 'general' });
    const [saving, setSaving] = useState(false);

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
            refetch();
        } catch (err: any) {
            alert('Error: ' + (err.message || 'Intenta de nuevo'));
        } finally {
            setSaving(false);
        }
    }

    function handleEdit(qr: QuickReply) {
        setForm({ title: qr.title, content: qr.content, category: qr.category || 'general' });
        setEditingId(qr.id);
        setAdding(true);
    }

    async function handleDelete(id: number) {
        if (!confirm('¿Eliminar esta plantilla?')) return;
        try {
            await api.deleteQuickReply(id);
            refetch();
        } catch (err) {
            alert('Error al eliminar');
        }
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Plantillas y Respuestas Rápidas
                </h3>
                <p className="text-xs text-slate-400">
                    Crea mensajes predefinidos para responder más rápido en tu Inbox. Puedes usar variables como {'{{nombre}}'} o {'{{canal}}'}.
                </p>
            </div>

            {adding ? (
                <div className="border border-amber-200 bg-amber-50/30 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Título</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder="Ej: Saludo inicial"
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Categoría</label>
                            <input
                                type="text"
                                value={form.category}
                                onChange={e => setForm({ ...form, category: e.target.value })}
                                placeholder="Ej: precios, saludo, info"
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Contenido del Mensaje</label>
                        <textarea
                            value={form.content}
                            onChange={e => setForm({ ...form, content: e.target.value })}
                            rows={4}
                            placeholder="Hola {{nombre}}, ¿en qué te puedo ayudar hoy?"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        />
                    </div>
                    <div className="flex gap-2 justify-end pt-2 border-t border-amber-100">
                        <button
                            onClick={() => { setAdding(false); setEditingId(null); setForm({ title: '', content: '', category: 'general' }); }}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !form.title.trim() || !form.content.trim()}
                            className="px-4 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-colors shadow-sm"
                        >
                            {saving ? 'Guardando...' : editingId ? 'Actualizar Plantilla' : 'Crear Plantilla'}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setAdding(true)}
                    className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Plantilla
                </button>
            )}

            {replies && replies.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {replies.map(qr => (
                        <div key={qr.id} className="relative group p-4 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">{qr.title}</h4>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                                        {qr.category}
                                    </span>
                                </div>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                    <button onClick={() => handleEdit(qr)} className="p-1.5 text-slate-400 hover:text-blue-500 bg-white rounded-md border border-slate-200 hover:border-blue-200 shadow-sm transition-colors">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(qr.id)} className="p-1.5 text-slate-400 hover:text-red-500 bg-white rounded-md border border-slate-200 hover:border-red-200 shadow-sm transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-slate-600 whitespace-pre-wrap">{qr.content}</p>
                        </div>
                    ))}
                </div>
            ) : (
                !adding && (
                    <p className="text-sm text-slate-400 py-4 text-center">
                        Aún no tienes respuestas rápidas.
                    </p>
                )
            )}
        </div>
    );
}

import { useState, useEffect, useCallback } from 'react';
import { Brain, Lightbulb, AlertTriangle, TrendingUp, Sparkles, RefreshCw, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Insight {
    type: 'opportunity' | 'alert' | 'pattern' | 'suggestion';
    title: string;
    description: string;
    action: string;
    priority: 'high' | 'medium' | 'low';
}

interface InsightsData {
    insights: Insight[];
    summary: string;
    error?: boolean;
}

const TYPE_CONFIG = {
    opportunity: { icon: TrendingUp, color: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500', label: 'Oportunidad' },
    alert: { icon: AlertTriangle, color: 'bg-red-50 border-red-200 text-red-700', dot: 'bg-red-500', label: 'Alerta' },
    pattern: { icon: Brain, color: 'bg-purple-50 border-purple-200 text-purple-700', dot: 'bg-purple-500', label: 'Patrón detectado' },
    suggestion: { icon: Lightbulb, color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500', label: 'Sugerencia' },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function AIInsightsPanel() {
    const [data, setData] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const fetchInsights = useCallback(async () => {
        setLoading(true);
        try {
            const { supabase } = await import('../../lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const BASE = import.meta.env.VITE_API_URL || '/api';
            const res = await fetch(`${BASE}/ai/insights`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
                const json = await res.json();
                setData(json);
                setLastRefresh(new Date());
            }
        } catch {
            setData({ insights: [], summary: 'Error al cargar insights.', error: true });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInsights();
        // Auto-refresh every 10 minutes
        const timer = setInterval(fetchInsights, 10 * 60 * 1000);
        return () => clearInterval(timer);
    }, [fetchInsights]);

    const sorted = [...(data?.insights ?? [])].sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/80">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-800">Agente IA — Insights</p>
                        {lastRefresh && (
                            <p className="text-[10px] text-slate-400">
                                Actualizado {lastRefresh.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                </div>
                <button
                    onClick={fetchInsights}
                    disabled={loading}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
                    title="Actualizar insights"
                >
                    <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                </button>
            </div>

            {/* Summary */}
            {data?.summary && !loading && (
                <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100">
                    <p className="text-xs text-slate-600 italic">"{data.summary}"</p>
                </div>
            )}

            {/* Insights list */}
            <div className="divide-y divide-slate-50">
                {loading ? (
                    <div className="flex items-center justify-center py-8 gap-2">
                        <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                        <span className="text-xs text-slate-400">El agente está analizando tu negocio...</span>
                    </div>
                ) : sorted.length === 0 ? (
                    <div className="py-8 text-center">
                        <Brain className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">Sin suficientes datos aún.</p>
                        <p className="text-[10px] text-slate-300 mt-0.5">El agente aprende con cada conversación.</p>
                    </div>
                ) : (
                    sorted.map((insight, i) => {
                        const cfg = TYPE_CONFIG[insight.type] ?? TYPE_CONFIG.suggestion;
                        const Icon = cfg.icon;
                        return (
                            <div key={i} className="p-3 hover:bg-slate-50/60 transition-colors group">
                                <div className="flex items-start gap-2.5">
                                    <div className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0 border', cfg.color)}>
                                        <Icon className="w-3 h-3" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{cfg.label}</span>
                                            {insight.priority === 'high' && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-xs font-semibold text-slate-800 leading-snug">{insight.title}</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{insight.description}</p>
                                        {/* Action */}
                                        <div className="flex items-center gap-1 mt-1.5">
                                            <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0" />
                                            <p className="text-[11px] text-indigo-600 font-medium">{insight.action}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

import { useState } from 'react';
import { TrendingUp, Users, DollarSign, Kanban, Trophy } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import { cn, formatCurrency, getChannelColor, getChannelLabel } from '../lib/utils';
import LoadingSpinner from '../components/ui/LoadingSpinner';

type Range = '7d' | '30d' | '3m' | '1y';

const RANGES: { key: Range; label: string; days: number }[] = [
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '30 días', days: 30 },
  { key: '3m', label: '3 meses', days: 90 },
  { key: '1y', label: '1 año', days: 365 },
];

const STAGE_COLORS: Record<string, string> = {
  new: '#3b82f6',
  in_progress: '#f59e0b',
  closed: '#10b981',
};

const STAGE_LABELS: Record<string, string> = {
  new: 'Nuevos',
  in_progress: 'En Proceso',
  closed: 'Cerrados',
};

export default function ReportsPage() {
  const { activeBusinessId } = useBusiness();
  const [range, setRange] = useState<Range>('30d');

  const { from, to } = (() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const t = new Date();
    const f = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return {
      from: f.toISOString().split('T')[0],
      to: t.toISOString().split('T')[0],
    };
  })();

  const { data, loading } = useApi(() => api.getReports(from, to), [from, to, activeBusinessId]);

  if (loading || !data) return <LoadingSpinner text="Cargando reportes..." />;

  const funnelData = [
    { stage: 'new', label: 'Nuevos', count: data.funnel.new },
    { stage: 'in_progress', label: 'En Proceso', count: data.funnel.in_progress },
    { stage: 'closed', label: 'Cerrados', count: data.funnel.closed },
  ];
  const totalFunnel = funnelData.reduce((s, f) => s + f.count, 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header + range */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800">Reportes</h2>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                range === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Leads Nuevos',
            value: String(data.totalLeads),
            sub: 'En el período',
            icon: Users,
            color: 'from-emerald-500 to-emerald-600',
          },
          {
            label: 'Conversión',
            value: `${data.conversionRate}%`,
            sub: 'Deals cerrados',
            icon: TrendingUp,
            color: 'from-blue-500 to-blue-600',
          },
          {
            label: 'Ingresos',
            value: formatCurrency(data.revenue),
            sub: 'Deals cerrados',
            icon: DollarSign,
            color: 'from-orange-500 to-orange-600',
          },
          {
            label: 'Deals Activos',
            value: String(data.activeDeals),
            sub: 'Nuevos + en proceso',
            icon: Kanban,
            color: 'from-violet-500 to-violet-600',
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className={cn('rounded-2xl p-5 text-white bg-gradient-to-br', color)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium opacity-90">{label}</span>
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold">{value}</div>
            <div className="text-xs opacity-75 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 mb-4">Leads por día</h3>
          {data.chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">Sin datos para el período seleccionado</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chartData}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLeads)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Pipeline funnel */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 mb-4">Pipeline</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={80} />
                <Tooltip
                  formatter={(v: any) => [v, 'Deals']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {funnelData.map((entry) => (
                    <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {totalFunnel > 0 && (
            <div className="mt-3 space-y-1.5">
              {funnelData.map(({ stage, label, count }) => (
                <div key={stage} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STAGE_COLORS[stage] }} />
                    <span className="text-slate-600">{label}</span>
                  </div>
                  <span className="font-semibold text-slate-700">{Math.round((count / totalFunnel) * 100)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Channel breakdown + avg response time */}
      {data.channelBreakdown && data.channelBreakdown.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="font-bold text-slate-800 mb-4">Leads por canal</h3>
            <div className="space-y-3">
              {data.channelBreakdown.map(({ channel, count }) => {
                const pct = data.totalLeads > 0 ? Math.round((count / data.totalLeads) * 100) : 0;
                return (
                  <div key={channel}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={cn('px-1.5 py-0.5 rounded font-medium', getChannelColor(channel))}>
                        {getChannelLabel(channel)}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {count} <span className="text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {data.avgResponseMinutes !== null && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col justify-between">
              <h3 className="font-bold text-slate-800 mb-2">Tiempo de respuesta</h3>
              <div>
                <div className="text-4xl font-bold text-blue-600">
                  {data.avgResponseMinutes < 60
                    ? `${data.avgResponseMinutes} min`
                    : `${Math.round(data.avgResponseMinutes / 60)}h`}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Promedio entre mensaje del cliente y primera respuesta del equipo o IA
                </p>
              </div>
              <div className={cn(
                'mt-3 text-xs font-medium rounded-lg px-3 py-2',
                data.avgResponseMinutes <= 5
                  ? 'text-emerald-700 bg-emerald-50'
                  : data.avgResponseMinutes <= 30
                  ? 'text-amber-700 bg-amber-50'
                  : 'text-red-700 bg-red-50'
              )}>
                {data.avgResponseMinutes <= 5
                  ? '🟢 Excelente — menos de 5 min'
                  : data.avgResponseMinutes <= 30
                  ? '🟡 Bueno — menos de 30 min'
                  : '🔴 Mejorable — más de 30 min'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top contacts */}
      {data.topContacts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-800">Top Contactos por Valor</h3>
          </div>
          <div className="space-y-3">
            {data.topContacts.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="w-6 text-xs font-bold text-slate-400 text-right shrink-0">#{i + 1}</span>
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 truncate">{c.name}</span>
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0', getChannelColor(c.channel))}>
                      {getChannelLabel(c.channel)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{c.deal_count} deal{c.deal_count !== 1 ? 's' : ''} cerrado{c.deal_count !== 1 ? 's' : ''}</span>
                </div>
                <span className="text-sm font-bold text-emerald-600 shrink-0">{formatCurrency(c.total_value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

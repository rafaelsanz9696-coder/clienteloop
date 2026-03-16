import { useEffect, useState } from 'react';
import {
  Users,
  Calendar,
  DollarSign,
  CheckCircle2,
  MessageSquare,
  Plus,
  Send,
  MoreHorizontal,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
} from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import InfoTooltip from '../components/ui/Tooltip';
import { useNavigate } from 'react-router-dom';
import AIInsightsPanel from '../components/dashboard/AIInsightsPanel';
import AISetupAssistant from '../components/AISetupAssistant';

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  delay = 0,
  tooltip,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  gradient: string;
  delay?: number;
  tooltip?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className={cn(
      'relative overflow-hidden p-6 rounded-2xl text-white shadow-lg group cursor-default',
      gradient
    )}
  >
    <div className="flex items-center justify-between relative z-10">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight">{value}</span>
          <span className="text-lg font-medium opacity-90 flex items-center gap-1">
            {title}
            {tooltip && <InfoTooltip text={tooltip} />}
          </span>
        </div>
        <p className="text-sm opacity-75 mt-1 font-medium">{subtitle}</p>
      </div>
      <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
        <Icon className="w-8 h-8 text-white" />
      </div>
    </div>
    <Icon className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-500" />
  </motion.div>
);

const TaskItem = ({
  title,
  time,
  status,
  onComplete,
}: {
  title: string;
  time: string;
  status: string;
  onComplete?: () => void;
}) => (
  <div className="group flex items-center p-4 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100 last:border-0">
    <button
      onClick={onComplete}
      className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all mr-4 shrink-0"
    >
      <CheckCircle2 className="w-5 h-5" />
    </button>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-800 truncate">{title}</p>
      <p className="text-xs text-slate-400">
        {time} - {status}
      </p>
    </div>
    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" />
  </div>
);

const PipelineCard = ({
  name,
  status,
  color,
}: {
  name: string;
  status: string;
  color: string;
}) => (
  <div
    className={cn(
      'p-3 rounded-xl border mb-3 last:mb-0 transition-all hover:shadow-md',
      color === 'blue'
        ? 'bg-blue-50/50 border-blue-100'
        : color === 'green'
          ? 'bg-green-50/50 border-green-100'
          : 'bg-slate-50/50 border-slate-100'
    )}
  >
    <div className="flex items-center mb-1">
      <CheckCircle2
        className={cn(
          'w-3 h-3 mr-2',
          color === 'blue'
            ? 'text-blue-500'
            : color === 'green'
              ? 'text-green-500'
              : 'text-slate-400'
        )}
      />
      <span className="font-bold text-slate-800 text-sm">{name}</span>
    </div>
    <span className="text-[11px] text-slate-500 block ml-5">{status}</span>
  </div>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { activeBusinessId } = useBusiness();
  const [showSetupAssistant, setShowSetupAssistant] = useState(false);
  const { data: stats, loading: statsLoading } = useApi(() => api.getStats(), [activeBusinessId]);
  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useApi(
    () => api.getTasks({ status: 'pending' }),
    [activeBusinessId]
  );
  const { data: pipeline, loading: pipelineLoading } = useApi(() => api.getPipeline(), [activeBusinessId]);
  const { data: memories } = useApi(() => api.getMemories(), [activeBusinessId]);

  if (statsLoading || tasksLoading || pipelineLoading) {
    return <LoadingSpinner text="Cargando dashboard..." />;
  }

  const chartData = stats?.chartData || [];
  const pendingTasks = tasks || [];
  const pipelineNew = pipeline?.new || [];
  const pipelineInProgress = pipeline?.in_progress || [];
  const pipelineClosed = pipeline?.closed || [];

  async function handleCompleteTask(taskId: number) {
    await api.completeTask(taskId);
    refetchTasks();
  }

  return (
    <>
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Nuevos Leads"
          value={String(stats?.newLeadsToday || 0)}
          subtitle="Hoy"
          icon={Users}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          delay={0.1}
          tooltip="Personas que contactaron tu negocio por primera vez hoy"
        />
        <StatCard
          title="Citas Agendadas"
          value={String(stats?.appointmentsThisWeek || 0)}
          subtitle="Esta Semana"
          icon={Calendar}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          delay={0.2}
          tooltip="Tareas programadas con fecha creadas esta semana (citas, llamadas, seguimientos)"
        />
        <StatCard
          title="Ingresos del Mes"
          value={formatCurrency(stats?.revenueThisMonth || 0)}
          subtitle={`Crecimiento ${(stats?.growthPercent || 0) >= 0 ? '+' : ''}${stats?.growthPercent || 0}%`}
          icon={DollarSign}
          gradient="bg-gradient-to-br from-orange-500 to-orange-600"
          delay={0.3}
          tooltip="Suma de deals cerrados en el mes actual en tu pipeline"
        />
        <StatCard
          title="Conv. Abiertas"
          value={String(stats?.openConversations || 0)}
          subtitle="Sin resolver"
          icon={MessageSquare}
          gradient="bg-gradient-to-br from-violet-500 to-violet-600"
          delay={0.4}
          tooltip="Chats activos que aún no han sido resueltos. Haz clic para ir al Inbox."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* AI Insights Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
          >
            <AIInsightsPanel />
          </motion.div>

          {/* AI Setup Banner — shown when no memories configured yet */}
          {Array.isArray(memories) && memories.length === 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.38 }}
              className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-5 text-white shadow-lg"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Configura tu IA en 2 min</h3>
                  <p className="text-white/70 text-xs mt-0.5">
                    Cuéntale a tu asistente sobre tu negocio y generamos todo automáticamente.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSetupAssistant(true)}
                className="w-full py-2.5 bg-white text-purple-600 font-bold text-sm rounded-xl hover:bg-white/90 transition-colors"
              >
                ✨ Configurar con IA
              </button>
            </motion.div>
          )}

          {/* Tasks */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
          >
            <div className="p-5 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Tareas Pendientes</h3>
              <button
                onClick={() => navigate('/tasks')}
                className="text-slate-400 hover:text-blue-500"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
            <div>
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-slate-400 p-5 text-center">
                  No hay tareas pendientes
                </p>
              ) : (
                pendingTasks.slice(0, 4).map((task) => (
                  <TaskItem
                    key={task.id}
                    title={task.title}
                    time={task.due_time || 'Sin fecha'}
                    status={task.contact_name || 'Sin contacto'}
                    onComplete={() => handleCompleteTask(task.id)}
                  />
                ))
              )}
            </div>
          </motion.div>

          {/* Quick actions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 leading-tight">Inbox</h3>
                  <p className="text-xs text-slate-400">
                    {stats?.openConversations || 0} conversaciones abiertas
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/inbox')}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
            >
              Ver Inbox
            </button>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/contacts')}
              className="flex items-center justify-center space-x-2 py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 transition-all text-sm"
            >
              <Plus className="w-5 h-5" />
              <span>Nuevo Lead</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/inbox')}
              className="flex items-center justify-center space-x-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 transition-all text-sm"
            >
              <Send className="w-5 h-5" />
              <span>Enviar</span>
            </motion.button>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Pipeline Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
          >
            <div className="p-5 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Pipeline de Ventas</h3>
              <button
                onClick={() => navigate('/pipeline')}
                className="text-xs font-medium text-blue-500 hover:text-blue-600"
              >
                Ver todo
              </button>
            </div>
            <div className="grid grid-cols-3">
              <div className="border-r border-slate-50">
                <div className="bg-slate-800 text-white text-center py-2 text-xs font-bold uppercase tracking-wider">
                  Nuevos ({pipelineNew.length})
                </div>
                <div className="p-3">
                  {pipelineNew.slice(0, 3).map((deal) => (
                    <PipelineCard
                      key={deal.id}
                      name={deal.contact_name || deal.title}
                      status={deal.title}
                      color="blue"
                    />
                  ))}
                  {pipelineNew.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Sin deals</p>
                  )}
                </div>
              </div>
              <div className="border-r border-slate-50">
                <div className="bg-slate-800 text-white text-center py-2 text-xs font-bold uppercase tracking-wider">
                  En Proceso ({pipelineInProgress.length})
                </div>
                <div className="p-3">
                  {pipelineInProgress.slice(0, 3).map((deal) => (
                    <PipelineCard
                      key={deal.id}
                      name={deal.contact_name || deal.title}
                      status={deal.title}
                      color="green"
                    />
                  ))}
                  {pipelineInProgress.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Sin deals</p>
                  )}
                </div>
              </div>
              <div>
                <div className="bg-slate-800 text-white text-center py-2 text-xs font-bold uppercase tracking-wider">
                  Cerrados ({pipelineClosed.length})
                </div>
                <div className="p-3">
                  {pipelineClosed.slice(0, 3).map((deal) => (
                    <PipelineCard
                      key={deal.id}
                      name={deal.contact_name || deal.title}
                      status={deal.title}
                      color="slate"
                    />
                  ))}
                  {pipelineClosed.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Sin deals</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Statistics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
              <h3 className="font-bold text-slate-800 text-lg">
                Estadisticas de Rendimiento
              </h3>
              <div className="flex items-center space-x-5 text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-emerald-400 rounded-full mr-2" />
                  <span className="text-slate-500">Leads</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
                  <span className="text-slate-500">Citas</span>
                </div>
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-orange-400 rounded-full mr-2" />
                  <span className="text-slate-500">Ventas</span>
                </div>
              </div>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorLeads)"
                  />
                  <Area
                    type="monotone"
                    dataKey="citas"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorCitas)"
                  />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="#fb923c"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#fb923c', strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 mt-6 pt-6 border-t border-slate-50">
              <div className="text-center">
                <div className="flex items-center justify-center text-emerald-500 font-bold text-2xl mb-1">
                  <TrendingUp className="w-5 h-5 mr-1" />
                  <span>+{stats?.growthPercent || 0}%</span>
                </div>
                <span className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">
                  Esta Semana
                </span>
              </div>
              <div className="text-center">
                <span className="block text-2xl font-bold text-slate-800 mb-1">
                  {stats?.appointmentsThisWeek || 0} Citas
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">
                  Realizadas
                </span>
              </div>
              <div className="text-center">
                <span className="block text-2xl font-bold text-slate-800 mb-1">
                  {pipelineClosed.length} Ventas
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">
                  Confirmadas
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>

    {showSetupAssistant && (
      <AISetupAssistant
        onClose={() => setShowSetupAssistant(false)}
        onDone={() => navigate('/inbox')}
      />
    )}
    </>
  );
}

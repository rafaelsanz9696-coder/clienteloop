import { useState } from 'react';
import { CheckCircle2, Circle, Plus, X, Clock, User, Trash2 } from 'lucide-react';
import { cn, formatRelativeTime } from '../lib/utils';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useBusiness } from '../contexts/BusinessContext';
import type { Task } from '../types/index';
import LoadingSpinner from '../components/ui/LoadingSpinner';

function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.createTask({ title, due_time: dueTime || null });
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
          <h3 className="font-bold text-slate-800">Nueva Tarea</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Titulo *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Ej: Llamar a Juan Perez"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Fecha/Hora</label>
            <input
              type="text"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              placeholder="Ej: Manana 10:00 AM"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Crear Tarea'}
          </button>
        </form>
      </div>
    </div>
  );
}

function TaskItem({
  task,
  onComplete,
  onDelete,
}: {
  task: Task;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const isDone = task.status === 'done';
  return (
    <div className={cn('flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 group transition-all', isDone && 'opacity-60')}>
      <button
        onClick={onComplete}
        disabled={isDone}
        className={cn(
          'shrink-0 transition-colors',
          isDone ? 'text-green-500' : 'text-slate-300 hover:text-blue-500'
        )}
      >
        {isDone ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium text-slate-800', isDone && 'line-through')}>
          {task.title}
        </p>
        <div className="flex items-center gap-3 mt-1">
          {task.due_time && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" /> {task.due_time}
            </span>
          )}
          {task.contact_name && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <User className="w-3 h-3" /> {task.contact_name}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function TasksPage() {
  const { activeBusinessId } = useBusiness();
  const [filter, setFilter] = useState<string>('pending');
  const [showCreate, setShowCreate] = useState(false);

  const { data: tasks, loading, refetch } = useApi(
    () => filter ? api.getTasks({ status: filter }) : api.getTasks(),
    [filter, activeBusinessId]
  );

  async function handleComplete(id: number) {
    await api.completeTask(id);
    refetch();
  }

  async function handleDelete(id: number) {
    await api.deleteTask(id);
    refetch();
  }

  if (loading) return <LoadingSpinner text="Cargando tareas..." />;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-slate-800">Tareas</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva Tarea
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-5">
        {[
          { value: 'pending', label: 'Pendientes' },
          { value: 'done', label: 'Completadas' },
          { value: '', label: 'Todas' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              filter === value
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-500 hover:bg-slate-100'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {(!tasks || tasks.length === 0) ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {filter === 'pending' ? 'No hay tareas pendientes' : 'No hay tareas'}
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onComplete={() => handleComplete(task.id)}
              onDelete={() => handleDelete(task.id)}
            />
          ))
        )}
      </div>

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={refetch} />}
    </div>
  );
}

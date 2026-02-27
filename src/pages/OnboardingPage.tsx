import { useState } from 'react';
import { Building2, ChevronRight } from 'lucide-react';
import { useBusiness } from '../contexts/BusinessContext';
import { useAuth } from '../contexts/AuthContext';

const NICHOS = [
  { value: 'salon',        label: 'Salón de Belleza',           emoji: '💇' },
  { value: 'barberia',     label: 'Barbería',                    emoji: '✂️' },
  { value: 'clinica',      label: 'Clínica / Consultorio',       emoji: '🏥' },
  { value: 'inmobiliaria', label: 'Inmobiliaria',                emoji: '🏠' },
  { value: 'restaurante',  label: 'Restaurante / Taquería',      emoji: '🍽️' },
  { value: 'academia',     label: 'Academia / Centro Educativo', emoji: '📚' },
  { value: 'taller',       label: 'Taller Mecánico',             emoji: '🔧' },
  { value: 'courier',      label: 'Courier / Mensajería',        emoji: '📦' },
  { value: 'agencia_ia',   label: 'Agencia de IA / Automatización', emoji: '🤖' },
];

const PLACEHOLDERS: Record<string, string> = {
  salon:        'Ej: Salón Bella Vista',
  barberia:     'Ej: Barbería El Navajero',
  clinica:      'Ej: Clínica Salud Total',
  inmobiliaria: 'Ej: Inmobiliaria Los Álamos',
  restaurante:  'Ej: Tacos El Patrón',
  academia:     'Ej: Academia Futuro',
  taller:       'Ej: Taller Martínez',
  courier:      'Ej: Courier Express RD',
  agencia_ia:   'Ej: AutomatizaLab',
};

export default function OnboardingPage() {
  const { createBusiness } = useBusiness();
  const { user, signOut } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [nicho, setNicho] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNicho = NICHOS.find((n) => n.value === nicho);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !nicho) return;
    setSaving(true);
    setError(null);
    try {
      await createBusiness(name.trim(), nicho);
      // BusinessContext auto-switches to new business;
      // App.tsx gates on businesses.length > 0 → dashboard appears
    } catch (err: any) {
      setError(err.message || 'Error al crear el negocio. Intenta de nuevo.');
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-900/50">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Bienvenido a ClienteLoop
          </h1>
          <p className="text-slate-400 text-sm">
            Hola, <span className="text-slate-200 font-medium">{user?.email}</span>.
            {' '}Vamos a configurar tu primer negocio.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s <= step ? 'w-8 bg-blue-500' : 'w-4 bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* ── Step 1: Choose nicho ── */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1 text-center">
              ¿Qué tipo de negocio tienes?
            </h2>
            <p className="text-slate-500 text-sm text-center mb-6">
              Elegimos la IA especializada para tu industria.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              {NICHOS.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  onClick={() => setNicho(value)}
                  className={`
                    p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98]
                    ${nicho === value
                      ? 'border-blue-500 bg-blue-600/20 text-white shadow-md shadow-blue-900/40'
                      : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                    }
                  `}
                >
                  <div className="text-2xl mb-2">{emoji}</div>
                  <div className="text-sm font-medium leading-snug">{label}</div>
                </button>
              ))}
            </div>

            <button
              disabled={!nicho}
              onClick={() => setStep(2)}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30"
            >
              Continuar
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ── Step 2: Business name ── */}
        {step === 2 && (
          <form onSubmit={handleCreate} className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8">
            {/* Back button */}
            <button
              type="button"
              onClick={() => { setStep(1); setError(null); }}
              className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors"
            >
              ← Cambiar tipo de negocio
            </button>

            {/* Selected nicho badge */}
            {selectedNicho && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full text-blue-300 text-sm mb-5">
                <span>{selectedNicho.emoji}</span>
                <span>{selectedNicho.label}</span>
              </div>
            )}

            <h2 className="text-xl font-bold text-white mb-1">
              ¿Cómo se llama tu negocio?
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Puedes cambiarlo después desde Ajustes.
            </p>

            <div className="mb-6">
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Nombre del negocio *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                maxLength={100}
                placeholder={PLACEHOLDERS[nicho] ?? 'Ej: Mi negocio'}
                className="w-full px-4 py-3.5 bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/30"
            >
              {saving ? 'Creando tu negocio...' : '¡Entrar al panel →'}
            </button>
          </form>
        )}

        {/* Sign out link */}
        <div className="text-center mt-10">
          <button
            onClick={signOut}
            className="text-slate-600 hover:text-slate-400 text-sm transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

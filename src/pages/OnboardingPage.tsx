import { useState } from 'react';
import { Building2, ChevronRight, ChevronLeft, Clock, Sparkles, Check } from 'lucide-react';
import { useBusiness } from '../contexts/BusinessContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

const NICHOS = [
  { value: 'salon', label: 'Salón de Belleza', emoji: '💇', context: 'cortes, tintes, tratamientos, uñas, depilación' },
  { value: 'barberia', label: 'Barbería', emoji: '✂️', context: 'cortes de cabello, barba, afeitado clásico' },
  { value: 'clinica', label: 'Clínica / Consultorio', emoji: '🏥', context: 'consultas médicas, especialidades, agendamiento de citas' },
  { value: 'inmobiliaria', label: 'Inmobiliaria', emoji: '🏠', context: 'propiedades en venta y alquiler, visitas, financiamiento' },
  { value: 'restaurante', label: 'Restaurante / Taquería', emoji: '🍽️', context: 'menú, reservas, delivery, horarios de atención' },
  { value: 'academia', label: 'Academia / Centro Educativo', emoji: '📚', context: 'cursos, inscripciones, costos, horarios de clases' },
  { value: 'taller', label: 'Taller Mecánico', emoji: '🔧', context: 'servicios de reparación, diagnóstico, presupuestos' },
  { value: 'courier', label: 'Courier / Mensajería', emoji: '📦', context: 'envíos, tarifas por zona, rastreo de paquetes' },
  { value: 'agencia_ia',   label: 'Agencia de IA / Automatización',  emoji: '🤖', context: 'automatización de procesos, chatbots, servicios de IA' },
  { value: 'vidrieria',   label: 'Vidriería / Cristalería',          emoji: '🪟', context: 'vidrios, espejos, shower enclosures, puertas y ventanas de vidrio' },
  { value: 'carpinteria', label: 'Carpintería / Ebanistería',         emoji: '🪵', context: 'muebles a medida, closets, cocinas, puertas, madera y derivados' },
  { value: 'construccion',label: 'Construcción / Remodelación',       emoji: '🏗️', context: 'construcción nueva, remodelaciones, ampliaciones, acabados' },
];

const PLACEHOLDERS: Record<string, string> = {
  salon: 'Ej: Salón Bella Vista',
  barberia: 'Ej: Barbería El Navajero',
  clinica: 'Ej: Clínica Salud Total',
  inmobiliaria: 'Ej: Inmobiliaria Los Álamos',
  restaurante: 'Ej: Tacos El Patrón',
  academia: 'Ej: Academia Futuro',
  taller: 'Ej: Taller Martínez',
  courier: 'Ej: Courier Express RD',
  agencia_ia:   'Ej: AutomatizaLab',
  vidrieria:    'Ej: Miami Glass & Mirrors',
  carpinteria:  'Ej: Carpintería Artesanal Pérez',
  construccion: 'Ej: Construcciones López y Asociados',
};

const CONTEXT_PLACEHOLDERS: Record<string, string> = {
  salon: 'Ej: Ofrecemos cortes desde $300, tintes desde $600, manicure y pedicure. Usamos productos Wella y L\'Oréal. No trabajamos con pago a plazos. Tenemos estacionamiento.',
  barberia: 'Ej: Corte clásico $150, fade $200, barba $100. Servicio sin cita previa. Precio especial para estudiantes con credencial.',
  clinica: 'Ej: Consulta general $400. Especialidades: pediatría, ginecología, medicina interna. Aceptamos seguros Banreservas y ARS Salud Segura.',
  inmobiliaria: 'Ej: Especialistas en propiedades en el Este. Gestión de alquileres desde $15,000 pesos. Coordinamos apartamentos, casas y locales comerciales.',
  restaurante: 'Ej: Menú del día $120, especiales de martes a viernes. Delivery disponible en un radio de 3km. Reservas hasta 20 personas.',
  academia: 'Ej: Cursos de inglés, programación y diseño gráfico. Modalidades presencial y online. Duración: 3 meses, 2 horas por semana. Certificado al finalizar.',
  taller: 'Ej: Mecánica general, frenos, suspensión, alineación. Presupuesto gratis. Garantía de 30 días en mano de obra. Recibimos todos los modelos.',
  courier: 'Ej: Envíos dentro de la ciudad $150. Entregas el mismo día si reservas antes de las 12pm. Tarifas especiales para empresas.',
  agencia_ia:   'Ej: Desarrollamos chatbots, automatizaciones con n8n y Make, integraciones con WhatsApp Business API. Proyectos desde $500 USD.',
  vidrieria:    'Ej: Shower enclosures frameless, espejos a medida, vidrio templado e impacto. Medición gratis en Miami-Dade. Garantía 1 año en instalación.',
  carpinteria:  'Ej: Closets a medida en melamina y madera, cocinas integrales, muebles de sala. Fabricación en taller propio. Entrega e instalación incluidas. Garantía 2 años.',
  construccion: 'Ej: Remodelaciones residenciales y comerciales en Miami-Dade. Gestionamos permisos. Equipo propio de albañilería, pisos y pintura. Presupuesto sin costo.',
};

const HOURS_OPTIONS = [
  'Lun–Vie 9:00–18:00, Sáb 9:00–14:00, Dom cerrado',
  'Lun–Vie 8:00–20:00, Sáb 9:00–17:00, Dom cerrado',
  'Lun–Dom 10:00–22:00',
  'Lun–Vie 8:00–17:00, fin de semana cerrado',
];

const TOTAL_STEPS = 4;

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all duration-300',
            i < current
              ? 'w-6 h-1.5 bg-blue-500'
              : i === current
                ? 'w-8 h-1.5 bg-blue-500'
                : 'w-4 h-1.5 bg-slate-700',
          )}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const { createBusiness } = useBusiness();
  const { user, signOut } = useAuth();

  const [step, setStep] = useState(0); // 0-3
  const [nicho, setNicho] = useState('');
  const [name, setName] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNicho = NICHOS.find((n) => n.value === nicho);

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); setError(null); }

  async function handleFinish() {
    if (!name.trim() || !nicho) return;
    setSaving(true);
    setError(null);
    try {
      const biz = await createBusiness(name.trim(), nicho);
      // After creating, patch the extra fields if provided
      if ((aiContext.trim() || workingHours.trim()) && biz?.id) {
        await api.updateBusiness(biz.id, {
          ai_context: aiContext.trim() || selectedNicho?.context || '',
          working_hours: workingHours.trim() || 'Lun–Vie 9:00–18:00',
        } as any);
      }
      // BusinessContext auto-switches → App.tsx shows dashboard
    } catch (err: any) {
      setError(err.message || 'Error al crear el negocio. Intenta de nuevo.');
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Brand header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-900/50">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Configura tu negocio</h1>
          <p className="text-slate-500 text-sm">
            Hola, <span className="text-slate-300 font-medium">{user?.email}</span> · Solo 4 pasos rápidos
          </p>
        </div>

        <StepDots current={step} />

        {/* ── STEP 0: Nicho ── */}
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1 text-center">¿Qué tipo de negocio tienes?</h2>
            <p className="text-slate-500 text-sm text-center mb-6">
              Activamos la IA especializada para tu industria.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {NICHOS.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  onClick={() => setNicho(value)}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] relative',
                    nicho === value
                      ? 'border-blue-500 bg-blue-600/20 text-white shadow-md shadow-blue-900/40'
                      : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800',
                  )}
                >
                  {nicho === value && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <div className="text-2xl mb-2">{emoji}</div>
                  <div className="text-sm font-medium leading-snug">{label}</div>
                </button>
              ))}
            </div>
            <button
              disabled={!nicho}
              onClick={next}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30"
            >
              Continuar <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ── STEP 1: Business name ── */}
        {step === 1 && (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8">
            <button type="button" onClick={back} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Cambiar tipo
            </button>
            {selectedNicho && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full text-blue-300 text-sm mb-5">
                <span>{selectedNicho.emoji}</span>
                <span>{selectedNicho.label}</span>
              </div>
            )}
            <h2 className="text-xl font-bold text-white mb-1">¿Cómo se llama tu negocio?</h2>
            <p className="text-slate-400 text-sm mb-6">Puedes cambiarlo después desde Ajustes.</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={100}
              placeholder={PLACEHOLDERS[nicho] ?? 'Ej: Mi negocio'}
              className="w-full px-4 py-3.5 bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all mb-6"
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && next()}
            />
            <button
              disabled={!name.trim()}
              onClick={next}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30"
            >
              Continuar <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ── STEP 2: AI context / services ── */}
        {step === 2 && (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8">
            <button type="button" onClick={back} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Cuéntale a tu IA sobre tu negocio</h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              Servicios, precios, políticas. Más detalles = respuestas más precisas. Puedes saltarte esto y completarlo después.
            </p>
            <textarea
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              rows={6}
              autoFocus
              placeholder={CONTEXT_PLACEHOLDERS[nicho] ?? 'Describe tus servicios, precios y cualquier detalle importante...'}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={next}
                className="text-slate-400 hover:text-white text-sm px-4 py-3 transition-colors"
              >
                Saltar por ahora
              </button>
              <button
                onClick={next}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30"
              >
                Continuar <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Working hours + finish ── */}
        {step === 3 && (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8">
            <button type="button" onClick={back} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold text-white">¿Cuáles son tus horarios?</h2>
            </div>
            <p className="text-slate-400 text-sm mb-5">
              La IA los usa para responder preguntas sobre disponibilidad. Opcional.
            </p>

            {/* Quick-pick chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {HOURS_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setWorkingHours(opt)}
                  className={cn(
                    'text-left px-3 py-2.5 rounded-lg border text-xs font-medium transition-all',
                    workingHours === opt
                      ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                      : 'border-slate-600 bg-slate-700/40 text-slate-400 hover:border-slate-500 hover:text-slate-300',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              placeholder="O escribe tus propios horarios..."
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all mb-6"
            />

            {error && (
              <div className="mb-4 p-3 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={saving || !name.trim()}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30"
            >
              {saving ? 'Creando tu espacio...' : (
                <>¡Entrar al panel <ChevronRight className="w-5 h-5" /></>
              )}
            </button>
          </div>
        )}

        {/* Sign out */}
        <div className="text-center mt-8">
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

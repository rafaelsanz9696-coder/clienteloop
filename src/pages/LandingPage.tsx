import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import {
  MessageSquare,
  Users,
  Zap,
  BarChart3,
  Send,
  Bot,
  ArrowRight,
  Check,
  Scissors,
  Stethoscope,
  Home,
  UtensilsCrossed,
  GraduationCap,
  Wrench,
  Truck,
  Monitor,
  Star,
  ChevronDown,
  ChevronUp,
  Settings,
  Plug,
  Sparkles,
  AppWindow,
  Hammer,
  HardHat,
} from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────

const nichos = [
  { icon: Scissors,       name: 'Salon de belleza',  desc: 'Citas, servicios, precios' },
  { icon: Stethoscope,    name: 'Clinica',            desc: 'Citas medicas, seguros' },
  { icon: Home,           name: 'Inmobiliaria',       desc: 'Propiedades, visitas, financiamiento' },
  { icon: UtensilsCrossed,name: 'Restaurante',        desc: 'Menu, reservas, delivery' },
  { icon: GraduationCap,  name: 'Academia',           desc: 'Cursos, inscripciones, horarios' },
  { icon: Wrench,         name: 'Taller mecanico',    desc: 'Reparaciones, presupuestos' },
  { icon: Truck,          name: 'Mensajeria',         desc: 'Envios, rastreo, tarifas' },
  { icon: Monitor,        name: 'Agencia digital',    desc: 'Servicios, portafolio, cotizaciones' },
  { icon: AppWindow,      name: 'Vidriería',          desc: 'Vidrios, espejos, shower, instalación' },
  { icon: Hammer,         name: 'Carpintería',        desc: 'Muebles, closets, puertas, cocinas' },
  { icon: HardHat,        name: 'Construcción',       desc: 'Obras, remodelaciones, acabados' },
];

const features = [
  { icon: MessageSquare, title: 'Inbox unificado',      desc: 'WhatsApp, Instagram y email en una sola bandeja. Nunca mas pierdas un mensaje.' },
  { icon: Users,         title: 'CRM inteligente',      desc: 'Perfil de cada cliente con historial completo, notas, etiquetas y etapa en el pipeline.' },
  { icon: Bot,           title: 'IA por industria',     desc: 'Respuestas automaticas que entienden tu negocio. No es una IA generica, es tu asistente.' },
  { icon: BarChart3,     title: 'Pipeline de ventas',   desc: 'Visualiza cada oportunidad desde el primer contacto hasta el cierre.' },
  { icon: Send,          title: 'Respuestas rapidas',   desc: 'Plantillas predefinidas por categoria. Un clic y respondes en segundos.' },
  { icon: Zap,           title: 'Automatizaciones',     desc: 'Auto-respuestas, recordatorios de citas y escalamiento inteligente.' },
];

const testimonials = [
  {
    name: 'Maria Rodriguez',
    role: 'Dueña, Salon Glow',
    location: 'Santo Domingo, RD',
    rating: 5,
    text: 'Antes perdia citas porque no podia contestar WhatsApp mientras trabajaba. Ahora la IA responde, agenda y hasta manda recordatorios sola. Mis no-shows bajaron a casi cero.',
    avatar: 'MR',
    color: 'from-pink-500 to-rose-500',
  },
  {
    name: 'Carlos Mendez',
    role: 'Director, Clinica Bienestar',
    location: 'Bogota, CO',
    rating: 5,
    text: 'Teniamos 3 personas contestando WhatsApp y aun asi se nos iban mensajes. ClienteLoop unificó todo y la IA maneja el 70% de las consultas. Ese equipo ahora hace otras cosas.',
    avatar: 'CM',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Luisa Jimenez',
    role: 'Agente, Propiedades Premium',
    location: 'Ciudad de Mexico, MX',
    rating: 5,
    text: 'En inmobiliaria el seguimiento lo es todo. Antes se me olvidaban prospectos. Ahora el CRM me recuerda, la IA precalifica y yo solo cierro. Cerré 3 propiedades este mes.',
    avatar: 'LJ',
    color: 'from-emerald-500 to-teal-500',
  },
];

const faqs = [
  {
    q: '¿Necesito saber de tecnología para configurarlo?',
    a: 'No. El asistente de configuración de IA te guía en una conversación de 2 minutos. Le cuentas sobre tu negocio y él se encarga del resto. Muchos usuarios están operando en menos de 10 minutos.',
  },
  {
    q: '¿Cómo se conecta con mi WhatsApp?',
    a: 'Usamos la API oficial de WhatsApp Business de Meta. Necesitas un número de teléfono dedicado para el negocio (no el personal). Te ayudamos con el proceso de verificación incluido en el onboarding.',
  },
  {
    q: '¿La IA puede cometer errores y arruinar una venta?',
    a: 'La IA sugiere respuestas pero puedes configurarla para auto-responder solo en horarios específicos o solo en ciertos temas. Siempre puedes intervenir manualmente. Además, aprende de tus correcciones.',
  },
  {
    q: '¿Puedo manejar varios negocios desde una sola cuenta?',
    a: 'Sí. El plan Pro incluye hasta 3 negocios y el plan Agency ilimitados. Cambias de negocio en un clic desde el panel lateral. Ideal para agencias y emprendedores con múltiples marcas.',
  },
  {
    q: '¿Puedo cancelar en cualquier momento?',
    a: 'Sí. Sin penalidades, sin contratos anuales obligatorios. Cancelas desde la configuración de tu cuenta y no se te cobra más. Tus datos se exportan antes de cerrar.',
  },
];

const steps = [
  {
    step: '01',
    icon: Settings,
    title: 'Configura en 10 minutos',
    desc: 'El asistente de IA te hace preguntas sobre tu negocio y genera tu perfil automaticamente. Sin formularios tediosos.',
  },
  {
    step: '02',
    icon: Plug,
    title: 'Conecta tus canales',
    desc: 'WhatsApp Business, Instagram y email se integran en minutos con la API oficial de Meta.',
  },
  {
    step: '03',
    icon: Sparkles,
    title: 'La IA trabaja por ti',
    desc: 'Desde el primer mensaje, tu asistente responde, agenda y da seguimiento — con el tono y contexto de tu negocio.',
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center font-bold text-white text-sm">CL</div>
          <span className="text-lg font-bold text-white tracking-tight">ClienteLoop</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#features"  className="hover:text-white transition-colors">Funciones</a>
          <a href="#nichos"    className="hover:text-white transition-colors">Industrias</a>
          <a href="#pricing"   className="hover:text-white transition-colors">Precios</a>
          <a href="#faq"       className="hover:text-white transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-slate-300 hover:text-white transition-colors">
            Iniciar sesion
          </Link>
          <Link to="/login?tab=signup" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
            Empieza gratis
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-medium mb-6">
          <Zap className="w-3.5 h-3.5" />
          IA especializada por industria
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
          Todos tus clientes,
          <br />
          <span className="text-blue-400">un solo lugar.</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Centraliza WhatsApp, Instagram y email en un inbox unificado. Con IA que entiende
          tu industria desde el primer dia y un CRM que cierra el bucle de seguimiento.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login?tab=signup"
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2"
          >
            Empieza gratis <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-colors border border-slate-700"
          >
            Ver funciones
          </a>
        </div>
        <p className="mt-5 text-xs text-slate-600">
          Prueba gratis por 14 días · Setup en 10 minutos · No se requiere tarjeta
        </p>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="py-20 px-6 bg-slate-900/50">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Tu problema es real</h2>
        <p className="text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
          Recibes mensajes en WhatsApp, Instagram, Facebook y email. Cada app es un silo.
          Pierdes mensajes, olvidas dar seguimiento, y tus clientes se van con la competencia.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { num: '67%',   label: 'de clientes no reciben seguimiento' },
            { num: '3.5x',  label: 'mas ventas con respuesta en menos de 5 min' },
            { num: '45 min',label: 'promedio diario perdido cambiando apps' },
          ].map(({ num, label }) => (
            <div key={num} className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="text-3xl font-bold text-blue-400 mb-2">{num}</div>
              <p className="text-sm text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Funciona en 3 pasos</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Sin instalaciones complicadas. Sin equipo tecnico. Operando desde el dia uno.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-10 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          {steps.map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="relative flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center">
                  <Icon className="w-8 h-8 text-blue-400" />
                </div>
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {step.slice(1)}
                </span>
              </div>
              <h3 className="text-white font-bold mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-20 px-6 bg-slate-900/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Todo lo que necesitas para cerrar mas ventas
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Una plataforma completa. Sin fragmentacion. Sin herramientas extras.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="w-11 h-11 bg-blue-500/15 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NichosSection() {
  return (
    <section id="nichos" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            IA que habla el idioma de tu industria
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            No es un chatbot generico. Cada nicho tiene su propio sistema de IA con contexto,
            tono y reglas especificas para tu tipo de negocio.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {nichos.map(({ icon: Icon, name, desc }) => (
            <div key={name} className="p-5 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition-colors group">
              <div className="w-10 h-10 bg-blue-500/10 group-hover:bg-blue-500/20 rounded-lg flex items-center justify-center mb-3 transition-colors">
                <Icon className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-white font-medium text-sm mb-1">{name}</h3>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="py-20 px-6 bg-slate-900/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Negocios que ya cerraron el bucle
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            De salon de belleza a inmobiliaria. El patron es siempre el mismo: mas respuestas, mas ventas.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map(({ name, role, location, rating, text, avatar, color }) => (
            <div key={name} className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 flex flex-col gap-4">
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              {/* Quote */}
              <p className="text-sm text-slate-300 leading-relaxed flex-1">
                &ldquo;{text}&rdquo;
              </p>
              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{name}</p>
                  <p className="text-xs text-slate-500">{role} · {location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const plans = [
  {
    name: 'Starter',
    price: '$99',
    desc: 'Para un negocio que quiere crecer',
    highlight: false,
    badge: null,
    features: [
      '1 negocio',
      'Hasta 3 agentes humanos',
      'Inbox unificado (WA + IG + Email)',
      'CRM completo con pipeline visual',
      'Agente de IA especializado en tu nicho',
      'Memoria Agentica',
      'Soporte directo en español',
    ],
    cta: 'Comenzar gratis',
    ctaNote: 'Sin tarjeta de crédito',
  },
  {
    name: 'Pro',
    price: '$149',
    desc: 'Para negocios que manejan múltiples marcas',
    highlight: true,
    badge: 'Más popular',
    features: [
      'Hasta 3 negocios',
      'Hasta 5 agentes humanos',
      'Todo lo de Starter',
      'Cambio de negocio en 1 clic',
      'Insights y sugerencias proactivas',
      'Copilot IA con 12 herramientas',
      'Soporte prioritario',
    ],
    cta: 'Elegir Pro',
    ctaNote: '14 días de prueba gratis',
  },
  {
    name: 'Agency',
    price: '$249',
    desc: 'Para agencias que gestionan clientes',
    highlight: false,
    badge: null,
    features: [
      'Negocios ilimitados',
      'Hasta 10 agentes humanos',
      'Todo lo de Pro',
      'Dashboard multi-cuenta',
      'Agentes extra a $19/mes c/u',
      'Onboarding dedicado',
      'Soporte VIP 24/7',
    ],
    cta: 'Elegir Agency',
    ctaNote: '14 días de prueba gratis',
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Planes que crecen contigo</h2>
          <p className="text-slate-400">
            Empieza con un negocio y escala sin límite. Sin contratos, cancela cuando quieras.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'relative rounded-2xl p-7 flex flex-col border transition-all',
                plan.highlight
                  ? 'bg-gradient-to-b from-blue-950/60 to-slate-900 border-blue-500/50 shadow-2xl shadow-blue-900/30 scale-[1.03]'
                  : 'bg-slate-900/50 border-slate-800'
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 rounded-full text-xs font-bold text-white whitespace-nowrap">
                  {plan.badge}
                </div>
              )}

              <h3 className={cn('font-bold text-lg mb-1', plan.highlight ? 'text-white' : 'text-slate-300')}>
                {plan.name}
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-snug">{plan.desc}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className={cn('text-4xl font-black', plan.highlight ? 'text-white' : 'text-slate-200')}>
                  {plan.price}
                </span>
                <span className="text-slate-500 text-sm">USD/mes</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check className={cn('w-4 h-4 mt-0.5 shrink-0', plan.highlight ? 'text-blue-400' : 'text-slate-500')} />
                    <span className="leading-snug">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/login?tab=signup"
                className={cn(
                  'flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all',
                  plan.highlight
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                )}
              >
                {plan.cta} <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-center text-xs text-slate-600 mt-2">{plan.ctaNote}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="py-20 px-6 bg-slate-900/50">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Preguntas frecuentes</h2>
          <p className="text-slate-400">Todo lo que necesitas saber antes de empezar.</p>
        </div>
        <div className="space-y-3">
          {faqs.map(({ q, a }, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-white hover:text-blue-300 transition-colors"
              >
                <span>{q}</span>
                {open === i
                  ? <ChevronUp className="w-4 h-4 text-blue-400 shrink-0 ml-3" />
                  : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-3" />
                }
              </button>
              {open === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-slate-400 leading-relaxed">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
          Deja de perder clientes hoy
        </h2>
        <p className="text-slate-400 mb-8">
          En 10 minutos tendras tu inbox unificado funcionando con IA que entiende tu negocio.
          Sin tarjeta. Sin compromiso.
        </p>
        <Link
          to="/login?tab=signup"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30"
        >
          Crear mi cuenta gratis <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-4 text-xs text-slate-600">14 dias gratis · Sin tarjeta · Cancela cuando quieras</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-10 px-6 border-t border-slate-800">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-xs">CL</div>
          <span className="text-sm font-semibold text-white">ClienteLoop</span>
        </div>
        <p className="text-xs text-slate-600">&copy; 2026 ClienteLoop. Hecho para negocios hispanohablantes.</p>
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <Link to="/terms" className="hover:text-slate-300 transition-colors">Terminos</Link>
          <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacidad</Link>
          <a href="mailto:hola@clienteloop.com" className="hover:text-slate-300 transition-colors">Contacto</a>
        </div>
      </div>
    </footer>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <Features />
      <NichosSection />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

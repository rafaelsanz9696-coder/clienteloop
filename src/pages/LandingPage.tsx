import { Link } from 'react-router-dom';
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
} from 'lucide-react';

// ─── Nichos ─────────────────────────────────────────────────────────────────

const nichos = [
  { icon: Scissors, name: 'Salon de belleza', desc: 'Citas, servicios, precios' },
  { icon: Stethoscope, name: 'Clinica', desc: 'Citas medicas, seguros' },
  { icon: Home, name: 'Inmobiliaria', desc: 'Propiedades, visitas, financiamiento' },
  { icon: UtensilsCrossed, name: 'Restaurante', desc: 'Menu, reservas, delivery' },
  { icon: GraduationCap, name: 'Academia', desc: 'Cursos, inscripciones, horarios' },
  { icon: Wrench, name: 'Taller mecanico', desc: 'Reparaciones, presupuestos' },
  { icon: Truck, name: 'Mensajeria', desc: 'Envios, rastreo, tarifas' },
  { icon: Monitor, name: 'Agencia digital', desc: 'Servicios, portafolio, cotizaciones' },
];

const features = [
  {
    icon: MessageSquare,
    title: 'Inbox unificado',
    desc: 'WhatsApp, Instagram y email en una sola bandeja. Nunca mas pierdas un mensaje.',
  },
  {
    icon: Users,
    title: 'CRM inteligente',
    desc: 'Perfil de cada cliente con historial completo, notas, etiquetas y etapa en el pipeline.',
  },
  {
    icon: Bot,
    title: 'IA por industria',
    desc: 'Respuestas automaticas que entienden tu negocio. No es una IA generica, es tu asistente.',
  },
  {
    icon: BarChart3,
    title: 'Pipeline de ventas',
    desc: 'Visualiza cada oportunidad desde el primer contacto hasta el cierre.',
  },
  {
    icon: Send,
    title: 'Respuestas rapidas',
    desc: 'Plantillas predefinidas por categoria. Un clic y respondes en segundos.',
  },
  {
    icon: Zap,
    title: 'Automatizaciones',
    desc: 'Auto-respuestas, seguimiento programado y escalamiento inteligente.',
  },
];

// ─── Components ─────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center font-bold text-white text-sm">
            CL
          </div>
          <span className="text-lg font-bold text-white tracking-tight">ClienteLoop</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Funciones</a>
          <a href="#nichos" className="hover:text-white transition-colors">Industrias</a>
          <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            Iniciar sesion
          </Link>
          <Link
            to="/login?tab=signup"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
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
          Prueba gratis por 14 días · Setup en 10 minutos · Cancela cuando quieras
        </p>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="py-20 px-6 bg-slate-900/50">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
          Tu problema es real
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
          Recibes mensajes en WhatsApp, Instagram, Facebook y email. Cada app es un silo.
          Pierdes mensajes, olvidas dar seguimiento, y tus clientes se van con la competencia.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { num: '67%', label: 'de clientes no reciben seguimiento' },
            { num: '3.5x', label: 'mas ventas con respuesta en < 5 min' },
            { num: '45 min', label: 'promedio diario perdido cambiando apps' },
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

function Features() {
  return (
    <section id="features" className="py-20 px-6">
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
            <div
              key={title}
              className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors"
            >
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
    <section id="nichos" className="py-20 px-6 bg-slate-900/50">
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
            <div
              key={name}
              className="p-5 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition-colors group"
            >
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

function Pricing() {
  return (
    <section id="pricing" className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Un solo plan. Todo incluido.
          </h2>
          <p className="text-slate-400">
            Reemplaza 4 herramientas diferentes y ahorra cientos de dolares al mes.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* ClienteLoop */}
          <div className="p-8 bg-gradient-to-b from-blue-950/40 to-slate-900 rounded-2xl border border-blue-500/30 relative shadow-2xl shadow-blue-900/20">
            <div className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 rounded-full text-xs font-semibold text-white">
              Prueba 14 días gratis
            </div>
            <h3 className="text-white font-bold text-xl mb-2">ClienteLoop Pro</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-5xl font-black text-white">$100</span>
              <span className="text-slate-400 text-sm font-medium">USD/mes</span>
            </div>
            <p className="text-sm text-blue-300 font-medium mb-6 backdrop-blur-sm bg-blue-500/10 px-3 py-2 rounded-lg border border-blue-500/20">
              Ideal para negocios que venden por WhatsApp
            </p>
            <ul className="space-y-4 mb-8">
              {[
                'Inbox unificado (WA + IG + Email)',
                'CRM completo con pipeline visual',
                'Agente de IA especializado en tu nicho',
                'Memoria Agéntica (aprende de tu negocio)',
                'Insights y sugerencias proactivas',
                'Hasta 3 agentes humanos',
                'Soporte directo en español',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                  <Check className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/login?tab=signup"
              className="block flex items-center justify-center gap-2 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm text-center transition-all shadow-lg shadow-blue-900/40"
            >
              Comenzar prueba gratis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Competencia */}
          <div className="p-8 bg-slate-900/40 rounded-2xl border border-slate-800 flex flex-col opacity-80">
            <h3 className="text-slate-400 font-bold text-xl mb-2">Comprarlo por separado</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-5xl font-black text-slate-600">$250+</span>
              <span className="text-slate-600 text-sm font-medium">USD/mes</span>
            </div>
            <p className="text-sm text-slate-500 font-medium mb-6 px-3 py-2">
              Fragmentado y difícil de mantener
            </p>
            <ul className="space-y-4 mb-8 flex-1">
              {[
                'Inbox multicanal (Ej: Manychat $50/m)',
                'CRM de ventas (Ej: HubSpot $50/m)',
                'Chatbot Genérico (Ej: Chatnode $100/m)',
                '❌ No entiende tu industria',
                '❌ Sin memoria agéntica',
                '❌ Integraciones complejas (Zapier $50/m)',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-500">
                  <div className="mt-0.5 shrink-0">{item.startsWith('❌') ? '' : <Check className="w-5 h-5 text-slate-600" />}</div>
                  <span className={item.startsWith('❌') ? 'text-slate-600' : ''}>{item.replace('❌ ', '')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-20 px-6 bg-slate-900/50">
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
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-10 px-6 border-t border-slate-800">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-xs">
            CL
          </div>
          <span className="text-sm font-semibold text-white">ClienteLoop</span>
        </div>
        <p className="text-xs text-slate-600">
          &copy; 2026 ClienteLoop. Hecho para negocios hispanohablantes.
        </p>
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <a href="#" className="hover:text-slate-300 transition-colors">Terminos</a>
          <a href="#" className="hover:text-slate-300 transition-colors">Privacidad</a>
          <a href="mailto:hola@clienteloop.com" className="hover:text-slate-300 transition-colors">Contacto</a>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Landing Page ──────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <Hero />
      <ProblemSection />
      <Features />
      <NichosSection />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

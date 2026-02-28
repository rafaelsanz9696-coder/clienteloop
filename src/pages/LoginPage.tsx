import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ArrowRight, MessageSquare, Users, Zap } from 'lucide-react';

// ─── Error message translation ────────────────────────────────────────────────
function translateError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/user already registered/i.test(msg)) return 'Este correo ya tiene cuenta. Inicia sesión.';
  if (/password should be at least/i.test(msg)) return 'La contraseña debe tener mínimo 6 caracteres.';
  if (/unable to validate/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Confirma tu correo antes de ingresar.';
  return msg;
}

// ─── Left branding panel ──────────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-slate-900 to-blue-950 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center font-bold text-lg">
          CL
        </div>
        <span className="text-xl font-bold tracking-tight">ClienteLoop</span>
      </div>

      {/* Headline */}
      <div className="space-y-6">
        <h1 className="text-4xl font-bold leading-snug">
          Centraliza tu comunicación.<br />
          <span className="text-blue-400">Cierra más ventas.</span>
        </h1>
        <p className="text-slate-400 text-base leading-relaxed max-w-xs">
          Inbox unificado, IA especializada por nicho y seguimiento automático para cada cliente.
        </p>

        {/* Feature pills */}
        <div className="flex flex-col gap-3">
          {[
            { icon: MessageSquare, text: 'Inbox unificado por negocio' },
            { icon: Users, text: 'CRM con seguimiento inteligente' },
            { icon: Zap, text: 'IA especializada por industria' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-slate-300">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-blue-400" />
              </div>
              {text}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600">© 2026 ClienteLoop · Hecho para negocios hispanohablantes</p>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'login' | 'signup'>(
    params.get('tab') === 'signup' ? 'signup' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  function resetForm() {
    setEmail('');
    setPassword('');
    setError(null);
    setSuccess(null);
  }

  function switchTab(t: 'login' | 'signup') {
    setTab(t);
    resetForm();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(translateError(error.message));
      setLoading(false);
    } else {
      navigate('/app');
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(translateError(error.message));
      setLoading(false);
    } else {
      setSuccess('¡Cuenta creada! Revisa tu correo para confirmarla, luego inicia sesión.');
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/app' },
    });
    if (error) {
      setError(translateError(error.message));
      setGoogleLoading(false);
    }
  }

  const isLogin = tab === 'login';

  return (
    <div className="min-h-screen bg-slate-950 grid lg:grid-cols-2">
      <BrandPanel />

      {/* Right: form panel */}
      <div className="flex flex-col items-center justify-center p-8 sm:p-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center font-bold">CL</div>
          <span className="text-lg font-bold text-white tracking-tight">ClienteLoop</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Tabs */}
          <div className="flex bg-slate-900 rounded-xl p-1 mb-8 border border-slate-800">
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tab === t
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                {t === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-1">
            {isLogin ? '¡Bienvenido de vuelta!' : 'Crea tu cuenta gratis'}
          </h2>
          <p className="text-slate-500 text-sm mb-8">
            {isLogin
              ? 'Ingresa tus credenciales para continuar.'
              : 'Empieza en menos de un minuto, sin tarjeta.'}
          </p>

          {/* Feedback banners */}
          {error && (
            <div className="mb-5 p-3 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-5 p-3 bg-green-950/50 border border-green-800/50 rounded-xl text-green-400 text-sm">
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Correo electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full pl-9 pr-3 py-3 bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-3 bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              {!isLogin && (
                <p className="text-xs text-slate-600 mt-1.5">Mínimo 6 caracteres.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30 mt-2"
            >
              {loading
                ? (isLogin ? 'Entrando...' : 'Creando cuenta...')
                : (isLogin ? 'Ingresar' : 'Crear cuenta')}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600">ó continúa con</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleLoading ? 'Redirigiendo...' : 'Ingresar con Google'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { WifiOff, RefreshCw } from 'lucide-react';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/layout/ProtectedRoute';
import OnboardingPage from './pages/OnboardingPage';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { useAuth } from './contexts/AuthContext';
import { useBusiness } from './contexts/BusinessContext';

// ─── Lazy-loaded pages (code-split for faster mobile load) ───────────────────
const LandingPage       = lazy(() => import('./pages/LandingPage'));
const DashboardPage     = lazy(() => import('./pages/DashboardPage'));
const InboxPage         = lazy(() => import('./pages/InboxPage'));
const ContactsPage      = lazy(() => import('./pages/ContactsPage'));
const PipelinePage      = lazy(() => import('./pages/PipelinePage'));
const TasksPage         = lazy(() => import('./pages/TasksPage'));
const SettingsPage      = lazy(() => import('./pages/SettingsPage'));
const ReportsPage       = lazy(() => import('./pages/ReportsPage'));
const AppointmentsPage  = lazy(() => import('./pages/AppointmentsPage'));
const BroadcastPage     = lazy(() => import('./pages/BroadcastPage'));
const BookingPage       = lazy(() => import('./pages/BookingPage'));
const PrivacyPage       = lazy(() => import('./pages/PrivacyPage'));
const TermsPage         = lazy(() => import('./pages/TermsPage'));

const PageFallback = () => <LoadingSpinner text="Cargando..." />;

// ─── Connection error screen ─────────────────────────────────────────────────
function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="w-16 h-16 bg-red-900/40 rounded-2xl flex items-center justify-center">
        <WifiOff className="w-8 h-8 text-red-400" />
      </div>
      <div>
        <h2 className="text-white font-bold text-lg mb-1">Sin conexión al servidor</h2>
        <p className="text-slate-400 text-sm max-w-xs">
          No pudimos cargar tus datos. Verifica tu conexión e intenta de nuevo.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all"
      >
        <RefreshCw className="w-4 h-4" />
        Reintentar
      </button>
    </div>
  );
}

// ─── Inner wrapper: handles loading / error / onboarding states ──────────────
function AuthenticatedApp() {
  const { businesses, loading, loadError, retryLoad } = useBusiness();

  if (loading) return <LoadingSpinner text="Cargando tu espacio..." />;
  if (loadError) return <ConnectionError onRetry={retryLoad} />;
  if (businesses.length === 0) return <OnboardingPage />;

  // User has at least one business → render the normal dashboard routes
  return <Outlet />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public landing page — SEO-friendly */}
      <Route index element={user ? <Navigate to="/app" replace /> : (
        <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
          <LandingPage />
        </Suspense>
      )} />

      {/* Public auth routes — redirect logged-in users to dashboard */}
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/app" replace /> : <RegisterPage />} />

      {/* Public booking page — accessible without login */}
      <Route path="/book/:slug" element={
        <Suspense fallback={<PageFallback />}>
          <BookingPage />
        </Suspense>
      } />

      {/* Legal pages — public, required for Meta App Review */}
      <Route path="/privacy" element={
        <Suspense fallback={<PageFallback />}>
          <PrivacyPage />
        </Suspense>
      } />
      <Route path="/terms" element={
        <Suspense fallback={<PageFallback />}>
          <TermsPage />
        </Suspense>
      } />

      {/* Protected routes — requires auth + at least one business */}
      <Route path="/app" element={<ProtectedRoute />}>
        <Route element={<AuthenticatedApp />}>
          <Route element={<AppLayout />}>
            <Route index element={
              <Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>
            } />
            <Route path="inbox" element={
              <Suspense fallback={<PageFallback />}><InboxPage /></Suspense>
            } />
            <Route path="inbox/:conversationId" element={
              <Suspense fallback={<PageFallback />}><InboxPage /></Suspense>
            } />
            <Route path="contacts" element={
              <Suspense fallback={<PageFallback />}><ContactsPage /></Suspense>
            } />
            <Route path="contacts/:contactId" element={
              <Suspense fallback={<PageFallback />}><ContactsPage /></Suspense>
            } />
            <Route path="pipeline" element={
              <Suspense fallback={<PageFallback />}><PipelinePage /></Suspense>
            } />
            <Route path="tasks" element={
              <Suspense fallback={<PageFallback />}><TasksPage /></Suspense>
            } />
            <Route path="appointments" element={
              <Suspense fallback={<PageFallback />}><AppointmentsPage /></Suspense>
            } />
            <Route path="reports" element={
              <Suspense fallback={<PageFallback />}><ReportsPage /></Suspense>
            } />
            <Route path="broadcast" element={
              <Suspense fallback={<PageFallback />}><BroadcastPage /></Suspense>
            } />
            <Route path="settings" element={
              <Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>
            } />
          </Route>
        </Route>
      </Route>

      {/* Shorthand redirects */}
      <Route path="/inbox" element={<Navigate to="/app/inbox" replace />} />
      <Route path="/inbox/:id" element={<Navigate to="/app/inbox" replace />} />
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="/contacts" element={<Navigate to="/app/contacts" replace />} />
      <Route path="/pipeline" element={<Navigate to="/app/pipeline" replace />} />
      <Route path="/tasks" element={<Navigate to="/app/tasks" replace />} />
      <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

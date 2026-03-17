import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import ContactsPage from './pages/ContactsPage';
import PipelinePage from './pages/PipelinePage';
import TasksPage from './pages/TasksPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import BroadcastPage from './pages/BroadcastPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
const LandingPage = lazy(() => import('./pages/LandingPage'));
import BookingPage from './pages/BookingPage';
import ProtectedRoute from './components/layout/ProtectedRoute';
import OnboardingPage from './pages/OnboardingPage';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { useAuth } from './contexts/AuthContext';
import { useBusiness } from './contexts/BusinessContext';

/** Inner wrapper: shows onboarding if user has no businesses yet */
function AuthenticatedApp() {
  const { businesses, loading } = useBusiness();

  if (loading) return <LoadingSpinner text="Cargando tu espacio..." />;
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
      <Route path="/book/:slug" element={<BookingPage />} />

      {/* Protected routes — requires auth + at least one business */}
      <Route path="/app" element={<ProtectedRoute />}>
        <Route element={<AuthenticatedApp />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="inbox/:conversationId" element={<InboxPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="contacts/:contactId" element={<ContactsPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="broadcast" element={<BroadcastPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Shorthand redirects — /inbox → /app/inbox etc. */}
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

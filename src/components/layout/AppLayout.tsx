import { useState, lazy, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';

const CopilotPanel = lazy(() => import('../CopilotPanel'));

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/inbox': 'Inbox',
  '/contacts': 'Contactos',
  '/pipeline': 'Pipeline',
  '/tasks': 'Tareas',
  '/appointments': 'Citas',
  '/reports': 'Reportes',
  '/settings': 'Ajustes',
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const basePath = '/' + (location.pathname.split('/')[2] || '');
  const title = pageTitles[basePath] || 'ClienteLoop';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />

        {/* Main content — adds bottom padding on mobile so bottom nav doesn't overlap */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav onMenuClick={() => setSidebarOpen(true)} />

      <Suspense fallback={null}><CopilotPanel /></Suspense>
    </div>
  );
}

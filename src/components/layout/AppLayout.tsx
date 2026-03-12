import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CopilotPanel from '../CopilotPanel';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/inbox': 'Inbox',
  '/contacts': 'Contactos',
  '/pipeline': 'Pipeline',
  '/tasks': 'Tareas',
  '/settings': 'Ajustes',
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const basePath = '/' + (location.pathname.split('/')[1] || '');
  const title = pageTitles[basePath] || 'ClienteLoop';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <CopilotPanel />
    </div>
  );
}

import * as Sentry from '@sentry/react';
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
});
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { BusinessProvider } from './contexts/BusinessContext.tsx';
import { SocketProvider } from './contexts/SocketContext.tsx';
import ErrorBoundary from './components/ui/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <BusinessProvider>
            <SocketProvider>
              <App />
            </SocketProvider>
          </BusinessProvider>
        </AuthProvider>
        <Toaster position="top-right" richColors closeButton duration={4000} />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WebApp } from '@/web/WebApp';
import { WebI18nProvider } from '@/web/i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ErrorBoundary><WebI18nProvider><WebApp /></WebI18nProvider></ErrorBoundary></StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

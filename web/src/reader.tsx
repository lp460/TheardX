import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import '@/reader/reader.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WebReader } from '@/web/WebReader';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ErrorBoundary><WebReader /></ErrorBoundary></StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WebI18nProvider } from '@/web/i18n';
import { SharedPage } from '@/share/SharedPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <WebI18nProvider>
        <SharedPage />
      </WebI18nProvider>
    </ErrorBoundary>
  </StrictMode>,
);

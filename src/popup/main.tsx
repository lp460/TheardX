import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Popup } from './Popup';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary compact>
      <Popup />
    </ErrorBoundary>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './reader.css';
import { ThreadReader } from './ThreadReader';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThreadReader />
    </ErrorBoundary>
  </StrictMode>,
);

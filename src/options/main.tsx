import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { useSettings, useThemeClass } from '@/components/hooks';
import { Logo } from '@/components/Logo';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ToastNotification } from '@/components/ToastNotification';
import { TooltipProvider } from '@/components/ui/Tooltip';

function Options() {
  const [s] = useSettings();
  useThemeClass(s.theme);
  return (
    <TooltipProvider>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <a
            className="text-[13px] text-accent hover:underline"
            href={chrome.runtime.getURL('library/index.html')}
          >
            Ouvrir la bibliothèque
          </a>
        </div>
        <SettingsPanel />
      </div>
      <ToastNotification />
    </TooltipProvider>
  );
}

document.title = 'ThreadShelf — Paramètres';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);

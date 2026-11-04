import { useEffect, useState } from 'react';
import { Cloud, CloudOff, House, LogOut, RefreshCw, WifiOff } from 'lucide-react';
import { LibraryApp } from '@/library/LibraryApp';
import { Button } from '@/components/ui/Button';
import { resolveWebAuth, signOut, type WebAuth } from './auth';
import { getSyncState, startWebSync, subscribeSync, syncWebNow, type WebSyncState } from './sync';
import { LandingPage } from './LandingPage';
import { LanguageSelector, useWebI18n } from './i18n';

export function WebApp() {
  const { t } = useWebI18n();
  const [auth, setAuth] = useState<WebAuth>({ phase: 'loading', login: null });
  const [sync, setSync] = useState<WebSyncState>(getSyncState);
  const [error, setError] = useState('');

  useEffect(() => { void resolveWebAuth().then(setAuth); }, []);
  useEffect(() => subscribeSync(setSync), []);
  useEffect(() => auth.login ? startWebSync(auth.login) : undefined, [auth.login]);
  useEffect(() => {
    const update = () => void resolveWebAuth().then(setAuth);
    window.addEventListener('online', update);
    return () => window.removeEventListener('online', update);
  }, []);

  if (auth.phase === 'loading') return <LandingPage status={t('opening')} loginAvailable={false} />;
  if (auth.phase === 'account-mismatch') return <LandingPage status={t('accountMismatch')} loginAvailable={false} />;
  if (!auth.login) return <LandingPage loginAvailable />;
  if (new URLSearchParams(location.search).has('home')) return <LandingPage loginAvailable={false} libraryAvailable />;

  return (
    <div className="flex h-[100dvh] flex-col bg-bg text-fg">
      <header className="flex min-h-14 items-center justify-between gap-2 border-b border-line bg-surface px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
          {auth.phase === 'offline' ? <WifiOff size={14} /> : sync.phase === 'error'
            ? <CloudOff size={14} /> : <Cloud size={14} />}
          <span className="max-w-[24vw] truncate font-medium sm:max-w-none">{auth.login}</span>
          <span className="hidden text-xs sm:inline">· {auth.phase === 'offline' ? t('offline') : sync.phase === 'running'
            ? t('syncing') : sync.phase === 'needs-passphrase' ? t('passphrase')
              : sync.phase === 'error' ? t('syncError') : t('localLibrary')}</span>
        </div>
        <div className="flex items-center gap-1">
          <a href="/?home=1" className="ts-focus inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-fg" aria-label={t('home')} title={t('home')}><House size={19} /></a>
          <LanguageSelector />
          <Button size="icon-sm" className="max-sm:h-10 max-sm:w-10" variant="ghost" aria-label={t('syncNow')}
            disabled={auth.phase === 'offline' || sync.phase === 'running'} onClick={() => void syncWebNow()}>
            <RefreshCw size={18} className={sync.phase === 'running' ? 'animate-spin' : ''} />
          </Button>
          <Button size="icon-sm" className="max-sm:h-10 max-sm:w-10" variant="ghost" aria-label={t('signOut')} onClick={() => {
            void signOut().then(() => { location.href = '/'; }).catch((e) => setError(String(e)));
          }}><LogOut size={18} /></Button>
        </div>
      </header>
      {sync.phase === 'needs-passphrase' || sync.phase === 'error' || error ? (
        <div className="border-b border-warning/30 bg-subtle px-3 py-2 text-center text-xs text-fg">
          {error || sync.error} {sync.phase === 'needs-passphrase' ? t('openSyncSettings') : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1"><LibraryApp /></div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Cloud, CloudOff, GitBranch, LogOut, RefreshCw, WifiOff } from 'lucide-react';
import { LibraryApp } from '@/library/LibraryApp';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { accountMismatchMessage, resolveWebAuth, signOut, type WebAuth } from './auth';
import { getSyncState, startWebSync, subscribeSync, syncWebNow, type WebSyncState } from './sync';

export function WebApp() {
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

  if (auth.phase === 'loading') return <Welcome status="Ouverture de votre bibliothèque…" />;
  if (auth.phase === 'account-mismatch') return <Welcome status={accountMismatchMessage()} />;
  if (!auth.login) return <Welcome status="Connectez-vous avec GitHub pour retrouver votre bibliothèque synchronisée." login />;

  return (
    <div className="flex h-[100dvh] flex-col bg-bg text-fg">
      <header className="flex min-h-11 items-center justify-between gap-3 border-b border-line bg-surface px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
          {auth.phase === 'offline' ? <WifiOff size={14} /> : sync.phase === 'error'
            ? <CloudOff size={14} /> : <Cloud size={14} />}
          <span className="max-w-[45vw] truncate">{auth.login}</span>
          <span className="hidden sm:inline">· {auth.phase === 'offline' ? 'Hors ligne' : sync.phase === 'running'
            ? 'Synchronisation…' : sync.phase === 'needs-passphrase' ? 'Phrase secrète requise'
              : sync.phase === 'error' ? 'Échec de synchronisation' : 'Bibliothèque locale'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Synchroniser maintenant"
            disabled={auth.phase === 'offline' || sync.phase === 'running'} onClick={() => void syncWebNow()}>
            <RefreshCw size={14} className={sync.phase === 'running' ? 'animate-spin' : ''} />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Se déconnecter" onClick={() => {
            void signOut().then(() => { location.href = '/'; }).catch((e) => setError(String(e)));
          }}><LogOut size={14} /></Button>
        </div>
      </header>
      {sync.phase === 'needs-passphrase' || sync.phase === 'error' || error ? (
        <div className="border-b border-warning/30 bg-subtle px-3 py-2 text-center text-xs text-fg">
          {error || sync.error} {sync.phase === 'needs-passphrase' ? 'Ouvrez Paramètres → Synchronisation.' : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1"><LibraryApp /></div>
    </div>
  );
}

function Welcome({ status, login = false }: { status: string; login?: boolean }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-line bg-surface p-7 shadow-lg">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold text-fg">Votre bibliothèque, partout.</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{status}</p>
        {login ? <div className="mt-6"><a href="/api/auth/login"
          className="ts-focus flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-white">
          <GitBranch size={18} /> Se connecter avec GitHub
        </a></div> : null}
        <p className="mt-5 text-xs leading-relaxed text-faint">
          Vos contenus sont enregistrés localement sur cet appareil. L'extension TheardX reste disponible pour capturer sur X et Reddit.
        </p>
      </section>
    </main>
  );
}

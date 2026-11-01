import { useEffect, useState } from 'react';
import { ThreadReader } from '@/reader/ThreadReader';
import { accountMismatchMessage, resolveWebAuth, type WebAuth } from './auth';
import { startWebSync } from './sync';

export function WebReader() {
  const [auth, setAuth] = useState<WebAuth>({ phase: 'loading', login: null });
  useEffect(() => { void resolveWebAuth().then(setAuth); }, []);
  useEffect(() => auth.login ? startWebSync(auth.login) : undefined, [auth.login]);
  if (auth.phase === 'loading') return <p className="p-6 text-sm text-muted">Chargement…</p>;
  if (!auth.login) return <main className="mx-auto max-w-lg p-8 text-sm text-muted">
    <p>{auth.phase === 'account-mismatch' ? accountMismatchMessage() : 'Connectez-vous pour ouvrir cette publication.'}</p>
    <a className="mt-4 inline-block text-accent underline" href="/">Retour à TheardX</a>
  </main>;
  return <ThreadReader />;
}

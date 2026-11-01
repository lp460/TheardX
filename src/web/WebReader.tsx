import { useEffect, useState } from 'react';
import { ThreadReader } from '@/reader/ThreadReader';
import { resolveWebAuth, type WebAuth } from './auth';
import { startWebSync } from './sync';
import { useWebI18n } from './i18n';

export function WebReader() {
  const { t } = useWebI18n();
  const [auth, setAuth] = useState<WebAuth>({ phase: 'loading', login: null });
  useEffect(() => { void resolveWebAuth().then(setAuth); }, []);
  useEffect(() => auth.login ? startWebSync(auth.login) : undefined, [auth.login]);
  if (auth.phase === 'loading') return <p className="p-6 text-sm text-muted">{t('readerLoading')}</p>;
  if (!auth.login) return <main className="mx-auto max-w-lg p-8 text-sm text-muted">
    <p>{auth.phase === 'account-mismatch' ? t('accountMismatch') : t('readerSignIn')}</p>
    <a className="mt-4 inline-block text-accent underline" href="/">{t('backHome')}</a>
  </main>;
  return <ThreadReader />;
}

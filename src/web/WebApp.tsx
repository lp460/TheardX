import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudOff,
  House,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Shield,
  WifiOff,
} from 'lucide-react';
import { LibraryApp } from '@/library/LibraryApp';
import { Button } from '@/components/ui/Button';
import { resolveWebAuth, signOut, type WebAuth } from './auth';
import {
  getSyncState,
  setWebGoogleMode,
  setWebPassphrase,
  startWebSync,
  subscribeSync,
  syncWebNow,
  type WebSyncState,
} from './sync';
import { LandingPage } from './LandingPage';
import { LanguageSelector, useWebI18n } from './i18n';

export function WebApp() {
  const { t } = useWebI18n();
  const [auth, setAuth] = useState<WebAuth>({
    phase: 'loading',
    login: null,
    provider: null,
    accountId: null,
  });
  const [sync, setSync] = useState<WebSyncState>(getSyncState);
  const [error, setError] = useState('');
  const [passphrase, setPassphrase] = useState('');

  useEffect(() => {
    void resolveWebAuth().then(setAuth);
  }, []);
  useEffect(() => subscribeSync(setSync), []);
  useEffect(
    () =>
      auth.login && auth.accountId && auth.provider
        ? startWebSync({
            login: auth.login,
            provider: auth.provider,
            accountId: auth.accountId,
          })
        : undefined,
    [auth.accountId, auth.login, auth.provider],
  );
  useEffect(() => {
    const update = () => void resolveWebAuth().then(setAuth);
    window.addEventListener('online', update);
    return () => window.removeEventListener('online', update);
  }, []);

  if (auth.phase === 'loading') return <LandingPage status={t('opening')} loginAvailable={false} />;
  if (auth.phase === 'account-mismatch')
    return <LandingPage status={t('accountMismatch')} loginAvailable={false} />;
  if (!auth.login) return <LandingPage loginAvailable />;
  if (new URLSearchParams(location.search).has('home'))
    return <LandingPage loginAvailable={false} libraryAvailable />;

  return (
    <div className="flex h-[100dvh] flex-col bg-bg text-fg">
      <header className="flex min-h-14 items-center justify-between gap-2 border-b border-line bg-surface px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
          {auth.phase === 'offline' ? (
            <WifiOff size={14} />
          ) : sync.phase === 'error' ? (
            <CloudOff size={14} />
          ) : (
            <Cloud size={14} />
          )}
          <span className="max-w-[24vw] truncate font-medium sm:max-w-none">{auth.login}</span>
          <span className="hidden text-xs sm:inline">
            ·{' '}
            {auth.phase === 'offline'
              ? t('offline')
              : sync.phase === 'running'
                ? t('syncing')
                : sync.phase === 'needs-passphrase'
                  ? t('passphrase')
                  : sync.phase === 'choose-encryption'
                    ? t('googleProtectionLabel')
                    : sync.phase === 'error'
                      ? t('syncError')
                      : t('localLibrary')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href="/?home=1"
            className="ts-focus inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-fg"
            aria-label={t('home')}
            title={t('home')}
          >
            <House size={19} />
          </a>
          <LanguageSelector />
          <Button
            size="icon-sm"
            className="max-sm:h-10 max-sm:w-10"
            variant="ghost"
            aria-label={t('syncNow')}
            disabled={auth.phase === 'offline' || sync.phase === 'running'}
            onClick={() => void syncWebNow()}
          >
            <RefreshCw size={18} className={sync.phase === 'running' ? 'animate-spin' : ''} />
          </Button>
          <Button
            size="icon-sm"
            className="max-sm:h-10 max-sm:w-10"
            variant="ghost"
            aria-label={t('signOut')}
            onClick={() => {
              void signOut()
                .then(() => {
                  location.href = '/';
                })
                .catch((e) => setError(String(e)));
            }}
          >
            <LogOut size={18} />
          </Button>
        </div>
      </header>
      {sync.phase === 'needs-passphrase' || sync.phase === 'error' || error ? (
        <div className="border-b border-warning/30 bg-subtle px-3 py-3 text-center text-xs text-fg">
          <p role="status">{error || sync.error}</p>
          {sync.phase === 'needs-passphrase' ? (
            <form
              className="mx-auto mt-2 flex max-w-md gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setWebPassphrase(passphrase);
                setPassphrase('');
              }}
            >
              <label htmlFor="web-passphrase" className="sr-only">
                {t('encryptedLibrary')}
              </label>
              <input
                id="web-passphrase"
                required
                minLength={8}
                type="password"
                autoComplete="off"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder={t('encryptedLibrary')}
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-fg"
              />
              <Button type="submit" size="sm">
                {t('unlock')}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <LibraryApp />
      </div>
      {sync.phase === 'choose-encryption' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-protection-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Shield size={26} />
            </div>
            <h2 id="google-protection-title" className="text-xl font-semibold text-fg">
              {t('googleChoiceTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t('googleChoiceBody')}</p>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-line p-4">
                <h3 className="text-sm font-semibold">{t('googleStandardTitle')}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t('googleStandardDesc')}</p>
                <Button
                  className="mt-3 h-10 w-full"
                  variant="primary"
                  onClick={() => setWebGoogleMode('plain')}
                >
                  {t('googleChooseStandard')}
                </Button>
              </div>
              <div className="rounded-xl border border-line p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <LockKeyhole size={16} /> {t('googleEncryptedTitle')}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {t('googleEncryptedDesc')}
                </p>
                <Button
                  className="mt-3 h-10 w-full"
                  variant="outline"
                  onClick={() => setWebGoogleMode('encrypted')}
                >
                  {t('googleChooseEncrypted')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

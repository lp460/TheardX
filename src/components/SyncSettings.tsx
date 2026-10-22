import {
  Check,
  CheckCircle2,
  CloudCog,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { DevicePoll, DeviceStart, SyncStatus } from '@/background/sync-service';
import { send } from '@/messaging/client';
import { GITHUB_OAUTH_CLIENT_ID } from '@/sync/github-app';
import { loadSecrets, saveSecrets } from '@/sync/secrets';
import { copyText } from '@/utils/clipboard';
import { formatRelative } from '@/utils/format';
import { useSettings } from './hooks';
import { toast } from './ToastNotification';
import { Button } from './ui/Button';
import { Input, Select, Switch } from './ui/primitives';

const GITHUB_ORIGINS = ['https://github.com/*', 'https://api.github.com/*'];
const NEW_APP_URL = 'https://github.com/settings/applications/new';

function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-40 shrink-0 text-[12px] text-muted">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded-md bg-subtle px-2 py-1 text-[12px] text-fg">
        {value}
      </code>
      <button
        type="button"
        aria-label={`Copier ${label}`}
        onClick={() =>
          void copyText(value).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          })
        }
        className="ts-focus rounded p-1 text-faint hover:text-fg"
      >
        {done ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      </button>
    </div>
  );
}

/** « Synchronisation entre PC (GitHub) » — « Se connecter avec GitHub », then a code to paste on GitHub. */
export function SyncSettings() {
  const [s, update, loaded] = useSettings();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [clientId, setClientId] = useState('');
  const [device, setDevice] = useState<DeviceStart | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadSecrets().then((sec) => setPassphrase(sec.passphrase));
  }, []);
  useEffect(() => {
    if (loaded) setClientId(s.sync.oauthClientId);
  }, [loaded, s.sync.oauthClientId]);

  const refresh = useCallback(async () => {
    try {
      setStatus((await send({ type: 'sync.status' })) as unknown as SyncStatus);
    } catch {
      setStatus(null);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes['threadshelf.sync.state']) void refresh();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      chrome.storage.onChanged.removeListener(onChange);
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [refresh]);

  const report = (st: SyncStatus, okTitle: string) => {
    setStatus(st);
    if (st.lastError) toast.error('Synchronisation impossible', st.lastError);
    else if (st.lastResult) {
      const r = st.lastResult;
      toast.success(
        okTitle,
        `${r.added} ajoutée(s), ${r.updated} mise(s) à jour, ${r.deleted} supprimée(s)`,
      );
    }
  };

  const stopWaiting = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
    setDevice(null);
  };

  const poll = (intervalSec: number) => {
    pollTimer.current = setTimeout(
      async () => {
        try {
          const r = (await send({
            type: 'sync.devicePoll',
            encrypt: s.sync.encrypt,
            passphrase,
          })) as unknown as DevicePoll;
          if (r.state === 'pending') return poll(r.interval);
          stopWaiting();
          report(r.status, 'Connecté à GitHub — bibliothèque synchronisée');
        } catch (e) {
          stopWaiting();
          toast.error('Connexion GitHub', e instanceof Error ? e.message : String(e));
        }
      },
      Math.max(1, intervalSec) * 1000,
    );
  };

  const signIn = async () => {
    setBusy('signin');
    try {
      // First await of the click: the browser asks to allow github.com.
      const granted = await chrome.permissions.request({ origins: GITHUB_ORIGINS });
      if (!granted) throw new Error('Accès à GitHub refusé.');
      if (s.sync.encrypt && passphrase.length < 8)
        throw new Error('La phrase secrète doit contenir au moins 8 caractères.');
      await saveSecrets({ passphrase });
      const d = (await send({ type: 'sync.deviceStart' })) as unknown as DeviceStart;
      setDevice(d);
      await copyText(d.userCode).catch(() => undefined);
      window.open(d.verificationUri, '_blank', 'noopener');
      poll(d.interval);
    } catch (e) {
      toast.error('Connexion GitHub', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setBusy('sync');
    try {
      await saveSecrets({ passphrase });
      report(
        (await send({ type: 'sync.now' })) as unknown as SyncStatus,
        'Bibliothèque synchronisée',
      );
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    setBusy('out');
    try {
      setStatus((await send({ type: 'sync.disconnect' })) as unknown as SyncStatus);
      toast.info('Déconnecté de GitHub', 'Votre bibliothèque locale est conservée.');
    } finally {
      setBusy(null);
    }
  };

  if (!loaded) return <div className="skeleton h-40" />;
  const connected = s.sync.enabled;
  const needsApp = !(s.sync.oauthClientId.trim() || GITHUB_OAUTH_CLIENT_ID);

  const encryption: ReactNode = (
    <>
      <Switch
        id="sync-encrypt"
        checked={s.sync.encrypt}
        onChange={(v) => void update({ sync: { encrypt: v } })}
        label="Chiffrer la bibliothèque"
        description="GitHub ne stocke qu’un contenu illisible. Il faudra la même phrase secrète sur chaque PC."
      />
      {s.sync.encrypt ? (
        <label className="block pb-2">
          <span className="sr-only">Phrase secrète</span>
          <span className="relative block">
            <Lock
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <Input
              type="password"
              className="pl-7"
              placeholder="Phrase secrète (8 caractères minimum)"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onBlur={() => void saveSecrets({ passphrase })}
              autoComplete="new-password"
              data-testid="sync-passphrase"
            />
          </span>
        </label>
      ) : null}
    </>
  );

  return (
    <section
      className="rounded-2xl border border-line bg-surface px-5 py-4"
      data-testid="sync-settings"
      id="sync"
    >
      <h2 className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-fg">
        <span className="text-muted">
          <CloudCog size={15} />
        </span>
        Synchronisation entre PC (GitHub)
        {connected ? (
          <span className="ml-auto rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success">
            Activée
          </span>
        ) : null}
      </h2>

      {connected ? (
        <>
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-[13px] text-fg"
            data-testid="sync-account"
          >
            <CheckCircle2 size={14} className="text-success" />
            {status?.account ? (
              <>
                Connecté en tant que <strong>@{status.account.login}</strong> · dépôt privé
                <a
                  className="inline-flex items-center gap-0.5 text-accent hover:underline"
                  href={status.account.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {status.account.repo} <ExternalLink size={11} />
                </a>
              </>
            ) : (
              <>Dépôt {s.sync.repo}</>
            )}
          </div>
          {status ? (
            <div className="pb-2 text-[12.5px]" aria-live="polite" data-testid="sync-status">
              {status.lastError ? (
                <span className="text-danger">
                  <XCircle size={13} className="mr-1 inline" />
                  {status.lastError}
                </span>
              ) : status.lastSyncAt ? (
                <span className="text-muted">
                  Dernière synchronisation {formatRelative(status.lastSyncAt)}
                  {status.lastResult
                    ? ` · ${status.lastResult.added} ajoutée(s), ${status.lastResult.updated} mise(s) à jour, ${status.lastResult.deleted} supprimée(s)${status.lastResult.pushed ? ', envoyée' : ''}`
                    : ''}
                </span>
              ) : (
                <span className="text-muted">Pas encore synchronisée.</span>
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 py-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void syncNow()}
              loading={busy === 'sync' || !!status?.running}
              data-testid="sync-now"
            >
              <RefreshCw size={13} /> Synchroniser maintenant
            </Button>
            <Select
              value={String(s.sync.intervalMin)}
              onChange={(e) => void update({ sync: { intervalMin: Number(e.target.value) } })}
              aria-label="Fréquence de synchronisation"
              className="h-7 text-[12.5px]"
            >
              <option value="5">Toutes les 5 min</option>
              <option value="15">Toutes les 15 min</option>
              <option value="30">Toutes les 30 min</option>
              <option value="60">Toutes les heures</option>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-muted"
              onClick={() => void signOut()}
              loading={busy === 'out'}
              data-testid="sync-disconnect"
            >
              <LogOut size={13} /> Se déconnecter
            </Button>
          </div>
          <div className="border-t border-line/70 pt-1">{encryption}</div>
          <p className="pb-1 text-[12px] text-muted">
            Synchronisation automatique environ une minute après chaque modification, régulièrement,
            et au démarrage du navigateur.
          </p>
        </>
      ) : (
        <>
          <p className="py-2 text-[12.5px] leading-relaxed text-muted">
            Retrouvez votre bibliothèque sur tous vos PC. Elle est enregistrée dans un dépôt{' '}
            <strong>privé</strong> de votre compte GitHub, créé automatiquement. Les images et les
            préférences restent propres à chaque PC.
          </p>

          {needsApp ? (
            <div
              className="my-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3"
              data-testid="sync-app-setup"
            >
              <p className="text-[12.5px] font-medium text-fg">
                Configuration unique, valable pour tous vos PC
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                GitHub exige que l’application « ThreadShelf » soit déclarée une fois sur votre
                compte (le code de connexion vient juste après). Sur la page « Register a new OAuth
                app » :
              </p>
              <div className="mt-2">
                <CopyValue label="Application name" value="ThreadShelf" />
                <CopyValue label="Homepage URL" value="https://github.com" />
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[12px] leading-relaxed text-muted">
                <li>
                  · <em>Redirect URI</em> : https://github.com (non utilisé, mais obligatoire) ; «
                  Allow wildcard matching » décoché.
                </li>
                <li>
                  · <strong className="text-fg">Enable Device Flow : cochez</strong>.
                </li>
                <li>
                  · <strong className="text-fg">Expire user access tokens : décochez</strong>, sinon
                  il faudrait se reconnecter toutes les 8 heures.
                </li>
                <li>
                  · Cliquez <em>Register application</em>, puis collez le <em>Client ID</em>{' '}
                  ci-dessous.
                </li>
              </ul>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" onClick={() => window.open(NEW_APP_URL, '_blank', 'noopener')}>
                  Ouvrir GitHub <ExternalLink size={12} />
                </Button>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  onBlur={() => void update({ sync: { oauthClientId: clientId.trim() } })}
                  placeholder="Client ID (ex. Ov23li…)"
                  spellCheck={false}
                  data-testid="sync-client-id"
                  className="h-7"
                />
              </div>
            </div>
          ) : null}

          {device ? (
            <div
              className="my-2 rounded-xl border border-accent/30 bg-accent-soft/50 px-4 py-3"
              data-testid="sync-device"
            >
              <p className="text-[12.5px] text-fg">
                Sur la page GitHub qui vient de s’ouvrir, collez ce code puis cliquez{' '}
                <strong>Authorize</strong> :
              </p>
              <div className="mt-2 flex items-center gap-3">
                <code
                  className="rounded-lg bg-surface px-3 py-1.5 font-mono text-[22px] font-semibold tracking-[0.18em] text-fg shadow-sm"
                  data-testid="sync-user-code"
                >
                  {device.userCode}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void copyText(device.userCode).then(() => toast.success('Code copié'))
                  }
                >
                  <Copy size={13} /> Copier
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(device.verificationUri, '_blank', 'noopener')}
                >
                  Rouvrir GitHub <ExternalLink size={12} />
                </Button>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
                <Loader2 size={12} className="animate-spin" /> En attente de votre autorisation…
                (code déjà copié dans le presse-papiers)
                <button
                  type="button"
                  className="ml-auto text-muted underline hover:text-fg"
                  onClick={stopWaiting}
                >
                  Annuler
                </button>
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => void signIn()}
                loading={busy === 'signin'}
                disabled={needsApp}
                data-testid="sync-signin"
              >
                <GitHubMark /> Se connecter avec GitHub
              </Button>
              <span className="text-[12px] text-muted">
                Puis collez le code affiché et cliquez « Authorize ». C’est tout.
              </span>
            </div>
          )}

          <details className="py-2">
            <summary className="cursor-pointer select-none text-[12.5px] font-medium text-muted hover:text-fg">
              Options avancées
            </summary>
            <div className="mt-2 space-y-2 border-l-2 border-line pl-3">
              {encryption}
              <label className="block text-[12.5px] text-muted">
                Client ID de l’application GitHub
                <Input
                  className="mt-1"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  onBlur={() => void update({ sync: { oauthClientId: clientId.trim() } })}
                  placeholder={GITHUB_OAUTH_CLIENT_ID || 'Client ID'}
                  spellCheck={false}
                />
              </label>
            </div>
          </details>
          {status?.lastError ? (
            <p className="text-[12.5px] text-danger" data-testid="sync-status">
              {status.lastError}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

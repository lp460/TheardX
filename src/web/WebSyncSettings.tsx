import { useEffect, useState } from 'react';
import { Cloud, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  downloadWebMedia,
  changeWebGoogleMode,
  getSyncState,
  getWebSyncProvider,
  setWebPassphrase,
  subscribeSync,
  syncWebNow,
  type WebSyncState,
} from './sync';
import { useWebI18n } from './i18n';

export function WebSyncSettings() {
  const { t, language } = useWebI18n();
  const [state, setState] = useState<WebSyncState>(getSyncState);
  const [passphrase, setPassphrase] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaMessage, setMediaMessage] = useState('');
  const [editProtection, setEditProtection] = useState(false);
  const [newPassphrase, setNewPassphrase] = useState('');
  const [oldPassphrase, setOldPassphrase] = useState('');
  const [protectionBusy, setProtectionBusy] = useState(false);
  const [protectionMessage, setProtectionMessage] = useState('');
  const google = getWebSyncProvider() === 'google';
  useEffect(() => subscribeSync(setState), []);
  return (
    <section className="rounded-2xl border border-line bg-surface px-5 py-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
        <Cloud size={16} /> {google ? t('googleSyncSettings') : t('syncSettings')}
      </h2>
      <p className="text-xs leading-relaxed text-muted">
        {google ? (
          t('googleSyncHint')
        ) : (
          <>
            {t('syncSettingsHint')} <code>threadshelf-data/threadshelf/library.json</code>.
          </>
        )}
      </p>
      <div className="mt-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-xs text-muted">
          {state.phase === 'running'
            ? t('syncInProgress')
            : state.lastSyncAt
              ? `${t('lastSync')} : ${new Date(state.lastSyncAt).toLocaleString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}`
              : t('noSync')}
        </div>
        <Button size="sm" disabled={state.phase === 'running'} onClick={() => void syncWebNow()}>
          <RefreshCw size={14} /> {t('sync')}
        </Button>
      </div>
      {state.error ? <p className="mt-3 text-xs text-warning">{state.error}</p> : null}
      {state.phase === 'needs-passphrase' ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setWebPassphrase(passphrase);
            setPassphrase('');
          }}
        >
          <label className="flex-1 text-xs text-muted">
            {t('encryptedLibrary')}
            <input
              type="password"
              minLength={8}
              required
              value={passphrase}
              autoComplete="off"
              onChange={(e) => setPassphrase(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-line bg-bg px-3 text-fg"
            />
          </label>
          <Button size="sm" type="submit">
            {t('unlock')}
          </Button>
        </form>
      ) : null}
      {google && state.mode ? (
        <details className="mt-4 rounded-xl border border-line bg-bg p-4">
          <summary className="ts-focus flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold">
            {state.mode === 'encrypted' ? <LockKeyhole size={16} /> : <ShieldCheck size={16} />}
            {t('googleAdvancedSecurity')}
          </summary>
          <div className="mt-3 border-t border-line pt-3">
            <h3 className="text-sm font-semibold">{t('googleProtectionLabel')}</h3>
            <p className="mt-1 text-xs text-muted">
              {t(state.mode === 'encrypted' ? 'googleCurrentEncrypted' : 'googleCurrentStandard')}
            </p>
          {!editProtection ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setProtectionMessage('');
                setEditProtection(true);
              }}
            >
              {t('googleChangeProtection')}
            </Button>
          ) : (
            <form
              className="mt-3 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const target = state.mode === 'encrypted' ? 'plain' : 'encrypted';
                setProtectionBusy(true);
                setProtectionMessage('');
                void changeWebGoogleMode(target, newPassphrase, oldPassphrase)
                  .then(() => {
                    setEditProtection(false);
                    setNewPassphrase('');
                    setOldPassphrase('');
                    setProtectionMessage(t('googleProtectionSaved'));
                  })
                  .catch((error) =>
                    setProtectionMessage(error instanceof Error ? error.message : String(error)),
                  )
                  .finally(() => setProtectionBusy(false));
              }}
            >
              <p className="text-xs leading-relaxed text-warning">{t('googleChangeWarning')}</p>
              {state.mode === 'encrypted' ? (
                <label className="block text-xs text-muted">
                  {t('googleOldPassphrase')}
                  <input
                    type="password"
                    minLength={8}
                    autoComplete="off"
                    value={oldPassphrase}
                    onChange={(event) => setOldPassphrase(event.target.value)}
                    placeholder={t('encryptedLibrary')}
                    className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-fg"
                  />
                </label>
              ) : (
                <label className="block text-xs text-muted">
                  {t('googleNewPassphrase')}
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={newPassphrase}
                    onChange={(event) => setNewPassphrase(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-fg"
                  />
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  type="submit"
                  disabled={protectionBusy || state.phase === 'running'}
                  loading={protectionBusy}
                >
                  {t('googleApplyProtection')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={protectionBusy}
                  onClick={() => setEditProtection(false)}
                >
                  {t('googleCancelProtection')}
                </Button>
              </div>
            </form>
          )}
            {protectionMessage ? (
              <p role="status" className="mt-2 text-xs text-muted">
                {protectionMessage}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
      {!google || state.mode === 'encrypted' ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          <ShieldCheck size={16} className="shrink-0" />
          {t('passphrasePrivacy')}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <Button
          size="sm"
          disabled={mediaBusy}
          loading={mediaBusy}
          onClick={() => {
            setMediaBusy(true);
            void downloadWebMedia()
              .then((r) =>
                setMediaMessage(
                  `${r.entries} entrées vérifiées · ${r.cached} images ajoutées · ${r.failed} échecs`,
                ),
              )
              .catch((e) => setMediaMessage(String(e)))
              .finally(() => setMediaBusy(false));
          }}
        >
          {t('downloadOfflineImages')}
        </Button>
        {mediaMessage ? <span className="text-xs text-muted">{mediaMessage}</span> : null}
      </div>
    </section>
  );
}

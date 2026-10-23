import { useEffect, useState } from 'react';
import { REDDIT_MATCHES, REDDIT_ORIGINS } from '@/utils/reddit-url';
import { toast } from './ToastNotification';
import { Switch } from './ui/primitives';

const ORIGINS = [...REDDIT_ORIGINS];

/** Whether the user granted ThreadShelf access to reddit.com (null while checking). */
export function useRedditAccess(): boolean | null {
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    const refresh = () =>
      void chrome.permissions
        .contains({ origins: REDDIT_MATCHES })
        .then(setGranted)
        .catch(() => setGranted(false));
    refresh();
    chrome.permissions.onAdded?.addListener(refresh);
    chrome.permissions.onRemoved?.addListener(refresh);
    return () => {
      chrome.permissions.onAdded?.removeListener(refresh);
      chrome.permissions.onRemoved?.removeListener(refresh);
    };
  }, []);
  return granted;
}

/**
 * Asks the browser for reddit.com (and Reddit's image hosts). Must run directly from a click.
 * Once granted, the background registers the content script and injects it into open Reddit tabs.
 */
export function requestRedditAccess(): Promise<boolean> {
  return chrome.permissions.request({ origins: ORIGINS });
}

/** Reddit is opt-in: turning it on asks for access to reddit.com; turning it off gives it back. */
export function RedditSettings() {
  const granted = useRedditAccess();

  const toggle = async (on: boolean) => {
    try {
      if (on) {
        if (await requestRedditAccess())
          toast.success('Reddit activé', 'Le bouton ThreadShelf apparaît sur les posts Reddit.');
      } else {
        await chrome.permissions.remove({ origins: ORIGINS });
      }
    } catch (e) {
      toast.error('Reddit', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Switch
      id="set-reddit"
      checked={!!granted}
      disabled={granted === null}
      onChange={(v) => void toggle(v)}
      label="Activer ThreadShelf sur Reddit"
      description="Enregistrez des posts Reddit et leurs discussions. Le navigateur vous demande l’accès à reddit.com (et aux images de Reddit, pour la lecture hors ligne)."
    />
  );
}

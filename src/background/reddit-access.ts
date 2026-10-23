/**
 * Reddit support is opt-in: the reddit.com host permission is optional, requested from the settings
 * when the user turns Reddit on. Once granted, the content script is registered dynamically (and
 * injected into Reddit tabs already open); removing the permission unregisters it.
 */
import { REDDIT_MATCHES } from '@/utils/reddit-url';

export const REDDIT_SCRIPT_ID = 'threadshelf-reddit';

export async function hasRedditAccess(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: REDDIT_MATCHES });
  } catch {
    return false;
  }
}

async function isRegistered(): Promise<boolean> {
  const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [REDDIT_SCRIPT_ID] });
  return scripts.length > 0;
}

/** Brings the registered content script in line with the granted permission. */
export async function syncRedditScript(opts: { injectOpenTabs?: boolean } = {}): Promise<boolean> {
  if (!chrome.scripting?.registerContentScripts) return false;
  const granted = await hasRedditAccess();
  const registered = await isRegistered();
  if (granted && !registered) {
    await chrome.scripting.registerContentScripts([
      {
        id: REDDIT_SCRIPT_ID,
        matches: REDDIT_MATCHES,
        js: ['content.js'],
        runAt: 'document_idle',
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  } else if (!granted && registered) {
    await chrome.scripting.unregisterContentScripts({ ids: [REDDIT_SCRIPT_ID] });
  }
  if (granted && opts.injectOpenTabs) {
    // Tabs opened before Reddit was turned on (the content script guards against double injection).
    const tabs = await chrome.tabs.query({ url: REDDIT_MATCHES });
    for (const tab of tabs) {
      if (!tab.id) continue;
      await chrome.scripting
        .executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
        .catch(() => undefined);
    }
  }
  return granted;
}

export function installRedditAccess(): void {
  const resync = () => void syncRedditScript({ injectOpenTabs: true }).catch(() => undefined);
  chrome.permissions?.onAdded.addListener(resync);
  chrome.permissions?.onRemoved.addListener(resync);
  void syncRedditScript().catch(() => undefined);
}

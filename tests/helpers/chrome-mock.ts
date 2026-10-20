/**
 * Minimal in-memory WebExtension API used by integration tests: storage.local (+ onChanged),
 * runtime messaging routed to a background handler, tabs.create recorder.
 */
type Listener = (
  msg: unknown,
  sender: chrome.runtime.MessageSender,
  respond: (r: unknown) => void,
) => boolean | undefined | void;

export const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';

export function installChromeMock(
  opts: {
    background?: (msg: unknown, sender: { id: string; url: string }) => Promise<unknown>;
  } = {},
) {
  const store: Record<string, unknown> = {};
  const changeListeners = new Set<
    (c: Record<string, chrome.storage.StorageChange>, area: string) => void
  >();
  const messageListeners = new Set<Listener>();
  const opened: string[] = [];
  const api = {
    runtime: {
      id: EXT_ID,
      getURL: (p: string) => `chrome-extension://${EXT_ID}/${p.replace(/^\//, '')}`,
      getManifest: () => ({ version: '1.0.0' }),
      sendMessage: async (msg: unknown) => {
        if (!opts.background) throw new Error('No background');
        return opts.background(msg, { id: EXT_ID, url: location.href });
      },
      onMessage: {
        addListener: (l: Listener) => messageListeners.add(l),
        removeListener: (l: Listener) => messageListeners.delete(l),
      },
    },
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: structuredClone(store[key]) } : {}),
        set: async (items: Record<string, unknown>) => {
          const changes: Record<string, chrome.storage.StorageChange> = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: store[k], newValue: structuredClone(v) };
            store[k] = structuredClone(v);
          }
          for (const l of changeListeners) l(changes, 'local');
        },
      },
      onChanged: {
        addListener: (l: (c: Record<string, chrome.storage.StorageChange>, a: string) => void) =>
          changeListeners.add(l),
        removeListener: (l: (c: Record<string, chrome.storage.StorageChange>, a: string) => void) =>
          changeListeners.delete(l),
      },
    },
    tabs: {
      create: async ({ url }: { url: string }) => {
        opened.push(url);
      },
    },
  };
  (globalThis as unknown as { chrome: unknown }).chrome = api;
  /** Deliver a message to content-script listeners, as chrome.tabs.sendMessage would. */
  const toContent = (
    msg: unknown,
    sender: Partial<chrome.runtime.MessageSender> = { id: EXT_ID },
  ) =>
    new Promise((resolve) => {
      let async = false;
      for (const l of messageListeners) {
        const r = l(msg, sender as chrome.runtime.MessageSender, resolve);
        if (r === true) async = true;
      }
      if (!async) setTimeout(() => resolve(undefined), 0);
    });
  return {
    api,
    store,
    opened,
    toContent,
    uninstall: () => delete (globalThis as unknown as { chrome?: unknown }).chrome,
  };
}

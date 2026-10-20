import { DEFAULT_SETTINGS, parseSettings, type Settings } from './schema';

const KEY = 'threadshelf.settings';

/**
 * Settings live in chrome.storage.local (not IndexedDB): content scripts on x.com cannot open the
 * extension's IndexedDB, but they can read storage.local and receive change events.
 */
function area(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
}

let memory: Settings = DEFAULT_SETTINGS;

export async function loadSettings(): Promise<Settings> {
  const a = area();
  if (!a) return memory;
  const data = await a.get(KEY);
  return parseSettings(data[KEY]);
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K];
};

export async function updateSettings(patch: DeepPartial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const next = parseSettings({
    ...current,
    ...patch,
    reader: { ...current.reader, ...patch.reader },
    copy: { ...current.copy, ...patch.copy },
    ai: { ...current.ai, ...patch.ai },
    library: { ...current.library, ...patch.library },
  });
  const a = area();
  if (a) await a.set({ [KEY]: next });
  else memory = next;
  return next;
}

export async function replaceSettings(next: Settings): Promise<void> {
  const parsed = parseSettings(next);
  const a = area();
  if (a) await a.set({ [KEY]: parsed });
  else memory = parsed;
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return () => {};
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && changes[KEY]) cb(parseSettings(changes[KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export const SETTINGS_KEY = KEY;

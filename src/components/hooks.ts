import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema';
import { loadSettings, onSettingsChanged, updateSettings } from '@/settings/store';

export function useSettings(): [
  Settings,
  (patch: Parameters<typeof updateSettings>[0]) => Promise<void>,
  boolean,
] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    loadSettings().then((s) => {
      if (alive) {
        setSettings(s);
        setLoaded(true);
      }
    });
    const off = onSettingsChanged((s) => alive && setSettings(s));
    return () => {
      alive = false;
      off();
    };
  }, []);
  const update = async (patch: Parameters<typeof updateSettings>[0]) => {
    // Optimistic: controlled inputs reflect the change immediately, storage follows.
    setSettings(
      (prev) =>
        ({
          ...prev,
          ...patch,
          reader: { ...prev.reader, ...patch.reader },
          copy: { ...prev.copy, ...patch.copy },
          ai: { ...prev.ai, ...patch.ai },
          webTranslation: { ...prev.webTranslation, ...patch.webTranslation },
          library: { ...prev.library, ...patch.library },
          sync: { ...prev.sync, ...patch.sync },
        }) as Settings,
    );
    setSettings(await updateSettings(patch));
  };
  return [settings, update, loaded];
}

function systemDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Applies light / dark / system theme to <html>. Returns whether dark is active. */
export function useThemeClass(theme: Settings['theme'], el?: HTMLElement | null): boolean {
  const [sys, setSys] = useState(systemDark);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSys(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const dark = theme === 'dark' || (theme === 'system' && sys);
  useEffect(() => {
    const target = el ?? document.documentElement;
    target.classList.toggle('dark', dark);
  }, [dark, el]);
  return dark;
}

export function useHotkeys(
  map: Record<string, (e: KeyboardEvent) => void>,
  deps: unknown[] = [],
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      const combo = `${e.metaKey || e.ctrlKey ? 'mod+' : ''}${e.shiftKey && e.key.length > 1 ? 'shift+' : ''}${e.key.toLowerCase()}`;
      const fn = map[combo];
      if (!fn) return;
      if (typing && !combo.startsWith('mod+') && combo !== 'escape') return;
      e.preventDefault();
      fn(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, domainOf, isActiveOn, parseSettings } from '@/settings/schema';
import { loadSettings, updateSettings } from '@/settings/store';

describe('settings', () => {
  it('has safe defaults: detect automatically, save only on action, no AI', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      enabled: true,
      autoDetect: true,
      injectUi: true,
      notifications: true,
      cacheMedia: true,
      ai: { enabled: false, consentAt: null },
      webTranslation: { automatic: false, consentAt: null },
    });
  });

  it('recovers from corrupted stored values, keeping the valid ones', () => {
    const s = parseSettings({
      enabled: false,
      theme: 'neon',
      reader: { fontSize: 999 },
      disabledDomains: ['x.com', 'evil.com'],
    });
    expect(s.enabled).toBe(false);
    expect(s.theme).toBe('system');
    expect(s.reader.fontSize).toBe(19);
    expect(s.disabledDomains).toEqual([]);
  });

  it('resolves domains and activation', () => {
    expect(domainOf('mobile.twitter.com')).toBe('twitter.com');
    expect(domainOf('www.x.com')).toBe('x.com');
    expect(domainOf('example.com')).toBeNull();
    expect(isActiveOn(DEFAULT_SETTINGS, 'x.com')).toBe(true);
    expect(isActiveOn({ ...DEFAULT_SETTINGS, disabledDomains: ['x.com'] }, 'x.com')).toBe(false);
    expect(isActiveOn({ ...DEFAULT_SETTINGS, enabled: false }, 'twitter.com')).toBe(false);
    expect(isActiveOn(DEFAULT_SETTINGS, 'example.com')).toBe(false);
  });

  it('merges nested updates', async () => {
    await updateSettings({ reader: { fontSize: 22 } });
    await updateSettings({ webTranslation: { automatic: true, consentAt: 123 } });
    await updateSettings({ webTranslation: { automatic: false } });
    const s = await loadSettings();
    expect(s.reader).toEqual({ fontSize: 22, width: 680, font: 'serif' });
    expect(s.webTranslation).toEqual({ automatic: false, consentAt: 123 });
  });
});

// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from '../../src/web/LandingPage';

vi.mock('../../src/web/LandingDemo', () => ({ LandingDemo: () => null }));
vi.mock('../../src/web/InstallGuide', () => ({ InstallGuide: () => null }));
vi.mock('../../src/web/ExtensionShowcase', () => ({ ExtensionShowcase: () => null }));
vi.mock('../../src/web/i18n', () => ({
  LanguageSelector: () => null,
  useWebI18n: () => ({
    t: (key: string) =>
      ({
        demoSignInShort: 'Connexion',
        signIn: 'Se connecter avec GitHub',
        signInGoogle: 'Se connecter avec Google',
        signInHint: 'Choisissez votre compte.',
        dialogClose: 'Fermer',
      })[key as 'demoSignInShort'] ?? key,
  }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('TheardX web connection chooser', () => {
  it('lets users select a real Google or GitHub logo after clicking Connexion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ google: true })),
    );
    await act(async () => root.render(createElement(LandingPage, { loginAvailable: true })));
    const launch = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Connexion'),
    );
    expect(launch).toBeTruthy();
    await act(async () => launch!.click());
    const chooser = container.querySelector('dialog');
    expect(chooser?.hasAttribute('open')).toBe(true);
    expect(chooser?.querySelector('a[href="/api/auth/google/login"]')).toBeTruthy();
    expect(chooser?.querySelector('a[href="/api/auth/login"]')).toBeTruthy();
    expect(chooser?.querySelector('[data-provider-logo="google"]')).toBeTruthy();
    expect(chooser?.querySelector('[data-provider-logo="github"]')).toBeTruthy();
  });

  it('keeps GitHub available when Google is disabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ google: false })),
    );
    await act(async () => root.render(createElement(LandingPage, { loginAvailable: true })));
    expect(container.querySelector('a[href="/api/auth/login"]')).toBeTruthy();
    expect(container.querySelector('a[href="/api/auth/google/login"]')).toBeNull();
  });
});

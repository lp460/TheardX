/** Runtime capability detection — never assume every Chromium API exists (Arc lacks some). */
export interface Capabilities {
  browser: 'arc' | 'brave' | 'edge' | 'chrome' | 'chromium';
  sidePanel: boolean;
  commands: boolean;
  contextMenus: boolean;
  storageEstimate: boolean;
  clipboard: boolean;
  print: boolean;
}

export function detectBrowser(): Capabilities['browser'] {
  if (typeof document !== 'undefined') {
    const arcVar = getComputedStyle(document.documentElement).getPropertyValue(
      '--arc-palette-title',
    );
    if (arcVar) return 'arc';
  }
  const nav = navigator as Navigator & {
    brave?: unknown;
    userAgentData?: { brands?: { brand: string }[] };
  };
  if (nav.brave) return 'brave';
  const brands = nav.userAgentData?.brands?.map((b) => b.brand) ?? [];
  if (brands.some((b) => /Edge/i.test(b))) return 'edge';
  if (brands.some((b) => /Google Chrome/i.test(b))) return 'chrome';
  return 'chromium';
}

export function detectCapabilities(): Capabilities {
  const c = typeof chrome !== 'undefined' ? chrome : undefined;
  return {
    browser: detectBrowser(),
    sidePanel: !!(c as unknown as { sidePanel?: { open?: unknown } })?.sidePanel?.open,
    commands: !!c?.commands,
    contextMenus: !!c?.contextMenus,
    storageEstimate: !!navigator.storage?.estimate,
    clipboard: !!navigator.clipboard,
    print: typeof window.print === 'function',
  };
}

/** Where the user can edit keyboard shortcuts for this browser. */
export function shortcutsUrl(browser: Capabilities['browser']): string {
  switch (browser) {
    case 'arc':
      return 'arc://extensions/shortcuts';
    case 'edge':
      return 'edge://extensions/shortcuts';
    case 'brave':
      return 'brave://extensions/shortcuts';
    default:
      return 'chrome://extensions/shortcuts';
  }
}

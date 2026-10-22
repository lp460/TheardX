/** Manifest V3 definition — written to dist/manifest.json by scripts/build.mjs. */
export function createManifest(pkg) {
  const icons = {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  };
  return {
    manifest_version: 3,
    name: 'ThreadShelf',
    short_name: 'ThreadShelf',
    version: pkg.version,
    description:
      'Enregistrez, lisez, copiez et organisez les publications et threads X.com. Bibliothèque locale, mode lecture, exports.',
    minimum_chrome_version: '120',
    icons,
    action: {
      default_popup: 'popup/index.html',
      default_title: 'ThreadShelf',
      default_icon: icons,
    },
    background: { service_worker: 'background.js', type: 'module' },
    content_scripts: [
      {
        matches: [
          'https://x.com/*',
          'https://twitter.com/*',
          'https://mobile.x.com/*',
          'https://mobile.twitter.com/*',
        ],
        js: ['content.js'],
        run_at: 'document_idle',
        all_frames: false,
      },
    ],
    options_ui: { page: 'options/index.html', open_in_tab: true },
    permissions: ['storage', 'unlimitedStorage', 'contextMenus', 'clipboardWrite', 'alarms'],
    // Only used to download images of posts you saved, for offline reading.
    host_permissions: ['https://pbs.twimg.com/*'],
    // Requested only when the user clicks « Se connecter avec GitHub ».
    optional_host_permissions: ['https://github.com/*', 'https://api.github.com/*'],
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+T' },
        description: 'Ouvrir ThreadShelf',
      },
      'save-thread': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Enregistrer le thread affiché',
      },
      'copy-thread': {
        suggested_key: { default: 'Alt+Shift+C' },
        description: 'Copier le thread affiché (Markdown)',
      },
      'open-library': {
        suggested_key: { default: 'Alt+Shift+L' },
        description: 'Ouvrir la bibliothèque',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; base-uri 'none'",
    },
  };
}

/** Manifest V3 definition — written to dist/manifest.json by scripts/build.mjs. */
import { CHROME_OAUTH_CLIENT_ID, EXTENSION_PUBLIC_KEY } from './extension-identity.mjs';

export function createManifest(pkg, { googleClientId = CHROME_OAUTH_CLIENT_ID } = {}) {
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
    // Keep the extension ID stable even when a user moves an unpacked ZIP.
    key: EXTENSION_PUBLIC_KEY,
    description:
      'Enregistrez, lisez, copiez et organisez les threads X et les discussions Reddit. Bibliothèque locale, mode lecture, exports.',
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
    permissions: [
      'storage',
      ...(googleClientId ? ['identity'] : []),
      'unlimitedStorage',
      'contextMenus',
      'clipboardWrite',
      'alarms',
      // Registers the Reddit content script once the user grants reddit.com (no install warning).
      'scripting',
    ],
    // Only used to download images of posts you saved, for offline reading.
    host_permissions: ['https://pbs.twimg.com/*'],
    optional_host_permissions: [
      // Requested only when the user clicks « Se connecter avec GitHub ».
      'https://github.com/*',
      'https://api.github.com/*',
      // Requested only if the user elects Google sync; no broad Drive permission.
      'https://www.googleapis.com/*',
      'https://openidconnect.googleapis.com/*',
      // Requested only when the user turns Reddit on (pages + images of saved posts).
      'https://www.reddit.com/*',
      'https://reddit.com/*',
      'https://i.redd.it/*',
      'https://preview.redd.it/*',
      'https://cf.preview.redd.it/*',
      'https://external-preview.redd.it/*',
      'https://styles.redditmedia.com/*',
      'https://www.redditstatic.com/*',
    ],
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
    ...(googleClientId
      ? {
          oauth2: {
            client_id: googleClientId,
            scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'],
          },
        }
      : {}),
  };
}

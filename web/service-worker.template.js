/* The build replaces the following list with every hashed app asset. Never cache private APIs. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `theardx-app-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('theardx-app-') && key !== CACHE).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(url.pathname, copy)));
        }
        return response;
      }).catch(async () => {
        const cache = await caches.open(CACHE);
        const shell = url.pathname.startsWith('/reader') ? '/reader/index.html' : '/index.html';
        return (await cache.match(url.pathname)) || (await cache.match(shell)) || Response.error();
      }),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
      }
      return response;
    })),
  );
});

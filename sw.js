// MASS BIKE — Service Worker
// Proper same-origin file (not a Blob URL) so caching, versioning, and updates
// work exactly the way a normal PWA service worker is supposed to.

const CACHE_VERSION = 'massbike-v3.2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, {cache: 'reload'})).catch(() => {})
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // App shell / navigation requests: cache-first for instant offline launch,
  // refreshed from the network in the background whenever online.
  if (event.request.mode === 'navigate' || (isSameOrigin && APP_SHELL.some((p) => url.pathname.endsWith(p.replace('./', '/'))))) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, res.clone()));
            }
            return res;
          })
          .catch(() => cached || caches.match('./index.html'));
        return cached || network;
      })
    );
    return;
  }

  // Everything else (Google Fonts, Google Drive API scripts, etc.):
  // network-first, fall back to cache if offline. Third-party APIs that
  // genuinely need connectivity (Drive backup/restore) will simply fail
  // offline, which is expected — the rest of the app keeps working.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && isSameOrigin) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

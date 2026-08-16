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

// Google Fonts (CSS + the actual .woff2 files) both serve proper CORS headers,
// so we can cache them like any other asset — once loaded while online, the
// app's typography stays consistent even fully offline afterwards.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

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
  const isFontHost = FONT_HOSTS.includes(url.hostname);

  // App shell / navigation requests: cache-first for instant offline launch,
  // refreshed from the network in the background whenever online. Any request
  // for the page itself (navigation) or the exact same-origin shell files is
  // treated as app-shell — matched by filename only, so this keeps working
  // no matter what sub-path the site is hosted under.
  const isShellFile = isSameOrigin && APP_SHELL.some((p) => url.pathname.endsWith(p.replace('./', '')));
  if (event.request.mode === 'navigate' || isShellFile) {
    const shellKey = event.request.mode === 'navigate' ? './index.html' : event.request;
    event.respondWith(
      caches.match(shellKey).then((cached) => {
        const network = fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(CACHE_VERSION).then((cache) => cache.put(shellKey, res.clone()));
            }
            return res;
          })
          .catch(() => cached || caches.match('./index.html'));
        return cached || network;
      })
    );
    return;
  }

  // Google Fonts: cache-first so typography stays consistent offline once the
  // font has loaded at least once. Font files never change once published
  // (Google versions the URL itself), so cache-first is safe and instant.
  if (isFontHost) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
            }
            return res;
          })
          .catch(() => cached); // offline + never cached: let it fail, CSS fallback fonts take over
      })
    );
    return;
  }

  // Everything else (Google Drive/Identity API scripts, etc.): network-first,
  // fall back to cache if offline. These genuinely need live connectivity
  // (OAuth, Drive backup/restore) — when offline they simply won't work,
  // which is expected, and the rest of the app keeps working normally.
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

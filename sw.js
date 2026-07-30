// Offline-cache service worker for Mass Uniform Store.
// NETWORK-FIRST strategy: always tries to fetch the latest version from
// the server first, and only falls back to the cached copy if there's
// no internet. This matters a lot for an app that's still being updated
// often — a cache-first strategy would keep showing old versions forever
// even after a fresh deploy, since the cache never gets invalidated on
// its own.
//
// CACHE_NAME is bumped on every deploy so the old cache is discarded and
// replaced during the "activate" step below.
const CACHE_NAME = "mus-ledger-v2";
const APP_SHELL = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

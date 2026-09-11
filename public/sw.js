// Workout Caller service worker — deliberately minimal per the project's
// spec ("do not overengineer service-worker behavior if it threatens
// reliability"). It does NOT intercept API or Supabase calls; offline
// workout execution is handled entirely by already-loaded JS + IndexedDB
// (see lib/offline/*), not by this file. This only makes the app shell
// available if the network is unreachable when a page is (re)loaded.

const CACHE_NAME = 'workout-caller-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API routes — always go to the network for these.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
  );
});

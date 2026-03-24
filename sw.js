/* ═══════════════════════════════════════════════════════════
   Craze Hosiery — Service Worker
   Caches the app shell for offline use.
   Firebase data is always live when online; shows last
   cached data when offline.
   ═══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'craze-hosiery-v1';

/* Files to cache on install */
const PRECACHE = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap',
];

/* ── INSTALL: cache app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE).catch(() => {
        /* font CDN may fail in some environments — ignore */
        return cache.add('/index.html');
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: remove old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: network-first for Firebase, cache-first for app shell ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Always go network for Firebase — never cache live data */
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    event.respondWith(fetch(event.request).catch(() => {
      /* Firebase offline — return empty JSON so app handles gracefully */
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }

  /* App shell: network first, fall back to cache */
  event.respondWith(
    fetch(event.request)
      .then(response => {
        /* Cache fresh copy */
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        /* Offline: serve from cache */
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          /* For navigation requests, always serve index.html */
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

/* ── MESSAGE: force update from app ── */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

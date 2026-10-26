const CACHE_NAME = 'qubsuite-v1';
const PRECACHE_URLS = [
  '/',
  '/favicon.svg',
  '/manifest.json',
  '/qubators-logo-white.png',
];

// Install: Cache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy based on request type
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ignore non-GET requests (mutations always go directly to network)
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. Navigation requests (HTML SPA shell): Network-first with fallback to cached '/'
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('/') || caches.match(req);
      })
    );
    return;
  }

  // 2. Static assets (JS, CSS, images, fonts): Stale-While-Revalidate
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(req).then((cachedResponse) => {
          const fetchPromise = fetch(req).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(req, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 3. API & other requests: Network-first
  event.respondWith(
    fetch(req).catch(() => {
      return caches.match(req);
    })
  );
});

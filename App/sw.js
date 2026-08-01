const CACHE_NAME = 'expires-lab-v11';
const ASSETS = [
  './Application - périmés.html',
  './supabase.js',
  './html5-qrcode.min.js',
  './manifest.json'
];

// Install Event
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activate Event - Purge old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Suppression de l'ancien cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event - Strategy: Network First for HTML, Cache First for assets
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.url.includes('supabase.co')) {
    return;
  }

  // Toujours charger l'HTML le plus récent depuis le réseau
  if (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache First pour les scripts et assets fixes
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      });
    })
  );
});

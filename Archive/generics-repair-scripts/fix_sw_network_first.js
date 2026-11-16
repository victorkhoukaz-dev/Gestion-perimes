const fs = require('fs');

// 1. Supprimer le fichier désuet generics_portal.html s'il existe
const portalPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_portal.html';
if (fs.existsSync(portalPath)) {
  fs.unlinkSync(portalPath);
  console.log('Deleted obsolete generics_portal.html.');
}

// 2. Mettre à jour Service Worker (sw.js) pour forcer Network-First sur TOUS les fichiers HTML et iFrames
const swPath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/sw.js';
let swContent = fs.readFileSync(swPath, 'utf8');

const newFetchStrategy = `// Fetch Event - Strategy: Network First pour TOUS les fichiers HTML et iFrames
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.url.includes('supabase.co')) {
    return;
  }

  const isHtml = e.request.url.endsWith('.html') || e.request.url.includes('generics_') || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'));

  if (isHtml) {
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

  // Cache First avec mise à jour réseau pour les assets statiques
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      });
    })
  );
});`;

const startIdx = swContent.indexOf('// Fetch Event');
if (startIdx !== -1) {
  swContent = swContent.substring(0, startIdx) + newFetchStrategy;
  fs.writeFileSync(swPath, swContent);
  console.log('Successfully updated sw.js with Network-First strategy for HTML and iFrames.');
}

// Mettre à jour ce nom à chaque release (ex: v2.7) pour invalider l’ancien cache
const CACHE_NAME = 'coaching-v2.7';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Stratégie de cache :
// - JSON (programmes) : Network First avec fallback cache (pour garder le dernier programme si le réseau est KO)
// - Assets statiques (HTML/CSS/JS/icônes) : Cache First avec fallback réseau
self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  if (!url.startsWith(self.location.origin)) return;

  // 1. Programmes JSON : network first -> cache fallback
  if (url.includes('clients/') || url.endsWith('.json') || url.includes('.json?')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          if (res.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 2. Assets statiques : cache first -> network fallback
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        const clone = res.clone();
        if (res.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

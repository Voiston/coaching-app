// Mettre à jour ce nom à chaque release (ex: v2.5) pour invalider l’ancien cache
const CACHE_NAME = 'coaching-v2.4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './favicon.svg'
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

// Réseau d'abord pour l'app (fraîcheur) ; cache pour offline. JSON (clients/) jamais mis en cache.
self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  if (!url.startsWith(self.location.origin)) return;
  if (url.includes('clients/') || url.includes('.json?')) return; // Ne jamais cacher les programmes

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        if (res.ok && !e.request.url.includes('.json')) {
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Service Worker minimal OPSO Sante - cache-first sur les assets statiques
const CACHE_NAME = 'opso-v1-' + new Date().toISOString().slice(0,10);
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './opso-adherents.js',
  './offilog-live-data.js',
  './wml-sales-data.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // On precache sans bloquer si certains fichiers manquent
      return Promise.allSettled(PRECACHE.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k.startsWith('opso-v1-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Ne cache que GET HTTP(S)
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  // Ne touche pas aux requetes Supabase / API externes
  if (req.url.includes('supabase.co') || req.url.includes('googleapis.com/identitytoolkit')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Stale-while-revalidate : retourne cache et rafraichit en arriere-plan
        fetch(req).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(res => {
        // Met en cache les fichiers statiques opso
        if (res && res.status === 200 && (req.url.includes('/opso/') || req.url.includes('fonts.gstatic.com') || req.url.includes('cdn.jsdelivr.net'))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Fallback offline : tente de renvoyer index.html pour les navigations
        if (req.mode === 'navigate') return caches.match('./index.html');
        throw new Error('Offline et pas en cache');
      });
    })
  );
});

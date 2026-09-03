// Service Worker OPSO Sante
// Stratégie : network-first sur index.html + app.js (fichiers qui versionnent les autres)
// Cache-first stale-while-revalidate sur tout le reste (data files, images, fonts).
const CACHE_NAME = 'opso-v3-' + new Date().toISOString().slice(0,10);
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './opso-adherents.js',
  './offilog-live-data.js',
  './wml-sales-data.js',
];

// Fichiers qu'on doit TOUJOURS récupérer depuis le réseau si possible
// (sinon les versions cachées d'index.html peuvent pointer vers de vieux JS)
const NETWORK_FIRST = [
  /\/opso\/?$/,                 // navigation racine
  /\/opso\/index\.html$/,
  /\/opso\/app\.js(\?|$)/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(PRECACHE.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k.startsWith('opso-') && k !== CACHE_NAME)
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
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  if (req.url.includes('supabase.co') || req.url.includes('googleapis.com/identitytoolkit')) return;

  const isNetworkFirst = NETWORK_FIRST.some(re => re.test(req.url)) || req.mode === 'navigate';

  if (isNetworkFirst) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first stale-while-revalidate pour tout le reste
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(res => {
        if (res && res.status === 200 && (req.url.includes('/opso/') || req.url.includes('fonts.gstatic.com') || req.url.includes('cdn.jsdelivr.net'))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
        throw new Error('Offline et pas en cache');
      });
    })
  );
});

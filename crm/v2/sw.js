/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Service Worker — mode hors-ligne
   Stratégie sûre (évite le « cache cassé » qui avait motivé l'ancien nettoyage) :
   - Document (navigation/index.html) : NETWORK-FIRST → toujours frais en ligne,
     repli sur le cache uniquement hors réseau.
   - Assets versionnés (?v=…) : CACHE-FIRST → immuables par version, donc rapides
     et disponibles hors-ligne. Un nouveau déploiement = nouvelles URL ?v= =
     nouveau cache (les anciens caches sont purgés à l'activation).
   - Tiers (fonts, Supabase, CDN) : on laisse passer au réseau (pas d'interception).

   ⚠️ Bumper VER à chaque déploiement (aligné sur le ?v= de index.html).
   ═══════════════════════════════════════════════════════════════════ */
var VER = '20260904j';
var CACHE = 'jarvis-' + VER;

self.addEventListener('install', function (e) {
  self.skipWaiting(); // le nouveau SW prend la main tout de suite
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* ── Alertes « un pharmacien vient de réserver » ────────────────────
   Le serveur pousse un petit JSON ; on l'affiche. Si le corps est illisible
   (relais qui envoie un ping vide), on affiche quand même quelque chose :
   une notification muette vaut mieux qu'un rendez-vous manqué. */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  var titre = d.titre || 'JARVIS';
  e.waitUntil(self.registration.showNotification(titre, {
    body: d.corps || 'Un rendez-vous vient d’être pris.',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'jarvis-rdv',
    renotify: true,
    data: { url: d.url || '#rdv' }
  }));
});

/* Toucher la notification ouvre l'app SUR le bon écran — et réutilise
   l'onglet déjà ouvert plutôt que d'en empiler un second. */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var cible = (e.notification.data && e.notification.data.url) || '#rdv';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (l) {
      for (var i = 0; i < l.length; i++) {
        if (l[i].url.indexOf(self.registration.scope) === 0 && 'focus' in l[i]) {
          l[i].navigate(self.registration.scope + 'index.html' + cible);
          return l[i].focus();
        }
      }
      return self.clients.openWindow('./index.html' + cible);
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; // tiers (fonts/Supabase/CDN) → réseau direct

  // Document : network-first (toujours frais en ligne), repli cache hors-ligne
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return r;
      }).catch(function () {
        return caches.match(req).then(function (m) { return m || caches.match('./index.html'); });
      })
    );
    return;
  }

  // Assets (CSS/JS/PNG/données, URL versionnées) : cache-first
  e.respondWith(
    caches.match(req).then(function (m) {
      if (m) return m;
      return fetch(req).then(function (r) {
        if (r && r.ok && r.type === 'basic') {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return r;
      });
    })
  );
});

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
var VER = '20261022ptn';
var CACHE = 'jarvis-' + VER;

/* 11/09/2026 (perf, phase 3) — le SOCLE est rangé dès l'installation : les
   scripts et feuilles que index.html charge avant le premier rendu (le reste,
   V2_MODULES et les données, entre dans le cache au fil de l'eau comme avant).
   Une ouverture interrompue ou un premier passage hors-ligne trouve donc quand
   même l'écran de connexion à la deuxième fois. Fichier par fichier, jamais
   addAll : un seul 404 ferait échouer l'installation entière du service worker.
   ⚠️ Liste à tenir alignée sur les <script>/<link> du socle de index.html. */
var SOCLE = [
  './index.html',
  'v2.css', 'v2-pieces.css', 'v2-accueil.css', 'v2-accueil-cinq.css', 'v2-accueil-widgets.css', 'v2-motion.css', 'v2-verriere.css', 'v2-hab.css',
  'vendor/leaflet/leaflet.css', 'vendor/leaflet/MarkerCluster.css', 'vendor/leaflet/MarkerCluster.Default.css',
  'vendor/supabase/supabase-2.112.2.min.js',
  'v2-icons.js', 'groupement-alias.js', 'v2-boot.js', 'v2-profil.js',
  'v2-accueil-cinq.js', 'v2-accueil-widgets.js', 'v2-app.js', 'v2-motion.js', 'v2-bg.js', 'v2-hab.js',
  'manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  self.skipWaiting(); // le nouveau SW prend la main tout de suite
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SOCLE.map(function (f) {
        var url = f === './index.html' ? f : f + '?v=' + VER;
        return fetch(url).then(function (r) {
          if (r && r.ok && r.type === 'basic') return c.put(url, r);
        }).catch(function () {});   // un fichier absent n'empêche pas l'installation
      }));
    }).catch(function () {})
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      // 11/09/2026 — le tiroir des VENTES (v2-protege-ventes-<empreinte>, voir
      // v2-boot.js) survit aux mises en ligne : il est versionné par le contenu
      // des tranches, pas par VER. v2-boot.js nettoie lui-même ses anciennes
      // versions, et la déconnexion le vide.
      // 30/09/2026 — même règle pour le tiroir des autres fichiers protégés,
      // rangés par empreinte (quota de trafic Supabase dépassé ce jour-là).
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && k.indexOf('v2-protege-ventes-') !== 0 &&
            k !== 'v2-protege-empreintes') return caches.delete(k);
      }));
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
    // Discussion : une étiquette par sujet, pour que dix messages du même
    // sujet n'empilent pas dix alertes.
    tag: d.tag || 'jarvis-rdv',
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

/* 13/10/2026 — relais « à froid » : il répond parfois 503 sur UN fichier statique.
   Fichier refusé (5xx ou réseau coupé) = redemandé 2 fois au plus, après 300 ms puis 1 s.
   Un 4xx n'est pas une panne passagère. Après les essais, l'échec est rendu tel quel
   (et jamais rangé : le `r.ok` plus bas l'écarte). */
function redemander(req, k) {
  var suite = function () {
    return new Promise(function (ok) { setTimeout(ok, k ? 1000 : 300); }).then(function () { return redemander(req, k + 1); });
  };
  return fetch(req).then(function (r) { return r.status < 500 || k >= 2 ? r : suite(); },
                         function (err) { if (k >= 2) throw err; return suite(); });
}

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
      return redemander(req, 0).then(function (r) {
        if (r && r.ok && r.type === 'basic') {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return r;
      });
    })
  );
});

/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Hors ligne — 28/10/2026
   Will : « consulter + noter » sans réseau, et reconnexion obligatoire après
   3 jours sans réseau (sinon un compte bloqué verrait encore, sur un
   téléphone resté hors réseau, les données rangées dessus).

   1. Lectures Supabase : chaque réponse de lecture (/rest/v1/, GET) est rangée
      sur l'appareil ; si le réseau manque, la dernière est resservie. Rangement
      `v2-protege-lectures` : vidé à la déconnexion avec les autres v2-protege-*.
   2. Ouverture sans réseau : mémo de la dernière vérification EN LIGNE du
      compte (v2-boot.js, V2.loadUserProfile). Valable 3 jours.
   3. Boîte d'envoi : notes et rendez-vous saisis sans réseau, gardés sur
      l'appareil puis envoyés dans l'ordre au retour du réseau. Un refus du
      serveur n'efface rien : la saisie passe dans `v2-hl-refus`.
   4. Bandeau « Hors ligne ».
   ⚠️ Chargé AVANT v2-boot.js : getSb() passe V2.hl.fetch à createClient.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var HL = V2.hl = {};
  var CACHE = 'v2-protege-lectures';
  var LS_ENVOIS = 'v2-hl-envois', LS_REFUS = 'v2-hl-refus', LS_MEMO = 'v2-hl-profil';
  var TROIS_JOURS = 3 * 24 * 3600 * 1000;
  var coupe = false;          // le dernier appel réseau a échoué
  var sansReseauDepuis = 0;   // ouverture sur le mémo : heure de la dernière vérification en ligne
  var rebranche = false;      // réseau revenu après une ouverture sans réseau
  var tropVieux = false;      // plus de 3 jours sans vérification en ligne

  function lsLire(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function lsEcrire(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  HL.nouvelId = function () {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  // ── 1. Lectures ───────────────────────────────────────────────────
  // Clé = l'adresse nue (sans en-têtes) : la même au rangement et à la relecture.
  function ranger(url, r) {
    try { caches.open(CACHE).then(function (c) { return c.put(url, r); }).catch(function () {}); } catch (e) {}
  }
  function relire(url) {
    try { return caches.open(CACHE).then(function (c) { return c.match(url); }).catch(function () { return null; }); }
    catch (e) { return Promise.resolve(null); }
  }
  function etat(ok) {
    if (!ok) { if (!coupe) { coupe = true; afficher(); } return; }
    var etaitCoupe = coupe || (sansReseauDepuis && !rebranche);
    coupe = false;
    if (!etaitCoupe) return;
    if (sansReseauDepuis) rebranche = true;
    revenu();
  }
  HL.fetch = function (entree, init) {
    var url = typeof entree === 'string' ? entree : (entree && entree.url) || String(entree || '');
    var methode = String((init && init.method) || (entree && entree.method) || 'GET').toUpperCase();
    var lecture = methode === 'GET' && url.indexOf('/rest/v1/') > 0;
    var gardee = url.indexOf('/rest/v1/rdv?') > 0 ? surSaisie(url, methode, init) : null;
    if (gardee) return Promise.resolve(gardee);
    return window.fetch(entree, init).then(function (r) {
      etat(true);
      if (lecture && r.ok) ranger(url, r.clone());
      return lecture ? avecRdvGardes(url, r) : r;
    }, function (err) {
      if (err && err.name === 'AbortError') throw err;
      etat(false);
      if (!lecture) throw err;
      return relire(url).then(function (m) { if (m) return avecRdvGardes(url, m); throw err; });
    });
  };

  // ── 1 bis. Rendez-vous gardés, montrés comme les autres ───────────
  // Un RDV noté sans réseau entre dans CHAQUE lecture de la table `rdv` dont il remplit
  // les filtres (planning, semaine, écran Rendez-vous, contrôle de chevauchement de la
  // feuille rapide…), marqué `_attente`. Modifié ou supprimé avant son envoi : c'est la
  // saisie gardée qui change, pas la base. Filtres compris : eq, neq, gt, gte, lt, lte,
  // is, in. Un autre (or, not, offset…) : la lecture est rendue telle quelle.
  function lireFiltres(url) {
    var u; try { u = new URL(url); } catch (e) { return null; }
    if (!/\/rest\/v1\/rdv$/.test(u.pathname)) return null;
    var f = { conds: [], select: null, order: [] }, ok = true;
    u.searchParams.forEach(function (v, k) {
      if (k === 'select') { if (v !== '*') { if (/[(:!*]/.test(v)) ok = false; else f.select = v.split(','); } return; }
      if (k === 'order') { v.split(',').forEach(function (o) { var p = o.split('.'); f.order.push([p[0], p[1] !== 'desc']); }); return; }
      if (k === 'limit') return;
      var m = /^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/.exec(v);
      if (!m || k === 'or' || k === 'and' || k === 'offset') { ok = false; return; }
      f.conds.push([k, m[1], m[2]]);
    });
    return ok ? f : null;
  }
  function remplit(l, c) {
    var v = l[c[0]], s = v == null ? null : String(v), x = c[2];
    switch (c[1]) {
      case 'eq': return s === x;
      case 'neq': return s !== x;
      case 'gt': return s != null && s > x;
      case 'gte': return s != null && s >= x;
      case 'lt': return s != null && s < x;
      case 'lte': return s != null && s <= x;
      case 'is': return x === 'null' ? v == null : s === x;
      case 'in': return x.replace(/^\(|\)$/g, '').split(',').map(function (y) { return y.replace(/^"|"$/g, ''); }).indexOf(s) >= 0;
    }
    return false;
  }
  function copieGardee(x) {
    var l = JSON.parse(JSON.stringify(x.ligne));
    if (!l.cree_le) l.cree_le = new Date(x.t).toISOString();
    l._attente = true;
    return l;
  }
  function projeter(l, sel) {
    if (!sel) return l;
    var o = { _attente: true }; sel.forEach(function (k) { o[k] = l[k]; }); return o;
  }
  function reponse(corps, statut) {
    return new Response(corps == null ? null : JSON.stringify(corps),
      { status: statut || 200, headers: { 'Content-Type': 'application/json' } });
  }
  function avecRdvGardes(url, r) {
    if (url.indexOf('/rest/v1/rdv?') < 0 || !r || !r.ok) return r;
    var f = lireFiltres(url); if (!f) return r;
    var g = HL.miennes('rdv').map(copieGardee).filter(function (l) { return f.conds.every(function (c) { return remplit(l, c); }); });
    if (!g.length) return r;
    return r.clone().json().then(function (data) {
      if (!Array.isArray(data)) return r;
      var vus = {}; data.forEach(function (d) { if (d && d.id) vus[d.id] = 1; });
      var plus = g.filter(function (l) { return !vus[l.id]; }).map(function (l) { return projeter(l, f.select); });
      if (!plus.length) return r;
      var tout = data.concat(plus);
      if (f.order.length) tout.sort(function (a, b) {
        for (var i = 0; i < f.order.length; i++) {
          var k = f.order[i][0], x = a[k] == null ? '' : String(a[k]), y = b[k] == null ? '' : String(b[k]);
          if (x !== y) return (x < y ? -1 : 1) * (f.order[i][1] ? 1 : -1);
        }
        return 0;
      });
      return new Response(JSON.stringify(tout), { status: r.status, statusText: r.statusText, headers: r.headers });
    }, function () { return r; });
  }
  // Lecture, modification ou suppression d'UN rendez-vous gardé (id=eq.<son id>) : servie ici.
  function surSaisie(url, methode, init) {
    var f = lireFiltres(url); if (!f) return null;
    var id = null; f.conds.forEach(function (c) { if (c[0] === 'id' && c[1] === 'eq') id = c[2]; });
    var x = id && HL.miennes('rdv').filter(function (y) { return y.ligne.id === id; })[0];
    if (!x) return null;
    var h = new Headers((init && init.headers) || {});
    var objet = /vnd\.pgrst\.object/.test(h.get('Accept') || ''), rendre = /return=representation/.test(h.get('Prefer') || '');
    if (methode === 'PATCH') {
      var p = {}; try { p = JSON.parse((init && init.body) || '{}') || {}; } catch (e) {}
      var a = lsLire(LS_ENVOIS);
      a.forEach(function (y) { if (y && y.table === 'rdv' && y.ligne && y.ligne.id === id) { Object.keys(p).forEach(function (k) { if (k !== 'id') y.ligne[k] = p[k]; }); x = y; } });
      lsEcrire(LS_ENVOIS, a);
    } else if (methode === 'DELETE') { retirer(x); afficher(); }
    else if (methode !== 'GET') return null;
    if (methode !== 'GET' && !rendre) return reponse(null, 204);
    var l = copieGardee(x);
    if (!f.conds.every(function (c) { return remplit(l, c); }))
      return objet ? reponse({ code: 'PGRST116', message: 'Aucune ligne' }, 406) : reponse([]);
    l = projeter(l, f.select);
    return reponse(objet ? l : [l]);
  }
  HL.sansReseau = function () { return coupe || navigator.onLine === false; };

  // ── 2. Ouverture sans réseau ──────────────────────────────────────
  // Coupure réseau, et non refus du serveur : seul cas où l'on ouvre sur le mémo.
  HL.coupure = function (e) {
    if (navigator.onLine === false) return true;
    if (!e) return false;
    try { if (window.supabase && window.supabase.isAuthRetryableFetchError && window.supabase.isAuthRetryableFetchError(e)) return true; } catch (x) {}
    return e.status === 0 || /failed to fetch|load failed|networkerror|network request/i.test(String(e.message || ''));
  };
  function sessionGardee() {
    try { for (var i = 0; i < localStorage.length; i++) if (/^sb-.+-auth-token$/.test(localStorage.key(i) || '')) return true; } catch (e) {}
    return false;
  }
  HL.memoriser = function (user) {
    if (!user || !user.id) return;
    // Appareil partagé : un AUTRE compte vient de se vérifier en ligne → les lectures rangées
    // pour le précédent ne doivent jamais lui être resservies sans réseau.
    var avant = null; try { avant = JSON.parse(localStorage.getItem(LS_MEMO) || 'null'); } catch (e) {}
    if (avant && avant.id && avant.id !== user.id) { try { caches.delete(CACHE); } catch (e) {} }
    try { localStorage.setItem(LS_MEMO, JSON.stringify({ t: Date.now(), id: user.id, email: user.email || '' })); } catch (e) {}
  };
  HL.oublier = function () { try { localStorage.removeItem(LS_MEMO); } catch (e) {} };
  // Rend { id, email } si l'on peut ouvrir sans réseau, sinon null.
  HL.ouvrirSansReseau = function () {
    var m = null; try { m = JSON.parse(localStorage.getItem(LS_MEMO) || 'null'); } catch (e) {}
    if (!m || !m.id || !sessionGardee()) return null;
    try { if (localStorage.getItem('v2-maintenance') === '1') return null; } catch (e) {}
    var age = Date.now() - m.t;
    coupe = true;
    if (!(age > -3600000 && age < TROIS_JOURS)) { tropVieux = true; afficher(); return null; }
    sansReseauDepuis = m.t; afficher();
    return { id: m.id, email: m.email };
  };

  // ── 3. Boîte d'envoi ──────────────────────────────────────────────
  // o = { table, ligne (avec son id), quoi (« Le rendez-vous du … »), geo? }
  HL.differer = function (o) {
    if (!o || !o.table || !o.ligne || !o.ligne.id) return false;
    var a = lsLire(LS_ENVOIS);
    o.t = Date.now(); o.uid = (V2.user && V2.user.id) || '';
    a.push(o);
    var ok = lsEcrire(LS_ENVOIS, a);
    afficher();
    return ok;
  };
  HL.enAttente = function (table) {
    return lsLire(LS_ENVOIS).filter(function (x) { return x && x.ligne && (!table || x.table === table); });
  };
  // Celles du compte connecté seulement : ce qu'on montre et ce qu'on compte à l'écran.
  HL.miennes = function (table) {
    var moi = V2.user && V2.user.id;
    return HL.enAttente(table).filter(function (x) { return !!moi && x.uid === moi; });
  };
  // Avant la déconnexion : dernier essai d'envoi ; s'il reste des saisies, on prévient AVANT
  // de les effacer de l'appareil (sinon elles y resteraient lisibles après la déconnexion).
  HL.avantDeconnexion = function () {
    return Promise.resolve(HL.envoyer()).then(function () {
      var n = HL.miennes().length, moi = V2.user && V2.user.id;
      if (n && !window.confirm(n + (n > 1 ? ' saisies faites hors ligne ne sont pas encore parties' : ' saisie faite hors ligne n’est pas encore partie') +
        '. Se déconnecter maintenant les efface de cet appareil.\n\nSe déconnecter quand même ?')) return false;
      // Les saisies refusées par le serveur ont été dites à l'écran : elles partent avec la session.
      function pasAMoi(x) { return !!x && !!x.uid && x.uid !== moi; }
      lsEcrire(LS_ENVOIS, lsLire(LS_ENVOIS).filter(pasAMoi));
      lsEcrire(LS_REFUS, lsLire(LS_REFUS).filter(pasAMoi));
      return true;
    }, function () { return true; });
  };
  function retirer(x) {
    lsEcrire(LS_ENVOIS, lsLire(LS_ENVOIS).filter(function (y) {
      return !(y && y.ligne && y.table === x.table && y.ligne.id === x.ligne.id);
    }));
  }
  function refuser(x, err) {
    var r = lsLire(LS_REFUS); x.motif = (err && (err.code || err.message)) || '';
    r.push(x);
    if (!lsEcrire(LS_REFUS, r)) return;   // pas de place : la saisie reste dans la boîte d'envoi
    retirer(x);
    if (V2.toast) V2.toast((x.quoi || 'Une saisie') + ' n’a pas pu être enregistré : ' + motif(x) +
      '. Il reste gardé sur cet appareil (bandeau en bas, « Voir »).', 'error');
  }
  function motif(x) {
    var m = String(x.motif || '');
    if (m === '23P01') return 'il chevauche un autre rendez-vous';
    if (m === '42501') return 'ce compte n’a pas le droit de l’enregistrer';
    return 'la base l’a refusé' + (m && m.length < 12 ? ' (code ' + m + ')' : '');
  }
  HL.mesRefus = function () {
    var moi = V2.user && V2.user.id;
    return lsLire(LS_REFUS).filter(function (x) { return !!moi && x && x.ligne && x.uid === moi; });
  };
  // Envoi déjà fait, réponse perdue en route ? La ligne porte son id : on regarde.
  function dejaLa(c, x) {
    return c.from(x.table).select('id').eq('id', x.ligne.id).then(function (r) {
      return !!(r && r.data && r.data.length);
    }, function () { return false; });
  }
  // Rendez-vous noté sans réseau : sa position n'a pas pu être retrouvée. On la cherche
  // avant l'envoi (même service que v2-rdv-ajout.js) — sans elle, le moteur de créneaux
  // ne sait pas placer ce rendez-vous dans la journée.
  function preparer(x) {
    var l = x.ligne;
    if (!x.geo || l.lat != null) return Promise.resolve(l);
    return fetch('https://data.geopf.fr/geocodage/search?limit=1&q=' + encodeURIComponent(x.geo))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var f = j && j.features && j.features[0];
        if (f && f.geometry) { l.lat = f.geometry.coordinates[1]; l.lon = f.geometry.coordinates[0]; }
        return l;
      }, function () { return l; });
  }
  var enCours = null;
  HL.envoyer = function () {
    if (enCours) return enCours;
    var c = V2.sb && V2.sb(), moi = V2.user && V2.user.id;
    if (!c || !moi || !HL.enAttente().length) return Promise.resolve(0);
    var partis = 0, refuses = 0, tables = {};
    function suivant() {
      // Saisies d'un autre compte sur le même appareil : elles attendent leur auteur.
      var x = HL.enAttente().filter(function (y) { return y.uid === moi; })[0];
      if (!x) return Promise.resolve();
      return preparer(x).then(function (ligne) { return c.from(x.table).insert(ligne); }).then(function (r) {
        // Réseau, session à renouveler ou serveur en panne : on s'arrête, on réessaiera.
        if (!r || r.status === 0 || r.status === 401 || r.status >= 500) return;
        if (!r.error || r.error.code === '23505') { retirer(x); partis++; tables[x.table] = 1; return suivant(); }
        return dejaLa(c, x).then(function (oui) {
          if (oui) { retirer(x); partis++; } else { refuser(x, r.error); refuses++; }
          tables[x.table] = 1;
          return suivant();
        });
      });
    }
    enCours = suivant().catch(function () {}).then(function () {
      enCours = null; afficher();
      if (partis && V2.toast) V2.toast(partis === 1 ? 'La saisie faite hors ligne est enregistrée'
                                                    : partis + ' saisies faites hors ligne sont enregistrées');
      if (partis || refuses) {
        try { window.dispatchEvent(new CustomEvent('v2-hl-envoye', { detail: { tables: Object.keys(tables) } })); } catch (e) {}
      }
      return partis;
    });
    return enCours;
  };
  function revenu() {
    HL.envoyer();
    // « Visité aujourd'hui » garde déjà ses visites sur l'appareil : son rechargement les remonte.
    try { if (V2.visite && V2.visite.load && V2.user) V2.visite.load(); } catch (e) {}
    // Ouvert sans réseau : le compte n'a pas été revérifié. On le fait maintenant.
    try { if (sansReseauDepuis && V2.verifierBlocage) V2.verifierBlocage(); } catch (e) {}
    afficher();
  }
  // ── Fichiers de l'app rangés pour la prochaine ouverture sans réseau ──
  // Le service worker ne range de lui-même que ce que demande une page qu'il pilote déjà :
  // on lui donne la liste de tout ce que cette page a lu (sw.js, message « ranger »).
  function rangerFichiers() {
    var sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw || HL.sansReseau()) return;
    var vu = {}, urls = [];
    function prendre(u) { if (u && u.indexOf(location.origin + '/') === 0 && !vu[u]) { vu[u] = 1; urls.push(u); } }
    Array.prototype.forEach.call(document.querySelectorAll('script[src],link[rel="stylesheet"][href],link[rel="manifest"][href]'),
      function (el) { prendre(el.src || el.href); });
    try { performance.getEntriesByType('resource').forEach(function (r) { prendre(r.name); }); } catch (e) {}
    try { sw.postMessage({ type: 'ranger', urls: urls }); } catch (e) {}
  }
  // Appelé après une vérification EN LIGNE du compte (v2-boot.js) : une fois les modules là.
  HL.rangerPlusTard = function () {
    Promise.resolve(V2.modulesPrets).then(function () { setTimeout(rangerFichiers, 15000); });
  };
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', function () { if (V2.user) setTimeout(rangerFichiers, 3000); });

  window.addEventListener('online', function () { HL.envoyer(); });
  window.addEventListener('offline', function () { etat(false); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) HL.envoyer();
    else if (V2.user) rangerFichiers();   // données lues depuis : rangées en quittant l'écran
  });
  setInterval(function () { if (HL.enAttente().length) HL.envoyer(); }, 30000);

  // ── 4. Bandeau ────────────────────────────────────────────────────
  function quand(t) {
    var d = new Date(t), m = d.getMinutes();
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' à ' + d.getHours() + ' h ' + (m < 10 ? '0' : '') + m;
  }
  function styles() {
    if (document.getElementById('v2-horsligne-css')) return;
    var s = document.createElement('style'); s.id = 'v2-horsligne-css';
    s.textContent =
      '#v2-horsligne{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));z-index:2147483000;' +
      'display:flex;align-items:center;gap:10px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:9px 14px;border-radius:999px;' +
      'background:#1E2A3B;color:#fff;font:600 13px/1.35 Inter,system-ui,-apple-system,sans-serif;box-shadow:0 6px 20px rgba(15,23,42,.28)}' +
      '#v2-horsligne .v2hl-pt{flex:none;width:8px;height:8px;border-radius:50%;background:#F5A524}' +
      '#v2-horsligne.v2hl-ok .v2hl-pt{background:#3BD07A}' +
      '#v2-horsligne button{flex:none;border:0;border-radius:999px;padding:7px 12px;min-height:32px;background:#fff;color:#1E2A3B;font:inherit;cursor:pointer}';
    document.head.appendChild(s);
  }
  function afficher() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', afficher); return; }
    var n = HL.miennes().length, sa = n > 1 ? ' saisies en attente' : ' saisie en attente';
    var txt = '', bouton = '';
    if (coupe && tropVieux) txt = 'Hors ligne depuis plus de 3 jours : retrouvez du réseau pour rouvrir JARVIS.';
    else if (coupe) txt = 'Hors ligne' + (sansReseauDepuis ? ' · données du ' + quand(sansReseauDepuis) : '') + (n ? ' · ' + n + sa : '');
    else if (rebranche) { txt = 'Réseau revenu' + (n ? ' · ' + n + sa : ''); bouton = 'Mettre à jour les données'; }
    else if (n) txt = n + sa + ' d’envoi';
    // Saisies refusées par le serveur : le bandeau reste tant qu'elles ne sont pas relues et effacées.
    var nr = HL.mesRefus().length, refus = nr + (nr > 1 ? ' saisies non enregistrées' : ' saisie non enregistrée');
    if (nr && !coupe) { txt = txt ? txt + ' · ' + refus : refus; bouton = 'Voir'; }
    var el = document.getElementById('v2-horsligne');
    if (!txt) { if (el) el.parentNode.removeChild(el); return; }
    styles();
    if (!el) { el = document.createElement('div'); el.id = 'v2-horsligne'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.className = coupe ? '' : 'v2hl-ok';
    el.innerHTML = '<span class="v2hl-pt"></span><span>' + txt + '</span>' +
      (bouton ? '<button type="button" onclick="' + (bouton === 'Voir' ? 'V2.hl.voirRefus()' : 'location.reload()') + '">' + bouton + '</button>' : '');
  }
  HL.afficher = afficher;

  // ── 5. Saisies refusées : les relire, copier le texte, effacer ─────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function texteDe(x) {
    var l = x.ligne;
    if (x.table !== 'rdv') return String(l.body || '');
    return [l.nom, l.date ? 'le ' + l.date.split('-').reverse().join('/') + (l.heure ? ' à ' + String(l.heure).slice(0, 5) : '') : '',
      l.duree_min ? l.duree_min + ' min' : '', l.contact_nom, l.contact_tel, l.message].filter(Boolean).join(' · ');
  }
  HL.voirRefus = function () {
    var a = HL.mesRefus(), el = document.getElementById('v2-hl-refus');
    if (!a.length) { if (el) el.parentNode.removeChild(el); afficher(); return; }
    if (!document.getElementById('v2-hl-refus-css')) {
      var s = document.createElement('style'); s.id = 'v2-hl-refus-css';
      s.textContent =
        '#v2-hl-refus{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.45)}' +
        '#v2-hl-refus .v2hr-f{width:100%;max-width:520px;max-height:85vh;overflow:auto;box-sizing:border-box;padding:20px 16px calc(20px + env(safe-area-inset-bottom));' +
        'border-radius:18px 18px 0 0;background:var(--card,#fff);color:var(--ip-ink,#0B1220);font:400 14px/1.45 Inter,system-ui,-apple-system,sans-serif;box-shadow:0 -10px 40px rgba(15,23,42,.25)}' +
        '@media(min-width:600px){#v2-hl-refus{align-items:center}#v2-hl-refus .v2hr-f{border-radius:18px}}' +
        '#v2-hl-refus h2{margin:0 0 4px;font-size:18px;font-weight:700}' +
        '#v2-hl-refus .v2hr-i{margin:0 0 14px;color:#475569}' +
        '#v2-hl-refus article{margin:0 0 12px;padding:12px 14px;border:1px solid #E2E8F0;border-radius:12px}' +
        '#v2-hl-refus .v2hr-q{font-weight:700}#v2-hl-refus .v2hr-m{margin:2px 0 8px;color:#B42318;font-size:13px}' +
        '#v2-hl-refus .v2hr-t{margin:0 0 10px;white-space:pre-wrap;word-break:break-word}' +
        '#v2-hl-refus .v2hr-b{display:flex;gap:8px;flex-wrap:wrap}' +
        '#v2-hl-refus button{min-height:44px;padding:0 16px;border-radius:10px;border:1px solid #CBD5E1;background:#fff;color:#0B1220;font:600 14px/1 Inter,system-ui,sans-serif;cursor:pointer}' +
        '#v2-hl-refus button.v2hr-p{background:#1E2A3B;border-color:#1E2A3B;color:#fff}';
      document.head.appendChild(s);
    }
    if (!el) {
      el = document.createElement('div'); el.id = 'v2-hl-refus';
      el.addEventListener('click', function (e) { if (e.target === el) el.parentNode.removeChild(el); });
      document.body.appendChild(el);
    }
    el.innerHTML = '<div class="v2hr-f" role="dialog" aria-modal="true" aria-labelledby="v2hr-h">' +
      '<h2 id="v2hr-h">Saisies non enregistrées</h2>' +
      '<p class="v2hr-i">Faites sans réseau, puis refusées par la base au retour du réseau. Elles ne sont que sur cet appareil : copiez le texte pour le saisir à nouveau, puis effacez-les.</p>' +
      a.map(function (x, i) {
        return '<article><div class="v2hr-q">' + esc(x.quoi || (x.table === 'rdv' ? 'Un rendez-vous' : 'Une note')) + '</div>' +
          '<div class="v2hr-m">Saisie le ' + esc(quand(x.t)) + ' · ' + esc(motif(x)) + '</div>' +
          '<p class="v2hr-t">' + esc(texteDe(x)) + '</p>' +
          '<div class="v2hr-b"><button type="button" class="v2hr-p" onclick="V2.hl.copierRefus(' + i + ')">Copier le texte</button>' +
          '<button type="button" onclick="V2.hl.effacerRefus(' + i + ')">Effacer</button></div></article>';
      }).join('') +
      '<div class="v2hr-b"><button type="button" onclick="var e=document.getElementById(\'v2-hl-refus\');e.parentNode.removeChild(e)">Fermer</button></div></div>';
  };
  HL.copierRefus = function (i) {
    var x = HL.mesRefus()[i]; if (!x) return;
    var t = texteDe(x);
    Promise.resolve().then(function () { return navigator.clipboard.writeText(t); })
      .then(function () { if (V2.toast) V2.toast('Texte copié'); },
            function () { window.prompt('Copiez le texte :', t); });
  };
  HL.effacerRefus = function (i) {
    var x = HL.mesRefus()[i]; if (!x) return;
    if (!window.confirm('Effacer de cet appareil « ' + (x.quoi || 'cette saisie') + ' » ? Elle n’est enregistrée nulle part ailleurs.')) return;
    var vise = x.table + '|' + x.ligne.id;
    lsEcrire(LS_REFUS, lsLire(LS_REFUS).filter(function (y) { return !(y && y.ligne && y.table + '|' + y.ligne.id === vise); }));
    HL.voirRefus(); afficher();
  };

  // Un RDV gardé vient de partir : l'écran Rendez-vous ou le planning ouvert perd son « en attente ».
  window.addEventListener('v2-hl-envoye', function (e) {
    if (!e.detail || !e.detail.tables || e.detail.tables.indexOf('rdv') < 0) return;
    try { if (V2.route && (V2.route.name === 'rdv' || V2.route.name === 'rdvplanning') && V2.render) V2.render(); } catch (x) {}
  });
})();

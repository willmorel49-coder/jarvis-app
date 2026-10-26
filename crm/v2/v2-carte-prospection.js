/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · LA CARTE — mode « Prospection » (26/10/2026) — réservé à Will
   Will : « un VRAI outil de prospection dans JARVIS, sur la carte, pour lui seul :
   ne prospecter que des pharmacies cohérentes avec les tournées de livraison ».

   - VERROU : la RPC EXISTANTE jarvis_acces_connexions() (crm/v2/_sql/connexions.sql : Will + compte de preuve). Aucune
     nouvelle fonction ni table en base (décision du 26/10 : pas de SQL). Le bouton n'existe que sur un « oui » ;
     une erreur de la base vaut « non », jamais « oui ».
   - DONNÉES DES TOURNÉES (tracés, clientes, positions) : PAS dans le dépôt (public). Elles vivent dans un fichier du seau
     privé `donnees-protegees`, à sa RACINE, nommé `connexions-jarvis-prospection.js`. CE NOM EST VOULU : la fonction de la base
     jarvis_peut_lire_protege() réserve tout objet `connexions-jarvis%` à jarvis_acces_connexions() (branche placée en tête,
     connexions.sql) ; un autre nom serait lisible par tout compte connecté. On le charge avec le chargeur de fichiers protégés
     de l'app (V2.loadFiles, clé « prospection » de v2-boot.js : adresse signée), SEULEMENT après le « oui » ci-dessus.
   - Prospects = officines de PHARMA_FR des 8 départements du secteur qui ne sont pas dans CLIENTS_ACTIFS
     (cliente de n'importe quel commercial). Distance au tracé le plus proche calculée ICI, dans le
     navigateur : projection plane locale, mêmes constantes que donnees.py (xy / d_seg / d_trace).
   - Couleurs du suivi = celles du mode « Suivi des prospects » de La carte (SUIVI_COL, v2-carte.js) :
     rouge ne pas y retourner > vert RDV à venir > gris déjà vue > bleu jamais vue.
   - « Mail envoyé » et « relance » : table `profils` existante (scope 'groupement', scope_id '__prospection_<id>__', même rangement
     que u2ScopeId() de v2-app.js). La relance crée aussi une
     ligne dans la To do existante (V2.todo.ajouterLigne). « Ne pas y retourner » = champ existant du Profil.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};
  var C = {};   // calcul pur (testé : tests/carte-prospection.test.mjs)

  // ── Géométrie : portage à l'identique de donnees.py (xy, d_pt, d_seg, d_trace) ──
  var LAT0 = 47.5 * Math.PI / 180;
  C.DEPTS = ['14', '35', '37', '44', '49', '50', '53', '72'];
  C.xy = function (lat, lng) { return [lng * 111.320 * Math.cos(LAT0), lat * 110.574]; };
  C.dPt = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  C.dSeg = function (p, a, b) {
    var vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy;
    var u = L === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L));
    return Math.hypot(p[0] - a[0] - u * vx, p[1] - a[1] - u * vy);
  };
  C.dTrace = function (p, tr) {
    if (tr.length < 2) return tr.length ? C.dPt(p, tr[0]) : Infinity;
    var m = Infinity;
    for (var i = 0; i < tr.length - 1; i++) { var d = C.dSeg(p, tr[i], tr[i + 1]); if (d < m) m = d; }
    return m;
  };
  // Tracés projetés une fois : { code: [[x,y]…] }
  C.projeter = function (tournees) {
    var out = {};
    Object.keys(tournees || {}).forEach(function (k) { out[k] = (tournees[k].trace || []).map(function (q) { return C.xy(q[0], q[1]); }); });
    return out;
  };
  // Tournée la plus proche d'un point et distance (km, 2 décimales comme `round(km, 2)` de donnees.py)
  C.plusProche = function (lat, lng, proj) {
    var p = C.xy(lat, lng), best = null, bk = Infinity;
    Object.keys(proj).forEach(function (k) { var d = C.dTrace(p, proj[k]); if (d < bk) { bk = d; best = k; } });
    return { code: best, km: Math.round(bk * 100) / 100 };
  };

  function cleCip(v) { return String(v == null ? '' : v).replace(/[^0-9A-Za-z_-]/g, ''); }
  C.cleCip = cleCip;
  function deptDe(cp) { cp = String(cp || '').replace(/\s/g, ''); return cp.length < 2 ? '' : (/^97/.test(cp) ? cp.slice(0, 3) : cp.slice(0, 2)); }
  function posOk(p) { return isFinite(p[0]) && isFinite(p[1]) && (p[0] !== 0 || p[1] !== 0); }

  // Prospects : PHARMA_FR (8 départements) moins CLIENTS_ACTIFS. `pts` = D.p, `actifs` = CLIENTS_ACTIFS.d (objet clé CIP).
  // Rend { liste (triée par distance), sansPosition }. Une officine sans coordonnées valides n'est pas comptée :
  // elle est dite à part (jamais « à 0 km »).
  C.prospects = function (pts, actifs, proj) {
    var liste = [], sansPosition = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], cip = cleCip(p[13]);
      if (!cip || C.DEPTS.indexOf(deptDe(p[8])) < 0) continue;
      if (Object.prototype.hasOwnProperty.call(actifs, cip)) continue;
      if (!posOk(p)) { sansPosition++; continue; }
      var r = C.plusProche(p[0], p[1], proj);
      liste.push({ i: i, cip: cip, nom: p[6] || '', ville: p[7] || '', cp: String(p[8] || ''), lat: p[0], lng: p[1], km: r.km, tournee: r.code });
    }
    liste.sort(function (a, b) { return a.km - b.km || (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0); });
    return { liste: liste, sansPosition: sansPosition };
  };
  C.dans = function (liste, rayon) { var n = 0; while (n < liste.length && liste[n].km <= rayon) n++; return n; };   // liste triée : nombre de prospects à ≤ rayon km

  // Couleur du suivi : MÊME priorité que suiviEtat() de v2-carte.js. S = { pret, rouge, rdv, vu (fonction cip → date | null) }.
  C.etat = function (cip, S) {
    if (!S || !S.pret) return 'attente';
    if (S.rouge && S.rouge[cip]) return 'rouge';
    if (S.rdv && S.rdv[cip]) return 'vert';
    if (S.vu && S.vu(cip)) return 'gris';
    return 'bleu';
  };

  // Dates (jour local, jamais UTC : « aujourd'hui » à 00 h 30 ne doit pas rendre hier)
  C.isoOk = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); };
  C.aujourdhui = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  };
  C.fr = function (iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
  var JOURS3 = { lundi: 'lun', mardi: 'mar', mercredi: 'mer', jeudi: 'jeu', vendredi: 'ven', samedi: 'sam', dimanche: 'dim' };
  C.jours = function (j) { return (j || []).map(function (x) { return JOURS3[x] || x; }).join(', '); };
  C.kmFr = function (km) { return (Math.round(km * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };

  // ───────────────────────────────────────────────────────────────
  // État + accès (verrou) — sans DOM, testé
  // ───────────────────────────────────────────────────────────────
  var S = {
    ok: null,            // null = pas encore su · true / false = réponse de la base
    verif: null,         // promesse de la vérification (une seule par session de page)
    actif: false, charge: false, erreur: '', manque: [],
    donnees: null, proj: null, prospects: [], sansPosition: 0,
    rayon: 10, choisi: '', affiches: 60,
    suiviCouleur: { pret: false }, prive: {}, priveOk: false
  };
  var COUL_TOURNEE = ['#7C3AED', '#EA580C', '#0891B2', '#DB2777', '#A16207', '#334155'];
  var RAYON_MAX = 50;

  function sb() { return (V2.sb && V2.sb()) || null; }
  C.etatInterne = S;

  // Le bouton n'existe que si la base répond OUI. Erreur, délai, pas de session : NON.
  C.verifier = function (force) {
    if (S.verif && !force) return S.verif;
    var c = sb();
    if (!c || !c.rpc || !V2.user) { S.ok = false; return Promise.resolve(false); }
    S.verif = Promise.resolve(c.rpc('jarvis_acces_connexions')).then(function (r) {
      S.ok = !!(r && !r.error && r.data === true);
      return S.ok;
    }, function () { S.ok = false; return false; });
    return S.verif;
  };
  C.ok = function () { return S.ok === true; };
  C.actif = function () { return S.actif && S.ok === true; };

  // Les tracés ne sont demandés qu'après un « oui ». Rend le jeu de données ou lève.
  C.demanderDonnees = function () {
    if (S.ok !== true) return Promise.reject(new Error('accès non accordé'));
    if (!V2.loadFiles) return Promise.reject(new Error('chargeur de fichiers protégés absent'));
    return Promise.resolve(V2.loadFiles(['prospection'])).then(function () {
      var d = glob.PROSPECTION_TOURNEES;
      if (!d || !d.tournees) throw new Error('fichier des tournées non reçu');
      return d;
    });
  };

  // Suivi (mail envoyé, relance) : UNE ligne `profils` par utilisateur, même rangement que u2ScopeId() (v2-app.js) :
  // scope_type 'groupement' (la base n'accepte que des types existants) + un scope_id qu'aucun groupement ne porte.
  // data = { s: { cip: { m: 'AAAA-MM-JJ', r: 'AAAA-MM-JJ' } } }.
  function scopeSuivi() { return '__prospection_' + ((V2.user && V2.user.id) || 'local') + '__'; }
  function versSuivi(data) {
    var out = {}, s = (data && data.s) || {};
    Object.keys(s).forEach(function (k) { out[k] = { mail: (s[k] && s[k].m) || '', relance: (s[k] && s[k].r) || '' }; });
    return out;
  }
  // Rend { cip: { mail, relance } } ; null si la lecture a raté (jamais « rien à signaler »).
  C.lireSuiviPrive = function () {
    var c = sb();
    if (!c || !V2.user) return Promise.resolve(null);
    return Promise.resolve(c.from('profils').select('data').eq('scope_type', 'groupement').eq('scope_id', scopeSuivi()).maybeSingle())
      .then(function (r) { return (!r || r.error) ? null : versSuivi(r.data && r.data.data); }, function () { return null; });
  };
  // Écrit UNE valeur : la ligne est relue juste avant (le Mac et l'iPhone ne s'écrasent pas), puis réécrite. Jamais de DELETE : '' = effacé.
  C.ecrireSuiviPrive = function (cip, colonne, valeur) {
    var c = sb();
    if (!c || !V2.user) return Promise.resolve(false);
    var champ = colonne === 'mail_envoye_le' ? 'm' : colonne === 'relance_le' ? 'r' : '';
    if (!champ) return Promise.resolve(false);
    return Promise.resolve(c.from('profils').select('data').eq('scope_type', 'groupement').eq('scope_id', scopeSuivi()).maybeSingle()).then(function (r) {
      if (!r || r.error) return false;
      var data = (r.data && r.data.data) || {}, s = data.s || {};
      var e = s[cip] || {};
      if (valeur) e[champ] = valeur; else delete e[champ];
      if (e.m || e.r) s[cip] = e; else delete s[cip];
      return Promise.resolve(c.from('profils').upsert({ scope_type: 'groupement', scope_id: scopeSuivi(), data: { s: s }, updated_by: V2.user.id,
        updated_by_name: V2.user.name || '', updated_at: new Date().toISOString() }, { onConflict: 'scope_type,scope_id' })).then(function (u) { return !!(u && !u.error); });
    }, function () { return false; });
  };

  // Chargement complet (sans DOM). Rend S. Une source qui échoue est NOTÉE dans S.manque : jamais lue comme « rien ».
  C.charger = function () {
    S.manque = [];
    var pDon = C.demanderDonnees();
    var pAct = (V2.loadFiles ? Promise.resolve(V2.loadFiles(['clientsactifs'])) : Promise.resolve()).then(function () { return !!(glob.CLIENTS_ACTIFS && glob.CLIENTS_ACTIFS.d); }, function () { return false; });
    var pVu = V2.rdvVuCharger ? Promise.resolve(V2.rdvVuCharger()).catch(function () { return false; }) : Promise.resolve(false);
    var pRdv = V2.rdvProchainsCharger ? Promise.resolve(V2.rdvProchainsCharger()).catch(function () { return null; }) : Promise.resolve(null);
    var pRouge = (V2.profil && V2.profil.nePasRetourner) ? Promise.resolve(V2.profil.nePasRetourner()).catch(function () { return null; }) : Promise.resolve(null);
    var pPriv = C.lireSuiviPrive();
    return Promise.all([pDon, pAct, pVu, pRdv, pRouge, pPriv]).then(function (r) {
      S.donnees = r[0]; S.proj = C.projeter(S.donnees.tournees);
      if (!r[1]) throw new Error('clients actifs non lus : le compte des prospects serait faux');
      if (r[2] !== true) S.manque.push('visites');
      if (!r[3]) S.manque.push('rendez-vous');
      if (!r[4]) S.manque.push('« ne pas y retourner »');
      S.suiviCouleur = { pret: true, rdv: r[3], rouge: r[4], vu: function (k) { return V2.rdvVuLe ? V2.rdvVuLe(k) : null; } };
      S.prive = r[5] || {}; S.priveOk = !!r[5];
      if (!S.priveOk) S.manque.push('mails envoyés et relances');
      var D = glob.PHARMA_FR;
      if (!D || !D.p) throw new Error('base des officines non chargée');
      var res = C.prospects(D.p, glob.CLIENTS_ACTIFS.d, S.proj);
      S.prospects = res.liste; S.sansPosition = res.sansPosition;
      return S;
    });
  };

  // Bouton du menu de La carte (barre d'actions) — vide tant que la base n'a pas dit OUI
  C.bouton = function () {
    if (S.ok !== true) return '';
    return '<button class="cn-fb-btn cn-fb-act cn-pp-btn" onclick="V2.carteProspection.basculer()" aria-label="Mode Prospection"><span>Prospection</span></button>';
  };

  // Un « oui » ne s'invente pas : tout le reste de ce fichier (écran) n'existe que dans un navigateur.
  if (typeof document === 'undefined') {
    V2.carteProspection = C;
    if (typeof module !== 'undefined' && module.exports) module.exports = C;
    return;
  }

  // ───────────────────────────────────────────────────────────────
  // ÉCRAN
  // ───────────────────────────────────────────────────────────────
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var I = null;                   // accès au dedans de v2-carte.js (V2.carteInterne)
  var calques = null;             // { traces, clientes, prospects: L.layerGroup, anneaux }
  var marqueurs = {};             // cip → circleMarker
  var anneaux = {};               // cip → anneau « relance »
  var _tmr = null;

  function interne() { I = (V2.carteInterne && V2.carteInterne()) || null; return I; }
  function couleur(code) { var k = Object.keys(S.donnees.tournees).sort().indexOf(code); return COUL_TOURNEE[(k < 0 ? 0 : k) % COUL_TOURNEE.length]; }
  function etatDe(cip) { return C.etat(cip, S.suiviCouleur); }
  function couleurEtat(cip) { var e = etatDe(cip); return (I && I.SUIVI_COL) ? I.SUIVI_COL[e] : '#8B93A3'; }
  function tourneeLbl(code) { var t = S.donnees && S.donnees.tournees[code]; return t ? t.code + ' · ' + t.nom + (t.jours && t.jours.length ? ' · ' + C.jours(t.jours) : '') : ''; }

  C.basculer = function () { if (S.actif) C.quitter(); else C.ouvrir(); };

  C.ouvrir = function () {
    if (S.ok !== true || !interne()) return Promise.resolve(null);
    S.actif = true; S.charge = false; S.erreur = '';
    I.mode(true); poserRail();
    return C.charger().then(function () {
      if (!S.actif) return;
      S.charge = true; dessiner(); majTout(); cadrer();
    }, function (e) {
      if (!S.actif) return;
      S.erreur = (e && e.message) || 'lecture impossible';
      majTout();
    });
  };
  C.quitter = function () {
    S.actif = false; S.choisi = '';
    retirerCalques();
    var r = document.getElementById('pp-rail'); if (r) r.innerHTML = '';
    if (interne()) I.mode(false);
  };
  // Appelé au début de chaque rendu de La carte : la carte est neuve, le mode repart éteint.
  // garder = redessin différé de la même page en mode Prospection (v2-carte.js) : on note la vue et le prospect choisi
  // sur la carte qui va disparaître, et reprendre() rouvre le mode sur la carte neuve.
  C.reset = function (garder) {
    S.reprise = null;
    if (garder && S.actif && I && I.map) { try { S.reprise = { c: I.map.getCenter(), z: I.map.getZoom(), choisi: S.choisi }; } catch (e) { S.reprise = null; } }
    S.actif = false; S.choisi = ''; calques = null; marqueurs = {}; anneaux = {};
  };
  C.reprendre = function () {
    var r = S.reprise; S.reprise = null;
    if (!r || S.ok !== true || !interne()) return Promise.resolve(null);
    S.actif = true; S.charge = false; S.erreur = '';
    I.mode(true); poserRail();
    return C.charger().then(function () {
      if (!S.actif) return;
      S.charge = true; dessiner(); majTout();
      I.map.setView(r.c, r.z, { animate: false });
      if (r.choisi) C.choisir(r.choisi, true);   // rouvre la fiche (données déjà chargées : aucun nouveau redessin)
    }, function (e) {
      if (!S.actif) return;
      S.erreur = (e && e.message) || 'lecture impossible';
      majTout();
    });
  };
  C.ficheFermee = function () { var sh = document.querySelector('.cn-shell'); if (sh) sh.classList.remove('cn-fiche-on'); };

  function retirerCalques() {
    if (!calques || !I || !I.map) { calques = null; return; }
    ['traces', 'clientes', 'prospects', 'anneaux', 'depot'].forEach(function (k) { if (calques[k]) { try { I.map.removeLayer(calques[k]); } catch (e) {} } });
    calques = null; marqueurs = {}; anneaux = {};
  }

  function poserRail() {
    var r = document.getElementById('pp-rail');
    if (r && !S.charge) r.innerHTML = '<div class="pp-etat">' + (S.erreur ? '<b>Prospection indisponible</b><span>' + esc(S.erreur) + '</span><button class="v2-btn v2-btn-ghost" onclick="V2.carteProspection.ouvrir()">Réessayer</button>' : '<div class="v2-spinner"></div><span>Chargement des tournées…</span>') + '</div>';
  }

  // ── Calques de la carte ──
  function dessiner() {
    if (!interne() || !I.map || !window.L) return;
    var L = window.L, map = I.map;
    retirerCalques();
    calques = { traces: L.layerGroup(), clientes: L.layerGroup(), prospects: L.layerGroup(), anneaux: L.layerGroup(), depot: L.layerGroup() };
    var T = S.donnees.tournees;
    Object.keys(T).sort().forEach(function (k) {
      var col = couleur(k), tr = T[k].trace || [];
      if (tr.length > 1) {
        var pl = L.polyline(tr, { color: col, weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round', renderer: I.canvas, interactive: false });
        calques.traces.addLayer(pl);
      }
    });
    (S.donnees.clientes || []).forEach(function (c) {
      if (!isFinite(c.lat) || !isFinite(c.lng) || c.hors_secteur || !c.tournee) return;
      var col = couleur(c.tournee);
      var m = L.circleMarker([c.lat, c.lng], { renderer: I.canvas, radius: 7.5, color: col, weight: 3, fillColor: '#FFFFFF', fillOpacity: 1, dashArray: c.tournee_supposee ? '3 3' : null });
      m.bindTooltip('<b>' + esc(c.nom) + '</b><span>' + esc(c.ville || '') + (c.cp ? ' · ' + esc(c.cp) : '') + '</span><em>Cliente · ' + esc(tourneeLbl(c.tournee)) + (c.tournee_supposee ? ' (tournée supposée)' : '') + '</em>', { direction: 'top', offset: [0, -6], className: 'cn-tip' });
      m.on('click', function () { var i = indexDe(c.id); if (i >= 0 && V2.carteFiche) V2.carteFiche(i); });
      calques.clientes.addLayer(m);
    });
    var d = S.donnees.depot;
    if (d && isFinite(d.lat)) {
      var ic = L.divIcon({ className: 'pp-depot-w', html: '<div class="pp-depot">Dépôt</div>', iconSize: [64, 24], iconAnchor: [32, 12] });
      var dm = L.marker([d.lat, d.lng], { icon: ic, keyboard: false, interactive: true });
      dm.bindTooltip('<b>' + esc(d.nom || 'Dépôt') + '</b><span>' + esc(d.ville || '') + '</span>', { direction: 'top', offset: [0, -10], className: 'cn-tip' });
      calques.depot.addLayer(dm);
    }
    S.prospects.forEach(function (p) {
      if (p.km > RAYON_MAX) return;
      var m = L.circleMarker([p.lat, p.lng], styleProspect(p));
      m._cip = p.cip;
      m.bindTooltip('<b>' + esc(p.nom || 'Pharmacie') + '</b><span>' + esc(p.ville) + (p.cp ? ' · ' + esc(p.cp) : '') + '</span><em>' + C.kmFr(p.km) + ' km du trajet · ' + esc(tourneeLbl(p.tournee)) + '</em>', { direction: 'top', offset: [0, -6], className: 'cn-tip' });
      m.on('click', function () { C.choisir(p.cip, true); });
      marqueurs[p.cip] = m;
    });
    [calques.traces, calques.clientes, calques.depot, calques.prospects, calques.anneaux].forEach(function (g) { g.addTo(map); });
    appliquerRayon();
  }
  function styleProspect(p) {
    var pr = S.prive[p.cip] || {}, sel = S.choisi === p.cip;
    return { renderer: I.canvas, radius: sel ? 9 : 6, color: sel ? '#10131C' : (pr.mail ? '#10131C' : '#FFFFFF'), weight: sel ? 3 : (pr.mail ? 2.5 : 1), fillColor: couleurEtat(p.cip), fillOpacity: 0.95 };
  }
  // Ajoute/retire les points selon le curseur (liste triée : un seul parcours)
  function appliquerRayon() {
    if (!calques) return;
    var n = C.dans(S.prospects, S.rayon);
    S.prospects.forEach(function (p, k) {
      var m = marqueurs[p.cip]; if (!m) return;
      var on = k < n, dedans = calques.prospects.hasLayer(m);
      if (on && !dedans) calques.prospects.addLayer(m); else if (!on && dedans) calques.prospects.removeLayer(m);
      var pr = S.prive[p.cip] || {}, ring = anneaux[p.cip];
      if (on && pr.relance) {
        if (!ring) { ring = anneaux[p.cip] = window.L.circleMarker([p.lat, p.lng], { renderer: I.canvas, radius: 11, color: '#F59E0B', weight: 3, fill: false, interactive: false }); }
        if (!calques.anneaux.hasLayer(ring)) calques.anneaux.addLayer(ring);
      } else if (ring && calques.anneaux.hasLayer(ring)) calques.anneaux.removeLayer(ring);
    });
  }
  function restyler(cip) {
    var p = pChercher(cip), m = marqueurs[cip];
    if (p && m) m.setStyle(styleProspect(p));
    appliquerRayon();
  }
  function pChercher(cip) { for (var i = 0; i < S.prospects.length; i++) if (S.prospects[i].cip === cip) return S.prospects[i]; return null; }
  function indexDe(cip) { var D = glob.PHARMA_FR; if (!D) return -1; cip = String(cip); for (var i = 0; i < D.p.length; i++) if (String(D.p[i][13]) === cip) return i; return -1; }
  function cadrer() {
    if (!I || !I.map) return;
    var pts = [], d = S.donnees.depot;
    if (d && isFinite(d.lat)) pts.push([d.lat, d.lng]);
    Object.keys(S.donnees.tournees).forEach(function (k) { (S.donnees.tournees[k].trace || []).forEach(function (q) { pts.push(q); }); });
    if (pts.length > 1) { try { I.map.fitBounds(pts, { padding: [30, 30] }); } catch (e) {} }
  }

  // ── Barre du haut (curseur) : appelée par renderFbRow() de v2-carte.js quand le mode est actif ──
  C.barre = function () {
    var row = document.getElementById('cn-fbrow'); if (!row) return;
    var n = S.charge ? C.dans(S.prospects, S.rayon) : 0;
    row.innerHTML =
      '<label class="pp-curs" for="pp-rayon"><span class="pp-curs-t">Distance au trajet</span>' +
        '<input id="pp-rayon" type="range" min="1" max="' + RAYON_MAX + '" step="1" value="' + S.rayon + '" oninput="V2.carteProspection.rayon(this.value)" aria-valuetext="' + S.rayon + ' kilomètres"' + (S.charge ? '' : ' disabled') + '>' +
        '<b class="pp-curs-v" id="pp-rayon-v">' + S.rayon + ' km</b></label>' +
      '<span class="pp-n" id="pp-n" role="status" aria-live="polite">' + (S.charge ? '<b>' + n.toLocaleString('fr-FR') + '</b> prospect' + (n > 1 ? 's' : '') + ' à moins de ' + S.rayon + ' km' : (S.erreur ? 'Non chargé' : 'Chargement…')) + '</span>';
    var row2 = document.getElementById('cn-fbrow2'); if (row2) { row2.style.display = 'none'; row2.innerHTML = ''; }
    var chips = document.getElementById('cn-fbchips'); if (chips) chips.innerHTML = '';
    var acts = document.getElementById('cn-fbacts');
    if (acts) acts.innerHTML = '<button class="cn-fb-btn cn-fb-act cn-pp-btn on" onclick="V2.carteProspection.quitter()" aria-label="Quitter le mode Prospection"><span>Quitter la prospection</span></button>';
    var cnt = document.getElementById('cn-fbcount'); if (cnt) cnt.textContent = '';   // le compte est déjà dit par la ligne du curseur
  };

  C.rayon = function (v) {
    var r = Math.max(1, Math.min(RAYON_MAX, parseInt(v, 10) || 10));
    S.rayon = r; S.affiches = 60;
    var lb = document.getElementById('pp-rayon-v'); if (lb) lb.textContent = r + ' km';
    if (_tmr) clearTimeout(_tmr);
    _tmr = setTimeout(function () { appliquerRayon(); majNombre(); majListe(); }, 90);
  };
  function majNombre() {
    var n = C.dans(S.prospects, S.rayon), el = document.getElementById('pp-n');
    if (el) el.innerHTML = '<b>' + n.toLocaleString('fr-FR') + '</b> prospect' + (n > 1 ? 's' : '') + ' à moins de ' + S.rayon + ' km';
    var inp = document.getElementById('pp-rayon'); if (inp) inp.setAttribute('aria-valuetext', S.rayon + ' kilomètres');
  }

  // ── Panneau latéral : légende + liste ──
  function legendeHtml() {
    var T = S.donnees.tournees, k = Object.keys(T).sort(), SC = (I && I.SUIVI_COL) || {};
    var lg = function (c, t) { return '<span class="pp-lg"><i style="background:' + c + '"></i>' + esc(t) + '</span>'; };
    var h = '<div class="pp-leg"><div class="pp-leg-t">Tournées</div>' + k.map(function (code) {
      return '<span class="pp-lg pp-lg-t"><i class="pp-trait" style="background:' + couleur(code) + '"></i>' + esc(tourneeLbl(code)) + '</span>';
    }).join('') +
    '<div class="pp-leg-t">Prospects</div>' +
      lg(SC.rouge, 'Ne pas y retourner') + lg(SC.vert, 'Rendez-vous à venir') + lg(SC.gris, 'Déjà vue') + lg(SC.bleu, 'Jamais vue') +
    '<span class="pp-lg"><i class="pp-ring-m"></i>Contour foncé : mail envoyé</span>' +
    '<span class="pp-lg"><i class="pp-ring-r"></i>Anneau orange : relance à faire</span>' +
    '<span class="pp-lg"><i class="pp-cli"></i>Cliente (contour de la tournée ; pointillé : tournée supposée)</span>';
    if (S.manque.length) h += '<span class="pp-lg pp-lg-m">Non lu : ' + esc(S.manque.join(', ')) + '. Ces couleurs ou suivis peuvent être incomplets ; rouvrir la prospection pour réessayer.</span>';
    if (S.sansPosition) h += '<span class="pp-lg pp-lg-n">' + S.sansPosition + ' officine' + (S.sansPosition > 1 ? 's' : '') + ' du secteur sans position, non comptée' + (S.sansPosition > 1 ? 's' : '') + '.</span>';
    return h + '</div>';
  }
  function puces(p) {
    var e = etatDe(p.cip), S2 = S.suiviCouleur, pr = S.prive[p.cip] || {}, out = [];
    if (e === 'rouge') out.push('<span class="pp-pu pp-rouge">Ne pas y retourner</span>');
    else if (e === 'vert') out.push('<span class="pp-pu pp-vert">RDV le ' + esc(C.fr(S2.rdv[p.cip])) + '</span>');
    else if (e === 'gris') out.push('<span class="pp-pu pp-gris">Déjà vue le ' + esc(C.fr(S2.vu(p.cip))) + '</span>');
    else if (e === 'bleu') out.push('<span class="pp-pu pp-bleu">Jamais vue</span>');
    else out.push('<span class="pp-pu pp-gris">Suivi non lu</span>');
    if (pr.mail) out.push('<span class="pp-pu pp-mail">Mail envoyé le ' + esc(C.fr(pr.mail)) + '</span>');
    if (pr.relance) out.push('<span class="pp-pu pp-rel">Relance le ' + esc(C.fr(pr.relance)) + '</span>');
    return out.join('');
  }
  function detailHtml(p) {
    var pr = S.prive[p.cip] || {}, e = etatDe(p.cip), id = p.cip, aj = C.aujourdhui();
    var off = S.priveOk ? '' : ' disabled';
    var rdv = '';
    if (e === 'vert') rdv = '<div class="pp-l">Rendez-vous pris le <b>' + esc(C.fr(S.suiviCouleur.rdv[id])) + '</b></div>';
    else if (e === 'gris') rdv = '<div class="pp-l">Déjà vue le <b>' + esc(C.fr(S.suiviCouleur.vu(id))) + '</b></div>';
    else if (e === 'bleu') rdv = '<div class="pp-l">Aucun rendez-vous ni visite enregistrés.</div>';
    return '<div class="pp-det" onclick="event.stopPropagation()">' +
      (S.priveOk ? '' : '<div class="pp-warn">Suivi non lu : mail envoyé et relance indisponibles pour l\'instant.</div>') +
      '<div class="pp-blk"><div class="pp-bt">Mail envoyé</div>' +
        '<div class="pp-ligne"><input type="date" id="pp-mail-' + id + '" value="' + esc(pr.mail || aj) + '" aria-label="Date d\'envoi du mail"' + off + '>' +
        '<button class="v2-btn v2-btn-primary" onclick="V2.carteProspection.mail(\'' + id + '\')"' + off + '>Enregistrer</button>' +
        (pr.mail ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteProspection.mailEffacer(\'' + id + '\')"' + off + '>Effacer</button>' : '') + '</div></div>' +
      '<div class="pp-blk"><div class="pp-bt">Relance à faire</div>' +
        '<div class="pp-ligne"><input type="date" id="pp-rel-' + id + '" value="' + esc(pr.relance || '') + '" aria-label="Date de la relance"' + off + '>' +
        '<button class="v2-btn v2-btn-primary" onclick="V2.carteProspection.relance(\'' + id + '\')"' + off + '>Ajouter à la to do</button>' +
        (pr.relance ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteProspection.relanceEffacer(\'' + id + '\')"' + off + '>Effacer</button>' : '') + '</div>' +
        '<div class="pp-aide">Crée une ligne dans votre To do, à cette date.</div></div>' +
      '<div class="pp-blk"><div class="pp-bt">Rendez-vous</div>' + rdv +
        '<div class="pp-ligne"><button class="v2-btn v2-btn-ghost" onclick="V2.carteProspection.rdv(\'' + id + '\')">Proposer un rendez-vous</button></div></div>' +
      '<div class="pp-blk"><label class="pp-nr"><input type="checkbox" id="pp-nr-' + id + '"' + (e === 'rouge' ? ' checked' : '') + ' onchange="V2.carteProspection.nePasRetourner(\'' + id + '\',this.checked)"><span>Ne pas y retourner <small>(partagé avec l\'équipe)</small></span></label></div>' +
    '</div>';
  }
  function rangee(p) {
    var sel = S.choisi === p.cip;
    return '<div class="pp-row' + (sel ? ' sel' : '') + '" id="pp-r-' + p.cip + '">' +
      '<button type="button" class="pp-main" onclick="V2.carteProspection.choisir(\'' + p.cip + '\')" aria-expanded="' + (sel ? 'true' : 'false') + '">' +
        '<i class="pp-dot" style="background:' + couleurEtat(p.cip) + '"></i>' +
        '<span class="pp-nom">' + esc(p.nom || 'Pharmacie') + '</span>' +
        '<span class="pp-sub">' + esc(p.ville) + ' · <b>' + C.kmFr(p.km) + ' km</b> · ' + esc(tourneeLbl(p.tournee)) + '</span>' +
        '<span class="pp-pus">' + puces(p) + '</span>' +
      '</button>' + (sel ? detailHtml(p) : '') + '</div>';
  }
  function listeHtml() {
    var n = C.dans(S.prospects, S.rayon), vus = Math.min(n, S.affiches);
    if (!n) return '<div class="pp-vide">Aucun prospect à moins de ' + S.rayon + ' km du trajet. Élargir le curseur.</div>';
    var h = '';
    for (var k = 0; k < vus; k++) h += rangee(S.prospects[k]);
    if (S.choisi) {   // la ligne ouverte reste à l'écran même au-delà de la tranche affichée
      var kk = -1; for (var j = 0; j < n; j++) if (S.prospects[j].cip === S.choisi) { kk = j; break; }
      if (kk >= vus) h += rangee(S.prospects[kk]);
    }
    if (n > vus) h += '<button class="v2-btn v2-btn-ghost pp-plus" onclick="V2.carteProspection.plus()">Afficher plus (' + (n - vus).toLocaleString('fr-FR') + ' restants)</button>';
    return h;
  }
  function majListe() { var l = document.getElementById('pp-liste'); if (l) l.innerHTML = listeHtml(); }
  function majTout() {
    var r = document.getElementById('pp-rail');
    if (r) {
      if (!S.charge) poserRail();
      else r.innerHTML = '<div class="pp-tete"><b>Prospection</b><span>Officines du secteur qui ne sont clientes de personne, de la plus proche du trajet à la plus éloignée.</span><span class="pp-note">Trajet approché, d\'une cliente à la suivante.</span></div>' +
        '<div class="pp-scroll" id="pp-scroll"><details class="pp-legd"' + (window.matchMedia && window.matchMedia('(max-width:760px)').matches ? '' : ' open') + '><summary>Légende</summary>' + legendeHtml() + '</details>' +
        '<div class="pp-liste" id="pp-liste">' + listeHtml() + '</div></div>';
    }
    C.barre();
  }
  C.plus = function () { S.affiches += 60; majListe(); };

  C.choisir = function (cip, depuisCarte) {
    cip = cleCip(cip);
    var p = pChercher(cip); if (!p || !I) return;
    var ancien = S.choisi;
    S.choisi = (S.choisi === cip && !depuisCarte) ? '' : cip;
    if (ancien && marqueurs[ancien]) restyler(ancien);
    if (S.choisi) {
      restyler(cip);
      if (marqueurs[cip] && marqueurs[cip].bringToFront) marqueurs[cip].bringToFront();
      I.map.setView([p.lat, p.lng], Math.max(I.map.getZoom(), 12), { animate: true });
      if (V2.carteFiche) {
        var sh = document.querySelector('.cn-shell');
        if (sh && window.matchMedia && window.matchMedia('(max-width:760px)').matches) sh.classList.add('cn-fiche-on');
        setTimeout(function () { if (I.map) I.map.invalidateSize(); }, 30);
        V2.carteFiche(p.i);
      }
    } else if (V2.carteFicheClose) V2.carteFicheClose();
    // le tiroir de la fiche, sur téléphone, recouvre le panneau : on rend la liste dans tous les cas
    majListe();
    var row = document.getElementById('pp-r-' + cip);
    if (row && row.scrollIntoView && S.choisi && !depuisCarte) { try { row.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
    if (depuisCarte && row && row.scrollIntoView) { try { row.scrollIntoView({ block: 'center' }); } catch (e) {} }
  };

  // ── Gestes de suivi ──
  function nomDe(cip) { var p = pChercher(cip); return p ? p.nom : ''; }
  function apres(cip) { restyler(cip); majListe(); }
  function poser(cip, colonne, valeur, ok, ko) {
    var cle = colonne === 'mail_envoye_le' ? 'mail' : 'relance';
    return C.ecrireSuiviPrive(cip, colonne, valeur).then(function (bon) {
      if (!bon) { if (V2.toast) V2.toast('Non enregistré : la base n\'a pas répondu', 'warn'); return false; }
      S.prive[cip] = S.prive[cip] || { mail: '', relance: '' };
      S.prive[cip][cle] = valeur || '';
      apres(cip);
      if (V2.toast && ok) V2.toast(ok);
      return true;
    });
  }
  C.mail = function (cip) {
    cip = cleCip(cip); var el = document.getElementById('pp-mail-' + cip), d = el && el.value;
    if (!C.isoOk(d)) { if (V2.toast) V2.toast('Choisir la date d\'envoi du mail', 'warn'); return; }
    poser(cip, 'mail_envoye_le', d, 'Mail envoyé le ' + C.fr(d) + ' : noté');
  };
  C.mailEffacer = function (cip) { cip = cleCip(cip); poser(cip, 'mail_envoye_le', '', 'Date du mail effacée'); };
  C.relance = function (cip) {
    cip = cleCip(cip); var el = document.getElementById('pp-rel-' + cip), d = el && el.value;
    if (!C.isoOk(d)) { if (V2.toast) V2.toast('Choisir la date de la relance', 'warn'); return; }
    var nom = nomDe(cip);
    // 1) la date, chez soi (c'est elle qui pose l'anneau sur la carte)  2) la ligne dans la To do existante
    poser(cip, 'relance_le', d, '').then(function (bon) {
      if (!bon) return;
      if (!(V2.todo && V2.todo.ajouterLigne)) { if (V2.toast) V2.toast('Relance notée ici, mais la To do n\'est pas disponible', 'warn'); return; }
      V2.todo.ajouterLigne({ id: 'pr' + cip + d.replace(/-/g, ''), k: 'rdv', pid: cip, nom: nom, note: 'Relance prospection', pour: d }).then(function (ok) {
        if (V2.toast) V2.toast(ok ? 'Relance du ' + C.fr(d) + ' ajoutée à la To do' : 'Relance notée ici, mais pas ajoutée à la To do (liste non lue)', ok ? undefined : 'warn');
      });
    });
  };
  C.relanceEffacer = function (cip) { cip = cleCip(cip); poser(cip, 'relance_le', '', 'Relance effacée (la ligne déjà créée dans la To do reste à cocher)'); };
  C.rdv = function (cip) {
    cip = cleCip(cip);
    if (V2.rdv && V2.rdv.proposer) { try { V2.rdv.proposer(cip); return; } catch (e) {} }
    var i = indexDe(cip); if (i >= 0 && V2.carteFiche) V2.carteFiche(i);
  };
  C.nePasRetourner = function (cip, on) {
    cip = cleCip(cip);
    if (!(V2.profil && V2.profil.poser)) { if (V2.toast) V2.toast('Profil indisponible', 'warn'); majListe(); return; }
    V2.profil.poser('client', cip, 'ne_pas_retourner', on ? 'Oui' : '').then(function () {
      var rg = S.suiviCouleur.rouge; if (rg) { if (on) rg[cip] = 1; else delete rg[cip]; }
      if (V2.toast) V2.toast(on ? 'Marquée « ne pas y retourner » (visible de toute l\'équipe)' : 'Marque retirée');
      apres(cip);
    }, function () { if (V2.toast) V2.toast('Non enregistré : lecture du profil impossible', 'warn'); majListe(); });
  };

  V2.carteProspection = C;
  C.calc = C;

  // ── Styles (DA de La carte : mêmes variables, arête claire en haut, aucun flou ni texte dégradé) ──
  function css() {
    if (document.getElementById('v2-carte-pp-css')) return;
    var s = document.createElement('style'); s.id = 'v2-carte-pp-css';
    s.textContent = [
      '.cn-body{display:flex;flex:1 1 auto;min-height:0}',
      '.cn-body>.cn-maparea{flex:1 1 auto;min-width:0}',
      '.pp-rail{display:none}',
      '.cn-prosp .pp-rail{display:flex;flex-direction:column;flex:0 0 min(420px,38vw);min-height:0;background:var(--card);border-left:1px solid var(--line);box-shadow:1px 0 0 rgba(255,255,255,.9) inset,-10px 0 26px -18px rgba(11,31,77,.3)}',
      '.cn-prosp .cn-searchwrap,.cn-prosp .cn-h1~.cn-searchwrap{display:none}',
      '.cn-prosp .cn-tourbar{display:none}',
      '.pp-tete{flex:none;padding:14px 16px 10px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:3px}',
      '.pp-tete b{font-size:16px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink)}',
      '.pp-tete span{font-size:12.5px;color:var(--muted);line-height:1.4}',
      '.pp-tete .pp-note{font-size:12px;color:#4B5565}',
      '.pp-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}',
      '.pp-etat{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;font-size:13.5px;color:var(--ip-ink)}',
      '.pp-etat span{color:var(--muted)}',
      '.pp-legd{border-bottom:1px solid var(--line)}',
      '.pp-legd>summary{list-style:none;cursor:pointer;min-height:44px;display:flex;align-items:center;padding:0 16px;font-size:13px;font-weight:800;color:var(--ip-ink)}',
      '.pp-legd>summary::-webkit-details-marker{display:none}',
      '.pp-leg{display:flex;flex-direction:column;gap:6px;padding:0 16px 14px}',
      '.pp-leg-t{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:4px}',
      '.pp-lg{display:flex;align-items:center;gap:8px;font-size:12.5px;line-height:1.35;color:var(--ip-ink)}',
      '.pp-lg i{flex:none;width:12px;height:12px;border-radius:50%}',
      '.pp-lg i.pp-trait{width:22px;height:5px;border-radius:3px}',
      '.pp-lg i.pp-ring-m{background:#fff;box-shadow:0 0 0 2.5px #10131C inset}',
      '.pp-lg i.pp-ring-r{background:#fff;box-shadow:0 0 0 3px #F59E0B inset}',
      '.pp-lg i.pp-cli{background:#fff;box-shadow:0 0 0 3px #7C3AED inset}',
      '.pp-lg-n{font-size:12px;color:var(--muted)}',
      '.pp-lg-m{font-size:12px;font-weight:700;color:#B42318}',
      '.pp-liste{display:flex;flex-direction:column}',
      '.pp-row{border-bottom:1px solid var(--line)}',
      '.pp-row.sel{background:#F3F6FD}',
      '.pp-main{all:unset;box-sizing:border-box;display:grid;grid-template-columns:14px 1fr;column-gap:10px;row-gap:3px;width:100%;min-height:44px;padding:11px 16px;cursor:pointer;align-items:start}',
      '.pp-main:focus-visible{outline:3px solid var(--ip-blue,#0057FF);outline-offset:-3px}',
      '.pp-dot{width:12px;height:12px;border-radius:50%;margin-top:4px;box-shadow:0 0 0 1px rgba(16,19,28,.18) inset}',
      '.pp-nom{grid-column:2;font-size:13.5px;font-weight:800;color:var(--ip-ink);line-height:1.3}',
      '.pp-sub{grid-column:2;font-size:12px;color:#4B5565;line-height:1.35}',
      '.pp-sub b{color:var(--ip-ink)}',
      '.pp-pus{grid-column:2;display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}',
      '.pp-pu{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 9px;line-height:1.5}',
      '.pp-rouge{background:#FDECEA;color:#B42318}.pp-vert{background:#E3F6EA;color:#0B6B36}.pp-gris{background:#EEF0F4;color:#4B5565}.pp-bleu{background:#E6EEFD;color:#1D4ED8}.pp-mail{background:#E8EAF0;color:#10131C}.pp-rel{background:#FEF3C7;color:#92400E}',
      '.pp-det{padding:2px 16px 14px 36px;display:flex;flex-direction:column;gap:12px}',
      '.pp-blk{display:flex;flex-direction:column;gap:6px}',
      '.pp-bt{font-size:12px;font-weight:800;color:var(--ip-ink)}',
      '.pp-ligne{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.pp-det input[type=date]{font:inherit;font-size:16px;min-height:44px;padding:6px 10px;border:1px solid var(--line-strong,#c3c9d4);border-radius:10px;background:var(--card);color:var(--ip-ink)}',
      '.pp-det .v2-btn{min-height:44px}',
      '.pp-aide,.pp-l{font-size:12px;color:#4B5565;line-height:1.4}',
      '.pp-warn{font-size:12px;font-weight:700;color:#B42318;background:#FDECEA;border-radius:8px;padding:8px 10px}',
      '.pp-nr{display:flex;align-items:center;gap:10px;min-height:44px;font-size:13px;font-weight:700;color:var(--ip-ink);cursor:pointer}',
      '.pp-nr input{width:22px;height:22px;accent-color:#D92D20;flex:none}',
      '.pp-nr small{font-weight:600;color:#4B5565}',
      '.pp-vide{padding:22px 16px;font-size:13px;color:var(--muted);text-align:center}',
      '.pp-plus{margin:12px 16px;min-height:44px}',
      '.pp-curs{display:flex;align-items:center;gap:10px;flex:1 1 280px;min-width:0;font-size:12.5px;font-weight:700;color:var(--muted)}',
      '.pp-curs input[type=range]{flex:1;min-width:120px;height:44px;accent-color:var(--ip-blue,#0057FF)}',
      '.pp-curs-v{min-width:48px;text-align:right;font-size:14px;font-weight:800;color:var(--ip-blue,#0057FF);font-variant-numeric:tabular-nums}',
      '.pp-n{font-size:13px;font-weight:700;color:var(--ip-ink);white-space:nowrap}',
      '.pp-n b{font-size:15px;color:var(--ip-blue,#0057FF);font-variant-numeric:tabular-nums}',
      '.cn-pp-btn.on{background:var(--ip-blue,#0057FF);border-color:var(--ip-blue,#0057FF);color:#fff}',
      '.cn-fb-act.cn-pp-btn span{display:inline!important}',
      '.pp-depot-w{background:none;border:none}',
      '.pp-depot{box-sizing:border-box;width:64px;height:24px;line-height:24px;text-align:center;font-size:11.5px;font-weight:800;color:#fff;background:#10131C;border:2px solid #fff;border-radius:6px;box-shadow:0 3px 10px rgba(16,19,28,.4)}',
      '@media(max-width:760px){',
        '.cn-prosp .cn-body{flex-direction:column}',
        '.cn-prosp .cn-body>.cn-maparea{flex:0 0 40%}',
        '.cn-prosp .pp-rail{flex:1 1 auto;border-left:0;border-top:1px solid var(--line);box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 -10px 26px -18px rgba(11,31,77,.3)}',
        '.cn-prosp.cn-fiche-on .pp-rail{display:none}',
        '.cn-prosp.cn-fiche-on .cn-body>.cn-maparea{flex:1 1 auto}',
        '.cn-prosp .cn-fbcount{display:none}',
        '.pp-curs{flex-basis:100%}',
        '.pp-n{white-space:normal}',
        '.cn-pp-btn{min-height:44px}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
  css();
})(typeof window !== 'undefined' ? window : globalThis);

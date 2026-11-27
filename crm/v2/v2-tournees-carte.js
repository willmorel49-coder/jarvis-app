/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · TOURNÉES — vue « Carte » (V2.tourneesCarte) — 19/11/2026
   Will : « actuellement il y a la carte des tournées de livraisons et prospects liés dans La carte alors qu'elle devrait être dans la
   feature Tournées ». Le mode « Prospection » de La carte (v2-carte-prospection.js, 26/10/2026) a déménagé ici, tel quel :
   grande carte des tournées OPS + rail à onglets « Tournées » / « Prospects », curseur de distance, tri Numéro / Rentabilité,
   détail d'une tournée (arrêts dans l'ordre), détail d'un prospect. Adresse : #tournees/carte (bascule « Classement / Carte »
   en haut de l'écran Tournées, v2-tournees.js).

   - DONNÉES : TOURNEES_ECRAN seul (fichier protégé `tournees-etablissements.js`, lisible de tout compte hors opso) : tracés par la
     route, arrêts, prospects (colonnes `prospects_colonnes`). Aucun autre fichier, aucun SQL. Le fichier privé
     `connexions-jarvis-prospection.js` n'est plus chargé. Rien de chiffré en dur : tout vient du fichier.
   - CARTE POUR TOUS, SUIVI POUR WILL SEUL (décision du 19/11/2026) : les boutons de suivi (mail envoyé + date, relance → To do,
     proposer un rendez-vous, « ne pas y retourner », liste de diffusion Outlook) et les couleurs de suivi restent derrière le verrou
     EXISTANT jarvis_acces_connexions() (V2.carteProspection.verifier(), v2-carte-prospection.js). Une erreur de la base vaut « non ».
     Sur un « non », ce fichier ne lit ni n'écrit la table `profils`.
   - Fond de carte : V2.fondCarte (jamais CARTO, qui exige une clé). Aucun flou, aucune opacité sur du texte (Safari).
   - La vue survit à un redessin de la même page (v2-probable.js redessine 2 s après) : l'état (onglet, curseur, tournée, prospect,
     position de la carte) vit dans S ; monter() reconstruit tout depuis S.
   Calcul pur testé : tests/tournees-carte.test.mjs (données fictives).
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};
  var K = {};   // calcul pur + écran
  function TR() { return V2.tournees || {}; }   // calcul de l'écran Tournées (chargé avant ce fichier)

  // ── Calcul pur ────────────────────────────────────────────────
  function cleCip(v) { return String(v == null ? '' : v).replace(/[^0-9A-Za-z_-]/g, ''); }
  K.cleCip = cleCip;
  // 27/11/2026 : officine fermée (annuaire) → hors de la carte (le juge commun est V2.pfFermee ; sans lui ou sans PHARMA_FR : rien n'est retiré).
  function fermeeCip(cip) { var r = []; r[13] = cip; return !!(V2.pfFermee && glob.PHARMA_FR && V2.pfFermee(r, glob.PHARMA_FR)); }
  function kmOk(x) { return typeof x === 'number' && isFinite(x); }

  // Prospects de TOUTES les tournées, un par CIP (si un CIP figure dans plusieurs tournées : la plus proche), triés par distance à la
  // route (km_route), puis par CIP. Une position illisible n'est jamais comptée comme « 0 km » : le prospect est écarté.
  K.prospects = function (d) {
    var best = {};
    Object.keys((d && d.tournees) || {}).sort().forEach(function (code) {
      TR().prospects((d.tournees[code] || {}).prospects).forEach(function (p) {
        var cip = cleCip(p.cip);
        if (!cip || !kmOk(p.lat) || !kmOk(p.lng) || !kmOk(p.km_route)) return;
        if (fermeeCip(cip)) return;
        var o = { cip: cip, lat: p.lat, lng: p.lng, km: p.km_route, apres: p.apres, avant: p.avant, detour: p.detour, fiable: p.fiable, tournee: code };
        if (best[cip] && best[cip].km <= o.km) return;
        best[cip] = o;
      });
    });
    return Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return a.km - b.km || (a.cip < b.cip ? -1 : a.cip > b.cip ? 1 : 0); });
  };
  // Liste triée : nombre de prospects à ≤ rayon km (la valeur du curseur)
  K.dans = function (liste, rayon) { var n = 0; while (n < liste.length && liste[n].km <= rayon) n++; return n; };
  // Borne haute du curseur : lue dans les données (distance du prospect le plus loin, arrondie au km au-dessus), jamais en dur.
  K.rayonMax = function (liste) { var m = liste.length ? liste[liste.length - 1].km : 0; return Math.max(1, Math.ceil(m)); };
  // Tournées : par numéro, ou par rentabilité par mois (la plus faible d'abord). A = résultat de V2.tournees.analyserTout.
  K.ordonner = function (A, tri) {
    var codes = Object.keys(A || {}).sort();
    if (tri === 'renta') codes.sort(function (a, b) { return (A[a].rentabilite_mois - A[b].rentabilite_mois) || (a < b ? -1 : 1); });
    return codes;
  };
  // Teintes espacées d'un angle d'or, deux niveaux de clarté (texte blanc lisible dans la pastille numérotée)
  K.couleurTournee = function (k) { return 'hsl(' + Math.round((k * 137.508) % 360) + ',68%,' + (k % 2 ? 33 : 40) + '%)'; };
  K.kmFr = function (km) { return (Math.round(km * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
  // Où le prospect s'insère dans la tournée : phrase pour les chauffeurs (mêmes mots que le tableau de bord de la tournée).
  K.insertion = function (p) {
    var T = TR(); if (!p || !T.position) return '';
    var s = T.position(p), det = T.detour ? T.detour(p) : '';
    return (s.charAt(0).toUpperCase() + s.slice(1)) + ' de ' + p.tournee + (det ? ' · ' + det : '');
  };
  // Les arrêts d'une tournée dans l'ordre de livraison
  K.arretsOrdre = function (a) { return ((a && a.arrets) || []).slice().sort(function (x, y) { return x.n - y.n; }); };
  // Fiche officine d'un arrêt : son code, sinon la fiche reliée (champ `fi`) — seulement si elle existe dans l'annuaire du CRM.
  K.ficheDe = function (a, pharmacies) {
    var cles = [a && a.id].concat(a && a.fi && a.fi !== a.id ? [a.fi] : []).filter(Boolean).map(String), P = pharmacies || [];
    for (var j = 0; j < cles.length; j++) for (var i = 0; i < P.length; i++) if (String(P[i].id) === cles[j]) return cles[j];
    return '';
  };

  V2.tourneesCarte = K;
  // 27/11/2026 — index code → groupement suivi (calcul pur, testé : tests/tournees-carte.test.mjs) ; lu par grpSuivi() plus bas.
  K.indexGroupements = function (PF, suivis, depart) {
    var idx = {}, ok = {}; (suivis || []).forEach(function (g) { ok[g] = 1; });
    if (PF && PF.p && PF.grp) PF.p.forEach(function (p) {
      var g = PF.grp[p[3]]; if (!ok[g]) return;
      idx[cleCip(p[13])] = g; if (p._ann) idx[cleCip(p._ann)] = g;
    });
    Object.keys(depart || {}).forEach(function (c) { if (ok[depart[c]]) idx[cleCip(c)] = depart[c]; });
    return idx;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = K;
  if (!glob.document) return;   // fenêtre des tests : pas d'écran

  // ── Écran ────────────────────────────────────────────────────
  var S = {
    vue: 'tournees', tri: 'code', tourneeSel: '', arretSel: '', rayon: 10, choisi: '', affiches: 60, vueCarte: null,
    ok: null,   // verrou : null = pas encore su · true / false = réponse de la base
    suivi: { pret: false }, prive: {}, priveOk: false, outlook: null, manque: [], suiviCharge: false
  };
  var X = null;                 // contexte donné par v2-tournees.js : { d, A, nom(cip), leaflet(cb), tactile() }
  var MOD = null;               // { d, prospects, codes, rayonMax }
  var M = null;                 // la carte Leaflet en cours : { map, canvas, host, pol, pas, mar, ann, g }
  var jeton = 0, _tmr = null;
  var esc = function (s) { return TR().esc ? TR().esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var joli = function (s) { return TR().joli ? TR().joli(s) : String(s || ''); };
  var SUIVI = { rouge: '#D92D20', vert: '#12A150', gris: '#8B93A3', bleu: '#2563EB' };   // repli ; les vraies valeurs viennent de La carte (V2.carteSuiviCol)
  var NEUTRE = '#5B6B8C';       // prospect sans suivi (carte pour tous) : une seule couleur, le suivi est réservé à Will

  function CP() { return V2.carteProspection || null; }
  function suiviOk() { return S.ok === true && !!CP(); }
  function couleur(code) { var k = MOD.codes.indexOf(code); return K.couleurTournee(k < 0 ? 0 : k); }
  // 27/11/2026 — adhérentes des groupements suivis (V2.tourneesPartage.GROUPEMENTS_SUIVIS : OPSO Santé, Essentiels Pharma), mises en avant par
  // un anneau noir. Demande de Will : « met de la couleur et de l'interactivité par rapport au tournées de livraisons concerné par les pharma
  // groupement » puis « pareil sur cpr et sur les tournées aussi ops sur jarvis ». Le groupement est celui de la base nationale telle que
  // JARVIS l'a corrigée au chargement (nom canonique, corrections de fiche), plus la table de départ GRP_DEPART ; lu par code (CIP ou code client).
  var _gIdx = null, _gCle = '';
  function grpSuivi(id) {
    var Pt = V2.tourneesPartage, PF = glob.PHARMA_FR; if (!Pt) return '';
    var cle = (PF && PF.p ? PF.p.length : 0) + '|' + (PF && PF.grp ? PF.grp.length : 0);
    if (!_gIdx || _gCle !== cle) { _gIdx = K.indexGroupements(PF, Pt.GROUPEMENTS_SUIVIS, glob.GRP_DEPART); _gCle = cle; }
    return _gIdx[cleCip(id)] || '';
  }
  // Nombre d'adhérentes des groupements suivis parmi les arrêts d'une tournée, par groupement (« 2 adhérentes Essentiels Pharma »).
  function grpArrets(code) {
    var n = {}; K.arretsOrdre(X.A[code]).forEach(function (a) { var g = grpSuivi(a.id); if (g) n[g] = (n[g] || 0) + 1; });
    return Object.keys(n).map(function (g) { return n[g] + ' adhérente' + (n[g] > 1 ? 's' : '') + ' ' + g; }).join(' · ');
  }
  function nomDe(cip) { return X && X.nom ? X.nom(cip) : { nom: 'Pharmacie (code ' + cip + ')', ville: '' }; }
  function brutT(code) { return (MOD && MOD.d.tournees[code]) || null; }
  function tLbl(code) {
    var A = X.A[code], j = TR().jours ? TR().jours(A) : '';
    return A ? code + ' · ' + A.nom + (j ? ' · ' + j : '') : code;
  }
  function etatDe(cip) { return CP() && CP().etat ? CP().etat(cip, S.suivi) : 'attente'; }
  function couleurEtat(cip) { if (!suiviOk()) return NEUTRE; var c = glob.V2.carteSuiviCol || SUIVI; return c[etatDe(cip)] || '#8B93A3'; }
  function pChercher(cip) { for (var i = 0; i < MOD.prospects.length; i++) if (MOD.prospects[i].cip === cip) return MOD.prospects[i]; return null; }
  function pale(cip) { if (!suiviOk()) return false; var d = CP().diffusion(cip, S.prive, S.outlook); return (d.etat === 'pret' || d.etat === 'hors') && !d.dans; }
  function petit() { return !!(glob.matchMedia && glob.matchMedia('(max-width:760px)').matches); }

  // ── Montage / démontage ──
  K.demonter = function () {
    jeton++;
    if (_tmr) { clearTimeout(_tmr); _tmr = null; }
    if (M && M.map) {
      try { S.vueCarte = { c: M.map.getCenter(), z: M.map.getZoom() }; } catch (e) {}
      try { M.map.remove(); } catch (e2) {}
    }
    M = null;
  };
  // el : le conteneur (vidé et rempli ici). Idempotent : un redessin de la page rappelle monter() et retrouve la même vue.
  K.monter = function (el, ctx) {
    K.demonter();
    css(); X = ctx;
    if (!MOD || MOD.d !== ctx.d || MOD.pf !== glob.PHARMA_FR) {
      var pros = K.prospects(ctx.d);
      MOD = { d: ctx.d, pf: glob.PHARMA_FR, prospects: pros, codes: Object.keys(ctx.d.tournees).sort(), rayonMax: K.rayonMax(pros) };
      S.rayon = Math.min(S.rayon, MOD.rayonMax); S.tourneeSel = ''; S.choisi = ''; S.vueCarte = null;
    }
    el.innerHTML = '<div class="tcm" id="tcm"><div class="tcm-bar" id="tcm-bar"></div><div class="tcm-body"><div class="tcm-map" id="tcm-map" role="region" aria-label="Carte des tournées"></div><aside class="tcm-rail" id="tcm-rail" aria-label="Tournées et prospects"></aside></div></div>';
    majBarre(); majRail();
    var tok = jeton;
    ctx.leaflet(function (err) {
      var h = document.getElementById('tcm-map');
      if (tok !== jeton || !h) return;
      if (err || !glob.L) { h.innerHTML = '<div class="tcm-vide">Carte indisponible.</div>'; return; }
      dessiner(h);
    });
    var C = CP();
    if (C && C.verifier) C.verifier().then(function (ok) {
      if (tok !== jeton) return;
      S.ok = !!ok;
      if (!ok) return;
      chargerSuivi().then(function () { if (tok !== jeton) return; restylerTout(); majBarre(); majRail(); });
    });
    else S.ok = false;
  };
  K.majNoms = function () {
    if (MOD && X && MOD.pf !== glob.PHARMA_FR) { var h = document.getElementById('tcm'); if (h && h.parentNode) { K.monter(h.parentNode, X); return; } }   // PHARMA_FR arrivé après coup : on redessine sans les fermées
    if (M || document.getElementById('tcm-rail')) majRail();
  };

  // Suivi (verrou « oui » SEULEMENT). Une source qui échoue est NOTÉE dans S.manque : jamais lue comme « rien ».
  function chargerSuivi() {
    var C = CP(); S.manque = [];
    // chaque source est appelée dans une promesse : une panne (même immédiate) est notée, elle ne bloque pas les autres
    var essai = function (f, repli) { return Promise.resolve().then(f).catch(function () { return repli; }); };
    var pVu = V2.rdvVuCharger ? essai(function () { return V2.rdvVuCharger(); }, false) : Promise.resolve(false);
    var pRdv = V2.rdvProchainsCharger ? essai(function () { return V2.rdvProchainsCharger(); }, null) : Promise.resolve(null);
    var pRouge = (V2.profil && V2.profil.nePasRetourner) ? essai(function () { return V2.profil.nePasRetourner(); }, null) : Promise.resolve(null);
    return Promise.all([pVu, pRdv, pRouge, essai(function () { return C.lireSuiviPrive(); }, null), essai(function () { return C.lireEtatOutlook(); }, null)]).then(function (r) {
      if (r[0] !== true) S.manque.push('visites');
      if (!r[1]) S.manque.push('rendez-vous');
      if (!r[2]) S.manque.push('« ne pas y retourner »');
      S.suivi = { pret: true, rdv: r[1], rouge: r[2], vu: function (k) { return V2.rdvVuLe ? V2.rdvVuLe(k) : null; } };
      S.prive = r[3] || {}; S.priveOk = !!r[3];
      if (!S.priveOk) S.manque.push('mails envoyés et relances');
      S.outlook = r[4] || null;
      if (!S.outlook) S.manque.push('état des brouillons Outlook');
      S.suiviCharge = true;
    }, function () { S.manque = ['suivi']; S.suiviCharge = true; });
  }

  // ── Calques de la carte ──
  function styleProspect(p) {
    var pr = (suiviOk() && S.prive[p.cip]) || {}, sel = S.choisi === p.cip;
    return { renderer: M.canvas, radius: sel ? 9 : 6, color: sel ? '#10131C' : (pr.mail ? '#10131C' : '#FFFFFF'), weight: sel ? 3 : (pr.mail ? 2.5 : 1), fillColor: couleurEtat(p.cip), fillOpacity: pale(p.cip) ? 0.4 : 0.95 };
  }
  function dessiner(host) {
    var L = glob.L, d = MOD.d;
    var m = L.map(host, { zoomControl: true, attributionControl: true, scrollWheelZoom: !X.tactile(), zoomSnap: 0.25, dragging: !X.tactile(), touchZoom: true });
    try { m.attributionControl.setPrefix(false); } catch (e) {}
    if (V2.fondCarte) V2.fondCarte(m);
    m.setView([47.3, -1.75], 8);
    M = { map: m, canvas: L.canvas({ padding: 0.3 }), host: host, pol: {}, pas: {}, pasA: {}, mar: {}, ann: {}, g: { traces: L.layerGroup(), clientes: L.layerGroup(), bulles: L.layerGroup(), prospects: L.layerGroup(), anneaux: L.layerGroup(), depot: L.layerGroup() } };
    MOD.codes.forEach(function (code) {
      var t = d.tournees[code], tr = t.trace || [], col = couleur(code);
      if (tr.length > 1) {
        var pl = L.polyline(tr, { color: col, weight: 4, opacity: 0.92, lineCap: 'round', lineJoin: 'round', renderer: M.canvas, interactive: true });
        pl.on('click', function () { K.tournee(code); });
        pl.bindTooltip(function () { return '<b>' + esc(tLbl(code)) + '</b><em>Cliquez pour voir ses arrêts</em>'; }, { sticky: true, className: 'cn-tip' });
        M.pol[code] = pl; M.g.traces.addLayer(pl);
      }
      K.arretsOrdre(X.A[code]).forEach(function (a) {
        if (!kmOk(a.lat) || !kmOk(a.lng)) return;
        var gA = grpSuivi(a.id);
        var mk = L.marker([a.lat, a.lng], { icon: L.divIcon({ className: 'tcm-num-w', html: '<div class="tcm-num' + (gA ? ' tcm-grp' : '') + '" style="background:' + col + '">' + a.n + '</div>', iconSize: [24, 24], iconAnchor: [12, 12] }), keyboard: false, riseOnHover: true, zIndexOffset: gA ? 500 : 0 });
        mk.bindTooltip('<b>' + esc(joli(a.nom)) + '</b><span>N° ' + a.n + ' · ' + esc(joli(a.ville)) + '</span>' + (gA ? '<span>Adhérente ' + esc(gA) + '</span>' : '') + '<em>' + esc(tLbl(code)) + (a.renta_mois != null ? ' · rentabilité ' + esc(TR().eur(a.renta_mois)) + ' par mois' : '') + '</em>', { direction: 'top', offset: [0, -10], className: 'cn-tip' });
        mk.on('click', function () { K.tournee(code); K.arret(a.id, true); });
        (M.pas[code] = M.pas[code] || []).push(mk);
        (M.pasA[code] = M.pasA[code] || []).push({ a: a, mk: mk });
        M.g.clientes.addLayer(mk);
      });
    });
    var D = d.depot;
    if (D && kmOk(D.lat) && kmOk(D.lng)) {
      var dm = L.marker([D.lat, D.lng], { icon: L.divIcon({ className: 'tcm-depot-w', html: '<div class="tcm-depot">Dépôt</div>', iconSize: [64, 24], iconAnchor: [32, 12] }), keyboard: false });
      dm.bindTooltip('<b>' + esc(D.nom || 'Dépôt') + '</b><span>' + esc(D.ville || '') + '</span>', { direction: 'top', offset: [0, -10], className: 'cn-tip' });
      M.g.depot.addLayer(dm);
    }
    MOD.prospects.forEach(function (p) {
      var mk = L.circleMarker([p.lat, p.lng], styleProspect(p));
      mk.bindTooltip(function () { var n = nomDe(p.cip), g = grpSuivi(p.cip); return '<b>' + esc(n.nom) + '</b><span>' + esc(n.ville) + '</span>' + (g ? '<span>Adhérente ' + esc(g) + '</span>' : '') + '<em>' + K.kmFr(p.km) + ' km de la route · ' + esc(tLbl(p.tournee)) + ' · ' + esc(K.insertion(p)) + '</em>'; }, { direction: 'top', offset: [0, -6], className: 'cn-tip' });
      mk.on('click', function () { K.choisir(p.cip, true); });
      M.mar[p.cip] = mk;
    });
    [M.g.traces, M.g.clientes, M.g.bulles, M.g.depot].forEach(function (g) { g.addTo(m); });
    appliquerVue(); appliquerRayon();
    m.on('zoomend', function () { petitsPoints(); regrouper(); });
    if (S.vueCarte) { try { m.invalidateSize({ animate: false }); m.setView(S.vueCarte.c, S.vueCarte.z, { animate: false }); } catch (e2) {} }
    else cadrer(S.tourneeSel);
    if (!K._resize) { K._resize = true; glob.addEventListener('resize', function () { if (M && M.map && document.getElementById('tcm-map')) { try { M.map.invalidateSize(); } catch (e) {} } }); }
  }
  function cadrer(code) {
    if (!M) return;
    var pts = [], d = MOD.d;
    if (code) { (brutT(code).trace || []).forEach(function (q) { pts.push(q); }); }
    else MOD.codes.forEach(function (k) { (d.tournees[k].trace || []).forEach(function (q) { pts.push(q); }); });
    if (d.depot && kmOk(d.depot.lat)) pts.push([d.depot.lat, d.depot.lng]);
    if (pts.length > 1) { try { M.map.invalidateSize({ animate: false }); M.map.fitBounds(pts, { padding: [30, 30], animate: false }); } catch (e) {} }
  }
  // Prospects et anneaux : visibles dans l'onglet Prospects seulement ; une tournée choisie : ses pastilles seules, les autres tracés atténués.
  function appliquerVue() {
    if (!M) return;
    var on = S.vue === 'prospects';
    ['prospects', 'anneaux'].forEach(function (k) { var dedans = M.map.hasLayer(M.g[k]); if (on && !dedans) M.g[k].addTo(M.map); else if (!on && dedans) M.map.removeLayer(M.g[k]); });
    Object.keys(M.pas).forEach(function (k) {
      var voir = !S.tourneeSel || S.tourneeSel === k;
      M.pas[k].forEach(function (mk) { var dedans = M.g.clientes.hasLayer(mk); if (voir && !dedans) M.g.clientes.addLayer(mk); else if (!voir && dedans) M.g.clientes.removeLayer(mk); });
    });
    Object.keys(M.pol).forEach(function (k) {
      var sel = S.tourneeSel === k, atten = !!S.tourneeSel && !sel;
      M.pol[k].setStyle({ opacity: atten ? 0.22 : 0.92, weight: sel ? 6 : 4 });
    });
    petitsPoints(); regrouper();
  }
  // Vue de toutes les tournées : sous le zoom 10, de petits points sans numéro. Une tournée choisie : ses numéros restent lisibles à tout zoom.
  function petitsPoints() { var el = M && M.map.getContainer(); if (el) el.classList.toggle('tcm-petit', M.map.getZoom() < 10 && !S.tourneeSel); }
  // 27/11/2026 au soir (choix de Will) : une tournée choisie, ses arrêts qui se chevauchent à l'écran sont réunis dans une bulle « 3 à 7 », comme sur la carte
  // « Sur la route » du tableau de bord (mêmes fonctions : V2.tournees.grouperPoints / texteGroupe) ; un toucher zoome dessus et les numéros se séparent.
  // Recalculé à chaque zoom ; au zoom 17 et plus, tous les arrêts s'affichent seuls. La vue de toutes les tournées n'a pas de bulles.
  function regrouper() {
    if (!M) return;
    M.g.bulles.clearLayers();
    var T = V2.tournees, code = S.tourneeSel, xs = (code && M.pasA[code]) || [];
    if (!xs.length || !T || !T.grouperPoints || !T.texteGroupe) return;
    var L = glob.L, m = M.map, tac = X.tactile();
    var texteG = function (mm) { return T.texteGroupe(mm.map(function (i) { return xs[i].a.n; })); };
    var largG = function (mm) { return Math.max(tac ? 44 : 36, Math.round(20 + texteG(mm).length * 6.6)); };
    var G = m.getZoom() >= 17 ? xs.map(function (x, i) { return { m: [i] }; })
      : T.grouperPoints(xs.map(function (x) { return m.latLngToLayerPoint([x.a.lat, x.a.lng]); }), function (mm) { return mm.length > 1 ? largG(mm) / 2 : 12; }, 4);
    G.forEach(function (gr) {
      if (gr.m.length === 1) { var mk = xs[gr.m[0]].mk; if (!M.g.clientes.hasLayer(mk)) M.g.clientes.addLayer(mk); return; }
      var ys = gr.m.map(function (i) { return xs[i]; }), lab = texteG(gr.m), w = largG(gr.m), hz = tac ? 44 : 28;   // au téléphone, zone touchable de 44 px
      ys.forEach(function (y) { if (M.g.clientes.hasLayer(y.mk)) M.g.clientes.removeLayer(y.mk); });
      var ic = L.divIcon({ className: 'tcm-gp-w', iconSize: [w, hz], iconAnchor: [w / 2, hz / 2], html: '<div class="tcm-gp" data-g="' + esc(ys.map(function (y) { return cleCip(y.a.id); }).join(' ')) + '"' + (hz > 28 ? ' style="margin-top:' + (hz - 28) / 2 + 'px"' : '') + '>' + esc(lab) + '</div>' });
      L.marker(m.layerPointToLatLng(L.point(gr.x, gr.y)), { icon: ic, zIndexOffset: 600, keyboard: true, title: 'Arrêts ' + lab + ' : zoomer pour les voir' }).addTo(M.g.bulles)
        .bindTooltip(ys.slice(0, 8).map(function (y) { return '<b>N° ' + y.a.n + '</b> · ' + esc(joli(y.a.nom)); }).join('<br>') + (ys.length > 8 ? '<br>et ' + (ys.length - 8) + ' autres' : ''), { direction: 'top', offset: [0, -10], className: 'cn-tip' })
        .on('click', function () { try { m.fitBounds(L.latLngBounds(ys.map(function (y) { return [y.a.lat, y.a.lng]; })).pad(0.35), { maxZoom: 17, animate: false }); } catch (e) {} });   // sans animation, comme les autres cadrages de cette carte
    });
  }
  function appliquerRayon() {
    if (!M) return;
    var n = K.dans(MOD.prospects, S.rayon);
    MOD.prospects.forEach(function (p, k) {
      var mk = M.mar[p.cip]; if (!mk) return;
      var on = k < n, dedans = M.g.prospects.hasLayer(mk);
      if (on && !dedans) M.g.prospects.addLayer(mk); else if (!on && dedans) M.g.prospects.removeLayer(mk);
      var pr = (suiviOk() && S.prive[p.cip]) || {}, ring = M.ann[p.cip];
      if (on && pr.relance) {
        if (!ring) ring = M.ann[p.cip] = glob.L.circleMarker([p.lat, p.lng], { renderer: M.canvas, radius: 11, color: '#F59E0B', weight: 3, fill: false, interactive: false });
        if (!M.g.anneaux.hasLayer(ring)) M.g.anneaux.addLayer(ring);
      } else if (ring && M.g.anneaux.hasLayer(ring)) M.g.anneaux.removeLayer(ring);
      var gk = 'g' + p.cip, gr = M.ann[gk];
      if (on && grpSuivi(p.cip)) {
        if (!gr) gr = M.ann[gk] = glob.L.circleMarker([p.lat, p.lng], { renderer: M.canvas, radius: pr.relance ? 15 : 11, color: '#10131C', weight: 3, fill: false, interactive: false });
        if (!M.g.anneaux.hasLayer(gr)) M.g.anneaux.addLayer(gr);
      } else if (gr && M.g.anneaux.hasLayer(gr)) M.g.anneaux.removeLayer(gr);
    });
  }
  function restyler(cip) { var p = pChercher(cip), mk = M && M.mar[cip]; if (p && mk) mk.setStyle(styleProspect(p)); appliquerRayon(); }
  function restylerTout() { if (!M) return; MOD.prospects.forEach(function (p) { var mk = M.mar[p.cip]; if (mk) mk.setStyle(styleProspect(p)); }); appliquerRayon(); }

  // ── Barre du haut : curseur de distance + compte ──
  function majBarre() {
    var b = document.getElementById('tcm-bar'); if (!b) return;
    var n = K.dans(MOD.prospects, S.rayon);
    b.innerHTML = '<label class="tcm-curs" for="tcm-rayon"><span class="tcm-curs-t">Distance à la route</span>' +
      '<input id="tcm-rayon" type="range" min="1" max="' + MOD.rayonMax + '" step="1" value="' + S.rayon + '" oninput="V2.tourneesCarte.rayon(this.value)" aria-valuetext="' + S.rayon + ' kilomètres">' +
      '<b class="tcm-curs-v" id="tcm-rayon-v">' + S.rayon + ' km</b></label>' +
      '<span class="tcm-n" id="tcm-n" role="status" aria-live="polite"><b>' + n.toLocaleString('fr-FR') + '</b> prospect' + (n > 1 ? 's' : '') + ' à moins de ' + S.rayon + ' km de la route</span>';
  }
  K.rayon = function (v) {
    var r = Math.max(1, Math.min(MOD.rayonMax, parseInt(v, 10) || 10));
    S.rayon = r; S.affiches = 60;
    var lb = document.getElementById('tcm-rayon-v'); if (lb) lb.textContent = r + ' km';
    if (_tmr) clearTimeout(_tmr);
    _tmr = setTimeout(function () {
      var n = K.dans(MOD.prospects, S.rayon), el = document.getElementById('tcm-n');
      if (el) el.innerHTML = '<b>' + n.toLocaleString('fr-FR') + '</b> prospect' + (n > 1 ? 's' : '') + ' à moins de ' + S.rayon + ' km de la route';
      var inp = document.getElementById('tcm-rayon'); if (inp) inp.setAttribute('aria-valuetext', S.rayon + ' kilomètres');
      appliquerRayon(); majOnglets(); majListe();
    }, 90);
  };

  // ── Rail ──
  function onglets() {
    var n = K.dans(MOD.prospects, S.rayon), nt = MOD.codes.length;
    var b = function (v, lib) { var on = S.vue === v; return '<button type="button" role="tab" class="tcm-onglet' + (on ? ' on' : '') + '" aria-selected="' + (on ? 'true' : 'false') + '" onclick="V2.tourneesCarte.vue(\'' + v + '\')">' + lib + '</button>'; };
    return '<div class="tcm-onglets" id="tcm-onglets" role="tablist">' + b('tournees', 'Tournées (' + nt + ')') + b('prospects', 'Prospects (' + n.toLocaleString('fr-FR') + ')') + '</div>';
  }
  function majOnglets() { var o = document.getElementById('tcm-onglets'); if (o) o.outerHTML = onglets(); }
  function tete() {
    if (S.vue === 'tournees') return '<b>Tournées de livraison</b><span class="tcm-note">Tracés : la vraie route, dans l\'ordre de livraison. Touchez une tournée pour voir ses arrêts, puis ouvrir son tableau de bord.</span>';
    var h = '<b>Prospects sur la route</b><span>Pharmacies qui ne sont pas encore clientes, de la plus proche de la route à la plus éloignée.</span>';
    if (!suiviOk() || !S.suiviCharge) return h;
    var c = CP().compteDiffusion(S.prive, S.outlook);
    if (!c.lu) return h + '<span class="tcm-diff-t tcm-l-m">État des brouillons Outlook non lu : la liste de diffusion ne peut pas être modifiée.</span>';
    h += '<span class="tcm-diff-t" id="tcm-diff-n"><b>' + c.n.toLocaleString('fr-FR') + '</b> pharmacie' + (c.n > 1 ? 's' : '') + ' dans votre liste de diffusion</span>';
    if (c.k) h += '<span class="tcm-diff-k">' + c.k.toLocaleString('fr-FR') + ' changement' + (c.k > 1 ? 's' : '') + ' à reporter dans Outlook : demandez la mise à jour des brouillons.</span>';
    return h;
  }
  function chiffres(code) {
    var A = X.A[code], T = TR();
    return '<span class="tcm-ch"><b>' + A.nb_arrets + ' arrêt' + (A.nb_arrets > 1 ? 's' : '') + '</b> · ' + T.km(A.km_total, 0) + ' · ' + (T.jours(A) ? esc(T.jours(A)) : 'jours à préciser') + (A.transporteur ? ' · ' + esc(A.transporteur) : '') + '</span>' +
      '<span class="tcm-ch' + (A.rentabilite_mois < 0 ? ' tcm-neg' : '') + '">Rentabilité par mois : <b>' + T.eur(A.rentabilite_mois) + '</b>' + (A.nb_perte ? ' · ' + A.nb_perte + ' cliente' + (A.nb_perte > 1 ? 's' : '') + ' en perte' : '') + '</span>' +
      '<span class="tcm-ch">' + A.nb_prospects_2km + ' prospect' + (A.nb_prospects_2km > 1 ? 's' : '') + ' à 2 km de détour ou moins</span>';
  }
  function tourneesHtml() {
    var h = '<div class="tcm-tris"><span>Trier par</span><button type="button" class="tcm-tri' + (S.tri === 'code' ? ' on' : '') + '" onclick="V2.tourneesCarte.tri(\'code\')">Numéro</button><button type="button" class="tcm-tri' + (S.tri === 'renta' ? ' on' : '') + '" onclick="V2.tourneesCarte.tri(\'renta\')">Rentabilité (la plus faible d\'abord)</button></div>';
    K.ordonner(X.A, S.tri).forEach(function (k) {
      var gk = grpArrets(k);
      h += '<button type="button" class="tcm-tr" style="--tcm-c:' + couleur(k) + '" onclick="V2.tourneesCarte.tournee(\'' + k + '\')">' +
        '<span class="tcm-nom"><i class="tcm-trait" style="background:' + couleur(k) + '"></i>' + esc(k + ' · ' + X.A[k].nom) + '</span>' + chiffres(k) +
        (gk ? '<span class="tcm-ch tcm-g"><i class="tcm-g-m" aria-hidden="true"></i>' + esc(gk) + ' livrée' + (/^1 /.test(gk) && gk.indexOf(' · ') < 0 ? '' : 's') + '</span>' : '') + '</button>';
    });
    return h;
  }
  function arretsHtml(code) {
    var A = X.A[code]; if (!A) return '';
    var h = '<div class="tcm-dt"><button type="button" class="v2-btn v2-btn-ghost tcm-retour" onclick="V2.tourneesCarte.tourneeFermer()">← Toutes les tournées</button>' +
      '<div class="tcm-nom"><i class="tcm-trait" style="background:' + couleur(code) + '"></i>' + esc(code + ' · ' + A.nom) + '</div>' + chiffres(code) +
      (grpArrets(code) ? '<span class="tcm-ch tcm-g"><i class="tcm-g-m" aria-hidden="true"></i>' + esc(grpArrets(code)) + '</span>' : '') +
      '<button type="button" class="v2-btn v2-btn-primary tcm-ouvrir" onclick="V2.tourneesCarte.tourneeOuvrir(\'' + code + '\')">Ouvrir le tableau de bord de la tournée</button>' +
      '<div class="tcm-aide">Dépôt, puis les arrêts dans l\'ordre de livraison.</div></div>';
    K.arretsOrdre(A).forEach(function (a) {
      var id = cleCip(a.id), sel = S.arretSel === id, fiche = K.ficheDe(a, V2.pharmacies);
      h += '<div class="tcm-arw' + (sel ? ' sel' : '') + '"><button type="button" class="tcm-ar" onclick="V2.tourneesCarte.arret(\'' + id + '\')" aria-expanded="' + (sel ? 'true' : 'false') + '">' +
        '<b class="tcm-num tcm-num-l' + (grpSuivi(a.id) ? ' tcm-grp' : '') + '" style="background:' + couleur(code) + '">' + a.n + '</b>' +
        '<span class="tcm-nom">' + esc(joli(a.nom)) + '</span>' +
        '<span class="tcm-sub">' + esc(joli(a.ville)) + (a.com ? ' · ' + esc(a.com) : '') + '</span>' +
        (grpSuivi(a.id) ? '<span class="tcm-gtag">Adhérente ' + esc(grpSuivi(a.id)) + '</span>' : '') +
        (a.renta_mois != null ? '<span class="tcm-ch' + (a.renta_mois < 0 ? ' tcm-neg' : '') + '">Rentabilité : <b>' + esc(TR().eur(a.renta_mois)) + '</b> par mois</span>' : '<span class="tcm-ch">Pas de ventes sur la période</span>') + '</button>' +
        (sel ? '<div class="tcm-det">' + (fiche ? '<button type="button" class="v2-btn v2-btn-ghost" onclick="V2.go(\'pharma\',\'' + cleCip(fiche) + '\')">Ouvrir la fiche de la pharmacie</button>' : '<div class="tcm-aide">La fiche de cette pharmacie n\'est pas disponible.</div>') + '</div>' : '') + '</div>';
    });
    return h;
  }
  function legendeHtml() {
    var lg = function (c, t) { return '<span class="tcm-lg"><i style="background:' + c + '"></i>' + esc(t) + '</span>'; };
    var h = '<div class="tcm-leg"><div class="tcm-leg-t">Prospects</div>';
    if (suiviOk() && S.suiviCharge) {
      var SC = V2.carteSuiviCol || SUIVI;
      h += lg(SC.rouge, 'Ne pas y retourner') + lg(SC.vert, 'Rendez-vous à venir') + lg(SC.gris, 'Déjà vue') + lg(SC.bleu, 'Jamais vue') +
        '<span class="tcm-lg"><i class="tcm-ring-m"></i>Contour foncé : mail envoyé</span><span class="tcm-lg"><i class="tcm-ring-r"></i>Anneau orange : relance à faire</span>' +
        '<span class="tcm-lg"><i class="tcm-pale"></i>Point pâle : pas dans ma liste de diffusion</span>';
    } else h += lg(NEUTRE, 'Pharmacie pas encore cliente');
    h += '<span class="tcm-lg"><i class="tcm-cli"></i>Pastille numérotée : cliente, dans l\'ordre de livraison de sa tournée</span>';
    if (V2.tourneesPartage) h += '<span class="tcm-lg"><i class="tcm-g-m"></i>Anneau noir : adhérente ' + esc(V2.tourneesPartage.GROUPEMENTS_SUIVIS.join(' ou ')) + '</span>';
    if (suiviOk() && S.manque.length) h += '<span class="tcm-lg tcm-lg-m">Non lu : ' + esc(S.manque.join(', ')) + '. Ces couleurs ou suivis peuvent être incomplets ; rouvrir l\'écran pour réessayer.</span>';
    return h + '</div>';
  }
  function puces(p) {
    if (!suiviOk() || !S.suiviCharge) return '';
    var e = etatDe(p.cip), S2 = S.suivi, pr = S.prive[p.cip] || {}, out = [], C = CP();
    if (e === 'rouge') out.push('<span class="tcm-pu tcm-rouge">Ne pas y retourner</span>');
    else if (e === 'vert') out.push('<span class="tcm-pu tcm-vert">RDV le ' + esc(C.fr(S2.rdv[p.cip])) + '</span>');
    else if (e === 'gris') out.push('<span class="tcm-pu tcm-gris">Déjà vue le ' + esc(C.fr(S2.vu(p.cip))) + '</span>');
    else if (e === 'bleu') out.push('<span class="tcm-pu tcm-bleu">Jamais vue</span>');
    else out.push('<span class="tcm-pu tcm-gris">Suivi non lu</span>');
    var df = C.diffusion(p.cip, S.prive, S.outlook);
    if (df.etat === 'envoye') out.push('<span class="tcm-pu tcm-diff">Mail parti le ' + esc(C.fr(df.le)) + '</span>');
    else if (df.attente === 'retrait') out.push('<span class="tcm-pu tcm-diff-att">Retrait en attente</span>');
    else if (df.attente === 'ajout') out.push('<span class="tcm-pu tcm-diff-att">Ajout en attente</span>');
    else if (df.etat === 'pret') out.push('<span class="tcm-pu tcm-diff">Dans ma liste</span>');
    if (pr.mail) out.push('<span class="tcm-pu tcm-mail">Mail envoyé le ' + esc(C.fr(pr.mail)) + '</span>');
    if (pr.relance) out.push('<span class="tcm-pu tcm-rel">Relance le ' + esc(C.fr(pr.relance)) + '</span>');
    return out.join('');
  }
  // ── Boutons de suivi : n'existent QUE derrière le verrou (suiviOk) ──
  function blocDiffusion(p) {
    var C = CP(), d = C.diffusion(p.cip, S.prive, S.outlook), t, b = '', id = p.cip;
    var btn = function (veut, lib) { return '<button type="button" class="v2-btn v2-btn-ghost" onclick="V2.tourneesCarte.diffusionChoisir(\'' + id + '\',' + (veut ? 'true' : 'false') + ')"' + (S.priveOk ? '' : ' disabled') + '>' + lib + '</button>'; };
    if (d.etat === 'inconnu') t = 'État des brouillons Outlook non lu : la liste ne peut pas être modifiée pour l\'instant.';
    else if (d.etat === 'envoye') t = 'Mail parti le ' + C.fr(d.le);
    else if (d.etat === 'sansmail') t = 'Aucune adresse mail connue pour cette pharmacie';
    else if (d.etat === 'pret') {
      if (d.attente === 'retrait') { t = 'Retirée de votre liste : le brouillon ira à la corbeille à la prochaine mise à jour'; b = btn(true, 'Remettre dans ma liste'); }
      else { t = 'Brouillon prêt dans Outlook'; b = btn(false, 'Retirer de ma liste'); }
    } else {
      if (d.attente === 'ajout') { t = 'Ajoutée : le brouillon sera créé à la prochaine mise à jour'; b = btn(false, 'Annuler'); }
      else { t = 'Pas dans votre liste'; b = btn(true, 'Ajouter à ma liste'); }
    }
    return '<div class="tcm-blk" id="tcm-diff-' + id + '"><div class="tcm-bt">Liste de diffusion</div><div class="tcm-l' + (d.etat === 'inconnu' ? ' tcm-l-m' : '') + '">' + esc(t) + '</div>' + (b ? '<div class="tcm-ligne">' + b + '</div>' : '') + '</div>';
  }
  function blocSuivi(p) {
    var C = CP(), pr = S.prive[p.cip] || {}, e = etatDe(p.cip), id = p.cip, aj = C.aujourdhui(), off = S.priveOk ? '' : ' disabled', rdv = '';
    if (e === 'vert') rdv = '<div class="tcm-l">Rendez-vous pris le <b>' + esc(C.fr(S.suivi.rdv[id])) + '</b></div>';
    else if (e === 'gris') rdv = '<div class="tcm-l">Déjà vue le <b>' + esc(C.fr(S.suivi.vu(id))) + '</b></div>';
    else if (e === 'bleu') rdv = '<div class="tcm-l">Aucun rendez-vous ni visite enregistrés.</div>';
    return (S.priveOk ? '' : '<div class="tcm-warn">Suivi non lu : mail envoyé et relance indisponibles pour l\'instant.</div>') + blocDiffusion(p) +
      '<div class="tcm-blk"><div class="tcm-bt">Mail envoyé</div><div class="tcm-ligne"><input type="date" id="tcm-mail-' + id + '" value="' + esc(pr.mail || aj) + '" aria-label="Date d\'envoi du mail"' + off + '>' +
        '<button type="button" class="v2-btn v2-btn-primary" onclick="V2.tourneesCarte.mail(\'' + id + '\')"' + off + '>Enregistrer</button>' +
        (pr.mail ? '<button type="button" class="v2-btn v2-btn-ghost" onclick="V2.tourneesCarte.mailEffacer(\'' + id + '\')"' + off + '>Effacer</button>' : '') + '</div></div>' +
      '<div class="tcm-blk"><div class="tcm-bt">Relance à faire</div><div class="tcm-ligne"><input type="date" id="tcm-rel-' + id + '" value="' + esc(pr.relance || '') + '" aria-label="Date de la relance"' + off + '>' +
        '<button type="button" class="v2-btn v2-btn-primary" onclick="V2.tourneesCarte.relance(\'' + id + '\')"' + off + '>Ajouter à la to do</button>' +
        (pr.relance ? '<button type="button" class="v2-btn v2-btn-ghost" onclick="V2.tourneesCarte.relanceEffacer(\'' + id + '\')"' + off + '>Effacer</button>' : '') + '</div>' +
        '<div class="tcm-aide">Crée une ligne dans votre To do, à cette date.</div></div>' +
      '<div class="tcm-blk"><div class="tcm-bt">Rendez-vous</div>' + rdv + '<div class="tcm-ligne"><button type="button" class="v2-btn v2-btn-ghost" onclick="V2.tourneesCarte.rdv(\'' + id + '\')">Proposer un rendez-vous</button></div></div>' +
      '<div class="tcm-blk"><label class="tcm-nr"><input type="checkbox" id="tcm-nr-' + id + '"' + (e === 'rouge' ? ' checked' : '') + ' onchange="V2.tourneesCarte.nePasRetourner(\'' + id + '\',this.checked)"><span>Ne pas y retourner <small>(partagé avec l\'équipe)</small></span></label></div>';
  }
  function detailHtml(p) {
    return '<div class="tcm-det">' +
      '<button type="button" class="v2-btn v2-btn-ghost" onclick="V2.tourneesCarte.fiche(\'' + p.cip + '\')">Ouvrir la fiche de la pharmacie</button>' +
      (suiviOk() && S.suiviCharge ? blocSuivi(p) : '') + '</div>';
  }
  function rangee(p) {
    var sel = S.choisi === p.cip, n = nomDe(p.cip);
    return '<div class="tcm-row' + (sel ? ' sel' : '') + '" id="tcm-r-' + p.cip + '">' +
      '<button type="button" class="tcm-main" onclick="V2.tourneesCarte.choisir(\'' + p.cip + '\')" aria-expanded="' + (sel ? 'true' : 'false') + '">' +
        '<i class="tcm-dot" style="background:' + couleurEtat(p.cip) + '"></i>' +
        '<span class="tcm-nom">' + esc(n.nom) + '</span>' +
        '<span class="tcm-sub">' + (n.ville ? esc(n.ville) + ' · ' : '') + '<b>' + K.kmFr(p.km) + ' km</b> de la route · ' + esc(tLbl(p.tournee)) + '</span>' +
        '<span class="tcm-ins">' + esc(K.insertion(p)) + '</span>' +
        (puces(p) ? '<span class="tcm-pus">' + puces(p) + '</span>' : '') + '</button>' + (sel ? detailHtml(p) : '') + '</div>';
  }
  function listeHtml() {
    var n = K.dans(MOD.prospects, S.rayon), vus = Math.min(n, S.affiches);
    if (!n) return '<div class="tcm-vide">Aucun prospect à moins de ' + S.rayon + ' km de la route. Élargir le curseur.</div>';
    var h = '';
    for (var k = 0; k < vus; k++) h += rangee(MOD.prospects[k]);
    if (S.choisi) {   // la ligne ouverte reste à l'écran même au-delà de la tranche affichée
      var kk = -1; for (var j = 0; j < n; j++) if (MOD.prospects[j].cip === S.choisi) { kk = j; break; }
      if (kk >= vus) h += rangee(MOD.prospects[kk]);
    }
    if (n > vus) h += '<button type="button" class="v2-btn v2-btn-ghost tcm-plus" onclick="V2.tourneesCarte.plus()">Afficher plus (' + (n - vus).toLocaleString('fr-FR') + ' restants)</button>';
    return h;
  }
  function majListe() { var l = document.getElementById('tcm-liste'); if (l) l.innerHTML = listeHtml(); }
  function majTete() { var t = document.getElementById('tcm-tete'); if (t) t.innerHTML = tete(); }
  function corps() {
    if (S.vue === 'prospects') return '<details class="tcm-legd"' + (petit() ? '' : ' open') + '><summary>Légende</summary>' + legendeHtml() + '</details><div class="tcm-liste" id="tcm-liste">' + listeHtml() + '</div>';
    return '<div class="tcm-liste">' + (S.tourneeSel ? arretsHtml(S.tourneeSel) : tourneesHtml()) + '</div>';
  }
  function majRail() {
    var r = document.getElementById('tcm-rail'); if (!r) return;
    r.innerHTML = '<div class="tcm-tete" id="tcm-tete">' + tete() + '</div>' + onglets() + '<div class="tcm-scroll" id="tcm-scroll">' + corps() + '</div>';
  }

  // ── Gestes ──
  K.vue = function (v) {
    S.vue = v === 'prospects' ? 'prospects' : 'tournees'; S.tourneeSel = ''; S.arretSel = '';
    appliquerVue(); majRail();
    if (S.vue === 'tournees') cadrer('');
  };
  K.tri = function (v) { S.tri = v === 'renta' ? 'renta' : 'code'; majRail(); };
  K.tournee = function (code) {
    code = String(code || '');
    if (!MOD || !MOD.d.tournees[code]) return;
    S.vue = 'tournees'; S.tourneeSel = code; S.arretSel = '';
    appliquerVue(); majRail(); cadrer(code);
    var sc = document.getElementById('tcm-scroll'); if (sc) sc.scrollTop = 0;
  };
  K.tourneeFermer = function () { S.tourneeSel = ''; S.arretSel = ''; appliquerVue(); majRail(); cadrer(''); };
  // Ouvre le tableau de bord existant de la tournée (#tournees/Txx)
  K.tourneeOuvrir = function (code) { if (MOD && MOD.d.tournees[String(code)] && V2.go) { K.demonter(); V2.go('tournees', String(code)); } };
  K.arret = function (id, depuisCarte) {
    id = cleCip(id); if (!MOD) return;
    var a = null; K.arretsOrdre(X.A[S.tourneeSel]).forEach(function (x) { if (cleCip(x.id) === id) a = x; });
    if (!a) return;
    S.arretSel = (S.arretSel === id && !depuisCarte) ? '' : id;
    if (M && kmOk(a.lat)) M.map.setView([a.lat, a.lng], Math.max(M.map.getZoom(), 12), { animate: true });
    majRail();
  };
  K.plus = function () { S.affiches += 60; majListe(); };
  K.fiche = function (cip) { cip = cleCip(cip); if (cip && V2.go) { K.demonter(); V2.go('pharma', cip); } };
  K.choisir = function (cip, depuisCarte) {
    cip = cleCip(cip);
    var p = pChercher(cip); if (!p) return;
    var ancien = S.choisi;
    S.choisi = (S.choisi === cip && !depuisCarte) ? '' : cip;
    if (depuisCarte && S.vue !== 'prospects') { S.vue = 'prospects'; S.tourneeSel = ''; S.arretSel = ''; appliquerVue(); majRail(); }
    if (ancien && M && M.mar[ancien]) restyler(ancien);
    if (S.choisi && M) {
      restyler(cip);
      if (M.mar[cip] && M.mar[cip].bringToFront) M.mar[cip].bringToFront();
      M.map.setView([p.lat, p.lng], Math.max(M.map.getZoom(), 12), { animate: true });
    }
    majListe();
    var row = document.getElementById('tcm-r-' + cip);
    if (row && row.scrollIntoView && S.choisi) { try { row.scrollIntoView({ block: depuisCarte ? 'center' : 'nearest' }); } catch (e) {} }
  };

  // Gestes de suivi : tous refusent d'agir sans le verrou (un clic forgé ne peut rien écrire)
  function apres(cip) { restyler(cip); majListe(); }
  function poser(cip, colonne, valeur, ok) {
    if (!suiviOk()) return Promise.resolve(false);
    var cle = colonne === 'mail_envoye_le' ? 'mail' : 'relance';
    return CP().ecrireSuiviPrive(cip, colonne, valeur).then(function (bon) {
      if (!bon) { if (V2.toast) V2.toast('Non enregistré : la base n\'a pas répondu', 'warn'); return false; }
      S.prive[cip] = S.prive[cip] || { mail: '', relance: '' };
      S.prive[cip][cle] = valeur || '';
      apres(cip);
      if (V2.toast && ok) V2.toast(ok);
      return true;
    });
  }
  K.mail = function (cip) {
    cip = cleCip(cip); var el = document.getElementById('tcm-mail-' + cip), d = el && el.value;
    if (!suiviOk()) return;
    if (!CP().isoOk(d)) { if (V2.toast) V2.toast('Choisir la date d\'envoi du mail', 'warn'); return; }
    poser(cip, 'mail_envoye_le', d, 'Mail envoyé le ' + CP().fr(d) + ' : noté');
  };
  K.mailEffacer = function (cip) { if (suiviOk()) poser(cleCip(cip), 'mail_envoye_le', '', 'Date du mail effacée'); };
  K.relance = function (cip) {
    cip = cleCip(cip); var el = document.getElementById('tcm-rel-' + cip), d = el && el.value;
    if (!suiviOk()) return;
    if (!CP().isoOk(d)) { if (V2.toast) V2.toast('Choisir la date de la relance', 'warn'); return; }
    var nom = nomDe(cip).nom;
    // 1) la date, chez soi (c'est elle qui pose l'anneau sur la carte)  2) la ligne dans la To do existante
    poser(cip, 'relance_le', d, '').then(function (bon) {
      if (!bon) return;
      if (!(V2.todo && V2.todo.ajouterLigne)) { if (V2.toast) V2.toast('Relance notée ici, mais la To do n\'est pas disponible', 'warn'); return; }
      V2.todo.ajouterLigne({ id: 'pr' + cip + d.replace(/-/g, ''), k: 'rdv', pid: cip, nom: nom, note: 'Relance prospection', pour: d }).then(function (ok) {
        if (V2.toast) V2.toast(ok ? 'Relance du ' + CP().fr(d) + ' ajoutée à la To do' : 'Relance notée ici, mais pas ajoutée à la To do (liste non lue)', ok ? undefined : 'warn');
      });
    });
  };
  K.relanceEffacer = function (cip) { if (suiviOk()) poser(cleCip(cip), 'relance_le', '', 'Relance effacée (la ligne déjà créée dans la To do reste à cocher)'); };
  K.rdv = function (cip) {
    cip = cleCip(cip);
    if (!suiviOk()) return;
    if (V2.rdv && V2.rdv.proposer) { try { V2.rdv.proposer(cip); return; } catch (e) {} }
    K.fiche(cip);
  };
  // Clic « Retirer / Remettre / Ajouter / Annuler » : enregistre SEULEMENT le souhait (Outlook ne bouge qu'à la mise à jour demandée).
  K.diffusionChoisir = function (cip, veut) {
    cip = cleCip(cip);
    if (!suiviOk()) return Promise.resolve(false);
    var C = CP(), d = C.diffusion(cip, S.prive, S.outlook), val = C.valeurSouhait(d.etat, !!veut);
    if (val === null) { if (V2.toast) V2.toast('Cette pharmacie ne peut pas être ajoutée ni retirée', 'warn'); return Promise.resolve(false); }
    return C.ecrireSuiviPrive(cip, 'liste_souhait', val).then(function (bon) {
      if (!bon) { if (V2.toast) V2.toast('Non enregistré : la base n\'a pas répondu', 'warn'); return false; }
      S.prive[cip] = S.prive[cip] || { mail: '', relance: '', liste: '' };
      S.prive[cip].liste = val;
      apres(cip); majTete();
      if (V2.toast) V2.toast(veut ? 'Ajoutée à votre liste' : 'Retirée de votre liste');
      return true;
    });
  };
  K.nePasRetourner = function (cip, on) {
    cip = cleCip(cip);
    if (!suiviOk()) return;
    if (!(V2.profil && V2.profil.poser)) { if (V2.toast) V2.toast('Profil indisponible', 'warn'); majListe(); return; }
    V2.profil.poser('client', cip, 'ne_pas_retourner', on ? 'Oui' : '').then(function () {
      var rg = S.suivi.rouge; if (rg) { if (on) rg[cip] = 1; else delete rg[cip]; }
      if (V2.toast) V2.toast(on ? 'Marquée « ne pas y retourner » (visible de toute l\'équipe)' : 'Marque retirée');
      apres(cip);
    }, function () { if (V2.toast) V2.toast('Non enregistré : lecture du profil impossible', 'warn'); majListe(); });
  };
  K.etatInterne = S;   // pour les sondes et les tests
  // Lecture seule de ce qui est posé sur la carte (sondes) : tracés, pastilles d'arrêts, prospects affichés
  K.diag = function () {
    if (!M) return null;
    var n = 0; Object.keys(M.pas).forEach(function (k) { n += M.pas[k].length; });
    return { traces: Object.keys(M.pol).length, pastilles: n, pastillesSurCarte: M.g.clientes.getLayers().length, prospectsSurCarte: M.g.prospects.getLayers().length, prospectsVisibles: M.map.hasLayer(M.g.prospects) };
  };

  // ── Styles (DA de l'écran Tournées : mêmes variables ; aucun flou, aucun texte dégradé, aucune opacité sur du texte) ──
  function css() {
    if (document.getElementById('tcm-css')) return;
    var s = document.createElement('style'); s.id = 'tcm-css';
    s.textContent = [
      '.tcm{margin-top:12px}',
      '.tcm-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;margin-bottom:10px;padding:8px 14px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2)}',
      '.tcm-curs{display:flex;align-items:center;gap:10px;flex:1 1 280px;min-width:0;font-size:12.5px;font-weight:700;color:var(--muted)}',
      '.tcm-curs input[type=range]{flex:1;min-width:120px;height:44px;accent-color:var(--ip-blue,#0057FF)}',
      '.tcm-curs-v{min-width:48px;text-align:right;font-size:14px;font-weight:800;color:var(--ip-blue,#0057FF);font-variant-numeric:tabular-nums}',
      '.tcm-n{font-size:13px;font-weight:700;color:var(--ip-ink)}',
      '.tcm-n b{font-size:15px;color:var(--ip-blue,#0057FF);font-variant-numeric:tabular-nums}',
      '.tcm-body{display:flex;gap:14px;height:calc(100vh - 330px);min-height:520px;max-height:860px}',
      '.tcm-map{flex:1 1 auto;min-width:0;border-radius:var(--r-card);overflow:hidden;border:1px solid var(--line-strong);background:#E8ECF3}',
      '.tcm-rail{flex:0 0 min(420px,38%);display:flex;flex-direction:column;min-height:0;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);overflow:hidden}',
      '.tcm-tete{flex:none;padding:14px 16px 10px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:3px}',
      '.tcm-tete b{font-size:16px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink)}',
      '.tcm-tete span{font-size:12.5px;color:var(--muted);line-height:1.4}',
      '.tcm-tete .tcm-note{color:#4B5565}',
      '.tcm-tete .tcm-diff-t{margin-top:4px;color:var(--ip-ink)}.tcm-tete .tcm-diff-t b{font-size:13.5px;font-weight:800;color:var(--ip-blue,#0057FF)}',
      '.tcm-tete .tcm-diff-k{font-size:12.5px;font-weight:700;color:#92400E}',
      '.tcm-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}',
      '.tcm-onglets{flex:none;display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid var(--line)}',
      '.tcm-onglet,.tcm-tri{font:inherit;font-size:13px;font-weight:800;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid var(--line-strong,#c3c9d4);background:var(--card);color:var(--ip-ink);cursor:pointer}',
      '.tcm-onglet{flex:1}',
      '.tcm-onglet.on,.tcm-tri.on{background:var(--ip-blue,#0057FF);border-color:var(--ip-blue,#0057FF);color:#fff}',
      '.tcm-tris{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:10px 16px;border-bottom:1px solid var(--line);font-size:12.5px;font-weight:700;color:var(--muted)}',
      '.tcm-tri{font-size:12.5px;padding:0 10px}',
      '.tcm-liste{display:flex;flex-direction:column}',
      '.tcm-tr,.tcm-ar{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:3px;width:100%;min-height:44px;padding:12px 16px;border-bottom:1px solid var(--line);cursor:pointer}',
      '.tcm-tr:focus-visible,.tcm-ar:focus-visible,.tcm-main:focus-visible{outline:3px solid var(--ip-blue,#0057FF);outline-offset:-3px}',
      '.tcm-ar{display:grid;grid-template-columns:36px 1fr;column-gap:8px;row-gap:3px;align-items:start;border-bottom:0}',
      '.tcm-ar>.tcm-nom,.tcm-ar>.tcm-sub,.tcm-ar>.tcm-ch{grid-column:2}',
      '.tcm-arw{border-bottom:1px solid var(--line)}.tcm-arw.sel{background:#F3F6FD}',
      '.tcm-nom{font-size:13.5px;font-weight:800;color:var(--ip-ink);line-height:1.3}',
      '.tcm-nom .tcm-trait{display:inline-block;width:22px;height:5px;border-radius:3px;margin-right:8px;vertical-align:middle}',
      '.tcm-sub{font-size:12px;color:#4B5565;line-height:1.35}.tcm-sub b{color:var(--ip-ink)}',
      '.tcm-ch{font-size:12px;line-height:1.4;color:#4B5565;font-variant-numeric:tabular-nums}.tcm-ch b{color:var(--ip-ink)}',
      '.tcm-neg,.tcm-neg b{color:#B42318}',
      '.tcm-dt{display:flex;flex-direction:column;gap:4px;padding:12px 16px;border-bottom:1px solid var(--line);background:#F3F6FD}',
      '.tcm-retour{align-self:flex-start;min-height:44px;margin-bottom:4px}',
      '.tcm-ouvrir{min-height:44px;margin-top:6px;align-self:stretch}',
      '.tcm-aide,.tcm-l{font-size:12px;color:#4B5565;line-height:1.4}',
      '.tcm-legd{border-bottom:1px solid var(--line)}',
      '.tcm-legd>summary{list-style:none;cursor:pointer;min-height:44px;display:flex;align-items:center;padding:0 16px;font-size:13px;font-weight:800;color:var(--ip-ink)}',
      '.tcm-legd>summary::-webkit-details-marker{display:none}',
      '.tcm-leg{display:flex;flex-direction:column;gap:6px;padding:0 16px 14px}',
      '.tcm-leg-t{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}',
      '.tcm-lg{display:flex;align-items:center;gap:8px;font-size:12.5px;line-height:1.35;color:var(--ip-ink)}',
      '.tcm-lg i{flex:none;width:12px;height:12px;border-radius:50%}',
      '.tcm-lg i.tcm-ring-m{background:#fff;box-shadow:0 0 0 2.5px #10131C inset}',
      '.tcm-lg i.tcm-ring-r{background:#fff;box-shadow:0 0 0 3px #F59E0B inset}',
      '.tcm-lg i.tcm-cli{background:#fff;box-shadow:0 0 0 3px #7C3AED inset}',
      '.tcm-lg i.tcm-pale{background:#9DB8F2;box-shadow:0 0 0 1px rgba(16,19,28,.18) inset}',
      '.tcm-lg-m{font-size:12px;font-weight:700;color:#B42318}',
      '.tcm-row{border-bottom:1px solid var(--line)}.tcm-row.sel{background:#F3F6FD}',
      '.tcm-main{all:unset;box-sizing:border-box;display:grid;grid-template-columns:14px 1fr;column-gap:10px;row-gap:3px;width:100%;min-height:44px;padding:11px 16px;cursor:pointer;align-items:start}',
      '.tcm-dot{width:12px;height:12px;border-radius:50%;margin-top:4px;box-shadow:0 0 0 1px rgba(16,19,28,.18) inset}',
      '.tcm-main>.tcm-nom,.tcm-main>.tcm-sub,.tcm-main>.tcm-ins,.tcm-main>.tcm-pus{grid-column:2}',
      '.tcm-ins{font-size:12px;font-weight:700;line-height:1.35;color:#1D4ED8}',
      '.tcm-pus{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}',
      '.tcm-pu{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 9px;line-height:1.5}',
      '.tcm-rouge{background:#FDECEA;color:#B42318}.tcm-vert{background:#E3F6EA;color:#0B6B36}.tcm-gris{background:#EEF0F4;color:#4B5565}.tcm-bleu{background:#E6EEFD;color:#1D4ED8}.tcm-mail{background:#E8EAF0;color:#10131C}.tcm-rel{background:#FEF3C7;color:#92400E}.tcm-diff{background:#E6EEFD;color:#1D4ED8}.tcm-diff-att{background:#FEF3C7;color:#92400E}',
      '.tcm-det{padding:2px 16px 14px 36px;display:flex;flex-direction:column;gap:12px;align-items:flex-start}',
      '.tcm-det .v2-btn{min-height:44px}',
      '.tcm-blk{display:flex;flex-direction:column;gap:6px;align-self:stretch}',
      '.tcm-bt{font-size:12px;font-weight:800;color:var(--ip-ink)}',
      '.tcm-ligne{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.tcm-det input[type=date]{font:inherit;font-size:16px;min-height:44px;padding:6px 10px;border:1px solid var(--line-strong,#c3c9d4);border-radius:10px;background:var(--card);color:var(--ip-ink)}',
      '.tcm-l-m{font-weight:700;color:#B42318}',
      '.tcm-warn{font-size:12px;font-weight:700;color:#B42318;background:#FDECEA;border-radius:8px;padding:8px 10px}',
      '.tcm-nr{display:flex;align-items:center;gap:10px;min-height:44px;font-size:13px;font-weight:700;color:var(--ip-ink);cursor:pointer}',
      '.tcm-nr input{width:22px;height:22px;accent-color:#D92D20;flex:none}',
      '.tcm-nr small{font-weight:600;color:#4B5565}',
      '.tcm-vide{padding:22px 16px;font-size:13px;color:var(--muted);text-align:center}',
      '.tcm-plus{margin:12px 16px;min-height:44px}',
      '.tcm-depot-w,.tcm-num-w{background:none;border:none}',
      '.tcm-tr{box-shadow:inset 6px 0 0 var(--tcm-c,transparent);padding-left:20px}',
      '.tcm-num.tcm-grp{box-shadow:0 0 0 2.5px #10131C,0 2px 6px rgba(16,19,28,.35)}',
      '.tcm-ch.tcm-g{display:flex;align-items:center;gap:6px;color:#10131C;font-weight:700}',
      'i.tcm-g-m{flex:none;display:inline-block;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 0 0 2.5px #10131C inset}',
      '.tcm-gtag{grid-column:2;justify-self:start;display:inline-block;margin-top:2px;padding:2px 8px;border-radius:999px;background:#10131C;color:#fff;font-size:11.5px;font-weight:700;line-height:1.4}',
      '.tcm-num{box-sizing:border-box;width:24px;height:24px;border-radius:50%;border:2px solid #fff;color:#fff;font-size:12px;font-weight:800;line-height:20px;text-align:center;box-shadow:0 1px 5px rgba(16,19,28,.45);font-variant-numeric:tabular-nums}',
      '.tcm-petit .tcm-num{transform:scale(.5);font-size:0}',
      '.tcm-gp-w{background:none;border:none}',
      '.tcm-gp{box-sizing:border-box;width:100%;height:28px;padding:0 6px;border-radius:14px;background:#fff;color:#10131C;border:2px solid #10131C;font:800 11px/24px var(--font);text-align:center;white-space:nowrap;box-shadow:0 2px 6px rgba(16,19,28,.3);cursor:pointer}',
      '.tcm-num-l{display:inline-block;grid-row:1/4;width:28px;height:28px;line-height:24px;font-size:13px;flex:none}',
      '.tcm-depot{box-sizing:border-box;width:64px;height:24px;line-height:24px;text-align:center;font-size:11.5px;font-weight:800;color:#fff;background:#10131C;border:2px solid #fff;border-radius:6px;box-shadow:0 3px 10px rgba(16,19,28,.4)}',
      '@media(max-width:760px){',
        '.tcm-body{flex-direction:column;height:auto;min-height:0;max-height:none}',
        '.tcm-map{flex:none;height:340px}',
        '.tcm-rail{flex:none;max-height:none;overflow:visible}',
        '.tcm-scroll{overflow:visible}',
        '.tcm-curs{flex-basis:100%}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
})(typeof window !== 'undefined' ? window : globalThis);

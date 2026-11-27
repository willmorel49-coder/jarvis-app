/* PHIRST · « L'étude de zone » : l'écran (lot F, 25/11/2026). Ouvert depuis la fiche d'une officine (phirst-officines.js), en plein écran par-dessus l'app :
   barre « Retour » + « Imprimer », les 3 feuilles A4 de la maquette « 1 · Le dossier », et la feuille interne qui ne s'imprime jamais.
   Lecture seule : phirst_etudes (tous, téléprospectrice comprise) ; phirst_etudes_sommes SEULEMENT pour un membre (jamais demandée à la téléprospectrice).
   Une lecture qui échoue n'est jamais présentée comme « pas d'étude » : message clair + « Réessayer ». Logique pure et testée : phirst-etude-pur.js. */
(function () {
  'use strict';
  var E = window.PHIRST_ETUDE_PUR, V2 = window.V2;
  if (!E || !V2) return;
  var S = { jeton: 0, carte: null, dernier: null, ouverte: false, cles: null, nom: '', yann: true };
  var IGN = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
  var COUL = { 5: { trait: '#1A3A2E', fond: '#12A567', op: 0.30 }, 10: { trait: '#2F8A5B', fond: '#12A567', op: 0.16 }, 15: { trait: '#5FA37E', fond: '#12A567', op: 0.08 } };

  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }
  function manque(err) { return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(String(err.message || ''))); }
  function estTelepro() { return window.PHIRST_ROLE ? window.PHIRST_ROLE.estTelepro().then(null, function () { return true; }) : Promise.resolve(false); }

  /* ── 1. Y a-t-il une étude pour cette pharmacie ? (légère : ni contours ni pharmacies) ──
     'oui' · 'non' (0 ligne, ou table pas encore posée) · 'erreur' (la lecture a échoué : on ne conclut RIEN). */
  function verifier(cles) {
    var b = sb(), l = (cles || []).filter(Boolean);
    if (!b || !l.length) return Promise.resolve('non');
    return Promise.resolve(b.from('phirst_etudes').select('cle,calcule_le').in('cle', l).limit(1)).then(function (r) {
      if (!r) return 'erreur';
      if (r.error) return manque(r.error) ? 'non' : 'erreur';
      return (r.data || []).length ? 'oui' : 'non';
    }, function () { return 'erreur'; });
  }

  /* ── 2. Lire l'étude (+ les sommes pour un membre) ── */
  function lire(cles) {
    var b = sb(); if (!b) return Promise.resolve({ etat: 'erreur' });
    return Promise.all([estTelepro(), Promise.resolve(b.from('phirst_etudes').select('cle,donnees,calcule_le').in('cle', cles).limit(1))]).then(function (r) {
      var tel = r[0], res = r[1];
      if (!res || res.error) return { etat: res && manque(res.error) ? 'absente' : 'erreur' };
      var ligne = (res.data || [])[0];
      if (!ligne) return { etat: 'absente' };
      var D = ligne.donnees; if (typeof D === 'string') { try { D = JSON.parse(D); } catch (e) { D = null; } }
      if (!D || typeof D !== 'object' || !D.zones) return { etat: 'erreur' };
      if (!D.calcule_le && ligne.calcule_le) { var d = new Date(ligne.calcule_le); if (!isNaN(d)) D.calcule_le = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
      if (tel || S.yann === false) return { etat: 'ok', D: D, sommes: null, yann: false };
      return Promise.resolve(b.from('phirst_etudes_sommes').select('cle,donnees').eq('cle', ligne.cle).limit(1)).then(function (x) {
        var s = x && !x.error && (x.data || [])[0] ? x.data[0].donnees : null;
        if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
        return { etat: 'ok', D: D, sommes: s && typeof s === 'object' ? s : null, yann: true };
      }, function () { return { etat: 'ok', D: D, sommes: null, yann: true }; });
    }, function () { return { etat: 'erreur' }; });
  }

  /* ── 3. La carte (Leaflet est chargé une seule fois, par phirst-officines.js) ── */
  function leaflet(cb) {
    if (window.L) return cb(true);
    if (window.PHIRST_LEAFLET) return window.PHIRST_LEAFLET(cb);
    cb(false);
  }
  function monterCarte(D) {
    var el = document.getElementById('pe-carte'), L = window.L; if (!el || !L) return;
    var P = D.pharmacie || {}, Z = D.zones || {};
    var contours = {}; [15, 10, 5].forEach(function (z) { var zz = Z[z] || Z[String(z)]; if (zz && zz.contour && zz.contour.length > 2) contours[z] = zz.contour; });
    var tactile = !!(L.Browser && L.Browser.mobile);
    var m = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, zoomSnap: 0.25, dragging: !tactile, touchZoom: !tactile, doubleClickZoom: !tactile, boxZoom: false, keyboard: false });
    L.tileLayer(IGN, { maxZoom: 18, opacity: 0.5 }).addTo(m);
    var couches = {};
    [15, 10, 5].forEach(function (z) {
      if (!contours[z]) return;
      couches[z] = L.polygon(contours[z].map(function (c) { return [c[1], c[0]]; }), { color: COUL[z].trait, weight: z === 5 ? 2.2 : 1.6, fillColor: COUL[z].fond, fillOpacity: COUL[z].op, opacity: 1, interactive: false, className: 'pe-zone pe-zone-' + z }).addTo(m);
    });
    (D.pharmacies || []).forEach(function (p) {
      if (p.est_etudiee || typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
      L.circleMarker([p.lat, p.lon], { radius: 4.5, weight: 1.5, color: '#1A3A2E', fillColor: '#FFFFFF', fillOpacity: 1, interactive: false, className: 'pe-ph' }).addTo(m);
    });
    var cadre = couches[15] || couches[10] || couches[5], ici = null;
    if (typeof P.lat === 'number' && typeof P.lon === 'number') {
      ici = L.marker([P.lat, P.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'pe-ici', html: '<span class="pe-ici-point"></span><span class="pe-ici-nom">' + E.esc(P.nom || 'Pharmacie') + '</span>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(m);
      if (!cadre) m.setView([P.lat, P.lon], 13);
    }
    // L'étiquette du nom reste dans la carte : à droite du point si elle tient, sinon à gauche, sinon sur plusieurs lignes (E.placeNom).
    function placerNom() {
      var el = ici && ici.getElement(), nom = el && el.querySelector('.pe-ici-nom'); if (!nom) return;
      nom.classList.remove('pe-ici-g', 'pe-ici-2l'); nom.style.width = '';
      var r = E.placeNom(m.latLngToContainerPoint(ici.getLatLng()).x, m.getSize().x, nom.offsetWidth);
      if (r.cote === 'g') nom.classList.add('pe-ici-g');
      if (r.max) { nom.classList.add('pe-ici-2l'); nom.style.width = r.max + 'px'; }
    }
    function cadrer() { m.invalidateSize(false); if (cadre) m.fitBounds(cadre.getBounds(), { padding: [18, 18], animate: false }); placerNom(); }
    m.on('moveend resize', placerNom);
    cadrer();
    S.carte = { map: m, cadrer: cadrer, ici: ici };
  }
  function demonterCarte() { if (S.carte) { try { S.carte.map.remove(); } catch (e) { /* déjà démontée */ } S.carte = null; } }
  function demonterM1() { if (S.m1) { try { S.m1.demonter(); } catch (e) { /* déjà démontée */ } S.m1 = null; } }

  /* ── 3 bis. L'étude enrichie (27/11/2026, maquette m1 « Le dossier vivant », choix de Will ; même calcul et même rendu que JARVIS).
     Seau PRIVÉ etudes-zone : sans-sommes/<version>/<finess>.json.gz pour tous ; sommes/<version>/<finess>.json.gz SEULEMENT pour un
     membre en vue Yann (jamais demandé pour la téléprospectrice), recollés dans le navigateur (ETUDE_M1.recoller = decouper.recoller).
     Le FINESS vient de phirst_etudes. Rend { e, vue } ou null (module, fichier ou lecture absents) : l'ancienne étude s'affiche alors. */
  function chargerM1(cb) {
    var pret = function () { try { window.ETUDE_M1.pret(function (ok) { cb(!!ok); }); } catch (e) { cb(false); } };
    if (window.ETUDE_M1) return pret();
    cb(false);
  }
  function lireEnrichie(cles) {
    var b = sb(); if (!b || !b.storage || !cles || !cles.length) return Promise.resolve(null);
    return new Promise(function (ok) { chargerM1(ok); }).then(function (m1) {
      var M = window.ETUDE_M1; if (!m1 || !M || !M.VERSION_DONNEES) return null;
      return Promise.all([estTelepro(), Promise.resolve(b.from('phirst_etudes').select('cle,finess').in('cle', cles).limit(1))]).then(function (r) {
        var sansSommes = r[0] || S.yann === false, l = r[1] && !r[1].error && (r[1].data || [])[0], f = l ? String(l.finess || '') : '';
        if (!/^[0-9][0-9AB][0-9]{7}$/.test(f)) return null;
        function lireGz(dossier) {
          return Promise.resolve(b.storage.from('etudes-zone').download(dossier + '/' + M.VERSION_DONNEES + '/' + f + '.json.gz')).then(function (x) {
            if (!x || x.error || !x.data) return null;
            return x.data.arrayBuffer().then(M.degonfler);
          });
        }
        return lireGz('sans-sommes').then(function (sans) {
          if (!sans || !sans.meta || !sans.zones || !sans.reponses) return null;
          if (sansSommes) return { e: sans, vue: 'telepro' };
          // sommes illisibles pour un membre : l'étude s'affiche quand même, sans aucun montant (vue sans sommes)
          return lireGz('sommes').then(function (som) { return som ? { e: M.recoller(sans, som), vue: 'yann' } : { e: sans, vue: 'telepro' }; },
                                       function () { return { e: sans, vue: 'telepro' }; });
        });
      });
    }).then(null, function () { return null; });
  }
  function monterM1(x) {
    var c = corps(); c.innerHTML = '<div data-pe-m1></div>';
    var b = document.querySelector('#pe [data-pe-imprimer]'); if (b) b.hidden = true;   // l'étude enrichie a ses deux boutons (résumé, dossier complet)
    var nom = document.querySelector('#pe [data-pe-nom]'); if (nom && x.e.meta.nom) nom.textContent = x.e.meta.nom;
    S.m1 = window.ETUDE_M1.monter(c.firstChild, x.e, { vue: x.vue, defile: document.getElementById('pe') });
  }
  window.addEventListener('beforeprint', function () { if (S.ouverte && S.carte) S.carte.cadrer(); });
  window.addEventListener('afterprint', function () { if (S.ouverte && S.carte) S.carte.cadrer(); });

  /* ── 4. Le plein écran ── */
  function monter() {
    var pe = document.getElementById('pe'); if (pe) return pe;
    pe = document.createElement('div'); pe.id = 'pe'; pe.hidden = true; pe.setAttribute('role', 'dialog'); pe.setAttribute('aria-modal', 'true'); pe.setAttribute('aria-label', 'Étude de zone'); pe.setAttribute('tabindex', '-1');
    pe.innerHTML = '<div class="pe-barre"><button type="button" data-pe-retour>‹ Retour</button><span class="pe-nom" data-pe-nom></span><button type="button" class="pe-plein" data-pe-imprimer hidden>Imprimer</button></div><div class="pe-corps" data-pe-corps></div>';
    document.body.appendChild(pe);
    pe.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t.closest('[data-pe-retour]')) return fermer();
      if (t.closest('[data-pe-imprimer]')) return window.print();
      if (t.closest('[data-pe-reessayer]')) return charger();
    });
    // En phase de capture : Échap ferme l'étude et rien d'autre (sinon la fiche posée sur la carte se fermerait aussi, mesuré le 25/11/2026).
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && S.ouverte) { ev.stopImmediatePropagation(); fermer(); } }, true);
    window.addEventListener('hashchange', function () { if (S.ouverte) fermer(true); });
    return pe;
  }
  function corps() { return document.querySelector('#pe [data-pe-corps]'); }
  function dire(html, reessayer) {
    var c = corps(); if (!c) return;
    c.innerHTML = '<div class="pe-etat" role="status">' + html + (reessayer ? '<button type="button" data-pe-reessayer>Réessayer</button>' : '') + '</div>';
    var b = document.querySelector('#pe [data-pe-imprimer]'); if (b) b.hidden = true;
  }
  function charger() {
    var tok = ++S.jeton; demonterCarte(); demonterM1();
    dire('<p>L’étude de zone arrive…</p>');
    lireEnrichie(S.cles).then(function (x) {
      if (tok !== S.jeton || !S.ouverte) return;
      if (x) { try { monterM1(x); return; } catch (e) { demonterM1(); } }
      chargerAncienne(tok);
    });
  }
  // L'ancienne étude (les deux tables d'études, 3 feuilles A4) : le secours quand l'étude enrichie manque.
  function chargerAncienne(tok) {
    lire(S.cles).then(function (r) {
      if (tok !== S.jeton || !S.ouverte) return;
      if (r.etat === 'absente') return dire('<p>L’étude de zone de cette pharmacie n’est pas encore prête.</p>');
      if (r.etat !== 'ok') return dire('<p>L’étude de zone n’a pas pu être lue. Vérifiez votre connexion puis réessayez.</p>', true);
      var html;
      try { html = E.feuilles(r.D, r.sommes, { yann: r.yann }); } catch (e) { return dire('<p>Cette étude est incomplète : elle ne peut pas s’afficher. Elle sera recalculée.</p>'); }
      corps().innerHTML = html;
      var b = document.querySelector('#pe [data-pe-imprimer]'); if (b) b.hidden = false;
      var nom = document.querySelector('#pe [data-pe-nom]'); if (nom) nom.textContent = (r.D.pharmacie && r.D.pharmacie.nom) || '';
      leaflet(function (ok) {
        if (tok !== S.jeton || !S.ouverte) return;
        if (!ok) { var c = document.getElementById('pe-carte'); if (c) c.innerHTML = '<p class="pe-etat">La carte n’a pas pu se charger. Le reste de l’étude est complet.</p>'; return; }
        try { monterCarte(r.D); } catch (e) { var c2 = document.getElementById('pe-carte'); if (c2) c2.innerHTML = '<p class="pe-etat">La carte n’a pas pu s’afficher. Le reste de l’étude est complet.</p>'; }
      });
    });
  }
  /* cles : toutes les clés de la fiche (la bonne est celle de la ligne « toutes ») ; opts : { nom, yann } */
  function ouvrir(cles, opts) {
    opts = opts || {};
    var pe = monter();
    S.cles = (cles || []).filter(Boolean); S.nom = opts.nom || ''; S.yann = opts.yann !== false; S.dernier = document.activeElement; S.ouverte = true;
    document.querySelector('#pe [data-pe-nom]').textContent = S.nom;
    pe.hidden = false; document.body.classList.add('pe-ouvert');
    var c = corps(); if (c) c.scrollTop = 0; pe.scrollTop = 0;
    try { pe.focus({ preventScroll: true }); } catch (e) { pe.focus(); }
    charger();
  }
  function fermer(sansFocus) {
    var pe = document.getElementById('pe'); if (!pe || !S.ouverte) return;
    S.jeton++; S.ouverte = false; demonterCarte(); demonterM1(); pe.hidden = true; document.body.classList.remove('pe-ouvert');
    var c = corps(); if (c) c.innerHTML = '';
    if (sansFocus !== true) {
      var cible = S.dernier && document.contains(S.dernier) ? S.dernier : document.querySelector('.pe-ouvre'); // la fiche a pu être redessinée : on retrouve son bouton
      if (cible && cible.focus) try { cible.focus({ preventScroll: true }); } catch (e) { /* rien à refocaliser */ }
    }
  }
  window.PHIRST_ETUDE = { verifier: verifier, ouvrir: ouvrir, fermer: fermer };
})();

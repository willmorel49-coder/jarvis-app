/* ════════════════════════════════════════════════════════════════
   Écran « Documents » d'une app de groupement (option B, étape 6, 26/11/2026).
   Commun à toutes les apps de groupement ; activé seulement si le réglage
   (groupements/config/<id>.js) porte un bloc `documents`. OPSO n'en a pas :
   l'écran n'existe pas chez lui (ni route, ni tuile, ni ⌘K).

   Mécanique = celle des documents privés de JARVIS (crm/v2/v2-boot.js,
   DOCS_PROTEGES / V2.ouvrirDocProtege) : chaque document du réglage y est
   inscrit avec son chemin dans le seau privé, puis ouvert par la même
   fonction (onglet ouvert AVANT l'appel réseau, .html rendu par un blob,
   fichier téléchargé par une iframe invisible).

   Accès : décidé par le SERVEUR (fonction nommée dans `accesServeur`) ; un
   compte refusé voit « Documents indisponibles pour ce compte », jamais un
   bouton qui ne mène à rien. Sans réponse du serveur : les boutons restent
   (un contrôle qui échoue ne condamne rien ; l'ouverture dira elle-même
   « Document indisponible »).

   Dates « prix au », « valables jusqu'au » et du tarif relevé : LUES dans le
   fichier protégé `dates` du réglage (clés date_prix, valide_jusqua,
   date_tarif_releve), jamais écrites dans ce dépôt public.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var G = window.V2_GROUPEMENT;
  var CFG = G && G.documents;
  if (!CFG || !CFG.groupes || !CFG.groupes.length || !V2.pages) return;

  var ROUTE = 'docsgroupement';
  var SEAU = 'donnees-protegees';
  var dossier = String(CFG.dossier || '');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ico(n, s) { return (typeof window.ICO === 'function') ? window.ICO(n, s) : ''; }

  // Inscription des documents dans la liste des documents privés du socle (même objet que DOCS_PROTEGES).
  var nbDocs = 0;
  function inscrire() {
    if (!V2.docsProteges) return false;
    CFG.groupes.forEach(function (g) {
      (g.docs || []).forEach(function (d) {
        V2.docsProteges[d.cle] = { fichier: dossier + d.fichier, titre: d.titre, type: d.type };
      });
    });
    return true;
  }
  CFG.groupes.forEach(function (g) { nbDocs += (g.docs || []).length; });
  inscrire();

  // ── État : accès serveur + fichier des dates, lus une fois par session ──
  // acces : null = pas encore su (ou serveur muet), true, false.
  var _etat = { pret: false, enCours: false, acces: null, dates: null };
  var _prom = null;
  var _produits = null;   // contenu du fichier `dates` (aussi lu par la page des produits, étape 7)

  function client() { return (V2.sb && V2.sb()) || null; }

  function lireAcces(c) {
    if (!CFG.accesServeur || !c.rpc) return Promise.resolve(null);
    return Promise.resolve(c.rpc(CFG.accesServeur)).then(function (r) {
      if (!r || r.error) return null;
      return r.data === true;
    }).catch(function () { return null; });
  }
  function lireProduits(c) {
    if (_produits) return Promise.resolve(_produits);
    if (!CFG.dates || !c.storage) return Promise.resolve(null);
    return c.storage.from(SEAU).download(dossier + CFG.dates).then(function (r) {
      if (!r || r.error || !r.data) return null;
      return r.data.text();
    }).then(function (t) {
      if (!t) return null;
      var j = JSON.parse(t);
      if (j && typeof j === 'object') _produits = j;
      return _produits;
    }).catch(function (e) {
      try { console.warn('[documents] fichier des dates illisible :', e && e.message); } catch (x) {}
      return null;
    });
  }

  // Tout autre fichier JSON privé du même dossier (étape 8 : reco-produits.json) : même seau, même lecture, une fois par session.
  var _fichiers = {};
  function lireFichier(c, nom) {
    if (_fichiers[nom]) return Promise.resolve(_fichiers[nom]);
    if (!nom || !c.storage) return Promise.resolve(null);
    return c.storage.from(SEAU).download(dossier + nom).then(function (r) {
      if (!r || r.error || !r.data) return null;
      return r.data.text();
    }).then(function (t) {
      if (!t) return null;
      var j = JSON.parse(t);
      if (j && typeof j === 'object') _fichiers[nom] = j;
      return _fichiers[nom] || null;
    }).catch(function (e) {
      try { console.warn('[documents] fichier illisible (' + nom + ') :', e && e.message); } catch (x) {}
      return null;
    });
  }

  function charger() {
    if (_etat.pret) return Promise.resolve(_etat);
    if (_prom) return _prom;
    var c = client();
    if (!c) { _etat.pret = true; return Promise.resolve(_etat); }
    _etat.enCours = true;
    _prom = lireAcces(c).then(function (a) {
      _etat.acces = a;
      if (a === false) return null;
      return lireProduits(c);
    }).then(function (p) {
      if (p) {
        _etat.dates = {
          prix: p.date_prix ? String(p.date_prix) : '',
          jusqua: p.valide_jusqua ? String(p.valide_jusqua) : '',
          tarif: p.date_tarif_releve ? String(p.date_tarif_releve) : ''
        };
      }
      _etat.pret = true; _etat.enCours = false;
      return _etat;
    }).catch(function () { _etat.pret = true; _etat.enCours = false; return _etat; });
    return _prom;
  }

  // ── Rendu ──
  function ligneDates() {
    if (!_etat.pret) return '<span class="gdoc-dates gdoc-attente">Lecture des dates des prix…</span>';
    var d = _etat.dates;
    if (!d || !d.prix) return '';
    var t = 'Prix au <b class="gdoc-d">' + esc(d.prix) + '</b>';
    if (d.jusqua) t += ', valables jusqu\'au <b class="gdoc-d">' + esc(d.jusqua) + '</b>';
    if (d.tarif) t += ' · tarif Intégral Pharma relevé le ' + esc(d.tarif);
    return '<span class="gdoc-dates">' + t + '.</span>';
  }
  function bouton(d) {
    return '<button type="button" class="gdoc-btn" data-doc="' + esc(d.cle) + '" onclick="V2.ouvrirDocProtege(\'' + esc(d.cle) + '\')">' +
      '<span class="gdoc-fmt">' + esc(d.format || '') + '</span><span class="gdoc-btn-t">' + esc(d.bouton || d.titre) + '</span>' +
      '<span class="gdoc-fl" aria-hidden="true">' + ico(d.type === 'fichier' ? 'download' : 'chev', 16) + '</span></button>';
  }
  function carte(g) {
    return '<section class="gdoc-carte">' +
      '<div class="gdoc-ico" aria-hidden="true">' + ico('fiche', 22) + '</div>' +
      '<h2 class="gdoc-t">' + esc(g.titre) + '</h2>' +
      (g.d ? '<p class="gdoc-p">' + esc(g.d) + '</p>' : '') +
      '<div class="gdoc-actions">' + (g.docs || []).map(bouton).join('') + '</div>' +
    '</section>';
  }
  function render(root) {
    inscrire();
    var refuse = _etat.pret && _etat.acces === false;
    var corps = refuse
      ? '<div class="gdoc-refus" role="status"><b>Documents indisponibles pour ce compte.</b><span>Ils sont réservés aux comptes du groupement ' + esc(G.nom || '') + '.</span></div>'
      : '<div class="gdoc-grille">' + CFG.groupes.map(carte).join('') + '</div>';
    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page gdoc-page">' +
        '<div class="opx-head"><div class="v2-page-title">Documents</div>' +
          '<div class="opx-sub">' + (refuse ? '' : ligneDates()) + '</div></div>' +
        corps +
      '</div>';
    if (!_etat.pret) {
      charger().then(function () {
        if (V2.route && V2.route.name === ROUTE) { var r = document.getElementById('v2-root'); if (r) render(r); }
      });
    }
  }

  V2.pages[ROUTE] = { needs: [], render: render };

  // Lu par l'accueil (tuile, ⌘K) et, à l'étape 7, par la page des produits.
  V2.groupementDocs = {
    route: ROUTE,
    nb: nbDocs,
    tuile: CFG.tuile || '',
    tuileCourte: CFG.tuileCourte || '',
    palette: CFG.palette || 'Documents',
    charger: charger,
    produits: function () { var c = client(); return c ? lireProduits(c) : Promise.resolve(null); },
    fichier: function (nom) { var c = client(); return c ? lireFichier(c, nom) : Promise.resolve(null); },
    etat: function () { return _etat; }
  };
})();

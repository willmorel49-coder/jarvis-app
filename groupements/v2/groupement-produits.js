/* ════════════════════════════════════════════════════════════════
   Page « Vos produits et nos prix nets » d'une app de groupement
   (option B, étape 7, 26/11/2026). Commune à toutes les apps de groupement ;
   activée seulement si le réglage (groupements/config/<id>.js) porte un bloc
   `produits` ET un bloc `documents` (l'écran Documents fournit l'accès et le
   fichier). OPSO n'en a pas : ni route, ni tuile, ni ⌘K chez lui.

   Données : V2.groupementDocs.produits() = contenu du fichier protégé
   `produits-app.json` (seau privé, dossier du réglage ; verrou serveur).
   Aucun chiffre ni aucune date dans ce dépôt public : les totaux affichés sont
   RECALCULÉS sur les lignes du fichier (ce qui est montré = ce qui est mesuré).

   Règles d'affichage (skill pharma-metier) : « abandon de marge », jamais
   « remise » ; génériques = prix libre (net = PPHT écrit en clair, aucun %,
   « — » pour l'abandon) ; un produit ajouté sans achat relevé n'a pas de
   volume (« — », jamais 0).

   « Partager » : le catalogue adhérents (document du réglage `partage.cle`),
   lu dans le seau puis remis à V2.shareOrSaveBlob (feuille de partage, ou
   encadré « Le PDF est prêt » quand Safari refuse le partage différé).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var G = window.V2_GROUPEMENT;
  var CFG = G && G.produits;
  if (!CFG || !G.documents || !V2.pages || !V2.groupementDocs) return;

  var ROUTE = 'produitsgroupement';
  var DOCS = V2.groupementDocs;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ico(n, s) { return (typeof window.ICO === 'function') ? window.ICO(n, s) : ''; }
  var fE = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fN = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var fP = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  function euros(v) { return fE.format(v) + ' €'; }
  function nb(v) { return fN.format(v); }
  function pct(f) { return fP.format(f * 100) + ' %'; }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // ── Calcul pur (testé : tests/groupement-produits.test.mjs) ──
  // Totaux recalculés sur les lignes : produits, achetés (boîtes > 0), boîtes, abandon de marge 12 mois, montant au PPHT.
  function totaux(lignes) {
    var t = { produits: 0, achetes: 0, boites: 0, abandon: 0, ppht: 0 };
    (lignes || []).forEach(function (l) {
      var b = num(l.boites) || 0;
      t.produits++;
      if (b > 0) t.achetes++;
      t.boites += b;
      t.abandon += num(l.abandon_12m) || 0;
      t.ppht += (num(l.ppht) || 0) * b;
    });
    // au centime, comme le fichier (sommes de montants déjà arrondis)
    t.abandon = Math.round(t.abandon * 100) / 100;
    t.ppht = Math.round(t.ppht * 100) / 100;
    return t;
  }
  // Écart avec les totaux écrits dans le fichier (clés du fichier) : liste vide = tout concorde.
  function ecarts(t, f) {
    if (!f) return ['totaux absents du fichier'];
    var e = [];
    if (f.produits !== t.produits) e.push('produits');
    if (f.produits_achetes !== t.achetes) e.push('achetés');
    if (f.boites !== t.boites) e.push('boîtes');
    if (Math.abs((f.abandon_12m || 0) - t.abandon) > 0.005) e.push('abandon de marge');
    if (Math.abs((f.montant_ppht || 0) - t.ppht) > 0.005) e.push('PPHT');
    return e;
  }
  var TRIS = {
    abandon: function (a, b) { return (num(b.abandon_12m) || 0) - (num(a.abandon_12m) || 0) || (num(b.boites) || 0) - (num(a.boites) || 0) || alpha(a, b); },
    boites: function (a, b) { return (num(b.boites) || 0) - (num(a.boites) || 0) || alpha(a, b); },
    alpha: alpha
  };
  function alpha(a, b) { return String(a.designation || '').localeCompare(String(b.designation || ''), 'fr'); }
  function filtrer(lignes, cat, q) {
    var n = norm(q).trim();
    return (lignes || []).filter(function (l) {
      if (cat && cat !== 'all' && l.cat !== cat) return false;
      if (!n) return true;
      return norm(l.designation).indexOf(n) >= 0 || norm(l.labo).indexOf(n) >= 0 || String(l.cip || '').indexOf(n) >= 0;
    });
  }

  // ── État de l'écran ──
  var _cat = 'all', _q = '', _tri = 'abandon';
  var _data = null, _lu = false, _enCours = false;
  var _partage = false;

  function charger() {
    if (_lu || _enCours) return;
    _enCours = true;
    Promise.resolve(DOCS.charger()).then(function (etat) {
      if (etat && etat.acces === false) return null;
      return DOCS.produits();
    }).then(function (p) {
      _data = (p && p.lignes && p.lignes.length) ? p : null;
      if (_data) {
        var e = ecarts(totaux(_data.lignes), _data.totaux);
        if (e.length) { try { console.warn('[produits] totaux du fichier différents du recalcul :', e.join(', ')); } catch (x) {} }
      }
    }).catch(function () { _data = null; }).then(function () {
      _lu = true; _enCours = false;
      redessiner();
    });
  }
  function redessiner() {
    if (V2.route && V2.route.name === ROUTE) { var r = document.getElementById('v2-root'); if (r) render(r); }
  }
  function gardeFocus(fn) {
    var a = document.activeElement, id = a && a.id, deb = a && a.selectionStart, fin = a && a.selectionEnd;
    fn();
    if (id) { var n = document.getElementById(id); if (n) { n.focus(); try { if (deb != null) n.setSelectionRange(deb, fin); } catch (e) {} } }
  }

  // ── Rendu ──
  function ligneDates(d) {
    if (!d || !d.date_prix) return '';
    var t = 'Prix au <b class="gprod-d">' + esc(d.date_prix) + '</b>';
    if (d.valide_jusqua) t += ', valables jusqu\'au <b class="gprod-d">' + esc(d.valide_jusqua) + '</b>';
    if (d.date_tarif_releve) t += ' · tarif Intégral Pharma relevé le ' + esc(d.date_tarif_releve);
    return '<span class="gprod-dates">' + t + '.</span>';
  }
  function chiffres(t) {
    function c(v, l, cls) { return '<div class="gprod-k' + (cls ? ' ' + cls : '') + '"><b class="gprod-kv">' + v + '</b><span class="gprod-kl">' + esc(l) + '</span></div>'; }
    return '<div class="gprod-ks">' +
      c(nb(t.produits), 'produits') +
      c(nb(t.achetes), 'achetés sur 12 mois') +
      c(nb(t.boites), 'boîtes sur 12 mois') +
      c(euros(t.ppht), 'achats au PPHT') +
      c(euros(t.abandon), 'd\'abandon de marge sur 12 mois', 'is-fort') +
    '</div>';
  }
  function generique(l) { return l.cat === 'generiques' || num(l.abandon_boite) == null; }
  function ligne(l) {
    var b = num(l.boites), gen = generique(l);
    var aban = gen ? '<span class="gprod-vide" title="Prix libre : aucun abandon de marge">—</span>'
      : '<b>' + euros(l.abandon_boite) + '</b>' + (num(l.abandon_pct) != null ? '<small>' + pct(l.abandon_pct) + '</small>' : '');
    var a12 = (!gen && num(l.abandon_12m) && b) ? '<b>' + euros(l.abandon_12m) + '</b>' : '<span class="gprod-vide">—</span>';
    var rq = l.remarque ? '<span class="gprod-rq' + (l.ajout ? ' is-ajout' : '') + '">' + esc(l.remarque) + '</span>' : '';
    return '<div class="gprod-li" role="row">' +
      '<div class="gprod-c gprod-nom" role="cell"><b class="gprod-n">' + esc(l.designation) + '</b>' +
        '<span class="gprod-m">' + esc(l.labo || '') + (l.cip ? ' · CIP ' + esc(l.cip) : '') + '</span>' + rq + '</div>' +
      '<div class="gprod-c gprod-num" role="cell" data-l="Boîtes 12 mois">' + (b ? '<b>' + nb(b) + '</b>' : '<span class="gprod-vide" title="Aucun achat relevé">—</span>') + '</div>' +
      '<div class="gprod-c gprod-num" role="cell" data-l="PPHT"><b>' + euros(l.ppht) + '</b></div>' +
      '<div class="gprod-c gprod-num gprod-net" role="cell" data-l="Prix net"><b>' + euros(l.net) + '</b></div>' +
      '<div class="gprod-c gprod-num" role="cell" data-l="Abandon/boîte">' + aban + '</div>' +
      '<div class="gprod-c gprod-num" role="cell" data-l="Abandon/12 mois">' + a12 + '</div>' +
    '</div>';
  }
  function entete() {
    return '<div class="gprod-li gprod-th" role="row">' +
      '<div class="gprod-c gprod-nom" role="columnheader">Produit</div>' +
      '<div class="gprod-c gprod-num" role="columnheader">Boîtes 12 mois</div>' +
      '<div class="gprod-c gprod-num" role="columnheader">PPHT</div>' +
      '<div class="gprod-c gprod-num" role="columnheader">Prix net</div>' +
      '<div class="gprod-c gprod-num" role="columnheader">Abandon par boîte</div>' +
      '<div class="gprod-c gprod-num" role="columnheader">Abandon 12 mois</div>' +
    '</div>';
  }
  function section(titre, lignes) {
    var t = totaux(lignes);
    var resume = nb(t.produits) + ' produit' + (t.produits > 1 ? 's' : '') +
      (t.boites ? ' · ' + nb(t.boites) + ' boîtes' : '') +
      (t.abandon ? ' · ' + euros(t.abandon) + ' d\'abandon de marge' : '');
    return '<section class="gprod-sec">' +
      '<div class="gprod-sec-h"><h2 class="gprod-sec-t">' + esc(titre) + '</h2><span class="gprod-sec-r">' + resume + '</span></div>' +
      '<div class="gprod-table" role="table" aria-label="' + esc(titre) + '">' + entete() + lignes.map(ligne).join('') + '</div>' +
    '</section>';
  }
  function corps(d) {
    // Clé de catégorie insérée dans un onclick : lettres, chiffres, tiret seulement (revue de sécurité du 26/11/2026 ;
    // esc() ne protège pas une chaîne JS dans un attribut, l'apostrophe y redevient une apostrophe).
    var cats = (d.categories || []).filter(function (c) { return c && /^[a-z0-9_-]+$/i.test(String(c.cle || '')); });
    var lignes = d.lignes;
    var parCat = {};
    lignes.forEach(function (l) { parCat[l.cat] = (parCat[l.cat] || 0) + 1; });
    var onglets = '<button type="button" class="v2-tab' + (_cat === 'all' ? ' on' : '') + '" onclick="V2.gprodCat(\'all\')">Tous<em>' + lignes.length + '</em></button>' +
      cats.map(function (c) {
        return '<button type="button" class="v2-tab' + (_cat === c.cle ? ' on' : '') + '" onclick="V2.gprodCat(\'' + esc(c.cle) + '\')">' + esc(c.titre) + '<em>' + (parCat[c.cle] || 0) + '</em></button>';
      }).join('');
    var choix = '<select class="v2-field opx-tabsel" aria-label="Catégorie" onchange="V2.gprodCat(this.value)">' +
      '<option value="all"' + (_cat === 'all' ? ' selected' : '') + '>Toutes les catégories · ' + lignes.length + '</option>' +
      cats.map(function (c) { return '<option value="' + esc(c.cle) + '"' + (_cat === c.cle ? ' selected' : '') + '>' + esc(c.titre) + ' · ' + (parCat[c.cle] || 0) + '</option>'; }).join('') +
    '</select>';
    var outils = '<div class="gprod-outils">' +
      '<label class="gprod-cherche"><span class="gprod-cherche-ic" aria-hidden="true">' + ico('search', 17) + '</span>' +
        '<input id="gprod-q" class="v2-field" type="search" autocomplete="off" placeholder="Produit, laboratoire ou CIP" aria-label="Chercher un produit" value="' + esc(_q) + '" oninput="V2.gprodCherche(this.value)"></label>' +
      '<select class="v2-field gprod-tri" aria-label="Trier" onchange="V2.gprodTri(this.value)">' +
        '<option value="abandon"' + (_tri === 'abandon' ? ' selected' : '') + '>Trier par abandon de marge</option>' +
        '<option value="boites"' + (_tri === 'boites' ? ' selected' : '') + '>Trier par boîtes achetées</option>' +
        '<option value="alpha"' + (_tri === 'alpha' ? ' selected' : '') + '>Ordre alphabétique</option>' +
      '</select></div>';

    var vus = filtrer(lignes, _cat, _q).sort(TRIS[_tri] || TRIS.abandon);
    var liste;
    if (!vus.length) {
      liste = '<p class="gprod-rien" role="status">Aucun produit ne correspond à « ' + esc(_q) + ' ».</p>';
    } else if (_q.trim()) {
      liste = section(nb(vus.length) + ' résultat' + (vus.length > 1 ? 's' : ''), vus);
    } else {
      liste = cats.filter(function (c) { return _cat === 'all' || _cat === c.cle; }).map(function (c) {
        var l = vus.filter(function (x) { return x.cat === c.cle; });
        return l.length ? section(c.titre, l) : '';
      }).join('');
    }
    return chiffres(totaux(lignes)) +
      '<div class="v2-tabs opx-tabs gprod-tabs" role="tablist">' + onglets + '</div>' + choix +
      outils +
      '<div class="gprod-liste">' + liste + '</div>' +
      '<p class="gprod-note">' + esc(CFG.note || '') + '</p>';
  }
  function boutonPartage() {
    var p = CFG.partage;
    if (!p || !p.cle) return '';
    return '<button type="button" class="v2-btn v2-btn-primary gprod-partage" id="gprod-partage" onclick="V2.gprodPartager()"' + (_partage ? ' disabled aria-busy="true"' : '') + '>' +
      '<span>' + esc(_partage ? 'Préparation du PDF…' : (p.bouton || 'Partager')) + '</span></button>';
  }
  function render(root) {
    var refuse = DOCS.etat && DOCS.etat().pret && DOCS.etat().acces === false;
    var contenu;
    if (refuse) {
      contenu = '<div class="gdoc-refus" role="status"><b>Produits indisponibles pour ce compte.</b><span>Ils sont réservés aux comptes du groupement ' + esc(G.nom || '') + '.</span></div>';
    } else if (!_lu) {
      contenu = '<p class="gprod-attente" role="status">Lecture de vos produits…</p>';
    } else if (!_data) {
      contenu = '<div class="gdoc-refus" role="status"><b>Le fichier des produits n\'a pas pu être lu.</b>' +
        '<span><button type="button" class="v2-btn v2-btn-ghost" onclick="V2.gprodRelire()">Réessayer</button></span></div>';
    } else {
      contenu = corps(_data);
    }
    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page gprod-page">' +
        '<div class="opx-head gprod-head"><div class="gprod-head-t"><div class="v2-page-title">' + esc(CFG.titre || 'Vos produits et nos prix nets') + '</div>' +
          '<div class="opx-sub">' + (_data ? ligneDates(_data) : '') + '</div></div>' +
          (refuse ? '' : boutonPartage()) + '</div>' +
        contenu +
      '</div>';
    if (!_lu) charger();
  }

  V2.gprodCat = function (k) { _cat = k || 'all'; redessiner(); };
  V2.gprodTri = function (k) { _tri = TRIS[k] ? k : 'abandon'; redessiner(); };
  V2.gprodCherche = function (v) { _q = v || ''; gardeFocus(redessiner); };
  V2.gprodRelire = function () { _lu = false; _data = null; redessiner(); };
  V2.gprodPartager = function () {
    var p = CFG.partage;
    if (!p || _partage || !V2.docProtegeFichier) return;
    _partage = true; redessiner();
    var date = (_data && _data.date_prix) ? String(_data.date_prix).replace(/\//g, '-') : '';
    var nom = (p.nomFichier || 'Catalogue') + (date ? ' - ' + date : '') + '.pdf';
    Promise.resolve(V2.docProtegeFichier(p.cle)).then(function (f) {
      if (!f) throw new Error('fichier absent');
      return V2.shareOrSaveBlob(f, nom, p.titre || nom);
    }).catch(function () {
      if (V2.toast) V2.toast('Catalogue indisponible pour le moment. Réessayez dans un instant.');
    }).then(function () { _partage = false; redessiner(); });
  };

  V2.pages[ROUTE] = { needs: [], render: render };

  // Lu par l'accueil (tuile, ⌘K) et par le tableau de bord (ligne courte).
  V2.groupementProduits = {
    route: ROUTE,
    tuile: CFG.tuile || '',
    tuileCourte: CFG.tuileCourte || '',
    palette: CFG.palette || 'Produits',
    titre: CFG.titre || 'Vos produits et nos prix nets',
    // exposés pour le banc d'essai (calcul pur)
    _totaux: totaux, _ecarts: ecarts, _filtrer: filtrer, _tris: TRIS
  };
})();

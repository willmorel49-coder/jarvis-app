/* ════════════════════════════════════════════════════════════════
   Page « Reco produits » d'une app de groupement (option B, étape 8, 26/11/2026).
   Commune à toutes les apps de groupement ; activée seulement si le réglage
   (groupements/config/<id>.js) porte un bloc `reco` ET un bloc `documents`
   (l'écran Documents fournit l'accès serveur et la lecture du seau privé).
   OPSO n'en a pas : ni route, ni tuile, ni ⌘K chez lui.

   Données : fichier privé `reco.fichier` (reco-produits.json), même dossier du
   seau que les documents, lu par V2.groupementDocs.fichier(). Contrat :
   {version:1, date_prix, valide_jusqua, date_tarif_releve,
    ventes:{depot, mois, nb_pharmacies},
    listes:[{cle, titre, court, note, pourcent, lignes:[{cip, designation, labo,
             nature, n, ppht, net, abandon_pct}]}]}
   Aucun chiffre ni aucune date dans ce dépôt public : tout se LIT dans le fichier.

   Règles d'affichage (skill pharma-metier) : « abandon de marge », jamais « remise » ;
   la colonne « Abandon de marge » n'existe que sur une liste `pourcent:true` (« — » quand
   la valeur est nulle) ; génériques et non remboursés : prix net seul, jamais de %.
   Le document imprimé (remis) ne porte JAMAIS de pourcentage d'abandon de marge.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var G = window.V2_GROUPEMENT;
  var CFG = G && G.reco;
  if (!CFG || !G.documents || !V2.pages || !V2.groupementDocs) return;

  var ROUTE = 'recogroupement';
  var DOCS = V2.groupementDocs;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var fE = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fN = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var fP = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function euros(v) { return num(v) == null ? '—' : fE.format(v) + ' €'; }
  // Unité du pourcentage : le fichier des produits l'écrit en fraction (0,039 = 3,9 %). Si une valeur dépasse 1, le fichier
  // l'écrit en pourcents (3,9) : l'unité se décide pour tout le fichier, jamais ligne par ligne.
  function enPourcents(d) {
    var t = false;
    ((d && d.listes) || []).forEach(function (l) { (l.lignes || []).forEach(function (x) { if (num(x.abandon_pct) != null && x.abandon_pct > 1) t = true; }); });
    return t;
  }
  function pct(v, pctDirect) { return num(v) == null ? '—' : fP.format(pctDirect ? v : v * 100) + ' %'; }
  // Clé de liste insérée dans un onclick : lettres, chiffres, tiret seulement (esc() ne protège pas une chaîne JS).
  function cleSure(k) { return /^[a-z0-9_-]+$/.test(String(k == null ? '' : k)); }
  function listesValides(d) {
    return ((d && d.listes) || []).filter(function (l) { return l && cleSure(l.cle) && Array.isArray(l.lignes); });
  }

  // ── État ──
  var _data = null, _lu = false, _enCours = false, _cle = null;

  function charger() {
    if (_lu || _enCours) return;
    _enCours = true;
    Promise.resolve(DOCS.charger()).then(function (etat) {
      if (etat && etat.acces === false) return null;
      return DOCS.fichier(CFG.fichier);
    }).then(function (d) {
      _data = (d && d.version === 1 && listesValides(d).length) ? d : null;
    }).catch(function () { _data = null; }).then(function () {
      _lu = true; _enCours = false;
      redessiner();
    });
  }
  function redessiner() {
    if (V2.route && V2.route.name === ROUTE) { var r = document.getElementById('v2-root'); if (r) render(r); }
  }
  function listeActive() {
    var l = listesValides(_data);
    for (var i = 0; i < l.length; i++) if (l[i].cle === _cle) return l[i];
    return l[0];
  }

  // ── Dates ──
  function textDates(d, avecHtml) {
    if (!d || !d.date_prix) return '';
    var b = function (x) { return avecHtml ? '<b class="greco-d">' + esc(x) + '</b>' : esc(x); };
    var t = 'Prix au ' + b(d.date_prix);
    if (d.valide_jusqua) t += ', valables jusqu\'au ' + b(d.valide_jusqua);
    if (d.date_tarif_releve) t += ' · tarif relevé le ' + esc(d.date_tarif_releve);
    var v = d.ventes;
    if (v && (v.mois || v.nb_pharmacies)) {
      var p = [];
      if (v.mois) p.push(esc(v.mois));
      if (num(v.nb_pharmacies) != null) p.push(fN.format(v.nb_pharmacies) + ' pharmacies');
      if (v.depot) p.push('déposées le ' + esc(v.depot));
      t += ' · ventes : ' + p.join(', ');
    }
    return t + '.';
  }

  // ── Rendu ──
  function ligne(l, i, avecAban, pDirect) {
    var aban = avecAban ? '<div class="greco-c greco-num" role="cell" data-l="Abandon de marge">' +
      (num(l.abandon_pct) == null ? '<span class="greco-vide">—</span>' : '<b>' + pct(l.abandon_pct, pDirect) + '</b>') + '</div>' : '';
    return '<div class="greco-li' + (avecAban ? ' has-aban' : '') + '" role="row">' +
      '<div class="greco-c greco-rang" role="cell">' + (i + 1) + '</div>' +
      '<div class="greco-c greco-nom" role="cell"><b class="greco-n">' + esc(l.designation) + '</b>' +
        '<span class="greco-m">' + esc(l.labo || '') + (l.cip ? ' · CIP ' + esc(l.cip) : '') + '</span></div>' +
      '<div class="greco-c greco-num greco-ph" role="cell" data-l="Pharmacies"><b>' + (num(l.n) == null ? '—' : fN.format(l.n)) + '</b></div>' +
      '<div class="greco-c greco-num" role="cell" data-l="PPHT">' + euros(l.ppht) + '</div>' +
      '<div class="greco-c greco-num greco-net" role="cell" data-l="Prix net"><b>' + euros(l.net) + '</b></div>' +
      aban + '</div>';
  }
  function entete(avecAban) {
    return '<div class="greco-li greco-th' + (avecAban ? ' has-aban' : '') + '" role="row">' +
      '<div class="greco-c greco-rang" role="columnheader">#</div>' +
      '<div class="greco-c greco-nom" role="columnheader">Produit</div>' +
      '<div class="greco-c greco-num" role="columnheader">Pharmacies</div>' +
      '<div class="greco-c greco-num" role="columnheader">PPHT</div>' +
      '<div class="greco-c greco-num" role="columnheader">Prix net</div>' +
      (avecAban ? '<div class="greco-c greco-num" role="columnheader">Abandon de marge</div>' : '') + '</div>';
  }
  function corps(d) {
    var listes = listesValides(d), act = listeActive(), pD = enPourcents(d);
    var avecAban = act.pourcent === true;
    var onglets = listes.map(function (l) {
      return '<button type="button" class="v2-tab' + (l === act ? ' on' : '') + '" onclick="V2.grecoListe(\'' + l.cle + '\')">' +
        esc(l.court || l.titre || l.cle) + '<em>' + l.lignes.length + '</em></button>';
    }).join('');
    var choix = '<select class="v2-field opx-tabsel" aria-label="Liste" onchange="V2.grecoListe(this.value)">' +
      listes.map(function (l) { return '<option value="' + l.cle + '"' + (l === act ? ' selected' : '') + '>' + esc(l.court || l.titre || l.cle) + ' · ' + l.lignes.length + '</option>'; }).join('') + '</select>';
    var tableau = act.lignes.length
      ? '<div class="greco-table" role="table" aria-label="' + esc(act.titre || act.court || '') + '">' + entete(avecAban) + act.lignes.map(function (l, i) { return ligne(l, i, avecAban, pD); }).join('') + '</div>'
      : '<p class="greco-rien" role="status">Cette liste est vide.</p>';
    return '<div class="v2-tabs opx-tabs greco-tabs" role="tablist">' + onglets + '</div>' + choix +
      '<section class="greco-carte"><h2 class="greco-t">' + esc(act.titre || act.court || '') + '</h2>' +
      (act.note ? '<p class="greco-note-l">' + esc(act.note) + '</p>' : '') + tableau + '</section>' +
      '<p class="greco-note">' + esc(CFG.note || '') + '</p>';
  }
  function render(root) {
    var refuse = DOCS.etat && DOCS.etat().pret && DOCS.etat().acces === false;
    var contenu;
    if (refuse) {
      contenu = '<div class="gdoc-refus" role="status"><b>Reco indisponible pour ce compte.</b><span>Elle est réservée aux comptes du groupement ' + esc(G.nom || '') + '.</span></div>';
    } else if (!_lu) {
      contenu = '<p class="greco-attente" role="status">Lecture de la reco…</p>';
    } else if (!_data) {
      contenu = '<div class="gdoc-refus" role="status"><b>La reco n\'a pas pu être lue pour le moment.</b>' +
        '<span>Le fichier est absent ou le serveur ne répond pas. <button type="button" class="v2-btn v2-btn-ghost" onclick="V2.grecoRelire()">Réessayer</button></span></div>';
    } else {
      contenu = corps(_data);
    }
    var bouton = (!refuse && _data)
      ? '<button type="button" class="v2-btn v2-btn-primary greco-imprimer" id="greco-imprimer" onclick="V2.grecoImprimer()"><span>Imprimer</span></button>' : '';
    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page greco-page">' +
        '<div class="opx-head greco-head"><div class="greco-head-t"><div class="v2-page-title">' + esc(CFG.titre || 'Reco produits') + '</div>' +
          '<div class="opx-sub">' + (refuse ? '' : esc(CFG.sousTitre || '')) + '</div>' +
          (_data && !refuse ? '<div class="greco-dates">' + textDates(_data, true) + '</div>' : '') + '</div>' + bouton + '</div>' +
        contenu +
      '</div>';
    if (!_lu) charger();
  }

  // ── Impression : fenêtre A4 de la liste affichée, SANS la colonne d'abandon de marge ──
  function htmlImpression(d, l) {
    var lignes = l.lignes.map(function (x, i) {
      return '<tr><td class="r">' + (i + 1) + '</td><td><b>' + esc(x.designation) + '</b><br><span class="s">' + esc(x.labo || '') + (x.cip ? ' · CIP ' + esc(x.cip) : '') + '</span></td>' +
        '<td class="c"><b>' + (num(x.n) == null ? '—' : fN.format(x.n)) + '</b></td><td class="r">' + euros(x.ppht) + '</td><td class="r"><b>' + euros(x.net) + '</b></td></tr>';
    }).join('');
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' + esc((G.nom || '') + ' — ' + (CFG.titre || 'Reco produits')) + '</title>' +
      '<style>@page{size:A4;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;color:#222;font-size:11px}' +
      'h1{font-size:18px;margin:0}.head{border-bottom:2px solid #444;padding-bottom:8px;margin-bottom:12px}.sub{color:#555;font-size:12px;margin-top:3px}' +
      'table{width:100%;border-collapse:collapse}th{background:#eee;text-align:left;padding:6px;font-size:10px;text-transform:uppercase}' +
      'td{padding:5px 6px;border-bottom:1px solid #ddd;vertical-align:top}.r{text-align:right}.c{text-align:center}.s{color:#555;font-size:9px}.foot{margin-top:12px;color:#555;font-size:9px}tr{break-inside:avoid}</style></head><body>' +
      '<div class="head"><h1>' + esc(G.nom || '') + ' — ' + esc(CFG.titre || 'Reco produits') + '</h1>' +
      '<div class="sub">' + esc(l.titre || l.court || '') + ' · ' + l.lignes.length + ' produits</div>' +
      '<div class="sub">' + textDates(d, false) + '</div></div>' +
      '<table><thead><tr><th class="r">#</th><th>Produit</th><th class="c">Pharmacies</th><th class="r">PPHT</th><th class="r">Prix net</th></tr></thead><tbody>' + lignes + '</tbody></table>' +
      '<div class="foot">Génériques et non remboursés : prix net seul. « Pharmacies » : nombre d\'officines Intégral Pharma qui commandent déjà le produit.</div>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>';
  }
  V2.grecoImprimer = function () {
    if (!_data) return;
    var l = listeActive();
    // La fenêtre s'ouvre AVANT tout le reste : Safari refuse une ouverture différée. La donnée est déjà en mémoire.
    var w = window.open('', '_blank');
    if (!w) { if (V2.toast) V2.toast('Impression bloquée par le navigateur. Autorisez les fenêtres pour ce site, puis réessayez.'); return; }
    w.document.write(htmlImpression(_data, l));
    w.document.close();
  };
  V2.grecoListe = function (k) { _cle = cleSure(k) ? k : null; redessiner(); };
  V2.grecoRelire = function () { _lu = false; _data = null; redessiner(); };

  V2.pages[ROUTE] = { needs: [], render: render };

  // Lu par l'accueil (tuile, ⌘K) et par le tableau de bord (ligne courte).
  V2.groupementReco = {
    route: ROUTE,
    tuile: CFG.tuile || '',
    tuileCourte: CFG.tuileCourte || '',
    palette: CFG.palette || 'Reco produits',
    titre: CFG.titre || 'Reco produits',
    // exposés pour le banc d'essai
    _htmlImpression: htmlImpression, _cleSure: cleSure, _enPourcents: enPourcents
  };
})();

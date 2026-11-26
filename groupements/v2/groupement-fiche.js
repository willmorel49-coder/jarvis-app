/* ════════════════════════════════════════════════════════════════
   Fiche « Le groupement » d'une app de groupement (option B, étape 8, 26/11/2026).
   Commune à toutes les apps de groupement ; activée seulement si le réglage
   (groupements/config/<id>.js) porte un bloc `fiche`. OPSO n'en a pas : ni route,
   ni tuile, ni ⌘K chez lui, et son index.html ne charge pas ce module.

   Contenu : tout vient du bloc `fiche` du réglage (nom, dirigeants, contact,
   chiffres ANNONCÉS par le groupement avec leur mention de source, activités),
   sauf le nombre d'officines et leur liste : ils sont CALCULÉS sur le périmètre
   réel de l'app (V2.pharmacies après V2.appliquerPerimetreGroupement), rangées
   par département. Aucune condition commerciale ici : la fiche ne dépend pas
   de l'accès serveur.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var G = window.V2_GROUPEMENT;
  var CFG = G && G.fiche;
  if (!CFG || !V2.pages) return;

  var ROUTE = 'fichegroupement';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var fN = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // ── Calcul pur (testé : tests/groupement-fiche.test.mjs) ──
  // Officines du périmètre rangées par département (2 premiers chiffres du code postal), départements en ordre numérique,
  // officines par nom. Code postal absent (nom pas encore lu dans la base nationale) : groupe « ? », en dernier.
  function parDepartement(pharmacies, noms) {
    var g = {};
    (pharmacies || []).forEach(function (p) {
      var cp = String((p && p.cp) || '').replace(/\D/g, '');
      var d = cp.length >= 4 ? cp.slice(0, 2) : '?';
      (g[d] = g[d] || []).push(p);
    });
    return Object.keys(g).sort(function (a, b) {
      if (a === '?') return 1; if (b === '?') return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    }).map(function (d) {
      g[d].sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'fr'); });
      return { dep: d, nom: d === '?' ? 'Département à confirmer' : ((noms && noms[d]) || 'Département ' + d), officines: g[d] };
    });
  }
  function compter(pharmacies) {
    var t = { officines: 0, clientes: 0 };
    (pharmacies || []).forEach(function (p) { t.officines++; if (p && p.inDb) t.clientes++; });
    return t;
  }
  function lienSite(s) {
    var h = String(s || '').trim();
    if (!h) return '';
    return /^https?:\/\//i.test(h) ? h : 'https://' + h;
  }

  // ── Rendu ──
  function carteChiffre(v, l, cls) {
    return '<div class="gfic-k' + (cls ? ' ' + cls : '') + '"><b class="gfic-kv">' + esc(v) + '</b><span class="gfic-kl">' + esc(l) + '</span></div>';
  }
  function initiales(nom) {
    return String(nom || '?').split(/\s+/).map(function (x) { return x.charAt(0); }).slice(0, 2).join('').toUpperCase();
  }
  function entete() {
    var site = lienSite(CFG.site);
    return '<div class="gfic-hero">' +
      '<div class="gfic-hero-t"><h2 class="gfic-nom">' + esc(G.nom || '') + '</h2>' +
        (CFG.ancien ? '<p class="gfic-ancien">' + esc(CFG.ancien) + '</p>' : '') + '</div>' +
      '<div class="gfic-hero-l">' +
        (CFG.baseline ? '<span class="gfic-baseline">' + esc(CFG.baseline) + '</span>' : '') +
        (site ? '<a class="gfic-site" href="' + esc(site) + '" target="_blank" rel="noopener">' + esc(CFG.site) + '</a>' : '') +
        (CFG.siege ? '<span class="gfic-siege">Siège : ' + esc(CFG.siege) + '</span>' : '') +
      '</div></div>';
  }
  function chiffres(t) {
    var A = CFG.annonces;
    var calcules = '<div class="gfic-ks">' +
      carteChiffre(fN.format(t.officines), t.officines > 1 ? 'officines suivies dans cette app' : 'officine suivie dans cette app') +
      carteChiffre(fN.format(t.clientes), t.clientes > 1 ? 'clientes Intégral Pharma' : 'cliente Intégral Pharma', 'is-fort') +
    '</div>';
    if (!A || !A.lignes || !A.lignes.length) return calcules;
    return calcules + '<section class="gfic-carte gfic-annonces"><h2 class="gfic-t">' + esc(A.titre || 'Chiffres annoncés par le groupement') + '</h2>' +
      '<div class="gfic-ks gfic-ks-a">' + A.lignes.map(function (x) { return carteChiffre(x.v, x.l); }).join('') + '</div>' +
      (A.mention ? '<p class="gfic-mention">' + esc(A.mention) + '</p>' : '') + '</section>';
  }
  function dirigeants() {
    var l = (CFG.dirigeants || []).map(function (d) {
      return '<li class="gfic-dir"><span class="gfic-ini" aria-hidden="true">' + esc(initiales(d.nom)) + '</span>' +
        '<span class="gfic-dir-t"><b>' + esc(d.nom) + '</b><span>' + esc(d.fn || '') + '</span></span></li>';
    }).join('');
    return '<section class="gfic-carte"><h2 class="gfic-t">Dirigeants</h2><ul class="gfic-liste">' + l + '</ul></section>';
  }
  function contact() {
    var c = CFG.contact || {};
    var tel = c.tel ? '<div class="gfic-ct"><span class="gfic-ct-l">Téléphone</span><a href="tel:' + esc(String(c.tel).replace(/[^\d+]/g, '')) + '">' + esc(c.tel) + '</a></div>' : '';
    var mail = c.email ? '<div class="gfic-ct"><span class="gfic-ct-l">E-mail</span><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></div>' : '';
    return '<section class="gfic-carte"><h2 class="gfic-t">Contact</h2>' + (tel + mail || '<p class="gfic-vide">—</p>') + '</section>';
  }
  function activites() {
    var a = CFG.activites || [];
    if (!a.length) return '';
    return '<section class="gfic-bloc"><h2 class="gfic-t gfic-t-sec">' + esc(CFG.activitesTitre || 'Les activités') + '</h2><div class="gfic-acts">' +
      a.map(function (x) { return '<div class="gfic-act"><b>' + esc(x.t) + '</b><span>' + esc(x.d || '') + '</span></div>'; }).join('') + '</div></section>';
  }
  function officines(groupes) {
    if (!groupes.length) {
      return '<section class="gfic-bloc"><h2 class="gfic-t gfic-t-sec">Les officines</h2><p class="gfic-vide" role="status">Aucune officine à afficher pour le moment.</p></section>';
    }
    return '<section class="gfic-bloc"><h2 class="gfic-t gfic-t-sec">Les officines</h2>' + groupes.map(function (g) {
      return '<div class="gfic-dep"><div class="gfic-dep-h"><h3 class="gfic-dep-t">' + esc(g.dep === '?' ? g.nom : g.dep + ' ' + g.nom) + '</h3><span class="gfic-dep-n">' + g.officines.length + '</span></div>' +
        '<ul class="gfic-offs">' + g.officines.map(function (p) {
          var cpv = [String(p.cp || '').trim(), String(p.ville || '').trim()].filter(Boolean).join(' ');
          return '<li class="gfic-off"><span class="gfic-off-n">' + esc(p.name || '') + '</span>' +
            (p.inDb ? '<span class="gfic-pastille">Cliente Intégral Pharma</span>' : '') +
            (cpv ? '<span class="gfic-off-v">' + esc(cpv) + '</span>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }).join('') + '</section>';
  }
  function render(root) {
    var ph = V2.pharmacies || [];
    var t = compter(ph);
    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page gfic-page">' +
        '<div class="opx-head"><div class="v2-page-title">' + esc(CFG.titre || 'Le groupement') + '</div></div>' +
        entete() + chiffres(t) +
        '<div class="gfic-duo">' + dirigeants() + contact() + '</div>' +
        activites() +
        officines(parDepartement(ph, CFG.departements)) +
      '</div>';
  }

  V2.pages[ROUTE] = { needs: [], render: render };

  // Lu par l'accueil (tuile, ⌘K) et par le tableau de bord (ligne courte).
  V2.groupementFiche = {
    route: ROUTE,
    tuile: CFG.tuile || '',
    tuileCourte: CFG.tuileCourte || '',
    palette: CFG.palette || 'Le groupement',
    titre: CFG.titre || 'Le groupement',
    // exposés pour le banc d'essai (calcul pur)
    _parDepartement: parDepartement, _compter: compter, _norm: norm
  };
})();

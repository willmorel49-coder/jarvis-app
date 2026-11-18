/* Noyau commun des maquettes (copié dans chaque app.js) : données, bascule des vues, ouverture de la fiche. */
(function () {
  'use strict';
  var D = window.DONNEES, F = D.fiche, M = D.moyenneClients;
  var NF = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var NF1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  var REDUIT = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var N = window.N = { D: D, F: F, M: M, REDUIT: REDUIT, vue: 'integral', ordre: [], nbMois: 10 };

  N.eur = function (n) { return (n < 0 ? '−' : '') + NF.format(Math.abs(Math.round(n))) + ' €'; };
  N.nb = function (n) { return NF.format(Math.round(n)); };
  N.nb1 = function (n) { return NF1.format(n); };
  N.pct = function (n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + NF.format(Math.abs(n)) + ' %'; };
  N.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  N.maj = function (s) { return s; };
  N.mois = function (iso) { var m = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']; var p = iso.split('-'); return NF.format(+p[2]) + (+p[2] === 1 ? 'er' : '') + ' ' + m[+p[1] - 1]; };
  /* Deux textes selon la vue : le premier pour l'équipe, le second (2e personne) pour le pharmacien. */
  N.vv = function (a, b) { return '<span class="vi">' + a + '</span><span class="vp">' + b + '</span>'; };

  N.ico = function (nom) {
    var p = {
      phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
      pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 14h6M9 17h4"/>',
      xls: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16"/>',
      send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
      todo: '<path d="m4 6 2 2 3-3M4 15l2 2 3-3M12 7h8M12 16h8"/>',
      monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
      clip: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/>',
      next: '<path d="m9 6 6 6-6 6"/>', back: '<path d="m15 6-6 6 6 6"/>',
      search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
      check: '<path d="m5 12 4.5 4.5L19 7"/>', down: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
      plus: '<path d="M12 5v14M5 12h14"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
      note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>',
      cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
      brief: '<path d="M5 5h14v10H9l-4 4z"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      up: '<path d="m6 15 6-6 6 6"/>', dn: '<path d="m6 9 6 6 6-6"/>', eq: '<path d="M5 12h14"/>'
    }[nom] || '';
    return '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  };

  /* Comparaison à la moyenne de nos clients : rapport, mot, classe de couleur (sens seulement). */
  N.cmp = function (val, moy) {
    var r = moy > 0 ? val / moy : 0;
    if (r >= 1.1) return { r: r, cls: 'ok', mot: 'au-dessus de la moyenne' };
    if (r >= 0.9) return { r: r, cls: 'neu', mot: 'proche de la moyenne' };
    return { r: r, cls: 'bad', mot: 'en dessous de la moyenne' };
  };
  N.fois = function (r) { return r >= 10 ? '× ' + N.nb(r) : '× ' + N.nb1(r); };

  var LOGICIELS = ['Logiciel A', 'Logiciel B', 'Logiciel C', 'Éditeur 2', 'Éditeur 4'];
  var GROSSISTES = ['Grossiste 4', 'Grossiste 2', 'Grossiste 6', 'Grossiste 7'];
  var RUES = ['12 avenue des Mimosas', '4 place de la République', '27 boulevard Gambetta', '8 rue du Marché', '31 cours Lafayette'];
  function slug(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function num(id) { return parseInt(id.replace(/\D/g, ''), 10) || 1; }
  N.row = function (id) { for (var i = 0; i < D.officines.length; i++) if (D.officines[i].id === id) return D.officines[i]; return D.officines[0]; };
  N.initiales = function (nom) { var m = nom.replace(/^PHARMACIE\s+(DU|DE LA|DE|DES|DE L’|DE L'|DU LA|DU LES|DU)?\s*/i, '').split(/\s+/).filter(Boolean); return ((m[0] || 'P')[0] + ((m[1] || '')[0] || '')).toUpperCase(); };
  var PETITS = ['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'en', 'et', 'aux', 'au'];
  N.titre = function (n) {
    var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
    return String(n).toLowerCase().replace(/'/g, '’').split(' ').map(function (t, k) {
      if (k > 0 && PETITS.indexOf(t) >= 0) return t;
      return t.split('-').map(function (x, q) { if (q > 0 && PETITS.indexOf(x) >= 0) return x; var ap = x.indexOf('’'); return ap > 0 && ap < 3 ? x.slice(0, ap + 1) + cap(x.slice(ap + 1)) : cap(x); }).join('-');
    }).join(' ');
  };

  /* Fiche d'une officine : la 1re = DONNEES.fiche ; les autres reprennent leur ligne + le détail de la fiche. */
  N.fiche = function (id) {
    var row = N.row(id), n = num(row.id), first = row.id === F.id, o = {};
    var clients = D.officines.filter(function (x) { return x.statut === 'cliente'; });
    o.row = row; o.id = row.id; o.nom = row.nom; o.statut = row.statut; o.first = first;
    o.aRappeler = row.aRappeler; o.baisse3mois = row.baisse3mois; o.score = row.score; o.offilog = row.clientOffilog;
    o.prospect = row.statut !== 'cliente' || !(row.ca > 0);
    o.ville = row.ville; o.cp = row.cp; o.groupement = row.groupement;
    o.periode = F.periode; o.moisLabels = F.moisLabels;
    var I = F.identite, id2 = {};
    if (first) id2 = I;
    else {
      var ph = String(n * 7919 % 9000 + 1000).replace(/(\d\d)(\d\d)/, '$1 $2');
      id2 = {
        cip: String(2300000 + n * 1297 % 99999), titulaires: row.titulaire, nbPharmaciens: (1 + n % 3) + ' titulaire' + (n % 3 ? 's' : '') + ' et ' + (n % 4 + 1) + ' adjoint' + (n % 4 ? 's' : ''),
        aSavoir: '', groupement: row.groupement, logiciel: LOGICIELS[n % 5], grossistePrincipal: GROSSISTES[n % 4],
        telephone: '04 ' + ph + ' ' + String(n * 31 % 90 + 10) + ' ' + String(n * 17 % 90 + 10), portable: '06 ' + ph + ' ' + String(n * 13 % 90 + 10) + ' ' + String(n * 29 % 90 + 10),
        fax: '', email: 'contact@' + slug(row.nom.replace(/^PHARMACIE\s+/i, 'pharmacie ')) + '.example', adresse: RUES[n % 5], cp: row.cp, ville: row.ville
      };
    }
    o.i = id2; o.cip = id2.cip;
    var r = (!first && row.ca > 0) ? row.ca / F.ca : 1;
    if (first) { o.caParMois = F.caParMois; o.margeNousParMois = F.margeNousParMois; o.margePharmacienParMois = F.margePharmacienParMois; o.ca = F.ca; o.margeNous = F.margeNous; o.margePharmacien = F.margePharmacien; o.produits = F.produitsDifferentsAchetes; }
    else {
      o.caParMois = row.caParMois; o.ca = row.ca; o.margeNous = row.margeNous; o.margePharmacien = row.margePharmacien;
      var kn = row.ca > 0 ? row.margeNous / row.ca : 0, kp = row.ca > 0 ? row.margePharmacien / row.ca : 0;
      o.margeNousParMois = row.caParMois.map(function (v) { return Math.round(v * kn); });
      o.margePharmacienParMois = row.caParMois.map(function (v) { return Math.round(v * kp); });
      o.produits = row.ca > 0 ? Math.round(F.produitsDifferentsAchetes * Math.pow(r, 0.3)) : 0;
    }
    var cm = o.caParMois, last = cm[9], prev = cm[8];
    o.dernierMois = first ? F.dernierMois : { libelle: 'oct. 2026', ca: last, evolutionSurMoisPrecedent: prev > 0 ? Math.round((last - prev) / prev * 100) : null };
    o.cats = F.categories.map(function (c) {
      var x = { cle: c.cle, nom: c.nom, montant: first ? c.montant : Math.round(c.montant * r), moyenneClients: c.moyenneClients };
      if (c.parGeneriqueur) x.parGeneriqueur = c.parGeneriqueur.map(function (g) { return { nom: g.nom, montant: first ? g.montant : Math.round(g.montant * r), moyenneClients: g.moyenneClients }; });
      if (o.prospect) { x.montant = 0; if (x.parGeneriqueur) x.parGeneriqueur.forEach(function (g) { g.montant = 0; }); }
      return x;
    });
    o.partGener = o.ca > 0 ? Math.round(o.cats[1].montant / o.ca * 100) : 0;
    o.top10 = o.prospect ? [] : F.top10.map(function (p) { return { nom: p.nom, famille: p.famille, quantite: first ? p.quantite : Math.max(1, Math.round(p.quantite * r)), montant: first ? p.montant : Math.max(1, Math.round(p.montant * r)) }; });
    o.nePlus = o.prospect ? [] : (first ? F.nePlusCommande : F.nePlusCommande.slice(0, 2 + n % 5));
    var gnb = { 'Pharma Horizon': 521, 'Réseau Azur': 412, 'Calanques Santé': 365, 'Mistral Pharma': 288, 'Soleil Officine': 321 };
    o.reseau = F.aProposer.reseau;
    o.groupe = row.groupement === 'Sans groupement' ? null : { groupement: row.groupement, nbProduits: first ? F.aProposer.groupeAchat.nbProduits : (gnb[row.groupement] || 300), premiers: F.aProposer.groupeAchat.premiers };
    o.catalogue = { logiciel: id2.logiciel, libelle: F.aProposer.catalogueLogiciel.libelle };
    o.notes = first ? F.notes : []; o.rdv = first ? F.prochainRendezVous : null; o.taches = first ? F.taches : [];
    o.clienteDepuis = first ? F.clienteDepuis : String(2012 + n % 12);
    if (first) o.rang = F.rang;
    else {
      var pos = clients.indexOf(row) + 1, same = clients.filter(function (x) { return x.groupement === row.groupement; });
      o.rang = { france: pos || null, surFrance: F.rang.surFrance, groupement: same.indexOf(row) + 1 || null, surGroupement: F.rang.surGroupement };
    }
    o.moy = { ca: M.caMois, margeNous: M.margeNousMois, margePh: M.margePharmacienMois, gener: M.partGeneriques, mois: N.nbMois };
    o.parMois = { ca: o.ca / N.nbMois, margeNous: o.margeNous / N.nbMois, margePh: o.margePharmacien / N.nbMois };
    o.moisPlus = Math.max.apply(null, cm);
    return o;
  };
  N.statutMot = function (row) { return row.statut !== 'cliente' ? 'Prospect' : row.aRappeler ? 'À rappeler' : 'Cliente'; };
  N.statutCls = function (row) { return row.statut !== 'cliente' ? 'prospect' : row.aRappeler ? 'rappel' : 'cliente'; };
  N.moyCumul = function (cle) { return { ca: M.caMois, margeNous: M.margeNousMois, margePh: M.margePharmacienMois }[cle] * N.nbMois; };

  /* Compteur : de 0 à la valeur, une fois, à l'arrivée. data-compte="valeur" data-fmt="eur|nb|pct". */
  N.compter = function (racine) {
    var els = (racine || document).querySelectorAll('[data-compte]');
    Array.prototype.forEach.call(els, function (el) {
      var v = parseFloat(el.getAttribute('data-compte')), f = el.getAttribute('data-fmt') || 'nb';
      var mk = function (x) { return f === 'eur' ? N.eur(x) : f === 'pct' ? N.nb(x) + ' %' : N.nb(x); };
      el.textContent = mk(v);
      if (REDUIT || !(v > 0)) return;
      var t0 = null, d = 1000;
      function pas(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / d); k = 1 - Math.pow(1 - k, 3); el.textContent = mk(v * k); if (k < 1) requestAnimationFrame(pas); else el.textContent = mk(v); }
      el.textContent = mk(0); requestAnimationFrame(pas);
    });
  };

  N.icones = function (racine) {
    Array.prototype.forEach.call((racine || document).querySelectorAll('[data-ico]'), function (s) { if (!s.firstChild) { s.innerHTML = N.ico(s.getAttribute('data-ico')); s.classList.add('ico'); } });
  };
  N.toast = function (txt) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = txt; t.classList.add('on'); clearTimeout(N._t); N._t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  };

  /* Écrans */
  var el = function (s) { return document.querySelector(s); };
  N.setVue = function (v) {
    N.vue = v; document.body.setAttribute('data-mode', v);
    Array.prototype.forEach.call(document.querySelectorAll('[data-vue]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-vue') === v ? 'true' : 'false'); });
    try { localStorage.setItem('m-vue', v); } catch (e) {}
    if (N.surVue) N.surVue(v);
  };
  N.ouvrir = function (id, src) {
    N.courant = id; N.srcAnim = src || null;
    if (location.hash === '#fiche') { if (N.route) N.route(); } else location.hash = '#fiche';
  };
  N.retour = function () { if (location.hash === '#liste') { if (N.route) N.route(); } else location.hash = '#liste'; };
  N.voisin = function (sens) {
    var o = N.ordre.length ? N.ordre : D.officines.map(function (x) { return x.id; });
    var i = o.indexOf(N.courant); if (i < 0) i = 0;
    N.ouvrir(o[(i + sens + o.length) % o.length]);
  };

  N.demarrer = function () {
    N.icones();
    var v = 'integral'; try { v = localStorage.getItem('m-vue') || 'integral'; } catch (e) {}
    N.setVue(v === 'pharmacien' ? 'pharmacien' : 'integral');
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-officine],[data-ouvre],[data-vue],[data-action],[data-voisin],[data-aller],[data-stub]') : null;
      if (!t) return;
      if (t.hasAttribute('data-officine') || t.hasAttribute('data-ouvre')) { e.preventDefault(); N.ouvrir(t.getAttribute('data-officine') || t.getAttribute('data-ouvre'), t); }
      else if (t.hasAttribute('data-vue')) N.setVue(t.getAttribute('data-vue'));
      else if (t.getAttribute('data-action') === 'retour') N.retour();
      else if (t.hasAttribute('data-voisin')) N.voisin(t.getAttribute('data-voisin') === 'prec' ? -1 : 1);
      else if (t.hasAttribute('data-aller')) location.hash = t.getAttribute('data-aller');
      else if (t.hasAttribute('data-stub')) N.toast(t.getAttribute('data-stub') || 'Action non dessinée dans cette maquette.');
    });
  };
})();

/* ===== m01 — Pappers : liste ===== */
(function () {
  'use strict';
  var D = N.D, S = D.secteur, M = N.M, esc = N.esc;
  var etat = { onglet: 'clientes', q: '' };
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /* Couleurs fixes des groupements (palette --cat-*, ordre fixe) */
  var GR = ['Pharma Horizon', 'Réseau Azur', 'Calanques Santé', 'Mistral Pharma', 'Soleil Officine', 'Sans groupement'];
  function gi(g) { var i = GR.indexOf(g); return i < 0 ? 5 : i; }
  N.gi = gi;
  var STIC = { cliente: 'check', rappel: 'phone', prospect: 'user' };
  function pastEtat(o) { var cl = N.statutCls(o); return '<span class="pastille pastille--' + cl + '">' + N.ico(STIC[cl]) + N.statutMot(o) + '</span>'; }
  N.pastEtat = pastEtat;

  /* Mini-courbe SVG : 10 mois, dernier point marqué */
  N.spark = function (arr, couleur, w, h, titre) {
    var mx = Math.max.apply(null, arr), mn = Math.min.apply(null, arr), n = arr.length, pad = 4, rg = (mx - mn) || 1;
    var pts = arr.map(function (v, k) { return [pad + k / (n - 1) * (w - 2 * pad), pad + (1 - (v - mn) / rg) * (h - 2 * pad)]; });
    var d = 'M' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L'), l = pts[n - 1];
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + (titre || 'Courbe des 10 mois') + '">' +
      '<path d="' + d + ' L' + l[0].toFixed(1) + ' ' + (h - 1) + ' L' + pts[0][0].toFixed(1) + ' ' + (h - 1) + ' Z" fill="' + couleur + '" fill-opacity=".07"/>' +
      '<path class="sp-fil" pathLength="1" d="' + d + '" fill="none" stroke="' + couleur + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + l[0].toFixed(1) + '" cy="' + l[1].toFixed(1) + '" r="3.8" fill="#fff" stroke="' + couleur + '" stroke-width="2.5"/></svg>';
  };
  N.anneau = function (score) {
    return '<svg class="anneau" viewBox="0 0 40 40" width="44" height="44" role="img" aria-label="' + score + ' sur 100"><circle cx="20" cy="20" r="16" fill="none" stroke="#E4E8F0" stroke-width="5"/>' +
      '<circle class="an-v" cx="20" cy="20" r="16" fill="none" stroke="#1D2433" stroke-width="5" stroke-linecap="round" pathLength="100" stroke-dasharray="' + score + ' 100" transform="rotate(-90 20 20)"/>' +
      '<text x="20" y="25" text-anchor="middle" font-size="13" font-weight="700" fill="#1D2433">' + score + '</text></svg>';
  };
  N.evo = function (arr) { var l = arr[arr.length - 1], p = arr[arr.length - 2]; return p > 0 ? Math.round((l - p) / p * 100) : null; };
  N.tendance = function (ev) {
    if (ev == null) return '';
    var up = ev >= 0;
    return '<span class="tend tend--' + (up ? 'ok' : 'bad') + '">' + N.ico(up ? 'up' : 'dn') + N.pct(ev) + '</span>';
  };
  N.fois2 = function (v, moy) { if (!(v > 0) || !(moy > 0)) return ''; var r = v / moy; return '<span class="x x--' + (r >= 1.1 ? 'ok' : r < 0.9 ? 'bad' : 'neu') + '">× ' + (r >= 10 ? N.nb(r) : N.nb1(r)) + ' la moyenne</span>'; };

  function ligne(o, i) {
    var f = o.ca > 0, g = gi(o.groupement), ev = f ? N.evo(o.caParMois) : null;
    var kn = f ? o.margeNous / o.ca : 0;
    var gr = o.groupement !== 'Sans groupement' ? ' · <i class="dot dot--s" style="--k:var(--cat-' + (g + 1) + ')"></i>' + esc(o.groupement) : '';
    return '<button type="button" class="ligne" data-officine="' + o.id + '" style="--i:' + Math.min(i, 14) + '">' +
      '<span class="l-id"><span class="av" aria-hidden="true">' + esc(N.initiales(o.nom)) + '</span><span class="l-txt"><span class="l1"><span class="nom">' + esc(N.titre(o.nom)) + '</span>' + pastEtat(o) +
        (o.baisse3mois ? '<span class="pastille pastille--bad">' + N.ico('dn') + '−' + o.baisse3mois + ' % en 3 mois</span>' : '') + '</span>' +
        '<span class="ville">' + esc(o.ville) + ' · ' + o.cp + gr + '</span></span></span>' +
      '<span class="l-val"><span class="lab"><i class="dot" style="--k:var(--c-ca)"></i>Chiffre d’affaires</span><b>' + (f ? N.eur(o.ca) : '—') + '</b>' + (f ? N.fois2(o.ca, M.caMois * N.nbMois) : '<span class="p">Aucune vente</span>') + '</span>' +
      '<span class="l-spark"><span class="lab">10 mois</span>' + (f ? N.spark(o.caParMois, 'var(--c-ca)', 96, 32) + N.tendance(ev) : '<span class="p">—</span>') + '</span>' +
      '<span class="l-val" data-interne><span class="lab"><i class="dot" style="--k:var(--c-nous)"></i>Notre marge Intégral</span><b>' + (f ? N.eur(o.margeNous) : '—') + '</b>' + (f ? N.fois2(o.margeNous, M.margeNousMois * N.nbMois) : '') + '</span>' +
      '<span class="l-val"><span class="lab"><i class="dot" style="--k:var(--c-pharma)"></i>Marge du pharmacien</span><b>' + (f ? N.eur(o.margePharmacien) : '—') + '</b>' + (f ? N.fois2(o.margePharmacien, M.margePharmacienMois * N.nbMois) : '') + '</span>' +
      '<span class="l-val l-score"><span class="lab">À lui proposer</span>' + N.anneau(o.score) + '<span class="sur100">sur 100</span></span>' +
      '<span class="chev">' + N.ico('next') + '</span></button>';
  }

  var premiere = true;
  function bande(rows, pr) {
    var box = document.getElementById('bande');
    if (pr || !rows.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var ca = [], nous = [], ph = [], i, k;
    for (k = 0; k < 10; k++) { ca[k] = 0; nous[k] = 0; ph[k] = 0; }
    rows.forEach(function (o) { if (!(o.ca > 0)) return; for (k = 0; k < 10; k++) { ca[k] += o.caParMois[k]; nous[k] += o.caParMois[k] * o.margeNous / o.ca; ph[k] += o.caParMois[k] * o.margePharmacien / o.ca; } });
    var tot = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    var hausse = 0, baisse = 0; rows.forEach(function (o) { var e = o.ca > 0 ? N.evo(o.caParMois) : null; if (e == null) return; if (e >= 0) hausse++; else baisse++; });
    var nb = rows.length;
    function tuile(cls, lab, couleur, serie, interne, sous) {
      return '<article class="tuile tuile--' + cls + '"' + (interne ? ' data-interne' : '') + '><p class="t-lab"><i class="dot" style="--k:' + couleur + '"></i>' + lab + '</p>' +
        '<b class="t-val" data-compte="' + Math.round(tot(serie)) + '" data-fmt="eur">' + N.eur(tot(serie)) + '</b>' +
        '<p class="t-sous">' + sous + '</p><div class="t-graph">' + N.spark(serie.map(Math.round), couleur, 120, 44, lab + ', 10 derniers mois') + N.tendance(N.evo(serie.map(Math.round))) + '</div></article>';
    }
    var sous = 'janv.–oct. 2026';
    box.innerHTML = tuile('ca', 'Chiffre d’affaires', 'var(--c-ca)', ca, false, sous) +
      tuile('nous', 'Notre marge Intégral', 'var(--c-nous)', nous, true, 'estimation · ' + sous) +
      tuile('ph', 'Marge du pharmacien', 'var(--c-pharma)', ph, false, sous) +
      '<article class="tuile tuile--sens"><p class="t-lab">Octobre, comparé à septembre</p>' +
      '<div class="sens"><div class="sens-l"><span class="sens-n sens-n--ok">' + N.ico('up') + '<b>' + hausse + '</b></span><span class="sens-w">en hausse</span></div>' +
      '<div class="sens-l"><span class="sens-n sens-n--bad">' + N.ico('dn') + '<b>' + baisse + '</b></span><span class="sens-w">en baisse</span></div></div>' +
      '<span class="rep" role="img" aria-label="' + hausse + ' officines en hausse, ' + baisse + ' en baisse"><i class="ok" style="width:' + (hausse / Math.max(1, hausse + baisse) * 100).toFixed(1) + '%"></i><i class="bad" style="flex:1"></i></span>' +
      '</article>';
    if (premiere) N.compter(box);
    else Array.prototype.forEach.call(box.querySelectorAll('[data-compte]'), function (e) { e.textContent = N.eur(parseFloat(e.getAttribute('data-compte'))); });
    N.icones(box);
  }

  function legende() {
    document.getElementById('legende-gr').innerHTML = '<span class="lg-t">Groupements</span>' + GR.map(function (g, i) { return '<span class="lg"><i class="dot dot--s" style="--k:var(--cat-' + (i + 1) + ')"></i>' + g + '</span>'; }).join('');
  }

  function rendreListe() {
    var q = norm(etat.q.trim()), pr = etat.onglet === 'prospects';
    var rows = D.officines.filter(function (o) {
      if ((o.statut === 'cliente') === pr) return false;
      return !q || norm([o.nom, o.ville, o.cp, o.titulaire].join(' ')).indexOf(q) >= 0;
    });
    N.ordre = rows.map(function (o) { return o.id; });
    var box = document.getElementById('liste');
    box.innerHTML = rows.length ? rows.map(ligne).join('') : '<p class="vide">Aucune officine. Aucun résultat pour « ' + esc(etat.q) + ' ».</p>';
    document.getElementById('entete').hidden = pr;
    document.getElementById('compte').innerHTML = pr
      ? '<b>' + rows.length + ' prospects</b> de mon secteur · ' + 'aucune vente à ce jour'
      : '<b>' + rows.length + ' officines affichées</b>, classées par chiffre d’affaires · « × » : multiple de la moyenne de nos ' + N.nb(M.nClients) + ' clients (<b>' + N.eur(M.caMois) + ' par mois</b>)';
    bande(rows, pr || !rows.length);
    premiere = false;
    N.icones(box);
  }

  function rendreRappel() {
    var r = D.officines.filter(function (o) { return o.aRappeler; });
    document.getElementById('rappel').innerHTML = '<h2>À rappeler cette semaine</h2><ul>' + r.map(function (o) {
      return '<li><button type="button" data-ouvre="' + o.id + '">' + N.ico('phone') + esc(N.titre(o.nom).replace('Pharmacie ', '')) + (o.baisse3mois ? '<span class="pastille pastille--bad">−' + o.baisse3mois + ' %</span>' : '') + '</button></li>';
    }).join('') + '</ul>';
    if (!r.length) document.getElementById('rappel').hidden = true;
  }

  legende();
  window.M01 = { listeRendre: rendreListe, rappel: rendreRappel, etat: etat };
  document.getElementById('nb-secteur').textContent = N.nb(S.nbOfficines);
  document.getElementById('c-clients').textContent = N.nb(S.nbClientes);
  document.getElementById('c-prospects').textContent = N.nb(S.nbProspects);
  var bc = document.getElementById('b-clients'), bp = document.getElementById('b-prospects');
  function onglet(v) { etat.onglet = v; bc.classList.toggle('on', v === 'clientes'); bp.classList.toggle('on', v === 'prospects'); bc.setAttribute('aria-pressed', v === 'clientes'); bp.setAttribute('aria-pressed', v === 'prospects'); rendreListe(); }
  bc.addEventListener('click', function () { onglet('clientes'); });
  bp.addEventListener('click', function () { onglet('prospects'); });
  document.getElementById('q').addEventListener('input', function (e) { etat.q = e.target.value; rendreListe(); });
})();

/* ===== m01 — Pappers : fiche ===== */
(function () {
  'use strict';
  var esc = N.esc, M = N.M, vv = N.vv;
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function dateLongue(iso) { var d = new Date(iso + 'T12:00:00'); return JOURS[d.getDay()] + ' ' + N.mois(iso) + ' 2026'; }
  function kv(l, v, interne) { return '<div' + (interne ? ' data-interne' : '') + '><dt>' + l + '</dt><dd>' + v + '</dd></div>'; }

  /* Icônes ajoutées pour la v3 */
  var ico0 = N.ico;
  N.ico = function (nom) {
    var x = { redo: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/>', ban: '<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>', table: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M4 14.5h16M10 10v9"/>' }[nom];
    return x ? '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + x + '</svg>' : ico0(nom);
  };
  var MOISL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre'];
  function cv(nom) { return getComputedStyle(document.documentElement).getPropertyValue(nom).trim(); }
  /* Famille de produit -> catégorie de couleur (même ordre que le donut) */
  function famCat(f) { f = String(f); return /^Princeps/.test(f) ? 1 : /^Générique/.test(f) ? 2 : /^Biosimilaire/.test(f) ? 3 : /^Parapharmacie/.test(f) ? 4 : /^Conseil/.test(f) ? 5 : 6; }
  function prodList(l, o) {
    var deja = {}; (o.nePlus || []).forEach(function (p) { deja[p.nom] = p.derniereCommande; });
    return '<ol class="prod">' + l.premiers.slice(0, 5).map(function (p, i) {
      var d = deja[p.nom];
      var tag = d ? '<span class="tg tg--deja">' + N.ico('redo') + 'Déjà commandé, arrêté</span>' : '<span class="tg tg--jamais">' + N.ico('ban') + 'Jamais commandé</span>';
      return '<li><span class="rg">' + (i + 1) + '</span><span class="pn">' + esc(p.nom) + '<span class="pf">' + esc(p.famille) + '</span>' + tag + '</span>' +
        '<span class="part" style="--k:var(--c-ca)"><span class="piste"><i style="width:' + p.partOfficines + '%"></i></span><b>' + p.partOfficines + ' % des officines</b></span></li>';
    }).join('') + '</ol>';
  }
  function carteProposer(titre, sous, l, vide, o) {
    if (!l) return '<section class="cadre"><header><div><h2>' + titre + '</h2><p class="st">' + sous + '</p></div></header><p class="vide-mini">' + vide + '</p></section>';
    return '<section class="cadre"><header><div><h2>' + titre + '</h2><p class="st">' + sous + ' · <b>' + N.nb(l.nbProduits) + ' produits</b></p></div></header>' +
      '<div class="btns"><button class="btn btn--plein" type="button" data-stub="Envoi : non dessiné dans cette maquette.">' + N.ico('send') + 'Envoyer cette liste</button>' +
      '<div class="dl"><button class="btn" type="button" data-dl aria-haspopup="menu" aria-expanded="false">' + N.ico('down') + 'Télécharger' + N.ico('dn') + '</button>' +
      '<div class="dl-menu" role="menu" hidden><button class="dl-it" type="button" role="menuitem" data-stub="PDF : non dessiné dans cette maquette.">' + N.ico('pdf') + 'Télécharger en PDF</button>' +
      '<button class="dl-it" type="button" role="menuitem" data-stub="Excel : non dessiné dans cette maquette.">' + N.ico('xls') + 'Télécharger en Excel</button></div></div></div>' +
      prodList(l, o) + '<button class="lien" type="button" data-stub="Liste complète : non dessinée dans cette maquette.">Voir les ' + N.nb(l.nbProduits) + ' produits' + N.ico('next') + '</button></section>';
  }

  function cmpRow(lab, val, valMoy, moy, moyTxt, couleur, dotOnly) {
    var c = N.cmp(valMoy, moy), sc = Math.max(c.r, 1) * 1.1;
    var d = couleur && !dotOnly ? '<i class="dot" style="--k:' + couleur + '"></i>' : '';
    return '<div><dt>' + d + lab + '</dt><dd><div class="cmp"><span class="haut"><b>' + val + '</b>' + (moy > 0 && valMoy > 0 ? '<span data-interne class="x x--' + (c.r >= 1.1 ? 'ok' : c.r < 0.9 ? 'bad' : 'neu') + '">' + N.ico(c.r >= 1.1 ? 'up' : c.r < 0.9 ? 'dn' : 'eq') + '× ' + (c.r >= 10 ? N.nb(c.r) : N.nb1(c.r)) + ' la moyenne</span>' : '') + '</span>' +
      '<span class="piste2" style="--k:' + (couleur || 'var(--c-ca)') + '"><i style="width:' + (c.r / sc * 100).toFixed(1) + '%"></i><em data-interne style="left:' + (100 / sc).toFixed(1) + '%"></em></span>' +
      '<span data-interne class="repere">moyenne de nos clients : ' + moyTxt + '</span></div></dd></div>';
  }

  function chiffres(o) {
    var p = o.prospect, dash = '—';
    var h = '<section class="cadre" id="bloc-chiffres"><header><div><h2>' + vv('Comparés à nos clients', 'Vos chiffres en détail') + '</h2><p class="st">' + vv('Montants par mois, janv.–oct. 2026, sur ses 10 mois livrés', 'Montants par mois, janv.–oct. 2026, sur vos 10 mois livrés') + '</p></div></header><dl class="kv kv--filets">';
    h += cmpRow('Chiffre d’affaires par mois', p ? dash : N.eur(o.parMois.ca), o.parMois.ca, M.caMois, N.eur(M.caMois), 'var(--c-ca)');
    h += '<div data-interne><dt><i class="dot" style="--k:var(--c-nous)"></i>Notre marge Intégral par mois</dt><dd>' + cmpRow('', p ? dash : N.eur(o.parMois.margeNous), o.parMois.margeNous, M.margeNousMois, N.eur(M.margeNousMois), 'var(--c-nous)', true).replace(/^<div><dt><\/dt><dd>/, '').replace(/<\/dd><\/div>$/, '').replace(/ data-interne/g, '') + '</dd></div>';
    h += cmpRow('Marge du pharmacien par mois', p ? dash : N.eur(o.parMois.margePh), o.parMois.margePh, M.margePharmacienMois, N.eur(M.margePharmacienMois), 'var(--c-pharma)');
    h += kv('Produits différents achetés', p ? dash : '<b>' + N.nb(o.produits) + '</b>');
    h += cmpRow('Part des génériques dans ' + vv('ses', 'vos') + ' achats', p ? dash : o.partGener + ' %', o.partGener, M.partGeneriques, M.partGeneriques + ' %', 'var(--enc-3)');
    h += kv('Cumul de janv. à oct. 2026', '<b>' + (p ? dash : N.eur(o.ca)) + '</b>');
    h += kv('Rang', o.rang.france ? '<b>' + o.rang.france + (o.rang.france === 1 ? 're' : 'e') + '</b> sur ' + N.nb(o.rang.surFrance) + ' officines actives · <b>' + o.rang.groupement + (o.rang.groupement === 1 ? 're' : 'e') + '</b> sur ' + o.rang.surGroupement + ' chez ' + esc(o.groupement) : dash, true);
    return h + '</dl></section>';
  }

  function coordonnees(o) {
    var i = o.i;
    var h = '<section class="cadre" data-interne><header><div><h2>Coordonnées et profil</h2><p class="st">Réservé à l’équipe</p></div></header><dl class="kv kv--filets">' +
      kv('Fax', esc(i.fax || '—')) + kv('Pharmaciens', esc(i.nbPharmaciens)) + (i.aSavoir ? kv('À savoir', esc(i.aSavoir)) : '') +
      kv('Logiciel', esc(i.logiciel)) + kv('Grossiste principal', esc(i.grossistePrincipal)) + kv('CIP', esc(i.cip)) +
      kv('Offilog', o.offilog ? 'Client Offilog' : 'Non client') + kv('Cliente depuis', esc(o.clienteDepuis)) + '</dl>' +
      '<div class="btns"><a class="btn" href="tel:' + esc(i.telephone.replace(/\s/g, '')) + '">' + N.ico('phone') + 'Appeler</a>' +
      '<a class="btn" href="mailto:' + esc(i.email) + '">' + N.ico('mail') + 'Écrire un e-mail</a>' +
      '<button class="btn" type="button" data-stub="Rendez-vous : non dessiné dans cette maquette.">' + N.ico('cal') + 'Proposer un rendez-vous</button>' +
      '<button class="btn" type="button" data-stub="Note : non dessinée dans cette maquette.">' + N.ico('note') + 'Prendre une note</button>' +
      '<button class="btn" type="button" data-stub="Rendez-vous : non dessiné dans cette maquette.">' + N.ico('cal') + 'Noter un rendez-vous</button></div></section>';
    return h;
  }

  function moisTab(o) {
    var mx = Math.max.apply(null, o.caParMois.concat([1]));
    var h = '<section class="cadre"><header><div><h2>' + vv('Ce qu’elle commande par mois', 'Ce que vous commandez par mois') + '</h2><p class="st">Chiffre d’affaires net hors taxes, avoirs déduits · janv.–oct. 2026</p></div></header>' +
      '<div class="tab h"><span>Mois</span><span></span><span class="num"><i class="dot" style="--k:var(--c-ca)"></i>Chiffre d’affaires</span><span class="evo">Sur un mois</span></div>';
    o.moisLabels.forEach(function (m, k) {
      var v = o.caParMois[k], pr = k ? o.caParMois[k - 1] : 0, ev = k && pr > 0 ? Math.round((v - pr) / pr * 100) : null;
      h += '<div class="tab"><span>' + m + '</span><span class="mini"><i style="width:' + (v / mx * 100).toFixed(1) + '%;animation-delay:' + (0.3 + k * 0.05) + 's"></i></span><span class="num">' + N.eur(v) + '</span>' +
        '<span class="evo ' + (ev == null ? 'neu' : ev >= 0 ? 'ok' : 'bad') + '">' + (ev == null ? '—' : N.pct(ev)) + '</span></div>';
    });
    h += '<div class="tab" style="font-weight:700"><span>Cumul</span><span></span><span class="num">' + N.eur(o.ca) + '</span><span></span></div>' +
      '<div class="tab" data-interne><span>Moyenne</span><span class="repere" style="grid-column:2/4;font-size:13px;color:var(--gris-lib)">de nos clients : ' + N.eur(M.caMois * N.nbMois) + ' sur la période</span><span></span></div></section>';
    return h;
  }

  function margeTab(o) {
    var mxm = Math.max.apply(null, o.margePharmacienParMois.concat([1]));
    var h = '<section class="cadre"><header><div><h2>' + vv('Marge, mois par mois', 'Votre marge, mois par mois') + '</h2><p class="st">janv.–oct. 2026 · ' + vv('génériques comptés à zéro dans notre marge', 'montants par mois') + '</p></div></header>' +
      '<div class="tab tab--3 h"><span>Mois</span><span></span><span class="num"><i class="dot" style="--k:var(--c-pharma)"></i>Marge du pharmacien</span><span class="num c4" data-interne><i class="dot" style="--k:var(--c-nous)"></i>Notre marge Intégral</span></div>';
    o.moisLabels.forEach(function (m, k) {
      h += '<div class="tab tab--3"><span>' + m + '</span><span class="mini mini--ph"><i style="width:' + (o.margePharmacienParMois[k] / mxm * 100).toFixed(1) + '%;animation-delay:' + (0.3 + k * 0.05) + 's"></i></span><span class="num">' + N.eur(o.margePharmacienParMois[k]) + '</span><span class="num c4" data-interne>' + N.eur(o.margeNousParMois[k]) + '</span></div>';
    });
    h += '<div class="tab tab--3" style="font-weight:700"><span>Cumul</span><span></span><span class="num">' + N.eur(o.margePharmacien) + '</span><span class="num c4" data-interne>' + N.eur(o.margeNous) + '</span></div>' +
      '<div class="tab tab--3" data-interne><span>Moyenne</span><span class="repere" style="grid-column:2/4;font-size:13px;color:var(--gris-lib)">de nos clients, sur la période</span><span class="num c4" style="font-size:13px;color:var(--gris-lib)">' + N.eur(M.margeNousMois * N.nbMois) + '</span></div></section>';
    return h;
  }

  /* Bouton « Voir le tableau » : le tableau reste à un geste */
  function repliBtn(id, texte) { return '<button class="lien lien--tab" type="button" data-repli="' + id + '" aria-expanded="false" aria-controls="' + id + '">' + N.ico('table') + '<span class="t">' + texte + '</span></button>'; }

  var CATS = [['remboursables', 1], ['generiques', 2], ['biosimilaires', 3], ['parapharmacie', 4], ['conseil', 5], ['materiel', 6]];
  function tableCategories(o) {
    var h = '<div class="tabcat">';
    o.cats.forEach(function (c, k) {
      var part = o.ca > 0 ? c.montant / o.ca * 100 : 0;
      h += '<div class="tab tab--cat"><span class="nom"><i class="dot" style="--k:var(--ramp-' + (k + 1) + ')"></i>' + esc(c.nom) + '<span data-interne class="repere" style="display:block;font-weight:400;font-size:13px;line-height:18px;color:var(--gris-lib)">moyenne de nos clients : ' + N.eur(c.moyenneClients) + '</span></span><span class="mini"><i style="width:' + part.toFixed(1) + '%;background:var(--ramp-' + (k + 1) + ')"></i></span><span class="num">' + N.eur(c.montant) + '<span style="display:block;font-size:13px;font-weight:400;color:var(--gris-lib)">' + Math.round(part) + ' % du total</span></span></div>';
      if (c.parGeneriqueur) c.parGeneriqueur.forEach(function (g) {
        h += '<div class="tab tab--cat sous"><span class="nom">' + esc(g.nom) + '</span><span></span><span class="num" style="font-weight:400">' + N.eur(g.montant) + '</span></div>';
      });
    });
    return h + '</div>';
  }
  function categories(o) {
    var p = o.prospect;
    var h = '<section class="cadre" id="bloc-cat"><header><div><h2>Par catégorie</h2><p class="st">Part du chiffre d’affaires · janv.–oct. 2026</p></div></header>';
    if (p) return h + '<p class="vide-mini">Aucune vente à ce jour.</p></section>';
    var top = o.cats.slice().sort(function (a, b) { return b.montant - a.montant; })[0];
    h += '<h3 class="concl">' + esc(top.nom) + ' : ' + Math.round(top.montant / o.ca * 100) + ' % ' + vv('de ses achats', 'de vos achats') + '</h3>';
    h += '<div class="donut-corps"><div class="gr gr--donut"><canvas id="cv-donut" role="img" aria-label="Parts du chiffre d’affaires par catégorie"></canvas><div class="donut-c"><span>Chiffre d’affaires</span><b>' + N.eur(o.ca) + '</b></div></div><ul class="leg-cat">' +
      o.cats.map(function (c, k) { return '<li><i class="dot dot--g" style="--k:var(--ramp-' + (k + 1) + ')"></i><span class="lc-n">' + esc(c.nom) + '</span><b class="lc-p">' + Math.round(c.montant / o.ca * 100) + ' %</b><span class="lc-e">' + N.eur(c.montant) + '</span></li>'; }).join('') + '</ul></div>';
    h += repliBtn('tab-cat', 'Voir le tableau') + '<div id="tab-cat" hidden>' + tableCategories(o) + '</div></section>';
    return h;
  }
  function comparaisonCats(o) {
    var h = '<section class="cadre" id="bloc-cmpcat"><header><div><h2>' + vv('Elle et nos clients, par catégorie', 'Vos achats par catégorie') + '</h2><p class="st">Quatre premières catégories · janv.–oct. 2026</p></div></header>';
    if (o.prospect) return h + '<p class="vide-mini">Aucune vente à ce jour.</p></section>';
    var best = null; o.cats.slice(0, 4).forEach(function (c) { var r = c.montant / c.moyenneClients; if (!best || r > best.r) best = { r: r, c: c }; });
    h += '<h3 class="concl"><span class="vi">' + esc(best.c.nom) + ' : ' + N.nb(best.r) + ' fois la moyenne de nos clients</span><span class="vp">Médicaments remboursables : ' + Math.round(o.cats[0].montant / o.ca * 100) + ' % de vos achats</span></h3>' +
      '<div class="leg"><span class="lg2"><i class="dot dot--g" style="--k:var(--c-ca)"></i>' + vv('L’officine', 'Vos achats') + '</span><span class="lg2" data-interne><i class="dot dot--m"></i>Moyenne de nos clients</span></div>' +
      '<div class="gr gr--twin"><canvas id="cv-twin" role="img" aria-label="Achats par catégorie comparés à la moyenne de nos clients"></canvas></div></section>';
    return h;
  }

  function position(o) {
    var h = '<section class="cadre" id="bloc-pos"><header><div><h2>' + vv('Sa place parmi nos clients', 'Votre place parmi nos clients') + '</h2><p class="st">Nos ' + N.nb(M.nClients) + ' clients par tranche de chiffre d’affaires cumulé, janv.–oct. 2026</p></div></header>';
    if (o.prospect) return h + '<p class="vide-mini">Aucune vente à ce jour : pas encore de place dans le classement.</p></section>';
    var r = o.rang.france, rt = r ? '<b>' + r + (r === 1 ? 're' : 'e') + '</b> sur ' + N.nb(o.rang.surFrance) : '';
    h += '<h3 class="concl"><span class="vi">' + (r ? 'Elle est ' + (r === 1 ? '1re' : r + 'e') + ' sur ' + N.nb(o.rang.surFrance) + ' : ' : '') + N.fois2txt(o.ca, M.caMois * N.nbMois) + '</span><span class="vp">Votre place : ' + (r ? (r === 1 ? '1re' : r + 'e') + ' sur ' + N.nb(o.rang.surFrance) + ' officines actives' : 'parmi nos clients') + '</span></h3>';
    h += '<div class="gr gr--pos"><canvas id="cv-pos" role="img" aria-label="Répartition de nos clients par tranche de chiffre d’affaires"></canvas></div></section>';
    return h;
  }
  N.fois2txt = function (v, moy) { var r = v / moy; return (r >= 10 ? N.nb(r) : N.nb1(r)) + ' fois la moyenne de nos clients'; };

  function top10(o) {
    return '<section class="cadre"><header><div><h2>Top 10 par catégorie</h2><p class="st">Famille de produits · ' + vv('ses', 'vos') + ' achats, janv.–oct. 2026</p></div></header><ol class="top">' +
      (o.top10.length ? o.top10.map(function (p, i) {
        return '<li><span class="rg" style="--k:var(--enc-4)">' + (i + 1) + '</span><span class="pn" style="font-weight:600">' + esc(p.nom) + '<span class="pf" style="display:block;font-weight:400;font-size:13px;line-height:18px;color:var(--gris-lib)">' + esc(p.famille) + '</span></span><span class="num">' + N.eur(p.montant) + '<span class="q">' + N.nb(p.quantite) + ' boîtes</span></span></li>';
      }).join('') : '<li><span></span><span class="vide-mini">Aucun produit commandé.</span><span></span></li>') + '</ol></section>';
  }

  /* Frise des mois commandés (reconstituée : la donnée ne donne que la dernière commande) */
  function frise(nom, der) {
    var last = new Date(der + 'T12:00:00').getMonth(), h = 0, i; for (i = 0; i < nom.length; i++) h = (h * 31 + nom.charCodeAt(i)) % 97;
    var hole = last - 1 - (h % 3), cells = '', lib = [];
    for (i = 0; i < 10; i++) {
      var on = i <= last && i >= last - 4 && i !== hole;
      if (on) lib.push(MOISL[i]);
      cells += '<i class="' + (on ? 'on' : '') + '" title="' + MOISL[i] + (on ? ' : commandé' : ' : rien') + '"></i>';
    }
    return '<span class="frise" role="img" aria-label="Commandé en ' + lib.join(', ') + '">' + cells + '</span>';
  }
  function nePlus(o) {
    var h = '<section class="cadre"><header><div><h2>' + vv('Ne commande plus', 'Ce que vous ne commandez plus') + '</h2><p class="st">Commandé au moins 4 mois sur les 10 derniers, absent d’octobre · case pleine : mois avec commande</p></div>' +
      (o.nePlus.length ? '<span class="pastille pastille--bad">' + N.ico('dn') + o.nePlus.length + ' produits</span>' : '') + '</header>';
    if (o.nePlus.length) {
      h += '<div class="np np--h"><span>Produit</span><span class="np-fr"><span class="mm" aria-hidden="true">' + 'JFMAMJJASO'.split('').map(function (l) { return '<i>' + l + '</i>'; }).join('') + '</span></span><span class="np-d">Dernière commande</span></div>';
      h += o.nePlus.map(function (p) { return '<div class="np"><span class="pn" style="font-weight:600">' + esc(p.nom) + '</span><span class="np-fr">' + frise(p.nom, p.derniereCommande) + '</span><span class="np-d">le ' + N.mois(p.derniereCommande) + '</span></div>'; }).join('');
    } else h += '<p class="vide-mini">Aucun produit à signaler.</p>';
    return h + (o.nePlus.length ? '<button class="lien" type="button" data-stub="Détail produit par produit : non dessiné dans cette maquette.">Voir le détail produit par produit' + N.ico('next') + '</button>' : '') + '</section>';
  }

  function rendezVous(o) {
    var h = '<section class="cadre" id="bloc-taches" data-interne><header><div><h2>Rendez-vous, tâches et notes</h2><p class="st">Réservé à l’équipe</p></div></header>';
    h += o.rdv ? '<div class="rdv-bloc"><span class="st" style="font-size:13px;color:var(--gris-lib)">Prochain rendez-vous</span><b>' + dateLongue(o.rdv.date) + ' · ' + o.rdv.heure.replace(':', ' h ') + '</b>' + esc(o.rdv.lieu) + ' · ' + esc(o.rdv.objet) + '</div>' : '<p class="vide-mini">Aucun rendez-vous prévu.</p>';
    h += '<ul class="liste-simple">' + (o.taches.length ? o.taches.map(function (t) {
      return '<li><span class="tache' + (t.fait ? ' fait' : '') + '"><span class="case">' + (t.fait ? N.ico('check') : '') + '</span><span class="tx">' + esc(t.texte) + '<small>pour le ' + N.mois(t.echeance) + '</small></span></span></li>';
    }).join('') : '<li class="vide-mini">Aucune tâche.</li>') + '</ul>';
    h += '<ul class="liste-simple" style="margin-top:8px">' + (o.notes.length ? o.notes.map(function (n) { return '<li><span><small>' + N.mois(n.date) + '</small>' + esc(n.texte) + '</span></li>'; }).join('') : '<li class="vide-mini">Aucune note de l’équipe.</li>') + '</ul>';
    h += '<div class="btns"><button class="btn" type="button" data-stub="Tâche : non dessinée dans cette maquette.">' + N.ico('todo') + 'Ajouter une tâche</button><button class="btn" type="button" data-stub="Note : non dessinée dans cette maquette.">' + N.ico('note') + 'Prendre une note</button></div></section>';
    return h;
  }

  /* ---- Tuiles de chiffres clés ---- */
  function commandes(v) { return v > 0 ? Math.max(1, Math.round(v / 2150)) : 0; }
  function tuileF(cls, lab, couleur, serie, total, moyTot, interne, fmt) {
    var p = !(total > 0), f = fmt || 'eur';
    var evo = p ? null : N.evo(serie);
    return '<article class="tuile tuile--' + cls + '"' + (interne ? ' data-interne' : '') + '><p class="t-lab"><i class="dot" style="--k:' + couleur + '"></i>' + lab + '</p>' +
      '<b class="t-val" data-compte="' + Math.round(total) + '" data-fmt="' + f + '">' + (p ? '—' : (f === 'eur' ? N.eur(total) : N.nb(total))) + '</b>' +
      '<p class="t-sous">janv.–oct. 2026' + (p ? '' : '<span data-interne> · ' + N.fois2(total, moyTot).replace(/<[^>]+>/g, '') + '</span>') + '</p>' +
      (p ? '' : '<div class="t-graph">' + N.spark(serie, couleur, 120, 44, lab + ', 10 mois') + '<span class="t-ev">' + N.tendance(evo) + '<small>oct. sur sept.</small></span></div>') + '</article>';
  }
  function tuiles(o) {
    var cmd = o.caParMois.map(commandes), tc = cmd.reduce(function (a, b) { return a + b; }, 0);
    return '<section class="tuiles" aria-label="Chiffres clés">' +
      tuileF('ca', 'Chiffre d’affaires', 'var(--c-ca)', o.caParMois, o.ca, M.caMois * N.nbMois, false) +
      tuileF('nous', 'Notre marge Intégral', 'var(--c-nous)', o.margeNousParMois, o.margeNous, M.margeNousMois * N.nbMois, true) +
      tuileF('ph', 'Marge du pharmacien', 'var(--c-pharma)', o.margePharmacienParMois, o.margePharmacien, M.margePharmacienMois * N.nbMois, false) +
      tuileF('cmd', 'Commandes', 'var(--c-cmd)', cmd, tc, M.caMois * N.nbMois / 2150, false, 'nb') + '</section>';
  }

  /* ---- « Ses chiffres » : graphique des ventes + tableau replié ---- */
  function concl(o) {
    var cm = o.caParMois, n = cm.length, last = cm[n - 1], prev = cm[n - 2], mx = Math.max.apply(null, cm), imx = cm.indexOf(mx);
    var ev = prev > 0 ? Math.round((last - prev) / prev * 100) : 0, ab = Math.abs(ev), rec = function (p) { return imx === n - 2 ? ' après ' + p + ' record de septembre' : (imx !== n - 1 ? ' ; ' + p + ' meilleur mois reste ' + MOISL[imx] : ''); };
    function ph(p) { return p; }
    var t = function (p) {
      if (last === mx) return 'Octobre est ' + p + ' meilleur mois' + (ev > 0 ? ' : ' + ev + ' % de plus que septembre' : '');
      if (ev <= -30) return 'Octobre chute de ' + ab + ' %' + rec(p);
      if (ev < -5) return 'Octobre recule de ' + ab + ' %' + rec(p);
      if (ev <= 5) return 'Octobre reste stable (' + N.pct(ev) + ' sur septembre)';
      return ev >= 30 ? 'Octobre bondit de ' + ev + ' %' : 'Octobre progresse de ' + ev + ' %';
    };
    return vv(t('son'), t('votre'));
  }
  function conclMarges(o) {
    var k = o.ca > 0 ? Math.round(o.margePharmacien / o.ca * 1000) / 10 : 0;
    return '<span class="vi">Sur 10 mois, nous gagnons ' + N.eur(o.margeNous) + ' et le pharmacien ' + N.eur(o.margePharmacien) + '</span><span class="vp">Sur 10 mois, votre marge atteint ' + N.eur(o.margePharmacien) + ', soit ' + N.nb1(k) + ' % de vos achats</span>';
  }
  function finances(o) {
    var cm = o.caParMois, n = cm.length, K = 5, st = n - K;
    var moyM = o.ca / n;
    var h = '<section class="cadre fin" id="bloc-chiffres-mois"><header><div><h2>' + vv('Ses chiffres', 'Vos chiffres') + '</h2><p class="st" id="fin-sous">Chiffre d’affaires par mois · janv.–oct. 2026</p></div>' +
      (o.prospect ? '<span class="pastille pastille--neu">Aucune vente</span>' : '<div class="seg2" role="group" aria-label="Chiffre affiché"><button type="button" data-serie="ca" aria-pressed="true">Chiffre d’affaires</button><button type="button" data-serie="marges" aria-pressed="false">Marges</button></div>') + '</header>';
    if (o.prospect) return h + '<p class="vide-mini">Aucune vente à ce jour.</p></section>';
    h += '<h3 class="concl" id="fin-concl">' + concl(o) + '</h3><p class="st" id="fin-detail">Chiffre d’affaires net hors taxes · en moyenne ' + N.eur(moyM) + ' par mois<span data-interne>, soit ' + N.fois2txt(moyM, M.caMois) + ' (' + N.eur(M.caMois) + ')</span></p>' +
      '<div class="leg" id="fin-leg"></div><div class="gr gr--haut"><canvas id="cv-ventes" role="img" aria-label="Chiffre d’affaires des 10 mois"></canvas></div>';
    h += repliBtn('tab-fin', 'Voir le tableau') + '<div id="tab-fin" hidden><div class="pap" role="table" aria-label="Chiffres des cinq derniers mois"><div class="pl pl--h" role="row"><span></span>';
    for (var k = st; k < n; k++) h += '<span class="c">' + o.moisLabels[k] + '</span>';
    h += '<span class="c tot">Total janv.–oct.</span><span class="c moy" data-interne>Moyenne de nos clients</span></div>';
    function lig(lib, arr, tot, moy, interne, bold, couleur) {
      var r = '<div class="pl' + (bold ? ' pl--b' : '') + '"' + (interne ? ' data-interne' : '') + ' role="row"><span class="lib"><i class="dot" style="--k:' + couleur + '"></i>' + lib + '</span>';
      for (var k = st; k < n; k++) r += '<span class="c">' + N.eur(arr[k]) + '</span>';
      return r + '<span class="c tot">' + N.eur(tot) + '</span><span class="c moy" data-interne>' + N.eur(moy) + '</span></div>';
    }
    h += lig('Chiffre d’affaires', cm, o.ca, M.caMois * n, false, true, 'var(--c-ca)');
    h += '<div class="pl pl--evo" role="row"><span class="lib">Évolution sur un mois</span>';
    for (k = st; k < n; k++) { var pr = cm[k - 1], ev = pr > 0 ? Math.round((cm[k] - pr) / pr * 100) : null; h += '<span class="c">' + (ev == null ? '—' : '<span class="pastille pastille--' + (ev >= 0 ? 'ok' : 'bad') + '">' + N.ico(ev >= 0 ? 'up' : 'dn') + N.pct(ev) + '</span>') + '</span>'; }
    h += '<span class="c tot"></span><span class="c moy" data-interne></span></div>';
    h += lig('Marge du pharmacien', o.margePharmacienParMois, o.margePharmacien, M.margePharmacienMois * n, false, false, 'var(--c-pharma)');
    h += lig('Notre marge Intégral', o.margeNousParMois, o.margeNous, M.margeNousMois * n, true, false, 'var(--c-nous)');
    var cmd = cm.map(commandes), tc = cmd.reduce(function (a, b) { return a + b; }, 0);
    h += '<div class="pl" role="row"><span class="lib"><i class="dot" style="--k:var(--c-cmd)"></i>Commandes</span>';
    for (k = st; k < n; k++) h += '<span class="c">' + N.nb(cmd[k]) + '</span>';
    h += '<span class="c tot">' + N.nb(tc) + '</span><span class="c moy" data-interne></span></div></div></div></section>';
    return h;
  }

  /* ================= Graphiques (Chart.js 4.4.4) ================= */
  var charts = [], chV = null;
  N.serie = 'ca';
  function detruire() { charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = []; chV = null; }
  function C0() { return window.Chart.defaults; }
  function cadrer() {
    var C = window.Chart; if (!C) return false;
    var body = getComputedStyle(document.body);
    C.defaults.font.family = body.fontFamily; C.defaults.font.size = 13; C.defaults.color = cv('--ink') || '#1D2433';
    if (N.REDUIT) C.defaults.animation = false;
    C.defaults.plugins.tooltip.titleFont = { size: 14, weight: '700' }; C.defaults.plugins.tooltip.bodyFont = { size: 13 };
    C.defaults.plugins.tooltip.padding = 10; C.defaults.plugins.tooltip.cornerRadius = 8; C.defaults.plugins.tooltip.backgroundColor = '#10131C';
    C.defaults.plugins.tooltip.boxPadding = 4; C.defaults.plugins.tooltip.titleMarginBottom = 6;
    return true;
  }
  var GRILLE = '#E9EDF4', INK = '#1A2030', GRIS = '#9AA1AE', MOYC = '#4A5265';
  function eurT(v) { return N.nb(v) + ' €'; }

  /* Étiquettes directes : on place des rectangles, on décale ceux qui se chevauchent. */
  function poser(ctx, labs, area) {
    labs = labs.filter(function (L) { return isFinite(L.cx) && isFinite(L.by); });
    labs.sort(function (a, b) { return a.cx - b.cx; });
    ctx.save(); ctx.textBaseline = 'alphabetic';
    var fam = C0().font.family;
    labs.forEach(function (L) {
      L.w = Math.max.apply(null, L.l.map(function (t) { ctx.font = (t.b ? '700 14px ' : '400 13px ') + fam; return ctx.measureText(t.t).width; })) + 8;
      L.h = L.l.length * 17 + 2; L.x = L.cx - L.w / 2; L.y = L.by - L.h;
    });
    for (var i = labs.length - 1; i >= 0; i--) {
      var L = labs[i]; if (L.x + L.w > area.right) L.x = area.right - L.w; if (L.x < area.left) L.x = area.left;
      if (i < labs.length - 1) { var R = labs[i + 1]; if (L.x + L.w + 3 > R.x && L.y < R.y + R.h && L.y + L.h > R.y) L.x = R.x - L.w - 3; }
      if (L.x < area.left) L.x = area.left;
    }
    labs.forEach(function (L) {
      if (L.fil) { ctx.strokeStyle = '#4F5668'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(L.cx, L.y + L.h + 3); ctx.lineTo(L.cx, L.fil - 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(L.x, L.y - 1, L.w, L.h + 3);
      L.l.forEach(function (t, k) { ctx.font = (t.b ? '700 14px ' : '400 13px ') + fam; ctx.fillStyle = t.c || INK; ctx.textAlign = 'center'; ctx.fillText(t.t, L.x + L.w / 2, L.y + 13 + k * 17); });
    });
    ctx.restore();
  }

  /* Ventes : barres + moyenne étiquetée + repères record / plus bas / dernier mois */
  var plugVentes = {
    id: 'etiqVentes',
    afterDatasetsDraw: function (ch) {
      var o = ch.options.plugins.etiqVentes || {}, ctx = ch.ctx, a = ch.chartArea, y = ch.scales.y, integral = N.vue === 'integral';
      var large = ch.width > 640, fam = C0().font.family;
      if (integral && o.moy > 0) {
        var py = y.getPixelForValue(o.moy);
        ctx.save(); ctx.strokeStyle = MOYC; ctx.lineWidth = 1.5; ctx.setLineDash([7, 4]); ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right + (large ? 10 : 0), py); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = MOYC; ctx.textAlign = 'left'; ctx.font = '700 13px ' + fam;
        if (large) { ctx.fillText('Moyenne de nos clients', a.right + 14, py - 3); ctx.font = '400 13px ' + fam; ctx.fillText(o.moyTxt, a.right + 14, py + 14); }
        else { var tx = 'Moyenne : ' + o.moyTxt.replace(' par mois', ''), w = ctx.measureText(tx).width + 12; ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.fillRect(a.left + 4, py - 24, w, 20); ctx.fillStyle = MOYC; ctx.fillText(tx, a.left + 10, py - 9); }
        ctx.restore();
      }
      if (o.marks) {
        var labs = [], meta = ch.getDatasetMeta(0);
        o.marks.forEach(function (m) { var el = meta.data[m.i]; if (!el || !isFinite(el.x) || !isFinite(el.y)) return; var haut = !large && el.y > a.top + 70; labs.push({ cx: el.x, by: haut ? a.top - 6 : el.y - 6, l: [{ t: m.tag, c: '#4F5668' }, { t: eurT(m.v), b: true }], fil: haut ? el.y : null }); });
        poser(ctx, labs, a);
      }
    }
  };
  function creerVentes(o) {
    var cv0 = document.getElementById('cv-ventes'); if (!cv0) return;
    if (chV) { chV.destroy(); charts.splice(charts.indexOf(chV), 1); chV = null; }
    var m = N.serie === 'ca', cm = o.caParMois, n = cm.length, mx = Math.max.apply(null, cm), mn = Math.min.apply(null, cm), imx = cm.indexOf(mx), imn = cm.indexOf(mn);
    var ds, marks = null, moy = 0, moyTxt = '', moyLib = 'Moyenne de nos clients';
    if (m) {
      ds = [{ label: 'Chiffre d’affaires', data: cm, backgroundColor: cv('--c-ca'), borderRadius: { topLeft: 4, topRight: 4 }, maxBarThickness: 64, categoryPercentage: .72, barPercentage: .9 }];
      marks = []; var vus = {};
      var add = function (i, tag) { if (vus[i]) { vus[i].tag += ' · ' + tag.toLowerCase(); return; } vus[i] = { i: i, tag: tag, v: cm[i] }; marks.push(vus[i]); };
      add(imx, 'Record');
      if (imn !== imx && imn !== n - 1) add(imn, 'Plus bas');
      if (n - 1 !== imx) add(n - 1, 'Dernier mois');
      moy = M.caMois; moyTxt = N.eur(M.caMois) + ' par mois';
    } else {
      ds = [{ label: 'Marge du pharmacien', data: o.margePharmacienParMois, backgroundColor: cv('--c-pharma'), borderRadius: { topLeft: 4, topRight: 4 }, maxBarThickness: 40, categoryPercentage: .78, barPercentage: .9 },
        { label: 'Notre marge Intégral', data: o.margeNousParMois, backgroundColor: cv('--c-nous'), borderRadius: { topLeft: 4, topRight: 4 }, maxBarThickness: 40, categoryPercentage: .78, barPercentage: .9, interne: true, hidden: N.vue === 'pharmacien' }];
      moy = M.margePharmacienMois; moyTxt = N.eur(M.margePharmacienMois) + ' par mois'; moyLib = 'Moyenne de nos clients';
      var mp = o.margePharmacienParMois, ip = mp.indexOf(Math.max.apply(null, mp));
      marks = [{ i: ip, tag: 'Record', v: mp[ip] }]; if (ip !== n - 1) marks.push({ i: n - 1, tag: 'Dernier mois', v: mp[n - 1] });
    }
    var ch = new window.Chart(cv0, {
      type: 'bar', data: { labels: o.moisLabels, datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false, layout: { padding: { top: 46, right: cv0.parentNode.clientWidth > 640 ? 172 : 0 } },
        interaction: { mode: 'index', intersect: false },
        scales: { x: { grid: { display: false }, border: { color: '#C9D1DE' }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 13 }, callback: function (v) { var l = this.getLabelForValue(v); return cv0.parentNode.clientWidth < 500 ? l.charAt(0).toUpperCase() : l; } } },
          y: { beginAtZero: true, grid: { color: GRILLE }, border: { display: false }, ticks: { maxTicksLimit: 5, callback: function (v) { return eurT(v); }, font: { size: 13 } } } },
        plugins: {
          legend: { display: false },
          etiqVentes: { marks: marks, moy: moy, moyTxt: moyTxt, moyLib: moyLib },
          tooltip: { callbacks: {
            title: function (it) { var l = MOISL[it[0].dataIndex]; return l.charAt(0).toUpperCase() + l.slice(1) + ' 2026'; },
            label: function (c) { return ' ' + c.dataset.label + ' : ' + eurT(c.parsed.y); },
            afterBody: function (it) {
              if (N.vue !== 'integral') return '';
              var i = it[0].dataIndex, out = [];
              if (N.serie === 'ca') { var d = cm[i] - M.caMois; out.push('Moyenne de nos clients : ' + eurT(M.caMois)); out.push('Écart : ' + (d >= 0 ? '+' : '−') + eurT(Math.abs(d))); }
              else out.push('Moyenne de nos clients : ' + eurT(M.margePharmacienMois) + ' (pharmacien), ' + eurT(M.margeNousMois) + ' (nous)');
              return out;
            } } }
        }
      }, plugins: [plugVentes]
    });
    charts.push(ch); chV = ch;
    document.getElementById('fin-leg').innerHTML = m ? '<span class="lg2"><i class="dot dot--g" style="--k:var(--c-ca)"></i>Chiffre d’affaires</span><span class="lg2" data-interne><i class="dot dot--l"></i>Moyenne de nos clients</span>'
      : '<span class="lg2"><i class="dot dot--g" style="--k:var(--c-pharma)"></i>Marge du pharmacien</span><span class="lg2" data-interne><i class="dot dot--g" style="--k:var(--c-nous)"></i>Notre marge Intégral</span><span class="lg2" data-interne><i class="dot dot--l"></i>Moyenne de nos clients (marge du pharmacien)</span>';
    document.getElementById('fin-concl').innerHTML = m ? concl(o) : conclMarges(o);
    document.getElementById('fin-sous').textContent = m ? 'Chiffre d’affaires par mois · janv.–oct. 2026' : 'Marges par mois, en euros, sur la même échelle · janv.–oct. 2026';
    document.getElementById('fin-detail').hidden = !m;
    Array.prototype.forEach.call(document.querySelectorAll('[data-serie]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-serie') === N.serie ? 'true' : 'false'); });
  }

  function creerDonut(o) {
    var c = document.getElementById('cv-donut'); if (!c) return;
    var cols = o.cats.map(function (x, k) { return cv('--ramp-' + (k + 1)); });
    charts.push(new window.Chart(c, { type: 'doughnut', data: { labels: o.cats.map(function (x) { return x.nom; }), datasets: [{ data: o.cats.map(function (x) { return x.montant; }), backgroundColor: cols, borderColor: '#fff', borderWidth: 3, hoverOffset: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (it) { return ' ' + it.label + ' : ' + eurT(it.parsed) + ' (' + Math.round(it.parsed / o.ca * 100) + ' %)'; } } } } } }));
  }

  var plugTwin = {
    id: 'etiqTwin',
    afterDatasetsDraw: function (ch) {
      var ctx = ch.ctx, fam = C0().font.family; ctx.save(); ctx.fillStyle = INK; ctx.textBaseline = 'middle';
      ch.data.datasets.forEach(function (d, di) {
        if (!ch.isDatasetVisible(di)) return;
        ch.getDatasetMeta(di).data.forEach(function (el, i) { ctx.font = (di ? '400 ' : '700 ') + '13px ' + fam; ctx.fillText(eurT(d.data[i]), el.x + 6, el.y); });
      });
      ctx.restore();
    }
  };
  function creerTwin(o) {
    var c = document.getElementById('cv-twin'); if (!c) return;
    var q = o.cats.slice(0, 4), cols = q.map(function () { return cv('--c-ca'); });
    charts.push(new window.Chart(c, { type: 'bar',
      data: { labels: q.map(function (x) { return x.nom; }), datasets: [
        { label: 'Cette officine', data: q.map(function (x) { return x.montant; }), backgroundColor: cols, borderRadius: { topRight: 4, bottomRight: 4 }, barThickness: 16 },
        { label: 'Moyenne de nos clients', data: q.map(function (x) { return x.moyenneClients; }), backgroundColor: GRIS, borderRadius: { topRight: 4, bottomRight: 4 }, barThickness: 16, interne: true, hidden: N.vue === 'pharmacien' }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 84 } }, interaction: { mode: 'index', intersect: false },
        scales: { x: { beginAtZero: true, grid: { color: GRILLE }, border: { display: false }, ticks: { maxTicksLimit: 4, callback: function (v) { return eurT(v); } } }, y: { grid: { display: false }, ticks: { font: { size: 13 }, callback: function (v) { var t = this.getLabelForValue(v), s = t.lastIndexOf(' ', 16); return t.length > 16 && s > 0 ? [t.slice(0, s), t.slice(s + 1)] : t; } } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (it) { return ' ' + it.dataset.label + ' : ' + eurT(it.parsed.x); }, afterBody: function (it) { var i = it[0].dataIndex; return N.vue === 'integral' ? ['Écart : × ' + N.nb1(q[i].montant / q[i].moyenneClients) + ' la moyenne'] : ''; } } } } },
      plugins: [plugTwin] }));
  }

  /* Position parmi nos clients : répartition fictive mais plausible (la moyenne tombe dans la tranche 75 000 – 100 000 €) */
  var BORNES = [0, 25000, 50000, 75000, 100000, 150000, 200000, 300000, 500000, 1000000];
  var EFFECTIF = [610, 520, 330, 210, 190, 110, 70, 38, 16, 5];
  function tranche(v) { var i = 0; for (var k = 0; k < BORNES.length; k++) if (v >= BORNES[k]) i = k; return i; }
  var plugPos = {
    id: 'etiqPos',
    afterDatasetsDraw: function (ch) {
      var o = ch.options.plugins.etiqPos, ctx = ch.ctx, a = ch.chartArea, meta = ch.getDatasetMeta(0), fam = C0().font.family;
      var el = meta.data[o.ici]; if (!el) return;
      ctx.save(); ctx.font = '700 13px ' + fam; ctx.textBaseline = 'middle';
      var rects = [];
      if (N.vue === 'integral') {
        var mi = meta.data[o.moyI], band = mi.width / .94, frac = (M.caMois * N.nbMois - BORNES[o.moyI]) / (BORNES[o.moyI + 1] - BORNES[o.moyI]);
        var mxp = mi.x - band / 2 + band * frac;
        ctx.strokeStyle = MOYC; ctx.lineWidth = 1.5; ctx.setLineDash([7, 4]); ctx.beginPath(); ctx.moveTo(mxp, a.top + 30); ctx.lineTo(mxp, a.bottom); ctx.stroke(); ctx.setLineDash([]);
        var tx = 'Moyenne de nos clients · ' + N.eur(M.caMois * N.nbMois), w = ctx.measureText(tx).width + 14, lx = mxp + 6;
        if (lx + w > a.right) lx = mxp - 6 - w;
        ctx.fillStyle = '#fff'; ctx.fillRect(lx, a.top + 2, w, 26); ctx.strokeStyle = MOYC; ctx.lineWidth = 1; ctx.strokeRect(lx + .5, a.top + 2.5, w - 1, 25); ctx.fillStyle = MOYC; ctx.fillText(tx, lx + 7, a.top + 15.5);
        rects.push([lx, a.top + 2, w, 26]);
      }
      var t2 = N.vue === 'integral' ? o.txt : o.txtP, w2 = ctx.measureText(t2).width + 18, by = Math.min(el.y - 14, a.bottom - 36), ry = by - 28, bx = el.x - w2 / 2;
      if (bx + w2 > a.right + 4) bx = a.right + 4 - w2; if (bx < a.left) bx = a.left;
      rects.forEach(function (r) { if (bx < r[0] + r[2] && bx + w2 > r[0] && ry < r[1] + r[3] && ry + 28 > r[1]) ry = r[1] + r[3] + 8; });
      ctx.fillStyle = '#fff'; ctx.strokeStyle = cv('--c-ca'); ctx.lineWidth = 2; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, ry, w2, 28, 14); else ctx.rect(bx, ry, w2, 28); ctx.fill(); ctx.stroke();
      var ax = Math.max(bx + 14, Math.min(el.x, bx + w2 - 14)); ctx.beginPath(); ctx.moveTo(ax - 7, ry + 28); ctx.lineTo(ax + 7, ry + 28); ctx.lineTo(ax, ry + 36); ctx.closePath(); ctx.fillStyle = cv('--c-ca'); ctx.fill();
      ctx.fillStyle = INK; ctx.fillText(t2, bx + 9, ry + 14.5);
      ctx.restore();
    }
  };
  function creerPos(o) {
    var c = document.getElementById('cv-pos'); if (!c) return;
    var ici = tranche(o.ca), moyI = tranche(M.caMois * N.nbMois), r = o.rang.france, rg = r ? (r === 1 ? '1re' : r + 'e') + ' sur ' + N.nb(o.rang.surFrance) : '';
    var cols = EFFECTIF.map(function (v, k) { return k === ici ? cv('--c-ca') : '#C3CBDA'; });
    charts.push(new window.Chart(c, { type: 'bar',
      data: { labels: BORNES.map(function (b) { return N.nb(b); }), datasets: [{ label: 'Clients', data: EFFECTIF, backgroundColor: cols, borderRadius: { topLeft: 4, topRight: 4 }, categoryPercentage: .94, barPercentage: .94 }] },
      options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 56 } }, interaction: { mode: 'index', intersect: false },
        scales: { x: { grid: { display: false }, border: { color: '#C9D1DE' }, ticks: { maxRotation: 0, autoSkip: true }, title: { display: true, text: 'Tranche de chiffre d’affaires cumulé, à partir de (€)', color: '#4F5668' } }, y: { beginAtZero: true, grid: { color: GRILLE }, border: { display: false }, max: 700, ticks: { maxTicksLimit: 4 }, title: { display: true, text: 'Nombre de clients', color: '#4F5668' } } },
        plugins: { legend: { display: false }, etiqPos: { ici: ici, moyI: moyI, txt: 'Elle est ici' + (rg ? ' · ' + rg : ''), txtP: 'Vous êtes ici' + (rg ? ' · ' + rg : '') },
          tooltip: { callbacks: { title: function (it) { var i = it[0].dataIndex; return i === BORNES.length - 1 ? 'À partir de ' + eurT(BORNES[i]) : 'De ' + eurT(BORNES[i]) + ' à ' + eurT(BORNES[i + 1]); }, label: function (it) { return ' ' + N.nb(it.parsed.y) + ' clients' + (it.dataIndex === ici ? ' · dont cette officine' : ''); } } } } },
      plugins: [plugPos] }));
  }
  N.detruire = detruire;
  N.graphiques = function () {
    detruire(); var o = N.curO; if (!o || !cadrer()) return;
    try { if (!o.prospect) { creerVentes(o); creerDonut(o); creerTwin(o); creerPos(o); } } catch (e) { console.error(e); }
  };

  function ident(o) {
    var i = o.i, cl = N.statutCls(o.row), d = o.dernierMois, ev = d.evolutionSurMoisPrecedent;
    var h = '<section class="ident"><div class="ident-nom"><h1>' + esc(N.titre(o.nom)) + '</h1><div class="ident-meta"><span class="pastille pastille--' + cl + '">' + N.ico('check') + N.statutMot(o.row) + '</span>' +
      '<span data-interne>CIP ' + esc(i.cip) + '</span></div>';
    h += '<p class="dernier">' + (o.prospect ? '<span>Aucune vente à ce jour</span>' : '<span>' + vv('Oct. 2026', 'Votre mois d’octobre 2026') + ' :</span> <b data-compte="' + d.ca + '" data-fmt="eur">' + N.eur(d.ca) + '</b>' + (ev != null ? '<span class="pastille pastille--' + (ev >= 0 ? 'ok' : 'bad') + '">' + N.pct(ev) + ' sur sept.</span>' : '')) + '</p></div>';
    h += '<dl class="kv">' + kv('Ville', esc(i.cp + ' ' + i.ville)) + kv('Adresse', esc(i.adresse)) + kv('Titulaire', esc(i.titulaires)) +
      kv('Groupement', esc(o.groupement)) + kv('Téléphone', esc(i.telephone) + ' · ' + esc(i.portable), true) + kv('E-mail', esc(i.email), true) + '</dl>';
    h += '<div class="ident-act"><button class="btn btn--plein" type="button" data-interne data-stub="Documents et catalogues : non dessiné dans cette maquette.">' + N.ico('clip') + 'Choisir quoi lui transmettre</button>' +
      '<button class="btn" type="button" data-interne data-scroll="bloc-taches">' + N.ico('todo') + 'Ouvrir la liste de tâches</button>' +
      '<button class="btn" type="button" data-stub="Catalogue : non dessiné dans cette maquette.">' + N.ico('monitor') + 'Catalogue pour ' + esc(o.catalogue.logiciel) + '</button></div></section>';
    return h;
  }

  /* Barre collante : apparaît quand la carte d'identité sort de l'écran par le haut. */
  var ioId = null;
  function collante(o) {
    var c = document.getElementById('collante'), i = o.i, cl = N.statutCls(o.row);
    c.innerHTML = '<div class="wrap"><button class="btn btn--retour" type="button" data-action="retour" aria-label="Retour à la liste des officines">' + N.ico('back') + '</button>' +
      '<span class="c-nom">' + esc(N.titre(o.nom)) + '</span><span class="pastille pastille--' + cl + '">' + N.statutMot(o.row) + '</span>' +
      '<div class="c-act"><button class="btn btn--plein" type="button" data-interne data-stub="Documents et catalogues : non dessiné dans cette maquette." aria-label="Choisir quoi lui transmettre">' + N.ico('clip') + '<span class="t">Quoi lui transmettre</span></button>' +
      '<button class="btn" type="button" data-interne data-scroll="bloc-taches" aria-label="Ouvrir la liste de tâches">' + N.ico('todo') + '<span class="t">Tâches</span></button>' +
      '<button class="btn" type="button" data-stub="Catalogue : non dessiné dans cette maquette." aria-label="Catalogue pour ' + esc(o.catalogue.logiciel) + '">' + N.ico('monitor') + '<span class="t">Catalogue</span></button></div></div>';
    N.icones(c);
    c.classList.remove('on'); c.setAttribute('aria-hidden', 'true');
    if (ioId) ioId.disconnect();
    var idEl = document.querySelector('.ident'); if (!idEl || !window.IntersectionObserver) return;
    ioId = new IntersectionObserver(function (es) {
      var e = es[es.length - 1], on = !e.isIntersecting && e.boundingClientRect.bottom < 90;
      c.classList.toggle('on', on); c.setAttribute('aria-hidden', on ? 'false' : 'true');
    }, { threshold: 0, rootMargin: '-60px 0px 0px 0px' });
    ioId.observe(idEl);
  }
  N.rendreFiche = function (o) {
    N.curO = o;
    var h = ident(o);
    h += tuiles(o);
    h += '<div class="rang">' + carteProposer('Meilleures ventes nationales', 'Réseau Intégral', o.reseau, '', o) +
      carteProposer('Listing ' + (o.groupe ? esc(o.groupe.groupement) : 'du groupe d’achat'), 'Groupe d’achat', o.groupe, 'Sans groupement : aucun listing de groupe d’achat.', o) + '</div>';
    h += finances(o);
    h += '<div class="rang">' + categories(o) + comparaisonCats(o) + '</div>';
    h += position(o);
    h += '<div class="rang">' + chiffres(o) + coordonnees(o) + '</div>';
    h += '<div class="rang">' + top10(o) + rendezVous(o) + '</div>';
    h += nePlus(o);
    h += '<div class="repli-barre">' + repliBtn('tab-mois', 'Voir les tableaux mois par mois') + '</div><div class="rang" id="tab-mois" hidden>' + moisTab(o) + margeTab(o) + '</div>';
    var f = document.getElementById('fiche'); f.innerHTML = h;
    Array.prototype.forEach.call(f.querySelectorAll('.rang,.ident'), function (b, i) { b.style.animation = 'arrive .6s var(--ease) both'; b.style.animationDelay = (i * 70) + 'ms'; });
    var dl = document.getElementById('autres'); if (!dl.children.length) dl.innerHTML = N.D.officines.map(function (x) { return '<option value="' + esc(N.titre(x.nom)) + '">'; }).join('');
    document.getElementById('autre').value = '';
    collante(o);
  };
  N.surVue = function (v) {
    charts.forEach(function (c) { c.data.datasets.forEach(function (d) { if (d.interne) d.hidden = (v === 'pharmacien'); }); c.update('none'); });
    var p = document.getElementById('phrase-vue');
    if (p) p.textContent = v === 'integral' ? 'Vue Intégral : notre marge seule, comparée à nos clients. À ne pas lui montrer.' : 'Vue pharmacien : rien d’interne à l’écran, vous pouvez la lui montrer.';
  };
  document.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('[data-scroll]'); if (!s) return;
    var t = document.getElementById(s.getAttribute('data-scroll')); if (t) t.scrollIntoView({ behavior: N.REDUIT ? 'auto' : 'smooth', block: 'start' });
  });
  document.getElementById('autre').addEventListener('change', function (e) {
    var v = e.target.value.trim().toLowerCase(), r = N.D.officines.filter(function (x) { return N.titre(x.nom).toLowerCase() === v; })[0]; if (r) N.ouvrir(r.id);
  });
  function fermerMenus(sauf) { Array.prototype.forEach.call(document.querySelectorAll('.dl-menu'), function (m) { if (m !== sauf && !m.hidden) { m.hidden = true; m.previousElementSibling.setAttribute('aria-expanded', 'false'); } }); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-dl]');
    if (b) { var m = b.nextElementSibling; fermerMenus(m); m.hidden = !m.hidden; b.setAttribute('aria-expanded', m.hidden ? 'false' : 'true'); return; }
    fermerMenus(null);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermerMenus(null); });
  document.addEventListener('click', function (e) {
    var r = e.target.closest && e.target.closest('[data-repli]'), sb = e.target.closest && e.target.closest('[data-serie]');
    if (r) { var t = document.getElementById(r.getAttribute('data-repli')); t.hidden = !t.hidden; r.setAttribute('aria-expanded', t.hidden ? 'false' : 'true'); var tt = r.querySelector('.t'); tt.textContent = tt.textContent.replace(t.hidden ? /^Masquer/ : /^Voir/, t.hidden ? 'Voir' : 'Masquer'); }
    if (sb && N.curO) { N.serie = sb.getAttribute('data-serie'); creerVentes(N.curO); }
  });
  M01.rappel(); M01.listeRendre(); N.demarrer();
})();

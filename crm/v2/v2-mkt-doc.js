/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Marketing — « Créer un document » (maquette m3 « Le document en un écran », choix de Will, 26/10/2026)
   Karine (Android) compose en UN écran un document à remettre à un pharmacien : une base (Offre Sanofi, Offre UPSA,
   Essentiels d'hiver, Vide), un titre, le mode des prix, la liste des produits. L'aperçu est le VRAI rendu « La lumière »
   (v2-mkt-modeles.js) et le PDF est celui des fiches Marketing : le document est enregistré comme une fiche Marketing
   (marketing_items, type « support », theme.doc = { base }) via le store de v2-mkt.js. Aucune copie du store.
   Point d'entrée : V2.mktDoc.ouvrir({ pid, nom, id, base }) — une COUCHE plein écran au-dessus de la page courante.
   Ce qui ne s'imprime jamais : aucun pourcentage (hors dosage dans un nom), aucune règle de calcul, pas de PFHT, pas
   d'abandon de marge, pas de nom de laboratoire. Le nom de l'officine s'affiche ici, jamais sur le document.
   Aucun effet refusé par Safari : pas de flou, pas de texte détouré ; seuls transform et opacity bougent.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  // ── Les bases ──
  // Essentiels d'hiver : 13 codes (CIP/EAN), SANS prix : le tarif vient du catalogue du groupe.
  var HIVER = ['3770027513254', '3700567700890', '3700725031705', '3700298131741', '6939663985086', '6936983105422', '6939663976367',
    '6939663976374', '6971348761301', '6939663978309', '6921756492274', '6939663985307', '6939663978415'];
  var BASES = [
    { k: 'sanofi', label: 'Offre Sanofi', titre: 'Offre Sanofi', offre: 'ip_sanofi', mode: 'ppht', nr: false },
    { k: 'upsa', label: 'Offre UPSA', titre: 'Offre UPSA', offre: 'ip_upsa', mode: 'ppht', nr: false },
    { k: 'hiver', label: 'Essentiels d’hiver', titre: 'Essentiels d’hiver', mode: 'net', nr: true },   // produits NR / dispositifs : prix libre, pas de PPHT
    { k: 'vide', label: 'Vide', titre: '', mode: 'ppht', nr: false }
  ];
  var MODES = [
    { k: 'ppht', label: 'PPHT + net' },
    { k: 'net', label: 'Net seul' },
    { k: 'aucun', label: 'Aucun' }
  ];
  // Modèle « La lumière » : 'promo' à partir de 7 produits devient une liste paginée (52 px de vignette) ; en dessous, des cartes.
  // Choix mesuré le 26/10/2026 (rendu PDF réel) : « promo » = liste lisible, 12 lignes puis 13 par page (Sanofi 25 → 2 pages, UPSA 23 → 2) ;
  // « selection » range les produits par rayon (Essentiels d'hiver 13 → 2 pages équilibrées, alors que « promo » laissait 1 ligne seule en page 2) ;
  // « rayons » tient 25 lignes sur 1 page mais en cases vides illisibles : écarté.
  function tplDe(base) { return base === 'hiver' ? 'selection' : 'promo'; }

  function baseDe(k) { for (var i = 0; i < BASES.length; i++) if (BASES[i].k === k) return BASES[i]; return BASES[0]; }

  // ── Fonctions pures (testées dans tests/mkt-doc.test.mjs) ──
  // Réglages de la fiche selon le mode des prix : « PPHT + net » = showPrice ; « Net seul » = showPrice sans PPHT ; « Aucun » = rien.
  function reglagesPrix(mode) {
    if (mode === 'aucun') return { showPrice: false, showPpht: false };
    if (mode === 'net') return { showPrice: true, showPpht: false };
    return { showPrice: true, showPpht: true };
  }
  function modeDe(theme) {   // l'inverse : relit le mode d'une fiche enregistrée
    theme = theme || {};
    if (theme.showPrice === false) return 'aucun';
    if (theme.showPpht === false) return 'net';
    return 'ppht';
  }
  // Prix saisi par Karine : « 1,07 », « 1.07 », « 1,07 € ». null = refusé.
  function lirePrix(txt) {
    var s = String(txt == null ? '' : txt).replace(/\s+/g, '').replace(/€/g, '').replace(',', '.');
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return null;
    var n = Math.round(parseFloat(s) * 100) / 100;
    return n > 0 ? n : null;
  }
  // CIP13 réel d'un code CIP7 : 34009 + CIP7 + clé EAN. (Le fichier des offres écrit « 3400 + CIP7 + 0 », 12 chiffres : faux pour l'affichage.)
  function cip13(cip7) {
    var s = '34009' + String(cip7 || '').replace(/\D/g, ''), t = 0, i;
    if (s.length !== 12) return '';
    for (i = 0; i < 12; i++) t += (+s.charAt(i)) * (i % 2 ? 3 : 1);
    return s + String((10 - t % 10) % 10);
  }
  // Le produit d'une offre officielle : nom, PPHT et net (prix_ip) tels que lus dans MARKETING_IP_OFFERS.
  function produitOffre(o) {
    var cip7 = String(o.cip13 || '').slice(4, 11), c = cip13(cip7) || String(o.cip13 || '');
    return { src: 'produits', key: 'p' + c, id: '', name: o.designation || '', brand: '', ean: '', cip: c,
      price: +o.prix_ip > 0 ? +o.prix_ip : 0, remise: 0, ppht: +o.ppht > 0 ? +o.ppht : 0,
      img: (window.MKT_IMG && window.MKT_IMG[c]) || '', froid: false, cat: '' };
  }
  function offreDe(id) {
    var L = window.MARKETING_IP_OFFERS || [];
    for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
    return null;
  }
  // Le HTML d'un document : le vrai rendu Marketing. it = { title, products, theme }.
  function fiche(S, id) {
    var mode = S.mode, r = reglagesPrix(mode), ps = S.produits.map(function (p) { return Object.assign({}, p); });
    var avecPhoto = ps.some(function (p) { return !!p.img; });
    var b = baseDe(S.base);
    return { id: id || S.id || 'apercu', type: 'support', title: (S.titre || '').trim() || b.titre || 'Document', accroche: '', footer: '',
      status: 'a_envoyer', products: ps, owner: '',
      theme: { accent: '#0050E6', bg: '#FFFFFF', tpl: tplDe(S.base), showPrice: r.showPrice, showPpht: r.showPpht, showRemise: false, showImg: avecPhoto,
               doc: { base: S.base } } };
  }

  V2.mktDoc = V2.mktDoc || {};
  V2.mktDoc._pur = { reglagesPrix: reglagesPrix, modeDe: modeDe, lirePrix: lirePrix, cip13: cip13, produitOffre: produitOffre, fiche: fiche, BASES: BASES, MODES: MODES, HIVER: HIVER, baseDe: baseDe };
  // ═══════════ L'écran ═══════════
  var S = null;          // la couche ouverte (null = fermée)
  var RETOUR_ESSAIS = 10;

  function eur(n) { return V2.fmtEur ? V2.fmtEur(n) : (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €'; }
  function saisie(n) { return n > 0 ? String(n).replace('.', ',') : ''; }
  function cat() { return V2.mkt && V2.mkt.docCatalogue; }
  function nomOfficine(pid) {
    var L = V2.pharmacies || [], i;
    for (i = 0; i < L.length; i++) if (String(L[i].id) === String(pid)) return L[i].name || '';
    return '';
  }

  // ── les produits d'une base, neufs ──
  function appliquerNets() { try { if (window.MARKETING_IP_APPLY_PRIX) window.MARKETING_IP_APPLY_PRIX(); } catch (e) {} }
  function produitsDe(k) {
    var b = baseDe(k), out = [], absents = [];
    if (b.offre) {
      appliquerNets();
      var o = offreDe(b.offre);
      out = ((o && o.products) || []).map(produitOffre);
    } else if (k === 'hiver') {
      var C = cat();
      if (!C || !C.prete()) return { produits: [], attente: true, absents: [] };
      HIVER.forEach(function (c) {
        var l = C.par(c);
        if (l) out.push(V2.mkt.docProduit(l)); else absents.push(c);   // un code introuvable n'est jamais inventé
      });
    }
    return { produits: out, attente: false, absents: absents };
  }
  function sig(d) { return [d.titre, d.mode, d.produits.map(function (p) { return p.key + ':' + p.price + ':' + p.ppht; }).join(',')].join('|'); }
  function brouillonNeuf(k) {
    var b = baseDe(k), r = produitsDe(k);
    return { titre: b.titre, mode: b.mode, produits: r.produits, attente: r.attente, absents: r.absents };
  }
  function charger(k) {   // met le brouillon de la base k dans l'écran (le crée s'il n'existe pas)
    var d = S.drafts[k] || (S.drafts[k] = brouillonNeuf(k));
    S.base = k; S.titre = d.titre; S.mode = d.mode; S.produits = d.produits;
  }
  function ranger() {     // remet l'état de l'écran dans le brouillon de la base courante
    var d = S.drafts[S.base]; if (!d) return;
    d.titre = S.titre; d.mode = S.mode; d.produits = S.produits;
  }
  function modifie() {
    var d = S.drafts[S.base]; if (!d) return false;
    return sig({ titre: S.titre, mode: S.mode, produits: S.produits }) !== sig(brouillonNeuf(S.base));
  }
  function aModifieQuelqueChose() {
    ranger();
    return Object.keys(S.drafts).some(function (k) { return sig(S.drafts[k]) !== sig(brouillonNeuf(k)); });
  }
  function netManquant() {
    return baseDe(S.base).offre && S.produits.length && S.produits.some(function (p) { return !(p.price > 0); });
  }

  // ── attente des données qui arrivent après l'ouverture : prix nets protégés, catalogue du groupe ──
  function rattraper() {
    if (!S) return;
    var change = false;
    ranger(); appliquerNets();
    Object.keys(S.drafts).forEach(function (k) {
      var d = S.drafts[k], b = baseDe(k);
      if (b.offre) {   // le net arrivé après l'ouverture se colle sur les lignes encore vides (jamais sur un prix que Karine a saisi)
        var neuf = produitsDe(k).produits, nets = {};
        neuf.forEach(function (p) { if (p.price > 0) nets[p.cip] = p.price; });
        d.produits.forEach(function (p) { if (!(p.price > 0) && nets[p.cip]) { p.price = nets[p.cip]; change = true; } });
      } else if (k === 'hiver' && d.attente) {
        var r = produitsDe('hiver');
        if (!r.attente) { d.produits = r.produits; d.absents = r.absents; d.attente = false; change = true; }
      }
    });
    if (change) { var c = S.drafts[S.base]; if (c) { S.produits = c.produits; } peindre(); }
  }
  function surveiller() {
    var n = 0;
    clearInterval(S.minuteur);
    S.minuteur = setInterval(function () {
      if (!S) return;
      n++;
      var attend = Object.keys(S.drafts).some(function (k) { var d = S.drafts[k]; return d.attente || (baseDe(k).offre && d.produits.some(function (p) { return !(p.price > 0); })); });
      if (attend) rattraper();
      if (!attend || n >= RETOUR_ESSAIS * 3) clearInterval(S.minuteur);
    }, 1500);
  }
  function chargerCatalogue(apres) {
    var C = cat();
    if (!C) { if (apres) apres(false); return; }
    if (C.prete()) { if (apres) apres(true); return; }
    S.catEtat = 'charge'; peindre();
    C.charger(function (ok) { if (!S) return; S.catEtat = ok ? 'ok' : 'echec'; rattraper(); peindre(); if (apres) apres(ok); });
  }

  // ── le HTML de l'écran ──
  var IC = function (n, s, w) { return (V2.mktSocle && V2.mktSocle.ic) ? V2.mktSocle.ic(n, s, w) : ''; };
  function htmlBases() {
    return BASES.map(function (b) {
      return '<button type="button" class="mkd-base mk-press" data-act="base" data-k="' + b.k + '" aria-pressed="' + (S.base === b.k ? 'true' : 'false') + '">' + esc(b.label) + '</button>';
    }).join('');
  }
  function htmlPrix() {
    var i = 0, b = baseDe(S.base);
    MODES.forEach(function (m, n) { if (m.k === S.mode) i = n; });
    return '<div class="mk-seg mkd-seg" role="group" aria-label="Prix sur le document" style="--n:3;--i:' + i + '"><i class="mk-seg-ind"></i>' +
      MODES.map(function (m) {
        var grise = b.nr && m.k === 'ppht';
        return '<button type="button" data-act="mode" data-k="' + m.k + '" aria-pressed="' + (S.mode === m.k ? 'true' : 'false') + '"' + (grise ? ' aria-disabled="true" class="mkd-grise"' : '') + '>' + esc(m.label) + '</button>';
      }).join('') + '</div>' +
      (S.msgMode ? '<p class="mkd-note mkd-note-ambre" role="status">' + esc(S.msgMode) + '</p>' : '');
  }
  function puce(p, champ) {
    var v = champ === 'ppht' ? p.ppht : p.price, mod = p._mod && p._mod[champ];
    return '<button type="button" class="mkd-puce' + (champ === 'ppht' ? ' mkd-puce-ppht' : '') + (mod ? ' mkd-puce-mod' : '') + (v > 0 ? '' : ' mkd-puce-vide') + '" data-act="px" data-key="' + esc(p.key) + '" data-champ="' + champ + '" aria-label="' +
      esc((champ === 'ppht' ? 'PPHT' : 'Prix net') + ' de ' + p.name + ' : ' + (v > 0 ? eur(v) : 'non renseigné') + '. Toucher pour le changer') + '">' +
      '<small>' + (champ === 'ppht' ? 'PPHT' : 'Net') + '</small>' + (v > 0 ? eur(v) : '—') + '</button>';
  }
  function ligneEdition(p) {
    var champ = S.edit.champ, v = champ === 'ppht' ? p.ppht : p.price;
    return '<form class="mkd-edit" data-act="px-ok" data-key="' + esc(p.key) + '" data-champ="' + champ + '" novalidate>' +
      '<label for="mkd-px">' + (champ === 'ppht' ? 'PPHT' : 'Prix net') + ' HT, en euros</label>' +
      '<div class="mkd-edit-rang"><input id="mkd-px" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" value="' + esc(S.edit.val != null ? S.edit.val : saisie(v)) + '" aria-describedby="mkd-px-m">' +
      '<button type="submit" class="mk-btn mk-plein mk-press">OK</button>' +
      '<button type="button" class="mk-btn mk-press" data-act="px-non">Annuler</button></div>' +
      '<p class="mkd-note mkd-note-ambre" id="mkd-px-m" role="alert">' + esc(S.edit.msg || '') + '</p></form>';
  }
  function htmlListe() {
    var b = baseDe(S.base), h = '', n = S.produits.length, d = S.drafts[S.base] || {};
    if (d.attente) return '<p class="mkd-note" role="status">Chargement du catalogue du groupe…</p>' + (S.catEtat === 'echec' ? '<p class="mkd-note mkd-note-ambre">Le catalogue n’a pas pu être lu. Fermez et rouvrez l’écran pour réessayer.</p>' : '');
    if (netManquant() && S.mode === 'ppht') h += '<p class="mkd-note mkd-note-ambre" role="status">Prix nets pas encore chargés : ils s’affichent dès qu’ils arrivent. Rien n’est inventé en attendant.</p>';
    if (d.absents && d.absents.length) h += '<p class="mkd-note mkd-note-ambre">Introuvable dans le catalogue du groupe, donc absent : ' + esc(d.absents.join(', ')) + '</p>';
    if (!n) h += '<p class="mkd-vide">Aucun produit pour l’instant. Ajoutez-en avec le bouton ci-dessous.</p>';
    else {
      h += '<ul class="mkd-liste">' + S.produits.map(function (p) {
        var edit = S.edit && S.edit.key === p.key;
        return '<li class="mkd-lig' + (edit ? ' mkd-lig-edit' : '') + '">' +
          '<div class="mkd-lig-haut"><div class="mkd-lig-nom"><b>' + esc(p.name) + '</b><small>CIP ' + esc(p.cip || p.ean || '—') + '</small></div>' +
          (S.mode !== 'aucun' && !edit ? '<div class="mkd-lig-prix">' + (S.mode === 'ppht' ? puce(p, 'ppht') : '') + puce(p, 'net') + '</div>' : '') +
          '<button type="button" class="mkd-x mk-press" data-act="retirer" data-key="' + esc(p.key) + '" aria-label="Retirer ' + esc(p.name) + '">' + IC('fermer', 20, 2) + '</button></div>' +
          (edit ? ligneEdition(p) : '') + '</li>';
      }).join('') + '</ul>';
    }
    return h;
  }
  function htmlApercu() {
    var html = '';
    try { html = V2.mkt.feuilleHtml(fiche(S), false); } catch (e) { html = '<div style="padding:40px;font:600 16px sans-serif">Aperçu indisponible</div>'; try { console.warn('[mkt-doc]', e); } catch (x) {} }
    return '<div class="mkd-ap" role="button" tabindex="0" data-act="agrandir" aria-label="Agrandir l’aperçu du document"><div class="mkd-ap-cadre"><div class="mkd-ap-feuille">' + html + '</div></div>' +
      '<span class="mkd-ap-loupe">' + IC('loupe', 18, 2) + 'Agrandir</span></div><p class="mkd-pages" id="mkd-pages" aria-live="polite"></p>';
  }
  function htmlPied() {
    var n = S.produits.length, nom = S.pid && S.nom ? S.nom : '';
    return '<button type="button" class="mk-btn mk-plein mk-press mkd-envoi" data-act="envoyer"' + (n && !S.occupe ? '' : ' disabled') + '>' + (S.occupe ? 'Enregistrement…' : 'Enregistrer et envoyer') + '</button>' +
      (n ? '' : '<span class="mkd-pied-n">Ajoutez au moins un produit.</span>');
  }
  function htmlAnnuler() {
    if (!S.annul) return '';
    return '<div class="mkd-snack" role="status"><span>« ' + esc(S.annul.p.name) + ' » retiré</span><button type="button" class="mk-btn mk-press" data-act="annuler">Annuler</button></div>';
  }
  function squelette() {
    var nom = S.pid && S.nom ? S.nom : '';
    return '<div class="mkd-tete"><button type="button" class="mk-btn mk-press mkd-retour" data-act="fermer" aria-label="Fermer sans enregistrer">' + IC('retour', 22, 2) + '</button>' +
      '<div class="mkd-tete-t"><h1 id="mkd-h1">Créer un document</h1>' + (nom ? '<small>Pour ' + esc(nom) + '</small>' : '') + '</div></div>' +
      '<div class="mkd-corps" id="mkd-corps">' +
        '<section class="mkd-gauche" aria-label="Aperçu"><div id="mkd-r-ap"></div></section>' +
        '<section class="mkd-droite" aria-label="Réglages">' +
          '<h2 class="mkd-cap">Partir de</h2><div class="mkd-bases" id="mkd-r-bases" role="group" aria-label="Base du document"></div>' +
          '<h2 class="mkd-cap"><label for="mkd-titre">Titre</label></h2><input class="mkd-titre" id="mkd-titre" type="text" autocomplete="off" maxlength="80" enterkeyhint="done" value="' + esc(S.titre) + '">' +
          '<h2 class="mkd-cap">Prix</h2><div id="mkd-r-prix"></div>' +
          '<div class="mkd-cap mkd-cap-liste"><h2 id="mkd-r-nb">Produits</h2><button type="button" class="mkd-lien mk-press" id="mkd-r-retab" data-act="retablir" hidden>Rétablir la base</button></div>' +
          '<div id="mkd-r-liste"></div>' +
          '<button type="button" class="mk-btn mk-press mkd-ajout" data-act="ajouter">' + IC('plus', 20, 2) + 'Ajouter un produit</button>' +
        '</section>' +
      '</div>' +
      '<div class="mkd-pied" id="mkd-r-pied"></div><div id="mkd-r-snack"></div><div id="mkd-r-feuille"></div>';
  }

  // ── la peinture (par régions : le champ du titre et celui de la recherche ne sont jamais refaits sous les doigts) ──
  function $(sel) { return S && S.el ? S.el.querySelector(sel) : null; }
  function mettre(sel, html) { var e = $(sel); if (e) e.innerHTML = html; }
  function peindre(quoi) {
    if (!S || !S.el) return;
    var tout = !quoi, q = quoi ? [].concat(quoi) : [], a = function (k) { return tout || q.indexOf(k) >= 0; };
    if (a('ap')) { mettre('#mkd-r-ap', htmlApercu()); caler(); setTimeout(caler, 120); }
    if (a('bases')) mettre('#mkd-r-bases', htmlBases());
    if (a('prix')) mettre('#mkd-r-prix', htmlPrix());
    if (a('liste')) {
      mettre('#mkd-r-liste', htmlListe());
      var nb = $('#mkd-r-nb'), n = S.produits.length; if (nb) nb.textContent = n + ' produit' + (n > 1 ? 's' : '');
      var rb = $('#mkd-r-retab'); if (rb) rb.hidden = !modifie();
      if (S.edit && S.edit.focus) { S.edit.focus = false; var inp = $('#mkd-px'); if (inp) { try { inp.focus(); inp.select(); } catch (e) {} } }
    }
    if (a('pied')) mettre('#mkd-r-pied', htmlPied());
    if (a('snack')) mettre('#mkd-r-snack', htmlAnnuler());
    if (a('feuille')) feuille();
  }
  // L'aperçu : la vraie feuille de 794 px, réduite à la largeur du cadre (transform seul : rien d'animé ni de flou).
  function caler() {
    var cadre = $('.mkd-ap-cadre'); if (!cadre) return;
    var f = cadre.firstElementChild, k = cadre.clientWidth / 794, racine = f && f.firstElementChild, p1 = racine && racine.firstElementChild;
    if (!f || !(k > 0)) return;
    f.style.transform = 'scale(' + k.toFixed(4) + ')';
    cadre.style.height = Math.round(((p1 && p1.offsetHeight) || f.offsetHeight || 1120) * k) + 'px';
    var n = racine ? racine.children.length : 1, pg = $('#mkd-pages');
    if (pg) pg.textContent = n > 1 ? 'Page 1 sur ' + n + ' · touchez l’aperçu pour tout voir' : '1 page';
  }
  function nbPages() {
    var d = document.createElement('div'); d.innerHTML = V2.mkt.feuilleHtml(fiche(S), true);
    var r = d.firstElementChild; return r ? Math.max(1, r.children.length) : 1;
  }
  function touch() { S.sale = true; S.fait = null; }

  // ── les feuilles : ajouter un produit, aperçu agrandi, prêt à envoyer, quitter ──
  function feuille() {
    var h = '';
    if (S.sheet === 'ajout') h = htmlAjout();
    else if (S.sheet === 'grand') h = htmlGrand();
    else if (S.sheet === 'fait') h = htmlFait();
    else if (S.sheet === 'quitter') h = htmlQuitter();
    var zone = $('#mkd-r-feuille'); if (!zone) return;
    var avant = zone.getAttribute('data-s');
    if (avant === (S.sheet || '') && S.sheet) return;   // déjà posée : on ne la refait pas (le clavier resterait fermé)
    zone.setAttribute('data-s', S.sheet || '');
    zone.innerHTML = h;
    var corps = $('.mkd-corps'), pied = $('.mkd-pied'), tete = $('.mkd-tete');
    [corps, pied, tete].forEach(function (e) { if (e) { if (S.sheet) e.setAttribute('aria-hidden', 'true'); else e.removeAttribute('aria-hidden'); } });
    if (S.sheet === 'ajout') { var q = $('#mkd-q'); if (q) { resultats(); setTimeout(function () { try { q.focus(); } catch (e) {} }, 60); } }
    if (S.sheet === 'grand') calerGrand();
    if (S.sheet === 'fait' || S.sheet === 'quitter') { var b = zone.querySelector('.mk-plein, button'); if (b) try { b.focus(); } catch (e) {} }
  }
  function htmlAjout() {
    return '<div class="mkd-feuille mkd-f-ajout" role="dialog" aria-modal="true" aria-labelledby="mkd-aj-t">' +
      '<div class="mkd-f-tete"><h2 id="mkd-aj-t">Ajouter un produit</h2><button type="button" class="mk-btn mk-plein mk-press" data-act="fermer-feuille">Terminer</button></div>' +
      '<div class="mkd-cherche"><input id="mkd-q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Nom ou CIP du produit" aria-label="Rechercher un produit par nom ou CIP"></div>' +
      '<div class="mkd-f-corps" id="mkd-res" aria-live="polite"></div></div>';
  }
  function resultats() {
    var box = $('#mkd-res'), q = $('#mkd-q'), C = cat(); if (!box || !q) return;
    var texte = q.value || '';
    if (!C || !C.prete()) { box.innerHTML = '<p class="mkd-note" role="status">' + (S.catEtat === 'echec' ? 'Le catalogue du groupe n’a pas pu être lu.' : 'Chargement du catalogue du groupe…') + '</p>'; return; }
    if (texte.trim().length < 2) { box.innerHTML = '<p class="mkd-note">Écrivez au moins deux lettres du nom, ou le début du code CIP.</p>'; return; }
    var L = C.chercher(texte, 30), deja = {};
    S.produits.forEach(function (p) { deja[p.cip] = 1; });
    if (!L.length) { box.innerHTML = '<p class="mkd-note">Aucun produit ne correspond à « ' + esc(texte.trim()) + ' ».</p>'; return; }
    box.innerHTML = L.map(function (o) {
      var pose = !!deja[o.cip], px = o.net || o.ppht;
      return '<div class="mkd-res' + (pose ? ' mkd-res-pose' : '') + '"><div class="mkd-res-t"><b>' + esc(o.d) + '</b><small>CIP ' + esc(o.cip) + (px > 0 ? ' · ' + esc(eur(px)) : '') + '</small></div>' +
        '<button type="button" class="mkd-plus mk-press" data-act="ajouter-ce" data-cip="' + esc(o.cip) + '"' + (pose ? ' disabled' : '') + ' aria-label="' + esc((pose ? 'Déjà dans le document : ' : 'Ajouter ') + o.d) + '">' + IC(pose ? 'coche' : 'plus', 22, 2.2) + '</button></div>';
    }).join('');
  }
  function htmlGrand() {
    var html = '';
    try { html = V2.mkt.feuilleHtml(fiche(S), false); } catch (e) {}
    return '<div class="mkd-feuille mkd-f-grand" role="dialog" aria-modal="true" aria-label="Aperçu du document">' +
      '<div class="mkd-f-tete"><button type="button" class="mk-btn mk-press" data-act="zoom" aria-pressed="' + (S.zoom ? 'true' : 'false') + '">' + (S.zoom ? 'Voir en entier' : 'Lire de près') + '</button>' +
      '<button type="button" class="mk-btn mk-plein mk-press" data-act="fermer-feuille">Fermer</button></div>' +
      '<div class="mkd-gr-corps" id="mkd-gr-corps"><div class="mkd-gr-cadre" id="mkd-gr-cadre"><div class="mkd-gr-feuille" id="mkd-gr-f">' + html + '</div></div></div></div>';
  }
  function calerGrand() {
    var c = $('#mkd-gr-corps'), cadre = $('#mkd-gr-cadre'), f = $('#mkd-gr-f'); if (!c || !cadre || !f) return;
    var k = S.zoom ? 1 : Math.min(1, (c.clientWidth - 24) / 794);
    f.style.transform = 'scale(' + k.toFixed(4) + ')';
    cadre.style.width = Math.round(794 * k) + 'px'; cadre.style.height = Math.round(f.offsetHeight * k) + 'px';
  }
  function libelleMode(m) { for (var i = 0; i < MODES.length; i++) if (MODES[i].k === m) return MODES[i].label; return m; }
  function htmlFait() {
    var F = S.fait || {}, nom = S.pid && S.nom ? S.nom : '';
    return '<div class="mkd-feuille mkd-f-fait" role="dialog" aria-modal="true" aria-labelledby="mkd-fait-t"><div class="mkd-fait">' +
      '<span class="mkd-fait-coche" aria-hidden="true">' + IC('coche', 30, 2.4) + '</span>' +
      '<h2 id="mkd-fait-t">' + (nom ? 'Prêt pour ' + esc(nom) : 'Document enregistré') + '</h2>' +
      '<p class="mkd-fait-titre">' + esc(F.titre || '') + '</p>' +
      '<ul class="mkd-fait-l"><li>' + F.n + ' produit' + (F.n > 1 ? 's' : '') + '</li><li>Prix : ' + esc(libelleMode(F.mode)) + '</li><li>' + F.pages + ' page' + (F.pages > 1 ? 's' : '') + ' en PDF</li></ul>' +
      (F.partage ? '<p class="mkd-note">Il est partagé avec l’équipe : dans « Faits dans l’app » de Transmettre et dans les fiches Marketing.' + (nom ? ' Le nom de l’officine n’est pas écrit sur le document.' : '') + '</p>'
                 : '<p class="mkd-note mkd-note-ambre">Enregistré sur cet appareil seulement : pas partagé avec l’équipe. Vérifiez la connexion.</p>') +
      '<button type="button" class="mk-btn mk-plein mk-press" data-act="fait-ok">' + (S.pid ? 'Continuer vers l’envoi' : 'Terminer') + '</button>' +
      '<button type="button" class="mk-btn mk-press" data-act="fermer-feuille">Revoir le document</button></div></div>';
  }
  function htmlQuitter() {
    return '<div class="mkd-feuille mkd-f-fait" role="alertdialog" aria-modal="true" aria-labelledby="mkd-q-t"><div class="mkd-fait">' +
      '<h2 id="mkd-q-t">Quitter sans enregistrer ?</h2><p class="mkd-note">Ce que vous avez changé sur ce document sera perdu.</p>' +
      '<button type="button" class="mk-btn mk-plein mk-press" data-act="fermer-feuille">Continuer le document</button>' +
      '<button type="button" class="mk-btn mk-danger mk-press" data-act="quitter-oui">Quitter sans enregistrer</button></div></div>';
  }
  function fermerFeuille() { if (!S) return; S.sheet = null; var z = $('#mkd-r-feuille'); if (z) { z.setAttribute('data-s', ''); z.innerHTML = ''; } feuille(); peindre(['ap', 'liste', 'pied']); }

  // ── l'enregistrement : une fiche Marketing (marketing_items), comme les autres ──
  function enregistrer() {
    if (!S || S.occupe || !S.produits.length) return;
    ranger();
    S.occupe = true; peindre('pied');
    var it = fiche(S, S.id || V2.mkt.docNouvelId());
    it.owner = S.owner || (V2.user && V2.user.email) || '';
    it.products = it.products.map(function (p) { var c = Object.assign({}, p); delete c._mod; return c; });
    var pages = 1; try { pages = nbPages(); } catch (e) {}
    V2.mkt.docEnregistrer(it).then(function (r) {
      if (!S) return;
      S.occupe = false;
      if (!r || !r.ok) { V2.toast('L’enregistrement n’a pas abouti : rien n’est parti, réessayez.', 'error'); peindre('pied'); return; }
      S.id = it.id; S.sale = false;
      S.fait = { id: it.id, titre: it.title, n: it.products.length, mode: S.mode, pages: pages, partage: !!r.partage };
      S.sheet = 'fait'; peindre(['pied', 'feuille']);
    }, function () { if (!S) return; S.occupe = false; V2.toast('L’enregistrement n’a pas abouti : rien n’est parti, réessayez.', 'error'); peindre('pied'); });
  }
  function terminer() {   // après « Continuer vers l’envoi »
    var id = S && S.fait && S.fait.id, pid = S && S.pid;
    fermer();
    if (pid && V2.pharmaTxApresDoc) { V2.pharmaTxApresDoc(id); return; }
    V2.toast('Document enregistré. Il est proposé dans « Faits dans l’app », au moment d’envoyer.');
    if (V2.route && V2.route.name === 'marketing') { V2.go('marketing', 'fiches'); setTimeout(function () { if (V2.route && V2.route.name === 'marketing') V2.render(); }, 60); }
  }

  // ── les gestes ──
  function trouver(key) { for (var i = 0; i < S.produits.length; i++) if (String(S.produits[i].key) === String(key)) return i; return -1; }
  function agir(act, b) {
    var i, p, k;
    if (act === 'base') {
      k = b.getAttribute('data-k'); if (k === S.base) return;
      ranger(); S.edit = null; S.annul = null; S.msgMode = ''; charger(k);
      if (k === 'hiver' && S.drafts.hiver.attente) chargerCatalogue();
      $('#mkd-titre').value = S.titre; peindre(); surveiller();
    } else if (act === 'mode') {
      k = b.getAttribute('data-k');
      if (baseDe(S.base).nr && k === 'ppht') { S.msgMode = '« PPHT + net » n’est pas proposé pour ces produits : ils n’ont pas de PPHT (prix libre). Le prix net reste affiché.'; peindre('prix'); return; }
      S.msgMode = ''; S.mode = k; S.edit = null; touch(); peindre();
    } else if (act === 'px') {
      S.edit = { key: b.getAttribute('data-key'), champ: b.getAttribute('data-champ'), msg: '', val: null, focus: true }; peindre('liste');
    } else if (act === 'px-non') { S.edit = null; peindre('liste'); }
    else if (act === 'retirer') {
      i = trouver(b.getAttribute('data-key')); if (i < 0) return;
      S.annul = { p: S.produits[i], idx: i };
      S.produits = S.produits.filter(function (x, n) { return n !== i; });
      if (S.edit && S.edit.key === b.getAttribute('data-key')) S.edit = null;
      clearTimeout(S.tAnnul); S.tAnnul = setTimeout(function () { if (S) { S.annul = null; peindre('snack'); } }, 8000);
      touch(); peindre(['ap', 'liste', 'pied', 'snack']);
    } else if (act === 'annuler') {
      if (!S.annul) return;
      S.produits = S.produits.slice(); S.produits.splice(Math.min(S.annul.idx, S.produits.length), 0, S.annul.p);
      S.annul = null; clearTimeout(S.tAnnul); peindre(['ap', 'liste', 'pied', 'snack']);
    } else if (act === 'retablir') {
      S.edit = null; S.annul = null; delete S.drafts[S.base]; charger(S.base); $('#mkd-titre').value = S.titre; S.msgMode = ''; peindre();
    } else if (act === 'ajouter') { S.sheet = 'ajout'; chargerCatalogue(function () { if (S && S.sheet === 'ajout') resultats(); }); peindre('feuille'); }
    else if (act === 'ajouter-ce') {
      var C = cat(), o = C && C.par(b.getAttribute('data-cip'));
      if (!o || trouver('p' + o.cip) >= 0) return;
      S.produits = S.produits.concat([V2.mkt.docProduit(o)]); touch();
      resultats(); peindre(['ap', 'liste', 'pied']);
      V2.toast('Ajouté : ' + esc(o.d));
    } else if (act === 'agrandir') { S.zoom = false; S.sheet = 'grand'; peindre('feuille'); }
    else if (act === 'zoom') { S.zoom = !S.zoom; var z = $('#mkd-r-feuille'); if (z) z.setAttribute('data-s', ''); S.sheet = 'grand'; feuille(); }
    else if (act === 'fermer-feuille') fermerFeuille();
    else if (act === 'envoyer') enregistrer();
    else if (act === 'fait-ok') terminer();
    else if (act === 'fermer') { if (S.sale && S.produits.length) { S.sheet = 'quitter'; peindre('feuille'); } else fermer(); }
    else if (act === 'quitter-oui') fermer();
  }
  function lierEvenements(el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b || !el.contains(b) || b.tagName === 'FORM') return;
      if (b.hasAttribute('disabled')) return;
      agir(b.getAttribute('data-act'), b);
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); if (S.sheet) { if (S.sheet === 'fait') return; fermerFeuille(); } else if (S.edit) { S.edit = null; peindre('liste'); } else agir('fermer', el); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.getAttribute('data-act')) { e.preventDefault(); agir(e.target.getAttribute('data-act'), e.target); }
    });
    el.addEventListener('input', function (e) {
      if (e.target.id === 'mkd-titre') { S.titre = e.target.value; touch(); clearTimeout(S.tApercu); S.tApercu = setTimeout(function () { peindre(['ap', 'liste']); }, 160); }
      else if (e.target.id === 'mkd-q') { clearTimeout(S.tQ); S.tQ = setTimeout(resultats, 120); }
      else if (e.target.id === 'mkd-px' && S.edit) { S.edit.val = e.target.value; }
    });
    el.addEventListener('submit', function (e) {
      var f = e.target; if (!f || f.getAttribute('data-act') !== 'px-ok') return;
      e.preventDefault();
      var inp = f.querySelector('input'), v = lirePrix(inp.value), i = trouver(f.getAttribute('data-key')), champ = f.getAttribute('data-champ');
      if (v == null) { S.edit.msg = 'Prix non valide : écrivez un montant en euros, par exemple 1,07.'; S.edit.val = inp.value; S.edit.focus = true; peindre('liste'); return; }
      if (i < 0) { S.edit = null; peindre('liste'); return; }
      var p = Object.assign({}, S.produits[i]); p._mod = Object.assign({}, p._mod || {});
      if (champ === 'ppht') p.ppht = v; else p.price = v;
      p._mod[champ] = true;
      S.produits = S.produits.map(function (x, n) { return n === i ? p : x; });
      S.edit = null; touch(); peindre(['ap', 'liste']);
    });
    window.addEventListener('resize', S.surTaille = function () { if (!S) return; caler(); if (S.sheet === 'grand') calerGrand(); });
  }

  // ── ouvrir / fermer ──
  function monter() {
    var el = document.createElement('div');
    el.className = 'mkd mk-espace'; el.id = 'mkd'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'mkd-h1');
    el.innerHTML = squelette();
    document.body.appendChild(el);
    S.el = el; S.avantDefil = document.body.style.overflow; document.body.style.overflow = 'hidden';
    lierEvenements(el);
    peindre(); surveiller();
    if (S.base === 'hiver' && S.drafts.hiver && S.drafts.hiver.attente) chargerCatalogue();
    var h = $('#mkd-h1'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus(); } catch (e) {} }
  }
  function fermer() {
    if (!S) return;
    clearInterval(S.minuteur); clearTimeout(S.tAnnul); clearTimeout(S.tApercu); clearTimeout(S.tQ);
    try { window.removeEventListener('resize', S.surTaille); } catch (e) {}
    document.body.style.overflow = S.avantDefil || '';
    if (S.el && S.el.parentNode) S.el.parentNode.removeChild(S.el);
    S = null;
  }
  function ouvrir(o) {
    o = o || {};
    if (S) return;
    if (!V2.mkt || !V2.mkt.feuilleHtml || !V2.mkt.docEnregistrer) { V2.toast('Cet écran n’est pas encore prêt, réessayez dans un instant.', 'warn'); return; }
    if (V2.mktSocle && V2.mktSocle.injectCss) V2.mktSocle.injectCss();
    injectCss();
    var pid = o.pid && o.pid !== '__modele__' ? String(o.pid) : null;
    S = { pid: pid, nom: o.nom || (pid ? nomOfficine(pid) : ''), id: null, owner: '', base: 'sanofi', drafts: {}, edit: null, sheet: null, annul: null, msgMode: '', sale: false, occupe: false, zoom: false, catEtat: '' };
    if (o.id) {
      var courant = S;
      V2.mkt.docFiche(o.id).then(function (it) {
        if (S !== courant) return;
        if (!it) { S = null; V2.toast('Document introuvable', 'error'); return; }
        var k = (it.theme && it.theme.doc && it.theme.doc.base) || 'vide';
        if (!BASES.some(function (b) { return b.k === k; })) k = 'vide';
        S.id = it.id; S.owner = it.owner || '';
        S.drafts[k] = { titre: it.title || '', mode: modeDe(it.theme), produits: it.products, attente: false, absents: [] };
        charger(k); monter();
      }, function () { if (S === courant) { S = null; V2.toast('Document introuvable', 'error'); } });
      return;
    }
    charger(BASES.some(function (b) { return b.k === o.base; }) ? o.base : 'sanofi');
    monter();
  }

  // ── le style : les jetons et le contrôle segmenté de Marketing (v2-mkt-socle.js), la police de l'app ──
  function injectCss() {
    if (document.getElementById('v2-mkt-doc-css')) return;
    var s = document.createElement('style'); s.id = 'v2-mkt-doc-css';
    s.textContent = [
      '.mkd{position:fixed;top:0;right:0;bottom:0;left:0;z-index:200;display:flex;flex-direction:column;background:var(--mk-page);font-family:Satoshi,Inter,system-ui,-apple-system,sans-serif;font-size:16px;line-height:22px;color:var(--mk-encre);-webkit-text-size-adjust:100%;overflow:hidden}',
      '.mkd *{box-sizing:border-box}',
      '.mkd button{font-family:inherit}',
      '.mkd-tete{flex:none;display:flex;align-items:center;gap:6px;min-height:60px;padding:env(safe-area-inset-top,0px) 10px 0 6px;background:#fff;border-bottom:1px solid var(--mk-trait)}',
      '.mkd-tete-t{min-width:0}',
      '.mkd-tete h1{margin:0;font-size:17px;line-height:22px;font-weight:700;outline:none}',
      '.mkd-tete small{display:block;font-size:14px;line-height:18px;font-weight:600;color:var(--mk-bleu-txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mkd .mkd-retour{padding:0;width:48px;border-color:transparent;box-shadow:none;background:none}',
      '.mkd-corps{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:14px 16px 28px}',
      '.mkd-gauche{display:flex;flex-direction:column;align-items:center;margin-bottom:6px}',
      '.mkd-ap{position:relative;width:calc(min(34vh,380px)*.709);min-width:190px;max-width:100%;cursor:pointer;border-radius:6px;box-shadow:var(--mk-n2);background:#fff}',
      '.mkd-ap-cadre{position:relative;width:100%;overflow:hidden;border-radius:6px;background:#fff}',
      '.mkd-ap-feuille{position:absolute;top:0;left:0;width:794px;transform-origin:0 0;pointer-events:none}',
      '.mkd-ap-loupe{position:absolute;right:8px;bottom:8px;display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:999px;background:var(--mk-encre);color:#fff;font-size:14px;font-weight:600}',
      '.mkd-pages{margin:8px 0 0;font-size:14px;line-height:18px;color:var(--mk-attenue);text-align:center}',
      '.mkd-cap{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0 6px;font-size:14px;line-height:18px;font-weight:700;letter-spacing:.02em;color:var(--mk-attenue);text-transform:uppercase}',
      '.mkd-cap h2,.mkd-cap label{margin:0;font:inherit;letter-spacing:inherit;text-transform:inherit}',
      '.mkd-bases{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.mkd .mkd-base{min-height:48px;padding:0 10px;border-radius:12px;border:1px solid var(--mk-trait);background:#fff;box-shadow:var(--mk-n1);font-size:16px;font-weight:600;color:var(--mk-encre2);cursor:pointer}',
      '.mkd .mkd-base[aria-pressed="true"]{border-color:var(--mk-bleu);background:var(--mk-pale);color:var(--mk-bleu-txt)}',
      '.mkd .mkd-titre{width:100%;min-height:48px;padding:0 14px;border-radius:12px;border:1px solid var(--mk-trait);background:#fff;font:600 16px/22px Satoshi,Inter,system-ui,sans-serif;color:var(--mk-encre);box-shadow:var(--mk-n1) inset}',
      '.mkd input:focus-visible,.mkd button:focus-visible,.mkd [role="button"]:focus-visible{outline:2px solid var(--mk-bleu);outline-offset:2px}',
      '.mkd .mkd-seg button{font-size:15px;padding:0 4px}',
      '.mkd .mkd-seg button.mkd-grise{opacity:.45}',
      '.mkd-note{margin:8px 0 0;font-size:14px;line-height:20px;color:var(--mk-attenue)}',
      '.mkd-note-ambre{color:#8A5200}',
      '.mkd-vide{margin:6px 0 0;padding:18px 14px;border-radius:12px;border:1px dashed var(--mk-trait);color:var(--mk-attenue);font-size:15px;text-align:center}',
      '.mkd-cap-liste{margin-top:22px}',
      '.mkd .mkd-lien{min-height:44px;padding:0 4px;background:none;border:0;font-size:15px;font-weight:700;color:var(--mk-bleu-txt);text-transform:none;letter-spacing:0;cursor:pointer}',
      '.mkd-liste{list-style:none;margin:0;padding:0;background:#fff;border-radius:14px;border:1px solid var(--mk-trait);box-shadow:var(--mk-n1)}',
      '.mkd-lig{padding:4px 4px 4px 14px;border-top:1px solid var(--mk-trait)}',
      '.mkd-lig:first-child{border-top:0}',
      '.mkd-lig-haut{display:flex;align-items:center;gap:6px;min-height:56px}',
      '.mkd-lig-nom{flex:1 1 auto;min-width:0;padding:6px 0}',
      '.mkd-lig-nom b{display:block;font-size:15px;line-height:19px;font-weight:700;overflow-wrap:anywhere}',
      '.mkd-lig-nom small{display:block;font-size:13px;line-height:17px;color:var(--mk-attenue);font-variant-numeric:tabular-nums}',
      '.mkd-lig-prix{flex:none;display:flex;gap:4px}',
      '.mkd .mkd-puce{min-height:44px;min-width:60px;padding:2px 8px;border-radius:10px;border:1px solid var(--mk-trait);background:var(--mk-groupe);font-size:15px;line-height:17px;font-weight:700;color:var(--mk-encre);font-variant-numeric:tabular-nums;cursor:pointer;text-align:right}',
      '.mkd .mkd-puce small{display:block;font-size:11px;line-height:13px;font-weight:700;letter-spacing:.04em;color:var(--mk-attenue);text-transform:uppercase;text-align:right}',
      '.mkd .mkd-puce-ppht{background:#fff;font-weight:500;color:var(--mk-attenue)}',
      '.mkd .mkd-puce-mod{background:#FFF3DC;border-color:#E7B25A}',
      '.mkd .mkd-puce-vide{color:var(--mk-attenue)}',
      '.mkd .mkd-x{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;border:0;background:none;color:var(--mk-attenue);cursor:pointer}',
      '.mkd-edit{padding:0 10px 12px 0}',
      '.mkd-edit label{display:block;margin:0 0 6px;font-size:14px;font-weight:600;color:var(--mk-encre2)}',
      '.mkd-edit-rang{display:flex;gap:8px;align-items:center}',
      '.mkd-edit input{flex:1 1 auto;min-width:0;min-height:48px;padding:0 12px;border-radius:12px;border:1px solid var(--mk-bleu);background:#fff;font:700 16px/22px Satoshi,Inter,system-ui,sans-serif;color:var(--mk-encre)}',
      '.mkd-edit .mk-btn{min-width:64px;padding:0 14px}',
      '.mkd .mkd-ajout{width:100%;margin-top:12px}',
      '.mkd-pied{flex:none;display:flex;align-items:center;gap:12px;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));background:#fff;border-top:1px solid var(--mk-trait)}',
      '.mkd .mkd-envoi{flex:1 1 auto;min-height:52px;font-size:16px}',
      '.mkd-pied-n{font-size:14px;color:var(--mk-attenue)}',
      '.mkd-snack{position:absolute;left:12px;right:12px;bottom:calc(86px + env(safe-area-inset-bottom,0px));z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 6px 6px 16px;border-radius:14px;background:var(--mk-encre);color:#fff;font-size:15px;box-shadow:var(--mk-n3)}',
      '.mkd-snack span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mkd-snack .mk-btn{background:#fff;color:var(--mk-encre);flex:none}',
      /* les feuilles : plein écran, le haut d'abord (le clavier ouvert ne cache jamais le champ) */
      '.mkd-feuille{position:absolute;top:0;right:0;bottom:0;left:0;z-index:5;display:flex;flex-direction:column;background:var(--mk-page)}',
      '.mkd-f-tete{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:60px;padding:env(safe-area-inset-top,0px) 12px 0 16px;background:#fff;border-bottom:1px solid var(--mk-trait)}',
      '.mkd-f-tete h2{margin:0;font-size:17px;line-height:22px;font-weight:700}',
      '.mkd-cherche{flex:none;padding:10px 16px}',
      '.mkd-cherche input{width:100%;min-height:48px;padding:0 14px;border-radius:12px;border:1px solid var(--mk-bleu);background:#fff;font:600 16px/22px Satoshi,Inter,system-ui,sans-serif;color:var(--mk-encre)}',
      '.mkd-f-corps{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 16px calc(24px + env(safe-area-inset-bottom,0px))}',
      '.mkd-res{display:flex;align-items:center;gap:8px;min-height:60px;padding:6px 0 6px 2px;border-bottom:1px solid var(--mk-trait)}',
      '.mkd-res-t{flex:1 1 auto;min-width:0}',
      '.mkd-res-t b{display:block;font-size:15px;line-height:19px;font-weight:700;overflow-wrap:anywhere}',
      '.mkd-res-t small{display:block;font-size:13px;line-height:17px;color:var(--mk-attenue);font-variant-numeric:tabular-nums}',
      '.mkd .mkd-plus{flex:none;width:48px;height:48px;display:grid;place-items:center;border-radius:12px;border:1px solid var(--mk-trait);background:#fff;color:var(--mk-bleu-txt);box-shadow:var(--mk-n1);cursor:pointer}',
      '.mkd .mkd-plus[disabled]{background:var(--mk-groupe);color:var(--mk-vert);box-shadow:none}',
      '.mkd-gr-corps{flex:1 1 auto;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:12px;background:#E9EDF5}',
      '.mkd-gr-cadre{position:relative;margin:0 auto;overflow:hidden;background:#fff;box-shadow:var(--mk-n2)}',
      '.mkd-gr-feuille{position:absolute;top:0;left:0;width:794px;transform-origin:0 0}',
      '.mkd-f-fait{align-items:center;justify-content:center;padding:24px 20px;background:rgba(16,19,28,.55)}',
      '.mkd-fait{width:100%;max-width:440px;display:flex;flex-direction:column;gap:10px;padding:24px 20px calc(20px + env(safe-area-inset-bottom,0px));border-radius:20px;background:#fff;box-shadow:var(--mk-n3)}',
      '.mkd-fait h2{margin:0;font-size:22px;line-height:28px;font-weight:800}',
      '.mkd-fait-coche{width:52px;height:52px;display:grid;place-items:center;border-radius:50%;background:#E3F6EE;color:var(--mk-vert)}',
      '.mkd-fait-titre{margin:0;font-size:17px;font-weight:700}',
      '.mkd-fait-l{margin:0;padding:0 0 0 20px;font-size:15px;color:var(--mk-encre2)}',
      '.mkd-fait .mk-btn{width:100%;min-height:52px}',
      '@media (min-width:1000px){',
        '.mkd-corps{display:grid;grid-template-columns:minmax(0,1fr) 520px;gap:40px;overflow:hidden;padding:24px 48px 0}',
        '.mkd-gauche{overflow-y:auto;justify-content:flex-start;padding:4px 4px 24px}',
        '.mkd-ap{width:calc((100vh - 250px)*.709);min-width:260px}',
        '.mkd-droite{min-height:0;overflow-y:auto;padding:0 6px 28px 0}',
        '.mkd-cap:first-child{margin-top:0}',
        '.mkd-tete{padding-left:24px}',
        '.mkd-pied{justify-content:flex-end;padding-left:48px;padding-right:48px}',
        '.mkd .mkd-envoi{flex:none;width:360px}',
        '.mkd-snack{left:auto;right:48px;width:520px;bottom:96px}',
        '.mkd-f-ajout,.mkd-f-grand{left:50%;width:640px;margin-left:-320px;box-shadow:var(--mk-n3)}',
        '.mkd-f-grand{width:min(1000px,92vw);margin-left:calc(min(1000px,92vw)/-2)}',
      '}',
      '@media (prefers-reduced-motion:reduce){.mkd *{transition:none!important;animation:none!important}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  V2.mktDoc.ouvrir = ouvrir;
  V2.mktDoc.fermer = fermer;
  V2.mktDoc.etat = function () { return S ? { base: S.base, mode: S.mode, n: S.produits.length, id: S.id, pid: S.pid } : null; };

})();

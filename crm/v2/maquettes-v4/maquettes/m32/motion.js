/* Couche de mouvement. Chargée après le dernier script d'écran et AVANT window.J32.demarrer().
   Coupe-circuit : index.html?motion=0 ne pose rien. Sinon <html class="m-on"> : toute règle de motion.css en dépend.
   Mouvement réduit : seule la classe m-on est posée (repli : délais à 0 ; barre de sélection du catalogue centrée) ; rien d'autre ne s'installe. */
(function () {
  'use strict';
  if (/[?&]motion=0(&|$)/.test(location.search)) return;
  var root = document.documentElement;
  root.classList.add('m-on');
  var ARRIVEE = 1200, GARDE = 8000, COMPTE = 500, DEPART = 0.9, CHIFFRES_MAX = 4, RANGS_MAX = 8;
  var M = window.M32motion = { RM: false, armer: [], dfn: [], passes: 0, dureeMax: 0, dureeMaxMep: 0, dureeOu: '', quitte: {}, cle: null, t0: 0, tHash: 0 };
  try { M.RM = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var J = window.J32;
  if (M.RM || !J) return;

  /* ---------- socle : une passe par image au plus, après un changement OBSERVÉ (page qui change, section redessinée) ---------- */
  var plan = 0, premiere = null, enCours = null, minuteurs = {};
  function passe() {
    plan = 0;
    var t = performance.now(), t1 = t;
    if (premiere) { document.body.getBoundingClientRect(); t1 = performance.now(); }   // la mise en page du nouvel écran, que le navigateur ferait de toute façon avant de peindre
    var ecritures = [];   // chaque fonction lit la mise en page puis rend ses écritures : toutes les lectures d'abord, toutes les écritures ensuite
    for (var i = 0; i < M.armer.length; i++) { var a = performance.now(); try { var w = M.armer[i](); if (w) ecritures.push(w); } catch (e) {} var b = performance.now() - a; if (b > (M.dfn[i] || 0)) M.dfn[i] = Math.round(b * 100) / 100; }
    for (var j = 0; j < ecritures.length; j++) { try { ecritures[j](); } catch (e) {} }
    var f = performance.now(); M.passes++;
    if (f - t1 > M.dureeMax) { M.dureeMax = f - t1; M.dureeOu = M.cle || ''; }
    if (f - t > M.dureeMaxMep) M.dureeMaxMep = f - t;
  }
  M.planifier = function () { if (!plan) plan = requestAnimationFrame(passe); };
  function visible(e) { return e.getClientRects().length > 0; }
  function ecranVisible() { var c = J.courant; return c && document.getElementById('ecran-' + c.ecran); }

  /* ---------- la page : une clé lue dans J32.courant (posé par J.route AVANT le rendu) ---------- */
  var PAGES = { groupements: 1, listes: 1, produits: 1, lgo: 1, marketing: 1, offilog: 1, rdv: 1, concurrents: 1, appro: 1, qg: 1, marche: 1, mallette: 1, tournees: 1 };
  function cleDe(ecran, suite, off) {
    if (ecran === 'fiche') return 'fiche:' + off;   // la fiche, quelle que soit sa vue
    var s0 = (suite || '').split('-')[0];
    if (suite && PAGES[ecran] && (s0 === 'detail' || (ecran === 'rdv' && (s0 === 'planning' || s0 === 'suivi')))) return ecran + ':' + suite;   // une page entière
    return ecran;   // un dépliant, un onglet, un volet, un état du GPS : la même page
  }
  M.cleDe = cleDe;
  addEventListener('hashchange', function (e) { var t = e.timeStamp; M.tHash = t && t < performance.now() + 1000 ? t : performance.now(); }, true);   // avant J.route (écouteur posé avant demarrer)

  /* ---------- l'arrivée : .m-arrive pendant 1,2 s sur l'écran qui arrive ; rien au retour en moins de 8 s ---------- */
  function finArrivee(sec) {
    clearTimeout(minuteurs[sec.id]); sec.classList.remove('m-arrive'); sec.classList.add('m-deja');
    if (enCours === sec) enCours = null; if (premiere === sec) premiere = null;
  }
  M.arrivee = function () {
    var c = J.courant; if (!c || !c.ecran) return false;
    var k = cleDe(c.ecran, c.suite, J.S && J.S.off);
    if (k === M.cle) return false;
    var maintenant = Date.now();
    if (M.cle) M.quitte[M.cle] = maintenant;
    M.cle = k;
    if (io2) io2.disconnect();   // les graphiques encore en attente de la page quittée ne se dessineront plus (ni au retour en moins de 8 s)
    if (enCours) finArrivee(enCours);
    var q = M.quitte[k];
    if (q && maintenant - q < GARDE) return false;   // garde des 8 s : seul le repère de la navigation bougera
    var sec = document.getElementById('ecran-' + c.ecran); if (!sec) return false;
    var vieux = sec.querySelectorAll('[data-m-r],[data-m-g]');
    for (var i = 0; i < vieux.length; i++) { vieux[i].removeAttribute('data-m-r'); vieux[i].removeAttribute('data-m-g'); vieux[i].style.removeProperty('--m-r'); }
    sec.classList.add('m-arrive'); enCours = sec; premiere = sec;
    var pn = performance.now(); M.t0 = M.tHash && pn - M.tHash < 250 ? M.tHash : pn;
    minuteurs[sec.id] = setTimeout(function () { finArrivee(sec); }, ARRIVEE);
    M.planifier();
    return true;
  };
  var mo = new MutationObserver(function (recs) {
    var redessin = null;
    for (var i = 0; i < recs.length; i++) if (recs[i].type === 'childList') redessin = recs[i].target;
    var nouvelle = M.arrivee();
    if (!nouvelle && redessin && redessin === enCours && !premiere) finArrivee(enCours);   // l'écran se redessine pendant sa fenêtre d'arrivée : les nouveaux blocs se posent sans bouger
    M.planifier();
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['data-ecran-actif'] });
  var sections = document.querySelectorAll('section[data-ecran]');
  for (var s = 0; s < sections.length; s++) mo.observe(sections[s], { childList: true });

  /* ---------- les rangs : 8 au plus (le bandeau + 7 blocs), du premier écran, jamais un bloc dans un bloc qui bouge ----------
     Jamais une rangée immobile juste sous un bloc qui monte (sinon le bloc « tombe » sur elle puis s'en écarte : un sursaut).
     Donc : toutes les rangées du premier écran prennent leur rang dans l'ordre (enfants directs de
     .page compris : barre des vues, avis, titres, onglets) ; un « mur » (une carte, une surface collante) ne bouge pas, et rien de ce qui est posé
     au-dessus de lui ne bouge (les écrans dont le premier écran est une carte n'ont pas d'arrivée) ; au-delà du 8e rang,
     le reste du premier écran suit le dernier rang. */
  var LIGNES = '.of-l,.pr-l,.gr-lg,.gr-lo,.li-l,.ap-l,.tn-l,.td-l,.mr-l,.mr-dm .cb,.mr-sig li,.cg-l,.ml-l,.qg-sujet,.qg-tab tbody tr,.bs-mol,.bn-prop,.dc-doc,.lg-etape,.mk-l,.og-l,.rv-barre .rv-ronds';
  var CANDIDATS = '.bandeau,.page>:not(.entre),.page>.carte,.carte.ident,.entre>*,' + LIGNES;
  var SURFACES = '.ca-volet,.ca-pan,.ca-bulle,.cg-bulle,.pi-feuille,.td-feuille,.td-pop,.td-out,.dc-conf,.bn-dict,.og-panc,.og-selbar,.gr-panier,.ac-volet,.dy-volet,.outils,.menu-plus';
  var EXCLUS = '#ac-zone,#ca-zone,#cs-zone,#cg-zone,[role="dialog"],#td-feuille,.pr-selbar,.og-selbar,' + SURFACES;
  function dansUn(el, set, sec) { for (var p = el; p && p !== sec; p = p.parentElement) if (set.has(p)) return true; return false; }
  var BOITES = new Map();   // boîte de chaque bloc retenu, relevée par ranger() (lectures de ce passage)
  function ranger(sec) {
    BOITES.clear();
    var H = innerHeight, liste = sec.querySelectorAll(CANDIDATS), pris = [], rects = new Map(), vus = new Set(), hors = new Set(), murs = [], tables = [], ex = [], env = [];
    // cartes et surfaces de l'écran, cherchées une seule fois : visibles, ou cachées mais fixes (un ancêtre transformé les décrocherait à l'ouverture)
    var lx = sec.querySelectorAll(EXCLUS);
    for (var e0 = 0; e0 < lx.length; e0++) if (lx[e0].getClientRects().length || getComputedStyle(lx[e0]).position === 'fixed') ex.push(lx[e0]);
    function examiner(el, r) {   // un bloc qui bougera, un mur, ou rien
      var est = false, dansEx = false, contient = false;
      for (var x = 0; x < ex.length; x++) { if (ex[x] === el) est = true; else if (ex[x].contains(el)) { dansEx = true; break; } else if (el.contains(ex[x])) contient = true; }
      if (dansEx) return;   // dans une carte ou une surface de geste : ni bloc, ni mur
      var haut = el.parentElement && (el.parentElement.classList.contains('page') || el.parentElement.classList.contains('sous-bandeau')), cs = est || haut ? getComputedStyle(el) : null, pos = cs ? cs.position : '';
      if (pos === 'absolute' || pos === 'fixed') return;   // hors du flux
      // une enveloppe de mise en page (div sans fond, sans bord ni ombre, plusieurs enfants) : ses enfants prennent leur rang ; elle-même seulement si rien d'elle ne bouge
      if (haut && !est && el.tagName === 'DIV' && el.children.length > 1 && /^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor) && cs.backgroundImage === 'none' && cs.boxShadow === 'none' && !parseFloat(cs.borderTopWidth) && !parseFloat(cs.borderBottomWidth)) { env.push([el, r]); return; }
      if (est || pos === 'sticky') { if (r.height > 1) murs.push(r); return; }   // un mur (une carte, une surface collante) : il reste posé
      if (contient) return;   // contient une surface : il ne bouge pas d'un bloc ; ce qu'il contient est examiné à part
      pris.push(el); rects.set(el, r); vus.add(el);
    }
    function voir(el) { if (!visible(el)) { hors.add(el); return null; } var r = el.getBoundingClientRect(); if (!(r.top < H && r.bottom > 0)) { hors.add(el); return null; } return r; }
    for (var i = 0; i < liste.length && pris.length < 40; i++) {
      var el = liste[i], tb = el.closest('table');
      if (tb) { if (tables.indexOf(tb) >= 0) continue; tables.push(tb); el = tb.closest('.carte'); if (!el || !sec.contains(el)) continue; }   // un tableau arrive d'un bloc, avec ses filets
      if (dansUn(el, vus, sec) || dansUn(el, hors, sec) || el.matches('main,section[data-ecran],.page')) continue;   // dans un bloc déjà retenu, ou hors du premier écran
      var lie = false; for (var k = 0; k < pris.length; k++) if (el.contains(pris[k])) { lie = true; break; }
      if (lie) continue;
      var r = voir(el); if (r) examiner(el, r);
    }
    // les rangées voisines (avis, titres, onglets, notes) : tout frère d'un bloc retenu ou de l'un de ses ancêtres, jusqu'à .page, prend son rang
    var anc = new Set(), faits = new Set(), base = pris.slice();
    for (var a0 = 0; a0 < base.length; a0++) for (var p0 = base[a0].parentElement; p0 && p0 !== sec; p0 = p0.parentElement) anc.add(p0);
    for (var b = 0; b < base.length && pris.length < 40; b++) for (var P = base[b]; P && P !== sec && P.parentElement && !P.classList.contains('page'); P = P.parentElement) {
      var pa = P.parentElement; if (faits.has(pa)) continue; faits.add(pa);
      for (var f = 0; f < pa.children.length; f++) { var S = pa.children[f];
        if (anc.has(S) || vus.has(S) || hors.has(S) || /^(SCRIPT|STYLE|TEMPLATE|BR|LINK)$/.test(S.tagName) || dansUn(S, vus, sec)) continue;
        var rs = voir(S); if (rs) examiner(S, rs); }
    }
    for (var e1 = 0; e1 < env.length; e1++) { var E1 = env[e1][0], plein = false; for (var e2 = 0; e2 < pris.length; e2++) if (E1.contains(pris[e2])) { plein = true; break; } if (!plein && !dansUn(E1, vus, sec)) { pris.push(E1); rects.set(E1, env[e1][1]); vus.add(E1); } }
    pris.sort(function (u, v) { return u === v ? 0 : (u.compareDocumentPosition(v) & 4 ? -1 : 1); });
    var garde = [];
    for (var n = 0; n < pris.length; n++) {
      var q = rects.get(pris[n]), dessus = false;
      for (var m = 0; m < murs.length; m++) { var w = murs[m]; if (q.bottom <= w.top + 1 && q.right > w.left + 1 && q.left < w.right - 1) { dessus = true; break; } }
      if (!dessus) { garde.push(pris[n]); BOITES.set(pris[n], q); }   // posé au-dessus d'un mur : il resterait immobile sous lui-même… donc il ne bouge pas
    }
    return garde;
  }
  function poserRangs(pris) { for (var n = 0; n < pris.length; n++) { var k = String(Math.min(n, RANGS_MAX - 1)); pris[n].setAttribute('data-m-r', k); pris[n].style.setProperty('--m-r', k); } }
  /* les graphiques : ceux du premier écran, dans un bloc qui arrive (et le tracé de la tournée du GPS), se dessinent à l'arrivée ;
     ceux qui sont SOUS le premier écran se dessinent la première fois qu'ils entrent à l'écran (une fois par page) ; les autres se posent finis */
  var GRAPHES = [['.bar12 i,.cb-b,.hb-bar i,.bs-prop i,.ap-pist i,.lg-pile i,.gr-empile i,.mr-b,.pi-cmpb i,.tn-bar-x', 'b'], ['.bar', 'c'], ['.trace', 't'], ['.anneau .arc', 'a'],
    ['svg.courbe path[fill^="url"]', 'aire'], ['svg.courbe circle', 'pt'], ['svg.spark circle', 'ps']];
  var SURF_G = '.ca-volet,.ca-pan,.pi-feuille,.ac-volet,.dy-volet';
  function graphes(sec, pris) {   // les lectures : rend ce qui se dessine maintenant, et les groupes qui attendront d'entrer à l'écran
    var zones = new Set(pris), gps = sec.querySelector('#ac-zone'); if (gps) zones.add(gps);
    function zoneDe(el) { for (var p = el; p && p !== sec; p = p.parentElement) if (zones.has(p)) return p; return null; }
    var H = innerHeight, maintenant = [], attente = [], boites = new Map(), groupes = new Map();
    for (var g = 0; g < GRAPHES.length; g++) {
      var l = sec.querySelectorAll(GRAPHES[g][0]);
      for (var i = 0; i < l.length; i++) {
        var e = l[i]; if (e.closest(SURF_G)) continue;
        var z = zoneDe(e), dz = !!z, tab = !!e.closest('table');
        if (tab && !dz) continue;   // un graphique de tableau hors d'un bloc qui arrive : posé fini (aucune lecture de mise en page)
        var bz = z && (z === gps ? { bottom: 0 } : BOITES.get(z)); if (bz && bz.bottom <= H) { maintenant.push([e, GRAPHES[g][1]]); continue; }   // bloc qui arrive, tout entier dans le premier écran (ou la carte du GPS) : sans relire la mise en page
        var rac = e.ownerSVGElement || e.parentElement; if (!rac) continue;
        var b = boites.get(rac); if (b === undefined) { b = rac.getClientRects().length ? rac.getBoundingClientRect() : null; boites.set(rac, b); }
        if (!b) continue;
        if (b.top < H && b.bottom > 0) { if (dz) maintenant.push([e, GRAPHES[g][1]]); }
        else if (b.top >= H && !tab) { var q = groupes.get(rac); if (!q) { q = { rac: rac, l: [] }; groupes.set(rac, q); attente.push(q); } q.l.push([e, GRAPHES[g][1]]); }
      }
    }
    return { maintenant: maintenant, attente: attente };
  }
  var ATTENTE = new WeakMap();
  var io2 = window.IntersectionObserver ? new IntersectionObserver(function (es) {
    for (var i = 0; i < es.length; i++) {
      var e = es[i], rac = e.target; if (!e.isIntersecting) continue;
      io2.unobserve(rac); var l = ATTENTE.get(rac); ATTENTE.delete(rac); if (!l || !rac.isConnected) continue;
      for (var k = 0; k < l.length; k++) l[k][0].setAttribute('data-m-g', l[k][1]);
      rac.classList.add('m-dessine'); (function (r) { setTimeout(function () { r.classList.remove('m-dessine'); }, 1300); })(rac);
    }
  }, { threshold: 0.25 }) : null;
  M.armer.push(function () {
    if (!premiere) return;
    var sec = premiere; premiere = null;
    if (!sec.isConnected || sec.hidden || !sec.classList.contains('m-arrive')) return;
    var pris = ranger(sec), gr = graphes(sec, pris), nombres = choisirChiffres(sec);   // les lectures ; les écritures viennent après toutes les lectures du passage
    return function () {
      poserRangs(pris);
      for (var i = 0; i < gr.maintenant.length; i++) gr.maintenant[i][0].setAttribute('data-m-g', gr.maintenant[i][1]);
      if (io2) for (var j = 0; j < gr.attente.length; j++) { ATTENTE.set(gr.attente[j].rac, gr.attente[j].l); io2.observe(gr.attente[j].rac); }
      lancerChiffres(nombres);
    };
  });

  /* ---------- les grands chiffres : J.compter pose TOUJOURS la valeur exacte ; à l'arrivée, 4 au plus (≥ 22 px, ≥ 20) repartent de 90 %
     et sont exacts 500 ms après le changement (courbe 1-(1-t)^3) ; la dernière image restitue le texte exact ---------- */
  var DONNEES = new WeakMap(), compter0 = J.compter;
  J.compter = function (el, fin, fmt, dur) {
    if (!el) return;
    if (!isFinite(fin)) fin = 0;
    try { el.innerHTML = fmt(fin); } catch (e) { return compter0.apply(this, arguments); }
    el.setAttribute('data-m-c', '');
    DONNEES.set(el, { fin: fin, fmt: fmt });
    M.arrivee();
  };
  var NB = /^(\D*?)(-?\d(?:[\d\u00a0\u202f\u2009 ]*\d)?(?:,\d+)?)(\D*)$/;
  function formater(v, dec, sep) {   // même séparateur de milliers que le texte d'origine : la largeur ne saute pas
    var s = Math.abs(v).toFixed(dec).split('.'), e = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return (v < 0 ? '-' : '') + e + (dec ? ',' + s[1] : '');
  }
  function lancer(el) {
    var d = DONNEES.get(el), ecrire, fin;
    // seuls les montants et les compteurs roulent ; un pourcentage, un écart signé ou fléché est posé exact (une baisse en rouge
    // qui se creuse sous les yeux se lit comme une alerte qui s'aggrave)
    var vu = el.textContent; if (d) { try { vu = String(d.fmt(d.fin)).replace(/<[^>]*>/g, ''); } catch (x) {} }
    if (/%/.test(vu) || /^\s*[−+\-–↘↗▲▼]/.test(vu)) return false;
    if (d) { fin = d.fin; if (Math.abs(fin) < 20) return false; ecrire = function (v, dernier) { el.innerHTML = d.fmt(dernier ? fin : v); }; }
    else {
      var t = el.firstChild, m = t && t.nodeType === 3 ? NB.exec(t.nodeValue) : null; if (!m) return false;
      var brut = t.nodeValue, sep = (/[\u00a0\u202f\u2009 ]/.exec(m[2]) || [' '])[0], dec = (m[2].split(',')[1] || '').length;
      fin = parseFloat(m[2].replace(/[\u00a0\u202f\u2009 ]/g, '').replace(',', '.'));
      if (!isFinite(fin) || Math.abs(fin) < 20) return false;   // moins de 20 : immobile
      ecrire = function (v, dernier) { t.nodeValue = dernier ? brut : m[1] + formater(v, dec, sep) + m[3]; };
    }
    var t0 = M.t0, fini = false, D = COMPTE - 20;   // la dernière image tombe avant 500 ms ; un minuteur de secours pose la valeur exacte à 490 ms
    var secours = setTimeout(function () { if (!fini) { fini = true; ecrire(fin, true); } }, Math.max(0, t0 + COMPTE - 10 - performance.now()));
    (function pas() { if (fini) return; var k = Math.min(1, (performance.now() - t0) / D), v = fin * (DEPART + (1 - DEPART) * (1 - Math.pow(1 - k, 3)));
      if (k >= 1) { fini = true; clearTimeout(secours); } ecrire(v, k >= 1); if (k < 1) requestAnimationFrame(pas); })();
    return true;
  }
  function choisirChiffres(sec) {   // du premier écran seulement (un chiffre plus bas roulerait sans être vu), 60 candidats examinés au plus
    var l = sec.querySelectorAll('.stat .val,.ident-mois b,.cb-v,[data-m-c]'), choisis = [], H = innerHeight;
    for (var i = 0; i < l.length && i < 60 && choisis.length < 2 * CHIFFRES_MAX; i++) {
      var el = l[i]; if (!visible(el)) continue;
      var r = el.getBoundingClientRect(); if (!(r.top < H && r.bottom > 0)) continue;
      if (el.closest(SURFACES) || parseFloat(getComputedStyle(el).fontSize) < 22) continue;   // grands chiffres seulement ; ceux des tableaux et des lignes sont posés exacts
      choisis.push(el);
    }
    return choisis;
  }
  function lancerChiffres(l) { for (var j = 0, pris = 0; j < l.length && pris < CHIFFRES_MAX; j++) if (lancer(l[j])) pris++; }

  /* ---------- I et J : la lueur du bandeau et le point « Vous êtes ici » du GPS se mettent en pause hors écran et onglet caché ---------- */
  document.addEventListener('visibilitychange', function () { root.classList.toggle('m-pause', !!document.hidden); });
  var io = window.IntersectionObserver ? new IntersectionObserver(function (es) {
    for (var i = 0; i < es.length; i++) { var e = es[i]; if (!e.target.isConnected) { io.unobserve(e.target); continue; } e.target.classList.toggle('m-hors', !e.isIntersecting); }
  }) : null;
  M.armer.push(function () {
    var sec = ecranVisible(); if (!io || !sec) return null;
    var l = sec.querySelectorAll('.bandeau:not([data-m-b]),#ac-zone:not([data-m-b])'); if (!l.length) return null;
    return function () { for (var i = 0; i < l.length; i++) { l[i].setAttribute('data-m-b', ''); io.observe(l[i]); } };
  });

  /* ---------- D. la lumière sous le pointeur : UN écouteur délégué, une écriture par image, sur la carte survolée seulement ---------- */
  var PORTES = '.pr-porte,.og-porte,.mk-porte,.pi-mes,.ac-porte';
  if (window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    var sous = null, px = 0, py = 0, img = 0;
    document.addEventListener('pointermove', function (e) {
      var c = e.target && e.target.closest ? e.target.closest(PORTES) : null; if (!c) return;
      sous = c; px = e.clientX; py = e.clientY;
      if (img) return;
      img = requestAnimationFrame(function () { img = 0; if (!sous) return; var r = sous.getBoundingClientRect(); sous.style.setProperty('--mx', (px - r.left) + 'px'); sous.style.setProperty('--my', (py - r.top) + 'px'); });
    }, { passive: true });
  }

  /* ---------- E. le repère qui glisse : nav.menu, nav.onglets (téléphone), .vues, .seg ----------
     place() tourne au changement de page et quand une section est redessinée (passes de M.armer), après un clic dans un contrôle, à resize,
     à document.fonts.ready (Archivo arrive en swap) et dans un ResizeObserver par contrôle ; nulle part ailleurs. */
  var ETAT = new WeakMap(), MEMOIRE = {};
  var ro = window.ResizeObserver ? new ResizeObserver(function (es) { for (var i = 0; i < es.length; i++) place(es[i].target, true); }) : null;
  function boutons(c) { return c.querySelectorAll(':scope>a,:scope>button'); }
  function actif(c) { var a = c.querySelector(':scope>.on,:scope>[aria-pressed="true"]'); return a && a.offsetWidth ? a : null; }
  function cleCtrl(c) {
    if (c.classList.contains('vues')) return 'vues';   // la barre des quatre vues d'Officines : quatre écrans, une barre chacun
    var sec = c.closest('[data-ecran]'); if (!sec) return null;
    var l = sec.querySelectorAll('.seg'); for (var i = 0; i < l.length; i++) if (l[i] === c) return sec.getAttribute('data-ecran') + ':' + i;
    return null;
  }
  function poser(p, x, y, w, h) { p.style.width = w + 'px'; p.style.height = h + 'px'; p.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
  function mesurer(c, fin) {   // les lectures ; rend les écritures (ou null) ; fin = mesure fine forcée (police, taille, clic)
    if (!c.isConnected) { if (ro) ro.unobserve(c); return null; }
    if (!c.offsetWidth) return null;   // contrôle caché (autre écran, barre du téléphone sur ordinateur)
    var p = c.querySelector(':scope>.m-repere'), a = actif(c);
    if (!a) return p ? function () { p.hidden = true; } : null;   // aucun élément actif : le repère disparaît au lieu de rester sur l'ancien
    var x = a.offsetLeft, y = a.offsetTop, w = a.offsetWidth, h = a.offsetHeight, ix = x, iy = y, iw = w, ih = h, st = p && ETAT.get(c);
    if (!fin && p && !p.hidden && st && st.a === a && st.ix === x && st.iy === y && st.iw === w && st.ih === h) return null;   // rien n'a bougé : ni mesure fine, ni écriture (passage du moteur léger)
    // cotes fractionnaires (offset* sont des entiers : le repère était jusqu'à 0,48 px plus étroit que le bouton). Le centre de la boîte
    // ne bouge pas sous l'appui (scale autour du centre) et la largeur calculée ignore les transformations ; repli sur les entiers au moindre doute.
    try {
      var cs0 = getComputedStyle(a), fw = parseFloat(cs0.width), fh = parseFloat(cs0.height);
      if (cs0.boxSizing !== 'border-box') { fw += parseFloat(cs0.paddingLeft) + parseFloat(cs0.paddingRight) + parseFloat(cs0.borderLeftWidth) + parseFloat(cs0.borderRightWidth); fh += parseFloat(cs0.paddingTop) + parseFloat(cs0.paddingBottom) + parseFloat(cs0.borderTopWidth) + parseFloat(cs0.borderBottomWidth); }
      var ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect();
      var fx = (ra.left + ra.right) / 2 - rc.left - c.clientLeft + c.scrollLeft - fw / 2, fy = (ra.top + ra.bottom) / 2 - rc.top - c.clientTop + c.scrollTop - fh / 2;
      if (isFinite(fw) && isFinite(fh) && isFinite(fx) && isFinite(fy) && Math.abs(fw - w) < 1.5 && Math.abs(fh - h) < 1.5 && Math.abs(fx - x) < 1.5 && Math.abs(fy - y) < 1.5) { x = fx; y = fy; w = fw; h = fh; }
    } catch (x0) {}
    if (p) return function () { if (p.hidden) { p.hidden = false; p.classList.add('m-pose'); poser(p, x, y, w, h); finPose(p); } else poser(p, x, y, w, h); ETAT.set(c, { x: x, y: y, w: w, h: h, ix: ix, iy: iy, iw: iw, ih: ih, a: a }); };
    var bs = boutons(c), k = cleCtrl(c), m = k && MEMOIRE[k], ia = [].indexOf.call(bs, a), autre = null;
    for (var q = 0; q < bs.length; q++) if (bs[q] !== a) { autre = bs[q]; break; }
    // le fond de l'actif peut être EN COURS de transition (transparent → bleu, 250 ms, style.css:61) : on la termine avant de le copier, sinon le repère
    // garde un bleu presque transparent et le texte blanc de l'onglet devient illisible
    [a, autre].forEach(function (b) { if (b && b.getAnimations) b.getAnimations().forEach(function (t) { if (t.transitionProperty) t.finish(); }); });
    var cs = getComputedStyle(a);
    var vu = { fond: cs.backgroundColor, image: cs.backgroundImage, ombre: cs.boxShadow, coins: cs.borderRadius, couleur: cs.color, inactif: autre ? getComputedStyle(autre).color : cs.color, statique: getComputedStyle(c).position === 'static' };
    var glisse = m && Date.now() - m.t < 1000 && m.n === bs.length && m.i !== ia && m.i >= 0;
    return function () {
      if (vu.statique) c.style.position = 'relative';
      var r = document.createElement('i'); r.className = 'm-repere m-pose'; r.setAttribute('aria-hidden', 'true');
      r.style.backgroundColor = vu.fond; r.style.backgroundImage = vu.image; r.style.boxShadow = vu.ombre; r.style.borderRadius = vu.coins;
      c.insertBefore(r, c.firstChild);
      if (glisse) {   // décalage mémorisé : le contrôle recréé part de l'ancienne place, et les textes changent de couleur pendant le même trajet (transition)
        var vieux = bs[m.i]; poser(r, m.x, m.y, m.w, m.h); a.style.color = vu.inactif; if (vieux) vieux.style.color = vu.couleur;
        void r.offsetWidth; r.classList.remove('m-pose'); a.style.color = ''; if (vieux) vieux.style.color = '';
      }
      c.classList.add('a-repere'); poser(r, x, y, w, h); ETAT.set(c, { x: x, y: y, w: w, h: h, ix: ix, iy: iy, iw: iw, ih: ih, a: a });
      if (!glisse) finPose(r);
      if (ro) ro.observe(c);
    };
  }
  function finPose(r) { requestAnimationFrame(function () { requestAnimationFrame(function () { r.classList.remove('m-pose'); }); }); }
  function place(c, fin) { var f = mesurer(c, fin); if (f) f(); }
  function controles() { var l = [].slice.call(document.querySelectorAll('nav.menu,nav.onglets')), sec = ecranVisible(); if (sec) l = l.concat([].slice.call(sec.querySelectorAll('.vues,.seg'))); return l; }
  function toutes() { var l = controles(), f = []; for (var i = 0; i < l.length; i++) { var w = mesurer(l[i], true); if (w) f.push(w); } for (var j = 0; j < f.length; j++) f[j](); }
  M.armer.push(function () { var l = controles(), f = []; for (var i = 0; i < l.length; i++) { var w = mesurer(l[i]); if (w) f.push(w); } return f.length ? function () { for (var j = 0; j < f.length; j++) f[j](); } : null; });
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var c = t.closest('.seg,.vues');
    if (c) { var k = cleCtrl(c), st = ETAT.get(c), bs = boutons(c), a = actif(c); if (k && st) MEMOIRE[k] = { x: st.x, y: st.y, w: st.w, h: st.h, n: bs.length, i: a ? [].indexOf.call(bs, a) : -1, t: Date.now() }; }
    if (t.closest('nav.menu,nav.onglets,.seg,.vues')) { setTimeout(toutes, 0); setTimeout(toutes, 120); }   // après le gestionnaire de l'écran (bascule sur place, ou contrôle redessiné)
  }, true);
  addEventListener('resize', toutes);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(toutes);

  /* ---------- F. les sorties : classe de sortie, attente de sa durée, puis seulement le vrai masquage (hidden) ---------- */
  function sortie(nom, ids, ms) {
    var vrai = J[nom]; if (typeof vrai !== 'function') return;
    var minuteur = 0;
    J[nom] = function (ouvrir) {
      var els = ids.map(function (i) { return document.getElementById(i); }), moi = this, args = arguments;
      if (ouvrir) { clearTimeout(minuteur); minuteur = 0; els.forEach(function (e) { if (e) e.classList.remove('m-sort'); }); return vrai.apply(moi, args); }
      if (!els[0] || els[0].hidden) return vrai.apply(moi, args);   // déjà caché : le travail habituel (aria-expanded), sans délai
      if (minuteur) return;   // sortie déjà en cours
      els.forEach(function (e) { if (e) e.classList.add('m-sort'); });
      minuteur = setTimeout(function () { minuteur = 0; els.forEach(function (e) { if (e) e.classList.remove('m-sort'); }); vrai.apply(moi, args); }, ms);
    };
  }
  sortie('outils', ['outils', 'voile'], 200);
  sortie('menuPlus', ['menu-plus'], 140);
  var toast0 = J.toast;
  if (typeof toast0 === 'function') J.toast = function () {
    var e = document.getElementById('toast');
    toast0.apply(this, arguments);   // pose le texte, montre, programme son masquage (J.toast.t, repris ci-dessous)
    if (!e) return;
    e.classList.remove('m-sort'); clearTimeout(J.toast.t); clearTimeout(J.toast.s);
    J.toast.t = setTimeout(function () { e.classList.add('m-sort'); J.toast.s = setTimeout(function () { e.hidden = true; e.classList.remove('m-sort'); }, 140); }, 2460);
  };

  /* ---------- G et H : un seul écouteur de clic délégué (phase de capture, avant les gestionnaires des écrans) ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var su = t.closest('summary'), d = su && su.parentElement;
    if (d && d.tagName === 'DETAILS' && !d.open) { d.classList.add('m-ouvre'); setTimeout(function () { d.classList.remove('m-ouvre'); }, 450); }   // il va s'ouvrir : son contenu glissera
    var pan = t.closest('[data-d60]') ? document.getElementById('ac-dpan') : null;
    if (pan) { pan.classList.add('m-ouvre'); setTimeout(function () { pan.classList.remove('m-ouvre'); }, 700); }   // le pli DAILY de l'accueil
    var cp = t.closest('.cp'), el = cp && cp.parentNode;   // H : la valeur copiée s'éclaire (relancée à chaque copie, sans lecture de mise en page)
    if (el && el.classList) { el.classList.remove('m-change'); requestAnimationFrame(function () { el.classList.add('m-change'); setTimeout(function () { el.classList.remove('m-change'); }, 1000); }); }
  }, true);
})();

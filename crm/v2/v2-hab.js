/* ═══════════════════════════════════════════════════════════════════
   v2-hab.js — « La garde-robe » (v1 des habillages, 16/10/2026)
   Huit habillages complets : un toucher, toute l'app change, avec un balayage de matière.
   - lit l'habillage AVANT le premier dessin (navigateur), puis se recale sur la ligne `profils` (V2.accueilPont.couleur)
   - aucun réglage à faire : chaque habillage est déjà poussé au maximum
   - Escale (et OPSO, qui a sa propre appli) ne sont jamais habillés
   Safari : transformations et opacité sur UN calque, aucun flou, aucune vidéo ; mouvement coupé avec prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var CLE = 'jarvis_hab_v1';
  var GARDE = [
    { k: 'bleu', nom: 'Bleu JARVIS', mot: 'L\'app d\'origine, claire et vive.' },
    { k: 'leopard', nom: 'Léopard', mot: 'Fourrure fauve, rosettes brun-noir, lumière chaude.' },
    { k: 'marbre', nom: 'Marbre noir', mot: 'Pierre sombre veinée d\'or, éclairée à la bougie.' },
    { k: 'nacre', nom: 'Nacre', mot: 'Opale irisée, reflets perle et rose.' },
    { k: 'foret', nom: 'Forêt profonde', mot: 'Sous-bois sombre, rayons de soleil dans les feuilles.' },
    { k: 'terracotta', nom: 'Terracotta', mot: 'Argile cuite, soleil bas de fin d\'été.' },
    { k: 'glacier', nom: 'Glacier', mot: 'Glace bleutée, facettes et lumière froide.' },
    { k: 'velours', nom: 'Velours bordeaux', mot: 'Velours profond, reflet de lampe de salon.' }
  ];
  var ANCIENNES = ['indigo', 'emeraude', 'canard', 'ambre', 'prune'];   // les anciennes teintes : valides, elles colorent l'app (sans matière)
  var CLAIRS = { bleu: 1, leopard: 1, nacre: 1, terracotta: 1, glacier: 1 };
  var H = document.documentElement;
  var memo = { ouvert: false, dock: null, opener: null, sx: { band: 0, dock: 0 } };

  function escale() { return !!(window.V2_BRAND && window.V2_BRAND.escale); }
  function calme() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function connu(k) { return GARDE.some(function (g) { return g.k === k; }) || ANCIENNES.indexOf(k) >= 0; }
  function lire() { try { return localStorage.getItem(CLE) || ''; } catch (e) { return ''; } }
  function ecrire(k) { try { if (k && k !== 'bleu') localStorage.setItem(CLE, k); else localStorage.removeItem(CLE); } catch (e) {} }
  function courant() { var k = H.getAttribute('data-hab'); return k || 'bleu'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Pose l'habillage sur <html> sans animation. Le bleu d'origine retire tout : l'app est alors celle d'aujourd'hui, pixel pour pixel.
  function poser(k) {
    if (escale() || !k || k === 'bleu' || !connu(k)) { H.removeAttribute('data-hab'); H.removeAttribute('data-hab-ton'); k = 'bleu'; }
    else { H.setAttribute('data-hab', k); H.setAttribute('data-hab-ton', CLAIRS[k] || ANCIENNES.indexOf(k) >= 0 ? 'clair' : 'sombre'); }
    try { var m = document.querySelector('meta[name="theme-color"]'); if (m && !escale()) m.setAttribute('content', { leopard: '#C99443', marbre: '#16171B', nacre: '#EDE6F2', foret: '#10231C', terracotta: '#C9683F', glacier: '#DCEBF5', velours: '#3A0D1A' }[k] || '#0050E6'); } catch (e) {}
    ecrire(k);
    majSelection();
    lampeSync();
    return k;
  }

  // ─── La lampe (p2 « La lumière de scène ») : UN calque fixe, déplacé en transform seulement, UN seul requestAnimationFrame ───
  // Au repos elle dérive très lentement (deux sinus de 34 s et 23 s, 7 % de la largeur et 5 % de la hauteur (la lumière douce respire, elle ne danse pas)) ; au pointeur elle se rapproche doucement (inertie).
  // Arrêtée quand l'onglet est caché ; coupée en mouvement réduit (le calque reste posé à sa place de repos : l'état figé est déjà éclairé).
  var REPOS = { leopard: [.05, .26], marbre: [.50, .06], nacre: [.92, .04], foret: [.08, .02], terracotta: [.90, .10], glacier: [.50, .00], velours: [.12, .05] };
  var lampe = { el: null, raf: 0, tx: 0, ty: 0, cx: 0, cy: 0, ecrit: '' };
  function lampeBoucle(ts) {
    lampe.raf = 0;
    if (document.hidden || !lampe.el || !H.hasAttribute('data-hab') || calme()) return;
    var t = ts / 1000, w = window.innerWidth, h = window.innerHeight;
    lampe.cx += (lampe.tx - lampe.cx) * 0.045; lampe.cy += (lampe.ty - lampe.cy) * 0.045;
    var x = Math.sin(t * 6.2832 / 34) * 0.07 * w + lampe.cx, y = Math.sin(t * 6.2832 / 23 + 1) * 0.05 * h + lampe.cy;
    var v = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    if (v !== lampe.ecrit) { lampe.ecrit = v; lampe.el.style.transform = v; }
    lampe.raf = requestAnimationFrame(lampeBoucle);
  }
  function lampeDemarrer() { if (!lampe.raf && lampe.el && !document.hidden && !calme() && H.hasAttribute('data-hab')) lampe.raf = requestAnimationFrame(lampeBoucle); }
  function lampeSync() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', lampeSync, { once: true }); return; }
    var k = H.getAttribute('data-hab');
    if (!k || !REPOS[k]) { if (lampe.el && lampe.el.parentNode) lampe.el.parentNode.removeChild(lampe.el); lampe.el = null; if (lampe.raf) { cancelAnimationFrame(lampe.raf); lampe.raf = 0; } return; }
    if (!lampe.el) {
      var e = document.createElement('div'); e.className = 'hab-lampe'; e.setAttribute('aria-hidden', 'true'); e.innerHTML = '<i></i>';
      var hl = document.querySelector('.v2-halo');
      if (hl && hl.parentNode) hl.parentNode.insertBefore(e, hl.nextSibling); else document.body.insertBefore(e, document.body.firstChild);
      lampe.el = e; lampe.ecrit = '';
    }
    lampe.tx = lampe.ty = 0;
    if (calme()) { lampe.el.style.transform = ''; lampe.ecrit = ''; } else lampeDemarrer();
  }
  window.addEventListener('pointermove', function (e) {
    var k = H.getAttribute('data-hab'), r = REPOS[k]; if (!r || e.pointerType === 'touch') return;
    lampe.tx = (e.clientX - r[0] * window.innerWidth) * 0.14; lampe.ty = (e.clientY - r[1] * window.innerHeight) * 0.14;
  }, { passive: true });
  document.addEventListener('pointerleave', function () { lampe.tx = lampe.ty = 0; });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (lampe.raf) { cancelAnimationFrame(lampe.raf); lampe.raf = 0; } } else lampeDemarrer(); });

  // Premier dessin : le navigateur d'abord (aucun clignotement), la ligne `profils` ensuite (sync, appelée par l'accueil).
  poser(lire());

  function sync(k) { if (k === courant() && (k === 'bleu' ? !H.hasAttribute('data-hab') : true)) { ecrire(k); return; } poser(k); }

  // ─── Le balayage de matière ───
  // Un seul calque plein écran qui porte la matière du NOUVEL habillage, glisse sur l'écran (transform seulement), change l'habillage
  // en dessous quand il couvre tout, puis repart. Un liseré de lumière court sur son bord d'attaque.
  function balayer(k, fin) {
    var ap = null;
    if (calme() || !H.animate) { fin(); return; }
    var el = document.createElement('div');
    el.className = 'hab-balai'; el.setAttribute('data-hab', k); el.setAttribute('aria-hidden', 'true');
    var nom = ''; GARDE.forEach(function (g) { if (g.k === k) nom = g.nom; });
    el.innerHTML = '<i class="hab-balai-m"></i><i class="hab-balai-l"></i><b class="hab-balai-n">' + esc(nom) + '</b>';
    document.body.appendChild(el);
    var w = Math.max(window.innerWidth, 320);
    var dir = 1;
    var a1 = el.animate([{ transform: 'translate3d(-104%,0,0) skewX(-6deg)' }, { transform: 'translate3d(0,0,0) skewX(0deg)' }], { duration: 520, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' });
    a1.onfinish = function () {
      fin();
      requestAnimationFrame(function () {
        var a2 = el.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(' + (dir * 104) + '%,0,0) skewX(6deg)' }], { duration: 620, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
        a2.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el); };
      });
    };
    a1.oncancel = function () { fin(); if (el.parentNode) el.parentNode.removeChild(el); };
  }

  var enCours = false;
  // Le geste de choix : balayage, puis l'habillage est gardé (même chemin que l'ancienne couleur : ligne `profils`).
  function choisir(k, opt) {
    if (escale() || !connu(k)) return Promise.resolve(false);
    if (k === courant() && !(opt && opt.force)) return Promise.resolve(true);
    function garder() {
      var P = window.V2 && V2.accueilPont;
      if (P && P.couleur) P.couleur(k);   // garde + appelle sync()
      if (courant() !== (k === 'bleu' ? 'bleu' : k)) poser(k);
    }
    if ((opt && opt.instant) || enCours) { garder(); return Promise.resolve(true); }
    enCours = true;
    return new Promise(function (ok) { balayer(k, function () { garder(); }); setTimeout(function () { enCours = false; ok(true); }, calme() ? 0 : 1180); if (calme()) enCours = false; });
  }

  // ─── Les aperçus : un mini-écran de l'app, habillé de la matière réelle ───
  function mini(g) {
    return '<span class="hab-mini" data-hab="' + g.k + '" aria-hidden="true">' +
      '<span class="hm-top"><b class="hm-logo"></b><b class="hm-bar"></b><b class="hm-dot"></b></span>' +
      '<span class="hm-corps"><span class="hm-hero"><b></b><i></i></span><span class="hm-rangee"><span class="hm-c"><b></b><i></i></span><span class="hm-c"><b></b><i></i></span><span class="hm-c"><b></b><i></i></span></span></span>' +
      '<span class="hm-lueur"></span></span>';
  }
  function carte(g, grand) {
    var on = g.k === courant();
    return '<button type="button" class="hab-p' + (grand ? ' hab-p-g' : '') + '" role="radio" aria-checked="' + on + '" data-hab-k="' + g.k + '" aria-label="' + esc(g.nom) + '">' +
      mini(g) + '<span class="hab-nom">' + esc(g.nom) + '</span>' + (grand ? '<span class="hab-mot">' + esc(g.mot) + '</span>' : '') + '<span class="hab-coche" aria-hidden="true"></span></button>';
  }
  function majSelection() {
    var c = courant();
    var l = document.querySelectorAll('.hab-p');
    for (var i = 0; i < l.length; i++) l[i].setAttribute('aria-checked', String(l[i].getAttribute('data-hab-k') === c));
  }
  function lierRangee(el, zone) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.hab-p'); if (!b) return;
      choisir(b.getAttribute('data-hab-k'));
    });
    el.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!d) return;
      var l = [].slice.call(el.querySelectorAll('.hab-p')), i = l.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); var n = l[(i + d + l.length) % l.length]; n.focus(); n.scrollIntoView && n.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    el.addEventListener('scroll', function () { memo.sx[zone] = el.scrollLeft; }, { passive: true });
  }
  // Monte la rangée d'aperçus dans un conteneur (bande « Personnaliser » : zone 'band' ; tiroir « Mon habillage » : zone 'dock').
  function monter(el, zone) {
    if (!el) return;
    var grand = zone === 'dock';
    el.className = (el.className.replace(/\bhab-rangee\b/g, '') + ' hab-rangee' + (grand ? ' hab-rangee-g' : '')).trim();
    el.setAttribute('role', 'radiogroup'); el.setAttribute('aria-label', 'Habillage de l\'application');
    el.innerHTML = GARDE.map(function (g) { return carte(g, grand); }).join('');
    lierRangee(el, zone);
    el.scrollLeft = memo.sx[zone] || 0;
  }

  // ─── Le tiroir « Mon habillage » (menu du compte, depuis n'importe quel écran) ───
  function ouvrir(opener) {
    if (escale() || memo.ouvert) return;
    memo.ouvert = true; memo.opener = opener || document.activeElement;
    var d = document.createElement('div');
    d.className = 'hab-dock'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'false'); d.setAttribute('aria-label', 'Mon habillage');
    d.innerHTML = '<div class="hab-dock-t"><div><b>Mon habillage</b><span>Un toucher, et toute l\'application change. C\'est gardé pour vous.</span></div>' +
      '<button type="button" class="v2-btn v2-btn-primary hab-fin">Terminé</button></div><div class="hab-dock-r"></div>';
    document.body.appendChild(d); memo.dock = d;
    monter(d.querySelector('.hab-dock-r'), 'dock');
    d.querySelector('.hab-fin').addEventListener('click', fermer);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } });
    requestAnimationFrame(function () { d.classList.add('open'); var s = d.querySelector('.hab-p[aria-checked="true"]') || d.querySelector('.hab-p'); if (s) { try { s.focus({ preventScroll: true }); s.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} } });
  }
  function fermer() {
    var d = memo.dock; if (!d) return;
    memo.ouvert = false; memo.dock = null; d.classList.remove('open');
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, calme() ? 0 : 380);
    var o = memo.opener; memo.opener = null; if (o && document.contains(o)) { try { o.focus({ preventScroll: true }); } catch (e) {} }
  }
  // Appelée par la ligne du menu du compte : ferme d'abord le menu.
  function menu() { var m = document.getElementById('v2-usermenu'); if (m && m._off) m._off(); if (m && m.parentNode) m.parentNode.removeChild(m); ouvrir(document.querySelector('.tp-avb')); }

  window.V2HAB = { liste: GARDE, anciennes: ANCIENNES, courant: courant, sync: sync, choisir: choisir, monter: monter, ouvrir: ouvrir, fermer: fermer, menu: menu, escale: escale, lampe: function () { return { present: !!lampe.el, rafActif: !!lampe.raf, transform: lampe.el ? lampe.el.style.transform : null }; } };
  // le banc de l'atelier (16/10) pose un habillage sans animation, et l'attend
  window.__atelierHabillage = function (k) { return choisir(k, { instant: true, force: true }); };
})();

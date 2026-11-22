/* v2-aube.js — « l'aube » : ce que le CSS ne peut pas faire (19/11/2026). Aucune dépendance.
   - monte la scène (astre, anneaux, horizon, sol) dans chaque bandeau d'écran ;
   - lettres du titre en cascade (chaque mot dans un span insécable, chaque lettre dans un span, aria-label du texte entier, une seule fois par élément) ;
   - l'astre suit doucement le pointeur ; une onde part de l'astre à chaque clic et à chaque frappe ;
   - lumière de l'astre sous le pointeur sur les cartes (variables --au-mx / --au-my) ;
   - tout est en pause hors écran ou onglet caché ; avec « mouvement réduit », seule la scène à l'état final est posée.
   L'appli redessine ses écrans : un MutationObserver sur #v2-root remonte la scène et les lettres. */
(function () {
  'use strict';
  if (!window.matchMedia || !window.addEventListener) return;
  var doc = window.document;
  if (!doc || !doc.documentElement || !doc.createElement) return;

  // Bandeaux : [sélecteur, ancre (le dernier élément du ciel, l'horizon se pose juste dessous), plus petit diamètre d'astre]
  var BANDES = [
    ['.of-hd', '.of-hd-t', 120], ['.td-hd', '.td-expl,.td-phrase', 120], ['.pha-id.fi-hd', '.fi-phrase,.pha-name', 120],
    ['.gr-hd', '.gr-def,.gr-phrase', 120], ['.olm-hd', '.cl1-et,.olm-phrase', 120],
    ['.cpd-head', '.cpd-sub', 120], ['.ac-c-pharma', '.m1-off-b', 120], ['.mkb-tete', '.mkb-sous', 120], ['.aube-tete', '.v2-page-sub,.v2-page-title', 120],
    ['.trn-hd', 'p,h1', 120], ['.dc-tete', 'p,h1', 120], ['.cn-fb', '.cn-fbtop', 44]
  ];
  var HD = BANDES.map(function (b) { return b[0]; }).join(',') + ',#aube-acc';
  var TITRES = '.of-h1,.td-h1,.pha-name,.gr-h1,.olm-h1,.cpd-h1,.mkb-h1,.cn-h1,.trn-hd h1,.dc-tete h1,.aube-tete .v2-page-title,#u2-salut';
  var CARTES = '.ac-c:not(.ac-c-pharma),.m1-c.m1-p,a.of-c,.v2-card,.pha-nav,.pha-kpi,.pha-card,.fbk-b,.v2-todo-add,.v2-todo-list,.v2-kpi,.gr-une,.gr-carte,.olm-porte,.cpd-door,.mkb-porte,.pr-card,.pa-card,.pa-kpi,.dc-card,.trn-card';
  var SCENE = '<i class="aube-ciel"><i class="aube-halo"></i><i class="aube-an aube-a3"></i><i class="aube-an aube-a2"></i><i class="aube-an aube-a1"></i><i class="aube-astre"></i></i><i class="aube-sol"><i class="aube-reflet"></i></i><i class="aube-horizon"></i>';
  var vus = {}, hotes = [], io = null, racine = null, mo = null, planifie = 0, derniere = 0, boucle = 0;

  function calme() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function raf(f) { return (window.requestAnimationFrame || function (g) { return setTimeout(g, 16); })(f); }

  /* ── l'horizon se pose juste sous le titre et sa phrase : le titre est dans le ciel, les boutons sur le sol.
        Règle générale : il ne coupe JAMAIS un bouton ni un texte (il glisse dans l'interstice, sinon sous l'élément, sinon au-dessus). ── */
  var ro = null;
  function config(hd) { for (var i = 0; i < BANDES.length; i++) if (hd.matches && hd.matches(BANDES[i][0])) return BANDES[i]; return null; }
  function candidats(hd, s) {
    var out = [], l = hd.querySelectorAll('*'), i, e, n, k, ok, r;
    for (i = 0; i < l.length && out.length < 500; i++) {
      e = l[i]; if (s.contains(e) || e === s) continue;
      if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA|IMG|SVG|LABEL)$/i.test(e.tagName)) ok = true;
      else { ok = false; for (k = 0; k < e.childNodes.length; k++) { n = e.childNodes[k]; if (n.nodeType === 3 && /\S/.test(n.nodeValue)) { ok = true; break; } } }
      if (!ok) continue;
      r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) out.push(r);
    }
    return out;
  }
  /* ── l'accueil : l'horizon passe par le milieu du champ de recherche, l'astre se place selon l'heure (le matin à gauche, le soir à droite) ── */
  function heros(hd, s) {
    var c = doc.getElementById('aube-champ'), hr = hd.getBoundingClientRect(); if (!c || !hr.height) return;
    var cr = c.getBoundingClientRect(), y = Math.round(cr.top + cr.height / 2 - hr.top), x = Math.round(cr.left + cr.width / 2 - hr.left);
    var d = new Date(), h = d.getHours() + d.getMinutes() / 60, k = Math.max(-1, Math.min(1, (h - 13) / 7));
    s.style.setProperty('--hy', y + 'px'); s.style.setProperty('--hx', x + 'px'); s.style.setProperty('--d0', Math.round(Math.min(440, hr.width * 0.5)) + 'px');
    s.style.setProperty('--dx', Math.round(k * Math.min(hr.width * 0.12, 150)) + 'px');
    s.style.setProperty('--dmax', Math.max(120, Math.round((y - 14) / 0.62)) + 'px');
  }
  function horizon(hd) {
    var s = hd.firstElementChild; if (!s || s.className !== 'aube-scene') return;
    if (hd.id === 'aube-acc') { heros(hd, s); return; }
    var cf = config(hd), q = cf ? cf[1] : '', dmin = cf ? cf[2] : 120;
    var els = q ? hd.querySelectorAll(q) : [], a = els.length ? els[els.length - 1] : null, hr = hd.getBoundingClientRect();
    if (!a || !hr.height) { s.style.removeProperty('--hy'); s.style.removeProperty('--dmax'); return; }
    var ab = a.getBoundingClientRect().bottom - hr.top, y = Math.round(ab + (cf && cf[2] < 100 ? 6 : 12));
    var cs = candidats(hd, s).map(function (r) { return [r.top - hr.top, r.bottom - hr.top]; });
    function libre(v) { for (var i = 0; i < cs.length; i++) if (cs[i][0] < v + 1 && cs[i][1] > v - 1) return false; return true; }
    if (!libre(y)) {
      var dessus = null, dessous = null, i;
      for (i = 0; i < cs.length; i++) if (cs[i][0] < y + 1 && cs[i][1] > y - 1) { dessus = dessus === null ? cs[i][0] : Math.min(dessus, cs[i][0]); dessous = dessous === null ? cs[i][1] : Math.max(dessous, cs[i][1]); }
      var essais = [];
      if (dessus !== null && dessus - ab >= 8) essais.push(Math.round((ab + dessus) / 2));
      if (dessous !== null) essais.push(Math.round(dessous + 6));
      for (i = 0; i < essais.length; i++) if (essais[i] > ab && essais[i] < hr.height - 4 && libre(essais[i])) { y = essais[i]; break; }
    }
    if (y > 24 && y < hr.height - 4) { s.style.setProperty('--hy', y + 'px'); s.style.setProperty('--dmax', Math.max(dmin, Math.round((y - 14) / 0.62)) + 'px'); } else { s.style.removeProperty('--hy'); s.style.removeProperty('--dmax'); }
  }
  function suivre(hd) {
    horizon(hd);
    if (window.ResizeObserver) { if (!ro) ro = new ResizeObserver(function (es) { es.forEach(function (e) { var h = e.target.closest ? e.target.closest('.aube-hd') : e.target; if (h) horizon(h); }); }); ro.observe(hd); if (hd.id === 'aube-acc') { var b = hd.querySelector('.aube-acc-bloc'); if (b) ro.observe(b); } }
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { horizon(hd); });
    setTimeout(function () { horizon(hd); }, 900); setTimeout(function () { horizon(hd); }, 3000);
  }

  /* ── la scène d'un bandeau ── */
  function monter(hd) {
    var p = hd.firstElementChild;
    if (p && p.className === 'aube-scene') return;
    var s = doc.createElement('span');
    s.className = 'aube-scene'; s.setAttribute('aria-hidden', 'true'); s.innerHTML = SCENE;
    hd.insertBefore(s, hd.firstChild);
    hd.classList.add('aube-hd');
    try { if (window.getComputedStyle(hd).position === 'static') hd.style.position = 'relative'; } catch (e) {}
    // un bandeau redessiné peu après (données qui arrivent) reprend l'animation là où elle en était (--au-off) : le lever ne rejoue pas
    var cle = (location.hash || '') + '|' + hd.className.replace(/\s*aube-\S+/g, '');
    var dep = vus[cle] ? Date.now() - vus[cle] : -1;
    if (dep >= 0 && dep < 8000) hd.style.setProperty('--au-off', dep + 'ms'); else vus[cle] = Date.now();
    suivre(hd);
    if (calme()) return;
    hd.__au = { x: 0, y: 0, tx: 0, ty: 0, s: s };
    if (hotes.indexOf(hd) < 0) hotes.push(hd);
    if (window.IntersectionObserver) {
      if (!io) io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('aube-hors', !e.isIntersecting); }); });
      io.observe(hd);
    }
  }

  /* ── lettres du titre : une seule fois par élément ── */
  function decouper(el) {
    if (el.querySelector('.aube-l')) return;
    var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!txt) return;
    var noeuds = [], i, n = 0;
    for (i = 0; i < el.childNodes.length; i++) { var c = el.childNodes[i]; if (c.nodeType === 3 && /\S/.test(c.nodeValue)) noeuds.push(c); }
    if (!noeuds.length) return;
    noeuds.forEach(function (nd) {
      var frag = doc.createDocumentFragment();
      nd.nodeValue.split(/(\s+)/).forEach(function (mot) {
        if (!mot) return;
        if (/^\s+$/.test(mot)) { frag.appendChild(doc.createTextNode(' ')); return; }
        var m = doc.createElement('span'); m.className = 'aube-mot'; m.setAttribute('aria-hidden', 'true');
        mot.split('').forEach(function (ch) {
          var l = doc.createElement('span'); l.className = 'aube-l'; l.style.setProperty('--i', Math.min(n++, 30)); l.textContent = ch; m.appendChild(l);
        });
        frag.appendChild(m);
      });
      el.replaceChild(frag, nd);
    });
    el.setAttribute('aria-label', txt);
    if (!/^H[1-6]$/.test(el.tagName)) { el.setAttribute('role', 'heading'); el.setAttribute('aria-level', '1'); }
    // les enfants non textuels (pastilles…) restent lisibles : le texte entier est déjà dans aria-label
  }

  /* ── Pilotage : le titre et sa phrase sont deux frères nus ; un conteneur leur donne un ciel ── */
  function envelopper() {
    var l = racine.querySelectorAll('.v2-wrap > .v2-page-title'), i, t, p, w;
    for (i = 0; i < l.length; i++) {
      t = l[i]; if (t.parentNode.classList.contains('aube-tete')) continue;
      try { if (window.getComputedStyle(t).display === 'none') continue; } catch (e) {}
      p = t.nextElementSibling; if (p && !p.classList.contains('v2-page-sub')) p = null;
      w = doc.createElement('div'); w.className = 'aube-tete'; t.parentNode.insertBefore(w, t); w.appendChild(t); if (p) w.appendChild(p);
    }
  }

  function balayer() {
    planifie = 0;
    if (!racine || !racine.querySelectorAll) return;
    var l, i;
    envelopper();
    l = racine.querySelectorAll(HD);
    for (i = 0; i < l.length; i++) monter(l[i]);

    if (!calme()) { l = racine.querySelectorAll(TITRES); for (i = 0; i < l.length; i++) decouper(l[i]); }
    hotes = hotes.filter(function (h) { return doc.documentElement.contains(h); });
  }
  function planifier() { if (!planifie) { planifie = 1; raf(balayer); } }

  function brancher() {
    racine = doc.getElementById('v2-root');
    if (!racine) { doc.addEventListener('DOMContentLoaded', brancher, { once: true }); return; }
    balayer();
    if (window.MutationObserver) { mo = new MutationObserver(planifier); mo.observe(racine, { childList: true, subtree: true }); }
  }

  /* ── l'astre suit le pointeur (inertie, une seule boucle, s'arrête au repos) ── */
  function tourner() {
    boucle = 0;
    var actif = false;
    hotes.forEach(function (h) {
      var a = h.__au; if (!a || h.classList.contains('aube-hors')) return;
      a.x += (a.tx - a.x) * 0.07; a.y += (a.ty - a.y) * 0.07;
      a.s.style.setProperty('--px', a.x.toFixed(3)); a.s.style.setProperty('--py', a.y.toFixed(3));
      if (Math.abs(a.tx - a.x) + Math.abs(a.ty - a.y) > 0.002) actif = true;
    });
    if (actif && !doc.hidden) boucle = raf(tourner);
  }
  function eveil() { if (!boucle && !doc.hidden) boucle = raf(tourner); }
  function vers(e) {
    if (calme() || e.pointerType === 'touch') return;
    hotes.forEach(function (h) {
      var a = h.__au; if (!a || h.classList.contains('aube-hors')) return;
      var r = h.getBoundingClientRect(); if (!r.width) return;
      a.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      a.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    });
    eveil();
  }
  function lumiereCarte(e) {
    if (e.pointerType === 'touch' || !e.target || !e.target.closest) return;
    var c = e.target.closest(CARTES); if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty('--au-mx', Math.round(e.clientX - r.left) + 'px'); c.style.setProperty('--au-my', Math.round(e.clientY - r.top) + 'px');
  }

  /* ── l'onde : à chaque clic et à chaque frappe, une fois toutes les 140 ms ── */
  function onde() {
    if (calme()) return;
    var t = Date.now(); if (t - derniere < 140) return; derniere = t;
    for (var i = 0; i < hotes.length; i++) {
      var h = hotes[i]; if (h.classList.contains('aube-hors')) continue;
      var c = h.querySelector('.aube-ciel'); if (!c) continue;
      var o = doc.createElement('i'); o.className = 'aube-onde'; c.appendChild(o);
      (function (x) { x.addEventListener('animationend', function () { if (x.parentNode) x.parentNode.removeChild(x); }); setTimeout(function () { if (x.parentNode) x.parentNode.removeChild(x); }, 1500); })(o);
      return;
    }
  }


  /* ── la recherche de l'accueil : les mêmes résultats et les mêmes gestes que le ⌘K (V2.cmdkChercher), posés sous le champ ── */
  var rech = { sel: -1, rows: [], t: 0 };
  function el(id) { return doc.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function surligner(t, q) {
    var i = String(t).toLowerCase().indexOf(q.toLowerCase());
    return i < 0 || !q ? esc(t) : esc(t.slice(0, i)) + '<mark class="aube-m">' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
  }
  function fermerRes() {
    var r = el('aube-res'), q = el('aube-q'); if (!r) return;
    r.hidden = true; r.innerHTML = ''; rech.rows = []; rech.sel = -1;
    if (q) { q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); }
  }
  function majSel(defiler) {
    var r = el('aube-res'), q = el('aube-q'); if (!r) return;
    var l = r.querySelectorAll('.aube-r'), i;
    for (i = 0; i < l.length; i++) { var on = i === rech.sel; l[i].classList.toggle('aube-sel', on); l[i].setAttribute('aria-selected', on ? 'true' : 'false'); }
    if (rech.sel >= 0 && l[rech.sel]) { q.setAttribute('aria-activedescendant', l[rech.sel].id); if (defiler) { try { l[rech.sel].scrollIntoView({ block: 'nearest' }); } catch (e) {} } } else q.removeAttribute('aria-activedescendant');
  }
  function chercher() {
    var q = el('aube-q'), r = el('aube-res'), z = el('aube-raz'); if (!q || !r) return;
    var t = q.value.trim(); z.hidden = !q.value;
    if (!t) { fermerRes(); return; }
    var rows = []; try { rows = (window.V2 && V2.cmdkChercher) ? V2.cmdkChercher(t) : []; } catch (e) { rows = []; }
    var h = '', n = 0, g = null;
    rows.forEach(function (x) {
      if (x.grp !== g) { if (g !== null) h += '</div>'; g = x.grp; h += '<div class="aube-grp" role="group" aria-label="' + esc(g) + '"><h3 class="aube-gt">' + esc(g) + '</h3>'; }
      h += '<div class="aube-r" role="option" id="aube-o' + n + '" data-i="' + n + '" aria-selected="false"><span class="aube-ic">' + x.ico + '</span><span class="aube-tx"><b>' + surligner(x.label, t) + '</b>' + (x.meta ? '<small>' + esc(x.meta) + '</small>' : '') + '</span></div>';
      n++;
    });
    if (g !== null) h += '</div>';
    if (!n) h = '<p class="aube-aucun">Aucun résultat pour « ' + esc(t) + ' ».</p>';
    r.innerHTML = h; r.hidden = false; q.setAttribute('aria-expanded', 'true');
    rech.rows = rows; rech.sel = rows.length ? 0 : -1; majSel(false);
    var cr = el('aube-champ').getBoundingClientRect(), bas = window.innerHeight - (window.innerWidth <= 600 ? 76 : 12);
    r.style.maxHeight = Math.max(140, Math.min(440, Math.floor(bas - cr.bottom - 12))) + 'px';
  }
  function lancer(i) { var x = rech.rows[i]; if (!x) return; fermerRes(); var q = el('aube-q'); if (q) { q.value = ''; q.blur(); } var z = el('aube-raz'); if (z) z.hidden = true; try { x.action(); } catch (e) {} }
  function brancherRech() {
    doc.addEventListener('input', function (e) { if (!e.target || e.target.id !== 'aube-q') return; clearTimeout(rech.t); rech.t = setTimeout(chercher, 80); }, false);
    doc.addEventListener('focusin', function (e) {
      if (!e.target || e.target.id !== 'aube-q') return;
      var h = el('aube-acc'); if (h) h.classList.add('aube-foc');
      try { if (window.V2 && V2.cmdkPreparer) V2.cmdkPreparer(chercher); } catch (x) {}
    });
    doc.addEventListener('focusout', function (e) { if (!e.target || e.target.id !== 'aube-q') return; var h = el('aube-acc'); if (h) h.classList.remove('aube-foc'); });
    doc.addEventListener('keydown', function (e) {
      var q = el('aube-q'), n = rech.rows.length;
      if (e.target && e.target.id === 'aube-q') {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (n) { rech.sel = (rech.sel + 1) % n; majSel(true); } }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) { rech.sel = (rech.sel - 1 + n) % n; majSel(true); } }
        else if (e.key === 'Enter') { if (n) { e.preventDefault(); lancer(Math.max(0, rech.sel)); } }
        else if (e.key === 'Escape') { if (q.value) { e.preventDefault(); e.stopPropagation(); q.value = ''; chercher(); } else q.blur(); }
        return;
      }
      // écrire n'importe où sur l'accueil écrit dans la recherche
      if (!q || e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1 || e.key === ' ') return;
      var a = doc.activeElement, tag = a && a.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (a && a.isContentEditable)) return;
      if (doc.querySelector('.u2-volet.on,.u2-feuille.on,#v2-cmdk.open')) return;
      q.focus();
    });
    doc.addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.closest) return;
      var z = t.closest('#aube-raz'); if (z) { var q = el('aube-q'); q.value = ''; chercher(); q.focus(); return; }
      var r = t.closest('.aube-r'); if (r) lancer(+r.getAttribute('data-i'));
    });
    doc.addEventListener('mousedown', function (e) { if (e.target && e.target.closest && e.target.closest('#aube-res')) e.preventDefault(); });
    doc.addEventListener('pointermove', function (e) { var r = e.target && e.target.closest && e.target.closest('.aube-r'); if (!r) return; var i = +r.getAttribute('data-i'); if (i !== rech.sel) { rech.sel = i; majSel(false); } }, { passive: true });
  }

  brancher();
  brancherRech();
  window.addEventListener('pointermove', vers, { passive: true });
  doc.addEventListener('pointermove', lumiereCarte, { passive: true });
  window.addEventListener('pointerdown', onde, { passive: true, capture: true });
  window.addEventListener('keydown', function (e) { if (e.key && e.key.length === 1) onde(); }, { passive: true, capture: true });
  doc.addEventListener('input', onde, { passive: true, capture: true });
  window.addEventListener('hashchange', function () { vus = {}; });
  doc.addEventListener('visibilitychange', function () { doc.documentElement.classList.toggle('aube-cache', !!doc.hidden); if (!doc.hidden) eveil(); });
  window.__AUBE = 1;
})();

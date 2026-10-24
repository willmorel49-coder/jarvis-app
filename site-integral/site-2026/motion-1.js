/* ═══════════════════════════════════════════════════════════════════════════════
   MOTION 1 · « LE SOIN » — le mouvement de la page, porté au niveau studio.
   Chargé APRÈS commun.js (même ordre « defer »). Vanilla, aucune librairie.
   Ce que fait ce fichier :
     · remplace la révélation de commun.js (qui montre TOUT au bout de 4 s, même hors
       écran) par une révélation lue sur la POSITION réelle au défilement ;
     · découpe les titres en lignes sous masque ; cascade courte des paragraphes/cartes ;
     · ouvre les photos (rideau) ; fait monter les chiffres avec décélération.
   Sûreté : rien n'est masqué tant que ce script n'a pas fini son installation (classe
   « m » posée en dernier) ; un contrôle de secours remet la page à nu si rien ne se
   révèle ; mouvement réduit = ce script ne fait rien.
   Expose window.MOTION (utilisé par motion-2.js et motion-3.js).
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var R = document.documentElement;
  var doux = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doux || !R.classList.contains("js")) return;

  var M = window.MOTION = { frames: [], valeur: null, version: 1, enCours: 0 };
  var vh = function(){ return window.innerHeight || 800; };
  var clamp = function(x, a, b){ return Math.min(b, Math.max(a, x)); };

  /* ── une seule boucle de défilement, partagée par les trois doses ────────── */
  var enVol = false;
  M.frame = function(fn){ M.frames.push(fn); };
  function boucle(){
    enVol = false;
    for (var k = 0; k < M.frames.length; k++){ try { M.frames[k](); } catch(e){} }
  }
  M.demander = function(){ if (!enVol){ enVol = true; requestAnimationFrame(boucle); } };

  /* ── les chiffres : écrire la valeur d'un compteur à la progression p (0..1) ── */
  var orig = new WeakMap();
  function fmt(v, brut){ return brut ? String(v) : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  M.valeur = function(el, p){
    var o = orig.get(el); if (!o) return;
    var n = el.childNodes[0];
    if (p >= 1){ n.nodeValue = o.texte; return; }
    var e = 1 - Math.pow(1 - clamp(p, 0, 1), 4);            /* décélération nette (quartique) */
    n.nodeValue = fmt(Math.round(o.depart + (o.cible - o.depart) * e), o.brut);
  };
  function preparerChiffre(b){
    /* l'ancien compteur de la page est branché sur CET élément : on le remplace par un clone neutre */
    var c = b.cloneNode(true);
    var cible = parseInt(b.getAttribute("data-cible"), 10);
    c.removeAttribute("data-cible");
    c.setAttribute("data-m-cible", String(cible));
    var n = c.childNodes[0];
    orig.set(c, { texte: n && n.nodeType === 3 ? n.nodeValue : c.textContent, cible: cible,
      depart: b.getAttribute("data-depart") ? parseInt(b.getAttribute("data-depart"), 10) : 0,
      brut: b.hasAttribute("data-brut") });
    b.parentNode.replaceChild(c, b);
    return c;
  }
  function monter(el, retard){
    if (el.closest("[data-m-tenu]")) return;                 /* tenu à l'écran par la dose 3 */
    var t0 = null, duree = 2000;
    function pas(t){
      if (t0 === null) t0 = t + retard;
      if (t < t0){ requestAnimationFrame(pas); return; }
      var p = Math.min(1, (t - t0) / duree);
      M.valeur(el, p);
      if (p < 1) requestAnimationFrame(pas);
    }
    M.valeur(el, 0);
    requestAnimationFrame(pas);
  }

  /* ── titres : au moment de jouer, le texte est rangé ligne par ligne sous un masque ;
        à la fin, le texte d'origine est remis tel quel (aucune trace dans la mise en page) ── */
  function noeudUnique(h){
    var wk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT, null), n, trouves = [];
    while ((n = wk.nextNode())) if (n.nodeValue.trim()) trouves.push(n);
    return trouves.length === 1 ? trouves[0] : null;
  }
  function lignes(t){
    /* les mots (séparés par un blanc ordinaire, jamais par un insécable) groupés par ligne, lus sur le rendu */
    var re = /\S+/g, m, mots = [], v = t.nodeValue;
    while ((m = re.exec(v))){
      mots.push({ d: m.index, f: m.index + m[0].length });
    }
    var rangs = [], dernier = null, cur = null;
    mots.forEach(function(w){
      var g = document.createRange(); g.setStart(t, w.d); g.setEnd(t, w.f);
      var y = Math.round(g.getBoundingClientRect().top);
      if (dernier === null || Math.abs(y - dernier) > 6){ cur = { d: w.d, f: w.f }; rangs.push(cur); dernier = y; } else { cur.f = w.f; }
    });
    return rangs.map(function(l){ return v.slice(l.d, l.f); });
  }
  function ranger(h, base){
    var t = noeudUnique(h); if (!t) return;
    var ls = lignes(t); if (!ls.length) return;
    var frag = document.createDocumentFragment();
    ls.forEach(function(txt, k){
      var l = document.createElement("span"); l.className = "m-l";
      var i = document.createElement("span"); i.className = "m-li"; i.textContent = txt;
      i.style.setProperty("--m-d", (base + k * 140) + "ms");
      l.appendChild(i); frag.appendChild(l);
    });
    h.__m = { noeud: t, parent: t.parentNode };
    t.parentNode.replaceChild(frag, t);
    void h.offsetWidth;                                     /* l'état « sous le masque » est peint avant de jouer */
  }
  function remettre(h){
    var o = h.__m; if (!o) return;
    var ls = h.querySelectorAll(".m-l");
    if (ls.length){ o.parent.insertBefore(o.noeud, ls[0]); [].forEach.call(ls, function(l){ l.parentNode.removeChild(l); }); }
    h.__m = null;
  }
  /* les titres déjà découpés mot à mot par commun.js : retards par ligne */
  function retarder(h, base){
    var top0 = null, ligne = -1, j = 0, dernier = null;
    [].slice.call(h.querySelectorAll(".mot")).forEach(function(w){
      var y = Math.round(w.getBoundingClientRect().top);
      if (dernier === null || Math.abs(y - dernier) > 6){ ligne++; j = 0; dernier = y; } else { j++; }
      w.firstChild.style.setProperty("--d", (base + ligne * 130 + j * 36) + "ms");
    });
  }

  /* ── installation ─────────────────────────────────────────────────────────── */
  var unites = [];
  function installer(){
    var rv = [].slice.call(document.querySelectorAll("main .rv"));
    var bandes = [].slice.call(document.querySelectorAll("main .bande"));

    /* les chiffres : clones neutres (le compteur d'origine ne les touche plus) */
    [].slice.call(document.querySelectorAll("main b[data-cible]")).forEach(preparerChiffre);

    rv.forEach(function(u){
      var info = { el: u, base: Math.min(parseInt(u.style.getPropertyValue("--i") || "0", 10) || 0, 4) * 80,
                   titres: [], subs: [], fait: false };
      var estTitre = /^H[1-6]$/.test(u.tagName);
      var cellule = u.matches(".carte,.valeur,.met,.depot,.label,.carte-boite");
      /* les titres du bloc (ou le bloc lui-même) : jamais ceux d'une carte */
      var hs = estTitre ? [u] : (cellule ? [] : [].slice.call(u.querySelectorAll("h1,h2")));
      hs.forEach(function(h){
        if (!h.querySelector(".mot") && !noeudUnique(h)) return;           /* structure inattendue : bloc entier */
        h.classList.add("m-titre"); info.titres.push(h);
      });
      /* la cascade des enfants */
      if (!cellule && !estTitre){
        var enf = [].slice.call(u.children);
        if (enf.length === 1 && enf[0].children.length >= 3) enf = [].slice.call(enf[0].children);
        var sans = enf.filter(function(c){ return !/^H[1-6]$/.test(c.tagName); });
        if (sans.length >= 2 || (hs.length && sans.length)){
          info.subs = sans;
        }
      }
      if (info.subs.length || info.titres.length) u.classList.add("m-grp");
      info.subs.forEach(function(c, k){
        c.classList.add("m-sub");
        c.style.setProperty("--m-d", (info.base + 160 + k * 110) + "ms");
      });
      info.chiffres = [].slice.call(u.querySelectorAll("[data-m-cible]"));
      unites.push(info);
    });
    /* les cellules photo : le rideau remplace le fondu */
    [].slice.call(document.querySelectorAll("main .depot")).forEach(function(d){ d.classList.add("m-ouvre"); });
    bandes.forEach(function(b){ b.classList.add("m-ouvre"); unites.push({ el: b, base: 0, titres: [], subs: [], chiffres: [], fait: false }); });
  }

  function jouer(info, instant){
    if (info.fait) return;
    info.fait = true; M.enCours++;
    var u = info.el;
    if (!instant) info.titres.forEach(function(h){ if (h.querySelector(".mot")) retarder(h, info.base + 120); else ranger(h, info.base + 120); });
    if (instant) u.classList.add("m-vite");
    u.classList.add("m-in");
    var duree = info.base + 160 + info.subs.length * 110 + 2300;
    if (!instant){
      info.chiffres.forEach(function(c, k){ monter(c, info.base + 450 + k * 120); });
    } else {
      info.chiffres.forEach(function(c){ M.valeur(c, 1); });
    }
    setTimeout(function(){
      M.enCours--; u.classList.add("m-fin");
      info.titres.forEach(remettre);
      info.subs.forEach(function(c){ c.classList.remove("m-sub"); c.style.removeProperty("--m-d"); });
    }, instant ? 60 : duree);
  }

  function verifier(){
    var h = vh();
    for (var k = 0; k < unites.length; k++){
      var info = unites[k]; if (info.fait) continue;
      var r = info.el.getBoundingClientRect();
      if (r.bottom <= 0) jouer(info, true);                 /* déjà dépassé (saut d'ancre) : état final direct */
      else if (r.top < h * 0.9) jouer(info, false);
    }
  }

  try {
    installer();
    M.frame(verifier);
    window.addEventListener("scroll", M.demander, { passive: true });
    window.addEventListener("resize", M.demander);
    window.addEventListener("load", function(){ M.demander(); setTimeout(M.demander, 300); });
    R.classList.add("m");
    verifier();
    /* filets : si le défilement n'a rien déclenché alors que des blocs sont à l'écran, on les montre */
    setTimeout(verifier, 1500);
    setTimeout(function(){ verifier(); }, 4500);
    setTimeout(function(){
      /* dernier recours : un bloc à l'écran encore masqué => la page redevient celle de commun.js */
      var h = vh(), bloque = unites.some(function(i){
        if (i.fait) return false; var r = i.el.getBoundingClientRect(); return r.top < h * 0.6 && r.bottom > 0;
      });
      if (bloque) R.classList.remove("m");
    }, 7000);
  } catch(e){
    R.classList.remove("m");
  }
})();

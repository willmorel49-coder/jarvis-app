/* PHIRST · la page publique « La lettre » (24/11/2026) — lecture de la base, montage du HTML, gestes. Tout le calcul est dans lettre-pur.js.
   Le jeton est dans le # de l'adresse (jamais envoyé à un serveur). Deux appels possibles, pas un de plus : phirst_lettre et phirst_lettre_demande.
   Aucune lecture de table : le public n'a aucun droit dessus. */
(function () {
  'use strict';
  var URL_BASE = 'https://xqdyzmzsaizenacttapf.supabase.co';
  var CLE_PUBLIQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZHl6bXpzYWl6ZW5hY3R0YXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDcwNzcsImV4cCI6MjA5OTE4MzA3N30.gubLlLhSsf6w7fHlovfCSxkwBp_W4ass30M66Ahn8xY';   // clé publique (rôle anon) : les droits sont tenus par la base
  var DELAI_LECTURE = 10000, DELAI_ENVOI = 15000;
  var P = window.PHIRST_LETTRE_PUR, page = document.getElementById('page');
  var calme = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var client = null, jeton = '', modele = null, dernier = null, motif = '', F = null;
  document.documentElement.classList.add('js');

  function montrer(html, titre) { page.innerHTML = html; if (titre) document.title = titre; }
  function etat(quoi, marque, titre) { montrer(P.etatHtml(quoi, marque), titre); }

  /* ── démarrage ── */
  function demarrer() {
    if (!P || !window.PHIRST_LETTRE || !window.PHIRST_DOSSIERS_PUR) return etat('muet', null);
    etat('chargement', null);
    jeton = P.jetonDe(location.hash);
    try {
      /* persistSession / detectSessionInUrl à false : sinon la bibliothèque lit le # comme une connexion */
      client = window.supabase.createClient(URL_BASE, CLE_PUBLIQUE, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    } catch (e) { return etat('muet', null); }
    P.lire(function () { return client.rpc('phirst_lettre', { p_jeton: jeton || null }); }, DELAI_LECTURE).then(function (res) {
      var d = P.decider(jeton, res);
      if (d.etat === 'lien') return etat('lien', d.marque, 'Lien non valable');
      if (d.etat === 'muet') return etat('muet', null);
      try { monter(P.modele(d.reponse)); } catch (e) { etat('muet', null); }
    });
  }

  function monter(m) {
    modele = m;
    montrer(P.pageHtml(m), m.titre);
    gestes();
    panneau();
  }

  /* ── les gestes ── */
  function gestes() {
    init3d(); initAA();
    /* le sommaire ne change pas l'adresse : le jeton est dans le # et doit y rester */
    page.addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-vers]'); if (!a) return;
      ev.preventDefault();
      var s = document.getElementById(a.getAttribute('data-vers')); if (!s) return;
      s.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'start' });
      try { s.focus({ preventScroll: true }); } catch (e) {}
    });
    var pd = document.getElementById('plan-d'), idees = document.querySelector('.idees');
    function allume(z) { [].forEach.call(pd.querySelectorAll('[data-z]'), function (r) { r.classList.toggle('on', r.getAttribute('data-z') === z); }); }
    if (pd && idees) {
      idees.addEventListener('click', function (ev) { var b = ev.target.closest('[data-z]'); if (!b) return; allume(b.getAttribute('data-z'));
        [].forEach.call(idees.querySelectorAll('[data-z]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
      idees.addEventListener('mouseover', function (ev) { var b = ev.target.closest('[data-z]'); if (b) allume(b.getAttribute('data-z')); });
    }
    document.querySelector('.onglets').addEventListener('click', function (ev) { var b = ev.target.closest('[data-real]'); if (!b) return;
      [].forEach.call(document.querySelectorAll('[data-real]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var aa = document.getElementById('aa'); aa.innerHTML = P.htmlAA(+b.getAttribute('data-real')); initAA(aa); });
    /* la lumière suit un peu le pointeur */
    var lum = document.querySelector('.couv-lum');
    if (!calme && lum) document.querySelector('.couv').addEventListener('pointermove', function (ev) { lum.style.setProperty('--lx', ((ev.clientX / innerWidth) - .5) * 60 + 'px'); });
    /* apparitions : jamais d'opacité ; décidées sur la position réelle, relue toutes les 0,7 s même sans défilement */
    if (!calme) {
      var rs = [].slice.call(document.querySelectorAll('.r'));
      rs.forEach(function (x) { if (x.getBoundingClientRect().top > innerHeight * .92) x.classList.add('attend'); });
      var voir = function () { rs.forEach(function (x) { if (x.classList.contains('attend') && x.getBoundingClientRect().top < innerHeight * .9) x.classList.remove('attend'); }); };
      addEventListener('scroll', voir, { passive: true }); addEventListener('resize', voir); voir(); setInterval(voir, 700);
    }
  }

  /* l'officine 3D : 11 vues × 4 finitions */
  function init3d() {
    [].forEach.call(document.querySelectorAll('[data-v3d]'), function (el) {
      var img = el.querySelector('img'), sc = el.querySelector('.v3d-scene'), i = 5, fin = 'chene', x0 = null, i0 = 0, N = 11;
      function nom() { for (var k = 0; k < P.FINS.length; k++) if (P.FINS[k][0] === fin) return P.FINS[k][1]; }
      function aller(k) { k = Math.max(0, Math.min(N - 1, k)); if (k === i && img.src.indexOf(fin + '-') > 0) return; i = k; img.src = P.vue(fin, i); img.alt = 'Officine en 3D, finition ' + nom() + ', vue ' + (i + 1) + ' sur 11';
        el.querySelector('.g').disabled = i === 0; el.querySelector('.d').disabled = i === N - 1; }
      function pre(f) { for (var k = 0; k < N; k++) { var p = new Image(); p.src = P.vue(f, k); } }
      pre(fin);
      el.querySelector('.g').addEventListener('click', function () { aller(i - 1); });
      el.querySelector('.d').addEventListener('click', function () { aller(i + 1); });
      sc.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; x0 = e.clientX; i0 = i; sc.classList.add('glisse'); try { sc.setPointerCapture(e.pointerId); } catch (_) {} });
      sc.addEventListener('pointermove', function (e) { if (x0 === null) return; aller(i0 + Math.round((e.clientX - x0) / 42)); });
      function lacher() { x0 = null; sc.classList.remove('glisse'); }
      sc.addEventListener('pointerup', lacher); sc.addEventListener('pointercancel', lacher);
      el.addEventListener('keydown', function (e) { if (e.target !== el) return; if (e.key === 'ArrowLeft') { aller(i - 1); e.preventDefault(); } if (e.key === 'ArrowRight') { aller(i + 1); e.preventDefault(); } });
      el.querySelector('.v3d-fins').addEventListener('click', function (e) {
        var b = e.target.closest('[data-fin]'); if (!b) return; fin = b.getAttribute('data-fin'); pre(fin);
        [].forEach.call(el.querySelectorAll('[data-fin]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        img.src = P.vue(fin, i); img.alt = 'Officine en 3D, finition ' + nom() + ', vue ' + (i + 1) + ' sur 11';
      });
      aller(5);
    });
  }
  /* avant / après : souris, doigt, clavier (un vrai curseur de formulaire) */
  function initAA(root) {
    [].forEach.call((root || document).querySelectorAll('[data-aa]'), function (el) {
      var inp = el.querySelector('input'), glisse = false;
      function poser(v) { v = Math.max(0, Math.min(100, v)); el.style.setProperty('--p', v + '%'); inp.value = Math.round(v); }
      inp.addEventListener('input', function () { poser(+inp.value); });
      function depuis(e) { var r = el.getBoundingClientRect(); poser((e.clientX - r.left) / r.width * 100); }
      el.addEventListener('pointerdown', function (e) { glisse = true; el.classList.add('glisse'); depuis(e); try { el.setPointerCapture(e.pointerId); } catch (_) {} });
      el.addEventListener('pointermove', function (e) { if (glisse) depuis(e); });
      function fin() { glisse = false; el.classList.remove('glisse'); }
      el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
    });
  }

  /* ── le panneau ── */
  function panneau() {
    F = document.createElement('dialog'); F.className = 'pf'; F.setAttribute('aria-labelledby', 'pf-titre'); document.body.appendChild(F);
    F.addEventListener('close', function () { if (dernier) { var d = dernier; setTimeout(function () { d.focus(); }, 0); } });
    F.addEventListener('click', function (e) {
      if (e.target === F || e.target.closest('[data-fermer]')) return F.close();
      var s = e.target.closest('[data-motif]'); if (s) { motif = s.getAttribute('data-motif'); [].forEach.call(F.querySelectorAll('[data-motif]'), function (x) { x.setAttribute('aria-pressed', x === s ? 'true' : 'false'); }); }
    });
    F.addEventListener('submit', envoyer);
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-projet]'); if (b) { e.preventDefault(); ouvrir(b); } });
  }
  function ouvrir(depuis) {
    dernier = depuis;
    var mo = modele.suite.motifs;
    motif = depuis && depuis.getAttribute('data-projet') === 'autre' ? mo[1] : mo[0];
    F.innerHTML = P.typoHtml(P.panneauHtml(modele, motif));
    F.showModal(); var t = F.querySelector('#pf-titre'); t.focus(); requestAnimationFrame(function () { t.focus(); });
  }
  function statut(texte) {
    var s = F.querySelector('#pf-statut'); s.textContent = P.typoTexte(texte); s.hidden = false; s.focus();
  }
  function envoyer(e) {
    e.preventDefault();
    var tel = F.querySelector('#pf-tel'), btn = F.querySelector('#pf-envoyer'), box = tel.closest('.pf-champ'), err = box.querySelector('.err'), st = F.querySelector('#pf-statut');
    if (btn.disabled) return;
    st.hidden = true; st.textContent = '';
    function erreurTel() {
      tel.setAttribute('aria-invalid', 'true');
      if (!err) { err = document.createElement('p'); err.className = 'err'; err.id = 'pf-tel-err'; box.appendChild(err); tel.setAttribute('aria-describedby', 'pf-tel-aide pf-tel-err'); }
      err.textContent = P.typoTexte(P.messageDemande('tel', modele.marque)); tel.focus();
    }
    tel.removeAttribute('aria-invalid'); if (err) { err.remove(); err = null; tel.setAttribute('aria-describedby', 'pf-tel-aide'); }
    var num = tel.value.trim();
    if (!P.telValide(num)) return erreurTel();
    var nom = F.querySelector('#pf-nom').value, mot = F.querySelector('#pf-mot').value, libelle = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Envoi…';
    P.lire(function () { return client.rpc('phirst_lettre_demande', { p_jeton: jeton, p_motif: motif, p_nom: nom, p_tel: num, p_mot: mot }); }, DELAI_ENVOI).then(function (res) {
      var r = P.classerDemande(res);
      if (r.ok) {
        F.querySelector('form').innerHTML = P.typoHtml(P.merciHtml(modele, motif, num));
        return F.querySelector('#pf-merci').focus();
      }
      btn.disabled = false; btn.innerHTML = libelle;   /* les champs gardent leur contenu */
      if (r.raison === 'tel') return erreurTel();
      statut(P.messageDemande(r.raison, modele.marque));
    });
  }

  demarrer();
})();

/* PHIRST · accueil « La course du soleil » (n° 6, choisie par Will le 20/11/2026), posé sous l'aube du socle JARVIS.
   Les quatre moments d'une affaire sont les heures du jour (Trouver le matin, Encaisser le soir) ; l'astre de l'aube
   glisse au-dessus du moment choisi. Téléphone (≤ 1000 px) : maquette A « le rail » (choix de Will, 20/11/2026), tout
   entière dans phirst-ligne.css.
   Données : window.PHIRST_LIGNE = [{ cle, mot, pharmacies: [{ nom, ville, etiquette: { t, ton } }], total, autres,
   chose: { titre, heure, detail, bouton }, vide: { texte, bouton } }] — chaque moment qui peut être vide porte « vide ».
   Elles viennent de la base Phirst, JAMAIS d'un fichier du dépôt. Sans données, rien ne s'affiche : l'accueil sobre
   reste tel quel. Un moment vide dit quoi faire pour se remplir, jamais « 0 » ni « rien de prévu » (Will, 20/11/2026). */
(function () {
  'use strict';
  var D = window.PHIRST_LIGNE;
  if (!Array.isArray(D) || !D.length) return;
  var R = document.documentElement, cle = D[0].cle;
  /* crochets de la galerie du 20/11/2026, gardés tels quels : la feuille reste celle qui a été prouvée */
  R.setAttribute('data-ligne', '6'); R.setAttribute('data-donnees', 'reelles'); R.setAttribute('data-tel', 'a');
  /* nombre de pharmacies d'un moment : « total » quand la liste n'en montre qu'une partie (veille), sinon la liste */
  function nb(s) { return s.total != null ? s.total : s.pharmacies.length; }
  function avenir(s) { return nb(s) === 0 && !!s.vide; }
  /* pastille : l'initiale du nom parlant (« Pharmacie des Tilleuls » → T), sur un disque vert, sans appel réseau */
  var MOTS_VIDES = /^(pharmacie|pharmacies|phie|grande|nouvelle|de|du|des|la|le|les|l|d|et|en)$/i;
  function initiale(nom) {
    var m = String(nom || '').split(/[\s'’-]+/).filter(function (w) { return w && !MOTS_VIDES.test(w); })[0] || String(nom || '?');
    return m.charAt(0).toUpperCase();
  }
  var FL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pastille(p, n) { return '<span class="lg-ini" aria-hidden="true" style="width:' + n + 'px;height:' + n + 'px">' + esc(initiale(p.nom)) + '</span>'; }
  function station(s) {
    var n = nb(s), av = avenir(s);
    return '<li><button type="button" class="lg-st" data-k="' + esc(s.cle) + '" aria-pressed="' + (s.cle === cle) + '" aria-label="' + esc(s.mot) + ' : ' + (av ? 'à venir' : n + ' pharmacie' + (n > 1 ? 's' : '')) + '">' +
      '<span class="lg-n' + (av ? ' lg-avenir' : '') + '">' + (av ? 'à venir' : n) + '</span><span class="lg-m">' + esc(s.mot) + '</span></button></li>';
  }
  function lignes(liste) {
    return liste.map(function (p) { return '<li>' + pastille(p, 48) + '<span><b>' + esc(p.nom) + '</b><small>' + esc(p.ville) + '</small><em class="lg-et"' + (p.etiquette.ton ? ' data-ton="' + esc(p.etiquette.ton) + '"' : '') + '>' + esc(p.etiquette.t) + '</em></span></li>'; }).join('');
  }
  function panneau() {
    var s = D.filter(function (x) { return x.cle === cle; })[0]; if (!s) return '';
    var c = s.chose, n = nb(s), h = '<div class="lg-pan" aria-live="polite"><div class="lg-une">';
    if (!c && avenir(s)) /* moment vide : ce qu'il faut faire pour qu'il se remplisse, et le bouton pour le faire */
      return h + '<p class="lg-sur"><i></i>' + esc(s.mot) + ' · à venir</p><p class="lg-consigne">' + esc(s.vide.texte) + '</p>' +
        '<button type="button" class="lg-gros">' + esc(s.vide.bouton) + FL + '</button></div></div>';
    h += '<p class="lg-sur"><i></i>' + (c ? 'La chose n° 1 · ' : '') + esc(s.mot) + '</p>';
    if (c) h += '<p class="lg-titre">' + esc(c.titre) + '</p><p class="lg-det">' + esc(c.heure) + (c.detail ? ' · ' + esc(c.detail) : '') + '</p><button type="button" class="lg-gros">' + esc(c.bouton) + FL + '</button>';
    h += '</div><div class="lg-liste"><p class="lg-lt">' + n + ' pharmacie' + (n > 1 ? 's' : '') + ' à ce moment</p><ul>' + lignes(s.pharmacies);
    return h + '</ul>' + (s.autres ? '<button type="button" class="lg-autres">' + esc(s.autres) + FL + '</button>' : '') + '</div></div>';
  }
  /* l'astre (et son halo, ses anneaux, son reflet) glisse au-dessus du moment choisi */
  function soleil() {
    var a = document.getElementById('aube-acc'), c = document.getElementById('aube-champ'), b = document.querySelector('#lg-ligne [aria-pressed="true"]');
    if (!a || !c || !b) return;
    var cr = c.getBoundingClientRect(), br = b.getBoundingClientRect();
    a.style.setProperty('--lg-dx', Math.round(br.left + br.width / 2 - (cr.left + cr.width / 2)) + 'px');
  }
  function dessiner(el) {
    el.innerHTML = '<ol class="lg-rail" aria-label="Les quatre moments">' + D.map(station).join('') + '</ol>' + panneau();
    soleil();
  }
  function monter() {
    var champ = document.getElementById('aube-champ');
    if (!champ || !document.getElementById('aube-acc') || document.getElementById('lg-ligne')) return;
    var el = document.createElement('section'); el.id = 'lg-ligne'; el.className = 'lg lg-v6'; el.setAttribute('aria-label', 'Vos pharmacies en route');
    champ.parentNode.insertBefore(el, champ.nextSibling);
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-k]'); if (!b) return;
      cle = b.getAttribute('data-k'); dessiner(el);
    });
    dessiner(el);
    setTimeout(soleil, 400); setTimeout(soleil, 1500);
  }
  window.addEventListener('resize', soleil);
  new MutationObserver(monter).observe(document.documentElement, { childList: true, subtree: true });
  monter();
})();

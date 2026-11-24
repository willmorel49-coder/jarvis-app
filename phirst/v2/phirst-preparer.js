/* PHIRST · « La veille du rendez-vous » (idée 6, 24/11/2026) : la page qui réunit, pour un rendez-vous confirmé, tout ce qu'il faut savoir sur la pharmacie.
   Ouverte depuis l'Agenda de Yann (phirst-agenda.js : bouton « Préparer · page prête » et bandeau « Demain »), en panneau à droite, ou en page propre.
   Tout ce qui s'y lit vient de la base (fiche, journal des appels, rendez-vous, annuaire, dossier) ; une rubrique sans donnée n'apparaît pas.
   Une lecture qui échoue retire sa rubrique, elle ne bloque pas la page. Écriture : AUCUNE (les cases « À apporter » se gardent dans cet ordinateur).
   Logique pure et testée : phirst-preparer-pur.js (tests/phirst-l3-preparer.test.mjs). Jamais réservée à la téléprospectrice : elle ne voit rien de neuf. */
(function () {
  'use strict';
  var P = window.PHIRST_PUR, R = window.PHIRST_PREPARER_PUR, D = window.PHIRST_DOSSIERS_PUR, V2 = window.V2;
  if (!P || !R || !D || !V2) return;
  var COLS_OFF = 'cle,angle,nom,nom_affiche,ville,cp,dep,lat,lon,pharmacien,telephone,email,groupements,sous,etiquettes,pourquoi,sieges,annonce,score,fab,cat,robot_modele,robot_date,tt_type,tt_date,n_ehpad,ehpad_proches,f_cession,f_pmr,f_sans_robot,dans_secteur,cles';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }
  var OK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  var S = { rdv: null, fiche: null, ctx: null, jeton: 0, propre: false, dernier: null, d: null, cases: [] };

  /* ── lecture : chaque morceau arrive seul, un échec = sa rubrique absente ── */
  function lire(rdv, fiche, ctx) {
    var base = sb(), tok = ++S.jeton, d = S.d = { fiche: null, lignes: null, equipe: {}, off: null, integ: null, ph: null, autres: null };
    if (!base) return;
    function quand(p, f) { Promise.resolve(p).then(function (x) { if (tok === S.jeton) { f(x); rendre(); } }, function () {}).then(null, function () {}); }
    quand(base.from('crm_prospects').select('id,nom,ville,cp,pharmacien,telephone,email,source,robot_marque,dossier_id').eq('id', fiche.id).maybeSingle(), function (r) { if (r && !r.error && r.data) d.fiche = r.data; });
    quand(base.from('crm_activities').select('author_id,type,body,created_at').eq('prospect_id', fiche.id).order('created_at', { ascending: false }).limit(100), function (r) { if (r && !r.error) d.lignes = r.data || []; });
    quand(window.PHIRST_EQUIPE ? window.PHIRST_EQUIPE.lire() : {}, function (e) { d.equipe = e || {}; });
    quand(base.from('phirst_officines').select(COLS_OFF).overlaps('cles', [P.cle(fiche.nom, fiche.ville)]).range(0, 9).then(function (r) {
      if (!r || r.error || !(r.data || []).length) return null;
      var f = P.ficheDeLignes(r.data);
      return Promise.resolve(base.from('phirst_integral').select('cle,commercial,tel,mail').in('cle', f.lignes)).then(function (x) { return { f: f, integ: x && !x.error ? P.blocIntegral(x.data) : null }; }, function () { return { f: f, integ: null }; });
    }), function (o) { if (o) { d.off = o.f; d.integ = o.integ; } });
    quand(lireDossiers(base, ctx && ctx.ws, fiche), function (o) { if (o) { d.ph = o.ph; d.autres = o.autres; } });
  }
  function pages(fab) {
    var tout = [];
    function page(n) { return fab().range(n * 1000, n * 1000 + 999).then(function (r) { if (r.error) throw new Error('lecture'); tout = tout.concat(r.data || []); return (r.data || []).length === 1000 && n < 4 ? page(n + 1) : tout; }); }
    return page(0);
  }
  /* Les dossiers de Yann : le sien (s'il existe) et les pharmacies où un volet est terminé, pour les voisines. */
  function lireDossiers(base, ws, fiche) {
    if (!ws) return Promise.resolve(null);
    return Promise.all([
      pages(function () { return base.from('crm_prospects').select('id,nom,ville,lat,lon,dossier_id').eq('workspace_id', ws).not('dossier_id', 'is', null).order('id'); }),
      pages(function () { return base.from('dossiers').select('id,user_id,nom,ville,titulaire,statut,created_at').order('id'); }),
      pages(function () { return base.from('dossier_volets').select('*').order('id'); }),
      pages(function () { return base.from('dossier_etapes').select('*').order('id'); })
    ]).then(function (x) {
      var phs = D.pharmacies(x[1], x[2], x[3]), parDossier = {};
      phs.forEach(function (ph) { parDossier[ph.dossier.id] = ph; });
      var propre = null, autres = [];
      x[0].forEach(function (p) {
        var ph = parDossier[p.dossier_id]; if (!ph) return;
        if (p.id === fiche.id) { propre = ph; return; }
        autres.push({ id: p.id, nom: p.nom, ville: p.ville, lat: p.lat, lon: p.lon, termines: ph.volets.filter(D.estTermine).map(function (v) { return v.nom; }) });
      });
      return { ph: propre, autres: autres };
    });
  }

  /* ── affichage ── */
  function dl(l) {
    return '<dl class="pv-dl">' + l.map(function (x) {
      var v = x.tel ? '<a class="pa-tel" href="tel:' + esc(String(x.v).replace(/[^\d+]/g, '')) + '">' + esc(x.v) + '</a>' : esc(x.v);
      return '<div><dt>' + esc(x.e) + '</dt><dd>' + v + '</dd></div>';
    }).join('') + '</dl>';
  }
  function sectionTel(rdv, d) {
    var auj = P.aujourdhui(), h = '<section class="pv-c pv-tel"><h3>Ce qu’a noté la téléprospectrice</h3>', l = [];
    var rep = R.questionsLignes(rdv), projet = R.projetDit(rdv.objet);
    if (projet) l.push({ e: 'Projet', v: projet });
    rep.forEach(function (x) { var k = x.indexOf(' : '); l.push(k > 0 ? { e: x.slice(0, k), v: x.slice(k + 3) } : { e: '', v: x }); });
    if (projet && rep.some(function (x) { return /^Projet : /.test(x); })) l.shift();   // « Projet » déjà dit par les réponses : pas deux fois
    if (l.length) h += dl(l);
    var pour = d.lignes ? R.pourquoiAppelee(d.lignes) : '';
    if (rdv.passation) h += '<p class="pv-note"><b>Son mot pour vous</b>' + esc(rdv.passation) + '</p>';
    if (pour) h += '<p class="pv-note"><b>Pourquoi elle l’a appelée</b>' + esc(pour) + '</p>';
    h += '<p class="pv-orig">' + esc(R.origine(rdv, d.equipe, auj)) + '</p>';
    if (d.lignes === null) h += '<p class="pv-att" role="status">Le journal des appels arrive…</p>';
    else if (d.lignes.length) h += '<h4>Le journal des appels</h4><ul class="pv-jr">' + R.journal(d.lignes, d.equipe, auj).map(function (j) { return '<li><span>' + esc(j.quand) + '</span><p>' + esc(j.texte) + '</p></li>'; }).join('') + '</ul>';
    return h + '</section>';
  }
  function sectionPharmacie(fiche, d) {
    var l = R.pharmacie(d.fiche || fiche, d.off);
    return l.length ? '<section class="pv-c pv-ph"><h3>La pharmacie</h3>' + dl(l) + '</section>' : '';
  }
  function sectionDossier(d) {
    var x = d.ph ? R.dossier(d.ph, P.aujourdhui()) : null; if (!x) return '';
    return '<section class="pv-c pv-dos"><h3>Son dossier chez vous</h3><ul class="pv-vl">' + x.volets.map(function (v) {
      return '<li><div><b>' + esc(v.nom) + '</b><small>' + esc(v.avance + ' · ' + v.etat) + '</small>' +
        (v.prochaine ? '<small>' + esc('Ensuite : ' + v.prochaine) + '</small>' : '') + (v.date ? '<small class="' + (v.retard ? 'pv-ret' : '') + '">' + esc(v.date) + '</small>' : '') +
        (v.raison ? '<small>' + esc('Raison : ' + v.raison) + '</small>' : '') + '</div></li>';
    }).join('') + '</ul>' + x.retient.map(function (t) { return '<p class="pv-note">' + esc(t) + '</p>'; }).join('') +
      '<a class="pa-b" href="#dossiers/' + encodeURIComponent(x.id) + '">Ouvrir le dossier</a></section>';
  }
  function sectionAppui(d) {
    var i = d.integ; if (!i || !i.commercial) return '';
    return '<section class="pv-c pv-int"><h3>Votre appui chez Intégral</h3><p class="pv-nom">' + esc(i.commercial) + '</p><p class="pv-role">Suit cette pharmacie</p><p class="pv-co">' +
      (i.tel ? '<a class="pa-tel" href="' + esc(i.telHref) + '">' + esc(i.tel) + '</a>' : '') + (i.mail ? '<a class="pa-lien" href="mailto:' + esc(i.mail) + '">' + esc(i.mail) + '</a>' : '') +
      '</p><p class="pv-seul">Seul Yann voit cette partie.</p></section>';
  }
  function voisines(fiche, d) { return d.autres ? R.voisines(fiche, d.autres, 2, 60) : []; }
  function sectionVoisines(v) {
    return v.length ? '<section class="pv-c pv-voi"><h3>Près d’elle, déjà équipées par vous</h3><ul class="pv-vl">' + v.map(function (x) {
      return '<li><div><b>' + esc(x.nom) + '</b><small>' + esc([x.ville, x.volets].filter(Boolean).join(' · ')) + '</small></div><span class="pv-km">' + x.km + ' km</span></li>';
    }).join('') + '</ul></section>' : '';
  }
  function lireCases(rdvId, n) { try { return R.casesLues(window.localStorage.getItem(R.cleCases(rdvId)), n); } catch (e) { return []; } }
  function sectionApporter(rdv, d, vois) {
    var sorte = R.sorteDeProjet(rdv.objet || '', d.ph ? d.ph.volets : []), l = R.aApporter(sorte, vois[0] || null), cochees = S.cases = lireCases(rdv.id, l.length);
    return '<section class="pv-c pv-app"><h3>À apporter</h3><p class="pv-prop">Proposition de départ : cochez ce que vous avez pris.</p><ul class="pv-cases">' + l.map(function (t, i) {
      return '<li><label class="pv-case"><input type="checkbox" data-coche="' + i + '"' + (cochees.indexOf(i) >= 0 ? ' checked' : '') + '><span class="pv-bte" aria-hidden="true"></span><span class="pv-t">' + esc(t) + '</span></label></li>';
    }).join('') + '</ul></section>';
  }
  function feuille() {
    var rdv = S.rdv, fiche = S.fiche, d = S.d, els = P.lierRdv(S.ctx.rdvs, S.ctx.fiches);
    var r = R.route(rdv, fiche, els, P.REGLAGES_AGENDA.base), t = R.enTete(rdv, d.fiche ? Object.assign({}, fiche, d.fiche) : fiche, r), vois = voisines(fiche, d);
    return '<header class="pv-tete"><p class="pv-tag">' + OK + 'Page prête</p><h2 id="pv-titre">' + esc(t.nom) + '</h2><p class="pv-ville">' + esc(t.lieu) + '</p>' +
      '<ul class="pv-faits">' + t.faits.map(function (f) { return '<li><span>' + esc(f.e) + '</span><b>' + esc(f.v) + '</b></li>'; }).join('') + '</ul></header>' +
      '<div class="pv-col pv-g">' + sectionTel(rdv, d) + sectionDossier(d) + '</div>' +
      '<div class="pv-col pv-d">' + sectionPharmacie(fiche, d) + sectionAppui(d) + sectionVoisines(vois) + sectionApporter(rdv, d, vois) + '</div>' +
      '<p class="pv-pied-f">Page préparée avec les données de Phirst.</p>';
  }
  function rendre() {
    var pv = document.getElementById('pv'); if (!pv || pv.hidden || !S.rdv) return;
    var f = pv.querySelector('.pv-feuille'); if (f) f.innerHTML = feuille();
  }
  function majLibelle() { var l = document.querySelector('#pv [data-lib]'); if (l) l.textContent = S.propre ? 'Ouvrir en panneau' : 'Ouvrir en page propre'; }
  function monter() {
    if (document.getElementById('pv')) return;
    var voile = document.createElement('div'); voile.className = 'pv-voile'; voile.id = 'pv-voile'; voile.hidden = true;
    var pv = document.createElement('aside'); pv.className = 'pv'; pv.id = 'pv'; pv.hidden = true; pv.setAttribute('role', 'dialog'); pv.setAttribute('aria-modal', 'true'); pv.setAttribute('aria-labelledby', 'pv-titre');
    document.body.appendChild(voile); document.body.appendChild(pv);
    voile.addEventListener('click', fermer);
    pv.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t.closest('[data-fermer]')) return fermer();
      if (t.closest('[data-propre]')) { S.propre = !S.propre; document.body.classList.toggle('pv-propre', S.propre); majLibelle(); if (S.propre) pv.scrollTop = 0; return; }
      if (t.closest('[data-imprimer]')) return window.print();
      var a = t.closest('a[href^="#"]'); if (a) fermer();
    });
    pv.addEventListener('change', function (ev) {
      var c = ev.target.closest && ev.target.closest('[data-coche]'); if (!c || !S.rdv) return;
      var i = +c.getAttribute('data-coche'), k = S.cases.indexOf(i);
      if (c.checked && k < 0) S.cases.push(i); else if (!c.checked && k >= 0) S.cases.splice(k, 1);
      try { window.localStorage.setItem(R.cleCases(S.rdv.id), JSON.stringify(S.cases)); } catch (e) { /* cases non gardées : la page reste utilisable */ }
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !pv.hidden) fermer(); });
    window.addEventListener('hashchange', function () { if (!pv.hidden) fermer(true); });
  }
  function ouvrir(rdvId, ctx) {
    var rdv = (ctx.rdvs || []).filter(function (r) { return r.id === rdvId; })[0]; if (!rdv) return;
    var fiche = (ctx.fiches || []).filter(function (f) { return f.id === rdv.prospect_id; })[0]; if (!fiche) return;
    monter();
    var pv = document.getElementById('pv'), voile = document.getElementById('pv-voile');
    S.rdv = rdv; S.fiche = fiche; S.ctx = ctx; S.dernier = document.activeElement; S.propre = false; S.d = { fiche: null, lignes: null, equipe: {}, off: null, integ: null, ph: null, autres: null };
    pv.innerHTML = '<div class="pv-barre"><button type="button" class="pa-b pv-ferme" data-fermer>‹ Retour à l’agenda</button><div class="pv-barre-d"><button type="button" class="pa-b" data-propre><span data-lib>Ouvrir en page propre</span></button><button type="button" class="pa-b pa-ok" data-imprimer>Imprimer</button></div></div><article class="pv-feuille"></article>';
    pv.hidden = false; voile.hidden = false; document.body.classList.add('pv-ouvert'); document.body.classList.remove('pv-propre');
    rendre(); lire(rdv, fiche, ctx);
    requestAnimationFrame(function () { pv.classList.add('pv-on'); voile.classList.add('pv-on'); });
    pv.setAttribute('tabindex', '-1'); pv.scrollTop = 0; try { pv.focus({ preventScroll: true }); } catch (e) { pv.focus(); }
  }
  function fermer(sansFocus) {
    var pv = document.getElementById('pv'), voile = document.getElementById('pv-voile'); if (!pv) return;
    S.jeton++; pv.classList.remove('pv-on'); voile.classList.remove('pv-on'); pv.hidden = true; voile.hidden = true; S.rdv = null; S.propre = false;
    document.body.classList.remove('pv-ouvert', 'pv-propre');
    if (sansFocus !== true && S.dernier && S.dernier.focus) try { S.dernier.focus({ preventScroll: true }); } catch (e) {}
  }
  window.PHIRST_PREPARER = { ouvrir: ouvrir, fermer: fermer };
})();

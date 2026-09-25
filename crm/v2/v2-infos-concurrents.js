/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Infos du jour › Les concurrents — LA PHRASE DU JOUR + LA CARTE

   Will, 25/09/2026, choix « 4-5 » sur les maquettes concurrents-secteur :
     v5 — une seule phrase : la nouvelle concurrent la plus utile pour SON
          secteur, avec l'angle à prendre en rendez-vous quand il existe ;
     v4 — la carte de ses départements, chaque agence concurrente à sa place.
   Le fil complet (v2-grossistes.js) reste en dessous, inchangé.

   Données, toutes PUBLIQUES (aucune donnée client) :
     concurrents-implantations.json — robot mensuel (registre officiel, NAF 46.46Z)
     departements-contours.json     — fond de carte (IGN Admin Express, Licence ouverte)
     grossistes-verifie.json        — faits vérifiés à la main (« acteur », « angle »)
     grossistes-actu.json           — robot quotidien, articles tagués par concurrent
   Le secteur vient de V2.infosSecteur() (v2-infos.js) : départements où le
   commercial a au moins 3 officines, ou la portée choisie par la direction.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function urlSure(u) { var t = String(u == null ? '' : u).trim(); return /^https?:\/\//i.test(t) ? t : '#'; }

  // une teinte par concurrent, même clarté : seule la couleur change
  var COUL = { phoenix: '#C2410C', cerp: '#0F766E', 'cerp-ba': '#0E7490', alliance: '#6D28D9', giphar: '#BE185D',
    sagitta: '#A16207', drapier: '#4D7C0F', aredis: '#B91C1C', rbp: '#475569' };
  // tag du robot d'actualités → concurrent de la carte (anciens tags gardés pour les vieux articles)
  var TAG_ACT = { ocp: 'phoenix', phoenix: 'phoenix', cerp: 'cerp', 'cerp-rouen': 'cerp', 'cerp-rrm': 'cerp',
    'cerp-ba': 'cerp-ba', alliance: 'alliance', giphar: 'giphar', sagitta: 'sagitta', drapier: 'drapier', aredis: 'aredis', rbp: 'rbp' };

  var IMPL = null, CONT = null, ACTU = [], VERIF = [], ETAT = 'vide';   // vide | charge | pret | rate
  var ATTENTE = [];
  var CHOIX = '';   // concurrent allumé sur la carte

  function charger(cb) {
    if (ETAT === 'pret') { cb(); return; }
    ATTENTE.push(cb);
    if (ETAT === 'charge') return;
    ETAT = 'charge';
    var d = '?d=' + new Date().toISOString().slice(0, 10);
    var get = function (f) { return fetch(f + d, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }); };
    var actu = new Promise(function (ok) {
      if (!V2.grossistesActuDonnees) { ok(); return; }
      V2.grossistesActuDonnees(function (a, v) { ACTU = a || []; VERIF = v || []; ok(); });
    });
    Promise.all([get('concurrents-implantations.json'), get('departements-contours.json'), actu])
      .then(function (r) { IMPL = r[0]; CONT = r[1]; ETAT = 'pret'; })
      .catch(function () { ETAT = 'rate'; })
      .then(function () { var l = ATTENTE; ATTENTE = []; l.forEach(function (f) { f(); }); });
  }

  function jours(iso) { try { return (Date.now() - new Date(String(iso).slice(0, 10) + 'T12:00:00')) / 864e5; } catch (e) { return 9999; } }
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function dcourt(iso) { var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? (+p[2]) + ' ' + MOIS[+p[1] - 1] : ''; }
  function villes(a, max) {
    var v = a.chez.map(function (g) { return g.ville + ' (' + g.dep + ')'; });
    return (max && v.length > max) ? v.slice(0, max).join(' · ') + ' +' + (v.length - max) : v.join(' · ');
  }

  /* projection : la MÊME que scripts/build_departements_contours.py */
  function proj(lon, lat) { return [(lon - CONT.lon0) * CONT.c * CONT.k, (CONT.lat0 - lat) * CONT.k]; }
  var BOITES = {};
  function boite(code) {
    if (BOITES[code]) return BOITES[code];
    var n = ((CONT.deps[code] || {}).d || '').match(/-?\d+/g) || [], b = [1e9, 1e9, -1e9, -1e9];
    for (var i = 0; i + 1 < n.length; i += 2) {
      var x = +n[i], y = +n[i + 1];
      if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
    }
    return (BOITES[code] = b);
  }

  /* ── v5 : la phrase du jour ── */
  function phrase(A, deps) {
    // 1. un fait VÉRIFIÉ, confirmé, sur un concurrent installé chez toi, de moins de 4 mois ;
    //    celui qui a un angle de rendez-vous passe devant (c'est lui qui sert en visite)
    var f = VERIF.filter(function (v) { var a = A[v.acteur]; return a && a.chez.length && !v.nonConfirme && jours(v.date) <= 120; })
      .sort(function (x, y) { return (!!y.angle - !!x.angle) || String(y.date).localeCompare(String(x.date)); })[0];
    if (f) return { a: A[f.acteur], titre: f.titre, texte: f.texte, angle: f.angle || '', src: f.source, url: f.url, date: f.date, verifie: true };
    // 2. sinon, l'article le plus récent (moins d'un mois) qui nomme un concurrent installé chez toi
    var n = ACTU.filter(function (i) { var a = A[TAG_ACT[i.tag]]; return a && a.chez.length && jours(i.date) <= 31; })[0];
    if (n) return { a: A[TAG_ACT[n.tag]], titre: n.titre, texte: n.resume || '', angle: '', src: n.source, url: n.url, date: n.date, verifie: false };
    return null;
  }

  function autres(A, p) {
    return ACTU.filter(function (i) { var a = A[TAG_ACT[i.tag]]; return a && a.chez.length && jours(i.date) <= 92 && (!p || i.url !== p.url); }).slice(0, 6);
  }

  function phraseHtml(p, liste, deps) {
    var fil = liste.map(function (i) {
      var a = IMPL_A[TAG_ACT[i.tag]];
      return '<li><span class="cnc-d">' + esc(dcourt(i.date)) + '</span><span><a href="' + esc(urlSure(i.url)) + '" target="_blank" rel="noopener">' + esc(i.titre) + '</a>' +
        '<span class="cnc-m">' + esc(i.source || '') + ' · <i style="background:' + COUL[a.cle] + '"></i>' + esc(a.nom) + '</span></span></li>';
    }).join('');
    if (!p) {
      return '<div class="cnc-calme">Rien de neuf ce mois-ci sur les concurrents installés ' + (deps ? 'dans ton secteur' : 'en France') + '.' +
        (liste.length ? '</div><ul class="cnc-fil">' + fil + '</ul>' : '</div>');
    }
    return '<div class="cnc-phrase">' +
      '<small>' + (deps ? 'Chez toi' : 'En France') + ' · ' + esc(p.a.nom) + ', ' + (p.a.chez.length > 1 ? 'agences à ' : 'agence à ') + esc(villes(p.a, 3)) + '</small>' +
      '<p>' + esc(p.titre) + '</p>' +
      (p.texte ? '<div class="cnc-txt">' + esc(p.texte) + '</div>' : '') +
      (p.angle ? '<div class="cnc-angle"><b>L’angle en rendez-vous</b>' + esc(p.angle) + '</div>' : '') +
      '<div class="cnc-src">' + (p.verifie ? 'Fait vérifié · ' : '') + esc(dcourt(p.date)) + ' · ' + esc(p.src || '') +
        (urlSure(p.url) !== '#' ? ' · <a href="' + esc(urlSure(p.url)) + '" target="_blank" rel="noopener">lire la source</a>' : '') + '</div>' +
      (liste.length ? '<button type="button" class="cnc-voir" aria-expanded="false" onclick="V2.cncAutres(this)">Voir ' +
        (liste.length > 1 ? 'les ' + liste.length + ' autres nouvelles' : 'l’autre nouvelle') + ' de ' + (deps ? 'ton secteur' : 'ces concurrents') + '</button>' : '') +
    '</div>' + (liste.length ? '<ul class="cnc-fil cnc-autres" hidden>' + fil + '</ul>' : '');
  }
  V2.cncAutres = function (b) {
    var l = b.closest('.cnc').querySelector('.cnc-autres'); if (!l) return;
    var on = l.hasAttribute('hidden');
    if (on) l.removeAttribute('hidden'); else l.setAttribute('hidden', '');
    b.setAttribute('aria-expanded', on);
    b.textContent = on ? 'Replier' : 'Voir les autres nouvelles';
  };

  /* ── v4 : la carte ── */
  var IMPL_A = {};
  function carteHtml(presents, deps) {
    var codes = Object.keys(CONT.deps), secteur = deps || codes.filter(function (c) { return c.length === 2 && c !== '2A' && c !== '2B'; });
    var B = [1e9, 1e9, -1e9, -1e9];
    secteur.forEach(function (c) { var b = boite(c); if (b[2] < b[0]) return; B = [Math.min(B[0], b[0]), Math.min(B[1], b[1]), Math.max(B[2], b[2]), Math.max(B[3], b[3])]; });
    if (B[2] < B[0]) return '';
    var w0 = B[2] - B[0], h0 = B[3] - B[1], m = Math.max(w0, h0) * 0.06;
    B = [B[0] - m, B[1] - m, B[2] + m, B[3] + m];
    var W = B[2] - B[0], H = B[3] - B[1], u = Math.max(W, H) / 1000;   // 1 unité ≈ 1 px d'une carte de 1000 px
    var SS = {}; secteur.forEach(function (c) { SS[c] = 1; });
    var sv = '<svg viewBox="' + [B[0], B[1], W, H].map(Math.round).join(' ') + '" role="img" aria-label="Carte des agences concurrentes ' + (deps ? 'dans ton secteur' : 'en France') + '" preserveAspectRatio="xMidYMid meet">';
    codes.forEach(function (c) {   // voisins visibles dans le cadre : ils situent le secteur
      var b = boite(c); if (b[2] < B[0] || b[0] > B[2] || b[3] < B[1] || b[1] > B[3]) return;
      sv += '<path class="cnc-dp' + (deps && SS[c] ? ' s' : '') + '" d="' + CONT.deps[c].d + '" stroke-width="' + (1.6 * u).toFixed(2) + '"/>';
    });
    if (deps) deps.forEach(function (c) {
      var b = boite(c);
      sv += '<text x="' + Math.round((b[0] + b[2]) / 2) + '" y="' + Math.round((b[1] + b[3]) / 2 + 9 * u) + '" font-size="' + Math.round(26 * u) + '">' + esc(c) + '</text>';
    });
    var r = (deps ? 11 : 7) * u;
    presents.forEach(function (a) {
      a.chez.forEach(function (g) {
        if (g.lat == null || g.lon == null) return;
        var p = proj(g.lon, g.lat);
        sv += '<circle class="cnc-ag" data-a="' + esc(a.cle) + '" data-r="' + r.toFixed(1) + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + COUL[a.cle] + '" stroke="#fff" stroke-width="' + (3 * u).toFixed(1) + '"><title>' + esc(a.nom + ' — ' + g.ville) + '</title></circle>';
      });
    });
    sv += '</svg>';
    var n = presents.reduce(function (s, a) { return s + a.chez.length; }, 0);
    return '<div class="cnc-terrain">' +
      '<div class="cnc-th"><b>' + (deps ? 'Ton terrain' : 'Toute la France') + '</b><span>' + presents.length + ' concurrent' + (presents.length > 1 ? 's' : '') + ' · ' + n + ' agence' + (n > 1 ? 's' : '') + '</span></div>' +
      '<div class="cnc-wrap"><div class="cnc-carte">' + sv + '</div><div class="cnc-leg">' +
        presents.map(function (a) {
          return '<button type="button" aria-pressed="' + (CHOIX === a.cle) + '" onclick="V2.cncChoix(this,\'' + esc(a.cle) + '\')"><i style="background:' + COUL[a.cle] + '"></i>' + esc(a.nom) + '<span>' + a.chez.length + '</span></button>';
        }).join('') +
        '<div class="cnc-info" aria-live="polite">Touche un concurrent pour allumer ses agences.</div>' +
      '</div></div>' +
      '<div class="cnc-note">Agences actives au registre officiel des entreprises (lecture du ' + esc(dcourt(IMPL.maj)) + '). ' +
        (deps ? 'Absents de ton secteur : ' + esc(IMPL.acteurs.filter(function (a) { return !IMPL_A[a.cle].chez.length; }).map(function (a) { return a.nom; }).join(', ') || 'aucun') + '.' : '') + '</div>' +
    '</div>';
  }
  V2.cncChoix = function (b, cle) {
    var root = b.closest('.cnc'); if (!root) return;
    CHOIX = (CHOIX === cle) ? '' : cle;
    root.querySelectorAll('.cnc-leg button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    var carte = root.querySelector('.cnc-carte');
    carte.classList.toggle('filtre', !!CHOIX);
    root.querySelectorAll('circle.cnc-ag').forEach(function (c) {
      var on = !!CHOIX && c.getAttribute('data-a') === CHOIX, r0 = +c.getAttribute('data-r');
      c.classList.toggle('on', on); c.setAttribute('r', (on ? r0 * 1.4 : r0).toFixed(1));
    });
    var info = root.querySelector('.cnc-info');
    if (!CHOIX) { info.textContent = 'Touche un concurrent pour allumer ses agences.'; return; }
    b.setAttribute('aria-pressed', 'true');
    var a = IMPL_A[cle];
    var v = VERIF.filter(function (x) { return x.acteur === cle && !x.nonConfirme; }).sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); })[0];
    var n = ACTU.filter(function (i) { return TAG_ACT[i.tag] === cle; })[0];
    info.innerHTML = '<b>' + esc(a.nom) + '</b> : ' + esc(villes(a, 8)) + '.<br>' +
      (v ? 'Dernier fait vérifié : ' + esc(v.titre) + ' (' + esc(dcourt(v.date)) + ').'
        : n ? 'Dernière nouvelle : ' + esc(n.titre) + ' (' + esc(dcourt(n.date)) + ').' : 'Rien de nouveau dans la veille.');
  };

  /* ── point d'entrée, appelé par v2-infos.js après le rendu ── */
  V2.concurrentsSecteur = function (host) {
    injectCss();
    charger(function () {
      if (!host.isConnected) return;
      if (ETAT !== 'pret' || !IMPL || !CONT) { host.innerHTML = ''; return; }   // contrôle raté : on se tait, le fil reste
      var S = V2.infosSecteur ? V2.infosSecteur() : { deps: null };
      var deps = S.deps, SS = {};
      if (!deps && !(V2.user && V2.user.voitTousReel)) { host.innerHTML = ''; return; }   // pas de secteur, pas de bascule : rien
      (deps || []).forEach(function (c) { SS[c] = 1; });
      IMPL_A = {};
      IMPL.acteurs.forEach(function (a) {
        IMPL_A[a.cle] = { cle: a.cle, nom: a.nom, chez: a.agences.filter(function (g) { return !deps || SS[g.dep]; }) };
      });
      var presents = IMPL.acteurs.map(function (a) { return IMPL_A[a.cle]; })
        .filter(function (a) { return a.chez.length && COUL[a.cle]; })
        .sort(function (x, y) { return y.chez.length - x.chez.length; });
      if (CHOIX && !IMPL_A[CHOIX].chez.length) CHOIX = '';
      var p = phrase(IMPL_A, deps);
      host.innerHTML = '<div class="cnc">' + phraseHtml(p, autres(IMPL_A, p), deps) + carteHtml(presents, deps) + '</div>';
      if (CHOIX) { var b = host.querySelector('.cnc-leg button[aria-pressed="true"]'); var c = CHOIX; CHOIX = ''; if (b) V2.cncChoix(b, c); }
    });
  };

  var CSS_OK = false;
  function injectCss() {
    if (CSS_OK) return; CSS_OK = true;
    var s = document.createElement('style');
    s.textContent = [
      '.cnc{display:flex;flex-direction:column;gap:14px;margin:0 0 18px}',
      '.cnc-phrase{position:relative;border-radius:22px;padding:22px 22px 18px;color:#fff;overflow:hidden;isolation:isolate;' +
        'background:radial-gradient(520px 300px at 12% 0%,#3D7BFF 0%,rgba(61,123,255,0) 65%),linear-gradient(135deg,#0050E6 0%,#0034A0 100%);' +
        'box-shadow:0 10px 30px rgba(0,52,160,.26),0 30px 60px rgba(0,52,160,.16)}',
      '.cnc-phrase::after{content:"";position:absolute;right:-80px;top:-80px;width:260px;height:260px;border-radius:50%;z-index:-1;' +
        'background:radial-gradient(circle,rgba(255,255,255,.22),rgba(255,255,255,0) 70%)}',
      '.cnc-phrase small{display:block;font-size:13px;font-weight:700;color:rgba(255,255,255,.9)}',
      '.cnc-phrase p{font-size:clamp(19px,3.2vw,24px);font-weight:750;letter-spacing:-.015em;line-height:1.3;margin:8px 0 8px;overflow-wrap:anywhere}',
      '.cnc-txt{font-size:14.5px;line-height:1.5;color:rgba(255,255,255,.92);margin-bottom:10px}',
      '.cnc-angle{font-size:14.5px;line-height:1.5;background:rgba(255,255,255,.13);border-radius:14px;padding:10px 12px}',
      '.cnc-angle b{display:block;font-size:12.5px;letter-spacing:.04em;text-transform:uppercase;color:rgba(255,255,255,.9);margin-bottom:2px}',
      '.cnc-src{font-size:13px;color:rgba(255,255,255,.9);margin-top:10px}',
      '.cnc-src a{color:#fff;font-weight:700}',
      '.cnc-voir{margin-top:12px;min-height:44px;padding:0 16px;border-radius:999px;border:0;background:#fff;color:#0034A0;font:inherit;font-weight:750;cursor:pointer}',
      '.cnc-calme{font-size:14px;color:var(--muted,#5E6679);background:var(--card,#fff);border:1px solid var(--line,rgba(16,19,28,.08));border-radius:16px;padding:12px 14px}',
      '.cnc-fil{list-style:none;margin:0;padding:6px 14px;background:var(--card,#fff);border:1px solid var(--line,rgba(16,19,28,.08));border-radius:18px}',
      '.cnc-fil li{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--line,rgba(16,19,28,.08))}',
      '.cnc-fil li:first-child{border-top:0}',
      '.cnc-d{flex:none;width:52px;font-size:13px;font-weight:700;color:var(--muted,#5E6679);padding-top:2px}',
      '.cnc-fil a{font-size:15px;font-weight:650;line-height:1.35;color:var(--ip-ink,#10131C);text-decoration:none;overflow-wrap:anywhere}',
      '.cnc-fil a:hover{color:var(--ip-blue,#0050E6)}',
      '.cnc-m{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;color:var(--muted,#5E6679);margin-top:4px}',
      '.cnc-m i{width:8px;height:8px;border-radius:50%}',
      '.cnc-terrain{position:relative;background:linear-gradient(180deg,#FFFFFF 0%,#FAFBFE 100%);border:1px solid var(--line,rgba(16,19,28,.08));border-radius:22px;padding:18px;overflow:hidden;' +
        'box-shadow:0 4px 10px rgba(16,19,28,.05),0 14px 26px rgba(16,19,28,.07)}',
      '.cnc-th{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
      '.cnc-th b{font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--ip-ink,#10131C)}',
      '.cnc-th span{font-size:13px;font-weight:600;color:var(--muted,#5E6679)}',
      '.cnc-wrap{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start}',
      '.cnc-carte{border-radius:16px;overflow:hidden;border:1px solid var(--line,rgba(16,19,28,.08));background:radial-gradient(420px 320px at 30% 20%,#FFFFFF 0%,#EEF3FC 70%,#E4EBF8 100%)}',
      '.cnc-carte svg{display:block;width:100%;height:auto;max-height:560px}',
      '.cnc-dp{fill:#E9EDF5;stroke:#fff;stroke-linejoin:round}',
      '.cnc-dp.s{fill:#FFFFFF;stroke:#C9D6F0}',
      '.cnc-carte text{font-weight:800;fill:rgba(16,19,28,.24);text-anchor:middle;font-family:inherit}',
      '.cnc-ag{transition:opacity .25s}',
      '.cnc-carte.filtre .cnc-ag{opacity:.12}',
      '.cnc-carte.filtre .cnc-ag.on{opacity:1}',
      '.cnc-leg{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.cnc-leg button{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 12px;border-radius:12px;border:1px solid var(--line,rgba(16,19,28,.08));' +
        'background:var(--card,#fff);color:var(--ip-ink,#10131C);text-align:left;font:inherit;font-size:14px;font-weight:650;cursor:pointer}',
      '.cnc-leg button[aria-pressed="true"]{border-color:var(--ip-blue,#0050E6);background:#EEF4FF}',
      '.cnc-leg button i{width:12px;height:12px;border-radius:50%;flex:none}',
      '.cnc-leg button span{margin-left:auto;font-size:13px;color:var(--muted,#5E6679);font-weight:700}',
      '.cnc-info{font-size:13.5px;line-height:1.5;color:var(--ip-ink-2,#2A2F3C);padding:10px 12px;border-radius:12px;background:#F5F7FB;margin-top:4px;overflow-wrap:anywhere}',
      '.cnc-note{font-size:13px;color:var(--muted,#5E6679);line-height:1.5;margin-top:12px}',
      '@media (max-width:700px){.cnc-wrap{grid-template-columns:1fr}.cnc-terrain{padding:14px}.cnc-phrase{padding:18px 16px 16px}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();

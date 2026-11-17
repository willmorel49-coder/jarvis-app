/* ═══════════════════════════════════════════════════════════════════════════
   VENTES OFFILOG PAR PHARMACIE (06/11/2026) — fiche officine + bloc « Offilog » du Pilotage.

   Données : window.WML_OFF_CA.off (table protégée, réduite au périmètre de chaque commercial) :
     vm = mois couverts ["2026-09", …]      v  = {TIRCODE: [HT net par mois de vm]}
     va = {TIRCODE: prénom JARVIS | NOM COMPLET « hors JARVIS » | ""}     vn = {TIRCODE: nom dans le fichier}
     pr = {s: seuil, p: montant, de: "AAAA-MM", a: "AAAA-MM"}   (absent sans réglage : aucune prime affichée)
     m  = {TIRCODE: [1 « O » | 0 « N », rang de la date]}, d = dates des fichiers
   Seuil, montant et période de la prime ne sont écrits NULLE PART ici : ils viennent de `pr`.

   Qui voit quoi (même règle que le reste du Pilotage) :
   - accès total, périmètre « Tous » : tout, y compris « sans commercial » et « hors JARVIS » (à part) ;
   - accès total, un commercial choisi : ses pharmacies (attribution du fichier Offilog) ;
   - commercial restreint : lui et les collègues déjà ouverts sur son profil, jamais une ligne d'un autre.
   « Hors JARVIS » = nom complet en MAJUSCULES dans `va` (un prénom JARVIS n'est jamais tout en majuscules).

   Aucun HTML dans les fonctions de calcul : testé dans tests/offilog-ventes.test.mjs sur des données inventées.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 || (glob.V2 = {});
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var NB = ' ';
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  // ── formats ──────────────────────────────────────────────────────────────
  function eur(n) {
    var r = Math.round(+n || 0), neg = r < 0, s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    return (neg ? '−' : '') + s + NB + '€';
  }
  function moisCourt(ym) { return MOIS[(+String(ym).slice(5, 7) || 1) - 1] || ''; }
  function moisLong(ym) { return moisCourt(ym) + ' ' + String(ym).slice(0, 4); }
  function periode(vm) {
    if (!vm || !vm.length) return '';
    var a = vm[0], b = vm[vm.length - 1];
    if (a === b) return moisLong(a);
    return a.slice(0, 4) === b.slice(0, 4) ? moisCourt(a) + '–' + moisLong(b) : moisLong(a) + '–' + moisLong(b);
  }
  function dateFr(d) { d = String(d || ''); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : ''; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function cle(x) { return String(x == null ? '' : x).replace(/[^0-9]/g, ''); }
  function nomPropre(s) { return String(s || '').toLowerCase().replace(/(^|[\s\-'])([a-zàâçéèêëîïôûù])/g, function (_, a, b) { return a + b.toUpperCase(); }); }
  function estHors(va) { return !!va && va === va.toUpperCase() && va !== va.toLowerCase(); }

  // ── 1. Fiche officine ────────────────────────────────────────────────────
  // Texte de la ligne « Offilog » ; '' si la table n'a rien de neuf à dire (l'appelant garde alors son texte d'avant).
  function texteFiche(pid, off) {
    if (!off || !off.vm || !off.vm.length) return '';
    var k = String(pid), v = off.v && off.v[k];
    if (v) return off.vm.map(function (ym, i) { return eur(v[i] || 0) + ' en ' + moisCourt(ym); }).join(' · ');
    var m = off.m && off.m[k];
    if (m && m[0] === 1) {
      var d = dateFr((off.d || [])[m[1]]);
      return 'Aucun achat en ' + periode(off.vm) + ' · notée cliente' + (d ? ' au ' + d : '');
    }
    return '';
  }

  // ── 2. Périmètre ─────────────────────────────────────────────────────────
  // ctx = { commFilter: '' | prénom, restreint: bool, mes: [prénoms du commercial et collègues ouverts] }
  function portee(ctx) {
    ctx = ctx || {};
    if (ctx.commFilter) return { noms: [String(ctx.commFilter)], tout: false };
    if (ctx.restreint) return { noms: (ctx.mes || []).map(String), tout: false };
    return { noms: null, tout: true };
  }
  function dedans(P, va) { return P.tout || P.noms.indexOf(va) >= 0; }
  function genre(va) { return !va ? 'sans' : (estHors(va) ? 'hors' : 'jarvis'); }

  var _idx = null;
  function index(officines) {
    if (_idx && _idx.ref === officines && _idx.n === (officines || []).length) return _idx.m;
    var m = {};
    (officines || []).forEach(function (o) { if (!o) return; [o.id, o.code].forEach(function (k) { k = cle(k); if (k) m[k] = o; }); });
    _idx = { ref: officines, n: (officines || []).length, m: m };
    return m;
  }
  function fiche(off, officines, k) {
    var o = index(officines)[cle(k)], vn = off.vn && off.vn[k];
    return { id: String(k), nom: (o && o.name) || vn || ('Pharmacie ' + k), ville: (o && o.ville) || '', connue: !!o, comms: (o && o.comms) || [] };
  }

  // ── 3. Calculs ───────────────────────────────────────────────────────────
  function rangMois(off, ym) { return (off && off.vm || []).indexOf(ym); }

  // Pharmacies du mois dans le périmètre : [{ id, nom, ville, connue, va, ca }]
  function pharmaciesDuMois(off, officines, P, ym) {
    var i = rangMois(off, ym), out = [];
    if (i < 0 || !off.v) return out;
    Object.keys(off.v).forEach(function (k) {
      var va = (off.va && off.va[k]) || '';
      var ca = r2(off.v[k][i] || 0);
      if (!ca || !dedans(P, va)) return;
      var f = fiche(off, officines, k); f.va = va; f.ca = ca; out.push(f);
    });
    return out;
  }
  function groupes(lignes) {
    var g = {};
    lignes.forEach(function (l) { var x = g[l.va] || (g[l.va] = { va: l.va, genre: genre(l.va), ca: 0, nb: 0, lignes: [] }); x.ca = r2(x.ca + l.ca); if (l.ca > 0) x.nb++; x.lignes.push(l); });
    return Object.keys(g).map(function (k) { return g[k]; });
  }
  var ORDRE = { jarvis: 0, hors: 1, sans: 2 };
  function tri(a, b) { return (ORDRE[a.genre] - ORDRE[b.genre]) || (b.ca - a.ca) || String(a.va).localeCompare(String(b.va)); }

  // (a) classement du mois : un commercial = une ligne ; ses pharmacies, du plus gros au plus petit.
  function classement(off, officines, ctx, ym) {
    var P = portee(ctx), gs = groupes(pharmaciesDuMois(off, officines, P, ym));
    gs.forEach(function (g) { g.lignes.sort(function (a, b) { return b.ca - a.ca; }); });
    return gs.sort(tri);
  }

  // (b) prime du mois. { actif:false, raison } hors période / sans réglage.
  function prime(off, officines, ctx, ym) {
    var pr = off && off.pr;
    if (!pr) return { actif: false, raison: 'reglage' };
    if (ym < pr.de || ym > pr.a) return { actif: false, raison: 'periode', de: pr.de, a: pr.a };
    var gs = classement(off, officines, ctx, ym).map(function (g) {
      var clients = g.lignes.filter(function (l) { return l.ca >= pr.s; });
      return { va: g.va, genre: g.genre, nb: clients.length, prime: g.genre === 'jarvis' ? r2(clients.length * pr.p) : 0, clients: clients };
    }).filter(function (g) { return g.nb > 0 || g.genre === 'jarvis'; });
    gs.sort(function (a, b) { return (ORDRE[a.genre] - ORDRE[b.genre]) || (b.prime - a.prime) || (b.nb - a.nb) || String(a.va).localeCompare(String(b.va)); });
    // total payé = commerciaux JARVIS SEULS ; « sans commercial » et « hors JARVIS » sont comptés à part
    var total = 0, nbPaye = 0;
    gs.forEach(function (g) { if (g.genre === 'jarvis') { total = r2(total + g.prime); nbPaye += g.nb; } });
    return { actif: true, seuil: pr.s, montant: pr.p, groupes: gs, total: total, nbPaye: nbPaye };
  }

  // (c) notées clientes Offilog sans aucune ligne de vente sur les mois du fichier, rangées par commercial JARVIS de l'officine.
  function aRelancer(off, officines, ctx) {
    var P = portee(ctx), res = { groupes: [], total: 0 }, g = {}, vus = {};
    if (!off || !off.vm || !off.vm.length || !off.m || !off.v) return res;
    Object.keys(off.m).forEach(function (k) {
      if (off.m[k][0] !== 1 || off.v[k]) return;
      var f = fiche(off, officines, k);
      var cs = f.comms.filter(function (c) { return dedans(P, c); });
      if (!cs.length) {
        if (!(P.tout && !f.comms.length)) return;
        cs = [''];
      }
      cs.forEach(function (c) { (g[c] || (g[c] = [])).push(f); });
      vus[k] = 1;
    });
    res.total = Object.keys(vus).length;
    res.groupes = Object.keys(g).map(function (c) {
      return { comm: c, lignes: g[c].sort(function (a, b) { return String(a.nom).localeCompare(String(b.nom)); }) };
    }).sort(function (a, b) { return (a.comm === '') - (b.comm === '') || b.lignes.length - a.lignes.length || String(a.comm).localeCompare(String(b.comm)); });
    return res;
  }

  // ── 4. Écran ─────────────────────────────────────────────────────────────
  var ETAT = { mois: null };
  function moisChoisi(off) {
    var vm = off.vm || [];
    return vm.indexOf(ETAT.mois) >= 0 ? ETAT.mois : vm[vm.length - 1];
  }
  function nomGroupe(g) { return g.genre === 'sans' ? 'Sans commercial' : (g.genre === 'hors' ? nomPropre(g.va) : g.va); }
  function lienPharma(l) { return l.connue ? '<a href="#" class="ofv-ph-n" data-ofv-pid="' + esc(l.id) + '">' + esc(l.nom) + '</a>' : '<span class="ofv-ph-n">' + esc(l.nom) + '</span>'; }
  function pluriel(n, un, plu) { return n + ' ' + (n > 1 ? plu : un); }

  function htmlClassement(rows) {
    if (!rows.length) return '<p class="ofv-vide">Aucun achat Offilog ce mois-ci dans ce périmètre.</p>';
    return rows.map(function (g, i) {
      var apart = g.genre !== 'jarvis';
      return '<details class="ofv-g"><summary class="ofv-row">' +
        '<span class="ofv-rang">' + (apart ? '' : (i + 1)) + '</span>' +
        '<span class="ofv-n">' + esc(nomGroupe(g)) + (apart ? ' <em class="ofv-tag">' + (g.genre === 'hors' ? 'hors JARVIS' : 'à part') + '</em>' : '') + '</span>' +
        '<span class="ofv-v">' + eur(g.ca) + '</span>' +
        '<span class="ofv-s">' + pluriel(g.nb, 'pharmacie', 'pharmacies') + '</span></summary>' +
        '<ul class="ofv-ph">' + g.lignes.map(function (l) {
          return '<li>' + lienPharma(l) + '<span class="ofv-vl">' + esc(l.ville) + '</span><b class="ofv-v">' + eur(l.ca) + '</b></li>';
        }).join('') + '</ul></details>';
    }).join('');
  }

  function htmlPrime(p, ym, ctx) {
    if (!p.actif) {
      if (p.raison !== 'periode') return '';
      return '<p class="ofv-vide">Pas de prime pour ' + esc(moisLong(ym)) + ' : elle court de ' + esc(moisLong(p.de)) + ' à ' + esc(moisLong(p.a)) + '.</p>';
    }
    var jar = p.groupes.filter(function (g) { return g.genre === 'jarvis'; });
    var apart = p.groupes.filter(function (g) { return g.genre !== 'jarvis'; });
    var tete = '<p class="ofv-phrase"><b>' + eur(p.total) + '</b> pour ' + esc(moisLong(ym)) + ' : ' + pluriel(p.nbPaye, 'client', 'clients') +
      ' à ' + eur(p.seuil) + ' HT ou plus (avoirs déduits), ' + eur(p.montant) + ' par client.</p>';
    var ligne = function (g) {
      var a = g.genre !== 'jarvis';
      return '<details class="ofv-g"><summary class="ofv-row"><span class="ofv-rang"></span>' +
        '<span class="ofv-n">' + esc(nomGroupe(g)) + (a ? ' <em class="ofv-tag">' + (g.genre === 'hors' ? 'hors JARVIS' : 'à part') + '</em>' : '') + '</span>' +
        '<span class="ofv-v">' + (a ? 'non compté' : eur(g.prime)) + '</span>' +
        '<span class="ofv-s">' + pluriel(g.nb, 'client', 'clients') + '</span></summary>' +
        '<ul class="ofv-ph">' + g.clients.map(function (l) {
          return '<li>' + lienPharma(l) + '<span class="ofv-vl">' + esc(l.ville) + '</span><b class="ofv-v">' + eur(l.ca) + '</b></li>';
        }).join('') + '</ul></details>';
    };
    if (!jar.length && !apart.length) return tete;
    return tete + jar.map(ligne).join('') +
      (apart.length ? '<p class="ofv-note">Comptés à part, jamais dans le total ci-dessus :</p>' + apart.map(ligne).join('') : '');
  }

  function htmlRelancer(r) {
    if (!r.total) return '<p class="ofv-vide">Aucune pharmacie notée cliente Offilog sans achat.</p>';
    return '<p class="ofv-note">' + pluriel(r.total, 'pharmacie notée', 'pharmacies notées') + ' cliente Offilog sans aucun achat sur la période du fichier.</p>' +
      r.groupes.map(function (g) {
        return '<details class="ofv-g"><summary class="ofv-row"><span class="ofv-rang"></span><span class="ofv-n">' + esc(g.comm || 'Sans commercial') + '</span><span class="ofv-v"></span>' +
          '<span class="ofv-s">' + pluriel(g.lignes.length, 'pharmacie', 'pharmacies') + '</span></summary>' +
          '<ul class="ofv-ph">' + g.lignes.map(function (l) {
            return '<li>' + lienPharma(l) + '<span class="ofv-vl">' + esc(l.ville) + '</span></li>';
          }).join('') + '</ul></details>';
      }).join('');
  }

  function corps(off, officines, ctx) {
    var vm = off.vm, ym = moisChoisi(off), P = portee(ctx);
    var opts = vm.slice().reverse().map(function (m) { return '<option value="' + esc(m) + '"' + (m === ym ? ' selected' : '') + '>' + esc(moisLong(m)) + '</option>'; }).join('');
    var pr = prime(off, officines, ctx, ym), htP = htmlPrime(pr, ym, ctx);
    var qui = ctx && ctx.commFilter ? ' · ' + esc(ctx.commFilter) : (P.tout ? ' · tous les commerciaux' : '');
    return '<div class="ofv-bar"><label class="ofv-lab">Mois <select class="ofv-mois" aria-label="Mois Offilog">' + opts + '</select></label><span class="ofv-qui">' + qui.replace(/^ · /, '') + '</span></div>' +
      '<h4 class="ofv-h">Chiffre d’affaires Offilog du mois <small>HT, avoirs déduits</small></h4>' + htmlClassement(classement(off, officines, ctx, ym)) +
      (htP ? '<h4 class="ofv-h">Prime Offilog</h4>' + htP : '') +
      '<h4 class="ofv-h">À relancer <small>notées clientes, sans achat</small></h4>' + htmlRelancer(aRelancer(off, officines, ctx));
  }

  function donnees() { return (glob.WML_OFF_CA || {}).off || null; }
  // Contenu du bloc (sans cadre : le Pilotage l'habille). '' si la table n'a pas de ventes.
  function bloc(ctx) {
    var off = donnees();
    if (!off || !off.vm || !off.vm.length || !off.v) return '';
    css();
    return '<div class="ofv" id="ofv-host">' + corps(off, glob.WML_OFFICINES || [], ctx) + '</div>';
  }
  // À appeler après chaque rendu de la page : branche le sélecteur de mois et les liens, sans rerendre la page.
  function lier(root, ctx) {
    var host = root && root.querySelector && root.querySelector('#ofv-host'), off = donnees();
    if (!host || !off) return;
    var go = function () {
      var sel = host.querySelector('.ofv-mois');
      if (sel) sel.onchange = function () { ETAT.mois = sel.value; host.innerHTML = corps(off, glob.WML_OFFICINES || [], ctx); go(); };
      Array.prototype.forEach.call(host.querySelectorAll('a[data-ofv-pid]'), function (a) {
        a.onclick = function (e) { e.preventDefault(); e.stopPropagation(); if (V2.go) V2.go('pharma', a.getAttribute('data-ofv-pid')); };
      });
    };
    go();
  }

  var _css = false;
  function css() {
    if (_css || !glob.document || !glob.document.createElement || !glob.document.head) return;
    _css = true;
    var s = glob.document.createElement('style');
    s.textContent =
      '.ofv{padding-top:6px}' +
      '.ofv-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 14px;margin:8px 0 4px}' +
      '.ofv-lab{font-size:13px;font-weight:600;color:var(--muted)}' +
      '.ofv-mois{margin-left:6px;font:inherit;font-size:14px;font-weight:700;color:var(--ip-ink);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:7px 10px}' +
      '.ofv-qui{font-size:13px;font-weight:600;color:var(--muted)}' +
      '.ofv-h{font-size:14px;font-weight:800;color:var(--ip-ink);margin:20px 0 8px;letter-spacing:-.005em}' +
      '.ofv-h small{font-size:13px;font-weight:500;color:var(--muted);margin-left:6px}' +
      '.ofv-phrase{font-size:14px;color:var(--ip-ink);margin:0 0 8px;line-height:1.5}' +
      '.ofv-note{font-size:13px;color:var(--muted);margin:10px 0 6px;line-height:1.45}' +
      '.ofv-vide{font-size:13px;color:var(--muted);margin:6px 0}' +
      '.ofv-g{border-top:1px solid var(--line)}.ofv-g:last-child{border-bottom:1px solid var(--line)}' +
      '.ofv-row{display:grid;grid-template-columns:26px minmax(0,1fr) auto auto;align-items:baseline;gap:4px 12px;padding:10px 2px;cursor:pointer;list-style:none;font-size:14px}' +
      '.ofv-row::-webkit-details-marker{display:none}' +
      '.ofv-row:hover{background:var(--card-2)}' +
      '.ofv-rang{font-size:13px;font-weight:700;color:var(--muted-2,#6B7280);text-align:right}' +
      '.ofv-n{font-weight:700;color:var(--ip-ink);min-width:0;overflow-wrap:anywhere}' +
      '.ofv-tag{font-style:normal;font-size:13px;font-weight:600;color:var(--muted);margin-left:6px}' +
      '.ofv-v{font-weight:700;color:var(--ip-ink);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}' +
      '.ofv-s{font-size:13px;color:var(--muted);white-space:nowrap}' +
      '.ofv-ph{list-style:none;margin:0 0 10px 38px;padding:0}' +
      '.ofv-ph li{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:baseline;gap:2px 12px;padding:6px 0;font-size:13px;border-top:1px dashed var(--line)}' +
      '.ofv-ph-n{color:var(--ip-ink);font-weight:600;text-decoration:none;overflow-wrap:anywhere}a.ofv-ph-n{color:var(--ip-blue,#0057FF)}' +
      '.ofv-vl{color:var(--muted)}' +
      '@media(max-width:560px){.ofv-row{grid-template-columns:22px minmax(0,1fr) auto}.ofv-s{grid-column:2 / 4}.ofv-ph{margin-left:22px}.ofv-ph li{grid-template-columns:minmax(0,1fr) auto}.ofv-ph .ofv-vl{grid-column:1 / 3;grid-row:2}}';
    glob.document.head.appendChild(s);
  }

  var O = {
    texteFiche: texteFiche, portee: portee, classement: classement, prime: prime, aRelancer: aRelancer,
    bloc: bloc, lier: lier, eur: eur, periode: periode, moisCourt: moisCourt, estHors: estHors,
    choisirMois: function (ym) { ETAT.mois = ym; },
    _reset: function () { ETAT.mois = null; _idx = null; }
  };
  V2.offVentes = O;
  if (typeof module !== 'undefined' && module.exports) module.exports = O;
})(typeof window !== 'undefined' ? window
   : (typeof globalThis !== 'undefined' ? globalThis : this));

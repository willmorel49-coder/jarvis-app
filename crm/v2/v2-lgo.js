/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Logiciels officine (pages.lgo) — 25/09/2026, demande de Will :
   « une feature par LGO où il y a tous les process ».
   Un logiciel = son pas-à-pas d'import côté pharmacien, ses fichiers prêts
   (mode d'emploi PDF + catalogue TOP 200/300/500 en CSV et Excel, dans lgo/)
   et les pharmacies qui l'utilisent. Données : window.LGO_PROCESS
   (lgo-process-data.js, généré par ~/jarvis-catalogues-lgo/process.py depuis
   les mêmes étapes que les PDF). Le logiciel d'une officine est reconnu comme
   dans Transmettre (V2.lgoSlug de v2-pharma.js) : saisie de l'équipe (Infos
   officine, qui fait foi), puis annuaire, puis base clients.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var S = { reseau: false, saisie: null, completer: false };

  // Saisie de l'équipe (profils, scope 'client', champ lgo) : lue une fois pour toutes les
  // officines, puis tenue à jour ici quand on complète depuis la rubrique.
  function chargerSaisie() {
    if (S.saisie || S.charge || !V2.profil || !V2.profil.loadScope) return;
    S.charge = true;
    V2.profil.loadScope('client').then(function (list) {
      var m = {};
      (list || []).forEach(function (r) { var v = r && r.data && String(r.data.lgo || '').trim(); if (v) m[String(r.sid)] = v; });
      S.saisie = m;
      if (V2.route && V2.route.name === 'lgo') V2.render();
    }, function () { S.saisie = {}; });
  }

  function data() { return window.LGO_PROCESS || { lgo: [] }; }
  // Pharmacies par logiciel. Un commercial restreint ne voit que les siennes ;
  // un compte qui voit tout choisit « les miennes » ou « tout le réseau ».
  function repartition() {
    var mes = V2.mesComms ? V2.mesComms() : [];
    var restreint = V2.ventesRestreintes && V2.ventesRestreintes();
    var seulMiennes = restreint || (mes.length && !S.reseau);
    var par = {}, sans = [], autre = 0, autres = {}, total = 0, sai = S.saisie || {};
    (V2.pharmacies || []).forEach(function (p) {
      if (seulMiennes && !(V2.estMonOfficine && V2.estMonOfficine(p))) return;
      total++;
      var ri = V2.rdvInfo ? V2.rdvInfo(p.id) : null;
      var ca = ((window.CLIENTS_ACTIFS || {}).d || {})[String(p.id)];
      var v = sai[String(p.id)], s;
      if (v) {   // la saisie fait foi, même pour un logiciel sans mode d'emploi (Caduciel…)
        s = V2.lgoSlug ? V2.lgoSlug(v) : '';
        if (!s) { autre++; autres[v] = 1; return; }
      } else s = V2.lgoSlug ? (V2.lgoSlug(ri && ri.logiciel) || V2.lgoSlug(ca && ca[5])) : '';
      if (!s) { sans.push(p); return; }
      (par[s] = par[s] || []).push(p);
    });
    var tri = function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); };
    Object.keys(par).forEach(function (k) { par[k].sort(tri); });
    sans.sort(tri);
    return { par: par, sans: sans, autre: autre, autres: Object.keys(autres).sort(), total: total, miennes: !!seulMiennes, choix: !!(mes.length && !restreint) };
  }

  var nf = function (n) { return Number(n || 0).toLocaleString('fr-FR'); };
  var pl = function (n, mot) { return nf(n) + ' ' + mot + (n > 1 ? 's' : ''); };
  // Villes : la source mélange « MARSEILLE » et « Valenciennes » — une seule écriture à l'écran.
  function ville(v) {
    return String(v || '').toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\b(Sur|Sous|En|De|Du|Des|La|Le|Les|Et|Aux?)\b/g, function (m, w, i) { return i ? w.toLowerCase() : w; }).replace(/\bCedex\b.*$/i, '').trim();
  }
  var SVG = {
    loupe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    envoi: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    bas: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>',
    fleche: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>'
  };
  // Une seule couleur : le bleu de la marque, du plus dense (logiciel le plus présent) au plus léger.
  var TEINTES = ['#0050E6', '#3E7DF0', '#7CA7F6', '#A9C6FA', '#CADBFC', '#DDE8FD', '#E7EEFD', '#EEF3FE'];

  // Tête : ce que l'on sait du parc, d'un coup d'œil. La barre a une part par logiciel.
  function couverture(L, R) {
    var connus = 0;
    var parts = L.filter(function (l) { return (R.par[l.s] || []).length; }).map(function (l, i) {
      var n = R.par[l.s].length; connus += n;
      return { nom: l.nom, n: n, c: TEINTES[Math.min(i, TEINTES.length - 1)] };
    });
    connus += R.autre;
    if (R.autre) parts.push({ nom: 'Autres logiciels', n: R.autre, c: '#B9C6DD' });
    if (R.sans.length) parts.push({ nom: 'Logiciel à compléter', n: R.sans.length, c: '', vide: true });
    var pct = R.total ? Math.round(connus * 100 / R.total) : 0;
    return '<div class="lgo-couv">' +
      '<div class="lgo-couv-t"><b class="lgo-big">' + nf(connus) + '</b><span>pharmacie' + (connus > 1 ? 's' : '') + ' dont le logiciel est connu' +
        '<small>sur ' + nf(R.total) + (R.miennes ? ' dans votre secteur' : ' dans le réseau') + ' · ' + pct + ' %</small></span></div>' +
      (!S.saisie ? '<span class="lgo-couv-a lgo-att">Lecture des logiciels saisis par l\'équipe…</span>'
        : R.sans.length ? '<button class="lgo-couv-a" onclick="V2.lgoCompleter()" aria-expanded="' + S.completer + '">' +
            (S.completer ? 'Masquer la liste' : pl(R.sans.length, 'pharmacie') + ' à compléter') + SVG.fleche + '</button>' : '') +
      '<div class="lgo-barre" role="img" aria-label="Répartition des pharmacies par logiciel">' + parts.map(function (x) {
        return '<i class="' + (x.vide ? 'vide' : '') + '" style="flex-grow:' + x.n + (x.c ? ';background:' + x.c : '') + '" title="' + esc(x.nom) + ' : ' + nf(x.n) + '"></i>';
      }).join('') + '</div>' +
      (R.autre ? '<p class="lgo-couv-n">' + pl(R.autre, 'pharmacie') + ' sur un logiciel sans mode d\'emploi pour l\'instant (' + esc(R.autres.join(', ')) + ').</p>' : '') +
    '</div>';
  }

  // Le choix du logiciel : ceux qui ont des pharmacies d'abord, du plus présent au moins présent ;
  // ceux qui n'en ont pas restent accessibles, en une ligne discrète.
  function choix(L, R, cur) {
    var max = Math.max.apply(null, L.map(function (l) { return (R.par[l.s] || []).length; }).concat([1]));
    var avec = L.filter(function (l) { return (R.par[l.s] || []).length; }), sansPh = L.filter(function (l) { return !(R.par[l.s] || []).length; });
    var go = function (l) { return ' aria-pressed="' + (l === cur) + '" onclick="V2.go(\'lgo\',\'' + l.s + '\')"'; };
    return (avec.length ? '<div class="lgo-choix">' + avec.map(function (l, i) {
        var n = R.par[l.s].length;
        return '<button class="lgo-c' + (l === cur ? ' on' : '') + '"' + go(l) + '>' +
          '<span class="lgo-c-h"><b>' + esc(l.nom) + '</b><small>' + esc(l.editeur || '') + '</small></span>' +
          '<span class="lgo-cn"><b>' + nf(n) + '</b> pharmacie' + (n > 1 ? 's' : '') + '</span>' +
          '<span class="lgo-c-b"><i style="width:' + Math.max(4, Math.round(n * 100 / max)) + '%;background:' + TEINTES[Math.min(i, TEINTES.length - 1)] + '"></i></span></button>';
      }).join('') + '</div>' : '') +
      (sansPh.length ? '<div class="lgo-zero"><span>' + (avec.length ? 'Aucune pharmacie pour l\'instant, mode d\'emploi prêt :' : 'Modes d\'emploi prêts :') + '</span>' + sansPh.map(function (l) {
        return '<button class="' + (l === cur ? 'on' : '') + '"' + go(l) + '>' + esc(l.nom) + '</button>';
      }).join('') + '</div>' : '');
  }

  function fichiers(l) {
    var tailles = data().tailles || [200, 300, 500];
    return '<div class="lgo-bloc"><h2>Les fichiers prêts</h2>' +
      '<a class="lgo-pdf" href="lgo/tuto-' + l.s + '.pdf" target="_blank" rel="noopener">' +
        '<span class="lgo-pdf-ico">PDF</span><span><b>Mode d\'emploi ' + esc(l.nom) + '</b><small>À joindre au mail, ou à lire avec le pharmacien</small></span>' + SVG.fleche + '</a>' +
      '<div class="lgo-tab"><div class="lgo-tab-h"><span>Catalogue</span><span>À importer</span><span>À consulter</span></div>' + tailles.map(function (n) {
        var b = 'lgo/integral-top' + n + '-' + l.s;
        return '<div class="lgo-tab-l"><span class="lgo-top">TOP ' + n + (n === 300 ? '<em>par défaut</em>' : '') + '</span>' +
          '<a class="csv" href="' + b + '.csv" download aria-label="TOP ' + n + ' en CSV, à importer">' + SVG.bas + 'CSV</a>' +
          '<a href="' + b + '.xlsx" download aria-label="TOP ' + n + ' en Excel, à consulter">' + SVG.bas + 'Excel</a></div>';
      }).join('') + '</div>' +
      '<p class="lgo-mini">Produits les plus commandés du réseau (' + esc(data().periode || '') + '), hors génériques. ' +
        'Le CSV est au format exact du logiciel (colonnes, ordre, décimales), au prix net ; l\'Excel a les mêmes colonnes avec une ligne de titre.</p>' +
    '</div>';
  }

  function recherche(cible, n, quoi) {
    return n > 8 ? '<label class="lgo-rech">' + SVG.loupe + '<input type="search" placeholder="Nom, ville…" aria-label="Chercher ' + quoi + '" autocomplete="off" oninput="V2.lgoFiltrer(this,\'' + cible + '\')"></label>' : '';
  }

  function pharmas(l, R) {
    var list = R.par[l.s] || [];
    var titre = (R.miennes ? 'Vos pharmacies' : 'Pharmacies du réseau') + ' sur ' + esc(l.nom);
    var peutEnvoyer = !!V2.pharmaTxCatalogue;
    var corps = list.length
      ? recherche('lgo-ph', list.length, 'une pharmacie') +
        (peutEnvoyer ? '<p class="lgo-mini lgo-ph-t">« Envoyer » ouvre le mail avec le mode d\'emploi et le catalogue ' + esc(l.nom) + ' déjà cochés.</p>' : '') +
        '<div class="lgo-ph" id="lgo-ph">' + list.map(function (p) {
          var id = esc(p.id);
          return '<div class="lgo-ph-r" data-q="' + esc((p.name + ' ' + (p.ville || '') + ' ' + (p.cp || '')).toLowerCase()) + '">' +
            '<a onclick="V2.go(\'pharma\',\'' + id + '\')"><span>' + esc(p.name) + '</span><small>' + esc(ville(p.ville)) + '</small></a>' +
            (peutEnvoyer ? '<button onclick="V2.lgoEnvoyer(\'' + id + '\',\'' + l.s + '\')" aria-label="Envoyer le catalogue à ' + esc(p.name) + '">' + SVG.envoi + '<span>Envoyer</span></button>' : '') +
          '</div>';
        }).join('') + '<p class="lgo-vide" hidden>Aucune pharmacie ne correspond.</p></div>'
      : '<p class="lgo-mini">Aucune pour l\'instant.</p>';
    return '<div class="lgo-bloc"><h2>' + titre + ' <span class="lgo-n">' + nf(list.length) + '</span></h2>' + corps + '</div>';
  }

  // Pharmacies sans logiciel connu : on le renseigne ici, et c'est enregistré dans leur fiche
  // (Infos officine › Logiciel), comme si on l'avait saisi là-bas. Rien n'est deviné.
  function aCompleter(R) {
    var opts = '<option value="">Choisir…</option>' + ((V2.profil && V2.profil.LGO) || []).map(function (o) {
      return '<option>' + esc(o) + '</option>';
    }).join('');
    return '<div class="lgo-bloc lgo-ac"><h2>À compléter <span class="lgo-n">' + nf(R.sans.length) + '</span></h2>' +
      '<p class="lgo-mini lgo-ac-t">Le logiciel choisi s\'enregistre dans la fiche de la pharmacie (Infos officine), pour toute l\'équipe.</p>' +
      recherche('lgo-ac-l', R.sans.length, 'une pharmacie à compléter') +
      '<div class="lgo-ac-l" id="lgo-ac-l">' + R.sans.map(function (p) {
        return '<div class="lgo-ac-r" data-q="' + esc((p.name + ' ' + (p.ville || '') + ' ' + (p.cp || '')).toLowerCase()) + '"><a onclick="V2.go(\'pharma\',\'' + esc(p.id) + '\')"><span>' + esc(p.name) + '</span><small>' + esc(ville(p.ville)) + '</small></a>' +
          '<select aria-label="Logiciel de ' + esc(p.name) + '" data-pid="' + esc(p.id) + '" onchange="V2.lgoPoser(this)">' + opts + '</select></div>';
      }).join('') + '<p class="lgo-vide" hidden>Aucune pharmacie ne correspond.</p></div></div>';
  }

  function etapes(l) {
    return '<div class="lgo-bloc lgo-pas"><h2>Le pas-à-pas, côté pharmacien <span class="lgo-n">' + pl(l.etapes.length, 'étape') + '</span></h2>' +
      '<ol>' + l.etapes.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ol>' +   // HTML de confiance (tutos.py)
      (l.note ? '<div class="lgo-note">' + l.note + '</div>' : '') +
      (l.img && l.img.length ? '<div class="lgo-img">' + l.img.map(function (src) {
        return '<a href="' + src + '" target="_blank" rel="noopener"><img src="' + src + '" alt="Capture de l\'écran ' + esc(l.nom) + '" loading="lazy"></a>';
      }).join('') + '</div>' : '') +
    '</div>';
  }

  function css() {
    if (document.getElementById('v2-lgo-css')) return;
    var s = document.createElement('style'); s.id = 'v2-lgo-css';
    s.textContent = [
      '.lgo-hero{position:relative;overflow:hidden;border-radius:22px;padding:26px 28px 24px;margin-bottom:16px;background:linear-gradient(180deg,#fff,#F8FAFF);border:1px solid #DCE5F5;box-shadow:0 1px 0 #fff inset,0 18px 40px -26px rgba(0,52,160,.35)}',
      '.lgo-hero:before{content:"";position:absolute;right:-110px;top:-150px;width:460px;height:460px;border-radius:50%;background:radial-gradient(circle,rgba(76,130,245,.30),rgba(76,130,245,0) 68%);pointer-events:none}',
      '.lgo-hero>*{position:relative}',
      '.lgo-hero-h{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}',
      '.lgo-hero h1{margin:0 0 4px;font-size:26px;font-weight:800;letter-spacing:-.02em;color:#0B1B3A}',
      '.lgo-hero p{margin:0;color:#475569;font-size:15px;max-width:560px}',
      '.lgo-sw{display:inline-flex;background:#EEF3FC;border-radius:999px;padding:3px}',
      '.lgo-sw button{border:0;background:none;padding:7px 14px;border-radius:999px;font:inherit;font-size:13px;font-weight:600;color:#475569;cursor:pointer;min-height:44px}',
      '.lgo-sw button.on{background:#fff;color:#0034A0;box-shadow:0 1px 3px rgba(0,52,160,.18)}',
      '.lgo-couv{margin-top:20px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px 16px;align-items:end}',
      '.lgo-couv-t{display:flex;align-items:baseline;gap:12px;min-width:0}',
      '.lgo-big{font-size:44px;line-height:1;font-weight:800;letter-spacing:-.03em;color:#0B1B3A;font-variant-numeric:tabular-nums}',
      '.lgo-couv-t span{font-size:15px;font-weight:600;color:#0B1B3A;line-height:1.3}.lgo-couv-t small{display:block;font-size:13px;font-weight:500;color:#586377;font-variant-numeric:tabular-nums}',
      '.lgo-couv-a{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #C9D9F8;background:#fff;color:#0034A0;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 6px 16px -12px rgba(0,52,160,.6);transition:border-color .15s,transform .15s}',
      'button.lgo-couv-a:hover{border-color:#0050E6;transform:translateY(-1px)}button.lgo-couv-a svg{transition:transform .2s}button.lgo-couv-a[aria-expanded="true"] svg{transform:rotate(90deg)}',
      '.lgo-att{border-style:dashed;color:#586377;font-weight:600;cursor:default;box-shadow:none}',
      '.lgo-barre{grid-column:1/-1;display:flex;gap:3px;height:14px}',
      '.lgo-barre i{display:block;min-width:5px;border-radius:5px;transform-origin:left center}',
      '.lgo-barre i:first-child{border-radius:7px 5px 5px 7px}.lgo-barre i:last-child{border-radius:5px 7px 7px 5px}',
      '.lgo-barre i.vide{background:repeating-linear-gradient(135deg,#EDF1F8 0 5px,#DFE6F2 5px 10px)}',
      '.lgo-couv-n{grid-column:1/-1;margin:-4px 0 0;font-size:13px;color:#586377;max-width:none}',
      '.lgo-choix{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:12px}',
      '.lgo-c{display:flex;flex-direction:column;gap:8px;text-align:left;border:1px solid #DCE5F5;background:#fff;border-radius:16px;padding:13px 14px 12px;font:inherit;cursor:pointer;min-height:64px;transition:border-color .15s,box-shadow .2s,transform .2s}',
      '.lgo-c:hover{border-color:#9BC0FF;transform:translateY(-1px)}',
      '.lgo-c.on{border-color:#0050E6;box-shadow:0 0 0 3px rgba(0,80,230,.14),0 14px 28px -18px rgba(0,52,160,.55)}',
      '.lgo-c-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px}',
      '.lgo-c-h b{font-size:15.5px;color:#0B1B3A}.lgo-c-h small{font-size:13px;color:#586377;white-space:nowrap}',
      '.lgo-cn{font-size:13px;color:#475569}.lgo-cn b{font-size:20px;font-weight:800;letter-spacing:-.02em;color:#0034A0;font-variant-numeric:tabular-nums;margin-right:2px}',
      '.lgo-c-b{display:block;height:5px;border-radius:5px;background:#EEF3FC;overflow:hidden}.lgo-c-b i{display:block;height:100%;border-radius:5px;transform-origin:left center}',
      '.lgo-zero{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 18px;font-size:13px;color:#586377}',
      '.lgo-zero button{min-height:44px;padding:0 14px;border-radius:999px;border:1px solid #DCE5F5;background:#fff;font:inherit;font-size:13.5px;font-weight:600;color:#334155;cursor:pointer;transition:border-color .15s}',
      '.lgo-zero button:hover{border-color:#9BC0FF}.lgo-zero button.on{border-color:#0050E6;color:#0034A0;box-shadow:0 0 0 3px rgba(0,80,230,.14)}',
      '.lgo-fiche-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:22px 2px 12px}',
      '.lgo-fiche-h h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em;color:#0B1B3A}.lgo-fiche-h span{font-size:14px;color:#586377;font-variant-numeric:tabular-nums}',
      '.lgo-grille{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:16px;align-items:start}',
      '.lgo-bloc{background:#fff;border:1px solid #DCE5F5;border-radius:18px;padding:18px 20px;margin-bottom:16px}',
      '.lgo-bloc h2{margin:0 0 12px;font-size:16px;font-weight:800;color:#0B1B3A;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.lgo-n{font-size:13px;font-weight:700;color:#0034A0;background:#E1EBFF;border-radius:999px;padding:2px 9px;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.lgo-pas ol{list-style:none;counter-reset:e;margin:0;padding:0}',
      '.lgo-pas li{counter-increment:e;position:relative;padding:4px 0 20px 44px;font-size:14.5px;line-height:1.55;color:#1b2430}',
      '.lgo-pas li:last-child{padding-bottom:4px}',
      '.lgo-pas li:before{content:counter(e);position:absolute;z-index:1;left:0;top:0;width:30px;height:30px;border-radius:50%;background:linear-gradient(150deg,#2F6DF0,#0050E6 55%,#0034A0);box-shadow:0 6px 12px -6px rgba(0,52,160,.7);color:#fff;font-weight:800;font-size:13.5px;display:flex;align-items:center;justify-content:center}',
      '.lgo-pas li:after{content:"";position:absolute;left:14px;top:32px;bottom:2px;width:2px;border-radius:2px;background:#DCE7FB}.lgo-pas li:last-child:after{display:none}',
      '.lgo-pas li b{color:#0B1B3A}',
      '.lgo-note{margin-top:14px;background:#F3F7FF;border-radius:12px;padding:11px 13px;font-size:13.5px;color:#334155}',
      '.lgo-img{display:grid;gap:10px;margin-top:14px}.lgo-img img{width:100%;border:1px solid #DCE5F5;border-radius:10px;display:block}',
      '.lgo-pdf{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #DCE5F5;border-radius:14px;text-decoration:none;color:#0B1B3A;margin-bottom:14px;transition:border-color .15s,box-shadow .2s}',
      '.lgo-pdf:hover{border-color:#9BC0FF;box-shadow:0 10px 22px -18px rgba(0,52,160,.6)}.lgo-pdf>span:nth-child(2){flex:1;min-width:0}.lgo-pdf b{display:block;font-size:14.5px}.lgo-pdf small{font-size:13px;color:#586377}',
      '.lgo-pdf>svg{flex:none;color:#0050E6;transition:transform .2s}.lgo-pdf:hover>svg{transform:translateX(3px)}',
      '.lgo-pdf-ico{flex:none;width:40px;height:40px;border-radius:10px;background:#C8102E;color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}',
      '.lgo-tab-h,.lgo-tab-l{display:grid;grid-template-columns:minmax(0,1fr) 92px 92px;gap:8px;align-items:center}',
      '.lgo-tab-h{font-size:13px;font-weight:600;color:#586377;padding-bottom:4px}.lgo-tab-h span+span{text-align:center}',
      '.lgo-tab-l{padding:6px 0;border-top:1px solid #EDF1F8}',
      '.lgo-top{font-weight:700;font-size:14px;color:#0B1B3A;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.lgo-top em{font-style:normal;font-size:13px;font-weight:700;color:#0034A0;background:#E1EBFF;border-radius:999px;padding:1px 8px}',
      '.lgo-tab-l a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;background:#EEF3FC;color:#0034A0;font-weight:700;font-size:13px;text-decoration:none;transition:background .15s,transform .15s}',
      '.lgo-tab-l a:hover{background:#DCE7FF;transform:translateY(-1px)}',
      '.lgo-tab-l a.csv{background:#0050E6;color:#fff}.lgo-tab-l a.csv:hover{background:#0034A0}',
      '.lgo-mini{font-size:13px;color:#586377;margin:10px 0 0}',
      '.lgo-rech{display:flex;align-items:center;gap:8px;border:1px solid #C9D6EE;border-radius:12px;padding:0 12px;background:#fff;color:#586377;transition:border-color .15s,box-shadow .15s}',
      '.lgo-rech:focus-within{border-color:#0050E6;box-shadow:0 0 0 3px rgba(0,80,230,.14)}',
      '.lgo-rech input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:16px;color:#0B1B3A;min-height:44px;-webkit-appearance:none;appearance:none}',
      '.lgo-ph-t{margin:8px 0 4px}',
      '.lgo-ph{display:flex;flex-direction:column;max-height:640px;overflow:auto;margin:6px -6px 0}',
      '.lgo-ph-r{display:flex;align-items:center;gap:8px;padding:2px 6px;border-radius:10px}.lgo-ph-r:hover{background:#F3F7FF}',
      '.lgo-ph-r[hidden],.lgo-ac-r[hidden]{display:none}',
      '.lgo-ph-r a{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;cursor:pointer;font-size:14px;color:#0B1B3A;min-height:48px}',
      '.lgo-ph-r a span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.lgo-ph-r small{color:#586377;font-size:13px}',
      '.lgo-ph-r button{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid #DCE5F5;background:#fff;color:#0034A0;font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s,border-color .15s,color .15s}',
      '.lgo-ph-r button:hover{background:#0050E6;border-color:#0050E6;color:#fff}',
      '.lgo-vide{margin:14px 6px;font-size:13.5px;color:#586377}',
      '.lgo-ac{border-color:#C9D9F8;box-shadow:0 14px 30px -24px rgba(0,52,160,.5)}',
      '.lgo-ac-t{margin:-4px 0 10px}',
      '.lgo-ac-l{display:flex;flex-direction:column;max-height:480px;overflow:auto;margin:6px -6px 0}',
      '.lgo-ac-r{display:flex;align-items:center;gap:10px;padding:5px 6px;border-bottom:1px solid #EDF1F8}.lgo-ac-r:last-of-type{border-bottom:0}',
      '.lgo-ac-r a{flex:1;min-width:0;display:flex;flex-direction:column;cursor:pointer;font-size:14px;color:#0B1B3A;min-height:44px;justify-content:center}',
      '.lgo-ac-r a span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.lgo-ac-r small{color:#586377;font-size:13px}',
      '.lgo-ac-r select{flex:none;width:150px;height:44px;border:1px solid #C9D6EE;border-radius:10px;padding:6px 9px;font:inherit;font-size:16px;color:#0B1B3A;background:#fff;cursor:pointer}',
      '.lgo-hero :focus-visible,.lgo-choix :focus-visible,.lgo-zero :focus-visible,.lgo-bloc a:focus-visible,.lgo-bloc button:focus-visible{outline:2px solid #0050E6;outline-offset:2px}',
      '@keyframes lgo-monte{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
      '@keyframes lgo-pousse{from{transform:scaleX(0)}to{transform:none}}',
      '.lgo-in .lgo-fiche-h,.lgo-in .lgo-bloc{animation:lgo-monte .34s cubic-bezier(.2,.7,.2,1) both}',
      '.lgo-in .lgo-grille>div:last-child .lgo-bloc{animation-delay:.06s}',
      '.lgo-neuf .lgo-barre i,.lgo-neuf .lgo-c-b i{animation:lgo-pousse .7s cubic-bezier(.2,.7,.2,1) both}',
      '@media (max-width:860px){.lgo-grille{grid-template-columns:minmax(0,1fr)}.lgo-hero{padding:20px 18px}.lgo-hero h1{font-size:22px}.lgo-choix{grid-template-columns:repeat(2,minmax(0,1fr))}.lgo-c:last-child:nth-child(odd){grid-column:1/-1}' +
        '.lgo-couv{grid-template-columns:minmax(0,1fr)}.lgo-big{font-size:36px}.lgo-couv-a{justify-self:start}.lgo-c-h{flex-direction:column;gap:0}.lgo-fiche-h{margin-top:18px}.lgo-fiche-h h2{font-size:20px}}',
      '@media (max-width:420px){.lgo-tab-h,.lgo-tab-l{grid-template-columns:minmax(0,1fr) 78px 78px}.lgo-ph-r button span{display:none}.lgo-ph-r button{width:44px;padding:0;justify-content:center}.lgo-ac-r select{width:128px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  V2.lgoReseau = function (v) { S.reseau = !!v; V2.render(); };
  V2.lgoCompleter = function () { S.completer = !S.completer; V2.render(); };
  V2.lgoPoser = function (el) {
    var pid = el.getAttribute('data-pid'), v = el.value;
    if (!v || !pid || !V2.profil || !V2.profil.poser) return;
    if (!V2.user) { if (V2.toast) V2.toast('Connecte-toi pour enregistrer'); el.value = ''; return; }
    el.disabled = true;
    V2.profil.poser('client', pid, 'lgo', v).then(function () {
      (S.saisie = S.saisie || {})[pid] = v;
      if (V2.toast) V2.toast('Enregistré : ' + v);
      var l = document.querySelector('.lgo-ac-l'), y = l ? l.scrollTop : 0, wy = window.scrollY;
      V2.render();   // la pharmacie quitte la liste et rejoint son logiciel
      var l2 = document.querySelector('.lgo-ac-l'); if (l2) l2.scrollTop = y;
      window.scrollTo(0, wy);
    }, function () { el.disabled = false; if (V2.toast) V2.toast('Enregistrement impossible — réessaie', 'error'); });
  };
  // Filtre sur place : rien n'est redessiné, les lignes qui ne correspondent pas sont masquées.
  V2.lgoFiltrer = function (el, cible) {
    var q = String(el.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    var box = document.getElementById(cible); if (!box) return;
    var vus = 0;
    [].forEach.call(box.querySelectorAll('[data-q]'), function (r) {
      var t = r.getAttribute('data-q'), okk = q.every(function (m) { return t.indexOf(m) >= 0; });
      r.hidden = !okk; if (okk) vus++;
    });
    var v = box.querySelector('.lgo-vide'); if (v) v.hidden = vus > 0;
  };
  // Ouvre « Choisir quoi lui transmettre » pour cette pharmacie, catalogue du logiciel déjà coché.
  V2.lgoEnvoyer = function (pid, s) { if (V2.pharmaTxCatalogue) V2.pharmaTxCatalogue(pid, s); };

  V2.pages.lgo = {
    needs: ['clientsactifs'],
    render: function (root, param) {
      if (window.V2_BRAND && (window.V2_BRAND.escale || window.V2_BRAND.opso)) { V2.go('home'); return; }   // rubrique Intégral seulement
      css();
      chargerSaisie();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      var L0 = data().lgo || [];
      if (!L0.length) { root.innerHTML = top + '<div class="v2-wrap"><div class="v2-empty"><div class="v2-empty-t">Données des logiciels indisponibles</div></div></div>'; return; }
      var R = repartition();
      var L = L0.slice().sort(function (a, b) { return (R.par[b.s] || []).length - (R.par[a.s] || []).length; });   // tri stable : le plus présent d'abord
      var cur = L.filter(function (l) { return l.s === param; })[0] || L[0];   // sans choix : le logiciel le plus présent
      var n = (R.par[cur.s] || []).length;
      // Le mouvement ne se joue que quand quelque chose change vraiment (pas à chaque redessin).
      var cle = cur.s + '|' + R.miennes, neuf = !S.vu, change = S.vu !== cle; S.vu = cle;
      root.innerHTML = top + '<div class="v2-wrap' + (neuf ? ' lgo-neuf' : '') + (change ? ' lgo-in' : '') + '">' +
        '<div class="lgo-hero"><div class="lgo-hero-h"><div><h1>Logiciels officine</h1>' +
          '<p>Le catalogue Intégral, prêt à importer dans le logiciel de chaque pharmacie.</p></div>' +
          (R.choix ? '<div class="lgo-sw" role="group" aria-label="Pharmacies comptées"><button class="' + (R.miennes ? 'on' : '') + '" aria-pressed="' + R.miennes + '" onclick="V2.lgoReseau(false)">Mes pharmacies</button>' +
            '<button class="' + (R.miennes ? '' : 'on') + '" aria-pressed="' + !R.miennes + '" onclick="V2.lgoReseau(true)">Tout le réseau</button></div>' : '') +
          '</div>' + couverture(L, R) +
        '</div>' +
        (S.saisie && S.completer && R.sans.length ? aCompleter(R) : '') +
        choix(L, R, cur) +
        '<div class="lgo-fiche-h"><h2>' + esc(cur.nom) + '</h2><span>' + (cur.editeur ? esc(cur.editeur) + ' · ' : '') +
          (n ? pl(n, 'pharmacie') + (R.total ? ' · ' + Math.max(1, Math.round(n * 100 / R.total)) + ' % ' + (R.miennes ? 'de votre secteur' : 'du réseau') : '') : 'aucune pharmacie pour l\'instant') + '</span></div>' +
        '<div class="lgo-grille"><div>' + etapes(cur) + fichiers(cur) + '</div><div>' + pharmas(cur, R) + '</div></div>' +
      '</div>';
    }
  };
})();

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

  function fichiers(l) {
    var tailles = data().tailles || [200, 300, 500];
    return '<div class="lgo-bloc"><h2>Les fichiers prêts</h2>' +
      '<a class="lgo-pdf" href="lgo/tuto-' + l.s + '.pdf" target="_blank" rel="noopener">' +
        '<span class="lgo-pdf-ico">PDF</span><span><b>Mode d\'emploi ' + esc(l.nom) + '</b><small>À joindre au mail, ou à lire avec le pharmacien</small></span></a>' +
      '<div class="lgo-tab">' + tailles.map(function (n) {
        var b = 'lgo/integral-top' + n + '-' + l.s;
        return '<div class="lgo-tab-l"><span class="lgo-top">TOP ' + n + '</span>' +
          '<a href="' + b + '.csv" download>CSV</a><a href="' + b + '.xlsx" download>Excel</a></div>';
      }).join('') + '</div>' +
      '<p class="lgo-mini">Produits les plus commandés du réseau (' + esc(data().periode || '') + '), hors génériques. ' +
        'Le CSV s\'importe ; l\'Excel a les mêmes colonnes, pour consulter.</p>' +
      '<div class="lgo-envoi"><b>Pour l\'envoyer à une pharmacie</b>' +
        '<span>Sa fiche › « Choisir quoi lui transmettre » › <i>Catalogue pour son logiciel</i> : les trois pièces partent ensemble.</span></div>' +
    '</div>';
  }

  function pharmas(l, R) {
    var list = R.par[l.s] || [];
    var titre = (R.miennes ? 'Vos pharmacies' : 'Pharmacies du réseau') + ' sur ' + esc(l.nom);
    var corps = list.length
      ? '<div class="lgo-ph">' + list.map(function (p) {
          return '<a onclick="V2.go(\'pharma\',\'' + esc(p.id) + '\')"><span>' + esc(p.name) + '</span><small>' + esc(p.ville || '') + '</small></a>';
        }).join('') + '</div>'
      : '<p class="lgo-mini">Aucune pour l\'instant.</p>';
    return '<div class="lgo-bloc"><h2>' + titre + ' <span class="lgo-n">' + list.length + '</span></h2>' + corps + '</div>';
  }

  // Pharmacies sans logiciel connu : on le renseigne ici, et c'est enregistré dans leur fiche
  // (Infos officine › Logiciel), comme si on l'avait saisi là-bas. Rien n'est deviné.
  function aCompleter(R) {
    var opts = '<option value="">Choisir…</option>' + ((V2.profil && V2.profil.LGO) || []).map(function (o) {
      return '<option>' + esc(o) + '</option>';
    }).join('');
    return '<div class="lgo-bloc lgo-ac"><h2>À compléter <span class="lgo-n">' + R.sans.length + '</span></h2>' +
      '<p class="lgo-mini lgo-ac-t">Le logiciel choisi s\'enregistre dans la fiche de la pharmacie (Infos officine), pour toute l\'équipe.</p>' +
      '<div class="lgo-ac-l">' + R.sans.map(function (p) {
        return '<div class="lgo-ac-r"><a onclick="V2.go(\'pharma\',\'' + esc(p.id) + '\')"><span>' + esc(p.name) + '</span><small>' + esc(p.ville || '') + '</small></a>' +
          '<select aria-label="Logiciel de ' + esc(p.name) + '" data-pid="' + esc(p.id) + '" onchange="V2.lgoPoser(this)">' + opts + '</select></div>';
      }).join('') + '</div></div>';
  }

  function etapes(l) {
    return '<div class="lgo-bloc lgo-pas"><h2>Le pas-à-pas, côté pharmacien</h2>' +
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
      '.lgo-hero{position:relative;overflow:hidden;border-radius:22px;padding:26px 26px 22px;margin-bottom:18px;background:#fff;border:1px solid #DCE5F5;box-shadow:0 1px 0 #fff inset,0 18px 40px -26px rgba(0,52,160,.35)}',
      '.lgo-hero:before{content:"";position:absolute;right:-90px;top:-120px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(76,130,245,.28),rgba(76,130,245,0) 70%);pointer-events:none}',
      '.lgo-hero h1{position:relative;margin:0 0 6px;font-size:26px;font-weight:800;letter-spacing:-.02em;color:#0B1B3A}',
      '.lgo-hero p{position:relative;margin:0;color:#475569;font-size:15px;max-width:620px}',
      '.lgo-sw{position:relative;display:inline-flex;margin-top:14px;background:#EEF3FC;border-radius:999px;padding:3px}',
      '.lgo-sw button{border:0;background:none;padding:7px 14px;border-radius:999px;font:inherit;font-size:13px;font-weight:600;color:#475569;cursor:pointer;min-height:36px}',
      '.lgo-sw button.on{background:#fff;color:#0034A0;box-shadow:0 1px 3px rgba(0,52,160,.18)}',
      '.lgo-choix{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:20px}',
      '.lgo-c{display:flex;flex-direction:column;gap:2px;text-align:left;border:1px solid #DCE5F5;background:#fff;border-radius:16px;padding:13px 14px;font:inherit;cursor:pointer;min-height:64px;transition:border-color .15s,box-shadow .15s}',
      '.lgo-c:hover{border-color:#9BC0FF}',
      '.lgo-c.on{border-color:#0050E6;box-shadow:0 0 0 3px rgba(0,80,230,.14),0 12px 26px -18px rgba(0,52,160,.5)}',
      '.lgo-c b{font-size:15px;color:#0B1B3A}.lgo-c small{font-size:12.5px;color:#586377}',
      '.lgo-c .lgo-cn{font-size:12.5px;color:#0050E6;font-weight:700}',
      '.lgo-inconnu{margin:-8px 0 18px;font-size:13px;color:#586377}',
      '.lgo-grille{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start}',
      '.lgo-bloc{background:#fff;border:1px solid #DCE5F5;border-radius:18px;padding:18px 20px;margin-bottom:16px}',
      '.lgo-bloc h2{margin:0 0 12px;font-size:16px;font-weight:800;color:#0B1B3A;display:flex;align-items:center;gap:8px}',
      '.lgo-n{font-size:12.5px;font-weight:700;color:#0034A0;background:#E1EBFF;border-radius:999px;padding:2px 9px}',
      '.lgo-pas ol{list-style:none;counter-reset:e;margin:0;padding:0}',
      '.lgo-pas li{counter-increment:e;position:relative;padding:10px 0 10px 42px;border-bottom:1px solid #EDF1F8;font-size:14.5px;line-height:1.55;color:#1b2430}',
      '.lgo-pas li:last-child{border-bottom:0}',
      '.lgo-pas li:before{content:counter(e);position:absolute;left:0;top:9px;width:28px;height:28px;border-radius:50%;background:#0050E6;color:#fff;font-weight:800;font-size:13.5px;display:flex;align-items:center;justify-content:center}',
      '.lgo-note{margin-top:12px;background:#F3F7FF;border-left:3px solid #0050E6;border-radius:8px;padding:10px 12px;font-size:13.5px;color:#334155}',
      '.lgo-img{display:grid;gap:10px;margin-top:14px}.lgo-img img{width:100%;border:1px solid #DCE5F5;border-radius:10px;display:block}',
      '.lgo-pdf{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #DCE5F5;border-radius:14px;text-decoration:none;color:#0B1B3A;margin-bottom:12px}',
      '.lgo-pdf:hover{border-color:#9BC0FF}.lgo-pdf b{display:block;font-size:14.5px}.lgo-pdf small{font-size:12.5px;color:#586377}',
      '.lgo-pdf-ico{flex:none;width:40px;height:40px;border-radius:10px;background:#C8102E;color:#fff;font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center}',
      '.lgo-tab-l{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #EDF1F8}.lgo-tab-l:last-child{border-bottom:0}',
      '.lgo-top{flex:1;font-weight:700;font-size:14px;color:#0B1B3A}',
      '.lgo-tab-l a{min-width:64px;min-height:36px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;background:#EEF3FC;color:#0034A0;font-weight:700;font-size:13px;text-decoration:none}',
      '.lgo-tab-l a:hover{background:#DCE7FF}',
      '.lgo-mini{font-size:13px;color:#586377;margin:10px 0 0}',
      '.lgo-envoi{margin-top:12px;display:flex;flex-direction:column;gap:3px;background:#F3F7FF;border-radius:12px;padding:11px 13px;font-size:13.5px;color:#334155}.lgo-envoi b{color:#0B1B3A}',
      '.lgo-ph{display:flex;flex-direction:column;max-height:420px;overflow:auto;margin:0 -6px}',
      '.lgo-ph a{display:flex;justify-content:space-between;gap:10px;padding:9px 6px;border-radius:8px;cursor:pointer;font-size:14px;color:#0B1B3A;min-height:40px;align-items:center}',
      '.lgo-ph a:hover{background:#F3F7FF}.lgo-ph small{color:#586377;font-size:12.5px;white-space:nowrap}',
      '.lgo-inconnu button{border:0;background:none;padding:0 0 0 4px;font:inherit;font-weight:700;color:#0050E6;cursor:pointer;text-decoration:underline;text-underline-offset:3px;min-height:36px}',
      '.lgo-ac-t{margin:-4px 0 10px}',
      '.lgo-ac-l{display:flex;flex-direction:column;max-height:480px;overflow:auto;margin:0 -6px}',
      '.lgo-ac-r{display:flex;align-items:center;gap:10px;padding:5px 6px;border-bottom:1px solid #EDF1F8}.lgo-ac-r:last-child{border-bottom:0}',
      '.lgo-ac-r a{flex:1;min-width:0;display:flex;flex-direction:column;cursor:pointer;font-size:14px;color:#0B1B3A;min-height:40px;justify-content:center}',
      '.lgo-ac-r a span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lgo-ac-r small{color:#586377;font-size:12.5px}',
      '.lgo-ac-r select{flex:none;width:150px;min-height:40px;border:1px solid #C9D6EE;border-radius:10px;padding:6px 9px;font:inherit;font-size:16px;color:#0B1B3A;background:#fff;cursor:pointer}',
      '@media (max-width:860px){.lgo-choix{grid-template-columns:repeat(2,minmax(0,1fr))}.lgo-grille{grid-template-columns:minmax(0,1fr)}.lgo-hero{padding:20px 18px}.lgo-hero h1{font-size:22px}}'
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

  V2.pages.lgo = {
    needs: ['clientsactifs'],
    render: function (root, param) {
      css();
      chargerSaisie();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      var L = data().lgo || [];
      if (!L.length) { root.innerHTML = top + '<div class="v2-wrap"><div class="v2-empty"><div class="v2-empty-t">Données des logiciels indisponibles</div></div></div>'; return; }
      var R = repartition();
      var cur = L.filter(function (l) { return l.s === param; })[0];
      if (!cur) {   // sans choix : le logiciel le plus présent
        cur = L.slice().sort(function (a, b) { return (R.par[b.s] || []).length - (R.par[a.s] || []).length; })[0];
      }
      root.innerHTML = top + '<div class="v2-wrap">' +
        '<div class="lgo-hero"><h1>Logiciels officine</h1>' +
          '<p>Pour chaque logiciel : comment la pharmacie importe le catalogue Intégral, les fichiers prêts à envoyer, et les pharmacies qui l\'utilisent.</p>' +
          (R.choix ? '<div class="lgo-sw" role="group" aria-label="Pharmacies comptées"><button class="' + (R.miennes ? 'on' : '') + '" onclick="V2.lgoReseau(false)">Mes pharmacies</button>' +
            '<button class="' + (R.miennes ? '' : 'on') + '" onclick="V2.lgoReseau(true)">Tout le réseau</button></div>' : '') +
        '</div>' +
        '<div class="lgo-choix">' + L.map(function (l) {
          var n = (R.par[l.s] || []).length;
          return '<button class="lgo-c' + (l === cur ? ' on' : '') + '" aria-pressed="' + (l === cur) + '" onclick="V2.go(\'lgo\',\'' + l.s + '\')">' +
            '<b>' + esc(l.nom) + '</b><small>' + esc(l.editeur || ' ') + '</small>' +
            '<span class="lgo-cn">' + n + ' pharmacie' + (n > 1 ? 's' : '') + '</span></button>';
        }).join('') + '</div>' +
        (!S.saisie ? '<p class="lgo-inconnu">Lecture des logiciels saisis par l\'équipe…</p>'
          : R.sans.length ? '<p class="lgo-inconnu">' + R.sans.length + ' pharmacie' + (R.sans.length > 1 ? 's' : '') + ' sur ' + R.total + ' sans logiciel connu.' +
              '<button onclick="V2.lgoCompleter()" aria-expanded="' + S.completer + '">' + (S.completer ? 'Masquer la liste' : 'Les compléter') + '</button></p>' : '') +
        (R.autre ? '<p class="lgo-inconnu">' + R.autre + ' sur un logiciel sans mode d\'emploi pour l\'instant (' + esc(R.autres.join(', ')) + ').</p>' : '') +
        (S.saisie && S.completer && R.sans.length ? aCompleter(R) : '') +
        '<div class="lgo-grille"><div>' + etapes(cur) + '</div><div>' + fichiers(cur) + pharmas(cur, R) + '</div></div>' +
      '</div>';
    }
  };
})();

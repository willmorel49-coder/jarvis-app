/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Base Biosimilaires France (pages.biosimilaires)
   Base complète des biosimilaires FR (ANSM/Ameli/EMA) croisée aux
   données réseau Intégral. Angle COMMERCIAL OFFICINE :
   substituables en ville + biosimilaires des labos PARTENAIRES (Zentiva,
   EG, Teva) mis en évidence. Hospitaliers / hors-Intégral marqués.
   Données : window.BIOSIMILAIRES (biosimilaires-data.js).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(+n || 0) : String(+n || 0); };
  function eurK(n) { n = +n || 0; if (n >= 1000000) return (Math.round(n / 100000) / 10).toString().replace('.', ',') + ' M€'; if (n >= 1000) return (Math.round(n / 100) / 10).toString().replace('.', ',') + ' k€'; return (Math.round(n * 100) / 100).toString().replace('.', ',') + ' €'; }
  function eur(n) { return (Math.round((+n || 0) * 100) / 100).toString().replace('.', ',') + ' €'; }

  var CANAL_LABEL = { ville: 'Ville', hopital: 'Hôpital', mixte: 'Ville + hôpital' };
  // 28/08/2026 — le logo du labo partenaire remplace l'étoile (demande de Will).
  // Chemins relatifs à crm/v2/index.html, seule page qui charge ce fichier.
  var LOGO = { 'Teva': 'logos/teva.svg', 'Zentiva': 'logos/zentiva.svg', 'EG Labo': 'logos/eg-labo.png' };
  var PARTENAIRES_ORDRE = ['Teva', 'Zentiva', 'EG Labo'];
  function logoImg(nom, cls) {
    if (!LOGO[nom]) return '';
    return '<img class="' + cls + '" src="' + LOGO[nom] + '" alt="' + esc(nom) + '" title="Partenaire Intégral · ' + esc(nom) + '">';
  }
  var PURPLE = '#6D4FC4', GREEN = '#1E9E5A', ORANGE = '#E8722B', NAVY = '#0F2A47';

  var S = { q: '', aire: '', canal: '', subOnly: false, partOnly: false, ipOnly: false, open: {} };
  try { var sv = JSON.parse(localStorage.getItem('biosim.S') || '{}'); ['q', 'aire', 'canal', 'subOnly', 'partOnly', 'ipOnly'].forEach(function (k) { if (sv[k] != null) S[k] = sv[k]; }); } catch (e) {}
  function save() { try { localStorage.setItem('biosim.S', JSON.stringify({ q: S.q, aire: S.aire, canal: S.canal, subOnly: S.subOnly, partOnly: S.partOnly, ipOnly: S.ipOnly })); } catch (e) {} }

  function DB() { return window.BIOSIMILAIRES || { meta: {}, molecules: [] }; }

  function injectStyles() {
    if (document.getElementById('biosim-css')) return;
    var css = document.createElement('style'); css.id = 'biosim-css';
    css.textContent = [
      '.bs-wrap{max-width:1080px;margin:0 auto;padding:0 16px 60px}',
      '.bs-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 6px}',
      '@media(max-width:640px){.bs-stats{grid-template-columns:repeat(2,1fr)}}',
      '.bs-stat{background:#fff;border:1px solid #E6EAF0;border-radius:14px;padding:13px 15px}',
      '.bs-stat .n{font-size:26px;font-weight:800;color:' + NAVY + ';font-family:"Geist Mono",monospace;line-height:1}',
      '.bs-stat .l{font-size:11px;color:#737A8C;text-transform:uppercase;letter-spacing:.03em;margin-top:5px;font-weight:600}',
      '.bs-stat.sub .n{color:' + GREEN + '}.bs-stat.part .n{color:' + ORANGE + '}',
      '.bs-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0 4px}',
      '.bs-search{flex:1;min-width:180px;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #E6EAF0;border-radius:11px;padding:9px 13px}',
      '.bs-search input{border:0;outline:0;flex:1;font:inherit;font-size:14px;background:transparent}',
      '.bs-sel{background:#fff;border:1px solid #E6EAF0;border-radius:11px;padding:9px 12px;font:inherit;font-size:13px;color:' + NAVY + ';font-weight:600;cursor:pointer}',
      '.bs-chip{border:1px solid #E6EAF0;background:#fff;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:700;color:#4A5568;cursor:pointer;transition:.15s;white-space:nowrap}',
      '.bs-chip:hover{border-color:#C3CCDA}',
      '.bs-chip.on{background:' + NAVY + ';color:#fff;border-color:' + NAVY + '}',
      '.bs-chip.sub.on{background:' + GREEN + ';border-color:' + GREEN + '}',
      '.bs-chip.part.on{background:' + ORANGE + ';border-color:' + ORANGE + '}',
      '.bs-count{font-size:12.5px;color:#737A8C;margin:10px 2px 4px;font-weight:600}',
      '.bs-card{background:#fff;border:1px solid #E6EAF0;border-radius:16px;margin-bottom:11px;overflow:hidden;transition:.15s}',
      '.bs-card.ip{border-left:4px solid ' + PURPLE + '}',
      '.bs-card.hors{opacity:.82}',
      '.bs-head{display:flex;align-items:center;gap:12px;padding:15px 17px;cursor:pointer}',
      '.bs-head:hover{background:#FAFBFD}',
      '.bs-mol{flex:1;min-width:0}',
      '.bs-dci{font-size:17px;font-weight:800;color:' + NAVY + ';display:flex;align-items:center;gap:9px;flex-wrap:wrap}',
      '.bs-atc{font-family:"Geist Mono",monospace;font-size:11px;font-weight:700;color:#8894A6;background:#F1F4F8;padding:2px 7px;border-radius:6px}',
      '.bs-ref{font-size:12.5px;color:#737A8C;margin-top:3px}',
      '.bs-ref b{color:#4A5568}',
      '.bs-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}',
      '.bs-pill{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;letter-spacing:.01em}',
      '.bs-pill.sub{background:#E4F6EC;color:#127A45}',
      '.bs-pill.nosub{background:#F1F4F8;color:#8894A6}',
      '.bs-pill.part{background:#FDECDD;color:#B8551A}',
      '.bs-pill.canal{background:#EAF0FE;color:#2456C8}',
      '.bs-pill.hosp{background:#FDECEC;color:#C0392B}',
      '.bs-pill.aire{background:#F3EEFB;color:' + PURPLE + '}',
      '.bs-kpi{text-align:right;flex-shrink:0}',
      '.bs-kpi .pv{font-size:22px;font-weight:800;color:' + PURPLE + ';font-family:"Geist Mono",monospace;line-height:1}',
      '.bs-kpi .pl{font-size:10px;color:#8894A6;text-transform:uppercase;font-weight:700;margin-top:3px}',
      '.bs-kpi .bx{font-size:12px;color:#737A8C;margin-top:5px}',
      '.bs-arrow{flex-shrink:0;color:#B4BECC;transition:.2s;font-size:15px}',
      '.bs-card.open .bs-arrow{transform:rotate(90deg)}',
      '.bs-detail{padding:2px 17px 17px;border-top:1px solid #EEF1F5}',
      '.bs-note{font-size:12px;color:#8A6D2F;background:#FCF6E6;border-radius:9px;padding:8px 11px;margin:12px 0 6px}',
      '.bs-tbl{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}',
      '.bs-tbl th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;color:#8894A6;font-weight:700;padding:6px 8px;border-bottom:1.5px solid #EEF1F5}',
      '.bs-tbl td{padding:8px 8px;border-bottom:1px solid #F3F5F9;vertical-align:middle}',
      '.bs-tbl tr.princeps td{background:#F8F9FB}',
      '.bs-tbl tr.part-row td{background:#FEF7F0}',
      '.bs-tbl .nom{font-weight:700;color:' + NAVY + '}',
      '.bs-tbl .labo{font-size:11.5px;color:#737A8C}',
      '.bs-tbl .mono{font-family:"Geist Mono",monospace;text-align:right;white-space:nowrap}',
      '.bs-tag{font-size:9.5px;font-weight:800;padding:1.5px 6px;border-radius:5px;margin-left:5px;vertical-align:middle}',
      '.bs-tag.part{background:' + ORANGE + ';color:#fff}',
      '.bs-tag.ip{background:#EDE7FA;color:' + PURPLE + '}',
      '.bs-tag.no{background:#F1F4F8;color:#A0A9B8}',
      '.bs-tag.pr{background:#E7ECF3;color:#5A6b80}',
      '.bs-logo{height:15px;width:auto;vertical-align:middle;margin-left:7px}',
      '.bs-pill.part{display:inline-flex;align-items:center;gap:6px}',
      '.bs-pill.part .bs-logo{height:12px;margin-left:0}',
      '.bs-dls{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}',
      '.bs-dl{display:inline-flex;align-items:center;gap:7px;background:' + NAVY + ';color:#fff;border-radius:11px;padding:9px 15px;font-size:13px;font-weight:700;text-decoration:none}',
      '.bs-dl.alt{background:#fff;color:' + NAVY + ';border:1.5px solid ' + NAVY + '}',
      '.bs-legend{font-size:11.5px;color:#8894A6;margin:14px 2px 0;line-height:1.7}',
      '.bs-legend b{color:#5A6b80}'
    ].join('');
    document.head.appendChild(css);
  }

  function molMatch(m) {
    if (S.aire && m.aire !== S.aire) return false;
    if (S.canal) { if (S.canal === 'ville' && !(m.canal === 'ville' || m.canal === 'mixte')) return false; if (S.canal === 'hopital' && !(m.canal === 'hopital' || m.canal === 'mixte')) return false; }
    if (S.subOnly && !m.substituable) return false;
    if (S.partOnly && !m.has_partenaire) return false;
    if (S.ipOnly && !m.referenced_ip) return false;
    if (S.q) {
      var q = S.q.toLowerCase();
      var hay = (m.dci + ' ' + m.atc + ' ' + m.aire + ' ' + m.reference + ' ' + m.reference_labo + ' ' +
        m.biosimilaires.map(function (b) { return b.nom + ' ' + b.labo; }).join(' ')).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }
  // Tri : substituables d'abord, puis référencés IP, puis volume biosim Ameli
  function molSort(a, b) {
    if (!!b.substituable - !!a.substituable) return (!!b.substituable) - (!!a.substituable);
    if (!!b.referenced_ip - !!a.referenced_ip) return (!!b.referenced_ip) - (!!a.referenced_ip);
    return (b.biosim_ameli_boxes || 0) - (a.biosim_ameli_boxes || 0);
  }

  function badge(m) {
    var out = '';
    out += m.substituable
      ? '<span class="bs-pill sub">✓ Substituable officine</span>'
      : '<span class="bs-pill nosub">Non substituable</span>';
    out += '<span class="bs-pill ' + (m.canal === 'hopital' ? 'hosp' : 'canal') + '">' + esc(CANAL_LABEL[m.canal] || m.canal) + '</span>';
    if (m.has_partenaire) {
      // les logos des partenaires présents sur cette molécule, dans un ordre fixe
      var presents = PARTENAIRES_ORDRE.filter(function (p) {
        return m.biosimilaires.some(function (b) { return b.partenaire && b.partenaire_labo === p; });
      });
      out += '<span class="bs-pill part">Partenaire IP' + presents.map(function (p) { return logoImg(p, 'bs-logo'); }).join('') + '</span>';
    }
    out += '<span class="bs-pill aire">' + esc(m.aire) + '</span>';
    return out;
  }

  function tags(e, isPrinceps) {
    var t = '';
    if (isPrinceps) t += '<span class="bs-tag pr">Princeps</span>';
    if (e.partenaire) {
      t += (!isPrinceps && LOGO[e.partenaire_labo])
        ? logoImg(e.partenaire_labo, 'bs-logo')
        : '<span class="bs-tag part">Partenaire' + (e.partenaire_labo ? ' · ' + esc(e.partenaire_labo) : '') + '</span>';
    }
    if (!isPrinceps) t += e.disponible_ip ? '<span class="bs-tag ip">Chez Intégral</span>' : '<span class="bs-tag no">non réf.</span>';
    return t;
  }

  function row(m, name, labo, annee, e, isPrinceps) {
    var cls = isPrinceps ? 'princeps' : (e.partenaire ? 'part-row' : '');
    return '<tr class="' + cls + '">' +
      '<td><span class="nom">' + esc(name) + '</span>' + tags(e, isPrinceps) + '<div class="labo">' + esc(labo) + (annee ? ' · ' + annee : '') + '</div></td>' +
      '<td class="mono">' + (e.prix_ppht != null ? eur(e.prix_ppht) : '—') + '</td>' +
      '<td class="mono">' + (e.prix_ip != null ? eur(e.prix_ip) : '—') + '</td>' +
      '<td class="mono">' + (e.ameli_boxes ? num(e.ameli_boxes) : '—') + '</td>' +
      '<td class="mono">' + (e.stock_dispo ? num(e.stock_dispo) : '—') + '</td>' +
      '</tr>';
  }

  function card(m, i) {
    var open = !!S.open[m.dci];
    var cls = 'bs-card' + (m.referenced_ip ? ' ip' : ' hors') + (open ? ' open' : '');
    var kpi = m.penetration != null
      ? '<div class="pv">' + m.penetration + '%</div><div class="pl">biosim.</div><div class="bx">' + num(m.biosim_ameli_boxes) + ' boîtes</div>'
      : '<div class="pv" style="color:#C0392B;font-size:14px">Hôpital</div><div class="bx">hors périmètre</div>';
    var head = '<div class="bs-head" onclick="V2.pages.biosimilaires.toggle(' + JSON.stringify(m.dci).replace(/"/g, '&quot;') + ')">' +
      '<div class="bs-mol">' +
        '<div class="bs-dci">' + esc(m.dci) + ' <span class="bs-atc">' + esc(m.atc) + '</span></div>' +
        '<div class="bs-ref">Réf. <b>' + esc(m.reference) + '</b> · ' + esc(m.reference_labo) + ' · ' + m.nb_biosim + ' biosimilaire' + (m.nb_biosim > 1 ? 's' : '') + '</div>' +
        '<div class="bs-badges">' + badge(m) + '</div>' +
      '</div>' +
      '<div class="bs-kpi">' + kpi + '</div>' +
      '<div class="bs-arrow">›</div>' +
    '</div>';
    var detail = '';
    if (open) {
      var ms = m.mol_stats;
      var note = m.note ? '<div class="bs-note">ⓘ ' + esc(m.note) + '</div>' : '';
      var msLine = ms ? '<div class="bs-ref" style="margin:10px 2px 0"><b>Réseau Intégral</b> · ' + num(ms.pharmacies) + ' pharmacies · rotation ' + num(ms.rotation) + '/an · CA ' + eurK(ms.ca_pharma_an) + '/pharma/an</div>' : '';
      var rows = row(m, m.reference, m.reference_labo, '', m.reference_enrich, true);
      m.biosimilaires.forEach(function (b) { rows += row(m, b.nom, b.labo, b.annee, b, false); });
      detail = '<div class="bs-detail">' + note + msLine +
        '<table class="bs-tbl"><thead><tr>' +
          '<th>Produit</th><th style="text-align:right">PPHT</th><th style="text-align:right">Net IP</th>' +
          '<th style="text-align:right">Boîtes France</th><th style="text-align:right">Stock IP</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    return '<div class="' + cls + '">' + head + detail + '</div>';
  }

  V2.pages.biosimilaires = {
    toggle: function (dci) { S.open[dci] = !S.open[dci]; V2.render(); },
    setChip: function (k, v) {
      if (k === 'canal') S.canal = (S.canal === v ? '' : v);
      else S[k] = !S[k];
      save(); V2.render();
    },
    setAire: function (v) { S.aire = v; save(); V2.render(); },
    setQ: function (v) { S.q = v; save();
      var list = document.getElementById('bs-list'); if (list) list.innerHTML = renderList();
      var cnt = document.getElementById('bs-count'); if (cnt) cnt.textContent = countLabel();
    },
    render: function (root) {
      injectStyles();
      var db = DB(), meta = db.meta || {};
      if (!db.molecules || !db.molecules.length) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap"><div class="v2-empty"><div class="v2-empty-d">Base biosimilaires indisponible.</div></div></div>';
        return;
      }
      var aires = [];
      db.molecules.forEach(function (m) { if (aires.indexOf(m.aire) < 0) aires.push(m.aire); });
      aires.sort();
      var aireOpts = '<option value="">Toutes les aires</option>' +
        aires.map(function (a) { return '<option value="' + esc(a) + '"' + (S.aire === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('');

      var stats = '<div class="bs-stats">' +
        '<div class="bs-stat"><div class="n">' + meta.nb_molecules + '</div><div class="l">Molécules</div></div>' +
        '<div class="bs-stat"><div class="n">' + meta.nb_biosimilaires + '</div><div class="l">Biosimilaires</div></div>' +
        '<div class="bs-stat sub"><div class="n">' + meta.nb_substituables + '</div><div class="l">Substituables officine</div></div>' +
        '<div class="bs-stat part"><div class="n">' + meta.nb_molecules_ref_ip + '</div><div class="l">Référencés Intégral</div></div>' +
      '</div>';

      var filters = '<div class="bs-filters">' +
        '<div class="bs-search">' + ICO('search', 16, 2) + '<input placeholder="Molécule, marque, labo, ATC…" value="' + esc(S.q) + '" oninput="V2.pages.biosimilaires.setQ(this.value)"></div>' +
        '<select class="bs-sel" onchange="V2.pages.biosimilaires.setAire(this.value)">' + aireOpts + '</select>' +
      '</div>' +
      '<div class="bs-filters">' +
        '<span class="bs-chip' + (S.canal === 'ville' ? ' on' : '') + '" onclick="V2.pages.biosimilaires.setChip(\'canal\',\'ville\')">Ville</span>' +
        '<span class="bs-chip' + (S.canal === 'hopital' ? ' on' : '') + '" onclick="V2.pages.biosimilaires.setChip(\'canal\',\'hopital\')">Hôpital</span>' +
        '<span class="bs-chip sub' + (S.subOnly ? ' on' : '') + '" onclick="V2.pages.biosimilaires.setChip(\'subOnly\')">✓ Substituables</span>' +
        '<span class="bs-chip part' + (S.partOnly ? ' on' : '') + '" onclick="V2.pages.biosimilaires.setChip(\'partOnly\')">Partenaires (Teva · Zentiva · EG Labo)</span>' +
        '<span class="bs-chip' + (S.ipOnly ? ' on' : '') + '" onclick="V2.pages.biosimilaires.setChip(\'ipOnly\')">Chez Intégral</span>' +
      '</div>';

      var legend = '<div class="bs-legend">' +
        '<b>Substituable officine</b> = le pharmacien peut délivrer un biosimilaire à la place du princeps (arrêté du 10 avr. 2026, 11 groupes). ' +
        '<b>Logo Teva / Zentiva / EG Labo</b> = biosimilaire d\'un labo partenaire Intégral (labo qui facture, ou distributeur en France). ' +
        (meta.prix_factures && meta.prix_factures.mois ? '<b>PPHT et net IP</b> constatés sur les factures Intégral de ' + esc(meta.prix_factures.mois[0]) + ' à ' + esc(meta.prix_factures.mois[meta.prix_factures.mois.length - 1]) + '. ' : '') +
        'Pénétration = part des biosimilaires dans les ventes France (Ameli) de la molécule. ' +
        'Les molécules hospitalières hors circuit officine sont marquées « hôpital / hors périmètre ».' +
        '<br>Source : référentiel ANSM/Ameli/EMA × données réseau Intégral · généré le ' + esc(meta.genere_le || '') + '.</div>';

      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap bs-wrap">' +
          '<h1 style="font-size:26px;font-weight:800;color:' + NAVY + ';margin:8px 0 2px">Base Biosimilaires</h1>' +
          '<p style="color:#737A8C;font-size:14px;margin:0 0 4px">Tous les biosimilaires disponibles en France, croisés à tes ventes et stocks réseau. Les <b style="color:' + GREEN + '">substituables en officine</b> et les <b style="color:' + ORANGE + '">labos partenaires</b> en tête.</p>' +
          '<div class="bs-dls">' +
            '<a class="bs-dl" href="../../base-biosimilaires.xlsx" download>' + ICO('fiche', 15) + ' Excel complet</a>' +
            // 28/08/2026 — fiches INTERNES (avec net IP) : servies depuis l'espace
            // protégé, jamais depuis le dépôt public. Les versions « pharmacien »
            // (PPHT seul) restent téléchargeables et remettables.
            '<a class="bs-dl" onclick="V2.ouvrirDocProtege(\'biosimSynthese\')">' + ICO('fiche', 15) + ' Fiche interne · synthèse (net IP)</a>' +
            '<a class="bs-dl" onclick="V2.ouvrirDocProtege(\'biosimDetail\')">' + ICO('fiche', 15) + ' Fiche interne · toutes présentations (net IP)</a>' +
            // 28/08/2026 — Will : PPHT + net IP aussi sur la fiche pharmacien → elle
            // sort du dépôt public et se sert depuis l'espace protégé, comme l'interne.
            '<a class="bs-dl alt" onclick="V2.ouvrirDocProtege(\'biosimSynthesePharma\')">' + ICO('fiche', 15) + ' Fiche pharmacien · synthèse</a>' +
            '<a class="bs-dl alt" onclick="V2.ouvrirDocProtege(\'biosimDetailPharma\')">' + ICO('fiche', 15) + ' Fiche pharmacien · toutes présentations</a>' +
          '</div>' +
          stats + filters +
          '<div class="bs-count" id="bs-count">' + countLabel() + '</div>' +
          '<div id="bs-list">' + renderList() + '</div>' +
          legend +
        '</div>';
    }
  };

  function filtered() { return DB().molecules.filter(molMatch).sort(molSort); }
  function countLabel() {
    var f = filtered();
    var nb = f.reduce(function (a, m) { return a + m.nb_biosim; }, 0);
    return f.length + ' molécule' + (f.length > 1 ? 's' : '') + ' · ' + nb + ' biosimilaire' + (nb > 1 ? 's' : '');
  }
  function renderList() {
    var f = filtered();
    if (!f.length) return '<div style="text-align:center;padding:40px;color:#8894A6">Aucun résultat pour ces filtres.</div>';
    return f.map(card).join('');
  }
})();

/* CRM V2 · Concurrents → Grossistes-répartiteurs (pages.grossistes)
   Deux parties : ANNUAIRE des concurrents (agences, CA, géo, enseignes affiliées,
   partenariats, livraison, conditions) + notes terrain éditables par item ; et
   ACTUALITÉS du secteur (veille Google News quotidienne, grossistes-actu.json).
   Données : grossistes-data.js (window.GROSSISTES_DATA, lazy) + grossistes-actu.json (fetch). */
(function () {
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var CB = '?v=20261013p';

  var view = 'annuaire';   // 'annuaire' | 'actu'
  var openGroupe = null;   // groupe déplié (niveau 2)
  var filt = '';           // filtre statut des groupes
  var q = '';              // recherche instantanée
  var sortBy = 'rang';     // tri : rang | part | ca
  var actuTag = '';        // filtre actualités par grossiste
  var ACTU = null;         // cache actualités
  var VERIF = null;        // faits vérifiés à la main (grossistes-verifie.json, jamais écrit par le robot)

  function DATA() { return window.GROSSISTES_DATA || null; }
  // list() = les acteurs de l'annuaire (une fiche FUSIONNÉE dans une autre n'y figure plus) ;
  // byId() les retrouve tous, pour que les anciennes adresses et les notes terrain restent lisibles.
  function tout() { var d = DATA(); return (d && d.grossistes) || []; }
  function list() { return tout().filter(function (g) { return !g.fusionne_dans; }); }
  function byId(id) {
    var g = tout().filter(function (x) { return x.id === id; })[0] || null;
    return g && g.fusionne_dans ? (tout().filter(function (x) { return x.id === g.fusionne_dans; })[0] || g) : g;
  }

  // ── chargement paresseux ────────────────────────────────────────
  function ensureData(cb) {
    if (window.GROSSISTES_DATA) { cb(); return; }
    var s = document.createElement('script'); s.src = 'grossistes-data.js' + CB;
    s.onload = function () { cb(); }; s.onerror = function () { cb('err'); };
    document.head.appendChild(s);
  }
  function ensureActu(cb) {
    if (ACTU) { cb(); return; }
    // Clé du jour, comme les autres fichiers des robots : avec le jeton fixe,
    // le service worker (cache-first) resservait indéfiniment la première
    // version reçue — l'actualité « mise à jour chaque jour » ne bougeait plus.
    var d = '?d=' + new Date().toISOString().slice(0, 10);
    var verif = fetch('grossistes-verifie.json' + d, { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (j) { VERIF = j; }).catch(function () { VERIF = null; });
    fetch('grossistes-actu.json' + d, { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (j) { ACTU = j; }).catch(function () { ACTU = { items: [] }; })
      .then(function () { return verif; }).then(function () { cb(); });
  }

  // ── helpers d'affichage ─────────────────────────────────────────
  function fiab(g) {
    var f = (g.fiabilite || '').toLowerCase();
    var cls = f === 'haute' ? 'hi' : (f === 'faible' ? 'lo' : 'mid');
    return '<span class="gr-fiab ' + cls + '">fiabilité ' + esc(g.fiabilite || 'moyenne') + '</span>';
  }
  function typeBadge(t) {
    t = t || ''; var cls = /coop/i.test(t) ? 'coop' : (/short|r[eé]gional/i.test(t) ? 'sl' : 'nat');
    return '<span class="gr-type ' + cls + '">' + esc(t) + '</span>';
  }
  function timeAgo(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso), now = new Date(), h = Math.round((now - d) / 36e5);
      if (h < 1) return "à l'instant"; if (h < 24) return 'il y a ' + h + ' h';
      var j = Math.round(h / 24); if (j < 31) return 'il y a ' + j + ' j';
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch (e) { return (iso || '').slice(0, 10); }
  }
  var TAGNAME = { '': 'Secteur', 'ocp': 'Phoenix OCP', 'cerp-rouen': 'CERP Rouen', 'cerp-rrm': 'CERP RRM', 'alliance': 'Alliance Healthcare', 'phoenix': 'Phoenix OCP', 'cerp': 'CERP', 'cerp-ba': 'CERP Bretagne Atlantique', 'sagitta': 'Sagitta', 'cophana': 'Cophana', 'welcoop': 'Welcoop', 'giphar': 'Giphar', 'drapier': 'Groupe Drapier', 'aredis': 'Aredis', 'rbp': 'RBP Pharma', 'generique': 'Génériques', 'biosimilaire': 'Biosimilaires', 'groupement': 'Groupements', 'marge': 'Marge des grossistes' };

  // ── ANNUAIRE PAR GROUPE (niveau 0 marché → 1 groupes → 2 membres/mère) ──
  function groupes() { var d = DATA(); return (d && d.groupes) || []; }
  function membersOf(gid) { return list().filter(function (f) { return f.groupe_id === gid; }); }
  function kNum(s) { s = String(s || ''); var m = s.match(/([\d.,]+)\s*Md/i); if (m) return parseFloat(m[1].replace(',', '.')) * 1000; m = s.match(/([\d.,]+)\s*M/i); if (m) return parseFloat(m[1].replace(',', '.')); return 0; }
  function statutCls(s) { s = s || ''; return /notre|nous/.test(s) ? 'us' : (/national/.test(s) ? 'nat' : (/coop/.test(s) ? 'coop' : (/DOM/.test(s) ? 'dom' : (/export/.test(s) ? 'exp' : (/hors/.test(s) ? 'warn' : 'sl'))))); }
  function maillageHtml(g) {
    var m = g.maillage; if (!m) return '';
    var pen = (m.nCli + m.nPro) ? Math.round(m.nCli / (m.nCli + m.nPro) * 100) : 0;
    var deptRows = (m.depts || []).map(function (x) { return '<span class="gr-dchip' + (x.cli ? ' has' : '') + '"><b>' + esc(x.d) + '</b> ' + x.cli + 'c·' + x.pro + 'p</span>'; }).join('');
    var note = (m.nDept === 0) ? 'Aucun département alloué par le proxy (chevauchement de dépôts) — à définir avec l\'allocation officielle.' :
      '<b>' + m.nCli + '</b> clients · <b>' + m.nPro + '</b> prospects sur <b>' + m.nDept + '</b> départements · <b>' + pen + '%</b> de pénétration.';
    return '<div class="gr-sec gr-maill"><h4>Maillage par département alloué</h4>' +
      '<div class="gr-maillg">' +
        '<div class="gr-mcell cli"><b>' + m.nCli + '</b><span>clients</span></div>' +
        '<div class="gr-mcell pro"><b>' + m.nPro + '</b><span>prospects à conquérir</span></div>' +
        '<div class="gr-mcell dep"><b>' + m.nDept + '</b><span>départements</span></div>' +
      '</div>' +
      (deptRows ? '<div class="gr-depts">' + deptRows + '</div>' : '') +
      '<div class="gr-maill-n">' + note + '</div>' +
      '<div class="gr-maill-w">Attention : allocation géographique automatique (département → dépôt le plus proche, plafond 170 km). À valider avec votre répartition officielle.</div></div>';
  }
  function flagOf(g) { var t = (g.pays || '') + (g.mere || ''); var c = /allemagne/i.test(t) ? 'DE' : (/usa|américain|amerisource|cencora/i.test(t) ? 'US' : (/japon|toyota/i.test(t) ? 'JP' : 'FR')); return '<i class="gr-pays">' + c + '</i>'; }
  // nom commercial d'une fiche ou d'un groupe (« Phoenix OCP », « CERP (Astera) »…)
  function aff(o) { return (o && (o.nom_aff || shortNom(o.nom))) || ''; }
  function shortNom(s) { return String(s || '').split('(')[0].split('—')[0].split('/')[0].trim(); }
  function fmtEur(n) { if (n == null) return '—'; var a = Math.abs(n); if (a >= 1e9) return (Math.round(n / 1e8) / 10).toLocaleString('fr') + ' Md€'; if (a >= 1e6) return (Math.round(n / 1e5) / 10).toLocaleString('fr') + ' M€'; if (a >= 1e3) return Math.round(n / 1e3).toLocaleString('fr') + ' k€'; return Math.round(n).toLocaleString('fr') + ' €'; }
  var EFF = { '00': '0 sal.', '01': '1-2', '02': '3-5', '03': '6-9', '11': '10-19', '12': '20-49', '21': '50-99', '22': '100-199', '31': '200-249', '32': '250-499', '41': '500-999', '42': '1000-1999', '51': '2000-4999', '52': '5000-9999', '53': '≥10 000' };
  function finHtml(g) {
    var F = g.financials; if (!F) return '';
    var ca = F.ca || {}, rn = F.rn || {};
    var years = Object.keys(ca).concat(Object.keys(rn)).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    var body;
    if (years.length) {
      var maxca = Math.max.apply(null, years.map(function (y) { return ca[y] || 0; }).concat([1]));
      body = '<div class="gr-fingraph">' + years.map(function (y) {
        var c = ca[y], r = rn[y], h = c ? Math.round(Math.max(4, (c / maxca) * 56)) : 4;
        return '<div class="gr-finbar"><i style="height:' + h + 'px"></i><b>' + (c ? fmtEur(c) : 'non publié') + '</b>' +
          (r != null ? '<u class="' + (r < 0 ? 'neg' : 'pos') + '">' + fmtEur(r) + '</u>' : '') + '<span>' + esc(y) + '</span></div>';
      }).join('') + '</div><div class="gr-finlg">Barres = chiffre d\'affaires · sous chaque barre = résultat net</div>';
    } else {
      body = '<p class="gr-finconf">Société identifiée mais <b>comptes déposés confidentiels</b> — chiffres non publics à ce jour.</p>';
    }
    var eff = EFF[String(F.effectif)] || '';
    var meta = '<div class="gr-finmeta">SIREN ' + esc(F.siren || '—') + (F.creation ? ' · créée ' + esc((F.creation || '').slice(0, 4)) : '') + (eff ? ' · effectif ' + esc(eff) + (F.effectif_an ? ' (' + esc(String(F.effectif_an)) + ')' : '') : '') +
      (F.siren ? ' · <a href="https://annuaire-entreprises.data.gouv.fr/entreprise/' + esc(F.siren) + '" target="_blank" rel="noopener">fiche officielle ↗</a>' : '') + '</div>';
    return '<div class="gr-sec gr-finsec"><h4>Comptes officiels (RNE · data.gouv.fr)</h4>' + body + meta + '</div>';
  }

  function marketBar() {
    var gs = groupes().filter(function (g) { return g.pdm_num > 0; }).sort(function (a, b) { return b.pdm_num - a.pdm_num; });
    var sum = gs.reduce(function (s, g) { return s + g.pdm_num; }, 0), autres = Math.max(0, Math.round((100 - sum) * 10) / 10);
    var seg = gs.map(function (g) { return '<span class="gr-mbseg" style="width:' + g.pdm_num + '%;background:' + g.couleur + '" title="' + esc(aff(g)) + ' ' + g.pdm_num + '%"></span>'; }).join('') +
      (autres > 0 ? '<span class="gr-mbseg" style="width:' + autres + '%;background:#CBD2DD" title="Indépendants, short-liners & DOM-TOM"></span>' : '');
    var leg = gs.map(function (g) { return '<span class="gr-mbl"><i style="background:' + g.couleur + '"></i>' + esc(aff(g)) + ' ' + g.pdm_num + '%</span>'; }).join('') +
      '<span class="gr-mbl"><i style="background:#CBD2DD"></i>Autres ~' + Math.round(autres) + '%</span>';
    var M = (DATA() && DATA().marche) || null;
    var tuiles = M && M.tuiles ? M.tuiles : [{ v: '~22 Md€', l: 'marché FR' }, { v: String(list().length), l: 'acteurs recensés' }, { v: '~90 %', l: 'aux 3 leaders' }, { v: '~57 %', l: 'du médicament (volume)' }];
    return '<div class="gr-market">' +
      '<div class="gr-mtiles">' + tuiles.map(function (t) { return '<div' + (t.src ? ' title="' + esc(t.src) + '"' : '') + '><b>' + esc(t.v) + '</b><span>' + esc(t.l) + '</span></div>'; }).join('') + '</div>' +
      '<div class="gr-mbar">' + seg + '</div><div class="gr-mbleg">' + leg + '</div>' + (M && M.serie ? '<div class="gr-mserie">Parts de marché : ' + esc(M.serie) + '</div>' : '') + '</div>';
  }
  function docsHtml() {
    var docs = (DATA() && DATA().docs) || []; if (!docs.length) return '';
    return '<details class="gr-docs"><summary>Documents officiels du marché (' + docs.length + ')</summary>' +
      docs.map(function (m) {
        var cc = (m.chiffres_cles || []).slice(0, 5).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
        return '<div class="gr-doc">' +
          '<div class="gr-doc-h"><b>' + esc(m.titre) + '</b><span class="gr-doc-acc ' + (m.gratuit ? 'lib' : 'abo') + '">' + (m.gratuit ? 'gratuit' : 'payant') + '</span></div>' +
          '<div class="gr-doc-ed">' + esc(m.editeur || '') + (m.annee ? ' · ' + esc(m.annee) : '') + '</div>' +
          (cc ? '<ul class="gr-doc-cc">' + cc + '</ul>' : '') +
          (m.url ? '<a class="gr-doc-lk" href="' + esc(m.url) + '" target="_blank" rel="noopener">Ouvrir le document ↗</a>' : '') +
        '</div>';
      }).join('') + '</details>';
  }
  function groupCardHtml(g) {
    var mem = membersOf(g.id), open = (openGroupe === g.id);
    var pdm = g.pdm_num || 0, barW = pdm ? Math.max(4, Math.min(100, Math.round(pdm / 40 * 100))) : 0;
    var micro = barW ? '<div class="gr-gbar"><i style="width:' + barW + '%;background:' + g.couleur + '"></i></div>' : '';
    var band = '<div class="gr-gband"><span><b>' + esc(g.part_marche || '—') + '</b> part</span>' +
      '<span><b>' + mem.length + '</b> répart.</span>' +
      '<span><b>' + ((g.enseignes && g.enseignes.length) || '—') + '</b> ens.</span></div>';
    var head = '<button class="gr-ghead" onclick="V2.grossisteGroupe(\'' + g.id + '\')">' +
      '<div class="gr-ghrow"><span class="gr-grang">#' + g.rang + '</span><b class="gr-gnom">' + esc(aff(g)) + '</b>' +
        '<span class="gr-gstat s-' + statutCls(g.statut) + '">' + esc(g.statut) + '</span>' +
        '<span class="gr-gchev">' + (open ? '▾' : '▸') + ' ' + mem.length + '</span></div>' +
      micro +
      '<div class="gr-gmere">' + flagOf(g) + ' ' + esc(shortNom(g.mere).slice(0, 54) || '—') + '</div>' +
      band + '</button>';
    return '<div class="gr-gcard' + (open ? ' open' : '') + '" style="--gc:' + g.couleur + '">' + head + (open ? groupBodyHtml(g, mem) : '') + '</div>';
  }
  function groupBodyHtml(g, mem) {
    var mere = '<div class="gr-lvl"><span class="gr-lvlab">Société mère</span><div class="gr-mere"><i class="gr-pas mere"></i>' + esc(g.mere || '—') + '</div></div>';
    var rows = mem.slice().sort(function (a, b) { return kNum(b.ca_eur) - kNum(a.ca_eur); }).map(function (f) {
      var right = (f.ca_eur && f.ca_eur !== 'inconnu' && f.ca_eur !== '—') ? shortNom(f.ca_eur) : shortNom((f.geo || '').split(',')[0]).slice(0, 22);
      return '<button class="gr-mrow" onclick="V2.grossisteOpen(\'' + esc(f.id) + '\')">' +
        '<i class="gr-pas memb"></i><span class="gr-mname">' + esc(aff(f)) + (f.lien_ip ? '<em class="gr-mip">IP</em>' : '') + (f.repartiteur === false ? '<em class="gr-mnr">hors répartition</em>' : '') + '</span>' +
        '<span class="gr-mca">' + esc(right) + '</span><span class="gr-marr">→</span></button>';
    }).join('');
    var ens = (g.enseignes && g.enseignes.length) ? '<div class="gr-lvl"><span class="gr-lvlab">Enseignes / groupements</span><div class="gr-ens">' +
      g.enseignes.map(function (e) { return '<span class="gr-enschip"><i class="gr-pas ens"></i>' + esc(typeof e === 'string' ? e : e.nom) + '</span>'; }).join('') + '</div></div>' : '';
    return '<div class="gr-gbody">' + (g.resume ? '<p class="gr-gres">' + esc(g.resume) + '</p>' : '') + mere +
      '<div class="gr-lvl"><span class="gr-lvlab">Répartiteurs (' + mem.length + ')</span>' + rows + '</div>' + ens + '</div>';
  }
  function norm(s) { s = String(s || '').toLowerCase(); return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s; }
  function matchGroup(g, nq) {
    if (norm(g.nom).indexOf(nq) >= 0 || norm(g.mere).indexOf(nq) >= 0) return true;
    var mem = membersOf(g.id), i; for (i = 0; i < mem.length; i++) if (norm(mem[i].nom).indexOf(nq) >= 0) return true;
    var ens = g.enseignes || []; for (i = 0; i < ens.length; i++) { var e = typeof ens[i] === 'string' ? ens[i] : ens[i].nom; if (norm(e).indexOf(nq) >= 0) return true; }
    return false;
  }
  function grpCaNum(g) { var mem = membersOf(g.id), s = 0, i; for (i = 0; i < mem.length; i++) s += kNum(mem[i].ca_eur); return s; }
  function annuaireHtml() {
    var gs = groupes();
    if (!gs.length) return '<div class="gr-empty">Base concurrents en cours de constitution. Revenez dans un instant.</div>';
    var nq = norm(q.trim());
    var shown = gs.filter(function (g) { return (!filt || g.statut === filt) && (nq.length < 2 || matchGroup(g, nq)); });
    if (sortBy === 'part') shown.sort(function (a, b) { return (b.pdm_num || 0) - (a.pdm_num || 0) || a.rang - b.rang; });
    else if (sortBy === 'ca') shown.sort(function (a, b) { return grpCaNum(b) - grpCaNum(a) || a.rang - b.rang; });
    else shown.sort(function (a, b) { return a.rang - b.rang; });
    var nAct = shown.reduce(function (s, g) { return s + membersOf(g.id).length; }, 0);
    var STATUTS = [['', 'Tous'], ['national', 'Nationaux'], ['coopérative', 'Coop.'], ['short-liner', 'Short-liners'], ['DOM-TOM', 'DOM-TOM'], ['export', 'Export'], ['hors-répartition', 'Groupements']];
    var chips = STATUTS.map(function (s) { return '<button class="gr-filt' + (filt === s[0] ? ' on' : '') + '" onclick="V2.grossisteFilter(\'' + s[0] + '\')">' + esc(s[1]) + '</button>'; }).join('');
    var sorts = [['rang', 'Rang'], ['part', 'Part'], ['ca', 'CA']].map(function (s) { return '<button class="gr-sort' + (sortBy === s[0] ? ' on' : '') + '" onclick="V2.grossisteSort(\'' + s[0] + '\')">' + s[1] + '</button>'; }).join('');
    var controls = '<div class="gr-controls">' +
      '<div class="gr-search">' + ICO('search', 16, 2) + '<input id="gr-q" type="search" placeholder="Rechercher un groupe, un répartiteur, une enseigne…" value="' + esc(q) + '" oninput="V2.grossisteSearch(this.value)">' + (q ? '<button class="gr-qx" onclick="V2.grossisteSearch(\'\')" title="Effacer">✕</button>' : '') + '</div>' +
      '<div class="gr-ctlrow"><div class="gr-sorts"><span>Trier</span>' + sorts + '</div><span class="gr-count">' + nAct + ' acteurs</span></div>' +
      '<div class="gr-filts">' + chips + '</div>' +
    '</div>';
    var cards = shown.map(groupCardHtml).join('') || '<div class="gr-empty">Aucun acteur pour « ' + esc(q) + ' ».<br><button class="gr-filt" style="margin-top:10px" onclick="V2.grossisteSearch(\'\')">Effacer la recherche</button></div>';
    return marketBar() + docsHtml() + controls + '<div class="gr-glist">' + cards + '</div>';
  }

  // ── FICHE d'un grossiste (14/10/2026 : fiche UNIQUE, adressable #concurrents/g/<id>) ──
  // Ordre : en-tête · à retenir · propriétaire & chaîne · chiffres · implantations · décisions officielles
  //         · prix · actualité · histoire · angles, forces, faiblesses… · notes terrain · sources.
  // Un champ non publié s'écrit « non publié » (jamais 0, jamais un blanc).
  var PRIX_NOM = { sagitta: 'Sagitta', ocp: 'OCP Incontournables', mc: 'OCP Marque Conseil', etradi: 'eTradi', alliance: 'Alliance', pharmafit: 'Pharmafit', cerp: 'CERP Central Prom', epsilon: 'Epsilon' };
  function npub(v) { v = (v == null ? '' : String(v)).trim(); return (!v || /^inconnu/i.test(v) || v === '—') ? '' : v; }
  function kpi(v, lab) { var t = npub(v); return '<div class="gr-fkpi"><b' + (t ? '' : ' class="np"') + '>' + esc(t || 'non publié') + '</b><span>' + lab + '</span></div>'; }
  function dFr(d) { d = String(d || ''); var m = d.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[3] + '/' + m[2] + '/' + m[1]; m = d.match(/^(\d{4})-(\d{2})$/); return m ? m[2] + '/' + m[1] : d; }
  function lien(u, txt) {
    u = String(u || '');
    var urls = u.split(' ; ').filter(function (x) { return /^https?:/.test(x.trim()); });
    if (urls.length) return urls.map(function (x, i) { return '<a href="' + esc(x.trim()) + '" target="_blank" rel="noopener">' + esc(txt || 'source') + (urls.length > 1 ? ' ' + (i + 1) : '') + ' ↗</a>'; }).join(' ');
    return u ? '<span class="gr-srctxt">' + esc(u) + '</span>' : '';
  }
  function euros(n) { return (n == null || n === '') ? 'non publié' : fmtEur(n); }
  function actuDe(gs) {
    // gs : liste de fiches (une fiche, ou tous les membres d'un groupe). Fait vérifié + fait d'enquête + article de presse.
    var tags = {}, cles = {}, out = [], vus = {};
    gs.forEach(function (g) { (g.tags_actu || []).forEach(function (t) { tags[t] = 1; }); if (g.cle_implantations) cles[g.cle_implantations] = 1; });
    ((VERIF && VERIF.items) || []).forEach(function (i) { if (i.acteur && (cles[i.acteur] || tags[i.acteur])) out.push({ k: 'verifie', date: i.date, titre: i.titre, texte: i.texte, url: i.url, source: i.source, nc: i.nonConfirme }); });
    gs.forEach(function (g) { (g.faits_recents || []).forEach(function (f) { out.push({ k: 'enquete', date: f.date, titre: f.fait, url: /^https?:/.test(f.source || '') ? f.source.split(' ; ')[0] : '', source: f.source, nc: f.confirme === false }); }); });
    ((ACTU && ACTU.items) || []).forEach(function (i) { if (i.tag && tags[i.tag]) out.push({ k: 'presse', date: (i.date || '').slice(0, 10), titre: i.titre, texte: i.resume, url: i.url, source: i.source }); });
    out = out.filter(function (x) { var k = (x.titre || '').toLowerCase().slice(0, 60); if (vus[k]) return false; vus[k] = 1; return true; });
    out.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    return out;
  }
  var K_LAB = { verifie: 'vérifié', enquete: 'enquête du 14/10', presse: 'presse' };
  function actuFilHtml(items) {
    if (!items.length) return '<p class="gr-np">Rien de daté sur cet acteur dans la veille. Les faits et articles apparaissent ici dès qu\'ils existent.</p>';
    var ligne = function (x) {
      var t = x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.titre) + '</a>' : esc(x.titre);
      return '<li><span class="gr-fil-d">' + esc(dFr(x.date)) + '</span><div><b>' + t + '</b>' + (x.nc ? ' <span class="gr-vf-nc">non confirmé</span>' : '') +
        (x.texte ? '<span class="gr-fil-t">' + esc(String(x.texte).slice(0, 260)) + '</span>' : '') +
        '<span class="gr-fil-s"><u class="k-' + x.k + '">' + K_LAB[x.k] + '</u> ' + esc(String(x.source || '').split(' ; ')[0].replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)) + '</span></div></li>';
    };
    var tete = items.slice(0, 5), reste = items.slice(5, 25);
    return '<ul class="gr-fil">' + tete.map(ligne).join('') + '</ul>' + (reste.length ? '<details class="gr-det gr-det-in"><summary>' + reste.length + ' autre' + (reste.length > 1 ? 's' : '') + ' plus ancien' + (reste.length > 1 ? 's' : '') + '</summary><div class="gr-det-b"><ul class="gr-fil">' + reste.map(ligne).join('') + '</ul></div></details>' : '');
  }
  function ul(arr) { return (arr && arr.length) ? '<ul class="gr-ul">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
  // Rubrique repliable : « 4 écrans max » — l'essentiel est ouvert, le détail se déplie.
  function det(t, body, ouvert, cls) { return body ? '<details class="gr-sec gr-det' + (cls ? ' ' + cls : '') + '"' + (ouvert ? ' open' : '') + '><summary>' + t + '</summary><div class="gr-det-b">' + body + '</div></details>' : ''; }
  function sec(t, body, cls) { return body ? '<div class="gr-sec' + (cls ? ' ' + cls : '') + '"><h4>' + t + '</h4>' + body + '</div>' : ''; }
  function proprioHtml(g) {
    var P = g.proprietaire_final, ch = g.chaine || [], dir = g.dirigeants || [];
    if (!P && !ch.length && !dir.length) return '';
    var top = P ? '<p class="gr-proprio"><b>' + esc(P.nom) + '</b>' + (P.pays ? ' · ' + esc(P.pays) : '') + (P.type ? ' · <em>' + esc(P.type) + '</em>' : '') + '</p>' : '';
    var chaine = ch.length ? '<ol class="gr-chaine">' + ch.map(function (c) {
      return '<li class="r-' + esc(c.role || '') + '"><b>' + esc(c.nom) + '</b>' + (c.siren ? ' <span class="gr-sir">SIREN ' + esc(c.siren) + '</span>' : '') +
        (c.part ? '<span class="gr-ch-p">' + esc(c.part) + '</span>' : '') + (c.source ? '<span class="gr-ch-s">' + lien(c.source, 'source') + '</span>' : '') + '</li>';
    }).join('') + '</ol>' : '';
    var dirs = dir.length ? '<div class="gr-dirs"><span>Registre public</span>' + dir.map(function (d) { return '<div><b>' + esc(d.nom) + '</b> ' + esc(d.fonction || '') + '</div>'; }).join('') + '</div>' : '';
    return sec('Propriétaire et chaîne de détention', top + (chaine ? '<details class="gr-det gr-det-in"><summary>La chaîne : ' + ch.length + ' maillon' + (ch.length > 1 ? 's' : '') + ' jusqu\'à la société qui exploite</summary><div class="gr-det-b">' + chaine + '</div></details>' : '') + (dirs ? '<details class="gr-det gr-det-in"><summary>Dirigeants (' + dir.length + ')</summary><div class="gr-det-b">' + dirs + '</div></details>' : ''));
  }
  function chiffresHtml(g) {
    var c = g.chiffres || {};
    var ents = (g.entites || []);
    var tab = ents.length ? '<div class="gr-ent">' + ents.map(function (e) {
      return '<div class="gr-ent-r"><div class="gr-ent-n"><b>' + esc(e.denomination || '') + '</b>' + (e.siren ? ' <span class="gr-sir">SIREN ' + esc(e.siren) + '</span>' : '') + (e.role ? '<span class="gr-ent-ro">' + esc(e.role) + '</span>' : '') + '</div>' +
        '<div class="gr-ent-v"><span><i>CA</i> <b class="' + (e.ca == null ? 'np' : '') + '">' + esc(euros(e.ca)) + '</b></span><span><i>Résultat</i> <b class="' + (e.resultat == null ? 'np' : '') + '">' + esc(euros(e.resultat)) + '</b></span><span><i>Année</i> <b>' + esc(e.annee || '—') + '</b></span></div></div>';
    }).join('') + '</div>' : '';
    var det = '';
    if (c.ca || c.part_marche || c.effectif) det = '<ul class="gr-ul gr-chif">' + (c.ca ? '<li><b>CA</b> : ' + esc(c.ca) + '</li>' : '') + (c.part_marche ? '<li><b>Part de marché</b> : ' + esc(c.part_marche) + '</li>' : '') + (c.effectif ? '<li><b>Effectif</b> : ' + esc(c.effectif) + '</li>' : '') + '</ul>';
    var src = (c.sources || []).length ? '<div class="gr-src">Sources des chiffres : ' + c.sources.map(function (u, i) { return lien(u, 'source ' + (i + 1)); }).join(' ') + '</div>' : '';
    return tab + ((det || src) ? '<details class="gr-det gr-det-in"><summary>Détail et sources des chiffres</summary><div class="gr-det-b">' + det + src + '</div></details>' : '');
  }
  function implantationsHtml(g, pts) {
    var ouverts = pts.filter(function (p) { return !p.ferme; }), n = ouverts.length, ns = g.nb_sans_coord || 0, fer = g.fermetures || [];
    var source = '<p class="gr-np">Source : registre des entreprises (SIRENE), activité 46.46Z. La liste officielle de l\'ANSM n\'est pas téléchargeable : un établissement du registre n\'est pas, à lui seul, une autorisation de répartiteur.</p>';
    var fermHtml = fer.length ? '<details class="gr-ferm"><summary>' + fer.length + ' site' + (fer.length > 1 ? 's' : '') + ' fermé' + (fer.length > 1 ? 's' : '') + ' (historique)</summary><ul>' + fer.map(function (f) { return '<li><b>' + esc(dFr(f.date) || 'date inconnue') + '</b> ' + esc(f.ville || '') + (f.dep ? ' (' + esc(f.dep) + ')' : '') + '</li>'; }).join('') + '</ul></details>' : '';
    if (!n && !ns) return sec('Implantations', '<p class="gr-np">Aucun établissement actif localisé dans le registre pour cet acteur.' + (g.nb_agences && npub(g.nb_agences) && !/registre/.test(g.nb_agences) ? ' La base de juillet indique : ' + esc(g.nb_agences) + '.' : '') + '</p>' + fermHtml + source);
    var parDep = {}; ouverts.forEach(function (p) { (parDep[p.dep] = parDep[p.dep] || []).push(p); });
    var deps = Object.keys(parDep).sort();
    var liste = deps.map(function (d) {
      return '<div class="gr-dep"><b>' + esc(d) + '</b> ' + parDep[d].map(function (p) { return '<button type="button" class="gr-ville' + (p.decisions ? ' dec' : '') + '" onclick="V2.concCentrer(\'' + esc(p.pid) + '\')">' + esc(p.ville || p.cp) + (p.decisions ? ' <em>décision</em>' : '') + '</button>'; }).join('') + '</div>';
    }).join('');
    return sec('Implantations', '<p class="gr-impl"><b>' + n + '</b> établissement' + (n > 1 ? 's' : '') + ' ouvert' + (n > 1 ? 's' : '') + ' sur la carte' + (ns ? ' · <b>' + ns + '</b> sans coordonnées' : '') + '</p>' +
      (n ? '<button type="button" class="gr-prix gr-prix-s" onclick="V2.concCentrerActeur(\'' + esc(g.id) + '\')">Montrer sur la carte</button>' : '') + (n ? '<details class="gr-det gr-det-in"><summary>Les ' + n + ' sites, département par département</summary><div class="gr-det-b"><div class="gr-deps">' + liste + '</div></div></details>' : '') + fermHtml + source);
  }
  function decisionsHtml(g) {
    var d = g.decisions || [];
    if (!d.length) return '';
    var carte = function (x) {
      return '<li><div class="gr-dec-h"><span class="gr-dec-t">' + esc(x.type || 'décision') + '</span> <b>' + esc(x.autorite || '') + '</b> · ' + esc(dFr(x.date)) + (x.site_ville ? ' · ' + esc(x.site_ville) : '') + (x.reference ? ' · <span class="gr-sir">' + esc(x.reference) + '</span>' : '') + '</div>' +
        (x.montant ? '<p class="gr-dec-m">Montant : <b>' + esc(Number(x.montant).toLocaleString('fr-FR', { maximumFractionDigits: 2 })) + ' €</b></p>' : '') +
        (x.resume ? '<p>' + esc(x.resume) + '</p>' : '') +
        ((x.manquements || []).length ? '<ul class="gr-ul">' + x.manquements.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
        (x.suite ? '<p class="gr-np">Suite : ' + esc(x.suite) + '</p>' : '') + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">Lire la décision ↗</a>' : '') + '</li>';
    };
    var reste = d.slice(3);
    return sec('Décisions officielles (' + d.length + ')', '<ul class="gr-dec">' + d.slice(0, 3).map(carte).join('') + '</ul>' +
      (reste.length ? '<details class="gr-det gr-det-in"><summary>' + reste.length + ' autre' + (reste.length > 1 ? 's' : '') + ' décision' + (reste.length > 1 ? 's' : '') + ', plus anciennes</summary><div class="gr-det-b"><ul class="gr-dec">' + reste.map(carte).join('') + '</ul></div></details>' : ''), 'gr-decs');
  }
  function prixHtml(g) {
    var ps = g.prix_sources || [];
    if (!ps.length) return sec('Ses prix', '<p class="gr-np">Pas de tarif disponible pour cet acteur : aucun catalogue de prix n\'est dans le comparateur.</p>');
    return sec('Ses prix', ps.map(function (k) { return '<button type="button" class="gr-prix" onclick="V2.go(\'concurrents\',\'' + esc(k) + '\')">Voir ' + esc(PRIX_NOM[k] || k) + ', référence par référence, face à notre net →</button>'; }).join(''));
  }
  var CB_NOTE = 'gr_';
  // pts : points (établissements) de cette fiche ; fourni par la carte. Sans carte : liste vide.
  function ficheHtml(g, pts) {
    if (!g) return '<div class="gr-empty">Fiche introuvable.</div>';
    pts = pts || [];
    var src = (g.sources || []).map(function (u) { return /^https?:/.test(u) ? '<a href="' + esc(u.split(' ')[0]) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\//, '').slice(0, 40)) + ' ↗</a>' : '<span>' + esc(u) + '</span>'; }).join(' · ');
    var grp = (groupes().filter(function (x) { return x.id === g.groupe_id; })[0]) || null;
    var ens = (g.enseignes || []).map(function (e) { return '<div class="gr-ensrow"><b>' + esc(e.nom) + '</b>' + (e.lien ? '<span>' + esc(e.lien) + '</span>' : '') + '</div>'; }).join('');
    var angles = (g.angles && g.angles.length) ? '<div class="gr-sec gr-angles"><h4>Angles d\'attaque commerciale</h4>' + ul(g.angles) + '</div>' : '';
    var histo = (g.histoire && g.histoire.length) ? '<ul class="gr-histo">' + g.histoire.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }).map(function (h) { return '<li><span>' + esc(dFr(h.date)) + '</span><div>' + esc(h.fait) + (h.source ? ' <small>' + lien(h.source, 'source') + '</small>' : '') + '</div></li>'; }).join('') + '</ul>' : '';
    var actuLegacy = (!(g.faits_recents || []).length && g.actu) ? '<p class="gr-np">Repère de la base de juillet : ' + esc(g.actu) + '</p>' : '';
    return '<div class="gr-fiche">' +
      '<div class="gr-fhead"><div><h2>' + esc(aff(g)) + '</h2>' + (g.societe ? '<p class="gr-soc">' + esc(g.societe) + (g.societe_siren ? ' · SIREN ' + esc(g.societe_siren) : '') + '</p>' : '') + '<div class="gr-fmeta">' + typeBadge(g.type) + (g.lien_ip ? '<span class="gr-iplink">Lié à Intégral Pharma</span>' : '') + fiab(g) +
        (grp ? '<button type="button" class="gr-grplink" onclick="V2.concGroupe(\'' + esc(grp.id) + '\')">' + esc(aff(grp)) + '</button>' : '') +
        '<span>mis à jour le ' + esc(dFr(g.maj)) + '</span>' +
        (g.financials && g.financials.siren ? '<a href="https://annuaire-entreprises.data.gouv.fr/entreprise/' + esc(g.financials.siren) + '" target="_blank" rel="noopener">fiche officielle ↗</a>' : '') + '</div></div></div>' +
      (g.repartiteur === false && g.non_repartiteur_motif ? '<div class="gr-nonrep"><h4>Pas un répartiteur officinal</h4><p>' + esc(g.non_repartiteur_motif) + '</p></div>' : '') +
      (g.siren_note ? '<div class="gr-nonrep"><p>' + esc(g.siren_note) + '</p></div>' : '') +
      (g.a_retenir ? '<div class="gr-retenir"><h4>À retenir face à un pharmacien</h4><p>' + esc(g.a_retenir) + '</p></div>' : '') +
      (g.lien_ip_txt ? '<div class="gr-ipnote">' + esc(g.lien_ip_txt) + '</div>' : '') +
      proprioHtml(g) +
      '<div class="gr-sec"><h4>Chiffres</h4><div class="gr-fkpis">' +
        kpi(g.ca_eur, 'CA' + (g.ca_annee && npub(g.ca_annee) ? ' (' + esc(g.ca_annee) + ')' : '')) + kpi(g.nb_agences, 'établissements') + kpi(g.part_marche, 'part de marché') + kpi(g.effectifs, 'effectifs') + '</div>' + chiffresHtml(g) + '</div>' +
      finHtml(g).replace('<div class="gr-sec gr-finsec"><h4>', '<details class="gr-sec gr-det gr-finsec"><summary>').replace('</h4>', '</summary><div class="gr-det-b">').replace(/<\/div>$/, '</div></details>') +
      implantationsHtml(g, pts) +
      decisionsHtml(g) +
      prixHtml(g) +
      sec('Actualité', actuFilHtml(actuDe([g])) + actuLegacy) +
      angles +
      sec('Forces', ul(g.forces)) +
      sec('Faiblesses', ul(g.faiblesses)) +
      det('Historique daté', histo, false) +
      det('Autres informations', maillageHtml(g) +
        sec('Positionnement géographique', g.geo ? '<p>' + esc(g.geo) + '</p>' : '') +
        sec('Positionnement', g.positionnement ? '<p>' + esc(g.positionnement) + '</p>' : '') +
        sec('Enseignes et groupements affiliés', ens) +
        sec('Services et partenariats', ul((g.services ? [g.services] : []).concat(g.partenariats || []))) +
        sec('Livraison', g.livraison ? '<p>' + esc(g.livraison) + '</p>' : '') +
        sec('Conditions publiques', g.conditions ? '<p>' + esc(g.conditions) + '</p>' : ''), false) +
      '<div class="gr-notes"><h4>Mes remontées terrain</h4>' +
        (V2.notes ? V2.notes.section('client', CB_NOTE + g.id) : '<p>Notes indisponibles.</p>') +
        // anciennes fiches fusionnées dans celle-ci : leurs notes restent lisibles (même clé qu'avant la fusion)
        (V2.notes ? (g.aliases || []).map(function (a) { return '<h4 class="gr-notes-al">Remontées de l\'ancienne fiche « ' + esc(a) + ' »</h4>' + V2.notes.section('client', CB_NOTE + a); }).join('') : '') +
      '</div>' +
      det('Sources', src ? '<div class="gr-src">' + src + '</div>' : '', false) +
    '</div>';
  }
  // Fiche d'un GROUPE : société mère, membres cliquables, actualité de tous ses membres.
  function groupeFicheHtml(gid, ptsDe) {
    var g = groupes().filter(function (x) { return x.id === gid; })[0];
    if (!g) return '<div class="gr-empty">Groupe introuvable.</div>';
    var mem = membersOf(gid);
    var npts = mem.reduce(function (s, m) { return s + (m.nb_points || 0); }, 0);
    var rows = mem.slice().sort(function (a, b) { return (b.nb_points || 0) - (a.nb_points || 0) || kNum(b.ca_eur) - kNum(a.ca_eur); }).map(function (f) {
      return '<button class="gr-mrow" onclick="V2.grossisteOpen(\'' + esc(f.id) + '\')"><i class="gr-pas memb"></i><span class="gr-mname">' + esc(aff(f)) + (f.lien_ip ? '<em class="gr-mip">IP</em>' : '') + '</span><span class="gr-mca">' + (f.nb_points || 0) + ' site' + ((f.nb_points || 0) > 1 ? 's' : '') + '</span><span class="gr-marr">→</span></button>';
    }).join('');
    return '<div class="gr-fiche" style="--gc:' + esc(g.couleur) + '"><div class="gr-fhead"><div><h2>' + esc(aff(g)) + '</h2><div class="gr-fmeta"><span class="gr-gstat s-' + statutCls(g.statut) + '">' + esc(g.statut) + '</span>' +
      (g.part_marche ? '<span>part de marché : ' + esc(g.part_marche) + '</span>' : '') + '<span>' + mem.length + ' acteur' + (mem.length > 1 ? 's' : '') + ' · ' + npts + ' site' + (npts > 1 ? 's' : '') + ' sur la carte</span></div></div></div>' +
      (g.resume ? '<div class="gr-retenir"><p>' + esc(g.resume) + '</p></div>' : '') +
      sec('Société mère', '<p class="gr-proprio"><b>' + esc(g.mere || 'non publié') + '</b>' + (g.pays ? ' · ' + esc(g.pays) : '') + '</p>') +
      '<button type="button" class="gr-prix gr-prix-s" onclick="V2.concCentrerGroupe(\'' + esc(gid) + '\')">Montrer le groupe sur la carte</button>' +
      sec('Acteurs du groupe', '<div class="gr-lvl">' + rows + '</div>') +
      sec('Actualité du groupe', actuFilHtml(actuDe(mem))) + '</div>';
  }

  // ── ACTUALITÉS ──────────────────────────────────────────────────
  // Encadré « Vérifié » : faits relus à la source lors de la veille mensuelle,
  // au-dessus du fil ramassé chaque jour par le robot.
  function verifHtml() {
    var items = (VERIF && VERIF.items) || [];
    if (!items.length) return '';
    var ligne = function (i) {
      var dt = (i.date || '').split('-').reverse().slice(0, 2).join('/');
      return '<li class="gr-vf-it"><span class="gr-vf-d">' + esc(dt) + '</span><div>' +
        '<a href="' + esc(i.url) + '" target="_blank" rel="noopener"><b>' + esc(i.titre) + '</b></a>' +
        (i.nonConfirme ? ' <span class="gr-vf-nc">non confirmé</span>' : '') +
        '<span class="gr-vf-t">' + esc(i.texte || '') + '</span>' +
        '<span class="gr-vf-s">' + esc(i.source || '') + ' ↗</span></div></li>';
    };
    var tete = items.slice(0, 4).map(ligne).join('');
    var reste = items.slice(4);
    var maj = (VERIF.maj || '').split('-').reverse().join('/');
    return '<section class="gr-vf"><div class="gr-vf-h"><span class="gr-vf-k">Vérifié</span>' +
        '<span class="gr-vf-m">Faits relus à la source ' + esc(VERIF.periode || '') + ' · veille du ' + esc(maj) + '</span></div>' +
      '<ul class="gr-vf-l">' + tete + '</ul>' +
      (reste.length ? '<details class="gr-vf-plus"><summary>Voir les ' + reste.length + ' autres faits</summary><ul class="gr-vf-l">' + reste.map(ligne).join('') + '</ul></details>' : '') +
      (VERIF.rien ? '<p class="gr-vf-rien">' + esc(VERIF.rien) + '</p>' : '') +
      '</section>';
  }
  function actuHtml() {
    var items = (ACTU && ACTU.items) || [];
    var tags = {}; items.forEach(function (i) { tags[i.tag || ''] = (tags[i.tag || ''] || 0) + 1; });
    var nLibre = items.filter(function (i) { return i.libre; }).length;
    var chips = '<button class="gr-actutag' + (actuTag === '' ? ' on' : '') + '" onclick="V2.grossisteActuTag(\'\')">Tout (' + items.length + ')</button>' +
      '<button class="gr-actutag lib' + (actuTag === '__libre' ? ' on' : '') + '" onclick="V2.grossisteActuTag(\'__libre\')">Accès libre (' + nLibre + ')</button>';
    Object.keys(tags).filter(function (t) { return t; }).forEach(function (t) {
      chips += '<button class="gr-actutag' + (actuTag === t ? ' on' : '') + '" onclick="V2.grossisteActuTag(\'' + esc(t) + '\')">' + esc(TAGNAME[t] || t) + ' (' + tags[t] + ')</button>';
    });
    var shown = actuTag === '__libre' ? items.filter(function (i) { return i.libre; }) : (actuTag ? items.filter(function (i) { return i.tag === actuTag; }) : items);
    var rows = shown.map(function (i) {
      return '<a class="gr-actu" href="' + esc(i.url) + '" target="_blank" rel="noopener">' +
        '<div class="gr-actu-main"><b>' + esc(i.titre) + '</b>' +
          (i.resume ? '<span class="gr-actu-res">' + esc(i.resume) + '</span>' : '') +
          '<span class="gr-actu-meta"><span class="gr-actu-acc ' + (i.libre ? 'lib' : 'abo') + '">' + (i.libre ? 'accès libre' : 'abonnés') + '</span> · ' + esc(i.source || '') + (i.tag ? ' · <i>' + esc(TAGNAME[i.tag] || i.tag) + '</i>' : '') + ' · ' + timeAgo(i.date) + '</span></div>' +
        '<span class="gr-actu-go">↗</span></a>';
    }).join('') || '<div class="gr-empty">Pas encore d\'actualités. Le robot de veille tourne chaque jour.</div>';
    var maj = ACTU && ACTU.maj ? 'Mis à jour ' + timeAgo(ACTU.maj) : '';
    return verifHtml() + '<div class="gr-actubar">' + chips + '</div>' +
      '<div class="gr-actumaj">' + esc(maj) + ' · sources : FSPF, ANSM &amp; presse (Google News) — filtre « accès libre » pour l\'info lisible en entier</div>' +
      '<div class="gr-actulist">' + rows + '</div>';
  }

  // ── actions ─────────────────────────────────────────────────────
  // 14/10/2026 — la fiche est une ADRESSE (#concurrents/g/<id>), ouverte par la carte (v2-concurrents-carte.js).
  // L'actualité est de nouveau dans Concurrents (onglet « Actualité ») ; Infos du jour garde son panneau.
  V2.grossisteTab = function (v) { V2.go('concurrents', v === 'actu' ? 'actu' : 'annuaire'); };
  V2.grossisteVoir = function (id) { V2.grossisteOpen(id); };
  V2.grossisteOpen = function (id) {
    V2.go('concurrents', 'g/' + id);
    try { history.replaceState(null, '', '#concurrents/g/' + encodeURIComponent(id)); } catch (e) {}
  };
  V2.grossisteClose = function () { V2.go('concurrents', 'annuaire'); };
  // Contenu de la fiche, pour le volet de la carte. Charge données + actualité puis rend.
  V2.grossisteFiche = function (id, pts, cb) {
    injectCss();
    ensureData(function (err) {
      if (err) { cb('<div class="gr-empty">Base non chargée. Rechargez la page.</div>'); return; }
      ensureActu(function () { var g = byId(id); cb(g ? ficheHtml(g, pts) : '<div class="gr-empty">Fiche introuvable : ' + esc(id) + '.</div>'); });
    });
  };
  V2.grossisteGroupeFiche = function (gid, cb) {
    injectCss();
    ensureData(function (err) { if (err) { cb('<div class="gr-empty">Base non chargée.</div>'); return; } ensureActu(function () { cb(groupeFicheHtml(gid)); }); });
  };
  // Pour la carte : données + actualité prêtes, puis rappel.
  V2.grossistesPret = function (cb) { ensureData(function (err) { if (err) { cb(err); return; } ensureActu(function () { cb(); }); }); };
  V2.grossistesInfo = function () {
    return { data: DATA(), byId: byId, groupes: groupes, membres: membersOf, nom: shortNom, aff: aff, actuDe: actuDe, tagNom: TAGNAME, verif: VERIF, actu: ACTU, statutCls: statutCls, kNum: kNum };
  };
  function reAnnu(refocus) { var b = document.getElementById('gr-body'); if (b) b.innerHTML = annuaireHtml(); if (refocus) { var i = document.getElementById('gr-q'); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) {} } } }
  V2.grossisteGroupe = function (id) { openGroupe = (openGroupe === id ? null : id); reAnnu(); };
  V2.grossisteFilter = function (f) { filt = f; openGroupe = null; reAnnu(); };
  V2.grossisteSearch = function (v) { q = v || ''; reAnnu(true); };
  V2.grossisteSort = function (s) { sortBy = s; reAnnu(); };
  V2.grossisteActuTag = function (t) { actuTag = t; var el = document.getElementById('gr-actuwrap'); if (el) el.innerHTML = actuHtml(); };

  // ── corps, affiché DANS l'écran unique « Concurrents » ──────────
  // 14/09/2026 — demande de Will : grossistes concurrents et ressources
  // concurrents regroupés dans une seule feature. Ce module ne possède plus
  // d'écran : v2-concurrents.js l'appelle pour « Les grossistes » (acteurs)
  // et « L'actualité » (actu).
  V2.grossistesCorps = function (host, v) {
    injectCss();
    view = (v === 'actu') ? 'actu' : 'annuaire';
    host.innerHTML = '<div id="gr-body" class="gr-wrap"><div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div></div>';
    var body = document.getElementById('gr-body');
    if (view === 'actu') {
      ensureActu(function () { if (body) { body.innerHTML = '<div id="gr-actuwrap">' + actuHtml() + '</div>'; } });
    } else {
      ensureData(function () { if (body) body.innerHTML = annuaireHtml(); });
    }
  };
  // Mêmes fichiers (actualités + faits vérifiés), pour la phrase du jour et la
  // carte du secteur d'« Infos du jour » (v2-infos-concurrents.js).
  V2.grossistesActuDonnees = function (cb) {
    ensureActu(function () { cb((ACTU && ACTU.items) || [], (VERIF && VERIF.items) || []); });
  };
  // Chiffres vivants des portes de l'accueil « Concurrents » : même compte
  // d'acteurs que la liste, articles des 7 derniers jours, fraîcheur du robot.
  V2.grossistesChiffres = function (cb) {
    ensureData(function () {
      var acteurs = list().length;
      ensureActu(function () {
        var items = (ACTU && ACTU.items) || [], now = Date.now();
        var semaine = items.filter(function (i) { return now - new Date(i.date) < 7 * 864e5; }).length;
        cb({ acteurs: acteurs, groupes: groupes().length, semaine: semaine, maj: ACTU && ACTU.maj ? timeAgo(ACTU.maj) : '' });
      });
    });
  };
  // Ancienne adresse #grossistes (favoris, historique) → le nouvel écran.
  V2.pages.grossistes = {
    render: function (root, param) {
      var p = param === 'actu' ? 'actu' : 'annuaire';
      V2.route = { name: 'concurrents', param: p };
      try { history.replaceState(null, '', '#concurrents/' + p); } catch (e) {}
      if (V2.pages.concurrents) V2.pages.concurrents.render(root, p);
    }
  };

  function injectCss() {
    if (document.getElementById('v2-grossistes-css')) return;
    var s = document.createElement('style'); s.id = 'v2-grossistes-css';
    s.textContent = [
      '.gr-wrap{padding-bottom:40px}',
      '.gr-title h1{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:0}',
      '.gr-title p{color:var(--muted);font-size:13px;margin:4px 0 0}',
      '.gr-tabs{display:flex;gap:8px;margin:16px 0}',
      '.gr-tab{padding:9px 16px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ip-ink);font:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.gr-tab.on{background:var(--ip-blue,#0057FF);color:#fff;border-color:transparent}',
      '.gr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}',
      '.gr-card{text-align:left;border:1px solid var(--line);border-radius:16px;background:var(--card);padding:16px 17px;cursor:pointer;font:inherit;color:var(--ip-ink);display:flex;flex-direction:column;gap:10px;transition:border-color .15s,transform .12s,box-shadow .15s}',
      '.gr-card:hover{border-color:color-mix(in srgb,var(--ip-blue) 40%,var(--line));transform:translateY(-2px);box-shadow:0 10px 26px rgba(16,19,28,.08)}',
      '.gr-card-h{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.gr-card-h b{font-size:15.5px;font-weight:800;letter-spacing:-.01em}',
      '.gr-card-grp{font-size:12px;color:var(--muted);margin-top:-4px}',
      '.gr-card-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:8px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}',
      '.gr-card-kpis>div{display:flex;flex-direction:column}',
      '.gr-card-kpis b{font-size:14px;font-weight:800;font-variant-numeric:tabular-nums}',
      '.gr-card-kpis span{font-size:12px;color:var(--muted)}',
      '.gr-card-ens{display:flex;flex-wrap:wrap;gap:5px}',
      '.gr-chip{font-size:12px;font-weight:600;padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--ip-blue) 8%,var(--card));color:var(--ip-blue);border:1px solid color-mix(in srgb,var(--ip-blue) 18%,transparent)}',
      '.gr-card-go{font-size:12px;font-weight:700;color:var(--ip-blue)}',
      '.gr-type{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}',
      '.gr-type.nat{background:#E9F0FF;color:#0034A0}.gr-type.coop{background:#E7F8EF;color:#0B7A44}.gr-type.sl{background:#FFF2E0;color:#A35B00}',
      '.gr-fiab{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px}',
      '.gr-fiab.hi{background:#E7F8EF;color:#0B7A44}.gr-fiab.mid{background:#FFF6E0;color:#8A6100}.gr-fiab.lo{background:#FDE8E8;color:#B42318}',
      '.gr-fiche{max-width:820px}',
      '.gr-back{border:none;background:none;color:var(--ip-blue);font:inherit;font-weight:700;font-size:13px;cursor:pointer;padding:0;margin-bottom:12px}',
      '.gr-crumb{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;margin-bottom:12px}',
      '.gr-crumb button{border:none;background:none;color:var(--ip-blue);font:inherit;font-weight:700;cursor:pointer;padding:0}',
      '.gr-crumb span{color:var(--muted)}.gr-crumb b{color:var(--ip-ink);font-weight:800}',
      '.gr-angles{border:1px solid color-mix(in srgb,var(--ip-blue) 30%,var(--line));background:color-mix(in srgb,var(--ip-blue) 6%,var(--card));border-radius:12px;padding:12px 15px;margin:16px 0}',
      '.gr-angles h4{color:var(--ip-blue)!important}',
      '.gr-fhead h2{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0}',
      '.gr-fmeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:12.5px;color:var(--muted)}',
      '.gr-fkpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}',
      '@media(max-width:640px){.gr-fkpis{grid-template-columns:repeat(2,1fr)}}',
      '.gr-fkpi{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--card)}',
      '.gr-fkpi b{display:block;font-size:16px;font-weight:800;letter-spacing:-.01em}',
      '.gr-fkpi span{font-size:12px;color:var(--muted)}',
      '.gr-sec{margin:16px 0}',
      '.gr-sec h4{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;color:var(--muted);margin:0 0 8px}',
      '.gr-sec p{margin:0;font-size:14px;line-height:1.55}',
      '.gr-ul{margin:0;padding-left:18px;font-size:14px;line-height:1.6}',
      '.gr-ensrow{display:flex;align-items:baseline;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)}',
      '.gr-ensrow b{font-size:13.5px;font-weight:700}.gr-ensrow span{font-size:12px;color:var(--muted)}',
      '.gr-finsec{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:color-mix(in srgb,var(--ip-blue) 3%,var(--card))}',
      '.gr-fingraph{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;padding:6px 0 4px}',
      '.gr-finbar{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:70px}',
      '.gr-finbar i{width:34px;background:linear-gradient(180deg,#0057FF,#0034A0);border-radius:4px 4px 0 0}',
      '.gr-finbar b{font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums}',
      '.gr-finbar u{font-size:12px;text-decoration:none;font-weight:700}',
      '.gr-finbar u.pos{color:#0B7A44}.gr-finbar u.neg{color:#B42318}',
      '.gr-finbar span{font-size:12px;color:var(--muted);font-weight:600}',
      '.gr-finlg{font-size:12px;color:var(--muted);margin-top:6px}',
      '.gr-finconf{margin:0;font-size:12.5px;color:var(--muted)}',
      '.gr-finmeta{margin-top:10px;font-size:12px;color:var(--muted)}.gr-finmeta a{color:var(--ip-blue);text-decoration:none}',
      '.gr-src{margin:14px 0;font-size:12px;color:var(--muted);word-break:break-all}',
      '.gr-src a{color:var(--ip-blue);text-decoration:none}',
      '.gr-notes{margin-top:22px;border-top:2px solid var(--line);padding-top:16px}',
      '.gr-notes h4{font-size:14px;font-weight:800;margin:0 0 8px}',
      '.gr-vf{margin:0 0 22px;padding:16px 18px 14px;border:1px solid color-mix(in srgb,var(--ip-blue,#0057FF) 22%,var(--line));border-radius:16px;background:linear-gradient(160deg,color-mix(in srgb,var(--ip-blue,#0057FF) 7%,var(--card)) 0%,var(--card) 55%);box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 8px 24px -14px color-mix(in srgb,var(--ip-blue,#0057FF) 45%,transparent)}',
      '.gr-vf-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px;margin-bottom:10px}',
      '.gr-vf-k{font-size:12px;font-weight:800;letter-spacing:.02em;color:var(--ip-blue,#0057FF)}',
      '.gr-vf-m{font-size:12px;color:var(--muted)}',
      '.gr-vf-l{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}',
      '.gr-vf-it{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--line)}',
      '.gr-vf-d{flex:0 0 40px;font-size:12px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;padding-top:1px}',
      '.gr-vf-it > div{flex:1;min-width:0}',
      '.gr-vf-it a{color:var(--ip-ink);text-decoration:none}.gr-vf-it a:hover b{color:var(--ip-blue,#0057FF)}',
      '.gr-vf-it b{font-size:14px;font-weight:650;line-height:1.35}',
      '.gr-vf-t{display:block;font-size:12.5px;line-height:1.5;color:var(--ip-ink);margin:3px 0 2px}',
      '.gr-vf-s{display:block;font-size:12px;color:var(--muted)}',
      '.gr-vf-nc{font-size:12px;font-weight:800;padding:1px 7px;border-radius:999px;background:#FFF4E0;color:#8A4B00;white-space:nowrap}',
      '.gr-vf-plus summary{cursor:pointer;padding:10px 0 2px;border-top:1px solid var(--line);font-size:12.5px;font-weight:700;color:var(--ip-blue,#0057FF)}',
      '.gr-vf-rien{margin:10px 0 0;font-size:12px;line-height:1.5;color:var(--muted)}',
      '.gr-actubar{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px}',
      '.gr-actutag{min-height:var(--tap-min);padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ip-ink);font:inherit;font-size:12px;font-weight:600;cursor:pointer}',
      '.gr-actutag.on{background:var(--ip-blue,#0057FF);color:#fff;border-color:transparent}',
      '.gr-actumaj{font-size:12px;color:var(--muted);margin-bottom:12px}',
      '.gr-actulist{display:flex;flex-direction:column;gap:2px}',
      '.gr-actu{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid transparent;border-radius:12px;text-decoration:none;color:var(--ip-ink);transition:background .12s,border-color .12s}',
      '.gr-actu:hover{background:color-mix(in srgb,var(--ip-blue) 5%,var(--card));border-color:var(--line)}',
      '.gr-actu-main{flex:1;min-width:0}',
      '.gr-actu-main b{display:block;font-size:14px;font-weight:600;line-height:1.35}',
      '.gr-actu-meta{font-size:12px;color:var(--muted)}.gr-actu-meta i{color:var(--ip-blue);font-style:normal;font-weight:600}',
      '.gr-actu-go{color:var(--muted);font-weight:700}',
      '.gr-actu-res{display:block;font-size:12px;line-height:1.45;color:var(--muted);margin:3px 0 4px}',
      '.gr-actu-acc{font-weight:800;font-size:12px;padding:1px 6px;border-radius:999px}',
      '.gr-actu-acc.lib{background:#E7F8EF;color:#0B7A44}.gr-actu-acc.abo{background:#FDECEC;color:#B42318}',
      '.gr-actutag.lib.on{background:#0B7A44}',
      '.gr-empty{padding:40px 20px;text-align:center;color:var(--muted);font-size:13.5px}',
      // Niveau 0 — bandeau de marché
      '.gr-market{margin-bottom:16px}',
      '.gr-mtiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}',
      '@media(max-width:560px){.gr-mtiles{grid-template-columns:repeat(2,1fr)}}',
      '.gr-mtiles>div{border:1px solid var(--line);border-radius:12px;padding:11px 13px;background:var(--card)}',
      '.gr-mtiles b{display:block;font-size:17px;font-weight:800;letter-spacing:-.01em}',
      '.gr-mtiles span{font-size:12px;color:var(--muted)}',
      '.gr-mbar{display:flex;height:14px;border-radius:7px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}',
      '.gr-mbseg{height:100%}',
      '.gr-mbleg{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}',
      '.gr-mbl{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--ip-ink)}',
      '.gr-mbl i{width:9px;height:9px;border-radius:2px}',
      // Documents officiels
      '.gr-docs{margin-bottom:14px;border:1px solid var(--line);border-radius:12px;background:var(--card);overflow:hidden}',
      '.gr-docs>summary{cursor:pointer;padding:12px 15px;font-size:13px;font-weight:800;list-style:none}',
      '.gr-docs>summary::-webkit-details-marker{display:none}',
      '.gr-doc{padding:12px 15px;border-top:1px solid var(--line)}',
      '.gr-doc-h{display:flex;align-items:baseline;gap:8px}',
      '.gr-doc-h b{font-size:13px;font-weight:700;flex:1}',
      '.gr-doc-acc{font-size:12px;font-weight:800;padding:1px 7px;border-radius:999px}',
      '.gr-doc-acc.lib{background:#E7F8EF;color:#0B7A44}.gr-doc-acc.abo{background:#FDECEC;color:#B42318}',
      '.gr-doc-ed{font-size:12px;color:var(--muted);margin:2px 0 6px}',
      '.gr-doc-cc{margin:0;padding-left:16px;font-size:12px;line-height:1.5;color:var(--ip-ink)}',
      '.gr-doc-lk{display:inline-flex;align-items:center;min-height:var(--tap-min);margin-top:7px;font-size:12px;font-weight:700;color:var(--ip-blue);text-decoration:none}',
      // Contrôles sticky (recherche + tri + filtres)
      '.gr-controls{position:sticky;top:0;z-index:20;background:var(--paper,var(--card));padding:10px 0 8px;margin-bottom:6px;border-bottom:1px solid var(--line)}',
      '.gr-search{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--line);border-radius:11px;background:var(--card);margin-bottom:9px}',
      '.gr-search svg{color:var(--muted);flex:none}',
      '.gr-search input{flex:1;border:none;background:none;font:inherit;font-size:14px;color:var(--ip-ink);outline:none;min-width:0}',
      '.gr-qx{border:none;background:none;color:var(--muted);font-size:14px;cursor:pointer;flex:none}',
      '.gr-ctlrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}',
      '.gr-sorts{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--muted)}',
      '.gr-sorts>span{margin-right:2px;font-weight:600}',
      '.gr-sort{min-height:var(--tap-min);min-width:var(--tap-min);padding:4px 10px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ip-ink);font:inherit;font-size:12px;font-weight:700;cursor:pointer}',
      '.gr-sort.on{background:var(--ip-ink);color:#fff;border-color:transparent}',
      '.gr-count{font-size:12px;font-weight:700;color:var(--muted);white-space:nowrap}',
      // Filtres (scroll-x une ligne)
      '.gr-filts{display:flex;gap:7px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px;scrollbar-width:none}',
      '.gr-filts::-webkit-scrollbar{display:none}',
      '.gr-filt{white-space:nowrap;flex:none;min-height:var(--tap-min);padding:6px 13px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ip-ink);font:inherit;font-size:12px;font-weight:600;cursor:pointer}',
      '.gr-filt.on{background:var(--ip-blue,#0050E6);color:#fff;border-color:transparent}',
      // Carte groupe : 3 lignes, part TOUJOURS visible + micro-barre
      '.gr-ghrow{display:flex;align-items:center;gap:10px}',
      '.gr-gnom{flex:1;min-width:0;font-size:15.5px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.gr-gbar{height:4px;border-radius:3px;margin:8px 0 6px;background:color-mix(in srgb,var(--gc) 14%,transparent)}',
      '.gr-gbar i{display:block;height:100%;border-radius:3px}',
      '.gr-gband{display:flex;gap:0;font-size:12px;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.gr-gband span{padding:0 12px;border-left:1px solid var(--line)}',
      '.gr-gband span:first-child{padding-left:0;border-left:none}',
      '.gr-gband b{font-weight:800}',
      '.gr-fildummy{}',
      // Niveau 1 — cartes de groupe
      '.gr-glist{display:flex;flex-direction:column;gap:10px}',
      '.gr-gcard{border:1px solid var(--line);border-left:5px solid var(--gc);border-radius:14px;background:var(--card);overflow:hidden}',
      '.gr-gcard.open{box-shadow:0 10px 28px rgba(16,19,28,.09)}',
      '.gr-ghead{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;border:none;background:none;cursor:pointer;font:inherit;color:var(--ip-ink);text-align:left}',
      // téléphone : nom / micro-barre / société mère / bandeau chiffres empilés (en ligne, tout se tassait à 390 px) — APRÈS la règle de base
      '@media(max-width:640px){.gr-ghead{flex-direction:column;align-items:stretch;gap:0}.gr-gband{flex-wrap:wrap;row-gap:4px}}',
      '.gr-grang{font-size:13px;font-weight:800;color:color-mix(in srgb,var(--gc) 60%,black);min-width:26px}',
      '.gr-gmain{flex:1;min-width:0}',
      '.gr-gmain b{display:block;font-size:15.5px;font-weight:800;letter-spacing:-.01em;line-height:1.2}',
      '.gr-gmere{font-size:12px;color:var(--muted)}',
      '.gr-gkpis{display:flex;gap:16px;flex:none}',
      '@media(max-width:640px){.gr-gkpis>div:nth-child(3){display:none}}',
      '@media(max-width:460px){.gr-gkpis{display:none}}',
      '.gr-gkpis>div{text-align:right}',
      '.gr-gkpis b{display:block;font-size:14px;font-weight:800;font-variant-numeric:tabular-nums}',
      '.gr-gkpis span{font-size:12px;color:var(--muted)}',
      '.gr-gstat{font-size:12px;font-weight:800;padding:3px 8px;border-radius:999px;white-space:nowrap;flex:none}',
      '.gr-gstat.s-nat{background:#E9F0FF;color:#0034A0}.gr-gstat.s-coop{background:#E7F8EF;color:#0B7A44}.gr-gstat.s-sl{background:#FFF2E0;color:#A35B00}.gr-gstat.s-dom{background:#E0F7FA;color:#00707C}.gr-gstat.s-exp{background:#F3F4E7;color:#6B6B1F}.gr-gstat.s-warn{background:#FDE8E8;color:#B42318}.gr-gstat.s-us{background:#FFF3E0;color:#8A4B00}',
      // Maillage (fiches établissements Intégral)
      '.gr-maill{border:1px solid color-mix(in srgb,#F39A1B 35%,var(--line));background:color-mix(in srgb,#F39A1B 5%,var(--card));border-radius:12px;padding:14px 16px}',
      '.gr-maillg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}',
      '.gr-mcell.dep{background:color-mix(in srgb,#F39A1B 12%,var(--card))}.gr-mcell.dep b{color:#A35B00}',
      '.gr-depts{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px}',
      '.gr-dchip{font-size:12px;font-weight:600;padding:3px 8px;border-radius:7px;background:var(--card);border:1px solid var(--line);color:var(--muted);font-variant-numeric:tabular-nums}',
      '.gr-dchip.has{border-color:color-mix(in srgb,#0B7A44 40%,var(--line));background:color-mix(in srgb,#0B7A44 6%,var(--card));color:var(--ip-ink)}',
      '.gr-dchip b{color:var(--ip-ink)}',
      '.gr-maill-w{margin-top:10px;font-size:12px;color:#A35B00;background:color-mix(in srgb,#F39A1B 8%,transparent);padding:7px 10px;border-radius:8px}',
      '.gr-mcell{border-radius:10px;padding:12px 14px;text-align:center}',
      '.gr-mcell.cli{background:color-mix(in srgb,#0B7A44 10%,var(--card))}.gr-mcell.pro{background:color-mix(in srgb,#0050E6 8%,var(--card))}',
      '.gr-mcell b{display:block;font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1}',
      '.gr-mcell.cli b{color:#0B7A44}.gr-mcell.pro b{color:#0050E6}',
      '.gr-mcell span{display:block;font-size:12px;color:var(--muted);margin-top:3px}',
      '.gr-mcell u{display:block;font-size:12px;text-decoration:none;color:var(--muted);margin-top:4px}',
      '.gr-maill-n{margin-top:10px;font-size:12.5px;color:var(--ip-ink)}',
      '.gr-gchev{font-size:12px;font-weight:700;color:var(--muted);flex:none}',
      // Niveau 2 — arborescence mère → membres → enseignes
      '.gr-gbody{padding:2px 16px 16px;border-top:1px solid var(--line)}',
      '.gr-gres{margin:12px 0 0;font-size:12.5px;line-height:1.5;color:var(--muted)}',
      '.gr-lvl{margin-top:14px}',
      '.gr-lvlab{display:block;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:6px}',
      '.gr-pas{width:11px;height:11px;flex:none;display:inline-block;background:var(--gc)}',
      '.gr-pas.mere{border-radius:3px}.gr-pas.memb{border-radius:50%}.gr-pas.ens{border-radius:50%;background:transparent!important;box-shadow:inset 0 0 0 2px var(--gc)}',
      '.gr-mere{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--ip-ink)}',
      '.gr-mrow{display:flex;align-items:center;gap:9px;width:100%;min-height:44px;padding:11px 8px;border:none;border-radius:8px;background:none;cursor:pointer;font:inherit;color:var(--ip-ink);text-align:left}',
      '.gr-mrow:hover{background:color-mix(in srgb,var(--gc) 7%,transparent)}',
      '.gr-mname{flex:1;min-width:0;font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.gr-mip{font-style:normal;font-size:12px;font-weight:800;background:#0E7C86;color:#fff;padding:1px 5px;border-radius:999px;margin-left:6px}',
      '.gr-mca{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.gr-marr{color:var(--gc);font-weight:700}',
      '.gr-ens{display:flex;flex-wrap:wrap;gap:6px}',
      '.gr-enschip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:4px 9px;border-radius:999px;background:color-mix(in srgb,var(--gc) 8%,var(--card));border:1px solid color-mix(in srgb,var(--gc) 22%,transparent)}',
      '.gr-cov{margin-bottom:14px;padding:12px 16px;border-radius:12px;background:color-mix(in srgb,var(--ip-blue) 5%,var(--card));border:1px solid var(--line)}',
      '.gr-cov b{display:block;font-size:14px;font-weight:800}',
      '.gr-cov span{display:block;margin-top:4px;font-size:12px;line-height:1.5;color:var(--muted)}',
      '.gr-card.ip{border-color:color-mix(in srgb,#0E7C86 40%,var(--line));background:color-mix(in srgb,#0E7C86 4%,var(--card))}',
      '.gr-iplink{font-size:12px;font-weight:800;padding:2px 8px;border-radius:999px;background:#0E7C86;color:#fff;white-space:nowrap}',
      '.gr-prix{display:flex;align-items:center;width:100%;min-height:48px;margin:12px 0;padding:0 16px;border:1px solid color-mix(in srgb,var(--ip-blue) 28%,var(--line));border-radius:12px;background:color-mix(in srgb,var(--ip-blue) 6%,var(--card));font:inherit;font-size:14px;font-weight:700;color:var(--ip-blue);text-align:left;cursor:pointer}',
      '.gr-prix:hover{background:color-mix(in srgb,var(--ip-blue) 10%,var(--card))}',
      '.gr-ipnote{margin:10px 0;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,#0E7C86 8%,var(--card));border:1px solid color-mix(in srgb,#0E7C86 25%,transparent);font-size:12.5px;font-weight:600;color:#0A5A62}',
      /* 14/10/2026 — fiche unique : sections ajoutées (propriétaire, chiffres, implantations, décisions, fil d'actualité) */
      '.gr-fiche{max-width:none}',
      '.gr-fkpi b.np,.gr-ent-v b.np{color:var(--muted);font-weight:600;font-size:13px}',
      '.gr-np{margin:0;font-size:13px;line-height:1.5;color:var(--muted)}',
      '.gr-retenir{margin:14px 0;padding:14px 16px;border-radius:14px;border:1px solid color-mix(in srgb,var(--accent,var(--ip-blue)) 30%,var(--line));background:linear-gradient(180deg,color-mix(in srgb,var(--accent,var(--ip-blue)) 9%,var(--card)),var(--card))}',
      '.gr-retenir h4{margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ip-blue-d)}',
      '.gr-retenir p{margin:0;font-size:14px;line-height:1.55;color:var(--ip-ink)}',
      '.gr-proprio{margin:0 0 8px;font-size:14px;line-height:1.5}.gr-proprio em{font-style:normal;color:var(--muted)}',
      '.gr-chaine{list-style:none;margin:0;padding:0 0 0 14px;border-left:2px solid var(--line-strong,var(--line))}',
      '.gr-chaine li{position:relative;padding:6px 0 8px 14px;font-size:13.5px;line-height:1.45}',
      '.gr-chaine li::before{content:"";position:absolute;left:-6px;top:13px;width:10px;height:10px;border-radius:50%;background:var(--card);border:2px solid var(--ip-blue)}',
      '.gr-chaine li.r-filiale::before{background:var(--ip-blue)}',
      '.gr-sir{font-size:12px;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.gr-ch-p,.gr-ch-s{display:block;font-size:12px;color:var(--muted)}.gr-ch-s a{color:var(--ip-blue);text-decoration:none}',
      '.gr-dirs{margin-top:10px;font-size:13px;line-height:1.55}.gr-dirs>span{display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:2px}',
      '.gr-ent{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:10px}',
      '.gr-ent-r{display:flex;flex-wrap:wrap;gap:4px 16px;justify-content:space-between;padding:10px 14px;border-top:1px solid var(--line)}.gr-ent-r:first-child{border-top:0}',
      '.gr-ent-n{flex:1 1 220px;min-width:0;font-size:13.5px}.gr-ent-ro{display:block;font-size:12px;color:var(--muted)}',
      '.gr-ent-v{display:flex;gap:14px;font-size:13px;font-variant-numeric:tabular-nums}.gr-ent-v i{font-style:normal;font-size:12px;color:var(--muted);margin-right:3px}',
      '.gr-chif{margin-bottom:8px}.gr-srctxt{font-size:12px;color:var(--muted)}',
      '.gr-impl{margin:0 0 4px;font-size:14px}',
      '.gr-prix-s{display:inline-flex;width:auto;min-height:44px;margin:8px 0}',
      '.gr-deps{display:flex;flex-direction:column;gap:4px;margin-top:6px}',
      '.gr-dep{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;font-size:13px}.gr-dep>b{min-width:30px;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.gr-ville{min-height:32px;padding:3px 10px;border:1px solid var(--line);border-radius:999px;background:var(--card);font:inherit;font-size:12.5px;font-weight:600;color:var(--ip-ink);cursor:pointer}',
      '.gr-ville:hover{border-color:var(--ip-blue)}.gr-ville.dec{border-color:var(--bad);color:var(--bad-d,var(--bad))}.gr-ville em{font-style:normal;font-size:12px;font-weight:800}',
      '.gr-dec{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}',
      '.gr-dec>li{padding:12px 14px;border:1px solid color-mix(in srgb,var(--bad) 28%,var(--line));border-left:4px solid var(--bad);border-radius:10px;background:var(--card)}',
      '.gr-dec-h{font-size:13px}.gr-dec-t{font-size:12px;font-weight:800;padding:1px 8px;border-radius:999px;background:color-mix(in srgb,var(--bad) 12%,var(--card));color:var(--bad-d,var(--bad));text-transform:uppercase}',
      '.gr-dec p{margin:6px 0 0;font-size:13px;line-height:1.5}.gr-dec a{display:inline-block;margin-top:6px;font-size:12.5px;font-weight:700;color:var(--ip-blue);text-decoration:none}',
      '.gr-fil{list-style:none;margin:0;padding:0}',
      '.gr-fil li{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--line)}.gr-fil li:first-child{border-top:0}',
      '.gr-fil-d{flex:0 0 74px;font-size:12px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;padding-top:2px}',
      '.gr-fil li>div{flex:1;min-width:0}.gr-fil b{font-size:14px;font-weight:650;line-height:1.35}.gr-fil a{color:var(--ip-ink);text-decoration:none}.gr-fil a:hover{color:var(--ip-blue)}',
      '.gr-fiche{overflow-wrap:anywhere}.gr-fil li>div{min-width:0}',
      '.gr-fil-t{display:block;font-size:12.5px;line-height:1.5;margin:3px 0 2px}.gr-fil-s{display:block;font-size:12px;color:var(--muted)}',
      '.gr-fil-s u{text-decoration:none;font-weight:800;margin-right:4px}.gr-fil-s u.k-verifie{color:#0B7A44}.gr-fil-s u.k-enquete{color:var(--ip-blue-d)}.gr-fil-s u.k-presse{color:var(--muted-d,var(--muted))}',
      '.gr-histo{list-style:none;margin:0;padding:0}.gr-histo li{display:flex;gap:12px;padding:6px 0;font-size:13.5px;line-height:1.5}.gr-histo li>span{flex:0 0 64px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.gr-histo small a{color:var(--ip-blue);text-decoration:none}',
      '.gr-grplink{border:0;background:none;padding:0;font:inherit;font-weight:700;color:var(--ip-blue);cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
      '.gr-pays{display:inline-block;font-style:normal;font-size:12px;font-weight:800;padding:0 6px;border-radius:5px;background:var(--surf-sunken,#F4F6FB);color:var(--muted-d,var(--muted));margin-right:4px}',
      '.gr-soc{margin:2px 0 0;font-size:13px;color:var(--muted-d,var(--muted))}',
      '.gr-mserie{margin-top:6px;font-size:12px;color:var(--muted)}',
      '.gr-det>summary{display:flex;align-items:center;gap:8px;min-height:44px;cursor:pointer;list-style:none;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;color:var(--muted)}',
      '.gr-det>summary::-webkit-details-marker{display:none}',
      '.gr-det>summary::before{content:"";width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg);transition:transform .15s var(--ease);flex:none}',
      '.gr-det[open]>summary::before{transform:rotate(45deg)}',
      '.gr-det-b{padding:0 0 6px}',
      '.gr-det-in{margin:6px 0 0}.gr-det-in>summary{min-height:44px;font-size:13px;font-weight:700;text-transform:none;letter-spacing:0;color:var(--ip-blue)}',
      '.gr-finsec.gr-det{padding:0 14px}.gr-det .gr-sec{margin:12px 0}',
      '.gr-nonrep{margin:12px 0;padding:12px 14px;border-radius:12px;border:1px solid color-mix(in srgb,var(--warn,#B7791F) 40%,var(--line));background:color-mix(in srgb,var(--warn,#B7791F) 8%,var(--card))}',
      '.gr-nonrep h4{margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--c-amber-txt,#8A4B00)}.gr-nonrep p{margin:0;font-size:13px;line-height:1.5}',
      '.gr-mnr{font-style:normal;font-size:12px;font-weight:700;margin-left:6px;padding:1px 7px;border-radius:999px;background:var(--surf-sunken,#F4F6FB);color:var(--muted-d,var(--muted))}',
      '.gr-ferm{margin-top:8px;font-size:13px}.gr-ferm summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:700;color:var(--ip-blue)}.gr-ferm ul{margin:0;padding-left:18px;line-height:1.7}',
      '.gr-dec-m{margin:6px 0 0;font-size:13px}.gr-notes-al{margin:16px 0 6px!important;font-size:13px!important;color:var(--muted)}',
    ].join('');
    document.head.appendChild(s);
  }
})();

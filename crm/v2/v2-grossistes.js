/* CRM V2 · Concurrents → Grossistes-répartiteurs (pages.grossistes)
   Deux parties : ANNUAIRE des concurrents (agences, CA, géo, enseignes affiliées,
   partenariats, livraison, conditions) + notes terrain éditables par item ; et
   ACTUALITÉS du secteur (veille Google News quotidienne, grossistes-actu.json).
   Données : grossistes-data.js (window.GROSSISTES_DATA, lazy) + grossistes-actu.json (fetch). */
(function () {
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ICO = function (n, s, w) { return V2.ICO ? V2.ICO(n, s, w) : ''; };
  var CB = '?v=20260713n';

  var view = 'annuaire';   // 'annuaire' | 'actu'
  var selId = null;        // grossiste ouvert en fiche
  var openGroupe = null;   // groupe déplié (niveau 2)
  var filt = '';           // filtre statut des groupes
  var actuTag = '';        // filtre actualités par grossiste
  var ACTU = null;         // cache actualités

  function DATA() { return window.GROSSISTES_DATA || null; }
  function list() { var d = DATA(); return (d && d.grossistes) || []; }
  function byId(id) { return list().filter(function (g) { return g.id === id; })[0] || null; }

  // ── chargement paresseux ────────────────────────────────────────
  function ensureData(cb) {
    if (window.GROSSISTES_DATA) { cb(); return; }
    var s = document.createElement('script'); s.src = 'grossistes-data.js' + CB;
    s.onload = function () { cb(); }; s.onerror = function () { cb('err'); };
    document.head.appendChild(s);
  }
  function ensureActu(cb) {
    if (ACTU) { cb(); return; }
    fetch('grossistes-actu.json' + CB).then(function (r) { return r.json(); })
      .then(function (j) { ACTU = j; cb(); }).catch(function () { ACTU = { items: [] }; cb('err'); });
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
  var TAGNAME = { '': 'Secteur', 'ocp': 'Phoenix OCP', 'cerp-rouen': 'CERP Rouen', 'cerp-rrm': 'CERP RRM', 'alliance': 'Alliance Healthcare', 'phoenix': 'Phoenix', 'sagitta': 'Sagitta', 'cophana': 'Cophana', 'welcoop': 'Welcoop', 'giphar': 'Giphar' };

  // ── ANNUAIRE PAR GROUPE (niveau 0 marché → 1 groupes → 2 membres/mère) ──
  function groupes() { var d = DATA(); return (d && d.groupes) || []; }
  function membersOf(gid) { return list().filter(function (f) { return f.groupe_id === gid; }); }
  function kNum(s) { s = String(s || ''); var m = s.match(/([\d.,]+)\s*Md/i); if (m) return parseFloat(m[1].replace(',', '.')) * 1000; m = s.match(/([\d.,]+)\s*M/i); if (m) return parseFloat(m[1].replace(',', '.')); return 0; }
  function statutCls(s) { s = s || ''; return /national/.test(s) ? 'nat' : (/coop/.test(s) ? 'coop' : (/DOM/.test(s) ? 'dom' : (/export/.test(s) ? 'exp' : (/hors/.test(s) ? 'warn' : 'sl')))); }
  function flagOf(g) { var t = (g.pays || '') + (g.mere || ''); return /allemagne/i.test(t) ? '🇩🇪' : (/usa|américain|amerisource|cencora/i.test(t) ? '🇺🇸' : (/japon|toyota/i.test(t) ? '🇯🇵' : '🇫🇷')); }
  function shortNom(s) { return String(s || '').split('(')[0].split('—')[0].split('/')[0].trim(); }

  function marketBar() {
    var gs = groupes().filter(function (g) { return g.pdm_num > 0; }).sort(function (a, b) { return b.pdm_num - a.pdm_num; });
    var sum = gs.reduce(function (s, g) { return s + g.pdm_num; }, 0), autres = Math.max(0, Math.round((100 - sum) * 10) / 10);
    var seg = gs.map(function (g) { return '<span class="gr-mbseg" style="width:' + g.pdm_num + '%;background:' + g.couleur + '" title="' + esc(shortNom(g.nom)) + ' ' + g.pdm_num + '%"></span>'; }).join('') +
      (autres > 0 ? '<span class="gr-mbseg" style="width:' + autres + '%;background:#CBD2DD" title="Indépendants, short-liners & DOM-TOM"></span>' : '');
    var leg = gs.map(function (g) { return '<span class="gr-mbl"><i style="background:' + g.couleur + '"></i>' + esc(shortNom(g.nom)) + ' ' + g.pdm_num + '%</span>'; }).join('') +
      '<span class="gr-mbl"><i style="background:#CBD2DD"></i>Autres ~' + Math.round(autres) + '%</span>';
    return '<div class="gr-market">' +
      '<div class="gr-mtiles"><div><b>~22 Md€</b><span>marché FR</span></div><div><b>' + list().length + '</b><span>acteurs recensés</span></div><div><b>~90 %</b><span>aux 3 leaders</span></div><div><b>~57 %</b><span>du médicament (volume)</span></div></div>' +
      '<div class="gr-mbar">' + seg + '</div><div class="gr-mbleg">' + leg + '</div></div>';
  }
  function groupCardHtml(g) {
    var mem = membersOf(g.id), open = (openGroupe === g.id);
    var head = '<button class="gr-ghead" onclick="V2.grossisteGroupe(\'' + g.id + '\')">' +
      '<span class="gr-grang">#' + g.rang + '</span>' +
      '<div class="gr-gmain"><b>' + esc(shortNom(g.nom)) + '</b>' +
        '<span class="gr-gmere">' + flagOf(g) + ' ' + esc(shortNom(g.mere).slice(0, 44) || '—') + '</span></div>' +
      '<div class="gr-gkpis"><div><b>' + esc(g.part_marche || '—') + '</b><span>part</span></div>' +
        '<div><b>' + mem.length + '</b><span>répart.</span></div>' +
        '<div><b>' + ((g.enseignes && g.enseignes.length) || '—') + '</b><span>enseignes</span></div></div>' +
      '<span class="gr-gstat s-' + statutCls(g.statut) + '">' + esc(g.statut) + '</span>' +
      '<span class="gr-gchev">' + (open ? '▾' : '▸') + ' ' + mem.length + '</span></button>';
    return '<div class="gr-gcard' + (open ? ' open' : '') + '" style="--gc:' + g.couleur + '">' + head + (open ? groupBodyHtml(g, mem) : '') + '</div>';
  }
  function groupBodyHtml(g, mem) {
    var mere = '<div class="gr-lvl"><span class="gr-lvlab">Société mère</span><div class="gr-mere"><i class="gr-pas mere"></i>' + esc(g.mere || '—') + '</div></div>';
    var rows = mem.slice().sort(function (a, b) { return kNum(b.ca_eur) - kNum(a.ca_eur); }).map(function (f) {
      var right = (f.ca_eur && f.ca_eur !== 'inconnu' && f.ca_eur !== '—') ? shortNom(f.ca_eur) : shortNom((f.geo || '').split(',')[0]).slice(0, 22);
      return '<button class="gr-mrow" onclick="V2.grossisteOpen(\'' + esc(f.id) + '\')">' +
        '<i class="gr-pas memb"></i><span class="gr-mname">' + esc(shortNom(f.nom)) + (f.lien_ip ? '<em class="gr-mip">IP</em>' : '') + '</span>' +
        '<span class="gr-mca">' + esc(right) + '</span><span class="gr-marr">→</span></button>';
    }).join('');
    var ens = (g.enseignes && g.enseignes.length) ? '<div class="gr-lvl"><span class="gr-lvlab">Enseignes / groupements</span><div class="gr-ens">' +
      g.enseignes.map(function (e) { return '<span class="gr-enschip"><i class="gr-pas ens"></i>' + esc(typeof e === 'string' ? e : e.nom) + '</span>'; }).join('') + '</div></div>' : '';
    return '<div class="gr-gbody">' + (g.resume ? '<p class="gr-gres">' + esc(g.resume) + '</p>' : '') + mere +
      '<div class="gr-lvl"><span class="gr-lvlab">Répartiteurs (' + mem.length + ')</span>' + rows + '</div>' + ens + '</div>';
  }
  function annuaireHtml() {
    var gs = groupes();
    if (!gs.length) return '<div class="gr-empty">Base concurrents en cours de constitution. Reviens dans un instant.</div>';
    var STATUTS = [['', 'Tous'], ['national', 'Nationaux'], ['coopérative', 'Coopératives'], ['short-liner', 'Short-liners'], ['DOM-TOM', 'DOM-TOM'], ['export', 'Export']];
    var chips = '<div class="gr-filts">' + STATUTS.map(function (s) { return '<button class="gr-filt' + (filt === s[0] ? ' on' : '') + '" onclick="V2.grossisteFilter(\'' + s[0] + '\')">' + esc(s[1]) + '</button>'; }).join('') + '</div>';
    var shown = gs.filter(function (g) { return !filt || g.statut === filt; }).sort(function (a, b) { return a.rang - b.rang; });
    var cards = shown.map(groupCardHtml).join('') || '<div class="gr-empty">Aucun groupe dans ce filtre.</div>';
    return marketBar() + chips + '<div class="gr-glist">' + cards + '</div>';
  }

  // ── FICHE d'un grossiste ────────────────────────────────────────
  function ficheHtml(g) {
    if (!g) return '<div class="gr-empty">Fiche introuvable.</div>';
    function sec(t, body) { return body ? '<div class="gr-sec"><h4>' + t + '</h4>' + body + '</div>' : ''; }
    function ul(arr) { return (arr && arr.length) ? '<ul class="gr-ul">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
    var ens = (g.enseignes || []).map(function (e) { return '<div class="gr-ensrow"><b>' + esc(e.nom) + '</b>' + (e.lien ? '<span>' + esc(e.lien) + '</span>' : '') + '</div>'; }).join('');
    var src = (g.sources || []).map(function (u) { return /^https?:/.test(u) ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\//, '').slice(0, 40)) + '↗</a>' : '<span>' + esc(u) + '</span>'; }).join(' · ');
    return '<div class="gr-fiche">' +
      '<button class="gr-back" onclick="V2.grossisteClose()">← Tous les concurrents</button>' +
      '<div class="gr-fhead"><div><h2>' + esc(g.nom) + '</h2><div class="gr-fmeta">' + typeBadge(g.type) + (g.lien_ip ? '<span class="gr-iplink">Lié à Intégral Pharma</span>' : '') + (g.groupe ? '<span>' + esc(g.groupe) + '</span>' : '') + (g.siege ? '<span>· ' + esc(g.siege) + '</span>' : '') + fiab(g) + '</div></div></div>' +
      (g.lien_ip_txt ? '<div class="gr-ipnote">⚑ ' + esc(g.lien_ip_txt) + '</div>' : '') +
      '<div class="gr-fkpis">' +
        '<div class="gr-fkpi"><b>' + esc(g.ca_eur || '—') + '</b><span>CA' + (g.ca_annee ? ' (' + esc(g.ca_annee) + ')' : '') + '</span></div>' +
        '<div class="gr-fkpi"><b>' + esc(g.nb_agences || '—') + '</b><span>agences</span></div>' +
        '<div class="gr-fkpi"><b>' + esc(g.part_marche || '—') + '</b><span>part de marché</span></div>' +
        '<div class="gr-fkpi"><b>' + esc(g.effectifs || '—') + '</b><span>effectifs</span></div>' +
      '</div>' +
      sec('Positionnement géographique', g.geo ? '<p>' + esc(g.geo) + '</p>' : '') +
      sec('Enseignes & groupements affiliés', ens) +
      sec('Partenariats', ul(g.partenariats)) +
      sec('Livraison', g.livraison ? '<p>' + esc(g.livraison) + '</p>' : '') +
      sec('Conditions commerciales (indicatif)', g.conditions ? '<p>' + esc(g.conditions) + '</p>' : '') +
      sec('Forces', ul(g.forces)) +
      sec('Faiblesses', ul(g.faiblesses)) +
      sec('Actualité récente', g.actu ? '<p>' + esc(g.actu) + '</p>' : '') +
      sec("Angles d'attaque commerciale", ul(g.angles)) +
      (src ? '<div class="gr-src">Sources : ' + src + '</div>' : '') +
      // Notes terrain éditables (remontées commercial, sauvegardées Supabase) — scope 'client' + id préfixé (compatible contrainte)
      '<div class="gr-notes"><h4>Mes remontées terrain</h4>' +
        (V2.notes ? V2.notes.section('client', 'gr_' + g.id) : '<p>Notes indisponibles.</p>') +
      '</div>' +
    '</div>';
  }

  // ── ACTUALITÉS ──────────────────────────────────────────────────
  function actuHtml() {
    var items = (ACTU && ACTU.items) || [];
    var tags = {}; items.forEach(function (i) { tags[i.tag || ''] = (tags[i.tag || ''] || 0) + 1; });
    var nLibre = items.filter(function (i) { return i.libre; }).length;
    var chips = '<button class="gr-actutag' + (actuTag === '' ? ' on' : '') + '" onclick="V2.grossisteActuTag(\'\')">Tout (' + items.length + ')</button>' +
      '<button class="gr-actutag lib' + (actuTag === '__libre' ? ' on' : '') + '" onclick="V2.grossisteActuTag(\'__libre\')">🔓 Accès libre (' + nLibre + ')</button>';
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
    return '<div class="gr-actubar">' + chips + '</div>' +
      '<div class="gr-actumaj">' + esc(maj) + ' · sources : FSPF, ANSM &amp; presse (Google News) — filtre « accès libre » pour l\'info lisible en entier</div>' +
      '<div class="gr-actulist">' + rows + '</div>';
  }

  // ── actions ─────────────────────────────────────────────────────
  V2.grossisteTab = function (v) { view = v; selId = null; V2.render(); };
  V2.grossisteOpen = function (id) { selId = id; V2.render(); };
  V2.grossisteClose = function () { selId = null; V2.render(); };
  function reAnnu() { var b = document.getElementById('gr-body'); if (b) b.innerHTML = annuaireHtml(); }
  V2.grossisteGroupe = function (id) { openGroupe = (openGroupe === id ? null : id); reAnnu(); };
  V2.grossisteFilter = function (f) { filt = f; openGroupe = null; reAnnu(); };
  V2.grossisteActuTag = function (t) { actuTag = t; var el = document.getElementById('gr-actuwrap'); if (el) el.innerHTML = actuHtml(); };

  // ── page ────────────────────────────────────────────────────────
  V2.pages.grossistes = {
    render: function (root) {
      injectCss();
      var tabs = '<div class="gr-tabs">' +
        '<button class="gr-tab' + (view === 'annuaire' ? ' on' : '') + '" onclick="V2.grossisteTab(\'annuaire\')">Répartiteurs concurrents</button>' +
        '<button class="gr-tab' + (view === 'actu' ? ' on' : '') + '" onclick="V2.grossisteTab(\'actu\')">Actualités du secteur</button>' +
        '</div>';
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap gr-wrap">' +
          '<div class="gr-title"><h1>Concurrents · Grossistes-répartiteurs</h1><p>Cartographie de la concurrence + veille. Ajoute tes remontées terrain sur chaque fiche.</p></div>' +
          tabs +
          '<div id="gr-body"><div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div></div>' +
        '</div>';
      var body = document.getElementById('gr-body');
      if (view === 'actu') {
        ensureActu(function () { if (body) { body.innerHTML = '<div id="gr-actuwrap">' + actuHtml() + '</div>'; } });
      } else {
        ensureData(function () {
          if (!body) return;
          if (selId) { body.innerHTML = ficheHtml(byId(selId)); if (V2.notes) V2.notes.hydrate(); }
          else body.innerHTML = annuaireHtml();
        });
      }
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
      '.gr-card-kpis span{font-size:10.5px;color:var(--muted)}',
      '.gr-card-ens{display:flex;flex-wrap:wrap;gap:5px}',
      '.gr-chip{font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--ip-blue) 8%,var(--card));color:var(--ip-blue);border:1px solid color-mix(in srgb,var(--ip-blue) 18%,transparent)}',
      '.gr-card-go{font-size:12px;font-weight:700;color:var(--ip-blue)}',
      '.gr-type{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}',
      '.gr-type.nat{background:#E9F0FF;color:#0034A0}.gr-type.coop{background:#E7F8EF;color:#0B7A44}.gr-type.sl{background:#FFF2E0;color:#A35B00}',
      '.gr-fiab{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px}',
      '.gr-fiab.hi{background:#E7F8EF;color:#0B7A44}.gr-fiab.mid{background:#FFF6E0;color:#8A6100}.gr-fiab.lo{background:#FDE8E8;color:#B42318}',
      '.gr-fiche{max-width:820px}',
      '.gr-back{border:none;background:none;color:var(--ip-blue);font:inherit;font-weight:700;font-size:13px;cursor:pointer;padding:0;margin-bottom:12px}',
      '.gr-fhead h2{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0}',
      '.gr-fmeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:12.5px;color:var(--muted)}',
      '.gr-fkpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}',
      '@media(max-width:640px){.gr-fkpis{grid-template-columns:repeat(2,1fr)}}',
      '.gr-fkpi{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--card)}',
      '.gr-fkpi b{display:block;font-size:16px;font-weight:800;letter-spacing:-.01em}',
      '.gr-fkpi span{font-size:11px;color:var(--muted)}',
      '.gr-sec{margin:16px 0}',
      '.gr-sec h4{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;color:var(--muted);margin:0 0 8px}',
      '.gr-sec p{margin:0;font-size:14px;line-height:1.55}',
      '.gr-ul{margin:0;padding-left:18px;font-size:14px;line-height:1.6}',
      '.gr-ensrow{display:flex;align-items:baseline;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)}',
      '.gr-ensrow b{font-size:13.5px;font-weight:700}.gr-ensrow span{font-size:12px;color:var(--muted)}',
      '.gr-src{margin:14px 0;font-size:11.5px;color:var(--muted);word-break:break-all}',
      '.gr-src a{color:var(--ip-blue);text-decoration:none}',
      '.gr-notes{margin-top:22px;border-top:2px solid var(--line);padding-top:16px}',
      '.gr-notes h4{font-size:14px;font-weight:800;margin:0 0 8px}',
      '.gr-actubar{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px}',
      '.gr-actutag{padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ip-ink);font:inherit;font-size:12px;font-weight:600;cursor:pointer}',
      '.gr-actutag.on{background:var(--ip-blue,#0057FF);color:#fff;border-color:transparent}',
      '.gr-actumaj{font-size:11.5px;color:var(--muted);margin-bottom:12px}',
      '.gr-actulist{display:flex;flex-direction:column;gap:2px}',
      '.gr-actu{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid transparent;border-radius:12px;text-decoration:none;color:var(--ip-ink);transition:background .12s,border-color .12s}',
      '.gr-actu:hover{background:color-mix(in srgb,var(--ip-blue) 5%,var(--card));border-color:var(--line)}',
      '.gr-actu-main{flex:1;min-width:0}',
      '.gr-actu-main b{display:block;font-size:14px;font-weight:600;line-height:1.35}',
      '.gr-actu-meta{font-size:11.5px;color:var(--muted)}.gr-actu-meta i{color:var(--ip-blue);font-style:normal;font-weight:600}',
      '.gr-actu-go{color:var(--muted);font-weight:700}',
      '.gr-actu-res{display:block;font-size:12px;line-height:1.45;color:var(--muted);margin:3px 0 4px}',
      '.gr-actu-acc{font-weight:800;font-size:10px;padding:1px 6px;border-radius:999px}',
      '.gr-actu-acc.lib{background:#E7F8EF;color:#0B7A44}.gr-actu-acc.abo{background:#FDECEC;color:#B42318}',
      '.gr-actutag.lib.on{background:#0B7A44}',
      '.gr-empty{padding:40px 20px;text-align:center;color:var(--muted);font-size:13.5px}',
      // Niveau 0 — bandeau de marché
      '.gr-market{margin-bottom:16px}',
      '.gr-mtiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}',
      '@media(max-width:560px){.gr-mtiles{grid-template-columns:repeat(2,1fr)}}',
      '.gr-mtiles>div{border:1px solid var(--line);border-radius:12px;padding:11px 13px;background:var(--card)}',
      '.gr-mtiles b{display:block;font-size:17px;font-weight:800;letter-spacing:-.01em}',
      '.gr-mtiles span{font-size:10.5px;color:var(--muted)}',
      '.gr-mbar{display:flex;height:14px;border-radius:7px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}',
      '.gr-mbseg{height:100%}',
      '.gr-mbleg{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}',
      '.gr-mbl{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--ip-ink)}',
      '.gr-mbl i{width:9px;height:9px;border-radius:2px}',
      // Filtres
      '.gr-filts{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}',
      '.gr-filt{padding:6px 13px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ip-ink);font:inherit;font-size:12px;font-weight:600;cursor:pointer}',
      '.gr-filt.on{background:var(--ip-blue,#0057FF);color:#fff;border-color:transparent}',
      // Niveau 1 — cartes de groupe
      '.gr-glist{display:flex;flex-direction:column;gap:10px}',
      '.gr-gcard{border:1px solid var(--line);border-left:5px solid var(--gc);border-radius:14px;background:var(--card);overflow:hidden}',
      '.gr-gcard.open{box-shadow:0 10px 28px rgba(16,19,28,.09)}',
      '.gr-ghead{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;border:none;background:none;cursor:pointer;font:inherit;color:var(--ip-ink);text-align:left}',
      '.gr-grang{font-size:13px;font-weight:800;color:var(--gc);min-width:26px}',
      '.gr-gmain{flex:1;min-width:0}',
      '.gr-gmain b{display:block;font-size:15.5px;font-weight:800;letter-spacing:-.01em;line-height:1.2}',
      '.gr-gmere{font-size:11.5px;color:var(--muted)}',
      '.gr-gkpis{display:flex;gap:16px;flex:none}',
      '@media(max-width:640px){.gr-gkpis>div:nth-child(3){display:none}}',
      '@media(max-width:460px){.gr-gkpis{display:none}}',
      '.gr-gkpis>div{text-align:right}',
      '.gr-gkpis b{display:block;font-size:14px;font-weight:800;font-variant-numeric:tabular-nums}',
      '.gr-gkpis span{font-size:9.5px;color:var(--muted)}',
      '.gr-gstat{font-size:9.5px;font-weight:800;padding:3px 8px;border-radius:999px;white-space:nowrap;flex:none}',
      '.gr-gstat.s-nat{background:#E9F0FF;color:#0034A0}.gr-gstat.s-coop{background:#E7F8EF;color:#0B7A44}.gr-gstat.s-sl{background:#FFF2E0;color:#A35B00}.gr-gstat.s-dom{background:#E0F7FA;color:#00707C}.gr-gstat.s-exp{background:#F3F4E7;color:#6B6B1F}.gr-gstat.s-warn{background:#FDE8E8;color:#B42318}',
      '.gr-gchev{font-size:12px;font-weight:700;color:var(--muted);flex:none}',
      // Niveau 2 — arborescence mère → membres → enseignes
      '.gr-gbody{padding:2px 16px 16px;border-top:1px solid var(--line)}',
      '.gr-gres{margin:12px 0 0;font-size:12.5px;line-height:1.5;color:var(--muted)}',
      '.gr-lvl{margin-top:14px}',
      '.gr-lvlab{display:block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:6px}',
      '.gr-pas{width:11px;height:11px;flex:none;display:inline-block;background:var(--gc)}',
      '.gr-pas.mere{border-radius:3px}.gr-pas.memb{border-radius:50%}.gr-pas.ens{border-radius:50%;background:transparent!important;box-shadow:inset 0 0 0 2px var(--gc)}',
      '.gr-mere{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--ip-ink)}',
      '.gr-mrow{display:flex;align-items:center;gap:9px;width:100%;padding:8px 6px;border:none;border-radius:8px;background:none;cursor:pointer;font:inherit;color:var(--ip-ink);text-align:left}',
      '.gr-mrow:hover{background:color-mix(in srgb,var(--gc) 7%,transparent)}',
      '.gr-mname{flex:1;min-width:0;font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.gr-mip{font-style:normal;font-size:9px;font-weight:800;background:#0E7C86;color:#fff;padding:1px 5px;border-radius:999px;margin-left:6px}',
      '.gr-mca{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.gr-marr{color:var(--gc);font-weight:700}',
      '.gr-ens{display:flex;flex-wrap:wrap;gap:6px}',
      '.gr-enschip{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:999px;background:color-mix(in srgb,var(--gc) 8%,var(--card));border:1px solid color-mix(in srgb,var(--gc) 22%,transparent)}',
      '.gr-cov{margin-bottom:14px;padding:12px 16px;border-radius:12px;background:color-mix(in srgb,var(--ip-blue) 5%,var(--card));border:1px solid var(--line)}',
      '.gr-cov b{display:block;font-size:14px;font-weight:800}',
      '.gr-cov span{display:block;margin-top:4px;font-size:11.5px;line-height:1.5;color:var(--muted)}',
      '.gr-card.ip{border-color:color-mix(in srgb,#0E7C86 40%,var(--line));background:color-mix(in srgb,#0E7C86 4%,var(--card))}',
      '.gr-iplink{font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:#0E7C86;color:#fff;white-space:nowrap}',
      '.gr-ipnote{margin:10px 0;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,#0E7C86 8%,var(--card));border:1px solid color-mix(in srgb,#0E7C86 25%,transparent);font-size:12.5px;font-weight:600;color:#0A5A62}',
    ].join('');
    document.head.appendChild(s);
  }
})();

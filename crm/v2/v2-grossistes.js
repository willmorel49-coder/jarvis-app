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
  var CB = '?v=20260713j';

  var view = 'annuaire';   // 'annuaire' | 'actu'
  var selId = null;        // grossiste ouvert en fiche
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

  // ── ANNUAIRE : grille de cartes ─────────────────────────────────
  function annuaireHtml() {
    var gs = list();
    if (!gs.length) return '<div class="gr-empty">Base concurrents en cours de constitution (renseignement multi-agents). Reviens dans un instant.</div>';
    gs = gs.slice().sort(function (a, b) { return (rank(b) - rank(a)); });
    return '<div class="gr-grid">' + gs.map(function (g) {
      var ens = (g.enseignes || []).slice(0, 4).map(function (e) { return '<span class="gr-chip">' + esc(e.nom) + '</span>'; }).join('');
      return '<button class="gr-card" onclick="V2.grossisteOpen(\'' + esc(g.id) + '\')">' +
        '<div class="gr-card-h"><b>' + esc(g.nom) + '</b>' + typeBadge(g.type) + '</div>' +
        (g.groupe ? '<div class="gr-card-grp">' + esc(g.groupe) + '</div>' : '') +
        '<div class="gr-card-kpis">' +
          '<div><b>' + esc(g.ca_eur || '—') + '</b><span>CA</span></div>' +
          '<div><b>' + esc(g.nb_agences || '—') + '</b><span>agences</span></div>' +
          '<div><b>' + esc(g.part_marche || '—') + '</b><span>part marché</span></div>' +
        '</div>' +
        (ens ? '<div class="gr-card-ens">' + ens + '</div>' : '') +
        '<span class="gr-card-go">Voir la fiche →</span>' +
      '</button>';
    }).join('') + '</div>';
  }
  function rank(g) {   // ordre : gros acteurs d'abord (heuristique sur le CA en Md/M)
    var s = (g.ca_eur || '').replace(/\s/g, '');
    var m = s.match(/([\d.,]+)\s*Md/i); if (m) return 1000 * parseFloat(m[1].replace(',', '.'));
    m = s.match(/([\d.,]+)\s*M/i); if (m) return parseFloat(m[1].replace(',', '.'));
    return 0;
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
      '<div class="gr-fhead"><div><h2>' + esc(g.nom) + '</h2><div class="gr-fmeta">' + typeBadge(g.type) + (g.groupe ? '<span>' + esc(g.groupe) + '</span>' : '') + (g.siege ? '<span>· ' + esc(g.siege) + '</span>' : '') + fiab(g) + '</div></div></div>' +
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
    var chips = '<button class="gr-actutag' + (actuTag === '' ? ' on' : '') + '" onclick="V2.grossisteActuTag(\'\')">Tout (' + items.length + ')</button>';
    Object.keys(tags).filter(function (t) { return t; }).forEach(function (t) {
      chips += '<button class="gr-actutag' + (actuTag === t ? ' on' : '') + '" onclick="V2.grossisteActuTag(\'' + esc(t) + '\')">' + esc(TAGNAME[t] || t) + ' (' + tags[t] + ')</button>';
    });
    var shown = actuTag ? items.filter(function (i) { return i.tag === actuTag; }) : items;
    var rows = shown.map(function (i) {
      return '<a class="gr-actu" href="' + esc(i.url) + '" target="_blank" rel="noopener">' +
        '<div class="gr-actu-main"><b>' + esc(i.titre) + '</b>' +
          '<span class="gr-actu-meta">' + esc(i.source || '') + (i.tag ? ' · <i>' + esc(TAGNAME[i.tag] || i.tag) + '</i>' : '') + ' · ' + timeAgo(i.date) + '</span></div>' +
        '<span class="gr-actu-go">↗</span></a>';
    }).join('') || '<div class="gr-empty">Pas encore d\'actualités. Le robot de veille tourne chaque jour.</div>';
    var maj = ACTU && ACTU.maj ? 'Mis à jour ' + timeAgo(ACTU.maj) : '';
    return '<div class="gr-actubar">' + chips + '</div>' +
      '<div class="gr-actumaj">' + esc(maj) + ' · source : Google News (secteur répartition)</div>' +
      '<div class="gr-actulist">' + rows + '</div>';
  }

  // ── actions ─────────────────────────────────────────────────────
  V2.grossisteTab = function (v) { view = v; selId = null; V2.render(); };
  V2.grossisteOpen = function (id) { selId = id; V2.render(); };
  V2.grossisteClose = function () { selId = null; V2.render(); };
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
      '.gr-empty{padding:40px 20px;text-align:center;color:var(--muted);font-size:13.5px}',
    ].join('');
    document.head.appendChild(s);
  }
})();

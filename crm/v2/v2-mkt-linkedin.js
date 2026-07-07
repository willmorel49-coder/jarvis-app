/* CRM V2 · Sous-module "Rétroplanning LinkedIn" (pages.marketing?linkedin)
   100% client-side. Supabase (V2.sb) primaire, repli localStorage. */
(function () {
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  (function injectCss() {
    if (document.getElementById('li-css')) return;
    var s = document.createElement('style'); s.id = 'li-css';
    s.textContent =
      '.li-wrap{max-width:1080px;margin:0 auto;padding:8px 16px 60px}' +
      '.li-h1{font-size:22px;font-weight:800;margin:0}' +
      '.li-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:10px 0}' +
      '.li-actions{display:flex;gap:8px;flex-wrap:wrap}' +
      '.li-btn{background:#0e1730;color:#e8eeff;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 12px;font:600 13px/1 inherit;cursor:pointer}' +
      '.li-btn-p{background:#0057FF;border-color:#0057FF;color:#fff}' +
      '.li-calbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0 10px}' +
      '.li-nav{background:transparent;border:1px solid rgba(255,255,255,.14);color:inherit;border-radius:8px;width:34px;height:34px;cursor:pointer}' +
      '.li-navtoday{width:auto;padding:0 12px}' +
      '.li-legend{display:flex;gap:14px;flex-wrap:wrap;margin-left:auto;font-size:12px;opacity:.85}' +
      '.li-leg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}' +
      '.li-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;font-size:11px;opacity:.7;padding:0 2px 4px}' +
      '.li-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}' +
      '.li-cell{min-height:96px;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:6px;cursor:pointer;background:rgba(255,255,255,.02)}' +
      '.li-cell.li-out{background:transparent;border:0;cursor:default}' +
      '.li-cell.li-today{border-color:#0057FF;box-shadow:inset 0 0 0 1px #0057FF}' +
      '.li-num{font-size:12px;opacity:.6}' +
      '.li-pill{display:flex;align-items:center;gap:5px;width:100%;text-align:left;margin-top:4px;padding:4px 6px;border:0;border-left:3px solid var(--pc);border-radius:6px;background:rgba(255,255,255,.06);color:inherit;font:600 11px/1.2 inherit;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' +
      '.li-empty{opacity:.7;margin-top:20px}';
    document.head.appendChild(s);
  })();

  function sb() { return (V2.sb && V2.sb()) || null; }

  // ── État de vue ──
  var view = 'cal';                 // 'cal' | 'list'
  var calRef = new Date();          // mois affiché (1er du mois)
  calRef.setDate(1);

  // ── Piliers éditoriaux (modifiable) ──
  var PILLARS = [
    { k: 'produit',     label: 'Produit',              color: '#0057FF' },
    { k: 'conseil',     label: 'Conseil officine',     color: '#00B37A' },
    { k: 'coulisses',   label: 'Coulisses / logistique', color: '#FFB020' },
    { k: 'recrutement', label: 'Recrutement',          color: '#FF4D6D' },
    { k: 'tempsfort',   label: 'Temps fort',           color: '#8B5CF6' }
  ];
  function pillar(k) { for (var i = 0; i < PILLARS.length; i++) if (PILLARS[i].k === k) return PILLARS[i]; return PILLARS[0]; }

  // ── Statuts ──
  var STATUSES = [
    { k: 'idee',      label: 'Idée',        icon: '💡' },
    { k: 'redaction', label: 'En rédaction', icon: '✍️' },
    { k: 'pret',      label: 'Prêt',        icon: '✅' },
    { k: 'publie',    label: 'Publié',      icon: '📢' }
  ];
  function statusOf(k) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].k === k) return STATUSES[i]; return STATUSES[0]; }

  // ── Données ──
  var LS = 'jarvis_li_posts';
  var backend = 'local';
  var posts = [];

  function newId() { return 'li' + Date.now() + Math.floor((window.performance && performance.now ? performance.now() : 0) % 1000); }
  function localAll() { try { var a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function localWrite(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }

  function fromRow(r) {
    return { id: r.id, date: r.date, status: r.status || 'idee', pillar: r.pillar || 'produit',
      title: r.title || '', body: r.body || '', image_path: r.image_path || '', linkedin_url: r.linkedin_url || '',
      event_id: r.event_id || '', event_name: r.event_name || '', source: r.source || 'manuel',
      created_at: r.created_at || null, updated_at: r.updated_at || null };
  }
  function toRow(p) {
    return { id: p.id, date: p.date, status: p.status, pillar: p.pillar, title: p.title, body: p.body,
      image_path: p.image_path || '', linkedin_url: p.linkedin_url || '', event_id: p.event_id || '',
      event_name: p.event_name || '', source: p.source || 'manuel',
      owner: (V2.user && V2.user.email) || '', updated_at: new Date().toISOString() };
  }

  function loadPosts() {
    var c = sb();
    if (c) {
      return c.from('linkedin_posts').select('*').order('date', { ascending: true })
        .then(function (r) {
          if (!r.error && r.data) { backend = 'supabase'; posts = r.data.map(fromRow); return posts; }
          backend = 'local'; posts = localAll(); return posts;
        }).catch(function () { backend = 'local'; posts = localAll(); return posts; });
    }
    backend = 'local'; posts = localAll();
    return Promise.resolve(posts);
  }

  function saveLocal(p) {
    var a = localAll(), i = -1;
    for (var k = 0; k < a.length; k++) if (a[k].id === p.id) { i = k; break; }
    if (i >= 0) a[i] = p; else a.push(p);
    localWrite(a); posts = a; return a;
  }
  function savePost(p) {
    if (!p.id) p.id = newId();
    if (!p.created_at) p.created_at = new Date().toISOString();
    p.updated_at = new Date().toISOString();
    var c = sb();
    if (backend === 'supabase' && c) {
      return c.from('linkedin_posts').upsert(toRow(p)).then(function (r) {
        if (r.error) { saveLocal(p); return posts; } return loadPosts();
      }).catch(function () { saveLocal(p); return Promise.resolve(posts); });
    }
    return Promise.resolve(saveLocal(p));
  }
  function removePost(id) {
    var c = sb();
    if (backend === 'supabase' && c) {
      return c.from('linkedin_posts').delete().eq('id', id).then(function () { return loadPosts(); })
        .catch(function () { localWrite(localAll().filter(function (x) { return x.id !== id; })); posts = localAll(); return posts; });
    }
    localWrite(localAll().filter(function (x) { return x.id !== id; })); posts = localAll();
    return Promise.resolve(posts);
  }

  // ── Utilitaires date ──
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function sameDay(iso, d) { return iso && iso.slice(0, 10) === ymd(d); }
  var MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var DOW = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  function postsOnDay(d) { return posts.filter(function (p) { return sameDay(p.date, d); }); }

  function renderCal(root) {
    var y = calRef.getFullYear(), m = calRef.getMonth();
    var first = new Date(y, m, 1);
    var startDow = (first.getDay() + 6) % 7; // Lundi = 0
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var todayStr = ymd(new Date());

    var legend = PILLARS.map(function (p) {
      return '<span class="li-leg"><i style="background:' + p.color + '"></i>' + esc(p.label) + '</span>';
    }).join('');

    var cells = '';
    for (var i = 0; i < startDow; i++) cells += '<div class="li-cell li-out"></div>';
    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(y, m, day), iso = ymd(d);
      var pl = postsOnDay(d).map(function (p) {
        var pc = pillar(p.pillar), st = statusOf(p.status);
        return '<button class="li-pill" style="--pc:' + pc.color + '" title="' + esc(st.label) + '" ' +
          'onclick="event.stopPropagation();V2.li.openPost(\'' + esc(p.id) + '\')">' +
          '<span class="li-pill-dot">' + st.icon + '</span>' + esc(p.title || p.body.slice(0, 22) || 'Post') + '</button>';
      }).join('');
      cells += '<div class="li-cell' + (iso === todayStr ? ' li-today' : '') + '" onclick="V2.li.newAt(\'' + iso + '\')">' +
        '<span class="li-num">' + day + '</span>' + pl + '</div>';
    }

    root.innerHTML = (V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '') +
      '<div class="li-wrap">' +
        '<div class="li-bar">' +
          '<h1 class="li-h1">Rétroplanning LinkedIn</h1>' +
          '<div class="li-actions">' +
            '<button class="li-btn" onclick="V2.li.setView(\'cal\')">Calendrier</button>' +
            '<button class="li-btn" onclick="V2.li.setView(\'list\')">Liste</button>' +
            '<button class="li-btn li-btn-p" onclick="V2.li.newAt(\'' + todayStr + '\')">+ Post</button>' +
            '<button class="li-btn" onclick="V2.li.newEvent()">+ Temps fort</button>' +
            '<button class="li-btn" onclick="V2.li.importOpen()">Import</button>' +
          '</div>' +
        '</div>' +
        '<div class="li-calbar">' +
          '<button class="li-nav" onclick="V2.li.prevMonth()">‹</button>' +
          '<b>' + MONTHS[m] + ' ' + y + '</b>' +
          '<button class="li-nav" onclick="V2.li.nextMonth()">›</button>' +
          '<button class="li-nav li-navtoday" onclick="V2.li.today()">Aujourd\'hui</button>' +
          '<div class="li-legend">' + legend + '</div>' +
        '</div>' +
        '<div class="li-dow">' + DOW.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' +
        '<div class="li-grid">' + cells + '</div>' +
      '</div>';
  }

  // ── Rendu ──
  function render(root) {
    if (!posts.length) {
      // premier rendu : charge puis re-render
      loadPosts().then(function () { if (V2.route && V2.route.name === 'marketing' && V2.route.param === 'linkedin') V2.render(); });
    }
    if (view === 'list') return renderList2(root);   // renderList2 en Task 8 ; d'ici là, fallback :
    return renderCal(root);
  }
  function renderList2(root) { renderCal(root); } // stub — remplacé en Task 8

  V2.mktLinkedin = { render: render, PILLARS: PILLARS, STATUSES: STATUSES, pillar: pillar, statusOf: statusOf,
    loadPosts: loadPosts, savePost: savePost, removePost: removePost, _posts: function () { return posts; }, newId: newId };
  V2.li = V2.li || {};

  V2.li.setView = function (v) { view = v; V2.render(); };
  V2.li.prevMonth = function () { calRef.setMonth(calRef.getMonth() - 1); V2.render(); };
  V2.li.nextMonth = function () { calRef.setMonth(calRef.getMonth() + 1); V2.render(); };
  V2.li.today = function () { calRef = new Date(); calRef.setDate(1); V2.render(); };
  V2.li.newAt = function (iso) { alert('Nouveau post le ' + iso + ' (éditeur en Task 4)'); };
  V2.li.openPost = function (id) { alert('Ouvrir post ' + id + ' (éditeur en Task 4)'); };
  V2.li.newEvent = function () { alert('Temps fort (Task 6)'); };
  V2.li.importOpen = function () { alert('Import (Task 7)'); };
})();

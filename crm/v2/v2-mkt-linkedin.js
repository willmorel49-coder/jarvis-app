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
      '.li-empty{opacity:.7;margin-top:20px}' +
      '.li-ov{position:fixed;inset:0;z-index:200;background:rgba(3,6,14,.6);display:flex;justify-content:flex-end}' +
      '.li-panel{width:min(520px,94vw);height:100%;overflow:auto;background:#0b1020;border-left:1px solid rgba(255,255,255,.12);padding:18px 20px;display:flex;flex-direction:column;gap:6px}' +
      '.li-panelhd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}' +
      '.li-x{background:transparent;border:0;color:inherit;font-size:18px;cursor:pointer}' +
      '.li-lab{font-size:12px;opacity:.7;margin-top:10px}' +
      '.li-in,.li-ta{width:100%;background:#0e1730;border:1px solid rgba(255,255,255,.14);border-radius:8px;color:inherit;padding:9px 11px;font:inherit}' +
      '.li-ta{min-height:120px;resize:vertical;line-height:1.5}' +
      '#li-count{float:right;opacity:.6}' +
      '.li-chips{display:flex;gap:7px;flex-wrap:wrap}' +
      '.li-ch{background:#0e1730;border:1px solid rgba(255,255,255,.14);border-left:3px solid var(--pc,transparent);border-radius:999px;color:inherit;padding:7px 12px;font:600 12px/1 inherit;cursor:pointer}' +
      '.li-ch.on{background:#0057FF;border-color:#0057FF}' +
      '.li-imgrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '.li-imgprev img{max-width:160px;border-radius:8px;display:block;margin-bottom:6px}' +
      '.li-panelft{display:flex;justify-content:space-between;gap:8px;margin-top:16px}' +
      '.li-del{border-color:#FF4D6D;color:#FF4D6D}' +
      '.li-due{background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.3);border-radius:12px;padding:12px 14px;margin:6px 0 14px}' +
      '.li-duerow{display:flex;align-items:center;gap:10px;margin-top:8px}' +
      '.li-duedot{width:9px;height:9px;border-radius:50%;flex:none}' +
      '.li-duet{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.li-dued{opacity:.6;font-size:12px}' +
      '.mkt-badge{background:#FF4D6D;color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;margin-left:6px}' +
      '.li-flt{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px}.li-flt .li-in{width:auto;flex:1;min-width:140px}' +
      '.li-lrow{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;margin-bottom:7px;cursor:pointer}' +
      '.li-lrow:hover{border-color:rgba(255,255,255,.2)}' +
      '.li-lrow-d{opacity:.6;font-size:12px;width:82px;flex:none}.li-lrow-t{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.li-lrow-s{font-size:12px;opacity:.85}.li-lrow-e{font-size:11px;background:rgba(139,92,246,.2);color:#c4b5fd;border-radius:999px;padding:2px 9px}';
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

  var _idc = 0;
  function newId() { return 'li' + Date.now() + '_' + (_idc++); }
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

  function duePosts() {
    var now = Date.now();
    return posts.filter(function (p) { return p.status !== 'publie' && p.date && new Date(p.date).getTime() <= now; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
  }

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
        (function () {
          var due = duePosts(); if (!due.length) return '';
          var rows = due.map(function (p) {
            return '<div class="li-duerow"><span class="li-duedot" style="background:' + pillar(p.pillar).color + '"></span>' +
              '<span class="li-duet">' + esc(p.title || p.body.slice(0, 40) || 'Post') + '</span>' +
              '<span class="li-dued">' + (p.date || '').slice(0, 10) + '</span>' +
              '<button class="li-btn" onclick="V2.li.openPost(\'' + esc(p.id) + '\')">Ouvrir</button>' +
              '<button class="li-btn li-btn-p" onclick="V2.li.publish(\'' + esc(p.id) + '\')">Publier</button></div>';
          }).join('');
          return '<div class="li-due"><b>⚠ À publier (' + due.length + ')</b>' + rows + '</div>';
        })() +
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
  var loaded = false;
  function render(root) {
    if (!loaded) {
      // premier rendu uniquement : charge puis re-render (évite la boucle quand aucun post)
      loaded = true;
      loadPosts().then(function () { if (V2.route && V2.route.name === 'marketing' && V2.route.param === 'linkedin') V2.render(); });
    }
    if (view === 'list') return renderList2(root);
    return renderCal(root);
  }
  var flt = { status: '', pillar: '', q: '' };
  function renderList2(root) {
    var rows = posts.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).filter(function (p) {
      if (flt.status && p.status !== flt.status) return false;
      if (flt.pillar && p.pillar !== flt.pillar) return false;
      if (flt.q && (p.title + ' ' + p.body + ' ' + p.event_name).toLowerCase().indexOf(flt.q.toLowerCase()) < 0) return false;
      return true;
    });
    var opt = function (arr, cur, allLabel) {
      return '<option value="">' + allLabel + '</option>' + arr.map(function (x) { return '<option value="' + x.k + '"' + (cur === x.k ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('');
    };
    var list = rows.map(function (p) {
      var pc = pillar(p.pillar), st = statusOf(p.status);
      return '<div class="li-lrow" onclick="V2.li.openPost(\'' + esc(p.id) + '\')">' +
        '<span class="li-duedot" style="background:' + pc.color + '"></span>' +
        '<span class="li-lrow-d">' + (p.date || '').slice(0, 10) + '</span>' +
        '<span class="li-lrow-t">' + esc(p.title || p.body.slice(0, 60) || 'Post') + '</span>' +
        '<span class="li-lrow-s">' + st.icon + ' ' + esc(st.label) + '</span>' +
        (p.event_name ? '<span class="li-lrow-e">' + esc(p.event_name) + '</span>' : '') + '</div>';
    }).join('') || '<p class="li-empty">Aucun post.</p>';
    root.innerHTML = (V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '') +
      '<div class="li-wrap"><div class="li-bar"><h1 class="li-h1">Rétroplanning LinkedIn</h1>' +
        '<div class="li-actions">' +
          '<button class="li-btn" onclick="V2.li.setView(\'cal\')">Calendrier</button>' +
          '<button class="li-btn li-btn-p" onclick="V2.li.setView(\'list\')">Liste</button></div></div>' +
        '<div class="li-flt">' +
          '<input class="li-in" placeholder="Rechercher…" value="' + esc(flt.q) + '" oninput="V2.li.filter(\'q\',this.value)">' +
          '<select class="li-in" onchange="V2.li.filter(\'status\',this.value)">' + opt(STATUSES, flt.status, 'Tous les statuts') + '</select>' +
          '<select class="li-in" onchange="V2.li.filter(\'pillar\',this.value)">' + opt(PILLARS, flt.pillar, 'Tous les piliers') + '</select>' +
        '</div>' + '<div class="li-listwrap">' + list + '</div></div>';
  }

  // ── Éditeur de post ──
  var editing = null; // Post en cours d'édition (copie)

  function openEditor(p) {
    editing = p ? JSON.parse(JSON.stringify(p)) : {
      id: '', date: new Date().toISOString(), status: 'idee', pillar: 'produit',
      title: '', body: '', image_path: '', linkedin_url: '', event_id: '', event_name: '', source: 'manuel'
    };
    drawEditor();
  }
  function drawEditor() {
    var host = document.getElementById('li-editor');
    if (!host) { host = document.createElement('div'); host.id = 'li-editor'; document.body.appendChild(host); }
    if (!editing) { host.innerHTML = ''; return; }
    var e = editing, dt = (e.date || '').slice(0, 16); // yyyy-mm-ddThh:mm
    var pills = PILLARS.map(function (p) {
      return '<button class="li-ch' + (e.pillar === p.k ? ' on' : '') + '" style="--pc:' + p.color + '" onclick="V2.li.editField(\'pillar\',\'' + p.k + '\')">' + esc(p.label) + '</button>';
    }).join('');
    var stat = STATUSES.map(function (s) {
      return '<button class="li-ch' + (e.status === s.k ? ' on' : '') + '" onclick="V2.li.editField(\'status\',\'' + s.k + '\')">' + s.icon + ' ' + esc(s.label) + '</button>';
    }).join('');
    var img = e.image_path
      ? '<div class="li-imgprev"><img src="' + esc(imgUrl(e.image_path)) + '" alt=""><button class="li-btn" onclick="V2.li.editField(\'image_path\',\'\')">Retirer</button></div>'
      : '<label class="li-btn">Ajouter un visuel<input type="file" accept="image/*" style="display:none" onchange="V2.li.uploadImg(this)"></label>' +
        '<input class="li-in" placeholder="…ou coller une URL d\'image" value="" oninput="V2.li.editField(\'image_path\',this.value)">';
    host.innerHTML =
      '<div class="li-ov" onclick="if(event.target===this)V2.li.closeEditor()"><div class="li-panel">' +
        '<div class="li-panelhd"><b>' + (e.id ? 'Modifier le post' : 'Nouveau post') + '</b>' +
          '<button class="li-x" onclick="V2.li.closeEditor()">✕</button></div>' +
        '<label class="li-lab">Titre court</label>' +
        '<input class="li-in" value="' + esc(e.title) + '" oninput="V2.li.editField(\'title\',this.value)" placeholder="ex : Teaser salon Pharmagora">' +
        '<label class="li-lab">Texte du post <span id="li-count">' + (e.body || '').length + ' / 3000</span></label>' +
        '<textarea class="li-ta" oninput="V2.li.editField(\'body\',this.value)" placeholder="Rédigez votre post LinkedIn…">' + esc(e.body) + '</textarea>' +
        '<label class="li-lab">Pilier</label><div class="li-chips">' + pills + '</div>' +
        '<label class="li-lab">Statut</label><div class="li-chips">' + stat + '</div>' +
        '<label class="li-lab">Date & heure</label>' +
        '<input class="li-in" type="datetime-local" value="' + dt + '" oninput="V2.li.editField(\'date\',this.value)">' +
        '<label class="li-lab">Visuel</label><div class="li-imgrow">' + img + '</div>' +
        '<label class="li-lab">Lien LinkedIn (après publication)</label>' +
        '<input class="li-in" value="' + esc(e.linkedin_url) + '" oninput="V2.li.editField(\'linkedin_url\',this.value)" placeholder="https://www.linkedin.com/posts/…">' +
        '<div class="li-panelft">' +
          (e.id ? '<button class="li-btn li-del" onclick="V2.li.del()">Supprimer</button>' : '<span></span>') +
          '<div><button class="li-btn" onclick="V2.li.closeEditor()">Annuler</button>' +
          '<button class="li-btn li-btn-p" onclick="V2.li.save()">Enregistrer</button></div>' +
        '</div>' +
      '</div></div>';
  }
  function imgUrl(path) {
    if (!path) return '';
    if (/^https?:/.test(path)) return path;
    var c = sb(); if (c && c.storage) { try { return c.storage.from('marketing-media').getPublicUrl(path).data.publicUrl; } catch (e) {} }
    return path;
  }

  V2.mktLinkedin = { render: render, PILLARS: PILLARS, STATUSES: STATUSES, pillar: pillar, statusOf: statusOf,
    loadPosts: loadPosts, savePost: savePost, removePost: removePost, _posts: function () { return posts; }, newId: newId };
  V2.li = V2.li || {};

  V2.li.setView = function (v) { view = v; V2.render(); };
  V2.li.prevMonth = function () { calRef.setMonth(calRef.getMonth() - 1); V2.render(); };
  V2.li.nextMonth = function () { calRef.setMonth(calRef.getMonth() + 1); V2.render(); };
  V2.li.today = function () { calRef = new Date(); calRef.setDate(1); V2.render(); };
  V2.li.newAt = function (iso) {
    var d = new Date(); if (iso && iso.length >= 10) { d = new Date(iso + 'T09:00'); }
    openEditor({ id: '', date: d.toISOString(), status: 'idee', pillar: 'produit', title: '', body: '', image_path: '', linkedin_url: '', event_id: '', event_name: '', source: 'manuel' });
  };
  V2.li.openPost = function (id) { var p = null; for (var i = 0; i < posts.length; i++) if (posts[i].id === id) p = posts[i]; if (p) openEditor(p); };
  V2.li.editField = function (f, v) {
    if (!editing) return;
    if (f === 'date') { var d = new Date(v); if (!isNaN(d.getTime())) editing.date = d.toISOString(); return; }
    editing[f] = v;
    if (f === 'body') { var c = document.getElementById('li-count'); if (c) c.textContent = v.length + ' / 3000'; }
    if (f === 'pillar' || f === 'status' || f === 'image_path') drawEditor();
  };
  V2.li.closeEditor = function () { editing = null; drawEditor(); };
  V2.li.save = function () {
    if (!editing) return;
    var p = editing; editing = null; drawEditor();
    savePost(p).then(function () { V2.render(); });
  };
  V2.li.del = function () {
    if (!editing || !editing.id) { V2.li.closeEditor(); return; }
    if (!confirm('Supprimer ce post ?')) return;
    var id = editing.id; editing = null; drawEditor();
    removePost(id).then(function () { V2.render(); });
  };
  V2.li.uploadImg = function (input) {
    var f = input.files && input.files[0]; if (!f || !editing) return;
    var c = sb();
    if (!(c && c.storage) || backend !== 'supabase') { alert('Upload d\'image indisponible hors-ligne. Collez une URL d\'image à la place.'); return; }
    var path = 'linkedin/' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9._-]/g, '');
    c.storage.from('marketing-media').upload(path, f, { upsert: true }).then(function (r) {
      if (r.error) { alert('Échec de l\'upload : ' + r.error.message); return; }
      editing.image_path = path; drawEditor();
    });
  };
  var RETRO = [
    { off: -14, title: 'Teaser',        pillar: 'tempsfort' },
    { off: -7,  title: 'Annonce',       pillar: 'tempsfort' },
    { off: -1,  title: 'Rappel',        pillar: 'tempsfort' },
    { off: 0,   title: 'Jour J / live', pillar: 'tempsfort' },
    { off: 2,   title: 'Retour / bilan',pillar: 'conseil'   }
  ];

  V2.li.newEvent = function () {
    var host = document.getElementById('li-editor');
    if (!host) { host = document.createElement('div'); host.id = 'li-editor'; document.body.appendChild(host); }
    var todayStr = ymd(new Date());
    host.innerHTML =
      '<div class="li-ov" onclick="if(event.target===this)V2.li.closeEditor()"><div class="li-panel">' +
        '<div class="li-panelhd"><b>Nouveau temps fort</b><button class="li-x" onclick="V2.li.closeEditor()">✕</button></div>' +
        '<p class="li-lab">JARVIS créera automatiquement les posts brouillons à rebours : J-14, J-7, J-1, Jour J, J+2.</p>' +
        '<label class="li-lab">Nom du temps fort</label>' +
        '<input class="li-in" id="li-evname" placeholder="ex : Salon Pharmagora">' +
        '<label class="li-lab">Date du jour J</label>' +
        '<input class="li-in" id="li-evdate" type="date" value="' + todayStr + '">' +
        '<div class="li-panelft"><span></span><div>' +
          '<button class="li-btn" onclick="V2.li.closeEditor()">Annuler</button>' +
          '<button class="li-btn li-btn-p" onclick="V2.li.genEvent()">Générer le rétroplanning</button></div></div>' +
      '</div></div>';
  };

  V2.li.genEvent = function () {
    var name = (document.getElementById('li-evname') || {}).value || '';
    var dstr = (document.getElementById('li-evdate') || {}).value || '';
    if (!name.trim() || !dstr) { alert('Renseignez un nom et une date.'); return; }
    var evId = newId(), dJ = new Date(dstr + 'T09:00');
    var chain = Promise.resolve();
    RETRO.forEach(function (r) {
      var d = new Date(dJ.getTime()); d.setDate(d.getDate() + r.off);
      var p = { id: '', date: d.toISOString(), status: 'idee', pillar: r.pillar,
        title: name + ' — ' + r.title, body: '', image_path: '', linkedin_url: '',
        event_id: evId, event_name: name, source: 'retroplanning' };
      chain = chain.then(function () { return savePost(p); });
    });
    document.getElementById('li-editor').innerHTML = '';
    chain.then(function () { calRef = new Date(dJ.getTime()); calRef.setDate(1); V2.render(); });
  };
  function parseCsv(text) {
    var rows = [], row = [], cur = '', i = 0, inQ = false, ch;
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (; i < text.length; i++) {
      ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.length && !(r.length === 1 && r[0] === ''); });
  }

  var importRows = null, importMap = { date: -1, body: -1, url: -1 };

  V2.li.importOpen = function () {
    var host = document.getElementById('li-editor');
    if (!host) { host = document.createElement('div'); host.id = 'li-editor'; document.body.appendChild(host); }
    host.innerHTML =
      '<div class="li-ov" onclick="if(event.target===this)V2.li.closeEditor()"><div class="li-panel">' +
        '<div class="li-panelhd"><b>Importer mes anciens posts</b><button class="li-x" onclick="V2.li.closeEditor()">✕</button></div>' +
        '<p class="li-lab">Déposez le fichier <b>.csv</b> de l\'export LinkedIn (Paramètres → Confidentialité → Obtenir une copie de vos données → Publications). On repère les colonnes date / texte / lien.</p>' +
        '<label class="li-btn">Choisir le fichier CSV<input type="file" accept=".csv,text/csv" style="display:none" onchange="V2.li.importFile(this)"></label>' +
        '<div id="li-impbody"></div>' +
      '</div></div>';
  };

  V2.li.importFile = function (input) {
    var f = input.files && input.files[0]; if (!f) return;
    var rdr = new FileReader();
    rdr.onload = function () {
      importRows = parseCsv(String(rdr.result));
      if (!importRows.length) { document.getElementById('li-impbody').innerHTML = '<p class="li-lab">Fichier vide ou illisible.</p>'; return; }
      var head = importRows[0];
      // auto-détection
      importMap = { date: -1, body: -1, url: -1 };
      head.forEach(function (h, idx) {
        var l = String(h).toLowerCase();
        if (importMap.date < 0 && /date/.test(l)) importMap.date = idx;
        if (importMap.body < 0 && /(comment|content|text|texte|message|share)/.test(l)) importMap.body = idx;
        if (importMap.url < 0 && /(link|url|lien)/.test(l)) importMap.url = idx;
      });
      var opts = function (sel) { return head.map(function (h, idx) { return '<option value="' + idx + '"' + (sel === idx ? ' selected' : '') + '>' + esc(h || ('Colonne ' + (idx + 1))) + '</option>'; }).join(''); };
      document.getElementById('li-impbody').innerHTML =
        '<p class="li-lab">' + (importRows.length - 1) + ' ligne(s) détectée(s). Vérifiez les colonnes :</p>' +
        '<label class="li-lab">Date</label><select class="li-in" onchange="V2.li.setMap(\'date\',this.value)">' + opts(importMap.date) + '</select>' +
        '<label class="li-lab">Texte</label><select class="li-in" onchange="V2.li.setMap(\'body\',this.value)">' + opts(importMap.body) + '</select>' +
        '<label class="li-lab">Lien</label><select class="li-in" onchange="V2.li.setMap(\'url\',this.value)">' + opts(importMap.url) + '</select>' +
        '<div class="li-panelft"><span></span><button class="li-btn li-btn-p" onclick="V2.li.doImport()">Importer</button></div>';
    };
    rdr.readAsText(f, 'utf-8');
  };
  V2.li.setMap = function (k, v) { importMap[k] = parseInt(v, 10); };

  V2.li.doImport = function () {
    if (!importRows || importRows.length < 2) return;
    var existing = {}; posts.forEach(function (p) { existing[(p.linkedin_url || '') + '|' + (p.date || '').slice(0, 10)] = 1; });
    var chain = Promise.resolve(), added = 0;
    for (var r = 1; r < importRows.length; r++) {
      var row = importRows[r];
      var rawDate = importMap.date >= 0 ? row[importMap.date] : '';
      var body = importMap.body >= 0 ? (row[importMap.body] || '') : '';
      var url = importMap.url >= 0 ? (row[importMap.url] || '') : '';
      var d = new Date(rawDate); if (isNaN(d.getTime())) d = new Date();
      var key = (url || '') + '|' + ymd(d);
      if (existing[key]) continue; existing[key] = 1;
      (function (dd, bb, uu) {
        var p = { id: '', date: dd.toISOString(), status: 'publie', pillar: 'produit',
          title: bb.slice(0, 40), body: bb, image_path: '', linkedin_url: uu, event_id: '', event_name: '', source: 'import' };
        chain = chain.then(function () { return savePost(p); });
      })(d, body, url); added++;
    }
    importRows = null;
    document.getElementById('li-editor').innerHTML = '';
    chain.then(function () { alert(added + ' ancien(s) post(s) importé(s).'); V2.render(); });
  };

  V2.li.publish = function (id) {
    var p = null; for (var i = 0; i < posts.length; i++) if (posts[i].id === id) p = posts[i];
    if (!p) return;
    var txt = p.body || '';
    function afterCopy() {
      window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank'); // ouvre le compositeur de post LinkedIn
      if (confirm('Texte copié. LinkedIn est ouvert : collez, ajoutez le visuel et publiez.\n\nMarquer ce post comme « Publié » ?')) {
        var url = prompt('Collez le lien du post publié (facultatif) :', p.linkedin_url || '');
        p.status = 'publie'; if (url) p.linkedin_url = url;
        savePost(p).then(function () { V2.render(); });
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(afterCopy, function () { window.prompt('Copiez le texte :', txt); afterCopy(); });
    } else { window.prompt('Copiez le texte :', txt); afterCopy(); }
  };

  V2.mktLinkedin.dueCount = function () { try { return duePosts().length; } catch (e) { return 0; } };

  V2.li.filter = function (k, v) { flt[k] = v; V2.render(); };
})();

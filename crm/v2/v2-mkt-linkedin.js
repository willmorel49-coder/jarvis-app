/* CRM V2 · Sous-module "Rétroplanning LinkedIn" (pages.marketing?linkedin)
   100% client-side. Supabase (V2.sb) primaire, repli localStorage. */
(function () {
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
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

  // ── Rendu ──
  function render(root) {
    root.innerHTML = (V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '') +
      '<div class="li-wrap"><h1 class="li-h1">Rétroplanning LinkedIn</h1>' +
      '<p class="li-empty" id="li-status">Chargement… (' + posts.length + ' post(s))</p></div>';
    loadPosts().then(function () {
      var el = document.getElementById('li-status');
      if (el) el.textContent = posts.length + ' post(s) · stockage : ' + backend;
    });
  }

  V2.mktLinkedin = { render: render, PILLARS: PILLARS, STATUSES: STATUSES, pillar: pillar, statusOf: statusOf,
    loadPosts: loadPosts, savePost: savePost, removePost: removePost, _posts: function () { return posts; }, newId: newId };
  V2.li = V2.li || {};
})();

/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Remontées / améliorations équipe (V2.pages.remontees)
   Mur d'idées interne : chaque commercial poste une amélioration, vote
   pour celles des autres, suit leur avancement. Partagé via Supabase
   (table `improvements`) avec REPLI localStorage tant que la table n'existe
   pas → marche en local tout de suite, partage activé dès le SQL passé.
   Outil INTERNE (aucun prix, aucun abandon de marge) — gate non-OPSO.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  var TABLE = 'improvements', LS = 'jarvis_improvements_v1';
  var backend = 'local', items = [], sortBy = 'date';
  var STATUS = { nouveau: { l: 'Nouveau', c: 'var(--c-amber)' }, 'en cours': { l: 'En cours', c: 'var(--ip-blue)' }, fait: { l: 'Fait', c: 'var(--c-mint)' } };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function localAll() { try { var a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function localWrite(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }
  function newId() { return 'r' + Date.now() + Math.floor((window.performance && performance.now ? performance.now() : 0) % 1000); }
  function fromRow(r) {
    return { id: r.id, author: r.author_name || '—', body: r.body || '', status: r.status || 'nouveau',
             votes: r.votes || 0, created: r.created_at ? new Date(r.created_at).getTime() : Date.now() };
  }
  function sortList(a) {
    return a.slice().sort(function (x, y) { return sortBy === 'votes' ? (y.votes - x.votes) || (y.created - x.created) : (y.created - x.created); });
  }

  function loadItems() {
    var c = sb();
    if (c) {
      return c.from(TABLE).select('*').order('created_at', { ascending: false })
        .then(function (r) {
          if (!r.error && r.data) { backend = 'supabase'; items = r.data.map(fromRow); return items; }
          backend = 'local'; items = localAll(); return items;
        }).catch(function () { backend = 'local'; items = localAll(); return items; });
    }
    backend = 'local'; items = localAll(); return Promise.resolve(items);
  }

  // ── POPUP « proposer une idée » (accessible partout via la topbar) ──
  V2.remonteeOpen = function () {
    if (!V2.user) { if (V2.toast) V2.toast('Connecte-toi pour proposer une idée'); return; }
    ensureCss();
    var ex = document.getElementById('v2-remonte-pop'); if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
    var o = document.createElement('div');
    o.id = 'v2-remonte-pop'; o.className = 'v2-rem-ov';
    o.innerHTML =
      '<div class="v2-rem-card" role="dialog" aria-label="Proposer une amélioration">' +
        '<div class="v2-rem-h"><span class="v2-rem-h-t">Une idée d\'amélioration&nbsp;?</span>' +
          '<button class="v2-rem-x" aria-label="Fermer" onclick="V2.remonteeClose()">&times;</button></div>' +
        '<div class="v2-rem-h-s">Bug, idée, manque… toute l\'équipe la verra.</div>' +
        '<textarea id="v2-rem-ta" class="v2-rem-ta" rows="4" placeholder="Ex : pouvoir filtrer les officines par groupement sur la carte…"></textarea>' +
        '<div class="v2-rem-foot"><span class="v2-rem-by">au nom de <b>' + esc(V2.user.name || '') + '</b></span>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.remonteeSubmit(this)">Envoyer à l\'équipe</button></div>' +
      '</div>';
    o.addEventListener('click', function (e) { if (e.target === o) V2.remonteeClose(); });
    document.body.appendChild(o);
    requestAnimationFrame(function () { o.classList.add('show'); var t = document.getElementById('v2-rem-ta'); if (t) t.focus(); });
    document.addEventListener('keydown', escClose);
  };
  function escClose(e) { if (e.key === 'Escape') V2.remonteeClose(); }
  V2.remonteeClose = function () {
    document.removeEventListener('keydown', escClose);
    var o = document.getElementById('v2-remonte-pop'); if (!o) return;
    o.classList.remove('show'); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 200);
  };
  V2.remonteeSubmit = function (btn) {
    var ta = document.getElementById('v2-rem-ta'); if (!ta) return;
    var body = (ta.value || '').trim();
    if (!body) { ta.focus(); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
    var c = sb();
    var done = function () {
      V2.remonteeClose();
      if (V2.toast) V2.toast('Idée envoyée à l\'équipe ✨');
      if (V2.route && V2.route.name === 'remontees') V2.render();
    };
    if (c) {
      // « Idée envoyée à l'équipe » ne doit pas s'afficher si l'idée n'est PAS partie.
      var repli = function () {
        saveLocalNew(body);
        if (V2.toast) V2.toast('Idée gardée sur cet ordinateur seulement — pas envoyée à l\'équipe', 'error');
        if (V2.route && V2.route.name === 'remontees') V2.render();
      };
      c.from(TABLE).insert({ author_id: V2.user.id, author_name: V2.user.name || '', body: body, status: 'nouveau', votes: 0 })
        .then(function (r) {
          if (r.error) { try { console.warn('[remontees]', r.error.message); } catch (e) {} repli(); }
          else done();
        }).catch(function () { repli(); });
    } else { saveLocalNew(body); done(); }
  };
  function saveLocalNew(body) {
    var a = localAll();
    a.unshift({ id: newId(), author: (V2.user && V2.user.name) || '—', body: body, status: 'nouveau', votes: 0, created: Date.now() });
    localWrite(a);
  }

  // ── VOTE + STATUT ──
  V2.remonteeVote = function (id) {
    var c = sb();
    if (backend === 'supabase' && c && String(id).indexOf('r') !== 0) {
      c.rpc('increment_improvement_votes', { imp_id: id }).then(function () { reload(); }).catch(function () { reload(); });
    } else {
      var a = localAll(); for (var i = 0; i < a.length; i++) if (a[i].id === id) { a[i].votes = (a[i].votes || 0) + 1; break; }
      localWrite(a); reload();
    }
  };
  V2.remonteeStatus = function (id) {
    var order = ['nouveau', 'en cours', 'fait'];
    var cur = null; for (var i = 0; i < items.length; i++) if (items[i].id === id) { cur = items[i].status; break; }
    var next = order[(order.indexOf(cur) + 1) % order.length];
    var c = sb();
    if (backend === 'supabase' && c && String(id).indexOf('r') !== 0) {
      c.from(TABLE).update({ status: next }).eq('id', id).then(function () { reload(); }).catch(function () { reload(); });
    } else {
      var a = localAll(); for (var k = 0; k < a.length; k++) if (a[k].id === id) { a[k].status = next; break; }
      localWrite(a); reload();
    }
  };
  V2.remonteeSort = function (s) { sortBy = s; reload(); };
  function reload() { loadItems().then(function () { if (V2.route && V2.route.name === 'remontees') V2.render(); }); }

  // ── PAGE LISTE ──
  V2.pages.remontees = {
    render: function (root) {
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      root.innerHTML = top +
        '<div class="v2-wrap narrow">' +
          '<div class="v2-rem-hero"><h1>Remontées de l\'équipe</h1>' +
            '<p>Propose une amélioration, vote pour celles des autres, suis leur avancement.</p>' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.remonteeOpen()">' + (V2.ICO ? V2.ICO('plus', 15, 2) : '+') + ' Proposer une idée</button></div>' +
          '<div class="v2-rem-tools"><span class="v2-rem-count" id="v2-rem-count"></span>' +
            '<div class="v2-rem-seg"><button class="' + (sortBy === 'date' ? 'on' : '') + '" onclick="V2.remonteeSort(\'date\')">Récentes</button>' +
              '<button class="' + (sortBy === 'votes' ? 'on' : '') + '" onclick="V2.remonteeSort(\'votes\')">Populaires</button></div></div>' +
          '<div id="v2-rem-list" class="v2-rem-list"><div class="v2-rem-empty">Chargement…</div></div>' +
        '</div>';
      loadItems().then(function (list) {
        var box = document.getElementById('v2-rem-list'); if (!box) return;
        var cnt = document.getElementById('v2-rem-count');
        if (cnt) cnt.textContent = list.length + (list.length > 1 ? ' remontées' : ' remontée') + (backend === 'local' ? ' · sur cet appareil' : '');
        if (!list.length) { box.innerHTML = '<div class="v2-rem-empty">Aucune remontée pour l\'instant. Sois le premier à proposer une idée&nbsp;!</div>'; return; }
        box.innerHTML = sortList(list).map(cardHtml).join('');
      });
    }
  };
  function cardHtml(it) {
    var st = STATUS[it.status] || STATUS.nouveau;
    var d = ''; try { d = new Date(it.created).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); } catch (e) {}
    var mine = V2.user && backend === 'local'; // en local tout est à soi ; en supabase l'auteur est déjà filtré par nom
    return '<div class="v2-rem-item">' +
      '<button class="v2-rem-vote" onclick="V2.remonteeVote(\'' + esc(it.id) + '\')" title="Voter"><span class="v2-rem-up">▲</span><b>' + it.votes + '</b></button>' +
      '<div class="v2-rem-body"><div class="v2-rem-txt">' + esc(it.body).replace(/\n/g, '<br>') + '</div>' +
        '<div class="v2-rem-meta"><span>' + esc(it.author) + (d ? ' · ' + d : '') + '</span>' +
          '<button class="v2-rem-st" style="--stc:' + st.c + '" onclick="V2.remonteeStatus(\'' + esc(it.id) + '\')" title="Changer le statut">' + st.l + '</button>' +
        '</div></div></div>';
  }

  function ensureCss() {
    if (document.getElementById('v2-rem-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rem-css';
    s.textContent = [
      '.v2-rem-hero{text-align:center;margin:8px 0 18px}',
      '.v2-rem-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.v2-rem-hero p{color:var(--muted);font-size:14px;max-width:46ch;margin:0 auto 16px;line-height:1.5}',
      '.v2-rem-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}',
      '.v2-rem-count{font-size:12.5px;color:var(--muted);font-weight:600}',
      '.v2-rem-seg{display:inline-flex;gap:2px;padding:3px;background:var(--card-2);border:1px solid var(--line);border-radius:10px}',
      '.v2-rem-seg button{border:none;background:none;padding:6px 12px;border-radius:7px;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer}',
      '.v2-rem-seg button.on{background:var(--card);color:var(--ip-ink);box-shadow:var(--sh-1)}',
      '.v2-rem-list{display:flex;flex-direction:column;gap:10px}',
      '.v2-rem-empty{padding:40px 20px;text-align:center;color:var(--muted);font-size:14px;background:var(--card-2);border:1px dashed var(--line-strong);border-radius:var(--r-md)}',
      '.v2-rem-item{display:flex;gap:13px;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1)}',
      '.v2-rem-vote{flex:none;display:flex;flex-direction:column;align-items:center;gap:1px;min-width:44px;border:1px solid var(--line);background:var(--card-2);border-radius:10px;padding:7px 0;cursor:pointer;color:var(--muted);transition:border-color .16s,color .16s,background .16s}',
      '.v2-rem-vote:hover{border-color:var(--ip-blue);color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 8%,var(--card))}',
      '.v2-rem-up{font-size:11px;line-height:1}',
      '.v2-rem-vote b{font-size:14px;font-variant-numeric:tabular-nums;color:var(--ip-ink)}',
      '.v2-rem-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:9px}',
      '.v2-rem-txt{font-size:14px;line-height:1.5;color:var(--ip-ink)}',
      '.v2-rem-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--muted)}',
      '.v2-rem-st{border:1px solid color-mix(in srgb,var(--stc) 40%,var(--line));background:color-mix(in srgb,var(--stc) 12%,var(--card));color:var(--stc);font:inherit;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;padding:4px 10px;border-radius:var(--r-pill);cursor:pointer}',
      // popup
      '.v2-rem-ov{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(16,19,28,.5);opacity:0;transition:opacity .2s}',
      '.v2-rem-ov.show{opacity:1}',
      '.v2-rem-card{background:var(--card);border:1px solid var(--line);border-radius:20px;max-width:440px;width:100%;padding:22px 22px 18px;box-shadow:0 24px 60px rgba(16,19,28,.56);transform:translateY(8px);transition:transform .22s}',
      '.v2-rem-ov.show .v2-rem-card{transform:none}',
      '.v2-rem-h{display:flex;align-items:center;justify-content:space-between;gap:10px}',
      '.v2-rem-h-t{font-size:18px;font-weight:800;letter-spacing:-.02em;color:var(--ip-ink)}',
      '.v2-rem-x{border:none;background:none;font-size:26px;line-height:1;color:var(--muted);cursor:pointer;width:32px;height:32px;border-radius:8px}',
      '.v2-rem-x:hover{background:var(--card-2);color:var(--ip-ink)}',
      '.v2-rem-h-s{font-size:13px;color:var(--muted);margin:2px 0 14px}',
      '.v2-rem-ta{width:100%;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:12px;padding:12px 14px;font:inherit;font-size:14px;color:var(--ip-ink);background:var(--card-2);resize:vertical;min-height:96px}',
      '.v2-rem-ta:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo,color-mix(in srgb,var(--ip-blue) 18%,transparent))}',
      '.v2-rem-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}',
      '.v2-rem-by{font-size:12px;color:var(--muted)}'
    ].join('');
    document.head.appendChild(s);
  }
})();

/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Coin notes équipe (V2.notes)
   Notes partagées sur chaque fiche client ET chaque groupement, avec
   AUTEUR + date. Partagé via Supabase (table `notes`) + REPLI localStorage
   tant que la table n'existe pas → marche en local tout de suite.
   API : V2.notes.section(scopeType, scopeId) → HTML conteneur (état vide),
   puis V2.notes.hydrate() charge les conteneurs présents dans le DOM.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var TABLE = 'notes', LS = 'jarvis_notes_v1';

  function sb() { return (V2.sb && V2.sb()) || null; }
  function localMap() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } }
  function localFor(st, sid) { var a = localMap()[st + ':' + sid]; return Array.isArray(a) ? a : []; }
  function localSet(st, sid, arr) { var m = localMap(); m[st + ':' + sid] = arr; try { localStorage.setItem(LS, JSON.stringify(m)); } catch (e) {} }
  function newId() { return 'n' + Date.now() + Math.floor((window.performance && performance.now ? performance.now() : 0) % 1000); }
  function fromRow(r) { return { id: r.id, author: r.author_name || '—', authorId: r.author_id || '', body: r.body || '', created: r.created_at ? new Date(r.created_at).getTime() : Date.now() }; }

  function load(st, sid) {
    var c = sb();
    if (c) {
      return c.from(TABLE).select('*').eq('scope_type', st).eq('scope_id', String(sid)).order('created_at', { ascending: false })
        .then(function (r) {
          if (!r.error && r.data) return { backend: 'supabase', notes: r.data.map(fromRow) };
          return { backend: 'local', notes: localFor(st, sid) };
        }).catch(function () { return { backend: 'local', notes: localFor(st, sid) }; });
    }
    return Promise.resolve({ backend: 'local', notes: localFor(st, sid) });
  }

  V2.notes = {
    // conteneur (vide) posé dans le HTML de la fiche ; hydraté ensuite
    section: function (scopeType, scopeId) {
      ensureCss();
      var id = 'v2n-' + Math.random().toString(36).slice(2, 9);
      return '<div class="v2-notes-box v2-card" id="' + id + '" data-st="' + esc(scopeType) + '" data-sid="' + esc(String(scopeId)) + '">' +
          '<div class="v2-notes-hd">' + (V2.ICO ? V2.ICO('spark', 16, 2) : '') + '<span>Notes de l\'équipe</span></div>' +
          '<div class="v2-notes-list"><div class="v2-notes-empty">Chargement…</div></div>' +
          '<div class="v2-notes-add">' +
            '<textarea class="v2-notes-ta" rows="2" placeholder="Ajouter une note (visible par l\'équipe)…"></textarea>' +
            '<button class="v2-btn v2-btn-primary v2-notes-btn" onclick="V2.notes.add(this)">Ajouter</button>' +
          '</div>' +
        '</div>';
    },

    // charge tous les conteneurs pas encore hydratés
    hydrate: function () {
      var boxes = document.querySelectorAll('.v2-notes-box:not([data-done])');
      Array.prototype.forEach.call(boxes, function (box) {
        box.setAttribute('data-done', '1');
        renderBox(box);
      });
    },

    add: function (btn) {
      var box = btn.closest('.v2-notes-box'); if (!box) return;
      if (!V2.user) { if (V2.toast) V2.toast('Connecte-toi pour ajouter une note'); return; }
      var ta = box.querySelector('.v2-notes-ta'); var body = (ta && ta.value || '').trim();
      if (!body) { if (ta) ta.focus(); return; }
      var st = box.getAttribute('data-st'), sid = box.getAttribute('data-sid');
      btn.disabled = true; btn.textContent = 'Ajout…';
      var c = sb();
      var done = function () { if (ta) ta.value = ''; if (V2.toast) V2.toast('Note ajoutée'); renderBox(box); };
      if (c) {
        c.from(TABLE).insert({ scope_type: st, scope_id: String(sid), author_id: V2.user.id, author_name: V2.user.name || '', body: body })
          .then(function (r) { if (r.error) addLocal(st, sid, body); done(); })
          .catch(function () { addLocal(st, sid, body); done(); });
      } else { addLocal(st, sid, body); done(); }
    },

    remove: function (el) {
      var box = el.closest('.v2-notes-box'); if (!box) return;
      var id = el.getAttribute('data-id'); var st = box.getAttribute('data-st'), sid = box.getAttribute('data-sid');
      var c = sb();
      if (c && String(id).indexOf('n') !== 0) {
        c.from(TABLE).delete().eq('id', id).then(function () { renderBox(box); }).catch(function () { renderBox(box); });
      } else {
        localSet(st, sid, localFor(st, sid).filter(function (x) { return x.id !== id; }));
        renderBox(box);
      }
    }
  };

  function addLocal(st, sid, body) {
    var a = localFor(st, sid);
    a.unshift({ id: newId(), author: (V2.user && V2.user.name) || '—', authorId: (V2.user && V2.user.id) || '', body: body, created: Date.now() });
    localSet(st, sid, a);
  }

  function renderBox(box) {
    var st = box.getAttribute('data-st'), sid = box.getAttribute('data-sid');
    var list = box.querySelector('.v2-notes-list'); if (!list) return;
    var btn = box.querySelector('.v2-notes-btn'); if (btn) { btn.disabled = false; btn.textContent = 'Ajouter'; }
    load(st, sid).then(function (res) {
      var notes = res.notes;
      if (!notes.length) { list.innerHTML = '<div class="v2-notes-empty">Aucune note pour l\'instant.</div>'; return; }
      var uid = (V2.user && V2.user.id) || '__';
      list.innerHTML = notes.map(function (n) {
        var d = ''; try { d = new Date(n.created).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }); } catch (e) {}
        var mine = (res.backend === 'local') || (n.authorId && n.authorId === uid);
        return '<div class="v2-note">' +
          '<div class="v2-note-top"><span class="v2-note-au">' + esc(n.author) + '</span><span class="v2-note-dt">' + d + '</span>' +
            (mine ? '<button class="v2-note-x" data-id="' + esc(n.id) + '" onclick="V2.notes.remove(this)" title="Supprimer">&times;</button>' : '') + '</div>' +
          '<div class="v2-note-bd">' + esc(n.body).replace(/\n/g, '<br>') + '</div>' +
        '</div>';
      }).join('');
    });
  }

  function ensureCss() {
    if (document.getElementById('v2-notes-css')) return;
    var s = document.createElement('style'); s.id = 'v2-notes-css';
    s.textContent = [
      '.v2-notes-box{margin-top:16px;padding:16px 18px}',
      '.v2-notes-hd{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink);margin-bottom:12px}',
      '.v2-notes-hd svg{color:var(--ip-blue)}',
      '.v2-notes-list{display:flex;flex-direction:column;gap:9px;max-height:280px;overflow-y:auto}',
      '.v2-notes-empty{font-size:13px;color:var(--muted);padding:6px 0}',
      '.v2-note{background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:10px 12px}',
      '.v2-note-top{display:flex;align-items:center;gap:8px;margin-bottom:4px}',
      '.v2-note-au{font-size:12.5px;font-weight:700;color:var(--ip-ink)}',
      '.v2-note-dt{font-size:11.5px;color:var(--muted)}',
      '.v2-note-x{margin-left:auto;border:none;background:none;color:var(--muted-2);font-size:18px;line-height:1;cursor:pointer;width:24px;height:24px;border-radius:6px}',
      '.v2-note-x:hover{background:color-mix(in srgb,var(--c-rose) 14%,transparent);color:var(--c-rose)}',
      '.v2-note-bd{font-size:13.5px;line-height:1.5;color:var(--ip-ink)}',
      '.v2-notes-add{display:flex;gap:9px;align-items:flex-end;margin-top:12px}',
      '.v2-notes-ta{flex:1;min-width:0;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:11px;padding:10px 12px;font:inherit;font-size:13.5px;color:var(--ip-ink);background:var(--card);resize:vertical;min-height:44px}',
      '.v2-notes-ta:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo,color-mix(in srgb,var(--ip-blue) 18%,transparent))}',
      '.v2-notes-btn{flex:none;white-space:nowrap}'
    ].join('');
    document.head.appendChild(s);
  }
})();

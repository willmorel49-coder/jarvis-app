/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Profil commercial (V2.profil)
   Fiche d'infos éditable par menus déroulants, sur chaque fiche CLIENT
   et chaque GROUPEMENT : grossiste n°1/n°2, génériqueur n°1/n°2, logiciel
   (LGO), robot, + champ libre. Rempli par l'équipe, modifiable à tout
   moment. Partagé via Supabase (table `profils`, 1 ligne par fiche) +
   REPLI localStorage → marche en local tout de suite.
   Listes déroulantes = valeurs par défaut, à ajuster librement (FIELDS).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var TABLE = 'profils', LS = 'jarvis_profils_v1';

  // Listes PRÉCISES (pas de « Autre » : le bouton « ➕ préciser… » ajoute une valeur exacte au besoin).
  // Intégral Pharma en tête (savoir si l'officine travaille déjà avec nous), puis les majors nationaux,
  // puis les grossistes/short-liners régionaux concurrents (Ouest surtout). Complétable via « ➕ préciser… ».
  var GROS = ['Intégral Pharma', 'OCP', 'CERP Rouen', 'CERP RRM', 'CERP Bretagne Atlantique', 'Alliance Healthcare', 'Phoenix Pharma', 'Cophana', 'Sagitta', 'Welcoop', 'Giphar Répartition', 'Anjou Santé', 'Mezeghel', 'Epsilon', 'Pharmest', 'Axipharm'];
  var GEN = ['Biogaran', 'Viatris (Mylan)', 'EG Labo', 'Teva', 'Sandoz', 'Zentiva', 'Arrow', 'Cristers', 'Zydus', 'Bouchara-Recordati', 'Sun Pharma', 'Substipharm'];
  var LGO = ['Winpharma', 'LGPI', 'Smart Rx', 'Léo', 'Pharmaland', 'Caduciel', 'Péripharm', 'Pharmavitale', 'Santé Cegedim'];
  var ROBOT = ['Aucun', 'BD Rowa', 'Mekapharm', 'Meditech', 'Sinteco', 'Willach', 'Tecny-Farma', 'Apostore', 'Omnicell'];
  // Config des champs — ajouter/retirer ici suffit.
  var FIELDS = [
    { k: 'gros1', l: 'Grossiste n°1', opts: GROS },
    { k: 'gros2', l: 'Grossiste n°2', opts: GROS },
    { k: 'gros3', l: 'Grossiste n°3', opts: GROS },
    { k: 'gen1', l: 'Génériqueur n°1', opts: GEN },
    { k: 'gen2', l: 'Génériqueur n°2', opts: GEN },
    { k: 'lgo', l: 'Logiciel (LGO)', opts: LGO },
    { k: 'robot', l: 'Robot / automate', opts: ROBOT },
    { k: 'autre', l: 'Autre info', text: true }
  ];

  function sb() { return (V2.sb && V2.sb()) || null; }
  function key(st, sid) { return st + ':' + sid; }
  function localMap() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } }
  function localGet(st, sid) { return localMap()[key(st, sid)] || null; }
  function localSet(st, sid, rec) { var m = localMap(); m[key(st, sid)] = rec; try { localStorage.setItem(LS, JSON.stringify(m)); } catch (e) {} }

  function load(st, sid) {
    var c = sb();
    if (c) {
      return c.from(TABLE).select('*').eq('scope_type', st).eq('scope_id', String(sid)).maybeSingle()
        .then(function (r) {
          if (!r.error && r.data) return { backend: 'supabase', rec: { data: r.data.data || {}, by: r.data.updated_by_name || '', at: r.data.updated_at ? +new Date(r.data.updated_at) : 0 } };
          return { backend: 'local', rec: localGet(st, sid) };
        }).catch(function () { return { backend: 'local', rec: localGet(st, sid) }; });
    }
    return Promise.resolve({ backend: 'local', rec: localGet(st, sid) });
  }

  function save(st, sid, data) {
    var by = (V2.user && V2.user.name) || '', at = Date.now();
    var c = sb();
    var rec = { data: data, by: by, at: at };
    if (c && V2.user) {
      c.from(TABLE).upsert({ scope_type: st, scope_id: String(sid), data: data, updated_by: V2.user.id, updated_by_name: by, updated_at: new Date().toISOString() }, { onConflict: 'scope_type,scope_id' })
        .then(function (r) { if (r.error) localSet(st, sid, rec); }).catch(function () { localSet(st, sid, rec); });
    } else { localSet(st, sid, rec); }
    return rec;
  }

  V2.profil = {
    section: function (scopeType, scopeId) {
      ensureCss();
      return '<div class="v2-profil-box v2-card" data-st="' + esc(scopeType) + '" data-sid="' + esc(String(scopeId)) + '">' +
          '<div class="v2-profil-hd">' + (V2.ICO ? V2.ICO('pilo', 16, 2) : '') + '<span>Profil commercial</span><small id="" class="v2-profil-meta"></small></div>' +
          '<div class="v2-profil-grid">' +
            FIELDS.map(function (f) {
              if (f.text) return '<label class="v2-profil-f v2-profil-f-wide"><span>' + esc(f.l) + '</span>' +
                '<input type="text" data-fk="' + f.k + '" placeholder="—" onchange="V2.profil.set(this)"></label>';
              return '<label class="v2-profil-f"><span>' + esc(f.l) + '</span><select data-fk="' + f.k + '" onchange="V2.profil.set(this)">' +
                '<option value="">—</option>' + f.opts.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') +
                '<option value="__add__">➕ préciser…</option></select></label>';
            }).join('') +
          '</div></div>';
    },

    hydrate: function () {
      var boxes = document.querySelectorAll('.v2-profil-box:not([data-done])');
      Array.prototype.forEach.call(boxes, function (box) { box.setAttribute('data-done', '1'); fill(box); });
    },

    set: function (el) {
      var box = el.closest('.v2-profil-box'); if (!box) return;
      if (!V2.user) { if (V2.toast) V2.toast('Connecte-toi pour modifier le profil'); fill(box); return; }
      // « ➕ préciser… » : saisir une valeur exacte non listée (puis elle rejoint la liste de ce champ)
      if (el.tagName === 'SELECT' && el.value === '__add__') {
        var custom = (window.prompt('Préciser la valeur exacte :', '') || '').trim();
        if (!custom) { fill(box); return; }   // annulation → on restaure les valeurs enregistrées (avant : el.value='' effaçait le champ à la sauvegarde suivante)
        var opt = document.createElement('option'); opt.textContent = custom; opt.value = custom;
        el.insertBefore(opt, el.querySelector('option[value="__add__"]'));
        el.value = custom;
      }
      var st = box.getAttribute('data-st'), sid = box.getAttribute('data-sid'), data = {};
      Array.prototype.forEach.call(box.querySelectorAll('[data-fk]'), function (f) {
        var v = (f.value || '').trim(); if (v && v !== '__add__') data[f.getAttribute('data-fk')] = v;
      });
      var rec = save(st, sid, data);
      setMeta(box, rec);
      if (V2.toast) V2.toast('Profil enregistré');
    }
  };

  function fill(box) {
    var st = box.getAttribute('data-st'), sid = box.getAttribute('data-sid');
    load(st, sid).then(function (res) {
      var rec = res.rec; var data = (rec && rec.data) || {};
      Array.prototype.forEach.call(box.querySelectorAll('[data-fk]'), function (f) {
        var v = data[f.getAttribute('data-fk')]; if (v == null) return;
        if (f.tagName === 'SELECT') {
          var found = false;
          Array.prototype.forEach.call(f.options, function (o) { if (o.value === v || o.textContent === v) found = true; });
          if (!found && v) { var opt = document.createElement('option'); opt.textContent = v; opt.value = v; f.insertBefore(opt, f.querySelector('option[value="__add__"]')); }
        }
        f.value = v;
      });
      setMeta(box, rec);
    });
  }
  function setMeta(box, rec) {
    var m = box.querySelector('.v2-profil-meta'); if (!m) return;
    if (rec && rec.by) { var d = ''; try { d = new Date(rec.at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); } catch (e) {} m.textContent = 'maj ' + rec.by + (d ? ' · ' + d : ''); }
    else m.textContent = 'à compléter';
  }

  function ensureCss() {
    if (document.getElementById('v2-profil-css')) return;
    var s = document.createElement('style'); s.id = 'v2-profil-css';
    s.textContent = [
      '.v2-profil-box{margin-top:16px;padding:16px 18px}',
      '.v2-profil-hd{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink);margin-bottom:14px}',
      '.v2-profil-hd svg{color:var(--ip-blue)}',
      '.v2-profil-meta{margin-left:auto;font-size:11.5px;font-weight:500;color:var(--muted);text-transform:none;letter-spacing:0}',
      '.v2-profil-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px 14px}',
      '@media(max-width:560px){.v2-profil-grid{grid-template-columns:1fr}}',
      '.v2-profil-f{display:flex;flex-direction:column;gap:5px;min-width:0}',
      '.v2-profil-f-wide{grid-column:1/-1}',
      '.v2-profil-f>span{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}',
      '.v2-profil-f select,.v2-profil-f input{width:100%;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:10px;padding:9px 11px;font:inherit;font-size:13.5px;color:var(--ip-ink);background:var(--card-2);cursor:pointer}',
      '.v2-profil-f input{cursor:text}',
      '.v2-profil-f select:focus,.v2-profil-f input:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo,color-mix(in srgb,var(--ip-blue) 18%,transparent))}'
    ].join('');
    document.head.appendChild(s);
  }
})();

/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Dernière visite (V2.visite)
   Marque la date du jour de passage sur une pharmacie. Écrit TOUT DE SUITE
   en localStorage (clé 'jarvis_visites_v1' = {pharmacyId: dateISO}) → marche
   sans Supabase, ET tente un insert Supabase (table `visites`). Un cache
   mémoire fusionne local + Supabase pour lecture immédiate.
   API : V2.visite.mark(pid, cb) · V2.visite.last(pid)->ISO|null ·
         V2.visite.all()->{pid:ISO} · V2.visite.load(cb)
   Repli 100% localStorage si la table n'existe pas (comme v2-notes.js).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var TABLE = 'visites', LS = 'jarvis_visites_v1';
  var _cache = null; // cache mémoire Supabase {pid: dateISO}, chargé par load()

  function sb() { return (V2.sb && V2.sb()) || null; }

  // localStorage : {pid: 'YYYY-MM-DD'}
  function localMap() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } }
  function localSet(m) { try { localStorage.setItem(LS, JSON.stringify(m)); } catch (e) {} }

  // Date du jour au format YYYY-MM-DD (local, pas UTC — pour ne pas décaler le soir)
  function today() {
    var d = new Date();
    var mm = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (mm < 10 ? '0' + mm : mm) + '-' + (dd < 10 ? '0' + dd : dd);
  }

  // garde la date la plus récente entre deux ISO 'YYYY-MM-DD' (comparaison lexicale OK)
  function maxDate(a, b) {
    if (!a) return b || null;
    if (!b) return a || null;
    return a >= b ? a : b;
  }

  // fusionne local + cache Supabase → {pid: dateISO}
  function merged() {
    var lm = localMap(), out = {}, k;
    for (k in lm) { if (lm.hasOwnProperty(k)) out[k] = lm[k]; }
    if (_cache) { for (k in _cache) { if (_cache.hasOwnProperty(k)) out[k] = maxDate(out[k], _cache[k]); } }
    return out;
  }

  V2.visite = {
    // marque la pharmacie comme visitée aujourd'hui : localStorage tout de suite,
    // puis tentative Supabase (avalée si échec). cb() appelé dans tous les cas.
    mark: function (pharmacyId, cb) {
      var pid = String(pharmacyId == null ? '' : pharmacyId);
      var date = today();
      // 1) localStorage immédiat (source de vérité de repli)
      var m = localMap(); m[pid] = maxDate(m[pid], date); localSet(m);
      // 2) cache mémoire à jour pour un last() instantané
      if (!_cache) _cache = {};
      _cache[pid] = maxDate(_cache[pid], date);
      // 3) insert Supabase best-effort (silencieux si table absente / hors ligne)
      var c = sb();
      if (c && V2.user && V2.user.id) {
        try {
          c.from(TABLE).insert({ pharmacy_id: pid, user_id: V2.user.id, visited_at: date })
            .then(function () {}, function () {});
        } catch (e) {}
      }
      if (typeof cb === 'function') { try { cb(); } catch (e) {} }
    },

    // dernière visite connue (max local + cache Supabase), ou null
    last: function (pharmacyId) {
      var pid = String(pharmacyId == null ? '' : pharmacyId);
      var d = maxDate(localMap()[pid], _cache ? _cache[pid] : null);
      return d || null;
    },

    // toutes les dernières visites {pid: dateISO}
    all: function () { return merged(); },

    // au boot : charge les visites Supabase dans le cache mémoire (fusion local).
    // Repli silencieux si la table n'existe pas. cb() toujours appelé.
    load: function (cb) {
      var done = function () { if (typeof cb === 'function') { try { cb(); } catch (e) {} } };
      var c = sb();
      if (!c) { _cache = _cache || {}; done(); return; }
      try {
        c.from(TABLE).select('pharmacy_id, visited_at')
          .then(function (r) {
            if (r && !r.error && r.data) {
              var map = {};
              for (var i = 0; i < r.data.length; i++) {
                var row = r.data[i]; if (!row) continue;
                var pid = String(row.pharmacy_id == null ? '' : row.pharmacy_id);
                var dt = row.visited_at ? String(row.visited_at).slice(0, 10) : null;
                if (pid && dt) map[pid] = maxDate(map[pid], dt);
              }
              _cache = map;
            } else { _cache = _cache || {}; }
            done();
          }, function () { _cache = _cache || {}; done(); });
      } catch (e) { _cache = _cache || {}; done(); }
    }
  };
})();

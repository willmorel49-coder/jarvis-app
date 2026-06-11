/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Boot — auth Supabase + chargement données (réutilise l'infra
   existante : mêmes tables pharmacies/imports/sales + fichiers data .js)
   État global : window.V2 = { user, pharmacies, sales, imports, ... }
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var V2 = window.V2 = window.V2 || {};
  V2.user = null;
  V2.pharmacies = [];
  V2.imports = [];
  V2.sales = [];
  V2.ready = false;

  var sb = null;
  function getSb() {
    if (!sb && window.supabase && window.SUPABASE_URL) {
      sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
    return sb;
  }
  V2.sb = getSb;

  // ── AUTH ──────────────────────────────────────
  V2.loadUserProfile = async function () {
    try {
      var c = getSb(); if (!c) return false;
      var u = await c.auth.getUser();
      var user = u && u.data && u.data.user;
      if (!user) return false;
      var pr = await c.from('user_profiles').select('*').eq('id', user.id).single();
      if (pr.error || !pr.data) { await c.auth.signOut(); return false; }
      V2.user = { id: user.id, email: user.email, name: pr.data.name, role: pr.data.role, pharmacyIds: pr.data.pharmacy_ids };
      return true;
    } catch (e) { return false; }
  };

  V2.signIn = async function (email, password) {
    var c = getSb(); if (!c) return { ok: false, msg: 'Connexion indisponible' };
    var r = await c.auth.signInWithPassword({ email: email, password: password });
    if (r.error) return { ok: false, msg: r.error.message };
    var ok = await V2.loadUserProfile();
    return { ok: ok, msg: ok ? '' : 'Profil introuvable' };
  };

  V2.signOut = async function () {
    var c = getSb(); if (c) { try { await c.auth.signOut(); } catch (e) {} }
    V2.user = null; V2.ready = false;
    location.reload();
  };

  // ── DONNÉES : WML (source de vérité) sinon Supabase ────
  V2.loadData = async function () {
    // Source de vérité = fichiers WML (officines + ventes, 5 mois) générés
    // depuis WML_pharmacies + WML_01..05. Chargés en statique avant le boot.
    if (window.WML_OFFICINES && window.WML_SALES) {
      V2.pharmacies = window.WML_OFFICINES.map(function (p) {
        return { id: String(p.id), name: p.name, code: p.code, color: p.color,
                 ville: p.ville, cp: p.cp, tel: p.tel, groupement: p.groupement, potentiel: p.potentiel };
      });
      V2.sales = window.WML_SALES.map(function (s) {
        return { id: null, importId: null, pharmacyId: String(s.pharmacyId), month: s.month, year: s.year,
                 artDesignation: s.artDesignation, artCode: s.artCode, artFamille: s.artFamille || null,
                 qte: s.qte || 0, puBrut: s.puBrut || 0, puNet: s.puNet || 0, mntNetHt: s.mntNetHt || 0 };
      });
      V2.imports = [];
      V2.ready = true;
      return;
    }

    var c = getSb(); if (!c) return;
    var res = await Promise.all([
      c.from('pharmacies').select('*').order('name'),
      c.from('imports').select('*').order('imported_at', { ascending: false }),
      c.from('sales').select('*'),
    ]);
    var pharmacies = res[0].data || [], imports = res[1].data || [], sales = res[2].data || [];
    V2.pharmacies = pharmacies.map(function (p) { return { id: p.id, name: p.name, code: p.code, color: p.color }; });
    V2.imports = imports.map(function (i) { return { id: i.id, pharmacyId: i.pharmacy_id, month: i.month, year: i.year, filename: i.filename, importedAt: i.imported_at }; });
    V2.sales = sales.map(function (s) {
      return {
        id: s.id, importId: s.import_id, pharmacyId: s.pharmacy_id, month: s.month, year: s.year,
        artDesignation: s.art_designation, artCode: s.art_code, artFamille: s.art_famille || null,
        qte: parseFloat(s.qte) || 0, puBrut: parseFloat(s.pu_brut) || 0,
        puNet: parseFloat(s.pu_net) || 0, mntNetHt: parseFloat(s.mnt_net_ht) || 0,
      };
    });
    // Filtre rôle commercial
    if (V2.user && V2.user.role === 'commercial' && V2.user.pharmacyIds && V2.user.pharmacyIds.length) {
      var allowed = new Set(V2.user.pharmacyIds.map(String));
      V2.sales = V2.sales.filter(function (s) { return allowed.has(String(s.pharmacyId)); });
    }
    V2.ready = true;
  };

  // ── Chargement lazy des gros fichiers data (.js globaux) ──
  var DATA_FILES = {
    bench: 'benchmark-data.js',
    establishments: 'establishments-aggregate.js',
    offilog: 'offilog-data.js',
    drakkars: 'drakkars-data.js',
    cap3000: 'cap3000-data.js',
    sagitta: 'sagitta-shortlist-data.js',
    clients: 'clients-data.js',
  };
  var loaded = {}, pending = {};
  function bridge() {
    try { if (typeof BENCHMARK !== 'undefined') window.BENCHMARK = BENCHMARK; } catch (e) {}
    try { if (typeof OFFILOG !== 'undefined') window.OFFILOG = OFFILOG; } catch (e) {}
    try { if (typeof DRAKKARS !== 'undefined') window.DRAKKARS = DRAKKARS; } catch (e) {}
    try { if (typeof CAP3000 !== 'undefined') window.CAP3000 = CAP3000; } catch (e) {}
    try { if (typeof CLIENTS !== 'undefined') window.CLIENTS = CLIENTS; } catch (e) {}
    try { if (typeof SAGITTA_SHORTLIST !== 'undefined') window.SAGITTA_SHORTLIST = SAGITTA_SHORTLIST; } catch (e) {}
    try { if (typeof ESTABLISHMENTS !== 'undefined') window.ESTABLISHMENTS = ESTABLISHMENTS; } catch (e) {}
    try { if (typeof OPS_AGGREGATE !== 'undefined') window.OPS_AGGREGATE = OPS_AGGREGATE; } catch (e) {}
    try { if (typeof CPR_AGGREGATE !== 'undefined') window.CPR_AGGREGATE = CPR_AGGREGATE; } catch (e) {}
    try { if (typeof HP_AGGREGATE !== 'undefined') window.HP_AGGREGATE = HP_AGGREGATE; } catch (e) {}
  }
  V2.loadFiles = function (keys) {
    // chemins relatifs au dossier parent crm/ (les data files sont dans crm/)
    var V = '?v=20260610v2a';
    var promises = keys.map(function (k) {
      var src = '../' + DATA_FILES[k];
      if (loaded[src]) return Promise.resolve();
      if (pending[src]) return pending[src];
      var p = new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = src + V; s.async = false;
        s.onload = function () { loaded[src] = true; bridge(); resolve(); };
        s.onerror = function () { console.warn('[V2] échec ' + src); resolve(); };
        document.head.appendChild(s);
      });
      pending[src] = p;
      return p;
    });
    return Promise.all(promises).then(bridge);
  };
  V2.dataLoaded = function (key) {
    return loaded['../' + DATA_FILES[key]] === true;
  };

  // ── Helpers métier partagés ───────────────────
  V2.sumCA = function (sales) { return sales.reduce(function (a, s) { return a + (s.mntNetHt || 0); }, 0); };
  V2.fmtEur = function (n) {
    if (!isFinite(n) || !n) return '0 €';
    if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('fr-FR') + ' €';
    return n.toFixed(2).replace('.', ',') + ' €';
  };
  V2.fmtK = function (n) {
    if (!isFinite(n) || !n) return '0';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '').replace('.', ',') + ' M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k';
    return Math.round(n).toLocaleString('fr-FR');
  };
  V2.fmtNum = function (n) { return (Math.round(n) || 0).toLocaleString('fr-FR'); };

  // Barème MDL France (validé mémoire) — REMBOURSABLES uniquement
  V2.margeMDLboite = function (prixNet) {
    if (!(prixNet > 0)) return 0;
    if (prixNet <= 4.33) return 0.18;
    if (prixNet <= 468) return prixNet * 0.039;
    return 19.50;
  };
})();

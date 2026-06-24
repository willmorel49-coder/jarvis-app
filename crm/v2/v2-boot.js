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
  V2.commFilter = '';   // '' = tous | 'Will' | 'Pauline'
  // ventes du commercial filtré (ou toutes)
  V2.commSales = function () {
    return V2.commFilter ? V2.sales.filter(function (s) { return s.commercial === V2.commFilter; }) : V2.sales;
  };
  // y a-t-il plusieurs commerciaux dans les données ?
  V2.commercials = function () {
    var set = {}; (V2.sales || []).forEach(function (s) { if (s.commercial) set[s.commercial] = 1; });
    return Object.keys(set).sort();
  };

  // ── Prix le plus bas (offre labo Sanofi/UPSA… via offre_ip) ─────
  // Renvoie { ip, ht, remise, offre } : on prend l'offre labo si elle existe
  // et est inférieure au prix net standard. La remise est recalculée sur ce
  // prix le plus bas. Utilisé partout où on affiche un prix IP.
  V2.bestPrice = function (b) {
    if (!b) return { ip: null, ht: null, remise: 0, offre: false };
    var ht = (b.prix_ht != null && b.prix_ht > 0) ? b.prix_ht : 0;   // PPHT / tarif grossiste
    var ip0 = (b.prix_ip != null && b.prix_ip > 0) ? b.prix_ip : 0;  // prix net IP
    var off = (b.offre_ip != null && b.offre_ip > 0) ? b.offre_ip : 0;
    // Offre labo valide UNIQUEMENT par rapport au PPHT : sous le tarif + remise réaliste
    // (≤ 50% du PPHT). Sans PPHT (prix_ht=0, ex vaccins à offre_ip aberrante 2,86 vs 73€)
    // → offre ignorée d'office. La remise se calcule TOUJOURS sur le PPHT.
    var offre = off > 0 && ht > 0 && off < ht && off >= ht * 0.5;
    var ip = offre ? off : ip0;                                      // prix le plus bas
    var remise = (ht > 0 && ip > 0 && ip <= ht) ? Math.round((1 - ip / ht) * 1000) / 10 : 0;
    return { ip: ip > 0 ? ip : null, ht: ht > 0 ? ht : null, remise: remise, offre: offre && (!ip0 || off < ip0) };
  };

  // ── Couleur « bon / à surveiller / faible » selon des seuils ───
  // v >= good → vert (mint) · v >= mid → ambre · sinon → rose
  V2.tint = function (v, mid, good) {
    if (v >= good) return 'var(--c-mint)';
    if (v >= mid) return 'var(--c-amber)';
    return 'var(--c-rose)';
  };

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

  // ── Périmètre OPSO Santé (mode multi-marque) ────
  // Si window.OPSO_LISTING_2026 est chargé (app opso/v2/), on restreint le
  // périmètre aux 129 officines du listing officiel (par CODE CIP) et on
  // marque celles présentes dans les données (inDb = "commande déjà").
  V2.applyOpsoPerimeter = function () {
    var listing = (typeof OPSO_LISTING_2026 !== 'undefined' && OPSO_LISTING_2026) ? OPSO_LISTING_2026
      : (typeof window !== 'undefined' && window.OPSO_LISTING_2026) ? window.OPSO_LISTING_2026 : null;
    if (!listing || !listing.length) return;
    var norm = function (c) { return String(c == null ? '' : c).replace(/\D/g, '').replace(/^0+/, ''); };
    var byCip = {}, byName = {};
    (V2.pharmacies || []).forEach(function (p) {
      var c = norm(p.code || p.id); if (c && !byCip[c]) byCip[c] = p;
      var n = (p.name || '').trim().toUpperCase(); if (n && !byName[n]) byName[n] = p;
    });

    // Achats par officine déposés dans opso/STATISTIQUES (opso-stats-data.js)
    var statsRows = (typeof window !== 'undefined' && window.OPSO_STATS_SALES) ? window.OPSO_STATS_SALES : [];
    var statsByCip = {};
    statsRows.forEach(function (r) {
      var c = norm(r.cip); if (!c) return;
      (statsByCip[c] = statsByCip[c] || []).push(r);
    });
    // Mois présents dans les ventes WML : on répartit les achats cumulés des
    // fichiers STATISTIQUES sur TOUS ces mois (1 fichier = cumul de la période),
    // pour que le CA soit juste en vue mois / 3 mois / année.
    var seenK = {}, refMonths = [];
    (V2.sales || []).forEach(function (s) {
      if (s.month && s.year) { var k = s.year * 12 + s.month; if (!seenK[k]) { seenK[k] = 1; refMonths.push({ year: s.year, month: s.month }); } }
    });
    if (!refMonths.length) refMonths = [{ year: 2026, month: 1 }];
    var nMonths = refMonths.length;

    V2.pharmacies = listing.map(function (a) {
      var cip = norm(a.cip || a.code);
      var db = byCip[cip] || byName[(a.nom || a.name || '').trim().toUpperCase()];
      var hasStats = !!statsByCip[cip];
      return {
        id: db ? db.id : ('LST-' + (cip || (a.nom || a.name || '').trim())),
        name: (db && db.name) || a.nom || a.name || '',
        code: cip || (db && db.code) || '',
        color: (db && db.color) || '#11a63c',
        ville: a.ville || (db && db.ville) || '', cp: a.cp || (db && db.cp) || '',
        tel: a.tel || (db && db.tel) || '', perimetre: a.perimetre || '',
        groupement: 'OPSO SANTE', potentiel: (db && db.potentiel) || 0,
        inDb: !!db || hasStats, hasStats: hasStats,
      };
    });

    // Injecte les ventes "stats officine" sur la bonne pharmacie (par CIP)
    var phByCip = {}; V2.pharmacies.forEach(function (p) { var c = norm(p.code); if (c) phByCip[c] = p; });
    Object.keys(statsByCip).forEach(function (c) {
      var ph = phByCip[c]; if (!ph) return;
      statsByCip[c].forEach(function (r) {
        // réparti à parts égales sur chaque mois de la période
        refMonths.forEach(function (m) {
          V2.sales.push({
            id: null, importId: null, pharmacyId: String(ph.id), month: m.month, year: m.year,
            artDesignation: r.artDesignation, artCode: r.artCode, artFamille: null,
            qte: (r.qte || 0) / nMonths, puBrut: r.puBrut || 0, puNet: r.puNet || 0,
            mntNetHt: (r.mntNetHt || 0) / nMonths,
          });
        });
      });
    });

    var ids = {}; V2.pharmacies.forEach(function (p) { ids[String(p.id)] = 1; });
    V2.sales = (V2.sales || []).filter(function (s) { return ids[String(s.pharmacyId)]; });
  };

  // ── DONNÉES : WML (source de vérité) sinon Supabase ────
  V2.loadData = async function () {
    // Source de vérité = fichiers WML (officines + ventes, 5 mois) générés
    // depuis WML_pharmacies + WML_01..05. Chargés en statique avant le boot.
    if (window.WML_OFFICINES && window.WML_SALES) {
      V2.pharmacies = window.WML_OFFICINES.map(function (p) {
        return { id: String(p.id), name: p.name, code: p.code, color: p.color,
                 ville: p.ville, cp: p.cp, tel: p.tel, groupement: p.groupement, potentiel: p.potentiel,
                 lat: (typeof p.lat === 'number' ? p.lat : null), lng: (typeof p.lng === 'number' ? p.lng : null),
                 comms: p.comms || [] };
      });
      // format compact tableau : [pharmacyId, mois, commercial, cip13, qte, puNet, mntNetHt]
      V2.sales = window.WML_SALES.map(function (s) {
        return { id: null, importId: null, pharmacyId: String(s[0]), month: s[1], year: 2026,
                 commercial: s[2] || '', artDesignation: '', artCode: s[3], artFamille: null,
                 qte: s[4] || 0, puBrut: 0, puNet: s[5] || 0, mntNetHt: s[6] || 0 };
      });
      V2.imports = [];
      V2.applyOpsoPerimeter();
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
    V2.applyOpsoPerimeter();
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
  // Corrige le prix NR au tarif officiel PPHT (window.PPHT) directement dans le
  // benchmark : impacte partout (groupements, fiches, catalogue, listes).
  V2.applyPPHT = function () {
    if (V2._pphtDone) return;
    var P = window.PPHT, NR = window.PPHT_NR || {}, B = window.BENCHMARK;
    if (!P || !B || !B.length) return;
    var n = 0;
    for (var i = 0; i < B.length; i++) {
      var b = B[i], c = b && b.cip13 ? String(b.cip13) : '';
      if (!c || !(P[c] > 0)) continue;          // ignore PPHT absent ou ≤ 0 (ex Shingrix=0) → jamais de prix à 0
      var pp = P[c];
      b.prix_ht = pp;                           // tarif grossiste officiel (HT) — corrige les prix_ht=0
      // NR : marge libre PLM -> on aligne le prix IP sur le PPHT et on neutralise
      // l'offre labo (pas de tag OFFRE sur un NR). Remboursable : on garde le prix_ip réel.
      if (NR[c]) { if (!(b.prix_ip > 0 && b.prix_ip < pp)) b.prix_ip = pp; b.offre_ip = 0; }
      // recalcule la remise (évite les % aberrants pré-calculés quand prix_ht était 0)
      b.remise_pct = (b.prix_ht > 0 && b.prix_ip > 0 && b.prix_ip <= b.prix_ht)
        ? Math.round((1 - b.prix_ip / b.prix_ht) * 1000) / 10 : 0;
      n++;
    }
    V2._pphtDone = true;
    try { console.log('[V2] PPHT appliqué à ' + n + ' produits'); } catch (e) {}
  };
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
    V2.applyPPHT();
  }
  V2.loadFiles = function (keys) {
    // chemins relatifs au dossier parent crm/ (les data files sont dans crm/)
    // ⚠️ DOIT être bumpé en même temps que la version globale (sinon le SW ressert les vieilles données)
    var V = '?v=20260611v2DT';
    var promises = keys.map(function (k) {
      var src = (window.V2_DATA_BASE || '../') + DATA_FILES[k];
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
    if (typeof n !== 'number' || !isFinite(n)) return '—';   // prix inconnu → tiret (pas "0 €" trompeur)
    if (n === 0) return '0 €';
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

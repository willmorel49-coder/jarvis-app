/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Boot — auth Supabase + chargement données (réutilise l'infra
   existante : mêmes tables pharmacies/imports/sales + fichiers data .js)
   État global : window.V2 = { user, pharmacies, sales, imports, ... }
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var V2 = window.V2 = window.V2 || {};

  // Officines en « reprise récente » (changement d'entité juridique FINESS+) — robot mensuel.
  // JSON fetché frais (cache-buster + no-store, comme infos-jour) → auto-actualisé sans re-déploiement.
  window.REPRISES = window.REPRISES || {};
  (function () {
    var day = new Date().toISOString().slice(0, 10);
    fetch('reprises.json?d=' + day, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { window.REPRISES = j || {}; if (V2.render && V2.route) V2.render(); })
      .catch(function () {});
  })();

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
    var ip = (offre && (!ip0 || off < ip0)) ? off : ip0;             // prix le plus bas : l'offre seulement si elle bat le net standard
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
      // Utilisateur « OPSO seulement » (ex. Normandie Pharma) : n'a pas accès au CRM Intégral.
      // S'il ouvre l'app Intégral (brand non-opso), on le renvoie vers son espace OPSO.
      if (pr.data.opso_only && !(window.V2_BRAND && window.V2_BRAND.opso)) {
        try { location.replace('../../opso/v2/index.html'); } catch (e) {}
        return false;
      }
      // `commercial` (nom exact dans les données de ventes) = périmètre du Pilotage.
      // Vide/NULL = super-admin (voit tous les commerciaux). Sinon = restreint à SON CA + le global.
      // `voit_tous_commerciaux` ouvre le Pilotage complet SANS vider `commercial` : ce champ sert
      // aussi aux campagnes et au planning RDV, le vider ferait perdre le repère « moi ».
      // ⚠️ `role` ne peut pas servir à ça : toute l'équipe commerciale est en `admin`.
      V2.user = { id: user.id, email: user.email, name: pr.data.name, role: pr.data.role, pharmacyIds: pr.data.pharmacy_ids, commercial: pr.data.commercial || '', opsoOnly: !!pr.data.opso_only, voitTous: pr.data.voit_tous_commerciaux === true };
      // 24/08/2026 — l'écran de DÉPART ne passe pas par V2.go() : sans cette
      // ligne, l'accueil (l'écran le plus ouvert de tous) serait le seul
      // à n'être jamais mesuré.
      try { if (V2.mesurer && V2.route) V2.mesurer(V2.route.name); } catch (e) {}
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
      var db = byCip[cip];
      if (!db) {   // fallback par NOM : uniquement si la ville concorde (sinon on rattache un homonyme d'une autre région)
        var dbN = byName[(a.nom || a.name || '').trim().toUpperCase()];
        var vA = (a.ville || '').trim().toUpperCase(), vN = (dbN && dbN.ville || '').trim().toUpperCase();
        if (dbN && vA && vN && vA === vN) db = dbN;
      }
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
    // pharmacies ayant déjà des ventes WML → ne PAS ré-injecter leurs stats (sinon CA doublé : les stats sont les mêmes commandes)
    var hasWmlSales = {}; V2.sales.forEach(function (s) { hasWmlSales[String(s.pharmacyId)] = 1; });
    Object.keys(statsByCip).forEach(function (c) {
      var ph = phByCip[c]; if (!ph) return;
      if (hasWmlSales[String(ph.id)]) return;   // déjà des ventes WML → skip (les stats ne servent qu'aux officines absentes de WML)
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
      // ── Format compacté (13/08/2026) ────────────────────────────────
      // Les trois colonnes répétées 437 848 fois — code officine, nom du
      // commercial, code produit — ne sont plus écrites en toutes lettres dans
      // le fichier, mais remplacées par un NUMÉRO DE RANG dans trois listes
      // livrées en tête. 27 Mo -> 16,6 Mo au téléchargement, sans qu'un seul
      // chiffre bouge. C'est ce fichier qui figeait le premier écran.
      //
      // ⚠️ ON REDONNE À window.WML_SALES SA FORME D'ORIGINE, ICI ET UNE SEULE
      // FOIS. Deux modules — Audit Marge (v2-audit.js) et Appro (v2-appro.js) —
      // lisent ce tableau EN DIRECT en supposant l'ancien format, à une
      // vingtaine d'endroits. Les corriger un par un, c'était prendre le risque
      // d'en oublier un : le sous-agent gardien-deploiement a mesuré que sans
      // ce décodage, 0 ligne sur 437 848 retrouvait son produit — Audit Marge
      // serait tombé à zéro partout et Appro serait resté vide, SANS la moindre
      // erreur à l'écran. Un défaut silencieux, que personne n'aurait vu venir.
      //
      // Le gain visé était le POIDS DU TÉLÉCHARGEMENT, pas la mémoire : après
      // décodage on occupe exactement ce qu'on occupait avant. Aucune régression.
      var dOff = window.WML_D_OFFICINES, dCom = window.WML_D_COMMERCIAUX, dPro = window.WML_D_PRODUITS;
      // ⚠️ 15/08/2026 — décodage SUR PLACE, et non plus par `.map()`.
      // `.map()` fabriquait un SECOND tableau de 437 848 lignes pendant que le
      // premier était encore en mémoire : le pic doublait, au pire moment, sur
      // l'appareil qui a le moins de mémoire. Une boucle qui réécrit les trois
      // cases concernées donne exactement le même résultat sans rien allouer.
      if (dOff && dCom && dPro && window.WML_SALES.length &&
          typeof window.WML_SALES[0][0] === 'number') {
        var W = window.WML_SALES;
        for (var iw = 0; iw < W.length; iw++) {
          var s = W[iw];
          s[0] = dOff[s[0]]; s[2] = dCom[s[2]]; s[3] = dPro[s[3]];
        }
      }
      // format tableau : [pharmacyId, mois, commercial, cip13, qte, puNet, mntNetHt]
      V2.sales = window.WML_SALES.map(function (s) {
        return { id: null, importId: null, pharmacyId: String(s[0]), month: s[1], year: 2026,
                 commercial: s[2] || '', artDesignation: '', artCode: s[3], artFamille: null,
                 qte: s[4] || 0, puBrut: 0, puNet: s[5] || 0, mntNetHt: s[6] || 0 };
      });
      V2.imports = [];
      V2.applyOpsoPerimeter();
      V2.donneesSecours = false;   // les vraies données ont pris la place du repli
      V2.ready = true;
      // Corrections manuelles (ex. groupement changé depuis une fiche) — appliquées en arrière-plan.
      try { if (V2.profil && V2.profil.applyOverrides) V2.profil.applyOverrides(function () { if (V2.render) V2.render(); }); } catch (e) {}
      return;
    }

    // ── Repli sur les anciennes tables Supabase ─────────────────────────────
    // ⚠️ 14/08/2026 — c'est CE repli qui a fait dire à l'app « 22 officines
    // actives » sur l'iPhone de Will, au lieu de 690. Ces tables datent de la
    // V1 : dernier import le 19/05/2026, ventes arrêtées à avril. Et l'API
    // Supabase plafonne une requête à 1 000 lignes (`max_rows`) : les 20 001
    // ventes reviennent tronquées aux 1 000 premières, qui ne touchent que
    // **22 officines**. Le compte affiché correspondait exactement.
    //
    // Rien ne signalait la substitution. On la marque désormais : `V2.donneesSecours`
    // est lu par l'écran, qui doit prévenir plutôt que servir ces chiffres comme
    // s'ils étaient ceux du jour. Des chiffres périmés qu'on croit sont pires
    // que pas de chiffres du tout.
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
    V2.donneesSecours = true;
    console.warn('[V2] données de SECOURS (anciennes tables) : ' + V2.pharmacies.length
      + ' officines, ' + V2.sales.length + ' ventes'
      + (sales.length >= 1000 ? ' — TRONQUÉ à 1 000 lignes par l’API' : ''));
    V2.ready = true;
  };

  // ── Chargement lazy des gros fichiers data (.js globaux) ──
  var DATA_FILES = {
    bench: 'benchmark-data.js',
    establishments: 'establishments-aggregate.js',
    offilog: 'offilog-data.js',
    // 03/09/2026 — nos conditions commerciales Offilog (prix d'achat, écart,
    // taux de marge) ont quitté offilog-data.js, qui part dans un dépôt PUBLIC.
    // 77 Ko, chargé par adresse signée en même temps que le catalogue.
    offilogcond: 'offilog-conditions.js',
    // Les prix B2B des meilleures ventes : même raison, même traitement.
    // L'en-tête du fichier public disait « connecté, prix B2B » — 6 192
    // prix de vente aux pharmacies, téléchargeables sans mot de passe.
    offilogbestprix: 'v2/offilog-best-prix.js',
    drakkars: 'drakkars-data.js',
    cap3000: 'cap3000-data.js',
    sagitta: 'sagitta-shortlist-data.js',
    clients: 'clients-data.js',
    // wml (27 Mo : officines + ventes réseau) — chargé À LA DEMANDE au 1er rendu,
    // plus au boot (sortait 27 Mo du chargement initial = écran blanc figé 30 s).
    // ⚠️ dans crm/v2/, pas crm/ → chemin préfixé v2/ (base loadFiles = '../').
    wml: 'v2/wml-officines-data.js',
    // Les logos de groupements (3,6 Mo d'images) ont quitte le fichier de
    // ventes le 15/08/2026 : charges a la demande par le premier ecran qui
    // en affiche, jamais au demarrage.
    grplogos: 'v2/grp-logos-wml.js',
    // Le catalogue Intégral EN ENTIER (16 305 références, 1,3 Mo). Il ne sert
    // qu'à l'onglet « Catalogue » de l'écran Produits : chargé à l'ouverture de
    // cet onglet, jamais au démarrage (règle de poids, ROBOT.md §11.6).
    catcomplet: 'v2/catalogue-complet-data.js',
  };

  // ── Les fichiers de données reviennent dans le dépôt (15/08/2026) ────
  // Le 13/08, `wml-officines-data.js`, `establishments-aggregate.js` et
  // `sagitta-shortlist-data.js` sont partis dans un espace Supabase fermé,
  // chargés par adresse signée. Intention correcte, effet non mesuré : ces
  // fichiers étaient servis par le service worker et RESTAIENT sur l'appareil.
  // En les déplaçant, l'app s'est mise à retélécharger 17 Mo À CHAQUE
  // OUVERTURE. Sur l'iPhone de Will, ça ne passait pas : app inutilisable
  // deux jours, et — avant qu'on s'en aperçoive — de FAUX chiffres affichés.
  //
  // Will a tranché le 15/08 en connaissance de cause (« oui refait comme
  // avant ») : les fichiers reviennent dans le dépôt et repassent par le
  // service worker, comme tous les autres. `PROTEGES` reste, VIDE, parce que
  // tout le mécanisme de garde autour (témoin de chargement, signalement des
  // échecs) sert encore et ne dépend pas de Supabase.
  //
  // ⚠️ NE PAS reprotéger ces fichiers sans traiter d'abord leur POIDS :
  // 13,4 Mo de ventes sur une seule ligne + 3,6 Mo de logos en base64 logés
  // dans le fichier de ventes. Reprotéger sans découper referait la panne.
  // ⚠️ N'y remettre QUE des fichiers légers. Une adresse signée n'est pas mise
  // en cache par le service worker : le fichier repart à chaque ouverture.
  // C'est ce qui avait rendu l'app inutilisable en août avec 17 Mo. 77 Ko, oui.
  var PROTEGES = {
    offilogcond: 'offilog-conditions.js',
    offilogbestprix: 'offilog-best-prix.js'
  };
  var SEAU_PROTEGE = 'donnees-protegees';   // sert encore aux DOCUMENTS privés

  // Fichiers protégés dont l'adresse a été refusée pour de bon. Lu par l'écran
  // pour PRÉVENIR au lieu d'afficher des zéros. Vidé dès qu'un essai réussit.
  V2.protegeEchec = {};
  V2.donneesProtegeesKO = function () { return Object.keys(V2.protegeEchec); };

  function attendre(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // ── Adresse signée d'un fichier protégé ─────────────────────────────────
  // ⚠️ 14/08/2026 — Will : « ya plus aucune données sur jarvis ». Cette fonction
  // ne réessayait RIEN et avalait toute erreur (`.catch(-> null)`). Un seul
  // refus — jeton pas encore renouvelé au réveil de l'app installée, réseau
  // absent une seconde sur l'iPhone, rotation du jeton côté Supabase — et le
  // fichier ne se chargeait jamais, SANS message. L'app s'affichait entière et
  // vide. Depuis le 13/08 ces fichiers portent TOUS les chiffres (officines, CA,
  // pilotage) : un échec silencieux ici, c'est une app sans données.
  //
  // Trois essais, avec renouvellement FORCÉ de la session entre chaque : la
  // cause la plus fréquente est un jeton expiré que le client n'a pas encore
  // rafraîchi. Si les trois échouent, on le NOTE — l'appelant doit le dire.
  function adresseProtegee(cle, essai) {
    essai = essai || 1;
    var c = (V2.sb && V2.sb()) || null;
    if (!c || !c.storage) return Promise.resolve(null);

    function echouer() {
      if (essai >= 3) {
        V2.protegeEchec[cle] = true;
        console.warn('[V2] adresse protégée refusée pour ' + cle + ' après 3 essais');
        return Promise.resolve(null);
      }
      // Renouvellement forcé : sans ça, les 3 essais échouent pour la MÊME
      // raison et la répétition ne sert à rien.
      return rafraichirSession(c)
        .then(function () { return attendre(essai * 400); })
        .then(function () { return adresseProtegee(cle, essai + 1); });
    }

    try {
      return c.storage.from(SEAU_PROTEGE).createSignedUrl(PROTEGES[cle], 3600)
        .then(function (r) {
          var url = (r && r.data && r.data.signedUrl) || null;
          if (!url) return echouer();
          delete V2.protegeEchec[cle];
          return url;
        })
        .catch(echouer);
    } catch (e) { return echouer(); }
  }

  function rafraichirSession(c) {
    try {
      if (!c.auth || !c.auth.refreshSession) return Promise.resolve();
      return Promise.resolve(c.auth.refreshSession()).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }

  // ── Documents privés ────────────────────────────────────────────────────
  // Des pages entières (analyses, notes chiffrées) déposées dans le même seau
  // protégé. Volontairement SÉPARÉ de PROTEGES : ces fichiers ne sont pas des
  // données chargées au démarrage, ils s'ouvrent à la demande dans un onglet.
  // Les mettre dans PROTEGES ferait tenter au chargeur d'exécuter du HTML.
  // Aucun chiffre ne vit dans ce dépôt : seulement le nom du fichier.
  var DOCS_PROTEGES = {
    reforme2027: {
      fichier: 'tranches-marge-grossiste-2027.html',
      titre: 'Réforme 2027'
    },
    // 28/08/2026 — fiches biosimilaires INTERNES (PPHT + net IP + abandon).
    // Elles ne passent jamais par le dépôt public (.gitignore) : seules les
    // versions « pharmacien », sans net IP, y sont. `type: 'pdf'` → on rend
    // le fichier tel quel dans l'onglet, sans passer par le texte.
    biosimSynthese: {
      fichier: 'biosim-poster-synthese-interne.pdf',
      titre: 'Biosimilaires · synthèse (interne)', type: 'pdf'
    },
    biosimDetail: {
      fichier: 'biosim-poster-detail-interne.pdf',
      titre: 'Biosimilaires · toutes présentations (interne)', type: 'pdf'
    },
    // 28/08/2026 — Will : PPHT + net IP aussi sur la fiche remise au pharmacien.
    // Elle porte donc des prix nets → sortie du dépôt public, servie ici.
    biosimSynthesePharma: {
      fichier: 'biosim-poster-synthese-pharmacien.pdf',
      titre: 'Biosimilaires · synthèse (pharmacien)', type: 'pdf'
    },
    biosimDetailPharma: {
      fichier: 'biosim-poster-detail-pharmacien.pdf',
      titre: 'Biosimilaires · toutes présentations (pharmacien)', type: 'pdf'
    },
    // 29/08/2026 — l'Excel complet (3 onglets, prix nets) sort lui aussi du dépôt.
    biosimExcel: {
      fichier: 'base-biosimilaires.xlsx',
      titre: 'Base Biosimilaires · Excel', type: 'fichier'
    }
  };
  V2.docsProteges = DOCS_PROTEGES;

  V2.ouvrirDocProtege = function (cle) {
    var d = DOCS_PROTEGES[cle];
    if (!d) return;
    var c = (V2.sb && V2.sb()) || null;
    if (!c || !c.storage) {
      alert('Connecte-toi pour ouvrir ce document.');
      return;
    }
    // L'onglet est ouvert AVANT l'appel réseau : ouvrir après une promesse
    // fait bloquer le navigateur, qui n'y voit plus un geste de l'utilisateur.
    // 29/08/2026 — un `fichier` (Excel…) ne s'affiche pas : le navigateur le
    // télécharge et l'onglet restait blanc sur « Ouverture… » (mesuré). Pour lui,
    // pas d'onglet : le téléchargement part d'une iframe invisible.
    var onglet = d.type === 'fichier' ? null : window.open('', '_blank');
    if (onglet && onglet.document && onglet.document.body) {
      onglet.document.title = d.titre;
      var att = onglet.document.createElement('p');
      att.textContent = 'Ouverture du document privé…';
      att.setAttribute('style', 'margin:0;font:15px system-ui;color:#414E63;text-align:center;padding-top:40vh');
      onglet.document.body.setAttribute('style', 'margin:0;background:#F4F6FA');
      onglet.document.body.appendChild(att);
    }
    // ⚠️ Supabase Storage sert TOUJOURS un .html en `text/plain` — sécurité de leur
    // côté, pour qu'on ne puisse pas héberger de page exécutable sur leur domaine.
    // Mesuré le 14/08/2026 : l'adresse signée renvoie bien 33 097 octets, mais le
    // navigateur affiche le code source. On récupère donc le texte et on le rend
    // nous-mêmes via un blob : la page s'affiche, et elle n'a jamais transité par
    // le dépôt public.
    c.storage.from(SEAU_PROTEGE).createSignedUrl(d.fichier, 3600)
      .then(function (r) {
        var url = r && r.data && r.data.signedUrl;
        if (!url) throw new Error('adresse refusée');
        // 29/08/2026 — PDF et fichiers : Supabase les sert avec leur vrai type
        // (mesuré : `content-type: application/pdf`). L'onglet va donc DIRECTEMENT
        // sur l'adresse signée — pas de fetch ni de blob, qui échouaient sur
        // certains navigateurs (« les boutons font n'importe quoi », Will, 28/08).
        // Seul le .html garde le détour par le blob (servi en text/plain).
        if (d.type === 'fichier') {
          var cadre = document.createElement('iframe');
          cadre.setAttribute('style', 'display:none');
          cadre.src = url;
          document.body.appendChild(cadre);
          setTimeout(function () { if (cadre.parentNode) cadre.parentNode.removeChild(cadre); }, 120000);
          return null;
        }
        if (d.type === 'pdf') {
          if (onglet) onglet.location.replace(url); else window.location.href = url;
          return null;
        }
        return fetch(url);
      })
      .then(function (rep) {
        if (rep === null) return null;            // PDF / fichier : déjà ouvert
        if (!rep.ok) throw new Error('HTTP ' + rep.status);
        return rep.text();
      })
      .then(function (contenu) {
        if (contenu === null) return;
        var blob = new Blob([contenu], { type: 'text/html;charset=utf-8' });
        var burl = URL.createObjectURL(blob);
        if (onglet) onglet.location.replace(burl); else window.location.href = burl;
        // Laisser le temps à l'onglet de charger avant de libérer la mémoire.
        setTimeout(function () { URL.revokeObjectURL(burl); }, 60000);
      })
      .catch(function () {
        if (onglet) onglet.close();
        alert('Document indisponible. Vérifie que ta session est ouverte.');
      });
  };

  var loaded = {}, pending = {};
  // Corrige le prix NR au tarif officiel PPHT (window.PPHT) directement dans le
  // benchmark : impacte partout (groupements, fiches, catalogue, listes).
  // Abandon de marge Intégral sur un princeps = barème par tranche sur le PPHT :
  // 0,18€ (≤4,33€) · 3,89% (≤468€) · 19,50€ (>468€). Net = PPHT − abandon.
  function abandonBareme(pp) {
    if (pp <= 4.33) return 0.18;
    if (pp <= 468) return Math.round(pp * 0.0389 * 100) / 100;
    return 19.50;
  }
  V2.applyPPHT = function () {
    if (V2._pphtDone) return;
    var P = window.PPHT, NR = window.PPHT_NR || {}, B = window.BENCHMARK;
    if (!P || !B || !B.length) return;
    // Set des princeps (famille pr_*) d'après PROD_STATS : seuls eux ont l'abandon
    // de marge (les génériques/NR gardent net = PPHT). Vide si non chargé → dégrade proprement.
    var PR = {};
    var PS = window.PROD_STATS;
    if (PS && PS.length) { for (var k = 0; k < PS.length; k++) { var r = PS[k]; if (r && r.c && r.f && r.f.indexOf('pr_') === 0) PR[String(r.c)] = 1; } }
    var n = 0, fixedAband = 0;
    for (var i = 0; i < B.length; i++) {
      var b = B[i], c = b && b.cip13 ? String(b.cip13) : '';
      if (!c || !(P[c] > 0)) continue;          // ignore PPHT absent ou ≤ 0 (ex Shingrix=0) → jamais de prix à 0
      var pp = P[c];
      b.prix_ht = pp;                           // tarif grossiste officiel (HT) — corrige les prix_ht=0
      // NR : marge libre PLM -> on aligne le prix IP sur le PPHT et on neutralise
      // l'offre labo (pas de tag OFFRE sur un NR). Remboursable : on garde le prix_ip réel.
      if (NR[c]) { if (!(b.prix_ip > 0 && b.prix_ip < pp)) b.prix_ip = pp; b.offre_ip = 0; }
      // Princeps sans abandon dans les données (net = PPHT, ex prix_ht manquant à l'origine)
      // → on applique le barème pour révéler le vrai net remisé. Les princeps déjà remisés
      // (prix_ip < pp) et les offres Sanofi/UPSA (prix_ip plus bas) sont laissés intacts.
      else if (PR[c] && b.prix_ip > 0 && b.prix_ip >= pp) {
        b.prix_ip = Math.round((pp - abandonBareme(pp)) * 100) / 100;
        fixedAband++;
      }
      // recalcule la remise (évite les % aberrants pré-calculés quand prix_ht était 0)
      b.remise_pct = (b.prix_ht > 0 && b.prix_ip > 0 && b.prix_ip <= b.prix_ht)
        ? Math.round((1 - b.prix_ip / b.prix_ht) * 1000) / 10 : 0;
      n++;
    }
    V2._pphtDone = true;
    try { console.log('[V2] PPHT appliqué à ' + n + ' produits · abandon barème reconstitué sur ' + fixedAband + ' princeps'); } catch (e) {}
  };
  // Témoin de chargement : le nom que CHAQUE fichier doit avoir posé sur `window`
  // une fois lu. Sert à distinguer « le navigateur a fini de télécharger » de
  // « les données sont là » — voir le commentaire de `s.onload`.
  var TEMOIN = {
    bench: 'BENCHMARK',
    establishments: 'ESTABLISHMENTS',
    offilog: 'OFFILOG',
    offilogcond: 'OFFILOG_COND',
    offilogbestprix: 'OFFILOG_BEST_PRIX',
    drakkars: 'DRAKKARS',
    cap3000: 'CAP3000',
    sagitta: 'SAGITTA_SHORTLIST',
    clients: 'CLIENTS',
    wml: 'WML_OFFICINES',
    grplogos: 'GRP_LOGOS',
    catcomplet: 'CATALOGUE_COMPLET'
  };

  // ── Les conditions commerciales reviennent sur le catalogue ──────────────
  // Elles vivent dans un fichier séparé et protégé, mais l'app entière lit
  // `o.prix_offilog` depuis toujours — dans v2-offilog.js comme dans
  // marketing.js (que charge OPSO), une quinzaine d'endroits. Plutôt que de
  // réécrire chacun, on RECOLLE les trois champs sur les objets en mémoire :
  // tout ce qui marchait continue de marcher, sans une ligne de plus ailleurs.
  var _condFaites = false;
  function fusionnerConditionsOffilog() {
    if (_condFaites) return;
    var cat = window.OFFILOG, cond = window.OFFILOG_COND;
    if (!cat || !cond) return;          // l'un des deux manque encore : on repassera
    var n = 0;
    for (var i = 0; i < cat.length; i++) {
      var o = cat[i];
      var v = o && o.ean != null ? cond[String(o.ean)] : null;
      if (!v) continue;
      o.prix_offilog = v[0]; o.ecart = v[1]; o.marge_pct = v[2];
      n++;
    }
    _condFaites = true;
    V2.offilogConditions = n;   // lu par l'écran pour dire la vérité s'il n'a rien
  }

  // Même principe pour les meilleures ventes : le prix B2B revient sur les
  // objets, et v2-offilog.js / v2-mkt.js continuent de lire `b.price`.
  var _prixFaits = false;
  V2.fusionnerPrixBest = fusionnerPrixBest;
  function fusionnerPrixBest() {
    if (_prixFaits) return;
    var best = window.OFFILOG_BEST, prix = window.OFFILOG_BEST_PRIX;
    if (!best || !prix) return;
    var n = 0;
    for (var i = 0; i < best.length; i++) {
      var b = best[i];
      var v = b && b.id != null ? prix[String(b.id)] : null;
      if (v == null) continue;
      b.price = v; n++;
    }
    _prixFaits = true;
    V2.offilogPrixBest = n;
  }

  function bridge() {
    try { if (typeof BENCHMARK !== 'undefined') window.BENCHMARK = BENCHMARK; } catch (e) {}
    try { if (typeof OFFILOG !== 'undefined') window.OFFILOG = OFFILOG; } catch (e) {}
    try { if (typeof OFFILOG_COND !== 'undefined') window.OFFILOG_COND = OFFILOG_COND; } catch (e) {}
    try { if (typeof OFFILOG_BEST_PRIX !== 'undefined') window.OFFILOG_BEST_PRIX = OFFILOG_BEST_PRIX; } catch (e) {}
    try { if (typeof OFFILOG_BEST !== 'undefined') window.OFFILOG_BEST = OFFILOG_BEST; } catch (e) {}
    fusionnerPrixBest();
    fusionnerConditionsOffilog();
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
  // ── Les ventes arrivent en TRANCHES (15/08/2026) ────────────────────────
  // ⚠️ Mesuré sur l'iPhone de Will : un fichier de 13,4 Mo de ventes sur une
  // seule ligne **n'est pas lu jusqu'au bout** par Safari. Le fichier arrive
  // entier, la lecture s'arrête en route, et comme les données n'étaient
  // publiées qu'à la dernière ligne, il ne restait RIEN.
  //
  // `decouper_wml.py` produit donc 9 tranches d'environ 1,5 Mo. Elles se
  // chargent l'une APRÈS l'autre : le pic mémoire vaut une tranche, et le
  // ramasse-miettes respire entre deux.
  //
  // ⚠️ Le nombre de tranches n'est PAS écrit ici. C'est `decouper_wml.py`, le
  // script qui les fabrique, qui le pose dans `window.WML_TRANCHES` — donc il
  // ne peut pas se désaligner. Un nombre recopié à la main, c'est une tranche
  // oubliée un jour, et des ventes manquantes SANS erreur visible : exactement
  // le genre de panne muette qui a coûté deux jours les 13 et 14/08.
  // Ce repli ne sert que si l'en-tête est d'une version antérieure au 15/08.
  var WML_TRANCHES_REPLI = 9;

  function urlsTranches(V) {
    var base = (window.V2_DATA_BASE || '../');
    var n = window.WML_TRANCHES || WML_TRANCHES_REPLI;
    var l = [];
    for (var i = 1; i <= n; i++) {
      l.push(base + 'v2/wml-ventes-' + (i < 10 ? '0' + i : i) + '.js' + V);
    }
    return l;
  }

  V2.loadFiles = function (keys) {
    // Le catalogue Offilog et ses conditions commerciales ne se demandent
    // jamais l'un sans l'autre : sinon un écran afficherait un catalogue
    // complet avec des prix d'achat vides, sans que personne comprenne.
    if (keys && keys.indexOf('offilog') >= 0 && keys.indexOf('offilogcond') < 0) {
      keys = keys.concat(['offilogcond']);
    }
    // chemins relatifs au dossier parent crm/ (les data files sont dans crm/)
    // Jeton PROPRE aux fichiers de données, distinct du ?v= global.
    // ⚠️ Le bumper quand les DONNÉES changent — et elles viennent de changer :
    // wml-officines-data.js est passé de 27 à 16,6 Mo le 13/08/2026. Sans ce
    // bump, les téléphones qui ont déjà l'ancien fichier en cache continueraient
    // de le servir, et le lecteur compacté ne trouverait pas ses dictionnaires.
    // Pas besoin de le suivre à chaque déploiement en revanche : quand `VER` de
    // sw.js change, l'activation du service worker efface tous les caches.
    var V = '?v=20260903b';
    var promises = keys.map(function (k) {
      var src = (window.V2_DATA_BASE || '../') + DATA_FILES[k];
      if (loaded[src]) return Promise.resolve();
      if (pending[src]) return pending[src];
      var p = new Promise(function (resolve) {
        // Tous les fichiers de données vivent de nouveau dans le dépôt et
        // passent par le service worker : une seule adresse, versionnée, mise
        // en cache et servie depuis l'appareil aux ouvertures suivantes.
        // `PROTEGES` est vide depuis le 15/08 — le détour par l'adresse signée
        // n'existe plus que pour les DOCUMENTS privés (V2.ouvrirDocProtege).
        if (!PROTEGES[k]) { poserSuite([src + V], resolve); return; }

        adresseProtegee(k).then(function (url) {
          if (!url) {
            // adresseProtegee a déjà réessayé 3 fois et noté l'échec dans
            // V2.protegeEchec — l'écran doit le DIRE, pas afficher des zéros.
            delete pending[src];
            resolve();
            return;
          }
          poser(url, resolve);
        });
      });
      pending[src] = p;
      return p;

      // Enchaîne les adresses UNE PAR UNE, jamais en parallèle : c'est tout
      // l'intérêt du découpage. Deux tranches lues en même temps, et le pic
      // mémoire double — on retomberait sur la panne qu'on vient de corriger.
      // Le contrôle « la donnée est-elle là ? » n'a lieu qu'à la fin.
      function poserSuite(urls, resolve) {
        var i = 0, tranchesFaites = false;
        (function suivant() {
          if (i >= urls.length) {
            // Les ventes arrivent APRÈS l'en-tête, qui vient de nous dire
            // combien de tranches l'attendre. On les enchaîne à la suite.
            if (k === 'wml' && !tranchesFaites) {
              tranchesFaites = true;
              urls = urls.concat(urlsTranches(V));
              suivant();
              return;
            }
            finir();
            return;
          }
          var url = urls[i++];
          var s = document.createElement('script');
          s.src = url; s.async = false;
          s.onload = suivant;
          s.onerror = function () {
            console.warn('[V2] échec ' + url);
            V2.protegeEchec[k] = true;
            delete pending[src];
            resolve();
          };
          document.head.appendChild(s);
        })();

        function finir() {
          bridge();   // recopie les `const` sur window (voir poser())
          var manque = TEMOIN[k] && typeof window[TEMOIN[k]] === 'undefined';
          // Pour les ventes, la présence du tableau ne suffit pas : il est créé
          // VIDE par le premier fichier et rempli par les tranches. Un tableau
          // vide ici veut dire qu'aucune tranche n'a été lue jusqu'au bout.
          if (!manque && k === 'wml') {
            manque = !(window.WML_SALES && window.WML_SALES.length);
          }
          if (manque) {
            console.warn('[V2] ' + src + ' : données absentes après ' + urls.length + ' fichier(s)');
            V2.protegeEchec[k] = true;
            delete pending[src];
            resolve();
            return;
          }
          loaded[src] = true;
          resolve();
        }
      }

      // `secours` : que faire si CETTE adresse ne donne rien. Sert au rangement
      // local — une entrée de cache abîmée ne doit pas condamner le chargement,
      // on repart alors sur le téléchargement.
      function poser(url, resolve, secours) {
        var s = document.createElement('script');
        s.src = url; s.async = false;
        s.onload = function () {
          // ⚠️ 14/08/2026 — « 22 officines actives » sur l'iPhone de Will.
          // `onload` dit seulement que le navigateur a fini de lire la réponse,
          // PAS qu'elle contenait les données. Une réponse vide, tronquée, ou un
          // message d'erreur servi en HTTP 200 déclenche `onload` exactement
          // comme un fichier valide. On marquait alors le fichier « chargé »,
          // `loadData()` ne trouvait pas `WML_OFFICINES`, tombait sur les
          // vieilles tables Supabase — et l'app affichait ces données périmées
          // comme si c'était la vérité, sans un mot.
          // On vérifie donc que la donnée attendue est VRAIMENT là.
          //
          // ⚠️ ET ON APPELLE `bridge()` D'ABORD. La plupart de ces fichiers
          // déclarent `const BENCHMARK = …` / `const SAGITTA_SHORTLIST = …` :
          // une liaison lexicale, qui ne devient PAS une propriété de `window`.
          // C'est `bridge()` qui l'y recopie. Vérifier avant lui, c'est déclarer
          // en échec des fichiers parfaitement chargés — constaté le 14/08/2026
          // sur `sagitta`, qui se retéléchargeait à chaque ouverture.
          bridge();
          if (TEMOIN[k] && typeof window[TEMOIN[k]] === 'undefined') {
            console.warn('[V2] ' + src + ' chargé mais ' + TEMOIN[k] + ' absent — réponse vide ou tronquée');
            if (secours) { secours(); return; }
            V2.protegeEchec[k] = true;   // tout fichier de donnees, plus seulement les proteges
            delete pending[src];
            resolve();
            return;
          }
          loaded[src] = true; resolve();   // bridge() a déjà été appelé ci-dessus
        };
        s.onerror = function () {
          if (secours) { console.warn('[V2] rangement local illisible — on retélécharge'); secours(); return; }
          // Adresse obtenue mais téléchargement échoué (réseau coupé en cours,
          // adresse signée périmée) : pour un fichier protégé, c'est le même
          // résultat qu'un refus — l'écran doit le dire.
          V2.protegeEchec[k] = true;   // tout fichier de donnees, plus seulement les proteges
          // On résout SANS marquer le fichier comme chargé : c'est à l'appelant
          // de constater l'échec (V2.dataLoaded reste faux).
          // ⚠️ Et on RETIRE la promesse en attente. Sans ça, une nouvelle
          // tentative recevait cet échec déjà résolu — instantanément — au lieu
          // de relancer un vrai téléchargement. C'est ce qui transformait une
          // simple coupure réseau en boucle infinie côté écran d'accueil.
          console.warn('[V2] échec ' + src);
          delete pending[src];
          resolve();
        };
        document.head.appendChild(s);
      }
    });
    return Promise.all(promises).then(bridge);
  };
  V2.dataLoaded = function (key) {
    // ⚠️ La base doit être la MÊME que celle utilisée pour charger le fichier.
    // Elle était écrite en dur ('../'), or l'app OPSO charge depuis
    // '../../crm/' : la clé cherchée ne correspondait à rien, `dataLoaded`
    // répondait toujours faux, et OPSO affichait « Données non chargées »
    // alors que les 691 officines étaient bien en mémoire.
    return loaded[(window.V2_DATA_BASE || '../') + DATA_FILES[key]] === true;
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

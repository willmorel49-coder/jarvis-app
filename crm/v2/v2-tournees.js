/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · TOURNÉES (V2.pages.tournees) — 10/11/2026
   Écran séparé de La carte, version « Le classement des tournées » choisie par Will : les établissements en haut (OPS actif, les six
   autres « à recevoir », aucun chiffre), puis les tournées classées par rentabilité par mois. Une ligne cliquée s'ouvre : petite carte,
   prospects à voir en priorité (triés par détour), clientes à faire grossir (gain, raison).

   - DONNÉES : PAS dans le dépôt (public). Fichier du seau privé `donnees-protegees`, à sa racine, nommé `tournees-etablissements.js`
     (clé « tournees » de v2-boot.js, variable globale TOURNEES_ECRAN), fabriqué hors dépôt. Il ne porte que les valeurs BRUTES :
     toutes les formules ci-dessous (médiane, raison, gain, potentiel, tri des prospects, classement) sont calculées ICI et testées
     (tests/tournees.test.mjs, avec des données fictives).
   - QUI VOIT : tout compte connecté sauf le rôle `opso` (décision de Will, 10/11/2026 : « tout le monde voit tout » sur CET écran,
     exception à la règle « un commercial ne voit pas les ventes des autres » ; V2.voitVentesDe n'est donc PAS appliqué ici). La base
     refuse déjà le fichier au rôle opso (jarvis_peut_lire_protege) ; l'écran le dit aussi.
   - Noms des prospects : base PHARMA_FR (V2.ensurePharmaFr, un seul téléchargement), à partir du CIP.
   - Fond de carte : V2.fondCarte (jamais CARTO, qui exige une clé).
   - Fichier absent ou illisible : message clair, jamais une page vide ni un faux zéro.
   Formules : voir les commentaires de C.analyser.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};
  var C = {};   // calcul pur (testé : tests/tournees.test.mjs)
  var NB = ' ';

  // ── Calcul pur ────────────────────────────────────────────────
  function r2(x) { return Number(x.toFixed(2)); }   // arrondi sur la valeur binaire exacte, comme round() de Python (Math.round(x*100) diffère d'un centime sur les .xx5)
  C.r2 = r2;
  C.mediane = function (a) {
    if (!a || !a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length, m = n >> 1;
    return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  // Le fichier est-il utilisable ? Rend '' si oui, sinon le motif (jamais une exception).
  C.valider = function (d) {
    if (!d || typeof d !== 'object') return 'fichier absent';
    if (!d.tournees || typeof d.tournees !== 'object' || !Object.keys(d.tournees).length) return 'aucune tournée dans le fichier';
    var ok = Object.keys(d.tournees).every(function (k) {
      var t = d.tournees[k];
      return t && Array.isArray(t.arrets) && Array.isArray(t.trace) && Array.isArray(t.prospects);
    });
    if (!ok) return 'fichier illisible';
    if (!Array.isArray(d.etablissements)) return 'liste des établissements absente';
    return '';
  };
  // Établissements : « actif » = le fichier dit qu'il a des tournées ; sinon « à recevoir » (aucun chiffre).
  C.etablissements = function (d) {
    return ((d && d.etablissements) || []).map(function (e) { return { s: e.s, nom: e.nom, ville: e.ville, actif: e.tournees === true }; });
  };
  // Prospects : [cip, lat, lng, km_route, apres, avant, detour, fiable] -> objets, position fiable d'abord, puis détour croissant, puis km sur la route.
  C.prospects = function (liste) {
    return (liste || []).map(function (p) { return { cip: String(p[0]), lat: p[1], lng: p[2], km_route: p[3], apres: p[4], avant: p[5], detour: p[6], fiable: !!p[7] }; })
      .sort(function (a, b) { return (a.fiable === b.fiable ? 0 : (a.fiable ? -1 : 1)) || (a.detour - b.detour) || (a.km_route - b.km_route); });
  };
  // Prospects à 2 km de détour ou moins : position fiable ET détour <= 2 (compte complet).
  C.nb2km = function (pros) { return (pros || []).filter(function (p) { return p.fiable && p.detour <= 2; }).length; };
  // Raison pour laquelle une cliente est « à faire grossir » (la première qui s'applique), ou null.
  C.raison = function (rm, mm, jm, mj, med) {
    if (rm < 0) return 'En perte';
    if (jm > med.jours_mois && mj < med.marge_jour) return 'Commande trop souvent pour sa marge';
    if (mm < med.marge_mois) return 'Marge sous la médiane de sa tournée';
    return null;
  };
  // Analyse d'UNE tournée (valeurs brutes -> chiffres affichés).
  //  - rentabilité par mois de la cliente = r.rm (marge moins livraisons, divisée par les mois livrés) ; de la tournée = somme des clientes ;
  //  - médianes calculées sur les clientes de la tournée qui ont des ventes (r non nul) : rentabilité mensuelle, marge mensuelle (m / mo),
  //    jours de commande par mois (jm), marge par jour de commande (mj) ;
  //  - gain = max(0, médiane des rentabilités mensuelles − rentabilité mensuelle de la cliente), retenu seulement si elle a une raison ET gain > 0 ;
  //  - potentiel = somme des gains retenus ; clientes en perte = rentabilité mensuelle < 0.
  C.analyser = function (t) {
    var arrets = (t && t.arrets) || [], R = arrets.filter(function (a) { return a.r; });
    var med = {
      renta: C.mediane(R.map(function (a) { return a.r.rm; })),
      marge_mois: C.mediane(R.map(function (a) { return a.r.m / a.r.mo; })),
      jours_mois: C.mediane(R.map(function (a) { return a.r.jm; })),
      marge_jour: C.mediane(R.map(function (a) { return a.r.mj; }))
    };
    var grossir = [], nbPerte = 0;
    var arr = arrets.map(function (a) {
      var o = { n: a.n, id: a.id, nom: a.nom, ville: a.ville, lat: a.lat, lng: a.lng, com: a.com, renta_mois: null, statut: 'none' };
      if (a.r) {
        var rm = a.r.rm, mm = a.r.m / a.r.mo;
        o.renta_mois = rm;
        o.statut = rm < 0 ? 'perte' : (rm < med.renta ? 'sous' : 'bon');
        if (rm < 0) nbPerte++;
        var gain = Math.max(0, med.renta - rm), raison = C.raison(rm, mm, a.r.jm, a.r.mj, med);
        o.gain = r2(gain); o.raison = raison;
        if (raison && gain > 0) grossir.push({ n: a.n, id: a.id, nom: a.nom, ville: a.ville, lat: a.lat, lng: a.lng, raison: raison, renta_mois: rm, gain: r2(gain) });
      }
      return o;
    });
    grossir.sort(function (a, b) { return b.gain - a.gain; });
    var pros = C.prospects(t && t.prospects);
    return {
      code: t.code, nom: t.nom, jours: t.jours || [], jours_statut: t.jours_statut, transporteur: t.transporteur, nb_arrets: t.nb_arrets,
      km_total: r2((t.km_aller || 0) + (t.km_retour || 0)), marge_jour: t.marge_jour, jours_commande: t.jours_commande,
      rentabilite: t.rentabilite,
      rentabilite_mois: r2(R.reduce(function (s, a) { return s + a.r.rm; }, 0)),
      nb_perte: nbPerte, nb_avec_ventes: R.length, med: med, arrets: arr,
      grossir: grossir, potentiel: r2(grossir.reduce(function (s, g) { return s + g.gain; }, 0)), nb_grossir: grossir.length,
      prospects: pros, nb_prospects: pros.length, nb_prospects_2km: C.nb2km(pros), trace: t.trace
    };
  };
  C.analyserTout = function (d) {
    var out = {};
    Object.keys((d && d.tournees) || {}).forEach(function (k) { out[k] = C.analyser(d.tournees[k]); });
    return out;
  };
  // Classement : tri sur une colonne (sens -1 = du plus grand au plus petit), égalités départagées par la rentabilité par mois.
  C.classer = function (A, cle, sens) {
    return Object.keys(A).sort(function (a, b) { return (sens * (A[a][cle] - A[b][cle])) || (A[b].rentabilite_mois - A[a].rentabilite_mois); });
  };
  C.bilan = function (A) {
    var k = Object.keys(A);
    return { n: k.length, rentabilite_mois: r2(k.reduce(function (s, c) { return s + A[c].rentabilite_mois; }, 0)), potentiel: r2(k.reduce(function (s, c) { return s + A[c].potentiel; }, 0)) };
  };
  // Jours de livraison : texte court (trois lettres) ; vide = « à préciser ».
  C.jours = function (t) {
    var j = (t && t.jours) || [];
    return j.length ? j.map(function (x) { return String(x).slice(0, 3); }).join(' ') : '';
  };
  // Position d'un prospect sur la route.
  C.position = function (p) {
    var a = p.apres, b = p.avant;
    if (!a && b) return 'entre le dépôt et l’arrêt n°' + NB + b;
    if (a && b == null) return 'après l’arrêt n°' + NB + a + ', avant le retour au dépôt';
    if (!a && b == null) return 'sur la route';
    return 'entre l’arrêt n°' + NB + a + ' et n°' + NB + b;
  };
  // Index PHARMA_FR : cip -> { nom, ville } (colonnes 13 = CIP, 6 = nom, 7 = ville).
  C.indexPF = function (pf) {
    var o = {};
    ((pf && pf.p) || []).forEach(function (p) { o[String(p[13])] = { nom: p[6], ville: p[7] }; });
    return o;
  };
  // Formats
  C.nf = function (x, d) {
    if (x == null || isNaN(x)) return '—';
    var s = Math.abs(Number(x)).toFixed(d || 0).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    var neg = Number(x) < 0 && Number(Math.abs(x).toFixed(d || 0)) !== 0;
    return (neg ? '−' : '') + s.join(',');
  };
  C.eur = function (x, d) { return x == null ? '—' : C.nf(x, d || 0) + NB + '€'; };
  C.eurSigne = function (x, d) { return x == null ? '—' : (x > 0 ? '+' : '') + C.eur(x, d || 0); };
  C.km = function (x, d) { return C.nf(x, d == null ? 1 : d) + NB + 'km'; };
  C.detour = function (p) { return p.detour < 0.05 ? 'sur la route' : 'détour ' + C.nf(p.detour, 1) + NB + 'km'; };
  C.joli = function (s) {   // NOM EN MAJUSCULES -> Nom en minuscules
    return String(s || '').toLowerCase().replace(/(^|[\s\-'’(])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\b(De|Du|Des|La|Le|Les|Et|Sur|En|Aux|Au|Sous|Pres)\b/g, function (m, w) { return w.toLowerCase(); }).replace(/^./, function (c) { return c.toUpperCase(); })
      .replace(/\b(L|D) (?=[A-ZÀ-Ý])/g, function (m, x) { return x.toLowerCase() + '’'; }).replace(/\bSt\b/g, 'Saint').replace(/\bSte\b/g, 'Sainte');
  };
  C.esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };

  V2.tournees = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  if (!glob.document) return;   // fenêtre des tests : pas d'écran

  // ── Écran ────────────────────────────────────────────────────
  var esc = C.esc, joli = C.joli, eur = C.eur, eurSigne = C.eurSigne;
  var COUL = { perte: '#E0556E', sous: '#C7791A', bon: '#1E9E6A', none: '#8A91A4' };
  var COLS = [['rentabilite_mois', 'Rentabilité par mois'], ['marge_jour', 'Marge par jour de commande'], ['nb_perte', 'Clientes en perte'], ['nb_prospects_2km', 'Prospects sur la route'], ['potentiel', 'Potentiel par mois']];
  var S = { d: null, A: null, erreur: '', charge: false, etab: 'OPS', open: null, sortK: 'rentabilite_mois', sortDir: -1, map: null, cur: null, pf: null, root: null };

  function interdit() {
    var b = glob.V2_BRAND, u = V2.user;
    return !!((b && b.opso) || (u && (u.opsoOnly || u.role === 'opso')));
  }
  function charger() {
    if (glob.TOURNEES_ECRAN) return Promise.resolve(glob.TOURNEES_ECRAN);
    if (!V2.loadFiles) return Promise.reject(new Error('chargeur de fichiers protégés absent'));
    return Promise.resolve(V2.loadFiles(['tournees'])).then(function () {
      if (!glob.TOURNEES_ECRAN) throw new Error('fichier des tournées non reçu');
      return glob.TOURNEES_ECRAN;
    });
  }

  function ensureLeaflet(cb) {
    if (glob.L) { cb(); return; }
    var V = 'vendor/leaflet/', l = document.createElement('link'); l.rel = 'stylesheet'; l.href = V + 'leaflet.css'; document.head.appendChild(l);
    var s = document.createElement('script'); s.src = V + 'leaflet.js'; s.onload = function () { cb(); }; s.onerror = function () { cb('err'); }; document.head.appendChild(s);
  }

  function css() {
    if (document.getElementById('trn-css')) return;
    var s = document.createElement('style'); s.id = 'trn-css';
    s.textContent = [
      '.trn-page{max-width:1240px;margin:0 auto;padding:18px 24px 96px;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.trn-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:12px}',
      '.trn-hd h1{font-size:28px;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin:0}',
      '.trn-hd p{color:var(--muted);font-size:14px;margin:4px 0 0}',
      '.trn-bil{display:flex;gap:28px}',
      '.trn-bil div{text-align:right}.trn-bil b{display:block;font-size:22px;letter-spacing:-.02em}.trn-bil span{font-size:12px;color:var(--muted)}',
      '.trn-note{display:flex;gap:8px;align-items:flex-start;margin:0 0 14px;padding:10px 14px;border-radius:var(--r-md);background:#FBF0DF;color:var(--c-amber-txt);font-size:13px;font-weight:500;line-height:1.4}',
      '.trn-etabs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:6px 8px 14px;margin:-6px -8px -14px}',
      '.trn-etabs::-webkit-scrollbar{display:none}',
      '.trn-pill{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:var(--tap-min);padding:0 14px;border-radius:var(--r-pill);background:var(--card);border:1px solid var(--line-strong);font-weight:600;font-size:13px;white-space:nowrap;color:var(--ip-ink);cursor:pointer;font-family:inherit}',
      '.trn-pill.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff;box-shadow:var(--sh-blue)}',
      '.trn-pill.off{background:var(--surf-sunken);color:var(--muted);border-style:dashed}',
      '.trn-pill.sel:not(.on){border-style:solid;border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.trn-pill .soft{font-weight:500;font-size:12px;color:var(--muted)}',
      '.trn-pill.on .soft{color:#fff}',
      '.trn-attente{max-width:560px;margin:56px auto;padding:32px;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2)}',
      '.trn-attente-t{font-size:22px;font-weight:700;margin-bottom:8px}',
      '.trn-attente p{color:var(--muted);margin:12px 0 0}',
      '.trn-tbl{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);overflow:hidden;margin-top:12px}',
      '.trn-row{display:grid;grid-template-columns:44px minmax(220px,2.2fr) 1.5fr 1fr .8fr .9fr 1fr;align-items:center;gap:12px;padding:0 20px;width:100%;text-align:left;border:0;background:none;font:inherit;color:inherit;cursor:pointer}',
      '.trn-th{min-height:40px;font-size:12px;font-weight:700;color:var(--muted);background:var(--card-2);border-bottom:1px solid var(--line);text-transform:uppercase;letter-spacing:.04em;cursor:default}',
      '.trn-th button{font:inherit;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);text-align:left;min-height:40px;border:0;background:none;cursor:pointer}',
      '.trn-th button.s{color:var(--ip-blue)}',
      '.trn-r{border-bottom:1px solid var(--line-2)}',
      '.trn-r>button.trn-row{min-height:52px}',
      '.trn-r:hover>button.trn-row{background:#F7F9FF}',
      '.trn-r.open>button.trn-row{background:#EEF3FF}',
      '.trn-rk{font-weight:700;color:var(--muted)}',
      '.trn-nm b{display:block;font-size:14px}.trn-nm span{font-size:12px;color:var(--muted)}',
      '.trn-barre{display:flex;align-items:center;gap:8px;font-weight:700}',
      '.trn-barre i{display:block;height:8px;border-radius:4px;background:linear-gradient(90deg,#7BA4F5,var(--ip-blue));min-width:3px}',
      '.trn-c{font-weight:600}',
      '.trn-neg{color:var(--c-rose-txt)}',
      '.trn-pot{color:var(--ip-blue);font-weight:700}',
      '.trn-det{display:none;padding:16px 20px 20px;background:linear-gradient(180deg,#F4F7FD,var(--paper));border-top:1px solid var(--line)}',
      '.trn-r.open .trn-det{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:16px}',
      '.trn-det .trn-mp{height:300px;border-radius:var(--r-md);overflow:hidden;border:1px solid var(--line-strong)}',
      '.trn-det h3{font-size:13px;font-weight:700;margin:0 0 8px}',
      '.trn-det h3 .trn-mu{font-weight:500;color:var(--muted)}',
      '.trn-li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--r-sm);background:var(--card);border:1px solid var(--line);margin-bottom:5px;font-size:13px;min-height:44px}',
      '.trn-li div{min-width:0}.trn-li b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.trn-li span{font-size:12px;color:var(--muted)}',
      '.trn-li em{font-style:normal;font-weight:700;color:var(--ip-blue);white-space:nowrap}',
      '.trn-det .trn-col{min-width:0;max-height:300px;overflow-y:auto}',
      '.trn-vide{color:var(--muted);font-size:13px}',
      '.trn-m{display:none}',
      '.trn-ic{background:none;border:0}',
      '.trn-pt{width:28px;height:28px;border-radius:50%;border:2px solid #fff;color:#fff;font:700 11px/24px var(--font);text-align:center;box-shadow:0 2px 6px rgba(16,19,28,.3)}',
      '.trn-lo{width:24px;height:24px;margin:1px;background:#fff;border:2px solid var(--ip-blue);transform:rotate(45deg);border-radius:4px;box-shadow:0 2px 6px rgba(0,52,160,.35);display:flex;align-items:center;justify-content:center}',
      '.trn-lo span{transform:rotate(-45deg);font:700 11px/1 var(--font);color:var(--ip-blue)}',
      '.trn-err{max-width:560px;margin:56px auto;padding:28px;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2)}',
      '.trn-err b{display:block;font-size:20px;margin-bottom:8px}.trn-err p{color:var(--muted);margin:0 0 16px}',
      '@media (max-width:900px){',
        '.trn-page{padding:14px 16px 96px}',
        '.trn-hd h1{font-size:23px}.trn-bil{gap:16px}.trn-bil b{font-size:18px}.trn-bil div{text-align:left}',
        '.trn-row{grid-template-columns:34px 1fr auto;gap:4px 10px;padding:8px 14px}',
        '.trn-th{display:none}',
        '.trn-row .trn-nm{grid-column:2}.trn-row .trn-rk{grid-row:span 2;align-self:start;padding-top:6px}',
        '.trn-row .trn-c1{grid-column:3;grid-row:1}',
        '.trn-row .trn-c2,.trn-row .trn-c3,.trn-row .trn-c4,.trn-row .trn-c5{display:none}',
        '.trn-m{display:flex;grid-column:2/4;gap:14px;font-size:12px;color:var(--ip-ink-2);flex-wrap:wrap}',
        '.trn-r.open .trn-det{grid-template-columns:1fr;padding:12px 14px}',
        '.trn-det .trn-mp{height:240px}.trn-det .trn-col{max-height:none}',
      '}',
      '@media (max-width:700px){.trn-note{font-size:13px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function nomPF(cip) {
    if (!S.pf && glob.PHARMA_FR) S.pf = C.indexPF(glob.PHARMA_FR);
    var o = S.pf && S.pf[cip];
    return o ? { nom: joli(o.nom), ville: joli(o.ville) } : { nom: 'Pharmacie (code ' + cip + ')', ville: '' };
  }

  function dessinerEtabs() {
    var el = document.getElementById('trn-etabs'); if (!el) return;
    el.innerHTML = C.etablissements(S.d).map(function (e) {
      return '<button type="button" class="trn-pill ' + (e.actif ? 'on' : 'off') + (S.etab === e.s ? ' sel' : '') + '" data-s="' + esc(e.s) + '" aria-pressed="' + (S.etab === e.s) + '" title="' + esc(e.nom) + ' · ' + esc(e.ville) + '"><b>' + esc(e.s) + '</b>' +
        (e.actif ? '' : '<span class="soft">à recevoir</span>') + '</button>';
    }).join('');
  }
  function etabCourant() { return C.etablissements(S.d).filter(function (e) { return e.s === S.etab; })[0]; }

  function noteJours() {
    var ts = Object.keys(S.A).map(function (k) { return S.A[k]; });
    var sans = ts.filter(function (t) { return !t.jours.length; }).length;
    return 'Jours de livraison provisoires (planning de février), à confirmer.' + (sans ? ' ' + sans + (sans > 1 ? ' tournées sans jour connu : jours à préciser.' : ' tournée sans jour connu : jours à préciser.') : '');
  }

  function dessiner() {
    var root = S.root; if (!root) return;
    var e = etabCourant(), b = C.bilan(S.A);
    var actif = !!(e && e.actif);
    var h = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
    h += '<div class="trn-page" id="trn-page"><div class="trn-hd"><div><h1>Quelle tournée travailler en premier&nbsp;?</h1>' +
      '<p>' + (e ? esc(e.nom) + ' · ' : '') + (actif ? b.n + ' tournées classées. Cliquez une ligne pour voir la carte, les prospects et les clientes à faire grossir.' : 'Tournées à recevoir.') + '</p></div>' +
      (actif ? '<div class="trn-bil"><div><b>' + eur(b.rentabilite_mois) + '</b><span>rentabilité par mois, ' + b.n + ' tournées</span></div><div><b>' + eurSigne(b.potentiel) + '</b><span>potentiel par mois</span></div></div>' : '') + '</div>';
    if (actif) h += '<div class="trn-note" role="note"><span>' + esc(noteJours()) + (S.d.periode ? ' Chiffres : ' + esc(S.d.periode) + ', une livraison comptée ' + eur(S.d.cout_livraison) + '.' : '') + '</span></div>';
    h += '<div class="trn-etabs" id="trn-etabs"></div><div id="trn-corps"></div></div>';
    root.innerHTML = h;
    dessinerEtabs();
    var corps = document.getElementById('trn-corps');
    if (!actif) {
      corps.innerHTML = e ? '<div class="trn-attente"><div class="trn-attente-t">Tournées à recevoir</div><div><b>' + esc(e.nom) + '</b> · ' + esc(e.ville) +
        '</div><p>Les tournées de cet établissement n’ont pas encore été transmises. Aucun chiffre n’est affiché tant que le fichier n’est pas reçu.</p></div>' : '';
      return;
    }
    corps.innerHTML = '<div class="trn-tbl"><div class="trn-row trn-th" id="trn-th"></div><div id="trn-rows"></div></div>';
    lignes();
  }

  function lignes() {
    var th = document.getElementById('trn-th'), rows = document.getElementById('trn-rows'); if (!th || !rows) return;
    var A = S.A;
    th.innerHTML = '<span>#</span><span>Tournée</span>' + COLS.map(function (c) {
      return '<button type="button" class="' + (S.sortK === c[0] ? 's' : '') + '" data-k="' + c[0] + '">' + c[1] + (S.sortK === c[0] ? (S.sortDir < 0 ? ' ↓' : ' ↑') : '') + '</button>';
    }).join('');
    var ord = C.classer(A, S.sortK, S.sortDir);
    var max = Math.max.apply(null, Object.keys(A).map(function (c) { return A[c].rentabilite_mois; }));
    rows.innerHTML = ord.map(function (c, i) {
      var t = A[c], j = C.jours(t);
      return '<div class="trn-r' + (c === S.open ? ' open' : '') + '" id="trn-r-' + esc(c) + '"><button type="button" class="trn-row" data-c="' + esc(c) + '" aria-expanded="' + (c === S.open) + '">' +
        '<span class="trn-rk">' + (i + 1) + '</span>' +
        '<span class="trn-nm"><b>' + esc(c) + ' · ' + esc(t.nom) + '</b><span>' + t.nb_arrets + (t.nb_arrets > 1 ? ' arrêts' : ' arrêt') + ' · ' + C.km(t.km_total, 0) + ' · ' + (j ? esc(j) : 'jours à préciser') + '</span></span>' +
        '<span class="trn-barre trn-c1"><span>' + eur(t.rentabilite_mois) + '</span><i style="width:' + Math.max(3, Math.round(Math.max(0, t.rentabilite_mois) / (max > 0 ? max : 1) * 90)) + 'px"></i></span>' +
        '<span class="trn-c trn-c2">' + eur(t.marge_jour, 2) + '</span><span class="trn-c trn-c3 ' + (t.nb_perte ? 'trn-neg' : '') + '">' + t.nb_perte + '</span><span class="trn-c trn-c4">' + t.nb_prospects_2km + '</span><span class="trn-pot trn-c5">' + eurSigne(t.potentiel) + '</span>' +
        '<span class="trn-m"><span>' + eur(t.marge_jour, 2) + ' par jour</span><span>' + t.nb_perte + ' en perte</span><span>' + t.nb_prospects_2km + ' prospects</span><span class="trn-pot">' + eurSigne(t.potentiel) + '</span></span></button>' +
        (c === S.open ? '<div class="trn-det" id="trn-det"></div>' : '') + '</div>';
    }).join('');
    if (S.open) detail(S.open);
  }

  function detail(c) {
    var t = S.A[c], d = document.getElementById('trn-det'); if (!t || !d) return;
    var pr = t.prospects.slice(0, 6), gr = t.grossir.slice(0, 6);
    d.innerHTML = '<div><div class="trn-mp" id="trn-mp"></div></div>' +
      '<div class="trn-col"><h3>Prospects à voir en priorité <span class="trn-mu">· ' + t.nb_prospects_2km + ' à 2 km ou moins</span></h3>' +
      (pr.length ? pr.map(function (p, i) { var n = nomPF(p.cip);
        return '<div class="trn-li"><div><b>' + String.fromCharCode(65 + i) + ' · ' + esc(n.nom) + '</b><span>' + (n.ville ? esc(n.ville) + ' · ' : '') + esc(C.position(p)) + '</span></div><em>' + esc(C.detour(p).replace('détour ', '+')) + '</em></div>'; }).join('')
        : '<div class="trn-vide">Aucun prospect sur cette route.</div>') + '</div>' +
      '<div class="trn-col"><h3>Clientes à faire grossir <span class="trn-mu">· potentiel ' + eurSigne(t.potentiel) + ' par mois</span></h3>' +
      (gr.length ? gr.map(function (g) {
        return '<div class="trn-li"><div><b>' + g.n + ' · ' + esc(joli(g.nom)) + '</b><span>' + esc(g.raison) + ' · ' + eur(g.renta_mois) + '/mois</span></div><em>' + eurSigne(g.gain) + '</em></div>'; }).join('')
        : '<div class="trn-vide">Aucune cliente sous la médiane.</div>') + '</div>';
    carte(c, pr);
  }

  function carte(c, pr) {
    if (S.map) { try { S.map.remove(); } catch (e) {} S.map = null; S.cur = null; }
    var el = document.getElementById('trn-mp'); if (!el) return;
    ensureLeaflet(function (err) {
      var el2 = document.getElementById('trn-mp');
      if (err || !glob.L || !el2 || S.open !== c) { if (el2 && (err || !glob.L)) el2.innerHTML = '<div class="trn-vide" style="padding:16px">Carte indisponible.</div>'; return; }
      var L = glob.L, t = S.A[c], D = S.d.depot;
      var m = L.map(el2, { zoomControl: true, attributionControl: true, scrollWheelZoom: true, zoomSnap: 0.25 });
      try { m.attributionControl.setPrefix(false); } catch (e) {}
      if (V2.fondCarte) V2.fondCarte(m);
      m.setView([47.3, -1.75], 8);
      var g = L.layerGroup().addTo(m);
      var line = L.polyline(t.trace, { color: '#0050E6', weight: 4, opacity: 1 }).addTo(g);
      if (D && D.lat != null) L.circleMarker([D.lat, D.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#10131C', fillOpacity: 1 }).bindTooltip('Dépôt · ' + esc(D.nom), { direction: 'top' }).addTo(g);
      t.arrets.forEach(function (a) {
        var ic = L.divIcon({ className: 'trn-ic', iconSize: [28, 28], iconAnchor: [14, 14], html: '<div class="trn-pt" style="background:' + COUL[a.statut] + '">' + a.n + '</div>' });
        L.marker([a.lat, a.lng], { icon: ic, zIndexOffset: 100 }).addTo(g)
          .bindTooltip('<b>' + a.n + ' · ' + esc(joli(a.nom)) + '</b><br>' + esc(joli(a.ville)) + (a.renta_mois != null ? '<br>' + eur(a.renta_mois) + ' par mois' : '<br>Sans ventes'), { direction: 'top', offset: [0, -10] });
      });
      pr.forEach(function (p, i) {
        var l = String.fromCharCode(65 + i), n = nomPF(p.cip);
        var ic = L.divIcon({ className: 'trn-ic', iconSize: [26, 26], iconAnchor: [13, 13], html: '<div class="trn-lo"><span>' + l + '</span></div>' });
        L.marker([p.lat, p.lng], { icon: ic, zIndexOffset: 400 }).addTo(g)
          .bindTooltip('<b>' + l + ' · ' + esc(n.nom) + '</b><br>' + esc(n.ville) + '<br>' + esc(C.detour(p)), { direction: 'top', offset: [0, -10] });
      });
      var fit = function () { try { m.invalidateSize(); m.fitBounds(line.getBounds().pad(0.08), { animate: false }); } catch (e) {} };
      S.map = m; S.cur = { fit: fit };
      fit(); setTimeout(fit, 0); setTimeout(function () { if (S.map === m) fit(); }, 400);
    });
  }

  function brancher(root) {
    root.onclick = function (ev) {
      var t = ev.target, b;
      if ((b = t.closest && t.closest('.trn-pill'))) { S.etab = b.getAttribute('data-s'); S.open = null; dessiner(); return; }
      if ((b = t.closest && t.closest('.trn-th button'))) {
        var k = b.getAttribute('data-k');
        if (S.sortK === k) S.sortDir = -S.sortDir; else { S.sortK = k; S.sortDir = -1; }
        lignes(); return;
      }
      if ((b = t.closest && t.closest('button.trn-row'))) {
        var c = b.getAttribute('data-c'); S.open = (S.open === c) ? null : c; lignes();
        var el = document.getElementById('trn-r-' + c); if (S.open && el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (t.closest && t.closest('#trn-retry')) { S.erreur = ''; S.d = null; V2.render(); }
    };
  }

  V2.pages.tournees = {
    needs: [],   // rien du catalogue ni des ventes : seulement son propre fichier
    render: function (root, param) {
      css(); S.root = root; brancher(root);
      if (interdit()) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) + '<div class="trn-page"><div class="trn-err"><b>Cet écran n’est pas ouvert à votre compte.</b><p>Les tournées de livraison ne sont pas disponibles dans cet espace.</p></div></div>';
        return;
      }
      if (S.d && S.A) {
        if (param && S.A[param] && S.open !== param) S.open = param;
        dessiner(); return;
      }
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) + '<div class="trn-page">' +
        (S.erreur ? '<div class="trn-err"><b>Données des tournées non disponibles</b><p>' + esc(S.erreur) + '</p><button type="button" class="v2-btn" id="trn-retry">Réessayer</button></div>'
          : '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement des tournées…</div></div>') + '</div>';
      if (S.erreur || S.charge) return;
      S.charge = true;
      charger().then(function (d) {
        var m = C.valider(d); if (m) throw new Error(m);
        S.d = d; S.A = C.analyserTout(d); S.pf = null; S.erreur = ''; S.charge = false;
        // comme la maquette : à l'arrivée, la tournée la mieux classée est déjà ouverte (ou celle demandée par l'adresse #tournees/Txx)
        S.open = (param && S.A[param]) ? param : C.classer(S.A, 'rentabilite_mois', -1)[0];
        if (V2.route && V2.route.name === 'tournees') dessiner();
        if (V2.ensurePharmaFr && !glob.PHARMA_FR) V2.ensurePharmaFr(function () { S.pf = null; if (V2.route && V2.route.name === 'tournees' && S.open && S.d) lignes(); });
      }).catch(function (e) {
        S.charge = false; S.erreur = 'Le fichier des tournées n’a pas pu être lu (' + (e && e.message ? e.message : 'erreur') + '). Rien n’est affiché plutôt que des chiffres faux.';
        if (V2.route && V2.route.name === 'tournees') V2.render();
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

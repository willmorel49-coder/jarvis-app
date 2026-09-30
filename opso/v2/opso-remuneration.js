// ═══════════════════════════════════════════════════════════════════
// OPSO Santé — Suivi de la rémunération prévue au contrat de référencement.
// Propre à OPSO (jamais chargé côté CRM JARVIS). Classes préfixées opr-.
//
// ⚠️ CE FICHIER NE PORTE AUCUN TAUX, AUCUN SEUIL, AUCUNE LISTE D'EXCLUSION :
// le dépôt est public et le contrat est confidentiel. Tout cela vit dans le
// réglage protégé `window.OPSO_CONTRAT` (fichier opso-contrat-data.js, seau
// Supabase fermé, clé `opsocontrat` de PROTEGES dans v2-boot.js), chargé après
// connexion. Réglage absent → le bloc ne s'affiche pas (ni chiffre, ni défaut).
//
// Ici : la mécanique seule (lire le réglage, classer les ventes, sommer,
// appliquer les tranches, afficher). Le CA total vient de la MÊME définition
// que l'accueil (V2.opsoGroupement.computeData : ventes OPSO, avoirs déduits).
//
// Se branche dans <div data-opso-slot="remuneration"></div> (accueil).
// ═══════════════════════════════════════════════════════════════════
(function () {
  "use strict";
  var V2 = window.V2 || (window.V2 = {});

  var fmtEUR = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  function euros(n) { return fmtEUR.format(Math.round(n || 0)) + ' €'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function normCip(c) { return String(c == null ? '' : c).replace(/\D/g, '').replace(/^0+/, ''); }
  var MOIS_ABREV = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Réglage valide ? ──
  function reglage() {
    var C = window.OPSO_CONTRAT;
    if (!C || !C.periodes || !C.periodes.length || !C.tranches || !C.tranches.length || !C.motifs || !C.ordre) return null;
    return C;
  }

  // CIP7 d'un code : CIP13 = 34009 + CIP7 + clé ; un code déjà sur 7 chiffres (lignes « stats officine » injectées) vaut son CIP7.
  function cip7De(brut) {
    var d = String(brut == null ? '' : brut).replace(/\D/g, '');
    if (d.length === 7) return d;
    return (d.length === 13 && d.slice(0, 5) === '34009') ? d.slice(5, 12) : '';
  }

  // ── Classement des lignes de vente : premier motif reconnu (ordre du réglage) ──
  var _idx = null;   // index PROD_STATS / BENCHMARK, refait si les tableaux changent
  function indexes() {
    var PS = window.PROD_STATS, B = window.BENCHMARK;
    if (_idx && _idx.ps === PS && _idx.b === B && _idx.nps === (PS ? PS.length : 0) && _idx.nb === (B ? B.length : 0)) return _idx;
    var prod = {}, bench = {}, prod7 = {}, bench7 = {};
    if (PS) PS.forEach(function (r) { var c = normCip(r.c); if (c && !prod[c]) prod[c] = r; var c7 = cip7De(r.c); if (c7 && !prod7[c7]) prod7[c7] = r; });
    if (B) B.forEach(function (r) { var c = normCip(r && r.cip13); if (c && !bench[c]) bench[c] = r.designation || ''; var c7 = cip7De(r && r.cip13); if (c7 && !bench7[c7]) bench7[c7] = r.designation || ''; });
    _idx = { ps: PS, b: B, nps: PS ? PS.length : 0, nb: B ? B.length : 0, prod: prod, bench: bench, prod7: prod7, bench7: bench7, memo: {} };
    return _idx;
  }

  // Motif d'une référence (clé du réglage) ou '' si aucune exclusion ne s'applique.
  function motifDe(C, ix, cipBrut, designationLigne) {
    var cip = normCip(cipBrut);
    var mk = cip + '|' + (designationLigne || '');
    if (ix.memo[mk] !== undefined) return ix.memo[mk];
    var c7 = cip7De(cipBrut);
    var info = ix.prod[cip] || (c7 && ix.prod7[c7]) || null;
    var noms = ((info && info.d) || '') + ' ' + (ix.bench[cip] || (c7 && ix.bench7[c7]) || '') + ' ' + (designationLigne || '');
    noms = noms.toUpperCase();
    var res = '';
    for (var i = 0; i < C.ordre.length && !res; i++) {
      var k = C.ordre[i], m = C.motifs[k]; if (!m) continue;
      if (m.categorie && info && info.f === m.categorie) res = k;
      else if (m.cip7 && c7 && m.cip7.indexOf(c7) >= 0) res = k;
      else if (m.noms) { for (var j = 0; j < m.noms.length; j++) { if (noms.indexOf(String(m.noms[j]).toUpperCase()) >= 0) { res = k; break; } } }
    }
    ix.memo[mk] = res;
    return res;
  }

  // ── Tranches : le seuil porte sur le CA HT net total de la période ; dans chaque
  // tranche, la part exclue est celle des motifs listés pour cette tranche, répartie
  // au prorata du CA (hypothèse écrite dans le rapport). ──
  function appliquerTranches(C, T, caParMotif) {
    var out = { total: T, retenu: 0, remu: 0, exclParMotif: {} };
    Object.keys(caParMotif).forEach(function (k) { out.exclParMotif[k] = 0; });
    if (!(T > 0)) { out.retenu = T; return out; }
    var bas = 0;
    for (var i = 0; i < C.tranches.length; i++) {
      var tr = C.tranches[i];
      var haut = (tr.jusqua == null) ? Infinity : tr.jusqua;
      var part = Math.min(T, haut) - bas;
      if (part > 0) {
        var exclSomme = 0;
        (tr.exclut || []).forEach(function (k) {
          var ca = caParMotif[k] || 0;
          exclSomme += ca;
          out.exclParMotif[k] = (out.exclParMotif[k] || 0) + part * (ca / T);
        });
        var base = part * (1 - exclSomme / T);
        out.retenu += base;
        out.remu += base * tr.taux;
      }
      bas = haut; if (T <= haut) break;
    }
    return out;
  }

  // ── Échéance : fin de période + N jours, ramenée à la fin du mois ──
  function echeance(C, annee, moisFin) {
    var fin = new Date(annee, moisFin, 0);                       // dernier jour du mois de fin
    var p = C.paiement || {};
    var d = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() + (p.jours || 0));
    if (p.finDeMois) d = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return d;
  }

  // ── Calcul complet ──
  function compute() {
    var C = reglage(); if (!C) return null;
    var sales = V2.sales || []; if (!sales.length) return null;
    var needsPS = C.ordre.some(function (k) { return C.motifs[k] && C.motifs[k].categorie; });
    if (needsPS && !(window.PROD_STATS && window.PROD_STATS.length)) return null;   // catalogue pas encore là : on attend
    var ix = indexes();

    var annee = 0;
    sales.forEach(function (s) { if (s.year && s.month && s.year > annee) annee = s.year; });
    if (!annee) return null;

    var today = new Date();
    var quads = C.periodes.map(function (p) {
      return { de: p.de, a: p.a, total: 0, ca: {}, mois: {}, lignes: 0 };
    });
    var quadDeMois = {};
    quads.forEach(function (q, i) { for (var m = q.de; m <= q.a; m++) quadDeMois[m] = i; });

    sales.forEach(function (s) {
      if (!s.year || !s.month || s.year !== annee) return;
      var qi = quadDeMois[s.month]; if (qi === undefined) return;
      var q = quads[qi], v = s.mntNetHt || 0;
      q.total += v; q.lignes++; q.mois[s.month] = 1;
      var k = motifDe(C, ix, s.artCode, s.artDesignation);
      if (k) q.ca[k] = (q.ca[k] || 0) + v;
    });

    // Prime par nouvelle pharmacie (réglage `prime` : montant, mois de départ) : pharmacie dont le PREMIER achat
    // réel de l'année tombe à partir de ce mois. Les lignes « stats officine » injectées (sans clé commercial,
    // réparties à parts égales sur les mois) ne se datent pas : ces pharmacies ne sont jamais comptées nouvelles.
    var P = (C.prime && C.prime.montant > 0) ? C.prime : null;
    var premier = {}, nomDe = {};
    (V2.pharmacies || []).forEach(function (ph) { nomDe[String(ph.id)] = ph.name || ''; });
    if (P) sales.forEach(function (s) {
      if (s.year !== annee || !s.month || typeof s.commercial === 'undefined' || !((s.mntNetHt || 0) > 0)) return;
      var id = String(s.pharmacyId);
      if (!premier[id] || s.month < premier[id]) premier[id] = s.month;
    });
    quads.forEach(function (q) { q.nouvelles = []; });
    if (P) Object.keys(premier).forEach(function (id) {
      var m = premier[id]; if (m < (P.depuis || 1)) return;
      var qi = quadDeMois[m]; if (qi !== undefined) quads[qi].nouvelles.push({ id: id, nom: nomDe[id] || id, mois: m });
    });

    var lignes = quads.map(function (q) {
      var r = appliquer(C, q);
      var nMois = Object.keys(q.mois).length, nPrevus = q.a - q.de + 1;
      var debut = new Date(annee, q.de - 1, 1), fin = new Date(annee, q.a, 0, 23, 59, 59);
      var statut = today > fin ? 'clos' : (today >= debut ? 'encours' : 'avenir');
      var eche = echeance(C, annee, q.a);
      // Période entièrement antérieure à l'accord (réglage `effet`, mois de départ) : montant indicatif, hors total.
      var indicatif = !!(C.effet && q.a < C.effet);
      return {
        de: q.de, a: q.a, periode: MOIS_ABREV[q.de - 1] + '–' + MOIS_ABREV[q.a - 1] + ' ' + annee,
        nMois: nMois, nPrevus: nPrevus, statut: statut, echeance: eche, indicatif: indicatif,
        total: r.total, retenu: r.retenu, exclu: r.total - r.retenu, remu: r.remu,
        exclParMotif: r.exclParMotif, caParMotif: q.ca,
        nouvelles: q.nouvelles.sort(function (a, b) { return a.mois - b.mois || a.nom.localeCompare(b.nom, 'fr'); }),
        primes: P ? q.nouvelles.length * P.montant : 0
      };
    });

    function appliquer(Cc, q) { return appliquerTranches(Cc, q.total, q.ca); }

    var tot = { total: 0, retenu: 0, exclu: 0, remu: 0, remuCA: 0, primes: 0, nNouvelles: 0 };
    // Les primes comptent dès leur mois de départ, même sur une période indicative pour la part au pourcentage.
    lignes.forEach(function (l) { tot.primes += l.primes; tot.nNouvelles += l.nouvelles.length; });
    lignes.forEach(function (l) { if (l.indicatif) return; tot.total += l.total; tot.retenu += l.retenu; tot.exclu += l.exclu; tot.remuCA += l.remu; });
    tot.remu = tot.remuCA + tot.primes;
    return { annee: annee, lignes: lignes, totalAnnee: tot, C: C, P: P };
  }

  // ── Styles (injectés une fois) ──
  var CSS = ""
    + ".opr-wrap{margin:0 0 var(--sp-4,16px) 0}"
    + ".opr-title{font-family:'Varela Round',var(--font,system-ui),sans-serif;font-weight:400;font-size:1.0625rem;line-height:1.3;color:var(--ip-ink,#10131C);margin:0 0 4px}"
    + ".opr-sub{font-size:.8125rem;line-height:1.45;color:var(--muted,#646B80);margin:0 0 14px}"
    + ".opr-q{border-top:1px solid var(--line,#E3E7F0);padding:14px 0}"
    + ".opr-q:first-of-type{border-top:none;padding-top:2px}"
    + ".opr-qh{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-bottom:10px}"
    + ".opr-per{font-size:.9375rem;font-weight:600;color:var(--ip-ink,#10131C);margin:0}"
    + ".opr-badge{display:inline-flex;align-items:center;border-radius:999px;padding:3px 10px;font-size:.8125rem;line-height:1.3;background:var(--surf-sunken,#F4F6FB);color:var(--ip-ink-2,#2A2F3C)}"
    + ".opr-badge--clos{background:var(--halo,#E6F7EC);color:var(--ip-blue-d,#0d8530)}"
    + ".opr-badge--encours{background:#FFF4E0;color:#8A4B00}"
    + ".opr-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;margin:0;background:var(--line,#E3E7F0);border:1px solid var(--line,#E3E7F0);border-radius:var(--r-md,14px);overflow:hidden}"
    + "@media(min-width:640px){.opr-facts{grid-template-columns:repeat(4,minmax(0,1fr))}}"
    + ".opr-f{background:var(--card,#fff);padding:12px;min-width:0}"
    + ".opr-f dt{font-size:.8125rem;line-height:1.3;color:var(--muted,#646B80);margin:0 0 6px}"
    + ".opr-f dd{margin:0;font-size:1.05rem;color:var(--ip-ink,#10131C);overflow-wrap:anywhere}"
    + ".opr-f--remu{background:var(--halo,#E6F7EC)}"
    + ".opr-f--remu dd{color:var(--ip-blue-d,#0d8530);font-weight:600}"
    + ".opr-det,.opr-pay{font-size:.8125rem;line-height:1.45;color:var(--muted,#646B80);margin:8px 0 0;font-variant-numeric:tabular-nums}"
    + ".opr-mot{display:inline-block;white-space:nowrap;margin-right:14px}"
    + ".opr-pay strong{white-space:nowrap;font-weight:600;color:var(--ip-ink-2,#2A2F3C)}"
    + ".opr-tot{border-top:2px solid var(--line,#E3E7F0);margin-top:4px;padding-top:14px}"
    + ".opr-tot .opr-per{margin-bottom:10px}"
    + ".opr-note{font-size:.8125rem;line-height:1.45;color:var(--muted,#646B80);margin:14px 0 0}"
    + ".opr-note p{margin:0 0 4px}"
  ;
  function injectStyle() {
    if (document.getElementById('opr-style')) return;
    var st = document.createElement('style'); st.id = 'opr-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ── Rendu ──
  function faits(l, vide) {
    function dd(v) { return vide ? '<span class="mono">—</span>' : '<span class="mono">' + euros(v) + '</span>'; }
    return '<dl class="opr-facts">'
      + '<div class="opr-f"><dt>CA HT net</dt><dd>' + dd(l.total) + '</dd></div>'
      + '<div class="opr-f"><dt>CA retenu</dt><dd>' + dd(l.retenu) + '</dd></div>'
      + '<div class="opr-f"><dt>Part exclue</dt><dd>' + dd(l.exclu) + '</dd></div>'
      + '<div class="opr-f opr-f--remu"><dt>Rémunération estimée</dt><dd>' + dd(l.remu) + '</dd></div>'
      + '</dl>';
  }

  function detailExclusions(D, l) {
    var C = D.C, parts = [];
    C.ordre.forEach(function (k) {
      var v = l.exclParMotif[k];
      if (C.motifs[k] && v && Math.abs(v) >= 0.5) parts.push('<span class="opr-mot">' + esc(C.motifs[k].label) + '\u00a0: ' + euros(v) + '</span>');
    });
    return parts.length ? 'Part exclue, par motif\u00a0: ' + parts.join(' ') : 'Aucune vente exclue sur cette période.';
  }

  var MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function moisEffet(D) { return MOIS_LONG[D.C.effet - 1] + ' ' + D.annee; }

  function lignePrimes(D, l) {
    if (!D.P || D.P.depuis > l.a) return '';
    var n = l.nouvelles.length, pl = n > 1 ? 's' : '';
    if (!n) return '<p class="opr-det">Nouvelles pharmacies clientes\u00a0: aucune sur cette période.</p>';
    var noms = l.nouvelles.map(function (x) { return '<span class="opr-mot">' + esc(x.nom) + ' (' + MOIS_ABREV[x.mois - 1] + ')</span>'; }).join(' ');
    return '<p class="opr-det"><strong>' + n + ' nouvelle' + pl + ' pharmacie' + pl + ' cliente' + pl + '\u00a0: ' + euros(l.primes) + '</strong> ('
      + euros(D.P.montant) + ' chacune' + (l.indicatif ? ', comptés dans le total' : '') + ')\u00a0: ' + noms + '</p>';
  }

  function badge(l) {
    if (l.indicatif) return '<span class="opr-badge">À titre indicatif</span>';
    if (l.statut === 'clos') {
      return l.nMois < l.nPrevus
        ? '<span class="opr-badge opr-badge--encours">Clos · ventes de ' + l.nMois + ' mois sur ' + l.nPrevus + '</span>'
        : '<span class="opr-badge opr-badge--clos">Clos</span>';
    }
    if (l.statut === 'encours') return '<span class="opr-badge opr-badge--encours">En cours · ' + l.nMois + ' mois sur ' + l.nPrevus + '</span>';
    return '<span class="opr-badge">À venir</span>';
  }

  function html(D) {
    var out = '<section class="v2-card opr-wrap" aria-labelledby="opr-titre">'
      + '<h2 class="opr-title" id="opr-titre">Partenariat Intégral Pharma — rémunération du groupement</h2>'
      + '<p class="opr-sub">Rémunération prévue au contrat de référencement, calculée par quadrimestre sur les achats des adhérentes chez Intégral Pharma, groupe de grossistes-répartiteurs. Année ' + D.annee + '.</p>';
    D.lignes.forEach(function (l) {
      var vide = l.nMois === 0;
      out += '<article class="opr-q" data-opr-q="' + l.de + '-' + l.a + '">'
        + '<header class="opr-qh"><h3 class="opr-per">' + esc(l.periode) + '</h3>' + badge(l) + '</header>'
        + faits(l, vide)
        + '<p class="opr-det">' + (vide ? 'Aucune vente enregistrée pour l’instant.' : detailExclusions(D, l)) + '</p>'
        + lignePrimes(D, l)
        + (l.indicatif
          ? '<p class="opr-pay">Période antérieure à l’accord, évoqué à partir de ' + esc(moisEffet(D)) + '\u00a0: montant donné à titre indicatif, non compté dans le total.</p>'
          : '<p class="opr-pay">' + (l.statut === 'clos' ? 'Échéance de paiement prévue' : 'Échéance de paiement prévue au plus tôt')
        + ' : <strong>' + esc(fmtDate.format(l.echeance)) + '</strong></p>')
        + '</article>';
    });
    out += '<div class="opr-q opr-tot" data-opr-total="1">'
      + '<h3 class="opr-per">' + (D.C.effet ? 'Total depuis ' + esc(moisEffet(D)) : 'Total ' + D.annee) + ' à ce jour</h3>'
      + faits(D.totalAnnee, false)
      + (D.P ? '<p class="opr-det">Dont <strong>' + euros(D.totalAnnee.remuCA) + '</strong> sur le chiffre d’affaires et <strong>' + euros(D.totalAnnee.primes) + '</strong> pour '
        + D.totalAnnee.nNouvelles + ' nouvelle' + (D.totalAnnee.nNouvelles > 1 ? 's pharmacies clientes' : ' pharmacie cliente')
        + ' depuis ' + esc(MOIS_LONG[(D.P.depuis || 1) - 1]) + '.</p>' : '')
      + '</div>'
      + '<div class="opr-note">'
      + '<p>Estimation à partir des ventes enregistrées ; le montant facturé fait foi.</p>'
      + (D.P ? '<p>Nouvelle pharmacie cliente\u00a0: adhérente dont le premier achat de l’année chez Intégral Pharma tombe à partir de ' + esc(MOIS_LONG[(D.P.depuis || 1) - 1]) + '. Les pharmacies suivies seulement par des statistiques globales, non datées au mois, ne sont pas comptées.</p>' : '')
      + '<p>Échéance : fin de la période, plus ' + ((D.C.paiement && D.C.paiement.jours) || 0) + ' jours' + ((D.C.paiement && D.C.paiement.finDeMois) ? ', ramenés à la fin du mois' : '') + '.</p>'
      + '</div>'
      + '</section>';
    return out;
  }

  // ── Accroche robuste à l'emplacement de l'accueil ──
  function signature() {
    var s = V2.sales || [];
    return [s.length, window.PROD_STATS ? window.PROD_STATS.length : 0, window.BENCHMARK ? window.BENCHMARK.length : 0,
      reglage() ? (window.OPSO_CONTRAT.version || 'ok') : 'none', new Date().getDate()].join('|');
  }

  function assurerReglage() {
    if (reglage() || V2._oprChargement) return;
    if (!(V2.user && V2.user.email) || !V2.loadFiles || !(V2.sales || []).length) return;
    V2._oprChargement = true;
    // Réglage absent ou refusé : le bloc reste caché, et on retire NOS deux clés de V2.protegeEchec — sinon le
    // bandeau « Les chiffres n'ont pas pu être téléchargés » s'afficherait à toute l'équipe pour un bloc optionnel.
    function abandon() {
      if (reglage()) return;
      delete V2.protegeEchec.opsocontrat; delete V2.protegeEchec['opso-contrat-data.js'];
      if (V2.bandeauDonneesManquantes) { try { V2.bandeauDonneesManquantes(); } catch (e) {} }
    }
    try { V2.loadFiles(['opsocontrat']).then(function () { abandon(); tick(); }, function () { abandon(); tick(); }); } catch (e) { abandon(); }
  }

  function render(slot, sig) {
    var D = null;
    try { D = compute(); } catch (e) { D = null; if (window.console) console.warn('[opso-remuneration]', e); }
    slot.setAttribute('data-opr-sig', sig);
    if (!D) { slot.innerHTML = ''; return; }
    injectStyle();
    slot.innerHTML = html(D);
  }

  function tick() {
    var slot = document.querySelector('[data-opso-slot="remuneration"]');
    if (!slot) return;
    assurerReglage();
    var sig = signature();
    if (slot.getAttribute('data-opr-sig') === sig && (slot.firstChild || sig.indexOf('none') > 0)) return;
    render(slot, sig);
  }

  var timer = null;
  function planifier() { clearTimeout(timer); timer = setTimeout(tick, 120); }

  function demarrer() {
    if (window.MutationObserver) new MutationObserver(planifier).observe(document.body, { childList: true, subtree: true });
    setInterval(tick, 2000);   // filet : les ventes arrivent sans forcément toucher au DOM (7 → 19 clientes)
    tick();
  }
  if (document.body) demarrer(); else document.addEventListener('DOMContentLoaded', demarrer);

  V2.opsoRemuneration = { compute: compute, tick: tick, appliquerTranches: appliquerTranches };
})();

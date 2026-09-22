/* ═══════════════════════════════════════════════════════════════════════
   BRIEF DE L'OFFICINE — « Aujourd'hui », en tête de la fiche officine.
   Phase 1 de la recherche IA × officine (17/09/2026) : vu par le commercial.

   Croise les signaux publics du jour avec les achats de CETTE officine :
     - ruptures / tensions / arrêts / remises à disposition (ansm-dispo.json)
     - baisses et hausses de prix à venir (prix-futurs.json, avis CEPS au JO)
     - rappels de lots (rappels-lots.json)
     - produit habituel non commandé le dernier mois connu (ventes)
     - princeps encore acheté alors qu'un générique existe (generiques-bdpm.json)
     - échéances réglementaires proches (calendrier-officine.json, tenu à la main)
   7 points maximum, triés par urgence puis volume. Aucun modèle de langue :
   chaque ligne sort d'une règle écrite ici, avec sa source et sa date.

   V2.briefOfficine.calculer(entree) est une fonction PURE (testée dans
   tests/brief-officine.test.mjs, y compris sur les vrais fichiers du jour).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};

  var MAX_POINTS = 7;
  var FRAIS_MAX_J = 2;            // les trois robots tournent chaque jour
  var RAPPEL_RECENT_J = 90;       // un rappel plus ancien n'est plus « du jour »
  var REMISE_RECENTE_J = 14;      // « de nouveau disponible » : seulement si c'est récent
  var PRINCEPS_MIN_BOITES = 10;   // en dessous, l'opportunité ne vaut pas une ligne
  var PRINCEPS_MAX_LIGNES = 2;
  var HABITUDE_MAX_LIGNES = 3;
  var RECENT_MOIS = 3;    // au-delà, la liste noie les vraies alertes
  var ECHEANCE_MAX_LIGNES = 2;
  var CALENDRIER_MAX_J = 120;     // fichier tenu à la main : à revérifier au moins tous les 4 mois

  var STATUTS = {
    'Rupture de stock': { urgence: 3, titre: 'En rupture' },
    "Tension d'approvisionnement": { urgence: 2, titre: 'En tension' },
    'Arrêt de commercialisation': { urgence: 2, titre: 'Arrêt de commercialisation' },
    'Remise à disposition': { urgence: 1, titre: 'De nouveau disponible' }
  };
  var MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function jours(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }
  function moisFr(ym) { var p = String(ym || '').split('-'); return p.length < 2 ? String(ym || '') : MOIS_FR[+p[1] - 1] + ' ' + p[0]; }
  function dateFr(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length < 3 ? String(iso || '') : p[2] + '/' + p[1] + '/' + p[0]; }
  function isoDeFr(fr) { var p = String(fr || '').split('/'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : ''; }
  function pluriel(n, mot) { n = Math.round(n); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + ' ' + mot + (n > 1 ? 's' : ''); }
  function nomCourt(spec) { return String(spec || '').split(' – [')[0].split(', ')[0]; }

  // Achats de l'officine regroupés par CIP13 : total, mois vus, dernier mois.
  function indexAchats(ventes) {
    var idx = {};
    for (var i = 0; i < ventes.length; i++) {
      var v = ventes[i], c = String(v.cip || '');
      if (c.length !== 13 || !v.qte) continue;
      var a = idx[c] || (idx[c] = { qte: 0, mois: {}, dernier: '' });
      a.qte += v.qte;                       // les retours (quantités négatives) se déduisent
      if (v.qte > 0) {
        a.mois[v.mois] = 1;
        if (v.mois > a.dernier) a.dernier = v.mois;
      }
    }
    Object.keys(idx).forEach(function (c) { if (idx[c].qte <= 0 || !idx[c].dernier) delete idx[c]; });
    return idx;
  }
  function achatsDe(idx, cips) {
    var r = { qte: 0, dernier: '' };
    for (var i = 0; i < (cips || []).length; i++) {
      var a = idx[cips[i]];
      if (!a) continue;
      r.qte += a.qte;
      if (a.dernier > r.dernier) r.dernier = a.dernier;
    }
    return r;
  }

  /* entree = {
       aujourdhui: 'AAAA-MM-JJ',
       ventes: [{cip, mois:'AAAA-MM', qte}],     // TOUS commerciaux de l'officine
       moisCouverts: ['AAAA-MM', …],               // mois où le fichier de l'officine existe
       ansm, prixFuturs, rappels, generiques,      // JSON des robots, ou null si non lus
       calendrier,                                  // calendrier-officine.json, ou null
       stockSites: function (cip) → [{site, q}],   // facultatif
       nom: function (cip) → libellé                // facultatif
     }
     → { points:[…≤7], autres:[…], sources:[…], achatsConnus:bool } */
  function calculer(e) {
    var auj = e.aujourdhui;
    var idx = indexAchats(e.ventes || []);
    var nbMois = Math.max(1, (e.moisCouverts || []).length);
    var nom = e.nom || function () { return ''; };
    var stockSites = e.stockSites || function () { return []; };
    var pts = [];
    var mc = (e.moisCouverts || []).slice().sort();
    var fin = mc[mc.length - 1];
    // Ruptures et prix : seulement ce qu'elle a commandé dans ses 3 derniers mois connus
    // (un produit abandonné depuis février n'a rien à faire devant ses achats courants).
    var recent = mc[Math.max(0, mc.length - RECENT_MOIS)] || '';

    // 1. Disponibilité (ANSM)
    ((e.ansm && e.ansm.items) || []).forEach(function (it) {
      var s = STATUTS[it.st];
      if (!s || !it.cips || !it.cips.length) return;
      if (it.st === 'Remise à disposition' && !(it.since && jours(it.since, auj) <= REMISE_RECENTE_J)) return;
      var a = achatsDe(idx, it.cips);
      if (!a.qte || a.dernier < recent) return;
      var parMois = Math.max(1, Math.round(a.qte / nbMois));
      var detail = ['Elle en achète environ ' + pluriel(parMois, 'boîte') + ' par mois (dernière commande : ' + moisFr(a.dernier) + ').'];
      if (it.st !== 'Remise à disposition') {
        if (it.retour && it.retour.raw) detail.push('Retour annoncé : ' + String(it.retour.raw).replace(/\.$/, '') + '.');
        var sites = [];
        it.cips.forEach(function (c) { stockSites(c).forEach(function (x) { if (x.q > 0) sites.push(x); }); });
        if (sites.length) {
          var tot = sites.reduce(function (t, x) { return t + x.q; }, 0);
          var noms = sites.map(function (x) { return x.site; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; });
          detail.push('Chez nous : ' + pluriel(tot, 'boîte') + ' sur ' + noms.join(', ') + '.');
        }
      }
      pts.push({
        rubrique: it.st === 'Remise à disposition' ? 'Revient' : 'Va manquer',
        urgence: s.urgence, volume: a.qte,
        titre: s.titre + ' : ' + nomCourt(it.spec),
        detail: detail.join(' '),
        action: it.st === 'Remise à disposition' ? 'Lui signaler qu\'elle peut recommander.' : 'La prévenir avant qu\'elle le découvre au comptoir.',
        pourquoi: 'Signalé par l\'ANSM (' + it.st.toLowerCase() + ', fiche du ' + dateFr(isoDeFr(it.maj) || e.ansm.generated) + ') et présent dans ses achats.',
        source: 'ansm', date: isoDeFr(it.maj) || (e.ansm.generated || '')
      });
    });

    // 2. Prix qui changent (avis CEPS au JO), seulement si l'effet est à venir
    ((e.prixFuturs && e.prixFuturs.changes) || []).forEach(function (ch) {
      if (ch.sens !== 'baisse' && ch.sens !== 'hausse') return;
      if (!ch.date_effet || ch.date_effet < auj) return;
      var a = achatsDe(idx, [String(ch.c)]);
      if (!a.qte || a.dernier < recent) return;
      var dans = jours(auj, ch.date_effet);
      var prix = (ch.ancien_ttc ? String(ch.ancien_ttc).replace('.', ',') + ' € → ' : '') + String(ch.ppttc).replace('.', ',') + ' € TTC';
      pts.push({
        rubrique: 'Change bientôt',
        urgence: dans <= 7 ? 3 : 2, volume: a.qte,
        titre: (ch.sens === 'baisse' ? 'Baisse' : 'Hausse') + ' de prix le ' + dateFr(ch.date_effet) + ' : ' + (ch.d || nom(ch.c)),
        detail: 'Prix public ' + prix + '. Elle en a acheté ' + pluriel(a.qte, 'boîte') + ' sur la période (dernière commande : ' + moisFr(a.dernier) + ').',
        action: ch.sens === 'baisse' ? 'Lui conseiller d\'écouler son stock avant le ' + dateFr(ch.date_effet) + '.' : 'Lui signaler la hausse avant sa prochaine commande.',
        pourquoi: 'Avis de prix publié au Journal officiel le ' + dateFr(ch.date_publi) + '.',
        source: 'prix', date: ch.date_publi || ''
      });
    });

    // 3. Rappels de lots récents sur un produit qu'elle a acheté
    ((e.rappels && e.rappels.items) || []).forEach(function (r) {
      if (!r.d || jours(r.d, auj) > RAPPEL_RECENT_J || !r.cips || !r.cips.length) return;
      var a = achatsDe(idx, r.cips);
      if (!a.qte) return;
      var lots = (r.lots || []).map(function (l) { return l.n + (l.exp ? ' (exp. ' + l.exp + ')' : ''); });
      pts.push({
        rubrique: 'À retirer',
        urgence: 4, volume: a.qte,
        titre: 'Rappel de lots : ' + nomCourt(r.t),
        detail: (lots.length ? 'Lots concernés : ' + lots.join(', ') + '. ' : '') + 'Elle en a acheté ' + pluriel(a.qte, 'boîte') + ' (dernière commande : ' + moisFr(a.dernier) + ').',
        action: 'Lui demander de vérifier ses lots en rayon.',
        pourquoi: 'Rappel publié par l\'ANSM le ' + dateFr(r.d) + '.',
        source: 'rappels', date: r.d
      });
    });

    // 4. Produit habituel absent du dernier mois connu.
    // Le dernier mois est celui où TOUS les fichiers de ses commerciaux existent
    // (sinon un fichier plus court inventerait une absence). Il faut aussi
    // qu'elle ait commandé autre chose ce mois-là : sinon on ne sait rien.
    var avant = mc.slice(-7, -1);
    var aCommandeFin = false;
    Object.keys(idx).forEach(function (c) { if (idx[c].mois[fin]) aCommandeFin = true; });
    if (fin && avant.length >= 4 && aCommandeFin) {
      Object.keys(idx).sort(function (x, y) { return idx[y].qte - idx[x].qte; }).filter(function (c) {
        var a = idx[c];
        return !a.mois[fin] && avant.filter(function (m) { return a.mois[m]; }).length >= 4 && nom(c);
      }).slice(0, HABITUDE_MAX_LIGNES).forEach(function (c) {
        var a = idx[c], n = nom(c);
        var vus = avant.filter(function (m) { return a.mois[m]; }).length;
        pts.push({
          rubrique: 'Ses achats',
          urgence: 1, volume: a.qte,
          titre: 'Pas commandé en ' + moisFr(fin) + ' : ' + n,
          detail: 'Commandé ' + vus + ' mois sur les ' + avant.length + ' précédents (' + pluriel(a.qte, 'boîte') + ' au total).',
          action: 'Lui demander si elle l\'achète ailleurs.',
          pourquoi: 'Habitude d\'achat interrompue.',
          source: 'ventes', date: ''
        });
      });
    }

    // 5. Princeps encore acheté alors qu'un générique existe
    var princeps = {};
    ((e.generiques && e.generiques.princepsWithGeneric) || []).forEach(function (c) { princeps[c] = 1; });
    Object.keys(idx).filter(function (c) { return princeps[c] && idx[c].qte >= PRINCEPS_MIN_BOITES && nom(c); })
      .sort(function (x, y) { return idx[y].qte - idx[x].qte; })
      .slice(0, PRINCEPS_MAX_LIGNES)
      .forEach(function (c) {
        pts.push({
          rubrique: 'Opportunité',
          urgence: 0, volume: idx[c].qte,
          titre: 'Princeps acheté alors qu\'un générique existe : ' + nom(c),
          detail: pluriel(idx[c].qte, 'boîte') + ' sur la période.',
          action: 'Lui proposer le générique.',
          pourquoi: 'Inscrit au répertoire des génériques (base officielle des médicaments).',
          source: 'generiques', date: (e.generiques.generated || '')
        });
      });

    // 6. Échéances réglementaires : à part, sous la liste (elles ne dépendent pas
    //    de ses achats et seraient toujours reléguées derrière les 7 points).
    var echeances = ((e.calendrier && e.calendrier.items) || []).filter(function (it) {
      var dans = it.date ? jours(auj, it.date) : -1;
      return dans >= 0 && dans <= (it.prevenir_j || 0);
    }).sort(function (x, y) { return x.date < y.date ? -1 : 1; })
      .slice(0, ECHEANCE_MAX_LIGNES)
      .map(function (it) {
        var dans = jours(auj, it.date);
        return {
          titre: it.titre + ' le ' + dateFr(it.date) + (dans ? ' (dans ' + pluriel(dans, 'jour') + ')' : ' (aujourd\'hui)'),
          detail: it.detail, action: it.action,
          source: it.source_nom, url: it.source_url || ''
        };
      });

    pts.sort(function (x, y) { return (y.urgence - x.urgence) || (y.volume - x.volume); });

    var sources = [
      { cle: 'ansm', nom: 'Ruptures ANSM', json: e.ansm, max: FRAIS_MAX_J },
      { cle: 'prix', nom: 'Prix au JO', json: e.prixFuturs, max: FRAIS_MAX_J },
      { cle: 'rappels', nom: 'Rappels de lots', json: e.rappels, max: FRAIS_MAX_J },
      { cle: 'generiques', nom: 'Répertoire des génériques', json: e.generiques, max: 9 },
      { cle: 'calendrier', nom: 'Calendrier réglementaire', json: e.calendrier, max: CALENDRIER_MAX_J }
    ].map(function (s) {
      if (!s.json) return { cle: s.cle, nom: s.nom, lue: false, date: '', aJour: false };
      var d = String(s.json.generated || '').slice(0, 10);
      return { cle: s.cle, nom: s.nom, lue: true, date: d, aJour: !!d && jours(d, auj) <= s.max };
    });

    return {
      points: pts.slice(0, MAX_POINTS),
      autres: pts.slice(MAX_POINTS),
      echeances: echeances,
      sources: sources,
      achatsConnus: Object.keys(idx).length > 0,
      periode: mc.length ? moisFr(mc[0]) + ' – ' + moisFr(fin) : ''
    };
  }

  // ─────────────────────── Couche écran ───────────────────────
  var RUB_COULEUR = { 'À retirer': '#C2410C', 'Va manquer': '#B91C1C', 'Change bientôt': '#1D4ED8', 'Revient': '#047857', 'Ses achats': '#6D28D9', 'Opportunité': '#0F766E' };
  var _json = {};          // fichier → promesse (une lecture par jour et par session)
  var _dernierMois = null; // commercial → dernier mois présent dans son fichier
  var _dernierMoisRef = null;

  function lire(f) {
    if (!_json[f]) {
      var jour = new Date().toISOString().slice(0, 10);
      _json[f] = fetch(f + '?d=' + jour, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return _json[f];
  }

  function cleMois(s) { return (s.year || '') + '-' + ('0' + s.month).slice(-2); }

  function dernierMoisParCommercial() {
    if (_dernierMois && _dernierMoisRef === V2.sales) return _dernierMois;
    _dernierMois = {};
    var S = V2.sales || [];
    for (var i = 0; i < S.length; i++) {
      var c = S[i].commercial || '';
      var m = cleMois(S[i]);
      if (!_dernierMois[c] || m > _dernierMois[c]) _dernierMois[c] = m;
    }
    _dernierMoisRef = V2.sales;
    return _dernierMois;
  }

  function moisCouverts(ventes) {
    var der = dernierMoisParCommercial(), fin = '', vus = {};
    ventes.forEach(function (s) {
      vus[cleMois(s)] = 1;
      var d = der[s.commercial || ''] || '';
      if (d && (!fin || d < fin)) fin = d;
    });
    return Object.keys(vus).filter(function (m) { return !fin || m <= fin; }).sort();
  }

  function stockSites(cip) {
    var EP = window.ETAB_PRICES && window.ETAB_PRICES.prices;
    if (EP) {
      var out = [];
      Object.keys(EP).forEach(function (site) { var v = EP[site][cip]; if (v && v[1] > 0) out.push({ site: site, q: v[1] }); });
      return out;
    }
    var q = window.STOCK_IP && window.STOCK_IP.data && window.STOCK_IP.data[cip];
    return q > 0 ? [{ site: 'nos sites', q: q }] : [];
  }

  var _noms = null;
  function nom(cip) {
    if (!_noms) {
      _noms = {};
      (window.BENCHMARK || []).forEach(function (b) { if (b.cip13 && b.designation) _noms[String(b.cip13)] = b.designation; });
    }
    var n = _noms[cip] || '';
    return n ? n.charAt(0) + n.slice(1).toLowerCase() : '';
  }

  function esc(s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); }

  function ligneHtml(p) {
    var c = RUB_COULEUR[p.rubrique] || '#475569';
    return '<li class="bo-pt">' +
      '<span class="bo-rub" style="--c:' + c + '">' + esc(p.rubrique) + '</span>' +
      '<div class="bo-tx"><b>' + esc(p.titre) + '</b>' +
        '<span>' + esc(p.detail) + '</span>' +
        '<span class="bo-act">→ ' + esc(p.action) + '</span>' +
        '<small>' + esc(p.pourquoi) + (p.date && p.pourquoi.indexOf(dateFr(p.date)) < 0 ? ' · relevé du ' + esc(dateFr(p.date)) : '') + '</small>' +
      '</div></li>';
  }

  function rendre(r) {
    var nonLues = r.sources.filter(function (s) { return !s.lue; });
    var corps;
    if (!r.achatsConnus) {
      corps = '<p class="bo-vide">Aucun achat connu pour cette officine sur la période : le brief n\'a rien à croiser.</p>';
    } else if (!r.points.length) {
      corps = '<p class="bo-vide">' + (nonLues.length
        ? 'Rien d\'urgent dans les sources lues. ' + pluriel(nonLues.length, 'source') + ' n\'' + (nonLues.length > 1 ? 'ont' : 'a') + ' pas pu être lue' + (nonLues.length > 1 ? 's' : '') + ' : à revoir plus tard.'
        : 'Rien d\'urgent aujourd\'hui pour cette officine.') + '</p>';
    } else {
      corps = '<ol class="bo-liste">' + r.points.map(ligneHtml).join('') + '</ol>' +
        (r.autres.length ? '<details class="bo-plus"><summary>' + r.autres.length + (r.autres.length > 1 ? ' autres points' : ' autre point') + '</summary><ol class="bo-liste">' + r.autres.map(ligneHtml).join('') + '</ol></details>' : '');
    }
    if (r.echeances.length) {
      corps += '<div class="bo-agenda"><h4>À l\'agenda</h4><ul>' + r.echeances.map(function (x) {
        return '<li><b>' + esc(x.titre) + '</b><span>' + esc(x.detail) + '</span><span class="bo-act">→ ' + esc(x.action) + '</span>' +
          '<small>Source : ' + (/^https:\/\//.test(x.url) ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.source) + '</a>' : esc(x.source)) + '</small></li>';
      }).join('') + '</ul></div>';
    }
    var src = r.sources.map(function (s) {
      var etat = !s.lue ? 'non lue' : (s.aJour ? dateFr(s.date) : dateFr(s.date) + ', en retard');
      return '<span class="' + (s.lue && s.aJour ? '' : 'bo-ko') + '">' + esc(s.nom) + ' (' + esc(etat) + ')</span>';
    }).join(' · ');
    return '<div class="pha-ch"><h3>Aujourd\'hui</h3><span class="pha-sub">ce qui la concerne, tiré de ses achats</span>' +
        (r.points.length ? '<button class="v2-btn bo-imp" onclick="V2.briefOfficine.imprimer()">Imprimer pour l\'équipe</button>' : '') + '</div>' +
      corps +
      '<div class="bo-src">Sources : ' + src + (r.periode ? ' · Ses achats (' + esc(r.periode) + ')' : '') + '</div>';
  }

  var STYLE = '.bo-liste{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:10px}' +
    '.bo-pt{display:flex;gap:12px;align-items:flex-start}' +
    '.bo-rub{flex:0 0 auto;min-width:96px;font-size:11px;font-weight:700;letter-spacing:.02em;color:var(--c);border:1px solid var(--c);border-radius:999px;padding:2px 8px;text-align:center}' +
    '.bo-tx{display:grid;gap:2px;font-size:13px;line-height:1.4;min-width:0}' +
    '.bo-tx b{font-weight:600}.bo-act{font-weight:500}.bo-tx small{color:var(--v2-muted,#64748b);font-size:11.5px}' +
    '.bo-vide{margin:8px 0 0;font-size:13.5px}' +
    '.bo-plus{margin-top:10px}.bo-plus summary{cursor:pointer;font-size:12.5px;font-weight:600}' +
    '.bo-agenda{margin-top:12px;padding-top:10px;border-top:1px solid var(--v2-line,#e2e8f0)}' +
    '.bo-agenda h4{margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.02em;color:#A16207}' +
    '.bo-agenda ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}' +
    '.bo-agenda li{display:grid;gap:2px;font-size:13px;line-height:1.4}.bo-agenda b{font-weight:600}' +
    '.bo-agenda small{color:var(--v2-muted,#64748b);font-size:11.5px}.bo-agenda a{color:inherit}' +
    '.bo-src{margin-top:12px;font-size:11.5px;color:var(--v2-muted,#64748b)}.bo-ko{color:#B45309;font-weight:600}' +
    '@media (max-width:520px){.bo-pt{flex-direction:column;gap:4px}.bo-rub{min-width:0}}' +
    '.bo-imp{margin-left:auto;font-size:12px;padding:4px 10px}' +
    '@media print{body.bo-imprime *{visibility:hidden}body.bo-imprime #brief-off,body.bo-imprime #brief-off *{visibility:visible}' +
    'body.bo-imprime #brief-off{position:absolute;left:0;top:0;width:100%}body.bo-imprime .bo-imp,body.bo-imprime .bo-plus{display:none}}';

  function imprimer() {
    document.body.classList.add('bo-imprime');
    var fin = function () { document.body.classList.remove('bo-imprime'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
  }

  // Stock par site : même fichier et même adresse que l'écran Comptoir (cache partagé).
  var _etab = null;
  function chargerStockSites() {
    if (window.ETAB_PRICES) return Promise.resolve();
    if (!_etab) {
      _etab = new Promise(function (ok) {
        var sc = document.createElement('script');
        sc.src = 'etab-prices-data.js?v=' + (window.__APPRO_V || '20260922a');
        sc.async = true;
        sc.onload = sc.onerror = function () { ok(); };
        document.head.appendChild(sc);
      });
    }
    return _etab;
  }

  function hydrate(pid, ventesOfficine) {
    var el = document.getElementById('brief-off');
    if (!el) return;
    if (!document.getElementById('bo-style')) {
      var st = document.createElement('style'); st.id = 'bo-style'; st.textContent = STYLE; document.head.appendChild(st);
    }
    Promise.all(['ansm-dispo.json', 'prix-futurs.json', 'rappels-lots.json', 'generiques-bdpm.json', 'calendrier-officine.json'].map(lire).concat([chargerStockSites()])).then(function (j) {
      var cible = document.getElementById('brief-off');
      if (!cible || cible.getAttribute('data-pid') !== String(pid)) return;   // l'écran a changé entre-temps
      var r = calculer({
        aujourdhui: new Date().toISOString().slice(0, 10),
        ventes: ventesOfficine.map(function (s) { return { cip: String(s.artCode || ''), mois: cleMois(s), qte: s.qte || 0 }; }),
        moisCouverts: moisCouverts(ventesOfficine),
        ansm: j[0], prixFuturs: j[1], rappels: j[2], generiques: j[3], calendrier: j[4],
        stockSites: stockSites, nom: nom
      });
      cible.innerHTML = rendre(r);
    });
  }

  V2.briefOfficine = { calculer: calculer, hydrate: hydrate, imprimer: imprimer };
})();

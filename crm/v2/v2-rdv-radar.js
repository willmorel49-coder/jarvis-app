/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Qui inviter (pages.rdvradar) + les voisines d'une journée

   Le module Rendez-vous savait tout faire SAUF répondre à la première
   question de la semaine : « à qui j'écris ? ». Le commercial ouvrait la
   campagne devant 691 officines et cochait au jugé.

   Ici la liste se compose toute seule, à partir de ce que JARVIS sait
   déjà : depuis quand il ne l'a pas vue, si ses achats décrochent, et si
   elle achète des références aujourd'hui en tension dont nous avons du
   stock. Chaque ligne porte SA raison, écrite — un classement sans motif
   ne se vérifie pas, donc il ne se croit pas.

   ⚠️ TROIS PRÉCAUTIONS QUI CHANGENT LE RÉSULTAT

   1. « AUCUNE VISITE CONNUE » N'EST PAS « JAMAIS VISITÉE ». La date de
      dernière visite vient de trois sources incomplètes (le « vu le… » de
      l'équipe, les RDV JARVIS, les titres reconnus dans l'agenda). Une
      absence de date veut dire « je ne sais pas ». On l'écrit comme ça, et
      on ne la note pas plus fort qu'un vrai retard mesuré.

   2. RIEN N'EST ÉCARTÉ EN SILENCE. Les officines sans adresse mail, celles
      qui ont dit STOP, celles déjà relancées cette semaine sortent de la
      liste — et l'écran dit combien et pourquoi. Une liste tronquée sans
      le dire se lit comme une liste complète.

   3. LA BAISSE SE MESURE SUR DEUX TRIMESTRES, PAS SUR UN MOIS. Un mois
      creux dans une officine, c'est une commande passée le 2 au lieu du
      30. Comparer trois mois à trois mois enlève ce bruit.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function auj() { return new Date().toISOString().slice(0, 10); }

  var LOT = 25;             // ce qu'on pré-coche dans une campagne
  var REPOS_JOURS = 7;      // on ne re-sollicite pas sous 7 jours
  var RAYON_KM = 25;        // « voisine » d'une journée déjà commencée

  // ── Le portefeuille du commercial connecté ───────────────────────
  // Même recensement que l'écran Campagne : un seul endroit décide qui
  // appartient à qui, et le CIP dédoublonne clients et prospects.
  function moi() { return (V2.user && V2.user.commercial) ? String(V2.user.commercial) : ''; }

  function recenser() {
    var m = moi();
    if (!m || !window.V2CIBLE) return [];
    var siennes = (V2.pharmacies || []).filter(function (p) {
      return (p.comms || []).indexOf(m) >= 0;
    });
    var depts = {}, dl = [], i;
    for (i = 0; i < siennes.length; i++) {
      var d = String(siennes[i].cp || '').slice(0, 2);
      if (d.length === 2 && !depts[d]) { depts[d] = 1; dl.push(d); }
    }
    var D = window.PHARMA_FR || null;
    return window.V2CIBLE.recenser({
      pharmacies: siennes,
      national: D ? { p: D.p, seg: D.seg, grp: D.grp, comm: D.comm } : null,
      commercial: m, departements: dl,
      info: function (cip) { return V2.rdvInfo ? V2.rdvInfo(cip) : {}; }
    });
  }

  var MOIS_NOM = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function nomMois(k) { return MOIS_NOM[k % 12] + ' ' + Math.floor(k / 12); }
  // « juillet 2026 est écarté » en début de phrase : sans ça, minuscule après
  // un point. Le nom du mois vient d'une table, il n'a rien à échapper — mais
  // on passe quand même par esc(), par principe.
  function majuscule(t) { var x = esc(t); return x.charAt(0).toUpperCase() + x.slice(1); }

  // ── Les achats, en UN passage ────────────────────────────────────
  // ⚠️ V2.rdvCA balaie les 437 000 lignes à chaque appel : 691 appels
  // figeraient l'écran plusieurs secondes sur un téléphone.
  // On produit d'un coup le cumul et les deux trimestres à comparer.
  //
  // ⚠️⚠️ LE PIÈGE QUI A FABRIQUÉ DE FAUSSES BAISSES — mesuré le 19/08/2026.
  // Le dernier mois du fichier de ventes est presque toujours INCOMPLET : le
  // 19/08, le réseau faisait 4,2 M€ par mois de janvier à juin, et 552 k€ en
  // juillet — 13 % d'un mois normal, parce que le fichier a été arrêté en
  // cours de mois. Comparer « les 3 derniers mois » aux 3 précédents plaçait
  // donc ce trou dans TOUTES les officines : la première version de cet écran
  // annonçait « ses achats ont baissé de 92 % » pour une officine qui n'avait
  // rien changé. Un signal faux est pire qu'un signal absent, parce qu'on le
  // croit.
  //
  // On écarte donc les mois de queue dont le total RÉSEAU tombe sous 60 % de
  // la médiane — le réseau entier ne perd pas 40 % en un mois, c'est un mois
  // tronqué. Le dernier mois retenu ancre les deux fenêtres, et l'écran DIT
  // lesquelles il a comparées.
  function achats() {
    var s = V2.sales || [], m = {}, i, parMois = {};
    for (i = 0; i < s.length; i++) {
      if (!s[i].month || !s[i].year) continue;
      var mk0 = s[i].year * 12 + (s[i].month - 1);
      parMois[mk0] = (parMois[mk0] || 0) + (s[i].mntNetHt || 0);
    }
    var cles = Object.keys(parMois).map(Number).sort(function (a, b) { return a - b; });
    var totaux = cles.map(function (k) { return parMois[k]; }).slice().sort(function (a, b) { return a - b; });
    var mediane = totaux.length ? totaux[Math.floor(totaux.length / 2)] : 0;

    var complets = cles.slice(), ecartes = [];
    while (complets.length && parMois[complets[complets.length - 1]] < mediane * 0.6) {
      ecartes.push(complets.pop());
    }
    var ancre = complets.length ? complets[complets.length - 1] : null;
    // Six mois COMPLETS, pas six mois de fichier. Sans ça on ne compare rien :
    // mieux vaut une raison de moins qu'une raison fausse.
    var comparable = complets.length >= 6 && ancre != null;

    for (i = 0; i < s.length; i++) {
      var v = s[i], k = String(v.pharmacyId);
      if (!m[k]) m[k] = { total: 0, recent: 0, avant: 0 };
      m[k].total += (v.mntNetHt || 0);
      if (comparable && v.month && v.year) {
        var mk = v.year * 12 + (v.month - 1);
        if (mk <= ancre && mk > ancre - 3) m[k].recent += (v.mntNetHt || 0);
        else if (mk <= ancre - 3 && mk > ancre - 6) m[k].avant += (v.mntNetHt || 0);
      }
    }
    return {
      par: m, comparable: comparable,
      periode: comparable
        ? { recent: [nomMois(ancre - 2), nomMois(ancre)], avant: [nomMois(ancre - 5), nomMois(ancre - 3)] }
        : null,
      moisEcartes: ecartes.sort().map(nomMois),
      moisComplets: complets.length
    };
  }

  function moisDepuis(cip) { return V2.rdvMoisDepuis ? V2.rdvMoisDepuis(cip) : null; }

  // ── Le score, et surtout SA raison ───────────────────────────────
  // Chaque point marqué produit une phrase. Un score sans phrase serait un
  // classement qu'on ne peut pas contredire — donc qu'on ne peut pas croire.
  function noter(o, ach, tens, datesUtiles) {
    var pts = 0, raisons = [];

    var mois = moisDepuis(o.cip);
    if (mois == null) {
      // Absence de donnée, pas absence de visite. Notée bien plus bas qu'un
      // retard mesuré, précisément parce qu'on n'en sait rien.
      //
      // ⚠️ Et quand la donnée manque pour TOUT LE MONDE — c'était le cas le
      // 19/08/2026, une seule visite enregistrée pour 1 241 officines — cette
      // ligne n'apparaît plus du tout : répéter « aucune visite connue » sur
      // les 25 lignes ne distingue rien, ça remplit l'écran d'un mot qui ne
      // dit rien. Le bandeau du haut le dit une fois, correctement.
      if (datesUtiles) {
        pts += 8;
        raisons.push('aucune visite connue dans JARVIS');
      }
    } else if (mois >= 12) { pts += 38; raisons.push('pas vue depuis plus d’un an'); }
    else if (mois >= 6)    { pts += 26; raisons.push('pas vue depuis ' + mois + ' mois'); }
    else if (mois >= 3)    { pts += 12; raisons.push('pas vue depuis ' + mois + ' mois'); }

    var a = ach.par[o.cip] || { total: 0, recent: 0, avant: 0 };
    // Une baisse ne veut rien dire sous un volume plancher : passer de 40 € à
    // 20 € n'est pas un décrochage, c'est une boîte de moins.
    if (ach.comparable && a.avant >= 500) {
      var baisse = (a.avant - a.recent) / a.avant;
      if (baisse >= 0.25) {
        pts += 30;
        raisons.push('ses achats ont baissé de ' + Math.round(baisse * 100) +
                     ' % sur trois mois');
      }
    }
    // On mène par NOTRE stock, comme dans le mail : c'est le fait vérifiable
    // et actionnable. Le fichier ANSM liste des SIGNALEMENTS sur ~18 mois, pas
    // l'état du jour — d'où « signalées », et jamais « sont en tension ».
    if (tens.dispo > 0) {
      pts += 18;
      raisons.push(tens.dispo + ' référence' + (tens.dispo > 1 ? 's' : '') +
                   ' qu’elle achète, signalée' + (tens.dispo > 1 ? 's' : '') +
                   ' en tension par l’ANSM, ' + (tens.dispo > 1 ? 'sont' : 'est') +
                   ' en stock chez nous');
    }
    // À poids égal, on va voir celle qui pèse. Le chiffre d'affaires départage,
    // il ne décide pas — sinon la liste ne contiendrait que les dix mêmes.
    if (a.total > 0) pts += Math.min(10, a.total / 5000);

    return { pts: pts, raisons: raisons, ca: a.total };
  }

  /**
   * Compose la liste. Renvoie une promesse.
   * { liste:[…], ecartes:{stop, sansMail, rdvPris, relanceRecente}, sansCommercial:bool }
   */
  V2.rdvRadar = {
    calculer: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve({ liste: [], ecartes: {}, horsService: true });
      if (!moi()) return Promise.resolve({ liste: [], ecartes: {}, sansCommercial: true });

      return Promise.all([
        V2.rdvSources(),
        V2.rdvVuCharger(),
        c.rpc('rdv_opposes'),
        c.from('rdv').select('cip').eq('user_id', u).eq('statut', 'confirme').gte('date', auj()),
        // Déjà sollicitée récemment : le lien vit 21 jours, la relancer avant
        // 7 jours n'est pas de l'insistance, c'est du bruit. Même seuil que
        // le hub et que l'envoi groupé.
        c.from('rdv_lien').select('cip, envoye_le').eq('user_id', u)
          .gte('envoye_le', new Date(Date.now() - REPOS_JOURS * 864e5).toISOString())
      ]).then(function (r) {
        var stop = {}, pris = {}, recent = {};
        ((r[2] && r[2].data) || []).forEach(function (x) {
          stop[String(x && x.cip != null ? x.cip : x)] = 1;
        });
        ((r[3] && r[3].data) || []).forEach(function (x) { if (x.cip) pris[String(x.cip)] = 1; });
        ((r[4] && r[4].data) || []).forEach(function (x) { if (x.cip) recent[String(x.cip)] = 1; });

        var pool = recenser();
        var ach = achats();
        var ec = { stop: 0, sansMail: 0, rdvPris: 0, relanceRecente: 0 };
        var out = [], i, retenues = [], vues = 0;

        for (i = 0; i < pool.length; i++) {
          var o = pool[i], cip = String(o.cip);
          if (stop[cip])   { ec.stop++; continue; }
          if (pris[cip])   { ec.rdvPris++; continue; }
          if (recent[cip]) { ec.relanceRecente++; continue; }
          // Sans adresse mail, on ne peut pas l'inviter : elle sort de CETTE
          // liste, et l'écran le dit. Elle n'est pas perdue — elle relève du
          // téléphone, pas d'une campagne.
          if (!o.email) { ec.sansMail++; continue; }
          retenues.push(o);
          if (moisDepuis(cip) != null) vues++;
        }

        // Deux passages, et c'est nécessaire : le poids de « aucune visite
        // connue » dépend de la couverture GLOBALE, qu'on ne connaît qu'après
        // avoir parcouru toute la liste.
        var couverture = retenues.length ? vues / retenues.length : 0;
        var datesUtiles = vues >= 3 && couverture >= 0.05;

        for (i = 0; i < retenues.length; i++) {
          var r2 = retenues[i], c2 = String(r2.cip);
          var tens = V2.rdvTension ? V2.rdvTension(c2) : { n: 0, dispo: 0 };
          var n = noter(r2, ach, tens, datesUtiles);
          if (!n.raisons.length) continue;      // aucune raison = aucune ligne
          out.push({
            cip: c2, nom: r2.nom || '', ville: r2.ville || '',
            type: r2.type || 'client', email: r2.email,
            pts: n.pts, raisons: n.raisons, ca: n.ca
          });
        }
        out.sort(function (a, b) { return b.pts - a.pts; });
        return { liste: out, ecartes: ec, comparable: ach.comparable,
                 periode: ach.periode, moisEcartes: ach.moisEcartes,
                 vues: vues, retenues: retenues.length, datesUtiles: datesUtiles,
                 total: pool.length };
      }).catch(function () {
        return { liste: [], ecartes: {}, panne: true };
      });
    },

    // ── La journée qui se remplit ──────────────────────────────────
    // Un rendez-vous posé fixe une zone. Les officines autour, sans rendez-vous
    // et joignables par mail, sont exactement celles qu'il faut inviter pour
    // que la journée serve à quelque chose. C'est la règle « aimant » du moteur
    // de créneaux, prise par l'autre bout : là on choisit les créneaux à partir
    // de l'officine, ici on choisit les officines à partir de la journée.
    voisines: function (rdvsDuJour) {
      var pts = (rdvsDuJour || []).filter(function (d) {
        return typeof d.lat === 'number' && typeof d.lon === 'number';
      });
      if (!pts.length) return Promise.resolve({ liste: [], sansPosition: true });

      var lat = 0, lon = 0, i;
      for (i = 0; i < pts.length; i++) { lat += pts[i].lat; lon += pts[i].lon; }
      lat /= pts.length; lon /= pts.length;

      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve({ liste: [] });

      return Promise.all([
        V2.rdvSources(),
        c.rpc('rdv_opposes'),
        c.from('rdv').select('cip').eq('user_id', u).eq('statut', 'confirme').gte('date', auj())
      ]).then(function (r) {
        var stop = {}, pris = {};
        ((r[1] && r[1].data) || []).forEach(function (x) {
          stop[String(x && x.cip != null ? x.cip : x)] = 1;
        });
        ((r[2] && r[2].data) || []).forEach(function (x) { if (x.cip) pris[String(x.cip)] = 1; });

        var pool = recenser(), out = [], k;
        for (k = 0; k < pool.length; k++) {
          var o = pool[k], cip = String(o.cip);
          if (stop[cip] || pris[cip] || !o.email) continue;
          var info = V2.rdvInfo ? V2.rdvInfo(cip) : null;
          if (!info || info.lat == null || info.lon == null) continue;
          var d = km(lat, lon, info.lat, info.lon);
          if (d > RAYON_KM) continue;
          out.push({ cip: cip, nom: o.nom || info.nom || '', ville: o.ville || info.ville || '',
                     type: o.type || 'client', km: d });
        }
        out.sort(function (a, b) { return a.km - b.km; });
        return { liste: out };
      }).catch(function () { return { liste: [] }; });
    },

    // Bascule vers la campagne, liste déjà cochée. On ne réécrit pas l'envoi :
    // JARVIS prépare, le commercial relit et envoie depuis SA boîte.
    versCampagne: function (cips) {
      if (!cips || !cips.length) { V2.toast('Aucune officine à préparer.'); return; }
      V2.campagnePreselection = cips.map(String);
      V2.go('campagne');
    }
  };

  // Distance à vol d'oiseau, en kilomètres. Suffisant pour un rayon : la route
  // réelle est calculée par l'Organisateur de tournée, qui a OSRM.
  function km(la1, lo1, la2, lo2) {
    var R = 6371, p = Math.PI / 180;
    var dLa = (la2 - la1) * p, dLo = (lo2 - lo1) * p;
    var a = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
            Math.cos(la1 * p) * Math.cos(la2 * p) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // ── Écran ────────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('v2-rad-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rad-css';
    s.textContent = [
      '.rad-hero{margin:8px 0 16px}',
      '.rad-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.rad-hero p{color:var(--muted);font-size:14px;max-width:60ch;margin:0;line-height:1.55}',
      '.rad-sec{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;',
      '  color:var(--muted);margin:22px 0 9px}',
      '.rad-l{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);',
      '  padding:12px 14px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start}',
      '.rad-r{flex:0 0 auto;width:30px;height:30px;border-radius:9px;background:var(--card-2);',
      '  border:1px solid var(--line);display:flex;align-items:center;justify-content:center;',
      '  font-size:13px;font-weight:800;color:var(--muted)}',
      '.rad-c{min-width:0;flex:1}',
      '.rad-c b{display:block;font-size:15.5px;letter-spacing:-.01em}',
      '.rad-v{color:var(--muted);font-size:13px;margin:2px 0 0}',
      '.rad-p{margin:7px 0 0;font-size:13.5px;line-height:1.5}',
      '.rad-p span{display:block}',
      '.rad-tag{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 7px;border-radius:6px;',
      '  background:var(--card-2);border:1px solid var(--line);color:var(--muted);margin-left:7px;',
      '  vertical-align:middle}',
      '.rad-bar{position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--line);',
      '  padding:12px 0 16px;margin-top:18px;display:flex;flex-wrap:wrap;gap:9px;align-items:center}',
      '.rad-bar .v2-btn{min-height:44px}',
      '.rad-note{color:var(--muted);font-size:13px;line-height:1.55;margin:12px 0 0}',
      '.rad-vide{color:var(--muted);font-size:14px;line-height:1.6;padding:16px 2px}'
    ].join('');
    document.head.appendChild(s);
  }

  function ligne(o, rang) {
    return '<div class="rad-l">' +
      '<div class="rad-r">' + rang + '</div>' +
      '<div class="rad-c">' +
        '<b>' + esc(o.nom) +
          (o.type === 'prospect' ? '<span class="rad-tag">prospect</span>' : '') + '</b>' +
        '<p class="rad-v">' + esc(o.ville) +
          (o.ca > 0 ? ' · ' + esc(V2.fmtEur ? V2.fmtEur(o.ca) : Math.round(o.ca) + ' €') +
            ' cette année' : '') + '</p>' +
        '<p class="rad-p">' + o.raisons.map(function (t) {
          return '<span>· ' + esc(t) + '</span>';
        }).join('') + '</p>' +
      '</div></div>';
  }

  function ecartesTexte(ec, comparable, per, ecMois) {
    var b = [];
    if (ec.rdvPris) b.push(ec.rdvPris + ' ' + (ec.rdvPris > 1 ? 'ont' : 'a') + ' déjà un rendez-vous');
    if (ec.relanceRecente) b.push(ec.relanceRecente + ' ' + (ec.relanceRecente > 1 ? 'ont' : 'a') +
      ' reçu un lien il y a moins de 7 jours');
    if (ec.sansMail) b.push(ec.sansMail + ' ' + (ec.sansMail > 1 ? 'n’ont' : 'n’a') +
      ' pas d’adresse mail connue — celles-là se travaillent au téléphone');
    if (ec.stop) b.push(ec.stop + ' ' + (ec.stop > 1 ? 'ont' : 'a') + ' demandé à ne plus être sollicitée');
    var t = b.length
      ? '<p class="rad-note"><b>Écartées de cette liste :</b> ' + esc(b.join(' · ')) + '.</p>'
      : '';
    if (!comparable) {
      t += '<p class="rad-note">La baisse d’achats n’est <b>pas</b> calculée : il faut six mois ' +
           'complets de ventes pour comparer deux trimestres.</p>';
    } else if (per) {
      t += '<p class="rad-note">Baisse mesurée sur <b>' + esc(per.recent[0]) + ' – ' +
           esc(per.recent[1]) + '</b> contre <b>' + esc(per.avant[0]) + ' – ' +
           esc(per.avant[1]) + '</b>.' +
           (ecMois && ecMois.length
             ? ' <b>' + majuscule(ecMois.join(', ')) + '</b> ' +
               (ecMois.length > 1 ? 'sont écartés' : 'est écarté') +
               ' : le mois n’est pas complet dans le fichier de ventes, il ferait baisser tout le monde.'
             : '') + '</p>';
    }
    // ⚠️ Un signal absent ne doit pas passer pour un signal négatif. Les deux
    // fichiers (tensions ANSM, stock Intégral) sont chargés par index.html avec
    // le reste, donc ce message ne devrait jamais s'afficher — s'il apparaît,
    // c'est qu'un chargement a échoué, et c'est exactement ce qu'il faut savoir
    // avant de conclure « aucune officine n'a de rupture ».
    if (!window.RUPTURES || !window.STOCK_IP) {
      t += '<p class="rad-note"><b>Les ruptures ne sont pas prises en compte ici</b> : ' +
           'le fichier des tensions ANSM ou celui du stock ne s’est pas chargé. ' +
           'Recharge la page — les autres signaux, eux, sont bien calculés.</p>';
    }
    return t;
  }

  V2.pages.rdvradar = {
    render: function (root) {
      css();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      var hero = '<div class="rad-hero"><h1>Qui inviter</h1>' +
        '<p>La liste se compose toute seule : depuis quand tu ne l’as pas vue, si ses ' +
        'achats décrochent, et si elle achète des références aujourd’hui en tension ' +
        'dont nous avons du stock. Chaque ligne dit pourquoi elle est là.</p></div>';

      root.innerHTML = top + '<div class="v2-wrap narrow">' + hero +
        '<p class="rad-vide">Lecture de ton portefeuille…</p></div>';

      V2.rdvRadar.calculer().then(function (r) {
        var corps;
        if (r.sansCommercial) {
          corps = '<p class="rad-vide">Ton compte n’est rattaché à aucun secteur. ' +
            'Sans ça, JARVIS ne sait pas quelles officines sont les tiennes — et proposer ' +
            'celles de toute l’équipe serait pire que ne rien proposer.</p>';
        } else if (r.panne) {
          corps = '<p class="rad-vide">Lecture impossible pour le moment. Réessaie dans un instant.</p>';
        } else if (!r.liste.length) {
          corps = '<p class="rad-vide">Aucune officine ne ressort aujourd’hui. C’est plutôt ' +
            'bon signe : celles que tu n’as pas vues depuis longtemps ont déjà un rendez-vous ' +
            'ou un lien en cours.</p>' +
            ecartesTexte(r.ecartes || {}, r.comparable, r.periode, r.moisEcartes);
        } else {
          // ⚠️ « Aucune visite connue » sur TOUTES les lignes n'est pas un
          // résultat, c'est une donnée manquante. Mesuré le 19/08/2026 : la
          // table des visites contenait UNE ligne pour tout le réseau. Sans
          // ce bandeau, le classement passerait pour un jugement sur le
          // terrain alors qu'il ne repose que sur les achats.
          var manque = r.datesUtiles ? '' :
            '<p class="rad-note"><b>JARVIS ne connaît ' +
              (r.vues === 0
                ? 'aucune de tes dates de visite'
                : r.vues === 1
                  ? 'qu’une seule de tes dates de visite, sur ' + r.retenues + ' officines'
                  : 'que ' + r.vues + ' de tes dates de visite, sur ' + r.retenues +
                    ' officines') + '.</b> ' +
            'Le classement ci-dessous ne repose donc que sur les achats et le stock, ' +
            'et « depuis quand tu ne l’as pas vue » n’y pèse rien. ' +
            'Deux gestes le remplissent : <b>« J’y suis allé »</b> après un rendez-vous, ' +
            'et ouvrir <a href="#" onclick="V2.go(\'rdvplanning\');return false">Mon agenda</a>, ' +
            'qui reconnaît les officines dans les titres de ton agenda personnel.</p>';
          var lot = r.liste.slice(0, LOT);
          var cips = lot.map(function (o) { return o.cip; });
          corps = manque +
            '<div class="rad-sec">' + lot.length + ' officines, la plus urgente en haut</div>' +
            lot.map(function (o, i) { return ligne(o, i + 1); }).join('') +
            (r.liste.length > LOT
              ? '<p class="rad-note">' + (r.liste.length - LOT) + ' autres officines ressortent ' +
                'aussi. On s’arrête à ' + LOT + ' : c’est la taille d’un lot d’envoi groupé, ' +
                'et au-delà les messageries d’officine trient en indésirable.</p>'
              : '') +
            ecartesTexte(r.ecartes || {}, r.comparable, r.periode, r.moisEcartes) +
            '<div class="rad-bar">' +
              '<button class="v2-btn v2-btn-primary" onclick="V2.rdvRadar.versCampagne(' +
                esc(JSON.stringify(cips)).replace(/"/g, '&quot;') + ')">' +
                'Préparer la campagne avec ces ' + lot.length + '</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'campagne\')">' +
                'Choisir moi-même</button>' +
            '</div>';
        }
        root.innerHTML = top + '<div class="v2-wrap narrow">' + hero + corps + '</div>';
      });
    }
  };
})();

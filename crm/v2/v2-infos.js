/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier « Infos du matin » (pages.infos) — L'ÉDITION DU MATIN

   Ce n'est plus un agrégateur de flux : c'est une ÉDITION. Le robot
   generate_brief.py lit chaque matin les 11 fichiers déjà produits par les
   autres robots (presse pro, ANSM, Journal officiel, avis de prix CEPS, HAS,
   EMA, épidémio, urgences, rappels de lots, veille concurrents), regroupe les
   doublons, note l'importance pour un grossiste-répartiteur, et écrit
   brief-jour.json + brief-archive.json.

   L'écran le met en page :
     LA UNE            — le sujet du jour, en grand, avec son angle métier
     LES 5 QUI COMPTENT— le reste du top, numéroté
     LE RADAR          — les chiffres du jour, tous mesurés, avec leur source
     TES MARGES        — Journal officiel, avec compte à rebours (hors filtres)
     OPPORTUNITÉS      — rupture × catalogue Intégral (calculé ICI, jamais publié)
     RUPTURES / RAPPELS— les rubriques de terrain
     LE FIL            — tout le reste, cherchable et filtrable par thème
     LES MATINS D'AVANT— l'archive, 120 éditions

   Design « Brief calme » : fond clair, un accent par thème, zéro emoji
   (iconographie ICO maison). Se lit en 30 secondes, se fouille en 3 minutes.

   ⚠️ brief-jour.json est PUBLIC (dépôt GitHub Pages) : il ne contient que de
      l'information publique. Tout ce qui est prix / remise / stock Intégral est
      calculé ici, dans le navigateur, à partir du catalogue déjà chargé.

   25/09/2026 — nouveau bloc « Dans ton secteur », juste après la tête : les
   annonces Bodacc (generate_bodacc_secteur.py → bodacc-secteur.json, public)
   sur les officines de ses départements, avec étiquette client/prospect
   calculée ici (jamais publiée) et bascule de secteur réservée à la direction.

   25/09/2026 (soir) — choix de Will : « v4 · Le brief en 5 cartes », remplacé la
   même nuit par la page ENTIÈRE refaite (« c'est toute la page entière qu'on doit
   refaire ») : choix de Will « m1 · Le poste de pilotage » (maquette
   ~/maquette-infos-page-entiere/m1.html). Un tableau de bord de neuf tuiles vivantes
   (Ton secteur, À ne pas manquer, Ruptures, À la une, Le radar du jour, L'essentiel
   en 30 s, Concurrents, Rappels de lot, Le mur), chacune avec son chiffre et son
   visuel ; toucher une tuile ouvre toute sa matière dans un panneau avec une pile
   (« Revenir »). Plus de « Tout le reste » : tout l'inventaire est à un ou deux
   touchers. Les cinq cartes et le repli « Tout le reste » sont retirés.

   08/10/2026 — choix de Will : la maquette 13 « La une » (calquée sur Apple News) remplace
   l'en-tête « Le poste de pilotage » et la mosaïque des neuf tuiles : la date en grand, UNE
   grande carte, quatre cartes compactes, « Tendances » numérotées, « Tout voir ». Une carte
   touchée s'agrandit en feuille de lecture (posée dans <body>). RIEN ne disparaît : les onze
   panneaux (secteur, échéances, ruptures, rappels, concurrents, radar, mur, archive, sources…)
   et leur pile sont intacts ; on y entre par les pastilles « Rubriques », repliées en bas de
   page derrière un seul bouton avec « Copier le brief » et la fraîcheur des sources (choix de
   Will, 08/10/2026 : la page au téléphone était trop longue). Les faits concurrents vérifiés
   sont chargés pendant load() (4 s au plus, jamais bloquants).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  // 03/09/2026 — un lien de flux scrapé ne doit jamais porter un schéma
  // exécutable (javascript:, data:). On n'accepte que http(s), sinon '#'.
  function urlSure(u) {
    var t = String(u == null ? '' : u).trim();
    return /^https?:\/\//i.test(t) ? t : '#';
  }

  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var ICO = window.ICO || function () { return ''; };
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  function cap(s) { s = String(s == null ? '' : s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  var BRIEF = null, ARCHIVE = null, LOADED = false, FAILED = false;
  var SECTEUR = null;   // bodacc-secteur.json — jamais obligatoire, jamais bloquant
  var CONTOURS = null;  // departements-contours.json — jamais obligatoire : sert la carte du secteur (tuile et panneau)
  var VERIFS = null;    // faits concurrents vérifiés (V2.grossistesActuDonnees) — chargés pendant load(), 4 s au plus, null si rien n'arrive

  /* thème choisi au mur (mémorisé) */
  var TH_KEY = 'jarvis_brief_theme_v1';
  var THEME_SEL = (function () { try { return localStorage.getItem(TH_KEY) || ''; } catch (e) { return ''; } })();

  var COPY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  /* ════════════════ chargement ════════════════ */
  function load(cb) {
    if (LOADED) { cb(); return; }
    FAILED = false;   // nouvelle tentative à chaque entrée sur la page
    var day = ''; try { day = new Date().toISOString().slice(0, 10); } catch (e) {}
    var get = function (f, obligatoire) {
      return fetch(f + '?d=' + day, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .catch(function (e) { if (obligatoire) throw e; return null; });
    };
    /* ne bloque jamais : la page attend au plus 4 s, puis se dessine sans la rubrique Concurrents */
    var verifs = function () {
      return new Promise(function (ok) {
        var fait = false, fin = function (v) { if (fait) return; fait = true; ok(v); };
        setTimeout(function () { fin(null); }, 4000);
        try {
          if (!V2.grossistesActuDonnees) { fin(null); return; }
          V2.grossistesActuDonnees(function (a, v) { fin(v ? v.filter(function (x) { return !x.nonConfirme; }) : null); });
        } catch (e) { fin(null); }
      });
    };
    try {
      Promise.all([get('brief-jour.json', true), get('brief-archive.json', false), get('bodacc-secteur.json', false), get('departements-contours.json', false), verifs()])
        .then(function (res) { BRIEF = res[0]; ARCHIVE = res[1]; SECTEUR = res[2]; CONTOURS = res[3]; VERIFS = res[4]; LOADED = true; cb(); })
        .catch(function () { FAILED = true; cb(); });
    } catch (e) { FAILED = true; cb(); }
  }

  /* ════════════════ dates ════════════════ */
  function joDateFr(iso) {
    try {
      var d = new Date(iso + 'T00:00:00');
      var s = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      return d.getDate() === 1 ? s.replace(/^1 /, '1er ') : s;
    } catch (e) { return iso; }
  }
  function ilYA(iso) {
    var j;
    try { j = Math.round((new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00') - new Date(iso + 'T00:00:00')) / 86400000); }
    catch (e) { return ''; }
    if (j === null || isNaN(j)) return '';
    if (j <= 0) return "aujourd'hui";
    if (j === 1) return 'hier';
    if (j < 7) return 'il y a ' + j + ' jours';
    return joDateFr(iso);
  }
  function topDate() {
    try {
      var d = new Date(), s = cap(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
      return d.getDate() === 1 ? s.replace(/ 1 /, ' 1er ') : s;
    } catch (e) { return ''; }
  }

  /* ════════════════ copier le brief (WhatsApp / mail) ════════════════
     Veille pure : AUCUN prix, AUCUN abandon de marge, AUCUNE donnée Intégral —
     ce texte peut finir chez un pharmacien. */
  function fallbackCopy(txt) { try { var ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } catch (e) {} }
  V2.infosCopyBrief = function (btn) {
    if (!BRIEF) return;
    var L = [];
    L.push("L'édition du matin — " + topDate());
    var ep = BRIEF.epingles || [];
    if (ep.length) {
      L.push('', 'À NE PAS MANQUER');
      ep.forEach(function (e) {
        var q = (e.motif === 'echeance')
          ? (e.jours !== null && e.jours >= 0 ? 'dans ' + e.jours + ' jours' : 'déjà applicable')
          : 'concurrent';
        L.push('- [' + q + '] ' + e.t);
        if (e.r) L.push('  ' + e.r);
        if (e.u) L.push('  ' + e.u);
      });
    }
    (BRIEF.cinq || []).forEach(function (c, i) {
      L.push('', (i + 1) + '. ' + c.t);
      if (c.r) L.push('   ' + c.r);
      var meta = [];
      if (c.srcs && c.srcs.length) meta.push(c.srcs.slice(0, 3).join(', '));
      if (c.faits && c.faits.length) meta.push(c.faits.join(' · '));
      if (meta.length) L.push('   (' + meta.join(' — ') + ')');
      if (c.u) L.push('   ' + c.u);
    });
    var R = BRIEF.radar || [];
    if (R.length) {
      L.push('', 'Le radar du jour :');
      R.forEach(function (r) { L.push('- ' + r.v + (r.unite || '') + ' ' + r.l + ' (' + r.src + ')'); });
    }
    var txt = L.join('\n');
    var ok = function () {
      if (V2.toast) V2.toast('Brief copié ✅');
      if (btn) { var t = btn.getAttribute('data-lbl') || 'Copier le brief'; btn.innerHTML = 'Copié ✅'; setTimeout(function () { btn.innerHTML = COPY_SVG + t; }, 1500); }
    };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () { fallbackCopy(txt); ok(); }); else { fallbackCopy(txt); ok(); } }
    catch (e) { fallbackCopy(txt); ok(); }
  };

  /* ════════════════ « EST-CE UN DE MES CLIENTS ? » ════════════════
     Une officine en redressement judiciaire, c'est un encours qui peut ne jamais
     rentrer. Le rapprochement se fait ICI, dans le navigateur, contre V2.pharmacies
     (le fichier clients chargé au démarrage). Rien de tout ceci ne part dans
     brief-jour.json, qui est public. */
  var MOTS_VIDES = { pharmacie: 1, pharmacies: 1, phie: 1, selarl: 1, sarl: 1, sas: 1, sa: 1,
                     eurl: 1, snc: 1, scp: 1, societe: 1, exploitation: 1, officine: 1, de: 1,
                     du: 1, des: 1, la: 1, le: 1, les: 1, et: 1, aux: 1, saint: 1, sainte: 1 };
  function motsUtiles(x) {
    return norm(x).replace(/[^a-z0-9]+/g, ' ').split(' ')
      .filter(function (m) { return m.length > 3 && !MOTS_VIDES[m]; });
  }
  /* ⚠️ « PHARMACIE CENTRALE » existe dans presque chaque ville : le nom seul ne
     prouve rien. Même règle que « Dans ton secteur » (sctMatchClient, choix de
     Will le 25/09/2026) : SON portefeuille, même lieu, mots rares du nom, UN seul
     candidat. Jusqu'au 25/09 la ville était cherchée dans le NOM de l'officine :
     presque aucun client n'était reconnu.
     ⚠️ FINESS donne un CODE INSEE (« 63315 »), pas un nom de ville : on se
     rabat alors sur le département du code. */
  function clientTouche(nomSociete, ville) {
    if (!nomSociete) return null;
    var v = String(ville || '').trim();
    if (/^(\d{2}|2[ab])\d{3}$/i.test(v)) {
      var dep = /^97/.test(v) ? v.slice(0, 3) : /^2[ab]/i.test(v) ? '20' : v.slice(0, 2);
      return sctMatchClient(nomSociete, '', '', dep);
    }
    return sctMatchClient(nomSociete, v, '');
  }

  /* ════════════════ « DANS TON SECTEUR » (Bodacc) ════════════════
     Maquette validée par Will le 25/09/2026. Le robot generate_bodacc_secteur.py
     dépose chaque matin crm/v2/bodacc-secteur.json (annonces légales publiques,
     5 familles). Tout le reste — secteur du commercial, étiquette client/prospect,
     tri — est calculé ICI, dans le navigateur, à partir de V2.pharmacies (jamais
     publié). Le fichier ne doit JAMAIS écraser le fonctionnement du reste de la
     page : son absence, son vide, ou une erreur de lecture ne font que masquer
     ce seul bloc. */
  var SCT_FAM = {
    cession:   { l: 'Ventes', l1: 'Vente de l’officine', c: '--ip-blue', ct: '--ip-blue',
      ico: '<path d="M15 7a4 4 0 1 1-4.9 3.9L3 18v3h3v-2h2v-2h2l1.1-1.1A4 4 0 0 1 15 7z"/><circle cx="16" cy="8" r="1"/>' },
    procedure: { l: 'Redressements', l1: 'Procédure au tribunal', c: '--c-rose', ct: '--c-rose-txt',
      ico: '<path d="M12 3l9 16H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>' },
    creation:  { l: 'Nouvelles sociétés', l1: 'Nouvelle société', c: '--c-opp', ct: '--c-mint-txt',
      ico: '<path d="M12 5v14M5 12h14"/>' },
    fermeture: { l: 'Fermetures', l1: 'Fermeture', c: '--c-amber', ct: '--c-amber-txt',
      ico: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M2 21h20"/><path d="M11 12h.01"/><path d="M19 8l3 3-3 3"/>' },
    dirigeant: { l: 'Nouveaux dirigeants', l1: 'Nouveau dirigeant', c: '--c-cat', ct: '--c-cat',
      ico: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' }
  };
  var SCT_TAG_L = { client: 'Votre client', prospect: 'Votre prospect', hors: 'Hors fichier' };
  // table INSEE des départements — pour ÉTIQUETER un secteur par noms, jamais par
  // le prénom d'un membre de l'équipe (règle ferme, cf. AGENTS.md).
  var SCT_DEPNOMS = (function () {
    var s = "01:Ain,02:Aisne,03:Allier,04:Alpes-de-Haute-Provence,05:Hautes-Alpes,06:Alpes-Maritimes,07:Ardèche,08:Ardennes,09:Ariège,10:Aube,11:Aude,12:Aveyron,13:Bouches-du-Rhône,14:Calvados,15:Cantal,16:Charente,17:Charente-Maritime,18:Cher,19:Corrèze,2A:Corse-du-Sud,2B:Haute-Corse,21:Côte-d'Or,22:Côtes-d'Armor,23:Creuse,24:Dordogne,25:Doubs,26:Drôme,27:Eure,28:Eure-et-Loir,29:Finistère,30:Gard,31:Haute-Garonne,32:Gers,33:Gironde,34:Hérault,35:Ille-et-Vilaine,36:Indre,37:Indre-et-Loire,38:Isère,39:Jura,40:Landes,41:Loir-et-Cher,42:Loire,43:Haute-Loire,44:Loire-Atlantique,45:Loiret,46:Lot,47:Lot-et-Garonne,48:Lozère,49:Maine-et-Loire,50:Manche,51:Marne,52:Haute-Marne,53:Mayenne,54:Meurthe-et-Moselle,55:Meuse,56:Morbihan,57:Moselle,58:Nièvre,59:Nord,60:Oise,61:Orne,62:Pas-de-Calais,63:Puy-de-Dôme,64:Pyrénées-Atlantiques,65:Hautes-Pyrénées,66:Pyrénées-Orientales,67:Bas-Rhin,68:Haut-Rhin,69:Rhône,70:Haute-Saône,71:Saône-et-Loire,72:Sarthe,73:Savoie,74:Haute-Savoie,75:Paris,76:Seine-Maritime,77:Seine-et-Marne,78:Yvelines,79:Deux-Sèvres,80:Somme,81:Tarn,82:Tarn-et-Garonne,83:Var,84:Vaucluse,85:Vendée,86:Vienne,87:Haute-Vienne,88:Vosges,89:Yonne,90:Territoire de Belfort,91:Essonne,92:Hauts-de-Seine,93:Seine-Saint-Denis,94:Val-de-Marne,95:Val-d'Oise,971:Guadeloupe,972:Martinique,973:Guyane,974:La Réunion,976:Mayotte";
    var m = {}; s.split(',').forEach(function (p) { var kv = p.split(':'); m[kv[0]] = kv[1]; }); return m;
  })();
  function sctSvg(p, s) { return '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var SCT_PETIT = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, et: 1, sur: 1, en: 1, aux: 1, au: 1 };
  function sctJoli(s) {
    return String(s || '').toLowerCase().split(/(\s+|-)/).map(function (w, i) {
      if (/^\s+$|^-$/.test(w) || !w) return w;
      if (/^(selarl|selas|sarl|snc|spfpl|sas|eurl|spfplas|sa)$/.test(w)) return w.toUpperCase();
      var m = /^([dl]')(.*)$/.exec(w); if (m) return m[1] + m[2].charAt(0).toUpperCase() + m[2].slice(1);
      if (i > 0 && SCT_PETIT[w]) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('');
  }
  function sctJours(d) { try { return Math.round((new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00') - new Date(d + 'T00:00:00')) / 864e5); } catch (e) { return 9999; } }
  function sctQuand(d) {
    var n = sctJours(d);
    return n <= 0 ? 'aujourd’hui' : n === 1 ? 'hier' : n < 7 ? 'il y a ' + n + ' j' : n < 14 ? 'il y a 1 sem.' : n < 60 ? 'il y a ' + Math.floor(n / 7) + ' sem.' : 'il y a ' + Math.floor(n / 30) + ' mois';
  }
  function sctDateLongue(d) { try { return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return d; } }
  // ⚠️ le CP ne dit pas exactement le département pour la Corse et les DOM : on
  // applique la même convention que le champ `numerodepartement` du Bodacc.
  function sctDepDeCP(cp) {
    cp = String(cp || '').trim();
    if (!/^\d{5}$/.test(cp)) return '';
    if (cp.slice(0, 2) === '20') return parseInt(cp, 10) < 20200 ? '2A' : '2B';
    if (/^97[1234]|^976/.test(cp)) return cp.slice(0, 3);
    return cp.slice(0, 2);
  }

  var SCT_LU_KEY = 'jarvis_secteur_lu_v1';
  var SCT_LU = (function () { try { return JSON.parse(localStorage.getItem(SCT_LU_KEY) || '{}'); } catch (e) { return {}; } })();
  function sctSaveLu() { try { localStorage.setItem(SCT_LU_KEY, JSON.stringify(SCT_LU)); } catch (e) {} }

  var SCT_S = { scope: null, autre: -1, per: 90 };

  function sctEstDirection() { return !!(V2.user && V2.user.voitTousReel); }

  /* Ses départements : ceux où V2.pharmacies (WML_OFFICINES) lui donne au moins
     3 officines. Rien de tout ça n'est écrit en dur — recalculé à chaque visite. */
  function sctMonSecteur() {
    var mes = (V2.mesComms && V2.mesComms()) || [];
    if (!mes.length) return null;
    var liste = (window.V2 && V2.pharmacies) || [];
    var cnt = {};
    liste.forEach(function (p) {
      var comms = p.comms || [];
      if (!comms.some(function (c) { return mes.indexOf(c) >= 0; })) return;
      var d = sctDepDeCP(p.cp);
      if (d) cnt[d] = (cnt[d] || 0) + 1;
    });
    var deps = Object.keys(cnt).filter(function (d) { return cnt[d] >= 3; });
    return deps.length ? deps : null;
  }

  /* Les secteurs des AUTRES commerciaux — réservé à la direction. Étiquetés par
     départements, JAMAIS par prénom (aucun de ces libellés ne doit porter un nom). */
  function sctAutresSecteurs() {
    var liste = (window.V2 && V2.pharmacies) || [];
    var moi = (V2.mesComms && V2.mesComms()) || [];
    var parComm = {};
    liste.forEach(function (p) {
      (p.comms || []).forEach(function (c) {
        if (!c || moi.indexOf(c) >= 0 || V2.ESCALE_COMMS && V2.ESCALE_COMMS.indexOf(c) >= 0) return;
        var d = sctDepDeCP(p.cp);
        if (!d) return;
        parComm[c] = parComm[c] || {};
        parComm[c][d] = (parComm[c][d] || 0) + 1;
      });
    });
    var out = [];
    Object.keys(parComm).forEach(function (c) {
      var deps = Object.keys(parComm[c]).filter(function (d) { return parComm[c][d] >= 3; });
      if (!deps.length) return;
      var noms = deps.map(function (d) { return SCT_DEPNOMS[d] || d; }).sort();
      out.push({ l: noms.join(' · '), deps: deps });
    });
    // secteurs identiques regroupés (deux commerciaux sur le même secteur = une seule entrée)
    var vu = {}, res = [];
    out.forEach(function (o) { var k = o.deps.slice().sort().join(','); if (vu[k]) return; vu[k] = 1; res.push(o); });
    res.sort(function (a, b) { return a.l.localeCompare(b.l, 'fr'); });
    return res;
  }

  function sctDeps() {
    if (SCT_S.scope === 'fr') return null;
    if (SCT_S.scope === 'autre') { var a = sctAutresSecteurs()[SCT_S.autre]; return a ? a.deps : null; }
    return sctMonSecteur();
  }

  /* « Ton client / Ton prospect / Hors fichier » — calculé ICI, jamais publié.
     Client : sctMatchClient() ci-dessous (code postal ou ville + nom).
     Prospect : uniquement si la base nationale (PHARMA_FR) est DÉJÀ chargée par
     ailleurs — on ne déclenche jamais son chargement pour ce seul bloc. */
  function sctMatchProspect(nom, ville) {
    if (!(window.PHARMA_FR && window.PHARMA_FR.p)) return null;
    var mots = motsUtiles(nom); if (!mots.length) return null;
    var v = norm(ville || '').replace(/[^a-z0-9]+/g, ' ').trim();
    var P = window.PHARMA_FR.p, cands = [];
    for (var i = 0; i < P.length; i++) {
      var p = P[i], nomP = norm(p[6] || '').replace(/[^a-z0-9]+/g, ' ');
      if (!nomP.trim()) continue;
      var communs = 0;
      for (var k = 0; k < mots.length; k++) if (nomP.indexOf(mots[k]) >= 0) communs++;
      if (!communs) continue;
      var villeP = norm(p[7] || '').replace(/[^a-z0-9]+/g, ' ');
      if (v && villeP.indexOf(v) < 0) continue;
      cands.push({ p: p, n: communs });
    }
    if (!cands.length) return null;
    if (cands.length === 1) return cands[0].p;
    cands.sort(function (a, b) { return b.n - a.n; });
    return (cands[0].n > cands[1].n) ? cands[0].p : null;
  }
  /* Client : SON portefeuille (tout le fichier pour qui n'en a pas), même code
     postal ou même ville (ou, faute de mieux, même département : dep = début du
     code postal), au moins un mot rare du nom en commun, UN seul candidat. */
  function sctMatchClient(nom, ville, cp, dep) {
    // formes juridiques absentes de MOTS_VIDES, et mots de la ville (« Pharmacie de
    // Livry-Gargan » ne désigne pas une officine précise) ; deux mots rares = les deux exigés
    var v = norm(ville || '').replace(/[^a-z0-9]+/g, ' ').trim(), c = String(cp || '').trim();
    var mots = motsUtiles(nom).filter(function (m) {
      return !/^(selas|selafa|selarlu|spfpl|spfplas)$/.test(m) && (' ' + v + ' ').indexOf(' ' + m + ' ') < 0;
    });
    if (!mots.length) return null;
    var exige = Math.min(2, mots.length);
    var mes = (V2.mesComms && V2.mesComms()) || [];
    var liste = (window.V2 && V2.pharmacies) || [], cands = [];
    for (var i = 0; i < liste.length; i++) {
      var p = liste[i];
      if (mes.length && !(p.comms || []).some(function (x) { return mes.indexOf(x) >= 0; })) continue;
      var memeLieu = (c && String(p.cp || '').trim() === c) ||
        (v && norm(p.ville || '').replace(/[^a-z0-9]+/g, ' ').trim() === v) ||
        (dep && String(p.cp || '').trim().indexOf(dep) === 0);
      if (!memeLieu) continue;
      var nomP = norm(p.name || '').replace(/[^a-z0-9]+/g, ' '), communs = 0;
      for (var k = 0; k < mots.length; k++) if (nomP.indexOf(mots[k]) >= 0) communs++;
      if (communs >= exige) cands.push({ p: p, n: communs });
    }
    if (!cands.length) return null;
    if (cands.length === 1) return cands[0].p;
    cands.sort(function (a, b) { return b.n - a.n; });
    return (cands[0].n > cands[1].n) ? cands[0].p : null;
  }
  function sctTag(e) {
    var cli = sctMatchClient(e.nom, e.ville, e.cp);
    if (cli) return { t: 'client', ficheId: cli.id };
    var pr = sctMatchProspect(e.nom, e.ville);
    if (pr) return { t: 'prospect', ficheId: String(pr[13] || '') };
    // sans la base prospects chargée, on ne sait pas : pas d'étiquette plutôt qu'un « Hors fichier » faux
    return { t: (window.PHARMA_FR && window.PHARMA_FR.p) ? 'hors' : 'reste', ficheId: '' };
  }
  function sctGeste(e, t) {
    switch (e.f) {
      case 'cession': return t === 'client' ? 'Votre client change de mains : rencontrer le repreneur avant la concurrence.' : 'Nouveau titulaire : prendre rendez-vous dans le mois, il choisit ses fournisseurs maintenant.';
      case 'procedure': return t === 'client' ? 'Prudence sur l’encours : faire le point avec la direction avant la prochaine commande.' : 'Officine fragilisée : ses voisines peuvent récupérer une partie de sa patientèle.';
      case 'creation': return /SPFPL|HOLDING/i.test(e.nom) ? 'Des pharmaciens montent une holding : un rachat se prépare dans le secteur.' : 'Nouvelle société d’officine : une reprise ou une ouverture se prépare, se présenter tôt.';
      case 'fermeture': return 'Ses patients vont se répartir chez les voisines : appeler les officines les plus proches.';
      default: return t === 'client' ? 'Nouvel interlocuteur chez votre client : se présenter et reprendre le fil.' : 'Nouvel interlocuteur : bonne occasion de se présenter.';
    }
  }

  // la phrase du jour et la carte des concurrents suivent la MÊME portée que ce bloc
  V2.infosSecteur = function () { return { deps: sctDeps(), noms: SCT_DEPNOMS }; };

  /* ════════════════ LE POSTE DE PILOTAGE (25/09/2026, choix de Will · m1) ════════════════
     Maquette : ~/maquette-infos-page-entiere/m1.html. Toute l'édition sur un seul tableau
     de bord : neuf tuiles, chacune avec SON chiffre et SON visuel ; toucher une tuile ouvre
     toute sa matière dans un panneau (plein écran sur téléphone, volet droit au bureau),
     avec une pile et « Revenir » pour lire un article sans perdre la liste.
     Tout est calculé ICI, à chaque rendu, depuis les fichiers déjà chargés (BRIEF, SECTEUR,
     CONTOURS, ARCHIVE) et ceux des modules concurrents — rien en dur. Une donnée absente
     se dit sobrement dans sa tuile, jamais un trou ni un faux chiffre.
     ⚠️ Les annonces Bodacc n'ont PAS de coordonnées (code postal et ville seulement) :
        la carte du secteur place chaque annonce dans SON département (grappe de points
        rangée au centre du département), jamais à une position inventée. Les agences
        concurrentes, elles, ont une vraie latitude/longitude : elles sont à leur place. */

  /* couleurs de la maquette : une famille, une couleur, partout */
  var PP_FC = { dirigeant: '#0050E6', cession: '#1E9E6A', creation: '#00B5D8', fermeture: '#E0556E', procedure: '#C7791A' };
  var PP_TH = { marge: '#C7791A', remboursement: '#0050E6', generique: '#1E9E6A', rupture: '#E0556E', securite: '#BE3450',
    concurrence: '#6D4FC4', officine: '#0A7F99', industrie: '#465066', sante: '#157A51', autre: '#5E677A' };
  var PP_TON = { rose: '#E0556E', green: '#1E9E6A', blue: '#0050E6', amber: '#C7791A' };
  var PP_ORDRE_F = ['cession', 'dirigeant', 'creation', 'fermeture', 'procedure'];
  var PP_COURT = { cession: 'Ventes', dirigeant: 'Dirigeants', creation: 'Créations', fermeture: 'Fermetures', procedure: 'Difficultés' };   // libellés courts de la maquette
  var PP_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var PP_JS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function ppDc(d) { var p = String(d || '').slice(0, 10).split('-'); if (p.length < 3) return ''; return (+p[2] === 1 ? '1er' : +p[2]) + ' ' + PP_MOIS[+p[1] - 1]; }
  function ppDl(d) { var c = ppDc(d); return c ? c + ' ' + String(d).slice(0, 4) : ''; }
  function ppPl(n, s, p) { return n + ' ' + (n > 1 ? (p || s + 's') : s); }
  function ppJ(d) { return sctJours(String(d || '').slice(0, 10)); }   // jours écoulés depuis d (négatif = à venir)

  var PP_IC = {
    dirigeant: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    cession: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
    creation: '<path d="M12 5v14M5 12h14"/>',
    fermeture: '<path d="M4 21V5a2 2 0 0 1 2-2h8l6 6v12"/><path d="M9 13l6 6M15 13l-6 6"/>',
    procedure: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    prix: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    rupture: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/>',
    rappel: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 9v4M12 16h.01"/>',
    concurrent: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>',
    journal: '<path d="M4 4h12v16H6a2 2 0 0 1-2-2z"/><path d="M16 8h4v10a2 2 0 0 1-4 0M8 8h4M8 12h4M8 16h2"/>',
    chercher: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    suite: '<path d="M7 17L17 7M9 7h8v8"/>',
    lien: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    europe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    loi: '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
    bas: '<path d="M6 9l6 6 6-6"/>',
    sante: '<path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11z"/>',
    fiche: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>',
    copier: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    retour: '<path d="M15 5l-7 7 7 7"/>',
    fermer: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  function ppIco(n, s) { return sctSvg(PP_IC[n] || PP_IC.journal, s || 18); }

  /* ── géométrie : la projection de departements-contours.json ── */
  function ppBox(codes) {
    var B = [1e9, 1e9, -1e9, -1e9];
    codes.forEach(function (c) {
      var d = CONTOURS && CONTOURS.deps[c]; if (!d) return;
      var n = d.d.match(/-?\d+(?:\.\d+)?/g) || [];
      for (var i = 0; i + 1 < n.length; i += 2) {
        var x = +n[i], y = +n[i + 1];
        if (x < B[0]) B[0] = x; if (y < B[1]) B[1] = y; if (x > B[2]) B[2] = x; if (y > B[3]) B[3] = y;
      }
    });
    return B[2] < B[0] ? null : { x: B[0], y: B[1], w: B[2] - B[0], h: B[3] - B[1] };
  }
  var PP_CENTRES = {};
  function ppCentre(c) {   // moyenne des sommets : tombe à l'intérieur du département
    if (PP_CENTRES[c]) return PP_CENTRES[c];
    var n = ((CONTOURS && CONTOURS.deps[c]) || {}).d; n = (n || '').match(/-?\d+(?:\.\d+)?/g) || [];
    var sx = 0, sy = 0, k = 0;
    for (var i = 0; i + 1 < n.length; i += 2) { sx += +n[i]; sy += +n[i + 1]; k++; }
    return (PP_CENTRES[c] = k ? [sx / k, sy / k] : null);
  }
  function ppProj(lat, lon) { return [(lon - CONTOURS.lon0) * CONTOURS.c * CONTOURS.k, (CONTOURS.lat0 - lat) * CONTOURS.k]; }
  function ppCodesFrance() { return Object.keys((CONTOURS && CONTOURS.deps) || {}); }

  /* La carte : départements du secteur (teinte = nombre d'annonces), voisins en gris,
     et une grappe de points par département, rangée en grille (un point = une annonce,
     couleur = famille, pulsation = moins de 7 jours). En « Toute la France » : teinte seule. */
  var PP_PTS = [];   // points dessinés sur la carte du panneau : [x, y, annonce]
  function ppCarte(deps, evs, o) {
    if (!CONTOURS || !CONTOURS.deps) return '';
    var codes = (deps || ppCodesFrance()).filter(function (c) { return CONTOURS.deps[c]; });
    var B = ppBox(codes); if (!B) return '';
    var m = Math.max(B.w, B.h) * (deps ? 0.06 : 0.02);
    var V = { x: B.x - m, y: B.y - m, w: B.w + 2 * m, h: B.h + 2 * m };
    var u = Math.max(V.w, V.h) / (o.px || 360);
    var SS = {}; codes.forEach(function (c) { SS[c] = 1; });
    var cnt = {}, parDep = {}, max = 1;
    evs.forEach(function (e) { cnt[e.dep] = (cnt[e.dep] || 0) + 1; (parDep[e.dep] = parDep[e.dep] || []).push(e); });
    codes.forEach(function (c) { if (cnt[c] > max) max = cnt[c]; });
    var h = '<svg viewBox="' + [V.x, V.y, V.w, V.h].map(function (v) { return v.toFixed(0); }).join(' ') + '" preserveAspectRatio="xMidYMid meet"' + (o.attrs || ' aria-hidden="true"') + '>';
    if (deps) ppCodesFrance().forEach(function (c) {
      if (SS[c]) return;
      var b = ppBox([c]); if (!b || b.x > V.x + V.w || b.x + b.w < V.x || b.y > V.y + V.h || b.y + b.h < V.y) return;
      h += '<path class="pp-voisin" d="' + CONTOURS.deps[c].d + '"/>';
    });
    codes.forEach(function (c) {
      var n = cnt[c] || 0, a = deps ? (n ? 0.05 + 0.13 * n / max : 0) : (n ? 0.08 + 0.62 * n / max : 0.02);
      h += '<path class="pp-dep" data-dep="' + esc(c) + '" d="' + CONTOURS.deps[c].d + '" style="fill:' + (a ? 'rgba(0,80,230,' + a.toFixed(2) + ')' : '#FFFFFF') + '"><title>' + esc((SCT_DEPNOMS[c] || c) + ' · ' + ppPl(n, 'annonce')) + '</title></path>';
    });
    if (o.agences) o.agences.forEach(function (g) {
      if (g.lat == null || g.lon == null) return;
      var p = ppProj(g.lat, g.lon), s = 6 * u;
      h += '<rect x="' + (p[0] - s).toFixed(1) + '" y="' + (p[1] - s).toFixed(1) + '" width="' + (2 * s).toFixed(1) + '" height="' + (2 * s).toFixed(1) + '" rx="' + (1.5 * u).toFixed(1) + '" fill="' + (g.coul || '#6D4FC4') + '" stroke="#fff" stroke-width="' + (2.6 * u).toFixed(1) + '" transform="rotate(45 ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"/>';
    });
    if (o.pts) PP_PTS = [];
    if (deps) codes.forEach(function (c) {
      var L = parDep[c]; if (!L || !L.length) return;
      var ctr = ppCentre(c); if (!ctr) return;
      var col = Math.ceil(Math.sqrt(L.length)), lig = Math.ceil(L.length / col), bd = ppBox([c]);
      // la grappe reste dans son département : le pas se resserre si la grille est plus large que 55 % du département
      var pas = Math.min((o.r || 7) * u * 2.75, bd ? 0.55 * Math.min(bd.w / col, bd.h / lig) : 1e9), r = Math.min((o.r || 7) * u, pas / 2.4);
      L.forEach(function (e, i) {
        var cx = ctr[0] + ((i % col) - (col - 1) / 2) * pas, cy = ctr[1] + (Math.floor(i / col) - (lig - 1) / 2) * pas;
        var f = PP_FC[e.f] || PP_FC.dirigeant;
        if (ppJ(e.d) <= 7) h += '<circle class="pp-halo" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (r * 1.6).toFixed(1) + '" fill="' + f + '"/>';
        h += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + f + '" stroke="#fff" stroke-width="' + (r * 0.42).toFixed(1) + '"/>';
        if (o.pts) PP_PTS.push([cx, cy, e]);
      });
    });
    if (!deps && o.pts) codes.forEach(function (c) {   // France : le chiffre posé sur chaque département qui bouge
      var n = cnt[c]; if (!n || n / max < 0.34) return; var ctr = ppCentre(c); if (!ctr) return;
      h += '<text x="' + ctr[0].toFixed(0) + '" y="' + (ctr[1] + 5 * u).toFixed(0) + '" font-size="' + (13 * u).toFixed(0) + '" class="pp-carte-n">' + n + '</text>';
    });
    return h + '</svg>';
  }

  /* ── portée du secteur : même règle que le bloc Bodacc d'avant ── */
  function ppScope() {
    var dir = sctEstDirection();
    if (SCT_S.scope === null) SCT_S.scope = (dir && !sctMonSecteur()) ? 'fr' : 'moi';
    if (!dir) SCT_S.scope = 'moi';   // la bascule est réservée à la direction
    return { dir: dir, deps: sctDeps() };
  }
  function ppAnnonces(deps) {
    var ev = (SECTEUR && SECTEUR.ev) || [];
    return ev.filter(function (e) { return (!deps || deps.indexOf(e.dep) >= 0) && ppJ(e.d) <= 92; })
      .sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
  }

  /* ── données du tableau de bord, recalculées à chaque rendu ── */
  function ppDonnees() {
    var B = BRIEF || {}, D = {};
    D.rad = {}; (B.radar || []).forEach(function (r) { D.rad[r.k] = r; });
    D.ep = (B.epingles || []).map(function (e) { var o = {}; for (var k in e) o[k] = e[k]; o.j = e.effet ? -ppJ(e.effet) : null; return o; });
    D.avenir = D.ep.filter(function (e) { return e.j != null && e.j >= 0; }).sort(function (a, b) { return a.j - b.j; });
    D.passe = D.ep.filter(function (e) { return e.j != null && e.j < 0; }).sort(function (a, b) { return b.j - a.j; });
    D.signaux = D.ep.filter(function (e) { return e.j == null; });
    D.marge = D.ep.filter(function (e) { return e.theme === 'marge' && e.j > 0; })[0] || D.avenir[D.avenir.length - 1] || null;
    D.lots = B.rappels_lots || []; D.para = B.rappels_para || [];
    D.rappels = D.lots.length + D.para.length;
    D.fil = B.fil || [];
    D.filNeuf = D.fil.filter(function (f) { return f.neuf; }).length;
    D.parTh = {}; D.fil.forEach(function (f) { D.parTh[f.theme] = (D.parTh[f.theme] || 0) + 1; });
    D.amont = B.amont || []; D.ema = B.ema || []; D.jo = B.jo || []; D.rupt = B.ruptures_neuves || [];
    D.cinq = B.cinq || []; D.une = B.une || null;
    D.C = B.compte || {};
    return D;
  }

  /* ════════════════ LE PANNEAU, AVEC SA PILE ════════════════ */
  var PP_PILE = [], PP_REG = [], PP_FOCUS = null, PP_CONC_AUTO = false;
  function ppPan() {
    var pan = document.getElementById('pp-pan');
    if (pan) return pan;
    var w = document.createElement('div');
    w.innerHTML = '<div class="pp-voile" id="pp-voile"></div>' +
      '<section class="pp-pan" id="pp-pan" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Détail">' +
        '<div class="pp-p-tete">' +
          '<button type="button" class="pp-rond" data-pp-retour aria-label="Revenir" hidden>' + ppIco('retour', 20) + '</button>' +
          '<span class="pp-p-sur" data-pp-sur></span>' +
          '<button type="button" class="pp-rond" data-pp-fermer aria-label="Fermer">' + ppIco('fermer', 20) + '</button>' +
        '</div>' +
        '<div class="pp-p-corps" data-pp-corps></div>' +
      '</section>';
    while (w.firstChild) document.body.appendChild(w.firstChild);
    pan = document.getElementById('pp-pan');
    document.getElementById('pp-voile').addEventListener('click', ppFermer);
    pan.querySelector('[data-pp-fermer]').addEventListener('click', ppFermer);
    pan.querySelector('[data-pp-retour]').addEventListener('click', ppRetour);
    pan.querySelector('[data-pp-corps]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pp-i]'); if (b) { ppLire(PP_REG[+b.getAttribute('data-pp-i')]); return; }
      var v = e.target.closest('[data-pp-vers]'); if (v) { ppOuvrirVue(v.getAttribute('data-pp-vers')); return; }
      var p = e.target.closest('[data-pp-plus]'); if (p) { var box = p.previousElementSibling; if (box) box.hidden = false; p.parentNode.removeChild(p); return; }
      if (e.target.closest('[data-pp-retour-bas]')) ppRetour();
    });
    return pan;
  }
  function ppAfficher(v) {
    var pan = ppPan(), corps = pan.querySelector('[data-pp-corps]');
    pan.querySelector('[data-pp-sur]').textContent = v.sur || '';
    corps.innerHTML = v.html; corps.scrollTop = v.scroll || 0;
    pan.querySelector('[data-pp-retour]').hidden = PP_PILE.length < 2;
    if (v.apres) v.apres(corps);
  }
  function ppOuvrirPan(v) {
    var pan = ppPan(), corps = pan.querySelector('[data-pp-corps]');
    // PP_REG n'est PAS vidé ici : la vue vient d'y inscrire ses lignes ; ppFermer() le vide
    if (!pan.classList.contains('ouvert')) { PP_PILE = []; PP_FOCUS = document.activeElement; }
    else if (PP_PILE.length) PP_PILE[PP_PILE.length - 1].scroll = corps.scrollTop;
    PP_PILE.push(v); ppAfficher(v);
    pan.classList.add('ouvert'); document.getElementById('pp-voile').classList.add('ouvert');
    pan.setAttribute('aria-hidden', 'false'); document.documentElement.classList.add('pp-fige');
    setTimeout(function () { var f = pan.querySelector('[data-pp-fermer]'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function ppFermer() {
    var pan = document.getElementById('pp-pan'); if (!pan) return;
    pan.classList.remove('ouvert'); document.getElementById('pp-voile').classList.remove('ouvert');
    pan.setAttribute('aria-hidden', 'true'); document.documentElement.classList.remove('pp-fige');
    PP_PILE = []; PP_REG = [];
    if (PP_FOCUS && PP_FOCUS.focus && PP_FOCUS.isConnected) try { PP_FOCUS.focus({ preventScroll: true }); } catch (e) {}
  }
  function ppRetour() { if (PP_PILE.length < 2) { ppFermer(); return; } PP_PILE.pop(); ppAfficher(PP_PILE[PP_PILE.length - 1]); }
  function ppOuvert() { var p = document.getElementById('pp-pan'); return !!(p && p.classList.contains('ouvert')); }
  if (!V2._ppEchap) {
    V2._ppEchap = true;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ppOuvert()) ppFermer(); });
    // quitter la page (lien, bouton Retour du navigateur) referme le panneau
    // on lit l'adresse elle-même : cet écouteur passe AVANT celui du routeur (v2-app.js), V2.route date encore de l'écran quitté
    window.addEventListener('hashchange', function () {
      if ((location.hash || '').replace(/^#/, '').split('/')[0] !== 'infos') { ppFermer(); PP_CONC_AUTO = false; }
    });
  }

  /* ── lignes de liste ── */
  function ppReg(o) { PP_REG.push(o); return PP_REG.length - 1; }
  function ppLigne(o) {
    var i = ppReg(o.item);
    return '<button type="button" class="pp-ligne' + (o.lu ? ' lu' : '') + '" data-pp-i="' + i + '"><span class="pp-ico" style="--c:' + o.c + '">' + ppIco(o.ico, 18) + '</span>' +
      '<span class="pp-txt"><span class="pp-lt">' + o.t + '</span>' + (o.s ? '<span class="pp-ls">' + o.s + '</span>' : '') + '</span>' +
      (o.d ? '<span class="pp-ld' + (o.dc ? ' ' + o.dc : '') + '">' + o.d + '</span>' : '') + '</button>';
  }
  function ppListe(L, n, fn) {
    if (!L.length) return '<div class="pp-bloc"><div class="pp-vide">Rien sur cette sélection.</div></div>';
    var a = L.slice(0, n).map(fn).join(''), b = L.slice(n);
    return '<div class="pp-bloc">' + a + (b.length ? '<div hidden>' + b.map(function (x, k) { return fn(x, k + n); }).join('') + '</div><button type="button" class="pp-plus" data-pp-plus>Voir les ' + b.length + ' autres ' + ppIco('bas', 18) + '</button>' : '') + '</div>';
  }

  /* ── la lecture d'un élément ── */
  function ppLire(it) {
    if (it && it.paresseux) it = ppArtBod(it.paresseux);   // une annonce se marque « lue » à l'ouverture
    if (it) ppOuvrirPan({ sur: it.sur, html: ppLecture(it), apres: it.apres });
  }
  function ppLecture(it, feuille) {   // feuille = corps de la feuille « La une » : le titre est sur sa couverture, pas de « Revenir »
    var h = feuille ? '' : '<h2>' + esc(it.t) + '</h2>';
    if (it.meta) h += '<div class="pp-meta">' + esc(it.meta) + '</div>';
    if (it.badges) h += '<div style="margin-top:10px">' + it.badges + '</div>';
    if (it.chiffres && it.chiffres.length) h += '<div class="pp-chiffres">' + it.chiffres.map(function (c) { return '<div><b>' + esc(c.v) + '</b><span>' + esc(c.c) + '</span></div>'; }).join('') + '</div>';
    (it.paras || []).forEach(function (p) { if (p) h += '<p>' + esc(p) + '</p>'; });
    if (it.html) h += it.html;
    if (it.geste) h += '<div class="pp-geste"><b>' + (it.gesteT || 'Pour vous') + '</b>' + esc(it.geste) + '</div>';
    h += '<div class="pp-actions">';
    if (it.url && urlSure(it.url) !== '#') h += '<a class="pp-btn pp-btn-bleu" href="' + esc(urlSure(it.url)) + '" target="_blank" rel="noopener">' + esc(it.lien || 'Lire la source') + ' ' + ppIco('lien', 18) + '</a>';
    if (it.boutons) h += it.boutons;
    if (PP_PILE.length && !feuille) h += '<button type="button" class="pp-btn pp-btn-blanc" data-pp-retour-bas>Revenir</button>';
    return h + '</div>';
  }
  function ppArt(a, sur) {
    var srcs = (a.srcs && a.srcs.length) ? a.srcs : [a.s];
    return { sur: sur || a.theme_l || 'Article', t: a.t,
      meta: [srcs.filter(Boolean).slice(0, 3).join(' · '), a.d ? ilYA(a.d) : '', a.mn ? a.mn + ' min de lecture' : '', a.n_src > 1 ? a.n_src + ' sources en parlent' : ''].filter(Boolean).join(' · '),
      paras: [a.r].concat(a.points || []), chiffres: a.chiffres, geste: a.pour_toi || '', url: a.u,
      lien: 'Lire l’article en entier sur ' + (srcs[0] || 'le site'),
      badges: (a.neuf ? '<span class="pp-badge vert">Nouveau</span>' : '') + (a.entier ? '<span class="pp-badge">Lisible en entier</span>' : '') };
  }
  function ppArtEp(e) {
    var q = e.effet ? (e.j > 0 ? 'Applicable dans ' + ppPl(e.j, 'jour') + ' (' + ppDl(e.effet) + ')' : e.j === 0 ? 'Applicable aujourd’hui' : 'En vigueur depuis le ' + ppDl(e.effet)) : '';
    var cl = (['difficulte', 'cession', 'ferme', 'titulaire'].indexOf(e.motif) >= 0) ? clientTouche(e.societe, e.ville) : null;
    return { sur: 'À ne pas manquer · ' + (e.s || ''), t: e.t, meta: [q, e.d ? 'publié le ' + ppDl(e.d) : ''].filter(Boolean).join(' · '),
      paras: [e.r].concat(e.points || []), geste: e.pour_toi, url: e.u,
      html: cl ? '<div class="pp-geste pp-alerte"><b>C’est un de vos clients</b>' + esc(cl.name) + (cl.code ? ' · CIP ' + esc(cl.code) : '') +
        ({ cession: ' : le titulaire change, compte à reprendre.', titulaire: ' : le titulaire a changé, compte à reprendre.', ferme: ' : ce client ferme, encours à solder.' }[e.motif] || ' : encours à vérifier.') + '</div>' : '' };
  }
  function ppArtBod(e) {
    var fam = SCT_FAM[e.f] || SCT_FAM.dirigeant, tag = sctTag(e);
    SCT_LU[e.id] = 1; sctSaveLu();
    return { sur: fam.l1 + ' · ' + (e.depNom || SCT_DEPNOMS[e.dep] || '') + ' (' + e.dep + ')', t: sctJoli(e.nom),
      meta: [e.detail, sctJoli(e.ville), 'publié ' + sctQuand(e.d) + ' au Bodacc'].filter(Boolean).join(' · '),
      badges: SCT_TAG_L[tag.t] ? '<span class="pp-badge' + (tag.t === 'client' ? ' vert' : tag.t === 'prospect' ? '' : ' gris') + '">' + SCT_TAG_L[tag.t] + '</span>' : '',
      paras: ['Publié le ' + sctDateLongue(e.d) + '.'],
      geste: sctGeste(e, tag.t), gesteT: 'Le geste', url: e.url, lien: 'Lire l’annonce officielle',
      boutons: (tag.ficheId ? '<button type="button" class="pp-btn pp-btn-blanc" onclick="V2.ppFiche(\'' + esc(tag.ficheId) + '\')">' + ppIco('fiche', 18) + 'Ouvrir la fiche officine</button>' : '') +
        '<button type="button" class="pp-btn pp-btn-blanc" onclick="V2.ppNonLu(\'' + esc(e.id) + '\',this)">Marquer comme non lue</button>' };
  }
  V2.ppFiche = function (id) { if (!id) return; ppFermer(); x13Reset(); V2.go('pharma', id); };
  V2.ppNonLu = function (id, b) { delete SCT_LU[id]; sctSaveLu(); if (b) { b.textContent = 'Marquée comme non lue'; b.disabled = true; } };
  function ppArtRupt(r) {
    var nom = String(r.spec || '').split(/ – | - /)[0];
    return { sur: 'Ruptures · ANSM', t: nom || r.dci, meta: [r.st, r.dom, r.since ? 'signalé le ' + ppDl(r.since) : ''].filter(Boolean).join(' · '),
      paras: [r.dci ? 'Molécule : ' + r.dci + '.' : '', r.retour ? 'Retour prévu : ' + r.retour : 'Pas de date de retour annoncée.', r.subst ? 'Une alternative existe : c’est une conversation à avoir au comptoir.' : 'Pas d’alternative signalée par l’ANSM.'],
      url: 'https://ansm.sante.fr/disponibilites-des-produits-de-sante/medicaments', lien: 'Voir la liste de l’ANSM' };
  }
  function ppMolCourte(m) { m = String(m || ''); return m.length > 90 ? m.split(';')[0] + ' (solution composée)' : m; }
  function ppArtAmont(a) {
    return { sur: 'Ruptures chez les voisins · ' + a.pays, t: ppMolCourte(a.mol), meta: ['Déclarée en ' + a.pays + ' le ' + ppDl(a.depuis), a.atc ? 'classe ' + a.atc : ''].filter(Boolean).join(' · '),
      paras: [a.produit ? 'Produit concerné : ' + a.produit + '.' : '', 'Pas encore signalée par l’ANSM en France.'], geste: 'Une molécule qui manque au comptoir, c’est une commande à sécuriser.' };
  }
  function ppArtEma(m) {
    return { sur: 'En approche européenne · EMA', t: m.name + (m.inn ? ' (' + m.inn + ')' : ''), meta: [m.type, m.atc ? 'classe ' + m.atc : '', m.opinion ? 'avis du ' + ppDl(m.opinion) : ''].filter(Boolean).join(' · '),
      paras: ['Statut : ' + (m.status === 'Opinion' ? 'avis favorable rendu, autorisation européenne en cours' : m.status) + '.', 'Un ' + m.type + ' de plus sur le marché, c’est une référence de plus à proposer quand il arrivera en officine.'],
      url: 'https://www.ema.europa.eu/en/medicines', lien: 'Voir le site de l’EMA' };
  }
  function ppArtLot(r) { return { sur: 'Rappel de lot · ANSM', t: r.t, meta: [r.lab, r.d ? 'publié ' + ilYA(r.d) : ''].filter(Boolean).join(' · '), paras: [r.motif, r.niv], url: r.url, lien: 'Voir le rappel à l’ANSM' }; }
  function ppArtPara(r) {
    return { sur: 'Rappel · Rappel Conso', t: sctJoli(r.titre) + (r.marque ? ' · ' + sctJoli(r.marque) : ''), meta: r.date ? 'publié le ' + ppDl(r.date) : '',
      paras: [r.motif ? 'Motif : ' + r.motif : '', r.risque ? 'Risque : ' + String(r.risque).replace(/\|/g, ', ') + '.' : '', r.conduite ? 'Conduite à tenir : ' + r.conduite + '.' : ''], url: r.url, lien: 'Voir la fiche du rappel' };
  }
  function ppArtVer(v) { return { sur: 'Concurrents · fait vérifié', t: v.titre, meta: [v.source, v.date ? ppDl(v.date) : ''].filter(Boolean).join(' · '), paras: [v.texte], geste: v.angle || '', gesteT: 'À dire en rendez-vous', url: v.url }; }
  function ppArtJo(o) {
    return { sur: 'Journal officiel', t: o.titre, meta: ['Publié au JO du ' + ppDl(o.jo), o.signe_le ? 'signé le ' + ppDl(o.signe_le) : '', o.date_effet ? 'effet le ' + ppDl(o.date_effet) : ''].filter(Boolean).join(' · '),
      paras: [o.resume || '', (o.motifs || []).length ? 'Pourquoi il est suivi : ' + o.motifs.join(' ; ') + '.' : ''], url: o.url, lien: 'Lire sur Légifrance' };
  }

  /* ════════════════ LES VUES DU PANNEAU ════════════════ */
  var PP_VUES = {};
  function ppOuvrirVue(n) { if (PP_VUES[n]) PP_VUES[n](); }
  V2.ppOuvrir = function (n) { ppOuvrirVue(n); };

  PP_VUES.secteur = function () {
    var etat = { f: 'tout', ag: false }, AG = null, BOX = null;
    if (V2.concurrentsResume) V2.concurrentsResume(function (r) {
      AG = []; if (r) r.presents.forEach(function (a) { a.chez.forEach(function (g) { AG.push({ lat: g.lat, lon: g.lon, coul: r.coul[a.cle] }); }); });
      if (BOX && BOX.isConnected && AG.length) rendre(BOX);   // la puce « Agences » apparaît dès que les agences sont là
    });
    function rendre(c) {
      var S = ppScope(), tout = ppAnnonces(S.deps), per = SCT_S.per;
      var dansPer = tout.filter(function (e) { return ppJ(e.d) <= per; });
      var V = dansPer.filter(function (e) { return etat.f === 'tout' || e.f === etat.f; });
      var cpt = {}; dansPer.forEach(function (e) { cpt[e.f] = (cpt[e.f] || 0) + 1; });
      var h = '<h2>Votre secteur</h2><div class="pp-chapo">' + (S.deps ? 'Les officines qui bougent au Bodacc dans ' + (S.deps.length > 1 ? 'vos ' + S.deps.length + ' départements' : 'votre département') : 'Les officines qui bougent au Bodacc dans toute la France') + ', et le geste à faire pour chacune.</div>';
      if (!SECTEUR || !(SECTEUR.ev || []).length) { c.innerHTML = h + '<div class="pp-bloc" style="margin-top:14px"><div class="pp-vide">Les annonces du Bodacc ne sont pas disponibles pour l’instant.</div></div>'; return; }
      if (!S.deps && !S.dir) { c.innerHTML = h + '<div class="pp-bloc" style="margin-top:14px"><div class="pp-vide">Votre secteur n’est pas encore connu : il se calcule à partir des officines de votre fichier (au moins 3 par département).</div></div>'; return; }
      if (S.dir) {
        var autres = sctAutresSecteurs(), nFr = (SECTEUR.ev || []).filter(function (e) { return ppJ(e.d) <= 92; }).length;
        h += '<div class="pp-bascule" role="group" aria-label="Étendue">' +
          '<button type="button" data-pp-scope="moi" aria-pressed="' + (SCT_S.scope === 'moi') + '">Mon secteur</button>' +
          '<button type="button" data-pp-scope="fr" aria-pressed="' + (SCT_S.scope === 'fr') + '">Toute la France · ' + nFr + '</button></div>' +
          (autres.length ? '<select class="pp-select" data-pp-autre aria-label="Voir un autre secteur"><option value="">Un autre secteur</option>' +
            autres.map(function (a, i) { return '<option value="' + i + '"' + (SCT_S.scope === 'autre' && SCT_S.autre === i ? ' selected' : '') + '>' + esc(a.l) + '</option>'; }).join('') + '</select>' : '') +
          '<div class="pp-note">Bascule réservée à la direction.</div>';
      }
      var carte = ppCarte(S.deps, V, { r: 9, px: 360, pts: true, agences: etat.ag && S.deps ? AG : null, attrs: ' data-pp-carte role="img" aria-label="Carte, ' + V.length + ' annonces"' });
      if (carte) h += '<div class="pp-carte-p">' + carte + '<span class="pp-carte-aide">' + (S.deps ? 'Touchez un point' : 'Touchez un département') + '</span></div>';
      var parDep = {}; V.forEach(function (e) { parDep[e.dep] = (parDep[e.dep] || 0) + 1; });
      var depsL = S.deps ? S.deps.slice().sort() : Object.keys(parDep).sort(function (a, b) { return parDep[b] - parDep[a]; }).slice(0, 8);
      h += '<ul class="pp-legende" style="margin-top:10px">' + depsL.map(function (k) { return '<li>' + esc(SCT_DEPNOMS[k] || k) + ' <b>' + (parDep[k] || 0) + '</b></li>'; }).join('') + '</ul>';
      h += '<div class="pp-bascule" role="group" aria-label="Période">' + [7, 30, 90].map(function (n) { return '<button type="button" data-pp-per="' + n + '" aria-pressed="' + (per === n) + '">' + (n === 90 ? '3 mois' : n + ' jours') + '</button>'; }).join('') + '</div>';
      h += '<div class="pp-puces" role="group" aria-label="Familles"><button type="button" class="pp-puce" data-pp-f="tout" aria-pressed="' + (etat.f === 'tout') + '">Tout <span class="pp-n">' + dansPer.length + '</span></button>' +
        PP_ORDRE_F.map(function (f) { return '<button type="button" class="pp-puce" data-pp-f="' + f + '" aria-pressed="' + (etat.f === f) + '"><i style="background:' + PP_FC[f] + '"></i>' + PP_COURT[f] + ' <span class="pp-n">' + (cpt[f] || 0) + '</span></button>'; }).join('') +
        (S.deps && AG && AG.length ? '<button type="button" class="pp-puce" data-pp-ag aria-pressed="' + etat.ag + '"><i style="background:#6D4FC4;border-radius:2px"></i>Agences concurrentes <span class="pp-n">' + AG.length + '</span></button>' : '') + '</div>';
      var nonLus = V.filter(function (e) { return !SCT_LU[e.id]; }).length;
      h += '<h3>Les annonces <b>· ' + V.length + '</b>' + (V.length ? ' <span class="pp-h3-s">' + nonLus + ' non lue' + (nonLus > 1 ? 's' : '') + '</span>' : '') + '</h3>';
      var rang = { client: 0, prospect: 1, hors: 2, reste: 2 };
      var L = V.map(function (e) { return { e: e, t: sctTag(e).t }; });
      if (S.deps) L.sort(function (x, y) { return (rang[x.t] - rang[y.t]) || (x.e.d < y.e.d ? 1 : x.e.d > y.e.d ? -1 : 0); });
      h += ppListe(L, 8, function (x) {
        var e = x.e, fam = SCT_FAM[e.f] || SCT_FAM.dirigeant;
        return ppLigne({ item: ppArtBodPret(e), c: PP_FC[e.f] || PP_FC.dirigeant, ico: e.f, lu: SCT_LU[e.id],
          t: esc(sctJoli(e.nom)) + (SCT_TAG_L[x.t] && x.t !== 'hors' ? ' <span class="pp-badge' + (x.t === 'client' ? ' vert' : '') + '">' + SCT_TAG_L[x.t] + '</span>' : ''),
          s: esc(fam.l1) + ' · ' + esc(sctJoli(e.ville)) + ' (' + esc(e.dep) + ')<br>' + esc(sctGeste(e, x.t)), d: sctQuand(e.d), dc: ppJ(e.d) <= 7 ? 'chaud' : '' });
      });
      h += '<div class="pp-note" style="margin-top:12px">Source : Bodacc, relevé du ' + esc(ppDc(SECTEUR.maj)) + '. Les étiquettes « client » et « prospect » sont calculées sur votre appareil, jamais publiées.</div>';
      c.innerHTML = h;
    }
    function brancher(c) {
      c.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-pp-scope]'))) { SCT_S.scope = b.getAttribute('data-pp-scope'); SCT_S.autre = -1; etat.f = 'tout'; rendre(c); ppRafraichirPage(); return; }
        if ((b = e.target.closest('[data-pp-per]'))) { SCT_S.per = +b.getAttribute('data-pp-per'); etat.f = 'tout'; rendre(c); return; }
        if ((b = e.target.closest('[data-pp-f]'))) { etat.f = b.getAttribute('data-pp-f'); rendre(c); return; }
        if ((b = e.target.closest('[data-pp-ag]'))) { etat.ag = !etat.ag; rendre(c); return; }
        var svg = e.target.closest('[data-pp-carte]'); if (!svg) return;
        var m = svg.getScreenCTM(); if (!m) return;
        var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var p = pt.matrixTransform(m.inverse()), sc = m.a;
        var best = null, bd = 1e9;
        PP_PTS.forEach(function (q) { var dx = (q[0] - p.x) * sc, dy = (q[1] - p.y) * sc, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = q[2]; } });
        if (best && bd <= 26 * 26) { ppLire(ppArtBod(best)); return; }
        var dp = e.target.closest('[data-dep]'); if (!dp) return;
        var code = dp.getAttribute('data-dep'), S = ppScope();
        var L = ppAnnonces(S.deps).filter(function (x) { return x.dep === code && ppJ(x.d) <= SCT_S.per && (etat.f === 'tout' || x.f === etat.f); });
        ppOuvrirPan({ sur: 'Votre secteur · ' + (SCT_DEPNOMS[code] || code), html: '<h2>' + esc(SCT_DEPNOMS[code] || code) + ' (' + esc(code) + ')</h2><div class="pp-chapo">' + ppPl(L.length, 'annonce') + ' sur la période choisie.</div><h3>Choisir une annonce</h3>' +
          ppListe(L, 20, function (x) { return ppLigne({ item: ppArtBodPret(x), c: PP_FC[x.f] || PP_FC.dirigeant, ico: x.f, t: esc(sctJoli(x.nom)), s: esc((SCT_FAM[x.f] || SCT_FAM.dirigeant).l1) + ' · ' + esc(sctJoli(x.ville)), d: sctQuand(x.d) }); }) });
      });
      c.addEventListener('change', function (e) {
        if (!e.target.matches('[data-pp-autre]') || e.target.value === '') return;
        SCT_S.scope = 'autre'; SCT_S.autre = +e.target.value; etat.f = 'tout'; rendre(c); ppRafraichirPage();
      });
    }
    ppOuvrirPan({ sur: 'Votre secteur · Bodacc', html: '<div data-pp-sect></div>', apres: function (cc) { BOX = cc.querySelector('[data-pp-sect]'); rendre(BOX); brancher(BOX); } });
  };
  // l'annonce se marque « lue » au moment où on l'OUVRE, pas quand la liste s'affiche
  function ppArtBodPret(e) { return { paresseux: e }; }

  /* un changement de portée recalcule aussi les tuiles, sans fermer le panneau */
  function ppRafraichirPage() { if (V2.route && V2.route.name === 'infos') V2.render(); }

  PP_VUES.echeances = function () {
    var D = ppDonnees(), m = D.marge;
    var h = '<h2>À ne pas manquer</h2><div class="pp-chapo">Les échéances réglementaires et les signaux du jour, classés par compte à rebours.</div>';
    h += '<div class="pp-chiffres">' + (m ? '<div><b style="color:var(--pp-ambre-f)">J-' + m.j + '</b><span>' + (m.theme === 'marge' ? 'nouvelle marge grossiste' : esc(m.t)) + ', le ' + esc(ppDl(m.effet)) + '</span></div>' : '') +
      '<div><b>' + D.avenir.length + '</b><span>' + (D.avenir.length > 1 ? 'échéances à venir' : 'échéance à venir') + ', ' + D.passe.length + ' déjà en vigueur</span></div></div>';
    function fe(e) {
      return ppLigne({ item: ppArtEp(e), c: e.theme === 'marge' ? '#C7791A' : e.motif === 'ferme' ? '#E0556E' : '#0050E6', ico: e.theme === 'marge' ? 'loi' : e.motif === 'ferme' ? 'fermeture' : 'prix',
        t: esc(e.t), s: esc(e.s) + (e.pour_toi ? ' · ' + esc(e.pour_toi) : ''), d: e.j === 0 ? 'aujourd’hui' : e.j > 0 ? 'J-' + e.j : 'en vigueur', dc: e.j != null && e.j >= 0 && e.j <= 7 ? 'urgent' : e.j > 0 ? 'chaud' : '' });
    }
    var IC = { amont: 'europe', titulaire: 'dirigeant', difficulte: 'procedure', cession: 'cession', ferme: 'fermeture' }, CO = { amont: '#E0556E', titulaire: '#0050E6', difficulte: '#C7791A', cession: '#1E9E6A' };
    h += '<h3>À venir <b>· ' + D.avenir.length + '</b></h3>' + ppListe(D.avenir, 10, fe);
    h += '<h3>Déjà en vigueur <b>· ' + D.passe.length + '</b></h3>' + ppListe(D.passe, 10, fe);
    h += '<h3>Signaux du jour <b>· ' + D.signaux.length + '</b></h3>' + ppListe(D.signaux, 4, function (e) { return ppLigne({ item: ppArtEp(e), c: CO[e.motif] || '#465066', ico: IC[e.motif] || 'journal', t: esc(e.t), s: esc(e.s), d: e.d ? ilYA(e.d) : '' }); });
    h += '<h3>Journal officiel <b>· ' + ppPl(D.jo.length, 'texte suivi', 'textes suivis') + '</b></h3>' + ppListe(D.jo, 5, function (o) {
      return ppLigne({ item: ppArtJo(o), c: '#465066', ico: 'loi', t: esc(o.titre), s: (o.resume ? esc(o.resume) + ' · ' : '') + (o.date_effet ? (o.a_venir ? 'effet le ' : 'en vigueur depuis le ') + esc(ppDc(o.date_effet)) : ''), d: o.jo ? 'JO ' + esc(ppDc(o.jo)) : '' });
    });
    ppOuvrirPan({ sur: 'À ne pas manquer · ' + ppPl(D.ep.length, 'échéance'), html: h });
  };

  PP_VUES.ruptures = function () {
    var D = ppDonnees(), R = D.rad, r = R.ruptures;
    var h = '<h2>Ruptures</h2><div class="pp-chapo">' + (r ? r.v + ' produits en rupture ou tension selon l’ANSM' + (r.sub ? ' ; ' + esc(r.sub) : '') + '.' : 'Le relevé chiffré des ruptures n’est pas disponible ce matin.') + '</div>';
    h += '<div class="pp-chiffres">' + (r ? '<div><b style="color:var(--pp-rose-f)">' + r.v + '</b><span>en rupture ou tension</span></div>' : '') +
      (R.substituables ? '<div><b style="color:var(--pp-vert-f)">' + R.substituables.v + '</b><span>ont une alternative possible</span></div>' : '') +
      (R.retours ? '<div><b style="color:var(--pp-bleu)">' + R.retours.v + '</b><span>retours annoncés sous 60 jours</span></div>' : '') +
      '<div><b>' + D.amont.length + '</b><span>molécules en rupture chez les voisins européens</span></div></div>';
    h += '<h3>Nouvelles alertes ANSM <b>· ' + D.rupt.length + '</b></h3>' + ppListe(D.rupt, 7, function (x) {
      var st = x.st || '', co = /Rupture/i.test(st) ? '#E0556E' : /Tension/i.test(st) ? '#C7791A' : /Arr[eê]t/i.test(st) ? '#465066' : '#1E9E6A';
      return ppLigne({ item: ppArtRupt(x), c: co, ico: 'rupture', t: esc(String(x.spec || x.dci || '').split(/ – | - /)[0]),
        s: '<span class="pp-badge ' + (co === '#E0556E' ? 'rose' : co === '#C7791A' ? 'ambre' : co === '#1E9E6A' ? 'vert' : 'gris') + '">' + esc(st) + '</span>' + esc(x.dom || '') + (x.retour ? ' · retour ' + esc(String(x.retour).replace(/\.$/, '')) : '') });
    });
    h += '<h3>Chez les voisins, pas encore en France <b>· ' + D.amont.length + '</b></h3>' + ppListe(D.amont, 6, function (a) {
      return ppLigne({ item: ppArtAmont(a), c: '#E0556E', ico: 'europe', t: esc(ppMolCourte(a.mol).length > 60 ? String(a.mol).split(';')[0] + ' (solution composée)' : ppMolCourte(a.mol)), s: esc(a.produit || '') + ' · ' + esc(a.pays || ''), d: esc(ppDc(a.depuis)) });
    });
    h += '<h3>En approche au niveau européen <b>· ' + D.ema.length + '</b></h3>' + ppListe(D.ema, 5, function (m) { return ppLigne({ item: ppArtEma(m), c: '#1E9E6A', ico: 'europe', t: esc(m.name) + (m.inn ? ' · ' + esc(m.inn) : ''), s: esc(m.type || '') + (m.opinion ? ' · avis rendu le ' + esc(ppDc(m.opinion)) : '') }); });
    h += '<h3>Et les rappels de lot</h3><div class="pp-bloc"><button type="button" class="pp-ligne" data-pp-vers="rappels"><span class="pp-ico" style="--c:#BE3450">' + ppIco('rappel', 18) + '</span><span class="pp-txt"><span class="pp-lt">' + ppPl(D.rappels, 'rappel en cours', 'rappels en cours') + '</span><span class="pp-ls">' + D.lots.length + ' médicaments et dispositifs · ' + D.para.length + ' parapharmacie</span></span></button></div>';
    ppOuvrirPan({ sur: 'Ruptures · ANSM et voisins européens', html: h });
  };

  PP_VUES.rappels = function () {
    var D = ppDonnees();
    var h = '<h2>Rappels de lot</h2><div class="pp-chapo">Les produits retirés ou rappelés, à vérifier en stock et à signaler à l’officine.</div>';
    h += '<h3>Médicaments et dispositifs · ANSM <b>· ' + D.lots.length + '</b></h3>' + ppListe(D.lots, 5, function (r) { return ppLigne({ item: ppArtLot(r), c: '#BE3450', ico: 'rappel', t: esc(r.t), s: esc(r.lab || r.niv || ''), d: r.d ? ilYA(r.d) : '' }); });
    h += '<h3>Parapharmacie · Rappel Conso <b>· ' + D.para.length + '</b></h3>' + ppListe(D.para, 6, function (r) { return ppLigne({ item: ppArtPara(r), c: '#F07F95', ico: 'rappel', t: esc(sctJoli(r.titre)), s: esc(sctJoli(r.marque || '')) + (r.risque ? ' · ' + esc(String(r.risque).replace(/\|/g, ', ')) : ''), d: esc(ppDc(r.date)) }); });
    ppOuvrirPan({ sur: 'Rappels · ' + D.rappels + ' en cours', html: h });
  };

  PP_VUES.une = function () { if (BRIEF && BRIEF.une) ppLire(ppArt(BRIEF.une, 'À la une · ' + (BRIEF.une.theme_l || ''))); };

  PP_VUES.cinq = function () {
    var D = ppDonnees();
    var h = '<h2>L’essentiel en 30 secondes</h2><div class="pp-chapo">Les cinq sujets à connaître avant la première visite.</div><h3>Les ' + D.cinq.length + ' sujets</h3>' +
      ppListe(D.cinq, 5, function (c) { return ppLigne({ item: ppArt(c), c: PP_TH[c.theme] || '#0050E6', ico: c.theme === 'securite' ? 'rappel' : c.theme === 'marge' ? 'prix' : 'journal', t: esc(c.t), s: esc(c.theme_l || '') + ' · ' + esc(c.s || '') + ' · ' + (c.mn || 1) + ' min' }); });
    ppOuvrirPan({ sur: 'L’essentiel · ' + ppPl(D.cinq.length, 'sujet'), html: h });
  };

  PP_VUES.radar = function () {
    var vers = { ruptures: 'ruptures', substituables: 'ruptures', retours: 'ruptures', prix: 'echeances', jo: 'echeances', demande: 'mur', rappels: 'rappels' };
    var R = (BRIEF && BRIEF.radar) || [];
    var h = '<h2>Le radar du jour</h2><div class="pp-chapo">' + ppPl(R.length, 'compteur relevé', 'compteurs relevés') + ' ce matin. Toucher un compteur ouvre la rubrique qui l’explique.</div><h3>Les ' + ppPl(R.length, 'compteur') + '</h3><div class="pp-bloc">' +
      R.map(function (r) {
        return '<button type="button" class="pp-ligne" data-pp-vers="' + (vers[r.k] || 'mur') + '"><span class="pp-ico pp-ico-n" style="--c:' + (PP_TON[r.ton] || '#0050E6') + '">' + (r.k === 'demande' && r.v > 0 ? '+' : '') + esc(r.v) + (r.unite === 'j' ? ' j' : r.unite ? ' ' + esc(r.unite) : '') + '</span>' +
          '<span class="pp-txt"><span class="pp-lt">' + esc(r.l) + '</span><span class="pp-ls">' + esc(r.sub || '') + (r.src ? ' · ' + esc(r.src) : '') + '</span></span></button>';
      }).join('') + '</div>';
    ppOuvrirPan({ sur: 'Le radar du jour', html: h });
  };

  /* Concurrents : faits vérifiés (avec l'angle en rendez-vous), agences (le bloc de
     v2-infos-concurrents.js, monté ici) et presse (le bloc de v2-grossistes.js). */
  PP_VUES.concurrents = function () {
    var tab = 'verifie', VER = null, nAg = null, nActu = null;
    function rendre(c) {
      var h = '<h2>Les concurrents</h2><div class="pp-chapo">Ce qui est vérifié, où ils sont implantés, et ce que la presse en dit.</div>' +
        '<div class="pp-onglets" role="tablist">' +
          '<button type="button" role="tab" data-pp-tab="verifie" aria-selected="' + (tab === 'verifie') + '">Faits vérifiés' + (VER ? ' · ' + VER.length : '') + '</button>' +
          '<button type="button" role="tab" data-pp-tab="agences" aria-selected="' + (tab === 'agences') + '">Agences' + (nAg != null ? ' · ' + nAg : '') + '</button>' +
          '<button type="button" role="tab" data-pp-tab="presse" aria-selected="' + (tab === 'presse') + '">Presse' + (nActu != null ? ' · ' + nActu : '') + '</button></div>' +
        '<div data-pp-conc-corps></div>';
      c.innerHTML = h;
      var corps = c.querySelector('[data-pp-conc-corps]');
      if (tab === 'verifie') {
        if (!VER) { corps.innerHTML = '<div class="pp-bloc" style="margin-top:14px"><div class="pp-vide">Chargement des faits vérifiés…</div></div>'; return; }
        var L = VER.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
        corps.innerHTML = '<h3>Faits vérifiés, du plus récent <b>· ' + L.length + '</b></h3>' + ppListe(L, 6, function (v) {
          return ppLigne({ item: ppArtVer(v), c: '#6D4FC4', ico: 'concurrent', t: esc(v.titre), s: v.angle ? '<span class="pp-badge">Angle en rendez-vous</span>' + esc(v.angle) : esc(v.source || ''), d: esc(ppDc(v.date)) });
        });
      } else if (tab === 'agences') {
        if (V2.concurrentsSecteur) V2.concurrentsSecteur(corps); else corps.innerHTML = '<div class="pp-bloc"><div class="pp-vide">La carte des agences n’est pas disponible.</div></div>';
      } else if (V2.grossistesCorps) V2.grossistesCorps(corps, 'actu');
      else corps.innerHTML = '<div class="pp-bloc"><div class="pp-vide">La revue de presse n’est pas disponible.</div></div>';
    }
    ppOuvrirPan({ sur: 'Concurrents', html: '<div data-pp-conc></div>', apres: function (cc) {
      var c = cc.querySelector('[data-pp-conc]'); rendre(c);
      c.addEventListener('click', function (e) { var b = e.target.closest('[data-pp-tab]'); if (b) { tab = b.getAttribute('data-pp-tab'); rendre(c); } });
      if (V2.grossistesActuDonnees) V2.grossistesActuDonnees(function (a, v) {
        VER = (v || []).filter(function (x) { return !x.nonConfirme; }); nActu = (a || []).length;
        if (c.isConnected && tab === 'verifie') rendre(c); else if (c.isConnected) { var t = c.querySelector('[data-pp-tab="verifie"]'); if (t) t.textContent = 'Faits vérifiés · ' + VER.length; t = c.querySelector('[data-pp-tab="presse"]'); if (t) t.textContent = 'Presse · ' + nActu; }
      }); else { VER = []; rendre(c); }
      if (V2.concurrentsResume) V2.concurrentsResume(function (r) {
        nAg = r ? r.presents.reduce(function (s, a) { return s + a.chez.length; }, 0) : null;
        var t = c.isConnected && c.querySelector('[data-pp-tab="agences"]'); if (t && nAg != null) t.textContent = 'Agences · ' + nAg;
      });
    } });
  };

  PP_VUES.mur = function () {
    var D = ppDonnees(), th = THEME_SEL && D.parTh[THEME_SEL] ? THEME_SEL : 'tous', q = '';
    var ks = Object.keys(D.parTh).sort(function (a, b) { return D.parTh[b] - D.parTh[a]; });
    function res(c) {
      var qq = norm(q.trim());
      var L = D.fil.filter(function (a) { return (th === 'tous' || a.theme === th) && (!qq || norm(a.t + ' ' + (a.r || '') + ' ' + (a.s || '')).indexOf(qq) >= 0); });
      c.querySelector('[data-pp-res]').innerHTML = '<h3>Articles <b>· ' + L.length + '</b></h3>' + ppListe(L, 12, function (a) {
        return ppLigne({ item: ppArt(a), c: PP_TH[a.theme] || '#0050E6', ico: a.theme === 'rupture' ? 'rupture' : a.theme === 'securite' ? 'rappel' : a.theme === 'sante' ? 'sante' : 'journal',
          t: (a.neuf ? '<span class="pp-badge vert">Nouveau</span>' : '') + esc(a.t), s: esc(a.theme_l || '') + ' · ' + esc(a.s || '') + ' · ' + (a.mn || 1) + ' min', d: a.d ? ilYA(a.d) : '' });
      });
    }
    var h = '<h2>Le mur</h2><div class="pp-chapo">Toute l’actualité lue ce matin, ' + ppPl(D.fil.length, 'article') + ' dont ' + D.filNeuf + ' nouveau' + (D.filNeuf > 1 ? 'x' : '') + '.</div>' +
      '<div class="pp-champ-wrap">' + ppIco('chercher', 18) + '<input class="pp-champ" type="search" placeholder="Chercher dans les ' + D.fil.length + ' articles" aria-label="Chercher un article" data-pp-q></div>' +
      '<div class="pp-puces"><button type="button" class="pp-puce" data-pp-th="tous" aria-pressed="' + (th === 'tous') + '">Tous <span class="pp-n">' + D.fil.length + '</span></button>' +
      ks.map(function (k) { return '<button type="button" class="pp-puce" data-pp-th="' + esc(k) + '" aria-pressed="' + (th === k) + '"><i style="background:' + (PP_TH[k] || '#5E677A') + '"></i>' + esc((BRIEF.themes_l && BRIEF.themes_l[k]) || k) + ' <span class="pp-n">' + D.parTh[k] + '</span></button>'; }).join('') + '</div><div data-pp-res></div>';
    ppOuvrirPan({ sur: 'Le mur · ' + ppPl(D.fil.length, 'article'), html: '<div data-pp-mur>' + h + '</div>', apres: function (cc) {
      var c = cc.querySelector('[data-pp-mur]'); res(c);
      c.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pp-th]'); if (!b) return;
        th = b.getAttribute('data-pp-th');
        THEME_SEL = th === 'tous' ? '' : th; try { localStorage.setItem(TH_KEY, THEME_SEL); } catch (x) {}
        c.querySelectorAll('[data-pp-th]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); res(c);
      });
      c.addEventListener('input', function (e) { if (e.target.matches('[data-pp-q]')) { q = e.target.value; res(c); } });
    } });
  };

  /* « Les matins d'avant » : la vraie archive des éditions (brief-archive.json) */
  PP_VUES.archive = function () {
    var J = (ARCHIVE && ARCHIVE.jours) || [];
    var h = '<h2>Les matins d’avant</h2><div class="pp-chapo">' + (J.length ? ppPl(ARCHIVE.n || J.length, 'édition archivée', 'éditions archivées') + ' : la une de chaque matin et ses titres.' : 'L’archive des éditions n’est pas disponible pour l’instant.') + '</div>';
    J.forEach(function (j) {
      var dd = new Date(j.d + 'T12:00:00'), T = j.titres || [];
      h += '<h3>' + PP_JS[dd.getDay()] + ' ' + esc(ppDl(j.d)) + ' <b>· ' + ppPl(T.length, 'titre') + '</b></h3>' + ppListe(T, 3, function (t, k) {
        return ppLigne({ item: { sur: 'Les matins d’avant · ' + ppDc(j.d), t: t.t, meta: [t.s, 'édition du ' + ppDl(j.d)].filter(Boolean).join(' · '), url: t.u },
          c: PP_TH[t.theme] || '#0050E6', ico: t.theme === 'securite' ? 'rappel' : t.theme === 'rupture' ? 'rupture' : 'journal', t: (k === 0 && t.t === j.une ? '<span class="pp-badge">La une</span>' : '') + esc(t.t), s: esc(t.s || '') });
      });
    });
    ppOuvrirPan({ sur: 'Les matins d’avant · ' + ppPl(J.length, 'édition'), html: h });
  };

  PP_VUES.sources = function () {
    var C = (BRIEF && BRIEF.compte) || {}, F = C.fraicheur || [], S = C.sources_lues || [];
    var h = '<h2>La fraîcheur des sources</h2><div class="pp-chapo">' + [C.fichiers != null ? C.fichiers + ' fichiers relus' : '', C.entrees != null ? C.entrees + ' articles lus' : '', C.sujets != null ? C.sujets + ' sujets' : '', C.retenues != null ? C.retenues + ' retenus' : ''].filter(Boolean).join(', ') + '.</div>';
    h += '<h3>Les relevés automatiques <b>· ' + F.length + '</b></h3><div class="pp-bloc">' + (F.map(function (f) {
      return '<div class="pp-ligne"><span class="pp-ico" style="--c:' + (f.ok ? '#1E9E6A' : '#E0556E') + '">' + ppIco(f.ok ? 'horloge' : 'procedure', 18) + '</span><span class="pp-txt"><span class="pp-lt">' + esc(String(f.f || '').replace('.json', '')) + '</span><span class="pp-ls">relevé du ' + esc(ppDc(f.date)) + ' · ' + (f.ok ? 'à jour' : 'en retard') + ' (tolérance ' + esc(f.max) + ' j)</span></span><span class="pp-ld">' + (f.age === 0 ? 'du jour' : esc(f.age) + ' j') + '</span></div>';
    }).join('') || '<div class="pp-vide">Aucun relevé.</div>') + '</div>';
    h += '<h3>Toutes les sources lues <b>· ' + S.length + '</b></h3><div class="pp-bloc"><div class="pp-vide" style="color:var(--pp-encre);font-size:15px;line-height:1.7">' + (S.map(function (s) { return esc(String(s).replace('.json', '')); }).join(' · ') || 'Aucune.') + '</div></div>';
    ppOuvrirPan({ sur: 'Sources de l’édition', html: h });
  };

  /* ════════════════ LA UNE (08/10/2026, choix de Will · maquette 13) ════════════════
     Calquée sur Apple News : la date en grand, UNE grande carte, quatre cartes compactes,
     « Tendances » numérotées, « Tout voir ». Une carte touchée s'agrandit en feuille de
     lecture (posée dans <body>, comme le panneau, pour qu'aucun parent animé ne casse son
     position:fixed). Les neuf instruments du poste de pilotage sont gardés tels quels dans
     le panneau : on y entre par les pastilles « Rubriques », repliées en bas de page.
     Tout est calculé ICI à chaque rendu depuis ppDonnees() ; les faits concurrents vérifiés
     sont chargés pendant load() (VERIFS) pour que la page se dessine une seule fois. */
  var X13_RUB = { regle: 'Prix et règles', rupture: 'Ruptures', rappel: 'Rappels de lot', officine: 'Officines', actu: 'Actualité', concurrent: 'Concurrents' };
  var X13_SRC = { regle: 'Journal officiel', rupture: 'Agence du médicament', rappel: 'Agence du médicament', officine: 'Annonces légales', actu: '', concurrent: '' };
  var X13_ICO = { regle: 'loi', rupture: 'rupture', rappel: 'rappel', officine: 'cession', concurrent: 'concurrent', actu: 'journal' };
  var X13 = { liste: [], orig: null, fin: 0, tx: null, rub: false };
  function x13T(s) { return esc(String(s == null ? '' : s).replace(/\btes\b/g, 'vos').replace(/\bton\b/g, 'votre')); }
  function x13N2(t) { return norm(t).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function x13NomRupt(r) { return String(r.spec || '').split(/ – | - /)[0] || String(r.dci || ''); }
  function x13Jour() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; } }

  /* les événements du jour, dédoublonnés, chacun avec sa rubrique et son article (ppArt*) */
  function x13Evenements(D) {
    var vus = {}, out = [], auj = x13Jour();
    function add(o) { var k = x13N2(o.t).slice(0, 38); if (!o.t || vus[k]) return; vus[k] = 1; out.push(o); }
    D.avenir.concat(D.passe).forEach(function (e) { add({ rub: 'regle', t: e.t, d: e.effet, j: e.j, item: ppArtEp(e), pri: e.j >= 0 && e.j <= 7 ? 1 : 6 }); });
    D.signaux.forEach(function (e) { add({ rub: e.motif === 'amont' ? 'rupture' : 'officine', t: e.t, d: e.d, item: ppArtEp(e), pri: e.motif === 'amont' ? 5 : 4 }); });
    D.rupt.forEach(function (r) { add({ rub: 'rupture', t: x13NomRupt(r), d: r.since && ppJ(r.since) >= 0 ? r.since : auj, item: ppArtRupt(r), pri: 2 }); });
    D.lots.forEach(function (r) { add({ rub: 'rappel', t: r.t, d: r.d, item: ppArtLot(r), pri: 3 }); });
    D.para.forEach(function (r) { add({ rub: 'rappel', t: sctJoli(r.titre) + (r.marque ? ' · ' + sctJoli(r.marque) : ''), d: r.date, item: ppArtPara(r), pri: 8 }); });
    D.cinq.forEach(function (c) {
      if (D.lots.some(function (l) { return norm(c.t).indexOf(x13N2(l.t).slice(0, 38)) >= 0; })) return;
      add({ rub: 'actu', t: c.t, d: c.d, item: ppArt(c), pri: 7 });
    });
    D.fil.forEach(function (a) { add({ rub: 'actu', t: a.t, d: a.d, item: ppArt(a), pri: 9, neuf: a.neuf }); });
    return out;
  }
  /* la une, quatre compactes (une par rubrique de terrain), quatre tendances (l'actualité qui n'est pas déjà ailleurs), le reste */
  function x13Pile(D) {
    var tout = x13Evenements(D);
    (VERIFS || []).forEach(function (v) { tout.push({ rub: 'concurrent', t: v.titre, d: v.date, s: v.source, pri: 5.5, item: ppArtVer(v) }); });
    tout.forEach(function (e, i) { e.o = i; });
    tout.sort(function (a, b) { return (a.pri - b.pri) || (String(b.d || '').localeCompare(String(a.d || ''))) || (a.o - b.o); });
    var lots = D.lots.map(function (l) { return x13N2(l.t).slice(0, 22); });
    var mols = D.rupt.map(function (r) { return x13N2(x13NomRupt(r)).split(' ')[0]; }).filter(function (w) { return w.length > 4; });
    var lire = tout.filter(function (e) {
      if (e.rub !== 'actu') return false;
      var t = x13N2(e.t), tt = x13N2(e.t + ' ' + (e.item.paras || []).join(' '));
      return !lots.some(function (l) { return t.indexOf(l) >= 0; }) && !mols.some(function (w) { return tt.indexOf(w) >= 0; });
    });
    var une = tout.filter(function (e) { return e.pri === 1; })[0] || tout[0], pris = une ? [une] : [], cmp = [], tend = [];
    ['rupture', 'rappel', 'officine', 'concurrent'].forEach(function (r) {
      var e = tout.filter(function (x) { return x.rub === r && pris.indexOf(x) < 0; })[0];
      if (e) { cmp.push(e); pris.push(e); }
    });
    lire.slice().sort(function (a, b) { return (a.pri - b.pri) || String(b.d || '').localeCompare(String(a.d || '')); }).forEach(function (e) {
      if (tend.length < 4 && pris.indexOf(e) < 0) { tend.push(e); pris.push(e); }
    });
    var reste = tout.filter(function (e) { return pris.indexOf(e) < 0 && (e.rub !== 'actu' || lire.indexOf(e) >= 0); });
    return { une: une, cmp: cmp, tend: tend, reste: reste };
  }
  function x13Source(e) {
    if (e.rub === 'rappel' && /Rappel Conso/.test((e.item && e.item.sur) || '')) return 'Rappel Conso';
    if (e.rub === 'actu' || e.rub === 'concurrent') {
      var m = e.rub === 'concurrent' ? String(e.s || '').split(',')[0] : String((e.item && e.item.meta) || '').split(' · ')[0];
      return m || 'Actualité';
    }
    return X13_SRC[e.rub];
  }
  function x13JoursTxt(j) { return j > 1 ? 'dans ' + j + ' jours' : j === 1 ? 'demain' : 'aujourd’hui'; }
  function x13Age(e) {
    if (e.rub === 'regle' && e.j != null && e.j >= 0) return x13JoursTxt(e.j);
    return e.d ? sctQuand(String(e.d).slice(0, 10)) : '';
  }
  function x13Neuf(e) { var n = ppJ(e.d); return !!e.neuf || (n >= 0 && n <= 1); }
  /* le chiffre de l'info, quand elle en a un ; sinon le pictogramme de la rubrique */
  function x13Chiffre(e) {
    if (e.rub === 'regle' && e.j != null && e.j >= 0) return { n: String(e.j), u: e.j > 1 ? 'jours' : 'jour' };
    var c = e.item && e.item.chiffres && e.item.chiffres[0];
    if (c && String(c.v).length <= 9) { var p = String(c.v).split(' '); return { n: p[0], u: p.slice(1).join(' ') }; }
    return null;
  }
  function x13Couv(e, grand) {
    var c = x13Chiffre(e);
    return '<span class="x13-cv x13-k-' + e.rub + '" aria-hidden="true">' +
      (c ? '<span class="x13-cn"><b>' + esc(c.n) + '</b>' + (c.u ? '<i>' + esc(c.u) + '</i>' : '') + '</span>' : '<span class="x13-ci">' + ppIco(X13_ICO[e.rub] || 'journal', grand ? 64 : 34) + '</span>') + '</span>';
  }
  function x13Ligne(e, sans) {
    var a = x13Age(e);
    return '<span class="x13-m"><span class="x13-src">' + esc(x13Source(e)) + '</span>' + (a ? '<span class="x13-age">' + esc(a) + '</span>' : '') + (!sans && x13Neuf(e) ? '<span class="x13-neuf">Nouveau</span>' : '') + '</span>';
  }
  function x13Compacte(e, i, d) {
    X13.liste[i] = e;
    return '<button type="button" class="x13-c" style="--i:' + d + '" data-x13-i="' + i + '"><span class="x13-ct"><span class="x13-rl"><span class="x13-ru x13-t-' + e.rub + '">' + esc(X13_RUB[e.rub]) + '</span>' + (x13Neuf(e) ? '<span class="x13-neuf">Nouveau</span>' : '') + '</span><span class="x13-t">' + x13T(e.t) + '</span>' + x13Ligne(e, true) + '</span>' + x13Couv(e, false) + '</button>';
  }
  /* les pastilles « Rubriques » : l'accès à chacun des panneaux du poste de pilotage.
     Repliées derrière un seul bouton, avec « Copier le brief » et la fraîcheur des sources ;
     X13.rub garde l'état quand la page est redessinée sous un panneau ouvert. */
  function x13Rubriques(D, J) {
    var S = ppScope(), rad = D.rad.ruptures, nSec = null;
    if (SECTEUR && (SECTEUR.ev || []).length && (S.deps || S.dir)) nSec = ppAnnonces(S.deps).length;
    var L = [
      ['secteur', 'Votre secteur', 'fiche', nSec],
      ['echeances', 'À ne pas manquer', 'loi', D.ep.length],
      ['ruptures', 'Ruptures', 'rupture', rad ? rad.v : null],
      ['rappels', 'Rappels de lot', 'rappel', D.rappels],
      ['concurrents', 'Concurrents', 'concurrent', VERIFS ? VERIFS.length : null],
      ['radar', 'Le radar du jour', 'chercher', (BRIEF.radar || []).length],
      ['mur', 'Toute l’actualité', 'journal', D.fil.length]
    ];
    if (J.length) L.push(['archive', 'Les matins d’avant', 'horloge', J.length]);
    return '<section class="x13-s-rub" aria-label="Rubriques et outils">' +
      '<button type="button" class="x13-tout x13-plus" data-x13-rub aria-expanded="' + (X13.rub ? 'true' : 'false') + '" aria-controls="x13-rub-z"><span>Rubriques et outils</span><span class="x13-tout-f" aria-hidden="true">' + ppIco('bas', 18) + '</span></button>' +
      '<div class="x13-rub-z" id="x13-rub-z"' + (X13.rub ? '' : ' hidden') + '><div class="x13-rubs">' + L.map(function (r) {
      return '<button type="button" class="x13-rb" onclick="V2.ppOuvrir(\'' + r[0] + '\')">' + ppIco(r[2], 18) + '<span>' + esc(r[1]) + '</span>' + (r[3] != null ? '<b>' + esc(r[3]) + '</b>' : '') + '</button>';
    }).join('') + '</div><div class="pp-pied-btns">' +
      '<button type="button" class="pp-btn pp-btn-blanc" data-lbl="Copier le brief" onclick="V2.infosCopyBrief(this)">' + ppIco('copier', 18) + 'Copier le brief</button>' +
      '<button type="button" class="pp-btn pp-btn-blanc" onclick="V2.ppOuvrir(\'sources\')">Voir la fraîcheur des sources</button>' +
      '</div></div></section>';
  }
  function x13Page(D, jour, J) {
    var P = x13Pile(D), u = P.une, i = 0, d = 1, une = '', cmp = '', tend = '';
    X13.liste = [];
    if (u) {
      X13.liste[i] = u;
      une = '<section class="x13-s-une" aria-labelledby="x13-h-une"><h2 class="x13-h" id="x13-h-une">À la une</h2><button type="button" class="x13-une" style="--i:0" data-x13-i="' + i + '">' + x13Couv(u, true) +
        '<span class="x13-cap"><span class="x13-ru x13-t-' + u.rub + '">' + esc(X13_RUB[u.rub]) + '</span><span class="x13-ut">' + x13T(u.t) + '</span>' + x13Ligne(u) + '</span></button></section>';
      i++;
    }
    if (P.cmp.length) {
      cmp = '<section class="x13-s-cmp" aria-labelledby="x13-h-cmp"><h2 class="x13-h x13-sr" id="x13-h-cmp">Ensuite</h2><div class="x13-liste">' + P.cmp.map(function (e) { var h = x13Compacte(e, i, d); i++; d++; return h; }).join('') + '</div>';
      if (P.reste.length) {
        cmp += '<button type="button" class="x13-tout" data-x13-tout aria-expanded="false" aria-controls="x13-reste"><span>Tout voir<b>' + ppPl(P.reste.length, 'autre info', 'autres infos') + '</b></span><span class="x13-tout-f" aria-hidden="true">' + ppIco('bas', 18) + '</span></button>' +
          '<div class="x13-reste" id="x13-reste" hidden><div class="x13-liste">' + P.reste.map(function (e) { var h = x13Compacte(e, i, 0); i++; return h; }).join('') + '</div></div>';
      }
      cmp += '</section>';
    }
    if (P.tend.length) {
      tend = '<section class="x13-s-tend" aria-labelledby="x13-h-tend"><h2 class="x13-h" id="x13-h-tend">Tendances</h2><ol class="x13-tendances">' + P.tend.map(function (e, k) {
        X13.liste[i] = e;
        var h = '<li><button type="button" class="x13-tr" style="--i:' + (d + k) + '" data-x13-i="' + i + '"><span class="x13-tn x13-t-' + e.rub + '" aria-hidden="true">' + (k + 1) + '</span><span class="x13-tx"><span class="x13-tsrc">' + esc(x13Source(e)) + '</span><span class="x13-tt">' + x13T(e.t) + '</span></span></button></li>';
        i++; return h;
      }).join('') + '</ol></section>';
    }
    return '<div class="w-page x13"><header class="x13-tete"><h1><span class="x13-h1a">Infos du jour</span><span class="x13-h1b">' + esc(PP_JS[new Date(jour + 'T12:00:00').getDay()] + ' ' + ppDc(jour)) + '</span></h1></header>' +
      une + cmp + tend + x13Rubriques(D, J) + '</div>';
  }

  /* ── la feuille de lecture : naît de la carte touchée ── */
  function x13Feuille() {
    var sh = document.getElementById('x13-sheet');
    if (sh) return sh;
    var w = document.createElement('div');
    w.innerHTML = '<div class="x13-voile" id="x13-voile" hidden></div><div class="x13-sheet" id="x13-sheet" role="dialog" aria-modal="true" tabindex="-1" hidden></div>';
    while (w.firstChild) document.body.appendChild(w.firstChild);
    return document.getElementById('x13-sheet');
  }
  function x13OuvertQ() { var s = document.getElementById('x13-sheet'); return !!(s && !s.hidden); }
  /* les « points » qui répètent déjà le résumé ne s'affichent pas deux fois (comme dans la maquette) */
  function x13Item(it) {
    var ps = (it.paras || []).filter(Boolean), r0 = norm(ps[0] || '');
    var o = {}; for (var k in it) o[k] = it[k];
    o.paras = ps.filter(function (p, i) { return !i || r0.indexOf(norm(p).slice(0, 60)) < 0; });
    return o;
  }
  function x13Feuillet(e) {
    var c = x13Chiffre(e);
    return '<div class="x13-s-cv x13-k-' + e.rub + '"><button type="button" class="x13-retour" data-x13-ferme aria-label="Fermer l’article">' + ppIco('retour', 22) + '</button>' +
      '<div class="x13-s-tt">' + (c ? '<span class="x13-s-n" aria-hidden="true"><b>' + esc(c.n) + '</b>' + (c.u ? '<i>' + esc(c.u) + '</i>' : '') + '</span>' : '<span class="x13-s-i" aria-hidden="true">' + ppIco(X13_ICO[e.rub] || 'journal', 72) + '</span>') +
      '<span class="x13-s-ru">' + esc(X13_RUB[e.rub]) + '</span><h2>' + x13T(e.t) + '</h2><span class="x13-s-m">' + esc(x13Source(e)) + (x13Age(e) ? ' · ' + esc(x13Age(e)) : '') + '</span></div></div>' +
      '<div class="x13-s-corps">' + ppLecture(x13Item(e.item), true) + '</div>';
  }
  /* on ne laisse voir que le coin haut gauche de la feuille, posé exactement sur la carte, puis il grandit */
  function x13Depart(sh, r, box) {
    sh.style.clipPath = 'inset(0px ' + Math.max(0, box.width - r.width) + 'px ' + Math.max(0, box.height - r.height) + 'px 0px round 22px)';
    sh.style.transform = 'translate(' + Math.round(r.left - box.left) + 'px,' + Math.round(r.top - box.top) + 'px)';
  }
  function x13Ouvre(card) {
    var e = X13.liste[+card.getAttribute('data-x13-i')]; if (!e) return;
    var sh = x13Feuille(), vo = document.getElementById('x13-voile');
    clearTimeout(X13.fin); X13.orig = card;
    sh.innerHTML = x13Feuillet(e); sh.hidden = false; vo.hidden = false; sh.scrollTop = 0;
    sh.setAttribute('aria-label', e.t);
    var box = sh.getBoundingClientRect(), r = card.getBoundingClientRect();
    sh.style.transition = 'none'; x13Depart(sh, r, box);
    void sh.offsetWidth;
    sh.style.transition = ''; sh.style.clipPath = ''; sh.style.transform = ''; sh.classList.add('ouvert'); vo.classList.add('ouvert');
    document.documentElement.classList.add('x13-fige');
    var b = sh.querySelector('.x13-retour'); try { b.focus({ preventScroll: true }); } catch (er) {}
  }
  function x13Ferme() {
    var sh = document.getElementById('x13-sheet'), vo = document.getElementById('x13-voile');
    if (!sh || sh.hidden) return;
    var o = X13.orig, r = o && document.body.contains(o) ? o.getBoundingClientRect() : null, box = sh.getBoundingClientRect();
    sh.classList.remove('ouvert'); vo.classList.remove('ouvert');
    if (r) x13Depart(sh, r, box);
    document.documentElement.classList.remove('x13-fige');
    clearTimeout(X13.fin);
    X13.fin = setTimeout(function () {
      sh.hidden = true; vo.hidden = true; sh.style.clipPath = ''; sh.style.transform = ''; sh.innerHTML = '';
      if (o && document.body.contains(o)) { try { o.focus({ preventScroll: true }); } catch (er) {} }
    }, 560);
  }
  /* fermeture immédiate, sans animation ni focus : on quitte la page, on ouvre une fiche, la page est redessinée */
  function x13Reset() {
    clearTimeout(X13.fin);
    document.documentElement.classList.remove('x13-fige');
    var sh = document.getElementById('x13-sheet'), vo = document.getElementById('x13-voile');
    if (sh) { sh.classList.remove('ouvert'); sh.hidden = true; sh.style.clipPath = ''; sh.style.transform = ''; sh.innerHTML = ''; }
    if (vo) { vo.classList.remove('ouvert'); vo.hidden = true; }
  }
  function x13Ecoute(e) {
    if (e.type === 'keydown') {
      if (!x13OuvertQ()) return;
      if (e.key === 'Escape') x13Ferme();
      else if (e.key === 'Tab') {
        /* le focus tourne dans la feuille, à la main : Safari saute boutons et liens avec Tab, le focus partirait sur la page derrière */
        var f = [].slice.call(document.getElementById('x13-sheet').querySelectorAll('button,a[href]'));
        if (f.length) {
          e.preventDefault();
          var i = f.indexOf(document.activeElement);
          i = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length;
          f[i].focus();
        }
      }
      return;
    }
    if (e.type === 'touchstart') { var t0 = e.touches[0]; X13.tx = (t0 && e.target.closest && e.target.closest('.x13-sheet')) ? { x: t0.clientX, y: t0.clientY } : null; return; }
    if (e.type === 'touchend') {
      var t1 = e.changedTouches && e.changedTouches[0];
      if (X13.tx && t1) { var dx = t1.clientX - X13.tx.x, dy = Math.abs(t1.clientY - X13.tx.y); if (dx > 90 && dy < 60 && X13.tx.x < 60) x13Ferme(); }
      X13.tx = null; return;
    }
    if (!e.target.closest) return;
    if (e.target.closest('[data-x13-ferme]') || (e.target.classList && e.target.classList.contains('x13-voile'))) { x13Ferme(); return; }
    var root = e.target.closest('.x13'); if (!root) return;
    var t;
    if ((t = e.target.closest('[data-x13-tout]'))) {
      var z = root.querySelector('.x13-reste'); z.hidden = false; t.setAttribute('aria-expanded', 'true'); t.hidden = true;
      var p1 = z.querySelector('.x13-c'); if (p1) { try { p1.focus({ preventScroll: true }); } catch (er) {} }
      return;
    }
    if ((t = e.target.closest('[data-x13-rub]'))) {
      var zr = root.querySelector('.x13-rub-z'); X13.rub = zr.hidden; zr.hidden = !X13.rub; t.setAttribute('aria-expanded', X13.rub ? 'true' : 'false');
      if (X13.rub) { try { zr.scrollIntoView({ block: 'nearest' }); } catch (er) {} }
      return;
    }
    if ((t = e.target.closest('.x13-c,.x13-une,.x13-tr'))) x13Ouvre(t);
  }
  if (!V2._x13Ecoute) {
    V2._x13Ecoute = true;
    document.addEventListener('click', x13Ecoute);
    document.addEventListener('keydown', x13Ecoute);
    document.addEventListener('touchstart', x13Ecoute, { passive: true });
    document.addEventListener('touchend', x13Ecoute, { passive: true });
    // on lit l'adresse elle-même : cet écouteur passe AVANT celui du routeur (v2-app.js), V2.route date encore de l'écran quitté
    window.addEventListener('hashchange', function () { if ((location.hash || '').replace(/^#/, '').split('/')[0] !== 'infos') { x13Reset(); X13.rub = false; } });
  }

  /* ════════════════════════════ RENDU ════════════════════════════ */
  V2.pages.infos = {
    needs: [],   // audité 11/09/2026 : aucune lecture du catalogue
    render: function (root) {
      injectStyles();

      if (!LOADED && !FAILED) {
        load(function () { if (V2.route && V2.route.name === 'infos') V2.render(); });
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap inf2">' +
            '<div class="inf-load"><div class="inf-spin"></div><span>Composition de l\'édition du matin…</span></div>' +
          '</div>';
        return;
      }
      if (!BRIEF || !(BRIEF.cinq || []).length) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap inf2"><div class="inf-empty">' +
            '<div class="inf-empty-ic">' + ICO('spark', 26, 2) + '</div>' +
            '<div class="inf-empty-t">' + (FAILED ? "L'édition du matin n'a pas pu être chargée" : "Pas encore d'édition aujourd'hui") + '</div>' +
            '<div class="inf-empty-d">' + (FAILED ? 'Vérifiez votre connexion. L\'édition se compose chaque matin vers 9 h.' : 'L\'édition se compose automatiquement chaque matin vers 9 h.') + '</div>' +
          '</div></div>';
        return;
      }

      var D = ppDonnees(), C = D.C, nSrc = (C.sources_lues || []).length || C.fichiers || 0;
      var jour = /^\d{4}-\d{2}-\d{2}$/.test(BRIEF.jour || '') ? BRIEF.jour : new Date().toISOString().slice(0, 10);
      var gen = '';
      try {
        var g = new Date(BRIEF.genere);
        gen = 'Édition composée le ' + g.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).replace(/^1 /, '1er ') + ' à ' + g.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', ' h ') +
          ' à partir de <b>' + ppPl(nSrc, 'source') + '</b>' + (SECTEUR && SECTEUR.maj ? ' · Bodacc à jour du ' + esc(ppDc(SECTEUR.maj)) : '') + '.';
      } catch (e) {}
      var J = (ARCHIVE && ARCHIVE.jours) || [];

      x13Reset();   // la page est redessinée : une feuille restée ouverte n'a plus sa carte
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap inf2 pp">' +
          '<span class="pp-ciel" aria-hidden="true"></span>' +
          x13Page(D, jour, J) +
          '<footer class="pp-pied"><span>' + gen + '</span></footer>' +
        '</div>';

      // venu de l'ancienne feature « Concurrents » (#infos/concurrents) : ouvrir directement son panneau
      if (V2.route && V2.route.param === 'concurrents' && !PP_CONC_AUTO) { PP_CONC_AUTO = true; if (!ppOuvert()) PP_VUES.concurrents(); }
    }
  };

  function injectStyles() {
    if (document.getElementById('v2-infos-css')) return;
    var st = document.createElement('style'); st.id = 'v2-infos-css';
    st.textContent = [
      /* ── attente et édition absente ── */
      '.inf2 .inf-load{display:flex;align-items:center;justify-content:center;gap:12px;padding:var(--sp-8) var(--sp-4);color:var(--muted);font-size:14px}',
      '.inf2 .inf-spin{width:20px;height:20px;border-radius:50%;border:2.4px solid var(--line-strong);border-top-color:var(--ip-blue);animation:infspin .8s linear infinite}',
      '@keyframes infspin{to{transform:rotate(360deg)}}',
      '@media(prefers-reduced-motion:reduce){.inf2 .inf-spin{animation-duration:2.4s}}',
      '.inf2 .inf-empty{text-align:center;padding:var(--sp-8) var(--sp-4);background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1)}',
      '.inf2 .inf-empty-ic{color:var(--muted-2);margin-bottom:12px}',
      '.inf2 .inf-empty-t{font-size:16.5px;font-weight:700;color:var(--ip-ink);margin-bottom:7px}',
      '.inf2 .inf-empty-d{font-size:13.5px;color:var(--muted);max-width:38ch;margin:0 auto;line-height:1.5}',

      /* ══════════ LE POSTE DE PILOTAGE (m1) ══════════
         Maquette ~/maquette-infos-page-entiere/m1.html, reprise telle quelle sous le préfixe .pp.
         Lumière : halo blanc en haut à gauche, contre-jour bleu en haut à droite, liseré sur
         l'arête de chaque tuile, reflet qui suit la souris, horizon lumineux sous le titre.
         Onest pour le texte, Martian Mono pour les chiffres (chargées dans index.html).
         Aucune des propriétés qui font figer Safari : que des dégradés, des ombres et une rotation. */
      '.pp,#pp-pan,#pp-voile,#x13-sheet,#x13-voile{--pp-fond:#DFE4EC;--pp-encre:#0F1420;--pp-encre2:#465066;--pp-encre3:#5E677A;--pp-bleu:#0050E6;--pp-bleu-f:#003FB8;--pp-halo:#E9F0FF;' +
        '--pp-vert:#1E9E6A;--pp-vert-f:#157A51;--pp-ambre:#C7791A;--pp-ambre-f:#9A5A0C;--pp-rose:#E0556E;--pp-rose-f:#BE3450;--pp-violet:#6D4FC4;--pp-cyan:#00B5D8;' +
        '--pp-r:26px;--pp-mono:"Martian Mono",ui-monospace,Menlo,monospace;--pp-sans:"Onest",-apple-system,"Helvetica Neue",Arial,sans-serif;' +
        '--pp-ombre:0 1px 0 rgba(255,255,255,.95) inset,0 -1px 0 rgba(15,20,32,.035) inset,0 1px 2px rgba(15,20,32,.06),0 22px 40px -22px rgba(0,48,140,.32)}',
      '.v2-wrap.inf2.pp{position:relative;max-width:1272px;padding:0 16px 8px;color:var(--pp-encre);font:400 15px/1.45 var(--pp-sans);font-feature-settings:"tnum" 1}',
      /* 25/09 — le rond « + » flottant (.v2-fab, 58 px, bas droite) couvrait au bureau le bouton « Voir la fraîcheur des sources » en fin de page : le bas défile au-delà, à toutes les largeurs */
      'body:has(.v2-fab:not([hidden])) .v2-wrap.inf2.pp{padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))}',
      '.pp *,#pp-pan *{box-sizing:border-box}',
      '.pp button,#pp-pan button,#pp-pan select{font-family:inherit;cursor:pointer}',
      '#pp-pan .pp-onglets button{color:var(--pp-encre)}',
      '.pp-ciel{position:fixed;inset:0;z-index:-1;pointer-events:none;' +
        'background:radial-gradient(900px 620px at 8% -8%,rgba(255,255,255,.98),rgba(255,255,255,0) 62%),' +
        'radial-gradient(700px 520px at 100% 0%,rgba(0,80,230,.13),rgba(0,80,230,0) 64%),' +
        'radial-gradient(900px 700px at 50% 110%,rgba(0,181,216,.10),rgba(0,181,216,0) 60%),' +
        'linear-gradient(180deg,#E8ECF3 0%,#DFE4EC 38%,#D7DDE8 100%)}',
      '.pp .pp-mono{font-family:var(--pp-mono);font-feature-settings:"tnum" 1,"zero" 1}',

      /* boutons (pied de page, feuilles et panneau) */
      '.pp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border-radius:14px;border:1px solid transparent;font:600 15px/1.2 var(--pp-sans);text-decoration:none;white-space:nowrap}',
      '.pp-btn-bleu{background:linear-gradient(180deg,#1E66F0,#0050E6 55%,#0047CC);color:#fff!important;box-shadow:0 1px 0 rgba(255,255,255,.35) inset,0 8px 18px -8px rgba(0,80,230,.7)}',
      '.pp-btn-blanc{background:linear-gradient(180deg,#fff,#F5F7FB);border-color:#E3E8F1;color:var(--pp-encre);box-shadow:0 1px 0 #fff inset,0 2px 6px -2px rgba(15,20,32,.12)}',
      '.pp-btn:active{transform:translateY(1px)}',
      '.pp-btn svg{flex:none}',

      /* secteur */
      /* secteur : légende et carte du panneau */
      '.pp-legende{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0;padding:0;list-style:none}',
      '.pp-legende li{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--pp-encre2)}',
      '.pp-legende i{width:9px;height:9px;border-radius:50%;display:block}',
      '.pp-legende b{font:600 13px var(--pp-mono);color:var(--pp-encre)}',
      '.pp-dep{stroke:#B9C6DB;stroke-width:1.4;vector-effect:non-scaling-stroke;stroke-linejoin:round}',
      '.pp-voisin{fill:#E4EAF3;stroke:#CFD8E6;stroke-width:1;vector-effect:non-scaling-stroke;stroke-linejoin:round}',
      '.pp-halo{transform-box:fill-box;transform-origin:center;animation:pp-onde 2.6s ease-out infinite}',
      '@keyframes pp-onde{0%{transform:scale(.6);opacity:.7}100%{transform:scale(2.6);opacity:0}}',
      '.pp-carte-n{font-family:var(--pp-mono);font-weight:600;fill:#0034A0;text-anchor:middle;pointer-events:none}',

      /* pied */
      '.pp .pp-pied{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:12px;align-items:flex-start;padding:22px 0 40px;font-size:14px;color:var(--pp-encre2)}',
      '@media (min-width:720px){.pp .pp-pied{flex-direction:row;align-items:center;justify-content:space-between}}',

      /* ── le panneau ── */
      '#pp-voile{position:fixed;inset:0;background:rgba(15,20,32,.38);opacity:0;pointer-events:none;transition:opacity .25s;z-index:9440}',
      '#pp-voile.ouvert{opacity:1;pointer-events:auto}',
      '#pp-pan{position:fixed;z-index:9450;left:0;right:0;bottom:0;top:0;display:flex;flex-direction:column;background:#F4F6FA;color:var(--pp-encre);font:400 15px/1.45 var(--pp-sans);' +
        'transform:translateY(102%);transition:transform .34s cubic-bezier(.2,.8,.2,1);visibility:hidden}',
      '#pp-pan.ouvert{transform:none;visibility:visible}',
      '@media (min-width:900px){#pp-pan{left:auto;width:600px;border-radius:28px 0 0 28px;transform:translateX(102%);box-shadow:-30px 0 60px -30px rgba(0,30,90,.4)}}',
      '#pp-pan .pp-p-tete{position:relative;flex:none;display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));' +
        'background:linear-gradient(180deg,#FFFFFF,#F7F9FC);border-bottom:1px solid #E3E8F0}',
      '@media (min-width:900px){#pp-pan .pp-p-tete{border-radius:28px 0 0 0}}',
      '#pp-pan .pp-rond{flex:none;width:44px;height:44px;border-radius:50%;border:1px solid #E1E6EF;background:linear-gradient(180deg,#fff,#F3F5F9);display:grid;place-items:center;color:var(--pp-encre);padding:0}',
      '#pp-pan .pp-rond[hidden]{display:none}',
      '#pp-pan .pp-p-sur{flex:1;min-width:0;font:650 13px/1.2 var(--pp-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--pp-encre2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#pp-pan .pp-p-corps{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:18px 16px 40px}',
      '#pp-pan h2{margin:0;font:800 25px/1.15 var(--pp-sans);letter-spacing:-.025em;color:var(--pp-encre)}',
      '#pp-pan h3{margin:26px 0 10px;font:650 13px/1.2 var(--pp-sans);text-transform:uppercase;color:var(--pp-encre2);letter-spacing:.06em;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '#pp-pan h3 b{font-weight:600;color:var(--pp-encre)}',
      '#pp-pan .pp-h3-s{text-transform:none;letter-spacing:0;font-weight:500;color:var(--pp-encre3);font-size:13px}',
      '#pp-pan p{margin:10px 0 0;font-size:16px;line-height:1.55}',
      '#pp-pan .pp-meta,#x13-sheet .pp-meta{margin-top:8px;font-size:14px;color:var(--pp-encre2)}',
      '#pp-pan .pp-chapo{font-size:16px;color:var(--pp-encre2);margin-top:8px}',
      '#pp-pan .pp-note{font-size:13px;color:var(--pp-encre3);margin-top:6px;line-height:1.45}',
      '#pp-pan .pp-geste,#x13-sheet .pp-geste{margin-top:18px;padding:14px 16px;border-radius:18px;background:linear-gradient(135deg,#F4F8FF,var(--pp-halo));border:1px solid #D6E3FF;font-size:15px;line-height:1.45}',
      '#pp-pan .pp-geste b,#x13-sheet .pp-geste b{display:block;font:650 13px var(--pp-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--pp-bleu-f);margin-bottom:4px}',
      '#pp-pan .pp-geste.pp-alerte,#x13-sheet .pp-geste.pp-alerte{background:linear-gradient(135deg,#FFF6F7,#FCE8EC);border-color:#F6C6D0}',
      '#pp-pan .pp-geste.pp-alerte b,#x13-sheet .pp-geste.pp-alerte b{color:var(--pp-rose-f)}',
      '#pp-pan .pp-bloc{background:#fff;border-radius:20px;box-shadow:0 1px 0 #fff inset,0 1px 2px rgba(15,20,32,.05),0 10px 24px -18px rgba(0,48,140,.3);overflow:hidden}',
      '#pp-pan .pp-ligne{display:flex;align-items:flex-start;gap:12px;width:100%;min-height:56px;margin:0;padding:12px 14px;border:0;border-top:1px solid #EDF0F5;background:none;text-align:left;font:inherit;color:var(--pp-encre)}',
      '#pp-pan .pp-bloc>.pp-ligne:first-child,#pp-pan .pp-bloc>div[hidden]+.pp-ligne{border-top:0}',
      '#pp-pan button.pp-ligne:hover{background:#F7F9FD}',
      '#pp-pan .pp-ligne.lu .pp-lt{font-weight:500;color:var(--pp-encre2)}',
      '#pp-pan .pp-ico{flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;color:#fff;background:var(--c,var(--pp-bleu));box-shadow:0 1px 0 rgba(255,255,255,.3) inset}',
      '#pp-pan .pp-ico-n{width:auto;min-width:64px;padding:0 8px;font:600 16px var(--pp-mono)}',
      '#pp-pan .pp-txt{flex:1;min-width:0}',
      '#pp-pan .pp-lt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-weight:600;font-size:15px;line-height:1.3}',
      '#pp-pan .pp-ls{display:block;font-size:13px;color:var(--pp-encre2);margin-top:3px;line-height:1.35}',
      '#pp-pan .pp-ld{flex:none;max-width:92px;font:500 13px/1.3 var(--pp-mono);color:var(--pp-encre2);padding-top:2px;text-align:right}',
      '#pp-pan .pp-ld.chaud{color:var(--pp-ambre-f)}',
      '#pp-pan .pp-ld.urgent{color:var(--pp-rose-f)}',
      '#pp-pan .pp-badge,#x13-sheet .pp-badge{display:inline-block;font:600 13px/1 var(--pp-sans);padding:4px 7px;border-radius:7px;background:var(--pp-halo);color:var(--pp-bleu-f);vertical-align:1px;margin-right:4px}',
      '#pp-pan .pp-badge.vert,#x13-sheet .pp-badge.vert{background:#E2F4EC;color:var(--pp-vert-f)}',
      '#pp-pan .pp-badge.rose,#x13-sheet .pp-badge.rose{background:#FCE8EC;color:var(--pp-rose-f)}',
      '#pp-pan .pp-badge.ambre,#x13-sheet .pp-badge.ambre{background:#FBF0E1;color:var(--pp-ambre-f)}',
      '#pp-pan .pp-badge.gris,#x13-sheet .pp-badge.gris{background:#EEF1F6;color:var(--pp-encre2)}',
      '#pp-pan .pp-plus{display:flex;width:100%;align-items:center;justify-content:center;gap:6px;min-height:52px;border:0;border-top:1px solid #EDF0F5;background:#FBFCFE;color:var(--pp-bleu);font-weight:600;font-size:15px}',
      '#pp-pan .pp-puces{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}',
      '#pp-pan .pp-puce{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;border-radius:22px;border:1px solid #DCE3EE;background:#fff;font-size:14px;font-weight:600;color:var(--pp-encre)}',
      '#pp-pan .pp-puce i{width:9px;height:9px;border-radius:50%}',
      '#pp-pan .pp-puce .pp-n{font:500 13px var(--pp-mono);color:var(--pp-encre2)}',
      '#pp-pan .pp-puce[aria-pressed="true"]{background:var(--pp-encre);border-color:var(--pp-encre);color:#fff}',
      '#pp-pan .pp-puce[aria-pressed="true"] .pp-n{color:#C9D2E3}',
      '#pp-pan .pp-bascule{display:flex;gap:4px;padding:4px;border-radius:16px;background:#E6EBF3;box-shadow:0 1px 2px rgba(15,20,32,.06) inset;margin-top:14px}',
      '#pp-pan .pp-bascule button{flex:1;min-height:44px;border:0;border-radius:12px;background:none;font-weight:600;font-size:14px;color:var(--pp-encre2)}',
      '#pp-pan .pp-bascule button[aria-pressed="true"]{background:#fff;color:var(--pp-encre);box-shadow:0 1px 3px rgba(15,20,32,.14)}',
      '#pp-pan .pp-select{display:block;width:100%;min-height:46px;margin-top:10px;padding:0 12px;border-radius:14px;border:1px solid #D6DDE8;background:#fff;font:500 16px var(--pp-sans);color:var(--pp-encre)}',
      '#pp-pan .pp-carte-p{position:relative;margin-top:14px;border-radius:22px;background:radial-gradient(120% 90% at 25% 0%,#FAFCFF,#EAF0F9 70%);box-shadow:0 1px 0 #fff inset,0 0 0 1px #DCE4F0 inset;overflow:hidden}',
      '#pp-pan .pp-carte-p svg{display:block;width:100%;height:340px;touch-action:manipulation;cursor:pointer}',
      '#pp-pan .pp-carte-aide{position:absolute;right:12px;top:10px;pointer-events:none;font-size:13px;color:var(--pp-encre2);background:rgba(255,255,255,.88);padding:4px 9px;border-radius:9px}',
      '#pp-pan .pp-champ-wrap{position:relative;margin-top:14px}',
      '#pp-pan .pp-champ-wrap svg{position:absolute;left:14px;top:15px;color:var(--pp-encre2)}',
      '#pp-pan .pp-champ{width:100%;min-height:48px;padding:0 14px 0 42px;border-radius:14px;border:1px solid #D6DDE8;background:#fff;font:400 16px var(--pp-sans);color:var(--pp-encre)}',
      '#pp-pan .pp-champ:focus{outline:3px solid rgba(0,80,230,.25);border-color:var(--pp-bleu)}',
      '#pp-pan .pp-onglets{display:flex;gap:6px;overflow-x:auto;margin:14px -16px 0;padding:0 16px 2px;scrollbar-width:none}',
      '#pp-pan .pp-onglets::-webkit-scrollbar{display:none}',
      '#pp-pan .pp-onglets button{flex:none;min-height:44px;padding:0 16px;border-radius:14px;border:1px solid #DCE3EE;background:#fff;font-weight:600;font-size:14px}',
      '#pp-pan .pp-onglets button[aria-selected="true"]{background:var(--pp-bleu);border-color:var(--pp-bleu);color:#fff;box-shadow:0 8px 16px -10px rgba(0,80,230,.8)}',
      '#pp-pan [data-pp-conc-corps]>.cnc,#pp-pan [data-pp-conc-corps]>.gr-wrap{margin-top:16px}',
      /* blocs des modules concurrents montés dans le panneau : rien sous 13 px */
      '#pp-pan .cnc-angle b,#pp-pan .gr-vf-k,#pp-pan .gr-vf-m,#pp-pan .gr-vf-d,#pp-pan .gr-vf-t,#pp-pan .gr-vf-s,#pp-pan .gr-vf-nc,#pp-pan .gr-vf-plus summary,#pp-pan .gr-vf-rien,' +
        '#pp-pan .gr-actutag,#pp-pan .gr-actumaj,#pp-pan .gr-actu-meta,#pp-pan .gr-actu-res,#pp-pan .gr-actu-acc{font-size:13px}',
      '#pp-pan .pp-chiffres,#x13-sheet .pp-chiffres{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}',
      '#pp-pan .pp-chiffres div,#x13-sheet .pp-chiffres div{background:#fff;border-radius:18px;padding:14px;box-shadow:0 1px 2px rgba(15,20,32,.05)}',
      '#pp-pan .pp-chiffres b,#x13-sheet .pp-chiffres b{display:block;font:600 26px/1 var(--pp-mono);letter-spacing:-.04em}',
      '#pp-pan .pp-chiffres span,#x13-sheet .pp-chiffres span{display:block;font-size:13px;color:var(--pp-encre2);margin-top:6px;line-height:1.3}',
      '#pp-pan .pp-actions,#x13-sheet .pp-actions{display:flex;flex-direction:column;gap:10px;margin-top:22px}',
      '#pp-pan .pp-actions .pp-btn,#x13-sheet .pp-actions .pp-btn{width:100%;white-space:normal;text-align:center}',
      '#pp-pan .pp-vide{padding:18px 14px;font-size:14px;color:var(--pp-encre2)}',
      'html.pp-fige{overflow:hidden}',

      /* ══════════ LA UNE (maquette 13, 08/10/2026) ══════════
         Reprise de la maquette 13 sous le préfixe .x13 ; la feuille et son voile sont dans <body>. */
      '/* ── vue 13 : « La une », modèle Apple News (préfixe x13-) ── */',
      '.x13{max-width:1180px;margin:0 auto;padding:14px 0 12px;--x13-r:22px;--x13-bord:1px solid rgba(255,255,255,.85);--x13-fond:linear-gradient(180deg,#fff 0%,#FBFCFE 60%,#F3F6FB 100%)}',
      '.x13-k-regle{--c:#C7791A;--l:#E9A850;--d:#7A4608}',
      '.x13-k-rupture{--c:#E0556E;--l:#F58AA0;--d:#A22640}',
      '.x13-k-rappel{--c:#BE3450;--l:#E0728A;--d:#8A1B34}',
      '.x13-k-officine{--c:#0050E6;--l:#5A8CFF;--d:#0A32A0}',
      '.x13-k-concurrent{--c:#6D4FC4;--l:#A68CF0;--d:#46309A}',
      '.x13-k-actu{--c:#0A7F99;--l:#45C0D8;--d:#04556A}',
      '.x13-t-regle{color:#8A500A}.x13-t-rupture{color:#B02A46}.x13-t-rappel{color:#8E1C36}.x13-t-officine{color:#0042C0}.x13-t-concurrent{color:#5B3FB0}.x13-t-actu{color:#07687E}',
      '/* en-tête : le nom de l\'écran noir, la date grise, les deux en très gros (comme « News / September 22 ») */',
      '.x13-tete{padding:2px 2px 0}',
      '.x13 h1{margin:0;display:flex;flex-direction:column;font:800 clamp(32px,9.2vw,38px)/1.0 var(--pp-sans);letter-spacing:-.04em;color:var(--pp-encre)}',
      '.x13-h1b{color:#6A7487}',
      '.x13-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
      '.x13-h{margin:0 0 6px;padding:0 2px;font:800 22px/1.1 var(--pp-sans);letter-spacing:-.025em;color:var(--pp-bleu)}',
      '.x13{display:grid;grid-template-columns:minmax(0,1fr);gap:0}',
      '.x13>section{margin-top:10px}',
      '/* la une */',
      '.x13-une{position:relative;display:block;width:100%;padding:0;margin:0;overflow:hidden;text-align:left;font:inherit;color:inherit;cursor:pointer;border-radius:var(--x13-r);border:var(--x13-bord);background:var(--x13-fond);box-shadow:var(--pp-ombre);-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s ease;animation:x13-in .5s cubic-bezier(.2,.8,.2,1) backwards}',
      '.x13-une .x13-cv{display:block;height:min(36vw,148px);min-height:136px;border-radius:0}',
      '.x13-cap{display:flex;flex-direction:column;gap:4px;padding:10px 16px 12px}',
      '.x13-ut{font:800 23px/1.17 var(--pp-sans);letter-spacing:-.022em;color:var(--pp-encre);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
      '.x13-ru{font:700 13px/1.2 var(--pp-sans);letter-spacing:.06em;text-transform:uppercase}',
      '.x13-rl{display:flex;align-items:center;gap:8px;min-height:18px}',
      '.x13-c .x13-m{flex-wrap:nowrap;white-space:nowrap;overflow:hidden}',
      '.x13-c .x13-src{overflow:hidden;text-overflow:ellipsis;min-width:0}',
      '.x13-c .x13-age{flex:none}',
      '.x13-m{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;font:500 13px/1.3 var(--pp-sans);color:#566074}',
      '.x13-src{font-weight:650;color:var(--pp-encre2)}',
      '.x13-age::before{content:"·";margin-right:8px;color:#8A93A4}',
      '.x13-neuf{display:inline-flex;align-items:center;min-height:22px;padding:0 9px;border-radius:11px;background:var(--pp-halo);box-shadow:inset 0 0 0 1px #CFE0FF;color:var(--pp-bleu-f);font:700 13px/1 var(--pp-sans)}',
      '/* couverture : un aplat de la couleur de la rubrique, la lumière en haut à gauche, le plus dense en bas à droite */',
      '.x13-cv,.x13-s-cv{position:relative;display:block;overflow:hidden;color:#fff;background:radial-gradient(130% 95% at 0% 0%,var(--l) 0%,var(--c) 30%,var(--d) 72%,var(--d) 100%)}',
      '.x13-cv::after,.x13-s-cv::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 70% at 100% 110%,rgba(0,0,0,.22),rgba(0,0,0,0) 70%);box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}',
      '.x13-cn{position:absolute;left:16px;bottom:10px;display:flex;align-items:baseline;gap:8px;z-index:1}',
      '.x13-cn b{font:800 68px/.9 var(--pp-sans);letter-spacing:-.05em;font-variant-numeric:tabular-nums}',
      '.x13-cn i{font:700 24px/1 var(--pp-sans);font-style:normal;letter-spacing:-.01em}',
      '.x13-ci{position:absolute;left:16px;bottom:14px;z-index:1;display:block;line-height:0}',
      '/* cartes compactes : le titre à gauche, la petite couverture carrée à droite */',
      '.x13-liste{display:flex;flex-direction:column;gap:10px}',
      '.x13-c{position:relative;display:flex;align-items:stretch;gap:14px;width:100%;margin:0;padding:10px 12px 10px 16px;text-align:left;font:inherit;color:inherit;cursor:pointer;border-radius:var(--x13-r);border:var(--x13-bord);background:var(--x13-fond);box-shadow:var(--pp-ombre);min-height:92px;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s ease;animation:x13-in .46s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--i) * 70ms)}',
      '.x13-ct{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;justify-content:center}',
      '.x13-t{font:700 17px/1.22 var(--pp-sans);letter-spacing:-.012em;color:var(--pp-encre);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
      '.x13-c .x13-cv{flex:none;width:76px;height:76px;align-self:center;border-radius:14px}',
      '.x13-c .x13-ci{left:50%;top:50%;bottom:auto;transform:translate(-50%,-50%)}',
      '.x13-c .x13-cn{left:8px;bottom:6px}',
      '.x13-c .x13-cn b{font-size:34px}',
      '.x13-c .x13-cn i{font-size:13px}',
      '/* « Tout voir » */',
      '.x13-tout{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:46px;margin:10px 0 0;padding:0 8px 0 18px;border-radius:26px;border:var(--x13-bord);background:var(--x13-fond);box-shadow:var(--pp-ombre);font:700 16px/1.2 var(--pp-sans);color:var(--pp-bleu-f);cursor:pointer;text-align:left;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;transition:transform .2s ease}',
      '.x13-tout b{margin-left:10px;font:500 14px/1 var(--pp-sans);color:var(--pp-encre2)}',
      '.x13-tout-f{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--pp-halo);color:var(--pp-bleu)}',
      '.x13-reste{margin-top:10px}',
      '.x13-reste:not([hidden]) .x13-c{animation:x13-in .4s cubic-bezier(.2,.8,.2,1) backwards}',
      '/* tendances : titres numérotés */',
      '.x13-tendances{margin:0;padding:4px 0;list-style:none;border-radius:var(--x13-r);border:var(--x13-bord);background:var(--x13-fond);box-shadow:var(--pp-ombre);overflow:hidden}',
      '.x13-tendances li+li{border-top:1px solid #E3E8F1;margin:0 16px}',
      '.x13-tr{display:flex;align-items:center;gap:14px;width:100%;min-height:56px;margin:0;padding:6px 16px;text-align:left;font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;transition:background .15s ease;animation:x13-in .46s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--i) * 70ms)}',
      '.x13-tendances li+li .x13-tr{margin:0 -16px;width:calc(100% + 32px)}',
      '.x13-tn{flex:none;width:26px;font:800 32px/1 var(--pp-sans);letter-spacing:-.04em;font-variant-numeric:tabular-nums;text-align:center}',
      '.x13-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}',
      '.x13-tsrc{font:650 13px/1.25 var(--pp-sans);color:#566074}',
      '.x13-tt{font:700 16px/1.22 var(--pp-sans);letter-spacing:-.01em;color:var(--pp-encre);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
      '.x13-une:active,.x13-c:active{transform:scale(.982)}',
      '.x13-tr:active{background:#E9F0FF}',
      '.x13-tout:active{transform:scale(.985)}',
      '.x13-une:focus-visible,.x13-c:focus-visible,.x13-tr:focus-visible,.x13-tout:focus-visible,.x13-rb:focus-visible,.x13-retour:focus-visible{outline:3px solid rgba(0,80,230,.55);outline-offset:2px}',
      '@media (hover:hover){',
      '  .x13-une:hover,.x13-c:hover{transform:translateY(-3px);box-shadow:0 1px 0 #fff inset,0 2px 4px rgba(15,20,32,.08),0 26px 44px -20px rgba(0,48,140,.42)}',
      '  .x13-tr:hover{background:#F1F6FF}',
      '  .x13-rb:hover{transform:translateY(-2px);box-shadow:0 1px 0 #fff inset,0 2px 4px rgba(15,20,32,.08),0 18px 30px -18px rgba(0,48,140,.42)}',
      '  .x13-cv{transition:filter 0s}',
      '}',
      '/* rubriques : les pastilles qui ouvrent les panneaux du poste de pilotage (elles passent à la ligne, jamais de défilement latéral) */',
      '.x13-tout[hidden],.x13-reste[hidden],.x13-voile[hidden],.x13-sheet[hidden]{display:none}',
      '.x13-rubs{display:flex;flex-wrap:wrap;gap:10px}',
      '.x13-rb{display:inline-flex;align-items:center;gap:8px;min-height:44px;margin:0;padding:0 16px 0 14px;border-radius:22px;border:var(--x13-bord);background:var(--x13-fond);box-shadow:var(--pp-ombre);font:700 15px/1.2 var(--pp-sans);color:var(--pp-bleu-f);cursor:pointer;text-align:left;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;transition:transform .2s ease,box-shadow .2s ease}',
      '.x13-rb svg{flex:none;color:var(--pp-bleu)}',
      '.x13-rb b{font:500 14px/1 var(--pp-sans);color:var(--pp-encre2);font-variant-numeric:tabular-nums}',
      '.x13-rb:active{transform:scale(.985)}',
      '/* le bas de page replié : un seul bouton, les rubriques et les deux outils dessous */',
      '.x13-rub-z{margin-top:12px;scroll-margin-bottom:88px}',
      '.x13-rub-z:not([hidden]){animation:x13-in .4s cubic-bezier(.2,.8,.2,1) backwards}',
      '.x13-rub-z .pp-pied-btns{margin-top:14px}',
      '.x13-plus .x13-tout-f{transition:transform .25s ease}',
      '.x13-plus[aria-expanded="true"] .x13-tout-f{transform:rotate(180deg)}',
      '.x13-sheet *{box-sizing:border-box}',
      '.x13-sheet button{font-family:inherit;cursor:pointer}',
      '.x13-s-corps p{margin:10px 0 0;font-size:16px;line-height:1.55}',
      '.pp-pied-btns{display:flex;flex-wrap:wrap;gap:10px}',
      '/* feuille de lecture : naît de la carte touchée */',
      '.x13-voile{position:fixed;inset:0;z-index:9440;background:rgba(15,20,32,.5);opacity:0;transition:opacity .4s ease}',
      '.x13-voile.ouvert{opacity:1}',
      '.x13-sheet{position:fixed;z-index:9450;inset:0;font:400 15px/1.45 var(--pp-sans);color:var(--pp-encre);overflow-y:auto;overscroll-behavior:contain;background:#F6F8FC;transition:clip-path var(--x13-dur,.5s) cubic-bezier(.2,.75,.2,1),transform var(--x13-dur,.5s) cubic-bezier(.2,.75,.2,1);-webkit-overflow-scrolling:touch}',
      '.x13-sheet.ouvert{clip-path:inset(0 0 0 0 round 0)}',
      '.x13-s-cv{min-height:46vh;display:flex;flex-direction:column;justify-content:flex-end}',
      '.x13-s-cv{background:radial-gradient(55% 90px at 0% 0%,var(--l) 0%,rgba(255,255,255,0) 100%),radial-gradient(60% 55% at 100% 35%,rgba(255,255,255,.07),rgba(255,255,255,0) 100%),linear-gradient(180deg,var(--c) 0,var(--d) 90px,var(--d) 100%)}',
      '.x13-retour{position:absolute;z-index:3;top:max(14px,env(safe-area-inset-top));left:14px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.55);background:rgba(15,20,32,.28);color:#fff;display:grid;place-items:center;cursor:pointer;-webkit-appearance:none;appearance:none}',
      '.x13-s-n{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}',
      '.x13-s-n b{font:800 84px/.9 var(--pp-sans);letter-spacing:-.05em;font-variant-numeric:tabular-nums}',
      '.x13-s-n i{font:700 26px/1 var(--pp-sans);font-style:normal}',
      '.x13-s-i{display:block;line-height:0;margin-bottom:8px}',
      '.x13-s-tt{position:relative;z-index:2;padding:76px 20px 20px;display:flex;flex-direction:column;gap:8px}',
      '.x13-s-ru{font:700 13px/1.2 var(--pp-sans);letter-spacing:.07em;text-transform:uppercase}',
      '.x13-s-tt h2{margin:0;font:800 30px/1.14 var(--pp-sans);letter-spacing:-.03em;color:#fff;overflow-wrap:anywhere}',
      '.x13-s-m{font:600 14px/1.3 var(--pp-sans)}',
      '.x13-s-corps{padding:18px 20px 40px;font-size:16px;line-height:1.55;color:var(--pp-encre)}',
      'html.x13-fige{overflow:hidden}',
      '/* entrée : décalée, transform seul */',
      '@keyframes x13-in{from{transform:translateY(18px) scale(.985)}to{transform:none}}',
      '/* bureau : la une large à gauche, les compactes à droite */',
      '@media (max-width:899px){',
      '  .x13-s-cmp{display:contents}',
      '  .x13-s-tend{order:1}',
      '  .x13-tout,.x13-reste{order:2}',
      '  .x13>.x13-s-rub{order:3}',
      '  .x13-liste{margin-top:10px}',
      '}',
      '@media (min-width:900px){',
      '  .x13{grid-template-columns:minmax(0,1.62fr) minmax(0,1fr);grid-template-areas:"tete cmp" "une cmp" "tend cmp" "rub rub";column-gap:26px;align-content:start}',
      '  .x13>section{margin-top:0}',
      '  .x13-tete{grid-area:tete;padding-bottom:10px}',
      '  .x13 h1{font-size:44px}',
      '  .x13>.x13-s-rub{grid-area:rub;margin-top:26px}',
      '  .x13-plus{display:inline-flex;width:auto;min-width:320px;margin-top:0}',
      '  .x13-s-une{grid-area:une}.x13-s-cmp{grid-area:cmp;padding-top:8px;display:flex;flex-direction:column}',
      '  .x13-s-cmp>.x13-liste{flex:1}',
      '  .x13-s-cmp>.x13-liste>.x13-c{flex:1}.x13-s-tend{grid-area:tend;margin-top:18px}',
      '  .x13-une .x13-cv{height:260px}',
      '  .x13-cap{padding:16px 22px 20px;gap:7px}',
      '  .x13-ut{font-size:31px;line-height:1.14}',
      '  .x13-cn b{font-size:112px}.x13-cn i{font-size:32px}',
      '  .x13-cn{left:22px;bottom:14px}',
      '  .x13-ci{left:22px;bottom:20px}',
      '  .x13-tendances{display:grid;grid-template-columns:1fr 1fr}',
      '  .x13-tendances li+li{border-top:0;margin:0}',
      '  .x13-tendances li:nth-child(n+3){border-top:1px solid #E3E8F1}',
      '  .x13-tendances li+li .x13-tr{margin:0;width:100%}',
      '  .x13-tendances li:nth-child(odd){border-right:1px solid #E3E8F1}',
      '  .x13-c{min-height:104px;padding:14px 14px 14px 20px}',
      '  .x13-c .x13-t{font-size:19px}',
      '  .x13-c .x13-cv{width:104px;height:104px;border-radius:16px}',
      '  .x13-s-cmp .x13-liste{gap:9px}',
      '  .x13-sheet{inset:3vh auto auto 50%;max-height:94vh;width:min(780px,92vw);margin-left:calc(min(780px,92vw) / -2);border-radius:28px;box-shadow:0 40px 90px -30px rgba(0,20,70,.6)}',
      '  .x13-s-tt{padding:84px 36px 28px}',
      '  .x13-s-tt h2{font-size:38px}',
      '  .x13-s-corps{padding:26px 36px 48px}',
      '  .x13-s-n b{font-size:120px}',
      '  .x13-s-cv{min-height:0}',
      '  .x13-sheet.ouvert{clip-path:inset(0 0 0 0 round 28px)}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '  .x13-une,.x13-c,.x13-tr,.x13-reste .x13-c{animation:none}',
      '  .x13-sheet,.x13-voile,.x13-une,.x13-c,.x13-tout,.x13-rb{transition-duration:.01ms}',
      '}',
      '@media (prefers-reduced-motion:reduce){.pp *,.pp *::before,.pp *::after,#pp-pan,#pp-pan *,#pp-voile{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }
})();

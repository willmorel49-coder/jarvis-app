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
  var TOUS = [];        // tous les articles à plat : le panneau de lecture s'y réfère par rang
  var OUVERT = -1;      // l'article actuellement ouvert dans le panneau (-1 = aucun)

  /* ── accent visuel par thème : une couleur veut toujours dire la même chose ── */
  var THEME_ACC = {
    marge: 'amber', remboursement: 'blue', generique: 'green', rupture: 'rose',
    securite: 'rose', concurrence: 'violet', officine: 'blue', industrie: 'muted',
    sante: 'teal', autre: 'muted'
  };
  var THEME_ICO = {
    marge: 'euro', remboursement: 'euro', generique: 'pill', rupture: 'alert',
    securite: 'alert', concurrence: 'opp', officine: 'pharma', industrie: 'cat',
    sante: 'pill', autre: 'list'
  };

  /* filtre de thème + recherche sur le fil (mémorisé lui aussi) */
  var TH_KEY = 'jarvis_brief_theme_v1';
  var THEME_SEL = (function () { try { return localStorage.getItem(TH_KEY) || ''; } catch (e) { return ''; } })();
  var QUERY = '';
  V2.briefTheme = function (t) {
    THEME_SEL = (THEME_SEL === t) ? '' : t;
    try { localStorage.setItem(TH_KEY, THEME_SEL); } catch (e) {}
    if (V2.route && V2.route.name === 'infos') V2.render();
  };
  V2.briefSearch = function (el) {
    QUERY = el.value || '';
    var q = norm(QUERY.trim());
    var rows = document.querySelectorAll('#brief-fil .tu');
    var vus = 0;
    for (var i = 0; i < rows.length; i++) {
      var ok = !q || norm(rows[i].getAttribute('data-q') || '').indexOf(q) >= 0;
      rows[i].style.display = ok ? '' : 'none';
      if (ok) vus++;
    }
    var vide = document.getElementById('brief-fil-vide');
    if (vide) vide.style.display = vus ? 'none' : '';
    var cpt = document.getElementById('brief-fil-cpt');
    if (cpt) cpt.textContent = vus + (vus > 1 ? ' articles' : ' article');
  };

  var COPY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  /* ── « nouveau depuis ta dernière visite » ── */
  var SEEN_KEY = 'jarvis_infos_seen', seenBaseline = null;
  function seenBase() { if (seenBaseline === null) { try { seenBaseline = localStorage.getItem(SEEN_KEY) || ''; } catch (e) { seenBaseline = ''; } } return seenBaseline; }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, new Date().toISOString().slice(0, 10)); } catch (e) {} }

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
    try {
      Promise.all([get('brief-jour.json', true), get('brief-archive.json', false), get('bodacc-secteur.json', false)])
        .then(function (res) { BRIEF = res[0]; ARCHIVE = res[1]; SECTEUR = res[2]; LOADED = true; cb(); })
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
     prouve rien. On exige la VILLE en plus, sinon on n'affirme pas. */
  function clientTouche(nomSociete, ville) {
    var liste = (window.V2 && V2.pharmacies) || [];
    if (!liste.length || !nomSociete) return null;
    var mots = motsUtiles(nomSociete);
    if (!mots.length) return null;
    var v = norm(ville || '').replace(/[^a-z0-9]+/g, ' ').trim();
    // ⚠️ FINESS donne un CODE INSEE (« 63315 »), pas un nom de ville : le chercher
    //    dans le nom d'un client ne peut rien donner.
    if (/^\d[\d ]*$/.test(v)) v = '';

    /* La règle qui décide : UN SEUL CLIENT POSSIBLE.
       « Deux mots rares exigés » perdait « SELARL Pharmacie SABOURIN » (un seul mot
       rare une fois « selarl » et « pharmacie » retirés) ; « un mot suffit » faisait
       crier au loup sur les noms répandus. On rassemble donc TOUS les clients
       compatibles : on n'affirme que s'il n'y en a qu'un. Une ambiguïté, on se tait. */
    var candidats = [];
    for (var i = 0; i < liste.length; i++) {
      var p = liste[i];
      var nomP = norm(p.name || '').replace(/[^a-z0-9]+/g, ' ');
      if (!nomP.trim()) continue;
      var communs = 0;
      for (var k = 0; k < mots.length; k++) if (nomP.indexOf(mots[k]) >= 0) communs++;
      if (!communs) continue;
      if (v && nomP.indexOf(v) < 0) continue;   // ville connue : elle doit concorder
      candidats.push({ p: p, n: communs });
    }
    if (!candidats.length) return null;
    if (candidats.length === 1) return candidats[0].p;
    // plusieurs clients compatibles : on ne tranche que si UN SEUL est nettement devant
    candidats.sort(function (a, b) { return b.n - a.n; });
    return (candidats[0].n > candidats[1].n) ? candidats[0].p : null;
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
  var SCT_ORDRE = ['cession', 'procedure', 'creation', 'fermeture', 'dirigeant'];
  var SCT_TAG_L = { client: 'Ton client', prospect: 'Ton prospect', hors: 'Hors fichier' };
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

  var SCT_S = { scope: null, autre: -1, per: 30, off: {}, cap: 12 };
  var SCT_TOUS = [];     // liste à plat affichée, pour retrouver un item par id au clic
  var SCT_OUVERT = null; // id de l'annonce ouverte dans le panneau (null = fermé)

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
     postal ou même ville, au moins un mot rare du nom en commun, UN seul candidat.
     (clientTouche() compare la ville au NOM de l'officine : il rate ce cas.) */
  function sctMatchClient(nom, ville, cp) {
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
        (v && norm(p.ville || '').replace(/[^a-z0-9]+/g, ' ').trim() === v);
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
      case 'cession': return t === 'client' ? 'Ton client change de mains : rencontrer le repreneur avant la concurrence.' : 'Nouveau titulaire : prendre rendez-vous dans le mois, il choisit ses fournisseurs maintenant.';
      case 'procedure': return t === 'client' ? 'Prudence sur l’encours : faire le point avec la direction avant la prochaine commande.' : 'Officine fragilisée : ses voisines peuvent récupérer une partie de sa patientèle.';
      case 'creation': return /SPFPL|HOLDING/i.test(e.nom) ? 'Des pharmaciens montent une holding : un rachat se prépare dans le secteur.' : 'Nouvelle société d’officine : une reprise ou une ouverture se prépare, se présenter tôt.';
      case 'fermeture': return 'Ses patients vont se répartir chez les voisines : appeler les officines les plus proches.';
      default: return t === 'client' ? 'Nouvel interlocuteur chez ton client : se présenter et reprendre le fil.' : 'Nouvel interlocuteur : bonne occasion de se présenter.';
    }
  }

  // la phrase du jour et la carte des concurrents suivent la MÊME portée que ce bloc
  V2.infosSecteur = function () { return { deps: sctDeps(), noms: SCT_DEPNOMS }; };

  function sctBase() {
    var d = sctDeps(), ev = (SECTEUR && SECTEUR.ev) || [];
    return ev.filter(function (e) { return (!d || d.indexOf(e.dep) >= 0) && sctJours(e.d) < SCT_S.per; });
  }

  V2.secteurScope = function (s) {
    SCT_S.scope = s; SCT_S.autre = -1; SCT_S.cap = 12;
    if (V2.route && V2.route.name === 'infos') V2.render();
  };
  V2.secteurAutre = function (sel) {
    if (sel.value === '') return;
    SCT_S.scope = 'autre'; SCT_S.autre = +sel.value; SCT_S.cap = 12;
    if (V2.route && V2.route.name === 'infos') V2.render();
  };
  V2.secteurPeriode = function (n) {
    SCT_S.per = +n; SCT_S.cap = 12;
    if (V2.route && V2.route.name === 'infos') V2.render();
  };
  V2.secteurFam = function (f) {
    SCT_S.off[f] = !SCT_S.off[f]; SCT_S.cap = 12;
    if (V2.route && V2.route.name === 'infos') V2.render();
  };
  V2.secteurPlus = function () {
    SCT_S.cap += 20;
    if (V2.route && V2.route.name === 'infos') V2.render();
  };
  V2.secteurFicheOfficine = function (id) {
    if (!id) return;
    SCT_OUVERT = null; sctPanneau();
    V2.go('pharma', id);
  };
  V2.secteurOuvrir = function (id) {
    SCT_OUVERT = id; SCT_LU[id] = 1; sctSaveLu(); sctPanneau();
  };
  V2.secteurNonLu = function (id) {
    delete SCT_LU[id]; sctSaveLu(); SCT_OUVERT = null; sctPanneau();
    if (V2.route && V2.route.name === 'infos') V2.render();
  };
  V2.secteurFermer = function () {
    SCT_OUVERT = null; sctPanneau();
    if (V2.route && V2.route.name === 'infos') V2.render();
  };
  if (!V2._sctEchap) {
    V2._sctEchap = true;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && SCT_OUVERT !== null) V2.secteurFermer(); });
  }

  function sctPanneau() {
    var vieux = document.getElementById('sct-panneau');
    if (vieux) vieux.parentNode.removeChild(vieux);
    if (SCT_OUVERT === null) return;
    var ev = (SECTEUR && SECTEUR.ev) || [];
    var e = null; for (var i = 0; i < ev.length; i++) if (ev[i].id === SCT_OUVERT) { e = ev[i]; break; }
    if (!e) return;
    var fam = SCT_FAM[e.f] || SCT_FAM.dirigeant;
    var tag = sctTag(e);
    var h = '<div class="sct-fond" onclick="V2.secteurFermer()"></div>' +
      '<aside class="sct-pan" role="dialog" aria-modal="true" aria-label="' + esc(sctJoli(e.nom)) + '" style="--c:var(' + fam.c + ');--ct:var(' + fam.ct + ')">' +
        '<button class="sct-x" onclick="V2.secteurFermer()" aria-label="Fermer">' + sctSvg('<path d="M6 6l12 12M18 6L6 18"/>', 18) + '</button>' +
        '<div class="sct-pan-top">' +
          '<span class="sct-pan-f">' + sctSvg(fam.ico, 15) + esc(fam.l1) + '</span>' +
          '<h2>' + esc(sctJoli(e.nom)) + '</h2>' +
          '<div class="sct-pan-v">' + esc(e.ville) + (e.depNom ? ' · ' + esc(e.depNom) : '') + (e.dep ? ' (' + esc(e.dep) + ')' : '') + '</div>' +
        '</div>' +
        '<div class="sct-pan-b">' +
          '<dl class="sct-kv"><dt>Ce qui s’est passé</dt><dd>' + esc(e.detail) + '</dd>' +
            '<dt>Publié le</dt><dd>' + sctDateLongue(e.d) + '</dd>' +
            (SCT_TAG_L[tag.t] ? '<dt>Dans ton fichier</dt><dd><span class="sct-tag ' + tag.t + '">' + SCT_TAG_L[tag.t] + '</span></dd>' : '') + '</dl>' +
          '<div class="sct-do"><small>Ce que tu peux en faire</small><p>' + esc(sctGeste(e, tag.t)) + '</p></div>' +
          '<div class="sct-act">' +
            (tag.ficheId ? '<button type="button" class="sct-btn pri" onclick="V2.secteurFicheOfficine(\'' + esc(tag.ficheId) + '\')">' + sctSvg('<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>', 18) + 'Ouvrir la fiche officine</button>' : '') +
            '<a class="sct-btn sec" href="' + esc(urlSure(e.url)) + '" target="_blank" rel="noopener">' + sctSvg('<path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>', 17) + 'Lire l’annonce officielle</a>' +
            '<button type="button" class="sct-btn ghost" onclick="V2.secteurNonLu(\'' + esc(e.id) + '\')">Marquer comme non lue</button>' +
          '</div>' +
        '</div>' +
      '</aside>';
    var d = document.createElement('div');
    d.id = 'sct-panneau';
    d.innerHTML = h;
    document.body.appendChild(d);
    var x = d.querySelector('.sct-x'); if (x) x.focus();
  }

  /* Le bloc entier, en HTML. Rend '' (rien) si le fichier manque, est vide, ou
     si le secteur calculé est vide pour un commercial qui ne peut pas basculer
     sur « Toute la France » — jamais de carte qui crie dans le vide. */
  function secteurBlocHtml() {
    var ev = (SECTEUR && SECTEUR.ev) || [];
    if (!ev.length) return '';
    var direction = sctEstDirection();
    if (SCT_S.scope === null) {
      var moi0 = sctMonSecteur();
      SCT_S.scope = (direction && !moi0) ? 'fr' : 'moi';
    }
    if (!direction) SCT_S.scope = 'moi';   // la bascule est réservée à la direction
    var deps = sctDeps();
    if (!direction && !deps) return '';    // rien à montrer, et pas de bascule possible : on se tait

    var autres = direction ? sctAutresSecteurs() : [];
    var base = sctBase();
    var cnt = {}; base.forEach(function (e) { cnt[e.f] = (cnt[e.f] || 0) + 1; });
    var vis = base.filter(function (e) { return !SCT_S.off[e.f]; });
    var nonLus = vis.filter(function (e) { return !SCT_LU[e.id]; }).length;

    var rang = { client: 0, prospect: 1, hors: 2, reste: 2 };
    var withTag = vis.map(function (e) { var t = sctTag(e); return { e: e, t: t.t, ficheId: t.ficheId }; });
    withTag.sort(function (x, y) { return (deps ? rang[x.t] - rang[y.t] : 0) || y.e.d.localeCompare(x.e.d); });
    SCT_TOUS = withTag.map(function (x) { return x.e.id; });

    var whyHtml;
    if (!deps) {
      var nDeps = {}; ev.forEach(function (e) { if (e.dep) nDeps[e.dep] = 1; });
      whyHtml = '<span class="sct-why-l">Toute la France :</span><span class="sct-dep"><b>' + Object.keys(nDeps).length + '</b>départements</span>';
    } else {
      whyHtml = '<span class="sct-why-l">' + (SCT_S.scope === 'moi' ? 'Pourquoi ces départements ? Tes officines y sont :' : 'Ce secteur couvre :') + '</span>' +
        deps.map(function (d) { return '<span class="sct-dep"><b>' + esc(d) + '</b>' + esc(SCT_DEPNOMS[d] || '') + '</span>'; }).join('');
    }

    var famsHtml = SCT_ORDRE.map(function (f) {
      var on = !SCT_S.off[f], n = cnt[f] || 0, def = SCT_FAM[f];
      return '<button type="button" class="sct-fam' + (on ? '' : ' off') + (n ? '' : ' zero') + '" style="--c:var(' + def.c + ')" onclick="V2.secteurFam(\'' + f + '\')" aria-pressed="' + on + '" title="' + (on ? 'Masquer' : 'Afficher') + '">' +
        '<span class="sct-fi">' + sctSvg(def.ico, 17) + '</span><span class="sct-fn">' + n + '</span><span class="sct-fl">' + esc(def.l) + '</span>' +
        '<span class="sct-ck">' + sctSvg('<path d="M5 12l5 5L20 7"/>', 12) + '</span></button>';
    }).join('');

    var listHtml = '';
    if (!withTag.length) {
      listHtml = '<div class="sct-grp">Rien de neuf</div><div class="sct-empty">Aucune annonce sur cette période. Élargir à 30 jours ou 3 mois.</div>';
    } else {
      var shown = withTag.slice(0, SCT_S.cap), last = null, rows = '';
      shown.forEach(function (x, i) {
        var e = x.e, def = SCT_FAM[e.f] || SCT_FAM.dirigeant;
        var g = !deps ? 'Les plus récentes' : (x.t === 'client' ? 'Chez tes clients' : 'Dans le reste de ton secteur');
        if (g !== last) { rows += (last ? '</div>' : '') + '<div class="sct-grp">' + esc(g) + '</div><div class="sct-list">'; last = g; }
        rows += '<button type="button" class="sct-row' + (SCT_LU[e.id] ? ' lu' : '') + '" onclick="V2.secteurOuvrir(\'' + esc(e.id) + '\')" style="--c:var(' + def.c + ');--ct:var(' + def.ct + ');--i:' + i + '">' +
          '<span class="sct-new" aria-hidden="true"></span>' +
          '<span class="sct-ri">' + sctSvg(def.ico, 18) + '</span>' +
          '<span class="sct-rb"><span class="sct-rn">' + esc(sctJoli(e.nom)) + '</span>' +
            '<span class="sct-rm"><span class="k">' + esc(e.detail) + '</span> · ' + esc(e.ville) + ' (' + esc(e.dep) + ')</span>' +
            '<span class="sct-rg">' + sctSvg('<path d="M5 12h14M13 6l6 6-6 6"/>', 14) + '<span>' + esc(sctGeste(e, x.t)) + '</span></span></span>' +
          '<span class="sct-rt">' + (SCT_TAG_L[x.t] ? '<span class="sct-tag ' + x.t + '">' + SCT_TAG_L[x.t] + '</span>' : '') + '<span class="sct-when">' + sctQuand(e.d) + '</span></span>' +
        '</button>';
      });
      rows += '</div>';
      if (withTag.length > SCT_S.cap) rows += '<button type="button" class="sct-more" onclick="V2.secteurPlus()">Voir les ' + (withTag.length - SCT_S.cap) + ' autres</button>';
      listHtml = rows;
    }

    var scopeHtml = '';
    if (direction) {
      scopeHtml = '<div style="display:flex;flex-direction:column;align-items:flex-end">' +
        '<div class="sct-scope" role="group" aria-label="Portée">' +
          '<button type="button" onclick="V2.secteurScope(\'moi\')" aria-pressed="' + (SCT_S.scope === 'moi') + '">Mon secteur</button>' +
          '<button type="button" onclick="V2.secteurScope(\'fr\')" aria-pressed="' + (SCT_S.scope === 'fr') + '">Toute la France</button>' +
          (autres.length ? '<select aria-label="Voir un autre secteur" onchange="V2.secteurAutre(this)">' +
            '<option value="">Un autre secteur</option>' +
            autres.map(function (a, i) { return '<option value="' + i + '"' + (SCT_S.scope === 'autre' && SCT_S.autre === i ? ' selected' : '') + '>' + esc(a.l) + '</option>'; }).join('') +
          '</select>' : '') +
        '</div><div class="sct-scope-note">Réservé à la direction</div></div>';
    }

    return '<section class="sct" aria-labelledby="sct-t">' +
      '<div class="sct-head">' +
        '<span class="sct-ic" aria-hidden="true">' + sctSvg('<path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>', 22) + '</span>' +
        '<div class="sct-meta">' +
          '<h2 class="sct-t" id="sct-t">Dans ton secteur</h2>' +
          '<div class="sct-s">Ventes, redressements, fermetures, nouveaux dirigeants : tout ce que publie le journal officiel des annonces légales sur les pharmacies de tes départements.</div>' +
        '</div>' +
        scopeHtml +
      '</div>' +
      '<div class="sct-why">' + whyHtml + '</div>' +
      '<div class="sct-bar">' +
        '<div class="sct-bar-t">' + vis.length + ' annonce' + (vis.length > 1 ? 's' : '') + ' <span>· ' + nonLus + ' non lue' + (nonLus > 1 ? 's' : '') + '</span></div>' +
        '<div class="sct-per" role="group" aria-label="Période">' +
          [7, 30, 90].map(function (n) { return '<button type="button" onclick="V2.secteurPeriode(' + n + ')" aria-pressed="' + (SCT_S.per === n) + '">' + (n === 90 ? '3 mois' : n + ' jours') + '</button>'; }).join('') +
        '</div>' +
      '</div>' +
      '<div class="sct-fams">' + famsHtml + '</div>' +
      listHtml +
      '<div class="sct-src">Source : Bodacc, mis à jour chaque matin. Toucher une ligne pour la détailler.</div>' +
    '</section>';
  }

  /* ════════════════ LE PANNEAU DE LECTURE ════════════════
     Will (02/09/2026) : « apporter de la lisibilité et de l'information directement
     sur la plateforme, que ça puisse synthétiser l'info importante rapidement ».
     Toucher une tuile n'envoie plus sur le site : ça ouvre ici l'essentiel de
     l'article — son chapeau, les trois phrases qui portent l'information, les
     chiffres, les sources. Le lien vers le site reste, en bas, pour lire en entier.
     ⚠️ On cite trois phrases, on ne republie pas : l'article reste chez son éditeur. */
  V2.infosLire = function (ev, n) {
    // ⌘/Ctrl-clic, clic du milieu, nouvel onglet : on laisse partir vers la source
    if (ev && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1)) return true;
    if (ev && ev.preventDefault) ev.preventDefault();
    OUVERT = n;
    panneau();
    return false;
  };
  V2.infosFermer = function () { OUVERT = -1; panneau(); };

  function panneau() {
    var vieux = document.getElementById('inf-panneau');
    if (vieux) vieux.parentNode.removeChild(vieux);
    document.documentElement.classList.toggle('inf-fige', OUVERT >= 0);
    if (OUVERT < 0) return;
    var a = TOUS[OUVERT];
    if (!a) return;
    var acc = THEME_ACC[a.theme] || 'muted';
    var pts = (a.points || []).filter(Boolean);
    var chf = (a.chiffres || []).filter(Boolean);
    var srcs = (a.srcs && a.srcs.length) ? a.srcs : [a.s];

    var h = '<div class="inf-pan-fond" onclick="V2.infosFermer()"></div>' +
      '<aside class="inf-pan a-' + acc + '" role="dialog" aria-modal="true" aria-label="' + esc(a.t) + '">' +
        '<button class="inf-pan-x" onclick="V2.infosFermer()" aria-label="Fermer">' + ICO('close', 18, 2.2) + '</button>' +
        (a.img ? '<div class="inf-pan-img">' + couverture(a, 'r-16x9') + '</div>' : '') +
        '<div class="inf-pan-b">' +
          '<div class="inf-pan-top"><span class="cat">' + esc(a.theme_l) + '</span>' +
            (a.entier ? '<span class="inf-pan-ok">✓ lisible en entier</span>' : '') +
            (a.mn ? '<span class="inf-pan-mn">' + esc(a.mn) + ' min</span>' : '') + '</div>' +
          '<h2>' + esc(a.t) + '</h2>' +
          (a.r ? '<p class="inf-pan-chap">' + esc(a.r) + '</p>' : '') +
          (pts.length ? '<div class="inf-pan-sec"><span class="inf-pan-l">L\'essentiel</span><ul>' +
            pts.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') +
          (chf.length ? '<div class="inf-pan-sec"><span class="inf-pan-l">Les chiffres</span>' +
            '<div class="inf-pan-chf">' + chf.map(function (c) {
              return '<div class="chf"><b>' + esc(c.v) + '</b><span>' + esc(c.c) + '</span></div>';
            }).join('') + '</div></div>' : '') +
          (a.pour_toi ? '<div class="inf-pan-pour"><b>Pour toi</b>' + esc(a.pour_toi) + '</div>' : '') +
          '<div class="inf-pan-src">' + esc(srcs.join(' · ')) + ' · ' + esc(ilYA(a.d)) +
            (a.n_src > 1 ? ' · <b>' + a.n_src + ' sources en parlent</b>' : '') + '</div>' +
          (a.u ? '<a class="inf-pan-go" href="' + esc(urlSure(a.u)) + '" target="_blank" rel="noopener">' +
                 'Lire l\'article en entier sur ' + esc((srcs[0] || 'le site')) + ' ' + ICO('chev', 15, 2.4) + '</a>' : '') +
        '</div>' +
      '</aside>';
    var d = document.createElement('div');
    d.id = 'inf-panneau';
    d.innerHTML = h;
    document.body.appendChild(d);
    var f = d.querySelector('.inf-pan-x');
    if (f) f.focus();
  }
  // Échap ferme le panneau — posé une seule fois
  if (!V2._infosEchap) {
    V2._infosEchap = true;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && OUVERT >= 0) V2.infosFermer();
    });
  }

  /* dépliage de l'archive */
  /* Le bandeau montre les six plus importants ; les autres sont à un geste.
     ⚠️ On ne RETIRE rien : « ne pas passer à côté » interdit de cacher pour de bon. */
  var ALERTES_TOUT = false;
  V2.infosAlertes = function () { ALERTES_TOUT = !ALERTES_TOUT; if (V2.route && V2.route.name === 'infos') V2.render(); };

  var ARCH_OPEN = false;
  V2.briefArchive = function () { ARCH_OPEN = !ARCH_OPEN; if (V2.route && V2.route.name === 'infos') V2.render(); };

  /* ════════════════════════════ RENDU ════════════════════════════ */  /* ════════════════════════════ RENDU · « LE MUR » ════════════════════════════
     Direction choisie par Will le 01/09/2026 parmi quatre maquettes.
     Le parti pris : l'IMAGE D'ABORD. Aucune carte blanche dans le fil — chaque
     article EST une tuile d'image, de taille variable, avec son titre posé dessus.
     Les articles sans photo deviennent des affiches de couleur, donc le mur reste
     entièrement visuel, sans trou.
     Will, 02/09/2026 : « vire de "ce qui touche tes marges" à "à retirer des rayons" ».
     Six blocs retirés d'un coup — Journal officiel, radar chiffré, filtres de rubriques,
     opportunités catalogue, alertes de stock, rappels. La page ne garde que ce qui se
     REGARDE : la une, puis le mur (filtrable par rubrique, cherchable).
     ⚠️ Les données de ces six blocs sont toujours dans brief-jour.json : les remettre
        ou les déplacer ailleurs ne coûte que du gabarit, rien à recalculer. */
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
            '<div class="inf-empty-d">' + (FAILED ? 'Vérifie ta connexion. L\'édition se compose chaque matin vers 9 h.' : 'L\'édition se compose automatiquement chaque matin vers 9 h.') + '</div>' +
          '</div></div>';
        return;
      }

      var cinq = BRIEF.cinq || [], une = cinq[0];
      /* Dans « Le Mur », il n'y a plus « les 5 » d'un côté et « le fil » de l'autre :
         il y a UNE tuile de tête et LE MUR. Les 4 autres du top rejoignent le mur en
         tête, à leur rang — c'est le classement qui les distingue, pas une section. */
      var mur = cinq.slice(1).concat(BRIEF.fil || []);
      var epingles = BRIEF.epingles || [];
      // index plat : les épinglés, la une, puis le mur — c'est ce rang que le panneau ouvre
      TOUS = epingles.concat(une ? [une] : [], mur);
      var base = seenBase();
      var nbNew = base ? mur.filter(function (i) { return i.d && i.d > base; }).length : 0;
      var nIll = mur.filter(function (i) { return i.img; }).length + (une && une.img ? 1 : 0);

      var html = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap inf2">';

      /* ──────────── TÊTE COMPACTE ────────────
         Le mur commence tout de suite : pas de grand bandeau qui mange un écran. */
      html += '<header class="mur-tete">' +
        '<span class="mur-halo" aria-hidden="true"></span>' +
        '<div class="mur-tete-g">' +
          '<span class="mur-d"><i></i>Édition du jour · ' + esc(topDate()) +
            (nbNew ? ' · <b>' + nbNew + ' nouveau' + (nbNew > 1 ? 'x' : '') + '</b>' : '') + '</span>' +
          '<h1>L\'édition du matin</h1>' +
        '</div>' +
        '<div class="mur-tete-d">' +
          '<span><b>' + esc(mur.length + 1) + '</b> articles</span>' +
          '<span><b>' + esc(nIll) + '</b> illustrés</span>' +
          '<span><b>' + esc(BRIEF.compte.fichiers) + '</b> sources gratuites</span>' +
        '</div>' +
        '<div class="mur-act">' +
          '<button class="inf-copy" data-lbl="Copier le brief" onclick="V2.infosCopyBrief(this)">' + COPY_SVG + 'Copier le brief</button>' +
          (ARCHIVE && ARCHIVE.n > 1 ? '<button class="inf-ghost" onclick="V2.briefArchive()">' + ICO('cal', 14, 2) + 'Les matins d\'avant</button>' : '') +
        '</div>' +
      '</header>';

      /* ════════════════ DANS TON SECTEUR (Bodacc) ════════════════
       25/09/2026 — juste après la tête, avant « À ne pas manquer ». */
      html += secteurBlocHtml();

      /* ════════════════ À NE PAS MANQUER ════════════════
         Will, 02/09/2026 : « on doit absolument pas passer à côté d'infos comme
         celle-là ». Deux familles d'information ne se noient jamais dans le fil :
         les ÉCHÉANCES qui changent l'argent d'Intégral (elles restent jusqu'à leur
         entrée en vigueur, avec le compte à rebours) et les MOUVEMENTS de concurrents.
         Ce bandeau n'est ni filtrable, ni repliable, ni soumis à la fenêtre de 21 jours. */
      if (epingles.length) {
        html += '<section class="alerte">' +
          '<div class="alerte-h">' + ICO('alert', 16, 2.2) + 'À ne pas manquer' +
            '<span>échéances réglementaires & mouvements de concurrents</span></div>' +
          '<div class="al-grille">' + (ALERTES_TOUT ? epingles : epingles.slice(0, 6)).map(function (e, i) {
            var ech = e.motif === 'echeance' || (e.motif === 'ferme' && e.jours !== null);
            var j = e.jours;
            /* Cinq natures d'alerte, cinq pastilles. Une couleur veut toujours dire
               la même chose : ambre = une date arrive · rose = une sanction ou une
               défaillance · violet = un concurrent bouge. */
            var ETIQ = {
              sanction:   { c: 'sanc', l: 'Sanction', i: 'alert' },
              societe:    { c: 'soc',  l: 'Répartiteur · registre', i: 'fiche' },
              cession:    { c: 'cess', l: 'Officine vendue', i: 'pharma' },
              demande:    { c: 'dem',  l: 'Ça va se vendre', i: 'cart' },
              ferme:      { c: 'fer',  l: 'Ferme bientôt', i: 'alert' },
              titulaire:  { c: 'tit',  l: 'Change de main', i: 'pharma' },
              amont:      { c: 'amo',  l: "Avant l'ANSM", i: 'opp' },
              difficulte: { c: 'diff', l: 'En difficulté', i: 'alert' },
              concurrent: { c: 'conc', l: 'Concurrent', i: 'opp' }
            };
            var et = ETIQ[e.motif] || ETIQ.concurrent;
            var pastille = ech
              ? (j !== null && j >= 0
                  ? '<span class="al-cd' + (j <= 60 ? ' urgent' : '') + '">' +
                    (j === 0 ? "aujourd'hui" : 'dans ' + j + ' jour' + (j > 1 ? 's' : '')) + '</span>'
                  : '<span class="al-cd fait">déjà applicable</span>')
              : '<span class="al-cd ' + et.c + '">' + ICO(et.i, 12, 2.4) + et.l + '</span>';
            return '<article class="al-i ' + (ech ? 'ech' : esc(e.motif)) + '">' +
              '<div class="al-top">' + pastille +
                '<span class="al-d">' + (ech && e.effet ? 'à partir du ' + esc(joDateFr(e.effet)) : esc(ilYA(e.d))) + '</span>' +
                (e.paywall ? '<span class="al-ab">accès abonné</span>' : '') + '</div>' +
              '<h3>' + esc(e.t) + '</h3>' +
              (e.r ? '<p>' + esc(e.r) + '</p>' : '') +
              (function () {
                if (['difficulte','cession','ferme','titulaire'].indexOf(e.motif) < 0) return '';
                var cl = clientTouche(e.societe, e.ville);
                return cl ? '<div class="al-client">' + ICO('alert', 14, 2.4) +
                  '<b>C\'est un de tes clients</b><span>' + esc(cl.name) +
                  (cl.code ? ' · CIP ' + esc(cl.code) : '') +
                  ({ cession: ' — le titulaire change, compte à reprendre',
                     titulaire: ' — le titulaire a changé, compte à reprendre',
                     ferme: ' — ce client ferme, encours à solder'
                   }[e.motif] || ' — encours à vérifier') + '</span></div>' : '';
              })() +
              '<div class="al-f">' + esc((e.srcs && e.srcs.length ? e.srcs : [e.s]).slice(0, 3).join(' · ')) + '</div>' +
              '<a class="tout" href="' + esc(urlSure(e.u)) + '" onclick="return V2.infosLire(event,' + i + ')" aria-label="' + esc(e.t) + '"></a>' +
            '</article>';
          }).join('') + '</div>' +
          (epingles.length > 6
            ? '<button class="al-plus" onclick="V2.infosAlertes()">' +
              (ALERTES_TOUT ? 'Replier' : 'Voir les ' + (epingles.length - 6) + ' autres') +
              '</button>' : '') +
        '</section>';
      }

      /* ──────────── LA TUILE DE TÊTE ──────────── */
      if (une) html += tuileUne(une);

      /* Will, 02/09/2026 : « vire de “ce qui touche tes marges” à “à retirer
         des rayons” ». Six blocs retirés d'un coup — Journal officiel, radar,
         filtres de rubriques, opportunités catalogue, alertes de stock, rappels.
         La page ne garde que ce qui se REGARDE : la une, puis le mur. */

      /* ──────────── L'ESSENTIEL EN 30 SECONDES ────────────
         Le mur se regarde ; ça, ça se lit. Les cinq sujets que le robot a classés
         en tête, chacun réduit à sa phrase la plus porteuse — de quoi savoir ce
         qui compte aujourd'hui sans ouvrir un seul article. */
      if (cinq.length > 1) {
        html += '<section class="ess">' +
          '<div class="ess-h"><b>L\'essentiel en 30 secondes</b>' +
            '<span>' + (cinq.length) + ' sujets · ' + esc(BRIEF.compte.fichiers) + ' sources relues ce matin</span></div>' +
          '<ol class="ess-l">' + cinq.map(function (c, i) {
            var cle = (c.points && c.points.length) ? c.points[0] : (c.r || '');
            var rang = TOUS.indexOf(c);
            return '<li class="ess-i a-' + (THEME_ACC[c.theme] || 'muted') + '">' +
              '<span class="ess-n">' + (i + 1) + '</span>' +
              '<span class="ess-b">' +
                '<span class="ess-cat">' + esc(c.theme_l) + '</span>' +
                '<b>' + esc(c.t) + '</b>' +
                (cle ? '<span class="ess-p">' + esc(cle) + '</span>' : '') +
                '<span class="ess-f">' + esc((c.srcs || [c.s]).slice(0, 2).join(' · ')) +
                  (c.n_src > 1 ? ' · <em>' + c.n_src + ' sources</em>' : '') +
                  (c.mn ? ' · ' + esc(c.mn) + ' min' : '') + '</span>' +
              '</span>' +
              (rang >= 0 ? '<a class="tout" href="' + esc(c.u || '#') + '" onclick="return V2.infosLire(event,' + rang + ')" aria-label="' + esc(c.t) + '"></a>' : '') +
            '</li>';
          }).join('') + '</ol></section>';
      }

      /* ──────────── LES CONCURRENTS ────────────
         Will, 24/09/2026 : les infos concurrents, jusque-là dans la feature
         « Concurrents », se lisent ici. Même bloc (v2-grossistes.js) : faits
         vérifiés, annonces officielles, presse — rempli après le rendu. */
      html += '<section class="inf-conc" id="infos-concurrents">' +
        '<div class="mur-rub"><b>Les concurrents</b><span>faits vérifiés, annonces officielles et presse</span></div>' +
        '<div id="inf-cnc-host"></div><div id="inf-conc-host"></div></section>';

      /* ════════════════ LE MUR ════════════════ */
      if (mur.length) {
        var compte = {};
        mur.forEach(function (i) { compte[i.theme] = (compte[i.theme] || 0) + 1; });
        // ⚠️ ordre MÉTIER, jamais par volume : trier par volume met « Autre » en tête.
        var ordre = (BRIEF.themes_ordre || Object.keys(compte)).filter(function (t) { return compte[t]; });
        var visibles = THEME_SEL ? mur.filter(function (i) { return i.theme === THEME_SEL; }) : mur;

        var chips = '<button type="button" class="brf-chip' + (THEME_SEL ? '' : ' on') + '" onclick="V2.briefTheme(\'\')">Tout <i>' + mur.length + '</i></button>' +
          ordre.map(function (t) {
            return '<button type="button" class="brf-chip a-' + (THEME_ACC[t] || 'muted') + (THEME_SEL === t ? ' on' : '') + '" onclick="V2.briefTheme(\'' + esc(t) + '\')">' +
              '<i class="pt"></i>' + esc((BRIEF.themes_l && BRIEF.themes_l[t]) || t) + ' <i>' + compte[t] + '</i></button>';
          }).join('');

        // rythme des hauteurs : c'est ce qui fait un MUR et pas une grille
        var RYTHME = ['', 'h', 'l', '', 'xl', 'l', 'h', ''];
        var HAUT = { '': 1.25, h: 1.333, l: 1, xl: 1.5 };   // hauteur relative de chaque format
        var nCol = colonnes(root); COLS_VUE = nCol; surveilleLargeur();
        var cols = [], charge = [];
        for (var k = 0; k < nCol; k++) { cols.push(''); charge.push(0); }
        visibles.forEach(function (i, n) {
          var fmt = RYTHME[n % RYTHME.length];
          // on dépose toujours dans la colonne la plus courte : c'est ce qui donne
          // le décalage du mur sans laisser un pied de page en escalier
          var min = 0;
          for (var k = 1; k < nCol; k++) if (charge[k] < charge[min]) min = k;
          var q = norm((i.t || '') + ' ' + (i.r || '') + ' ' + (i.s || '') + ' ' + ((BRIEF.themes_l && BRIEF.themes_l[i.theme]) || ''));
          cols[min] += tuile(i, fmt, q, TOUS.indexOf(i));
          charge[min] += HAUT[fmt] + 0.06;
        });
        var tuiles = cols.map(function (c) { return '<div class="mur-col">' + c + '</div>'; }).join('');

        html += '<section class="mur-sec" id="brief-fil">' +
          '<div class="mur-rub"><b>Le mur</b>' +
            '<span id="brief-fil-cpt">' + visibles.length + (visibles.length > 1 ? ' articles' : ' article') + '</span></div>' +
          '<div class="brf-chips">' + chips + '</div>' +
          '<div class="brf-search">' + ICO('search', 16, 2) +
            '<input type="search" placeholder="Chercher au mur (molécule, mot-clé, source)…" oninput="V2.briefSearch(this)" value="' + esc(QUERY) + '">' +
          '</div>' +
          '<div class="mur">' + tuiles + '</div>' +
          '<div class="inf-allhidden" id="brief-fil-vide" style="display:none">Aucun article ne correspond à cette recherche.</div>' +
        '</section>';
      }

      /* ── LES MATINS D'AVANT ── */
      if (ARCH_OPEN && ARCHIVE && (ARCHIVE.jours || []).length) {
        html += '<section class="inf-sec a-violet">' +
          rubrique('Les matins d\'avant', ARCHIVE.n + ' édition' + (ARCHIVE.n > 1 ? 's' : '') + ' archivée' + (ARCHIVE.n > 1 ? 's' : '') + ' — la une de chaque jour et ses cinq titres.') +
          '<div class="brf-arch">' + ARCHIVE.jours.slice(0, 30).map(function (j) {
            return '<div class="brf-day"><div class="brf-day-d">' + esc(joDateFr(j.d)) + '</div>' +
              '<div class="brf-day-l">' + (j.titres || []).map(function (t) {
                return '<a' + (t.u ? ' href="' + esc(t.u) + '" target="_blank" rel="noopener"' : '') + '>' +
                  '<i class="a-' + (THEME_ACC[t.theme] || 'muted') + '"></i>' + esc(t.t) + '</a>';
              }).join('') + '</div></div>';
          }).join('') + '</div>' +
          (epingles.length > 6
            ? '<button class="al-plus" onclick="V2.infosAlertes()">' +
              (ALERTES_TOUT ? 'Replier' : 'Voir les ' + (epingles.length - 6) + ' autres') +
              '</button>' : '') +
        '</section>';
      }

      /* ── pied de page : la traçabilité ── */
      var maj = '';
      try { maj = new Date(BRIEF.genere).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
      html += '<div class="brf-foot">Édition composée le ' + esc(maj) + ' à partir de ' +
        esc(BRIEF.compte.fichiers) + ' sources gratuites, toutes lisibles en entier.<br>' +
        esc(BRIEF.compte.entrees) + ' informations lues, ' + esc(BRIEF.compte.sujets) +
        ' sujets après regroupement des doublons.</div>';

      html += '</div>';
      root.innerHTML = html;
      markSeen();
      var cncHost = document.getElementById('inf-cnc-host');
      if (cncHost && V2.concurrentsSecteur) V2.concurrentsSecteur(cncHost);
      var concHost = document.getElementById('inf-conc-host');
      if (concHost && V2.grossistesCorps) V2.grossistesCorps(concHost, 'actu');
      // venu de « Concurrents » : descendre au bloc, APRÈS la remise en haut que fait la navigation
      if (V2.route && V2.route.param === 'concurrents') {
        setTimeout(function () {
          var concSec = document.getElementById('infos-concurrents');
          if (concSec) concSec.scrollIntoView({ block: 'start' });
        }, 120);
      }

      if (QUERY) {
        var inp = root.querySelector('.brf-search input');
        if (inp) V2.briefSearch(inp);
      }

      /* ── Motion (vanilla, respecte prefers-reduced-motion via l'API) ── */
      var mo = V2.motion;
      if (mo) {
        var u = root.querySelector('.mur-une');
        if (u) mo.inView(u, function (el) { mo.stagger([el], { step: 0, y: 12 }); });
        var m = root.querySelector('.mur');
        if (m) mo.inView(m, function (el) { mo.stagger(el.querySelectorAll('.tu'), { step: 32, cap: 12, y: 12 }); });
      }
    }
  };

  /* Combien de colonnes ? Décidé ici plutôt qu'en CSS, puisque c'est nous qui
     répartissons les tuiles. Les paliers reprennent ceux du reste de l'app. */
  function colonnes(root) {
    var w = (root && root.clientWidth) || (window.innerWidth || 1200);
    return w >= 1120 ? 4 : w >= 820 ? 3 : 2;
  }
  // un changement de palier doit redistribuer le mur — sinon la page garde
  // 4 colonnes serrées sur un téléphone tourné.
  var COLS_VUE = 0, RESIZE_POSE = false;
  function surveilleLargeur() {
    if (RESIZE_POSE) return;
    RESIZE_POSE = true;
    var t = null;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (!V2.route || V2.route.name !== 'infos') return;
        var el = document.querySelector('.inf2');
        if (el && colonnes(el) !== COLS_VUE) V2.render();
      }, 180);
    });
  }

  /* ════════════════ briques du mur ════════════════ */

  /* La couverture. La photo que le site déclare lui-même, posée sur une planche
     dessinée aux couleurs du thème. Deux garde-fous :
     — la moitié des sources métier n'ont AUCUNE image : la planche prend le relais
       et l'article reste une tuile pleine, jamais un trou dans le mur ;
     — si le serveur refuse d'être appelé depuis ailleurs, `onerror` retire la photo
       et la planche réapparaît toute seule. */
  var ANGLES = { marge: 118, remboursement: 152, generique: 196, rupture: 138,
                 securite: 172, concurrence: 210, officine: 128, industrie: 160,
                 sante: 184, autre: 145 };
  function couverture(c, ratio) {
    var ang = ANGLES[c.theme] || 152;
    return '<span class="mq-cov ' + (ratio || 'r-4x5') + '">' +
      '<span class="mq-plaque a-' + (THEME_ACC[c.theme] || 'muted') + '" style="--ang:' + ang + 'deg"></span>' +
      (c.img ? '<img src="' + esc(urlSure(c.img)) + '" alt="" loading="lazy" decoding="async" ' +
               'referrerpolicy="no-referrer" onerror="this.remove()">' +
               '<span class="mq-teinte" aria-hidden="true"></span>' : '') + '</span>';
  }
  function sourcesLine(c) {
    var s = (c.srcs && c.srcs.length) ? c.srcs : [c.s];
    return esc(s.slice(0, 3).join(' · ')) + (s.length > 3 ? ' <b>+' + (s.length - 3) + '</b>' : '');
  }

  /* LA TUILE DE TÊTE — large, avec le chapeau et l'angle métier */
  function tuileUne(c) {
    return '<article class="mur-une a-' + (THEME_ACC[c.theme] || 'blue') + '">' +
      couverture(c, 'r-21x9') + '<span class="veil"></span>' +
      '<div class="b">' +
        '<span class="cat">À la une · ' + esc(c.theme_l) + '</span>' +
        '<h2>' + esc(c.t) + '</h2>' +
        (c.r ? '<p>' + esc(c.r) + '</p>' : '') +
        '<div class="pour"><b>Pour toi</b>' + esc(c.pour_toi) + '</div>' +
        '<div class="f">' + sourcesLine(c) + ' · ' + esc(ilYA(c.d)) +
          (c.mn ? ' · ' + esc(c.mn) + ' min' : '') +
          (c.entier ? ' · <span class="ok">✓ lisible en entier</span>' : '') + '</div>' +
      '</div>' +
      '<a class="tout" href="' + esc(c.u || '#') + '" onclick="return V2.infosLire(event,' + TOUS.indexOf(c) + ')" aria-label="' + esc(c.t) + '"></a>' +
    '</article>';
  }

  /* UNE TUILE DU MUR */
  function tuile(a, taille, q, rang) {
    var RATIO = { '': 'r-4x5', h: 'r-3x4', l: 'r-1x1', xl: 'r-4x6' };
    return '<article class="tu ' + taille + ' a-' + (THEME_ACC[a.theme] || 'muted') + '" data-q="' + esc(q) + '">' +
      couverture(a, RATIO[taille] || 'r-4x5') + '<span class="veil"></span>' +
      '<div class="b">' +
        '<span class="cat">' + esc(a.theme_l) + '</span>' +
        '<h3>' + esc(a.t) + '</h3>' +
        (a.r ? '<p class="tu-p">' + esc(a.r) + '</p>' : '') +
        '<div class="f">' + esc(a.s) +
          (a.n_src > 1 ? ' <b>+' + (a.n_src - 1) + '</b>' : '') + ' · ' + esc(ilYA(a.d)) +
          (a.mn ? ' · ' + esc(a.mn) + ' min' : '') +
          (a.neuf ? ' · <span class="neuf">nouveau</span>' : '') +
          (a.entier ? '<br><span class="ok">✓ lisible en entier</span>' : '') + '</div>' +
      '</div>' +
      '<a class="tout" href="' + esc(urlSure(a.u)) + '" onclick="return V2.infosLire(event,' + rang + ')" aria-label="' + esc(a.t) + '"></a>' +
    '</article>';
  }

  /* un titre de rubrique */
  function rubrique(titre, sous) {
    return '<div class="mur-rub"><b>' + titre + '</b>' + (sous ? '<span>' + sous + '</span>' : '') + '</div>';
  }

  function injectStyles() {
    if (document.getElementById('v2-infos-css')) return;
    var st = document.createElement('style'); st.id = 'v2-infos-css';
    st.textContent = [
      /* ══════════ TYPOGRAPHIE DE PRESSE ══════════
         Newsreader (SIL OFL, 132 Ko, déjà sur le disque) UNIQUEMENT pour les titres
         d'articles : c'est le geste qui fait la différence entre une liste de liens
         et un journal. Le reste du CRM ne bouge pas, il reste en Inter.
         ⚠️ Une police citée dans une pile sans @font-face retombe en SILENCE sur la
            police système. Elle est donc déclarée ici, et la sonde MESURE la largeur
            d'un texte témoin pour prouver qu'elle s'affiche vraiment. */
      "@font-face{font-family:'Newsreader';src:url('fonts/newsreader.woff2') format('woff2');" +
        "font-weight:200 800;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Newsreader';src:url('fonts/newsreader-italic.woff2') format('woff2');" +
        "font-weight:200 800;font-style:italic;font-display:swap}",
      ".inf2{--serif:'Newsreader',Georgia,'Times New Roman',serif}",
      /* le magazine respire : cet écran est plus large que le reste du CRM */
      '.v2-wrap.inf2{max-width:1360px}',

      /* accents locaux (mappés sur les tokens de v2.css) */
      '.inf2 .a-rose{--acc:var(--c-rose);--acc-t:var(--c-rose-txt)}',
      '.inf2 .a-amber{--acc:var(--c-amber);--acc-t:var(--c-amber-txt)}',
      '.inf2 .a-blue{--acc:var(--ip-blue);--acc-t:var(--ip-blue)}',
      '.inf2 .a-green{--acc:var(--c-opp);--acc-t:var(--c-mint-txt)}',
      '.inf2 .a-violet{--acc:var(--c-cat);--acc-t:var(--c-cat)}',
      '.inf2 .a-muted{--acc:var(--muted);--acc-t:var(--muted)}',
      '.inf2 .a-teal{--acc:var(--c-froid);--acc-t:#006F80}',


      /* ── « Ce qui touche tes marges » (Journal officiel) ──
         Éclairé, pas encadré de rouge : c'est important, pas alarmant. */

      /* ── filtres rapides ── */

      /* ── sections ── */
      '.inf2 .inf-sec{margin-bottom:var(--section-gap)}',

      /* ── listes ── */

      /* ── fil : chips + recherche ── */
      '.inf2 .brf-chips{display:flex;gap:var(--gap-tight);flex-wrap:wrap;margin-bottom:var(--sp-3)}',
      '.inf2 .brf-chip{display:inline-flex;align-items:center;gap:6px;min-height:var(--tap-min);padding:0 14px;border-radius:var(--r-pill);border:1px solid var(--line-strong);background:var(--card);font-size:12.5px;font-weight:650;color:var(--ip-ink-2);cursor:pointer;transition:all .18s var(--ease-soft)}',
      '.inf2 .brf-chip i{font:700 12px/1 var(--mono);font-style:normal;color:var(--muted-2)}',
      '.inf2 .brf-chip:hover{border-color:var(--acc,var(--ip-blue))}',
      '.inf2 .brf-chip.on{background:var(--acc,var(--ip-blue));border-color:var(--acc,var(--ip-blue));color:#fff}',
      '.inf2 .brf-chip.on i{color:rgba(255,255,255,.75)}',
      '.inf2 .brf-search{display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--line-strong);border-radius:var(--r-control);padding:0 var(--sp-3);margin-bottom:var(--sp-3);color:var(--muted-2)}',
      /* 16px minimum : en dessous, iOS zoome sur le champ au focus */
      '.inf2 .brf-search input{flex:1 1 auto;min-width:0;border:0;outline:0;background:transparent;font:400 16px/1 var(--font);color:var(--ip-ink);min-height:var(--tap-min);padding:0}',
      '.inf2 .brf-search input::placeholder{color:var(--muted-2)}',

      /* ── opportunités Intégral ── */

      /* ── archive ── */
      '.inf2 .brf-arch{display:flex;flex-direction:column;gap:var(--sp-3)}',
      '.inf2 .brf-day{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:var(--sp-4);box-shadow:var(--sh-1)}',
      '.inf2 .brf-day-d{font:700 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted-2);margin-bottom:10px}',
      '.inf2 .brf-day-l{display:flex;flex-direction:column;gap:7px}',
      '.inf2 .brf-day-l a{display:flex;align-items:flex-start;gap:9px;font-size:13.5px;line-height:1.4;color:var(--ip-ink-2);text-decoration:none;min-height:28px}',
      '.inf2 .brf-day-l a:hover{color:var(--ip-blue)}',
      '.inf2 .brf-day-l i{flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--acc);margin-top:6px}',

      /* ── divers ── */
      '.inf2 .brf-foot{font-size:12px;line-height:1.6;color:var(--muted-2);text-align:center;padding:var(--sp-5) 0 var(--sp-2);border-top:1px solid var(--line-2)}',
      '.inf2 .inf-allhidden{text-align:center;font-size:13.5px;color:var(--muted);padding:var(--sp-5);background:var(--card-2);border-radius:var(--r-md)}',
      '.inf2 .inf-load{display:flex;align-items:center;justify-content:center;gap:12px;padding:var(--sp-8) var(--sp-4);color:var(--muted);font-size:14px}',
      '.inf2 .inf-spin{width:20px;height:20px;border-radius:50%;border:2.4px solid var(--line-strong);border-top-color:var(--ip-blue);animation:infspin .8s linear infinite}',
      '@keyframes infspin{to{transform:rotate(360deg)}}',
      '@media(prefers-reduced-motion:reduce){.inf2 .inf-spin{animation-duration:2.4s}}',
      '.inf2 .inf-empty{text-align:center;padding:var(--sp-8) var(--sp-4);background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1)}',
      '.inf2 .inf-empty-ic{color:var(--muted-2);margin-bottom:12px}',
      '.inf2 .inf-empty-t{font-size:16.5px;font-weight:700;color:var(--ip-ink);margin-bottom:7px}',
      '.inf2 .inf-empty-d{font-size:13.5px;color:var(--muted);max-width:38ch;margin:0 auto;line-height:1.5}',

      /* ══════════ TÊTE COMPACTE ══════════
         « Le Mur » ne s'ouvre pas sur un grand bandeau : le mur commence tout de
         suite. La tête tient sur une ligne, titre à gauche, chiffres à droite. */
      '.inf2 .mur-tete{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--sp-5);flex-wrap:wrap;padding:var(--sp-5) 0 var(--sp-5)}',
      '.inf2 .mur-d{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;font:600 12px/1 var(--mono);letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:11px}',
      '.inf2 .mur-d i{width:7px;height:7px;border-radius:50%;background:var(--c-rose);display:inline-block}',
      '.inf2 .mur-d b{color:var(--c-mint-txt)}',
      '.inf2 .mur-tete h1{font-family:var(--serif);font-weight:500;font-size:clamp(34px,5.4vw,60px);line-height:.95;letter-spacing:-.033em;margin:0;color:var(--ip-ink)}',
      '.inf2 .mur-tete-d{display:flex;gap:var(--sp-5);flex-wrap:wrap;font:600 12px/1 var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--muted-2);padding-bottom:6px}',
      '.inf2 .mur-tete-d b{display:block;font-size:19px;color:var(--ip-ink);letter-spacing:-.02em;margin-bottom:5px;font-variant-numeric:tabular-nums}',
      '.inf2 .mur-act{display:flex;gap:var(--sp-2);flex-wrap:wrap;width:100%}',
      '.inf2 .inf-copy,.inf2 .inf-ghost{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap-min);padding:0 18px;border-radius:var(--r-btn);font-size:14px;font-weight:650;cursor:pointer;transition:transform .2s var(--ease),box-shadow .2s var(--ease)}',
      '.inf2 .inf-copy{border:0;background:var(--ip-blue);color:#fff;box-shadow:var(--sh-blue)}',
      '.inf2 .inf-copy:hover{transform:translateY(var(--mo-lift));box-shadow:var(--sh-blue-h)}',
      '.inf2 .inf-ghost{border:1px solid var(--line-strong);background:var(--card);color:var(--ip-ink);box-shadow:var(--sh-1)}',
      '.inf2 .inf-ghost:hover{transform:translateY(var(--mo-lift));box-shadow:var(--sh-2)}',

      /* ══════════ TITRE DE RUBRIQUE ══════════ */
      '.inf2 .mur-rub{display:flex;align-items:baseline;gap:var(--sp-3);flex-wrap:wrap;padding-bottom:var(--sp-3);border-bottom:1.5px solid var(--ip-ink);margin-bottom:var(--sp-4)}',
      '.inf2 .mur-rub b{font-family:var(--serif);font-weight:600;font-size:24px;letter-spacing:-.02em;color:var(--ip-ink)}',
      '.inf2 .mur-rub span{font:600 12px/1 var(--mono);letter-spacing:.11em;text-transform:uppercase;color:var(--muted-2)}',
      // bloc « Les concurrents » : le fil est long (jusqu'à 120 articles) → boîte à défilement, le mur reste visible dessous
      '.inf2 .inf-conc{margin:var(--sp-6) 0;scroll-margin-top:72px}',
      '.inf2 .inf-conc .gr-wrap{padding:0}',
      '.inf2 .inf-conc .gr-actulist{max-height:480px;overflow-y:auto;overscroll-behavior:contain}',
      '.inf2 .mur-sec{margin-bottom:var(--section-gap)}',

      /* ══════════ COUVERTURE ══════════ */
      '.inf2 .mq-cov{position:relative;display:block;overflow:hidden;background:var(--surf-sunken)}',
      '.inf2 .mq-cov.r-4x5{aspect-ratio:4/5}.inf2 .mq-cov.r-3x4{aspect-ratio:3/4}',
      '.inf2 .mq-cov.r-1x1{aspect-ratio:1/1}.inf2 .mq-cov.r-4x6{aspect-ratio:4/6}',
      '.inf2 .mq-cov.r-21x9{aspect-ratio:21/9}',
      '.inf2 .mq-cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;transition:transform .6s var(--ease)}',
      /* la planche dessinée, TOUJOURS sous la photo : si la photo ne charge pas, elle
         réapparaît seule. Jamais de trou dans le mur, jamais de rectangle gris. */
      '.inf2 .mq-plaque{position:absolute;inset:0;background:linear-gradient(var(--ang,152deg),color-mix(in srgb,var(--acc) 92%,#0B1020) 0%,color-mix(in srgb,var(--acc) 64%,#fff) 48%,color-mix(in srgb,var(--acc) 34%,#fff) 100%)}',
      '.inf2 .mq-plaque::before{content:"";position:absolute;inset:0;background:radial-gradient(62% 74% at 24% 8%,rgba(255,255,255,.48),transparent 60%),radial-gradient(52% 62% at 88% 98%,rgba(11,16,32,.26),transparent 62%)}',
      '.inf2 .mq-plaque::after{content:"";position:absolute;inset:0;opacity:.55;background:repeating-linear-gradient(58deg,rgba(255,255,255,.16) 0 1px,transparent 1px 12px)}',
      '.inf2 .veil{position:absolute;inset:0;z-index:2;background:linear-gradient(0deg,rgba(8,11,20,.94) 0%,rgba(8,11,20,.62) 40%,rgba(8,11,20,.04) 78%)}',

      /* ══════════ LA TUILE DE TÊTE ══════════ */
      '.inf2 .mur-une{position:relative;border-radius:var(--r-card);overflow:hidden;background:#10131C;margin-bottom:var(--section-gap);box-shadow:var(--sh-3)}',
      '.inf2 .mur-une:hover .mq-cov img{transform:scale(1.035)}',
      '.inf2 .mur-une .b{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:var(--sp-7) var(--sp-7) var(--sp-6);max-width:900px}',
      '.inf2 .mur-une .cat,.inf2 .tu .cat{display:inline-block;font:700 12px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#fff;background:color-mix(in srgb,var(--acc) 70%,black);padding:7px 12px;border-radius:var(--r-pill);margin-bottom:12px}',
      '.inf2 .mur-une h2{font-family:var(--serif);font-weight:600;font-size:clamp(25px,3.6vw,46px);line-height:1.06;letter-spacing:-.026em;color:#fff;margin:0 0 12px;text-wrap:balance}',
      '.inf2 .mur-une p{font-size:15.5px;line-height:1.55;color:rgba(255,255,255,.82);margin:0 0 13px;max-width:64ch}',
      '.inf2 .pour{display:inline-flex;gap:10px;align-items:center;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);border-radius:var(--r-pill);padding:9px 16px;color:#fff;font-size:13.5px;font-weight:600;margin-bottom:12px}',
      '.inf2 .pour b{font:700 12px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#8FB4FF}',
      '.inf2 .mur-une .f,.inf2 .tu .f{font:600 12px/1.6 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.66)}',
      '.inf2 .f .ok{color:#7BE0AF}.inf2 .f b{color:#fff}',
      '.inf2 .f .neuf{color:#7BE0AF;font-weight:700}',
      /* le lien couvre toute la tuile : une seule cible, très grande */
      '.inf2 .tout{position:absolute;inset:0;z-index:4}',

      /* ══════════ UNIFIER LE PATCHWORK ══════════
         Trente sources = trente photographes, trente lumières, trente balances de
         blanc. Sans traitement, le mur ressemble à un panneau d'affichage. Ce voile
         teinté à la rubrique, très léger, leur donne une direction commune — c'est
         ce que fait un magazine avec ses images. Pas de mix-blend-mode : Safari y
         est capricieux, un simple dégradé en rgba suffit et ne casse rien. */
      '.inf2 .mq-teinte{position:absolute;inset:0;z-index:2;pointer-events:none;' +
        'background:linear-gradient(var(--ang,152deg),color-mix(in srgb,var(--acc) 30%,transparent) 0%,' +
        'color-mix(in srgb,var(--acc) 9%,transparent) 45%,transparent 78%),' +
        'linear-gradient(0deg,rgba(11,16,32,.30) 0%,transparent 52%);' +
        'transition:opacity .45s var(--ease)}',
      '.inf2 .tu:hover .mq-teinte,.inf2 .mur-une:hover .mq-teinte{opacity:.55}',

      /* ══════════ LA PLANCHE DEVIENT UNE COMPOSITION ══════════
         Un dégradé seul se répète et lasse. On y pose des anneaux concentriques
         décalés selon la rubrique : la planche devient un objet dessiné, pas un
         fond de secours. */
      '.inf2 .mq-plaque{--ox:26%;--oy:22%}',
      '.inf2 .a-rose .mq-plaque{--ox:74%;--oy:18%}.inf2 .a-amber .mq-plaque{--ox:18%;--oy:74%}',
      '.inf2 .a-green .mq-plaque{--ox:82%;--oy:70%}.inf2 .a-violet .mq-plaque{--ox:50%;--oy:14%}',
      '.inf2 .a-teal .mq-plaque{--ox:30%;--oy:62%}.inf2 .a-muted .mq-plaque{--ox:66%;--oy:40%}',
      '.inf2 .mq-plaque::after{content:"";position:absolute;inset:0;opacity:.55;' +
        'background:repeating-linear-gradient(var(--ang,58deg),rgba(255,255,255,.16) 0 1px,transparent 1px 12px),' +
        'repeating-radial-gradient(circle at var(--ox) var(--oy),' +
          'rgba(255,255,255,.13) 0 1px,transparent 1px 26px)}',

      /* ══════════ LE SURVOL DEVIENT UN GESTE ══════════ */
      '.inf2 .tu .b,.inf2 .mur-une .b{transition:transform .38s var(--ease)}',
      '.inf2 .tu:hover .b{transform:translateY(-3px)}',
      '.inf2 .tu h3,.inf2 .mur-une h2{transition:color .25s var(--ease-soft)}',

      /* ══════════ LA UNE PREND SA PLACE ══════════ */
      '.inf2 .mur-une h2{font-size:clamp(27px,4vw,52px);line-height:1.02;letter-spacing:-.03em;' +
        'text-shadow:0 2px 24px rgba(8,11,20,.4)}',
      '.inf2 .mur-une p{font-size:16.5px;text-shadow:0 1px 12px rgba(8,11,20,.35)}',
      '.inf2 .mur-une .cat{letter-spacing:.18em;padding:8px 14px}',

      /* ══════════ LA LUMIÈRE ══════════
         Le clair ne pardonne pas la platitude : un aplat crème sans source de
         lumière est plus mort qu'un noir. Ce halo est ce qui empêche la page
         d'être un fond uni. Pas de flou : Safari y laisse des images fantômes. */
      '.inf2 .mur-tete{position:relative;isolation:isolate;overflow:hidden}',
      '.inf2 .mur-halo{position:absolute;left:0;right:0;top:-140px;height:520px;' +
        'pointer-events:none;z-index:-1;' +
        'background:radial-gradient(46% 54% at 32% 52%,color-mix(in srgb,var(--ip-blue) 15%,transparent) 0%,transparent 70%),' +
        'radial-gradient(38% 46% at 76% 40%,color-mix(in srgb,var(--c-amber) 11%,transparent) 0%,transparent 72%),' +
        'radial-gradient(30% 38% at 54% 78%,color-mix(in srgb,var(--c-cat) 8%,transparent) 0%,transparent 74%)}',
      /* un filet de lumière sous la tête, qui sépare sans trancher */
      '.inf2 .mur-tete::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:1px;' +
        'background:linear-gradient(90deg,transparent,var(--line-strong) 18%,var(--line-strong) 82%,transparent)}',

      /* ══════════ LA MATIÈRE DES TUILES ══════════
         Ombres en trois couches (ambiante + portée + liseré haut-lumière interne) :
         c'est le liseré blanc en haut qui donne l'impression d'un objet posé,
         pas d'un rectangle peint. */
      '.inf2 .tu,.inf2 .mur-une{box-shadow:0 1px 2px rgba(16,19,28,.06),0 6px 16px rgba(16,19,28,.07),' +
        '0 18px 40px rgba(16,19,28,.09),0 1px 0 rgba(255,255,255,.14) inset}',
      '.inf2 .tu:hover{box-shadow:0 2px 4px rgba(16,19,28,.08),0 12px 28px rgba(16,19,28,.14),' +
        '0 30px 64px rgba(16,19,28,.16),0 1px 0 rgba(255,255,255,.22) inset}',
      '.inf2 .mur-une{box-shadow:0 2px 6px rgba(16,19,28,.07),0 16px 40px rgba(16,19,28,.12),' +
        '0 40px 90px rgba(16,19,28,.14),0 1px 0 rgba(255,255,255,.16) inset}',
      /* le survol : la tuile monte ET l\'image respire */
      '.inf2 .tu:hover .mq-cov img{transform:scale(1.08)}',
      '.inf2 .mur-une:hover .mq-cov img{transform:scale(1.045)}',

      /* ══════════ LE BANDEAU PREND DE LA MATIÈRE ══════════ */
      '.inf2 .alerte{background:linear-gradient(168deg,color-mix(in srgb,var(--c-amber) 7%,var(--card)) 0%,var(--card) 46%);' +
        'box-shadow:0 1px 2px rgba(16,19,28,.05),0 10px 26px rgba(16,19,28,.07),0 1px 0 rgba(255,255,255,.8) inset}',

      /* ══════════ L\'ESSENTIEL RESPIRE ══════════ */
      '.inf2 .ess{background:linear-gradient(172deg,color-mix(in srgb,var(--ip-blue) 4%,var(--card)) 0%,var(--card) 40%);' +
        'box-shadow:0 1px 2px rgba(16,19,28,.05),0 10px 26px rgba(16,19,28,.07),0 1px 0 rgba(255,255,255,.8) inset}',

      /* ══════════ À NE PAS MANQUER ══════════
         Le seul bloc qui ne se filtre pas et ne se replie pas. Éclairé, pas alarmant :
         une seule teinte ambre, réservée au compte à rebours quand l'échéance approche. */
      '.inf2 .alerte{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--c-amber);' +
        'border-radius:var(--r-md);padding:var(--sp-5) var(--sp-5) var(--sp-3);margin-bottom:var(--section-gap);box-shadow:var(--sh-2)}',
      '.inf2 .alerte-h{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-weight:800;font-size:15px;' +
        'letter-spacing:-.02em;color:var(--ip-ink);margin-bottom:var(--sp-4)}',
      '.inf2 .alerte-h svg{color:var(--c-amber);flex:0 0 auto}',
      '.inf2 .alerte-h span{margin-left:auto;font:600 12px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2)}',
      '.inf2 .al-grille{display:grid;grid-template-columns:1fr 1fr;gap:0 var(--sp-6)}',
      '@media(max-width:900px){.inf2 .al-grille{grid-template-columns:1fr}}',
      '.inf2 .al-i{position:relative;padding:var(--sp-3) 0;border-top:1px solid var(--line-2)}',
      '.inf2 .al-grille>.al-i:nth-child(-n+2){border-top:0;padding-top:0}',
      '@media(max-width:900px){.inf2 .al-grille>.al-i:nth-child(2){border-top:1px solid var(--line-2);padding-top:var(--sp-3)}}',

      '.inf2 .al-i:hover h3{color:var(--ip-blue)}',
      '.inf2 .al-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}',
      '.inf2 .al-cd{display:inline-flex;align-items:center;gap:6px;font:700 12px/1 var(--mono);font-variant-numeric:tabular-nums;' +
        'padding:6px 11px;border-radius:var(--r-pill);background:color-mix(in srgb,var(--c-amber) 12%,transparent);' +
        'color:var(--c-amber-txt);border:1px solid color-mix(in srgb,var(--c-amber) 26%,transparent)}',
      '.inf2 .al-cd.urgent{background:color-mix(in srgb,var(--c-rose) 12%,transparent);color:var(--c-rose-txt);' +
        'border-color:color-mix(in srgb,var(--c-rose) 28%,transparent)}',
      '.inf2 .al-cd.fait{background:var(--card-2);color:var(--muted);border-color:var(--line)}',
      '.inf2 .al-cd.conc,.inf2 .al-cd.soc{background:color-mix(in srgb,var(--c-cat) 11%,transparent);color:var(--c-cat);' +
        'border-color:color-mix(in srgb,var(--c-cat) 26%,transparent)}',
      '.inf2 .al-cd.amo{background:color-mix(in srgb,var(--ip-blue) 12%,transparent);color:var(--ip-blue);' +
        'border-color:color-mix(in srgb,var(--ip-blue) 30%,transparent)}',
      '.inf2 .al-cd.fer{background:color-mix(in srgb,var(--c-rose) 14%,transparent);color:var(--c-rose-txt);' +
        'border-color:color-mix(in srgb,var(--c-rose) 32%,transparent);font-weight:800}',
      '.inf2 .al-cd.tit{background:color-mix(in srgb,var(--c-opp) 12%,transparent);color:var(--c-mint-txt);' +
        'border-color:color-mix(in srgb,var(--c-opp) 28%,transparent)}',
      '.inf2 .al-cd.dem{background:color-mix(in srgb,var(--c-froid) 13%,transparent);color:#006F80;' +
        'border-color:color-mix(in srgb,var(--c-froid) 30%,transparent)}',
      '.inf2 .al-cd.cess{background:color-mix(in srgb,var(--c-opp) 12%,transparent);color:var(--c-mint-txt);' +
        'border-color:color-mix(in srgb,var(--c-opp) 28%,transparent)}',
      '.inf2 .al-cd.sanc,.inf2 .al-cd.diff{background:color-mix(in srgb,var(--c-rose) 12%,transparent);' +
        'color:var(--c-rose-txt);border-color:color-mix(in srgb,var(--c-rose) 28%,transparent)}',
      '.inf2 .al-d{font-size:12.5px;color:var(--muted)}',
      '.inf2 .al-ab{font:600 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted-2);' +
        'background:var(--surf-sunken);padding:5px 9px;border-radius:var(--r-pill)}',
      '.inf2 .al-i h3{font-family:var(--serif);font-weight:600;font-size:17.5px;line-height:1.28;letter-spacing:-.016em;' +
        'margin:0 0 7px;color:var(--ip-ink)}',
      '.inf2 .al-i p{font-size:14px;font-weight:600;line-height:1.45;color:var(--ip-ink-2);margin:0 0 6px}',
      '.inf2 .al-client{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:8px 0 9px;padding:9px 13px;' +
        'border-radius:var(--r-sm);background:color-mix(in srgb,var(--c-rose) 11%,transparent);' +
        'border:1px solid color-mix(in srgb,var(--c-rose) 28%,transparent)}',
      '.inf2 .al-client svg{color:var(--c-rose);flex:0 0 auto}',
      '.inf2 .al-client b{font:800 12px/1 var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--c-rose-txt)}',
      '.inf2 .al-client span{font-size:13.5px;font-weight:600;color:var(--ip-ink)}',
      '.inf2 .al-plus{display:inline-flex;align-items:center;justify-content:center;min-height:var(--tap-min);' +
        'padding:0 18px;margin-top:var(--sp-3);border-radius:var(--r-btn);border:1px solid var(--line-strong);' +
        'background:var(--card);color:var(--ip-ink);font-size:13.5px;font-weight:650;cursor:pointer}',
      '.inf2 .al-plus:hover{border-color:var(--c-amber);color:var(--c-amber-txt)}',
      '.inf2 .al-f{font:600 12px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted-2)}',

      /* ══════════ L'ESSENTIEL EN 30 SECONDES ══════════
         Le seul bloc de la page qui se LIT au lieu de se regarder. Fond clair,
         filets fins, aucune image : c'est un sommaire, pas une vitrine. */
      '.inf2 .ess{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);padding:var(--sp-5) var(--sp-6) var(--sp-4);margin-bottom:var(--section-gap);box-shadow:var(--sh-2)}',
      '.inf2 .ess-h{display:flex;align-items:baseline;gap:var(--sp-3);flex-wrap:wrap;padding-bottom:var(--sp-3);border-bottom:1.5px solid var(--ip-ink);margin-bottom:var(--sp-2)}',
      '.inf2 .ess-h b{font-family:var(--serif);font-weight:600;font-size:23px;letter-spacing:-.02em;color:var(--ip-ink)}',
      '.inf2 .ess-h span{font:600 12px/1 var(--mono);letter-spacing:.11em;text-transform:uppercase;color:var(--muted-2)}',
      '.inf2 .ess-l{list-style:none;margin:0;padding:0}',
      '.inf2 .ess-i{position:relative;display:flex;gap:var(--sp-4);padding:var(--sp-4) 0;border-top:1px solid var(--line-2)}',
      '.inf2 .ess-i:first-child{border-top:0}',
      '.inf2 .ess-i:hover{background:var(--card-2)}',
      '.inf2 .ess-n{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
        "font:800 12.5px/1 var(--mono);color:#fff;background:color-mix(in srgb,var(--acc) 70%,black)}",
      '.inf2 .ess-b{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:5px}',
      '.inf2 .ess-cat{font:700 12px/1 var(--mono);letter-spacing:.15em;text-transform:uppercase;color:var(--acc-t)}',
      '.inf2 .ess-b b{font-family:var(--serif);font-weight:600;font-size:19px;line-height:1.25;letter-spacing:-.016em;color:var(--ip-ink)}',
      '.inf2 .ess-i:hover .ess-b b{color:var(--ip-blue)}',
      '.inf2 .ess-p{font-size:14.5px;line-height:1.55;color:var(--ip-ink-2)}',
      '.inf2 .ess-f{font:600 12px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted-2)}',
      '.inf2 .ess-f em{color:var(--ip-blue);font-style:normal;font-weight:700}',

      /* le chapeau sur la tuile : on comprend le sujet sans même ouvrir */
      '.inf2 .tu-p{font-size:13px;line-height:1.45;color:rgba(255,255,255,.78);margin:0 0 9px;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',

      /* ══════════ LE PANNEAU DE LECTURE ══════════
         Pas de flou d'arrière-plan : Safari y laisse des images fantômes. Un voile
         plein et une ombre franche font le même travail, sans risque. */
      '.inf-fige{overflow:hidden}',
      // le panneau vit hors de .inf2 : il lui faut ses propres variables
      "#inf-panneau{--serif:'Newsreader',Georgia,'Times New Roman',serif}",
      '#inf-panneau .a-rose{--acc:var(--c-rose);--acc-t:var(--c-rose-txt)}',
      '#inf-panneau .a-amber{--acc:var(--c-amber);--acc-t:var(--c-amber-txt)}',
      '#inf-panneau .a-blue{--acc:var(--ip-blue);--acc-t:var(--ip-blue)}',
      '#inf-panneau .a-green{--acc:var(--c-opp);--acc-t:var(--c-mint-txt)}',
      '#inf-panneau .a-violet{--acc:var(--c-cat);--acc-t:var(--c-cat)}',
      '#inf-panneau .a-teal{--acc:var(--c-froid);--acc-t:#006F80}',
      '#inf-panneau .a-muted{--acc:var(--muted);--acc-t:var(--muted)}',
      '#inf-panneau .inf-pan-fond{position:fixed;inset:0;z-index:200;background:rgba(10,13,22,.52);animation:inf-fondu .22s ease both}',
      '@keyframes inf-fondu{from{opacity:0}to{opacity:1}}',
      '#inf-panneau .inf-pan{position:fixed;top:0;right:0;bottom:0;z-index:201;width:min(520px,100%);overflow-y:auto;' +
        '-webkit-overflow-scrolling:touch;background:var(--card);box-shadow:var(--sh-pop);animation:inf-entre .3s var(--ease) both}',
      '@keyframes inf-entre{from{transform:translateX(28px);opacity:0}to{transform:none;opacity:1}}',
      '@media(prefers-reduced-motion:reduce){#inf-panneau .inf-pan,#inf-panneau .inf-pan-fond{animation-duration:.01ms}}',
      '#inf-panneau .inf-pan-x{position:absolute;right:14px;top:14px;z-index:3;width:var(--tap-min);height:var(--tap-min);' +
        'border-radius:50%;border:1px solid var(--line-strong);background:var(--card);color:var(--ip-ink);' +
        'display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:var(--sh-1)}',
      '#inf-panneau .inf-pan-img .mq-cov{border-radius:0}',
      '#inf-panneau .inf-pan-b{padding:var(--sp-6)}',
      '#inf-panneau .inf-pan:not(:has(.inf-pan-img)) .inf-pan-b{padding-top:var(--sp-8)}',
      '#inf-panneau .inf-pan-top{display:flex;align-items:center;gap:var(--gap-tight);flex-wrap:wrap;margin-bottom:var(--sp-3)}',
      "#inf-panneau .cat{display:inline-block;font:700 12px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#fff;background:color-mix(in srgb,var(--acc) 70%,black);padding:7px 12px;border-radius:var(--r-pill)}",
      '#inf-panneau .inf-pan-ok{font:700 12px/1 var(--mono);color:var(--c-mint-txt);background:color-mix(in srgb,var(--c-opp) 12%,transparent);padding:6px 10px;border-radius:var(--r-pill)}',
      '#inf-panneau .inf-pan-mn{font:600 12px/1 var(--mono);color:var(--muted-2)}',
      '#inf-panneau h2{font-family:var(--serif);font-weight:600;font-size:26px;line-height:1.16;letter-spacing:-.022em;margin:0 0 var(--sp-3);color:var(--ip-ink)}',
      '#inf-panneau .inf-pan-chap{font-size:16px;line-height:1.62;color:var(--ip-ink-2);margin:0 0 var(--sp-5)}',
      '#inf-panneau .inf-pan-sec{margin-bottom:var(--sp-5)}',
      '#inf-panneau .inf-pan-l{display:block;font:700 12px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--acc-t);margin-bottom:var(--sp-3)}',
      '#inf-panneau .inf-pan-sec ul{margin:0;padding:0;list-style:none}',
      '#inf-panneau .inf-pan-sec li{position:relative;padding:0 0 var(--sp-3) 20px;font-size:15px;line-height:1.6;color:var(--ip-ink)}',
      '#inf-panneau .inf-pan-sec li::before{content:"";position:absolute;left:2px;top:9px;width:7px;height:7px;border-radius:50%;background:var(--acc)}',
      '#inf-panneau .inf-pan-chf{display:flex;flex-direction:column;gap:var(--sp-2)}',
      '#inf-panneau .chf{background:var(--surf-sunken);border-radius:var(--r-sm);padding:var(--sp-3) var(--sp-4)}',
      '#inf-panneau .chf b{display:block;font:800 21px/1 var(--mono);font-variant-numeric:tabular-nums;color:var(--acc-t);letter-spacing:-.02em}',
      '#inf-panneau .chf span{display:block;font-size:13px;line-height:1.45;color:var(--muted);margin-top:6px}',
      '#inf-panneau .inf-pan-pour{background:color-mix(in srgb,var(--acc) 8%,transparent);border-left:3px solid var(--acc);' +
        'border-radius:0 var(--r-sm) var(--r-sm) 0;padding:var(--sp-3) var(--sp-4);font-size:14.5px;font-weight:600;line-height:1.5;color:var(--ip-ink);margin-bottom:var(--sp-5)}',
      '#inf-panneau .inf-pan-pour b{display:block;font:700 12px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--acc-t);margin-bottom:5px}',
      '#inf-panneau .inf-pan-src{font:600 12px/1.6 var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted-2);margin-bottom:var(--sp-4)}',
      '#inf-panneau .inf-pan-src b{color:var(--ip-blue)}',
      '#inf-panneau .inf-pan-go{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap-min);padding:0 20px;border-radius:var(--r-btn);' +
        'background:var(--ip-blue);color:#fff;font-size:14px;font-weight:650;text-decoration:none;box-shadow:var(--sh-blue)}',
      '#inf-panneau .inf-pan-go:hover{transform:translateY(var(--mo-lift));box-shadow:var(--sh-blue-h)}',
      '@media(max-width:640px){',
      '#inf-panneau .inf-pan{top:auto;left:0;width:100%;max-height:92vh;border-radius:var(--r-card) var(--r-card) 0 0;' +
        'animation:inf-monte .3s var(--ease) both}',
      '@keyframes inf-monte{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}',
      '#inf-panneau .inf-pan-b{padding:var(--sp-5) var(--sp-4) var(--sp-7)}',
      '#inf-panneau h2{font-size:22px}',
      '}',

      /* ══════════ « DANS TON SECTEUR » (Bodacc) — 25/09/2026 ══════════
         Sa propre lumière, comme la carte de tête : deux halos radiaux discrets,
         SANS backdrop-filter ni blur (interdits Safari). */
      '.inf2 .sct{position:relative;background:linear-gradient(180deg,var(--card) 0%,var(--card-2) 100%);' +
        'border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);' +
        'padding:var(--sp-6) var(--sp-6) var(--sp-5);overflow:hidden;isolation:isolate;margin-bottom:var(--section-gap)}',
      '.inf2 .sct::before{content:"";position:absolute;inset:-1px;z-index:-1;pointer-events:none;' +
        'background:radial-gradient(520px 260px at 0% 0%,color-mix(in srgb,var(--ip-blue) 10%,transparent),transparent 70%),' +
                   'radial-gradient(420px 240px at 100% 0%,color-mix(in srgb,var(--c-cat) 8%,transparent),transparent 70%)}',
      '.inf2 .sct-head{display:flex;align-items:flex-start;gap:var(--sp-4);flex-wrap:wrap}',
      '.inf2 .sct-ic{width:46px;height:46px;flex:none;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;' +
        'background:linear-gradient(145deg,#2F74FF 0%,var(--ip-blue) 55%,#0034A0 100%);box-shadow:var(--sh-blue)}',
      '.inf2 .sct-meta{flex:1;min-width:220px}',
      '.inf2 .sct-t{font-family:var(--serif);font-weight:600;font-size:21px;letter-spacing:-.02em;line-height:1.1;margin:2px 0 4px;color:var(--ip-ink)}',
      '.inf2 .sct-s{font-size:13.5px;color:var(--muted);line-height:1.4;font-weight:500}',
      '.inf2 .sct-scope{display:flex;gap:4px;padding:4px;background:var(--surf-sunken);border-radius:var(--r-pill);flex-wrap:wrap}',
      '.inf2 .sct-scope button,.inf2 .sct-scope select{border:0;background:transparent;padding:8px 13px;border-radius:var(--r-pill);' +
        'font-size:13px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;min-height:var(--tap-min);font-family:inherit}',
      '.inf2 .sct-scope button[aria-pressed="true"]{background:var(--card);color:var(--ip-blue);box-shadow:var(--sh-1)}',
      '.inf2 .sct-scope select{max-width:190px;text-overflow:ellipsis;-webkit-appearance:none;appearance:none;padding-right:26px;font-size:16px}',
      '.inf2 .sct-scope-note{font-size:12px;color:var(--muted);font-weight:600;margin:8px 2px 0;text-align:right;width:100%}',
      '.inf2 .sct-why{margin-top:var(--sp-4);display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.inf2 .sct-why-l{font-size:12.5px;font-weight:700;color:var(--ip-ink-2);margin-right:2px}',
      '.inf2 .sct-dep{display:inline-flex;align-items:center;gap:7px;padding:5px 11px 5px 5px;background:var(--card);' +
        'border:1px solid var(--line);border-radius:var(--r-pill);font-size:12.5px;font-weight:600;color:var(--ip-ink-2);box-shadow:var(--sh-1)}',
      '.inf2 .sct-dep b{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:22px;padding:0 6px;' +
        'border-radius:var(--r-pill);background:color-mix(in srgb,var(--ip-blue) 12%,transparent);color:var(--ip-blue);font-size:12px;font-weight:800}',
      '.inf2 .sct-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:var(--sp-5) 0 var(--sp-3)}',
      '.inf2 .sct-bar-t{font-size:13px;font-weight:700;color:var(--ip-ink-2)}',
      '.inf2 .sct-bar-t span{font-weight:500;color:var(--muted)}',
      '.inf2 .sct-per{display:flex;gap:4px;padding:3px;background:var(--surf-sunken);border-radius:12px}',
      '.inf2 .sct-per button{border:0;background:transparent;padding:7px 12px;border-radius:9px;font-size:12.5px;font-weight:700;' +
        'color:var(--ip-ink-2);cursor:pointer;min-height:34px;font-family:inherit}',
      '.inf2 .sct-per button[aria-pressed="true"]{background:var(--card);color:var(--ip-ink);box-shadow:var(--sh-1)}',
      '.inf2 .sct-fams{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}',
      '@media(max-width:760px){.inf2 .sct-fams{grid-template-columns:repeat(2,1fr)}.inf2 .sct-fams .sct-fam:last-child{grid-column:span 2}}',
      '.inf2 .sct-fam{--c:var(--ip-blue);position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:7px;' +
        'padding:12px 12px 11px;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:var(--r-sm);' +
        'box-shadow:var(--sh-1);cursor:pointer;overflow:hidden;min-height:var(--tap-min);' +
        'transition:transform .22s var(--ease),box-shadow .22s var(--ease)}',
      '.inf2 .sct-fam::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--c);opacity:.9}',
      '.inf2 .sct-fam:hover{transform:translateY(-2px);box-shadow:var(--sh-2)}',
      '.inf2 .sct-fam:focus-visible{outline:2px solid var(--c);outline-offset:2px}',
      '.inf2 .sct-fi{width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--c);' +
        'background:color-mix(in srgb,var(--c) 11%,var(--card))}',
      '.inf2 .sct-fn{font-size:24px;font-weight:800;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums;color:var(--ip-ink)}',
      '.inf2 .sct-fl{font-size:12px;font-weight:600;color:var(--ip-ink-2);line-height:1.25}',
      '.inf2 .sct-ck{position:absolute;top:9px;right:9px;width:17px;height:17px;border-radius:6px;background:var(--c);color:#fff;' +
        'display:flex;align-items:center;justify-content:center}',
      '.inf2 .sct-fam.off{background:var(--card-2)}',
      '.inf2 .sct-fam.off .sct-fn,.inf2 .sct-fam.off .sct-fl{color:var(--muted-2)}',
      '.inf2 .sct-fam.off .sct-fi{background:var(--surf-sunken);color:var(--muted-2)}',
      '.inf2 .sct-fam.off::before{background:var(--line-strong)}',
      '.inf2 .sct-fam.off .sct-ck{background:transparent;border:1.5px solid var(--line-strong);color:transparent}',
      '.inf2 .sct-fam.zero .sct-fn{color:var(--muted-2)}',
      '.inf2 .sct-grp{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);' +
        'margin:var(--sp-5) 2px var(--sp-3);display:flex;align-items:center;gap:10px}',
      '.inf2 .sct-grp::after{content:"";flex:1;height:1px;background:var(--line)}',
      '.inf2 .sct-list{display:flex;flex-direction:column;gap:9px}',
      '.inf2 .sct-row{--c:var(--ip-blue);--ct:var(--ip-blue);position:relative;display:flex;align-items:flex-start;gap:13px;' +
        'width:100%;text-align:left;padding:14px 16px 14px 14px;background:var(--card);border:1px solid var(--line);' +
        'border-radius:var(--r-sm);box-shadow:var(--sh-1);cursor:pointer;font-family:inherit;' +
        'transition:transform .22s var(--ease),box-shadow .22s var(--ease),border-color .22s var(--ease)}',
      '.inf2 .sct-row:hover{transform:translateY(-2px);box-shadow:var(--sh-2);border-color:color-mix(in srgb,var(--c) 32%,var(--line))}',
      '.inf2 .sct-row:focus-visible{outline:2px solid var(--c);outline-offset:2px}',
      '.inf2 .sct-ri{width:38px;height:38px;flex:none;border-radius:11px;display:flex;align-items:center;justify-content:center;color:var(--c);' +
        'background:color-mix(in srgb,var(--c) 11%,var(--card));border:1px solid color-mix(in srgb,var(--c) 18%,var(--line))}',
      '.inf2 .sct-rb{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
      '.inf2 .sct-rn{font-size:15px;font-weight:700;letter-spacing:-.01em;line-height:1.25;color:var(--ip-ink)}',
      '.inf2 .sct-rm{font-size:12.5px;color:var(--muted);font-weight:500;line-height:1.35}',
      '.inf2 .sct-rm .k{color:var(--ct);font-weight:700}',
      '.inf2 .sct-rg{font-size:13px;font-weight:600;color:var(--ip-ink-2);line-height:1.35;margin-top:3px;display:flex;gap:6px}',
      '.inf2 .sct-rg svg{flex:none;margin-top:2px;color:var(--ct)}',
      '.inf2 .sct-rt{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:8px}',
      '.inf2 .sct-tag{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:4px 9px;' +
        'border-radius:var(--r-pill);white-space:nowrap}',
      '.inf2 .sct-tag.client{background:var(--ip-blue);color:#fff}',
      '.inf2 .sct-tag.prospect{background:color-mix(in srgb,var(--ip-blue) 12%,var(--card));color:var(--ip-blue)}',
      '.inf2 .sct-tag.hors{background:var(--surf-sunken);color:var(--ip-ink-2)}',
      '.inf2 .sct-when{font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap}',
      '.inf2 .sct-new{position:absolute;left:-4px;top:18px;width:8px;height:8px;border-radius:50%;background:var(--ip-blue);' +
        'box-shadow:0 0 0 3px var(--card)}',
      '.inf2 .sct-row.lu{background:var(--card-2);box-shadow:none}',
      '.inf2 .sct-row.lu .sct-rn{color:var(--ip-ink-2);font-weight:600}',
      '.inf2 .sct-row.lu .sct-ri{background:var(--surf-sunken);color:var(--muted-2);border-color:var(--line)}',
      '.inf2 .sct-row.lu .sct-new{display:none}',
      '@media(max-width:560px){.inf2 .sct-row{flex-wrap:wrap}.inf2 .sct-row .sct-rt{flex-direction:row;align-items:center;width:100%;' +
        'padding-left:51px;justify-content:space-between}}',
      '.inf2 .sct-empty{padding:26px 18px;text-align:center;color:var(--muted);font-size:14px;background:var(--card-2);' +
        'border:1px dashed var(--line-strong);border-radius:var(--r-sm)}',
      '.inf2 .sct-more{display:block;margin:14px auto 0;border:1px solid var(--line);background:var(--card);border-radius:var(--r-pill);' +
        'padding:9px 18px;font-size:13px;font-weight:700;color:var(--ip-blue);cursor:pointer;box-shadow:var(--sh-1);min-height:40px;font-family:inherit}',
      '.inf2 .sct-src{margin-top:var(--sp-4);font-size:12px;color:var(--muted);line-height:1.5;text-align:center}',
      /* ── panneau de détail (préfixé sct-, à part de #inf-panneau) ── */
      '#sct-panneau{--serif:var(--serif,Georgia,serif)}',
      '#sct-panneau .sct-fond{position:fixed;inset:0;z-index:200;background:rgba(10,13,22,.52);animation:inf-fondu .22s ease both}',
      '#sct-panneau .sct-pan{position:fixed;top:0;right:0;bottom:0;z-index:201;width:min(440px,100%);overflow-y:auto;' +
        'background:var(--card);box-shadow:-20px 0 60px rgba(16,19,28,.16);animation:sct-glisse .32s var(--ease) both}',
      '@keyframes sct-glisse{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}',
      '@media(prefers-reduced-motion:reduce){#sct-panneau .sct-pan,#sct-panneau .sct-fond{animation-duration:.01ms}}',
      '#sct-panneau .sct-x{position:absolute;right:14px;top:14px;z-index:3;width:var(--tap-min);height:var(--tap-min);' +
        'border-radius:12px;border:1px solid var(--line);background:var(--card);cursor:pointer;display:flex;align-items:center;' +
        'justify-content:center;color:var(--ip-ink-2)}',
      '#sct-panneau .sct-pan-top{--c:var(--ip-blue);position:relative;padding:22px 22px 18px;border-bottom:1px solid var(--line);' +
        'background:radial-gradient(360px 180px at 0% 0%,color-mix(in srgb,var(--c) 14%,transparent),transparent 72%)}',
      '#sct-panneau .sct-pan-f{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:800;letter-spacing:.04em;' +
        'text-transform:uppercase;color:var(--ct)}',
      '#sct-panneau h2{font-family:var(--serif);font-weight:600;font-size:22px;letter-spacing:-.02em;line-height:1.15;' +
        'margin:10px 50px 6px 0;color:var(--ip-ink)}',
      '#sct-panneau .sct-pan-v{font-size:14px;color:var(--muted);font-weight:600}',
      '#sct-panneau .sct-pan-b{padding:20px 22px;display:flex;flex-direction:column;gap:16px}',
      '#sct-panneau .sct-kv{display:grid;grid-template-columns:auto 1fr;gap:9px 16px;font-size:14px;margin:0}',
      '#sct-panneau .sct-kv dt{color:var(--muted);font-weight:600}',
      '#sct-panneau .sct-kv dd{margin:0;font-weight:700;color:var(--ip-ink)}',
      '#sct-panneau .sct-do{border-radius:var(--r-sm);padding:14px 15px;background:color-mix(in srgb,var(--c) 8%,var(--card));' +
        'border:1px solid color-mix(in srgb,var(--c) 20%,var(--line))}',
      '#sct-panneau .sct-do small{display:block;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;' +
        'color:var(--ct);margin-bottom:5px}',
      '#sct-panneau .sct-do p{margin:0;font-size:15px;font-weight:700;line-height:1.4;color:var(--ip-ink)}',
      '#sct-panneau .sct-act{display:flex;flex-direction:column;gap:9px;margin-top:2px}',
      '#sct-panneau .sct-btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:var(--tap-min);' +
        'border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;border:1px solid var(--line);font-family:inherit}',
      '#sct-panneau .sct-btn.pri{background:linear-gradient(180deg,#1A63F0,var(--ip-blue));color:#fff;border-color:transparent;box-shadow:var(--sh-blue)}',
      '#sct-panneau .sct-btn.sec{background:var(--card);color:var(--ip-ink)}',
      '#sct-panneau .sct-btn.ghost{background:transparent;border-color:transparent;color:var(--muted);font-size:13.5px;min-height:40px}',
      '@media(max-width:560px){#sct-panneau .sct-pan{top:auto;left:0;width:100%;max-height:88vh;' +
        'border-radius:var(--r-card) var(--r-card) 0 0;animation:sct-monte .32s var(--ease) both}}',
      '@keyframes sct-monte{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}',

      /* ══════════ LE MUR ══════════ */
'.inf2 .mur{display:flex;align-items:flex-start;gap:var(--sp-3)}',
      '.inf2 .mur-col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:var(--sp-3)}',
      '.inf2 .tu{position:relative;margin:0 0 var(--sp-3);border-radius:var(--r-md);overflow:hidden;background:#10131C;box-shadow:var(--sh-1);transition:transform .3s var(--ease),box-shadow .3s var(--ease)}',
      
      '.inf2 .tu:hover{transform:translateY(var(--mo-lift));box-shadow:var(--sh-2)}',
      '.inf2 .tu:hover .mq-cov img{transform:scale(1.06)}',
      '.inf2 .tu .b{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:var(--sp-4) 17px 16px}',
      '.inf2 .tu h3{font-family:var(--serif);font-weight:600;font-size:19px;line-height:1.2;letter-spacing:-.014em;color:#fff;margin:0 0 9px;text-wrap:balance}',
      '.inf2 .tu.xl h3{font-size:23px}',

      /* ══════════ LE RADAR, EN JETONS ══════════ */

      /* ══════════ PASTILLES DE RUBRIQUE ══════════ */
      '.inf2 .brf-chips{display:flex;gap:var(--gap-tight);flex-wrap:wrap;margin-bottom:var(--sp-3)}',
      '.inf2 .brf-chip{display:inline-flex;align-items:center;gap:7px;min-height:var(--tap-min);padding:0 15px;border-radius:var(--r-pill);border:1.5px solid var(--line-strong);background:var(--card);font-size:12.5px;font-weight:650;color:var(--ip-ink-2);cursor:pointer;transition:all .18s var(--ease-soft)}',
      '.inf2 .brf-chip .pt{width:8px;height:8px;border-radius:50%;background:var(--acc,var(--muted));display:inline-block}',
      '.inf2 .brf-chip i{font:700 12px/1 var(--mono);font-style:normal;color:var(--muted-2)}',
      '.inf2 .brf-chip:hover{border-color:var(--acc,var(--ip-blue))}',
      '.inf2 .brf-chip.on{background:var(--ip-ink);border-color:var(--ip-ink);color:#fff}',
      '.inf2 .brf-chip.on i{color:rgba(255,255,255,.7)}',
      '.inf2 .brf-search{display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--line-strong);border-radius:var(--r-control);padding:0 var(--sp-3);margin-bottom:var(--sp-4);color:var(--muted-2)}',
      /* 16px minimum : en dessous, iOS zoome sur le champ au focus */
      '.inf2 .brf-search input{flex:1 1 auto;min-width:0;border:0;outline:0;background:transparent;font:400 16px/1 var(--font);color:var(--ip-ink);min-height:var(--tap-min);padding:0}',
      '.inf2 .brf-search input::placeholder{color:var(--muted-2)}',
      /* ── téléphone ── */
      '@media(max-width:640px){',
      '.inf2 .mq-cov.r-21x9{aspect-ratio:4/5}',
      '.inf2 .mur-une{border-radius:var(--r-md)}',
      '.inf2 .mur-une .b{padding:var(--sp-5) var(--sp-4) var(--sp-4)}',
      '.inf2 .mur-tete{padding:var(--sp-4) 0}',
      '.inf2 .alerte{padding:var(--sp-4) var(--sp-4) var(--sp-2)}.inf2 .al-i h3{font-size:17px}.inf2 .al-i p{font-size:14px}',
      '.inf2 .ess{padding:var(--sp-4)}.inf2 .ess-b b{font-size:17px}.inf2 .ess-p{font-size:13.5px}',
      '.inf2 .ess-i{gap:var(--sp-3)}.inf2 .ess-n{width:22px;height:22px;font-size:12px}',
      '.inf2 .mur-tete-d{gap:var(--sp-4);font-size:12px}',
      '.inf2 .mur-tete-d b{font-size:16px}',
      '.inf2 .tu h3{font-size:15.5px;line-height:1.24}.inf2 .tu.xl h3{font-size:18px}',
      '.inf2 .tu .b{padding:var(--sp-3) 13px 12px}',
      '.inf2 .tu .cat{font-size:12px;padding:5px 9px;margin-bottom:9px}',
      '.inf2 .tu .f{font-size:12px;line-height:1.5}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }
})();

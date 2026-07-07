/* ============================================================
   v2-mkt-li-strategy.js — Assistant Stratégie LinkedIn
   Générateur de plan éditorial (quiz → plan daté prêt à suivre).
   100% client-side. Réutilise V2.mktLinkedin (savePost/newId/goCal).
   ============================================================ */
(function () {
  var V2 = window.V2 = window.V2 || {};
  function esc(s) { return (V2.esc ? V2.esc(s) : String(s == null ? '' : s)); }
  function LI() { return V2.mktLinkedin || null; }
  function PILL() { return (LI() && LI().PILLARS) || [
    { k: 'produit', label: 'Produit', color: '#0057FF' },
    { k: 'conseil', label: 'Conseil officine', color: '#00B37A' },
    { k: 'coulisses', label: 'Coulisses / logistique', color: '#FFB020' },
    { k: 'recrutement', label: 'Recrutement', color: '#FF4D6D' },
    { k: 'tempsfort', label: 'Temps fort', color: '#8B5CF6' }
  ]; }
  function pillMeta(k) { var a = PILL(); for (var i = 0; i < a.length; i++) if (a[i].k === k) return a[i]; return a[0]; }

  // ── Options du quiz ──
  var OBJECTIVES = [
    { k: 'notoriete', label: 'Notoriété', sub: 'Se faire connaître', w: { produit: 2, conseil: 2, coulisses: 3, recrutement: 1, tempsfort: 2 } },
    { k: 'recruter', label: 'Recruter', sub: 'Attirer des talents', w: { produit: 1, conseil: 1, coulisses: 3, recrutement: 4, tempsfort: 1 } },
    { k: 'offre', label: 'Mettre en avant l’offre / Offilog', sub: 'Valoriser le catalogue', w: { produit: 4, conseil: 2, coulisses: 2, recrutement: 1, tempsfort: 2 } },
    { k: 'fideliser', label: 'Fidéliser les officines clientes', sub: 'Renforcer la relation', w: { produit: 2, conseil: 4, coulisses: 2, recrutement: 1, tempsfort: 2 } },
    { k: 'conquerir', label: 'Conquérir de nouvelles officines', sub: 'Prospecter', w: { produit: 3, conseil: 3, coulisses: 3, recrutement: 1, tempsfort: 2 } }
  ];
  function objOf(k) { for (var i = 0; i < OBJECTIVES.length; i++) if (OBJECTIVES[i].k === k) return OBJECTIVES[i]; return OBJECTIVES[0]; }
  var TONES = [
    { k: 'expert', label: 'Expert & factuel' },
    { k: 'proche', label: 'Proche & humain' },
    { k: 'punchy', label: 'Punchy & moderne' }
  ];
  var CADENCES = [1, 2, 3];
  var HORIZONS = [4, 8, 12];
  var FMT = { carrousel: 'Carrousel', video: 'Vidéo', photo: 'Photo', texte: 'Texte' };

  // ── Banque d’angles (le cœur) — jamais de conditions commerciales, ni UPSA/Sanofi ──
  var ANGLES = {
    produit: [
      { h: 'Plus de 14 000 références parapharma, un seul partenaire.', f: 'carrousel', core: 'Dermocosmétique, bébé, nature, vétérinaire, hygiène… La parapharmacie Offilog rassemble une largeur de gamme rare pour équiper vos rayons sans multiplier les interlocuteurs.' },
      { h: 'La rupture n’est pas une fatalité.', f: 'texte', core: 'La disponibilité, c’est notre métier. On travaille chaque jour pour que le produit que votre patient attend soit là quand il le demande.' },
      { h: 'Nouveautés parapharma : ce qui arrive dans vos rayons.', f: 'carrousel', core: 'On veille sur les lancements pour vous faire gagner du temps. Voici une sélection de nouveautés à repérer pour la saison qui vient.' },
      { h: '430 marques, une seule commande.', f: 'photo', core: 'Simplifier votre sourcing, c’est libérer du temps au comptoir. Retrouvez l’essentiel de la parapharmacie au même endroit, en une seule commande.' },
      { h: 'Comment on sélectionne les produits qui tournent vraiment.', f: 'carrousel', core: 'Derrière chaque référence, il y a un choix. On privilégie ce qui répond à une vraie demande en officine, pas ce qui remplit un catalogue.' },
      { h: 'Anticipez vos rayons avant la demande.', f: 'texte', core: 'Allergies, solaire, immunité… Chaque saison a ses pics. Préparer ses linéaires en amont, c’est éviter la rupture au pire moment.' },
      { h: 'Le réassort express, votre allié anti-rupture.', f: 'photo', core: 'Un manque repéré le matin, comblé au plus vite : la réactivité logistique fait toute la différence sur vos ventes.' },
      { h: 'Dermocosmétique, bébé, nature, vétérinaire… tout au même endroit.', f: 'carrousel', core: 'Une gamme large et cohérente pour couvrir tous les besoins de vos patients, du soin quotidien au conseil spécialisé.' }
    ],
    conseil: [
      { h: '3 astuces merchandising pour dynamiser votre linéaire ce mois-ci.', f: 'carrousel', core: '1) Placez la nouveauté à hauteur des yeux. 2) Créez un univers saisonnier. 3) Croisez les produits complémentaires. Des gestes simples, un impact réel.' },
      { h: 'Gérer son stock sans immobiliser sa trésorerie.', f: 'texte', core: 'Le bon équilibre : assez pour ne jamais manquer, pas trop pour ne pas dormir sur du stock. Quelques repères pour ajuster vos commandes.' },
      { h: 'La tendance parapharma que vos patients vont réclamer.', f: 'carrousel', core: 'Les attentes évoluent vite : naturalité, routines ciblées, made in France. Anticiper la demande, c’est prendre une longueur d’avance.' },
      { h: 'Votre vitrine capte-t-elle l’attention en 3 secondes ?', f: 'photo', core: 'Une vitrine claire, saisonnière et lisible arrête le passant. Un message, une gamme, un appel à entrer : l’essentiel tient en peu de mots.' },
      { h: 'Transformer un conseil en vente additionnelle, sans forcer.', f: 'texte', core: 'La vente additionnelle réussie part d’un vrai besoin patient. Le bon réflexe : compléter, pas pousser. Le conseil fait le reste.' },
      { h: 'Les 5 produits à mettre en avant avant chaque changement de saison.', f: 'carrousel', core: 'Un rétroplanning simple de vos mises en avant vous évite de courir après la saison. Voici comment structurer vos temps forts.' },
      { h: 'Fidéliser un patient parapharma : ce qui fait la différence.', f: 'texte', core: 'Un conseil personnalisé, un suivi, une disponibilité réelle. La fidélité se construit au comptoir, une attention à la fois.' },
      { h: 'Former votre équipe sur les nouveautés : la méthode simple.', f: 'photo', core: 'Cinq minutes par nouveauté, une fiche claire, un référent produit. Une équipe qui connaît ses gammes vend mieux et conseille juste.' }
    ],
    coulisses: [
      { h: 'Dans les coulisses de notre plateforme logistique.', f: 'video', core: 'Chaque jour, des milliers de références transitent pour rejoindre vos officines. Visite guidée de ce qui se passe avant votre livraison.' },
      { h: 'De la commande à votre comptoir : le parcours d’un colis.', f: 'carrousel', core: 'Réception, préparation, contrôle, expédition. Derrière un délai tenu, il y a une chaîne millimétrée. On vous montre les étapes.' },
      { h: 'Chaîne du froid : comment on protège vos produits sensibles.', f: 'texte', core: 'Températures maîtrisées de bout en bout : c’est la condition d’un produit sûr. Un savoir-faire discret mais essentiel.' },
      { h: 'L’équipe qui prépare vos commandes chaque matin.', f: 'photo', core: 'Derrière chaque livraison, des femmes et des hommes engagés. Coup de projecteur sur ceux qui font tourner la logistique.' },
      { h: 'Pourquoi la proximité change tout dans la répartition.', f: 'texte', core: 'Être proche, c’est livrer vite et bien connaître les besoins du terrain. La proximité n’est pas un slogan, c’est un service.' },
      { h: 'Nos engagements qualité, au quotidien.', f: 'carrousel', core: 'Traçabilité, contrôles, rigueur : la qualité se joue sur les détails, tous les jours. Voici comment on la garantit.' },
      { h: 'Une journée type sur notre plateforme.', f: 'video', core: 'Du premier colis préparé à la dernière expédition : 24 heures dans les coulisses de votre partenaire répartiteur.' },
      { h: 'La technologie qui fiabilise vos livraisons.', f: 'photo', core: 'Préparation assistée, contrôle qualité, suivi : les outils au service d’un objectif simple, la bonne commande au bon moment.' }
    ],
    recrutement: [
      { h: 'On recrute : rejoignez l’aventure Intégral Pharma.', f: 'photo', core: 'On grandit, et on cherche des personnes qui aiment le terrain, le concret et l’esprit d’équipe. Et si c’était vous ?' },
      { h: 'Préparateur, magasinier, commercial : nos métiers qui recrutent.', f: 'carrousel', core: 'Plusieurs postes, une même exigence : le service. Découvrez les métiers qui font la répartition et rejoignez-nous.' },
      { h: 'Pourquoi on aime travailler ici.', f: 'video', core: 'Des équipes soudées, un vrai sens du service, et la fierté d’aider les officines au quotidien. Nos collègues en parlent mieux que nous.' },
      { h: 'Portrait : rencontrez un membre de notre équipe.', f: 'photo', core: 'Chaque parcours compte. On vous présente celles et ceux qui font Intégral Pharma, dans leurs mots.' },
      { h: 'Nos valeurs, ce qui nous fait avancer ensemble.', f: 'carrousel', core: 'Proximité, engagement, fiabilité. Ce ne sont pas que des mots : c’est ce qu’on met en pratique chaque jour, ensemble.' },
      { h: 'Vous connaissez la bonne personne ? La cooptation est ouverte.', f: 'texte', core: 'Les meilleures rencontres viennent souvent d’une recommandation. Partagez nos offres autour de vous, on s’occupe du reste.' },
      { h: 'Ce qu’on offre au-delà du poste.', f: 'texte', core: 'Un métier de terrain qui a du sens, une équipe qui se serre les coudes, et la satisfaction d’être utile aux pharmacies. Ça compte.' },
      { h: 'Nos alternants racontent leur quotidien.', f: 'video', core: 'Se former en travaillant sur le concret : nos alternants partagent ce qu’ils apprennent et pourquoi ils ont choisi la répartition.' }
    ],
    tempsfort: [
      { h: 'Nous étions présents auprès de la profession.', f: 'photo', core: 'Rencontrer les pharmaciens, écouter le terrain, partager nos engagements : les temps forts du métier sont des moments qui comptent.' },
      { h: 'Une info utile pour votre officine cette semaine.', f: 'texte', core: 'On relaie l’essentiel de l’actualité qui touche votre quotidien, pour vous faire gagner du temps et de la visibilité.' },
      { h: 'Bilan et perspectives : merci à nos partenaires.', f: 'carrousel', core: 'Un cap franchi, c’est d’abord une aventure collective. Merci aux équipes et aux officines qui nous font confiance.' },
      { h: 'L’actualité qui change la donne en officine.', f: 'texte', core: 'Le métier bouge. On décrypte ce qui compte vraiment pour vous, sans bruit inutile.' }
    ]
  };

  // ── Angles saisonniers (temps forts pharma) par mois (0=janv … 11=déc) ──
  var SEASON = {
    0: [ { h: 'Nouvelle année : cap sur la prévention et les bonnes résolutions.', f: 'carrousel', core: 'Arrêt du tabac, sommeil, vitalité : janvier est le mois des bonnes résolutions. L’occasion de mettre en avant les gammes qui accompagnent vos patients.' },
         { h: 'Immunité d’hiver : on soutient vos rayons au bon moment.', f: 'texte', core: 'Le froid s’installe, les défenses baissent. Vitamine D, probiotiques, ORL : anticipez la demande pour ne pas être pris de court.' } ],
    1: [ { h: 'Pic hivernal : disponibilité maximale sur les indispensables.', f: 'texte', core: 'Rhume, gorge, nez qui coule : février met la pression sur les rayons. On veille à la disponibilité pour que vous ne manquiez de rien.' },
         { h: 'Peaux sèches, mains abîmées : le rayon soin à ne pas négliger.', f: 'photo', core: 'Le froid agresse la peau. Baumes, cold creams, soins réparateurs : un temps fort simple à mettre en avant en vitrine.' } ],
    2: [ { h: 'Le printemps arrive : préparez la saison des allergies.', f: 'carrousel', core: 'Les premiers pollens approchent. Anticipez vos rayons antihistaminiques et solutions locales avant le pic de demande.' },
         { h: 'Reprise du sport : accompagnez vos patients actifs.', f: 'texte', core: 'Beaux jours = retour à l’activité. Compléments, récupération, protection : un univers à valoriser dès mars.' } ],
    3: [ { h: 'Allergies aux pollens : soyez prêts avant vos patients.', f: 'carrousel', core: 'Avril, pleine saison pollinique. Une mise en avant claire aide vos patients à trouver la bonne réponse, vite.' },
         { h: 'Envie de renouveau : le rayon détox et vitalité.', f: 'photo', core: 'Le printemps donne envie de repartir du bon pied. Un temps fort vitalité qui parle à tout le monde.' } ],
    4: [ { h: 'Préparez la peau au soleil, dès maintenant.', f: 'carrousel', core: 'Avant les vacances, la demande solaire démarre. Anticiper le rayon, c’est capter la saison au bon moment.' },
         { h: 'Allergies : le pic se poursuit, restons disponibles.', f: 'texte', core: 'La saison pollinique bat son plein. On maintient la disponibilité sur les indispensables pour tenir la demande.' } ],
    5: [ { h: 'Solaire, moustiques, bien-être : l’été s’installe dans vos rayons.', f: 'carrousel', core: 'Protection solaire, anti-moustiques, hydratation : juin lance la saison estivale. Un temps fort à ne pas rater.' },
         { h: 'Trousse de vacances : le réflexe conseil de la saison.', f: 'photo', core: 'Vos patients partent : proposez la trousse essentielle. Un conseil utile qui fait aussi la vente additionnelle.' } ],
    6: [ { h: 'Plein été : disponibilité solaire et petits soins du quotidien.', f: 'texte', core: 'Juillet, la demande solaire culmine. On assure la disponibilité pour que vos rayons ne se vident pas au pire moment.' },
         { h: 'Voyages : les indispensables à mettre en avant.', f: 'carrousel', core: 'Mal des transports, digestion, protection : l’été voyage. Un univers pratique à valoriser en vitrine.' } ],
    7: [ { h: 'Août : anticipez déjà la rentrée de vos rayons.', f: 'texte', core: 'Pendant que l’été continue, la rentrée se prépare. Immunité, sommeil, retour au calme : prenez de l’avance sur septembre.' },
         { h: 'Solaire : la saison n’est pas finie.', f: 'photo', core: 'Le soleil tape encore. Maintenir la mise en avant solaire en août, c’est prolonger un temps fort rentable.' } ],
    8: [ { h: 'Rentrée : on est prêts, et vous ?', f: 'carrousel', core: 'Immunité, poux, fatigue, reprise : septembre concentre les besoins. Un rétroplanning de rayons pour aborder la rentrée sereinement.' },
         { h: 'Immunité de rentrée : anticipez la demande.', f: 'texte', core: 'La reprise fragilise les défenses. Vitamines, probiotiques, ORL : préparez vos rayons avant le premier coup de froid.' } ],
    9: [ { h: 'Octobre Rose : on se mobilise à vos côtés.', f: 'photo', core: 'La prévention est l’affaire de tous. Un temps fort de sensibilisation qui a du sens, en officine comme en ligne.' },
         { h: 'Vaccination et immunité : le rayon de la saison.', f: 'carrousel', core: 'L’automne relance la demande ORL et immunité. Une mise en avant claire guide vos patients au bon moment.' } ],
    10: [ { h: 'Movember : parlons santé masculine.', f: 'photo', core: 'Novembre met la santé des hommes en lumière. Un sujet trop souvent tu, une belle occasion de conseil et de prévention.' },
          { h: 'Froid et rhumes : disponibilité sur les indispensables.', f: 'texte', core: 'Le pic hivernal approche. On assure la disponibilité pour que vos rayons ORL tiennent la cadence.' } ],
    11: [ { h: 'Fêtes de fin d’année : coffrets et idées cadeaux bien-être.', f: 'carrousel', core: 'Décembre, saison des cadeaux. Dermocosmétique, coffrets, bien-être : un temps fort à forte valeur pour vos rayons.' },
          { h: 'Hiver et immunité : on termine l’année en soutien.', f: 'texte', core: 'Froid, fatigue, excès des fêtes : accompagnez vos patients avec les bonnes gammes. On veille à la disponibilité.' } ]
  };

  // ── Rédaction (CTA + hashtags par ton / pilier) ──
  var CTA = {
    expert: { def: 'Échangeons — votre équipe Intégral Pharma reste à votre disposition.', rec: 'Intéressé·e, ou vous connaissez la bonne personne ? Contactez-nous.' },
    proche: { def: 'Une question, une envie d’en discuter ? Écrivez-nous 👇', rec: 'Envie de nous rejoindre ? Parlons-en 👇' },
    punchy: { def: 'On en parle ? 👇', rec: 'Ça vous tente ? Postulez 👇' }
  };
  var HASH = {
    produit: '#Parapharmacie #Officine #Offilog',
    conseil: '#Officine #ConseilOfficine #Pharmacie',
    coulisses: '#Logistique #Répartition #Coulisses',
    recrutement: '#Recrutement #Emploi #TeamIntégral',
    tempsfort: '#Pharmacie #Officine #Santé'
  };
  function compose(angle, tone, pk) {
    var cta = (pk === 'recrutement') ? CTA[tone].rec : CTA[tone].def;
    return angle.h + '\n\n' + angle.core + '\n\n' + cta + '\n\n' + (HASH[pk] || HASH.tempsfort) + ' #IntégralPharma';
  }

  // ── Moteur ──
  function poolFor(slot) { return slot.seasonal ? SEASON[slot.mo] : (ANGLES[slot.pillar] || ANGLES.tempsfort); }
  function anglesOf(slot) {
    var pool = poolFor(slot), o = slot.offset % pool.length, out = [];
    for (var i = 0; i < Math.min(3, pool.length); i++) out.push(pool[(o + i) % pool.length]);
    return out;
  }
  function mondayOf(d) {
    var x = new Date(d); var day = x.getDay(); var diff = (day === 0 ? -6 : 1 - day);
    x.setDate(x.getDate() + diff); x.setHours(9, 0, 0, 0); return x;
  }
  function nextMonday() { var t = new Date(); t.setDate(t.getDate() + 1); return mondayOf(t); }
  function weightedPick(cands, w) {
    var tot = 0, i; for (i = 0; i < cands.length; i++) tot += (w[cands[i]] || 1);
    var r = Math.random() * tot;
    for (i = 0; i < cands.length; i++) { r -= (w[cands[i]] || 1); if (r <= 0) return cands[i]; }
    return cands[cands.length - 1];
  }
  function dominantPillar(objKey) {
    var w = objOf(objKey).w, best = null, bv = -1;
    for (var k in w) if (w.hasOwnProperty(k) && w[k] > bv) { bv = w[k]; best = k; }
    return best;
  }
  function pillarSequence(cfg) {
    var n = cfg.cadence * cfg.horizon;
    var w = {}; var ow = objOf(cfg.objective).w;
    PILL().forEach(function (p) { w[p.k] = ow[p.k] || 1; });
    cfg.themes.forEach(function (k) { w[k] = (w[k] || 1) + 3; });
    var allowed = cfg.themes.length ? cfg.themes.slice() : PILL().map(function (p) { return p.k; });
    // l'objectif s'exprime toujours : son pilier dominant est garanti et mis en avant
    var dom = dominantPillar(cfg.objective);
    if (dom) { if (allowed.indexOf(dom) === -1) allowed.push(dom); w[dom] = (w[dom] || 1) + 3; }
    var seq = [], last = null, i;
    for (i = 0; i < n; i++) {
      var cand = allowed.filter(function (k) { return k !== last; });
      if (!cand.length) cand = allowed.slice();
      var pk = weightedPick(cand, w); seq.push(pk); last = pk;
    }
    // couverture : chaque thème choisi apparaît au moins une fois
    if (n >= allowed.length) {
      allowed.forEach(function (k) {
        if (seq.indexOf(k) === -1) {
          for (var j = 0; j < seq.length; j++) {
            var prev = seq[j - 1], nx = seq[j + 1];
            if (seq[j] !== k && prev !== k && nx !== k) { seq[j] = k; break; }
          }
        }
      });
    }
    return seq;
  }
  function buildPlan(cfg) {
    var dayMap = { 1: [2], 2: [2, 4], 3: [1, 3, 5] };  // jours (lun=1 … ven=5)
    var days = dayMap[cfg.cadence] || [2, 4];
    var start = cfg.start ? mondayOf(cfg.start) : nextMonday();
    var seq = pillarSequence(cfg);
    var seasonOff = {};   // offset saisonnier par mois
    var pillOff = {};     // offset par pilier
    var plan = [], i = 0, w, d;
    for (w = 0; w < cfg.horizon; w++) {
      for (d = 0; d < days.length; d++) {
        var date = new Date(start);
        date.setDate(start.getDate() + w * 7 + (days[d] - 1)); date.setHours(9, 0, 0, 0);
        var pk = seq[i++]; var mo = date.getMonth();
        var seasonal = (pk === 'tempsfort' && SEASON[mo] && SEASON[mo].length);
        var offset;
        if (seasonal) { offset = (seasonOff[mo] || 0); seasonOff[mo] = offset + 1; }
        else { offset = (pillOff[pk] || 0); pillOff[pk] = offset + 1; }
        plan.push({ date: date, pillar: pk, seasonal: seasonal, mo: mo, offset: offset, sel: 0 });
      }
    }
    return plan;
  }

  // ── État ──
  var isOpen = false, step = 'quiz', plan = [];
  var cfg = { objective: 'notoriete', cadence: 2, horizon: 4, tone: 'expert', themes: ['produit', 'conseil', 'coulisses'], start: null };
  var stratId = '';

  // ── CSS (injecté une fois, thème sombre cohérent avec la vue LinkedIn) ──
  var cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    var css = [
      '#lis-root{position:fixed;inset:0;z-index:9000;background:#070c18;color:#e8eeff;overflow:auto;font-family:inherit;-webkit-overflow-scrolling:touch}',
      '.lis-wrap{max-width:920px;margin:0 auto;padding:22px 18px 80px}',
      '.lis-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}',
      '.lis-title{font-size:22px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:9px}',
      '.lis-title .g{background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-text-fill-color:#a78bfa;color:#a78bfa}',
      '.lis-sub{color:#93a1c4;font-size:13.5px;margin:2px 0 20px}',
      '.lis-x{background:#0e1730;color:#e8eeff;border:1px solid rgba(255,255,255,.14);border-radius:10px;width:38px;height:38px;font-size:17px;cursor:pointer;flex-shrink:0}',
      '.lis-q{margin-bottom:20px}',
      '.lis-ql{font-weight:700;font-size:14px;margin-bottom:9px;color:#cdd8f2}',
      '.lis-opts{display:flex;flex-wrap:wrap;gap:9px}',
      '.lis-opt{background:#0e1730;color:#c9d5f0;border:1.5px solid rgba(255,255,255,.10);border-radius:12px;padding:11px 15px;cursor:pointer;font:600 13.5px/1.2 inherit;transition:border-color .15s,background .15s}',
      '.lis-opt small{display:block;font-weight:500;color:#8493b8;margin-top:3px;font-size:11.5px}',
      '.lis-opt:hover{border-color:rgba(139,92,246,.5)}',
      '.lis-opt.on{border-color:#8B5CF6;background:linear-gradient(135deg,rgba(139,92,246,.22),rgba(0,87,255,.14));color:#fff}',
      '.lis-date{background:#0e1730;color:#e8eeff;border:1.5px solid rgba(255,255,255,.10);border-radius:12px;padding:10px 14px;font:600 13.5px/1 inherit}',
      '.lis-cta{position:sticky;bottom:0;left:0;right:0;margin-top:24px;padding:16px 0 6px;background:linear-gradient(to top,#070c18 70%,transparent);display:flex;gap:10px;flex-wrap:wrap}',
      '.lis-btn{border:1px solid rgba(255,255,255,.14);background:#0e1730;color:#e8eeff;border-radius:12px;padding:13px 20px;font:700 14px/1 inherit;cursor:pointer}',
      '.lis-btn-p{background:linear-gradient(135deg,#8B5CF6,#0057FF);border-color:transparent;color:#fff}',
      '.lis-btn-p:hover{filter:brightness(1.08)}',
      '.lis-recap{background:#0e1730;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;margin-bottom:18px;font-size:13.5px;color:#c9d5f0;display:flex;flex-wrap:wrap;gap:8px 18px}',
      '.lis-recap b{color:#fff}',
      '.lis-card{background:#0e1730;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;margin-bottom:12px;border-left:4px solid var(--pc,#8B5CF6)}',
      '.lis-crow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}',
      '.lis-date2{font-weight:800;font-size:13px;color:#fff}',
      '.lis-tag{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.08);color:#c9d5f0}',
      '.lis-tag.pil{background:var(--pcb,rgba(139,92,246,.2));color:#fff}',
      '.lis-hook{font-weight:700;font-size:15px;color:#fff;margin:4px 0 6px;line-height:1.35}',
      '.lis-core{font-size:13px;color:#aeb9d6;line-height:1.5;margin-bottom:10px}',
      '.lis-abc{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '.lis-ab{width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:#0a1226;color:#c9d5f0;font:700 12px/1 inherit;cursor:pointer}',
      '.lis-ab.on{background:#8B5CF6;border-color:#8B5CF6;color:#fff}',
      '.lis-mini{background:transparent;border:1px solid rgba(255,255,255,.14);color:#93a1c4;border-radius:8px;padding:6px 10px;font:600 12px/1 inherit;cursor:pointer;margin-left:auto}',
      '.lis-mini:hover{color:#fff;border-color:rgba(255,255,255,.3)}',
      '.lis-del{color:#ff8098}',
      '@media (max-width:560px){.lis-wrap{padding:16px 12px 80px}.lis-title{font-size:19px}}',
      '@media (prefers-reduced-motion:reduce){#lis-root *{transition:none!important}}'
    ].join('');
    var s = document.createElement('style'); s.id = 'lis-css'; s.textContent = css; document.head.appendChild(s);
  }
  function host() {
    var el = document.getElementById('lis-root');
    if (!el) { el = document.createElement('div'); el.id = 'lis-root'; document.body.appendChild(el); }
    return el;
  }

  // ── Rendu ──
  function seg(field, list, curr, withSub) {
    return '<div class="lis-opts">' + list.map(function (o) {
      var on = (curr === o.k) ? ' on' : '';
      return '<button class="lis-opt' + on + '" onclick="V2.lis.pick(\'' + field + '\',\'' + o.k + '\')">' + esc(o.label) +
        (withSub && o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function segNum(field, list, curr, suffix) {
    return '<div class="lis-opts">' + list.map(function (n) {
      var on = (curr === n) ? ' on' : '';
      return '<button class="lis-opt' + on + '" onclick="V2.lis.pick(\'' + field + '\',' + n + ')">' + n + (suffix || '') + '</button>';
    }).join('') + '</div>';
  }
  function quizHtml() {
    var themeOpts = '<div class="lis-opts">' + PILL().map(function (p) {
      var on = (cfg.themes.indexOf(p.k) !== -1) ? ' on' : '';
      return '<button class="lis-opt' + on + '" onclick="V2.lis.theme(\'' + p.k + '\')">' + esc(p.label) + '</button>';
    }).join('') + '</div>';
    return '<div class="lis-wrap">' +
      '<div class="lis-top"><div class="lis-title"><span class="g">✨</span> Assistant stratégie</div>' +
      '<button class="lis-x" onclick="V2.lis.close()">✕</button></div>' +
      '<div class="lis-sub">Réponds à ces quelques questions : je te génère un plan de posts daté, équilibré et prêt à suivre.</div>' +
      '<div class="lis-q"><div class="lis-ql">🎯 Ton objectif principal</div>' + seg('objective', OBJECTIVES, cfg.objective, true) + '</div>' +
      '<div class="lis-q"><div class="lis-ql">📅 Cadence de publication</div>' + segNum('cadence', CADENCES, cfg.cadence, ' / sem.') + '</div>' +
      '<div class="lis-q"><div class="lis-ql">🗓️ Sur combien de semaines</div>' + segNum('horizon', HORIZONS, cfg.horizon, ' sem.') + '</div>' +
      '<div class="lis-q"><div class="lis-ql">🗣️ Ton dominant</div>' + seg('tone', TONES, cfg.tone, false) + '</div>' +
      '<div class="lis-q"><div class="lis-ql">🧩 Thèmes à privilégier <small style="font-weight:500;color:#8493b8">(plusieurs possibles)</small></div>' + themeOpts + '</div>' +
      '<div class="lis-q"><div class="lis-ql">▶️ Démarrer le</div>' +
        '<input type="date" class="lis-date" value="' + startVal() + '" onchange="V2.lis.pick(\'start\',this.value)"> ' +
        '<span style="color:#8493b8;font-size:12.5px">par défaut : lundi prochain</span></div>' +
      '<div class="lis-cta"><button class="lis-btn-p lis-btn" onclick="V2.lis.gen()">✨ Générer mon plan (' + (cfg.cadence * cfg.horizon) + ' posts)</button></div>' +
      '</div>';
  }
  function startVal() {
    var d = cfg.start ? new Date(cfg.start) : nextMonday();
    var m = ('0' + (d.getMonth() + 1)).slice(-2), day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }
  var DOW = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  var MON = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  function fmtDate(d) { return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
  function previewHtml() {
    var o = objOf(cfg.objective);
    var recap = '<div class="lis-recap">' +
      '<span><b>' + plan.length + '</b> posts</span>' +
      '<span><b>' + cfg.horizon + '</b> semaines · <b>' + cfg.cadence + '</b>/sem.</span>' +
      '<span>Objectif : <b>' + esc(o.label) + '</b></span>' +
      '<span>Ton : <b>' + esc((TONES.filter(function (t) { return t.k === cfg.tone; })[0] || TONES[0]).label) + '</b></span>' +
      '</div>';
    var cards = plan.map(function (s, idx) {
      var pm = pillMeta(s.pillar); var angs = anglesOf(s); var a = angs[s.sel] || angs[0];
      var abc = angs.map(function (x, j) {
        return '<button class="lis-ab' + (j === s.sel ? ' on' : '') + '" title="Angle ' + 'ABC'.charAt(j) + '" onclick="V2.lis.sel(' + idx + ',' + j + ')">' + 'ABC'.charAt(j) + '</button>';
      }).join('');
      return '<div class="lis-card" style="--pc:' + pm.color + '">' +
        '<div class="lis-crow">' +
          '<span class="lis-date2">' + fmtDate(s.date) + '</span>' +
          '<span class="lis-tag pil" style="--pcb:' + pm.color + '33">' + esc(s.seasonal ? 'Temps fort' : pm.label) + '</span>' +
          '<span class="lis-tag">' + esc(FMT[a.f] || 'Texte') + '</span>' +
          '<button class="lis-mini lis-del" onclick="V2.lis.remove(' + idx + ')">Supprimer</button>' +
        '</div>' +
        '<div class="lis-hook">' + esc(a.h) + '</div>' +
        '<div class="lis-core">' + esc(a.core) + '</div>' +
        '<div class="lis-abc">' + abc + '<button class="lis-mini" onclick="V2.lis.other(' + idx + ')">↻ Autre idée</button></div>' +
      '</div>';
    }).join('');
    return '<div class="lis-wrap">' +
      '<div class="lis-top"><div class="lis-title"><span class="g">✨</span> Ton plan éditorial</div>' +
      '<button class="lis-x" onclick="V2.lis.close()">✕</button></div>' +
      '<div class="lis-sub">Ajuste chaque post (angle A/B/C, autre idée, supprimer), puis ajoute tout au calendrier.</div>' +
      recap + (cards || '<div class="lis-sub">Aucun post — reviens au quiz.</div>') +
      '<div class="lis-cta">' +
        '<button class="lis-btn" onclick="V2.lis.back()">‹ Modifier le quiz</button>' +
        '<button class="lis-btn" onclick="V2.lis.regen()">↻ Régénérer tout</button>' +
        '<button class="lis-btn-p lis-btn" onclick="V2.lis.add()">＋ Ajouter au calendrier (' + plan.length + ')</button>' +
      '</div></div>';
  }
  function draw() {
    injectCss();
    var el = host();
    if (!isOpen) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = 'block';
    el.innerHTML = (step === 'quiz') ? quizHtml() : previewHtml();
    el.scrollTop = 0;
  }

  // ── Handlers ──
  V2.lis = V2.lis || {};
  V2.lis.open = function () { if (!LI()) { alert('Le module LinkedIn n’est pas chargé.'); return; } isOpen = true; step = 'quiz'; draw(); };
  V2.lis.close = function () { isOpen = false; draw(); };
  V2.lis.pick = function (field, val) { cfg[field] = val; if (field !== 'start') draw(); };
  V2.lis.theme = function (k) {
    var i = cfg.themes.indexOf(k);
    if (i === -1) cfg.themes.push(k); else if (cfg.themes.length > 1) cfg.themes.splice(i, 1);
    draw();
  };
  V2.lis.gen = function () { plan = buildPlan(cfg); stratId = (LI().newId ? LI().newId() : 'strat' + (new Date()).getTime()); step = 'preview'; draw(); };
  V2.lis.sel = function (idx, j) { if (plan[idx]) { plan[idx].sel = j; draw(); } };
  V2.lis.other = function (idx) { if (plan[idx]) { plan[idx].offset += 3; plan[idx].sel = 0; draw(); } };
  V2.lis.remove = function (idx) { plan.splice(idx, 1); draw(); };
  V2.lis.regen = function () {
    // relance en variant les offsets (aléatoire navigateur)
    var so = {}, po = {};
    plan.forEach(function (s) {
      if (s.seasonal) { if (so[s.mo] == null) so[s.mo] = Math.floor(Math.random() * 3); s.offset = so[s.mo]++; }
      else { if (po[s.pillar] == null) po[s.pillar] = Math.floor(Math.random() * 3); s.offset = po[s.pillar]++; }
      s.sel = 0;
    });
    draw();
  };
  V2.lis.add = function () {
    if (!plan.length || !LI()) return;
    var o = objOf(cfg.objective);
    var name = 'Stratégie ' + o.label + ' — ' + fmtDate(plan[0].date);
    var rows = plan.map(function (s) {
      var angs = anglesOf(s); var a = angs[s.sel] || angs[0];
      return {
        date: s.date.toISOString(), status: 'idee', pillar: (s.seasonal ? 'tempsfort' : s.pillar),
        title: a.h, body: compose(a, cfg.tone, s.seasonal ? 'tempsfort' : s.pillar), format: a.f,
        source: 'strategie', event_id: stratId, event_name: name, image_path: '', linkedin_url: ''
      };
    });
    var first = plan[0].date;
    // enregistrement séquentiel (repli localStorage ou Supabase)
    var chain = Promise.resolve();
    rows.forEach(function (r) { chain = chain.then(function () { return LI().savePost(r); }); });
    chain.then(function () {
      isOpen = false; draw();
      if (LI().goCal) LI().goCal(first);
      try { toast(rows.length + ' posts ajoutés au calendrier ✨'); } catch (e) {}
    });
  };

  function toast(msg) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9999;background:linear-gradient(135deg,#8B5CF6,#0057FF);color:#fff;padding:12px 20px;border-radius:12px;font:700 14px/1 sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)';
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }

  V2.liStrategy = { open: function () { V2.lis.open(); }, _cfg: function () { return cfg; }, _plan: function () { return plan; }, _build: buildPlan };
})();

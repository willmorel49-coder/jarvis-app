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
    { k: 'causes', label: 'Grandes causes', color: '#FF4D6D' },
    { k: 'joie', label: 'Joie & bonne humeur', color: '#FFB020' },
    { k: 'pharma', label: 'Merci aux pharmaciens', color: '#0057FF' },
    { k: 'patients', label: 'Aux côtés des patients', color: '#00B37A' }
  ]; }
  function pillMeta(k) { var a = PILL(); for (var i = 0; i < a.length; i++) if (a[i].k === k) return a[i]; return a[0]; }

  // ── Options du quiz (assistant simplifié : pas d'objectif commercial) ──
  var TONES = [
    { k: 'expert', label: 'Expert & factuel' },
    { k: 'proche', label: 'Proche & humain' },
    { k: 'punchy', label: 'Punchy & moderne' }
  ];
  var CADENCES = [1, 2, 3];
  var HORIZONS = [4, 8, 12];
  var FMT = { carrousel: 'Carrousel', video: 'Vidéo', photo: 'Photo', texte: 'Texte' };

  // ── Banque d’angles (le cœur) — soutien & joie, jamais d’auto-promo ni de prise de parti ──
  var ANGLES = {
    causes: [
      { h: 'Octobre Rose : ensemble contre le cancer du sein.', f: 'photo', core: 'Ce mois-ci, on porte le ruban rose. Sensibiliser, encourager le dépistage, soutenir celles et ceux qui luttent : chacun peut agir à son échelle.' },
      { h: 'Movember : et si on parlait de la santé des hommes ?', f: 'photo', core: 'Un sujet trop souvent passé sous silence. En novembre, on ose en parler, avec bienveillance, pour encourager la prévention.' },
      { h: 'Journée mondiale du diabète : informer, c’est déjà agir.', f: 'carrousel', core: 'Mieux connaître, mieux prévenir. Quelques repères simples pour comprendre et accompagner, sans dramatiser.' },
      { h: 'Don du sang : un geste simple qui sauve des vies.', f: 'texte', core: 'Quelques minutes de son temps, un impact immense. On soutient toutes celles et ceux qui se mobilisent.' },
      { h: 'Semaine de la vaccination : la prévention nous concerne tous.', f: 'carrousel', core: 'S’informer sereinement, en parler avec son pharmacien : la prévention avance quand on la partage.' },
      { h: 'Journée mondiale de la santé mentale : prendre soin de soi compte aussi.', f: 'texte', core: 'La santé, c’est aussi celle qu’on ne voit pas. Un mot d’attention, une écoute : ça change tout.' },
      { h: 'Téléthon : petits gestes, grande solidarité.', f: 'photo', core: 'Quand chacun apporte sa pierre, on soulève des montagnes. Bravo à toutes les mobilisations partout en France.' },
      { h: 'Journée sans tabac : encourager, jamais juger.', f: 'texte', core: 'Chaque pas compte. On soutient celles et ceux qui essaient, avec bienveillance et sans leçon.' },
      { h: 'Journée mondiale du cœur : prenons soin du nôtre.', f: 'carrousel', core: 'Bouger, souffler, s’écouter : quelques réflexes simples pour chouchouter notre cœur, à tout âge.' },
      { h: 'Semaine bleue : célébrons nos aînés.', f: 'photo', core: 'Un immense merci à celles et ceux qui accompagnent nos aînés au quotidien. Le lien, c’est aussi de la santé.' },
      { h: 'Journée mondiale de l’AVC : reconnaître, réagir, sauver.', f: 'carrousel', core: 'Les bons réflexes peuvent tout changer. Informer sans effrayer, c’est déjà protéger.' },
      { h: 'Journée mondiale de l’hygiène des mains : un geste qui protège.', f: 'texte', core: 'Un geste tout simple, un impact réel sur la santé de tous. Un petit rappel bienveillant.' },
      { h: 'Semaine de la vue : prendre soin de ses yeux.', f: 'photo', core: 'On y pense rarement, et pourtant. Un rappel doux pour ne pas oublier ce sens si précieux.' },
      { h: 'Journée mondiale de lutte contre le sida : informer et soutenir.', f: 'texte', core: 'Sans tabou et sans jugement, on rappelle l’importance de l’information et de la solidarité.' },
      { h: 'Semaine de la vaccination : posez toutes vos questions.', f: 'texte', core: 'Aucune question n’est bête. Votre pharmacien est là pour vous informer, en toute sérénité.' }
    ],
    joie: [
      { h: 'Un petit sourire pour bien commencer la semaine.', f: 'photo', core: 'Parce qu’une bonne journée commence souvent par un bon état d’esprit. Belle semaine à toutes les officines !' },
      { h: 'La bonne nouvelle santé de la semaine.', f: 'texte', core: 'Un peu de positif, ça fait du bien. On partage une nouvelle qui donne le sourire et redonne de l’énergie.' },
      { h: 'Merci pour tout ce que vous faites, ça compte énormément.', f: 'photo', core: 'Un simple merci, mais du fond du cœur, à toutes celles et ceux qui prennent soin des autres au quotidien.' },
      { h: 'Une citation qui fait du bien aujourd’hui.', f: 'photo', core: 'Prendre soin des autres, c’est déjà prendre soin du monde. Un petit rappel pour illuminer la journée.' },
      { h: 'Célébrons les petites victoires du quotidien.', f: 'texte', core: 'Un patient soulagé, un sourire échangé, une équipe soudée : ce sont ces moments qui donnent du sens.' },
      { h: 'Un grand bravo à toutes les équipes sur le terrain.', f: 'photo', core: 'Vous êtes présents, jour après jour, avec le sourire. Aujourd’hui, on prend le temps de vous applaudir.' },
      { h: 'La photo qui donne le sourire cette semaine.', f: 'photo', core: 'Un moment de complicité, un instant de joie partagée : la santé, c’est aussi de l’humain et de la bonne humeur.' },
      { h: 'Un peu de douceur dans un monde qui va vite.', f: 'texte', core: 'On ralentit une seconde, on respire, on savoure. Prendre soin de soi commence par de petites attentions.' },
      { h: 'Vendredi, c’est permis : une petite dose de bonne humeur.', f: 'photo', core: 'La semaine se termine, place au sourire. Un bon week-end à toutes les équipes d’officine !' },
      { h: 'Le mot gentil du jour.', f: 'texte', core: 'Un compliment sincère ne coûte rien et peut illuminer une journée. À qui allez-vous l’offrir aujourd’hui ?' },
      { h: 'On adore cette initiative qui fait chaud au cœur.', f: 'photo', core: 'Il existe partout de belles idées qui font du bien. On aime les mettre en lumière et les partager.' },
      { h: 'Petit rappel : vous faites un travail formidable.', f: 'photo', core: 'Dans les journées chargées, on l’oublie parfois. Alors on le redit : bravo, et merci pour tout.' },
      { h: 'La minute feel-good de la semaine.', f: 'texte', core: 'Une pause positive au milieu de la routine. Respirez, souriez : ça fait un bien fou.' },
      { h: 'Un merci en image à toutes les équipes.', f: 'photo', core: 'Parce qu’un grand merci se dit aussi avec le cœur. À vous toutes et tous, un immense bravo.' },
      { h: 'Belle journée à toutes et à tous, tout simplement.', f: 'photo', core: 'Pas de grand message aujourd’hui, juste une pensée positive et sincère pour bien démarrer.' }
    ],
    pharma: [
      { h: 'Merci aux pharmaciens, ces professionnels de proximité.', f: 'photo', core: 'Toujours là, souvent le premier réflexe santé. Aujourd’hui, on met à l’honneur celles et ceux qui veillent sur nous.' },
      { h: 'L’officine, ce lieu où l’on prend vraiment le temps.', f: 'texte', core: 'Écouter, rassurer, orienter : derrière chaque conseil, il y a une attention sincère et une vraie expertise.' },
      { h: 'Derrière chaque conseil, une vraie expertise.', f: 'carrousel', core: 'Des années de formation au service d’un mot juste au bon moment. Bravo aux pharmaciens pour leur professionnalisme.' },
      { h: 'Les pharmaciens, premiers soutiens de votre santé au quotidien.', f: 'photo', core: 'Accessibles, disponibles, humains. On salue ce rôle essentiel, souvent discret mais si précieux.' },
      { h: 'Bravo aux équipes d’officine, présentes en toutes circonstances.', f: 'photo', core: 'Été comme hiver, jours fériés compris, elles répondent présentes. Un immense merci pour cet engagement.' },
      { h: 'Un métier de cœur autant que de compétence.', f: 'texte', core: 'On ne devient pas pharmacien par hasard. Merci de mettre autant d’humanité dans votre expertise.' },
      { h: 'Aux pharmaciens de garde : merci de veiller sur nous.', f: 'photo', core: 'Quand tout est fermé, l’officine de garde reste une lumière rassurante. Merci pour ces nuits au service des autres.' },
      { h: 'Célébrons celles et ceux qui font vivre nos officines.', f: 'carrousel', core: 'Préparateurs, pharmaciens, équipes : chaque maillon compte. Un grand bravo à toute la profession.' },
      { h: 'Le pharmacien, ce héros du quotidien souvent discret.', f: 'photo', core: 'Pas de cape, mais une présence rassurante à chaque coin de rue. Merci pour tout ce que vous faites.' },
      { h: 'Un immense merci pour votre patience et votre écoute.', f: 'photo', core: 'Prendre le temps, expliquer, rassurer : c’est un art. Bravo pour cette bienveillance de chaque instant.' },
      { h: 'L’officine, un repère rassurant dans chaque quartier.', f: 'texte', core: 'Un lieu où l’on se sent accueilli, écouté, compris. Merci d’être ce point d’ancrage pour tant de gens.' },
      { h: 'Bravo pour votre disponibilité, même dans les moments difficiles.', f: 'photo', core: 'Quand tout se complique, vous êtes là. Merci pour ce dévouement sans faille au service des autres.' },
      { h: 'Vous méritez qu’on le dise : merci d’être là.', f: 'photo', core: 'Un merci tout simple, mais du fond du cœur, à toutes les équipes d’officine. Vous êtes essentiels.' },
      { h: 'Le sourire derrière le comptoir change une journée.', f: 'texte', core: 'Un accueil chaleureux, un mot gentil : parfois, c’est ça qui fait toute la différence. Merci pour ça.' },
      { h: 'Aux étudiants et préparateurs : la relève a du cœur.', f: 'photo', core: 'Ils apprennent, s’investissent et prennent soin des autres avec passion. Bravo à toute la relève de l’officine.' }
    ],
    patients: [
      { h: '3 gestes simples pour prendre soin de vous cet hiver.', f: 'carrousel', core: 'Se laver les mains, bien s’aérer, écouter son corps : la prévention tient souvent à de petits réflexes. Parlez-en avec votre pharmacien.' },
      { h: 'Bien s’hydrater : le réflexe santé de la saison.', f: 'texte', core: 'Un verre d’eau régulier, ça change beaucoup de choses. Un rappel tout simple pour prendre soin de soi.' },
      { h: 'Sommeil : et si on en prenait vraiment soin ?', f: 'carrousel', core: 'Mieux dormir, c’est mieux vivre. Quelques repères doux pour retrouver des nuits réparatrices.' },
      { h: 'La prévention, c’est l’affaire de tous.', f: 'texte', core: 'Un dépistage, un vaccin, un conseil : autant de petits pas vers une meilleure santé, pour soi et pour ses proches.' },
      { h: 'Prendre soin de sa santé mentale, jour après jour.', f: 'photo', core: 'Souffler, parler, s’accorder du repos. Prendre soin de sa tête est aussi important que du reste. Vous n’êtes pas seuls.' },
      { h: 'Bien vieillir : quelques réflexes qui changent tout.', f: 'carrousel', core: 'Bouger un peu, garder le lien, suivre ses traitements : bien vieillir, ça se prépare en douceur, avec les bons conseils.' },
      { h: 'Vaccination : parlez-en avec votre pharmacien.', f: 'texte', core: 'Une question, un doute ? Votre pharmacien est là pour vous informer, simplement et sans pression.' },
      { h: 'Écouter son corps, un premier pas vers le bien-être.', f: 'photo', core: 'Fatigue, tension, petits signaux : votre corps vous parle. S’écouter, c’est déjà prendre soin de soi.' },
      { h: 'Bien manger, sans se prendre la tête : quelques repères.', f: 'carrousel', core: 'Pas de régime miracle, juste du bon sens et du plaisir. De petites habitudes qui font du bien, durablement.' },
      { h: 'Bouger un peu chaque jour, c’est déjà beaucoup.', f: 'texte', core: 'Une marche, quelques étirements : le corps adore le mouvement. Nul besoin d’en faire trop pour se sentir mieux.' },
      { h: 'Prendre ses médicaments au bon moment : nos astuces.', f: 'carrousel', core: 'Un pilulier, un rappel sur le téléphone, un rituel : de petites méthodes simples pour ne rien oublier.' },
      { h: 'Le stress, ça se soulage aussi : petits gestes apaisants.', f: 'texte', core: 'Respirer, faire une pause, en parler : quelques réflexes doux pour relâcher la pression au quotidien.' },
      { h: 'Protéger sa peau du soleil, toute l’année.', f: 'texte', core: 'Le soleil ne prévient pas. Un geste protecteur simple pour prendre soin de sa peau, en toute saison.' },
      { h: 'Garder le lien avec ses proches, c’est bon pour la santé.', f: 'photo', core: 'Un appel, une visite, un sourire partagé : le lien social est un vrai soin. Prenez soin les uns des autres.' },
      { h: 'Un doute sur un symptôme ? Votre pharmacien peut vous aider.', f: 'texte', core: 'Avant de s’inquiéter, on peut simplement demander. Votre pharmacien est un premier interlocuteur précieux.' }
    ]
  };

  // ── Angles saisonniers (temps forts pharma) par mois (0=janv … 11=déc) ──
  // Grandes causes & moments fédérateurs par mois (0=janv … 11=déc) — jamais clivant
  var SEASON = {
    0: [ { h: 'Bonne année ! Nos vœux de santé pour tous.', f: 'photo', core: 'Une nouvelle année commence, remplie de bonnes intentions. On vous souhaite santé, énergie et de beaux moments, tout simplement.' },
         { h: 'Bonnes résolutions : et si on prenait soin de soi, en douceur ?', f: 'texte', core: 'Pas de pression, juste de petites attentions au quotidien. Prendre soin de sa santé, c’est le plus beau des projets.' } ],
    1: [ { h: 'Journée mondiale contre le cancer : informer, soutenir, espérer.', f: 'photo', core: 'Le 4 février, on se rappelle que la prévention et la recherche avancent grâce à la mobilisation de tous. Bravo à celles et ceux qui luttent.' },
         { h: 'Un peu de tendresse au cœur de l’hiver.', f: 'photo', core: 'La bienveillance, c’est bon pour la santé. Un mot gentil, un sourire : le meilleur des remèdes se partage.' } ],
    2: [ { h: 'Journée mondiale du sommeil : et si on dormait mieux ?', f: 'carrousel', core: 'Le sommeil, c’est la base d’une bonne santé. Quelques repères doux pour retrouver des nuits paisibles.' },
         { h: 'Journée mondiale de l’eau : un geste simple, un grand bienfait.', f: 'texte', core: 'Bien s’hydrater, c’est prendre soin de soi tous les jours. Un rappel tout simple, mais essentiel.' } ],
    3: [ { h: 'Journée mondiale de la santé : la santé, notre bien le plus précieux.', f: 'photo', core: 'Le 7 avril, on célèbre celles et ceux qui prennent soin de nous. Merci à tous les professionnels de santé.' },
         { h: 'Le printemps, une belle occasion de repartir du bon pied.', f: 'texte', core: 'Un peu de mouvement, de lumière, de douceur : la belle saison invite à prendre soin de soi, tranquillement.' } ],
    4: [ { h: 'Semaine de la vaccination : la prévention nous concerne tous.', f: 'carrousel', core: 'S’informer sereinement, poser ses questions à son pharmacien : la prévention avance quand on en parle ensemble.' },
         { h: 'Fête du travail : merci à celles et ceux qui prennent soin des autres.', f: 'photo', core: 'Le 1er mai, on pense à tous les professionnels de santé, présents au quotidien. Un grand merci pour votre engagement.' } ],
    5: [ { h: 'Journée mondiale du don du sang : un geste qui sauve des vies.', f: 'photo', core: 'Le 14 juin, on salue les donneurs et les bénévoles. Quelques minutes de générosité, un impact immense.' },
         { h: 'Fête de la musique : un peu de joie fait toujours du bien.', f: 'photo', core: 'La musique adoucit et rassemble. Belle fête à toutes et à tous — la bonne humeur, c’est aussi de la santé.' } ],
    6: [ { h: 'Bonne fête nationale à toutes et à tous !', f: 'photo', core: 'Le 14 juillet, on célèbre ce qui nous rassemble. Belle journée, et pensée pour ceux qui veillent, même les jours de fête.' },
         { h: 'L’été, le bon moment pour souffler et se ressourcer.', f: 'texte', core: 'Un peu de repos, du soleil avec modération, de belles retrouvailles : prendre soin de soi passe aussi par la détente.' } ],
    7: [ { h: 'Un été tout en douceur : prenez soin de vous.', f: 'photo', core: 'Chaleur, vacances, moments partagés : on savoure, en restant à l’écoute de son corps. Bel été à toutes et à tous.' },
         { h: 'Pensée pour les équipes qui assurent tout l’été.', f: 'texte', core: 'Pendant que certains se reposent, d’autres veillent. Merci aux officines ouvertes et présentes, même en plein été.' } ],
    8: [ { h: 'Bonne rentrée à toutes et à tous !', f: 'photo', core: 'Nouvelle saison, nouvelle énergie. On vous souhaite une rentrée douce, sereine et pleine de belles choses.' },
         { h: 'Journée mondiale du cœur : prenons soin du nôtre.', f: 'carrousel', core: 'Le 29 septembre, un petit rappel bienveillant : bouger, souffler, s’écouter. Le cœur nous le rendra.' } ],
    9: [ { h: 'Octobre Rose : ensemble contre le cancer du sein.', f: 'photo', core: 'Tout le mois, on porte le ruban rose. Sensibiliser, encourager le dépistage, soutenir : chacun peut agir à son échelle.' },
         { h: 'Journée mondiale de la santé mentale : prendre soin de soi compte aussi.', f: 'texte', core: 'Le 10 octobre, on rappelle que la santé, c’est aussi celle qu’on ne voit pas. Écouter, en parler : ça change tout.' } ],
    10: [ { h: 'Movember : parlons de la santé des hommes.', f: 'photo', core: 'Tout novembre, on ose aborder un sujet trop souvent tu, avec bienveillance, pour encourager la prévention.' },
          { h: 'Journée mondiale du diabète : informer, c’est déjà aider.', f: 'carrousel', core: 'Le 14 novembre, quelques repères simples pour mieux comprendre et accompagner, sans dramatiser.' } ],
    11: [ { h: 'Téléthon : petits gestes, grande solidarité.', f: 'photo', core: 'Début décembre, on salue toutes les mobilisations partout en France. Ensemble, on soulève des montagnes.' },
          { h: 'Belles fêtes de fin d’année à toutes et à tous.', f: 'photo', core: 'Chaleur, partage et bienveillance : on vous souhaite de douces fêtes. Et pensée pour ceux qui veillent sur notre santé.' } ]
  };

  // ── Rédaction (CTA + hashtags par famille) ──
  var CTA = {
    expert: { def: 'Chez Intégral Pharma, nous sommes fiers de soutenir celles et ceux qui prennent soin de la santé.' },
    proche: { def: 'Et vous, comment le vivez-vous ? Partagez en commentaire 👇' },
    punchy: { def: 'Partagez pour faire passer le message 💛' }
  };
  var HASH = {
    causes: '#Santé #Prévention #Solidarité',
    joie: '#BonneHumeur #Sourire #Positif',
    pharma: '#Pharmaciens #Officine #MerciLesPharmaciens',
    patients: '#Santé #Prévention #BienÊtre'
  };
  function compose(angle, tone, pk) {
    var cta = (CTA[tone] || CTA.proche).def;
    return angle.h + '\n\n' + angle.core + '\n\n' + cta + '\n\n' + (HASH[pk] || HASH.causes) + ' #IntégralPharma';
  }

  // ── Moteur de rédaction (post complet, 100% local) ──
  var AMP = {
    causes: ['Se mobiliser pour une cause, c’est rappeler que la santé nous concerne tous.', 'Informer sans juger, encourager sans imposer : c’est notre façon de soutenir.', 'Chaque prise de conscience compte, et chaque petit geste peut faire la différence.'],
    joie: ['Un peu de positivité fait toujours du bien, surtout quand on parle de santé.', 'Célébrer les bons moments, c’est aussi une manière de prendre soin les uns des autres.', 'La bonne humeur, ça se partage — et c’est plutôt contagieux.'],
    pharma: ['Les pharmaciens sont souvent le premier contact santé du quotidien.', 'Écoute, conseil, disponibilité : l’officine, c’est un vrai soutien humain.', 'Derrière le comptoir, il y a des femmes et des hommes engagés, jour après jour.'],
    patients: ['La prévention et le bien-être commencent par de petits gestes simples.', 'Prendre soin de soi, c’est aussi prendre soin de ses proches.', 'Une information claire, au bon moment, peut vraiment aider.']
  };
  var BULLETS = {
    causes: [['S’informer sur la cause', 'En parler autour de soi', 'Soutenir les initiatives près de chez vous'], ['Le dépistage sauve des vies', 'La prévention est l’affaire de tous', 'Chaque geste solidaire compte']],
    joie: [['Un sourire', 'Un merci sincère', 'Une bonne nouvelle à partager'], ['Célébrer les petites victoires', 'Encourager autour de soi', 'Cultiver le positif au quotidien']],
    pharma: [['Un accueil bienveillant', 'Un conseil personnalisé', 'Une présence en toutes circonstances'], ['De l’écoute', 'De l’expertise', 'De la proximité']],
    patients: [['Bien s’hydrater', 'Bien dormir', 'Bouger un peu chaque jour'], ['S’informer auprès de son pharmacien', 'Écouter son corps', 'Ne pas négliger la prévention']]
  };
  var VALUE = {
    causes: ['Chez Intégral Pharma, nous soutenons les causes qui font avancer la santé de tous.', 'Fédérer autour de la santé, sans jamais diviser : c’est notre engagement.'],
    joie: ['Chez Intégral Pharma, on croit qu’un peu de joie fait beaucoup de bien.', 'Répandre du positif, c’est notre petite contribution au quotidien.'],
    pharma: ['Chez Intégral Pharma, nous sommes fiers de soutenir les pharmaciens, chaque jour.', 'Les officines prennent soin de tous — nous avons à cœur de les soutenir.'],
    patients: ['Chez Intégral Pharma, la santé des patients est au cœur de tout ce que nous faisons.', 'Aux côtés des pharmaciens pour mieux accompagner chaque patient.']
  };
  function pickA(arr, v) { if (!arr || !arr.length) return ''; return arr[((v % arr.length) + arr.length) % arr.length]; }
  function toneEmoji(tone, pk) { if (tone !== 'punchy') return ''; return ({ causes: '🎗️', joie: '☀️', pharma: '💙', patients: '🌿' })[pk] || '💛'; }
  function generateFull(o) {
    var tone = o.tone || 'proche', pk = o.pillar || 'causes', v = o.v || 0;
    var hook = o.hook || pickA(AMP[pk], v);
    var core = o.core || pickA(AMP[pk], v);
    var amp = pickA(AMP[pk], v + 1);
    var bset = (BULLETS[pk] && BULLETS[pk].length) ? BULLETS[pk][((v % BULLETS[pk].length) + BULLETS[pk].length) % BULLETS[pk].length] : null;
    var val = pickA(VALUE[pk], v + 1);
    var cta = (CTA[tone] || CTA.proche).def;
    var em = toneEmoji(tone, pk);
    var parts = [];
    parts.push((em ? em + ' ' : '') + hook);
    if (core) parts.push(core);
    if (amp && amp !== core) parts.push(amp);
    if (bset && bset.length) parts.push(bset.map(function (x) { return '• ' + x; }).join('\n'));
    if (val) parts.push(val);
    parts.push(cta);
    parts.push((HASH[pk] || HASH.causes) + ' #IntégralPharma');
    return parts.join('\n\n');
  }

  // ── Rédaction à partir de l'idée de l'utilisateur (un petit texte -> post complet) ──
  function generateFromBrief(brief, pillar, tone, v) {
    brief = String(brief || '').trim();
    if (!brief) return generateFull({ pillar: pillar, tone: tone, v: v });
    var hook = brief.charAt(0).toUpperCase() + brief.slice(1);
    if (!/[.!?…»)]$/.test(hook)) hook += '.';
    return generateFull({ hook: hook, core: '', pillar: pillar, tone: tone, v: v });
  }

  // ── Idées / descriptifs de visuel par pilier ──
  var IMG_IDEAS = {
    causes: [
      'Bandeau aux couleurs de la cause (ruban rose, moustache…), message court et sobre, respectueux.',
      'Visuel de sensibilisation : un chiffre-clé + un appel bienveillant, fond aux couleurs de la marque.',
      'Photo solidaire et lumineuse (mains jointes, équipe mobilisée), ton chaleureux et positif.',
      'Illustration simple et lisible de la journée mondiale concernée, sans dramatiser.'
    ],
    joie: [
      'Visuel positif et coloré avec une citation courte qui fait sourire.',
      'Photo authentique d’un sourire ou d’un moment de complicité, lumière douce.',
      'Carte « belle semaine » aux couleurs de la marque, message chaleureux.',
      'Illustration légère et bienveillante, épurée, sans texte superflu.'
    ],
    pharma: [
      'Portrait chaleureux d’un pharmacien ou d’une équipe d’officine, plan mi-corps, lumière naturelle.',
      'Photo du comptoir d’officine, ambiance humaine et lumineuse.',
      'Carte « merci » aux pharmaciens, sobre et sincère, aux couleurs de la marque.',
      'Gros plan sur un geste de conseil (mains, échange), authentique et positif.'
    ],
    patients: [
      'Carrousel prévention : 1 conseil par slide, clair, rassurant, icônes simples.',
      'Photo lumineuse d’une personne qui prend soin d’elle (eau, marche, sommeil).',
      'Visuel bien-être : 3 gestes illustrés par des icônes douces.',
      'Illustration pédagogique et bienveillante, ton rassurant.'
    ]
  };
  function generateImageIdea(pk, v) { return pickA(IMG_IDEAS[pk] || IMG_IDEAS.causes, v); }

  // ── Moteur ──
  function poolFor(slot) {
    if (slot.seasonal) return (SEASON[slot.mo] || []).concat(ANGLES.causes);  // causes du mois EN PREMIER, puis toute la banque causes
    return ANGLES[slot.pillar] || ANGLES.causes;
  }
  function anglesOf(slot) {
    var pool = poolFor(slot), o = slot.offset % pool.length, out = [];
    for (var i = 0; i < Math.min(2, pool.length); i++) out.push(pool[(o + i) % pool.length]);
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
  function pillarSequence(cfg) {
    var n = cfg.cadence * cfg.horizon;
    // familles à privilégier, à poids égal (pas d'objectif commercial)
    var allowed = (cfg.themes && cfg.themes.length) ? cfg.themes.slice() : PILL().map(function (p) { return p.k; });
    var w = {}; allowed.forEach(function (k) { w[k] = 1; });
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
        var seasonal = (pk === 'causes' && SEASON[mo] && SEASON[mo].length);
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
  var cfg = { cadence: 2, horizon: 4, tone: 'proche', themes: ['causes', 'joie', 'pharma', 'patients'], start: null };
  var stratId = '';

  // ── CSS (injecté une fois, thème sombre cohérent avec la vue LinkedIn) ──
  var cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    var css = [
      '#lis-root{position:fixed;inset:0;z-index:9000;background:#F8FAFC;color:#0A0E1A;overflow:auto;font-family:inherit;-webkit-overflow-scrolling:touch}',
      '.lis-wrap{max-width:920px;margin:0 auto;padding:22px 18px 80px}',
      '.lis-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}',
      '.lis-title{font-size:22px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:9px}',
      '.lis-title .g{color:#8B5CF6}',
      '.lis-sub{color:#6b7280;font-size:13.5px;margin:2px 0 20px}',
      '.lis-x{background:#fff;color:#3a4152;border:1px solid #E6E9F0;border-radius:10px;width:38px;height:38px;font-size:17px;cursor:pointer;flex-shrink:0;box-shadow:0 1px 2px rgba(10,14,26,.05)}',
      '.lis-x:hover{background:#F8FAFC;color:#0A0E1A}',
      '.lis-q{margin-bottom:20px}',
      '.lis-ql{font-weight:700;font-size:14px;margin-bottom:9px;color:#3a4152}',
      '.lis-opts{display:flex;flex-wrap:wrap;gap:9px}',
      '.lis-opt{background:#fff;color:#3a4152;border:1.5px solid #E6E9F0;border-radius:12px;padding:11px 15px;cursor:pointer;font:600 13.5px/1.2 inherit;box-shadow:0 1px 2px rgba(10,14,26,.04);transition:border-color .15s,background .15s}',
      '.lis-opt small{display:block;font-weight:500;color:#9aa1ae;margin-top:3px;font-size:11.5px}',
      '.lis-opt:hover{border-color:#c3b6f2}',
      '.lis-opt.on{border-color:#8B5CF6;background:#f3efff;color:#5b2ec4}',
      '.lis-opt.on small{color:#7c56e6}',
      '.lis-date{background:#fff;color:#0A0E1A;border:1.5px solid #E6E9F0;border-radius:12px;padding:10px 14px;font:600 13.5px/1 inherit}',
      '.lis-date:focus{outline:none;border-color:#8B5CF6;box-shadow:0 0 0 3px #f3efff}',
      '.lis-cta{position:sticky;bottom:0;left:0;right:0;margin-top:24px;padding:16px 0 6px;background:linear-gradient(to top,#F8FAFC 70%,rgba(248,250,252,0));display:flex;gap:10px;flex-wrap:wrap}',
      '.lis-btn{border:1px solid #E6E9F0;background:#fff;color:#3a4152;border-radius:12px;padding:13px 20px;font:700 14px/1 inherit;cursor:pointer;transition:all .15s}',
      '.lis-btn:hover{background:#F8FAFC;color:#0A0E1A}',
      '.lis-btn-p{background:linear-gradient(135deg,#8B5CF6,#0057FF);border-color:transparent;color:#fff;box-shadow:0 6px 16px rgba(88,60,220,.28)}',
      '.lis-btn-p:hover{color:#fff;box-shadow:0 8px 22px rgba(88,60,220,.36);transform:translateY(-1px)}',
      '.lis-recap{background:#fff;border:1px solid #E6E9F0;border-radius:14px;padding:14px 16px;margin-bottom:18px;font-size:13.5px;color:#3a4152;display:flex;flex-wrap:wrap;gap:8px 18px;box-shadow:0 1px 2px rgba(10,14,26,.05)}',
      '.lis-recap b{color:#0A0E1A}',
      '.lis-card{background:#fff;border:1px solid #E6E9F0;border-radius:14px;padding:14px 16px;margin-bottom:12px;border-left:4px solid var(--pc,#8B5CF6);box-shadow:0 1px 2px rgba(10,14,26,.05)}',
      '.lis-crow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}',
      '.lis-date2{font-weight:800;font-size:13px;color:#0A0E1A}',
      '.lis-tag{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:#eef1f6;color:#3a4152}',
      '.lis-tag.pil{background:var(--pcb,#f3efff);color:var(--pc,#5b2ec4)}',
      '.lis-hook{font-weight:700;font-size:15px;color:#0A0E1A;margin:4px 0 6px;line-height:1.35}',
      '.lis-core{font-size:13px;color:#6b7280;line-height:1.5;margin-bottom:10px}',
      '.lis-gen{white-space:pre-wrap;font-size:13px;color:#0A0E1A;line-height:1.55;background:#faf8ff;border:1px solid #e4d9fb;border-radius:10px;padding:12px 13px;margin-bottom:10px;max-height:340px;overflow:auto}',
      '.lis-genb{border-color:#c3b6f2!important;color:#7c56e6!important;background:#f6f2ff!important}',
      '.lis-genb:hover{color:#5b2ec4!important;background:#efe8ff!important}',
      '.lis-choose{font-weight:700;font-size:12.5px;color:#475569;margin:2px 0 8px}',
      '.lis-opts2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}',
      '@media (max-width:620px){.lis-opts2{grid-template-columns:1fr}}',
      '.lis-opt2{display:flex;flex-direction:column;gap:5px;text-align:left;background:#fff;border:1.5px solid #E2E8F0;border-radius:12px;padding:12px 13px;cursor:pointer;font:inherit;transition:border-color .15s,box-shadow .15s}',
      '.lis-opt2:hover{border-color:#c9d3e6}',
      '.lis-opt2.on{border-color:var(--pc,#0057FF);box-shadow:0 0 0 3px rgba(0,87,255,.10)}',
      '.lis-opt2-top{display:flex;align-items:center;gap:7px}',
      '.lis-opt2-num{font-size:11px;font-weight:800;color:var(--pc,#0057FF);text-transform:uppercase;letter-spacing:.03em}',
      '.lis-opt2.on .lis-opt2-num::after{content:" ✓"}',
      '.lis-opt2-h{font-weight:700;font-size:13.5px;color:#0f172a;line-height:1.3}',
      '.lis-opt2-core{font-size:12px;color:#64748b;line-height:1.45}',
      '.lis-abc{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '.lis-imgidea{margin-top:9px;font-size:12.5px;color:#475569;line-height:1.5;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:9px;padding:8px 11px}',
      '.lis-imgidea b{color:#0f172a}',
      '.lis-imgb{margin-left:6px;padding:2px 8px !important}',
      '.lis-ab{width:30px;height:30px;border-radius:8px;border:1px solid #E6E9F0;background:#fff;color:#6b7280;font:700 12px/1 inherit;cursor:pointer}',
      '.lis-ab.on{background:#8B5CF6;border-color:#8B5CF6;color:#fff}',
      '.lis-mini{background:#fff;border:1px solid #E6E9F0;color:#6b7280;border-radius:8px;padding:6px 10px;font:600 12px/1 inherit;cursor:pointer;margin-left:auto}',
      '.lis-mini:hover{color:#0A0E1A;border-color:#d3dae4}',
      '.lis-del{color:#e0455f}',
      '.lis-del:hover{border-color:#f6bcc6;background:#fff5f6}',
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
      '<div class="lis-top"><div class="lis-title">Assistant stratégie</div>' +
      '<button class="lis-x" onclick="V2.lis.close()">✕</button></div>' +
      '<div class="lis-sub">Quelques réponses et je te génère un plan de posts daté, positif et prêt à suivre — calé sur les grandes causes du calendrier.</div>' +
      '<div class="lis-q"><div class="lis-ql">Cadence de publication</div>' + segNum('cadence', CADENCES, cfg.cadence, ' / sem.') + '</div>' +
      '<div class="lis-q"><div class="lis-ql">Sur combien de semaines</div>' + segNum('horizon', HORIZONS, cfg.horizon, ' sem.') + '</div>' +
      '<div class="lis-q"><div class="lis-ql">Ton dominant</div>' + seg('tone', TONES, cfg.tone, false) + '</div>' +
      '<div class="lis-q"><div class="lis-ql">Familles à privilégier <small style="font-weight:500;color:#8493b8">(plusieurs possibles)</small></div>' + themeOpts + '</div>' +
      '<div class="lis-q"><div class="lis-ql">Démarrer le</div>' +
        '<input type="date" class="lis-date" value="' + startVal() + '" onchange="V2.lis.pick(\'start\',this.value)"> ' +
        '<span style="color:#8493b8;font-size:12.5px">par défaut : lundi prochain</span></div>' +
      '<div class="lis-cta"><button class="lis-btn-p lis-btn" onclick="V2.lis.gen()">Générer mon plan (' + (cfg.cadence * cfg.horizon) + ' posts)</button></div>' +
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
    var recap = '<div class="lis-recap">' +
      '<span><b>' + plan.length + '</b> posts</span>' +
      '<span><b>' + cfg.horizon + '</b> semaines · <b>' + cfg.cadence + '</b>/sem.</span>' +
      '<span>Ton : <b>' + esc((TONES.filter(function (t) { return t.k === cfg.tone; })[0] || TONES[0]).label) + '</b></span>' +
      '</div>';
    var cards = plan.map(function (s, idx) {
      var pm = pillMeta(s.pillar); var angs = anglesOf(s); if (s.sel >= angs.length) s.sel = 0; var a = angs[s.sel] || angs[0];
      var opts = angs.map(function (x, j) {
        return '<button class="lis-opt2' + (j === s.sel ? ' on' : '') + '" onclick="V2.lis.sel(' + idx + ',' + j + ')">' +
          '<span class="lis-opt2-top"><span class="lis-opt2-num">Idée ' + (j + 1) + '</span>' +
          '<span class="lis-tag">' + esc(FMT[x.f] || 'Texte') + '</span></span>' +
          '<span class="lis-opt2-h">' + esc(x.h) + '</span>' +
          '<span class="lis-opt2-core">' + esc(x.core) + '</span></button>';
      }).join('');
      return '<div class="lis-card" style="--pc:' + pm.color + '">' +
        '<div class="lis-crow">' +
          '<span class="lis-date2">' + fmtDate(s.date) + '</span>' +
          '<span class="lis-tag pil" style="--pcb:' + pm.color + '33">' + esc(s.seasonal ? 'Grande cause' : pm.label) + '</span>' +
          '<button class="lis-mini lis-del" onclick="V2.lis.remove(' + idx + ')">Supprimer</button>' +
        '</div>' +
        '<div class="lis-choose">Choisis ton idée du jour :</div>' +
        '<div class="lis-opts2">' + opts + '</div>' +
        (s.gen ? '<div class="lis-gen">' + esc(s.gen) + '</div>' : '') +
        '<div class="lis-abc">' +
          '<button class="lis-mini lis-genb" onclick="V2.lis.gentext(' + idx + ')">' + (s.gen ? '↻ Régénérer le texte' : '✍️ Générer le texte de l’idée choisie') + '</button>' +
          '<button class="lis-mini" onclick="V2.lis.other(' + idx + ')">↻ 2 autres idées</button></div>' +
        '<div class="lis-imgidea"><b>Idée visuelle :</b> ' + esc(generateImageIdea(s.seasonal ? 'causes' : s.pillar, s.imgv || 0)) +
          ' <button class="lis-mini lis-imgb" onclick="V2.lis.otherImg(' + idx + ')">↻ Autre</button></div>' +
      '</div>';
    }).join('');
    return '<div class="lis-wrap">' +
      '<div class="lis-top"><div class="lis-title">Ton plan éditorial</div>' +
      '<button class="lis-x" onclick="V2.lis.close()">✕</button></div>' +
      '<div class="lis-sub">Pour chaque jour, choisis une des 2 idées proposées (ou « 2 autres idées »), puis ajoute tout au calendrier.</div>' +
      recap + (cards || '<div class="lis-sub">Aucun post — reviens au quiz.</div>') +
      '<div class="lis-cta">' +
        '<button class="lis-btn" onclick="V2.lis.back()">‹ Modifier le quiz</button>' +
        '<button class="lis-btn" onclick="V2.lis.regen()">↻ Régénérer tout</button>' +
        '<button class="lis-btn-p lis-btn" onclick="V2.lis.add()">Ajouter au calendrier (' + plan.length + ')</button>' +
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
  V2.lis.sel = function (idx, j) { if (plan[idx]) { plan[idx].sel = j; plan[idx].gen = ''; draw(); } };
  V2.lis.other = function (idx) { if (plan[idx]) { plan[idx].offset += 2; plan[idx].sel = 0; plan[idx].gen = ''; draw(); } };
  V2.lis.otherImg = function (idx) { if (plan[idx]) { plan[idx].imgv = (plan[idx].imgv || 0) + 1; draw(); } };
  V2.lis.gentext = function (idx) {
    var s = plan[idx]; if (!s) return;
    var angs = anglesOf(s); var a = angs[s.sel] || angs[0];
    s.genv = s.gen ? ((s.genv || 0) + 1) : (s.genv || 0);
    s.gen = generateFull({ hook: a.h, core: a.core, pillar: (s.seasonal ? 'causes' : s.pillar), tone: cfg.tone, v: s.genv || 0 });
    draw();
  };
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
    var name = 'Plan éditorial — ' + fmtDate(plan[0].date);
    var rows = plan.map(function (s) {
      var angs = anglesOf(s); var a = angs[s.sel] || angs[0];
      var pk = s.seasonal ? 'causes' : s.pillar;
      return {
        date: s.date.toISOString(), status: 'idee', pillar: pk,
        title: a.h, body: (s.gen || compose(a, cfg.tone, pk)), format: a.f,
        image_brief: generateImageIdea(pk, s.imgv || 0),
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
      try { toast(rows.length + ' posts ajoutés au calendrier'); } catch (e) {}
    });
  };

  function toast(msg) {
    var t = document.createElement('div'); t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9999;background:linear-gradient(135deg,#8B5CF6,#0057FF);color:#fff;padding:12px 20px;border-radius:12px;font:700 14px/1 sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)';
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }

  // Génération de texte pour l'éditeur d'un post (depuis le calendrier)
  V2.lis.genForEditor = function (pillar, title, v) {
    return generateFull({ hook: title || '', core: '', pillar: pillar || 'causes', tone: 'proche', v: v || 0 });
  };
  // Rédiger un post complet à partir d'une idée courte de l'utilisateur
  V2.lis.genFromBrief = function (pillar, brief, v) {
    return generateFromBrief(brief, pillar || 'causes', 'proche', v || 0);
  };
  // Proposer une idée de post (accroche + angle) pour un pilier
  V2.lis.suggestIdea = function (pillar, v) {
    var pool = ANGLES[pillar || 'causes'] || ANGLES.causes;
    var a = pool[((v || 0) % pool.length + pool.length) % pool.length];
    return { h: a.h, core: a.core, format: a.f };
  };
  // Proposer une idée / description de visuel pour un pilier
  V2.lis.genImageIdea = function (pillar, v) { return generateImageIdea(pillar || 'causes', v || 0); };

  V2.liStrategy = { open: function () { V2.lis.open(); }, _cfg: function () { return cfg; }, _plan: function () { return plan; }, _build: buildPlan, generateFull: generateFull };
})();

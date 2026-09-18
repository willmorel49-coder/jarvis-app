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

  // ── CSS (injecté une fois). Lot 6 (19/09/2026) : l'assistant entre dans le cadre de l'espace Marketing — sous la barre,
  //    jetons et échelle du socle (.mk-espace), UN accent #0050E6, choix actifs en bleu pâle, UN bouton plein. Plus aucun violet.
  var cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    var css = [
      '#lis-root{position:fixed;top:64px;right:0;bottom:0;left:0;z-index:45;overflow:auto;-webkit-overflow-scrolling:touch;',
      'background:radial-gradient(80% 56% at 6% -12%,rgba(0,80,230,.13),rgba(0,80,230,.04) 45%,transparent 66%),linear-gradient(180deg,#ECF1FB 0,#F6F8FD 40%,#FBFCFE 72%)}',
      '.lis-wrap{max-width:1320px;margin:0 auto;padding:32px 32px 64px}',
      '.lis-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}',
      '.lis-title{margin:0;font-size:var(--mk-s1);line-height:var(--mk-s1l);font-weight:700;letter-spacing:-.02em;color:var(--mk-encre)}',
      '.lis-sub{margin:8px 0 32px;max-width:72ch;color:var(--mk-attenue)}',
      '.mk-espace .lis-x{flex:none;width:44px;height:44px;padding:0}',
      '.lis-plan2{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:48px;align-items:start}',
      '.lis-q{margin-bottom:24px}',
      '.lis-ql{margin:0 0 8px;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--mk-attenue)}',
      '.lis-ql small{font-size:inherit;font-weight:450;letter-spacing:0;text-transform:none}',
      '.lis-q .mk-seg{max-width:520px}',
      '.lis-opts{display:flex;flex-wrap:wrap;gap:8px}',
      '.mk-espace .lis-opt{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:var(--mk-r-vig);background:#fff;border:1px solid var(--mk-trait);box-shadow:var(--mk-n1);font-size:var(--mk-s4);font-weight:600;color:var(--mk-encre2)}',
      '.lis-opt i{width:8px;height:8px;border-radius:50%;flex:none}',
      '.mk-espace .lis-opt.on{background:var(--mk-pale);border-color:transparent;box-shadow:none;color:var(--mk-bleu-txt)}',
      '.lis-daterow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.lis-date{height:44px;padding:0 12px;border:1px solid var(--mk-trait);border-radius:var(--mk-r-vig);background:#fff;box-shadow:var(--mk-n1);font:inherit;font-size:16px;font-weight:600;color:var(--mk-encre)}',
      '.lis-date:focus{outline:2px solid var(--mk-bleu);outline-offset:2px}',
      '.lis-aide{font-size:var(--mk-s5);line-height:var(--mk-s5l);color:var(--mk-attenue)}',
      '.lis-bilan{position:sticky;top:32px;padding:28px}',
      '.lis-bilan-n{display:block;font-size:64px;line-height:64px;font-weight:700;letter-spacing:-.03em;color:var(--mk-encre)}',
      '.lis-bilan-n small{font-size:var(--mk-s2);font-weight:600;letter-spacing:-.01em;color:var(--mk-attenue)}',
      '.lis-bilan ul{margin:16px 0 24px;padding:0;list-style:none;display:grid;gap:4px;color:var(--mk-encre2)}',
      '.lis-bilan li b{font-weight:650;color:var(--mk-encre)}',
      '.mk-espace .lis-bilan .mk-btn{width:100%}',
      '.lis-recap{display:flex;flex-wrap:wrap;gap:4px 24px;margin:0 0 24px;color:var(--mk-encre2)}',
      '.lis-recap b{font-weight:650;color:var(--mk-encre)}',
      '.lis-cards{display:grid;gap:16px;max-width:960px}',
      '.lis-card{padding:20px 24px}',
      '.lis-crow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:4px}',
      '.lis-date2{font-size:var(--mk-s3);line-height:var(--mk-s3l);font-weight:700;color:var(--mk-encre)}',
      '.lis-tag{display:inline-flex;align-items:center;gap:6px;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;color:var(--mk-attenue)}',
      '.lis-tag i{width:8px;height:8px;border-radius:50%;flex:none}',
      '.lis-crow .mk-btn{margin-left:auto}',
      '.lis-choose{margin:0 0 8px;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;color:var(--mk-attenue)}',
      '.lis-opts2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}',
      '.mk-espace .lis-opt2{display:flex;flex-direction:column;align-items:stretch;gap:4px;min-height:44px;padding:12px 16px;border-radius:var(--mk-r-vig);background:#fff;border:1px solid var(--mk-trait);box-shadow:var(--mk-n1);text-align:left}',
      '.mk-espace .lis-opt2.on{background:var(--mk-pale);border-color:transparent;box-shadow:0 0 0 2px var(--mk-bleu) inset}',
      '.lis-opt2-top{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.lis-opt2-num{font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:650;color:var(--mk-attenue)}',
      '.lis-opt2.on .lis-opt2-num{color:var(--mk-bleu-txt)}',
      '.lis-opt2-h{font-size:var(--mk-s4);line-height:var(--mk-s4l);font-weight:650;color:var(--mk-encre)}',
      '.lis-opt2-core{font-size:var(--mk-s5);line-height:20px;color:var(--mk-attenue)}',
      '.lis-gen{white-space:pre-wrap;margin-bottom:12px;padding:16px;max-height:340px;overflow:auto;border-radius:var(--mk-r-vig);background:var(--mk-groupe);font-size:var(--mk-s4);line-height:var(--mk-s4l);color:var(--mk-encre)}',
      '.lis-abc{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 -12px}',
      '.lis-imgidea{margin-top:8px;padding-top:12px;border-top:1px solid var(--mk-trait);font-size:var(--mk-s5);line-height:20px;color:var(--mk-encre2)}',
      '.lis-imgidea b{color:var(--mk-encre);font-weight:650}',
      '.mk-espace .lis-imgidea .mk-btn{margin-left:-12px}',
      '.lis-cta{position:sticky;bottom:0;z-index:2;display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:24px -32px -64px;padding:12px 32px;background:#fff;border-top:1px solid var(--mk-trait)}',
      '.lis-cta .lis-pousse{flex:1 1 0}',
      '.lis-toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:8px;padding:12px 20px;border-radius:12px;background:#10131C;color:#fff;font-size:15px;font-weight:600;box-shadow:0 8px 30px rgba(11,31,77,.3)}',
      '@media (max-width:1040px){.lis-plan2{grid-template-columns:minmax(0,1fr) 320px;gap:32px}}',
      '@media (max-width:860px){',
      '#lis-root{top:56px;bottom:calc(65px + env(safe-area-inset-bottom,0px))}',
      '.lis-wrap{padding:20px 16px 0}',
      '.lis-sub{margin-bottom:24px}',
      '.lis-plan2{display:block}',
      '.lis-q .mk-seg{max-width:none}',
      '.mk-espace .lis-q .mk-seg button{padding:0 2px;font-size:var(--mk-s5)}',
      '.lis-bilan{position:sticky;bottom:0;top:auto;z-index:2;display:flex;align-items:center;gap:12px;margin:24px -16px 0;padding:12px 16px;border-radius:0;border:0;border-top:1px solid var(--mk-trait);background:#fff;box-shadow:none}',
      '.lis-bilan-n{font-size:var(--mk-s2);line-height:var(--mk-s2l);white-space:nowrap}.lis-bilan-n small{font-size:var(--mk-s5)}',
      '.lis-bilan ul{display:none}',
      '.mk-espace .lis-bilan .mk-btn{flex:1 1 0;width:auto;min-height:48px}',
      '.lis-opts2{grid-template-columns:1fr}',
      '.lis-card{padding:16px;border-radius:16px}',
      '.lis-cta{margin:24px -16px 0;padding:12px 16px}',
      '.mk-espace .lis-cta .mk-plein{flex:1 1 100%;order:-1;min-height:48px}',
      '.lis-toast{bottom:calc(84px + env(safe-area-inset-bottom,0px));width:calc(100% - 32px);justify-content:center}',
      '}'
    ].join('');
    var s = document.createElement('style'); s.id = 'lis-css'; s.textContent = css; document.head.appendChild(s);
  }
  function host() {
    var el = document.getElementById('lis-root');
    if (!el) { el = document.createElement('div'); el.id = 'lis-root'; el.className = 'mk-espace'; document.body.appendChild(el); }
    return el;
  }
  function mic(n, s, w) { return (V2.mktSocle && V2.mktSocle.ic) ? V2.mktSocle.ic(n, s, w) : ''; }

  // ── Rendu ──
  function seg(field, list, curr, withSub) {
    var idx = 0; list.forEach(function (o, i) { if (o.k === curr) idx = i; });
    return '<div class="mk-seg" role="group" style="--n:' + list.length + ';--i:' + idx + '"><span class="mk-seg-ind" aria-hidden="true"></span>' + list.map(function (o) {
      return '<button type="button" aria-pressed="' + (curr === o.k ? 'true' : 'false') + '"' + (withSub && o.sub ? ' title="' + esc(o.sub) + '"' : '') + ' onclick="V2.lis.pick(\'' + field + '\',\'' + o.k + '\')">' + esc(o.label) + '</button>';
    }).join('') + '</div>';
  }
  function segNum(field, list, curr, suffix) {
    var idx = Math.max(0, list.indexOf(curr));
    return '<div class="mk-seg" role="group" style="--n:' + list.length + ';--i:' + idx + '"><span class="mk-seg-ind" aria-hidden="true"></span>' + list.map(function (n) {
      return '<button type="button" aria-pressed="' + (curr === n ? 'true' : 'false') + '" onclick="V2.lis.pick(\'' + field + '\',' + n + ')">' + n + (suffix || '') + '</button>';
    }).join('') + '</div>';
  }
  function fermerBtn() { return '<button type="button" class="mk-btn lis-x" onclick="V2.lis.close()" aria-label="Fermer l\'assistant">' + mic('fermer', 20) + '</button>'; }
  function quizHtml() {
    var themeOpts = '<div class="lis-opts">' + PILL().map(function (p) {
      var on = (cfg.themes.indexOf(p.k) !== -1);
      return '<button type="button" class="lis-opt' + (on ? ' on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" onclick="V2.lis.theme(\'' + p.k + '\')"><i style="background:' + p.color + '"></i>' + esc(p.label) + '</button>';
    }).join('') + '</div>';
    var n = cfg.cadence * cfg.horizon;
    var d0 = cfg.start ? new Date(cfg.start) : nextMonday();
    return '<div class="lis-wrap">' +
      '<div class="lis-top"><h1 class="lis-title">Assistant stratégie</h1>' + fermerBtn() + '</div>' +
      '<p class="lis-sub">Cinq réponses, et un plan de posts daté vous est proposé — positif, calé sur les grandes causes du calendrier.</p>' +
      '<div class="lis-plan2"><div>' +
      '<div class="lis-q"><p class="lis-ql">Cadence de publication</p>' + segNum('cadence', CADENCES, cfg.cadence, ' / sem.') + '</div>' +
      '<div class="lis-q"><p class="lis-ql">Sur combien de semaines</p>' + segNum('horizon', HORIZONS, cfg.horizon, ' sem.') + '</div>' +
      '<div class="lis-q"><p class="lis-ql">Ton dominant</p>' + seg('tone', TONES, cfg.tone, true) + '</div>' +
      '<div class="lis-q"><p class="lis-ql">Familles à privilégier <small>(plusieurs possibles)</small></p>' + themeOpts + '</div>' +
      '<div class="lis-q"><p class="lis-ql">Démarrer le</p><div class="lis-daterow">' +
        '<input type="date" class="lis-date" aria-label="Date de départ" value="' + startVal() + '" onchange="V2.lis.pick(\'start\',this.value)">' +
        '<span class="lis-aide">par défaut : lundi prochain</span></div></div>' +
      '</div>' +
      '<aside class="lis-bilan mk-souleve"><span class="lis-bilan-n">' + n + '<small> posts</small></span>' +
        '<ul><li><b>' + cfg.cadence + '</b> par semaine, pendant <b>' + cfg.horizon + '</b> semaines</li>' +
        '<li>Ton <b>' + esc(((TONES.filter(function (t) { return t.k === cfg.tone; })[0] || TONES[0]).label || '').toLowerCase()) + '</b> · <b>' + cfg.themes.length + '</b> famille' + (cfg.themes.length > 1 ? 's' : '') + '</li>' +
        '<li id="lis-depart">À partir du <b>' + fmtDate(d0) + '</b></li></ul>' +
        '<button type="button" class="mk-btn mk-plein mk-grand" onclick="V2.lis.gen()">Générer le plan</button></aside>' +
      '</div></div>';
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
    var recap = '<p class="lis-recap">' +
      '<span><b>' + plan.length + '</b> posts</span>' +
      '<span><b>' + cfg.horizon + '</b> semaines · <b>' + cfg.cadence + '</b> par semaine</span>' +
      '<span>Ton : <b>' + esc((TONES.filter(function (t) { return t.k === cfg.tone; })[0] || TONES[0]).label) + '</b></span>' +
      '</p>';
    var cards = plan.map(function (s, idx) {
      var pm = pillMeta(s.pillar); var angs = anglesOf(s); if (s.sel >= angs.length) s.sel = 0; var a = angs[s.sel] || angs[0];
      var opts = angs.map(function (x, j) {
        return '<button type="button" class="lis-opt2' + (j === s.sel ? ' on' : '') + '" aria-pressed="' + (j === s.sel ? 'true' : 'false') + '" onclick="V2.lis.sel(' + idx + ',' + j + ')">' +
          '<span class="lis-opt2-top"><span class="lis-opt2-num">Idée ' + (j + 1) + (j === s.sel ? ' · choisie' : '') + '</span>' +
          '<span class="lis-tag">' + esc(FMT[x.f] || 'Texte') + '</span></span>' +
          '<span class="lis-opt2-h">' + esc(x.h) + '</span>' +
          '<span class="lis-opt2-core">' + esc(x.core) + '</span></button>';
      }).join('');
      return '<div class="lis-card mk-souleve">' +
        '<div class="lis-crow">' +
          '<span class="lis-date2">' + fmtDate(s.date) + '</span>' +
          '<span class="lis-tag"><i style="background:' + pm.color + '"></i>' + esc(s.seasonal ? 'Grande cause' : pm.label) + '</span>' +
          '<button type="button" class="mk-btn mk-danger" onclick="V2.lis.remove(' + idx + ')">Retirer</button>' +
        '</div>' +
        '<p class="lis-choose">Choisissez une idée :</p>' +
        '<div class="lis-opts2">' + opts + '</div>' +
        (s.gen ? '<div class="lis-gen">' + esc(s.gen) + '</div>' : '') +
        '<div class="lis-abc">' +
          '<button type="button" class="mk-btn mk-texte" onclick="V2.lis.gentext(' + idx + ')">' + (s.gen ? 'Régénérer le texte' : 'Générer le texte de l’idée choisie') + '</button>' +
          '<button type="button" class="mk-btn mk-texte" onclick="V2.lis.other(' + idx + ')">Deux autres idées</button></div>' +
        '<div class="lis-imgidea"><b>Idée visuelle :</b> ' + esc(generateImageIdea(s.seasonal ? 'causes' : s.pillar, s.imgv || 0)) +
          '<br><button type="button" class="mk-btn mk-texte" onclick="V2.lis.otherImg(' + idx + ')">Une autre idée visuelle</button></div>' +
      '</div>';
    }).join('');
    return '<div class="lis-wrap">' +
      '<div class="lis-top"><h1 class="lis-title">Votre plan éditorial</h1>' + fermerBtn() + '</div>' +
      '<p class="lis-sub" style="margin-bottom:8px">Pour chaque date, choisissez l’une des deux idées proposées (ou demandez-en deux autres), puis ajoutez le tout aux posts.</p>' +
      recap + '<div class="lis-cards">' + (cards || '<p class="lis-sub">Aucun post : revenez aux réponses.</p>') + '</div>' +
      '<div class="lis-cta">' +
        '<button type="button" class="mk-btn" onclick="V2.lis.back()">' + mic('retour', 18) + 'Modifier les réponses</button>' +
        '<button type="button" class="mk-btn mk-texte" onclick="V2.lis.regen()">Tout régénérer</button>' +
        '<span class="lis-pousse"></span>' +
        '<button type="button" class="mk-btn mk-plein"' + (plan.length ? '' : ' disabled') + ' onclick="V2.lis.add()">Ajouter aux posts (' + plan.length + ')</button>' +
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
  document.addEventListener('click', function (e) { if (isOpen && e.target.closest && e.target.closest('.mk-barre,.mk-onglets-bas')) V2.lis.close(); }, true);
  document.addEventListener('keydown', function (e) { if (isOpen && e.key === 'Escape') V2.lis.close(); });
  window.addEventListener('hashchange', function () { if (isOpen && !/^#marketing\/linkedin/.test(location.hash)) V2.lis.close(); });
  V2.lis.pick = function (field, val) {
    cfg[field] = val; if (field !== 'start') { draw(); return; }
    var l = document.getElementById('lis-depart'); if (l && val) l.innerHTML = 'À partir du <b>' + fmtDate(new Date(val)) + '</b>';
  };
  V2.lis.theme = function (k) {
    var i = cfg.themes.indexOf(k);
    if (i === -1) cfg.themes.push(k); else if (cfg.themes.length > 1) cfg.themes.splice(i, 1);
    draw();
  };
  V2.lis.gen = function () { plan = buildPlan(cfg); stratId = (LI().newId ? LI().newId() : 'strat' + (new Date()).getTime()); step = 'preview'; draw(); };
  // Lot 6 : ce bouton existait (« Modifier le quiz ») mais sa fonction n'avait jamais été écrite — il levait une erreur.
  V2.lis.back = function () { step = 'quiz'; draw(); };
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
      if (V2.li && V2.li.setView) V2.li.setView('plan'); else if (LI().goCal) LI().goCal(first);
      try { toast(rows.length + ' posts ajoutés aux posts, à partir du ' + fmtDate(first)); } catch (e) {}
    });
  };

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'lis-toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7FE0B4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span></span>';
    t.lastChild.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }


  /* ═══════════════════════════════════════════════════════════════════
     Rédaction PILOTÉE PAR L'IDÉE (20/08/2026)
     Avant : l'idée servait uniquement d'accroche, et tout le reste du post
     venait d'un fond générique par pilier. « lancement gamme solaire »
     produisait « • S'informer sur la cause / • Soutenir les initiatives » et
     une idée de visuel « ruban rose, moustache ». Incohérent, signalé par Will.
     Maintenant : on détecte le sujet, et TOUS les blocs — développement,
     puces, clôture, hashtags, idée de visuel — en découlent.
     ═══════════════════════════════════════════════════════════════════ */
  var SUJETS = [
    { k: 'recrutement',
      rx: /recrut|embauch|\bposte\b|\bcdi\b|\bcdd\b|altern|apprenti|\bstage\b|offre d.emploi|rejoin|candidat|\btalent|profil recherch/i,
      ouv: ['Nous recrutons — {s}.', '{S} : le poste est ouvert.', '{S} — et si c’était vous ?'],
      dev: ['Rejoindre la répartition pharmaceutique, c’est travailler sur un maillon que peu de gens connaissent, et dont dépend l’ouverture des officines chaque matin.',
            'Ce qu’on cherche avant tout, c’est de la rigueur : dans nos métiers, une erreur ne se mesure pas en euros, elle se mesure en patients.'],
      puces: [['Un métier concret, au cœur de la chaîne du médicament', 'Une équipe qui forme avant de laisser seul', 'Un cadre où la rigueur compte autant que le diplôme'],
              ['Des journées qui ne se ressemblent pas', 'Un travail dont on voit le résultat le lendemain matin', 'Des collègues qui expliquent volontiers']],
      fin: ['Le poste vous parle, ou vous connaissez la bonne personne ? Écrivez-nous en message privé.',
            'Intéressé, ou vous pensez à quelqu’un ? Un message suffit.'],
      tags: ['#Recrutement', '#Emploi', '#Pharmacie'],
      vis: ['Photo de l’équipe ou du poste de travail concerné, lumière naturelle, visage souriant — accord écrit de la personne. Intitulé du poste incrusté en bas, sobre.',
            'Visuel typographique : l’intitulé « {s} » en très grand sur fond crème, une seule couleur d’accent, et la ville en petit dessous.'] },

    { k: 'evenement',
      rx: /salon|congr[eè]s|\bstand\b|pharmagora|portes ouvertes|inaugur|anniversaire|soir[ée]e|convention|forum|assembl[ée]e|rendez-vous|\bjourn[ée]e d/i,
      ouv: ['{S} : rendez-vous pris.', 'On y sera — {s}.', '{S}. On a hâte.'],
      dev: ['Ces moments-là ont un intérêt simple : se parler en vrai, sans écran ni fil de discussion.',
            'C’est souvent là qu’on comprend le mieux ce dont les officines ont réellement besoin — en écoutant, pas en présentant.'],
      puces: [['Échanger avec les équipes sur le terrain', 'Poser les questions qu’on n’écrit pas dans un mail', 'Repartir avec des idées concrètes'],
              ['Se voir en vrai', 'Prendre le temps', 'Écouter plus que parler']],
      fin: ['Vous y serez aussi ? Dites-le en commentaire, on se croisera.',
            'Si vous passez, venez nous voir — on est plus bavards en vrai que sur LinkedIn.'],
      tags: ['#Événement', '#Pharmacie'],
      vis: ['Photo du lieu ou du stand, plan large, avec du monde en mouvement — flou léger pour ne rendre personne identifiable. Date et lieu incrustés.',
            'Carton d’annonce sobre : « {s} » en grand, date et lieu en dessous, une seule couleur d’accent, fond crème.'] },

    { k: 'vaccination',
      rx: /vaccin|grippe|campagne vaccinale|rappel vaccinal|antigrippal/i,
      ouv: ['{S} : quelques repères.', '{S}. Ce qu’il faut savoir, sans vous dire quoi faire.'],
      dev: ['Se faire vacciner est une décision personnelle, qui se prend avec un professionnel de santé. Notre rôle se limite à rappeler que la question mérite d’être posée.',
            'Beaucoup d’adultes ne savent plus où ils en sont de leurs rappels. Ce n’est pas une négligence : personne ne pense à son carnet de vaccination tant que tout va bien.'],
      puces: [['Retrouver son carnet de vaccination', 'Faire le point avec son médecin ou son pharmacien', 'Penser aussi aux proches les plus fragiles']],
      fin: ['Pour toute question sur la vaccination elle-même — qui, quand, comment — votre pharmacien est la bonne porte.',
            'On informe, on n’impose rien : sur le fond, votre pharmacien et votre médecin répondront mieux que nous.'],
      tags: ['#Vaccination', '#Pharmacie'],
      vis: ['Photo documentaire d’un carnet de vaccination ouvert sur une table, lumière naturelle, aucun nom lisible, aucune marque.',
            'Frise simple : « injection » puis, deux semaines plus tard, « protection installée ». Un seul accent, fond crème.'] },

    { k: 'prevention',
      rx: /d[ée]pistag|pr[ée]vention|journ[ée]e mondiale|octobre rose|mars bleu|movember|\bcancer|diab[eè]te|\bavc\b|sant[ée] publique|sensibilisation|mois sans tabac|t[ée]l[ée]thon/i,
      ouv: ['{S}.', '{S} — et le message tient en peu de mots.'],
      dev: ['Le principe de la prévention est toujours le même : agir avant que ça ne se voie.',
            'Ce genre de rendez-vous ne sert pas à faire peur. Il sert à rendre une question ordinaire, pour qu’on ose la poser.'],
      puces: [['S’informer sans dramatiser', 'En parler autour de soi', 'Poser la question à son pharmacien']],
      fin: ['Une question ? Votre pharmacien saura vous orienter, et il a l’habitude de celles qu’on n’ose pas poser.',
            'On informe, on n’impose rien. Le reste appartient à chacun et à son médecin.'],
      tags: ['#Prévention', '#Santé'],
      vis: ['Visuel typographique : une phrase forte du post en très grand sur fond crème, une seule couleur d’accent, beaucoup d’air.',
            'Illustration au trait, douce et non médicalisée, sur le thème « {s} ». Surtout pas d’imagerie anxiogène.'] },

    { k: 'equipe',
      rx: /[ée]quipe|collaborateur|bienvenue|f[ée]licitation|bravo|d[ée]part|promotion|anniversaire de|merci [aà]|nos agences|arriv[ée]e de|portrait/i,
      ouv: ['{S} 👏', '{S} — on avait envie de le dire ici.', '{S}.'],
      dev: ['Ce sont ces moments-là qui font une équipe : pas les grands discours, les petites choses répétées.',
            'On parle beaucoup de process et d’organisation. Au bout du compte, ce qui tient, ce sont les gens.'],
      puces: [],
      fin: ['Merci à toutes les équipes, ici et sur les autres sites.',
            'Bravo, et merci pour ce que vous faites au quotidien.'],
      tags: ['#Équipe', '#Merci'],
      vis: ['Portrait ou photo de groupe en situation de travail, lumière naturelle, sourires — accord écrit des personnes filmées.',
            'Visuel typographique chaleureux : « {s} » en grand, très travaillé, fond crème, un seul accent. Aucun cliché de confettis.'] },

    { k: 'produit',
      rx: /gamme|nouveaut[ée]|lancement|catalogue|r[ée]f[ée]rencement|disponible|nouvelle offre|nouveau service|mise [aà] disposition/i,
      ouv: ['{S}.', 'Nouveauté — {s}.', '{S} : c’est disponible.'],
      dev: ['L’objectif est simple : que les officines trouvent ce dont elles ont besoin, au moment où elles en ont besoin.',
            'Rien de spectaculaire, mais c’est exactement ce qu’on attend d’un répartiteur : que ce soit là.'],
      puces: [['Disponible à la commande', 'Livré sur les tournées habituelles', 'Votre interlocuteur habituel répond à vos questions']],
      fin: ['Votre interlocuteur habituel est à votre disposition pour les détails.',
            'Une question ? Votre contact habituel vous répondra.'],
      tags: ['#Pharmacie', '#Officine'],
      vis: ['Photo produit sur fond neutre, lumière douce, cadrage serré. Aucune mention de prix ni de condition commerciale.',
            'Visuel sobre annonçant « {s} », typographie large, fond crème, une seule couleur d’accent.'] },

    { k: 'defaut',
      rx: /.^/,
      ouv: ['{S}.', '{S} — on en parle ici.'],
      dev: ['On avait envie de le partager ici, simplement.'],
      puces: [],
      fin: ['Et vous, qu’en pensez-vous ? Dites-le en commentaire.',
            'Si le sujet vous parle, on lit tous les commentaires.'],
      tags: ['#Pharmacie', '#Santé'],
      vis: ['Photo sobre et lumineuse illustrant « {s} », cadrage simple, aucun texte incrusté — tout le message dans la légende.',
            'Visuel typographique : la phrase la plus forte du post en très grand, fond crème, une seule couleur d’accent.'] }
  ];

  function sujetDe(brief) {
    var t = String(brief || '');
    for (var i = 0; i < SUJETS.length; i++) if (SUJETS[i].k !== 'defaut' && SUJETS[i].rx.test(t)) return SUJETS[i];
    return SUJETS[SUJETS.length - 1];
  }
  // « lancement gamme solaire, disponible tout l'été » -> « lancement gamme solaire, disponible tout l'été » (nettoyé)
  function nettoie(brief) {
    var s = String(brief || '').trim().replace(/\s+/g, ' ');
    return s.replace(/[.…]+$/, '');
  }
  function majuscule(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  // hashtags tirés des mots de l'idée elle-même, pour que le post lui reste attaché
  var VIDES = /^(avec|dans|pour|tout|tous|toute|notre|nos|leur|leurs|cette|celui|celle|plus|moins|chez|sans|sous|entre|depuis|apres|avant|entre|quand|entre|aussi|meme|encore|deja|bien|tres|etre|avoir|faire|nous|vous|elle|elles|ils|disponible|nouveau|nouvelle)$/;
  function sansAccent(x) { return x.normalize ? x.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : x; }
  function tagsDeLIdee(brief, max, dejaPris) {
    var mots = String(brief || '').toLowerCase()
      .replace(/[^a-zàâäéèêëîïôöùûüçœ\s-]/g, ' ').split(/[\s-]+/);
    var out = [], vus = {};
    // les hashtags du thème sont déjà posés : ne pas les redire (#Vaccination ×2)
    (dejaPris || []).forEach(function (t) { vus[sansAccent(t.replace('#', '').toLowerCase())] = 1; });
    for (var i = 0; i < mots.length && out.length < (max || 2); i++) {
      var m = mots[i];
      if (m.length < 5) continue;
      // un verbe à l'infinitif fait un mauvais hashtag (« #Encourager »)
      if (m.length >= 7 && /er$/.test(m)) continue;
      var nu = sansAccent(m);
      if (VIDES.test(nu) || vus[nu]) continue;
      vus[nu] = 1;
      out.push('#' + m.charAt(0).toUpperCase() + m.slice(1));
    }
    return out;
  }
  // « Nous recrutons — on recrute un préparateur… » : si l'accroche redit ce que
  // l'idée annonce déjà, on prend une accroche neutre.
  function ouvertureNonRedondante(th, s, v) {
    var brefNu = sansAccent(s.toLowerCase());
    for (var pas = 0; pas < th.ouv.length; pas++) {
      var tpl = th.ouv[(v + pas) % th.ouv.length];
      var fixe = tpl.replace(/\{s\}/gi, ' ').toLowerCase();
      var mots = sansAccent(fixe).match(/[a-z]{6,}/g) || [];
      var collision = mots.some(function (m) { return brefNu.indexOf(m.slice(0, 6)) >= 0; });
      if (!collision) return tpl;
    }
    return '{S}.';
  }

  function redigerDepuisIdee(brief, v) {
    var s = nettoie(brief);
    if (!s) return '';
    v = v || 0;
    var th = sujetDe(s);
    var inject = function (tpl) { return tpl.replace(/\{S\}/g, majuscule(s)).replace(/\{s\}/g, s); };
    var parts = [];
    parts.push(inject(ouvertureNonRedondante(th, s, v)));
    parts.push(pickA(th.dev, v));
    if (th.dev.length > 1) { var d2 = pickA(th.dev, v + 1); if (d2 && d2 !== parts[1]) parts.push(d2); }
    if (th.puces && th.puces.length) {
      var jeu = th.puces[((v % th.puces.length) + th.puces.length) % th.puces.length];
      if (jeu && jeu.length) parts.push(jeu.map(function (x) { return '• ' + x; }).join('\n'));
    }
    parts.push(pickA(th.fin, v));
    parts.push(th.tags.concat(tagsDeLIdee(s, 2, th.tags)).join(' '));
    return parts.filter(Boolean).join('\n\n');
  }

  function ideeVisuelDepuisIdee(brief, v) {
    var s = nettoie(brief);
    var th = sujetDe(s);
    var tpl = pickA(th.vis, v || 0);
    return tpl.replace(/\{S\}/g, majuscule(s)).replace(/\{s\}/g, s || 'le sujet du post');
  }

  // Génération de texte pour l'éditeur d'un post (depuis le calendrier)
  V2.lis.genForEditor = function (pillar, title, v) {
    // Le titre EST l'idée : on rédige à partir de lui, pas d'un fond générique.
    if (String(title || '').trim()) return redigerDepuisIdee(title, v || 0);
    return generateFull({ hook: '', core: '', pillar: pillar || 'causes', tone: 'proche', v: v || 0 });
  };
  // Rédiger un post complet à partir d'une idée courte de l'utilisateur
  V2.lis.genFromBrief = function (pillar, brief, v) {
    if (String(brief || '').trim()) return redigerDepuisIdee(brief, v || 0);
    return generateFromBrief(brief, pillar || 'causes', 'proche', v || 0);
  };
  // Proposer une idée de post (accroche + angle) pour un pilier
  V2.lis.suggestIdea = function (pillar, v) {
    var pool = ANGLES[pillar || 'causes'] || ANGLES.causes;
    var a = pool[((v || 0) % pool.length + pool.length) % pool.length];
    return { h: a.h, core: a.core, format: a.f };
  };
  // Proposer une idée / description de visuel pour un pilier
  // brief = l'idée saisie (ou le titre) : sans elle on retombait sur « ruban rose,
  // moustache » quel que soit le sujet réel du post.
  V2.lis.genImageIdea = function (pillar, v, brief) {
    if (String(brief || '').trim()) return ideeVisuelDepuisIdee(brief, v || 0);
    return generateImageIdea(pillar || 'causes', v || 0);
  };

  V2.liStrategy = { open: function () { V2.lis.open(); }, _cfg: function () { return cfg; }, _plan: function () { return plan; }, _build: buildPlan, generateFull: generateFull };
})();

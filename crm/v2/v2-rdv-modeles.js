/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Modèles de mail de prise de rendez-vous (V2MOD)
   Trois motifs, six à huit lignes chacun. On parle des chiffres DU
   PHARMACIEN, jamais des nôtres : aucune condition commerciale chiffrée
   ne doit sortir de la maison (règle métier non négociable).
   Fichier PUR : aucun DOM, aucun réseau.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  var STOP = '\n\n—\nVous ne souhaitez plus recevoir ces propositions ? Répondez STOP à ce message.';
  var CHIFFRE_PCT = /\d+(?:[.,]\d+)?\s*%/;

  function txt(v, repli) {
    if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return repli || '';
    return String(v);
  }
  function eur(n) {
    if (n == null || n === '' || isNaN(n)) return '';
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
  }
  function salut(ctx) {
    var c = txt(ctx.contact);
    return 'Bonjour' + (c ? ' ' + c : '') + ',';
  }
  // Signature complète. Elle ne contient QUE des faits : nom du commercial,
  // sa maison, son numéro. Aucune fonction inventée — un titre faux dans un
  // mail à un pharmacien se remarque, et décrédibilise tout le reste.
  function signature(ctx) {
    var t = txt(ctx.tel_commercial);
    var nom = txt(ctx.nom_complet_commercial) || txt(ctx.prenom_commercial);
    return '\n\nBien à vous,\n\n' + nom +
           '\nIntégral Pharma' + (t ? '\n' + t : '');
  }

  // Garde-fou : un pourcentage saisi à la main dans le texte libre serait une
  // condition commerciale sur un support qui sort de la maison. On l'écarte.
  M.texteRefuse = function (t) { return CHIFFRE_PCT.test(String(t || '')); };

  // ── Deux phrases qui parlent de LUI ───────────────────────────────
  // Les trois motifs personnalisés disaient « chiffres à l'appui » et
  // « les références en tension que nous avons en stock » — vrai pour tout
  // le monde, donc pour personne. JARVIS connaît son chiffre et connaît ses
  // ruptures : il n'y a aucune raison de rester dans le vague.
  //
  // ⚠️ Ce qui entre ici, et ce qui n'y entrera jamais. Le chiffre d'affaires
  // est le SIEN, la tension ANSM est un fait public, notre stock est un fait
  // vérifiable — les trois s'écrivent. Un montant d'abandon de marge, non :
  // un mail est un document remis au pharmacien, et aucune condition
  // commerciale chiffrée ne s'y imprime. C'est la règle métier, pas un avis.
  //
  // Rien de tout ça ne descend dans les modèles GROUPÉS plus bas : un corps
  // unique part vers 25 officines en copie cachée, il serait faux pour 24.
  function faitAvecNous(ctx) {
    var ca = eur(ctx.ca_annee);
    return ca ? 'ce que vous faites déjà avec nous — ' + ca + ' cette année'
              : 'ce que vous faites déjà avec nous, chiffres à l’appui';
  }
  // ⚠️ DEUX FAUTES ÉVITÉES ICI, mesurées le 19/08/2026 sur les vraies données.
  //
  // 1. On n'écrit PAS « 79 références que vous achetez sont en tension ». Le
  //    fichier ANSM est la liste des SIGNALEMENTS sur ~18 mois, pas l'état du
  //    jour : dire « sont en tension » serait faux, et un pharmacien connaît
  //    ses tensions mieux que nous. Un chiffre faux dans un mail décrédibilise
  //    tout le reste — c'est déjà la règle qui interdit d'inventer un titre
  //    dans la signature.
  //
  // 2. On mène par NOTRE stock, pas par le nombre de tensions. « Nous en avons
  //    2 en stock » est vérifiable et utile ; « vous avez 79 tensions » ne se
  //    vérifie pas et n'appelle aucune action. Sans stock à annoncer, on
  //    retombe sur la phrase générique plutôt que d'annoncer un problème sans
  //    solution.
  //
  // « à ce jour » n'est pas une précaution de style : le stock bouge, et le
  // rendez-vous est dans trois semaines. On date ce qu'on affirme.
  function tension(ctx) {
    var d = parseInt(ctx.ruptures_stock, 10) || 0;
    if (!d) return 'les références en tension que nous avons en stock';
    return 'nous avons en stock, à ce jour, ' + d + ' référence' + (d > 1 ? 's' : '') +
           ' que vous achetez et qui ' + (d > 1 ? 'figurent' : 'figure') +
           ' sur la liste de tension de l’ANSM';
  }

  // ── Les trois motifs ─────────────────────────────────────────────
  // Style choisi par Will le 12/08/2026 : le mélange des directions 3 et 4 de
  // la galerie — le ton d'un mail écrit à la main, avec trois points en puces
  // pour qu'il se lise en balayant.
  //
  // Conséquence assumée : PAS de gros bouton. C'est ce qui fait qu'un mail ne
  // ressemble pas à un mailing, et c'était le trait qui définissait la
  // direction 4. Le lien reste seul sur sa ligne, donc repérable.
  var MODELES = {
    bilan: {
      nom: 'Le bilan de son officine',
      description: 'Ses propres chiffres : ce qu’elle fait avec nous, ce qu’elle pourrait faire.',
      rendre: function (ctx) {
        var ca = eur(ctx.ca_annee);
        var corps = salut(ctx) + '\n\n' +
          'J’ai repris le détail de ce que nous faisons ensemble' +
          (ca ? ', et j’aimerais vous le montrer' : ' et j’aimerais faire le point avec vous') +
          '.\n\nTrois choses que je voudrais voir avec vous :\n\n' +
          '• ' + (ca ? 'vos chiffres de l’année — ' + ca + ' à ce jour' : 'vos chiffres de l’année, ligne par ligne') + '\n' +
          // ⚠️ Cet emplacement portait « les 12 400 € que vous pourriez
          // récupérer », alimentés par notre abandon de marge. Il est retiré :
          // le chiffrer par écrit à un pharmacien est interdit. La phrase reste,
          // sans le montant — il se montre à l'écran, en rendez-vous.
          '• ce que vous pourriez récupérer sans changer vos habitudes\n' +
          '• ' + tension(ctx) + '\n\n' +
          'Quinze minutes suffisent. Je vous laisse choisir le moment :\n' +
          txt(ctx.lien) + signature(ctx) + STOP;
        return { objet: 'Vos chiffres, ' + txt(ctx.nom_officine, 'votre officine'), corps: corps };
      }
    },
    offre: {
      nom: 'La nouveauté du moment',
      description: 'Deux lignes de votre choix, réutilisées pour toute la liste.',
      rendre: function (ctx) {
        var libre = txt(ctx.texte_libre);
        var refuse = M.texteRefuse(libre);
        if (refuse || !libre) libre = 'J’ai du nouveau à vous présenter.';
        var corps = salut(ctx) + '\n\n' + libre +
          '\n\nJe passe dans votre secteur prochainement. Trois choses à voir ensemble :\n\n' +
          '• la nouveauté en question, et ce qu’elle change pour vous\n' +
          '• ' + faitAvecNous(ctx) + '\n' +
          '• ' + tension(ctx) + '\n\n' +
          'Plutôt que de tomber au mauvais moment, je vous laisse choisir :\n' +
          txt(ctx.lien) + '\n\nÇa prend dix secondes.' + signature(ctx) + STOP;
        var out = { objet: 'Du nouveau pour ' + txt(ctx.nom_officine, 'votre officine'), corps: corps };
        if (refuse) {
          out.avertissement = 'Ton texte contenait un pourcentage : il a été retiré. ' +
            'Les conditions commerciales ne s’écrivent pas dans un mail.';
        }
        return out;
      }
    },
    routine: {
      nom: 'La visite de routine',
      description: '« Ça fait X mois qu’on ne s’est pas vus. »',
      rendre: function (ctx) {
        var m = ctx.mois_derniere_visite;
        var corps = salut(ctx) + '\n\n' +
          'Je passe dans le secteur prochainement et j’aimerais m’arrêter chez vous. ' +
          (m ? 'Cela fait ' + m + ' mois que nous ne nous sommes pas vus.'
             : 'Cela fait un moment que nous ne nous sommes pas vus.') +
          '\n\nTrois choses que je voudrais voir avec vous :\n\n' +
          '• ' + faitAvecNous(ctx) + '\n' +
          '• ' + tension(ctx) + '\n' +
          '• ce que vous pourriez récupérer sans changer vos habitudes\n\n' +
          'Plutôt que de tomber au mauvais moment, je vous laisse choisir :\n' +
          txt(ctx.lien) + '\n\nTrois créneaux vous seront proposés, ça prend dix secondes.' +
          (txt(ctx.tel_commercial)
            ? '\nEt si aucun ne vous va, appelez-moi, mon numéro est juste en dessous.'
            : '') +
          signature(ctx) + STOP;
        return { objet: 'Je passe dans votre secteur', corps: corps };
      }
    }
  };

  // ── Les mêmes motifs, pour un envoi GROUPÉ en copie cachée ───────
  // Un mail parti vers 25 officines en Cci ne peut nommer personne et ne
  // peut afficher aucun chiffre : le corps est le MÊME pour tout le lot.
  // Écrire « Bonjour Monsieur Dupont » ou « vos 12 400 € » à 25 officines
  // à la fois serait faux pour 24 d'entre elles.
  //
  // Le lien n'est pas non plus le même objet : c'est le lien PERMANENT du
  // commercial, celui qui ne connaît pas l'officine. La page publique lui
  // demande donc de se déclarer avant d'afficher le moindre créneau — on
  // le dit dans le mail, pour que le clic ne surprenne pas.
  var GROUPE = {
    bilan: function (ctx) {
      return {
        objet: 'Le point sur vos chiffres',
        corps: 'Bonjour,\n\n' +
          'J’aimerais faire le point avec vous sur ce que nous faisons ensemble.\n\n' +
          'Trois choses que je voudrais voir avec vous :\n\n' +
          '• vos chiffres de l’année, ligne par ligne\n' +
          '• ce que vous pourriez récupérer sans changer vos habitudes\n' +
          '• les références en tension que nous avons en stock\n\n' +
          'Quinze minutes suffisent. Je vous laisse choisir le moment :\n' +
          txt(ctx.lien) + '\n\n' +
          'Vous indiquez votre officine, vous choisissez l’horaire.'
      };
    },
    offre: function (ctx) {
      var libre = txt(ctx.texte_libre);
      var refuse = M.texteRefuse(libre);
      if (refuse || !libre) libre = 'J’ai du nouveau à vous présenter.';
      var out = {
        objet: 'Du nouveau chez Intégral Pharma',
        corps: 'Bonjour,\n\n' + libre + '\n\n' +
          'Je passe dans votre secteur prochainement. Trois choses à voir ensemble :\n\n' +
          '• la nouveauté en question, et ce qu’elle change pour vous\n' +
          '• ce que vous faites déjà avec nous, chiffres à l’appui\n' +
          '• les références en tension que nous avons en stock\n\n' +
          'Plutôt que de tomber au mauvais moment, je vous laisse choisir :\n' +
          txt(ctx.lien) + '\n\n' +
          'Vous indiquez votre officine, vous choisissez l’horaire.'
      };
      if (refuse) {
        out.avertissement = 'Ton texte contenait un pourcentage : il a été retiré. ' +
          'Les conditions commerciales ne s’écrivent pas dans un mail.';
      }
      return out;
    },
    routine: function (ctx) {
      return {
        objet: 'Je passe dans votre secteur',
        corps: 'Bonjour,\n\n' +
          'Je passe prochainement dans votre secteur et j’aimerais m’arrêter chez vous.\n\n' +
          'Trois choses que je voudrais voir avec vous :\n\n' +
          '• ce que vous faites déjà avec nous, chiffres à l’appui\n' +
          '• les références en tension que nous avons en stock\n' +
          '• ce que vous pourriez récupérer sans changer vos habitudes\n\n' +
          'Plutôt que de tomber au mauvais moment, je vous laisse choisir votre créneau :\n' +
          txt(ctx.lien) + '\n\n' +
          'Vous indiquez votre officine, vous choisissez l’horaire, ça prend dix secondes.' +
          (txt(ctx.tel_commercial)
            ? '\nEt si aucun créneau ne vous convient, appelez-moi, mon numéro est juste en dessous.'
            : '')
      };
    }
  };

  M.liste = function () {
    return ['bilan', 'offre', 'routine'].map(function (k) {
      return { cle: k, nom: MODELES[k].nom, description: MODELES[k].description };
    });
  };

  M.rendre = function (cle, ctx) {
    var m = MODELES[cle] || MODELES.routine;
    return m.rendre(ctx || {});
  };

  // Version groupée. Même signature, mêmes clés de motif : l'écran choisit
  // l'une ou l'autre selon le mode, sans rien savoir de leur contenu.
  M.rendreGroupe = function (cle, ctx) {
    ctx = ctx || {};
    var f = GROUPE[cle] || GROUPE.routine;
    var m = f(ctx);
    m.corps += signature(ctx) + STOP;
    return m;
  };

  // ── Version mise en forme ────────────────────────────────────────
  // Pourquoi elle existe : `mailto:` ne transporte QUE du texte brut — c'est
  // une limite du système d'exploitation, pas un choix. Le commercial copie
  // donc ce bloc et le colle dans Outlook, qui conserve la mise en forme.
  //
  // Volontairement sobre : pas d'image, pas de couleur de fond, pas de
  // colonnes. Un mail chargé tombe en indésirable et s'affiche mal sur la
  // moitié des messageries d'officine. Ce qui fait « pro », c'est la
  // typographie et l'espacement, pas la décoration.
  function h(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Le convertisseur, isolé : les deux modes (un par un, groupé) partagent
  // exactement la même mise en forme. Il prend un mail déjà rendu.
  function enHtml(m, lien) {
    var lignes = m.corps.split('\n');
    var out = [], i, l, mode = '';   // '' | 'p' | 'ul'

    function fermer() {
      if (mode === 'p') out[out.length - 1] += '</p>';
      if (mode === 'ul') out[out.length - 1] += '</ul>';
      mode = '';
    }

    for (i = 0; i < lignes.length; i++) {
      l = lignes[i];

      if (l.trim() === '') { fermer(); continue; }

      // Le filet avant la mention de désinscription.
      if (l.trim() === '—') {
        fermer();
        out.push('<hr style="border:0;border-top:1px solid #E3E8F0;margin:26px 0 14px" />');
        continue;
      }

      // Le lien, seul sur sa ligne. Volontairement PAS un bouton : c'est ce qui
      // fait qu'un mail ne ressemble pas à un mailing (direction 4, choisie par
      // Will). Il reste repérable parce qu'il est seul et coloré.
      if (lien && l.trim() === lien) {
        fermer();
        out.push('<p style="margin:16px 0"><a href="' + h(lien) + '" ' +
          'style="color:#0050E6;font-weight:600;word-break:break-all">' + h(lien) + '</a></p>');
        continue;
      }

      // Une puce.
      if (l.indexOf('• ') === 0) {
        if (mode !== 'ul') { fermer(); out.push('<ul style="margin:0 0 14px;padding-left:22px">'); mode = 'ul'; }
        out[out.length - 1] += '<li style="margin:6px 0">' + h(l.slice(2)) + '</li>';
        continue;
      }

      if (mode !== 'p') { fermer(); out.push('<p style="margin:0 0 14px">' + h(l)); mode = 'p'; }
      else { out[out.length - 1] += '<br />' + h(l); }
    }
    fermer();

    return {
      objet: m.objet,
      avertissement: m.avertissement,
      html: '<div style="font:15px/1.65 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
            'color:#10131C;max-width:560px">' + out.join('') + '</div>'
    };
  }

  M.rendreHtml = function (cle, ctx) {
    return enHtml(M.rendre(cle, ctx || {}), txt((ctx || {}).lien));
  };

  M.rendreGroupeHtml = function (cle, ctx) {
    return enHtml(M.rendreGroupe(cle, ctx || {}), txt((ctx || {}).lien));
  };

  // ── APRÈS la visite : le mot de remerciement ─────────────────────
  // Le seul mail que JARVIS proposait après un rendez-vous était… aucun. Le
  // rendez-vous restait « confirmé » à vie, et rien ne se passait entre la
  // poignée de main et la fois d'après.
  //
  // Volontairement COURT, et volontairement sans chiffre : ce qui a été
  // montré à l'écran pendant le rendez-vous ne se recopie pas dans un mail —
  // c'est justement la règle qui fait qu'on le montre à l'écran. Le seul
  // ajout possible est une phrase libre écrite par le commercial.
  M.remerciement = function (ctx) {
    ctx = ctx || {};
    var libre = txt(ctx.texte_libre).trim();
    var refuse = M.texteRefuse(libre);
    if (refuse) libre = '';
    var corps = salut(ctx) + '\n\n' +
      'Merci pour le temps que vous m’avez accordé' +
      (txt(ctx.date_visite) ? ' ' + txt(ctx.date_visite) : '') + '.' +
      (libre ? '\n\n' + libre : '') +
      '\n\nSi une question vous revient, mon numéro est juste en dessous — ' +
      'et vous pouvez reprendre un moment quand vous voulez :\n' +
      txt(ctx.lien) + signature(ctx);
    // ⚠️ PAS de mention STOP ici. Elle appartient aux mails de sollicitation.
    // La coller sous un remerciement transformerait un mot poli en publicité,
    // et c'est ce détail-là qu'un pharmacien remarque.
    var out = { objet: 'Merci pour votre accueil', corps: corps };
    if (refuse) {
      out.avertissement = 'Ton mot contenait un pourcentage : il a été retiré. ' +
        'Les conditions commerciales ne s’écrivent pas dans un mail.';
    }
    return out;
  };

  // ═══════════════════════════════════════════════════════════════
  //  MODÈLES PERSONNELS — les mots du commercial, pas les miens
  // ═══════════════════════════════════════════════════════════════
  // Les trois motifs ci-dessus sont écrits une fois pour huit personnes.
  // Celui qui n'aime pas le texte n'avait qu'une sortie : ne pas s'en servir.
  // Ici il écrit les siens, avec des étiquettes que JARVIS remplit.
  //
  // Ce qui reste imposé, et pourquoi :
  //   · la SIGNATURE est ajoutée par le moteur — elle ne contient que des
  //     faits (nom, maison, numéro), et un titre inventé décrédibilise tout ;
  //   · la mention STOP est ajoutée par le moteur — c'est une promesse écrite
  //     que le suivi honore réellement, elle ne peut pas être facultative ;
  //   · le LIEN est ajouté s'il manque — un mail d'invitation sans lien est
  //     un mail perdu, et c'est l'oubli le plus facile à faire.

  var NOMINATIVES = { officine: 1, contact: 1, ville: 1, mois: 1, ca: 1, tension: 1 };

  var ETIQUETTES = [
    { cle: 'officine', quoi: 'Le nom de l’officine',                     ex: 'Pharmacie du Marché' },
    { cle: 'contact',  quoi: 'Le nom du titulaire',                      ex: 'M. Dupont' },
    { cle: 'ville',    quoi: 'Sa ville',                                 ex: 'Angers' },
    { cle: 'mois',     quoi: 'Le temps depuis ta dernière visite',       ex: '7 mois' },
    { cle: 'ca',       quoi: 'Ce qu’elle fait avec nous cette année',    ex: '12 400 € cette année' },
    { cle: 'tension',  quoi: 'Ses références en tension, et notre stock', ex: '3 références que vous achetez sont en tension — nous en avons 2 en stock à ce jour' },
    { cle: 'prenom',   quoi: 'Ton prénom',                               ex: 'William' },
    { cle: 'tel',      quoi: 'Ton téléphone',                            ex: '06 12 34 56 78' },
    { cle: 'lien',     quoi: 'Le lien de réservation (obligatoire)',     ex: 'le lien vers tes créneaux' }
  ];
  M.ETIQUETTES = ETIQUETTES;
  M.etiquetteNominative = function (cle) { return !!NOMINATIVES[cle]; };

  var MOTIF_ETIQ = /\{\{\s*([a-z_]+)\s*\}\}/g;

  // Quelles étiquettes un texte contient réellement. Sert deux fois : à
  // prévenir l'auteur, et à refuser un envoi groupé qui mentirait.
  M.persoEtiquettes = function (texte) {
    var vues = {}, out = [], m;
    MOTIF_ETIQ.lastIndex = 0;
    while ((m = MOTIF_ETIQ.exec(String(texte || '')))) {
      if (!vues[m[1]]) { vues[m[1]] = 1; out.push(m[1]); }
    }
    return out;
  };

  function valeurs(ctx) {
    var mois = parseInt(ctx.mois_derniere_visite, 10);
    return {
      officine: txt(ctx.nom_officine, 'votre officine'),
      contact:  txt(ctx.contact),
      ville:    txt(ctx.ville),
      mois:     (mois > 0) ? (mois + ' mois') : 'un moment',
      // ⚠️ La valeur porte « cette année » AVEC elle. Sinon un modèle écrit
      // « — {{ca}} cette année » produit « — cette année » sur une officine
      // sans chiffre : une phrase amputée, envoyée à un vrai pharmacien.
      // Même famille que « Bonjour , » — une étiquette vide ne doit jamais
      // laisser derrière elle les mots qui l'entouraient.
      ca:       eur(ctx.ca_annee) ? (eur(ctx.ca_annee) + ' cette année') : '',
      tension:  tension(ctx),
      prenom:   txt(ctx.prenom_commercial),
      tel:      txt(ctx.tel_commercial),
      lien:     txt(ctx.lien)
    };
  }

  // Une étiquette vide laisse « Bonjour , » ou « —  cette année ». On répare
  // la ponctuation orpheline plutôt que d'obliger l'auteur à y penser :
  // l'officine sans titulaire connu est le cas le plus courant, pas l'exception.
  function nettoyer(t) {
    return String(t || '')
      .replace(/[ \t]+/g, ' ')
      // ⚠️ UNIQUEMENT la virgule et le point. En français « : ; ! ? » prennent
      // une espace AVANT — la première version les collait, et sortait
      // « Trois choses que je voudrais voir avec vous: » dans un mail signé.
      .replace(/ ([,.])/g, '$1')
      // Un tiret en fin de ligne, laissé par une étiquette vide :
      // « ce que vous faites avec nous — ».
      // ⚠️ PAS les deux-points : « Trois choses que je voudrais voir avec
      // vous : » finit légitimement une ligne, juste avant les puces. La
      // première version les effaçait aussi, et décapitait la phrase.
      .replace(/[ \t]*[—–-][ \t]*$/gm, '')
      // Une puce devenue vide.
      .replace(/^[ \t]*[•\-—][ \t]*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }

  M.persoValider = function (mod) {
    mod = mod || {};
    var erreurs = [], avert = [];
    var nom = txt(mod.nom).trim();
    var objet = txt(mod.objet).trim();
    var corps = txt(mod.corps).trim();
    if (nom.length < 2)   erreurs.push('Donne un nom à ton modèle.');
    if (objet.length < 3) erreurs.push('L’objet du mail est vide.');
    if (corps.length < 20) erreurs.push('Le message est trop court.');
    if (M.texteRefuse(objet) || M.texteRefuse(corps)) {
      erreurs.push('Ton texte contient un pourcentage. Une condition commerciale ' +
                   'chiffrée ne s’écrit pas dans un mail — elle se montre en rendez-vous.');
    }
    var connues = {}, i;
    for (i = 0; i < ETIQUETTES.length; i++) connues[ETIQUETTES[i].cle] = 1;
    var utilisees = M.persoEtiquettes(objet + '\n' + corps);
    var inconnues = utilisees.filter(function (e) { return !connues[e]; });
    if (inconnues.length) {
      erreurs.push('Étiquette' + (inconnues.length > 1 ? 's' : '') + ' inconnue' +
        (inconnues.length > 1 ? 's' : '') + ' : {{' + inconnues.join('}}, {{') + '}}.');
    }
    if (utilisees.indexOf('lien') === -1) {
      avert.push('Tu n’as pas mis {{lien}} : je l’ajouterai à la fin, seul sur sa ligne.');
    }
    var nomin = utilisees.filter(function (e) { return NOMINATIVES[e]; });
    if (nomin.length) {
      avert.push('Ce modèle nomme ou chiffre l’officine ({{' + nomin.join('}}, {{') +
        '}}) : il ne pourra pas servir en envoi groupé, où un seul texte part vers 25 officines.');
    }
    return { ok: !erreurs.length, erreurs: erreurs, avertissements: avert, nominatives: nomin };
  };

  /**
   * Rend un modèle personnel. `opts.groupe` = envoi en copie cachée.
   * @returns {objet, corps} — ou {refus:'nominatif', etiquettes:[…]} en
   *          groupé quand le texte nomme ou chiffre l'officine.
   */
  M.rendrePerso = function (mod, ctx, opts) {
    mod = mod || {}; ctx = ctx || {}; opts = opts || {};
    var objet = txt(mod.objet), corps = txt(mod.corps);

    if (opts.groupe) {
      // ⚠️ On REFUSE plutôt qu'on ne neutralise. Remplacer {{officine}} par
      // « votre officine » produirait un texte lisible mais faux d'intention,
      // et {{ca}} vide laisserait « — cette année » pendu au bout d'une puce.
      // Le mauvais cas doit rester le cas inoffensif : ici, ne rien envoyer.
      var n = M.persoEtiquettes(objet + '\n' + corps)
                .filter(function (e) { return NOMINATIVES[e]; });
      if (n.length) return { refus: 'nominatif', etiquettes: n };
    }

    var v = valeurs(ctx);
    function remplir(t) {
      return String(t || '').replace(MOTIF_ETIQ, function (tout, cle) {
        return Object.prototype.hasOwnProperty.call(v, cle) ? v[cle] : tout;
      });
    }
    objet = nettoyer(remplir(objet)).replace(/\n+/g, ' ');
    corps = nettoyer(remplir(corps));

    var lien = txt(ctx.lien);
    if (lien && corps.indexOf(lien) === -1) corps += '\n\n' + lien;

    var out = { objet: objet, corps: corps + signature(ctx) + STOP };
    if (M.texteRefuse(corps) || M.texteRefuse(objet)) {
      // Un modèle enregistré avant ce garde-fou, ou un chiffre arrivé par une
      // étiquette : on prévient, on n'envoie pas en silence.
      out.avertissement = 'Ce mail contient un pourcentage. Retire-le avant d’envoyer : ' +
        'les conditions commerciales ne s’écrivent pas.';
    }
    return out;
  };

  M.rendrePersoHtml = function (mod, ctx, opts) {
    var m = M.rendrePerso(mod, ctx, opts);
    if (m.refus) return m;
    return enHtml(m, txt((ctx || {}).lien));
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2MOD = M;
})(typeof window !== 'undefined' ? window : this);

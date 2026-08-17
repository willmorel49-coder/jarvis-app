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
        var ca = eur(ctx.ca_annee), mq = eur(ctx.manque_a_gagne);
        var corps = salut(ctx) + '\n\n' +
          'J’ai repris le détail de ce que nous faisons ensemble' +
          (ca ? ', et j’aimerais vous le montrer' : ' et j’aimerais faire le point avec vous') +
          '.\n\nTrois choses que je voudrais voir avec vous :\n\n' +
          '• ' + (ca ? 'vos chiffres de l’année — ' + ca + ' à ce jour' : 'vos chiffres de l’année, ligne par ligne') + '\n' +
          '• ' + (mq ? 'les ' + mq + ' que vous pourriez récupérer sans changer vos habitudes'
                     : 'ce que vous pourriez récupérer sans changer vos habitudes') + '\n' +
          '• les références en tension que nous avons en stock\n\n' +
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
          '• ce que vous faites déjà avec nous, chiffres à l’appui\n' +
          '• les références en tension que nous avons en stock\n\n' +
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
          '• ce que vous faites déjà avec nous, chiffres à l’appui\n' +
          '• les références en tension que nous avons en stock\n' +
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

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2MOD = M;
})(typeof window !== 'undefined' ? window : this);

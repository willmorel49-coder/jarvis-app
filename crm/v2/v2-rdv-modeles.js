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

  var STOP = '\n\n—\nVous ne souhaitez plus recevoir ces propositions ? Répondez simplement STOP\nà ce message, et nous ne vous écrirons plus.';
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

  var MODELES = {
    bilan: {
      nom: 'Le bilan de son officine',
      description: 'Ses propres chiffres : ce qu’elle fait avec nous, ce qu’elle pourrait faire.',
      rendre: function (ctx) {
        var ca = eur(ctx.ca_annee), mq = eur(ctx.manque_a_gagne);
        var corps = salut(ctx) + '\n\n' +
          'J’ai repris le détail de ce que nous faisons ensemble' +
          (ca ? ' : ' + ca + ' cette année' : '') + '.' +
          (mq ? '\n\nEn regardant votre potentiel, je vois de la place pour aller chercher ' + mq +
                ' de plus, sans rien changer à vos habitudes de commande.'
              : '\n\nEn regardant votre potentiel, je vois de la place pour aller plus loin.') +
          '\n\nJe vous montre ça en quinze minutes ? Choisissez le moment qui vous arrange :\n' +
          txt(ctx.lien) + signature(ctx) + STOP;
        return { objet: 'Votre bilan · ' + txt(ctx.nom_officine, 'votre officine'), corps: corps };
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
          '\n\nJe passe prochainement dans votre secteur — dites-moi quand vous êtes disponible :\n' +
          txt(ctx.lien) + '\n\nÇa prend dix secondes.' + signature(ctx) + STOP;
        var out = { objet: 'Une nouveauté pour ' + txt(ctx.nom_officine, 'votre officine'), corps: corps };
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
          (m ? 'Cela fait ' + m + ' mois que nous ne nous sommes pas vus, et j’aimerais faire le point avec vous.'
             : 'J’aimerais faire le point avec vous.') +
          '\n\nPlutôt que de vous appeler en plein rush, choisissez vous-même le moment :\n' +
          txt(ctx.lien) + '\n\nTrois créneaux vous seront proposés.' + signature(ctx) + STOP;
        return { objet: 'Un moment pour se voir ?', corps: corps };
      }
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

  M.rendreHtml = function (cle, ctx) {
    var m = M.rendre(cle, ctx || {});
    var lien = txt((ctx || {}).lien);
    var lignes = m.corps.split('\n');
    var out = [], i, l, dans = false;

    // Le lien devient un vrai bouton ; le reste garde ses paragraphes.
    for (i = 0; i < lignes.length; i++) {
      l = lignes[i];
      if (lien && l.trim() === lien) {
        out.push('<p style="margin:22px 0"><a href="' + h(lien) + '" ' +
          'style="display:inline-block;padding:13px 22px;background:#0050E6;color:#ffffff;' +
          'text-decoration:none;border-radius:8px;font-weight:700">Choisir un créneau</a></p>');
        dans = false;
        continue;
      }
      if (l.trim() === '') { dans = false; continue; }
      if (l.trim() === '—') { out.push('<hr style="border:0;border-top:1px solid #E3E8F0;margin:26px 0 14px" />'); dans = false; continue; }
      if (!dans) { out.push('<p style="margin:0 0 14px">' + h(l)); dans = true; }
      else { out[out.length - 1] += '<br />' + h(l); }
    }
    for (i = 0; i < out.length; i++) {
      if (out[i].indexOf('<p') === 0 && out[i].indexOf('</p>') < 0) out[i] += '</p>';
    }

    return {
      objet: m.objet,
      avertissement: m.avertissement,
      html: '<div style="font:15px/1.65 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
            'color:#10131C;max-width:560px">' + out.join('') + '</div>'
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2MOD = M;
})(typeof window !== 'undefined' ? window : this);

/* PHIRST · logique PURE de l'écran « Encaisser » (24/11/2026) : aucune lecture de la page ni de la base, donc testable
   (tests/phirst-encaisser.test.mjs). L'écran (phirst-encaisser.js) ne fait que l'affichage et les écritures.
   D'après la maquette V2 validée par Will le 24/11 (R-encaisser-maquette), règles reprises TELLES QUELLES de l'ancienne version
   (phirst-studio lib/argent.ts et lib/relance.ts) :
   - Yann RECOPIE le montant hors taxes de sa facture ou de son devis ; la facture reste dans son logiciel ;
   - dû = acomptes, soldes et autres sommes non reçus (le devis n'est pas une somme due) ;
   - en retard = échéance passée ; devis sans réponse = envoyé il y a 10 jours ou plus ;
   - le message est déjà écrit, son ton suit le retard ; il part du Mail ou du téléphone de Yann (mailto: / sms:), l'app n'envoie rien ;
   - une relance notée « repose » 7 jours.
   Nouveau dans la V2 : chaque somme est rattachée à un VOLET du dossier (Agencement, Transfert, Riedl, PDA : la pharmacie paie Yann
   pour les quatre), et le message nomme ce projet. « Deuxième relance / Malgré mon précédent message » SEULEMENT si une relance a
   vraiment été notée avant (l'ancienne version l'écrivait dès 30 jours de retard). La signature se lit dans le réglage de la marque. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.PHIRST_ENCAISSER_PUR = fabrique();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var NB = ' ', NNB = ' ';
  var TYPES = { devis: 'Devis', acompte: 'Acompte', solde: 'Solde', autre: 'Autre somme' };
  var ORDRE_TYPES = ['devis', 'acompte', 'solde', 'autre'];
  var VOLETS = { transfert: 'Transfert', agencement: 'Agencement', riedl: 'Robotique Riedl', pda: 'Robotique PDA' };
  var DEVIS_APRES = 10, REPOS = 7, MAX_LIB = 80, MAX_MONTANT = 10000000;
  var MC = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var JS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var ML = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  /* ── dates (jours AAAA-MM-JJ, calculés en UTC pour ne jamais glisser d'un jour) ── */
  function estJour(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(J(String(s))); }
  function jourDe(s) { var t = String(s == null ? '' : s).slice(0, 10); return estJour(t) ? t : null; }
  function J(s) { var p = s.split('-'); var d = Date.UTC(+p[0], +p[1] - 1, +p[2]); var x = new Date(d); return x.getUTCMonth() === +p[1] - 1 ? d : NaN; }
  function jours(a, b) { return Math.round((J(b) - J(a)) / 86400000); }
  function decaler(s, n) { var d = new Date(J(s) + n * 86400000); return d.toISOString().slice(0, 10); }
  function num(j) { return +j === 1 ? '1er' : String(+j); }
  /* « 15 oct. » (l'année seulement si ce n'est pas celle d'aujourd'hui) */
  function court(s, auj) { var p = s.split('-'); return num(p[2]) + ' ' + MC[+p[1] - 1] + (p[0] !== String(auj).slice(0, 4) ? ' ' + p[0] : ''); }
  /* « 15 octobre » dans le message */
  function dateMsg(s, auj) { var p = s.split('-'); return num(p[2]) + ' ' + ML[+p[1] - 1] + (p[0] !== String(auj).slice(0, 4) ? ' ' + p[0] : ''); }
  function longJour(s) { var p = s.split('-'); return JS[new Date(J(s)).getUTCDay()] + ' ' + num(p[2]) + ' ' + ML[+p[1] - 1] + ' ' + p[0]; }

  /* ── textes ── */
  function eur(n) {
    var e = Math.round(Number(n) * 100) / 100, ent = Math.floor(e), c = Math.round((e - ent) * 100);
    return ent.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NNB) + (c ? ',' + ('0' + c).slice(-2) : '') + NB + '€';
  }
  function pl(n, m) { return n + ' ' + m + (n > 1 ? 's' : ''); }
  function maj(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
  function point(t) { return /\.$/.test(t) ? t : t + '.'; }
  function nomCourt(nom) { return String(nom || '').replace(/^Pharmacie (de la |de l’|de l'|du |des |de )?/, ''); }
  function laPh(nom) { return 'la ' + String(nom || 'pharmacie'); }
  function offre(sorte) { return sorte === 'riedl' || sorte === 'pda'; }

  /* ── les lignes de la base → les lignes de l'écran ── */
  function lireMontantBase(v) { var n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function ligneDe(r) {
    return {
      id: r.id, volet: r.volet_id, type: TYPES[r.type] ? r.type : 'autre', libelle: String(r.libelle || '').trim(),
      montant: lireMontantBase(r.montant), envoyeLe: jourDe(r.envoye_le), echeance: jourDe(r.echeance), faitLe: jourDe(r.fait_le)
    };
  }
  /* La dernière relance de chaque somme : { id de la somme : { jour, canal } } (le jour le plus récent ; à jour égal, la dernière notée). */
  function dernieres(relances) {
    var d = {};
    (relances || []).forEach(function (r) {
      var j = jourDe(r.jour); if (!j || !r.somme_id) return;
      var x = d[r.somme_id];
      if (!x || j > x.jour || (j === x.jour && String(r.created_at || '') >= String(x.at || ''))) d[r.somme_id] = { jour: j, canal: r.canal === 'sms' ? 'sms' : 'mail', at: r.created_at || '' };
    });
    return d;
  }

  /* ── règles de l'ancienne version (lib/argent.ts) ── */
  function attentes(lignes, auj, dern) {
    var out = [];
    (lignes || []).forEach(function (l) {
      if (l.faitLe) return;
      var r = (dern && dern[l.id]) || null;
      if (l.type === 'devis') { if (l.envoyeLe && jours(l.envoyeLe, auj) >= DEVIS_APRES) out.push({ l: l, etat: 'sans_reponse', j: jours(l.envoyeLe, auj), r: r }); return; }
      if (l.echeance && l.echeance < auj) out.push({ l: l, etat: 'retard', j: jours(l.echeance, auj), r: r });
      else out.push({ l: l, etat: 'attendu', j: l.echeance ? jours(auj, l.echeance) : 0, r: r });
    });
    return out;
  }
  function recente(a, auj) { return !!(a && a.r) && jours(a.r.jour, auj) < REPOS; }
  function arrondi(n) { return Math.round(n * 100) / 100; }
  function du(lignes) { return arrondi((lignes || []).filter(function (l) { return l.type !== 'devis' && !l.faitLe; }).reduce(function (s, l) { return s + l.montant; }, 0)); }
  function enRetard(liste) { return arrondi((liste || []).filter(function (a) { return a.etat === 'retard'; }).reduce(function (s, a) { return s + a.l.montant; }, 0)); }
  /* Les relances : retards et devis sans réponse ; celles qui « reposent » (relancées il y a moins de 7 jours) en dernier, puis le plus ancien d'abord. */
  function relances(liste, auj) {
    return (liste || []).filter(function (a) { return a.etat !== 'attendu'; })
      .sort(function (x, y) { return ((recente(x, auj) ? 1 : 0) - (recente(y, auj) ? 1 : 0)) || (y.j - x.j); });
  }
  function aFaire(rel, auj) { return (rel || []).filter(function (a) { return !recente(a, auj); }); }
  function bientot(liste) {
    return (liste || []).filter(function (a) { return a.etat === 'attendu'; })
      .sort(function (x, y) { var a = x.l.echeance || '9999-99-99', b = y.l.echeance || '9999-99-99'; return a < b ? -1 : a > b ? 1 : 0; });
  }
  /* Le journal de la semaine : les relances notées ces 7 derniers jours, la plus récente d'abord. */
  function notees(rels, auj) {
    return (rels || []).filter(function (r) { var j = jourDe(r.jour); return j && jours(j, auj) >= 0 && jours(j, auj) < REPOS; })
      .sort(function (a, b) { var x = String(a.jour) + String(a.created_at || ''), y = String(b.jour) + String(b.created_at || ''); return x < y ? 1 : x > y ? -1 : 0; });
  }

  /* ── le message (lib/relance.ts), le projet nommé d'après le volet ── */
  var PROJET = { agencement: 'l’agencement', transfert: 'le transfert', riedl: 'le robot Riedl', pda: 'la machine de préparation des doses' };
  var PROJET_DE = { agencement: 'd’agencement', transfert: 'de transfert', riedl: 'de robot Riedl', pda: 'de préparation des doses' };
  function article(m) { return /^[aeiouyhàâéèêëîïôûü]/i.test(m) ? 'l’' + m : 'le ' + m; }
  function bonjour(titulaire) {
    var t = String(titulaire || '').replace(/\s+/g, ' ').trim();
    return t ? 'Bonjour ' + t.replace(/^Mme\.? /, 'Madame ').replace(/^M\. /, 'Monsieur ') + ',' : 'Bonjour,';
  }
  /* La signature : lue dans le réglage de la marque (phirst_marque), jamais écrite ici. Vide si le réglage n'a pas pu être lu. */
  function signature(m) {
    if (!m || typeof m !== 'object') return '';
    var l1 = String(m.interlocuteur || '').trim(), l2 = [String(m.marque || '').trim(), String(m.tel || '').trim()].filter(Boolean).join(' · ');
    return [l1, l2].filter(Boolean).join('\n');
  }
  /* a = une attente ; ph = { nom, titulaire } ; sorte = celle du volet de la somme ; sig = signature(marque). */
  function message(a, ph, sorte, sig, auj) {
    var l = a.l, nom = ph && ph.nom || 'Pharmacie', fin = '\n\nBien cordialement,' + (sig ? '\n' + sig : ''), m = eur(l.montant) + ' HT';
    var so = PROJET[sorte] ? sorte : 'agencement', b = bonjour(ph && ph.titulaire);
    if (a.etat === 'sans_reponse') {
      var o = offre(so);
      return { objet: 'Votre projet ' + PROJET_DE[so] + ' — ' + nom,
        texte: b + '\n\nJe reviens vers vous au sujet ' + (o ? 'de l’offre pour ' + PROJET[so] : 'du devis ' + PROJET_DE[so]) + ' de ' + laPh(nom) +
          (l.envoyeLe ? ', envoy' + (o ? 'ée' : 'é') + ' le ' + dateMsg(l.envoyeLe, auj) : '') + '. Avez-vous pu ' + (o ? 'la' : 'le') + ' regarder ?\n\n' +
          (o ? 'Je peux passer vous la présenter, ou ajuster ce qui doit l’être, si cela vous aide à décider.' : 'Je peux passer vous présenter les dernières vues 3D, ou ajuster ce qui doit l’être, si cela vous aide à décider.') + fin };
    }
    var mot = { acompte: 'acompte', solde: 'solde', autre: 'règlement' }[l.type] || 'règlement', lib = String(l.libelle || '').trim();
    var quoi = lib && lib.toLowerCase() !== mot ? article(lib.charAt(0).toLowerCase() + lib.slice(1)) + ', soit ' + m + ',' : article(mot) + ' de ' + m;
    var ech = l.echeance ? ', attendu le ' + dateMsg(l.echeance, auj) + ',' : '', pour = ' pour ' + PROJET[so] + ' de ' + laPh(nom);
    if (a.r) return { objet: 'Deuxième relance — ' + nom, texte: b + '\n\nMalgré mon précédent message, ' + quoi + pour + ech + ' reste à régler, soit ' + a.j + ' jours de retard.\n\nMerci de procéder au règlement dans les meilleurs délais, ou de m’appeler si un point bloque.' + fin };
    if (a.j > 7) return { objet: 'Règlement en attente — ' + nom, texte: b + '\n\nSauf erreur de ma part, ' + quoi + pour + ech + ' ne nous est pas encore parvenu.\n\nPourriez-vous me dire où en est le règlement ?' + fin };
    return { objet: 'Petit rappel — ' + nom, texte: b + '\n\nUn petit rappel : ' + quoi + pour + ech + ' ne nous est pas encore parvenu. Il s’est peut-être croisé avec ce message.' + fin };
  }
  /* Une seule adresse simple, sinon rien : une adresse notée « x@y.fr?cc=… » ne doit pas ajouter de destinataire au brouillon (relecture de sécurité du 24/11). */
  function adresseMail(m) { var t = String(m || '').trim(); return /^[^\s@?&,;%:\/<>"'=#]+@[^\s@?&,;%:\/<>"'=#]+\.[^\s@?&,;%:\/<>"'=#]+$/.test(t) ? t : ''; }
  function lienMail(mail, objet, texte) { return 'mailto:' + adresseMail(mail) + '?subject=' + encodeURIComponent(objet) + '&body=' + encodeURIComponent(texte); }
  function telSms(tel) { var t = String(tel || '').replace(/[^\d+]/g, ''); return t.replace(/\D/g, '').length >= 10 ? t : ''; }
  /* « 0297767802 » → « 02 97 76 78 02 » (espaces insécables : le numéro ne se coupe pas) ; un numéro d'une autre forme reste tel quel. */
  function telLisible(tel) {
    var t = String(tel || '').trim(), d = t.replace(/\D/g, '');
    if (/^0\d{9}$/.test(d)) return d.replace(/(\d{2})(?=\d)/g, '$1' + NB);
    if (/^\+33/.test(t) && /^33\d{9}$/.test(d)) return '+33' + NB + d.charAt(2) + NB + d.slice(3).replace(/(\d{2})(?=\d)/g, '$1' + NB);
    return t;
  }
  function lienSms(tel, texte) { return 'sms:' + telSms(tel) + '?&body=' + encodeURIComponent(texte); }

  /* ── les phrases de l'écran ── */
  function quoiCourt(l) { return l.libelle || (l.type === 'devis' ? 'devis envoyé' : TYPES[l.type].toLowerCase()); }
  function etiquette(a, auj) {
    if (recente(a, auj)) return { ton: '', texte: 'Relancé le ' + court(a.r.jour, auj) };
    return a.etat === 'retard' ? { ton: 'rouge', texte: 'En retard · ' + pl(a.j, 'jour') } : { ton: 'orange', texte: 'Sans réponse · ' + pl(a.j, 'jour') };
  }
  function phraseBande(nbLignes, rel, auj) {
    var af = aFaire(rel, auj).length;
    return !nbLignes ? 'Quand vous envoyez un devis, un acompte ou un solde depuis votre logiciel, recopiez ici son montant hors taxes : l’app suit ce qui est attendu et prépare la relance.'
      : af ? pl(af, 'relance') + ' à faire. Chaque message est déjà écrit : il part de votre Mail ou de votre téléphone, l’app n’envoie rien elle-même.'
      : rel.length ? 'Tout est relancé cette semaine. Notez chaque paiement dès qu’il arrive.' : 'Personne n’est en retard. Notez chaque paiement dès qu’il arrive.';
  }
  /* La phrase sous le montant de la relance du moment. */
  function phraseRelance(a, sorte, auj) {
    var l = a.l;
    var avant = a.r ? ' Déjà relancé le ' + court(a.r.jour, auj) + ' par ' + (a.r.canal === 'sms' ? 'SMS' : 'Mail') + ' : ce message est plus net.' : ' Le message est déjà écrit.';
    return a.etat === 'retard' ? point(maj(quoiCourt(l)) + ' attendu depuis ' + pl(a.j, 'jour') + (l.echeance ? ', le ' + court(l.echeance, auj) : '')) + avant
      : maj(l.libelle || (offre(sorte) ? 'offre' : 'devis')) + ' envoyé' + (offre(sorte) ? 'e' : '') + ' il y a ' + pl(a.j, 'jour') + ', sans réponse.' + avant;   // sans précision : « Devis envoyé il y a… » (la maquette doublait « envoyé »)
  }
  function detailLigne(l, auj) {
    if (l.faitLe) return (l.type === 'devis' ? 'Accepté' : 'Reçu') + ' le ' + court(l.faitLe, auj);
    var x = [];
    if (l.envoyeLe) x.push('envoyé le ' + court(l.envoyeLe, auj));
    if (l.echeance && l.type !== 'devis') x.push(l.echeance < auj ? 'attendu depuis le ' + court(l.echeance, auj) : 'à payer le ' + court(l.echeance, auj));
    return x.join(' · ') || 'en attente';
  }
  /* Le résumé d'un dossier dans « Les sommes, dossier par dossier ». sortes = celles de ses volets. */
  function resteDossier(lignes, sortes) {
    var ls = lignes || [], reste = du(ls), devis = ls.some(function (l) { return l.type === 'devis' && !l.faitLe; });
    if (!ls.length) return { zero: false, texte: 'aucune somme notée' };
    if (reste) return { zero: false, texte: 'reste ' + eur(reste) + ' HT' };
    if (devis) return { zero: false, texte: (sortes || []).some(offre) ? 'offre en attente de réponse' : 'devis en attente de réponse' };
    return { zero: true, texte: 'rien n’est dû' };
  }

  /* ── la feuille « Noter une somme » ── */
  function lireMontant(s) {
    var t = String(s == null ? '' : s).replace(/[\s  €]/g, '');
    if (!/^\d+([.,]\d{1,2})?$/.test(t)) return NaN;
    return Math.round(parseFloat(t.replace(',', '.')) * 100) / 100;
  }
  /* saisie = { dossier, volet, type, montant, libelle, envoyeLe, echeance } → { ok, champ, erreur } ou { ok, valeur } (prête pour la base). */
  function verifier(s) {
    s = s || {};
    if (!s.dossier) return { ok: false, champ: 'ph', erreur: 'Choisissez la pharmacie.' };
    if (!s.volet) return { ok: false, champ: 'volet', erreur: 'Choisissez le projet de cette pharmacie.' };
    var type = TYPES[s.type] ? s.type : null; if (!type) return { ok: false, champ: 'type', erreur: 'Choisissez ce que c’est.' };
    var v = lireMontant(s.montant);
    if (!(v > 0)) return { ok: false, champ: 'montant', erreur: 'Écrivez le montant hors taxes, par exemple 12 600.' };
    if (v > MAX_MONTANT) return { ok: false, champ: 'montant', erreur: 'Ce montant semble trop grand : vérifiez-le.' };
    var env = s.envoyeLe ? jourDe(s.envoyeLe) : null, ech = type === 'devis' ? null : (s.echeance ? jourDe(s.echeance) : null);
    if (s.envoyeLe && !env) return { ok: false, champ: 'env', erreur: 'Cette date d’envoi ne semble pas juste.' };
    if (type !== 'devis' && s.echeance && !ech) return { ok: false, champ: 'ech', erreur: 'Cette date de paiement ne semble pas juste.' };
    return { ok: true, valeur: { volet_id: s.volet, type: type, libelle: String(s.libelle || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LIB), montant: v, envoye_le: env, echeance: ech } };
  }
  function aideType(type) {
    return type === 'devis' ? 'Un devis n’est pas une somme due : il compte quand il est accepté. Sans réponse dix jours après son envoi, l’app propose de relancer.'
      : 'Passé la date « À payer le », la somme passe en retard et sa relance s’écrit toute seule.';
  }

  return {
    NB: NB, NNB: NNB, TYPES: TYPES, ORDRE_TYPES: ORDRE_TYPES, VOLETS: VOLETS, DEVIS_APRES: DEVIS_APRES, REPOS: REPOS, MAX_LIB: MAX_LIB, MAX_MONTANT: MAX_MONTANT,
    estJour: estJour, jourDe: jourDe, jours: jours, decaler: decaler, court: court, dateMsg: dateMsg, longJour: longJour,
    eur: eur, pl: pl, maj: maj, nomCourt: nomCourt, laPh: laPh, offre: offre,
    ligneDe: ligneDe, dernieres: dernieres, attentes: attentes, recente: recente, du: du, enRetard: enRetard, relances: relances, aFaire: aFaire,
    bientot: bientot, notees: notees, bonjour: bonjour, signature: signature, message: message, adresseMail: adresseMail, lienMail: lienMail, telSms: telSms, telLisible: telLisible, lienSms: lienSms,
    quoiCourt: quoiCourt, etiquette: etiquette, phraseBande: phraseBande, phraseRelance: phraseRelance, detailLigne: detailLigne, resteDossier: resteDossier,
    lireMontant: lireMontant, verifier: verifier, aideType: aideType
  };
});

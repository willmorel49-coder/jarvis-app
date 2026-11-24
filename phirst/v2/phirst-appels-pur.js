/* PHIRST · logique PURE du lot L2 d'Appels (24/11/2026) : aucune lecture de la page ni de la base, donc testable (tests/phirst-appels-l2.test.mjs).
   Trois idées, d'après la maquette 1-appels (Z-idees) :
   3. « Le bon moment » : l'heure où chaque pharmacie décroche d'habitude, APPRISE du journal des appels (heure de Paris des appels où quelqu'un
      a répondu, contre « Injoignable »). Rien d'appris pour une pharmacie = elle garde son rang.
   4. « Le relais par écrit » : après le 2e « Injoignable » de suite (compté dans le journal) ou la réponse « Envoyez-moi une documentation »,
      un mail à la place du téléphone. Le texte est celui de Yann (clé `mail_lettre`, phirst-textes-pur.js) ; le lien et la signature se lisent
      en base (phirst_marque_publique), jamais ici. « Lettre envoyée » = une note au journal de la piste.
   5. « Les cinq questions » : les réponses structurées (`questions`), leurs lignes lisibles (`questions_lignes`) et le titre du rendez-vous
      (qui devient son « objet »). Ce format est celui lu par la page « La veille du rendez-vous » (lot L3). */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./phirst-pur.js'), function () { return require('./phirst-encaisser-pur.js'); });
  else racine.PHIRST_APPELS_PUR = fabrique(racine.PHIRST_PUR, function () { return racine.PHIRST_ENCAISSER_PUR; });
})(typeof window !== 'undefined' ? window : this, function (P, encaisser) {
  'use strict';

  /* ── 3. Le bon moment ── */
  var MIN_APPELS = 2;      // il faut au moins deux appels notés sur la pharmacie pour parler d'habitude
  var MARGE_HEURES = 1;    // « vers 14 h » : de 13 h à 15 h on est dans le bon moment

  /* Ce que dit une ligne d'appel du journal : 'injoignable' (personne), 'repondu' (quelqu'un a décroché) ou 'autre' (barrage, mauvais numéro, illisible).
     Les deux écritures existent : le texte de logCall (« Appel passé — injoignable ») et le JSON de la V1 ({ resultat }). */
  function resultatAppel(corps) {
    var b = String(corps == null ? '' : corps).trim();
    if (b.charAt(0) === '{') {
      var o = null; try { o = JSON.parse(b); } catch (e) { o = null; }
      var r = o && o.resultat;
      if (r === 'injoignable') return 'injoignable';
      return r === 'rdv' || r === 'rappeler' || r === 'pas_interesse' ? 'repondu' : 'autre';
    }
    var m = /^Appel passé — (.*?)(?: — |$)/.exec(b); if (!m) return 'autre';
    var t = P.norm(m[1]);
    if (t.indexOf('injoignable') === 0) return 'injoignable';
    return t.indexOf('rdv obtenu') === 0 || t.indexOf('a rappeler') === 0 || t.indexOf('pas interesse') === 0 ? 'repondu' : 'autre';
  }
  /* L'heure (0-23) à Paris d'un horodatage. -1 s'il est illisible. */
  function heureParis(iso) {
    var t = Date.parse(iso); if (!isFinite(t)) return -1;
    return Number(P.maintenantParis(new Date(t)).slice(11, 13));
  }
  /* Les lignes d'appel d'une pharmacie, de la plus ancienne à la plus récente : [{ res, h, t }]. */
  function appelsDe(journal, prospectId) {
    return (Array.isArray(journal) ? journal : []).filter(function (a) { return a && a.type === 'appel' && a.prospect_id === prospectId && isFinite(Date.parse(a.created_at)); })
      .map(function (a) { return { res: resultatAppel(a.body), h: heureParis(a.created_at), t: Date.parse(a.created_at) }; })
      .sort(function (x, y) { return x.t - y.t; });
  }
  /* L'heure habituelle de chaque pharmacie : { prospectId: { h, repondus, appels } }. Une pharmacie n'y figure que si on a assez d'appels
     (MIN_APPELS) ET que, à une heure donnée, elle a plus répondu qu'elle n'a été injoignable. L'heure retenue est la mieux notée
     (à égalité : la plus récente en dernier appel, donc celle que le journal confirme encore). */
  function habitudes(journal) {
    var ids = {}, out = {};
    (Array.isArray(journal) ? journal : []).forEach(function (a) { if (a && a.type === 'appel' && a.prospect_id) ids[a.prospect_id] = true; });
    Object.keys(ids).forEach(function (id) {
      var ap = appelsDe(journal, id).filter(function (x) { return x.h >= 0; });
      if (ap.length < MIN_APPELS) return;
      var net = {}, last = {}, rep = {};
      ap.forEach(function (x) {
        if (x.res === 'repondu') { net[x.h] = (net[x.h] || 0) + 1; rep[x.h] = (rep[x.h] || 0) + 1; last[x.h] = x.t; }
        else if (x.res === 'injoignable') net[x.h] = (net[x.h] || 0) - 1;
      });
      var best = -1;
      Object.keys(net).forEach(function (h) {
        if (!rep[h] || net[h] < 1) return;
        if (best < 0 || net[h] > net[best] || (net[h] === net[best] && last[h] > last[best])) best = Number(h);
      });
      if (best >= 0) out[id] = { h: best, repondus: rep[best], appels: ap.length };
    });
    return out;
  }
  /* Est-on dans le bon moment ? hNow : l'heure (0-23) de maintenant. */
  function dansLeBonMoment(hab, hNow) { return !!hab && Math.abs(hab.h - hNow) <= MARGE_HEURES; }
  /* « vers 14 h » */
  function versHeure(h) { return 'vers ' + h + ' h'; }
  /* Le tri « par bon moment » : celles qui décrochent d'habitude à cette heure-ci d'abord (la plus proche de l'heure d'abord), les autres gardent
     leur rang. `idDe(ligne)` donne l'identifiant de la pharmacie (ou null). Ne modifie pas la liste reçue. */
  function trierParMoment(lignes, hab, hNow, idDe) {
    var l = (Array.isArray(lignes) ? lignes : []).map(function (r, i) {
      var id = idDe(r), h = id ? hab[id] : null, bon = dansLeBonMoment(h, hNow);
      return { r: r, i: i, bon: bon, ecart: bon ? Math.abs(h.h - hNow) : 99 };
    });
    l.sort(function (a, b) { return (b.bon - a.bon) || (a.ecart - b.ecart) || (a.i - b.i); });
    return l.map(function (x) { return x.r; });
  }
  /* Le nombre de pharmacies de la liste dont l'heure est apprise, et celles qui sont dans le bon moment. */
  function bilanMoment(lignes, hab, hNow, idDe) {
    var apprises = 0, bonnes = 0;
    (Array.isArray(lignes) ? lignes : []).forEach(function (r) {
      var id = idDe(r), h = id ? hab[id] : null; if (!h) return;
      apprises++; if (dansLeBonMoment(h, hNow)) bonnes++;
    });
    return { apprises: apprises, bonnes: bonnes };
  }
  /* La phrase sous « Trier » : l'heure de maintenant, ce que fait le tri, et toujours « utile après quelques semaines ». */
  var AIDE = 'Appris de vos appels : utile après quelques semaines.';
  function phraseTri(mode, maintenantLocal, bilan) {
    if (mode !== 'moment') return AIDE;
    var h = P.heureFr(String(maintenantLocal).slice(11, 16)), debut = 'Il est ' + h + '. ';
    if (!bilan || !bilan.apprises) return debut + 'Pas encore assez d’appels notés pour connaître les bons moments : la liste garde son ordre. ' + AIDE;
    if (!bilan.bonnes) return debut + 'Aucune pharmacie de la liste ne décroche d’habitude à cette heure-ci : la liste garde son ordre. ' + AIDE;
    return debut + 'Les pharmacies qui répondent d’habitude vers cette heure passent en premier. ' + AIDE;
  }

  /* ── 4. Le relais par écrit ── */
  /* Les « Injoignable » de suite, les plus récents : on s'arrête au premier appel où quelqu'un a répondu. */
  function injoignablesDeSuite(journal, prospectId) {
    var ap = appelsDe(journal, prospectId), n = 0;
    for (var i = ap.length - 1; i >= 0; i--) {
      if (ap[i].res === 'injoignable') n++;
      else if (ap[i].res === 'repondu') break;
    }
    return n;
  }
  /* La dernière lettre envoyée (une note « Lettre envoyée… » au journal) : 'AAAA-MM-JJ' (jour de Paris) ou ''. */
  var LETTRE = 'Lettre envoyée par mail.';
  function lettreEnvoyee(journal, prospectId) {
    var j = '', t = 0;
    (Array.isArray(journal) ? journal : []).forEach(function (a) {
      if (!a || a.type !== 'note' || a.prospect_id !== prospectId || !/^Lettre envoyée/.test(String(a.body || ''))) return;
      var x = Date.parse(a.created_at); if (!isFinite(x) || x < t) return;
      t = x; j = P.aujourdhui(new Date(x));
    });
    return j;
  }
  /* « Lettre envoyée le 24 novembre » */
  function phraseLettre(jour) { return jour ? 'Lettre envoyée le ' + P.jourFr(jour) : ''; }
  /* La réponse de Yann « Envoyez-moi une documentation » : reconnue à son titre (il l'écrit lui-même). */
  function reponseDocumentation(titre) { var t = P.norm(titre); return t.indexOf('documentation') >= 0 || t.indexOf('plaquette') >= 0 || t.indexOf('brochure') >= 0; }
  /* La barre « Lui écrire plutôt » s'affiche-t-elle ? Jamais une fois la lettre envoyée. `doc` : la réponse « documentation » a été choisie. */
  function relaisPropose(journal, prospectId, doc) {
    if (prospectId && lettreEnvoyee(journal, prospectId)) return false;
    return !!doc || (!!prospectId && injoignablesDeSuite(journal, prospectId) >= 2);
  }
  /* Pourquoi on propose (la phrase de la barre). */
  function phraseRelais(doc, injoignables) {
    return doc ? 'Il préfère un document : envoyez-lui plutôt la présentation de Yann.' : 'Deux appels sans réponse : un mail court sera peut-être lu.';
  }

  /* Le texte du mail : les mots entre accolades se remplacent ({titulaire}, {pharmacie}, {lien}) ; la ligne qui porte {lien} disparaît s'il n'y a
     aucun lien ; « Bonjour , » devient « Bonjour, » ; la signature de Yann (lue en base) clôt le message. */
  var OBJET = 'Une présentation de Yann pour votre pharmacie';
  function lienPresentation(marque) {
    var u = marque && typeof marque === 'object' ? String(marque.presentation || '').trim() : '';
    return /^https:\/\/[^\s<>"']+$/.test(u) ? P.lienSur(u) : '';
  }
  function corpsMail(modele, o) {
    o = o || {};
    var tit = String(o.titulaire || '').replace(/\s+/g, ' ').trim().replace(/^Mme\.? /, 'Madame ').replace(/^M\. /, 'Monsieur '), ph = String(o.pharmacie || '').trim(), lien = String(o.lien || '').trim();
    var lignes = String(modele == null ? '' : modele).replace(/\r/g, '').split('\n');
    if (!lien) lignes = lignes.filter(function (l) { return l.indexOf('{lien}') < 0; });
    var t = lignes.join('\n').replace(/\{lien\}/g, lien).replace(/\{pharmacie\}/g, ph || 'votre pharmacie').replace(/\{titulaire\}/g, tit)
      .replace(/Bonjour\s*,/g, 'Bonjour,').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    var sig = String(o.signature || '').trim();
    return t + '\n\nBien cordialement,' + (sig ? '\n' + sig : '');
  }
  /* Le mail complet : { objet, corps, a (adresse simple ou ''), sansLien, mailto }. */
  function mail(modele, o) {
    o = o || {};
    var corps = corpsMail(modele, o), a = encaisser ? encaisser().adresseMail(o.email) : '';
    return { objet: OBJET, corps: corps, a: a, sansLien: !String(o.lien || '').trim(), mailto: encaisser ? encaisser().lienMail(o.email, OBJET, corps) : '' };
  }

  /* ── 5. Les cinq questions ── */
  var PROJETS = [['transfert', 'Transfert'], ['agencement', 'Agencement'], ['riedl', 'Robot Riedl'], ['pda', 'PDA']];
  var QUAND = [['m6', 'Moins de 6 mois'], ['m12', '6 à 12 mois'], ['plus', 'Plus tard'], ['nsp', 'Ne sait pas']];
  var QUI = [['titulaire', 'Le titulaire'], ['associes', 'Plusieurs associés'], ['groupement', 'Avec le groupement']];
  var AGES = [['moins3', 'Moins de 3 ans'], ['3a8', '3 à 8 ans'], ['plus8', 'Plus de 8 ans']];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function libelle(liste, cle) { for (var i = 0; i < liste.length; i++) if (liste[i][0] === cle) return liste[i][1]; return ''; }
  /* Le mois qui tombe n mois après le jour 'AAAA-MM-JJ' : { m: 'mai', a: 2027 } (calculé sur les nombres : pas de débordement un 31). */
  function moisPlus(jour, n) {
    var a = Number(jour.slice(0, 4)), m = Number(jour.slice(5, 7)) - 1 + n;
    return { m: MOIS[((m % 12) + 12) % 12], a: a + Math.floor(m / 12) };
  }
  /* Le délai dit en clair, d'après la date du jour : « moins de 6 mois » = « d'ici mai 2027 » le 24/11/2026. */
  function delai(quand, jour) {
    if (!P.estJour(jour)) return '';
    var a = moisPlus(jour, 6), b = moisPlus(jour, 12);
    if (quand === 'm6') return 'd’ici ' + a.m + ' ' + a.a;
    if (quand === 'm12') return a.a === b.a ? 'entre ' + a.m + ' et ' + b.m + ' ' + b.a : 'entre ' + a.m + ' ' + a.a + ' et ' + b.m + ' ' + b.a;
    return quand === 'plus' ? 'plus tard' : '';
  }
  /* Le titre du rendez-vous : « Robot Riedl · d'ici mai 2027 » ; « Premier rendez-vous » si rien n'est dit ou si elle passe. */
  function titreRdv(c, jour) {
    var l = c && Array.isArray(c.projets) ? PROJETS.filter(function (p) { return c.projets.indexOf(p[0]) >= 0; }).map(function (p) { return p[1]; }) : [], d = c ? delai(c.quand, jour) : '';
    return (l.length ? l.join(' + ') : 'Premier rendez-vous') + (d ? ' · ' + d : '');
  }
  function nombre(v, max) {
    var s = String(v == null ? '' : v).replace(/\s/g, ''); if (!s) return { v: null };
    if (!/^\d{1,5}$/.test(s) || Number(s) < 1 || Number(s) > max) return { erreur: true };
    return { v: Number(s) };
  }
  /* Ce qui est saisi (c : projets[], quand, qui, robot 'oui'|'non', marque, age, surface, lits) → { questions, lignes, titre } ou { erreur } ;
     { vide: true, titre } si rien n'est répondu (elle a coché sans rien dire : c'est comme passer). Jamais de somme dans une réponse. */
  function questions(c, jour) {
    c = c || {};
    var projets = PROJETS.map(function (p) { return p[0]; }).filter(function (k) { return Array.isArray(c.projets) && c.projets.indexOf(k) >= 0; });
    var quand = libelle(QUAND, c.quand) ? c.quand : '', qui = libelle(QUI, c.qui) ? c.qui : '', robot = c.robot === 'oui' || c.robot === 'non' ? c.robot : '';
    var marque = robot === 'oui' ? String(c.marque || '').replace(/\s+/g, ' ').trim() : '', age = robot === 'oui' && libelle(AGES, c.age) ? c.age : '';
    var s = nombre(c.surface, 99999), l = nombre(c.lits, 999);
    if (s.erreur) return { erreur: 'La surface se note en chiffres, en m² : par exemple 180.' };
    if (l.erreur) return { erreur: 'Le nombre de lits se note en chiffres : par exemple 80.' };
    if (marque.length > 40) return { erreur: 'La marque du robot tient en 40 caractères au plus.' };
    if (marque && P.contientMontant(marque)) return { erreur: 'Notez seulement la marque du robot, sans chiffre ni somme.' };
    var q = { v: 1, projets: projets, quand: quand, qui: qui, robot: robot, marque: marque, age: age, surface_m2: s.v, lits: l.v };
    var lg = [];
    if (projets.length) lg.push('Projet : ' + projets.map(function (k) { return libelle(PROJETS, k); }).join(' + '));
    if (quand) lg.push('Pour quand : ' + (quand === 'm6' || quand === 'm12' ? libelle(QUAND, quand).toLowerCase() + ' (' + delai(quand, jour) + ')' : libelle(QUAND, quand).toLowerCase()));
    if (qui) lg.push('Qui décide : ' + libelle(QUI, qui));
    if (robot === 'non') lg.push('Aujourd’hui : pas de robot');
    else if (robot === 'oui') lg.push('Aujourd’hui : ' + (marque ? 'robot ' + marque : 'robot d’une marque non précisée') + (age ? ', ' + libelle(AGES, age).toLowerCase() : ''));
    var taille = [];
    if (s.v != null) taille.push(s.v + ' m²'); if (l.v != null) taille.push(l.v + ' lit' + (l.v > 1 ? 's' : ''));
    if (taille.length) lg.push('Taille : ' + taille.join(' · '));
    var titre = titreRdv(q, jour);
    if (!lg.length) return { vide: true, titre: titre };
    return { questions: q, lignes: lg, titre: titre };
  }
  /* Ce qui s'ajoute au corps du rendez-vous écrit (clés `objet`, `questions`, `questions_lignes`) ; sans réponse, seulement l'objet. */
  function extraRdv(r, jour, base) {
    var o = Object.assign({}, base || {}), t = r && r.titre ? r.titre : titreRdv(null, jour);
    o.objet = t;
    if (r && r.questions) { o.questions = r.questions; o.questions_lignes = r.lignes; }
    return o;
  }

  return { MIN_APPELS: MIN_APPELS, MARGE_HEURES: MARGE_HEURES, AIDE: AIDE, resultatAppel: resultatAppel, heureParis: heureParis, habitudes: habitudes, dansLeBonMoment: dansLeBonMoment,
    versHeure: versHeure, trierParMoment: trierParMoment, bilanMoment: bilanMoment, phraseTri: phraseTri,
    LETTRE: LETTRE, OBJET: OBJET, injoignablesDeSuite: injoignablesDeSuite, lettreEnvoyee: lettreEnvoyee, phraseLettre: phraseLettre, reponseDocumentation: reponseDocumentation,
    relaisPropose: relaisPropose, phraseRelais: phraseRelais, lienPresentation: lienPresentation, corpsMail: corpsMail, mail: mail,
    PROJETS: PROJETS, QUAND: QUAND, QUI: QUI, AGES: AGES, delai: delai, titreRdv: titreRdv, questions: questions, extraRdv: extraRdv };
});

/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Rapport d'étonnement (V2.etonnement) — 02/10/2026

   Will : « un outil que pour moi » pour mener des entretiens avec ses
   collègues sur l'app, et consigner ce qui se dit « à chaque question, de
   façon structurée » : l'outil idéal, les fonctions nécessaires, les idées,
   les critiques.

   · Réservé : l'écran n'existe que pour les comptes de
     jarvis_acces_etonnement() (_sql/etonnement.sql). Aucune tuile, aucune
     entrée de recherche : on y entre par le menu du compte, qui ne montre la
     ligne qu'à ces comptes. La vraie barrière est côté base (une ligne ne se
     lit que par son propriétaire) — celle de l'écran n'est qu'un confort.
   · Rien ne se perd pendant un entretien : chaque frappe est d'abord rangée
     sur l'appareil, puis envoyée ; la copie locale n'est retirée qu'une fois
     l'envoi confirmé par la base.
   · On archive, on ne supprime pas.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var ICO = function (n, s, w) { return V2.ICO ? V2.ICO(n, s, w) : ''; };

  var TABLE = 'etonnement_entretiens';
  var LIBRE = '_libre';        // clé des notes hors questions

  // ── Les améliorations (02/10/2026, Will : « vraiment du concret, que ça
  // permette d'améliorer l'app ») ────────────────────────────────────
  // Une réponse reste une parole ; un besoin est ce que l'outil devra apporter,
  // rattaché à un moment du travail (et non à un écran : l'entretien se mène
  // comme si l'application n'existait pas). Ils sont rangés dans
  // reponses[idQuestion].a = [{ id, c, t, e, k, g }] — aucune colonne ajoutée.
  // `c` = clé de regroupement : deux collègues qui demandent la même chose
  // portent la même clé, et le plan les compte ensemble. L'avancement de
  // chaque amélioration vit dans la ligne « guide » (reponses.plan).
  var MOMENTS = [['secteur', 'Connaître son secteur et ses UGA'], ['organiser', 'Organiser sa semaine et ses tournées'], ['prospecter', 'Prospecter'],
    ['avant', 'Préparer un rendez-vous'], ['pendant', 'Pendant le rendez-vous'], ['apres', 'Après le rendez-vous'],
    ['suivre', 'Suivre ses officines'], ['produits', 'Produits, prix et disponibilité'], ['rendre', 'Rendre des comptes'],
    ['equipe', 'Travailler avec l\'équipe et le siège'], ['autre', 'Autre']];
  var NATURES = [['info', 'Information à avoir', 'b'], ['tache', 'Tâche à alléger', 'a'], ['pb', 'Problème', 'r'], ['idee', 'Idée', 'b'], ['garder', 'À garder', 'g']];
  var GENES = [[3, 'Bloquant'], [2, 'Gênant'], [1, 'Confort']];
  var STATUTS = [['faire', 'À couvrir'], ['cours', 'En cours'], ['fait', 'Couvert'], ['ecarte', 'Écarté']];
  function libelle(liste, v) { for (var i = 0; i < liste.length; i++) if (liste[i][0] === v) return liste[i][1]; return ''; }

  // ── Le guide d'entretien ──────────────────────────────────────────
  // `r` = la relance à poser si la réponse reste courte. `note: true` = une
  // question qui se répond aussi par une note sur 10.
  // 02/10/2026, Will : « cibler leur travail, leur besoin concret, comme si on
  // partait d'une page neuve […] comme si JARVIS n'existait pas ». Aucune
  // question ne nomme l'application : on fait décrire le métier tel qu'il est.
  var THEMES = [
    // 02/10/2026, Will : « ça doit être plus précis, je dois connaître les UGA […]
    // je connais son métier en soi mais je dois savoir son organisation perso ».
    // Les deux premiers thèmes ne font donc plus décrire le métier : ils relèvent
    // le secteur et l'organisation propres à CE collègue, avec des faits.
    { id: 'secteur', nom: 'Votre secteur', but: 'La photographie du terrain de ce collègue : ses UGA, ses officines, ses distances.', q: [
      { id: 't1', q: 'Quelles UGA couvrez-vous ?', r: 'Leur nom ou leur numéro, et les départements concernés.' },
      { id: 't2', q: 'Combien d\'officines suivez-vous, et combien sont clientes ?', r: 'Clients réguliers, clients occasionnels, prospects.' },
      { id: 't3', q: 'Comment vos officines se répartissent-elles entre vos UGA ?', r: 'Les UGA les plus denses, celles où vous allez rarement.' },
      { id: 't4', q: 'D\'où partez-vous le matin, et jusqu\'où va votre secteur ?', r: 'Kilomètres par semaine, temps de route, nuits à l\'extérieur.' },
      { id: 't5', q: 'Quelles sont vos officines les plus importantes, et pourquoi celles-là ?', r: 'Chiffre, potentiel, relation avec le titulaire.' },
      { id: 't6', q: 'Quels concurrents rencontrez-vous le plus, et dans quelles UGA ?', r: 'Auprès de quelles officines, sur quels produits.' }
    ] },
    { id: 'orga', nom: 'Votre organisation personnelle', but: 'Sa façon à lui de s\'organiser : rythme, règles, supports, habitudes.', q: [
      { id: 'o1', q: 'À quoi ressemble votre semaine type, jour par jour ?', r: 'Jours de terrain, jours de bureau, horaires, temps de route.' },
      { id: 'o2', q: 'Quand et comment préparez-vous votre semaine ?', r: 'Le vendredi, le dimanche soir, au jour le jour ; sur quel support.' },
      { id: 'o3', q: 'Combien de rendez-vous faites-vous par jour, et combien de temps dure chacun ?', r: 'Une bonne journée, une journée ordinaire.' },
      { id: 'o4', q: 'Comment décidez-vous qui aller voir cette semaine ?', r: 'Ce qui déclenche une visite ou un appel.' },
      { id: 'o5', q: 'À quelle fréquence voyez-vous chaque officine ?', r: 'Vos règles : les plus importantes, les autres, les prospects.' },
      { id: 'o6', q: 'Comment construisez-vous une tournée ?', r: 'Par UGA, par ville, autour d\'un rendez-vous fixe.' },
      { id: 'o7', q: 'Comment prenez-vous vos rendez-vous ?', r: 'Téléphone, courriel, passage sans rendez-vous ; qui vous répond.' },
      { id: 'o8', q: 'Où notez-vous ce que vous avez à faire et ce qui s\'est dit ?', r: 'Carnet, téléphone, tableur, mémoire.' },
      { id: 'o9', q: 'Quels fichiers ou listes tenez-vous vous-même ?', r: 'Ce qu\'ils contiennent, et quand vous les mettez à jour.' },
      { id: 'o10', q: 'Quels appareils et quels supports utilisez-vous dans une journée ?', r: 'En voiture, en officine, chez vous ; téléphone, tablette, ordinateur, papier.' }
    ] },
    { id: 'avant', nom: 'Avant le rendez-vous', but: 'Les informations nécessaires pour entrer dans l\'officine, et où elles se trouvent aujourd\'hui.', q: [
      { id: 'a1', q: 'Racontez-moi comment vous avez préparé votre dernier rendez-vous.', r: 'Pas à pas : où avez-vous cherché, dans quel ordre ?' },
      { id: 'a2', q: 'De quelles informations avez-vous besoin avant d\'entrer dans l\'officine ?', r: 'Sur l\'officine, ses achats, son historique, le titulaire.' },
      { id: 'a3', q: 'Où trouvez-vous chacune de ces informations aujourd\'hui ?', r: 'Fichier, logiciel, papier, mémoire, collègue.' },
      { id: 'a4', q: 'Laquelle vous manque, ou vous arrive trop tard ?', r: 'Ce que vous feriez autrement si vous l\'aviez.' },
      { id: 'a5', q: 'Combien de temps vous prend une préparation ?', r: 'Et combien de temps devrait-elle prendre ?' }
    ] },
    { id: 'pendant', nom: 'Pendant le rendez-vous', but: 'Ce qui se passe face au pharmacien, et ce qui manque à ce moment précis.', q: [
      { id: 'p1', q: 'Comment se déroule un rendez-vous, du premier mot au dernier ?', r: 'Durée, interlocuteur, lieu : comptoir, bureau, réserve.' },
      { id: 'p2', q: 'Que montrez-vous au pharmacien, et sur quel support ?', r: 'Téléphone, tablette, papier, rien du tout.' },
      { id: 'p3', q: 'Quelles questions vous pose-t-on auxquelles vous ne pouvez pas répondre sur place ?', r: 'Que faites-vous alors ?' },
      { id: 'p4', q: 'Qu\'est-ce qui fait qu\'un rendez-vous réussit, ou échoue ?', r: 'Le dernier exemple de chaque.' },
      { id: 'p5', q: 'Que notez-vous pendant l\'échange, et où ?', r: 'Carnet, téléphone, mémoire.' }
    ] },
    { id: 'apres', nom: 'Après le rendez-vous', but: 'Le suivi : ce qu\'il faut faire, garder en mémoire et rendre comme comptes.', q: [
      { id: 'r1', q: 'Que devez-vous faire une fois sorti de l\'officine ?', r: 'Compte rendu, relance, envoi de documents, commande.' },
      { id: 'r2', q: 'Comment gardez-vous la trace de ce qui s\'est dit et de ce que vous avez promis ?', r: 'Et comment le retrouvez-vous trois mois plus tard ?' },
      { id: 'r3', q: 'Comment suivez-vous une officine dans le temps ?', r: 'Ce qui vous alerte quand elle achète moins.' },
      { id: 'r4', q: 'Quels comptes devez-vous rendre, à qui, et à quel rythme ?', r: 'Le temps que cela vous prend.' }
    ] },
    { id: 'contraintes', nom: 'Contraintes et difficultés', but: 'Ce qui ralentit, complique ou empêche, sans filtre.', q: [
      { id: 'k1', q: 'Quelles sont les contraintes de votre terrain ?', r: 'Réseau, route, horaires des officines, matériel.' },
      { id: 'k2', q: 'Qu\'est-ce qui vous fait perdre le plus de temps ?', r: 'Un exemple précis, la dernière fois que c\'est arrivé.' },
      { id: 'k3', q: 'Quelles tâches refaites-vous plusieurs fois, ou à la main ?', r: 'Ressaisies, recopies, tableaux tenus à part.' },
      { id: 'k4', q: 'Quelles informations recevez-vous fausses, incomplètes ou trop tard ?', r: 'Les conséquences face au pharmacien.' },
      { id: 'k5', q: 'Qu\'est-ce qui vous met en difficulté face à un pharmacien ?', r: 'La dernière fois que vous n\'avez pas su quoi répondre.' },
      { id: 'k6', q: 'À quoi avez-vous renoncé, faute de temps ou de moyens ?', r: 'Ce que vous feriez si vous aviez une heure de plus par jour.' }
    ] },
    { id: 'fin', nom: 'Pour conclure', but: 'Hiérarchiser : le premier besoin, ce qu\'il ne faut pas toucher, les deux notes.', q: [
      { id: 'f1', q: 'Si vous aviez un assistant à plein temps, que lui confieriez-vous en premier ?', r: 'Puis en deuxième, puis en troisième.' },
      { id: 'f2', q: 'S\'il ne fallait régler qu\'un seul problème dans votre travail, lequel ?', r: 'Un seul : celui qui changerait le plus votre quotidien.' },
      { id: 'f3', q: 'Qu\'est-ce qui marche bien dans votre façon de travailler, et qu\'il ne faut surtout pas changer ?', r: 'Vos habitudes, vos supports, vos repères.' },
      { id: 'f4', q: 'Sur 10, à quel point disposez-vous des informations dont vous avez besoin ?', r: 'Que faudrait-il pour gagner deux points ?', note: true },
      { id: 'f5', q: 'Sur 10, à quel point vos outils actuels vous font-ils gagner du temps ?', r: 'Lesquels vous en font gagner, lesquels vous en font perdre ?', note: true },
      { id: 'f6', q: 'Y a-t-il un sujet que je n\'ai pas abordé et qui compte pour vous ?', r: '' }
    ] }
  ];

  // ── État ──────────────────────────────────────────────────────────
  var acces = null, accesP = null;   // null = pas encore demandé à la base
  var rows = [];                     // entretiens + la ligne « guide », archivés compris
  var charge = false, horsLigne = false;
  var themeCourant = {};             // idEntretien -> index du thème affiché
  var filtreSynthese = 'tout';       // 'tout' | 'retenir'
  var filtrePlan = 'faire';          // 'faire' (à faire + en cours) | 'tout'
  var formAmelio = null;             // idQuestion dont le formulaire d'amélioration est ouvert
  var brouillon = { t: '', e: '', k: 'info', g: 2 };
  var voirArchives = false;
  var timers = {}, version = {};
  var dernierEtat = '';

  function sb() { return (V2.sb && V2.sb()) || null; }
  function moi() { return (V2.user && V2.user.id) || null; }
  function lsCle() { return 'jarvis_etonnement_attente_v1_' + (moi() || 'x'); }
  function lsLire() {
    try { var o = JSON.parse(localStorage.getItem(lsCle()) || '{}'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; }
    catch (e) { return {}; }
  }
  function lsEcrire(o) {
    try {
      if (Object.keys(o).length) localStorage.setItem(lsCle(), JSON.stringify(o));
      else localStorage.removeItem(lsCle());
      return true;
    } catch (e) { return false; }
  }
  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function trouver(id) { for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i]; return null; }
  function norm(x) {
    if (!x.reponses || typeof x.reponses !== 'object' || Array.isArray(x.reponses)) x.reponses = {};
    return x;
  }
  function entretiens(archives) {
    return rows.filter(function (x) { return x.type !== 'guide' && !!x.archive === !!archives; });
  }

  // ── Le guide : questions du code + celles ajoutées par Will ───────
  function guideRow() { for (var i = 0; i < rows.length; i++) if (rows[i].type === 'guide') return rows[i]; return null; }
  function ajoutees() { var g = guideRow(); return (g && Array.isArray(g.reponses.questions)) ? g.reponses.questions : []; }
  // `tout` = y compris les questions retirées du guide (la synthèse garde leurs réponses).
  function questionsDe(theme, tout) {
    var plus = ajoutees().filter(function (x) { return x.theme === theme.id && (tout || !x.off); });
    return theme.q.concat(plus.map(function (x) { return { id: x.id, q: x.q, r: '', perso: true, off: !!x.off }; }));
  }
  function totalQuestions() { var n = 0; THEMES.forEach(function (t) { n += questionsDe(t).length; }); return n; }

  function rep(row, qid) { var r = row.reponses[qid]; return (r && typeof r === 'object') ? r : {}; }
  function repondu(row, qid) { var r = rep(row, qid); return !!String(r.t || '').trim() || typeof r.n === 'number'; }
  function nbRepondu(row, theme) {
    var n = 0, th = theme ? [theme] : THEMES;
    th.forEach(function (t) { questionsDe(t).forEach(function (q) { if (repondu(row, q.id)) n++; }); });
    return n;
  }
  function nbRetenir(row) {
    var n = 0; Object.keys(row.reponses).forEach(function (k) { if (row.reponses[k] && row.reponses[k].imp) n++; }); return n;
  }

  // ── Améliorations : lecture, regroupement, avancement ─────────────
  function ameliosDe(row, qid) { var a = rep(row, qid).a; return Array.isArray(a) ? a : []; }
  function nbAmelios(row) {
    var n = 0; Object.keys(row.reponses).forEach(function (k) { n += ameliosDe(row, k).length; }); return n;
  }
  function statutDe(c) {
    var g = guideRow(), p = g && g.reponses.plan, s = p && p[c] && p[c].s;
    return libelle(STATUTS, s) ? s : 'faire';
  }
  // Le plan : une ligne par clé de regroupement, classée par nombre de
  // collègues qui la demandent, puis par gêne la plus forte entendue.
  function plan() {
    var m = {}, out = [];
    entretiens(false).forEach(function (row) {
      Object.keys(row.reponses).forEach(function (qid) {
        ameliosDe(row, qid).forEach(function (x) {
          if (!x || !String(x.t || '').trim()) return;
          var c = x.c || x.id, it = m[c];
          if (!it) { it = m[c] = { c: c, t: String(x.t).trim(), e: x.e || 'autre', k: libelle(NATURES, x.k) ? x.k : 'pb', g: 0, ids: {}, qui: [] }; out.push(it); }
          if (!it.ids[row.id]) { it.ids[row.id] = 1; it.qui.push(nomDe(row)); }
          it.g = Math.max(it.g, x.g || 0);
        });
      });
    });
    out.forEach(function (it) { it.s = statutDe(it.c); });
    return out.sort(function (a, b) { return b.qui.length - a.qui.length || b.g - a.g || a.t.localeCompare(b.t); });
  }
  function ouvert(it) { return it.s === 'faire' || it.s === 'cours'; }

  // ── Accès : c'est la base qui répond, pas une liste écrite ici ────
  function verifier() {
    if (acces !== null) return Promise.resolve(acces);
    if (accesP) return accesP;
    var c = sb();
    if (!c || !moi()) return Promise.resolve(false);
    accesP = c.rpc('jarvis_acces_etonnement').then(function (r) {
      accesP = null;
      if (r && !r.error) { acces = (r.data === true); return acces; }
      return false;                   // échec de lecture : on redemandera, on ne conclut rien
    }).catch(function () { accesP = null; return false; });
    return accesP;
  }

  // ── Lecture ───────────────────────────────────────────────────────
  function valeurs(o) { return Object.keys(o).map(function (k) { return norm(o[k]); }); }
  // Une seule lecture à la fois : l'écran peut être redessiné deux fois au
  // démarrage, et une seconde lecture partie AVANT l'envoi de la copie locale
  // revenait après lui, sans la réponse — elle remplaçait alors à l'écran ce
  // qui venait d'être écrit hors connexion (vu le 02/10/2026).
  var chargeP = null;
  function charger() {
    var c = sb();
    function repli() { horsLigne = true; rows = valeurs(lsLire()); }
    if (!c || !moi()) { repli(); return Promise.resolve(); }
    if (chargeP) return chargeP;
    chargeP = c.from(TABLE).select('*').order('cree_le', { ascending: true }).then(function (r) {
      if (r.error || !r.data) { repli(); return; }
      horsLigne = false; charge = true;
      rows = r.data.map(norm);
      // Ce qui attendait sur l'appareil l'emporte sur la base, puis repart vers elle.
      var loc = lsLire();
      Object.keys(loc).forEach(function (id) {
        var l = norm(loc[id]), vu = false;
        for (var i = 0; i < rows.length; i++) if (rows[i].id === id) { rows[i] = l; vu = true; }
        if (!vu) rows.push(l);
        envoyer(id);
      });
    }).catch(repli).then(function () { chargeP = null; });
    return chargeP;
  }

  // ── Écriture : l'appareil d'abord, la base ensuite ────────────────
  function enAttente() { return Object.keys(lsLire()).length; }
  function etat(k) {
    dernierEtat = k;
    var d = new Date(), h = d.getHours() + ' h ' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    var txt = k === 'saisie' ? 'Enregistrement…'
            : k === 'ok' ? 'Enregistré à ' + h
            : k === 'local' ? 'Gardé sur cet appareil — envoi dès que la connexion revient'
            : '';
    var els = document.querySelectorAll('.eto-etat');
    for (var i = 0; i < els.length; i++) { els[i].textContent = txt; els[i].setAttribute('data-k', k); }
  }
  function marquer(row) {
    row.maj = new Date().toISOString();
    version[row.id] = (version[row.id] || 0) + 1;
    var o = lsLire(); o[row.id] = row;
    if (!lsEcrire(o) && V2.toast) V2.toast('Rangement local impossible sur cet appareil : gardez la connexion ouverte');
    etat('saisie');
    clearTimeout(timers[row.id]);
    timers[row.id] = setTimeout(function () { envoyer(row.id); }, 900);
  }
  function envoyer(id) {
    clearTimeout(timers[id]);
    var row = trouver(id), c = sb(), u = moi();
    if (!row) return Promise.resolve(false);
    if (!c || !u) { etat('local'); return Promise.resolve(false); }
    var v = version[id] || 0;
    var ligne = {
      id: row.id, owner_id: u, type: row.type || 'entretien',
      personne: String(row.personne || '').slice(0, 120), fonction: String(row.fonction || '').slice(0, 120),
      date_entretien: row.date_entretien || null, statut: row.statut === 'termine' ? 'termine' : 'en cours',
      reponses: row.reponses || {}, archive: !!row.archive, maj: row.maj || new Date().toISOString()
    };
    return c.from(TABLE).upsert(ligne, { onConflict: 'id' }).select('id').then(function (r) {
      if (r.error || !r.data || !r.data.length) { etat('local'); return false; }
      // La copie locale ne part que si rien n'a été tapé depuis l'envoi.
      if ((version[id] || 0) === v) { var o = lsLire(); delete o[id]; lsEcrire(o); }
      etat(enAttente() ? 'saisie' : 'ok');
      return true;
    }).catch(function () { etat('local'); return false; });
  }
  function toutEnvoyer() { Object.keys(lsLire()).forEach(function (id) { if (trouver(id)) envoyer(id); }); }
  window.addEventListener('online', toutEnvoyer);
  document.addEventListener('visibilitychange', function () { if (document.hidden) toutEnvoyer(); });
  window.addEventListener('pagehide', toutEnvoyer);
  setInterval(function () { if (acces && charge && enAttente()) toutEnvoyer(); }, 15000);

  // ── Petits outils d'affichage ─────────────────────────────────────
  function dateFr(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); if (!m) return '';
    var mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return parseInt(m[3], 10) + (m[3] === '01' ? 'er' : '') + ' ' + mois[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }
  function aujourdhui() {
    var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function nomDe(row) { return String(row.personne || '').trim() || 'Sans nom'; }
  function pluriel(n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); }
  function grandir(ta) { if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.max(92, ta.scrollHeight + 2) + 'px'; }
  var ETOILE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8L12 3.5z"/></svg>';

  function entete(actif) {
    return '<div class="eto-hero">' +
        '<div><div class="v2-page-title">Rapport d\'étonnement</div>' +
        '<p class="eto-sub">Le terrain de chaque collègue tel qu\'il est, comme si l\'application n\'existait pas : ses UGA, son organisation personnelle, ses besoins d\'information, ses contraintes. Consigné question par question, puis transformé en besoins classés. Vous seul voyez cet écran.</p></div>' +
      '</div>' +
      '<div class="eto-barre">' +
        '<div class="eto-seg eto-seg-v" role="tablist">' +
          '<button role="tab" aria-selected="' + (actif === 'liste') + '" class="' + (actif === 'liste' ? 'on' : '') + '" data-act="vue" data-v="">Entretiens</button>' +
          '<button role="tab" aria-selected="' + (actif === 'synthese') + '" class="' + (actif === 'synthese' ? 'on' : '') + '" data-act="vue" data-v="synthese">Synthèse</button>' +
          '<button role="tab" aria-selected="' + (actif === 'plan') + '" class="' + (actif === 'plan' ? 'on' : '') + '" data-act="vue" data-v="plan">Besoins</button>' +
        '</div>' +
        '<span class="eto-etat" data-k="' + dernierEtat + '" aria-live="polite"></span>' +
        (actif === 'liste'
          ? '<button class="v2-btn v2-btn-primary" data-act="nouveau">' + ICO('plus', 16, 2) + 'Nouvel entretien</button>'
          : actif === 'plan'
          ? '<button class="v2-btn v2-btn-primary" data-act="copierplan">Copier les besoins</button>'
          : '<button class="v2-btn v2-btn-ghost" data-act="copier">Copier le rapport</button>') +
      '</div>' +
      (horsLigne ? '<div class="eto-alerte">La liste n\'a pas pu être lue pour l\'instant. Seuls les entretiens en attente d\'envoi sur cet appareil sont affichés ; vous pouvez en commencer un nouveau, il sera envoyé au retour de la connexion.</div>' : '');
  }

  // ── Vue 1 : la liste des entretiens ───────────────────────────────
  function carteEntretien(row, total) {
    var n = nbRepondu(row), k = nbRetenir(row), am = nbAmelios(row), pct = total ? Math.round(n * 100 / total) : 0;
    return '<div class="eto-card' + (row.archive ? ' eto-card-arch' : '') + '">' +
      '<button class="eto-card-b" data-act="ouvrir" data-id="' + esc(row.id) + '" aria-label="Ouvrir l\'entretien de ' + esc(nomDe(row)) + '">' +
        '<span class="eto-card-h"><b>' + esc(nomDe(row)) + '</b>' +
          '<span class="v2-chip ' + (row.statut === 'termine' ? 'g' : 'b') + '">' + (row.statut === 'termine' ? 'Terminé' : 'En cours') + '</span></span>' +
        '<span class="eto-card-m">' + esc([String(row.fonction || '').trim(), dateFr(row.date_entretien)].filter(Boolean).join(' · ') || 'Fonction et date à compléter') + '</span>' +
        '<span class="eto-jauge" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
        '<span class="eto-card-f"><span>' + n + ' / ' + total + ' questions</span>' + (k ? '<span class="eto-card-k">' + ETOILE + k + ' à retenir</span>' : '') +
          (am ? '<span class="eto-card-a">' + pluriel(am, 'besoin') + '</span>' : '') + '</span>' +
      '</button>' +
      (row.archive ? '<button class="eto-lien" data-act="retablir" data-id="' + esc(row.id) + '">Rétablir</button>' : '') +
    '</div>';
  }
  function guideHtml() {
    return '<details class="eto-guide"><summary><b>Le guide d\'entretien</b><span>' + pluriel(totalQuestions(), 'question') + ' en ' + THEMES.length + ' thèmes — ajouter les vôtres</span></summary>' +
      THEMES.map(function (t, i) {
        return '<div class="eto-g-th"><div class="eto-g-t">' + (i + 1) + '. ' + esc(t.nom) + '</div><ol>' +
          questionsDe(t).map(function (q) {
            return '<li>' + esc(q.q) + (q.perso ? ' <button class="eto-lien" data-act="retirerq" data-id="' + esc(q.id) + '">Retirer</button>' : '') + '</li>';
          }).join('') + '</ol>' +
          '<div class="eto-g-add"><input type="text" class="eto-in" maxlength="240" placeholder="Votre question pour ce thème" aria-label="Nouvelle question pour le thème ' + esc(t.nom) + '" data-theme="' + t.id + '">' +
          '<button class="v2-btn v2-btn-ghost" data-act="ajouterq" data-theme="' + t.id + '">Ajouter</button></div></div>';
      }).join('') + '</details>';
  }
  function vueListe() {
    var a = entretiens(false), arch = entretiens(true), total = totalQuestions();
    a = a.slice().sort(function (x, y) { return String(y.date_entretien || '').localeCompare(String(x.date_entretien || '')) || String(y.cree_le || '').localeCompare(String(x.cree_le || '')); });
    return entete('liste') +
      (a.length
        ? '<div class="eto-grid">' + a.map(function (r) { return carteEntretien(r, total); }).join('') + '</div>'
        : '<div class="eto-vide"><b>Aucun entretien pour l\'instant</b>' +
          '<p>Créez un entretien par collègue. Le guide relève son secteur, ses UGA et son organisation personnelle, thème après thème, sans jamais partir de l\'application ; vous notez ses réponses au fil de la conversation, la synthèse les regroupe par question et l\'onglet Besoins les classe.</p>' +
          '<button class="v2-btn v2-btn-primary" data-act="nouveau">' + ICO('plus', 16, 2) + 'Commencer le premier entretien</button></div>') +
      guideHtml() +
      (arch.length
        ? '<div class="eto-arch"><button class="eto-lien" data-act="archives">' + (voirArchives ? 'Masquer les entretiens archivés' : 'Voir les entretiens archivés (' + arch.length + ')') + '</button>' +
          (voirArchives ? '<div class="eto-grid">' + arch.map(function (r) { return carteEntretien(r, total); }).join('') + '</div>' : '') + '</div>'
        : '');
  }

  // ── Vue 2 : un entretien ──────────────────────────────────────────
  // Sous chaque réponse : les améliorations qu'elle appelle, et le moyen
  // d'en ajouter une sans quitter la question.
  function choix(liste, valeur, act, nom) {
    return '<div class="eto-picks" role="group" aria-label="' + nom + '">' + liste.map(function (x) {
      return '<button type="button" class="eto-pick' + (x[0] === valeur ? ' on' : '') + '" data-act="' + act + '" data-v="' + x[0] + '" aria-pressed="' + (x[0] === valeur) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
  }
  function sansAccent(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  // Ce que d'autres collègues ont déjà demandé : un geste suffit pour le
  // compter une fois de plus, au lieu de le retaper autrement.
  function suggestionsHtml(row) {
    var mot = sansAccent(brouillon.t).trim();
    var a = plan().filter(function (it) {
      if (it.ids[row.id]) return false;
      if (mot.length >= 3) return sansAccent(it.t).indexOf(mot) >= 0;
      return !brouillon.e || it.e === brouillon.e;
    }).slice(0, 5);
    if (!a.length) return '';
    return '<div class="eto-am-st">Déjà exprimé par un autre collègue — touchez pour l\'ajouter à son nom</div>' + a.map(function (it) {
      return '<button type="button" class="eto-am-sg" data-act="ammeme" data-c="' + esc(it.c) + '"><b>' + esc(it.t) + '</b><span>' + esc(libelle(MOMENTS, it.e)) + ' · ' + pluriel(it.qui.length, 'collègue') + '</span></button>';
    }).join('');
  }
  function ameliosHtml(row, qid) {
    var a = ameliosDe(row, qid);
    var liste = a.map(function (x) {
      var nat = null; NATURES.forEach(function (n) { if (n[0] === x.k) nat = n; }); nat = nat || NATURES[0];
      return '<div class="eto-am-i"><span class="v2-chip ' + nat[2] + '">' + nat[1] + '</span>' +
        '<span class="eto-am-t">' + esc(x.t) + '</span>' +
        '<span class="eto-am-m">' + esc([libelle(MOMENTS, x.e), x.k === 'garder' ? '' : libelle(GENES, x.g)].filter(Boolean).join(' · ')) + '</span>' +
        '<button type="button" class="eto-lien" data-act="amretirer" data-q="' + esc(qid) + '" data-id="' + esc(x.id) + '">Retirer</button></div>';
    }).join('');
    if (formAmelio !== qid) {
      return liste + '<button type="button" class="eto-am-plus" data-act="amouvrir" data-q="' + esc(qid) + '">' + ICO('plus', 15, 2) + 'Besoin à retenir</button>';
    }
    return liste + '<div class="eto-am-f">' +
      '<label class="eto-am-l" for="eto-am-t">Le besoin, en une phrase</label>' +
      '<input type="text" class="eto-in" id="eto-am-t" data-am="t" maxlength="200" autocomplete="off" placeholder="Exemple : connaître les derniers achats avant d\'entrer" value="' + esc(brouillon.t) + '">' +
      '<label class="eto-am-l" for="eto-am-e">Moment du travail concerné</label>' +
      '<select class="eto-in eto-sel" id="eto-am-e" data-am="e"><option value="">Choisir le moment</option>' + MOMENTS.map(function (x) {
        return '<option value="' + x[0] + '"' + (x[0] === brouillon.e ? ' selected' : '') + '>' + esc(x[1]) + '</option>';
      }).join('') + '</select>' +
      '<div class="eto-am-l">De quoi s\'agit-il ?</div>' + choix(NATURES, brouillon.k, 'amnature', 'Nature') +
      '<div class="eto-am-l">À quel point cela pèse sur son travail ?</div>' + choix(GENES, brouillon.g, 'amgene', 'Gêne') +
      '<div class="eto-am-s" data-amsug>' + suggestionsHtml(row) + '</div>' +
      '<div class="eto-am-b"><button type="button" class="v2-btn v2-btn-primary" data-act="amajouter" data-q="' + esc(qid) + '">Ajouter aux besoins</button>' +
      '<button type="button" class="v2-btn v2-btn-ghost" data-act="amannuler" data-q="' + esc(qid) + '">Annuler</button></div>' +
    '</div>';
  }
  function questionHtml(row, q, num) {
    var r = rep(row, q.id), notes = '';
    if (q.note) {
      var b = [];
      for (var n = 0; n <= 10; n++) {
        b.push('<button class="eto-n' + (r.n === n ? ' on' : '') + '" data-act="note" data-q="' + esc(q.id) + '" data-n="' + n + '" aria-label="' + n + ' sur 10" aria-pressed="' + (r.n === n) + '">' + n + '</button>');
      }
      notes = '<div class="eto-nrow" role="group" aria-label="Note sur 10">' + b.join('') + '</div>';
    }
    return '<div class="eto-q" data-qbox="' + esc(q.id) + '">' +
      '<div class="eto-q-h"><span class="eto-q-n">' + num + '</span>' +
        '<label class="eto-q-t" for="eto-ta-' + esc(q.id) + '">' + esc(q.q) + '</label>' +
        '<button class="eto-star' + (r.imp ? ' on' : '') + '" data-act="retenir" data-q="' + esc(q.id) + '" aria-pressed="' + !!r.imp + '" title="Faire ressortir cette réponse dans la synthèse">' + ETOILE + '<span>À retenir</span></button>' +
      '</div>' +
      (q.r ? '<p class="eto-q-r">Relance : ' + esc(q.r) + '</p>' : '') +
      notes +
      '<textarea class="eto-ta" id="eto-ta-' + esc(q.id) + '" data-q="' + esc(q.id) + '" rows="3" maxlength="6000" placeholder="' + (q.note ? 'Ce qui explique cette note' : 'Ses mots, tels qu\'ils sont dits') + '">' + esc(r.t || '') + '</textarea>' +
      '<div class="eto-am" data-ambox="' + esc(q.id) + '">' + ameliosHtml(row, q.id) + '</div>' +
    '</div>';
  }
  function themeHtml(row, idx) {
    if (idx >= THEMES.length) {
      return '<div class="eto-th-h"><div class="eto-th-k">Hors questions</div><h2>Notes libres</h2><p>Tout ce qui s\'est dit en dehors du guide : contexte, anecdotes, sujets à creuser.</p></div>' +
        '<div class="eto-q"><textarea class="eto-ta eto-ta-libre" data-q="' + LIBRE + '" rows="8" maxlength="12000" aria-label="Notes libres" placeholder="Notes libres">' + esc(rep(row, LIBRE).t || '') + '</textarea></div>' +
        '<div class="eto-nav-b"><button class="v2-btn v2-btn-ghost" data-act="theme" data-i="' + (idx - 1) + '">Thème précédent</button>' +
        '<button class="v2-btn v2-btn-primary" data-act="terminer">' + (row.statut === 'termine' ? 'Rouvrir l\'entretien' : 'Marquer l\'entretien comme terminé') + '</button></div>';
    }
    var t = THEMES[idx], num = 0;
    for (var i = 0; i < idx; i++) num += questionsDe(THEMES[i]).length;
    return '<div class="eto-th-h"><div class="eto-th-k">Thème ' + (idx + 1) + ' sur ' + THEMES.length + '</div><h2>' + esc(t.nom) + '</h2><p>' + esc(t.but) + '</p></div>' +
      questionsDe(t).map(function (q) { num++; return questionHtml(row, q, num); }).join('') +
      '<div class="eto-nav-b">' +
        (idx > 0 ? '<button class="v2-btn v2-btn-ghost" data-act="theme" data-i="' + (idx - 1) + '">Thème précédent</button>' : '<span></span>') +
        '<button class="v2-btn v2-btn-primary" data-act="theme" data-i="' + (idx + 1) + '">' + (idx + 1 < THEMES.length ? 'Thème suivant' : 'Notes libres') + '</button>' +
      '</div>';
  }
  function sommaireHtml(row, idx) {
    return THEMES.map(function (t, i) {
      return '<button class="eto-so' + (i === idx ? ' on' : '') + '" data-act="theme" data-i="' + i + '"' + (i === idx ? ' aria-current="true"' : '') + '>' +
        '<span>' + esc(t.nom) + '</span><i data-cpt="' + i + '">' + nbRepondu(row, t) + '/' + questionsDe(t).length + '</i></button>';
    }).join('') +
      '<button class="eto-so' + (idx >= THEMES.length ? ' on' : '') + '" data-act="theme" data-i="' + THEMES.length + '"><span>Notes libres</span><i data-cpt="libre">' + (String(rep(row, LIBRE).t || '').trim() ? '1' : '—') + '</i></button>';
  }
  function vueEntretien(row) {
    var idx = Math.min(themeCourant[row.id] || 0, THEMES.length);
    return '<div class="eto-fiche">' +
        '<div class="eto-champs">' +
          '<label>Collègue<input type="text" class="eto-in" data-champ="personne" maxlength="120" autocomplete="off" placeholder="Prénom et nom" value="' + esc(row.personne || '') + '"></label>' +
          '<label>Fonction<input type="text" class="eto-in" data-champ="fonction" maxlength="120" autocomplete="off" placeholder="Son métier, son secteur" value="' + esc(row.fonction || '') + '"></label>' +
          '<label>Date de l\'entretien<input type="date" class="eto-in" data-champ="date_entretien" value="' + esc(row.date_entretien || '') + '"></label>' +
        '</div>' +
        '<div class="eto-fiche-b">' +
          '<span class="v2-chip ' + (row.statut === 'termine' ? 'g' : 'b') + '">' + (row.statut === 'termine' ? 'Terminé' : 'En cours') + '</span>' +
          '<span class="eto-prog"><b data-prog>' + nbRepondu(row) + '</b> / ' + totalQuestions() + ' questions</span>' +
          '<span class="eto-prog" data-nbam>' + pluriel(nbAmelios(row), 'besoin') + '</span>' +
          '<span class="eto-etat" data-k="' + dernierEtat + '" aria-live="polite"></span>' +
          '<button class="eto-lien" data-act="archiver">' + (row.archive ? 'Rétablir l\'entretien' : 'Archiver l\'entretien') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="eto-cols"><nav class="eto-som" aria-label="Thèmes de l\'entretien">' + sommaireHtml(row, idx) + '</nav>' +
      '<div class="eto-corps">' + themeHtml(row, idx) + '</div></div>';
  }

  // ── Vue 3 : la synthèse ───────────────────────────────────────────
  function reponsesA(qid) {
    var out = [];
    entretiens(false).forEach(function (row) {
      var r = rep(row, qid), t = String(r.t || '').trim();
      if (!t && typeof r.n !== 'number') return;
      if (filtreSynthese === 'retenir' && !r.imp) return;
      out.push({ nom: nomDe(row), fonction: String(row.fonction || '').trim(), t: t, n: (typeof r.n === 'number' ? r.n : null), imp: !!r.imp });
    });
    return out.sort(function (a, b) { return (b.imp ? 1 : 0) - (a.imp ? 1 : 0); });
  }
  function moyenne(a) {
    var s = 0, k = 0; a.forEach(function (x) { if (x.n != null) { s += x.n; k++; } });
    return k ? { m: s / k, k: k } : null;
  }
  function vueSynthese() {
    var ent = entretiens(false), nbRep = 0, blocs = [];
    THEMES.forEach(function (t, i) {
      var qs = [];
      questionsDe(t, true).forEach(function (q) {
        var a = reponsesA(q.id); if (!a.length) return;
        nbRep += a.length;
        var moy = q.note ? moyenne(a) : null;
        qs.push('<div class="eto-sq"><div class="eto-sq-t">' + esc(q.q) + '<span>' + pluriel(a.length, 'réponse') + '</span></div>' +
          (moy ? '<div class="eto-moy"><b>' + String(Math.round(moy.m * 10) / 10).replace('.', ',') + '</b><span>/ 10 en moyenne, sur ' + pluriel(moy.k, 'note') + '</span></div>' : '') +
          '<ul>' + a.map(function (x) {
            return '<li class="' + (x.imp ? 'imp' : '') + '"><div class="eto-qui"><b>' + esc(x.nom) + '</b>' + (x.fonction ? '<span>' + esc(x.fonction) + '</span>' : '') +
              (x.n != null ? '<span class="eto-qn">' + x.n + ' / 10</span>' : '') + (x.imp ? '<span class="eto-qk">' + ETOILE + 'À retenir</span>' : '') + '</div>' +
              (x.t ? '<p>' + esc(x.t) + '</p>' : '') + '</li>';
          }).join('') + '</ul></div>');
      });
      if (qs.length) blocs.push('<section class="eto-st"><h2><span>' + (i + 1) + '</span>' + esc(t.nom) + '</h2>' + qs.join('') + '</section>');
    });
    var libres = filtreSynthese === 'retenir' ? [] : ent.filter(function (r) { return String(rep(r, LIBRE).t || '').trim(); });
    if (libres.length) {
      blocs.push('<section class="eto-st"><h2><span>+</span>Notes libres</h2><div class="eto-sq"><ul>' + libres.map(function (r) {
        return '<li><div class="eto-qui"><b>' + esc(nomDe(r)) + '</b>' + (String(r.fonction || '').trim() ? '<span>' + esc(r.fonction) + '</span>' : '') + '</div><p>' + esc(rep(r, LIBRE).t) + '</p></li>';
      }).join('') + '</ul></div></section>');
    }
    return entete('synthese') +
      '<div class="eto-sbar"><div class="eto-kpi"><b>' + ent.length + '</b><span>' + (ent.length > 1 ? 'entretiens' : 'entretien') + '</span></div>' +
        '<div class="eto-kpi"><b>' + ent.filter(function (r) { return r.statut === 'termine'; }).length + '</b><span>terminés</span></div>' +
        '<div class="eto-kpi"><b>' + nbRep + '</b><span>' + (filtreSynthese === 'retenir' ? 'réponses à retenir' : 'réponses consignées') + '</span></div>' +
        '<div class="eto-seg eto-seg-f" role="group" aria-label="Filtrer les réponses">' +
          '<button class="' + (filtreSynthese === 'tout' ? 'on' : '') + '" aria-pressed="' + (filtreSynthese === 'tout') + '" data-act="filtre" data-f="tout">Toutes les réponses</button>' +
          '<button class="' + (filtreSynthese === 'retenir' ? 'on' : '') + '" aria-pressed="' + (filtreSynthese === 'retenir') + '" data-act="filtre" data-f="retenir">À retenir</button>' +
        '</div></div>' +
      (blocs.length ? blocs.join('')
        : '<div class="eto-vide"><b>' + (filtreSynthese === 'retenir' ? 'Aucune réponse marquée « À retenir »' : 'Rien à synthétiser pour l\'instant') + '</b>' +
          '<p>' + (filtreSynthese === 'retenir' ? 'Pendant un entretien, le bouton « À retenir » fait ressortir une réponse ici.' : 'Les réponses notées en entretien se regroupent ici, question par question, tous collègues confondus.') + '</p></div>');
  }
  function rapportTexte() {
    var ent = entretiens(false), L = [];
    L.push('RAPPORT D\'ÉTONNEMENT — LE MÉTIER, VU DU TERRAIN');
    L.push(pluriel(ent.length, 'entretien') + ' · ' + dateFr(aujourdhui()));
    L.push('Personnes rencontrées : ' + ent.map(function (r) { return nomDe(r) + (String(r.fonction || '').trim() ? ' (' + String(r.fonction).trim() + ')' : ''); }).join(', '));
    var garde = filtreSynthese; filtreSynthese = 'tout';
    THEMES.forEach(function (t, i) {
      var bloc = [];
      questionsDe(t, true).forEach(function (q) {
        var a = reponsesA(q.id); if (!a.length) return;
        bloc.push(''); bloc.push(q.q);
        var moy = q.note ? moyenne(a) : null;
        if (moy) bloc.push('  Moyenne : ' + String(Math.round(moy.m * 10) / 10).replace('.', ',') + ' / 10 (' + pluriel(moy.k, 'note') + ')');
        a.forEach(function (x) {
          bloc.push('  - ' + (x.imp ? '[À retenir] ' : '') + x.nom + (x.n != null ? ' (' + x.n + ' / 10)' : '') + (x.t ? ' : ' + x.t.replace(/\s*\n\s*/g, ' / ') : ''));
        });
      });
      if (bloc.length) { L.push(''); L.push((i + 1) + '. ' + t.nom.toUpperCase()); L = L.concat(bloc); }
    });
    filtreSynthese = garde;
    var libres = ent.filter(function (r) { return String(rep(r, LIBRE).t || '').trim(); });
    if (libres.length) {
      L.push(''); L.push('NOTES LIBRES');
      libres.forEach(function (r) { L.push('  - ' + nomDe(r) + ' : ' + String(rep(r, LIBRE).t).trim().replace(/\s*\n\s*/g, ' / ')); });
    }
    return L.join('\n');
  }
  // ── Vue 4 : le plan d'amélioration ────────────────────────────────
  // Ce que l'on fait des entretiens : la liste de ce qu'il faut changer,
  // écran par écran, la demande la plus partagée en tête.
  function parEcran(items) {
    var g = {}, ordre = [];
    items.forEach(function (it) { if (!g[it.e]) { g[it.e] = []; ordre.push(it.e); } g[it.e].push(it); });
    return ordre.map(function (e) { return { e: e, items: g[e] }; });   // `items` est déjà classé : l'écran le plus demandé sort en premier
  }
  function ligneQui(it, total) {
    return 'Exprimé par ' + pluriel(it.qui.length, 'collègue') + ' sur ' + total + ' : ' + it.qui.join(', ');
  }
  function itemPlanHtml(it, total) {
    var nat = null; NATURES.forEach(function (n) { if (n[0] === it.k) nat = n; });
    return '<div class="eto-pl" data-plc="' + esc(it.c) + '" data-s="' + it.s + '">' +
      '<div class="eto-pl-h"><span class="eto-pl-n">' + it.qui.length + '</span>' +
        '<div class="eto-pl-c"><div class="eto-pl-t">' + esc(it.t) + '</div>' +
        '<div class="eto-pl-m"><span class="v2-chip ' + nat[2] + '">' + nat[1] + '</span>' +
          (it.g ? '<span class="eto-pl-g">' + libelle(GENES, it.g) + '</span>' : '') +
          '<span>' + esc(ligneQui(it, total)) + '</span></div></div></div>' +
      '<div class="eto-picks eto-pl-s" role="group" aria-label="Avancement">' + STATUTS.map(function (s) {
        return '<button type="button" class="eto-pick' + (s[0] === it.s ? ' on' : '') + '" data-act="plstatut" data-c="' + esc(it.c) + '" data-s="' + s[0] + '" aria-pressed="' + (s[0] === it.s) + '">' + s[1] + '</button>';
      }).join('') + '</div></div>';
  }
  function compteursPlan(p) {
    var a = p.filter(function (it) { return it.k !== 'garder'; });
    return { total: a.length, faire: a.filter(ouvert).length, fait: a.filter(function (it) { return it.s === 'fait'; }).length };
  }
  function vuePlan() {
    var p = plan(), total = entretiens(false).length, k = compteursPlan(p);
    var actions = p.filter(function (it) { return it.k !== 'garder' && (filtrePlan === 'tout' || ouvert(it)); });
    var garder = p.filter(function (it) { return it.k === 'garder'; });
    var blocs = parEcran(actions).map(function (g) {
      return '<section class="eto-st"><h2>' + esc(libelle(MOMENTS, g.e) || 'Autre') + '<em>' + pluriel(g.items.length, 'besoin') + '</em></h2>' +
        g.items.map(function (it) { return itemPlanHtml(it, total); }).join('') + '</section>';
    });
    if (garder.length) {
      blocs.push('<section class="eto-st"><h2>À ne pas toucher<em>ce qui marche déjà dans leur façon de travailler</em></h2><div class="eto-sq"><ul>' + garder.map(function (it) {
        return '<li><div class="eto-qui"><b>' + esc(it.t) + '</b><span>' + esc(libelle(MOMENTS, it.e)) + '</span></div><p>' + esc(it.qui.join(', ')) + '</p></li>';
      }).join('') + '</ul></div></section>');
    }
    return entete('plan') +
      '<div class="eto-sbar"><div class="eto-kpi"><b data-plk="total">' + k.total + '</b><span>' + (k.total > 1 ? 'besoins exprimés' : 'besoin exprimé') + '</span></div>' +
        '<div class="eto-kpi"><b data-plk="faire">' + k.faire + '</b><span>à couvrir</span></div>' +
        '<div class="eto-kpi"><b data-plk="fait">' + k.fait + '</b><span>' + (k.fait > 1 ? 'couverts' : 'couvert') + '</span></div>' +
        '<div class="eto-seg eto-seg-f" role="group" aria-label="Filtrer les besoins">' +
          '<button class="' + (filtrePlan === 'faire' ? 'on' : '') + '" aria-pressed="' + (filtrePlan === 'faire') + '" data-act="filtreplan" data-f="faire">À couvrir</button>' +
          '<button class="' + (filtrePlan === 'tout' ? 'on' : '') + '" aria-pressed="' + (filtrePlan === 'tout') + '" data-act="filtreplan" data-f="tout">Tout</button>' +
        '</div></div>' +
      (blocs.length ? blocs.join('')
        : '<div class="eto-vide"><b>' + (k.total ? 'Tous les besoins exprimés sont couverts ou écartés' : 'Aucun besoin noté pour l\'instant') + '</b>' +
          '<p>' + (k.total ? 'Le filtre « Tout » montre aussi ce qui est couvert et ce qui a été écarté.' : 'Pendant un entretien, sous chaque réponse, le bouton « Besoin à retenir » note ce dont votre collègue a besoin et à quel moment de son travail. Tout se retrouve ici, classé par nombre de collègues qui l\'expriment.') + '</p></div>');
  }
  function planTexte() {
    var p = plan(), total = entretiens(false).length, L = [];
    function ligne(it, i) {
      return '  ' + (i + 1) + '. [' + libelle(NATURES, it.k) + (it.g ? ' · ' + libelle(GENES, it.g) : '') + '] ' + it.t +
        ' — ' + pluriel(it.qui.length, 'collègue') + ' sur ' + total + ' (' + it.qui.join(', ') + ')' + (it.s === 'cours' ? ' — en cours' : '');
    }
    L.push('CAHIER DES BESOINS DE L\'ÉQUIPE');
    L.push('Tiré de ' + pluriel(total, 'entretien') + ' · ' + dateFr(aujourdhui()));
    L.push('Entretiens menés sur le métier, sans partir de l\'outil existant.');
    L.push('Classement : nombre de collègues qui l\'expriment, puis poids sur leur travail.');
    parEcran(p.filter(function (it) { return it.k !== 'garder' && ouvert(it); })).forEach(function (g) {
      L.push(''); L.push((libelle(MOMENTS, g.e) || 'Autre').toUpperCase());
      g.items.forEach(function (it, i) { L.push(ligne(it, i)); });
    });
    var garder = p.filter(function (it) { return it.k === 'garder'; });
    if (garder.length) {
      L.push(''); L.push('À NE PAS TOUCHER');
      garder.forEach(function (it) { L.push('  - ' + it.t + ' (' + libelle(MOMENTS, it.e) + ') — ' + it.qui.join(', ')); });
    }
    [['fait', 'DÉJÀ COUVERT'], ['ecarte', 'ÉCARTÉ']].forEach(function (s) {
      var a = p.filter(function (it) { return it.k !== 'garder' && it.s === s[0]; });
      if (!a.length) return;
      L.push(''); L.push(s[1]);
      a.forEach(function (it) { L.push('  - ' + it.t + ' (' + libelle(MOMENTS, it.e) + ')'); });
    });
    return L.join('\n');
  }
  function copier(txt, quoi) {
    quoi = quoi || 'Rapport';
    function repli() {
      var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;border:0;padding:0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      if (V2.toast) V2.toast(ok ? quoi + ' copié : collez-le où vous voulez' : 'La copie n\'a pas pu se faire sur ce navigateur');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { if (V2.toast) V2.toast(quoi + ' copié : collez-le où vous voulez'); }).catch(repli);
    } else repli();
  }

  // ── Gestes ────────────────────────────────────────────────────────
  function majCompteurs(row, wrap) {
    var p = wrap.querySelector('[data-prog]'); if (p) p.textContent = nbRepondu(row);
    THEMES.forEach(function (t, i) {
      var c = wrap.querySelector('[data-cpt="' + i + '"]'); if (c) c.textContent = nbRepondu(row, t) + '/' + questionsDe(t).length;
    });
    var l = wrap.querySelector('[data-cpt="libre"]'); if (l) l.textContent = String(rep(row, LIBRE).t || '').trim() ? '1' : '—';
    var am = wrap.querySelector('[data-nbam]'); if (am) am.textContent = pluriel(nbAmelios(row), 'besoin');
  }
  function majAmelio(row, qid, wrap) {
    var bx = wrap.querySelectorAll('[data-ambox]');
    for (var i = 0; i < bx.length; i++) if (bx[i].getAttribute('data-ambox') === qid) bx[i].innerHTML = ameliosHtml(row, qid);
  }
  function poser(row, qid, champ, val) {
    var r = row.reponses[qid]; if (!r || typeof r !== 'object') r = row.reponses[qid] = {};
    if (val === '' || val == null || val === false) delete r[champ]; else r[champ] = val;
    if (!Object.keys(r).length) delete row.reponses[qid];
    marquer(row);
  }
  function brancher(root, wrap) {
    var row = (V2.route && V2.route.param && V2.route.param !== 'synthese' && V2.route.param !== 'plan') ? trouver(V2.route.param) : null;

    wrap.addEventListener('input', function (e) {
      var t = e.target; if (!row) return;
      if (t.classList.contains('eto-ta')) { poser(row, t.getAttribute('data-q'), 't', t.value); grandir(t); majCompteurs(row, wrap); }
      else if (t.getAttribute('data-champ')) { row[t.getAttribute('data-champ')] = t.value; marquer(row); }
      else if (t.getAttribute('data-am')) {
        brouillon[t.getAttribute('data-am')] = t.value;
        var sg = wrap.querySelector('[data-amsug]'); if (sg) sg.innerHTML = suggestionsHtml(row);
      }
    });
    // Safari n'envoie pas toujours `input` pour une liste déroulante.
    wrap.addEventListener('change', function (e) {
      var t = e.target; if (!row || t.getAttribute('data-am') !== 'e') return;
      brouillon.e = t.value;
      var sg = wrap.querySelector('[data-amsug]'); if (sg) sg.innerHTML = suggestionsHtml(row);
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches && e.target.matches('.eto-g-add input')) {
        e.preventDefault(); var b = e.target.parentNode.querySelector('[data-act="ajouterq"]'); if (b) b.click();
      }
      if (e.key === 'Enter' && e.target.matches && e.target.matches('#eto-am-t')) {
        e.preventDefault(); var b2 = wrap.querySelector('[data-act="amajouter"]'); if (b2) b2.click();
      }
    });
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null; if (!b || !wrap.contains(b)) return;
      var act = b.getAttribute('data-act');

      if (act === 'vue') { V2.go('etonnement', b.getAttribute('data-v') || null); return; }
      if (act === 'ouvrir') { V2.go('etonnement', b.getAttribute('data-id')); return; }
      if (act === 'archives') { voirArchives = !voirArchives; V2.render(); return; }
      if (act === 'filtre') { filtreSynthese = b.getAttribute('data-f'); V2.render(); return; }
      if (act === 'copier') { copier(rapportTexte()); return; }
      if (act === 'copierplan') { copier(planTexte(), 'Cahier des besoins'); return; }
      if (act === 'filtreplan') { filtrePlan = b.getAttribute('data-f'); V2.render(); return; }
      if (act === 'plstatut') {
        // Sur place : la ligne ne saute pas sous le doigt, elle sortira du filtre au prochain affichage.
        var g2 = guideRow();
        if (!g2) { g2 = norm({ id: uuid(), type: 'guide', personne: '', fonction: '', date_entretien: null, statut: 'en cours', reponses: { questions: [] }, archive: false, cree_le: new Date().toISOString() }); rows.push(g2); }
        if (!g2.reponses.plan || typeof g2.reponses.plan !== 'object') g2.reponses.plan = {};
        var st = b.getAttribute('data-s');
        g2.reponses.plan[b.getAttribute('data-c')] = { s: st, le: aujourdhui() };
        marquer(g2);
        var boite = b.closest('.eto-pl'); if (boite) boite.setAttribute('data-s', st);
        var fr2 = b.parentNode.querySelectorAll('.eto-pick');
        for (var j2 = 0; j2 < fr2.length; j2++) { fr2[j2].classList.toggle('on', fr2[j2] === b); fr2[j2].setAttribute('aria-pressed', String(fr2[j2] === b)); }
        var kp = compteursPlan(plan());
        ['total', 'faire', 'fait'].forEach(function (n) { var el = wrap.querySelector('[data-plk="' + n + '"]'); if (el) el.textContent = kp[n]; });
        return;
      }
      if (act === 'nouveau') {
        var n = norm({ id: uuid(), type: 'entretien', personne: '', fonction: '', date_entretien: aujourdhui(), statut: 'en cours', reponses: {}, archive: false, cree_le: new Date().toISOString() });
        rows.push(n); marquer(n); V2.go('etonnement', n.id); return;
      }
      if (act === 'retablir') {
        var a = trouver(b.getAttribute('data-id')); if (!a) return;
        a.archive = false; marquer(a); V2.render(); return;
      }
      if (act === 'ajouterq') {
        var champ = wrap.querySelector('.eto-g-add input[data-theme="' + b.getAttribute('data-theme') + '"]');
        var txt = champ ? String(champ.value || '').trim().slice(0, 240) : '';
        if (!txt) { if (champ) champ.focus(); return; }
        var g = guideRow();
        if (!g) { g = norm({ id: uuid(), type: 'guide', personne: '', fonction: '', date_entretien: null, statut: 'en cours', reponses: { questions: [] }, archive: false, cree_le: new Date().toISOString() }); rows.push(g); }
        if (!Array.isArray(g.reponses.questions)) g.reponses.questions = [];
        g.reponses.questions.push({ id: 'p' + Date.now().toString(36), theme: b.getAttribute('data-theme'), q: txt });
        marquer(g); garderGuideOuvert = true; V2.render(); return;
      }
      if (act === 'retirerq') {
        // Retirée du guide, pas effacée : les réponses déjà notées restent dans la synthèse.
        ajoutees().forEach(function (x) { if (x.id === b.getAttribute('data-id')) x.off = true; });
        var gg = guideRow(); if (gg) marquer(gg);
        garderGuideOuvert = true; V2.render(); return;
      }
      if (!row) return;
      if (act === 'theme') {
        formAmelio = null;
        themeCourant[row.id] = Math.max(0, Math.min(THEMES.length, parseInt(b.getAttribute('data-i'), 10) || 0));
        var corps = wrap.querySelector('.eto-corps'), som = wrap.querySelector('.eto-som');
        if (corps) corps.innerHTML = themeHtml(row, themeCourant[row.id]);
        if (som) som.innerHTML = sommaireHtml(row, themeCourant[row.id]);
        var tas = wrap.querySelectorAll('.eto-ta'); for (var i = 0; i < tas.length; i++) grandir(tas[i]);
        var cols = wrap.querySelector('.eto-cols');
        if (cols && cols.getBoundingClientRect().top < 0) cols.scrollIntoView({ block: 'start' });
        var on = som && som.querySelector('.eto-so.on');
        if (on && som.scrollWidth > som.clientWidth) som.scrollLeft = Math.max(0, on.offsetLeft - 16);
        return;
      }
      if (act === 'amouvrir' || act === 'amannuler') {
        var avant = formAmelio; formAmelio = act === 'amouvrir' ? b.getAttribute('data-q') : null;
        brouillon = { t: '', e: '', k: 'info', g: 2 };
        if (avant) majAmelio(row, avant, wrap);
        majAmelio(row, b.getAttribute('data-q'), wrap);
        var ch = wrap.querySelector('#eto-am-t'); if (ch) ch.focus();
        return;
      }
      if (act === 'amnature' || act === 'amgene') {
        if (act === 'amnature') brouillon.k = b.getAttribute('data-v'); else brouillon.g = parseInt(b.getAttribute('data-v'), 10) || 2;
        var fr3 = b.parentNode.querySelectorAll('.eto-pick');
        for (var j3 = 0; j3 < fr3.length; j3++) { fr3[j3].classList.toggle('on', fr3[j3] === b); fr3[j3].setAttribute('aria-pressed', String(fr3[j3] === b)); }
        return;
      }
      if (act === 'amajouter' || act === 'ammeme') {
        var q3 = formAmelio, neuf = null;
        if (!q3) return;
        if (act === 'ammeme') {
          plan().forEach(function (it) { if (it.c === b.getAttribute('data-c')) neuf = { id: uuid(), c: it.c, t: it.t, e: it.e, k: it.k, g: brouillon.g }; });
        } else {
          var titre = String(brouillon.t || '').trim().slice(0, 200), champT = wrap.querySelector('#eto-am-t'), champE = wrap.querySelector('#eto-am-e');
          if (!titre) { if (champT) champT.focus(); if (V2.toast) V2.toast('Écrivez le besoin en une phrase'); return; }
          if (!brouillon.e) { if (champE) champE.focus(); if (V2.toast) V2.toast('Choisissez le moment du travail concerné'); return; }
          neuf = { id: uuid(), t: titre, e: brouillon.e, k: brouillon.k, g: brouillon.g };
          neuf.c = neuf.id;
        }
        if (!neuf) return;
        poser(row, q3, 'a', ameliosDe(row, q3).concat([neuf]));
        formAmelio = null; brouillon = { t: '', e: '', k: 'info', g: 2 };
        majAmelio(row, q3, wrap); majCompteurs(row, wrap);
        return;
      }
      if (act === 'amretirer') {
        var q4 = b.getAttribute('data-q'), reste = ameliosDe(row, q4).filter(function (x) { return x.id !== b.getAttribute('data-id'); });
        poser(row, q4, 'a', reste.length ? reste : null);
        majAmelio(row, q4, wrap); majCompteurs(row, wrap);
        return;
      }
      if (act === 'retenir') {
        var qid = b.getAttribute('data-q'), v = !rep(row, qid).imp;
        poser(row, qid, 'imp', v); b.classList.toggle('on', v); b.setAttribute('aria-pressed', String(v)); return;
      }
      if (act === 'note') {
        var q2 = b.getAttribute('data-q'), nn = parseInt(b.getAttribute('data-n'), 10), deja = rep(row, q2).n === nn;
        poser(row, q2, 'n', deja ? null : nn);
        var fr = b.parentNode.querySelectorAll('.eto-n');
        for (var j = 0; j < fr.length; j++) { var on2 = !deja && fr[j] === b; fr[j].classList.toggle('on', on2); fr[j].setAttribute('aria-pressed', String(on2)); }
        majCompteurs(row, wrap); return;
      }
      if (act === 'terminer') { row.statut = row.statut === 'termine' ? 'en cours' : 'termine'; marquer(row); V2.render(); return; }
      if (act === 'archiver') {
        if (!row.archive && !window.confirm('Archiver l\'entretien de ' + nomDe(row) + ' ?\n\nIl sort de la liste et de la synthèse, mais rien n\'est effacé : vous pourrez le rétablir.')) return;
        row.archive = !row.archive; marquer(row);
        if (row.archive) { voirArchives = true; V2.go('etonnement'); } else V2.render();
        return;
      }
    });
  }
  var garderGuideOuvert = false;

  // ── L'écran ───────────────────────────────────────────────────────
  function dessiner(root) {
    var p = V2.route && V2.route.param, top = V2.topbar ? V2.topbar({ back: true }) : '', corps, row = null;
    if (p === 'synthese') corps = vueSynthese();
    else if (p === 'plan') corps = vuePlan();
    else if (p && (row = trouver(p))) corps = '<button class="eto-retour" data-act="vue" data-v="">' + ICO('back', 15, 2) + 'Tous les entretiens</button>' + vueEntretien(row);
    else corps = vueListe();
    root.innerHTML = top + '<div class="v2-wrap eto-wrap">' + corps + '</div>';
    var wrap = root.querySelector('.eto-wrap');
    brancher(root, wrap);
    etat(enAttente() ? (dernierEtat === 'local' ? 'local' : 'saisie') : (dernierEtat === 'ok' ? 'ok' : ''));
    var tas = wrap.querySelectorAll('.eto-ta'); for (var i = 0; i < tas.length; i++) grandir(tas[i]);
    if (garderGuideOuvert) { var d = wrap.querySelector('.eto-guide'); if (d) d.open = true; garderGuideOuvert = false; }
  }

  V2.pages = V2.pages || {};
  V2.pages.etonnement = {
    needs: [],     // aucun fichier de données : l'écran ne lit que sa table
    render: function (root) {
      css();
      if (acces === null) {
        root.innerHTML = (V2.topbar ? V2.topbar({ back: true }) : '') + '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>';
        verifier().then(function (ok) {
          if (!(V2.route && V2.route.name === 'etonnement')) return;
          if (acces === null) { root.innerHTML = (V2.topbar ? V2.topbar({ back: true }) : '') + '<div class="v2-wrap"><div class="eto-vide"><b>Connexion impossible pour l\'instant</b><p>L\'écran n\'a pas pu vérifier votre accès. Réessayez dans un instant.</p></div></div>'; return; }
          if (!ok) { V2.go('home'); return; }
          V2.render();
        });
        return;
      }
      if (!acces) { V2.go('home'); return; }
      if (!charge) {
        root.innerHTML = (V2.topbar ? V2.topbar({ back: true }) : '') + '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>';
        charger().then(function () { if (V2.route && V2.route.name === 'etonnement') dessiner(root); });
        return;
      }
      dessiner(root);
    }
  };

  // La ligne du menu du compte : posée seulement si la base dit oui.
  V2.etonnement = {
    menu: function (m) {
      verifier().then(function (ok) {
        if (!ok || !m || !m.parentNode || m.querySelector('.eto-um')) return;
        var b = document.createElement('button');
        b.className = 'v2-um-item eto-um';
        b.innerHTML = ICO('spark', 16, 2) + 'Rapport d\'étonnement';
        b.onclick = function () { if (m.parentNode) m.parentNode.removeChild(m); V2.go('etonnement'); };
        var ref = m.querySelector('.v2-um-item');
        if (ref) m.insertBefore(b, ref); else m.appendChild(b);
      });
    }
  };

  // ── Habillage (variables de l'app, rien d'inventé) ────────────────
  function css() {
    if (document.getElementById('eto-css')) return;
    var s = document.createElement('style'); s.id = 'eto-css';
    s.textContent = [
      '.eto-wrap{max-width:1120px}',
      '.eto-sub{color:var(--muted);font-size:14.5px;line-height:1.55;margin:6px 0 0;max-width:64ch}',
      '.eto-hero{margin:4px 0 18px}',
      '.eto-barre{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}',
      '.eto-barre .v2-btn{margin-left:auto;min-height:44px}',
      '.eto-seg{display:inline-flex;gap:2px;padding:3px;background:var(--surf-sunken);border:1px solid var(--line);border-radius:12px}',
      '.eto-seg button{border:0;background:none;padding:0 16px;border-radius:9px;font:inherit;font-size:13.5px;font-weight:700;color:var(--muted);cursor:pointer;min-height:44px}',
      '.eto-wrap .v2-chip{font-size:13px}',
      '.eto-seg button.on{background:var(--card);color:var(--ip-ink);box-shadow:var(--sh-1)}',
      '.eto-seg button:focus-visible,.eto-so:focus-visible,.eto-star:focus-visible,.eto-n:focus-visible,.eto-lien:focus-visible,.eto-card-b:focus-visible,.eto-retour:focus-visible{outline:2px solid var(--ip-blue);outline-offset:2px}',
      '.eto-etat{font-size:13px;font-weight:600;color:var(--muted)}',
      '.eto-etat[data-k="ok"]{color:var(--c-mint-txt)}',
      '.eto-etat[data-k="local"]{color:var(--c-amber-txt)}',
      '.eto-alerte{background:color-mix(in srgb,var(--c-amber) 12%,#fff);border:1px solid color-mix(in srgb,var(--c-amber) 30%,transparent);color:var(--c-amber-txt);border-radius:var(--r-md);padding:12px 15px;font-size:13.5px;line-height:1.5;margin-bottom:16px}',
      '.eto-lien{border:0;background:none;padding:0 4px;min-height:44px;font:inherit;font-size:13px;font-weight:700;color:var(--ip-blue);cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
      '.eto-retour{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:0;min-height:44px;font:inherit;font-size:13.5px;font-weight:700;color:var(--ip-blue);cursor:pointer;margin-bottom:6px}',
      // liste
      '.eto-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}',
      '.eto-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);display:flex;flex-direction:column;transition:transform .2s var(--ease),box-shadow .2s var(--ease)}',
      '.eto-card:hover{transform:translateY(var(--mo-lift));box-shadow:var(--sh-2)}',
      '.eto-card-arch{background:var(--card-2)}',
      '.eto-card-arch .eto-lien{align-self:flex-start;margin:0 0 8px 18px}',
      '.eto-card-b{display:flex;flex-direction:column;gap:9px;text-align:left;border:0;background:none;font:inherit;color:inherit;cursor:pointer;padding:18px 20px;border-radius:var(--r-card);width:100%}',
      '.eto-card-h{display:flex;align-items:center;justify-content:space-between;gap:10px}',
      '.eto-card-h b{font-size:17px;font-weight:800;letter-spacing:-.02em;color:var(--ip-ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.eto-card-m{font-size:13px;color:var(--muted)}',
      '.eto-jauge{display:block;height:6px;border-radius:999px;background:var(--surf-sunken);overflow:hidden;margin-top:4px}',
      '.eto-jauge i{display:block;height:100%;border-radius:999px;background:var(--ip-blue)}',
      '.eto-card-f{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.eto-card-k{display:inline-flex;align-items:center;gap:5px;color:var(--c-amber-txt)}',
      '.eto-vide{background:var(--card);border:1px dashed var(--line-strong);border-radius:var(--r-card);padding:38px 24px;text-align:center}',
      '.eto-vide b{display:block;font-size:18px;font-weight:800;letter-spacing:-.02em;color:var(--ip-ink)}',
      '.eto-vide p{color:var(--muted);font-size:14px;line-height:1.6;max-width:58ch;margin:8px auto 18px}',
      '.eto-arch{margin-top:18px}',
      '.eto-arch .eto-grid{margin-top:8px}',
      // guide
      '.eto-guide{margin-top:22px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);padding:0 20px}',
      '.eto-guide>summary{cursor:pointer;min-height:60px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;list-style:none}',
      '.eto-guide>summary::-webkit-details-marker{display:none}',
      '.eto-guide>summary b{font-size:15px;font-weight:800;color:var(--ip-ink)}',
      '.eto-guide>summary span{font-size:13px;color:var(--muted)}',
      '.eto-guide>summary::after{content:"";margin-left:auto;width:9px;height:9px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);transition:transform .2s var(--ease)}',
      '.eto-guide[open]>summary::after{transform:rotate(-135deg)}',
      '.eto-g-th{border-top:1px solid var(--line);padding:16px 0}',
      '.eto-g-t{font-size:14px;font-weight:800;color:var(--ip-ink);margin-bottom:8px}',
      '.eto-g-th ol{margin:0 0 12px;padding-left:20px;display:grid;gap:5px;font-size:13.5px;line-height:1.5;color:var(--ip-ink-2)}',
      '.eto-g-th ol .eto-lien{display:inline-flex;align-items:center}',
      '.eto-g-add{display:flex;gap:8px;flex-wrap:wrap}',
      '.eto-g-add .eto-in{flex:1 1 240px}',
      '.eto-g-add .v2-btn{min-height:44px}',
      // champs
      '.eto-in{width:100%;box-sizing:border-box;min-height:44px;font:inherit;font-size:16px;color:var(--ip-ink);background:var(--card);border:1px solid var(--line-strong);border-radius:var(--r-control);padding:9px 12px;-webkit-appearance:none;appearance:none}',
      '.eto-in:focus,.eto-ta:focus{outline:2px solid var(--ip-blue);outline-offset:1px;border-color:transparent}',
      '.eto-ta{display:block;width:100%;box-sizing:border-box;min-height:92px;font:inherit;font-size:16px;line-height:1.55;color:var(--ip-ink);background:var(--card-2);border:1px solid var(--line-strong);border-radius:var(--r-sm);padding:12px 14px;resize:vertical}',
      '.eto-ta-libre{min-height:240px}',
      // fiche d'entretien
      '.eto-fiche{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);padding:18px 20px;margin-bottom:18px}',
      '.eto-champs{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}',
      '.eto-champs label{display:grid;gap:5px;font-size:13px;font-weight:700;color:var(--muted);min-width:0}',
      '.eto-fiche-b{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}',
      '.eto-prog{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.eto-prog b{color:var(--ip-ink);font-weight:800}',
      '.eto-fiche-b .eto-lien{margin-left:auto}',
      '.eto-cols{display:grid;gap:18px;grid-template-columns:minmax(0,1fr);scroll-margin-top:calc(var(--topbar-h) + 12px)}',
      '.eto-som{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 8px;-webkit-overflow-scrolling:touch}',
      '.eto-so{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);background:var(--card);border-radius:var(--r-btn);padding:0 14px;min-height:44px;font:inherit;font-size:13.5px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;text-align:left;white-space:nowrap}',
      '.eto-so i{font-style:normal;font-size:13px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.eto-so.on{background:var(--halo);border-color:color-mix(in srgb,var(--ip-blue) 30%,transparent);color:var(--ip-blue)}',
      '.eto-so.on i{color:var(--ip-blue)}',
      '@media(min-width:900px){.eto-cols{grid-template-columns:260px minmax(0,1fr);align-items:start}' +
        '.eto-som{flex-direction:column;overflow:visible;padding:0;position:sticky;top:calc(var(--topbar-h) + 14px)}' +
        '.eto-so{white-space:normal;line-height:1.3;padding:9px 14px}}',
      '.eto-corps{min-width:0}',
      '.eto-th-h{margin-bottom:14px}',
      '.eto-th-k{font-size:13px;font-weight:800;color:var(--ip-blue);margin-bottom:4px}',
      '.eto-th-h h2{font-size:22px;font-weight:800;letter-spacing:-.025em;color:var(--ip-ink);margin:0}',
      '.eto-th-h p{font-size:14px;color:var(--muted);margin:5px 0 0;line-height:1.5}',
      '.eto-q{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);padding:16px 18px;margin-bottom:12px}',
      '.eto-q-h{display:flex;align-items:flex-start;gap:12px}',
      '.eto-q-n{flex:none;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:var(--halo);color:var(--ip-blue);font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}',
      '.eto-q-t{flex:1;min-width:0;font-size:16px;font-weight:700;line-height:1.4;color:var(--ip-ink);padding-top:3px}',
      '.eto-q-r{font-size:13px;color:var(--muted);line-height:1.5;margin:6px 0 0 40px}',
      '.eto-q .eto-ta{margin-top:12px}',
      '.eto-star{flex:none;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);border-radius:var(--r-pill);padding:0 12px;min-height:44px;font:inherit;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer}',
      '.eto-star.on{background:color-mix(in srgb,var(--c-amber) 14%,#fff);border-color:color-mix(in srgb,var(--c-amber) 36%,transparent);color:var(--c-amber-txt)}',
      '.eto-star.on svg{fill:currentColor}',
      '@media(max-width:560px){.eto-star span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.eto-star{padding:0;width:44px;justify-content:center}.eto-q-r{margin-left:0}}',
      '.eto-nrow{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}',
      '.eto-n{flex:1 1 44px;min-width:44px;min-height:44px;border:1px solid var(--line);background:var(--card-2);border-radius:var(--r-sm);font:inherit;font-size:14px;font-weight:700;color:var(--ip-ink);cursor:pointer;font-variant-numeric:tabular-nums}',
      '.eto-n.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.eto-nav-b{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:16px}',
      '.eto-nav-b .v2-btn{min-height:46px}',
      // synthèse
      '.eto-sbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}',
      '.eto-kpi{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1);padding:10px 16px;display:flex;align-items:baseline;gap:8px}',
      '.eto-kpi b{font-size:24px;font-weight:800;letter-spacing:-.03em;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.eto-kpi span{font-size:13px;font-weight:600;color:var(--muted)}',
      '.eto-seg-f{margin-left:auto}',
      '.eto-st{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);padding:20px 22px;margin-bottom:16px}',
      '.eto-st h2{display:flex;align-items:center;gap:12px;font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--ip-ink);margin:0 0 4px}',
      '.eto-st h2 span{flex:none;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:var(--halo);color:var(--ip-blue);font-size:14px}',
      '.eto-sq{border-top:1px solid var(--line);padding:16px 0 4px;margin-top:14px}',
      '.eto-sq-t{font-size:15px;font-weight:700;color:var(--ip-ink);line-height:1.4;display:flex;justify-content:space-between;gap:12px;align-items:baseline}',
      '.eto-sq-t span{flex:none;font-size:13px;font-weight:600;color:var(--muted)}',
      '.eto-moy{display:flex;align-items:baseline;gap:8px;margin-top:10px}',
      '.eto-moy b{font-size:30px;font-weight:800;letter-spacing:-.03em;color:var(--ip-blue);font-variant-numeric:tabular-nums}',
      '.eto-moy span{font-size:13px;color:var(--muted)}',
      '.eto-sq ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:8px}',
      '.eto-sq li{background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:11px 14px}',
      '.eto-sq li.imp{background:color-mix(in srgb,var(--c-amber) 9%,#fff);border-color:color-mix(in srgb,var(--c-amber) 30%,transparent)}',
      '.eto-qui{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--muted)}',
      '.eto-qui b{font-size:13.5px;font-weight:800;color:var(--ip-ink)}',
      '.eto-qn{font-weight:800;color:var(--ip-blue);font-variant-numeric:tabular-nums}',
      '.eto-qk{display:inline-flex;align-items:center;gap:4px;font-weight:700;color:var(--c-amber-txt)}',
      '.eto-qk svg{fill:currentColor;width:13px;height:13px}',
      '.eto-sq li p{margin:6px 0 0;font-size:14.5px;line-height:1.55;color:var(--ip-ink-2);white-space:pre-wrap;overflow-wrap:anywhere}',
      // améliorations (dans l'entretien)
      '.eto-am{margin-top:10px;display:grid;gap:8px}',
      '.eto-am-i{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--halo);border:1px solid color-mix(in srgb,var(--ip-blue) 18%,transparent);border-radius:var(--r-sm);padding:4px 8px 4px 12px}',
      '.eto-am-t{flex:1 1 220px;min-width:0;font-size:14.5px;font-weight:700;line-height:1.4;color:var(--ip-ink);overflow-wrap:anywhere}',
      '.eto-am-m{font-size:13px;font-weight:600;color:var(--muted)}',
      '.eto-am-plus{justify-self:start;display:inline-flex;align-items:center;gap:7px;border:1px dashed color-mix(in srgb,var(--ip-blue) 45%,transparent);background:none;border-radius:var(--r-pill);padding:0 16px;min-height:44px;font:inherit;font-size:13.5px;font-weight:700;color:var(--ip-blue);cursor:pointer}',
      '.eto-am-plus:hover{background:var(--halo)}',
      '.eto-am-f{display:grid;gap:8px;background:var(--card-2);border:1px solid var(--line-strong);border-radius:var(--r-md);padding:14px}',
      '.eto-am-l{font-size:13px;font-weight:700;color:var(--muted);margin-top:4px}',
      '.eto-sel{height:44px;padding-right:38px;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M1 1.5l5 5 5-5\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}',
      '.eto-picks{display:flex;flex-wrap:wrap;gap:6px}',
      '.eto-pick{border:1px solid var(--line-strong);background:var(--card);border-radius:var(--r-pill);padding:0 15px;min-height:44px;min-width:44px;font:inherit;font-size:13.5px;font-weight:700;color:var(--ip-ink-2);cursor:pointer}',
      '.eto-pick.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.eto-pick:focus-visible,.eto-am-plus:focus-visible,.eto-am-sg:focus-visible{outline:2px solid var(--ip-blue);outline-offset:2px}',
      '.eto-am-s{display:grid;gap:6px}',
      '.eto-am-s:empty{display:none}',
      '.eto-am-st{font-size:13px;font-weight:700;color:var(--muted);margin-top:4px}',
      '.eto-am-sg{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;text-align:left;border:1px solid var(--line);background:var(--card);border-radius:var(--r-sm);padding:6px 12px;min-height:44px;font:inherit;cursor:pointer;color:var(--ip-ink)}',
      '.eto-am-sg b{font-size:14px;font-weight:700;min-width:0;overflow-wrap:anywhere}',
      '.eto-am-sg span{font-size:13px;font-weight:600;color:var(--muted)}',
      '.eto-am-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}',
      '.eto-am-b .v2-btn{min-height:44px}',
      '.eto-card-f{flex-wrap:wrap}',
      '.eto-card-a{color:var(--ip-blue)}',
      // plan d'amélioration
      '.eto-st h2 em{font-style:normal;font-size:13px;font-weight:600;letter-spacing:0;color:var(--muted);margin-left:auto;text-align:right}',
      '.eto-pl{border-top:1px solid var(--line);padding:16px 0 12px;margin-top:14px;display:grid;gap:12px}',
      '.eto-pl-h{display:flex;align-items:flex-start;gap:14px}',
      '.eto-pl-n{flex:none;min-width:40px;height:40px;padding:0 6px;border-radius:12px;display:grid;place-items:center;background:var(--ip-blue);color:#fff;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}',
      '.eto-pl-c{min-width:0;flex:1}',
      '.eto-pl-t{font-size:16px;font-weight:800;letter-spacing:-.01em;line-height:1.35;color:var(--ip-ink);overflow-wrap:anywhere}',
      '.eto-pl-m{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:13px;line-height:1.5;color:var(--muted)}',
      '.eto-pl-g{font-weight:800;color:var(--ip-ink-2)}',
      '.eto-pl[data-s="fait"] .eto-pl-n,.eto-pl[data-s="ecarte"] .eto-pl-n{background:var(--surf-sunken);color:var(--muted)}',
      '.eto-pl[data-s="fait"] .eto-pl-t,.eto-pl[data-s="ecarte"] .eto-pl-t{color:var(--muted);text-decoration:line-through}',
      '@media(min-width:900px){.eto-pl{grid-template-columns:minmax(0,1fr) auto;align-items:center}}',
      '@media(max-width:560px){.eto-seg-v{display:flex;width:100%}.eto-seg-v button{flex:1;padding:0 6px}.eto-st h2{flex-wrap:wrap}.eto-st h2 em{margin-left:0;text-align:left;width:100%}}',
      '@media(max-width:560px){.eto-barre .v2-btn{margin-left:0;width:100%}.eto-seg-f{margin-left:0}.eto-st{padding:16px}.eto-q{padding:14px}.eto-fiche-b .eto-lien{margin-left:0}}',
      '@media(prefers-reduced-motion:reduce){.eto-card,.eto-guide>summary::after{transition:none}.eto-card:hover{transform:none}}'
    ].join('');
    document.head.appendChild(s);
  }
})();

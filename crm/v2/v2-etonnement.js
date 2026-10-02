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

  // ── Le guide d'entretien ──────────────────────────────────────────
  // `r` = la relance à poser si la réponse reste courte. `note: true` = une
  // question qui se répond aussi par une note sur 10.
  var THEMES = [
    { id: 'usage', nom: 'Votre quotidien avec JARVIS', but: 'Comprendre quand, où et pour quoi l\'application est ouverte.', q: [
      { id: 'u1', q: 'À quels moments ouvrez-vous JARVIS dans une journée ou une semaine type ?', r: 'Avant un rendez-vous, le soir, au bureau, en voiture…' },
      { id: 'u2', q: 'Sur quel appareil l\'utilisez-vous le plus : téléphone, tablette, ordinateur ?', r: 'Pourquoi celui-là ? Qu\'est-ce qui ne passe pas sur les autres ?' },
      { id: 'u3', q: 'Quelle est la première chose que vous y cherchez en l\'ouvrant ?', r: 'Et la trouvez-vous tout de suite ?' },
      { id: 'u4', q: 'Racontez-moi la dernière fois où JARVIS vous a vraiment servi.', r: 'Quelle officine, quelle situation, quel résultat ?' }
    ] },
    { id: 'etonne', nom: 'Ce qui vous a étonné', but: 'Recueillir le regard neuf : ce qui surprend, en bien comme en mal.', q: [
      { id: 'e1', q: 'Qu\'est-ce qui vous a surpris en bien la première fois ?', r: 'Un écran, une information, une rapidité…' },
      { id: 'e2', q: 'Qu\'est-ce qui vous a surpris en mal, ou déçu ?', r: 'Ce que vous attendiez et que vous n\'avez pas trouvé.' },
      { id: 'e3', q: 'Y a-t-il un écran, un mot ou un chiffre que vous n\'avez pas compris ?', r: 'Lequel ? Qu\'avez-vous cru qu\'il voulait dire ?' },
      { id: 'e4', q: 'Qu\'est-ce qui vous étonne encore aujourd\'hui ?', r: 'Ce à quoi vous ne vous êtes jamais habitué.' }
    ] },
    { id: 'marche', nom: 'Ce qui vous sert', but: 'Repérer ce qu\'il faut garder et ce qui n\'est jamais ouvert.', q: [
      { id: 'm1', q: 'Quels outils utilisez-vous chaque semaine ?', r: 'Dans quel ordre, et pour quoi faire ?' },
      { id: 'm2', q: 'S\'il ne fallait en garder qu\'un seul, lequel ?', r: 'Qu\'est-ce qu\'il vous apporte que rien d\'autre ne vous apporte ?' },
      { id: 'm3', q: 'Quels outils n\'ouvrez-vous jamais ?', r: 'Inutile pour vous, trop compliqué, ou simplement inconnu ?' }
    ] },
    { id: 'gene', nom: 'Ce qui vous gêne', but: 'Les critiques, sans filtre : ce qui ralentit, agace ou inquiète.', q: [
      { id: 'g1', q: 'Qu\'est-ce qui vous fait perdre du temps ?', r: 'Un exemple précis, la dernière fois que c\'est arrivé.' },
      { id: 'g2', q: 'Qu\'est-ce qui est trop compliqué, ou trop long à trouver ?', r: 'Combien d\'étapes ? Où vous attendiez-vous à le trouver ?' },
      { id: 'g3', q: 'Y a-t-il des chiffres ou des informations auxquels vous ne faites pas confiance ?', r: 'Lesquels, et qu\'est-ce qui vous a fait douter ?' },
      { id: 'g4', q: 'Que faites-vous encore ailleurs, faute de pouvoir le faire dans JARVIS ?', r: 'Tableur, papier, téléphone, courriel, autre logiciel…' },
      { id: 'g5', q: 'Qu\'est-ce qui vous agace, même un détail ?', r: 'Les petits détails comptent : dites-les tous.' }
    ] },
    { id: 'ideal', nom: 'L\'outil idéal', but: 'Faire décrire l\'outil rêvé, sans se limiter à ce qui existe.', q: [
      { id: 'i1', q: 'Avec une baguette magique, à quoi ressemble l\'outil idéal pour votre métier ?', r: 'Décrivez une journée avec lui, du matin au soir.' },
      { id: 'i2', q: 'Avant un rendez-vous en officine, que devrait-il vous préparer ?', r: 'Ce que vous préparez aujourd\'hui à la main.' },
      { id: 'i3', q: 'Pendant le rendez-vous, que devrait-il vous permettre de montrer ou de faire ?', r: 'Face au pharmacien, écran en main.' },
      { id: 'i4', q: 'Après le rendez-vous, que devrait-il faire à votre place ?', r: 'Compte rendu, relance, suivi, envoi de documents…' },
      { id: 'i5', q: 'Avez-vous vu ailleurs quelque chose que vous aimeriez retrouver ici ?', r: 'Une autre application, un autre métier, un ancien employeur.' }
    ] },
    { id: 'idees', nom: 'Les fonctions nécessaires et vos idées', but: 'Transformer l\'idéal en demandes concrètes, classées par priorité.', q: [
      { id: 'f1', q: 'Quelles fonctions vous manquent aujourd\'hui ?', r: 'Dans quel ordre de priorité ?' },
      { id: 'f2', q: 'Quelle information vous manque le plus sur une officine ou sur un produit ?', r: 'Qu\'est-ce que vous en feriez ?' },
      { id: 'f3', q: 'Avez-vous une idée, même inaboutie, que vous n\'avez jamais proposée ?', r: 'Aucune idée n\'est trop petite ni trop grande.' },
      { id: 'f4', q: 'Qu\'est-ce qui devrait être retiré ou simplifié ?', r: 'Ce qui encombre sans servir.' }
    ] },
    { id: 'fin', nom: 'Pour conclure', but: 'Hiérarchiser : l\'unique priorité, ce qu\'il ne faut pas toucher, la note.', q: [
      { id: 'c1', q: 'Si je ne pouvais changer qu\'une seule chose demain, laquelle ?', r: 'Une seule : celle qui changerait le plus votre quotidien.' },
      { id: 'c2', q: 'Qu\'est-ce qu\'il ne faut surtout pas toucher ?', r: 'Ce que vous seriez déçu de voir disparaître.' },
      { id: 'c3', q: 'Quelle note sur 10 donnez-vous à JARVIS aujourd\'hui ?', r: 'Que faudrait-il pour gagner deux points ?', note: true },
      { id: 'c4', q: 'Sur 10, à quel point est-il simple à utiliser ?', r: 'Qu\'est-ce qui le rendrait plus simple ?', note: true },
      { id: 'c5', q: 'Le conseilleriez-vous à un nouveau collègue ? Que lui diriez-vous ?', r: 'Les mots exacts que vous emploieriez.' },
      { id: 'c6', q: 'Y a-t-il un sujet que je n\'ai pas abordé et qui compte pour vous ?', r: '' }
    ] }
  ];

  // ── État ──────────────────────────────────────────────────────────
  var acces = null, accesP = null;   // null = pas encore demandé à la base
  var rows = [];                     // entretiens + la ligne « guide », archivés compris
  var charge = false, horsLigne = false;
  var themeCourant = {};             // idEntretien -> index du thème affiché
  var filtreSynthese = 'tout';       // 'tout' | 'retenir'
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
  function charger() {
    var c = sb();
    function repli() { horsLigne = true; rows = valeurs(lsLire()); }
    if (!c || !moi()) { repli(); return Promise.resolve(); }
    return c.from(TABLE).select('*').order('cree_le', { ascending: true }).then(function (r) {
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
    }).catch(repli);
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
        '<p class="eto-sub">Ce que vos collègues vous disent de JARVIS, consigné question par question. Vous seul voyez cet écran.</p></div>' +
      '</div>' +
      '<div class="eto-barre">' +
        '<div class="eto-seg" role="tablist">' +
          '<button role="tab" aria-selected="' + (actif === 'liste') + '" class="' + (actif === 'liste' ? 'on' : '') + '" data-act="vue" data-v="">Entretiens</button>' +
          '<button role="tab" aria-selected="' + (actif === 'synthese') + '" class="' + (actif === 'synthese' ? 'on' : '') + '" data-act="vue" data-v="synthese">Synthèse</button>' +
        '</div>' +
        '<span class="eto-etat" data-k="' + dernierEtat + '" aria-live="polite"></span>' +
        (actif === 'liste'
          ? '<button class="v2-btn v2-btn-primary" data-act="nouveau">' + ICO('plus', 16, 2) + 'Nouvel entretien</button>'
          : '<button class="v2-btn v2-btn-ghost" data-act="copier">Copier le rapport</button>') +
      '</div>' +
      (horsLigne ? '<div class="eto-alerte">La liste n\'a pas pu être lue pour l\'instant. Seuls les entretiens en attente d\'envoi sur cet appareil sont affichés ; vous pouvez en commencer un nouveau, il sera envoyé au retour de la connexion.</div>' : '');
  }

  // ── Vue 1 : la liste des entretiens ───────────────────────────────
  function carteEntretien(row, total) {
    var n = nbRepondu(row), k = nbRetenir(row), pct = total ? Math.round(n * 100 / total) : 0;
    return '<div class="eto-card' + (row.archive ? ' eto-card-arch' : '') + '">' +
      '<button class="eto-card-b" data-act="ouvrir" data-id="' + esc(row.id) + '" aria-label="Ouvrir l\'entretien de ' + esc(nomDe(row)) + '">' +
        '<span class="eto-card-h"><b>' + esc(nomDe(row)) + '</b>' +
          '<span class="v2-chip ' + (row.statut === 'termine' ? 'g' : 'b') + '">' + (row.statut === 'termine' ? 'Terminé' : 'En cours') + '</span></span>' +
        '<span class="eto-card-m">' + esc([String(row.fonction || '').trim(), dateFr(row.date_entretien)].filter(Boolean).join(' · ') || 'Fonction et date à compléter') + '</span>' +
        '<span class="eto-jauge" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
        '<span class="eto-card-f"><span>' + n + ' / ' + total + ' questions</span>' + (k ? '<span class="eto-card-k">' + ETOILE + k + ' à retenir</span>' : '') + '</span>' +
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
          '<p>Créez un entretien par collègue. Le guide vous donne les questions, thème après thème ; vous notez ses réponses au fil de la conversation, et la synthèse les regroupe par question.</p>' +
          '<button class="v2-btn v2-btn-primary" data-act="nouveau">' + ICO('plus', 16, 2) + 'Commencer le premier entretien</button></div>') +
      guideHtml() +
      (arch.length
        ? '<div class="eto-arch"><button class="eto-lien" data-act="archives">' + (voirArchives ? 'Masquer les entretiens archivés' : 'Voir les entretiens archivés (' + arch.length + ')') + '</button>' +
          (voirArchives ? '<div class="eto-grid">' + arch.map(function (r) { return carteEntretien(r, total); }).join('') + '</div>' : '') + '</div>'
        : '');
  }

  // ── Vue 2 : un entretien ──────────────────────────────────────────
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
    L.push('RAPPORT D\'ÉTONNEMENT — JARVIS');
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
  function copier(txt) {
    function repli() {
      var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;border:0;padding:0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      if (V2.toast) V2.toast(ok ? 'Rapport copié : collez-le où vous voulez' : 'La copie n\'a pas pu se faire sur ce navigateur');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { if (V2.toast) V2.toast('Rapport copié : collez-le où vous voulez'); }).catch(repli);
    } else repli();
  }

  // ── Gestes ────────────────────────────────────────────────────────
  function majCompteurs(row, wrap) {
    var p = wrap.querySelector('[data-prog]'); if (p) p.textContent = nbRepondu(row);
    THEMES.forEach(function (t, i) {
      var c = wrap.querySelector('[data-cpt="' + i + '"]'); if (c) c.textContent = nbRepondu(row, t) + '/' + questionsDe(t).length;
    });
    var l = wrap.querySelector('[data-cpt="libre"]'); if (l) l.textContent = String(rep(row, LIBRE).t || '').trim() ? '1' : '—';
  }
  function poser(row, qid, champ, val) {
    var r = row.reponses[qid]; if (!r || typeof r !== 'object') r = row.reponses[qid] = {};
    if (val === '' || val == null || val === false) delete r[champ]; else r[champ] = val;
    if (!Object.keys(r).length) delete row.reponses[qid];
    marquer(row);
  }
  function brancher(root, wrap) {
    var row = (V2.route && V2.route.param && V2.route.param !== 'synthese') ? trouver(V2.route.param) : null;

    wrap.addEventListener('input', function (e) {
      var t = e.target; if (!row) return;
      if (t.classList.contains('eto-ta')) { poser(row, t.getAttribute('data-q'), 't', t.value); grandir(t); majCompteurs(row, wrap); }
      else if (t.getAttribute('data-champ')) { row[t.getAttribute('data-champ')] = t.value; marquer(row); }
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches && e.target.matches('.eto-g-add input')) {
        e.preventDefault(); var b = e.target.parentNode.querySelector('[data-act="ajouterq"]'); if (b) b.click();
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
      '@media(max-width:560px){.eto-barre .v2-btn{margin-left:0;width:100%}.eto-seg-f{margin-left:0}.eto-st{padding:16px}.eto-q{padding:14px}.eto-fiche-b .eto-lien{margin-left:0}}',
      '@media(prefers-reduced-motion:reduce){.eto-card,.eto-guide>summary::after{transition:none}.eto-card:hover{transform:none}}'
    ].join('');
    document.head.appendChild(s);
  }
})();

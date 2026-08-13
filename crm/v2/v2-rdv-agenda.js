/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Mon agenda personnel (bloc de l'écran « Mes disponibilités »)

   Le commercial colle ici l'adresse privée de son agenda. À partir de là,
   tout ce qui y est déjà pris disparaît des créneaux proposés au pharmacien,
   sans qu'il ait à cocher quoi que ce soit.

   Ce que l'écran ne montre JAMAIS : l'adresse elle-même. Une fois déposée,
   elle n'est plus relisible — même pas par son propriétaire, même pas par
   erreur (le droit de lecture sur cette colonne n'existe pas en base). On
   affiche seulement l'hébergeur et l'état de la dernière relève.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }

  // Mode d'emploi par outil : c'est le vrai obstacle. Sans ça, personne ne
  // trouve l'adresse — elle est enterrée à trois niveaux dans les réglages.
  var MODES = [
    { cle: 'google', nom: 'Google Agenda', pas: [
      'Ouvre Google Agenda sur un ordinateur',
      'Passe la souris sur ton agenda (colonne de gauche) → les trois points → « Paramètres et partage »',
      'Descends jusqu’à « Intégrer l’agenda »',
      'Copie « Adresse secrète au format iCal »'
    ], piege: 'Si tu ne vois pas cette ligne, c’est que ton entreprise l’a désactivée : seul l’administrateur peut la rouvrir.' },
    { cle: 'outlook', nom: 'Outlook / Microsoft 365', pas: [
      'Ouvre Outlook dans un navigateur → l’Agenda',
      'Roue dentée (en haut à droite) → « Calendriers partagés »',
      'Sous « Publier un calendrier », choisis ton agenda',
      'Choisis « Peut voir quand je suis occupé » — surtout pas plus',
      'Publie, puis copie le lien qui finit par .ics'
    ], piege: 'Choisis bien « quand je suis occupé » : les autres options partageraient les titres de tes rendez-vous.' },
    { cle: 'apple', nom: 'Agenda iPhone / iCloud', pas: [
      'Sur iPhone : Calendrier → Calendriers → le (i) à côté du tien',
      'Active « Calendrier public »',
      'Touche « Partager le lien » → Copier'
    ], piege: 'Le lien commence par webcal:// — colle-le tel quel, on s’occupe du reste.' }
  ];

  function css() {
    if (document.getElementById('v2-rdvag-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rdvag-css';
    s.textContent = [
      '.v2-ag-box{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 16px}',
      '.v2-ag-etat{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:14px;margin-bottom:10px}',
      '.v2-ag-pastille{display:inline-block;width:9px;height:9px;border-radius:50%;flex:0 0 auto}',
      '.v2-ag-ok{background:#00A870}.v2-ag-ko{background:#E5484D}.v2-ag-off{background:#8B93A1}',
      '.v2-ag-box input[type=url]{width:100%;min-height:44px;font-size:16px;padding:10px 12px;',
      '  border:1px solid var(--line);border-radius:10px;background:var(--card-2);color:inherit}',
      '.v2-ag-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.v2-ag-acts .v2-btn{min-height:44px}',
      '.v2-ag-aide{margin-top:12px;font-size:14px;color:var(--muted);line-height:1.55}',
      '.v2-ag-aide ol{margin:6px 0 0;padding-left:20px}.v2-ag-aide li{margin:3px 0}',
      '.v2-ag-onglets{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
      '.v2-ag-onglets button{min-height:44px;padding:0 12px;border-radius:9px;border:1px solid var(--line);',
      '  background:transparent;color:inherit;font:inherit;cursor:pointer}',
      '.v2-ag-onglets button.on{border-color:var(--ip-blue);color:var(--ip-blue);font-weight:700}',
      '.v2-ag-piege{margin-top:6px;font-style:italic}',
      '.v2-ag-res{margin-top:10px;font-size:14px;line-height:1.5}'
    ].join('');
    document.head.appendChild(s);
  }

  function dire(html, couleur) {
    var e = document.getElementById('v2-ag-res');
    if (e) e.innerHTML = '<span style="color:' + (couleur || 'var(--muted)') + '">' + html + '</span>';
  }

  // « il y a 19 h » a déjà été lu « à 19 h » par un utilisateur, qui a cru que
  // l'agenda se relisait tout seul le soir. On donne donc les minutes tant
  // qu'on peut : c'est la granularité qui correspond à la réalité maintenant
  // que le robot repasse toutes les 15 minutes.
  function depuis(iso) {
    if (!iso) return 'jamais';
    var m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 2) return 'à l’instant';
    if (m < 60) return 'il y a ' + m + ' min';
    if (m < 1440) return 'il y a ' + Math.floor(m / 60) + ' h';
    return 'il y a ' + Math.floor(m / 1440) + ' jour(s)';
  }

  function appeler(corps) {
    var c = sb();
    if (!c) return Promise.resolve({ ok: false, raison: 'connexion_requise' });
    // La fonction serveur n'accepte PAS la clé publique comme identité : il
    // lui faut le vrai jeton de session, sinon n'importe qui pourrait brancher
    // un agenda sur le compte d'un autre.
    return c.auth.getSession().then(function (s) {
      var acces = (s && s.data && s.data.session && s.data.session.access_token) || null;
      if (!acces) return { ok: false, raison: 'connexion_requise' };
      return fetch(window.SUPABASE_URL + '/functions/v1/agenda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + acces
        },
        body: JSON.stringify(corps)
      }).then(function (r) { return r.json(); });
    });
  }

  var RAISONS = {
    hebergeur_inconnu: 'Cette adresse ne vient pas d’un agenda Google, Outlook ou iCloud.',
    adresse_invalide: 'Cette adresse n’a pas l’air d’un lien.',
    https_obligatoire: 'Le lien doit commencer par https:// (ou webcal://).',
    agenda_injoignable: 'Ton agenda n’a pas répondu. Vérifie que le lien est bien le lien « secret » et non l’adresse de la page.',
    pas_un_agenda: 'Ce lien ne renvoie pas un agenda.',
    agenda_trop_gros: 'Cet agenda est trop volumineux.',
    lecture_impossible: 'Cet agenda n’a pas pu être lu.',
    connexion_requise: 'Reconnecte-toi et réessaie.'
  };
  var msg = function (r) { return RAISONS[r] || 'Impossible pour l’instant.'; };

  V2.rdvAgenda = {
    // Rendu du bloc. `a` = ligne rdv_agenda (sans l'adresse, elle n'est pas lisible).
    bloc: function (a) {
      css();
      var branche = !!(a && a.hote);
      // Ce qui compte n'est pas « le dernier appel a-t-il abouti » mais « mes
      // heures sont-elles à jour ». Google rationne parfois la lecture de son
      // flux (429) : l'appel échoue, et pourtant les plages relevées quinze
      // minutes plus tôt sont parfaitement valables. Crier à la panne dans ce
      // cas apprend à ignorer le voyant.
      var vieux = !a || !a.dernier_ok ||
        (Date.now() - new Date(a.dernier_ok).getTime()) > 2 * 3600 * 1000;
      var etat = !branche
        ? '<span class="v2-ag-pastille v2-ag-off"></span> Aucun agenda connecté'
        : (vieux
            ? '<span class="v2-ag-pastille v2-ag-ko"></span> ' + esc(a.hote) +
              ' — pas relu depuis ' + esc(depuis(a.dernier_ok)) +
              (a.derniere_erreur ? ' · ' + esc(String(a.derniere_erreur).slice(0, 60)) : '')
            : '<span class="v2-ag-pastille v2-ag-ok"></span> ' + esc(a.hote) +
              ' — relu ' + esc(depuis(a.dernier_ok)) +
              (a.plages_gardees != null
                ? ' · ' + esc(a.plages_gardees) + ' plage(s) occupée(s)' : '') +
              ' · relecture automatique toutes les 15 min');

      var onglets = MODES.map(function (m, i) {
        return '<button class="' + (i === 0 ? 'on' : '') + '" data-m="' + m.cle +
               '" onclick="V2.rdvAgenda.aide(\'' + m.cle + '\')">' + esc(m.nom) + '</button>';
      }).join('');

      return '<div class="v2-ag-box">' +
        '<div class="v2-ag-etat">' + etat + '</div>' +
        '<input type="url" id="v2-ag-url" inputmode="url" autocomplete="off" spellcheck="false" ' +
          'placeholder="Colle ici l’adresse privée de ton agenda" />' +
        '<div class="v2-ag-acts">' +
          '<button class="v2-btn" onclick="V2.rdvAgenda.tester()">Tester</button>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.rdvAgenda.brancher()">Connecter mon agenda</button>' +
          (branche && V2.pages && V2.pages.rdvplanning
            ? '<button class="v2-btn" onclick="V2.go(\'rdvplanning\')">Voir mon agenda</button>' : '') +
          (branche ? '<button class="v2-btn" onclick="V2.rdvAgenda.debrancher()">Débrancher</button>' : '') +
        '</div>' +
        '<div class="v2-ag-res" id="v2-ag-res"></div>' +
        '<div class="v2-ag-aide"><div class="v2-ag-onglets">' + onglets + '</div>' +
          '<div id="v2-ag-aide-corps"></div>' +
          '<p style="margin:10px 0 0">Ce qui est lu se limite aux <b>heures occupées</b>. ' +
          'Aucun titre, aucun lieu, aucun participant n’est enregistré — il n’existe pas de ' +
          'case pour les ranger. Et l’adresse que tu colles ne pourra plus jamais être ' +
          'réaffichée, y compris à toi.</p>' +
        '</div></div>';
    },

    aide: function (cle) {
      var m = null, i;
      for (i = 0; i < MODES.length; i++) if (MODES[i].cle === cle) m = MODES[i];
      if (!m) m = MODES[0];
      var bt = document.querySelectorAll('.v2-ag-onglets button');
      for (i = 0; i < bt.length; i++) bt[i].classList.toggle('on', bt[i].getAttribute('data-m') === m.cle);
      var e = document.getElementById('v2-ag-aide-corps');
      if (e) e.innerHTML = '<ol>' + m.pas.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') +
        '</ol><p class="v2-ag-piege">' + esc(m.piege) + '</p>';
    },

    tester: function () {
      var e = document.getElementById('v2-ag-url'), u = e ? e.value.trim() : '';
      if (!u) { dire('Colle d’abord l’adresse de ton agenda.'); return; }
      dire('Lecture de ton agenda…');
      appeler({ action: 'tester', url: u }).then(function (r) {
        if (!r || !r.ok) { dire(esc(msg(r && r.raison)), 'var(--rose,#E5484D)'); return; }
        var ex = (r.exemple || []).map(function (p) {
          return esc(p.date) + ' ' + esc(p.debut) + '–' + esc(p.fin);
        }).join(' · ');
        dire('Agenda lu : <b>' + esc(r.evenements_lus) + '</b> événement(s), <b>' +
             esc(r.plages_gardees) + '</b> plage(s) qui bloqueront un créneau.' +
             (ex ? '<br><small>Par exemple : ' + ex + ' — reconnais-tu ton agenda ?</small>' : ''),
             'var(--mint,#00A870)');
      }).catch(function () { dire('Impossible de joindre le serveur.', 'var(--rose,#E5484D)'); });
    },

    brancher: function () {
      var e = document.getElementById('v2-ag-url'), u = e ? e.value.trim() : '';
      if (!u) { dire('Colle d’abord l’adresse de ton agenda.'); return; }
      dire('Connexion…');
      appeler({ action: 'brancher', url: u }).then(function (r) {
        if (!r || !r.ok) { dire(esc(msg(r && r.raison)), 'var(--rose,#E5484D)'); return; }
        if (e) e.value = '';
        V2.toast('Agenda connecté.');
        dire('Connecté : <b>' + esc(r.evenements_lus || 0) + '</b> événement(s) lus, <b>' +
             esc(r.plages_gardees || 0) + '</b> plage(s) qui bloqueront un créneau.',
             'var(--mint,#00A870)');
        if (V2.go) V2.go('rdvdispo');
      }).catch(function () { dire('Impossible de joindre le serveur.', 'var(--rose,#E5484D)'); });
    },

    debrancher: function () {
      if (!window.confirm('Débrancher ton agenda ? Les heures qui en venaient ne bloqueront plus rien.')) return;
      appeler({ action: 'debrancher' }).then(function () {
        V2.toast('Agenda débranché.');
        if (V2.go) V2.go('rdvdispo');
      });
    },

    // Relève à la demande, quand le commercial ouvre un écran qui montre son
    // planning. Le serveur se protège lui-même (pas deux lectures en moins de
    // deux minutes), donc on peut appeler sans compter.
    // Ne rejette JAMAIS : l'écran doit s'afficher même agenda muet.
    relever: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve(null);
      return appeler({ action: 'relever_moi' }).catch(function () { return null; });
    },

    // État affichable (jamais l'adresse : la base refuse de la relire).
    charger: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve(null);
      return c.from('rdv_agenda')
        .select('hote, actif, dernier_ok, dernier_essai, derniere_erreur, evenements_lus, plages_gardees')
        .eq('user_id', u).maybeSingle()
        .then(function (r) { return (r && r.data) || null; })
        .catch(function () { return null; });
    }
  };
})();

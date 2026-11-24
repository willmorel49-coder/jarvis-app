/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Mon agenda personnel (bloc de l'écran « Mes disponibilités »)

   Le commercial colle ici l'adresse privée de son agenda. À partir de là,
   tout ce qui y est déjà pris disparaît des créneaux proposés au pharmacien,
   sans qu'il ait à cocher quoi que ce soit.

   23/11/2026 — Will : « lien simplifié seulement » (ni bouton Google ni bouton
   Microsoft pour l'instant). Le bloc choisit l'outil d'après l'agenda déjà
   branché ou l'adresse du compte, ouvre la bonne page de réglages, lit le
   presse-papiers d'un toucher et vérifie le lien dès qu'il est collé.

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
  function $(id) { return document.getElementById(id); }

  // Mode d'emploi par outil. Le bouton « réglages » mène directement à la
  // page où se trouve le lien : c'est elle qui était introuvable.
  // Adresses sondées le 23/11/2026 sans session : la connexion Google et la
  // connexion Microsoft gardent toutes deux le chemin de retour.
  var MODES = [
    { cle: 'outlook', nom: 'Outlook', long: 'Outlook / Microsoft 365',
      reglages: 'https://outlook.office.com/calendar/options/calendar/SharedCalendars',
      bouton: 'Ouvrir mes réglages Outlook',
      pas: [
        'Le bouton ouvre « Calendriers partagés » (connectez-vous si on vous le demande)',
        'Sous « Publier un calendrier » : choisissez « Calendrier », puis « Peut voir quand je suis occupé », puis « Publier »',
        'Touchez le lien ICS qui apparaît, puis « Copier le lien »'
      ],
      piege: 'Pourquoi « occupé » seulement : les autres choix partageraient les titres de vos rendez-vous.' },
    { cle: 'google', nom: 'Google', long: 'Google Agenda',
      reglages: 'https://calendar.google.com/calendar/r/settings',
      bouton: 'Ouvrir mes réglages Google',
      note: 'Sur ordinateur : l’application Google Agenda du téléphone n’a pas ce réglage.',
      pas: [
        'Le bouton ouvre les paramètres de Google Agenda',
        'À gauche, sous « Paramètres de mes agendas », cliquez sur votre nom',
        'Descendez à « Intégrer l’agenda » et copiez « Adresse secrète au format iCal »'
      ],
      piege: 'Pas de ligne « Adresse secrète » ? Votre entreprise l’a désactivée : seul l’administrateur peut la rouvrir.' },
    { cle: 'apple', nom: 'iPhone', long: 'Agenda iPhone / iCloud',
      pas: [
        'Sur l’iPhone : Calendrier → Calendriers → le (i) à côté du vôtre',
        'Activez « Calendrier public »',
        'Touchez « Partager le lien » → « Copier »'
      ],
      piege: 'Le lien commence par webcal:// : collez-le tel quel, on s’occupe du reste.' }
  ];
  // Guillemets français : espace insécable, sinon « » se retrouve seul en bout de ligne.
  function nb(t) { return String(t).replace(/« /g, '«\u00a0').replace(/ »/g, '\u00a0»'); }
  MODES.forEach(function (m) { m.pas = m.pas.map(nb); if (m.piege) m.piege = nb(m.piege); if (m.note) m.note = nb(m.note); });
  function mode(cle) { for (var i = 0; i < MODES.length; i++) if (MODES[i].cle === cle) return MODES[i]; return MODES[0]; }

  // Outil présélectionné : l'agenda déjà branché d'abord, sinon l'adresse du
  // compte (l'équipe est sur Microsoft 365), sinon Outlook.
  function outilAuto(a) {
    var h = String((a && a.hote) || '');
    if (/google/.test(h)) return { cle: 'google', pourquoi: '' };
    if (/outlook|office/.test(h)) return { cle: 'outlook', pourquoi: '' };
    if (/icloud/.test(h)) return { cle: 'apple', pourquoi: '' };
    var d = String((V2.user && V2.user.email) || '').toLowerCase().split('@')[1] || '';
    if (/^(gmail|googlemail)\./.test(d)) return { cle: 'google', pourquoi: d };
    if (/^(outlook|hotmail|live)\./.test(d) || d === 'integralpharma.fr') return { cle: 'outlook', pourquoi: d };
    return { cle: 'outlook', pourquoi: '' };
  }
  function nomHote(h) {
    h = String(h || '');
    if (/google/.test(h)) return 'Google Agenda';
    if (/outlook|office/.test(h)) return 'Outlook';
    if (/icloud/.test(h)) return 'Agenda iCloud';
    return h;
  }

  var ETAT = { outil: 'outlook', pourquoi: '', ouvert: false, dernierLien: '', minuteur: 0, a: null, voulu: '' };

  function dire(html, ton) {
    var e = $('v2-ag-res');
    if (e) { e.className = 'v2-ag-res' + (ton ? ' ' + ton : ''); e.innerHTML = html; }
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
    adresse_invalide: 'Ce que vous avez collé n’est pas un lien.',
    https_obligatoire: 'Le lien doit commencer par https:// (ou webcal://).',
    agenda_injoignable: 'Votre agenda n’a pas répondu. C’est souvent l’adresse de la page qui a été copiée, et non le lien de l’agenda : reprenez l’étape « Copiez ».',
    pas_un_agenda: 'Ce lien ne renvoie pas un agenda.',
    agenda_trop_gros: 'Cet agenda est trop volumineux.',
    lecture_impossible: 'Cet agenda n’a pas pu être lu.',
    connexion_requise: 'Reconnectez-vous et réessayez.'
  };
  var msg = function (r) { return RAISONS[r] || 'Impossible pour l’instant.'; };
  var ressembleLien = function (u) { return /^(https?|webcal):\/\/\S+$/i.test(String(u || '').trim()); };

  // Le lien se branche dès qu'il est collé : plus de bouton « Tester » à part.
  function ecouter() {
    var e = $('v2-ag-url');
    if (!e || e.getAttribute('data-ecoute')) return;
    e.setAttribute('data-ecoute', '1');
    var lancer = function () {
      clearTimeout(ETAT.minuteur);
      ETAT.minuteur = setTimeout(function () {
        var u = e.value.trim();
        if (ressembleLien(u) && u !== ETAT.dernierLien) V2.rdvAgenda.brancher();
      }, 350);
    };
    e.addEventListener('paste', lancer);
    e.addEventListener('input', lancer);
  }

  // Mention de confidentialité, juste depuis l'Agenda du mois (23/11/2026) :
  // les titres sont lus en mémoire pour reconnaître les officines, jamais rangés.
  var MENTION = 'JARVIS relit vos <b>heures occupées</b> toutes les 15 minutes. ' +
    'Les titres ne servent, sur le moment, qu’à reconnaître vos officines : aucun titre, ' +
    'aucun lieu, aucun participant n’est enregistré. Le lien collé ne peut plus être ' +
    'réaffiché, même à vous.';

  // ── « Un seul geste » (maquette 2, choisie par Will le 23/11/2026) : un gros
  //    bouton Coller, l'agenda est branché aussitôt ; le mode d'emploi se déplie. ──
  function apresChoix() {
    var t = $('v2-ag-ti'); if (t) t.textContent = 'Branchez votre agenda ' + mode(ETAT.outil).nom;
  }

  function css() {
    if ($('v2-rdvag-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rdvag-css';
    s.textContent = [
      '.v2-ag-box{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:10px;overflow:hidden}',
      '.v2-ag-heros{text-align:center;padding:22px 14px 16px;border-radius:14px;background:radial-gradient(130% 90% at 50% 0%,#E6EFFF 0%,#F4F8FF 45%,#fff 80%);box-shadow:0 0 0 1px rgba(0,80,230,.08) inset}',
      '.v2-ag-ico{width:56px;height:56px;margin:0 auto 12px;border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px -12px rgba(0,80,230,.55),0 0 0 1px rgba(0,80,230,.12)}',
      '.v2-ag-ti{font-size:19px;font-weight:800;letter-spacing:-.01em;margin:0 0 4px}',
      '.v2-ag-st{font-size:14px;color:var(--muted);line-height:1.45;margin:0 auto 16px;max-width:30em}',
      '.v2-ag-coller{width:100%;min-height:54px;font-size:16.5px;border-radius:14px}',
      '.v2-ag-ou{margin-top:10px;min-height:44px;border:0;background:transparent;color:var(--ip-blue);font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;padding:0 8px}',
      '.v2-ag-ou[aria-expanded=true] .fl{display:inline-block;transform:rotate(90deg)}',
      '.v2-ag-depli{padding:14px 6px 4px}',
      '.v2-ag-lib{font-size:13px;font-weight:700;color:var(--muted);margin:0 0 7px}',
      '.v2-ag-outils{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}',
      '.v2-ag-outils button{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:#fff;font:inherit;font-size:14px;font-weight:600;color:var(--muted);cursor:pointer}',
      '.v2-ag-outils button.on{background:var(--halo,#E9F0FF);border-color:rgba(0,80,230,.35);color:var(--ip-blue)}',
      '.v2-ag-regl{width:100%;text-decoration:none;box-sizing:border-box}',
      '.v2-ag-cap{font-size:13px;color:var(--muted);margin:7px 0 0;line-height:1.45}',
      '.v2-ag-pas{margin:10px 0 0;padding-left:20px;font-size:14px;line-height:1.5}.v2-ag-pas li{margin:5px 0}',
      '.v2-ag-note{background:#FFF6E8;color:#7A4A0E;border-radius:10px;padding:8px 10px;font-size:13px;line-height:1.45;margin:9px 0 0}',
      '.v2-ag-piege{font-size:13px;color:var(--muted);margin:8px 0 0;line-height:1.45}',
      '.v2-ag-box input[type=url]{display:block;width:100%;box-sizing:border-box;min-height:44px;font-size:16px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card-2,#F6F8FB);color:inherit;margin-top:12px}',
      '.v2-ag-res{margin-top:12px;font-size:14px;line-height:1.5}.v2-ag-res:empty{display:none}.v2-ag-res.ko{color:#B4233C;background:#FDEEF1;border-radius:10px;padding:9px 11px;text-align:left}.v2-ag-res.lit{color:var(--muted)}',
      '.v2-ag-roue{display:inline-block;width:14px;height:14px;border:2px solid #C9D3E4;border-top-color:var(--ip-blue);border-radius:50%;animation:v2agr .8s linear infinite;vertical-align:-2px;margin-right:6px}',
      '@keyframes v2agr{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.v2-ag-roue{animation:none}}',
      '.v2-ag-ligne{display:flex;gap:12px;align-items:center;padding:8px 6px}',
      '.v2-ag-pt{width:12px;height:12px;border-radius:50%;flex:0 0 auto;background:#1E9E6A;box-shadow:0 0 0 4px #DDF3E9}',
      '.v2-ag-ligne.ko .v2-ag-pt{background:#C7791A;box-shadow:0 0 0 4px #FCEBD3}',
      '.v2-ag-ligne b{font-size:15px}.v2-ag-ligne small{display:block;color:var(--muted);font-size:13.5px;line-height:1.45;margin-top:2px}',
      '.v2-ag-acts{display:flex;flex-wrap:wrap;gap:8px;padding:6px 6px 2px}.v2-ag-acts .v2-btn{min-height:44px}',
      '.v2-ag-mention{margin:12px 6px 4px;font-size:13px;line-height:1.5;color:var(--muted)}'
    ].join('');
    document.head.appendChild(s);
  }

  function guide(m) {
    var pas = m.reglages ? m.pas.slice(1) : m.pas;
    return (m.reglages
        ? '<a class="v2-btn v2-btn-primary v2-ag-regl" href="' + esc(m.reglages) + '" target="_blank" rel="noopener">' + esc(m.bouton) + ' ↗</a>' +
          '<p class="v2-ag-cap">' + esc(m.pas[0]) + '.</p>' : '') +
      (m.note ? '<p class="v2-ag-note">' + esc(m.note) + '</p>' : '') +
      '<ol class="v2-ag-pas">' + pas.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>' +
      '<p class="v2-ag-piege">' + esc(m.piege) + ' Revenez ensuite ici et touchez « Coller le lien de mon agenda ».</p>';
  }

  var ICO = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="3.5" stroke="#0050E6" stroke-width="1.8"/><path d="M3 9.5h18" stroke="#0050E6" stroke-width="1.8"/><path d="M8 2.8v3.4M16 2.8v3.4" stroke="#0050E6" stroke-width="1.8" stroke-linecap="round"/><path d="m8.6 14.6 2.2 2.2 4.6-4.6" stroke="#1E9E6A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function rendu(a) {
    var branche = !!(a && a.hote);
    if (branche && !ETAT.ouvert) {
      var vieux = !a.dernier_ok || (Date.now() - new Date(a.dernier_ok).getTime()) > 2 * 3600 * 1000;
      return '<div class="v2-ag-ligne' + (vieux ? ' ko' : '') + '"><span class="v2-ag-pt"></span><div>' +
          (vieux
            ? '<b>' + esc(nomHote(a.hote)) + ' : pas relu depuis ' + esc(depuis(a.dernier_ok).replace('il y a ', '')) + '</b>' +
              '<small>' + (a.derniere_erreur ? esc(String(a.derniere_erreur).slice(0, 60)) + ' · ' : '') + 'le lien a peut-être changé</small>'
            : '<b>' + esc(nomHote(a.hote)) + ' branché</b> · relu ' + esc(depuis(a.dernier_ok)) +
              '<small>' + (a.plages_gardees != null ? esc(a.plages_gardees) + ' plage(s) occupée(s) à venir bloquent vos créneaux · ' : '') + 'relu toutes les 15 min</small>') +
        '</div></div>' +
        '<div class="v2-ag-acts">' +
          (V2.pages && V2.pages.rdvplanning ? '<button class="v2-btn" onclick="V2.go(\'rdvplanning\')">Voir mon agenda</button>' : '') +
          '<button class="v2-btn' + (vieux ? ' v2-btn-primary' : '') + '" onclick="V2.rdvAgenda.changer()">Changer de lien</button>' +
          '<button class="v2-btn" onclick="V2.rdvAgenda.debrancher()">Débrancher</button>' +
        '</div><p class="v2-ag-mention">' + MENTION + '</p>';
    }
    var outils = MODES.map(function (m) {
      return '<button type="button" data-m="' + m.cle + '" class="' + (m.cle === ETAT.outil ? 'on' : '') + '" aria-pressed="' +
        (m.cle === ETAT.outil) + '" onclick="V2.rdvAgenda.aide(\'' + m.cle + '\')">' + esc(m.long) + '</button>';
    }).join('');
    return '<div class="v2-ag-heros">' +
        '<div class="v2-ag-ico">' + ICO + '</div>' +
        '<p class="v2-ag-ti" id="v2-ag-ti">Branchez votre agenda ' + esc(mode(ETAT.outil).nom) + '</p>' +
        '<p class="v2-ag-st">Vos rendez-vous déjà pris ne seront plus proposés aux pharmaciens. Copiez le lien de votre agenda, puis un seul toucher ici.</p>' +
        '<button class="v2-btn v2-btn-primary v2-ag-coller" onclick="V2.rdvAgenda.coller()">Coller le lien de mon agenda</button>' +
        '<div class="v2-ag-res" id="v2-ag-res" aria-live="polite"></div>' +
        '<button type="button" class="v2-ag-ou" id="v2-ag-ou" aria-expanded="false" aria-controls="v2-ag-depli" onclick="V2.rdvAgenda.deplier()">Où trouver ce lien ? <span class="fl">›</span></button>' +
      '</div>' +
      '<div class="v2-ag-depli" id="v2-ag-depli" hidden>' +
        '<p class="v2-ag-lib">Mon agenda est sur' + (ETAT.pourquoi ? ' (choisi d’après votre adresse @' + esc(ETAT.pourquoi) + ')' : '') + '</p>' +
        '<div class="v2-ag-outils" role="group" aria-label="Mon agenda est sur">' + outils + '</div>' +
        '<div id="v2-ag-guide"></div>' +
        '<input type="url" id="v2-ag-url" inputmode="url" autocomplete="off" spellcheck="false" ' +
          'placeholder="ou collez le lien ici à la main" aria-label="Lien de mon agenda" />' +
      '</div>' +
      (branche ? '<div class="v2-ag-acts"><button class="v2-btn" onclick="V2.go(\'rdvdispo\')">Annuler</button></div>' : '') +
      '<p class="v2-ag-mention">' + MENTION + '</p>';
  }

  V2.rdvAgenda = {
    // Rendu du bloc. `a` = ligne rdv_agenda (sans l'adresse, elle n'est pas lisible).
    bloc: function (a) {
      css();
      // 24/11/2026 — l'outil choisi d'un toucher depuis le mois (V2.rdvAgenda.choisir) passe avant l'outil deviné.
      var o = outilAuto(a), voulu = ETAT.voulu || '';
      ETAT.voulu = '';
      if (voulu && voulu !== 'changer') o = { cle: mode(voulu).cle, pourquoi: '' };
      ETAT.outil = o.cle; ETAT.pourquoi = o.pourquoi;
      ETAT.ouvert = !(a && a.hote) || !!voulu; ETAT.dernierLien = '';
      ETAT.a = a || null;
      setTimeout(ecouter, 0);
      // arrivé depuis le mois : le mode d'emploi de l'outil choisi est déjà ouvert, et le bloc à l'écran
      if (voulu) setTimeout(function () {
        var d = $('v2-ag-depli'); if (d && d.hidden) V2.rdvAgenda.deplier();
        var b = $('v2-ag-box'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 60);
      return '<div class="v2-ag-box" id="v2-ag-box">' + rendu(a) + '</div>';
    },

    // Depuis le mois (Rendez-vous, To do) : « Mon agenda est sur Google / Outlook / iPhone », ou vide pour
    // « Changer d'agenda ». L'écran Mes disponibilités s'ouvre sur le branchement, l'outil déjà choisi.
    choisir: function (cle) { ETAT.voulu = cle || 'changer'; if (V2.go) V2.go('rdvdispo'); },

    // Sans argument (appel de l'écran juste après l'affichage) : l'outil présélectionné.
    aide: function (cle) {
      ETAT.outil = mode(cle || ETAT.outil).cle;
      var bt = document.querySelectorAll('.v2-ag-outils [data-m]');
      for (var i = 0; i < bt.length; i++) {
        var on = bt[i].getAttribute('data-m') === ETAT.outil;
        bt[i].classList.toggle('on', on); bt[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      var e = $('v2-ag-guide');
      if (e) e.innerHTML = guide(mode(ETAT.outil));
      apresChoix();
      ecouter();
    },

    // Rouvre le pas-à-pas quand l'agenda est déjà branché (« Changer de lien »).
    changer: function () {
      ETAT.ouvert = true;
      var b = $('v2-ag-box'); if (!b) return;
      b.innerHTML = rendu(ETAT.a);
      V2.rdvAgenda.aide();
    },

    // Un toucher : Safari affiche sa bulle « Coller », le lien arrive dans la case.
    coller: function () {
      var e = $('v2-ag-url');
      var aLaMain = function () {
        if (e) { if (e.closest) { var z = e.closest('[hidden]'); if (z) z.hidden = false; } e.focus(); }
        dire('Collez le lien dans la case : ⌘V sur ordinateur, appui long puis « Coller » sur téléphone.');
      };
      if (!navigator.clipboard || !navigator.clipboard.readText) { aLaMain(); return; }
      navigator.clipboard.readText().then(function (t) {
        t = String(t || '').trim();
        if (!t) { aLaMain(); return; }
        if (e) e.value = t;
        V2.rdvAgenda.brancher();
      }, aLaMain);
    },

    brancher: function () {
      var e = $('v2-ag-url'), u = e ? e.value.trim() : '';
      if (!u) { dire('Collez d’abord le lien de votre agenda.'); return; }
      // Branché d'un geste : la connexion lit déjà l'agenda (une seule lecture,
      // Google rationne son flux). Le résultat s'affiche dans l'état « branché ».
      ETAT.dernierLien = u;
      dire('<span class="v2-ag-roue" aria-hidden="true"></span> Lecture et connexion de votre agenda…', 'lit');
      appeler({ action: 'brancher', url: u }).then(function (r) {
        if (!r || !r.ok) { dire(esc(msg(r && r.raison)), 'ko'); return; }
        if (e) e.value = '';
        V2.toast('Agenda connecté.');
        if (V2.go) V2.go('rdvdispo');
      }).catch(function () { dire('Impossible de joindre le serveur.', 'ko'); });
    },

    // « Où trouver ce lien ? » : déplie le mode d'emploi et la case à la main.
    deplier: function () {
      var d = $('v2-ag-depli'), b = $('v2-ag-ou');
      if (!d) return;
      d.hidden = !d.hidden;
      if (b) b.setAttribute('aria-expanded', d.hidden ? 'false' : 'true');
    },

    debrancher: function () {
      if (!window.confirm('Débrancher votre agenda ? Les heures qui en venaient ne bloqueront plus rien.')) return;
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

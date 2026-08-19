/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Campagne de prise de RDV (pages.campagne)
   Trois étapes : le motif, la liste, puis la file d'attente d'envoi.
   Chaque mail part de la boîte du commercial : JARVIS le prépare, il
   relit et il envoie. C'est lui qui coche « envoyé » — JARVIS ne peut
   pas le savoir, et il vaut mieux le dire que le supposer.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };

  var ETAT = {
    // Le mode d'envoi. 'un' = un mail personnalisé par officine, avec un
    // lien à usage unique (le mode d'origine). 'groupe' = un seul mail vers
    // 25 officines en copie cachée, avec le lien permanent du commercial.
    // Tout ce qui précède l'envoi — motif, ciblage, sélection — est commun :
    // seule la dernière étape change, et elle vit dans v2-rdv-groupe.js.
    mode: 'un',
    modele: 'routine', texte: '', file: [], i: 0, envoyes: 0, passes: 0,
    tous: [],          // tout ce que le commercial peut viser, recensé une fois
    opposes: [],       // « ne plus solliciter »
    comm: null,        // le commercial visé — null = pas encore choisi
    type: 'tous',      // tous | clients | prospects
    groupements: [],   // vide = tous les groupements
    choisis: {}        // cip -> 1, la sélection à la main
  };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function root() { return document.getElementById('v2-root'); }

  function ensureCss() {
    if (document.getElementById('v2-camp-css')) return;
    var s = document.createElement('style'); s.id = 'v2-camp-css';
    s.textContent = [
      '.v2-camp-hero{margin:8px 0 18px}',
      '.v2-camp-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.v2-camp-hero p{color:var(--muted);font-size:14px;max-width:56ch;margin:0;line-height:1.5}',
      '.v2-camp-sec{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:24px 0 10px}',
      '.v2-camp-box{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:14px;margin-bottom:10px}',
      '.v2-camp-box label{display:block;font-weight:700;font-size:13px;margin:0 0 6px}',
      '.v2-camp-box label + p{color:var(--muted);font-size:12.5px;margin:-4px 0 8px}',
      '.v2-camp-box select,.v2-camp-box textarea,.v2-camp-box input{width:100%;font:inherit;font-size:16px;',
      '  min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;',
      '  background:var(--card-2);color:var(--ip-ink)}',
      '.v2-camp-box input.court{width:110px}',
      '.v2-camp-duo{display:flex;flex-wrap:wrap;gap:16px}',
      '.v2-camp-cpt{font-size:15px;font-weight:800;margin:0 0 4px}',
      '.v2-camp-barre{height:6px;background:var(--card-2);border:1px solid var(--line);border-radius:99px;overflow:hidden;margin:8px 0 16px}',
      '.v2-camp-barre i{display:block;height:100%;background:var(--ip-blue)}',
      '.v2-camp-cible{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:16px;margin-bottom:14px}',
      '.v2-camp-cible b{display:block;font-size:17px;letter-spacing:-.01em}',
      '.v2-camp-cible span{color:var(--muted);font-size:13.5px}',
      '.v2-camp-acts{display:flex;flex-wrap:wrap;gap:10px}',
      '.v2-camp-acts .v2-btn{min-height:48px}',
      '.v2-camp-note{color:var(--muted);font-size:13px;margin:14px 0 0;line-height:1.5}',
      // Sélection : cibles tactiles à 44 px minimum, la liste défile seule.
      '.cp-type{display:flex;flex-wrap:wrap;gap:6px}',
      '.cp-type button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);',
      '  background:transparent;color:inherit;font:inherit;cursor:pointer}',
      '.cp-type button.on{border-color:var(--ip-blue);color:var(--ip-blue);font-weight:700}',
      '.cp-cpt{font-size:14px;margin:0 0 10px}',
      '.cp-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}',
      '.cp-chip{min-height:44px;padding:0 12px;border-radius:20px;border:1px solid var(--line);',
      '  background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer}',
      '.cp-chip b{opacity:.6;font-weight:600;margin-left:4px}',
      '.cp-chip.on{border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.cp-selacts{display:flex;gap:8px;margin-bottom:10px}',
      '.cp-selacts .v2-btn{min-height:44px}',
      '.cp-liste{list-style:none;margin:0;padding:0;max-height:60vh;overflow-y:auto;',
      '  border:1px solid var(--line);border-radius:var(--r-md)}',
      '.cp-l{display:flex;align-items:center;gap:10px;padding:10px 12px;min-height:56px;',
      '  border-bottom:1px solid var(--line);cursor:pointer}',
      '.cp-l:last-child{border-bottom:0}',
      '.cp-l.on{background:rgba(0,87,255,.08)}',
      '.cp-case{flex:0 0 auto;width:24px;height:24px;border-radius:7px;border:1px solid var(--line);',
      '  display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--ip-blue)}',
      '.cp-l.on .cp-case{border-color:var(--ip-blue)}',
      '.cp-nom{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.cp-nom b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cp-nom small{color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cp-tag{flex:0 0 auto;font-size:11px;font-weight:700;text-transform:uppercase;',
      '  letter-spacing:.04em;padding:3px 8px;border-radius:20px;border:1px solid var(--line)}',
      '.cp-tag.cl{color:#00A870;border-color:#00A87055}',
      '.cp-tag.pr{color:var(--muted)}'
    ].join('');
    document.head.appendChild(s);
  }

  // Recensement : V2CIBLE réunit les clients (ventes réseau) et les prospects
  // (base nationale, seule à porter le groupement). V2.rdvInfo réconcilie les
  // adresses mail des trois sources. Le CIP est la clé partout, y compris
  // pour la liste « ne plus solliciter ».
  // Le commercial du compte connecté, tel que le reste du CRM le nomme
  // (v2-pilotage.js : « jamais un collègue »). Peut être vide pour un compte
  // qui n'est rattaché à aucun secteur — un admin, par exemple.
  function moi() { return (V2.user && V2.user.commercial) ? String(V2.user.commercial) : ''; }

  function recenser() {
    var D = window.PHARMA_FR || null;
    var comm = ETAT.comm || '';
    // Sans commercial choisi, on ne recense RIEN. Montrer les officines de
    // toute l'équipe n'est pas un repli acceptable : on écrit à des clients
    // qui ne sont pas les siens, et la règle géographique n'a plus de sens.
    if (!comm) return [];
    // Un client appartient à un commercial via `comms` — même critère que la
    // liste des officines (v2-pharma.js).
    var miennes = (V2.pharmacies || []).filter(function (p) {
      return (p.comms || []).indexOf(comm) >= 0;
    });
    // Son secteur = les départements de ses clientes. Sans ce repli, l'option
    // « Prospects » ne rendait JAMAIS rien : 16 850 des 17 367 prospects de la
    // base n'ont aucun commercial attribué.
    var depts = {}, dl = [];
    miennes.forEach(function (p) {
      var d = String(p.cp || '').slice(0, 2);
      if (d.length === 2 && !depts[d]) { depts[d] = 1; dl.push(d); }
    });
    return window.V2CIBLE.recenser({
      pharmacies: miennes,
      national: D ? { p: D.p, seg: D.seg, grp: D.grp, comm: D.comm } : null,
      commercial: comm,
      departements: dl,
      info: function (cip) { return V2.rdvInfo(cip); }
    });
  }

  // Un bouton par commercial. Le compte connecté atterrit sur le sien et ne
  // peut pas en changer — même règle que le pilotage (« jamais un collègue »).
  // Un compte non rattaché à un secteur (admin) choisit, mais doit choisir.
  function boutonsComm() {
    var m = moi();
    var liste = m ? [m] : (V2.commercials ? V2.commercials() : []);
    if (!liste.length) {
      return '<span class="v2-camp-note" style="margin:0">Aucun commercial identifié sur ce compte.</span>';
    }
    return liste.map(function (cm) {
      return '<button data-c="' + esc(cm) + '" class="' + (ETAT.comm === cm ? 'on' : '') +
        '" onclick="V2.campagne.viser(' + esc(JSON.stringify(cm)).replace(/"/g, '&quot;') +
        ')">' + esc(cm) + '</button>';
    }).join('');
  }

  // Ce que le mode choisi change concrètement, écrit sous les deux boutons.
  // Les deux limites citées sont mesurées : 2 048 caractères d'URL `mailto:`
  // sous Outlook (dépassés dès 25 adresses), et le lot de 25 au-delà duquel
  // les messageries d'officine trient un envoi caché en indésirable.
  function noteMode() {
    return ETAT.mode === 'groupe'
      ? 'Un seul mail part vers 25 officines à la fois, toutes en copie cachée. ' +
        'Elles ne se voient pas entre elles. Le mail ne peut nommer personne ni ' +
        'porter de chiffres : il contient ton lien permanent, et c’est le pharmacien ' +
        'qui déclare son officine avant de choisir son créneau. Beaucoup plus rapide, ' +
        'un peu moins personnel.'
      : 'Un mail par officine, avec son nom, ses chiffres, et un lien à usage unique. ' +
        'Tu ouvres, tu relis, tu envoies, officine après officine. Le plus efficace, ' +
        'mais compte 20 à 40 officines dans une session.';
  }

  // Filtres courants de l'écran.
  function filtres() {
    return {
      type: ETAT.type,
      groupements: ETAT.groupements,
      dept: (val('cp-dept') || '').trim(),
      recherche: (val('cp-q') || '').trim(),
      opposes: ETAT.opposes
    };
  }

  function visibles() {
    var l = window.V2CIBLE.filtrer(ETAT.tous, filtres());
    var caMax = parseInt(val('cp-camax'), 10) || 0;
    if (!caMax) return l;
    return l.filter(function (o) { return (V2.rdvCA(o.cip) || 0) <= caMax; });
  }

  V2.campagne = {
    // Charge les deux bases + la liste d'opposition, puis affiche la liste
    // cochable. Fait une seule fois : PHARMA_FR pèse lourd.
    chercher: function () {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi pour préparer une campagne.'); return; }
      var z = document.getElementById('cp-liste');
      if (!ETAT.comm) {
        if (z) z.innerHTML = '<p class="v2-camp-note">Choisis d’abord un commercial ci-dessus.</p>';
        return;
      }
      if (z) z.innerHTML = '<p class="v2-camp-note">Chargement des officines…</p>';
      V2.rdvSources().then(function () {
        // Liste d'opposition COMMUNE : une officine qui dit stop à Karine ne
        // doit plus recevoir les mails de Morgane non plus. Le refus s'adresse
        // à Intégral, pas à la personne qui a envoyé le mail.
        return c.rpc('rdv_opposes');
      }).then(function (r) {
        ETAT.opposes = ((r && r.data) || []).map(function (x) {
          return String(x && x.cip != null ? x.cip : x);   // la fonction renvoie des CIP bruts
        });
        ETAT.tous = recenser();
        // Arrivée depuis le planning : la liste est déjà faite, on la coche.
        // Ici et pas ailleurs — « viser » remet la sélection à zéro quand on
        // change de commercial, et cocher avant serait sans effet.
        if (V2.campagnePreselection && V2.campagnePreselection.length) {
          var demandes = V2.campagnePreselection.map(String);
          // On ne coche QUE ce qui est réellement dans la liste du commercial.
          // Une officine relancée peut avoir quitté son portefeuille depuis
          // l'envoi — et cocher une ligne qui n'existe pas ne se voit pas.
          var presentes = {};
          ETAT.tous.forEach(function (o) { presentes[String(o.cip)] = 1; });
          ETAT.choisis = {};
          var trouvees = 0;
          demandes.forEach(function (cip) {
            if (presentes[cip]) { ETAT.choisis[cip] = 1; trouvees++; }
          });
          V2.campagnePreselection = null;
          // ⚠️ Le dire. Un écran qui affiche « 0 coché » après un clic sur
          // « relancer les 24 » laisse croire à une panne ; pire, un écran qui
          // n'en coche que 18 sans rien dire fait disparaître 6 officines en
          // silence. On annonce l'écart et sa raison.
          var perdues = demandes.length - trouvees;
          if (perdues > 0) {
            V2.toast(trouvees + ' officine' + (trouvees > 1 ? 's' : '') + ' sur ' +
              demandes.length + ' — ' + perdues +
              (perdues > 1 ? ' ne sont plus' : ' n’est plus') +
              ' dans ta liste (portefeuille, filtre commercial ou opposition).');
          }
        }
        V2.campagne.rafraichir();
      }).catch(function () {
        if (z) z.innerHTML = '<p class="v2-camp-note">Chargement impossible. Réessaie.</p>';
      });
    },

    // Changer de commercial vide la sélection : garder des officines cochées
    // qui ne sont plus dans la liste enverrait des mails au nom du mauvais.
    viser: function (cm) {
      if (ETAT.comm === cm) return;
      ETAT.comm = cm;
      ETAT.choisis = {}; ETAT.groupements = []; ETAT.tous = [];
      var bt = document.querySelectorAll('.cp-comm button');
      for (var i = 0; i < bt.length; i++) bt[i].classList.toggle('on', bt[i].getAttribute('data-c') === cm);
      V2.campagne.chercher();
    },

    // Aperçu du mail tel qu'il partira. Calé sur la première officine cochée
    // quand il y en a une : voir SES chiffres vaut mieux qu'un exemple neutre.
    apercu: function () {
      if (!window.V2rdvApercuPret) { window.V2rdvApercuPret = 1; }
      var cips = Object.keys(ETAT.choisis);
      V2.rdvApercu.montrer('cp-apercu', val('cp-modele') || 'routine',
                           val('cp-texte') || '', cips.length ? cips[0] : null,
                           ETAT.mode === 'groupe');
    },

    // Recompose la liste des motifs : trois livrés + ceux du commercial.
    // Rappelée à chaque changement de mode, parce qu'un modèle qui nomme
    // l'officine se désactive en copie cachée.
    majModeles: function () {
      if (!V2.rdvModeles) return;
      V2.rdvModeles.charger().then(function () {
        var sel = document.getElementById('cp-modele');
        if (!sel) return;
        var garde = sel.value || ETAT.modele || 'routine';
        var base = window.V2MOD.liste().map(function (m) {
          return '<option value="' + esc(m.cle) + '">' + esc(m.nom) + '</option>';
        }).join('');
        sel.innerHTML = base + V2.rdvModeles.options(ETAT.mode === 'groupe');
        // Le motif gardé peut être devenu indisponible (modèle archivé, ou
        // nominatif alors qu'on vient de passer en groupé) : on retombe sur
        // « routine » et on le DIT, plutôt que de laisser un choix fantôme.
        sel.value = garde;
        if (sel.value !== garde) {
          sel.value = 'routine';
          ETAT.modele = 'routine';
          V2.toast('Ce modèle ne peut pas partir en copie cachée — motif « routine » repris.');
        }
        V2.campagne.apercu();
      });
    },

    typer: function (t) { ETAT.type = t; V2.campagne.rafraichir(); },

    groupe: function (g) {
      var i = ETAT.groupements.indexOf(g);
      if (i < 0) ETAT.groupements.push(g); else ETAT.groupements.splice(i, 1);
      V2.campagne.rafraichir();
    },

    basculer: function (cip) {
      if (ETAT.choisis[cip]) delete ETAT.choisis[cip]; else ETAT.choisis[cip] = 1;
      V2.campagne.majBarre();
      var e = document.getElementById('cp-l-' + cip);
      if (e) e.classList.toggle('on', !!ETAT.choisis[cip]);
      // Première officine cochée : l'aperçu prend ses chiffres à elle.
      if (Object.keys(ETAT.choisis).length <= 1) V2.campagne.apercu();
    },

    // Coche ou décoche TOUT CE QUI EST AFFICHÉ, pas toute la base : sinon on
    // sélectionne sans le voir des officines écartées par un filtre.
    tout: function (on) {
      visibles().forEach(function (o) {
        if (on) ETAT.choisis[o.cip] = 1; else delete ETAT.choisis[o.cip];
      });
      V2.campagne.rafraichir();
    },

    majBarre: function () {
      var n = Object.keys(ETAT.choisis).length;
      var b = document.getElementById('cp-envoi');
      if (!b) return;
      b.disabled = !n;
      if (!n) { b.textContent = 'Sélectionne des officines'; return; }
      if (ETAT.mode === 'groupe') {
        var lots = Math.ceil(n / 25);
        b.textContent = 'Préparer ' + lots + ' envoi' + (lots > 1 ? 's' : '') +
                        ' groupé' + (lots > 1 ? 's' : '') + ' · ' + n + ' officines';
      } else {
        b.textContent = 'Préparer ' + n + ' mail' + (n > 1 ? 's' : '');
      }
    },

    rafraichir: function () {
      var z = document.getElementById('cp-liste'); if (!z) return;
      var l = visibles(), c = window.V2CIBLE.compter(l);
      var grps = window.V2CIBLE.groupements(window.V2CIBLE.filtrer(ETAT.tous, {
        type: ETAT.type, opposes: ETAT.opposes
      }));

      var chips = grps.slice(0, 14).map(function (g) {
        var on = ETAT.groupements.indexOf(g.nom) >= 0;
        return '<button class="cp-chip' + (on ? ' on' : '') + '" onclick="V2.campagne.groupe(' +
          esc(JSON.stringify(g.nom)).replace(/"/g, '&quot;') + ')">' +
          esc(g.nom === '—' ? 'Sans groupement' : g.nom) + ' <b>' + g.n + '</b></button>';
      }).join('');

      var lignes = l.map(function (o) {
        var on = !!ETAT.choisis[o.cip];
        return '<li id="cp-l-' + esc(o.cip) + '" class="cp-l' + (on ? ' on' : '') +
          '" onclick="V2.campagne.basculer(' + esc(JSON.stringify(o.cip)).replace(/"/g, '&quot;') + ')">' +
          '<span class="cp-case">' + (on ? '✓' : '') + '</span>' +
          '<span class="cp-nom"><b>' + esc(o.nom) + '</b>' +
            '<small>' + esc(o.ville || '') + (o.cp ? ' · ' + esc(o.cp) : '') +
            (o.groupement ? ' · ' + esc(o.groupement) : '') + '</small></span>' +
          '<span class="cp-tag ' + (o.type === 'client' ? 'cl' : 'pr') + '">' +
            (o.type === 'client' ? 'client' : 'prospect') + '</span></li>';
      }).join('');

      z.innerHTML =
        '<div class="cp-cpt"><b>' + c.total + '</b> officine' + (c.total > 1 ? 's' : '') +
          ' joignable' + (c.total > 1 ? 's' : '') + ' · ' + c.clients + ' client' +
          (c.clients > 1 ? 's' : '') + ' · ' + c.prospects + ' prospect' +
          (c.prospects > 1 ? 's' : '') + '</div>' +
        (chips ? '<div class="cp-chips">' + chips + '</div>' : '') +
        '<div class="cp-selacts">' +
          '<button class="v2-btn v2-btn-ghost" onclick="V2.campagne.tout(true)">Tout cocher</button>' +
          '<button class="v2-btn v2-btn-ghost" onclick="V2.campagne.tout(false)">Tout décocher</button>' +
        '</div>' +
        (lignes ? '<ul class="cp-liste">' + lignes + '</ul>'
                : '<p class="v2-camp-note">Aucune officine avec ces filtres. ' +
                  'Les officines sans adresse mail et celles marquées « ne plus solliciter » ' +
                  'sont toujours écartées.</p>');

      // ⚠️ `[data-t]` est indispensable : la classe `cp-type` habille AUSSI la
      // rangée des commerciaux et celle du mode d'envoi. Sans ce filtre, le
      // sélecteur attrapait 6 boutons au lieu de 3 et retirait leur état actif
      // — le mode « groupé » restait choisi en mémoire mais plus rien ne
      // l'indiquait à l'écran. Le défaut existait déjà pour le commercial.
      var bt = document.querySelectorAll('.cp-type button[data-t]');
      for (var i = 0; i < bt.length; i++)
        bt[i].classList.toggle('on', bt[i].getAttribute('data-t') === ETAT.type);
      V2.campagne.majBarre();
    },

    // Bascule un par un / groupé. Elle ne touche NI la sélection NI les
    // filtres : on doit pouvoir changer d'avis sur la façon d'envoyer sans
    // refaire sa liste.
    mode: function (m) {
      ETAT.mode = m;
      var bt = document.querySelectorAll('.cp-mode button');
      for (var i = 0; i < bt.length; i++)
        bt[i].classList.toggle('on', bt[i].getAttribute('data-m') === m);
      var e = document.getElementById('cp-mode-note');
      if (e) e.innerHTML = noteMode();
      // majModeles rappelle apercu() une fois la liste recomposée.
      V2.campagne.majModeles();
      V2.campagne.apercu();
      V2.campagne.majBarre();
    },

    lancer: function () {
      ETAT.modele = val('cp-modele') || 'routine';
      ETAT.texte = val('cp-texte');
      if (ETAT.modele === 'offre' && window.V2MOD.texteRefuse(ETAT.texte)) {
        V2.toast('Retire le pourcentage : les conditions commerciales ne s’écrivent pas dans un mail.');
        return;
      }
      // On repart de TOUT le recensement, pas de l'affichage : une officine
      // cochée puis masquée par un filtre reste dans l'envoi.
      ETAT.file = ETAT.tous.filter(function (o) { return ETAT.choisis[o.cip]; });
      ETAT.i = 0; ETAT.envoyes = 0; ETAT.passes = 0;
      if (!ETAT.file.length) { V2.toast('Coche au moins une officine.'); return; }
      if (ETAT.mode === 'groupe') {
        if (!V2.rdvGroupe) { V2.toast('Envoi groupé indisponible — recharge la page.'); return; }
        V2.rdvGroupe.demarrer(ETAT.file, ETAT.modele, ETAT.texte);
        return;
      }
      V2.campagne.afficherFile();
    },

    afficherFile: function () {
      var r = root(); if (!r) return;
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      if (ETAT.i >= ETAT.file.length) {
        r.innerHTML = top + '<div class="v2-wrap narrow"><div class="v2-camp-hero">' +
          '<h1>Campagne terminée</h1><p><b>' + ETAT.envoyes + '</b> mail(s) envoyé(s) sur ' +
          ETAT.file.length + (ETAT.passes ? ' · ' + ETAT.passes + ' passée(s)' : '') + '.</p></div>' +
          '<div class="v2-camp-acts">' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.go(\'rdv\')">Voir mes rendez-vous</button>' +
            '<button class="v2-btn" onclick="V2.go(\'campagne\')">Nouvelle campagne</button>' +
          '</div></div>';
        return;
      }
      var o = ETAT.file[ETAT.i];
      var pct = Math.round(ETAT.i / ETAT.file.length * 100);
      r.innerHTML = top + '<div class="v2-wrap narrow">' +
        '<p class="v2-camp-cpt">' + (ETAT.i + 1) + ' sur ' + ETAT.file.length + '</p>' +
        '<div class="v2-camp-barre"><i style="width:' + pct + '%"></i></div>' +
        '<div class="v2-camp-cible"><b>' + esc(o.nom) + '</b>' +
          '<span>' + esc(o.ville) + (o.ville ? ' · ' : '') + esc(o.email) + '</span></div>' +
        '<div class="v2-camp-acts">' +
          '<button class="v2-btn v2-btn-primary" id="cp-ouvrir" onclick="V2.campagne.ouvrir()">Ouvrir le mail</button>' +
          '<button class="v2-btn" onclick="V2.campagne.passer()">Passer</button>' +
        '</div>' +
        '<div class="v2-camp-acts" id="cp-apres" style="display:none;margin-top:12px">' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.campagne.marquerEnvoye()">Envoyé ' +
            ICO('check', 15) + ' → suivant</button>' +
        '</div>' +
        '<p class="v2-camp-note">Ta messagerie s’ouvre avec le mail prêt. Relis, envoie, reviens ici. ' +
          'JARVIS ne peut pas savoir si le mail est vraiment parti — c’est toi qui coches.</p>' +
      '</div>';
    },

    ouvrir: function () {
      var o = ETAT.file[ETAT.i];
      var b = document.getElementById('cp-ouvrir');
      if (b) { b.disabled = true; b.textContent = 'Préparation…'; }
      V2.rdv.preparerMail(o.cip, ETAT.modele, ETAT.texte, function (ok) {
        if (b) { b.disabled = false; b.textContent = 'Ouvrir le mail'; }
        if (!ok) return;
        var e = document.getElementById('cp-apres');
        if (e) e.style.display = '';
      });
    },

    marquerEnvoye: function () { ETAT.envoyes++; ETAT.i++; V2.campagne.afficherFile(); },
    passer: function () { ETAT.passes++; ETAT.i++; V2.campagne.afficherFile(); }
  };

  V2.pages.campagne = {
    render: function (r) {
      ensureCss();
      // Le commercial du compte atterrit sur le sien. Un compte non rattaché
      // (admin) arrive sans choix fait, et doit en faire un : c'est ce qui
      // évite d'écrire aux clients de toute l'équipe.
      if (ETAT.comm === null) ETAT.comm = moi() || null;
      // Arrivée depuis une relance du suivi : le mode est déjà décidé, il
      // serait absurde de faire rechoisir « groupé » à quelqu'un qui vient
      // de cliquer « relancer les 24 sans réponse » d'un envoi groupé.
      if (V2.campagneModeVoulu) { ETAT.mode = V2.campagneModeVoulu; V2.campagneModeVoulu = null; }
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      var mods = window.V2MOD.liste().map(function (m) {
        return '<option value="' + esc(m.cle) + '">' + esc(m.nom) + '</option>';
      }).join('');
      r.innerHTML = top + '<div class="v2-wrap narrow">' +
        '<div class="v2-camp-hero"><h1>Campagne de rendez-vous</h1>' +
          '<p>Le mail part de ta boîte, signé de ton nom. Tu relis, tu envoies. ' +
          'JARVIS prépare, il n’envoie jamais à ta place.</p></div>' +

        '<div class="v2-camp-sec">Comment tu envoies</div>' +
        '<div class="v2-camp-box">' +
          '<div class="cp-type cp-mode">' +
            '<button data-m="un" class="' + (ETAT.mode === 'un' ? 'on' : '') +
              '" onclick="V2.campagne.mode(\'un\')">Un par un, personnalisé</button>' +
            '<button data-m="groupe" class="' + (ETAT.mode === 'groupe' ? 'on' : '') +
              '" onclick="V2.campagne.mode(\'groupe\')">Groupé en copie cachée</button>' +
          '</div>' +
          '<p id="cp-mode-note" style="color:var(--muted);font-size:12.5px;margin:10px 0 0;' +
            'line-height:1.55">' + noteMode() + '</p>' +
        '</div>' +

        '<div class="v2-camp-sec">Le motif</div>' +
        '<div class="v2-camp-box">' +
          '<label for="cp-modele">Pourquoi tu leur écris</label>' +
          '<select id="cp-modele" onchange="V2.campagne.apercu()">' + mods + '</select>' +
          (V2.pages.rdvmodeles
            ? '<p style="margin:8px 0 0"><button class="v2-btn v2-btn-ghost" ' +
              'onclick="V2.go(\'rdvmodeles\')">Écrire mes propres modèles</button></p>' : '') +
          '<label for="cp-texte" style="margin-top:14px">Ton texte (modèle « nouveauté » uniquement)</label>' +
          '<p>Deux lignes, réutilisées pour toute la liste. Aucun pourcentage : ' +
            'les conditions commerciales ne s’écrivent pas dans un mail.</p>' +
          '<textarea id="cp-texte" rows="2" oninput="V2.campagne.apercu()" placeholder="Ex. La gamme diabète arrive en septembre."></textarea>' +
        '</div>' +

        '<div class="v2-camp-sec">Aperçu du mail</div>' +
        '<div id="cp-apercu"></div>' +

        '<div class="v2-camp-sec">Qui tu vises</div>' +
        '<div class="v2-camp-box">' +
          '<label>Commercial</label>' +
          '<p>On n’écrit qu’aux officines de ce commercial — clients comme prospects.</p>' +
          '<div class="cp-type cp-comm" style="margin-bottom:14px">' + boutonsComm() + '</div>' +
          '<div class="cp-type">' +
            '<button data-t="tous" class="on" onclick="V2.campagne.typer(\'tous\')">Clients et prospects</button>' +
            '<button data-t="clients" onclick="V2.campagne.typer(\'clients\')">Clients</button>' +
            '<button data-t="prospects" onclick="V2.campagne.typer(\'prospects\')">Prospects</button>' +
          '</div>' +
          '<div class="v2-camp-duo" style="margin-top:12px">' +
            '<div><label for="cp-dept">Département</label>' +
              '<input id="cp-dept" class="court" inputmode="numeric" maxlength="2" placeholder="tous" ' +
              'oninput="V2.campagne.rafraichir()" /></div>' +
            '<div><label for="cp-camax">CA maximum (€)</label>' +
              '<input id="cp-camax" class="court" type="number" min="0" step="1000" placeholder="aucun" ' +
              'oninput="V2.campagne.rafraichir()" /></div>' +
          '</div>' +
          '<label for="cp-q" style="margin-top:14px">Chercher</label>' +
          '<input id="cp-q" type="search" placeholder="nom d’officine ou ville" ' +
            'oninput="V2.campagne.rafraichir()" />' +
          '<div class="v2-camp-acts" style="margin-top:14px">' +
            '<button class="v2-btn" onclick="V2.campagne.chercher()">Voir les officines</button>' +
          '</div>' +
        '</div>' +

        '<div class="v2-camp-sec">La liste</div>' +
        '<div id="cp-liste"><p class="v2-camp-note">Clique sur « Voir les officines » : ' +
          'tes clients et les prospects de ton secteur s’affichent, avec leur groupement. ' +
          'Tu coches celles que tu veux.</p></div>' +

        '<div class="v2-camp-acts" style="margin-top:16px">' +
          '<button class="v2-btn v2-btn-primary" id="cp-envoi" disabled ' +
            'onclick="V2.campagne.lancer()">Sélectionne des officines</button>' +
        '</div>' +
        '<p class="v2-camp-note">Les officines sans adresse mail et celles marquées ' +
          '« ne plus solliciter » sont écartées automatiquement.</p>' +
      '</div>';

      // Les modèles personnels arrivent de la base : on les injecte dès qu'ils
      // sont là, en gardant le motif déjà choisi. Le sélecteur reste utilisable
      // pendant ce temps — les trois motifs livrés y sont déjà.
      V2.campagne.majModeles();

      // L'aperçu s'affiche dès l'ouverture : on doit voir le mail AVANT de
      // préparer une liste, pas après avoir tout choisi.
      V2.campagne.apercu();

      // Arrivée depuis le planning, la liste déjà choisie : on la charge tout
      // de suite. Ailleurs le bouton « Voir les officines » reste manuel — la
      // liste coûte 2,8 Mo — mais ici le commercial vient justement de
      // demander ces officines-là, le laisser devant un écran vide n'aurait
      // aucun sens.
      if (V2.campagnePreselection && V2.campagnePreselection.length) {
        V2.campagne.chercher();
      }
    }
  };
})();

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
    modele: 'routine', texte: '', file: [], i: 0, envoyes: 0, passes: 0,
    tous: [],          // tout ce que le commercial peut viser, recensé une fois
    opposes: [],       // « ne plus solliciter »
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
  function recenser() {
    var D = window.PHARMA_FR || null;
    return window.V2CIBLE.recenser({
      pharmacies: V2.pharmacies || [],
      national: D ? { p: D.p, seg: D.seg, grp: D.grp, comm: D.comm } : null,
      // Le nom du commercial cadre les prospects sur SON secteur. S'il est
      // inconnu, on préfère tout montrer plutôt qu'une liste vide inexpliquée.
      commercial: (V2.profil && V2.profil.name) || (V2.user && V2.user.name) || '',
      info: function (cip) { return V2.rdvInfo(cip); }
    });
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
      if (z) z.innerHTML = '<p class="v2-camp-note">Chargement des officines…</p>';
      V2.rdvSources().then(function () {
        return c.from('rdv_opposition').select('cip').eq('user_id', u);
      }).then(function (r) {
        ETAT.opposes = ((r && r.data) || []).map(function (x) { return String(x.cip); });
        ETAT.tous = recenser();
        V2.campagne.rafraichir();
      }).catch(function () {
        if (z) z.innerHTML = '<p class="v2-camp-note">Chargement impossible. Réessaie.</p>';
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
      if (b) {
        b.disabled = !n;
        b.textContent = n ? 'Préparer ' + n + ' mail' + (n > 1 ? 's' : '') : 'Sélectionne des officines';
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

      var bt = document.querySelectorAll('.cp-type button');
      for (var i = 0; i < bt.length; i++)
        bt[i].classList.toggle('on', bt[i].getAttribute('data-t') === ETAT.type);
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
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      var mods = window.V2MOD.liste().map(function (m) {
        return '<option value="' + esc(m.cle) + '">' + esc(m.nom) + '</option>';
      }).join('');
      r.innerHTML = top + '<div class="v2-wrap narrow">' +
        '<div class="v2-camp-hero"><h1>Campagne de rendez-vous</h1>' +
          '<p>Le mail part de ta boîte, signé de ton nom. Tu relis, tu envoies. ' +
          'Compte 20 à 40 officines dans une session.</p></div>' +

        '<div class="v2-camp-sec">Le motif</div>' +
        '<div class="v2-camp-box">' +
          '<label for="cp-modele">Pourquoi tu leur écris</label>' +
          '<select id="cp-modele">' + mods + '</select>' +
          '<label for="cp-texte" style="margin-top:14px">Ton texte (modèle « nouveauté » uniquement)</label>' +
          '<p>Deux lignes, réutilisées pour toute la liste. Aucun pourcentage : ' +
            'les conditions commerciales ne s’écrivent pas dans un mail.</p>' +
          '<textarea id="cp-texte" rows="2" placeholder="Ex. La gamme diabète arrive en septembre."></textarea>' +
        '</div>' +

        '<div class="v2-camp-sec">Qui tu vises</div>' +
        '<div class="v2-camp-box">' +
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
    }
  };
})();

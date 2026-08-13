/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Noter un rendez-vous pris de vive voix (pages.rdvajout)

   Jusqu'ici, seuls les rendez-vous pris par le pharmacien LUI-MÊME, depuis
   un lien, entraient dans JARVIS. Ceux décrochés au téléphone ou sur le
   pas de la porte n'existaient nulle part — donc ils ne bloquaient rien :
   un autre pharmacien pouvait réserver par-dessus, et l'agenda mentait.

   Ici, on choisit l'officine dans le fichier : nom, adresse, ville,
   téléphone et position sont repris tels quels. On ne les retape pas —
   c'est justement là que naissent les erreurs de ville et d'adresse.

   Une fois enregistré, le rendez-vous se comporte comme les autres :
   il occupe le créneau, il apparaît dans « Mon agenda », et il part dans
   le flux d'abonnement de l'agenda personnel.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };

  var choisie = null;      // l'officine retenue, résolue par V2.rdvInfo
  var national = false;    // l'annuaire national a-t-il été chargé ?

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function sansAccent(s) {
    return String(s || '').toLowerCase()
      .normalize ? String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
                 : String(s || '').toLowerCase();
  }

  function ensureCss() {
    if (document.getElementById('v2-rdva-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rdva-css';
    s.textContent = [
      '.rda-hero{margin:8px 0 16px}',
      '.rda-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.rda-hero p{color:var(--muted);font-size:14px;max-width:56ch;margin:0;line-height:1.5}',
      '.rda-sec{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;',
      '  color:var(--muted);margin:24px 0 10px}',
      '.rda-box{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 16px}',
      '.rda-box input,.rda-box textarea{width:100%;font:inherit;font-size:16px;min-height:44px;',
      '  padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card-2);color:inherit}',
      '.rda-box textarea{min-height:70px;resize:vertical}',
      '.rda-res{list-style:none;padding:0;margin:10px 0 0;max-height:320px;overflow:auto}',
      '.rda-res li{margin:0 0 6px}',
      '.rda-res button{width:100%;text-align:left;min-height:52px;padding:9px 12px;border:1px solid var(--line);',
      '  border-radius:10px;background:var(--card-2);color:inherit;font:inherit;cursor:pointer}',
      '.rda-res b{display:block;font-size:14.5px}',
      '.rda-res span{color:var(--muted);font-size:13px}',
      '.rda-fiche{background:var(--card);border:1px solid var(--ip-blue);border-radius:var(--r-md);padding:14px 16px}',
      '.rda-fiche b{display:block;font-size:16px;margin-bottom:4px}',
      '.rda-l{display:flex;gap:8px;font-size:14px;padding:3px 0;color:var(--muted)}',
      '.rda-l i{font-style:normal;min-width:82px;color:var(--ip-ink);font-weight:600}',
      '.rda-manque{color:var(--c-amber,#C7791A);font-weight:600}',
      '.rda-champs{display:flex;flex-wrap:wrap;gap:14px}',
      '.rda-champs > div{display:flex;flex-direction:column;gap:6px;flex:1;min-width:130px}',
      '.rda-champs b{font-size:12.5px}',
      '.rda-acts{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 0}',
      '.rda-acts .v2-btn{min-height:48px}',
      '.rda-msg{margin-top:12px;font-size:14px;line-height:1.5}'
    ].join('');
    document.head.appendChild(s);
  }

  function dire(html, couleur) {
    var e = document.getElementById('rda-msg');
    if (e) e.innerHTML = '<span style="color:' + (couleur || 'var(--muted)') + '">' + html + '</span>';
  }

  // ── Recherche ────────────────────────────────────────────────────
  // D'abord le portefeuille (690 officines, déjà en mémoire). L'annuaire
  // national pèse 2,8 Mo : on ne le charge que si on le demande, et on le
  // dit — le télécharger sans prévenir sur un téléphone en tournée serait
  // impoli.
  function chercher(q) {
    var t = sansAccent(q).trim();
    if (t.length < 2) return [];
    var out = [], i, p;
    var pharmas = V2.pharmacies || [];
    for (i = 0; i < pharmas.length && out.length < 40; i++) {
      p = pharmas[i];
      if (sansAccent(p.name).indexOf(t) !== -1 || sansAccent(p.ville).indexOf(t) !== -1 ||
          String(p.id).indexOf(t) === 0) {
        out.push({ cip: String(p.id), nom: p.name, ville: p.ville, cp: p.cp, source: 'portefeuille' });
      }
    }
    if (national && window.PHARMA_FR && window.PHARMA_FR.p) {
      var D = window.PHARMA_FR.p, vus = {};
      out.forEach(function (o) { vus[o.cip] = 1; });
      for (i = 0; i < D.length && out.length < 60; i++) {
        var r = D[i], id = String(r[13] == null ? '' : r[13]);
        if (!id || vus[id]) continue;
        if (sansAccent(r[6]).indexOf(t) !== -1 || sansAccent(r[7]).indexOf(t) !== -1) {
          out.push({ cip: id, nom: r[6], ville: r[7], cp: r[8], source: 'annuaire' });
        }
      }
    }
    return out;
  }

  function rendreResultats() {
    var e = document.getElementById('rda-res');
    if (!e) return;
    var q = val('rda-q');
    if (sansAccent(q).trim().length < 2) {
      e.innerHTML = '<li><span style="color:var(--muted);font-size:13.5px">' +
        'Tape au moins deux lettres — nom d’officine, ville, ou début de CIP.</span></li>';
      return;
    }
    var r = chercher(q);
    if (!r.length) {
      e.innerHTML = '<li><span style="color:var(--muted);font-size:13.5px">Aucune officine trouvée' +
        (national ? '.' : ' dans ton portefeuille.') + '</span></li>' +
        (national ? '' : '<li><button onclick="V2.rdvAjout.chargerNational()">' +
          'Chercher dans l’annuaire national (2,8 Mo à télécharger)</button></li>') +
        boutonALaMain();
      return;
    }
    e.innerHTML = r.map(function (o) {
      return '<li><button onclick="V2.rdvAjout.choisir(\'' +
        esc(String(o.cip).replace(/[^0-9A-Za-z]/g, '')) + '\')">' +
        '<b>' + esc(o.nom) + '</b><span>' + esc([o.cp, o.ville].filter(Boolean).join(' ')) +
        (o.source === 'annuaire' ? ' · annuaire national' : '') + '</span></button></li>';
    }).join('') + (national ? '' :
      '<li><button onclick="V2.rdvAjout.chargerNational()">Élargir à l’annuaire national ' +
      '(2,8 Mo à télécharger)</button></li>') + boutonALaMain();
  }

  function boutonALaMain() {
    return '<li><button onclick="V2.rdvAjout.aLaMain()">' +
      '<b>Saisir cette officine à la main</b>' +
      '<span>si elle n’est dans aucun fichier</span></button></li>';
  }

  function ficheHtml(o) {
    function l(nom, v, manque) {
      return '<div class="rda-l"><i>' + esc(nom) + '</i>' +
        (v ? esc(v) : '<span class="rda-manque">' + esc(manque || 'non renseigné') + '</span>') + '</div>';
    }
    return '<div class="rda-fiche"><b>' + esc(o.nom || 'Officine') + '</b>' +
      l('Adresse', o.adresse, 'inconnue — le lieu du rendez-vous sera la ville seule') +
      l('Ville', [o.cp, o.ville].filter(Boolean).join(' ')) +
      l('Téléphone', o.tel) +
      l('Contact', o.contact) +
      l('CIP', o.cip) +
      '<div class="rda-l" style="margin-top:6px"><i>Position</i>' +
        (o.lat != null && o.lon != null
          ? 'connue — le créneau tiendra compte du temps de route'
          : '<span class="rda-manque">à retrouver — je m’en occupe à l’enregistrement</span>') +
      '</div></div>';
  }

  V2.rdvAjout = {
    chercherMaj: function () { rendreResultats(); },

    chargerNational: function () {
      var e = document.getElementById('rda-res');
      if (e) e.innerHTML = '<li><span style="color:var(--muted)">Téléchargement de l’annuaire…</span></li>';
      var fin = function () { national = true; rendreResultats(); };
      if (window.PHARMA_FR) { fin(); return; }
      if (V2.ensurePharmaFr) V2.ensurePharmaFr(fin);
      else if (V2.rdvSources) V2.rdvSources().then(fin, fin);
      else fin();
    },

    choisir: function (cip) {
      choisie = V2.rdvInfo ? V2.rdvInfo(cip) : { cip: cip, nom: '', ville: '' };
      V2.go('rdvajout', cip);
    },

    // Reprendre un agenda papier, c'est aussi y trouver des officines qui ne
    // sont dans aucun fichier : un prospect croisé, une officine qui vient
    // d'ouvrir. Sans cette porte, ces rendez-vous-là resteraient sur le papier
    // — et l'agenda continuerait de mentir.
    aLaMain: function () {
      var nom = val('rda-q').trim();
      if (nom.length < 2) { dire('Écris d’abord le nom de l’officine.', 'var(--rose,#E0556E)'); return; }
      choisie = { cip: '', nom: nom, adresse: '', cp: '', ville: '', tel: '', contact: '',
                  lat: null, lon: null, aLaMain: true };
      V2.go('rdvajout');
    },

    changer: function () { choisie = null; V2.go('rdvajout'); },

    // ── Créer le rendez-vous — LE SEUL ENDROIT ────────────────────
    // Partagé par l'écran complet ET par la feuille rapide du bouton rond.
    // Une règle qui vit à deux endroits finit par diverger : ici, la position
    // retrouvée, l'origine « manuel » et la traduction du chevauchement en
    // français ne sont écrites qu'une fois.
    // Rend { ok:true, id } ou { ok:false, raison, message }.
    creer: function (o, q) {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve({ ok: false, raison: 'connexion',
        message: 'Connecte-toi pour noter un rendez-vous.' });
      if (!o) return Promise.resolve({ ok: false, raison: 'officine',
        message: 'Choisis d’abord une officine.' });
      if (!q || !q.date) return Promise.resolve({ ok: false, raison: 'date',
        message: 'Indique la date.' });
      if (!q.heure) return Promise.resolve({ ok: false, raison: 'heure',
        message: 'Indique l’heure.' });
      // Une date passée n'est pas une faute improbable : le champ date d'un
      // téléphone se manipule vite. On refuse plutôt que de créer un
      // rendez-vous invisible dans l'agenda, qui ne montre que l'à-venir.
      if (q.date < new Date().toISOString().slice(0, 10))
        return Promise.resolve({ ok: false, raison: 'passe', message: 'Cette date est déjà passée.' });

      // Sans position, le moteur de créneaux ne sait pas placer ce rendez-vous
      // dans la géographie de la journée : les suivants seraient proposés
      // n'importe où. On la retrouve donc AVANT d'enregistrer.
      var pos = (o.lat != null && o.lon != null)
        ? Promise.resolve({ lat: o.lat, lon: o.lon })
        : geocode([o.adresse, o.cp, o.ville].filter(Boolean).join(' '));

      return pos.then(function (ll) {
        return c.from('rdv').insert({
          user_id: u,
          cip: o.cip || null,
          nom: o.nom || 'Officine',
          adresse: o.adresse || null,
          cp: o.cp || null,
          ville: o.ville || null,
          lat: ll ? ll.lat : null,
          lon: ll ? ll.lon : null,
          date: q.date,
          heure: q.heure,
          duree_min: parseInt(q.duree, 10) || 45,
          statut: 'confirme',
          origine: 'manuel',
          contact_nom: q.contact || o.contact || null,
          contact_tel: q.tel || o.tel || null,
          message: q.note || null
        }).select('id').single();
      }).then(function (r) {
        if (r && r.error) {
          // La règle « pas de chevauchement » de la base : deux rendez-vous ne
          // peuvent pas se marcher dessus. Le message brut ne dirait rien.
          var m = String((r.error && r.error.message) || '');
          if (m.indexOf('chevauchement') !== -1 || r.error.code === '23P01') {
            return { ok: false, raison: 'chevauchement',
              message: 'Tu as déjà un rendez-vous à ce moment-là. Change l’heure ou la durée.' };
          }
          return { ok: false, raison: 'base', message: 'Enregistrement impossible.' };
        }
        return { ok: true, id: r && r.data && r.data.id };
      }).catch(function () {
        return { ok: false, raison: 'reseau', message: 'Enregistrement impossible.' };
      });
    },

    enregistrer: function () {
      if (!choisie) { dire('Choisis d’abord une officine.', 'var(--rose,#E0556E)'); return; }
      var b = document.getElementById('rda-go');
      if (b) { b.disabled = true; b.textContent = 'Enregistrement…'; }
      var rendre = function () { if (b) { b.disabled = false; b.textContent = 'Noter ce rendez-vous'; } };

      var o = choisie;
      if (o.aLaMain) {
        o.adresse = val('rda-adresse') || '';
        o.cp = val('rda-cp') || '';
        o.ville = val('rda-ville') || '';
      }
      V2.rdvAjout.creer(o, {
        date: val('rda-date'), heure: val('rda-heure'), duree: val('rda-duree'),
        contact: val('rda-contact'), tel: val('rda-tel'), note: val('rda-note')
      }).then(function (r) {
        if (!r.ok) { rendre(); dire(esc(r.message), 'var(--rose,#E0556E)'); return; }
        V2.toast('Rendez-vous noté.');
        choisie = null;
        V2.go('rdvplanning');
      });
    }
  };

  // Géocodage gratuit sans clé — le même service que la tournée et la carte.
  function geocode(q) {
    if (!q) return Promise.resolve(null);
    return fetch('https://data.geopf.fr/geocodage/search?limit=1&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var f = j && j.features && j.features[0];
        if (!f || !f.geometry) return null;
        return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
      })
      .catch(function () { return null; });
  }

  V2.pages.rdvajout = {
    render: function (root, param) {
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';

      var c = sb(), u = uid();
      if (!c || !u) {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="rda-hero">' +
          '<h1>Noter un rendez-vous</h1><p>Connecte-toi d’abord.</p></div></div>';
        return;
      }

      // Arrivée depuis une fiche officine : l'officine est déjà désignée.
      if (param && (!choisie || choisie.cip !== String(param))) {
        choisie = V2.rdvInfo ? V2.rdvInfo(param) : null;
      }

      // Le fichier clients apporte les ADRESSES POSTALES, que le portefeuille
      // n'a pas. Il est léger, on le charge en fond.
      //
      // ⚠️ Surtout PAS V2.rdvSources() ici : elle entraîne aussi l'annuaire
      // national — 2,7 Mo — et cet écran s'ouvre d'un simple clic. On les
      // téléchargerait en silence sur un téléphone en tournée, alors que
      // l'écran affiche par ailleurs « 2,8 Mo à télécharger » sur le bouton
      // qui, lui, le demande vraiment. Attrapé par le sous-agent
      // gardien-deploiement, en contradiction avec mon propre commentaire.
      if (V2.loadFiles && !window.CLIENTS && !V2._rdvaSources) {
        V2._rdvaSources = true;
        V2.loadFiles(['clients']).then(function () {
          if (V2.route && V2.route.name === 'rdvajout') V2.go('rdvajout', param);
        });
      }

      var demain = new Date(); demain.setDate(demain.getDate() + 1);
      var dDef = demain.toISOString().slice(0, 10);

      var corps;
      if (!choisie) {
        corps =
          '<div class="rda-sec">Quelle officine ?</div>' +
          '<div class="rda-box">' +
            '<input id="rda-q" type="search" autocomplete="off" placeholder="Nom, ville, ou début de CIP" ' +
              'oninput="V2.rdvAjout.chercherMaj()" />' +
            '<ul class="rda-res" id="rda-res"></ul>' +
          '</div>';
      } else {
        corps =
          '<div class="rda-sec">L’officine</div>' + ficheHtml(choisie) +
          '<div class="rda-acts" style="margin:10px 0 0">' +
            '<button class="v2-btn v2-btn-ghost" onclick="V2.rdvAjout.changer()">Changer d’officine</button>' +
          '</div>' +

          '<div class="rda-sec">Quand ?</div>' +
          '<div class="rda-box rda-champs">' +
            '<div><b>Date</b><input type="date" id="rda-date" value="' + esc(dDef) + '" /></div>' +
            '<div><b>Heure</b><input type="time" id="rda-heure" value="09:30" step="900" /></div>' +
            '<div><b>Durée</b><input type="number" id="rda-duree" min="15" max="240" step="15" value="45" />' +
              '<small style="color:var(--muted);font-size:12px">minutes</small></div>' +
          '</div>' +

          (choisie.aLaMain
            ? '<div class="rda-sec">Où ?</div>' +
              '<div class="rda-box rda-champs">' +
                '<div><b>Adresse</b><input type="text" id="rda-adresse" placeholder="12 rue des Lilas" /></div>' +
                '<div><b>Code postal</b><input type="text" id="rda-cp" inputmode="numeric" maxlength="5" ' +
                  'placeholder="44000" /></div>' +
                '<div><b>Ville</b><input type="text" id="rda-ville" placeholder="Nantes" /></div>' +
              '</div>'
            : '') +

          '<div class="rda-sec">Avec qui (facultatif)</div>' +
          '<div class="rda-box rda-champs">' +
            '<div><b>Contact</b><input type="text" id="rda-contact" value="' +
              esc(choisie.contact || '') + '" placeholder="Titulaire, préparateur…" /></div>' +
            '<div><b>Téléphone</b><input type="tel" id="rda-tel" value="' +
              esc(choisie.tel || '') + '" /></div>' +
          '</div>' +

          '<div class="rda-sec">Une note (facultatif)</div>' +
          '<div class="rda-box">' +
            '<textarea id="rda-note" placeholder="Ce qu’il faut préparer, ce qui a été dit au téléphone…"></textarea>' +
          '</div>' +

          '<div class="rda-acts">' +
            '<button class="v2-btn v2-btn-primary" id="rda-go" onclick="V2.rdvAjout.enregistrer()">' +
              ICO('plus', 15) + ' Noter ce rendez-vous</button>' +
          '</div>' +
          '<div class="rda-msg" id="rda-msg"></div>';
      }

      root.innerHTML = top + '<div class="v2-wrap narrow">' +
        '<div class="rda-hero"><h1>Noter un rendez-vous</h1>' +
          '<p>Pour un rendez-vous décroché au téléphone. L’officine est reprise du fichier — ' +
          'adresse, ville et téléphone compris — et le créneau devient occupé : ' +
          'plus personne ne pourra réserver par-dessus.</p></div>' +
        corps + '</div>';

      if (!choisie) rendreResultats();
    }
  };
})();

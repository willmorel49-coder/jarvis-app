/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Mes disponibilités (pages.rdvdispo)
   Ce que le commercial règle une fois : ses jours, ses plages, la durée
   d'un RDV, son numéro, et les demi-journées où il n'est pas là.
   C'est la matière que le moteur V2RDV utilise pour proposer des créneaux
   au pharmacien. Sans elle, la page publique tombe sur les valeurs par défaut.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var NOMS = { '1': 'Lundi', '2': 'Mardi', '3': 'Mercredi', '4': 'Jeudi', '5': 'Vendredi' };
  var MOMENTS = { matin: 'matin', apres_midi: 'après-midi', journee: 'toute la journée' };

  // Géocodage gratuit et sans clé — le même service que la carte et la tournée.
  // Ne rejette jamais : sans coordonnées, on enregistre quand même le texte.
  function geocoder(q) {
    return fetch('https://data.geopf.fr/geocodage/search?limit=1&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var f = j && j.features && j.features[0];
        if (!f || !f.geometry) return {};
        return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
      })
      .catch(function () { return {}; });
  }

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function defaut() { return JSON.parse(JSON.stringify(window.V2RDV.DEFAUT_DISPO)); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }

  function ensureCss() {
    if (document.getElementById('v2-rdvd-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rdvd-css';
    s.textContent = [
      '.v2-rdvd-hero{margin:8px 0 18px}',
      '.v2-rdvd-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.v2-rdvd-hero p{color:var(--muted);font-size:14px;max-width:56ch;margin:0;line-height:1.5}',
      '.v2-rdvd-sec{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:26px 0 10px}',
      '.v2-rdvd-jour{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);margin-bottom:8px}',
      '.v2-rdvd-jour label{display:flex;align-items:center;gap:9px;min-height:44px;font-weight:700;min-width:120px;cursor:pointer}',
      '.v2-rdvd-jour input[type=checkbox]{width:22px;height:22px;accent-color:var(--ip-blue)}',
      '.v2-rdvd-h{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.v2-rdvd-h span{color:var(--muted);font-size:12.5px;font-weight:700}',
      '.v2-rdvd-jour input[type=time],.v2-rdvd-num input{font:inherit;font-size:16px;min-height:44px;padding:6px 10px;',
      '  border:1px solid var(--line);border-radius:9px;background:var(--card-2);color:var(--ip-ink)}',
      '.v2-rdvd-num{display:flex;flex-wrap:wrap;gap:16px;padding:14px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md)}',
      '.v2-rdvd-num > div{display:flex;flex-direction:column;gap:6px}',
      '.v2-rdvd-num b{font-size:12.5px;font-weight:700}',
      '.v2-rdvd-num small{color:var(--muted);font-size:12px}',
      '.v2-rdvd-bl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:14px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md)}',
      '.v2-rdvd-bl input[type=date]{font:inherit;font-size:16px;min-height:44px;padding:6px 10px;border:1px solid var(--line);border-radius:9px;background:var(--card-2);color:var(--ip-ink)}',
      '.v2-rdvd-list{list-style:none;padding:0;margin:10px 0 0;display:flex;flex-direction:column;gap:6px}',
      '.v2-rdvd-list li{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 12px;background:var(--card-2);border:1px solid var(--line);border-radius:9px;font-size:14px}',
      '.v2-rdvd-vide{color:var(--muted);font-size:14px;margin:10px 0 0}',
      '.v2-rdvd-actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 0}',
      '.v2-rdvd-actions .v2-btn{min-height:48px}',
      '@media (max-width:430px){.v2-rdvd-jour label{min-width:100%}}'
    ].join('');
    document.head.appendChild(s);
  }

  V2.rdvDispo = {
    // Lit les réglages du commercial connecté. Jamais d'erreur bloquante :
    // sans connexion ou sans ligne, on renvoie les valeurs par défaut.
    charger: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve({ dispo: defaut(), blocages: [] });
      return Promise.all([
        c.from('rdv_dispo').select('*').eq('user_id', u).maybeSingle(),
        c.from('rdv_blocage').select('date,moment').eq('user_id', u)
          .gte('date', new Date().toISOString().slice(0, 10)).order('date')
      ]).then(function (r) {
        var d = (r[0] && r[0].data) || null;
        var blocages = (r[1] && r[1].data) || [];
        if (d) return { dispo: d, blocages: blocages };
        // Aucune ligne en base : ce commercial n'a jamais ouvert cet écran.
        // Sans ce filet, la page publique calculait des créneaux sur les valeurs
        // par défaut du NAVIGATEUR, que le serveur refusait ensuite TOUS
        // ("hors_grille") parce que rdv_dispo.jours était vide de son côté :
        // le pharmacien voyait des horaires et se faisait jeter à chaque clic.
        // On écrit donc les valeurs par défaut dès la première lecture — client
        // et serveur regardent enfin la même chose, sans que personne n'ait rien à faire.
        var base = defaut();
        return c.from('rdv_dispo').upsert(
          { user_id: u, jours: base.jours, duree_min: base.duree_min,
            marge_route_min: base.marge_route_min, maj_le: new Date().toISOString() },
          { onConflict: 'user_id' }
        ).then(function () { return { dispo: base, blocages: blocages }; })
         .catch(function () { return { dispo: base, blocages: blocages }; });
      }).catch(function () { return { dispo: defaut(), blocages: [] }; });
    },

    enregistrer: function () {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi pour enregistrer tes disponibilités.'); return; }
      var jours = {}, i, k, m1, m2, a1, a2, plages;
      for (i = 1; i <= 5; i++) {
        k = String(i);
        if (!document.getElementById('rd-j' + k).checked) continue;
        m1 = val('rd-m1-' + k); m2 = val('rd-m2-' + k);
        a1 = val('rd-a1-' + k); a2 = val('rd-a2-' + k);
        plages = [];
        if (m1 && m2 && m1 < m2) plages.push([m1, m2]);
        if (a1 && a2 && a1 < a2) plages.push([a1, a2]);
        if (plages.length) jours[k] = plages;
      }
      if (!Object.keys(jours).length) {
        V2.toast('Garde au moins un jour travaillé, sinon personne ne pourra réserver.');
        return;
      }
      // Le point de départ est saisi en clair (« Nantes ») : on le convertit en
      // coordonnées avant d'enregistrer, sinon le moteur ne peut rien en faire.
      // Si le géocodage échoue, on garde le texte SANS coordonnées — le moteur
      // se comporte alors comme avant plutôt que d'écarter des journées sur un
      // point faux. Et on le dit au commercial.
      var depart = (val('rd-depart') || '').trim();
      var avant = depart ? geocoder(depart) : Promise.resolve({ vide: true });

      avant.then(function (g) {
        return c.from('rdv_dispo').upsert({
          user_id: u, jours: jours,
          duree_min: parseInt(val('rd-duree'), 10) || 45,
          marge_route_min: parseInt(val('rd-marge'), 10) || 15,
          tel: val('rd-tel') || null,
          // Sa fonction, telle qu'il l'écrit. Elle apparaît dans la signature
          // de ses mails, sous son nom. Vide = pas de ligne : le moteur de
          // modèles n'invente aucun titre, et un titre faux dans un mail à un
          // pharmacien décrédibilise tout le reste.
          fonction: (val('rd-fonction') || '').trim() || null,
          depart_label: depart || null,
          depart_lat: (g && g.lat != null) ? g.lat : null,
          depart_lon: (g && g.lon != null) ? g.lon : null,
          maj_le: new Date().toISOString()
        }, { onConflict: 'user_id' }).then(function (r) {
          if (r.error) { V2.toast('Enregistrement impossible.'); return; }
          if (depart && (!g || g.lat == null)) {
            V2.toast('Enregistré, mais « ' + depart + ' » est introuvable : le temps de route depuis chez toi ne sera pas compté.');
          } else {
            V2.toast('Disponibilités enregistrées.');
          }
        });
      });
    },

    bloquer: function (moment) {
      var c = sb(), u = uid(), date = val('rd-bl');
      if (!c || !u) { V2.toast('Connecte-toi d’abord.'); return; }
      if (!date) { V2.toast('Choisis une date.'); return; }
      c.from('rdv_blocage').insert({ user_id: u, date: date, moment: moment }).then(function (r) {
        if (r.error) { V2.toast('Enregistrement impossible.'); return; }
        V2.toast('Indisponibilité enregistrée.');
        V2.go('rdvdispo');
      });
    },

    debloquer: function (date, moment) {
      var c = sb(), u = uid();
      if (!c || !u) return;
      c.from('rdv_blocage').delete().eq('user_id', u).eq('date', date).eq('moment', moment)
        .then(function () { V2.toast('Indisponibilité retirée.'); V2.go('rdvdispo'); });
    }
  };

  function ligneJour(k, plages) {
    var actif = !!(plages && plages.length);
    var m = (plages && plages[0]) || ['09:00', '12:30'];
    var a = (plages && plages[1]) || ['14:00', '18:00'];
    function t(id, v) { return '<input type="time" id="rd-' + id + '-' + k + '" value="' + esc(v) + '" />'; }
    return '<div class="v2-rdvd-jour">' +
      '<label><input type="checkbox" id="rd-j' + k + '"' + (actif ? ' checked' : '') + ' /> ' + esc(NOMS[k]) + '</label>' +
      '<div class="v2-rdvd-h"><span>matin</span>' + t('m1', m[0]) + t('m2', m[1]) + '</div>' +
      '<div class="v2-rdvd-h"><span>après-midi</span>' + t('a1', a[0]) + t('a2', a[1]) + '</div>' +
      '</div>';
  }

  V2.pages.rdvdispo = {
    render: function (root) {
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      root.innerHTML = top + '<div class="v2-wrap narrow"><div class="v2-rdvd-hero">' +
        '<h1>Mes disponibilités</h1><p>Chargement…</p></div></div>';

      Promise.all([
        V2.rdvDispo.charger(),
        // L'agenda est un confort : s'il ne répond pas, l'écran s'affiche
        // quand même avec les disponibilités saisies à la main.
        (V2.rdvAgenda ? V2.rdvAgenda.charger() : Promise.resolve(null)),
        (V2.rdvLien ? V2.rdvLien.charger() : Promise.resolve(null)),
        (V2.rdvNotif ? V2.rdvNotif.charger() : Promise.resolve(null)),
        (V2.rdvFlux ? V2.rdvFlux.charger() : Promise.resolve(null))
      ]).then(function (res) {
        var st = res[0], ag = res[1], lien = res[2], notif = res[3], flux = res[4];
        var d = st.dispo, k, jours = '';
        for (k = 1; k <= 5; k++) jours += ligneJour(String(k), d.jours && d.jours[String(k)]);

        var bl = (st.blocages || []).map(function (b) {
          return '<li><b>' + esc(b.date) + '</b> · ' + esc(MOMENTS[b.moment] || b.moment) +
            '<button class="v2-btn v2-btn-ghost" style="min-height:44px;margin-left:auto" ' +
            // Valeur dans un onclick : elle traverse HTML puis JS — on neutralise
            // les quotes à la source, esc() seul ne suffirait pas.
            'onclick="V2.rdvDispo.debloquer(\'' + esc(String(b.date).replace(/[^0-9-]/g, '')) +
            '\',\'' + esc(String(b.moment).replace(/[^a-z_]/g, '')) + '\')">retirer</button></li>';
        }).join('');

        root.innerHTML = top + '<div class="v2-wrap narrow">' +
          '<div class="v2-rdvd-hero"><h1>Mes disponibilités</h1>' +
            '<p>Ce que les pharmaciens pourront réserver quand tu leur envoies un lien. ' +
            'Décoche un jour pour qu’il n’apparaisse jamais.</p></div>' +

          '<div class="v2-rdvd-sec">Mon lien de réservation</div>' +
          (V2.rdvLien ? V2.rdvLien.bloc(lien) : '') +

          '<div class="v2-rdvd-sec">Mon agenda</div>' +
          (V2.rdvAgenda ? V2.rdvAgenda.bloc(ag) : '') +

          '<div class="v2-rdvd-sec">Être prévenu</div>' +
          (V2.rdvNotif ? V2.rdvNotif.bloc(notif) : '') +

          '<div class="v2-rdvd-sec">Mes rendez-vous dans mon agenda</div>' +
          (V2.rdvFlux ? V2.rdvFlux.bloc(flux) : '') +

          '<div class="v2-rdvd-sec">Mes journées</div>' + jours +

          '<div class="v2-rdvd-sec">Réglages</div>' +
          '<div class="v2-rdvd-num">' +
            '<div><b>Durée d’un rendez-vous</b><input type="number" id="rd-duree" min="15" max="180" step="15" value="' +
              esc(d.duree_min || 45) + '" /><small>minutes — ce chiffre est <b>annoncé</b> ' +
              'dans tes mails et bloqué dans ton agenda</small></div>' +
            '<div><b>Marge de route</b><input type="number" id="rd-marge" min="0" max="60" step="5" value="' +
              esc(d.marge_route_min || 15) + '" /><small>minutes entre deux RDV</small></div>' +
            '<div><b>Mon téléphone</b><input type="tel" id="rd-tel" value="' + esc(d.tel || '') +
              '" placeholder="06 12 34 56 78" /><small>donné au pharmacien en cas d’empêchement</small></div>' +
            '<div><b>Ma fonction</b><input type="text" id="rd-fonction" maxlength="80" value="' +
              esc(d.fonction || '') + '" placeholder="Responsable de secteur" /><small>' +
              (d.fonction
                ? 'apparaît sous ton nom dans la signature de tes mails'
                : 'sans elle, ta signature n’affiche que ton nom — rien n’est inventé') +
              '</small></div>' +
            '<div><b>Je pars de</b><input type="text" id="rd-depart" value="' + esc(d.depart_label || '') +
              '" placeholder="Nantes" /><small>' +
              (d.depart_lat != null
                ? 'le temps de route depuis chez toi est pris en compte'
                : 'sans ça, on peut te proposer 9 h à 300 km') +
              '</small></div>' +
          '</div>' +

          '<div class="v2-rdvd-actions">' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.rdvDispo.enregistrer()">Enregistrer</button>' +
          '</div>' +

          '<div class="v2-rdvd-sec">Je ne suis pas disponible</div>' +
          '<div class="v2-rdvd-bl">' +
            '<input type="date" id="rd-bl" />' +
            '<button class="v2-btn" style="min-height:44px" onclick="V2.rdvDispo.bloquer(\'matin\')">Matin</button>' +
            '<button class="v2-btn" style="min-height:44px" onclick="V2.rdvDispo.bloquer(\'apres_midi\')">Après-midi</button>' +
            '<button class="v2-btn" style="min-height:44px" onclick="V2.rdvDispo.bloquer(\'journee\')">Toute la journée</button>' +
          '</div>' +
          (bl ? '<ul class="v2-rdvd-list">' + bl + '</ul>'
              : '<p class="v2-rdvd-vide">Aucune indisponibilité enregistrée.</p>') +
        '</div>';

        // Le mode d'emploi s'affiche d'emblée : sans lui, personne ne trouve
        // l'adresse de son agenda — elle est enterrée dans les réglages.
        if (V2.rdvAgenda) V2.rdvAgenda.aide('google');
        if (V2.rdvFlux) V2.rdvFlux.aide('iphone');
      });
    }
  };
})();

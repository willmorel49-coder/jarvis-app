/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Mes rendez-vous dans MON agenda (bloc de « Mes disponibilités »)

   L'inverse du bloc « Mon agenda » : là on LIT l'agenda du commercial,
   ici on lui PUBLIE le nôtre. Il s'abonne une fois, et chaque rendez-vous
   pris par un pharmacien arrive tout seul dans son agenda.

   ⚠️ Ce qu'on ne promet pas : l'instantané. La fréquence de mise à jour
   appartient au client d'agenda. L'iPhone laisse choisir (jusqu'à 5 min) ;
   Google rafraîchit un abonnement extérieur quand il veut, souvent
   plusieurs heures. C'est écrit à l'écran, pas caché.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }

  function adresse(token) {
    return window.SUPABASE_URL + '/functions/v1/agenda-flux?j=' + token;
  }

  function css() {
    if (document.getElementById('v2-fx-css')) return;
    var s = document.createElement('style'); s.id = 'v2-fx-css';
    s.textContent = [
      '.v2-fx-box{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 16px}',
      '.v2-fx-url{width:100%;min-height:44px;font-size:15px;padding:10px 12px;border:1px solid var(--line);',
      '  border-radius:10px;background:var(--card-2);color:inherit;font-family:ui-monospace,Menlo,monospace}',
      '.v2-fx-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.v2-fx-acts .v2-btn{min-height:44px}',
      '.v2-fx-aide{margin-top:12px;font-size:14px;color:var(--muted);line-height:1.55}',
      '.v2-fx-aide ol{margin:6px 0 0;padding-left:20px}.v2-fx-aide li{margin:3px 0}',
      '.v2-fx-onglets{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
      '.v2-fx-onglets button{min-height:44px;padding:0 12px;border-radius:9px;border:1px solid var(--line);',
      '  background:transparent;color:inherit;font:inherit;cursor:pointer}',
      '.v2-fx-onglets button.on{border-color:var(--ip-blue);color:var(--ip-blue);font-weight:700}',
      '.v2-fx-res{margin-top:10px;font-size:14px}'
    ].join('');
    document.head.appendChild(s);
  }

  var MODES = [
    { cle: 'iphone', nom: 'iPhone', pas: [
      'Copie l’adresse ci-dessus',
      'Réglages → Applications → Calendrier → Comptes → Ajouter un compte',
      'Choisis « Autre » → « Ajout d’un agenda avec abonnement »',
      'Colle l’adresse, puis Suivant et Enregistrer'
    ], note: 'Dans Réglages → Applications → Calendrier → Nouvelles données, choisis ' +
             '« Toutes les 5 minutes » : c’est ce qui s’approche le plus du direct.' },
    { cle: 'google', nom: 'Google Agenda', pas: [
      'Copie l’adresse ci-dessus',
      'Ouvre Google Agenda sur un ordinateur',
      'Colonne de gauche → « Autres agendas » → le + → « À partir de l’URL »',
      'Colle l’adresse et valide'
    ], note: 'Google décide seul de la fréquence de mise à jour d’un agenda extérieur — ' +
             'comptez souvent plusieurs heures. Pour être prévenu tout de suite, garde ' +
             'les alertes sur ton téléphone.' },
    { cle: 'outlook', nom: 'Outlook', pas: [
      'Copie l’adresse ci-dessus',
      'Ouvre Outlook dans un navigateur → Agenda',
      '« Ajouter un calendrier » → « S’abonner à partir du web »',
      'Colle l’adresse, donne-lui un nom, puis Importer'
    ], note: 'Outlook relit en général toutes les quelques heures.' }
  ];

  function dire(html, couleur) {
    var e = document.getElementById('v2-fx-res');
    if (e) e.innerHTML = '<span style="color:' + (couleur || 'var(--muted)') + '">' + html + '</span>';
  }

  V2.rdvFlux = {
    charger: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve(null);
      return c.from('rdv_flux').select('token, actif, dernier_acces').eq('user_id', u).maybeSingle()
        .then(function (r) { return (r && r.data) || null; })
        .catch(function () { return null; });
    },

    creer: function () {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Reconnecte-toi.'); return; }
      c.from('rdv_flux').upsert({ user_id: u, actif: true }, { onConflict: 'user_id' })
        .then(function (r) {
          if (r.error) { V2.toast('Création impossible.'); return; }
          V2.toast('Adresse créée.');
          V2.go('rdvdispo');
        });
    },

    copier: function () {
      var e = document.getElementById('v2-fx-url');
      if (!e) return;
      e.select();
      var ok = false;
      // navigator.clipboard n'existe pas partout et échoue hors contexte sûr :
      // on garde execCommand en repli plutôt que de laisser un bouton muet.
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(e.value);
          ok = true;
        } else { ok = document.execCommand('copy'); }
      } catch (err) { ok = false; }
      dire(ok ? 'Adresse copiée.' : 'Copie impossible — sélectionne le texte et copie-le à la main.',
           ok ? 'var(--mint,#1E9E6A)' : 'var(--rose,#E0556E)');
    },

    // Le jeton donne à voir tous les rendez-vous : on doit pouvoir le changer
    // s'il a fuité. L'ancien abonnement cesse alors de fonctionner — c'est le
    // but, et c'est dit avant de cliquer.
    regenerer: function () {
      var c = sb(), u = uid();
      if (!c || !u) return;
      if (!window.confirm('Créer une nouvelle adresse ? Les agendas déjà abonnés à l’ancienne ' +
                          'cesseront de se mettre à jour, il faudra les réabonner.')) return;
      c.from('rdv_flux').delete().eq('user_id', u).then(function () {
        return c.from('rdv_flux').insert({ user_id: u });
      }).then(function () { V2.toast('Nouvelle adresse créée.'); V2.go('rdvdispo'); });
    },

    aide: function (cle) {
      var m = null, i;
      for (i = 0; i < MODES.length; i++) if (MODES[i].cle === cle) m = MODES[i];
      if (!m) m = MODES[0];
      var bt = document.querySelectorAll('.v2-fx-onglets button');
      for (i = 0; i < bt.length; i++) bt[i].classList.toggle('on', bt[i].getAttribute('data-f') === m.cle);
      var e = document.getElementById('v2-fx-aide-corps');
      if (e) e.innerHTML = '<ol>' + m.pas.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') +
        '</ol><p style="margin:8px 0 0;font-style:italic">' + esc(m.note) + '</p>';
    },

    bloc: function (f) {
      css();
      if (!f || !f.token) {
        return '<div class="v2-fx-box">' +
          '<p style="margin:0 0 10px;font-size:14px;line-height:1.55">Pour que chaque rendez-vous ' +
          'pris par un pharmacien arrive tout seul dans ton agenda — sans que tu aies à cliquer.</p>' +
          '<div class="v2-fx-acts"><button class="v2-btn v2-btn-primary" ' +
          'onclick="V2.rdvFlux.creer()">Créer mon adresse d’abonnement</button></div></div>';
      }
      var onglets = MODES.map(function (m, i) {
        return '<button class="' + (i === 0 ? 'on' : '') + '" data-f="' + m.cle +
               '" onclick="V2.rdvFlux.aide(\'' + m.cle + '\')">' + esc(m.nom) + '</button>';
      }).join('');
      return '<div class="v2-fx-box">' +
        '<input class="v2-fx-url" id="v2-fx-url" readonly value="' + esc(adresse(f.token)) + '" />' +
        '<div class="v2-fx-acts">' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.rdvFlux.copier()">Copier l’adresse</button>' +
          '<button class="v2-btn v2-btn-ghost" onclick="V2.rdvFlux.regenerer()">Changer d’adresse</button>' +
        '</div>' +
        '<div class="v2-fx-res" id="v2-fx-res"></div>' +
        '<div class="v2-fx-aide"><div class="v2-fx-onglets">' + onglets + '</div>' +
          '<div id="v2-fx-aide-corps"></div>' +
          '<p style="margin:10px 0 0">Cette adresse donne à voir tous tes rendez-vous : ' +
          'garde-la pour toi, comme un mot de passe.' +
          (f.dernier_acces ? ' Ton agenda l’a lue pour la dernière fois le ' +
            esc(String(f.dernier_acces).slice(0, 10).split('-').reverse().join('/')) + '.' : '') +
          '</p></div></div>';
    }
  };
})();

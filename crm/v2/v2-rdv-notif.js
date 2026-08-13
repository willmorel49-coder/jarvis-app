/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Être prévenu quand un pharmacien réserve (bloc de « Mes
   disponibilités »).

   Sans ça, un rendez-vous pris n'avertit personne : on l'apprend en
   pensant à ouvrir l'écran Rendez-vous.

   ⚠️ SUR IPHONE, les notifications web n'existent QUE si JARVIS a été
   ajouté à l'écran d'accueil. Dans l'onglet Safari, l'API n'est même pas
   présente — ce n'est pas un réglage à trouver, c'est Apple. L'écran le
   dit franchement plutôt que d'afficher un bouton qui ne ferait rien.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  // Clé publique VAPID : elle est PUBLIQUE par construction — c'est elle que
  // le navigateur envoie au relais pour qu'il n'accepte que nos messages.
  // La privée, elle, ne quitte jamais le serveur.
  var VAPID_PUB = 'BCLIE-chcEIGj12ljZIA-ogBD-juY3m9DSwGNHg2-Gj3Kj_on3rOrfsqB-98QNSqsHPZFN2l83swj4BwhY71pTE';

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }

  function estIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function estInstallee() {
    return window.navigator.standalone === true ||
           (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function supporte() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  }

  // Base64url → octets, format attendu par pushManager.subscribe.
  function cleBinaire(b64) {
    var p = '='.repeat((4 - b64.length % 4) % 4);
    var s = (b64 + p).replace(/-/g, '+').replace(/_/g, '/');
    var brut = window.atob(s), out = new Uint8Array(brut.length);
    for (var i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
    return out;
  }
  function b64(buf) {
    var o = '', b = new Uint8Array(buf);
    for (var i = 0; i < b.length; i++) o += String.fromCharCode(b[i]);
    return window.btoa(o);
  }

  function css() {
    if (document.getElementById('v2-notif-css')) return;
    var s = document.createElement('style'); s.id = 'v2-notif-css';
    s.textContent = [
      '.v2-nt-box{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 16px}',
      '.v2-nt-etat{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;font-size:14px;margin-bottom:10px}',
      '.v2-nt-pastille{display:inline-block;width:9px;height:9px;border-radius:50%;flex:0 0 auto}',
      '.v2-nt-on{background:#1E9E6A}.v2-nt-off{background:#8B93A1}.v2-nt-ko{background:#E0556E}',
      '.v2-nt-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.v2-nt-acts .v2-btn{min-height:44px}',
      '.v2-nt-aide{margin-top:12px;font-size:14px;color:var(--muted);line-height:1.55}',
      '.v2-nt-aide ol{margin:6px 0 0;padding-left:20px}.v2-nt-aide li{margin:3px 0}',
      '.v2-nt-res{margin-top:10px;font-size:14px;line-height:1.5}'
    ].join('');
    document.head.appendChild(s);
  }

  function dire(html, couleur) {
    var e = document.getElementById('v2-nt-res');
    if (e) e.innerHTML = '<span style="color:' + (couleur || 'var(--muted)') + '">' + html + '</span>';
  }

  V2.rdvNotif = {
    // Ce qu'on sait sans rien demander à l'utilisateur : y a-t-il déjà un
    // abonnement enregistré pour lui ?
    charger: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve({ abonnes: 0 });
      return c.from('push_abo').select('id, appareil, derniere_erreur').eq('user_id', u)
        .then(function (r) {
          var l = (r && r.data) || [];
          return { abonnes: l.length, erreur: l.some(function (x) { return !!x.derniere_erreur; }) };
        })
        .catch(function () { return { abonnes: 0 }; });
    },

    activer: function () {
      if (!supporte()) { dire('Ce navigateur ne sait pas recevoir de notifications.', 'var(--rose,#E0556E)'); return; }
      var c = sb(), u = uid();
      if (!c || !u) { dire('Reconnecte-toi et réessaie.', 'var(--rose,#E0556E)'); return; }
      dire('Autorisation…');
      Notification.requestPermission().then(function (etat) {
        if (etat !== 'granted') {
          dire('Autorisation refusée. Sur iPhone : Réglages → Notifications → JARVIS.',
               'var(--rose,#E0556E)');
          return;
        }
        return navigator.serviceWorker.ready.then(function (reg) {
          // Un abonnement existant peut porter une AUTRE clé publique (clé
          // regénérée côté serveur) : il faut alors le retirer, sinon le relais
          // accepte l'abonnement mais nos envois sont rejetés sans un mot.
          return reg.pushManager.getSubscription().then(function (ex) {
            if (!ex) return reg.pushManager.subscribe({
              userVisibleOnly: true, applicationServerKey: cleBinaire(VAPID_PUB)
            });
            var memeCle = ex.options && ex.options.applicationServerKey &&
              b64(ex.options.applicationServerKey) === b64(cleBinaire(VAPID_PUB));
            if (memeCle) return ex;
            return ex.unsubscribe().then(function () {
              return reg.pushManager.subscribe({
                userVisibleOnly: true, applicationServerKey: cleBinaire(VAPID_PUB)
              });
            });
          });
        }).then(function (ab) {
          var j = ab.toJSON();
          return c.from('push_abo').upsert({
            user_id: u,
            endpoint: j.endpoint,
            p256dh: j.keys.p256dh,
            auth: j.keys.auth,
            appareil: estIOS() ? 'iPhone' : 'ordinateur',
            derniere_erreur: null
          }, { onConflict: 'endpoint' });
        }).then(function (r) {
          if (r && r.error) { dire('Enregistrement impossible.', 'var(--rose,#E0556E)'); return; }
          V2.toast('Ce téléphone sera prévenu.');
          dire('C’est activé. Envoie-toi un essai pour en être sûr.', 'var(--mint,#1E9E6A)');
          if (V2.go) V2.go('rdvdispo');
        });
      }).catch(function () { dire('Activation impossible sur cet appareil.', 'var(--rose,#E0556E)'); });
    },

    essai: function () {
      var c = sb();
      if (!c) return;
      dire('Envoi…');
      c.auth.getSession().then(function (s) {
        var acces = (s && s.data && s.data.session && s.data.session.access_token) || null;
        if (!acces) { dire('Reconnecte-toi et réessaie.', 'var(--rose,#E0556E)'); return; }
        return fetch(window.SUPABASE_URL + '/functions/v1/notifier', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': window.SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + acces
          },
          body: JSON.stringify({ essai: true })
        }).then(function (r) { return r.json(); }).then(function (r) {
          if (!r || !r.ok) { dire('Envoi impossible.', 'var(--rose,#E0556E)'); return; }
          if (!r.envoyes) {
            dire('Aucun appareil n’a reçu l’essai. Réactive les notifications sur ce téléphone.',
                 'var(--rose,#E0556E)');
            return;
          }
          dire('Essai parti vers <b>' + esc(r.envoyes) + '</b> appareil(s). ' +
               'Il doit arriver dans les secondes qui viennent.', 'var(--mint,#1E9E6A)');
        });
      }).catch(function () { dire('Envoi impossible.', 'var(--rose,#E0556E)'); });
    },

    couper: function () {
      var c = sb(), u = uid();
      if (!c || !u) return;
      if (!window.confirm('Ne plus être prévenu sur cet appareil ?')) return;
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription();
      }).then(function (ab) {
        var fin = ab ? c.from('push_abo').delete().eq('endpoint', ab.endpoint)
                     : c.from('push_abo').delete().eq('user_id', u);
        return fin.then(function () { return ab ? ab.unsubscribe() : null; });
      }).then(function () {
        V2.toast('Alertes coupées sur cet appareil.');
        if (V2.go) V2.go('rdvdispo');
      }).catch(function () { dire('Impossible pour l’instant.', 'var(--rose,#E0556E)'); });
    },

    // `st` = ce que charger() a renvoyé.
    bloc: function (st) {
      css();
      st = st || { abonnes: 0 };

      // iPhone dans Safari : l'API n'existe pas. On donne la marche à suivre
      // au lieu d'un bouton qui échouerait.
      if (estIOS() && !estInstallee()) {
        return '<div class="v2-nt-box">' +
          '<div class="v2-nt-etat"><span class="v2-nt-pastille v2-nt-off"></span>' +
          'Sur iPhone, les alertes demandent d’ajouter JARVIS à l’écran d’accueil.</div>' +
          '<div class="v2-nt-aide"><ol>' +
            '<li>Touche le bouton Partager, en bas de Safari</li>' +
            '<li>Descends jusqu’à « Sur l’écran d’accueil »</li>' +
            '<li>Ouvre JARVIS depuis cette nouvelle icône, puis reviens ici</li>' +
          '</ol><p style="margin:10px 0 0">Ce n’est pas un réglage caché : hors de l’écran ' +
          'd’accueil, iOS n’autorise aucune notification web.</p></div></div>';
      }

      if (!supporte()) {
        return '<div class="v2-nt-box"><div class="v2-nt-etat">' +
          '<span class="v2-nt-pastille v2-nt-off"></span>' +
          'Ce navigateur ne sait pas recevoir de notifications.</div></div>';
      }

      var refuse = (window.Notification && Notification.permission === 'denied');
      var actif = st.abonnes > 0 && !refuse;

      var etat = refuse
        ? '<span class="v2-nt-pastille v2-nt-ko"></span> Les notifications sont bloquées pour JARVIS. ' +
          'Réglages → Notifications → JARVIS pour les rouvrir.'
        : (actif
            ? '<span class="v2-nt-pastille v2-nt-on"></span> Tu es prévenu sur ' +
              esc(st.abonnes) + ' appareil(s) dès qu’un pharmacien réserve.'
            : '<span class="v2-nt-pastille v2-nt-off"></span> Personne n’est prévenu ' +
              'quand un pharmacien réserve.');

      return '<div class="v2-nt-box">' +
        '<div class="v2-nt-etat">' + etat + '</div>' +
        '<div class="v2-nt-acts">' +
          (actif
            ? '<button class="v2-btn" onclick="V2.rdvNotif.essai()">M’envoyer un essai</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.rdvNotif.couper()">Ne plus me prévenir</button>'
            : '<button class="v2-btn v2-btn-primary" onclick="V2.rdvNotif.activer()">' +
              'Me prévenir sur cet appareil</button>') +
        '</div>' +
        '<div class="v2-nt-res" id="v2-nt-res"></div>' +
        '<div class="v2-nt-aide">L’alerte donne le jour, l’heure et l’officine. ' +
        'La toucher ouvre ton agenda, où le rendez-vous s’ajoute au tien en un geste.</div>' +
        '</div>';
    }
  };
})();

/* ═══════════════════════════════════════════════════════════════════
   Page publique de prise de rendez-vous (pharmacien).
   Autonome : ne charge ni le bundle CRM, ni aucune donnée client.
   Trois appels seulement : rdv_fenetre, rdv_poser, rdv_preference.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var token = new URLSearchParams(window.location.search).get('t') || '';
  var sb = null;
  var F = null;      // la fenêtre renvoyée par rdv_fenetre
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var INDISPO = 'Le service est momentanément indisponible. Merci de réessayer dans un instant.';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function libelle(iso) {
    var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return JOURS[d.getUTCDay()] + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1];
  }
  function hhh(h) { return String(h).replace(':', 'h'); }
  function numero(s) { return String(s || '').replace(/[^0-9+]/g, ''); }
  function carte(html) { return '<div class="carte">' + html + '</div>'; }

  function secours(msg) {
    var c = F && F.commercial;
    app.innerHTML = carte('<p class="err">' + esc(msg) + '</p>' +
      (c && c.tel ? '<p>Vous pouvez joindre ' + esc(c.prenom) +
        ' au <a href="tel:' + esc(numero(c.tel)) + '">' + esc(c.tel) + '</a>.</p>' : ''));
  }

  function demarrer() {
    if (!window.supabase || !window.supabase.createClient) { secours(INDISPO); return; }
    if (!token) { secours('Ce lien est incomplet.'); return; }
    if (!sb) sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    sb.rpc('rdv_fenetre', { p_token: token }).then(function (r) {
      if (r.error) { secours(INDISPO); return; }
      F = r.data || {};
      if (!F.ok) {
        if (F.raison === 'consomme') { secours('Ce rendez-vous est déjà confirmé. Merci !'); return; }
        if (F.raison === 'expire') { secours('Ce lien a expiré.'); return; }
        secours('Ce lien n’est pas valide.');
        return;
      }
      afficherCreneaux();
    }).catch(function () { secours(INDISPO); });
  }

  function afficherCreneaux() {
    var jours = window.V2RDV.proposer({
      officine: F.officine,
      dispo: F.dispo,
      blocages: F.blocages || [],
      occupes: F.occupes || [],
      aujourdhui: new Date().toISOString().slice(0, 10)
    });
    var h = carte('<h1>Prendre rendez-vous</h1>' +
      '<p class="sub">' + esc(F.commercial.prenom) + ' vous propose de passer à ' +
      esc(F.officine.nom) + '. Choisissez le moment qui vous arrange.</p>');
    if (!jours.length) {
      h += carte('<p>Aucun créneau ne se libère dans les trois prochaines semaines.</p>' +
        '<p><button class="btn" id="pref">Dites-moi vos préférences</button></p>');
    } else {
      jours.forEach(function (j) {
        h += '<div class="carte"><p class="jour">' + esc(libelle(j.date)) + '</p><div class="creneaux">' +
          j.creneaux.map(function (c) {
            return '<button class="cr" data-d="' + esc(j.date) + '" data-h="' + esc(c) + '">' +
              esc(hhh(c)) + '</button>';
          }).join('') + '</div></div>';
      });
      h += carte('<button class="lien" id="pref">Aucun ne me convient →</button>');
    }
    app.innerHTML = h;
    Array.prototype.forEach.call(app.querySelectorAll('.cr'), function (b) {
      b.addEventListener('click', function () {
        formulaire(b.getAttribute('data-d'), b.getAttribute('data-h'));
      });
    });
    var p = document.getElementById('pref');
    if (p) p.addEventListener('click', formulairePreference);
  }

  function formulaire(date, heure) {
    app.innerHTML = carte(
      '<h1>' + esc(libelle(date)) + ' à ' + esc(hhh(heure)) + '</h1>' +
      '<label for="nom">Votre nom</label><input id="nom" autocomplete="name" />' +
      '<label for="tel">Votre téléphone (facultatif)</label><input id="tel" type="tel" autocomplete="tel" />' +
      '<p style="margin-top:18px"><button class="btn" id="go">Confirmer ce rendez-vous</button></p>' +
      '<button class="lien" id="retour">← revenir aux créneaux</button>');
    document.getElementById('retour').addEventListener('click', afficherCreneaux);
    document.getElementById('go').addEventListener('click', function () {
      var b = this;
      function rendre() { b.disabled = false; b.textContent = 'Confirmer ce rendez-vous'; }
      b.disabled = true; b.textContent = 'Enregistrement…';
      sb.rpc('rdv_poser', {
        p_token: token, p_date: date, p_heure: heure,
        p_nom: document.getElementById('nom').value || '',
        p_tel: document.getElementById('tel').value || ''
      }).then(function (r) {
        if (r.error) { rendre(); secours('Enregistrement impossible. Merci de réessayer.'); return; }
        var d = r.data || {};
        if (!d.ok) {
          // Le créneau est parti entre l'affichage et le clic : on recharge la fenêtre.
          if (d.raison === 'pris') {
            app.innerHTML = carte('<p>Ce créneau vient d’être pris. Voici les créneaux à jour…</p>');
            demarrer();
            return;
          }
          secours('Ce créneau n’est plus disponible.');
          return;
        }
        confirme(d);
      }).catch(function () { rendre(); secours('Enregistrement impossible. Merci de réessayer.'); });
    });
  }

  function confirme(d) {
    var r = d.rdv, c = d.commercial || {};
    var ics = window.V2ICS.build({
      uid: r.id, date: r.date, heure: r.heure, duree_min: r.duree_min,
      titre: 'Rendez-vous ' + (c.prenom || '') + ' · Intégral Pharma',
      lieu: r.adresse, description: 'Rendez-vous pris depuis le lien reçu par mail.',
      organisateur: c.prenom || 'Intégral Pharma'
    });
    app.innerHTML = carte(
      '<p class="ok">C’est noté : ' + esc(libelle(r.date)) + ' à ' + esc(hhh(r.heure)) + '.</p>' +
      '<p>' + esc(c.prenom) + ' vous attend à ' + esc(r.nom) + '.</p>' +
      '<p style="margin-top:18px"><a class="btn" download="rendez-vous.ics" href="' +
        window.V2ICS.dataUrl(ics) + '">Ajouter à mon agenda</a></p>' +
      (c.tel ? '<p style="margin-top:14px">Un empêchement ? Appelez ' + esc(c.prenom) +
        ' au <a href="tel:' + esc(numero(c.tel)) + '">' + esc(c.tel) + '</a>.</p>' : ''));
  }

  function formulairePreference() {
    app.innerHTML = carte(
      '<h1>Quand cela vous arrangerait-il ?</h1>' +
      '<label for="pt">Votre préférence</label>' +
      '<textarea id="pt" rows="3" placeholder="Ex. plutôt les mardis matin, ou après le 15 septembre"></textarea>' +
      '<label for="pn">Votre nom</label><input id="pn" autocomplete="name" />' +
      '<label for="pp">Votre téléphone</label><input id="pp" type="tel" autocomplete="tel" />' +
      '<p style="margin-top:18px"><button class="btn" id="pgo">Envoyer</button></p>' +
      '<button class="lien" id="pretour">← revenir aux créneaux</button>');
    document.getElementById('pretour').addEventListener('click', afficherCreneaux);
    document.getElementById('pgo').addEventListener('click', function () {
      var b = this;
      function rendre() { b.disabled = false; b.textContent = 'Envoyer'; }
      b.disabled = true; b.textContent = 'Envoi…';
      sb.rpc('rdv_preference', {
        p_token: token,
        p_texte: document.getElementById('pt').value || '',
        p_nom: document.getElementById('pn').value || '',
        p_tel: document.getElementById('pp').value || ''
      }).then(function (r) {
        if (r.error || !r.data || !r.data.ok) { rendre(); secours('Envoi impossible. Merci de réessayer.'); return; }
        app.innerHTML = carte('<p class="ok">C’est transmis.</p><p>' +
          esc(F.commercial.prenom) + ' vous rappelle pour convenir d’un moment.</p>');
      }).catch(function () { rendre(); secours('Envoi impossible. Merci de réessayer.'); });
    });
  }

  demarrer();
})();

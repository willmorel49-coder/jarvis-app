/* ═══════════════════════════════════════════════════════════════════
   Page publique de prise de rendez-vous (pharmacien).
   Autonome : ne charge ni le bundle CRM, ni aucune donnée client.
   Trois appels seulement : rdv_fenetre, rdv_poser, rdv_preference.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var params = new URLSearchParams(window.location.search);
  var token = params.get('t') || '';        // lien de campagne : usage unique, officine connue
  var ctoken = params.get('c') || '';       // lien permanent d'un commercial : officine à déclarer
  var pslug = params.get('p') || '';        // même chose, mais par nom court (« william »)
  var gcode = params.get('m') || '';        // MON rendez-vous : le voir, le déplacer, l'annuler
  var moi = null;                           // l'officine déclarée sur le lien permanent
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
  // En français le premier jour du mois s'écrit « 1er », jamais « 1 ».
  // La casse reste minuscule : ce libellé s'emploie aussi en milieu de phrase
  // (« C'est noté : vendredi 28 août »), où la majuscule serait fautive. Les
  // appelants qui le placent en tête de ligne mettent la capitale eux-mêmes.
  function libelle(iso) {
    var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var q = +p[2];
    return JOURS[d.getUTCDay()] + ' ' + (q === 1 ? '1er' : q) + ' ' + MOIS[+p[1] - 1];
  }
  function hhh(h) { return String(h).replace(':', 'h'); }
  // Capitale d'attaque, pour un libellé placé en tête de ligne.
  function capit(t) { return String(t).charAt(0).toUpperCase() + String(t).slice(1); }

  // Pourquoi CE jour est proposé — et pas un autre. Toutes les études de
  // conversion des pages de réservation disent la même chose : mettre en
  // avant l'option recommandée, avec sa raison. « 3 horaires possibles » ne
  // dit rien ; « je suis dans votre département ce jour-là » dit tout.
  // ⚠️ On ne l'écrit QUE si le commercial a réellement déclaré son secteur
  // ce jour-là. Rien inventé : sans déclaration, on retombe sur le nombre
  // d'horaires, qui reste vrai.
  function pourquoiCeJour(j) {
    var n = j.creneaux.length;
    var repli = esc(n) + ' horaire' + (n > 1 ? 's possibles' : ' possible');
    try {
      var deps = ((F.secteurs || []).filter(function (s) { return s.date === j.date; })[0] || {}).departements || [];
      var cp = (F.officine && F.officine.cp) || (moi && moi.cp) || '';
      var mien = (window.V2RDV && cp) ? window.V2RDV.departement(cp) : null;
      if (mien && deps.indexOf(mien) !== -1) {
        return 'Je suis dans votre secteur ce jour-là · ' + repli;
      }
    } catch (e) {}
    return repli;
  }
  // Un numéro français se lit par paires. Tout autre format (international,
  // longueur inhabituelle) est rendu inchangé plutôt que mal découpé.
  function telLisible(t) {
    var n = String(t == null ? '' : t).replace(/[^0-9+]/g, '');
    if (/^0[0-9]{9}$/.test(n)) return n.replace(/(..)(?=.)/g, '$1 ');
    return String(t == null ? '' : t);
  }
  function numero(s) { return String(s || '').replace(/[^0-9+]/g, ''); }
  function carte(html) { return '<div class="carte">' + html + '</div>'; }

  // ── L'en-tête « qui vous écrit », commun à TOUS les écrans ──────
  // ⚠️ Seul l'écran des créneaux le portait ; les cinq autres — le formulaire
  // d'identification, la confirmation, « mon rendez-vous », les préférences,
  // les messages d'erreur — restaient anonymes. Un pharmacien qui a lu un nom
  // sur le premier écran et plus rien ensuite se demande où il est tombé.
  //
  // Le prénom vient de la fenêtre quand elle est chargée ; avant ça, il est
  // dans l'adresse elle-même (« /rdv/william »), qui n'est rien d'autre que
  // le prénom du commercial. À défaut, on signe au moins de la maison.
  function prenomConnu() {
    var c = (F && F.commercial) || {};
    if (c.prenom) return c.prenom;
    if (pslug) return pslug.charAt(0).toUpperCase() + pslug.slice(1);
    return '';
  }

  function enTete() {
    var nom = prenomConnu();
    var ini = (nom || 'IP').charAt(0).toUpperCase();
    return '<div class="qui"><span class="av">' + esc(ini) + '</span>' +
      '<span><b>' + esc(nom || 'Intégral Pharma') + '</b>' +
      '<small>' + (nom ? 'Intégral Pharma · votre secteur' : 'Prise de rendez-vous') +
      '</small></span></div>';
  }

  // Les recours, toujours sous la même forme : de vrais boutons de 48 px,
  // jamais un mot souligné de 17 px au milieu d'un paragraphe.
  function recours(boutons) {
    var b = (boutons || []).filter(Boolean);
    return b.length ? '<div class="secours">' + b.join('') + '</div>' : '';
  }
  function boutonTel() {
    var c = (F && F.commercial) || {};
    return c.tel ? '<a href="tel:' + esc(numero(c.tel)) + '">' + esc(telLisible(c.tel)) + '</a>' : '';
  }

  function secours(msg) {
    var c = (F && F.commercial) || {};
    app.innerHTML = enTete() +
      carte('<p class="err">' + esc(msg) + '</p>' +
        (c.tel ? '<p style="margin-top:10px">Vous pouvez joindre ' + esc(c.prenom) +
          ' directement.</p>' : '')) +
      recours([boutonTel()]);
  }

  function demarrer() {
    if (!window.supabase || !window.supabase.createClient) { secours(INDISPO); return; }
    if (!token && !ctoken && !pslug && !gcode) { secours('Ce lien est incomplet.'); return; }
    if (!sb) sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    // « Mon rendez-vous » : le lien que le pharmacien garde dans son agenda.
    // Il passe AVANT tout le reste — c'est un lien de gestion, pas un lien de
    // réservation, et il vaut pour les deux chemins (campagne et permanent).
    if (gcode) { monRendezVous(); return; }
    // Le lien du mail porte un CODE de 8 lettres, pas le jeton de 36 caractères :
    // 101 caractères se coupaient en deux lignes dans un mail en texte brut, et
    // le pharmacien atterrissait sur une adresse tronquée. On traduit ici.
    if (token && token.length < 20) {
      sb.rpc('rdv_code_token', { p_code: token }).then(function (r) {
        var d = (r && r.data) || {};
        if (!d.ok) {
          secours(d.raison === 'expire' ? 'Ce lien a expiré.' : 'Ce lien n’est pas valide.');
          return;
        }
        token = d.token;
        demarrer();
      }).catch(function () { secours(INDISPO); });
      return;
    }
    // Nom court (« william ») : on le traduit une fois en jeton, puis tout se
    // passe comme avec un lien permanent classique. Le jeton n'apparaît jamais
    // dans l'adresse — c'est ce qui permet de le remplacer sans changer le lien.
    if (pslug && !ctoken) {
      sb.rpc('rdv_slug_token', { p_slug: pslug }).then(function (r) {
        var d = (r && r.data) || {};
        if (!d.ok) {
          secours(d.raison === 'ferme'
            ? 'Ce lien de réservation est fermé pour le moment.'
            : 'Ce lien n’est pas valide.');
          return;
        }
        ctoken = d.token;
        demarrer();
      }).catch(function () { secours(INDISPO); });
      return;
    }
    // Lien permanent : on ne sait pas encore QUI réserve. Or toute la
    // cohérence géographique repose sur la position de l'officine — sans
    // elle, on proposerait Brest et Nantes le même matin. On la demande
    // donc avant d'afficher le moindre créneau.
    if (ctoken && !moi) { formulaireOfficine(); return; }
    if (ctoken) { fenetrePublique(); return; }
    // On demande d'abord une relève de l'agenda du commercial, puis on lit la
    // fenêtre. La relève se protège elle-même (une fois toutes les 10 minutes
    // au plus) et ne peut PAS faire échouer la page : si l'agenda est muet,
    // révoqué ou lent, on continue avec ce qu'on a. Une page de réservation
    // qui paraît cassée fait fuir le pharmacien ; un conflit résiduel, lui,
    // sera refusé par le serveur au moment de poser.
    relever().then(function () {
      return sb.rpc('rdv_fenetre', { p_token: token });
    }).then(function (r) {
      if (r.error) { secours(INDISPO); return; }
      F = r.data || {};
      if (!F.ok) {
        // Rendez-vous déjà pris : au lieu d'un message sec, on lui montre SON
        // rendez-vous et on lui laisse la main. C'est la fonction n°1 de
        // Calendly, et un pharmacien qui ne peut pas décaler ne prévient pas :
        // il ne vient pas.
        if (F.raison === 'consomme') { revoirMonRdv(); return; }
        if (F.raison === 'expire') { secours('Ce lien a expiré.'); return; }
        secours('Ce lien n’est pas valide.');
        return;
      }
      afficherCreneaux();
    }).catch(function () { secours(INDISPO); });
  }

  // ─── Lien permanent : qui êtes-vous ? ────────────────────────────
  function formulaireOfficine() {
    app.innerHTML = enTete() +
      '<h1>Prendre rendez-vous</h1>' +
      '<p class="sub">Deux informations, et vous voyez mes créneaux.</p>' +
      carte(
      '<label for="of">Nom de votre officine</label>' +
      '<input id="of" autocomplete="organization" spellcheck="false" ' +
        'placeholder="Pharmacie du Marché…" />' +
      '<label for="cp">Code postal</label>' +
      '<input id="cp" inputmode="numeric" maxlength="5" autocomplete="postal-code" ' +
        'spellcheck="false" placeholder="44000…" />' +
      '<p style="margin-top:18px"><button class="btn" id="ok">Voir les créneaux</button></p>' +
      '<p id="err" role="alert" aria-live="polite" style="color:#C7283D;margin-top:12px"></p>');
    var b = document.getElementById('ok');
    b.addEventListener('click', function () {
      var nom = (document.getElementById('of').value || '').trim();
      var cp = (document.getElementById('cp').value || '').trim();
      var e = document.getElementById('err');
      if (nom.length < 2) { e.textContent = 'Indiquez le nom de votre officine.'; return; }
      if (!/^[0-9]{5}$/.test(cp)) { e.textContent = 'Le code postal doit avoir 5 chiffres.'; return; }
      b.disabled = true; b.textContent = 'Un instant…';
      // Le code postal sert à placer l'officine sur la carte, donc à ne
      // proposer que des créneaux que le commercial peut réellement tenir.
      fetch('https://data.geopf.fr/geocodage/search?limit=1&type=municipality&q=' + encodeURIComponent(cp))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var f = j && j.features && j.features[0];
          var g = (f && f.geometry) ? f.geometry.coordinates : null;
          moi = {
            nom: nom, cp: cp,
            ville: (f && f.properties && f.properties.city) || '',
            // Sans coordonnées on continue quand même : le pharmacien verra
            // simplement des créneaux moins bien calés. Mieux qu'une impasse.
            lat: g ? g[1] : null, lon: g ? g[0] : null
          };
          fenetrePublique();
        })
        .catch(function () { moi = { nom: nom, cp: cp, ville: '', lat: null, lon: null }; fenetrePublique(); });
    });
  }

  function fenetrePublique() {
    app.innerHTML = carte('<p>Chargement des créneaux…</p>');
    relever().then(function () {
      return sb.rpc('rdv_fenetre_publique', { p_token: ctoken, p_lat: moi.lat, p_lon: moi.lon });
    }).then(function (r) {
      if (r.error) { secours(INDISPO); return; }
      F = r.data || {};
      if (!F.ok) {
        secours(F.raison === 'ferme'
          ? 'Ce lien de réservation est fermé pour le moment.'
          : 'Ce lien n’est pas valide.');
        return;
      }
      // ⚠️ `cp` compris : le pharmacien vient de le saisir, et c'est LUI qui
      // porte le département. Sans lui, le secteur du jour ne s'applique pas
      // au chemin le plus fréquent — celui de tous les envois groupés.
      F.officine = { nom: moi.nom, cp: moi.cp, lat: moi.lat, lon: moi.lon, ville: moi.ville };
      afficherCreneaux();
    }).catch(function () { secours(INDISPO); });
  }

  // Demande au serveur de relire l'agenda du commercial. Ne rejette jamais :
  // l'agenda est un confort, la réservation doit marcher sans lui.
  function relever() {
    // Deux sortes de jetons ouvrent une page de réservation : celui d'une
    // campagne (usage unique) et le lien permanent du commercial. Le second
    // était laissé de côté — un pharmacien arrivé par rdv/william.html ne
    // déclenchait aucune relève, et voyait donc des créneaux calés sur la
    // dernière lecture, parfois vieille de plusieurs jours.
    var jeton = token || ctoken;
    if (!jeton) return Promise.resolve();
    return new Promise(function (fini) {
      var stop = setTimeout(fini, 6000);   // on n'attend pas un agenda lent
      fetch(window.SUPABASE_URL + '/functions/v1/agenda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ action: 'relever', token: jeton })
      }).then(function () { clearTimeout(stop); fini(); })
        .catch(function () { clearTimeout(stop); fini(); });
    });
  }

  function afficherCreneaux() {
    var jours = window.V2RDV.proposer({
      officine: F.officine,
      dispo: F.dispo,
      blocages: F.blocages || [],
      occupes: F.occupes || [],
      agenda: F.agenda || [],
      // Les journées où le commercial a déclaré dans quels départements il
      // serait. Un jour non déclaré reste sans contrainte.
      secteurs: F.secteurs || [],
      aujourdhui: new Date().toISOString().slice(0, 10)
    });
    // ── Direction « Trois moments » (p1), choisie par Will le 25/08/2026 ──
    // La page était correcte mais anonyme : cinq cartes blanches identiques,
    // ni le nom de l'expéditeur, ni la durée, ni ce qui se passe après.
    var cx = F.commercial || {};
    var ini = String(cx.prenom || '?').charAt(0).toUpperCase();

    // ⚠️ LA DURÉE SE LIT, ELLE NE S'ÉCRIT PAS. Le 19/08/2026, le mail de
    // prise de rendez-vous promettait « quinze minutes » au pharmacien
    // pendant que l'agenda lui bloquait 45 — le quart de ce qu'on lui
    // prenait, en dur depuis le premier jour. Ici la valeur vient du réglage
    // du commercial, avec pour seul repli celui du moteur de créneaux : les
    // deux mêmes sources que celles qui calculent les créneaux affichés.
    var duree = (F.dispo && F.dispo.duree_min != null)
      ? F.dispo.duree_min
      : ((window.V2RDV && window.V2RDV.DEFAUT_DISPO && window.V2RDV.DEFAUT_DISPO.duree_min) || null);

    function fait(tr, txt) {
      return '<span class="fait"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
        tr + '</svg>' + esc(txt) + '</span>';
    }
    var ICO_H = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>';
    var ICO_L = '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>';
    var ICO_V = '<path d="M4 12.5l5 5L20 6.5"/>';

    var h =
      '<div class="qui"><span class="av">' + esc(ini) + '</span>' +
        '<span><b>' + esc(cx.prenom || '') + '</b>' +
        '<small>Intégral Pharma · votre secteur</small></span></div>' +
      '<h1>Quand puis-je passer vous voir&nbsp;?</h1>' +
      '<p class="sub">Pour ' + esc(F.officine.nom) +
        (F.officine.ville ? ', à ' + esc(F.officine.ville) : '') + '.</p>' +
      '<div class="faits">' +
        (duree ? fait(ICO_H, duree + ' minutes') : '') +
        fait(ICO_L, 'Chez vous') +
        // Vrai, et vérifié dans le code : la confirmation envoie un lien de
        // gestion (blocGestion) qui permet de déplacer ou d'annuler.
        fait(ICO_V, 'Déplaçable ou annulable') +
      '</div>';

    if (!jours.length) {
      // Sur le lien permanent, « Dites-moi vos préférences » enregistre une
      // préférence rattachée à un jeton de campagne qui n'existe pas ici : le
      // bouton échouerait au clic. Et le cas est fréquent — une officine loin
      // du secteur du commercial ne rentre dans aucune journée. On explique
      // pourquoi, et on donne son numéro.
      h += '<div class="carte"><p>' + (ctoken
        ? 'Aucun créneau ne se libère dans les six prochains mois — ' +
          esc(cx.prenom) + ' n’a pas encore de journée prévue près de chez vous.'
        : 'Aucun créneau ne se libère dans les six prochains mois.') + '</p>' +
        '<div class="secours">' +
          (ctoken
            ? (cx.tel
                ? '<a href="tel:' + esc(numero(cx.tel)) + '">Appeler ' + esc(cx.prenom) +
                  ' au ' + esc(telLisible(cx.tel)) + '</a>'
                : '')
            : '<button id="pref">Dites-moi ce qui vous arrange</button>') +
        '</div></div>';
    } else {
      h += '<p class="lbl">' + (jours.length > 1 ? 'Les moments qui m’arrangent' : 'Le moment qui m’arrange') + '</p>';
      jours.forEach(function (j) {
        var q = String(j.date).split('-');
        h += '<div class="jc">' +
          '<div class="jc-t">' +
            '<span class="cal"><span class="m">' + esc(MOIS[+q[1] - 1].slice(0, 4)) + '</span>' +
              '<span class="d">' + esc(+q[2]) + '</span></span>' +
            '<span><b>' + esc(capit(libelle(j.date))) + '</b>' +
              '<small>' + pourquoiCeJour(j) + '</small></span>' +
          '</div>' +
          '<div class="creneaux">' +
            j.creneaux.map(function (c) {
              return '<button class="cr" data-d="' + esc(j.date) + '" data-h="' + esc(c) + '">' +
                esc(hhh(c)) + '</button>';
            }).join('') +
          '</div></div>';
      });

      // Toutes les autres dates, sur six mois. Une officine qui ne peut pas
      // dans les trois semaines qui viennent avait, sinon, pour seule issue
      // de ne pas donner suite.
      h += '<button class="autre" id="plus">Voir toutes les autres dates</button>';
      h += '<div class="pied">Aucun de ces moments ne vous va&nbsp;?' +
        '<div class="secours">' +
          (ctoken ? '' : '<button id="pref">Dites-moi ce qui vous arrange</button>') +
          (cx.tel ? '<a href="tel:' + esc(numero(cx.tel)) + '">' + esc(telLisible(cx.tel)) + '</a>' : '') +
        '</div></div>';
    }

    app.innerHTML = h;
    Array.prototype.forEach.call(app.querySelectorAll('.cr'), function (b) {
      b.addEventListener('click', function () {
        formulaire(b.getAttribute('data-d'), b.getAttribute('data-h'));
      });
    });
    var p = document.getElementById('pref');
    if (p) p.addEventListener('click', formulairePreference);
    var pl = document.getElementById('plus');
    if (pl) pl.addEventListener('click', afficherToutesLesDates);
  }

  // ─── Toutes les dates ouvertes, groupées par mois ─────────────────
  // Les trois propositions de l'écran précédent restent le chemin normal :
  // elles sont calées sur la géographie de la journée du commercial. Ici on
  // déroule simplement le calendrier, pour l'officine qui a besoin de se
  // projeter plus loin — et rien n'y est affiché qui ne soit réellement
  // tenable (mêmes règles de route, d'agenda et de blocage).
  // ── Toutes les dates, UN MOIS À LA FOIS ──────────────────────────
  // ⚠️ Cet écran affichait les six mois d'un coup : mesuré en production le
  // 25/08/2026, **25 683 px de haut et 511 créneaux** — trente écrans de
  // défilement. Les raccourcis de mois existaient déjà, mais ils ne faisaient
  // que faire DÉFILER vers une ancre : tout restait dessous. Ils filtrent
  // désormais pour de bon, et un seul mois est construit à la fois.
  // Le commentaire d'origine parlait de « douze mille pixels » pour trois
  // mois ; l'horizon est passé à six mois depuis, et personne n'a remesuré.
  var TOUTES = null;      // les jours rendus par le moteur, calculés une fois
  var MOIS_VU = null;     // le mois affiché

  function afficherToutesLesDates(moisChoisi) {
    if (!TOUTES) {
      TOUTES = window.V2RDV.calendrier({
        officine: F.officine,
        dispo: F.dispo,
        blocages: F.blocages || [],
        occupes: F.occupes || [],
        agenda: F.agenda || [],
        // ⚠️ La même règle qu'au-dessus. Sans elle, « Voir d'autres dates »
        // rouvrirait les journées que les trois propositions viennent d'écarter.
        secteurs: F.secteurs || [],
        aujourdhui: new Date().toISOString().slice(0, 10)
      });
    }
    var jours = TOUTES;
    var cx = F.commercial || {};

    // Les mois qui ont au moins une date, dans l'ordre.
    var mois = [];
    jours.forEach(function (j) {
      var q = String(j.date).split('-'), cle = q[0] + '-' + q[1];
      if (mois.indexOf(cle) === -1) mois.push(cle);
    });
    MOIS_VU = (moisChoisi && mois.indexOf(moisChoisi) >= 0) ? moisChoisi : mois[0];

    var h = '<div class="qui"><span class="av">' +
        esc(String(cx.prenom || '?').charAt(0).toUpperCase()) + '</span>' +
        '<span><b>' + esc(cx.prenom || '') + '</b>' +
        '<small>Intégral Pharma · votre secteur</small></span></div>' +
      '<h1>Toutes mes dates</h1>';

    if (!jours.length) {
      h += '<p class="sub">Aucune date ne se libère sur les six prochains mois.</p>';
    } else {
      var q0 = String(MOIS_VU).split('-');
      var duMois = jours.filter(function (j) { return String(j.date).indexOf(MOIS_VU) === 0; });
      var nbCr = duMois.reduce(function (n, j) { return n + j.creneaux.length; }, 0);

      h += '<p class="sub">Choisissez d’abord un mois.</p>' +
        '<div class="mois-choix">' + mois.map(function (cle) {
          var q = cle.split('-');
          var n = jours.filter(function (j) { return String(j.date).indexOf(cle) === 0; }).length;
          return '<button class="mc' + (cle === MOIS_VU ? ' on' : '') + '" data-mois="' + esc(cle) + '">' +
            esc(capit(MOIS[+q[1] - 1])) + '<small>' + n + ' jour' + (n > 1 ? 's' : '') + '</small></button>';
        }).join('') + '</div>' +
        '<p class="lbl">' + esc(capit(MOIS[+q0[1] - 1])) + ' ' + esc(q0[0]) + ' · ' +
          esc(duMois.length) + ' jour' + (duMois.length > 1 ? 's' : '') + ', ' +
          esc(nbCr) + ' horaire' + (nbCr > 1 ? 's' : '') + '</p>';

      duMois.forEach(function (j) {
        var q = String(j.date).split('-');
        h += '<div class="jc">' +
          '<div class="jc-t">' +
            '<span class="cal"><span class="m">' + esc(MOIS[+q[1] - 1].slice(0, 4)) + '</span>' +
              '<span class="d">' + esc(+q[2]) + '</span></span>' +
            '<span><b>' + esc(capit(libelle(j.date))) + '</b>' +
              '<small>' + esc(j.creneaux.length) + ' horaire' +
              (j.creneaux.length > 1 ? 's possibles' : ' possible') + '</small></span>' +
          '</div>' +
          '<div class="creneaux">' +
            j.creneaux.map(function (c) {
              return '<button class="cr" data-d="' + esc(j.date) + '" data-h="' + esc(c) + '">' +
                esc(hhh(c)) + '</button>';
            }).join('') +
          '</div></div>';
      });
    }

    h += '<div class="pied"><div class="secours">' +
      '<button id="retour3">← Revenir aux dates proposées</button>' +
      (cx.tel ? '<a href="tel:' + esc(numero(cx.tel)) + '">' + esc(telLisible(cx.tel)) + '</a>' : '') +
      '</div></div>';

    app.innerHTML = h;

    Array.prototype.forEach.call(app.querySelectorAll('.mc'), function (b) {
      b.addEventListener('click', function () {
        // On reconstruit le mois demandé sans relire quoi que ce soit, et on
        // remonte en tête : rester au milieu de la page après un changement
        // de mois donne l'impression que rien ne s'est passé.
        afficherToutesLesDates(b.getAttribute('data-mois'));
        window.scrollTo(0, 0);
      });
    });
    Array.prototype.forEach.call(app.querySelectorAll('.cr'), function (b) {
      b.addEventListener('click', function () {
        formulaire(b.getAttribute('data-d'), b.getAttribute('data-h'));
      });
    });
    var r3 = document.getElementById('retour3');
    if (r3) r3.addEventListener('click', function () { afficherCreneaux(); window.scrollTo(0, 0); });
  }

  // ── Le dernier pas : on récapitule avant de demander quoi que ce soit ──
  // ⚠️ Cet écran affichait « vendredi 28 août à 10h15 » et deux champs, rien
  // d'autre : le pharmacien perdait d'un coup le nom de l'expéditeur, la
  // durée et le lieu — tout ce que l'écran précédent venait d'établir. Et le
  // titre était en minuscule alors que le précédent met la capitale.
  // C'est le moment où l'on demande un engagement : c'est celui où il faut
  // rappeler ce qu'on engage, pas celui où il faut se taire.
  function formulaire(date, heure) {
    var cx = F.commercial || {};
    var duree = (F.dispo && F.dispo.duree_min != null)
      ? F.dispo.duree_min
      : ((window.V2RDV && window.V2RDV.DEFAUT_DISPO && window.V2RDV.DEFAUT_DISPO.duree_min) || null);
    var ou = (F.officine && F.officine.nom) ? F.officine.nom : '';

    app.innerHTML =
      '<div class="qui"><span class="av">' +
        esc(String(cx.prenom || '?').charAt(0).toUpperCase()) + '</span>' +
        '<span><b>' + esc(cx.prenom || '') + '</b>' +
        '<small>Intégral Pharma · votre secteur</small></span></div>' +
      '<h1>Plus qu’une chose&nbsp;: votre nom</h1>' +
      '<div class="recap">' +
        '<p class="quand">' + esc(capit(libelle(date))) + '</p>' +
        '<p class="heure">' + esc(hhh(heure)) +
          (duree ? ' <span>· ' + esc(duree) + ' minutes</span>' : '') + '</p>' +
        (ou ? '<p class="lieu">Chez vous, ' + esc(ou) + '</p>' : '') +
      '</div>' +
      carte(
        '<label for="nom">Votre nom</label><input id="nom" autocomplete="name" />' +
        '<label for="tel">Votre téléphone (facultatif)</label><input id="tel" type="tel" autocomplete="tel" />' +
        '<p style="margin-top:18px"><button class="btn" id="go">Confirmer ce rendez-vous</button></p>') +
      '<div class="pied"><div class="secours">' +
        '<button id="retour">← Choisir un autre horaire</button>' +
      '</div></div>';
    document.getElementById('retour').addEventListener('click', function () {
      afficherCreneaux(); window.scrollTo(0, 0);
    });
    document.getElementById('go').addEventListener('click', function () {
      var b = this;
      function rendre() { b.disabled = false; b.textContent = 'Confirmer ce rendez-vous'; }
      b.disabled = true; b.textContent = 'Enregistrement…';
      var appel = ctoken
        ? sb.rpc('rdv_poser_public', {
            p_token: ctoken, p_date: date, p_heure: heure,
            p_officine: moi.nom, p_cp: moi.cp, p_ville: moi.ville,
            p_nom: document.getElementById('nom').value || '',
            p_tel: document.getElementById('tel').value || '',
            p_lat: moi.lat, p_lon: moi.lon
          })
        : sb.rpc('rdv_poser', {
            p_token: token, p_date: date, p_heure: heure,
            p_nom: document.getElementById('nom').value || '',
            p_tel: document.getElementById('tel').value || ''
          });
      appel.then(function (r) {
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

  // L'adresse courte que le pharmacien garde pour revenir sur SON rendez-vous.
  // Construite depuis la racine du site, jamais depuis l'adresse courante :
  // il peut être arrivé par /rdv/william, par /r?t=… ou par rdv.html.
  function racineSite() {
    return window.location.origin + window.location.pathname.replace(/crm\/v2\/[^/]*$/, '');
  }
  function lienGestion(code) {
    return code ? racineSite() + 'r?m=' + encodeURIComponent(code) : '';
  }

  // Le fichier agenda, avec le lien de gestion DEDANS.
  // C'est le seul canal de confirmation dont on dispose : sans service
  // d'envoi, on ne peut écrire aucun mail au pharmacien. Son agenda garde
  // donc la date ET le moyen de la changer, y compris dans trois mois.
  function icsDuRdv(r, c, code) {
    var lien = lienGestion(code);
    return window.V2ICS.build({
      uid: r.id, date: r.date, heure: r.heure, duree_min: r.duree_min,
      titre: 'Rendez-vous ' + (c.prenom || '') + ' · Intégral Pharma',
      lieu: r.adresse,
      // ⚠️ Un VRAI saut de ligne, pas la séquence « \n » écrite à la main :
      // V2ICS échappe d'abord les antislashs, puis convertit les retours à la
      // ligne. Un « \n » littéral ressortirait donc tel quel, en toutes
      // lettres, dans l'agenda de chaque pharmacien.
      description: 'Rendez-vous avec ' + (c.prenom || 'Intégral Pharma') +
        (c.tel ? ' (' + c.tel + ')' : '') + '.' +
        (lien ? '\nDéplacer ou annuler : ' + lien : ''),
      organisateur: c.prenom || 'Intégral Pharma',
      url: lien
    });
  }

  // Le bloc « gardez ce lien », affiché après réservation. On l'écrit en
  // toutes lettres plutôt qu'en bouton : le pharmacien doit pouvoir le
  // copier, et beaucoup impriment ou transfèrent cette page à leur équipe.
  function blocGestion(code) {
    var lien = lienGestion(code);
    if (!lien) return '';
    // ⚠️ L'adresse s'affichait EN TOUTES LETTRES, coupée sur deux lignes :
    // illisible, impossible à recopier à la main, et en rupture avec le reste
    // de la page. Elle reste cliquable — c'est le même lien — mais elle porte
    // maintenant sa fonction plutôt que ses caractères.
    return '<p style="margin-top:20px">Besoin de le <b>déplacer ou de l’annuler</b>&nbsp;?</p>' +
      '<p style="margin-top:10px"><a class="btn btn-clair" href="' + esc(lien) + '">' +
      'Gérer mon rendez-vous</a></p>' +
      '<p style="margin-top:12px;font-size:14px;color:#5B6577">' +
      'Ce lien est aussi dans le fichier agenda ci-dessus — vous le retrouverez ' +
      'dans votre calendrier, à la date du rendez-vous.</p>';
  }

  function confirme(d) {
    var r = d.rdv, c = d.commercial || {};
    var ics = icsDuRdv(r, c, r.code);
    // Le bandeau reprend exactement la forme du récapitulatif vu juste avant
    // de confirmer : le pharmacien retrouve ce qu'il a choisi, au même endroit.
    app.innerHTML = enTete() +
      '<h1>C’est noté&nbsp;!</h1>' +
      '<div class="recap ok">' +
        '<p class="quand">' + esc(capit(libelle(r.date))) + '</p>' +
        '<p class="heure">' + esc(hhh(r.heure)) +
          (r.duree_min ? ' <span>· ' + esc(r.duree_min) + ' minutes</span>' : '') + '</p>' +
        '<p class="lieu">' + esc(c.prenom || 'Votre commercial') + ' vous attend à ' +
          esc(r.nom) + '</p>' +
      '</div>' +
      carte('<a class="btn" download="rendez-vous.ics" href="' +
        window.V2ICS.dataUrl(ics) + '">Ajouter à mon agenda</a>' + blocGestion(r.code)) +
      '<div class="pied">Un empêchement&nbsp;?' +
        recours([boutonTel()]) + '</div>';
  }

  // ── MON RENDEZ-VOUS (lien ?m=…) ─────────────────────────────────
  // Vaut pour les DEUX chemins. Jusqu'au 17/08/2026, un pharmacien venu du
  // lien permanent — donc de tout envoi groupé — ne pouvait ni relire, ni
  // déplacer, ni annuler : `rdv_mon_rdv` cherchait par (commercial, CIP), or
  // une réservation par lien permanent enregistre CIP à vide. Elle était
  // introuvable par conception. Qui ne peut pas annuler n'annule pas : il
  // n'est simplement pas là le jour venu.
  function monRendezVous() {
    app.innerHTML = carte('<p>Nous ouvrons votre rendez-vous…</p>');
    sb.rpc('rdv_gerer', { p_code: gcode }).then(function (rr) {
      var d = (rr && rr.data) || {};
      if (!d.ok) { secours('Ce lien ne correspond à aucun rendez-vous.'); return; }
      var v = d.rdv, c = d.commercial || {};

      if (d.statut !== 'confirme') {
        app.innerHTML = carte(
          '<h1>Rendez-vous annulé</h1>' +
          '<p>Ce rendez-vous du ' + esc(libelle(v.date)) + ' a été annulé.</p>' +
          (c.slug ? '<p style="margin-top:18px"><a class="btn" href="' +
            esc(racineSite() + 'rdv/' + c.slug) +
            '">Choisir un nouveau créneau</a></p>' : '') +
          (c.tel ? '<p style="margin-top:14px">Ou appelez ' + esc(c.prenom) +
            ' au <a href="tel:' + esc(numero(c.tel)) + '">' + esc(c.tel) + '</a>.</p>' : ''));
        return;
      }

      var ics = icsDuRdv(v, c, gcode);
      app.innerHTML = carte(
        '<h1>Votre rendez-vous</h1>' +
        '<p class="ok">' + esc(libelle(v.date)) + ' à ' + esc(hhh(v.heure)) + '.</p>' +
        '<p>' + esc(c.prenom || 'Votre commercial') + ' vous attend à ' + esc(v.nom) + '.</p>' +
        '<p style="margin-top:18px"><a class="btn" download="rendez-vous.ics" href="' +
          window.V2ICS.dataUrl(ics) + '">Ajouter à mon agenda</a></p>' +
        // Un rendez-vous passé ne s'annule plus : le proposer ne servirait
        // qu'à produire une erreur. On le dit, et on laisse le téléphone.
        (d.passe
          ? '<p style="margin-top:16px;color:#5B6577">Ce rendez-vous est passé.</p>'
          : '<p style="margin-top:16px"><button class="lien" id="annul">' +
            'Annuler ou choisir un autre créneau</button></p>') +
        (c.tel ? '<p style="margin-top:14px">Ou appelez ' + esc(c.prenom) +
          ' au <a href="tel:' + esc(numero(c.tel)) + '">' + esc(c.tel) + '</a>.</p>' : ''));

      var b = document.getElementById('annul');
      if (b) b.addEventListener('click', function () { annulerParCode(c); });
    }).catch(function () { secours(INDISPO); });
  }

  function annulerParCode(c) {
    var b = document.getElementById('annul');
    if (b) { b.disabled = true; b.textContent = 'Annulation…'; }
    sb.rpc('rdv_annuler_code', { p_code: gcode, p_motif: null }).then(function (rr) {
      var d = (rr && rr.data) || {};
      if (!d.ok) {
        if (b) { b.disabled = false; b.textContent = 'Annuler ou choisir un autre créneau'; }
        secours(d.raison === 'passe' ? 'Ce rendez-vous est déjà passé.'
              : d.raison === 'deja_annule' ? 'Ce rendez-vous est déjà annulé.'
              : 'Annulation impossible. Appelez votre commercial.');
        return;
      }
      // Annuler sert le plus souvent à DÉCALER : on le renvoie directement
      // choisir un autre créneau, plutôt que de le laisser sur un cul-de-sac.
      var racine = window.location.pathname.replace(/crm\/v2\/[^/]*$/, '');
      if (d.slug) {
        window.location.replace(window.location.origin + racine + 'rdv/' + d.slug);
        return;
      }
      app.innerHTML = carte('<p class="ok">Votre rendez-vous est annulé.</p>' +
        ((c && c.tel) ? '<p>Pour en reprendre un, appelez ' + esc(c.prenom) +
          ' au <a href="tel:' + esc(numero(c.tel)) + '">' + esc(c.tel) + '</a>.</p>' : ''));
    }).catch(function () { secours('Annulation impossible. Appelez votre commercial.'); });
  }

  // Le pharmacien revient sur son lien après avoir réservé.
  function revoirMonRdv() {
    sb.rpc('rdv_mon_rdv', { p_token: token }).then(function (r) {
      var d = (r && r.data) || {};
      if (!d.ok || !d.rdv) { secours('Ce rendez-vous est déjà confirmé. Merci !'); return; }
      var v = d.rdv, c = d.commercial || {};
      var ics = window.V2ICS.build({
        uid: v.id, date: v.date, heure: v.heure, duree_min: v.duree_min,
        titre: 'Rendez-vous ' + (c.prenom || '') + ' · Intégral Pharma',
        lieu: v.adresse, description: 'Rendez-vous pris depuis le lien reçu par mail.',
        organisateur: c.prenom || 'Intégral Pharma'
      });
      app.innerHTML = enTete() +
        '<h1>Votre rendez-vous</h1>' +
        '<div class="recap">' +
          '<p class="quand">' + esc(capit(libelle(v.date))) + '</p>' +
          '<p class="heure">' + esc(hhh(v.heure)) +
            (v.duree_min ? ' <span>· ' + esc(v.duree_min) + ' minutes</span>' : '') + '</p>' +
          '<p class="lieu">' + esc(c.prenom || 'Votre commercial') + ' vous attend à ' +
            esc(v.nom) + '</p>' +
        '</div>' +
        carte('<a class="btn" download="rendez-vous.ics" href="' +
          window.V2ICS.dataUrl(ics) + '">Ajouter à mon agenda</a>') +
        '<div class="pied">Besoin de changer&nbsp;?' +
          recours(['<button id="annul">Annuler ou déplacer</button>', boutonTel()]) +
        '</div>';
      document.getElementById('annul').addEventListener('click', annuler);
    }).catch(function () { secours('Ce rendez-vous est déjà confirmé. Merci !'); });
  }

  function annuler() {
    var b = document.getElementById('annul');
    if (b) { b.disabled = true; b.textContent = 'Annulation…'; }
    sb.rpc('rdv_annuler', { p_token: token, p_motif: null }).then(function (r) {
      var d = (r && r.data) || {};
      if (!d.ok) { secours('Annulation impossible. Appelez votre commercial.'); return; }
      // Le serveur a libéré le créneau ET réouvert le lien : on repart sur la
      // liste des créneaux, pour qu'annuler serve surtout à décaler.
      demarrer();
    }).catch(function () { secours('Annulation impossible. Appelez votre commercial.'); });
  }

  function formulairePreference() {
    app.innerHTML = enTete() +
      '<h1>Quand cela vous arrangerait-il&nbsp;?</h1>' +
      '<p class="sub">Dites-le avec vos mots, je m’adapte.</p>' +
      carte(
      '<label for="pt">Votre préférence</label>' +
      '<textarea id="pt" rows="3" placeholder="Ex. plutôt les mardis matin, ou après le 15 septembre…"></textarea>' +
      '<label for="pn">Votre nom</label><input id="pn" autocomplete="name" />' +
      '<label for="pp">Votre téléphone</label><input id="pp" type="tel" autocomplete="tel" />' +
      '<p style="margin-top:18px"><button class="btn" id="pgo">Envoyer</button></p>') +
      '<div class="pied">' +
        recours(['<button id="pretour">← Revoir les créneaux</button>', boutonTel()]) +
      '</div>';
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
        app.innerHTML = enTete() +
          '<h1>C’est transmis&nbsp;!</h1>' +
          carte('<p>' + esc(prenomConnu() || 'Votre commercial') +
            ' vous rappelle pour convenir d’un moment.</p>') +
          '<div class="pied">Une urgence&nbsp;?' + recours([boutonTel()]) + '</div>';
      }).catch(function () { rendre(); secours('Envoi impossible. Merci de réessayer.'); });
    });
  }

  demarrer();
})();

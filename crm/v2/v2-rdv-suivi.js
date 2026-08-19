/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Suivi & contrôle des rendez-vous (pages.rdvsuivi)

   Deux choses en une page :

   1. LE CONTRÔLE — « est-ce que l'outil marche ? », répondu en le
      faisant marcher. On n'affiche pas ce que dit le réglage, on
      demande au serveur ce que le pharmacien VERRAIT s'il cliquait
      maintenant, puis on calcule les créneaux avec le même moteur que
      la page publique. Un réglage juste et un écran vide sont deux
      choses différentes ; c'est le second qui compte.

   2. LE SUIVI — qui a été sollicité, qui a réservé. Rapproché par CIP.
      Une officine qui reçoit un envoi groupé réserve par le lien
      permanent (`origine = 'lien_public'`) : si sa réservation est
      postérieure à l'envoi, on l'attribue à cet envoi.

   ⚠️ CE QU'ON NE SAIT PAS, ON NE L'AFFICHE PAS. Pas d'« ouvert »,
   pas de « cliqué » : il n'y a ni pixel ni mouchard dans ces mails, et
   il n'y en aura pas. Les seules colonnes affichées sont « envoyé »
   (déclaré par le commercial) et « a réservé » (lu en base).

   ⚠️ Un contrôle qui échoue ne condamne rien. Une lecture qui n'aboutit
   pas s'affiche « pas pu vérifier », jamais « cassé ».
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function libelle(iso) {
    var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return JOURS[d.getUTCDay()] + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1];
  }
  function jour(iso) { return String(iso || '').slice(0, 10); }

  // Valeur injectée dans un onclick="…('ICI')" : elle traverse l'analyseur
  // HTML puis l'analyseur JavaScript. esc() seul ne suffit pas — il change '
  // en &#39;, que le navigateur redécode AVANT que JS ne lise la chaîne, ce
  // qui la referme. Même parade que dans v2-rdv.js.
  function escArg(s) {
    return esc(String(s == null ? '' : s).replace(/[\\'"<>&]/g, ''));
  }
  function joursDepuis(iso) {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  }

  // ═══════════════════════════════════════════════════════════════
  // LE CONTRÔLE
  // ═══════════════════════════════════════════════════════════════
  // Chaque contrôle rend : ok (true / false / null = pas pu vérifier),
  // un niveau (bloquant / avertissement / info), et QUOI FAIRE.
  V2.rdvControle = {
    verifier: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve([]);

      return (V2.rdvLien ? V2.rdvLien.charger() : Promise.resolve(null))
        .then(function (l) {
          var url = (V2.rdvLien && V2.rdvLien.url) ? V2.rdvLien.url(l) : '';
          var fenetre = (l && l.token)
            ? c.rpc('rdv_fenetre_publique', { p_token: l.token })
                .then(function (r) { return (r && r.data) || null; })
                .catch(function () { return null; })
            : Promise.resolve(null);

          return Promise.all([
            fenetre,
            c.from('rdv_dispo').select('tel, jours').eq('user_id', u).maybeSingle()
              .then(function (r) { return (r && r.data) || null; })
              .catch(function () { return null; }),
            c.from('rdv_agenda').select('user_id').eq('user_id', u).maybeSingle()
              .then(function (r) { return { ok: true, row: (r && r.data) || null }; })
              .catch(function () { return { ok: false, row: null }; })
          ]).then(function (res) {
            return V2.rdvControle._batir(l, url, res[0], res[1], res[2]);
          });
        })
        .catch(function () { return []; });
    },

    _batir: function (lien, url, F, dispo, ag) {
      var out = [];

      // ── 1. Le lien permanent ────────────────────────────────
      // C'est la clé de voûte : l'envoi groupé ne peut porter que lui.
      if (!lien || !url) {
        out.push({ cle: 'lien', ok: false, niveau: 'bloquant',
          titre: 'Ton lien de réservation n’existe pas',
          detail: 'Sans lui, aucun envoi groupé n’est possible et ta signature de mail ' +
                  'ne mène nulle part.',
          action: ['Ouvrir mes dispos', 'rdvdispo'] });
      } else if (F && F.ok === false) {
        out.push({ cle: 'lien', ok: false, niveau: 'bloquant',
          titre: F.raison === 'ferme' ? 'Ton lien de réservation est fermé'
                                      : 'Ton lien de réservation n’est pas reconnu',
          detail: F.raison === 'ferme'
            ? 'Personne ne peut réserver avec pour l’instant.'
            : 'Le serveur ne le retrouve pas. Regarde le bloc « Mon lien permanent ».',
          action: ['Ouvrir mes dispos', 'rdvdispo'] });
      } else if (!F) {
        out.push({ cle: 'lien', ok: null, niveau: 'info',
          titre: 'Lien de réservation : pas pu vérifier',
          detail: 'Le serveur n’a pas répondu. C’est cette lecture qui a échoué — ' +
                  'ça ne veut pas dire que le lien est cassé. Réessaie dans un instant.',
          action: null });
      } else {
        out.push({ cle: 'lien', ok: true, niveau: 'info',
          titre: 'Ton lien de réservation est ouvert',
          detail: url, action: ['Ouvrir mes dispos', 'rdvdispo'] });
      }

      // ── 2. Ce que le pharmacien verrait ─────────────────────
      // Le contrôle qui compte. On rejoue le calcul de la page publique
      // avec les données que le serveur vient de renvoyer : un réglage
      // correct qui n'ouvre aucune journée reste un écran vide.
      if (F && F.ok !== false && window.V2RDV && window.V2RDV.proposer) {
        var jours = null;
        try {
          jours = window.V2RDV.proposer({
            officine: F.officine || {},
            dispo: F.dispo,
            blocages: F.blocages || [],
            occupes: F.occupes || [],
            agenda: F.agenda || [],
            // Le contrôle rejoue EXACTEMENT le calcul de la page publique :
            // omettre les secteurs déclarés ici ferait dire « tout va bien » à
            // un écran qui, chez le pharmacien, serait vide.
            secteurs: F.secteurs || [],
            aujourdhui: new Date().toISOString().slice(0, 10)
          }) || [];
        } catch (e) { jours = null; }

        if (jours === null) {
          out.push({ cle: 'creneaux', ok: null, niveau: 'info',
            titre: 'Créneaux : pas pu calculer',
            detail: 'Le calcul n’a pas abouti ici. Ouvre ton lien toi-même pour voir ' +
                    'ce que le pharmacien voit.', action: null });
        } else if (!jours.length) {
          out.push({ cle: 'creneaux', ok: false, niveau: 'bloquant',
            titre: 'Ton lien n’ouvre aucun créneau',
            detail: 'Un pharmacien qui clique tombe sur une page vide — c’est pire ' +
                    'que pas de mail du tout. Vérifie tes jours, tes horaires et tes ' +
                    'demi-journées bloquées.',
            action: ['Ouvrir mes dispos', 'rdvdispo'] });
        } else {
          var p = jours[0];
          out.push({ cle: 'creneaux', ok: true, niveau: 'info',
            titre: jours.length + ' journée' + (jours.length > 1 ? 's' : '') +
                   ' ouverte' + (jours.length > 1 ? 's' : '') + ' à la réservation',
            detail: p && p.date ? 'La première proposée est le ' + libelle(p.date) + '.' : '',
            action: null });
        }
      }

      // ── 3. Le numéro de repli ───────────────────────────────
      var tel = dispo && String(dispo.tel || '').trim();
      out.push(tel
        ? { cle: 'tel', ok: true, niveau: 'info',
            titre: 'Ton numéro est donné au pharmacien', detail: tel, action: null }
        : { cle: 'tel', ok: false, niveau: 'avertissement',
            titre: 'Aucun numéro de repli',
            detail: 'Quand aucun créneau ne convient, la page publique propose d’appeler ' +
                    'le commercial. Sans numéro, le pharmacien n’a plus aucune porte de sortie.',
            action: ['Ouvrir mes dispos', 'rdvdispo'] });

      // ── 4. L'agenda personnel ───────────────────────────────
      // Facultatif, mais c'est lui qui évite qu'un pharmacien réserve
      // sur un créneau déjà pris par autre chose.
      if (!ag || ag.ok === false) {
        out.push({ cle: 'agenda', ok: null, niveau: 'info',
          titre: 'Agenda : pas pu vérifier', detail: '', action: null });
      } else if (ag.row) {
        out.push({ cle: 'agenda', ok: true, niveau: 'info',
          titre: 'Ton agenda est relié',
          detail: 'Les créneaux déjà occupés dans ton agenda ne sont pas proposés.',
          action: null });
      } else {
        out.push({ cle: 'agenda', ok: false, niveau: 'avertissement',
          titre: 'Ton agenda n’est pas relié',
          detail: 'Un pharmacien peut réserver sur une heure où tu as déjà autre chose. ' +
                  'JARVIS ne lit aucun titre d’événement, seulement les heures occupées.',
          action: ['Ouvrir mes dispos', 'rdvdispo'] });
      }

      return out;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // LE SUIVI
  // ═══════════════════════════════════════════════════════════════
  function charger() {
    var c = sb(), u = uid();
    if (!c || !u) return Promise.resolve(null);
    return Promise.all([
      // Envois groupés + leurs destinataires, en une lecture.
      c.from('rdv_envoi').select('*, rdv_envoi_dest(*)').eq('user_id', u)
        .not('envoye_le', 'is', null).order('envoye_le', { ascending: false }).limit(60)
        .then(function (r) { return (r && r.data) || []; }).catch(function () { return []; }),
      // Liens de campagne (un par un).
      c.from('rdv_lien').select('cip, nom, ville, envoye_le, consomme_le, expire_le')
        .eq('user_id', u).not('envoye_le', 'is', null)
        .order('envoye_le', { ascending: false }).limit(400)
        .then(function (r) { return (r && r.data) || []; }).catch(function () { return []; }),
      // Les rendez-vous réellement pris — la seule preuve de conversion.
      c.from('rdv').select('cip, date, heure, statut, origine, cree_le, nom')
        .eq('user_id', u).order('cree_le', { ascending: false }).limit(500)
        .then(function (r) { return (r && r.data) || []; }).catch(function () { return []; }),
      // La liste d'opposition, COMMUNE à toute l'équipe : une officine qui a
      // dit STOP ne doit plus être relancée par personne. Sans elle, le bouton
      // STOP réapparaîtrait sur une officine déjà écartée, et une relance la
      // reprendrait dans le lot.
      c.rpc('rdv_opposes')
        .then(function (r) {
          return ((r && r.data) || []).map(function (x) {
            return String(x && x.cip != null ? x.cip : x);
          });
        }).catch(function () { return []; })
    ]).then(function (r) {
      return { envois: r[0], liens: r[1], rdv: r[2], opposes: r[3] };
    });
  }

  // Une officine a-t-elle réservé APRÈS avoir été sollicitée ?
  // On ne compte que les rendez-vous non annulés, et postérieurs à
  // l'envoi : un rendez-vous déjà pris avant ne doit rien à ce mail.
  function reservationApres(rdvs, cip, depuisISO) {
    var t = depuisISO ? new Date(depuisISO).getTime() : 0;
    for (var i = 0; i < rdvs.length; i++) {
      var d = rdvs[i];
      if (String(d.cip || '') !== String(cip)) continue;
      if (d.statut === 'annule') continue;
      if (new Date(d.cree_le).getTime() >= t) return d;
    }
    return null;
  }

  function ensureCss() {
    if (document.getElementById('v2-suivi-css')) return;
    var s = document.createElement('style'); s.id = 'v2-suivi-css';
    s.textContent = [
      // Bandeau pleine largeur : la marge négative doit valoir EXACTEMENT le
      // padding de .v2-wrap, sinon elle déborde et crée un défilement
      // horizontal. Ce padding vaut 26px, et 14px sous 640px (v2.css) —
      // mesuré, pas supposé : un -16px unique débordait de 2px sur mobile.
      '.sv-cap{margin:-8px -26px 0;padding:24px 30px 66px;color:#fff;',
      '  background:linear-gradient(165deg,#0B5BEE,#0039A8)}',
      '@media(max-width:640px){.sv-cap{margin:-8px -14px 0;padding:24px 20px 66px}}',
      '.sv-cap h1{font-size:clamp(23px,5vw,29px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.sv-cap p{margin:0;font-size:14px;color:rgba(255,255,255,.84)}',
      '.sv-ch{display:flex;gap:10px;margin:-50px 0 18px;position:relative}',
      '.sv-ch > div{flex:1;padding:13px;background:var(--card);border:1px solid var(--line);',
      '  border-radius:var(--r-md);box-shadow:0 1px 0 #fff inset,0 8px 20px -12px rgba(16,19,28,.24)}',
      '.sv-ch b{display:block;font-size:22px;font-weight:800;letter-spacing:-.02em;',
      '  font-variant-numeric:tabular-nums}',
      '.sv-ch small{color:var(--muted);font-size:12.5px}',
      '.sv-sec{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;',
      '  color:var(--muted);margin:26px 0 10px}',
      // Un contrôle : une pastille, un titre, ce qu'il faut faire.
      '.sv-ct{display:flex;gap:11px;align-items:flex-start;background:var(--card);',
      '  border:1px solid var(--line);border-radius:var(--r-md);padding:13px 14px;margin-bottom:8px}',
      '.sv-pt{flex:0 0 auto;width:10px;height:10px;border-radius:50%;margin-top:6px}',
      '.sv-pt.ok{background:#0E9E6A}',
      '.sv-pt.ko{background:#D4483B}',
      '.sv-pt.av{background:#E0A21B}',
      '.sv-pt.na{background:var(--line)}',
      '.sv-ct-c{flex:1 1 auto;min-width:0}',
      '.sv-ct b{display:block;font-size:14.5px;font-weight:700}',
      '.sv-ct p{margin:3px 0 0;color:var(--muted);font-size:13px;line-height:1.5;word-break:break-word}',
      '.sv-ct .v2-btn{min-height:44px;margin-top:9px}',
      '.sv-env{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);',
      '  padding:13px 15px;margin-bottom:9px}',
      '.sv-env-h{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}',
      '.sv-env-h b{font-size:14.5px;font-weight:800}',
      '.sv-env-h small{color:var(--muted);font-size:13px}',
      '.sv-env-r{margin:7px 0 0;font-size:13.5px;line-height:1.5}',
      '.sv-env-r .g{color:#0E9E6A;font-weight:700}',
      '.sv-dl{list-style:none;margin:9px 0 0;padding:0;max-height:220px;overflow-y:auto;',
      '  border:1px solid var(--line);border-radius:10px}',
      '.sv-dl li{display:flex;gap:8px;align-items:baseline;padding:8px 11px;font-size:13px;',
      '  border-bottom:1px solid var(--line-2)}',
      '.sv-dl li:last-child{border-bottom:0}',
      '.sv-dl b{flex:1 1 auto;min-width:0;font-weight:600;overflow:hidden;',
      '  text-overflow:ellipsis;white-space:nowrap}',
      '.sv-dl span{flex:0 0 auto;font-size:12px;font-weight:700}',
      '.sv-dl span.g{color:#0E9E6A}',
      '.sv-dl span.m{color:var(--muted);font-weight:600}',
      '.sv-dl span.s{color:#B03A2E;font-weight:700}',
      // Le bouton STOP : discret mais atteignable au doigt (44 px de haut,
      // marges négatives pour ne pas gonfler la ligne).
      '.sv-stop{flex:0 0 auto;min-height:44px;margin:-11px -4px -11px 0;padding:0 9px;',
      '  border:0;background:transparent;color:var(--muted);font:inherit;font-size:11px;',
      '  font-weight:800;letter-spacing:.06em;cursor:pointer}',
      '.sv-stop:hover{color:#B03A2E}',
      '.sv-vide{color:var(--muted);font-size:14px;margin:0 0 6px;line-height:1.55}',
      '.sv-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
      '.sv-acts .v2-btn{min-height:44px}',
      '.sv-hon{color:var(--muted);font-size:12.5px;line-height:1.55;margin:10px 0 0}'
    ].join('');
    document.head.appendChild(s);
  }

  // « 1 a réservé », jamais « 1 ont réservé ».
  function ontReserve(n) { return n > 1 ? 'ont réservé' : 'a réservé'; }

  function ctHtml(x) {
    var cls = x.ok === true ? 'ok' : (x.ok === null ? 'na'
            : (x.niveau === 'bloquant' ? 'ko' : 'av'));
    return '<div class="sv-ct"><span class="sv-pt ' + cls + '"></span><div class="sv-ct-c">' +
      '<b>' + esc(x.titre) + '</b>' +
      (x.detail ? '<p>' + esc(x.detail) + '</p>' : '') +
      (x.action ? '<button class="v2-btn" onclick="V2.go(\'' + esc(x.action[1]) + '\')">' +
        esc(x.action[0]) + '</button>' : '') +
      '</div></div>';
  }

  V2.rdvSuivi = {
    // Honorer un STOP. On reste sur le suivi : c'est là qu'on en traite
    // plusieurs à la suite, en dépouillant ses réponses de mail.
    stop: function (cip, nom) {
      if (!window.confirm((nom || 'Cette officine') +
          ' ne sera plus sollicitée, par personne dans l’équipe. Confirmer ?')) return;
      V2.rdv.nePlusSolliciter(cip, nom, 'rdvsuivi');
    },

    // Reprendre un lot pour relancer ceux qui n'ont pas répondu. On repasse
    // par l'écran Campagne — même ciblage, même aperçu, même garde-fous —
    // avec la sélection déjà cochée et le mode groupé déjà choisi.
    relancer: function (cips) {
      if (!cips || !cips.length) { V2.toast('Personne à relancer.'); return; }
      V2.campagnePreselection = cips.map(String);
      V2.campagneModeVoulu = 'groupe';
      V2.toast(cips.length + ' officine' + (cips.length > 1 ? 's' : '') + ' à relancer.');
      V2.go('campagne');
    }
  };

  V2.pages.rdvsuivi = {
    render: function (root) {
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      root.innerHTML = top + '<div class="v2-wrap narrow"><div class="sv-cap">' +
        '<h1>Suivi & contrôle</h1><p>Lecture en cours…</p></div></div>';

      var c = sb(), u = uid();
      if (!c || !u) {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="sv-cap">' +
          '<h1>Suivi & contrôle</h1><p>Connecte-toi pour voir ton suivi.</p></div></div>';
        return;
      }

      Promise.all([V2.rdvControle.verifier(), charger()]).then(function (res) {
        var controles = res[0] || [];
        var D = res[1] || { envois: [], liens: [], rdv: [], opposes: [] };
        var opposes = D.opposes || [];

        // ── Le compte, canal par canal ────────────────────────
        var solGroupe = 0, cvGroupe = 0;
        var envHtml = D.envois.map(function (e) {
          var dests = e.rdv_envoi_dest || [];
          var nRes = 0;
          var sansReponseIci = [];
          var lignes = dests.map(function (d) {
            var r = reservationApres(D.rdv, d.cip, e.envoye_le);
            if (r) nRes++; else sansReponseIci.push(String(d.cip));
            var age = joursDepuis(e.envoye_le);
            var opp = opposes.indexOf(String(d.cip)) >= 0;
            return '<li><b>' + esc(d.nom || d.cip) + '</b>' +
              (r ? '<span class="g">a réservé le ' + esc(jour(r.date)) + '</span>'
                 : opp ? '<span class="s">ne plus solliciter</span>'
                 : '<span class="m">' + (age != null && age >= 7
                      ? 'sans réponse depuis ' + esc(age) + ' j'
                      : 'en attente') + '</span>') +
              // ⚠️ CHAQUE mail groupé promet par écrit « Répondez STOP à ce
              // message ». Jusqu'au 18/08/2026 cette promesse était intenable
              // pour un destinataire de lot : le bouton n'existait que dans la
              // liste des envois un-par-un. Une officine qui répondait STOP
              // continuait donc de recevoir les campagnes suivantes.
              (r || opp ? '' :
                '<button class="sv-stop" title="Cette officine a répondu STOP" ' +
                'onclick="V2.rdvSuivi.stop(\'' + escArg(d.cip) + '\',\'' +
                escArg(d.nom || '') + '\')">STOP</button>') +
              '</li>';
          }).join('');
          solGroupe += dests.length; cvGroupe += nRes;

          var mod = { bilan: 'Le bilan de son officine', offre: 'La nouveauté du moment',
                      routine: 'La visite de routine' }[e.modele] || e.modele;

          // Relance : on ne reprend QUE ceux qui n'ont pas réservé et qui
          // n'ont pas dit stop. Et pas avant 7 jours — en dessous, le
          // pharmacien n'a simplement pas encore eu le temps, le relancer
          // agace au lieu de convaincre. Même seuil que les envois un-par-un.
          var aRelancer = sansReponseIci.filter(function (cip) {
            return opposes.indexOf(cip) < 0;
          });
          var age = joursDepuis(e.envoye_le);
          var mur = (age != null && age >= 7 && aRelancer.length);

          return '<div class="sv-env">' +
            '<div class="sv-env-h"><b>' + esc(jour(e.envoye_le)) + '</b>' +
              '<small>' + esc(mod) + ' · lot ' + esc(e.lot) + '/' + esc(e.lots_total) +
              ' · ' + esc(dests.length) + ' officine' + (dests.length > 1 ? 's' : '') +
              '</small></div>' +
            '<p class="sv-env-r">' + (nRes
              ? '<span class="g">' + esc(nRes) + ' rendez-vous</span> pris depuis cet envoi.'
              : 'Aucune réservation pour l’instant.') + '</p>' +
            (mur
              ? '<div class="sv-acts" style="margin-top:8px">' +
                  '<button class="v2-btn" onclick="V2.rdvSuivi.relancer(' +
                    esc(JSON.stringify(aRelancer)).replace(/"/g, '&quot;') + ')">' +
                    'Relancer les ' + esc(aRelancer.length) + ' sans réponse</button>' +
                '</div>'
              : (aRelancer.length && age != null && age < 7
                  ? '<p class="sv-hon" style="margin-top:6px">Relance possible dans ' +
                    esc(7 - age) + ' jour' + ((7 - age) > 1 ? 's' : '') +
                    ' — en dessous de 7 jours, on n’a simplement pas laissé le temps.</p>'
                  : '')) +
            (lignes ? '<ul class="sv-dl">' + lignes + '</ul>' : '') +
          '</div>';
        }).join('');

        // ── Les liens un par un ───────────────────────────────
        var solUn = D.liens.length;
        var cvUn = D.liens.filter(function (l) { return l.consomme_le; }).length;
        var sansReponse = D.liens.filter(function (l) {
          var a = joursDepuis(l.envoye_le);
          return !l.consomme_le && a != null && a >= 7;
        }).length;

        var total = solGroupe + solUn, conv = cvGroupe + cvUn;
        var taux = total ? Math.round(conv / total * 100) : 0;

        // Rendez-vous pris sans aucune sollicitation traçable : le lien
        // permanent collé dans une signature de mail travaille tout seul.
        var spontanes = D.rdv.filter(function (d) {
          return d.origine === 'lien_public' && d.statut !== 'annule';
        }).length;

        var bloquants = controles.filter(function (x) {
          return x.ok === false && x.niveau === 'bloquant';
        }).length;

        root.innerHTML = top + '<div class="v2-wrap narrow">' +
          '<div class="sv-cap"><h1>Suivi & contrôle</h1>' +
            '<p>' + (bloquants
              ? esc(bloquants) + ' point' + (bloquants > 1 ? 's' : '') + ' à régler avant d’envoyer'
              : 'Tout est en ordre pour envoyer') + '</p></div>' +

          '<div class="sv-ch">' +
            '<div><b>' + esc(total) + '</b><small>officines sollicitées</small></div>' +
            '<div><b>' + esc(conv) + '</b><small>' + ontReserve(conv) + '</small></div>' +
            '<div><b>' + esc(taux) + ' %</b><small>de retour</small></div>' +
          '</div>' +

          '<div class="sv-sec">Le contrôle</div>' +
          (controles.length ? controles.map(ctHtml).join('')
                            : '<p class="sv-vide">Contrôles indisponibles pour l’instant.</p>') +

          '<div class="sv-sec">Par canal</div>' +
          '<div class="sv-env">' +
            '<p class="sv-env-r"><b>Envoi groupé (Cci)</b> — ' + esc(solGroupe) +
              ' sollicitée' + (solGroupe > 1 ? 's' : '') + ', ' +
              '<span class="g">' + esc(cvGroupe) + '</span> ' + ontReserve(cvGroupe) + '.</p>' +
            '<p class="sv-env-r"><b>Un par un (lien personnel)</b> — ' + esc(solUn) +
              ' sollicitée' + (solUn > 1 ? 's' : '') + ', ' +
              '<span class="g">' + esc(cvUn) + '</span> ' + ontReserve(cvUn) +
              (sansReponse ? ' · ' + esc(sansReponse) + ' sans réponse depuis plus de 7 jours' : '') +
              '.</p>' +
            '<p class="sv-env-r"><b>Lien permanent</b> — ' + esc(spontanes) +
              ' rendez-vous pris par le lien, sollicitation comprise.</p>' +
          '</div>' +

          '<div class="sv-sec">Mes envois groupés</div>' +
          (envHtml || '<p class="sv-vide">Aucun envoi groupé pour l’instant. ' +
            'Depuis la campagne, choisis le mode « groupé en copie cachée » : ' +
            'un seul mail part vers 25 officines à la fois.</p>') +

          '<div class="sv-acts">' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.go(\'campagne\')">' +
              'Préparer un envoi</button>' +
            '<button class="v2-btn" onclick="V2.go(\'rdv\')">Mes rendez-vous</button>' +
          '</div>' +

          '<p class="sv-hon">Il n’y a ni pixel ni mouchard dans ces mails : JARVIS ne sait ' +
          'pas si un mail a été ouvert, et ne le saura pas. « Sollicitée » est ce que tu as ' +
          'coché comme envoyé, « a réservé » est un rendez-vous réellement posé en base après ' +
          'cet envoi.</p>' +
        '</div>';
      });
    }
  };
})();

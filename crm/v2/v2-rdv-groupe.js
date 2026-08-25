/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Envoi groupé en copie cachée (V2.rdvGroupe)

   UN mail, N officines en Cci, UN lien commun. C'est l'autre mode de
   l'écran Campagne — l'existant reste « un par un », personnalisé.

   ── POURQUOI LE COPIER-COLLER ET PAS UN BROUTON AUTOMATIQUE ──────
   Mesuré le 17/08/2026, pas supposé : le corps du modèle « routine »
   fait 1 181 caractères une fois encodé pour une URL `mailto:`, l'objet
   35, et chaque adresse d'officine environ 33. Dès 25 destinataires
   l'URL dépasse 2 048 caractères — la limite au-delà de laquelle
   Windows et Outlook TRONQUENT sans rien dire. Le mail partirait avec
   la moitié des adresses, ou avec un lien coupé.
   C'est exactement le piège qui a fait échouer l'essai de Will le
   12/08 (lien replié sur deux lignes dans un mail en texte brut).

   Donc : le copier-coller est le chemin PRINCIPAL — il n'a aucune
   limite de longueur. Le brouillon automatique reste proposé, mais
   uniquement quand le lot tient sous le budget, et le budget est
   recalculé sur le mail réel à chaque lot.

   ── POURQUOI LE LIEN PERMANENT ──────────────────────────────────
   Un lien de campagne porte un jeton PAR officine : il sait qui il
   est, il se consomme une fois. En copie cachée c'est impossible —
   tout le monde reçoit le même corps. On envoie donc le lien permanent
   du commercial, et c'est la page publique qui demande au pharmacien
   de déclarer son officine avant d'afficher le moindre créneau.

   ── CE QU'ON N'INVENTE PAS ──────────────────────────────────────
   Aucun pixel, aucun suivi d'ouverture, aucun clic tracé. « Envoyé »
   est déclaré par le commercial, « a réservé » est un fait lu en base.
   Rien entre les deux ne sera affiché comme si on le savait.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };

  // Taille d'un lot. 25 pour deux raisons indépendantes :
  //   · au-delà, les messageries d'officine (Orange, Wanadoo, OVH) font
  //     glisser un mail à 50 destinataires cachés vers les indésirables ;
  //   · un lot doit rester relisable avant d'appuyer sur envoyer.
  var PAR_LOT = 25;

  // Budget d'URL pour le brouillon automatique. 2 048 est la limite qui
  // fait tronquer sous Windows ; on s'arrête à 1 900 pour garder de la
  // marge (une adresse longue, un accent de plus dans l'objet).
  var BUDGET_URL = 1900;

  var E = {
    officines: [],   // le lot complet choisi dans l'écran Campagne
    lots: [],        // découpé en paquets de PAR_LOT
    i: 0,            // lot courant
    modele: 'routine',
    texte: '',
    lien: null,      // {token, actif, slug} — le lien permanent
    url: '',         // son adresse publique
    envoyes: 0,
    passes: 0,
    doublons: 0      // officines partageant une adresse avec une autre
  };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function root() { return document.getElementById('v2-root'); }
  function top() {
    return V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
  }

  // Forme minimale d'une adresse. On n'essaie pas de valider une adresse
  // mail « pour de vrai » — c'est impossible — on écarte seulement ce qui
  // ne peut pas en être une, pour ne pas faire échouer tout un envoi.
  function adresseOk(e) {
    e = String(e || '').trim();
    return e.length > 4 && e.length <= 160 && /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(e);
  }

  // ── Le mail du lot, rendu une fois ────────────────────────────
  // Le contexte n'a NI nom NI chiffre : un seul corps part vers 25 officines.
  // C'est aussi ce qui fait qu'un modèle personnel nominatif est refusé ici,
  // par le moteur — voir `ctxGroupe` plus bas.
  function ctxGroupe() {
    return {
      lien: E.url,
      texte_libre: E.texte,
      prenom_commercial: String((V2.user && V2.user.name) || '').split(' ')[0] || '',
      nom_complet_commercial: (V2.user && V2.user.name) || '',
      fonction_commercial: V2.rdvFonction || '',
      tel_commercial: V2.rdvTel || '',
      // La durée est celle du commercial : un seul expéditeur, donc elle vaut
      // pour tout le lot. Contrairement au nom de l'officine et à ses chiffres.
      duree_min: V2.rdvDuree || 45
    };
  }
  function rendu(html) {
    var f = html
      ? (V2.rdvModeleRendreHtml || function (c, x) { return window.V2MOD.rendreGroupeHtml(c, x); })
      : (V2.rdvModeleRendre     || function (c, x) { return window.V2MOD.rendreGroupe(c, x); });
    return f(E.modele, ctxGroupe(), true);
  }
  // ⚠️ Un refus ne doit jamais ressortir en mail vide. L'écran de choix du
  // motif l'empêche déjà, mais un modèle peut être modifié entre-temps :
  // ici on le dit, et on rend le motif « routine » plutôt que du blanc.
  function mail() {
    var m = rendu(false);
    if (m && m.refus) {
      if (V2.toast) V2.toast('Ce modèle nomme l’officine : impossible en copie cachée. ' +
        'Motif « routine » utilisé.');
      return window.V2MOD.rendreGroupe('routine', ctxGroupe());
    }
    return m;
  }

  // Les adresses d'un lot, dédoublonnées. Deux officines d'un même
  // groupement partagent parfois une boîte : l'écrire deux fois dans le
  // même Cci n'envoie pas deux mails, ça signale juste de la négligence.
  function adresses(lot) {
    var vus = {}, out = [];
    lot.forEach(function (o) {
      var e = String(o.email || '').trim();
      if (!adresseOk(e)) return;
      var cle = e.toLowerCase();
      if (vus[cle]) return;
      vus[cle] = 1; out.push(e);
    });
    return out;
  }

  // Longueur réelle de l'URL `mailto:` de ce lot. Calculée, jamais estimée.
  function longueurUrl(lot, m) {
    return urlMailto(lot, m).length;
  }
  function urlMailto(lot, m) {
    // Rien dans `to` : si une messagerie ignorait le champ Cci, le
    // brouillon s'ouvrirait VIDE plutôt que d'exposer les 25 adresses
    // les unes aux autres. Le mauvais cas doit rester le cas inoffensif.
    return 'mailto:?bcc=' + encodeURIComponent(adresses(lot).join(',')) +
      '&subject=' + encodeURIComponent(m.objet) +
      '&body=' + encodeURIComponent(m.corps);
  }

  // ── Copier ────────────────────────────────────────────────────
  // execCommand d'abord : c'est le seul chemin qui marche partout, y
  // compris sur les Safari anciens des iPad de l'équipe. L'API moderne
  // sert de repli, pas l'inverse.
  function copierTexte(t, quoi) {
    var z = document.createElement('textarea');
    z.value = t;
    z.setAttribute('readonly', '');
    z.style.cssText = 'position:fixed;top:0;left:-100000px;opacity:0';
    document.body.appendChild(z);
    z.select(); z.setSelectionRange(0, t.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (x) {}
    document.body.removeChild(z);
    if (ok) { V2.toast(quoi + ' copié.'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t)
        .then(function () { V2.toast(quoi + ' copié.'); })
        .catch(function () { V2.toast('Copie impossible — sélectionne le texte à la main.'); });
      return;
    }
    V2.toast('Copie impossible — sélectionne le texte à la main.');
  }

  // Copie MISE EN FORME : on sélectionne un bloc HTML réellement présent
  // dans la page et on le copie. C'est ce qui préserve gras, puces et
  // lien cliquable au collage dans Outlook — `mailto:` en est incapable,
  // il ne transporte que du texte brut.
  function copierMiseEnForme(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    d.setAttribute('contenteditable', 'true');
    d.style.cssText = 'position:fixed;top:0;left:-100000px;white-space:normal';
    document.body.appendChild(d);
    var sel = window.getSelection(), r = document.createRange();
    sel.removeAllRanges(); r.selectNodeContents(d); sel.addRange(r);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (x) {}
    sel.removeAllRanges();
    document.body.removeChild(d);
    V2.toast(ok
      ? 'Message mis en forme copié — colle-le dans Outlook.'
      : 'Copie impossible. Utilise « Copier le message » (texte simple).');
  }

  // ── Enregistrement ────────────────────────────────────────────
  // Une ligne de lot + une ligne par officine. Sans ça, un envoi groupé
  // ne laisserait AUCUNE trace : on ne saurait plus à qui on a écrit.
  function enregistrer(lot, m, canal) {
    var c = sb(), u = uid();
    if (!c || !u) return Promise.resolve(false);
    return c.from('rdv_envoi').insert({
      user_id: u, modele: E.modele, objet: String(m.objet || '').slice(0, 300),
      lot: E.i + 1, lots_total: E.lots.length, nb_dest: lot.length,
      canal: canal, envoye_le: new Date().toISOString()
    }).select('id').single().then(function (r) {
      if (!r || r.error || !r.data) return false;
      var lignes = lot.map(function (o) {
        return {
          envoi_id: r.data.id, cip: String(o.cip),
          nom: String(o.nom || '').slice(0, 160),
          ville: o.ville || null,
          email: String(o.email || '').slice(0, 160)
        };
      });
      return c.from('rdv_envoi_dest').insert(lignes).then(function (r2) {
        return !(r2 && r2.error);
      });
    }).catch(function () { return false; });
  }

  function ensureCss() {
    if (document.getElementById('v2-rdvgrp-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rdvgrp-css';
    s.textContent = [
      '.rg-sec{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;',
      '  color:var(--muted);margin:24px 0 10px}',
      '.rg-box{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);',
      '  padding:14px 15px;margin-bottom:10px}',
      '.rg-cpt{font-size:15px;font-weight:800;margin:0 0 4px}',
      '.rg-barre{height:6px;background:var(--card-2);border:1px solid var(--line);border-radius:99px;',
      '  overflow:hidden;margin:8px 0 16px}',
      '.rg-barre i{display:block;height:100%;background:var(--ip-blue)}',
      '.rg-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.rg-acts .v2-btn{min-height:44px}',
      '.rg-note{color:var(--muted);font-size:13px;line-height:1.55;margin:12px 0 0}',
      // L'avertissement Cci. Il ne ressemble à aucun autre bloc de l'app :
      // se tromper de champ expose 25 adresses de clients les unes aux autres.
      '.rg-garde{border:1px solid #E0A21B;background:#FFF8E8;color:#6B4A05;',
      '  border-radius:var(--r-md);padding:13px 15px;margin:0 0 14px;font-size:14px;line-height:1.55}',
      '.rg-garde b{font-weight:800}',
      '.rg-stop{border:1px solid #D4483B;background:#FDF1F0;color:#7A241C;',
      '  border-radius:var(--r-md);padding:14px 16px;margin:0 0 14px;font-size:14.5px;line-height:1.55}',
      '.rg-stop b{display:block;font-weight:800;margin-bottom:4px}',
      '.rg-champ{width:100%;font:inherit;font-size:15px;padding:11px 12px;min-height:44px;',
      '  border:1px solid var(--line);border-radius:10px;background:var(--card-2);color:inherit;',
      '  word-break:break-word}',
      'textarea.rg-champ{min-height:250px;line-height:1.6;font-size:14px;resize:vertical}',
      '.rg-dests{list-style:none;margin:8px 0 0;padding:0;max-height:190px;overflow-y:auto;',
      '  border:1px solid var(--line);border-radius:10px}',
      '.rg-dests li{display:flex;gap:8px;align-items:baseline;padding:8px 11px;font-size:13.5px;',
      '  border-bottom:1px solid var(--line-2)}',
      '.rg-dests li:last-child{border-bottom:0}',
      '.rg-dests b{font-weight:700;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.rg-dests small{color:var(--muted);flex:1 1 auto;min-width:0;overflow:hidden;',
      '  text-overflow:ellipsis;white-space:nowrap}',
      '.rg-ecart{color:var(--muted);font-size:12.5px;margin:6px 0 0}'
    ].join('');
    document.head.appendChild(s);
  }

  V2.rdvGroupe = {
    // Appelé par l'écran Campagne, mode « groupé ». Les officines sont
    // déjà filtrées (opposition STOP, adresse mail présente) par la cible.
    demarrer: function (officines, modele, texte) {
      ensureCss();
      E.officines = officines || [];
      E.modele = modele || 'routine';
      E.texte = texte || '';
      E.i = 0; E.envoyes = 0; E.passes = 0; E.doublons = 0;

      var r = root(); if (!r) return;
      r.innerHTML = top() + '<div class="v2-wrap narrow"><div class="v2-rdv-cap">' +
        '<h1>Envoi groupé</h1><p>Préparation…</p></div></div>';

      // Le lien permanent est la clé de voûte : sans lui, le mail part
      // avec un lien mort. On le charge AVANT d'afficher quoi que ce soit.
      Promise.all([
        V2.rdvLien ? V2.rdvLien.charger() : Promise.resolve(null),
        V2.rdvTelCharger ? V2.rdvTelCharger() : Promise.resolve('')
      ]).then(function (res) {
        E.lien = res[0];
        E.url = (V2.rdvLien && V2.rdvLien.url) ? V2.rdvLien.url(E.lien) : '';

        if (!E.lien || !E.url) { V2.rdvGroupe._bloquer('lien-absent'); return; }
        if (!E.lien.actif)     { V2.rdvGroupe._bloquer('lien-ferme');  return; }

        // Un lien actif ne suffit pas : encore faut-il qu'il PROPOSE des
        // créneaux. On le demande au serveur exactement comme le fera le
        // pharmacien — c'est le seul contrôle qui vaille.
        var c = sb();
        var verif = (c && E.lien.token)
          ? c.rpc('rdv_fenetre_publique', { p_token: E.lien.token })
          : Promise.resolve(null);

        verif.then(function (f) {
          var d = (f && f.data) || null;
          // ⚠️ Un contrôle qui échoue ne condamne rien : si l'appel n'a
          // pas abouti (réseau, serveur), on laisse passer en le signalant.
          // C'est la lecture qui a raté, pas forcément le lien.
          if (d && d.ok === false) {
            V2.rdvGroupe._bloquer(d.raison === 'ferme' ? 'lien-ferme' : 'lien-invalide');
            return;
          }
          // ⚠️ Ne PAS bloquer sur l'absence de ligne `rdv_dispo` : le serveur
          // comme la page publique retombent alors sur des horaires par
          // défaut (lundi-vendredi, 9h-12h30 / 14h-18h) et la réservation
          // fonctionne. Bloquer là-dessus arrêterait des envois valables.
          // Le seul cas prouvé où l'écran du pharmacien reste vide, c'est
          // une grille de jours explicitement vidée.
          var dispo = d && d.dispo;
          var vide = dispo && dispo.jours && typeof dispo.jours === 'object' &&
                     Object.keys(dispo.jours).length === 0;
          if (vide) { V2.rdvGroupe._bloquer('sans-creneau'); return; }
          V2.rdvGroupe._preparerLots();
        }).catch(function () { V2.rdvGroupe._preparerLots(); });
      }).catch(function () { V2.rdvGroupe._bloquer('lien-absent'); });
    },

    // Écran d'arrêt. Il ne dit jamais « erreur » : il dit ce qui manque et
    // il emmène à l'endroit où ça se répare.
    _bloquer: function (raison) {
      var r = root(); if (!r) return;
      var T = {
        'lien-absent': {
          t: 'Ton lien de réservation n’a pas pu être chargé',
          p: 'Le mail groupé repose entièrement sur ce lien : sans lui, les pharmaciens ' +
             'recevraient un message sans moyen de réserver. Ouvre « Mes dispos », le lien ' +
             'se crée tout seul à l’affichage, puis reviens.'
        },
        'lien-ferme': {
          t: 'Ton lien de réservation est fermé',
          p: 'Personne ne peut réserver avec pour l’instant. Un envoi groupé partirait ' +
             'vers un lien mort. Rouvre-le dans « Mes dispos », puis reviens.'
        },
        'lien-invalide': {
          t: 'Ton lien de réservation n’est pas reconnu',
          p: 'Le serveur ne retrouve pas ce lien. Ouvre « Mes dispos » et regarde le bloc ' +
             '« Mon lien permanent » : s’il s’affiche, remplace-le, puis reviens.'
        },
        'sans-creneau': {
          t: 'Ton lien ne propose aucun créneau',
          p: 'Un pharmacien qui cliquerait tomberait sur une page vide — c’est pire que ' +
             'pas de mail du tout. Renseigne tes jours et tes horaires dans « Mes dispos », ' +
             'puis reviens.'
        }
      };
      var x = T[raison] || T['lien-absent'];
      r.innerHTML = top() + '<div class="v2-wrap narrow">' +
        '<div class="rg-stop"><b>' + esc(x.t) + '</b>' + esc(x.p) + '</div>' +
        '<div class="rg-acts">' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.go(\'rdvdispo\')">Ouvrir mes dispos</button>' +
          '<button class="v2-btn" onclick="V2.go(\'campagne\')">Retour à la campagne</button>' +
        '</div></div>';
    },

    _preparerLots: function () {
      // On écarte ici ce qui n'a pas d'adresse exploitable, et on compte
      // les officines qui partagent une boîte avec une autre : elles
      // restent destinataires (elles reçoivent bien le mail), mais leur
      // adresse n'est écrite qu'une fois dans le Cci.
      var gardees = E.officines.filter(function (o) { return adresseOk(o.email); });
      var vus = {};
      E.doublons = 0;
      gardees.forEach(function (o) {
        var k = String(o.email).trim().toLowerCase();
        if (vus[k]) E.doublons++; else vus[k] = 1;
      });

      E.lots = [];
      for (var i = 0; i < gardees.length; i += PAR_LOT) {
        E.lots.push(gardees.slice(i, i + PAR_LOT));
      }
      if (!E.lots.length) {
        V2.toast('Aucune officine avec une adresse mail exploitable.');
        V2.go('campagne');
        return;
      }
      V2.rdvGroupe.afficher();
    },

    afficher: function () {
      var r = root(); if (!r) return;
      ensureCss();

      if (E.i >= E.lots.length) {
        var totalDest = E.lots.reduce(function (s, l) { return s + l.length; }, 0);
        r.innerHTML = top() + '<div class="v2-wrap narrow"><div class="v2-rdv-cap">' +
          '<h1>Envoi groupé terminé</h1>' +
          '<p><b>' + esc(E.envoyes) + '</b> lot' + (E.envoyes > 1 ? 's' : '') + ' envoyé' +
          (E.envoyes > 1 ? 's' : '') + ' sur ' + esc(E.lots.length) +
          (E.passes ? ' · ' + esc(E.passes) + ' passé' + (E.passes > 1 ? 's' : '') : '') +
          ' · ' + esc(totalDest) + ' officines touchées.</p></div>' +
          '<p class="rg-note">Les réservations arriveront au fil de l’eau. Elles apparaissent ' +
          'dans « À venir », et le suivi te dira lesquelles viennent de cet envoi.</p>' +
          '<div class="rg-acts">' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.go(\'rdvsuivi\')">Voir le suivi</button>' +
            '<button class="v2-btn" onclick="V2.go(\'rdv\')">Mes rendez-vous</button>' +
          '</div></div>';
        return;
      }

      var lot = E.lots[E.i];
      var m = mail();
      var adr = adresses(lot);
      var lg = longueurUrl(lot, m);
      var brouillonOk = lg <= BUDGET_URL;
      var pct = Math.round(E.i / E.lots.length * 100);

      var dests = lot.map(function (o) {
        return '<li><b>' + esc(o.nom || '') + '</b>' +
          '<small>' + esc(o.ville || '') + (o.email ? ' · ' + esc(o.email) : '') + '</small></li>';
      }).join('');

      r.innerHTML = top() + '<div class="v2-wrap narrow">' +
        '<p class="rg-cpt">Lot ' + (E.i + 1) + ' sur ' + E.lots.length + ' · ' +
          esc(lot.length) + ' officine' + (lot.length > 1 ? 's' : '') + '</p>' +
        '<div class="rg-barre"><i style="width:' + pct + '%"></i></div>' +

        '<div class="rg-garde">' +
          '<b>Colle les adresses dans le champ Cci</b> (copie cachée), jamais dans « À » ni ' +
          '« Cc ». Dans le mauvais champ, les ' + esc(adr.length) + ' pharmacies verraient ' +
          'l’adresse les unes des autres. Avant d’envoyer, vérifie que le champ « À » est vide ' +
          'ou ne contient que ta propre adresse.' +
        '</div>' +

        '<div class="rg-sec">1 · Les adresses</div>' +
        '<div class="rg-box">' +
          '<input class="rg-champ" id="rg-adr" readonly onclick="this.select()" value="' +
            esc(adr.join('; ')) + '" />' +
          '<div class="rg-acts">' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.rdvGroupe.copierAdresses()">' +
              'Copier les ' + esc(adr.length) + ' adresses</button>' +
            '<button class="v2-btn v2-btn-ghost" onclick="V2.rdvGroupe.basculerListe()">' +
              'Voir qui</button>' +
          '</div>' +
          (E.doublons ? '<p class="rg-ecart">' + esc(E.doublons) + ' officine' +
            (E.doublons > 1 ? 's partagent leur boîte mail avec une autre : leur adresse ' +
            'n’est écrite qu’une fois.' : ' partage sa boîte mail avec une autre : son adresse ' +
            'n’est écrite qu’une fois.') + '</p>' : '') +
          '<ul class="rg-dests" id="rg-liste" style="display:none">' + dests + '</ul>' +
        '</div>' +

        '<div class="rg-sec">2 · L’objet</div>' +
        '<div class="rg-box">' +
          '<input class="rg-champ" id="rg-obj" readonly onclick="this.select()" value="' +
            esc(m.objet) + '" />' +
          '<div class="rg-acts">' +
            '<button class="v2-btn" onclick="V2.rdvGroupe.copierObjet()">Copier l’objet</button>' +
          '</div>' +
        '</div>' +

        '<div class="rg-sec">3 · Le message</div>' +
        '<div class="rg-box">' +
          '<textarea class="rg-champ" id="rg-msg" readonly onclick="this.select()">' +
            esc(m.corps) + '</textarea>' +
          '<div class="rg-acts">' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.rdvGroupe.copierMessage()">' +
              'Copier le message</button>' +
            '<button class="v2-btn" onclick="V2.rdvGroupe.copierRiche()">Copier mis en forme</button>' +
          '</div>' +
          '<p class="rg-note">« Mis en forme » garde les puces et le lien cliquable au collage ' +
          'dans Outlook. « Copier le message » colle du texte simple, qui passe partout.</p>' +
        '</div>' +

        '<div class="rg-sec">4 · Envoyer</div>' +
        '<div class="rg-box">' +
          (brouillonOk
            ? '<p class="rg-note" style="margin:0 0 10px">Ce lot tient dans un brouillon ' +
              'automatique (' + esc(lg) + ' caractères sur ' + esc(BUDGET_URL) + ' possibles). ' +
              'Les adresses arrivent directement en Cci — vérifie-le quand même avant d’envoyer.</p>' +
              '<div class="rg-acts" style="margin-top:0">' +
                '<button class="v2-btn" onclick="V2.rdvGroupe.brouillon()">' +
                  'Ouvrir un brouillon tout prêt</button>' +
              '</div>'
            : '<p class="rg-note" style="margin:0">Ce lot est trop long pour un brouillon ' +
              'automatique (' + esc(lg) + ' caractères, la limite d’Outlook est à 2 048). ' +
              'Un brouillon tronquerait les adresses sans le dire : passe par le copier-coller ' +
              'ci-dessus, il n’a aucune limite.</p>') +
        '</div>' +

        '<div class="rg-acts" style="margin-top:16px">' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.rdvGroupe.marquerEnvoye()">' +
            'C’est envoyé ' + ICO('check', 15) + ' → lot suivant</button>' +
          '<button class="v2-btn v2-btn-ghost" onclick="V2.rdvGroupe.passer()">Passer ce lot</button>' +
        '</div>' +
        '<p class="rg-note">JARVIS ne peut pas savoir si le mail est parti de ta boîte — ' +
          'c’est toi qui coches. Le lot est alors enregistré, et le suivi saura qui a été ' +
          'sollicité et qui a réservé ensuite.</p>' +
      '</div>';
    },

    basculerListe: function () {
      var e = document.getElementById('rg-liste');
      if (e) e.style.display = e.style.display === 'none' ? '' : 'none';
    },
    copierAdresses: function () {
      copierTexte(adresses(E.lots[E.i]).join('; '), 'Adresses');
    },
    copierObjet: function () { copierTexte(mail().objet, 'Objet'); },
    copierMessage: function () { copierTexte(mail().corps, 'Message'); },
    copierRiche: function () {
      var h = rendu(true);
      if (h && h.refus) { mail(); h = window.V2MOD.rendreGroupeHtml('routine', ctxGroupe()); }
      copierMiseEnForme(h.html);
    },

    brouillon: function () {
      var lot = E.lots[E.i], m = mail();
      var u = urlMailto(lot, m);
      if (u.length > BUDGET_URL) {
        V2.toast('Lot trop long pour un brouillon — passe par le copier-coller.');
        return;
      }
      window.location.href = u;
    },

    marquerEnvoye: function () {
      var lot = E.lots[E.i], m = mail();
      // Le canal est déduit de ce que le lot permettait : c'est une
      // approximation honnête, et elle sert seulement à savoir, plus tard,
      // lequel des deux gestes l'équipe utilise réellement.
      var canal = longueurUrl(lot, m) <= BUDGET_URL ? 'brouillon' : 'copie';
      enregistrer(lot, m, canal).then(function (ok) {
        if (!ok) V2.toast('Lot envoyé, mais l’enregistrement a échoué — il manquera au suivi.');
        E.envoyes++; E.i++; V2.rdvGroupe.afficher();
      });
    },

    passer: function () { E.passes++; E.i++; V2.rdvGroupe.afficher(); }
  };
})();

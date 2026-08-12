/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Rendez-vous (pages.rdv)
   Crée le lien de réservation, ouvre le mail pré-rempli dans la boîte du
   commercial, et affiche ce que les pharmaciens ont réservé.
   Le lien public sort d'UNE constante : BASE_URL. Le jour où le domaine
   rdv.integralpharma.fr sera branché, c'est la seule ligne à changer.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function prenom() { return String((V2.user && V2.user.name) || '').split(' ')[0] || ''; }
  function libelle(iso) {
    var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return JOURS[d.getUTCDay()] + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1];
  }
  function hhmm(h) { return String(h).slice(0, 5).replace(':', 'h'); }
  function numero(s) { return String(s || '').replace(/[^0-9+]/g, ''); }

  // Valeur injectée DANS un onclick="…('ICI')" : elle traverse deux analyseurs,
  // HTML puis JavaScript. V2.esc seul ne suffit pas — il transforme ' en &#39;,
  // que le navigateur redécode en ' AVANT que JS ne lise la chaîne, ce qui la
  // referme. On neutralise donc quotes, antislashs et chevrons à la source.
  // Le nom du contact et le message viennent de la page publique : ils sont
  // saisis par un inconnu, jamais par nous.
  function escArg(s) {
    return esc(String(s == null ? '' : s).replace(/[\\'"<>&]/g, ''));
  }

  // ── Coordonnées d'une officine ────────────────────────────────
  // Les officines du CRM (WML) n'ont NI e-mail NI adresse postale. Trois sources,
  // dans cet ordre de confiance :
  //   1. CLIENTS (clients-data.js)  — saisi par l'équipe, fait foi
  //   2. PHARMA_FR (base nationale) — 19 671 officines, 95 % tel / 53 % mail
  //   3. MAILS_COMPLEMENT           — retrouvé sur le site de l'officine / OSM
  //   4. WML                        — nom, ville, CP, coordonnées GPS
  // Toutes se réconcilient par le CIP, qui est aussi l'id de l'officine.
  // Mesuré le 10/08/2026 : la source 2 apporte à elle seule +444 téléphones
  // et +322 adresses mail sur les 691 officines du portefeuille.
  function clientDuCip(cip) {
    var t = window.CLIENTS || [];
    for (var i = 0; i < t.length; i++) if (String(t[i].cip) === String(cip)) return t[i];
    return null;
  }

  // Index de la base nationale, construit une fois (19 671 entrées).
  var _natIdx = null;
  function nationalDuCip(cip) {
    var D = window.PHARMA_FR;
    if (!D || !D.p) return null;
    if (!_natIdx || _natIdx._n !== D.p.length) {
      _natIdx = { _n: D.p.length };
      for (var i = 0; i < D.p.length; i++) {
        var id = D.p[i][13];
        if (id != null && id !== '') _natIdx[String(id)] = D.p[i];
      }
    }
    return _natIdx[String(cip)] || null;
  }

  // [lat, lng, uga, grp, seg, comm, nom, ville, cp, tel, titulaire, email, ca, id]
  var NAT = { lat: 0, lng: 1, nom: 6, ville: 7, cp: 8, tel: 9, titulaire: 10, email: 11 };

  V2.rdvInfo = function (pid) {
    var ph = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); }) || {};
    var cl = clientDuCip(pid) || {};
    var n = nationalDuCip(pid) || [];
    var xt = (window.MAILS_COMPLEMENT || {})[String(pid)] || {};
    function nat(k) { return n[NAT[k]] || ''; }
    return {
      cip: String(pid),
      nom: ph.name || cl.nom || nat('nom') || '',
      adresse: cl.adresse || '',
      cp: ph.cp || cl.cp || nat('cp') || '',
      ville: ph.ville || cl.ville || nat('ville') || '',
      email: String(cl.email || nat('email') || xt.email || '').trim(),
      tel: String(ph.tel || cl.tel || nat('tel') || xt.tel || '').trim(),
      contact: String(cl.contact || nat('titulaire') || '').trim(),
      lat: (typeof ph.lat === 'number' ? ph.lat : (typeof n[NAT.lat] === 'number' ? n[NAT.lat] : null)),
      lon: (typeof ph.lng === 'number' ? ph.lng : (typeof n[NAT.lng] === 'number' ? n[NAT.lng] : null))
    };
  };

  // CA cumulé d'une officine, depuis les ventes réseau déjà en mémoire.
  V2.rdvCA = function (pid) {
    if (!V2.sumCA || !V2.sales) return null;
    var s = V2.sales.filter(function (x) { return String(x.pharmacyId) === String(pid); });
    return s.length ? V2.sumCA(s) : null;
  };

  // Téléphone du commercial, lu une fois depuis ses disponibilités et gardé.
  // Chargé à la demande : le mail peut partir de la fiche comme de la campagne,
  // sans dépendre de l'écran par lequel on est passé.
  V2.rdvTel = '';
  var _telPromesse = null;
  V2.rdvTelCharger = function () {
    if (_telPromesse) return _telPromesse;
    var c = sb(), u = uid();
    if (!c || !u) return Promise.resolve('');
    _telPromesse = c.from('rdv_dispo').select('tel').eq('user_id', u).maybeSingle()
      .then(function (d) { V2.rdvTel = (d && d.data && d.data.tel) || ''; return V2.rdvTel; })
      .catch(function () { return ''; });
    return _telPromesse;
  };

  // Les deux jeux de données nécessaires aux coordonnées, chargés à la demande.
  // Sans PHARMA_FR, on perd 322 adresses mail sur 691 : ça vaut l'attente.
  V2.rdvSources = function () {
    return Promise.all([
      window.CLIENTS ? Promise.resolve() : V2.loadFiles(['clients']),
      new Promise(function (ok) {
        if (window.PHARMA_FR || !V2.ensurePharmaFr) { ok(); return; }
        V2.ensurePharmaFr(function () { ok(); });
      })
    ]);
  };

  // Géocodage gratuit sans clé — même service que la tournée et la carte.
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

  function ensureCss() {
    if (document.getElementById('v2-rdv-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rdv-css';
    s.textContent = [
      '.v2-rdv-hero{margin:8px 0 18px}',
      '.v2-rdv-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.v2-rdv-hero p{color:var(--muted);font-size:14px;max-width:56ch;margin:0;line-height:1.5}',
      '.v2-rdv-sec{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:26px 0 10px}',
      '.v2-rdv-jour{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:14px;margin-bottom:10px}',
      '.v2-rdv-jt{font-weight:800;font-size:15px;margin:0 0 8px}',
      '.v2-rdv-l{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line-2)}',
      '.v2-rdv-l:first-of-type{border-top:0}',
      '.v2-rdv-h{font-weight:800;font-variant-numeric:tabular-nums;min-width:52px}',
      '.v2-rdv-n{font-weight:600}',
      '.v2-rdv-c{color:var(--muted);font-size:13px;width:100%}',
      // Fiche de préparation : ce qu'il faut savoir AVANT d'entrer dans l'officine.
      '.v2-rdv-prep{width:100%;margin-top:6px;padding:8px 10px;font-size:13px;line-height:1.5;',
      '  border-left:3px solid var(--ip-blue);background:var(--card-2);border-radius:0 8px 8px 0}',
      '.v2-rdv-prep b{font-weight:800}',
      '.v2-rdv-prep a{min-height:44px;display:inline-flex;align-items:center}',
      '.v2-rdv-c a{color:var(--ip-blue);font-weight:700;text-decoration:none}',
      '.v2-rdv-item{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:12px 14px;margin-bottom:8px}',
      '.v2-rdv-item b{display:block;font-size:14.5px}',
      '.v2-rdv-item .sm{color:var(--muted);font-size:13px}',
      '.v2-rdv-msg{margin:6px 0 0;font-style:italic}',
      '.v2-rdv-vide{color:var(--muted);font-size:14px;margin:0 0 6px}',
      '.v2-rdv-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.v2-rdv-acts .v2-btn{min-height:44px}'
    ].join('');
    document.head.appendChild(s);
  }

  V2.rdv = {
    // Adresse publique de la page du pharmacien. Bascule de domaine = cette ligne.
    BASE_URL: 'https://willmorel49-coder.github.io/jarvis-app/crm/v2/rdv.html',

    // Seul endroit qui ouvre la messagerie. Isolé pour pouvoir vérifier le mail
    // produit sans réellement lancer Mail/Outlook pendant un contrôle.
    _ouvrir: function (url) { window.location.href = url; },

    // Crée un jeton pour cette officine et ouvre le mail pré-rempli.
    // Utilisé aussi bien depuis la fiche (un coup) que depuis la campagne (en série).
    // cb(ok) est appelé une seule fois, réussite ou échec.
    preparerMail: function (pid, modele, texteLibre, cb) {
      var fini = cb || function () {};
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi pour proposer un rendez-vous.'); fini(false); return; }
      var pret = Promise.all([V2.rdvSources(), V2.rdvTelCharger()]);
      pret.then(function () {
        var o = V2.rdvInfo(pid);
        if (!o.email) { V2.toast('Cette officine n’a pas d’adresse mail connue.'); fini(false); return; }
        var coord = (o.lat != null && o.lon != null)
          ? Promise.resolve({ lat: o.lat, lon: o.lon })
          : geocode([o.adresse, o.cp, o.ville].filter(Boolean).join(' '));
        return coord.then(function (ll) {
          return c.from('rdv_lien').insert({
            user_id: u, cip: o.cip, nom: o.nom, adresse: o.adresse || null,
            cp: o.cp || null, ville: o.ville || null,
            lat: ll ? ll.lat : null, lon: ll ? ll.lon : null,
            contact_nom: o.contact || null, modele: modele || 'routine'
          }).select('token').single();
        }).then(function (r) {
          if (!r || r.error || !r.data) { V2.toast('Création du lien impossible.'); fini(false); return; }
          var m = window.V2MOD.rendre(modele || 'routine', {
            contact: o.contact, nom_officine: o.nom, ville: o.ville,
            ca_annee: V2.rdvCA(pid), mois_derniere_visite: null,
            prenom_commercial: prenom(), tel_commercial: V2.rdvTel || '',
            lien: V2.rdv.BASE_URL + '?t=' + r.data.token, texte_libre: texteLibre || ''
          });
          if (m.avertissement) V2.toast(m.avertissement);
          V2.rdv._ouvrir('mailto:' + encodeURIComponent(o.email) +
            '?subject=' + encodeURIComponent(m.objet) + '&body=' + encodeURIComponent(m.corps));
          c.from('rdv_lien').update({ envoye_le: new Date().toISOString() })
            .eq('token', r.data.token).then(function () { fini(true); });
        });
      }).catch(function () { V2.toast('Création du lien impossible.'); fini(false); });
    },

    proposer: function (pid) { V2.rdv.preparerMail(pid, 'routine', '', function () {}); },

    // Relance : trois lignes, avec le MÊME lien. Le jeton vit 21 jours, il est
    // donc encore valide — inutile d'en créer un second qui doublonnerait.
    relancer: function (token, pid) {
      // CLIENTS porte les adresses mail et n'est pas chargé sur cet écran.
      Promise.all([V2.rdvSources(), V2.rdvTelCharger()]).then(function () {
        var o = V2.rdvInfo(pid);
        if (!o.email) { V2.toast('Pas d’adresse mail pour cette officine.'); return; }
        var corps = 'Bonjour' + (o.contact ? ' ' + o.contact : '') + ',\n\n' +
          'Je me permets de revenir vers vous : le lien pour choisir un créneau est toujours actif.\n' +
          V2.rdv.BASE_URL + '?t=' + token + '\n\nBien à vous,\n' + prenom() +
          (V2.rdvTel ? '\n' + V2.rdvTel : '') +
          '\n\n— Si vous ne souhaitez plus recevoir ces propositions, répondez STOP à ce mail.';
        V2.rdv._ouvrir('mailto:' + encodeURIComponent(o.email) +
          '?subject=' + encodeURIComponent('Petit rappel · ' + (o.nom || '')) +
          '&body=' + encodeURIComponent(corps));
      });
    },

    // Reprend les RDV confirmés d'un jour et laisse la tournée existante ordonner
    // la route via OSRM. On ne passe que des CIP : c'est la tournée qui les
    // convertit en indices, une fois pharma-fr-data.js chargé de son côté.
    tourneeDuJour: function (dateISO) {
      var c = sb(), u = uid();
      if (!c || !u) return;
      c.from('rdv').select('cip').eq('user_id', u).eq('statut', 'confirme')
        .eq('date', dateISO).order('heure')
        .then(function (r) {
          var cips = ((r && r.data) || []).map(function (d) { return String(d.cip || ''); })
                       .filter(function (x) { return x; });
          if (!cips.length) { V2.toast('Aucun rendez-vous identifié ce jour-là.'); return; }
          // La page Tournée autonome a été retirée (redondante) : c'est
          // l'Organisateur de tournée de la carte qui ordonne la route.
          if (!V2.carteTourFromIds) { V2.toast('Organisateur de tournée indisponible.'); return; }
          V2.go('carte');
          V2.carteTourFromIds(cips, function (n) {
            if (!n) { V2.toast('Ces officines ne sont pas dans la base nationale.'); return; }
            V2.carteTourOpen(); if (V2.carteTourFit) V2.carteTourFit();
          });
        });
    },

    // Le pharmacien a répondu STOP : on l'écarte des campagnes futures.
    nePlusSolliciter: function (cip, nom) {
      var c = sb(), u = uid();
      if (!c || !u || !cip) { V2.toast('Action impossible.'); return; }
      c.from('rdv_opposition').upsert({ user_id: u, cip: String(cip), motif: 'STOP' },
                                      { onConflict: 'user_id,cip' }).then(function (r) {
        V2.toast(r.error ? 'Enregistrement impossible.'
                         : (nom || 'Cette officine') + ' ne sera plus sollicitée.');
        if (!r.error) V2.go('rdv');
      });
    },

    // Télécharge l'invitation agenda d'un rendez-vous déjà pris.
    ics: function (id) {
      var c = sb();
      if (!c) return;
      c.from('rdv').select('*').eq('id', id).single().then(function (r) {
        if (r.error || !r.data) { V2.toast('Rendez-vous introuvable.'); return; }
        var d = r.data;
        var texte = window.V2ICS.build({
          uid: d.id, date: d.date, heure: String(d.heure).slice(0, 5), duree_min: d.duree_min,
          titre: 'RDV ' + d.nom, lieu: [d.adresse, d.cp, d.ville].filter(Boolean).join(', '),
          description: 'Rendez-vous pris par le pharmacien depuis JARVIS.',
          organisateur: 'Intégral Pharma'
        });
        var a = document.createElement('a');
        a.href = window.V2ICS.dataUrl(texte);
        a.download = 'rdv-' + d.date + '.ics';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      });
    }
  };

  // Ce qu'on sait déjà de l'officine, sans rien recalculer : l'abandon de
  // marge annuel vient de V2.audit (API publique), les ruptures de V2.rupture.
  // Le vrai gain du commercial n'est pas le créneau, c'est d'arriver préparé.
  function prepa(cip) {
    if (!cip) return '';
    var bouts = [];
    try {
      var a = (V2.audit && window.WML_SALES && window.PROD_STATS) ? V2.audit.audit(cip) : null;
      if (a && a.annAb > 0) {
        bouts.push('<b>' + esc(V2.fmtEur ? V2.fmtEur(a.annAb) : Math.round(a.annAb) + ' €') +
                   '/an</b> d’abandon de marge à lui rendre');
      }
    } catch (e) {}
    try {
      // Ruptures ANSM sur ce qu'elle achète, dont ce qu'Intégral a en stock :
      // c'est l'argument le plus concret à poser sur le comptoir.
      var vus = {}, n = 0, dispo = 0;
      (V2.sales || []).forEach(function (s) {
        if (String(s.pharmacyId) !== String(cip) || !(s.qte > 0)) return;
        var c = String(s.artCode || '');
        if (c.length < 7 || vus[c]) return;
        vus[c] = 1;
        if (V2.rupture && V2.rupture(c)) { n++; if (V2.stock && V2.stock(c) > 0) dispo++; }
      });
      if (n) bouts.push('<b>' + n + '</b> rupture' + (n > 1 ? 's' : '') + ' sur ses achats' +
                        (dispo ? ' · <b>' + dispo + '</b> en stock chez nous' : ''));
    } catch (e) {}
    if (!bouts.length) return '';
    return '<div class="v2-rdv-prep">' + bouts.join(' — ') +
      ' · <a href="#" onclick="V2.go(\'pharma\',\'' + escArg(cip) + '\');return false">voir sa fiche</a></div>';
  }

  function ligneRdv(d) {
    var tel = numero(d.contact_tel);
    return '<div class="v2-rdv-l">' +
      '<span class="v2-rdv-h">' + esc(hhmm(d.heure)) + '</span>' +
      '<span class="v2-rdv-n">' + esc(d.nom) + '</span>' +
      (d.ville ? '<span class="sm" style="color:var(--muted)">· ' + esc(d.ville) + '</span>' : '') +
      '<span class="v2-rdv-c">' + (d.contact_nom ? esc(d.contact_nom) : '') +
        (tel ? ' · <a href="tel:' + esc(tel) + '">' + esc(d.contact_tel) + '</a>' : '') +
        ' · <a href="#" onclick="V2.rdv.ics(\'' + escArg(d.id) + '\');return false">ajouter à mon agenda</a>' +
      '</span>' + prepa(d.cip) + '</div>';
  }

  V2.pages.rdv = {
    render: function (root) {
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      root.innerHTML = top + '<div class="v2-wrap narrow"><div class="v2-rdv-hero">' +
        '<h1>Rendez-vous</h1><p>Chargement…</p></div></div>';

      var c = sb(), u = uid();
      if (!c || !u) {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="v2-rdv-hero">' +
          '<h1>Rendez-vous</h1><p>Connecte-toi pour voir tes rendez-vous.</p></div></div>';
        return;
      }
      var auj = new Date().toISOString().slice(0, 10);
      V2.rdvTelCharger();
      Promise.all([
        c.from('rdv').select('*').eq('user_id', u).eq('statut', 'confirme').gte('date', auj)
          .order('date').order('heure'),
        c.from('rdv').select('*').eq('user_id', u).eq('statut', 'a_rappeler')
          .order('cree_le', { ascending: false }),
        // « Sans réponse » = envoyé il y a plus de 7 jours et toujours pas réservé.
        // En dessous, le pharmacien n'a simplement pas encore eu le temps.
        c.from('rdv_lien').select('*').eq('user_id', u).is('consomme_le', null)
          .not('envoye_le', 'is', null)
          .lte('envoye_le', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
          .order('envoye_le', { ascending: false })
      ]).then(function (r) {
        var venir = (r[0] && r[0].data) || [];
        var rappeler = (r[1] && r[1].data) || [];
        var attente = (r[2] && r[2].data) || [];

        var parJour = {}, ordre = [];
        venir.forEach(function (d) {
          if (!parJour[d.date]) { parJour[d.date] = []; ordre.push(d.date); }
          parJour[d.date].push(d);
        });
        var htmlVenir = ordre.length ? ordre.sort().map(function (date) {
          // La tournée n'a de sens qu'à partir de deux arrêts.
          var tournee = (parJour[date].length > 1 && V2.carteTourFromIds)
            ? '<div class="v2-rdv-acts"><button class="v2-btn v2-btn-primary" onclick="V2.rdv.tourneeDuJour(\'' +
              escArg(date) + '\')">' + ICO('pilo', 15) + ' Composer ma tournée de ce jour</button></div>'
            : '';
          return '<div class="v2-rdv-jour"><p class="v2-rdv-jt">' + esc(libelle(date)) + '</p>' +
            parJour[date].map(ligneRdv).join('') + tournee + '</div>';
        }).join('') : '<p class="v2-rdv-vide">Aucun rendez-vous pour l’instant. Ouvre une fiche officine et propose un créneau.</p>';

        var htmlRappeler = rappeler.length ? rappeler.map(function (d) {
          var tel = numero(d.contact_tel);
          return '<div class="v2-rdv-item"><b>' + esc(d.nom) + '</b>' +
            (d.contact_nom ? '<span class="sm">' + esc(d.contact_nom) + '</span>' : '') +
            (d.message ? '<p class="v2-rdv-msg">« ' + esc(d.message) + ' »</p>' : '') +
            (tel ? '<div class="v2-rdv-acts"><a class="v2-btn" href="tel:' + esc(tel) + '">Appeler ' + esc(d.contact_tel) + '</a></div>' : '') +
            '</div>';
        }).join('') : '<p class="v2-rdv-vide">Personne à rappeler.</p>';

        var htmlAttente = attente.length ? attente.map(function (l) {
          var n = String(l.nom || '').replace(/'/g, '');
          return '<div class="v2-rdv-item"><b>' + esc(l.nom) + '</b>' +
            '<span class="sm">envoyé le ' + esc(String(l.envoye_le).slice(0, 10)) + '</span>' +
            '<div class="v2-rdv-acts">' +
              '<button class="v2-btn" onclick="V2.rdv.relancer(\'' + escArg(l.token) + '\',\'' +
                escArg(String(l.cip || '')) + '\')">Relancer</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.rdv.nePlusSolliciter(\'' +
                escArg(String(l.cip || '')) + '\',\'' + escArg(l.nom) + '\')">Ne plus solliciter</button>' +
            '</div></div>';
        }).join('') : '<p class="v2-rdv-vide">Rien à relancer. On ne relance qu’au-delà de 7 jours.</p>';

        root.innerHTML = top + '<div class="v2-wrap narrow">' +
          '<div class="v2-rdv-hero"><h1>Rendez-vous</h1>' +
            '<p>Ce que les pharmaciens ont réservé eux-mêmes, depuis le lien que tu leur as envoyé.</p></div>' +
          '<div class="v2-rdv-sec">À venir</div>' + htmlVenir +
          '<div class="v2-rdv-sec">À rappeler</div>' + htmlRappeler +
          '<div class="v2-rdv-sec">Sans réponse</div>' + htmlAttente +
          '<div class="v2-rdv-acts" style="margin-top:22px">' +
            (V2.pages.campagne
              ? '<button class="v2-btn v2-btn-primary" onclick="V2.go(\'campagne\')">' + ICO('plus', 15) +
                ' Lancer une campagne</button>' : '') +
            '<button class="v2-btn" onclick="V2.go(\'rdvdispo\')">' + ICO('cal', 15) + ' Mes disponibilités</button>' +
          '</div></div>';
      });
    }
  };
})();

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
      '.v2-rdv-acts .v2-btn{min-height:44px}',
      /* ── Le hub (direction 3, choisie le 13/08/2026) ──────────────
         L'en-tête porte l'identité du module : on doit sentir qu'on est
         ENTRÉ quelque part, pas qu'on a ouvert une page de plus. */
      // ⚠️ Corrigé le 17/08/2026 : la marge était de -16px alors que le padding
      // de .v2-wrap vaut 26px, et 14px sous 640px (v2.css). Le bandeau débordait
      // donc de 2px sur mobile et provoquait un défilement horizontal sur tout
      // l'écran. La marge négative doit valoir exactement le padding.
      '.v2-hub-cap{margin:-8px -26px 0;padding:26px 30px 74px;color:#fff;',
      '  background:linear-gradient(165deg,#0B5BEE,#0039A8)}',
      '@media(max-width:640px){.v2-hub-cap{margin:-8px -14px 0;padding:26px 20px 74px}}',
      '.v2-hub-cap h1{font-size:clamp(24px,5vw,30px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.v2-hub-cap p{margin:0;font-size:14px;color:rgba(255,255,255,.84)}',
      // Le module est en essai : le dire en tête, et pas en petit en bas.
      // Un outil annoncé « bêta » qui a un défaut est un outil en essai ;
      // le même défaut sur un outil annoncé fini est une panne.
      '.v2-hub-beta{display:inline-block;margin:0 0 9px;padding:4px 10px;border-radius:20px;',
      '  font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;',
      '  color:#fff;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4)}',
      '.v2-hub-essai{color:var(--muted);font-size:13px;line-height:1.55;margin:18px 0 0}',
      '.v2-hub-essai a{color:var(--ip-blue);font-weight:700;text-decoration:none}',
      '.v2-hub-pro{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);',
      '  padding:15px;margin:-58px 0 16px;position:relative;',
      '  box-shadow:0 1px 0 #fff inset,0 10px 26px -12px rgba(16,19,28,.28)}',
      '.v2-hub-lbl{font-size:13px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;',
      '  color:var(--c-mint-txt,#0F7A52);margin:0 0 8px}',
      '.v2-hub-pro b{display:block;font-size:17px;font-weight:800;letter-spacing:-.01em}',
      '.v2-hub-pro .m{font-size:13.5px;color:var(--muted);margin:5px 0 0}',
      '.v2-hub-pro .v2-btn{min-height:44px;margin-top:12px}',
      '.v2-hub-grille{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin:0 0 16px}',
      '.v2-hub-e{display:flex;flex-direction:column;justify-content:space-between;gap:12px;',
      '  min-height:98px;padding:14px;background:var(--card);border:1px solid var(--line);',
      '  border-radius:var(--r-md);color:inherit;font:inherit;text-align:left;cursor:pointer;',
      '  box-shadow:0 1px 0 #fff inset,0 6px 16px -10px rgba(16,19,28,.18)}',
      '.v2-hub-e.large{grid-column:1/-1;flex-direction:row;align-items:center;min-height:auto}',
      '.v2-hub-e.large span{flex:1;min-width:0}',
      '.v2-hub-e svg{color:var(--ip-blue);flex:0 0 auto}',
      '.v2-hub-e b{display:block;font-size:14.5px;font-weight:700}',
      '.v2-hub-e small{display:block;color:var(--muted);font-size:13px;margin-top:2px}',
      '.v2-hub-ch{display:flex;gap:10px;margin:0 0 6px}',
      '.v2-hub-ch > div{flex:1;padding:12px 13px;background:var(--card);border:1px solid var(--line);',
      '  border-radius:var(--r-md)}',
      '.v2-hub-ch b{display:block;font-size:21px;font-weight:800;letter-spacing:-.02em;',
      '  font-variant-numeric:tabular-nums}',
      '.v2-hub-ch small{color:var(--muted);font-size:13px}'
    ].join('');
    document.head.appendChild(s);
  }

  V2.rdv = {
    // Adresse publique envoyée au pharmacien. Bascule de domaine = cette ligne.
    //
    // Volontairement COURTE : l'ancienne (…/crm/v2/rdv.html?t=…) faisait
    // 101 caractères, or un mail en texte brut est replié vers 76. Le lien se
    // coupait en deux lignes et menait à une adresse tronquée — c'est ce qui a
    // fait échouer le test de Will le 12/08. Mesuré, pas supposé.
    BASE_URL: 'https://willmorel49-coder.github.io/jarvis-app/r',

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
          }).select('token, code').single();
        }).then(function (r) {
          if (!r || r.error || !r.data) { V2.toast('Création du lien impossible.'); fini(false); return; }
          var m = window.V2MOD.rendre(modele || 'routine', {
            contact: o.contact, nom_officine: o.nom, ville: o.ville,
            ca_annee: V2.rdvCA(pid), mois_derniere_visite: null,
            prenom_commercial: prenom(),
            nom_complet_commercial: (V2.user && V2.user.name) || '',
            tel_commercial: V2.rdvTel || '',
            lien: V2.rdv.BASE_URL + '?t=' + (r.data.code || r.data.token), texte_libre: texteLibre || ''
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
    relancer: function (code, pid) {
      // CLIENTS porte les adresses mail et n'est pas chargé sur cet écran.
      Promise.all([V2.rdvSources(), V2.rdvTelCharger()]).then(function () {
        var o = V2.rdvInfo(pid);
        if (!o.email) { V2.toast('Pas d’adresse mail pour cette officine.'); return; }
        var corps = 'Bonjour' + (o.contact ? ' ' + o.contact : '') + ',\n\n' +
          'Je me permets de revenir vers vous : le lien pour choisir un créneau est toujours actif.\n' +
          V2.rdv.BASE_URL + '?t=' + code + '\n\nBien à vous,\n' + prenom() +
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
    // `apres` : où retourner une fois fait. Sans lui on revient au hub — mais
    // depuis le suivi d'un envoi groupé, renvoyer au hub ferait perdre la
    // liste qu'on était en train de traiter. Or c'est justement là qu'on
    // honore le plus de STOP : chaque mail groupé le promet par écrit.
    nePlusSolliciter: function (cip, nom, apres) {
      var c = sb(), u = uid();
      if (!c || !u || !cip) { V2.toast('Action impossible.'); return; }
      // Vaut pour TOUTE l'équipe : la fonction pose la clé par officine, et
      // non plus par (commercial, officine). Une officine qui dit stop à
      // Karine ne doit plus recevoir les mails de Morgane — le refus
      // s'adresse à Intégral, pas à la personne qui a envoyé le mail.
      c.rpc('rdv_opposer', { p_cip: String(cip), p_motif: 'STOP' }).then(function (r) {
        var ok = !r.error && r.data && r.data.ok;
        V2.toast(ok
          ? (nom || 'Cette officine') + ' ne sera plus sollicitée, par personne dans l’équipe.'
          : 'Enregistrement impossible.');
        if (ok) V2.go(apres || 'rdv');
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

  // Une entrée du hub. `ic` est un tracé SVG, jamais une emoji d'interface.
  function entree(route, titre, sous, ic, large) {
    return '<button class="v2-hub-e' + (large ? ' large' : '') +
      '" onclick="V2.go(\'' + route + '\')">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ic + '</svg>' +
      '<span><b>' + esc(titre) + '</b><small>' + esc(sous) + '</small></span></button>';
  }
  var IC = {
    agenda: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    noter: '<path d="M12 5v14M5 12h14"/>',
    envoyer: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
    dispos: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lien: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/>' +
          '<path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    groupe: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/>' +
            '<circle cx="10" cy="8" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4"/>' +
            '<path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8"/>',
    suivi: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7.5 14 3.5-4 3 2.5L19 7"/>'
  };

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
      // Ouvrir cet écran relance une lecture de l'agenda personnel, en fond.
      // On n'attend pas sa réponse : la liste des rendez-vous ne dépend pas de
      // lui, et un agenda lent ne doit pas retarder l'affichage.
      if (V2.rdvAgenda) V2.rdvAgenda.relever();
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
              '<button class="v2-btn" onclick="V2.rdv.relancer(\'' + escArg(l.code || l.token) + '\',\'' +
                escArg(String(l.cip || '')) + '\')">Relancer</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.rdv.nePlusSolliciter(\'' +
                escArg(String(l.cip || '')) + '\',\'' + escArg(l.nom) + '\')">Ne plus solliciter</button>' +
            '</div></div>';
        }).join('') : '<p class="v2-rdv-vide">Rien à relancer. On ne relance qu’au-delà de 7 jours.</p>';

        // ── LE HUB (direction 3) ────────────────────────────────
        // L'en-tête porte l'identité du module, le prochain rendez-vous se
        // lit sans chercher, et les cinq entrées sortent l'agenda, les
        // dispos et les liens du tiroir où ils étaient enfouis.
        var pro = venir.length ? venir[0] : null;
        var libres = 0;
        var semaine = venir.filter(function (d) {
          return d.date <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        }).length;

        var htmlPro = pro
          ? '<div class="v2-hub-pro"><p class="v2-hub-lbl">Prochain</p>' +
              '<b>' + esc(hhmm(pro.heure)) + ' · ' + esc(pro.nom) + '</b>' +
              '<p class="m">' + esc(libelle(pro.date)) +
                (pro.ville ? ' · ' + esc(pro.ville) : '') +
                (pro.contact_nom ? ' · ' + esc(pro.contact_nom) : '') + '</p>' +
              (numero(pro.contact_tel)
                ? '<a class="v2-btn" href="tel:' + esc(numero(pro.contact_tel)) + '">Appeler ' +
                  esc(pro.contact_tel) + '</a>' : '') +
            '</div>'
          : '<div class="v2-hub-pro"><p class="v2-hub-lbl">Aucun rendez-vous à venir</p>' +
              '<b>Ta semaine est libre</b>' +
              '<p class="m">Note un rendez-vous pris au téléphone, ou envoie un lien à une officine ' +
              'pour qu’elle choisisse elle-même son créneau.</p></div>';

        root.innerHTML = top + '<div class="v2-wrap narrow">' +
          '<div class="v2-hub-cap"><span class="v2-hub-beta">Bêta</span><h1>Rendez-vous</h1>' +
            '<p>' + esc(venir.length) + ' à venir · ' + esc(semaine) + ' cette semaine' +
            (attente.length ? ' · ' + esc(attente.length) + ' lien(s) sans réponse' : '') + '</p></div>' +

          htmlPro +

          '<div class="v2-hub-grille">' +
            (V2.pages.rdvplanning ? entree('rdvplanning', 'Mon agenda', '4 semaines, heure par heure', IC.agenda) : '') +
            (V2.pages.rdvajout ? entree('rdvajout', 'Noter un RDV', 'pris au téléphone', IC.noter) : '') +
            (V2.pages.campagne ? entree('campagne', 'Envoyer un lien', 'un par un, personnalisé', IC.envoyer) : '') +
            // L'envoi groupé entre par la campagne, mode « groupé » : c'est le
            // même ciblage et la même sélection, seule la dernière étape change.
            (V2.pages.campagne && V2.rdvGroupe
              ? entree('campagne', 'Envoi groupé', '25 officines en copie cachée', IC.groupe) : '') +
            (V2.pages.rdvsuivi
              ? entree('rdvsuivi', 'Suivi & contrôle', 'qui a réservé, et si tout marche', IC.suivi) : '') +
            entree('rdvdispo', 'Mes dispos', 'jours, horaires, agenda', IC.dispos) +
            entree('rdvdispo', 'Mon lien permanent', 'à envoyer à la main — même écran, plus bas', IC.lien, true) +
          '</div>' +

          '<div class="v2-hub-ch">' +
            '<div><b>' + esc(venir.length) + '</b><small>à venir</small></div>' +
            '<div><b>' + esc(rappeler.length) + '</b><small>à rappeler</small></div>' +
            '<div><b>' + esc(attente.length) + '</b><small>sans réponse</small></div>' +
          '</div>' +

          '<div class="v2-rdv-sec">À venir</div>' + htmlVenir +
          '<div class="v2-rdv-sec">À rappeler</div>' + htmlRappeler +
          '<div class="v2-rdv-sec">Sans réponse</div>' + htmlAttente +

          '<p class="v2-hub-essai">Ce module est <b>en essai</b>. Tout y est réel — les mails ' +
            'partent de ta boîte, les rendez-vous s’enregistrent — mais il bouge encore. ' +
            'Si quelque chose cloche ou te manque, ' +
            (V2.pages.remontees
              ? '<a href="#" onclick="V2.go(\'remontees\');return false">dis-le dans les remontées</a>.'
              : 'dis-le à Will.') +
            ' Le <a href="#" onclick="V2.go(\'rdvsuivi\');return false">suivi</a> te dit à tout ' +
            'moment si la chaîne complète fonctionne.</p>' +
        '</div>';
      });
    }
  };
})();

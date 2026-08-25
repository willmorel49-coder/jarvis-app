/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Rendez-vous (pages.rdv)
   Crée le lien de réservation, ouvre le mail pré-rempli dans la boîte du
   commercial, et affiche ce que les pharmaciens ont réservé.
   Le lien public sort d'UNE constante : SITE_PUBLIC. Le jour où le domaine
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
  // En français le premier jour du mois s'écrit « 1er », jamais « 1 ».
  // La casse reste minuscule : ce libellé s'emploie aussi en milieu de phrase
  // (« C'est noté : vendredi 28 août »), où la majuscule serait fautive. Les
  // appelants qui le placent en tête de ligne mettent la capitale eux-mêmes.
  function libelle(iso) {
    var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var q = +p[2];
    return JOURS[d.getUTCDay()] + ' ' + (q === 1 ? '1er' : q) + ' ' + MOIS[+p[1] - 1];
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

  // ═══════════════════════════════════════════════════════════════
  //  CE QU'ON SAIT DE CETTE OFFICINE — et qui doit entrer dans le mail
  // ═══════════════════════════════════════════════════════════════
  // ⚠️ Jusqu'au 19/08/2026, l'écran appelait le moteur de modèles avec
  // `mois_derniere_visite: null` et ne lui passait aucune rupture. Le moteur
  // savait écrire « cela fait 7 mois » : il écrivait « cela fait un moment »,
  // pour tout le monde, depuis le premier jour. La donnée existait pourtant,
  // à trois endroits différents. C'est ce trou-là que les fonctions qui
  // suivent bouchent — elles ne calculent rien de neuf, elles vont chercher.

  // Ses références en tension à l'ANSM, et celles qu'on a en stock. Un seul
  // passage sur ses ventes ; le code vivait en double dans `prepa()`.
  V2.rdvTension = function (cip) {
    var out = { n: 0, dispo: 0 };
    if (!cip) return out;
    try {
      var vus = {};
      (V2.sales || []).forEach(function (s) {
        if (String(s.pharmacyId) !== String(cip) || !(s.qte > 0)) return;
        var c = String(s.artCode || '');
        if (c.length < 7 || vus[c]) return;
        vus[c] = 1;
        if (V2.rupture && V2.rupture(c)) {
          out.n++;
          if (V2.stock && V2.stock(c) > 0) out.dispo++;
        }
      });
    } catch (e) {}
    return out;
  };

  // Trois sources disent « quand l'a-t-on vue », aucune ne les réunissait :
  //   1. `V2.visite`            — le « vu le… » coché par l'équipe, partagé
  //   2. les RDV JARVIS passés  — les rendez-vous réellement tenus
  //   3. `V2.planningDerniereVisite` — les titres reconnus dans l'agenda perso,
  //      seule source pour les visites qui n'ont jamais transité par JARVIS
  // On garde la plus récente. Une date manquante ne vaut jamais « jamais vue » :
  // elle vaut « je ne sais pas », et le mail retombe alors sur « un moment ».
  var _rdvPasses = null, _vuPromesse = null;
  V2.rdvVuCharger = function () {
    if (_vuPromesse) return _vuPromesse;
    var c = sb(), u = uid();
    var auj = new Date().toISOString().slice(0, 10);
    var pVisites = new Promise(function (ok) {
      if (!V2.visite || !V2.visite.load) { ok(); return; }
      V2.visite.load(function () { ok(); });
    });
    var pRdv = (c && u)
      ? c.from('rdv').select('cip, date').eq('user_id', u).eq('statut', 'confirme')
          .lt('date', auj).then(function (r) {
            var m = {};
            ((r && r.data) || []).forEach(function (d) {
              var k = String(d.cip || ''); if (!k) return;
              if (!m[k] || d.date > m[k]) m[k] = d.date;
            });
            _rdvPasses = m;
          }, function () { _rdvPasses = {}; })
      : Promise.resolve();
    _vuPromesse = Promise.all([pVisites, pRdv]).then(function () { return true; })
      .catch(function () { return false; });
    return _vuPromesse;
  };

  V2.rdvVuLe = function (cip) {
    var k = String(cip || ''), best = null;
    function garder(d) { if (d && (!best || d > best)) best = d; }
    try { if (V2.visite && V2.visite.last) garder(V2.visite.last(k)); } catch (e) {}
    if (_rdvPasses) garder(_rdvPasses[k]);
    try { garder((V2.planningDerniereVisite || {})[k]); } catch (e) {}
    return best || null;
  };

  // En MOIS entiers, parce que c'est ce qu'on écrit dans le mail. En dessous
  // d'un mois on ne dit rien : « cela fait 0 mois » n'est pas une phrase.
  V2.rdvMoisDepuis = function (cip) {
    var d = V2.rdvVuLe(cip);
    if (!d) return null;
    var j = Math.round((Date.now() - new Date(d + 'T12:00:00').getTime()) / 864e5);
    var m = Math.round(j / 30.4);
    return m >= 1 ? m : null;
  };

  // Le contexte complet d'un mail à UNE officine. Un seul endroit le compose :
  // la fiche, la campagne et l'aperçu doivent montrer exactement le même mail,
  // sinon l'aperçu ne prouve plus rien.
  V2.rdvContexte = function (pid, extra) {
    var o = V2.rdvInfo(pid) || {};
    var t = V2.rdvTension(pid);
    var ctx = {
      contact: o.contact, nom_officine: o.nom, ville: o.ville,
      ca_annee: V2.rdvCA(pid),
      mois_derniere_visite: V2.rdvMoisDepuis(pid),
      ruptures_tension: t.n, ruptures_stock: t.dispo,
      prenom_commercial: prenom(),
      nom_complet_commercial: (V2.user && V2.user.name) || '',
      fonction_commercial: V2.rdvFonction || '',
      tel_commercial: V2.rdvTel || '',
      duree_min: V2.rdvDuree || 45
    };
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) ctx[k] = extra[k];
    return ctx;
  };

  // Téléphone du commercial, lu une fois depuis ses disponibilités et gardé.
  // Chargé à la demande : le mail peut partir de la fiche comme de la campagne,
  // sans dépendre de l'écran par lequel on est passé.
  // ⚠️ Cette lecture ne rapportait que le téléphone, et le mail annonçait donc
  // « Quinze minutes suffisent » — un nombre écrit en dur — alors que le
  // créneau réellement bloqué vaut 45 minutes par défaut, 60 pour certains.
  // On promettait au pharmacien le quart de ce qu'on lui prenait. La durée et
  // la fonction viennent maintenant de la même ligne que le numéro : ce qui
  // est annoncé est ce qui est appliqué.
  V2.rdvTel = '';
  V2.rdvDuree = 45;
  V2.rdvFonction = '';
  var _telPromesse = null;
  V2.rdvTelCharger = function () {
    if (_telPromesse) return _telPromesse;
    var c = sb(), u = uid();
    if (!c || !u) return Promise.resolve('');
    _telPromesse = c.from('rdv_dispo').select('tel, duree_min, fonction')
      .eq('user_id', u).maybeSingle()
      .then(function (d) {
        var r = (d && d.data) || {};
        V2.rdvTel = r.tel || '';
        V2.rdvDuree = parseInt(r.duree_min, 10) || 45;
        V2.rdvFonction = r.fonction || '';
        return V2.rdvTel;
      })
      .catch(function () { return ''; });
    return _telPromesse;
  };

  // Le lien permanent du commercial — celui de sa signature de mail. Il vit
  // ICI et nulle part ailleurs : deux endroits qui construisent la même
  // adresse finissent par en construire deux différentes, et c'est la famille
  // de pannes du 13/08 (le lien s'ouvrait, il ne réservait pas).
  var _lienPerm = null;
  V2.rdvLienPermanent = function () {
    if (_lienPerm) return _lienPerm;
    var c = sb(), u = uid();
    if (!c || !u) return Promise.resolve('');
    _lienPerm = c.from('rdv_lien_public').select('slug, token').eq('user_id', u).maybeSingle()
      .then(function (r) {
        var d = (r && r.data) || null;
        if (!d) return '';
        return d.slug ? V2.rdv.lienSlug(d.slug)
                      : (V2.rdv.BASE_URL + '?c=' + d.token);
      })
      .catch(function () { return ''; });
    return _lienPerm;
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
      /* ── « La semaine » (direction d1, choisie par Will le 25/08/2026) ──
         L'écran EST l'agenda. L'ancien hub posait DIX portes et QUATRE
         listes sur un seul écran : 3 091 px de haut sur iPhone, soit quatre
         écrans de défilement, et les mêmes chiffres écrits trois fois.
         ⚠️ La marge négative du bandeau doit valoir EXACTEMENT le padding de
         .v2-wrap (26px, 14px sous 640px) — sinon défilement horizontal. */
      '.v2-sem-cap{margin:-8px -26px 0;padding:20px 30px 18px;color:#fff;position:relative;',
      '  overflow:hidden;background:linear-gradient(168deg,#0B5BEE,#0039A8)}',
      '@media(max-width:640px){.v2-sem-cap{margin:-8px -14px 0;padding:20px 20px 18px}}',
      // La source de lumière : sans elle le bandeau est un aplat mort.
      '.v2-sem-cap::after{content:"";position:absolute;inset:0;pointer-events:none;',
      '  background:radial-gradient(90% 120% at 12% -20%,rgba(255,255,255,.30),rgba(255,255,255,0) 60%)}',
      '.v2-sem-cap h1{font-size:clamp(22px,5vw,26px);font-weight:800;letter-spacing:-.03em;',
      '  margin:0;position:relative}',
      '.v2-sem-cap p{margin:4px 0 0;font-size:14px;color:rgba(255,255,255,.86);position:relative}',

      /* La bande de jours : elle défile horizontalement DANS son cadre, la
         page elle-même ne bouge jamais de côté. */
      '.v2-sem-fond{margin:0 -26px;',
      '  background:linear-gradient(180deg,#0039A8 0%,#0039A8 40%,transparent 40%)}',
      '@media(max-width:640px){.v2-sem-fond{margin:0 -14px}}',
      '.v2-sem-b{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;',
      '  padding:16px 26px 18px}',
      '@media(max-width:640px){.v2-sem-b{padding:16px 14px 18px}}',
      '.v2-sem-b::-webkit-scrollbar{display:none}',
      '.v2-sem-j{position:relative;flex:0 0 auto;min-width:60px;min-height:64px;padding:8px 6px;',
      '  border-radius:14px;',
      '  border:1px solid var(--line);background:var(--card);text-align:center;cursor:pointer;',
      '  font:inherit;color:inherit;box-shadow:0 1px 0 #fff inset,0 6px 16px -10px rgba(16,19,28,.28)}',
      '.v2-sem-j .d{display:block;font-size:13px;font-weight:800;letter-spacing:.05em;',
      '  text-transform:uppercase;color:var(--muted)}',
      '.v2-sem-j .n{display:block;font-size:20px;font-weight:800;letter-spacing:-.02em;margin-top:1px;',
      '  font-variant-numeric:tabular-nums}',
      '.v2-sem-j .pt{display:block;height:6px;width:6px;margin:5px auto 0;border-radius:99px;',
      '  background:var(--line)}',
      '.v2-sem-j .pt.on{background:var(--ip-blue);width:22px}',
      '.v2-sem-j[aria-current="true"]{background:var(--ip-blue);border-color:var(--ip-blue);',
      '  box-shadow:0 1px 0 rgba(255,255,255,.3) inset,0 10px 22px -10px rgba(0,80,230,.7)}',
      '.v2-sem-j[aria-current="true"] .d{color:rgba(255,255,255,.72)}',
      '.v2-sem-j[aria-current="true"] .n{color:#fff}',
      '.v2-sem-j[aria-current="true"] .pt,.v2-sem-j[aria-current="true"] .pt.on{background:#fff}',

      '.v2-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;',
      '  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}',
      '.v2-sem-t{margin:2px 0 12px;font-size:19px;font-weight:800;letter-spacing:-.02em}',
      '.v2-sem-t span{font-weight:500;color:var(--muted)}',

      /* Un rendez-vous = une ligne d'agenda : l'heure tient la colonne. */
      '.v2-sem-r{display:flex;gap:14px;padding:14px;margin-bottom:10px;background:var(--card);',
      '  border:1px solid var(--line);border-radius:var(--r-md);',
      '  box-shadow:0 1px 0 #fff inset,0 8px 22px -14px rgba(16,19,28,.30)}',
      '.v2-sem-r .h{flex:0 0 54px;font-size:17px;font-weight:800;letter-spacing:-.02em;',
      '  font-variant-numeric:tabular-nums;padding-top:1px}',
      '.v2-sem-r .co{flex:1;min-width:0}',
      '.v2-sem-r .nom{font-size:15.5px;font-weight:700;letter-spacing:-.01em}',
      '.v2-sem-r .ou{font-size:13.5px;color:var(--muted);margin-top:2px}',
      /* ⚠️ Deux boutons par ligne, jamais trois : à 390 px le troisième passe
         à la ligne et casse le rythme. Mesuré à l'écran, pas supposé. */
      '.v2-sem-r .act{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}',
      '.v2-sem-r .act a,.v2-sem-r .act button{display:inline-flex;align-items:center;',
      '  min-height:44px;padding:0 14px;border-radius:11px;border:1px solid var(--line);',
      '  background:var(--card-2);font-size:14px;font-weight:600;text-decoration:none;',
      '  color:inherit;font-family:inherit;cursor:pointer}',
      '.v2-sem-r .act a.tel{color:var(--ip-blue);border-color:#CFDFFB;background:#EAF0FE}',

      '.v2-sem-tour{display:flex;align-items:center;gap:12px;padding:14px;',
      '  border-radius:var(--r-md);margin-bottom:10px;color:#fff;border:0;width:100%;',
      '  text-align:left;font:inherit;cursor:pointer;',
      '  background:linear-gradient(140deg,#0B5BEE,#0039A8);',
      '  box-shadow:0 12px 26px -14px rgba(0,57,168,.9)}',
      '.v2-sem-tour b{display:block;font-size:15px;font-weight:700}',
      '.v2-sem-tour small{display:block;font-size:13px;color:rgba(255,255,255,.82);margin-top:1px}',
      '.v2-sem-tour .go{margin-left:auto;flex:0 0 auto;min-height:44px;display:flex;',
      '  align-items:center;padding:0 14px;border-radius:11px;background:rgba(255,255,255,.18);',
      '  border:1px solid rgba(255,255,255,.42);font-weight:700;font-size:14px}',

      '.v2-sem-vide{padding:26px 18px;text-align:center;color:var(--muted);background:var(--card);',
      '  border:1px dashed var(--line);border-radius:var(--r-md)}',
      '.v2-sem-vide b{display:block;color:var(--text);font-size:15.5px;margin-bottom:4px}',

      /* La barre du bas : les deux gestes du quotidien, toujours à portée. */
      '.v2-sem-barre{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;z-index:40;',
      '  padding:12px 16px calc(12px + env(safe-area-inset-bottom));',
      '  background:var(--paper);border-top:1px solid var(--line)}',
      '.v2-sem-barre .v2-btn{flex:1;min-height:48px}',
      '.v2-sem-barre .plus{flex:0 0 58px;min-width:58px;padding:0;position:relative}',
      /* ⚠️ La pastille : le risque assumé de cette direction est que les
         relances passent derrière « ··· ». Ce qui attend une réponse ne doit
         JAMAIS disparaître en silence — d'où ce compteur toujours visible. */
      '.v2-sem-barre .plus .pastille{position:absolute;top:2px;right:2px;min-width:22px;',
      '  height:22px;padding:0 6px;border-radius:99px;background:#C7283D;color:#fff;',
      '  font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center}',
      '.v2-sem-fin{height:84px}',

      /* Le panneau « ··· » : tout le reste du module, rangé mais pas caché. */
      '.v2-sem-pan{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;',
      '  background:var(--paper)}',
      '.v2-sem-pan[hidden]{display:none}',
      '.v2-sem-pan .tete{display:flex;align-items:center;gap:12px;padding:14px 16px;',
      '  border-bottom:1px solid var(--line);background:var(--card)}',
      '.v2-sem-pan .tete b{font-size:17px;font-weight:800;letter-spacing:-.02em}',
      '.v2-sem-pan .tete button{margin-left:auto;min-height:44px;min-width:44px;',
      '  border-radius:12px;border:1px solid var(--line);background:var(--card-2);',
      '  font:inherit;cursor:pointer}',
      '.v2-sem-pan .dedans{flex:1;overflow-y:auto;padding:16px 16px 40px}',
      '.v2-sem-g{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin:0 0 20px}',
      '.v2-sem-e{display:flex;flex-direction:column;justify-content:space-between;gap:12px;',
      '  min-height:98px;padding:14px;background:var(--card);border:1px solid var(--line);',
      '  border-radius:var(--r-md);color:inherit;font:inherit;text-align:left;cursor:pointer;',
      '  box-shadow:0 1px 0 #fff inset,0 6px 16px -10px rgba(16,19,28,.18)}',
      '.v2-sem-e.large{grid-column:1/-1;flex-direction:row;align-items:center;min-height:auto}',
      '.v2-sem-e.large span{flex:1;min-width:0}',
      '.v2-sem-e svg{color:var(--ip-blue);flex:0 0 auto}',
      '.v2-sem-e b{display:block;font-size:14.5px;font-weight:700}',
      '.v2-sem-e small{display:block;color:var(--muted);font-size:13px;margin-top:2px}',
      '.v2-sem-essai{color:var(--muted);font-size:13px;line-height:1.55;margin:18px 0 0}',
      '.v2-sem-essai a{display:inline-flex;align-items:center;min-height:44px;',
      '  color:var(--ip-blue);font-weight:700;text-decoration:none}'
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
    // ═══════════════════════════════════════════════════════════
    //  L'ADRESSE QUE VOIT LE PHARMACIEN — une seule ligne (19/08/2026)
    // ═══════════════════════════════════════════════════════════
    // Elle valait `https://willmorel49-coder.github.io/jarvis-app/…`, ce qui
    // affichait dans chaque mail le pseudo GitHub de l'expéditeur ET le nom
    // d'un dépôt PUBLIC contenant tout le CRM. Recopier l'adresse dans GitHub
    // suffisait à tout ouvrir : ce n'était pas une question d'apparence.
    //
    // Le site pointé ici ne contient QUE la page de réservation — 13 fichiers,
    // aucune donnée client (voir scripts/build-rdv-public.py). Il n'y a donc
    // rien d'autre à trouver sur cette adresse, et c'est ce qui fait la
    // différence avec un simple habillage.
    //
    // ⚠️ L'ANCIENNE ADRESSE RESTE VIVANTE, et doit le rester : des liens de
    // campagne (21 jours) et des liens de gestion glissés dans les fichiers
    // agenda des pharmaciens y pointent déjà. On change ce qu'on ÉMET, jamais
    // ce qui est déjà parti.
    SITE_PUBLIC: 'https://prendre-rendez-vous.vercel.app/',

    // Gardé : tout le module l'utilise, et un mail déjà écrit peut le citer.
    get BASE_URL() { return V2.rdv.SITE_PUBLIC + 'r'; },

    // L'adresse courte d'un commercial, celle de sa signature de mail.
    // ⚠️ Elle se construisait à DEUX endroits (ici et v2-rdv-lien.js) à partir
    // de `window.location.origin` — donc de l'adresse du CRM. Deux chemins qui
    // fabriquent la même adresse finissent par en fabriquer deux différentes :
    // c'est la famille de pannes du 13/08. Un seul endroit, désormais.
    lienSlug: function (slug) { return V2.rdv.SITE_PUBLIC + 'rdv/' + slug; },

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
      // ⚠️ Les modèles personnels doivent être en mémoire AVANT de composer :
      // sans le cache, un motif « perso:… » ne se résoudrait pas et le mail
      // partirait en « routine » sans que personne le remarque.
      var pret = Promise.all([V2.rdvSources(), V2.rdvTelCharger(), V2.rdvVuCharger(),
        V2.rdvModeles ? V2.rdvModeles.charger() : null]);
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
          var ctx = V2.rdvContexte(pid, {
            lien: V2.rdv.BASE_URL + '?t=' + (r.data.code || r.data.token),
            texte_libre: texteLibre || ''
          });
          // `modele` peut désigner un modèle personnel (« perso:<id> ») : c'est
          // le même contexte, seul le texte change.
          var m = V2.rdvModeleRendre
            ? V2.rdvModeleRendre(modele || 'routine', ctx, false)
            : window.V2MOD.rendre(modele || 'routine', ctx);
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

    // ── LA JOURNÉE QUI SE REMPLIT ──────────────────────────────
    // Un rendez-vous posé fixe une zone. Faire 300 km pour un seul arrêt est
    // la façon la plus coûteuse de travailler, et c'est ce qui arrive quand
    // rien ne propose les voisines au moment où la journée s'ouvre.
    completer: function (dateISO) {
      var c = sb(), u = uid();
      if (!c || !u || !V2.rdvRadar) { V2.toast('Indisponible.'); return; }
      V2.toast('Recherche des officines autour de cette journée…');
      c.from('rdv').select('cip, nom, lat, lon').eq('user_id', u)
        .eq('statut', 'confirme').eq('date', dateISO)
        .then(function (r) {
          var jour = (r && r.data) || [];
          return V2.rdvRadar.voisines(jour);
        })
        .then(function (v) {
          if (v.sansPosition) {
            V2.toast('Les rendez-vous de ce jour n’ont pas de position connue : ' +
                     'impossible de chercher autour.');
            return;
          }
          if (!v.liste.length) {
            V2.toast('Aucune officine joignable par mail à moins de 25 km, ' +
                     'hors celles qui ont déjà un rendez-vous.');
            return;
          }
          // On s'arrête à 8 : au-delà, ce ne sont plus des voisines, et une
          // journée ne tient de toute façon pas douze arrêts.
          var lot = v.liste.slice(0, 8);
          V2.toast(lot.length + ' officine' + (lot.length > 1 ? 's' : '') + ' à moins de ' +
            Math.round(lot[lot.length - 1].km) + ' km — liste prête dans la campagne.');
          V2.rdvRadar.versCampagne(lot.map(function (x) { return x.cip; }));
        });
    },

    // ── APRÈS la visite ────────────────────────────────────────
    // Le mot de remerciement, pré-rempli. Il part de SA boîte, comme tout
    // le reste : JARVIS n'envoie jamais de mail à la place de quelqu'un.
    remercier: function (id) {
      var c = sb();
      if (!c) return;
      var perm = '';
      Promise.all([V2.rdvSources(), V2.rdvTelCharger(), V2.rdvLienPermanent()])
        .then(function (res) {
          perm = res[2] || '';
          return c.from('rdv').select('*').eq('id', id).single();
        }).then(function (r) {
        if (!r || r.error || !r.data) { V2.toast('Rendez-vous introuvable.'); return; }
        var d = r.data;
        var o = d.cip ? V2.rdvInfo(d.cip) : {};
        // Le contact du jour vaut mieux que le titulaire du fichier : c'est la
        // personne qui était en face, elle a donné son nom elle-même.
        var contact = d.contact_nom || o.contact || '';
        var mail = String(o.email || '').trim();
        if (!mail) {
          V2.toast('Pas d’adresse mail connue pour ' + (d.nom || 'cette officine') + '.');
          return;
        }
        var m = window.V2MOD.remerciement({
          contact: contact, nom_officine: d.nom, date_visite: libelle(d.date),
          prenom_commercial: prenom(),
          nom_complet_commercial: (V2.user && V2.user.name) || '',
          tel_commercial: V2.rdvTel || '',
          lien: perm
        });
        V2.rdv._ouvrir('mailto:' + encodeURIComponent(mail) +
          '?subject=' + encodeURIComponent(m.objet) + '&body=' + encodeURIComponent(m.corps));
      });
    },

    // « J'y suis allé » : c'est CE geste qui alimente « pas vue depuis 7 mois »
    // dans les mails et dans le radar. Sans lui, la boucle ne se referme pas.
    // Partagé avec toute l'équipe, comme le « vu le… » des fiches officine.
    jySuisAlle: function (cip, nom) {
      if (!cip || !V2.visite) { V2.toast('Officine non identifiée.'); return; }
      V2.visite.mark(cip, function () {
        V2.toast('Visite notée pour ' + (nom || 'cette officine') + '.');
        V2.go('rdv');
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
      // c'est l'argument le plus concret à poser sur le comptoir. Le calcul
      // vit dans V2.rdvTension — le mail et cette ligne doivent dire pareil.
      var t = V2.rdvTension(cip);
      if (t.n) bouts.push('<b>' + t.n + '</b> rupture' + (t.n > 1 ? 's' : '') + ' sur ses achats' +
                        (t.dispo ? ' · <b>' + t.dispo + '</b> en stock chez nous' : ''));
    } catch (e) {}
    if (!bouts.length) return '';
    return '<div class="v2-rdv-prep">' + bouts.join(' — ') +
      ' · <a href="#" onclick="V2.go(\'pharma\',\'' + escArg(cip) + '\');return false">voir sa fiche</a></div>';
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
    suivi: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7.5 14 3.5-4 3 2.5L19 7"/>',
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>' +
           '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
    tel: '<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2C10.6 17.9 6.1 13.4 4.5 5.2A2 2 0 0 1 6.5 3z"/>',
    plume: '<path d="M20 4C13 4 8 8 6.5 14.5L4 20"/><path d="M20 4c0 8-5 12-11 12H6.5"/>'
  };


  // ═══════════════════════════════════════════════════════════════
  //  L'ÉCRAN — direction « La semaine » (choisie par Will le 25/08/2026)
  // ═══════════════════════════════════════════════════════════════
  // L'écran EST l'agenda : une bande de jours, la journée dessous, deux
  // gestes en bas. Ce qui précédait — le hub du 13/08 — posait DIX portes,
  // TROIS compteurs et QUATRE listes sur un seul écran : 3 091 px de haut
  // sur iPhone (mesuré), soit quatre écrans de défilement, avec les mêmes
  // chiffres écrits trois fois de suite.
  //
  // ⚠️ Le risque assumé de cette direction, dit à Will avant qu'il choisisse :
  // les relances qui dorment ne sont plus sous le nez, elles passent derrière
  // le bouton « ··· ». C'est pour ça que ce bouton porte une PASTILLE
  // CHIFFRÉE — ce qui attend une réponse ne doit jamais disparaître en
  // silence, sinon on l'oublie et personne ne s'en aperçoit.

  // Ce que la dernière lecture a rendu. Changer de jour NE RELIT RIEN et ne
  // recharge pas l'écran : Will a dit « ça fait revenir en arrière c'est
  // chiant ». On re-rend uniquement la zone de la journée.
  var ETAT = null;

  function jourPlus(iso, n) {
    var q = String(iso).split('-');
    var d = new Date(Date.UTC(+q[0], +q[1] - 1, +q[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function jourSem(iso) {
    var q = String(iso).split('-');
    return new Date(Date.UTC(+q[0], +q[1] - 1, +q[2])).getUTCDay();
  }

  // Les jours de la bande : trois semaines ouvrées, plus tout jour qui porte
  // un rendez-vous. Un samedi vide n'a rien à faire là ; un samedi où l'on a
  // rendez-vous ne doit surtout pas manquer.
  function joursDeLaBande(auj, parJour) {
    var out = [], vus = {};
    for (var i = 0; i < 21; i++) {
      var d = jourPlus(auj, i), js = jourSem(d);
      if ((js >= 1 && js <= 5) || parJour[d]) { out.push(d); vus[d] = 1; }
    }
    Object.keys(parJour).forEach(function (d) { if (!vus[d] && d >= auj) out.push(d); });
    return out.sort();
  }

  function bandeHtml(jours, parJour, choisi) {
    return '<nav class="v2-sem-b" aria-label="Les trois prochaines semaines">' +
      jours.map(function (d) {
        var n = (parJour[d] || []).length;
        return '<button class="v2-sem-j" type="button"' +
          (d === choisi ? ' aria-current="true"' : '') +
          ' onclick="V2.rdv.jour(\'' + escArg(d) + '\')">' +
          '<span class="d">' + esc(JOURS[jourSem(d)].slice(0, 3)) + '</span>' +
          '<span class="n">' + esc(+String(d).split('-')[2]) + '</span>' +
          '<span class="pt' + (n ? ' on' : '') + '"></span>' +
          '<span class="v2-sr-only">' + (n ? n + ' visite' + (n > 1 ? 's' : '') : 'aucune visite') +
          '</span></button>';
      }).join('') + '</nav>';
  }

  // Une ligne de la journée. Deux boutons au maximum : à 390 px le troisième
  // passe à la ligne — constaté à l'écran le 25/08, pas supposé.
  function ligneJour(d) {
    var tel = numero(d.contact_tel);
    var ou = [d.ville, d.contact_nom].filter(Boolean).map(esc).join(' · ');
    var mois = V2.rdvMoisDepuis ? V2.rdvMoisDepuis(d.cip) : null;
    if (mois) ou += (ou ? ' · ' : '') + 'vue il y a ' + mois + ' mois';
    return '<article class="v2-sem-r">' +
      '<div class="h">' + esc(hhmm(d.heure)) + '</div>' +
      '<div class="co">' +
        '<div class="nom">' + esc(d.nom) + '</div>' +
        (ou ? '<div class="ou">' + ou + '</div>' : '') +
        prepa(d.cip) +
        '<div class="act">' +
          (tel ? '<a class="tel" href="tel:' + esc(tel) + '">Appeler</a>' : '') +
          '<button type="button" onclick="V2.rdv.ics(\'' + escArg(d.id) + '\')">' +
            'Agenda</button>' +
        '</div>' +
      '</div></article>';
  }

  function journeeHtml(date) {
    if (!ETAT) return '';
    var liste = (ETAT.parJour[date] || []).slice().sort(function (a, b) {
      return String(a.heure) < String(b.heure) ? -1 : 1;
    });
    var lib = libelle(date);
    lib = lib.charAt(0).toUpperCase() + lib.slice(1);
    var h = '<p class="v2-sem-t">' + esc(lib) + ' <span>· ' +
      (liste.length ? liste.length + ' visite' + (liste.length > 1 ? 's' : '') : 'aucune visite') +
      '</span></p>';

    // La tournée n'a de sens qu'à partir de deux arrêts.
    if (liste.length > 1 && V2.carteTourFromIds) {
      h += '<button class="v2-sem-tour" type="button" onclick="V2.rdv.tourneeDuJour(\'' +
        escArg(date) + '\')"><span><b>Ta tournée du jour</b>' +
        '<small>' + esc(liste.length) + ' arrêts</small></span>' +
        '<span class="go">Ouvrir</span></button>';
    }

    if (liste.length) {
      h += liste.map(ligneJour).join('');
      if (V2.rdvRadar) {
        h += '<div class="v2-rdv-acts"><button class="v2-btn" type="button" onclick="V2.rdv.completer(\'' +
          escArg(date) + '\')">Compléter cette journée</button></div>';
      }
    } else {
      h += '<div class="v2-sem-vide"><b>Rien de prévu ce jour-là</b>' +
        'Les officines proches que tu n’as pas vues depuis longtemps sont les moins ' +
        'chères à aller voir.' +
        (V2.rdvRadar
          ? '<div style="margin-top:14px"><button class="v2-btn" type="button" onclick="V2.rdv.completer(\'' +
            escArg(date) + '\')">Remplir cette journée</button></div>'
          : '') +
        '</div>';
    }
    return h;
  }

  // Le panneau « ··· » : tout le reste du module. Rangé, jamais supprimé.
  function panneauHtml() {
    var e = ETAT || { attente: [], rappeler: [], passes: [] };
    var portes =
      (V2.pages.rdvplanning ? entreeP('rdvplanning', 'Mon agenda', '4 semaines, heure par heure', IC.agenda) : '') +
      (V2.pages.campagne && V2.rdvGroupe
        ? entreeP('campagne', 'Envoi groupé', '25 officines en copie cachée', IC.groupe) : '') +
      (V2.pages.rdvradar ? entreeP('rdvradar', 'Qui inviter', 'la liste se fait toute seule', IC.radar) : '') +
      (V2.pages.rdvappels ? entreeP('rdvappels', 'Qui appeler', 'celles qui n’ont pas de mail', IC.tel) : '') +
      (V2.pages.rdvmodeles ? entreeP('rdvmodeles', 'Mes modèles', 'écris tes propres mails', IC.plume) : '') +
      (V2.pages.rdvsuivi ? entreeP('rdvsuivi', 'Suivi & contrôle', 'qui a réservé, et si tout marche', IC.suivi) : '') +
      entreeP('rdvdispo', 'Mes dispos', 'jours, horaires, agenda', IC.dispos) +
      entreeP('rdvdispo', 'Mon lien permanent', 'à envoyer à la main — même écran, plus bas', IC.lien, true);

    var sansReponse = e.attente.length
      ? e.attente.map(function (l) {
          return '<div class="v2-rdv-item"><b>' + esc(l.nom) + '</b>' +
            '<span class="sm">envoyé le ' + esc(String(l.envoye_le).slice(0, 10)) + '</span>' +
            '<div class="v2-rdv-acts">' +
              '<button class="v2-btn" type="button" onclick="V2.rdv.relancer(\'' +
                escArg(l.code || l.token) + '\',\'' + escArg(String(l.cip || '')) + '\')">Relancer</button>' +
              '<button class="v2-btn v2-btn-ghost" type="button" onclick="V2.rdv.nePlusSolliciter(\'' +
                escArg(String(l.cip || '')) + '\',\'' + escArg(l.nom) + '\')">Ne plus solliciter</button>' +
            '</div></div>';
        }).join('')
      : '<p class="v2-rdv-vide">Rien à relancer. On ne relance qu’au-delà de 7 jours.</p>';

    var aRappeler = e.rappeler.length
      ? e.rappeler.map(function (d) {
          var tel = numero(d.contact_tel);
          return '<div class="v2-rdv-item"><b>' + esc(d.nom) + '</b>' +
            (d.contact_nom ? '<span class="sm">' + esc(d.contact_nom) + '</span>' : '') +
            (d.message ? '<p class="v2-rdv-msg">« ' + esc(d.message) + ' »</p>' : '') +
            (tel ? '<div class="v2-rdv-acts"><a class="v2-btn" href="tel:' + esc(tel) + '">Appeler ' +
              esc(d.contact_tel) + '</a></div>' : '') +
            '</div>';
        }).join('')
      : '<p class="v2-rdv-vide">Personne à rappeler.</p>';

    // ⚠️ Deux boutons seulement, et jamais de suppression : « Remercier »
    // ouvre un mail dans SA boîte, « J'y suis allé » écrit la date de visite
    // partagée — celle qui fera dire « pas vue depuis 7 mois » au prochain
    // mail. C'est le seul endroit où cette boucle se referme.
    var vus = e.passes.length
      ? e.passes.map(function (d) {
          var n = String(d.nom || '').replace(/'/g, '');
          return '<div class="v2-rdv-item"><b>' + esc(d.nom) + '</b>' +
            '<span class="sm">' + esc(libelle(d.date)) +
              (d.ville ? ' · ' + esc(d.ville) : '') +
              (d.contact_nom ? ' · ' + esc(d.contact_nom) : '') + '</span>' +
            '<div class="v2-rdv-acts">' +
              '<button class="v2-btn" type="button" onclick="V2.rdv.remercier(\'' + escArg(d.id) +
                '\')">Remercier</button>' +
              (d.cip
                ? '<button class="v2-btn v2-btn-ghost" type="button" onclick="V2.rdv.jySuisAlle(\'' +
                  escArg(String(d.cip)) + '\',\'' + escArg(n) + '\')">J’y suis allé</button>'
                : '') +
            '</div></div>';
        }).join('')
      : '<p class="v2-rdv-vide">Aucun rendez-vous ces quinze derniers jours.</p>';

    return '<div class="v2-sem-pan" id="v2-sem-pan" hidden role="dialog" aria-modal="true" ' +
        'aria-label="Le reste du module Rendez-vous">' +
      '<div class="tete"><b>Tout le reste</b>' +
        '<button type="button" onclick="V2.rdv.menu(false)" aria-label="Fermer">✕</button></div>' +
      '<div class="dedans">' +
        '<div class="v2-sem-g">' + portes + '</div>' +
        '<div class="v2-rdv-sec">Sans réponse</div>' + sansReponse +
        '<div class="v2-rdv-sec">À rappeler</div>' + aRappeler +
        '<div class="v2-rdv-sec">Vus récemment</div>' + vus +
        '<p class="v2-sem-essai">Ce module est <b>en essai</b>. Tout y est réel — les mails ' +
          'partent de ta boîte, les rendez-vous s’enregistrent — mais il bouge encore. ' +
          (V2.pages.remontees
            ? 'Si quelque chose cloche, <a href="#" onclick="V2.go(\'remontees\');return false">dis-le dans les remontées</a>.'
            : 'Si quelque chose cloche, dis-le à Will.') +
        '</p>' +
      '</div></div>';
  }

  // Même dessin qu'une entrée du hub, mais posée dans le panneau.
  function entreeP(route, titre, sous, ic, large) {
    return '<button class="v2-sem-e' + (large ? ' large' : '') +
      '" type="button" onclick="V2.rdv.menu(false);V2.go(\'' + route + '\')">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ic + '</svg>' +
      '<span><b>' + esc(titre) + '</b><small>' + esc(sous) + '</small></span></button>';
  }

  // ── Les gestes de l'écran ────────────────────────────────────────
  // Aucun ne recharge la page : ils repeignent la zone concernée.
  V2.rdv.jour = function (iso) {
    if (!ETAT) return;
    ETAT.choisi = iso;
    var z = document.getElementById('v2-sem-journee');
    if (z) z.innerHTML = journeeHtml(iso);
    var b = document.getElementById('v2-sem-bande');
    if (b) b.innerHTML = bandeHtml(ETAT.jours, ETAT.parJour, iso);
  };

  V2.rdv.menu = function (ouvrir) {
    var p = document.getElementById('v2-sem-pan');
    if (!p) return;
    p.hidden = !ouvrir;
    document.body.style.overflow = ouvrir ? 'hidden' : '';
  };

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
      // « Vue il y a N mois » sur chaque ligne a besoin de cette lecture. On
      // ne l'attend pas : l'écran s'affiche d'abord, la mention arrive après.
      if (V2.rdvVuCharger) V2.rdvVuCharger();
      // Ouvrir cet écran relance une lecture de l'agenda personnel, en fond.
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
          .order('envoye_le', { ascending: false }),
        // Les quinze derniers jours. Un rendez-vous tenu n'avait aucune suite
        // dans JARVIS : il restait « confirmé » à vie.
        c.from('rdv').select('*').eq('user_id', u).eq('statut', 'confirme')
          .lt('date', auj).gte('date', new Date(Date.now() - 15 * 864e5).toISOString().slice(0, 10))
          .order('date', { ascending: false })
      ]).then(function (r) {
        var venir = (r[0] && r[0].data) || [];
        var parJour = {};
        venir.forEach(function (d) {
          if (!parJour[d.date]) parJour[d.date] = [];
          parJour[d.date].push(d);
        });

        var jours = joursDeLaBande(auj, parJour);
        // Le jour ouvert par défaut : le prochain qui porte un rendez-vous.
        // À défaut, aujourd'hui — jamais un jour vide choisi au hasard.
        var choisi = venir.length ? venir[0].date : (jours.indexOf(auj) >= 0 ? auj : jours[0] || auj);

        ETAT = {
          parJour: parJour, jours: jours, choisi: choisi,
          rappeler: (r[1] && r[1].data) || [],
          attente: (r[2] && r[2].data) || [],
          passes: (r[3] && r[3].data) || []
        };

        var enAttente = ETAT.attente.length + ETAT.rappeler.length;
        var semaine = venir.filter(function (d) {
          return d.date <= jourPlus(auj, 7);
        }).length;

        root.innerHTML = top +
          '<div class="v2-wrap narrow">' +
            '<div class="v2-sem-cap"><h1>Rendez-vous</h1>' +
              '<p>' + esc(venir.length) + ' à venir · ' + esc(semaine) + ' cette semaine' +
              (enAttente ? ' · ' + esc(enAttente) + ' en attente' : '') + '</p></div>' +
            '<div id="v2-sem-bande" class="v2-sem-fond">' + bandeHtml(jours, parJour, choisi) + '</div>' +
            '<div id="v2-sem-journee">' + journeeHtml(choisi) + '</div>' +
            '<div class="v2-sem-fin"></div>' +
          '</div>' +
          '<div class="v2-sem-barre">' +
            (V2.pages.campagne
              ? '<button class="v2-btn v2-btn-primary" type="button" onclick="V2.go(\'campagne\')">' +
                'Inviter une officine</button>' : '') +
            (V2.pages.rdvajout
              ? '<button class="v2-btn" type="button" onclick="V2.go(\'rdvajout\')">Noter un RDV</button>' : '') +
            '<button class="v2-btn plus" type="button" onclick="V2.rdv.menu(true)" ' +
              'aria-label="Le reste du module">···' +
              (enAttente ? '<span class="pastille">' + esc(enAttente) + '</span>' : '') +
            '</button>' +
          '</div>' +
          panneauHtml();
      });
    }
  };
})();

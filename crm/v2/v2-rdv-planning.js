/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Mon agenda (pages.rdvplanning)

   Ce que le commercial n'avait jamais sous les yeux : SA journée telle que
   le pharmacien la voit. Trois matières sur la même barre —
     · les rendez-vous JARVIS déjà pris,
     · les heures occupées venues de son agenda personnel,
     · les demi-journées qu'il s'est bloquées à la main —
   et, en creux, ce qui reste réellement réservable.

   Depuis le 14/08/2026, l'écran NOMME aussi les officines : les titres de
   l'agenda sont lus à l'ouverture, comparés au fichier, et affichés. Mais
   ils ne sont écrits NULLE PART — la base n'a toujours aucune colonne pour
   les ranger, et c'est ce qui rend la promesse tenable. Un titre que le
   commercial n'a pas désigné comme une officine reste « occupé », point.

   Seule exception, consentie ligne par ligne : quand il corrige un
   rattachement, la correspondance (et elle seule) part dans
   `rdv_agenda_alias`, pour ne pas être redemandée à chaque ouverture.
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

  // Quatre semaines, pas quinze jours : le planning à venir est presque vide
  // (5 RDV pharmacie sur les 4 prochaines semaines, mesuré le 14/08/2026).
  // Un horizon court donnerait un écran sans usage.
  var JOURS_AFFICHES = 28;
  var H_DEB = 8 * 60;        // la barre commence à 8 h
  var H_FIN = 19 * 60;       // et finit à 19 h
  var LARGEUR = H_FIN - H_DEB;

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function hm2min(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function hhmm(s) { return String(s).slice(0, 5).replace(':', 'h'); }
  function isoPlus(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function libelle(iso) {
    var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return JOURS[d.getUTCDay()] + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1];
  }
  function dow(iso) {
    var p = String(iso).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
  }
  function duree(min) {
    if (min <= 0) return '';
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + ' h' + (m ? ' ' + m : '') : m + ' min');
  }
  function numero(s) { return String(s || '').replace(/[^0-9+]/g, ''); }
  function escArg(s) { return esc(String(s == null ? '' : s).replace(/[\\'"<>&]/g, '')); }

  // Les officines reconnues dans l'agenda. Rempli à chaque rendu, jamais
  // persisté : les titres ne sont pas à nous.
  V2.planningOfficines = [];
  V2.planningDerniereVisite = {};

  function appelerAgenda(corps) {
    var c = sb();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (s) {
      var acces = s && s.data && s.data.session && s.data.session.access_token;
      if (!acces) return null;
      return fetch(c.supabaseUrl + '/functions/v1/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + acces },
        body: JSON.stringify(corps)
      }).then(function (r) { return r.json(); });
    }).catch(function () { return null; });
  }

  // Index construits une fois par rendu : 691 + 19 667 officines, c'est trop
  // pour les reconstruire à chaque événement.
  function indexOfficines() {
    var R = window.V2RECO;
    if (!R) return null;
    var porte = (V2.pharmacies || []).map(function (p) {
      return { id: p.id, name: p.name, ville: p.ville || '' };
    });
    var idsPorte = {}, k;
    for (k = 0; k < porte.length; k++) idsPorte[String(porte[k].id)] = 1;
    var nat = [], D = window.PHARMA_FR;
    if (D && D.p) {
      // [lat, lng, uga, grp, seg, comm, nom, ville, cp, tel, titulaire, email, ca, id]
      for (var i = 0; i < D.p.length; i++) {
        var l = D.p[i];
        if (l[6] && l[13] != null) nat.push({ id: String(l[13]), name: l[6], ville: l[7] || '' });
      }
    }
    return { porte: R.indexer(porte), nat: R.indexer(nat), idsPorte: idsPorte };
  }

  function ensureCss() {
    if (document.getElementById('v2-agp-css')) return;
    var s = document.createElement('style'); s.id = 'v2-agp-css';
    s.textContent = [
      '.agp-hero{margin:8px 0 14px}',
      '.agp-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.agp-hero p{color:var(--muted);font-size:14px;max-width:56ch;margin:0;line-height:1.5}',
      '.agp-etat{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;font-size:13.5px;',
      '  background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:11px 14px;margin:0 0 16px}',
      '.agp-pastille{display:inline-block;width:9px;height:9px;border-radius:50%;flex:0 0 auto}',
      '.agp-ok{background:#1E9E6A}.agp-ko{background:#E0556E}.agp-off{background:#8B93A1}',
      '.agp-etat .v2-btn{min-height:44px;margin-left:auto}',
      /* légende */
      '.agp-leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;color:var(--muted);margin:0 0 16px}',
      '.agp-leg span{display:flex;align-items:center;gap:6px}',
      '.agp-pot{width:13px;height:13px;border-radius:4px;flex:0 0 auto}',
      '.agp-p-rdv{background:#0050E6}.agp-p-occ{background:#8B93A1}',
      '.agp-p-blo{background:#C7791A}.agp-p-lib{background:#DCE7FA;border:1px solid #B9CDF2}',
      /* une journée */
      '.agp-jour{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);',
      '  padding:13px 14px;margin-bottom:9px}',
      '.agp-jour.agp-off-jour{background:var(--card-2);opacity:.72}',
      '.agp-jt{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin:0 0 9px}',
      // `capitalize` mettrait une majuscule à CHAQUE mot — « Jeudi 13 Août ».
      // On ne relève que la première lettre.
      '.agp-jt b{font-size:15px;font-weight:800;display:inline-block}',
      '.agp-jt b::first-letter{text-transform:uppercase}',
      '.agp-jt .agp-resume{color:var(--muted);font-size:12.5px;margin-left:auto;text-align:right}',
      '.agp-auj{background:#0050E6;color:#fff;font-size:11px;font-weight:800;border-radius:6px;padding:2px 7px;',
      '  text-transform:uppercase;letter-spacing:.04em}',
      /* la barre de la journée */
      '.agp-bar{position:relative;height:26px;border-radius:8px;background:#DCE7FA;border:1px solid #B9CDF2;overflow:hidden}',
      '.agp-bar.agp-vide{background:var(--card-2);border-color:var(--line)}',
      '.agp-seg{position:absolute;top:0;bottom:0}',
      '.agp-s-rdv{background:#0050E6}.agp-s-occ{background:#8B93A1}.agp-s-blo{background:#C7791A}',
      '.agp-s-hors{background:var(--card-2)}',
      '.agp-ech{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);',
      '  margin:4px 2px 0;font-variant-numeric:tabular-nums}',
      /* le détail sous la barre */
      '.agp-l{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:9px 0 0;font-size:14px}',
      '.agp-l + .agp-l{border-top:1px solid var(--line-2,#EEF1F6);margin-top:9px}',
      '.agp-h{font-weight:800;font-variant-numeric:tabular-nums;min-width:56px}',
      '.agp-n{font-weight:600}',
      '.agp-sm{color:var(--muted);font-size:13px}',
      '.agp-a{width:100%;display:flex;flex-wrap:wrap;gap:10px;font-size:13px}',
      '.agp-a a{color:var(--ip-blue);font-weight:700;text-decoration:none;min-height:44px;display:flex;align-items:center}',
      '.agp-rien{color:var(--muted);font-size:13.5px;margin:9px 0 0}',
      /* une officine reconnue dans l'agenda, et son étiquette */
      '.agp-l.agp-doute{border-left:3px solid #C7791A;padding-left:9px}',
      '.agp-eti{font-size:11px;font-weight:800;border-radius:6px;padding:2px 7px;',
      '  text-transform:uppercase;letter-spacing:.04em}',
      '.agp-cli{background:#DCE7FA;color:#0050E6}',
      '.agp-pro{background:#F3EAD8;color:#8A5A12}',
      '.agp-dte{background:#FBEFD9;color:#8A5A12;border:1px solid #E4C489}',
      '@media (max-width:430px){.agp-jt .agp-resume{margin-left:0;width:100%;text-align:left}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Fusion d'intervalles : deux réunions qui se chevauchent ne comptent
  // qu'une fois dans le temps libre. Sans ça, une journée pouvait afficher
  // « -45 min réservables ».
  function fusionner(list) {
    var t = list.slice().sort(function (a, b) { return a.deb - b.deb; }), out = [];
    t.forEach(function (x) {
      var d = out[out.length - 1];
      if (d && x.deb <= d.fin) { d.fin = Math.max(d.fin, x.fin); return; }
      out.push({ deb: x.deb, fin: x.fin });
    });
    return out;
  }

  function pct(v) { return Math.round(((v - H_DEB) / LARGEUR) * 10000) / 100; }

  function segment(cls, deb, fin) {
    var d = Math.max(H_DEB, Math.min(H_FIN, deb));
    var f = Math.max(H_DEB, Math.min(H_FIN, fin));
    if (f <= d) return '';
    return '<span class="agp-seg ' + cls + '" style="left:' + pct(d) + '%;width:' + (pct(f) - pct(d)) + '%"></span>';
  }

  V2.rdvPlanning = {
    // Relit l'agenda puis redessine. Le bouton existe parce qu'un commercial
    // qui vient de bloquer son après-midi veut le voir tout de suite, sans
    // attendre le prochain passage du robot.
    actualiser: function () {
      var b = document.getElementById('agp-maj');
      if (b) { b.disabled = true; b.textContent = 'Lecture…'; }
      var suite = function () { V2.go('rdvplanning'); };
      if (V2.rdvAgenda) V2.rdvAgenda.relever().then(suite, suite);
      else suite();
    },

    ics: function (id) { if (V2.rdv && V2.rdv.ics) V2.rdv.ics(id); },

    // L'annuaire national pèse 2,8 Mo : on ne le télécharge PAS tout seul,
    // l'app s'y refuse partout ailleurs pour ne pas plomber un téléphone en
    // tournée. Mais sans lui, seules les officines déjà clientes sont
    // nommées — et la moitié des visites sont des prospects. D'où ce bouton :
    // le coût est annoncé, le choix est au commercial.
    annuaire: function () {
      var b = document.getElementById('agp-annu');
      if (b) { b.disabled = true; b.textContent = 'Téléchargement…'; }
      if (!V2.ensurePharmaFr) { V2.go('rdvplanning'); return; }
      V2.ensurePharmaFr(function () { V2.go('rdvplanning'); });
    },

    // « Ce n'est pas la bonne » : on ouvre la recherche d'officine déjà
    // écrite pour l'ajout manuel, et on retient le choix au retour.
    // L'agenda Google n'est jamais modifié — on corrige côté JARVIS.
    corriger: function (cle) {
      V2.rdvPlanningCleEnCours = cle;
      var suite = function () { V2.go('rdvajout'); };
      if (V2.rdvAlias) V2.rdvAlias.retirer(cle).then(suite, suite);
      else suite();
    },

    // « C'est bien elle » sur une ligne douteuse : le rattachement devient
    // définitif, et la ligne ne redemandera plus rien.
    confirmer: function (cle, cip) {
      if (!V2.rdvAlias) return;
      V2.rdvAlias.poser(cle, cip).then(function () { V2.go('rdvplanning'); });
    }
  };

  function etatAgenda(a) {
    if (!a || !a.hote) {
      return '<span class="agp-pastille agp-off"></span>' +
        '<span>Aucun agenda personnel connecté — seuls tes rendez-vous JARVIS apparaissent.</span>' +
        '<button class="v2-btn" onclick="V2.go(\'rdvdispo\')">Connecter</button>';
    }
    var h = a.dernier_ok
      ? Math.floor((Date.now() - new Date(a.dernier_ok).getTime()) / 60000) : null;
    // On alarme sur la FRAÎCHEUR, pas sur le dernier appel : Google rationne
    // parfois la lecture de son flux, et des plages relevées il y a un quart
    // d'heure restent bonnes. Au-delà de deux heures, en revanche, il faut le
    // dire — les créneaux proposés ne valent plus rien.
    if (h == null || h > 120) {
      return '<span class="agp-pastille agp-ko"></span>' +
        '<span><b>' + esc(a.hote) + '</b> — pas relu depuis ' +
        (h == null ? 'la connexion' : Math.floor(h / 60) + ' h') +
        '. Tes heures occupées peuvent manquer.</span>' +
        '<button class="v2-btn" onclick="V2.go(\'rdvdispo\')">Vérifier</button>';
    }
    var quand = h == null ? 'jamais lu'
      : (h < 2 ? 'à l’instant' : (h < 60 ? 'il y a ' + h + ' min'
        : (h < 1440 ? 'il y a ' + Math.floor(h / 60) + ' h' : 'il y a ' + Math.floor(h / 1440) + ' j')));
    return '<span class="agp-pastille agp-ok"></span>' +
      '<span><b>' + esc(a.hote) + '</b> — lu ' + esc(quand) +
      '. Relecture automatique toutes les 15 minutes.</span>' +
      '<button class="v2-btn" id="agp-maj" onclick="V2.rdvPlanning.actualiser()">Actualiser</button>';
  }

  function rendreJour(iso, dispo, blocages, rdvs, occupes, auj, reconnus) {
    var plages = (dispo.jours && dispo.jours[String(dow(iso))]) || null;
    var bl = blocages.filter(function (b) { return b.date === iso; });
    var mesRdv = rdvs.filter(function (r) { return r.date === iso; });
    var mesOcc = occupes.filter(function (o) { return o.date === iso; });

    // Journée non travaillée : une ligne en retrait, et c'est tout. La cacher
    // ferait croire à un trou dans les dates ; la détailler serait du bruit —
    // rien n'y est réservable, que l'agenda personnel soit plein ou vide.
    // Seul un rendez-vous JARVIS déjà posé mérite d'être montré : celui-là,
    // il faut s'y rendre.
    if ((!plages || !plages.length) && !mesRdv.length) {
      return '<div class="agp-jour agp-off-jour"><div class="agp-jt"><b>' + esc(libelle(iso)) + '</b>' +
        (iso === auj ? ' <span class="agp-auj">aujourd’hui</span>' : '') +
        '<span class="agp-resume">tu ne travailles pas</span></div></div>';
    }
    if (!plages || !plages.length) plages = [['08:00', '19:00']];

    var travail = plages.map(function (p) { return { deb: hm2min(p[0]), fin: hm2min(p[1]) }; });
    var pris = [], lignes = [];

    // Demi-journées bloquées à la main.
    bl.forEach(function (b) {
      var d = b.moment === 'apres_midi' ? 12 * 60 : H_DEB;
      var f = b.moment === 'matin' ? 12 * 60 : H_FIN;
      pris.push({ deb: d, fin: f, cls: 'agp-s-blo' });
      lignes.push({ deb: d, html: '<div class="agp-l"><span class="agp-h">' +
        (b.moment === 'matin' ? 'matin' : b.moment === 'apres_midi' ? 'a-m' : 'jour') +
        '</span><span class="agp-n">Tu t’es déclaré indisponible</span></div>' });
    });

    // Rendez-vous JARVIS.
    mesRdv.forEach(function (r) {
      var d = hm2min(r.heure), f = d + (r.duree_min || dispo.duree_min || 45);
      pris.push({ deb: d, fin: f, cls: 'agp-s-rdv' });
      var tel = numero(r.contact_tel);
      lignes.push({ deb: d, html: '<div class="agp-l">' +
        '<span class="agp-h">' + esc(hhmm(r.heure)) + '</span>' +
        '<span class="agp-n">' + esc(r.nom || 'Rendez-vous') + '</span>' +
        (r.ville ? '<span class="agp-sm">· ' + esc(r.ville) + '</span>' : '') +
        '<span class="agp-a">' +
          (r.contact_nom ? '<span class="agp-sm" style="align-self:center">' + esc(r.contact_nom) + '</span>' : '') +
          (tel ? '<a href="tel:' + esc(tel) + '">' + esc(r.contact_tel) + '</a>' : '') +
          '<a href="#" onclick="V2.rdvPlanning.ics(\'' + escArg(r.id) + '\');return false">ajouter à mon agenda</a>' +
        '</span></div>' });
    });

    // Heures venues de l'agenda personnel. Quand le titre désigne une
    // officine, on la nomme ; sinon on s'en tient à « occupé », qui est la
    // vérité et pas une pudeur — rien de ce titre n'est connu de la base.
    var recoJour = (reconnus || []).filter(function (x) { return x.date === iso; });
    mesOcc.forEach(function (o) {
      var d = o.jour_entier ? H_DEB : hm2min(o.debut);
      var f = o.jour_entier ? H_FIN : hm2min(o.fin);
      // Les plages et les titres viennent de deux lectures du même agenda :
      // on les apparie sur l'heure de début.
      var reco = null;
      for (var i = 0; i < recoJour.length; i++) {
        if (!!recoJour[i].jour_entier === !!o.jour_entier &&
            (o.jour_entier || recoJour[i].debut === String(o.debut).slice(0, 5))) {
          reco = recoJour[i]; break;
        }
      }
      pris.push({ deb: d, fin: f, cls: reco ? 'agp-s-rdv' : 'agp-s-occ' });
      if (!reco) {
        lignes.push({ deb: d, html: '<div class="agp-l">' +
          '<span class="agp-h">' + (o.jour_entier ? 'jour' : esc(hhmm(o.debut))) + '</span>' +
          '<span class="agp-sm">occupé' + (o.jour_entier ? ' toute la journée' :
            ' jusqu’à ' + esc(hhmm(o.fin))) + ' — ton agenda personnel</span></div>' });
        return;
      }
      var douteux = reco.etat === 'confirmer';
      lignes.push({ deb: d, html: '<div class="agp-l' + (douteux ? ' agp-doute' : '') + '">' +
        '<span class="agp-h">' + (o.jour_entier ? 'jour' : esc(hhmm(o.debut))) + '</span>' +
        '<span class="agp-n">' + esc(reco.nom) + '</span>' +
        (reco.ville ? '<span class="agp-sm">· ' + esc(reco.ville) + '</span>' : '') +
        '<span class="agp-eti ' + (reco.client ? 'agp-cli' : 'agp-pro') + '">' +
          (reco.client ? 'client' : 'prospect') + '</span>' +
        // Le liseré orange ne se lit pas tout seul : on écrit ce qui se passe.
        (douteux ? '<span class="agp-eti agp-dte">à confirmer</span>' : '') +
        '<span class="agp-a">' +
          (douteux ? '<a href="#" onclick="V2.rdvPlanning.confirmer(\'' + escArg(reco.cle) +
            '\',\'' + escArg(reco.cip) + '\');return false">c’est bien elle</a>' : '') +
          '<a href="#" onclick="V2.rdvPlanning.corriger(\'' + escArg(reco.cle) +
            '\');return false">ce n’est pas la bonne</a>' +
        '</span></div>' });
    });

    // Temps réellement réservable = plages travaillées moins tout le reste.
    var occupeFusion = fusionner(pris.map(function (p) { return { deb: p.deb, fin: p.fin }; }));
    var libre = 0;
    travail.forEach(function (t) {
      var curseur = t.deb;
      occupeFusion.forEach(function (o) {
        if (o.fin <= t.deb || o.deb >= t.fin) return;
        if (o.deb > curseur) libre += o.deb - curseur;
        curseur = Math.max(curseur, o.fin);
      });
      if (curseur < t.fin) libre += t.fin - curseur;
    });

    // La barre : le fond est « libre », on peint par-dessus les hors-plages
    // puis ce qui est pris. L'ordre compte — un RDV posé sur une heure déjà
    // occupée doit rester visible.
    var horsPlage = '', bord = H_DEB;
    travail.sort(function (a, b) { return a.deb - b.deb; }).forEach(function (t) {
      if (t.deb > bord) horsPlage += segment('agp-s-hors', bord, t.deb);
      bord = Math.max(bord, t.fin);
    });
    if (bord < H_FIN) horsPlage += segment('agp-s-hors', bord, H_FIN);

    var peinture = horsPlage +
      pris.filter(function (p) { return p.cls === 'agp-s-occ'; })
          .map(function (p) { return segment(p.cls, p.deb, p.fin); }).join('') +
      pris.filter(function (p) { return p.cls === 'agp-s-blo'; })
          .map(function (p) { return segment(p.cls, p.deb, p.fin); }).join('') +
      pris.filter(function (p) { return p.cls === 'agp-s-rdv'; })
          .map(function (p) { return segment(p.cls, p.deb, p.fin); }).join('');

    var resume = mesRdv.length
      ? mesRdv.length + (mesRdv.length > 1 ? ' rendez-vous' : ' rendez-vous') +
        (libre > 0 ? ' · ' + duree(libre) + ' encore libre' : ' · journée pleine')
      : (libre > 0 ? duree(libre) + ' réservable' : 'plus rien de réservable');

    lignes.sort(function (a, b) { return a.deb - b.deb; });

    return '<div class="agp-jour"><div class="agp-jt"><b>' + esc(libelle(iso)) + '</b>' +
      (iso === auj ? ' <span class="agp-auj">aujourd’hui</span>' : '') +
      '<span class="agp-resume">' + esc(resume) + '</span></div>' +
      '<div class="agp-bar' + (libre > 0 ? '' : ' agp-vide') + '">' + peinture + '</div>' +
      '<div class="agp-ech"><span>8h</span><span>12h</span><span>15h</span><span>19h</span></div>' +
      (lignes.length ? lignes.map(function (l) { return l.html; }).join('')
                     : '<p class="agp-rien">Journée entièrement libre.</p>') +
      '</div>';
  }

  V2.pages.rdvplanning = {
    render: function (root) {
      ensureCss();
      // Revenir ici annule une correction commencée puis abandonnée : sans ça,
      // le prochain « Noter un rendez-vous » deviendrait un rattachement.
      V2.rdvPlanningCleEnCours = null;
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      root.innerHTML = top + '<div class="v2-wrap narrow"><div class="agp-hero">' +
        '<h1>Mon agenda</h1><p>Lecture de ton agenda…</p></div></div>';

      var c = sb(), u = uid();
      if (!c || !u) {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="agp-hero">' +
          '<h1>Mon agenda</h1><p>Connecte-toi pour voir ton planning.</p></div></div>';
        return;
      }

      var auj = isoPlus(0), fin = isoPlus(JOURS_AFFICHES - 1);

      // On relit l'agenda AVANT de dessiner : ouvrir cet écran, c'est vouloir
      // savoir où on en est maintenant. Le serveur ne relit pas deux fois en
      // moins de deux minutes, donc l'aller-retour reste bon marché.
      var pret = (V2.rdvAgenda ? V2.rdvAgenda.relever() : Promise.resolve(null));

      pret.then(function () {
        return Promise.all([
          V2.rdvDispo.charger(),
          c.from('rdv').select('*').eq('user_id', u).eq('statut', 'confirme')
            .gte('date', auj).lte('date', fin).order('date').order('heure'),
          c.from('rdv_occupe').select('date,debut,fin,jour_entier').eq('user_id', u)
            .gte('date', auj).lte('date', fin).order('date'),
          (V2.rdvAgenda ? V2.rdvAgenda.charger() : Promise.resolve(null)),
          // Les titres : ils arrivent dans cette réponse et n'y survivent pas.
          appelerAgenda({ action: 'mes_evenements' }),
          (V2.rdvAlias ? V2.rdvAlias.charger() : Promise.resolve({}))
        ]);
      }).then(function (r) {
        var st = r[0], dispo = st.dispo, blocages = st.blocages || [];
        var rdvs = (r[1] && r[1].data) || [];
        var occupes = (r[2] && r[2].data) || [];
        var ag = r[3];

        // ── Reconnaître les officines. Tout se passe ici, dans le navigateur :
        // rien de ce qui suit n'est renvoyé au serveur.
        var brut = (r[4] && r[4].ok && r[4].evenements) || [];
        var alias = r[5] || {};
        var idx = indexOfficines();
        var R = window.V2RECO;
        var reconnus = [];          // ce qui tombe dans la fenêtre affichée
        var derniereVisite = {};    // cip -> date la plus récente dans le passé
        if (idx && R) {
          for (var b = 0; b < brut.length; b++) {
            var ev = brut[b];
            var m = R.apparier(ev.titre, idx.porte, idx.nat, alias);
            if (!m.officine) continue;
            var cipEv = String(m.officine.id);
            if (ev.date < auj) {
              if (!derniereVisite[cipEv] || ev.date > derniereVisite[cipEv]) {
                derniereVisite[cipEv] = ev.date;
              }
            } else if (ev.date <= fin) {
              reconnus.push({
                date: ev.date, debut: ev.debut, fin: ev.fin, jour_entier: ev.jour_entier,
                cle: R.cleAlias(ev.titre), cip: cipEv,
                nom: m.officine.name, ville: m.officine.ville || '',
                etat: m.etat, source: m.source, client: !!idx.idsPorte[cipEv]
              });
            }
          }
        }
        V2.planningOfficines = reconnus;
        V2.planningDerniereVisite = derniereVisite;

        // Combien de créneaux occupés restent sans nom ? C'est ce qui décide
        // de proposer, ou non, le téléchargement de l'annuaire national.
        var nommes = {}, sansNom = 0;
        for (var q = 0; q < reconnus.length; q++) nommes[reconnus[q].date + ' ' + reconnus[q].debut] = 1;
        for (var w = 0; w < occupes.length; w++) {
          if (occupes[w].date < auj || occupes[w].date > fin) continue;
          if (!nommes[occupes[w].date + ' ' + String(occupes[w].debut).slice(0, 5)]) sansNom++;
        }
        var offreAnnuaire = (!window.PHARMA_FR && sansNom > 0)
          ? '<div class="agp-etat" style="margin-top:-6px">' +
              '<span class="agp-pastille agp-off"></span>' +
              '<span>' + sansNom + (sansNom > 1 ? ' créneaux occupés ne sont pas identifiés' :
                ' créneau occupé n’est pas identifié') +
              '. Tes officines <b>prospects</b> ne sont pas dans ton fichier clients.</span>' +
              '<button class="v2-btn" id="agp-annu" onclick="V2.rdvPlanning.annuaire()">' +
              'Chercher dans l’annuaire (2,8 Mo)</button></div>'
          : '';

        var jours = '';
        for (var i = 0; i < JOURS_AFFICHES; i++) {
          jours += rendreJour(isoPlus(i), dispo, blocages, rdvs, occupes, auj, reconnus);
        }

        root.innerHTML = top + '<div class="v2-wrap narrow">' +
          '<div class="agp-hero"><h1>Mon agenda</h1>' +
            '<p>Tes quatre prochaines semaines, exactement comme le pharmacien les voit ' +
            'quand il ouvre ton lien. Ce qui est en couleur ne peut plus être réservé.</p></div>' +

          '<div class="agp-etat">' + etatAgenda(ag) + '</div>' +

          offreAnnuaire +

          '<div class="agp-leg">' +
            '<span><i class="agp-pot agp-p-rdv"></i>rendez-vous pharmacie</span>' +
            '<span><i class="agp-pot agp-p-occ"></i>autre occupation</span>' +
            '<span><i class="agp-pot agp-p-blo"></i>tu t’es bloqué</span>' +
            '<span><i class="agp-pot agp-p-lib"></i>réservable</span>' +
          '</div>' +

          jours +

          '<div style="display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 0">' +
            (V2.pages.rdvajout
              ? '<button class="v2-btn v2-btn-primary" style="min-height:48px" ' +
                'onclick="V2.go(\'rdvajout\')">' + ICO('plus', 15) + ' Noter un rendez-vous</button>' : '') +
            '<button class="v2-btn" style="min-height:48px" onclick="V2.go(\'rdvdispo\')">' +
              ICO('cal', 15) + ' Mes disponibilités</button>' +
            '<button class="v2-btn" style="min-height:48px" onclick="V2.go(\'rdv\')">' +
              'Mes rendez-vous</button>' +
          '</div></div>';
      }).catch(function () {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="agp-hero">' +
          '<h1>Mon agenda</h1><p>Ton planning n’a pas pu être chargé. Réessaie dans un instant.</p>' +
          '</div></div>';
      });
    }
  };
})();

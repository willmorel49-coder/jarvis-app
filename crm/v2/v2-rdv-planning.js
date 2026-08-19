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
  // ⚠️ L'aperçu du haut va BEAUCOUP plus loin que le planning détaillé :
  // « l'idée c'est de pouvoir remplir les prochaines semaines et aussi mois »
  // (Will, 19/08). Treize semaines — un trimestre — parce que c'est l'horizon
  // d'un vrai agenda commercial : on cale une rentrée dès juin. Le détail
  // heure par heure reste à quatre semaines : trois mois de barres, c'est
  // trente mille pixels que personne ne fait défiler.
  var HORIZON_APERCU = 91;
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
  // n jours après (ou avant) une date donnée. En UTC, comme `dow` : passer par
  // l'heure locale ferait sauter un jour aux changements d'heure, et on
  // écrirait alors le secteur sur le mauvais lundi.
  function isoDe(iso, n) {
    var p = String(iso).split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
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

  // ── Qui reste-t-il à contacter ? Tout le portefeuille, moins :
  //   · celles qui ont déjà un RDV à venir (JARVIS ou reconnu dans l'agenda),
  //   · celles qui ont demandé à ne plus être sollicitées,
  //   · celles vues il y a moins de REPOS_JOURS — le passé de l'agenda est la
  //     SEULE source de cette information, elle n'existe nulle part ailleurs.
  var REPOS_JOURS = 60;
  var LOT_MAX = 25;          // ce qu'on pré-coche dans une campagne

  // ⚠️ Le CA se calcule en UN passage sur les ventes, pas une fois par
  // officine : V2.rdvCA balaie les 437 000 lignes à chaque appel, et 691
  // appels figeraient l'écran plusieurs secondes sur un téléphone.
  function caParOfficine() {
    var m = {}, s = V2.sales || [];
    for (var i = 0; i < s.length; i++) {
      var k = String(s[i].pharmacyId);
      m[k] = (m[k] || 0) + (s[i].mntNetHt || 0);
    }
    return m;
  }

  function aContacter(rdvs, reconnus, opposes) {
    var pris = {}, i;
    for (i = 0; i < rdvs.length; i++) if (rdvs[i].cip) pris[String(rdvs[i].cip)] = 1;
    for (i = 0; i < reconnus.length; i++) pris[String(reconnus[i].cip)] = 1;
    var nonSollicite = {};
    for (i = 0; i < (opposes || []).length; i++) nonSollicite[String(opposes[i])] = 1;

    // ⚠️ Ses officines à LUI. Le fichier porte celles de toute l'équipe :
    // sans ce filtre, l'écran proposait d'écrire aux clients d'une collègue.
    var moi = (V2.user && V2.user.commercial) ? String(V2.user.commercial) : '';
    if (!moi || !window.V2CIBLE) return [];
    var siennes = (V2.pharmacies || []).filter(function (p) {
      return (p.comms || []).indexOf(moi) >= 0;
    });
    // CLIENTS *ET* PROSPECTS. Mesuré le 14/08/2026 : sur 95 rendez-vous
    // reconnus dans l'agenda, 46 sont des officines absentes du fichier
    // clients. Une liste limitée aux clientes raterait la moitié du travail.
    // Le recensement est celui de l'écran Campagne — un seul endroit décide
    // qui appartient à qui, et le CIP dédoublonne les deux sources.
    var D = window.PHARMA_FR || null;
    // Son secteur = les départements où il a déjà des clientes. C'est ce qui
    // lui rend les prospects : 16 850 des 17 367 prospects de la base
    // n'appartiennent à personne, le filtre par commercial les écartait tous.
    var depts = {}, dl = [];
    for (i = 0; i < siennes.length; i++) {
      var dp = String(siennes[i].cp || '').slice(0, 2);
      if (dp.length === 2 && !depts[dp]) { depts[dp] = 1; dl.push(dp); }
    }
    var pool = window.V2CIBLE.recenser({
      pharmacies: siennes,
      national: D ? { p: D.p, seg: D.seg, grp: D.grp, comm: D.comm } : null,
      commercial: moi,
      departements: dl,
      info: function (cip) { return V2.rdvInfo ? V2.rdvInfo(cip) : {}; }
    });

    var limite = isoPlus(-REPOS_JOURS);   // setDate accepte les jours négatifs
    var vues = V2.planningDerniereVisite || {};
    var ca = caParOfficine();
    var out = [];
    for (i = 0; i < pool.length; i++) {
      var o = pool[i], cip = String(o.cip);
      if (pris[cip] || nonSollicite[cip]) continue;
      var vue = vues[cip] || null;
      if (vue && vue > limite) continue;
      out.push({ cip: cip, nom: o.nom || '', ville: o.ville || '',
                 type: o.type || 'client', email: o.email || '',
                 ca: ca[cip] || 0, vue: vue });
    }
    // Les clientes par chiffre d'affaires ; les prospects joignables d'abord.
    out.sort(function (a, b) {
      if (a.type !== b.type) return a.type === 'client' ? -1 : 1;
      if (a.type === 'client') return b.ca - a.ca;
      if (!!a.email !== !!b.email) return a.email ? -1 : 1;
      return a.nom.localeCompare(b.nom);
    });
    return out;
  }

  // Le lot proposé ALTERNE client et prospect. Trier par chiffre d'affaires
  // et couper à 25 ne donnerait que des clientes, alors que la moitié des
  // visites réelles sont de la prospection : le lot doit ressembler au métier.
  function lotMixte(liste, taille) {
    var cl = [], pr = [], i;
    for (i = 0; i < liste.length; i++) {
      (liste[i].type === 'prospect' ? pr : cl).push(liste[i]);
    }
    var lot = [], a = 0, b = 0;
    while (lot.length < taille && (a < cl.length || b < pr.length)) {
      if (a < cl.length) lot.push(cl[a++]);
      if (lot.length < taille && b < pr.length) lot.push(pr[b++]);
    }
    return lot;
  }

  function depuis(iso) {
    if (!iso) return 'jamais vue dans ton agenda';
    var j = Math.round((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
    if (j < 31) return 'vue il y a ' + j + ' j';
    if (j < 365) return 'vue il y a ' + Math.round(j / 30) + ' mois';
    return 'vue il y a plus d’un an';
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
      /* Le secteur du jour */
      '.agp-sect{margin:0 0 10px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      // (la règle « .agp-sect > .agp-sect-p » vivait ici. Le panneau a quitté le
      //  bloc de la journée pour l'agenda du haut : elle ne visait plus rien.)
      '.agp-sect-b{min-height:44px;padding:0 13px;border-radius:9px;border:1px dashed var(--line);',
      '  background:transparent;color:var(--muted);font:inherit;font-size:12.5px;cursor:pointer}',
      '.agp-sect-b.on{border-style:solid;border-color:var(--ip-blue);color:var(--ip-blue);font-weight:700}',
      '.agp-sect-p{background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);',
      '  padding:12px;margin-top:9px}',
      '.agp-sect-c{display:flex;flex-wrap:wrap;gap:7px}',
      '.agp-sect-c button{min-width:46px;min-height:44px;border-radius:9px;border:1px solid var(--line);',
      '  background:var(--card);color:var(--fg);font:inherit;font-size:14px;font-weight:600;cursor:pointer}',
      '.agp-sect-c button.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.agp-sect-ou{display:inline-block;font-size:12.5px;color:var(--muted);margin-right:10px;',
      '  line-height:44px;vertical-align:middle}',
      '.agp-sect-ou b{color:var(--fg)}',
      '.agp-sect-sug{min-height:44px;padding:0 12px;border-radius:9px;',
      '  border:1px solid var(--ip-blue);background:transparent;color:var(--ip-blue);',
      '  font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}',
      /* Vue d'ensemble des quatre semaines */
      '.agp-ap{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);',
      '  padding:13px 14px;margin:0 0 16px}',
      '.agp-ap-t{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;',
      '  color:var(--muted);margin:0 0 10px}',
      '.agp-ap-l{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:6px}',
      '.agp-ap-c{min-height:46px;border-radius:9px;border:1px solid var(--line);background:var(--card-2);',
      '  color:var(--muted);font:inherit;cursor:pointer;display:flex;flex-direction:column;',
      '  align-items:center;justify-content:center;gap:1px;padding:4px 2px}',
      '.agp-ap-c.agp-ap-vide{border-style:dashed;opacity:.35;cursor:default}',
      '.agp-ap-j{font-size:10.5px;letter-spacing:.02em}',
      '.agp-ap-d{font-size:13px;font-weight:700;line-height:1.15;text-align:center;word-break:break-all}',
      /* Il Y SERA : plein, c est un fait. SOUHAITÉ : encadré, c est une intention. */
      '.agp-ap-c.agp-ap-sur{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.agp-ap-c.agp-ap-sur .agp-ap-j{opacity:.8}',
      '.agp-ap-c.agp-ap-voulu{border-color:var(--ip-blue);border-style:dashed;color:var(--ip-blue)}',
      '.agp-ap-c.agp-ap-auj{outline:2px solid var(--fg);outline-offset:1px}',
      '.agp-ap-c.agp-ap-ferme{opacity:.45;border-style:dashed}',
      '.agp-ap-c.agp-ap-ouv{outline:2px solid var(--ip-blue);outline-offset:1px}',
      '.agp-ap-m{font-size:12.5px;font-weight:700;color:var(--fg);margin:14px 0 7px;',
      '  text-transform:capitalize}',
      '.agp-ap-l:first-of-type{margin-top:0}',
      '.agp-sect-a{display:flex;flex-wrap:wrap;gap:8px}',
      '.agp-sect-a button{min-height:44px;padding:0 12px;border-radius:9px;',
      '  border:1px solid var(--ip-blue);background:transparent;color:var(--ip-blue);',
      '  font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;text-align:left}',
      '.agp-ap-leg{font-size:11.5px;color:var(--muted);margin:8px 0 0;line-height:1.5}',
      '.agp-ap-leg b{background:var(--ip-blue);color:#fff;padding:1px 5px;border-radius:4px}',
      '.agp-ap-voulu-l{border:1px dashed var(--ip-blue);color:var(--ip-blue);padding:0 5px;border-radius:4px}',
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
      '.agp-vide-jour{margin:11px 0 0;padding:11px 0 0;border-top:1px solid var(--line-2,#EEF1F6)}',
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
    // Bascule vers la Campagne existante avec la liste deja cochee. On ne
    // reecrit pas l'envoi : JARVIS prepare les mails, le commercial relit et
    // envoie depuis SA boite, et coche « envoye » lui-meme.
    contacter: function () {
      V2.campagnePreselection = lotMixte(V2.planningAContacter || [], LOT_MAX)
        .map(function (x) { return x.cip; });
      V2.go('campagne');
    },

    // Ouvre ou referme le choix des départements d'une journée. Une seule
    // ouverte à la fois : quatre semaines à l'écran, ça ferait vingt panneaux.
    secteur: function (iso) {
      var ouvre = V2._agpSecteurOuvert !== iso;
      V2._agpSecteurOuvert = ouvre ? iso : null;
      V2.go('rdvplanning');
      // Le panneau vit tout en haut : depuis une journée du planning, il
      // s'ouvrirait hors de l'écran. On y amène l'œil.
      if (ouvre) {
        setTimeout(function () {
          var e = document.getElementById('agp-panneau');
          if (e && e.scrollIntoView) e.scrollIntoView({ block: 'center' });
        }, 60);
      }
    },

    // ── Remplir un trimestre sans soixante-cinq clics ──────────────
    // Recopie le réglage de CE jour sur toute sa semaine, ou sur tous les
    // mêmes jours de la semaine jusqu'au bout de l'aperçu.
    // ⚠️ Rien n'est écrit en silence : on annonce le nombre de journées
    // touchées ET la dernière date. Un geste qui modifie treize journées doit
    // se voir autant qu'il porte.
    secteurEtendre: function (iso, portee) {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi.'); return; }
      var deps = ((V2.planningSecteurs || {})[iso] || []).slice();
      var cibles = [], i, d;

      if (portee === 'semaine') {
        // Du lundi au vendredi de la semaine de `iso`, sans revenir en arrière :
        // régler un jour déjà passé n'a aucun effet et brouillerait le compte.
        var j = dow(iso);
        for (i = 1 - j; i <= 5 - j; i++) {
          d = isoDe(iso, i);
          if (dow(d) >= 1 && dow(d) <= 5 && d >= isoPlus(0)) cibles.push(d);
        }
      } else {
        var fin = isoPlus(HORIZON_APERCU - 1);
        d = iso;
        while (d <= fin) { cibles.push(d); d = isoDe(d, 7); }
      }
      if (!cibles.length) { V2.toast('Aucune journée à venir dans cette période.'); return; }

      var suite;
      if (deps.length) {
        suite = c.from('rdv_secteur_jour').upsert(cibles.map(function (x) {
          return { user_id: u, date: x, departements: deps };
        }), { onConflict: 'user_id,date' });
      } else {
        // Aucun département sur le jour de référence : on RETIRE la contrainte
        // sur toute la portée. C'est la seule lecture cohérente de « appliquer
        // aussi à » quand il n'y a rien à appliquer.
        suite = c.from('rdv_secteur_jour').delete().eq('user_id', u).in('date', cibles);
      }

      suite.then(function (r) {
        if (r && r.error) { V2.toast('Enregistrement impossible.'); return; }
        V2.planningSecteurs = V2.planningSecteurs || {};
        cibles.forEach(function (x) {
          if (deps.length) V2.planningSecteurs[x] = deps.slice();
          else delete V2.planningSecteurs[x];
        });
        V2.toast(deps.length
          ? deps.join(' et ') + ' posé' + (deps.length > 1 ? 's' : '') + ' sur ' +
            cibles.length + ' journée' + (cibles.length > 1 ? 's' : '') +
            ', jusqu’au ' + libelle(cibles[cibles.length - 1]) + '.'
          : 'Contrainte retirée sur ' + cibles.length + ' journée' +
            (cibles.length > 1 ? 's' : '') + '.');
        V2.go('rdvplanning');
      }, function () { V2.toast('Enregistrement impossible.'); });
    },

    // ⚠️ Écriture IMMÉDIATE, sans bouton « enregistrer ». Un réglage qu'on
    // croit posé et qui ne l'est pas, c'est un pharmacien qui réserve à
    // 300 km — exactement ce que cet écran est censé empêcher. En cas
    // d'échec, on le DIT et on ne touche pas à l'affichage local : montrer
    // un département coché qui n'est pas en base serait pire que le refus.
    secteurBasculer: function (iso, dep) {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi.'); return; }
      var courant = ((V2.planningSecteurs || {})[iso] || []).slice();
      var i = courant.indexOf(dep);
      if (i >= 0) courant.splice(i, 1); else courant.push(dep);
      courant.sort();

      // Plus aucun département : la ligne disparaît. Garder une ligne vide
      // reviendrait au même — le moteur ne la contraint pas — mais l'écran
      // afficherait « Secteur : » suivi de rien.
      var q = courant.length
        ? c.from('rdv_secteur_jour')
            .upsert({ user_id: u, date: iso, departements: courant }, { onConflict: 'user_id,date' })
        : c.from('rdv_secteur_jour').delete().eq('user_id', u).eq('date', iso);

      q.then(function (r) {
        if (r && r.error) { V2.toast('Enregistrement impossible.'); return; }
        V2.planningSecteurs = V2.planningSecteurs || {};
        if (courant.length) V2.planningSecteurs[iso] = courant;
        else delete V2.planningSecteurs[iso];
        V2.go('rdvplanning');
      }, function () { V2.toast('Enregistrement impossible.'); });
    },

    // Reprend tel quel le secteur OBSERVÉ et le déclare. Le geste évident
    // d'une journée déjà orientée, en un clic au lieu de trois.
    secteurPoser: function (iso, liste) {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi.'); return; }
      var deps = String(liste || '').split(',').filter(Boolean).sort();
      if (!deps.length) return;
      c.from('rdv_secteur_jour')
        .upsert({ user_id: u, date: iso, departements: deps }, { onConflict: 'user_id,date' })
        .then(function (r) {
          if (r && r.error) { V2.toast('Enregistrement impossible.'); return; }
          V2.planningSecteurs = V2.planningSecteurs || {};
          V2.planningSecteurs[iso] = deps;
          V2.toast('Ce jour n’est plus réservable que depuis le ' + deps.join(' et le ') + '.');
          V2.go('rdvplanning');
        }, function () { V2.toast('Enregistrement impossible.'); });
    },

    secteurEffacer: function (iso) {
      var c = sb(), u = uid();
      if (!c || !u) return;
      c.from('rdv_secteur_jour').delete().eq('user_id', u).eq('date', iso).then(function (r) {
        if (r && r.error) { V2.toast('Suppression impossible.'); return; }
        if (V2.planningSecteurs) delete V2.planningSecteurs[iso];
        V2.toast('Ce jour redevient ouvert à tout ton portefeuille.');
        V2.go('rdvplanning');
      }, function () { V2.toast('Suppression impossible.'); });
    },

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

  // ═══════════════════════════════════════════════════════════════
  //  LE SECTEUR DU JOUR (19/08/2026)
  // ═══════════════════════════════════════════════════════════════
  // Jusqu'ici, la géographie d'une journée n'existait qu'À PARTIR du premier
  // rendez-vous posé. Le mardi où le commercial sait qu'il sera dans le 44,
  // une officine du 61 pouvait réserver — et c'est lui qui le découvrait après.
  //
  // Il le déclare ici, sur la journée elle-même : c'est le seul écran où il
  // regarde son mois. Le moteur de créneaux écarte alors ces journées pour les
  // officines d'ailleurs, sur la page publique comme dans « Voir d'autres
  // dates », et le serveur refuse une réservation qui passerait outre.
  //
  // ⚠️ Un jour NON DÉCLARÉ n'a aucune contrainte. Déclarer un mardi ne ferme
  // pas les lundis — sinon une seule déclaration viderait six mois d'agenda.

  // Les départements de SES officines, dans l'ordre de son portefeuille :
  // celui où il a le plus de clientes en premier. Proposer les 101
  // départements français serait une liste à faire défiler ; proposer les
  // siens, c'est un geste.
  function sesDepartements() {
    var moi = (V2.user && V2.user.commercial) ? String(V2.user.commercial) : '';
    var compte = {}, i;
    (V2.pharmacies || []).forEach(function (ph) {
      if (moi && (ph.comms || []).indexOf(moi) < 0) return;
      var d = window.V2RDV ? window.V2RDV.departement(ph.cp) : String(ph.cp || '').slice(0, 2);
      if (d) compte[d] = (compte[d] || 0) + 1;
    });
    var out = Object.keys(compte).sort(function (a, b) { return compte[b] - compte[a]; });
    // Un département déjà déclaré doit rester proposé même si son officine a
    // quitté le portefeuille depuis : sinon on ne pourrait plus le décocher.
    var dejà = V2.planningSecteurs || {};
    for (var k in dejà) {
      if (!dejà.hasOwnProperty(k)) continue;
      (dejà[k] || []).forEach(function (d) { if (out.indexOf(d) < 0) out.push(d); });
    }
    return out;
  }

  // ── OÙ TU SERAS / OÙ TU AIMERAIS ÊTRE ────────────────────────────
  // Deux choses différentes, et les confondre serait une faute :
  //
  //   · OBSERVÉ — les départements des rendez-vous déjà posés ce jour-là.
  //     C'est un FAIT, il se lit, il ne se règle pas. Il ne contraint rien
  //     non plus : la règle « aimant » s'occupe déjà du voisinage, et fermer
  //     automatiquement une journée dès le premier rendez-vous rendrait
  //     l'agenda impossible à remplir.
  //
  //   · SOUHAITÉ — ce que le commercial déclare sur une journée encore vide.
  //     C'est LUI qui l'écrit, et c'est la seule chose qui écarte des
  //     officines. « Si rien de prévu dans la journée, on doit pouvoir dire
  //     où on aimerait être » (Will, 19/08).
  var _cpParCip = null;
  function cpDuCip(cip) {
    if (!_cpParCip) {
      _cpParCip = {};
      (V2.pharmacies || []).forEach(function (p) {
        if (p && p.id != null) _cpParCip[String(p.id)] = p.cp || '';
      });
    }
    var c = _cpParCip[String(cip)];
    if (c) return c;
    // Prospect hors portefeuille : l'annuaire national le connaît.
    try { var o = V2.rdvInfo ? V2.rdvInfo(cip) : null; return (o && o.cp) || ''; }
    catch (e) { return ''; }
  }

  function dep(v) {
    return window.V2RDV ? window.V2RDV.departement(v) : String(v || '').slice(0, 2);
  }

  // Les départements où il sera VRAIMENT ce jour-là, d'après ce qui est posé :
  // les rendez-vous JARVIS, et les officines reconnues dans son agenda perso.
  function secteurObserve(iso, rdvs, reconnus) {
    var out = [];
    function ajouter(cp) {
      var d = dep(cp);
      if (d && out.indexOf(d) === -1) out.push(d);
    }
    (rdvs || []).forEach(function (r) { if (r.date === iso) ajouter(r.cp || cpDuCip(r.cip)); });
    (reconnus || []).forEach(function (o) { if (o.date === iso) ajouter(cpDuCip(o.cip)); });
    return out.sort();
  }

  // La journée, dans le planning détaillé : elle DIT, elle ne règle plus.
  // Le réglage est remonté dans l'agenda du haut, et un seul endroit règle —
  // deux éditeurs pour un même réglage finissent toujours par diverger.
  function blocSecteur(iso, observe, vide) {
    var deps = (V2.planningSecteurs || {})[iso] || [];
    observe = observe || [];
    var h = '<div class="agp-sect">';

    if (observe.length) {
      h += '<span class="agp-sect-ou">Tu y seras : <b>' + esc(observe.join(' · ')) + '</b></span>';
    }
    if (deps.length) {
      h += '<span class="agp-sect-ou">' + (vide ? 'Tu aimerais : ' : 'Réservable seulement depuis : ') +
        '<b>' + esc(deps.join(' · ')) + '</b></span>';
    }

    h += '<button class="agp-sect-b' + (deps.length ? ' on' : '') +
      '" onclick="V2.rdvPlanning.secteur(\'' + escArg(iso) + '\')">' +
      (deps.length ? 'Changer le secteur' : (vide ? 'Dire où tu aimerais être' : 'Choisir le secteur')) +
      '</button>';

    // Une journée déjà orientée par un rendez-vous mais non déclarée : le
    // geste utile est à un clic. Sans ce raccourci, personne ne penserait à
    // fermer la journée sur le département où il est déjà attendu.
    if (!deps.length && observe.length) {
      h += '<button class="agp-sect-sug" onclick="V2.rdvPlanning.secteurPoser(\'' +
        escArg(iso) + '\',\'' + escArg(observe.join(',')) + '\')">' +
        'n’ouvrir que le ' + esc(observe.join(' et le ')) + '</button>';
    }
    return h + '</div>';
  }

  // ── LA VUE D'ENSEMBLE ────────────────────────────────────────────
  // « On doit pouvoir voir sur quel secteur on sera tel ou tel jour » (Will).
  // Le secteur existait déjà, mais journée par journée, à quatre semaines de
  // défilement : personne n'aurait vu sa quinzaine d'un coup d'œil. Ici, tout
  // tient en un bloc — et chaque case mène à sa journée.
  // ⚠️ « Ma » et « Me », pas « M » et « M ». La position en colonne suffit à un
  // calendrier posé à plat, mais ici on touche une case pour la régler : deux
  // lettres identiques au-dessus de deux départements différents, c'est une
  // erreur de saisie qui ne se voit pas.
  var JOURS_COURTS = ['L', 'Ma', 'Me', 'J', 'V'];
  var MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
                    'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function nomMois(iso) {
    var p = String(iso).split('-');
    return MOIS_LONGS[+p[1] - 1] + ' ' + p[0];
  }

  // ── L'AGENDA DU HAUT — on y voit, ET on y règle ──────────────────
  // « On devrait pouvoir le faire directement sur l'agenda qui est tout en
  //   haut de la page, ce serait plus simple » (Will, 19/08).
  //
  // Le réglage vivait sur chaque journée, quatre semaines plus bas. Il remonte
  // ici : une case, un clic, les départements juste en dessous. Le bloc de
  // chaque journée garde ce qu'il sait dire — « tu y seras : 49 » — mais
  // n'édite plus rien. UN SEUL endroit règle, sinon les deux divergent.
  function apercuSecteurs(rdvs, reconnus, auj, dispo) {
    var cases = [], i;
    for (i = 0; i < HORIZON_APERCU; i++) {
      var iso = isoPlus(i), j = dow(iso);
      if (j < 1 || j > 5) continue;                    // le week-end ne se réserve pas
      var obs = secteurObserve(iso, rdvs, reconnus);
      var voulu = (V2.planningSecteurs || {})[iso] || [];
      // ⚠️ L'UNION des deux. Un jour avec un rendez-vous dans le 49 mais
      // déclaré « 49 et 35 » couvre deux départements : n'afficher que
      // l'observé cacherait la moitié de la journée.
      var tout = obs.slice();
      voulu.forEach(function (d) { if (tout.indexOf(d) === -1) tout.push(d); });
      var plages = (dispo && dispo.jours && dispo.jours[String(j)]) || null;
      cases.push({ iso: iso, jour: j, num: +String(iso).slice(8, 10), mois: nomMois(iso),
                   obs: obs, voulu: voulu, tout: tout.sort(),
                   ferme: !(plages && plages.length) });
    }
    if (!cases.length) return '';

    var html = '', ouvert = false, attendu = 1, moisCourant = '';
    cases.forEach(function (c, k) {
      if (c.mois !== moisCourant) {
        if (ouvert) { html += '</div>'; ouvert = false; }
        moisCourant = c.mois;
        html += '<p class="agp-ap-m">' + esc(c.mois) + '</p>';
      }
      if (!ouvert) { html += '<div class="agp-ap-l">'; ouvert = true; attendu = 1; }
      // Les cases manquantes en début de ligne sont comblées : sinon les
      // colonnes se décalent et « mardi » se lit sous « lundi ».
      while (attendu < c.jour) { html += '<div class="agp-ap-c agp-ap-vide"></div>'; attendu++; }
      var etiq = c.tout.length ? c.tout.join(' ') : (c.ferme ? '—' : '·');
      var cls = c.ferme ? ' agp-ap-ferme'
              : (c.obs.length ? ' agp-ap-sur' : (c.voulu.length ? ' agp-ap-voulu' : ''));
      if (V2._agpSecteurOuvert === c.iso) cls += ' agp-ap-ouv';
      html += '<button class="agp-ap-c' + cls + (c.iso === auj ? ' agp-ap-auj' : '') +
        '" onclick="V2.rdvPlanning.secteur(\'' + escArg(c.iso) + '\')">' +
        '<span class="agp-ap-j">' + JOURS_COURTS[c.jour - 1] + ' ' + c.num + '</span>' +
        '<span class="agp-ap-d">' + esc(etiq) + '</span></button>';
      attendu++;
      var finLigne = (c.jour === 5 || k === cases.length - 1 || cases[k + 1].mois !== c.mois);
      if (finLigne) {
        html += '</div>';
        ouvert = false;
        // Le choix des départements s'ouvre SOUS la semaine concernée, pas en
        // bas du bloc : on doit voir la case qu'on est en train de régler.
        if (V2._agpSecteurOuvert && estDansLaLigne(cases, k, V2._agpSecteurOuvert)) {
          html += panneauSecteur(V2._agpSecteurOuvert);
        }
      }
    });

    return '<div class="agp-ap" id="agp-apercu">' +
      '<p class="agp-ap-t">Où tu seras — touche un jour pour le régler</p>' + html +
      '<p class="agp-ap-leg"><b>44</b> = tu y as des rendez-vous · ' +
      '<span class="agp-ap-voulu-l">44</span> = tu l’as souhaité · ' +
      '· = ouvert à tout ton portefeuille · — = tu ne travailles pas</p></div>';
  }

  // La ligne courante va du dernier début de ligne jusqu'à l'index k.
  function estDansLaLigne(cases, k, iso) {
    for (var i = k; i >= 0; i--) {
      if (cases[i].iso === iso) return true;
      if (cases[i].jour === 1 || (i > 0 && cases[i - 1].mois !== cases[i].mois)) break;
    }
    return false;
  }

  function panneauSecteur(iso) {
    var deps = (V2.planningSecteurs || {})[iso] || [];
    var liste = sesDepartements();
    var j = dow(iso);
    var nomJour = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][j];
    // ⚠️ La DERNIÈRE OCCURRENCE de ce jour-là, pas la fin de l'aperçu : écrire
    // « tous les lundis jusqu'au mardi 17 novembre » annonce une date qui ne
    // sera jamais touchée, et un bouton qui ment sur sa portée ne se clique
    // pas deux fois.
    var borne = isoPlus(HORIZON_APERCU - 1), derniere = iso;
    while (isoDe(derniere, 7) <= borne) derniere = isoDe(derniere, 7);
    var nbJours = 1;
    for (var z = iso; isoDe(z, 7) <= borne; z = isoDe(z, 7)) nbJours++;

    return '<div class="agp-sect-p" id="agp-panneau">' +
      '<p class="agp-sm" style="margin:0 0 9px"><b>' + esc(libelle(iso)) + '</b> — où seras-tu ? ' +
        'Seules les officines de ces départements pourront réserver ce jour-là. ' +
        '<b>Ne rien cocher = aucune contrainte.</b></p>' +
      '<div class="agp-sect-c">' +
        liste.map(function (d) {
          return '<button class="' + (deps.indexOf(d) >= 0 ? 'on' : '') +
            '" onclick="V2.rdvPlanning.secteurBasculer(\'' + escArg(iso) + '\',\'' +
            escArg(d) + '\')">' + esc(d) + '</button>';
        }).join('') +
      '</div>' +
      // ── Remplir vite ────────────────────────────────────────────
      // Un trimestre, c'est soixante-cinq journées. À la main, personne ne le
      // fera deux fois. Ces deux boutons recopient le réglage de CE jour sur
      // toute la semaine, ou sur tous les mêmes jours de la semaine jusqu'au
      // bout de l'aperçu — et ils disent combien de journées ils ont touchées.
      '<p class="agp-sm" style="margin:12px 0 7px">Appliquer aussi à :</p>' +
      '<div class="agp-sect-a">' +
        '<button onclick="V2.rdvPlanning.secteurEtendre(\'' + escArg(iso) + '\',\'semaine\')">' +
          'toute cette semaine</button>' +
        '<button onclick="V2.rdvPlanning.secteurEtendre(\'' + escArg(iso) + '\',\'jour\')">' +
          'les ' + nbJours + ' ' + esc(nomJour) + 's, jusqu’au ' +
          esc(libelle(derniere)) + '</button>' +
      '</div>' +
      (deps.length
        ? '<button class="v2-btn v2-btn-ghost" style="min-height:44px;margin-top:11px" ' +
          'onclick="V2.rdvPlanning.secteurEffacer(\'' + escArg(iso) + '\')">' +
          'Retirer la contrainte de ce jour</button>'
        : '') +
      '<button class="v2-btn v2-btn-ghost" style="min-height:44px;margin-top:11px;margin-left:8px" ' +
        'onclick="V2.rdvPlanning.secteur(\'' + escArg(iso) + '\')">Fermer</button>' +
      '</div>';
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

    // Ce que le commercial vient chercher sur une journée vide : à qui écrire.
    // Le lien de prise de RDV laisse le pharmacien choisir son créneau
    // lui-même — c'est l'écran Campagne, déjà en place, qu'on ne réécrit pas.
    // ⚠️ UNE SEULE FOIS, sur la première journée libre. Le mettre sur chacune
    // en affichait dix-sept identiques, ce qui laissait croire à une liste
    // par journée alors que c'est la même — du bruit qui cache le planning.
    var appel = '';
    var aFaire = V2.planningAContacter || [];
    if (!mesRdv.length && !recoJour.length && libre >= 120 && aFaire.length && !V2._agpAppelPose) {
      V2._agpAppelPose = 1;
      var lot = lotMixte(aFaire, LOT_MAX);
      var nCli = 0, nPro = 0, z;
      for (z = 0; z < lot.length; z++) { if (lot[z].type === 'prospect') nPro++; else nCli++; }
      var totCli = 0, totPro = 0;
      for (z = 0; z < aFaire.length; z++) { if (aFaire[z].type === 'prospect') totPro++; else totCli++; }
      var apercu = lot.slice(0, 3).map(function (o) {
        return esc(o.nom) + ' <span class="agp-sm">(' +
          (o.type === 'prospect' ? 'prospect' : esc(depuis(o.vue))) + ')</span>';
      }).join(' · ');
      appel = '<div class="agp-vide-jour">' +
        '<p class="agp-sm" style="margin:0 0 8px">Première journée libre. ' +
        'À qui écrire : ' + apercu + '…</p>' +
        '<button class="v2-btn v2-btn-primary" style="min-height:44px" onclick="V2.rdvPlanning.contacter()">' +
        'Proposer des créneaux à ' + lot.length + ' officines</button>' +
        '<p class="agp-sm" style="margin:8px 0 0">' + nCli + ' clientes · ' + nPro +
        ' prospects. Au total, ' + totCli + ' clientes et ' + totPro +
        ' prospects de ton secteur n’ont aucun rendez-vous prévu.</p></div>';
    }

    return '<div class="agp-jour"><div class="agp-jt"><b>' + esc(libelle(iso)) + '</b>' +
      (iso === auj ? ' <span class="agp-auj">aujourd’hui</span>' : '') +
      '<span class="agp-resume">' + esc(resume) + '</span></div>' +
      blocSecteur(iso, secteurObserve(iso, rdvs, reconnus), !mesRdv.length && !recoJour.length) +
      '<div class="agp-bar' + (libre > 0 ? '' : ' agp-vide') + '">' + peinture + '</div>' +
      '<div class="agp-ech"><span>8h</span><span>12h</span><span>15h</span><span>19h</span></div>' +
      (lignes.length ? lignes.map(function (l) { return l.html; }).join('')
                     : '<p class="agp-rien">Journée entièrement libre.</p>') +
      appel +
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
      // ⚠️ Les rendez-vous et les secteurs se lisent sur TOUT l'aperçu. Sans
      // ça, un jour d'octobre où un rendez-vous est déjà posé s'afficherait
      // « ouvert à tout ton portefeuille » : un affichage faux, donc pire
      // qu'un affichage absent.
      var finApercu = isoPlus(HORIZON_APERCU - 1);

      // On relit l'agenda AVANT de dessiner : ouvrir cet écran, c'est vouloir
      // savoir où on en est maintenant. Le serveur ne relit pas deux fois en
      // moins de deux minutes, donc l'aller-retour reste bon marché.
      var pret = (V2.rdvAgenda ? V2.rdvAgenda.relever() : Promise.resolve(null));

      pret.then(function () {
        return Promise.all([
          V2.rdvDispo.charger(),
          c.from('rdv').select('*').eq('user_id', u).eq('statut', 'confirme')
            .gte('date', auj).lte('date', finApercu).order('date').order('heure'),
          c.from('rdv_occupe').select('date,debut,fin,jour_entier').eq('user_id', u)
            .gte('date', auj).lte('date', fin).order('date'),
          (V2.rdvAgenda ? V2.rdvAgenda.charger() : Promise.resolve(null)),
          // Les titres : ils arrivent dans cette réponse et n'y survivent pas.
          appelerAgenda({ action: 'mes_evenements' }),
          (V2.rdvAlias ? V2.rdvAlias.charger() : Promise.resolve({})),
          // Liste d'opposition COMMUNE a l'equipe : une officine qui dit stop
          // a Karine ne doit plus recevoir les mails de Morgane non plus.
          c.rpc('rdv_opposes').then(function (o) {
            return ((o && o.data) || []).map(function (x) {
              return String(x && x.cip != null ? x.cip : x);
            });
          }).catch(function () { return []; }),
          // Les journées où il a déclaré dans quels départements il serait.
          c.from('rdv_secteur_jour').select('date, departements')
            .eq('user_id', u).gte('date', auj).lte('date', finApercu)
            .then(function (r) { return (r && r.data) || []; },
                  function () { return []; })
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
            } else if (ev.date <= finApercu) {
              reconnus.push({
                date: ev.date, debut: ev.debut, fin: ev.fin, jour_entier: ev.jour_entier,
                cle: R.cleAlias(ev.titre), cip: cipEv,
                nom: m.officine.name, ville: m.officine.ville || '',
                etat: m.etat, source: m.source, client: !!idx.idsPorte[cipEv]
              });
            }
          }
        }
        // date -> ['44','49']. Vide = jour non déclaré, donc sans contrainte.
        V2.planningSecteurs = {};
        ((r[7]) || []).forEach(function (x) {
          if (x && x.date) V2.planningSecteurs[String(x.date)] = x.departements || [];
        });
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

        V2.planningAContacter = aContacter(rdvs, reconnus, r[6] || []);
        V2._agpAppelPose = 0;   // un seul bloc d'appel par rendu

        var jours = '';
        for (var i = 0; i < JOURS_AFFICHES; i++) {
          jours += rendreJour(isoPlus(i), dispo, blocages, rdvs, occupes, auj, reconnus);
        }

        root.innerHTML = top + '<div class="v2-wrap narrow">' +
          '<div class="agp-hero"><h1>Mon agenda</h1>' +
            '<p>Ton trimestre en haut : touche un jour pour dire où tu seras. ' +
            'En dessous, tes quatre prochaines semaines heure par heure, exactement ' +
            'comme le pharmacien les voit quand il ouvre ton lien — ce qui est en ' +
            'couleur ne peut plus être réservé.</p></div>' +

          '<div class="agp-etat">' + etatAgenda(ag) + '</div>' +

          offreAnnuaire +

          apercuSecteurs(rdvs, reconnus, auj, dispo) +

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

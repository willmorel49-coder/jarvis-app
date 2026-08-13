/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Le geste — noter un rendez-vous depuis n'importe où

   Direction 6, choisie par Will le 13/08/2026 sur la galerie
   `_rdv-directions.html`. Le pari : le geste le plus fréquent — noter ce
   qu'on vient de décrocher au téléphone — ne doit pas obliger à quitter
   ce qu'on faisait. C'est le chemin le plus court pour abandonner le
   carnet papier.

   Ce que ce fichier fait, et qu'un écran ne peut pas faire :
   · un bouton rond présent sur TOUS les écrans, hors accueil de connexion ;
   · une feuille qui propose des jours et des heures VRAIS — ceux du moteur
     de créneaux, qui connaît déjà les disponibilités du commercial, son
     agenda personnel et le temps de route depuis le rendez-vous précédent.
     Des pastilles prises au hasard auraient produit des chevauchements.

   ⚠️ Le risque assumé de cette direction, écrit sur la galerie : elle met
   en avant UN geste, pas le module. C'est le hub (v2-rdv.js) qui répond à
   l'autre moitié.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  var ouverte = false;
  var choisie = null;      // l'officine retenue
  var propositions = [];   // [{date, creneaux:[...]}] venues du moteur
  var choixDate = '', choixHeure = '';
  var moisAffiche = '';    // 'AAAA-MM' — le mois que le calendrier montre

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e ? e.value : ''; }
  function sansAccent(s) {
    try { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    catch (e) { return String(s || '').toLowerCase(); }
  }

  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var JOURSC = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function dcourt(iso) {
    var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return JOURSC[d.getUTCDay()] + ' ' + (+p[2]);
  }
  function dlong(iso) {
    var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return JOURS[d.getUTCDay()] + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1];
  }
  function hhh(h) { return String(h).slice(0, 5).replace(':', 'h').replace(/^0/, ''); }
  function moisDe(iso) { return String(iso).slice(0, 7); }
  function moisNom(cle) {
    var p = String(cle).split('-');
    return MOIS[+p[1] - 1] + ' ' + p[0];
  }
  function moisPlus(cle, n) {
    var p = String(cle).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1 + n, 1));
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
  }
  // Lundi = 0 : un calendrier français ne commence pas le dimanche.
  function colonneDe(iso) {
    var p = String(iso).split('-');
    return (new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() + 6) % 7;
  }
  function joursDuMois(cle) {
    var p = String(cle).split('-');
    return new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate();
  }

  function css() {
    if ($('v2-geste-css')) return;
    var s = document.createElement('style'); s.id = 'v2-geste-css';
    s.textContent = [
      /* Le bouton. Il vit au-dessus de tout, sauf des barres de l'app. */
      '.v2-fab{position:fixed;right:16px;bottom:calc(20px + env(safe-area-inset-bottom,0px));',
      '  width:58px;height:58px;border-radius:50%;border:0;z-index:9400;cursor:pointer;',
      '  background:linear-gradient(180deg,#0A57E8,#0043C4);color:#fff;',
      '  box-shadow:0 12px 26px -10px rgba(0,80,230,.65),0 2px 6px rgba(16,19,28,.18);',
      '  display:flex;align-items:center;justify-content:center;',
      '  transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s}',
      '.v2-fab[hidden]{display:none}',
      '.v2-fab:active{transform:scale(.94)}',
      /* Le voile. Pas de flou : le Mac de Will fige avec backdrop-filter. */
      '.v2-gv{position:fixed;inset:0;background:rgba(16,19,28,.38);z-index:9500;opacity:0;',
      '  transition:opacity .24s}',
      '.v2-gv.on{opacity:1}',
      '.v2-gs{position:fixed;left:0;right:0;bottom:0;z-index:9510;background:#fff;',
      '  border-radius:24px 24px 0 0;max-height:88vh;overflow:auto;-webkit-overflow-scrolling:touch;',
      '  padding:12px 18px calc(22px + env(safe-area-inset-bottom,0px));',
      '  box-shadow:0 -16px 40px -20px rgba(16,19,28,.45);',
      '  transform:translateY(100%);transition:transform .28s cubic-bezier(.2,.8,.2,1)}',
      '.v2-gs.on{transform:translateY(0)}',
      '.v2-gp{width:38px;height:4px;border-radius:2px;background:#DDE3EE;margin:0 auto 14px}',
      '.v2-gs h3{font-size:19px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px}',
      '.v2-gs .sous{font-size:13.5px;color:var(--muted,#737A8C);margin:0 0 16px}',
      '.v2-gl{display:block;font-size:13px;font-weight:700;letter-spacing:.05em;',
      '  text-transform:uppercase;color:var(--muted,#737A8C);margin:0 0 7px}',
      '.v2-gs input[type=search],.v2-gs input[type=text]{width:100%;min-height:48px;font:inherit;',
      '  font-size:16px;padding:0 13px;border:1px solid var(--line,#E4E8F0);border-radius:12px;',
      '  background:var(--card-2,#F7F9FC);color:inherit}',
      '.v2-gchoisie{width:100%;min-height:48px;border:1px solid var(--ip-blue,#0050E6);border-radius:12px;',
      '  background:#fff;display:flex;align-items:center;gap:10px;padding:0 13px;font-size:16px;font-weight:700}',
      '.v2-gchoisie button{margin-left:auto;min-height:44px;border:0;background:none;',
      '  color:var(--muted,#737A8C);font:inherit;font-size:14px;cursor:pointer;padding:0 4px}',
      '.v2-gres{list-style:none;padding:0;margin:8px 0 0;max-height:240px;overflow:auto}',
      '.v2-gres li{margin:0 0 6px}',
      '.v2-gres button{width:100%;text-align:left;min-height:52px;padding:9px 12px;',
      '  border:1px solid var(--line,#E4E8F0);border-radius:11px;background:var(--card-2,#F7F9FC);',
      '  color:inherit;font:inherit;cursor:pointer}',
      '.v2-gres b{display:block;font-size:14.5px}',
      '.v2-gres span{color:var(--muted,#737A8C);font-size:13px}',
      '.v2-gpu{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}',
      '.v2-gpu button{min-height:44px;padding:0 14px;border-radius:12px;font:600 14px/1 inherit;',
      '  border:1px solid var(--line,#E4E8F0);background:#fff;color:var(--ip-blue,#0050E6);cursor:pointer}',
      '.v2-gpu button.on{border-color:var(--ip-blue,#0050E6);background:#EAF0FE;font-weight:800}',
      '.v2-gok{width:100%;min-height:50px;border-radius:13px;border:0;color:#fff;cursor:pointer;',
      '  font-size:15px;font-weight:800;background:linear-gradient(180deg,#0A57E8,#0043C4);',
      '  box-shadow:0 10px 22px -10px rgba(0,80,230,.6)}',
      '.v2-gok[disabled]{opacity:.45;box-shadow:none}',
      '.v2-gmsg{margin-top:12px;font-size:14px;line-height:1.5}',
      '.v2-gvide{color:var(--muted,#737A8C);font-size:13.5px;margin:2px 0 14px;line-height:1.5}',
      /* ── Le calendrier ────────────────────────────────────────────
         Un vrai agenda : on voit le mois, on sait quels jours sont
         possibles, on tape sur la date. Huit pastilles ne montraient pas
         assez loin — c'est la remarque de Will le 13/08/2026. */
      '.v2-gcal-tete{display:flex;align-items:center;gap:8px;margin:0 0 10px}',
      '.v2-gcal-tete b{flex:1;text-align:center;font-size:15.5px;font-weight:800;',
      '  text-transform:capitalize;letter-spacing:-.01em}',
      '.v2-gcal-tete button{width:44px;height:44px;border-radius:12px;border:1px solid var(--line,#E4E8F0);',
      '  background:#fff;color:var(--ip-blue,#0050E6);cursor:pointer;font-size:18px;line-height:1;',
      '  display:flex;align-items:center;justify-content:center}',
      '.v2-gcal-tete button[disabled]{opacity:.32;cursor:default}',
      '.v2-gcal-j{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:0 0 6px}',
      '.v2-gcal-j span{text-align:center;font-size:13px;font-weight:700;color:var(--muted,#737A8C)}',
      '.v2-gcal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:0 0 16px}',
      '.v2-gcal button,.v2-gcal i{height:46px;border-radius:11px;display:flex;align-items:center;',
      '  justify-content:center;font-size:15px;font-style:normal}',
      '.v2-gcal button{border:1px solid var(--line,#E4E8F0);background:#fff;color:var(--ip-ink,#10131C);',
      '  font-weight:600;cursor:pointer;position:relative}',
      /* Un jour possible porte un point : la disponibilité se voit avant de taper. */
      '.v2-gcal button::after{content:"";position:absolute;bottom:6px;left:50%;margin-left:-2px;',
      '  width:4px;height:4px;border-radius:50%;background:var(--ip-blue,#0050E6)}',
      '.v2-gcal button.on{background:var(--ip-blue,#0050E6);border-color:var(--ip-blue,#0050E6);',
      '  color:#fff;font-weight:800}',
      '.v2-gcal button.on::after{background:#fff}',
      '.v2-gcal i{color:#B9C0CE;font-size:14px}',   /* jour sans créneau, non cliquable */
      '.v2-gcal i.vide{color:transparent}',
      '@media (prefers-reduced-motion:reduce){.v2-fab,.v2-gv,.v2-gs{transition:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  var PLUS = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
             'stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  // ── Le bouton ────────────────────────────────────────────────────
  // Il s'efface quand une barre flottante occupe déjà le bas de l'écran :
  // deux objets ronds superposés, c'est le défaut vu sur la maquette.
  V2.rdvGeste = {
    poser: function () {
      if (!V2.user) { var v = $('v2-fab'); if (v) v.hidden = true; return; }
      css();
      var b = $('v2-fab');
      if (!b) {
        b = document.createElement('button');
        b.id = 'v2-fab'; b.className = 'v2-fab';
        b.setAttribute('aria-label', 'Noter un rendez-vous');
        b.innerHTML = PLUS;
        b.onclick = function () { V2.rdvGeste.ouvrir(); };
        document.body.appendChild(b);
      }
      var route = (V2.route && V2.route.name) || '';
      var barre = document.getElementById('v2-cartbar');
      var maj = document.getElementById('v2-updatebar');
      var inst = document.getElementById('v2-installbar');
      var occupe = [barre, maj, inst].some(function (e) { return e && e.classList.contains('show'); });
      // Là où le geste est DÉJÀ offert par l'écran lui-même, le bouton fait
      // doublon — et pire, il recouvre le bas du contenu. Vérifié à l'écran :
      // sur le hub, il masquait la section « À venir ».
      var doublon = (route === 'rdvajout' || route === 'rdvplanning' || route === 'rdv');
      b.hidden = occupe || doublon;
    },

    ouvrir: function () {
      if (ouverte) return;
      ouverte = true; choisie = null; propositions = []; choixDate = ''; choixHeure = '';
      css();
      // La fermeture retire les éléments après 300 ms d'animation. Rouvrir plus
      // vite que ça ferait coexister deux #v2-gs, et la feuille s'ouvrirait
      // vide. On balaie donc l'ancienne avant d'en poser une neuve.
      ['v2-gv', 'v2-gs'].forEach(function (id) {
        var vieux = $(id);
        if (vieux && vieux.parentNode) vieux.parentNode.removeChild(vieux);
      });
      var v = document.createElement('div'); v.className = 'v2-gv'; v.id = 'v2-gv';
      v.onclick = function () { V2.rdvGeste.fermer(); };
      var s = document.createElement('div'); s.className = 'v2-gs'; s.id = 'v2-gs';
      s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', 'Noter un rendez-vous');
      document.body.appendChild(v); document.body.appendChild(s);
      rendre();
      requestAnimationFrame(function () { v.classList.add('on'); s.classList.add('on'); });
      // Les officines du fichier clients portent les adresses postales.
      if (V2.loadFiles && !window.CLIENTS && !V2._gesteClients) {
        V2._gesteClients = true;
        V2.loadFiles(['clients']).then(function () { if (ouverte) rendre(); });
      }
    },

    fermer: function () {
      var v = $('v2-gv'), s = $('v2-gs');
      if (v) v.classList.remove('on');
      if (s) s.classList.remove('on');
      ouverte = false;
      setTimeout(function () {
        if (v && v.parentNode) v.parentNode.removeChild(v);
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }, 300);
    },

    chercher: function () { rendreResultats(); },

    choisir: function (cip) {
      choisie = V2.rdvInfo ? V2.rdvInfo(cip) : { cip: cip, nom: '', ville: '' };
      choixDate = ''; choixHeure = '';
      rendre();
      calculerCreneaux();
    },

    aLaMain: function () {
      var nom = val('v2-gq').trim();
      if (nom.length < 2) return;
      choisie = { cip: '', nom: nom, adresse: '', cp: '', ville: '', tel: '', contact: '',
                  lat: null, lon: null, aLaMain: true };
      choixDate = ''; choixHeure = '';
      rendre();
      calculerCreneaux();
    },

    changer: function () { choisie = null; choixDate = ''; choixHeure = ''; rendre(); },

    mois: function (n) { moisAffiche = moisPlus(moisAffiche, n); rendre(); },
    jour: function (d) { choixDate = d; choixHeure = ''; rendre(); },
    heure: function (h) { choixHeure = h; rendre(); },

    valider: function () {
      if (!choisie || !choixDate || !choixHeure) return;
      var b = $('v2-gok');
      if (b) { b.disabled = true; b.textContent = 'Enregistrement…'; }
      V2.rdvAjout.creer(choisie, { date: choixDate, heure: choixHeure, duree: 45 })
        .then(function (r) {
          if (!r.ok) {
            if (b) { b.disabled = false; b.textContent = 'Noter ce rendez-vous'; }
            var m = $('v2-gmsg');
            if (m) m.innerHTML = '<span style="color:var(--rose,#E0556E)">' + esc(r.message) + '</span>';
            return;
          }
          V2.toast('Rendez-vous noté.');
          V2.rdvGeste.fermer();
          // On ne déplace pas l'utilisateur : il faisait autre chose. S'il est
          // déjà sur un écran de rendez-vous, on le rafraîchit, c'est tout.
          var route = (V2.route && V2.route.name) || '';
          if (route === 'rdv' || route === 'rdvplanning') V2.go(route);
        });
    }
  };

  // ── Les créneaux VRAIS ───────────────────────────────────────────
  // On rejoue exactement ce que verrait un pharmacien : disponibilités du
  // commercial, agenda personnel relevé, rendez-vous déjà posés, temps de
  // route depuis l'officine choisie. Sans ça, les pastilles proposeraient
  // des heures qui seraient refusées à l'enregistrement.
  function calculerCreneaux() {
    propositions = [];
    var c = sb(), u = uid();
    if (!c || !u || !window.V2RDV) { rendre(); return; }
    var auj = new Date().toISOString().slice(0, 10);
    Promise.all([
      V2.rdvDispo ? V2.rdvDispo.charger() : Promise.resolve({ dispo: null, blocages: [] }),
      c.from('rdv').select('date,heure,duree_min,lat,lon').eq('user_id', u)
        .eq('statut', 'confirme').gte('date', auj),
      c.from('rdv_occupe').select('date,debut,fin').eq('user_id', u).gte('date', auj)
    ]).then(function (r) {
      var st = r[0] || {};
      var occupes = ((r[1] && r[1].data) || []).map(function (x) {
        return { date: x.date, heure: String(x.heure).slice(0, 5),
                 duree_min: x.duree_min, lat: x.lat, lon: x.lon };
      });
      var agenda = ((r[2] && r[2].data) || []).map(function (x) {
        return { date: x.date, debut: String(x.debut).slice(0, 5), fin: String(x.fin).slice(0, 5) };
      });
      // Tout l'horizon (trois mois), pas les huit prochains jours : le
      // calendrier doit pouvoir se feuilleter comme un vrai agenda.
      propositions = window.V2RDV.calendrier({
        officine: { lat: choisie && choisie.lat, lon: choisie && choisie.lon },
        dispo: st.dispo, blocages: st.blocages || [],
        occupes: occupes, agenda: agenda,
        aujourdhui: auj, max_jours: 70, creneaux_par_jour: 8
      });
      // On ouvre sur le mois du premier jour possible, pas sur le mois
      // courant : si tout est plein jusqu'en septembre, autant y aller.
      moisAffiche = propositions.length ? moisDe(propositions[0].date) : moisDe(auj);
      if (ouverte) rendre();
    }).catch(function () { if (ouverte) rendre(); });
  }

  // ── Recherche d'officine ─────────────────────────────────────────
  function chercher(q) {
    var t = sansAccent(q).trim();
    if (t.length < 2) return [];
    var out = [], i, p, pharmas = V2.pharmacies || [];
    for (i = 0; i < pharmas.length && out.length < 25; i++) {
      p = pharmas[i];
      if (sansAccent(p.name).indexOf(t) !== -1 || sansAccent(p.ville).indexOf(t) !== -1 ||
          String(p.id).indexOf(t) === 0) {
        out.push({ cip: String(p.id), nom: p.name, ville: p.ville, cp: p.cp });
      }
    }
    return out;
  }

  function rendreResultats() {
    var e = $('v2-gres');
    if (!e) return;
    var q = val('v2-gq');
    if (sansAccent(q).trim().length < 2) { e.innerHTML = ''; return; }
    var r = chercher(q);
    e.innerHTML = r.map(function (o) {
      return '<li><button onclick="V2.rdvGeste.choisir(\'' +
        esc(String(o.cip).replace(/[^0-9A-Za-z]/g, '')) + '\')"><b>' + esc(o.nom) +
        '</b><span>' + esc([o.cp, o.ville].filter(Boolean).join(' ')) + '</span></button></li>';
    }).join('') +
      '<li><button onclick="V2.rdvGeste.aLaMain()"><b>Saisir « ' + esc(q.slice(0, 30)) +
      ' » à la main</b><span>si elle n’est dans aucun fichier</span></button></li>';
  }

  // ── Le calendrier du mois ────────────────────────────────────────
  // Les jours possibles sont cliquables et portent un point. Les autres
  // restent visibles mais éteints : un agenda qui cache ses jours pleins
  // ne se lit pas, on croit qu'il manque des dates.
  function calendrier() {
    var dispo = {};
    propositions.forEach(function (j) { dispo[j.date] = j.creneaux; });
    var premier = propositions.length ? moisDe(propositions[0].date) : moisAffiche;
    var dernier = propositions.length ? moisDe(propositions[propositions.length - 1].date) : moisAffiche;
    if (!moisAffiche) moisAffiche = premier;

    var n = joursDuMois(moisAffiche);
    var cases = '';
    // Les cases vides avant le 1er : sans elles, le mois glisse d'un cran.
    var decal = colonneDe(moisAffiche + '-01');
    for (var k = 0; k < decal; k++) cases += '<i class="vide"></i>';
    for (var d = 1; d <= n; d++) {
      var iso = moisAffiche + '-' + ('0' + d).slice(-2);
      if (dispo[iso]) {
        cases += '<button class="' + (iso === choixDate ? 'on' : '') +
          '" onclick="V2.rdvGeste.jour(\'' + esc(iso) + '\')" aria-label="' +
          esc(dlong(iso)) + '">' + d + '</button>';
      } else {
        cases += '<i>' + d + '</i>';
      }
    }

    return '<div class="v2-gcal-tete">' +
        '<button onclick="V2.rdvGeste.mois(-1)"' +
          (moisAffiche <= premier ? ' disabled' : '') + ' aria-label="Mois précédent">‹</button>' +
        '<b>' + esc(moisNom(moisAffiche)) + '</b>' +
        '<button onclick="V2.rdvGeste.mois(1)"' +
          (moisAffiche >= dernier ? ' disabled' : '') + ' aria-label="Mois suivant">›</button>' +
      '</div>' +
      '<div class="v2-gcal-j"><span>L</span><span>M</span><span>M</span><span>J</span>' +
        '<span>V</span><span>S</span><span>D</span></div>' +
      '<div class="v2-gcal">' + cases + '</div>';
  }

  function rendre() {
    var s = $('v2-gs');
    if (!s) return;
    var h = '<div class="v2-gp"></div><h3>Noter un rendez-vous</h3>';

    if (!choisie) {
      h += '<p class="sous">Trois gestes. Le reste est repris du fichier.</p>' +
        '<span class="v2-gl">L’officine</span>' +
        '<input type="search" id="v2-gq" autocomplete="off" placeholder="Nom, ville, ou début de CIP" ' +
          'oninput="V2.rdvGeste.chercher()" />' +
        '<ul class="v2-gres" id="v2-gres"></ul>';
      s.innerHTML = h;
      var q = $('v2-gq'); if (q) q.focus();
      return;
    }

    h += '<p class="sous">Adresse, ville, téléphone et position sont repris du fichier.</p>' +
      '<span class="v2-gl">L’officine</span>' +
      '<div class="v2-gchoisie"><span>' + esc(choisie.nom) +
        (choisie.ville ? ' · ' + esc(choisie.ville) : '') + '</span>' +
        '<button onclick="V2.rdvGeste.changer()">changer</button></div>' +
      '<div style="height:16px"></div>';

    if (!propositions.length) {
      h += '<span class="v2-gl">Le jour</span>' +
        '<p class="v2-gvide">Lecture de tes disponibilités…</p>';
      s.innerHTML = h;
      return;
    }

    h += '<span class="v2-gl">Le jour</span>' + calendrier();

    var jour = null;
    propositions.forEach(function (j) { if (j.date === choixDate) jour = j; });
    if (jour) {
      h += '<span class="v2-gl">L’heure</span><div class="v2-gpu">' +
        jour.creneaux.map(function (c) {
          return '<button class="' + (c === choixHeure ? 'on' : '') +
            '" onclick="V2.rdvGeste.heure(\'' + esc(c) + '\')">' + esc(hhh(c)) + '</button>';
        }).join('') + '</div>';
    }

    var pret = !!(choixDate && choixHeure);
    h += '<button class="v2-gok" id="v2-gok"' + (pret ? '' : ' disabled') +
      ' onclick="V2.rdvGeste.valider()">' +
      (pret ? 'Noter — ' + esc(dlong(choixDate)) + ' à ' + esc(hhh(choixHeure))
            : (choixDate ? 'Choisis une heure' : 'Choisis un jour')) + '</button>' +
      '<div class="v2-gmsg" id="v2-gmsg"></div>';
    s.innerHTML = h;
  }
})();

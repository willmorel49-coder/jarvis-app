/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · « L'Argument » (pages.argument) — le PREMIER rendez-vous, chiffré.
   Complément de l'Audit marge : l'Audit calcule sur les vrais achats d'une
   pharmacie CLIENTE ; l'Argument se règle en 3 curseurs DEVANT un PROSPECT
   dont on n'a encore aucune donnée, et montre : ce que son grossiste lui
   verse vraiment (fourchettes de marché sourcées) · ce qu'Intégral met dans
   sa poche · le gain net €/an. Plus les preuves opposables et les réponses
   aux objections. Se MONTRE à l'écran en rendez-vous, ne s'imprime jamais
   (ROBOT.md §10).
   ⚠️ AUCUN chiffre dans ce fichier (dépôt public) : tout vient de
   window.ARGUMENT, chargé par V2.loadFiles(['argument']) depuis l'espace
   protégé (clé `argument` de PROTEGES, témoin `ARGUMENT`).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };

  function eur(n) { n = Math.round(n || 0); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'; }
  function pc(x) { return (Math.round(x * 10) / 10).toString().replace('.', ',') + ' %'; }

  // réglages de séance (repartent aux valeurs du fichier de données à chaque ouverture)
  var st = null;
  function D() { return window.ARGUMENT || null; }
  function initSt() {
    var d = D(); if (!d || st) return;
    st = { ca: d.defauts.ca, tx: d.defauts.tx, part: d.defauts.part };
  }

  function calc() {
    var d = D(), m = d.marche, ip = d.ip;
    var caAn = st.ca * 12;
    var reelHaut = Math.min(st.tx, m.plafond, m.terrainHaut);
    var reelBas = Math.min(Math.max(st.tx * m.ratioAfficheReel, m.terrainBas), reelHaut);
    var assietteIP = caAn * st.part / 100;
    var gainIP = assietteIP * ip.tauxCoeur / 100;
    var memePartEux = assietteIP * ((reelBas + reelHaut) / 2) / 100;
    return {
      caAn: caAn, annonce: caAn * st.tx / 100,
      reelBas: reelBas, reelHaut: reelHaut,
      euxBas: caAn * reelBas / 100, euxHaut: caAn * reelHaut / 100,
      assietteIP: assietteIP, gainIP: gainIP, delta: gainIP - memePartEux, memePartEux: memePartEux
    };
  }

  var CSS = [
    '.arg-wrap{max-width:1060px;margin:0 auto}',
    '.arg-grid{display:grid;grid-template-columns:minmax(280px,340px) 1fr;gap:18px;align-items:start}',
    '@media(max-width:860px){.arg-grid{grid-template-columns:1fr}}',
    '.arg-regl{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;position:sticky;top:12px;box-shadow:0 10px 30px -18px rgba(16,19,28,.18)}',
    '.arg-regl label{display:block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px}',
    '.arg-regl label:first-child{margin-top:0}',
    '.arg-regl output{float:right;font-weight:800;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
    '.arg-regl input[type=range]{width:100%;accent-color:var(--ip-blue);height:32px}',
    '.arg-note{font-size:11.5px;color:var(--muted);border-top:1px solid var(--line);margin-top:14px;padding-top:10px}',
    '.arg-cards{display:grid;gap:12px}',
    '.arg-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 20px;box-shadow:0 10px 30px -20px rgba(16,19,28,.2)}',
    '.arg-card .t{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}',
    '.arg-card .m{font-size:clamp(26px,3.2vw,36px);font-weight:800;letter-spacing:-.01em;margin:4px 0 2px;font-variant-numeric:tabular-nums}',
    '.arg-card .m small{font-size:.5em;font-weight:600;color:var(--muted)}',
    '.arg-card .x{font-size:13px;color:var(--muted)}',
    '.arg-card.nous{border-color:rgba(0,80,230,.25);background:linear-gradient(165deg,#FFFFFF,#F3F7FF)}',
    '.arg-card.nous .m{color:var(--ip-blue)}',
    '.arg-card.delta{background:var(--ip-ink);border-color:var(--ip-ink);color:#F4F6FB}',
    '.arg-card.delta .t{color:#9AA3B8}.arg-card.delta .m{color:#7DDFA8}.arg-card.delta .x{color:#B6BDCE}',
    '.arg-barre{height:16px;border-radius:6px;overflow:hidden;display:flex;background:var(--card-2);border:1px solid var(--line);margin-top:8px}',
    '.arg-barre i{display:block;height:100%}',
    '.arg-h2{font-size:19px;font-weight:800;margin:26px 0 4px}',
    '.arg-ss{font-size:13px;color:var(--muted);margin-bottom:12px}',
    '.arg-preuves{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}',
    '.arg-preuve{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}',
    '.arg-preuve .c{font-size:26px;font-weight:800;color:var(--ip-blue);font-variant-numeric:tabular-nums}',
    '.arg-preuve p{font-size:12.5px;margin:4px 0 0}',
    '.arg-preuve .s{font-size:10.5px;color:var(--muted-2);border-top:1px solid var(--line-2);margin-top:8px;padding-top:6px}',
    '.arg-obj{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px 16px;margin-bottom:8px}',
    '.arg-obj b{color:var(--ip-blue)}',
    '.arg-obj p{font-size:13px;margin:3px 0 0}',
    '.arg-vide{background:var(--card);border:1px dashed var(--line-strong);border-radius:16px;padding:26px;text-align:center;color:var(--muted)}'
  ].join('');

  function head() {
    return '<style>' + CSS + '</style>' +
      '<div class="arg-wrap">' +
      '<div class="v2-ph"><div class="v2-ph-t">' + ICO('opp', 22) + ' L’Argument</div>' +
      '<div class="v2-ph-s">Le premier rendez-vous, chiffré — trois curseurs réglés devant le prospect, ' +
      'chaque affirmation sourcée. Quand la pharmacie est déjà cliente, l’Audit marge prend le relais sur ses vrais achats.</div></div>';
  }

  function render(el) {
    if (!D()) {
      el.innerHTML = head() +
        '<div class="arg-vide">Chargement des données protégées…' +
        (V2.donneesProtegeesKO && V2.donneesProtegeesKO().length ?
          '<br><b>Le fichier protégé n’a pas pu être chargé</b> — vérifie ta connexion puis rouvre l’écran.' : '') +
        '</div></div>';
      V2.loadFiles(['argument']).then(function () {
        initSt();
        if (V2.route && V2.route.name === 'argument') render(el);
      });
      return;
    }
    initSt();
    var d = D(), r = calc();
    var pEvap = Math.max(0, Math.min(100, 100 * (r.annonce - r.euxHaut) / (r.annonce || 1)));

    el.innerHTML = head() +
      '<div class="arg-grid">' +
      '<aside class="arg-regl">' +
        '<label>Achats grossiste du prospect <output>' + eur(st.ca) + '/mois</output></label>' +
        '<input type="range" id="arg-ca" min="10000" max="150000" step="2500" value="' + st.ca + '">' +
        '<label>Taux global annoncé par son grossiste <output>' + pc(st.tx) + '</output></label>' +
        '<input type="range" id="arg-tx" min="0.5" max="5" step="0.1" value="' + st.tx + '">' +
        '<label>Part confiée à Intégral en complément <output>' + st.part + ' %</output></label>' +
        '<input type="range" id="arg-part" min="5" max="60" step="5" value="' + st.part + '">' +
        '<div class="arg-note">' + esc(d.note) + '</div>' +
      '</aside>' +
      '<div class="arg-cards">' +
        '<div class="arg-card"><div class="t">Ce que son grossiste lui verse vraiment</div>' +
          '<div class="m">' + eur(r.euxBas) + ' – ' + eur(r.euxHaut) + '<small> /an</small></div>' +
          '<div class="x">Il croit toucher ' + eur(r.annonce) + ' (' + pc(st.tx) + ' annoncés). Réel constaté : ' +
          pc(r.reelBas) + ' à ' + pc(r.reelHaut) + ' — l’assiette rétrécit, le plafond légal borne à ' +
          pc(d.marche.plafond) + ', et le versement part en fin de mois.</div>' +
          '<div class="arg-barre"><i style="width:' + (100 - pEvap).toFixed(0) + '%;background:var(--ip-blue);opacity:.55"></i>' +
          '<i style="width:' + pEvap.toFixed(0) + '%;background:var(--card-2)"></i></div></div>' +
        '<div class="arg-card nous"><div class="t">Ce qu’Intégral met dans sa poche, sur la part confiée</div>' +
          '<div class="m">' + eur(r.gainIP) + '<small> /an</small></div>' +
          '<div class="x">' + pc(d.ip.tauxCoeur) + ' du prix fabricant en cœur de gamme, net sur la facture, dès la première boîte — ' +
          'davantage sur les petits prix (jusqu’à ' + pc(d.ip.petitsPrixMax) + ' vers 1 €) et les génériques (jusqu’à ' +
          pc(d.ip.gen) + '). ' + esc(d.ip.engagement) + ', livré ' + esc(d.ip.livraison) + '.</div></div>' +
        '<div class="arg-card delta"><div class="t">Le gain net de l’officine, sans rien changer d’autre</div>' +
          '<div class="m">+ ' + eur(r.delta) + '<small> /an</small></div>' +
          '<div class="x">Sur les ' + eur(r.assietteIP) + ' confiés chaque année : ' + eur(r.gainIP) + ' chez Intégral contre ' +
          eur(r.memePartEux) + ' au taux réel moyen de son grossiste. Hors effet petits prix et génériques — c’est le plancher.</div></div>' +
      '</div></div>' +
      '<div class="arg-h2">Les preuves à poser sur la table</div>' +
      '<div class="arg-ss">Sourcées, publiques, opposables — à montrer à l’écran, jamais à imprimer.</div>' +
      '<div class="arg-preuves">' + d.preuves.map(function (p) {
        return '<div class="arg-preuve"><div class="c">' + esc(p.c) + '</div><p>' + esc(p.t) + '</p>' +
          '<div class="s">' + esc(p.s) + '</div></div>';
      }).join('') + '</div>' +
      '<div class="arg-h2">Les objections, et la réponse</div>' +
      '<div class="arg-ss">Le script du rendez-vous — dans l’ordre où elles arrivent.</div>' +
      d.objections.map(function (o) {
        return '<div class="arg-obj"><b>« ' + esc(o.q) + ' »</b><p>' + esc(o.r) + '</p></div>';
      }).join('') +
      '</div>';

    ['ca', 'tx', 'part'].forEach(function (k) {
      var inp = el.querySelector('#arg-' + k);
      if (inp) inp.addEventListener('input', function () {
        st[k] = parseFloat(inp.value);
        render(el);
        var back = el.querySelector('#arg-' + k);
        if (back) back.focus();
      });
    });
  }

  V2.pages.argument = { render: render };
})();

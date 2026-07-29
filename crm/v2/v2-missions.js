/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Missions rémunérées (V2.pages.missions)
   Dimension « expert 360 » : parler au pharmacien de sa RÉMUNÉRATION
   globale (au-delà du produit). Catalogue chiffré 2026 (tarifs officiels
   ameli/convention) + simulateur « combien votre officine peut gagner ».
   100% client-side, aucune donnée patient, aucune dépendance externe.
   Source tarifs : ameli.fr / avenants conventionnels 2025-2026.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : (Math.round(n) + ' €'); };

  // Catalogue des actes/missions rémunérés — tarifs 2026 (métropole, TTC).
  var CATALOGUE = [
    { acte: 'Vaccination (grippe, Covid, calendrier 11 ans+)', tarif: '7,50 à 9,60 € / injection', note: '9,60 € si le pharmacien prescrit ET injecte (+3 € RVA/an)' },
    { acte: 'TROD angine / cystite', tarif: '10 à 15 € / test', note: '10 € test seul · 15 € avec dispensation de l\'antibiotique' },
    { acte: 'Entretien AVK / AOD / asthme', tarif: '50 € (an 1) puis 30 €/an', note: 'par patient accompagné, pris en charge à 100 %' },
    { acte: 'Accompagnement anticancéreux oraux', tarif: '60 à 80 € (an 1) puis 30 €/an', note: 'traitement long' },
    { acte: 'Bilan Partagé de Médication (BPM)', tarif: '65 € (initial) puis 30 €/an', note: '65 ans + et ≥ 5 molécules chroniques depuis 6 mois' },
    { acte: 'Bilan de prévention (âges clés)', tarif: '30 €', note: '25/45/65/75 ans' },
    { acte: 'Entretien femme enceinte', tarif: '5 €', note: '' },
    { acte: 'Remise kit dépistage cancer colorectal', tarif: '3 € (+2 € si test réalisé)', note: '' },
    { acte: 'ROSP (démarche qualité, substitution, éco…)', tarif: 'jusqu\'à ~800 €/an', note: 'qualité 100 € · substitution génériques jusqu\'à 400 € · connexion 100 € · éco-responsabilité 200 €' }
  ];

  // Simulateur : champs (valeur unitaire retenue, prudente/moyenne).
  var SIM = [
    { k: 'vac', l: 'Vaccins réalisés', per: 'an', unit: 7.5, ph: 'ex. 350' },
    { k: 'trod', l: 'TROD (angine/cystite)', per: 'an', unit: 12, ph: 'ex. 80' },
    { k: 'ent', l: 'Entretiens pharmaceutiques (AVK/AOD/asthme)', per: 'an', unit: 40, ph: 'ex. 40' },
    { k: 'bpm', l: 'Bilans partagés de médication (BPM)', per: 'an', unit: 55, ph: 'ex. 30' },
    { k: 'prev', l: 'Bilans de prévention', per: 'an', unit: 30, ph: 'ex. 25' }
  ];

  V2.missionsCalc = function () {
    var total = 0;
    SIM.forEach(function (f) {
      var el = document.getElementById('mis-' + f.k);
      var n = el ? (parseFloat(el.value) || 0) : 0;
      if (n < 0) n = 0;
      total += n * f.unit;
    });
    var out = document.getElementById('mis-total');
    if (out) out.textContent = eur(total);
    var mo = document.getElementById('mis-total-mois');
    if (mo) mo.textContent = eur(total / 12) + '/mois';
  };

  V2.pages.missions = {
    render: function (root) {
      ensureCss();
      var rows = CATALOGUE.map(function (c) {
        return '<div class="mis-row"><div class="mis-acte"><b>' + esc(c.acte) + '</b>' +
          (c.note ? '<span>' + esc(c.note) + '</span>' : '') + '</div>' +
          '<div class="mis-tarif mono">' + esc(c.tarif) + '</div></div>';
      }).join('');
      var simInputs = SIM.map(function (f) {
        return '<label class="mis-f"><span>' + esc(f.l) + ' <small>/ ' + f.per + '</small></span>' +
          '<input id="mis-' + f.k + '" type="number" inputmode="numeric" min="0" placeholder="' + esc(f.ph) + '" oninput="V2.missionsCalc()"></label>';
      }).join('');

      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' +
          '<div class="v2-page-title">Missions rémunérées</div>' +
          '<div class="v2-page-sub">La rémunération de l\'officine au-delà du produit — les tarifs 2026 et ce que ça peut rapporter. L\'argument d\'expert à montrer au pharmacien.</div>' +

          '<div class="v2-card mis-simcard">' +
            '<div class="mis-sim-hd">' + ICO('pilo', 18, 2) + '<div><b>Simulateur — combien cette officine pourrait gagner</b>' +
              '<small>Saisis quelques volumes, l\'estimation se met à jour. Aucune donnée patient, calcul indicatif.</small></div></div>' +
            '<div class="mis-grid">' + simInputs + '</div>' +
            '<div class="mis-tot"><div><span>Rémunération missions estimée</span><b class="mono" id="mis-total">0 €</b><small class="mono" id="mis-total-mois">0 €/mois</small></div>' +
              '<div class="mis-tot-note">hors ROSP et honoraires de dispensation · tarifs 2026</div></div>' +
          '</div>' +

          '<div class="v2-card" style="margin-top:14px;overflow:hidden;padding:0">' +
            '<div class="mis-cat-hd">' + ICO('cat', 16, 2) + 'Catalogue des missions rémunérées · 2026</div>' +
            rows +
          '</div>' +

          '<div class="mis-foot">⚠️ La vaccination à 9,60 € (bonus RVA) est supprimée au 1er avril 2027 → honoraire de prescription 7,50 €. Tarifs officiels ameli / avenants conventionnels — à confirmer sur ameli.fr avant tout engagement chiffré.</div>' +
        '</div>';
    }
  };

  function ensureCss() {
    if (document.getElementById('mis-css')) return;
    var st = document.createElement('style'); st.id = 'mis-css';
    st.textContent =
      '.mis-simcard{margin-top:6px}' +
      '.mis-sim-hd{display:flex;gap:11px;align-items:flex-start;padding:2px 2px 12px}' +
      '.mis-sim-hd b{display:block;font-size:14px;color:var(--ip-ink)}.mis-sim-hd small{color:var(--muted);font-size:12px}' +
      '.mis-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.mis-f{display:flex;flex-direction:column;gap:5px}.mis-f span{font-size:12px;font-weight:600;color:var(--ip-ink)}.mis-f small{color:var(--muted);font-weight:500}' +
      '.mis-f input{border:1px solid var(--line-strong);border-radius:10px;padding:10px 12px;font:inherit;font-size:15px;color:var(--ip-ink);background:var(--card-2);width:100%;box-sizing:border-box}' +
      '.mis-tot{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:14px;padding:14px 16px;border-radius:14px;background:linear-gradient(135deg,#0B2E1E,#1E9E6A);color:#fff;flex-wrap:wrap}' +
      '.mis-tot span{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;opacity:.85}' +
      '.mis-tot b{font-size:30px;font-weight:800;line-height:1.05}.mis-tot small{display:block;font-size:13px;opacity:.9;font-weight:700}' +
      '.mis-tot-note{font-size:11px;opacity:.85}' +
      '.mis-cat-hd{display:flex;align-items:center;gap:8px;padding:13px 18px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--line)}' +
      '.mis-row{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:11px 18px;border-top:1px solid var(--line)}.mis-row:first-of-type{border-top:0}' +
      '.mis-acte{min-width:0;flex:1}.mis-acte b{display:block;font-size:13.5px;font-weight:700;color:var(--ip-ink)}.mis-acte span{display:block;font-size:11.5px;color:var(--muted);margin-top:1px}' +
      '.mis-tarif{flex:none;font-size:13px;font-weight:800;color:var(--c-opp);text-align:right;white-space:nowrap;max-width:44%}' +
      '.mis-foot{font-size:11px;color:var(--muted);margin-top:14px;line-height:1.5}' +
      '@media(max-width:560px){.mis-grid{grid-template-columns:1fr}.mis-tarif{max-width:40%;white-space:normal}}';
    document.head.appendChild(st);
  }
})();

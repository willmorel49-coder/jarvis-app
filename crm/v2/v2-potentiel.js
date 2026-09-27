/* v2-potentiel.js — « Ce que cette officine devrait vendre ».
 *
 * Le GERS dit ce que pèse un produit sur le marché. Il ne dit jamais ce qu'une
 * officine donnée devrait vendre. Ce bloc l'estime, à partir de potentiel-commune.json
 * (Open Medic par tranche d'âge × population INSEE de la commune × officines FINESS).
 *
 * ⚠️ C'est une ESTIMATION, jamais une mesure. Trois raisons, écrites à l'écran et pas
 * seulement ici : la clientèle déborde la commune, les officines d'une même commune sont
 * supposées égales, et la tranche 60-64 ans est reconstituée depuis les 55-64 de l'INSEE.
 * Le chiffre ne vaut que COMPARÉ — entre classes, entre communes. Jamais seul.
 *
 * Données PUBLIQUES (Assurance Maladie, INSEE, FINESS) : ce bloc s'affiche donc aussi
 * pour une officine dont un commercial n'a pas le droit de voir les ventes.
 *
 * Chargement : fetch avec cache journalier, comme national.json et saison-cip.json —
 * le fichier fait 1,3 Mo, il n'a rien à faire dans le boot.
 */
(function () {
  'use strict';
  if (typeof V2 === 'undefined') return;
  var esc = function (s) { return V2.esc(s); };

  var P = null;            // potentiel-commune.json
  var IDX = null;          // code postal -> [codes INSEE]
  var IDXN = null;         // code postal + nom -> code INSEE
  var demande = false;     // une seule requête par session
  var echec = false;

  // ── Rapprochement officine -> commune ───────────────────────────────────────
  // Une officine ne porte qu'un code postal et un nom de ville. Ça ne suffit pas :
  // un code postal peut couvrir plusieurs communes, les accents et les « Saint »
  // s'écrivent de dix façons, et les codes postaux arrivent parfois SANS leur zéro
  // initial (« 1320 » pour « 01320 »). Mesuré le 27/09/2026 sur 2 037 officines :
  // 99,2 % de celles qui ont un code postal sont rattachées.
  function norm(s) {
    return String(s || '').toUpperCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9]+/g, ' ')
      .replace(/\bCEDEX\b[\s\S]*$/, '')
      .replace(/\bSAINTES\b/g, 'STS').replace(/\bSAINTE\b/g, 'ST')
      .replace(/\bSAINT\b/g, 'ST').replace(/\bSTE\b/g, 'ST')
      .replace(/\s+/g, '');
  }
  function cp5(s) {
    var n = String(s || '').replace(/\D/g, '');
    if (!n) return '';
    return ('00000' + n).slice(-5);
  }
  function indexer() {
    IDX = {}; IDXN = {};
    for (var code in P.data) {
      var d = P.data[code], l = d.cp || [];
      for (var i = 0; i < l.length; i++) {
        var k = cp5(l[i]);
        if (!k) continue;
        (IDX[k] = IDX[k] || []).push(code);
        IDXN[k + '|' + norm(d.n)] = code;
      }
    }
  }
  function communeDe(pharma) {
    if (!P || !pharma) return null;
    if (!IDX) indexer();
    var c = cp5(pharma.cp);
    if (!c) return null;
    var direct = IDXN[c + '|' + norm(pharma.ville)];
    if (direct) return direct;
    var l = IDX[c] || [];
    if (l.length === 1) return l[0];
    if (l.length > 1) {
      var v = norm(pharma.ville);
      var m = l.filter(function (x) {
        var n = norm(P.data[x].n);
        return n === v || n.indexOf(v) >= 0 || v.indexOf(n) >= 0;
      });
      if (m.length === 1) return m[0];
      // Départage de dernier recours : la commune qui compte le plus d'officines.
      // Discutable, mais toujours meilleur que de ne rien montrer.
      if (m.length > 1) {
        return m.sort(function (a, b) { return P.data[b].o - P.data[a].o; })[0];
      }
    }
    return null;
  }
  V2.potentielCommuneDe = communeDe;

  function charger() {
    if (demande) return;
    demande = true;
    var jour = new Date().toISOString().slice(0, 10);
    fetch('potentiel-commune.json?d=' + jour, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.data || !j.classes) throw new Error('fichier inattendu');
        P = j; IDX = null;
        // L'écran a pu changer pendant l'attente : ne re-rendre que si on est resté.
        if (V2.route && V2.route.name === 'pharma') V2.render();
      })
      .catch(function () { echec = true; });
  }

  function injectCss() {
    if (document.getElementById('v2-pot-css')) return;
    var s = document.createElement('style'); s.id = 'v2-pot-css';
    s.textContent = [
      '.pot-rows{display:flex;flex-direction:column;gap:7px;padding:4px 18px 14px}',
      '.pot-r{display:grid;grid-template-columns:minmax(0,1fr) 34% auto;align-items:center;gap:10px}',
      '@media(max-width:430px){.pot-r{grid-template-columns:minmax(0,1fr) 26% auto;gap:8px}}',
      '.pot-n{font-size:12.5px;font-weight:700;color:var(--ip-ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pot-b{display:block;height:8px;border-radius:5px;background:rgba(0,87,255,.10);overflow:hidden}',
      '.pot-b i{display:block;height:100%;border-radius:5px;background:rgba(0,87,255,.52)}',
      '.pot-v{font-size:12.5px;font-weight:700;color:var(--ip-ink-2);min-width:46px;text-align:right}',
      '.pot-head{display:flex;flex-wrap:wrap;gap:8px;padding:2px 18px 12px}',
      '.pot-t{flex:1 1 128px;border:1px solid var(--line);border-radius:11px;padding:9px 11px;background:var(--card-2)}',
      '.pot-t span{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700}',
      '.pot-t b{display:block;font-size:18px;color:var(--ip-ink);font-weight:800;margin-top:2px}',
      '.pot-t i{display:block;font-style:normal;font-size:11.5px;color:var(--muted-2);margin-top:1px}',
      '.pot-note{font-size:12px;color:var(--ip-ink-2);padding:0 18px 16px;font-weight:600;line-height:1.5}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Le bloc ────────────────────────────────────────────────────────────────
  V2.potentielBloc = function (pharma) {
    if (!pharma) return '';
    if (!P) {
      charger();
      if (echec) return '';        // silencieux : un bloc d'analyse ne doit pas crier
      return '';
    }
    var code = communeDe(pharma);
    if (!code) {
      // On le DIT au lieu d'inventer une commune. 16 officines sur 2 037 dans ce cas,
      // presque toutes avec un code postal CEDEX.
      injectCss();
      return '<div class="v2-card pha-card"><div class="pha-ch"><h3>Ce que cette officine devrait vendre</h3></div>' +
        '<div class="pot-note">Commune non reconnue à partir du code postal ' +
        esc(pharma.cp || '—') + ' — le potentiel ne peut pas être estimé ici.</div></div>';
    }
    var d = P.data[code];
    var tot = 0, i;
    for (i = 0; i < d.a.length; i++) tot += d.a[i];
    if (!tot) return '';
    injectCss();

    var lignes = P.classes.map(function (cl, j) { return { n: cl.n, v: d.a[j] }; })
      .filter(function (x) { return x.v > 0; })
      .sort(function (a, b) { return b.v - a.v; });
    var mx = lignes.length ? lignes[0].v : 1;
    var haut = lignes.slice(0, 8);

    var popDesservie = d.p[0] + d.p[1] + d.p[2];
    var popCommune = d.pc ? (d.pc[0] + d.pc[1] + d.pc[2]) : popDesservie;
    var part60 = popDesservie ? Math.round(d.p[2] / popDesservie * 100) : 0;

    var tuiles =
      '<div class="pot-t"><span>Boîtes par an</span><b class="mono">' + V2.fmtNum(tot) + '</b>' +
        '<i>attendues pour une officine d\'ici</i></div>' +
      '<div class="pot-t"><span>Officines</span><b class="mono">' + d.o + '</b>' +
        '<i>' + esc(d.n || '') + '</i></div>' +
      '<div class="pot-t"><span>Population desservie</span><b class="mono">' + V2.fmtNum(popDesservie) + '</b>' +
        '<i>' + (popDesservie > popCommune
          ? V2.fmtNum(popCommune) + ' dans la commune, le reste autour'
          : 'habitants de la commune') + '</i></div>' +
      '<div class="pot-t"><span>60 ans et plus</span><b class="mono">' + part60 + ' %</b>' +
        '<i>de la population desservie</i></div>';

    var rows = haut.map(function (x) {
      var w = Math.max(4, Math.round(x.v / mx * 100));
      return '<div class="pot-r">' +
        '<span class="pot-n">' + esc(x.n) + '</span>' +
        '<span class="pot-b"><i style="width:' + w + '%"></i></span>' +
        '<span class="pot-v mono">' + V2.fmtNum(x.v) + '</span>' +
      '</div>';
    }).join('');

    return '<div class="v2-card pha-card" style="padding:0;overflow:hidden">' +
      '<div class="pha-ch" style="padding:16px 18px 10px"><h3>Ce que cette officine devrait vendre</h3>' +
        '<span class="pha-sub">estimation d\'après l\'âge de la population et le nombre d\'officines · ' +
        esc(d.n || '') + '</span></div>' +
      '<div class="pot-head">' + tuiles + '</div>' +
      '<div class="pot-rows">' + rows + '</div>' +
      '<div class="pot-note">Une <b>estimation</b>, pas une mesure : la clientèle déborde la commune, ' +
        'les officines d\'une même commune sont ici supposées égales, et la population des communes ' +
        'sans pharmacie est répartie dans le département. Ce chiffre sert à <b>comparer</b> — entre ' +
        'familles de produits, entre communes — jamais à annoncer un volume à un pharmacien.</div>' +
    '</div>';
  };
})();

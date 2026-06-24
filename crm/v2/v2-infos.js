/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Infos du matin" (pages.infos)
   Brief quotidien 100% client-side (aucune clé API, aucun serveur) :
   - le focus produit du jour (déterministe par date, tournant)
   - les offres labo en cours (BENCHMARK)
   - le top marge pharmacien du réseau (PROD_STATS)
   Sert de point de départ de journée pour préparer la tournée.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : (n + ' €'); };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(n); };
  function cap(s) { s = String(s == null ? '' : s); return s.charAt(0).toUpperCase() + s.slice(1); }

  // Index du jour (déterministe, stable sur 24h) — pas de Math.random pour rester reproductible.
  function dayOfYear() {
    var d = new Date();
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
  }
  function dateLabel() {
    try { return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); }
    catch (e) { return 'aujourd\'hui'; }
  }

  // Offres labo en cours (catalogue IP) — nécessite BENCHMARK (chargé à la demande).
  function offres() {
    var B = window.BENCHMARK; if (!B) return null;
    var out = [];
    for (var i = 0; i < B.length; i++) {
      var b = B[i], bp = V2.bestPrice ? V2.bestPrice(b) : null;
      if (bp && bp.offre && bp.ip > 0) out.push({ d: b.designation || '', cip: b.cip13 || '', ip: bp.ip, ht: bp.ht || 0, remise: bp.remise || 0, froid: !!b.is_froid });
    }
    out.sort(function (a, b) { return (b.remise || 0) - (a.remise || 0); });
    return out;
  }

  V2.pages.infos = {
    render: function (root) {
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      var firstName = (V2.user && V2.user.name ? V2.user.name.split(' ')[0] : 'Will');
      var PS = window.PROD_STATS || [];

      // ── Focus produit du jour (tournant) parmi le top rotation réseau ──
      var pool = PS.slice(0, Math.min(PS.length, 150));
      var focus = pool.length ? pool[dayOfYear() % pool.length] : null;

      // ── Top marge pharmacien (réseau) ──
      var topMarge = PS.slice().sort(function (a, b) { return (b.marge || 0) - (a.marge || 0); }).slice(0, 6);

      // ── Offres labo (lazy : on charge le catalogue en tâche de fond) ──
      var offs = offres();
      if (offs === null && V2.loadFiles) {
        V2.loadFiles(['bench']).then(function () { if (V2.route && V2.route.name === 'infos') V2.render(); });
      }

      // KPIs
      var kpi = function (l, v, sub, color, go) {
        var tag = go ? 'button type="button"' : 'div', end = go ? 'button' : 'div';
        return '<' + tag + ' class="inf-kpi"' + (go ? ' onclick="V2.go(\'' + go + '\')"' : '') + '>' +
          '<div class="inf-kpi-v mono" style="color:' + (color || 'var(--ip-ink)') + '">' + v + '</div>' +
          '<div class="inf-kpi-l">' + l + '</div>' +
          (sub ? '<div class="inf-kpi-s">' + sub + '</div>' : '') +
          '</' + end + '>';
      };
      var kpis = '<div class="inf-kpis">' +
        kpi('Produits à pousser', num(PS.length), 'sur le réseau', 'var(--ip-blue)', 'molecules') +
        kpi('Offres labo en cours', offs === null ? '…' : num(offs.length), 'remises ponctuelles', 'var(--c-amber)', 'molecules') +
        kpi('Officines à voir', num((V2.pharmacies || []).length), 'dans ton secteur', 'var(--c-opp)', 'pharma') +
        '</div>';

      // Carte focus du jour
      var focusCard = focus ? '<div class="inf-focus">' +
        '<div class="inf-focus-tag">' + ICO('spark', 14) + ' Le focus du jour</div>' +
        '<div class="inf-focus-name">' + esc(cap((focus.d || '').toLowerCase())) + '</div>' +
        '<div class="inf-focus-grid">' +
          '<div><div class="inf-f-v mono">' + num(focus.rota) + '</div><div class="inf-f-l">boîtes/an/pharmacie</div></div>' +
          '<div><div class="inf-f-v mono" style="color:var(--c-opp)">' + eur(focus.marge) + '</div><div class="inf-f-l">marge pharmacien/an</div></div>' +
          '<div><div class="inf-f-v mono" style="color:var(--ip-blue)">' + eur(focus.remise) + '</div><div class="inf-f-l">ta remise/an</div></div>' +
          '<div><div class="inf-f-v mono">' + num(focus.n) + '</div><div class="inf-f-l">pharmacies réseau</div></div>' +
        '</div>' +
        '<a class="inf-focus-cta" onclick="V2.go(\'molecules\',\'' + esc(focus.c) + '\')">Voir dans le catalogue ' + ICO('chev', 14) + '</a>' +
      '</div>' : '';

      // Top marge réseau
      var margeRows = topMarge.map(function (r, i) {
        return '<a class="inf-row" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">' +
          '<span class="inf-row-rk mono">' + (i + 1) + '</span>' +
          '<span class="inf-row-nm">' + esc(cap((r.d || '').toLowerCase())) +
            '<small>rotation ~' + num(r.rota) + '/an · ' + num(r.n) + ' phies</small></span>' +
          '<span class="inf-row-v mono" style="color:var(--c-opp)">' + eur(r.marge) + '<small>/an</small></span>' +
        '</a>';
      }).join('');
      var margeCard = topMarge.length ? '<div class="inf-card">' +
        '<div class="inf-card-h">' + ICO('cat', 16) + ' Top marge pharmacien · réseau' +
          '<a class="inf-card-link" onclick="V2.go(\'molecules\')">tout voir →</a></div>' +
        margeRows + '</div>' : '';

      // Offres du moment
      var offCard = '';
      if (offs && offs.length) {
        var offRows = offs.slice(0, 6).map(function (o, i) {
          return '<a class="inf-row" onclick="V2.go(\'molecules\',\'' + esc(o.cip) + '\')">' +
            '<span class="inf-row-rk mono">' + (i + 1) + '</span>' +
            '<span class="inf-row-nm">' + esc(cap((o.d || '').toLowerCase())) + (o.froid ? ' <span class="ph-froid">FROID</span>' : '') +
              '<small>prix net ' + eur(o.ip) + '</small></span>' +
            '<span class="inf-row-v mono" style="color:var(--c-amber)">-' + (o.remise || 0) + '%</span>' +
          '</a>';
        }).join('');
        offCard = '<div class="inf-card">' +
          '<div class="inf-card-h">' + ICO('spark', 16) + ' Offres labo en cours' +
            '<a class="inf-card-link" onclick="V2.go(\'molecules\')">tout voir →</a></div>' +
          offRows + '</div>';
      }

      root.innerHTML = top +
        '<div class="v2-wrap narrow" style="--accent:var(--c-amber)">' +
          '<div class="inf-hero">' +
            '<span class="inf-eyebrow">' + ICO('spark', 15) + ' ' + cap(dateLabel()) + '</span>' +
            '<h1>Bonjour ' + esc(firstName) + ', voici ton brief du matin</h1>' +
            '<p>L\'essentiel pour démarrer ta journée : ton focus du jour, les offres en cours et le top marge réseau.</p>' +
          '</div>' +
          kpis +
          focusCard +
          '<div class="inf-grid">' + margeCard + offCard + '</div>' +
          '<div class="inf-foot">Mis à jour chaque jour à partir des ventes réseau et du catalogue Intégral Pharma — aucune donnée ne sort de l\'app.</div>' +
        '</div>';
    }
  };

  if (!document.getElementById('v2-infos-css')) {
    var st = document.createElement('style'); st.id = 'v2-infos-css';
    st.textContent =
      '.inf-hero{margin:8px 0 20px}' +
      '.inf-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.02em;color:var(--c-amber);text-transform:capitalize}' +
      '.inf-hero h1{font-size:26px;font-weight:900;letter-spacing:-.025em;margin:8px 0 4px;line-height:1.1}' +
      '.inf-hero p{font-size:14px;color:var(--muted);font-weight:500;max-width:560px}' +
      '.inf-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}' +
      '.inf-kpi{display:block;width:100%;text-align:left;font:inherit;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 16px;text-decoration:none;color:inherit;box-shadow:var(--sh-1)}' +
      'button.inf-kpi{cursor:pointer}' +
      '.inf-kpi-v{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1}' +
      '.inf-kpi-l{font-size:13px;font-weight:700;color:var(--ip-ink);margin-top:6px}' +
      '.inf-kpi-s{font-size:11.5px;color:var(--muted);font-weight:500;margin-top:1px}' +
      '.inf-focus{background:linear-gradient(150deg,#0050E6,#0034A0);color:#fff;border-radius:var(--r-card);padding:20px 22px;margin-bottom:16px;box-shadow:var(--sh-2);position:relative;overflow:hidden}' +
      '.inf-focus::after{content:"";position:absolute;right:-40px;top:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.08)}' +
      '.inf-focus-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;opacity:.85}' +
      '.inf-focus-name{font-size:20px;font-weight:800;letter-spacing:-.01em;margin:6px 0 16px;position:relative;z-index:1}' +
      '.inf-focus-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;position:relative;z-index:1}' +
      '.inf-f-v{font-size:18px;font-weight:800;line-height:1}' +
      '.inf-f-l{font-size:10.5px;opacity:.82;font-weight:600;margin-top:3px}' +
      '.inf-focus-cta{display:inline-flex;align-items:center;gap:5px;margin-top:16px;font-size:13px;font-weight:700;color:#fff;background:rgba(255,255,255,.16);border-radius:var(--r-pill);padding:8px 15px;cursor:pointer;position:relative;z-index:1}' +
      '.inf-focus-cta:hover{background:rgba(255,255,255,.26)}' +
      '.inf-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}' +
      '@media(max-width:720px){.inf-grid{grid-template-columns:1fr}.inf-kpis{grid-template-columns:1fr}.inf-focus-grid{grid-template-columns:1fr 1fr}}' +
      '.inf-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);overflow:hidden}' +
      '.inf-card-h{display:flex;align-items:center;gap:8px;padding:13px 16px;font-size:13.5px;font-weight:800;border-bottom:1px solid var(--line)}' +
      '.inf-card-link{margin-left:auto;font-size:12px;font-weight:700;color:var(--ip-blue);cursor:pointer;text-decoration:none}' +
      '.inf-row{display:flex;align-items:center;gap:11px;padding:10px 16px;border-bottom:1px solid var(--line-2,var(--line));text-decoration:none;color:inherit}' +
      '.inf-row:last-child{border-bottom:none}.inf-row:hover{background:var(--card-2)}' +
      '.inf-row-rk{flex:none;width:20px;font-size:12px;font-weight:700;color:var(--muted-2)}' +
      '.inf-row-nm{flex:1;min-width:0;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis}' +
      '.inf-row-nm small{display:block;font-weight:500;color:var(--muted);font-family:var(--mono);font-size:11px}' +
      '.inf-row-v{flex:none;font-size:14px;font-weight:800}.inf-row-v small{font-size:10px;font-weight:600;color:var(--muted-2)}' +
      '.inf-foot{margin-top:16px;font-size:11.5px;color:var(--muted);text-align:center}';
    document.head.appendChild(st);
  }
})();

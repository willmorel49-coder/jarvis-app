/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Infos du matin" (pages.infos)
   VRAIE veille marché officine, 100% gratuite : lit crm/v2/infos-jour.json
   (généré chaque matin par le robot GitHub Actions generate_infos.py qui agrège
   les flux RSS ANSM — ruptures/sécurité/actu — et Le Moniteur des pharmacies).
   Différenciateur : croise la DCI des ruptures avec le catalogue IP -> alternatives IP.
   Aucune clé, aucun coût. Fallback propre si le fichier n'est pas là.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : (n + ' €'); };
  function cap(s) { s = String(s == null ? '' : s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  var DATA = null, LOADED = false, FAILED = false;

  function load(cb) {
    if (LOADED || FAILED) { cb(); return; }
    var day = '';
    try { day = new Date().toISOString().slice(0, 10); } catch (e) {}
    try {
      fetch('infos-jour.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (j) { DATA = j; LOADED = true; cb(); })
        .catch(function () { FAILED = true; cb(); });
    } catch (e) { FAILED = true; cb(); }
  }

  var CAT = {
    ruptures:      { label: 'Ruptures & tensions', color: 'var(--bad)', ico: 'alert' },
    securite:      { label: 'Sécurité / pharmacovigilance', color: 'var(--c-cat)', ico: 'alert' },
    reglementaire: { label: 'Réglementaire & marché', color: 'var(--ip-blue)', ico: 'spark' },
    profession:    { label: 'Profession & officine', color: 'var(--c-opp)', ico: 'pharma' },
  };

  // Alternatives IP pour une molécule en rupture (les génériques IP portent le nom de la DCI)
  function ipAlternatives(dci) {
    var B = window.BENCHMARK; if (!B || !dci) return [];
    var key = norm(dci).split(/[ ,/]/)[0];
    if (key.length < 4) return [];
    var out = [], seen = {};
    for (var i = 0; i < B.length && out.length < 4; i++) {
      var b = B[i], d = norm(b.designation || '');
      if (d.indexOf(key) >= 0) {
        var c = String(b.cip13 || ''); if (seen[c]) continue; seen[c] = 1;
        var bp = V2.bestPrice ? V2.bestPrice(b) : { ip: b.prix_ip, remise: b.remise_pct };
        out.push({ d: b.designation || '', cip: c, ip: bp.ip, remise: bp.remise, froid: !!b.is_froid });
      }
    }
    return out;
  }

  function frDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
    catch (e) { return ''; }
  }
  function dayLabel() {
    try { return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); }
    catch (e) { return 'aujourd\'hui'; }
  }

  V2.pages.infos = {
    render: function (root) {
      var topbar = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      var firstName = (V2.user && V2.user.name ? V2.user.name.split(' ')[0] : 'Will');

      // Chargement du brief + catalogue (pour les alternatives IP) en tâche de fond
      if (!LOADED && !FAILED) {
        load(function () { if (V2.route && V2.route.name === 'infos') V2.render(); });
        root.innerHTML = topbar + '<div class="v2-wrap narrow"><div class="v2-loading"><div class="v2-spinner"></div><div>Chargement de la veille du matin…</div></div></div>';
        return;
      }
      if (!window.BENCHMARK && V2.loadFiles && DATA) {
        V2.loadFiles(['bench']).then(function () { if (V2.route && V2.route.name === 'infos') V2.render(); });
      }

      var items = (DATA && DATA.items) ? DATA.items : [];
      var ruptures = items.filter(function (i) { return i.cat === 'ruptures'; });

      // ── Opportunités IP : ruptures croisées au catalogue (le levier commercial) ──
      var oppHtml = '';
      if (window.BENCHMARK) {
        var opps = ruptures.map(function (r) { return { r: r, alt: r.dci ? ipAlternatives(r.dci) : [] }; })
          .filter(function (o) { return o.alt.length; });
        if (opps.length) {
          oppHtml = '<div class="inf-opp">' +
            '<div class="inf-opp-h">' + ICO('spark', 16) + ' Opportunités IP — une rupture, ton alternative en stock</div>' +
            opps.slice(0, 6).map(function (o) {
              var alts = o.alt.map(function (a) {
                return '<a class="inf-alt" onclick="V2.go(\'molecules\',\'' + esc(a.cip) + '\')">' + esc(cap((a.d || '').toLowerCase())) +
                  (a.ip > 0 ? '<span class="inf-alt-p mono">' + eur(a.ip) + (a.remise > 0 ? ' · -' + Math.round(a.remise) + '%' : '') + '</span>' : '') + '</a>';
              }).join('');
              return '<div class="inf-opp-row"><div class="inf-opp-rupt">' + ICO('alert', 13) + ' <b>' + esc(cap(o.r.dci)) + '</b> en tension <small>· ' + esc(o.r.titre.slice(0, 60)) + '</small></div>' +
                '<div class="inf-alts">' + alts + '</div></div>';
            }).join('') +
          '</div>';
        }
      }

      // ── Veille par catégorie ──
      var sections = '';
      ['ruptures', 'reglementaire', 'securite', 'profession'].forEach(function (k) {
        var list = items.filter(function (i) { return i.cat === k; });
        if (!list.length) return;
        var c = CAT[k] || { label: k, color: 'var(--muted)', ico: 'spark' };
        var rows = list.map(function (i) {
          var url = i.url ? ' href="' + esc(i.url) + '" target="_blank" rel="noopener"' : '';
          return '<a class="inf-item' + (i.today ? ' inf-item--today' : '') + '"' + url + '>' +
            '<span class="inf-item-dot" style="background:' + c.color + '"></span>' +
            '<span class="inf-item-tx">' + esc(i.titre) + (i.today ? ' <span class="inf-today">aujourd\'hui</span>' : '') +
              '<small>' + esc(i.source || '') + (frDate(i.date) ? ' · ' + frDate(i.date) : '') + '</small></span>' +
            (i.url ? '<span class="inf-item-go">' + ICO('chev', 15) + '</span>' : '') +
          '</a>';
        }).join('');
        sections += '<div class="inf-card"><div class="inf-card-h" style="color:' + c.color + '">' + ICO(c.ico, 16) + ' ' + c.label +
          '<span class="inf-card-n mono">' + list.length + '</span></div>' + rows + '</div>';
      });

      var body;
      if (!DATA || !items.length) {
        // Fallback : jamais d'écran vide
        body = '<div class="inf-card"><div class="inf-empty">' +
          (FAILED ? 'La veille du jour n\'a pas pu être chargée (connexion ?). Réessaie plus tard — le brief se met à jour chaque matin.'
                  : 'Pas encore d\'infos pour aujourd\'hui. Le brief se met à jour chaque matin.') +
          '</div></div>';
      } else {
        body = oppHtml + '<div class="inf-grid2">' + sections + '</div>';
      }

      var maj = (DATA && DATA.generated_at) ? frDate(DATA.generated_at) : '';
      root.innerHTML = topbar +
        '<div class="v2-wrap narrow" style="--accent:var(--c-amber)">' +
          '<div class="inf-hero">' +
            '<span class="inf-eyebrow">' + ICO('spark', 15) + ' ' + cap(dayLabel()) + '</span>' +
            '<h1>Bonjour ' + esc(firstName) + ', ta veille du matin</h1>' +
            '<p>Ruptures, sécurité, réglementaire et actu officine — les 7 derniers jours, focus sur aujourd\'hui.</p>' +
            ((DATA && DATA.count) ? '<div class="inf-count"><b>' + (DATA.count_today || 0) + '</b> aujourd\'hui · ' + DATA.count + ' sur 7 jours</div>' : '') +
          '</div>' +
          body +
          '<div class="inf-foot">Sources : ANSM (ruptures · sécurité · actualités) &amp; Le Moniteur des pharmacies' + (maj ? ' · mis à jour le ' + maj : '') + '. Mis à jour chaque matin, automatiquement.</div>' +
        '</div>';
    }
  };

  if (!document.getElementById('v2-infos-css')) {
    var st = document.createElement('style'); st.id = 'v2-infos-css';
    st.textContent =
      '.inf-hero{margin:8px 0 18px}' +
      '.inf-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.02em;color:var(--c-amber);text-transform:capitalize}' +
      '.inf-hero h1{font-size:25px;font-weight:900;letter-spacing:-.025em;margin:8px 0 4px;line-height:1.1}' +
      '.inf-hero p{font-size:14px;color:var(--muted);font-weight:500;max-width:580px}' +
      '.inf-count{margin-top:9px;font-size:12.5px;color:var(--muted);font-weight:600}.inf-count b{color:var(--c-amber);font-family:var(--mono)}' +
      '.inf-today{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--c-amber);background:color-mix(in srgb,var(--c-amber) 15%,transparent);border-radius:var(--r-pill);padding:1px 7px;vertical-align:middle;margin-left:4px}' +
      '.inf-item--today{background:color-mix(in srgb,var(--c-amber) 4%,transparent)}' +
      '.inf-opp{background:linear-gradient(150deg,#0050E6,#0034A0);color:#fff;border-radius:var(--r-card);padding:18px 20px;margin-bottom:18px;box-shadow:var(--sh-2)}' +
      '.inf-opp-h{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;letter-spacing:.01em;margin-bottom:12px}' +
      '.inf-opp-row{padding:10px 0;border-top:1px solid rgba(255,255,255,.16)}' +
      '.inf-opp-row:first-of-type{border-top:none}' +
      '.inf-opp-rupt{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
      '.inf-opp-rupt small{opacity:.7;font-weight:500}' +
      '.inf-alts{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}' +
      '.inf-alt{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.14);border-radius:var(--r-pill);padding:6px 12px;font-size:12.5px;font-weight:700;color:#fff;cursor:pointer;text-decoration:none}' +
      '.inf-alt:hover{background:rgba(255,255,255,.26)}' +
      '.inf-alt-p{opacity:.85;font-weight:600}' +
      '.inf-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}' +
      '@media(max-width:720px){.inf-grid2{grid-template-columns:1fr}}' +
      '.inf-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);overflow:hidden}' +
      '.inf-card-h{display:flex;align-items:center;gap:8px;padding:13px 16px;font-size:13.5px;font-weight:800;border-bottom:1px solid var(--line)}' +
      '.inf-card-n{margin-left:auto;font-size:12px;font-weight:700;color:var(--muted);background:var(--surf-sunken);border-radius:var(--r-pill);padding:1px 9px}' +
      '.inf-item{display:flex;align-items:center;gap:11px;padding:11px 16px;border-bottom:1px solid var(--line-2,var(--line));text-decoration:none;color:inherit}' +
      '.inf-item:last-child{border-bottom:none}.inf-item:hover{background:var(--card-2)}' +
      '.inf-item-dot{width:8px;height:8px;border-radius:50%;flex:none;margin-top:5px;align-self:flex-start}' +
      '.inf-item-tx{flex:1;min-width:0;font-size:13px;font-weight:700;line-height:1.3}' +
      '.inf-item-tx small{display:block;font-weight:500;color:var(--muted);font-size:11px;margin-top:2px}' +
      '.inf-item-go{flex:none;color:var(--muted-2)}' +
      '.inf-empty{padding:30px 18px;text-align:center;color:var(--muted);font-size:13.5px}' +
      '.inf-foot{margin-top:16px;font-size:11.5px;color:var(--muted);text-align:center}';
    document.head.appendChild(st);
  }
})();

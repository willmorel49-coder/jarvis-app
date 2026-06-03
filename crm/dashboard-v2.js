// dashboard-v2.js — Dashboard CRM Intégral Pharma · refonte iOS Inset Grouped.
// 5 blocs : Hero CA · 3 KPIs secondaires · Top 5 clients · Évolution mensuelle · Alertes.
// Override de window.renderDashboard. Vanilla JS, IIFE, aucun build.

(function () {
  // ───────── Helpers locaux ────────────────────────────────────────────────
  function fmtEuro(n) {
    if (!n || isNaN(n)) return '0 €';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
    if (abs >= 1000) return `${Math.round(n / 1000)} k€`;
    return `${Math.round(n)} €`;
  }
  function fmtEuroPrecis(n) {
    if (!n || isNaN(n)) return '0 €';
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €';
  }
  function fmtNum(n) { return Number(n || 0).toLocaleString('fr-FR'); }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function pct(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(1)} %`;
  }

  // Palette
  const COLOR = {
    bg: '#F2F2F7',
    card: '#FFFFFF',
    text: '#0B1F4D',
    label: '#8E8E93',
    accent: '#0057FF',
    up: '#34C759',
    down: '#FF3B30',
    hairline: 'rgba(60,60,67,0.18)',
    shadow: '0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)',
  };

  const MONTH_LABELS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  function labelMonth(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y.slice(2)}`;
  }

  // ───────── Calculs métier ────────────────────────────────────────────────
  function computeContext() {
    const salesTotal = window.SALES_TOTAL || {};
    const salesByMonth = window.SALES_BY_MONTH || {};
    const salesByFamille = window.SALES_BY_FAMILLE || {};
    const salesByClientMonth = window.SALES_BY_CLIENT_MONTH || {};
    const clients = window.CLIENTS || [];
    const opsAgg = window.OPS_AGGREGATE || {};

    const months = Object.keys(salesByMonth).sort();
    const monthSeries = months.map(m => ({
      key: m,
      label: labelMonth(m),
      ca: salesByMonth[m].ca || 0,
      marge: salesByMonth[m].marge || 0,
      qte: salesByMonth[m].qte || 0,
      lignes: salesByMonth[m].lignes || 0,
    }));

    const lastMonth = monthSeries[monthSeries.length - 1] || null;
    const prevMonth = monthSeries[monthSeries.length - 2] || null;
    const variationMois = lastMonth && prevMonth && prevMonth.ca > 0
      ? ((lastMonth.ca - prevMonth.ca) / prevMonth.ca) * 100
      : null;

    // Index clients par CIP pour résoudre nom/ville
    const clientByCip = {};
    for (const c of clients) {
      if (c.cip) clientByCip[String(c.cip)] = c;
    }

    // Top 5 clients du dernier mois (avec variation vs mois précédent)
    const topClients = [];
    if (lastMonth) {
      const lastKey = lastMonth.key;
      const prevKey = prevMonth ? prevMonth.key : null;
      for (const [cip, byMonth] of Object.entries(salesByClientMonth)) {
        const caMois = (byMonth[lastKey] && byMonth[lastKey].ca) || 0;
        if (caMois <= 0) continue;
        const caPrev = (prevKey && byMonth[prevKey] && byMonth[prevKey].ca) || 0;
        const variation = caPrev > 0 ? ((caMois - caPrev) / caPrev) * 100 : null;
        const client = clientByCip[String(cip)];
        topClients.push({
          cip,
          nom: client ? client.nom : `CIP ${cip}`,
          ville: client ? (client.ville || '') : '',
          caMois,
          variation,
        });
      }
      topClients.sort((a, b) => b.caMois - a.caMois);
    }

    // Alertes
    const alerts = computeAlerts({ clients, salesByClientMonth, lastMonth, salesByFamille, opsAgg });

    return {
      salesTotal,
      monthSeries,
      lastMonth,
      prevMonth,
      variationMois,
      topClients: topClients.slice(0, 5),
      alerts,
      nbPharmasActives: salesTotal.nb_pharmas_actives || 0,
      nbPharmasTotal: clients.length,
    };
  }

  function computeAlerts({ clients, salesByClientMonth, lastMonth, salesByFamille, opsAgg }) {
    const alerts = [];

    // 1) Pharmacies silencieuses >30j (aucun CA sur le dernier mois alors qu'elles avaient du CA avant)
    if (lastMonth) {
      const lastKey = lastMonth.key;
      let silencieuses = 0;
      for (const [cip, byMonth] of Object.entries(salesByClientMonth)) {
        const totalHist = Object.values(byMonth).reduce((s, m) => s + (m.ca || 0), 0);
        const caLast = (byMonth[lastKey] && byMonth[lastKey].ca) || 0;
        if (totalHist > 0 && caLast === 0) silencieuses++;
      }
      if (silencieuses > 0) {
        alerts.push({
          type: 'silence',
          label: 'Pharmacies silencieuses ce mois-ci',
          value: silencieuses,
          tone: silencieuses > 20 ? 'down' : 'neutral',
        });
      }
    }

    // 2) Famille sous-indexée vs OPS : compare la part de famille IP vs part famille OPS
    // (heuristique : on calcule la pire sous-indexation en pts)
    const familleParts = {};
    let totalCa = 0;
    for (const [f, d] of Object.entries(salesByFamille || {})) {
      familleParts[f] = d.ca || 0;
      totalCa += d.ca || 0;
    }
    if (totalCa > 0 && opsAgg && Object.keys(opsAgg).length) {
      // Agrégation OPS par "nature" (proxy famille)
      const opsByFamille = {};
      let opsTotal = 0;
      for (const p of Object.values(opsAgg)) {
        const nat = (p.nature || p.famille || 'Autre').trim() || 'Autre';
        opsByFamille[nat] = (opsByFamille[nat] || 0) + (p.ca || 0);
        opsTotal += p.ca || 0;
      }
      if (opsTotal > 0) {
        let pire = null;
        for (const f of Object.keys(familleParts)) {
          const partMoi = (familleParts[f] / totalCa) * 100;
          const partOps = ((opsByFamille[f] || 0) / opsTotal) * 100;
          const ecart = partOps - partMoi;
          if (ecart > 0 && (!pire || ecart > pire.ecart)) {
            pire = { famille: f, ecart };
          }
        }
        if (pire) {
          alerts.push({
            type: 'famille',
            label: `Famille sous-indexée : ${pire.famille}`,
            value: `-${pire.ecart.toFixed(1)} pts vs OPS`,
            tone: 'down',
          });
        }
      }
    }

    // 3) Top produits OPS absents de mon catalogue de ventes
    if (opsAgg && Object.keys(opsAgg).length) {
      const salesProd = window.SALES_BY_PRODUCT || {};
      let absents = 0;
      // top 50 OPS par CA
      const topOps = Object.entries(opsAgg)
        .sort((a, b) => (b[1].ca || 0) - (a[1].ca || 0))
        .slice(0, 50);
      for (const [code] of topOps) {
        if (!salesProd[code]) absents++;
      }
      if (absents > 0) {
        alerts.push({
          type: 'absents',
          label: 'Top produits OPS absents',
          value: `${absents} / 50`,
          tone: absents > 20 ? 'down' : 'neutral',
        });
      }
    }

    return alerts;
  }

  // ───────── Sparkline SVG ─────────────────────────────────────────────────
  function sparkline(values, width, height, color) {
    if (!values || !values.length) return '';
    const w = width || 600;
    const h = height || 40;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const stepX = w / Math.max(values.length - 1, 1);
    const pts = values.map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const path = `M ${pts.join(' L ')}`;
    const area = `${path} L ${w},${h} L 0,${h} Z`;
    const c = color || COLOR.accent;
    return `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${c}" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#sparkGrad)"/>
        <path d="${path}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  // ───────── Bars chart 8 mois ─────────────────────────────────────────────
  function monthlyBars(series) {
    if (!series || !series.length) return '';
    const max = Math.max(...series.map(s => s.ca), 1);
    return `
      <div class="dash-bars" style="display:grid;grid-template-columns:repeat(${series.length},1fr);gap:6px;align-items:end;height:80px">
        ${series.map(s => {
          const h = Math.max((s.ca / max) * 100, 4);
          return `
            <div class="dash-bar-col" data-label="${escapeHtml(s.label)}" data-value="${fmtEuroPrecis(s.ca)}" style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:default;height:100%;justify-content:flex-end">
              <div style="width:100%;height:${h}%;background:${COLOR.accent};border-radius:4px 4px 0 0;opacity:0.85;transition:opacity .12s"></div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(${series.length},1fr);gap:6px;margin-top:6px">
        ${series.map(s => `<div style="font-size:10px;color:${COLOR.label};text-align:center;letter-spacing:0.4px;text-transform:uppercase;font-weight:600">${escapeHtml(s.label)}</div>`).join('')}
      </div>
    `;
  }

  // ───────── Composants ────────────────────────────────────────────────────
  function card(innerHtml, extraStyle) {
    return `
      <div style="background:${COLOR.card};border-radius:14px;padding:18px 20px;box-shadow:${COLOR.shadow};${extraStyle || ''}">
        ${innerHtml}
      </div>
    `;
  }

  function variationBadge(variation) {
    if (variation === null || variation === undefined) {
      return `<span style="font-size:13px;color:${COLOR.label};font-weight:600">—</span>`;
    }
    const isUp = variation >= 0;
    const color = isUp ? COLOR.up : COLOR.down;
    const arrow = isUp ? '&#9650;' : '&#9660;';
    return `<span style="font-size:13px;color:${color};font-weight:700;font-variant-numeric:tabular-nums">${arrow} ${pct(variation).replace(/^[+-]/, '')}</span>`;
  }

  function blockHero(ctx) {
    const { salesTotal, monthSeries, lastMonth, variationMois } = ctx;
    const caTotal = salesTotal.ca || 0;
    const periode = (salesTotal.premiere_date && salesTotal.derniere_date)
      ? `${salesTotal.premiere_date} → ${salesTotal.derniere_date}`
      : '—';
    const values = monthSeries.map(s => s.ca);
    return card(`
      <div style="font-size:10px;letter-spacing:0.8px;text-transform:uppercase;color:${COLOR.label};font-weight:700">Mon CA cumulé</div>
      <div style="font-size:44px;font-weight:800;color:${COLOR.text};font-variant-numeric:tabular-nums;letter-spacing:-1px;margin:6px 0 4px;line-height:1.05">${fmtEuroPrecis(caTotal)}</div>
      <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:${COLOR.label};flex-wrap:wrap">
        <span>${escapeHtml(periode)}</span>
        ${lastMonth ? `<span style="width:3px;height:3px;border-radius:50%;background:${COLOR.label};display:inline-block"></span><span>${escapeHtml(lastMonth.label)}</span><span>${variationBadge(variationMois)}</span>` : ''}
      </div>
      <div style="margin-top:14px;margin-left:-4px;margin-right:-4px">${sparkline(values, 600, 40, COLOR.accent)}</div>
    `);
  }

  function blockSecondaryKpis(ctx) {
    const { lastMonth, variationMois, nbPharmasActives, nbPharmasTotal, salesTotal } = ctx;
    const kpis = [
      {
        label: 'Mois en cours',
        value: lastMonth ? fmtEuro(lastMonth.ca) : '—',
        sub: variationMois !== null ? variationBadge(variationMois) : `<span style="font-size:13px;color:${COLOR.label}">vs n-1</span>`,
      },
      {
        label: 'Pharmas actives',
        value: fmtNum(nbPharmasActives),
        sub: `<span style="font-size:13px;color:${COLOR.label}">sur ${fmtNum(nbPharmasTotal)} secteur</span>`,
      },
      {
        label: 'Factures période',
        value: fmtNum(salesTotal.factures || 0),
        sub: `<span style="font-size:13px;color:${COLOR.label}">${fmtNum(salesTotal.lignes || 0)} lignes</span>`,
      },
    ];
    return `
      <div class="dash-grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        ${kpis.map(k => card(`
          <div style="font-size:10px;letter-spacing:0.8px;text-transform:uppercase;color:${COLOR.label};font-weight:700">${escapeHtml(k.label)}</div>
          <div style="font-size:24px;font-weight:800;color:${COLOR.text};font-variant-numeric:tabular-nums;letter-spacing:-0.5px;margin:6px 0 4px">${k.value}</div>
          <div>${k.sub}</div>
        `)).join('')}
      </div>
    `;
  }

  function blockTopClients(ctx) {
    const { topClients, lastMonth } = ctx;
    const head = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px">
        <div style="font-size:10px;letter-spacing:0.8px;text-transform:uppercase;color:${COLOR.label};font-weight:700">Top 5 pharmas · ${lastMonth ? escapeHtml(lastMonth.label) : ''}</div>
        <div style="font-size:11px;color:${COLOR.label}">CA mois · variation vs n-1</div>
      </div>
    `;
    if (!topClients.length) {
      return card(`${head}<div style="padding:18px 0;text-align:center;color:${COLOR.label};font-size:13px">Aucune vente sur le mois</div>`);
    }
    const rows = topClients.map((c, i) => `
      <div data-cip="${escapeHtml(c.cip)}" onclick="console.log('[dashboard] click client', '${escapeHtml(c.cip)}')" style="display:grid;grid-template-columns:24px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:0.5px solid ${COLOR.hairline};cursor:pointer">
        <span style="font-size:13px;color:${COLOR.label};font-weight:700;font-variant-numeric:tabular-nums">${i + 1}</span>
        <div style="min-width:0">
          <div style="font-size:14px;font-weight:600;color:${COLOR.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.nom)}</div>
          <div style="font-size:12px;color:${COLOR.label};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.ville || '—')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700;color:${COLOR.text};font-variant-numeric:tabular-nums">${fmtEuro(c.caMois)}</div>
          <div>${variationBadge(c.variation)}</div>
        </div>
      </div>
    `).join('');
    // Retire la dernière hairline
    return card(`
      ${head}
      <div class="dash-top-clients">
        ${rows}
      </div>
      <style>.dash-top-clients > *:last-child{border-bottom:none !important;padding-bottom:2px !important}</style>
    `);
  }

  function blockMonthly(ctx) {
    const { monthSeries } = ctx;
    if (!monthSeries.length) return '';
    const total = monthSeries.reduce((s, m) => s + m.ca, 0);
    const avg = total / monthSeries.length;
    return card(`
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px">
        <div style="font-size:10px;letter-spacing:0.8px;text-transform:uppercase;color:${COLOR.label};font-weight:700">Évolution mensuelle</div>
        <div style="font-size:11px;color:${COLOR.label};font-variant-numeric:tabular-nums">moy. ${fmtEuro(avg)} / mois</div>
      </div>
      ${monthlyBars(monthSeries)}
      <div id="dash-bars-tooltip" style="margin-top:10px;font-size:12px;color:${COLOR.label};font-variant-numeric:tabular-nums;min-height:16px">Passe sur une barre pour le détail</div>
    `);
  }

  function blockAlerts(ctx) {
    const { alerts } = ctx;
    const head = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px">
        <div style="font-size:10px;letter-spacing:0.8px;text-transform:uppercase;color:${COLOR.label};font-weight:700">Alertes du jour</div>
        <div style="font-size:11px;color:${COLOR.label}">${alerts.length} signal${alerts.length > 1 ? 'aux' : ''}</div>
      </div>
    `;
    if (!alerts.length) {
      return card(`${head}<div style="padding:18px 0;text-align:center;color:${COLOR.label};font-size:13px">Aucune alerte active</div>`);
    }
    const shown = alerts.slice(0, 5);
    const extra = alerts.length - shown.length;
    const rows = shown.map(a => {
      const dot = a.tone === 'down' ? COLOR.down : a.tone === 'up' ? COLOR.up : COLOR.accent;
      return `
        <div onclick="console.log('[dashboard] click alert', '${escapeHtml(a.type)}')" style="display:grid;grid-template-columns:8px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:0.5px solid ${COLOR.hairline};cursor:pointer">
          <span style="width:8px;height:8px;border-radius:50%;background:${dot};display:inline-block"></span>
          <div style="font-size:14px;color:${COLOR.text};font-weight:500">${escapeHtml(a.label)}</div>
          <div style="font-size:13px;color:${COLOR.text};font-weight:700;font-variant-numeric:tabular-nums">${typeof a.value === 'number' ? fmtNum(a.value) : escapeHtml(a.value)}</div>
        </div>
      `;
    }).join('');
    const more = extra > 0
      ? `<div style="padding:12px 0 2px;font-size:13px;color:${COLOR.accent};font-weight:600;cursor:pointer" onclick="console.log('[dashboard] voir toutes les alertes')">+${extra} autre${extra > 1 ? 's' : ''} alerte${extra > 1 ? 's' : ''}</div>`
      : '';
    return card(`
      ${head}
      <div class="dash-alerts">${rows}</div>
      ${more}
      <style>.dash-alerts > *:last-child{border-bottom:none !important}</style>
    `);
  }

  // ───────── Render principal ──────────────────────────────────────────────
  function renderDashboardV2() {
    const root = document.getElementById('dash-content');
    if (!root) return;
    const ctx = computeContext();

    root.innerHTML = `
      <div class="dash-root" style="font-family:'DM Sans','SF Pro Display',-apple-system,sans-serif;color:${COLOR.text};padding:16px 16px 90px;max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:16px">
        ${blockHero(ctx)}
        ${blockSecondaryKpis(ctx)}
        ${blockTopClients(ctx)}
        ${blockMonthly(ctx)}
        ${blockAlerts(ctx)}
      </div>
      <style>
        @media (max-width: 600px) {
          .dash-root { padding: 12px 12px 90px !important; gap: 12px !important; }
          .dash-grid-3 { grid-template-columns: 1fr !important; gap: 12px !important; }
        }
        .dash-bar-col:hover > div { opacity: 1 !important; }
      </style>
    `;

    // Tooltips bars (interactif léger)
    const tip = document.getElementById('dash-bars-tooltip');
    const cols = root.querySelectorAll('.dash-bar-col');
    cols.forEach(col => {
      col.addEventListener('mouseenter', () => {
        const l = col.getAttribute('data-label');
        const v = col.getAttribute('data-value');
        if (tip) tip.textContent = `${l} · ${v}`;
      });
      col.addEventListener('mouseleave', () => {
        if (tip) tip.textContent = 'Passe sur une barre pour le détail';
      });
    });
  }

  // ───────── Override ──────────────────────────────────────────────────────
  function applyOverride() {
    if (typeof window.renderDashboard === 'function') {
      window.renderDashboard = renderDashboardV2;
      console.log('[dashboard-v2] override renderDashboard appliqué (refonte 5 blocs)');
    } else {
      setTimeout(applyOverride, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyOverride);
  } else {
    applyOverride();
  }
})();

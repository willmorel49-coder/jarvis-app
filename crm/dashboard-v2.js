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

  // Palette — iOS system colors + Intégral Pharma brand
  const COLOR = {
    bg: '#F2F2F7',
    card: '#FFFFFF',
    text: '#0B1F4D',
    textSecondary: 'rgba(60,60,67,0.60)',
    label: '#8E8E93',
    labelSubtle: 'rgba(60,60,67,0.30)',
    accent: '#0057FF',
    up: '#34C759',
    down: '#FF3B30',
    warn: '#FF9500',
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
    const h = height || 44;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const pad = 3;
    const stepX = w / Math.max(values.length - 1, 1);
    const pts = values.map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * (h - pad * 2) - pad;
      return { x, y };
    });
    const path = `M ${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;
    const area = `${path} L ${w},${h} L 0,${h} Z`;
    const c = color || COLOR.accent;
    const last = pts[pts.length - 1];
    return `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block;overflow:visible">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${c}" stop-opacity="0.20"/>
            <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#sparkGrad)"/>
        <path d="${path}" fill="none" stroke="${c}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2.5" fill="${c}"/>
      </svg>
    `;
  }

  // ───────── Bars chart 8 mois ─────────────────────────────────────────────
  function monthlyBars(series) {
    if (!series || !series.length) return '';
    const max = Math.max(...series.map(s => s.ca), 1);
    const lastIdx = series.length - 1;
    return `
      <div class="dash-bars" style="display:grid;grid-template-columns:repeat(${series.length},1fr);gap:8px;align-items:end;height:84px">
        ${series.map((s, i) => {
          const h = Math.max((s.ca / max) * 100, 4);
          const isLast = i === lastIdx;
          const bg = isLast ? COLOR.accent : 'rgba(0,87,255,0.32)';
          return `
            <div class="dash-bar-col" data-label="${escapeHtml(s.label)}" data-value="${fmtEuroPrecis(s.ca)}" style="display:flex;flex-direction:column;align-items:stretch;cursor:default;height:100%;justify-content:flex-end">
              <div class="dash-bar-fill" style="width:100%;height:${h}%;background:${bg};border-radius:3px 3px 0 0;transition:background-color .15s ease"></div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(${series.length},1fr);gap:8px;margin-top:8px">
        ${series.map((s, i) => {
          const isLast = i === lastIdx;
          const c = isLast ? COLOR.text : COLOR.label;
          const w = isLast ? 700 : 600;
          return `<div style="font-size:10px;color:${c};text-align:center;letter-spacing:0.4px;text-transform:uppercase;font-weight:${w};font-variant-numeric:tabular-nums">${escapeHtml(s.label)}</div>`;
        }).join('')}
      </div>
    `;
  }

  // ───────── Composants ────────────────────────────────────────────────────
  function card(innerHtml, extraStyle) {
    return `
      <div class="dash-card" style="background:${COLOR.card};border-radius:14px;padding:18px 20px;box-shadow:${COLOR.shadow};${extraStyle || ''}">
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
    return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:13px;color:${color};font-weight:700;font-variant-numeric:tabular-nums;line-height:1"><span style="font-size:9px">${arrow}</span>${pct(variation).replace(/^[+-]/, '')}</span>`;
  }

  function eyebrow(text) {
    return `<div style="font-size:11px;letter-spacing:0.6px;text-transform:uppercase;color:${COLOR.textSecondary};font-weight:600">${escapeHtml(text)}</div>`;
  }

  function blockHero(ctx) {
    const { salesTotal, monthSeries, lastMonth, variationMois } = ctx;
    const caTotal = salesTotal.ca || 0;
    const periode = (salesTotal.premiere_date && salesTotal.derniere_date)
      ? `${salesTotal.premiere_date} → ${salesTotal.derniere_date}`
      : '—';
    const values = monthSeries.map(s => s.ca);
    return card(`
      ${eyebrow('Mon CA cumulé')}
      <div class="dash-hero-value" style="font-size:48px;font-weight:800;color:${COLOR.text};font-variant-numeric:tabular-nums;letter-spacing:-1.4px;margin:8px 0 6px;line-height:1.02">${fmtEuroPrecis(caTotal)}</div>
      <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:${COLOR.label};flex-wrap:wrap;font-variant-numeric:tabular-nums">
        <span>${escapeHtml(periode)}</span>
        ${lastMonth ? `<span style="width:3px;height:3px;border-radius:50%;background:${COLOR.labelSubtle};display:inline-block;flex-shrink:0"></span><span style="color:${COLOR.text};font-weight:500">${escapeHtml(lastMonth.label)}</span>${variationBadge(variationMois)}` : ''}
      </div>
      <div style="margin-top:16px;margin-left:-4px;margin-right:-4px">${sparkline(values, 600, 44, COLOR.accent)}</div>
    `, 'padding:20px 22px');
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
      <div class="dash-grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${kpis.map(k => card(`
          ${eyebrow(k.label)}
          <div style="font-size:26px;font-weight:800;color:${COLOR.text};font-variant-numeric:tabular-nums;letter-spacing:-0.6px;margin:8px 0 4px;line-height:1.1">${k.value}</div>
          <div style="line-height:1.3">${k.sub}</div>
        `)).join('')}
      </div>
    `;
  }

  function blockTopClients(ctx) {
    const { topClients, lastMonth } = ctx;
    const head = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;gap:12px">
        ${eyebrow(`Top 5 pharmas${lastMonth ? ' · ' + lastMonth.label : ''}`)}
        <div style="font-size:11px;color:${COLOR.label};font-weight:500;white-space:nowrap">CA · vs n-1</div>
      </div>
    `;
    if (!topClients.length) {
      return card(`${head}<div style="padding:20px 0;text-align:center;color:${COLOR.label};font-size:13px">Aucune vente sur le mois</div>`);
    }
    const rows = topClients.map((c, i) => `
      <div class="dash-row" data-cip="${escapeHtml(c.cip)}" onclick="console.log('[dashboard] click client', '${escapeHtml(c.cip)}')" style="display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:14px;align-items:center;padding:12px 0;border-bottom:0.5px solid ${COLOR.hairline};cursor:pointer;border-radius:6px;margin:0 -6px;padding-left:6px;padding-right:6px">
        <span style="font-size:13px;color:${COLOR.label};font-weight:700;font-variant-numeric:tabular-nums;text-align:center">${i + 1}</span>
        <div style="min-width:0">
          <div title="${escapeHtml(c.nom)}" style="font-size:14px;font-weight:600;color:${COLOR.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3">${escapeHtml(c.nom)}</div>
          <div style="font-size:12px;color:${COLOR.label};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;margin-top:1px">${escapeHtml(c.ville || '—')}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:14px;font-weight:700;color:${COLOR.text};font-variant-numeric:tabular-nums;line-height:1.3">${fmtEuro(c.caMois)}</div>
          <div style="line-height:1.3;margin-top:1px">${variationBadge(c.variation)}</div>
        </div>
      </div>
    `).join('');
    // Retire la dernière hairline
    return card(`
      ${head}
      <div class="dash-top-clients">
        ${rows}
      </div>
    `);
  }

  function blockMonthly(ctx) {
    const { monthSeries } = ctx;
    if (!monthSeries.length) return '';
    const total = monthSeries.reduce((s, m) => s + m.ca, 0);
    const avg = total / monthSeries.length;
    return card(`
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;gap:12px">
        ${eyebrow('Évolution mensuelle')}
        <div style="font-size:11px;color:${COLOR.label};font-variant-numeric:tabular-nums;font-weight:500;white-space:nowrap">moy. ${fmtEuro(avg)} / mois</div>
      </div>
      ${monthlyBars(monthSeries)}
      <div id="dash-bars-tooltip" style="margin-top:12px;font-size:12px;color:${COLOR.label};font-variant-numeric:tabular-nums;min-height:16px;font-weight:500">Passe sur une barre pour le détail</div>
    `);
  }

  function blockAlerts(ctx) {
    const { alerts } = ctx;
    const head = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;gap:12px">
        ${eyebrow('Alertes du jour')}
        <div style="font-size:11px;color:${COLOR.label};font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums">${alerts.length} signal${alerts.length > 1 ? 'aux' : ''}</div>
      </div>
    `;
    if (!alerts.length) {
      return card(`${head}<div style="padding:20px 0;text-align:center;color:${COLOR.label};font-size:13px">Aucune alerte active</div>`);
    }
    const shown = alerts.slice(0, 5);
    const extra = alerts.length - shown.length;
    const rows = shown.map(a => {
      const dot = a.tone === 'down' ? COLOR.down : a.tone === 'up' ? COLOR.up : COLOR.warn;
      return `
        <div class="dash-row" onclick="console.log('[dashboard] click alert', '${escapeHtml(a.type)}')" style="display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:14px;align-items:center;padding:12px 0;border-bottom:0.5px solid ${COLOR.hairline};cursor:pointer;border-radius:6px;margin:0 -6px;padding-left:6px;padding-right:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${dot};display:inline-block;box-shadow:0 0 0 3px ${dot}1A"></span>
          <div style="font-size:14px;color:${COLOR.text};font-weight:500;line-height:1.35;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(a.label)}</div>
          <div style="font-size:13px;color:${COLOR.text};font-weight:700;font-variant-numeric:tabular-nums;flex-shrink:0">${typeof a.value === 'number' ? fmtNum(a.value) : escapeHtml(a.value)}</div>
        </div>
      `;
    }).join('');
    const more = extra > 0
      ? `<div style="padding:14px 0 2px;font-size:13px;color:${COLOR.accent};font-weight:600;cursor:pointer" onclick="console.log('[dashboard] voir toutes les alertes')">+${extra} autre${extra > 1 ? 's' : ''} alerte${extra > 1 ? 's' : ''}</div>`
      : '';
    return card(`
      ${head}
      <div class="dash-alerts">${rows}</div>
      ${more}
    `);
  }

  // ───────── Render principal ──────────────────────────────────────────────
  function renderDashboardV2() {
    const root = document.getElementById('dash-content');
    if (!root) return;
    const ctx = computeContext();

    root.innerHTML = `
      <div class="dash-root" style="font-family:'DM Sans','SF Pro Display',-apple-system,sans-serif;color:${COLOR.text};padding:16px 16px 90px;max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:14px">
        ${blockHero(ctx)}
        ${blockSecondaryKpis(ctx)}
        ${blockTopClients(ctx)}
        ${blockMonthly(ctx)}
        ${blockAlerts(ctx)}
      </div>
      <style>
        .dash-root .dash-row { transition: background-color 120ms ease; }
        @media (hover: hover) and (pointer: fine) {
          .dash-root .dash-row:hover { background-color: rgba(60,60,67,0.04); }
        }
        .dash-root .dash-row:active { background-color: rgba(60,60,67,0.08); }
        .dash-root .dash-bar-col:hover .dash-bar-fill { background: ${COLOR.accent} !important; }
        .dash-root .dash-top-clients > .dash-row:last-child,
        .dash-root .dash-alerts > .dash-row:last-child { border-bottom: none !important; }
        @media (max-width: 600px) {
          .dash-root { padding: 12px 12px 90px !important; gap: 12px !important; }
          .dash-root .dash-card { border-radius: 12px !important; padding: 16px 16px !important; }
          .dash-root .dash-hero-value { font-size: 38px !important; letter-spacing: -1.1px !important; }
          .dash-grid-3 { grid-template-columns: 1fr !important; gap: 10px !important; }
        }
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

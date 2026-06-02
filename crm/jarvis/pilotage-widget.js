// JARVIS · pilotage-widget.js
// Widget pilotage accueil — vue ultra-compacte affichée en surimpression
// sur la carte JARVIS dès le load (style Apple Health "Summary").
//
// Coexiste avec lens-pilotage.js (mode plein écran intact) :
//  - Le widget = surface dérivée des mêmes données (window.SALES_BY_MONTH,
//    SALES_BY_CLIENT_MONTH, CLIENTS, OPS_AGGREGATE).
//  - Click sur "Détail complet" ou tap sur la card → openLens('pilotage').
//
// API exposée :
//   renderPilotageWidget(opts)   → HTMLElement prêt à append
//   showPilotageWidget(parentEl) → mount + animation d'entrée + persistance
//   dismissPilotageWidget()      → ferme + persiste dans localStorage
//   isPilotageWidgetDismissed()  → bool

import { openLens } from './lens.js';

const STORAGE_KEY = 'jarvis.pilotageWidget.dismissed';
const DEFAULT_OBJECTIF_MENSUEL = 200_000;

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatEuroShort(n) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '0 €';
  const num = Number(n);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} M€`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)} k€`;
  return `${sign}${abs.toFixed(0)} €`;
}

function formatPercent(n, withSign = false) {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  const num = Number(n);
  const sign = withSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function formatDateTodayFr() {
  const d = new Date();
  const noms = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d.getDate()} ${noms[d.getMonth()]}`;
}

// ─── Data crunching ────────────────────────────────────────────────────────

function getSortedMonthKeys() {
  const sm = window.SALES_BY_MONTH || {};
  return Object.keys(sm).sort();
}

function computeCaMonth() {
  const sm = window.SALES_BY_MONTH || {};
  const months = getSortedMonthKeys();
  if (!months.length) {
    return { current: null, currentKey: null, previous: null, previousKey: null, variationPct: null };
  }
  const currentKey = months[months.length - 1];
  const previousKey = months.length > 1 ? months[months.length - 2] : null;
  const current = Number(sm[currentKey]?.ca || 0);
  const previous = previousKey ? Number(sm[previousKey]?.ca || 0) : null;
  const variationPct =
    previous && previous > 0 ? ((current - previous) / previous) * 100 : null;
  return { current, currentKey, previous, previousKey, variationPct };
}

function computeObjectifPct(currentCa, objectif = DEFAULT_OBJECTIF_MENSUEL) {
  if (!objectif || objectif <= 0) return null;
  return Math.max(0, Math.round((currentCa / objectif) * 100));
}

function computeTopClientThisMonth(currentKey) {
  if (!currentKey) return null;
  const byClient = window.SALES_BY_CLIENT_MONTH || {};
  const clients = window.CLIENTS || [];
  const cipToNom = new Map();
  for (const c of clients) cipToNom.set(String(c.cip), c.nom || '—');

  let best = null;
  for (const [cip, byMonth] of Object.entries(byClient)) {
    const row = byMonth?.[currentKey];
    if (!row) continue;
    const ca = Number(row.ca || 0);
    if (ca <= 0) continue;
    if (!best || ca > best.ca) {
      best = { cip, ca, nom: cipToNom.get(String(cip)) || `CIP ${cip}` };
    }
  }
  return best;
}

function lastSaleDateForClient(cip) {
  const detail = window.SALES_BY_CLIENT_DETAIL?.[cip];
  if (!Array.isArray(detail) || !detail.length) return null;
  let latest = null;
  for (const line of detail) {
    const raw = line.date || line.dt || line.facture_date || null;
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    if (!latest || d > latest) latest = d;
  }
  return latest;
}

function computeAlerts() {
  const alerts = [];
  const clients = window.CLIENTS || [];
  const byClient = window.SALES_BY_CLIENT_MONTH || {};

  // Alerte 1 : pharmacies actives en silence depuis 30+ jours
  const now = new Date();
  const silenceCandidates = [];
  for (const c of clients) {
    const ca = Number(c.ca2023 || 0);
    if (ca <= 0) continue;
    const last = lastSaleDateForClient(c.cip);
    if (!last) continue;
    const days = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    if (days >= 30) {
      silenceCandidates.push({ nom: c.nom || '—', cip: c.cip, days, ca });
    }
  }
  silenceCandidates.sort((a, b) => b.ca - a.ca);
  for (const s of silenceCandidates.slice(0, 2)) {
    alerts.push({
      tone: 'orange',
      icon: 'silence',
      label: `${s.nom} silencieuse ${s.days}j`,
      action: 'pharma',
      cip: s.cip,
    });
  }

  // Alerte 2 : famille sous-indexée vs OPS (manque à gagner > 20k€)
  const myFam = window.SALES_BY_FAMILLE || {};
  const opsLabo = window.OPS_BY_LABO || {};
  // Heuristique simple : si une famille OPS pèse >X et qu'on est <20% du même labo,
  // on signale le manque à gagner.
  const mySumFam = Object.values(myFam).reduce((s, f) => s + Number(f.ca || 0), 0);
  const opsSumLabo = Object.values(opsLabo).reduce((s, l) => s + Number(l.ca || 0), 0);
  if (mySumFam > 0 && opsSumLabo > 0) {
    const topOpsLabos = Object.entries(opsLabo)
      .map(([labo, d]) => ({ labo, ca: Number(d.ca || 0) }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5);
    for (const top of topOpsLabos) {
      const partOps = top.ca / opsSumLabo;
      const myFamMatch = myFam[top.labo]?.ca || 0;
      const myPart = mySumFam > 0 ? myFamMatch / mySumFam : 0;
      const gap = (partOps - myPart) * mySumFam;
      if (gap > 20_000) {
        alerts.push({
          tone: 'blue',
          icon: 'famille',
          label: `${top.labo} sous-indexée · ~${formatEuroShort(gap)} à reprendre`,
          action: 'lens',
          lens: 'pilotage',
        });
        break; // une seule alerte famille
      }
    }
  }

  // Alerte 3 : top produits OPS absents du portefeuille
  const opsAgg = window.OPS_AGGREGATE || {};
  if (Object.keys(opsAgg).length > 0) {
    const portefeuilleArtcodes = new Set();
    const cp = window.CLIENT_PRODUCTS || {};
    for (const prods of Object.values(cp)) {
      if (!Array.isArray(prods)) continue;
      for (const p of prods) {
        if (p.artcode) portefeuilleArtcodes.add(String(p.artcode));
      }
    }
    const opsTop = Object.entries(opsAgg)
      .map(([art, d]) => ({ art, ca: Number(d.ca || 0), nom: d.designation || d.nom || art, marque: d.marque }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 30);
    const missing = opsTop.filter((p) => !portefeuilleArtcodes.has(String(p.art)));
    if (missing.length > 0) {
      alerts.push({
        tone: 'orange',
        icon: 'produit',
        label: `${missing.length} top produit${missing.length > 1 ? 's' : ''} OPS hors portefeuille`,
        action: 'lens',
        lens: 'pilotage',
      });
    }
  }

  return alerts.slice(0, 4);
}

function buildSparkline(months, values, opts = {}) {
  const w = opts.width || 240;
  const h = opts.height || 24;
  const stroke = opts.stroke || '#0057FF';
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => {
    const x = Math.round(i * step);
    const y = Math.round(h - ((v - min) / range) * (h - 2) - 1);
    return `${x},${y}`;
  });
  const path = `M${points.join(' L')}`;
  const area = `M0,${h} L${points.join(' L')} L${w},${h} Z`;
  return `
    <svg class="jpw-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="jpw-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#jpw-spark-grad)"/>
      <path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

// ─── Render ────────────────────────────────────────────────────────────────

function buildWidgetHtml(data) {
  const {
    caMonth,
    objectifPct,
    objectif,
    topClient,
    alerts,
    sparkSvg,
    monthLabel,
  } = data;

  const variation = caMonth.variationPct;
  const varClass = variation === null ? 'jpw-var--neutral' : variation >= 0 ? 'jpw-var--up' : 'jpw-var--down';
  const varSymbol = variation === null ? '·' : variation >= 0 ? '↑' : '↓';
  const varLabel = variation === null ? 'vs N-1' : `${formatPercent(Math.abs(variation))} vs ${monthLabel.previous || 'N-1'}`;

  const objectifBar = objectifPct === null ? '' : `
    <div class="jpw-progress" aria-hidden="true">
      <div class="jpw-progress-fill" style="width:${Math.min(100, objectifPct)}%"></div>
    </div>
  `;

  const topClientBlock = topClient
    ? `
      <div class="jpw-kpi-value jpw-kpi-value--sm" title="${escapeHtml(topClient.nom)}">${escapeHtml(topClient.nom)}</div>
      <div class="jpw-kpi-sub">${formatEuroShort(topClient.ca)} ce mois</div>
    `
    : `
      <div class="jpw-kpi-value jpw-kpi-value--sm">—</div>
      <div class="jpw-kpi-sub">Aucune vente ce mois</div>
    `;

  const alertsBlock = alerts.length === 0
    ? `
      <div class="jpw-alerts-empty">Aucune alerte aujourd'hui</div>
    `
    : `
      <ul class="jpw-alerts-list">
        ${alerts.map((a) => `
          <li class="jpw-alert jpw-alert--${escapeHtml(a.tone)}">
            <span class="jpw-alert-dot" aria-hidden="true"></span>
            <span class="jpw-alert-label">${escapeHtml(a.label)}</span>
          </li>
        `).join('')}
      </ul>
    `;

  const alertsCount = alerts.length;

  return `
    <button type="button" class="jpw-close" aria-label="Fermer">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>

    <header class="jpw-header">
      <div class="jpw-header-left">
        <h2 class="jpw-title">Pilotage</h2>
        <span class="jpw-date">${escapeHtml(monthLabel.full || formatDateTodayFr())}</span>
      </div>
      <button type="button" class="jpw-detail" data-jpw-open-lens>
        Détail complet
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </header>

    <div class="jpw-grid">

      <div class="jpw-kpi">
        <div class="jpw-kpi-label">CA ${escapeHtml(monthLabel.short || 'du mois')}</div>
        <div class="jpw-kpi-value">${formatEuroShort(caMonth.current || 0)}</div>
        <div class="jpw-kpi-variation ${varClass}">
          <span class="jpw-arrow">${varSymbol}</span>
          <span>${varLabel}</span>
        </div>
      </div>

      <div class="jpw-kpi">
        <div class="jpw-kpi-label">Objectif</div>
        <div class="jpw-kpi-value">${objectifPct === null ? '—' : objectifPct + '%'}</div>
        ${objectifBar}
        <div class="jpw-kpi-sub">${objectifPct === null ? 'Non défini' : 'cible ' + formatEuroShort(objectif)}</div>
      </div>

      <div class="jpw-kpi">
        <div class="jpw-kpi-label">Top client</div>
        ${topClientBlock}
      </div>

      <div class="jpw-kpi">
        <div class="jpw-kpi-label">Alertes</div>
        <div class="jpw-kpi-value">${alertsCount}</div>
        ${alertsBlock}
      </div>

    </div>

    <div class="jpw-spark-wrap" aria-hidden="true">
      ${sparkSvg}
    </div>
  `;
}

const STYLE_ID = 'jpw-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .jpw {
      position: absolute;
      top: 80px;
      left: 16px;
      right: 16px;
      z-index: 450;
      background: rgba(255, 255, 255, 0.92);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      backdrop-filter: blur(20px) saturate(180%);
      border-radius: 16px;
      padding: 14px 14px 12px;
      box-shadow:
        0 1px 0 rgba(255,255,255,0.6) inset,
        0 0 0 0.5px rgba(0,0,0,0.04),
        0 6px 16px rgba(15, 23, 42, 0.08),
        0 22px 48px rgba(15, 23, 42, 0.10);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif;
      color: #0F172A;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 280ms ease-out, transform 280ms ease-out;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    @media (min-width: 640px) {
      .jpw {
        top: 24px;
        left: 24px;
        right: auto;
        max-width: 460px;
        padding: 16px 16px 14px;
      }
    }
    .jpw--visible { opacity: 1; transform: translateY(0); }
    .jpw--leaving { opacity: 0; transform: translateY(-8px); transition: opacity 200ms ease-in, transform 200ms ease-in; }

    .jpw-close {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 24px; height: 24px;
      border: none;
      background: rgba(15, 23, 42, 0.06);
      color: #475569;
      border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer;
      padding: 0;
      transition: background-color 150ms ease;
    }
    .jpw-close:hover { background: rgba(15, 23, 42, 0.12); }

    .jpw-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
      padding-right: 28px;
    }
    .jpw-header-left { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
    .jpw-title { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.2px; color: #0F172A; }
    .jpw-date { font-size: 12px; color: #94A3B8; font-weight: 500; }
    .jpw-detail {
      border: none;
      background: transparent;
      color: #0057FF;
      font-size: 13px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 2px;
      padding: 4px 6px;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 150ms ease;
    }
    .jpw-detail:hover { background: rgba(0, 87, 255, 0.08); }

    .jpw-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .jpw-kpi {
      background: rgba(248, 250, 252, 0.85);
      border: 0.5px solid rgba(15, 23, 42, 0.06);
      border-radius: 12px;
      padding: 10px 12px 11px;
      min-width: 0;
    }
    .jpw-kpi-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #94A3B8;
      margin-bottom: 4px;
    }
    .jpw-kpi-value {
      font-size: 22px;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.4px;
      color: #0F172A;
      font-variant-numeric: tabular-nums;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .jpw-kpi-value--sm { font-size: 14px; font-weight: 600; letter-spacing: -0.1px; line-height: 1.25; }
    .jpw-kpi-sub {
      margin-top: 3px;
      font-size: 11px;
      color: #64748B;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .jpw-kpi-variation {
      margin-top: 4px;
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-variant-numeric: tabular-nums;
    }
    .jpw-var--up { color: #34C759; }
    .jpw-var--down { color: #FF3B30; }
    .jpw-var--neutral { color: #94A3B8; }
    .jpw-arrow { font-size: 13px; line-height: 1; }

    .jpw-progress {
      margin-top: 6px;
      height: 4px;
      width: 100%;
      background: rgba(15, 23, 42, 0.08);
      border-radius: 2px;
      overflow: hidden;
    }
    .jpw-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #0057FF, #3B82F6);
      border-radius: 2px;
      transition: width 600ms ease-out;
    }

    .jpw-alerts-list {
      list-style: none;
      padding: 0;
      margin: 6px 0 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 64px;
      overflow: hidden;
    }
    .jpw-alert {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #334155;
      line-height: 1.2;
      overflow: hidden;
    }
    .jpw-alert-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .jpw-alert-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .jpw-alert--orange .jpw-alert-dot { background: #FF9500; }
    .jpw-alert--blue   .jpw-alert-dot { background: #0057FF; }
    .jpw-alert--red    .jpw-alert-dot { background: #FF3B30; }
    .jpw-alerts-empty {
      margin-top: 6px;
      font-size: 11px;
      color: #94A3B8;
      font-style: italic;
    }

    .jpw-spark-wrap {
      margin-top: 10px;
      width: 100%;
      height: 24px;
    }
    .jpw-spark {
      width: 100%;
      height: 24px;
      display: block;
    }

    @media (prefers-color-scheme: dark) {
      .jpw {
        background: rgba(20, 24, 35, 0.85);
        color: #F1F5F9;
        box-shadow:
          0 1px 0 rgba(255,255,255,0.04) inset,
          0 0 0 0.5px rgba(255,255,255,0.06),
          0 6px 16px rgba(0,0,0,0.30),
          0 22px 48px rgba(0,0,0,0.40);
      }
      .jpw-title { color: #F1F5F9; }
      .jpw-date { color: #64748B; }
      .jpw-kpi {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.06);
      }
      .jpw-kpi-value { color: #F1F5F9; }
      .jpw-kpi-sub { color: #94A3B8; }
      .jpw-alert { color: #CBD5E1; }
      .jpw-close {
        background: rgba(255, 255, 255, 0.08);
        color: #CBD5E1;
      }
      .jpw-close:hover { background: rgba(255, 255, 255, 0.14); }
      .jpw-progress { background: rgba(255, 255, 255, 0.08); }
      .jpw-detail:hover { background: rgba(0, 87, 255, 0.18); }
    }
  `;
  document.head.appendChild(style);
}

function buildMonthLabel(currentKey, previousKey) {
  const noms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
  const nomsFull = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  function partsFor(k) {
    if (!k) return null;
    const [y, m] = k.split('-');
    const idx = parseInt(m, 10) - 1;
    return {
      short: noms[idx] || m,
      full: `${nomsFull[idx] || m} ${y}`,
    };
  }
  const cur = partsFor(currentKey);
  const prev = partsFor(previousKey);
  return {
    short: cur ? cur.short : 'mois',
    full: cur ? cur.full : formatDateTodayFr(),
    previous: prev ? prev.short : null,
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

export function renderPilotageWidget(opts = {}) {
  injectStyle();

  const objectif = Number(opts.objectif ?? DEFAULT_OBJECTIF_MENSUEL);

  // Compute once
  const caMonth = computeCaMonth();
  const objectifPct = caMonth.current === null ? null : computeObjectifPct(caMonth.current || 0, objectif);
  const topClient = computeTopClientThisMonth(caMonth.currentKey);
  const alerts = computeAlerts();
  const monthLabel = buildMonthLabel(caMonth.currentKey, caMonth.previousKey);

  // Sparkline : 8 derniers mois
  const sm = window.SALES_BY_MONTH || {};
  const allMonths = Object.keys(sm).sort();
  const last8 = allMonths.slice(-8);
  const values = last8.map((m) => Number(sm[m]?.ca || 0));
  const sparkSvg = values.length ? buildSparkline(last8, values, { width: 240, height: 24, stroke: '#0057FF' }) : '';

  const el = document.createElement('section');
  el.className = 'jpw';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Pilotage du mois');
  el.innerHTML = buildWidgetHtml({
    caMonth,
    objectifPct,
    objectif,
    topClient,
    alerts,
    sparkSvg,
    monthLabel,
  });

  // Wire interactions
  const closeBtn = el.querySelector('.jpw-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissPilotageWidget(el);
    });
  }
  const detailBtn = el.querySelector('[data-jpw-open-lens]');
  if (detailBtn) {
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      try { openLens('pilotage'); } catch (err) { console.warn('[JPW] openLens failed', err); }
    });
  }
  // Tap toute la card (en dehors des CTAs) → ouvre lens
  el.addEventListener('click', (e) => {
    if (e.target.closest('.jpw-close') || e.target.closest('[data-jpw-open-lens]')) return;
    try { openLens('pilotage'); } catch (err) { console.warn('[JPW] openLens failed', err); }
  });

  return el;
}

export function showPilotageWidget(parentEl, opts = {}) {
  if (!parentEl) parentEl = document.body;
  if (isPilotageWidgetDismissed() && !opts.force) return null;

  // Remove any previous instance
  const existing = parentEl.querySelector('.jpw');
  if (existing) existing.remove();

  const el = renderPilotageWidget(opts);
  parentEl.appendChild(el);

  // Animation d'entrée : 600ms après le greeting
  const delay = typeof opts.delay === 'number' ? opts.delay : 600;
  setTimeout(() => {
    requestAnimationFrame(() => el.classList.add('jpw--visible'));
  }, delay);

  // Si l'utilisateur ré-ouvre via orb, on lève le flag dismiss
  if (opts.force) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  return el;
}

export function dismissPilotageWidget(el) {
  const target = el || document.querySelector('.jpw');
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
  if (!target) return;
  target.classList.add('jpw--leaving');
  setTimeout(() => {
    if (target.parentNode) target.parentNode.removeChild(target);
  }, 220);
}

export function isPilotageWidgetDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

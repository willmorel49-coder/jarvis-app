// JARVIS · lens-pilotage.js
// Lentille Pilotage : KPIs CA, top pharmacies, distribution potentiel.

import { registerLens } from './lens.js';

registerLens('pilotage', {
  title: 'Pilotage commercial',
  render: () => buildPilotage(),
});

function buildPilotage() {
  const clients = (typeof window !== 'undefined' && window.CLIENTS) ? window.CLIENTS : [];
  const stats = computeStats(clients);
  const top = topPharmas(clients, 10);

  return `
    <div class="lens-pilotage">
      <div class="lens-kpi-grid">
        <div class="lens-kpi">
          <div class="lens-kpi-label">Officines actives</div>
          <div class="lens-kpi-value">${stats.activeCount}</div>
          <div class="lens-kpi-sub">sur ${stats.total} au total</div>
        </div>
        <div class="lens-kpi">
          <div class="lens-kpi-label">CA cumulé 2023</div>
          <div class="lens-kpi-value">${formatEuroShort(stats.totalCa)}</div>
          <div class="lens-kpi-sub">${stats.activeCount} officines avec CA</div>
        </div>
        <div class="lens-kpi">
          <div class="lens-kpi-label">Potentiel Gx total</div>
          <div class="lens-kpi-value">${formatEuroShort(stats.totalPot)}</div>
          <div class="lens-kpi-sub">${stats.potCount} officines ciblées</div>
        </div>
        <div class="lens-kpi lens-kpi--hero">
          <div class="lens-kpi-label">Ratio CA / Potentiel</div>
          <div class="lens-kpi-value">${stats.ratio.toFixed(1)} %</div>
          <div class="lens-kpi-sub">Marge de progression : ${formatEuroShort(stats.totalPot - stats.totalCa)}</div>
        </div>
      </div>

      <h3 class="lens-section-title">Top 10 officines (CA 2023)</h3>
      <div class="lens-table">
        <div class="lens-table-row lens-table-head">
          <span>#</span><span>Officine</span><span>Ville</span><span>CA</span><span>Potentiel</span>
        </div>
        ${top.map((p, i) => `
          <div class="lens-table-row">
            <span>${i + 1}</span>
            <span class="lens-table-name">${escapeHtml(p.nom || '—')}</span>
            <span>${escapeHtml(p.ville || '—')}</span>
            <span class="lens-table-num">${formatEuroShort(p.ca2023)}</span>
            <span class="lens-table-num">${formatEuroShort(p.potentielGx)}</span>
          </div>
        `).join('')}
      </div>

      <h3 class="lens-section-title">Distribution territoire</h3>
      <div class="lens-bar-chart">
        ${buildVilleBars(clients).map((b) => `
          <div class="lens-bar-row">
            <span class="lens-bar-label">${escapeHtml(b.label)}</span>
            <div class="lens-bar-track"><div class="lens-bar-fill" style="width:${b.pct}%"></div></div>
            <span class="lens-bar-value">${b.count}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function computeStats(clients) {
  const total = clients.length;
  let totalCa = 0;
  let totalPot = 0;
  let activeCount = 0;
  let potCount = 0;
  for (const c of clients) {
    if (c.ca2023 > 0) { totalCa += c.ca2023; activeCount++; }
    if (c.potentielGx > 0) { totalPot += c.potentielGx; potCount++; }
  }
  const ratio = totalPot > 0 ? (totalCa / totalPot) * 100 : 0;
  return { total, totalCa, totalPot, activeCount, potCount, ratio };
}

function topPharmas(clients, n) {
  return [...clients].sort((a, b) => (b.ca2023 || 0) - (a.ca2023 || 0)).slice(0, n);
}

function buildVilleBars(clients) {
  const byCp2 = {};
  for (const c of clients) {
    const dept = (c.cp || '').slice(0, 2);
    if (!dept) continue;
    byCp2[dept] = (byCp2[dept] || 0) + 1;
  }
  const entries = Object.entries(byCp2).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = entries[0] ? entries[0][1] : 1;
  return entries.map(([dept, count]) => ({
    label: `Dépt ${dept}`,
    count,
    pct: Math.round((count / max) * 100),
  }));
}

function formatEuroShort(n) {
  if (!n) return '0 €';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} M€`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)} k€`;
  return `${sign}${abs} €`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

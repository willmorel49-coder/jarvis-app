// JARVIS · greeting.js
// Génère le greeting matinal affiché en haut de la carte.
// Phase 1 : règle-based simple (jour de la semaine + comptage statique).
// Phase 8 : connecté au LLM pour brief contextuel.

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function createGreeting({ userName = 'William', territoryLabel = 'Manche · Sud', stats = {} } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'jarvis-greeting';

  const hi = greetingForTime();
  const sub = subForStats(stats);

  wrap.innerHTML = `
    <p class="jarvis-greeting-hi">${hi}, ${escapeHtml(userName)}</p>
    <h1 class="jarvis-greeting-title">${escapeHtml(territoryLabel)}</h1>
    <p class="jarvis-greeting-sub">${sub}</p>
    <p class="jarvis-greeting-ver" style="font-size:9px;color:#94A3B8;letter-spacing:.5px;margin:2px 0 0;opacity:.6;">v.20260601e · 808 clients</p>
  `;
  return wrap;
}

function greetingForTime() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function subForStats({ visitsToday = 0, alerts = 0, clients = 0, prospectsHot = 0, total = 0, sectorCa = null } = {}) {
  const parts = [];
  if (visitsToday > 0) parts.push(`${visitsToday} visite${visitsToday > 1 ? 's' : ''} aujourd'hui`);
  if (alerts > 0) parts.push(`<span style="color:#FF3B30">${alerts} alerte${alerts > 1 ? 's' : ''}</span>`);
  if (clients > 0) {
    const caLabel = sectorCa != null ? ` · ${formatEuroShortGreeting(sectorCa)} secteur` : '';
    parts.push(`${clients} client${clients > 1 ? 's' : ''}${caLabel}`);
  }
  if (prospectsHot > 0) parts.push(`<span style="color:#FF9F1C">${prospectsHot} prospect${prospectsHot > 1 ? 's' : ''} à démarcher</span>`);
  if (!parts.length) {
    const today = DAYS_FR[new Date().getDay()];
    if (total > 0) return `${today} · ${total} officines sur ton territoire`;
    return `${today} · territoire en veille`;
  }
  return parts.join(' · ');
}

function formatEuroShortGreeting(n) {
  if (!n) return '0 €';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} M€`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)} k€`;
  return `${sign}${Math.round(abs)} €`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

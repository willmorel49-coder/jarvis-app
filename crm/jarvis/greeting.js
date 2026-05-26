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
  `;
  return wrap;
}

function greetingForTime() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function subForStats({ visitsToday = 0, alerts = 0 } = {}) {
  const parts = [];
  if (visitsToday > 0) parts.push(`${visitsToday} visite${visitsToday > 1 ? 's' : ''} aujourd'hui`);
  if (alerts > 0) parts.push(`${alerts} alerte${alerts > 1 ? 's' : ''}`);
  if (!parts.length) {
    const today = DAYS_FR[new Date().getDay()];
    return `${today} · territoire en veille`;
  }
  return parts.join(' · ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

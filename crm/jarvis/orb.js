// JARVIS · orb.js
// Composant Orb · rendu + états visuels (idle / thinking / listening / speaking).

export function createOrb(size = 'md') {
  const el = document.createElement('span');
  el.className = `jarvis-orb jarvis-orb--${size}`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'JARVIS');
  el.dataset.state = 'idle';
  return el;
}

export function setOrbState(orbEl, state) {
  if (!orbEl) return;
  if (!['idle', 'thinking', 'listening', 'speaking'].includes(state)) return;
  orbEl.dataset.state = state;
}

export function setAllOrbsState(state) {
  document.querySelectorAll('.jarvis-orb').forEach((o) => setOrbState(o, state));
}

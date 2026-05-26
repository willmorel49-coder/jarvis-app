// JARVIS · orb.js
// Composant Orb · gère uniquement le rendu HTML + l'état visuel.
// Les animations sont en CSS (voir style-jarvis.css).

export function createOrb(size = 'md') {
  const el = document.createElement('span');
  el.className = `jarvis-orb jarvis-orb--${size}`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'JARVIS');
  return el;
}

export function setOrbState(orbEl, state) {
  // states: 'idle' | 'thinking' | 'listening' | 'speaking'
  orbEl.dataset.state = state;
  // Phase 1 : tous les états sont visuellement identiques (idle).
  // Phase 2 ajoutera des variantes CSS (.jarvis-orb[data-state="listening"] etc.)
}

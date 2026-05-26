// JARVIS · sheet.js
// Composant Sheet glass au bas de l'écran.
// Phase 1 : statique (pas de drag, pas d'expand). Drag arrive en Phase 2.

import { createOrb } from './orb.js';

export function createSheet(initialBubbleHtml = '') {
  const sheet = document.createElement('div');
  sheet.className = 'jarvis-sheet';
  sheet.id = 'jarvis-sheet';

  sheet.innerHTML = `
    <div class="jarvis-sheet-handle" aria-hidden="true"></div>
    <div class="jarvis-sheet-bubble" id="jarvis-sheet-bubble">
      <div class="jarvis-sheet-bubble-content">${initialBubbleHtml || '<strong>JARVIS</strong> · prêt.'}</div>
    </div>
    <div class="jarvis-prompt">
      <span class="jarvis-orb jarvis-orb--mini" aria-hidden="true"></span>
      <input class="jarvis-prompt-input" type="text" placeholder="Demande à JARVIS…" disabled />
      <button class="jarvis-mic" aria-label="Mode voix" disabled>🎙</button>
    </div>
  `;
  const bubble = sheet.querySelector('.jarvis-sheet-bubble');
  bubble.insertBefore(createOrb('mini'), bubble.firstChild);

  return sheet;
}

export function updateSheetBubble(sheetEl, html) {
  const c = sheetEl.querySelector('.jarvis-sheet-bubble-content');
  if (c) c.innerHTML = html;
}

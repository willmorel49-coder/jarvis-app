// JARVIS · sheet.js
// Sheet glass au bas de l'écran, draggable avec 3 snap states.
// Phase 2 : drag (compact / medium / full) + morph fiche pharmacie.

import { createOrb } from './orb.js';

const SNAP_HEIGHTS = {
  compact: 130,
  medium: 380,
  full: () => window.innerHeight - 60,
};

export function createSheet(initialBubbleHtml = '') {
  const sheet = document.createElement('div');
  sheet.className = 'jarvis-sheet';
  sheet.id = 'jarvis-sheet';
  sheet.dataset.snap = 'compact';

  sheet.innerHTML = `
    <div class="jarvis-sheet-handle" aria-hidden="true"></div>
    <div class="jarvis-sheet-content" id="jarvis-sheet-content">
      <div class="jarvis-sheet-bubble">
        <div class="jarvis-sheet-bubble-content">${initialBubbleHtml || '<strong>JARVIS</strong> · prêt.'}</div>
      </div>
    </div>
    <div class="jarvis-prompt">
      <span class="jarvis-orb jarvis-orb--mini" aria-hidden="true"></span>
      <input class="jarvis-prompt-input" type="text" placeholder="Demande à JARVIS…" />
      <button class="jarvis-mic" aria-label="Mode voix" title="Mode voix">🎙</button>
    </div>
  `;
  const bubble = sheet.querySelector('.jarvis-sheet-bubble');
  bubble.insertBefore(createOrb('mini'), bubble.firstChild);

  setupSheetDrag(sheet);

  // Recalcule la hauteur "full" en cas de resize fenêtre (orientation, F11, etc.)
  window.addEventListener('resize', () => {
    if (sheet.dataset.snap === 'full') {
      sheet.style.height = SNAP_HEIGHTS.full() + 'px';
    }
  });

  return sheet;
}

export function updateSheetBubble(sheetEl, html) {
  const c = sheetEl.querySelector('.jarvis-sheet-bubble-content');
  if (c) c.innerHTML = html;
}

export function setSheetSnap(sheetEl, snap) {
  if (!(snap in SNAP_HEIGHTS)) return;
  sheetEl.dataset.snap = snap;
  const h = typeof SNAP_HEIGHTS[snap] === 'function' ? SNAP_HEIGHTS[snap]() : SNAP_HEIGHTS[snap];
  sheetEl.style.height = h + 'px';
}

export function showFicheInSheet(sheetEl, html) {
  const content = sheetEl.querySelector('.jarvis-sheet-content');
  content.innerHTML = html;
  setSheetSnap(sheetEl, 'medium');
}

export function resetSheetToBubble(sheetEl, html) {
  const content = sheetEl.querySelector('.jarvis-sheet-content');
  content.innerHTML = `
    <div class="jarvis-sheet-bubble">
      <div class="jarvis-sheet-bubble-content">${html || '<strong>JARVIS</strong> · prêt.'}</div>
    </div>
  `;
  const bubble = content.querySelector('.jarvis-sheet-bubble');
  bubble.insertBefore(createOrb('mini'), bubble.firstChild);
  setSheetSnap(sheetEl, 'compact');
}

function setupSheetDrag(sheet) {
  const handle = sheet.querySelector('.jarvis-sheet-handle');
  let startY = null;
  let startHeight = 0;
  let currentHeight = 0;

  function onDown(e) {
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startHeight = sheet.offsetHeight;
    currentHeight = startHeight;
    sheet.style.transition = 'none';
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchend', onUp);
    document.addEventListener('mouseup', onUp);
  }
  function onMove(e) {
    if (startY === null) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = startY - y;
    const maxH = SNAP_HEIGHTS.full();
    currentHeight = Math.max(SNAP_HEIGHTS.compact, Math.min(maxH, startHeight + delta));
    sheet.style.height = currentHeight + 'px';
    if (e.cancelable) e.preventDefault();
  }
  function onUp() {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchend', onUp);
    document.removeEventListener('mouseup', onUp);
    sheet.style.transition = '';
    const target = nearestSnap(currentHeight || startHeight);
    setSheetSnap(sheet, target);
    startY = null;
  }
  handle.addEventListener('touchstart', onDown, { passive: true });
  handle.addEventListener('mousedown', onDown);
}

function nearestSnap(h) {
  const compactDist = Math.abs(h - SNAP_HEIGHTS.compact);
  const mediumDist = Math.abs(h - SNAP_HEIGHTS.medium);
  const fullDist = Math.abs(h - SNAP_HEIGHTS.full());
  const min = Math.min(compactDist, mediumDist, fullDist);
  if (min === compactDist) return 'compact';
  if (min === mediumDist) return 'medium';
  return 'full';
}

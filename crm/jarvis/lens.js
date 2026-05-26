// JARVIS · lens.js
// Gestionnaire de lentilles : surfaces plein écran qui glissent depuis le bas
// par-dessus la carte. Swipe down / Échap / bouton fermeture → ferme.

const registry = new Map();
let activeLens = null;
let scrim = null;

export function registerLens(id, { title, render, onMount, onClose }) {
  registry.set(id, { id, title, render, onMount, onClose });
}

export async function openLens(id, ctx = {}) {
  const def = registry.get(id);
  if (!def) {
    console.warn('[JARVIS] lens not found:', id);
    return;
  }
  if (activeLens) closeLens();

  // Scrim glass derrière la lentille (assombrit légèrement la carte)
  scrim = document.createElement('div');
  scrim.className = 'jarvis-lens-scrim';
  scrim.addEventListener('click', closeLens);
  document.body.appendChild(scrim);

  // Lentille
  const lens = document.createElement('div');
  lens.className = 'jarvis-lens';
  lens.id = `jarvis-lens-${id}`;
  lens.innerHTML = `
    <div class="jarvis-lens-handle" aria-hidden="true"></div>
    <header class="jarvis-lens-header">
      <h2 class="jarvis-lens-title">${escapeHtml(def.title)}</h2>
      <button class="jarvis-lens-close" aria-label="Fermer">✕</button>
    </header>
    <div class="jarvis-lens-body" id="jarvis-lens-body"></div>
  `;
  document.body.appendChild(lens);
  lens.querySelector('.jarvis-lens-close').addEventListener('click', closeLens);

  const body = lens.querySelector('.jarvis-lens-body');
  try {
    const content = await def.render(ctx);
    if (typeof content === 'string') body.innerHTML = content;
    else if (content instanceof HTMLElement) body.appendChild(content);
  } catch (err) {
    console.error('[JARVIS] lens render error:', err);
    body.innerHTML = `<div class="jarvis-lens-empty">Erreur de chargement : ${escapeHtml(String(err))}</div>`;
  }

  if (def.onMount) def.onMount(body, ctx);

  // Trigger animation après insertion
  requestAnimationFrame(() => {
    lens.classList.add('jarvis-lens--open');
    scrim.classList.add('jarvis-lens-scrim--open');
  });

  // Swipe down pour fermer (gesture sur le handle)
  setupSwipeDown(lens);

  // Échap
  document.addEventListener('keydown', escClose);

  activeLens = { id, el: lens, def };
}

export function closeLens() {
  if (!activeLens) return;
  const { el, def } = activeLens;
  el.classList.remove('jarvis-lens--open');
  if (scrim) scrim.classList.remove('jarvis-lens-scrim--open');
  document.removeEventListener('keydown', escClose);
  if (def.onClose) def.onClose();
  setTimeout(() => {
    el.remove();
    if (scrim) { scrim.remove(); scrim = null; }
  }, 350);
  activeLens = null;
}

function escClose(e) {
  if (e.key === 'Escape') closeLens();
}

function setupSwipeDown(lens) {
  const handle = lens.querySelector('.jarvis-lens-handle');
  let startY = null;
  let currentY = 0;

  function onDown(e) {
    startY = (e.touches ? e.touches[0].clientY : e.clientY);
    currentY = 0;
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchend', onUp);
    document.addEventListener('mouseup', onUp);
  }
  function onMove(e) {
    if (startY === null) return;
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    currentY = Math.max(0, y - startY);
    lens.style.transform = `translateY(${currentY}px)`;
    if (e.cancelable) e.preventDefault();
  }
  function onUp() {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchend', onUp);
    document.removeEventListener('mouseup', onUp);
    if (currentY > 120) {
      closeLens();
    } else {
      lens.style.transform = '';
    }
    startY = null;
    currentY = 0;
  }
  handle.addEventListener('touchstart', onDown, { passive: true });
  handle.addEventListener('mousedown', onDown);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

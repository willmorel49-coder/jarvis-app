// JARVIS · lens-marketing.js
// Lentille Marketing — fiches commerciales IP au format PDF
// Wrapper minimal : la logique vit dans crm/marketing.js (script global)
// On lui prête un container et on appelle window.renderMarketing().

import { registerLens } from './lens.js';

let styleInjected = false;

registerLens('marketing', {
  title: 'Marketing — Fiches commerciales',
  render: () => {
    injectStyles();
    // Container que marketing.js va remplir
    const el = document.createElement('div');
    el.className = 'jl-marketing';
    return el;
  },
  onMount: (body) => {
    // marketing.js cherche getRoot() — on lui prête notre container
    if (typeof window.mkSetContainer === 'function') {
      window.mkSetContainer(body);
    }
    if (typeof window.renderMarketing === 'function') {
      window.renderMarketing();
    } else {
      body.innerHTML = `
        <div style="padding:40px 24px;text-align:center;color:#64748B;font-family:'DM Sans',sans-serif">
          <div style="font-size:14px">Module marketing en cours de chargement…</div>
          <div style="font-size:11px;margin-top:8px;opacity:.6">Réessaie dans une seconde</div>
        </div>
      `;
    }
  },
  onClose: () => {
    if (typeof window.mkClearContainer === 'function') {
      window.mkClearContainer();
    }
  },
});

function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const css = `
    /* Marketing dans la lens JARVIS : ajuste le padding interne car la lens
       a déjà son propre header + body avec padding. */
    .jarvis-lens-body .jl-marketing { padding: 8px 0 32px; }
    .jarvis-lens-body .mk-wrap,
    .jarvis-lens-body .mk-edit-wrap { padding: 0 4px; max-width: 100%; }
    /* Sur mobile, la lens prend toute la largeur : grille édition en colonne */
    @media (max-width: 900px) {
      .jarvis-lens-body .mk-edit-grid { grid-template-columns: 1fr !important; }
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

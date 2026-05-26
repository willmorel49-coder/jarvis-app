// JARVIS · lens-rdv.js
// Lentille RDV : event types + bookings reçus (localStorage stub).
// Phase 6 ajoutera la page publique + Resend.

import { registerLens } from './lens.js';

const LS_KEY_EVENT_TYPES = 'jarvis.eventtypes.v1';
const LS_KEY_BOOKINGS = 'jarvis.bookings.v1';

const DEFAULT_EVENT_TYPES = [
  { id: 'visite-decouverte', label: 'Visite découverte', duration: 30, location: 'En officine', slug: 'visite-decouverte' },
  { id: 'point-trimestriel', label: 'Point trimestriel', duration: 60, location: 'En officine', slug: 'point-trimestriel' },
  { id: 'audit-annuel', label: 'Audit annuel', duration: 90, location: 'En officine', slug: 'audit-annuel' },
];

registerLens('rdv', {
  title: 'RDV · prises de rendez-vous',
  render: () => buildRdv(),
  onMount: (body) => attachHandlers(body),
});

function buildRdv() {
  const events = readEventTypes();
  const bookings = readBookings();
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
  return `
    <div class="lens-rdv">
      <section class="lens-rdv-section">
        <h3>Tes types de RDV</h3>
        <div class="lens-rdv-types">
          ${events.map((e) => `
            <article class="lens-rdv-type">
              <div class="lens-rdv-type-name">${escapeHtml(e.label)}</div>
              <div class="lens-rdv-type-meta">${e.duration} min · ${escapeHtml(e.location)}</div>
              <div class="lens-rdv-type-link">
                <input readonly value="${escapeAttr(baseUrl)}/book.html?type=${escapeAttr(e.slug)}" />
                <button class="jarvis-btn jarvis-btn-ghost" data-copy="${escapeAttr(baseUrl)}/book.html?type=${escapeAttr(e.slug)}">Copier</button>
              </div>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="lens-rdv-section">
        <h3>Bookings reçus</h3>
        ${bookings.length ? `
          <div class="lens-rdv-bookings">
            ${bookings.map((b) => `
              <div class="lens-rdv-booking">
                <span class="lens-rdv-date">${formatDate(b.date)}</span>
                <div>
                  <div class="lens-jrn-name">${escapeHtml(b.lead || '—')}</div>
                  <div class="lens-jrn-meta">${escapeHtml(b.event || '')} · ${escapeHtml(b.email || '')}</div>
                </div>
                <span class="jarvis-chip jarvis-chip--${b.status || 'confirmed'}">${escapeHtml(b.status || 'confirmé')}</span>
              </div>
            `).join('')}
          </div>
        ` : '<div class="lens-empty">Aucun booking reçu pour le moment. Partage tes liens ci-dessus à tes officines pour qu\'elles réservent en autonomie.</div>'}
      </section>

      <section class="lens-rdv-section">
        <h3>Comment ça marche</h3>
        <ol class="lens-rdv-howto">
          <li>Tu copies le lien d'un type de RDV (ex: <em>Visite découverte</em>)</li>
          <li>Tu l'envoies par mail ou SMS à un pharmacien</li>
          <li>Il choisit un créneau dispo, remplit son nom + email, confirme</li>
          <li>Tu reçois une notification ici + sur ton agenda</li>
        </ol>
        <div class="lens-rdv-note">
          ⚠ La page publique de booking arrive en Phase 6 (setup Resend pour les mails de confirmation). Pour l'instant, ces liens sont des placeholders.
        </div>
      </section>
    </div>
  `;
}

function attachHandlers(body) {
  body.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Copié !';
        setTimeout(() => { btn.textContent = 'Copier'; }, 1500);
      } catch {
        btn.textContent = 'Erreur';
      }
    });
  });
}

function readEventTypes() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY_EVENT_TYPES) || 'null');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return DEFAULT_EVENT_TYPES;
}

function readBookings() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY_BOOKINGS) || '[]');
  } catch { return []; }
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

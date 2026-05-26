// JARVIS · lens-journal.js
// Lentille Journal : visites passées + futures (depuis CLIENTS + localStorage).

import { registerLens } from './lens.js';

const LS_KEY_VISITS = 'jarvis.visits.v1';

registerLens('journal', {
  title: 'Journal des visites',
  render: () => buildJournal(),
  onMount: (body) => attachHandlers(body),
});

function buildJournal() {
  const upcoming = getUpcomingVisits();
  const past = getPastVisits();
  return `
    <div class="lens-journal">
      <section class="lens-jrn-section">
        <header class="lens-jrn-header">
          <h3>À venir</h3>
          <button class="jarvis-btn jarvis-btn-primary" id="jrn-add">+ Nouvelle visite</button>
        </header>
        <div class="lens-jrn-list">
          ${upcoming.length ? upcoming.map(renderUpcomingRow).join('') : '<div class="lens-empty">Aucune visite planifiée. Tape <b>+ Nouvelle visite</b> pour en caler une.</div>'}
        </div>
      </section>
      <section class="lens-jrn-section">
        <h3>Historique</h3>
        <div class="lens-jrn-list">
          ${past.length ? past.map(renderPastRow).join('') : '<div class="lens-empty">Pas encore de visites enregistrées.</div>'}
        </div>
      </section>
    </div>
  `;
}

function attachHandlers(body) {
  const addBtn = body.querySelector('#jrn-add');
  if (addBtn) addBtn.addEventListener('click', () => promptAddVisit(body));
}

function promptAddVisit(body) {
  const clients = (window.CLIENTS || []);
  const ville = window.prompt('Officine (nom ou ville, recherche libre) :');
  if (!ville) return;
  const match = clients.find((c) =>
    (c.nom || '').toLowerCase().includes(ville.toLowerCase()) ||
    (c.ville || '').toLowerCase().includes(ville.toLowerCase())
  );
  if (!match) { alert('Aucune officine trouvée.'); return; }
  const dateStr = window.prompt(`Date de la visite (YYYY-MM-DD) pour ${match.nom} :`, todayStr());
  if (!dateStr) return;
  const note = window.prompt('Note rapide (optionnel) :') || '';
  saveVisit({ cip: match.cip, nom: match.nom, ville: match.ville, date: dateStr, note });
  // Re-render
  const fresh = buildJournal();
  body.innerHTML = fresh;
  attachHandlers(body);
}

function saveVisit(visit) {
  const all = readVisits();
  all.push({ ...visit, id: Date.now() + Math.random(), createdAt: new Date().toISOString() });
  localStorage.setItem(LS_KEY_VISITS, JSON.stringify(all));
}

function readVisits() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY_VISITS) || '[]');
  } catch { return []; }
}

function getUpcomingVisits() {
  const now = new Date().toISOString().slice(0, 10);
  const fromLocal = readVisits().filter((v) => v.date >= now);
  // + visites depuis CLIENTS.prochaineVisite
  const fromClients = (window.CLIENTS || [])
    .filter((c) => c.prochaineVisite)
    .map((c) => ({
      id: 'cli-' + c.cip,
      cip: c.cip,
      nom: c.nom,
      ville: c.ville,
      date: c.prochaineVisite,
      note: '(planifiée depuis CRM)',
    }));
  const all = [...fromClients, ...fromLocal].sort((a, b) => a.date.localeCompare(b.date));
  return all.slice(0, 20);
}

function getPastVisits() {
  const now = new Date().toISOString().slice(0, 10);
  return readVisits().filter((v) => v.date < now).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
}

function renderUpcomingRow(v) {
  return `
    <div class="lens-jrn-row lens-jrn-row--up">
      <span class="lens-jrn-date">${formatDate(v.date)}</span>
      <div class="lens-jrn-body">
        <div class="lens-jrn-name">${escapeHtml(v.nom)}</div>
        <div class="lens-jrn-meta">${escapeHtml(v.ville || '')} ${v.note ? '· ' + escapeHtml(v.note) : ''}</div>
      </div>
    </div>
  `;
}

function renderPastRow(v) {
  return `
    <div class="lens-jrn-row">
      <span class="lens-jrn-date lens-jrn-date--past">${formatDate(v.date)}</span>
      <div class="lens-jrn-body">
        <div class="lens-jrn-name">${escapeHtml(v.nom)}</div>
        <div class="lens-jrn-meta">${escapeHtml(v.ville || '')} ${v.note ? '· ' + escapeHtml(v.note) : ''}</div>
      </div>
    </div>
  `;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

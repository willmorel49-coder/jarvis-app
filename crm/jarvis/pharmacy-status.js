// JARVIS · pharmacy-status.js
// Calcule le statut d'affichage d'une pharmacie pour pin coloring.
// Statuts : 'active' (bleu) · 'visited' (vert) · 'warm' (orange) · 'alert' (rouge) · 'prospect' (gris)

export function computePharmacyStatus(pharmacy, opts = {}) {
  const { hasAlert = false, lastVisitDaysAgo = null, isProspect = false } = opts;

  if (isProspect) return 'prospect';
  if (hasAlert) return 'alert';
  if (lastVisitDaysAgo !== null && lastVisitDaysAgo <= 30) return 'visited';
  if (lastVisitDaysAgo !== null && lastVisitDaysAgo > 90) return 'warm';
  return 'active';
}

export const STATUS_COLORS = {
  active: '#007AFF',
  visited: '#34C759',
  warm: '#FF9F1C',
  alert: '#FF3B30',
  prospect: '#8E8E93',
};

export function colorForStatus(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.active;
}

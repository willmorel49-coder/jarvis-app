// JARVIS · pharmacy-status.js
// Calcule le statut d'affichage d'une pharmacie pour pin coloring.
// Statuts (Intégral Pharma · territoire commercial 8 dpts : 14·35·37·44·49·50·53·72) :
//   'active'        — client (ca2023 > 0) → bleu
//   'prospect_hot'  — pas client mais potentielGx > 0 → orange (à démarcher en priorité)
//   'prospect_cold' — pas client, potentielGx = 0 → gris (low prio)
//   'alert'         — alerte prix concurrent < achat IP → rouge pulsant (override)
//   'visited'       — visité < 30j → vert (override pour highlight récents)

export function computePharmacyStatus(pharmacy, opts = {}) {
  const { hasAlert = false, lastVisitDaysAgo = null } = opts;

  // Overrides prioritaires
  if (hasAlert) return 'alert';
  if (lastVisitDaysAgo !== null && lastVisitDaysAgo <= 30) return 'visited';

  // Statut commercial depuis les data CRM
  const isClient = (pharmacy.ca2023 || 0) > 0;
  if (isClient) return 'active';

  const hasPotential = (pharmacy.potentielGx || 0) > 0;
  if (hasPotential) return 'prospect_hot';
  return 'prospect_cold';
}

export const STATUS_COLORS = {
  active: '#007AFF',
  visited: '#34C759',
  prospect_hot: '#FF9F1C',
  prospect_cold: '#8E8E93',
  alert: '#FF3B30',
  // Legacy aliases (rétrocompat anciens appels)
  warm: '#FF9F1C',
  prospect: '#8E8E93',
};

export function colorForStatus(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.active;
}

export const STATUS_LABELS = {
  active: 'Client',
  visited: 'Visité récemment',
  prospect_hot: 'Prospect à démarcher',
  prospect_cold: 'Prospect potentiel',
  alert: 'Alerte prix',
};

// Territoire commercial Intégral Pharma : 8 départements Bretagne / Normandie / Pays de la Loire / Centre
export const TERRITORY_DEPTS = new Set(['14', '35', '37', '44', '49', '50', '53', '72']);

export function isInTerritory(pharma) {
  const dept = String(pharma.cp || '').slice(0, 2);
  return TERRITORY_DEPTS.has(dept);
}

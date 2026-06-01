// JARVIS · pharmacy-status.js
// Calcule le statut d'affichage d'une pharmacie pour pin coloring.
// Statuts (Intégral Pharma · territoire commercial 8 dpts : 14·35·37·44·49·50·53·72) :
//   'active'        — client actif (ca2023 > 0, a facturé) → bleu foncé
//   'client'        — client (engagement Pelgraz/Pelmeg ou groupement partenaire) → bleu moyen
//   'prospect_hot'  — pas client mais potentielGx > 0 → orange
//   'prospect_cold' — pas client, pas de potentiel → gris
//   'alert'         — alerte prix concurrent < achat IP → rouge pulsant (override)
//   'visited'       — visité < 30j → vert (override)

// Liste des groupements partenaires Intégral Pharma (ecodage rempli = client)
export function isPartnerGroupement(eco) {
  return !!(eco && String(eco).trim());
}

export function computePharmacyStatus(pharmacy, opts = {}) {
  const { hasAlert = false, lastVisitDaysAgo = null } = opts;

  if (hasAlert) return 'alert';
  if (lastVisitDaysAgo !== null && lastVisitDaysAgo <= 30) return 'visited';

  const hasFactured = (pharmacy.ca2023 || 0) > 0;
  if (hasFactured) return 'active';

  // Client = appartient à un groupement partenaire (ecodage rempli)
  // Note : pelgraz/pelmeg sont un héritage de l'ancien boulot (Accord), pas utilisés ici
  const hasGroupement = !!(pharmacy.gros1 || pharmacy.gros2 ||
                            isPartnerGroupement(pharmacy.ecodage));
  if (hasGroupement) return 'client';

  const hasPotential = (pharmacy.potentielGx || 0) > 0;
  if (hasPotential) return 'prospect_hot';
  return 'prospect_cold';
}

export const STATUS_COLORS = {
  active: '#007AFF',          // bleu foncé Apple — a facturé
  client: '#5B8DEF',          // bleu moyen — engagement / groupement
  visited: '#34C759',         // vert — visité récemment
  prospect_hot: '#FF9F1C',    // orange — prospect chaud
  prospect_cold: '#8E8E93',   // gris — pas d'info
  alert: '#FF3B30',           // rouge — alerte
  // Legacy aliases
  warm: '#FF9F1C',
  prospect: '#8E8E93',
};

export function colorForStatus(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.active;
}

export const STATUS_LABELS = {
  active: 'Client actif',
  client: 'Client',
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

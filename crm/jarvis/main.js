// JARVIS · main.js
// Point d'entrée du shell JARVIS Phase 1. Bootstrap : monte greeting + carte + pins + sheet.

import { initMap, whenMapReady } from './map.js';
import { renderPharmacyPins, setPinClickHandler } from './pins.js';
import { createSheet, updateSheetBubble } from './sheet.js';
import { createGreeting } from './greeting.js';
import { computePharmacyStatus } from './pharmacy-status.js';

// Active le flag dès le chargement du module pour que app.js skip son UI legacy.
window.__JARVIS_SHELL_ACTIVE__ = true;

// Appelé par le callback Google Maps `&callback=initJarvis`
window.initJarvis = async function initJarvis() {
  console.log('[JARVIS] Bootstrap Phase 1');

  // 1. Conteneur carte
  let mapEl = document.getElementById('jarvis-map');
  if (!mapEl) {
    mapEl = document.createElement('div');
    mapEl.id = 'jarvis-map';
    mapEl.className = 'jarvis-map';
    document.body.appendChild(mapEl);
  }

  // 2. Init Google Maps
  initMap('jarvis-map');

  // 3. Greeting top
  const pharmacies = readPharmaciesFromAppGlobal();
  const stats = computeStats(pharmacies);
  const greeting = createGreeting({
    userName: 'William',
    territoryLabel: 'Manche · Sud',
    stats,
  });
  document.body.appendChild(greeting);

  // 4. Sheet bottom
  const sheet = createSheet(initialBubbleForStats(stats));
  document.body.appendChild(sheet);

  // 5. Pins
  await whenMapReady();
  await renderPharmacyPins(pharmacies, computeStatusForPharma);

  // 6. Pin click → centre la carte + update sheet bubble
  setPinClickHandler((pharma) => {
    updateSheetBubble(sheet, pinClickBubble(pharma));
  });

  console.log(`[JARVIS] Phase 1 ready · ${pharmacies.length} pharmacies rendues`);
};

function readPharmaciesFromAppGlobal() {
  // Phase 1 : on lit la variable globale CLIENTS exposée par crm/clients-data.js
  const raw = (typeof window !== 'undefined' && window.CLIENTS) ? window.CLIENTS : [];
  // Pour cette phase : pas de coordonnées dans clients-data.js. On en ajoute des fictives pour la démo.
  // Phase 10 : remplacer par les vraies coords du KML Google Maps de Will.
  return raw.map((p, i) => ({
    ...p,
    lat: p.lat ?? estimateLat(p, i),
    lng: p.lng ?? estimateLng(p, i),
  }));
}

// Coordonnées approximatives : 517 pins répartis autour de Saint-Lô tant que le KML n'est pas importé.
function estimateLat(p, i) {
  const seed = parseInt(String(p.cip || i).slice(-3), 10) || i;
  return 49.115 + ((seed % 100) - 50) * 0.012;
}
function estimateLng(p, i) {
  const seed = parseInt(String(p.cip || i).slice(0, 3), 10) || i;
  return -1.088 + ((seed % 100) - 50) * 0.015;
}

function computeStatusForPharma(p) {
  // Phase 1 : simple — pas d'historique de visite encore.
  // Heuristique provisoire : ca2023 > 0 → active, sinon prospect.
  if (!p.ca2023 || p.ca2023 === 0) return computePharmacyStatus(p, { isProspect: true });
  return computePharmacyStatus(p, {});
}

function computeStats(pharmacies) {
  return {
    visitsToday: 0,   // alimenté en Phase 3 (lentille Journal + GCal)
    alerts: 0,        // alimenté en Phase 4 (lentille Catalogue + alertes)
    total: pharmacies.length,
  };
}

function initialBubbleForStats(stats) {
  return `<strong>JARVIS</strong> · ${stats.total} officines sur ton territoire. Tape un pin pour voir la fiche.`;
}

function pinClickBubble(pharma) {
  const ville = pharma.ville || '';
  const cip = pharma.cip || '—';
  return `<strong>${escape(pharma.nom)}</strong> · ${escape(ville)} · CIP ${escape(cip)}`;
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

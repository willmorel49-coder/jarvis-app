// JARVIS · main.js
// Point d'entrée du shell JARVIS Phase 1. Bootstrap : monte greeting + carte + pins + sheet.

import { initMap, whenMapReady, fitBoundsToPoints } from './map.js';
import { renderPharmacyPins, setPinClickHandler } from './pins.js';
import { createSheet, updateSheetBubble } from './sheet.js';
import { createGreeting } from './greeting.js';
import { computePharmacyStatus } from './pharmacy-status.js';

// Active le flag dès le chargement du module pour que app.js skip son UI legacy.
window.__JARVIS_SHELL_ACTIVE__ = true;

let sheetRef = null;
let shellMounted = false;

// Monte le shell complet (greeting + sheet + carte Leaflet + pins).
// 100% indépendant : pas de callback Google Maps, juste DOMContentLoaded.
async function bootJarvis() {
  if (shellMounted) return;
  shellMounted = true;
  console.log('[JARVIS] Bootstrap Phase 1 (Leaflet)');

  // 1. Conteneur carte
  let mapEl = document.getElementById('jarvis-map');
  if (!mapEl) {
    mapEl = document.createElement('div');
    mapEl.id = 'jarvis-map';
    mapEl.className = 'jarvis-map';
    document.body.appendChild(mapEl);
  }

  // 2. Greeting top
  const pharmacies = readPharmaciesFromAppGlobal();
  const stats = computeStats(pharmacies);
  const greeting = createGreeting({
    userName: 'William',
    territoryLabel: 'Manche · Sud',
    stats,
  });
  document.body.appendChild(greeting);

  // 3. Sheet bottom
  sheetRef = createSheet(initialBubbleForStats(stats));
  document.body.appendChild(sheetRef);

  // 4. Init Leaflet
  try {
    initMap('jarvis-map');
  } catch (err) {
    console.warn('[JARVIS] initMap failed, carte indisponible :', err);
    return;
  }

  // 5. Pins
  await whenMapReady();
  await renderPharmacyPins(pharmacies, computeStatusForPharma);
  fitBoundsToPoints(pharmacies);

  // 6. Pin click → update sheet bubble + recentre carte
  setPinClickHandler((pharma) => {
    if (sheetRef) updateSheetBubble(sheetRef, pinClickBubble(pharma));
  });

  console.log(`[JARVIS] Phase 1 ready · ${pharmacies.length} pharmacies rendues`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootJarvis);
} else {
  bootJarvis();
}

function readPharmaciesFromAppGlobal() {
  // Lit CLIENTS depuis clients-data.js et matche les coordonnées GPS
  // depuis pharmacies-geo.js (généré par geocode_pharmacies.py).
  const raw = (typeof window !== 'undefined' && window.CLIENTS) ? window.CLIENTS : [];
  const geo = (typeof window !== 'undefined' && window.PHARMACIES_GEO) ? window.PHARMACIES_GEO : {};
  return raw
    .map((p) => {
      const g = geo[p.cip];
      if (!g) return null; // pharma sans géocodage : on l'ignore pour le rendu carte
      return { ...p, lat: g.lat, lng: g.lng, geoScore: g.score };
    })
    .filter(Boolean);
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
  return `<strong>JARVIS</strong> · ${stats.total} officines géolocalisées sur ton territoire. Tape un pin pour voir la fiche.`;
}

function pinClickBubble(pharma) {
  const ville = pharma.ville || '';
  const cip = pharma.cip || '—';
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${pharma.lat},${pharma.lng}`;
  return `<strong>${escape(pharma.nom)}</strong> · ${escape(ville)} · CIP ${escape(cip)}<br>
    <a href="${gmapsUrl}" target="_blank" rel="noopener" style="color:var(--blue);font-weight:600;font-size:12px">Itinéraire dans Google Maps ↗</a>`;
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// JARVIS · pins.js
// Rendu des pins pharmacies sur la carte Leaflet via L.marker + L.divIcon.

import { whenMapReady, panTo } from './map.js';
import { computePharmacyStatus, colorForStatus } from './pharmacy-status.js';

const activeMarkers = [];

function buildPinHtml(color, isAlert) {
  const pulse = isAlert ? ' jarvis-pin-pulse' : '';
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" class="jarvis-pin-svg${pulse}">
      <circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="3"
              filter="drop-shadow(0 3px 6px rgba(11,31,77,.3))"/>
    </svg>`;
}

function buildDivIcon(color, isAlert) {
  return window.L.divIcon({
    html: buildPinHtml(color, isAlert),
    className: 'jarvis-pin-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export async function renderPharmacyPins(pharmacies, statusComputer) {
  const map = await whenMapReady();
  if (!map) return;
  clearPins();

  for (const pharma of pharmacies) {
    if (!pharma.lat || !pharma.lng) continue;
    const status = statusComputer ? statusComputer(pharma) : computePharmacyStatus(pharma);
    const color = colorForStatus(status);
    const icon = buildDivIcon(color, status === 'alert');

    const marker = window.L.marker([pharma.lat, pharma.lng], { icon, title: pharma.nom })
      .addTo(map);

    marker.on('click', () => onPinClick(pharma, marker));
    activeMarkers.push(marker);
  }
}

export function clearPins() {
  const map = window.L && activeMarkers[0] ? activeMarkers[0]._map : null;
  activeMarkers.forEach((m) => m.remove());
  activeMarkers.length = 0;
}

let onPinClickHandler = (pharma) => {
  console.log('[JARVIS] Pin clicked:', pharma.nom);
  panTo(pharma.lat, pharma.lng, 14);
};

export function setPinClickHandler(handler) {
  onPinClickHandler = handler;
}

function onPinClick(pharma, marker) {
  onPinClickHandler(pharma, marker);
}

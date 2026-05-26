// JARVIS · pins.js
// Rendu des pins pharmacies sur la carte Google Maps.
// Utilise google.maps.marker.AdvancedMarkerElement avec un SVG inline custom.

import { whenMapReady, panTo } from './map.js';
import { computePharmacyStatus, colorForStatus } from './pharmacy-status.js';

const activeMarkers = [];

function buildPinSvg(color, isAlert) {
  const pulse = isAlert ? '<animate attributeName="r" values="10;14;10" dur="1.8s" repeatCount="indefinite"/>' : '';
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="3"
              filter="drop-shadow(0 3px 6px rgba(11,31,77,.3))">${pulse}</circle>
    </svg>`;
}

function svgToDivIcon(svgString) {
  const div = document.createElement('div');
  div.innerHTML = svgString;
  return div.firstElementChild;
}

export async function renderPharmacyPins(pharmacies, statusComputer) {
  const map = await whenMapReady();
  if (!map) return;
  clearPins();

  for (const pharma of pharmacies) {
    if (!pharma.lat || !pharma.lng) continue;
    const status = statusComputer ? statusComputer(pharma) : computePharmacyStatus(pharma);
    const color = colorForStatus(status);
    const svgEl = svgToDivIcon(buildPinSvg(color, status === 'alert'));

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: pharma.lat, lng: pharma.lng },
      content: svgEl,
      title: pharma.nom,
    });

    marker.addListener('gmp-click', () => onPinClick(pharma, marker));
    activeMarkers.push(marker);
  }
}

export function clearPins() {
  activeMarkers.forEach((m) => (m.map = null));
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

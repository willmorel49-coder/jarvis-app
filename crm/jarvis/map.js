// JARVIS · map.js
// Initialise Leaflet + tiles CartoDB Positron (style Limpide, 100% gratuit).
// Pas de clé API, pas de quota, pas de carte bleue.

let mapInstance = null;
let mapReadyResolvers = [];

const DEFAULT_CENTER = [49.115, -1.088]; // Saint-Lô, Normandie
const DEFAULT_ZOOM = 9;

// Tiles CartoDB Positron : gratuit, style très Apple-Maps clean.
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function initMap(containerId) {
  if (!window.L) {
    console.error('[JARVIS] Leaflet non chargé. Vérifie la balise script dans index.html.');
    return null;
  }
  const el = document.getElementById(containerId);
  if (!el) {
    console.error('[JARVIS] Container map introuvable :', containerId);
    return null;
  }
  mapInstance = window.L.map(el, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: false,
    attributionControl: true,
  });
  window.L.tileLayer(TILE_URL, {
    attribution: TILE_ATTRIB,
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(mapInstance);

  // Petit zoom-control discret en bas-droite
  window.L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

  mapReadyResolvers.forEach((r) => r(mapInstance));
  mapReadyResolvers = [];
  return mapInstance;
}

export function getMap() {
  return mapInstance;
}

export function whenMapReady() {
  if (mapInstance) return Promise.resolve(mapInstance);
  return new Promise((resolve) => mapReadyResolvers.push(resolve));
}

export function panTo(lat, lng, zoom = 13) {
  if (!mapInstance) return;
  mapInstance.flyTo([lat, lng], zoom, { duration: 0.6 });
}

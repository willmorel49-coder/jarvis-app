// JARVIS · map.js
// Initialise Google Maps en mode "Limpide" et expose l'instance.

let mapInstance = null;
let mapReadyResolvers = [];

const LIMPIDE_STYLES = [
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#0B1F4D' }] },
  { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 2 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f8fc' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e8f4ec' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e8eef7' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dde6f3' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d6e8f7' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const DEFAULT_CENTER = { lat: 49.115, lng: -1.088 };
const DEFAULT_ZOOM = 9;

export function initMap(containerId) {
  if (!window.google || !window.google.maps) {
    console.error('[JARVIS] Google Maps API non chargée. Vérifie la balise script dans index.html.');
    return null;
  }
  const el = document.getElementById(containerId);
  if (!el) {
    console.error('[JARVIS] Container map introuvable :', containerId);
    return null;
  }
  mapInstance = new google.maps.Map(el, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    styles: LIMPIDE_STYLES,
    disableDefaultUI: true,
    zoomControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    gestureHandling: 'greedy',
    backgroundColor: '#F7FAFF',
  });
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
  mapInstance.panTo({ lat, lng });
  if (zoom) mapInstance.setZoom(zoom);
}

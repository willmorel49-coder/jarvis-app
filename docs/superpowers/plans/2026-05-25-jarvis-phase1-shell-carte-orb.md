# JARVIS Phase 1 — Shell + Carte + Orb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le shell actuel du CRM (sidebar + dashboard) par un écran unique : carte Google Maps en canvas, pins pharmacies colorés par statut, orb JARVIS animé, sheet glass en bas avec greeting et prompt visuel. Pas encore d'IA réelle, pas encore de lentilles — la base déployable.

**Architecture:** Vanilla JS modulaire (un module par responsabilité), CSS tokens limpides + touches glass, Google Maps JS API en canvas. Aucun build, aucun npm. Sheet et orb sont des composants statiques visuels à ce stade (drag et IA arrivent en phase 2+).

**Tech Stack:** Vanilla JS ES modules · Google Maps JS API · CSS custom properties · Supabase Auth (préservé) · GitHub Pages (push main = deploy).

**Périmètre :** uniquement `/crm/`. L'app `/opso/` n'est pas touchée.

---

## Pré-requis utilisateur (Will, manuel — 10 min)

Avant d'attaquer les tâches, Will doit provisionner la clé Google Maps. Sans elle, la carte ne s'affichera pas.

- [ ] **Pré-requis 0 : Provisionner Google Maps JS API key**

1. Va sur https://console.cloud.google.com/
2. Crée un nouveau projet "JARVIS-CRM" (ou réutilise un existant)
3. Active l'API : **APIs & Services → Library → "Maps JavaScript API" → Enable**
4. Active aussi **"Places API"** (pour autocomplete plus tard)
5. **APIs & Services → Credentials → Create Credentials → API key**
6. Restrictions :
   - Application restrictions : **HTTP referrers (web sites)**
   - Items : `https://willmorel49-coder.github.io/*`, `http://localhost/*`, `file:///*`
   - API restrictions : restrict à Maps JavaScript API + Places API
7. Copie la clé (format `AIza...`)
8. Active la facturation (carte bleue requise) — Google offre $200/mois de crédit gratuit, largement suffisant pour notre usage. Pas de frais en pratique.
9. Donne-moi la clé pour qu'on l'injecte dans `index.html` (ou ajoute-la toi-même au moment où je te le dirai).

⚠️ La clé sera exposée dans le code JS publique. C'est NORMAL pour Maps JS API et c'est pour ça qu'on met des restrictions HTTP referrers (Google bloquera tout appel venant d'un autre domaine).

---

## File Structure

**Files créés :**
- `crm/style.css` — réécriture complète, tokens Limpide + composants de base
- `crm/style-jarvis.css` — nouveau, composants signature JARVIS (orb, sheet glass, pin)
- `crm/jarvis/map.js` — initialisation Google Maps, style "Limpide", controls
- `crm/jarvis/pins.js` — rendu des pins pharmacies depuis `clients-data.js`, couleurs par statut
- `crm/jarvis/orb.js` — composant Orb (SVG + animations CSS)
- `crm/jarvis/sheet.js` — composant Sheet glass (statique pour Phase 1)
- `crm/jarvis/greeting.js` — composant Greeting matinal (génère le brief texte)
- `crm/jarvis/main.js` — entrée principale, bootstrap, glue
- `crm/jarvis/pharmacy-status.js` — utilitaire qui calcule le statut d'une pharmacie (active/visited/warm/alert/prospect)

**Files modifiés :**
- `crm/index.html` — refonte shell complète (suppression sidebar, ajout Maps, conteneurs orb/sheet/greeting, Google Maps script tag)
- `crm/app.js` — suppression de `renderDashboard` et des hooks sidebar, **préservation totale** de la data layer (auth Supabase, clients data, offilog data, etc.)
- `crm/styles-pharmacies.css` — réduction à un commentaire "DEPRECATED — moved to jarvis/* in Phase 1, full removal in Phase 3"
- `crm/styles-offilog.css` — idem, gelé jusqu'à Phase 4

**Files supprimés/désactivés visuellement :**
- Tous les `<div id="page-*">` qui ne sont pas la carte sont cachés via CSS (pour Phase 1, conservés en DOM pour ne pas casser le JS, retirés en Phase 2/3 quand on aura prouvé que rien ne casse)

---

## Convention de tests

Pas de framework de test JS (vanilla JS, pas de build). Chaque tâche se termine par une **vérification manuelle dans le navigateur** :
1. Tu ouvres `file:///Users/williammorel/JARVIS/APP/crm/index.html` ou la prod après push
2. Tu regardes l'écran et la console DevTools
3. Tu valides le critère "Expected" listé dans chaque tâche

C'est notre "TDD" : on définit ce qu'on doit voir AVANT de coder, puis on vérifie.

---

## Task 1: Backup branche + design tokens (CSS)

**Files:**
- Modify: `/Users/williammorel/JARVIS/APP/crm/style.css` (réécriture)

- [ ] **Step 1: Créer une branche de sauvegarde**

```bash
cd /Users/williammorel/JARVIS/APP
git checkout -b backup/pre-jarvis-phase1
git push -u origin backup/pre-jarvis-phase1
git checkout main
```

Expected : branche `backup/pre-jarvis-phase1` créée et pushée. Si pépin pendant Phase 1, on peut revenir à cet état avec `git checkout backup/pre-jarvis-phase1`.

- [ ] **Step 2: Réécrire `crm/style.css` avec les tokens Limpide**

Remplacer intégralement le contenu de `/Users/williammorel/JARVIS/APP/crm/style.css` par :

```css
/* JARVIS · Limpide + Glass · Phase 1 foundation */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Inter+Tight:wght@600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

:root {
  /* Surface */
  --bg: #F7FAFF;
  --surface: #FFFFFF;
  --surface-glass: rgba(255,255,255,.72);
  --surface-glass-strong: rgba(255,255,255,.88);
  --blur: 20px;
  --blur-strong: 30px;

  /* Brand */
  --blue: #007AFF;
  --indigo: #5856D6;
  --violet: #A855F7;
  --orb-gradient: conic-gradient(from 0deg, #007AFF, #5856D6, #A855F7, #007AFF);

  /* Pin status */
  --pin-active: #007AFF;
  --pin-visited: #34C759;
  --pin-alert: #FF3B30;
  --pin-warm: #FF9F1C;
  --pin-prospect: #8E8E93;

  /* Text */
  --text: #0B1F4D;
  --text-dim: #6B7A9F;
  --text-muted: #94A3B8;

  /* Borders */
  --border: rgba(11,31,77,.08);
  --border-glass: rgba(255,255,255,.6);

  /* Radii */
  --r-sm: 10px;
  --r-md: 14px;
  --r-lg: 20px;
  --r-xl: 24px;
  --r-pill: 999px;

  /* Shadows */
  --sh-card: 0 6px 20px rgba(11,31,77,.06);
  --sh-glass: 0 -10px 30px rgba(11,31,77,.06);
  --sh-orb: 0 0 0 4px rgba(0,122,255,.08), 0 4px 16px rgba(0,122,255,.25);

  /* Fonts */
  --font-display: 'Inter Tight', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;  /* Phase 1: la carte prend tout l'écran */
  height: 100vh;
}

h1, h2, h3, h4 {
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: -.5px;
  margin: 0;
  color: var(--text);
}

button, input, textarea, select { font-family: inherit; font-size: inherit; }

/* Cache l'ancienne shell — pages CRM existantes désactivées en Phase 1 */
.sidebar, .topbar, #page-dashboard, #page-pharmacies, #page-offilog,
#page-benchmark, #page-catalogue, #page-wml, #page-groupements,
#page-prospects, #page-objectifs, #page-admin, #page-import,
#page-prioritaires, #page-visites, #page-simulator { display: none !important; }

/* Le main devient la canvas pleine page */
main, #main { display: block !important; position: fixed; inset: 0; padding: 0; margin: 0; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

- [ ] **Step 3: Commit Task 1**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/style.css
git commit -m "feat(jarvis-p1): nouveaux tokens CSS Limpide + Inter Tight"
```

Pas de push tout de suite — on accumule jusqu'à un déliverable visible.

---

## Task 2: Composants signature JARVIS (CSS)

**Files:**
- Create: `/Users/williammorel/JARVIS/APP/crm/style-jarvis.css`

- [ ] **Step 1: Créer `crm/style-jarvis.css` avec les composants signature**

Contenu complet du fichier :

```css
/* JARVIS · Composants signature · Phase 1 */

/* ============ ORB ============ */
.jarvis-orb {
  display: inline-block;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, rgba(255,255,255,.4), transparent 50%),
    var(--orb-gradient);
  box-shadow: var(--sh-orb);
  position: relative;
  animation: jarvisOrbSpin 8s linear infinite, jarvisOrbPulse 2.5s ease-in-out infinite;
  flex-shrink: 0;
}
.jarvis-orb::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: conic-gradient(from 180deg, transparent, rgba(0,122,255,.25), transparent);
  animation: jarvisOrbHalo 3s linear infinite;
  z-index: -1;
  filter: blur(8px);
}
.jarvis-orb--lg { width: 88px; height: 88px; }
.jarvis-orb--md { width: 36px; height: 36px; }
.jarvis-orb--sm { width: 22px; height: 22px; animation-duration: 4s, 2.5s; }
.jarvis-orb--mini { width: 16px; height: 16px; animation-duration: 4s, 2.5s; }
.jarvis-orb--sm::after, .jarvis-orb--mini::after { display: none; }

@keyframes jarvisOrbSpin { to { transform: rotate(360deg); } }
@keyframes jarvisOrbHalo { to { transform: rotate(-360deg); } }
@keyframes jarvisOrbPulse {
  0%, 100% { box-shadow: var(--sh-orb); }
  50% { box-shadow: 0 0 0 10px rgba(0,122,255,.04), 0 8px 24px rgba(0,122,255,.35); }
}

/* ============ GREETING (top de la carte) ============ */
.jarvis-greeting {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: env(safe-area-inset-top, 12px) 18px 14px;
  z-index: 30;
  pointer-events: none;  /* laisse passer le clic vers la carte sauf sur le contenu */
}
.jarvis-greeting > * { pointer-events: auto; }
.jarvis-greeting-hi {
  font-size: 13px;
  color: var(--text-dim);
  font-weight: 500;
  margin: 0 0 2px;
}
.jarvis-greeting-title {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -.6px;
  color: var(--text);
  line-height: 1.05;
  margin: 0;
}
.jarvis-greeting-sub {
  font-size: 12.5px;
  color: var(--text-dim);
  font-weight: 500;
  margin: 3px 0 0;
}

/* ============ SHEET (bottom glass) ============ */
.jarvis-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  background: var(--surface-glass);
  backdrop-filter: blur(var(--blur)) saturate(150%);
  -webkit-backdrop-filter: blur(var(--blur)) saturate(150%);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  border-top: 1px solid var(--border-glass);
  box-shadow: var(--sh-glass);
  z-index: 40;
  max-width: 480px;
  margin: 0 auto;
}
.jarvis-sheet-handle {
  width: 32px;
  height: 4px;
  background: rgba(11,31,77,.18);
  border-radius: 2px;
  margin: 0 auto 12px;
}
.jarvis-sheet-bubble {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: rgba(0,122,255,.08);
  border-radius: 14px;
  padding: 10px 12px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--text);
  line-height: 1.45;
}
.jarvis-sheet-bubble-content { flex: 1; }
.jarvis-sheet-bubble-content strong { color: var(--blue); font-weight: 700; }

.jarvis-prompt {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border-radius: var(--r-pill);
  padding: 10px 14px;
  border: 1px solid var(--border);
  font-size: 14px;
  color: var(--text-muted);
}
.jarvis-prompt-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--text);
}
.jarvis-prompt-input::placeholder { color: var(--text-muted); }
.jarvis-mic {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--text);
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
}

/* ============ MAP CONTAINER ============ */
.jarvis-map {
  position: fixed;
  inset: 0;
  z-index: 1;
}
.jarvis-map .gm-style-iw-c { border-radius: var(--r-lg) !important; }  /* InfoWindow Apple-like */

/* ============ DESKTOP RESPONSIVE ============ */
@media (min-width: 769px) {
  body { background:
    radial-gradient(ellipse at 20% 20%, rgba(0,122,255,.05), transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(168,85,247,.04), transparent 50%),
    var(--bg);
  }
  .jarvis-greeting { max-width: 480px; left: 50%; transform: translateX(-50%); }
  .jarvis-map { inset: 0; }  /* la carte reste pleine page mais la sheet et le greeting sont centrés en 480px */
}
```

- [ ] **Step 2: Vérifier qu'aucune classe ne casse les pages existantes**

```bash
cd /Users/williammorel/JARVIS/APP
grep -E "jarvis-(orb|sheet|greeting|map|prompt|mic)" crm/app.js crm/index.html | head -5
```

Expected : aucune occurrence (les classes sont nouvelles, pas de collision avec l'existant).

- [ ] **Step 3: Commit Task 2**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/style-jarvis.css
git commit -m "feat(jarvis-p1): composants signature orb + sheet + greeting"
```

---

## Task 3: Module `pharmacy-status.js` (logique métier pure)

**Files:**
- Create: `/Users/williammorel/JARVIS/APP/crm/jarvis/pharmacy-status.js`

- [ ] **Step 1: Créer le dossier jarvis/**

```bash
mkdir -p /Users/williammorel/JARVIS/APP/crm/jarvis
```

- [ ] **Step 2: Écrire la fonction `computePharmacyStatus`**

Créer `/Users/williammorel/JARVIS/APP/crm/jarvis/pharmacy-status.js` avec :

```javascript
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
```

- [ ] **Step 3: Vérification manuelle dans la console**

Ouvre n'importe quelle page de l'app dans le navigateur, ouvre la console DevTools et tape :

```javascript
const m = await import('./jarvis/pharmacy-status.js');
console.log(m.computePharmacyStatus({}, { hasAlert: true }));   // doit afficher "alert"
console.log(m.computePharmacyStatus({}, { lastVisitDaysAgo: 10 }));  // "visited"
console.log(m.computePharmacyStatus({}, { lastVisitDaysAgo: 120 })); // "warm"
console.log(m.computePharmacyStatus({}, { isProspect: true }));      // "prospect"
console.log(m.colorForStatus('alert'));                              // "#FF3B30"
```

Expected : toutes les valeurs ci-dessus exactes.

- [ ] **Step 4: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/jarvis/pharmacy-status.js
git commit -m "feat(jarvis-p1): module pharmacy-status (logique statut + couleurs pin)"
```

---

## Task 4: Module `map.js` (init Google Maps)

**Files:**
- Create: `/Users/williammorel/JARVIS/APP/crm/jarvis/map.js`

- [ ] **Step 1: Écrire le module map.js**

Créer `/Users/williammorel/JARVIS/APP/crm/jarvis/map.js` avec :

```javascript
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

const DEFAULT_CENTER = { lat: 49.115, lng: -1.088 }; // Saint-Lô, Normandie
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/jarvis/map.js
git commit -m "feat(jarvis-p1): module map (init Google Maps Limpide style)"
```

---

## Task 5: Module `pins.js` (rendu pins pharmacies)

**Files:**
- Create: `/Users/williammorel/JARVIS/APP/crm/jarvis/pins.js`

- [ ] **Step 1: Écrire le module pins.js**

Créer `/Users/williammorel/JARVIS/APP/crm/jarvis/pins.js` avec :

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/jarvis/pins.js
git commit -m "feat(jarvis-p1): module pins (rendu SVG pins par statut)"
```

---

## Task 6: Module `orb.js` (composant Orb)

**Files:**
- Create: `/Users/williammorel/JARVIS/APP/crm/jarvis/orb.js`

- [ ] **Step 1: Écrire le composant Orb**

Créer `/Users/williammorel/JARVIS/APP/crm/jarvis/orb.js` avec :

```javascript
// JARVIS · orb.js
// Composant Orb · gère uniquement le rendu HTML + l'état visuel.
// Les animations sont en CSS (voir style-jarvis.css).

export function createOrb(size = 'md') {
  const el = document.createElement('span');
  el.className = `jarvis-orb jarvis-orb--${size}`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'JARVIS');
  return el;
}

export function setOrbState(orbEl, state) {
  // states: 'idle' | 'thinking' | 'listening' | 'speaking'
  orbEl.dataset.state = state;
  // Phase 1 : tous les états sont visuellement identiques (idle).
  // Phase 2 ajoutera des variantes CSS (.jarvis-orb[data-state="listening"] etc.)
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/jarvis/orb.js
git commit -m "feat(jarvis-p1): composant orb (rendu visuel + état stub)"
```

---

## Task 7: Module `sheet.js` (composant Sheet statique)

**Files:**
- Create: `/Users/williammorel/JARVIS/APP/crm/jarvis/sheet.js`

- [ ] **Step 1: Écrire le composant Sheet**

Créer `/Users/williammorel/JARVIS/APP/crm/jarvis/sheet.js` avec :

```javascript
// JARVIS · sheet.js
// Composant Sheet glass au bas de l'écran.
// Phase 1 : statique (pas de drag, pas d'expand). Drag arrive en Phase 2.

import { createOrb } from './orb.js';

export function createSheet(initialBubbleHtml = '') {
  const sheet = document.createElement('div');
  sheet.className = 'jarvis-sheet';
  sheet.id = 'jarvis-sheet';

  sheet.innerHTML = `
    <div class="jarvis-sheet-handle" aria-hidden="true"></div>
    <div class="jarvis-sheet-bubble" id="jarvis-sheet-bubble">
      <div class="jarvis-sheet-bubble-content">${initialBubbleHtml || '<strong>JARVIS</strong> · prêt.'}</div>
    </div>
    <div class="jarvis-prompt">
      <span class="jarvis-orb jarvis-orb--mini" aria-hidden="true"></span>
      <input class="jarvis-prompt-input" type="text" placeholder="Demande à JARVIS…" disabled />
      <button class="jarvis-mic" aria-label="Mode voix" disabled>🎙</button>
    </div>
  `;
  // Placer un mini-orb à gauche du bubble aussi
  const bubble = sheet.querySelector('.jarvis-sheet-bubble');
  bubble.insertBefore(createOrb('mini'), bubble.firstChild);

  return sheet;
}

export function updateSheetBubble(sheetEl, html) {
  const c = sheetEl.querySelector('.jarvis-sheet-bubble-content');
  if (c) c.innerHTML = html;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/jarvis/sheet.js
git commit -m "feat(jarvis-p1): composant sheet glass (statique, sans drag)"
```

---

## Task 8: Module `greeting.js` (brief matinal)

**Files:**
- Create: `/Users/williammorel/JARVIS/APP/crm/jarvis/greeting.js`

- [ ] **Step 1: Écrire le composant Greeting**

Créer `/Users/williammorel/JARVIS/APP/crm/jarvis/greeting.js` avec :

```javascript
// JARVIS · greeting.js
// Génère le greeting matinal affiché en haut de la carte.
// Phase 1 : règle-based simple (jour de la semaine + comptage statique).
// Phase 8 : connecté au LLM pour brief contextuel.

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function createGreeting({ userName = 'William', territoryLabel = 'Manche · Sud', stats = {} } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'jarvis-greeting';

  const hi = greetingForTime();
  const sub = subForStats(stats);

  wrap.innerHTML = `
    <p class="jarvis-greeting-hi">${hi}, ${escapeHtml(userName)}</p>
    <h1 class="jarvis-greeting-title">${escapeHtml(territoryLabel)}</h1>
    <p class="jarvis-greeting-sub">${sub}</p>
  `;
  return wrap;
}

function greetingForTime() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function subForStats({ visitsToday = 0, alerts = 0 } = {}) {
  const parts = [];
  if (visitsToday > 0) parts.push(`${visitsToday} visite${visitsToday > 1 ? 's' : ''} aujourd'hui`);
  if (alerts > 0) parts.push(`${alerts} alerte${alerts > 1 ? 's' : ''}`);
  if (!parts.length) {
    const today = DAYS_FR[new Date().getDay()];
    return `${today} · territoire en veille`;
  }
  return parts.join(' · ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/jarvis/greeting.js
git commit -m "feat(jarvis-p1): composant greeting (brief matinal règle-based)"
```

---

## Task 9: Module `main.js` (entry point bootstrap)

**Files:**
- Create: `/Users/williammorel/JARVIS/APP/crm/jarvis/main.js`

- [ ] **Step 1: Écrire le bootstrap JARVIS**

Créer `/Users/williammorel/JARVIS/APP/crm/jarvis/main.js` avec :

```javascript
// JARVIS · main.js
// Point d'entrée du shell JARVIS Phase 1. Bootstrap : monte greeting + carte + pins + sheet.

import { initMap, whenMapReady } from './map.js';
import { renderPharmacyPins, setPinClickHandler } from './pins.js';
import { createSheet, updateSheetBubble } from './sheet.js';
import { createGreeting } from './greeting.js';
import { computePharmacyStatus } from './pharmacy-status.js';

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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/jarvis/main.js
git commit -m "feat(jarvis-p1): main bootstrap (greeting + map + pins + sheet)"
```

---

## Task 10: Refonte de `index.html`

**Files:**
- Modify: `/Users/williammorel/JARVIS/APP/crm/index.html`

- [ ] **Step 1: Lire la structure actuelle de `crm/index.html` pour repérer les sections à conserver**

```bash
cd /Users/williammorel/JARVIS/APP
wc -l crm/index.html
```

Expected : ~250 lignes.

Lis le fichier mentalement (ou via Read tool si on est en agent). Repère :
- `<head>` avec scripts CDN (Chart.js, SheetJS, Supabase)
- `<body>` avec sidebar, topbar, page-* divs

- [ ] **Step 2: Réécrire `crm/index.html` en gardant l'auth, les CDN, et la data**

Remplacer intégralement le contenu de `/Users/williammorel/JARVIS/APP/crm/index.html` par :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#007AFF" />
  <title>JARVIS · Intégral Pharma</title>

  <!-- Flag JARVIS shell actif (lu par app.js pour skipper son UI legacy) -->
  <script>window.__JARVIS_SHELL_ACTIVE__ = true;</script>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

  <!-- Styles -->
  <link rel="stylesheet" href="style.css" />
  <link rel="stylesheet" href="style-jarvis.css" />

  <!-- CDN libs (Phase 1 : auth Supabase encore requise) -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.20.3/dist/xlsx.full.min.js"></script>

  <!-- Données métier (préservées) -->
  <script src="clients-data.js"></script>
  <script src="benchmark-data.js"></script>
  <script src="offilog-data.js"></script>
  <script src="drakkars-data.js"></script>
  <script src="cap3000-data.js"></script>
  <script src="groupements-data.js"></script>

  <!-- App.js (data layer préservée, dashboard render désactivé via style.css) -->
  <script src="app.js?v=20260525p1" defer></script>

  <!-- JARVIS shell Phase 1 -->
  <script type="module" src="jarvis/main.js?v=20260525p1"></script>

  <!-- Google Maps JS API (callback global appelle window.initJarvis) -->
  <!-- TODO Will : remplace AIza... par ta clé Google Maps -->
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=AIzaSyD-REPLACE-ME&libraries=marker&v=weekly&callback=initJarvis&loading=async">
  </script>
</head>

<body>
  <!-- Conteneur Maps + composants JARVIS injectés par jarvis/main.js -->
  <div id="jarvis-root"></div>

  <!-- Ancien shell préservé en DOM mais caché via CSS (sidebar, topbar, pages).
       Sera supprimé en Phase 2 quand on aura validé que rien ne casse. -->
  <div id="legacy-shell" hidden>
    <!-- L'ancien contenu reste accessible si besoin de revenir en arrière —
         vide pour Phase 1, sera reconstruit si rollback nécessaire. -->
  </div>
</body>
</html>
```

⚠️ La clé `AIzaSyD-REPLACE-ME` est un placeholder. Au moment de tester, Will doit la remplacer par la vraie clé provisionnée en Pré-requis 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/index.html
git commit -m "feat(jarvis-p1): refonte index.html (shell jarvis, Maps API, ancien shell deprecated)"
```

---

## Task 11: Nettoyage de `app.js` (préserver data, désactiver renders)

**Files:**
- Modify: `/Users/williammorel/JARVIS/APP/crm/app.js`

- [ ] **Step 1: Identifier l'appel à `renderDashboard` dans app.js**

```bash
cd /Users/williammorel/JARVIS/APP
grep -nE "renderDashboard|showPage\(|nav-item" crm/app.js | head -20
```

Expected : tu vois où `renderDashboard` est appelé au bootstrap et où la nav sidebar route les pages.

- [ ] **Step 2: Modifier `initApp()` pour skipper l'UI legacy quand JARVIS est actif**

Le but : que `app.js` continue à charger les données (`load()`, `grpSyncFromStorage()`) et à exposer `window.CLIENTS`, `window.OFFILOG`, etc. — mais qu'il ne touche plus la sidebar/topbar (cachées via CSS) ni `navigate('dashboard')`.

Ouvre `/Users/williammorel/JARVIS/APP/crm/app.js` et localise la fonction `initApp()` autour de la ligne 7183. Elle ressemble actuellement à :

```javascript
async function initApp() {
  if (!state.user) return;
  await load();
  await grpSyncFromStorage();

  document.getElementById('sidebar-user-name').textContent = state.user.name;
  document.getElementById('sidebar-user-role').textContent = state.user.role;
  document.getElementById('sidebar-avatar').textContent = state.user.name.charAt(0);
  document.getElementById('nav-admin').style.display = state.user.role === 'admin' ? 'flex' : 'none';

  updateNavBadge();
  navigate('dashboard');
}
```

Remplacer par :

```javascript
async function initApp() {
  if (!state.user) return;
  await load();
  await grpSyncFromStorage();

  // Si le shell JARVIS Phase 1+ est actif, on s'arrête après la data load.
  // Les données sont disponibles via window.CLIENTS / window.OFFILOG etc.
  // L'UI est gérée par crm/jarvis/main.js (carte + sheet + greeting).
  if (window.__JARVIS_SHELL_ACTIVE__) {
    console.log('[JARVIS] data loaded, legacy UI bypass');
    return;
  }

  document.getElementById('sidebar-user-name').textContent = state.user.name;
  document.getElementById('sidebar-user-role').textContent = state.user.role;
  document.getElementById('sidebar-avatar').textContent = state.user.name.charAt(0);
  document.getElementById('nav-admin').style.display = state.user.role === 'admin' ? 'flex' : 'none';

  updateNavBadge();
  navigate('dashboard');
}
```

- [ ] **Step 3: Activer le flag JARVIS au tout début de `crm/jarvis/main.js`**

Ouvrir `/Users/williammorel/JARVIS/APP/crm/jarvis/main.js` et ajouter en tout début de la fonction `initJarvis()` (juste après `console.log('[JARVIS] Bootstrap Phase 1');`) :

```javascript
  window.__JARVIS_SHELL_ACTIVE__ = true;
```

⚠️ L'ordre d'exécution est important : `initJarvis()` est appelé par le callback Google Maps, qui se charge après le `DOMContentLoaded` qui démarre `initApp()` dans app.js. Donc au moment où `initApp()` vérifie le flag, il sera **false** si la carte n'a pas encore chargé.

Solution : on déplace l'init du flag AU CHARGEMENT DU MODULE, pas dans `initJarvis()`. Ouvrir `crm/jarvis/main.js` et **avant** la ligne `window.initJarvis = ...`, ajouter :

```javascript
// Active le flag dès le chargement du module pour que app.js skip son UI legacy.
window.__JARVIS_SHELL_ACTIVE__ = true;
```

C'est cette version finale qui est correcte. Le flag est posé au parse du module (qui se fait avant `DOMContentLoaded` car `<script type="module">` est `defer` par défaut, mais évalué avant DOMContentLoaded handler).

Pour être 100% safe, on peut aussi ajouter ce flag DIRECTEMENT dans `crm/index.html` `<head>` :

```html
<script>window.__JARVIS_SHELL_ACTIVE__ = true;</script>
```

C'est l'option la plus simple. **Utilise celle-ci** : ajoute cette ligne dans `crm/index.html` juste après `<title>...</title>` et avant `<link rel="stylesheet"...>`.

- [ ] **Step 3: Vérifier qu'aucun render legacy n'est appelé**

Ouvre `file:///Users/williammorel/JARVIS/APP/crm/index.html` dans le navigateur (avec la vraie clé Maps).

Ouvre la console DevTools. Tu dois voir :
- `[JARVIS] Bootstrap Phase 1`
- `[JARVIS] Phase 1 ready · 517 pharmacies rendues`
- **Pas** de log venant de `renderDashboard` ou des renders pharmacies legacy.

Tu dois voir à l'écran :
- Une carte Google Maps centrée sur Saint-Lô
- Des pins colorés répartis
- Un greeting "Bonjour William · Manche · Sud" en haut
- Une sheet glass au bas avec un message JARVIS

- [ ] **Step 4: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/app.js crm/jarvis/main.js
git commit -m "feat(jarvis-p1): bypass des renders legacy quand shell JARVIS actif"
```

---

## Task 12: Test responsive + dégradation gracieuse

**Files:** (aucune création)

- [ ] **Step 1: Test desktop**

Ouvre `file:///Users/williammorel/JARVIS/APP/crm/index.html` dans Chrome/Safari desktop.

Expected :
- Greeting centré dans une colonne 480px
- Carte pleine largeur
- Sheet en bas centré 480px
- Aucun horizontal scroll
- Console : aucune erreur rouge

- [ ] **Step 2: Test mobile (devtools responsive iPhone 14)**

Chrome DevTools → toggle device toolbar → iPhone 14 Pro.

Expected :
- Layout pleine largeur
- Greeting top safe-area respecté (notch)
- Sheet bottom safe-area respecté (home bar)
- Carte gestures (pinch zoom) opérationnelles

- [ ] **Step 3: Test sans clé Maps (cas dégradé)**

Remplace temporairement la clé dans `index.html` par `AIzaSyD-INVALID-KEY`, refresh.

Expected :
- La carte ne s'affiche pas
- La console montre une erreur Google Maps explicite
- Le greeting et la sheet s'affichent quand même (pas de crash)

Remets la vraie clé après.

- [ ] **Step 4: Commit (rien à commit, mais on note l'OK manuel)**

```bash
cd /Users/williammorel/JARVIS/APP
git commit --allow-empty -m "test(jarvis-p1): responsive desktop + mobile + dégradation OK"
```

---

## Task 13: Documentation rapide pour Will

**Files:**
- Create: `/Users/williammorel/JARVIS/APP/crm/jarvis/README.md`

- [ ] **Step 1: Écrire un README JARVIS**

Créer `/Users/williammorel/JARVIS/APP/crm/jarvis/README.md` avec :

```markdown
# JARVIS · crm/jarvis/

Shell visuel du CRM Intégral Pharma : carte + orb + sheet. Voir spec : `docs/superpowers/specs/2026-05-25-jarvis-territoire-agent-design.md`.

## État Phase 1
- `main.js` — bootstrap, monte les composants au load Google Maps
- `map.js` — wrapper Google Maps (style Limpide)
- `pins.js` — rendu pins pharmacies (AdvancedMarkerElement)
- `orb.js` — composant Orb (animation CSS)
- `sheet.js` — sheet glass statique
- `greeting.js` — brief matinal règle-based
- `pharmacy-status.js` — logique statut (active/visited/warm/alert/prospect)

## Prochaines phases
- Phase 2 : drag sheet, états orb (listening/speaking), morph fiche pharmacie
- Phase 3 : lentille Journal + Google Calendar OAuth
- Phase 4 : lentille Catalogue
- Phase 5-6 : lentille RDV + page publique booking
- Phase 7 : lentille Pilotage
- Phase 8 : IA réelle (Claude API)
- Phase 9 : mode voix (Web Speech API)
- Phase 10 : import KML

## Clé Google Maps
Définie dans `crm/index.html` ligne du script Maps. Restrictions HTTP referrer : `*.github.io/*` + `localhost/*` + `file:///*`.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/jarvis/README.md
git commit -m "docs(jarvis-p1): README modules jarvis"
```

---

## Task 14: Push + déploiement GitHub Pages

**Files:** (aucune création)

- [ ] **Step 1: Vérifier l'état du repo**

```bash
cd /Users/williammorel/JARVIS/APP
git log --oneline -15
git status
```

Expected : 13 commits Phase 1 sur main, working tree clean.

- [ ] **Step 2: Push**

```bash
cd /Users/williammorel/JARVIS/APP
git push origin main
```

Expected : push réussi, GitHub Pages déploie automatiquement dans 1-2 min.

- [ ] **Step 3: Vérifier en prod**

Ouvre https://willmorel49-coder.github.io/jarvis-app/crm/ dans un onglet incognito (pour éviter le cache).

Expected :
- Greeting "Bonjour William · Manche · Sud"
- Carte Google Maps Limpide centrée sur Saint-Lô
- Pins colorés répartis (517 pharmacies)
- Sheet glass en bas avec message JARVIS
- Aucune erreur console
- Le clic sur un pin met à jour la bubble dans la sheet

Si une erreur Google Maps apparaît du genre "RefererNotAllowedMapError", c'est que la restriction HTTP referrer n'autorise pas `github.io`. Aller dans la console Google Cloud et ajouter `https://willmorel49-coder.github.io/*`.

- [ ] **Step 4: Marquer la phase 1 comme terminée**

```bash
cd /Users/williammorel/JARVIS/APP
git tag -a v-jarvis-p1 -m "JARVIS Phase 1 deployed : shell carte + orb + sheet statique"
git push origin v-jarvis-p1
```

---

## Critères d'acceptation Phase 1

À la fin de ce plan, en ouvrant https://willmorel49-coder.github.io/jarvis-app/crm/ :

- ✅ Plus de sidebar à gauche
- ✅ Plus de dashboard avec KPI cards
- ✅ Une carte Google Maps style Limpide en plein écran
- ✅ Des pins colorés (bleu/vert/orange/rouge/gris) répartis sur le territoire
- ✅ Un greeting personnalisé en haut ("Bonjour William · Manche · Sud · X officines sur ton territoire")
- ✅ Une sheet glass en bas avec un orb mini + bubble + prompt visuel (input désactivé, pas encore d'IA)
- ✅ Le clic sur un pin met à jour le bubble avec nom + ville + CIP
- ✅ Le tout marche en mobile et desktop, sans crash

Ce qui **n'est PAS encore là** (phases suivantes) :
- Drag de la sheet (Phase 2)
- Animation des états orb (Phase 2)
- Morph sheet → fiche pharmacie au tap pin (Phase 2)
- Lentilles (Catalogue, Journal, RDV, Pilotage) — Phases 3 à 7
- IA réelle — Phase 8
- Mode voix — Phase 9
- Import KML pharmacies — Phase 10 (les pins sont sur coordonnées approximatives en attendant)

---

## Notes pour l'agent exécutant

1. **Garde la data layer intacte** : `crm/clients-data.js`, `crm/benchmark-data.js`, `crm/offilog-data.js`, etc. ne doivent JAMAIS être modifiés en Phase 1.
2. **Préserve Supabase auth** : si elle est wrappée par `app.js`, garde l'init mais n'expose pas l'UI login (Phase 1 ne touche pas l'auth UX, on assume Will déjà loggé).
3. **Ne touche pas à `/opso/`** : c'est une autre app, autre DA.
4. **Aucun build, aucun npm** : tout doit fonctionner en ouvrant directement `index.html`.
5. **Commits fréquents** : un par task, comme spécifié. Push à la fin (Task 14).
6. **Pas de fichiers de log/cache committés** : `crm/jarvis/.DS_Store` ou autres → vérifie `.gitignore`.
7. **Si une lib externe te tente** (Leaflet, React, etc.) → STOP. C'est vanilla JS only, c'est la règle ROBOT.md.

Bonne route 🚀

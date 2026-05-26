// JARVIS · main.js
// Bootstrap : carte Leaflet + greeting + sheet draggable + lentilles + voix + intents.

import { initMap, whenMapReady, fitBoundsToPoints, panTo } from './map.js';
import { renderPharmacyPins, setPinClickHandler } from './pins.js';
import {
  createSheet, updateSheetBubble, showFicheInSheet, resetSheetToBubble,
  setSheetSnap,
} from './sheet.js';
import { createGreeting } from './greeting.js';
import { computePharmacyStatus } from './pharmacy-status.js';
import { setAllOrbsState } from './orb.js';
import { renderPharmaFiche } from './pharma-fiche.js';
import { openLens } from './lens.js';
import { parseAndRunIntent } from './intents.js';
import { isVoiceSupported, startListening, stopListening, speak } from './voice.js';

// Imports nécessaires pour enregistrer les lentilles
import './lens-catalogue.js';
import './lens-pilotage.js';
import './lens-journal.js';
import './lens-rdv.js';

window.__JARVIS_SHELL_ACTIVE__ = true;

let sheetRef = null;
let shellMounted = false;
let allPharmacies = [];
let currentPharma = null;

async function bootJarvis() {
  if (shellMounted) return;
  shellMounted = true;
  console.log('[JARVIS] Bootstrap Phase 2+ (Leaflet · lentilles · voix)');

  // 1. Conteneur carte
  let mapEl = document.getElementById('jarvis-map');
  if (!mapEl) {
    mapEl = document.createElement('div');
    mapEl.id = 'jarvis-map';
    mapEl.className = 'jarvis-map';
    document.body.appendChild(mapEl);
  }

  // 2. Greeting top
  allPharmacies = readPharmaciesFromAppGlobal();
  const stats = computeStats(allPharmacies);
  const greeting = createGreeting({
    userName: 'William',
    territoryLabel: 'Bretagne · Normandie · Loire',
    stats,
  });
  document.body.appendChild(greeting);

  // 3. Sheet bottom (avec prompt actif maintenant)
  sheetRef = createSheet(initialBubbleForStats(stats));
  document.body.appendChild(sheetRef);
  setupPromptHandler(sheetRef);
  setupMicHandler(sheetRef);
  setupShortcuts(sheetRef);

  // 4. Init Leaflet
  try {
    initMap('jarvis-map');
  } catch (err) {
    console.warn('[JARVIS] initMap failed :', err);
    return;
  }

  // 5. Pins
  await whenMapReady();
  await renderPharmacyPins(allPharmacies, computeStatusForPharma);
  fitBoundsToPoints(allPharmacies);

  // 6. Pin click → morph fiche pharma
  setPinClickHandler((pharma) => {
    currentPharma = pharma;
    showFicheInSheet(sheetRef, renderPharmaFiche(pharma));
    panTo(pharma.lat, pharma.lng, 12);
    wireFicheCloseBtn();
    setAllOrbsState('idle');
  });

  console.log(`[JARVIS] Ready · ${allPharmacies.length} pharmacies`);
}

function wireFicheCloseBtn() {
  const btn = document.getElementById('pharma-fiche-close');
  if (btn) {
    btn.addEventListener('click', () => {
      resetSheetToBubble(sheetRef, defaultBubble());
      currentPharma = null;
    });
  }
}

function setupPromptHandler(sheet) {
  const input = sheet.querySelector('.jarvis-prompt-input');
  if (!input) return;
  input.disabled = false;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      handleCommand(value);
      input.value = '';
    }
  });
}

function setupMicHandler(sheet) {
  const btn = sheet.querySelector('.jarvis-mic');
  if (!btn) return;
  btn.disabled = false;

  if (!isVoiceSupported()) {
    btn.title = 'Voix non supportée par ton navigateur';
    btn.style.opacity = '.4';
    return;
  }

  let listening = false;
  btn.addEventListener('click', () => {
    if (listening) {
      stopListening();
      listening = false;
      setAllOrbsState('idle');
      btn.classList.remove('jarvis-mic--on');
      return;
    }
    listening = true;
    setAllOrbsState('listening');
    btn.classList.add('jarvis-mic--on');
    updateSheetBubble(sheetRef, '<strong>JARVIS</strong> · j\'écoute…');
    startListening({
      onResult: (transcript) => {
        listening = false;
        btn.classList.remove('jarvis-mic--on');
        setAllOrbsState('thinking');
        updateSheetBubble(sheetRef, `<em>« ${escapeHtml(transcript)} »</em>`);
        setTimeout(() => handleCommand(transcript, { voiceResponse: true }), 300);
      },
      onEnd: () => {
        listening = false;
        btn.classList.remove('jarvis-mic--on');
        setAllOrbsState('idle');
      },
      onError: (err) => {
        listening = false;
        btn.classList.remove('jarvis-mic--on');
        setAllOrbsState('idle');
        updateSheetBubble(sheetRef, `<strong>JARVIS</strong> · erreur voix : ${escapeHtml(String(err))}`);
      },
    });
  });
}

function setupShortcuts(sheet) {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = sheet.querySelector('.jarvis-prompt-input');
      if (input) { input.focus(); setSheetSnap(sheet, 'medium'); }
    }
  });
}

function handleCommand(text, opts = {}) {
  setAllOrbsState('thinking');
  parseAndRunIntent(text, {
    openLens: (id) => {
      respond(`Ouverture de la lentille <strong>${id}</strong>.`, opts);
      openLens(id);
    },
    searchPharma: (q) => searchPharmacy(q, opts),
    respond: (msg) => respond(msg, opts),
  });
  setTimeout(() => setAllOrbsState('idle'), 600);
}

function searchPharmacy(query, opts = {}) {
  const q = query.toLowerCase().trim();
  if (!q) return;
  const match = allPharmacies.find((p) =>
    (p.nom || '').toLowerCase().includes(q) ||
    (p.ville || '').toLowerCase().includes(q) ||
    (p.cip || '').includes(q)
  );
  if (!match) {
    respond(`Aucune officine trouvée pour <em>« ${escapeHtml(query)} »</em>.`, opts);
    return;
  }
  currentPharma = match;
  panTo(match.lat, match.lng, 13);
  showFicheInSheet(sheetRef, renderPharmaFiche(match));
  wireFicheCloseBtn();
  if (opts.voiceResponse) speak(`${match.nom} à ${match.ville}, je te montre.`);
}

function respond(htmlMsg, opts = {}) {
  updateSheetBubble(sheetRef, htmlMsg);
  if (opts.voiceResponse) speak(htmlMsg);
}

function readPharmaciesFromAppGlobal() {
  const raw = window.CLIENTS || [];
  const geo = window.PHARMACIES_GEO || {};
  return raw
    .map((p) => {
      const g = geo[p.cip];
      if (!g) return null;
      return { ...p, lat: g.lat, lng: g.lng, geoScore: g.score };
    })
    .filter(Boolean);
}

function computeStatusForPharma(p) {
  if (!p.ca2023 || p.ca2023 === 0) return computePharmacyStatus(p, { isProspect: true });
  return computePharmacyStatus(p, {});
}

function computeStats(pharmacies) {
  return {
    visitsToday: 0,
    alerts: 0,
    total: pharmacies.length,
  };
}

function defaultBubble() {
  return `<strong>JARVIS</strong> · ${allPharmacies.length} officines géolocalisées. Tape un pin, ou demande "catalogue", "mes visites", "CA"…`;
}

function initialBubbleForStats(stats) {
  return `<strong>JARVIS</strong> · ${stats.total} officines géolocalisées. Tape un pin, ou demande "catalogue", "mes visites", "CA"…`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootJarvis);
} else {
  bootJarvis();
}

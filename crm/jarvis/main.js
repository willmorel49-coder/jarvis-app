// JARVIS · main.js
// Bootstrap : carte Leaflet + greeting + sheet draggable + lentilles + voix + intents.

import { initMap, whenMapReady, fitBoundsToPoints, panTo } from './map.js';
import { renderPharmacyPins, setPinClickHandler } from './pins.js';
import {
  createSheet, updateSheetBubble, showFicheInSheet, resetSheetToBubble,
  setSheetSnap,
} from './sheet.js';
import { createGreeting } from './greeting.js';
import { computePharmacyStatus, isInTerritory, TERRITORY_DEPTS } from './pharmacy-status.js';
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
// Nouveaux modules : widget pilotage accueil + lens devis exportable
import { showPilotageWidget } from './pilotage-widget.js';
import { openDevisLens } from './lens-devis.js';

// Expose openDevisLens sur window pour que la fiche pharma (bouton "Préparer un devis") puisse l'appeler
window.openDevisLens = openDevisLens;

// Note : __JARVIS_SHELL_ACTIVE__ et __JARVIS_MODE__ sont posés dans crm/index.html (head)
// On ne boot le shell que si le mode JARVIS est actif.
if (typeof window.__JARVIS_SHELL_ACTIVE__ === 'undefined') {
  window.__JARVIS_SHELL_ACTIVE__ = true;
}

let sheetRef = null;
let shellMounted = false;
let allPharmacies = [];
let currentPharma = null;

const JARVIS_VERSION = '20260601b · 808 clients';

async function bootJarvis() {
  if (shellMounted) return;
  shellMounted = true;
  console.log(`[JARVIS] Bootstrap ${JARVIS_VERSION}`);
  console.log('[JARVIS] data check :',
    'CLIENTS=' + (window.CLIENTS || []).length,
    'CATALOGUE_IP=' + (window.CATALOGUE_IP || []).length,
    'SALES_TOTAL=' + (window.SALES_TOTAL ? window.SALES_TOTAL.ca + '€' : 'absent')
  );

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
    territoryLabel: 'Mon territoire · 8 dpts',
    stats,
  });
  document.body.appendChild(greeting);

  // 2b. Widget pilotage en accueil (CA mois, % objectif, top client, alertes, sparkline 8 mois)
  showPilotageWidget(document.body, { delay: 600, objectif: 200000 });

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
  // Source : CRM Intégral Pharma (window.CLIENTS) + géocodages (window.PHARMACIES_GEO).
  // Filtre territoire commercial : 8 dpts (14·35·37·44·49·50·53·72).
  const raw = window.CLIENTS || [];
  const geo = window.PHARMACIES_GEO || {};
  return raw
    .filter(isInTerritory)
    .map((p) => {
      const g = geo[p.cip];
      if (!g) return null;
      return { ...p, lat: g.lat, lng: g.lng, geoScore: g.score };
    })
    .filter(Boolean);
}

function computeStatusForPharma(p) {
  // computePharmacyStatus utilise déjà ca2023 et potentielGx pour décider
  // active / prospect_hot / prospect_cold (cf pharmacy-status.js).
  return computePharmacyStatus(p, {});
}

function computeStats(pharmacies) {
  let clientsActifs = 0, clientsPassifs = 0, prospectsHot = 0, prospectsCold = 0, sectorCa = 0;
  for (const p of pharmacies) {
    const ca = p.ca2023 || 0;
    if (ca > 0) { clientsActifs++; sectorCa += ca; continue; }
    const hasGroupement = !!(p.gros1 || p.gros2 || (p.ecodage && String(p.ecodage).trim()));
    if (hasGroupement) { clientsPassifs++; continue; }
    if ((p.potentielGx || 0) > 0) prospectsHot++;
    else prospectsCold++;
  }
  return {
    visitsToday: 0,
    alerts: 0,
    total: pharmacies.length,
    clients: clientsActifs + clientsPassifs,
    clientsActifs,
    clientsPassifs,
    prospectsHot,
    prospectsCold,
    sectorCa,
  };
}

function defaultBubble() {
  const stats = computeStats(allPharmacies);
  return bubbleForStats(stats);
}

function initialBubbleForStats(stats) {
  return bubbleForStats(stats);
}

function bubbleForStats(stats) {
  const caStr = stats.sectorCa ? ` · <b>${formatEuroShort(stats.sectorCa)}</b> secteur` : '';
  const breakdown = stats.clientsActifs > 0 ? ` (${stats.clientsActifs} actifs)` : '';
  return `<strong>JARVIS</strong> · ${stats.clients} client${stats.clients > 1 ? 's' : ''}${breakdown}${caStr} · <span style="color:#FF9F1C;font-weight:700">${stats.prospectsHot} à démarcher</span>. Tape un pin, ou demande "secteur", "catalogue"…`;
}

function formatEuroShort(n) {
  if (!n) return '0 €';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (abs >= 1000) return `${(n / 1000).toFixed(0)} k€`;
  return `${Math.round(n)} €`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function startWhenReady() {
  if (window.__JARVIS_MODE__ === 'classic') {
    console.log('[JARVIS] Mode classique actif, shell non démarré.');
    return;
  }
  bootJarvis();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startWhenReady);
} else {
  startWhenReady();
}

#!/usr/bin/env node
/**
 * Component Bot — vérifie la présence des composants UI canoniques
 * sur chaque surface : .card, .modal, .badge, .pill, .btn, .kpi.
 */
import { SURFACES, readAllCss, readSurfaceFile, classDefined } from '../lib/scanner.mjs';
import { writeReport, scoreFrom } from '../lib/bot-utils.mjs';

const BOT_ID = 'component-bot';
const BOT_NAME = 'Component Bot';
const surfaces = Object.keys(SURFACES);

const CANONICAL = [
  { name: '.card',       desc: 'Conteneur générique' },
  { name: '.modal',      desc: 'Fenêtre modale' },
  { name: '.badge',      desc: 'Petite pastille statut' },
  { name: '.pill',       desc: 'Filtre cliquable arrondi' },
  { name: '.btn',        desc: 'Bouton primaire' },
  { name: '.kpi',        desc: 'Tuile KPI' },
  { name: '.empty',      desc: 'État vide' },
  { name: '.section-header-title', desc: "En-tête de section" },
];

const findings = [];
const matrix = {};

for (const c of CANONICAL) {
  matrix[c.name] = {};
  for (const s of surfaces) {
    const css = readAllCss(s);
    matrix[c.name][s] = classDefined(css, c.name);
  }
  const definedIn = surfaces.filter(s => matrix[c.name][s]);
  if (definedIn.length === 0) {
    findings.push({
      component: c.name,
      desc: c.desc,
      type: 'missing-everywhere',
      label: `${c.name} introuvable dans toutes les surfaces`,
      severity: 'warn',
    });
  } else if (definedIn.length < surfaces.length) {
    findings.push({
      component: c.name,
      desc: c.desc,
      type: 'partial-coverage',
      label: `${c.name} défini dans ${definedIn.join('+')} seulement`,
      definedIn,
      missingFrom: surfaces.filter(s => !matrix[c.name][s]),
      severity: 'warn',
    });
  }
}

const totalChecks = CANONICAL.length;
const issueCount = findings.length;
const score = scoreFrom(issueCount, totalChecks);

const report = {
  botId: BOT_ID,
  botName: BOT_NAME,
  generatedAt: new Date().toISOString(),
  score,
  summary: {
    totalComponents: CANONICAL.length,
    issueCount,
    matrix,
  },
  surfaces: surfaces.map(s => ({ key: s, label: SURFACES[s].label })),
  findings,
};

const out = writeReport(import.meta.url, BOT_ID, report);
console.log(`✓ ${BOT_NAME} — score ${score}/100 (${issueCount} composants divergents) · → ${out}`);

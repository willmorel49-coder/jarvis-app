#!/usr/bin/env node
/**
 * Radius Bot — audit de l'échelle des border-radius.
 */
import { SURFACES, readAllCss, extractBorderRadii } from '../lib/scanner.mjs';
import { writeReport, scoreFrom } from '../lib/bot-utils.mjs';

const BOT_ID = 'radius-bot';
const BOT_NAME = 'Radius Bot';
const surfaces = Object.keys(SURFACES);

const data = {};
for (const s of surfaces) {
  data[s] = extractBorderRadii(readAllCss(s));
}

const findings = [];

// 1) Compter le nombre de valeurs distinctes par surface (≤ 5 idéalement)
for (const s of surfaces) {
  const distinct = data[s].size;
  if (distinct > 6) {
    findings.push({
      type: 'scale-explosion',
      surface: s,
      label: `${SURFACES[s].label} : ${distinct} valeurs de radius distinctes (cible ≤ 6)`,
      values: [...data[s].entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([k, v]) => ({ value: k, count: v })),
      severity: 'warn',
    });
  }
}

// 2) Comparer les ensembles d'arrondis entre surfaces (cohérence)
const allRadii = new Set();
for (const s of surfaces) {
  for (const k of data[s].keys()) allRadii.add(k);
}
const presenceMatrix = {};
for (const r of allRadii) {
  presenceMatrix[r] = {};
  for (const s of surfaces) {
    presenceMatrix[r][s] = data[s].has(r);
  }
}

// Radii utilisés dans une seule surface
for (const r of allRadii) {
  const usedIn = surfaces.filter(s => presenceMatrix[r][s]);
  if (usedIn.length === 1) {
    const surface = usedIn[0];
    const count = data[surface].get(r);
    if (count >= 3) { // bruit si très peu utilisé
      findings.push({
        type: 'unique-radius',
        radius: r,
        surface,
        count,
        label: `${r} utilisé seulement dans ${SURFACES[surface].label} (×${count})`,
        severity: 'info',
      });
    }
  }
}

const totalChecks = surfaces.length + allRadii.size;
const score = scoreFrom(findings.filter(f => f.severity === 'warn').length * 3 + findings.filter(f => f.severity === 'info').length, totalChecks);

const report = {
  botId: BOT_ID,
  botName: BOT_NAME,
  generatedAt: new Date().toISOString(),
  score,
  summary: {
    totalDistinctRadii: allRadii.size,
    issueCount: findings.length,
    bySurface: Object.fromEntries(surfaces.map(s => [s, {
      distinct: data[s].size,
      values: [...data[s].keys()].sort((a, b) => parseFloat(a) - parseFloat(b)),
    }])),
    presenceMatrix,
  },
  surfaces: surfaces.map(s => ({ key: s, label: SURFACES[s].label })),
  findings,
};

const out = writeReport(import.meta.url, BOT_ID, report);
console.log(`✓ ${BOT_NAME} — score ${score}/100 (${findings.length} obs · ${allRadii.size} radii distincts) · → ${out}`);

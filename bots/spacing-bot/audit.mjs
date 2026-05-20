#!/usr/bin/env node
/**
 * Spacing Bot — vérifie l'adhérence à la grille 4px / 8px.
 */
import { SURFACES, readAllCss, extractSpacingValues } from '../lib/scanner.mjs';
import { writeReport, scoreFrom } from '../lib/bot-utils.mjs';

const BOT_ID = 'spacing-bot';
const BOT_NAME = 'Spacing Bot';
const surfaces = Object.keys(SURFACES);

const data = {};
for (const s of surfaces) {
  const css = readAllCss(s);
  data[s] = extractSpacingValues(css);
}

const findings = [];

for (const s of surfaces) {
  const values = data[s];
  const offGrid = [];
  let onGridCount = 0;
  let offGridCount = 0;
  for (const [val, count] of values) {
    const n = Math.abs(parseFloat(val));
    if (n === 0) continue;
    if (n % 4 === 0) {
      onGridCount += count;
    } else {
      offGridCount += count;
      offGrid.push({ value: val, count });
    }
  }
  offGrid.sort((a, b) => b.count - a.count);

  const totalSpacing = onGridCount + offGridCount;
  const adherence = totalSpacing === 0 ? 100 : Math.round(100 * onGridCount / totalSpacing);

  findings.push({
    type: 'spacing-adherence',
    surface: s,
    label: `${SURFACES[s].label} : adhérence grille 4px = ${adherence}%`,
    adherence,
    onGridCount,
    offGridCount,
    offGridSamples: offGrid.slice(0, 15),
    severity: adherence < 80 ? 'warn' : 'info',
  });
}

const avgAdherence = Math.round(
  findings.reduce((a, f) => a + f.adherence, 0) / findings.length
);
const score = avgAdherence;

const report = {
  botId: BOT_ID,
  botName: BOT_NAME,
  generatedAt: new Date().toISOString(),
  score,
  summary: {
    avgAdherence,
    issueCount: findings.filter(f => f.severity === 'warn').length,
    bySurface: Object.fromEntries(findings.map(f => [f.surface, {
      adherence: f.adherence,
      onGrid: f.onGridCount,
      offGrid: f.offGridCount,
    }])),
  },
  surfaces: surfaces.map(s => ({ key: s, label: SURFACES[s].label })),
  findings,
};

const out = writeReport(import.meta.url, BOT_ID, report);
console.log(`✓ ${BOT_NAME} — score ${score}/100 (adhérence moyenne ${avgAdherence}%) · → ${out}`);

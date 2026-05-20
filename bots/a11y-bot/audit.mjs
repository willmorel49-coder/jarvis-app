#!/usr/bin/env node
/**
 * A11y Bot — audit primitives d'accessibilité par surface.
 * Compte les occurrences de ARIA, role=, tabindex, sr-only, skip-link.
 */
import { SURFACES, readSurfaceFile, countMatches } from '../lib/scanner.mjs';
import { writeReport, scoreFrom } from '../lib/bot-utils.mjs';

const BOT_ID = 'a11y-bot';
const BOT_NAME = 'A11y Bot';
const surfaces = Object.keys(SURFACES);

const CHECKS = [
  { id: 'aria-label',  pattern: /aria-label\s*=/g, label: 'aria-label' },
  { id: 'aria-live',   pattern: /aria-live\s*=/g, label: 'aria-live' },
  { id: 'aria-hidden', pattern: /aria-hidden\s*=/g, label: 'aria-hidden' },
  { id: 'aria-modal',  pattern: /aria-modal\s*=/g, label: 'aria-modal' },
  { id: 'aria-labelledby', pattern: /aria-labelledby\s*=/g, label: 'aria-labelledby' },
  { id: 'role',        pattern: /\brole\s*=\s*["'](?!stylesheet)/g, label: 'role=' },
  { id: 'tabindex',    pattern: /tabindex\s*=/g, label: 'tabindex' },
  { id: 'sr-only',     pattern: /\bsr-only\b/g, label: '.sr-only' },
  { id: 'skip-link',   pattern: /\bskip-link\b/g, label: '.skip-link' },
  { id: 'alt-attr',    pattern: /\balt\s*=/g, label: 'alt= (images)' },
];

const data = {};
for (const s of surfaces) {
  const files = [...readSurfaceFile(s, 'html'), ...readSurfaceFile(s, 'js'), ...readSurfaceFile(s, 'css')];
  const combined = files.map(f => f.content).join('\n');
  data[s] = {};
  for (const c of CHECKS) {
    data[s][c.id] = countMatches(combined, c.pattern);
  }
}

const findings = [];
const matrix = {};

for (const c of CHECKS) {
  matrix[c.id] = {};
  const counts = {};
  for (const s of surfaces) {
    counts[s] = data[s][c.id];
    matrix[c.id][s] = data[s][c.id];
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const presentIn = surfaces.filter(s => counts[s] > 0);

  if (total === 0) {
    // Absent partout = pas forcément un bug (ex: aria-modal sans modale)
    continue;
  }
  if (presentIn.length < surfaces.length) {
    findings.push({
      check: c.id,
      label: c.label,
      counts,
      presentIn,
      missingFrom: surfaces.filter(s => counts[s] === 0),
      severity: presentIn.length === 1 ? 'warn' : 'info',
    });
  }
}

// Score : ratio surfaces couvertes par check, sur l'ensemble des checks où ≥1 surface utilise
const used = CHECKS.filter(c => surfaces.some(s => data[s][c.id] > 0));
let coverageSum = 0;
for (const c of used) {
  const presentIn = surfaces.filter(s => data[s][c.id] > 0).length;
  coverageSum += presentIn / surfaces.length;
}
const score = used.length === 0 ? 0 : Math.round(100 * coverageSum / used.length);

const report = {
  botId: BOT_ID,
  botName: BOT_NAME,
  generatedAt: new Date().toISOString(),
  score,
  summary: {
    checks: CHECKS.length,
    checksUsed: used.length,
    issueCount: findings.length,
    bySurface: Object.fromEntries(surfaces.map(s => [s, {
      totalAriaUsages: CHECKS.reduce((a, c) => a + data[s][c.id], 0),
    }])),
    matrix,
  },
  surfaces: surfaces.map(s => ({ key: s, label: SURFACES[s].label })),
  findings,
};

const out = writeReport(import.meta.url, BOT_ID, report);
console.log(`✓ ${BOT_NAME} — score ${score}/100 (${findings.length} primitives mal couvertes) · → ${out}`);

#!/usr/bin/env node
/**
 * Palette Bot — détecte les couleurs hardcodées (hex / rgb / hsl) hors var().
 * Le brand par app est conservé : on signale juste les couleurs qui ne passent
 * pas par un token et qui pourraient être centralisées.
 */
import { SURFACES, readAllCss, readSurfaceFile, extractColors } from '../lib/scanner.mjs';
import { writeReport, scoreFrom } from '../lib/bot-utils.mjs';

const BOT_ID = 'palette-bot';
const BOT_NAME = 'Palette Bot';
const surfaces = Object.keys(SURFACES);

const data = {};
for (const s of surfaces) {
  // On retire les var() du contenu avant scan pour ne pas capter les couleurs
  // qui sont déjà dans des tokens (extraites au moment de la définition).
  const css = readAllCss(s);
  const jsContent = readSurfaceFile(s, 'js').map(f => f.content).join('\n');
  const htmlContent = readSurfaceFile(s, 'html').map(f => f.content).join('\n');
  const combined = css + '\n' + jsContent + '\n' + htmlContent;
  const colors = extractColors(combined);
  data[s] = { colors, total: [...colors.values()].reduce((a, b) => a + b, 0) };
}

// Agrégat : toutes les couleurs vues
const all = new Map();
for (const s of surfaces) {
  for (const [c, n] of data[s].colors) {
    if (!all.has(c)) all.set(c, { color: c, occurrencesBySurface: {} });
    all.get(c).occurrencesBySurface[s] = n;
  }
}

// Findings : couleurs très utilisées (>= 3 occurrences total) mais hors token
const findings = [];
for (const f of all.values()) {
  const total = Object.values(f.occurrencesBySurface).reduce((a, b) => a + b, 0);
  const surfacesUsed = Object.keys(f.occurrencesBySurface).length;
  // Filtrer le bruit : noir/blanc fréquents
  if (['#000', '#fff', '#000000', '#ffffff'].includes(f.color)) continue;
  if (total >= 3) {
    findings.push({
      color: f.color,
      total,
      surfaces: f.occurrencesBySurface,
      sharedAcrossSurfaces: surfacesUsed > 1,
    });
  }
}
findings.sort((a, b) => b.total - a.total);

const totalUnique = all.size;
const score = scoreFrom(findings.length, totalUnique);

const report = {
  botId: BOT_ID,
  botName: BOT_NAME,
  generatedAt: new Date().toISOString(),
  score,
  summary: {
    totalUniqueColors: totalUnique,
    issueCount: findings.length,
    bySurface: Object.fromEntries(surfaces.map(s => [s, {
      uniqueColors: data[s].colors.size,
      totalOccurrences: data[s].total,
    }])),
  },
  surfaces: surfaces.map(s => ({ key: s, label: SURFACES[s].label })),
  findings: findings.slice(0, 200),
};

const out = writeReport(import.meta.url, BOT_ID, report);
console.log(`✓ ${BOT_NAME} — score ${score}/100`);
console.log(`  ${totalUnique} couleurs uniques · ${findings.length} hardcodées (≥3 usages)`);
console.log(`  → ${out}`);

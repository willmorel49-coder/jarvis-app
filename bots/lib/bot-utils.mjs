import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Helper standard pour écrire un rapport bot.
 */
export function writeReport(metaUrl, botId, report) {
  const here = dirname(fileURLToPath(metaUrl));
  const outDir = resolve(here, '..', 'reports');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${botId}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  return outPath;
}

/**
 * Calcule un score 0-100 à partir d'un nombre de divergences vs total.
 * Plus le total est petit, plus chaque divergence pèse.
 */
export function scoreFrom(issues, total) {
  if (total === 0) return 100;
  return Math.max(0, Math.round(100 * (1 - issues / total)));
}

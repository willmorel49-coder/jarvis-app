import { writeFileSync, mkdirSync, readdirSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const HISTORY_DIR = resolve(here, '..', 'reports', 'history');

/**
 * Sauve un snapshot horodaté du score global et par bot.
 * Garde les 50 derniers snapshots max.
 */
export function saveSnapshot(index) {
  mkdirSync(HISTORY_DIR, { recursive: true });
  const okBots = (index.bots || []).filter(b => b.status === 'ok');
  if (okBots.length === 0) return null;
  const snapshot = {
    at: index.generatedAt,
    globalScore: Math.round(okBots.reduce((a, b) => a + b.score, 0) / okBots.length),
    bots: Object.fromEntries(okBots.map(b => [b.id, { score: b.score, issues: b.issueCount }])),
  };
  const filename = snapshot.at.replace(/[:.]/g, '-') + '.json';
  writeFileSync(resolve(HISTORY_DIR, filename), JSON.stringify(snapshot, null, 2));

  // Purge old snapshots
  const files = readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort();
  if (files.length > 50) {
    for (const f of files.slice(0, files.length - 50)) {
      unlinkSync(resolve(HISTORY_DIR, f));
    }
  }

  // Maintain a 'trend.json' aggregate for the dashboard
  const trend = readHistory();
  writeFileSync(resolve(HISTORY_DIR, '..', 'trend.json'), JSON.stringify(trend, null, 2));
  return snapshot;
}

export function readHistory() {
  if (!existsSync(HISTORY_DIR)) return [];
  return readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => JSON.parse(readFileSync(resolve(HISTORY_DIR, f), 'utf8')));
}

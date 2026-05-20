#!/usr/bin/env node
/**
 * Orchestrateur — lance tous les bots actifs et agrège leurs rapports.
 *
 * Sortie : bots/reports/index.json (méta-index pour le dashboard)
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const reportsDir = resolve(here, 'reports');
mkdirSync(reportsDir, { recursive: true });

const BOTS = [
  { id: 'token-bot', script: resolve(here, 'token-bot/audit.mjs'), enabled: true },
  { id: 'palette-bot',   script: null, enabled: false },
  { id: 'typo-bot',      script: null, enabled: false },
  { id: 'spacing-bot',   script: null, enabled: false },
  { id: 'component-bot', script: null, enabled: false },
  { id: 'a11y-bot',      script: null, enabled: false },
  { id: 'nav-bot',       script: null, enabled: false },
  { id: 'radius-bot',    script: null, enabled: false },
];

const index = { generatedAt: new Date().toISOString(), bots: [] };

for (const bot of BOTS) {
  if (!bot.enabled || !bot.script) {
    index.bots.push({ id: bot.id, status: 'pending' });
    continue;
  }
  const r = spawnSync('node', [bot.script], { stdio: 'inherit' });
  if (r.status !== 0) {
    index.bots.push({ id: bot.id, status: 'error' });
    continue;
  }
  const reportPath = resolve(reportsDir, `${bot.id}.json`);
  if (existsSync(reportPath)) {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    index.bots.push({
      id: bot.id,
      status: 'ok',
      botName: report.botName,
      score: report.score,
      issueCount: report.summary?.issueCount ?? null,
      generatedAt: report.generatedAt,
    });
  }
}

writeFileSync(resolve(reportsDir, 'index.json'), JSON.stringify(index, null, 2));
console.log(`\n→ bots/reports/index.json (${index.bots.filter(b => b.status === 'ok').length}/${BOTS.length} bots actifs)`);

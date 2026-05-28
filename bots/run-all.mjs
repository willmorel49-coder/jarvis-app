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
import { saveSnapshot } from './lib/history.mjs';
import { writeActionPlan } from './lib/action-plan.mjs';
import { exportMarkdown } from './lib/export-md.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const reportsDir = resolve(here, 'reports');
mkdirSync(reportsDir, { recursive: true });

const BOTS = [
  { id: 'token-bot',     script: resolve(here, 'token-bot/audit.mjs'),     enabled: true },
  { id: 'palette-bot',   script: resolve(here, 'palette-bot/audit.mjs'),   enabled: true },
  { id: 'typo-bot',      script: resolve(here, 'typo-bot/audit.mjs'),      enabled: true },
  { id: 'spacing-bot',   script: resolve(here, 'spacing-bot/audit.mjs'),   enabled: true },
  { id: 'component-bot', script: resolve(here, 'component-bot/audit.mjs'), enabled: true },
  { id: 'a11y-bot',      script: resolve(here, 'a11y-bot/audit.mjs'),      enabled: true },
  { id: 'nav-bot',       script: resolve(here, 'nav-bot/audit.mjs'),       enabled: true },
  { id: 'radius-bot',    script: resolve(here, 'radius-bot/audit.mjs'),    enabled: true },
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

// Score global + delta
const okBots = index.bots.filter(b => b.status === 'ok');
const global = okBots.length ? Math.round(okBots.reduce((a, b) => a + b.score, 0) / okBots.length) : 0;

// Snapshot historique
saveSnapshot(index);

// Plan d'action priorisé
const plan = writeActionPlan();

// Export markdown partageable
const md = exportMarkdown();

console.log(`\n📊 Score santé global : ${global}/100`);
console.log(`📋 Plan d'action : ${plan.length} étapes priorisées → bots/reports/action-plan.json`);
console.log(`📝 Rapport markdown : ${md.path}`);
console.log(`→ bots/reports/index.json (${okBots.length}/${BOTS.length} bots actifs)`);

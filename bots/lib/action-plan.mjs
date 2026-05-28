import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPORTS = resolve(here, '..', 'reports');

/**
 * Génère un plan d'action priorisé à partir des rapports.
 * Chaque action a un score = impact (1-3) × (1 / effort (1-3))
 */
export function buildActionPlan() {
  if (!existsSync(REPORTS)) return [];

  const actions = [];
  const files = readdirSync(REPORTS).filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'trend.json');

  for (const file of files) {
    const report = JSON.parse(readFileSync(resolve(REPORTS, file), 'utf8'));

    // 1) Fixes safe : impact selon le nombre de fichiers touchés, effort = 1
    for (const p of (report.proposals || []).filter(p => p.safety === 'safe')) {
      actions.push({
        bot: report.botId,
        title: `Appliquer fix ${p.token || p.type}`,
        detail: p.rationale,
        impact: 2,
        effort: 1,
        kind: 'auto-fix',
        command: 'node bots/apply-fixes.mjs --apply',
      });
    }

    // 2) Manuel critique : collision de valeurs sur tokens partagés très utilisés
    for (const p of (report.proposals || []).filter(p => p.safety === 'manual')) {
      const impact = p.type === 'rename-collision' ? 3 : 2;
      actions.push({
        bot: report.botId,
        title: p.type === 'rename-collision' ? `Renommer/préfixer ${p.token}` : `Définir ${p.token}`,
        detail: p.suggestion || p.rationale,
        impact,
        effort: 3,
        kind: 'manual',
      });
    }

    // 3) Bot-specific big rocks
    if (report.botId === 'component-bot' && report.score < 30) {
      actions.push({
        bot: 'component-bot',
        title: 'Aligner les composants canoniques sur les 3 surfaces',
        detail: `Score ${report.score}/100. Définir une convention .card / .modal / .btn / .kpi / .badge / .pill réutilisée partout.`,
        impact: 3, effort: 3, kind: 'design-system',
      });
    }
    if (report.botId === 'a11y-bot' && report.score < 50) {
      const worst = Object.entries(report.summary?.bySurface || {})
        .sort((a, b) => a[1].totalAriaUsages - b[1].totalAriaUsages)[0];
      actions.push({
        bot: 'a11y-bot',
        title: `Bootstrap a11y sur ${worst ? worst[0] : 'CRM'}`,
        detail: `Ajouter aria-label, role=dialog+aria-modal sur modales, .sr-only, focus visible. Score actuel ${report.score}/100.`,
        impact: 3, effort: 2, kind: 'a11y',
      });
    }
    if (report.botId === 'spacing-bot' && report.score < 70) {
      actions.push({
        bot: 'spacing-bot',
        title: 'Normaliser sur la grille 4px',
        detail: `Adhérence moyenne ${report.summary?.avgAdherence}%. Cibler 90%+ en remplaçant les valeurs off-grid (5, 7, 9, 11, 13 px) par les multiples de 4 les plus proches.`,
        impact: 2, effort: 3, kind: 'spacing',
      });
    }
    if (report.botId === 'palette-bot' && (report.summary?.issueCount || 0) > 50) {
      actions.push({
        bot: 'palette-bot',
        title: 'Extraire les couleurs partagées en tokens',
        detail: `${report.summary.issueCount} couleurs hardcodées détectées. Identifier celles utilisées ≥3 fois dans ≥2 surfaces et créer un token commun.`,
        impact: 2, effort: 2, kind: 'tokens',
      });
    }
  }

  // Score chaque action et trie
  for (const a of actions) {
    a.score = (a.impact * 10) / a.effort;
  }
  actions.sort((a, b) => b.score - a.score);

  // Dédupe titre+bot
  const seen = new Set();
  const deduped = [];
  for (const a of actions) {
    const key = `${a.bot}:${a.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(a);
  }

  return deduped.slice(0, 15);
}

export function writeActionPlan() {
  const plan = buildActionPlan();
  writeFileSync(resolve(REPORTS, 'action-plan.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    actions: plan,
  }, null, 2));
  return plan;
}

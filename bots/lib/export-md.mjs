import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPORTS = resolve(here, '..', 'reports');

const BOT_META = {
  'token-bot':     { icon: '🎨', name: 'Token Bot' },
  'palette-bot':   { icon: '🌈', name: 'Palette Bot' },
  'typo-bot':      { icon: '✒️', name: 'Typo Bot' },
  'spacing-bot':   { icon: '📐', name: 'Spacing Bot' },
  'component-bot': { icon: '🧩', name: 'Component Bot' },
  'a11y-bot':      { icon: '♿', name: 'A11y Bot' },
  'nav-bot':       { icon: '🧭', name: 'Nav Bot' },
  'radius-bot':    { icon: '🔘', name: 'Radius Bot' },
};

export function exportMarkdown() {
  const index = JSON.parse(readFileSync(resolve(REPORTS, 'index.json'), 'utf8'));
  const okBots = index.bots.filter(b => b.status === 'ok');
  const global = Math.round(okBots.reduce((a, b) => a + b.score, 0) / okBots.length);
  const planPath = resolve(REPORTS, 'action-plan.json');
  const plan = existsSync(planPath) ? JSON.parse(readFileSync(planPath, 'utf8')) : { actions: [] };

  const trendPath = resolve(REPORTS, 'trend.json');
  const trend = existsSync(trendPath) ? JSON.parse(readFileSync(trendPath, 'utf8')) : [];
  const prevGlobal = trend.length > 1 ? trend[trend.length - 2].globalScore : null;
  const delta = prevGlobal !== null ? global - prevGlobal : null;

  const lines = [];
  lines.push(`# Audit Parité UX/UI · Jarvis App`);
  lines.push('');
  lines.push(`> Généré ${new Date(index.generatedAt).toLocaleString('fr-FR')}`);
  lines.push('');
  lines.push(`## Score santé : **${global}/100**${delta !== null ? `  ${delta > 0 ? '📈 +' : '📉 '}${delta} pts vs run précédent` : ''}`);
  lines.push('');
  lines.push('| Bot | Score | Findings |');
  lines.push('|-----|------:|---------:|');
  for (const b of okBots) {
    const m = BOT_META[b.id] || { icon: '🤖', name: b.id };
    lines.push(`| ${m.icon} ${m.name} | ${b.score}/100 | ${b.issueCount ?? '—'} |`);
  }
  lines.push('');

  if (plan.actions.length) {
    lines.push('## Plan d\'action priorisé');
    lines.push('');
    lines.push('Trié par impact / effort (score décroissant).');
    lines.push('');
    for (let i = 0; i < plan.actions.length; i++) {
      const a = plan.actions[i];
      const m = BOT_META[a.bot] || { icon: '🤖', name: a.bot };
      lines.push(`### ${i + 1}. ${a.title}`);
      lines.push(`*${m.icon} ${m.name} · impact ${a.impact}/3 · effort ${a.effort}/3 · score ${a.score.toFixed(1)}*`);
      lines.push('');
      lines.push(a.detail);
      if (a.command) {
        lines.push('');
        lines.push('```bash');
        lines.push(a.command);
        lines.push('```');
      }
      lines.push('');
    }
  }

  if (trend.length > 1) {
    lines.push('## Historique');
    lines.push('');
    lines.push('| Date | Score global |');
    lines.push('|------|-------------:|');
    for (const t of trend.slice(-10)) {
      lines.push(`| ${new Date(t.at).toLocaleString('fr-FR')} | ${t.globalScore}/100 |`);
    }
    lines.push('');
  }

  const md = lines.join('\n');
  const out = resolve(REPORTS, 'report.md');
  writeFileSync(out, md);
  return { path: out, content: md };
}

#!/usr/bin/env node
/**
 * apply-fixes — applique (ou prévisualise) les corrections proposées par les bots.
 *
 * Usage :
 *   node bots/apply-fixes.mjs                 # dry-run, tous les bots
 *   node bots/apply-fixes.mjs --bot=token-bot # dry-run, un bot
 *   node bots/apply-fixes.mjs --apply         # applique les fixes 'safe'
 *   node bots/apply-fixes.mjs --apply --include-manual  # tente aussi les 'manual'
 *
 * Seules les propositions safety: 'safe' sont appliquées par défaut.
 * Les 'manual' sont listées pour décision humaine.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const INCLUDE_MANUAL = args.includes('--include-manual');
const botFilter = (args.find(a => a.startsWith('--bot=')) || '').split('=')[1] || null;

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const reportsDir = resolve(here, 'reports');

const reportFiles = existsSync(reportsDir)
  ? readdirSync(reportsDir).filter(f => f.endsWith('.json') && f !== 'index.json')
  : [];

const stats = { safe: 0, manual: 0, info: 0, applied: 0, skipped: 0, touched: new Set() };
const grouped = { safe: [], manual: [], info: [] };

for (const file of reportFiles) {
  const report = JSON.parse(readFileSync(resolve(reportsDir, file), 'utf8'));
  if (botFilter && report.botId !== botFilter) continue;
  const proposals = report.proposals || [];
  for (const p of proposals) {
    const sev = p.safety || 'info';
    stats[sev] = (stats[sev] || 0) + 1;
    grouped[sev].push({ bot: report.botId, ...p });
  }
}

console.log(`\n🤖 Propositions trouvées : ${stats.safe} safe · ${stats.manual} manual · ${stats.info} info\n`);

// Affichage groupé
if (grouped.safe.length) {
  console.log('─── ✅ Fixes safe (auto-applicables) ───');
  for (const p of grouped.safe) {
    console.log(`  [${p.bot}] ${p.type} · ${p.token || p.surface || ''}`);
    console.log(`    → ${p.rationale}`);
    if (p.search && p.replace) {
      console.log(`    "${p.search}"  →  "${p.replace}"  dans  ${p.files?.join(', ')}`);
    }
  }
  console.log('');
}

if (grouped.manual.length) {
  console.log('─── ⚠️  Fixes manuels (décision humaine requise) ───');
  for (const p of grouped.manual) {
    console.log(`  [${p.bot}] ${p.type} · ${p.token || p.surface || ''}`);
    console.log(`    → ${p.rationale || p.suggestion}`);
    if (p.values) {
      for (const [s, v] of Object.entries(p.values)) console.log(`        ${s.padEnd(10)} ${v}`);
    }
  }
  console.log('');
}

if (grouped.info.length && (INCLUDE_MANUAL || botFilter)) {
  console.log('─── ℹ️  Infos (suggestions, non bloquantes) ───');
  for (const p of grouped.info.slice(0, 30)) {
    console.log(`  [${p.bot}] ${p.type} · ${p.token || p.surface || ''} — ${p.rationale}`);
  }
  if (grouped.info.length > 30) console.log(`  … (${grouped.info.length - 30} autres)`);
  console.log('');
}

// Application
if (APPLY) {
  console.log('─── 🔧 Application des fixes safe ───');
  const toApply = [...grouped.safe, ...(INCLUDE_MANUAL ? grouped.manual : [])];
  for (const p of toApply) {
    if (!p.search || !p.replace || !p.files) {
      stats.skipped++;
      continue;
    }
    for (const file of p.files) {
      const path = resolve(ROOT, file);
      if (!existsSync(path)) continue;
      const before = readFileSync(path, 'utf8');
      if (!before.includes(p.search)) continue;
      const after = before.split(p.search).join(p.replace);
      writeFileSync(path, after);
      stats.touched.add(file);
      stats.applied++;
      console.log(`  ✓ ${file} — ${p.search} → ${p.replace}`);
    }
  }
  console.log(`\n✓ ${stats.applied} remplacements dans ${stats.touched.size} fichiers.`);
  console.log('  Relance maintenant : node bots/run-all.mjs');
} else {
  console.log('💡 Aucun fichier modifié (mode dry-run).');
  console.log('   Lance avec --apply pour appliquer les fixes safe.');
}

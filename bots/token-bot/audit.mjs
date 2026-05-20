#!/usr/bin/env node
/**
 * Token Bot — audit des variables CSS sur les 3 surfaces (CRM, Catalogue, OPSO).
 *
 * Détecte :
 *  - Tokens définis dans une seule surface (incohérence de coverage)
 *  - Tokens utilisés mais non définis (références cassées potentielles)
 *  - Tokens définis mais jamais utilisés (mort)
 *  - Collisions sémantiques (même nom, valeur très différente → ex: --blue vert en OPSO)
 *
 * Sortie : bots/reports/token-bot.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SURFACES,
  readAllCss,
  readSurfaceFile,
  extractCssVarDefs,
  extractCssVarUsages,
} from '../lib/scanner.mjs';

const BOT_ID = 'token-bot';
const BOT_NAME = 'Token Bot';

const surfaces = Object.keys(SURFACES);

// Step 1: collecte defs + uses par surface
const data = {};
for (const s of surfaces) {
  const css = readAllCss(s);
  const defs = extractCssVarDefs(css);
  const uses = new Map();
  // chercher var() dans CSS + JS (templates inline)
  for (const f of [...readSurfaceFile(s, 'css'), ...readSurfaceFile(s, 'js')]) {
    const u = extractCssVarUsages(f.content);
    for (const [k, v] of u) uses.set(k, (uses.get(k) || 0) + v);
  }
  data[s] = { defs, uses };
}

// Step 2: univers des tokens
const allTokens = new Set();
for (const s of surfaces) {
  for (const k of data[s].defs.keys()) allTokens.add(k);
  for (const k of data[s].uses.keys()) allTokens.add(k);
}

// Step 3: analyse par token
const findings = [];
for (const token of [...allTokens].sort()) {
  const definedIn = surfaces.filter(s => data[s].defs.has(token));
  const usedIn = surfaces.filter(s => (data[s].uses.get(token) || 0) > 0);
  const values = new Map();
  for (const s of definedIn) values.set(s, data[s].defs.get(token));

  // a) utilisé sans définition (par surface)
  const usedUndef = usedIn.filter(s => !definedIn.includes(s));

  // b) défini sans usage (par surface)
  const definedUnused = definedIn.filter(s => !usedIn.includes(s));

  // c) collision : même nom mais valeurs très différentes
  const uniqVals = new Set([...values.values()].map(v => v.toLowerCase().replace(/\s+/g, '')));
  const collision = uniqVals.size > 1;

  // d) coverage partielle : token utilisé dans plusieurs surfaces mais défini dans une seule
  const partialCoverage = usedIn.length > 1 && definedIn.length < usedIn.length;

  if (usedUndef.length || definedUnused.length || collision || partialCoverage) {
    findings.push({
      token,
      definedIn,
      usedIn,
      values: Object.fromEntries(values),
      issues: {
        usedUndefined: usedUndef,
        definedUnused: definedUnused,
        valueCollision: collision,
        partialCoverage,
      },
    });
  }
}

// Step 4: scoring
const totals = {};
for (const s of surfaces) {
  totals[s] = {
    defined: data[s].defs.size,
    used: data[s].uses.size,
  };
}
const totalTokens = allTokens.size;
const issueCount = findings.length;
const score = totalTokens === 0 ? 100 : Math.max(0, Math.round(100 * (1 - issueCount / totalTokens)));

const report = {
  botId: BOT_ID,
  botName: BOT_NAME,
  generatedAt: new Date().toISOString(),
  score,
  summary: {
    totalTokens,
    issueCount,
    bySurface: totals,
  },
  surfaces: surfaces.map(s => ({ key: s, label: SURFACES[s].label })),
  findings,
};

// Step 5: écriture
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'reports');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `${BOT_ID}.json`);
writeFileSync(outPath, JSON.stringify(report, null, 2));

// Step 6: log CLI
console.log(`✓ ${BOT_NAME} — score ${score}/100`);
console.log(`  ${totalTokens} tokens · ${issueCount} divergences`);
for (const s of surfaces) {
  console.log(`  · ${SURFACES[s].label.padEnd(10)} ${totals[s].defined} déf · ${totals[s].used} utilisés`);
}
console.log(`  → ${outPath}`);

#!/usr/bin/env node
/**
 * Typo Bot — audit familles + tailles + poids.
 * Détecte divergences entre surfaces et explosion d'échelle.
 */
import { SURFACES, readAllCss, extractFontFamilies, extractFontSizes, extractFontWeights } from '../lib/scanner.mjs';
import { writeReport, scoreFrom } from '../lib/bot-utils.mjs';

const BOT_ID = 'typo-bot';
const BOT_NAME = 'Typo Bot';
const surfaces = Object.keys(SURFACES);

const data = {};
for (const s of surfaces) {
  const css = readAllCss(s);
  data[s] = {
    families: extractFontFamilies(css),
    sizes: extractFontSizes(css),
    weights: extractFontWeights(css),
  };
}

const findings = [];

// 1) Familles : extraire la 1re famille (display ou body) par surface
const primaryFamilies = {};
for (const s of surfaces) {
  const list = [...data[s].families.entries()].sort((a, b) => b[1] - a[1]);
  primaryFamilies[s] = list[0] ? list[0][0].split(',')[0].trim().replace(/['"]/g, '') : null;
}
const uniqueFamilies = new Set(Object.values(primaryFamilies).filter(Boolean));
if (uniqueFamilies.size > 1) {
  findings.push({
    type: 'family-divergence',
    label: 'Famille de police principale différente entre surfaces',
    details: primaryFamilies,
    severity: 'info', // brand par app conservé
  });
}

// 2) Tailles : combien de tailles distinctes par surface ?
//    Une échelle saine = 6-8 tailles. Au-delà = explosion.
for (const s of surfaces) {
  const count = data[s].sizes.size;
  if (count > 12) {
    findings.push({
      type: 'size-scale-explosion',
      surface: s,
      label: `${SURFACES[s].label} : ${count} tailles distinctes (cible ≤ 12)`,
      sizes: [...data[s].sizes.entries()].sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])).slice(0, 20).map(([k, v]) => ({ size: k, count: v })),
      severity: 'warn',
    });
  }
}

// 3) Tailles non standard (hors échelle 10/11/12/13/14/15/16/18/20/24/28/32)
const STANDARD = new Set(['10px', '11px', '12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px', '26px', '28px', '32px']);
for (const s of surfaces) {
  const nonstd = [...data[s].sizes.entries()]
    .filter(([k]) => !STANDARD.has(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  if (nonstd.length) {
    findings.push({
      type: 'non-standard-sizes',
      surface: s,
      label: `${SURFACES[s].label} : tailles hors échelle standard`,
      sizes: nonstd.map(([k, v]) => ({ size: k, count: v })),
      severity: 'info',
    });
  }
}

// 4) Poids : trop de poids différents
for (const s of surfaces) {
  if (data[s].weights.size > 6) {
    findings.push({
      type: 'weight-scale-explosion',
      surface: s,
      label: `${SURFACES[s].label} : ${data[s].weights.size} poids différents (cible ≤ 6)`,
      weights: [...data[s].weights.entries()].sort((a, b) => b[1] - a[1]),
      severity: 'warn',
    });
  }
}

const totalChecks = surfaces.length * 4; // 4 checks par surface
const score = scoreFrom(findings.filter(f => f.severity !== 'info').length, totalChecks);

const report = {
  botId: BOT_ID,
  botName: BOT_NAME,
  generatedAt: new Date().toISOString(),
  score,
  summary: {
    issueCount: findings.length,
    bySurface: Object.fromEntries(surfaces.map(s => [s, {
      families: data[s].families.size,
      sizes: data[s].sizes.size,
      weights: data[s].weights.size,
      primaryFamily: primaryFamilies[s],
    }])),
  },
  surfaces: surfaces.map(s => ({ key: s, label: SURFACES[s].label })),
  findings,
};

const out = writeReport(import.meta.url, BOT_ID, report);
console.log(`✓ ${BOT_NAME} — score ${score}/100 · ${findings.length} obs · → ${out}`);

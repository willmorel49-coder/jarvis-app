#!/usr/bin/env node
/**
 * Nav Bot — vérifie la cohérence des patterns de navigation
 * (sidebar, bottom-nav, top-tabs) entre les surfaces.
 */
import { SURFACES, readAllCss, readSurfaceFile, classDefined } from '../lib/scanner.mjs';
import { writeReport, scoreFrom } from '../lib/bot-utils.mjs';

const BOT_ID = 'nav-bot';
const BOT_NAME = 'Nav Bot';
const surfaces = Object.keys(SURFACES);

const PATTERNS = [
  { id: 'sidebar',     classes: ['.sidebar', '.side-nav', '.nav-side'], label: 'Sidebar verticale' },
  { id: 'topbar',      classes: ['.topbar', '.top-bar', '.header-bar'], label: 'Topbar' },
  { id: 'bottom-nav',  classes: ['.bottom-nav', '.mobile-nav', '.tab-bar'], label: 'Bottom nav mobile' },
  { id: 'tabs',        classes: ['.tabs', '.tab-row', '.nav-tabs'], label: 'Onglets' },
  { id: 'breadcrumb',  classes: ['.breadcrumb', '.crumbs'], label: 'Fil d\'ariane' },
];

const findings = [];
const matrix = {};

for (const p of PATTERNS) {
  matrix[p.id] = {};
  for (const s of surfaces) {
    const css = readAllCss(s);
    const html = readSurfaceFile(s, 'html').map(f => f.content).join('\n');
    const js = readSurfaceFile(s, 'js').map(f => f.content).join('\n');
    const found = p.classes.some(c =>
      classDefined(css, c) ||
      html.includes(c.replace('.', 'class="').replace('-', '-')) ||
      new RegExp(`class\\s*=\\s*["'][^"']*\\b${c.replace('.', '')}\\b`).test(html + js)
    );
    matrix[p.id][s] = found;
  }
  const presentIn = surfaces.filter(s => matrix[p.id][s]);
  if (presentIn.length > 0 && presentIn.length < surfaces.length) {
    findings.push({
      pattern: p.id,
      label: `${p.label} présent seulement dans ${presentIn.join('+')}`,
      presentIn,
      missingFrom: surfaces.filter(s => !matrix[p.id][s]),
      severity: 'info',
    });
  }
}

// Conventions de classes pour les items actifs
const ACTIVE_CONVENTIONS = ['.active', '.is-active', '.selected', '.current'];
const conventionsBySurface = {};
for (const s of surfaces) {
  const css = readAllCss(s);
  conventionsBySurface[s] = ACTIVE_CONVENTIONS.filter(c => classDefined(css, c));
}
const uniqConventions = new Set();
for (const list of Object.values(conventionsBySurface)) {
  for (const c of list) uniqConventions.add(c);
}
if (uniqConventions.size > 1) {
  findings.push({
    pattern: 'active-class-convention',
    label: `Convention "active" différente entre surfaces`,
    details: conventionsBySurface,
    severity: 'warn',
  });
}

const totalChecks = PATTERNS.length + 1;
const score = scoreFrom(findings.filter(f => f.severity === 'warn').length, totalChecks);

const report = {
  botId: BOT_ID,
  botName: BOT_NAME,
  generatedAt: new Date().toISOString(),
  score,
  summary: {
    totalPatterns: PATTERNS.length,
    issueCount: findings.length,
    matrix,
    activeConventions: conventionsBySurface,
  },
  surfaces: surfaces.map(s => ({ key: s, label: SURFACES[s].label })),
  findings,
};

const out = writeReport(import.meta.url, BOT_ID, report);
console.log(`✓ ${BOT_NAME} — score ${score}/100 (${findings.length} divergences nav) · → ${out}`);

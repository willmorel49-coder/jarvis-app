import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const SURFACES = {
  crm: {
    label: 'CRM',
    css: ['crm/style.css'],
    html: ['crm/index.html'],
    js: ['crm/app.js'],
  },
  catalogue: {
    label: 'Catalogue',
    css: ['crm/catalogue.css'],
    html: [],
    js: ['crm/catalogue.js'],
  },
  opso: {
    label: 'OPSO',
    css: ['opso/style.css'],
    html: ['opso/index.html'],
    js: ['opso/app.js'],
  },
};

export function readSurfaceFile(surfaceKey, kind) {
  const surf = SURFACES[surfaceKey];
  if (!surf) throw new Error(`Unknown surface: ${surfaceKey}`);
  const paths = surf[kind] || [];
  return paths.map(p => ({
    path: p,
    content: readFileSync(resolve(ROOT, p), 'utf8'),
  }));
}

export function readAllCss(surfaceKey) {
  return readSurfaceFile(surfaceKey, 'css').map(f => f.content).join('\n');
}

/**
 * Extract CSS custom property definitions: --name: value;
 * Returns Map<name, value> (last wins, which matches cascade for top-level :root).
 */
export function extractCssVarDefs(css) {
  const defs = new Map();
  const re = /(--[a-zA-Z0-9-_]+)\s*:\s*([^;}]+?)\s*(?=;|\})/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    defs.set(m[1], m[2].trim());
  }
  return defs;
}

/**
 * Extract CSS custom property usages: var(--name)
 * Returns Map<name, count>.
 */
export function extractCssVarUsages(content) {
  const uses = new Map();
  const re = /var\(\s*(--[a-zA-Z0-9-_]+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    uses.set(m[1], (uses.get(m[1]) || 0) + 1);
  }
  return uses;
}

export function relPath(p) {
  return p;
}

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

/**
 * Extract raw color literals (hex, rgb, rgba, hsl) hors var().
 * Returns Map<color, count>.
 */
export function extractColors(content) {
  const colors = new Map();
  // Hex #fff, #ffffff, #ffffffff
  const hex = /#[0-9a-fA-F]{3,8}\b/g;
  let m;
  while ((m = hex.exec(content)) !== null) {
    const c = m[0].toLowerCase();
    colors.set(c, (colors.get(c) || 0) + 1);
  }
  // rgb / rgba / hsl / hsla
  const fn = /\b(?:rgb|rgba|hsl|hsla)\s*\([^)]+\)/gi;
  while ((m = fn.exec(content)) !== null) {
    const c = m[0].toLowerCase().replace(/\s+/g, '');
    colors.set(c, (colors.get(c) || 0) + 1);
  }
  return colors;
}

/**
 * Extract font-family declarations.
 */
export function extractFontFamilies(css) {
  const fams = new Map();
  const re = /font-family\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const f = m[1].trim().replace(/\s+/g, ' ');
    fams.set(f, (fams.get(f) || 0) + 1);
  }
  return fams;
}

/**
 * Extract font-size values in px.
 */
export function extractFontSizes(css) {
  const sizes = new Map();
  const re = /font-size\s*:\s*([0-9.]+)px/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const s = m[1] + 'px';
    sizes.set(s, (sizes.get(s) || 0) + 1);
  }
  return sizes;
}

/**
 * Extract font-weight values.
 */
export function extractFontWeights(css) {
  const weights = new Map();
  const re = /font-weight\s*:\s*(\d{3}|bold|normal|lighter|bolder)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    weights.set(m[1], (weights.get(m[1]) || 0) + 1);
  }
  return weights;
}

/**
 * Extract spacing values (padding, margin, gap) in px.
 * Returns Map<px-value, count>.
 */
export function extractSpacingValues(css) {
  const values = new Map();
  const re = /(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block))?\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const decl = m[1];
    const px = decl.match(/-?[0-9.]+px/g) || [];
    for (const v of px) {
      values.set(v, (values.get(v) || 0) + 1);
    }
  }
  return values;
}

/**
 * Extract border-radius values in px.
 */
export function extractBorderRadii(css) {
  const radii = new Map();
  const re = /border-radius\s*:\s*([^;}]+)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const decl = m[1];
    const px = decl.match(/[0-9.]+px/g) || [];
    for (const v of px) {
      radii.set(v, (radii.get(v) || 0) + 1);
    }
  }
  return radii;
}

/**
 * Check whether a class selector (with leading dot or not) is defined in CSS.
 */
export function classDefined(css, className) {
  const cn = className.replace(/^\./, '');
  const re = new RegExp(`\\.${cn}\\b`, 'g');
  return re.test(css);
}

/**
 * Count occurrences of a pattern in content (HTML + JS = template literals).
 */
export function countMatches(content, regex) {
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

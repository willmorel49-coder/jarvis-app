// 26/11/2026 — aide commune aux tests « telephone-*-2026-11-26 » des feuilles CSS : lire une feuille comme le navigateur la lit.
// Ce n'est pas un test (pas de « .test. » dans le nom) : `node --test tests/*.test.mjs` ne le lance pas seul.
import { readFileSync } from 'node:fs';

export const lire = f => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
export const sansCommentaires = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Toutes les règles d'une feuille, avec la pile des @media qui les entourent : [{ sel, decl, medias: ['(max-width:640px)', …] }].
// Les chaînes ("…", '…') sont sautées : une accolade dans un url("data:…") ne compte pas.
export function regles(css) {
  const s = sansCommentaires(css), out = [], pile = [];
  let i = 0, debut = 0;
  const sauteChaine = k => { const q = s[k]; k++; while (k < s.length && s[k] !== q) { if (s[k] === '\\') k++; k++; } return k; };
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'") { i = sauteChaine(i) + 1; continue; }
    if (c === '{') {
      const prelude = s.slice(debut, i).trim();
      if (/^@(media|supports|layer)\b/.test(prelude)) { pile.push(prelude.replace(/^@media\s*/, '')); i++; debut = i; continue; }
      // une règle (ou un @keyframes, @font-face : son corps est lu d'un bloc, accolades équilibrées)
      let n = 0, j = i;
      for (; j < s.length; j++) {
        if (s[j] === '"' || s[j] === "'") { j = sauteChaine(j); continue; }
        if (s[j] === '{') n++; else if (s[j] === '}' && --n === 0) break;
      }
      if (!prelude.startsWith('@')) out.push({ sel: prelude, decl: s.slice(i + 1, j).trim(), medias: pile.slice() });
      i = j + 1; debut = i; continue;
    }
    if (c === '}') { pile.pop(); i++; debut = i; continue; }
    if (c === ';') { i++; debut = i; continue; }   // @import, @charset : pas de bloc
    i++;
  }
  return out;
}

// Largeur maximale imposée par un @media : « (max-width:640px) » → 640 ; « (max-width: 640px) and (…) » → 640 ; sans max-width → Infinity.
export function largeurMax(media) {
  const m = /max-width\s*:\s*(\d+(?:\.\d+)?)px/.exec(media);
  return m ? +m[1] : Infinity;
}
// Une règle ne vaut-elle qu'au téléphone ? (au moins un @media autour d'elle plafonne la largeur à 640 px ou moins)
export const sousTelephone = r => r.medias.some(m => largeurMax(m) <= 640);

// Les sélecteurs d'une règle, séparés par les virgules de premier niveau.
export function selecteurs(sel) {
  const out = []; let n = 0, d = 0;
  for (let i = 0; i < sel.length; i++) {
    if (sel[i] === '(' || sel[i] === '[') n++; else if (sel[i] === ')' || sel[i] === ']') n--;
    else if (sel[i] === ',' && !n) { out.push(sel.slice(d, i).trim()); d = i + 1; }
  }
  out.push(sel.slice(d).trim());
  return out.filter(Boolean);
}
// Les règles qui portent exactement ce sélecteur (parmi ceux de leur liste).
export const trouve = (rs, sel) => rs.filter(r => selecteurs(r.sel).includes(sel));

// Poids d'un sélecteur, comme le calcule le navigateur : [identifiants, classes + attributs + pseudo-classes, balises + pseudo-éléments].
export function poids(sel) {
  const s = sel.trim(); let a = 0, b = 0, c = 0, i = 0;
  const finNom = k => { while (k < s.length && /[\wÀ-￿-]/.test(s[k])) k++; return k; };
  const finParen = k => { let n = 0; for (; k < s.length; k++) { if (s[k] === '(') n++; else if (s[k] === ')' && --n === 0) return k; } return s.length; };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '#') { a++; i = finNom(i + 1); }
    else if (ch === '.') { b++; i = finNom(i + 1); }
    else if (ch === '[') { b++; i = s.indexOf(']', i) + 1 || s.length; }
    else if (ch === ':') {
      if (s[i + 1] === ':') { c++; i = finNom(i + 2); continue; }
      const j = finNom(i + 1), nom = s.slice(i + 1, j);
      if (s[j] === '(') {
        const k = finParen(j), arg = s.slice(j + 1, k);
        if (nom === 'is' || nom === 'not' || nom === 'has') {   // le poids du plus lourd de ses arguments
          const m = selecteurs(arg).map(poids).sort(compare).pop() || [0, 0, 0];
          a += m[0]; b += m[1]; c += m[2];
        } else if (nom !== 'where') b++;                         // :nth-child(…), :lang(…) ; :where() ne pèse rien
        i = k + 1;
      } else { b++; i = j; }
    }
    else if (/[a-zA-Z]/.test(ch)) { c++; i = finNom(i); }
    else i++;
  }
  return [a, b, c];
}
export function compare(p, q) { for (let k = 0; k < 3; k++) if (p[k] !== q[k]) return p[k] - q[k]; return 0; }

// Les règles écrites dans une chaîne de style injectée par un écran (« '.x{a:b}', » dans un fichier JS) : on relit le CSS tel qu'il sera posé.
export function reglesInjectees(js, selecteur) {
  const out = [], esc = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|[\'"},;])\\s*' + esc + '\\{([^}]*)\\}', 'g'); let m;
  while ((m = re.exec(js))) out.push(m[1]);
  return out;
}

// Contraste WCAG 2 entre deux couleurs « #RRGGBB ».
export function contraste(x, y) {
  const lum = h => {
    const [r, g, b] = [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

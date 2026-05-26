// JARVIS · intents.js
// Interpréteur de commandes JARVIS (rule-based, sans LLM).
// Reconnaît les intentions en français et déclenche les actions appropriées.

import { openLens } from './lens.js';

const INTENT_RULES = [
  // Ouverture lentilles
  { re: /\b(catalogue|produit|offilog|reference|prix)\b/i, action: (ctx) => ctx.openLens('catalogue') },
  { re: /\b(journal|visite|agenda|planning|rdv passe|historique)\b/i, action: (ctx) => ctx.openLens('journal') },
  { re: /\b(rdv|rendez[- ]vous|booking|reservation)\b/i, action: (ctx) => ctx.openLens('rdv') },
  { re: /\b(pilotage|ca|chiffre.{0,3}affaire|kpi|stats?|objectif|top)\b/i, action: (ctx) => ctx.openLens('pilotage') },

  // Recherche pharmacie sur la carte
  {
    re: /\b(?:trouve|cherche|montre|ou est)\b\s+(.+)/i,
    action: (ctx, m) => ctx.searchPharma(m[1]),
  },

  // Help
  { re: /\b(aide|help|que peux[- ]tu|commandes?)\b/i, action: (ctx) => ctx.respond(helpText()) },

  // Salutations
  { re: /\b(salut|bonjour|hello|hey)\b/i, action: (ctx) => ctx.respond('Bonjour. Que cherches-tu ?') },
];

export function parseAndRunIntent(text, ctx) {
  const t = (text || '').trim();
  if (!t) return false;
  for (const rule of INTENT_RULES) {
    const m = t.match(rule.re);
    if (m) {
      try { rule.action(ctx, m); } catch (err) { console.error('[JARVIS intent]', err); }
      return true;
    }
  }
  // Fallback : recherche d'une pharmacie
  ctx.searchPharma(t);
  return false;
}

function helpText() {
  return `
    <strong>JARVIS</strong> écoute. Exemples :<br>
    · <em>« catalogue »</em> · ouvre les produits Offilog<br>
    · <em>« mes visites »</em> · journal des visites<br>
    · <em>« mes rdv »</em> · gestion des prises de RDV<br>
    · <em>« CA »</em> · pilotage commercial<br>
    · <em>« cherche république »</em> · localise une pharmacie<br>
  `;
}

// Helpers exposés pour main.js qui crée le ctx
export const CONTEXT_HELPERS = { openLens };

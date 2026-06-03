// JARVIS · intents.js
// Interpréteur de commandes JARVIS (rule-based, sans LLM).
// Reconnaît les intentions en français et déclenche les actions appropriées.

import { openLens } from './lens.js';
import { openDevisLens } from './lens-devis.js';

const INTENT_RULES = [
  // Ouverture lentilles
  { re: /\b(catalogue|produit|offilog|reference|prix)\b/i, action: (ctx) => ctx.openLens('catalogue') },
  { re: /\b(journal|visite|agenda|planning|rdv passe|historique)\b/i, action: (ctx) => ctx.openLens('journal') },
  { re: /\b(rdv|rendez[- ]vous|booking|reservation)\b/i, action: (ctx) => ctx.openLens('rdv') },
  { re: /\b(pilotage|ca|chiffre.{0,3}affaire|kpi|stats?|objectif|top)\b/i, action: (ctx) => ctx.openLens('pilotage') },
  { re: /\b(devis|panier|facture|simul|cot[ae]r)\b/i, action: () => openDevisLens() },
  { re: /\b(marketing|fiche|tract|brochure|offre)\b/i, action: (ctx) => ctx.openLens('marketing') },

  // Recherche pharmacie sur la carte
  // Note : "où est" avec accent — la Web Speech API transcrit l'accent correctement sur Chrome/Safari
  {
    re: /\b(?:trouve|cherche|montre|o[uù] est)\b\s+(.+)/i,
    action: (ctx, m) => ctx.searchPharma(m[1]),
  },

  // Help
  { re: /\b(aide|help|que peux[- ]tu|commandes?)\b/i, action: (ctx) => ctx.respond(helpText()) },

  // Salutations
  { re: /\b(salut|bonjour|hello|hey)\b/i, action: (ctx) => ctx.respond('Bonjour. Que cherches-tu ?') },

  // Politesse / phrases vides de sens — stopper avant le fallback searchPharma
  { re: /\b(merci|au revoir|bye|ok|d'accord|super|parfait|cool|nickel|voil[aà])\b/i, action: (ctx) => ctx.respond('Bien noté.') },
];

// Mots qui ne sont jamais des noms d'officine — éviter le fallback searchPharma inutile
const NOISE_WORDS = /^(quoi|comment|pourquoi|qu'est|c'est|ça|je|tu|il|nous|vous|ils|un|une|le|la|les|des|du|de|non|oui|euh|ah|oh|hm|ben|donc|alors|mais)$/i;

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
  // Fallback : recherche d'une pharmacie — mais seulement si le texte ressemble à un nom/ville
  const words = t.split(/\s+/);
  const looksLikeNoise = words.length <= 2 && words.every((w) => NOISE_WORDS.test(w));
  if (looksLikeNoise) {
    ctx.respond('Je n\'ai pas compris. Essaie « catalogue », « mes visites », « CA » ou le nom d\'une officine.');
    return false;
  }
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
    · <em>« marketing »</em> · fiches commerciales PDF<br>
    · <em>« cherche république »</em> · localise une pharmacie<br>
  `;
}

// Helpers exposés pour main.js qui crée le ctx
export const CONTEXT_HELPERS = { openLens };

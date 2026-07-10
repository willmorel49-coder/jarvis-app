# Leçons — CRM Jarvis / Intégral Pharma

> Journal d'ingénierie du projet : les pièges rencontrés et les réflexes à garder.
> Versionné avec le code (≠ mémoire globale de Will, qui couvre tous ses projets).
> **À compléter après chaque session** quand on apprend quelque chose de non-évident.

---

## Déploiement & mise en ligne
- **Cache-busting obligatoire.** Dès qu'un asset de `crm/v2/` (`.js`/`.css`/`.html` hors `index.html`) change, bumper le token `?v=...` dans `crm/v2/index.html` **ET** aligner `var VER` dans `crm/v2/sw.js`. Sinon le service worker (cache-first par version) ressert l'ancien code → « mes changements ne sortent pas ».
- **GitHub Pages** met 1–2 min à publier après le push.
- **Ne jamais réintroduire** le `unregister()` du service worker.

## Vérifier avant de livrer
- **Voir à l'écran, pas à l'aveugle.** Ouvrir la page (Playwright + `python3 -m http.server`, `file://` est bloqué), screenshot, corriger, PUIS déployer.
- **`node --check`** sur les JS modifiés avant push (une virgule manquante dans `v2-notes.js` aurait cassé la prod). Le CI (`.github/workflows/ci.yml`) le fait maintenant automatiquement + un smoke test.

## Mobile (cible réelle : commercial au comptoir sur téléphone)
- `input,select,textarea` → **16px** sous `max-width:640px` (sinon zoom auto iOS Safari). Règle globale posée dans `v2.css`.
- Cibles tactiles **≥ 44px** ; **zéro débordement horizontal** (mesurer `scrollWidth` vs `innerWidth`).
- Correctifs mobiles = media queries `max-width:640/480px`, **jamais** dégrader le desktop.

## Git — hygiène
- **JAMAIS `git add -A`** (embarque des PDF privés/lourds à la racine). Ajouter des fichiers **précis**.
- Si le robot veille a poussé entre-temps : `git pull --rebase --autostash origin main` puis push.

## Contraintes produit (non négociables)
- **Vanilla JS pur** : zéro build, zéro dépendance app, zéro requête réseau nouvelle. Doit marcher en ouvrant `index.html`.
- Features **100 % client-side** : pas de clé API / serveur / coût (Will refuse « trop compliqué »).
- Print-safe + `prefers-reduced-motion` respectés. Éviter `background-clip:text` sur gros texte (crash Safari sur le Mac de Will).

## Données & robots
- **Cron GitHub = best-effort** (retards de plusieurs heures, voire sauté). D'où 2 passages/jour pour la veille + un run manuel possible (`gh workflow run`).
- Les vraies ruptures viennent de l'**API BDPM**, pas des flux RSS ANSM (souvent vides).

## Métier (à ne jamais confondre)
- **Génériques** : `27 %` = remise génériqueur, **PAS** d'abandon de marge en plus. L'abandon 6–9 % concerne le princeps.
- Dire « **abandon de marge** », pas « remise ». Barème par tranche : <4,33 € / 4,33–468 € (3,89 %) / >468 € (19,50 € forfait).

## Environnement de dev
- Le navigateur MCP se verrouille (`SingletonLock`) : si « browser already in use », tuer le process `mcp-chrome-*` + supprimer le lock, puis relancer.
- **Économie de tokens** : déléguer aux sous-agents (le bruit des outils reste dans leur contexte), Haiku pour le mécanique, recherche → Perplexity / brouillons → ChatGPT hors du build.

---

_Dernière mise à jour : 2026-07-10._

# Code Review — Session des 10 derniers commits

Périmètre : refonte iOS-native (tab bar, large titles, motion, skeletons), perf-boot lazy-loader, module Marketing, install agents Pharma.

Fichiers analysés (dans la zone code-reviewer) : `crm/perf-boot.js`, `crm/native-shell.js`, `crm/native-headers.js`, `crm/native-motion.js`, `crm/skeleton-loaders.js`, `crm/mobile-shell.js`, `crm/marketing.js`, `crm/classic-overrides.js`, `crm/index.html`, scripts Python racine.

---

## 1. Problèmes identifiés

### BLOQUANT

| Fichier:ligne | Description | Statut |
|---|---|---|
| `crm/perf-boot.js:19-35` | `LAZY_BUNDLES` n'inclut pas `marketing`, qui dépend pourtant de `BENCHMARK` (themeProducts, searchProducts, mkToggleProduct). Au boot, BENCHMARK est lazy → la nouvelle tab Marketing (tab principale depuis `feat(nav): Marketing remplace Produits dans la tab bar`) affiche **0 produits** dans toutes les cartes thèmes tant que l'idlePreload de 4 s n'a pas tourné. Si Will ouvre marketing au boot, expérience cassée. | **FIX appliqué** |
| `crm/native-headers.js:331-347` | La boucle `tryWrap` appelle `applyForPage(pageId)` à **chaque tick** (jusqu'à 30 × 120 ms = 3,6 s). Chaque appel ré-injecte le `.large-title-block` dans le container actif → flicker visible et travail DOM inutile pendant tout le boot, même quand `wrapNavigate` / `wrapRenderers` sont déjà installés. | **FIX appliqué** |

### IMPORTANT

| Fichier:ligne | Description | Statut |
|---|---|---|
| `crm/marketing.js:464, 466, 471` | `s.title` et `p.designation` injectés via innerHTML sans escape dans la bibliothèque de fiches. Sheets stockées en localStorage / Supabase puis re-rendues → XSS local si user saisit `<script>` dans un titre, et casse de layout dès qu'un produit contient `&` ou `<`. | **FIX appliqué (escapeAttr)** |
| `crm/marketing.js:780, 798, 800, 830, 852-858, 901, 911-916` | Même problème dans les 3 templates PDF (`renderOffreTemplate`, `renderMemoTemplate`, `renderFocusTemplate`) : `sheet.title`, `sheet.footer`, `p.designation`, `p.accroche`, `p.argument` directement interpolés. PDF généré → potentiel rendu dégradé. Non fixé pour rester sous le cap de 3 fixes. | À traiter |
| `crm/marketing.js:194` | `saveSheets` skip `lsSave` quand `_supaUser` existe. Si l'upsert Supabase async (l. 209-214, fire-and-forget) échoue silencieusement, les fiches éditées ne sont sauvegardées NULLE PART. Pas de fallback ni de retry. | À traiter |
| `crm/native-shell.js:228-279` | `attachSwipeToClose` attache `mousemove` / `mouseup` au `window` global pour le handle. Ces listeners ne sont jamais détachés → leak permanent (mineur en pratique car shell instancié 1 fois). | À traiter |
| `crm/skeleton-loaders.js:230` | `containerIsEmpty(c)` retourne `false` si `native-headers` a déjà injecté le `.large-title-block` (pas la classe `skel-wrap`) → skeleton non monté sur la 1re navigation vers une page. Selon l'ordre des wrappers (LIFO), c'est le cas dès qu'on navigate via la tab bar. Bug silencieux. | À traiter |

### NICE-TO-HAVE

| Fichier:ligne | Description |
|---|---|
| `crm/native-motion.js:188` | `var seen = new Set ? new Set() : null;` — `new Set` sans parens *est* une construction réelle, le tri-state est inutile. Idiome confus. |
| `crm/native-headers.js:128-132` | `buildLargeTitleHTML` retourne `''` et n'est jamais appelée — dead code. |
| `crm/perf-boot.js:16` | `VERSION = '?v=20260603g'` hardcodé alors qu'`index.html` est à `20260603h`. Désync de cache-buster entre scripts chargés au boot et scripts lazy. |
| `crm/marketing.js:48-83` | `PDF_FONT_CSS` injecte 4 `@font-face` depuis Google Fonts dans le `<head>` à chaque génération PDF. Charge OK car guard `getElementById('mk-pdf-font-style')`, mais le `@font-face` reste pour toute la session — pas critique. |
| `crm/mobile-shell.js:208-214` | `setTimeout(closeDrawer, 80)` au clic nav-item — magic number ; préférer une promesse navigate. |

---

## 2. Diff résumé des 3 fixes appliqués

### Fix 1 — `crm/perf-boot.js`

Ajout d'un bundle `marketing` dans `LAZY_BUNDLES` pour charger `benchmark-data.js` dès l'entrée dans l'onglet Marketing (sinon themeProducts retourne `[]`).

```diff
   var LAZY_BUNDLES = {
     benchmark: [ ... ],
+    // Marketing dépend de BENCHMARK (themeProducts/searchProducts)
+    marketing: [
+      'benchmark-data.js'
+    ],
     offilog: [ ... ]
   };
```

### Fix 2 — `crm/native-headers.js`

Garde `appliedOnce` pour n'injecter le large-title qu'une seule fois après que `navigate` et `renderDashboard` sont disponibles, + safety net si timeout 3,6 s atteint.

```diff
-    let tries = 0;
-    const tryWrap = () => {
-      tries++;
-      const hasNav = ...; const hasRender = ...;
-      if (hasNav) wrapNavigate();
-      if (hasRender) wrapRenderers();
-      applyForPage(pageId);   // appelé 30 fois !
-      if ((!hasNav || !hasRender) && tries < 30) setTimeout(tryWrap, 120);
-    };
+    let appliedOnce = false;
+    const tryWrap = () => {
+      tries++; ...
+      if (hasNav) wrapNavigate();
+      if (hasRender) wrapRenderers();
+      if (hasNav && hasRender && !appliedOnce) {
+        applyForPage(pageId); appliedOnce = true; return;
+      }
+      if (tries < 30) setTimeout(tryWrap, 120);
+      else if (!appliedOnce) { applyForPage(pageId); appliedOnce = true; }
+    };
```

### Fix 3 — `crm/marketing.js`

Escape des champs user-editables `s.title` et `p.designation` dans la bibliothèque.

```diff
-      <div class="mk-lib-prev-sub">${s.title}</div>
+      <div class="mk-lib-prev-sub">${escapeAttr(s.title)}</div>
       ...
-      ${(s.products||[]).slice(0,4).map(p => `<div ...>${(p.designation||'').slice(0,22)}…</div>`).join('')}
+      ${(s.products||[]).slice(0,4).map(p => `<div ...>${escapeAttr((p.designation||'').slice(0,22))}…</div>`).join('')}
       ...
-      <div class="mk-lib-title">${s.title}</div>
+      <div class="mk-lib-title">${escapeAttr(s.title)}</div>
```

---

## 3. Suggestions long terme (top 5)

1. **Helper `escapeHtml` centralisé et systématique** dans tout `marketing.js` (templates PDF inclus). Étendre `escapeAttr` ou réutiliser celui de `classic-overrides.js` (déjà conforme : échappe `& < > " '`). Audit complet recommandé sur tous les `innerHTML` qui interpolent du contenu Supabase.

2. **`saveSheets` Supabase robuste** : await l'upsert (ou retry), feedback UI sur échec, et **toujours** sauvegarder en localStorage en miroir (pas seulement si offline). Aujourd'hui une coupure réseau pendant l'édition perd les modifs sans alerte.

3. **Ordre des wrappers `window.navigate`** : 5 fichiers wrappent navigate (`perf-boot`, `native-shell`, `native-headers`, `skeleton-loaders`, `mobile-shell`). Documenter explicitement la sémantique et l'ordre attendu, ou centraliser dans un seul "navigation pipeline" pour éviter les bugs comme `containerIsEmpty` qui voit déjà du DOM injecté par un autre wrapper.

4. **Centralisation des cache-busters** : actuellement `perf-boot.js:16` a `?v=20260603g`, `index.html` a `?v=20260603h`. Un `window.APP_VERSION` global lu par tous éviterait la désync.

5. **Tests fumée page par page** : un simple HTML-runner qui navigate('marketing'), navigate('benchmark'), etc. et vérifie qu'aucune erreur console n'apparaît. Au rythme actuel (10+ commits feat/ux par jour), un smoke test attraperait les régressions sans imposer une suite unit complète.

---

## Récap chiffré

- **BLOQUANT** : 2 identifiés / 2 fixés
- **IMPORTANT** : 5 identifiés / 1 fixé (cap de 3 fixes respecté)
- **NICE-TO-HAVE** : 5 listés / 0 fixé
- **Fichiers édités** : `crm/perf-boot.js`, `crm/native-headers.js`, `crm/marketing.js`
- **Top quick wins long terme** : escape systématique innerHTML marketing.js · saveSheets Supabase robuste · pipeline navigate centralisé

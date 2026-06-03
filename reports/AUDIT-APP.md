# AUDIT APP — Intégral Pharma CRM
> Généré 2026-06-03 · mode classique uniquement (JARVIS retiré du shell mais code encore en repo)
> Périmètre : `/Users/williammorel/JARVIS/APP/crm/` (vanilla JS, GitHub Pages, Supabase)
> Méthodo : cartographe + bug-hunter. Pas d'opinion, des lignes.

---

## A · Cartographie

### A.1 Arborescence top-level utile

```
/Users/williammorel/JARVIS/APP/
├── crm/                       ← APP DEPLOYÉE (index.html + 30 .js + 17 .css)
│   └── jarvis/                ← MORT : 18 fichiers (5 745 lignes) plus liés à index.html
├── AGENTS/                    ← .md sous-agents (cartographer, bug-hunter, etc.)
├── docs/                      ← docs perso
├── output/                    ← screenshots inspi
├── reports/                   ← ce rapport
├── STATS / OFFILOG / MERKETING / opso / inspi design / tasks
├── *.xlsx / *.csv / *.pdf     ← sources données + livrets
├── *.py                       ← scrapers + générateurs JS
├── ROBOT.md / CLAUDE.md       ← config Claude
```

### A.2 Top 12 fichiers par poids — `crm/`

| Lignes | Fichier | Rôle |
|---:|---|---|
| 175 650 | `establishments-aggregate.js` | DATA — OPS / CPR / HP par artcode (lazy) |
| 18 598 | `sales-detail.js` | DATA — 12 agrégats sales (eager) |
| 13 398 | `drakkars-data.js` | DATA — scrape Drakkars (lazy) |
| 12 750 | `stock.js` | DATA — inventaire 01/06 (eager) |
| 10 505 | `benchmark-data.js` | DATA — IP × Ameli (lazy) |
| 8 815 | `app.js` | CORE — 80% du code, login, navigate, renderXxx V1 |
| 8 456 | `catalogue-ip.js` | DATA — TOP IP décroissant (eager) |
| 7 804 | `cap3000-data.js` | DATA — scrape Cap3000 (lazy) |
| 5 027 | `pharmacies-geo.js` | DATA — géoloc 517 pharmas (eager) |
| 3 525 | `offilog-data.js` | DATA — 3 520 produits offilog (lazy) |
| 1 673 | `classic-overrides.js` | OVERRIDE — V2 pages (8 renders patchés) |
| 1 153 | `marketing.js` | FEATURE — fiches IP + PDF (recent) |

### A.3 Modifs récentes (`crm/`) — depuis 2026-05-26
- `index.html` v=20260603h (cache buster)
- `dashboard-v2.js`, `classic-overrides.js`, `marketing.js/css`, `native-motion.js/css`, `native-shell.js/css`, `skeleton-loaders.js/css`, `perf-boot.js`, `benchmark-focus.js`, `benchmark-multibench.js` → toutes ces nouveautés sont arrivées en cavalerie (commit "feat:" en série, sans rebase)
- `style-classic.css` (1 213 lignes) édité en dernier — pas cache-busté

### A.4 Chargement (ordre `<head>` index.html)
```
Étape 0  : data-mode=classic (script inline ligne 13)
Étape 1  : Leaflet (CDN, sync, blocking)
Étape 2  : 5 × CSS native + 4 × CSS desktop + 4 × CSS mobile + 5 × CSS native
Étape 3  : Supabase JS, Chart.js, SheetJS, html2pdf.js (CDN, sync)
Étape 4  : 7 × data eager (clients, geo, groupements, catalogue-ip, client-products, stock, sales-detail) — sync
Étape 5  : BRIDGE inline (const → window.X)
Étape 6  : Config Supabase + Chart.js defaults (inline)
Étape 7  : app.js, dashboard-v2, perf-boot, classic-overrides, mobile-shell, native-shell, native-headers, native-motion, skeleton-loaders, marketing (defer, exec dans l'ordre)
```

### A.5 Graphe de dépendances (lecture/écriture globals)

```
sales-detail.js  ─── écrit ───►  window.SALES_TOTAL, SALES_BY_*, SALES_BY_CLIENT_*
clients-data.js  ─── const   ─►  window.CLIENTS (via bridge inline)
catalogue-ip.js  ─── écrit ───►  window.CATALOGUE_IP
client-products  ─── écrit ───►  window.CLIENT_PRODUCTS, CLIENT_PRODUCTS_TOTAL_CA
stock.js         ─── écrit ───►  window.STOCK
pharmacies-geo   ─── écrit ───►  window.PHARMACIES_GEO
groupements      ─── const   ─►  window.GROUPEMENTS

──── LAZY (chargés au navigate('benchmark')) ────────────────────────
benchmark-data.js              window.BENCHMARK
establishments-aggregate.js    window.OPS_AGGREGATE, OPS_TOTAL,
                               CPR_AGGREGATE, CPR_TOTAL, HP_AGGREGATE, HP_TOTAL
benchmark-multibench.js        window.buildMultiBenchHtml()
benchmark-focus.js             window.buildProductFocusByCategoryHtml()
benchmark-manque-a-gagne.js    window.buildManqueAGagneHtml()
benchmark-penetration.js       window.buildPenetrationCommercialeHtml()
benchmark-laboratoires.js      window.buildLaboratoiresComparisonHtml()
benchmark-trajectoires.js      window.buildTrajectoiresHtml()

──── LAZY (chargés au navigate('offilog')) ─────────────────────────
offilog-data.js                window.OFFILOG
drakkars-data.js               window.DRAKKARS
cap3000-data.js                window.CAP3000
```

### A.6 Points d'entrée critiques
- `app.js:533` `renderDashboard()` — overridé par `dashboard-v2.js:447`
- `app.js:5676` `navigate(page)` — wrapé 5 fois en chaîne : perf-boot → classic-overrides → native-shell → native-headers → skeleton-loaders
- `classic-overrides.js:1650` `applyOverrides()` — patche 8 renderXxx → renderXxxV2 (retry 100ms si applied < 8)
- `dashboard-v2.js:457` `applyOverride()` — patche renderDashboard → renderDashboardV2

---

## B · Dette technique

### B.1 Code mort certifié

| Fichier | Lignes | Statut |
|---|---:|---|
| `crm/jarvis/*.js` | 5 745 | Plus chargé depuis index.html (mode JARVIS retiré). 18 fichiers à archiver/supprimer. |
| `crm/catalogue-data.js` | 1 (≈ 643 KB blob gzip+b64) | Référencé uniquement par `catalogue.js` (lui-même mort). |
| `crm/catalogue.js` | 528 | Pas chargé par index.html. Référence `catalogue-data.js` mort. |
| `crm/clients-data.bak.js` | 1 033 (265 KB) | Backup, jamais référencé. |
| `crm/book.html` | 239 | Référencé seulement par `crm/jarvis/lens-rdv.js` (mort). |
| `crm/style-jarvis.css` | 893 | Mode JARVIS retiré (data-mode forcé 'classic' ligne 14 index.html). |
| `app.js:533-1848` `renderDashboard` (≈ 1 316 lignes) | Overridé par dashboard-v2. Toujours en RAM. |
| `app.js:4119-4283` `renderImport` | DOM `#import-content` n'existe pas. Wrap navigate('import')→dashboard. |
| `app.js:4375-4589` `renderObjectifs` | DOM `#objectifs-content` n'existe pas. Wrap navigate('objectifs')→dashboard. |
| `app.js:4590-4839` `renderAdmin` | DOM `#admin-content` n'existe pas. PAS de wrap → si appel direct = crash silencieux. |
| `app.js:158-355` import Excel logique | Plus accessible via UI (onglet retiré). |

**Total estimé : ~14 MB de fichiers + ~4 000 lignes JS exécutables jamais atteints.**

### B.2 Inconsistances entre fichiers

| Type | Détail |
|---|---|
| Cache-buster CSS | `index.html` cache-bust `native-*.css` et `marketing.css` mais PAS `style.css`, `style-classic.css`, `styles-pharmacies.css`, `styles-offilog.css`, `catalogue.css`. Les éditions de `style-classic.css` (1 213 lignes, dernière modif aujourd'hui) ne propagent pas en prod. |
| Cache-buster JS | `perf-boot.js:16` `VERSION = '?v=20260603g'` (avec **g**) mais index.html utilise `?v=20260603h` (avec **h**). Les scripts lazy chargés via perf-boot servent une version désynchronisée. |
| Date des data | `clients-data.js` 03-mai, `benchmark-data.js` 04-mai, `offilog-data.js` 09-mai, `cap3000-data.js` 08-mai, `drakkars-data.js` 09-mai. État courant claimé dans ROBOT.md ≠ état réel. |
| Format identifiant produit | `BENCHMARK[].cip13` (commence par 34009 — code CIP médicament) vs `OFFILOG[].ean` (EAN-13 parapharma, 3661/3662/...). Joints comme s'ils étaient identiques (app.js:5760). Voir §C bug #1. |
| Style commit/commentaire | mélange anglais/français, sigles "V1/V2", emojis dans certains fichiers et pas d'autres |
| Indentation | mélange tabs/2 espaces dans certains hot paths (app.js, classic-overrides.js) |
| Conventions naming | `prodFamille` vs `prod_famille` vs `prodSortCol` — pas de stratégie |

### B.3 Duplication (DRY)

| Code dupliqué | Emplacements |
|---|---|
| `fmtEuro(n)` — formatter français | redéfini dans `dashboard-v2.js:7`, `classic-overrides.js:7`, `benchmark-multibench.js`, `benchmark-trajectoires.js`, `benchmark-focus.js` (5 copies) |
| `escapeHtml(s)` | redéfini dans `dashboard-v2.js:19`, `classic-overrides.js:15`, `benchmark-trajectoires.js`, `marketing.js`, `app.js` (≥ 5 copies) |
| `familleFromAttrs` + `trancheFromPrix` | duplications entre `classic-overrides.js` et `benchmark-multibench.js` |
| `FAMILLE_COLORS` palette | redéfinie 5× dans `classic-overrides.js` (buildVentilationHtml, buildMixVsOpsHtml, buildTop15OpsHtml, buildMyTop15PdmHtml, buildTrancheFamilleMatrixHtml) |
| `getCatLeclMap()` + `leclCatMap` Leclerc lookup | logique copiée 3× : `app.js:5736`, `app.js:5860`, `classic-overrides.js` (renderOffilogV2 inline) |
| Wrapper `navigate()` | 5 implémentations IIFE distinctes (perf-boot, classic-overrides, native-shell, native-headers, skeleton-loaders) — chacune réinvente sa garde + retry |
| Supabase client | `app.js:10` `const sb = supabase.createClient(...)` ET `marketing.js:158` `_supaClient = window.supabase.createClient(...)`. Deux clients → deux sessions potentiellement divergentes. |
| Cache-busting version | `?v=20260603h` répété 15× en hardcoded dans index.html (pas de constante) |

### B.4 Code commenté / artefacts

- `app.js:7192` commentaire `crm/jarvis/main.js` mort
- `classic-overrides.js:1323-1365` 40 lignes wrappées dans `<div style="display:none">` (ancien rendu catégories conservé)
- `ROBOT.md` mentionne `OFFILOG_LIVE` et `opso/leclerc-data.js` qui ne sont pas chargés par index.html (`opso/offilog-live-data.js` n'est référencé nulle part dans crm/)
- `app.js:1` header banner `localStorage (V1) → Supabase (V2)` — V1 retirée mais commentaire toujours là
- `PAGE_MAP` dans `skeleton-loaders.js:190` référence 3 routes mortes (`import`, `admin`, `objectifs`)

---

## C · Bugs réels identifiés (top 10)

> ACTIF = visible / impactant en prod aujourd'hui · LATENT = condition réunissable

### #1 — CRITIQUE · Filtre catalogue "Leclerc moins cher" toujours vide [ACTIF]
**Fichier** : `crm/app.js:5736-5765`  
**Symptôme** : L'onglet "🛒 Leclerc moins cher" dans le Catalogue IP affiche systématiquement aucun résultat (ou des matches accidentels rarissimes).  
**Cause racine** :
```js
// app.js:5739-5743
for (const p of OFFILOG) {
  if (p.ean && p.prix_leclerc > 0) _catLeclMap.set(String(p.ean), p.prix_leclerc);
}
// app.js:5760
const lp = b.cip13 ? lm.get(String(b.cip13)) : null;
```
Map clé = `OFFILOG[].ean` (EAN-13 parapharma, commence 3661/3662/3596…), lookup avec `BENCHMARK[].cip13` (CIP médicament, commence 34009…). Les deux espaces d'identifiants ne se recouvrent quasiment jamais (BENCHMARK = médicaments Ameli, OFFILOG = parapharmacie).  
**Fix proposé** : soit retirer la tab (les médicaments BENCHMARK n'ont pas de prix Leclerc disponibles), soit créer un index BENCHMARK → OFFILOG par nom normalisé.

### #2 — CRITIQUE · Persistence Supabase marketing_sheets cassée [ACTIF]
**Fichier** : `crm/marketing.js:314` + `crm/supabase-schema.sql:87`  
**Symptôme** : Aucune fiche marketing créée ne se sauvegarde dans Supabase. Persistence uniquement localStorage. Migration silencieuse échoue dans `console.warn`.  
**Cause racine** :
```js
// marketing.js:314 — id généré côté client
id: 'mk_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),

// supabase-schema.sql:87 — colonne id typée uuid
id uuid primary key default gen_random_uuid(),
```
Le `.upsert({ id: 'mk_...' })` produit `PostgrestError: invalid input syntax for type uuid: "mk_…"`, swallow par `console.warn` (ligne 212).  
**Fix proposé** : générer un UUID v4 côté client (`crypto.randomUUID()`) OU changer la colonne en `text primary key`.

### #3 — CRITIQUE · perf-boot.js sert cache-buster désynchronisé [ACTIF]
**Fichier** : `crm/perf-boot.js:16`  
**Symptôme** : Les fichiers lazy (benchmark-data, establishments-aggregate, offilog-data, drakkars-data, cap3000-data, benchmark-*) sont servis avec `?v=20260603g`, alors qu'index.html utilise `?v=20260603h` partout. Sur un déploiement avec data modifiée mais cache CDN agressif, l'utilisateur voit data eager fraîche + data lazy périmée.  
**Cause racine** : `var VERSION = '?v=20260603g';` non mis à jour quand le bumper a passé de g→h.  
**Fix** : extraire la constante de version, sourcée depuis un meta tag ou data-attribute pour qu'index.html et perf-boot soient cohérents.

### #4 — CRITIQUE · Dashboard alertes "OPS" toujours vides au premier render [ACTIF]
**Fichier** : `crm/dashboard-v2.js:58` (et 150-200)  
**Symptôme** : Sur le dashboard (page d'accueil), les alertes "Famille sous-indexée vs OPS" et "Top produits OPS absents" sont systématiquement absentes au premier chargement.  
**Cause racine** : `window.OPS_AGGREGATE` n'est défini que dans `establishments-aggregate.js` (lazy bundle 'benchmark'). Le dashboard est rendu AVANT que l'utilisateur visite l'onglet Benchmark. `opsAgg = {}` → toutes les branches `if (opsAgg && Object.keys(opsAgg).length)` (lignes 150, 181) sont skip.  
**Fix proposé** : soit forcer un preload de OPS_AGGREGATE dès le boot (cher : 4 MB), soit ré-render le dashboard quand OPS_AGGREGATE arrive (event), soit retirer ces 2 alertes du dashboard.

### #5 — MAJEUR · Top 5 pharmas + alertes du dashboard non cliquables [ACTIF]
**Fichier** : `crm/dashboard-v2.js:350` et `:402`  
**Symptôme** : Les lignes du Top 5 pharmas et les alertes ont `cursor:pointer` mais `onclick="console.log('[dashboard] click client', '${cip}')"` — pure log, aucune navigation. Le commercial clique, rien ne se passe.  
**Cause racine** : Placeholder oublié — jamais branché à `navigate('pharmacies')` + `pharmaDetailOverridePeriod` puis `showPharmaDetail(...)`.  
**Fix proposé** : `onclick="navigate('pharmacies'); setTimeout(()=>renderPharmaDetail('${escapeHtml(c.cip)}'),80)"` (utiliser le `renderPharmaDetail` de classic-overrides).

### #6 — MAJEUR · `renderAdmin()` / `renderImport()` crash silencieux [ACTIF latent]
**Fichier** : `crm/app.js:4191`, `4682` (et appels `5024`, `5048`, `5105`)  
**Symptôme** : `document.getElementById('import-content').innerHTML = ...` et `getElementById('admin-content').innerHTML = ...` accèdent à des éléments DOM qui n'existent plus dans index.html (seuls 9 `page-*` sont déclarés). Le wrap `wrapNavigate` (classic-overrides.js:1640) redirige `import` et `objectifs` vers dashboard mais PAS `admin`. Et les appels directs depuis `app.js:5024 renderAdmin()` (addPharmacy / resetAllData / migrateFromLocalStorage) ne sont pas wrappés.  
**Cause racine** : suppression de l'onglet admin dans index.html sans nettoyage des render functions et des appels internes. `renderAdminV2` (classic-overrides.js:1591) écrit aussi dans `#admin-content` — silencieux.  
**Fix proposé** : soit ajouter `admin` au redirect dans wrapNavigate, soit supprimer les 3 fonctions et leurs appels.

### #7 — MAJEUR · classic-overrides.applyOverrides retry infini si une fn manque [LATENT]
**Fichier** : `crm/classic-overrides.js:1650-1666`  
**Symptôme** : `if (applied < 8) setTimeout(applyOverrides, 100)` — boucle 10 fois/s indéfiniment si UNE des 8 `window.renderXxx` reste absente. Pas de cap d'essais.  
**Cause racine** : aujourd'hui les 8 fns existent (déclarées `function` au top-level → exposées sur window en script tag non-module). Si demain un refactor supprime `renderSimulator` (par ex.), l'app boot avec un setInterval permanent. Pas de log d'alerte.  
**Fix proposé** : ajouter `let attempts = 0; if (++attempts > 30) { console.warn(...); return; }`.

### #8 — MAJEUR · Chaîne `navigate()` à 5 wrappers — risque d'amnésie de `this` [LATENT]
**Fichier** : `crm/perf-boot.js:101`, `classic-overrides.js:1639`, `native-shell.js:335`, `native-headers.js:286`, `skeleton-loaders.js:225`  
**Symptôme** : Chaque module wrap navigate sans se coordonner. Chacun teste `typeof window.navigate === 'function'` puis remplace. La chaîne finale fait 5 niveaux d'appels imbriqués. Erreurs dans n'importe quel wrap → chaîne brisée, navigation muette.  
**Cause racine** : "feature flag" architecture jamais centralisée — chaque cavalerie de fix ajoute son wrap.  
**Fix proposé** : centraliser via `window.navigate.use(middleware)` ou hub d'événements. À minima, audit ordre + tests de non-régression.

### #9 — MAJEUR · `sparkGrad` SVG id partagé sur dashboard [LATENT]
**Fichier** : `crm/dashboard-v2.js:226`  
**Symptôme** : Le SVG sparkline du hero utilise `<linearGradient id="sparkGrad">`. Si un autre composant futur réutilise la fn `sparkline()` dans la même page, les `<defs>` ont des IDs en collision — navigateurs utilisent la première def trouvée, animations ratent.  
**Cause racine** : ID hardcodé.  
**Fix** : ID unique par appel (`sparkGrad-${Math.random().toString(36).slice(2)}`).

### #10 — MINEUR · `fmt(n)` lance sur null/NaN [LATENT]
**Fichier** : `crm/app.js:439`  
**Symptôme** : `fmt(null)` → `null.toFixed(0)` → TypeError. `fmt(NaN)` → `'NaN€'`.  
**Cause racine** : pas de garde, contrairement à `fmtP` (ligne 6487) qui en a une.  
**Fix** : ajouter `if (n == null || isNaN(n)) return '—'`. Aujourd'hui les call-sites passent toujours un nombre, mais futur quelqu'un l'utilisera autrement.

#### Mentions secondaires (non top-10) :
- `app.js:6538` `Math.min(...arr.filter(...))` sans `.concat([Infinity])` (vs ligne 6553 qui l'a) → tri instable si pas de prix concurrent
- `marketing.js:158` second supabase client → drift de session
- `app.js:5860` commentaire "EAN → prix_leclerc" mais lookup réel par CIP (cf bug #1)
- `skeleton-loaders.js:190` PAGE_MAP référence `import-content`, `admin-content`, `objectifs-content` (DOM absent)
- `marketing.js:298` ré-render après initPersistence sans cap retry
- `native-headers.js:286` wrap navigate après skeleton-loaders → skeleton n'est plus déclenché si l'utilisateur navigue via header

---

## D · Quick wins immédiats (< 30 min, gain élevé)

### QW1 · Aligner cache-buster perf-boot avec index.html
**Fichier** : `crm/perf-boot.js:16`  
**Action** : changer `var VERSION = '?v=20260603g';` → `var VERSION = '?v=20260603h';`  
**Impact** : data lazy à jour, plus de désync visible-vs-cache. 30 sec.

### QW2 · Cache-buster les 5 CSS desktop manquants
**Fichier** : `crm/index.html:39-42`  
**Action** : ajouter `?v=20260603h` sur `style.css`, `style-classic.css`, `styles-pharmacies.css`, `styles-offilog.css`, `catalogue.css`.  
**Impact** : edits CSS-classic (1 213 lignes en cours d'édition) propagent en prod immédiatement.

### QW3 · Brancher click Top 5 pharmas du dashboard
**Fichier** : `crm/dashboard-v2.js:350`  
**Action** : remplacer `onclick="console.log(...)"` par `onclick="navigate('pharmacies'); setTimeout(()=>renderPharmaDetail('${escapeHtml(c.cip)}'),80)"`.  
**Impact** : feature qui paraît cassée devient fonctionnelle. Win UX immédiat pour Will.

### QW4 · Supprimer la tab "🛒 Leclerc moins cher" du Catalogue IP
**Fichier** : `crm/app.js:5850`  
**Action** : retirer la ligne `{ key: 'leclerc', label: '🛒 Leclerc moins cher' }` du tableau `tabDefs`. (Garder le helper getCatLeclMap pour `prixLecl` ailleurs.)  
**Impact** : élimine une tab vide trompeuse jusqu'à fix #1 propre.

### QW5 · Patcher marketing.js pour UUID Supabase
**Fichier** : `crm/marketing.js:314`  
**Action** : remplacer `id: 'mk_' + Date.now() + '_' + Math.random()...` par `id: (crypto.randomUUID && crypto.randomUUID()) || ('mk_' + Date.now() + '_' + Math.random().toString(36).slice(2,7))` ET ajouter dans Supabase `alter table marketing_sheets alter column id type text;` OU forcer UUID partout.  
**Impact** : persistence Supabase fonctionne, fiches sync entre devices.

### QW6 · Ajouter cap retry classic-overrides
**Fichier** : `crm/classic-overrides.js:1661`  
**Action** : `let attempts = 0;` en haut de `applyOverrides`, puis `if (++attempts > 30) { console.warn('[classic-overrides] giving up, applied=' + applied); return; }` avant le setTimeout.  
**Impact** : plus de boucle infinie silencieuse en cas de refactor futur.

### QW7 · Supprimer le dossier `crm/jarvis/` du repo
**Fichier** : tout `crm/jarvis/*`  
**Action** : `git rm -r crm/jarvis/` + supprimer `crm/book.html` + `crm/style-jarvis.css`.  
**Impact** : -5 745 lignes JS + 893 lignes CSS + 239 HTML, repo plus lisible, plus aucune confusion sur lens-* ou orb.js.

### QW8 · Supprimer `clients-data.bak.js` et `catalogue-data.js`/`catalogue.js`
**Fichier** : ces 3 fichiers  
**Action** : `git rm crm/clients-data.bak.js crm/catalogue-data.js crm/catalogue.js`.  
**Impact** : -643 KB binaire mort + -1 561 lignes JS.

### QW9 · Retirer `import`/`admin`/`objectifs` de skeleton-loaders.PAGE_MAP
**Fichier** : `crm/skeleton-loaders.js:194-201`  
**Action** : supprimer les 3 entrées des routes mortes.  
**Impact** : code-map propre, pas de skeleton sur DOM absent.

### QW10 · Mutualiser `fmtEuro` + `escapeHtml` dans un fichier `crm/utils.js`
**Fichiers** : 5+ copies réparties  
**Action** : créer `crm/utils.js` (eager, avant app.js) exposant `window.fmtEuro`, `window.fmtNum`, `window.escapeHtml`. Supprimer les redéfinitions locales (dashboard-v2, classic-overrides, marketing, benchmark-*).  
**Impact** : ~100 lignes de moins, formats cohérents (aujourd'hui certains font `Math.round(n/1000)` d'autres `(n/1000).toFixed(0)`).

---

## Récap final

**Top 3 bugs critiques** :
1. Filtre "Leclerc moins cher" du Catalogue IP toujours vide — lookup CIP13 vs map indexée par EAN-13 (`app.js:5760`).
2. Persistence Supabase marketing_sheets cassée — id client `mk_...` rejeté par colonne uuid (`marketing.js:314` × `supabase-schema.sql:87`).
3. Cache-buster `perf-boot.js` désynchronisé (`g` vs `h`) — data lazy périmée en prod (`perf-boot.js:16`).

**Top 3 dette tech** :
1. `crm/jarvis/` + `catalogue.js` + `clients-data.bak.js` + `book.html` = 8 000+ lignes / ~1 MB de code mort jamais chargé.
2. 5 wrappers `navigate()` concurrents (perf-boot, classic-overrides, native-shell, native-headers, skeleton-loaders) — pas de hub central.
3. 5 copies de `fmtEuro` et 5 copies de `escapeHtml` éparpillées entre dashboard-v2, classic-overrides, marketing, benchmark-*.

**Top 3 quick wins recommandés** :
1. **QW1** aligner perf-boot.js v=g→h (30 sec, débloque cache).
2. **QW3** brancher click Top 5 pharmas (3 min, win UX visible immédiat pour Will).
3. **QW7+QW8** purger jarvis/ + bak + catalogue mort (5 min, repo redevient lisible avant prochaines refontes).

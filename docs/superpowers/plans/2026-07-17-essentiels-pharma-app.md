# App Essentiels Pharma — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un cockpit de pilotage groupement pour Essentiels Pharma, clone reskiné (bleu + « Le réflexe santé ») de l'app OPSO, avec données groupement vides mais états propres, en ligne sur `.../jarvis-app/essentiels-pharma/`.

**Architecture :** Copie du dossier `/opso/` → `/essentiels-pharma/` dans le repo `jarvis-app`. Reskin **chirurgical** : on change les variables/couleurs CSS, les SVG logo/favicon, les chaînes **visibles** et les métadonnées PWA. On **conserve** tous les identifiants de code (`OPSO_ADHERENTS`, `opsoNames`, classes `.opso-*`, préfixes de log `[OPSO]`) — invisibles, les toucher casserait 446 références. Les données propres au groupement (adhérents, ventes WML) sont **vidées** (globals conservés, tableaux vides) ; les données partagées Intégral (`../crm/*`, leclerc, pharmazon) restent intactes.

**Tech Stack :** Vanilla JS / HTML / CSS, PWA (manifest + service worker), Supabase (projet existant), Chart.js 4.4.4 (CDN), SheetJS. Aucun build, aucun npm. Vérification au navigateur via Playwright MCP + serveur statique local (pas de framework de test dans ce repo).

## Global Constraints

- **Zéro build / zéro npm** — tout doit fonctionner en ouvrant `index.html`. (ROBOT §2)
- **3 marques distinctes** — Essentiels = **bleu ≠ #0057FF** (bleu Intégral) et ≠ vert OPSO. Aucun résidu vert/OPSO **visible**. (ROBOT §10)
- **Conserver les identifiants de code** — ne renommer AUCUN identifiant JS (`OPSO_ADHERENTS`, `OPSO_LISTING_2026`, `opsoNames`, `OPSO_STATS_*`, `WML_*`), AUCUNE classe CSS (`.opso-*`), AUCUN préfixe de log (`[OPSO]`). Ne changer que ce qui est **affiché à l'écran** ou **visuel**.
- **Baseline** : « Le réflexe santé » (remplace « On prend soin de vous ! »).
- **Sous-titre** : « Essentiels Pharma · Pilotage groupement » (remplace « Normandie · … »).
- **Dossier / URL** : `/essentiels-pharma/` → `https://willmorel49-coder.github.io/jarvis-app/essentiels-pharma/`.
- **Données partagées Intégral conservées** ; **données groupement vidées** (pas de fuite de données OPSO sous l'URL Essentiels).
- **Design (ROBOT §11)** : avant de figer le bleu/typo, proposer des **variantes numérotées**, déployer, attendre le choix de Will.
- **Livraison (ROBOT §11)** : bump `?v=` partout + `sw.js` cache name/scope synchro ; vérif navigateur (mobile 390px) ; livrer avec l'URL prod cliquable.
- **Poids** : tout `*-data.js` > 500 Ko chargé en différé, jamais au boot (Safari de Will fige).
- **Git** : jamais `git add -A` — ajouter les fichiers précis. Commits `feat:`/`fix:`/`chore:`/`data:`/`ux:`. Push sur `main` = déploiement GitHub Pages (délai 1-2 min).

---

## File Structure

Nouveau dossier `/JARVIS/APP/essentiels-pharma/` (copie de `/opso/`). Rôle de chaque fichier :

| Fichier | Rôle | Action |
|---|---|---|
| `index.html` | Shell app, config Supabase, chargement scripts, login/topbar/sidebar | **Reskin** (titre, theme-color, SVG favicon/icônes, chaînes visibles, fonts, `?v=`) |
| `style.css` | Design system, palette de marque | **Reskin** (`:root` variables vertes → bleues + hex verts en dur ; classes conservées) |
| `app.js` | Toute la logique + templates | **Reskin chirurgical** (chaînes visibles listées ; identifiants conservés) |
| `manifest.json` | Métadonnées PWA | **Reskin** (name, colors, icônes SVG) |
| `sw.js` | Service worker (cache offline) | **Reskin** (cache name `opso-`→`essentiels-`, regex `/opso/`→`/essentiels-pharma/`, precache) |
| `opso-adherents.js` | Liste adhérents (groupement) | **Vider** — `window.OPSO_ADHERENTS=[]` (nom global conservé) |
| `opso-listing-2026.js` | Listing 2026 (groupement) | **Vider** — global conservé, tableau vide |
| `wml-data.js` | Commandes WML (groupement) | **Vider** — `WML_MONTHS/WML_DATA/WML_GLP1` vides |
| `wml-sales-data.js` | Lignes de ventes WML (groupement) | **Vider** — global conservé, tableau vide |
| `opso-stats-data.js` | Stats groupement | **Vider** — `OPSO_STATS_SALES/OPSO_STATS_META` vides |
| `leclerc-data.js` | Prix concurrent Leclerc (**partagé**) | **Conserver tel quel** |
| `pharmazon-data.js` | Prix Pharmazon (**partagé**) | **Conserver tel quel** |
| `offilog-live-data.js` | Offilog live (**partagé**) | **Conserver tel quel** |
| `../crm/*.js` | clients/benchmark/offilog/drakkars/cap3000/groupements (**partagés**) | **Non copiés** — chargés via chemin relatif `../crm/` (résout pareil depuis le nouveau dossier) |
| `_brand/variants.html` | Sélecteur de variantes bleu/typo | **Créer** (Task 2), supprimable ensuite |

Sous-dossiers `v2/`, `Opso santé/`, `STATISTIQUES/`, `_maq/` : **ne pas copier** en V1 (hors périmètre ; `v2/` et pilotage annexes non chargés par `index.html`).

---

## Task 1: Cloner le dossier, vider les données groupement, isoler le service worker

**Files:**
- Create: `essentiels-pharma/` (copie de `opso/` sans les sous-dossiers lourds hors périmètre)
- Modify: `essentiels-pharma/sw.js`
- Modify (vider) : `essentiels-pharma/opso-adherents.js`, `opso-listing-2026.js`, `wml-data.js`, `wml-sales-data.js`, `opso-stats-data.js`
- Verify: navigateur local

**Interfaces:**
- Produces : dossier `essentiels-pharma/` servable, avec globals data vides — `window.OPSO_ADHERENTS = []`, `window.OPSO_LISTING_2026 = []`, `window.WML_MONTHS = []`, `window.WML_DATA = []` (ou `{}` selon forme d'origine), `window.WML_GLP1 = []`, `window.WML_SALES = []`, `window.OPSO_STATS_SALES = []`, `window.OPSO_STATS_META = {}`. Les tâches suivantes consomment ce dossier.

- [ ] **Step 1 : Copier le dossier (sans sous-dossiers hors périmètre)**

```bash
cd "/Users/williammorel/JARVIS/APP"
mkdir -p essentiels-pharma
# Copier uniquement les fichiers à la racine de opso/ (pas les sous-dossiers)
find opso -maxdepth 1 -type f \( -name '*.js' -o -name '*.html' -o -name '*.css' -o -name '*.json' \) \
  -exec cp {} essentiels-pharma/ \;
ls essentiels-pharma/
```
Attendu : `index.html app.js style.css manifest.json sw.js opso-adherents.js opso-listing-2026.js opso-stats-data.js wml-data.js wml-sales-data.js leclerc-data.js pharmazon-data.js offilog-live-data.js`

- [ ] **Step 2 : Relever la forme exacte de chaque global data à vider**

Pour ne pas casser le typage attendu par `app.js`, ouvrir chaque fichier et noter si le global est un tableau `[...]` ou un objet `{...}` :

```bash
cd "/Users/williammorel/JARVIS/APP/essentiels-pharma"
for f in opso-adherents.js opso-listing-2026.js wml-data.js wml-sales-data.js opso-stats-data.js; do
  echo "=== $f"; grep -oE "window\.[A-Za-z0-9_]+ *= *[\[{]" "$f"
done
```
Attendu : liste des globals et leur ouverture (`[` = tableau, `{` = objet). Vider en respectant la forme.

- [ ] **Step 3 : Vider `opso-adherents.js`**

Remplacer tout le contenu par (conserver le NOM du global) :
```javascript
// Adhérents Essentiels Pharma — VIDE (en attente de la liste officielle)
// Nom de global conservé (OPSO_ADHERENTS) pour compat app.js — ne pas renommer.
window.OPSO_ADHERENTS = [];
```

- [ ] **Step 4 : Vider `opso-listing-2026.js`**

```javascript
// Listing Essentiels Pharma — VIDE (en attente des données groupement)
window.OPSO_LISTING_2026 = [];
```
> Si Step 2 révèle un autre nom de global (ex. `OPSO_LISTING`), utiliser exactement celui relevé.

- [ ] **Step 5 : Vider `wml-data.js`** (respecter la forme relevée au Step 2)

```javascript
// Commandes WML Essentiels Pharma — VIDE (en attente des ventes Intégral du groupement)
window.WML_MONTHS = [];
window.WML_DATA   = [];   // ⚠️ si Step 2 montre {  → mettre {}
window.WML_GLP1   = [];   // ⚠️ idem
```

- [ ] **Step 6 : Vider `wml-sales-data.js`**

Relever d'abord le nom du global (`grep -oE "window\.[A-Za-z0-9_]+ *=" wml-sales-data.js`), puis :
```javascript
// Ventes WML Essentiels Pharma — VIDE (en attente des fichiers de ventes du groupement)
window.WML_SALES = [];   // ⚠️ utiliser le nom exact relevé
```

- [ ] **Step 7 : Vider `opso-stats-data.js`**

```javascript
// Stats Essentiels Pharma — VIDE (en attente des données groupement)
window.OPSO_STATS_SALES = [];
window.OPSO_STATS_META  = {};
```

- [ ] **Step 8 : Isoler le service worker** (`sw.js`)

Trois remplacements exacts :
```
Ligne 4  : 'opso-v2-'                    →  'essentiels-v2-'
Lignes 18-20 (regex NETWORK_FIRST) : /\/opso\/  →  /\/essentiels-pharma\/
Ligne 35 : k.startsWith('opso-')         →  k.startsWith('essentiels-')
Ligne 80 : req.url.includes('/opso/')    →  req.url.includes('/essentiels-pharma/')
```
Vérifier : `grep -nE "opso" essentiels-pharma/sw.js` ne doit renvoyer que le commentaire d'en-tête (le reste = `essentiels`). Corriger l'en-tête ligne 1 (`Service Worker Essentiels Pharma`).

- [ ] **Step 9 : Lancer un serveur statique local et ouvrir l'app**

```bash
cd "/Users/williammorel/JARVIS/APP" && python3 -m http.server 8099 &
```
Ouvrir dans Playwright MCP : `http://localhost:8099/essentiels-pharma/index.html`

- [ ] **Step 10 : Vérifier au navigateur — écran de login s'affiche, zéro erreur console**

Via Playwright MCP : `browser_navigate` puis `browser_console_messages`.
Attendu : l'écran de login s'affiche (encore vert/OPSO — normal, reskin non commencé), **aucune erreur JS** (`TypeError`, `undefined is not…`) due aux données vides. Si une erreur apparaît (ex. `.length` sur undefined), noter le fichier/ligne — elle sera corrigée en Task 7 (états vides). Screenshot de contrôle.

- [ ] **Step 11 : Commit**

```bash
cd "/Users/williammorel/JARVIS/APP"
git add essentiels-pharma/
git commit -m "chore: clone opso -> essentiels-pharma, donnees groupement videes, SW isole"
```
> Ici `git add essentiels-pharma/` est un chemin précis (pas `-A`) — OK.

---

## Task 2: Variantes de marque (bleu + typo) — choix de Will

**Files:**
- Create: `essentiels-pharma/_brand/variants.html`

**Interfaces:**
- Produces : une page déployée montrant 3 palettes bleues × pairings typo. Sortie = **le numéro choisi par Will** (palette + typo), consommé par Tasks 3-6.

- [ ] **Step 1 : Créer la page de variantes**

Créer `essentiels-pharma/_brand/variants.html` : une page autonome affichant, côte à côte, 3 blocs « aperçu cockpit » (logo croix + titre « Essentiels Pharma » + baseline « Le réflexe santé » + un bouton + une carte KPI factice), chacun avec une palette et une typo. Palettes candidates (toutes **≠ #0057FF** Intégral et ≠ vert OPSO) :

```
Variante 1 — « Bleu santé profond »
  --primary #0072BC · --dark #005A96 · --pale #E6F2FA · --text #005A96 · --light #4DA8DA
Variante 2 — « Bleu marine institutionnel »
  --primary #14508C · --dark #0E3A66 · --pale #E8EFF6 · --text #14508C · --light #5B86B8
Variante 3 — « Bleu-teal réflexe santé »
  --primary #0E8FA8 · --dark #0A6E82 · --pale #E4F4F7 · --text #0A6E82 · --light #4FB8CC
```
Pairings typo (Google Fonts, « pro/santé ») à faire tester dans chaque bloc :
```
Typo A : Manrope (titres) + Inter (texte)
Typo B : Sora (titres) + Inter (texte)
Typo C : Plus Jakarta Sans (titres + texte)
```
Prévoir un petit sélecteur (radios) qui applique palette×typo sur un aperçu commun, pour que Will combine librement.

- [ ] **Step 2 : Vérifier la page localement**

Ouvrir `http://localhost:8099/essentiels-pharma/_brand/variants.html` dans Playwright MCP, screenshot desktop + mobile (390px). Vérifier lisibilité et contraste de chaque bleu sur blanc.

- [ ] **Step 3 : Déployer la page de variantes**

```bash
cd "/Users/williammorel/JARVIS/APP"
git add essentiels-pharma/_brand/variants.html
git commit -m "design: variantes bleu + typo Essentiels Pharma (choix)"
git push
```

- [ ] **Step 4 : Livrer le lien et ATTENDRE le choix de Will**

Donner l'URL : `https://willmorel49-coder.github.io/jarvis-app/essentiels-pharma/_brand/variants.html` et demander : « quel numéro de palette + quelle typo ? ». **Ne pas continuer** Tasks 3-6 avant sa réponse. Consigner le choix (ex. « Palette 1 + Typo A ») — c'est l'entrée des tâches suivantes.

---

## Task 3: Appliquer la palette choisie à `style.css`

**Files:**
- Modify: `essentiels-pharma/style.css`

**Interfaces:**
- Consumes : palette choisie en Task 2 (5 hex : primary/dark/pale/text/light).
- Produces : `style.css` sans aucun vert de marque visible.

- [ ] **Step 1 : Remplacer les variables `:root` vertes par les bleus choisis**

Dans le bloc `:root` (lignes ~18-100), remplacer les valeurs (garder les NOMS de variables) selon la table (exemple avec Palette 1 — adapter au choix réel) :
```
--opso-green:      #11a63c  →  #0072BC
--opso-green-dark: #0d8530  →  #005A96
--opso-green-pale: #e6f7ec  →  #E6F2FA
--opso-green-pale2:#f3fbf6  →  #F2F8FC
--opso-green-text: #0a7a2b  →  #005A96
--blue:            #11a63c  →  #0072BC   (⚠️ « --blue » vaut le vert ici : c'est un alias, le passer au bleu choisi)
--blue-l:          #4ade80  →  #4DA8DA
--blue-bg:         #e6f7ec  →  #E6F2FA
```
> `--opso-accent` lime `#dddf4b` (accent Normandie Pharma) : le remplacer par un accent neutre cohérent avec le bleu (ex. `#F2A900` ambre discret) ou le désactiver. Choisir un accent qui ne réintroduit pas de vert.

- [ ] **Step 2 : Remplacer les hex verts en dur (hors `:root`)**

Rechercher et remplacer chaque littéral vert restant :
```bash
cd "/Users/williammorel/JARVIS/APP/essentiels-pharma"
grep -niE "#11a63c|#0d8530|#064e20|#0a7a2b|#e6f7ec|#f3fbf6|#4ade80|17, ?166, ?60|17,166,60" style.css
```
Remplacer : `#11a63c`→primary, `#0d8530`→dark, `#064e20`→dark (ou plus foncé), `#0a7a2b`→text, `#e6f7ec`/`#f3fbf6`→pale, `#4ade80`→light, `rgba(17,166,60,x)`→`rgba(<R,G,B du primary>,x)`. (Pour #0072BC → `rgba(0,114,188,x)`.)

- [ ] **Step 3 : Vérifier qu'il ne reste aucun vert de marque**

```bash
grep -niE "#11a63c|#0d8530|#064e20|#0a7a2b|#4ade80|17,166,60|--opso-green" style.css
```
Attendu : plus aucune occurrence de valeur verte (les NOMS `--opso-green*` peuvent rester comme variables, mais leur VALEUR doit être bleue). Si `--opso-green` est conservé comme nom, sa valeur doit être le bleu.

- [ ] **Step 4 : Vérifier au navigateur**

Recharger `http://localhost:8099/essentiels-pharma/index.html` (Playwright), screenshot login + après login (compte démo). Confirmer : interface bleue, plus de vert. Console sans erreur.

- [ ] **Step 5 : Commit**

```bash
git add essentiels-pharma/style.css
git commit -m "ux: palette bleue Essentiels Pharma (style.css)"
```

---

## Task 4: Reskin `index.html` (visuel + chaînes + fonts + PWA)

**Files:**
- Modify: `essentiels-pharma/index.html`

**Interfaces:**
- Consumes : palette + typo choisies (Task 2).
- Produces : shell 100 % Essentiels (titre, meta, favicon, login, sidebar, topbar), fonts pro/santé chargées.

- [ ] **Step 1 : Titre, description, theme-color, fonts**

Remplacements exacts :
```
<title>OPSO Santé · Cockpit</title>            → <title>Essentiels Pharma · Cockpit</title>
meta description "OPSO Santé — Pilotage…"        → "Essentiels Pharma — Pilotage groupement"
meta theme-color "#11a63c"                       → "<primary choisi>"
```
Fonts : remplacer les `<link>` Varela Round + Nunito par les Google Fonts du pairing choisi (ex. Manrope + Inter), et mettre à jour `font-family` correspondants si déclarés inline.

- [ ] **Step 2 : SVG favicon + apple-touch-icon (fill vert → bleu)**

Dans les `<link rel="icon">` et `<link rel="apple-touch-icon">` (data:image/svg+xml inline, lignes ~11-12), remplacer `fill='%2311a63c'` → `fill='%23<primary hex sans #>'` (ex. `%230072BC`). Garder la forme croix.

- [ ] **Step 3 : Chaînes visibles login + sidebar + topbar**

Remplacements (chaînes **affichées** uniquement) :
```
"OPSO Santé"                       → "Essentiels Pharma"        (toutes occurrences visibles)
"Normandie · Pilotage groupement"  → "Essentiels Pharma · Pilotage groupement"
"Normandie · groupement"           → "Le réflexe santé"
"Normandie"                        → "Essentiels Pharma"        (dans les blocs d'affichage)
"On prend soin de vous&nbsp;!"     → "Le réflexe santé"
"On prend soin de vous"            → "Le réflexe santé"
```
> Le SVG `divider-arc` vert (login) hérite de la couleur via `stroke="#11a63c"` inline → passer au primary bleu.

- [ ] **Step 4 : Vérifier au navigateur**

Recharger la page. Screenshot login (mobile 390px) : logo bleu, « Essentiels Pharma », « Le réflexe santé », nouvelle typo. Aucune mention « OPSO »/« Normandie »/« On prend soin » visible. Console OK.

- [ ] **Step 5 : Commit**

```bash
git add essentiels-pharma/index.html
git commit -m "ux: reskin index.html Essentiels Pharma (marque, fonts, PWA icons)"
```

---

## Task 5: Reskin chirurgical des chaînes visibles de `app.js`

**Files:**
- Modify: `essentiels-pharma/app.js`

**Interfaces:**
- Consumes : palette choisie (pour les ~35 hex verts).
- Produces : app.js sans chaîne visible « OPSO/Normandie/On prend soin » ni vert de marque, **identifiants intacts**.

- [ ] **Step 1 : Remplacer les hex verts en dur**

```bash
cd "/Users/williammorel/JARVIS/APP/essentiels-pharma"
grep -noE "#11a63c|#0d8530|#064e20|#0a7a2b|#4ade80|rgba\(17, ?166, ?60" app.js | head -60
```
Remplacer chaque littéral par l'équivalent bleu (même mapping que Task 3 Step 2). Ce sont des couleurs de graphiques/inline styles.

- [ ] **Step 2 : Remplacer UNIQUEMENT les chaînes visibles** (liste exhaustive, laisser les identifiants)

Remplacer les libellés **affichés** ci-dessous. **NE PAS** toucher : `OPSO_ADHERENTS`, `OPSO_LISTING_2026`, `OPSO_STATS_*`, `opsoNames`, `opsoAllowed*`, `opsoCIPs*`, `[OPSO]` (logs console), `CATEGORIES:OPSO,` / `PRODID:…OPSO…` (calendrier ICS interne — voir Step 3).
```
'Bienvenue chez OPSO Santé 👋'              → 'Bienvenue chez Essentiels Pharma 👋'
' · OPSO Santé'                             → ' · Essentiels Pharma'
'>OPSO Santé</strong>'                      → '>Essentiels Pharma</strong>'
'Source : OPSO Santé'                       → 'Source : Essentiels Pharma'
'Installer OPSO Santé sur votre appareil'   → 'Installer Essentiels Pharma sur votre appareil'
'OPSO Santé installé !'                     → 'Essentiels Pharma installé !'
"pharmacie(s) OPSO achètent ce produit via le groupement" → "…Essentiels Pharma achètent…"
'Adhérent OPSO'                             → 'Adhérent Essentiels Pharma'
'Adhérents OPSO non actifs'                 → 'Adhérents Essentiels Pharma non actifs'
'Nb pharmacies OPSO achetant ce produit…'   → '…pharmacies Essentiels Pharma…'
`OPSO Santé (${…})` (label graphe)          → `Essentiels Pharma (${…})`
`WML OPSO (${…})` (label graphe)            → `WML Essentiels (${…})`
'} OPSO absente'                            → '} Essentiels Pharma absente'
'Normandie · '                             → 'Essentiels Pharma · '
'On prend soin de vous · OPSO Santé'        → 'Le réflexe santé · Essentiels Pharma'
'On prend soin de vous »' / 'On prend soin de vous' → 'Le réflexe santé'
```
Méthode : pour chaque ligne, un `grep -n "<chaîne>" app.js` puis une Edit ciblée (pas de sed global sur « OPSO »).

- [ ] **Step 3 : Métadonnées calendrier ICS (export visite)**

Les chaînes ICS `X-WR-CALNAME:OPSO Santé — Visites pharmacies` et `PRODID:-//OPSO Santé//…` sont exportées dans un fichier `.ics` que le pharmacien peut voir → les passer à « Essentiels Pharma ». En revanche `CATEGORIES:OPSO,Visite,` est une catégorie interne : la passer à `CATEGORIES:Essentiels,Visite,` (cohérence, faible risque).

- [ ] **Step 4 : Vérifier qu'aucun identifiant n'a été cassé**

```bash
grep -cE "OPSO_ADHERENTS|OPSO_LISTING_2026|opsoNames|OPSO_STATS_" app.js
node --check app.js 2>&1 | head   # vérifie la syntaxe JS (node dispo, pas d'exécution)
```
Attendu : les identifiants sont toujours présents (compte inchangé) ; `node --check` ne renvoie aucune erreur de syntaxe.

- [ ] **Step 5 : Vérifier au navigateur (parcours complet)**

Recharger, se connecter (compte démo), naviguer sur les 7 pages. Vérifier : aucune chaîne « OPSO »/« Normandie »/« On prend soin » **visible** ; graphiques en bleu ; console sans erreur. Screenshots.

- [ ] **Step 6 : Commit**

```bash
git add essentiels-pharma/app.js
git commit -m "ux: reskin chaines visibles + couleurs app.js Essentiels Pharma"
```

---

## Task 6: Reskin `manifest.json` (PWA)

**Files:**
- Modify: `essentiels-pharma/manifest.json`

**Interfaces:**
- Consumes : palette choisie.
- Produces : PWA Essentiels installable (nom, couleurs, icônes bleues).

- [ ] **Step 1 : Remplacer nom, description, couleurs, icônes**

```
"name":        "OPSO Santé — Pilotage groupement"  → "Essentiels Pharma — Pilotage groupement"
"short_name":  "OPSO Santé"                         → "Essentiels Pharma"
"description": "Pilotage du groupement … OPSO … Normandie" → "Pilotage du groupement Essentiels Pharma · Intégral Pharma"
"theme_color": "#11a63c"                            → "<primary choisi>"
icons[].src : dans les SVG data-URI, fill '%2311a63c' → '%23<primary hex>'
shortcuts : libellés OK (Cockpit, Prioritaires) — inchangés
```
(`background_color` `#f5f6f7` reste — gris neutre.)

- [ ] **Step 2 : Vérifier**

```bash
python3 -c "import json;json.load(open('essentiels-pharma/manifest.json'));print('JSON OK')"
grep -niE "opso|normandie|11a63c" essentiels-pharma/manifest.json
```
Attendu : `JSON OK`, aucune occurrence `opso/normandie/11a63c`.

- [ ] **Step 3 : Commit**

```bash
git add essentiels-pharma/manifest.json
git commit -m "chore: manifest PWA Essentiels Pharma"
```

---

## Task 7: États vides propres (données groupement absentes)

**Files:**
- Modify: `essentiels-pharma/app.js` (uniquement si des crashs/écrans cassés apparaissent)

**Interfaces:**
- Consumes : app reskinée (Tasks 3-6) avec globals data vides (Task 1).
- Produces : chaque page groupement affiche un état vide explicite, zéro crash.

- [ ] **Step 1 : Recenser les écrans qui dépendent des données groupement**

Se connecter (compte démo) et parcourir : Dashboard, Pharmacies, Ventes WML, Prioritaires (ceux qui lisent `OPSO_ADHERENTS`/`WML_*`/`OPSO_STATS_*`). Noter pour chacun : (a) crash console, (b) écran blanc, ou (c) déjà un état vide correct.

- [ ] **Step 2 : Pour chaque crash, ajouter un garde + message d'état vide**

Là où `app.js` fait `X.length`/`X.map` sur un global potentiellement vide sans garde, ajouter un court-circuit affichant un état vide. Motif à réutiliser (adapter au conteneur réel de la page) :
```javascript
if (!OPSO_ADHERENTS || !OPSO_ADHERENTS.length) {
  return '<div class="empty-state">'
       + '<div class="empty-state-title">Données en cours d\'intégration</div>'
       + '<div class="empty-state-sub">La liste des adhérents Essentiels Pharma et leurs ventes seront disponibles prochainement.</div>'
       + '</div>';
}
```
> `.empty-state*` existe déjà dans `style.css` (repéré aux lignes ~1594-1598) — réutiliser ces classes, ne pas en créer.

- [ ] **Step 3 : Vérifier chaque page au navigateur**

Reparcourir les 7 pages. Attendu : aucune erreur console ; les pages « groupement » montrent « Données en cours d'intégration » ; les pages « partagées » (Catalogue, Offilog) affichent les vraies données Intégral. Screenshots mobile 390px de chaque page.

- [ ] **Step 4 : Commit**

```bash
git add essentiels-pharma/app.js
git commit -m "ux: etats vides propres pour donnees groupement Essentiels Pharma"
```

---

## Task 8: Vérification finale, bump de version, déploiement prod

**Files:**
- Modify: `essentiels-pharma/index.html` (tokens `?v=`), `essentiels-pharma/sw.js` (déjà versionné par date)

**Interfaces:**
- Consumes : app complète (Tasks 1-7).
- Produces : app en ligne et vérifiée sur l'URL prod.

- [ ] **Step 1 : Bumper les tokens `?v=` dans `index.html`**

Passer tous les `?v=YYYYMMDDx` des `<script src>`/`<link href>` locaux à un nouveau token daté commun (ex. `?v=20260717a`). Vérifier : `grep -oE "\?v=[0-9a-z]+" essentiels-pharma/index.html | sort -u` → un seul token.

- [ ] **Step 2 : Contrôle anti-résidu OPSO (visible)**

```bash
cd "/Users/williammorel/JARVIS/APP/essentiels-pharma"
grep -rniE "OPSO Santé|Normandie|On prend soin|#11a63c" index.html style.css app.js manifest.json | grep -vE "OPSO_ADHERENTS|OPSO_LISTING|OPSO_STATS|opsoNames|\[OPSO\]"
```
Attendu : **aucune ligne**. Toute occurrence restante = chaîne visible oubliée → corriger.

- [ ] **Step 3 : Vérification navigateur complète (local)**

Login + 7 pages, mobile 390px + desktop, `browser_console_messages` vide d'erreurs. PWA : vérifier que `manifest.json` et `sw.js` se chargent (onglet réseau) sans 404.

- [ ] **Step 4 : Déployer en prod**

```bash
cd "/Users/williammorel/JARVIS/APP"
git add essentiels-pharma/index.html essentiels-pharma/sw.js
git commit -m "chore: bump version + deploy Essentiels Pharma v1"
git push
```

- [ ] **Step 5 : Attendre la mise en ligne réelle puis vérifier la prod**

Poller l'URL jusqu'à voir le nouveau token servi (ou `bash scripts/attendre-prod.sh 20260717a` s'il existe) :
```bash
for i in $(seq 1 20); do
  curl -s "https://willmorel49-coder.github.io/jarvis-app/essentiels-pharma/index.html" | grep -q "20260717a" && echo "EN LIGNE" && break
  sleep 15
done
```
Puis ouvrir `https://willmorel49-coder.github.io/jarvis-app/essentiels-pharma/` dans Playwright, screenshot mobile de la page de login. Confirmer marque bleue + « Le réflexe santé ».

- [ ] **Step 6 : Supprimer la page de variantes (optionnel) et livrer**

Une fois la marque figée, supprimer `_brand/variants.html` si Will le souhaite :
```bash
git rm essentiels-pharma/_brand/variants.html && git commit -m "chore: retrait page variantes" && git push
```
Livrer le message final avec l'**URL prod cliquable** et la liste des screenshots.

---

## Notes de mémoire (à écrire en fin d'implémentation)

- Créer une mémoire projet « App Essentiels Pharma » (ex-Le Gall) : dossier `/JARVIS/APP/essentiels-pharma/`, URL prod, bleu choisi (hex), baseline « Le réflexe santé », données groupement VIDES en attente, identifiants de code `OPSO_*` conservés volontairement.
- Mettre à jour `project_jarvis_two_brands.md` → **trois** marques distinctes (Intégral bleu #0057FF / OPSO vert #11a63c / Essentiels bleu <hex>).

---

## Self-Review

**Couverture spec :** §3 emplacement → Task 1 ; §4 identité/reskin → Tasks 2-6 ; §5 pages → conservées (Task 1 copie) ; §6.1 données partagées conservées → Task 1 (non copiées, chemin `../crm/`) ; §6.2 données groupement vidées + états vides → Tasks 1 & 7 ; §7 login Supabase → conservé tel quel (config Supabase copiée en Task 1, non modifiée) ; §8 livraison → Task 8 ; §10 critères de succès → Task 8 (contrôle anti-résidu, 7 pages, PWA, prod).

**Placeholders :** palettes/typo/chaînes/hex sont donnés en valeurs concrètes ; le seul « choix ouvert » (bleu final) est résolu par le mécanisme de variantes (Task 2), pas par un TBD.

**Cohérence des noms :** globals conservés à l'identique (`OPSO_ADHERENTS`, `OPSO_LISTING_2026`, `WML_*`, `OPSO_STATS_*`) ; classes `.opso-*` et `.empty-state*` réutilisées ; aucun renommage d'identifiant introduit.

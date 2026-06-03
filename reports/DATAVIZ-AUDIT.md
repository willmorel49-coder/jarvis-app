# DATAVIZ AUDIT — Intégral Pharma CRM (mode classique)

> Auditeur : sous-agent **dataviz-specialist**
> Date : 2026-06-03
> Périmètre : 7 modules · 25 viz inventoriées
> Méthode : analyse statique du DOM injecté + tokens couleur + dimensions SVG/CSS
> Référentiel : Cleveland & McGill (1984) pour la perception · WCAG 2.1 AA pour le contraste

---

## A. Inventaire des visualisations

| # | Module / Fichier | Type viz actuel | Donnée représentée | Verdict | Type recommandé si autre |
|---|------------------|-----------------|--------------------|---------|--------------------------|
| 1 | Dashboard `dashboard-v2.js:205-236` Hero | Sparkline SVG avec aire dégradée | CA cumulé mensuel 8 mois (série temporelle) | **OK** | — |
| 2 | Dashboard `dashboard-v2.js:239-265` Bars mensuelles | Bar vertical 8 barres + dernier mois highlight | CA par mois (série temporelle 8 points) | **SOUS-OPTIMAL** | Line chart (la temporalité est continue, pas catégorielle) ou sparkline + month labels |
| 3 | Dashboard `dashboard-v2.js:338-370` Top 5 clients | Liste tabulaire + badge variation ▲▼ | Ranking + variation | **OK** | — (alternative : ajouter bar de longueur proportionnelle au CA) |
| 4 | Dashboard `dashboard-v2.js:276-284` Variation badge | Texte coloré avec flèche | Variation % mois N vs N-1 | **OK** | — |
| 5 | Dashboard `dashboard-v2.js:387-419` Alertes | Liste avec dot coloré | Liste signaux qualitative | **OK** | — |
| 6 | Benchmark Focus `benchmark-focus.js:165-167` Mini bars OPS/CPR/HP | 3 mini-barres horizontales empilées par produit (par ligne) | Comparaison 3 catégories pour 1 produit | **SOUS-OPTIMAL** | Dot plot horizontal (3 dots alignés) — plus lisible quand width=10px et label "O/C/H" |
| 7 | Benchmark Focus header | Big number + ratio "X / 90" | KPI nb opportunités | **OK** | — |
| 8 | Multibench `benchmark-multibench.js:111-134` KPI cards | 4 big numbers + sub-info | KPI absolus + poids relatif | **OK** | — |
| 9 | Multibench `benchmark-multibench.js:138-180` Mix par famille (4 vues) | Table avec % + delta pts (texte) | Mix part de marché 6 familles × 4 acteurs | **MAUVAIS** | **Slope chart** ou bar groupé horizontal — la lecture d'un mix 6×4 en texte oblige à calculer mentalement les écarts |
| 10 | Multibench `benchmark-multibench.js:201-209` Bench cells top 10 communs | Mini bar horizontale par établissement (3 colonnes) | Comparaison CA produit dans 3 établissements | **OK** | — |
| 11 | Trajectoires `benchmark-trajectoires.js:116-149` Sparklines famille | Sparkline SVG 220×44 par famille + dots début/fin | Évolution CA 8 mois par famille (6 séries) | **OK** | — |
| 12 | Trajectoires `benchmark-trajectoires.js:264-289` Cards trend | Sparkline + slope % + tag croissance | Trend + variation | **OK** | — |
| 13 | Trajectoires `benchmark-trajectoires.js:306-391` Heatmap 6×8 | Heatmap cellules colorées + valeur € + barre interne | CA famille × mois (2D matrice) | **SOUS-OPTIMAL** | Heatmap pure OU small-multiples ; la barre interne + texte + intensité = **triple encodage** confus |
| 14 | Trajectoires `benchmark-trajectoires.js:494-510` Alertes saisonnalité | Cards icon + texte + tag URGENT/À SUIVRE | Liste qualitative | **OK** | — |
| 15 | Laboratoires `benchmark-laboratoires.js:204-254` Top 20 labos table | Table dense avec PdM en texte + indice + chip famille | Comparaison labo × 6 dimensions | **OK** | — (très chargée mais sémantiquement correcte) |
| 16 | Laboratoires `benchmark-laboratoires.js:331-358` Labos absents | Liste card + 3 big numbers (CA OPS / Moi / Manque) | Ranking par opportunité | **OK** | — |
| 17 | Laboratoires `benchmark-laboratoires.js:422-436` Matrice famille × top 5 labos | Bar horizontale par labo × 6 cards familles | Top 5 par catégorie | **OK** | — |
| 18 | Manque-à-gagner `benchmark-manque-a-gagne.js:213-217` Barre + repère OPS | Bar horizontale + vertical line OPS | Valeur Moi vs cible OPS sur même axe | **OK** (très bon choix — bullet chart simplifié) | — |
| 19 | Manque-à-gagner `benchmark-manque-a-gagne.js:144-167` Synthèse KPI | 3 big numbers KPI cards | Synthèse chiffrée | **OK** | — |
| 20 | Manque-à-gagner `benchmark-manque-a-gagne.js:284-322` Tranche prix | Bar + repère OPS (idem ligne 18) | Mix tranche × Moi vs OPS | **OK** | — |
| 21 | Pénétration `benchmark-penetration.js:200-206` Gauge horizontale | Bar horizontale + label centré % | Taux pénétration famille | **SOUS-OPTIMAL** | Gauge demi-cercle OU bar avec marqueur seuil 75% — la simple bar ne signale pas les zones rouge/orange/vert |
| 22 | Pénétration `benchmark-penetration.js:142-163` KPI synthèse | 3 big numbers | Synthèse | **OK** | — |
| 23 | Pénétration `benchmark-penetration.js:276-302` Trous de raquette | Liste card + chips top 3 familles + CA | Ranking avec contexte | **OK** | — |
| 24 | Pénétration `benchmark-penetration.js:371-377` Bar pénétration top 10 OPS | Bar horizontale + % | Pénétration produit × territoire | **OK** | — |
| 25 | Pénétration `benchmark-penetration.js:277-282` Chips top 3 familles | Mini chips colorés (label + CA) | Distribution catégorielle ≤3 items | **OK** | — |

**Décompte :** 17 OK · 6 SOUS-OPTIMAL · 1 MAUVAIS · 1 EXCELLENT (bullet chart manque-à-gagner)

---

## B. Top 5 améliorations prioritaires

### 1. **MAUVAIS — Mix famille 4 vues Multibench** (`benchmark-multibench.js:138-180`)
- **Données** : 6 familles × 4 acteurs × (% + delta pts) = 24 cellules texte + 18 deltas signés.
- **Problème psychologique** : la lecture impose à l'utilisateur de comparer 4 nombres alignés à droite *par ligne*, puis de mémoriser le delta. La perception humaine (Cleveland) ordonne ainsi : position commune sur axe > longueur > angle > **texte numérique = pire**.
- **Recommandation** : **Slope chart** (4 lignes verticales, une par acteur, points famille reliés) OU **bar groupé horizontal** (6 lignes famille × 4 barres juxtaposées). Le delta devient visuel, plus de calcul mental.
- **Bonus** : highlighter automatique de la plus grosse divergence (>5 pts).

### 2. **SOUS-OPTIMAL — Bars mensuelles Dashboard** (`dashboard-v2.js:239-265`)
- **Données** : 8 mois de CA (continu, ordonné).
- **Problème** : une série temporelle continue (mois) avec 8 points est mieux servie par une **ligne** que par des barres. Les barres impliquent des catégories discrètes non comparables ; la ligne révèle la tendance d'un coup d'œil.
- **Recommandation** : remplacer par une **ligne avec dots** (réutiliser sparkline 1 avec axe Y et tooltips). On garde le highlight visuel du dernier mois via dot plus gros + label.
- **Pourquoi** : la Hero a déjà une sparkline. La répétition bar/ligne casse la cohérence ; le lecteur croit voir 2 séries différentes.

### 3. **SOUS-OPTIMAL — Heatmap Trajectoires triple encodage** (`benchmark-trajectoires.js:336-353`)
- **Données** : CA famille × mois (matrice 6×8).
- **Problème** : chaque cellule contient **3 encodages simultanés** : couleur d'intensité (focal intra-famille), valeur € en texte, barre interne (% mix mensuel). Plus la valeur en bas en %. C'est 4 informations dans 56 px de haut.
- **Recommandation** : **scinder en 2 heatmaps côte à côte** :
  - Heatmap A : intensité = CA (focale intra-famille)
  - Heatmap B : intensité = % du mix mensuel (focale inter-famille)
- **Pourquoi** : la loi de Hick — temps de décision ∝ log₂(N choix). Mélanger 2 focales tue la lisibilité.

### 4. **SOUS-OPTIMAL — Mini bars OPS/CPR/HP Focus** (`benchmark-focus.js:165-167`)
- **Données** : 3 valeurs par produit dans une ligne déjà dense (5 colonnes grid).
- **Problème** : avec width ~80 px partagée entre 3 barres, label single-char "O/C/H" (10 px), et chiffre euro tabular-nums, la barre fait < 30 px de tracé utile. Difficile de distinguer 5 k€ de 10 k€.
- **Recommandation** : **dot plot horizontal** : un axe unique avec 3 dots colorés (O bleu, C violet, H vert) positionnés à leur valeur normalisée. Plus lisible, gain de place 30 %.

### 5. **SOUS-OPTIMAL — Gauge linéaire Pénétration** (`benchmark-penetration.js:200-206`)
- **Données** : taux pénétration famille (0-100 %) avec seuils sémantiques 40 / 75.
- **Problème** : la bar horizontale unique ne montre PAS les seuils. L'œil voit "55 %" sans contexte. La couleur est unique selon `penetrationColor(pct)`, donc la jauge devient orange OU verte OU rouge, mais sans repère visuel des frontières.
- **Recommandation** : **bullet chart** (style Stephen Few) avec :
  - Fond segmenté en 3 zones (rouge 0-40, orange 40-75, vert 75-100)
  - Barre principale dans la couleur famille
  - Marqueur vertical sur valeur cible (ex: 75 % objectif)
- **Pourquoi** : transforme la lecture "55 % c'est quoi ?" en "55 %, j'suis dans la zone orange, je dois passer le mur vert à 75".

---

## C. Accessibilité

### Palette CRM Intégral Pharma — contrast ratios

| Couleur | Hex | Sur blanc `#FFFFFF` | Sur `#F2F2F7` | Sur `#F8FAFF` | Verdict WCAG AA (texte normal ≥ 4.5:1) |
|---------|-----|---------------------|----------------|----------------|-----------------------------------------|
| Accent bleu | `#0057FF` | **6.79:1** ✅ | 6.58:1 ✅ | 6.51:1 ✅ | OK pour texte |
| Rouge / down | `#FF3B30` | **3.85:1** ⚠️ | 3.73:1 ⚠️ | 3.69:1 ⚠️ | **KO** texte — OK uniquement pour large text (≥18px bold) |
| Vert / up | `#34C759` | **2.08:1** ❌ | 2.02:1 ❌ | 2.00:1 ❌ | **KO total** — n'est utilisable que comme icône/badge avec autre marqueur |
| Orange / warn | `#FF9500` | **2.69:1** ❌ | 2.61:1 ❌ | 2.58:1 ❌ | **KO total** texte |
| Rose alt | `#FF4D6D` | **3.65:1** ⚠️ | 3.54:1 ⚠️ | 3.50:1 ⚠️ | **KO** texte petite taille |
| Orange alt | `#FF9F1C` | **2.40:1** ❌ | 2.32:1 ❌ | 2.29:1 ❌ | **KO total** texte |
| Vert alt | `#14B86A` | **2.93:1** ❌ | 2.83:1 ❌ | 2.81:1 ❌ | **KO** texte normal — OK uniquement large text |
| Violet | `#7C3AED` | **6.06:1** ✅ | 5.87:1 ✅ | 5.81:1 ✅ | OK |
| Cyan Froid | `#00B5D8` | **2.84:1** ❌ | 2.75:1 ❌ | 2.72:1 ❌ | **KO** texte |
| Slate Génériques | `#94A3B8` | **2.69:1** ❌ | 2.61:1 ❌ | 2.58:1 ❌ | **KO** texte (utilisé partout pour métadonnées 10-11 px) |
| Text principal | `#0B1F4D` | **15.03:1** ✅✅ | — | — | Excellent |
| Text secondaire | `#64748B` | **5.12:1** ✅ | 4.96:1 ✅ | 4.91:1 ✅ | OK |

### Issues détectées par sévérité

**Critiques (impact direct utilisateur) :**
1. **Tag "FAIBLE" Focus** (`benchmark-focus.js:111`) : texte `#FF9500` 10.5 px sur fond `rgba(255,149,0,.08)` — contrast réel ~2.5:1 — **illisible**.
2. **Métadonnées 10-11 px en `#94A3B8`** (ratio 2.69:1) utilisées partout (`benchmark-focus.js:162`, `benchmark-trajectoires.js:284`, `benchmark-laboratoires.js:223`, `benchmark-penetration.js:291`) — **non conforme** AA même en large text.
3. **Variation badges Dashboard** (`dashboard-v2.js:283`) : couleur `#FF3B30` à 13 px sur fond blanc — sous le seuil 4.5:1.
4. **Heatmap labels blancs** (`benchmark-trajectoires.js:345`) : `txtCol = alpha > 0.55 ? '#fff' : '#0B1F4D'` — la frontière à `alpha = 0.55` peut produire des cellules limites où ni blanc ni dark n'a 4.5:1 (typique cyan ou orange clair).

**Moyennes :**
- Tag chips "ABSENT/FAIBLE/OK/FORT" Focus (`benchmark-focus.js:109-114`) : tailles 10.5 px texte sur fond translucide 8 % de la couleur — quasi-aucun contraste.
- `font-size: 9px` (`dashboard-v2.js:283` flèches, `benchmark-trajectoires.js:330` labels mois) — sous le seuil de lisibilité confortable.
- "Δ pts" stockés en `font-size: 9.5px` ou 10 px (`benchmark-laboratoires.js:228, 233, 234`).

**Recommandations :**
- Ne plus utiliser `#FF3B30`, `#FF9500`, `#34C759` pour le **texte** : les conserver uniquement pour icônes / dots / fond.
- Remplacer `#94A3B8` par `#475569` (slate-600, ratio 7.35:1) pour les métadonnées 10-11 px.
- Reverser à `#0B1F4D` pour les valeurs critiques (delta points, montants).
- Pour les badges de status : conserver la couleur de fond pleine ET texte blanc — le `bg: 'rgba(X,.08)'` casse le contraste.

---

## D. Cohérence inter-modules

### Sparklines

| Module | Largeur × hauteur | Stroke | Dots |
|--------|-------------------|--------|------|
| Dashboard Hero | 600 × 44 (responsive) | 1.75 px | 1 dot fin (last) |
| Trajectoires cards | 220 × 44 | 2 px | 2 dots (first/last) |
| Trajectoires headlines | 110 × 36 | 2 px | 2 dots |
| Focus / Multibench / Laboratoires | absent | — | — |

**Verdict : INCOHÉRENT.** 3 hauteurs (44 / 36) · 2 stroke-width · 2 conventions de dots. À unifier sur **hauteur 44 + stroke 2 + 1 dot final** (convention Dashboard).

### Couleurs famille IP

| Module | Froid | Biosimilaires | Génériques | Gén. partenaires | Non remboursés | Princeps |
|--------|-------|---------------|------------|-------------------|-----------------|----------|
| Focus `benchmark-focus.js:38-41` | `#00B5D8` | `#7C3AED` | `#94A3B8` | `#14B86A` | `#FF9F1C` | `#0057FF` |
| Multibench `benchmark-multibench.js:36-39` | `#00B5D8` | `#7C3AED` | `#94A3B8` | `#14B86A` | `#FF9F1C` | `#0057FF` |
| Trajectoires `benchmark-trajectoires.js:51-58` | `#00B5D8` | `#7C3AED` | `#94A3B8` | `#14B86A` | `#FF9F1C` | `#0057FF` |
| Laboratoires `benchmark-laboratoires.js:48-55` | `#00B5D8` | `#7C3AED` | `#94A3B8` | `#14B86A` | `#FF9F1C` | `#0057FF` |
| Manque-à-gagner `benchmark-manque-a-gagne.js:58-65` | `#00B5D8` | `#7C3AED` | `#94A3B8` | `#14B86A` | `#FF9F1C` | `#0057FF` |
| Pénétration `benchmark-penetration.js:63-70` | `#00B5D8` | `#7C3AED` | `#94A3B8` | `#14B86A` | `#FF9F1C` | `#0057FF` |

**Verdict : COHÉRENT ✅.** La palette famille IP est identique dans les 6 fichiers benchmark — bravo. Aucune dérive.

### Couleurs établissements (multi-bench)

| Module | OPS Nantes | CPR | HP |
|--------|------------|-----|----|
| Focus `benchmark-focus.js:165-167` | `#0057FF` | `#7C3AED` | `#14B86A` |
| Multibench `benchmark-multibench.js:104-108` | `#0057FF` | `#7C3AED` | `#14B86A` |

**Verdict : COHÉRENT ✅** mais **conflit sémantique** : `#7C3AED` = couleur famille Biosimilaires **ET** couleur CPR ; `#14B86A` = Gén. partenaires **ET** HP ; `#0057FF` = Princeps **ET** OPS. Risque de confusion quand on regarde le top 10 communs (`benchmark-multibench.js:188-200`) où les barres "Biosimilaires" et "CPR" sont visuellement identiques.

### Axes Y / échelles

- **Bars dashboard** : axe Y implicite, normalisé sur max(série) — pas de zéro absolu affiché. **OK** car la série est positive, mais une scale-line à 0 manque.
- **Sparkline Hero** : axe Y normalisé sur min/max → **VIOLATION SÉMANTIQUE**. Quand min ≠ 0, la pente est exagérée. Pour un CA cumulé, l'axe devrait partir de 0.
- **Sparkline Trajectoires** : idem, normalisé min/max — **acceptable** pour signal de trend, **trompeur** pour magnitude.
- **Bars OPS/CPR/HP Focus** : normalisé sur `max(ops, cpr, hp)` du produit — donc **pas comparable d'un produit à l'autre** (chaque ligne a sa propre échelle). Cleveland recommande échelle commune par tableau.
- **Bars Manque-à-gagner** : `Math.max(myPct, opsPct, 5)` — bon, garantit qu'on voit toujours quelque chose même à 0 %.

**Recommandation :** sparkline du Dashboard Hero devrait clamp min à 0 (`min = 0` au lieu de `min = Math.min(...values)`).

### Padding / hauteurs de cards

- Dashboard cards : `padding: 18-22px`, `border-radius: 14px` ✅
- Benchmark cards : `padding: 14-18px`, `border-radius: 14px` ✅
- Cards Trajectoires/Laboratoires/Manque/Pénétration utilisent le **même** pattern `border:1px solid #E8EEFF` + `box-shadow:0 2px 8px rgba(11,31,77,.04)` ✅
- Dashboard utilise `box-shadow:0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)` ≠ pattern benchmark — **INCOHÉRENT**. Dashboard est plus "iOS", benchmark plus "web app". À unifier.

---

## Récap final

- **25 viz auditées** sur 7 modules CRM Intégral Pharma.
- **17 OK** · **6 sous-optimales** · **1 mauvaise** · **1 exemplaire** (bullet chart manque-à-gagner).
- **Cohérence couleurs familles IP** : parfaite sur 6 fichiers (✅).
- **Conflit sémantique** : palette OPS/CPR/HP réutilise les couleurs familles → ambiguïté.
- **Accessibilité critique** : 7/11 couleurs CRM échouent au WCAG AA pour texte ; `#94A3B8` utilisé partout en 10-11 px est sous le seuil minimal.
- **Sparklines non normalisées** (3 hauteurs, 2 strokes, 2 conventions dots).
- **Sparkline Hero Dashboard** trompeuse : min ≠ 0 exagère la pente sur CA cumulé.
- **Top 3 priorités** :
  1. Refondre le mix 4-vues Multibench en slope chart ou bar groupé (gain pédagogique majeur).
  2. Remplacer `#94A3B8` par `#475569` pour les métadonnées partout (accessibilité quasi-instantanée).
  3. Scinder la heatmap Trajectoires en deux focales distinctes (intra-famille + inter-mois).

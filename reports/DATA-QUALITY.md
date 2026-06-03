# DATA-QUALITY — Audit des formules cavalry benchmark

> Auditeur : `data-quality-validator` (sous-agent Intégral Pharma)
> Date : 2026-06-03
> Périmètre : 6 modules `crm/benchmark-*.js`
> Rappel : Will = commercial pharma terrain. Zéro chiffre faux chez Vincent.

---

## Légende verdicts

- **OK** : formule mathématiquement et sémantiquement correcte, edge cases gérés acceptablement.
- **DOUTE** : la formule fait ce qu'elle dit mais une de ses inputs / hypothèses est suspecte ou floue.
- **FAUX** : erreur réelle, sur ou sous-estime un chiffre montré à un pharmacien.

---

## Préambule — données partagées

| Variable | Source | Convention clé |
|---|---|---|
| `SALES_TOTAL`, `SALES_BY_FAMILLE`, `SALES_BY_TRANCHE`, `SALES_BY_LABO`, `SALES_BY_PRODUCT`, `SALES_BY_MONTH`, `SALES_BY_FAMILLE_MONTHLY` | `crm/sales-detail.js` | Période 2025-10-15 → 2026-05-31 · 1 218 655 € CA · 48 pharmas actives · 11 972 lignes |
| `STOCK` | `crm/stock.js` | **`STOCK[code].marque` contient l'AFM code** ("REMBSS", "MED010", "DM_20"…), *pas* le nom du labo. Pièce critique : ce champ est passé en 2e argument à `familleFromAttrs(nature, afmcode, sousfamille)`. |
| `OPS_AGGREGATE`, `CPR_AGGREGATE`, `HP_AGGREGATE`, `OPS_TOTAL`, `OPS_BY_LABO` | `crm/establishments-aggregate.js` | OPS Nantes : 5 113 produits · 8 632 706 € CA · 234 labos. Ici `afmcode` est dans le champ `afmcode`, et `marque` contient "REFERENCEMENT" ou "". |
| `CLIENT_PRODUCTS` | `crm/client-products.js` | Map CIP → tableau `{artcode, designation, qte, ca}` |
| `CLIENTS` | `crm/clients-data.js` | 517 pharmas territoire (CIP, nom, ville, potentielGx…) |

**Composant central répliqué dans 5 des 6 modules :**
```js
function familleFromAttrs(nature, afmcode, sousfamille) {
  var n = (nature || '').trim();
  var a = (afmcode || '').trim().toUpperCase();
  var sf = (sousfamille || '').toLowerCase();
  if (n === 'Biosimilaire') return 'Biosimilaires';
  if (sf.indexOf('froid') >= 0) return 'Froid';
  if (a && a !== 'REMBSS' && a !== '#N/A') return 'Non remboursés';
  if (n === 'Generique Partenaire') return 'Gén. partenaires';
  if (n === 'Generique') return 'Génériques';
  return 'Princeps';
}
```
Cette fonction est ré-implémentée 5 fois à l'identique (multibench, focus, manque-a-gagne, penetration). **Cohérence inter-modules : OK** (audit ligne par ligne effectué).
*Sémantique commerciale validée :* l'ordre des conditions impose Biosimilaire > Froid > Non remboursés (afmcode hors REMBSS) > Gén. partenaires > Génériques > Princeps. Un médicament Froid Biosimilaire sera classé en Biosimilaires (correct : nature prime).

---

## SECTION A — Inventaire des formules

### A.1 · `crm/benchmark-multibench.js`

| Fonction · ligne | Formule | Sémantique commerciale | Verdict |
|---|---|---|---|
| `computeMixByFamille` L43-54 | Σ `p.ca` par famille (basée sur famille via `familleFromAttrs`) | Mix CA famille pour 1 établissement (OPS/CPR/HP) | OK |
| `getMixWill` L63-73 | Σ `SALES_BY_FAMILLE[f].ca` | Mix CA famille Will | OK |
| `poidsWill` L124 | `myTotal / T.ca * 100` | "Mon poids" = ma part dans le CA établissement (si on imaginait que mes ventes étaient chez OPS) | DOUTE sémantique — voir B.1 |
| `pct` mix famille L150 | `mix.fams[fam] / mix.total * 100` | % famille dans CA établissement | OK |
| `delta` L151 | `willPct - pct` | Écart pts entre mon mix et celui de l'établissement | OK |
| `getTop5CommonProducts` L76-93 | Intersection des `Object.keys` des 3 OPS/CPR/HP, somme `ca`, tri desc, slice 10 | Top 10 produits *qui se vendent dans les 3 établissements simultanément* | OK |
| `benchCellWithBar` L201-208 | `value / max * 100` (max = max(ops,cpr,hp,1)) | Barre proportionnelle au max des 3 | OK (le `,1` empêche div/0) |

### A.2 · `crm/benchmark-focus.js`

| Fonction · ligne | Formule | Sémantique | Verdict |
|---|---|---|---|
| `getMyCaByArtcode` L46-59 | Σ `p.ca` par artcode sur tous CIP de `CLIENT_PRODUCTS` | Mon CA total par produit (tous CIP confondus) | OK |
| `getIpNationalByFamille` `add()` L70-89 | Fusion sources OPS+CPR+HP : `existing.ca += ca`, `existing.qte += p.qte` | CA additionné des 3 IP par produit. **Hypothèse forte** : les 3 sources ne se recouvrent pas en double-comptage (chaque ligne est bien spécifique à un établissement). | OK *si* l'hypothèse tient (à confirmer auprès du pipeline `generate_establishments.py`) |
| `byEst[key] += ca` L87 | Ventilation CA par établissement | Répartition par origine | OK |
| `statusFromPdm` L109-114 | Seuils : `<1%` FAIBLE, `<10%` OK, `>=10%` FORT | Classement PdM | OK |
| `pdm` L131, L141, L209 | `myCa / p.ca * 100` | PdM Will = mon CA produit / CA IP National produit ×100 | OK (div/0 protégée par `p.ca > 0`) |
| `topPct` L124 | `topFamCa / totalFamCa * 100` | Concentration du top 15 sur famille | OK |
| `nbOpp` L210 | `mca === 0 || pdm < 1` | Compte ABSENT+FAIBLE sur top 15 × 6 familles | OK |

### A.3 · `crm/benchmark-manque-a-gagne.js`

| Fonction · ligne | Formule | Sémantique | Verdict |
|---|---|---|---|
| `trancheFromPrix` L50-54 | `prix <= 4.33` → petit · `<= 468` → inter · `> 468` → haut | Découpage IP (régime de remise) | OK (seuils business validés par les libellés remise) |
| Prix unitaire OPS L105 | `ca / qte` | Prix unitaire moyen produit OPS | DOUTE — voir C |
| `buildOpsAggregates.fams[fam].ca += ca` L98-101 | Σ CA produits par famille OPS | Mix CA famille OPS | OK |
| `buildOpsAggregates.tranches[tr].ca += ca` L104-109 | Σ CA produits OPS par tranche prix | Mix CA tranche OPS | OK (skip si `qte<=0 || ca<=0`) |
| `myPct` famille L378 | `myCa / myTotal * 100` | % mon mix famille | OK |
| `opsPct` famille L379 | `opsCa / opsTotal * 100` | % mix OPS famille | OK |
| `deltaPts` L380 | `myPct - opsPct` | Écart points de mix | OK |
| `cibleCa` L382 | `(opsPct/100) * myTotal` | CA cible si j'avais le mix OPS | OK |
| `gap` L384 | `cibleCa - myCa` | Manque à gagner (`>0` = manque, `<0` = sur-perf) | OK |
| `indiceCouv` L388 | `min(100, myRefs/opsRefs * 100)` | Indice de couverture produits | DOUTE — voir B.2 |
| `totalManque` L421 | Σ `max(0, r.gap)` sur les 6 familles | Somme des sous-indexations chiffrées | OK conceptuellement, mais voir D pour cohérence avec module Laboratoires |

### A.4 · `crm/benchmark-penetration.js`

| Fonction · ligne | Formule | Sémantique | Verdict |
|---|---|---|---|
| `famOfArtcode` L55-59 | `familleFromAttrs(stk.nature, stk.marque, stk.sousfamille)` | Famille IP via STOCK | OK (STOCK.marque = afmcode, confirmé) |
| `indexClientPurchases.byCip` L98-127 | Cumul CA × CIP × famille, set d'artcodes | Achats indexés par pharmacie | OK |
| Skip `ca <= 0` L114 | `if (ca <= 0) continue;` | **Ignore les avoirs** (CA négatif) | DOUTE — voir C (impact sur "active" et CA cumulé) |
| `nbActives` L424-425 | `Object.keys(byCip).length` | Pharmas avec ≥1 ligne CA>0 | OK |
| `nbHas` L440-453 | Compte CIP avec ≥1 ligne famille `f` | Numérateur pénétration | OK |
| `nbMiss` L454 | `nbActives - nbHas` | Trous de raquette | OK |
| `penPct` L455 | `nbHas / nbActives * 100` | Taux pénétration famille | OK |
| `avgCaPerPharma` L456 | `caTotal / nbHas` | CA moyen famille par pharma acheteuse | OK |
| `avgRefs` L457 | `nbRefsTotal / nbHas` | Profondeur moy. = nb réfs famille / pharma acheteuse | DOUTE — voir B.3 |
| `missCa` L459-461 | `Σ byCip[c2].totalCa pour c2 ∉ setHas` | CA total des pharmas qui ne touchent pas la famille | DOUTE — voir B.4 (sémantique trompeuse en footer card "déjà fait ailleurs") |
| `avgPen` L131 | Moyenne arithm. des 6 `penPct` | Pénétration moyenne territoire | OK (mais c'est une moyenne non pondérée, voir C) |
| `top10Pen` L342-348 | `nbHas` = nb CIP où `byCip[cip].codes[t.code]` | Pénétration produit OPS sur territoire Will | OK |
| `penPct` produits OPS L358 | `r.nbHas / totalTerritoire * 100` (totalTerritoire = `CLIENTS.length`) | % du territoire qui achète ce produit | OK |
| `penActivesPct` L359 | `r.nbHas / nbActives * 100` | % des pharmas actives qui achètent | OK |
| `oppMiss` L362 | `max(0, nbPotentiel - r.nbHas)` | Pharmas potentiel Gx>0 sans achat du produit | DOUTE — voir B.5 |
| Hardcoded "Sur 1027" L379 | Le label "Sur 1027" est figé en HTML | Doit être `totalTerritoire` dynamique | **FAUX** — voir B.6 |

### A.5 · `crm/benchmark-laboratoires.js`

| Fonction · ligne | Formule | Sémantique | Verdict |
|---|---|---|---|
| `normKeyCase`, `normKeyStrip` L68-77 | Casefold + strip suffixes "FRANCE/SAS/SA/LABORATOIRES…" | Clés de matching labos | OK (3 niveaux : strict, case, strip — pragmatique) |
| `myPct` L177 | `myCa / myTotal * 100` | Part labo dans mon portefeuille | OK |
| `opsPct` L181 | `opsCa / opsTotal * 100` | Part labo dans CA OPS | OK |
| `pdm` L182 | `myCa / opsCa * 100` (null si opsCa=0) | "Ma PdM en valeur sur ce labo" | DOUTE — voir B.7 (sémantique de PdM intrinsèquement biaisée car territoires différents) |
| `indice` L183 | `myPct / opsPct * 100`, sinon 999 si opsPct=0 et myPct>0 | Indice mix 100 = aligné | OK (mais valeur arbitraire 999 — voir C) |
| `buildAbsentBlock.manque` L300-301 | `cibleCa = opsCa/opsTotal * myTotal` ; `manque = max(0, cibleCa - myCa)` | Manque à gagner labo si mix aligné OPS | OK |
| Seuils ABSENT/SOUS-EXPLOITÉ L288-289 | OPS > 50k€ ET moi < 5k€ | Filtre prospection | OK (arbitraire mais explicité) |
| `totalManque` L325 | Σ `manque` sur top 10 absent | Levier total | OK |
| `dominantFamille` L143-154 | argmax `ca` par famille pour 1 labo, `pct = bestCa / total` | Famille dominante labo | OK |
| Header `unmatchedCa` L477 | Σ `myCa` des labos non matchés OPS | "CA non comparé" | OK (utile pour transparence) |
| `ratio` L490 | `myTotal / opsTotal * 100` | Rapport de taille des 2 périmètres | OK (informatif uniquement) |

### A.6 · `crm/benchmark-trajectoires.js`

| Fonction · ligne | Formule | Sémantique | Verdict |
|---|---|---|---|
| `linReg` L80-97 | Moindres carrés : `slope = (n·ΣXY − ΣX·ΣY)/(n·ΣXX − (ΣX)²)` ; `slopePct = slope / meanY * 100` | Pente €/mois → % du CA moyen / mois | OK (formule standard) |
| `growth` L163 | `(last - first)/first * 100`, 100% si first=0 et last>0 | Croissance brute début/fin | DOUTE — voir B.8 (volatil sur 1er mois faible) |
| `accel3m` L172-174 | `(Σ3derniers − Σ3précédents)/Σ3précédents * 100` | Accélération récente | OK (mais avec 8 mois, "prev3" = mois 3-5 et "last3" = mois 6-8, donc on saute le mois 1-2 : pas une vraie "moyenne mobile") |
| `peakShare` L181 | `maxVal / totalCa * 100` | Concentration du pic | OK |
| Heatmap `intensity` L310-314 | `value / max` (par famille) floor 0.08 | Intensité couleur intra-famille | OK |
| Heatmap `mix` L342 | `v / totMonth * 100` | Part famille dans CA mensuel total | OK |
| Alerte saisonnalité L402 | `share > 25` | Pic mensuel signalé | OK (seuil explicité) |
| Alerte chute consécutive L431-433 | `prev > 1000 && cur < prev && pct < -15` | Recul m→m+1 | OK (seuil 1000 € évite faux positifs sur petits mois) |
| Alerte accélération L463 | `accel3m > 20` | Push commercial | OK |
| `trendTag` L100-106 | Bandes : >+15, +3/+15, -3/+3, -3/-15, <-15 | Tag commercial | OK |

---

## SECTION B — Formules à corriger

### B.1 · multibench L124 — "Mon poids" ambigu commercialement

**Code actuel** (`crm/benchmark-multibench.js:124`) :
```js
var poidsWill = T.ca > 0 ? (myTotal / T.ca * 100) : 0;
```
Affiché comme "Mon poids : X.X %".

**Problème sémantique** : myTotal = 1 218 655 € sur 8 dpts (8 mois), T.ca = 8 632 706 € OPS Nantes (12 mois, 1 établissement). Le ratio (≈14 %) **n'a pas de sens commercial direct** car les périmètres temporels et géographiques diffèrent. Will pourrait croire que son secteur représente "14 % d'OPS Nantes" — il représente plutôt 14 % de leur CA en proportion 8 mois/8 dpts vs 12 mois/1 établissement.

**Correctif suggéré** : soit retirer ce chiffre, soit le relabeler "Ratio de comparaison" + footnote méthodo (périodes/ périmètres non comparables). **Impact** : ce n'est pas un chiffre faux mathématiquement, mais c'est interprétable comme une PdM, ce qui serait trompeur.

**Verdict** : DOUTE sémantique (pas FAUX en math).

---

### B.2 · manque-a-gagne L386-388 — `indiceCouv` mélange 2 univers

**Code actuel** (`crm/benchmark-manque-a-gagne.js:386-388`) :
```js
var myRefs = Number(mine.nb_refs) || Object.keys(myFamRefSet[f] || {}).length;
var opsRefs = Number(opsF.nb) || 0;
var indiceCouv = opsRefs > 0 ? Math.min(100, (myRefs / opsRefs) * 100) : 0;
```

**Problème** :
- `opsRefs` = nb d'artcodes OPS dans la famille (sur 5 113 produits OPS). Or OPS Nantes a 5 113 réfs total et Will fait 1 951 réfs sur 8 dpts. Le ratio est *biaisé par la taille du catalogue OPS*, pas par la couverture commerciale.
- Le UI le présente comme "ma PdM produits" (ligne 219 : `' ma PdM produits : ' + fmtPct(r.indiceCouv, 0)`). **C'est faux** : ce n'est PAS une PdM produits, c'est un ratio de catalogues.
- Une vraie "couverture" se mesurerait sur l'intersection (artcodes IP National présents dans `STOCK` et facturés vs nb de réfs distribuables par Will).

**Impact** : sur-estime/sous-estime selon les familles. Pour Princeps (où Will fait 1 131 réfs / ~3 000 OPS) → indice ~38 % affiché "Couverture partielle" alors que c'est juste un nombre de réfs disponibles. Pour Biosimilaires (32 réfs Will / ~50 OPS) → 64 % "Couverture partielle" alors que Will distribue *quasi toute la gamme*. Trompeur.

**Correctif** : soit retirer le label "ma PdM produits" et écrire "indice catalogue", soit changer le numérateur en intersection des CIP13.

**Verdict** : FAUX sémantique.

---

### B.3 · penetration L450 — `avgRefs` double-compte les artcodes

**Code actuel** (`crm/benchmark-penetration.js:446-457`) :
```js
if (rec && rec.codes) {
  for (var ac in rec.codes) {
    var stk = STOCK[ac];
    if (!stk) continue;
    if (familleFromAttrs(stk.nature, stk.marque, stk.sousfamille) === f) nbRefsTotal++;
  }
}
...
var avgRefs = nbHas > 0 ? nbRefsTotal / nbHas : 0;
```

**Problème** : `nbRefsTotal` compte 1 par (CIP × artcode) — donc si la pharma A achète 3 réfs Princeps et la pharma B achète 2 réfs Princeps, `nbRefsTotal = 5` pour Princeps. Diviser par `nbHas` (=2) donne 2.5 réfs/pharma. **C'est correct mathématiquement.**

Cependant, le code ne déduplique pas entre pharmas : c'est bien une moyenne (Σ refs par pharma / nb pharmas), pas la cardinalité distincte. La sémantique "profondeur moyenne" est cohérente.

**Edge case** : un artcode qui n'est pas dans `STOCK` est ignoré (`if (!stk) continue;`) → sous-comptage. STOCK = 6 370 réfs vs SALES_BY_PRODUCT = ? sur 1 951 produits différents Will. Vérifier qu'il n'y a pas d'artcodes facturés mais hors stock (ruptures, anciens codes…).

**Verdict** : OK mathématiquement, DOUTE sur le sous-comptage si certaines réfs facturées ne sont plus dans STOCK.

---

### B.4 · penetration L459-461 — `missCa` calculé mais affiché trompeur

**Code actuel** (`crm/benchmark-penetration.js:459-461`) :
```js
var missCa = 0;
for (var c2 in byCip) {
  if (!setHas[c2]) missCa += byCip[c2].totalCa;
}
```

Affiché L133 :
```js
sub3 = fmtNum(mostUnder.nbMiss) + ' clients actifs sans aucun achat · ' + fmtEuro(mostUnder.missCa) + ' de CA déjà fait ailleurs'
```

**Problème** : `missCa` = somme du CA *IP* des pharmas qui n'achètent pas dans la famille. Le label "CA déjà fait **ailleurs**" laisse croire que ce CA serait fait chez la concurrence. **C'est faux** : c'est le CA que ces pharmas font *avec IP*, juste pas dans cette famille. Will pourrait dire au pharmacien "vous faites X € ailleurs sur le Froid" — ce qui serait mensonger.

**Correctif** : relabeler "CA IP global de ces pharmas" ou "potentiel restant à pénétrer" (= `nbMiss × avgCaPerPharma`).

**Verdict** : FAUX sémantique (chiffre exact, mais libellé trompeur).

---

### B.5 · penetration L362 — `oppMiss` comparaison incohérente

**Code actuel** (`crm/benchmark-penetration.js:362`) :
```js
var oppMiss = Math.max(0, nbPotentiel - r.nbHas);
```
avec `nbPotentiel` = nb pharmas du territoire avec `potentielGx > 0` (sur les 517), et `r.nbHas` = nb pharmas *actives* (sur les 48) qui achètent ce produit.

**Problème** : on soustrait deux ensembles disjoints — `nbPotentiel` est calculé sur `CLIENTS` (territoire entier 517), `nbHas` est calculé sur `byCip` (pharmas actives 48). Mathématiquement, si potentielGx >0 inclut tout le territoire et les acheteurs ne sont qu'un sous-ensemble des 48 actifs, la soustraction n'a pas de garantie d'être un sur-ensemble propre.

**Exemple** : si 250 pharmas ont potentielGx>0 et 30 actives achètent le produit. `oppMiss = 220`. **Mais** : les 220 ne sont pas forcément "pharmas à potentiel sans achat" — certaines des 30 acheteuses peuvent avoir potentielGx=0 ! Le label "pharmas potentiel >0 sans achat" peut donc sur-estimer le nombre de leads de quelques unités à plusieurs dizaines.

**Correctif rigoureux** :
```js
var oppMiss = 0;
for (var i = 0; i < CLIENTS.length; i++) {
  var c = CLIENTS[i];
  if ((Number(c.potentielGx) || 0) <= 0) continue;
  var rec = byCip[c.cip];
  if (!rec || !rec.codes || !rec.codes[t.code]) oppMiss++;
}
```

**Impact estimé** : sur-estime de quelques pourcents à 10-15 % selon le produit (les acheteuses du produit ne sont pas toutes à potentiel >0).

**Verdict** : FAUX (modéré).

---

### B.6 · penetration L379 — "Sur 1027" hardcoded

**Code actuel** (`crm/benchmark-penetration.js:379`) :
```js
'<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Sur 1027</div>' +
```

**Problème** : la valeur 1027 est figée en dur. Or `totalTerritoire = CLIENTS.length = 517` (cf ROBOT.md §9). **Incohérent** : on affiche un % calculé sur 517 (`penPct = r.nbHas / totalTerritoire * 100`) avec un label "Sur 1027". Le pharmacien va lire "X % sur 1027 pharmas" alors que la division a été faite sur 517.

**Correctif** : remplacer par `'Sur ' + fmtNum(totalTerritoire)`.

**Impact** : Will affiche un label erroné, le pourcentage lui est correct. Le ridicule terrain est néanmoins certain.

**Verdict** : FAUX (label).

---

### B.7 · laboratoires L182 — "Ma PdM /OPS" mélange territoire vs établissement

**Code actuel** (`crm/benchmark-laboratoires.js:182`) :
```js
var pdm = opsCa > 0 ? (myCa / opsCa) * 100 : null;
```

**Problème** : `myCa` = mon CA labo sur 8 dpts × 8 mois. `opsCa` = CA labo OPS Nantes (1 établissement) sur 12 mois. Le rapport est appelé "Ma PdM /OPS" (UI L271 et footer L278 : `'<b>Ma PdM</b> = Mon CA / CA OPS sur ce labo'`). **Ce n'est pas une part de marché** — c'est un rapport d'échelles.

Une vraie PdM = mon CA / CA total du marché sur le même périmètre. Ici, certains labos peuvent atteindre 200-500 % (mon secteur 8 dpts vend plus chez ce labo que OPS Nantes seul), affichés en vert "≥ 100 %" comme un succès — alors que c'est juste l'effet de l'ampleur géographique.

**Correctif** : relabeler "Ratio Mon CA / CA OPS" ou retirer. Sinon, pour rendre la PdM correcte il faudrait connaitre le marché labo sur les 8 dpts (donnée absente).

**Verdict** : DOUTE sémantique (math juste, label faux).

---

### B.8 · trajectoires L163 — `growth` instable si first mois faible

**Code actuel** (`crm/benchmark-trajectoires.js:163`) :
```js
var growth = first > 0 ? ((last - first) / first) * 100 : (last > 0 ? 100 : 0);
```

**Problème** : si `first` (oct 2025) est très faible (Will démarrait/effet calendaire), le ratio devient énorme. Données réelles : SALES_BY_MONTH "2025-10" = 34 241 € et "2026-05" = 224 029 € → `growth = +554 %`. C'est un chiffre vrai mathématiquement mais commercialement très exagéré (effet rampe d'activité, pas effet pousse-vente).

La pente linéaire (`slopePct`) est plus robuste car elle utilise les 8 points. Le UI affiche `growth` (L244 — `growthLine`) à côté de la pente, ce qui crée 2 chiffres "croissance" pouvant raconter des histoires différentes (pente +20 %/mois mais growth +500 %).

**Correctif** : soit remplacer `growth` par `(last - first)/((first+last)/2)*100` (variation symétrique), soit ne plus afficher `growth` et ne garder que la pente.

**Verdict** : DOUTE (vrai chiffre, mais labile sur petit effectif).

---

## SECTION C — Edge cases non gérés

### C.1 · CA négatifs (avoirs / retours)

**Donnée réelle** (`sales-detail.js:204`, `sales-detail.js:208`) :
```
"petit": { "Froid": { "ca": -2429.18, "qte": 18 }, "Biosimilaires": { "ca": -353.64, "qte": -1 } }
```

**Impact** :
- benchmark-manque-a-gagne : `myCa` peut être négatif sur une (famille,tranche), conduisant à `myPct < 0` et `deltaPts` exagéré. La formule `gap = cibleCa - myCa` devient encore plus positive (manque amplifié à tort).
- benchmark-trajectoires : la régression linéaire encaisse les négatifs OK mais `meanY` peut être faussé si ratio CA négatifs élevé.
- benchmark-penetration : `if (ca <= 0) continue;` L114 → les **lignes d'avoir sont ignorées**, donc une pharma qui n'a fait QUE des avoirs sur la période apparaît comme non-active. Inverse-débat : si la pharma a fait 10k€ + 200€ d'avoirs, le CA cumulé est OK (les > 0 sont sommés). Mais si une pharma a fait 5k€ d'avoir Froid et 0 nouvel achat Froid, elle apparait comme "pharma sans achat Froid" alors qu'elle EST cliente Froid.

**Fix proposé (pseudo-code)** :
```js
// Dans manque-a-gagne : afficher un warning si myCa < 0
if (myCa < 0) console.warn('[benchmark-mag] CA négatif famille=', f, myCa);
// Dans penetration : compter aussi les achats négatifs comme "présence famille"
total += ca;  // au lieu de continue
codes[r.artcode] = 1;
if (ca !== 0) { /* update fams */ }
```

### C.2 · `STOCK[code]` manquant pour artcode facturé

**Donnée réelle** : STOCK contient 6 370 réfs (stock du 2026-06-01). SALES_BY_PRODUCT contient 1 951 produits facturés. Probabilité non nulle qu'un artcode facturé entre oct et mai ne soit plus en stock début juin (rupture, code DLU, retrait).

**Impact** :
- benchmark-penetration L450 : la fonction `famOfArtcode` retourne `null` si stock manquant, le code la skippe, donc l'achat est ignoré dans la pénétration famille. **Sous-comptage** silencieux.
- benchmark-manque-a-gagne L368 : idem `if (!stk) continue;`

**Fix proposé** :
```js
function famOfArtcode(artcode, stock) {
  var stk = stock[artcode];
  if (!stk) {
    // fallback : essayer via SALES_BY_PRODUCT.sousfamille
    var sp = (window.SALES_BY_PRODUCT || {})[artcode];
    if (sp && sp.sousfamille) {
      return familleFromAttrs('', '', sp.sousfamille);
    }
    return null;
  }
  return familleFromAttrs(stk.nature, stk.marque, stk.sousfamille);
}
```

### C.3 · `marque` / `labo` NULL ou "#N/A" dans STOCK

STOCK contient 2 431 réfs avec `nature: "#N/A"`. La fonction `familleFromAttrs` ne pose pas de problème (les conditions strict-match sur "Biosimilaire"/"Generique" passent à côté de "#N/A" → fallback Princeps ou Non remboursés). C'est OK mais à mentionner explicitement.

`marque: "#N/A"` n'existe pas dans STOCK (toutes les valeurs sont AFM codes valides : REMBSS, MED010, DM, DM_20, OTC, PARA, HORSMED). OK.

### C.4 · Période courte vs régression linéaire

**Code** : `benchmark-trajectoires.js:80` `linReg(yArr)` avec n=8 points. **Acceptable** mais :
- Si une famille démarre à 0 € au mois 1 (cas Biosimilaires Will probablement), `slopePct = slope/meanY * 100` peut atteindre des valeurs très élevées (>+50%/mois) sans signification commerciale.
- Pas de R² affiché : on ne sait pas si la régression est fiable (forte saisonnalité = R² faible mais pente affichée).

**Fix proposé (long terme)** : calculer R² et masquer le slope si R² < 0.4 (afficher "non-monotone").

### C.5 · Famille produit mal classée — fallback Princeps absorbe tout l'incertain

`familleFromAttrs` retourne `Princeps` comme fallback final. Donc :
- nature inconnue, afmcode REMBSS, sousfamille non-Froid → Princeps
- DM (dispositif médical) avec nature="#N/A" → Non remboursés (correct car DM != REMBSS)

**Edge case réel** : un produit avec `nature=""`, `afmcode=""` (vide pas "#N/A"), `sousfamille="Ophtalmologie"` → tombe en Princeps. Si ophtalmo n'est pas remboursé, c'est faux. Mais le périmètre exact dépend du référentiel IP.

**Fix proposé** : ajouter assertion logging si une réf à fort CA tombe en Princeps par défaut.

### C.6 · Division par zéro

Audit ligne à ligne :
- multibench L124 `T.ca > 0 ?` ✓, L141 `willMix.total > 0 ?` ✓, L150 `mix.total > 0 ?` ✓, L187 `Math.max(t.ops, t.cpr, t.hp, 1)` ✓.
- focus L131 `p.ca > 0 ?` ✓, L141 `p.ca > 0 ?` ✓, L147 `Math.max(ops, cpr, hp, 1)` ✓.
- manque-a-gagne L378/L379 `myTotal > 0`, `opsTotal > 0` ✓, L388 `opsRefs > 0 ?` ✓.
- penetration L455 `nbActives > 0`, L456 `nbHas > 0` ✓, L358 `totalTerritoire > 0` ✓, L359 `nbActives > 0` ✓.
- laboratoires L177/L181 `myTotal/opsTotal > 0` ✓, L182 `opsCa > 0 ?` ✓, L183 `opsPct > 0 ?` (`else 999 if myPct > 0 else 0`) ✓ (mais 999 est arbitraire et peut polluer le tri/affichage).
- trajectoires L93 `denom !== 0`, L95 `meanY > 0` ✓.

**Verdict global div/0 : OK**.

### C.7 · `findOpsForLabo` : collisions de noms strippés

Dans `benchmark-laboratoires.js` L74 :
```js
x = x.replace(/\b(france|sas|sa|s\.a\.|s\.a\.s|laboratoires|laboratoire|labo|pharma|santé|sante|healthcare|health|f\.?)\b/g, ' ');
```

**Problème** : "PFIZER FRANCE" et "PFIZER" strippent en "pfizer" et matchent. Bien. Mais "TEVA SANTE FRANCE" et "TEVA PHARMA" strippent tous deux en "teva" → collision potentielle. La fonction `findSalesForLabo` retourne *la première* entrée match (`if (kc && !byCase[kc]) byCase[kc] = entry;`), donc à ordre d'insertion près.

**Impact** : un labo Will pourrait être matché à un labo OPS différent. Sur 181 labos Will, sans audit exhaustif des conflits, impossible de garantir 0 erreur. Recommandation : logger les multi-matchs.

**Fix proposé** :
```js
if (ks && byStrip[ks] && byStrip[ks].name !== k) {
  console.warn('[bench-labos] strip collision', ks, byStrip[ks].name, '<->', k);
}
```

---

## SECTION D — Incohérences inter-modules

### D.1 · Mix famille : 4 sources de vérité — *cohérentes*

- `getMixWill()` (multibench L63) lit `SALES_BY_FAMILLE`.
- `SALES_BY_FAMILLE[f].ca` est directement utilisé dans manque-a-gagne (L374).
- penetration recalcule à partir de CLIENT_PRODUCTS + STOCK (méthode différente).
- focus recalcule à partir de OPS+CPR+HP fusionnés (n'utilise pas Will sales).

**Test de cohérence** : `getMixWill()` et `SALES_BY_FAMILLE` doivent donner exactement le même mix → **OK** (même source). Mais le mix de penetration (calculé à partir de CLIENT_PRODUCTS × STOCK) peut diverger légèrement de SALES_BY_FAMILLE si certains artcodes ne sont pas dans STOCK (cf C.2). **Risque incohérence affichée**.

**Recommandation** : faire passer penetration sur le même indice `SALES_BY_PRODUCT.sousfamille` ou propager SALES_BY_FAMILLE en source unique.

### D.2 · Indices /100 : 2 conventions différentes

- benchmark-laboratoires L183 : `indice = (myPct / opsPct) * 100`, fallback 999.
- benchmark-multibench L151 `delta = willPct - pct` (écart en points, pas indice).
- benchmark-manque-a-gagne L380 `deltaPts = myPct - opsPct` (idem, écart en points).
- benchmark-focus N/A (utilise PdM en %).

**Verdict** : l'indice /100 n'apparaît qu'une fois. Pas d'incohérence directe, mais le pharmacien pourrait être perdu entre les "Δ pts" du module manque-a-gagne et l'"Indice mix" du module laboratoires. **Recommandation UX** : choisir une convention unique (préférer "écart pts" partout, plus intuitif).

### D.3 · "Manque à gagner" : 2 définitions divergentes

- benchmark-manque-a-gagne L384 : `gap = cibleCa - myCa` *par famille IP* (`cibleCa = opsPct/100 * myTotal`).
- benchmark-laboratoires L300-301 : `manque = max(0, cibleCa - myCa)` *par labo* (`cibleCa = opsCa/opsTotal * myTotal`).

Les 2 utilisent la même méthode (appliquer le mix OPS au CA total Will), mais sur des découpes différentes (famille vs labo). **C'est correct conceptuellement** (différentes vues d'un même chiffre). Mais :

**Test de validation** : Σ manque famille (totalManque module mag, L421) ≠ Σ manque labo (totalManque module labos, L325). Normal — pas additifs. Mais Will pourrait additionner mentalement les 2 totaux et croire à un double levier.

**Recommandation** : harmoniser le label "Manque à gagner". Préciser "vue mix famille" vs "vue mix labo" dans chaque module.

### D.4 · benchmark-multibench top 10 communs vs benchmark-focus

multibench (L83-89) prend des produits *présents dans les 3 sources OPS/CPR/HP* (intersection). focus (L70-90) prend tous les artcodes *union* + agrège. Conséquence : les top 10 multibench ⊆ top 15 par famille focus. Pas d'incohérence, juste différentes vues.

---

## SECTION E — Recommandations long terme

### E.1 · Tests unitaires à ajouter

Créer un fichier `crm/__tests__/benchmark-formulas.test.js` (ou similaire, même sans framework — peut être un simple `assert` dans un script run-on-demand) pour blinder :

1. **`familleFromAttrs` table de vérité** — 12 cas représentatifs :
   - `('Biosimilaire','REMBSS','')` → 'Biosimilaires'
   - `('','REMBSS','Froid')` → 'Froid'
   - `('','MED010','')` → 'Non remboursés'
   - `('','#N/A','')` → 'Princeps'
   - `('Generique Partenaire','REMBSS','')` → 'Gén. partenaires'
   - `('Generique','REMBSS','')` → 'Génériques'
   - `('Biosimilaire','REMBSS','Froid')` → 'Biosimilaires' (nature prime sur froid)
   - `('Referent','REMBSS','')` → 'Princeps' (fallback)
   - `('','','')` → 'Princeps' (totalement vide)
   - `('','REMBSS','#N/A')` → 'Princeps' (#N/A en sousfamille = pas froid)
   - `('#N/A','MED010','')` → 'Non remboursés' (nature #N/A inertes, afmcode prime)
   - `('Generique','MED010','')` → 'Non remboursés' (afmcode prime sur nature Generique)

2. **`linReg`** — séries connues :
   - `[1,2,3,4,5]` → slope=1, slopePct=33.33
   - `[10,10,10,10]` → slope=0, slopePct=0
   - `[100,50,0]` → slope=-50, slopePct=-100
   - `[]` → slope=0 (pas de crash)
   - `[5]` → slope=0 (1 point)

3. **`trancheFromPrix`** — bornes :
   - `0` → 'petit', `4.32` → 'petit', `4.33` → 'petit', `4.34` → 'inter'
   - `467.99` → 'inter', `468` → 'inter', `468.01` → 'haut'

4. **Gap mathématique invariant** (`benchmark-manque-a-gagne`) :
   - Σ(myPct famille) = 100 et Σ(opsPct famille) = 100 → Σ(deltaPts) = 0 et Σ(gap) = 0
   - **Test à coder explicitement** : `expect(famRows.reduce((s,r)=>s+r.gap, 0)).toBeCloseTo(0, 0)`. Si ce test casse, il y a une famille manquante ou un produit OPS hors `FAMILLES`.

5. **Cohérence `SALES_BY_FAMILLE` ↔ `STOCK`** :
   - Pour chaque famille, vérifier que les artcodes SALES_BY_PRODUCT classés par STOCK donnent une somme proche de SALES_BY_FAMILLE[f].ca. Tolérance 5 % pour absorber les artcodes hors STOCK.

6. **Test PdM bornée [0,100] sauf cas légitimes** :
   - benchmark-focus : `myCa / p.ca` peut dépasser 100 si Will vend plus qu'OPS+CPR+HP. Identifier les cas et soit clipper, soit afficher "≥100 %".

### E.2 · Logging non bloquant pour Vincent-proofing

Ajouter dans chaque module `console.warn` sur :
- CA négatifs détectés (combien, sur quelle famille).
- Artcodes facturés mais absents de STOCK (combien, quel CA cumulé).
- Labos Will non matchés OPS (déjà fait dans laboratoires L477 mais pas loggé).
- Collisions de strip labo (proposition C.7).

Ces warnings ne s'affichent pas pour Vincent mais permettent à Will (ou Claude) de détecter les régressions de données.

### E.3 · Documentation in-line de la méthodo dans le rapport HTML

Plusieurs modules ont déjà une "Notes méthodologiques" en pied de page (multibench non, manque-a-gagne oui L441, penetration oui L495, trajectoires oui L569). Standardiser :
- **multibench** : ajouter footer méthodo précisant que "Mon poids" est un ratio d'échelles, pas une PdM.
- **focus** : ajouter footer expliquant que PdM = mon CA / CA IP National produit.

### E.4 · Refactor de `familleFromAttrs`

5 copies identiques de `familleFromAttrs` dans 5 fichiers — risque qu'une évolution oublie un module. Extraire dans un fichier partagé `crm/lib/famille.js` exposant `window.familleFromAttrs`. Pas de bundler nécessaire (vanilla JS, cf ROBOT.md §2).

### E.5 · Validation d'invariants à la construction des données

Dans `generate_sales_detail.py` et `generate_establishments.py` (Python), ajouter des assertions :
- Σ SALES_BY_FAMILLE.ca ≈ SALES_TOTAL.ca (tolérance 1 €)
- Σ SALES_BY_MONTH.ca ≈ SALES_TOTAL.ca
- Σ SALES_BY_TRANCHE.ca ≈ SALES_TOTAL.ca
- Σ OPS_BY_LABO.ca ≈ OPS_TOTAL.ca
- nb_labos cohérent entre TOTAL et keys(BY_LABO)

Si Σ ≠ Total, les % affichés seront systématiquement faux. C'est la défense la plus rentable.

---

## Récap final

- **Formules vérifiées** : ~50 formules sur 6 modules.
- **Fausses (sémantique trompeuse ou erreur réelle)** : 3 — `indiceCouv` (B.2), `missCa` label (B.4), label "Sur 1027" hardcodé (B.6), `oppMiss` mélange territoires (B.5). Soit 4 si on compte la 3ème comme purement label vs sémantique.
- **À doute (math juste, label/contexte ambigu)** : 4 — "Mon poids" (B.1), "PdM /OPS" labo (B.7), `growth` instable (B.8), `avgRefs` sous-comptage si STOCK manquant (B.3).
- **OK** : le reste, dont les composants critiques (`linReg`, `trancheFromPrix`, `familleFromAttrs`, gaps, cibles CA).
- **Edge cases problématiques principaux** : CA négatifs (C.1), artcode facturé hors STOCK (C.2).

**3 fixes prioritaires (impact pharmacien direct)** :

1. **`crm/benchmark-penetration.js:379`** — Remplacer le label hardcodé `"Sur 1027"` par `'Sur ' + fmtNum(totalTerritoire)`. Sinon Will affiche un dénominateur qui ne correspond pas à son périmètre réel (517 pharmas) — ridicule terrain garanti.
2. **`crm/benchmark-penetration.js:133` (et calcul L459-461)** — Renommer `"de CA déjà fait ailleurs"` → `"de CA IP global"` (ou potentiel = `nbMiss × avgCaPerPharma`). Le label actuel suggère un CA concurrence, ce qui est commercialement mensonger.
3. **`crm/benchmark-manque-a-gagne.js:219`** — Le label `"ma PdM produits : X %"` est faux : ce n'est pas une PdM mais un ratio de catalogues (myRefs/opsRefs). Soit retirer, soit relabeler `"indice catalogue"`. La méthodo footnote actuelle parle de "indice de couverture" — bon, mais l'UI dit PdM. Aligner.

Bonus prioritaire 4 : ajouter le fallback `SALES_BY_PRODUCT.sousfamille` dans `famOfArtcode` pour ne plus perdre les artcodes facturés hors stock (C.2) — sinon penetration sous-compte silencieusement.

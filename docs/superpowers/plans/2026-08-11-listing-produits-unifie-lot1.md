# Écran « Produits » unifié — Lot 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un écran unique `Produits` dans le CRM V2 qui, pour une officine donnée, liste les produits que ses confrères du même groupement d'achat nous prennent et qu'elle ne nous prend pas, filtrés sur le stock réel — plus la même matière lue par produit pour l'équipe achats, et un PDF à laisser au pharmacien.

**Architecture:** Deux fichiers, deux responsabilités. `v2-produits-moteur.js` est un module **pur** (aucun DOM, aucun réseau, aucun `V2.*`) qui indexe les ventes et produit les listings — il tourne sous `node --test` comme dans le navigateur, exactement comme `v2-rdv-creneaux.js`. `v2-produits.js` est la page (`V2.pages.produits`) : il ne fait que du rendu et appelle le moteur. Aucun nouveau fichier de données, aucune étape Python : le listing se recalcule depuis `V2.sales` et suit automatiquement le prochain rafraîchissement des stats.

**Tech Stack:** Vanilla JS (ES5, pas de build, pas de npm, pas de framework) · `node:test` + `node:assert/strict` pour les tests · CSS avec les tokens du thème clair existant.

**Spec de référence :** `docs/superpowers/specs/2026-08-11-listing-produits-unifie-design.md`

## Global Constraints

- **Vanilla ES5 strict.** Pas de `let`/`const`/arrow/template literals dans `crm/v2/*.js` — le code existant est en `var` + `function`. Aucun `import`, aucun `require` dans les fichiers de `crm/v2/` (seuls les tests `.mjs` en font).
- **Nommage imposé :** un pilier = `v2-<domaine>.js`. Ne pas inventer d'autre motif.
- **Helpers `V2.*` obligatoires** dans la page : `V2.esc()` pour tout texte injecté en HTML, `V2.fmtEur()` / `V2.fmtNum()` pour tous les nombres (jamais `toFixed(2) + ' €'`), `V2.toast()` pour tout retour utilisateur (jamais `alert()`), `V2.go()` pour naviguer.
- **`V2.esc` ne suffit pas dans un `onclick="…('ICI')"`** — neutraliser à la source : `esc(String(v).replace(/[\\'"<>&]/g, ''))`.
- **Prix net d'un princeps** (famille `pr_low` / `pr_mid` / `pr_high`) = PPHT − barème par tranche : `0,18 €` si PPHT ≤ 4,33 € · `3,89 %` si PPHT ≤ 468 € · `19,50 €` au-delà. Utiliser le champ `net` de `PROD_STATS`, déjà calculé. **Ne pas recalculer un net à côté.**
- **Familles `gen`, `nr`, `biosim` : net = PPHT, aucun abandon de marge.** Afficher `—` dans la colonne abandon, et les exclure de toute moyenne d'abandon.
- **Vocabulaire imposé : « abandon de marge »**. Le synonyme commercial usuel est proscrit dans tout le code, les libellés, le PDF et les messages de commit (un hook bloque l'écriture du fichier sinon).
- **Intégral Pharma est un groupe de grossistes-répartiteurs.** Dans cet écran, le mot « groupement » désigne uniquement le groupement d'achat du pharmacien (Giphar, UPP…). Ne jamais employer ce mot pour désigner Intégral.
- **Interdits Safari** (le Mac de Will plante) : pas de `backdrop-filter`, pas de `background-clip:text` sur du grand texte, pas de `filter:blur` sur une grande surface, pas plus d'une `<video autoplay>`. Toujours un repli `@media (prefers-reduced-motion: reduce)`.
- **Cache-busting :** toute modification d'un fichier servi impose de monter le jeton `?v=AAAAMMJJ<lettre>` **aux trois endroits** : tous les `?v=` de `crm/v2/index.html`, `var VER` dans `crm/v2/sw.js`, et `var V = '?v=…'` dans `crm/v2/v2-boot.js` (ligne ~310). Valeur actuelle : `20260810a` → cible de ce lot : `20260811a`.
- **Git :** fichiers ajoutés **un par un**, jamais `git add -A` / `.` / `--all` (bloqué par hook). Contrôler `git status --short` après indexation. Branche courante : `feature/rdv-mailing`.
- **Avant tout `git push` :** verdict **GO** obligatoire du sous-agent `gardien-deploiement`.
- **Mobile :** lisible à 390 px, cibles tactiles ≥ 44 px, champs de saisie ≥ 16 px (sinon iOS zoome).
- **Données de test réelles :** `WML_OFFICINES` = 691 officines, `WML_SALES` = 437 848 lignes, `STOCK_IP.data` = 6 367 CIP, `PROD_STATS` = 6 292 CIP.

---

## Structure des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `crm/v2/v2-produits-moteur.js` | **créé** — moteur pur : indexation, groupe de comparaison, listing officine, listing produit. Aucun DOM. | 1, 2, 3 |
| `tests/produits-moteur.test.mjs` | **créé** — tests unitaires `node --test` sur données synthétiques | 1, 2, 3 |
| `tests/produits-reel.test.mjs` | **créé** — tests d'invariants sur les **vraies** données de prod | 3 |
| `crm/v2/v2-produits.js` | **créé** — page `V2.pages.produits` : modes Vendeur et Achats, filtres, PDF | 4, 5, 6 |
| `crm/v2/index.html` | modifié — 2 balises `<script>` + jeton `?v=` | 4, 8 |
| `crm/v2/sw.js` | modifié — `var VER` | 8 |
| `crm/v2/v2-boot.js` | modifié — `var V = '?v='` | 8 |
| `crm/v2/v2-app.js` | modifié — tuiles d'accueil, index ⌘K, accent de route | 7 |

**Frontière entre les deux fichiers :** le moteur ne connaît que des objets simples (`{id, groupement, cp, ca}`, `{pharmacyId, artCode, mntNetHt, qte}`) et rend des objets simples. Il ne sait rien des libellés produits, des prix ni du HTML. La page fait la jonction avec `PROD_STATS`, `RUPTURES`, `ETAB_PRICES` et le DOM. On doit pouvoir changer entièrement l'écran sans toucher au moteur.

---

## Task 1: Moteur — indexation des ventes et groupe de comparaison

**Files:**
- Create: `crm/v2/v2-produits-moteur.js`
- Test: `tests/produits-moteur.test.mjs`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces:
  - `M.SEUIL_PEERS = 0.30`, `M.MIN_GROUPE = 5`, `M.MOIS_COUVERTS = 6`
  - `M.trancheCA(ca) -> 'a'|'b'|'c'|'d'`
  - `M.dept(cp) -> string|null`
  - `M.indexer(officines, ventes) -> idx` où `idx = { officines: {id: {id, groupement, cp, ca}}, netParOfficine: {id: {cip: number}}, qteParCip: {cip: number}, cles: {id: {grp, deptTranche, tranche}}, membres: {cle: [id,…]} }`
  - `M.groupeComparaison(idx, phId) -> { type, cle, libelle, taille } | null` — `taille` inclut l'officine cible.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/produits-moteur.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../crm/v2/v2-produits-moteur.js');

// ── Jeu d'essai synthétique ────────────────────────────────────────
// 6 officines Giphar (groupe nominal), 2 Mediprix (trop petit → repli),
// 1 sans groupement. Toutes en 44 sauf MED2 (en 49).
export const OFFICINES = [
  { id: 'G1', groupement: 'Giphar', cp: '44000', ca: 50000 },
  { id: 'G2', groupement: 'Giphar', cp: '44100', ca: 52000 },
  { id: 'G3', groupement: 'Giphar', cp: '44200', ca: 48000 },
  { id: 'G4', groupement: 'Giphar', cp: '44300', ca: 45000 },
  { id: 'G5', groupement: 'Giphar', cp: '44400', ca: 55000 },
  { id: 'G6', groupement: 'Giphar', cp: '44500', ca: 51000 },
  { id: 'MED1', groupement: 'Mediprix', cp: '44600', ca: 47000 },
  { id: 'MED2', groupement: 'Mediprix', cp: '49000', ca: 12000 },
  { id: 'SEUL', groupement: '', cp: '44700', ca: 46000 },
];

function v(ph, cip, mnt, qte) {
  return { pharmacyId: ph, artCode: cip, mntNetHt: mnt, qte: qte == null ? 1 : qte };
}

export const VENTES = [
  v('G1', 'AAA', 100), v('G2', 'AAA', 200), v('G3', 'AAA', 300),
  v('G1', 'BBB', 50), v('G2', 'BBB', 50),
  // CCC : acheté puis intégralement retourné par G1 → net 0, ne compte pas
  v('G1', 'CCC', 80), v('G1', 'CCC', -80, -1),
  v('G2', 'CCC', 40),
];

test('trancheCA : quatre paliers, bornes incluses vers le bas', () => {
  assert.equal(M.trancheCA(0), 'a');
  assert.equal(M.trancheCA(9999), 'a');
  assert.equal(M.trancheCA(10000), 'b');
  assert.equal(M.trancheCA(29999), 'b');
  assert.equal(M.trancheCA(30000), 'c');
  assert.equal(M.trancheCA(59999), 'c');
  assert.equal(M.trancheCA(60000), 'd');
  assert.equal(M.trancheCA(null), 'a');
});

test('dept : deux premiers caracteres du code postal, null si vide', () => {
  assert.equal(M.dept('44300'), '44');
  assert.equal(M.dept(' 49000 '), '49');
  assert.equal(M.dept(''), null);
  assert.equal(M.dept(null), null);
});

test('indexer : le net est cumule par officine et par CIP', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(idx.netParOfficine.G1.AAA, 100);
  assert.equal(idx.netParOfficine.G3.AAA, 300);
});

test('indexer : un produit integralement retourne tombe a zero', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(idx.netParOfficine.G1.CCC, 0);
});

test('indexer : quantites cumulees par CIP, retours deduits', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(idx.qteParCip.CCC, 1);   // +1 chez G1, -1 chez G1, +1 chez G2
  assert.equal(idx.qteParCip.AAA, 3);
});

test('groupe : groupement d au moins 5 officines = cas nominal', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const g = M.groupeComparaison(idx, 'G1');
  assert.equal(g.type, 'groupement');
  assert.equal(g.libelle, 'confrères Giphar');
  assert.equal(g.taille, 6);
});

test('groupe : groupement trop petit bascule sur les officines comparables', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const g = M.groupeComparaison(idx, 'MED1');
  // MED1 est en 44, tranche c (47000) : rejoint G1..G6 qui sont tous en 44 tranche c
  assert.equal(g.type, 'comparables');
  assert.equal(g.libelle, 'officines comparables');
  assert.ok(g.taille >= 5, `attendu >= 5, obtenu ${g.taille}`);
});

test('groupe : sans groupement du tout, meme chemin de repli', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const g = M.groupeComparaison(idx, 'SEUL');
  assert.equal(g.type, 'comparables');
});

test('groupe : departement isole tombe sur la tranche de taille seule', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  // MED2 : seul en 49, tranche b — aucun comparable departemental
  const g = M.groupeComparaison(idx, 'MED2');
  assert.equal(g.type, 'taille');
  assert.equal(g.libelle, 'officines de taille comparable');
});

test('groupe : officine inconnue rend null au lieu de planter', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(M.groupeComparaison(idx, 'INEXISTANTE'), null);
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
cd /Users/williammorel/JARVIS/APP && node --test tests/produits-moteur.test.mjs
```

Attendu : ÉCHEC — `Cannot find module '../crm/v2/v2-produits-moteur.js'`.

- [ ] **Step 3: Écrire le moteur minimal**

Créer `crm/v2/v2-produits-moteur.js` :

```js
/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Moteur du listing produits (V2PRODUITS)
   Répond à : « que prennent les confrères de cette officine, qu'elle
   ne prend pas chez nous ? ». Fichier PUR : aucun DOM, aucun réseau,
   aucun V2.*. Il tourne aussi bien dans le navigateur que sous
   `node --test`. Même contrat que v2-rdv-creneaux.js.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  // Part des confrères qui doivent déjà prendre le produit pour qu'il
  // vaille la peine d'être proposé. Mesuré sur les données de prod le
  // 11/08/2026 : 50 % laisse 101 officines sous 5 produits, 20 % noie
  // la liste (188 produits). 30 % = 87 produits, aucune officine à vide.
  M.SEUIL_PEERS = 0.30;
  // Taille minimale d'un groupe pour que la comparaison ait un sens.
  M.MIN_GROUPE = 5;
  // Nombre de mois couverts par WML_SALES (jan.–juin 2026).
  M.MOIS_COUVERTS = 6;

  M.trancheCA = function (ca) {
    ca = +ca || 0;
    if (ca < 10000) return 'a';
    if (ca < 30000) return 'b';
    if (ca < 60000) return 'c';
    return 'd';
  };

  M.dept = function (cp) {
    var s = String(cp == null ? '' : cp).trim().slice(0, 2);
    return s ? s : null;
  };

  M.indexer = function (officines, ventes) {
    var idx = { officines: {}, netParOfficine: {}, qteParCip: {}, cles: {}, membres: {} };
    var i, o, id, cle;

    officines = officines || [];
    for (i = 0; i < officines.length; i++) {
      o = officines[i];
      id = String(o.id);
      idx.officines[id] = { id: id, groupement: String(o.groupement || '').trim(), cp: o.cp, ca: +o.ca || 0 };
      var t = M.trancheCA(o.ca), d = M.dept(o.cp);
      idx.cles[id] = {
        grp: idx.officines[id].groupement ? 'g:' + idx.officines[id].groupement : null,
        deptTranche: d ? 'd:' + d + '|' + t : null,
        tranche: 't:' + t
      };
      var cs = idx.cles[id];
      if (cs.grp) (idx.membres[cs.grp] = idx.membres[cs.grp] || []).push(id);
      if (cs.deptTranche) (idx.membres[cs.deptTranche] = idx.membres[cs.deptTranche] || []).push(id);
      (idx.membres[cs.tranche] = idx.membres[cs.tranche] || []).push(id);
    }

    ventes = ventes || [];
    for (i = 0; i < ventes.length; i++) {
      var v = ventes[i];
      var ph = String(v.pharmacyId), cip = String(v.artCode);
      if (!idx.officines[ph]) continue;      // vente orpheline : ignorée
      var m = idx.netParOfficine[ph] || (idx.netParOfficine[ph] = {});
      m[cip] = (m[cip] || 0) + (+v.mntNetHt || 0);
      idx.qteParCip[cip] = (idx.qteParCip[cip] || 0) + (+v.qte || 0);
    }
    return idx;
  };

  M.groupeComparaison = function (idx, phId) {
    var id = String(phId);
    var cible = idx.officines[id];
    if (!cible) return null;
    var cs = idx.cles[id];

    if (cs.grp && (idx.membres[cs.grp] || []).length >= M.MIN_GROUPE) {
      return { type: 'groupement', cle: cs.grp, libelle: 'confrères ' + cible.groupement,
               taille: idx.membres[cs.grp].length };
    }
    if (cs.deptTranche && (idx.membres[cs.deptTranche] || []).length >= M.MIN_GROUPE) {
      return { type: 'comparables', cle: cs.deptTranche, libelle: 'officines comparables',
               taille: idx.membres[cs.deptTranche].length };
    }
    return { type: 'taille', cle: cs.tranche, libelle: 'officines de taille comparable',
             taille: (idx.membres[cs.tranche] || []).length };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2PRODUITS = M;
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

```bash
cd /Users/williammorel/JARVIS/APP && node --test tests/produits-moteur.test.mjs
```

Attendu : **10 tests, 10 pass, 0 fail**.

- [ ] **Step 5: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/v2/v2-produits-moteur.js
git add tests/produits-moteur.test.mjs
git status --short crm/v2/v2-produits-moteur.js tests/produits-moteur.test.mjs
git commit -m "feat(produits): moteur — indexation des ventes et groupe de comparaison"
```

---

## Task 2: Moteur — le listing d'une officine (le trou vs les confrères)

**Files:**
- Modify: `crm/v2/v2-produits-moteur.js` (ajout de `M.agregatGroupe` et `M.listingOfficine`)
- Test: `tests/produits-moteur.test.mjs` (ajout de tests)

**Interfaces:**
- Consumes: `M.indexer`, `M.groupeComparaison`, `M.SEUIL_PEERS`, `M.MIN_GROUPE` (Task 1).
- Produces:
  - `M.agregatGroupe(idx, cle) -> { cnt: {cip: n}, som: {cip: €}, taille: n }` — mémorisé sur `idx._agg`, calculé une seule fois par clé de groupe.
  - `M.listingOfficine(idx, phId, opts) -> { groupe, nbConfreres, lignes: [{ cip, peers, pctPeers, caMoyen, potentiel, stock }] }`
    `opts = { seuil?: number, stock?: {cip: unites}, exigerStock?: boolean }` — `exigerStock` vaut `true` par défaut. Lignes triées par `potentiel` décroissant.

**Pourquoi un agrégat par groupe :** calculer le listing de chaque officine en balayant les ventes de tous ses confrères coûterait des millions d'opérations en mode Achats (Task 3). On agrège **une fois par groupe** (135 groupements + ~100 clés département×tranche + 4 tranches), puis on **retranche la contribution de l'officine cible**. C'est aussi ce qui garantit que `nbConfreres` exclut toujours la cible, y compris dans les chemins de repli où elle appartient au groupe construit.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `tests/produits-moteur.test.mjs` :

```js
// ── Task 2 : listing d'une officine ────────────────────────────────
const STOCK = { AAA: 500, BBB: 12, CCC: 7, DDD: 0 };

test('agregat : compte les officines et somme les nets par CIP', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const a = M.agregatGroupe(idx, 'g:Giphar');
  assert.equal(a.taille, 6);
  assert.equal(a.cnt.AAA, 3);          // G1, G2, G3
  assert.equal(a.som.AAA, 600);
  assert.equal(a.cnt.CCC, 1);          // G1 est a zero net, seul G2 compte
});

test('agregat : deux appels rendent le meme objet memorise', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(M.agregatGroupe(idx, 'g:Giphar'), M.agregatGroupe(idx, 'g:Giphar'));
});

test('listing : le denominateur exclut toujours l officine cible', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK });
  assert.equal(r.nbConfreres, 5);      // 6 Giphar - elle-meme
});

test('listing : un produit deja achete par l officine n apparait pas', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G1', { stock: STOCK, seuil: 0.1 });
  assert.equal(r.lignes.filter((l) => l.cip === 'AAA').length, 0);
});

test('listing : le trou remonte avec le bon pourcentage et la bonne moyenne', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK });
  const aaa = r.lignes.find((l) => l.cip === 'AAA');
  assert.ok(aaa, 'AAA doit remonter pour G4');
  assert.equal(aaa.peers, 3);
  assert.equal(aaa.pctPeers, 3 / 5);
  assert.equal(aaa.caMoyen, 200);      // (100+200+300)/3
  assert.equal(aaa.potentiel, 200 * (3 / 5));
});

test('listing : sous le seuil, le produit est ecarte', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  // CCC : 1 confrere sur 5 = 20 %, sous le seuil de 30 %
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK });
  assert.equal(r.lignes.filter((l) => l.cip === 'CCC').length, 0);
  // seuil abaisse a 10 % : il remonte
  const r2 = M.listingOfficine(idx, 'G4', { stock: STOCK, seuil: 0.1 });
  assert.equal(r2.lignes.filter((l) => l.cip === 'CCC').length, 1);
});

test('listing : un produit hors stock est ecarte', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: { AAA: 0, BBB: 12 } });
  assert.equal(r.lignes.filter((l) => l.cip === 'AAA').length, 0);
  assert.equal(r.lignes.filter((l) => l.cip === 'BBB').length, 1);
});

test('listing : exigerStock a false garde les produits hors stock', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: { AAA: 0 }, exigerStock: false });
  const aaa = r.lignes.find((l) => l.cip === 'AAA');
  assert.ok(aaa);
  assert.equal(aaa.stock, 0);
});

test('listing : trie par potentiel decroissant', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK, seuil: 0.1 });
  for (let i = 1; i < r.lignes.length; i++) {
    assert.ok(r.lignes[i - 1].potentiel >= r.lignes[i].potentiel,
      `ligne ${i} mal triee`);
  }
});

test('listing : officine inconnue rend une liste vide, pas une erreur', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'INEXISTANTE', { stock: STOCK });
  assert.deepEqual(r.lignes, []);
  assert.equal(r.nbConfreres, 0);
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
cd /Users/williammorel/JARVIS/APP && node --test tests/produits-moteur.test.mjs
```

Attendu : les 10 tests de la Task 1 passent, les 10 nouveaux échouent avec `M.agregatGroupe is not a function` / `M.listingOfficine is not a function`.

- [ ] **Step 3: Implémenter l'agrégat et le listing**

Dans `crm/v2/v2-produits-moteur.js`, insérer **avant** le bloc `if (typeof module !== 'undefined'…)** :

```js
  // Agrégat d'un groupe : pour chaque CIP, combien d'officines du groupe
  // l'achètent réellement (net > 0) et pour quel montant cumulé.
  // Mémorisé sur l'index : une seule fois par clé, quel que soit le nombre
  // d'officines qui s'en servent.
  M.agregatGroupe = function (idx, cle) {
    idx._agg = idx._agg || {};
    if (idx._agg[cle]) return idx._agg[cle];
    var membres = idx.membres[cle] || [];
    var cnt = {}, som = {}, i, cip;
    for (i = 0; i < membres.length; i++) {
      var v = idx.netParOfficine[membres[i]];
      if (!v) continue;
      for (cip in v) {
        if (!Object.prototype.hasOwnProperty.call(v, cip)) continue;
        if (!(v[cip] > 0)) continue;
        cnt[cip] = (cnt[cip] || 0) + 1;
        som[cip] = (som[cip] || 0) + v[cip];
      }
    }
    idx._agg[cle] = { cnt: cnt, som: som, taille: membres.length };
    return idx._agg[cle];
  };

  M.listingOfficine = function (idx, phId, opts) {
    opts = opts || {};
    var seuil = opts.seuil == null ? M.SEUIL_PEERS : opts.seuil;
    var stock = opts.stock || {};
    var exigerStock = opts.exigerStock !== false;

    var grp = M.groupeComparaison(idx, phId);
    if (!grp) return { groupe: null, nbConfreres: 0, lignes: [] };

    var id = String(phId);
    var mien = idx.netParOfficine[id] || {};
    var agg = M.agregatGroupe(idx, grp.cle);
    // L'officine cible appartient au groupe agrégé : on retire sa propre
    // contribution pour ne compter que les confrères.
    var dansLeGroupe = (idx.membres[grp.cle] || []).indexOf(id) >= 0;
    var n = grp.taille - (dansLeGroupe ? 1 : 0);
    if (n <= 0) return { groupe: grp, nbConfreres: 0, lignes: [] };

    var out = [], cip;
    for (cip in agg.cnt) {
      if (!Object.prototype.hasOwnProperty.call(agg.cnt, cip)) continue;
      if (mien[cip] > 0) continue;                       // elle le prend déjà
      // L'agrégat ne compte que les officines dont le net est > 0. La cible
      // ayant été écartée au `continue` ci-dessus, sa contribution est
      // forcément nulle : rien à retrancher ici, seul le dénominateur change.
      var peers = agg.cnt[cip], somme = agg.som[cip];
      if (peers <= 0) continue;
      var pct = peers / n;
      if (pct < seuil) continue;
      var st = +stock[cip] || 0;
      if (exigerStock && !(st > 0)) continue;
      var moy = somme / peers;
      out.push({ cip: cip, peers: peers, pctPeers: pct, caMoyen: moy,
                 potentiel: moy * pct, stock: st });
    }
    out.sort(function (a, b) { return b.potentiel - a.potentiel; });
    return { groupe: grp, nbConfreres: n, lignes: out };
  };
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

```bash
cd /Users/williammorel/JARVIS/APP && node --test tests/produits-moteur.test.mjs
```

Attendu : **20 tests, 20 pass, 0 fail**.

- [ ] **Step 5: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/v2/v2-produits-moteur.js
git add tests/produits-moteur.test.mjs
git status --short crm/v2/v2-produits-moteur.js tests/produits-moteur.test.mjs
git commit -m "feat(produits): moteur — listing par officine, trie par potentiel"
```

---

## Task 3: Moteur — le listing par produit (mode Achats) et les invariants sur données réelles

**Files:**
- Modify: `crm/v2/v2-produits-moteur.js` (ajout de `M.listingProduits` et `M.couverture`)
- Test: `tests/produits-moteur.test.mjs` (ajout de tests)
- Create: `tests/produits-reel.test.mjs`

**Interfaces:**
- Consumes: `M.indexer`, `M.listingOfficine`, `M.MOIS_COUVERTS` (Tasks 1-2).
- Produces:
  - `M.couverture(idx, cip, stock) -> number|null` — mois de stock ; `null` si la demande mensuelle est nulle.
  - `M.listingProduits(idx, opts) -> [{ cip, officines, potentiel, stock, couverture }]` trié par `potentiel` décroissant. `opts = { seuil?, stock?, exigerStock?, filtreGroupement?: string }`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `tests/produits-moteur.test.mjs` :

```js
// ── Task 3 : listing par produit (mode Achats) ─────────────────────
test('couverture : stock divise par la demande mensuelle', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  // AAA : 3 unites sur 6 mois = 0,5/mois ; stock 500 → 1000 mois
  assert.equal(M.couverture(idx, 'AAA', { AAA: 500 }), 1000);
});

test('couverture : demande nulle rend null au lieu d infini', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(M.couverture(idx, 'INCONNU', { INCONNU: 10 }), null);
});

test('produits : agrege le nombre d officines en trou sur chaque CIP', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingProduits(idx, { stock: STOCK, seuil: 0.1 });
  const aaa = r.find((l) => l.cip === 'AAA');
  assert.ok(aaa, 'AAA doit apparaitre');
  // G4, G5, G6 ne prennent pas AAA et sont dans le groupe Giphar
  assert.ok(aaa.officines >= 3, `attendu >= 3, obtenu ${aaa.officines}`);
});

test('produits : le potentiel cumule est la somme des potentiels officine', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingProduits(idx, { stock: STOCK, seuil: 0.1 });
  const aaa = r.find((l) => l.cip === 'AAA');
  let attendu = 0;
  for (const o of OFFICINES) {
    const li = M.listingOfficine(idx, o.id, { stock: STOCK, seuil: 0.1 })
      .lignes.find((l) => l.cip === 'AAA');
    if (li) attendu += li.potentiel;
  }
  assert.ok(Math.abs(aaa.potentiel - attendu) < 1e-9);
});

test('produits : trie par potentiel decroissant', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingProduits(idx, { stock: STOCK, seuil: 0.1 });
  for (let i = 1; i < r.length; i++) {
    assert.ok(r[i - 1].potentiel >= r[i].potentiel, `ligne ${i} mal triee`);
  }
});

test('produits : filtre par groupement ne garde que ses officines', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingProduits(idx, { stock: STOCK, seuil: 0.1, filtreGroupement: 'Mediprix' });
  const tous = M.listingProduits(idx, { stock: STOCK, seuil: 0.1 });
  const somme = (a) => a.reduce((s, x) => s + x.officines, 0);
  assert.ok(somme(r) < somme(tous), 'le filtre doit reduire le total');
});

test('produits : exigerStock a false fait apparaitre ce qu on n a pas', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingProduits(idx, { stock: {}, seuil: 0.1, exigerStock: false });
  assert.ok(r.length > 0, 'sans stock du tout, la vue achats doit rester peuplee');
  assert.equal(r[0].stock, 0);
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
cd /Users/williammorel/JARVIS/APP && node --test tests/produits-moteur.test.mjs
```

Attendu : 20 pass (Tasks 1-2), 7 fail avec `M.couverture is not a function` / `M.listingProduits is not a function`.

- [ ] **Step 3: Implémenter**

Dans `crm/v2/v2-produits-moteur.js`, insérer avant le bloc d'export :

```js
  // Combien de mois de stock on tient sur ce produit, au rythme du réseau.
  M.couverture = function (idx, cip, stock) {
    var parMois = (idx.qteParCip[String(cip)] || 0) / M.MOIS_COUVERTS;
    if (!(parMois > 0)) return null;
    return (+((stock || {})[String(cip)]) || 0) / parMois;
  };

  // La même matière, lue par produit : sur combien d'officines ce produit
  // est-il un trou, et pour quel potentiel cumulé.
  M.listingProduits = function (idx, opts) {
    opts = opts || {};
    var stock = opts.stock || {};
    var filtre = opts.filtreGroupement ? String(opts.filtreGroupement).trim() : null;
    var par = {}, id, i, cip;

    for (id in idx.officines) {
      if (!Object.prototype.hasOwnProperty.call(idx.officines, id)) continue;
      if (filtre && idx.officines[id].groupement !== filtre) continue;
      var r = M.listingOfficine(idx, id, opts);
      for (i = 0; i < r.lignes.length; i++) {
        var l = r.lignes[i];
        var e = par[l.cip] || (par[l.cip] = { cip: l.cip, officines: 0, potentiel: 0, stock: l.stock, couverture: null });
        e.officines += 1;
        e.potentiel += l.potentiel;
      }
    }

    var out = [];
    for (cip in par) {
      if (!Object.prototype.hasOwnProperty.call(par, cip)) continue;
      par[cip].couverture = M.couverture(idx, cip, stock);
      out.push(par[cip]);
    }
    out.sort(function (a, b) { return b.potentiel - a.potentiel; });
    return out;
  };
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

```bash
cd /Users/williammorel/JARVIS/APP && node --test tests/produits-moteur.test.mjs
```

Attendu : **27 tests, 27 pass, 0 fail**.

- [ ] **Step 5: Écrire les tests d'invariants sur les VRAIES données**

Ce sont les vérifications de la §10 de la spec, automatisées. Créer `tests/produits-reel.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const M = require('../crm/v2/v2-produits-moteur.js');

// Les fichiers *-data.js sont des scripts navigateur : on les evalue dans un
// bac a sable muni d'un objet `window`, comme le fait la page.
// ⚠️ Les fichiers doivent etre CONCATENES en un seul script : wml-officines-data.js
// declare `const WML_OFFICINES`, une liaison lexicale qui ne devient PAS une
// propriete du bac a sable. Un collecteur ajoute a la fin du meme script est le
// seul moyen fiable de la recuperer. Motif verifie le 11/08/2026.
function charger(...fichiers) {
  const sb = { window: {}, console };
  vm.createContext(sb);
  const src = fichiers
    .map((f) => readFileSync(new URL(f, import.meta.url), 'utf8'))
    .join('\n;\n') +
    '\n;globalThis.__X = {' +
    '  WML_OFFICINES: typeof WML_OFFICINES !== "undefined" ? WML_OFFICINES : window.WML_OFFICINES,' +
    '  WML_SALES: typeof WML_SALES !== "undefined" ? WML_SALES : window.WML_SALES,' +
    '  STOCK_IP: window.STOCK_IP, PROD_STATS: window.PROD_STATS };';
  vm.runInContext(src, sb);
  return sb.__X;
}

const D = charger(
  '../crm/v2/wml-officines-data.js',
  '../crm/v2/stock-data.js',
  '../crm/v2/prod-stats-data.js'
);
const OFFICINES = D.WML_OFFICINES;
const SALES = D.WML_SALES;
const STOCK = D.STOCK_IP.data;
const PS = D.PROD_STATS;

// WML_SALES est au format compact : [phId, mois, commercial, cip13, qte, puNet, mntNetHt]
const VENTES = SALES.map((s) => ({
  pharmacyId: String(s[0]), artCode: s[3], qte: s[4] || 0, mntNetHt: s[6] || 0,
}));

const idx = M.indexer(OFFICINES, VENTES);

test('donnees reelles : le volume attendu est bien la', () => {
  assert.equal(OFFICINES.length, 691);
  assert.ok(SALES.length > 400000, `attendu > 400k lignes, obtenu ${SALES.length}`);
});

test('invariant : aucune officine ne tombe a zero produit', () => {
  const vides = [];
  for (const o of OFFICINES) {
    const r = M.listingOfficine(idx, o.id, { stock: STOCK });
    if (r.lignes.length === 0) vides.push(o.name || o.id);
  }
  assert.deepEqual(vides, [], `officines sans aucun produit : ${vides.join(', ')}`);
});

test('invariant : 100 % des produits proposes sont en stock', () => {
  for (const o of OFFICINES.slice(0, 50)) {
    const r = M.listingOfficine(idx, o.id, { stock: STOCK });
    for (const l of r.lignes) {
      assert.ok(l.stock > 0, `${o.id} propose ${l.cip} avec un stock de ${l.stock}`);
    }
  }
});

test('invariant : aucune officine ne se compte elle-meme dans ses confreres', () => {
  for (const o of OFFICINES.slice(0, 100)) {
    const r = M.listingOfficine(idx, o.id, { stock: STOCK });
    if (!r.groupe) continue;
    assert.ok(r.nbConfreres < r.groupe.taille || r.groupe.taille === 0,
      `${o.id} : ${r.nbConfreres} confreres pour un groupe de ${r.groupe.taille}`);
    for (const l of r.lignes) {
      assert.ok(l.pctPeers <= 1, `${o.id} / ${l.cip} : ${l.pctPeers} > 100 %`);
    }
  }
});

test('invariant : un produit propose n est jamais deja achete par l officine', () => {
  for (const o of OFFICINES.slice(0, 100)) {
    const mien = idx.netParOfficine[String(o.id)] || {};
    for (const l of M.listingOfficine(idx, o.id, { stock: STOCK }).lignes) {
      assert.ok(!(mien[l.cip] > 0), `${o.id} : ${l.cip} deja achete`);
    }
  }
});

test('couverture des groupements : au moins 70 % en cas nominal', () => {
  let nominal = 0;
  for (const o of OFFICINES) {
    const g = M.groupeComparaison(idx, o.id);
    if (g && g.type === 'groupement') nominal++;
  }
  const pct = nominal / OFFICINES.length;
  assert.ok(pct >= 0.70, `seulement ${Math.round(pct * 100)} % en cas nominal`);
});

test('familles : le referentiel produit couvre les CIP proposes', () => {
  const connus = new Set(PS.map((r) => String(r.c)));
  const r = M.listingOfficine(idx, OFFICINES[0].id, { stock: STOCK });
  const inconnus = r.lignes.filter((l) => !connus.has(l.cip));
  // Tolerance : le referentiel PROD_STATS (6 292 CIP) est plus etroit que les
  // ventes (7 886 CIP). La page doit savoir afficher une ligne sans libelle.
  assert.ok(inconnus.length / Math.max(1, r.lignes.length) < 0.5,
    `${inconnus.length} CIP sur ${r.lignes.length} absents de PROD_STATS`);
});
```

- [ ] **Step 6: Lancer les tests réels**

```bash
cd /Users/williammorel/JARVIS/APP && node --test tests/produits-reel.test.mjs
```

Attendu : **7 tests, 7 pass**. Le fichier de ventes fait 27 Mo, compter ~10 s.

Si `invariant : aucune officine ne tombe a zero produit` échoue, **ne pas baisser le seuil en douce** : relever la liste des officines concernées et la signaler dans le rapport de tâche — c'est un fait métier, pas un bug de code.

- [ ] **Step 7: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/v2/v2-produits-moteur.js
git add tests/produits-moteur.test.mjs
git add tests/produits-reel.test.mjs
git status --short crm/v2/v2-produits-moteur.js tests/produits-moteur.test.mjs tests/produits-reel.test.mjs
git commit -m "feat(produits): moteur — vue par produit, couverture de stock, invariants sur donnees reelles"
```

---

## Task 4: Écran Produits — mode Vendeur

**Files:**
- Create: `crm/v2/v2-produits.js`
- Modify: `crm/v2/index.html` (2 balises `<script>` après la ligne 112)

**Interfaces:**
- Consumes: `V2PRODUITS.indexer`, `V2PRODUITS.listingOfficine`, `V2PRODUITS.SEUIL_PEERS` (Tasks 1-2) ; `V2.pharmacies`, `V2.sales`, `V2.esc`, `V2.fmtEur`, `V2.fmtNum`, `V2.go`, `V2.toast`, `V2.route.param` ; `window.PROD_STATS`, `window.STOCK_IP`, `window.RUPTURES`.
- Produces:
  - `V2.pages.produits = { render: function (root, param) }` — `param` = identifiant d'officine, optionnel.
  - `V2.produits.index()` — construit et mémorise l'index. `V2.produits.S` — état de l'écran.
  - `V2.produits.setPh(id)`, `V2.produits.setMode(m)`, `V2.produits.setFam(k)`, `V2.produits.setQ(s)`, `V2.produits.setRupt()` — pilotage depuis le HTML.

**Rappel de cadrage :** cette tâche ne fait **que** le mode Vendeur. Le mode Achats est la Task 5, le PDF la Task 6. L'onglet « Achats » existe mais affiche un état vide « bientôt » jusqu'à la Task 5.

- [ ] **Step 1: Créer la page**

Créer `crm/v2/v2-produits.js` :

```js
/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier « Produits » (pages.produits)
   L'entrée UNIQUE des produits : pour une officine, ce que ses confrères
   du même groupement d'achat nous prennent et qu'elle ne nous prend pas,
   filtré sur le stock réel. Deux modes : Vendeur (par officine) et
   Achats (par produit, cf. v2-produits.js §mode achats).
   Le calcul vit dans v2-produits-moteur.js (module pur, testé).
   Cet écran ne fait que du rendu.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  // Valeur destinée à un onclick="…('ICI')" : elle traverse HTML puis JS.
  var escAttr = function (s) { return esc(String(s == null ? '' : s).replace(/[\\'"<>&]/g, '')); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : Math.round(+n || 0) + ' €'; };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(Math.round(+n || 0)); };

  var FAM = {
    pr_low:  { l: 'Princeps < 4,33 €', c: 'var(--ip-blue)' },
    pr_mid:  { l: 'Princeps 4,33–468 €', c: 'var(--ip-blue)' },
    pr_high: { l: 'Princeps > 468 €', c: 'var(--ip-blue)' },
    nr:      { l: 'Non remboursable', c: 'var(--c-amber)' },
    gen:     { l: 'Générique', c: 'var(--c-mint)' },
    biosim:  { l: 'Biosimilaire', c: '#6D4FC4' }
  };
  // Seules les familles princeps portent un abandon de marge.
  function porteAbandon(f) { return String(f || '').indexOf('pr_') === 0; }

  var S = { mode: 'vendeur', ph: null, fam: 'all', q: '', sansRupture: false, page: 0 };
  var PAR_PAGE = 40;

  V2.produits = V2.produits || {};
  V2.produits.S = S;

  // ── Index (construit une fois, invalidé si les ventes changent) ──
  V2.produits.index = function () {
    var M = window.V2PRODUITS;
    if (!M) return null;
    var sig = (V2.sales || []).length + ':' + (V2.pharmacies || []).length;
    if (V2.produits._idx && V2.produits._sig === sig) return V2.produits._idx;
    V2.produits._idx = M.indexer(V2.pharmacies || [], V2.sales || []);
    V2.produits._sig = sig;
    return V2.produits._idx;
  };

  function fiche(cip) {
    if (!V2.produits._ps) {
      var m = {}, PS = window.PROD_STATS || [], i;
      for (i = 0; i < PS.length; i++) m[String(PS[i].c)] = PS[i];
      V2.produits._ps = m;
    }
    return V2.produits._ps[String(cip)] || null;
  }
  function enRupture(cip) {
    var R = window.RUPTURES && window.RUPTURES.data;
    return !!(R && R[String(cip)]);
  }

  // ── Pilotage depuis le HTML ────────────────────────────────────
  V2.produits.setPh = function (id) { S.ph = id || null; S.page = 0; V2.render(); };
  V2.produits.setMode = function (m) { S.mode = m; S.page = 0; V2.render(); };
  V2.produits.setFam = function (k) { S.fam = k; S.page = 0; V2.render(); };
  V2.produits.setRupt = function () { S.sansRupture = !S.sansRupture; S.page = 0; V2.render(); };
  V2.produits.plus = function () { S.page += 1; V2.render(); };
  var tq = null;
  V2.produits.setQ = function (v) {
    S.q = v || '';
    if (tq) clearTimeout(tq);
    tq = setTimeout(function () { S.page = 0; V2.render(); }, 220);
  };

  // ── Filtres d'affichage (le moteur a déjà fait le tri métier) ──
  function filtrer(lignes) {
    var q = S.q.trim().toLowerCase();
    var out = [], i;
    for (i = 0; i < lignes.length; i++) {
      var l = lignes[i], f = fiche(l.cip);
      if (S.fam !== 'all' && (!f || f.f !== S.fam)) continue;
      if (S.sansRupture && enRupture(l.cip)) continue;
      if (q) {
        var lib = (f && f.d ? f.d : '').toLowerCase();
        if (lib.indexOf(q) < 0 && String(l.cip).indexOf(q) < 0) continue;
      }
      out.push(l);
    }
    return out;
  }

  // ── Rendu : une ligne produit ──────────────────────────────────
  function ligneHtml(l, libelleGroupe) {
    var f = fiche(l.cip);
    var lib = f && f.d ? f.d : ('CIP ' + l.cip);
    var fam = f && FAM[f.f] ? FAM[f.f] : null;
    var rupt = enRupture(l.cip);
    var abandon = (f && porteAbandon(f.f) && f.ppht > 0 && f.net > 0)
      ? eur(f.ppht - f.net)
      : '—';
    return '' +
      '<div class="pr-row">' +
        '<div class="pr-main">' +
          '<div class="pr-lib">' + esc(lib) +
            (fam ? '<span class="pr-fam" style="--fc:' + fam.c + '">' + esc(fam.l) + '</span>' : '') +
            (rupt ? '<span class="pr-rupt">rupture ANSM</span>' : '') +
          '</div>' +
          '<div class="pr-arg">' +
            '<strong>' + Math.round(l.pctPeers * 100) + ' %</strong> de ses ' + esc(libelleGroupe) +
            ' le prennent · <strong>' + eur(l.caMoyen) + '</strong> en moyenne par confrère' +
          '</div>' +
        '</div>' +
        '<div class="pr-chiffres">' +
          '<div class="pr-pot"><span>' + eur(l.potentiel) + '</span><em>potentiel</em></div>' +
          '<div class="pr-net"><span>' + (f && f.net > 0 ? eur(f.net) : '—') + '</span><em>prix net</em></div>' +
          '<div class="pr-ab"><span>' + abandon + '</span><em>abandon de marge</em></div>' +
          '<div class="pr-stk"><span>' + num(l.stock) + '</span><em>en stock</em></div>' +
        '</div>' +
      '</div>';
  }

  // ── Rendu : mode Vendeur ───────────────────────────────────────
  function rendreVendeur() {
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx) return '<div class="v2-empty"><div class="v2-empty-t">Moteur indisponible</div></div>';

    var phs = (V2.pharmacies || []).slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });
    if (!S.ph && phs.length) S.ph = String(phs[0].id);

    var opts = '';
    for (var i = 0; i < phs.length; i++) {
      opts += '<option value="' + escAttr(phs[i].id) + '"' +
        (String(phs[i].id) === String(S.ph) ? ' selected' : '') + '>' + esc(phs[i].name) + '</option>';
    }

    var stock = (window.STOCK_IP && window.STOCK_IP.data) || {};
    var r = M.listingOfficine(idx, S.ph, { stock: stock });
    var lignes = filtrer(r.lignes);
    var potentielTotal = 0;
    for (i = 0; i < lignes.length; i++) potentielTotal += lignes[i].potentiel;
    var libGrp = r.groupe ? r.groupe.libelle : 'confrères';

    var visibles = lignes.slice(0, (S.page + 1) * PAR_PAGE);
    var corps = '';
    for (i = 0; i < visibles.length; i++) corps += ligneHtml(visibles[i], libGrp);

    return '' +
      '<div class="pr-bandeau">' +
        '<select class="pr-select" onchange="V2.produits.setPh(this.value)">' + opts + '</select>' +
        '<div class="pr-ctx">' +
          '<span class="pr-ctx-grp">' + esc(String(r.nbConfreres)) + ' ' + esc(libGrp) + '</span>' +
          '<span class="pr-ctx-pot">' + eur(potentielTotal) + ' de potentiel</span>' +
          '<span class="pr-ctx-n">' + num(lignes.length) + ' produits</span>' +
        '</div>' +
        '<div class="pr-source">ventes réseau jan.–juin 2026</div>' +
      '</div>' +
      filtresHtml() +
      (lignes.length
        ? '<div class="pr-liste">' + corps + '</div>' +
          (visibles.length < lignes.length
            ? '<button class="v2-btn pr-plus" onclick="V2.produits.plus()">Voir 40 produits de plus</button>'
            : '')
        : '<div class="v2-empty"><div class="v2-empty-t">Aucun produit avec ces filtres</div>' +
          '<div class="v2-empty-d">Élargis la recherche ou change de famille.</div></div>');
  }

  function filtresHtml() {
    var chips = '<span class="pr-chip' + (S.fam === 'all' ? ' on' : '') +
      '" onclick="V2.produits.setFam(\'all\')">Toutes familles</span>';
    for (var k in FAM) {
      if (!Object.prototype.hasOwnProperty.call(FAM, k)) continue;
      chips += '<span class="pr-chip' + (S.fam === k ? ' on' : '') +
        '" onclick="V2.produits.setFam(\'' + k + '\')">' + esc(FAM[k].l) + '</span>';
    }
    return '' +
      '<div class="pr-filtres">' +
        '<div class="pr-search">' + ICO('search', 16, 2) +
          '<input placeholder="Produit ou CIP…" value="' + escAttr(S.q) +
          '" oninput="V2.produits.setQ(this.value)">' +
        '</div>' +
        '<div class="pr-chips">' + chips +
          '<span class="pr-chip' + (S.sansRupture ? ' on' : '') +
          '" onclick="V2.produits.setRupt()">Masquer les ruptures ANSM</span>' +
        '</div>' +
      '</div>';
  }

  // ── Page ───────────────────────────────────────────────────────
  V2.pages.produits = {
    render: function (root, param) {
      if (param) S.ph = String(param);
      injectStyles();
      var onglets = '' +
        '<div class="pr-modes">' +
          '<button class="pr-mode' + (S.mode === 'vendeur' ? ' on' : '') +
            '" onclick="V2.produits.setMode(\'vendeur\')">Vendeur</button>' +
          '<button class="pr-mode' + (S.mode === 'achats' ? ' on' : '') +
            '" onclick="V2.produits.setMode(\'achats\')">Achats</button>' +
        '</div>';
      var corps = S.mode === 'vendeur'
        ? rendreVendeur()
        : '<div class="v2-empty"><div class="v2-empty-t">Vue achats en préparation</div></div>';
      root.innerHTML =
        V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap pr-wrap">' + onglets + corps + liensBas() + '</div>';
    }
  };

  function liensBas() {
    var l = [];
    if (V2.pages.catalogue) l.push('<a onclick="V2.go(\'catalogue\')">Catalogue complet</a>');
    if (V2.pages.molecules) l.push('<a onclick="V2.go(\'molecules\')">Prix par produit</a>');
    if (V2.pages.appro) l.push('<a onclick="V2.go(\'appro\')">Vue achats détaillée</a>');
    return l.length ? '<div class="pr-liens">' + l.join('') + '</div>' : '';
  }

  function injectStyles() {
    if (document.getElementById('pr-styles')) return;
    var s = document.createElement('style');
    s.id = 'pr-styles';
    s.textContent = [
      '.pr-wrap{padding-bottom:64px}',
      '.pr-modes{display:flex;gap:8px;margin:12px 0}',
      '.pr-mode{min-height:44px;padding:0 18px;border-radius:10px;border:1px solid var(--line);background:var(--card);font:600 15px/1 Inter,sans-serif;color:var(--ip-ink);cursor:pointer}',
      '.pr-mode.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}',
      '.pr-bandeau{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}',
      '.pr-select{width:100%;min-height:44px;font-size:16px;border-radius:10px;border:1px solid var(--line);padding:0 10px;background:var(--paper);color:var(--ip-ink)}',
      '.pr-ctx{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font:600 14px/1.3 Inter,sans-serif}',
      '.pr-ctx-pot{color:var(--ip-blue)}',
      '.pr-source{margin-top:8px;font:400 12px/1 Inter,sans-serif;color:var(--muted)}',
      '.pr-filtres{margin-bottom:12px}',
      '.pr-search{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0 12px;min-height:44px}',
      '.pr-search input{flex:1;border:0;background:transparent;font-size:16px;color:var(--ip-ink);outline:none}',
      '.pr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
      '.pr-chip{min-height:36px;display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);font:600 13px/1 Inter,sans-serif;cursor:pointer}',
      '.pr-chip.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}',
      '.pr-row{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:8px}',
      '.pr-lib{font:700 15px/1.3 Satoshi,Inter,sans-serif;color:var(--ip-ink)}',
      '.pr-fam{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;font:600 11px/1.6 Inter,sans-serif;color:var(--fc);border:1px solid var(--fc)}',
      '.pr-rupt{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:var(--c-rose);color:#fff;font:600 11px/1.6 Inter,sans-serif}',
      '.pr-arg{margin-top:6px;font:400 14px/1.4 Inter,sans-serif;color:var(--muted)}',
      '.pr-chiffres{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}',
      '.pr-chiffres>div{text-align:left}',
      '.pr-chiffres span{display:block;font:600 15px/1.2 "Geist Mono",monospace;color:var(--ip-ink)}',
      '.pr-chiffres em{display:block;font:400 11px/1.3 Inter,sans-serif;color:var(--muted);font-style:normal}',
      '.pr-pot span{color:var(--ip-blue)}',
      '.pr-plus{width:100%;min-height:44px;margin-top:8px}',
      '.pr-liens{display:flex;flex-wrap:wrap;gap:14px;margin-top:24px;padding-top:16px;border-top:1px solid var(--line)}',
      '.pr-liens a{font:500 13px/1 Inter,sans-serif;color:var(--muted);cursor:pointer;text-decoration:underline}',
      '@media (max-width:430px){.pr-chiffres{grid-template-columns:repeat(2,1fr)}}',
      '@media (prefers-reduced-motion: reduce){.pr-row{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
```

- [ ] **Step 2: Brancher les deux scripts dans la page**

Dans `crm/v2/index.html`, juste après la ligne `<script src="v2-campagne.js?v=20260810a"></script>` (ligne 112), insérer :

```html
  <script src="v2-produits-moteur.js?v=20260810a"></script>
  <script src="v2-produits.js?v=20260810a"></script>
```

Le jeton reste `20260810a` à cette étape ; il sera monté d'un coup en Task 8.

- [ ] **Step 3: Vérifier que la page s'ouvre**

```bash
cd /Users/williammorel/JARVIS/APP && python3 -m http.server 8765 >/dev/null 2>&1 &
sleep 1 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8765/crm/v2/v2-produits.js
```

Attendu : `200`.

Puis, dans le navigateur piloté (MCP `playwright`) :
1. `browser_navigate` vers `http://localhost:8765/crm/v2/#produits`
2. Purger le service worker avant tout (sinon l'ancienne version est resservie) :
   ```js
   navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
   caches.keys().then(k => k.forEach(c => caches.delete(c)));
   ```
   puis recharger.
3. `browser_resize` en **390 × 844**
4. `browser_take_screenshot` → `verif-ecran/produits-vendeur-390.png`
5. `browser_console_messages` → **aucune erreur** attendue.

Contrôles à l'œil sur la capture :
- le sélecteur d'officine est rempli et lisible ;
- le bandeau affiche « N confrères <groupement> », un potentiel en €, un nombre de produits ;
- la mention « ventes réseau jan.–juin 2026 » est présente et discrète ;
- une ligne produit affiche bien les 4 chiffres, en 2 colonnes à 390 px ;
- **aucun générique n'affiche autre chose que `—` en abandon de marge** ;
- aucun débordement horizontal.

- [ ] **Step 4: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/v2/v2-produits.js
git add crm/v2/index.html
git add verif-ecran/produits-vendeur-390.png
git status --short crm/v2/v2-produits.js crm/v2/index.html
git commit -m "feat(produits): ecran mode Vendeur — listing par officine avec preuve visuelle 390 px"
```

---

## Task 5: Écran Produits — mode Achats

**Files:**
- Modify: `crm/v2/v2-produits.js` (remplace l'état vide « bientôt »)

**Interfaces:**
- Consumes: `V2PRODUITS.listingProduits`, `V2PRODUITS.couverture` (Task 3) ; `V2.produits.index()`, `fiche()`, `enRupture()`, `filtrer()`, `FAM` (Task 4) ; `window.GENERIQUEURS`.
- Produces: `V2.produits.setGrp(nom)`, `V2.produits.setHorsStock()` — filtres propres au mode Achats.

- [ ] **Step 1: Ajouter l'état et les commandes**

Dans `crm/v2/v2-produits.js`, remplacer la ligne de déclaration d'état :

```js
  var S = { mode: 'vendeur', ph: null, fam: 'all', q: '', sansRupture: false, page: 0 };
```

par :

```js
  var S = { mode: 'vendeur', ph: null, fam: 'all', q: '', sansRupture: false, page: 0,
            grp: 'all', horsStock: false };
```

Et ajouter, à côté des autres commandes :

```js
  V2.produits.setGrp = function (g) { S.grp = g || 'all'; S.page = 0; V2.render(); };
  V2.produits.setHorsStock = function () { S.horsStock = !S.horsStock; S.page = 0; V2.render(); };
```

- [ ] **Step 2: Écrire le rendu du mode Achats**

Ajouter dans `crm/v2/v2-produits.js`, avant `V2.pages.produits` :

```js
  // ── Rendu : mode Achats ────────────────────────────────────────
  // Même moteur, lu par produit : sur combien d'officines ce produit est-il
  // un trou, et faut-il le rentrer (« hors stock » = ce qu'on n'a pas).
  function rendreAchats() {
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx) return '<div class="v2-empty"><div class="v2-empty-t">Moteur indisponible</div></div>';

    var stock = (window.STOCK_IP && window.STOCK_IP.data) || {};
    var lignes = M.listingProduits(idx, {
      stock: stock,
      exigerStock: !S.horsStock,          // « hors stock » = on lève le filtre stock
      filtreGroupement: S.grp === 'all' ? null : S.grp
    });
    if (S.horsStock) {
      lignes = lignes.filter(function (l) { return !(l.stock > 0); });
    }
    lignes = filtrer(lignes);

    var visibles = lignes.slice(0, (S.page + 1) * PAR_PAGE), corps = '', i;
    for (i = 0; i < visibles.length; i++) corps += ligneAchatHtml(visibles[i]);

    return '' +
      '<div class="pr-bandeau">' +
        '<select class="pr-select" onchange="V2.produits.setGrp(this.value)">' +
          optionsGroupements() +
        '</select>' +
        '<div class="pr-ctx">' +
          '<span class="pr-ctx-n">' + num(lignes.length) + ' produits</span>' +
          '<span class="pr-ctx-pot">' + eur(totalPotentiel(lignes)) + ' de potentiel réseau</span>' +
        '</div>' +
        '<div class="pr-source">ventes réseau jan.–juin 2026</div>' +
      '</div>' +
      filtresHtml() +
      '<div class="pr-chips">' +
        '<span class="pr-chip' + (S.horsStock ? ' on' : '') +
        '" onclick="V2.produits.setHorsStock()">Uniquement ce qu\'on n\'a pas</span>' +
      '</div>' +
      (lignes.length
        ? '<div class="pr-liste">' + corps + '</div>' +
          (visibles.length < lignes.length
            ? '<button class="v2-btn pr-plus" onclick="V2.produits.plus()">Voir 40 produits de plus</button>'
            : '')
        : '<div class="v2-empty"><div class="v2-empty-t">Aucun produit avec ces filtres</div></div>');
  }

  function totalPotentiel(lignes) {
    var t = 0, i;
    for (i = 0; i < lignes.length; i++) t += lignes[i].potentiel;
    return t;
  }

  function optionsGroupements() {
    var vus = {}, phs = V2.pharmacies || [], i, g;
    for (i = 0; i < phs.length; i++) {
      g = String(phs[i].groupement || '').trim();
      if (g) vus[g] = (vus[g] || 0) + 1;
    }
    var noms = Object.keys(vus).sort(function (a, b) { return vus[b] - vus[a]; });
    var out = '<option value="all"' + (S.grp === 'all' ? ' selected' : '') +
              '>Tous les groupements d\'achat</option>';
    for (i = 0; i < noms.length; i++) {
      out += '<option value="' + escAttr(noms[i]) + '"' +
             (S.grp === noms[i] ? ' selected' : '') + '>' +
             esc(noms[i]) + ' · ' + vus[noms[i]] + ' officines</option>';
    }
    return out;
  }

  function generiqueur(cip) {
    var G = window.GENERIQUEURS;
    if (!G) return '';
    var d = G.data || G;
    var e = d[String(cip)];
    if (!e) return '';
    return typeof e === 'string' ? e : (e.labo || e.g || '');
  }

  function ligneAchatHtml(l) {
    var f = fiche(l.cip);
    var lib = f && f.d ? f.d : ('CIP ' + l.cip);
    var fam = f && FAM[f.f] ? FAM[f.f] : null;
    var g = generiqueur(l.cip);
    var couv = l.couverture == null ? '—'
      : (l.couverture >= 24 ? '> 24 mois' : (Math.round(l.couverture * 10) / 10) + ' mois');
    return '' +
      '<div class="pr-row">' +
        '<div class="pr-main">' +
          '<div class="pr-lib">' + esc(lib) +
            (fam ? '<span class="pr-fam" style="--fc:' + fam.c + '">' + esc(fam.l) + '</span>' : '') +
            (enRupture(l.cip) ? '<span class="pr-rupt">rupture ANSM</span>' : '') +
          '</div>' +
          '<div class="pr-arg">' +
            '<strong>' + num(l.officines) + ' officines</strong> ne nous le prennent pas' +
            (g ? ' · ' + esc(g) : '') +
          '</div>' +
        '</div>' +
        '<div class="pr-chiffres">' +
          '<div class="pr-pot"><span>' + eur(l.potentiel) + '</span><em>potentiel réseau</em></div>' +
          '<div class="pr-stk"><span>' + num(l.stock) + '</span><em>en stock</em></div>' +
          '<div class="pr-cv"><span>' + esc(couv) + '</span><em>couverture</em></div>' +
          '<div class="pr-net"><span>' + (f && f.net > 0 ? eur(f.net) : '—') + '</span><em>prix net</em></div>' +
        '</div>' +
      '</div>';
  }
```

Puis remplacer, dans `V2.pages.produits.render`, la ligne :

```js
        : '<div class="v2-empty"><div class="v2-empty-t">Vue achats en préparation</div></div>';
```

par :

```js
        : rendreAchats();
```

- [ ] **Step 3: Vérifier à l'écran**

Serveur local déjà lancé. Dans le navigateur piloté :
1. `#produits`, purge du service worker, rechargement ;
2. cliquer sur l'onglet **Achats** ;
3. `browser_resize` **390 × 844**, `browser_take_screenshot` → `verif-ecran/produits-achats-390.png` ;
4. `browser_resize` **1440 × 900**, `browser_take_screenshot` → `verif-ecran/produits-achats-1440.png` ;
5. `browser_console_messages` → aucune erreur.

Contrôles :
- le sélecteur liste les groupements d'achat avec leur nombre d'officines, le plus gros en premier (UPP · 73 officines) ;
- « Uniquement ce qu'on n'a pas » fait bien apparaître des lignes avec `0 en stock` et **change** la liste ;
- la couverture s'affiche en mois, ou `—` quand la demande est nulle ;
- basculer Vendeur ↔ Achats ne provoque aucune erreur console.

- [ ] **Step 4: Relancer toute la suite de tests**

```bash
cd /Users/williammorel/JARVIS/APP && node --test tests/
```

Attendu : tous les tests passent (`produits-moteur`, `produits-reel`, `rdv-creneaux`, `rdv-ics`, `rdv-modeles`) — la page ne doit rien avoir cassé du moteur.

- [ ] **Step 5: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/v2/v2-produits.js
git add verif-ecran/produits-achats-390.png
git add verif-ecran/produits-achats-1440.png
git status --short crm/v2/v2-produits.js
git commit -m "feat(produits): mode Achats — lecture par produit, couverture de stock, filtre par groupement d'achat"
```

---

## Task 6: PDF à laisser au pharmacien

**Files:**
- Modify: `crm/v2/v2-produits.js` (bouton + fonction d'impression)

**Interfaces:**
- Consumes: `rendreVendeur()`, `fiche()`, `S` (Tasks 4-5).
- Produces: `V2.produits.pdf()` — ouvre la fenêtre d'impression du navigateur sur une page dédiée.

**Contenu autorisé :** produit, prix net, disponibilité. **Interdit :** le barème d'abandon de marge et toute autre condition commerciale chiffrée. La colonne « abandon de marge » du mode Vendeur ne doit **pas** figurer dans le PDF.

**Choix technique :** impression navigateur (`window.print()` sur un document dédié), comme les posters biosimilaires du dépôt. Pas de librairie PDF : aucune dépendance, aucun coût, et le pharmacien reçoit un vrai A4.

- [ ] **Step 1: Ajouter le bouton dans le bandeau Vendeur**

Dans `rendreVendeur()`, dans le bloc `'<div class="pr-ctx">…'`, ajouter juste après le `<span class="pr-ctx-n">` :

```js
          '<button class="v2-btn v2-btn-primary pr-pdf" onclick="V2.produits.pdf()">' +
            'Sortir le PDF' +
          '</button>' +
```

- [ ] **Step 2: Écrire la génération**

Ajouter dans `crm/v2/v2-produits.js`, avant `V2.pages.produits` :

```js
  // ── PDF à laisser au pharmacien ────────────────────────────────
  // Impression navigateur sur un document dédié : aucune librairie, aucun
  // coût. CONTENU AUTORISÉ : produit, prix net, disponibilité. Le barème
  // d'abandon de marge et toute autre condition chiffrée en sont exclus.
  V2.produits.pdf = function () {
    var M = window.V2PRODUITS, idx = V2.produits.index();
    if (!M || !idx || !S.ph) { if (V2.toast) V2.toast('Choisis d\'abord une officine'); return; }

    var ph = null, phs = V2.pharmacies || [], i;
    for (i = 0; i < phs.length; i++) if (String(phs[i].id) === String(S.ph)) ph = phs[i];
    if (!ph) { if (V2.toast) V2.toast('Officine introuvable'); return; }

    var stock = (window.STOCK_IP && window.STOCK_IP.data) || {};
    var lignes = filtrer(M.listingOfficine(idx, S.ph, { stock: stock }).lignes).slice(0, 30);
    if (!lignes.length) { if (V2.toast) V2.toast('Aucun produit à imprimer'); return; }

    var rows = '';
    for (i = 0; i < lignes.length; i++) {
      var f = fiche(lignes[i].cip);
      rows += '<tr>' +
        '<td>' + esc(f && f.d ? f.d : ('CIP ' + lignes[i].cip)) + '</td>' +
        '<td class="n">' + esc(String(lignes[i].cip)) + '</td>' +
        '<td class="n">' + (f && f.net > 0 ? eur(f.net) : '—') + '</td>' +
        '<td class="n">' + (lignes[i].stock > 0 ? 'Disponible' : '—') + '</td>' +
      '</tr>';
    }

    var jour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    var html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
      '<title>Sélection produits — ' + esc(ph.name) + '</title><style>' +
      '@page{size:A4;margin:14mm}' +
      'body{font:12px/1.45 Inter,system-ui,sans-serif;color:#10131C;margin:0}' +
      'h1{font-size:19px;margin:0 0 2px;color:#0050E6}' +
      '.sub{color:#5A6478;font-size:12px;margin-bottom:14px}' +
      'table{width:100%;border-collapse:collapse}' +
      'th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5A6478;' +
      'border-bottom:1.5px solid #0050E6;padding:6px 4px}' +
      'td{padding:6px 4px;border-bottom:1px solid #E6E9F0}' +
      'td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}' +
      '.pied{margin-top:16px;font-size:10px;color:#8A93A6}' +
      '</style></head><body>' +
      '<h1>Sélection produits — ' + esc(ph.name) + '</h1>' +
      '<div class="sub">Établie le ' + esc(jour) + ' · Intégral Pharma</div>' +
      '<table><thead><tr><th>Produit</th><th class="n">CIP</th>' +
      '<th class="n">Prix net</th><th class="n">Disponibilité</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div class="pied">Disponibilités constatées au jour de l\'édition, sous réserve des stocks.</div>' +
      '</body></html>';

    var w = window.open('', '_blank');
    if (!w) { if (V2.toast) V2.toast('Autorise les fenêtres pour sortir le PDF'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 300);
  };
```

- [ ] **Step 3: Vérifier le PDF**

Dans le navigateur piloté :
1. `#produits`, choisir une officine, cliquer **Sortir le PDF** ;
2. `browser_tabs` pour passer sur le nouvel onglet ;
3. `browser_take_screenshot` → `verif-ecran/produits-pdf.png`.

Contrôles, ligne à ligne sur la capture :
- 4 colonnes seulement : Produit · CIP · Prix net · Disponibilité ;
- **aucune colonne d'abandon de marge, aucun pourcentage, aucun chiffre de condition commerciale** ;
- le nom de l'officine et la date sont en tête ;
- le bleu `#0050E6` est le seul accent.

- [ ] **Step 4: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/v2/v2-produits.js
git add verif-ecran/produits-pdf.png
git status --short crm/v2/v2-produits.js
git commit -m "feat(produits): PDF a laisser au pharmacien — produit, prix net, disponibilite"
```

---

## Task 7: Navigation — « Produits » devient l'entrée unique

**Files:**
- Modify: `crm/v2/v2-app.js` — tuiles d'accueil (~ligne 793-870), index ⌘K (~ligne 950-965), `ROUTE_ACCENT` (~ligne 272)

**Interfaces:**
- Consumes: `V2.pages.produits` (Task 4).
- Produces: aucune nouvelle interface — modification de configuration uniquement.

**Principe :** aucune suppression de fichier, aucune route cassée. `catalogue`, `molecules` et `appro` restent enregistrées et atteignables (⌘K + liens de bas de page déjà posés en Task 4) ; elles sortent seulement des **tuiles d'accueil**.

- [ ] **Step 1: Ajouter l'accent de route**

Dans `crm/v2/v2-app.js`, dans l'objet `ROUTE_ACCENT`, ajouter `produits` :

```js
    infos: 'var(--c-amber)', marketing: 'var(--c-rose)', audit: '#10915E', sagitta: 'var(--pil-froid)',
    produits: 'var(--ip-blue)'
```

- [ ] **Step 2: Poser la tuile Produits et retirer les trois autres**

Dans `V2.pages.home.render`, dans le tableau `P`, **remplacer** la tuile `catalogue` :

```js
        { k: 'catalogue', cls: 'p3', ico: 'cat', tag: (window.BENCHMARK ? V2.fmtNum(window.BENCHMARK.length) : '10 500'), t: 'Catalogue grossiste', d: 'Tout le catalogue médicaments IP par tranches de prix et familles AFMCODE, avec ton volume et le marché Ameli.', go: 'Explorer le catalogue' },
```

par :

```js
        { k: 'produits', cls: 'p3', ico: 'cat', tag: 'Par officine', t: 'Produits', d: 'Ce que les confrères du même groupement d\'achat prennent et pas cette officine — uniquement ce qu\'on a en stock, chiffré en € de potentiel. Et la même chose par produit pour les achats.', go: 'Ouvrir les produits' },
```

Puis **supprimer** les deux blocs `P.push` des tuiles `molecules` et `appro` (repérables par leurs commentaires `// Pilier Molécules…` et la ligne `P.push({ k: 'appro'…`). Ne pas toucher aux blocs `audit` et `missions` situés juste à côté.

- [ ] **Step 3: Ajouter Produits dans ⌘K et y laisser les anciens**

Dans `buildCmdkIndex`, après la ligne du pilier `molecules`, ajouter :

```js
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.produits) PAGES.splice(1, 0, ['produits', 'Produits · par officine et par groupement d\'achat', 'cat']);
```

Les entrées `molecules`, `catalogue` et `appro` restent dans ⌘K : c'est le chemin de secours.

- [ ] **Step 4: Vérifier à l'écran**

Dans le navigateur piloté :
1. purge du service worker, rechargement sur `#home` ;
2. `browser_resize` **390 × 844**, `browser_take_screenshot` → `verif-ecran/accueil-produits-390.png` ;
3. contrôler que la tuile **Produits** est présente, et que **Catalogue grossiste**, **Par molécule** et **Appro Intégral** ont disparu de l'accueil ;
4. ouvrir ⌘K, taper « appro » → l'entrée existe toujours et y mène ;
5. depuis l'écran Produits, cliquer les trois liens de bas de page : chacun ouvre son ancien écran sans erreur.

- [ ] **Step 5: Commit**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/v2/v2-app.js
git add verif-ecran/accueil-produits-390.png
git status --short crm/v2/v2-app.js
git commit -m "feat(produits): Produits devient l'entree unique de l'accueil, anciens ecrans gardes en secours"
```

---

## Task 8: Cache-busting, contrôle GO/NO-GO et mise en ligne

**Files:**
- Modify: `crm/v2/index.html` (tous les `?v=`), `crm/v2/sw.js` (`var VER`), `crm/v2/v2-boot.js` (`var V = '?v='`)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: la version en ligne.

**Le piège n°1 du dépôt :** trois jetons indépendants. Si un seul reste en arrière, la page en ligne *est* à jour mais **personne ne la voit**.

- [ ] **Step 1: Monter les trois jetons**

```bash
cd /Users/williammorel/JARVIS/APP
sed -i '' 's/?v=20260810a/?v=20260811a/g' crm/v2/index.html
sed -i '' "s/^var VER = '20260810a';/var VER = '20260811a';/" crm/v2/sw.js
sed -i '' "s/var V = '?v=20260810a';/var V = '?v=20260811a';/" crm/v2/v2-boot.js
```

- [ ] **Step 2: Vérifier qu'ils sont bien alignés**

```bash
cd /Users/williammorel/JARVIS/APP
grep -o '?v=[0-9a-z]*' crm/v2/index.html | sort -u
grep -n "^var VER" crm/v2/sw.js
grep -n "var V = '?v=" crm/v2/v2-boot.js
```

Attendu : `?v=20260811a` **et rien d'autre** sur la première commande ; `20260811a` sur les deux autres.

- [ ] **Step 3: Relancer toute la suite de tests**

```bash
cd /Users/williammorel/JARVIS/APP && node --test tests/
```

Attendu : 0 fail.

- [ ] **Step 4: Contrôle GO/NO-GO**

Lancer le sous-agent `gardien-deploiement` sur les fichiers touchés par ce lot :
`crm/v2/v2-produits-moteur.js`, `crm/v2/v2-produits.js`, `crm/v2/v2-app.js`, `crm/v2/index.html`, `crm/v2/sw.js`, `crm/v2/v2-boot.js`, `tests/produits-moteur.test.mjs`, `tests/produits-reel.test.mjs`.

**Verdict NO-GO = on ne pousse pas.** Corriger, puis relancer le contrôle.

- [ ] **Step 5: Commit et mise en ligne**

```bash
cd /Users/williammorel/JARVIS/APP
git add crm/v2/index.html
git add crm/v2/sw.js
git add crm/v2/v2-boot.js
git status --short crm/v2/index.html crm/v2/sw.js crm/v2/v2-boot.js
git commit -m "chore(produits): jeton de cache 20260811a sur les trois emplacements"
git push origin feature/rdv-mailing
```

- [ ] **Step 6: Prouver que c'est vraiment en ligne**

Ne **jamais** annoncer la mise en ligne sur la foi d'un `git push` réussi.

```bash
cd /Users/williammorel/JARVIS/APP
# 1. le commit est bien sur le distant
git log origin/feature/rdv-mailing --oneline -1
# 2. attendre la publication puis lire la page RÉELLEMENT servie
bash scripts/attendre-prod.sh 2>/dev/null || sleep 60
curl -s https://willmorel49-coder.github.io/jarvis-app/crm/v2/index.html | grep -o '?v=[0-9a-z]*' | sort -u
```

Attendu sur la dernière commande : `?v=20260811a`. Tant que c'est `20260810a`, **ce n'est pas en ligne**.

Puis capture finale de la page servie (pas du serveur local) : `browser_navigate` vers `https://willmorel49-coder.github.io/jarvis-app/crm/v2/#produits`, purge du service worker, rechargement, `browser_resize` 390 × 844, `browser_take_screenshot` → `verif-ecran/produits-prod-390.png`.

- [ ] **Step 7: Commit de la preuve**

```bash
cd /Users/williammorel/JARVIS/APP
git add verif-ecran/produits-prod-390.png
git commit -m "chore(produits): capture de la page servie en ligne"
git push origin feature/rdv-mailing
```

---

## Ce que ce lot ne fait pas

Reporté au **lot 2**, hors périmètre de ce plan :

- sélection de lignes avec quantités → proposition / mail pré-rédigé ;
- enregistrement de la liste dans la fiche officine (« proposée le JJ/MM ») et mesure de ce qui a été suivi d'effet à la visite suivante.

Également hors périmètre, et assumé dans la spec : aucune commande transmise à l'ERP, aucune comparaison aux prix concurrents (ça reste le pilier Offilog), aucune prévision de vente.

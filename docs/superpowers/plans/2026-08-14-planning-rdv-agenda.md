# Planning RDV depuis l'agenda — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire apparaître dans JARVIS les rendez-vous pharmacie que le commercial a notés dans son agenda personnel, lui laisser corriger les rattachements ratés, et lui proposer sur chaque journée vide une liste d'officines à qui envoyer son lien de prise de RDV.

**Architecture:** L'Edge Function `agenda` gagne une action qui renvoie les **titres** au seul propriétaire de l'agenda, sans rien écrire en base. Un module navigateur pur (`v2-rdv-reco.js`) apparie un titre à une officine — c'est la seule brique testable hors navigateur, et elle concentre tout le risque. Une table `rdv_agenda_alias` mémorise les corrections validées à la main. L'écran `rdvplanning` existant est étendu de 15 jours à 4 semaines et affiche les noms d'officine ; une journée vide renvoie vers l'écran Campagne déjà en place, avec sa liste pré-remplie.

**Tech Stack:** JavaScript navigateur sans build (IIFE, `var`, pas de framework) · Supabase (PostgREST + Edge Functions Deno + `ical.js`) · tests `node:test` · production GitHub Pages servie depuis `main`.

**Spec:** `docs/superpowers/specs/2026-08-14-planning-rdv-agenda-design.md`

## Global Constraints

- **Aucun titre d'événement n'est écrit en base**, sauf un titre que l'utilisateur a lui-même désigné comme officine (table `rdv_agenda_alias`). Aucune colonne de titre n'est ajoutée à `rdv_occupe` ni à `rdv`.
- **Un RDV reconnu dans l'agenda ne crée PAS de ligne dans `rdv`.** La table `rdv` reste réservée aux rendez-vous pris dans JARVIS.
- **L'agenda Google n'est jamais modifié.** Aucune écriture sortante, dans aucun sens.
- **Toute nouvelle table reçoit un `grant` explicite en plus de la RLS.** Une policy sans `grant` donne un `42501 permission denied` que rien n'explique — piège déjà payé sur ce projet.
- **Aucune suppression de données : colonne `archive`, jamais de `DELETE`.** Le hook `garde-donnees.py` bloque les suppressions.
- **Interdits CSS (le Mac de Will plante sous Safari) :** `background-clip:text` sur du grand texte, `backdrop-filter`, `filter:blur` sur une grande surface, plus d'une `<video autoplay>` par page. Repli `@media (prefers-reduced-motion: reduce)` obligatoire sur toute animation.
- **Cibles tactiles ≥ 44 px, champs de saisie ≥ 16 px** (sous 16 px, iOS zoome tout seul). Vérification à **390 px** avant toute annonce.
- **Français simple à l'écran.** Vocabulaire pharma imposé : on dit « abandon de marge » (CLAUDE.md §8 et skill `pharma-metier`). Aucune condition commerciale chiffrée dans un livrable.
- **Git : ajouter les fichiers un par un.** `git add -A` / `.` sont bloqués par le hook `garde-git.py`. Contrôler `git status --short` après avoir indexé.
- **Travailler dans le worktree** `scratchpad/jarvis-main`, branche `claude/planning-rdv`. Ne jamais faire `git checkout main` dans `~/JARVIS/APP` (204 fichiers modifiés non commités y dorment).
- Commande de test : `node --test tests/*.test.mjs` — **jamais** `node --test tests/`, qui cherche un module nommé « tests ».

---

## Structure des fichiers

| Fichier | Responsabilité | Créé / modifié |
|---|---|---|
| `crm/v2/v2-rdv-reco.js` | apparier un titre d'agenda à une officine. Fonctions pures, aucune dépendance au DOM ni au réseau. | créer |
| `tests/rdv-reco.test.mjs` | les cas réels mesurés le 14/08/2026, faux positifs compris | créer |
| `supabase/functions/agenda/index.ts` | action `mes_evenements` : rend les titres au propriétaire | modifier |
| `docs/supabase/rdv-agenda-alias.sql` | table des rattachements validés + droits | créer |
| `crm/v2/v2-rdv-alias.js` | lire / écrire / archiver un alias depuis le navigateur | créer |
| `crm/v2/v2-rdv-planning.js` | l'écran : 4 semaines, noms d'officine, correction, renvoi vers Campagne | modifier |
| `crm/v2/index.html`, `crm/v2/sw.js` | chargement des nouveaux scripts + cache-busting | modifier |

---

### Task 1 : le module de reconnaissance

C'est la brique qui porte tout le risque : elle décide qu'un titre désigne une officine. Elle est écrite en premier, seule, et testée hors navigateur.

**Files:**
- Create: `crm/v2/v2-rdv-reco.js`
- Test: `tests/rdv-reco.test.mjs`

**Interfaces:**
- Consumes: rien (module autonome)
- Produces:
  - `V2RECO.normaliser(texte) -> string` — majuscules, sans accents ni ponctuation, espaces réduits
  - `V2RECO.distinctif(nomOfficine) -> string` — le nom sans « PHARMACIE » ni mots vides
  - `V2RECO.segment(titre) -> { texte: string, marqueur: boolean }` — le morceau qui nomme une officine
  - `V2RECO.cleAlias(titre) -> string` — la clé de rattachement, insensible au verbe d'action
  - `V2RECO.indexer(officines) -> Index` — `officines` = `[{ id, name, ville }]`
  - `V2RECO.apparier(titre, indexPortefeuille, indexNational, alias) -> { officine, score, candidats, source, etat }` avec `etat` ∈ `'reconnu' | 'confirmer' | 'ignore'` et `source` ∈ `'alias' | 'portefeuille' | 'annuaire' | null`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/rdv-reco.test.mjs` :

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const R = require('../crm/v2/v2-rdv-reco.js');

// Un extrait representatif du portefeuille et de l'annuaire, tire des vraies
// donnees. « Pharmacie HA » est la pour une raison precise : son nom
// distinctif fait deux lettres, et une version naive la trouvait dans
// « Verif mounjaro commande OmaHA beach ».
const PORTEFEUILLE = [
  { id: '2000001', name: 'Pharmacie HA', ville: 'ANCENIS' },
  { id: '2000002', name: 'Pharmacie ALBIOL', ville: 'ANGERS' },
  { id: '2000003', name: 'PHARMACIE DU JARDIN DES PLANTES', ville: 'ANGERS' },
  { id: '2000004', name: 'PHARMACIE DE LA DOUTRE', ville: 'ANGERS' },
  { id: '2000005', name: 'Pharmacie GODARD', ville: 'CHOLET' },
  { id: '2000006', name: 'PHARMACIE DE PARIS - LA BAULE', ville: 'LA BAULE' },
];
const NATIONAL = [
  { id: '2100001', name: 'PHARMACIE DESCARTES', ville: 'CHOLET' },
  { id: '2100002', name: 'PHARMACIE DE GETIGNE', ville: 'GETIGNE' },
  { id: '2100003', name: 'PHARMACIE DES MAUGES', ville: 'BEAUPREAU' },
  { id: '2100004', name: 'PHARMACIE ALEXANDRE PREISS', ville: 'STRASBOURG' },
  { id: '2100005', name: 'PHARMACIE DE LA BANQUE', ville: 'TOULON' },
  { id: '2100006', name: 'PHARMACIE CAEN', ville: 'CAEN' },
  { id: '2100007', name: 'PHARMACIE DE LA PAULINE', ville: 'LA VALETTE' },
  { id: '2100008', name: 'PHARMACIE DE VILLEURBANNE (JBS)', ville: 'VILLEURBANNE' },
];

const IP = R.indexer(PORTEFEUILLE);
const IN = R.indexer(NATIONAL);
const app = (titre, alias) => R.apparier(titre, IP, IN, alias || {});

test('normaliser : accents, ponctuation, casse', () => {
  assert.equal(R.normaliser('Phie de l’Église'), 'PHIE DE L EGLISE');
});

test('distinctif : retire PHARMACIE et les mots vides', () => {
  assert.equal(R.distinctif('PHARMACIE DE LA DOUTRE'), 'DOUTRE');
  assert.equal(R.distinctif('PHARMACIE DE PARIS - LA BAULE'), 'PARIS BAULE');
});

test('segment : retire le verbe d’action et garde ce qui suit le marqueur', () => {
  assert.deepEqual(R.segment('Appeler phie Godard'), { texte: 'GODARD', marqueur: true });
  assert.deepEqual(R.segment('Passer voir phie d’andard'), { texte: 'D ANDARD', marqueur: true });
});

test('segment : le contenu des parentheses est un contact, pas un nom', () => {
  assert.equal(R.segment('Phie des câlins (Charlotte)').texte, 'DES CALINS');
});

test('segment : sans marqueur, le drapeau est faux', () => {
  assert.equal(R.segment('Reunion equipe').marqueur, false);
});

test('reconnu : le cas simple', () => {
  const r = app('Pharmacie Godard');
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.officine.id, '2000005');
  assert.equal(r.source, 'portefeuille');
});

test('reconnu : abrege, avec un verbe devant', () => {
  const r = app('Appeler phie albiol');
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.officine.id, '2000002');
});

test('reconnu : va chercher dans l’annuaire national quand le marqueur est la', () => {
  const r = app('Phie de getigne');
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.officine.id, '2100002');
  assert.equal(r.source, 'annuaire');
});

test('reconnu : un nom distinctif de deux lettres, quand il EST tout le segment', () => {
  const r = app('Phie ha');
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.officine.id, '2000001');
});

// ─── Les faux positifs mesures le 14/08/2026. Chacun a ete produit par une
// version naive ; ils sont ici pour qu’aucun ne revienne.
test('faux positif : un nom court ne se trouve pas au milieu d’un autre mot', () => {
  assert.equal(app('Verif mounjaro commande Omaha beach').etat, 'ignore');
});

test('faux positif : « André » n’est pas « ALEXANDRE PREISS »', () => {
  assert.equal(app('André').etat, 'ignore');
});

test('faux positif : sans le mot pharmacie, l’annuaire national reste ferme', () => {
  assert.equal(app('Caen').etat, 'ignore');
  assert.equal(app('PAULINE').etat, 'ignore');
  assert.equal(app('RDV BANQUE').etat, 'ignore');
  assert.equal(app('JB').etat, 'ignore');
});

test('faux positif : un mot du metier n’est pas une officine', () => {
  assert.equal(app('Congrès pharmacien Nantes').etat, 'ignore');
});

test('alias : un titre corrige a la main est reconnu directement', () => {
  const brut = 'Aller phie des javobins Le Mans';
  assert.equal(app(brut).etat, 'ignore');
  const alias = {};
  alias[R.cleAlias(brut)] = '2000003';
  const r = app(brut, alias);
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.source, 'alias');
  assert.equal(r.officine.id, '2000003');
});

test('alias : la cle ignore le verbe d’action et la casse', () => {
  assert.equal(R.cleAlias('Appeler phie du lys'), R.cleAlias('Phie du lys'));
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/rdv-reco.test.mjs`
Expected: FAIL — `Cannot find module '../crm/v2/v2-rdv-reco.js'`

- [ ] **Step 3: Écrire le module**

Créer `crm/v2/v2-rdv-reco.js`. Le fichier suit le double export du projet (navigateur *et* node), comme `v2-rdv-creneaux.js`.

```javascript
/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Reconnaître une officine dans un titre d'agenda

   Ce module ne touche ni au DOM ni au réseau : on lui donne un titre et
   deux index d'officines, il rend une officine ou rien. C'est ce qui
   permet de le tester sur les vrais titres, hors navigateur.

   Mesuré le 14/08/2026 sur l'agenda réel de William Morel : 531
   événements, 463 titres distincts, 173 contenant « pharmacie / phie ».
   Sur ces 173 : 55 % reconnus tout seuls, 32 % à confirmer, 13 % ratés,
   et zéro fausse reconnaissance.

   Les deux verrous qui donnent ce zéro, chacun né d'une faute observée :

   1. FRONTIÈRE DE MOT. Sans elle, « Pharmacie HA » se trouvait dans
      « Verif mounjaro commande OmaHA beach », et « André » dans
      « ALEXANDRE PREISS ». Un nom distinctif de 3 caractères ou moins
      ne vaut donc que s'il EST tout le segment.

   2. PAS D'ANNUAIRE NATIONAL SANS LE MOT « PHARMACIE ». Avec 19 667
      noms, n'importe quel mot courant trouve une homonyme : « Caen »,
      « Marseille », « PAULINE », « RDV BANQUE » étaient toutes
      reconnues. Un titre sans marqueur n'est accepté que s'il désigne
      exactement une officine du portefeuille — celles que le commercial
      connaît assez pour les écrire en raccourci.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  var SEUIL_RECONNU = 0.85;
  var SEUIL_CONFIRMER = 0.60;

  // Ce que le commercial écrit AUTOUR du nom.
  var VERBES = /^(APPELER|APPELLE|APPELE|APPEL|CALL|RAPPELER|REPASSER VOIR|RETOURNER VOIR|PASSER VOIR|PASSER|ALLER VOIR|ALLEZ VOIR|ALLEZ|ALLER|VOIR|RDV AVEC|RDV|PRISE DE RDV A FAIRE AVEC|PRISE DE RDV AVEC|PRISE DE RDV|PRISE RDV|PRENDRE RDV AVEC|PRENDRE RDV|A FAIRE|RELANCER|RELANCE|VERIF|VERIFIER|POUR)\s+/;
  var MARQUEUR = /\b(PHARMACIE|PHIE|PHCIE)\b/;
  var COMMENTAIRE = /\b(POUR|AVEC|PROBLEME|COMMANDE|LIVRAISON|PRESENTATION|BILAN|SMS|MR|MME|DR)\b/;
  var MOTS_VIDES = { DE: 1, DU: 1, DES: 1, LA: 1, LE: 1, LES: 1, L: 1, D: 1,
                     ET: 1, AU: 1, AUX: 1, A: 1, SUR: 1 };
  // Des mots qui prouvent que le titre parle du métier, pas d'une officine.
  var PAS_UNE_OFFICINE = { CONGRES: 1, PHARMAGORA: 1, REUNION: 1, SALON: 1,
                           FORMATION: 1, PHARMACIEN: 1, PHARMACIENS: 1,
                           TEAMS: 1, VISIO: 1, SEMINAIRE: 1 };

  var ACCENTS = 'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ';
  var SANS    = 'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyy';

  M.normaliser = function (texte) {
    var s = String(texte == null ? '' : texte);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var k = ACCENTS.indexOf(s.charAt(i));
      out += (k === -1) ? s.charAt(i) : SANS.charAt(k);
    }
    out = out.toUpperCase().replace(/\bPH\./g, ' PHARMACIE ');
    return out.replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  };

  M.distinctif = function (nom) {
    var n = M.normaliser(nom).replace(MARQUEUR, ' ');
    return n.split(' ').filter(function (m) { return m && !MOTS_VIDES[m]; }).join(' ');
  };

  M.segment = function (titre) {
    var t = M.normaliser(String(titre == null ? '' : titre).replace(/\([^)]*\)/g, ' '));
    for (var i = 0; i < 3; i++) {                 // « Allez voir phie… » cumule
      var apres = t.replace(VERBES, '');
      if (apres === t) break;
      t = apres;
    }
    var m = MARQUEUR.exec(t);
    if (!m) return { texte: t, marqueur: false };
    var reste = t.slice(m.index + m[0].length).trim();
    var c = COMMENTAIRE.exec(reste);
    if (c) reste = reste.slice(0, c.index).trim();
    return { texte: reste, marqueur: true };
  };

  // La clé d'alias doit être la même pour « Appeler phie du lys » et
  // « Phie du lys » : c'est le segment, pas le titre brut.
  M.cleAlias = function (titre) { return M.segment(titre).texte; };

  M.indexer = function (officines) {
    var out = [];
    for (var i = 0; i < (officines || []).length; i++) {
      var o = officines[i];
      if (!o || !o.name) continue;
      var d = M.distinctif(o.name);
      if (!d) continue;
      var j = {}, mm = d.split(' ');
      for (var k = 0; k < mm.length; k++) j[mm[k]] = 1;
      out.push({ o: o, dist: d, jetons: j, nbJetons: mm.length,
                 ville: M.normaliser(o.ville || '') });
    }
    return out;
  };

  // Similarité de deux chaînes : part des bigrammes communs. Suffisant ici,
  // et sans dépendance — le projet n'a pas d'étape de build.
  function similarite(a, b) {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    var pa = {}, n = 0, i, g;
    for (i = 0; i < a.length - 1; i++) { g = a.substr(i, 2); pa[g] = (pa[g] || 0) + 1; }
    for (i = 0; i < b.length - 1; i++) {
      g = b.substr(i, 2);
      if (pa[g] > 0) { pa[g]--; n++; }
    }
    return (2 * n) / (a.length - 1 + b.length - 1);
  }

  function chercher(seg, marqueur, index) {
    var vide = { officine: null, score: 0, candidats: 0, dist: '' };
    if (!seg) return vide;
    var js = seg.split(' ').filter(function (m) { return m && !MOTS_VIDES[m]; });
    if (!js.length) return vide;
    for (var z = 0; z < js.length; z++) if (PAS_UNE_OFFICINE[js[z]]) return vide;

    var enveloppe = ' ' + seg + ' ';
    var trouves = [];
    for (var i = 0; i < index.length; i++) {
      var e = index[i];
      // ⚠️ FRONTIÈRE DE MOT : on cherche « HA » entouré d'espaces, jamais
      // la sous-chaîne « HA » qui se cache dans « OMAHA ».
      var contenu = enveloppe.indexOf(' ' + e.dist + ' ') !== -1;
      var communs = 0, seul = null;
      for (var k = 0; k < js.length; k++) if (e.jetons[js[k]]) { communs++; seul = js[k]; }
      if (!contenu && !communs) continue;
      // Un nom distinctif très court ne vaut que s'il est tout le segment.
      if (e.dist.length <= 3 && seg !== e.dist) continue;
      // Un seul mot commun, et il est banal : pas assez pour désigner.
      if (!contenu && communs === 1 && seul && seul.length <= 4) continue;

      var ratio = similarite(seg, e.dist);
      var recouvre = communs / Math.max(1, Math.min(js.length, e.nbJetons));
      var score = Math.max(ratio, 0.7 * recouvre + 0.3 * ratio);
      if (contenu) score = Math.max(score, 0.88);
      if (seg === e.dist) score = 1;
      if (e.ville && enveloppe.indexOf(' ' + e.ville + ' ') !== -1) score = Math.min(1, score + 0.12);
      if (!marqueur) score -= 0.10;
      trouves.push({ s: score, o: e.o, dist: e.dist });
    }
    if (!trouves.length) return vide;
    trouves.sort(function (a, b) { return b.s - a.s; });
    var haut = trouves[0].s, proches = 0;
    for (var p = 0; p < trouves.length; p++) if (trouves[p].s >= haut - 0.04) proches++;
    return { officine: trouves[0].o, score: haut, candidats: proches, dist: trouves[0].dist };
  }

  function parId(index, id) {
    for (var i = 0; i < index.length; i++) if (String(index[i].o.id) === String(id)) return index[i].o;
    return null;
  }

  M.apparier = function (titre, indexPortefeuille, indexNational, alias) {
    var rien = { officine: null, score: 0, candidats: 0, source: null, etat: 'ignore' };
    var seg = M.segment(titre);
    if (!seg.texte) return rien;

    // 1. Un rattachement déjà validé à la main gagne toujours.
    var cip = (alias || {})[seg.texte];
    if (cip) {
      var o = parId(indexPortefeuille, cip) || parId(indexNational, cip);
      if (o) return { officine: o, score: 1, candidats: 1, source: 'alias', etat: 'reconnu' };
    }

    // 2. Le portefeuille d'abord : ce sont ses clients.
    var p = chercher(seg.texte, seg.marqueur, indexPortefeuille);
    var meilleur = { r: p, source: 'portefeuille' };

    if (!seg.marqueur) {
      // ⚠️ Sans le mot « pharmacie », l'annuaire national reste fermé et le
      // portefeuille n'est accepté que sur une correspondance exacte.
      if (!(p.officine && (seg.texte === p.dist || p.score >= 0.95))) return rien;
    } else if (!p.officine || p.score < 0.80) {
      var n = chercher(seg.texte, seg.marqueur, indexNational);
      if (n.officine && n.score > p.score) meilleur = { r: n, source: 'annuaire' };
    }

    var r = meilleur.r;
    if (!r.officine) return rien;
    var etat = (r.score >= SEUIL_RECONNU && r.candidats === 1) ? 'reconnu'
             : (r.score >= SEUIL_CONFIRMER ? 'confirmer' : 'ignore');
    if (etat === 'ignore') return rien;
    return { officine: r.officine, score: r.score, candidats: r.candidats,
             source: meilleur.source, etat: etat };
  };

  M._SEUIL_RECONNU = SEUIL_RECONNU;
  M._SEUIL_CONFIRMER = SEUIL_CONFIRMER;

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2RECO = M;
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Lancer les tests jusqu'au vert**

Run: `node --test tests/rdv-reco.test.mjs`
Expected: PASS sur les 15 tests.

Si un test échoue, corriger le **module**, jamais le test : les faux positifs listés viennent d'une mesure réelle, ils ne sont pas négociables.

- [ ] **Step 5: Rejouer la mesure sur les 463 vrais titres**

Le flux iCal déjà téléchargé et le prototype Python sont dans le scratchpad de la session de conception (`agenda-will.ics`, `mesure_reco2.py`). Vérifier que le portage JavaScript retrouve les mêmes chiffres :

```bash
node -e '
const R = require("./crm/v2/v2-rdv-reco.js");
const fs = require("fs");
const ics = fs.readFileSync(process.argv[1], "utf8").replace(/\r\n/g, "\n");
const titres = new Set();
ics.split("\n").forEach(function (l) {
  if (l.indexOf("SUMMARY:") === 0) titres.add(l.slice(8).trim());
});
console.log("titres distincts", titres.size);
' <chemin_scratchpad>/agenda-will.ics
```

Attendu : `titres distincts 463`. Puis brancher `R.apparier` sur les vrais index (`WML_OFFICINES` et `PHARMA_FR`, chargés avec `require` après avoir ajouté un export temporaire, ou lus au parseur JSON) et vérifier l'ordre de grandeur : **~95 reconnus, ~56 à confirmer, 0 faux positif parmi les reconnus**. Un écart de plus de 10 % sur les reconnus veut dire que le portage a dérivé du prototype — corriger avant de continuer.

- [ ] **Step 6: Commit**

```bash
git add crm/v2/v2-rdv-reco.js
git add tests/rdv-reco.test.mjs
git status --short
git commit -m "feat(rdv): reconnaitre une officine dans un titre d'agenda

Module pur, teste hors navigateur sur les cas reels du 14/08/2026.
Deux verrous contre les fausses reconnaissances : frontiere de mot
(« HA » ne se trouve plus dans « OmaHA »), et annuaire national ferme
tant que le titre ne contient pas le mot « pharmacie » (sans quoi
« Caen », « PAULINE », « RDV BANQUE » devenaient des officines).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2 : l'Edge Function rend les titres à leur propriétaire

**Files:**
- Modify: `supabase/functions/agenda/index.ts`

**Interfaces:**
- Consumes: `commercialConnecte(req)`, `telecharger(url)`, `admin()`, le type `Plage` — tous déjà dans le fichier
- Produces: action `mes_evenements` → `{ ok: true, lus: number, evenements: [{ date, debut, fin, jour_entier, titre }] }`

- [ ] **Step 1: Ajouter la fonction qui garde les titres**

Dans `supabase/functions/agenda/index.ts`, juste après `plagesOccupees` (elle se termine par `return { lus, plages }`), ajouter :

```typescript
type Evenement = Plage & { titre: string }

/**
 * Comme plagesOccupees, mais garde le titre — et UNIQUEMENT pour le renvoyer
 * au propriétaire de l'agenda, dans sa réponse HTTP. Rien n'est écrit en base :
 * il n'existe toujours aucune colonne pour ranger un titre.
 *
 * Fenêtre différente de la relève : on regarde aussi le PASSÉ, parce que la
 * date de dernière visite d'une officine ne se trouve nulle part ailleurs.
 */
function evenementsAvecTitre(ics: string, joursAvant: number, joursApres: number) {
  const cal = new ICAL.Component(ICAL.parse(ics))
  const debut = ICAL.Time.now()
  debut.addDuration(ICAL.Duration.fromSeconds(-joursAvant * 86400))
  const fin = ICAL.Time.now()
  fin.addDuration(ICAL.Duration.fromSeconds(joursApres * 86400))

  const evenements: Evenement[] = []
  let lus = 0

  for (const vevent of cal.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(vevent)
    lus++
    if (String(vevent.getFirstPropertyValue('status') || '') === 'CANCELLED') continue
    const titre = String(vevent.getFirstPropertyValue('summary') || '').trim()
    if (!titre) continue

    const pousser = (d: ICAL.Time, f: ICAL.Time) => {
      const dj = d.toJSDate(), fj = f.toJSDate()
      evenements.push({
        date: d.toString().slice(0, 10),
        debut: d.isDate ? '00:00' : dj.toTimeString().slice(0, 5),
        fin: d.isDate ? '23:59' : fj.toTimeString().slice(0, 5),
        jour_entier: !!d.isDate,
        titre: titre.slice(0, 200),
      })
    }

    if (ev.isRecurring()) {
      const it = ev.iterator()
      let occ, garde = 0
      while ((occ = it.next()) && garde++ < 500) {
        if (occ.compare(fin) > 0) break
        if (occ.compare(debut) < 0) continue
        const det = ev.getOccurrenceDetails(occ)
        pousser(det.startDate, det.endDate)
      }
    } else {
      if (ev.endDate.compare(debut) < 0) continue
      if (ev.startDate.compare(fin) > 0) continue
      pousser(ev.startDate, ev.endDate)
    }
  }
  return { lus, evenements }
}
```

- [ ] **Step 2: Router la nouvelle action**

Toujours dans `index.ts`, juste après la ligne `if (action === 'relever_moi') return reponse(await relever(userId, false, 5 * 60 * 1000))`, insérer :

```typescript
  // ─── Le commercial ouvre son planning : il veut voir le NOM des officines
  // qu'il a notées dans son agenda. Les titres partent dans cette réponse et
  // nulle part ailleurs — aucune écriture en base, aucune colonne pour eux.
  //
  // Réservé au propriétaire : `userId` vient du jeton de session, jamais d'un
  // paramètre d'appel. Personne ne peut demander l'agenda d'un collègue.
  if (action === 'mes_evenements') {
    const db = admin()
    const { data: a } = await db.from('rdv_agenda')
      .select('url, actif').eq('user_id', userId).maybeSingle()
    if (!a || !a.actif) return reponse({ ok: false, raison: 'pas_d_agenda' })
    const t = await telecharger(a.url)
    if ('erreur' in t) return reponse({ ok: false, raison: t.erreur })
    // 400 jours en arrière : de quoi dire « vue il y a 8 mois » sur une
    // officine. 60 jours en avant : au-delà, le planning n'affiche rien.
    const { lus, evenements } = evenementsAvecTitre(t.ics, 400, 60)
    return reponse({ ok: true, lus, evenements })
  }
```

- [ ] **Step 3: Vérifier que la fonction compile**

Run: `deno check supabase/functions/agenda/index.ts`
Expected: aucune erreur. Si `deno` n'est pas installé, relire à la main que `Evenement`, `Plage` et `ICAL` sont bien ceux du fichier — il n'y a pas d'autre étape de compilation dans ce projet.

- [ ] **Step 4: Déployer la fonction et l'essayer**

```bash
npx supabase functions deploy agenda --project-ref iyvavhnlhxksokkerkos
```

Puis, avec un jeton de session valide (celui d'un commercial connecté, lisible dans le stockage local du navigateur) :

```bash
curl -s -X POST "https://iyvavhnlhxksokkerkos.supabase.co/functions/v1/agenda" \
  -H "Authorization: Bearer <jeton_de_session>" \
  -H "Content-Type: application/json" \
  -d '{"action":"mes_evenements"}' | head -c 600
```

Expected: `{"ok":true,"lus":<plusieurs centaines>,"evenements":[{"date":"…","titre":"…"}…]}`

⚠️ Google rationne la lecture du flux et répond 429 au-delà de quelques lectures rapprochées. Ne pas boucler sur cet essai : une fois suffit, et un refus est passager.

Contrôle obligatoire ensuite — **la promesse « rien n'est stocké » se vérifie, elle ne se suppose pas** :

```bash
curl -s "https://iyvavhnlhxksokkerkos.supabase.co/rest/v1/rdv_occupe?select=*&limit=1" \
  -H "apikey: <cle_service>" -H "Authorization: Bearer <cle_service>"
```

Expected: les colonnes `id, user_id, date, debut, fin, jour_entier, releve_le` et rien d'autre.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/agenda/index.ts
git status --short
git commit -m "feat(agenda): action mes_evenements, les titres au seul proprietaire

Renvoie les titres dans la reponse HTTP du commercial connecte, sans
aucune ecriture en base. Fenetre 400 jours en arriere / 60 en avant :
le passe sert a dater la derniere visite d'une officine.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3 : la table des rattachements validés

**Files:**
- Create: `docs/supabase/rdv-agenda-alias.sql`
- Create: `crm/v2/v2-rdv-alias.js`

**Interfaces:**
- Consumes: `V2RECO.cleAlias(titre)` (Task 1), `V2.sb()`, `V2.user.id`
- Produces:
  - `V2.rdvAlias.charger() -> Promise<{ [cle]: cip }>`
  - `V2.rdvAlias.poser(titre, cip) -> Promise<boolean>`
  - `V2.rdvAlias.retirer(titre) -> Promise<boolean>`

- [ ] **Step 1: Écrire le SQL**

Créer `docs/supabase/rdv-agenda-alias.sql` :

```sql
-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Rattachements validés à la main (14/08/2026)
--
-- Le commercial écrit dans son agenda « Phie des javobins Le Mans » ;
-- le fichier dit « PHARMACIE DES JACOBINS ». JARVIS ne peut pas deviner.
-- Il lui demande une fois, et retient la correspondance ici.
--
-- ⚠️ Ce qui entre dans cette table : UNIQUEMENT un titre que le commercial
-- a lui-même désigné comme une officine. Les titres qu'il n'a pas
-- rattachés — médecin, famille, réunion — ne sont écrits nulle part.
-- C'est la seule exception à la règle « aucun titre en base », et elle
-- est consentie ligne par ligne.
--
-- La clé est le SEGMENT normalisé, pas le titre brut : « Appeler phie du
-- lys » et « Phie du lys » donnent tous deux « DU LYS » et se
-- reconnaissent l'un l'autre.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rdv_agenda_alias (
  id        bigserial primary key,
  user_id   uuid not null references auth.users(id) on delete restrict,
  cle       text not null,
  cip       text not null,
  archive   boolean not null default false,
  cree_le   timestamptz not null default now(),
  constraint rdv_alias_cle_len check (char_length(cle) between 1 and 200),
  constraint rdv_alias_cip_len check (char_length(cip) between 1 and 20)
);

-- Un seul rattachement vivant par clé et par commercial. Reposer le même
-- rattachement met à jour au lieu de dupliquer.
create unique index if not exists rdv_alias_unique
  on public.rdv_agenda_alias (user_id, cle) where (archive = false);

alter table public.rdv_agenda_alias enable row level security;

-- ⚠️ Une policy RLS SANS grant ne sert à rien : PostgREST répond 403 et
-- l'app bascule en silence sur un repli. Piège déjà payé sur ce projet.
revoke all on public.rdv_agenda_alias from anon, authenticated;
grant select, insert, update on public.rdv_agenda_alias to authenticated;
grant usage, select on sequence public.rdv_agenda_alias_id_seq to authenticated;

drop policy if exists rdv_alias_sien on public.rdv_agenda_alias;
create policy rdv_alias_sien on public.rdv_agenda_alias
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ⚠️ Pas de DELETE accordé : défaire un rattachement l'archive. Le hook
-- garde-donnees.py bloque les suppressions sur les tables de production.
```

- [ ] **Step 2: Appliquer le SQL en production**

Le jeton de gestion est dans `~/.config/jarvis/supabase-token`. **Toujours `curl`** : `urllib` reçoit un faux 403 sur cette API.

```bash
TOK=$(cat ~/.config/jarvis/supabase-token)
/usr/bin/python3 -c "
import json
print(json.dumps({'query': open('docs/supabase/rdv-agenda-alias.sql').read()}))
" > /tmp/q.json
curl -s -X POST "https://api.supabase.com/v1/projects/iyvavhnlhxksokkerkos/database/query" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  --data-binary @/tmp/q.json
```

- [ ] **Step 3: Vérifier que les droits passent VRAIMENT**

Ne pas se contenter de « la requête a réussi ». Avec la clé **anonyme** et un jeton de session de commercial, poser puis relire une ligne :

```bash
curl -s -X POST "https://iyvavhnlhxksokkerkos.supabase.co/rest/v1/rdv_agenda_alias" \
  -H "apikey: <cle_anon>" -H "Authorization: Bearer <jeton_de_session>" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"user_id":"<son_uuid>","cle":"TEST CLAUDE","cip":"2000016"}'
```

Expected: la ligne créée, en JSON. Un `42501 permission denied` signifie que le `grant` manque — c'est exactement le piège que l'étape précédente cherche à éviter.

Puis archiver la ligne de test (**pas de `DELETE`**) :

```bash
curl -s -X PATCH "https://iyvavhnlhxksokkerkos.supabase.co/rest/v1/rdv_agenda_alias?cle=eq.TEST%20CLAUDE" \
  -H "apikey: <cle_anon>" -H "Authorization: Bearer <jeton_de_session>" \
  -H "Content-Type: application/json" -d '{"archive":true}'
```

- [ ] **Step 4: Écrire le module navigateur**

Créer `crm/v2/v2-rdv-alias.js` :

```javascript
/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Rattachements validés à la main

   La reconnaissance est refaite à chaque ouverture — rien n'est stocké
   des titres d'agenda. Sans cette table, corriger « Phie des javobins »
   serait à refaire chaque fois. On ne garde donc QUE la correspondance,
   et seulement pour les titres que le commercial a lui-même désignés.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  // Appliquer cleAlias à une clé déjà normalisée la laisse inchangée :
  // l'appelant peut donc passer un titre brut OU une clé.
  function cle(titre) { return window.V2RECO ? window.V2RECO.cleAlias(titre) : ''; }

  V2.rdvAlias = {
    // Rend { cle: cip }. Ne rejette jamais : l'écran doit s'afficher même
    // si la table répond mal — il redemandera simplement les rattachements.
    charger: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve({});
      return c.from('rdv_agenda_alias').select('cle, cip')
        .eq('user_id', u).eq('archive', false)
        .then(function (r) {
          var out = {};
          ((r && r.data) || []).forEach(function (l) { out[l.cle] = String(l.cip); });
          return out;
        })
        .catch(function () { return {}; });
    },

    poser: function (titre, cip) {
      var c = sb(), u = uid(), k = cle(titre);
      if (!c || !u || !k || !cip) return Promise.resolve(false);
      // Reposer un rattachement archivé doit le RESSUSCITER, sinon le
      // commercial corrigerait dans le vide. On met à jour d'abord.
      return c.from('rdv_agenda_alias')
        .update({ cip: String(cip), archive: false })
        .eq('user_id', u).eq('cle', k)
        .select('id')
        .then(function (r) {
          if (r && r.data && r.data.length) return true;
          return c.from('rdv_agenda_alias')
            .insert({ user_id: u, cle: k, cip: String(cip) })
            .then(function (i) { return !(i && i.error); });
        })
        .catch(function () { return false; });
    },

    retirer: function (titre) {
      var c = sb(), u = uid(), k = cle(titre);
      if (!c || !u || !k) return Promise.resolve(false);
      return c.from('rdv_agenda_alias').update({ archive: true })
        .eq('user_id', u).eq('cle', k)
        .then(function (r) { return !(r && r.error); })
        .catch(function () { return false; });
    }
  };
})();
```

- [ ] **Step 5: Commit**

```bash
git add docs/supabase/rdv-agenda-alias.sql
git add crm/v2/v2-rdv-alias.js
git status --short
git commit -m "feat(rdv): table des rattachements titre -> officine

Seule exception a la regle « aucun titre en base », consentie ligne par
ligne : uniquement les titres que le commercial designe lui-meme comme
une officine. Grant explicite en plus de la RLS, colonne archive au lieu
de DELETE.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4 : l'écran affiche les noms d'officine et laisse corriger

**Files:**
- Modify: `crm/v2/v2-rdv-planning.js`
- Modify: `crm/v2/v2-rdv-ajout.js:171`
- Modify: `crm/v2/v2-rdv.js:501`
- Modify: `crm/v2/index.html:215-227`

**Interfaces:**
- Consumes: `V2RECO.indexer / apparier / cleAlias` (Task 1), action `mes_evenements` (Task 2), `V2.rdvAlias` (Task 3), `V2.rdvInfo(cip)`, `V2.pharmacies`, `window.PHARMA_FR` (existants)
- Produces: `V2.rdvPlanning.corriger(cle)`, `V2.rdvPlanning.confirmer(cle, cip)`, `V2.planningOfficines` (`[{ date, debut, fin, jour_entier, titre, cle, cip, nom, ville, etat, source, client }]`), `V2.planningDerniereVisite` (`{ cip: 'YYYY-MM-DD' }`) — la Task 5 consomme les deux derniers

- [ ] **Step 1: Charger les scripts dans la page**

Dans `crm/v2/index.html`, avant la ligne `<script src="v2-rdv-creneaux.js?v=20260814a"></script>` (ligne 215), insérer :

```html
  <script src="v2-rdv-reco.js?v=20260815a"></script>
  <script src="v2-rdv-alias.js?v=20260815a"></script>
```

Et passer **toutes** les lignes 215-227 de `?v=20260814a` à `?v=20260815a`.

- [ ] **Step 2: Porter la fenêtre à 4 semaines**

Dans `crm/v2/v2-rdv-planning.js`, remplacer `var JOURS_AFFICHES = 14;` par :

```javascript
  // Quatre semaines, pas quinze jours : le planning à venir est presque vide
  // (5 RDV pharmacie sur les 4 prochaines semaines, mesuré le 14/08/2026).
  // Un horizon court donnerait un écran vide et sans usage.
  var JOURS_AFFICHES = 28;
```

Remplacer dans le texte d'introduction `Tes quinze prochains jours` par `Tes quatre prochaines semaines`, et dans `crm/v2/v2-rdv.js:501` `'15 jours, heure par heure'` par `'4 semaines, heure par heure'`.

- [ ] **Step 3: Reconnaître les officines au chargement**

Ajouter en haut de `v2-rdv-planning.js`, après les constantes :

```javascript
  // Les officines reconnues dans l'agenda. Rempli à chaque rendu, jamais
  // persisté : les titres ne sont pas à nous.
  V2.planningOfficines = [];
  V2.planningDerniereVisite = {};

  function appelerAgenda(corps) {
    var c = sb();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (s) {
      var acces = s && s.data && s.data.session && s.data.session.access_token;
      if (!acces) return null;
      return fetch(c.supabaseUrl + '/functions/v1/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + acces },
        body: JSON.stringify(corps)
      }).then(function (r) { return r.json(); });
    }).catch(function () { return null; });
  }

  // Index construits une fois par rendu : 691 + 19 667 officines, c'est
  // trop pour les reconstruire à chaque événement.
  function indexOfficines() {
    var R = window.V2RECO;
    if (!R) return null;
    var porte = (V2.pharmacies || []).map(function (p) {
      return { id: p.id, name: p.name, ville: p.ville || '' };
    });
    var idsPorte = {};
    for (var k = 0; k < porte.length; k++) idsPorte[String(porte[k].id)] = 1;
    var nat = [], D = window.PHARMA_FR;
    if (D && D.p) {
      for (var i = 0; i < D.p.length; i++) {
        var l = D.p[i];
        // [lat, lng, uga, grp, seg, comm, nom, ville, cp, tel, titulaire, email, ca, id]
        if (l[6] && l[13] != null) nat.push({ id: String(l[13]), name: l[6], ville: l[7] || '' });
      }
    }
    return { porte: R.indexer(porte), nat: R.indexer(nat), idsPorte: idsPorte };
  }
```

Dans la chaîne `Promise.all` de `render`, ajouter deux entrées après `V2.rdvAgenda.charger()` :

```javascript
          appelerAgenda({ action: 'mes_evenements' }),
          (V2.rdvAlias ? V2.rdvAlias.charger() : Promise.resolve({}))
```

Et au début du `.then(function (r) { … })` qui suit, après `var ag = r[3];` :

```javascript
        var brut = (r[4] && r[4].ok && r[4].evenements) || [];
        var alias = r[5] || {};
        var idx = indexOfficines();
        var R = window.V2RECO;
        var reconnus = [];          // ce qui tombe dans la fenêtre affichée
        var derniereVisite = {};    // cip -> date la plus récente dans le passé
        if (idx && R) {
          for (var b = 0; b < brut.length; b++) {
            var ev = brut[b];
            var m = R.apparier(ev.titre, idx.porte, idx.nat, alias);
            if (!m.officine) continue;
            var cipEv = String(m.officine.id);
            if (ev.date < auj) {
              if (!derniereVisite[cipEv] || ev.date > derniereVisite[cipEv]) {
                derniereVisite[cipEv] = ev.date;
              }
            } else if (ev.date <= fin) {
              reconnus.push({
                date: ev.date, debut: ev.debut, fin: ev.fin, jour_entier: ev.jour_entier,
                titre: ev.titre, cle: R.cleAlias(ev.titre), cip: cipEv,
                nom: m.officine.name, ville: m.officine.ville || '',
                etat: m.etat, source: m.source, client: !!idx.idsPorte[cipEv]
              });
            }
          }
        }
        V2.planningOfficines = reconnus;
        V2.planningDerniereVisite = derniereVisite;
```

Enfin, changer la signature en `function rendreJour(iso, dispo, blocages, rdvs, occupes, auj, reconnus)` et l'appel en `rendreJour(isoPlus(i), dispo, blocages, rdvs, occupes, auj, reconnus)`.

- [ ] **Step 4: Afficher le nom au lieu de « occupé »**

Dans `rendreJour`, remplacer le bloc `mesOcc.forEach` par :

```javascript
    // Heures venues de l'agenda personnel. Quand le titre désigne une
    // officine, on le dit ; sinon on s'en tient à « occupé », qui est la
    // vérité et pas une pudeur — rien de ce titre n'est connu de la base.
    var recoJour = (reconnus || []).filter(function (x) { return x.date === iso; });
    mesOcc.forEach(function (o) {
      var d = o.jour_entier ? H_DEB : hm2min(o.debut);
      var f = o.jour_entier ? H_FIN : hm2min(o.fin);
      var reco = null;
      for (var i = 0; i < recoJour.length; i++) {
        if (recoJour[i].jour_entier === o.jour_entier &&
            (o.jour_entier || recoJour[i].debut === o.debut)) { reco = recoJour[i]; break; }
      }
      pris.push({ deb: d, fin: f, cls: reco ? 'agp-s-rdv' : 'agp-s-occ' });
      if (!reco) {
        lignes.push({ deb: d, html: '<div class="agp-l">' +
          '<span class="agp-h">' + (o.jour_entier ? 'jour' : esc(hhmm(o.debut))) + '</span>' +
          '<span class="agp-sm">occupé' + (o.jour_entier ? ' toute la journée' :
            ' jusqu’à ' + esc(hhmm(o.fin))) + ' — ton agenda personnel</span></div>' });
        return;
      }
      var douteux = reco.etat === 'confirmer';
      lignes.push({ deb: d, html: '<div class="agp-l' + (douteux ? ' agp-doute' : '') + '">' +
        '<span class="agp-h">' + (o.jour_entier ? 'jour' : esc(hhmm(o.debut))) + '</span>' +
        '<span class="agp-n">' + esc(reco.nom) + '</span>' +
        (reco.ville ? '<span class="agp-sm">· ' + esc(reco.ville) + '</span>' : '') +
        '<span class="agp-eti ' + (reco.client ? 'agp-cli' : 'agp-pro') + '">' +
          (reco.client ? 'client' : 'prospect') + '</span>' +
        '<span class="agp-a">' +
          (douteux ? '<a href="#" onclick="V2.rdvPlanning.confirmer(\'' + escArg(reco.cle) +
            '\',\'' + escArg(reco.cip) + '\');return false">c’est bien elle</a>' : '') +
          '<a href="#" onclick="V2.rdvPlanning.corriger(\'' + escArg(reco.cle) +
            '\');return false">ce n’est pas la bonne</a>' +
        '</span></div>' });
    });
```

Ajouter dans `ensureCss()` (aucun `backdrop-filter`, aucun `filter:blur` — le Mac de Will plante sous Safari) :

```javascript
      '.agp-l.agp-doute{border-left:3px solid #C7791A;padding-left:9px}',
      '.agp-eti{font-size:11px;font-weight:800;border-radius:6px;padding:2px 7px;',
      '  text-transform:uppercase;letter-spacing:.04em}',
      '.agp-cli{background:#DCE7FA;color:#0050E6}',
      '.agp-pro{background:#F3EAD8;color:#8A5A12}',
```

Dans la légende (`agp-leg`), remplacer le libellé « ton agenda personnel » par « autre occupation » : la pastille bleue « rendez-vous » couvre désormais les RDV JARVIS *et* ceux reconnus dans l'agenda.

- [ ] **Step 5: Brancher la correction**

Dans l'objet `V2.rdvPlanning`, ajouter :

```javascript
    // « Ce n'est pas la bonne » : on ouvre la recherche d'officine déjà
    // écrite pour l'ajout manuel, puis on retient le choix. L'agenda Google
    // n'est jamais modifié — on ne corrige que du côté JARVIS.
    corriger: function (cle) {
      V2.rdvPlanningCleEnCours = cle;
      if (V2.rdvAlias) V2.rdvAlias.retirer(cle);
      V2.go('rdvajout');
    },

    confirmer: function (cle, cip) {
      if (!V2.rdvAlias) return;
      V2.rdvAlias.poser(cle, cip).then(function () { V2.go('rdvplanning'); });
    },
```

Et dans `crm/v2/v2-rdv-ajout.js`, remplacer `V2.rdvAjout.choisir` (ligne 171) par :

```javascript
    choisir: function (cip) {
      // Arrivée depuis « ce n'est pas la bonne » : on retient la
      // correspondance et on repart sur le planning, corrigé.
      if (V2.rdvPlanningCleEnCours && V2.rdvAlias) {
        var k = V2.rdvPlanningCleEnCours;
        V2.rdvPlanningCleEnCours = null;
        V2.rdvAlias.poser(k, cip).then(function () { V2.go('rdvplanning'); });
        return;
      }
      choisie = V2.rdvInfo ? V2.rdvInfo(cip) : { cip: cip, nom: '', ville: '' };
      V2.go('rdvajout', cip);
    },
```

- [ ] **Step 6: Vérifier à l'écran, à 390 px**

```bash
cd crm && /usr/bin/python3 -m http.server 8765
```

Chrome sans fenêtre — **toujours** avec un profil jetable, sinon le navigateur de Will se fige sur son verrou `SingletonLock` et ne répond plus à rien :

```bash
PROFIL=$(mktemp -d)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless=new --user-data-dir="$PROFIL" --window-size=390,2400 \
  --screenshot=/tmp/planning.png "http://localhost:8765/v2/#rdvplanning"
rm -rf "$PROFIL"
```

À contrôler, capture en main, **en défilant de haut en bas** : le nom des officines s'affiche, l'étiquette client/prospect est là, une ligne « à confirmer » porte son liseré et ses deux liens, aucun débordement horizontal, tous les liens font au moins 44 px de haut.

- [ ] **Step 7: Commit**

```bash
git add crm/v2/v2-rdv-planning.js
git add crm/v2/v2-rdv-ajout.js
git add crm/v2/v2-rdv.js
git add crm/v2/index.html
git status --short
git commit -m "feat(planning): 4 semaines, nom des officines, correction a la main

L'ecran affiche desormais le nom de l'officine reconnue dans l'agenda,
son etiquette client/prospect, et laisse corriger un rattachement rate.
L'agenda Google n'est jamais modifie.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5 : une journée vide propose une liste à contacter

**Files:**
- Modify: `crm/v2/v2-rdv-planning.js`
- Modify: `crm/v2/v2-campagne.js`

**Interfaces:**
- Consumes: `V2.planningOfficines`, `V2.planningDerniereVisite` (Task 4), `V2.rdvCA(cip)`, `V2.rdvInfo(cip)`, `ETAT.choisis` de `v2-campagne.js`
- Produces: `V2.rdvPlanning.contacter(iso)`, `V2.planningAContacter`, `V2.campagnePreselection`

- [ ] **Step 1: Bâtir la liste des officines sans rendez-vous**

Dans `v2-rdv-planning.js`, ajouter avant `V2.pages.rdvplanning` :

```javascript
  // Qui reste-t-il à contacter ? Tout le portefeuille, moins :
  //   · celles qui ont déjà un RDV à venir (JARVIS ou reconnu dans l'agenda),
  //   · celles qui ont demandé à ne plus être sollicitées,
  //   · celles vues il y a moins de 60 jours — le passé de l'agenda est la
  //     SEULE source de cette information, elle n'existe nulle part ailleurs.
  var REPOS_JOURS = 60;

  function aContacter(rdvs, reconnus, opposes) {
    var pris = {}, i;
    for (i = 0; i < rdvs.length; i++) if (rdvs[i].cip) pris[String(rdvs[i].cip)] = 1;
    for (i = 0; i < reconnus.length; i++) pris[String(reconnus[i].cip)] = 1;
    var nonSollicite = {};
    for (i = 0; i < (opposes || []).length; i++) nonSollicite[String(opposes[i])] = 1;

    // isoPlus accepte les valeurs négatives : setDate(jour - 60) recule.
    var limite = isoPlus(-REPOS_JOURS);
    var vues = V2.planningDerniereVisite || {};
    var out = [], listeP = V2.pharmacies || [];
    for (i = 0; i < listeP.length; i++) {
      var cip = String(listeP[i].id);
      if (pris[cip] || nonSollicite[cip]) continue;
      var vue = vues[cip] || null;
      if (vue && vue > limite) continue;
      var info = V2.rdvInfo ? V2.rdvInfo(cip) : null;
      out.push({
        cip: cip,
        nom: (info && info.nom) || listeP[i].name || '',
        ville: (info && info.ville) || '',
        email: (info && info.email) || '',
        ca: (V2.rdvCA ? V2.rdvCA(cip) : null) || 0,
        vue: vue
      });
    }
    out.sort(function (a, b) { return b.ca - a.ca; });
    return out;
  }
```

- [ ] **Step 2: Afficher le bloc sous chaque journée**

Dans `rendreJour`, avant le `return` final, construire :

```javascript
    // Ce que le commercial vient chercher sur une journée vide : à qui
    // écrire. Le lien de prise de RDV laisse le pharmacien choisir son
    // créneau lui-même — c'est l'écran Campagne, déjà en place.
    var appel = '';
    if (!mesRdv.length && !recoJour.length && libre >= 120) {
      var n = (V2.planningAContacter || []).length;
      appel = '<div class="agp-vide-jour">' +
        '<button class="v2-btn" style="min-height:44px" onclick="V2.rdvPlanning.contacter(\'' +
        escArg(iso) + '\')">Proposer des créneaux' +
        (n ? ' à ' + Math.min(n, 25) + ' officines' : '') + '</button></div>';
    }
```

et l'insérer dans le HTML rendu, entre les lignes et la fermeture du `</div>` de la journée.

Styles à ajouter dans `ensureCss()` :

```javascript
      '.agp-vide-jour{margin:11px 0 0}',
```

- [ ] **Step 3: Brancher le bouton sur l'écran Campagne**

Dans `V2.rdvPlanning`, ajouter :

```javascript
    // Bascule vers la Campagne existante avec la liste déjà cochée.
    // On ne réécrit pas l'envoi : JARVIS prépare les mails, le commercial
    // relit et envoie depuis sa boîte, et coche « envoyé » lui-même.
    contacter: function () {
      V2.campagnePreselection = (V2.planningAContacter || []).slice(0, 25)
        .map(function (x) { return x.cip; });
      V2.go('campagne');
    },
```

La liste d'opposition vient de la fonction serveur `rdv_opposes` — la même que
`v2-campagne.js:167`. Elle est **commune à toute l'équipe** : une officine qui
dit stop à Karine ne doit plus recevoir les mails de Morgane. Ajouter une
sixième entrée à la chaîne `Promise.all` de `render` :

```javascript
          c.rpc('rdv_opposes').then(function (r) {
            return ((r && r.data) || []).map(function (x) {
              return String(x && x.cip != null ? x.cip : x);   // des CIP bruts
            });
          }).catch(function () { return []; })
```

puis, après `V2.planningDerniereVisite = derniereVisite;` :

```javascript
        V2.planningAContacter = aContacter(rdvs, reconnus, r[6] || []);
```

Dans `crm/v2/v2-campagne.js`, la présélection se pose dans `V2.campagne.chercher`,
**après** `ETAT.opposes = …` et **avant** `V2.campagne.rafraichir()` (ligne 172) :
c'est le seul endroit où la liste existe déjà et où `viser()` ne l'a pas encore
remise à zéro.

```javascript
        ETAT.tous = recenser();
        // Arrivée depuis le planning : la liste est déjà faite, on la coche.
        // Ici et pas ailleurs — « viser » remet la sélection à zéro quand on
        // change de commercial, et poser les coches avant serait sans effet.
        if (V2.campagnePreselection && V2.campagnePreselection.length) {
          ETAT.choisis = {};
          V2.campagnePreselection.forEach(function (cip) { ETAT.choisis[String(cip)] = 1; });
          V2.campagnePreselection = null;
        }
        V2.campagne.rafraichir();
```

- [ ] **Step 4: Vérifier à l'écran**

Reprendre la capture de la Task 4, étape 6. À contrôler :

- une journée sans RDV affiche le bouton, il fait 44 px ;
- il ouvre l'écran Campagne **avec des officines déjà cochées**, et le compteur affiche le bon nombre ;
- **une officine qui a un RDV le 18/08 n'apparaît dans aucune liste « à contacter »** — ce contrôle se fait à l'écran, pas dans le code.

- [ ] **Step 5: Commit**

```bash
git add crm/v2/v2-rdv-planning.js
git add crm/v2/v2-campagne.js
git status --short
git commit -m "feat(planning): une journee vide propose une liste a contacter

Bascule vers l'ecran Campagne existant avec la selection pre-remplie.
La liste ecarte les officines deja en RDV, celles qui se sont opposees,
et celles vues il y a moins de 60 jours — cette derniere info vient du
passe de l'agenda et n'existe nulle part ailleurs.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6 : mise en ligne

**Files:**
- Modify: `crm/v2/sw.js:13`

- [ ] **Step 1: Synchroniser le cache-busting**

Trois jetons doivent monter **ensemble**, sinon un commercial ayant déjà ouvert l'app garde l'ancienne version sans le savoir :

1. `crm/v2/index.html` — tous les `?v=` (fait en Task 4)
2. `crm/v2/sw.js:13` — `var VER = '20260814a';` → `var VER = '20260815a';`
3. `crm/v2/v2-boot.js:432` — `var V = '?v=20260813s';` : **à ne monter que si un fichier de données a changé**. Ce n'est pas le cas ici, on n'y touche pas.

- [ ] **Step 2: Lancer toute la batterie de tests**

Run: `node --test tests/*.test.mjs`
Expected: tout au vert, y compris les tests existants `rdv-creneaux`, `rdv-ics`, `rdv-modeles`, `campagne-cible`.

- [ ] **Step 3: Contrôle avant mise en ligne**

Lancer le sous-agent `gardien-deploiement` sur la branche. Il cherche les `console.log` oubliés, les secrets, les fichiers ajoutés par erreur, le cache-busting désynchronisé et le `[skip ci]` qui bloque silencieusement un déploiement.

- [ ] **Step 4: Pousser**

```bash
git add crm/v2/sw.js
git status --short
git commit -m "chore: bump cache-busting 20260815a

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git pull --rebase origin main     # le robot de veille pousse pendant qu'on travaille
git push origin HEAD:main
```

- [ ] **Step 5: Prouver que c'est en ligne**

**La production de JARVIS est GitHub Pages, pas Vercel.** Vérifier sur l'URL servie ; `jarvis-app.vercel.app` répond 404 partout sauf sur `/` et donnerait un faux négatif.

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://willmorel49-coder.github.io/jarvis-app/crm/v2/v2-rdv-reco.js
curl -s https://willmorel49-coder.github.io/jarvis-app/crm/v2/index.html | grep -c "v2-rdv-reco.js"
```

Expected: `200` puis `1`.

Puis ouvrir l'écran dans un vrai navigateur, connecté, et **faire défiler la page de haut en bas**. Un contrôle de code ne remplace pas un écran : le 14/08/2026, quatre maquettes sur vingt étaient entièrement blanches sous le premier écran et sont restées en ligne une journée.

- [ ] **Step 6: Nettoyer le worktree**

```bash
cd ~/JARVIS/APP && git worktree remove --force <chemin>/jarvis-main
```

---

## Auto-relecture du plan

**Couverture du cahier des charges :**

| Section de la spec | Tâche |
|---|---|
| §1 lire les titres sans les garder | Task 2 (+ contrôle explicite que `rdv_occupe` n'a pas de colonne de titre) |
| §2 reconnaître l'officine : extraction, deux verrous, trois issues | Task 1 |
| §3 corriger, table d'alias, aucune ligne créée dans `rdv` | Task 3, Task 4 étape 5 |
| §4 écran 4 semaines, client/prospect, lignes à confirmer | Task 4 |
| §5 journée vide → liste à contacter, dernière visite, renvoi vers Campagne | Task 5 |
| §6 ce qu'on ne fait pas | contraintes globales |
| Tests | Task 1 étapes 1-5, Task 6 étape 2 |

**Cohérence des noms :** `V2RECO.normaliser / distinctif / segment / cleAlias / indexer / apparier`, `V2.rdvAlias.charger / poser / retirer`, `V2.planningOfficines`, `V2.planningDerniereVisite`, `V2.planningAContacter`, `V2.campagnePreselection`, `V2.rdvPlanningCleEnCours` — chacun est défini dans une tâche avant d'être consommé dans une autre.

**Deux points de vigilance signalés aux exécutants :**

1. L'appariement d'une plage `rdv_occupe` avec un événement titré se fait sur l'heure de début (Task 4, étape 4). Les deux listes viennent de deux lectures du même agenda, à quelques minutes d'écart : si un événement a bougé entre les deux, la ligne retombe sur « occupé » sans nom. C'est dégradé, pas cassé, et l'actualisation suivante le corrige.
2. La reconnaissance tourne sur ~500 événements × 20 358 officines indexées, à chaque ouverture de l'écran. `chercher()` parcourt tout l'index par titre : c'est le seul endroit du plan qui peut être lent sur un téléphone. Mesurer avant d'optimiser — et si c'est nécessaire, indexer par premier jeton plutôt que de balayer, sans toucher aux deux verrous.

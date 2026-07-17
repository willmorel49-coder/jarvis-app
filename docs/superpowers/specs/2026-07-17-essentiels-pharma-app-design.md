# App Essentiels Pharma — Cockpit groupement

**Date :** 2026-07-17
**Auteur :** William Morel (+ Claude)
**Statut :** Conception validée, prêt pour plan d'implémentation

---

## 1. Objectif

Créer un cockpit de pilotage groupement pour **Essentiels Pharma** (ex-*Le Gall Santé Services*, créé en 1997), sur le **même modèle que l'app OPSO Santé** déjà en production. Application interne Intégral Pharma destinée à piloter la relation avec les officines du groupement Essentiels.

Ce n'est **pas** une refonte : c'est un **clone reskiné** de l'app OPSO, adapté à l'identité et aux données d'Essentiels Pharma.

---

## 2. Le groupement (référence)

- **Nom exact :** Essentiels Pharma (au pluriel), ex-Le Gall Santé Services (1997).
- **Baseline :** « **Le réflexe santé** » — « Un réseau de pharmaciens qui adhèrent à l'essentiel ».
- **Couleur de marque :** bleu (marque santé moderne). Hex exact à récupérer du vrai logo au moment de l'intégration.
- **4 activités :** réseau d'enseignes fédérées (Prestige / Premium / Premium+ / Optimum), pharmacies indépendantes sans enseigne (Discovery, sans engagement), centrale d'achats **CAP Essentiels Pharma**, prestataire pour laboratoires.
- **Sites de référence :** essentiels-pharma.fr, legall-sante.com.

---

## 3. Emplacement & hébergement

| Élément | Valeur |
|---|---|
| Dossier | `/JARVIS/APP/essentiels-pharma/` (copie de `/JARVIS/APP/opso/`) |
| En ligne | `https://willmorel49-coder.github.io/jarvis-app/essentiels-pharma/` |
| Repo | `jarvis-app` (même repo, même GitHub Pages, même montage que `/opso/`) |
| Stack | Vanilla JS / HTML / CSS, PWA (manifest + service worker), Supabase (même projet), Chart.js — **zéro build** |

Le montage reproduit exactement celui d'OPSO : ouverture directe de `index.html`, déploiement par `git push` sur `main` (délai GitHub Pages 1-2 min).

---

## 4. Identité visuelle (reskin)

Reskin complet depuis OPSO. Direction typo retenue : **plus pro / santé** (institutionnelle et moderne) plutôt que l'esprit rond & doux d'OPSO.

| Élément | OPSO (source) | → Essentiels Pharma |
|---|---|---|
| Couleur primaire | vert `#11a63c` | **bleu Essentiels** — hex exact issu du vrai logo, **choisi distinct du bleu Intégral `#0057FF`** |
| Baseline | « On prend soin de vous ! » | « **Le réflexe santé** » |
| Sous-titre | « Normandie · Pilotage groupement » | « Essentiels Pharma · Pilotage groupement » |
| Logo / favicon / icônes PWA | croix verte | logo/croix bleue Essentiels |
| Fonts | Varela Round + Nunito | typo plus institutionnelle/moderne (proposée en variantes) |
| `theme_color` / manifest | `#11a63c` | bleu Essentiels |

**Process design (règle ROBOT §11) :** avant de figer, produire **2-3 variantes numérotées** (bleu exact + déclinaison logo + typo) dans une page HTML avec sélecteur, déployer, donner le lien, attendre le choix de Will. Après 2 rejets → exiger 2-3 références visuelles.

### ⚠️ Trois marques à ne jamais confondre
- **Intégral Pharma** = bleu `#0057FF` (grossiste-répartiteur).
- **OPSO / Normandie Pharma** = vert `#11a63c` (groupement).
- **Essentiels Pharma** = bleu distinct (groupement).

Le bleu Essentiels doit être visiblement différent du bleu Intégral.

---

## 5. Pages

Identiques à OPSO, aucune page en moins :

- **Dashboard** (cockpit)
- **Pharmacies** (annuaire adhérents)
- **Ventes WML** (sell-out des officines Essentiels)
- **Offilog** (prix / veille)
- **Catalogue** (produits Intégral)
- **Prioritaires** (prospection)
- **Admin** (masqué sauf rôle admin)

Navigation, structure `app.js`, état global : conservés tels quels, adaptés aux données Essentiels.

---

## 6. Données — deux natures

C'est le point le plus important. On distingue :

### 6.1 Données partagées Intégral → **conservées**
Valables pour tous les groupements, aucune adaptation :
- Catalogue produits Intégral (benchmark).
- Prix Offilog / Offilog Live, prix concurrents (Leclerc, Cap3000, Drakkars, Pharmazon).
- Veille concurrentielle (alertes prix public conc. < prix achat IP).
- Règles métier prix (abandon de marge, barème MDL, NR/génériques) — cf. ROBOT §10.

### 6.2 Données propres au groupement → **vides au départ**
On n'a **rien encore** pour Essentiels :
- **Liste des adhérents** (pharmacies membres : nom, CIP, CP, ville, UGA, enseigne/niveau…).
- **Ventes WML** (sell-out Intégral des officines Essentiels).
- Stats groupement, listing, prioritaires ciblés.

**Comportement V1 :** la coquille affiche des **états vides propres et explicites** (« Données en cours d'intégration ») partout où ces données seraient attendues, au lieu d'écrans cassés ou de données OPSO résiduelles. Aucune donnée OPSO ne doit fuiter dans l'app Essentiels.

**Branchement ultérieur :** quand Will fournit la liste des officines Essentiels + les fichiers de ventes, on suit le même runbook que pour OPSO / les commerciaux (génération des `*-data.js` Essentiels, bump `?v=`, sync `sw.js`, vérif prod).

---

## 7. Login / accès

- Réutilise le **projet Supabase existant** (`iyvavhnlhxksokkerkos.supabase.co`).
- Un **compte de démo Essentiels** sera créé quand Will voudra présenter l'app (procédure : cf. mémoire « Créer un compte Supabase CRM »).
- Le **filtrage par adhérents Essentiels** (équivalent de `opso-adherents.js` → `essentiels-adherents.js`) s'activera avec la vraie liste. Tant qu'elle est vide, l'app se comporte comme une coquille sécurisée (pas de fuite de données d'un autre groupement).

---

## 8. Livraison (règle ROBOT §11)

- Avant tout push touchant l'app : syntaxe OK + `?v=` bumpé partout + `sw.js` `VER` synchronisé.
- Après push : `bash scripts/attendre-prod.sh <token ?v=>`, puis ouvrir/screenshoter la page (mobile 390px), PUIS livrer avec l'**URL prod exacte cliquable**.
- Fichiers `*-data.js` > 500 Ko → chargés en différé (`V2.loadFiles`), jamais au boot (Safari de Will a déjà figé).
- **Hygiène git :** jamais `git add -A` — ajouter les fichiers précis (racine JARVIS contient des PDF privés/lourds).

---

## 9. Hors périmètre V1 (YAGNI)

- Pas de refonte fonctionnelle : on reste iso-OPSO.
- Pas de portail patient (My Essentiels, Clic&Collect, RDV…) — ce sont des services d'Essentiels pour leurs patients, pas l'objet de ce cockpit interne.
- Pas de gestion des 4 niveaux d'adhésion (Prestige/Premium/…) tant que la donnée adhérents n'est pas là ; à considérer plus tard si utile au pilotage.

---

## 10. Critères de succès V1

1. `https://willmorel49-coder.github.io/jarvis-app/essentiels-pharma/` est en ligne et s'ouvre (login).
2. Identité 100 % Essentiels (bleu distinct, baseline « Le réflexe santé », logo, sous-titre), **zéro résidu vert/OPSO**.
3. Les 7 pages s'affichent sans écran cassé ; données groupement en états vides propres, données partagées Intégral fonctionnelles.
4. Installable en PWA (manifest + SW à jour).
5. Prêt à recevoir la liste d'adhérents + ventes Essentiels sans re-architecture.

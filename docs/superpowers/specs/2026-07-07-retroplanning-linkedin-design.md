# Rétroplanning LinkedIn — Onglet Marketing (CRM JARVIS)

_Spec de conception — 2026-07-07_

## 1. Objectif

Ajouter dans l'onglet **Marketing** du CRM JARVIS une feature de **rétroplanning éditorial LinkedIn** pour Intégral Pharma :

- **Planifier et préparer** les futurs posts (calendrier éditorial + génération à rebours depuis un temps fort).
- **Rédiger** le contenu (texte, visuel, pilier éditorial, statut) et le garder au chaud.
- **Rappeler** ce qui est à publier et **publier en 1 clic** (copie + ouverture de LinkedIn).
- **Consulter les anciens posts**, importés une fois depuis l'export LinkedIn.

## 2. Contraintes (non négociables)

- **100% client-side.** Aucun serveur, aucune clé API, aucun coût. Le CRM est en vanilla JS sur GitHub Pages.
- **Pas d'API LinkedIn.** Une vraie connexion (import auto + publication auto) exigerait une appli LinkedIn validée + OAuth + backend → écarté (choix utilisateur).
- **Persistance** : Supabase (déjà utilisé) en primaire, **repli localStorage** si la table/Supabase est indisponible — comme le module `marketing_items` existant (`v2-mkt.js`).
- **Réponses/UI en français.** Vanilla JS, pas de framework, pas de build.

## 3. Décisions actées (issues du brainstorming)

1. Ambition = **rétroplanning dans JARVIS** (pas d'import/publication auto via API).
2. Modèle = **calendrier éditorial + générateur de rétroplanning à rebours** (les deux).
3. Anciens posts = **import du fichier d'export LinkedIn** (parsing navigateur).
4. Par post : **texte, visuel/image, pilier éditorial, rappels + publier en 1 clic**.
5. Construction = **sous-module intégré** dans l'onglet Marketing (approche A), table dédiée `linkedin_posts`.

## 4. Architecture

- **Nouveau module** `crm/v2/v2-mkt-linkedin.js`, chargé par `crm/v2/index.html` (avec cache-busting `?v=` comme les autres) et rendu dans un **nouveau bloc de l'onglet Marketing** (`v2-mkt.js` ajoute une bannière/section « Rétroplanning LinkedIn » qui appelle le module).
- **Persistance** : réutilise le pattern `v2-mkt.js` — `V2.sb()` (client Supabase) en primaire, `localStorage` en repli, dégradation silencieuse.
  - Table Supabase **`linkedin_posts`**.
  - Bucket de stockage Supabase **`marketing-media`** pour les visuels.
- **Dépendances déjà présentes** : SheetJS (parsing du fichier d'import), Supabase JS, service worker (hors-ligne). Aucune dépendance nouvelle.

### 4.1 Modèle de données — `linkedin_posts`

| Champ | Type | Rôle |
|---|---|---|
| `id` | text | identifiant (`li` + timestamp) |
| `created_at`, `updated_at` | timestamptz | technique |
| `date` | timestamptz | date/heure prévue (ou de publication pour les anciens) |
| `status` | text | `idee` \| `redaction` \| `pret` \| `publie` |
| `pillar` | text | pilier éditorial (voir 4.2) |
| `title` | text | titre court (repérage calendrier) |
| `body` | text | texte du post |
| `image_path` | text | chemin du visuel dans `marketing-media` (ou URL externe) |
| `linkedin_url` | text | lien du post publié |
| `event_id` | text | id du temps fort (regroupe un rétroplanning) |
| `event_name` | text | nom du temps fort |
| `source` | text | `manuel` \| `import` \| `retroplanning` |

- **Regroupement rétroplanning** : les posts partageant `event_id` forment un temps fort (pas de table séparée).
- **RLS Supabase** : mêmes règles que `marketing_items` (accès aux utilisateurs authentifiés du CRM).

### 4.2 Piliers éditoriaux (config modifiable)

Constante en tête de module (surchargée plus tard si besoin) :

| Clé | Libellé | Couleur (indicatif) |
|---|---|---|
| `produit` | Produit | bleu `#0057FF` |
| `conseil` | Conseil officine | menthe `#00E5A0` |
| `coulisses` | Coulisses / logistique | ambre `#FFB020` |
| `recrutement` | Recrutement | rose `#FF4D6D` |
| `tempsfort` | Temps fort / Actualité | violet |

### 4.3 Gabarits de rétroplanning (à rebours)

Constante de gabarits (offsets en jours par rapport au Jour J), modifiable :

```
gabarit "Temps fort" par défaut :
  J-14  → post "Teaser"        (pilier: tempsfort, statut: idee)
  J-7   → post "Annonce"       (tempsfort, idee)
  J-1   → post "Rappel"        (tempsfort, idee)
  J     → post "Jour J / live" (tempsfort, idee)
  J+2   → post "Retour / bilan"(tempsfort, idee)
```

Générer un temps fort = créer N posts brouillons aux dates `dateJ + offset`, `source=retroplanning`, même `event_id/name`.

## 5. Vues / UX

Bloc « Rétroplanning LinkedIn » dans l'onglet Marketing. Barre d'outils : `[Calendrier] [Liste]  •  + Post  •  + Nouveau temps fort  •  Import  •  ⚠ À publier : N`.

1. **Calendrier (vue principale)** — mois (bascule semaine). Chaque post = pastille **couleur du pilier** + point de **statut**. Clic jour → nouveau post à cette date ; clic post → éditeur. Navigation ‹ mois ›, « aujourd'hui ». Légende des piliers.
2. **Barre « À publier »** — compteur + posts `date ≤ aujourd'hui` et `status ≠ publie`, bouton **Publier**. **Pastille de compte** sur l'onglet Marketing.
3. **Générateur de rétroplanning** — modale : nom du temps fort + date J + choix du gabarit → crée les posts brouillons datés, taggés `event`.
4. **Éditeur de post** (panneau/overlay) — texte + **compteur** (~3000 car.), pilier (menu coloré), date/heure, statut, **visuel** (upload `marketing-media` ou coller une URL), lien LinkedIn, notes. Boutons : Enregistrer · Publier · Supprimer.
5. **Vue liste** — tous les posts **filtrables** (statut, pilier, temps fort, recherche texte) — retrouver un ancien post / bilan.

## 6. Import des anciens posts

- Bouton **Import** → dépôt d'un fichier d'export LinkedIn (CSV/xlsx).
- **Parsing navigateur** via SheetJS ; **mapping souple** des colonnes → `date`, `body`, `linkedin_url` (l'export d'une **page entreprise** diffère d'un **profil** : l'UI de mapping laisse choisir la colonne si l'auto-détection échoue).
- Chaque ligne → post `status=publie`, `source=import`.
- **Anti-doublon** au ré-import : clé `linkedin_url` sinon `date+hash(body)`.

## 7. Publication en 1 clic

- Bouton **Publier** sur un post → **copie le texte** dans le presse-papier + **ouvre LinkedIn** (compositeur de la page entreprise, nouvel onglet).
- L'utilisateur colle, ajoute le visuel, publie sur LinkedIn, puis **Marquer publié** + colle le `linkedin_url`.
- Aucune publication automatique (impossible sans API — acté).

## 8. Rappels

- **Pastille de compte** « à publier » sur l'onglet Marketing + section « aujourd'hui / en retard » en tête du bloc.
- 100% in-app, fonctionne hors-ligne. Notifications système = **V2 éventuelle** (service worker déjà présent).

## 9. Dégradation & cas limites

- **Sans Supabase** (repli localStorage) : tout fonctionne **sauf l'upload d'image** (désactivé ; on peut coller une URL d'image). Message clair à l'utilisateur.
- **Import mal formé** : l'UI de mapping + un aperçu des 3 premières lignes évitent les erreurs ; lignes invalides ignorées avec compte-rendu.
- **Fuseau horaire** : dates stockées en ISO, affichées en heure locale FR.
- **Presse-papier bloqué** (permissions) : repli = affichage du texte à copier manuellement.

## 10. Hors périmètre (non fait en V1)

- Publication/lecture automatique via l'API LinkedIn.
- Notifications système / e-mail.
- Multi-comptes / multi-pages LinkedIn (une seule page : Intégral Pharma).
- Génération de texte par IA (l'utilisateur écrit ; cohérent avec la règle « pas de copilote IA / dépendance externe »).
- Statistiques d'engagement (likes/vues) — dépend de l'API.

## 11. Critères de réussite

- Créer un post daté avec pilier + visuel, le voir sur le calendrier, le publier en 1 clic (copie + ouverture LinkedIn), le marquer publié.
- Générer un rétroplanning « temps fort » qui remplit automatiquement le calendrier.
- Importer un fichier d'export LinkedIn et retrouver les anciens posts en « publié ».
- La pastille « à publier » reflète les posts dus.
- Tout fonctionne hors-ligne (localStorage), sans clé ni serveur ; se synchronise sur Supabase quand dispo.

## 12. Livraison

- Nouveau fichier `crm/v2/v2-mkt-linkedin.js` + ajout du bloc dans `v2-mkt.js` + `<script>`/CSS dans `index.html`.
- SQL de création de `linkedin_posts` (+ RLS) et du bucket `marketing-media` — à exécuter dans Supabase (repli localStorage en attendant).
- Cache-busting `?v=` bumpé + `sw.js VER` synchronisé (règle de déploiement JARVIS).

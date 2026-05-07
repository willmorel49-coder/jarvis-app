# App OPSO Santé — Design Spec
**Date :** 2026-05-07  
**Statut :** Approuvé

---

## Contexte

Intégral Pharma dispose d'un CRM vanilla JS hébergé sur GitHub Pages (`jarvis-app/crm/`), connecté à Supabase. OPSO Santé (Bretagne Pharma / Normandie Pharma) est le premier client signé. L'objectif est de leur fournir une interface dédiée à leurs couleurs, accessible à la fois par les équipes Intégral Pharma et par les équipes OPSO Santé.

---

## Architecture

### Emplacement dans le repo

```
jarvis-app/
  crm/           — CRM Intégral Pharma (existant, inchangé)
  opso/          — App OPSO Santé (nouveau)
    index.html
    style.css
    app.js
```

Les fichiers de données statiques (`clients-data.js`, `benchmark-data.js`, `offilog-data.js`, `drakkars-data.js`, `cap3000-data.js`, `groupements-data.js`) sont chargés depuis `../crm/` — aucune duplication.

**URL de prod :** `https://willmorel49-coder.github.io/jarvis-app/opso/`  
**Backend :** Même Supabase project (`iyvavhnlhxksokkerkos`) — mêmes tables, mêmes données.

---

## Thème visuel (charte OPSO Santé)

**Mode :** Jour (light mode) — inverse du CRM Intégral Pharma.

### Tokens CSS

```css
--bg:            #f5f6f7;   /* fond page */
--bg2:           #ffffff;   /* cartes */
--bg3:           #eef0f1;   /* fond hover */
--text:          #2a2d2f;   /* texte principal */
--text2:         #64686a;   /* texte secondaire */
--text3:         #9aa0a3;   /* texte tertiaire */
--border:        #e5e8ea;   /* bordures */
--border2:       #d4d8db;   /* bordures fortes */
--green:         #11a63c;   /* couleur primaire OPSO */
--green-dark:    #0d8530;   /* primaire foncé */
--green-pale:    #e6f7ec;   /* accent léger */
--warning:       #e8a317;   /* amber */
--danger:        #d04a4a;   /* rouge */
```

### Typographie
- Titres : **Varela Round** (Google Fonts)
- Corps : **Nunito** 300/400/600/700/800 (Google Fonts)

### Composants UI
- Sidebar : fond vert `#11a63c`, texte blanc
- Cards : blanches, `border-radius: 14px`, shadow légère
- Boutons primaires : vert `#11a63c`
- Badges/accents : vert à la place du bleu/mint du CRM

---

## Fonctionnalités

Toutes les fonctionnalités du CRM, filtrées sur le périmètre OPSO Santé :

| Module | Description |
|--------|-------------|
| Dashboard | CA groupement, évolution M vs M-1, top produits, couverture imports |
| Pharmacies | Liste et fiches des pharmacies membres OPSO uniquement |
| Import Excel | Upload des fichiers ventes, associé aux pharmacies OPSO |
| Commandes | Simulateur de commande, historique |
| Objectifs | Suivi des objectifs par pharmacie |
| Offilog | Comparaison prix concurrents (Apothical, etc.) |
| Benchmark | Catalogue produits IP avec données Ameli |

---

## Gestion des accès

### Rôles Supabase (`user_profiles.role`)

| Rôle | Accès |
|------|-------|
| `admin` | CRM complet (toutes pharmacies) + app OPSO |
| `opso` | App OPSO uniquement (pharmacies membres OPSO seulement) |

### Filtrage des données

- Les utilisateurs avec rôle `opso` voient uniquement les pharmacies dont l'id est dans le groupement OPSO Santé (chargé depuis `grp_config.json` dans Supabase Storage).
- Les imports, ventes, et commandes sont filtrés en conséquence.
- Le rôle `opso` n'a pas accès à la page Administration.

### Comptes à créer (via service_role API)
- `frederic.legendre@opso-sante.fr` (ou email réel) — rôle `opso`
- Autres membres équipe OPSO selon besoin

---

## Structure `app.js` OPSO

L'`app.js` de l'app OPSO est une version de l'`app.js` du CRM avec :

1. **Variables de thème** remplacées (tokens CSS → variables OPSO)
2. **Filtre périmètre** : au chargement, `state.pharmacies` est restreint aux membres OPSO
3. **Navigation** identique mais sans accès aux pages hors scope
4. **Sidebar** verte avec nom "OPSO Santé" et logo

Pas de framework, pas de build step — même philosophie vanilla JS.

---

## Déploiement

GitHub Pages déploie automatiquement `opso/` lors d'un push sur `main`.  
Délai : 1-2 minutes après push.

---

## Ce qui ne change pas

- Le CRM Intégral Pharma (`crm/`) reste intact et indépendant
- Le Supabase project est partagé — aucune migration nécessaire
- Les pipelines Python (génération des fichiers de données) restent identiques

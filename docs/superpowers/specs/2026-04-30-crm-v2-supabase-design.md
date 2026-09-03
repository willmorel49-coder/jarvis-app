# CRM V2 — Migration Supabase

**Date :** 2026-04-30  
**Statut :** Approuvé  
**Scope :** Remplacement de localStorage par Supabase Auth + PostgreSQL, en 2 phases

---

## Contexte

Le CRM V1 stocke toutes les données dans `localStorage` et les utilisateurs sont hardcodés dans `app.js`. Cela empêche le partage des données entre commerciaux et expose les mots de passe dans le code source.

**Contraintes :**
- Vanilla JS uniquement, pas de build step
- Déployé sur GitHub Pages (site statique)
- Aucun changement HTML/CSS
- Supabase JS Client chargé via CDN

---

## Architecture

```
GitHub Pages (statique)
  └── crm/index.html
  └── crm/app.js  ←  Supabase JS Client (CDN)
  └── crm/style.css

Supabase (cloud)
  ├── Auth  →  gestion email/password + sessions JWT
  └── Database (PostgreSQL)
       ├── user_profiles
       ├── pharmacies
       ├── imports
       └── sales
```

---

## Phase 1 — Auth Supabase

### Objectif
Remplacer le tableau `USERS[]` hardcodé et la session localStorage par Supabase Auth.

### Changements dans app.js

| V1 | V2 |
|---|---|
| `USERS[]` hardcodé | Supprimé |
| `tryLogin(email, password)` | `supabase.auth.signInWithPassword()` |
| `restoreSession()` | `supabase.auth.getSession()` |
| `logout()` | `supabase.auth.signOut()` |
| Timer 8h manuel | Session JWT gérée par Supabase |

### Changements dans index.html
- Ajout du CDN Supabase JS avant `app.js`
- Ajout de deux `<meta>` pour les clés Supabase (URL + anon key)

### Table `user_profiles`
```sql
create table user_profiles (
  id           uuid primary key references auth.users(id),
  name         text not null,
  role         text not null check (role in ('admin','manager','commercial')),
  pharmacy_ids uuid[]   -- null = toutes, [] = aucune
);
```

### Création des comptes
Les 3 comptes sont créés manuellement dans le dashboard Supabase :
- `admin@integralpharma.fr` / `••••••(retiré)` → role: admin
- `manager@integralpharma.fr` / `••••••(retiré)` → role: manager
- `demo@integralpharma.fr` / `••••••(retiré)` → role: commercial

---

## Phase 2 — Données Supabase

### Objectif
Remplacer les 3 clés localStorage par des tables PostgreSQL, et permettre le partage des données entre tous les utilisateurs.

### Tables

**`pharmacies`**
```sql
create table pharmacies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null,
  color      text not null,
  created_at timestamptz default now()
);
```

**`imports`**
```sql
create table imports (
  id           uuid primary key default gen_random_uuid(),
  pharmacy_id  uuid references pharmacies(id) on delete cascade,
  month        int,
  year         int,
  filename     text not null,
  imported_at  timestamptz default now(),
  imported_by  uuid references auth.users(id)
);
```

**`sales`**
```sql
create table sales (
  id              uuid primary key default gen_random_uuid(),
  import_id       uuid references imports(id) on delete cascade,
  pharmacy_id     uuid references pharmacies(id) on delete cascade,
  month           int,
  year            int,
  art_designation text,
  art_code        text,
  art_id          text,
  qte             decimal default 0,
  pu_brut         decimal default 0,
  pu_net          decimal default 0,
  mnt_net_ht      decimal default 0
);
```

### Sécurité (Row Level Security)

- **admin / manager** : accès complet à toutes les lignes
- **commercial** : accès uniquement aux pharmacies listées dans `user_profiles.pharmacy_ids`
- Les policies RLS sont définies côté Supabase (pas dans app.js)

### Changements dans app.js

| V1 | V2 |
|---|---|
| `save()` / `load()` localStorage | `supabase.from(...).insert()` / `.select()` |
| `state.pharmacies`, `state.imports`, `state.sales` | Chargés depuis Supabase à l'init |
| IDs numériques (`Date.now() + Math.random()`) | UUIDs Supabase |

### Migration des données existantes
- Bouton "Migrer vers le cloud" dans la page Admin (visible si localStorage contient des données)
- Lit les 3 clés localStorage, insère tout en Supabase, puis vide localStorage
- Mapping automatique des anciens IDs numériques vers de nouveaux UUIDs

---

## Ordre d'implémentation

1. Créer le projet Supabase (dashboard web)
2. Implémenter Phase 1 (Auth) → tester → déployer
3. Créer les tables SQL (dashboard Supabase)
4. Implémenter Phase 2 (Données) → tester → déployer
5. Bouton migration localStorage → Supabase

---

## Ce qui ne change pas
- HTML / CSS (aucune modification)
- SheetJS pour la lecture Excel
- Chart.js pour les graphiques
- Logique de parsing des noms de fichiers
- Design tokens dark mode

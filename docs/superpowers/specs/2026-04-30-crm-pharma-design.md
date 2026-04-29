# CRM Intégral Pharma — Design Spec

## Goal
CRM accessible via URL protégé par mot de passe, permettant d'importer des fichiers Excel de ventes pharmaceutiques (10-30 pharmacies), avec des dashboards de performance par pharmacie et par produit, avec gestion multi-utilisateurs à accès différenciés.

## Architecture

### Phase V1 (livrée maintenant)
- App vanilla HTML/CSS/JS — no build step
- Auth locale (mot de passe hardcodé, localStorage)
- Import Excel via SheetJS (CDN)
- Données stockées en localStorage
- Graphiques via Chart.js (CDN)
- Déployée sur GitHub Pages

### Phase V2 (après validation)
- Supabase : Auth email/password + PostgreSQL + Storage
- Row Level Security pour les rôles
- Données persistées en base
- Accès multi-utilisateurs réel

## Structure des données Excel
Source: `Phie de la republique 04 26.xlsx`
| Colonne | Type | Description |
|---|---|---|
| ARTDESIGNATION | string | Nom produit |
| PLVQTE | number | Quantité vendue |
| PLVQTEUS | number | Quantité US |
| PLVPUBRUT_MOY | number | Prix brut moyen |
| PLVPUNET_MOY | number | Prix net moyen |
| PLVMNTNETHT_MOY | number | Montant net HT |
| ARTCODE | string | Code produit |
| ARTID | number | ID produit |

Nom de fichier = source de la pharmacie + période (ex: "Phie de la republique 04 26")

## Schéma de données V1 (localStorage)
```json
{
  "pharmacies": [{ "id", "name", "code", "color" }],
  "imports": [{ "id", "pharmacyId", "month", "year", "filename", "importedAt" }],
  "sales": [{ "id", "importId", "pharmacyId", "month", "year", "artDesignation", "artCode", "artId", "qte", "puBrut", "puNet", "mntNetHt" }],
  "users": [{ "id", "email", "role", "pharmacyIds" }]
}
```

## Rôles
- `admin` : accès total, gestion utilisateurs, import
- `manager` : accès toutes pharmacies, pas gestion users
- `commercial` : accès pharmacies assignées seulement

## Écrans V1
1. **Login** — email + mot de passe
2. **Dashboard** — KPIs globaux, top 5 pharmacies, top 10 produits, graphique CA par mois
3. **Pharmacies** — liste avec search, KPIs par pharmacie, barre de progression
4. **Pharmacie detail** — historique imports, top produits, évolution CA
5. **Produits** — classement global, recherche, volume/CA par produit
6. **Import** — drag & drop multi-fichiers, détection auto pharmacie depuis filename
7. **Admin** — gestion utilisateurs (admin only)

## Design
- **Thème** : dark mode exclusif
- **Background** : `#070B14` (near-black deep navy)
- **Cards** : glassmorphism (`rgba(255,255,255,0.04)` + `backdrop-filter: blur`)
- **Accent primaire** : gradient électrique `#0057FF → #00C6FF`
- **Accent succès** : `#00E5A0` (neon mint)
- **Accent warning** : `#FFB020`
- **Accent danger** : `#FF4D6D`
- **Font** : Space Grotesk (titres) + Inter (corps)
- **Sidebar** : fixe, 240px, icons + labels
- **Animations** : entrées fadeUp, transitions 200ms ease

## Parsing filename
Regex: extraire pharmacie + mois + année depuis le nom de fichier
Ex: "Phie de la republique 04 26" → pharmacie="Pharmacie de la République", mois=04, année=2026

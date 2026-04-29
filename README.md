# Intégral Pharma · CRM + Catalogue

Plateforme pharmaceutique — catalogue mobile + CRM avec import Excel.

## Accès rapide
| App | URL |
|---|---|
| **CRM** | https://willmorel49-coder.github.io/jarvis-app/crm/ |
| **Catalogue** | https://willmorel49-coder.github.io/jarvis-app/ |
| **Repo** | https://github.com/willmorel49-coder/jarvis-app |

## CRM — Fonctionnalités V1
- Login sécurisé (email + mot de passe, session 8h)
- Dashboard KPIs + graphiques (CA, unités, pharmacies, références)
- Top pharmacies + top produits classés
- Import Excel drag & drop — détection auto pharmacie depuis le nom de fichier
- Fiche pharmacie détaillée
- Catalogue produits avec recherche
- Gestion multi-rôles (admin / manager / commercial)

## Comptes de connexion
| Email | Mot de passe | Rôle |
|---|---|---|
| admin@integralpharma.fr | Admin2024! | Admin |
| manager@integralpharma.fr | Manager2024! | Manager |
| demo@integralpharma.fr | Demo2024! | Commercial |

## Format des fichiers Excel attendus
Nommage : `Phie de la republique 04 26.xlsx` (Pharmacie + mois + année)
Colonnes : `ARTDESIGNATION`, `PLVQTE`, `PLVPUBRUT_MOY`, `PLVPUNET_MOY`, `PLVMNTNETHT_MOY`, `ARTCODE`, `ARTID`

## Tech
- HTML/CSS/JS vanilla — aucune dépendance, aucun build
- SheetJS (CDN) — parsing Excel
- Chart.js (CDN) — graphiques
- Données : localStorage (V1) → Supabase prévu (V2)
- Hébergement : GitHub Pages

## Structure
```
APP/
├── crm/
│   ├── index.html     # CRM app shell
│   ├── style.css      # Design system dark mode
│   └── app.js         # Logique complète
├── ip_app-8.html      # Catalogue mobile (legacy)
├── docs/
│   └── superpowers/
│       └── specs/     # Design specs
├── CLAUDE.md          # Contexte pour Claude Code
├── README.md          # Ce fichier
├── DESIGN.md          # Système de design
├── TODO.md            # Roadmap
├── LESSONS.md         # Leçons apprises
└── AGENT.md           # Instructions agents IA
```

## Déployer une mise à jour
```bash
cd ~/jarvis/APP
git add .
git commit -m "description"
git push
```
Mise en ligne automatique en 1-2 minutes.

## Prochaine étape — V2
Connexion Supabase pour persistence serveur + accès multi-utilisateurs réel.

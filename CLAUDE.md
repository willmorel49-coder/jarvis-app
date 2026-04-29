# Intégral Pharma — Context for Claude

## What is this project
Two apps in one repo, both deployed on GitHub Pages:

1. **`ip_app-8.html`** — Catalogue mobile (legacy, single-file, vanilla HTML/CSS/JS)
2. **`crm/`** — CRM pharmaceutique (V1 active) — import Excel, dashboards, auth

## Repo
- GitHub: https://github.com/willmorel49-coder/jarvis-app
- Catalogue: https://willmorel49-coder.github.io/jarvis-app/
- CRM: https://willmorel49-coder.github.io/jarvis-app/crm/

## CRM Stack (crm/)
- `crm/index.html` — App shell + navigation
- `crm/style.css` — Design system dark mode
- `crm/app.js` — Toute la logique (auth, import, rendu)
- SheetJS 0.20.3 (CDN) — parsing Excel .xlsx/.xls
- Chart.js 4.4.4 (CDN) — graphiques
- Auth + données : localStorage (V1) → Supabase prévu (V2)

## CRM — Comptes utilisateurs (V1)
| Email | Password | Rôle |
|---|---|---|
| admin@integralpharma.fr | Admin2024! | admin |
| manager@integralpharma.fr | Manager2024! | manager |
| demo@integralpharma.fr | Demo2024! | commercial |

## CRM — Structure des données Excel attendue
Colonnes : `ARTDESIGNATION`, `PLVQTE`, `PLVQTEUS`, `PLVPUBRUT_MOY`, `PLVPUNET_MOY`, `PLVMNTNETHT_MOY`, `ARTCODE`, `ARTID`
Nom de fichier : `Phie de la republique 04 26.xlsx` → détection auto pharmacie + période

## CRM Design tokens (dark mode)
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#070B14` | Fond global |
| `--blue` | `#0057FF` | Primaire |
| `--mint` | `#00E5A0` | Succès / gains |
| `--amber` | `#FFB020` | Warning |
| `--rose` | `#FF4D6D` | Danger |
| Font | Space Grotesk + Inter | Titres + corps |

## Key conventions
- Vanilla JS uniquement — pas de framework, pas de build step
- CSS variables dans `:root`
- Pages togglées via `.page.active`
- Données en localStorage (clés: `ip_crm_pharmacies`, `ip_crm_imports`, `ip_crm_sales`)

## Deployment
```bash
cd ~/jarvis/APP
git add . && git commit -m "message"
git push
```
GitHub Pages auto-déploie en 1-2 min.

## What NOT to do
- Ne pas ajouter npm/webpack/bundlers
- Ne pas changer les tokens sans màj DESIGN.md
- Ne pas ajouter de libs JS sans accord utilisateur
- Ne pas toucher à ip_app-8.html (legacy)

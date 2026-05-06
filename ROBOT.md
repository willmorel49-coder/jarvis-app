# ROBOT.md — Intégral Pharma · JARVIS APP

> Fichier de référence Claude. Garder sous 200 lignes — extraire vers `.claude/skills/` si besoin.

---

## §1 Identité

| Champ | Valeur |
|-------|--------|
| Projet | Intégral Pharma · CRM + Catalogue |
| Repo | https://github.com/willmorel49-coder/jarvis-app |
| Prod CRM | https://willmorel49-coder.github.io/jarvis-app/crm/ |
| Prod Catalogue | https://willmorel49-coder.github.io/jarvis-app/ |
| Owner | William Morel |
| Langue réponse | Français |

**Philosophie produit :** CRM pharmacie vanille JS, zéro dépendance build. Tout doit fonctionner en ouvrant `index.html` directement.

---

## §2 Stack

| Couche | Techno |
|--------|--------|
| Frontend | Vanilla JS · HTML · CSS (dark mode, CSS variables) |
| Fonts | Space Grotesk + Inter (Google Fonts CDN) |
| Charts | Chart.js 4.4.4 (CDN) |
| Excel parsing | SheetJS 0.20.3 (CDN) |
| Auth + DB | Supabase (Auth · PostgreSQL · Storage bucket `excel-imports`) |
| Hosting | GitHub Pages (branche `main`, auto-deploy) |
| Scrapers | Python 3.9 · requests · BeautifulSoup · openpyxl |
| Données statiques | `crm/offilog-data.js` · `crm/drakkars-data.js` · `crm/cap3000-data.js` |

**Design tokens (dark mode) :**
`--bg #070B14` · `--blue #0057FF` · `--mint #00E5A0` · `--amber #FFB020` · `--rose #FF4D6D` · Font : Space Grotesk + Inter

---

## §3 Variables d'environnement

Clés publiques exposées dans `crm/index.html` (lignes ~152-153). Pas de `.env`.

| Variable | Valeur |
|----------|--------|
| `SUPABASE_URL` | `https://iyvavhnlhxksokkerkos.supabase.co` |
| `SUPABASE_ANON_KEY` | JWT `eyJ...` (voir index.html) |

---

## §4 Commandes

```bash
# Déploiement (GitHub Pages auto après push main)
git add . && git commit -m "feat: ..." && git push

# Pipeline données Offilog
python3 generate_offilog.py    # → crm/offilog-data.js (3 520 produits)

# Scraping Drakkars
python3 scraper_drakkars.py    # → benchmark_drakkars.xlsx (~4-5h, FETCH_PRODUCT_PAGES=True)
python3 generate_drakkars.py   # → crm/drakkars-data.js

# Scraping Cap3000
python3 scraper_cap3000.py     # → benchmark_cap3000.xlsx (~7 min, EAN depuis PHP dump)
python3 generate_cap3000.py    # → crm/cap3000-data.js
```

---

## §5 Git Strategy

| Élément | Convention |
|---------|-----------|
| Branche prod | `main` → push = déploiement immédiat |
| Branches Claude | `claude/<sujet>` |
| Commits | `feat:` `fix:` `chore:` `refactor:` `data:` `ux:` |
| PR | Draft sur branches `claude/` |

---

## §6 Skills disponibles

| Skill | Contenu |
|-------|---------|
| `.claude/skills/crm-structure.md` | Architecture app.js, pages, navigation, état global |
| `.claude/skills/crm-supabase.md` | Schema SQL complet, RLS, Storage, Auth |
| `.claude/skills/crm-offilog.md` | Pipeline Offilog × scrapers × matching EAN/nom |
| `.claude/skills/crm-design.md` | Tokens CSS, composants, conventions UI |

---

## §7 Workflow Claude

1. Lire `tasks/todo.md` si tâches en cours
2. Vanilla JS only — pas de framework, pas de build step, pas de npm
3. Scrapers Python : compatibilité **Python 3.9** stricte (pas de `X | Y` type hints)
4. Matching Offilog : **EAN prioritaire**, nom normalisé en fallback
5. Chaque modification fonctionnelle → `git push` immédiat sur `main`
6. Scrapers longs → lancer en background `&`, surveiller via log file

---

## §8 Pièges connus

| Piège | Règle |
|-------|-------|
| Python 3.9 | Pas de `float \| None` — utiliser `= None` sans annotation |
| Supabase anon key | Format JWT `eyJ...`, pas `sb_publishable_...` |
| Offilog Excel | Feuille `"Croisement Complet"`, pas la feuille active |
| SheetJS | Parser les colonnes **par nom**, pas par index |
| GitHub Pages | Délai 1-2 min après push avant mise en ligne |
| ip_app-8.html | Legacy — ne pas toucher |
| Libs JS | Ne pas ajouter sans accord explicite |

---

## §9 État courant

| Indicateur | Valeur |
|-----------|--------|
| Auth Supabase | 1 compte actif : `demo@integralpharma.fr` / `demo2026` (rôle admin) |
| Offilog | 3 520 produits · Drakkars + Cap3000 matchés par EAN |
| Drakkars | 13 409 produits · 13 409 avec prix |
| Cap3000 | 7 718 produits · 7 718 avec prix et EAN |
| Storage | Bucket `excel-imports` (uploads Excel archivés) |

**Backlog → voir `tasks/todo.md`**

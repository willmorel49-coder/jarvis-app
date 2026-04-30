# Lessons Learned — Intégral Pharma

## Setup & Environnement
- **Homebrew** : installer via `curl -o brew_install.sh <url> && bash brew_install.sh` — éviter le pipe `| bash` (mode non-interactif bloque sudo). Le copier-coller depuis le chat peut splitter les URLs longues en deux lignes.
- **GitHub CLI** : après `brew install gh`, faire `eval "$(/opt/homebrew/bin/brew shellenv bash)"` pour avoir brew dans le PATH avant d'installer autre chose.
- **GitHub Pages** : nécessite `index.html` à la racine ou dans un sous-dossier. Le CRM est dans `crm/` → accessible à `/crm/`.

## Architecture
- **Single-file HTML** (ip_app-8.html) : bien pour une PWA mobile simple. Dès qu'on a de la logique métier complexe, passer à fichiers séparés (html/css/js).
- **Multi-fichiers sans build** (crm/) : `index.html` + `style.css` + `app.js` = maintenable sans aucune dépendance ni bundler.
- **localStorage comme backend V1** : permet de livrer rapidement une V1 fonctionnelle avant d'avoir un vrai backend. Plan clair de migration vers Supabase (V2).
- **CDN pour les libs** : SheetJS + Chart.js via CDN = zéro config, zéro build. Parfait pour GitHub Pages.

## UI/UX
- **Dark mode glassmorphism** : `rgba(255,255,255,0.04)` + `backdrop-filter: blur(20px)` + bordures `rgba(255,255,255,0.08)` = effet premium sans images.
- **Space Grotesk pour les chiffres** : plus lisible que DM Sans sur les KPIs, meilleur rendu des données tabulaires.
- **`font-variant-numeric: tabular-nums`** sur tous les chiffres = pas de saut visuel quand les valeurs changent.
- **CSS variables + thème dark** : tout centralisé dans `:root`, facile de switcher vers un light mode plus tard.

## Excel / Données
- **SheetJS** : `XLSX.read(buffer, {type:'array'})` + `sheet_to_json()` = parsing Excel complet côté client, sans serveur.
- **Parsing du nom de fichier** : regex `(\d{2})\s+(\d{2,4})$` pour extraire mois+année depuis `"Phie de la republique 04 26"`. Robuste pour le format utilisé.
- **Colonnes Excel** : `ARTDESIGNATION`, `PLVQTE`, `PLVPUBRUT_MOY`, `PLVPUNET_MOY`, `PLVMNTNETHT_MOY`, `ARTCODE`, `ARTID` — normaliser avec une fonction `get(...keys)` pour absorber les variations de nommage.

## Performance
- **Destruction des charts Chart.js** : toujours appeler `chart.destroy()` avant de recréer un canvas chart, sinon memory leak et doublons.
- **Render on navigate** : ne rendre une page que quand l'utilisateur y navigue (lazy render) = pas de calculs inutiles au boot.

## Déploiement
- **GitHub Pages + sous-dossier** : `crm/index.html` → URL `/crm/` sans config supplémentaire.
- **Auto-deploy** : tout push sur `main` = mise en ligne en 1-2 min.
- **PATH brew** : doit être réinitialisé à chaque nouveau terminal avec `eval "$(/opt/homebrew/bin/brew shellenv bash)"`. Ajouter au `~/.bash_profile` pour que ce soit permanent. Script fourni : `bash fix-homebrew-path.sh` (à la racine du repo).

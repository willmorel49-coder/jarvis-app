# Lessons Learned — Intégral Pharma

## Architecture
- **Single-file HTML** : fonctionne très bien pour une PWA mobile. Pas besoin de bundler pour ce type d'app.
- **CSS variables** dans `:root` = changements de thème faciles, pas de valeurs dupliquées.
- **Screens togglés par classe `.on`** : pattern simple et efficace pour SPA vanilla.

## UI/UX
- `safe-area-inset` est indispensable sur iOS pour éviter que le contenu passe sous la notch.
- `font-variant-numeric: tabular-nums` sur tous les chiffres évite les sauts visuels quand les valeurs changent.
- `-webkit-tap-highlight-color: transparent` + `:active { transform: scale(.96) }` = feedback tactile premium sans librairie.
- Les gradients radiaux en overlay sur les headers dark donnent de la profondeur sans alourdir.

## Performance
- Google Fonts avec `preconnect` dans le `<head>` = chargement plus rapide.
- `overflow: hidden` sur `html, body` avec positionnement absolu des screens = pas de scroll parasite.
- Animations CSS uniquement (pas de JS pour les transitions) = 60fps garanti.

## Déploiement
- GitHub Pages nécessite un fichier `index.html` à la racine — renommer le fichier avant de pousser.
- Le PATH de brew doit être configuré avec `eval "$(/opt/homebrew/bin/brew shellenv bash)"` au démarrage du terminal.

## Workflow
- Travailler dans `~/jarvis/APP/` et pusher directement sur `main` pour voir les changements live en 1-2 min.

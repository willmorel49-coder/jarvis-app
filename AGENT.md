# Agent Instructions — Intégral Pharma

## Contexte pour les agents IA

Ce projet est une **PWA pharmaceutique single-file** développée avec HTML/CSS/JS vanilla.
L'objectif est de garder l'app simple, rapide et déployable sans build step.

## Règles absolues
1. **Ne jamais introduire de dépendances npm** — pas de React, Vue, webpack, etc.
2. **Conserver le design system** défini dans DESIGN.md (tokens CSS, polices, rayons)
3. **Mobile-first** — tester mentalement à 390px avant tout
4. **Single file** — tout le CSS et JS reste dans `index.html` sauf instruction contraire
5. **Pousser sur main** pour déployer — GitHub Pages gère le reste

## Comment ajouter un écran
```html
<div class="screen" id="mon-ecran">
  <!-- contenu -->
</div>
```
```js
function showMonEcran() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('mon-ecran').classList.add('on');
}
```

## Comment ajouter un composant CSS
- Ajouter les styles dans le bloc `<style>` existant
- Utiliser les variables CSS existantes (`var(--blue)`, etc.)
- Suivre la nomenclature BEM courte utilisée dans le fichier (ex: `.card`, `.card-inner`, `.card-title`)

## Déploiement automatique
```bash
cd ~/jarvis/APP
git add index.html
git commit -m "feat: description courte"
git push
```

## Profils utilisateurs
- **Commercial** : voit catalogue + favoris + top produits
- **Manager** : + KPIs équipe + statistiques
- **Direction** : + dashboard global

## Données
Actuellement les données sont mockées en JS inline.
Pour une vraie intégration API, préférer `fetch()` vers une API REST.

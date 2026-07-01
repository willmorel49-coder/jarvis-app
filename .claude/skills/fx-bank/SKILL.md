---
name: fx-bank
description: Banque de composants premium (3D, motion, design) recodés en VANILLA et stables Safari, pour assembler des sites ultra-tendance (niveau Awwwards / 21st.dev / Ciao Kombucha) sans repartir de zéro. Actions : build/create/assembler un site, landing, hero, section ; ajouter un effet (aurora, spotlight, bento, 3D, parallax, marquee, curseur custom, carrousel, scroll-scrub, kinetic type…). Utiliser quand on construit une page vitrine Intégral Pharma ou tout site « waouh » en HTML/CSS/JS sans build.
---

# FX-BANK — banque d'effets vanilla (Safari-safe)

Notre « 21st.dev maison » : une bibliothèque de composants **3D / motion / design** premium, chacun **recodé en vanilla** (HTML/CSS/JS, Three.js via CDN pour la 3D) et **stable Safari**. On **assemble** un site ultra-tendance à partir de ces briques au lieu de tout réécrire.

## Où
- **Catalogue navigable** : `site-integral/fx-bank/index.html` (aperçu live de chaque composant).
- **Composants** : `site-integral/fx-bank/components/<nom>.html` — chaque fichier est **une démo autonome** (s'ouvre par double-clic) + le **code copiable** délimité par `<!-- FX:COPY:START -->` … `<!-- FX:COPY:END -->`.
- En ligne : `https://willmorel49-coder.github.io/jarvis-app/site-integral/fx-bank/`

## Comment l'utiliser (pour Claude)
1. Choisir les composants pertinents dans la liste ci-dessous (ou ouvrir le catalogue).
2. Dans le fichier du composant, copier le bloc entre `FX:COPY:START` et `FX:COPY:END`.
3. Coller dans la page cible, adapter les variables indiquées en commentaire (couleurs, textes, données).
4. Vérifier les **règles Safari** (voir plus bas) et le fallback `prefers-reduced-motion`.

## Composants
**3D (Three.js CDN + fallback)**
- `product-3d` — objet produit 3D (gélule/canette) qui tourne, suit la souris + réagit au scroll.
- `particle-network` — particules 3D reliées (constellation/réseau) réactives au curseur.
- `shader-aurora` — plan plein écran, shader GLSL de flux fluide bleu/violet/orange.
- `globe-arcs` — sphère de points + arcs logistiques lumineux animés.

**Fonds & glow (CSS, sans flou)**
- `aurora-bg` — nappes de dégradés qui dérivent (aurora premium).
- `spotlight-cursor` — halo radial qui suit le curseur.
- `sparkles-meteors` — étincelles + météores.
- `grain-vignette` — grain SVG + vignette (texture premium).

**Scroll (le cœur des sites « incroyables »)**
- `smooth-scroll` — smooth scroll lerp façon Lenis.
- `scroll-scrub-pin` — section pinnée animée selon la progression du scroll (type ScrollTrigger).
- `horizontal-scroll` — défilement horizontal piloté par le scroll vertical.
- `parallax-layers` — parallaxe multi-couches (scroll + souris).

**Typographie & kinetic**
- `kinetic-word-reveal` — titre révélé mot par mot (masque + stagger).
- `marquee-infinite` — bandeau défilant infini.
- `word-morph` — un mot qui cycle entre plusieurs (sans gooey).
- `count-up` — compteurs animés au scroll (format fr-FR).

**Boutons & cartes**
- `magnetic-button` — bouton magnétique.
- `moving-border-cta` — CTA à bordure conique animée.
- `tilt-card-3d` — carte inclinée en 3D au survol + reflet.
- `bento-grid` — grille bento avec spotlight curseur.

**Blocs & « Ciao Kombucha »**
- `product-carousel` — carrousel produit avec couleur de thème par item.
- `color-morph-sections` — la couleur de thème change par section au scroll.
- `custom-cursor` — curseur personnalisé qui grossit sur l'interactif.
- `sticky-cta` — CTA collant + back-to-top.

## Règles Safari (NON négociables)
JAMAIS `background-clip:text` / `-webkit-background-clip:text` · JAMAIS `backdrop-filter` · JAMAIS `filter:blur` sur grande surface · 1 seule `<video autoplay>` max. Glow / verre / aurora se font en **radial/conic-gradients + rgba + transform** (jamais de flou). Chaque composant respecte `@media (prefers-reduced-motion: reduce)`.

## Contexte marque
Palette Intégral : bleu `#0050E6` + orange `#F39A1B`, encre `#0A0E1A`, clair `#F8FAFC`. Voir aussi [[project_integral_site_vitrine]]. Skill complémentaire : `ui-ux-pro-max` (choix pattern/style/palette/typo).
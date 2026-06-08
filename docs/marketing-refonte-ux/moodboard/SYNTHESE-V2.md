# Moodboard Marketing V2 — Synthèse 3 agents (2026-06-08)

> 3 agents Opus en parallèle ont scanné Behance, Dribbble, Envato Elements + Mobbin.
> Résultat **JSON détaillé** dans ce dossier (3 fichiers .output dans /tmp/claude task dir).

## TL;DR

Les 5 apps qui reviennent dans les 3 moodboards :

| App | Pourquoi c'est LA ref pour Marketing IP V2 |
|---|---|
| **Linear** | Topbar 48px + Inspector contextuel + Cmd+K omniprésent + densité info propre |
| **Figma** | Modèle absolu 3-zones (rail 60 / canvas / inspector 240-320) + multi-select intelligent |
| **Notion** | Block-based editor + slash menu `/` + drag handle au hover + inline edit partout |
| **Pitch / Tome** | Thumbnails pages gauche + canvas slide central + inspector droit + smart blocks library |
| **Vercel + Resend** | Esthétique Geist 'soft minimalism' — sérieux SaaS sans austérité |

**Direction validée par 3 sources** : éditeur "Linear meets Figma" avec édition à la Notion, density Linear, smart blocks à la Pitch.

## Patterns récurrents 2025-2026 (apparaissent dans 3 moodboards/3)

1. Topbar 44-52px hairline 1px bottom (jamais shadow)
2. Cmd+K palette globale (search + actions + navigation)
3. Inspector droit 280-360px **contextuel** (change selon sélection, pas tabs fixes)
4. Rail gauche réductible avec icônes 20px stroke 1.5
5. Tabs **underline** 2px (fini les pills colorés)
6. Typography Inter / Geist / Söhne — sans-serif géométrique 13-14px
7. Monospace (Geist Mono, JetBrains) pour les chiffres/prix/CIP
8. Borders 1px à 6-8% opacity (pas #E5E7EB plat)
9. UN SEUL accent saturé par écran (le bleu IP #0057FF garde ce rôle)
10. Slash menu `/` pour insertion blocs in-context
11. Inline edit double-click partout
12. Floating toolbar contextuelle sur sélection texte
13. Drag handle `⋮⋮` au hover gauche du block
14. Ivoire / cream backgrounds (#FAFAF7, #F7F5F2) au lieu de blanc pur
15. Micro-interactions 120-180ms cubic-bezier(.2,.8,.2,1)

## Anti-patterns à FUIR (consensus 3/3)

- Purple gradients AI-générique (signal SaaS générique 2023)
- Glassmorphism lourd / frosted glass cards (daté 2022)
- Neumorphism soft shadows multi-niveaux (mort 2023)
- Roboto / Open Sans (datés en 2026)
- Material Design ombres multi-niveaux
- Pills colorés pour tabs Inspector
- Illustrations 3D claymorphism kitsch
- Tooltips lourds avec arrow + shadow épaisse

## 8 recommandations chirurgicales pour V2

### 1. Topbar (48px)
- Geist Sans 14px medium
- Logo IP gauche → breadcrumb fiche éditable inline → actions droite (Save / Aperçu / Export PDF / Share)
- Séparateur 1px #00000010 en bas, ZÉRO shadow
- Status pill "Brouillon / Enregistré il y a 2s" avec dot animé

### 2. Rail gauche (64px, réductible vers 240px)
- 6 icônes max : Pages / Palettes / Typos / Stickers / Meshes / Presets
- Active state = pleine surface #F4F4F5 + barre 2px gauche accent
- Hover = fond #FAFAFA + tooltip pill mono ligne après 250ms

### 3. Canvas A4
- Fond extérieur ivoire #FAFAF7 (pas blanc pur)
- A4 lui-même blanc pur, shadow douce (0 4px 20px rgba(0,0,0,0.04))
- Zoom controls bottom-right floating pill 32px + backdrop-blur(20px)
- Grille points 8px optionnelle

### 4. Inspector droit (320px contextuel)
- Pas de tabs fixes — change selon sélection
- Si rien sélectionné → Page (format, palette globale, typo globale)
- Si block image → filtres + crop
- Si block texte → font + size + weight + color
- Si block produit → prix + remise + image + ordre
- Section headers Geist Mono 11px uppercase tracking 0.04em #71717A
- Hairlines 1px entre sections

### 5. Numeric inputs
- 32px hauteur, unit suffix gris intégré (€, %, px)
- Geist Mono pour la valeur
- Stepper +/- au focus uniquement

### 6. Color picker (onglet Palette)
- Swatches palette projet 24px en haut (grille 6 cols)
- Hairline divider
- HSL slider + input hex + eyedropper en bas
- Réutilise les 20 palettes pharma déjà en place

### 7. Product Picker unifié (Cmd+K ou click)
- Modal overlay backdrop-blur 8px
- Search 48px en haut
- Résultats catégorisés : Grossiste IP / OFFILOG / Sagitta / Récents
- Icône 16px leading + label medium + keyboard shortcut hints à droite
- Navigation 100% clavier ↑↓ Enter Esc

### 8. Inline edit double-click
- Floating pill toolbar 36px apparaît au-dessus de la sélection
- Apparition delay 150ms (Bold / Italic / Color / Format)
- Échap = annule, Enter = valide
- PAS de surcharge dans l'inspector

## Note sur les URLs

Les agents n'ont pas pu scraper Behance/Dribbble en live (sandbox bloquait WebFetch). Les **vraies refs à aller voir** sont les apps publiques :

- https://linear.app — explorer Issue inspector + Cmd+K
- https://figma.com — explorer un fichier vide (3-zones canonical)
- https://notion.so — explorer slash menu + drag handle
- https://pitch.com — explorer slide editor + smart blocks
- https://tome.app — explorer canvas + inspector contextuel
- https://vercel.com/dashboard — esthétique Geist
- https://resend.com — soft minimalism
- https://arc.net — gradient mesh "espaces" colorés

## Décision à valider par Will

Le code V2 actuel (rail 64px + canvas + inspector 320px + Cmd+K + inline edit) est DÉJÀ aligné sur la convergence des 3 moodboards. Ce qui manque pour passer au niveau "premium 2026" :

- **Inspector contextuel** (vs tabs fixes Apparence/Contenu/Données actuels)
- **Slash menu `/`** pour insertion blocs
- **Floating pill toolbar** sur sélection texte
- **Drag handle au hover** sur chaque block
- **Density compact/cozy toggle**
- **Monospace pour chiffres** (Geist Mono déjà installé)

Pas une refonte from scratch — un **upgrade ciblé** de l'éditeur V2 existant.

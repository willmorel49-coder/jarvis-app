# Kit Design & Motion — CRM Intégral Pharma (vanilla, hors-ligne)

Boîte à outils partagée à disposition de toutes les pages. **Zéro dépendance** :
tout est déjà chargé (`v2-motion.js`, `v2-motion.css`, tokens `v2.css`). Reproduit
la sensation **Framer Motion** + patterns **21st.dev** + règles **ui-ux-pro-max**,
100 % vanilla, compatible ouverture directe du fichier / hors-ligne / Safari.

---

## 1. API Motion — `V2.motion.*` (façon Framer Motion)

Toujours **RM-safe** : si `prefers-reduced-motion`, l'état final est posé sans animation.

| Framer Motion | Ici (vanilla) | Usage |
|---|---|---|
| `animate()` | `V2.motion.animate(el, keyframes, {duration,delay,easing,to,onfinish})` | anim WAAPI générique ; `to` = état final posé si RM |
| `initial/animate` (entrée) | `V2.motion.enter(el, {y=8,delay,duration=320})` | fondu + glisse depuis le bas |
| `staggerChildren` | `V2.motion.stagger(els, {step=40,cap=12,y})` | cascade d'entrée |
| `whileInView` | `V2.motion.inView(el, cb, {threshold,rootMargin})` | déclenche `cb` 1×, à l'écran |
| `layout` (FLIP) | `V2.motion.layout(container,{selector}).after()` ou `V2.motion.recordThen(container, mutateFn)` | anime le repositionnement après filtre/tri/ajout |
| count-up | `V2.motion.countUp(el)` | compteur chiffré animé |
| `whileHover` magnétique | `V2.motion.magnetic(el)` (ajoute `.mo-mag`) | survol attiré vers le curseur |
| easings | `V2.motion.ease.out / .soft / .spring` | courbes cohérentes app |
| `useReducedMotion()` | `V2.motion.reduced()` | booléen |

**Auto, sans rien coder** (déjà global, appliqué à chaque render) :
- reveal au scroll des blocs `.v2-hero, .v2-pil, .v2-kpi, .v2-card` ;
- transition de vue entre pages ; appui/ripple sur boutons ; magnétique sur `.mo-mag` ;
- count-up sur `.v2-kpi-v.mono` et tout `[data-count]`.

### Exemples courts
```js
// cascade sur une grille fraîchement rendue
V2.motion.stagger(root.querySelectorAll('.v2-card'));

// FLIP quand on filtre une liste (le plus « Framer Motion »)
V2.motion.recordThen(listEl, function(){ applyFilter(); }, { selector: '.row' });

// révéler + compter un chiffre quand il arrive à l'écran
V2.motion.inView(kpiEl, function(el){ V2.motion.countUp(el.querySelector('[data-count]')); });

// rendre un CTA magnétique
V2.motion.magnetic(document.getElementById('cta'));
```

### Classes CSS opt-in (déjà dans v2-motion.css)
`.mo-pop` (pop spring), `.mo-fade` (fondu), `.mo-mag` (magnétique), `.mo-press`
(feedback appui), `.mo-skeleton` (shimmer chargement). Tokens : `--mo-dur`,
`--mo-dur-fast/slow`, `--mo-ease-in/out/soft/spring`, `--mo-lift`.

---

## 2. Règles ui-ux-pro-max (priorité 1→8, à respecter)

1. **Accessibilité (CRITIQUE)** : contraste ≥ 4.5:1, focus visible (jamais retiré),
   aria-labels, boutons icône = toujours un label.
2. **Tactile (CRITIQUE)** : cible ≥ 44×44px, ≥ 8px d'espacement, feedback de
   chargement, jamais d'état instantané (0ms).
3. **Perf** : lazy-load images, réserver l'espace (pas de saut de layout / CLS),
   ne pas animer width/height (préférer transform/opacity).
4. **Style** : cohérent, icônes SVG (jamais d'emoji comme icône).
5. **Layout responsive** : mobile-first, pas de scroll horizontal, pas de largeur px fixe.
6. **Typo & couleur** : base 16px, interligne 1.5, tokens sémantiques (pas de hex brut).
7. **Animation** : 150–300ms, le mouvement porte du SENS (pas décoratif),
   continuité spatiale, toujours `prefers-reduced-motion`.
8. **Formulaires** : labels visibles, erreur près du champ, divulgation progressive
   (ne pas tout montrer d'un coup).

Base interrogeable : `.claude/skills/ui-ux-pro-max/` (styles, palettes, fonts, charts).

---

## 3. Patterns 21st.dev (réimplémentés vanilla)

- **Carte à spotlight curseur** : radial-gradient piloté par `--mx/--my` sur `::after`
  (voir `.v2-lch-card` de l'accueil — modèle à copier).
- **Bento grid** : grilles 2×N de cartes calmes, hiérarchie par taille.
- **Bouton primaire lumineux** : `.v2-btn-primary` + `--sh-blue`.
- **Barre de recherche héro** : grande, ombre douce, focus-within accentué.
- **Chips/segments** : `.v2-chip`, `.v2-seg` pour filtres et onglets.
- **Skeletons** : `.mo-skeleton` pendant les chargements (jamais d'écran vide brut).
- **Reveal en cascade** au scroll : `data-reveal` + `--mo-i` (auto).

---

## 4. Garde-fous DURS (ne jamais violer)

- **Zéro dépendance externe** : aucun CDN/lib/police/script web. Vanilla only.
  (Framer Motion = React → interdit ; on utilise `V2.motion` à la place.)
- **Fonctionnalités & données préservées** : on refactore la présentation/motion,
  jamais la logique. Conserver noms de fonctions, `V2.pages.X`, champs, ids, handlers.
- **Aucune donnée inventée**, **aucun objectif par commercial**.
- Vocabulaire : « **abandon de marge** » (jamais « remise ») ; « net remisé » OK.
- **Mode OPSO légitime** (vert #11a63c / `V2_BRAND.opso`) : ne pas casser.
- **Safari** : jamais `background-clip:text` sur grand texte ; pas de
  `backdrop-filter` + vidéos autoplay.
- Toujours respecter `prefers-reduced-motion` (l'API le fait pour toi).
- JS valide (`node -c`) ; ids de `<style>` uniques.

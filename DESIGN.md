# Design System — Intégral Pharma

## Couleurs
```css
/* Brand */
--blue:     #0057FF  /* Primaire — CTAs, liens */
--blue-d:   #0041CC  /* Hover primaire */
--blue-lt:  #EAF2FF  /* Fond badge bleu */
--navy:     #0B1F4D  /* Headers, splash bg */
--green:    #14B86A  /* Gains, positif */
--green-d:  #0E9456  /* Texte gain */
--amber:    #FF9F1C  /* Warning */
--rose:     #F43F5E  /* Danger, perte */
--purple:   #7C3AED  /* Accent secondaire */

/* Neutres */
--bg:       #F7FAFF  /* Fond global */
--card:     #FFFFFF  /* Fond carte */
--border:   #E8EEFF  /* Bordures */
--text:     #0B1F4D  /* Texte principal */
--text2:    #64748B  /* Texte secondaire */
--text3:    #94A3B8  /* Texte tertiaire / placeholders */
```

## Typographie
- **Font** : DM Sans (Google Fonts)
- Titres écran : `34px / 800`
- Titres section : `17px / 700`
- Corps : `14-15px / 400-500`
- Labels : `10-12px / 600-700 uppercase`
- Chiffres : `font-variant-numeric: tabular-nums`

## Rayons
```css
--r:    20px   /* Cartes principales */
--rs:   14px   /* Cartes secondaires */
--rxs:  10px   /* Petits éléments */
--pill: 999px  /* Badges, boutons pill */
```

## Ombres
```css
--sh:   légère (cartes repos)
--sh2:  medium (cartes hover)
--sh3:  forte (modals)
--sh-b: bleue (bouton primaire)
--sh-g: verte (bouton succès)
```

## Composants
### KPI Card
- Grid 2 colonnes
- Icône 38px avec fond coloré
- Valeur 22px/800
- Label 11px/text3

### Product Row (tl-row)
- Barre couleur gauche 3px
- Nom + meta
- Gain à droite en vert

### Bouton primaire
- Background `--blue`
- Border-radius `--pill`
- Font 14px/700
- Box-shadow `--sh-b`

## Animations
| Nom | Usage |
|---|---|
| `fadeUp` | Entrée d'éléments |
| `logoIn` | Logo splash |
| `splashOut` | Fermeture splash |
| `cardIn` | Apparition cartes |
| `slideUp` | Modals / bottom sheets |
| `shimmer` | Skeleton loading |
| `pulse` | États de chargement |

## Règles
- Mobile-first, max-width 430px testé
- Tap targets minimum 44px
- `-webkit-tap-highlight-color: transparent` sur tous les éléments cliquables
- `safe-area-inset` pour iPhone notch

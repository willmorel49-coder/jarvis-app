# Benchmark UX — Agent B (Opus, 2026-06-08)

## Architecture cible (vision Figma/Canva)

3 zones unifiées dans l'éditeur :
1. **Rail gauche 240px** : sections de la fiche (Header / Tableau / Footer) + drag-drop reorder
2. **Canvas central A4** : zoom auto-fit, fond gris #f5f5f5, ombre douce, contrôles zoom +/- discrets
3. **Property panel droit 320px** : 4 onglets fixes (Apparence / Contenu / Données / Paramètres)

**Topbar minimaliste persistante** : logo + breadcrumb éditable + statut save + avatar + bouton primaire Télécharger PDF.

## 7 north star principles

1. Toujours visible : titre fiche, statut sauvegarde, bouton PDF, prix net
2. 1-clic pour 3 actions vitales : créer / ajouter produit / générer PDF
3. **Live preview A4 immédiat** : changement = repaint <100ms, plus de bouton "Prévisualiser"
4. **Zéro modale empilée** : tout en panneau/drawer/inline
5. **Inline editing partout** : double-clic = édite directement sur canvas
6. **Mobile = même feature parity** que desktop, jamais mode dégradé
7. Charge cognitive progressive : property panel ne montre que les contrôles pertinents

## 7 écrans cibles avec wireframes ASCII

| Écran | Pattern dominant |
|---|---|
| **Marketing Hub** | Hero du mois + 4 templates + Recent sheets grid + Empty state actionnable |
| **Editor** | Topbar + rail gauche sections + canvas A4 + property panel droit 4 onglets |
| **Product Library Picker** | Search omnibox unifiée + filtres sidebar + grid virtualisé + selection cart persistante droite |
| **Templates Gallery** | 4 cards templates + 80 design presets (palette+typo combos) avec previews |
| **Mes fiches** | Liste avec tabs filtres + tri + bulk actions + actions hover Duplicate/Download/Delete |
| **Mobile Editor** | Topbar compact + canvas full-width + bottom sheet 3 snap-points + FAB Télécharger PDF |
| **PDF Preview Modal** | Preview pages + nom fichier éditable + options qualité + bouton Partager lien |

## 25 patterns benchmarkés (Figma · Notion · Linear · Canva · Apple Pages · Adobe Express · Pitch · Tome)

Top 10 applicables Intégral Pharma :
1. **Sidebar property panel contextuelle** (Figma Right Panel) — adopter avec 4 onglets fixes
2. **Canvas central zoomé auto-fit** (Figma frame) — A4 centré, fond gris, ombre douce
3. **Omnibox unifiée multi-source** (Linear ⌘K) — 1 search bar pour BENCHMARK/OFFILOG/Sagitta/Top ventes
4. **Selection cart persistante** (Pinterest board) — droite du picker, toujours visible
5. **Inline editing double-clic** (Notion blocks) — titre, footer, prix éditables sur canvas
6. **Auto-save indicateur sticky** (Google Docs) — debounce 1.5s + 'Enregistré il y a 2s'
7. **Bottom sheet drawer mobile** (Apple Maps) — property panel mobile en sheet swipeable 3 snap-points
8. **Optimistic UI + skeleton loading** (Linear/Notion) — ajout produit immédiat, rollback si échec Supabase
9. **Recent items grid** (Figma recent files) — 80% des sessions = reprendre/dupliquer
10. **Duplicate-as-starting-point** (Figma file dup) — Pharm A → dup → Pharm B en 20s

## 21 must-haves prioritaires
Auto-save 1.5s · Bouton PDF toujours visible · Live preview <100ms · Inline editing · 4 templates · Picker unifié · Smart defaults · Property panel 4 onglets · Rail gauche sections · Drag-drop · Undo/Redo 50 niveaux · Mobile bottom sheet · Recent sheets · Duplicate · Overflow A4 detection · Skeleton + optimistic UI · 20 palettes/14 typos/20 stickers/12 gradients/12 patterns/12 presets · Toast non-bloquant · Breadcrumb éditable · Empty state Hub actionnable · Compat Safari iOS 16+ & Chrome desktop vanilla JS

## 18 anti-patterns à éviter
- ❌ Modales superposées · ❌ Bouton "Prévisualiser" séparé · ❌ Form long sans steps
- ❌ Scroll horizontal forcé mobile · ❌ Tabs+sidebar+breadcrumb+topbar surchargés
- ❌ Bouton "Enregistrer" explicite (auto-save only) · ❌ Pop-up confirmation systématique (undo via toast)
- ❌ Drag-drop sans handle visible · ❌ Settings cachés menu burger profond
- ❌ Pinch-zoom conflit page · ❌ Recherche sans autocomplete sur 10500 items
- ❌ Loading spinner full-screen · ❌ alert()/confirm() bloquants natifs
- ❌ Mobile read-only ou dégradé · ❌ Multiple sources de vérité produits
- ❌ Onboarding tutorial step-by-step intrusif · ❌ Couleur primaire partout
- ❌ Icônes sans label texte > 40 ans (tooltip systématique)

## 13 métriques succès
- **Time to first sheet** < 90s
- **Time to repeat sheet** < 30s
- **Time to new from scratch** < 60s
- % images produit OFFILOG > 80%
- % sessions mobile > 30%
- Auto-save success > 99.5%
- PDF gen time iPhone 12 4G < 3s
- Bounce rate Hub < 15%
- % Duplicate vs from scratch > 60%
- Drop-off picker→PDF < 10%

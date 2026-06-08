# Spec Implémentation — Agent C (Opus, 2026-06-08)

## Vision cible : éditeur 3-zones unifié

```
┌────────────────────────────────────────────────────────────────────────┐
│ [←] Titre fiche éditable · Enregistré il y a 2s    [Dupliquer] [PDF]  │
├────┬───────────────────────────────────────────────────┬───────────────┤
│ 🏠 │ [Ajuster ▾] [100%] [150%] ━━━━●━━━━━━━ 85%       │ Apparence │Co│
│ ── │                                                  │ ────────────  │
│ ✏️  │       ┌────────────────────────┐                 │ ▾ Template    │
│ 🎨 │       │  ☀️ FICHE SOLAIRE JUIN │                 │  ┌─┬─┬─┬─┐    │
│ 📊 │       │                        │                 │  │○│ │ │ │    │
│ 🕐 │       │  ┌──┐ Nuxe Sun  12,90€ │                 │  └─┴─┴─┴─┘    │
│    │       │  └──┘                  │                 │ ▾ Palette     │
│    │       │  ┌──┐ Avène    15,50€ │                 │  Tendances    │
│    │       │  └──┘                  │                 │  ●●●●●●●●     │
│    │       └────────────────────────┘                 │  Neutres      │
│    │                                                  │  ●●●●●●       │
│ ?  │                                                  │  Signature IP │
│    │                                                  │  ●●●●●●       │
└────┴───────────────────────────────────────────────────┴───────────────┘
  Rail 64px           Canvas central (fiche A4)              Inspector 320px
```

## 7 principes directeurs

1. **Aperçu live toujours visible** — la fiche A4 occupe le centre en permanence
2. **Édition inline directe** — double-click sur prix/titre → input → blur sauvegarde
3. **Property Inspector contextuel** — UN seul panneau droit remplace TOUTES les modales
4. **Zéro modale empilée** — règle absolue, picker dans Inspector pas en modal
5. **Une seule source de vérité visuelle** — ce que tu édites EST ce que tu imprimes
6. **Progressive disclosure** — 80/20 à 1 clic, contrôles avancés en disclosure
7. **Mobile parité** — bottom sheet swipeable, jamais mode dégradé

## Plan d'implémentation en 12 steps

| Step | Objectif | Lignes estimées | Phase |
|---|---|---|---|
| 1. Topbar unifié | Sticky minimaliste : ←, titre éditable, statut save, PDF | 120 JS + 90 CSS | Foundation |
| 2. Left rail navigation | Rail 64px icônes : Hub/Éditer/Thème/Données/Historique | 80 JS + 100 CSS | Foundation |
| 3. Center canvas live preview | A4 zoomé auto-fit, click sélectionne, dbl-click édite | 300 JS + 180 CSS | Foundation |
| 4. Right Inspector contextuel | Panneau 320px, 3 onglets Apparence/Contenu/Données | 500 JS + 350 CSS | Inspector |
| 5. Product picker unifié | 1 search + 3 sources (IP/OFFILOG/Sagitta) avec tags couleur | 400 JS + 250 CSS | Inspector |
| 6. Hub refondu | 13 mois compact + recent sheets + planning grid | 200 JS + 180 CSS | Polish |
| 7. Sagitta table dense | Table triable au lieu de cards (gain place) | 150 JS + 100 CSS | Polish |
| 8. Inline edit engine | Module réutilisable double-click → input | 250 JS + 60 CSS | Inspector |
| 9. Auto-save state machine | Debounce 600ms localStorage + 2s Supabase, statut sticky | 180 JS | Inspector |
| 10. Polish micro-interactions | Transitions, skeletons, empty states, toasts | 50 JS + 200 CSS | Polish |
| 11. Mobile adaptive layout | Bottom sheet swipeable, bottom tabs, FAB PDF | 150 JS + 250 CSS | Mobile |
| 12. Keyboard shortcuts + a11y | ⌘S/D/Z/K/1-2-3, focus visible, ARIA, '?' cheatsheet | 120 JS | Mobile |

**Total estimé : ~2 500 JS + ~1 800 CSS = ~4 300 lignes**.

## Migration en 4 phases (~9 jours)

| Phase | Durée | Steps | Deliverable |
|---|---|---|---|
| Foundation | J1-J2 | 1, 2, 3 | Aperçu live au centre, ancien formulaire conservé temp |
| Inspector + Inline | J3-J5 | 4, 5, 8, 9 | Expérience cible desktop fonctionnelle, modales supprimées |
| Hub + Sagitta + Polish | J6-J7 | 6, 7, 10 | Expérience desktop léchée |
| Mobile + A11y | J8-J9 | 11, 12 | Parité mobile Safari iOS, navigation clavier complète |

## Rétrocompat ZÉRO migration

- **Modèle de données inchangé** : sheets continuent exactement même structure (id, title, products[], theme, palette, typo, sticker, gradient, pattern, footer)
- **localStorage keys préservées** : mk_sheets_v2, mk_drafts, mk_recent
- **Supabase schema inchangé**
- **Feature flag** `MK_REFONTE_ENABLED` pour basculer ancien ⇄ nouveau pendant la transition
- **Rollback** = remettre flag à false, aucune perte

## 12 scenarios de test (TS01-TS12) avec target_time

Top 4 critiques :
- **TS01 Nouvel user** : créer fiche solaire en < 90s
- **TS02 Power user** : duplique + ajuste + PDF en < 30s
- **TS03 Mobile** : consulter fiche en 3 taps / < 5s
- **TS05 Inline edit prix** : 12,90 → 19,90 en < 5s

## 5 risques + mitigations

| Risque | Mitigation |
|---|---|
| Édition inline bugs positionnement | ResizeObserver + getBoundingClientRect, tests 50/100/150% |
| Perf re-render canvas | Diff-based re-render zones isolées via data-attribute |
| Bottom sheet iOS Safari conflit scroll | touch-action:none sur handle, tests iOS 15-17 |
| **Will rejette la refonte (3× précédents)** | **PRÉSENTER 2-3 MOCKUPS STATIQUES AVANT TOUTE LIGNE DE CODE** |
| Conflits CSS design system 2026 | Préfixer `.mk-edit-*` (nouveau) vs `.mk-*` (ancien), audit avant merge |

## Ordre d'exécution recommandé

1. **VALIDATION VISUELLE WILL (mockups statiques)** avant tout code
2. Step 1 (Topbar) + Step 2 (Rail) — squelette nav
3. Step 3 (Canvas live preview) — réutilise renderSheetHTML existant
4. Step 9 (Auto-save) — branché tôt pour pas rétro-fitter
5. Step 4 (Inspector) — gros morceau d'un seul tenant
6. Step 8 (Inline edit) — branche sur Step 3 + 9
7. Step 5 (Product picker) — dans l'Inspector
8. Step 6 + 7 (Hub + Sagitta) — parallélisables
9. Step 11 (Mobile) — après desktop stable
10. Step 10 + 12 (Polish + Keyboard) — finalisation

# Audit UX Marketing — Agent A (Opus, 2026-06-08)

## Diagnostic global
Module Marketing IP riche fonctionnellement (4 templates, 20 palettes, 20 stickers, 14 typos, planning 13 mois dédupliqué, picker saisonnier, comparatif Sagitta, top ventes 3 canaux, OFFILOG, bibliothèque) mais souffre d'une **architecture d'information SURCHARGÉE** : 7 sections empilées verticalement sur la page d'accueil grossiste totalisent **4000+ lignes de scroll** potentiel sur desktop.

Hiérarchie plate (toutes les sections au même niveau visuel), aucun rythme guidant l'œil. L'éditeur classique reste isolé du picker saisonnier (2 flows divergents non réconciliés). L'aperçu modal mélange 3 paradigmes UI (header sticky + sidebar 320px + canvas zoomé) avec un wrapper-sizing scale-pattern fragile. Manque cruel de feedback action (pas de toast de sauvegarde auto-persistante visible, pas d'undo, pas d'indicateur de modification non sauvegardée). Mobile passable mais touchscreen flow brut sur picker + éditeur. Aucun onboarding ni découvrabilité.

## Persona Will Morel
Commercial pharma B2B Intégral Pharma Normandie. Visite ~5-8 officines/jour, 9h-18h. Majoritairement iPhone (Safari iOS) en déplacement entre 2 RDV. Sort le PDF du jour devant le titulaire à la 2ème minute de RDV pour booster l'effet 'WAOUH'. Sur ordi le soir au bureau pour préparer les tournées du lendemain. **PAS développeur**, parle français simple, NE LIT PAS le jargon. Veut : (a) sortir une fiche pertinente en <60s, (b) avoir confiance dans les prix (zéro erreur), (c) que la fiche IMPRESSIONNE visuellement, (d) que rien ne plante en plein RDV. Critique : tout dead-end coûte un RDV.

## Scoring 10 dimensions UX

| Dimension | Score | Commentaire |
|---|---|---|
| Info Architecture | **4/10** | 7 sections empilées sans hiérarchie de poids. Hero + planning 13 mois racontent 2× la même histoire. 'Démarrer depuis un thème' redondante avec planning. |
| User Flow | **5/10** | 2 flows création non réconciliés (picker→aperçu direct ; mkStartEdit→éditeur classique). Aucun retour explicite. |
| Affordances | 7/10 | Boutons cohérents. Mais 14 emojis différents = bruit. Bouton 'œil' aperçu cryptique. |
| Feedback | **4/10** | Toast inconsistent. Pas d'indicateur modif non sauvegardée. Pas d'undo. Pas de skeleton actif. |
| Visual Consistency | 6/10 | 8 styles de boutons ≠. border-radius mélangés 8/10/12/14/16/18/20. Magic numbers spacing. Mix emoji + SVG. |
| Accessibility | 5/10 | Pas d'aria-label sur 80% des icon-buttons. Pas de focus trap modal. |
| Mobile | 5/10 | Sidebar aperçu 320px cache la fiche <700px. Slider zoom caché mobile. |
| Performance | 7/10 | Caches OK. Debounce OK. Mais re-render innerHTML COMPLET sur chaque filter. |
| Discoverability | **4/10** | Zéro onboarding. Zéro tooltip pédagogique. Picker buried. |
| Error Handling | 5/10 | alert()/confirm() natifs. Sauvegarde silencieusement perdue (catch{}). |

## Top 10 frictions CRITIQUES (par sévérité)

1. **FR-005** — Sidebar aperçu 320px chevauche la fiche <1280px (CRITIQUE)
2. **FR-007** — Onboarding inexistant, new user perdu sur 7 sections (CRITIQUE)
3. **FR-009** — Bouton 'Sauvegarder' absent de l'éditeur (CRITIQUE)
4. **FR-001** — Hero + 1ère card planning racontent la même chose
5. **FR-002** — Section 'Démarrer depuis un thème' redondante
6. **FR-003** — Aucun bouton retour depuis aperçu modal
7. **FR-004** — Picker 'Annuler' = tout perdu sans confirmation
8. **FR-008** — Aperçu 'live' trompeur (pas d'inline edit)
9. **FR-010** — mkUpdateProduct ne re-render pas preview
10. **FR-011** — 27 pills filtres Top ventes = overload cognitif

## 8 winning patterns à conserver
- Picker saisonnier dédupliqué (algo greedy 30 produits distincts/mois)
- Pitch commercial mensuel pré-rempli (MONTHLY_PITCH)
- Hero du mois avec stats secteur cumulées + top 3
- Stickers SVG + presets design 8 looks Pinterest 2026
- Multi-select bibliothèque + export PDF combiné
- Empty state premium Sagitta
- Confetti CSS-only 1er produit
- Toast partage post-PDF 3 actions (Email/WhatsApp/Lien)

## 31 écrans/composants inventoriés
Page Grossiste hub · Page OFFILOG · Sous-nav onglets · Hero du mois · Planning 13 mois · Offres IP officielles · Top ventes OPS+CPR+HP · Filtres Top ventes (3 axes) · Comparatif Sagitta · Démarrer depuis un thème · Bibliothèque · Multi-select bar · Modal Picker · Picker rows · Picker stats · Picker quick actions · Éditeur fiche · Édit header breadcrumb · Carte Apparence · Carte Design System · Carte Catalogue IP · Carte OFFILOG · Carte Produits sélectionnés · Modal Aperçu Live · Aperçu Toolbar · Aperçu Zoom · Modal Recherche image · Share toast · 4 Templates PDF · Confetti · OFFILOG univers grid

## 15 quotes utilisateur réalistes
> « Je veux juste sortir la fiche du mois en 3 clics, je suis devant le pharmacien, j'ai 30 secondes. »
> « Pourquoi je vois Janvier deux fois ? »
> « Je ferme la modal de l'aperçu et j'ai oublié si j'avais sauvegardé. »
> « Sur mon iPhone la sidebar prend toute la place. »
> « Future Dusk, Mocha Mousse... quel rapport avec mes biosimilaires ? »
> « Pauline (nouvelle) m'a demandé 'comment je fais une fiche', j'ai mis 10 min. »

(Audit complet en JSON dans le commit Agent A pour les 40 frictions détaillées.)

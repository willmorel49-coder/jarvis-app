# Assistant Stratégie LinkedIn — Générateur de plan éditorial (CRM JARVIS)

_Spec de conception — 2026-07-07_

## 1. Objectif

Ajouter à l'onglet **Rétroplanning LinkedIn** un **générateur programmé à choix multiples** : l'utilisateur répond à un court quiz (objectif, cadence, horizon, ton, thèmes) et le moteur produit **un plan éditorial complet, daté et prêt à suivre** — des posts concrets, équilibrés, calés sur les temps forts pharma, avec pour chaque post **2-3 angles au choix**. Un clic les injecte en brouillons dans le calendrier existant.

Décisions validées (brainstorming) :
1. **Assistant guidé** (quiz → plan sur mesure), pas une bibliothèque figée.
2. **Calé sur le calendrier pharma saisonnier** (rentrée, grippe, allergies, Octobre rose, Movember, solaire…).
3. **2-3 angles alternatifs par post** (choix A/B/C).

## 2. Contraintes (non négociables)

- **100% client-side**, aucune IA/API/serveur/coût (règle projet). Moteur déterministe = règles + banque d'angles curée.
- **Vanilla JS**, pas de build, réponses FR, mode clair, Safari-safe.
- **Persistance** : réutilise la couche du module LinkedIn (`linkedin_posts` Supabase + repli localStorage).
- **Marque Intégral** : grossiste-répartiteur qui parle aux pharmaciens. **Aucune condition commerciale affichée** (remises, franco, engagement) — LinkedIn est public. Pas d'UPSA ni Sanofi. `+430 labos` / `+14000 réfs` = parapharmacie Offilog uniquement.

## 3. Architecture

- **Nouveau fichier** `crm/v2/v2-mkt-li-strategy.js` → objet `V2.liStrategy` (state + render) et handlers `V2.lis`. Chargé par `index.html` après `v2-mkt-linkedin.js` (la banque d'angles est volumineuse ⇒ fichier séparé).
- **Réutilise le module LinkedIn** via `V2.mktLinkedin` : `savePost`, `newId`, `PILLARS`, `loadPosts`, plus un rafraîchissement du calendrier après ajout. Ces membres sont exposés par `v2-mkt-linkedin.js`.
- **Point d'entrée** : bouton « ✨ Assistant stratégie » dans la barre d'outils de la vue LinkedIn (calendrier + liste). Ouvre un overlay plein écran.
- **Champ ajouté** : `format` sur `linkedin_posts` (`carrousel|video|photo|texte`) — colonne SQL + mapping `fromRow/toRow` + affichage éditeur. En repli localStorage, champ JS simple.

### 3.1 Modèle des posts générés

Chaque créneau produit un `linkedin_posts` :
`status='idee'`, `source='strategie'`, `pillar`, `format`, `title`=accroche courte, `body`=brouillon complet, `date` ISO, `event_id`=id de la stratégie, `event_name`=« Stratégie <objectif> — <date> ».

## 4. Le quiz (choix multiples)

| Question | Type | Options |
|---|---|---|
| Objectif principal | 1 choix | Notoriété · Recruter · Mettre en avant l'offre/Offilog · Fidéliser les officines clientes · Conquérir de nouvelles officines |
| Cadence | 1 choix | 1 · 2 · 3 posts / semaine |
| Horizon | 1 choix | 4 · 8 · 12 semaines |
| Ton dominant | 1 choix | Expert & factuel · Proche & humain · Punchy & moderne |
| Thèmes à privilégier | multi | Produit/offre · Conseil officine · Coulisses/logistique · Recrutement · Temps fort/actu |
| Date de début (option) | date | défaut = lundi prochain |

## 5. Le moteur (déterministe)

1. **Créneaux** = cadence × horizon. Répartition dans la semaine : 1/sem → mar 9h ; 2/sem → mar+jeu 9h ; 3/sem → lun+mer+ven 9h. À partir du lundi de départ.
2. **Rotation des piliers** : poids par objectif (ex. Recruter ⇒ recrutement fort + coulisses) fusionnés avec les thèmes cochés (boost). Séquence **sans deux fois le même pilier d'affilée**, garantissant la couverture des thèmes choisis.
3. **Surcouche saisonnière** : `SEASON[mois]` liste des temps forts pharma. Si un créneau tombe dans une fenêtre active, on peut basculer son pilier en `tempsfort` et tirer un angle saisonnier.
4. **Angles** : pour chaque créneau, on tire dans `ANGLES[pilier]` (ou saisonnier) **sans répétition** : 1 angle principal + 2 alternatifs (même pool). Chaque angle = `{hook, format, build(tone)}`.
5. **Brouillon** : `build(tone)` compose accroche → corps → appel à l'action, variante selon le ton, avec les faits réels Intégral (sans conditions commerciales).
6. **Régénérer** : reshuffle (aléatoire navigateur) → nouvelles combinaisons ; « autre idée » redraw un seul créneau.

### 5.1 Banque d'angles (le cœur)

~8 angles par pilier × 5 piliers + jeu saisonnier (12 mois). Piliers : `produit`, `conseil`, `coulisses`, `recrutement`, `tempsfort`. Thèmes des angles : largeur de gamme parapharma Offilog, disponibilité/logistique, conseils officine (merchandising, saison, stock), coulisses plateforme/équipe, offres d'emploi & vie d'équipe, temps forts métier. **Jamais** de % de remise / franco / engagement / nom de labo princeps.

## 6. Vues / UX (overlay plein écran)

1. **Étape Quiz** — les 5-6 questions en cartes à choix (boutons segmentés + multi pour thèmes), bouton « Générer mon plan ».
2. **Étape Aperçu** — en-tête récap (« 8 posts · 4 semaines · objectif Recruter · 3 thèmes ») ; liste chronologique des posts : date, pastille pilier, badge format, accroche ; par post : sélecteur **A/B/C** (bascule d'angle), « autre idée » (redraw), supprimer. Actions globales : « Régénérer tout », « ‹ Modifier le quiz », **« Ajouter au calendrier »**.
3. **Ajout** → crée tous les posts (`source='strategie'`), ferme l'overlay, ouvre le calendrier sur le mois de départ, toast « N posts ajoutés au calendrier ».

## 7. Dégradation & cas limites

- Repli localStorage : tout fonctionne (les posts s'enregistrent en local).
- Banque épuisée (horizon long, peu de thèmes) : on recycle les angles en évitant la répétition immédiate.
- `prefers-reduced-motion` respecté ; Safari-safe (pas de background-clip:text, pas de backdrop-filter).
- Dates en heure locale FR ; `new Date()` OK (exécution navigateur).

## 8. Hors périmètre (V1)

- Génération de texte par IA. Publication auto (API LinkedIn). Analytics d'engagement. Multi-pages.

## 9. Critères de réussite

- Répondre au quiz → obtenir un plan daté cohérent, thèmes alternés, calé sur ≥1 temps fort saisonnier quand la période s'y prête.
- Basculer l'angle A/B/C d'un post et « autre idée » changent bien le contenu.
- « Ajouter au calendrier » crée N brouillons datés visibles dans le calendrier LinkedIn.
- Aucune condition commerciale ni UPSA/Sanofi dans les textes générés.
- Fonctionne hors-ligne, sans clé ni serveur.

## 10. Livraison

- `crm/v2/v2-mkt-li-strategy.js` (nouveau) + `<script>` dans `index.html` (cache-busting) ; exports ajoutés dans `v2-mkt-linkedin.js` (savePost/newId/PILLARS/loadPosts + champ `format`) ; colonne `format` dans `docs/supabase/linkedin_posts.sql` (+ ALTER). Bump `?v=` + `sw.js VER`. Vérif navigateur (Playwright) avant push.

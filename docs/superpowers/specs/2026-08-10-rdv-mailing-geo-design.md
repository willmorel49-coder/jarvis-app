# Prise de rendez-vous par mailing, calée sur la géographie

> Cahier des charges validé avec Will le 10/08/2026.
> En une phrase : **un Calendly interne qui connaît les tournées.**

## Le problème

Un commercial d'Intégral veut voir ses clients. Aujourd'hui il téléphone, il tombe sur une officine en plein rush, il rappelle. Et quand les rendez-vous finissent par se poser, ils se posent n'importe où : Nantes le matin, Orléans l'après-midi.

## Ce qu'on construit

Un mail court, personnalisé, envoyé par le commercial depuis sa propre boîte. Un lien. Une page où le pharmacien choisit lui-même parmi des créneaux **que JARVIS a filtrés selon la géographie de la journée**. Une invitation agenda des deux côtés.

## Décisions actées (et pourquoi)

| Décision | Raison |
|---|---|
| On construit dans **JARVIS**, pas Phirst | Les 517 officines clientes, leurs e-mails, leurs secteurs et la tournée OSRM y sont déjà. |
| **Invitation .ics**, pas de branchement Outlook/Google | Les commerciaux n'ont pas tous le même agenda. Le .ics marche partout, sans compte ni clé API (règle n°7). |
| **JARVIS détient la vérité** des créneaux | Corollaire du point précédent : aucun agenda extérieur n'est lu. |
| Envoi **depuis la boîte du commercial** (`mailto:`) | Zéro coût, zéro clé, et un mail signé d'une personne connue du pharmacien convertit mieux qu'un mailing de masse. |
| Créneaux calculés par **effet d'aimant**, sans planning de secteur à tenir | Le premier RDV posé fixe la zone du jour ; les officines voisines viennent s'y greffer. Zéro entretien. |
| Lien sur l'**adresse GitHub Pages actuelle**, domaine propre plus tard | On ne dépend de personne pour livrer. `rdv.integralpharma.fr` (gratuit : un enregistrement DNS + certificat GitHub Pages) se branchera quand quelqu'un chez Intégral pourra toucher aux réglages du domaine. Les liens déjà envoyés continueront de fonctionner. Le lien du mail est donc construit à partir d'une **constante unique** (`RDV_BASE_URL`), pas écrit en dur. |
| Mails **courts** (6–8 lignes) | Meilleur taux de réponse, et tient dans la limite de longueur d'un `mailto:` (~1 800 caractères sous Outlook). |
| Ligne **STOP** dans chaque mail + liste d'exclusion | Prospection B2B sur base client existante : légitime, mais l'opposition doit être simple et tracée. |

## Parcours pharmacien

1. Il reçoit un mail de son commercial, avec son prénom, le nom de son officine et ses propres chiffres. Un seul lien : **« Choisir un créneau »**.
2. La page s'ouvre sur son téléphone, sans compte ni mot de passe. Elle affiche **3 jours × 3 horaires** :

   ```
   Mardi 18 août     9h00 · 9h45 · 11h15
   Jeudi 20 août    14h00 · 14h45 · 16h30
   Mardi 25 août     9h00 · 10h30 · 14h00
   Aucun ne convient ? → dites-moi votre jour et votre moment préféré
   ```

3. Il tape un créneau, laisse son nom et son téléphone (facultatif), valide.
4. Écran de confirmation + bouton **« Ajouter à mon agenda »** (fichier `.ics`). Fin du parcours, rien à renvoyer.

Cas particuliers :
- Créneau pris entre-temps → « ce créneau vient d'être pris », la grille se recharge.
- Lien déjà utilisé → « votre rendez-vous du 18 août à 10h30 est confirmé » + bouton .ics + téléphone du commercial.
- Lien expiré (21 jours) → message + téléphone du commercial.
- Aucun créneau proposable (agenda plein ou tout écarté) → directement le formulaire de préférence.

## Parcours commercial

### Écran 1 — Mes disponibilités (`v2-rdv-dispo.js`)

Réglé une fois, modifiable en deux taps :
- jours travaillés et plages horaires (défaut : lundi–vendredi, 9h00–12h30 et 14h00–18h00) ;
- durée d'un rendez-vous (défaut 45 min) et marge de route (défaut 15 min) ;
- vue semaine pour **bloquer une demi-journée** (réunion régionale, congés).

### Écran 2 — Campagne (`v2-campagne.js`)

1. Choix du modèle : **bilan chiffré** / **nouveauté du moment** / **visite de routine**.
2. Choix de la liste, avec les filtres déjà connus du CRM : secteur ou département, UGA, « pas vu depuis X mois », CA en baisse, **a une adresse mail** (filtre obligatoire).
3. Aperçu du premier mail, réel et rempli.
4. **File d'attente d'envoi** : « Ouvrir le mail suivant » → la messagerie s'ouvre pré-remplie → il relit, il envoie, il revient → « Envoyé ✓ → suivant ». Compteur d'avancement. Volume réaliste : 20 à 40 par session.

Génération d'un mail = création d'un jeton `rdv_lien` avec les coordonnées de l'officine figées dedans.

### Écran 3 — Rendez-vous (`v2-rdv.js`)

- **À venir**, par jour, avec le bouton **« Composer ma tournée du mardi 18 »** qui appelle la tournée existante (`V2.pages.tournee`) pré-remplie des RDV du jour et l'ordonne par OSRM.
- **À rappeler** : les pharmaciens qui ont répondu « aucun créneau ne me va » + leur préférence.
- **Sans réponse** : mails envoyés il y a plus de 7 jours, jeton non consommé → bouton de relance (mail court de 3 lignes, même lien).
- Bouton **« ne plus solliciter »** sur chaque ligne, qui exclut l'officine des campagnes futures.

## La règle géographique

Pour chaque officine, on balaie de **J+3** à **J+21**, jours travaillés et non bloqués.

Pour chaque jour candidat, on regarde les rendez-vous **déjà confirmés ce jour-là** pour ce commercial, et on calcule `d` = distance au plus proche d'entre eux.

| `d` | Décision | Créneaux proposés |
|---|---|---|
| journée vide | Jour ouvert, score 2 | tous les trous de la grille |
| ≤ 25 km | Jour prioritaire, score 0 | collés au voisin : juste avant (`heure_voisin − durée − trajet`) et juste après (`heure_voisin + durée_voisin + trajet`), puis les autres trous en secours |
| 25 – 60 km | Jour possible, score 1 | uniquement la même demi-journée que le voisin |
| > 60 km | **Jour écarté** | — |

- **Distance** : haversine × 1,3 (approximation route). Choix assumé : c'est assez juste pour grouper une journée, c'est instantané, et ça évite que la page du pharmacien dépende d'un service extérieur. Le vrai itinéraire reste dans la tournée, une fois la journée constituée.
- **Temps de route** : `d_km / 50 × 60` minutes, arrondi, + marge de 15 min.
- **Sélection finale** : tri par (score, date), on garde **3 jours**, et **3 créneaux par jour** espacés d'au moins 1 h quand c'est possible, arrondis au quart d'heure. Si moins de 3 jours sortent, on complète par les jours ouverts les plus proches.
- **Coordonnées de l'officine** : reprises de `pharma-fr-data.js` par CIP ; à défaut, géocodage BAN au moment de la génération du mail, puis figées dans le jeton. Une officine sans coordonnées est proposée sur les jours ouverts uniquement (jamais écartée).

## Données (Supabase — projet existant `iyvavhnlhxksokkerkos`)

Quatre tables. Toutes en RLS : un commercial ne voit que ses propres lignes, et **`anon` n'a aucun accès direct**.

**`rdv_dispo`** — une ligne par commercial
`user_id` (PK, → auth.users) · `jours` jsonb (`{"1":[["09:00","12:30"],["14:00","18:00"]], …}`, clés 1 = lundi) · `duree_min` (45) · `marge_route_min` (15) · `horizon_jours` (21) · `delai_min_jours` (3) · `rayon_chaud_km` (25) · `rayon_max_km` (60) · `maj_le`

**`rdv_blocage`** — demi-journées indisponibles
`id` · `user_id` · `date` · `moment` (`matin` | `apres_midi` | `journee`) · `motif`

**`rdv`** — les rendez-vous
`id` · `user_id` · `cip` · `nom` · `adresse` · `cp` · `ville` · `lat` · `lon` · `date` · `heure` · `duree_min` · `statut` (`confirme` | `annule` | `a_rappeler`) · `origine` (`mailing` | `manuel`) · `contact_nom` · `contact_tel` · `message` · `cree_le`
**Contrainte `UNIQUE (user_id, date, heure)`** — c'est elle qui garantit qu'un créneau ne part qu'une seule fois, même sur deux clics simultanés.

**`rdv_lien`** — les jetons
`token` uuid (PK, `gen_random_uuid()`) · `user_id` · les coordonnées figées de l'officine (`cip`, `nom`, `adresse`, `cp`, `ville`, `lat`, `lon`, `contact`) · `modele` · `cree_le` · `expire_le` · `envoye_le` · `consomme_le`

**`rdv_opposition`** — officines à ne plus solliciter
`user_id` · `cip` · `date` · `motif`

### Les trois seules portes ouvertes au public

Fonctions Postgres `SECURITY DEFINER`, `search_path` figé, appelées avec la clé publique déjà présente dans l'app. Aucune table n'est lisible directement.

| Fonction | Rôle |
|---|---|
| `rdv_creneaux(token)` | Vérifie le jeton (existe, non expiré, non consommé) et renvoie `{officine:{nom}, commercial:{prenom, tel}, jours:[{date, creneaux:[…]}]}`. Ne renvoie **jamais** de chiffres ni d'autres clients. |
| `rdv_poser(token, date, heure, nom, tel)` | Insère le rendez-vous. Si la contrainte d'unicité saute → `{ok:false, raison:"pris"}`. Sinon marque le jeton consommé et renvoie de quoi fabriquer l'`.ics`. |
| `rdv_preference(token, texte, nom, tel)` | Enregistre un « aucun créneau ne me va » en statut `a_rappeler`. |

Le calcul des créneaux vit **dans `rdv_creneaux`**, en SQL, avec une fonction haversine immuable. Raison : la règle ne doit exister qu'à un seul endroit, et la page publique ne doit rien pouvoir contourner.

## Les trois modèles de mail

Objet + corps ≤ 1 200 caractères. Variables disponibles : `{prenom_contact}` `{nom_officine}` `{ville}` `{ca_annee}` `{potentiel_gx}` `{manque_a_gagner}` `{mois_derniere_visite}` `{prenom_commercial}` `{tel_commercial}` `{lien}`.

1. **Bilan chiffré** — ses propres chiffres, tirés du CRM. **Aucune condition commerciale chiffrée** n'apparaît (règle métier : pas de barème sur un support qui sort de la maison). On parle de son CA, de son potentiel générique et de son manque à gagner, pas de nos taux.
2. **Nouveauté / offre du moment** — deux lignes de texte libre saisies par le commercial au lancement de la campagne, réutilisées pour toute la liste.
3. **Visite de routine** — « ça fait X mois », X calculé depuis la dernière visite connue.

Chaque modèle se termine par le lien et la ligne d'opposition : *« Si vous ne souhaitez plus recevoir ces propositions, répondez STOP à ce mail. »*

## Fichiers

À créer, dans `crm/v2/` :
- `v2-rdv.js` — écran Rendez-vous du commercial
- `v2-rdv-dispo.js` — disponibilités et blocages
- `v2-campagne.js` — sélection, aperçu, file d'attente d'envoi
- `v2-rdv-modeles.js` — les trois modèles et leur remplissage
- `rdv.html` + `rdv-public.js` — la page du pharmacien, **autonome** (ne charge pas le bundle CRM, ne contient aucune donnée client)
- `docs/supabase/rdv.sql` — tables, RLS, fonctions

À modifier : `index.html` (entrées de menu + `?v=` de cache-busting), `sw.js` (version).

Contrainte de style : la page publique s'ouvre sur des iPhone. Interdits habituels — pas de `backdrop-filter`, pas de `filter: blur` sur grande surface, pas de dégradé sur texte, repli `prefers-reduced-motion`.

## Hors périmètre (volontairement)

Relance automatique · synchro bidirectionnelle avec Outlook/Google · rappel SMS · visio · plusieurs commerciaux sur une même officine · statistiques de campagne au-delà de *préparés / envoyés / RDV pris*.

## Limites assumées

- JARVIS ne sait pas si le mail est **réellement** parti — d'où la case « Envoyé ✓ ».
- Les réponses **STOP** arrivent dans la boîte du commercial — le bouton « ne plus solliciter » est manuel.
- Distance à vol d'oiseau × 1,3, pas l'itinéraire réel.
- La page publique dépend de Supabase. S'il est indisponible, elle affiche un message clair et le téléphone du commercial, pas une page blanche.

## Définition de fini

1. Règle géographique testée sur cas fabriqués : deux officines à 10 km, une à 100 km, journée vide, deux réservations simultanées sur le même créneau, officine sans coordonnées.
2. Page publique vue **à 390 px de large**, capture d'écran à l'appui.
3. Fichier `.ics` réellement ouvert dans Apple Calendrier **et** dans Gmail.
4. Page publique servie et fonctionnelle sur l'adresse GitHub Pages, lien testé depuis un vrai mail. Le passage à `rdv.integralpharma.fr` est un lot à part : changer `RDV_BASE_URL`, ajouter l'enregistrement DNS, vérifier le cadenas.
5. Contrôle `gardien-deploiement` passé avant tout push.

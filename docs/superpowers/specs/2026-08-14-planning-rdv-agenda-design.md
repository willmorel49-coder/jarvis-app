# Planning RDV — reconnaître les officines dans l'agenda du commercial

*Cahier des charges · 14/08/2026 · JARVIS CRM V2*

## Le problème

Will veut programmer ses rendez-vous clients. Il lui faut, sur un seul écran :
voir avec qui il a **déjà** un RDV, voir à qui il **reste** à en prendre, et
**corriger** les cas où son agenda ne nomme pas l'officine comme le fichier.

Aujourd'hui c'est impossible, et pas pour la raison qu'on croit.

**JARVIS ne lit aucun titre de l'agenda personnel.** C'est un choix d'origine,
écrit dans `docs/supabase/rdv-agenda.sql` : l'adresse secrète d'un agenda donne
accès à toute la vie privée de son propriétaire, donc la base n'a *aucune*
colonne pour ranger un titre, un lieu ou un participant. Elle ne retient que
« occupé de 10 h à 11 h ». JARVIS ne reconnaît donc pas mal les noms de
pharmacie : il ne les voit pas.

Et la table `rdv` est vide : **5 lignes en production, toutes des tests, toutes
annulées** (relevé le 14/08/2026). Toute l'activité RDV réelle de Will vit dans
Google Agenda.

## Mesure préalable sur les données réelles

Faite avant d'écrire une ligne d'interface, sur le vrai flux iCal de Will
(1 seule lecture — Google rationne au-delà de quelques lectures rapprochées).

**531 événements · 463 titres distincts · 173 titres (37 %) contiennent
« pharmacie » ou « phie ».**

Reconnaissance de ces 173 titres contre le portefeuille (691 officines) et
l'annuaire national (19 667 officines) :

| Résultat | Titres | Part |
|---|---|---|
| reconnus tout seuls | 95 | 55 % |
| à confirmer (plusieurs candidates) | 56 | 32 % |
| ratés (nom absent du fichier, ou faute de frappe) | 22 | 13 % |

**Zéro fausse reconnaissance** parmi les 95, après les deux verrous décrits plus
bas. Une première version naïve en produisait beaucoup : « Congrès pharmacien
Nantes », « Caen », « PAULINE », « RDV BANQUE » devenaient des officines.

Deux constats qui orientent la conception :

1. **La moitié des visites sont de la prospection.** Sur les 95 titres reconnus,
   49 désignent une officine déjà cliente (présente dans le portefeuille par son
   CIP), **46 désignent une officine absente du fichier client**. Une liste
   « à contacter » limitée au portefeuille raterait la moitié du travail réel.
2. **Le planning à venir est quasi vide.** 504 des 531 événements sont passés.
   Sur les 4 prochaines semaines : 16 événements, dont **5 RDV pharmacie**.
   L'écran doit donc surtout servir à *remplir* un agenda, pas à contempler
   un agenda plein.

## Ce qu'on construit

### 1. Lire les titres sans jamais les garder

L'Edge Function `agenda` gagne une action `mes_evenements` : elle relit le flux
iCal du commercial connecté et **renvoie les titres à son navigateur**, sans
aucune écriture en base.

- réservée au propriétaire de l'agenda : le jeton de session détermine le
  `user_id`, jamais un paramètre d'appel ;
- aucune nouvelle colonne, aucune nouvelle ligne ; `rdv_occupe` continue de
  n'accueillir que des heures ;
- même recul que la relève automatique : pas de lecture Google si la dernière
  remonte à moins de 25 minutes (le rationnement 429 est déjà documenté).

Conséquence assumée : le titre « Psychiatre » traverse l'écran de Will et
disparaît à la fermeture de l'onglet. Il n'est écrit nulle part.

### 2. Reconnaître l'officine

Dans le navigateur, chaque titre est comparé au portefeuille puis à l'annuaire
national. L'algorithme est celui validé par la mesure ci-dessus.

**Étape A — extraire le morceau qui nomme une officine.** On retire les verbes
d'action que Will écrit devant (`Appeler`, `Call`, `Passer voir`, `Allez voir`,
`Prendre rdv`, `Relancer`, `Vérifier`…), le contenu des parenthèses (c'est un
contact, pas un nom), puis on prend ce qui suit le mot `pharmacie` / `phie` /
`phcie`, coupé au premier mot de commentaire (`pour`, `avec`, `problème`,
`commande`, `Mr`, `Mme`…).

**Étape B — comparer sur la partie distinctive.** Le nom de l'officine est
débarrassé de « PHARMACIE » et des mots vides : `GRANDE PHARMACIE DE LA GARE -
NANTES` devient `GRANDE GARE NANTES`. Accents, ponctuation et casse sont
neutralisés.

**Les deux verrous, chacun corrigeant une faute observée :**

- **Frontière de mot obligatoire.** Sans elle, « Pharmacie HA » était trouvée
  dans « Verif mounjaro commande OmaHA beach », et « André » dans « ALEXANDRE
  PREISS ». Un nom distinctif de 3 caractères ou moins ne vaut que s'il *est*
  tout le segment.
- **Pas d'annuaire national sans le mot « pharmacie ».** Avec 19 667 noms,
  n'importe quel mot courant trouve une homonyme : « Caen », « Marseille »,
  « PAULINE », « RDV BANQUE » étaient toutes reconnues. Un titre sans marqueur
  n'est accepté que s'il désigne **exactement** une officine du portefeuille —
  celles que Will connaît assez pour les écrire en raccourci.

Un mot du métier mais pas d'une officine (`CONGRES`, `PHARMAGORA`, `REUNION`,
`FORMATION`, `PHARMACIEN`, `SALON`) écarte le titre d'office.

**Trois issues :** *reconnu* (score ≥ 0,85 et une seule candidate en tête),
*à confirmer* (score ≥ 0,60, ou plusieurs candidates à égalité), *ignoré*.

### 3. Corriger — et ne pas le refaire deux fois

Sur chaque ligne, « ce n'est pas la bonne » ouvre la recherche d'officine
(le composant de `v2-rdv-ajout.js` existe déjà) et Will désigne la vraie.

**L'agenda Google n'est jamais modifié.** La correction vit du côté JARVIS.

Pour qu'elle survive à la fermeture de l'onglet — la reconnaissance étant
refaite à chaque ouverture puisque rien n'est stocké — une table
`rdv_agenda_alias` retient **la seule correspondance** :

```
user_id · titre_normalise · cip · cree_le
```

Ce qui y entre : uniquement un titre que Will a lui-même désigné comme une
officine. Ce qui n'y entre jamais : les titres ignorés, et donc sa vie privée.
Le titre est stocké **normalisé** (majuscules, sans accents ni ponctuation,
verbes d'action retirés) — « Appeler phie du lys problème livraison » et « Phie
du lys » produisent la même clé et se reconnaissent l'un l'autre.

Droits : `grant` explicite en plus de la RLS — une policy sans `grant` ne sert à
rien sur ce projet, le piège a déjà été payé. Colonne `archive` plutôt qu'un
`DELETE` : défaire un rattachement l'archive.

**Un RDV reconnu dans l'agenda ne crée PAS de ligne dans `rdv`.** C'est un
resserrement volontaire par rapport à la première formulation (« seul le
rendez-vous validé est enregistré ») : l'écrire dans `rdv` reviendrait à copier
dans la base la date, l'heure et le nom d'un rendez-vous que l'agenda porte
déjà, et à bloquer deux fois le même créneau — `rdv_occupe` le bloque déjà.
Seule la correspondance titre → CIP est gardée. La table `rdv` reste ce qu'elle
est : les rendez-vous *pris dans JARVIS*, par le pharmacien via un lien ou par
le commercial à la main.

### 4. L'écran « Mon planning RDV »

Il remplace `rdvplanning` (« Mon agenda »), dont il reprend la barre par
journée, le calcul du temps réservable et le voyant de fraîcheur de l'agenda.

Fenêtre portée de 15 jours à **4 semaines**. Par journée :

- **en bleu** les RDV pharmacie, avec le nom de l'officine en clair et son
  étiquette *client* ou *prospect* ;
- **en gris** les autres occupations, sans titre, comme aujourd'hui ;
- à droite le résumé : « 3 RDV · 2 h encore libres ».

Les lignes *à confirmer* apparaissent avec un liseré et le bouton de correction.
Les titres ignorés ne sont pas listés : ils comptent comme « occupé », rien de
plus.

### 5. Une journée vide propose une liste à contacter

C'est le cœur de l'usage, puisque l'agenda à venir est presque vide.

Sur une **journée qui porte déjà un RDV** : « autour de ce RDV — N officines
sans rendez-vous à moins de 25 km », dépliable, triée par chiffre d'affaires.
La règle géographique (25 km / 60 km) est celle déjà codée pour le mailing.

Sur une **journée vide** : un bouton « proposer des créneaux à N officines » qui
ouvre l'écran **Campagne** existant (`v2-campagne.js`) avec la liste
pré-remplie. JARVIS prépare les mails, Will relit et envoie depuis sa boîte, le
pharmacien choisit lui-même son créneau parmi les dates encore libres. Rien de
nouveau à construire côté envoi.

La liste pré-remplie exclut :

- les officines ayant déjà un RDV à venir (JARVIS ou reconnu dans l'agenda) ;
- celles qui se sont opposées à la prospection (`rdv_opposition`) ;
- celles vues récemment — **le passé de l'agenda sert enfin à quelque chose** :
  les 504 événements passés donnent, par officine, la date de dernière visite.
  Elle est calculée dans le navigateur, affichée (« vue il y a 3 semaines ») et
  jamais stockée.

Elle inclut clients **et** prospects, chacun étiqueté, puisque la moitié des
visites réelles sont des prospects.

### 6. Ce qu'on ne fait pas

- aucune écriture dans Google Agenda, dans aucun sens ;
- aucun robot qui rattache une officine sans validation de Will ;
- aucun stockage des titres non désignés ;
- pas de carte : le tri par zone se fait sur la liste, en texte.

## Isolation

| Unité | Rôle | Dépend de |
|---|---|---|
| `agenda` (Edge Function), action `mes_evenements` | rend les titres au propriétaire, n'écrit rien | flux iCal, `rdv_agenda` |
| `v2-rdv-reco.js` | apparie un titre à une officine — fonction pure, testable seule | `V2.pharmacies`, `PHARMA_FR`, alias |
| `rdv_agenda_alias` | mémorise les rattachements validés | — |
| `v2-rdv-planning.js` | l'écran : dessine, corrige, renvoie vers Campagne | les trois précédentes |

## Tests

- `tests/rdv-reco.test.mjs` — l'appariement, sur les cas réels mesurés :
  les 95 reconnus doivent l'être, et surtout **les faux positifs identifiés
  doivent rester rejetés** (« Verif mounjaro commande Omaha beach », « André »,
  « Congrès pharmacien Nantes », « Caen », « PAULINE », « RDV BANQUE »).
  Les 22 ratés servent de cas de non-régression pour les alias.
- vérification à l'écran, à 390 px, avant toute annonce de mise en ligne.

## Ce qu'on ne promet pas

- **13 % des titres qui parlent d'une pharmacie resteront non reconnus** à la
  première ouverture (nom absent des deux fichiers, ou faute de frappe). Le
  bouton de correction est fait pour ça, et l'alias fait que le cas ne se
  représente pas.
- La reconnaissance est refaite à chaque ouverture. C'est le prix du choix de ne
  rien stocker, et il est payé en une fraction de seconde côté navigateur.
- Cela ne vaut que pour un commercial ayant connecté son agenda. À ce jour,
  **un seul l'a fait**.

# Brief — vingt maquettes, niveau Awwwards

*Écrit le 15/08/2026. À lire en entier. Il corrige un brief précédent qui a fait rater
vingt sites : ses erreurs sont signalées en clair ci-dessous.*

## Le niveau à atteindre

**Awwwards.** C'est le mot de Will : sa propre librairie de design décrit cette galerie
comme « le niveau à atteindre quand Will dit *incroyable* ». Va la regarder avant de
dessiner : <https://www.awwwards.com/websites/>

Ce que les lauréats ont en commun, relevé le 15/08 :

- **une image plein cadre qui porte toute la page** — photo, matière, rendu, vidéo ;
- **une typographie énorme qui dialogue avec l'image**, souvent recouverte ou découpée
  par elle, jamais posée sagement à côté ;
- **une couleur assumée**, franche, pas une teinte de compromis ;
- **peu de texte visible d'emblée** — on entre par l'image, on lit ensuite ;
- de la **matière** : tissu, métal, végétal, dégradés profonds, grain.

La maquette de référence déjà validée par Will est
`site-integral/propositions/trionn/index.html` — regarde-la, c'est le plancher, pas le
plafond.

## ⚠️ CE QUI A FAIT RATER LA SÉRIE PRÉCÉDENTE — ne pas refaire

**1. Le brief interdisait les images.** Il disait « pas d'image distante » en visant les
services extérieurs ; les vingt chefs ont lu « aucune image » et ont rendu vingt sites
**sans une seule photographie**. Will : *« les sites étaient mieux avant, ça faisait
vraiment plus fini et impressionnant, là j'aime pas du tout »*.

→ **Les médias sont OBLIGATOIRES.** Ils sont dans `site-integral/assets/`, appelés en
relatif depuis ta page : trois vidéos (`band.mp4`, `hero.mp4`, `clip3.mp4`), deux photos du
siège (`siege-web.jpg`, `siege-solaire.jpg`), le logo (`logo-web.png`). Ils sont servis par
le même hôte que ta page : les employer est souhaitable, pas risqué. **Une maquette sans
photographie sera refusée.**

**2. On briefait une mécanique sans donner de système.** Résultat : vingt sites corrects et
sans personnalité. Will : *« beaucoup trop scolaire »*.

→ **Tu reçois une CHARTE réelle**, avec sa palette complète et son échelle typographique
exacte. Elle est ta grammaire.

**3. Un titre géant en graisse 800 fait scolaire.** La référence validée affiche du 90 px
en **graisse 400**. C'est contre-intuitif et c'est ce qui fait la classe. Regarde l'échelle
de ta charte : elle te donne les vraies graisses.

## Ta charte

Elle t'est donnée dans ta mission, avec son identifiant. Les 64 chartes vivent dans
`~/jarvis-design/app/chartes.js` — un tableau JSON, une entrée par marque, avec `couleurs`
(le jeu de jetons complet) et `typo` (les rôles : `display-xl`, `display-lg`… avec police,
taille, graisse, interlignage). **Lis la tienne avant d'écrire une ligne.**

⚠️ **AVERTISSEMENT DE WILL, à respecter à la lettre** : ces chartes sont *« des identités
de marques réelles — méthode et référence, jamais pour habiller un site aux couleurs d'un
tiers »*.

**Ce que tu reprends** : l'échelle typographique, le rythme d'espacement, la densité, le
niveau de contraste, la façon dont la marque construit une page, sa manière d'employer
l'image.
**Ce que tu ne reprends pas** : sa couleur de marque, son logo, son nom, ses formes
signature. Le site est **Intégral Pharma** : bleu `#0050E6`, orange `#F39A1B`. Si ta charte
est bâtie sur un rouge, tu en gardes la **structure** et tu la joues en bleu Intégral.

## Le poids : la bride est levée

Will, le 15/08 : *« ne t'occupe plus de ce qui peut être lourd comme site »*. Ne renonce
donc pas à un geste parce qu'il coûte cher. **Mais** :

- les quatre interdits Safari restent **imposés par un contrôle automatique** qui refuse
  l'écriture : pas de découpe de dégradé dans du grand texte, pas de verre dépoli, pas de
  flou sur grande surface, **une seule** `<video autoplay>` par page. Ce n'est pas
  négociable, c'est un garde-fou de la machine de Will ;
- **dis ce que ta page coûte** dans ton rapport : nombre de vidéos, de contextes 3D, poids
  total. Will décidera sur sa machine.

## Le texte

**Source unique : `site-integral/CONTENU-SITE-2026.md`.** Onze sections, validées section
par section par Will le 14/08. Tu les reprends **mot pour mot**.

Tu peux couper, réordonner, choisir ce que tu mets en avant. Tu ne peux pas réécrire une
phrase validée, en inventer une, ni ajouter un chiffre.

⚠️ **Deux décisions que Will a prises contre l'avis qui lui était donné**, expliquées en
tête du fichier : la phrase sur la redistribution de la marge **reste**, et l'année
affichée est **2006** — sans jamais nommer SR Pharma comme point de départ. Tu les
appliques telles quelles.

## Vocabulaire — un contrôle automatique bloque le fichier

- On écrit toujours **« abandon de marge »**. Le synonyme commercial usuel en
  `r-e-m-i-s-e` est proscrit, y compris dans un commentaire du code.
- Intégral Pharma est un **groupe de grossistes-répartiteurs**. L'autre mot en
  `g-r-o-u-p-e-m-e-n-t` désigne un groupe d'achat de pharmacies : c'est autre chose, et le
  contrôle automatique refuse le fichier qui l'emploie.
- **Aucun taux, aucun montant, aucun pourcentage** de condition commerciale. Aucun
  témoignage, aucun logo de laboratoire inventé.

## Ce que tu livres

Un fichier : `site-integral/propositions/v2026/m-XX.html` (ton numéro sur deux chiffres).
Autonome, sauf pour les médias de `assets/` et tes polices. Ne touche à aucun autre fichier.

En pied de page, discrètement : ton numéro et le nom que **tu** donnes à ta direction.

**Polices** : tu peux en servir depuis ton dossier (licence libre uniquement — OFL, Apache).
Télécharge le sous-ensemble *latin* seulement. Si ta charte nomme une police propriétaire
(SF Pro, Airbnb Cereal…), prends l'équivalent libre le plus proche et dis lequel.

## Le contrôle, à faire toi-même, à l'écran

Sers ton fichier et **regarde-le dans un navigateur**. Un contrôle de code ne prouve rien :
quatre maquettes sont restées blanches une journée en passant tous les contrôles de code.

1. **1440 × 900 et 390 × 844**, parcours complet ;
2. **zéro bloc resté invisible** — compte-les ;
3. **zéro débordement horizontal** hors bandeau défilant ;
4. **script coupé** : la page reste lisible ;
5. menu téléphone à fond plein ; cibles ≥ 44 px ; texte courant ≥ 13 px.

⚠️ **Quatre méthodes de mesure qui mentent**, toutes payées le 14/08 :
- `getComputedStyle(el).opacity` **ne remonte pas** l'opacité d'un parent. Utilise
  `document.elementFromPoint()` au centre de l'élément, borné à l'écran.
- Une mesure prise juste après un défilement lit **l'image précédente**. Attends deux
  `requestAnimationFrame`.
- `scroll-behavior: smooth` rend `scrollTo()` **animé** : tes mesures portent sur une
  position en vol. Force `behavior:'instant'`.
- **Le navigateur du poste est partagé** entre les chefs : plusieurs ont mesuré le site
  d'un collègue sans le savoir. Vérifie l'URL et le titre avant chaque mesure, ou prends
  une instance privée à profil jetable.

## Ton rapport

Court et factuel : le **nom** de ta direction · ce que tu as pris de ta charte et ce que tu
en as écarté · les **chiffres réels** du contrôle · ce que ta page **coûte** (vidéos,
contextes 3D, poids) · les **défauts trouvés et corrigés** en route — c'est la partie la
plus utile.

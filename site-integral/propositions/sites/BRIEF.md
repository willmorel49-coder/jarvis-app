# Brief — vingt sites, vingt architectures

*Écrit le 14/08/2026. À lire en entier avant d'écrire une ligne.*

## Pourquoi ce chantier existe

Les vingt maquettes `propositions/nouvelles/v3-0XX.html` devaient être **vingt sites
différents**. Mesuré le 14/08/2026 : ce sont **trois ossatures seulement**, avec les six
premières sections permutées. Les mêmes onze sections partout, **quarante-neuf noms de
classe identiques dans les vingt**, le même fichier d'effets partagé, et **aucune
mécanique de défilement propre**. Vingt habillages d'un seul site.

Will, le 14/08/2026 : *« faire les 20 sites complètement différents comme demandé à la
base, c'est ce qui était prévu »*.

**Ce qui rend deux sites vraiment différents, c'est l'ARCHITECTURE** — la mécanique qui
enchaîne les sections — **pas la palette.** C'est la leçon des quatre directions produites
la veille : quatre chefs à qui on impose seulement une couleur rendent quatre pages
jumelles ; quatre chefs à qui on impose une mécanique rendent quatre pages qu'on ne peut
pas confondre.

## Le texte : il est validé, il ne se réécrit pas

**Source de vérité : `site-integral/CONTENU-SITE-2026.md`.** Will l'a validé section par
section. Onze sections. Vous le reprenez **mot pour mot**.

Vous pouvez : couper (une architecture d'affiche dit moins qu'une architecture
éditoriale), réordonner si votre mécanique l'exige, choisir ce que vous mettez en avant.
Vous ne pouvez pas : réécrire une phrase validée, en inventer une, ajouter un chiffre.

⚠️ **Deux décisions que Will a prises contre l'avis qui lui était donné** — elles sont
expliquées en tête de `CONTENU-SITE-2026.md`. Vous les appliquez telles quelles, sans les
corriger, sans les étendre, sans les commenter dans la page :
1. la phrase sur la redistribution de la marge et les prix nets sur facture **reste** ;
2. l'année affichée est **2006** — et **on ne nomme jamais SR Pharma**.

## Votre architecture

Elle vous est donnée dans votre mission, avec un numéro. **C'est votre contrainte
principale et elle n'est pas négociable** : c'est elle qui garantit que votre site ne
ressemble à aucun des dix-neuf autres.

Une architecture proche existe dans la banque d'effets — `site-integral/fx-bank/` — sous
forme de démonstration autonome. **Lisez-la, ne la recopiez pas** : c'est une démo à cinq
volets, votre site en a onze et un vrai contenu. Vous reprenez le *mécanisme*, vous
construisez la page.

⚠️ **Une seule architecture par page.** En empiler deux donne le fourre-tout d'animations
qui a fait recaler les huit premières maquettes.

## Ce qui est interdit — le Mac de Will plante

Sans exception, sur toute la page :

- pas de `background-clip:text` / `-webkit-background-clip:text` sur du grand texte
- pas de `backdrop-filter`
- pas de `filter:blur` sur une grande surface
- **une seule** `<video autoplay>` par page au maximum, zéro de préférence
- toujours un repli `@media (prefers-reduced-motion: reduce)`

Verre, halo et lumière se font en dégradés radiaux/coniques + rgba + transform. **Jamais
de flou.**

⚠️ **Jamais de texte dédoublé en deux couleurs sur un très grand corps.** Le 14/08/2026,
un titre de 7 rem portait une couche orange décalée sous la couche noire — le geste
d'impression mal calée. Will : *« le côté stroboscope à moitié qui fait mal aux yeux »*.
À cette taille, les lettres sont à moitié d'une couleur, à moitié de l'autre, et l'œil
n'arrive pas à les fixer. Le décalage de couche se réserve aux petits corps.

⚠️ **Zéro requête réseau.** Pas de CDN, pas de police distante, pas d'image distante. Tout
est dans le fichier (SVG en clair ou en data-URI). La page doit s'ouvrir par double-clic,
hors ligne, et être complète.

⚠️ **Un seul fichier, autonome.** Rien de partagé avec les autres sites : ni feuille de
style commune, ni script commun. C'est ce partage qui a produit les vingt jumelles.

## Ce qui doit tenir même sans script

**Aucun texte n'est transparent au repos.** Si le script ne tourne pas — erreur, connexion
coupée, navigateur ancien — la page reste **entièrement lisible**. Vos animations
d'apparition s'arment par une classe posée en JavaScript ; sans elle, tout est visible.

⚠️ **Le filet est obligatoire dans tout composant qui révèle au défilement.** La décision
se prend sur la **position réelle lue au défilement**, jamais sur une seule notification
d'`IntersectionObserver` : un élément masqué par `clip-path` n'a aucune aire visible et
n'est **jamais** signalé comme entré à l'écran. Quatre maquettes sont restées blanches
sous le premier écran pendant une journée à cause de ça, et c'est Will qui l'a vu, pas
nous.

## La marque

| | |
|---|---|
| Bleu Intégral | `#0050E6` |
| Orange | `#F39A1B` |
| Encre | `#101623` (ou proche) |
| Fond | **clair**, chaud ou froid selon votre direction |

**Clair par défaut, toujours.** Will rejette les directions sombres une fois l'app en
main, trois fois en deux mois. Et le motif réel de ses rejets est **la platitude** : tout
ce qu'il valide a **une source de lumière**. Un aplat clair sans lumière est mort.

Vous choisissez votre typographie, votre grille, votre matière, votre géométrie. Deux
sites peuvent partager le bleu de la marque — ils ne doivent jamais partager la mécanique.

## Le vocabulaire — un contrôle automatique le vérifie et bloque

- On écrit toujours **« abandon de marge »**. Le synonyme commercial usuel en `r-e-m-i-s-e`
  est proscrit : il n'est pas juste juridiquement, et un contrôle automatique refuse le
  fichier qui le contient.
- Intégral Pharma est un **groupe de grossistes-répartiteurs**. Jamais un « groupement » —
  un groupement, c'est un groupe d'achat de pharmacies, ce qui est autre chose.

**Aucun taux, aucun montant, aucun pourcentage** de condition commerciale. Aucun
témoignage, aucune fausse équipe, aucun logo de laboratoire inventé — les six
laboratoires sont nommés en texte, c'est voulu tant que Will n'a pas fourni les fichiers.

Ne pas confondre : Intégral (bleu) · OPSO / Normandie Pharma (vert) · Essentiels Pharma
(lime) · Phirst (vert forêt). **Seul Intégral concerne ce site.**

## Ce que vous livrez

Un fichier : `site-integral/propositions/sites/s-XX.html`, où XX est votre numéro sur deux
chiffres. Rien d'autre. Ne touchez à aucun fichier existant.

En pied de page, discrètement : le numéro et le nom que **vous** donnez à votre direction.

## Le contrôle que vous devez faire vous-même, à l'écran

Un contrôle de code ne prouve rien. Servez votre fichier
(`python3 -m http.server` dans le dossier) et vérifiez **dans un navigateur** :

1. **1440 × 900 et 390 × 844**, parcours complet de haut en bas ;
2. **zéro bloc resté invisible** après ce parcours — comptez-les, ne les estimez pas ;
3. **zéro débordement horizontal** hors bandeaux défilants (qui dépassent par nature) ;
4. **script coupé** : la page reste lisible de bout en bout ;
5. **menu mobile** : panneau à fond plein, jamais du texte qui défile au travers ;
6. cibles tactiles **≥ 44 px**, texte courant **≥ 13 px**.

⚠️ **Trois méthodes de mesure qui mentent** — payées le 14/08/2026 :
- `getComputedStyle(el).opacity` **ne remonte pas** l'opacité d'un parent : un texte dans
  un bloc à opacité nulle est déclaré visible. Utilisez `document.elementFromPoint()` au
  centre de l'élément et vérifiez que le navigateur désigne bien cet élément.
- Une mesure qui ignore le cadre de l'écran compte des éléments **hors champ** comme
  superposés. Bornez toujours au viewport.
- La capture pleine page d'une page longue et le navigateur sans fenêtre faussent la
  position des éléments collés. **Une capture d'écran normale tranche mieux qu'un script.**

Rendez vos chiffres réels. Un rapport qui dit « tout est bon » sans compte est refusé.

## Ce que vous rendez comme réponse

Court et factuel :
1. le **nom** de votre direction et la phrase qui la résume ;
2. votre **mécanique** en une phrase — ce qu'elle fait au défilement ;
3. les **chiffres du contrôle** (blocs invisibles, débordements, hauteur, sections) ;
4. ce que vous avez **coupé** du texte validé, et pourquoi ;
5. tout **défaut trouvé et corrigé** en route — c'est la partie la plus utile.

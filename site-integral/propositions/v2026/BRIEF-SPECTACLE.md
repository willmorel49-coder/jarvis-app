# Brief — dix directions SPECTACULAIRES (21 → 30)

*Écrit le 16/08/2026, sur demande de Will, mot pour mot :*
*« j'aimerais qu'on en fasse 10 autres beaucoup plus spectaculaire, 0 imite,*
*mets-toi en mode aucune règle. Va t'inspirer évidemment sur notre JARVIS Design. »*

---

## 1. Ce qui change par rapport aux vingt premières

Les vingt maquettes 01→20 étaient bâties chacune sur **la charte d'une marque réelle**
(Apple, Stripe, Nike, Notion…). C'est fini. **« 0 imite » : tu n'as pas de charte.**
Tu inventes un système visuel qui n'existe pas encore.

Et **« aucune règle »** : les garde-fous de goût sont levés. Sombre autorisé, clair
autorisé, couleur violente autorisée, page lourde autorisée, geste long autorisé, prise de
risque **attendue**. Une maquette sage est un échec ici. Le seul reproche que Will ait
jamais fait à une direction, c'est d'être **plate** — jamais d'être trop.

Le mot d'ordre tient en un mot : **wahou**. Si quelqu'un ouvre ta page et ne dit rien à
voix haute, tu as raté.

## 2. Les seules choses qui ne se négocient pas

Elles ne sont pas là pour le style. Elles protègent la machine de Will et son métier.
Un contrôle automatique **refuse l'écriture du fichier** si tu les enfreins.

1. **Quatre interdits Safari** — ils font planter le Mac de Will, pas le tien :
   pas de découpe de dégradé dans du grand texte (`background-clip:text`), pas de verre
   dépoli (`backdrop-filter`), pas de flou sur grande surface, **une seule**
   `<video autoplay>` par page. Tout le reste du spectacle passe par du `transform`,
   du canvas ou un shader — c'est-à-dire par le processeur graphique, là où c'est gratuit.
2. **WebGL, jamais WebGPU.** `three/webgpu` tente WebGPU en premier et fige ce Mac.
   Importer `three` classique. Et prévoir ce qui s'affiche si le contexte WebGL échoue :
   une page noire n'est pas une direction artistique.
3. **Vocabulaire** — on écrit toujours « abandon de marge », jamais le synonyme en
   `r-e-m-i-s-e`, même dans un commentaire de code. Intégral Pharma est un **groupe de
   grossistes-répartiteurs**, jamais le mot en `g-r-o-u-p-e-m-e-n-t` (qui désigne les
   groupes d'achat de pharmacies, c'est-à-dire ses clients : la confusion est grave).
4. **Aucun taux, aucun montant, aucun pourcentage** de condition commerciale. Aucun
   témoignage inventé, aucun logo de laboratoire inventé, aucun chiffre ajouté.

## 3. Le texte : même source, liberté totale de composition

**Source unique : `site-integral/CONTENU-SITE-2026.md`**, validé section par section par
Will le 14/08. Tu ne réécris pas une phrase, tu n'en inventes pas, tu n'ajoutes aucun
chiffre.

**En revanche tu composes librement** : garder trois phrases sur onze sections et faire du
reste une expérience, c'est autorisé et même encouragé. Les lauréats d'Awwwards montrent
**peu de texte d'emblée** — on entre par l'image, on lit ensuite.

⚠️ Deux décisions que Will a prises contre l'avis qui lui était donné, expliquées en tête
du fichier : la phrase sur la redistribution de la marge **reste**, et l'année affichée est
**2006**. Tu les appliques telles quelles, sans jamais nommer SR Pharma.

## 4. Ta munition — la bibliothèque de Will

**`~/jarvis-design/app/data.js`** : 267 ressources, chacune avec son coût réel et sa
licence réelle. **Va la lire**, elle t'évite de perdre une heure sur un outil payant ou
sous licence contaminante.

```bash
grep -o '{ nom:"[^"]*".\{0,400\}' ~/jarvis-design/app/data.js | grep 'cat:"motion"'
grep -o '{ nom:"[^"]*".\{0,400\}' ~/jarvis-design/app/data.js | grep 'cat:"trois_d"'
```

Ce qui est **gratuit, licence permissive, et sûr sur cette machine** :

| Pour | Outil | Licence |
|---|---|---|
| Scène 3D temps réel | **Three.js** (WebGL only) | MIT |
| Shaders prêts à l'emploi | **Paper Shaders** | Apache-2.0 |
| Transitions plein écran | **GL Transitions** | MIT |
| Physique (chute, empilement, collision) | **Matter.js** | MIT |
| Découpe du texte lettre par lettre | **Splitting.js** | MIT |
| Défilement lissé | **Lenis** | MIT |
| Enchaînements, timelines | **GSAP** | gratuit, plugins compris |
| Particules | **tsParticles** | MIT — à garder discret |
| Motifs CSS génératifs | **CSS Doodle** | MIT |
| Matières / HDRI | **Poly Haven**, **ambientCG**, **cgbookcase** | CC0 |
| Polices | **Google Fonts / Bunny**, sous-ensemble latin | OFL |

⛔ **À ne PAS toucher, licences vérifiées** : LYGIA (commercial interdit), Shadertoy
(non commercial — regarder, jamais copier), Animate.css (Hippocratic, non permissive),
DSFR (interdit hors .gouv.fr), OpenMoji (partage à l'identique contaminant),
`three/webgpu` (fige le Mac).

**Auto-hébergement obligatoire** : tu télécharges la librairie dans ton dossier
`libs-XX/` et tu la sers depuis là. Aucun CDN, aucune clé d'API, aucun service payant,
aucun appel réseau sortant. Ce n'est pas une contrainte d'image : c'est que la page doit
marcher dans dix ans et depuis n'importe où.

## 5. Les médias

`site-integral/assets/`, appelés en relatif : trois vidéos (`hero.mp4`, `band.mp4`,
`clip3.mp4`), deux photos (`siege-web.jpg`, `siege-solaire.jpg`), le logo (`logo-web.png`).

⚠️ **Vérifié pixel par pixel** : `poster.jpg` est la **même image** que `siege-web.jpg`, et
`siege-solaire.jpg` est une **image extraite** de `clip3.mp4`. N'affiche pas quatre fois le
même bâtiment. Trois registres visuels distincts, maximum.

Une maquette **sans aucune photographie** sera refusée — c'est l'erreur qui a fait rater
une série entière le 14/08. Mais la matière que tu **génères** (shader, particules, 3D)
compte comme une image à part entière, et c'est même ce qu'on te demande ici.

## 6. Ta direction, et elle n'est qu'à toi

Chacun des dix reçoit **un phénomène physique ou un matériau**, pas une marque. C'est ta
mécanique de page, et personne d'autre ne l'a. Elle doit se voir dès le premier écran.

Les vingt mécaniques **déjà prises** par la série 01→20, à ne pas refaire : enfilade de
tuiles · dégradé traversant · filets verticaux · plans plein cadre · bande solaire ·
découpe de couleur · noir et blanc à filets · lieux à découvrir · plein écran spectaculaire ·
grille de magazine · ligne graduée · rail collé à gauche · marge de livre · cartes empilées ·
grille visible · comptoir crème et noir · photo désaturée à signal unique · relevé en lignes ·
panneaux d'instrument · zoom qui se resserre.

## 7. Avant de coder : deux ou trois références visuelles

C'est une règle du projet, née de deux rejets : **on ne code pas un cap visuel sans avoir
regardé des références**. Va voir <https://www.awwwards.com/websites/>, <https://tympanus.net/codrops/>
et la salle de démonstration de <https://jarvis-design-delta.vercel.app/app/>.
**Nomme dans ton rapport les deux ou trois pages qui t'ont servi de niveau**, et dis ce que
tu en as pris.

## 8. Ce que tu livres

`site-integral/propositions/v2026/m-XX.html` — ton numéro sur deux chiffres — plus
`polices-XX/` et `libs-XX/` si tu en as besoin. **Tu ne touches à aucun autre fichier.**
En pied de page, discrètement : ton numéro et le nom que **tu** donnes à ta direction.

## 9. Le contrôle, à faire toi-même, à l'écran

Un contrôle de code ne prouve rien : quatre maquettes sont restées **blanches une journée**
en passant tous les contrôles de code. Sers ton fichier et **regarde-le**.

1. **1440 × 900 et 390 × 844**, parcours complet ;
2. **zéro bloc resté invisible** — compte-les ;
3. **zéro débordement horizontal** hors bandeau défilant ;
4. **script coupé** : la page reste lisible. Et **WebGL indisponible** : idem ;
5. cibles ≥ 44 px ; texte courant ≥ 13 px ; menu téléphone à fond plein ;
6. **la fluidité se mesure** : donne les images par seconde de ton geste principal, pas une
   impression. En dessous de 30, ce n'est pas spectaculaire, c'est cassé.

⚠️ **Cinq méthodes de mesure qui mentent**, toutes payées en vrai :
- `getComputedStyle(el).opacity` ne remonte pas l'opacité d'un **parent** ;
- une mesure prise juste après un défilement lit l'image **précédente** : attends deux
  `requestAnimationFrame` ;
- `scroll-behavior:smooth` rend `scrollTo()` animé : force `behavior:'instant'` ;
- un point sondé **au centre** d'un bloc tombe souvent sur une barre fixe : sonde neuf
  points dans l'**intersection avec l'écran**, et ignore les points couverts par un élément
  `fixed` — sinon tu déclares invisible un bloc parfaitement visible ;
- le navigateur du poste est **partagé** : vérifie l'URL et le titre avant chaque mesure,
  et lance toujours Chrome avec `--user-data-dir=<dossier temporaire jetable>` — jamais le
  profil réel de Will, un chef l'a figé pour douze heures.

## 10. Ton rapport

Court et factuel : le **nom** de ta direction · les **références** que tu as regardées ·
le geste en une phrase · les **chiffres réels** du contrôle, images par seconde comprises ·
ce que ta page **coûte** (vidéos, contextes WebGL, poids total) · et surtout les **défauts
trouvés et corrigés** en route — c'est la partie la plus utile de tout le rapport.

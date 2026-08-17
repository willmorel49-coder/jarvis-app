# Brief — dix directions HORS NORME (41 → 50)

*Écrit le 16/08/2026. Demande de Will, mot pour mot : « créer encore 10 nouveaux sites*
*encore plus fou que tous ceux qu'on a fait. Va évidemment gagner du temps sur les*
*inspirations et toute l'app JARVIS Design. »*

**Le brief `BRIEF-SPECTACLE.md` du même dossier s'applique intégralement** — garde-fous
Safari, WebGL et jamais WebGPU, vocabulaire, aucune condition commerciale, médias
obligatoires, auto-hébergement, contrôle à l'écran. Ce fichier-ci ne dit que ce qui
change. Lis les deux.

---

## 1. Le niveau : au-dessus des quarante précédentes

Quarante directions existent déjà et **aucune n'est ratée**. Ta seule façon d'exister,
c'est d'aller plus loin. Une maquette « correcte » est un échec ici : elle sera comparée
à quarante sœurs déjà contrôlées, mesurées et en ligne.

**Va les regarder avant de dessiner**, c'est le plus court chemin pour comprendre le
niveau à dépasser :
<https://willmorel49-coder.github.io/jarvis-app/site-integral/propositions/v2026/>

## 2. Gagne du temps : la bibliothèque est déjà faite

C'est la consigne explicite de Will. **Ne recherche pas ce qui est déjà trouvé.**

**L'app** : <https://jarvis-design-willmorel49-coders-projects.vercel.app/app/>
Une salle de démonstration : chaque catégorie montre en direct ce que ses outils
produisent — polices rendues, palettes cliquables, effets vivants, 64 systèmes de design.

**Le catalogue brut**, à lire en une commande plutôt qu'à chercher en ligne :
```bash
grep -o '{ nom:"[^"]*".\{0,400\}' ~/jarvis-design/app/data.js | grep 'cat:"motion"'
grep -o '{ nom:"[^"]*".\{0,400\}' ~/jarvis-design/app/data.js | grep 'cat:"trois_d"'
grep -o '{ nom:"[^"]*".\{0,400\}' ~/jarvis-design/app/data.js | grep 'cat:"inspi"'
ls ~/jarvis-design/app/design-md/          # 74 chartes complètes, en local
```

**Les galeries d'inspiration déjà triées** — deux ou trois suffisent, n'y passe pas
une heure : Awwwards `awwwards.com` · **Codrops** `tympanus.net/codrops/` (MIT, le code
est reprenable) · Recent `recent.design` · Httpster `httpster.net` · Siteinspire
`siteinspire.com` · Minimal Gallery `minimal.gallery` · Are.na `are.na`.

**Les outils déjà validés, gratuits et à licence permissive** — inutile d'en chercher
d'autres : Three.js (MIT, **WebGL only**) · GSAP · Lenis (MIT) · Anime.js (MIT) ·
Matter.js (MIT) · Splitting.js (MIT) · Flubber (MIT) · Theatre.js (Apache-2.0) ·
tsParticles (MIT) · CSS Doodle (MIT) · Paper Shaders (Apache-2.0) · GL Transitions (MIT) ·
postprocessing pmndrs (Zlib). Matières et modèles CC0 : Poly Haven, ambientCG,
cgbookcase, Poly Pizza, Quaternius, Kenney, Texture Ninja.

⛔ **À ne pas toucher, licences vérifiées** : LYGIA, Shadertoy (non commercial),
Animate.css (Hippocratic), DSFR, OpenMoji, `three/webgpu` (fige le Mac).

## 3. Les cinquante mécaniques déjà prises

Tu ne peux réutiliser aucune de celles-ci. Elles sont toutes en ligne, va vérifier.

**Série 1 (chartes réelles)** : enfilade de tuiles · dégradé traversant · filets verticaux ·
plans plein cadre · bande solaire · découpe de couleur · noir et blanc à signal unique ·
lieux à découvrir · plein écran spectaculaire · grille de magazine · ligne graduée ·
rail collé à gauche · marge de livre · cartes empilées · grille visible · comptoir crème
et noir · photo désaturée · relevé en lignes · panneaux d'instrument · zoom qui se resserre.

**Série 2 (phénomènes)** : fluide · typographie cinétique · traversée d'un volume ·
essaim de particules · déchirure plein écran · physique et chute · lumière qui se déplace ·
montage cinéma · réfraction du verre · brutalisme.

**Série 3 (3D et mouvement)** : tunnel · métamorphose d'une forme unique · miroir d'eau ·
tissu · assemblage éclaté · profondeur de champ · trait continu · champ de force ·
croissance ramifiée · pliage.

## 4. Deux leçons payées cher par tes prédécesseurs

**L'écran de chargement.** Un chef a livré une ouverture de **neuf secondes** : trop pour
une vitrine. **Deux secondes maximum**, et la page reste utilisable pendant.

**Le collage.** `overflow-x:hidden` sur `<body>` fait du body une zone de défilement et
**annule tout `position:sticky` de la page**. Deux maquettes en sont mortes — l'une
affichait un écran entièrement noir. Écris `overflow-x:clip`, jamais `hidden`.

## 5. Liens externes

`https://www.integralpharma.fr/jobs` et `https://www.integralpharma.fr/mentions-l%C3%A9gales`
répondent. **`/carrieres` renvoie 404** — treize maquettes s'y sont trompées, ne fais pas
la quatorzième.

## 6. Ton rapport

Le nom de ta direction · les deux ou trois références regardées · le geste en une phrase ·
les **images par seconde mesurées** · ce que la page coûte · et les **défauts trouvés et
corrigés** en route, qui restent la partie la plus utile.

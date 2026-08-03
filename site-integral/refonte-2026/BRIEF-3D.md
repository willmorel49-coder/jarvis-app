# Brief — passe « exploration 3D premium »

> Objectif de Will : que le site soit **incroyablement époustouflant**, avec des implantations en vraie 3D et une dimension d'exploration. Arbitré avec lui le 01/08/2026.

## La direction retenue : EXPLORATION, pas divertissement

Will a choisi « exploration 3D premium » parmi trois lectures possibles de « gamifier ». Concrètement :

✅ **Ce qu'on fait** : une scène 3D qu'on **parcourt**. Des bâtiments qui se dévoilent quand on s'en approche, un survol qui récompense la curiosité, une caméra qui suit le scroll, des détails qu'on ne découvre qu'en cherchant. Le plaisir vient de l'exploration et de la qualité du rendu.

⛔ **Ce qu'on ne fait pas** : badges, points, scores, avatars, sons, confettis, mini-jeux d'arcade. Will a explicitement rejeté les directions `acide-playful` et `nuit-neon` parce qu'elles faisaient gadget. Un pharmacien de 55 ans doit se sentir face à une maison sérieuse, pas devant un jeu mobile.

**Le test** : si un titulaire de 55 ans peut dire « c'est impressionnant », c'est gagné. S'il peut dire « c'est un jeu vidéo », c'est raté.

## Les 3 maquettes retenues (3 approches 3D différentes)

| # | Page | L'axe 3D |
|---|---|---|
| **08** | Réseau Vivant | **Les implantations en architecture 3D** sur la carte de France. C'est l'exemple donné par Will. |
| **07** | Aurore Liquide | **Une matière 3D immersive** qu'on traverse — le shader devient un espace. |
| **10** | Manifeste Cinétique | **La typographie en volume** — des lettres qui existent dans l'espace, pas sur un plan. |

Les 6 autres maquettes ne sont PAS touchées : Will n'en gardera qu'une, inutile de tout sur-travailler.

## Contraintes techniques — non négociables

**Pas de modèles importés.** `vendor/vanta/three.min.js` (601 Ko) est disponible, mais il n'y a **ni GLTFLoader ni OrbitControls**, et aucun fichier de modèle 3D. Toute la géométrie doit être **construite en code** : volumes, extrusions, instanciation. Le style à viser est le **low-poly architectural** — anguleux, matiéré, éclairé avec soin. C'est beau, c'est léger, et ça ne demande aucun asset.

`vendor/ogl/ogl.mjs` (130 Ko) reste disponible pour le WebGL léger.
⛔ Aucun CDN. ⛔ Ne pas charger `ogl.umd.js.CASSE-*` ni `cobe.js.CASSE-*` (fichiers morts).

**La machine cible : MacBook Air M1, 8 Go de RAM.** C'est le Mac de Will, et il a DÉJÀ figé cette semaine à cause d'effets trop lourds. Budget à respecter :
- viser 60 images/seconde sur cette machine, jamais moins de 30
- géométrie instanciée dès qu'un élément se répète (les 9 bâtiments = une instance, pas neuf objets)
- pas d'ombres temps réel coûteuses : privilégier des ombres cuites ou des dégradés
- couper la scène quand elle sort de l'écran (IntersectionObserver)
- **sur mobile et sans WebGL : un repli statique soigné**, pas un écran vide
- repli `prefers-reduced-motion` : scène figée sur une image, tout reste lisible

**Rappel des règles Safari** : jamais `background-clip:text`, `backdrop-filter`, `filter:blur` sur grande surface. Une seule vidéo autoplay.

## Le contenu ne bouge pas

Le `REFERENTIEL.md` fait foi et vient d'être corrigé deux fois par Will :
- **Le métier, c'est grossiste-répartiteur national.** L'accompagnement de projets est annexe (moins de 5 % de la page). Ne pas réintroduire de section « Vos projets ».
- 3 valeurs : **Confiance · Engagement · Respect**
- 9 implantations, noms et villes exacts
- Contact : **contact@integralpharma.fr** seul, aucun contact personnel, aucun téléphone
- Aucune condition commerciale, ni par mot ni par formulation
- Titre : « Livrer la pharmacie française, autrement. »

## Preuve exigée

Servir par `python3 -m http.server`, ouvrir au MCP playwright, **regarder les captures**, vérifier en 1440 px et 390 px, console propre, zéro débordement. **Et mesurer les images par seconde** de la scène 3D — une scène magnifique à 12 images/seconde est un échec, pas une réussite.

# BRIEF — Version CLAIRE, institutionnelle mais proche (groupements de pharmacies)

Objectif de Will : le teaser actuel est **trop foncé**. On veut **beaucoup plus clair**, **institutionnel MAIS proche** des groupements de pharmacies (rassurant, sérieux, crédible — et en même temps chaleureux, humain, proximité). Garder du **3D + motion design INCROYABLE**, en utilisant de VRAIS modules pro téléchargés.

## BASE DE DÉPART
Pars du teaser validé : `/Users/williammorel/JARVIS/APP/site-integral/teaser/maquette-10v2-A-relief.html`. Lis-le en entier.
GARDE tout le CONTENU et les INTERACTIONS : logo, **siège aux panneaux solaires** (`../assets/siege-solaire.jpg` + vidéo `../assets/clip3.mp4`), **carte 3D des 9 établissements** avec **survol → zoom caméra + fiche coordonnées GPS**, annuaire des établissements, section promesse marge + **zéro exclusion** + **centrale parapharmacie** (SANS citer Offilog), valeurs **Confiance·Engagement·Respect**, invitation **Pascale Prieto** (mail/tel), angle **marge SANS AUCUN chiffre commercial**, ton « vos adhérents ».

## LE VIRAGE : THÈME CLAIR
- Fond **clair** (blanc / blanc cassé / crème / bleu très pâle selon ta direction). **Texte foncé** (navy #0A1430).
- Institutionnel = structure claire, beaucoup d'air, alignements nets, hiérarchie forte, sobriété crédible.
- Proche = chaleur (arrondis, une couleur chaude, un visuel humain, un ton direct « on »), pas froid/corporate glacé.
- Marque : bleu primaire **#0050E6**, orange accent **#F39A1B** (léger), navy texte **#0A1430**.

## 3D + MOTION SUR FOND CLAIR (piège n°1)
⚠️ Sur fond clair, **PAS d'AdditiveBlending** (ça délave tout). Adapter la carte 3D France :
- France en relief clair (blanc/gris perle, matériau PBR doux) ou fill clair, **ombres portées douces**, côte bleue nette.
- Établissements = **marqueurs SOLIDES saturés** bien visibles (pins/colonnes/sphères) : **siège Hyères en orange plein #F39A1B**, agences en **bleu plein #0050E6**, partenaire distinct. Halos = couleurs pleines à faible opacité (pas d'additive), ombres douces. Titres/labels **foncés** sur fond clair.
- Conserver l'**orbite + parallax** et surtout le **survol → zoom + fiche coordonnées** (raycasting).
- Fallback propre si WebGL absent / `prefers-reduced-motion`.

## MODULES PRO À UTILISER (déjà téléchargés dans le projet)
Chemins relatifs depuis `teaser/` : `../vendor/…`
- **GSAP** `../vendor/gsap.min.js` + **ScrollTrigger** `../vendor/ScrollTrigger.min.js` → animations au scroll (reveals, pin léger, scrub, parallax, ignition de la carte au scroll).
- **Lenis** `../vendor/lenis.min.js` → smooth scroll « velours » (⚠️ `smoothTouch:false`, fallback scroll natif, **désactiver si reduced-motion**, ne pas casser le scroll Safari).
- **Splitting.js** `../vendor/splitting.min.js` + `../vendor/splitting.css` → typo cinétique (mots/lettres) — PAS de background-clip:text.
- **Three.js r128** reste en CDN (global THREE).

## RÈGLES SAFARI (impératives)
0 `background-clip:text` sur grand texte · 0 `backdrop-filter` / `filter:blur()` sur grandes surfaces · 1 vidéo max · fallback WebGL/poster · `prefers-reduced-motion` respecté (Lenis off, états finaux visibles) · **mobile-first**, aucun scroll horizontal (`html{overflow-x:hidden}`).

## LIVRABLE
Un fichier HTML complet et autonome (hors ../assets, ../vendor, fonts, three CDN). Rendu **PROFESSIONNEL, clair, institutionnel-mais-proche, avec 3D + motion bluffant**. Écris-le à l'emplacement exact demandé.

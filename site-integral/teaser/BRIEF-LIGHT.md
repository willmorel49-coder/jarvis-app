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

## ⚠️⚠️ LA CARTE 3D RESTE SOMBRE (décision de Will, PRIORITAIRE)
Will trouve la carte **bien meilleure sur fond FONCÉ** (les faisceaux lumineux y sont parfaitement intégrés). **NE PAS convertir la carte 3D en clair.** On garde la carte 3D EXACTEMENT comme dans la version A (fond nuit navy, faisceaux additifs, halo Fresnel, survol zoom + fiche coordonnées, ignition au scroll) — mais on l'installe comme une **BANDE SOMBRE « showcase »** (section pleine largeur au fond navy #0A1430/#060B1C) au milieu de la présentation claire. Le contraste clair→sombre→clair est VOULU (c'est le moment fort). Transitions douces entre les sections claires et la bande sombre (dégradé, ou séparateur net). Le titre/texte de CETTE section réseau restent clairs (sur le fond sombre), le reste de la page est foncé sur clair.

## LE RESTE DE LA PAGE = CLAIR (hero, promesse, valeurs, invitation, siège…)
Tout le reste passe en clair (fond clair, texte navy foncé), institutionnel-mais-proche. SEULE la section carte réseau (et éventuellement le hero si tu veux un rappel) reste sombre.

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

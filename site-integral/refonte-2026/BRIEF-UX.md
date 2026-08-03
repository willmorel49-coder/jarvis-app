# Brief UX/UI — passe d'amélioration des 9 maquettes

> À lire AVANT toute modification. Le référentiel de contenu est dans `REFERENTIEL.md` — il fait foi et ne se discute pas.

## Le constat de Will

« Il y a plein de sites qui ne sont pas possibles en utilité et en UX/UI. » Objectif : que les 9 soient **fluides et harmonieuses**, sans perdre ce qui fait leur différence visuelle.

## Diagnostic mesuré (31/07/2026)

| # | Sections | Mots | Menu | Points de contact | Faiblesse principale |
|---|---|---|---|---|---|
| 02 Vague | 6 | 611 | ✅ | 8 | correcte |
| 03 Aurore | 7 | 570 | ✅ | 9 | correcte |
| 04 Bleu & Glacial | 5 | 613 | ✅ | 5 | correcte |
| 05 Brume | 6 | 513 | ✅ | 12 | correcte |
| 06 Bento | 5 | 454 | ✅ | 5 | contenu un peu court |
| **07 Aurore Liquide** | **3** | **265** | ✅ *(ajouté)* | 5 | **la plus pauvre : 3 sections, 265 mots** |
| **08 Réseau Vivant** | **3** | 422 | ✅ | 6 | **3 sections seulement** |
| 09 Profondeur | 7 | 404 | ✅ | **2** | **peu de points de contact** |
| 10 Manifeste | 5 | 405 | ✅ | **2** | **peu de points de contact** |

✅ Aucun lien mort sur les 9 (17 à 23 ancres vérifiées par page).

## Ce qu'il faut corriger, par ordre de gravité

1. **Contenu trop maigre** (07 surtout, puis 08 et 06) : une page vitrine de 265 mots ne convainc personne. Il manque une section « le métier » ou « comment ça se passe ». Le contenu doit venir du `REFERENTIEL.md` (les 4 projets accompagnés : transfert d'officine, agrandissement, cession de parts, optimisation — encore absents de plusieurs pages).
2. **Points de contact rares** (09, 10) : un seul bouton en bas de page. Il en faut un dans l'en-tête, un après la section réseau, un en clôture.
3. **Fluidité de lecture** : vérifier que le rythme des sections est régulier, que rien ne saute, que les animations ne bloquent pas la lecture.
4. **Cohérence des composants** : boutons, cartes, surtitres, espacements — la même grammaire d'une page à l'autre, même si les couleurs et les effets diffèrent.

## Règles absolues (aucune exception)

- Le **contenu** est figé par `REFERENTIEL.md` : identité, 3 valeurs (Confiance · Engagement · Respect), 9 implantations, chiffres, coordonnées. On peut **ajouter** du contenu conforme, jamais contredire.
- ⛔ **Aucune condition commerciale** : ni pourcentage, ni « franco », ni « remise », ni « plus de marge ». Jamais le mot « groupement ».
- ⛔ **Safari** : jamais `background-clip:text`, `backdrop-filter`, `filter:blur` sur grande surface. Une seule vidéo autoplay. Toujours un repli `prefers-reduced-motion`.
- ⛔ Le masquage avant révélation au scroll doit être posé **par JavaScript**, jamais en CSS seul (sinon page blanche si le script casse).
- **Palette** : bleu `#0050E6`, orange `#F39A1B`, blanc glacial `#F8FAFC`, encre `#0A0E1A`. Aucune autre famille de couleurs.
- Aucun CDN : les librairies sont dans `vendor/` en local.
- Images : `siege-web.jpg` et `logo-web.png` uniquement.
- **Ne jamais toucher à `index.html`** (la galerie) ni aux pages des autres agents.

## Ce qui ne doit PAS être uniformisé

La palette d'ambiance, la typographie d'accent, les effets, la mise en page. **Les maquettes doivent rester radicalement différentes à l'œil.** On harmonise la qualité et le rythme, pas l'apparence.

## Preuve exigée

Servir le dossier `site-integral` par `python3 -m http.server` (file:// ne marche pas), ouvrir avec le MCP playwright, **regarder la capture**, vérifier en 1440 px ET 390 px, console sans erreur. Tuer son serveur à la fin. Aucun `git commit`.

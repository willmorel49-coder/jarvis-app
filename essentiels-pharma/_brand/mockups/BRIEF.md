# Brief maquettes créatives — App Essentiels Pharma

But : app **ultra simple, focus SUIVI GROUPEMENT + LISTING PRODUITS**, pour 2 usages :
- **Pascale (DR Intégral)** : piloter le groupement.
- **François Tesson (Président Essentiels Pharma)** : visuel de présentation.
PAS de features Jarvis inutiles (pas de catalogue IP complet, pas de CRM lourd).

## Données à utiliser (fichier `data.json` dans ce dossier — lis-le et embarque-le inline dans ton HTML)
- `grp` : 23 officines, 8 déjà clientes Intégral, 47 pharmaciens, 45 M€/an, 181 salariés, 290 labos.
  Dirigeants : **François Tesson (Président)**, **Céline Boultareau (Direction)**. ⚠️ NE PAS mentionner Christophe Le Gall (plus de rôle opérationnel).
- `officines` : 23 pharmacies (nom, ville, cp, lat, lng, client=déjà cliente Intégral, ca=CA si dispo). Anjou/Angers (majorité), Nantes, Saumur, Cholet, Le Mans, Paris…
- `offre_privilege` : produits offre IP (Kardegic 433 pharmas, Doliprane, Aspegic… ppht→net).
- `exclu_gen` : exclusivités génériques à 1€ (Sildenafil, Tadalafil).
- `glp1` : Wegovy, Mounjaro (prix IP).
- `penetration` : top produits par nb de pharmacies qui commandent (n).
- « n » = nombre de pharmacies Intégral qui commandent déjà = **argument massue** (« déjà commandé par X pharmacies »).

## Direction Artistique (obligatoire — vraie marque Essentiels Pharma)
- **Thème SOMBRE** : fond `#0E1310`, surfaces `#161C15`, texte blanc `#FFFFFF`, texte secondaire `#A9B4A3`.
- **Vert marque `#57AE31`** (accents/fills), vert texte-sur-sombre `#8FD45F`/`#96CD40` (lime), tons logo `#00A85C`/`#66F282`/`#B5F257`.
- **Typo** : titres **Comfortaa** (400/600, arrondi), texte **Montserrat** (300/500). Google Fonts CDN autorisé :
  `https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;600&family=Montserrat:wght@300;500&display=swap`
- **Logo** : symbole quatre-feuilles bouclé (4 pétales/boucles à 0/90/180/270°, couleurs blanc-vert/lime/vert foncé/vert clair). Reconstruis-le en SVG inline OU récupère le SVG déjà fait dans `../preview.html` OU utilise `../assets/logo-essentiels-mark.png`.
- **Signature** : boutons **pill** (radius 100px), **pills verts qui surlignent un mot** dans les titres, badges circulaires à anneau, flat (peu d'ombres). Baseline « Le réflexe santé ».
- Carte : Leaflet (CDN unpkg) tuiles sombres CARTO `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` si tu mets une carte.

## Contraintes
- **1 seul fichier HTML autonome** (CSS + JS inline, data inline). Mobile-first, responsive 390px ET desktop.
- **Ultra créatif, PAS classique** — surprends. Anime, ose la mise en page. Mais lisible et fidèle à la DA.
- Pas de vrai backend/login : c'est une maquette de présentation (données figées).

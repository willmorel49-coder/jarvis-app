# BRIEF PARTAGÉ — Teaser d'invitation Intégral Pharma (pour patrons de groupement)

Tu construis **UNE page HTML autonome** : un « carton d'invitation » ultra court qu'un commercial
enverra par mail à un **patron de groupement de pharmacies** pour lui donner envie d'accepter un rendez-vous.
Ce n'est PAS le site complet. Ça se lit en 30 secondes, sur mobile d'abord.

## Émetteur
Intégral Pharma — un groupe de grossistes-répartiteurs français indépendant. « Acteur de la santé depuis plus de 20 ans. »
Ton : sobre, chaleureux, premium, confiant. Zéro argumentaire de vente lourd.

## RÈGLE DU BOSS (impérative)
- **AUCUNE condition commerciale** : pas de taux de remise, pas de %, pas de prix, pas de montant. On les donne en RDV.
- Ne pas écrire le mot « groupement » pour parler d'Intégral (Intégral = « groupe de grossistes »). Le destinataire, lui, EST un groupement.
- Chiffres publics AUTORISÉS seulement (à utiliser avec parcimonie, discrets) : « plus de 20 ans », « 9 agences en France », « livraison en 72h ».

## LES 3 ÉLÉMENTS OBLIGATOIRES (le cœur du brief, ne rien retirer)
1. **La photo du siège** (vue aérienne) → `../assets/siege.jpg` (fallback `../assets/poster.jpg`). Optionnel : vidéo drone `../assets/hero.mp4` (1 SEULE vidéo max, muted, playsinline).
2. **La carte interactive des établissements** → iframe `../map-component.html?mode=map`
   - `<iframe src="../map-component.html?mode=map" scrolling="no" style="width:100%;border:0">`
   - La carte s'auto-dimensionne : écoute `window.addEventListener('message', e => { if(e.data?.ipAtlasHeight) iframe.style.height = e.data.ipAtlasHeight+'px' })`.
   - Accroche autour : « Nos agences, partout où sont vos officines. »
3. **Les 3 valeurs** : **Confiance · Engagement · Respect** (mises en forme jolies, pictos épurés ou typo).

## LOGO
`../assets/logo.png` (capsule orange+argent « ip » + « integral » orange + « pharma » bleu, fond transparent). Hauteur ~34–44px.

## APPEL À L'ACTION (une seule intention : « Rencontrons-nous »)
Deux boutons vers **Pascale Prieto, Directrice commerciale France** :
- Mail : `mailto:pascale.prieto@integralpharma.fr?subject=Rencontrons-nous%20%E2%80%94%20Int%C3%A9gral%20Pharma` — libellé « Écrire à Pascale »
- Tel : `tel:+33676885391` — libellé « Appeler Pascale » (affichage : 06 76 88 53 91)
Signature discrète en bas : « Pascale Prieto — Directrice commerciale France — Intégral Pharma ».

## MARQUE (couleurs & typo)
- Bleu primaire `#0050E6`, bleu foncé `#0034A0`, navy `#0A1430`, orange accent `#F39A1B` (accent LÉGER), fond clair `#F4F6FB`, blanc `#FFFFFF`.
- Tu peux réinterpréter la palette selon ta direction artistique (nuit, crème, menthe…) tant que le bleu et l'orange restent l'ADN.
- Typo : Satoshi (via Fontshare) + Geist Mono pour les chiffres. Tu peux ajouter UNE police d'accent Google Fonts selon ta direction (Anton, Fraunces, Space Grotesk, Clash Display…).

## CONTRAINTES TECHNIQUES SAFARI (impératives — le Mac de Will crashe sinon)
- **INTERDIT** : `background-clip:text` sur du grand texte · `backdrop-filter` / `filter:blur()` sur de grandes surfaces · plusieurs vidéos autoplay.
- **AUTORISÉ** : WebGL / **Three.js r128** via CDN cdnjs (`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`, global `THREE`, PAS de modules ESM), Canvas 2D, animations CSS/JS, SVG animé, GLSL shaders.
- Pièges 3D connus : `MeshPhysicalMaterial` transmission>0 → objet invisible en r128 ; metal sans envMap → noir ; orange trop éclairé vire jaune (baisser lumières, orange plus rouge-orangé + un peu d'émissif).
- **Fallback obligatoire** : si WebGL/CDN indisponible OU `prefers-reduced-motion`, afficher un fond statique propre (poster.jpg / dégradé). Mettre en pause le rAF hors écran.
- 1 seul fichier HTML autonome (CSS + JS inline). Seules dépendances externes tolérées : Google Fonts / Fontshare + Three.js cdnjs. Images/vidéo/carte = chemins relatifs ci-dessus.
- **Mobile-first**, responsive, pas de scroll horizontal, `prefers-reduced-motion` respecté.

## STRUCTURE (adapte à ta direction, mais couvre tout)
Accroche (logo + phrase + photo/vidéo siège) → Le réseau (carte interactive) → Les 3 valeurs → L'invitation (2 boutons Pascale + signature). Court. Pas de sections de blabla en plus.

Livrable : écris le fichier HTML complet à l'emplacement exact qu'on te donne. Fais quelque chose de VISUELLEMENT BLUFFANT.

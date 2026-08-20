/* mkt-li-da-data.js — Direction artistique image d'INTEGRALPHARMA.
   Établie le 20/08/2026 en analysant nos 39 visuels LinkedIn publiés entre le
   27/08/2025 et le 23/06/2026 : couleurs relevées au pixel, natures d'image
   classées automatiquement, engagement comparé.
   ⚠️ var (pas const) : fichier chargé dynamiquement. */

var LI_DA = {
  version: '2026-08-20',
  corpus: '39 visuels publiés du 27/08/2025 au 23/06/2026',

  // Ce qui a été MESURÉ, pas estimé à l'œil.
  constat: [
    { k: 'Format', v: '1200 × 1200 px, carré', d: '39 visuels sur 39. C’est notre seul point parfaitement constant.' },
    { k: 'Fond', v: 'crème #FEFDF9', d: 'Occupe 64 % de la surface sur nos visuels gabarités. Chaud, jamais blanc pur.' },
    { k: 'Couleurs', v: 'blanc/crème 29 % · bleu 26 % · gris 14 % · orange 12 %', d: 'Mesuré sur les 39 visuels, pixel par pixel.' },
    { k: 'Nature', v: '22 aplats · 11 mixtes · 6 photos', d: 'Classement automatique par nombre de nuances et taille des zones uniformes.' },
    { k: 'Engagement', v: 'aplats 23 · mixtes 22 · photos 25 (médianes)', d: '⚠️ Écart-type 5,8 sur 564 abonnés : aucun style ne se détache. La DA se choisit sur la cohérence, pas sur ces chiffres.' },
    { k: 'Logo', v: 'le plus souvent en haut à droite', d: 'Absent des 7 visuels purement photographiques. Détection automatique peu fiable — lecture faite sur planche contact.' }
  ],

  palette: [
    { nom: 'Crème',        hex: '#FEFDF9', role: 'Le fond, toujours. Jamais de blanc pur : il durcit tout.' },
    { nom: 'Indigo',       hex: '#111143', role: 'Les formes d’angle et le texte. C’est la couleur qui nous identifie.' },
    { nom: 'Orange ocre',  hex: '#D97A1C', role: 'L’accent principal des illustrations. Vêtements, objets, éclats.' },
    { nom: 'Jaune doré',   hex: '#FFD249', role: 'Le second accent. Cheveux, aplats secondaires, ponctuations.' },
    { nom: 'Gris moyen',   hex: '#545454', role: 'Les neutres de l’illustration. Vêtements, mobilier.' },
    { nom: 'Noir',         hex: '#000000', role: 'Traits fins des visages et des mains, uniquement.' }
  ],

  // TROIS APPROCHES, sur le modèle des trois textes : ce ne sont pas des
  // variantes d'un même prompt, ce sont trois façons de traiter le même post.
  // Toutes restent dans notre DA. On copie celle qui va, on ne choisit pas au hasard.
  approches: [
    { k: 'gabarit',
      label: 'Notre gabarit',
      aide: 'Notre signature. Le choix par défaut : c’est lui qui rend un post reconnaissable comme le nôtre au premier coup d’œil dans le fil.',
      tpl:
'RENDU — Illustration vectorielle à plat, style éditorial corporate. Formes pleines, aucun contour sur les corps, traits noirs fins uniquement pour les visages et les mains. Aucun dégradé, aucune ombre portée, aucun relief, aucun photoréalisme.\n\n' +
'COMPOSITION — Sujet centré, largement détouré. Deux formes organiques arrondies en indigo débordent de l’angle haut-gauche et de l’angle bas-droite, contours souples, comme deux vagues. Le tiers inférieur reste vide : la légende s’y posera. L’angle haut-droite reste libre pour le logo.\n\n' +
'PALETTE — Fond crème #FEFDF9. Indigo #111143 pour les formes d’angle. Accents : orange ocre #D97A1C et jaune doré #FFD249. Neutres : gris #545454, noir, blanc. Aucune autre couleur.\n\n' +
'PERSONNAGES — Silhouettes simplifiées, proportions naturelles, âges et origines variés, expressions calmes et chaleureuses. Jamais de sourire commercial.\n\n' +
'INTENTION — {SUJET}\n' +
'(Cette intention dit ce qu’il faut faire comprendre. C’est le RENDU ci-dessus qui commande la forme : réinterpréter librement si les deux se contredisent.)\n\n' +
'À ÉVITER — Blanc pur, dégradés, ombres portées, effet 3D, texte, lettres, chiffres, logo, visage photoréaliste, imagerie médicale anxiogène.\n\n' +
'FORMAT — Carré 1:1, 1200 × 1200 px.' },

    { k: 'concret',
      label: 'Le concret',
      aide: 'La vraie chose, le vrai geste, le vrai lieu. À prendre quand le sujet est un métier, une coulisse, un objet — tout ce qui gagne à se sentir vécu plutôt que dessiné.',
      tpl:
'RENDU — Photographie documentaire prise sur le vif. Léger grain, rien de retouché, rien de publicitaire. Si la scène décrit un mouvement, produire l’image d’ouverture, celle qui s’affiche avant le clic.\n\n' +
'COMPOSITION — Cadrage serré sur le geste ou sur l’objet. Profondeur de champ courte, arrière-plan flou. Un tiers de l’image laissé calme pour recevoir la légende.\n\n' +
'LUMIÈRE — Naturelle et rasante. Chaude sur les scènes humaines, bleu-gris froide sur les zones techniques et tout ce qui touche au froid. Jamais de flash frontal.\n\n' +
'INTENTION — {SUJET}\n' +
'(Cette intention dit ce qu’il faut faire comprendre. C’est le RENDU ci-dessus qui commande la forme : réinterpréter librement si les deux se contredisent.)\n\n' +
'À ÉVITER — Visage net et identifiable, sourire posé, blouse immaculée, logo, marque ou nom de produit lisible, texte incrusté, ambiance « photo de banque d’images ».\n\n' +
'FORMAT — Carré 1:1, 1200 × 1200 px.' },

    { k: 'idee',
      label: 'L’idée forte',
      aide: 'Un seul objet, isolé, et beaucoup de vide. À prendre quand la phrase porte déjà tout le message et que l’image doit juste faire s’arrêter le pouce.',
      tpl:
'RENDU — Image conceptuelle minimaliste. Un seul objet ou un seul signe, isolé, traité avec évidence. Soit une photographie très épurée, soit une illustration au trait — jamais les deux mélangées.\n\n' +
'COMPOSITION — Le sujet occupe moins d’un quart de l’image. Tout le reste est vide. Le vide fait partie du message. Centre de l’image laissé libre si une phrase doit s’y poser ensuite.\n\n' +
'PALETTE — Fond crème #FEFDF9. Une seule couleur d’accent : orange ocre #D97A1C, ou indigo #111143 si le sujet est grave.\n\n' +
'INTENTION — {SUJET}\n' +
'(Cette intention dit ce qu’il faut faire comprendre. C’est le RENDU ci-dessus qui commande la forme : réinterpréter librement si les deux se contredisent.)\n\n' +
'À ÉVITER — Toute lettre, tout chiffre, tout texte. Le moindre encombrement. Plus d’un objet dans le cadre. Toute symbolique médicale convenue (stéthoscope, croix verte, gélules en tas).\n\n' +
'FORMAT — Carré 1:1, 1200 × 1200 px.' }
  ],

  regles: [
    'Toujours carré, 1200 × 1200. C’est le seul format que LinkedIn n’abîme pas dans le fil.',
    'Le fond est crème #FEFDF9, jamais blanc pur.',
    'Les deux formes d’angle en indigo sont notre signature : elles reviennent sur tous les visuels gabarités.',
    'Le logo se pose en haut à droite, après génération. On ne le fait jamais générer.',
    'On ne fait jamais écrire le texte par le générateur : il rate les accents et la ponctuation française. On le pose après.',
    'Trois couleurs d’accent au maximum dans une même image, en plus du fond et de l’indigo.',
    'Le tiers inférieur reste libre pour la légende.'
  ],

  aEviter: [
    'Le blanc pur : il durcit l’image et casse la continuité avec nos visuels existants.',
    'Les dégradés et les ombres portées sur les illustrations à plat.',
    'Les photos « stock » avec sourires appuyés et blouses immaculées : c’est ce qui fait le plus faux.',
    'Le mélange illustration + photo dans la même image.',
    'Plus de deux polices, et toute police à empattement — sauf exception assumée.',
    'Les visages identifiables sans autorisation écrite.'
  ]
};

window.LI_DA = LI_DA;

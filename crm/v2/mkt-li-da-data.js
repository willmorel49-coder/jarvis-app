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

  // Trois familles. On choisit selon le sujet, pas selon l'humeur.
  familles: [
    { k: 'illustration',
      label: 'Illustration à plat',
      quand: 'Le choix par défaut, et notre signature. Pour tout ce qui met en scène des personnes, un geste, une idée abstraite.',
      prompt:
'Illustration vectorielle à plat, style éditorial corporate, format carré 1:1 en 1200×1200 px.\n' +
'Fond crème uni #FEFDF9 avec beaucoup d’espace vide.\n' +
'Deux formes organiques arrondies en indigo profond #111143 qui débordent des angles haut-gauche et bas-droite, contours souples, comme deux vagues.\n' +
'Palette strictement limitée à : orange ocre #D97A1C, jaune doré #FFD249, indigo #111143, gris moyen #545454, noir, blanc.\n' +
'Personnages simplifiés, sans contour sur les corps, traits noirs fins uniquement pour les visages et les mains. Âges et origines variés. Expressions calmes et chaleureuses.\n' +
'Aucun dégradé, aucune ombre portée, aucun effet 3D, aucun photoréalisme.\n' +
'Le tiers inférieur reste vide pour recevoir une légende.\n' +
'SUJET : ' },
    { k: 'photo',
      label: 'Photographie',
      quand: 'Pour les coulisses, les métiers, les lieux. Tout ce qui doit se sentir réel et vécu.',
      quandPlus: 'Ne jamais mettre de visage identifiable sans autorisation écrite de la personne.',
      prompt:
'Photographie documentaire, format carré 1:1 en 1200×1200 px.\n' +
'Lumière naturelle, chaude, rasante. Ambiance sobre et vécue, jamais publicitaire ni « stock photo » souriante.\n' +
'Dominante froide bleu-gris pour les intérieurs techniques, dominante chaude pour les scènes humaines.\n' +
'Profondeur de champ courte, mise au point sur le geste ou l’objet, arrière-plan flou.\n' +
'Aucun visage net et identifiable : cadrer sur les mains, de dos, ou à contre-jour.\n' +
'Aucun logo, aucune marque, aucun nom de produit lisible.\n' +
'Aucun texte incrusté dans l’image.\n' +
'SUJET : ' },
    { k: 'video',
      label: 'Image d’ouverture de vidéo',
      quand: 'Quand l’idée de visuel est une vidéo. On ne génère pas la vidéo : on génère sa première image, celle qui s’affiche dans le fil avant le clic.',
      quandPlus: 'La vidéo elle-même se tourne au téléphone. Cette image sert de repère de cadrage.',
      prompt:
'Photogramme d’ouverture d’une vidéo courte, format carré 1:1 en 1200×1200 px.\n' +
'Photographie documentaire, lumière naturelle, ambiance réelle et sobre.\n' +
'Cadrage large qui pose la scène en une seconde, sujet clairement identifiable au centre.\n' +
'Profondeur de champ courte, arrière-plan flou.\n' +
'Aucun visage net et identifiable, aucun logo, aucune marque lisible.\n' +
'Aucun texte, aucun sous-titre, aucune interface incrustée dans l’image.\n' +
'SCÈNE : ' },
    { k: 'typo',
      label: 'Affiche typographique',
      quand: 'Quand la phrase EST le visuel. Une idée forte, très peu de mots.',
      quandPlus: 'Le texte est ajouté après, dans Canva : les générateurs d’images écrivent mal le français accentué.',
      prompt:
'Affiche typographique minimaliste, format carré 1:1 en 1200×1200 px.\n' +
'Fond crème uni #FEFDF9. Aucune illustration, aucune photo.\n' +
'Deux formes organiques arrondies en indigo profond #111143 qui débordent des angles haut-gauche et bas-droite.\n' +
'Une seule couleur d’accent : orange ocre #D97A1C.\n' +
'Composition très aérée, large marge, centre de l’image laissé VIDE pour que la phrase soit posée ensuite.\n' +
'Aucun texte, aucune lettre, aucun caractère dans l’image générée.\n' +
'AMBIANCE : ' }
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

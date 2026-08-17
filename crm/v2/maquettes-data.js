/* Les cinquante directions du nouveau site Intégral Pharma.
   Chaque entrée porte son chemin EXPLICITE (`page`, `apercu`), relatif à crm/v2/ :
   les maquettes ne vivent pas toutes dans le même dossier.

   Quatre séries :
     01→20  la méthode d'une charte réelle (jamais son identité)
     21→30  un phénomène physique par page, aucune imitation
     31→40  même principe, poussé sur la 3D et le mouvement
     41→50  les plus folles

   ⚠️ Le titre d'ouverture des cinquante est « Rendre la marge à l'officine
   française. » depuis le 17/08/2026 — Will n'avait jamais validé l'ancien.
*/
window.MAQUETTES_SITE = [
  { id:'m-01', n:1,  nom:'Cimaise',        source:'Charte Apple',    serie:1, geste:'Une enfilade de tuiles pleine largeur ; la photographie commande, l’habillage s’efface.' },
  { id:'m-02', n:2,  nom:'Continuum',      source:'Charte Stripe',   serie:1, geste:'Un dégradé atmosphérique qui traverse la page et revient trois fois, découpé par des arêtes obliques.' },
  { id:'m-03', n:3,  nom:'Veilleuse',      source:'Charte Linear',   serie:1, geste:'Quasi noire, traversée de cinq filets verticaux. Le titre est coupé par la bande vidéo.' },
  { id:'m-04', n:4,  nom:'Cadence',        source:'Charte Nike',     serie:1, geste:'Quatre plans plein cadre, le texte posé dessus. Des capitales jusqu’à 168 px, en graisse moyenne.' },
  { id:'m-05', n:5,  nom:'Plein Sud',      source:'Charte Mistral',  serie:1, geste:'La seule où l’orange mène et le bleu suit. Une bande solaire ferme la page.' },
  { id:'m-06', n:6,  nom:'Découpe',        source:'Charte Figma',    serie:1, geste:'Le pari du clair spectaculaire : des couleurs franches, une source de lumière sur chaque surface.' },
  { id:'m-07', n:7,  nom:'Filet',          source:'Charte Vercel',   serie:1, geste:'Noir et blanc radical. Le bleu n’apparaît que trois ou quatre fois — et chaque apparition compte.' },
  { id:'m-08', n:8,  nom:'Maisons',        source:'Charte Airbnb',   serie:1, geste:'Les neuf implantations traitées comme neuf lieux à découvrir. Beaucoup d’air.' },
  { id:'m-09', n:9,  nom:'Survol',         source:'Charte SpaceX',   serie:1, geste:'Image plein écran bord à bord, très peu de texte. La grandeur par le cadrage.' },
  { id:'m-10', n:10, nom:'Revue',          source:'Charte Wired',    serie:1, geste:'Le seul registre imprimé : grille de magazine, chapeau, intertitres, légendes. Un dossier.' },
  { id:'m-11', n:11, nom:'Cadran',         source:'Charte BMW',      serie:1, geste:'L’ingénierie assumée : une ligne graduée court sur toute la page, la précision comme argument.' },
  { id:'m-12', n:12, nom:'Console',        source:'Charte Supabase', serie:1, geste:'Un rail collé à gauche qui ne bouge jamais, avec un cadran vivant qui indique où on en est.' },
  { id:'m-13', n:13, nom:'La Marge',       source:'Charte Notion',   serie:1, geste:'Bâtie comme un livre : une marge typographique court du début à la fin et porte le folio.' },
  { id:'m-14', n:14, nom:'Challenger',     source:'Charte Revolut',  serie:1, geste:'Les neuf implantations en jeu de cartes qui s’empile. L’alternative en manifeste plein cadre.' },
  { id:'m-15', n:15, nom:'Le Plan',        source:'Charte IBM',      serie:1, geste:'La grille rendue visible : des filets de colonne courent sur toute la page, photos comprises.' },
  { id:'m-16', n:16, nom:'Le Comptoir',    source:'Charte Shopify',  serie:1, geste:'La charte est dominée par le noir : elle a été inversée. Le crème gouverne, le noir ponctue.' },
  { id:'m-17', n:17, nom:'Tournée',        source:'Charte Uber',     serie:1, geste:'Toute la photographie en noir et blanc ; le bleu ne sert qu’à ce qui bouge ou se clique.' },
  { id:'m-18', n:18, nom:'Le Relevé',      source:'Charte Wise',     serie:1, geste:'Tout est une ligne : libellé à gauche, valeur à droite. Rien n’est replié, aucun accordéon.' },
  { id:'m-19', n:19, nom:'Instrument',     source:'Charte Raycast',  serie:1, geste:'Le site traité comme un outil qu’on ouvre tous les jours. Vrais raccourcis clavier.' },
  { id:'m-20', n:20, nom:'Braise',         source:'Charte Cursor',   serie:1, geste:'Un noir chaud percé d’orange ; la vue aérienne se resserre au fil des neuf implantations.' },

  { id:'m-21', n:21, nom:'L’Encre',        source:'Le fluide',       serie:2, geste:'Une nappe de liquide calculée en direct, qu’on pousse au curseur. Elle se calme là où on lit.' },
  { id:'m-22', n:22, nom:'Caractère',      source:'Typo cinétique',  serie:2, geste:'Le texte n’est pas sur le décor : il EST le décor. Il se casse lettre par lettre et se recompose.' },
  { id:'m-23', n:23, nom:'La Traversée',   source:'La matière 3D',   serie:2, geste:'Une vraie scène 3D qu’on traverse ; les chapitres sont des stations sur le trajet.' },
  { id:'m-24', n:24, nom:'Nuée',           source:'L’essaim',        serie:2, geste:'30 000 points d’encre qui se rassemblent pour dessiner, puis retombent en poussière.' },
  { id:'m-25', n:25, nom:'La Déchirure',   source:'La transition',   serie:2, geste:'On ne défile pas, on traverse : chaque chapitre chasse le précédent par une déchirure.' },
  { id:'m-26', n:26, nom:'Manutention',    source:'La physique',     serie:2, geste:'Les éléments ont un poids : ils tombent, s’empilent. La seule où l’on peut lancer la page.' },
  { id:'m-27', n:27, nom:'Plein jour',     source:'La lumière',      serie:2, geste:'Une seule source lumineuse se déplace comme le soleil : on descend comme on traverse une journée.' },
  { id:'m-28', n:28, nom:'Le Métrage',     source:'Le cinéma',       serie:2, geste:'La page est un film et le défilement est la molette de montage. ⚠️ ouverture longue (~9 s).' },
  { id:'m-29', n:29, nom:'Réfraction',     source:'Le verre',        serie:2, geste:'Du verre épais dévie ce qui passe dessous. La transparence devient la matière, pas un mot.' },
  { id:'m-30', n:30, nom:'Coup Sec',       source:'Le choc',         serie:2, geste:'Aplats violents, grille cassée, mouvement sec. Celle qui ne cherche pas à plaire.' },

  { id:'m-31', n:31, nom:'Portiques',      source:'Le tunnel',       serie:3, geste:'Une traversée continue ; les chapitres sont des portiques. Le défilement devient une vitesse.' },
  { id:'m-32', n:32, nom:'La Métamorphose',source:'La forme unique', serie:3, geste:'Une seule forme du premier au dernier écran, qui ne disparaît jamais. Un film d’une seule prise.' },
  { id:'m-33', n:33, nom:'Miroir d’eau',   source:'La réflexion',    serie:3, geste:'Un sol parfaitement réfléchissant ; le reflet s’atténue avec la distance et se trouble.' },
  { id:'m-34', n:34, nom:'L’Étoffe',       source:'Le tissu',        serie:3, geste:'Une étoffe qui porte la page ; elle se tend presque à plat là où il y a du texte.' },
  { id:'m-35', n:35, nom:'L’Assemblage',   source:'La vue éclatée',  serie:3, geste:'200 cartons cotés qui s’emboîtent couche par couche. Une couche par implantation.' },
  { id:'m-36', n:36, nom:'Grande ouverture',source:'La profondeur',  serie:3, geste:'La page a une épaisseur : ce qui n’est pas au plan de mise au point est flou.' },
  { id:'m-37', n:37, nom:'Le Trait',       source:'La ligne',        serie:3, geste:'Un seul trait dessine toute la page, du logo au pied. Le défilement en est le crayon.' },
  { id:'m-38', n:38, nom:'Champ de force', source:'Le magnétisme',   serie:3, geste:'La page baigne dans une limaille de fer ; le titre ne bouge pas, il prend du poids.' },
  { id:'m-39', n:39, nom:'Delta',          source:'La croissance',   serie:3, geste:'Une structure part d’un point et se ramifie jusqu’à devenir un réseau. Neuf extrémités.' },
  { id:'m-40', n:40, nom:'Le Pli',         source:'Le pliage',       serie:3, geste:'La page est une feuille qui se plie en volume ; les ombres des plis sont calculées.' },

  { id:'m-41', n:41, nom:'La Rosace',      source:'Le kaléidoscope', serie:4, geste:'Le nombre de miroirs vaut le nombre de choses dont on parle. La symétrie se déplie pour lire.' },
  { id:'m-42', n:42, nom:'L’Éclaircie',    source:'La fumée',        serie:4, geste:'De la matière en volume qui passe devant le texte et derrière lui. Les titres émergent.' },
  { id:'m-43', n:43, nom:'Le Tri de Nuit', source:'La dissolution',  serie:4, geste:'Les photos se décomposent en pixels triés par luminosité, puis se recomposent nettes.' },
  { id:'m-44', n:44, nom:'Le Cadran',      source:'Le temps',        serie:4, geste:'Ce n’est pas l’aiguille qui tourne, c’est le cadran. En bas de page, il a fait un tour.' },
  { id:'m-45', n:45, nom:'Point de Vue',   source:'L’anamorphose',   serie:4, geste:'Des formes illisibles qui se redressent net à un seul endroit précis du défilement.' },
  { id:'m-46', n:46, nom:'Convoyeur',      source:'Le tapis',        serie:4, geste:'Une ligne de préparation traverse la page et tourne en permanence, se divise en neuf voies.' },
  { id:'m-47', n:47, nom:'Rémanence',      source:'La pose longue',  serie:4, geste:'Chaque mouvement laisse une traînée. Quand on s’arrête, tout se résorbe en une image nette.' },
  { id:'m-48', n:48, nom:'L’Onde',         source:'Le sonar',        serie:4, geste:'Neuf points émettent à tour de rôle une onde qui révèle. Le dixième reçoit et n’émet jamais.' },
  { id:'m-49', n:49, nom:'Le Négatif',     source:'L’inversion',     serie:4, geste:'Deux mondes sur la même page ; une lentille inverse tout et révèle ce qui n’existe qu’inversé.' },
  { id:'m-50', n:50, nom:'Le Mouvement',   source:'L’horlogerie',    serie:4, geste:'Une horlogerie à nu entraîne la page. Neuf maisons qui s’engrènent.' }
].map(function (m) {
  m.page   = '../../site-integral/propositions/v2026/' + m.id + '.html';
  m.apercu = '../../site-integral/propositions/v2026/vignettes/' + m.id + '.jpg';
  return m;
});

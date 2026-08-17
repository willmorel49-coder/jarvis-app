/* Les vingt directions retenues pour le nouveau site Intégral Pharma.
   Chaque entrée porte son chemin EXPLICITE (`page`, `apercu`), relatif à crm/v2/ :
   les maquettes ne vivent pas toutes dans le même dossier.

   Will a écarté 31 des 50 le 17/08/2026 ; il en reste 19, renumérotées de 1 à 19
   à sa demande. ⚠️ Le champ `id` (donc le nom de fichier) garde le numéro
   d'origine : le renommer casserait tout lien déjà partagé pour un gain nul.
   C'est `n` qui s'affiche, jamais l'id.
   Les écartées sont sauvegardées hors dépôt :
   ~/sauvegardes-jarvis/maquettes-ecartees-20260817/ (et dans l'historique git).

   ⚠️ Le titre d'ouverture des cinquante est « Rendre la marge à l'officine
   française. » depuis le 17/08/2026 — Will n'avait jamais validé l'ancien.
*/
window.MAQUETTES_SITE = [
  { id:'m-01', n:1 ,  nom:'Cimaise',        source:'Charte Apple',    serie:1, geste:'Une enfilade de tuiles pleine largeur ; la photographie commande, l’habillage s’efface.' },
  { id:'m-02', n:2 ,  nom:'Continuum',      source:'Charte Stripe',   serie:1, geste:'Un dégradé atmosphérique qui traverse la page et revient trois fois, découpé par des arêtes obliques.' },
  { id:'m-03', n:3 ,  nom:'Veilleuse',      source:'Charte Linear',   serie:1, geste:'Quasi noire, traversée de cinq filets verticaux. Le titre est coupé par la bande vidéo.' },
  { id:'m-05', n:4 ,  nom:'Plein Sud',      source:'Charte Mistral',  serie:1, geste:'La seule où l’orange mène et le bleu suit. Une bande solaire ferme la page.' },
  { id:'m-06', n:5 ,  nom:'Découpe',        source:'Charte Figma',    serie:1, geste:'Le pari du clair spectaculaire : des couleurs franches, une source de lumière sur chaque surface.' },
  { id:'m-08', n:6 ,  nom:'Maisons',        source:'Charte Airbnb',   serie:1, geste:'Les neuf implantations traitées comme neuf lieux à découvrir. Beaucoup d’air.' },
  { id:'m-09', n:7 ,  nom:'Survol',         source:'Charte SpaceX',   serie:1, geste:'Image plein écran bord à bord, très peu de texte. La grandeur par le cadrage.' },
  { id:'m-11', n:8 , nom:'Cadran',         source:'Charte BMW',      serie:1, geste:'L’ingénierie assumée : une ligne graduée court sur toute la page, la précision comme argument.' },
  { id:'m-14', n:9 , nom:'Challenger',     source:'Charte Revolut',  serie:1, geste:'Les neuf implantations en jeu de cartes qui s’empile. L’alternative en manifeste plein cadre.' },
  { id:'m-18', n:10, nom:'Le Relevé',      source:'Charte Wise',     serie:1, geste:'Tout est une ligne : libellé à gauche, valeur à droite. Rien n’est replié, aucun accordéon.' },

  { id:'m-21', n:11, nom:'L’Encre',        source:'Le fluide',       serie:2, geste:'Une nappe de liquide calculée en direct, qu’on pousse au curseur. Elle se calme là où on lit.' },
  { id:'m-24', n:12, nom:'Nuée',           source:'L’essaim',        serie:2, geste:'30 000 points d’encre qui se rassemblent pour dessiner, puis retombent en poussière.' },
  { id:'m-27', n:13, nom:'Plein jour',     source:'La lumière',      serie:2, geste:'Une seule source lumineuse se déplace comme le soleil : on descend comme on traverse une journée.' },

  { id:'m-31', n:14, nom:'Portiques',      source:'Le tunnel',       serie:3, geste:'Une traversée continue ; les chapitres sont des portiques. Le défilement devient une vitesse.' },
  { id:'m-32', n:15, nom:'La Métamorphose',source:'La forme unique', serie:3, geste:'Une seule forme du premier au dernier écran, qui ne disparaît jamais. Un film d’une seule prise.' },
  { id:'m-35', n:16, nom:'L’Assemblage',   source:'La vue éclatée',  serie:3, geste:'200 cartons cotés qui s’emboîtent couche par couche. Une couche par implantation.' },
  { id:'m-39', n:17, nom:'Delta',          source:'La croissance',   serie:3, geste:'Une structure part d’un point et se ramifie jusqu’à devenir un réseau. Neuf extrémités.' },

  { id:'m-44', n:18, nom:'Le Cadran',      source:'Le temps',        serie:4, geste:'Ce n’est pas l’aiguille qui tourne, c’est le cadran. En bas de page, il a fait un tour.' },
  { id:'m-46', n:19, nom:'Convoyeur',      source:'Le tapis',        serie:4, geste:'Une ligne de préparation traverse la page et tourne en permanence, se divise en neuf voies.' },
  { id:'m-51', n:20, nom:'Le Signe',        source:'Le logo en 3D',   serie:4, geste:'La gélule du logo en volume, matière pharmaceutique réelle, et le monogramme iP qui se forme en 3D. La plus poussée de la série.' }
].map(function (m) {
  m.page   = '../../site-integral/propositions/v2026/' + m.id + '.html';
  m.apercu = '../../site-integral/propositions/v2026/vignettes/' + m.id + '.jpg';
  return m;
});

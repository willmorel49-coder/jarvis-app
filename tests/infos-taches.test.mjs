/* Règles qui écrivent les textes simples de l'écran Infos (maquette C « À faire avec les infos », 21/11/2026).
   Données : de VRAIES lignes du brief et du Bodacc du 20/11/2026 (copiées ici), lues le 21/11 ; les réponses attendues
   sont celles que la maquette écrite à la main visait (maquettes/donnees.js), sauf ce que les sources ne disent pas
   (« jusqu'en 2027 » n'est dans aucun texte du jour : la règle ne l'invente pas).
   Lancer : node --test tests/infos-taches.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const T = createRequire(import.meta.url)('../crm/v2/v2-infos-taches.js');
const AUJ = '2026-11-21';

const ANNONCES = [
  { id: 'A202602201929', d: '2026-11-17', f: 'creation', nom: 'SPFPLAS POISBLAUD', ville: 'Les Sorinières', cp: '44840', dep: '44', detail: 'Holding de pharmaciens immatriculée', url: 'https://www.bodacc.fr/a' },
  { id: 'A202602203081', d: '2026-11-17', f: 'cession', nom: 'PHARMACIE DES COMTES DU MAINE', ville: 'Le Mans', cp: '72000', dep: '72', detail: 'Fonds vendu 690 k€', url: 'https://www.bodacc.fr/b' },
  { id: 'A202602185292', d: '2026-11-13', f: 'procedure', nom: 'PHARMACIE DU CYGNE DE CROIX', ville: 'Caen', cp: '14000', dep: '14', detail: 'Liquidation judiciaire', url: 'https://www.bodacc.fr/c' }
];
const BRIEF = {
  une: { t: '5 baisses de prix publiées au Journal officiel, applicables à partir du 20 novembre 2026 ; 82 autres au 2 janvier 2027', r: 'Avis de prix du Comité économique des produits de santé. MEDIKINET 10MG LM GELU BT28, MEDIKINET 20MG LM GELU BT28', s: 'CEPS · Journal officiel', d: '2026-11-20', u: 'https://www.legifrance.gouv.fr/jorf/jo' },
  cinq: [
    { t: 'Plafonner la rémunération des missions OSyS : une honte !', s: 'UPGF', d: '2026-11-20', theme: 'marge', srcs: ['UPGF'] },
    { t: 'Tensions en furosémide 20 et 40 mg : l’ANSM met en place de nouvelles mesures pour permettre la continuité de traitement des patients', s: 'ANSM · Actualités', d: '2026-11-18', theme: 'rupture', srcs: ['ANSM · Actualités', 'USPO', 'Pharma365'], faits: ['3 sources en parlent'], u: 'https://ansm.sante.fr/actualites/tensions-en-furosemide' },
    { t: '6 nouvelles alertes de disponibilité signalées par l\'ANSM', s: 'ANSM · Disponibilités', d: '2026-11-20', theme: 'rupture', srcs: ['ANSM · Disponibilités'] },
    { t: 'Rupture de furosémide : mise en place et remboursement des préparations magistrales', r: 'L’ANSM officialise l’activation du dispositif de remplacement des comprimés à base de furosémide par des préparations magistrales de furosémide 20 et 40 mg.', s: 'FSPF', d: '2026-11-19', theme: 'remboursement', srcs: ['FSPF'] }
  ],
  epingles: [
    { t: '5 baisses de prix publiées au Journal officiel, applicables à partir du 20 novembre 2026 ; 82 autres au 2 janvier 2027', s: 'CEPS · Journal officiel', d: '2026-11-20', motif: 'echeance', effet: '2026-11-20', r: 'Avis de prix du Comité économique des produits de santé. MEDIKINET 10MG LM GELU BT28' },
    { t: 'Arrêté du 3 août 2026 modifiant l\'arrêté du 4 août 1987 relatif aux prix et aux marges des médicaments remboursables', u: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054658822', s: 'Journal officiel', d: '2026-08-11', motif: 'echeance', effet: '2027-01-20', r: 'Nouveau barème de la marge grossiste : minimum 0,22 € par boîte, plafond 32,50 €.' },
    { t: 'Décret n° 2026-1059 du 17 novembre 2026 relatif aux seuils de prix', s: 'Journal officiel', d: '2026-11-19', motif: 'echeance', effet: '', r: 'clause de sauvegarde' }
  ],
  ruptures_neuves: [
    { spec: 'Kanokad 25 UI/mL de facteur IX, poudre et solvant pour solution injectable – Flacon de 250 UI [MAJ]', st: 'Arrêt de commercialisation', subst: 0, since: '2026-11-20' },
    { spec: 'Rapibloc 20 mg/2 ml, solution à diluer injectable – [landiolol (chlorhydrate de)]', st: 'Tension d\'approvisionnement', subst: 0, since: '2026-11-19' },
    { spec: 'Jext 300 microgrammes, solution injectable en stylo prérempli – [adrénaline (tartrate d\')] [MAJ]', st: 'Remise à disposition', subst: 1, since: '2026-11-19' }
  ],
  rappels_lots: [
    { d: '2026-11-18', t: 'Mapakna LP 20 mg, comprimé à libération prolongée – Laboratoires Majorelle', niv: 'établissements de santé', lots: [{ n: '008825' }], url: 'https://ansm.sante.fr/x' }
  ],
  fil: []
};
const copie = (o) => JSON.parse(JSON.stringify(o));

test('secteur : les trois annonces du 20/11, dans l\'ordre de la maquette, avec ses textes', () => {
  const L = T.secteur(ANNONCES, { auj: AUJ, tag: () => ({ t: 'prospect' }), geste: () => 'PHRASE DU CODE' });
  assert.deepEqual(L.map((t) => t.action), [
    'Prendre rendez-vous avec la Pharmacie des Comtes du Maine',
    'Demander aux officines des Sorinières qui prépare un rachat',
    'Appeler les officines voisines de la Pharmacie du Cygne de Croix'
  ]);
  assert.deepEqual(L.map((t) => t.titre), [
    'Une officine du Mans change de propriétaire',
    'Des pharmaciens créent une société de rachat aux Sorinières',
    'Une officine de Caen est en liquidation'
  ]);
  assert.deepEqual(L.map((t) => t.etiquette), ['Officine vendue', 'Rachat en préparation', 'Officine en liquidation']);
  assert.deepEqual(L.map((t) => t.quand), ['il y a 4 jours', 'il y a 4 jours', 'il y a 1 semaine']);
  assert.deepEqual(L.map((t) => t.lieu), ['Pharmacie des Comtes du Maine · Le Mans (72)', 'SPFPLAS Poisblaud · Les Sorinières (44)', 'Pharmacie du Cygne de Croix · Caen (14)']);
  assert.equal(L[0].pourVous, 'Le nouveau pharmacien choisit ses fournisseurs dans ses premières semaines : c’est le moment de le rencontrer.');
  assert.ok(L.every((t) => t.aDire === 'PHRASE DU CODE' && t.source === 'Bodacc · annonces légales' && t.vue === 'secteur' && t.groupe === 'secteur'));
});

test('secteur : un client passe devant, et ses textes parlent de VOTRE client', () => {
  const L = T.secteur(ANNONCES, { auj: AUJ, tag: (e) => ({ t: /CYGNE/.test(e.nom) ? 'client' : 'hors', ficheId: /CYGNE/.test(e.nom) ? 'cli-14' : '' }) });
  assert.equal(L[0].titre, 'Votre client de Caen est en liquidation');
  assert.equal(L[0].action, 'Faire le point sur l’encours avec la direction');
  assert.match(L[0].lieu, /^Votre client · Pharmacie du Cygne de Croix/);
  assert.equal(L[0].pid, 'cli-14');
  const cession = T.bodacc(ANNONCES[1], { auj: AUJ, tag: 'client' });
  assert.equal(cession.titre, 'Votre client du Mans change de propriétaire');
  assert.equal(cession.action, 'Rencontrer le repreneur de la Pharmacie des Comtes du Maine');
});

test('secteur : un nom une seule fois, trois au plus', () => {
  const L = T.secteur(ANNONCES.concat([{ ...ANNONCES[1], id: 'X2', f: 'dirigeant' }, { ...ANNONCES[2], id: 'X3', nom: 'PHARMACIE DE LA GARE', d: '2026-11-10' }]), { auj: AUJ });
  assert.equal(L.length, 3);
  assert.equal(L.filter((t) => /Comtes du Maine/.test(t.lieu)).length, 1);
});

test('chaque motif du Bodacc a son texte', () => {
  const e = (f, detail = '', nom = 'PHARMACIE DU PORT', ville = 'Angers') => T.bodacc({ id: f, d: '2026-11-20', f, nom, ville, dep: '49', detail }, { auj: AUJ });
  assert.equal(e('fermeture').titre, 'Une officine d’Angers ferme');
  assert.equal(e('dirigeant').action, 'Se présenter au nouveau dirigeant de la Pharmacie du Port');
  assert.equal(e('procedure', 'Redressement judiciaire').titre, 'Une officine d’Angers passe devant le tribunal');
  assert.equal(e('creation', 'Nouvelle société d’officine', 'SELARL PHARMACIE DU PORT', 'La Flèche').titre, 'Une nouvelle société d’officine est créée à La Flèche');
  assert.equal(e('creation', 'Nouvelle société d’officine', 'SELARL PHARMACIE DU PORT').action, 'Se présenter à la Pharmacie du Port');
  assert.equal(e('cession').quand, 'hier');
  assert.equal(T._.deVille('LES PONTS-DE-CE'), 'des Ponts-de-Ce');
  assert.equal(T._.aVille('Le Mans'), 'au Mans');
});

test('En France : les trois infos du 20/11, dans l\'ordre de la maquette', () => {
  const L = T.france(copie(BRIEF), { auj: AUJ });
  assert.deepEqual(L.map((t) => t.etiquette), ['Médicament qui manque', 'Prix qui baissent', 'Nouvelle règle']);
  const [m, p, r] = L;
  assert.equal(m.titre, 'Le furosémide 20 et 40 mg manque');
  assert.equal(m.action, 'Prévenir vos officines : préparations de furosémide autorisées et remboursées');
  assert.equal(m.aDire, 'Le furosémide manque : les préparations en officine sont autorisées et remboursées.');
  assert.equal(m.quand, '18 novembre');
  assert.equal(m.source, 'Agence du médicament · USPO · Pharma365');
  assert.doesNotMatch(m.titre + m.pourVous + m.aDire, /2027/, 'aucune source ne dit « jusqu’en 2027 » : la règle ne l’invente pas');
  assert.equal(p.titre, '82 médicaments baissent de prix le 2 janvier');
  assert.equal(p.pourVous, 'Les boîtes en stock vaudront moins après le 2 janvier. Cinq baissent déjà depuis le 20 novembre, dont le Medikinet.');
  assert.equal(p.action, 'Conseiller de ne pas trop stocker ces produits en décembre');
  assert.equal(p.aDire, '82 baisses de prix le 2 janvier : évitez de trop stocker ces produits en décembre.');
  assert.equal(p.quand, 'publié le 20 novembre');
  assert.equal(r.titre, 'La marge des grossistes change le 20 janvier');
  assert.equal(r.quand, 'dans 60 jours');
  assert.equal(r.pourVous, 'Nouveau barème de la marge grossiste : au moins 0,22 € par boîte, au plus 32,50 €. Vos pharmaciens vont vous en parler.');
  assert.equal(r.action, 'Relire le nouveau barème avant les rendez-vous de janvier');
  assert.equal(r.aDire, 'Le nouveau barème de la marge grossiste s’applique le 20 janvier 2027.');
  assert.ok(L.every((t) => t.groupe === 'france' && t.lieu === 'Toutes les officines' && t.id));
});

test('rappel de lot : limité aux hôpitaux, il ne monte pas ; pour les officines, il passe en premier', () => {
  assert.ok(!T.france(copie(BRIEF), { auj: AUJ }).some((t) => t.etiquette === 'Lot rappelé'));
  const B = copie(BRIEF); B.rappels_lots[0].niv = 'pharmacies d’officine, grossistes-répartiteurs';
  const L = T.france(B, { auj: AUJ });
  assert.equal(L.length, 3);
  assert.equal(L[0].titre, 'Un lot de Mapakna LP 20 mg est rappelé');
  assert.equal(L[0].action, 'Prévenir vos officines de vérifier le lot 008825');
  assert.equal(L[0].aDire, 'Le lot 008825 de Mapakna LP 20 mg est rappelé : à retirer du stock.');
});

/* Choix cliqué de Will, 25/11/2026 : « Chez nous ou officines ». Un rappel ne monte que si le produit est dans notre catalogue ou notre
   stock (cat / stk, posés par generate_rappels_lots.py), ou si l'Agence nomme les officines. VRAIES lignes de rappels-lots.json du 24/11. */
test('rappel de lot : seulement si le produit passe chez nous ou si l\'Agence nomme les officines', () => {
  const garde = T._.pourOfficines;
  const z011 = { d: '2026-11-24', t: 'Albumine humaine iodée [125I], Cis bio international, solution injectable. [Réf : SERALB-125] - Laboratoire Cis Bio Inte', niv: 'Ce rappel a été effectué en direct auprès des clients concernés, aucun numéro d\'alerte n\'a donc été attribué.', lots: [{ n: 'Z011' }], cat: [], stk: [], url: 'https://ansm.sante.fr/x' };
  assert.equal(garde(z011), false, 'Z011 : médecine nucléaire, ni catalogue ni stock, l\'Agence a prévenu les clients en direct');
  assert.equal(garde({ niv: 'Aucun numéro d\'alerte n\'a été attribué.', cat: [], stk: [] }), false, 'Carmustine : perfusion d\'hôpital');
  assert.equal(garde({ niv: 'Etablissements de santé et circuit de distribution pharmaceutique Pour toute information complémentaire, vous pouvez con', cat: [], stk: [] }), false, 'Kétamine : « Etablissements » sans accent');
  assert.equal(garde({ niv: 'établissements de santé et circuit de distribution pharmaceutique, ainsi qu\'en direct auprès des professionnels de santé', cat: [], stk: [{ c: '3400956238811', q: 30 }] }), true, 'Omnipaque : 30 boîtes dans notre stock');
  assert.equal(garde({ niv: 'officines, établissements de santé, circuit de distribution pharmaceutique et patients', cat: [], stk: [] }), true, 'Rivaroxaban Viatris : l\'Agence nomme les officines');
  const B = copie(BRIEF); B.rappels_lots = [z011];
  assert.ok(!T.france(B, { auj: '2026-11-25' }).some((t) => t.etiquette === 'Lot rappelé'), 'la tâche du 25/11 « vérifier le lot Z011 » ne monte plus');
});

test('sans article repris par plusieurs sources : une alerte ANSM d\'un produit de ville, jamais d\'hôpital', () => {
  const B = copie(BRIEF); B.cinq = B.cinq.filter((a) => !/furos/i.test(a.t));
  assert.ok(!T.france(B, { auj: AUJ }).some((t) => t.etiquette === 'Médicament qui manque'), 'Kanokad (poudre et solvant), Rapibloc (à diluer) : écartés ; Jext revient : pas une rupture');
  B.ruptures_neuves.push({ spec: 'Doliprane 1000 mg, comprimé – [paracétamol]', st: 'Rupture de stock', subst: 1, since: '2026-11-20' });
  const m = T.france(B, { auj: AUJ }).filter((t) => t.etiquette === 'Médicament qui manque')[0];
  assert.equal(m.titre, 'Le Doliprane 1000 mg est en rupture');
  assert.equal(m.action, 'Rappeler à vos officines qu’une solution de remplacement existe');
  assert.equal(m.quand, 'hier');
});

test('« Rupture de contrat » n\'est pas un médicament qui manque', () => {
  const B = copie(BRIEF);
  B.cinq = [{ t: 'Rupture de contrat chez un groupement', s: 'Presse', d: '2026-11-20', theme: 'officine', srcs: ['A', 'B'] }];
  assert.ok(!T.france(B, { auj: AUJ }).some((t) => t.etiquette === 'Médicament qui manque'));
});

test('baisses de prix : déjà en vigueur, ou une seule date', () => {
  const p1 = T.prix({ t: '5 baisses de prix publiées au Journal officiel, applicables à partir du 20 novembre 2026', d: '2026-11-20' }, { auj: AUJ });
  assert.equal(p1.titre, '5 médicaments baissent de prix depuis le 20 novembre');
  assert.equal(p1.action, 'Prévenir vos officines que leurs boîtes en stock valent moins');
  const p2 = T.prix({ t: '1 baisse de prix publiée au Journal officiel, applicable à partir du 28 novembre 2026', d: '2026-11-20' }, { auj: AUJ });
  assert.equal(p2.titre, '1 médicament baisse de prix le 28 novembre');
  assert.equal(p2.action, 'Conseiller de ne pas trop stocker ces produits d’ici au 28 novembre');
  assert.equal(T.prix({ t: 'Un autre sujet' }, { auj: AUJ }), null);
});

test('chaque tâche a tous ses champs, et des identifiants stables', () => {
  const L = T.secteur(ANNONCES, { auj: AUJ }).concat(T.france(copie(BRIEF), { auj: AUJ }));
  const champs = ['id', 'groupe', 'etiquette', 'ton', 'titre', 'lieu', 'quand', 'pourVous', 'action', 'aDire', 'source', 'vue'];
  L.forEach((t) => champs.forEach((c) => assert.ok(t[c], c + ' rempli pour ' + t.id)));
  assert.equal(new Set(L.map((t) => t.id)).size, L.length, 'identifiants uniques');
  assert.deepEqual(T.france(copie(BRIEF), { auj: AUJ }).map((t) => t.id), T.france(copie(BRIEF), { auj: AUJ }).map((t) => t.id), 'même édition = mêmes identifiants (la case « Fait » les retrouve)');
  L.forEach((t) => assert.match(t.id, /^[a-z]-[a-z0-9-]+$/, 'identifiant sans caractère spécial : ' + t.id));
});

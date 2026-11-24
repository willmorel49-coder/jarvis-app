/* Brief de l'officine (crm/v2/v2-brief-officine.js).
   1) Les règles, une par une, sur des cas dont on connaît la réponse.
   2) Le CHEMIN RÉEL : les vrais fichiers des robots, lus par hydrate(),
      jusqu'au HTML posé dans la fiche. Une fonction testée ne prouve rien
      sur ce qui l'alimente (leçon du journal de secours, 21/08/2026). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const B = new URL('../crm/v2/', import.meta.url);

function charger(extra = {}) {
  const sb = { console, Date, Math, JSON, Promise, String, Object, ...extra };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext('window.V2 = { esc: s => String(s==null?"":s).replace(/</g,"&lt;") };', sb);
  vm.runInContext(readFileSync(new URL('v2-brief-officine.js', B), 'utf8'), sb);
  return sb;
}
const { calculer } = charger().V2.briefOfficine;

const MOIS = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const ansm = (items) => ({ generated: '2026-09-17', items });
const rupture = (cips, extra = {}) => ({
  st: 'Rupture de stock', spec: 'Produit X 10 mg, comprimé – [molécule]', maj: '16/09/2026',
  retour: { raw: 'courant octobre 2026.' }, since: '2026-09-10', cips, ...extra,
});
const base = (e) => ({ aujourdhui: '2026-09-17', ventes: [], moisCouverts: MOIS, ansm: null, prixFuturs: null, rappels: null, generiques: null, ...e });

test('rupture sur un produit acheté : un point « Va manquer » avec retour et stock', () => {
  const r = calculer(base({
    ventes: [{ cip: '3400900000001', mois: '2026-08', qte: 12 }],
    ansm: ansm([rupture(['3400900000001'])]),
    stockSites: (c) => (c === '3400900000001' ? [{ site: 'CPR', q: 5 }, { site: 'HP', q: 3 }] : []),
  }));
  assert.equal(r.points.length, 1);
  const p = r.points[0];
  assert.equal(p.rubrique, 'Va manquer');
  assert.equal(p.titre, 'En rupture : Produit X 10 mg');
  assert.match(p.detail, /Retour annoncé : courant octobre 2026\./);
  assert.match(p.detail, /8 boîtes sur CPR, HP/);
  assert.equal(p.date, '2026-09-16');
});

test('rupture sur un produit jamais acheté : rien', () => {
  const r = calculer(base({
    ventes: [{ cip: '3400900000002', mois: '2026-08', qte: 5 }],
    ansm: ansm([rupture(['3400900000001'])]),
  }));
  assert.equal(r.points.length, 0);
  assert.equal(r.achatsConnus, true);
});

test('les retours se déduisent : acheté puis entièrement retourné = pas acheté', () => {
  const r = calculer(base({
    ventes: [{ cip: '3400900000001', mois: '2026-07', qte: 2 }, { cip: '3400900000001', mois: '2026-08', qte: -2 }],
    ansm: ansm([rupture(['3400900000001'])]),
  }));
  assert.equal(r.points.length, 0);
});

test('remise à disposition ancienne : ignorée ; récente : « Revient »', () => {
  const v = [{ cip: '3400900000001', mois: '2026-08', qte: 3 }];
  const vieux = calculer(base({ ventes: v, ansm: ansm([rupture(['3400900000001'], { st: 'Remise à disposition', since: '2026-06-01' })]) }));
  assert.equal(vieux.points.length, 0);
  const recent = calculer(base({ ventes: v, ansm: ansm([rupture(['3400900000001'], { st: 'Remise à disposition', since: '2026-09-15' })]) }));
  assert.equal(recent.points[0].rubrique, 'Revient');
});

test('prix : effet passé ignoré, baisse à venir retenue et urgente sous 7 jours', () => {
  const pf = { generated: '2026-09-17', changes: [
    { c: '3400900000001', d: 'PASSE', sens: 'baisse', date_effet: '2026-09-01', date_publi: '2026-08-20', ppttc: 5 },
    { c: '3400900000001', d: 'PROCHE', sens: 'baisse', date_effet: '2026-09-20', date_publi: '2026-09-16', ppttc: 5, ancien_ttc: 6.5 },
    { c: '3400900000001', d: 'STABLE', sens: 'stable', date_effet: '2026-10-01', date_publi: '2026-09-16', ppttc: 5 },
  ] };
  const r = calculer(base({ ventes: [{ cip: '3400900000001', mois: '2026-08', qte: 4 }], prixFuturs: pf }));
  assert.equal(r.points.length, 1);
  assert.match(r.points[0].titre, /Baisse de prix le 20\/09\/2026 : PROCHE/);
  assert.equal(r.points[0].urgence, 3);
  assert.match(r.points[0].detail, /6,5 € → 5 € TTC/);
});

test('rappel de lots : récent retenu en tête, ancien de plus de 90 jours ignoré', () => {
  const rap = { generated: '2026-09-17', items: [
    { d: '2026-05-01', t: 'Ancien', cips: ['3400900000001'], lots: [] },
    { d: '2026-09-10', t: 'Récent, sachet', cips: ['3400900000001'], lots: [{ n: 'L1', exp: '10/2028' }] },
  ] };
  const r = calculer(base({
    ventes: [{ cip: '3400900000001', mois: '2026-08', qte: 4 }],
    rappels: rap, ansm: ansm([rupture(['3400900000001'])]),
  }));
  assert.equal(r.points.length, 2);
  assert.equal(r.points[0].rubrique, 'À retirer');
  assert.equal(r.points[0].titre, 'Rappel de lots : Récent');
  assert.match(r.points[0].detail, /L1 \(exp\. 10\/2028\)/);
});

test('habitude interrompue : seulement si elle a commandé AUTRE CHOSE le dernier mois', () => {
  const hab = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'].map((m) => ({ cip: '3400900000001', mois: m, qte: 2 }));
  const nom = (c) => (c === '3400900000001' ? 'Doliprane' : 'Autre');
  const sansFin = calculer(base({ ventes: hab, nom }));
  assert.equal(sansFin.points.length, 0, 'aucune commande en août : on ne sait rien, on ne dit rien');
  const avecFin = calculer(base({ ventes: hab.concat([{ cip: '3400900000009', mois: '2026-08', qte: 1 }]), nom }));
  assert.equal(avecFin.points.length, 1);
  assert.equal(avecFin.points[0].titre, 'Pas commandé en août 2026 : Doliprane');
});

test('habitude interrompue : 3 lignes au plus, les plus gros volumes', () => {
  const v = [];
  for (let k = 1; k <= 5; k++) ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'].forEach((m) => v.push({ cip: '340090000000' + k, mois: m, qte: k }));
  v.push({ cip: '3400900000009', mois: '2026-08', qte: 1 });
  const r = calculer(base({ ventes: v, nom: (c) => 'P' + c.slice(-1) }));
  assert.deepEqual(Array.from(r.points, (p) => p.titre.slice(-2)), ['P5', 'P4', 'P3']);
});

test('rupture sur un produit plus commandé depuis 3 mois : écartée', () => {
  const r = calculer(base({
    ventes: [{ cip: '3400900000001', mois: '2026-05', qte: 40 }, { cip: '3400900000002', mois: '2026-06', qte: 1 }],
    ansm: ansm([rupture(['3400900000001']), rupture(['3400900000002'])]),
  }));
  assert.equal(r.points.length, 1);
  assert.equal(r.points[0].volume, 1);
});

test('grands nombres : séparateur des milliers', () => {
  const r = calculer(base({
    ventes: [{ cip: '3400900000001', mois: '2026-08', qte: 1 }],
    ansm: ansm([rupture(['3400900000001'])]),
    stockSites: () => [{ site: 'CPR', q: 51495 }],
  }));
  assert.match(r.points[0].detail, /51\u202f495 boîtes sur CPR/);
});

test('mois couverts : un fichier de commercial plus court ne fabrique pas d\'absence', () => {
  const hab = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'].map((m) => ({ cip: '3400900000001', mois: m, qte: 2 }));
  // moisCouverts s'arrête en juillet (calculé par la couche écran) : juillet devient le dernier mois
  const r = calculer(base({ ventes: hab, moisCouverts: MOIS.slice(0, 5), nom: () => 'Doliprane' }));
  assert.equal(r.points.length, 0);
});

test('princeps avec générique : 2 lignes au plus, les plus gros volumes, sous le seuil ignoré', () => {
  const v = [['3400900000001', 50], ['3400900000002', 30], ['3400900000003', 20], ['3400900000004', 5]]
    .map(([cip, qte]) => ({ cip, mois: '2026-08', qte }));
  const r = calculer(base({
    ventes: v, nom: (c) => 'P' + c.slice(-1),
    generiques: { generated: '2026-09-17', princepsWithGeneric: ['3400900000001', '3400900000002', '3400900000003', '3400900000004'] },
  }));
  assert.deepEqual(Array.from(r.points, (p) => p.titre.slice(-4)), [': P1', ': P2']);
});

test('ruptures : 3 au plus, les siennes par volume, les autres repliées', () => {
  const items = [], ventes = [];
  for (let i = 0; i < 10; i++) {
    const c = '34009000000' + String(10 + i);
    // les 3 plus gros volumes sont des TENSIONS : elles passent devant les ruptures plus petites
    items.push(rupture([c], { st: i >= 7 ? "Tension d'approvisionnement" : 'Rupture de stock' }));
    ventes.push({ cip: c, mois: '2026-08', qte: i + 1 });
  }
  const r = calculer(base({ ventes, ansm: ansm(items) }));
  assert.deepEqual(Array.from(r.points, (p) => p.volume), [10, 9, 8]);
  assert.equal(r.autres.length, 7);
  assert.ok(r.autres.every((p) => p.rubrique === 'Va manquer'));
});

test('ordre : rappel, ses achats, prix, ruptures, opportunité — ce qui lui est propre avant le national', () => {
  const hab = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'].map((m) => ({ cip: '3400900000001', mois: m, qte: 2 }));
  const ventes = hab.concat([
    { cip: '3400900000002', mois: '2026-08', qte: 500 },   // rupture, très gros volume
    { cip: '3400900000003', mois: '2026-08', qte: 4 },     // rappel de lots
    { cip: '3400900000004', mois: '2026-08', qte: 3 },     // prix qui change
    { cip: '3400900000005', mois: '2026-08', qte: 40 },    // princeps avec générique
  ]);
  const r = calculer(base({
    ventes, nom: (c) => 'P' + c.slice(-1),
    ansm: ansm([rupture(['3400900000002'])]),
    rappels: { generated: '2026-09-17', items: [{ d: '2026-09-10', t: 'Rappel', cips: ['3400900000003'], lots: [] }] },
    prixFuturs: { generated: '2026-09-17', changes: [{ c: '3400900000004', d: 'PRIX', sens: 'baisse', date_effet: '2026-10-20', date_publi: '2026-09-16', ppttc: 5 }] },
    generiques: { generated: '2026-09-17', princepsWithGeneric: ['3400900000005'] },
  }));
  assert.deepEqual(Array.from(r.points, (p) => p.rubrique), ['À retirer', 'Ses achats', 'Change bientôt', 'Va manquer', 'Opportunité']);
});

test('7 points au plus : ce qui dépasse part dans « autres », les ruptures repliées en premier', () => {
  const items = [], ventes = [], rap = [];
  for (let i = 0; i < 5; i++) {
    const c = '34009000000' + String(10 + i);
    items.push(rupture([c])); ventes.push({ cip: c, mois: '2026-08', qte: i + 1 });
  }
  for (let i = 0; i < 6; i++) {
    const c = '34009000000' + String(30 + i);
    rap.push({ d: '2026-09-10', t: 'R' + i, cips: [c], lots: [] }); ventes.push({ cip: c, mois: '2026-08', qte: i + 1 });
  }
  const r = calculer(base({ ventes, ansm: ansm(items), rappels: { generated: '2026-09-17', items: rap } }));
  assert.equal(r.points.length, 7);
  assert.deepEqual(Array.from(r.points, (p) => p.rubrique), ['À retirer', 'À retirer', 'À retirer', 'À retirer', 'À retirer', 'À retirer', 'Va manquer']);
  assert.deepEqual(Array.from(r.autres, (p) => p.volume), [2, 1, 4, 3]);   // 2 ruptures repliées, puis les 2 qui dépassaient
});

test('sources : non lue, en retard, à jour', () => {
  const r = calculer(base({ ansm: { generated: '2026-09-10', items: [] }, prixFuturs: { generated: '2026-09-17', changes: [] } }));
  const s = Object.fromEntries(Array.from(r.sources, (x) => [x.cle, x]));
  assert.equal(s.ansm.lue, true); assert.equal(s.ansm.aJour, false);
  assert.equal(s.prix.aJour, true);
  assert.equal(s.rappels.lue, false);
});

test('24/11/2026 (Will) : les échéances réglementaires ne sont plus dans le panneau de la fiche', () => {
  const ech = (date, prevenir_j, titre) => ({ date, prevenir_j, titre, detail: 'D.', action: 'A.', source_nom: 'S' });
  const r = calculer(base({
    ventes: [{ cip: '3400900000001', mois: '2026-08', qte: 1 }],
    calendrier: { generated: '2026-09-17', items: [ech('2026-10-07', 60, 'Proche')] },
  }));
  assert.equal(r.echeances, undefined, 'plus de liste d\'échéances');
  assert.ok(!r.sources.some((x) => x.cle === 'calendrier'), 'le calendrier n\'est plus une source du panneau');
  assert.equal(r.points.length, 0);
});

// ─────────────── « Autour d'elle » : annonces légales de sa ville, puis de son département ───────────────
const sect = (ev, maj = '2026-11-24') => ({ maj, n: ev.length, ev });
const an = (id, d, f, nom, ville, cp, dep, detail = 'Fonds vendu') => ({ id, d, f, nom, ville, cp, dep, depNom: dep === '83' ? 'Var' : 'Rhône', detail, url: 'https://www.bodacc.fr/x?q.id=' + id });

test('autour d\'elle : sa ville d\'abord (même code postal ou même nom), puis le reste du département ; ventes, fermetures, procédures seulement', () => {
  const r = calculer(base({ officine: { ville: 'SAINT-MAXIMIN-LA-SAINTE-BAUME', cp: '83470' }, secteur: sect([
    an('a1', '2026-11-20', 'cession', 'PHARMACIE DU COURS', 'Saint-Maximin-la-Sainte-Baume', '83470', '83'),
    an('a2', '2026-11-22', 'procedure', 'SELARL PHARMACIE DE LA BASILIQUE', 'St Maximin la Ste Baume', '', '83', 'Redressement judiciaire'),
    an('a3', '2026-11-23', 'fermeture', 'PHARMACIE DU PORT', 'Toulon', '83000', '83', 'Société radiée'),
    an('a4', '2026-11-24', 'dirigeant', 'PHARMACIE DU MARCHÉ', 'Toulon', '83000', '83', 'Changement de dirigeant'),
    an('a5', '2026-11-24', 'creation', 'PHARMACIE NOUVELLE', 'Hyères', '83400', '83', 'Nouvelle société d’officine'),
    an('a6', '2026-11-24', 'cession', 'PHARMACIE DE LYON', 'Lyon', '69001', '69'),
  ]) }));
  const A = r.autour;
  assert.equal(A.connu, true); assert.equal(A.dep, '83'); assert.equal(A.depNom, 'Var');
  assert.deepEqual(Array.from(A.dansVille, (x) => x.titre), ['SELARL Pharmacie De La Basilique', 'Pharmacie Du Cours'], 'sa ville, la plus récente d\'abord (nom écrit autrement compris)');
  assert.deepEqual(Array.from(A.dansVille, (x) => x.famille), ['Procédure', 'Vente']);
  assert.deepEqual(Array.from(A.dansDep, (x) => x.titre), ['Pharmacie Du Port'], 'département : sans sa ville, sans changement de dirigeant ni création, sans autre département');
  assert.equal(A.dansDep[0].famille, 'Fermeture');
  assert.equal(A.depuis, '2026-11-20');
  assert.equal(r.points.length, 0, '« Autour d\'elle » ne prend aucune des 7 places de ce qui la touche');
  const s2 = r.sources.find((x) => x.cle === 'secteur');
  assert.equal(s2.lue, true); assert.equal(s2.date, '2026-11-24');
});

test('autour d\'elle : 5 au plus par niveau, le reste compté ; code postal inconnu = rien d\'inventé', () => {
  const ev = [];
  for (let i = 1; i <= 8; i++) ev.push(an('d' + i, '2026-11-0' + i, 'fermeture', 'PHARMACIE ' + i, 'Toulon', '83000', '83'));
  const r = calculer(base({ officine: { ville: 'BRIGNOLES', cp: '83170' }, secteur: sect(ev) }));
  assert.equal(r.autour.dansVille.length, 0);
  assert.equal(r.autour.dansDep.length, 5); assert.equal(r.autour.autresDep, 3);
  assert.equal(r.autour.dansDep[0].titre, 'Pharmacie 8', 'la plus récente en tête');
  const sans = calculer(base({ officine: { ville: 'BRIGNOLES', cp: '' }, secteur: sect(ev) }));
  assert.equal(sans.autour.connu, false); assert.equal(sans.autour.dansDep.length, 0);
  const corse = calculer(base({ officine: { ville: 'AJACCIO', cp: '20000' }, secteur: sect([an('c1', '2026-11-01', 'cession', 'PHARMACIE', 'Ajaccio', '20000', '2A')]) }));
  assert.equal(corse.autour.dep, '2A'); assert.equal(corse.autour.dansVille.length, 1);
});

test('calendrier-officine.json : chaque ligne a une date, une fenêtre et une source', () => {
  const c = JSON.parse(readFileSync(new URL('calendrier-officine.json', B), 'utf8'));
  assert.match(c.generated, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(c.items.length >= 1);
  for (const it of c.items) {
    assert.match(it.date, /^\d{4}-\d{2}-\d{2}$/, it.titre);
    assert.ok(it.prevenir_j > 0 && it.titre && it.detail && it.action && it.source_nom, it.titre);
    assert.match(it.source_url, /^https:\/\//, it.titre);
  }
});

// ─────────────── Chemin réel : fichiers du jour → hydrate() → HTML ───────────────
test('chemin réel : les vrais fichiers des robots arrivent jusqu\'à la carte', async () => {
  const lireJson = (f) => JSON.parse(readFileSync(new URL(f, B), 'utf8'));
  const vraiAnsm = lireJson('ansm-dispo.json');
  // marqueur positif : c'est bien le fichier des ruptures, et il est garni
  assert.ok(vraiAnsm.items.length > 50, 'ansm-dispo.json semble vide');
  const cible = vraiAnsm.items.find((i) => i.st === 'Rupture de stock' && i.cips && i.cips.length);
  assert.ok(cible, 'aucune rupture avec code produit dans le fichier du jour');

  const el = { innerHTML: '', getAttribute: (k) => (k === 'data-pid' ? '2000016' : null) };
  // Depuis le 22/09/2026 la ligne de résumé est dans #brief-off et le contenu dans la fenêtre #bo-ov (sur <body>).
  const rien = () => {};
  const ov = { id: '', innerHTML: '', firstChild: null, addEventListener: rien, getAttribute: () => null, setAttribute: rien, classList: { add: rien, remove: rien, contains: () => false }, querySelector: () => null };
  const demandes = [];
  const sb = charger({
    fetch: (url) => {
      const f = url.split('?')[0];
      demandes.push(f);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(lireJson(f)) });
    },
    addEventListener: rien,
    document: {
      getElementById: (id) => (id === 'brief-off' ? el : (id === 'bo-ov' && ov.id ? ov : null)),
      createElement: () => ov,
      addEventListener: rien,
      head: { appendChild() {} },
      body: { appendChild() {}, style: {} },
    },
  });
  // la carte « vue par le commercial » = la ligne de la fiche + la fenêtre
  const carte = () => el.innerHTML && (el.innerHTML + ov.innerHTML);
  sb.ETAB_PRICES = { prices: { CPR: { [cible.cips[0]]: [1, 7] } } };
  sb.V2.sales = [{ pharmacyId: '2000016', commercial: 'A', year: 2026, month: 8, artCode: cible.cips[0], qte: 6 }];
  // « Autour d'elle » : une vraie annonce (vente, fermeture ou procédure) du fichier du jour, et l'officine placée dans sa commune
  const vraiSect = lireJson('bodacc-secteur.json');
  assert.ok(vraiSect.ev.length > 50, 'bodacc-secteur.json semble vide');
  const annonce = vraiSect.ev.slice().sort((x, y) => (x.d < y.d ? 1 : -1)).find((x) => /^(cession|fermeture|procedure)$/.test(x.f) && /^\d{5}$/.test(x.cp) && x.ville);
  assert.ok(annonce, 'aucune vente, fermeture ni procédure avec code postal dans le fichier du jour');
  sb.V2.briefOfficine.hydrate('2000016', sb.V2.sales, { ville: annonce.ville, cp: annonce.cp });
  // un seul clic : le panneau s'ouvre AVANT la fin du calcul, sur « en préparation »
  assert.match(ov.innerHTML, /Infos du jour en préparation/);
  for (let i = 0; i < 20 && !carte(); i++) await new Promise((r) => setTimeout(r, 5));

  assert.deepEqual(demandes.sort(), ['ansm-dispo.json', 'bodacc-secteur.json', 'generiques-bdpm.json', 'prix-futurs.json', 'rappels-lots.json']);
  assert.ok(!/calendrier|bo-agenda|À l'agenda/.test(carte()), 'plus d\'échéances réglementaires dans le panneau');
  assert.match(ov.innerHTML, /<h3 id="bo-win-t">Infos du jour<\/h3>/);
  assert.match(ov.innerHTML, /Ce qui la touche[\s\S]*Autour d'elle[\s\S]*Dans sa ville[\s\S]*Dans son département/);
  assert.ok(ov.innerHTML.toLowerCase().includes(annonce.nom.toLowerCase().replace(/</g, '&lt;')), 'l\'annonce réelle de sa commune n\'arrive pas jusqu\'au panneau');
  assert.match(carte(), /Annonces légales \(\d/);
  assert.match(ov.innerHTML, /Se rouvre avec le bouton « Infos du jour »/);
  assert.match(el.innerHTML, /Aujourd'hui/);
  assert.match(el.innerHTML, /bo-dot|bo-sum/, 'la ligne de résumé (point + résumé) n\'est pas dans la fiche');
  assert.match(ov.innerHTML, /bo-win/, 'la fenêtre n\'est pas fabriquée');
  assert.ok(carte().includes(cible.spec.split(' – [')[0].split(', ')[0]), 'la rupture réelle n\'apparaît pas');
  assert.match(carte(), /7 boîtes sur CPR/);
  assert.ok(!/non lue/.test(carte()), 'une source réelle n\'a pas été lue');
  // contre-épreuve : la même officine sans cet achat ne voit pas cette rupture
  el.innerHTML = ''; ov.innerHTML = '';
  sb.V2.briefOfficine.hydrate('2000016', [{ pharmacyId: '2000016', commercial: 'A', year: 2026, month: 8, artCode: '3400900000000', qte: 1 }]);
  for (let i = 0; i < 20 && !carte(); i++) await new Promise((r) => setTimeout(r, 5));
  assert.ok(carte().length > 0);
  assert.ok(!carte().includes(cible.spec.split(' – [')[0].split(', ')[0]));
});

// Le catalogue (benchmark-data.js) arrive en différé : un premier brief calculé sans lui ne doit pas
// priver les suivants des rubriques qui ont besoin des noms de produits.
test('chemin réel : un brief calculé AVANT le catalogue ne vide pas « Ses achats » pour la suite', async () => {
  const lireJson = (f) => JSON.parse(readFileSync(new URL(f, B), 'utf8'));
  const rien = () => {};
  const el = { innerHTML: '', getAttribute: (k) => (k === 'data-pid' ? '2000016' : null) };
  const ov = { id: '', innerHTML: '', firstChild: null, addEventListener: rien, getAttribute: () => null, setAttribute: rien, classList: { add: rien, remove: rien, contains: () => false }, querySelector: () => null };
  const sb = charger({
    fetch: (url) => Promise.resolve({ ok: true, json: () => Promise.resolve(lireJson(url.split('?')[0])) }),
    addEventListener: rien,
    document: { getElementById: (id) => (id === 'brief-off' ? el : (id === 'bo-ov' && ov.id ? ov : null)), createElement: () => ov, addEventListener: rien, head: { appendChild() {} }, body: { appendChild() {}, style: {} } },
  });
  sb.ETAB_PRICES = { prices: {} };
  const v = (cip, month) => ({ pharmacyId: '2000016', commercial: 'A', year: 2026, month, artCode: cip, qte: 2 });
  sb.V2.sales = [3, 4, 5, 6, 7].map((m) => v('3400900000001', m)).concat([v('3400900000009', 8)]);
  const attendre = async () => { el.innerHTML = ''; sb.V2.briefOfficine.hydrate('2000016', sb.V2.sales); for (let i = 0; i < 20 && !el.innerHTML; i++) await new Promise((r) => setTimeout(r, 5)); };
  await attendre();
  assert.ok(el.innerHTML.length > 0);
  assert.ok(!/achat interrompu/.test(el.innerHTML), 'sans catalogue, aucun nom : la rubrique ne peut pas sortir');
  sb.BENCHMARK = [{ cip13: '3400900000001', designation: 'DOLIPRANE 1000 MG' }];
  await attendre();
  assert.match(el.innerHTML, /1 achat interrompu/, 'le catalogue est arrivé : la rubrique doit revenir');
  assert.match(ov.innerHTML, /Pas commandé en août 2026 : Doliprane 1000 mg/);
});

test('nePlusCommandes : même règle que « Ses achats », toutes les lignes, mois par mois', () => {
  const sb = charger();
  const v = (cip, month, qte = 2, commercial = 'A') => ({ commercial, year: 2026, month, artCode: cip, qte });
  const ventes = [];
  for (let k = 1; k <= 5; k++) [3, 4, 5, 6, 7].forEach((m) => ventes.push(v('340090000000' + k, m, k)));
  [3, 4, 5].forEach((m) => ventes.push(v('3400900000006', m)));          // 3 mois sur 5 : pas une habitude
  [3, 4, 5, 6, 7, 8].forEach((m) => ventes.push(v('3400900000007', m)));  // toujours commandé
  sb.V2.sales = ventes;
  const r = sb.V2.briefOfficine.nePlusCommandes(ventes);
  assert.equal(r.connu, true);
  assert.equal(r.fin, '2026-08');
  assert.deepEqual(Array.from(r.lignes, (l) => l.cip.slice(-1)), ['5', '4', '3', '2', '1']);
  assert.equal(r.lignes[0].dernier, '2026-07');
  // contre-épreuve : le fichier d'un 2e commercial s'arrête en juillet → août n'est pas un mois complet, on ne dit rien
  const court = ventes.concat([v('3400900000008', 7, 1, 'B')]);
  sb.V2.sales = court;
  assert.equal(sb.V2.briefOfficine.nePlusCommandes(court).lignes.length, 0);
});

// 24/11/2026 — en-tête du panneau : « 21 autres points » en haut contre « 18 autres points » replié en bas
// (officine 2003659, production). Le mot « autres » voulait dire « d'une autre sorte » en haut et « pas affiché
// au-dessus » en bas : les 3 « Change bientôt » affichés en tête comptaient dans les 21. Et « 7 points » dans le
// sous-titre face à 54 dans l'en-tête. Règle : en haut, chaque sorte porte SON nom ; le sous-titre dit combien
// sont en tête et combien sont repliés, et les deux font le total de l'en-tête.
test('en-tête du panneau : chaque sorte a son nom, et en tête + repliés = total de l\'en-tête', async () => {
  const rien = () => {};
  const el = { innerHTML: '', getAttribute: (k) => (k === 'data-pid' ? '2000016' : null) };
  const ov = { id: '', innerHTML: '', firstChild: null, addEventListener: rien, getAttribute: () => null, setAttribute: rien, classList: { add: rien, remove: rien, contains: () => false }, querySelector: () => null };
  const jour = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const fr = (iso) => iso.split('-').reverse().join('/');
  const cip = (n) => '34009000' + String(n).padStart(5, '0');
  const R = [cip(1)], A = [2, 3, 4].map(cip), P = [5, 6, 7, 8, 9].map(cip), U = [10, 11, 12, 13, 14, 15].map(cip), V = [16, 17].map(cip), O = [18, 19].map(cip);
  const json = {
    'rappels-lots.json': { generated: jour(0), items: [{ d: jour(-10), t: 'Produit rappelé', cips: R, lots: [{ n: 'L1' }] }] },
    'prix-futurs.json': { generated: jour(0), changes: P.map((c) => ({ c, sens: 'baisse', date_effet: jour(40), date_publi: jour(-5), ppttc: '9.99', d: 'Prix ' + c })) },
    'ansm-dispo.json': { generated: jour(0), items: U.map((c) => ({ st: 'Rupture de stock', spec: 'Rupture ' + c, maj: fr(jour(-1)), cips: [c] }))
      .concat(V.map((c) => ({ st: 'Remise à disposition', spec: 'Revient ' + c, maj: fr(jour(-1)), since: jour(-2), cips: [c] }))) },
    'generiques-bdpm.json': { generated: jour(0), princepsWithGeneric: O },
  };
  const sb = charger({
    fetch: (url) => { const j = json[url.split('?')[0]]; return Promise.resolve(j ? { ok: true, json: () => Promise.resolve(j) } : { ok: false }); },
    addEventListener: rien,
    document: { getElementById: (id) => (id === 'brief-off' ? el : (id === 'bo-ov' && ov.id ? ov : null)), createElement: () => ov, addEventListener: rien, head: { appendChild() {} }, body: { appendChild() {}, style: {} } },
  });
  sb.ETAB_PRICES = { prices: {} };
  sb.BENCHMARK = A.concat(O).map((c) => ({ cip13: c, designation: 'PRODUIT ' + c }));
  const v = (c, month, qte = 4) => ({ pharmacyId: '2000016', commercial: 'A', year: 2026, month, artCode: c, qte });
  const ventes = [v(R[0], 8)];
  A.forEach((c) => [3, 4, 5, 6, 7].forEach((m) => ventes.push(v(c, m))));          // habitude interrompue en août
  P.concat(U).forEach((c) => [7, 8].forEach((m) => ventes.push(v(c, m))));
  V.forEach((c) => ventes.push(v(c, 8)));
  O.forEach((c) => [6, 7, 8].forEach((m) => ventes.push(v(c, m, 5))));             // 15 boîtes : au-dessus du seuil
  sb.V2.sales = ventes;
  sb.V2.briefOfficine.hydrate('2000016', ventes, {});
  for (let i = 0; i < 20 && !el.innerHTML; i++) await new Promise((r) => setTimeout(r, 5));

  const total = 1 + 3 + 5 + 6 + 2 + 2;   // 19 points : 7 en tête, 12 repliés
  const tete = ov.innerHTML.split('<div class="bo-win-b">')[0];
  const resume = (tete.match(/<span class="bo-sum">([\s\S]*?)<\/span><button/) || [])[1] || '';
  assert.ok(resume, 'pas de résumé dans l\'en-tête du panneau');
  // marqueur positif : c'est bien l'en-tête attendu (le rappel en rouge, les achats)
  assert.match(resume, /<em>1 rappel de lots<\/em>/);
  assert.match(resume, /3 achats interrompus/);
  assert.ok(!/autre/.test(resume), 'l\'en-tête range encore des points sous « autres » : ' + resume);
  assert.match(resume, /5 prix qui changent/);
  assert.match(resume, /6 ruptures ou tensions/);
  assert.match(resume, /2 produits de nouveau disponibles/);
  assert.match(resume, /2 génériques à proposer/);
  const somme = (resume.match(/\d+/g) || []).reduce((t, n) => t + Number(n), 0);
  assert.equal(somme, total, 'les nombres de l\'en-tête ne font pas le total des points');
  // le sous-titre : combien en tête, combien repliés, et les replis du bas font bien ce nombre
  assert.match(tete, /7 points en tête, 12 repliés plus bas/);
  const replis = [...ov.innerHTML.matchAll(/<summary>(\d+) /g)].reduce((t, m) => t + Number(m[1]), 0);
  assert.equal(replis, 12, 'les listes repliées du bas ne font pas le nombre annoncé dans le sous-titre');
  assert.equal((ov.innerHTML.match(/<li class="bo-pt">/g) || []).length, total, 'chaque point est dans le panneau, une seule fois');
});

// 24/11/2026 — en bas du panneau, « 29 autres ruptures ou tensions » alors qu'AUCUNE rupture n'était affichée en
// tête (officine 2003659, production) : « autres » de trop. Règle : la liste repliée des ruptures ne dit « autres »
// que si au moins une rupture est déjà visible au-dessus ; « autres points » reste juste, des points sont toujours en tête.
test('liste repliée des ruptures : « autres » seulement si une rupture est déjà affichée en tête', async () => {
  const rien = () => {};
  const jour = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const fr = (iso) => iso.split('-').reverse().join('/');
  const cip = (n) => '34009000' + String(n).padStart(5, '0');
  const panneau = async (json, ventes, benchmark) => {
    const el = { innerHTML: '', getAttribute: (k) => (k === 'data-pid' ? '2000016' : null) };
    const ov = { id: '', innerHTML: '', firstChild: null, addEventListener: rien, getAttribute: () => null, setAttribute: rien, classList: { add: rien, remove: rien, contains: () => false }, querySelector: () => null };
    const sb = charger({
      fetch: (url) => { const j = json[url.split('?')[0]]; return Promise.resolve(j ? { ok: true, json: () => Promise.resolve(j) } : { ok: false }); },
      addEventListener: rien,
      document: { getElementById: (id) => (id === 'brief-off' ? el : (id === 'bo-ov' && ov.id ? ov : null)), createElement: () => ov, addEventListener: rien, head: { appendChild() {} }, body: { appendChild() {}, style: {} } },
    });
    sb.ETAB_PRICES = { prices: {} };
    sb.BENCHMARK = benchmark;
    sb.V2.sales = ventes;
    sb.V2.briefOfficine.hydrate('2000016', ventes, {});
    for (let i = 0; i < 20 && !el.innerHTML; i++) await new Promise((r) => setTimeout(r, 5));
    return ov.innerHTML;
  };
  const v = (c, month, qte = 4) => ({ pharmacyId: '2000016', commercial: 'A', year: 2026, month, artCode: c, qte });
  const R = [cip(1)], U = [10, 11, 12, 13, 14, 15].map(cip);
  const rappels = { generated: jour(0), items: [{ d: jour(-10), t: 'Produit rappelé', cips: R, lots: [{ n: 'L1' }] }] };
  const ansm = { generated: jour(0), items: U.map((c) => ({ st: 'Rupture de stock', spec: 'Rupture ' + c, maj: fr(jour(-1)), cips: [c] })) };
  const summaries = (h) => [...h.matchAll(/<summary>([^<]*)<\/summary>/g)].map((m) => m[1]);

  // Cas 1 — en tête : 1 rappel + 3 achats interrompus + 3 prix qui changent (les 7 places) ; les 6 ruptures sont toutes repliées.
  const A = [2, 3, 4].map(cip), P = [5, 6, 7, 8, 9].map(cip);
  const ventes1 = [v(R[0], 8)];
  A.forEach((c) => [3, 4, 5, 6, 7].forEach((m) => ventes1.push(v(c, m))));
  P.concat(U).forEach((c) => [7, 8].forEach((m) => ventes1.push(v(c, m))));
  const h1 = await panneau({
    'rappels-lots.json': rappels, 'ansm-dispo.json': ansm,
    'prix-futurs.json': { generated: jour(0), changes: P.map((c) => ({ c, sens: 'baisse', date_effet: jour(40), date_publi: jour(-5), ppttc: '9.99', d: 'Prix ' + c })) },
  }, ventes1, A.map((c) => ({ cip13: c, designation: 'PRODUIT ' + c })));
  const tete1 = h1.split('<details')[0];
  assert.match(tete1, /3 achats interrompus/, 'marqueur positif : ce n\'est pas le panneau attendu');
  assert.ok(!/Rupture 34009/.test(tete1), 'cas mal monté : une rupture est affichée en tête');
  assert.deepEqual(summaries(h1), ['6 ruptures ou tensions', '2 autres points']);

  // Cas 2 — en tête : 1 rappel + 3 ruptures (le plafond) ; les 3 autres ruptures sont repliées.
  const ventes2 = [v(R[0], 8)];
  U.forEach((c) => [7, 8].forEach((m) => ventes2.push(v(c, m))));
  const h2 = await panneau({ 'rappels-lots.json': rappels, 'ansm-dispo.json': ansm }, ventes2, []);
  assert.equal((h2.split('<details')[0].match(/Rupture 34009/g) || []).length, 3, 'cas mal monté : il faut 3 ruptures en tête');
  assert.deepEqual(summaries(h2), ['3 autres ruptures ou tensions']);
});

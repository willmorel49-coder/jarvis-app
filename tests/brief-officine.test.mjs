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

test('échéance : dans sa fenêtre seulement, 2 au plus, à part des 7 points', () => {
  const ech = (date, prevenir_j, titre) => ({ date, prevenir_j, titre, detail: 'D.', action: 'A.', source_nom: 'S' });
  const r = calculer(base({
    ventes: [{ cip: '3400900000001', mois: '2026-08', qte: 1 }],
    calendrier: { generated: '2026-09-17', items: [
      ech('2026-09-01', 365, 'Passée'),
      ech('2027-09-01', 300, 'Trop tôt'),
      ech('2026-10-07', 60, 'Proche'),
      ech('2027-01-20', 150, 'Réforme'),
      ech('2027-02-01', 200, 'Troisième'),
    ] },
  }));
  assert.deepEqual(Array.from(r.echeances, (p) => p.titre), ['Proche le 07/10/2026 (dans 20 jours)', 'Réforme le 20/01/2027 (dans 125 jours)']);
  assert.equal(r.points.length, 0);
  const s = Object.fromEntries(Array.from(r.sources, (x) => [x.cle, x]));
  assert.equal(s.calendrier.aJour, true);
  const vieux = calculer(base({ calendrier: { generated: '2026-05-01', items: [] } }));
  assert.equal(vieux.sources.find((x) => x.cle === 'calendrier').aJour, false);
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
  sb.V2.briefOfficine.hydrate('2000016', sb.V2.sales);
  for (let i = 0; i < 20 && !carte(); i++) await new Promise((r) => setTimeout(r, 5));

  assert.deepEqual(demandes.sort(), ['ansm-dispo.json', 'calendrier-officine.json', 'generiques-bdpm.json', 'prix-futurs.json', 'rappels-lots.json']);
  assert.match(carte(), /Calendrier réglementaire \(\d/);
  const auj = new Date().toISOString().slice(0, 10);
  const attendue = lireJson('calendrier-officine.json').items
    .find((it) => it.date >= auj && (Date.parse(it.date) - Date.parse(auj)) / 864e5 <= it.prevenir_j);
  if (attendue) {
    assert.ok(carte().includes(attendue.titre), 'l\'échéance du calendrier n\'arrive pas jusqu\'à la carte');
    assert.match(ov.innerHTML, /<details class="bo-agenda"><summary>À l'agenda/, 'l\'agenda doit être replié');
    assert.ok(!/échéance/.test(el.innerHTML), 'les échéances ne doivent plus figurer dans le résumé de la fiche');
  }
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

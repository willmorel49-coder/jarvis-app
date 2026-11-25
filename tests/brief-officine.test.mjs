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
  assert.match(r.points[0].titre, /Baisse le 20\/09\/2026 : Proche/);   // nom écrit comme partout ailleurs (24/11/2026)
  assert.equal(r.points[0].urgence, 3);
  assert.match(r.points[0].detail, /6,50 € → 5,00 € TTC/);   // 25/11/2026 (Will) : deux chiffres après la virgule
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

// 24/11/2026 (Will) : les ruptures passent avant les prix qui changent.
test('ordre : rappel, ses achats, ruptures, prix, opportunité — ce qui lui est propre avant le national', () => {
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
  assert.deepEqual(Array.from(r.points, (p) => p.rubrique), ['À retirer', 'Ses achats', 'Va manquer', 'Change bientôt', 'Opportunité']);
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
  assert.match(ov.innerHTML, /<div class="bo-win-f">[\s\S]*Fermer/, 'le pied du panneau (Imprimer, Fermer) a disparu');
  assert.ok(!/Se rouvre avec le bouton/.test(ov.innerHTML), 'phrase du pied retirée par Will le 24/11/2026');
  assert.match(el.innerHTML, /Aujourd'hui/);
  assert.match(el.innerHTML, /bo-dot|bo-sum/, 'la ligne de résumé (point + résumé) n\'est pas dans la fiche');
  assert.match(ov.innerHTML, /bo-win/, 'la fenêtre n\'est pas fabriquée');
  const nomCible = sb.V2.briefOfficine.nomProduit(cible.spec);
  assert.ok(nomCible.length > 3 && cible.spec.toLowerCase().startsWith(nomCible.split(' ')[0].toLowerCase()), 'nom de la rupture réelle mal écrit : ' + nomCible);
  assert.ok(carte().includes(nomCible), 'la rupture réelle n\'apparaît pas');
  assert.match(carte(), /7 boîtes sur CPR/);
  assert.ok(!/non lue/.test(carte()), 'une source réelle n\'a pas été lue');
  // contre-épreuve : la même officine sans cet achat ne voit pas cette rupture
  el.innerHTML = ''; ov.innerHTML = '';
  sb.V2.briefOfficine.hydrate('2000016', [{ pharmacyId: '2000016', commercial: 'A', year: 2026, month: 8, artCode: '3400900000000', qte: 1 }]);
  for (let i = 0; i < 20 && !carte(); i++) await new Promise((r) => setTimeout(r, 5));
  assert.ok(carte().length > 0);
  assert.ok(!carte().includes(nomCible));
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

  // Cas 1 — en tête : 4 rappels + 3 achats interrompus (les 7 places) ; les 6 ruptures sont toutes repliées.
  // (24/11/2026 : les ruptures passent avant les prix, seuls les rappels et ses achats peuvent donc les repousser.)
  const A = [2, 3, 4].map(cip), P = [5, 6, 7, 8, 9].map(cip), R4 = [1, 20, 21, 22].map(cip);
  const rappels4 = { generated: jour(0), items: R4.map((c, i) => ({ d: jour(-10), t: 'Produit rappelé ' + i, cips: [c], lots: [{ n: 'L' + i }] })) };
  const ventes1 = R4.map((c) => v(c, 8));
  A.forEach((c) => [3, 4, 5, 6, 7].forEach((m) => ventes1.push(v(c, m))));
  P.concat(U).forEach((c) => [7, 8].forEach((m) => ventes1.push(v(c, m))));
  const h1 = await panneau({
    'rappels-lots.json': rappels4, 'ansm-dispo.json': ansm,
    'prix-futurs.json': { generated: jour(0), changes: P.map((c) => ({ c, sens: 'baisse', date_effet: jour(40), date_publi: jour(-5), ppttc: '9.99', d: 'Prix ' + c })) },
  }, ventes1, A.map((c) => ({ cip13: c, designation: 'PRODUIT ' + c })));
  const tete1 = h1.split('<details')[0];
  assert.match(tete1, /3 achats interrompus/, 'marqueur positif : ce n\'est pas le panneau attendu');
  assert.ok(!/Rupture 34009/.test(tete1), 'cas mal monté : une rupture est affichée en tête');
  assert.deepEqual(summaries(h1), ['6 ruptures ou tensions', '5 autres points']);

  // Cas 2 — en tête : 1 rappel + 3 ruptures (le plafond) ; les 3 autres ruptures sont repliées.
  const ventes2 = [v(R[0], 8)];
  U.forEach((c) => [7, 8].forEach((m) => ventes2.push(v(c, m))));
  const h2 = await panneau({ 'rappels-lots.json': rappels, 'ansm-dispo.json': ansm }, ventes2, []);
  assert.equal((h2.split('<details')[0].match(/Rupture 34009/g) || []).length, 3, 'cas mal monté : il faut 3 ruptures en tête');
  assert.deepEqual(summaries(h2), ['3 autres ruptures ou tensions']);
});

// ── 24/11/2026 (Will, choix cliqués après l'audit du panneau, ~/jarvis-preuves/infos-du-jour-audit-2026-11-24/AUDIT.md) ──
const rienA = () => {};
const jourA = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const frA = (iso) => iso.split('-').reverse().join('/');
const cipA = (n) => '34009000' + String(n).padStart(5, '0');
const venteA = (c, month, qte = 4) => ({ pharmacyId: '2000016', commercial: 'A', year: 2026, month, artCode: c, qte });
async function panneauA(json, ventes, benchmark = [], lieu = {}) {
  const el = { innerHTML: '', getAttribute: (k) => (k === 'data-pid' ? '2000016' : null) };
  const ov = { id: '', innerHTML: '', firstChild: null, addEventListener: rienA, getAttribute: () => null, setAttribute: rienA, classList: { add: rienA, remove: rienA, contains: () => false }, querySelector: () => null };
  const sb = charger({
    fetch: (url) => { const j = json[url.split('?')[0]]; return Promise.resolve(j ? { ok: true, json: () => Promise.resolve(j) } : { ok: false }); },
    addEventListener: rienA,
    document: { getElementById: (id) => (id === 'brief-off' ? el : (id === 'bo-ov' && ov.id ? ov : null)), createElement: () => ov, addEventListener: rienA, head: { appendChild() {} }, body: { appendChild() {}, style: {} } },
  });
  sb.ETAB_PRICES = { prices: {} };
  sb.BENCHMARK = benchmark;
  sb.V2.sales = ventes;
  sb.V2.briefOfficine.hydrate('2000016', ventes, lieu);
  for (let i = 0; i < 20 && !el.innerHTML; i++) await new Promise((r) => setTimeout(r, 5));
  return ov.innerHTML;
}

// D1 — les 7 places du haut prises par 1 rappel, 3 achats et 3 baisses (dont Ezetimibe 11,75 → 11,68 €, −0,6 %, avec
// « Lui conseiller d'écouler son stock ») ; ses 29 ruptures toutes repliées. Règle : ruptures avant prix ; baisse < 5 % repliée, sans « écouler ».
test('24/11 (1) : les ruptures avant les prix ; une baisse de moins de 5 % repliée, sans « écouler son stock »', () => {
  const ventes = ['3400900000001', '3400900000002', '3400900000003', '3400900000004'].map((cip) => ({ cip, mois: '2026-08', qte: 30 }));
  const change = (c, d, ancien, ppttc) => ({ c, d, sens: 'baisse', date_effet: '2026-10-20', date_publi: '2026-09-16', ppttc, ...(ancien ? { ancien_ttc: ancien } : {}) });
  const r = calculer(base({
    ventes,
    ansm: ansm([rupture(['3400900000001'])]),
    prixFuturs: { generated: '2026-09-17', changes: [
      change('3400900000002', 'EZETIMIBE ZEN 10MG CPR BT30', 11.75, 11.68),    // −0,6 % : repliée
      change('3400900000003', 'RIVAROXABAN ZEN 20MG CPR BT28', 12.37, 11.43),  // −7,6 % : en tête
      change('3400900000004', 'SANS ANCIEN PRIX 5MG CPR BT30', null, 9.5),     // ancien prix inconnu : traitement d'avant
    ] },
  }));
  assert.deepEqual(Array.from(r.points, (p) => p.rubrique), ['Va manquer', 'Change bientôt', 'Change bientôt'], 'la rupture doit passer avant les prix');
  assert.ok(!r.points.some((p) => /Ezetimibe/.test(p.titre)), 'la baisse de 0,6 % prend encore une place du haut');
  const petite = r.autres.find((p) => /Ezetimibe/.test(p.titre));
  assert.ok(petite, 'la petite baisse doit rester dans le panneau, repliée');
  assert.ok(!/écouler/.test(petite.action), 'pas de conseil d\'écouler son stock pour 0,6 %');
  assert.match(petite.detail, /11,75 € → 11,68 € TTC \(−0,6 %\)/);
  const grande = r.points.find((p) => /Rivaroxaban/.test(p.titre));
  assert.match(grande.action, /écouler son stock avant le 20\/10\/2026/);
  const sansAncien = r.points.find((p) => /Sans ancien prix/.test(p.titre));
  assert.ok(sansAncien && /écouler/.test(sansAncien.action), 'sans ancien prix, le point garde son traitement d\'avant');
});

// D2 — trois écritures dans la même liste : « Clopidogrel Zentiva 75 mg » (ANSM), « Prednisolone ztl 20mg c.disp20 »
// (catalogue), « RIVAROXABAN ZEN 20MG CPR BT28 » (JO). Règle : une seule écriture ; abréviation développée seulement si sûre.
test('24/11 (2) : un nom de produit s\'écrit d\'une seule façon, quelle que soit la source', () => {
  const hab = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'].map((m) => ({ cip: '3400900000002', mois: m, qte: 80 }));
  const r = calculer(base({
    moisCouverts: ['2026-02', ...MOIS], ventes: hab.concat([
      { cip: '3400900000001', mois: '2026-08', qte: 84 }, { cip: '3400900000003', mois: '2026-08', qte: 120 },
      { cip: '3400900000004', mois: '2026-08', qte: 12 }, { cip: '3400900000009', mois: '2026-08', qte: 1 },
    ]),
    nom: (c) => ({ '3400900000002': 'PREDNISOLONE ZTL 20MG C.DISP20' }[c] || ''),
    rappels: { generated: '2026-09-17', items: [{ d: '2026-09-08', t: 'Clopidogrel Zentiva 75 mg, comprimé pelliculé', cips: ['3400900000001'], lots: [{ n: '4P0202A', exp: '12/2026' }, { n: '4P0201A', exp: '12/2026' }] }] },
    prixFuturs: { generated: '2026-09-17', changes: [{ c: '3400900000003', d: 'RIVAROXABAN ZEN 20MG CPR BT28', sens: 'baisse', date_effet: '2026-10-20', date_publi: '2026-09-16', ppttc: 11.43, ancien_ttc: 12.37 }] },
    ansm: ansm([rupture(['3400900000004'], { spec: 'EZETIMIBE EG 10 mg, comprimé – [ézétimibe]' })]),
  }));
  const titres = r.points.map((p) => p.titre);
  const nomDe = (re) => (titres.find((t) => re.test(t)) || '').split(' : ').pop();
  assert.equal(nomDe(/Rappel/), 'Clopidogrel Zentiva 75 mg');
  assert.equal(nomDe(/Pas commandé/), 'Prednisolone ZTL 20 mg', 'ZTL n\'est recoupé nulle part : gardé tel quel, en sigle');
  assert.equal(nomDe(/Baisse/), 'Rivaroxaban Zentiva 20 mg', 'ZEN = Zentiva, recoupé CIP par CIP');
  assert.equal(nomDe(/En rupture/), 'Ezetimibe EG 10 mg');
  titres.forEach((t) => {
    const nomP = t.split(' : ').pop();
    assert.ok(!/\b[A-Z]{4,}\b/.test(nomP), 'mot en majuscules dans « ' + nomP + ' »');
    assert.ok(!/\b(CPR|BT\d+|c\.disp\d*)\b|\d(mg|MG)\b/i.test(nomP), 'forme, boîte ou dosage collé dans « ' + nomP + ' »');
  });
});

// D3 — à l'ordinateur, la pastille « Change bientôt » dépassait le min-width de 96 px : ses titres commençaient plus à droite.
test('24/11 (3) : pastilles de largeur fixe commune, texte aligné quelle que soit la pastille', () => {
  const src = readFileSync(new URL('v2-brief-officine.js', B), 'utf8');
  const rub = (src.match(/'\.bo-rub\{[^}]*\}/) || [''])[0], g = (src.match(/'\.bo-g\{[^}]*\}/) || [''])[0];
  assert.ok(!/min-width/.test(rub), 'min-width laisse les pastilles longues déborder : ' + rub);
  const w = Number((rub.match(/;width:(\d+)px/) || [])[1]);
  assert.ok(w >= 112, '« Change bientôt » mesure ~108 px sous WebKit : largeur ' + w);
  assert.match(rub, /white-space:nowrap/);
  assert.equal(Number((g.match(/;width:(\d+)px/) || [])[1]), w, 'la colonne de gauche (pastille + source) doit avoir la largeur de la pastille');
});

// D4 — chaque point faisait 4 à 5 lignes ; « Ses achats » redisait la pastille et le titre (« Habitude d'achat interrompue. »).
test('24/11 (4) : points allégés — plus de redite, la source officielle et sa date gardées sous la pastille', async () => {
  const R = [cipA(1)], A = [2].map(cipA), U = [10].map(cipA), P = [5].map(cipA);
  const ventes = [venteA(R[0], 8)];
  A.forEach((c) => [3, 4, 5, 6, 7].forEach((m) => ventes.push(venteA(c, m))));
  U.concat(P).forEach((c) => [7, 8].forEach((m) => ventes.push(venteA(c, m))));
  const h = await panneauA({
    'rappels-lots.json': { generated: jourA(0), items: [{ d: jourA(-10), t: 'Produit rappelé', cips: R, lots: [{ n: 'L1' }] }] },
    'ansm-dispo.json': { generated: jourA(0), items: U.map((c) => ({ st: 'Rupture de stock', spec: 'Rupture ' + c, maj: frA(jourA(-1)), cips: [c] })) },
    'prix-futurs.json': { generated: jourA(0), changes: P.map((c) => ({ c, sens: 'baisse', date_effet: jourA(40), date_publi: jourA(-5), ppttc: 9, ancien_ttc: 10, d: 'Prix ' + c })) },
  }, ventes, A.map((c) => ({ cip13: c, designation: 'PRODUIT ' + c })));
  const points = [...h.split('<details')[0].matchAll(/<li class="bo-pt">([\s\S]*?)<\/li>/g)].map((m) => m[1]).filter((x) => /bo-g/.test(x));
  assert.equal(points.length, 4, 'marqueur positif : rappel, achat, rupture, prix en tête');
  assert.ok(!/Habitude d'achat interrompue/.test(h), 'la ligne qui redit la pastille et le titre est encore là');
  assert.ok(!/présent dans ses achats|\(rupture de stock/.test(h), 'la source redit le titre');
  points.forEach((x) => {
    const tx = (x.match(/<div class="bo-tx">([\s\S]*)<\/div>/) || [])[1] || '';
    const rangs = (tx.match(/<(b|span|small)[ >]/g) || []).length;
    assert.ok(rangs <= 3, 'plus de 3 rangs de texte dans un point : ' + tx);
  });
  const sourceDe = (rub) => ((points.find((x) => x.includes('>' + rub + '<')) || '').match(/<small class="bo-qui">([^<]*)<\/small>/) || [])[1] || '';
  const dt = /\d{2}\/\d{2}\/\d{4}/;
  assert.match(sourceDe('À retirer'), /^ANSM · /); assert.match(sourceDe('À retirer'), dt);
  assert.match(sourceDe('Va manquer'), /^ANSM · /); assert.match(sourceDe('Va manquer'), dt);
  assert.match(sourceDe('Change bientôt'), /^Journal officiel du /); assert.match(sourceDe('Change bientôt'), dt);
  assert.equal(sourceDe('Ses achats'), '', 'ses achats ne sont pas une source publique : pas de ligne de source');
});

// D5 + D6 — sous-titre « ce qui la touche, tiré de ses achats · 7 points en tête, 47 repliés plus bas, puis ce qui se passe
// autour d'elle » (2 lignes au téléphone) ; pied « Se rouvre avec le bouton « Infos du jour ». » sans utilité.
test('24/11 (5, 6) : en-tête raccourci, compte toujours vérifiable ; phrase du pied supprimée', async () => {
  const R = [cipA(1)], U = [10, 11, 12, 13, 14, 15].map(cipA);
  const ventes = [venteA(R[0], 8)];
  U.forEach((c) => [7, 8].forEach((m) => ventes.push(venteA(c, m))));
  const h = await panneauA({
    'rappels-lots.json': { generated: jourA(0), items: [{ d: jourA(-10), t: 'Produit rappelé', cips: R, lots: [{ n: 'L1' }] }] },
    'ansm-dispo.json': { generated: jourA(0), items: U.map((c) => ({ st: 'Rupture de stock', spec: 'Rupture ' + c, maj: frA(jourA(-1)), cips: [c] })) },
  }, ventes);
  const tete = h.split('<div class="bo-win-b">')[0];
  const sous = (tete.match(/<span class="pha-sub">([^<]*)<\/span>/) || [])[1] || '';
  assert.match(sous, /^4 points en tête, 3 repliés plus bas$/, 'sous-titre : ' + sous);
  assert.ok(sous.length <= 40, 'sous-titre trop long : ' + sous);
  const somme = ((tete.match(/<span class="bo-sum">([\s\S]*?)<\/span><button/) || [])[1] || '').match(/\d+/g).reduce((t, n) => t + Number(n), 0);
  assert.equal(somme, 4 + 3, 'en tête + repliés ≠ total de l\'en-tête');
  const pied = (h.match(/<div class="bo-win-f">([\s\S]*?)<\/div><\/div>$/) || [])[1] || '';
  assert.match(pied, /Fermer/, 'marqueur positif : c\'est bien le pied');
  assert.ok(!/Se rouvre/.test(pied), 'phrase du pied encore là');
});

// Le rendu local du 24/11 l'a montré : le libellé du catalogue arrivait déjà écrit en minuscules (« Prednisolone ztl 20mg… »)
// par la lecture du catalogue, avant la règle du nom. On éprouve donc le CHEMIN réel : BENCHMARK → hydrate() → panneau.
test('24/11 (2 bis) : chemin réel — le libellé du catalogue arrive dans le panneau écrit comme les autres sources', async () => {
  const A = [cipA(2)], R = [cipA(1)];
  const ventes = [venteA(R[0], 8)];
  A.forEach((c) => [3, 4, 5, 6, 7].forEach((m) => ventes.push(venteA(c, m))));
  const h = await panneauA({
    'rappels-lots.json': { generated: jourA(0), items: [{ d: jourA(-10), t: 'Produit rappelé', cips: R, lots: [{ n: 'L1' }] }] },
  }, ventes, [{ cip13: A[0], designation: 'PREDNISOLONE ZTL 20MG C.DISP20' }]);
  assert.match(h, /Pas commandé en [^<]* : /, 'marqueur positif : le point « Ses achats » est là');
  assert.match(h, /Pas commandé en [^<]* : Prednisolone ZTL 20 mg</);
});

// 25/11/2026 — vu en production (officine 2003659) après la première mise en ligne : « Vitamine B12 Delagrange 1000 undefined/2 ml »
// (le « µ » mis en majuscule devient une lettre grecque), « Ezetimib/ator.zen10/20mg » (libellé du JO collé), et un point de
// 5 lignes à cause de 7 sites listés. Contrôle sur TOUS les vrais libellés des fichiers du jour, pas sur un échantillon.
test('25/11 : tous les vrais libellés (ANSM, rappels, JO, catalogue) donnent un nom propre', () => {
  const { nomProduit } = charger().V2.briefOfficine;
  assert.equal(nomProduit('Vitamine B12 Delagrange 1000 µg/2 ml, solution injectable'), 'Vitamine B12 Delagrange 1000 µg/2 ml');
  assert.equal(nomProduit('EZETIMIB/ATOR.ZEN10/20MG CPR90'), 'Ezetimib/ator. Zentiva 10/20 mg');
  assert.equal(nomProduit('EZETIMIB/ATOR.EG 10/20MG CPR30'), 'Ezetimib/ator. EG 10/20 mg');
  const lireJson = (f) => JSON.parse(readFileSync(new URL(f, B), 'utf8'));
  const cat = readFileSync(new URL('../benchmark-data.js', B), 'utf8');
  const libelles = [
    ...lireJson('ansm-dispo.json').items.map((i) => i.spec),
    ...lireJson('rappels-lots.json').items.map((i) => i.t),
    ...lireJson('prix-futurs.json').changes.map((c) => c.d),
    ...[...cat.matchAll(/designation:"([^"]*)"/g)].map((m) => m[1]),
  ].filter(Boolean);
  assert.ok(libelles.length > 5000, 'marqueur positif : les vrais fichiers sont lus (' + libelles.length + ')');
  const mal = libelles.map((l) => [l, nomProduit(l)]).filter(([, n]) => !n || /undefined|null|NaN/.test(n) || /\b[A-Z]{4,}\b/.test(n));
  assert.deepEqual(mal.slice(0, 5), [], mal.length + ' noms mal écrits');
  // le dosage n'est plus collé dans les libellés du JO (ceux du panneau « prix qui changent »)
  assert.equal(nomProduit('BECLOME/FOR BGA 100/6MCG120D1+C'), 'Beclome/for Biogaran 100/6 µg');
  const colles = lireJson('prix-futurs.json').changes.map((c) => nomProduit(c.d)).filter((n) => /\d(mg|g|ml|mcg|µg|ui)\b|\b(zen|tvc|bga|eg|via|zyd|sdz)\d/i.test(n));
  assert.deepEqual(colles, []);
});

test('25/11 : stock chez nous sur plus de 3 sites → le total seul, pas la liste', () => {
  const sites = ['CPR', 'HP', 'MSP', 'OPS', 'POS', 'SEP', 'SOP'];
  const r = calculer(base({
    ventes: [{ cip: '3400900000001', mois: '2026-08', qte: 12 }],
    ansm: ansm([rupture(['3400900000001'])]),
    stockSites: () => sites.map((site) => ({ site, q: 10 })),
  }));
  assert.match(r.points[0].detail, /Chez nous : 70 boîtes\.$/);   // « sur 7 de nos sites » faisait encore 5 lignes (Izalgi, production 25/11)
});

// ─────────────── 25/11/2026 — les quatre corrections choisies par Will (constat ~/jarvis-preuves/infos-du-jour-verifs-2026-11-25) ───────────────
const STYLE_SRC = readFileSync(new URL('v2-brief-officine.js', B), 'utf8');

// Défaut 1 : PDF de 5 à 6 pages, dont 4 à 5 blanches — `visibility:hidden` gardait la place de la fiche.
test('25/11 (impression 1) : la feuille retire la fiche de la page au lieu de la rendre invisible', () => {
  const print = (STYLE_SRC.match(/'@media print\{[\s\S]*?\}\}';/) || [''])[0];
  assert.ok(print.length > 100, 'marqueur positif : la règle d\'impression est lue');
  assert.ok(!/visibility:hidden/.test(print), 'visibility:hidden garde la place de la fiche → pages blanches');
  assert.match(print, /body\.bo-imprime>\*:not\(#bo-ov\)\{display:none !important\}/);
  assert.match(print, /body\.bo-imprime #bo-ov\{position:static/);
  assert.ok(!/\.bo-plus\{display:none\}/.test(print), 'les listes repliées doivent s\'imprimer');
});

// Défauts 2 et 3 : la feuille ne disait pas de quelle officine il s'agit, et les listes repliées ne s'imprimaient pas
// alors que la feuille écrivait « 47 repliés plus bas ».
test('25/11 (impression 2, 3) : nom, CIP et date en tête de feuille ; listes ouvertes pour l\'impression puis refermées', async () => {
  const R = [cipA(1)], U = [10, 11, 12, 13, 14, 15].map(cipA);
  const ventes = [venteA(R[0], 8)];
  U.forEach((c) => [7, 8].forEach((m) => ventes.push(venteA(c, m))));
  const h = await panneauA({
    'rappels-lots.json': { generated: jourA(0), items: [{ d: jourA(-10), t: 'Produit rappelé', cips: R, lots: [{ n: 'L1' }] }] },
    'ansm-dispo.json': { generated: jourA(0), items: U.map((c) => ({ st: 'Rupture de stock', spec: 'Rupture ' + c, maj: frA(jourA(-1)), cips: [c] })) },
  }, ventes, [], { ville: 'Ville', cp: '44000', nom: 'Pharmacie <Essai>', cip: '2000016' });
  assert.match(h, /<p class="bo-feuille">Pharmacie &lt;Essai> · CIP 2000016 · <span class="bo-feuille-date"><\/span><\/p>/);
  assert.match(h, /<span class="pha-sub">4 points en tête, 3 repliés plus bas<\/span>/, 'à l\'écran : inchangé');
  assert.match(h, /<span class="pha-sub bo-papier">4 points en tête, 3 plus bas<\/span>/, 'sur la feuille : plus de « repliés »');
  // imprimer() : listes fermées ouvertes, date écrite, puis tout remis après l'impression
  const det = [{ open: false }, { open: false }], date = { textContent: '' }, ecoute = {}, classes = new Set();
  let imprime = 0;
  const ov = { querySelectorAll: (s) => (s === 'details.bo-plus:not([open])' ? det : []), querySelector: (s) => (s === '.bo-feuille-date' ? date : null) };
  const sb = charger({
    document: { getElementById: (id) => (id === 'bo-ov' ? ov : null), body: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } } },
    addEventListener: (n, f) => { ecoute[n] = f; }, removeEventListener: (n) => { delete ecoute[n]; },
    print: () => { imprime++; assert.deepEqual(det.map((d) => d.open), [true, true], 'listes ouvertes AU MOMENT d\'imprimer'); assert.ok(classes.has('bo-imprime')); },
  });
  sb.V2.briefOfficine.imprimer();
  assert.equal(imprime, 1);
  assert.match(date.textContent, /^imprimé le \d{2}\/\d{2}\/\d{4}$/);
  ecoute.afterprint();
  assert.deepEqual(det.map((d) => d.open), [false, false], 'refermées après l\'impression');
  assert.ok(!classes.has('bo-imprime'));
});

// Défaut 4 : boîte de 30 et boîte de 90 au même titre, avec deux prix (Liptruzet 10 mg/10 mg, Ezetimib/ator. Zentiva, officine 2003659).
test('25/11 (boîtes) : « boîte de 30 / 90 » seulement quand deux lignes portent le même nom', () => {
  const pf = JSON.parse(readFileSync(new URL('prix-futurs.json', B), 'utf8'));
  const deux = pf.changes.filter((c) => ['3400930284605', '3400930284612'].includes(String(c.c)));
  assert.equal(deux.length, 2, 'marqueur positif : les deux boîtes Zentiva sont dans le fichier du jour');
  const seul = { c: '3400900000009', d: 'LIPTRUZET 10MG/20MG CPR BT30', sens: 'baisse', date_effet: '2027-01-02', date_publi: '2026-10-20', ppttc: 17.16, ancien_ttc: 19.6 };
  const ventes = [...deux.map((c) => String(c.c)), seul.c].map((cip) => ({ cip, mois: '2026-10', qte: 20 }));
  const r = calculer(base({ aujourdhui: '2026-11-25', moisCouverts: ['2026-08', '2026-09', '2026-10'], ventes, prixFuturs: { generated: '2026-11-25', changes: [...deux, seul] } }));
  const titres = [...r.points.concat(r.autres).map((p) => p.titre)].sort();
  assert.deepEqual(titres, [
    'Baisse le 02/01/2027 : Ezetimib/ator. Zentiva 10/10 mg, boîte de 30',
    'Baisse le 02/01/2027 : Ezetimib/ator. Zentiva 10/10 mg, boîte de 90',
    'Baisse le 02/01/2027 : Liptruzet 10 mg/20 mg',
  ]);
  assert.ok(r.points.concat(r.autres).every((p) => !('brut' in p)), 'le libellé brut ne sort pas de calculer()');
});

test('25/11 (boîtes) : sur TOUT le fichier du JO, plus aucun titre en double quand la boîte se lit', () => {
  const pf = JSON.parse(readFileSync(new URL('prix-futurs.json', B), 'utf8'));
  const changes = pf.changes.filter((c) => c.date_effet >= '2026-11-25');
  const ventes = [...new Set(changes.map((c) => String(c.c)))].map((cip) => ({ cip, mois: '2026-10', qte: 20 }));
  const r = calculer(base({ aujourdhui: '2026-11-25', moisCouverts: ['2026-08', '2026-09', '2026-10'], ventes, prixFuturs: { generated: '2026-11-25', changes } }));
  const tous = r.points.concat(r.autres);
  assert.ok(tous.length >= 50, 'marqueur positif : les changements du JO sont lus (' + tous.length + ')');
  assert.ok(tous.some((p) => /, boîte de \d+$/.test(p.titre)), 'au moins un titre départagé');
  const parCip = {};
  changes.forEach((c) => { parCip[c.c] = c; });
  const vus = {};
  tous.forEach((p) => { vus[p.titre] = (vus[p.titre] || 0) + 1; });
  const doubles = Object.keys(vus).filter((t) => vus[t] > 1);
  // un double qui reste = même produit, même boîte, même date (deux CIP pour une même présentation) : la boîte ne départage pas
  assert.ok(doubles.every((t) => !/, boîte de /.test(t)) || doubles.length === 0, 'doubles : ' + doubles.join(' | '));
  assert.ok(doubles.length <= 3, doubles.length + ' titres encore en double : ' + doubles.join(' | '));
});

// Défaut 5 : « 19,6 € » recopié du fichier (13 anciens et 12 nouveaux prix sur 110 écrits avec un seul chiffre après la virgule).
test('25/11 (prix) : toujours deux chiffres après la virgule, sur tout le fichier du JO', () => {
  const pf = JSON.parse(readFileSync(new URL('prix-futurs.json', B), 'utf8'));
  const changes = pf.changes.filter((c) => c.date_effet >= '2026-11-25');
  const ventes = [...new Set(changes.map((c) => String(c.c)))].map((cip) => ({ cip, mois: '2026-10', qte: 20 }));
  const r = calculer(base({ aujourdhui: '2026-11-25', moisCouverts: ['2026-08', '2026-09', '2026-10'], ventes, prixFuturs: { generated: '2026-11-25', changes } }));
  const details = [...r.points.concat(r.autres).map((p) => p.detail)];
  assert.ok(details.some((d) => /19,60 € → 17,16 € TTC/.test(d)), 'marqueur positif : Liptruzet boîte de 30');
  const mal = details.filter((d) => /\d,\d €|\d € →|\d € TTC/.test(d.replace(/\d,\d\d €/g, '')));
  assert.deepEqual(mal, []);
});

// Défaut 6 : « Dacudoses opht unidos10ml 24 » (2281324), et une même chose écrite de deux façons selon la source.
test('25/11 (noms) : noms restés bruts remis au format ; LP, %, U/ml écrits d\'une seule façon', () => {
  const { nomProduit } = charger().V2.briefOfficine;
  assert.equal(nomProduit('DACUDOSES OPHT UNIDOS10ML 24'), 'Dacudoses');
  assert.equal(nomProduit('Skiacol 0,5 pour cent, collyre – [cyclopentolate (chlorhydrate de)]'), 'Skiacol 0,5 %');
  assert.equal(nomProduit('SKIACOL 0,5% COLLY FL0,5ML'), 'Skiacol 0,5 %');
  assert.equal(nomProduit('Micropakine L.P. 500 mg, granulés à libération prolongée en sachet-dose'), 'Micropakine LP 500 mg');
  assert.equal(nomProduit('MICROPAKINE LP 500MG GLE S.30'), 'Micropakine LP 500 mg');
  assert.equal(nomProduit('Lantus Solostar 100 unités/ ml, solution injectable en stylo prérempli – [insuline glargine]'), 'Lantus Solostar 100 U/ml');
  assert.equal(nomProduit('LANTUS 100U/ML INJ SOLO3ML 5'), 'Lantus 100 U/ml');
  assert.equal(nomProduit('VENLAFAXINE BGA LP75MG GEL B30'), 'Venlafaxine Biogaran LP 75 mg');
  assert.equal(nomProduit('ENGERIX B 20MCG SRG.BACK.1ML 1'), 'Engerix B 20 µg', 'la boîte après un point reste coupée');
});

// ── 25/11/2026 (Will) — les cinq points choisis après l'impression ──
test('25/11 (titres) : « Baisse le … » et « Hausse le … », sans « de prix »', () => {
  const ventes = ['3400900000001', '3400900000002'].map((cip) => ({ cip, mois: '2026-08', qte: 5 }));
  const ch = (c, d, sens, ppttc) => ({ c, d, sens, date_effet: '2026-10-01', date_publi: '2026-09-15', ppttc, ancien_ttc: 10 });
  const r = calculer(base({ ventes, prixFuturs: { generated: '2026-09-17', changes: [ch('3400900000001', 'DOLIPRANE 1000MG CPR BT8', 'baisse', 5), ch('3400900000002', 'SPASFON 80MG CPR BT30', 'hausse', 12)] } }));
  assert.deepEqual(Array.from(r.points, (p) => p.titre).sort(), ['Baisse le 01/10/2026 : Doliprane 1000 mg', 'Hausse le 01/10/2026 : Spasfon 80 mg']);
});

test('25/11 (accents) : repris des noms de l\'ANSM, jamais devinés', () => {
  const { nomProduit } = charger().V2.briefOfficine;
  assert.equal(nomProduit('KETOPROFENE ZEN LP100MG GELU BT20'), 'Kétoprofène Zentiva LP 100 mg');
  assert.equal(nomProduit('PARACETAMOL BGA 1G CPR BT8'), 'Paracétamol Biogaran 1 g');
  assert.equal(nomProduit('Kétoprofène Pharmy II 100 mg, gélule'), 'Kétoprofène Pharmy II 100 mg', 'déjà accentué : inchangé');
  const masque = nomProduit('MASQUE PRO ACTIVE TEX FFP2 BT 10');
  assert.match(masque, /^Masque PRO active /, 'un « é » final seul ne se recopie pas (charbon activé) : ' + masque);
  // le chemin du jour : un nom que seule l'ANSM du jour accentue, et deux pièges
  const ventes = ['3400900000001', '3400900000002', '3400900000003'].map((cip) => ({ cip, mois: '2026-08', qte: 5 }));
  const ch = (c, d) => ({ c, d, sens: 'baisse', date_effet: '2026-10-01', date_publi: '2026-09-15', ppttc: 5, ancien_ttc: 10 });
  const fiche = (spec, dci) => ({ st: 'Rupture de stock', spec, dci, maj: '16/09/2026', cips: ['3400900000009'] });
  const r = calculer(base({ ventes,
    ansm: ansm([fiche('Zébrine 5 mg, granulés en sachet – [zébrinol]', 'zébrinol'), fiche('Qualine Arrow 5 mg'), fiche('Qualiné 2 mg'), fiche('Toxicarb, suspension – [charbon activé]', 'charbon activé')]),
    prixFuturs: { generated: '2026-09-17', changes: [ch('3400900000001', 'ZEBRINE 5MG CPR BT30'), ch('3400900000002', 'QUALINE 5MG CPR BT30'), ch('3400900000003', 'CHARBON ACTIVE GRANULES 100G')] } }));
  assert.deepEqual(Array.from(r.points.concat(r.autres), (p) => p.titre).sort(), [
    'Baisse le 01/10/2026 : Charbon active granules 100 g',   // « granulés » est dans la forme, « activé » n'a qu'un é final
    'Baisse le 01/10/2026 : Qualine 5 mg',                     // deux écritures à l'ANSM : rien de recopié
    'Baisse le 01/10/2026 : Zébrine 5 mg',
  ]);
});

test('25/11 (accents) : sur tout le catalogue et le JO, aucun mot accentué à tort ni libellé cassé', () => {
  const sb = charger();
  vm.runInContext(readFileSync(new URL('../benchmark-data.js', B), 'utf8') + ';window.BENCHMARK = BENCHMARK;', sb);
  const { nomProduit } = sb.V2.briefOfficine;
  const pf = JSON.parse(readFileSync(new URL('prix-futurs.json', B), 'utf8'));
  const libs = [...new Set(sb.BENCHMARK.map((b) => b.designation).filter(Boolean).concat(pf.changes.map((c) => c.d || '')))];
  assert.ok(libs.length > 10000, 'marqueur positif : le catalogue est lu (' + libs.length + ')');
  const sans = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const accent = /[à-öø-ÿ]/i;
  let accentues = 0;
  const casse = [], pieges = [];
  libs.forEach((l) => {
    const n = nomProduit(l);
    if (accent.test(n) && !accent.test(l)) accentues++;
    if (!n || /undefined|\s$/.test(n) || sans(n).toLowerCase() !== sans(n).toLowerCase().normalize('NFC')) casse.push(l + ' → ' + n);
    if (/activé|granulés|téva|théa/i.test(n) && !/activé|granulés|téva|théa/i.test(l)) pieges.push(l + ' → ' + n);
  });
  assert.ok(accentues >= 300, 'marqueur positif : les libellés du relevé prennent leurs accents (' + accentues + ')');
  assert.ok(casse.length <= 20, casse.length + ' libellés vides ou cassés : ' + casse.slice(0, 5).join(' | '));
  assert.deepEqual(pieges, []);
});

test('25/11 (Izalgi) : « Pas commandé » et « En tension » du même produit = une seule ligne qui dit les deux', () => {
  const C = '3400949605538';
  const ventes = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'].map((mois) => ({ cip: C, mois, qte: 30 }))
    .concat([{ cip: '3400900000001', mois: '2026-08', qte: 1 }]);
  const r = calculer(base({
    ventes,
    nom: (c) => (c === C ? 'IZALGI 500MG/25MG GELU BT16' : ''),
    ansm: ansm([{ st: "Tension d'approvisionnement", spec: "Izalgi 500 mg/25 mg, gélule – [opium (poudre d'), paracétamol]", maj: '22/05/2026', since: '2025-10-01', cips: [C, '3400955003182'] }]),
    stockSites: (c) => (c === C ? [{ site: 'CPR', q: 10 }] : []),
  }));
  const tous = r.points.concat(r.autres);
  const iz = tous.filter((p) => /Izalgi/.test(p.titre));
  assert.equal(iz.length, 1, 'une seule ligne : ' + iz.map((p) => p.titre).join(' | '));
  assert.equal(iz[0].rubrique, 'Ses achats');
  assert.equal(iz[0].titre, 'Pas commandé en août 2026 : Izalgi 500 mg/25 mg, en tension');
  assert.equal(iz[0].detail, 'Commandé 5 mois sur les 5 précédents (150 boîtes au total).', 'sans retour ni stock : la ligne tient en 4 lignes');
  assert.equal(iz[0].pourquoi, 'ANSM · 22/05/2026');
  assert.ok(!tous.some((p) => p.rubrique === 'Va manquer'), 'le point ANSM s\'est effacé');
  assert.ok(tous.every((p) => !['cips', 'cip', 'etat'].some((k) => k in p)), 'aucun champ de travail ne sort de calculer()');
});

test('25/11 (anciennes) : une tension que l\'ANSM n\'a pas mise à jour depuis plus d\'un an est repliée, avec « depuis »', () => {
  const cips = ['3400900000001', '3400900000002', '3400900000003', '3400900000004'];
  const ventes = cips.map((cip, i) => ({ cip, mois: '2026-08', qte: i === 0 ? 100 : 10 - i }));
  const items = cips.map((c, i) => ({ st: "Tension d'approvisionnement", spec: 'Produit ' + 'QRST'[i] + ' 1 mg', maj: i === 0 ? '07/11/2023' : '16/09/2026', since: i === 0 ? '2023-10-06' : '2026-09-01', cips: [c] }));
  const r = calculer(base({ ventes, ansm: ansm(items) }));
  assert.deepEqual(Array.from(r.points, (p) => p.titre), ['En tension : Produit R 1 mg', 'En tension : Produit S 1 mg', 'En tension : Produit T 1 mg'],
    'les 3 places vont aux tensions récentes, même si l\'ancienne pèse plus lourd dans ses achats');
  assert.deepEqual(Array.from(r.autres, (p) => p.titre), ['En tension depuis oct. 2023 : Produit Q 1 mg']);
});

test('25/11 (anciennes) : sur le vrai fichier de l\'ANSM, aucune fiche de plus d\'un an en tête, toutes repliées avec « depuis »', () => {
  const a = JSON.parse(readFileSync(new URL('ansm-dispo.json', B), 'utf8'));
  const auj = a.generated.slice(0, 10);
  const fr = (d) => d.split('/').reverse().join('-');
  const items = a.items.filter((it) => (it.st === 'Rupture de stock' || it.st === "Tension d'approvisionnement") && it.cips && it.cips.length);
  const vieilles = items.filter((it) => (Date.parse(auj) - Date.parse(fr(it.maj))) / 864e5 > 365);
  assert.ok(vieilles.length >= 5, 'marqueur positif : des fiches de plus d\'un an existent (' + vieilles.length + ')');
  const ventes = items.map((it) => ({ cip: it.cips[0], mois: '2026-10', qte: 5 }));
  const r = calculer(base({ aujourdhui: auj, moisCouverts: ['2026-08', '2026-09', '2026-10'], ventes, ansm: a }));
  assert.ok(r.points.filter((p) => p.rubrique === 'Va manquer').every((p) => !/ depuis /.test(p.titre)), 'une ancienne est en tête');
  assert.equal(r.autres.filter((p) => /^(En rupture|En tension) depuis [a-zéû.]+ \d{4} : /.test(p.titre)).length, vieilles.length);
});

test('25/11 (sources) : répertoire des génériques à jour jusqu\'à 35 jours (il sort une fois par mois)', () => {
  const s = (g) => Array.from(calculer(base({ aujourdhui: '2026-11-25', generiques: { generated: g, princepsWithGeneric: [] } })).sources).filter((x) => x.cle === 'generiques')[0];
  assert.equal(s('2026-11-02').aJour, true, '23 jours après la sortie du 2 : pas en retard');
  assert.equal(s('2026-10-20').aJour, false, '36 jours : en retard');
});

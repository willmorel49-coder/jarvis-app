// Calcul « Potentiel d'un secteur » (29/10/2026) : cas faits à la main, puis recoupements sur les vraies données du dépôt.
import fs from 'fs';
import vm from 'vm';
import { performance } from 'perf_hooks';

const CRM = new URL('../crm/v2/', import.meta.url).pathname;
const lire = (f) => fs.readFileSync(f, 'utf8');
let echecs = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK     ' : 'ECHEC  ') + msg); if (!cond) echecs++; };

function contexte(fichiers) {
  const c = {}; c.window = c; vm.createContext(c);
  for (const f of fichiers) vm.runInContext(lire(f), c, { filename: f });
  return c;
}

// ───────── 0. Cas fait à la main (jeu de données minuscule, réponse connue) ─────────
{
  const c = {}; c.window = c; vm.createContext(c);
  const dLat = (km) => km / 111.19;
  // Point d'essai (47, 0). Quartier A au point, B à 3 km au nord, C à 12 km au nord. Contours = carrés (règle du 29/10/2026 : une officine compte si elle est DANS un quartier de la zone).
  const sq = (id, lat0, lat1, lng0, lng1) => ({ type: 'Feature', properties: { code_iris: id }, geometry: { type: 'Polygon', coordinates: [[[lng0, lat0], [lng1, lat0], [lng1, lat1], [lng0, lat1], [lng0, lat0]]] } });
  c.POTENTIEL_SECTEUR = { meta: { depts: ['49'] }, iris: [
    ['A', 'a', 'x', '49', 47, 0, 1000, 100, 600, 200, 100, 50000],
    ['B', 'b', 'x', '49', 47 + dLat(3), 0, 500, 50, 300, 100, 50, 20000],
    ['C', 'c', 'x', '49', 47 + dLat(12), 0, 200, 20, 100, 50, 30, 9000]],
    geo: { type: 'FeatureCollection', features: [sq('A', 46.98, 47.0215, -0.03, 0.03), sq('B', 47.0225, 47.0405, -0.03, 0.03), sq('C', 47.1, 47.115, -0.03, 0.03)] } };
  // Officines : à 0,5 km (dans A), à 4 km (dans B), à 30 km (à 18 km de tout centre : rattachée à rien). Point = [lat,lng,uga,grp,seg,comm,nom,ville,cp,tel,titulaire,email,ca,id]
  const off = (km, id, seg) => [47 + dLat(km), 0, 0, 0, seg, 0, 'n', 'v', '49000', '', '', '', 999999, id];
  c.PHARMA_FR = { seg: ['Prospect', 'Client A', 'Non défini'], p: [off(0.5, 'o1', 1), off(4, 'o2', 0), off(30, 'o3', 0)] };
  vm.runInContext(lire(CRM + 'v2-potentiel-secteur.js'), c);
  const P = c.V2.potentielSecteur;
  let z = P.zone(47, 0, 0);
  ok(z.pop === 0 && z.nbOff === 0 && z.marche === 0 && z.quartiers.length === 0, 'main/rayon 0 : tout vaut 0');
  z = P.zone(47, 0, 5);
  ok(z.pop === 1500 && z.nbOff === 2 && z.habParOff === 750 && z.marche === 70000 && z.marcheParOff === 35000, 'main/rayon 5 km : 1500 hab., 2 officines, 750 hab./off., marché 70 000, 35 000/off. (obtenu ' + z.pop + '/' + z.nbOff + '/' + z.habParOff + '/' + z.marche + ')');
  ok(z.pop80p === 150 && Math.abs(z.part80 - 0.1) < 1e-12, 'main : 80 ans et + = 150 soit 10 %');
  ok(z.nbClients === 1 && z.nbProspects === 1, 'main : 1 client et 1 prospect dans le rayon');
  z = P.zone(47, 0, 2);
  ok(z.pop === 1000 && z.nbOff === 1 && z.habParOff === 1000, 'main/rayon 2 km : seul le quartier A et une officine');
  z = P.zone(47 + dLat(30), 0, 5);
  ok(z.pop === 0 && z.nbOff === 0 && z.habParOff === null && z.aucuneOfficine === true && z.echelle.libelle === 'sans donnée', 'main : zone vide → « sans donnée », pas de division par zéro');
  z = P.zone(47 + dLat(12), 0, 1);
  ok(z.pop === 200 && z.nbOff === 0 && z.aucuneOfficine === true && z.echelle.libelle === 'aucune officine' && z.echelle.couleur === '#B01532', 'main : habitants mais aucune officine → « aucune officine » en rouge foncé');
  ok(!JSON.stringify(P.zone(47, 0, 5)).includes('999999'), 'main : le champ ca (999999) ne sort jamais');
  const q = P.quartier('B', 0.5);
  ok(q && q.pop === 500 && q.nbOff === 1 && q.officines[0] === 'o2', 'main : quartier(B, 0,5 km) = B seul, avec SON officine o2 (située dans B à 4 km du point, hors du disque : règle du 29/10)');
  ok(P.quartier('inconnu', 5) === null, 'main : quartier inconnu → null');
  // échelle : mêmes seuils que v2-carte.js
  const e = (h) => P.echelle(h).couleur;
  ok(e(4200) === '#B01532' && e(4199.4) === '#E8546A' && e(3400) === '#E8546A' && e(3399) === '#FBD08A' && e(2800) === '#FBD08A' && e(2799) === '#9FD9B5' && e(2200) === '#9FD9B5' && e(2199) === '#2E9E66', 'échelle : seuils 4 200 / 3 400 / 2 800 / 2 200 respectés');
  // ── Officine dans une fente (aucun contour), cas fait à la main ──
  {
    const c2 = {}; c2.window = c2; vm.createContext(c2);
    // D : carré lat 47,000–47,020 ; E : carré lat 47,0225–47,0425 ; la fente entre les deux = 47,020–47,0225 (~280 m). Centres : D (47,015), E (47,0275).
    c2.POTENTIEL_SECTEUR = { meta: { depts: ['49'] }, iris: [
      ['D', 'd', 'x', '49', 47.015, 0, 1000, 0, 0, 0, 0, 10], ['E', 'e', 'x', '49', 47.0275, 0, 400, 0, 0, 0, 0, 4]],
      geo: { type: 'FeatureCollection', features: [sq('D', 47.0, 47.020, -0.03, 0.03), sq('E', 47.0225, 47.0425, -0.03, 0.03)] } };
    const o = (lat, id) => [lat, 0, 0, 0, 2, 0, 'n', 'v', '49000', '', '', '', 1, id];
    // fente1 : dans la fente, centre de E à 0,67 km, de D à 0,72 km → E ; fente2 : dans la fente, à 0,57 km du centre de D → D ; loin : à 49 km ; bord5km : à 5 km au-delà de E, centre de E à 6,7 km → repli « le plus proche »
    c2.PHARMA_FR = { seg: ['Prospect', 'Client A', 'Non défini'], p: [o(47.0215, 'fente1'), o(47.0201, 'fente2'), o(47.5, 'loin'), o(47.0425 + 5 / 111.19, 'bord5km')] };
    vm.runInContext(lire(CRM + 'v2-potentiel-secteur.js'), c2);
    const P2 = c2.V2.potentielSecteur, dg = P2.diagnostic();
    ok(dg.dansContour === 0 && dg.nonRattachees === 1, 'fente : l\'officine à 49 km de tout est rattachée à rien (' + JSON.stringify(dg) + ')');
    const zD = P2.zone(47.015, 0, 0.5), zE = P2.zone(47.0275, 0, 0.5);
    ok(zD.pop === 1000 && zE.pop === 400, 'fente : rayon 0,5 km autour du centre de D = D seul, autour de E = E seul');
    ok(zE.officines.includes('fente1') && !zD.officines.includes('fente1'), 'fente : l\'officine de la fente la plus proche du centre de E (0,67 km contre 0,72 km) compte avec E, pas avec D (centre le plus proche)');
    ok(zD.officines.includes('fente2') || zE.officines.includes('fente2'), 'fente : l\'autre officine de la fente est comptée quelque part (jamais perdue)');
    ok(zD.nbOff + zE.nbOff === 3 && !zD.officines.includes('loin') && !zE.officines.includes('loin'), 'fente : 3 officines rattachées (2 fentes + 1 repli à 5 km), la lointaine jamais comptée (obtenu ' + (zD.nbOff + zE.nbOff) + ')');
    ok(dg.repliPlusProche === 1 && dg.repli1km === 2, 'fente : diagnostic = 2 replis ≤ 1 km + 1 repli au plus proche (>1 km) (obtenu ' + dg.repli1km + ' / ' + dg.repliPlusProche + ')');
    // l'officine autour de laquelle on calcule est toujours dans la zone, même si le centre de son quartier est hors du disque
    const zF = P2.zone(47.0215, 0, 0.2);
    ok(zF.officines.includes('fente1') && zF.nbOff >= 1, 'fente : zone() autour de l\'officine de la fente (rayon 0,2 km, centre du quartier à 0,67 km) contient bien cette officine');
  }
}

// ───────── Données réelles ─────────
const C = contexte([CRM + 'pharma-fr-data.js', CRM + 'potentiel-secteur-data.js', CRM + 'v2-potentiel-secteur.js']);
const DATA = C.POTENTIEL_SECTEUR, PHARMA = C.PHARMA_FR, P = C.V2.potentielSecteur;
const DEPS = DATA.meta.depts;

// brute force indépendant (haversine, boucle sur tout) pour recouper le module
const R = 6371.0088;
const hav = (a, b, c, d) => { const t = Math.PI / 180, dp = (c - a) * t, dl = (d - b) * t; const h = Math.sin(dp / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
// Rattachement des officines des 8 départements, par force brute INDÉPENDANTE du module (boucle sur les 3 676 contours, haversine pour les replis)
const pipRing = (x, y, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const pipFeat = (f, x, y) => { const mp = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; return mp.some((pg) => pipRing(x, y, pg[0]) && !pg.slice(1).some((h) => pipRing(x, y, h))); };
const codeVersIdx = new Map(DATA.iris.map((q, k) => [q[0], k]));
const attache = new Map();   // indice PHARMA_FR → indice quartier (force brute)
for (let n = 0; n < PHARMA.p.length; n++) {
  const p = PHARMA.p[n]; if (!DEPS.includes(String(p[8]).slice(0, 2)) || (p[0] === 0 && p[1] === 0)) continue;
  let q = -1;
  for (const f of DATA.geo.features) { if (pipFeat(f, p[1], p[0])) { q = codeVersIdx.get(f.properties.code_iris); break; } }
  if (q < 0) { let bd = 1e9; DATA.iris.forEach((i, k) => { const d = hav(p[0], p[1], i[4], i[5]); if (d < bd) { bd = d; q = k; } }); if (bd > 10) q = -1; }
  if (q >= 0) attache.set(n, q);
}
const depDe = new Map(PHARMA.p.map((p) => [p[13], String(p[8]).slice(0, 2)]));
const nb8 = (z) => z.officines.filter((id) => DEPS.includes(depDe.get(id))).length;   // le module peut aussi rattacher des officines voisines hors des 8 départements
function brute(lat, lng, r) {
  let pop = 0, marche = 0, n = 0; const set = new Set();
  DATA.iris.forEach((i, k) => { if (hav(lat, lng, i[4], i[5]) < r) { pop += i[6]; marche += i[11]; set.add(k); } });
  for (const q of attache.values()) if (set.has(q)) n++;
  return { pop, marche, q: set.size, n, set };
}

// ───────── 1. Rayon 0 ─────────
{
  const i = DATA.iris[1000];
  const z = P.zone(i[4], i[5], 0);
  ok(z.pop === 0 && z.nbOff === 0 && z.marche === 0 && z.quartiers.length === 0, 'réel/rayon 0 : tout vaut 0');
}

// ───────── 2. Quartier isolé (commune rurale du 53, rayon 1 km) : réponse recoupée à la main ─────────
const rurales53 = DATA.iris.filter((i) => i[3] === '53' && i[0].endsWith('0000') && i[6] > 0).sort((a, b) => a[6] - b[6]);
const rural = rurales53[Math.floor(rurales53.length / 2)];
{
  const z = P.quartier(rural[0], 1);
  const b = brute(rural[4], rural[5], 1);
  const autresProches = DATA.iris.filter((i) => i[0] !== rural[0] && hav(rural[4], rural[5], i[4], i[5]) < 1).length;
  ok(autresProches === 0, 'quartier isolé (' + rural[2] + ') : aucun autre centre de quartier à moins de 1 km (recompté : ' + autresProches + ')');
  ok(z.pop === rural[6] && z.marche === rural[11], 'quartier isolé : pop = celle du quartier (' + rural[6] + ') et marché = celui du quartier');
  ok(nb8(z) === b.n, 'quartier isolé : officines de la zone = comptage indépendant par contour (' + nb8(z) + ' = ' + b.n + ')');
}

// ───────── 2 bis. Recoupement sur 300 points tirés au hasard (graine fixe) × 3 rayons ─────────
{
  let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  let ecartPop = 0, ecartOff = 0, ecartSet = 0, essais = 0;
  for (let k = 0; k < 300; k++) {
    const i = DATA.iris[Math.floor(rnd() * DATA.iris.length)];
    for (const r of [2, 5, 10]) {
      const z = P.zone(i[4], i[5], r), b = brute(i[4], i[5], r);
      essais++;
      if (Math.abs(z.pop - b.pop) / Math.max(1, b.pop) > 0.002) ecartPop++;
      const memeSet = z.quartiers.length === b.q && z.quartiers.every((c) => b.set.has(codeVersIdx.get(c)));
      if (!memeSet) ecartSet++; else if (nb8(z) !== b.n) ecartOff++;   // mêmes quartiers → les officines doivent être EXACTEMENT les mêmes
    }
  }
  // le module projette à plat (équirectangulaire), le brute force est en haversine : un écart d'un quartier/officine en bordure est admis
  ok(ecartPop <= essais * 0.02 && ecartSet <= essais * 0.02 && ecartOff === 0, 'module = brute force (haversine + contours) sur ' + essais + ' zones (population >0,2 % : ' + ecartPop + ' ; quartiers différents en bordure : ' + ecartSet + ' ; mêmes quartiers mais officines différentes : ' + ecartOff + ')');
}

// ───────── 2 ter. Cas La Brière (Saint-André-des-Eaux, 44) : le défaut trouvé le 29/10 ─────────
{
  const bri = PHARMA.p.find((p) => /BRIERE/i.test(p[6]) && /ANDRE DES EAUX/i.test(p[7]));
  const z5 = P.zone(bri[0], bri[1], 5), z10 = P.zone(bri[0], bri[1], 10), z2 = P.zone(bri[0], bri[1], 2);
  console.log('La Brière : 2 km ' + Math.round(z2.habParOff) + ' (' + z2.nbOff + ' off.) · 5 km ' + Math.round(z5.pop) + ' hab., ' + z5.nbOff + ' off., ' + Math.round(z5.habParOff) + ' hab./off. · 10 km ' + Math.round(z10.habParOff) + ' (' + z10.nbOff + ' off.) [avant : 5 km 18 502 hab. pour 1 officine]');
  ok(z5.officines.includes(bri[13]) && z2.officines.includes(bri[13]), 'La Brière : elle est dans sa propre zone (2 et 5 km)');
  // Le point cité dans le défaut (47,325 / -2,31, à 0,0003° de l'officine) : 5 quartiers, dont celui de Saint-Nazaire qui apportait sa population sans ses officines.
  const zb5 = P.zone(47.325, -2.31, 5), zb10 = P.zone(47.325, -2.31, 10);
  console.log('Point du défaut (47,325 / -2,31) : 5 km ' + Math.round(zb5.pop) + ' hab., ' + zb5.nbOff + ' off., ' + Math.round(zb5.habParOff) + ' hab./off. · 10 km ' + Math.round(zb10.habParOff) + ' [avant : 18 502 hab., 1 officine]');
  ok(zb5.nbOff >= 3 && zb5.habParOff < 5000, 'point du défaut : 5 km = ' + Math.round(zb5.habParOff) + ' hab./officine avec ' + zb5.nbOff + ' officines (avant : 1 officine, 18 502)');
  ok(zb5.habParOff / zb10.habParOff > 0.7 && zb5.habParOff / zb10.habParOff < 1.4, 'point du défaut : 5 km (' + Math.round(zb5.habParOff) + ') plausible face à 10 km (' + Math.round(zb10.habParOff) + ') : rapport ' + (zb5.habParOff / zb10.habParOff).toFixed(2) + ' entre 0,7 et 1,4');
  ok(z5.nbOff >= 2, 'La Brière (coordonnées exactes) : 5 km = ' + z5.nbOff + ' officines (avant : 1) — LIMITE CONNUE : ' + Math.round(z5.habParOff) + ' hab./officine, car la zone n\'est plus que 4 quartiers (Le Guézy, 4 873 hab., n\'a aucune officine DANS son contour) ; voir rapport-correctif.md');
  // le défaut tel qu\'il était : chaque quartier de la zone, ses officines sont toutes comptées (aucun quartier ne « perd » ses officines)
  const perdues = z5.quartiers.filter((c) => { const k = codeVersIdx.get(c); return [...attache.entries()].some(([n, q]) => q === k && !z5.officines.includes(PHARMA.p[n][13])); }).length;
  ok(perdues === 0, 'La Brière : aucun des ' + z5.quartiers.length + ' quartiers de la zone n\'a d\'officine laissée dehors');
}

// ───────── 3. Population des 8 départements vs DEP_POP de v2-carte.js (± 3 %) ─────────
const carte = lire(CRM + 'v2-carte.js');
const DEP_POP = JSON.parse(carte.match(/var DEP_POP=(\{[^}]*\});/)[1]);
const parDept = {};
for (const i of DATA.iris) { const d = (parDept[i[3]] = parDept[i[3]] || { n: 0, pop: 0, marche: 0, sansPop: 0 }); d.n++; d.pop += i[6]; d.marche += i[11]; if (!i[6]) d.sansPop++; }
let popTot = 0, popTotLegale = 0, marcheTot = 0, nTot = 0;
const lignesDep = [];
for (const d of DEPS) {
  const e = parDept[d], legale = DEP_POP[d], ecart = (e.pop - legale) / legale * 100;
  popTot += e.pop; popTotLegale += legale; marcheTot += e.marche; nTot += e.n;
  lignesDep.push({ dep: d, quartiers: e.n, pop: e.pop, DEP_POP: legale, ecartPct: Math.round(ecart * 100) / 100, marche: e.marche, quartiersSansPop: e.sansPop });
  ok(Math.abs(ecart) <= 3, 'dép. ' + d + ' : population ' + e.pop + ' vs DEP_POP ' + legale + ' (' + ecart.toFixed(2) + ' %)');
}
ok(Math.abs((popTot - popTotLegale) / popTotLegale) <= 0.03, '8 départements : ' + popTot + ' vs ' + popTotLegale + ' (' + ((popTot - popTotLegale) / popTotLegale * 100).toFixed(2) + ' %)');
ok(nTot === DATA.meta.n, 'nombre de quartiers du fichier = meta.n (' + nTot + ')');
ok(!JSON.stringify(DATA.meta).includes('"ca"'), 'données sans champ ca');
// compteur à 0 re-testé : il doit rendre autre chose que 0 sur un cas où l'on sait
ok(DATA.iris.filter((i) => i[6] > 0).length > 3000 && DATA.geo.features.length === DATA.iris.length, 'contrôle du compteur : quartiers avec population > 3000 et un contour par quartier (' + DATA.geo.features.length + ')');

// ───────── 4. Temps de calcul ─────────
const t0 = performance.now(); P.zone(47.47, -0.55, 5); const tFroid = performance.now() - t0;
let s2 = 777; const rnd2 = () => (s2 = (s2 * 1103515245 + 12345) % 2147483648) / 2147483648;
const t1 = performance.now(); const N = 2000;
for (let k = 0; k < N; k++) { const i = DATA.iris[Math.floor(rnd2() * DATA.iris.length)]; P.zone(i[4], i[5], 5); }
const tZone = (performance.now() - t1) / N;
// « tous les prospects » : la segmentation réelle est protégée (illisible ici). Pire cas simulé : TOUTES les officines des 8 départements traitées comme prospects.
const secteur = P.officinesSecteur();
const t2 = performance.now(); let somme = 0;
for (const o of secteur) somme += P.zone(o.lat, o.lng, 5).marcheParOff || 0;
const tTous = performance.now() - t2;
const t3 = performance.now(); const moy5 = P.moyenneSecteur(5); const tMoy = performance.now() - t3;
ok(secteur.length > 1000 && somme > 0, 'officines des 8 départements : ' + secteur.length + ' (compteur > 0 ; somme des marchés par officine > 0)');
ok(tTous < 1000, 'calcul des ' + secteur.length + ' officines/prospects (rayon 5 km) : ' + tTous.toFixed(0) + ' ms (< 1 s)');
ok(tZone < 5, 'une zone de 5 km : ' + tZone.toFixed(3) + ' ms en moyenne sur ' + N + ' (1er appel, index compris : ' + tFroid.toFixed(0) + ' ms)');

// ───────── 5. Trois points réels ─────────
function fiche(nom, lat, lng, extra) {
  const o = Object.assign({ nom, lat, lng }, extra || {});
  for (const r of [2, 5, 10]) {
    const z = P.zone(lat, lng, r);
    o['r' + r] = { pop: Math.round(z.pop), part80: Math.round(z.part80 * 1000) / 10, nbOff: z.nbOff, habParOff: z.habParOff === null ? null : Math.round(z.habParOff), marche: Math.round(z.marche), marcheParOff: z.marcheParOff === null ? null : Math.round(z.marcheParOff), echelle: z.echelle.libelle, quartiers: z.quartiers.length };
  }
  return o;
}
const angers = DATA.iris.filter((i) => i[0].startsWith('49007')).sort((a, b) => b[6] - a[6])[0];
const off72 = PHARMA.p.filter((p) => String(p[8]).startsWith('72')).sort((a, b) => String(a[13]).localeCompare(String(b[13], 'fr')));
const o72 = off72[Math.floor(off72.length / 2)];
const pts = [
  fiche('Quartier d\'Angers le plus peuplé : ' + angers[1] + ' (' + angers[0] + ')', angers[4], angers[5], { code: angers[0], popQuartier: angers[6] }),
  fiche('Commune rurale de Mayenne (53) : ' + rural[2] + ' (' + rural[0] + ')', rural[4], rural[5], { code: rural[0], popQuartier: rural[6] }),
  fiche('Officine du 72 (au milieu de la liste triée par id) : ' + o72[6] + ', ' + o72[7] + ' [segment réel illisible hors JARVIS]', o72[0], o72[1], { id: o72[13] })
];
const q1 = P.quartier(angers[0], 5), q2 = fiche('', angers[4], angers[5]).r5;
ok(q1.pop === Math.round(q2.pop) || Math.abs(q1.pop - q2.pop) < 1, 'quartier(code, 5) = zone au centre du quartier');
ok(pts.every((p) => p.r5.nbOff > 0 && p.r5.pop > 0), 'compteur re-testé : les 3 points réels ont population > 0 et officines > 0 à 5 km');

const controle = { date: '2026-10-29', quartiersParDept: lignesDep, totaux: { quartiers: nTot, population: popTot, populationLegale: popTotLegale, marche: Math.round(marcheTot) },
  moyenneSecteur5km: moy5, temps: { zone5kmMs: tZone, tousLes8DeptsMs: tTous, nOfficines: secteur.length, moyenneSecteurMs: tMoy }, pointsReels: pts,
  sansPopulation: DATA.meta.sansPopulation, populationSansContour: DATA.meta.populationSansContour, tailleOctets: fs.statSync(CRM + 'potentiel-secteur-data.js').size };
console.log(JSON.stringify(controle, null, 1));
console.log(echecs ? '\n' + echecs + ' ECHEC(S)' : '\nTOUS LES TESTS PASSENT');
process.exit(echecs ? 1 : 0);

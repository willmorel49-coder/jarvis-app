/* Bloc « Stock par établissement » du panneau produit + ventes par établissement (23/10/2026).
   Données FABRIQUÉES : la réponse est connue d'avance. Aucun chiffre de vente réel.
   Lancer : node --test tests/comptoir-ventes-etab.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CIP = '3400000000001', SANS_DETAIL = '3400000000002', JAMAIS = '3400000000003';
const DATES = { CPR: '2026-09-15', HP: '2026-09-15', MSP: '2026-09-15', OPS: '2026-09-15', POS: '2026-09-21', SEP: '2026-09-17', SOP: '2026-09-15' };
const VENTES = () => ({
  de: '2026-01-01', a: '2026-09-30', genere: '2026-10-23',
  sites: { CPR: { depuis: '2026-01' }, HP: { depuis: '2026-01' }, MSP: { depuis: '2026-01' }, OPS: { depuis: '2026-01' },
           POS: { depuis: '2026-01' }, SEP: { depuis: '2026-06' }, SOP: { depuis: '2026-01' } },
  v: {
    [CIP]: { OPS: [1234, 567, '2026-09-30'], CPR: [12, 0, '2026-03-02'], SEP: [40, 0, '2026-09-29'] },
    [SANS_DETAIL]: { HP: [9, 4, '2026-08-27'] }
  }
});

function bac({ ventes, loadFiles } = {}) {
  const sb = { document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } }, console, setTimeout, clearTimeout, Promise };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext('window.V2 = {};', sb);
  sb.ETAB_PRICES = { siteDates: JSON.parse(JSON.stringify(DATES)) };
  if (ventes) sb.ETAB_VENTES = ventes;
  if (loadFiles) sb.V2.loadFiles = loadFiles;
  vm.runInContext(readFileSync(new URL('../crm/v2/v2-comptoir.js', import.meta.url), 'utf8'), sb);
  return sb;
}
const ligne = (etab) => ({ cip: CIP, stock: 77, etab });
const ETAB = { CPR: 61, HP: 0, MSP: 5, OPS: 40, POS: 3, SOP: 8 };   // SEP non communiqué

test('vue pharmacien : aucune vente, ni « Vendu » ni « Export », et le fichier n\'est même pas demandé', () => {
  let appels = 0;
  const sb = bac({ ventes: VENTES(), loadFiles: () => { appels++; return Promise.resolve(); } });
  const h = sb.V2.comptoir._stockHtml(ligne(ETAB), true);
  assert.ok(!/Vendu|Export|Ventes/.test(h), h);
  assert.match(h, /Stock déclaré par chaque établissement\. « — » : non communiqué\./);
  assert.ok(!/ au 15\/09/.test(h), 'la vue pharmacien garde la note d\'aujourd\'hui, non datée');
  assert.equal(appels, 0);
  const h2 = sb.V2.comptoir._stockHtml({ cip: SANS_DETAIL, stock: 9 }, true);
  assert.ok(!/Vendu|Export/.test(h2), h2);
});

test('vue interne : « Vendu » partout, « Export » seulement quand il y en a, dernière vente dans le title', () => {
  const sb = bac({ ventes: VENTES() });
  const h = sb.V2.comptoir._stockHtml(ligne(ETAB), false);
  assert.match(h, /OPS<\/em><b>40<\/b><span class="cp-vd">Vendu : 1&nbsp;234<\/span><span class="cp-vd cp-vx">Export : 567<\/span>|OPS<\/em><b>40<\/b><span class="cp-vd">Vendu : 1\s?234<\/span><span class="cp-vd cp-vx">Export : 567<\/span>/);
  assert.equal((h.match(/cp-vx/g) || []).length, 1, 'un seul site a de l\'export');
  assert.equal((h.match(/Vendu : /g) || []).length, 7, 'une case par site');
  assert.match(h, /title="Dernière vente : 30\/09\/2026"/);
  assert.match(h, /CPR<\/em><b>61<\/b><span class="cp-vd">Vendu : 12<\/span>/);
  assert.match(h, /HP<\/em><b>0<\/b><span class="cp-vd">Vendu : 0<\/span>/);          // vrai 0 : le fichier couvre la période
  assert.match(h, /title="Non communiqué · Dernière vente : 29\/09\/2026"/);            // SEP : stock « — » mais ventes
});

test('la note lit ses dates dans les données (stock par site, période, début de suivi)', () => {
  const sb = bac({ ventes: VENTES() });
  const h = sb.V2.comptoir._stockHtml(ligne(ETAB), false);
  assert.match(h, /Stock déclaré au 15\/09 \(SEP 17\/09, POS 21\/09\)\./);
  assert.match(h, /Ventes du 1er janvier au 30\/09 ; SEP suivi depuis juin\. Export : revendeurs et négociants\./);
  // on change les données : la note change
  const v = VENTES(); v.a = '2026-10-15'; v.sites.SEP.depuis = '2026-04'; v.sites.POS.depuis = '2026-03';
  const sb2 = bac({ ventes: v });
  sb2.ETAB_PRICES.siteDates.POS = '2026-10-02'; sb2.ETAB_PRICES.siteDates.SEP = '2026-10-01';
  const h2 = sb2.V2.comptoir._stockHtml(ligne(ETAB), false);
  assert.match(h2, /Stock déclaré au 15\/09 \(SEP 01\/10, POS 02\/10\)\./);
  assert.match(h2, /au 15\/10 ; POS suivi depuis mars, SEP suivi depuis avril\./);
  assert.ok(!/30\/09/.test((h2.match(/<p class="cp-note">[^<]*<\/p>/g) || []).join(' ')), 'aucune date écrite en dur');
});

test('fichier absent ou en échec : le stock s\'affiche, « indisponibles », jamais un 0 inventé', async () => {
  const sb = bac();                                                  // pas de V2.loadFiles
  const h = sb.V2.comptoir._stockHtml(ligne(ETAB), false);
  assert.match(h, /CPR<\/em><b>61<\/b>/);
  assert.match(h, /Ventes par établissement indisponibles\./);
  assert.ok(!/Vendu|Export/.test(h), h);
  let fini;
  const sb2 = bac({ loadFiles: () => new Promise((r) => { fini = r; }) });
  const h2 = sb2.V2.comptoir._stockHtml(ligne(ETAB), false);
  assert.match(h2, /chargement…/);
  assert.ok(!/Vendu :/.test(h2));
  fini();                                                            // le fichier ne s'est pas posé -> échec, pas un 0
  await new Promise((r) => setTimeout(r, 10));
  assert.match(sb2.V2.comptoir._stockHtml(ligne(ETAB), false), /indisponibles/);
  // le fichier arrive pendant l'attente : la case se remplit
  let fini3;
  const sb3 = bac({ loadFiles: () => new Promise((r) => { fini3 = r; }) });
  sb3.V2.comptoir._stockHtml(ligne(ETAB), false);
  sb3.ETAB_VENTES = VENTES(); fini3();
  await new Promise((r) => setTimeout(r, 10));
  assert.match(sb3.V2.comptoir._stockHtml(ligne(ETAB), false), /Vendu : 12</);
});

test('produit sans détail par site : les ventes par site s\'affichent quand il y en a', () => {
  const sb = bac({ ventes: VENTES() });
  const h = sb.V2.comptoir._stockHtml({ cip: SANS_DETAIL, stock: 9 }, false);
  assert.match(h, /Pas de détail par établissement/);
  assert.match(h, /HP<\/em><span class="cp-vd">Vendu : 9<\/span><span class="cp-vd cp-vx">Export : 4<\/span>/);
  assert.equal((h.match(/Vendu :/g) || []).length, 1, 'seulement le site qui a vendu');
  const h2 = sb.V2.comptoir._stockHtml({ cip: JAMAIS, stock: 0 }, false);
  assert.match(h2, /Aucune vente depuis le 01\/01\/2026\./);
});

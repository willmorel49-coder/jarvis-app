// 26/11/2026 — Marge par produit au téléphone : choix de Will sur la planche « JARVIS au téléphone : 11 choix »,
// sujet 6, version 1 (« Les rubriques repliées »).
// Avant : chiffres clés, familles, nuage, 30 produits à vendre en priorité, tous les produits, ceux qui tournent sans rapporter,
// hypothèses — tout déplié, l'un sous l'autre (24,18 écrans à 390 px).
// Ce que ce test garde, en faisant tourner le vrai fichier (crm/v2/v2-margeproduits.js) dans node:vm sur un faux fichier de marge :
//   · au téléphone, sous les chiffres clés, chaque rubrique tient sur une ligne avec son chiffre ; elle s'ouvre d'un toucher ;
//   · le contenu de chaque rubrique est, au caractère près, celui que l'ordinateur affiche ; rien ne disparaît ;
//   · les chiffres des lignes sont ceux que l'écran calcule déjà (chiffres clés, compte du tableau), et suivent le barème choisi ;
//   · une rubrique ouverte le reste quand l'écran se redessine sur place ; le nuage se dessine à l'ouverture de sa rubrique ;
//   · l'écran reste réservé : sans accès, aucune ligne, aucun chiffre ; à l'ordinateur, la page d'avant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { regles, sousTelephone } from './aide-css-telephone.mjs';

const SRC = readFileSync(new URL('../crm/v2/v2-margeproduits.js', import.meta.url), 'utf8');
const esp = (s) => s.replace(/[  ]/g, ' ');   // les espaces fines et insécables des nombres, écrites en espace simple
const texte = (h) => esp(h.replace(/<[^>]*>/g, ''));
const tours = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

// Un faux fichier de marge, bâti pour retrouver les chiffres de la planche (photos margeproduits-390-1/2/3) :
// 334 151 € et 361 170 € par mois, le froid à 3,4 % des boîtes et 53,5 % de la marge, 136 218 € pour les 30 premiers, 184 produits aux deux seuils.
const FAMS = [['Froid', 554, 3.4, 53.5], ['Cœur de gamme', 1916, 7.4, 16.6], ['Petit prix < 3,17 €', 664, 37.1, 16.0], ['Non remboursé', 1550, 5.9, 8.6],
  ['Cher > 468 €', 118, 0.1, 3.0], ['Petit prix 3,17–4,33 €', 197, 4.1, 2.1], ['Génériques', 1500, 42.0, 0.2]];
const COLS = ['nom', 'labo', 'famille', 'prix_net', 'boites_mois', 'officines', 'marge_boite_26', 'marge_boite_27', 'taux_26', 'taux_27', 'marge_mois_26', 'marge_mois_27', 'marge_janv_27', 'boites_janv_27', 'dispo_2027', 'cip'];
function fichier({ sans = 12 } = {}) {
  const B = 1612873, M27 = 334151, M26 = 361170, produits = [];
  const p = (o) => produits.push(COLS.map((c) => o[c]));
  for (let i = 0; i < 30; i++) p({ nom: 'FROID ' + String(i + 1).padStart(2, '0') + ' INJ', labo: 'LABO A', famille: 0, prix_net: 60, boites_mois: 500, officines: 100, marge_boite_26: 5.5, marge_boite_27: 5, taux_26: 0.09, taux_27: 0.08, marge_mois_26: 2750, marge_mois_27: 2500, marge_janv_27: 4540.6, boites_janv_27: 900, dispo_2027: 1, cip: '34009300000' + String(i).padStart(2, '0') });
  for (let i = 0; i < 154; i++) p({ nom: 'COEUR ' + String(i + 1).padStart(3, '0') + ' CPR', labo: 'LABO B', famille: 1, prix_net: 20, boites_mois: 300, officines: 60, marge_boite_26: 1.3, marge_boite_27: 1.2, taux_26: 0.065, taux_27: 0.06, marge_mois_26: 390, marge_mois_27: 360, marge_janv_27: 50, boites_janv_27: 40, dispo_2027: 1, cip: '3400940000' + String(i).padStart(3, '0') });
  for (let i = 0; i < sans; i++) p({ nom: 'PETIT ' + String(i + 1).padStart(2, '0') + ' BT30', labo: 'LABO C', famille: 2, prix_net: 1.5, boites_mois: 5000, officines: 400, marge_boite_26: i < 4 ? 0.06 : 0.02, marge_boite_27: 0.01, taux_26: 0.013, taux_27: 0.007, marge_mois_26: i < 4 ? 300 : 100, marge_mois_27: 50, marge_janv_27: 55, boites_janv_27: 5200, dispo_2027: 1, cip: '34009500000' + String(i).padStart(2, '0') });
  p({ nom: 'PARTI 01 STYLO', labo: 'LABO D', famille: 0, prix_net: 200, boites_mois: 800, officines: 150, marge_boite_26: 6, marge_boite_27: 6, taux_26: 0.03, taux_27: 0.03, marge_mois_26: 4800, marge_mois_27: 4800, marge_janv_27: 0, boites_janv_27: 0, dispo_2027: 0, cip: '3400960000001' });
  for (let i = 0; i < 20; i++) p({ nom: 'RARE ' + String(i + 1).padStart(2, '0'), labo: 'LABO E', famille: 3, prix_net: 9, boites_mois: 5, officines: 3, marge_boite_26: 0.4, marge_boite_27: 0.4, taux_26: 0.04, taux_27: 0.04, marge_mois_26: 2, marge_mois_27: 2, marge_janv_27: 2, boites_janv_27: 5, dispo_2027: 1, cip: '34009700000' + String(i).padStart(2, '0') });
  return {
    meta: {
      colonnes: COLS, periode: { de: 202601, a: 202608 }, genere_le: '2026-10-14', source: 'Faux fichier de test',
      total: { boites_mois: B, marge_mois26: M26, marge_mois27: M27, marge_janv27: 349277 },
      seuils_a_pousser: { marge_boite_min: 1, boites_mois_min: 200 },
      hypotheses: ['Hypothèse une.', 'Hypothèse deux.'], plus_chez_integral: ['Parti 01']
    },
    familles: FAMS.map(([nom, refs, pb, pm]) => ({ nom, refs, boites_mois: B * pb / 100, ca_mois: 1e6 * pm / 10, marge_mois26: M26 * pm / 100, marge_mois27: M27 * pm / 100 })),
    produits
  };
}

// L'écran monté dans une fausse fenêtre. `tel` : la fenêtre fait-elle 640 px ou moins ? `acces` : ce que répond la base.
async function monter({ tel, acces = true, sans = 12 }) {
  const etat = { tel, ouvertes: new Set(), ecoute: {}, seuil: [], feuilles: [], el: {}, hote: null, appels: [] };
  const racine = { h: '' };
  const nuageRepliee = () => /data-rub="nuage"/.test(racine.h) && !etat.ouvertes.has('nuage');
  Object.defineProperty(racine, 'innerHTML', {
    get() { return this.h; },
    set(v) {
      this.h = v; etat.el = {};
      etat.ouvertes = new Set([...v.matchAll(/<details class="mp-rub" data-rub="(\w+)" open>/g)].map((m) => m[1]));
      // la zone du nuage : large de 0 tant que sa rubrique est repliée (comme dans un navigateur)
      etat.hote = /id="mp-chart"/.test(v) ? {
        innerHTML: '', get clientWidth() { return nuageRepliee() ? 0 : (etat.tel ? 330 : 1100); },
        closest(sel) { assert.equal(sel, '.mp-rub:not([open])'); return nuageRepliee() ? {} : null; }, querySelector: () => null
      } : null;
    }
  });
  racine.querySelectorAll = (sel) => { assert.equal(sel, '.mp-rub[open]'); return [...etat.ouvertes].map((id) => ({ getAttribute: () => id })); };
  const doc = {
    getElementById(id) {
      if (id === 'mp-css') return null;
      if (id === 'mp-chart') return etat.hote;
      if (!new RegExp('id="' + id + '"').test(racine.h)) return null;
      return etat.el[id] || (etat.el[id] = { innerHTML: '', textContent: '', hidden: false, value: '' });
    },
    querySelector: (sel) => (racine.h.includes('class="' + sel.slice(1)) || racine.h.includes(' ' + sel.slice(1) + '"') ? { contains: () => true } : null),
    querySelectorAll: () => [],
    addEventListener(type, f) { (etat.ecoute[type] = etat.ecoute[type] || []).push(f); },
    createElement: (t) => { const o = { tag: t }; if (t === 'style') etat.feuilles.push(o); return o; },
    head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} }
  };
  const ctx = {
    console, document: doc, setTimeout, clearTimeout, pageYOffset: 0, scrollTo() {}, innerWidth: tel ? 390 : 1280,
    addEventListener(type, f) { (etat.ecoute['fenetre:' + type] = etat.ecoute['fenetre:' + type] || []).push(f); },
    matchMedia: (q) => ({ get matches() { return /max-width:\s*640px/.test(q) ? etat.tel : false; }, addEventListener(type, f) { if (type === 'change') etat.seuil.push(f); } }),
    ICO: () => '<svg></svg>'
  };
  ctx.window = ctx;
  ctx.V2 = {
    route: { name: 'margeproduits', param: null }, user: { id: 'u1' }, topbar: () => '<header></header>',
    sb: () => ({ rpc: (nom) => { etat.appels.push(nom); return Promise.resolve({ data: acces }); } }),
    // le fichier protégé n'est remis qu'à qui a l'accès (dans l'appli, c'est la base qui le garde)
    loadFiles: (noms) => { etat.appels.push('fichier:' + noms.join(',')); if (acces) ctx.MARGE_PRODUITS = fichier({ sans }); return Promise.resolve(); },
    render() { ctx.V2.pages.margeproduits.render(racine, ctx.V2.route.param); }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  ctx.V2.render(); await tours();
  const clic = (attrs) => { const b = { getAttribute: (k) => attrs[k] }; for (const f of etat.ecoute.click || []) f({ target: { closest: (sel) => (sel === '[data-act]' ? b : null) } }); };
  return {
    V2: ctx.V2, etat, racine, clic,
    html: () => racine.h,
    // l'utilisateur touche une ligne : la rubrique s'ouvre (ou se referme), le navigateur prévient l'écran
    toucher(id) {
      const ouverte = !etat.ouvertes.has(id);
      ouverte ? etat.ouvertes.add(id) : etat.ouvertes.delete(id);
      for (const f of etat.ecoute.toggle || []) f({ target: { open: ouverte, getAttribute: () => id } });
    },
    lignes: () => rubriques(racine.h),
    css: () => etat.feuilles.map((f) => f.textContent || '').join('\n')
  };
}

// Les lignes du téléphone : [{ id, ouverte, titre, sous, chiffre, unite, contenu }]
function rubriques(h) {
  const out = [], re = /<details class="mp-rub" data-rub="(\w+)"( open)?><summary><span class="mp-rub-t"><b>([^<]*)<\/b>(?:<small>([^<]*)<\/small>)?<\/span>(?:<span class="mp-rub-c">([^<]*)(?:<small>([^<]*)<\/small>)?<\/span>)?<svg><\/svg><\/summary>([\s\S]*?)<\/details>/g;
  let m;
  while ((m = re.exec(h))) out.push({ id: m[1], ouverte: !!m[2], titre: m[3], sous: esp(m[4] || ''), chiffre: esp(m[5] || ''), unite: m[6] || '', contenu: m[7] });
  return out;
}
const resume = (l) => l.map((x) => [x.titre, x.sous, x.chiffre, x.unite]);

test('marqueur : à l’ordinateur, la page d’avant — six rubriques dépliées l’une sous l’autre, aucune ligne repliée', async () => {
  const p = await monter({ tel: false }), h = p.html();
  const titres = [...h.matchAll(/<h[23]>([^<]*)<\/h[23]>/g)].map((m) => m[1]);
  assert.deepEqual(titres, ['Où se fait notre marge', 'Rotation × marge par boîte', 'À vendre en priorité', 'Tous les produits', 'Tournent sans rapporter', 'Hypothèses de ces chiffres']);
  assert.doesNotMatch(h, /mp-rub|<details|<summary/);
  assert.match(p.etat.hote.innerHTML, /^<svg class="mp-svg" width="1100" height="580"/, 'le nuage est dessiné à l’arrivée, à la largeur de l’ordinateur');
  assert.match(texte(h), /136 218 €/);
});

test('téléphone : sous les chiffres clés, une carte de six lignes repliées, avec les chiffres de la planche', async () => {
  const p = await monter({ tel: true }), h = p.html(), l = p.lignes();
  assert.deepEqual(resume(l), [
    ['Où se fait notre marge', 'Froid : 3,4 % des boîtes', '53,5 %', 'de notre marge'],
    ['Rotation × marge par boîte', '', '', ''],
    ['À vendre en priorité', '30 produits, janvier 2027', '136 218 €', ''],
    ['Tous les produits', '', '217', 'produits'],
    ['Tournent sans rapporter', '', '12', 'produits'],
    ['Hypothèses de ces chiffres', '', '', '']
  ]);
  assert.ok(l.every((x) => !x.ouverte), 'toutes repliées en arrivant');
  assert.ok(h.indexOf('<div class="mp-kpis">') < h.indexOf('<div class="mp-card mp-rubs">'), 'les chiffres clés restent au-dessus, dépliés');
  assert.equal(h.split('<div class="mp-card mp-rubs">').length, 2, 'une seule carte de rubriques');
  assert.match(h, /<\/details><\/div><\/div>$/, 'rien après la carte des rubriques');
  assert.equal((h.match(/<summary>/g) || []).length, 6);
  // chaque balise ouverte est refermée (une balise oubliée avalerait les rubriques suivantes)
  const nb = (x) => h.split(x).length - 1;
  for (const b of ['div', 'details', 'summary', 'section', 'footer', 'span', 'button', 'label', 'select', 'ul']) assert.equal(nb('<' + b + ' ') + nb('<' + b + '>'), nb('</' + b + '>'), 'balise ' + b);
});

test('téléphone : les chiffres des lignes sont ceux que l’écran affiche déjà (chiffres clés, compte du tableau)', async () => {
  const p = await monter({ tel: true }), h = p.html(), l = p.lignes(), par = Object.fromEntries(l.map((x) => [x.id, x]));
  // 2e chiffre clé « Le froid, en 2027 » : 3,4 % des boîtes → 53,5 % de notre marge
  const froid = /<div class="mp-kv" data-k="froid"><span>([^<]*)<\/span><small>des boîtes<\/small> <em>→<\/em> <span>([^<]*)<\/span><small>de notre marge<\/small>/.exec(h);
  assert.ok(froid, 'marqueur : le chiffre clé du froid est bien lu');
  assert.equal(par.fam.sous, 'Froid : ' + esp(froid[1]) + ' des boîtes');
  assert.equal(par.fam.chiffre, esp(froid[2]));
  // 4e chiffre clé « À vendre en priorité » : 136 218 €, « les 30 premiers produits en janvier 2027 »
  const prio = /<div class="mp-kv" data-k="prio">([^<]*)<\/div><div class="mp-kd">C’est ce que rapportent les (\d+) premiers produits en janvier (\d+)/.exec(h);
  assert.ok(prio, 'marqueur : le chiffre clé « À vendre en priorité » est bien lu');
  assert.equal(par.prio.chiffre, esp(prio[1]));
  assert.equal(par.prio.sous, prio[2] + ' produits, janvier ' + prio[3]);
  // « Tous les produits » : le compte que le tableau écrit lui-même (« 217 produits · 50 affichés »)
  assert.match(esp(p.etat.el['mp-compte'].textContent), /^217 produits · 50 affichés$/);
  assert.equal(par.tous.chiffre + ' ' + par.tous.unite, '217 produits');
  // « Tournent sans rapporter » : le compte écrit dans la phrase de la rubrique et sur son bouton
  assert.match(texte(par.sans.contenu), /de marge par boîte : 12 produits, /);
  assert.match(par.sans.contenu, /data-act="sanstout">Voir les 12 produits<\/button>/);
});

test('téléphone : le contenu de chaque rubrique est celui de l’ordinateur, au caractère près ; rien ne disparaît', async () => {
  const t = await monter({ tel: true }), o = await monter({ tel: false });
  const sans = t.html().replace('<div class="mp-card mp-rubs">', '').replace(/<details class="mp-rub" data-rub="\w+"><summary>[\s\S]*?<\/summary>/g, '').replace(/<\/details>/g, '').replace(/<\/div><\/div>$/, '</div>');
  assert.equal(sans, o.html(), 'la page du téléphone, lignes retirées, est la page de l’ordinateur');
  const l = t.lignes();
  for (const x of l) assert.ok(new RegExp('<h[23]>' + x.titre.replace(/[×.]/g, '.') + '</h[23]>').test(x.contenu), x.titre + ' : le titre de la ligne est celui de sa rubrique');
  for (const m of ['id="mp-chart"', 'id="mp-prio"', 'id="mp-q"', 'id="mp-fam"', 'id="mp-tri"', 'id="mp-tous"', 'data-act="plus"', 'data-act="sanstout"', 'Confidentiel : réservé au groupe restreint.']) assert.ok(t.html().includes(m), m + ' toujours là');
  // le tableau « Tous les produits » se remplit même replié : ses 50 premières lignes sont prêtes à l'ouverture
  assert.equal((t.etat.el['mp-tous'].innerHTML.match(/class="mp-row tous"/g) || []).length, 50);
  assert.equal(t.etat.el['mp-tous'].innerHTML, o.etat.el['mp-tous'].innerHTML);
});

test('téléphone : une rubrique ouverte le reste quand l’écran se redessine sur place ; les chiffres suivent le barème', async () => {
  const p = await monter({ tel: true });
  assert.equal((p.lignes()[4].contenu.match(/class="mp-row sans"/g) || []).length, 8, 'marqueur : 8 produits montrés avant « Voir les 12 produits »');
  p.toucher('sans'); p.toucher('tous');
  p.clic({ 'data-act': 'sanstout' });   // « Voir les 12 produits » : l'écran se redessine
  let l = p.lignes();
  assert.deepEqual(l.filter((x) => x.ouverte).map((x) => x.id), ['tous', 'sans'], 'les deux rubriques ouvertes le sont encore');
  assert.match(l[4].contenu, /data-act="sanstout">Réduire la liste<\/button>/, 'et la liste s’est bien allongée');
  assert.equal((l[4].contenu.match(/class="mp-row sans"/g) || []).length, 12, 'les 12 produits');
  p.toucher('tous');   // refermée par l'utilisateur
  p.clic({ 'data-act': 'an', 'data-k': '26' });   // barème 2026
  l = p.lignes();
  assert.deepEqual(l.filter((x) => x.ouverte).map((x) => x.id), ['sans']);
  assert.deepEqual(resume(l), [
    ['Où se fait notre marge', 'Froid : 3,4 % des boîtes', '53,5 %', 'de notre marge'],
    ['Rotation × marge par boîte', '', '', ''],
    ['À vendre en priorité', '30 produits, par mois en 2026', '82 500 €', ''],
    ['Tous les produits', '', '217', 'produits'],
    ['Tournent sans rapporter', '', '8', 'produits'],
    ['Hypothèses de ces chiffres', '', '', '']
  ], 'au barème 2026 : 82 500 € par mois pour les 30 premiers, 8 produits qui tournent sans rapporter');
  // revenir sur l'écran depuis un autre : tout est replié
  p.racine.innerHTML = '<div>un autre écran</div>';
  p.V2.render(); await tours();
  assert.ok(p.lignes().length === 6 && p.lignes().every((x) => !x.ouverte), 'nouvelle arrivée : six lignes repliées');
});

test('téléphone : le nuage ne se dessine pas replié ; il se dessine à l’ouverture de sa rubrique, à la largeur du téléphone', async () => {
  const p = await monter({ tel: true });
  assert.equal(p.etat.hote.innerHTML, '', 'replié : rien n’est dessiné (largeur nulle)');
  // la fenêtre change de taille (sur iPhone : la barre d'adresse qui se replie au défilement) : toujours rien, pas de dessin à l'aveugle
  assert.equal((p.etat.ecoute['fenetre:resize'] || []).length, 1, 'marqueur : l’écouteur de taille de fenêtre est bien pris');
  p.etat.ecoute['fenetre:resize'][0](); await new Promise((r) => setTimeout(r, 220));
  assert.equal(p.etat.hote.innerHTML, '', 'replié, fenêtre redimensionnée : toujours rien');
  p.toucher('fam');
  assert.equal(p.etat.hote.innerHTML, '', 'ouvrir une autre rubrique ne dessine pas le nuage');
  p.toucher('nuage');
  assert.match(p.etat.hote.innerHTML, /^<svg class="mp-svg" width="330" height="470"/, 'ouvert : dessiné à 330 px de large, format téléphone');
  const dessin = p.etat.hote.innerHTML;
  p.etat.hote.innerHTML = 'TÉMOIN';
  p.toucher('nuage'); p.toucher('nuage');   // refermé puis rouvert, même largeur : pas de second dessin
  assert.equal(p.etat.hote.innerHTML, 'TÉMOIN');
  p.etat.hote.innerHTML = dessin;
  p.clic({ 'data-act': 'an', 'data-k': '26' });   // redessin sur place, rubrique ouverte : le nuage est redessiné tout de suite
  assert.match(p.etat.hote.innerHTML, /^<svg class="mp-svg" width="330" height="470"/);
});

test('téléphone : aucun produit qui tourne sans rapporter — pas de ligne vide pour cette rubrique', async () => {
  const l = (await monter({ tel: true, sans: 0 })).lignes();
  assert.deepEqual(l.map((x) => x.id), ['fam', 'nuage', 'prio', 'tous', 'hyp']);
  assert.equal(l[3].chiffre + ' ' + l[3].unite, '205 produits');
});

test('l’écran reste réservé : sans accès, ni ligne ni chiffre, et le fichier de marge n’est pas demandé', async () => {
  for (const tel of [true, false]) {
    const p = await monter({ tel, acces: false }), h = p.html();
    assert.match(h, /Cet écran est réservé/);
    assert.doesNotMatch(h, /mp-rub|mp-kpis|136|53,5|Froid/);
    assert.deepEqual(p.etat.appels, ['jarvis_acces_marge_produits'], 'la base est interrogée, le fichier protégé n’est pas demandé');
  }
  const ok = await monter({ tel: true });
  assert.deepEqual(ok.etat.appels, ['jarvis_acces_marge_produits', 'fichier:margeproduits'], 'avec accès : la question d’abord, le fichier ensuite — comme avant');
});

test('le seuil des 640 px franchi (téléphone tourné) : l’onglet se redessine dans l’autre forme', async () => {
  const p = await monter({ tel: true });
  assert.equal(p.etat.seuil.length, 1, 'un seul écouteur posé sur la largeur');
  p.toucher('prio');
  p.etat.tel = false; p.etat.seuil[0]();
  assert.doesNotMatch(p.html(), /mp-rub/, 'au-dessus de 640 px : la page dépliée');
  assert.match(p.etat.hote.innerHTML, /^<svg class="mp-svg" width="1100"/);
  p.etat.tel = true; p.etat.seuil[0]();
  assert.equal(p.lignes().length, 6, 'revenu sous 640 px : les six lignes');
  const avant = p.html();
  p.V2.route.name = 'home'; p.etat.tel = false; p.etat.seuil[0]();
  assert.equal(p.html(), avant, 'sur un autre écran, l’écouteur ne touche à rien');
});

test('feuille de style : tout ce qui habille les lignes est dans un @media de 640 px ou moins ; cibles et textes aux tailles demandées', async () => {
  const rs = regles((await monter({ tel: true })).css());
  const neuves = rs.filter((r) => /\.mp-rub/.test(r.sel));
  assert.ok(neuves.length >= 15, 'marqueur : les règles des rubriques sont bien lues (' + neuves.length + ')');
  for (const r of neuves) assert.ok(sousTelephone(r), r.sel + ' doit être sous @media (max-width:640px)');
  const d = (sel) => { const r = neuves.find((x) => x.sel === sel); assert.ok(r, 'règle attendue : ' + sel); return r.decl; };
  assert.match(d('.mp-rub>summary'), /min-height:60px/, 'la ligne : 60 px de haut, toute la largeur (cible de 44 px tenue)');
  assert.match(d('.mp-rub[open]>summary svg'), /rotate\(90deg\)/, 'le chevron tourne à l’ouverture');
  assert.match(d('.mp-rub .mp-sh h2,.mp-rub .mp-pied h3'), /display:none/, 'le titre n’est pas écrit deux fois (il est dans la ligne)');
  for (const r of neuves) for (const m of r.decl.matchAll(/font-size:([\d.]+)px/g)) assert.ok(+m[1] >= 12, r.sel + ' : texte de ' + m[1] + ' px');
  // l'ordinateur garde ses titres et ses cartes
  const hors = rs.filter((r) => !sousTelephone(r));
  assert.ok(hors.some((r) => r.sel === '.mp-sh h2' && /font-size:22px/.test(r.decl)), 'le titre de rubrique de l’ordinateur est toujours là');
  assert.ok(!hors.some((r) => /mp-rub/.test(r.sel)), 'aucune règle des rubriques hors du téléphone');
});

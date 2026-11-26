// 26/11/2026 — Catalogue & prix par produit au téléphone : choix de Will sur la planche « JARVIS au téléphone : 11 choix »,
// sujet 5, version 2 (« Une ligne par produit »).
// Avant : 200 fiches de neuf lignes l'une sous l'autre (107,8 écrans à 390 px), avec un liseré de couleur épais à gauche.
// Ce que ce test garde, en faisant tourner le vrai fichier (crm/v2/v2-molecules.js) dans node:vm sur de faux produits :
//   · au téléphone, une ligne par produit (rang, nom, famille, prix net, abandon de marge) ; le toucher ouvre le reste de la fiche ;
//   · chaque valeur de la ligne et de son détail est celle que le tableau de l'ordinateur affiche pour le même produit ;
//   · la page s'arrête à 30 produits, « Voir 30 de plus » ajoute la suite sans redessiner ce qui est déjà là ;
//   · un tri, une recherche, un filtre ou une nouvelle arrivée repartent des 30 premiers ;
//   · à l'ordinateur : le tableau d'avant, 200 lignes, sans ligne repliée ni bouton.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { regles, sousTelephone } from './aide-css-telephone.mjs';

const SRC = readFileSync(new URL('../crm/v2/v2-molecules.js', import.meta.url), 'utf8');
const nb = (h, s) => h.split(s).length - 1;
const texte = (h) => h.replace(/<[^>]*>/g, '');
const esp = (s) => s.replace(/[\u202f\u00a0]/g, ' ');   // l'espace fine des milliers (« 1 665 ») écrite en espace simple

// Les deux produits de la planche (photos molecules-390-2 et -3), puis des produits fictifs de toutes les familles.
const FAMILLES = ['pr_low', 'nr', 'gen', 'pr_mid', 'biosim', 'pr_high'];
function produits(n = 75) {
  const out = [
    { c: '3400934744198', d: 'KARDEGIC 75MG PDR SACH 30', f: 'pr_low', n: 509, ppht: 1.47, net: 1.22, rota: 376, marge: 68 },
    { c: '3662042005664', d: 'THEALOSE SOL OPHT FL 15ML T', f: 'nr', n: 492, ppht: 8.34, net: 8.35, rota: 143, marge: 0 }
  ];
  for (let i = 3; i <= n; i++) {
    const f = FAMILLES[i % FAMILLES.length];
    const ppht = f === 'pr_high' ? 600 + i : f === 'pr_low' ? 2 + i / 100 : 20 + i;
    // un générique porte ici un net sous son PPHT : l'écran ne doit quand même lui afficher aucun abandon de marge
    out.push({ c: '34009' + String(10000000 + i), d: 'PRODUIT ' + String(i).padStart(3, '0'), f, n: 480 - i, ppht, net: f === 'gen' ? +(ppht * 0.9).toFixed(2) : 0, rota: 1000 - i, marge: i * 3 });
  }
  return out;
}

// L'écran monté dans une fausse fenêtre. `tel` : la fenêtre fait-elle 640 px ou moins ?
function monter({ tel, n = 75 }) {
  const etat = { tel, tbody: null, compte: null, ajouts: '', finRetiree: false, finDedans: null, feuilles: [], seuil: [] };
  const racine = { h: '', querySelectorAll: () => [], querySelector: () => null };
  Object.defineProperty(racine, 'innerHTML', {
    get() { return this.h; },
    set(v) {
      this.h = v;
      const m = /<tbody id="mol-tbody">([\s\S]*?)<\/tbody>/.exec(v);
      etat.tbody = m ? poseTbody(m[1]) : null;
      etat.compte = /id="mol-count"/.test(v) ? { innerHTML: '' } : null;
    }
  });
  function poseTbody(h) {
    const t = { h };
    Object.defineProperty(t, 'innerHTML', { get() { return this.h; }, set(v) { this.h = v; etat.ajouts = ''; etat.finRetiree = false; etat.finDedans = null; } });
    etat.ajouts = ''; etat.finRetiree = false; etat.finDedans = null;
    return t;
  }
  const doc = {
    getElementById(id) {
      if (id === 'mol-tbody') return etat.tbody;
      if (id === 'mol-count') return etat.compte;
      if (id === 'mol-lgs') return etat.tbody && etat.tbody.h.includes('id="mol-lgs"') ? { insertAdjacentHTML(ou, h) { assert.equal(ou, 'beforeend'); etat.ajouts += h; } } : null;
      if (id === 'mol-plus30') {
        if (!etat.tbody || !etat.tbody.h.includes('id="mol-plus30"') || etat.finRetiree) return null;
        const td = {}; Object.defineProperty(td, 'innerHTML', { set(v) { etat.finDedans = v; } });
        return { firstChild: td, parentNode: { removeChild() { etat.finRetiree = true; } } };
      }
      return null;
    },
    querySelectorAll: () => [],
    createElement: (t) => { const o = { tag: t }; if (t === 'style') etat.feuilles.push(o); return o; },
    head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} }
  };
  const ctx = {
    console, document: doc,
    setTimeout: (f) => { f(); return 0; }, clearTimeout() {},
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: (q) => ({
      get matches() { return /max-width:\s*640px/.test(q) ? etat.tel : false; },
      addEventListener(type, f) { if (type === 'change') etat.seuil.push(f); }
    }),
    ICO: () => '<svg></svg>',
    PROD_STATS: produits(n),
    // Kardegic : 12 boîtes en stock à POS ; Thealose : 0.
    ETAB_PRICES: { etabs: [{ code: 'POS', n: 2 }], all: {}, prices: { POS: { '3400934744198': [1.47, 12], '3662042005664': [8.34, 0] } } },
    SAGITTA_PRIX_CIP: { '3400934744198': 1.29, '3400910000005': 2.01 }, SAGITTA_PRIX_MAJ: '2026-11-20',
    OCP_PRIX: { '3400934744198': [1.10] }, OCP_PRIX_MAJ: '2026-09-10'
  };
  ctx.window = ctx;
  ctx.V2 = {
    pages: {}, route: { name: 'molecules' }, topbar: () => '<header></header>',
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'),
    // les deux formats de v2-boot.js, recopiés
    fmtEur: (v) => { if (typeof v !== 'number' || !isFinite(v)) return '—'; if (v === 0) return '0 €'; if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('fr-FR') + ' €'; return v.toFixed(2).replace('.', ',') + ' €'; },
    fmtNum: (v) => (Math.round(v) || 0).toLocaleString('fr-FR'),
    market: (cip) => (cip === '3400934744198' ? { avgYear: 1665, meta: { mois: 12 } } : null),
    render() { ctx.V2.pages.molecules.render(racine); }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return {
    V2: ctx.V2, etat, racine,
    arriver() { etat.tbody = null; etat.compte = null; ctx.V2.render(); return this; },   // on vient d'un autre écran : la liste n'est pas dans la page
    // ce que le téléphone montre : les lignes du premier dessin + celles ajoutées, puis la fin de liste si elle est encore là
    lignes() { return fiches((etat.tbody ? etat.tbody.h : '') + etat.ajouts); },
    fin() {
      if (!etat.tbody || etat.finRetiree) return null;
      const m = /<tr class="mol-more mol-plus30" id="mol-plus30"><td colspan="\d+">([\s\S]*?)<\/td><\/tr>/.exec(etat.tbody.h);
      const h = etat.finDedans != null ? etat.finDedans : (m ? m[1] : null);
      if (h == null) return null;
      const b = /^<button type="button" class="v2-btn mol-plus30-b" onclick="V2\.molPlus30\(\)">([^<]+)<\/button><small>([^<]+)<\/small>$/.exec(h);
      assert.ok(b, 'fin de liste : un bouton puis le compte — ' + h);
      return { bouton: b[1], compte: b[2] };
    },
    compte() { return etat.compte ? texte(etat.compte.innerHTML) : null; },
    tbody() { return etat.tbody ? etat.tbody.h : ''; },
    css() { return etat.feuilles.map((f) => f.textContent || '').join('\n'); }
  };
}

// Les lignes du téléphone : [{ rang, nom, famille, net, abandon, detail: { libellé: { v, cls } } }]
function fiches(h) {
  const out = [];
  const re = /<details class="mol-lg"><summary><span class="mol-lg-rg">(\d+)<\/span><span class="mol-lg-n"><b>([^<]*)<\/b>(.*?)<\/span><span class="mol-lg-p"><b>([^<]*)<\/b><small>([^<]*)<\/small><\/span><svg><\/svg><\/summary><div class="mol-lg-d">(.*?)<\/div><\/details>/g;
  let m;
  while ((m = re.exec(h))) {
    const detail = {}, ordre = [];
    for (const p of m[6].matchAll(/<p(?: title="([^"]*)")?><span>([^<]*)<\/span><(b|span)([^>]*)>([^<]*)<\/\3><\/p>/g)) { detail[p[2]] = { v: p[5], attr: p[4], titre: p[1] || '' }; ordre.push(p[2]); }
    out.push({ rang: +m[1], nom: m[2], famille: texte(m[3]), pastille: m[3], net: m[4], abandon: m[5], detail, ordre });
  }
  return out;
}
// Les lignes du tableau de l'ordinateur : [{ libellé: { v (texte), h (html), cls } }]
function rangees(h) {
  const out = [];
  for (const tr of h.matchAll(/<tr style="--rowc:[^"]*">([\s\S]*?)<\/tr>/g)) {
    const r = {};
    for (const td of tr[1].matchAll(/<td(?: class="([^"]*)")? data-label="([^"]*)"[^>]*>([\s\S]*?)<\/td>/g)) r[td[2]] = { v: texte(td[3]), h: td[3], cls: td[1] || '' };
    out.push(r);
  }
  return out;
}

test('marqueur : à l’ordinateur, le tableau d’avant — une rangée de 12 cases par produit, 200 au plus, ni ligne repliée ni bouton', () => {
  const p = monter({ tel: false }).arriver();
  const r = rangees(p.tbody());
  assert.equal(r.length, 75);
  assert.deepEqual(Object.keys(r[0]), ['#', 'Produit', 'CIP', 'Famille', 'Pharmacies', 'PPHT', 'Prix net', 'Abandon de marge', 'Moy. France/an', 'Rotation', 'Marge pharma.']);
  assert.equal(r[0].Produit.v, 'Kardegic 75mg pdr sach 30');
  assert.equal(p.compte(), '75 produits');
  assert.doesNotMatch(p.racine.h, /mol-lg|mol-plus30|molPlus30|de plus/);
  const q = monter({ tel: false, n: 250 }).arriver();
  assert.equal(rangees(q.tbody()).length, 200, '250 produits : 200 affichés');
  assert.match(q.tbody(), /<tr class="mol-more"><td colspan="11"[^>]*>200 produits affichés sur 250 — affinez la recherche ou la catégorie pour voir les autres\.<\/td><\/tr>$/);
  assert.equal(q.compte(), '200 affichés sur 250');
  assert.doesNotMatch(q.racine.h, /mol-lg|mol-plus30|de plus/);
});

test('téléphone : une ligne par produit, 30 lignes dans une seule carte, sans liseré de couleur', () => {
  const p = monter({ tel: true }).arriver();
  const l = p.lignes();
  assert.equal(l.length, 30, 'trente lignes');
  assert.deepEqual(l.map((x) => x.rang), Array.from({ length: 30 }, (_, i) => i + 1), 'numérotées de 1 à 30');
  assert.match(p.tbody(), /^<tr class="mol-lgw"><td colspan="11"><div class="mol-lgs" id="mol-lgs"><details class="mol-lg">/, 'une seule carte pour toute la liste');
  assert.equal(nb(p.tbody(), '<tr'), 2, 'la carte des lignes, puis la fin de liste');
  assert.equal(rangees(p.tbody()).length, 0, 'plus aucune fiche de neuf lignes');
  assert.doesNotMatch(p.tbody(), /--rowc/, 'la couleur de famille n’est plus portée par la ligne');
  assert.equal(p.compte(), '30 affichés sur 75', 'le compte du haut, comme sur la planche');
  assert.deepEqual(p.fin(), { bouton: 'Voir 30 de plus', compte: '30 produits affichés sur 75' }, 'libellés de la planche');
  // chaque balise ouverte est refermée (une balise oubliée avalerait les lignes suivantes)
  for (const b of ['tr', 'td', 'div', 'details', 'summary', 'span', 'p', 'b', 'small', 'button']) assert.equal(nb(p.tbody(), '<' + b + ' ') + nb(p.tbody(), '<' + b + '>'), nb(p.tbody(), '</' + b + '>'), 'balise ' + b);
  assert.equal(nb(p.tbody(), '<details class="mol-lg"><summary>'), 30, 'chaque ligne est un repli natif : le navigateur dit lui-même « replié / déplié »');
});

test('téléphone : les deux lignes de la planche (Kardegic, Thealose), au mot et au chiffre près', () => {
  const [k, t] = monter({ tel: true }).arriver().lignes();
  assert.deepEqual([k.rang, k.nom, k.famille, k.net, k.abandon], [1, 'Kardegic 75mg pdr sach 30', 'Princeps petits prix', '1,22 €', 'abandon −17%']);
  assert.deepEqual(k.ordre, ['CIP', 'Pharmacies', 'PPHT', 'Sagitta', 'OCP', 'Moy. France/an', 'Rotation', 'Marge pharma.']);
  assert.deepEqual(k.ordre.map((x) => esp(k.detail[x].v)), ['3400934744198', '509', '1,47 €', '1,29 €', '1,10 €', '~1 665', '376', '68,00 €']);
  assert.match(k.detail.PPHT.attr, /class="mol-ppht"/, 'princeps avec abandon de marge : PPHT barré');
  // NR : prix libre, pas d'abandon de marge, PPHT en clair et non barré (skill pharma-metier)
  assert.deepEqual([t.rang, t.nom, t.famille, t.net, t.abandon], [2, 'Thealose sol opht fl 15ml t', 'NR', '8,35 €', 'abandon —']);
  assert.deepEqual(t.ordre, ['CIP', 'Pharmacies', 'PPHT', 'Moy. France/an', 'Rotation', 'Marge pharma.']);
  assert.deepEqual(t.ordre.map((x) => t.detail[x].v), ['3662042005664', '492', '8,34 €', '—', '143', '0 €']);
  assert.equal(t.detail.PPHT.attr, '', 'NR : PPHT non barré');
});

test('téléphone : chaque valeur est celle du tableau de l’ordinateur pour le même produit (aucun calcul nouveau)', () => {
  for (const reglage of [null, 'POS']) {
    const tel = monter({ tel: true }), ordi = monter({ tel: false });
    if (reglage) { tel.arriver(); ordi.arriver(); tel.V2.molEtab(reglage); ordi.V2.molEtab(reglage); } else { tel.arriver(); ordi.arriver(); }
    const l = tel.lignes(), r = rangees(ordi.tbody());
    assert.equal(l.length, 30); assert.ok(r.length >= 30);
    const vus = { barre: 0, clair: 0, tiers: 0, gen: 0, stock: 0 };
    l.forEach((x, i) => {
      const o = r[i], ou = 'produit n° ' + (i + 1) + (reglage ? ' (établissement ' + reglage + ')' : '');
      assert.equal(String(x.rang), o['#'].v, ou);
      assert.equal(x.nom, o.Produit.v, ou);
      assert.equal(x.pastille, o.Famille.h, ou + ' : la pastille de famille, telle quelle');
      assert.equal(x.abandon, 'abandon ' + o['Abandon de marge'].v, ou);
      // la case « Prix net » de l'ordinateur porte le net puis les tarifs des tiers : « 1,22 €Sagitta 1,29 €OCP 1,10 € »
      const tiers = ['Sagitta', 'OCP'].filter((nom) => x.detail[nom]);
      assert.equal(x.net + tiers.map((nom) => nom + ' ' + x.detail[nom].v).join(''), o['Prix net'].v, ou);
      for (const nom of tiers) {
        vus.tiers++;
        const cls = (/class="(mol-sag[^"]*)"/.exec(x.detail[nom].attr) || [])[1];
        assert.ok(o['Prix net'].h.includes('<span class="' + cls + '" title="Tarif d\'achat net ' + nom + '">' + nom + ' ' + x.detail[nom].v + '</span>'), ou + ' : même verdict (couleur) face à ' + nom);
        assert.equal(x.detail[nom].titre, 'Tarif d\'achat net ' + nom);
      }
      for (const lib of ['CIP', 'Pharmacies', 'PPHT', 'Moy. France/an', 'Rotation', 'Marge pharma.']) assert.equal(x.detail[lib].v, o[lib].v, ou + ' · ' + lib);
      const barre = /mol-ppht/.test(o.PPHT.cls);
      assert.equal(/mol-ppht/.test(x.detail.PPHT.attr), barre, ou + ' : PPHT barré comme à l’ordinateur');
      barre ? vus.barre++ : vus.clair++;
      if (/Génériques/.test(x.famille)) { vus.gen++; assert.equal(x.abandon, 'abandon —', ou + ' : générique, aucun abandon de marge'); assert.equal(barre, false); }
      if (reglage) { vus.stock++; assert.equal(x.detail.Stock.v, o.Stock.v, ou + ' · Stock'); assert.equal(x.ordre[x.ordre.length - 1], 'Stock'); }
      else assert.equal(x.detail.Stock, undefined, ou + ' : pas de stock sans établissement choisi');
      assert.equal(x.ordre.length, 6 + tiers.length + (reglage ? 1 : 0), ou + ' : rien d’autre dans le détail');
    });
    // étalonnage : la comparaison a bien vu chaque cas
    assert.ok(vus.barre > 5 && vus.clair > 5 && vus.tiers >= 2 && vus.gen >= 3, JSON.stringify(vus));
    if (reglage) assert.equal(vus.stock, 30);
  }
});

test('téléphone : « Voir 30 de plus » ajoute la suite sous les lignes déjà là, sans les redessiner, puis s’en va', () => {
  const p = monter({ tel: true }).arriver();
  const avant = p.tbody();
  p.V2.molPlus30();
  assert.equal(p.tbody(), avant, 'les 30 premières lignes ne sont pas réécrites (une fiche ouverte reste ouverte)');
  let l = p.lignes();
  assert.equal(l.length, 60);
  assert.deepEqual([l[29].rang, l[30].rang, l[59].rang], [30, 31, 60], 'la suite se numérote à partir de 31');
  assert.deepEqual(p.fin(), { bouton: 'Voir 15 de plus', compte: '60 produits affichés sur 75' }, 'il n’en reste que 15 : le bouton le dit');
  assert.equal(p.compte(), '60 affichés sur 75');
  p.V2.molPlus30();
  l = p.lignes();
  assert.equal(l.length, 75);
  assert.equal(l[74].rang, 75);
  assert.equal(p.fin(), null, 'tout est affiché : plus de bouton');
  assert.equal(p.compte(), '75 produits');
  // mêmes produits, dans le même ordre, que le tableau de l'ordinateur
  const r = rangees(monter({ tel: false }).arriver().tbody());
  assert.deepEqual(l.map((x) => x.nom), r.map((x) => x.Produit.v));
});

test('téléphone : un tri, une recherche ou un filtre repartent des 30 premiers', () => {
  const p = monter({ tel: true }).arriver();
  p.V2.molPlus30();
  assert.equal(p.lignes().length, 60, 'marqueur : 60 lignes avant le tri');
  p.V2.molSort('rota');
  let l = p.lignes();
  assert.equal(l.length, 30, 'tri : 30');
  assert.equal(l[0].nom, 'Produit 003', 'trié par rotation : le produit 003 d’abord');
  assert.deepEqual(p.fin(), { bouton: 'Voir 30 de plus', compte: '30 produits affichés sur 75' });
  p.V2.molPlus30();
  p.V2.molSearch('produit 0');
  l = p.lignes();
  assert.equal(l.length, 30, 'recherche : 30');
  assert.equal(p.compte(), '30 affichés sur 73');
  p.V2.molSearch('produit 00');
  assert.equal(p.lignes().length, 7, 'Produit 003 à 009');
  assert.equal(p.fin(), null, '30 produits ou moins : pas de bouton');
  assert.equal(p.compte(), '7 produits');
  p.V2.molSearch('');
  p.V2.molPlus30();
  p.V2.molFilter('gen');
  l = p.lignes();
  assert.equal(l.length, 12, 'filtre « Génériques » : 12 produits');
  assert.ok(l.every((x) => x.famille === 'Génériques'));
  p.V2.molFilter('all');
  assert.equal(p.lignes().length, 30, 'retour à « Tout » : 30, pas 60');
});

test('téléphone : chaque arrivée sur l’écran repart de 30 ; un redessin sur place garde la suite déjà demandée', () => {
  const p = monter({ tel: true }).arriver();
  p.V2.molPlus30();
  p.V2.render();   // la page se redessine sans qu'on l'ait quittée (prix d'établissement arrivés, option du document…)
  assert.equal(p.lignes().length, 60, 'redessin sur place : les 60 lignes restent');
  assert.deepEqual(p.fin(), { bouton: 'Voir 15 de plus', compte: '60 produits affichés sur 75' });
  p.arriver();
  assert.equal(p.lignes().length, 30, 'revenu d’un autre écran : 30');
});

test('téléphone : aucun résultat — le message et le bouton d’avant, pas de ligne ni de « Voir plus »', () => {
  const p = monter({ tel: true }).arriver(), o = monter({ tel: false }).arriver();
  p.V2.molSearch('zzz'); o.V2.molSearch('zzz');
  assert.match(p.tbody(), /Aucun résultat pour « zzz »\./);
  assert.equal(p.tbody(), o.tbody(), 'la même rangée qu’à l’ordinateur');
  assert.equal(p.fin(), null);
});

test('le seuil des 640 px franchi (téléphone tourné) : la liste se redessine dans l’autre forme', () => {
  const p = monter({ tel: true }).arriver();
  assert.equal(p.etat.seuil.length, 1, 'un seul écouteur posé sur la largeur');
  assert.equal(p.lignes().length, 30);
  p.etat.tel = false; p.etat.seuil[0]();
  assert.equal(p.lignes().length, 0);
  assert.equal(rangees(p.tbody()).length, 75, 'au-dessus de 640 px : le tableau');
  p.etat.tel = true; p.etat.seuil[0]();
  assert.equal(p.lignes().length, 30, 'revenu sous 640 px : les lignes');
  p.V2.route.name = 'home'; p.etat.tel = false; p.etat.seuil[0]();
  assert.equal(p.lignes().length, 30, 'sur un autre écran, l’écouteur ne touche à rien');
});

test('feuille de style : tout ce qui habille les lignes est dans un @media de 640 px ou moins ; cibles et textes aux tailles demandées', () => {
  const rs = regles(monter({ tel: true }).css());
  const neuves = rs.filter((r) => /\.mol-lg|\.mol-plus30/.test(r.sel));
  assert.ok(neuves.length >= 20, 'marqueur : les règles des lignes sont bien lues (' + neuves.length + ')');
  for (const r of neuves) assert.ok(sousTelephone(r), r.sel + ' doit être sous @media (max-width:640px)');
  const d = (sel) => { const r = neuves.find((x) => x.sel === sel); assert.ok(r, 'règle attendue : ' + sel); return r.decl; };
  assert.match(d('.mol-lg>summary'), /min-height:66px/, 'la ligne : 66 px de haut, toute la largeur (cible de 44 px tenue)');
  assert.match(d('html .mol-plus30 .mol-plus30-b'), /min-height:48px/, 'le bouton : 48 px');
  // La fin de liste est la 2e rangée du tableau : la règle « rangées paires en blanc » du téléphone la peindrait. Même poids, écrite après : elle gagne.
  assert.match(d('.mol-table tbody tr.mol-plus30'), /background:none/, 'la fin de liste reste sur le fond de la page');
  const paires = rs.findIndex((r) => r.sel === '.mol-table tbody tr:nth-child(even)' && sousTelephone(r)), finL = rs.findIndex((r) => r.sel === '.mol-table tbody tr.mol-plus30');
  assert.ok(paires >= 0 && finL > paires, 'la règle de fin de liste vient après celle des rangées paires');
  assert.match(d('.mol-table tbody tr.mol-lgw'), /border:1px solid var\(--line\)/, 'le contour fin remplace le liseré de 4 px');
  assert.doesNotMatch(d('.mol-table tbody tr.mol-lgw'), /--rowc|border-left/);
  assert.match(d('.mol-lg[open]>summary svg'), /rotate\(90deg\)/, 'le chevron tourne à l’ouverture');
  for (const r of neuves) for (const m of r.decl.matchAll(/font-size:([\d.]+)px/g)) assert.ok(+m[1] >= 12, r.sel + ' : texte de ' + m[1] + ' px');
  // l'ordinateur garde ses règles : la table, son liseré de famille et sa ligne « 200 produits affichés »
  const hors = rs.filter((r) => !sousTelephone(r));
  assert.ok(hors.some((r) => r.sel === '.mol-table tbody tr' && /inset 3px 0 0 var\(--rowc,transparent\)/.test(r.decl)), 'le liseré de l’ordinateur est toujours là');
  assert.ok(!hors.some((r) => /mol-lg|mol-plus30/.test(r.sel)), 'aucune règle des lignes hors du téléphone');
});

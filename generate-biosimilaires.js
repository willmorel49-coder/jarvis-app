#!/usr/bin/env node
// ============================================================================
// ROBOT — Base Biosimilaires France
// Croise le référentiel officiel (biosim-referentiel.js) avec les données
// internes JARVIS (catalogue, benchmark, ventes Ameli, stock, prix établ.,
// stats molécule) sur la clé CIP13 + la DCI.
// Sorties : crm/v2/biosimilaires-data.js  (window.BIOSIMILAIRES)
//           biosimilaires-export.json     (pour l'Excel)
// Aucune dépendance externe. node generate-biosimilaires.js
// ============================================================================
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = __dirname;
const CRM = path.join(ROOT, "crm");
const V2 = path.join(CRM, "v2");

const { BIOSIM_REFERENTIEL, PARTENAIRES_IP, ACTEURS_MAJEURS } =
  require("./biosim-referentiel.js");

// ---- Chargeur de fichier de données JS (const OU window.X) -----------------
function loadNames(file, names) {
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: {}, module: { exports: {} }, console };
  sandbox.globalThis = sandbox;
  const epilogue =
    "\n;globalThis.__RESULT = (function(){var o={};" +
    names
      .map(
        (n) =>
          `try{o[${JSON.stringify(n)}] = (typeof ${n}!=='undefined')?${n}:window[${JSON.stringify(
            n
          )}];}catch(e){o[${JSON.stringify(n)}]=window[${JSON.stringify(n)}];}`
      )
      .join("") +
    "return o;})();";
  vm.createContext(sandbox);
  vm.runInContext(code + epilogue, sandbox, { filename: file, timeout: 60000 });
  return sandbox.__RESULT || {};
}

console.log("→ chargement des données JARVIS…");
const cat = loadNames(path.join(CRM, "catalogue-ip.js"), ["CATALOGUE_IP"]).CATALOGUE_IP || [];
const bench = loadNames(path.join(CRM, "benchmark-data.js"), ["BENCHMARK"]).BENCHMARK || [];
const molStats = loadNames(path.join(V2, "mol-stats-data.js"), ["MOL_STATS"]).MOL_STATS || [];
const amBoxes = loadNames(path.join(CRM, "ameli-boxes-data.js"), ["AMELI_2025"]).AMELI_2025 || {};
const amAvg = (loadNames(path.join(V2, "ameli-avg-data.js"), ["AMELI_AVG"]).AMELI_AVG || {}).data || {};
const stock = loadNames(path.join(CRM, "stock.js"), ["STOCK"]).STOCK || {};
const etabPrices = loadNames(path.join(V2, "etab-prices-data.js"), ["ETAB_PRICES"]).ETAB_PRICES || {};
const mktNr = loadNames(path.join(V2, "mkt-nr-data.js"), ["MKT_NR"]).MKT_NR || {};
const PPHT = loadNames(path.join(V2, "ppht-data.js"), ["PPHT"]).PPHT || {}; // tarif grossiste HT par CIP13 (TOUS produits)
const estab = loadNames(path.join(CRM, "establishments-aggregate.js"), [
  "OPS_AGGREGATE", "CPR_AGGREGATE", "HP_AGGREGATE",
  "MSP_AGGREGATE", "POS_AGGREGATE", "SEP_AGGREGATE", "SOP_AGGREGATE",
]);

// ---- Index par CIP13 -------------------------------------------------------
const cip7to13 = {};   // pont CIP7 -> CIP13
const byCip13 = {};    // cip13 -> agrégat multi-sources
function slot(cip13) {
  if (!cip13) return null;
  if (!byCip13[cip13]) byCip13[cip13] = { cip13, designations: [], labos: [] };
  return byCip13[cip13];
}
function pushLabo(s, l) {
  if (l && l !== "#N/A" && !s.labos.includes(l)) s.labos.push(l);
}
function pushDesign(s, d) {
  if (d && !s.designations.includes(d)) s.designations.push(d);
}

// catalogue (ean = CIP13)
for (const p of cat) {
  const s = slot(String(p.ean));
  if (!s) continue;
  pushDesign(s, p.nom);
  s.dans_catalogue = true;
  s.cat_prix_ht = p.prix_ht;
  s.cat_prix_ip = p.prix_ip;
  s.cat_remise = p.remise_pct;
  if (p.molecule) s.molecule = p.molecule;
}
// benchmark (cip13)
for (const b of bench) {
  const s = slot(String(b.cip13));
  if (!s) continue;
  pushDesign(s, b.designation);
  s.atc2 = b.atc2;
  s.artnature = b.artnature;
  if (b.prix_ht != null) s.bench_prix_ht = b.prix_ht;
  if (b.prix_ip != null) s.bench_prix_ip = b.prix_ip;
  if (b.remise_pct != null) s.bench_remise = b.remise_pct;
  s.ip_qty = (s.ip_qty || 0) + (b.ip_qty || 0);
  s.ip_ca = (s.ip_ca || 0) + (b.ip_ca || 0);
  if (b.ameli_total != null) s.ameli_total = b.ameli_total;
}
// ameli boxes (cip13)
for (const [cip13, v] of Object.entries(amBoxes)) {
  const s = slot(cip13);
  pushDesign(s, v.lib);
  s.ameli_boxes = v.b;
  s.ameli_ca = v.ca;
  s.ameli_nbc = v.nbc;
}
// ameli avg (cip13)
for (const [cip13, v] of Object.entries(amAvg)) {
  const s = slot(cip13);
  s.boites_par_pharma_an = v;
}
// stock (cip7 -> ean cip13) — fichier-pont
for (const [cip7, v] of Object.entries(stock)) {
  if (v.ean) cip7to13[cip7] = String(v.ean);
  const s = slot(String(v.ean || ""));
  if (!s) continue;
  pushDesign(s, v.nom);
  pushLabo(s, v.collection);
  if (v.mol) s.molecule = v.mol;
  s.stock_dispo = (s.stock_dispo || 0) + (v.dispo || 0);
  s.stock_commande = (s.stock_commande || 0) + (v.commande || 0);
}
// etab-prices (cip13 imbriqué par établissement)
if (etabPrices.prices) {
  for (const perEtab of Object.values(etabPrices.prices)) {
    for (const [cip13, arr] of Object.entries(perEtab)) {
      const s = slot(cip13);
      const [ppht, stk] = arr;
      if (ppht != null && (s.etab_ppht == null || ppht < s.etab_ppht)) s.etab_ppht = ppht;
      s.etab_stock = (s.etab_stock || 0) + (stk || 0);
    }
  }
}
// mkt-nr (cip = cip13)
if (mktNr.cats) {
  for (const c of mktNr.cats) {
    for (const r of c.rows || []) {
      const s = slot(String(r.cip));
      pushDesign(s, r.d);
      pushLabo(s, r.lab);
      if (r.p != null) s.nr_prix = r.p;
      s.nr_ca = (s.nr_ca || 0) + (r.ca || 0);
      s.nr_vol = (s.nr_vol || 0) + (r.vol || 0);
    }
  }
}
// establishments aggregate (cip7 -> ean cip13, collection = labo, ca/qte internes)
for (const [name, agg] of Object.entries(estab)) {
  if (!agg || typeof agg !== "object") continue;
  for (const [cip7, v] of Object.entries(agg)) {
    const cip13 = v.ean ? String(v.ean) : cip7to13[cip7];
    if (v.ean) cip7to13[cip7] = String(v.ean);
    const s = slot(cip13);
    if (!s) continue;
    pushDesign(s, v.designation);
    pushLabo(s, v.collection);
    s.ip_intern_ca = (s.ip_intern_ca || 0) + (v.ca || 0);
    s.ip_intern_qte = (s.ip_intern_qte || 0) + (v.qte || 0);
  }
}

// PPHT officiel (tarif grossiste) par CIP13 sur les produits déjà indexés
for (const [cip13, s] of Object.entries(byCip13)) {
  if (PPHT[cip13] != null) s.ppht_official = PPHT[cip13];
}

// Barème d'abandon de marge Intégral : net = PPHT − (0,18€ ≤4,33€ / 3,89% ≤468€ / 19,50€ au-delà)
function abBareme(pp) { if (pp <= 4.33) return 0.18; if (pp <= 468) return Math.round(pp * 0.0389 * 100) / 100; return 19.5; }

// mol-stats par DCI (MAJUSCULES)
const molIndex = {};
for (const m of molStats) molIndex[(m.m || "").toUpperCase()] = m;

// ---- Utilitaires de matching marque -> produits ----------------------------
const STOP = new Set([]);
function norm(s) {
  return (s || "").toString().toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function brandKeys(nom) {
  // mots distinctifs (>=4 lettres) de la marque, hors mots génériques
  const words = norm(nom).replace(/\(.*?\)/g, " ").split(/[^A-Z0-9]+/).filter(Boolean);
  let keys = words.filter((w) => w.length >= 4 && !STOP.has(w));
  if (!keys.length) keys = words.filter((w) => w.length >= 4);
  return [...new Set(keys)];
}
function partnerMatch(labo) {
  const L = norm(labo);
  return PARTENAIRES_IP.some((p) => L.includes(norm(p)) || norm(p).includes(L) && L.length > 1);
}
function majorMatch(labo) {
  const L = norm(labo);
  return ACTEURS_MAJEURS.some((p) => L.includes(norm(p)));
}

const atc2Of = (mol) => norm(mol.atc).slice(0, 3);

// Trouve les CIP13 correspondant à une marque dans le contexte d'une molécule
function matchProducts(brandNom, mol) {
  const wantAtc2 = atc2Of(mol);
  const wantMol = norm(mol.dci);
  // mots de la DCI (génériques) : ne PAS matcher dessus seuls, sinon
  // "Enoxaparine Teva" attraperait TOUS les produits enoxaparine.
  const dciTokens = new Set(wantMol.split(/[^A-Z0-9]+/).filter((w) => w.length >= 4));
  const allKeys = brandKeys(brandNom);
  const distinctive = allKeys.filter((k) => !dciTokens.has(k)); // token de marque/labo
  const dciInBrand = allKeys.filter((k) => dciTokens.has(k));   // mot-molécule dans la marque
  const keys = distinctive.length ? distinctive : allKeys;
  const hits = [];
  for (const s of Object.values(byCip13)) {
    const desigs = s.designations.map(norm);
    const hasKey = keys.some((k) => desigs.some((d) => d.includes(k)));
    if (!hasKey) continue;
    // marque du type "DCI + labo" (ex: "Enoxaparine Teva") : exiger AUSSI
    // le mot-molécule dans la désignation → écarte les autres produits du labo.
    if (dciInBrand.length && !dciInBrand.every((k) => desigs.some((d) => d.includes(k)))) continue;
    // garde-fou : cohérence ATC (niveau 2) ou molécule connue
    const atcOk = s.atc2 ? norm(s.atc2) === wantAtc2 : true;
    const molOk = s.molecule ? norm(s.molecule).includes(wantMol) || wantMol.includes(norm(s.molecule)) : true;
    if (!atcOk && !molOk) continue;
    hits.push(s);
  }
  return hits;
}

// arrondis lisibles
function roundE(e) {
  for (const k of ["ameli_ca", "ip_ca", "ip_intern_ca", "prix_ppht", "prix_ip"]) {
    if (typeof e[k] === "number") e[k] = Math.round(e[k] * 100) / 100;
  }
  return e;
}

// ---- Construction de la base ----------------------------------------------
console.log("→ croisement…");
const molecules = BIOSIM_REFERENTIEL.map((mol) => {
  const ms = molIndex[norm(mol.dci)] || null;
  // princeps de référence
  const refProducts = matchProducts(mol.reference, mol);
  const refEnrich = roundE(enrichNoRound(refProducts, mol.reference_labo));

  const biosimilaires = mol.biosimilaires.map((bs) => {
    const products = matchProducts(bs.nom, mol);
    const en = roundE(enrichNoRound(products, bs.labo, bs.distrib));
    return { ...bs, partenaire: en.partenaire, acteur_majeur: en.acteur_majeur, ...en };
  });

  // ── Pack STANDARD de la molécule (pour un poster comparable marque à marque) ──
  // On prend le PPHT le plus fréquent parmi toutes les présentations (le pack que
  // la plupart des marques partagent), départagé par le volume Ameli. Puis pour
  // chaque marque on retient sa présentation la plus proche de ce PPHT standard.
  const allCands = [refEnrich, ...biosimilaires].flatMap((e) => e.cands || []);
  const freq = {};
  for (const c of allCands) {
    const k = c.ppht.toFixed(2);
    if (!freq[k]) freq[k] = { ppht: c.ppht, n: 0, boxes: 0 };
    freq[k].n++; freq[k].boxes += c.boxes;
  }
  const modes = Object.values(freq).sort((a, b) => b.n - a.n || b.boxes - a.boxes || b.ppht - a.ppht);
  const stdPpht = modes.length ? modes[0].ppht : null;
  function applyStd(e) {
    e.prix_ppht_std = null; e.prix_ip_std = null; e.abandon_std = null; e.prix_pack_std = null;
    if (stdPpht == null || !e.cands || !e.cands.length) { delete e.cands; return; }
    let best = null;
    for (const c of e.cands) {
      const d = Math.abs(c.ppht - stdPpht);
      if (!best || d < best.d || (d === best.d && c.boxes > best.c.boxes)) best = { c, d };
    }
    if (best) {
      e.prix_ppht_std = Math.round(best.c.ppht * 100) / 100;
      e.prix_ip_std = Math.round(best.c.net * 100) / 100;
      e.prix_pack_std = best.c.design || null;
      e.abandon_std = best.c.ppht > 0 ? Math.round(((best.c.ppht - best.c.net) / best.c.ppht) * 1000) / 10 : null;
    }
    delete e.cands; // ne pas alourdir la sortie
  }
  applyStd(refEnrich);
  biosimilaires.forEach(applyStd);

  // ── Toutes les présentations (formes/dosages) de la molécule, avec PPHT + net IP ──
  // On normalise la désignation (dosage + dispositif + nb) pour fusionner les
  // orthographes multiples des sources ; on garde distinct par (forme × PPHT).
  function parseForm(d) {
    let s = " " + String(d || "").toUpperCase().replace(/,/g, ".").replace(/µ/g, "U") + " ";
    s = s.replace(/(\d)\s+(\d)/g, "$1$2"); // « 10 000UI » → « 10000UI »
    const dm = s.match(/(\d+(?:\.\d+)?)\s*(MUI|MU|MG|MICROGRAMMES?|MCG|UG|UI)/);
    let dose = "";
    if (dm) {
      let u = dm[2];
      if (u === "MU") u = "MUI"; else if (/MICROGRAMMES?|MCG|UG/.test(u)) u = "µg";
      dose = dm[1].replace(/\.0$/, "") + " " + u;
    }
    const dev = /STYL/.test(s) ? "stylo" : (/SER|SRG|SERG/.test(s) ? "seringue" : (/CPR|COMP/.test(s) ? "comprimé" : ""));
    const nums = s.match(/\b\d+\b/g) || [];
    let cnt = nums.length ? nums[nums.length - 1] : "";
    if (cnt === "0") cnt = "";
    return { dose, dev, cnt };
  }
  // groupe par (dosage × nb × PPHT) ; le dispositif (stylo/seringue) départage
  // à l'intérieur, et les lignes sans dispositif sont absorbées si un dispositif existe.
  const grp = {};
  for (const c of allCands) {
    const f = parseForm(c.design);
    const ppht = Math.round(c.ppht * 100) / 100;
    const gk = f.dose + "|" + f.cnt + "|" + ppht.toFixed(2);
    if (!grp[gk]) grp[gk] = { dose: f.dose, cnt: f.cnt, ppht, net: Math.round(c.net * 100) / 100, devs: new Set() };
    if (f.dev) grp[gk].devs.add(f.dev);
  }
  const presentations = [];
  for (const g of Object.values(grp)) {
    const devs = g.devs.size ? [...g.devs] : [""];
    for (const dev of devs) {
      presentations.push({
        form: (g.dose || "autre présentation") + (dev ? " · " + dev : "") + (g.cnt ? " × " + g.cnt : ""),
        ppht: g.ppht, net: g.net,
        abandon: g.ppht > 0 ? Math.round(((g.ppht - g.net) / g.ppht) * 1000) / 10 : null,
      });
    }
  }
  presentations.sort((a, b) => a.ppht - b.ppht || a.form.localeCompare(b.form));

  // rollups molécule
  const ameli_boxes_total = biosimilaires.reduce((a, b) => a + b.ameli_boxes, 0) + refEnrich.ameli_boxes;
  const biosim_ameli_boxes = biosimilaires.reduce((a, b) => a + b.ameli_boxes, 0);
  const penetration = ameli_boxes_total > 0 ? Math.round((biosim_ameli_boxes / ameli_boxes_total) * 100) : null;
  const referenced_ip = biosimilaires.some((b) => b.cips.length > 0) || refEnrich.cips.length > 0;
  const has_partenaire = biosimilaires.some((b) => b.partenaire);

  return {
    dci: mol.dci, atc: mol.atc, aire: mol.aire,
    reference: mol.reference, reference_labo: mol.reference_labo,
    canal: mol.canal, substituable: mol.substituable,
    substituable_date: mol.substituable_date, note: mol.note || null,
    reference_enrich: refEnrich,
    biosimilaires, presentations,
    mol_stats: ms ? { pharmacies: ms.n, rotation: ms.rota, marge: ms.marge, remise: ms.remise, ca_pharma_an: ms.ca } : null,
    ameli_boxes_total, biosim_ameli_boxes, penetration,
    referenced_ip, has_partenaire,
    nb_biosim: mol.biosimilaires.length,
  };
});

// helper défini après usage (hoisting des fonctions déclarées)
function enrichNoRound(products, refLabo, distrib) {
  const e = {
    cips: [], labos_reels: [], dans_catalogue: false,
    ameli_boxes: 0, ameli_ca: 0, ip_qty: 0, ip_ca: 0,
    ip_intern_ca: 0, ip_intern_qte: 0, stock_dispo: 0,
    prix_ppht: null, prix_ip: null, abandon_pct: null,
    prix_pack: null, boites_par_pharma_an: 0,
  };
  let lead = null; // pack dominant : la présentation la plus vendue (Ameli) qui a un PPHT
  e.cands = [];    // tous les prix candidats (pour choisir un pack standard au niveau molécule)
  for (const s of products) {
    e.cips.push(s.cip13);
    for (const l of s.labos) if (!e.labos_reels.includes(l)) e.labos_reels.push(l);
    if (s.dans_catalogue) e.dans_catalogue = true;
    e.ameli_boxes += s.ameli_boxes || 0;
    e.ameli_ca += s.ameli_ca || 0;
    e.ip_qty += s.ip_qty || 0;
    e.ip_ca += s.ip_ca || 0;
    e.ip_intern_ca += s.ip_intern_ca || 0;
    e.ip_intern_qte += s.ip_intern_qte || 0;
    e.stock_dispo += (s.stock_dispo || 0) + (s.etab_stock || 0);
    e.boites_par_pharma_an += s.boites_par_pharma_an || 0;
    // PPHT de la présentation (priorité : catalogue > benchmark > tarif PPHT officiel > étab > NR)
    const ppht = s.cat_prix_ht ?? s.bench_prix_ht ?? s.ppht_official ?? s.etab_ppht ?? s.nr_prix;
    if (ppht == null) continue;
    // net IP réel si connu (catalogue/benchmark), sinon calculé PPHT − barème d'abandon
    const netReal = s.cat_prix_ip ?? s.bench_prix_ip ?? null;
    const cand = { cip: s.cip13, ppht, net: netReal != null ? netReal : Math.round((ppht - abBareme(ppht)) * 100) / 100, boxes: s.ameli_boxes || 0, design: (s.designations[0] || "") };
    e.cands.push(cand);
    // pack dominant (page CRM) = la présentation la plus vendue ; départage par PPHT.
    if (!lead || cand.boxes > lead.boxes || (cand.boxes === lead.boxes && cand.ppht > lead.ppht)) lead = cand;
  }
  if (lead) {
    e.prix_ppht = lead.ppht;
    e.prix_ip = lead.net;
    e.prix_pack = lead.design || null;
    e.abandon_pct = lead.ppht > 0 ? Math.round(((lead.ppht - lead.net) / lead.ppht) * 1000) / 10 : null;
  }
  const allLabos = [refLabo, distrib, ...e.labos_reels].filter(Boolean);
  e.partenaire = allLabos.some(partnerMatch);
  e.distrib = distrib || null;
  e.acteur_majeur = allLabos.some(majorMatch);
  e.disponible_ip = e.cips.length > 0 &&
    (e.ameli_boxes > 0 || e.ip_qty > 0 || e.stock_dispo > 0 || e.dans_catalogue || e.ip_intern_ca > 0);
  return e;
}

// ---- Méta & totaux ---------------------------------------------------------
const meta = {
  genere_le: process.env.GEN_DATE || "2026-07-10",
  source: "biosim-referentiel.js (ANSM/Ameli/EMA) × données JARVIS",
  nb_molecules: molecules.length,
  nb_biosimilaires: molecules.reduce((a, m) => a + m.biosimilaires.length, 0),
  nb_substituables: molecules.filter((m) => m.substituable).length,
  nb_molecules_ville: molecules.filter((m) => m.canal === "ville" || m.canal === "mixte").length,
  nb_molecules_ref_ip: molecules.filter((m) => m.referenced_ip).length,
  nb_biosim_partenaire: molecules.reduce((a, m) => a + m.biosimilaires.filter((b) => b.partenaire).length, 0),
  partenaires_ip: PARTENAIRES_IP,
  acteurs_majeurs: ACTEURS_MAJEURS,
};

const out = { meta, molecules };

// ---- Écriture --------------------------------------------------------------
fs.writeFileSync(path.join(ROOT, "biosimilaires-export.json"), JSON.stringify(out, null, 2));
const header =
  "// Base Biosimilaires France — généré par generate-biosimilaires.js\n" +
  `// ${meta.genere_le} · ${meta.nb_molecules} molécules · ${meta.nb_biosimilaires} biosimilaires · ` +
  `${meta.nb_substituables} substituables officine\n` +
  "// Source : référentiel officiel ANSM/Ameli/EMA × données réseau Intégral\n";
fs.writeFileSync(
  path.join(V2, "biosimilaires-data.js"),
  header + "window.BIOSIMILAIRES = " + JSON.stringify(out) + ";\n"
);

console.log("✓ écrit crm/v2/biosimilaires-data.js et biosimilaires-export.json");
console.log(`  ${meta.nb_molecules} molécules · ${meta.nb_biosimilaires} biosimilaires · ` +
  `${meta.nb_substituables} substituables · ${meta.nb_molecules_ref_ip} molécules référencées IP · ` +
  `${meta.nb_biosim_partenaire} biosim partenaires`);

// Audit des regex SEASON_THEMES / CAT_THEMES vs BENCHMARK réel
// Lancement : node tasks/marketing-themes-audit.js
const fs = require('fs');
const raw = fs.readFileSync('/Users/williammorel/JARVIS/APP/crm/benchmark-data.js', 'utf8');
const sandbox = {};
const wrapper = new Function('sandbox', raw + '\nsandbox.BENCHMARK = BENCHMARK;');
wrapper(sandbox);
const BENCHMARK = sandbox.BENCHMARK;
console.log(`Loaded ${BENCHMARK.length} products from BENCHMARK\n`);

// ============================
// VERSIONS ACTUELLES
// ============================
const SEASON_THEMES_CURRENT = [
  { id: 'allergies', name: 'Allergies printemps',
    filter: b => /CETIRIZIN|LORATADIN|DESLORATADIN|FEXOFEN|EBASTINE|RUPATADINE|BILASTINE|MIZOLAST|AERIUS|TELFAST|XYZALL|WYSTAMM/i.test(b.designation) || b.atc2 === 'R06' || b.atc2 === 'R01' },
  { id: 'solaire', name: 'Solaire & moustiques',
    filter: b => /SOLAIRE|UVA|UVB|SPF|APRES-SOLEIL|COUP DE SOLEIL|MOUSTIQ|REPULSI|INSECT|PIQUR/i.test(b.designation) },
  { id: 'immunite', name: 'Rentrée immunité',
    filter: b => /VITAMINE|MAGNES|PROBIOT|DEFENSE|IMMUNI|ZINC|FER|GINSENG|GUARANA/i.test(b.designation) },
  { id: 'grippe', name: 'Grippe & vaccins hiver',
    filter: b => /VACCIN|GRIPPE|INFLUVAC|VAXIGRIP|EFLUELDA|FLUARIX|OSELTAMIVIR|TAMIFLU|PARACETAM|DOLIPRANE|EFFERALG/i.test(b.designation) },
  { id: 'rhume', name: 'Rhume & toux',
    filter: b => /RHUME|TOUX|RHINO|NASAL|PASTIL|FERVEX|HUMEX|ACTIFED|DOLIRHUME|STREPSIL|DRILL|ANGINEX|FLUIDIFI|EXPECTOR/i.test(b.designation) },
  { id: 'gastro', name: 'Gastro hiver',
    filter: b => /SMECTA|TIORFAN|LOPERAM|IMODIUM|DIOSMECTIT|ULTRA-LEVURE|SACCHAROMYC|VOGAL|MOTILIUM|ANTIDIARR|SRO|ADIARIL/i.test(b.designation) },
];

const CAT_THEMES_CURRENT = [
  { id: 'biosim', name: 'Biosimilaires',
    filter: b => b.artnature === 'biosimilaire' || b.atc2 === 'L04' || /PELGRAZ|PELMEG|AMGEVITA|HYRIMOZ|HULIO|IDACIO|YUFLYMA|HUKYNDRA|LIBMYRIS|IMRALDI|AMSPARITY|RETACRIT|BINOCRIT|BENEPALI|ERELZI|NEPEXTO|NIVESTIM|ZARZIO|GRASUSTEK|STIMUFEND|STEQEYMA|UZPRUVO|WEZENLA|PYZCHIVA|RANIVISIO|XIMLUCI|BYOOVIZ|MOVYMIA|SONDELBAY|LIVOGIVA|EYDENZELT|PAVBLU|AFQLIR|BEMFOLA|OVALEAP/i.test(b.designation) },
  { id: 'cardio', name: 'Génériques cardio',
    filter: b => ['C09','C10','C07','C08','C03'].includes(b.atc2) },
  { id: 'diabete', name: 'Génériques diabète',
    filter: b => b.atc2 === 'A10' && !/WEGOVY|MOUNJARO|OZEMPIC|SAXENDA|TRULICITY|VICTOZA|RYBELSUS/i.test(b.designation) },
  { id: 'glp1', name: 'GLP-1',
    filter: b => /WEGOVY|MOUNJARO|OZEMPIC|SAXENDA|TRULICITY|VICTOZA|RYBELSUS/i.test(b.designation) },
  { id: 'vaccins', name: 'Vaccins',
    filter: b => /VACCIN|INFLUVAC|VAXIGRIP|EFLUELDA|GARDASIL|ENGERIX|REPEVAX|BOOSTRIX|INFANRIX|HEXYON|PRIORIX|PREVENAR|NIMENRIX|MENJUGATE|MENVEO|TICOVAC|HAVRIX|AVAXIM|TWINRIX|SHINGRIX|BEXSERO|TRUMENBA|ROTARIX|ROTATEQ|CAPVAXIVE|VAXNEUVANCE|VAXELIS|VARIVAX|VARILRIX|ABRYSVO|BEYFORTUS/i.test(b.designation) },
  { id: 'femme', name: 'Santé féminine',
    filter: b => b.atc2 === 'G03' || /OESTROGEN|PROGESTER|CONTRACEPTI|MENOPAUS|REGLE|MENSTRU|OVULE/i.test(b.designation) },
  { id: 'sildenafil', name: 'Sildénafil / Tadalafil',
    filter: b => /SILDENAFIL|TADALAFIL|VARDENAFIL|VIAGRA|CIALIS|LEVITRA/i.test(b.designation) },
  { id: 'top', name: 'Top rotations IP',
    filter: b => b.ip_rank_qty && b.ip_rank_qty <= 50 },
];

// ============================
// VERSIONS PROPOSEES
// ============================
const SEASON_THEMES_PROPOSED = [
  { id: 'allergies', name: 'Allergies printemps',
    filter: b => /CETIRIZIN|LORATADIN|DESLORATADIN|FEXOFEN|EBASTINE|RUPATADINE|BILASTINE|MIZOLAST|AERIUS|TELFAST|XYZALL|WYSTAMM/i.test(b.designation) || b.atc2 === 'R06' },
  { id: 'solaire', name: 'Solaire & moustiques',
    filter: b => /SOLAIRE|UVA|UVB|\bSPF\b|APRES-SOLEIL|COUP DE SOLEIL|MOUSTIQ|REPULSI|INSECT|PIQUR|BIAFINE|APRES SOLEIL|PHOTODERM/i.test(b.designation) },
  { id: 'immunite', name: 'Rentrée immunité',
    filter: b => /VITAMINE|MAGNES|PROBIOT|DEFENSE|IMMUNI|\bZINC\b|GINSENG|GUARANA|ECHINACEA|PROPOLIS|ACEROLA|GELEE ROYALE/i.test(b.designation) },
  { id: 'grippe', name: 'Grippe & vaccins hiver',
    filter: b => /\bGRIPPE\b|INFLUVAC|VAXIGRIP|EFLUELDA|FLUARIX|OSELTAMIVIR|TAMIFLU|FERVEX/i.test(b.designation) },
  { id: 'rhume', name: 'Rhume & toux',
    filter: b => /RHUME|\bTOUX\b|RHINO|NASAL|PASTIL|FERVEX|HUMEX|ACTIFED|DOLIRHUME|STREPSIL|\bDRILL\b|ANGINEX|FLUIDIFI|EXPECTOR|VICKS|MAXILASE|HEXTRIL|HEXASPRAY/i.test(b.designation) },
  { id: 'gastro', name: 'Gastro hiver',
    filter: b => /SMECTA|TIORFAN|LOPERAM|IMODIUM|DIOSMECTIT|ULTRA-LEVURE|SACCHAROMYC|VOGAL|MOTILIUM|ANTIDIARR|\bSRO\b|ADIARIL|DOMPERIDON|METOCLOPRAM/i.test(b.designation) },
];

const CAT_THEMES_PROPOSED = [
  { id: 'biosim', name: 'Biosimilaires',
    filter: b => b.artnature === 'biosimilaire' || /PELGRAZ|PELMEG|AMGEVITA|HYRIMOZ|HULIO|IDACIO|YUFLYMA|HUKYNDRA|LIBMYRIS|IMRALDI|AMSPARITY|RETACRIT|BINOCRIT|BENEPALI|ERELZI|NEPEXTO|NIVESTIM|ZARZIO|GRASUSTEK|STIMUFEND|STEQEYMA|UZPRUVO|WEZENLA|PYZCHIVA|RANIVISIO|XIMLUCI|BYOOVIZ|MOVYMIA|SONDELBAY|LIVOGIVA|EYDENZELT|PAVBLU|AFQLIR|BEMFOLA|OVALEAP|REMSIMA|INFLECTRA|TRUXIMA|RIXATHON|RUXIENCE|ONTRUZANT|KANJINTI|TRAZIMERA|HERZUMA|ZERCEPAC|ABEVMY|MVASI|ZIRABEV|AYBINTIO|EQUIDACENT/i.test(b.designation) },
  { id: 'cardio', name: 'Génériques cardio',
    filter: b => ['C09','C10','C07','C08','C03'].includes(b.atc2) },
  { id: 'diabete', name: 'Génériques diabète',
    filter: b => b.atc2 === 'A10' && !/WEGOVY|MOUNJARO|OZEMPIC|SAXENDA|TRULICITY|VICTOZA|RYBELSUS|LANTUS|NOVORAPID|HUMALOG|TOUJEO|LEVEMIR|TRESIBA|ABASAGLAR|FIASP|INSULATARD|ACTRAPID|INSUMAN|HUMULIN|APIDRA|RYZODEG|XULTOPHY|SULIQUA/i.test(b.designation) },
  { id: 'glp1', name: 'GLP-1',
    filter: b => /WEGOVY|MOUNJARO|OZEMPIC|SAXENDA|TRULICITY|VICTOZA|RYBELSUS/i.test(b.designation) },
  { id: 'vaccins', name: 'Vaccins',
    filter: b => /VACCIN|INFLUVAC|VAXIGRIP|EFLUELDA|GARDASIL|ENGERIX|REPEVAX|BOOSTRIX|INFANRIX|HEXYON|PRIORIX|PREVENAR|NIMENRIX|MENJUGATE|MENVEO|TICOVAC|HAVRIX|AVAXIM|TWINRIX|SHINGRIX|BEXSERO|TRUMENBA|ROTARIX|ROTATEQ|CAPVAXIVE|VAXNEUVANCE|VAXELIS|VARIVAX|VARILRIX|ABRYSVO|BEYFORTUS/i.test(b.designation) },
  { id: 'femme', name: 'Santé féminine',
    filter: b => b.atc2 === 'G03' || /OESTROGEN|PROGESTER|CONTRACEPTI|MENOPAUS|\bREGLE\b|MENSTRU|OVULE/i.test(b.designation) },
  { id: 'sildenafil', name: 'Sildénafil / Tadalafil',
    filter: b => /SILDENAFIL|TADALAFIL|VARDENAFIL|VIAGRA|CIALIS|LEVITRA/i.test(b.designation) },
  { id: 'top', name: 'Top rotations IP',
    filter: b => b.ip_rank_qty && b.ip_rank_qty <= 50 },
  { id: 'insulines', name: 'Diabète insulines',
    filter: b => /LANTUS|NOVORAPID|HUMALOG|TOUJEO|LEVEMIR|TRESIBA|ABASAGLAR|FIASP|INSULATARD|ACTRAPID|INSUMAN|HUMULIN|APIDRA|RYZODEG|XULTOPHY|SULIQUA|INSULINE/i.test(b.designation) },
  { id: 'anticoag', name: 'Anti-coagulants',
    filter: b => /ELIQUIS|XARELTO|PRADAXA|LIXIANA|KARDEGIC|PLAVIX|EFFIENT|BRILIQUE|APIXABAN|RIVAROXABAN|DABIGATRAN|EDOXABAN|CLOPIDOGREL|PRASUGREL|TICAGRELOR|WARFARINE|COUMADINE|PREVISCAN|SINTROM|FLUINDIONE|ACENOCOUMAROL/i.test(b.designation) || b.atc2 === 'B01' },
];

function audit(themes, label) {
  console.log(`\n=== ${label} ===`);
  const results = [];
  themes.forEach(t => {
    const matches = BENCHMARK.filter(t.filter);
    results.push({ id: t.id, name: t.name, count: matches.length, samples: matches.slice(0, 5).map(b => b.designation.slice(0, 42)) });
    const flag = matches.length < 20 ? '  [LOW]' : (matches.length > 500 ? '  [HIGH]' : '');
    console.log(t.id.padEnd(14), t.name.padEnd(34), String(matches.length).padStart(6), flag);
  });
  return results;
}

const seasonCurr = audit(SEASON_THEMES_CURRENT, 'SEASON AVANT');
const seasonProp = audit(SEASON_THEMES_PROPOSED, 'SEASON APRES');
const catCurr = audit(CAT_THEMES_CURRENT, 'CAT AVANT');
const catProp = audit(CAT_THEMES_PROPOSED, 'CAT APRES');

console.log('\n=== RECAP ===');
function recap(curr, prop, kind) {
  curr.forEach(c => {
    const p = prop.find(x => x.id === c.id);
    const after = p ? p.count : null;
    let status = '';
    if (after === null) status = 'REMOVED';
    else if (after >= 20 && after <= 200) status = 'ok';
    else if (after < 20) status = 'low';
    else if (after > 500) status = 'HIGH';
    else status = 'broad';
    console.log(`[${kind}]`, c.id.padEnd(14), String(c.count).padStart(7), '->', String(after === null ? '-' : after).padStart(7), ' ', status);
  });
  prop.forEach(p => {
    if (!curr.find(c => c.id === p.id)) {
      console.log(`[${kind}]`, p.id.padEnd(14), '   -   ', '->', String(p.count).padStart(7), '  NEW');
    }
  });
}
recap(seasonCurr, seasonProp, 'SEA');
recap(catCurr, catProp, 'CAT');

console.log('\n=== SAMPLES nouveaux thèmes ===');
[CAT_THEMES_PROPOSED.find(t => t.id === 'insulines'), CAT_THEMES_PROPOSED.find(t => t.id === 'anticoag')].forEach(t => {
  const matches = BENCHMARK.filter(t.filter);
  console.log(`\n--- ${t.id} : ${matches.length} matchs ---`);
  matches.slice(0, 10).forEach(b => console.log('  ', b.designation.slice(0,55), '| atc2=', b.atc2));
});

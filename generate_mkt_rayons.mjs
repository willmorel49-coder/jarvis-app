// Fabrique crm/v2/mkt-rayons-data.js : un rayon lisible par CIP du catalogue complet,
// pour le sélecteur de produits de l'éditeur marketing.
//  - médicaments : classe ATC2 (crm/v2/saison-cip.json, Medic'AM) → libellé humain regroupé ;
//  - NR : catégorie marketing de crm/v2/marketing-mix-data.js (MKT_MIX.nr) ;
// Usage : node generate_mkt_rayons.mjs   (depuis la racine du dépôt)
import fs from 'node:fs';
const D = 'crm/v2/';
const saison = JSON.parse(fs.readFileSync(D + 'saison-cip.json', 'utf8')).data;
globalThis.window = {};
eval(fs.readFileSync(D + 'catalogue-complet-data.js', 'utf8'));
eval(fs.readFileSync(D + 'marketing-mix-data.js', 'utf8'));
const C = window.CATALOGUE_COMPLET, M = window.MKT_MIX;

// ATC2 → rayon (regroupés pour rester lisibles par un commercial)
const ATC = {
  A01: 'Bouche & dents', A02: 'Estomac & acidité', A03: 'Digestion & spasmes', A04: 'Nausées & vomissements',
  A05: 'Digestion & spasmes', A06: 'Transit & constipation', A07: 'Transit & diarrhée', A09: 'Digestion & spasmes',
  A10: 'Diabète', A11: 'Vitamines & minéraux', A12: 'Vitamines & minéraux', A16: 'Métabolisme',
  B01: 'Anticoagulants & sang', B02: 'Anticoagulants & sang', B03: 'Anémie & fer', B05: 'Solutés & perfusion', B06: 'Anticoagulants & sang',
  C01: 'Cœur & tension', C02: 'Cœur & tension', C03: 'Cœur & tension', C05: 'Circulation veineuse',
  C07: 'Cœur & tension', C08: 'Cœur & tension', C09: 'Cœur & tension', C10: 'Cholestérol',
  D01: 'Peau & dermatologie', D02: 'Peau & dermatologie', D05: 'Peau & dermatologie', D06: 'Peau & dermatologie',
  D07: 'Peau & dermatologie', D08: 'Peau & dermatologie', D10: 'Peau & dermatologie', D11: 'Peau & dermatologie',
  G01: 'Gynécologie & contraception', G02: 'Gynécologie & contraception', G03: 'Gynécologie & contraception', G04: 'Urologie & prostate',
  H01: 'Hormones & thyroïde', H02: 'Cortisone', H03: 'Hormones & thyroïde', H04: 'Hormones & thyroïde', H05: 'Hormones & thyroïde',
  J01: 'Antibiotiques', J02: 'Infections & antiviraux', J04: 'Infections & antiviraux', J05: 'Infections & antiviraux',
  J06: 'Vaccins & immunoglobulines', J07: 'Vaccins & immunoglobulines',
  L01: 'Cancérologie', L02: 'Cancérologie', L03: 'Immunologie', L04: 'Immunologie',
  M01: 'Douleur & inflammation', M02: 'Douleur & inflammation', M03: 'Douleur & inflammation', M04: 'Rhumatologie & os', M05: 'Rhumatologie & os', M09: 'Rhumatologie & os',
  N01: 'Anesthésie', N02: 'Douleur & fièvre', N03: 'Neurologie', N04: 'Neurologie', N05: 'Sommeil, anxiété & psychiatrie',
  N06: 'Dépression & humeur', N07: 'Neurologie',
  P01: 'Parasites', P02: 'Parasites', P03: 'Parasites',
  R01: 'Nez, gorge & allergies', R03: 'Asthme & BPCO', R05: 'Toux & rhume', R06: 'Nez, gorge & allergies', R07: 'Asthme & BPCO',
  S01: 'Yeux & ophtalmologie', S02: 'Oreilles',
  V01: 'Divers & diagnostic', V03: 'Divers & diagnostic', V04: 'Divers & diagnostic', V08: 'Divers & diagnostic'
};
// Catégories NR du mix marketing → même vocabulaire quand il existe
const NR = {
  'Ophtalmologie': 'Yeux & ophtalmologie', 'Digestif & transit': 'Transit & constipation', 'Dermatologie': 'Peau & dermatologie',
  'Antalgiques & douleur': 'Douleur & fièvre', 'ORL · Nez & gorge': 'Nez, gorge & allergies', 'Compléments & vitamines': 'Vitamines & minéraux',
  'Circulation veineuse': 'Circulation veineuse', 'Diabète & autosurveillance': 'Diabète', 'Contraception & gynéco': 'Gynécologie & contraception',
  'Bouche & dentaire': 'Bouche & dents', 'Sommeil · Stress': 'Sommeil, anxiété & psychiatrie', 'Thyroïde & hormonal': 'Hormones & thyroïde',
  'Allergies': 'Nez, gorge & allergies', 'Nausées & mal des transports': 'Nausées & vomissements', 'Vaccins': 'Vaccins & immunoglobulines',
  'Cardio & tension': 'Cœur & tension', 'Hygiène · Bébé · Sérum phy': 'Hygiène & bébé'
};
const rayons = [], idx = new Map(), cip = {};
const id = l => { if (!idx.has(l)) { idx.set(l, rayons.length); rayons.push(l); } return idx.get(l); };
const inCat = new Set(C.rows.map(r => r[0]));
let nAtc = 0, nNr = 0, inconnus = new Set();
for (const r of C.rows) {
  const e = saison[r[0]]; if (!e || !e.a) continue;
  const k = e.a.slice(0, 3); const l = ATC[k]; if (!l) { inconnus.add(k); continue; }
  cip[r[0]] = id(l); nAtc++;
}
for (const c of M.nr) for (const it of c.rows) {
  if (!inCat.has(it.cip) || cip[it.cip] != null) continue;
  cip[it.cip] = id(NR[c.cat] || c.cat); nNr++;
}
if (inconnus.size) console.warn('classes ATC sans libellé :', [...inconnus]);
const out = '// Généré par generate_mkt_rayons.mjs — rayon lisible par CIP (ATC2 Medic\'AM + catégories NR du mix marketing). Ne pas éditer à la main.\n' +
  'window.MKT_RAYONS = ' + JSON.stringify({ meta: { generated: new Date().toISOString().slice(0, 10), nAtc, nNr }, rayons, cip }) + ';\n';
fs.writeFileSync(D + 'mkt-rayons-data.js', out);
console.log('rayons', rayons.length, '| CIP classés', Object.keys(cip).length, '(ATC', nAtc, '+ NR', nNr, ') /', C.rows.length, '| poids', (out.length / 1024).toFixed(0), 'Ko');
console.log(rayons.map(l => l + ' ' + Object.values(cip).filter(v => v === idx.get(l)).length).sort((a,b)=>+b.split(' ').pop()-+a.split(' ').pop()).join('\n'));

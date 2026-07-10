// ============================================================================
// RÉFÉRENTIEL OFFICIEL DES BIOSIMILAIRES — FRANCE
// ----------------------------------------------------------------------------
// Source : ANSM (liste de référence des groupes biologiques similaires),
//   Ameli / Meddispar (liste des groupes SUBSTITUABLES en officine —
//   arrêté du 10 avril 2026, 11 groupes), EMA/EPAR, HAS, Vidal, GaBI.
// Mis à jour à la MAIN : rafraîchir quand un nouvel arrêté paraît.
// Dernière revue : 2026-07-10.
//
// canal : "ville" (officine) | "hopital" (réserve/rétrocession) | "mixte"
// substituable : substitution autorisée en officine (arrêté ministériel)
// ============================================================================

const BIOSIM_REFERENTIEL = [
  // ---------------- ANTI-TNF / IMMUNO / RHUMATO ----------------
  {
    dci: "ADALIMUMAB", atc: "L04AB04", aire: "Rhumato / gastro / dermato",
    reference: "Humira", reference_labo: "AbbVie", canal: "ville",
    substituable: true, substituable_date: "2025-02-20",
    biosimilaires: [
      { nom: "Amgevita", labo: "Amgen", annee: 2018 },
      { nom: "Imraldi", labo: "Biogen / Samsung Bioepis", annee: 2018 },
      { nom: "Hulio", labo: "Viatris / Fujifilm", annee: 2018 },
      { nom: "Hyrimoz", labo: "Sandoz", annee: 2018 },
      { nom: "Idacio", labo: "Fresenius Kabi", annee: 2019 },
      { nom: "Amsparity", labo: "Pfizer", annee: 2020 },
      { nom: "Yuflyma", labo: "Celltrion", annee: 2023 },
      { nom: "Hukyndra", labo: "Stada / Alvotech", annee: 2023 },
      { nom: "Libmyris", labo: "Stada / Samsung Bioepis", annee: 2023 },
    ],
  },
  {
    dci: "ETANERCEPT", atc: "L04AB01", aire: "Rhumato / dermato",
    reference: "Enbrel", reference_labo: "Pfizer", canal: "ville",
    substituable: true, substituable_date: "2025-02-20",
    biosimilaires: [
      { nom: "Benepali", labo: "Biogen / Samsung Bioepis", annee: 2016 },
      { nom: "Erelzi", labo: "Sandoz", annee: 2017 },
      { nom: "Nepexto", labo: "Viatris", annee: 2021 },
    ],
  },
  {
    dci: "INFLIXIMAB", atc: "L04AB02", aire: "Rhumato / gastro / dermato",
    reference: "Remicade", reference_labo: "MSD / Janssen", canal: "hopital",
    substituable: false, substituable_date: null,
    biosimilaires: [
      { nom: "Inflectra", labo: "Pfizer / Celltrion", annee: 2015 },
      { nom: "Remsima", labo: "Celltrion", annee: 2015 },
      { nom: "Flixabi", labo: "Biogen / Samsung Bioepis", annee: 2016 },
      { nom: "Zessly", labo: "Sandoz", annee: 2018 },
    ],
  },
  {
    dci: "GOLIMUMAB", atc: "L04AB06", aire: "Rhumato / gastro",
    reference: "Simponi", reference_labo: "MSD / Janssen", canal: "ville",
    substituable: false, substituable_date: null,
    note: "AMM UE — commercialisation FR à confirmer",
    biosimilaires: [
      { nom: "Gobivaz", labo: "Advanz / Alvotech", annee: 2025, statut: "AMM UE" },
      { nom: "Gotenfia", labo: "Stada / Bio-Thera", annee: 2026, statut: "AMM UE" },
    ],
  },
  {
    dci: "USTEKINUMAB", atc: "L04AC05", aire: "Dermato / rhumato / gastro",
    reference: "Stelara", reference_labo: "Janssen / J&J", canal: "ville",
    substituable: true, substituable_date: "2026-04-10",
    biosimilaires: [
      { nom: "Uzpruvo", labo: "Stada / Alvotech", annee: 2024 },
      { nom: "Wezenla", labo: "Amgen", annee: 2024 },
      { nom: "Pyzchiva", labo: "Sandoz / Samsung Bioepis", annee: 2024 },
      { nom: "Steqeyma", labo: "Celltrion", annee: 2024 },
      { nom: "Otulfi", labo: "Fresenius Kabi / Formycon", annee: 2024 },
      { nom: "Imuldosa", labo: "Accord / Dong-A", annee: 2024 },
      { nom: "Yesintek", labo: "Biocon", annee: 2025 },
    ],
  },
  {
    dci: "TOCILIZUMAB", atc: "L04AC07", aire: "Rhumato",
    reference: "RoActemra", reference_labo: "Roche", canal: "mixte",
    substituable: false, substituable_date: null,
    note: "Substitution reportée par l'ANSM (23/06/2026, signaux hypersensibilité)",
    biosimilaires: [
      { nom: "Tyenne", labo: "Fresenius Kabi", annee: 2024 },
      { nom: "Avtozma", labo: "Celltrion", annee: 2025 },
      { nom: "Acvrio", labo: "Accord", annee: 2025 },
    ],
  },
  {
    dci: "NATALIZUMAB", atc: "L04AA23", aire: "Neuro (SEP)",
    reference: "Tysabri", reference_labo: "Biogen", canal: "hopital",
    substituable: false, substituable_date: null,
    biosimilaires: [
      { nom: "Tyruko", labo: "Sandoz / Polpharma", annee: 2024 },
    ],
  },
  // ---------------- ONCOLOGIE ----------------
  {
    dci: "RITUXIMAB", atc: "L01FA01", aire: "Onco-hématologie",
    reference: "MabThera", reference_labo: "Roche", canal: "hopital",
    substituable: false, substituable_date: null,
    biosimilaires: [
      { nom: "Truxima", labo: "Celltrion / Biogaran", annee: 2017 },
      { nom: "Rixathon", labo: "Sandoz", annee: 2017 },
      { nom: "Ruxience", labo: "Pfizer", annee: 2020 },
      { nom: "Ituxredi", labo: "Stada / Xbrane", annee: 2024 },
    ],
  },
  {
    dci: "TRASTUZUMAB", atc: "L01FD01", aire: "Onco (sein / estomac HER2+)",
    reference: "Herceptin", reference_labo: "Roche", canal: "hopital",
    substituable: false, substituable_date: null,
    biosimilaires: [
      { nom: "Herzuma", labo: "Celltrion / Mundipharma", annee: 2018 },
      { nom: "Kanjinti", labo: "Amgen", annee: 2018 },
      { nom: "Ontruzant", labo: "Organon / Samsung Bioepis", annee: 2018 },
      { nom: "Trazimera", labo: "Pfizer", annee: 2019 },
      { nom: "Ogivri", labo: "Viatris / Biocon", annee: 2019 },
      { nom: "Zercepac", labo: "Accord", annee: 2020 },
      { nom: "Dazublys", labo: "Stada", annee: 2024 },
      { nom: "Herwenda", labo: "Amgen", annee: 2024 },
      { nom: "Tuznue", labo: "Prestige / Intas", annee: 2025 },
    ],
  },
  {
    dci: "BEVACIZUMAB", atc: "L01FG01", aire: "Onco (multi-tumeurs)",
    reference: "Avastin", reference_labo: "Roche", canal: "hopital",
    substituable: false, substituable_date: null,
    biosimilaires: [
      { nom: "Mvasi", labo: "Amgen", annee: 2022 },
      { nom: "Zirabev", labo: "Pfizer", annee: 2022 },
      { nom: "Aybintio", labo: "Samsung Bioepis", annee: 2020 },
      { nom: "Alymsys", labo: "Amneal / mAbxience", annee: 2021 },
      { nom: "Oyavas", labo: "Stada / mAbxience", annee: 2021 },
      { nom: "Abevmy", labo: "Viatris / Biocon", annee: 2021 },
      { nom: "Equidacent", labo: "Fresenius Kabi", annee: 2021 },
      { nom: "Onbevzi", labo: "Samsung Bioepis", annee: 2021 },
      { nom: "Vegzelma", labo: "Celltrion", annee: 2023 },
      { nom: "Avzivi", labo: "Sandoz / Bio-Thera", annee: 2024 },
    ],
  },
  // ---------------- HÉMATO / SOINS DE SUPPORT ----------------
  {
    dci: "FILGRASTIM", atc: "L03AA02", aire: "Soins de support (G-CSF)",
    reference: "Neupogen", reference_labo: "Amgen", canal: "mixte",
    substituable: true, substituable_date: "2022-04-12",
    biosimilaires: [
      { nom: "Zarzio", labo: "Sandoz", annee: 2009 },
      { nom: "Tevagrastim", labo: "Teva", annee: 2008 },
      { nom: "Nivestim", labo: "Pfizer / Hospira", annee: 2010 },
      { nom: "Accofil", labo: "Accord", annee: 2014 },
      { nom: "Grastofil", labo: "Accord / Apotex", annee: 2013 },
      { nom: "Zefylti", labo: "Stada", annee: 2023 },
    ],
  },
  {
    dci: "PEGFILGRASTIM", atc: "L03AA13", aire: "Soins de support (G-CSF)",
    reference: "Neulasta", reference_labo: "Amgen", canal: "mixte",
    substituable: true, substituable_date: "2022-04-12",
    biosimilaires: [
      { nom: "Ziextenzo", labo: "Sandoz", annee: 2019 },
      { nom: "Pelgraz", labo: "Accord", annee: 2019 },
      { nom: "Pelmeg", labo: "Mundipharma / Cinfa", annee: 2019 },
      { nom: "Fulphila", labo: "Viatris / Biocon", annee: 2019 },
      { nom: "Grasustek", labo: "Mundipharma", annee: 2019 },
      { nom: "Nyvepria", labo: "Pfizer", annee: 2020 },
      { nom: "Cegfila", labo: "Mundipharma", annee: 2020 },
      { nom: "Stimufend", labo: "Fresenius Kabi", annee: 2022 },
      { nom: "Udenyca", labo: "Accord / Coherus", annee: 2019 },
      { nom: "Dyrupeg", labo: "Stada", annee: 2023 },
    ],
  },
  {
    dci: "EPOETINE", atc: "B03XA01", aire: "Anémie (IRC / chimio)",
    reference: "Eprex", reference_labo: "Janssen / J&J", canal: "mixte",
    substituable: true, substituable_date: "2025-02-20",
    biosimilaires: [
      { nom: "Binocrit", labo: "Sandoz", annee: 2007 },
      { nom: "Abseamed", labo: "Medice", annee: 2007 },
      { nom: "Retacrit", labo: "Pfizer / Hospira", annee: 2007 },
      { nom: "Silapo", labo: "Stada", annee: 2007 },
    ],
  },
  // ---------------- DIABÉTOLOGIE ----------------
  {
    dci: "INSULINE GLARGINE", atc: "A10AE04", aire: "Diabète",
    reference: "Lantus", reference_labo: "Sanofi", canal: "mixte",
    substituable: false, substituable_date: null,
    note: "Insulines exclues de la substitution (ANSM 20/12/2024)",
    biosimilaires: [
      { nom: "Abasaglar", labo: "Lilly / Boehringer", annee: 2016 },
      { nom: "Semglee", labo: "Viatris / Biocon", annee: 2018 },
    ],
  },
  {
    dci: "INSULINE ASPARTE", atc: "A10AB05", aire: "Diabète",
    reference: "NovoRapid", reference_labo: "Novo Nordisk", canal: "mixte",
    substituable: false, substituable_date: null,
    biosimilaires: [
      { nom: "Insuline asparte Sanofi", labo: "Sanofi", annee: 2020 },
      { nom: "Kirsty", labo: "Viatris / Biocon", annee: 2021 },
    ],
  },
  {
    dci: "INSULINE LISPRO", atc: "A10AB04", aire: "Diabète",
    reference: "Humalog", reference_labo: "Lilly", canal: "mixte",
    substituable: false, substituable_date: null,
    biosimilaires: [
      { nom: "Insuline lispro Sanofi", labo: "Sanofi", annee: 2017 },
    ],
  },
  // ---------------- OPHTALMOLOGIE ----------------
  {
    dci: "RANIBIZUMAB", atc: "S01LA04", aire: "Ophtalmo (intravitréen)",
    reference: "Lucentis", reference_labo: "Novartis / Genentech", canal: "hopital",
    substituable: true, substituable_date: "groupe historique",
    biosimilaires: [
      { nom: "Byooviz", labo: "Biogen / Samsung Bioepis", annee: 2021 },
      { nom: "Ranivisio", labo: "Teva / Bioeq", annee: 2022 },
      { nom: "Ximluci", labo: "Stada / Xbrane", annee: 2022 },
    ],
  },
  {
    dci: "AFLIBERCEPT", atc: "S01LA05", aire: "Ophtalmo (intravitréen)",
    reference: "Eylea 2 mg", reference_labo: "Bayer / Regeneron", canal: "hopital",
    substituable: true, substituable_date: "2026 (Eylea 2 mg)",
    biosimilaires: [
      { nom: "Afqlir", labo: "Sandoz", annee: 2024 },
      { nom: "Yesafili", labo: "Biocon", annee: 2023, statut: "AMM UE" },
      { nom: "Opuviz", labo: "Biogen / Samsung Bioepis", annee: 2024, statut: "AMM UE" },
      { nom: "Eydenzelt", labo: "Celltrion", annee: 2025, statut: "AMM UE" },
      { nom: "Pavblu", labo: "Amgen", annee: 2025, statut: "AMM UE" },
      { nom: "Mynzepli", labo: "Advanz / Alvotech", annee: 2025, statut: "AMM UE" },
      { nom: "Ahzantive", labo: "Formycon / Klinge", annee: 2025, statut: "AMM UE" },
    ],
  },
  // ---------------- OS / ENDOCRINO ----------------
  {
    dci: "TERIPARATIDE", atc: "H05AA02", aire: "Ostéoporose",
    reference: "Forstéo", reference_labo: "Lilly", canal: "ville",
    substituable: true, substituable_date: "2025-02-20",
    biosimilaires: [
      { nom: "Movymia", labo: "Stada", annee: 2017 },
      { nom: "Terrosa", labo: "Gedeon Richter", annee: 2017 },
      { nom: "Livogiva", labo: "Theramex", annee: 2020 },
      { nom: "Sondelbay", labo: "Accord", annee: 2022 },
      { nom: "Kauliv", labo: "Theramex / Strides", annee: 2023 },
    ],
  },
  {
    dci: "DENOSUMAB", atc: "M05BX04", aire: "Os / oncologie",
    reference: "Prolia / Xgeva", reference_labo: "Amgen", canal: "mixte",
    substituable: false, substituable_date: null,
    note: "Sur liste de référence ANSM (2026) mais pas encore substituable en officine",
    biosimilaires: [
      { nom: "Jubbonti / Wyost", labo: "Sandoz", annee: 2024 },
      { nom: "Obodence / Xbryk", labo: "Samsung Bioepis", annee: 2025 },
      { nom: "Stoboclo / Osenvelt", labo: "Celltrion", annee: 2025 },
      { nom: "Osvyrti / Jubereq", labo: "Accord", annee: 2025 },
      { nom: "Izamby / Denbrayce", labo: "mAbxience", annee: 2025 },
      { nom: "Conexxence / Bomyntra", labo: "Fresenius Kabi", annee: 2025 },
      { nom: "Bildyos / Bilprevda", labo: "Organon / Henlius", annee: 2025 },
      { nom: "Kefdensis / Zvogra", labo: "Stada / Alvotech", annee: 2025 },
      { nom: "Ponlimsi / Degevma", labo: "Teva", annee: 2025 },
    ],
  },
  // ---------------- ANTICOAGULANT / AMP / HORMONES ----------------
  {
    dci: "ENOXAPARINE", atc: "B01AB05", aire: "Anticoagulant (HBPM)",
    reference: "Lovenox", reference_labo: "Sanofi", canal: "ville",
    substituable: true, substituable_date: "2025-02-20",
    biosimilaires: [
      { nom: "Inhixa", labo: "Techdow", annee: 2016 },
      { nom: "Ghemaxan", labo: "Techdow", annee: 2017 },
      { nom: "Crusia (Becat)", labo: "Rovi", annee: 2017 },
    ],
  },
  {
    dci: "FOLLITROPINE ALFA", atc: "G03GA05", aire: "AMP (stimulation ovarienne)",
    reference: "Gonal-F", reference_labo: "Merck Serono", canal: "ville",
    substituable: true, substituable_date: "2025-02-20",
    biosimilaires: [
      { nom: "Ovaleap", labo: "Theramex / Teva", annee: 2013 },
      { nom: "Bemfola", labo: "Gedeon Richter / Finox", annee: 2014 },
    ],
  },
  {
    dci: "SOMATROPINE", atc: "H01AC01", aire: "Endocrino (hormone de croissance)",
    reference: "Genotropin / Humatrope", reference_labo: "Pfizer / Lilly", canal: "ville",
    substituable: false, substituable_date: null,
    biosimilaires: [
      { nom: "Omnitrope", labo: "Sandoz", annee: 2006 },
    ],
  },
  {
    dci: "ECULIZUMAB", atc: "L04AJ01", aire: "Maladies rares (anti-C5)",
    reference: "Soliris", reference_labo: "Alexion / AstraZeneca", canal: "hopital",
    substituable: false, substituable_date: null,
    biosimilaires: [
      { nom: "Bekemv", labo: "Amgen", annee: 2023 },
      { nom: "Epysqli", labo: "Samsung Bioepis", annee: 2023 },
    ],
  },
];

// ============================================================================
// LABORATOIRES — acteurs du marché biosimilaire vus par Intégral
// ----------------------------------------------------------------------------
// PARTENAIRES_IP : labos partenaires d'Intégral (achat direct) → badge prioritaire.
// ACTEURS_MAJEURS : principaux acteurs du marché biosimilaire FR.
// Détection : par sous-chaîne, appliquée AU référentiel (labo développeur)
//   ET aux données réelles Intégral (collection/lab du stock, cf. robot).
// ============================================================================
const PARTENAIRES_IP = ["Zentiva", "EG", "EG Labo", "Teva"];
const ACTEURS_MAJEURS = ["Sandoz", "Biogaran", "Viatris", "Zentiva", "EG", "Teva"];

// Export universel (Node + navigateur)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { BIOSIM_REFERENTIEL, PARTENAIRES_IP, ACTEURS_MAJEURS };
} else if (typeof window !== "undefined") {
  window.BIOSIM_REFERENTIEL = BIOSIM_REFERENTIEL;
  window.PARTENAIRES_IP = PARTENAIRES_IP;
  window.ACTEURS_MAJEURS = ACTEURS_MAJEURS;
}

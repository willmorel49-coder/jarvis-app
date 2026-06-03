// marketing-offers.js — 8 OFFRES IP OFFICIELLES 2026 pré-remplies
// Source : MARKETING/OFFRE V1 2026 (3).pdf (9 pages, charte IP)
// Expose : window.MARKETING_IP_OFFERS = [...]
//
// Chaque offre = preset complet activable en 1 clic dans le module Marketing.
// Le produit suit le shape attendu par marketing.js / renderSheetHTML :
//   { ean | cip13, designation, ppht, prix_ip, remise_pct }

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers locaux pour formater les CIP courts (CIP7) en CIP13
  // ─────────────────────────────────────────────────────────────────────────
  function cip7to13(cip7) {
    // Pas de check digit ici (les PDFs IP affichent du CIP7 non normalise).
    // On prefixe par '3400' pour avoir une cle utilisable cote app.
    if (!cip7) return '';
    var s = String(cip7).replace(/\s+/g, '');
    if (s.length === 13) return s;
    if (s.length === 7) return '3400' + s + '0'; // approximation CIP13
    return s;
  }
  function remisePct(ppht, prix_ip) {
    if (!ppht || !prix_ip) return null;
    return Math.max(0, ((ppht - prix_ip) / ppht) * 100);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OFFRE IP VACCINS — bleu marine (41 produits)
  // ─────────────────────────────────────────────────────────────────────────
  var VACCINS = [
    { cip7: '3027557', nom: 'ABRYSVO ADULTE',                    ppht: 182.41, ip: 175.31 },
    { cip7: '3416652', nom: 'AVAXIM 160U INJ SRG0,5ML 1',        ppht: 19.65,  ip: 18.89  },
    { cip7: '3567724', nom: 'AVAXIM 80U INJ SRG0,5ML A/A 1',     ppht: 13.10,  ip: 12.59  },
    { cip7: '2686303', nom: 'BEXSERO INJ SRG0,5ML 1 +AIG',       ppht: 73.34,  ip: 70.49  },
    { cip7: '3026859', nom: 'BEYFORTUS 50MG',                    ppht: 374.89, ip: 360.31 },
    { cip7: '3026863', nom: 'BEYFORTUS 100MG',                   ppht: 374.89, ip: 360.31 },
    { cip7: '3677387', nom: 'BOOSTRIXTETRA INJ SRG0,5ML+A 1',    ppht: 19.92,  ip: 19.15  },
    { cip7: '3031146', nom: 'CAPVAXIVE INJ SR0,5 ML 1',          ppht: 52.31,  ip: 50.27  },
    { cip7: '3516709', nom: 'ENGERIX B 10µG SRG.BACK.0,5ML1',    ppht: 8.43,   ip: 8.10   },
    { cip7: '3516690', nom: 'ENGERIX B 20µG SRG.BACK.1ML 1',     ppht: 14.50,  ip: 13.94  },
    { cip7: '3005620', nom: 'GARDASIL 9 INJ SRG0,5ML 1+2AIG',    ppht: 107.56, ip: 103.38 },
    { cip7: '3377515', nom: 'HAVRIX 1440 AD. INJ SRG1ML 1',      ppht: 19.65,  ip: 18.89  },
    { cip7: '3476045', nom: 'HAVRIX 720 ENF INJ SRG0,5ML 1',     ppht: 13.10,  ip: 12.59  },
    { cip7: '3692464', nom: 'HBVAXPRO 10µG SRG1ML A/2AIG 1',     ppht: 13.80,  ip: 13.27  },
    { cip7: '3692429', nom: 'HBVAXPRO 5µG SRG0,5ML A/2A 1',      ppht: 8.03,   ip: 7.72   },
    { cip7: '2735007', nom: 'HEXYON INJ SRG0,5ML 1+ 1AIG',       ppht: 30.09,  ip: 28.92  },
    { cip7: '3549583', nom: 'INFANRIX HEXA INJ FL+SRG+AIG 1',    ppht: 29.50,  ip: 28.35  },
    { cip7: '3552473', nom: 'INFANRIXQUINTA INJ FL+SRG 1',       ppht: 21.66,  ip: 20.84  },
    { cip7: '3001760', nom: 'MENJUGATE 10µG INJ SRG0,6ML 1',     ppht: 17.90,  ip: 17.20  },
    { cip7: '3024421', nom: 'MENQUADFI INJ FL0,5ML 1 +NEC',      ppht: 36.18,  ip: 34.78  },
    { cip7: '2170290', nom: 'MENVEO INJ FL+FL 1',                ppht: 36.18,  ip: 34.78  },
    { cip7: '3732821', nom: 'M-M-RVAXPRO INJ FL+SRG 1 +2AIG',    ppht: 11.84,  ip: 11.38  },
    { cip7: '2225393', nom: 'NIMENRIX INJ FL+SRG 1 A/2AIG',      ppht: 36.18,  ip: 34.48  },
    { cip7: '3004438', nom: 'PNEUMOVAX INJ SRG0,5ML 1 A/2A',     ppht: 17.15,  ip: 16.48  },
    { cip7: '3990115', nom: 'PREVENAR 13 INJ SRG0,5ML 1 A/A',    ppht: 45.12,  ip: 43.37  },
    { cip7: '3513734', nom: 'PRIORIX INJ FL+SRG 1+2AIG',         ppht: 11.84,  ip: 11.38  },
    { cip7: '3687374', nom: 'REPEVAX INJ SRG 1S/A+1',            ppht: 19.92,  ip: 19.15  },
    { cip7: '3902022', nom: 'ROTARIX BUV TB1,5ML 1',             ppht: 54.10,  ip: 52.00  },
    { cip7: '3762236', nom: 'ROTATEQ BUV UNIDOS2ML 1',           ppht: 48.24,  ip: 46.36  },
    { cip7: '3014186', nom: 'SHINGRIX INJ FL+FL 1',              ppht: 175.18, ip: 168.37 },
    { cip7: '3687463', nom: 'TETRAVAC-ACELLULAIRE SRG 1',        ppht: 11.94,  ip: 11.48  },
    { cip7: '3677482', nom: 'TICOVAC 0.25ML ENF S/A SRG 1',      ppht: 30.57,  ip: 29.38  },
    { cip7: '2784170', nom: 'TICOVAC 0,5ML AD S/A SRG 1',        ppht: 30.57,  ip: 29.38  },
    { cip7: '3009637', nom: 'TRUMENBA INJ SRG0,5ML 1',           ppht: 73.34,  ip: 70.49  },
    { cip7: '3567693', nom: 'TWINRIX AD INJ SRG+AIG 1',          ppht: 41.93,  ip: 40.30  },
    { cip7: '3830995', nom: 'VAQTA 50U/1ML INJ SRG1 +2AIG',      ppht: 19.65,  ip: 18.89  },
    { cip7: '3627722', nom: 'VARILRIX INJ FL+SRG1',              ppht: 33.78,  ip: 32.47  },
    { cip7: '3687641', nom: 'VARIVAX INJ FL+SRG 1 A/2AIG',       ppht: 33.78,  ip: 32.47  },
    { cip7: '3007978', nom: 'VAXELIS INJ SRG0,5ML 1 +2AIG',      ppht: 31.64,  ip: 28.35  },
    { cip7: '3024437', nom: 'VAXNEUVANCE INJ SRG0,5ML1+1AIG',    ppht: 45.12,  ip: 43.37  },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // OFFRE IP GLP-1 — Wegovy + Mounjaro (bleu clair)
  // ─────────────────────────────────────────────────────────────────────────
  var GLP1 = [
    { cip13: '3400930258620', nom: 'WEGOVY 0.25 MG FLEX INJ S1,5ML1',   ip: 127.62 },
    { cip13: '3400930258637', nom: 'WEGOVY 0.5MG FLEX INJ ST 1.5ML1',   ip: 154.96 },
    { cip13: '3400930317815', nom: 'WEGOVY 0.5MG FLEX INJ ST 3ML1',     ip: 154.96 },
    { cip13: '3400930258644', nom: 'WEGOVY 1MG FLEX INJ STYL3ML1',      ip: 154.96 },
    { cip13: '3400930260241', nom: 'WEGOVY 1.7MG FLEX INJ STYL3ML1',    ip: 174.28 },
    { cip13: '3400930258668', nom: 'WEGOVY 2.4MG FLEX INJSTYLE3ML1',    ip: 213.21 },
    { cip13: '3400930292907', nom: 'MOUNJARO 2.5MG KWIKPEN 2.4ML1',     ip: 158.62 },
    { cip13: '3400930292914', nom: 'MOUNJARO 5MG KWIKPEN 2.4ML1',       ip: 216.30 },
    { cip13: '3400930292938', nom: 'MOUNJARO 7.5MG KWIKPEN 2.4ML1',     ip: 302.82 },
    { cip13: '3400930292945', nom: 'MOUNJARO 10MG KWIKPEN 2.4ML1',      ip: 302.82 },
    { cip13: '3400930292952', nom: 'MOUNJARO 12.5MG KWIKPEN 2.4ML1',    ip: 389.34 },
    { cip13: '3400930292976', nom: 'MOUNJARO 15MG KWIKPEN 2.4ML1',      ip: 389.34 },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // OFFRE IP SILDENAFIL / TADALAFIL — Zydus (rose)
  // ─────────────────────────────────────────────────────────────────────────
  var SILDENAFIL = [
    { cip13: '3400930146514', nom: 'SILDENAFIL 50 mg/4 cp. pell',       ip: 1.19 },
    { cip13: '3400930146538', nom: 'SILDENAFIL 50 mg/8 cp. pell',       ip: 2.11 },
    { cip13: '3400930146545', nom: 'SILDENAFIL 50 mg/12 cp. pell',      ip: 2.98 },
    { cip13: '3400930156742', nom: 'SILDENAFIL 50 mg/24 cp. pell',      ip: 6.21 },
    { cip13: '3400930146644', nom: 'SILDENAFIL 100 mg/4 cp. pell',      ip: 1.24 },
    { cip13: '3400930146651', nom: 'SILDENAFIL 100 mg/8 cp. pell',      ip: 2.36 },
    { cip13: '3400930146668', nom: 'SILDENAFIL 100 mg/12 cp. pell',     ip: 3.48 },
    { cip13: '3400930156797', nom: 'SILDENAFIL 100 mg/24 cp. pell',     ip: 6.96 },
    { cip13: '3400930080269', nom: 'TADALAFIL 5 mg/28 cp. pell',        ip: 3.73 },
    { cip13: '3400930167472', nom: 'TADALAFIL 5 mg/84 cp. pell',        ip: 11.19 },
    { cip13: '3400930080276', nom: 'TADALAFIL 10 mg/4 cp. pell',        ip: 1.24 },
    { cip13: '3400930080283', nom: 'TADALAFIL 20 mg / 4 cp. pell',      ip: 1.86 },
    { cip13: '3400930080290', nom: 'TADALAFIL 20 mg/ 8 cp. pell',       ip: 3.73 },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // OFFRE IP SANOFI — Doliprane / Aspegic / Kardegic / Codoliprane (jaune)
  // ─────────────────────────────────────────────────────────────────────────
  var SANOFI = [
    { cip7: '3189363', nom: 'ASPEGIC 100 ENF NOUR X 20 SACHETS',     ppht: 1.35, ip: 1.07 },
    { cip7: '3189819', nom: 'ASPEGIC 1000 AD X 20 SACHETS',          ppht: 2.41, ip: 2.13 },
    { cip7: '3270361', nom: 'ASPEGIC 250MG BTE 20 SACHETS',          ppht: 1.41, ip: 1.13 },
    { cip7: '3122689', nom: 'ASPEGIC 500 X 20 SACHETS',              ppht: 1.43, ip: 1.15 },
    { cip7: '3322075', nom: 'CODOLIPRANE CPR 16',                    ppht: 1.56, ip: 1.28 },
    { cip7: '3005783', nom: 'CODOLIPRANE 500/30MG GEL BT16',         ppht: 1.56, ip: 1.28 },
    { cip7: '2756239', nom: 'CODOLIPRANE 500/30MG CPR BT16',         ppht: 1.56, ip: 1.28 },
    { cip7: '3595583', nom: 'DOLIPRANE 1000MG 8CPR',                 ppht: 1.06, ip: 0.78 },
    { cip7: '4153396', nom: 'DOLIPRANE 1000 MG GELU 8',              ppht: 1.06, ip: 0.78 },
    { cip7: '3529422', nom: 'DOLIPRANE 1000MG CPR EFF BT8',          ppht: 1.06, ip: 0.78 },
    { cip7: '3624698', nom: 'DOLIPRANE 1000MG SACHET 8',             ppht: 1.06, ip: 0.78 },
    { cip7: '3461546', nom: 'DOLIPRANE 2,4% SUSP PEDIATR FL',        ppht: 1.26, ip: 0.98 },
    { cip7: '3499916', nom: 'DOLIPRANE 200MG PDRE 12 A 16KG',        ppht: 1.30, ip: 1.02 },
    { cip7: '3499945', nom: 'DOLIPRANE 300MG PDRE 16 A 30KG',        ppht: 1.30, ip: 1.02 },
    { cip7: '3450778', nom: 'DOLIPRANE 500 MG X 16 GEL',             ppht: 1.06, ip: 0.78 },
    { cip7: '3232018', nom: 'DOLIPRANE 500MG CPR 16',                ppht: 1.06, ip: 0.78 },
    { cip7: '3233153', nom: 'DOLIPRANE 500MG PDR AD SAC 12',         ppht: 1.06, ip: 0.78 },
    { cip7: '3304746', nom: 'DOLIPRANE SUP AD 8',                    ppht: 1.33, ip: 1.05 },
    { cip7: '3480911', nom: 'DOLIPRANE SUPPO 100MG 3 A 8 KG',        ppht: 1.21, ip: 0.93 },
    { cip7: '3480940', nom: 'DOLIPRANE SUPPO 150MG 8 A 12KG',        ppht: 1.21, ip: 0.93 },
    { cip7: '3480986', nom: 'DOLIPRANE SUPPO 200MG 12 A 16KG',       ppht: 1.21, ip: 0.93 },
    { cip7: '3481017', nom: 'DOLIPRANE SUPPO 300MG 15 A 24KG',       ppht: 1.21, ip: 0.93 },
    { cip7: '3474419', nom: 'KARDEGIC 75MG PDR SACH 30',             ppht: 1.47, ip: 1.19 },
    { cip7: '3324737', nom: 'KARDEGIC 160 MG PDR AD SAC 30',         ppht: 1.47, ip: 1.19 },
    { cip7: '3322655', nom: 'KARDEGIC 300 MG PDR AD SAC 30',         ppht: 1.47, ip: 1.19 },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // OFFRE IP UPSA — Dafalgan / Efferalganmed / Nifluril (turquoise)
  // ─────────────────────────────────────────────────────────────────────────
  var UPSA = [
    { cip7: '3353153', nom: 'ASPIRINE UPSA 1000 MG 2T 10C',          ppht: 2.20, ip: 1.92 },
    { cip7: '3351510', nom: 'ASPIRINE UPSA 500 MG 20C. STRIPS',      ppht: 1.43, ip: 1.15 },
    { cip7: '3018694', nom: 'DAFALGAN 1000 MG 8 GELULES',            ppht: 1.06, ip: 0.78 },
    { cip7: '3529103', nom: 'DAFALGAN 1000 MG 8 CPR EFFV',           ppht: 1.06, ip: 0.78 },
    { cip7: '3615883', nom: 'DAFALGAN 1000 MG 8 CPS SECS',           ppht: 1.06, ip: 0.78 },
    { cip7: '3625657', nom: 'DAFALGAN 500 MG 16 CPR EFFV',           ppht: 1.06, ip: 0.78 },
    { cip7: '3673047', nom: 'DAFALGAN 500 MG 16 CPS SECS',           ppht: 1.06, ip: 0.78 },
    { cip7: '3267904', nom: 'DAFALGAN 500 MG 16 GELULES',            ppht: 1.06, ip: 0.78 },
    { cip7: '3273655', nom: 'DAFALGAN 600 MG 10 Suppo. Adultes',     ppht: 1.33, ip: 1.05 },
    { cip7: '3331677', nom: 'DAFALGAN CODEINE EFF 16C',              ppht: 1.56, ip: 1.28 },
    { cip7: '3327581', nom: 'DAFALGAN CODEINE SEC BT 16',            ppht: 1.56, ip: 1.28 },
    { cip7: '3390579', nom: 'EFFERALGANMED 150MG 10 SUPPOSITOIRES',  ppht: 1.18, ip: 0.90 },
    { cip7: '3390562', nom: 'EFFERALGANMED 150MG 12 SACHETS',        ppht: 1.12, ip: 0.84 },
    { cip7: '3529178', nom: 'EFFERALGANMED 1000 MG CPR EFFV TB8',    ppht: 1.06, ip: 0.78 },
    { cip7: '3648546', nom: 'EFFERALGANMED 1000MG CPR BT8',          ppht: 1.06, ip: 0.78 },
    { cip7: '3463657', nom: 'EFFERALGANMED 250 MG COMP DISPERSIBLE', ppht: 1.19, ip: 0.91 },
    { cip7: '3400390', nom: 'EFFERALGANMED 250MG 12 SACHETS',        ppht: 1.19, ip: 0.91 },
    { cip7: '3390585', nom: 'EFFERALGANMED 300MG 10 SUPPOSITOIRES',  ppht: 1.22, ip: 0.94 },
    { cip7: '3256757', nom: 'EFFERALGANMED 500MG CPR BT16',          ppht: 1.06, ip: 0.78 },
    { cip7: '3257001', nom: 'EFFERALGANMED 500MG CPR EFFV16',        ppht: 1.06, ip: 0.78 },
    { cip7: '3318665', nom: 'NIFLUGEL TUBE 60G',                     ppht: 1.93, ip: 1.65 },
    { cip7: '3072879', nom: 'NIFLURIL 30 GELULES',                   ppht: 1.99, ip: 1.71 },
    { cip7: '3188636', nom: 'NIFLURIL ENFANT 8 SUPPO',               ppht: 1.58, ip: 1.30 },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // OFFRE IP GENERIQUE — TEVA / Sandoz / Biogaran / Arrow (vert)
  // Document interne. Pas de PPHT affiche (prix IP net).
  // ─────────────────────────────────────────────────────────────────────────
  var GENERIQUE = [
    { cip13: '3400930265109', nom: 'AMITRIPTYLINE BGA BUV GTT20ML1',     ip: 2.85 },
    { cip13: '3400930055953', nom: 'BETAMETHASONE BGA 0,05% CR T30G',    ip: 1.79 },
    { cip13: '3400939888743', nom: 'BUDESONIDE SDZ 64MCG/DOS 120D.1',    ip: 4.00 },
    { cip13: '3400930208229', nom: 'CALCIFEDIOL GRD BUV GTT FL10ML',     ip: 4.27 },
    { cip13: '3400930133620', nom: 'CALCIPOTRIOL/BET.SDZ POM TB60G',     ip: 13.14 },
    { cip13: '3400930206423', nom: 'CLOBETASOL SSP 500MCG SHA 125ML',    ip: 8.66 },
    { cip13: '3400932531097', nom: 'DIAZEPAM TEVA 2MG',                  ip: 0.50 },
    { cip13: '3400932530908', nom: 'DIAZEPAM TEVA 5MG',                  ip: 0.54 },
    { cip13: '3400932531158', nom: 'DIAZEPAM TEVA 10MG',                 ip: 0.77 },
    { cip13: '3400939482255', nom: 'DIOSMECTITE VIA 3G BUV SACH 30',     ip: 2.23 },
    { cip13: '3400930138342', nom: 'DEXTROMETORPHANE BIOG 1,5MG/ML SS125ML', ip: 1.21 },
    { cip13: '3400930138380', nom: 'DEXTROMETORPHANE BIOG 1,5MG/ML SS250ML', ip: 1.50 },
    { cip13: '3400930002209', nom: 'FUROSEMIDE ZEN 500MG CPR BT30',      ip: 10.15 },
    { cip13: '3400930180044', nom: 'HYDROCHLOROT.ARW 25MG CPR BT30',     ip: 1.14 },
    { cip13: '3400927665516', nom: 'LIDOCAINE/PRIL.ZEN PANS BT1',        ip: 1.21 },
    { cip13: '3400936995789', nom: 'LIDOCAIN/PRIL.ZEN 5% CR 5G 1+P',     ip: 2.44 },
    { cip13: '3400933651565', nom: 'LORAZEPAM VIA 2,5MG CPR FL30',       ip: 1.68 },
    { cip13: '3400934043826', nom: 'LORAZEPAM ARW 1MG CPR FL30',         ip: 0.94 },
    { cip13: '3400927567070', nom: 'LORMETAZEPAM ARW 1MG',               ip: 0.90 },
    { cip13: '3400927567131', nom: 'LORMETAZEPAM ARW 2MG',               ip: 1.23 },
    { cip13: '3400927983153', nom: 'LYMECYCLINE ARW 408MG GELU B2B',     ip: 4.90 },
    { cip13: '3400930248478', nom: 'METOPIMAZINE VNP 7,5MG SS DIS16',    ip: 1.62 },
    { cip13: '3400930252512', nom: 'NEFOPAM PANP 30MG CPR PEL BT30',     ip: 9.20 },
    { cip13: '3400930302095', nom: 'OXAZEPAM SSP 10MG',                  ip: 0.89 },
    { cip13: '3400930302118', nom: 'OXAZEPAM SSP 50MG',                  ip: 1.29 },
    { cip13: '3400937234146', nom: 'PROPRANOLOL TEVA LP 80 GL30',        ip: 2.83 },
    { cip13: '3400937234375', nom: 'PROPRANOLOL TEVA LP 80 GL90',        ip: 8.08 },
    { cip13: '3400937230933', nom: 'PROPRANOLOL TEVA LP 160 GL30',       ip: 4.78 },
    { cip13: '3400937231183', nom: 'PROPRANOLOL TEVA LP 160 GL90',       ip: 13.65 },
    { cip13: '3400930122372', nom: 'RITONAVIR MYL 100MG CPR FL30',       ip: 7.80 },
    { cip13: '3400930152812', nom: 'ZOPICLONE ARL 3,75MG CPR BT14',      ip: 1.09 },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // OFFRES PRIVILEGES IP — Tests / Masques / Serum physio (jaune, layout images)
  // ─────────────────────────────────────────────────────────────────────────
  var PRIVILEGES = [
    { cip13: '3700567700876', nom: 'SERUM PHY NACL 0.9% VERSOL FL500ml',  cond: 'colis standard: 20 FL', ip: 1.23 },
    { cip13: '3700567700890', nom: 'SERUM PHY NACL 0.9% VERSOL FL1000ML', cond: 'colis standard: 10 FL', ip: 1.75 },
    { cip13: '3700725031705', nom: 'SERINGUE NASALE BEBE Lot 2 seringues', cond: '', ip: 0.93 },
    { cip13: '6974246461137', nom: 'AUTOTEST COMBO GRIPPE/COVID',          cond: 'Boite de 1', ip: 1.33 },
    { cip13: '6905642473219', nom: 'MASQUES CHIRURGICAUX IRR BLEU',        cond: 'Boite de 50', ip: 0.93 },
    { cip13: '6939663976367', nom: 'AUTOTEST COVID - SEJOY',               cond: 'Boite de 1', ip: 0.62 },
    { cip13: '6939663985307', nom: 'TROD ANGINE TEST RAPID - SEJOY',       cond: 'Boite de 25', ip: 15.45 },
    { cip13: '6939663985086', nom: 'TEST URINAIRE CYSTITE - SEJOY',        cond: 'Boite de 25', ip: 5.14 },
    { cip13: '6939663978415', nom: 'TEST ANTIGENIQUE COVID/GRIPPE/VRS',    cond: 'Boite de 25', ip: 27.04 },
    { cip13: '6939663978309', nom: 'TEST ANTIGENIQUE COVID/GRIPPE',        cond: 'Boite de 25', ip: 21.89 },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // Conversion vers le shape attendu par marketing.js (cip13, designation,
  // ppht, prix_ip, remise_pct, marque)
  // ─────────────────────────────────────────────────────────────────────────
  function toProduct(p, marque) {
    var cip13 = p.cip13 || (p.cip7 ? cip7to13(p.cip7) : '');
    var ppht = p.ppht || null;
    var prix_ip = p.ip || null;
    var rem = remisePct(ppht, prix_ip);
    return {
      cip13: cip13,
      ean: cip13,
      designation: p.nom,
      conditionnement: p.cond || '',
      ppht: ppht,
      prix_ip: prix_ip,
      remise_pct: rem,
      marque: marque || '',
      atc2: '',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT : window.MARKETING_IP_OFFERS = 8 offres officielles
  // ─────────────────────────────────────────────────────────────────────────
  window.MARKETING_IP_OFFERS = [
    {
      id: 'ip_vaccins',
      title: 'OFFRE IP Vaccins',
      subtitle: 'Vaccins PC60 · Tarif 2026',
      color: 'navy',
      template: 'memo',
      footer: 'Tarif en vigueur 2026',
      products: VACCINS.map(function (p) { return toProduct(p, 'Vaccins IP'); }),
    },
    {
      id: 'ip_glp1',
      title: 'OFFRE IP — Wegovy & Mounjaro',
      subtitle: 'GLP-1 anti-obésité · Tarif 2026',
      color: 'sky',
      template: 'offre',
      footer: 'Tarif en vigueur 2026',
      products: GLP1.map(function (p) { return toProduct(p, 'Novo Nordisk / Lilly'); }),
    },
    {
      id: 'ip_sildenafil',
      title: 'OFFRE IP — Sildenafil & Tadalafil',
      subtitle: 'Génériques Zydus · Tarif 2026',
      color: 'lilac',
      template: 'offre',
      footer: 'Tarif en vigueur 2026 · Zydus',
      products: SILDENAFIL.map(function (p) { return toProduct(p, 'Zydus'); }),
    },
    {
      id: 'ip_sanofi',
      title: 'OFFRE IP — Sanofi',
      subtitle: 'Doliprane · Aspegic · Codoliprane · Kardegic',
      color: 'amber',
      template: 'memo',
      footer: 'Tarif en vigueur 2026 · Sanofi',
      products: SANOFI.map(function (p) { return toProduct(p, 'Sanofi'); }),
    },
    {
      id: 'ip_upsa',
      title: 'OFFRE IP — UPSA',
      subtitle: 'Dafalgan · Efferalganmed · Niflugel · Nifluril',
      color: 'sky',
      template: 'memo',
      footer: 'Tarif en vigueur 2026 · UPSA',
      products: UPSA.map(function (p) { return toProduct(p, 'UPSA'); }),
    },
    {
      id: 'ip_generique',
      title: 'OFFRE IP Générique',
      subtitle: 'Document interne · TEVA, Sandoz, Biogaran, Arrow…',
      color: 'forest',
      template: 'memo',
      footer: 'Document interne — usage commercial IP',
      products: GENERIQUE.map(function (p) { return toProduct(p, 'Multi'); }),
    },
    {
      id: 'ip_privileges',
      title: 'Offres Privilèges IP',
      subtitle: 'Sérums physio · Masques · Tests TROD · Autotests',
      color: 'amber',
      template: 'focus',
      footer: 'Tarif en vigueur 2026 · Privilèges IP',
      products: PRIVILEGES.map(function (p) { return toProduct(p, 'Privilèges IP'); }),
    },
  ];
})();

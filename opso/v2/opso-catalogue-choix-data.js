// Choix sur « Le catalogue » OPSO — retour du 15/10/2026 sur le CSV. Lu par opso-catalogue.js (construire()).
// PUBLIC : des CIP, rien d'autre (jamais un prix).
// retirer : jamais affiché, même parmi les plus commandés (sa place n'est pas reprise par le suivant ; depuis le 20/10/2026,
//           la dernière page du rayon est complétée par les suivants du classement).
// ajouter : toujours affiché, à son rang par nombre de pharmacies, même au-delà des premiers du rayon.
window.OPSO_CATALOGUE_CHOIX = {
  retirer: [
    '3400930028582',  // REPATHA 140MG INJ STYLO1ML 1 (stock trop faible)
    // Retour du 16/10/2026 (« les lignes que j'enlèverais ») :
    '3400930172803',  // MACROGOL 4000 ZEN 10G BUV S.20
    '3400927400209',  // TANGANIL 500MG CPR BT30
    '3400927567131',  // LORMETAZEPAM ARW 2MG CPR BT14
    '3400926944261',  // DILTIAZEM ZTL LP 300MG GELU 28
    '3400930172810',  // MACROGOL 4000 EG 10G BUV SAC20
    '3400927567070',  // LORMETAZEPAM ARW 1MG CPR BT14
    '3400927665516',  // LIDOCAIN/PRIL.ZEN 5% PANS BT1
    '3400934917547',  // COTRIMOXAZOLE** TVC CPR BT10
    '3400930152812',  // ZOPICLONE ARL 3,75MG CPR BT14
    '3400937466745',  // KETOPROFENE PMY 100MG/2ML AMP6
    '3400930109892',  // PRAMIPEXOLE ZEN LP0,26MG CPR30
    // Intégral ne les aura plus (Will, 12/10/2026) : écartés quand la dernière page des remboursables est complétée (20/10)
    '3400930151105',  // OZEMPIC 1MG INJ STYLO3ML 1
    '3400930003763'   // TRULICITY 1,5MG INJ STY0,5ML 4
  ],
  ajouter: [
    '3400930037904',  // ENTRESTO 24MG/26MG CPR BT28
    '3400930037911',  // ENTRESTO 49MG/51MG CPR BT56
    '3400930037928',  // ENTRESTO 97MG/103MG CPR BT56
    '3400930277133',  // ENTRESTO 15MG/16MG GELU BT60
    '3400937071253',  // RHINOMAXIL 100MCG NAS PULV120D
    '3400937071024',  // RINOCLENIL 100MCG NAS PULV120D
    '3400930234976',  // UVEDOSE 50000UI CAPS MOL BT2
    '3400930234983',  // UVEDOSE 50000UI CAPS MOL BT4
    '3400933222185',  // UVEDOSE 100000UI BUV AMP2ML 1
    '3400930249680',  // CHOLECAL SUBSTIPHARM 200 000 UI AMP1 — prix de l'app retenus (décision de Will, 15/10)
    '3400930258347',  // CHOLECAL SUBSTIPHARM 50 000 UI AMP1
    '3400930258361',  // CHOLECAL SUBSTIPHARM 50 000 UI AMP4
    '3400930249673',  // CHOLECAL SUBSTIPHARM 80 000 UI AMP1
    // Demande de Will, 16/10/2026 : « les Betadine qu'on vend le plus » (≥ 90 pharmacies du réseau, janv.–sept.)
    '3400930108611',  // BETADINE SCRUB SOL FP125ML
    '3400931499787',  // BETADINE 10% SOL LOC FL125ML
    '3400931988014',  // BETADINE 10% GEL TB30G
    '3400930061374',  // BETADINE ALC.5% LOC SOL 125ML1
    '3400931528746',  // BETADINE 10% BAIN BCHE FP125ML
    '3400935983862',  // BETADINE 10% SOL LOC DOS5ML 10
    '3400930108550',  // BETADINE 10% SOL VAG FP125ML
    // Demande de Will, 16/10/2026 (suite) : les autres Betadine que le réseau commande (les 4 jamais commandées restent dehors)
    '3400932194087',  // BETADINE TUL10% 10X10PANS PE10
    '3400932031009',  // BETADINE 250MG OV BT8
    '3400936462922',  // BETADINE TUL10% 10X10 PANS PP5
    '3400935355980',  // BETADINE SCRUB SOL DOS10ML 10
    '3400936409354',  // BETADINE ALC.5% LOC SOL 10ML10
    '3400934928314',  // BETADINE 10% SOL VAG D.10ML 10
    // … et les aiguilles Easydrip, les quatre tailles (6 et 8 mm : fiche lue au catalogue complet, voir construire())
    '6972857294250',  // EASYDRIP+ PRO AIG 4MM 32G B100
    '6972857294236',  // EASYDRIP+ PRO AIG 5MM 31G B100
    '6972857294243',  // EASYDRIP+ PRO AIG 6MM 31G B100
    '6972857294410'   // EASYDRIP+ PRO AIG 8MM 31G B100
  ],
  // Ruptures de fin de mois (approvisionnement Intégral, 22/10/2026 : quotas des laboratoires) — choix de Will : le produit reste,
  // avec la mention ci-dessous (catalogue, écran « Offre Privilège OPSO Santé », PDF, CSV). Toutes les présentations des produits cités.
  // À tenir à jour : un CIP retiré d'ici perd la mention partout.
  mentionDispo: 'Sous réserve de disponibilité',
  sousReserve: [
    '3400930056202',  // GARDASIL 9 INJ SRG0,5ML 1+2AIG
    '3400926863036',  // BEXSERO INJ SRG0,5ML 1 +AIG
    '3400930303122',  // EYLEA 114,3MG/ML INJ SRG 1
    '3400930283325',  // EYLEA 114,3MG/ML INJ FL 1 NSFP
    '3400934744198',  // KARDEGIC 75MG PDR SACH 30
    '3400933247379',  // KARDEGIC 160MG PDR SACH 30
    '3400933226558',  // KARDEGIC 300MG PDR SACH 30
    '3400930040072',  // ABASAGLAR 100U STY(1-80U) 3ML5
    '3400930016169',  // ABASAGLAR 100U INJ CART.3ML 5 - NSFP
    '3400930244371',  // VAXNEUVANCE
    '3400930044605',  // BENEPALI 50MG INJ STYLO1ML 4
    '3400930044599',  // BENEPALI 50MG INJ SRG0,98ML 4
    '3400930092675',  // BENEPALI 25MG INJ SRG0,51ML 4
    '3400930141861',  // SHINGRIX INJ FL+FL 1
    '3400930258620',  // WEGOVY 0,25MG FLEX INJ STYLO SC 1
    '3400930258637',  // WEGOVY 0,5MG FLEX INJ STYLO SC 1
    '3400930317815',  // WEGOVY 0,5MG FLEX INJ STY SC 3ML 1
    '3400930258644',  // WEGOVY 1MG FLEX INJ STYLO SC 1
    '3400930260241',  // WEGOVY 1,7MG FLEX INJ STYLO SC 1
    '3400930258668'   // WEGOVY 2,4MG FLEX INJ STYLO SC 1
  ]
};

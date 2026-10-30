#!/usr/bin/python3 -I
# Calibre la dépense de médicaments remboursables PAR HABITANT et PAR TRANCHE D'ÂGE (29/10/2026).
# Usage : BRUT=<dossier des téléchargements> /usr/bin/python3 -I scripts/potentiel-secteur/calibrer-depense.py
# Aucune donnée de JARVIS n'est lue ici : ni ventes, ni officines, ni fichier protégé. Sources publiques seulement (LISEZMOI.md).
#  numérateur  = Open Medic 2024 (Assurance maladie, base complète, tous régimes), colonne BSE = base de remboursement,
#                par tranche d'âge du bénéficiaire (0 = 0-19 ans, 20 = 20-59 ans, 60 = 60 ans et +), régions de France métropolitaine.
#  dénominateur = population métropolitaine, recensement 2023, même fichier INSEE que les quartiers (somme communes + IRIS).
#  Les tranches INSEE disponibles (0-19, 20-64, 65 et +) ne sont pas celles d'Open Medic (0-19, 20-59, 60 et +) : on CALE les
#  montants sur les tranches INSEE (montant Open Medic de la tranche / population INSEE de la tranche voisine). Au niveau
#  national le total est exact par construction ; localement l'erreur ne vient que de la structure d'âge (60-64 ans).
import csv, json, os
ICI = os.path.dirname(os.path.abspath(__file__))
BRUT = os.environ['BRUT']
OM = BRUT + '/ameli-openmedic/ex/OPEN_MEDIC_2024.CSV'
POP = BRUT + '/insee-iris/ex/DS_RP_POPULATION_PRINC_IRIS_2023_data.csv'
REG_METRO = {'11', '24', '27', '28', '32', '44', '52', '53', '75', '76', '84', '93', '94'}

def num(s):                      # « 1.288,71 » -> 1288.71
    return float(s.replace('.', '').replace(',', '.'))

bse = {}; rem = {}; tot_bse = 0.0; tot_rem = 0.0; hors = {}
with open(OM, newline='', encoding='latin-1') as f:
    r = csv.reader(f, delimiter=';'); h = next(r); ix = {k: i for i, k in enumerate(h)}
    for row in r:
        b = num(row[ix['BSE']]); m = num(row[ix['REM']])
        tot_bse += b; tot_rem += m
        reg, age = row[ix['BEN_REG']], row[ix['age']]
        if reg not in REG_METRO:
            hors['region ' + reg] = hors.get('region ' + reg, 0.0) + b
            continue
        if age not in ('0', '20', '60'):
            hors['age ' + age] = hors.get('age ' + age, 0.0) + b
            continue
        bse[age] = bse.get(age, 0.0) + b; rem[age] = rem.get(age, 0.0) + m

pop = {'Y_LT20': 0.0, 'Y20T64': 0.0, 'Y_GE65': 0.0, '_T': 0.0}
with open(POP, newline='', encoding='utf-8') as f:
    r = csv.reader(f, delimiter=';'); h = next(r); ix = {k: i for i, k in enumerate(h)}
    for row in r:
        g = row[ix['GEO']]
        if g[:2] in ('97', '98', '99'):
            continue
        if row[ix['SEX']] != '_T' or row[ix['IMMI']] != '_T' or row[ix['NATIONALITY_TYPE']] != '_T' or row[ix['HAR']] != '_T' or row[ix['RP_MEASURE']] != 'POP':
            continue
        a = row[ix['AGE']]
        if a in pop:
            pop[a] += float(row[ix['OBS_VALUE']] or 0)

# Le fichier INSEE porte les communes non découpées (GEO_OBJECT=COM) ET les quartiers (IRIS) : aucune commune n'est comptée deux fois
# (vérifié : 49007 n'a aucune ligne COM). Contrôle : somme des trois tranches = total.
ctrl = pop['Y_LT20'] + pop['Y20T64'] + pop['Y_GE65']
r0 = bse['0'] / pop['Y_LT20']; r1 = bse['20'] / pop['Y20T64']; r2 = bse['60'] / pop['Y_GE65']
sortie = {
    'source': "Assurance maladie, Open Medic 2024 (base complète, tous régimes, médicaments délivrés en ville), base de remboursement (BSE), Licence ouverte / Open Licence ; population INSEE recensement 2023",
    'annee': 2024,
    'url': 'https://www.assurance-maladie.ameli.fr/etudes-et-donnees/open-medic-base-complete-depenses-medicaments',
    'unite': "euros de base de remboursement par habitant et par an",
    'eur_par_habitant_par_bande': [round(r0, 2), round(r1, 2), round(r2, 2), round(r2, 2)],
    'bandes_colonnes': ['pop0019', 'pop2064', 'pop6579', 'pop80p'],
    'note': "Open Medic ne coupe pas les 60 ans et + : 65-79 ans et 80 ans et + reçoivent donc le même montant par habitant (65 ans et +). Tranches Open Medic 0-19 / 20-59 / 60+ calées sur 0-19 / 20-64 / 65+ de l'INSEE.",
    'bse_metropole_par_tranche_open_medic_eur': {k: round(v) for k, v in bse.items()},
    'rem_metropole_par_tranche_open_medic_eur': {k: round(v) for k, v in rem.items()},
    'population_metropole_insee_2023': {k: round(v) for k, v in pop.items()},
    'controle_somme_tranches_moins_total': round(ctrl - pop['_T']),
    'bse_total_fichier_eur': round(tot_bse), 'rem_total_fichier_eur': round(tot_rem),
    'bse_exclu_eur': {k: round(v) for k, v in hors.items()},
    'bse_metropole_retenu_eur': round(sum(bse.values())),
}
json.dump(sortie, open(ICI + '/depense-par-age.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(sortie, ensure_ascii=False, indent=1))

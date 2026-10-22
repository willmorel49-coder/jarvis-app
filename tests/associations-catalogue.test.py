#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
associations-catalogue.test.py — une association porte UNE étiquette, celle de sa composition.

Le 22/10/2026, 917 produits du catalogue étaient des associations que la colonne `artmol`
étiquetait d'une seule substance (TRAMADOL/PAR.SDZ → « PARACETAMOL ») : « Toute la molécule »
additionnait leurs clientes à celles de la substance seule. `generate_catalogue_complet.py` lit
désormais la composition officielle (BDPM). Ce test rejoue les cas connus sur une base miniature,
puis le chemin de secours réel : site officiel injoignable → copie locale ; copie figée → arrêt.
"""
import datetime
import io
import os
import sys
import tempfile
import types
import contextlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
# Le générateur lit le tarif (STATS/, openpyxl) dès son chargement : neutralisé, aucune règle touchée.
try:
    import openpyxl  # noqa: F401
except ImportError:
    sys.modules['openpyxl'] = types.ModuleType('openpyxl')
import source_prix  # noqa: E402
source_prix.source_prix = lambda *a, **k: ''
with contextlib.redirect_stdout(io.StringIO()):
    import generate_catalogue_complet as g  # noqa: E402

ECHECS = []


def check(nom, cond, detail=''):
    print(('  ok   ' if cond else '  ÉCHEC ') + nom + ('' if cond else '  → ' + str(detail)))
    if not cond:
        ECHECS.append(nom)


COMPO = {
    'T': [('86571', 'CHLORHYDRATE DE TRAMADOL', 'TRAMADOL'), ('02202', 'PARACÉTAMOL', None)],
    'V1': [('01', 'VALSARTAN', None), ('02', 'HYDROCHLOROTHIAZIDE', None)],
    'V2': [('01', 'VALSARTAN', None), ('02', 'HYDROCHLOROTHIAZIDE', None)],
    'D': [('02202', 'PARACÉTAMOL', None)],
    'E': [('03', 'MÉSILATE DE DABIGATRAN ÉTEXILATE', None)],
    'S': [('04', 'SACUBITRIL', None), ('05', 'VALSARTAN', None)],
    'R': [('06', 'FUROATE DE FLUTICASONE', None), ('07', 'TRIFÉNATATE DE VILANTÉROL', 'VILANTÉROL')],
    'O': [('08', 'CARBONATE DE CALCIUM', None)],
    'A1': [('09', 'AMOXICILLINE TRIHYDRATÉE', 'AMOXICILLINE'),
           ('10', 'CLAVULANATE DE POTASSIUM', 'CLAVULANIQUE (ACIDE)')],
    'A2': [('11', 'AMOXICILLINE SODIQUE', 'AMOXICILLINE'),          # autre sel : même composition
           ('10', 'CLAVULANATE DE POTASSIUM', 'CLAVULANIQUE (ACIDE)')],
    'B': [('12', 'DIPROPIONATE DE BÉTAMÉTHASONE', 'BÉTAMÉTHASONE'),  # une molécule, deux sels
          ('13', 'PHOSPHATE SODIQUE DE BÉTAMÉTHASONE', 'BÉTAMÉTHASONE')],
    'L': [('14', 'LIDOCAÏNE', None), ('15', 'PRILOCAÏNE', None)],
    'F': [('16', 'FOSINOPRIL SODIQUE', None), ('02', 'HYDROCHLOROTHIAZIDE', None)],
    'H': [('17', 'ARNICA MONTANA', None), ('18', 'BELLADONNA', None)],
    'M': [('19', 'CHLORURE DE POTASSIUM', None), ('20', 'CHLORURE DE SODIUM', None),
          ('21', 'BICARBONATE DE SODIUM', None), ('22', 'MACROGOL 3350', None)],
}
PRODUITS = [  # cip, cis, désignation, étiquette actuelle
    ('t1', 'T', 'TRAMADOL/PAR.SDZ 37,5/325 CP20', 'PARACETAMOL'),
    ('v1', 'V1', 'VALSARTAN/HYD.CRT 80/12,5 CP30', 'HYDROCHLOROTHIAZIDE'),
    ('v2', 'V1', 'VALSARTAN/HYD.BGA 160/25 CP30', 'VALSARTAN/HYD'),
    ('v3', 'V2', 'VALSARTAN/HYD.EG 160/12,5 CP30', 'VALSARTAN/HYDROCHLOROTHIAZIDE'),
    ('v4', 'V2', 'VALSARTAN/HYD.ZEN 80/12,5 CP90', 'HYDROCHLOROTHIAZIDE'),
    ('v5', 'V2', 'VALSARTAN/HYD.TEVA 80/12,5 CP90', ''),
    ('d1', 'D', 'DOLIPRANE 1000MG CPR BT8', 'PARACETAMOL'),
    ('e1', 'E', 'DABIGAT/ETEX BIOG 75MG GELU 30', 'DABIGATRAN ETEXILATE'),
    ('s1', 'S', 'ENTRESTO 49MG/51MG CPR BT56', 'SACUBITRIL/VALSARTAN'),
    ('r1', 'R', 'RELVAR ELLIPTA 184/22MCG30DOSX3', 'BETAMETHASONE VALERATE'),
    ('o1', 'O', 'OROCAL 500MG CPR CROQ/SUC FL60', 'CALCIUM/VIT D'),
    ('a1', 'A1', 'AMOX/AC.CLAV.BGA 1G/125 SACH', 'AMOXICILLINE'),
    ('a2', 'A2', 'AUGMENTIN 1G/125MG ADULTE SACH', 'ACIDE CLAVULANIQUE'),
    ('a3', 'A1', 'AMOX/AC.CLAV.ARW 500/62,5 CP', 'AMOXICILLINE/ACIDE CLAVULANIQUE'),
    ('b1', 'B', 'DIPROSTENE INJ SRG 1ML', 'BETAMETHASONE'),
    ('l1', 'L', 'EMLA 5% CREME TB5G', 'LIDOCAINE'),
    ('f1', 'F', 'FOSINOPRIL/HYD.BGA 20/12,5 C30', 'FOSINOPRIL'),
    ('f2', None, 'FOSINOPRIL/HYD.CRT 20/12,5 C90', 'FOSINOPRIL'),          # absent de la base
    ('x1', None, 'ZORGLUB/PLOUF.XYZ 10MG CP30', 'ZORGLUB'),                # absent, sans frère
    ('h1', 'H', 'HOMEOPLEX GRANULES', 'ARNICA'),
    ('m1', 'M', 'MOVICOL CITRON BUV PDR SACH 20', 'MACROGOL 3350'),
]


def jeu():
    cat = {c: {'c': c, 'd': d, 'mol': m} for c, _, d, m in PRODUITS}
    return cat, {c: cis for c, cis, _, _ in PRODUITS if cis}


print('Étiquettes des associations')
cat, cip2cis = jeu()
with contextlib.redirect_stdout(io.StringIO()):
    b = g.corriger_associations(cat, cip2cis, COMPO, {'H'})
m = {c: o['mol'] for c, o in cat.items()}
check('TRAMADOL/PAR.SDZ → association tramadol + paracétamol', m['t1'] == 'TRAMADOL/PARACETAMOL', m['t1'])
check('tous les VALSARTAN/HYD sous la même étiquette, écrite en entier',
      {m['v1'], m['v2'], m['v3'], m['v4']} == {'VALSARTAN/HYDROCHLOROTHIAZIDE'}, [m['v1'], m['v2'], m['v3'], m['v4']])
check('produit sans molécule : rien d\'inventé', m['v5'] == '' and 'v5' in b['vides'], m['v5'])
check('DOLIPRANE 1000 reste PARACETAMOL', m['d1'] == 'PARACETAMOL', m['d1'])
check('DABIGAT/ETEX reste DABIGATRAN ETEXILATE (une seule substance)', m['e1'] == 'DABIGATRAN ETEXILATE', m['e1'])
check('ENTRESTO reste SACUBITRIL/VALSARTAN', m['s1'] == 'SACUBITRIL/VALSARTAN', m['s1'])
check('étiquette sans rapport (RELVAR) laissée et listée',
      m['r1'] == 'BETAMETHASONE VALERATE' and any(x[0] == 'r1' for x in b['sans_rapport']), m['r1'])
check('OROCAL (une substance, étiquette « A/B ») non touché', m['o1'] == 'CALCIUM/VIT D', m['o1'])
check('amoxicilline + clavulanique : un seul nom malgré deux sels',
      m['a1'] == m['a2'] == m['a3'] == 'AMOXICILLINE/ACIDE CLAVULANIQUE', [m['a1'], m['a2'], m['a3']])
check('une molécule sous deux sels n\'est pas une association', m['b1'] == 'BETAMETHASONE', m['b1'])
check('aucune « A/B » existante → noms officiels sans accent', m['l1'] == 'LIDOCAINE/PRILOCAINE', m['l1'])
check('produit absent de la base : l\'étiquette de son frère',
      m['f2'] == m['f1'] == 'FOSINOPRIL/HYDROCHLOROTHIAZIDE', [m['f1'], m['f2']])
check('absent de la base sans frère : inchangé et listé',
      m['x1'] == 'ZORGLUB' and any(x[0] == 'x1' for x in b['hors_bdpm_seuls']), m['x1'])
check('homéopathie exclue', m['h1'] == 'ARNICA', m['h1'])
check('plus de 3 molécules (MOVICOL) : laissé tel quel',
      m['m1'] == 'MACROGOL 3350' and 'm1' in b['nombreuses'], m['m1'])
check('aucune étiquette d\'association posée sur un produit à une seule substance',
      all(len(g.fractions(COMPO[cip2cis[c]])) >= 2 for c, _, _, _ in b['changes']))

print('Garde-fou : changements en série')
cat, cip2cis = jeu()
plafond, g.CHANGEMENTS_MAX = g.CHANGEMENTS_MAX, 3
try:
    with contextlib.redirect_stdout(io.StringIO()):
        g.corriger_associations(cat, cip2cis, COMPO, {'H'})
    check('au-delà du plafond, le script s\'arrête', False, 'aucun arrêt')
except SystemExit as e:
    check('au-delà du plafond, le script s\'arrête', 'plafond' in str(e), e)
g.CHANGEMENTS_MAX = plafond

print('Chemin de la base officielle : site injoignable, copie locale, copie figée')


def copie(dossier, jours):
    d = (datetime.date.today() - datetime.timedelta(days=jours)).strftime('%d/%m/%Y')
    lignes = ['6%07d\t%07d\tboîte\tPrésentation active\tDéclaration de commercialisation\t%s\t34009%08d'
              % (i, i, d, i) for i in range(10001)]
    open(os.path.join(dossier, 'CIS_CIP_bdpm.txt'), 'w', encoding='utf-8').write('\n'.join(lignes))
    compo = ['6%07d\tcomprimé\t%05d\tSUBSTANCE %d\t1 mg\tun comprimé\tSA\t1' % (i, i, i) for i in range(10001)]
    open(os.path.join(dossier, 'CIS_COMPO_bdpm.txt'), 'wb').write('\r\n'.join(compo).encode('latin-1'))
    open(os.path.join(dossier, 'CIS_bdpm.txt'), 'wb').write(
        '60000001\tX\tcomprimé\torale\tAutorisation active\tEnreg homéo (Proc. Nat.)\tCommercialisée'.encode('latin-1'))


base, local = g.BDPM_BASE, g.BDPM_LOCAL
g.BDPM_BASE = 'http://127.0.0.1:9/'           # port fermé : le « site » ne répond pas
with tempfile.TemporaryDirectory() as tmp:
    g.BDPM_LOCAL = tmp
    copie(tmp, 20)
    with contextlib.redirect_stdout(io.StringIO()) as out:
        r = g.lire_bdpm()
    check('site injoignable → copie locale lue', 'copie locale' in r[3] and len(r[0]) == 10001, out.getvalue())
    check('homéopathie repérée dans la copie', r[2] == {'60000001'}, r[2])
    copie(tmp, g.BDPM_AGE_MAX_J + 30)
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            g.lire_bdpm()
        check('copie figée → arrêt, catalogue non régénéré', False, 'aucun arrêt')
    except SystemExit as e:
        check('copie figée → arrêt, catalogue non régénéré', 'NON régénéré' in str(e), e)
g.BDPM_BASE, g.BDPM_LOCAL = base, local

if ECHECS:
    print('\n%d échec(s)' % len(ECHECS))
    sys.exit(1)
print('\nTous les contrôles passent.')

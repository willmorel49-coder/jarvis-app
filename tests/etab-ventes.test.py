#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
etab-ventes.test.py — generate_etab_ventes.py : la règle d'export et les refus, sur un petit jeu FABRIQUÉ.

Rien de réel : un faux dossier STATS (clients_actifs, pont de codes, trois fichiers de ventes) bâti dans un
dossier temporaire. Les réponses sont connues d'avance.
Lancer : /usr/bin/python3 tests/etab-ventes.test.py
"""
import datetime
import importlib.util
import json
import os
import sys
import tempfile

import openpyxl

ICI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('gev', os.path.join(ICI, '..', 'generate_etab_ventes.py'))
G = importlib.util.module_from_spec(spec)
spec.loader.exec_module(G)

ECHECS = []


def check(nom, cond, detail=''):
    print(('OK   ' if cond else 'ÉCHEC ') + nom + ('' if cond else '  -> ' + str(detail)))
    if not cond:
        ECHECS.append(nom)


def xlsx(chemin, entetes, lignes):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(entetes)
    for l in lignes:
        ws.append(l)
    wb.save(chemin)


ENT = ['PCVNUM', 'PCVDATEEFFET', 'TIRCODE', 'PLVQTE', 'TVATAUX', 'ARTCODEBARRE', '__SOURCE_FILE__']
D = lambda m, j: datetime.datetime(2026, m, j)


def faux_stats(avec_mois2=True):
    """Clients : 1111 = Revendeur, 2222 = Pharmacie, 3333 = Grossiste (ni l'un ni l'autre), 4444 = Négociant."""
    st = tempfile.mkdtemp(prefix='etabventes-')
    os.makedirs(os.path.join(st, 'total ventes'))
    xlsx(os.path.join(st, 'total ventes', 'clients_actifs_2026-10-02.xlsx'), ['TIRCODE', 'TIRACTIVITE'],
         [[1111, 'Revendeur'], [2222, 'Pharmacie'], [3333, 'Grossiste'], [4444, 'Négociant']])
    json.dump({'alias': {'9999999999999': '3400000000001'}}, open(os.path.join(st, 'pont-codes.json'), 'w'))
    A, B = '3400000000001', '3400000000002'
    # janvier : OPS (Revendeur export, Pharmacie France, Pharmacie à TVA 0 = France, Grossiste TVA 0 = export,
    # Négociant TVA 2,1 = export) ; un avoir ; l'ancien code du pont ; Escale à part.
    xlsx(os.path.join(st, 'WML_01_2026.xlsx'), ENT, [
        ['FA1', D(1, 5), 1111, 10, 0, A, 'OPS_Pharma.xlsx'],
        ['FA2', D(1, 6), 2222, 4, 2.1, A, 'OPS_Pharma.xlsx'],
        ['FA3', D(1, 7), 2222, 3, 0, A, 'OPS_Pharma.xlsx'],
        ['FA4', D(1, 8), 3333, 5, 0, B, 'OPS_Pharma.xlsx'],
        ['FA5', D(1, 9), 4444, 6, 2.1, B, 'OPS_Pharma.xlsx'],
        ['AC1', D(1, 20), 2222, -1, 2.1, A, 'OPS_Pharma.xlsx'],
        ['FA6', D(1, 10), 2222, 2, 2.1, '9999999999999', 'OPS juillet_Pharma.xlsx'],
        ['FA7', D(1, 11), 2222, 7, 2.1, A, 'SEP_Pharma.xlsx'],
    ])
    xlsx(os.path.join(st, 'GUY_01_2026.xlsx'), ['PCVNUM', 'PCVDATEEFFET', 'TIRCODE', 'PLVQTE', 'ARTCODEBARRE'],
         [['FE1', D(1, 3), 2222, 50, A]])
    if avec_mois2:
        xlsx(os.path.join(st, 'WML_02_2026.xlsx'), ENT, [
            ['FB1', D(2, 2), 2222, 1, 2.1, A, 'OPS_Pharma.xlsx'],
            ['FB2', D(2, 3), 2222, 1, 2.1, A, 'SEP_Pharma.xlsx'],
        ] + [['FB%d' % i, D(2, 4), 2222, 1, 2.1, B, 'SEP_Pharma.xlsx'] for i in range(10, 30)])
    return st


# ── 1. Les trois cas de la demande ──
check('un Revendeur = export', G.est_export('Revendeur', 2.1) is True)
check('un Négociant = export', G.est_export('Négociant', 2.1) is True)
check('une Pharmacie à TVA 0 = France', G.est_export('Pharmacie', 0) is False)
check('un non-Pharmacie à TVA 0 = export', G.est_export('Grossiste', 0) is True)
check('un client inconnu à TVA 0 = export', G.est_export(None, 0) is True)
check('un client inconnu à TVA 2,1 = France', G.est_export(None, 2.1) is False)
check('TVA absente (None) n\'est pas un 0', G.est_export('Grossiste', None) is False)
check('OPS_Pharma.xlsx -> OPS', G.code_site('OPS_Pharma.xlsx') == 'OPS')
check('« OPS juillet_Pharma » -> OPS', G.code_site('OPS juillet_Pharma.xlsx') == 'OPS')
check('vide -> None', G.code_site(None) is None and G.code_site('') is None)

# ── 2. De bout en bout sur de vrais .xlsx fabriqués ──
st = faux_stats()
G_SITES = G.SITES
try:
    don, res = G.construire(st, processus=1, journal=lambda *a: None)
    check('refus attendu : des sites sans ligne le mois 2', False, 'aucun refus')
except SystemExit as e:
    check('refus si un site n\'a aucune ligne un mois après son depuis (CPR, HP... absents)', 'REFUS' in str(e), e)

# Les 7 sites doivent exister : on fabrique un jeu où chaque site a des lignes les deux mois.
st = tempfile.mkdtemp(prefix='etabventes-')
os.makedirs(os.path.join(st, 'total ventes'))
xlsx(os.path.join(st, 'total ventes', 'clients_actifs_2026-10-02.xlsx'), ['TIRCODE', 'TIRACTIVITE'],
     [[1111, 'Revendeur'], [2222, 'Pharmacie'], [3333, 'Grossiste'], [4444, 'Négociant']])
json.dump({'alias': {'9999999999999': '3400000000001'}}, open(os.path.join(st, 'pont-codes.json'), 'w'))
A, B = '3400000000001', '3400000000002'
for mois in (1, 2):
    lignes = []
    for s in G.SITES:
        n = 20 if not (s == 'SEP' and mois == 1) else 1     # SEP presque vide en janvier
        for i in range(n):
            lignes.append(['F%s%d%d' % (s, mois, i), D(mois, 2 + (i % 20)), 2222, 1, 2.1, B, s + '_Pharma.xlsx'])
    if mois == 1:
        lignes += [
            ['FA1', D(1, 5), 1111, 10, 0, A, 'OPS_Pharma.xlsx'],
            ['FA2', D(1, 6), 2222, 4, 2.1, A, 'OPS_Pharma.xlsx'],
            ['FA3', D(1, 7), 2222, 3, 0, A, 'OPS_Pharma.xlsx'],
            ['FA4', D(1, 8), 3333, 5, 0, A, 'OPS_Pharma.xlsx'],
            ['FA5', D(1, 9), 4444, 6, 2.1, A, 'OPS_Pharma.xlsx'],
            ['AC1', D(1, 20), 2222, -1, 2.1, A, 'OPS_Pharma.xlsx'],
            ['FA6', D(1, 10), 2222, 2, 2.1, '9999999999999', 'OPS juillet_Pharma.xlsx'],
        ]
    xlsx(os.path.join(st, 'WML_%02d_2026.xlsx' % mois), ENT, lignes)
xlsx(os.path.join(st, 'GUY_01_2026.xlsx'), ['PCVNUM', 'PCVDATEEFFET', 'TIRCODE', 'PLVQTE', 'ARTCODEBARRE'], [['FE1', D(1, 3), 2222, 50, A]])
xlsx(os.path.join(st, 'GUY_02_2026.xlsx'), ['PCVNUM', 'PCVDATEEFFET', 'TIRCODE', 'PLVQTE', 'ARTCODEBARRE'], [['FE2', D(2, 3), 2222, 50, A]])

don, res = G.construire(st, processus=1, journal=lambda *a: None)
ops = don['v'][A]['OPS']
# OPS, produit A : France = 4 (pharmacie) + 3 (pharmacie à TVA 0) - 1 (avoir) + 2 (ancien code via le pont) = 8
# export = 10 (Revendeur) + 5 (Grossiste TVA 0) + 6 (Négociant) = 21
check('OPS produit A : unités France = 8 (avoir déduit, ancien code ramené par le pont)', ops[0] == 8, ops)
check('OPS produit A : unités export = 21 (Revendeur + Grossiste TVA 0 + Négociant)', ops[1] == 21, ops)
check('dernière vente = dernière ligne positive hors avoir (10/01, pas l\'avoir du 20/01)', ops[2] == '2026-01-10', ops)
check('Escale à part : 2 lignes comptées, aucune dans le fichier', res['escale_lignes_a_part'] == 2 and 'ESCALE' not in str(don['sites']), res['escale_lignes_a_part'])
check('seulement les 7 sites', sorted(don['sites']) == sorted(G.SITES), sorted(don['sites']))
check('a = dernière facture LUE (février, pas aujourd\'hui)', don['a'] == '2026-02-21' or don['a'].startswith('2026-02'), don['a'])
check('de = 1er janvier', don['de'] == '2026-01-01', don['de'])
check('SEP presque vide en janvier : depuis février', don['sites']['SEP']['depuis'] == '2026-02', don['sites']['SEP'])
check('OPS depuis janvier', don['sites']['OPS']['depuis'] == '2026-01', don['sites']['OPS'])
check('SEP : la ligne de janvier n\'est pas comptée (avant son depuis)', B in don['v'] and don['v'][B]['SEP'][0] == 20, don['v'][B]['SEP'])

# ── 3. Refus ──
st2 = tempfile.mkdtemp(prefix='etabventes-')
os.makedirs(os.path.join(st2, 'total ventes'))
xlsx(os.path.join(st2, 'total ventes', 'clients_actifs_2026-10-02.xlsx'), ['TIRCODE', 'TIRACTIVITE'], [[2222, 'Pharmacie']])
for mois in (1, 3):    # le mois 2 manque
    xlsx(os.path.join(st2, 'WML_%02d_2026.xlsx' % mois), ENT,
         [['F%s%d' % (s, mois), D(mois, 2), 2222, 1, 2.1, A, s + '_Pharma.xlsx'] for s in G.SITES])
try:
    G.construire(st2, processus=1, journal=lambda *a: None)
    check('refus si un mois manque', False, 'aucun refus')
except SystemExit as e:
    check('refus si un mois manque', 'REFUS' in str(e) and '[2]' in str(e), e)

chemin = os.path.join(tempfile.mkdtemp(prefix='etabventes-'), 'etab-ventes-data.js')
G.ecrire(dict(don, lignes=1000), chemin)
try:
    G.controler_precedent(dict(don, lignes=700), chemin)
    check('refus sous 80 % des lignes de la fois précédente', False, 'aucun refus')
except SystemExit as e:
    check('refus sous 80 % des lignes de la fois précédente', 'REFUS' in str(e), e)
try:
    G.controler_precedent(dict(don, lignes=900), chemin)
    check('900 lignes sur 1000 acceptées', True)
except SystemExit as e:
    check('900 lignes sur 1000 acceptées', False, e)
try:
    G.controler_precedent(dict(don, lignes=1000, a='2026-01-31'), chemin)
    check('refus si la dernière facture recule', False, 'aucun refus')
except SystemExit as e:
    check('refus si la dernière facture recule', 'REFUS' in str(e), e)
txt = open(chemin, encoding='utf-8').read()
check('le fichier écrit se relit (window.ETAB_VENTES = {...})', 'window.ETAB_VENTES = {' in txt and json.loads(txt[txt.index('{', txt.index('ETAB_VENTES')):txt.rindex('}') + 1])['de'] == '2026-01-01')

if ECHECS:
    print('\n%d ÉCHEC(S)' % len(ECHECS))
    sys.exit(1)
print('\nTout est vert.')

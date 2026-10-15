#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""mois-2027.test.py — les mois des tableurs de ventes passent l'année 2027 sans casser 2026.

Aucune donnée réelle : tout est inventé. Charge les VRAIES fonctions livrées (mois_wml.py) et la VRAIE lecture
de generate_wml_v2.py par generate_marge_clients.py (lire_wml_v2), sur le vrai fichier puis sur un faux source.
"""
import importlib.util
import os
import sys
import tempfile

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RACINE)
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('generate_marge_clients', os.path.join(RACINE, 'generate_marge_clients.py'))
gm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gm)
import mois_wml as mw

ECHECS = []


def check(nom, cond, detail=''):
    print('  %s %s %s' % ('ok  ' if cond else 'ÉCHEC', nom, '' if cond else detail))
    if not cond:
        ECHECS.append(nom)


# mois compacté : 1..12 = 2026, 13 = janvier 2027 (ne change jamais)
check('2026-01 -> 1', mw.mois_compacte(2026, 1) == 1)
check('2026-12 -> 12', mw.mois_compacte(2026, 12) == 12)
check('2027-01 -> 13', mw.mois_compacte(2027, 1) == 13)
check('2027-12 -> 24', mw.mois_compacte(2027, 12) == 24)
check('AN0 = 2026', mw.AN0 == 2026)

# noms de tableurs
check('nom 2026', mw.nom_tableur('WML', 2026, 9) == 'WML_09_2026.xlsx')
check('nom 2027', mw.nom_tableur('KV', 2027, 1) == 'KV_01_2027.xlsx')

# libellé de période
ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
l26 = [(2026, m) for m in range(1, 10)]
check('période 2026 inchangée', mw.periode(l26, ABBR) == 'Jan-Sep 2026', mw.periode(l26, ABBR))
check('période à cheval sur deux ans', mw.periode(l26 + [(2026, 12), (2027, 1)], ABBR) == 'Jan 2026-Jan 2027', mw.periode(l26 + [(2026, 12), (2027, 1)], ABBR))

# la vraie lecture de generate_wml_v2.py : MOIS_LUS 2026 = ce qu'était MONTHS_NUM, WML_MOIS construit comme avant
env = gm.lire_wml_v2(os.path.join(RACINE, 'generate_wml_v2.py'))
check('MOIS_LUS lu : couples (année, mois)', all(isinstance(x, tuple) and len(x) == 2 for x in env['MOIS_LUS']))
check('MOIS_LUS commence à 2026-01', env['MOIS_LUS'][0] == (2026, 1))
check('WML_MOIS 2026 = chaînes AAAA-MM', ['%d-%02d' % x for x in l26][:3] == ['2026-01', '2026-02', '2026-03'])

# faux source avec janvier 2027 ajouté : la lecture suit sans toucher au reste
# une seule liste à la main : generate_wml_sales.py lit celle de generate_wml_v2.py (pas de 2e copie à oublier)
import ast
_src = open(os.path.join(RACINE, 'generate_wml_sales.py'), encoding='utf-8').read()
_aff = [n.value for n in ast.parse(_src).body if isinstance(n, ast.Assign) and len(n.targets) == 1
        and isinstance(n.targets[0], ast.Name) and n.targets[0].id == 'MOIS_LUS']
check('ventes OPSO : MOIS_LUS = lire_mois_lus()', len(_aff) == 1 and isinstance(_aff[0], ast.Call)
      and getattr(_aff[0].func, 'id', '') == 'lire_mois_lus' and not _aff[0].args, ast.dump(_aff[0]) if _aff else 'absent')
check('lire_mois_lus() = la liste de generate_wml_v2.py', mw.lire_mois_lus() == env['MOIS_LUS'])

faux = ("SOURCES = [('A', 'AA')]\nRATTACHEES = {}\nAVOIRS_EN_POSITIF = set()\n"
        "MOIS_LUS = [(2026, m) for m in range(1, 10)] + [(2026, 12), (2027, 1)]\n")
with tempfile.NamedTemporaryFile('w', suffix='.py', delete=False, encoding='utf-8') as f:
    f.write(faux)
try:
    e2 = gm.lire_wml_v2(f.name)
    check('faux source : 11 mois dont 2027-01', len(e2['MOIS_LUS']) == 11 and e2['MOIS_LUS'][-1] == (2027, 1), e2['MOIS_LUS'])
    check('ym du dernier mois = 202701', e2['MOIS_LUS'][-1][0] * 100 + e2['MOIS_LUS'][-1][1] == 202701)
finally:
    os.remove(f.name)

if ECHECS:
    print('\n%d ÉCHEC(S)' % len(ECHECS))
    sys.exit(1)
print('\nTous les tests passent.')

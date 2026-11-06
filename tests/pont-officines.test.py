#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pont-officines.test.py — une pharmacie = une fiche, et la fiche garde l'identité du compte ACTUEL.

Le 06/11/2026, la Grande Pharmacie de Beaulieu (Nantes, Arthur) avait deux fiches : « EX2125556 »
en janvier (ancien compte, adresse en CEDEX placée à Machecoul, groupement d'avant) et 2011018
depuis février. La table de Blagnac (_COMPTE_NEUF) garde l'identité du code qu'on retire : appliquée
ici, elle aurait donné à la fiche fusionnée l'ancien nom et l'ancien groupement. Ce test fixe le
sens des deux tables. Lancer : python3 tests/pont-officines.test.py
"""
import importlib.util
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('pont_officines', os.path.join(ROOT, 'pont_officines.py'))
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)
co = P.code_officine

# 1. Reprise sous le même code : la ligne « EX » est l'ancien compte
assert co('EX2060117') == ('2060117', True)
assert co('2060117EX') == ('2060117', True)
assert co('2060117') == ('2060117', False)

# 2. Beaulieu : l'ancien code rejoint le code actuel, en ancien compte (secours seulement)
assert co('EX2125556') == ('2011018', True), co('EX2125556')
assert co('2125556') == ('2011018', True)
assert co('2011018') == ('2011018', False)            # le compte actuel reste l'identité
assert P.codes_comptes('2011018') == ['2011018']      # le groupement d'avant n'est pas repris

# 3. Blagnac et Rochemaure (table _COMPTE_NEUF) : inchangés
assert co('2051038') == ('2015038', False)
assert co('2015038') == ('2015038', True)
assert co('2015038EX') == ('2015038', True)
assert co('2011419') == ('2063584', False)
assert P.codes_comptes('2015038') == ['2051038', '2015038']

# 4. Un code ne peut pas être dans les deux tables : le sens deviendrait ambigu
deux = set(P._ANCIEN_COMPTE) | set(P._ANCIEN_COMPTE.values())
assert not deux & (set(P._COMPTE_NEUF) | P._CODES_GARDES), deux & (set(P._COMPTE_NEUF) | P._CODES_GARDES)

print('pont-officines : OK')

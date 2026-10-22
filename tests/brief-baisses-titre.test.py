# -*- coding: utf-8 -*-
"""Titre des baisses de prix CEPS dans le brief du matin (22/10/2026).

Le titre comptait toutes les baisses à venir avec la date de la plus proche : le 22/10/2026,
« 80 baisses de prix … applicables à partir du 1er novembre 2026 » alors que prix-futurs.json
n'en avait que 5 au 1er novembre et 75 au 2 janvier 2027 (le 20/10 : « 78 … à partir du
20 octobre » pour 3 au 20 octobre). Répartitions reprises du vrai fichier, sans réseau.
Lancer : python3 tests/brief-baisses-titre.test.py
"""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import generate_brief as G  # noqa: E402


def baisses(*groupes):
    return [{'date_effet': d, 'sens': 'baisse', 'd': 'P%d' % i}
            for d, n in groupes for i in range(n)]


G.TODAY = date(2026, 10, 22)

# 1. Le cas du 22/10/2026 : 5 au 1er novembre, 75 au 2 janvier
t, groupe, reste = G.titre_baisses(baisses(('2026-11-01', 5), ('2027-01-02', 75)))
assert t == ('5 baisses de prix publiées au Journal officiel, applicables à partir du 1er novembre 2026'
             ' ; 75 autres au 2 janvier 2027'), t
assert (len(groupe), len(reste)) == (5, 75)

# 2. Trois dates à venir : le reste est borné, jamais rattaché à la première de ses dates
G.TODAY = date(2026, 10, 15)
t, _, _ = G.titre_baisses(baisses(('2026-10-20', 3), ('2026-11-01', 5), ('2027-01-02', 75)))
assert t == ('3 baisses de prix publiées au Journal officiel, applicables à partir du 20 octobre 2026'
             ' ; 80 autres entre le 1er novembre 2026 et le 2 janvier 2027'), t

# 3. Une seule date : pas de « autres »
G.TODAY = date(2026, 11, 2)
t, _, reste = G.titre_baisses(baisses(('2027-01-02', 75)))
assert t == '75 baisses de prix publiées au Journal officiel, applicables à partir du 2 janvier 2027', t
assert reste == []

# 4. Singulier des deux côtés
t, _, _ = G.titre_baisses(baisses(('2026-12-01', 1), ('2027-01-02', 1)))
assert t == ('1 baisse de prix publiée au Journal officiel, applicable à partir du 1er décembre 2026'
             ' ; 1 autre au 2 janvier 2027'), t

# 5. Le chiffre du titre est toujours celui de la date annoncée
G.TODAY = date(2026, 10, 20)
t, groupe, _ = G.titre_baisses(baisses(('2026-11-01', 5), ('2026-10-20', 3), ('2027-01-02', 75)))
assert t.startswith('3 baisses ') and '20 octobre 2026 ;' in t, t
assert all(c['date_effet'] == '2026-10-20' for c in groupe)

print('OK — titre des baisses CEPS : 5 cas')

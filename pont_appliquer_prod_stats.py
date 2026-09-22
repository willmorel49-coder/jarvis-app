#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""Range crm/v2/prod-stats-data.js (fichier PUBLIC, sans conditions) sous les codes gardés du pont
(un produit = un code, 22/09/2026), EN PLACE et sans changer le nombre de lignes : le front recolle
prod-stats-conditions.js PAR POSITION. Une ligne sous un ancien code passe sous le code gardé ; si le
code gardé a déjà sa ligne, l'ancienne reste à sa place avec un code vide (jamais indexée) et le
nombre de pharmacies du code gardé prend le plus grand des deux. Relançable sans effet."""
import os, re, json
from pont_codes import canon
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm', 'v2', 'prod-stats-data.js')
s = open(F, encoding='utf-8').read()
m = re.search(r'window\.PROD_STATS = (\[.*\]);', s, re.S)
rows = json.loads(m.group(1))
par_code = {}
for i, r in enumerate(rows):
    if r.get('c'):
        par_code.setdefault(r['c'], []).append(i)
deplaces = reunis = 0
for c, idx in list(par_code.items()):
    k = canon(c)
    if k == c:
        continue
    for i in idx:
        deplaces += 1
        cible = [j for j in par_code.get(k, []) if j != i and rows[j].get('c')]
        if not cible:
            rows[i]['c'] = k; par_code.setdefault(k, []).append(i); continue
        g = rows[cible[0]]
        g['n'] = max(g.get('n', 0), rows[i].get('n', 0))
        rows[i]['c'] = ''; reunis += 1
open(F, 'w', encoding='utf-8').write(s[:m.start(1)] + json.dumps(rows, ensure_ascii=False) + s[m.end(1):])
print('prod-stats : %d lignes rangées sous leur code gardé, dont %d réunies (ligne gardée, code vidé) ; %d lignes' % (deplaces, reunis, len(rows)))

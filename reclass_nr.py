# -*- coding: utf-8 -*-
"""Reclasse le catalogue NR de marketing-mix-data.js avec les rayons à jour
(mkt_rayons.py), SANS relire les fichiers sources lourds. Réécrit window.MKT_MIX.
Python 3.9.
"""
import re
import json
from mkt_rayons import classify_rayon

F = 'crm/v2/marketing-mix-data.js'

txt = open(F, encoding='utf-8').read()
m = re.search(r'window\.MKT_MIX\s*=\s*(\{.*\});', txt, re.S)
data = json.loads(m.group(1))

# aplatit toutes les lignes NR existantes (dédoublonnées par CIP ou désignation)
flat = {}
for c in data.get('nr', []):
    for r in c.get('rows', []):
        k = r.get('cip') or r.get('d')
        if k not in flat:
            flat[k] = r

groups = {}
for r in flat.values():
    lab = classify_rayon(r.get('d', ''))
    groups.setdefault(lab, []).append(r)

# rayons triés par volume total ; "Autres" toujours en dernier
def vol_total(rows):
    return sum((x.get('vol') or 0) for x in rows)

ordered = sorted(groups, key=lambda k: (k == 'Autres produits NR', -vol_total(groups[k])))
cats = []
for lab in ordered:
    rows = sorted(groups[lab], key=lambda x: (x.get('vol') or 0), reverse=True)[:120]
    cats.append({'cat': lab, 'rows': rows})

data['nr'] = cats

with open(F, 'w', encoding='utf-8') as fh:
    fh.write("// Mix marketing grossiste (L'Intégral + ITP + best-sellers) — generate_marketing_mix.py\n")
    fh.write('window.MKT_MIX = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')

n_autres = len(next((c['rows'] for c in cats if c['cat'] == 'Autres produits NR'), []))
print('OK -> %s' % F)
print('%d produits NR · %d rayons · "Autres" = %d' % (sum(len(c['rows']) for c in cats), len(cats), n_autres))
for c in cats:
    print('  %-34s %d' % (c['cat'], len(c['rows'])))

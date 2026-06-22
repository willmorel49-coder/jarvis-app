# -*- coding: utf-8 -*-
"""Met à jour le prix ('p') des produits du catalogue NR (window.MKT_MIX.nr) au
tarif PPHT officiel (crm/v2/ppht-data.js). Ne touche pas aux autres sections. Python 3.9.
"""
import re
import json

MIX = 'crm/v2/marketing-mix-data.js'
PPHT_F = 'crm/v2/ppht-data.js'

ppht = json.loads(re.search(r'window\.PPHT\s*=\s*(\{.*\});', open(PPHT_F, encoding='utf-8').read(), re.S).group(1))
data = json.loads(re.search(r'window\.MKT_MIX\s*=\s*(\{.*\});', open(MIX, encoding='utf-8').read(), re.S).group(1))

upd = 0
for c in data.get('nr', []):
    for r in c.get('rows', []):
        cip = str(r.get('cip') or '')
        if cip in ppht and r.get('p') != ppht[cip]:
            r['p'] = ppht[cip]
            upd += 1

with open(MIX, 'w', encoding='utf-8') as f:
    f.write("// Mix marketing grossiste (L'Intégral + ITP + best-sellers) — generate_marketing_mix.py\n")
    f.write('window.MKT_MIX = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')

print('OK : %d prix NR mis au PPHT' % upd)

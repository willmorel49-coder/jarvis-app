# -*- coding: utf-8 -*-
"""Met à jour le prix ('p') des produits du mix marketing (window.MKT_MIX) au tarif PPHT
officiel (crm/v2/ppht-data.js). Python 3.9.

Sections traitées (14/10/2026) : nr, rotations, bestsellers ET integral. Avant, seule `nr` l'était :
les trois autres gardaient le tarif du 22/06 (ou, pour `integral`, celui du PDF de mars 2026).
Non traitée : itp (pas de CIP ; ses prix viennent du fournisseur).

`integral` (PDF « L'Intégral ») porte des CIP à 7 chiffres, que ni ETAB_PRICES ni PPHT ne
connaissent. Chaque CIP7 est converti en CIP13 en cherchant, dans PPHT, l'unique code
'3400' + <1 chiffre> + CIP7 + <clé> (on ne calcule PAS la clé : la formule '3400'+cip7+'0' donne 12
caractères, faux). Plusieurs candidats ou aucun : la ligne reste telle quelle (CIP7, prix du PDF).
Le CIP13 trouvé remplace le CIP7 : l'écran retrouve alors le tarif du site (et le stock), et la
« Sélection grossiste » ne montre plus le produit deux fois (CIP13 déjà vu en section nr).

À relancer APRÈS generate_marketing_mix.py (qui réécrit tout au tarif du PDF et en CIP7).
"""
import re
import json
import collections

MIX = 'crm/v2/marketing-mix-data.js'
PPHT_F = 'crm/v2/ppht-data.js'

ppht = json.loads(re.search(r'window\.PPHT\s*=\s*(\{.*?\});\n', open(PPHT_F, encoding='utf-8').read(), re.S).group(1))
data = json.loads(re.search(r'window\.MKT_MIX\s*=\s*(\{.*\});', open(MIX, encoding='utf-8').read(), re.S).group(1))

milieu = collections.defaultdict(list)          # 7 chiffres du CIP7 -> codes CIP13 candidats
for k in ppht:
    if len(k) == 13 and k.startswith('3400'):
        milieu[k[5:12]].append(k)

compte = collections.Counter()
for sec in ('nr', 'rotations', 'bestsellers', 'integral'):
    for c in data.get(sec, []):
        for r in c.get('rows', []):
            cip = str(r.get('cip') or '')
            if sec == 'integral' and len(cip) == 7:
                cand = milieu.get(cip, [])
                if len(cand) != 1:
                    compte['integral CIP7 non résolu (%d candidats), ligne gardée' % len(cand)] += 1
                    continue
                r['cip'] = cip = cand[0]
                compte['integral CIP7 -> CIP13'] += 1
            if cip in ppht and r.get('p') != ppht[cip]:
                r['p'] = ppht[cip]
                compte['prix mis à jour : ' + sec] += 1

with open(MIX, 'w', encoding='utf-8') as f:
    f.write("// Mix marketing grossiste (L'Intégral + ITP + best-sellers) — generate_marketing_mix.py\n")
    f.write('window.MKT_MIX = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')

print('OK :', dict(compte))

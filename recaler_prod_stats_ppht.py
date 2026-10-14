# -*- coding: utf-8 -*-
"""Recale le PPHT de crm/v2/prod-stats-data.js (window.PROD_STATS) sur le tarif le plus récent,
SANS toucher à l'ordre ni au nombre de lignes. Python 3.9.   (14/10/2026)

Pourquoi un recalage et pas generate_prod_stats.py : la table protégée prod-stats-conditions.js
(net, rpct, rota, marge, remise, ca) est collée PAR POSITION sur ce fichier public. Régénérer
tout (ventes plus récentes, seuil de pharmacies) change le nombre et l'ordre des lignes, et
oblige à redéposer la table protégée en même temps — et ferait bouger le net moyen facturé.
Ici seuls `ppht` et `stale` bougent : la table protégée existante reste valide telle quelle.

  ppht  = tarif du fichier choisi par source_prix.py (même règle que generate_ppht.py)
  stale = 1 si ppht > 0 et net moyen facturé > ppht (même formule que generate_prod_stats.py) ;
          le net se lit dans prod-stats-conditions.js (hors dépôt, gitignoré). S'il est absent,
          `stale` n'est pas touché.
Inchangés exprès : `f` (famille/tranche), `n`, `d`, `c`. Les produits absents de la source gardent
leur ppht.
Même recalage, par la même table de tarifs, pour crm/v2/bestsellers-data.js : seul `p` bouge (et
`date_catalogue`) ; la liste, l'ordre et les autres champs restent ceux de la dernière génération.
Usage : python3 recaler_prod_stats_ppht.py [chemin/prod-stats-conditions.js]
"""
import io
import json
import os
import re
import sys
import time

import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from pont_codes import rekey  # noqa: E402
from source_prix import source_prix  # noqa: E402

PUB = os.path.join(ROOT, 'crm', 'v2', 'prod-stats-data.js')
COND = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'prod-stats-conditions.js')

s = io.open(PUB, encoding='utf-8').read()
m = re.search(r'window\.PROD_STATS = (\[.*\]);', s, re.S)
rows = json.loads(m.group(1))

nets = None
if os.path.exists(COND):
    c = io.open(COND, encoding='utf-8').read()
    cm = re.search(r'PROD_COND = \{n:(\d+), rows:(\[.*\])\};', c, re.S)
    tab = json.loads(cm.group(2))
    if int(cm.group(1)) != len(rows) or len(tab) != len(rows):
        sys.exit('ARRÊT : table protégée (%s lignes) et fichier public (%d) ne correspondent pas.'
                 % (cm.group(1), len(rows)))
    nets = [r[0] for r in tab]
else:
    print('  ⚠️ %s absent : `stale` non recalculé' % COND)

ws = openpyxl.load_workbook(source_prix(), read_only=True, data_only=True).active
h = [x.value for x in next(ws.iter_rows(min_row=1, max_row=1))]
ci, pi = h.index('artcodebarre'), h.index('ppht')
tarif = {}
for r in ws.iter_rows(min_row=2, values_only=True):
    k = str(r[ci] or '')
    if k.isdigit() and len(k) >= 12 and isinstance(r[pi], (int, float)):
        tarif[k] = float(r[pi])
tarif = rekey(tarif)
# Référence de prix = ppht-data.js (valeur prise telle quelle) ; la source brute ne sert que pour les CIP absents.
from source_prix import ppht_reference  # noqa: E402
_ref = ppht_reference()
tarif.update({k: v for k, v in _ref.items() if k in tarif})

n_pp = n_st = absent = 0
for i, r in enumerate(rows):
    if r['c'] not in tarif:
        absent += 1
        continue
    p = tarif[r['c']] if r['c'] in _ref else round(tarif[r['c']], 2)
    if p != r['ppht']:
        r['ppht'] = p
        n_pp += 1
    if nets is not None:
        st = 1 if (p > 0 and (nets[i] or 0) > p) else 0
        if st != r.get('stale'):
            r['stale'] = st
            n_st += 1

io.open(PUB, 'w', encoding='utf-8').write(
    s[:m.start()] + 'window.PROD_STATS = ' + json.dumps(rows, ensure_ascii=False) + ';\n')
print('OK : %d lignes (inchangé), %d ppht mis à jour, %d `stale` changés, %d produits absents de la source (gardés)'
      % (len(rows), n_pp, n_st, absent))

# ── crm/v2/bestsellers-data.js : même tarif, seul `p` (+ date_catalogue) ──
BS = os.path.join(ROOT, 'crm', 'v2', 'bestsellers-data.js')
t = io.open(BS, encoding='utf-8').read()
bm = re.search(r'window\.BESTSELLERS = (\{.*\});', t, re.S)
bs = json.loads(bm.group(1))
n_bs = 0
for cat in bs['cats']:
    for r in cat['rows']:
        k = str(r['c'])
        if k in tarif:
            p = tarif[k] if k in _ref else round(tarif[k], 2)
            if p != r['p']:
                r['p'] = p
                n_bs += 1
bs['date_catalogue'] = time.strftime('%Y-%m-%d', time.localtime(os.path.getmtime(source_prix(verbose=False))))
io.open(BS, 'w', encoding='utf-8').write(
    t[:bm.start()] + 'window.BESTSELLERS = ' + json.dumps(bs, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('OK bestsellers : %d prix `p` mis à jour' % n_bs)

# -*- coding: utf-8 -*-
"""Prix PPHT officiel (prix pharmacien HT = tarif grossiste) par CIP13, pour les
produits NON remboursables (NR). Source : STATS/stock et prix <date>.xlsx.
→ crm/v2/ppht-data.js  (window.PPHT = {cip13: ppht})
Sert à corriger le prix NR partout (benchmark prix_ht au chargement + catalogue NR).
Python 3.9.
"""
import re
import json
import glob
import os
import openpyxl

# fichier stock+prix le plus récent
cands = sorted(glob.glob('STATS/stock et prix*.xlsx'), key=os.path.getmtime, reverse=True)
SRC = cands[0]
from pont_codes import rekey  # un produit = un code (22/09/2026)
OUT = 'crm/v2/ppht-data.js'
print('source:', SRC)

ws = openpyxl.load_workbook(SRC, read_only=True, data_only=True).active
hdr = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
idx = {h: i for i, h in enumerate(hdr) if h}


def g(row, name):
    i = idx.get(name)
    return row[i] if (i is not None and i < len(row)) else None


allp = {}      # tous les produits (corrige prix_ht=0 partout, y compris remboursables)
nr = {}        # NR uniquement (on aligne aussi le prix_ip dessus)
for r in ws.iter_rows(min_row=2, values_only=True):
    cip = str(g(r, 'artcodebarre') or '').strip()
    p = g(r, 'ppht')
    afm = str(g(r, 'afmcode') or '')
    if not (cip.isdigit() and len(cip) >= 12):
        continue
    if not isinstance(p, (int, float)) or p <= 0:
        continue
    p = round(float(p), 2)
    allp[cip] = p
    if afm != 'REMBSS':
        nr[cip] = 1

# Tarif NR plus récent : extraction STOCK <jjmmaa>.xls, déjà lue par generate_etab_prices.py
# (tarif = atfprix, NR hors catalogue = nature sûre par AFMCODE des extractions par site).
# Le fichier STOCK ne dit pas si un produit est remboursable : seuls les NR connus sont
# mis à jour ; les remboursables gardent le tarif ci-dessus. Écart ×0,2–×5 refusé
# (INFRACYANINE 100,43 → 0,30). Relancer generate_etab_prices.py avant ce script.
allp = rekey(allp)
nr = rekey(nr)   # un produit = un code : PPHT et statut NR sous le code gardé

ETAB_JS = 'crm/v2/etab-prices-data.js'
if os.path.exists(ETAB_JS):
    t = open(ETAB_JS, encoding='utf-8').read()
    etab = json.loads(t[t.index('{'):t.rindex('}') + 1])
    hors_cat = etab.get('nrHorsCat') or {}
    maj = ajout = refus = 0
    for cip, p in (etab.get('tarif') or {}).items():
        if not (isinstance(p, (int, float)) and p > 0):
            continue
        p = round(float(p), 2)
        if cip in nr:
            if not (0.2 <= p / allp[cip] <= 5):
                refus += 1
                continue
            if p != allp[cip]:
                allp[cip] = p
                maj += 1
        elif cip in hors_cat and cip not in allp:
            allp[cip] = p
            nr[cip] = 1
            ajout += 1
    print('tarif NR du %s : %d prix mis à jour, %d NR ajoutés, %d écarts refusés'
          % (etab.get('tarifDate'), maj, ajout, refus))

# ── Tarifs corrigés après la date du fichier source ─────────────────────
# Le fichier « stock et prix » le plus récent date du 22/06/2026, et les GLP-1
# ont baissé depuis. Tant qu'un « stock et prix » plus récent n'est pas déposé
# dans STATS/, ces tarifs écrasent celui de juin.
# Mesuré deux fois : sur les stocks du 17/09 et du 21/09 (d'accord entre eux),
# et sur le prix facturé (PLVPUBRUT) de plus de 10 000 lignes de ventes de
# juillet-août 2026 — une seule valeur pour chaque référence.
# À SUPPRIMER le jour où un fichier « stock et prix » postérieur au 17/09/2026
# arrive : il portera ces tarifs lui-même.
TARIFS_MAJ = {
    '3400930258637': 136.50,   # WEGOVY 0,5MG FLEX 1,5 ML   (était 189,90)
    '3400930317815': 136.50,   # WEGOVY 0,5MG FLEX 3 ML     (était 189,90)
    '3400930258644': 136.50,   # WEGOVY 1MG FLEX            (était 189,90)
    '3400930260241': 157.37,   # WEGOVY 1,7MG FLEX          (était 201,66)
    '3400930258668': 181.48,   # WEGOVY 2,4MG FLEX          (était 246,57)
    '3400930292914': 221.32,   # MOUNJARO 5MG KWIKPEN       (était 225,18)
    '3400930292938': 313.27,   # MOUNJARO 7,5MG KWIKPEN     (était 315,00)
}
for _cip, _p in TARIFS_MAJ.items():
    if _cip in allp and allp[_cip] != _p:
        print('  tarif mis a jour: %s %.2f -> %.2f' % (_cip, allp[_cip], _p))
    allp[_cip] = _p

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// Prix PPHT (tarif grossiste HT) par CIP13 — TOUS produits + set NR — generate_ppht.py\n')
    f.write('window.PPHT = ' + json.dumps(allp, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('window.PPHT_NR = ' + json.dumps(nr, ensure_ascii=False, separators=(',', ':')) + ';\n')

print('OK -> %s : %d prix (dont %d NR)' % (OUT, len(allp), len(nr)))

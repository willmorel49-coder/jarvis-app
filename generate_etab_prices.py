# -*- coding: utf-8 -*-
"""Prix (PPHT) + stock disponible PAR ÉTABLISSEMENT (NR) pour le Marketing.
Lit JARVIS/PRIX ET STOCKS ETABLISSEMENTS/*_extrait.xlsx (7 établissements)
→ crm/v2/etab-prices-data.js (window.ETAB_PRICES).
Sert aux fiches marketing par établissement (bon prix + stock réel) et complète
les listes best-sellers. 100% local, Python 3.9.
"""
import openpyxl, glob, os, json, re

SRC = '/Users/williammorel/JARVIS/PRIX ET STOCKS ETABLISSEMENTS'
OUT = 'crm/v2/etab-prices-data.js'

# code établissement = préfixe du nom de fichier (CPR, HP, MSP, OPS, POS, SEP, SOP)
def etab_code(fn):
    base = os.path.basename(fn)
    m = re.match(r'([A-Za-z]{2,4})', base)
    return m.group(1).upper() if m else base[:3].upper()

def cip_of(v):
    if v is None:
        return ''
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        s = re.sub(r'[^0-9]', '', str(v))
        return s

def num(v):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return 0.0

prices = {}     # code -> { cip: [ppht, stock] }
labels = {}     # cip -> désignation (pour affichage éventuel)
etabs = []

for fn in sorted(glob.glob(os.path.join(SRC, '*.xlsx'))):
    code = etab_code(fn)
    wb = openpyxl.load_workbook(fn, read_only=True, data_only=True)
    ws = wb.active
    it = ws.iter_rows(values_only=True)
    hdr = [str(c) if c is not None else '' for c in next(it)]
    ix = {h: i for i, h in enumerate(hdr)}
    ci = ix.get('ARTCODEBARRE'); pi = ix.get('PPHT'); si = ix.get('STOCKDISPO')
    di = ix.get('ARTDESIGNATION')
    d = prices.setdefault(code, {})
    n = 0
    for r in it:
        cip = cip_of(r[ci]) if ci is not None else ''
        if not cip or len(cip) < 8:
            continue
        ppht = num(r[pi]) if pi is not None else 0.0
        stock = 0
        if si is not None:
            try: stock = int(float(r[si] or 0))
            except (TypeError, ValueError): stock = 0
        # on garde même si ppht=0 (stock utile) mais on ignore les lignes vides
        if ppht <= 0 and stock == 0:
            continue
        d[cip] = [ppht, stock]
        if di is not None and cip not in labels and r[di]:
            labels[cip] = str(r[di]).strip()
        n += 1
    wb.close()
    etabs.append({'code': code, 'n': n})
    print('  %s : %d produits' % (code, n))

# combiné "TOUS" : meilleur PPHT (>0) + stock total sur tous les établissements
allc = {}
for code, d in prices.items():
    for cip, (p, s) in d.items():
        e = allc.setdefault(cip, [0.0, 0])
        if p > 0 and (e[0] == 0 or p < e[0]):
            e[0] = p
        e[1] += s

data = {'etabs': sorted(etabs, key=lambda x: x['code']), 'prices': prices, 'all': allc}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('// Prix PPHT + stock par établissement (NR) — generate_etab_prices.py\n')
    fh.write('window.ETAB_PRICES = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')

print('OK ->', OUT)
print('  établissements :', ', '.join('%s(%d)' % (e['code'], e['n']) for e in data['etabs']))
print('  CIP combinés   :', len(allc))
print('  taille fichier : %.0f Ko' % (os.path.getsize(OUT) / 1024))

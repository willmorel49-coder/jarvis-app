# -*- coding: utf-8 -*-
"""Nature (AFMCODE) des produits d'après TOUS les fichiers de ventes et de stock de
JARVIS/APP/STATS → PRIX ET STOCKS ETABLISSEMENTS/nature-afm.json {cip: [afmcode, marque]}.
Lu par generate_etab_prices.py pour les codes que les extractions par site ne qualifient pas
(le fichier STOCK *.xls n'a pas de colonne AFMCODE : 121 codes sans nature le 17/09/2026).
Un code n'est retenu que si tous les fichiers s'accordent (REMBSS d'un côté, autre chose de
l'autre = on ne tranche pas). À relancer quand de nouveaux fichiers arrivent. /usr/bin/python3.
"""
import openpyxl, glob, os, json, warnings
from collections import defaultdict

warnings.filterwarnings('ignore')
STATS = '/Users/williammorel/JARVIS/APP/STATS'
OUT = '/Users/williammorel/JARVIS/PRIX ET STOCKS ETABLISSEMENTS/nature-afm.json'

# Absents de tous les fichiers, mais toute leur gamme y est classée de la même façon (17/09/2026).
FAMILLE = {
    '3400905780057': 'DM',      # ONETOUCH DELICA+ LANCETTE 200 (gamme : DM ×16)
    '3400970721849': 'DM_20',   # BABYHALER (gamme : DM_20 ×8)
    '3400920252287': 'PARA',    # PHYSIODOSE (gamme : PARA ×5)
    '3400910000683': 'DM',      # BEROCCA (gamme : jamais REMBSS)
    '3400910000690': 'DM',      # BEROCCA
    '3400997809568': 'PARA',    # OLIGOBS (gamme : jamais REMBSS)
    '3400974989542': 'REMBSS',  # THYBON 20 µg (gamme : REMBSS ×19)
}

def cip_of(v):
    s = str(v or '').strip()
    return s[:-2] if s.endswith('.0') else s

def cip13_of(c7):
    base = '34009' + c7
    tot = sum(int(d) * (3 if i % 2 else 1) for i, d in enumerate(base))
    return base + str((10 - tot % 10) % 10)

vus = defaultdict(set)
marque = {}
n = 0
for fn in sorted(glob.glob(os.path.join(STATS, '**', '*.xlsx'), recursive=True)):
    try:
        wb = openpyxl.load_workbook(fn, read_only=True, data_only=True)
        it = wb.active.iter_rows(values_only=True)
        h = [str(x or '').strip().upper() for x in next(it)]
    except Exception:
        continue
    if 'AFMCODE' not in h or ('ARTCODEBARRE' not in h and 'ARTCODE' not in h):
        wb.close()
        continue
    n += 1
    ia = h.index('AFMCODE')
    ib = h.index('ARTCODEBARRE') if 'ARTCODEBARRE' in h else None
    ic = h.index('ARTCODE') if 'ARTCODE' in h else None
    im = h.index('ARTMARQUE') if 'ARTMARQUE' in h else None
    for r in it:
        afm = str(r[ia] or '').strip()
        if not afm:
            continue
        # le code-barres est parfois un EAN fabricant : le CIP est alors dans ARTCODE
        codes = set()
        for i in (ib, ic):
            raw = cip_of(r[i]) if i is not None else ''
            if raw.isdigit() and len(raw) == 7:
                codes.add(cip13_of(raw))
            elif raw.isdigit() and len(raw) >= 8:
                codes.add(raw)
        m = str(r[im] or '').strip() if im is not None else ''
        for code in codes:
            vus[code].add(afm)
            if m and m != '#N/A':
                marque.setdefault(code, m)
    wb.close()

out = {}
for code, s in vus.items():
    if len(s) == 1 or 'REMBSS' not in s:
        out[code] = [sorted(s)[0], marque.get(code, '')]
for code, afm in FAMILLE.items():
    out.setdefault(code, [afm, marque.get(code, '')])

with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
print('OK -> %s : %d codes (%d fichiers lus, %d écartés car contradictoires)'
      % (OUT, len(out), n, len(vus) + len(FAMILLE) - len(out)))

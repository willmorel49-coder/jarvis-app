#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stats reseau PAR PRODUIT (CIP13) -> crm/v2/prod-stats-data.js (window.PROD_STATS)
Pour chaque produit reellement vendu par le reseau (>=3 pharmacies) :
  - rota   : rotation moyenne (boites) par pharmacie / an  (qte / nbMois * 12 / nbPharma)
  - marge  : marge pharmacien MDL / pharmacie / an (REMBOURSABLES uniquement)
  - remise : remise Integral (PPHT - prix net achat) / pharmacie / an
  - ca     : CA d'achat HT / pharmacie / an
Source prix + libelle + statut remb : STATS/stock et prix 22 06 2026.xlsx
Source ventes : crm/v2/wml-officines-data.js (WML_SALES compact)
"""
import openpyxl, re, json, os
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
XLSX = os.path.join(ROOT, 'STATS', 'stock et prix 22 06 2026.xlsx')
WML  = os.path.join(ROOT, 'crm', 'v2', 'wml-officines-data.js')
OUT  = os.path.join(ROOT, 'crm', 'v2', 'prod-stats-data.js')

BENCH = os.path.join(ROOT, 'crm', 'benchmark-data.js')

# Produits "froid" (chaine du froid) : extraits du benchmark par CIP (la seule source dispo)
froid = set()
try:
    bt = open(BENCH, encoding='utf-8').read()
    for m in re.finditer(r'\{[^{}]*\}', bt):
        o = m.group(0)
        cm = re.search(r'cip13:"(\d{12,14})"', o)
        if cm and re.search(r'is_froid:true', o):
            froid.add(cm.group(1))
except Exception:
    pass

ws = openpyxl.load_workbook(XLSX, read_only=True, data_only=True).active
hh = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
ci = hh.index('artcodebarre'); di = hh.index('artdesignation')
pi = hh.index('ppht');         ai = hh.index('afmcode')
ni = hh.index('artnature') if 'artnature' in hh else None
info = {}
for r in ws.iter_rows(min_row=2, values_only=True):
    c = str(r[ci] or '')
    if c.isdigit() and len(c) >= 12:
        info[c] = {
            'd': (str(r[di]).strip() if r[di] else ''),
            'ppht': (float(r[pi]) if isinstance(r[pi], (int, float)) else 0.0),
            'remb': str(r[ai] or '') == 'REMBSS',
            'nat': (str(r[ni]).strip() if (ni is not None and r[ni]) else ''),
        }

def famille(cip, ppht, net, remb, nat):
    """Catégories voulues (Will) : NR · Génériques+biosimilaires · Princeps par tranche de prix.
    Nature depuis artnature du fichier prix (Referent=princeps ; Generique/Generique
    Partenaire/Biosimilaire = genbio)."""
    if not remb:
        return 'nr'
    nl = (nat or '').lower()
    if 'biosimilaire' in nl: return 'biosim'
    if 'generique' in nl or 'générique' in nl: return 'gen'
    p = ppht if ppht > 0 else net           # princeps / référent → tranche de prix
    if p <= 4.33: return 'pr_low'
    if p <= 468:  return 'pr_mid'
    return 'pr_high'

def mdl(p):
    if p <= 0: return 0
    if p <= 4.33: return 0.18
    if p <= 468: return p * 0.039
    return 19.50

t = open(WML, encoding='utf-8').read()
sales = json.loads(re.search(r'WML_SALES\s*=\s*(\[.*?\]);', t, re.S).group(1))
NM = len(set(s[1] for s in sales if len(s) > 1 and s[1])) or 5   # nb de mois distincts

ag = defaultdict(lambda: {'qte': 0.0, 'ph': set(), 'ca': 0.0, 'tarif': 0.0, 'marge': 0.0})
for s in sales:                       # [pharmacyId, mois, comm, cip13, qte, puNet, mntNetHt]
    c = str(s[3]); nfo = info.get(c)
    if not nfo: continue
    qte = s[4] or 0; ca = s[6] or 0; a = ag[c]
    a['qte'] += qte; a['ph'].add(str(s[0])); a['ca'] += ca
    if nfo['ppht'] > 0:
        a['tarif'] += nfo['ppht'] * qte
        if nfo['remb']: a['marge'] += mdl(nfo['ppht']) * qte

rows = []
for c, a in ag.items():
    nph = len(a['ph'])
    if nph < 3: continue
    k = 12.0 / NM / nph               # -> par pharmacie / an
    net = (a['ca'] / a['qte']) if a['qte'] else 0   # prix net achat moyen / boite
    ppht = round(info[c]['ppht'], 2)
    net_u = round(net, 2)                          # prix net remisé réel (CA/qté)
    rem_pct = round((ppht - net_u) / ppht * 100, 1) if (ppht > 0 and net_u > 0 and net_u <= ppht) else 0
    rows.append({
        'c': c, 'd': info[c]['d'][:46], 'n': nph,
        'f': famille(c, info[c]['ppht'], net, info[c]['remb'], info[c]['nat']),
        'ppht': ppht,                              # PPHT tarif grossiste
        'net': net_u,                              # prix net remisé (réel achat)
        'rpct': rem_pct,                           # % de remise (PPHT → net)
        'rota': round(a['qte'] * k),
        'marge': round(a['marge'] * k),
        'remise': round(max(0, a['tarif'] - a['ca']) * k),
        'ca': round(a['ca'] * k),
    })
rows.sort(key=lambda r: -r['rota'])

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// Stats reseau PAR PRODUIT (CIP) — rotation/marge/remise/CA par pharmacie/an — generate_prod_stats.py\n')
    f.write('window.PROD_STATS = ' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('OK %d produits (CIP, nph>=3) sur %d mois -> %s' % (len(rows), NM, OUT))

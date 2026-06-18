# -*- coding: utf-8 -*-
"""Top des ventes IP ("plus grosses sorties chez nous") par catégorie,
pour la page prospect publique. Lit crm/benchmark-data.js → crm/v2/bestsellers-data.js.
Python 3.9.
"""
import re, json, os

SRC = 'crm/benchmark-data.js'
OUT = 'crm/v2/bestsellers-data.js'

txt = open(SRC, encoding='utf-8', errors='ignore').read()
objs = re.findall(r'\{[^{}]*?\}', txt)


def num(o, k):
    m = re.search(k + r':(-?[\d.]+)', o)
    return float(m.group(1)) if m else 0.0


def sval(o, k):
    m = re.search(k + r':"([^"]*)"', o)
    return m.group(1) if m else ''


# familles non chevauchantes (priorité froid > biosim > générique > princeps)
FAMS = [
    ('froid', 'Chaîne du froid'),
    ('biosim', 'Biosimilaires'),
    ('generiques', 'Génériques'),
    ('princeps', 'Princeps & spécialités'),
]
buckets = {k: [] for k, _ in FAMS}

for o in objs:
    if 'designation:' not in o:
        continue
    nat = sval(o, 'artnature')
    if 'is_froid:true' in o:
        fam = 'froid'
    elif nat == 'biosimilaire':
        fam = 'biosim'
    elif nat in ('generique', 'generique_partenaire'):
        fam = 'generiques'
    else:
        fam = 'princeps'
    qty = num(o, 'ip_qty')
    if qty <= 0:
        continue
    ip = num(o, 'prix_ip'); off = num(o, 'offre_ip')
    # offre valide seulement si remise <= 50% (au-delà = offre_ip aberrante)
    best = off if (off > 0 and ip > 0 and off < ip and off >= ip * 0.5) else ip
    buckets[fam].append({
        'd': sval(o, 'designation'),
        'c': sval(o, 'cip13'),
        'q': int(qty),
        'p': round(best, 2) if best > 0 else None,
        'o': bool(off > 0 and ip > 0 and off < ip and off >= ip * 0.5),
    })

cats = []
for key, label in FAMS:
    rows = sorted(buckets[key], key=lambda r: r['q'], reverse=True)[:12]
    if rows:
        cats.append({'key': key, 'label': label, 'rows': rows})

data = {'generated': '', 'cats': cats}
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// Top ventes IP par catégorie (page prospect) — généré par generate_bestsellers.py\n')
    f.write('window.BESTSELLERS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')

print('OK ->', OUT)
for c in cats:
    print('  {:24s} {} produits (top sortie: {})'.format(c['label'], len(c['rows']), c['rows'][0]['d'][:30]))

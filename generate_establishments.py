#!/usr/bin/env python3
"""
Produit crm/establishments-aggregate.js depuis STATS/{OPS,CPR,HP}_Pharmas_agregation.xlsx.
Donnees : agregat des ventes sur 3 etablissements IP (OPS Nantes / CPR / HP) par produit.

Permet de comparer le secteur Will vs 3 benchmarks sectoriels differents.

Sortie : un seul fichier JS qui expose
  window.OPS_AGGREGATE / OPS_BY_LABO / OPS_TOTAL  (backward compat)
  window.CPR_AGGREGATE / CPR_BY_LABO / CPR_TOTAL
  window.HP_AGGREGATE  / HP_BY_LABO  / HP_TOTAL
  window.ESTABLISHMENTS = { ops: {...}, cpr: {...}, hp: {...} } (consolide)
"""

import json
import openpyxl
from pathlib import Path

ESTABLISHMENTS = [
    {'key': 'OPS', 'name': 'OPS Nantes',           'src': 'STATS/OPS_NETTOYE_agregation.xlsx'},
    {'key': 'CPR', 'name': 'CPR',                  'src': 'STATS/CPR_Pharmas_agregation.xlsx'},
    {'key': 'HP',  'name': 'HP',                   'src': 'STATS/HP_Pharmas_agregation.xlsx'},
]
OUT = Path('crm/establishments-aggregate.js')


def clean(v):
    if v is None: return ''
    s = str(v).strip()
    if s.endswith('.0'): s = s[:-2]
    return s


def parse_establishment(src):
    """Lit un fichier xlsx d'agregation IP et renvoie (products_dict, by_labo, totals)."""
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb['Agrégation']
    rows = ws.iter_rows(values_only=True)
    header = [clean(c).upper() for c in next(rows)]
    col = {h: i for i, h in enumerate(header)}
    def g(row, name):
        i = col.get(name)
        return row[i] if i is not None and i < len(row) else None
    products = {}
    total_ca = 0.0
    total_qte = 0
    for row in rows:
        artcode = clean(g(row, 'ARTCODE'))
        if not artcode: continue
        ca = float(g(row, 'CA_NET_HT') or 0)
        qte = int(g(row, 'QTE_TOTALE') or 0)
        total_ca += ca
        total_qte += qte
        products[artcode] = {
            'ean': clean(g(row, 'ARTCODEBARRE')),
            'designation': clean(g(row, 'PLVDESIGNATION')),
            'marque': clean(g(row, 'ARTMARQUE')),
            'nature': clean(g(row, 'ARTNATURE')),
            'sousfamille': clean(g(row, 'ARTSOUSFAMILLE')),
            'collection': clean(g(row, 'ARTCOLLECTION')),
            'afmcode': clean(g(row, 'AFMCODE')),
            'ca': round(ca, 2),
            'qte': qte,
        }
    sorted_items = sorted(products.items(), key=lambda x: -x[1]['ca'])
    products_all = dict(sorted_items)

    # Agrege par labo (collection)
    by_labo = {}
    for code, p in products_all.items():
        labo = (p.get('collection') or '').strip()
        if not labo or labo == '#N/A': continue
        if labo not in by_labo:
            by_labo[labo] = {'ca': 0.0, 'qte': 0, 'nb_refs': 0}
        by_labo[labo]['ca'] += p['ca']
        by_labo[labo]['qte'] += p['qte']
        by_labo[labo]['nb_refs'] += 1
    by_labo = {k: {'ca': round(v['ca'], 2), 'qte': v['qte'], 'nb_refs': v['nb_refs']}
               for k, v in sorted(by_labo.items(), key=lambda x: -x[1]['ca'])}

    totals = {
        'ca': round(total_ca, 2),
        'qte': total_qte,
        'nb_produits': len(products),
        'nb_labos': len(by_labo),
    }
    return products_all, by_labo, totals, sorted_items[:5]


def main():
    chunks = ['// Etablissements IP · agregats benchmark sectoriels',
              '// Sources : STATS/{OPS,CPR,HP}_Pharmas_agregation.xlsx',
              '// Genere par generate_establishments.py', '']

    consolidated = {}
    for est in ESTABLISHMENTS:
        key = est['key']
        print(f'[{key.lower()}] Lecture {est["src"]}')
        products, by_labo, totals, top5 = parse_establishment(est['src'])

        # Header commentaire
        chunks.append(f'// {est["name"]} : {totals["nb_produits"]} produits · CA {totals["ca"]:,.0f} EUR · {totals["nb_labos"]} labos')

        # 3 globals par etablissement (backward compat OPS_*, CPR_*, HP_*)
        chunks.append(f'window.{key}_TOTAL = {json.dumps(totals, ensure_ascii=False, indent=2)};')
        chunks.append(f'window.{key}_BY_LABO = {json.dumps(by_labo, ensure_ascii=False, indent=2)};')
        chunks.append(f'window.{key}_AGGREGATE = {json.dumps(products, ensure_ascii=False, indent=2)};')
        chunks.append('')

        consolidated[key.lower()] = {
            'key': key.lower(),
            'name': est['name'],
            'total': totals,
        }

        # Logs console
        print(f'[{key.lower()}] {totals["nb_produits"]} produits · CA {totals["ca"]:,.0f} EUR · {totals["nb_labos"]} labos')
        print(f'[{key.lower()}] Top 5 :')
        for art, p in top5:
            print(f'  {p["designation"]:40s} CA {p["ca"]:>10,.0f} EUR ({p["qte"]} u)')

    # Index consolide (legers — pour selecteurs UI)
    chunks.append(f'window.ESTABLISHMENTS = {json.dumps(consolidated, ensure_ascii=False, indent=2)};')
    chunks.append('')

    out_text = '\n'.join(chunks)
    OUT.write_text(out_text, encoding='utf-8')
    sz = OUT.stat().st_size // 1024
    print(f'[etablissements] Ecrit {OUT} ({sz} KB)')


if __name__ == '__main__':
    main()

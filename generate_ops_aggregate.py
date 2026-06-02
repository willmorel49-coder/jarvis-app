#!/usr/bin/env python3
"""
Produit crm/ops-aggregate.js depuis STATS/OPS_Pharmas_agregation.xlsx.
Données : agrégat des ventes sur l'établissement OPS Nantes par produit (5114 lignes).
Colonnes : ARTCODEBARRE, ARTCODE, PLVDESIGNATION, ARTMARQUE, ARTNATURE, ARTSOUSFAMILLE, ARTCOLLECTION, AFMCODE, CA_NET_HT, QTE_TOTALE.

Permet de comparer les ventes Will vs benchmark sectoriel OPS.
"""

import json
import openpyxl
from pathlib import Path

SRC = 'STATS/OPS_Pharmas_agregation.xlsx'
OUT = Path('crm/ops-aggregate.js')


def clean(v):
    if v is None: return ''
    s = str(v).strip()
    if s.endswith('.0'): s = s[:-2]
    return s


def main():
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb['Agrégation']
    products = {}
    total_ca = 0.0
    total_qte = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        artcode = clean(row[1])
        if not artcode: continue
        ca = float(row[8] or 0)
        qte = int(row[9] or 0)
        total_ca += ca
        total_qte += qte
        products[artcode] = {
            'ean': clean(row[0]),
            'designation': clean(row[2]),
            'marque': clean(row[3]),
            'nature': clean(row[4]),
            'sousfamille': clean(row[5]),
            'collection': clean(row[6]),
            'afmcode': clean(row[7]),
            'ca': round(ca, 2),
            'qte': qte,
        }

    # Trie par CA decroissant — garde le top 1500 pour ne pas grossir trop le JS
    sorted_items = sorted(products.items(), key=lambda x: -x[1]['ca'])[:1500]
    products_top = dict(sorted_items)

    out = (
        '// OPS Pharmas agregation · benchmark Etablissement OPS Nantes\n'
        '// Source : STATS/OPS_Pharmas_agregation.xlsx\n'
        f'// {len(products)} produits agreges (top {len(products_top)} exposes) · CA total {total_ca:,.0f} EUR · QTE {total_qte:,}\n\n'
        f'window.OPS_TOTAL = {json.dumps({"ca": round(total_ca,2), "qte": total_qte, "nb_produits": len(products)}, ensure_ascii=False, indent=2)};\n\n'
        f'window.OPS_AGGREGATE = {json.dumps(products_top, ensure_ascii=False, indent=2)};\n'
    )
    OUT.write_text(out, encoding='utf-8')
    sz = OUT.stat().st_size // 1024
    print(f'[ops] Ecrit {OUT} ({sz} KB)')
    print(f'[ops] {len(products)} produits | CA total OPS Nantes : {total_ca:,.0f} EUR')
    print(f'[ops] Top 5 OPS Nantes :')
    for art, p in sorted_items[:5]:
        print(f'  {p["designation"]:40s} CA {p["ca"]:>10,.0f} EUR ({p["qte"]} u)')


if __name__ == '__main__':
    main()

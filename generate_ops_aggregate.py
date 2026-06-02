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

    # Garde TOUT (5113 references) pour la precision d'analyse — taille acceptable
    sorted_items = sorted(products.items(), key=lambda x: -x[1]['ca'])
    products_all = dict(sorted_items)

    # Agrege OPS par labo (collection) pour comparaisons croisees
    ops_by_labo = {}
    for code, p in products_all.items():
        labo = (p.get('collection') or '').strip()
        if not labo or labo == '#N/A': continue
        if labo not in ops_by_labo:
            ops_by_labo[labo] = {'ca': 0.0, 'qte': 0, 'nb_refs': 0}
        ops_by_labo[labo]['ca'] += p['ca']
        ops_by_labo[labo]['qte'] += p['qte']
        ops_by_labo[labo]['nb_refs'] += 1
    ops_by_labo = {k: {'ca': round(v['ca'], 2), 'qte': v['qte'], 'nb_refs': v['nb_refs']}
                   for k, v in sorted(ops_by_labo.items(), key=lambda x: -x[1]['ca'])}
    print(f'[ops] {len(ops_by_labo)} labos detectes a OPS Nantes')

    out = (
        '// OPS Pharmas agregation · benchmark Etablissement OPS Nantes\n'
        '// Source : STATS/OPS_Pharmas_agregation.xlsx\n'
        f'// {len(products)} produits agreges (TOUS exposes) · CA total {total_ca:,.0f} EUR · QTE {total_qte:,}\n\n'
        f'window.OPS_TOTAL = {json.dumps({"ca": round(total_ca,2), "qte": total_qte, "nb_produits": len(products), "nb_labos": len(ops_by_labo)}, ensure_ascii=False, indent=2)};\n\n'
        f'window.OPS_BY_LABO = {json.dumps(ops_by_labo, ensure_ascii=False, indent=2)};\n\n'
        f'window.OPS_AGGREGATE = {json.dumps(products_all, ensure_ascii=False, indent=2)};\n'
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

#!/usr/bin/env python3
"""
Extrait le catalogue Intégral Pharma depuis STATS/TOP IP DÉCROISSANT (version 1).xlsb.
Sortie : crm/catalogue-ip.js
"""

import json
import pyxlsb
from pathlib import Path

SRC = 'STATS/TOP IP DÉCROISSANT (version 1).xlsb'
OUT = 'crm/catalogue-ip.js'


def clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        s = v.replace('\x00', '').strip()
        return s if s else None
    return v


def to_float(v):
    if v is None:
        return None
    try:
        f = float(v)
        return f if not (f != f) else None  # filtre NaN
    except (ValueError, TypeError):
        return None


def to_str(v):
    c = clean(v)
    if c is None:
        return ''
    if isinstance(c, float) and c.is_integer():
        return str(int(c))
    return str(c)


def parse_sheet(wb, sheet_name):
    """Parse une feuille du fichier .xlsb et retourne la liste de produits."""
    products = []
    with wb.get_sheet(sheet_name) as ws:
        rows = list(ws.rows())
        if not rows:
            return products
        # Headers : première ligne non vide
        header_row = None
        header_idx = -1
        for i, row in enumerate(rows[:5]):
            cells = [clean(c.v) for c in row]
            if cells and any(isinstance(c, str) and ('CIP' in c.upper() or 'DESIGNATION' in c.upper() or 'Désignation' in c) for c in cells if c):
                header_row = cells
                header_idx = i
                break
        if header_row is None:
            return products

        # Map header → index column
        col = {}
        for idx, h in enumerate(header_row):
            if not h:
                continue
            h_norm = str(h).lower().replace(' ', '').replace('é', 'e').replace('è', 'e').replace('(€)', '').replace('%', 'pct')
            if 'cip' in h_norm:
                col['ean'] = idx
            elif 'designation' in h_norm or 'désignation' in h_norm.lower():
                col['nom'] = idx
            elif 'laboratoire' in h_norm or 'marque' in h_norm:
                col['marque'] = idx
            elif 'cat' in h_norm and 'prix' in h_norm:
                col['categorie'] = idx
            elif 'molecule' in h_norm:
                col['molecule'] = idx
            elif 'prixht' in h_norm:
                col['prix_ht'] = idx
            elif 'prixip' in h_norm or 'prix ip' in h_norm:
                col['prix_ip'] = idx
            elif 'remisepct' in h_norm or 'remise%' in h_norm or h_norm == 'remise':
                if 'remise_pct' not in col:
                    col['remise_pct'] = idx
            elif 'remise' in h_norm and 'pct' not in h_norm:
                col['remise_euro'] = idx
            elif 'offre' in h_norm:
                col['offre_ip'] = idx
            elif 'froid' in h_norm or '❄' in str(header_row[idx]):
                col['froid'] = idx

        for row in rows[header_idx + 1:]:
            cells = [c.v for c in row]
            ean = to_str(cells[col.get('ean', -1)] if col.get('ean', -1) >= 0 and col.get('ean', -1) < len(cells) else None)
            if not ean or not ean.isdigit() or len(ean) < 8:
                continue
            p = {
                'ean': ean,
                'nom': to_str(cells[col['nom']]) if col.get('nom') is not None and col['nom'] < len(cells) else '',
                'marque': to_str(cells[col['marque']]) if col.get('marque') is not None and col['marque'] < len(cells) else '',
                'categorie': to_str(cells[col['categorie']]) if col.get('categorie') is not None and col['categorie'] < len(cells) else sheet_name.replace('TOP ', '').title(),
                'molecule': to_str(cells[col['molecule']]) if col.get('molecule') is not None and col['molecule'] < len(cells) else '',
                'prix_ht': to_float(cells[col['prix_ht']]) if col.get('prix_ht') is not None and col['prix_ht'] < len(cells) else None,
                'prix_ip': to_float(cells[col['prix_ip']]) if col.get('prix_ip') is not None and col['prix_ip'] < len(cells) else None,
                'remise_pct': to_float(cells[col['remise_pct']]) if col.get('remise_pct') is not None and col['remise_pct'] < len(cells) else None,
                'remise_euro': to_float(cells[col['remise_euro']]) if col.get('remise_euro') is not None and col['remise_euro'] < len(cells) else None,
                'offre_ip': to_float(cells[col['offre_ip']]) if col.get('offre_ip') is not None and col['offre_ip'] < len(cells) else None,
                'froid': col.get('froid') is not None and bool(clean(cells[col['froid']] if col['froid'] < len(cells) else None)),
            }
            products.append(p)
    return products


def main():
    print(f'[catalogue] Ouverture {SRC}')
    with pyxlsb.open_workbook(SRC) as wb:
        sheets = list(wb.sheets)
        print(f'[catalogue] Feuilles : {sheets}')
        all_products = []
        for sn in sheets:
            count_before = len(all_products)
            products = parse_sheet(wb, sn)
            all_products.extend(products)
            print(f'[catalogue]   {sn} → {len(products)} produits')

    # Dedup par EAN (garde le 1er si même EAN)
    seen = set()
    unique = []
    for p in all_products:
        if p['ean'] in seen:
            continue
        seen.add(p['ean'])
        unique.append(p)
    print(f'[catalogue] Total après dedup : {len(unique)} (vs {len(all_products)} avant)')

    # Écrit le fichier JS
    js = (
        '// Catalogue Intégral Pharma — vrais prix IP avec remises\n'
        f'// Source : {SRC}\n'
        f'// Généré par generate_catalogue_ip.py · {len(unique)} produits uniques\n\n'
        'window.CATALOGUE_IP = '
        + json.dumps(unique, ensure_ascii=False, indent=2)
        + ';\n'
    )
    Path(OUT).write_text(js, encoding='utf-8')
    sz = Path(OUT).stat().st_size
    print(f'[catalogue] Écrit {OUT} ({sz // 1024} KB)')
    print('[catalogue] Exemples :')
    for p in unique[:3]:
        print(f'  {p["ean"]} · {p["nom"]:35s} · cat={p["categorie"]:12s} · HT={p["prix_ht"]} IP={p["prix_ip"]} R={p["remise_pct"]}%')


if __name__ == '__main__':
    main()

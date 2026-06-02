#!/usr/bin/env python3
"""
Génère crm/sales-detail.js depuis STATS/Statistiques de vente par client  Etat détaillé.xls
(11973 lignes : facture par facture avec dates, marges réelles, sous-familles).

Agrégats produits :
- SALES_BY_MONTH : { "2026-01": {ca, marge, qte, lignes} }
- SALES_BY_CLIENT_MONTH : { cip: { "2026-01": {ca, marge, qte} } }
- SALES_BY_PRODUCT : { artcode: { designation, sousfamille, ca, marge, qte, nb_clients } }
- SALES_BY_CLIENT_DETAIL : { cip: [top 30 dernières lignes facture] }
- SALES_BY_SOUSFAMILLE : { sousfamille: {ca, marge, qte} }
- SALES_BY_FAMILLE : { famille: {ca, qte, lignes} }  — Froid, Biosimilaires, Génériques,
                     Gén. partenaires, Non remboursés, Princeps (join stock.js pour nature)
- SALES_TOTAL : { ca, marge, marge_pct, lignes, factures, premiere_date, derniere_date }
"""

import json
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path
import xlrd

SRC = 'STATS/Statistiques de vente par client  Etat détaillé.xls'
OUT = Path('crm/sales-detail.js')


def clean(v):
    if v is None: return ''
    if isinstance(v, str): return v.replace('\x00', '').strip()
    if isinstance(v, float) and v.is_integer(): return str(int(v))
    return str(v).strip()


def excel_date(n):
    """Convertit un num série Excel en date ISO YYYY-MM-DD."""
    try:
        # Excel epoch = 1899-12-30 (avec le bug 1900-02-29)
        base = datetime(1899, 12, 30)
        d = base + timedelta(days=float(n))
        return d.strftime('%Y-%m-%d')
    except (ValueError, TypeError):
        return None


def to_float(v):
    try:
        return float(v)
    except (ValueError, TypeError):
        return 0.0


def famille_from_attrs(nature, afmcode, sousfamille):
    """6 familles IP officielles. Mémo : Biosimilaire > Froid > Non remb. > Gen.Part > Gen > Princeps."""
    n = (nature or '').strip()
    a = (afmcode or '').strip().upper()
    sf = (sousfamille or '').lower()
    if n == 'Biosimilaire': return 'Biosimilaires'
    if 'froid' in sf: return 'Froid'
    if a and a != 'REMBSS' and a != '#N/A': return 'Non remboursés'
    if n == 'Generique Partenaire': return 'Gén. partenaires'
    if n == 'Generique': return 'Génériques'
    return 'Princeps'


def load_stock_index():
    """Lit crm/stock.js et retourne {artcode: {nature, marque, sousfamille}}."""
    import re
    stock_path = Path('crm/stock.js')
    if not stock_path.exists():
        print('[sales] stock.js absent — famille join ignoré (tout en Princeps)')
        return {}
    txt = stock_path.read_text(encoding='utf-8')
    idx = {}
    # Lignes: "ARTCODE": { nom: "...", ean: "...", marque: "REMBSS", ..., sousfamille: "...", nature: "..." }
    pat = re.compile(r'"(\d+)":\s*\{[^}]*marque:\s*"([^"]*)"[^}]*sousfamille:\s*"([^"]*)"[^}]*nature:\s*"([^"]*)"')
    for m in pat.finditer(txt):
        idx[m.group(1)] = {'marque': m.group(2), 'sousfamille': m.group(3), 'nature': m.group(4)}
    print(f'[sales] Stock index chargé : {len(idx)} références')
    return idx


def main():
    print(f'[sales] Lecture {SRC}')
    wb = xlrd.open_workbook(SRC)
    ws = wb.sheet_by_index(0)
    print(f'[sales] {ws.nrows} lignes × {ws.ncols} colonnes')

    # Colonnes : ARTCODE, ARTDESIGNATION, AFMCODE, ARTSOUSFAMILLE, PLVDATE, CLICODE, CLISOCIETE, QTE, CA, MARGEVALEUR, MARGEPOURCENT, PCVNUM, PCVID
    by_month = defaultdict(lambda: {'ca': 0.0, 'marge': 0.0, 'qte': 0.0, 'lignes': 0})
    by_client_month = defaultdict(lambda: defaultdict(lambda: {'ca': 0.0, 'marge': 0.0, 'qte': 0.0}))
    by_product_data = defaultdict(lambda: {'ca': 0.0, 'marge': 0.0, 'qte': 0.0, 'clients': set(), 'designation': '', 'sousfamille': ''})
    by_sousfamille = defaultdict(lambda: {'ca': 0.0, 'marge': 0.0, 'qte': 0.0, 'lignes': 0})
    by_famille = defaultdict(lambda: {'ca': 0.0, 'qte': 0.0, 'lignes': 0, 'nb_artcodes': set()})
    by_tranche = defaultdict(lambda: {'ca': 0.0, 'qte': 0.0, 'lignes': 0})
    by_tranche_famille = defaultdict(lambda: defaultdict(lambda: {'ca': 0.0, 'qte': 0.0}))
    stock_idx = load_stock_index()

    def tranche_from_prix(prix):
        if prix <= 4.33: return 'petit'
        if prix <= 468: return 'inter'
        return 'haut'
    by_client_detail = defaultdict(list)
    factures_set = set()
    total_ca = 0.0
    total_marge = 0.0
    min_date = None
    max_date = None
    lignes_count = 0

    for r in range(1, ws.nrows):
        artcode = clean(ws.cell_value(r, 0))
        designation = clean(ws.cell_value(r, 1))
        sousfamille = clean(ws.cell_value(r, 3)) or 'Autre'
        if sousfamille == '#N/A': sousfamille = 'Autre'
        plvdate = ws.cell_value(r, 4)
        date_iso = excel_date(plvdate)
        if not date_iso: continue
        cip = clean(ws.cell_value(r, 5))
        nom_pharma = clean(ws.cell_value(r, 6))
        qte = to_float(ws.cell_value(r, 7))
        ca = to_float(ws.cell_value(r, 8))
        marge = to_float(ws.cell_value(r, 9))
        pcvnum = clean(ws.cell_value(r, 11))

        if not artcode or not cip.isdigit(): continue
        lignes_count += 1
        month = date_iso[:7]  # YYYY-MM
        total_ca += ca
        total_marge += marge
        factures_set.add(pcvnum)
        if min_date is None or date_iso < min_date: min_date = date_iso
        if max_date is None or date_iso > max_date: max_date = date_iso

        # Agrégats mensuels global
        by_month[month]['ca'] += ca
        by_month[month]['marge'] += marge
        by_month[month]['qte'] += qte
        by_month[month]['lignes'] += 1

        # Agrégats client × mois
        by_client_month[cip][month]['ca'] += ca
        by_client_month[cip][month]['marge'] += marge
        by_client_month[cip][month]['qte'] += qte

        # Agrégats produit
        p = by_product_data[artcode]
        p['ca'] += ca
        p['marge'] += marge
        p['qte'] += qte
        p['clients'].add(cip)
        if not p['designation']: p['designation'] = designation
        if not p['sousfamille'] or p['sousfamille'] == 'Autre': p['sousfamille'] = sousfamille

        # Sous-familles
        by_sousfamille[sousfamille]['ca'] += ca
        by_sousfamille[sousfamille]['marge'] += marge
        by_sousfamille[sousfamille]['qte'] += qte
        by_sousfamille[sousfamille]['lignes'] += 1

        # Famille IP (join stock pour ARTNATURE)
        afmcode_xls = clean(ws.cell_value(r, 2))  # col 2 = AFMCODE
        stock = stock_idx.get(artcode, {})
        fam = famille_from_attrs(stock.get('nature', ''), afmcode_xls or stock.get('marque', ''), sousfamille)
        by_famille[fam]['ca'] += ca
        by_famille[fam]['qte'] += qte
        by_famille[fam]['lignes'] += 1
        by_famille[fam]['nb_artcodes'].add(artcode)

        # Tranche prix (unitaire ligne par ligne)
        prix_unit = ca / qte if qte > 0 else 0
        tr = tranche_from_prix(prix_unit)
        by_tranche[tr]['ca'] += ca
        by_tranche[tr]['qte'] += qte
        by_tranche[tr]['lignes'] += 1
        by_tranche_famille[tr][fam]['ca'] += ca
        by_tranche_famille[tr][fam]['qte'] += qte

        # Détail client : top N dernières lignes
        by_client_detail[cip].append({
            'date': date_iso,
            'artcode': artcode,
            'designation': designation,
            'qte': qte,
            'ca': round(ca, 2),
            'marge': round(marge, 2),
            'pcvnum': pcvnum,
        })

    print(f'[sales] Lignes parsées : {lignes_count}')
    print(f'[sales] Période        : {min_date} → {max_date}')
    print(f'[sales] CA total       : {total_ca:,.0f} €')
    print(f'[sales] Marge totale   : {total_marge:,.0f} €')
    print(f'[sales] Factures       : {len(factures_set)}')

    # Sérialisation produit : trier par CA desc, garder top 200 (les autres sont long tail)
    products_sorted = sorted(by_product_data.items(), key=lambda x: -x[1]['ca'])
    products_out = {}
    for artcode, p in products_sorted[:300]:
        products_out[artcode] = {
            'designation': p['designation'],
            'sousfamille': p['sousfamille'],
            'ca': round(p['ca'], 2),
            'marge': round(p['marge'], 2),
            'qte': int(p['qte']),
            'nb_clients': len(p['clients']),
        }

    # Détail client : top 30 dernières lignes par client (sort par date desc)
    client_detail_out = {}
    for cip, lines in by_client_detail.items():
        lines.sort(key=lambda x: x['date'], reverse=True)
        client_detail_out[cip] = lines[:30]

    # Sérialisation par client × mois (compact)
    client_month_out = {}
    for cip, months in by_client_month.items():
        client_month_out[cip] = {
            m: {'ca': round(d['ca'], 2), 'marge': round(d['marge'], 2), 'qte': int(d['qte'])}
            for m, d in months.items()
        }

    months_out = {
        m: {'ca': round(d['ca'], 2), 'marge': round(d['marge'], 2), 'qte': int(d['qte']), 'lignes': d['lignes']}
        for m, d in sorted(by_month.items())
    }

    sousfamilles_out = {
        sf: {'ca': round(d['ca'], 2), 'marge': round(d['marge'], 2), 'qte': int(d['qte']), 'lignes': d['lignes']}
        for sf, d in sorted(by_sousfamille.items(), key=lambda x: -x[1]['ca'])
    }

    familles_out = {
        f: {'ca': round(d['ca'], 2), 'qte': int(d['qte']), 'lignes': d['lignes'], 'nb_refs': len(d['nb_artcodes'])}
        for f, d in sorted(by_famille.items(), key=lambda x: -x[1]['ca'])
    }
    print(f'[sales] Ventilation famille IP :')
    for f, d in familles_out.items():
        pct = d['ca'] / total_ca * 100 if total_ca > 0 else 0
        print(f'  {f:20s} CA {d["ca"]:>12,.0f} EUR ({pct:5.1f}%) · {d["nb_refs"]} refs')

    tranches_out = {
        tr: {'ca': round(d['ca'], 2), 'qte': int(d['qte']), 'lignes': d['lignes']}
        for tr, d in by_tranche.items()
    }
    tranche_famille_out = {
        tr: {f: {'ca': round(c['ca'], 2), 'qte': int(c['qte'])} for f, c in fams.items()}
        for tr, fams in by_tranche_famille.items()
    }
    print(f'[sales] Ventilation tranche prix :')
    labels = {'petit': '0-4.33 EUR', 'inter': '4.33-468 EUR', 'haut': '>468 EUR'}
    for tr in ('petit', 'inter', 'haut'):
        d = tranches_out.get(tr, {'ca': 0, 'qte': 0})
        pct = d['ca'] / total_ca * 100 if total_ca > 0 else 0
        print(f'  {tr:6s} {labels[tr]:18s} CA {d["ca"]:>12,.0f} EUR ({pct:5.1f}%)')

    total_out = {
        'ca': round(total_ca, 2),
        'marge': round(total_marge, 2),
        'marge_pct': round((total_marge / total_ca * 100) if total_ca > 0 else 0, 1),
        'lignes': lignes_count,
        'factures': len(factures_set),
        'premiere_date': min_date,
        'derniere_date': max_date,
        'nb_produits': len(by_product_data),
        'nb_clients': len(by_client_detail),
        'nb_sousfamilles': len(by_sousfamille),
    }

    js = (
        '// Sales detail · agrégats depuis STATS/Etat détaillé.xls\n'
        f'// Période {min_date} → {max_date} · {lignes_count} lignes · {len(factures_set)} factures\n'
        f'// Généré par generate_sales_detail.py\n\n'
        f'window.SALES_TOTAL = {json.dumps(total_out, ensure_ascii=False, indent=2)};\n\n'
        f'window.SALES_BY_MONTH = {json.dumps(months_out, ensure_ascii=False, indent=2)};\n\n'
        f'window.SALES_BY_SOUSFAMILLE = {json.dumps(sousfamilles_out, ensure_ascii=False, indent=2)};\n\n'
        f'window.SALES_BY_FAMILLE = {json.dumps(familles_out, ensure_ascii=False, indent=2)};\n\n'
        f'window.SALES_BY_TRANCHE = {json.dumps(tranches_out, ensure_ascii=False, indent=2)};\n\n'
        f'window.SALES_BY_TRANCHE_FAMILLE = {json.dumps(tranche_famille_out, ensure_ascii=False, indent=2)};\n\n'
        f'window.SALES_BY_PRODUCT = {json.dumps(products_out, ensure_ascii=False, indent=2)};\n\n'
        f'window.SALES_BY_CLIENT_MONTH = {json.dumps(client_month_out, ensure_ascii=False, indent=2)};\n\n'
        f'window.SALES_BY_CLIENT_DETAIL = {json.dumps(client_detail_out, ensure_ascii=False, indent=2)};\n'
    )
    OUT.write_text(js, encoding='utf-8')
    sz = OUT.stat().st_size // 1024
    print(f'[sales] Écrit {OUT} ({sz} KB)')
    print(f'[sales] Top 5 sous-familles :')
    for sf, d in list(sousfamilles_out.items())[:5]:
        print(f'  {sf:35s} · CA {d["ca"]:>12,.0f} € · marge {d["marge"]:>8,.0f} €')


if __name__ == '__main__':
    main()

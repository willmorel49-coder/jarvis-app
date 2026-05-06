#!/usr/bin/env python3
"""
generate_cap3000.py
===================
Lit : benchmark_cap3000.xlsx  (produit par scraper_cap3000.py)
Écrit: crm/cap3000-data.js

Format JS :
  const CAP3000 = [{nom, nom_norm, marque, ean, prix_affiche, prix, url}, ...]
"""
import re
import unicodedata
import sys
from datetime import datetime
from pathlib import Path

import openpyxl

BASE = Path(__file__).parent
SRC  = BASE / 'benchmark_cap3000.xlsx'
OUT  = BASE / 'crm' / 'cap3000-data.js'


def norm(text) -> str:
    if not text:
        return ''
    text = str(text).lower().strip()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def js_str(v) -> str:
    if v is None:
        return 'null'
    s = (str(v).replace('\\', '\\\\').replace('"', '\\"')
         .replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))
    return f'"{s}"'


def js_num(v) -> str:
    if v is None:
        return 'null'
    try:
        f = float(v)
        return f'{f:.4f}'.rstrip('0').rstrip('.')
    except (TypeError, ValueError):
        return 'null'


if not SRC.exists():
    print(f'ERREUR : {SRC} introuvable. Lance scraper_cap3000.py d\'abord.')
    sys.exit(1)

print(f'Lecture : {SRC}')
wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
wb.close()

HEADER = rows[0]
col = {str(h).strip(): i for i, h in enumerate(HEADER) if h}

def cell(row, name):
    idx = col.get(name)
    if idx is None:
        return None
    v = row[idx]
    if isinstance(v, str):
        v = v.strip() or None
    return v

records = []
for row in rows[1:]:
    nom = cell(row, 'Nom')
    if not nom:
        continue
    ean_val = cell(row, 'EAN')
    ean_str = str(ean_val).strip() if ean_val else None

    records.append({
        'nom':          str(nom).strip(),
        'nom_norm':     cell(row, 'Nom normalisé') or norm(str(nom)),
        'marque':       cell(row, 'Marque'),
        'ean':          ean_str,
        'prix_affiche': cell(row, 'Prix affiché'),
        'prix':         cell(row, 'Prix numérique'),
        'url':          cell(row, 'URL'),
    })

total     = len(records)
avec_prix = sum(1 for r in records if r['prix'] is not None)
avec_ean  = sum(1 for r in records if r['ean'])
print(f'Produits : {total} | Avec prix : {avec_prix} | Avec EAN : {avec_ean}')

today = datetime.now().strftime('%Y-%m-%d')
lines = [
    '// Intégral Pharma — Benchmark Pharmacie Cap 3000',
    f'// Généré le {today}',
    f'// {total} produits | {avec_prix} avec prix | {avec_ean} avec EAN',
    'const CAP3000 = [',
]
for r in records:
    lines.append(
        f'  {{nom:{js_str(r["nom"])},nom_norm:{js_str(r["nom_norm"])},'
        f'marque:{js_str(r["marque"])},ean:{js_str(r["ean"])},'
        f'prix_affiche:{js_str(r["prix_affiche"])},prix:{js_num(r["prix"])},'
        f'url:{js_str(r["url"])}}},'
    )
lines.append('];')

OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

sz = OUT.stat().st_size / 1024
print(f'Ecrit : {OUT}  ({sz:.0f} KB)')

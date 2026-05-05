#!/usr/bin/env python3
"""
generate_offilog.py
===================
Lit : OFFILOG/offilog_x_maxipara_3517.xlsx  (feuille "Croisement Complet")
       benchmark_apothical_medicaments.xlsx    (si disponible → enrichit prix_apothical)
Écrit: crm/offilog-data.js

Format JS :
  const OFFILOG = [{rang, produit, produit_norm, ean, marque, univers, saison,
                    prix_maxi, dans_offilog, marque_off, prix_offilog, ecart,
                    marge_pct, potentiel, role, prix_apothical}, ...]
"""
import re
import unicodedata
import os
import json
from datetime import datetime
from pathlib import Path

import openpyxl

BASE   = Path('/Users/williammorel/JARVIS/APP')
SRC    = BASE / 'OFFILOG' / 'offilog_x_maxipara_3517.xlsx'
APOTH  = BASE / 'benchmark_apothical_medicaments.xlsx'
PHARMA = BASE / 'benchmark_apothical_pharmacie_montlouis-sur-loire.xlsx'
OUT    = BASE / 'crm' / 'offilog-data.js'


# ── HELPERS ─────────────────────────────────────────────────────────────────
def norm(text: str) -> str:
    """Normalize: minuscules, sans accents, alphanum+espace uniquement."""
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
    s = (str(v)
         .replace('\\', '\\\\')
         .replace('"', '\\"')
         .replace('&', '&amp;')
         .replace('<', '&lt;')
         .replace('>', '&gt;'))
    return f'"{s}"'


def js_num(v) -> str:
    if v is None:
        return 'null'
    try:
        f = float(v)
        return f'{f:.4f}'.rstrip('0').rstrip('.')
    except (TypeError, ValueError):
        return 'null'


def js_bool(v) -> str:
    return 'true' if v else 'false'


# ── LOAD OFFILOG EXCEL ───────────────────────────────────────────────────────
print(f'Lecture : {SRC}')
wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb['Croisement Complet']
rows = list(ws.iter_rows(values_only=True))
wb.close()

HEADER = rows[0]
print(f'Colonnes : {HEADER}')
print(f'Produits : {len(rows) - 1}')

# Mapping colonnes
COL = {name: i for i, name in enumerate(HEADER) if name}

def get(row, col_name):
    idx = COL.get(col_name)
    if idx is None:
        return None
    v = row[idx]
    if isinstance(v, str):
        v = v.strip()
        if v == '':
            return None
    return v


# ── LOAD APOTHICAL (optionnel) ───────────────────────────────────────────────
apoth_by_norm: dict = {}
if APOTH.exists():
    print(f'Enrichissement Apothical depuis : {APOTH}')
    wb2 = openpyxl.load_workbook(APOTH, read_only=True, data_only=True)
    ws2 = wb2.active
    rows2 = list(ws2.iter_rows(values_only=True))
    wb2.close()
    hdr2 = rows2[0]
    col2 = {n: i for i, n in enumerate(hdr2) if n}
    for r in rows2[1:]:
        nom = r[col2.get('Nom', 1)] if col2.get('Nom') is not None else None
        prix = r[col2.get('Prix numérique', 6)] if col2.get('Prix numérique') is not None else None
        if nom:
            k = norm(str(nom))
            if k and k not in apoth_by_norm:
                try:
                    apoth_by_norm[k] = float(prix) if prix else None
                except (TypeError, ValueError):
                    apoth_by_norm[k] = None
    print(f'  → {len(apoth_by_norm)} produits Apothical chargés')
else:
    print(f'Fichier Apothical non trouvé ({APOTH}) — prix_apothical = null')


# ── LOAD PHARMA APOTHICAL (scraper pharmacie, optionnel) ─────────────────────
pharma_by_norm: dict = {}
if PHARMA.exists():
    print(f'Enrichissement prix pharmacie depuis : {PHARMA}')
    wb3 = openpyxl.load_workbook(PHARMA, read_only=True, data_only=True)
    ws3 = wb3.active
    rows3 = list(ws3.iter_rows(values_only=True))
    wb3.close()
    hdr3 = rows3[0]
    col3 = {n: i for i, n in enumerate(hdr3) if n}
    nom_col  = col3.get('Nom normalisé')
    prix_col = col3.get('Prix affiché')
    for r in rows3[1:]:
        k = str(r[nom_col]).strip() if nom_col is not None and r[nom_col] else None
        prix = r[prix_col] if prix_col is not None else None
        if k and k not in pharma_by_norm:
            try:
                pharma_by_norm[k] = float(prix) if prix else None
            except (TypeError, ValueError):
                pharma_by_norm[k] = None
    print(f'  → {len(pharma_by_norm)} produits pharmacie chargés')
else:
    print(f'Fichier pharmacie non trouvé ({PHARMA}) — prix_pharmacie = null')


# ── BUILD RECORDS ────────────────────────────────────────────────────────────
records = []
for row in rows[1:]:
    produit    = get(row, 'Produit') or ''
    if not produit:
        continue

    rang       = get(row, 'Rang')
    source     = get(row, 'Source')
    marque     = get(row, 'Marque_Maxi') or ''
    ean        = get(row, 'EAN')
    ean_str    = str(int(ean)) if isinstance(ean, (int, float)) and ean else (str(ean) if ean else '')
    prix_maxi  = get(row, 'Prix_Public')
    dans_off   = str(get(row, 'Dans_Offilog') or '').upper() == 'OUI'
    marque_off = get(row, 'Marque_Offilog') or ''
    univers    = get(row, 'Univers') or ''
    saison     = get(row, 'Saison')
    prix_off   = get(row, 'Prix_Achat_Offilog')
    ecart      = get(row, 'Ecart_Prix')
    marge_pct  = get(row, 'Marge_%')
    potentiel  = get(row, 'Potentiel') or ''
    role       = get(row, 'Role_Recommande') or ''

    # Enrichissement Apothical par nom normalisé
    produit_n   = norm(produit)
    prix_apoth  = apoth_by_norm.get(produit_n)
    prix_pharma = pharma_by_norm.get(produit_n)

    records.append({
        'rang':           rang,
        'produit':        produit,
        'produit_norm':   produit_n,
        'ean':            ean_str,
        'marque':         marque,
        'univers':        univers,
        'saison':         saison,
        'prix_maxi':      prix_maxi,
        'dans_offilog':   dans_off,
        'marque_off':     marque_off,
        'prix_offilog':   prix_off,
        'ecart':          ecart,
        'marge_pct':      marge_pct,
        'potentiel':      potentiel,
        'role':           role,
        'prix_apothical': prix_apoth,
        'prix_pharmacie': prix_pharma,
    })

print(f'Records valides : {len(records)}')
avec_apoth  = sum(1 for r in records if r['prix_apothical'] is not None)
avec_pharma = sum(1 for r in records if r['prix_pharmacie'] is not None)
print(f'Avec prix Apothical : {avec_apoth}')
print(f'Avec prix Pharmacie : {avec_pharma}')
dans_off_n = sum(1 for r in records if r['dans_offilog'])
print(f'Dans Offilog : {dans_off_n}')


# ── WRITE JS ─────────────────────────────────────────────────────────────────
today = datetime.now().strftime('%Y-%m-%d')
lines = [
    f'// Intégral Pharma — Offilog × Maxipara × Apothical',
    f'// Généré le {today}',
    f'// {len(records)} produits | {dans_off_n} dans Offilog | {avec_apoth} Apothical | {avec_pharma} Pharmacie',
    f'const OFFILOG = [',
]

for r in records:
    line = (
        f'  {{rang:{js_num(r["rang"])},produit:{js_str(r["produit"])},'
        f'produit_norm:{js_str(r["produit_norm"])},ean:{js_str(r["ean"])},'
        f'marque:{js_str(r["marque"])},univers:{js_str(r["univers"])},'
        f'saison:{js_str(r["saison"])},prix_maxi:{js_num(r["prix_maxi"])},'
        f'dans_offilog:{js_bool(r["dans_offilog"])},marque_off:{js_str(r["marque_off"])},'
        f'prix_offilog:{js_num(r["prix_offilog"])},ecart:{js_num(r["ecart"])},'
        f'marge_pct:{js_num(r["marge_pct"])},potentiel:{js_str(r["potentiel"])},'
        f'role:{js_str(r["role"])},prix_apothical:{js_num(r["prix_apothical"])},'
        f'prix_pharmacie:{js_num(r["prix_pharmacie"])}}},'
    )
    lines.append(line)

lines.append('];')

OUT.parent.mkdir(exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

sz = OUT.stat().st_size / 1024
print(f'\n✓ Écrit : {OUT}  ({sz:.0f} KB, {len(records)} produits)')

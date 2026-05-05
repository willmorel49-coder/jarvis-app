#!/usr/bin/env python3
"""
generate_offilog.py
===================
Lit : OFFILOG/offilog_x_maxipara_3517.xlsx  (feuille "Croisement Complet")
       benchmark_apothical_medicaments.xlsx    (si disponible → enrichit prix_apothical)
       benchmark_drakkars.xlsx                 (si disponible → enrichit prix_drakkars)
Écrit: crm/offilog-data.js

Format JS :
  const OFFILOG = [{rang, produit, produit_norm, ean, marque, univers, saison,
                    prix_maxi, dans_offilog, marque_off, prix_offilog, ecart,
                    marge_pct, potentiel, role, prix_apothical, prix_pharmacie,
                    prix_drakkars}, ...]

Stratégie de matching (par ordre de priorité) :
  1. Par EAN exact (si ean_str non vide) — sources : Apothical médicaments, Drakkars
  2. Par nom normalisé (fallback) — toutes les sources
"""
import re
import unicodedata
import os
import json
from datetime import datetime
from pathlib import Path

import openpyxl

BASE      = Path('/Users/williammorel/JARVIS/APP')
SRC       = BASE / 'OFFILOG' / 'offilog_x_maxipara_3517.xlsx'
DRAKKARS  = BASE / 'benchmark_drakkars.xlsx'
OUT       = BASE / 'crm' / 'offilog-data.js'


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


# ── LOAD DRAKKARS (optionnel) ────────────────────────────────────────────────
# Colonnes: Nom, Marque, EAN, Catégorie, Prix affiché, Prix numérique,
#           Nom normalisé, URL, Catégorie URL
# Matching : priorité EAN, fallback nom normalisé
drakkars_by_norm: dict = {}
drakkars_by_ean:  dict = {}
if DRAKKARS.exists():
    print(f'Enrichissement Drakkars depuis : {DRAKKARS}')
    wb4 = openpyxl.load_workbook(DRAKKARS, read_only=True, data_only=True)
    ws4 = wb4.active
    rows4 = list(ws4.iter_rows(values_only=True))
    wb4.close()
    hdr4 = rows4[0]
    col4 = {n: i for i, n in enumerate(hdr4) if n}
    ean_col4  = col4.get('EAN')
    prix_col4 = col4.get('Prix numérique')
    norm_col4 = col4.get('Nom normalisé')
    nom_col4  = col4.get('Nom')
    for r in rows4[1:]:
        prix = r[prix_col4] if prix_col4 is not None else None
        prix_f = None
        try:
            prix_f = float(prix) if prix is not None else None
        except (TypeError, ValueError):
            pass
        # Index par EAN
        ean_raw = r[ean_col4] if ean_col4 is not None else None
        if ean_raw is not None:
            ean_str_d = str(int(ean_raw)) if isinstance(ean_raw, float) else str(ean_raw).strip()
            if ean_str_d.isdigit() and len(ean_str_d) >= 8:
                if ean_str_d not in drakkars_by_ean:
                    drakkars_by_ean[ean_str_d] = prix_f
        # Index par nom normalisé (colonne du scraper ou calculé)
        nom_norm_raw = r[norm_col4] if norm_col4 is not None else None
        if nom_norm_raw:
            k = str(nom_norm_raw).strip()
        else:
            nom_raw = r[nom_col4] if nom_col4 is not None else None
            k = norm(str(nom_raw)) if nom_raw else ''
        if k and k not in drakkars_by_norm:
            drakkars_by_norm[k] = prix_f
    print(f'  → {len(drakkars_by_norm)} produits Drakkars par nom | {len(drakkars_by_ean)} par EAN')
else:
    print(f'Fichier Drakkars non trouvé ({DRAKKARS}) — prix_drakkars = null')


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

    produit_n = norm(produit)

    # ── Matching Drakkars : EAN en priorité, nom normalisé en fallback
    prix_drakkars = None
    if ean_str:
        prix_drakkars = drakkars_by_ean.get(ean_str)
    if prix_drakkars is None:
        prix_drakkars = drakkars_by_norm.get(produit_n)

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
        'prix_drakkars':  prix_drakkars,
    })

print(f'Records valides : {len(records)}')
avec_drakkars = sum(1 for r in records if r['prix_drakkars'] is not None)
print(f'Avec prix Drakkars : {avec_drakkars}')
dans_off_n = sum(1 for r in records if r['dans_offilog'])
print(f'Dans Offilog : {dans_off_n}')


# ── WRITE JS ─────────────────────────────────────────────────────────────────
today = datetime.now().strftime('%Y-%m-%d')
lines = [
    f'// Intégral Pharma — Offilog × Maxipara × Drakkars',
    f'// Généré le {today}',
    f'// {len(records)} produits | {dans_off_n} dans Offilog | {avec_drakkars} Drakkars',
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
        f'role:{js_str(r["role"])},prix_drakkars:{js_num(r["prix_drakkars"])}}},'
    )
    lines.append(line)

lines.append('];')

OUT.parent.mkdir(exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

sz = OUT.stat().st_size / 1024
print(f'\n✓ Écrit : {OUT}  ({sz:.0f} KB, {len(records)} produits)')

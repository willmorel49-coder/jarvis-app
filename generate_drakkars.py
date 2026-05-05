#!/usr/bin/env python3
"""
generate_drakkars.py
====================
Lit : benchmark_drakkars.xlsx  (produit par scraper_drakkars.py)
Écrit: crm/drakkars-data.js

Format JS :
  const DRAKKARS = [{nom, nom_norm, marque, ean, categorie,
                     prix_affiche, prix, url}, ...]
"""
import re
import unicodedata
import sys
from datetime import datetime
from pathlib import Path

import openpyxl

BASE = Path('/Users/williammorel/JARVIS/APP')
SRC  = BASE / 'benchmark_drakkars.xlsx'
OUT  = BASE / 'crm' / 'drakkars-data.js'


# ── HELPERS ──────────────────────────────────────────────────────────────────

def norm(text) -> str:
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


# ── GUARD : fichier source ────────────────────────────────────────────────────

if not SRC.exists():
    print(f'ERREUR : fichier source introuvable → {SRC}')
    print('Lancez d\'abord scraper_drakkars.py pour générer ce fichier.')
    sys.exit(1)

print(f'Lecture : {SRC}')

# ── CHARGEMENT EXCEL ─────────────────────────────────────────────────────────

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
wb.close()

if not rows:
    print('ERREUR : fichier Excel vide.')
    sys.exit(1)

HEADER = rows[0]
print(f'Colonnes détectées : {list(HEADER)}')
print(f'Lignes produits    : {len(rows) - 1}')

# ── MAPPING COLONNES ─────────────────────────────────────────────────────────
# Mapping tolérant : on cherche par nom exact, insensible à la casse

def find_col(header, *candidates):
    """Retourne l'index de la première colonne trouvée parmi les candidats."""
    header_lower = [str(h).strip().lower() if h else '' for h in header]
    for name in candidates:
        try:
            return header_lower.index(name.lower())
        except ValueError:
            continue
    return None


COL_NOM          = find_col(HEADER, 'Nom')
COL_MARQUE       = find_col(HEADER, 'Marque')
COL_EAN          = find_col(HEADER, 'EAN')
COL_CATEGORIE    = find_col(HEADER, 'Catégorie', 'Categorie')
COL_PRIX_AFF     = find_col(HEADER, 'Prix affiché', 'Prix affiche')
COL_PRIX_NUM     = find_col(HEADER, 'Prix numérique', 'Prix numerique', 'Prix')
COL_NOM_NORM     = find_col(HEADER, 'Nom normalisé', 'Nom normalise', 'Nom normalisé')
COL_URL          = find_col(HEADER, 'URL', 'Url')

print(f'Mapping colonnes :')
print(f'  Nom          → col {COL_NOM}')
print(f'  Marque       → col {COL_MARQUE}')
print(f'  EAN          → col {COL_EAN}')
print(f'  Catégorie    → col {COL_CATEGORIE}')
print(f'  Prix affiché → col {COL_PRIX_AFF}')
print(f'  Prix num.    → col {COL_PRIX_NUM}')
print(f'  Nom normalisé→ col {COL_NOM_NORM}')
print(f'  URL          → col {COL_URL}')


def cell(row, idx):
    """Retourne la valeur d'une cellule, None si index absent ou vide."""
    if idx is None or idx >= len(row):
        return None
    v = row[idx]
    if isinstance(v, str):
        v = v.strip()
        if v == '':
            return None
    return v


# ── CONSTRUCTION DES RECORDS ─────────────────────────────────────────────────

records = []
for row in rows[1:]:
    nom_val = cell(row, COL_NOM)
    if not nom_val:
        continue  # ligne vide ou sans nom, on ignore

    nom_str  = str(nom_val).strip()

    # Nom normalisé : utiliser la colonne si dispo, sinon recalculer
    nom_norm_val = cell(row, COL_NOM_NORM)
    nom_norm_str = str(nom_norm_val).strip() if nom_norm_val else norm(nom_str)

    # EAN : convertir float→int→str pour éviter "3401234567890.0"
    ean_val = cell(row, COL_EAN)
    if isinstance(ean_val, float) and ean_val == int(ean_val):
        ean_str = str(int(ean_val))
    elif ean_val is not None:
        ean_str = str(ean_val).strip()
    else:
        ean_str = None

    marque_val    = cell(row, COL_MARQUE)
    categorie_val = cell(row, COL_CATEGORIE)
    prix_aff_val  = cell(row, COL_PRIX_AFF)
    prix_num_val  = cell(row, COL_PRIX_NUM)
    url_val       = cell(row, COL_URL)

    records.append({
        'nom':          nom_str,
        'nom_norm':     nom_norm_str,
        'marque':       str(marque_val).strip() if marque_val else None,
        'ean':          ean_str,
        'categorie':    str(categorie_val).strip() if categorie_val else None,
        'prix_affiche': str(prix_aff_val).strip() if prix_aff_val else None,
        'prix':         prix_num_val,
        'url':          str(url_val).strip() if url_val else None,
    })

# ── STATS ─────────────────────────────────────────────────────────────────────

total       = len(records)
avec_prix   = sum(1 for r in records if r['prix'] is not None)
avec_ean    = sum(1 for r in records if r['ean'])
avec_marque = sum(1 for r in records if r['marque'])

print(f'\nStats :')
print(f'  Total produits : {total}')
print(f'  Avec prix      : {avec_prix}')
print(f'  Avec EAN       : {avec_ean}')
print(f'  Avec marque    : {avec_marque}')

# ── ÉCRITURE DU FICHIER JS ────────────────────────────────────────────────────

today = datetime.now().strftime('%Y-%m-%d')

lines = [
    '// Intégral Pharma — Benchmark Pharmacie des Drakkars',
    f'// Généré le {today}',
    f'// {total} produits | {avec_prix} avec prix',
    'const DRAKKARS = [',
]

for r in records:
    line = (
        f'  {{nom:{js_str(r["nom"])},nom_norm:{js_str(r["nom_norm"])},'
        f'marque:{js_str(r["marque"])},ean:{js_str(r["ean"])},'
        f'categorie:{js_str(r["categorie"])},prix_affiche:{js_str(r["prix_affiche"])},'
        f'prix:{js_num(r["prix"])},url:{js_str(r["url"])}}},'
    )
    lines.append(line)

lines.append('];')

OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

sz = OUT.stat().st_size / 1024
print(f'\nEcrit : {OUT}  ({sz:.0f} KB, {total} produits)')

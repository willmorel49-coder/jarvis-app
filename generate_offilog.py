#!/usr/bin/env python3
"""
generate_offilog.py
===================
Lit : OFFILOG/offilog_x_maxipara_3517.xlsx  (feuille "Croisement Complet")
       benchmark_drakkars.xlsx               (si disponible → enrichit prix_drakkars)
       benchmark_cap3000.xlsx                (si disponible → enrichit prix_cap3000)
Écrit: crm/offilog-data.js

Format JS :
  const OFFILOG = [{rang, produit, produit_norm, ean, marque, univers, saison,
                    prix_maxi, dans_offilog, marque_off, prix_offilog, ecart,
                    marge_pct, potentiel, role, prix_drakkars, prix_cap3000}, ...]

Stratégie de matching (par ordre de priorité) :
  1. Par EAN exact (si ean_str non vide) — sources : Drakkars, Cap3000
  2. Par nom normalisé (fallback) — toutes les sources
"""
import re
import unicodedata
import json
from datetime import datetime
from pathlib import Path

import openpyxl

BASE      = Path(__file__).parent
SRC       = BASE / 'OFFILOG' / 'offilog_x_maxipara_3517.xlsx'
DRAKKARS  = BASE / 'benchmark_drakkars.xlsx'
CAP3000   = BASE / 'benchmark_cap3000.xlsx'
LIVE_JSON  = BASE / 'offilog_live.json'
BEST_JSON  = BASE / 'bestsellers_offilog.json'
IMG_JSON   = BASE / 'images_by_ean.json'   # lookup consolidé toutes sources
OUT        = BASE / 'crm' / 'offilog-data.js'


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
import sys
if not SRC.exists():
    print(f'ERREUR : fichier source introuvable → {SRC}')
    print('Vérifiez que OFFILOG/offilog_x_maxipara_3517.xlsx est présent.')
    sys.exit(1)

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


# ── LOAD CAP3000 (optionnel) ─────────────────────────────────────────────────
# EAN disponible directement (extrait du dump PHP du site)
cap3000_by_ean:  dict = {}
cap3000_by_norm: dict = {}
if CAP3000.exists():
    print(f'Enrichissement Cap3000 depuis : {CAP3000}')
    wb5 = openpyxl.load_workbook(CAP3000, read_only=True, data_only=True)
    ws5 = wb5.active
    rows5 = list(ws5.iter_rows(values_only=True))
    wb5.close()
    hdr5 = rows5[0]
    col5 = {str(n).strip(): i for i, n in enumerate(hdr5) if n}
    ean_col5  = col5.get('EAN')
    prix_col5 = col5.get('Prix numérique')
    norm_col5 = col5.get('Nom normalisé')
    nom_col5  = col5.get('Nom')
    for r in rows5[1:]:
        prix = r[prix_col5] if prix_col5 is not None else None
        prix_f = None
        try:
            prix_f = float(prix) if prix is not None else None
        except (TypeError, ValueError):
            pass
        ean_raw = r[ean_col5] if ean_col5 is not None else None
        if ean_raw is not None:
            ean_s = str(int(ean_raw)) if isinstance(ean_raw, float) else str(ean_raw).strip()
            if ean_s.isdigit() and len(ean_s) >= 8 and ean_s not in cap3000_by_ean:
                cap3000_by_ean[ean_s] = prix_f
        nom_norm_raw = r[norm_col5] if norm_col5 is not None else None
        if nom_norm_raw:
            k = str(nom_norm_raw).strip()
        else:
            nom_raw = r[nom_col5] if nom_col5 is not None else None
            k = norm(str(nom_raw)) if nom_raw else ''
        if k and k not in cap3000_by_norm:
            cap3000_by_norm[k] = prix_f
    print(f'  → {len(cap3000_by_norm)} produits Cap3000 par nom | {len(cap3000_by_ean)} par EAN')
else:
    print(f'Fichier Cap3000 non trouvé ({CAP3000}) — prix_cap3000 = null')


# ── LOAD OFFILOG LIVE (optionnel) ────────────────────────────────────────────
# Données scrapées depuis offilog.fr : prix d'achat réel + images produit
# Matching : EAN prioritaire (tous les produits live ont un EAN)
live_by_ean:  dict = {}   # ean_str → {prix, img}
live_by_norm: dict = {}   # nom_norm → {prix, img}
if LIVE_JSON.exists():
    print(f'Enrichissement Offilog Live depuis : {LIVE_JSON}')
    with open(LIVE_JSON, encoding='utf-8') as _f:
        _live = json.load(_f)
    for _p in _live.get('products', []):
        _ean = str(_p.get('ean', '') or '').strip()
        _prix = _p.get('prix')
        _img  = _p.get('img', '') or ''
        _entry = {'prix': float(_prix) if _prix else None, 'img': _img}
        if _ean and _ean.isdigit() and len(_ean) >= 8:
            if _ean not in live_by_ean:
                live_by_ean[_ean] = _entry
        _nom_n = norm(str(_p.get('nom', '') or ''))
        if _nom_n and _nom_n not in live_by_norm:
            live_by_norm[_nom_n] = _entry
    print(f'  → {len(live_by_ean)} produits Offilog Live par EAN | {len(live_by_norm)} par nom')
else:
    print(f'Fichier Offilog Live non trouvé ({LIVE_JSON}) — prix_live/img = null')


# ── LOAD BESTSELLERS (optionnel) ──────────────────────────────────────────────
# Classement des meilleures ventes Offilog (rang 1 = meilleure vente)
best_by_ean:  dict = {}   # ean_str → rang_vente int
best_by_norm: dict = {}   # nom_norm → rang_vente int
if BEST_JSON.exists():
    print(f'Enrichissement Best-sellers depuis : {BEST_JSON}')
    with open(BEST_JSON, encoding='utf-8') as _f:
        _best = json.load(_f)
    for _p in _best.get('products', []):
        _ean = str(_p.get('ean', '') or '').strip()
        _rang = _p.get('rang')
        if _ean and _ean.isdigit() and len(_ean) >= 8 and _rang:
            best_by_ean[_ean] = int(_rang)
        _nom_n = norm(str(_p.get('nom', '') or ''))
        if _nom_n and _rang and _nom_n not in best_by_norm:
            best_by_norm[_nom_n] = int(_rang)
    print(f'  → {len(best_by_ean)} best-sellers par EAN')
else:
    print(f'Fichier Best-sellers non trouvé ({BEST_JSON}) — rang_vente = null')


# ── LOAD IMAGES CONSOLIDÉES (optionnel, priorité max) ────────────────────────
# Lookup EAN/nom_norm → URL image (toutes sources Offilog + Drakkars + Cap3000)
img_by_ean:  dict = {}
img_by_norm: dict = {}
if IMG_JSON.exists():
    print(f'Enrichissement images consolidées depuis : {IMG_JSON}')
    with open(IMG_JSON, encoding='utf-8') as _f:
        _imgs = json.load(_f)
    img_by_ean  = _imgs.get('by_ean', {})
    img_by_norm = _imgs.get('by_norm', {})
    print(f'  → {len(img_by_ean)} images par EAN · {len(img_by_norm)} par nom')
else:
    print(f'Fichier images consolidées non trouvé ({IMG_JSON}) — fallback live uniquement')


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

    # ── Matching Cap3000 : EAN en priorité, nom normalisé en fallback
    prix_cap3000 = None
    if ean_str:
        prix_cap3000 = cap3000_by_ean.get(ean_str)
    if prix_cap3000 is None:
        prix_cap3000 = cap3000_by_norm.get(produit_n)

    # ── Matching Offilog Live : EAN en priorité, nom en fallback
    _live_entry = None
    if ean_str:
        _live_entry = live_by_ean.get(ean_str)
    if _live_entry is None:
        _live_entry = live_by_norm.get(produit_n)
    prix_live = _live_entry['prix'] if _live_entry else None
    # Si trouvé dans le live, on confirme dans_offilog=True
    if _live_entry:
        dans_off = True

    # ── Image : lookup consolidé (toutes sources) en priorité, live en fallback
    img = ''
    if img_by_ean and ean_str:
        img = img_by_ean.get(ean_str, '')
    if not img and img_by_norm:
        img = img_by_norm.get(produit_n, '')
    if not img and _live_entry:
        img = _live_entry.get('img', '') or ''

    # ── Matching Best-sellers : EAN en priorité, nom en fallback
    rang_vente = None
    if ean_str:
        rang_vente = best_by_ean.get(ean_str)
    if rang_vente is None:
        rang_vente = best_by_norm.get(produit_n)

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
        'prix_cap3000':   prix_cap3000,
        'prix_live':      prix_live,
        'img':            img,
        'rang_vente':     rang_vente,
    })

print(f'Records valides : {len(records)}')
avec_drakkars = sum(1 for r in records if r['prix_drakkars'] is not None)
avec_cap3000  = sum(1 for r in records if r['prix_cap3000']  is not None)
avec_live     = sum(1 for r in records if r['prix_live']   is not None)
avec_img      = sum(1 for r in records if r['img'])
avec_best     = sum(1 for r in records if r['rang_vente'] is not None)
print(f'Avec prix Drakkars  : {avec_drakkars}')
print(f'Avec prix Cap3000   : {avec_cap3000}')
print(f'Avec prix Live      : {avec_live}')
print(f'Avec image          : {avec_img}')
print(f'Best-sellers matchés: {avec_best}')
dans_off_n = sum(1 for r in records if r['dans_offilog'])
print(f'Dans Offilog : {dans_off_n}')


# ── WRITE JS ─────────────────────────────────────────────────────────────────
today = datetime.now().strftime('%Y-%m-%d')
lines = [
    f'// Intégral Pharma — Offilog × Maxipara × Drakkars × Cap3000 × Live',
    f'// Généré le {today}',
    f'// {len(records)} produits | {dans_off_n} dans Offilog | {avec_live} prix live | {avec_img} images | {avec_drakkars} Drakkars | {avec_cap3000} Cap3000',
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
        f'role:{js_str(r["role"])},prix_drakkars:{js_num(r["prix_drakkars"])},'
        f'prix_cap3000:{js_num(r["prix_cap3000"])},'
        f'prix_live:{js_num(r["prix_live"])},img:{js_str(r["img"] or None)},'
        f'rang_vente:{js_num(r["rang_vente"])}}},'
    )
    lines.append(line)

lines.append('];')

OUT.parent.mkdir(exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

sz = OUT.stat().st_size / 1024
print(f'\n✓ Écrit : {OUT}  ({sz:.0f} KB, {len(records)} produits)')

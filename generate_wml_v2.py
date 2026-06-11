#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère crm/v2/wml-officines-data.js pour le CRM V2.
Source : STATS/WML_pharmacies.xlsx (officines) + STATS/WML_01..05_2026.xlsx (ventes).
Ne garde que les officines AYANT des ventes (clients actifs).
Clé produit = ARTCODEBARRE (CIP13) pour matcher BENCHMARK.cip13.
Python 3.9 compatible.
"""
import json
import os
import openpyxl

BASE = '/Users/williammorel/JARVIS/APP'
STATS = os.path.join(BASE, 'STATS')
PHARM_FILE = os.path.join(STATS, 'WML_pharmacies.xlsx')
MONTHS = [
    (os.path.join(STATS, 'WML_01_2026.xlsx'), 1, 2026),
    (os.path.join(STATS, 'WML_02_2026.xlsx'), 2, 2026),
    (os.path.join(STATS, 'WML_03_2026.xlsx'), 3, 2026),
    (os.path.join(STATS, 'WML_04_2026.xlsx'), 4, 2026),
    (os.path.join(STATS, 'WML_05_2026.xlsx'), 5, 2026),
]
OUT = os.path.join(BASE, 'crm', 'v2', 'wml-officines-data.js')
PALETTE = ['#1E9E6A', '#0050E6', '#C7791A', '#6D4FC4', '#00B5D8',
           '#E0556E', '#0034A0', '#13794F', '#A65F12', '#4F3A99']


def s(v):
    return '' if v is None else str(v).strip()


def num(v):
    try:
        return round(float(v), 4)
    except (TypeError, ValueError):
        return 0.0


def cip13(v):
    """ARTCODEBARRE -> chaîne CIP13 propre (sans .0)."""
    if v is None:
        return ''
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        return s(v)


# ── 1. Master officines (WML_pharmacies) : code CIP -> infos ──
pharm = {}
wb = openpyxl.load_workbook(PHARM_FILE, read_only=True, data_only=True)
ws = wb.active
rows = ws.iter_rows(values_only=True)
hdr = next(rows)
idx = {name: i for i, name in enumerate(hdr)}


def col(row, name):
    i = idx.get(name)
    return row[i] if (i is not None and i < len(row)) else None


for r in rows:
    code = s(col(r, 'Code CIP'))
    if not code:
        continue
    try:
        code = str(int(float(code)))
    except (TypeError, ValueError):
        pass
    pharm[code] = {
        'name': s(col(r, 'Nom abrégé')) or ('Officine ' + code),
        'ville': s(col(r, 'Ville')),
        'cp': s(col(r, 'Code Postal')),
        'tel': s(col(r, 'Téléphone')),
        'groupement': s(col(r, 'Groupement Partenaire')),
        'grossiste': s(col(r, 'Grossiste Principal')),
        'potentiel': col(r, 'Potentiel'),
    }
wb.close()

# ── 2. Ventes (5 mois) ──
sales = []
active = {}  # code -> nom (depuis les ventes, fallback)
for path, mois, annee in MONTHS:
    if not os.path.exists(path):
        print('  [skip] absent :', path)
        continue
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    it = ws.iter_rows(values_only=True)
    h = next(it)
    hi = {name: i for i, name in enumerate(h)}

    def c(row, name):
        i = hi.get(name)
        return row[i] if (i is not None and i < len(row)) else None

    n = 0
    for r in it:
        tir = c(r, 'TIRCODE')
        if tir is None:
            continue
        try:
            code = str(int(float(tir)))
        except (TypeError, ValueError):
            code = s(tir)
        if not code:
            continue
        if code not in active:
            active[code] = s(c(r, 'TIRSOCIETE'))
        sales.append({
            'pharmacyId': code,
            'month': mois, 'year': annee,
            'artDesignation': s(c(r, 'PLVDESIGNATION')),
            'artCode': cip13(c(r, 'ARTCODEBARRE')),
            'artFamille': s(c(r, 'ARTSOUSFAMILLE')) or None,
            'qte': num(c(r, 'PLVQTE')),
            'puBrut': num(c(r, 'PLVPUBRUT')),
            'puNet': num(c(r, 'PLVPUNET')),
            'mntNetHt': num(c(r, 'PLVMNTNETHT')),
        })
        n += 1
    wb.close()
    print('  {} : {} lignes'.format(os.path.basename(path), n))

# ── 3. Officines actives (avec ventes) ──
officines = []
for i, code in enumerate(sorted(active.keys())):
    info = pharm.get(code, {})
    officines.append({
        'id': code,
        'code': code,
        'name': info.get('name') or active[code] or ('Officine ' + code),
        'ville': info.get('ville', ''),
        'cp': info.get('cp', ''),
        'tel': info.get('tel', ''),
        'groupement': info.get('groupement', ''),
        'potentiel': info.get('potentiel'),
        'color': PALETTE[i % len(PALETTE)],
    })

# ── 4. Écriture JS ──
months_lbl = 'Jan-Mai 2026'
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// WML Officines + Ventes — source de vérité CRM V2\n')
    f.write('// {} officines actives · {} lignes de ventes · {}\n'.format(
        len(officines), len(sales), months_lbl))
    f.write('// Généré par generate_wml_v2.py depuis STATS/WML_pharmacies + WML_01..05_2026\n')
    f.write('const WML_OFFICINES = ' + json.dumps(officines, ensure_ascii=False) + ';\n')
    f.write('const WML_SALES = ' + json.dumps(sales, ensure_ascii=False) + ';\n')
    f.write('try{window.WML_OFFICINES=WML_OFFICINES;window.WML_SALES=WML_SALES;}catch(e){}\n')

size = os.path.getsize(OUT)
print('\nOK -> {}'.format(OUT))
print('  {} officines · {} ventes · {:.0f} Ko'.format(len(officines), len(sales), size / 1024))

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
import sqlite3
import openpyxl

# Mapping CIP/nom -> groupement issu du scraping (projet GROUPEMENTS)
import re as _re, unicodedata as _ud
GRP_DB = '/Users/williammorel/JARVIS/GROUPEMENTS/data/output/pharmacies.sqlite'
def _norm_name(s):
    s = _ud.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    s = _re.sub(r'\bPHARMACIE\b|\bPHIE\b|\bSELARL\b|\bSARL\b', '', s)
    return _re.sub(r'[^A-Z0-9]+', ' ', s).strip()
def _cipkey(code):
    try:
        return str(int(float(code)))
    except (TypeError, ValueError):
        m = _re.match(r'\d+', str(code or ''))
        return m.group(0) if m else str(code or '').strip()
def load_groupements():
    cipm, namem = {}, {}
    if not os.path.exists(GRP_DB):
        print('  [grp] base absente :', GRP_DB); return cipm, namem
    try:
        c = sqlite3.connect(GRP_DB)
        for code, nom, g25, gact in c.execute(
                "select code_phirst, nom, groupement_2025, groupement_actuel from pharmacies"):
            g = (g25 or gact or '').strip()
            if not g:
                continue
            k = _cipkey(code)
            if k and k not in cipm:
                cipm[k] = g
            nm = _norm_name((nom or '').split('|')[0])
            if nm and len(nm) >= 4 and nm not in namem:
                namem[nm] = g
        c.close()
    except Exception as e:
        print('  [grp] erreur :', e)
    print('  [grp] {} CIP + {} noms -> groupement'.format(len(cipm), len(namem)))
    return cipm, namem

BASE = '/Users/williammorel/JARVIS/APP'
STATS = os.path.join(BASE, 'STATS')
PHARM_FILE = os.path.join(STATS, 'WML_pharmacies.xlsx')
# (commercial, préfixe fichier) — chaque source = 5 mois
SOURCES = [
    ('Will', 'WML'),
    ('Pauline', 'PGN'),
]
MONTHS_NUM = [1, 2, 3, 4, 5]
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

# ── 2. Ventes (Will=WML + Pauline=PGN, 5 mois chacun) ──
sales = []
active = {}  # code -> nom (fallback)
comms = {}   # code -> set des commerciaux
for comm, prefix in SOURCES:
    for mois in MONTHS_NUM:
        path = os.path.join(STATS, '%s_%02d_2026.xlsx' % (prefix, mois))
        if not os.path.exists(path):
            print('  [skip] absent :', path)
            continue
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        it = ws.iter_rows(values_only=True)
        h = next(it)
        hi = {name: i for i, name in enumerate(h)}

        def c(row, name, _hi=hi):
            i = _hi.get(name)
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
            comms.setdefault(code, set()).add(comm)
            sales.append({
                'pharmacyId': code,
                'month': mois, 'year': 2026, 'comm': comm,
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
        print('  {} ({}) : {} lignes'.format(os.path.basename(path), comm, n))

# ── 3. Officines actives (avec ventes), taguées commercial + groupement ──
grp_cip, grp_name = load_groupements()
officines = []
nb_grp = 0
for i, code in enumerate(sorted(active.keys())):
    info = pharm.get(code, {})
    nm = info.get('name') or active[code] or ''
    grp = grp_cip.get(_cipkey(code)) or grp_name.get(_norm_name(nm)) or info.get('groupement', '') or ''
    if grp:
        nb_grp += 1
    officines.append({
        'id': code,
        'code': code,
        'name': info.get('name') or active[code] or ('Officine ' + code),
        'ville': info.get('ville', ''),
        'cp': info.get('cp', ''),
        'tel': info.get('tel', ''),
        'groupement': grp,
        'potentiel': info.get('potentiel'),
        'comms': sorted(comms.get(code, [])),
        'color': PALETTE[i % len(PALETTE)],
    })
print('  officines avec groupement : {}/{}'.format(nb_grp, len(officines)))

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

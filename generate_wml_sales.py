"""
Génère opso/wml-sales-data.js depuis les 4 fichiers WML Excel.
Chaque ligne produit → un objet sale statique (même format que state.sales).
pharmacyCode = TIRCODE (CIP), sera mappé à l'UUID Supabase au chargement.
"""
import json, os, warnings
warnings.filterwarnings('ignore')
import openpyxl

WML_FILES = [
    ('/Users/williammorel/JARVIS/APP/WML_01_2026.xlsx', 1, 2026),
    ('/Users/williammorel/JARVIS/APP/WML_02_2026.xlsx', 2, 2026),
    ('/Users/williammorel/JARVIS/APP/WML_03_2026.xlsx', 3, 2026),
    ('/Users/williammorel/JARVIS/APP/WML_04_2026.xlsx', 4, 2026),
]

OUT = '/Users/williammorel/JARVIS/APP/opso/wml-sales-data.js'

OPSO_CIPS = {
    '2136311',  # HAUTEMANIERE
    '2007430',  # IFS
    '2075385',  # LONG COURS
    '2013097',  # REPUBLIQUE (Honfleur)
    '2135433',  # SAINT NICOLAS
    '2075914',  # LE GAC
}

def classify(nature, afm, pu_net):
    n = (nature or '').lower()
    a = (afm or '').lower()
    if 'biosimilaire' in n: return 'biosim'
    if 'generique' in n:    return 'generique'
    if a in ('para', 'dm', 'dm_20'): return 'nr'
    try:
        p = float(pu_net or 0)
        if p > 468:  return 'ch'
        if p > 4.33: return 'mi'
    except: pass
    return 'pp'

def fv(x):
    """Format number for JS"""
    if x is None: return 'null'
    try:
        f = float(x)
        if f == int(f): return str(int(f))
        return f'{f:.4f}'.rstrip('0').rstrip('.')
    except: return 'null'

def js_str(s):
    if not s: return 'null'
    return json.dumps(str(s), ensure_ascii=False)

all_sales = []
idx = 0

for fpath, month, year in WML_FILES:
    fname = os.path.basename(fpath)
    print(f'Lecture {fname}...')
    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    hdr = rows[0]
    col = {n: i for i, n in enumerate(hdr) if n}

    def gc(k): return lambda row: row[col[k]] if k in col else None

    skipped = 0
    added   = 0
    for row in rows[1:]:
        def g(k): return row[col[k]] if k in col else None
        tc = g('TIRCODE')
        if tc is None: continue
        tc = str(int(tc))
        if tc not in OPSO_CIPS:
            skipped += 1
            continue

        designation = str(g('PLVDESIGNATION') or '').strip()
        if not designation: continue

        try: qte     = float(g('PLVQTE') or 0)
        except: qte  = 0.0
        try: pu_brut = float(g('PLVPUBRUT') or 0)
        except: pu_brut = 0.0
        try: pu_net  = float(g('PLVPUNET') or 0)
        except: pu_net = 0.0
        try: mnt     = float(g('PLVMNTNETHT') or 0)
        except: mnt  = 0.0

        nature    = str(g('ARTNATURE') or '')
        afm_code  = str(g('AFMCODE') or '')
        subfamily = str(g('ARTSOUSFAMILLE') or '')
        art_code  = str(g('ARTCODE') or '')
        famille   = classify(nature, afm_code, pu_net)

        # artFamille : froid is transversal indicator
        art_famille = famille
        if subfamily.lower() == 'froid':
            art_famille = 'froid'  # will trigger isFroid()

        all_sales.append({
            'id':            f'wml_{tc}_{month}_{year}_{idx}',
            'pharmacyCode':  tc,
            'importId':      None,
            'month':         month,
            'year':          year,
            'artDesignation': designation,
            'artCode':       art_code,
            'artId':         None,
            'artFamille':    art_famille,
            'qte':           qte,
            'puBrut':        pu_brut,
            'puNet':         pu_net,
            'mntNetHt':      mnt,
        })
        idx += 1
        added += 1

    print(f'  → {added} lignes ajoutées, {skipped} hors OPSO')

# Grouper par pharmacie pour stats
from collections import defaultdict
by_ph = defaultdict(lambda: defaultdict(float))
for s in all_sales:
    by_ph[s['pharmacyCode']][f"{s['month']}/{s['year']}"] += s['mntNetHt']

print(f'\nTotal : {len(all_sales)} lignes · {len(by_ph)} pharmacies')
for tc in sorted(by_ph.keys()):
    months = by_ph[tc]
    total = sum(months.values())
    print(f'  {tc}: CA {total:,.0f}€ ({len(months)} mois)')

# Générer le fichier JS
print(f'\nGénération {OUT}...')

lines = [
    f'// WML Sales Data — Généré le 2026-05-10',
    f'// {len(all_sales)} lignes · {len(by_ph)} pharmacies · Jan-Avr 2026',
    f'// pharmacyCode = CIP, mappé à pharmacyId au chargement (initApp)',
    f'const WML_STATIC_SALES = [',
]

for s in all_sales:
    line = (
        f'{{'
        f'id:{js_str(s["id"])},'
        f'pharmacyCode:{js_str(s["pharmacyCode"])},'
        f'importId:null,'
        f'month:{s["month"]},'
        f'year:{s["year"]},'
        f'artDesignation:{js_str(s["artDesignation"])},'
        f'artCode:{js_str(s["artCode"])},'
        f'artId:null,'
        f'artFamille:{js_str(s["artFamille"])},'
        f'qte:{fv(s["qte"])},'
        f'puBrut:{fv(s["puBrut"])},'
        f'puNet:{fv(s["puNet"])},'
        f'mntNetHt:{fv(s["mntNetHt"])}'
        f'}},'
    )
    lines.append(line)

lines.append('];')

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

size_kb = os.path.getsize(OUT) // 1024
print(f'  → {OUT} ({size_kb} KB)')
print('Terminé.')

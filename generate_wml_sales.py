"""
Génère les données de l'app OPSO Santé depuis les stats mensuelles (STATS/*_0X_2026.xlsx) :
  - opso/wml-sales-data.js  (WML_STATIC_SALES : lignes produit par officine adhérente OPSO)
  - opso/opso-adherents.js  (OPSO_ADHERENTS : adhérents OPSO ACTIFS = avec ventes)

Périmètre = adhérents OPSO officiels (opso/opso-listing-2026.js), toutes sources commerciales
confondues (William=WML, Karine=KV, …). Un adhérent OPSO apparaît dès qu'il a des ventes,
peu importe le commercial qui le suit.

Robustesse : certains exports sont bruts (ex. KV de Karine) sans ARTCODEBARRE / ARTNATURE /
AFMCODE. On reconstruit ces champs via une table ARTCODE/PROCODE bâtie sur les fichiers déjà
enrichis (même principe que generate_wml_v2.py).
"""
import json, os, re, glob, warnings
warnings.filterwarnings('ignore')
import openpyxl

BASE = '/Users/williammorel/JARVIS/APP'
STATS = os.path.join(BASE, 'STATS')
LISTING_JS = os.path.join(BASE, 'opso', 'opso-listing-2026.js')
OUT_SALES = os.path.join(BASE, 'opso', 'wml-sales-data.js')
OUT_ADH = os.path.join(BASE, 'opso', 'opso-adherents.js')
MONTHS = [1, 2, 3, 4, 5, 6]


def classify(nature, afm, pu_net):
    n = (nature or '').lower()
    a = (afm or '').lower()
    if 'biosimilaire' in n:
        return 'biosim'
    if 'generique' in n:
        return 'generique'
    if a in ('para', 'dm', 'dm_20'):
        return 'nr'
    try:
        p = float(pu_net or 0)
        if p > 468:
            return 'ch'
        if p > 4.33:
            return 'mi'
    except (TypeError, ValueError):
        pass
    return 'pp'


def fv(x):
    if x is None:
        return 'null'
    try:
        f = float(x)
        if f == int(f):
            return str(int(f))
        return f'{f:.4f}'.rstrip('0').rstrip('.')
    except (TypeError, ValueError):
        return 'null'


def js_str(s):
    if not s:
        return 'null'
    return json.dumps(str(s), ensure_ascii=False)


def code_str(v):
    if v is None:
        return ''
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        return str(v).strip()


# ── 1. Adhérents OPSO officiels (périmètre) ──
txt = open(LISTING_JS, encoding='utf-8').read()
OPSO_INFO = {}
for m in re.finditer(r'\{[^{}]*?"cip":\s*"(\d+)"[^{}]*?\}', txt, re.S):
    blob = m.group(0)
    cip = m.group(1)

    def field(name, _b=blob):
        mm = re.search(r'"%s":\s*"([^"]*)"' % name, _b)
        return mm.group(1) if mm else ''
    OPSO_INFO[cip] = {
        'nom': field('nom'), 'cp': field('cp'),
        'ville': field('ville'), 'uga': field('uga'),
    }
OPSO_CIPS = set(OPSO_INFO.keys())
print('Adhérents OPSO officiels :', len(OPSO_CIPS))

# ── 2. Table ARTCODE/PROCODE -> {ean, nature, afm, subfamily} depuis les fichiers enrichis ──
ARTMAP = {}


def _put(key, ean, nat, afm, sub):
    if key in (None, ''):
        return
    key = str(key).split('.')[0]
    d = ARTMAP.setdefault(key, {})
    if ean and not d.get('ean'):
        d['ean'] = ean
    if nat and not d.get('nature'):
        d['nature'] = nat
    if afm and not d.get('afm'):
        d['afm'] = afm
    if sub and not d.get('sub'):
        d['sub'] = sub


for p in sorted(glob.glob(os.path.join(STATS, '*_0[1-6]_2026*.xlsx'))):
    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    ws = wb.active
    it = ws.iter_rows(values_only=True)
    h = next(it)
    hi = {n: i for i, n in enumerate(h)}
    if 'ARTNATURE' not in hi and 'ARTCODEBARRE' not in hi:
        wb.close()
        continue
    ia, ip = hi.get('ARTCODE'), hi.get('PROCODE')
    ib, inat, iafm, isub = hi.get('ARTCODEBARRE'), hi.get('ARTNATURE'), hi.get('AFMCODE'), hi.get('ARTSOUSFAMILLE')
    for r in it:
        def gv(i):
            return r[i] if (i is not None and i < len(r)) else None
        ean = code_str(gv(ib)) if ib is not None else ''
        nat = gv(inat) or ''
        afm = gv(iafm) or ''
        sub = gv(isub) or ''
        for k in (gv(ia), gv(ip)):
            _put(k, ean, str(nat), str(afm), str(sub))
    wb.close()
print('Table ARTCODE -> attributs :', len(ARTMAP), 'entrées')

# ── 3. Lecture de toutes les sources mensuelles, filtrées aux adhérents OPSO ──
all_sales = []
idx = 0
active = {}  # cip -> nb lignes
files = sorted(glob.glob(os.path.join(STATS, '*_0[1-6]_2026.xlsx')))
for path in files:
    base = os.path.basename(path)
    mm = re.match(r'[A-Za-z]+_(0[1-6])_2026\.xlsx$', base)
    if not mm:
        continue
    month = int(mm.group(1))
    if month not in MONTHS:
        continue
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    it = ws.iter_rows(values_only=True)
    hdr = next(it)
    col = {n: i for i, n in enumerate(hdr) if n}

    def g(row, k, _c=col):
        i = _c.get(k)
        return row[i] if (i is not None and i < len(row)) else None

    added = 0
    for row in it:
        cip = code_str(g(row, 'TIRCODE'))
        if not cip or cip not in OPSO_CIPS:
            continue
        designation = str(g(row, 'PLVDESIGNATION') or '').strip()
        if not designation:
            continue
        art_code = code_str(g(row, 'ARTCODE'))
        pro_code = code_str(g(row, 'PROCODE'))
        amap = ARTMAP.get(art_code) or ARTMAP.get(pro_code) or {}

        def num(k):
            try:
                return float(g(row, k) or 0)
            except (TypeError, ValueError):
                return 0.0
        pu_net = num('PLVPUNET')
        # champs classification : colonne si présente, sinon backfill via ARTMAP
        nature = g(row, 'ARTNATURE') or amap.get('nature') or ''
        afm = g(row, 'AFMCODE') or amap.get('afm') or ''
        subfamily = str(g(row, 'ARTSOUSFAMILLE') or amap.get('sub') or '')
        famille = classify(str(nature), str(afm), pu_net)
        art_famille = 'froid' if subfamily.lower() == 'froid' else famille

        all_sales.append({
            'id': f'wml_{cip}_{month}_2026_{idx}',
            'pharmacyCode': cip, 'month': month, 'year': 2026,
            'artDesignation': designation, 'artCode': art_code,
            'artFamille': art_famille, 'qte': num('PLVQTE'),
            'puBrut': num('PLVPUBRUT'), 'puNet': pu_net, 'mntNetHt': num('PLVMNTNETHT'),
        })
        active[cip] = active.get(cip, 0) + 1
        idx += 1
        added += 1
    wb.close()
    if added:
        print('  %-26s : %d lignes OPSO' % (base, added))

print('\nTotal : %d lignes · %d adhérents OPSO actifs' % (len(all_sales), len(active)))

# ── 4. Écriture wml-sales-data.js ──
lines = [
    '// WML Sales Data — app OPSO Santé (généré par generate_wml_sales.py)',
    '// %d lignes · %d adhérents actifs · Jan-Juin 2026 (toutes sources : William + Karine…)' % (len(all_sales), len(active)),
    '// pharmacyCode = CIP, mappé à pharmacyId au chargement (initApp)',
    'const WML_STATIC_SALES = [',
]
for s in all_sales:
    lines.append(
        '{'
        f'id:{js_str(s["id"])},pharmacyCode:{js_str(s["pharmacyCode"])},importId:null,'
        f'month:{s["month"]},year:{s["year"]},'
        f'artDesignation:{js_str(s["artDesignation"])},artCode:{js_str(s["artCode"])},artId:null,'
        f'artFamille:{js_str(s["artFamille"])},qte:{fv(s["qte"])},puBrut:{fv(s["puBrut"])},'
        f'puNet:{fv(s["puNet"])},mntNetHt:{fv(s["mntNetHt"])}'
        '},'
    )
lines.append('];')
with open(OUT_SALES, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print('→ %s (%d Ko)' % (os.path.relpath(OUT_SALES, BASE), os.path.getsize(OUT_SALES) // 1024))

# ── 5. Écriture opso-adherents.js (adhérents ACTIFS, triés par CA décroissant) ──
ca_by = {}
for s in all_sales:
    ca_by[s['pharmacyCode']] = ca_by.get(s['pharmacyCode'], 0.0) + s['mntNetHt']
adh_cips = sorted(active.keys(), key=lambda c: -ca_by.get(c, 0))
adh = []
for cip in adh_cips:
    info = OPSO_INFO.get(cip, {})
    adh.append({'cip': cip, 'nom': info.get('nom', 'Officine ' + cip),
                'cp': info.get('cp', ''), 'ville': info.get('ville', ''), 'uga': info.get('uga', '')})
with open(OUT_ADH, 'w', encoding='utf-8') as f:
    f.write('// Listing adhérents OPSO Santé ACTIFS (avec ventes) — généré par generate_wml_sales.py\n')
    f.write('// %d pharmacies actives (William + Karine…)\n' % len(adh))
    f.write('const OPSO_ADHERENTS = [\n')
    for a in adh:
        f.write('  {cip:%s,nom:%s,cp:%s,ville:%s,uga:%s},\n' % (
            js_str(a['cip']), js_str(a['nom']), js_str(a['cp']), js_str(a['ville']), js_str(a['uga'])))
    f.write('];\n')
    f.write('try{window.OPSO_ADHERENTS=OPSO_ADHERENTS;}catch(e){}\n')
print('→ %s (%d adhérents actifs)' % (os.path.relpath(OUT_ADH, BASE), len(adh)))
for cip in adh_cips:
    print('  %s  %-40s  CA %10.0f €  (%d lignes)' % (cip, OPSO_INFO.get(cip, {}).get('nom', '?')[:40], ca_by.get(cip, 0), active[cip]))
print('Terminé.')

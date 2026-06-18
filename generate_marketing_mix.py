# -*- coding: utf-8 -*-
"""Mix marketing grossiste : catalogue L'Intégral (parapharma par catégorie)
+ catalogue ITP (pansements/DM avec marge) + best-sellers (sorties IP).
→ crue dans crm/v2/marketing-mix-data.js (window.MKT_MIX), source de l'onglet Marketing.
Nécessite pdftotext (les .txt sont régénérés ici). Python 3.9.
"""
import re, json, os, subprocess, unicodedata, openpyxl


def norm_name(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    return re.sub(r'[^A-Z0-9]', '', s)


def root_name(s):
    # racine = lettres avant le 1er chiffre (marque/produit), ex "ABUFEN 400MG" -> "ABUFEN"
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    m = re.match(r'([A-Z][A-Z &\-]{2,})', s)
    return re.sub(r'[^A-Z0-9]', '', m.group(1)) if m else ''


def brand_name(s):
    # 1er mot-marque (ex "AQUACEL FOAM Pansement..." -> "AQUACEL")
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper().strip()
    m = re.match(r'([A-Z]{3,})', s)
    return m.group(1) if m else ''


def dim_sig(s):
    # signature de taille "8X8", "20X24" (ignore cm/virgules) pour matcher les pansements
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    m = re.search(r'(\d+)(?:[.,]\d+)?\s*(?:CM)?\s*X\s*(\d+)(?:[.,]\d+)?', s)
    return (m.group(1) + 'X' + m.group(2)) if m else ''


# index marque / marque+dimension -> metric (pour pansements ITP au nom très différent)
def bench_brand_index(byCip):
    txt = open('crm/benchmark-data.js', encoding='utf-8', errors='ignore').read()
    bd, br = {}, {}
    for o in re.findall(r'\{[^{}]*?\}', txt):
        mc = re.search(r'cip13:"([^"]*)"', o); md = re.search(r'designation:"([^"]*)"', o)
        if not mc or not md:
            continue
        v = byCip.get(mc.group(1), 0)
        if v <= 0:
            continue
        b = brand_name(md.group(1)); dm = dim_sig(md.group(1))
        if b and dm: bd[(b, dm)] = max(bd.get((b, dm), 0), v)
        if b: br[b] = max(br.get(b, 0), v)
    return bd, br


# index nom/racine -> nb de pharmacies qui commandent (via benchmark : nom -> cip13 -> sortie)
def bench_name_index(sortie):
    txt = open('crm/benchmark-data.js', encoding='utf-8', errors='ignore').read()
    objs = re.findall(r'\{[^{}]*?\}', txt)
    full, root = {}, {}
    for o in objs:
        if 'designation:' not in o:
            continue
        mc = re.search(r'cip13:"([^"]*)"', o); md = re.search(r'designation:"([^"]*)"', o)
        if not mc or not md:
            continue
        st = sortie.get(mc.group(1), 0)
        if st <= 0:
            continue
        k = norm_name(md.group(1))
        if k and st > full.get(k, 0): full[k] = st
        rk = root_name(md.group(1))
        if rk and len(rk) >= 4 and st > root.get(rk, 0): root[rk] = st
    return full, root


# index nom/racine -> {cip, prix le plus bas} pour retrouver CIP & prix par nom
def bench_pc_index():
    txt = open('crm/benchmark-data.js', encoding='utf-8', errors='ignore').read()
    objs = re.findall(r'\{[^{}]*?\}', txt)
    full, root = {}, {}
    for o in objs:
        if 'designation:' not in o:
            continue
        mc = re.search(r'cip13:"([^"]*)"', o); md = re.search(r'designation:"([^"]*)"', o)
        if not mc or not md:
            continue
        def n(k):
            mm = re.search(k + r':(-?[\d.]+)', o); return float(mm.group(1)) if mm else 0.0
        ip = n('prix_ip'); off = n('offre_ip')
        best = best_price(ip, off)
        rec = {'cip': mc.group(1), 'p': best}
        k = norm_name(md.group(1))
        if k and k not in full: full[k] = rec
        rk = root_name(md.group(1))
        if rk and len(rk) >= 4 and rk not in root: root[rk] = rec
    return full, root


# ── TOP ROTATIONS FRANCE : ce qui tourne le plus (qty), matché nom -> CIP/prix/sortie ──
def parse_rotations(SI):
    f = 'TOP rotations France 2025 (1).xlsx'
    if not os.path.exists(f):
        return []
    fullPC, rootPC = bench_pc_index()
    wb = openpyxl.load_workbook(f, read_only=True, data_only=True); ws = wb.active
    it = ws.iter_rows(values_only=True); next(it)
    rows = []
    for r in it:
        d = r[0]
        if not d:
            continue
        try: qty = int(r[2] or 0)
        except (TypeError, ValueError): qty = 0
        nm = str(d).strip()
        pc = fullPC.get(norm_name(nm)) or rootPC.get(root_name(nm)) or {}
        _v, st = sales_match(nm, pc.get('cip', ''), SI)
        # volume = quantité nationale du fichier rotations ; sortie = nb de nos pharmacies
        rows.append({'d': nm, 'cip': pc.get('cip', ''), 'p': pc.get('p'), 'vol': qty, 'sortie': st, 'total': SI['total']})
    rows.sort(key=lambda x: x['vol'], reverse=True)
    rows = rows[:120]
    return [{'cat': 'Top rotations France 2025 (par volume vendu)', 'rows': rows}]

MK = 'MARKETING'
INTEGRAL_PDF = os.path.join(MK, "L'integral.pdf")
ITP_PDF = os.path.join(MK, 'CATALOGUE ITP JUIN 2026 REPART2.pdf')
BENCH = 'crm/benchmark-data.js'
OUT = 'crm/v2/marketing-mix-data.js'


def pdftext(pdf, dst):
    subprocess.run(['pdftotext', '-layout', pdf, dst], check=False)
    return open(dst, encoding='utf-8', errors='ignore').read().splitlines()


def f(x):
    try: return round(float(str(x).replace(',', '.').replace(' ', '')), 2)
    except (TypeError, ValueError): return None


def best_price(ip, off):
    # offre valide seulement si remise <= 50% (au-delà = offre_ip aberrante)
    if off and off > 0 and ip and ip > 0 and off < ip and off >= ip * 0.5:
        return round(off, 2)
    return round(ip, 2) if ip and ip > 0 else None


# ── L'INTÉGRAL : parapharma par catégorie (cip, désignation, prix net HT) ──
def parse_integral():
    lines = pdftext(INTEGRAL_PDF, '/tmp/integral.txt')
    rx = re.compile(r'^\s*(\d{6,13})\s+(.+?)\s+([\d.,]+)\s*€')
    cats = []  # [(label, [rows])]
    cur = None
    for ln in lines:
        s = ln.strip(); up = s.upper()
        if s and not re.search(r'\d', s) and 4 < len(s) < 42 and re.match(r"^[A-ZÉÈÀÂÊÎÔÛÇ'&/\- ]+$", s) \
           and 'PRIX NET' not in up and 'PHARMAML' not in up and 'CATALOGUE' not in up and 'MARS' not in up:
            label = re.sub(r'^[\-\s]+', '', s).strip()
            if 'TEGRA' in up or label == 'L':   # reste de la couverture « L'INTÉGRAL »
                label = 'OPHTALMOLOGIE'
            cur = {'cat': label, 'rows': []}; cats.append(cur); continue
        m = rx.match(ln)
        if m and cur is not None:
            cur['rows'].append({'cip': m.group(1), 'd': m.group(2).strip(), 'p': f(m.group(3))})
    # 1ère catégorie réelle = ophtalmo (cover « L MARS » filtrée → produits orphelins avant 1ère cat)
    cats = [c for c in cats if c['rows']]
    return cats


# ── Index VENTES : volume + nb pharmacies, depuis les VRAIS noms vendus (PLVDESIGNATION) ──
# On indexe par CIP13, nom normalisé, racine, et marque+dimension → match large.
def load_sales_index():
    import glob as _g
    files = _g.glob('STATS/*_0[1-5]_2026.xlsx')
    byDesig = {}     # désignation vendue -> [vol, set(pharma)]
    byCip = {}       # cip13 -> [vol, set(pharma)]
    allph = set()
    for p in files:
        try:
            wb = openpyxl.load_workbook(p, read_only=True, data_only=True); ws = wb.active
            it = ws.iter_rows(values_only=True); h = next(it); hi = {n: i for i, n in enumerate(h)}
            di, qi, ti, ci = hi.get('PLVDESIGNATION'), hi.get('PLVQTE'), hi.get('TIRCODE'), hi.get('ARTCODEBARRE')
            for r in it:
                t = r[ti] if (ti is not None and ti < len(r)) else None
                if t is not None: allph.add(str(t))
                q = (r[qi] or 0) if (qi is not None and qi < len(r)) else 0
                d = r[di] if (di is not None and di < len(r)) else None
                if d:
                    e = byDesig.setdefault(str(d).strip(), [0, set()]); e[0] += q
                    if t is not None: e[1].add(str(t))
                cip = r[ci] if (ci is not None and ci < len(r)) else None
                if cip:
                    try: ck = str(int(float(cip)))
                    except (TypeError, ValueError): ck = str(cip)
                    e = byCip.setdefault(ck, [0, set()]); e[0] += q
                    if t is not None: e[1].add(str(t))
            wb.close()
        except Exception as ex:
            print('  [ventes] err', p, ex)
    total = len(allph)

    def mk(keyfn):
        idx = {}
        for d, (v, ph) in byDesig.items():
            k = keyfn(d)
            if not k: continue
            e = idx.setdefault(k, [0, set()]); e[0] += v; e[1] |= ph
        return idx
    full = mk(norm_name); root = mk(root_name)
    bd, br = {}, {}
    for d, (v, ph) in byDesig.items():
        b = brand_name(d); dm = dim_sig(d)
        if b and dm:
            e = bd.setdefault((b, dm), [0, set()]); e[0] += v; e[1] |= ph
        if b:
            e = br.setdefault(b, [0, set()]); e[0] += v; e[1] |= ph
    print('  [ventes] %d désignations vendues · %d CIP · %d officines' % (len(byDesig), len(byCip), total))
    return {'total': total, 'cip': byCip, 'full': full, 'root': root, 'bd': bd, 'br': br}


def sales_match(name, cip, SI):
    # CIP exact > nom exact > racine > marque+dim > marque. Renvoie (vol, sortie).
    for src, key in ((SI['cip'], str(cip)), (SI['full'], norm_name(name)), (SI['root'], root_name(name))):
        e = src.get(key)
        if e and e[0] > 0:
            return int(round(e[0])), len(e[1])
    b = brand_name(name); dm = dim_sig(name)
    e = SI['bd'].get((b, dm)) or (SI['br'].get(b) if b else None)
    if e and e[0] > 0:
        return int(round(e[0])), len(e[1])
    return 0, 0


# ── ITP : pansements / dispositifs (marge = PPHT - prix remisé) ──
def parse_itp():
    lines = pdftext(ITP_PDF, '/tmp/itp.txt')
    out = []; cur = 'Pansements & dispositifs'
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if re.match(r'^[A-ZÉÈ].{0,42}$', s) and any(k in s.upper() for k in ('PANSEMENT', 'COMPRESS', 'BANDE', 'SUTURE', 'CONTENTION')) and 'PPHT' not in s:
            cur = re.sub(r'\s+', ' ', s).replace('–', '-'); i += 1; continue
        m = re.search(r'PPHT\s*=\s*([\d.,]+)\s*€.*?LPPR\s*=\s*([\d.,]+)\s*€', lines[i])
        if m:
            name = re.sub(r'\s+', ' ', lines[i][:m.start()]).strip()
            ppht, lppr = f(m.group(1)), f(m.group(2))
            rem = pr = None; desc = ''
            for j in range(i + 1, min(i + 6, len(lines))):
                mr = re.search(r'Remise\s*([\d.,]+)\s*%', lines[j])
                mp = re.search(r'remis[ée]\s*:?\s*([\d.,]+)\s*€', lines[j])
                if mr: rem = f(mr.group(1))
                if mp: pr = f(mp.group(1))
                t = lines[j].strip()
                if t and not mr and not mp and 'EAN' not in t and 'Packaging' not in t and 'PPHT' not in t and not desc:
                    desc = re.sub(r'\s+', ' ', t)
            if name and ppht and pr:
                out.append({'cat': cur, 'd': (name + (' ' + desc if desc else '')).strip()[:70],
                            'ppht': ppht, 'lppr': lppr, 'remise': rem, 'p': pr,
                            'marge': round(ppht - pr, 2)})
        i += 1
    # regroupe par catégorie
    cats = []
    for p in out:
        c = next((x for x in cats if x['cat'] == p['cat']), None)
        if not c: c = {'cat': p['cat'], 'rows': []}; cats.append(c)
        c['rows'].append({k: p[k] for k in ('d', 'ppht', 'lppr', 'remise', 'p', 'marge')})
    return cats


# ── BEST-SELLERS : classés par NB DE PHARMACIES qui commandent (sortie réseau) ──
def parse_bestsellers():
    txt = open(BENCH, encoding='utf-8', errors='ignore').read()
    objs = re.findall(r'\{[^{}]*?\}', txt)
    def num(o, k):
        m = re.search(k + r':(-?[\d.]+)', o); return float(m.group(1)) if m else 0.0
    def sv(o, k):
        m = re.search(k + r':"([^"]*)"', o); return m.group(1) if m else ''
    FAMS = [('froid', 'Chaîne du froid'), ('biosim', 'Biosimilaires'),
            ('generiques', 'Génériques'), ('princeps', 'Princeps & spécialités')]
    buckets = {k: [] for k, _ in FAMS}
    for o in objs:
        if 'designation:' not in o: continue
        nat = sv(o, 'artnature')
        fam = 'froid' if 'is_froid:true' in o else ('biosim' if nat == 'biosimilaire' else ('generiques' if nat in ('generique', 'generique_partenaire') else 'princeps'))
        q = num(o, 'ip_qty')
        if q <= 0: continue
        ip = num(o, 'prix_ip'); off = num(o, 'offre_ip')
        best = best_price(ip, off)
        cip = sv(o, 'cip13')
        v, st = sales_match(sv(o, 'designation'), cip, SI)
        buckets[fam].append({'cip': cip, 'd': sv(o, 'designation'),
                             'p': best, 'q': int(q), 'vol': v, 'sortie': st, 'total': SI['total'],
                             'o': bool(off > 0 and ip > 0 and off < ip and off >= ip * 0.5)})
    cats = []
    for key, label in FAMS:
        # tri par volume vendu (puis nb pharmacies), top 15
        rows = sorted(buckets[key], key=lambda r: (r['vol'], r['sortie']), reverse=True)[:15]
        if rows: cats.append({'cat': label, 'rows': rows})
    return cats


SI = load_sales_index()
total = SI['total']

integral = parse_integral()
matched_i = 0
for c in integral:
    for r in c['rows']:
        r['vol'], r['sortie'] = sales_match(r['d'], r.get('cip'), SI)
        r['total'] = total
        if r['vol']:
            matched_i += 1
    c['rows'].sort(key=lambda r: (r['vol'], r['sortie']), reverse=True)   # tri par volume vendu
print('  [ventes] L\'Intégral : %d/%d produits rattachés à un volume' % (matched_i, sum(len(c['rows']) for c in integral)))

itp = parse_itp()
matched_t = 0
for c in itp:
    for r in c['rows']:
        r['vol'], r['sortie'] = sales_match(r['d'], '', SI)
        r['total'] = total
        if r['vol']:
            matched_t += 1
    c['rows'].sort(key=lambda r: (r['vol'], r['marge'] or 0), reverse=True)
print('  [ventes] ITP : %d/%d produits rattachés à un volume' % (matched_t, sum(len(c['rows']) for c in itp)))

print('  [match nom] L\'Intégral : %d produits rattachés à un volume' % matched_i)
rotations = parse_rotations(SI)
data = {
    'rotations': rotations,
    'integral': integral,
    'itp': itp,
    'bestsellers': parse_bestsellers(),
    'total': total,
}
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('// Mix marketing grossiste (L\'Intégral + ITP + best-sellers) — generate_marketing_mix.py\n')
    fh.write('window.MKT_MIX = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')

ni = sum(len(c['rows']) for c in data['integral'])
nt = sum(len(c['rows']) for c in data['itp'])
nb = sum(len(c['rows']) for c in data['bestsellers'])
print('OK ->', OUT)
print('  L\'Intégral : %d produits / %d catégories' % (ni, len(data['integral'])))
print('  ITP        : %d produits / %d catégories' % (nt, len(data['itp'])))
print('  Best-sellers: %d produits / %d familles' % (nb, len(data['bestsellers'])))

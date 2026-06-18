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
def parse_rotations(sortie, vol, total, fI, rI):
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
        st = sortie.get(pc.get('cip', ''), 0) or fI.get(norm_name(nm), 0) or rI.get(root_name(nm), 0)
        # volume = quantité nationale du fichier rotations
        rows.append({'d': nm, 'cip': pc.get('cip', ''), 'p': pc.get('p'), 'vol': qty, 'sortie': st, 'total': total})
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


# ── Sorties réelles : nb de pharmacies (de notre réseau) qui commandent chaque CIP ──
def load_sorties():
    src = 'crm/v2/wml-officines-data.js'
    t = open(src, encoding='utf-8', errors='ignore').read()
    mo = re.search(r'WML_OFFICINES\s*=\s*(\[.*?\]);\s*\nconst WML_SALES', t, re.S)
    ms = re.search(r'WML_SALES\s*=\s*(\[.*?\]);', t, re.S)
    total = len(json.loads(mo.group(1))) if mo else 0
    sortie, vol = {}, {}
    if ms:
        seen = {}
        for s in json.loads(ms.group(1)):
            # [pharmacyId, mois, comm, cip13, qte, puNet, mntNetHt]
            pid, cip, q = str(s[0]), str(s[3]), (s[4] or 0)
            seen.setdefault(cip, set()).add(pid)
            vol[cip] = vol.get(cip, 0) + q
        for cip, st in seen.items():
            sortie[cip] = len(st)
    print('  [sorties] %d CIP commandés · total %d officines' % (len(sortie), total))
    return sortie, vol, total


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
def parse_bestsellers(sortie, vol, total):
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
        buckets[fam].append({'cip': cip, 'd': sv(o, 'designation'),
                             'p': best, 'q': int(q), 'vol': vol.get(cip, 0),
                             'sortie': sortie.get(cip, 0), 'total': total,
                             'o': bool(off > 0 and ip > 0 and off < ip and off >= ip * 0.5)})
    cats = []
    for key, label in FAMS:
        # tri par volume vendu (puis nb pharmacies), top 15
        rows = sorted(buckets[key], key=lambda r: (r['vol'], r['sortie']), reverse=True)[:15]
        if rows: cats.append({'cat': label, 'rows': rows})
    return cats


sortie, vol, total = load_sorties()
fullIdx, rootIdx = bench_name_index(sortie)        # nom -> nb pharmacies
fullVol, rootVol = bench_name_index(vol)           # nom -> volume vendu (qté)


def attach_metric(name, cip, byCip, fIdx, rIdx):
    # priorité : CIP exact > nom normalisé exact > racine de marque
    return byCip.get(str(cip), 0) or fIdx.get(norm_name(name), 0) or rIdx.get(root_name(name), 0)


integral = parse_integral()
matched_i = 0
for c in integral:
    for r in c['rows']:
        r['sortie'] = attach_metric(r['d'], r.get('cip'), sortie, fullIdx, rootIdx)
        r['vol'] = attach_metric(r['d'], r.get('cip'), vol, fullVol, rootVol)
        r['total'] = total
        if r['vol']:
            matched_i += 1
    c['rows'].sort(key=lambda r: (r['vol'], r['sortie']), reverse=True)   # tri par volume vendu

itp = parse_itp()
for c in itp:
    for r in c['rows']:
        r['sortie'] = attach_metric(r['d'], '', sortie, fullIdx, rootIdx)
        r['vol'] = attach_metric(r['d'], '', vol, fullVol, rootVol)
        r['total'] = total
    c['rows'].sort(key=lambda r: (r['vol'], r['marge'] or 0), reverse=True)

print('  [match nom] L\'Intégral : %d produits rattachés à un volume' % matched_i)
rotations = parse_rotations(sortie, vol, total, fullIdx, rootIdx)
data = {
    'rotations': rotations,
    'integral': integral,
    'itp': itp,
    'bestsellers': parse_bestsellers(sortie, vol, total),
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

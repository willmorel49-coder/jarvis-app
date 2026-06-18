# -*- coding: utf-8 -*-
"""Passe de récupération robuste (mesoigner) pour le cluster pansements/DM et
quelques OTC ratés par les échecs réseau du run concurrent. Requête incluant les
dimensions, retries, matching STRICT (dosage / dimensions exactes / compte unique).
Repart de mkt-images-data.js, ne touche pas aux sources exactes. Python 3.9.
"""
import re, json, unicodedata, urllib.request, urllib.parse, time
from concurrent.futures import ThreadPoolExecutor

OUT = 'crm/v2/mkt-images-data.js'
SRC = 'crm/v2/marketing-mix-data.js'
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'}
MESO = 'https://www.apothical.fr/medicaments-parapharmacie/produits/page/1/recherche/'

cur = json.loads(re.search(r'window\.MKT_IMG\s*=\s*(\{.*\});', open(OUT, encoding='utf-8').read(), re.S).group(1))
data = json.loads(re.search(r'window\.MKT_MIX\s*=\s*(\{.*\});', open(SRC, encoding='utf-8').read(), re.S).group(1))
cat = {}
for sec in ('nr', 'integral', 'itp', 'rotations', 'bestsellers'):
    for c in data.get(sec, []):
        for r in c.get('rows', []):
            cip = str(r.get('cip') or '')
            if re.fullmatch(r'\d{8,14}', cip):
                cat.setdefault(cip, r.get('d') or '')
# purge mesoigner pour reconstruire proprement (sources exactes EAN/CIP conservées)
before = len(cur)
cur = {k: v for k, v in cur.items() if 'mesoigner' not in v}
print('purge mesoigner : %d -> %d' % (before, len(cur)))
missing = [e for e in cat if e not in cur]
print('%d manquants' % len(missing))

COLORS = {'rouge', 'rouges', 'blanc', 'blanche', 'vert', 'verte', 'bleu', 'bleue',
          'jaune', 'noir', 'noire', 'rose', 'dore', 'doree', 'transparent'}


def toks(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower().replace('-', ' ')
    return re.findall(r'[a-z]+|\d+', s)


def dosages(d):
    vals = set()
    for grp, _u in re.findall(r'((?:\d+(?:[.,]\d+)?)(?:\s*/\s*\d+(?:[.,]\d+)?)+)\s*(mg|mcg|ug|g|ui|%)', d, re.I):
        for n in re.split(r'\s*/\s*', grp):
            vals.add(float(n.replace(',', '.')))
    for n, _u in re.findall(r'(\d+(?:[.,]\d+)?)\s*(mg|mcg|ug|g|ui|%)', d, re.I):
        vals.add(float(n.replace(',', '.')))
    return vals


def slug_doses(slug):
    out = set()
    for g in re.findall(r'\d+(?:-\d+)?', slug):
        if '-' in g:
            a, b = g.split('-', 1)
            try:
                out.add(float(a + '.' + b))
            except ValueError:
                pass
        else:
            out.add(float(g))
    return out


def dim_sig(s):
    s = s.lower().replace('-', ' ')
    pairs = re.findall(r'(\d+)\s*[x×]\s*(\d+)', s)
    if pairs:
        out = []
        for a, b in pairs:
            out += [int(a), int(b)]
        return sorted(out)
    return sorted(int(n) for n in re.findall(r'(\d+)\s*cm', s))


def ints(s):
    return set(int(x) for x in re.findall(r'\d+', s))


def query(d):
    t = toks(d)
    if not t:
        return ''
    brand = t[0]
    low = d.lower()
    pairs = re.findall(r'(\d+)\s*[x×]\s*(\d+)', low)
    if pairs:
        return '%s %s %s' % (brand, pairs[0][0], pairs[0][1])
    cm = re.findall(r'(\d+)\s*cm', low)
    if len(cm) >= 2:
        return '%s %s %s' % (brand, cm[0], cm[1])
    extra = next((x for x in t[1:] if x.isalpha() and len(x) >= 4), '')
    num = next((x for x in t[1:] if x.isdigit()), '')
    return ' '.join(p for p in (brand, extra, num) if p).strip()


def slug_of(u):
    m = re.search(r'/([^/]+)\.(?:webp|jpg|jpeg|png)$', u)
    return m.group(1) if m else ''


def fetch(q):
    for _ in range(3):
        try:
            req = urllib.request.Request(MESO + urllib.parse.quote(q), headers=UA)
            with urllib.request.urlopen(req, timeout=20) as r:
                html = r.read().decode('utf-8', 'ignore')
            seen, cands = set(), []
            for m in re.finditer(r'https://cdn\.pim\.mesoigner\.fr/[^\s"\']+\.(?:webp|jpg|jpeg|png)', html):
                u = m.group(0)
                if 'placeholder' in u or u in seen:
                    continue
                seen.add(u); cands.append(u)
            return cands
        except Exception:
            time.sleep(0.6)
    return []


def match(cip):
    desig = cat[cip]
    t = toks(desig)
    if not t:
        return cip, None
    brand = t[0]
    if len(brand) < 5:
        return cip, None
    cands = fetch(query(desig))
    dd = dosages(desig); ds = dim_sig(desig); dn = ints(desig)
    extras = set(x for x in t[1:] if x.isalpha() and len(x) >= 4)
    strong, weak = [], []
    dcolor = COLORS & set(t)
    for u in cands:
        slug = slug_of(u); st = set(toks(slug))
        if brand not in st:
            continue
        if dcolor and not (dcolor <= st):     # couleur (rouge/blanc...) doit matcher
            continue
        if dd:
            if dd <= slug_doses(slug):
                strong.append(u)
        elif ds:
            if ds == dim_sig(slug):
                strong.append(u)
        elif dn and dn <= ints(slug) and (extras & st):
            weak.append(u)
    if strong:
        return cip, strong[0]
    if len(weak) == 1:               # compte : seulement si NON ambigu
        return cip, weak[0]
    return cip, None


added = 0
with ThreadPoolExecutor(max_workers=4) as ex:
    for cip, img in ex.map(match, missing):
        if img:
            cur[cip] = img; added += 1
print('+%d photos récupérées' % added)

with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('// Photos produit (Offilog/Cap3000/Drakkars/pharma-gdd/mesoigner, match strict) par CIP — generate_mkt_images.py\n')
    fh.write('window.MKT_IMG = ' + json.dumps(cur, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('OK -> %s : %d photos / %d codes (%.0f%%)' % (OUT, len(cur), len(cat), 100.0 * len(cur) / max(1, len(cat))))

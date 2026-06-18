# -*- coding: utf-8 -*-
"""Photos produit du catalogue marketing, packshots homogènes, EAN/nom STRICTS
(zéro photo fausse). Sources, dans l'ordre de priorité :
  1. Offilog / Offilog Live (par EAN, HD)
  2. Cap3000 / Drakkars (par EAN, og:image HD)
  3. mesoigner (apothical) — médicaments & para OTC, par NOM avec vérification
     marque (≥5 lettres) + DOSAGE EXACT obligatoire, sinon rejeté.
→ crm/v2/mkt-images-data.js  (window.MKT_IMG = {cip: url})
Python 3.9.
"""
import re
import json
import unicodedata
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

OUT = 'crm/v2/mkt-images-data.js'
SRC = 'crm/v2/marketing-mix-data.js'
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'}
MESO = 'https://www.apothical.fr/medicaments-parapharmacie/produits/page/1/recherche/'


def upsize(u):
    return re.sub(r'-(home|cart|small|medium)_default', '-large_default', u or '')


# ── 1) Banques Offilog : EAN -> packshot HD ──
ean_img = {}
for path, eanrx, imgrx in [
    ('crm/offilog-data.js',       r'ean:"(\d{8,14})"',          r'img:"(https?://[^"]+)"'),
    ('opso/offilog-live-data.js', r'ean:[\'"](\d{8,14})[\'"]',  r'img:[\'"](https?://[^\'"]+)'),
]:
    try:
        txt = open(path, encoding='utf-8').read()
    except OSError:
        continue
    for m in re.finditer(r'\{[^{}]*\}', txt):
        b = m.group(0); e = re.search(eanrx, b); i = re.search(imgrx, b)
        if e and i and e.group(1):
            ean_img[e.group(1)] = upsize(i.group(1))
print('1. Offilog : %d EAN -> photo' % len(ean_img))

# ── catalogue : EAN + désignation ──
data = json.loads(re.search(r'window\.MKT_MIX\s*=\s*(\{.*\});',
                            open(SRC, encoding='utf-8').read(), re.S).group(1))
cat = {}  # cip -> designation
for sec in ('nr', 'integral', 'itp', 'rotations', 'bestsellers'):
    for c in data.get(sec, []):
        for r in c.get('rows', []):
            cip = str(r.get('cip') or '')
            if re.fullmatch(r'\d{8,14}', cip):
                cat.setdefault(cip, r.get('d') or '')
cat_eans = sorted(cat)


# ── 2) Cap3000 / Drakkars : og:image par EAN ──
def ean_url(path):
    d = {}
    try:
        t = open(path, encoding='utf-8').read()
    except OSError:
        return d
    for m in re.finditer(r'\{[^{}]*\}', t):
        b = m.group(0); e = re.search(r'ean:"(\d{8,14})"', b); u = re.search(r'url:"(https?://[^"]+)"', b)
        if e and u and e.group(1):
            d.setdefault(e.group(1), u.group(1))
    return d

cap = ean_url('crm/cap3000-data.js'); dra = ean_url('crm/drakkars-data.js')


def og_image(url):
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode('utf-8', 'ignore')
        m = re.search(r'og:image"?\s+content="([^"]+)"', html)
        return m.group(1) if m else None
    except Exception:
        return None

stage2 = [(e, cap.get(e) or dra.get(e)) for e in cat_eans if e not in ean_img and (e in cap or e in dra)]
added2 = 0
with ThreadPoolExecutor(max_workers=6) as ex:
    for e, img in ex.map(lambda t: (t[0], og_image(t[1])), stage2):
        if img:
            ean_img[e] = upsize(img); added2 += 1
print('2. Cap3000/Drakkars : +%d photos' % added2)


# ── 3) pharma-gdd : recherche par CIP -> REDIRECTION vers la fiche EXACTE ──
# La recherche par CIP redirige vers la fiche produit quand le CIP matche (= exact).
# Sinon elle reste sur /search (résultats) => on rejette. pharma-gdd bloque le
# scraping en rafale : faible concurrence + délai.
import time

def pharmagdd(cip):
    time.sleep(0.5)
    try:
        req = urllib.request.Request('https://www.pharma-gdd.com/fr/search?q=' + cip, headers=UA)
        r = urllib.request.urlopen(req, timeout=16)
        final = r.geturl(); html = r.read().decode('utf-8', 'ignore')
    except Exception:
        return None
    if '/search' in final or final.rstrip('/').endswith('/fr'):   # pas de fiche exacte
        return None
    m = re.search(r'og:image"?\s+content="([^"]+)"', html)
    if not m:
        return None
    img = m.group(1)
    if 'cdn.pharma-gdd.com' not in img or 'brand_show' in img:
        return None
    return img

stage_gdd = [e for e in cat_eans if e not in ean_img]
print('3. pharma-gdd : %d CIP à chercher (redirection = fiche exacte)…' % len(stage_gdd))
addedg = 0
with ThreadPoolExecutor(max_workers=2) as ex:
    for e, img in ex.map(lambda e: (e, pharmagdd(e)), stage_gdd):
        if img:
            ean_img[e] = img; addedg += 1
print('   +%d photos' % addedg)


# ── 4) mesoigner (médicaments & para OTC), nom + vérif marque & dosage ──
def toks(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower().replace('-', ' ')
    return re.findall(r'[a-z]+|\d+', s)


def dosage(d):
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(mg|mcg|ug|g|ml|l|ui|%)', d, re.I)
    return float(m.group(1).replace(',', '.')) if m else None


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


def query(d):
    t = toks(d)
    if not t:
        return ''
    num = next((x for x in t[1:] if x.isdigit()), '')
    return (t[0] + ' ' + num).strip()


def slug_of(u):
    m = re.search(r'/([^/]+)\.(?:webp|jpg|jpeg|png)$', u)
    return m.group(1) if m else ''


def accept(desig, slug, n):
    t = toks(desig)
    if not t:
        return False
    b = t[0]
    if len(b) < 5 or b not in set(toks(slug)):
        return False
    dose = dosage(desig)
    if dose is not None:
        return dose in slug_doses(slug)
    return n == 1


def meso(desig):
    q = query(desig)
    if not q:
        return None
    try:
        req = urllib.request.Request(MESO + urllib.parse.quote(q), headers=UA)
        with urllib.request.urlopen(req, timeout=18) as r:
            html = r.read().decode('utf-8', 'ignore')
    except Exception:
        return None
    seen, cands = set(), []
    for m in re.finditer(r'https://cdn\.pim\.mesoigner\.fr/[^\s"\']+\.(?:webp|jpg|jpeg|png)', html):
        u = m.group(0)
        if 'placeholder' in u or u in seen:
            continue
        seen.add(u); cands.append(u)
    n = len(cands)
    for u in cands:
        if accept(desig, slug_of(u), n):
            return u
    return None

stage3 = [e for e in cat_eans if e not in ean_img]
print('4. mesoigner : %d produits à chercher par nom…' % len(stage3))
added3 = 0
with ThreadPoolExecutor(max_workers=6) as ex:
    for e, img in ex.map(lambda e: (e, meso(cat[e])), stage3):
        if img:
            ean_img[e] = img; added3 += 1
print('   +%d photos' % added3)

# ── Sortie ──
found = {e: ean_img[e] for e in cat_eans if e in ean_img}
with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('// Photos produit (Offilog/Cap3000/Drakkars/mesoigner, match strict) par CIP — generate_mkt_images.py\n')
    fh.write('window.MKT_IMG = ' + json.dumps(found, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('OK -> %s : %d photos / %d codes (%.0f%%)' % (OUT, len(found), len(cat_eans), 100.0 * len(found) / max(1, len(cat_eans))))

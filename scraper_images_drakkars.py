#!/usr/bin/env python3
"""
Scrape og:image depuis toutes les pages produit Drakkars.
Input  : benchmark_drakkars.xlsx
Output : images_drakkars.json  {ean: url, nom_norm: url}
"""
import re, json, time, unicodedata, openpyxl, requests
from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime

BASE  = Path(__file__).parent
XLSX  = BASE / 'benchmark_drakkars.xlsx'
OUT   = BASE / 'images_drakkars.json'
DELAY = 0.35
UA    = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

def norm(text):
    if not text: return ''
    text = str(text).lower().strip()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

def get_og_image(session, url):
    try:
        r = session.get(url, timeout=12)
        if r.status_code != 200: return None
        soup = BeautifulSoup(r.text, 'html.parser')
        og = soup.find('meta', property='og:image')
        return og.get('content') if og else None
    except Exception:
        return None

print('=' * 60)
print('SCRAPER IMAGES DRAKKARS')
print(f'Démarré le {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
print('=' * 60)

wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
wb.close()
hdr = rows[0]
col = {str(n): i for i, n in enumerate(hdr) if n}
print(f'  {len(rows)-1} produits à scraper')

# Load existing to resume
existing = {}
if OUT.exists():
    with open(OUT) as f:
        existing = json.load(f)
    print(f'  → Reprise : {len(existing)} images déjà collectées')

s = requests.Session()
s.headers.update({'User-Agent': UA})

result = dict(existing)
done = 0
skipped = 0
errors = 0
checkpoint = 200

for i, row in enumerate(rows[1:], 1):
    ean_raw = row[col.get('EAN', -1)] if col.get('EAN') is not None else None
    ean = ''
    if ean_raw is not None:
        ean = str(int(ean_raw)) if isinstance(ean_raw, float) else str(ean_raw).strip()
        if not (ean.isdigit() and len(ean) >= 8): ean = ''

    nom_n = norm(str(row[col.get('Nom normalisé', col.get('Nom', 0))] or ''))
    url   = row[col.get('URL', -1)] if col.get('URL') is not None else None
    if not url: continue

    # Skip if already have by EAN or nom
    if (ean and ean in result) or (nom_n and nom_n in result):
        skipped += 1
        continue

    time.sleep(DELAY)
    img = get_og_image(s, url)

    if img:
        if ean: result[ean] = img
        if nom_n: result[nom_n] = img
        done += 1
    else:
        errors += 1

    if i % 50 == 0:
        pct = i / (len(rows)-1) * 100
        print(f'  [{i}/{len(rows)-1}] {pct:.0f}% — {done} images — {errors} erreurs — {skipped} passés')

    if i % checkpoint == 0:
        with open(OUT, 'w') as f:
            json.dump(result, f, ensure_ascii=False)
        print(f'  ✓ Checkpoint sauvegardé : {len(result)} entrées')

with open(OUT, 'w') as f:
    json.dump(result, f, ensure_ascii=False)

print(f'\n✓ TERMINÉ — {len(result)} images — {done} nouvelles — {errors} erreurs')
print(f'  Fichier : {OUT}')

#!/usr/bin/env python3
"""
Consolide toutes les sources d'images en un seul lookup EAN/nom → img URL.
Sources (par priorité décroissante) :
  1. Offilog Live   (offilog_live.json)
  2. Bestsellers    (bestsellers_offilog.json)
  3. Drakkars       (images_drakkars.json)
  4. Cap3000        (images_cap3000.json)
Output : images_by_ean.json
"""
import json, re, unicodedata
from pathlib import Path
from datetime import datetime

BASE = Path(__file__).parent

def norm(text):
    if not text: return ''
    text = str(text).lower().strip()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

master = {}   # EAN str → img URL
master_norm = {}  # nom_norm → img URL

def merge_json_catalog(path, label):
    """Merge depuis un fichier JSON avec products[] ayant ean, nom, img."""
    if not path.exists():
        print(f'  ⚠ {label} non trouvé : {path}')
        return 0
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    prods = data.get('products', [])
    added = 0
    for p in prods:
        img = p.get('img') or ''
        if not img: continue
        ean = str(p.get('ean') or '').strip()
        nom_n = norm(str(p.get('nom') or ''))
        if ean and ean not in master:
            master[ean] = img
            added += 1
        if nom_n and nom_n not in master_norm:
            master_norm[nom_n] = img
    print(f'  ✓ {label} : {added} EANs ajoutés ({len(prods)} produits source)')
    return added

def merge_flat_dict(path, label):
    """Merge depuis un dict plat EAN/nom→img."""
    if not path.exists():
        print(f'  ⚠ {label} non trouvé : {path}')
        return 0
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    added = 0
    for k, img in data.items():
        if not img: continue
        if k.isdigit() and len(k) >= 8:
            if k not in master:
                master[k] = img
                added += 1
        else:
            if k not in master_norm:
                master_norm[k] = img
    print(f'  ✓ {label} : {added} entrées ajoutées ({len(data)} total source)')
    return added

print('=' * 60)
print('CONSOLIDATION DES IMAGES')
print(f'Lancé le {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
print('=' * 60)

# Ordre de priorité : Offilog en premier (source primaire du distributeur)
merge_json_catalog(BASE / 'offilog_live.json',        'Offilog Live')
merge_json_catalog(BASE / 'bestsellers_offilog.json', 'Bestsellers Offilog')
merge_flat_dict   (BASE / 'images_drakkars.json',     'Drakkars')
merge_flat_dict   (BASE / 'images_cap3000.json',      'Cap3000')

out = {
    'meta': {
        'generated': datetime.now().isoformat(),
        'total_ean':  len(master),
        'total_norm': len(master_norm),
    },
    'by_ean':  master,
    'by_norm': master_norm,
}

OUT = BASE / 'images_by_ean.json'
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False)

sz = OUT.stat().st_size / 1024
print(f'\n✓ images_by_ean.json → {len(master)} EANs · {len(master_norm)} noms normalisés ({sz:.0f} KB)')

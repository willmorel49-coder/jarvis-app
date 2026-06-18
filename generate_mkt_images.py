# -*- coding: utf-8 -*-
"""Récupère les photos produit (packshot) via les API Open*Facts (gratuit, sans clé)
pour tous les codes-barres du catalogue marketing. Aucune image inventée :
on ne garde qu'une vraie photo renvoyée par l'API.
→ crm/v2/mkt-images-data.js  (window.MKT_IMG = {cip: url})
Python 3.9.
"""
import re
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

SRC = 'crm/v2/marketing-mix-data.js'
OUT = 'crm/v2/mkt-images-data.js'
HOSTS = ['world.openfoodfacts.org', 'world.openbeautyfacts.org', 'world.openproductsfacts.org']
UA = {'User-Agent': 'jarvis-integral-pharma/1.0 (catalogue marketing)'}

# ── codes-barres uniques du catalogue ──
data = json.loads(re.search(r'window\.MKT_MIX\s*=\s*(\{.*\});',
                            open(SRC, encoding='utf-8').read(), re.S).group(1))
codes = set()
for sec in ('nr', 'integral', 'itp', 'rotations', 'bestsellers'):
    for c in data.get(sec, []):
        for r in c.get('rows', []):
            cip = str(r.get('cip') or '')
            if re.fullmatch(r'\d{8,14}', cip):
                codes.add(cip)
codes = sorted(codes)
print('%d codes-barres à interroger' % len(codes))


def fetch(cip):
    for host in HOSTS:
        url = 'https://%s/api/v2/product/%s.json?fields=image_front_url' % (host, cip)
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=12) as resp:
                j = json.loads(resp.read().decode('utf-8', 'ignore'))
            img = (j.get('product') or {}).get('image_front_url')
            if img:
                return cip, img
        except Exception:
            pass
        time.sleep(0.05)
    return cip, None


found = {}
done = 0
with ThreadPoolExecutor(max_workers=8) as ex:
    for cip, img in ex.map(fetch, codes):
        done += 1
        if img:
            found[cip] = img
        if done % 100 == 0:
            print('  %d/%d · %d photos' % (done, len(codes), len(found)))

with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('// Photos produit (Open*Facts, gratuit) par CIP — generate_mkt_images.py\n')
    fh.write('window.MKT_IMG = ' + json.dumps(found, ensure_ascii=False, separators=(',', ':')) + ';\n')

print('OK -> %s : %d photos / %d codes (%.0f%%)' % (OUT, len(found), len(codes), 100.0 * len(found) / max(1, len(codes))))

# -*- coding: utf-8 -*-
"""Photos produit pour le catalogue marketing, tirées de NOS banques déjà scrapées
(Offilog / Offilog Live = packshots offilog.fr homogènes), par correspondance EAN
STRICTE (zéro photo fausse, qualité homogène).
→ crm/v2/mkt-images-data.js  (window.MKT_IMG = {cip: url})
Python 3.9.
"""
import re
import json

OUT = 'crm/v2/mkt-images-data.js'
SRC = 'crm/v2/marketing-mix-data.js'

# Banques d'images maison (EAN -> URL packshot). Ordre = priorité croissante
# (la dernière écrase : Offilog Live, le plus récent/complet, gagne).
BANKS = [
    ('crm/offilog-data.js',          r'ean:"(\d{8,14})"',               r'img:"(https?://[^"]+)"'),
    ('opso/offilog-live-data.js',    r'ean:[\'"](\d{8,14})[\'"]',       r'img:[\'"](https?://[^\'"]+)'),
]

ean_img = {}
for path, eanrx, imgrx in BANKS:
    n0 = len(ean_img)
    try:
        txt = open(path, encoding='utf-8').read()
    except OSError:
        print('  ! introuvable :', path); continue
    for m in re.finditer(r'\{[^{}]*\}', txt):
        b = m.group(0)
        e = re.search(eanrx, b); i = re.search(imgrx, b)
        if e and i and e.group(1):
            ean_img[e.group(1)] = i.group(1)
    print('  %-32s +%d (total %d)' % (path, len(ean_img) - n0, len(ean_img)))

# Codes-barres du catalogue -> photo si on l'a, par EAN exact
data = json.loads(re.search(r'window\.MKT_MIX\s*=\s*(\{.*\});',
                            open(SRC, encoding='utf-8').read(), re.S).group(1))
found = {}
total = 0
for sec in ('nr', 'integral', 'itp', 'rotations', 'bestsellers'):
    for c in data.get(sec, []):
        for r in c.get('rows', []):
            cip = str(r.get('cip') or '')
            if not re.fullmatch(r'\d{8,14}', cip):
                continue
            total += 1
            if cip in ean_img:
                found[cip] = ean_img[cip]

with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('// Photos produit (packshots Offilog, match EAN strict) par CIP — generate_mkt_images.py\n')
    fh.write('window.MKT_IMG = ' + json.dumps(found, ensure_ascii=False, separators=(',', ':')) + ';\n')

print('OK -> %s : %d photos / %d codes (%.0f%%)' % (OUT, len(found), total, 100.0 * len(found) / max(1, total)))

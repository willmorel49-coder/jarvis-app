# -*- coding: utf-8 -*-
"""Les images offilog.fr bloquent tout proxy (anti-hotlink) et n'ont pas de CORS
-> impossibles à embarquer dans le PDF (canvas taint). Solution : on les télécharge
en LOCAL (crm/v2/pimg/<cip>.jpg), servies en même origine = PDF-safe, sans proxy.
Réécrit les entrées offilog de mkt-images-data.js en chemins relatifs. Python 3.9.
"""
import re, json, os, urllib.request

F = 'crm/v2/mkt-images-data.js'
DIR = 'crm/v2/pimg'
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'}
os.makedirs(DIR, exist_ok=True)

d = json.loads(re.search(r'window\.MKT_IMG\s*=\s*(\{.*\});', open(F, encoding='utf-8').read(), re.S).group(1))
off = {c: u for c, u in d.items() if 'offilog.fr' in u}
print('%d images offilog à héberger en local' % len(off))

ok = 0
for cip, url in off.items():
    small = url.replace('-large_default', '-home_default')   # variante plus légère
    dest = os.path.join(DIR, cip + '.jpg')
    try:
        req = urllib.request.Request(small, headers=UA)
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read()
        if len(data) < 500:
            raise ValueError('trop petit')
        with open(dest, 'wb') as fh:
            fh.write(data)
        d[cip] = 'pimg/' + cip + '.jpg'           # chemin relatif, même origine
        ok += 1
    except Exception as e:
        print('  ! échec', cip, str(e)[:40])

with open(F, 'w', encoding='utf-8') as fh:
    fh.write('// Photos produit (pharma-gdd/mesoigner/cap3000/drakkars + offilog local pimg/) par CIP\n')
    fh.write('window.MKT_IMG = ' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('OK : %d/%d offilog hébergées en local -> %s/' % (ok, len(off), DIR))
print('total photos:', len(d))

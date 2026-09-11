#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Télécharge les vignettes (cart_default ~2 Ko) des meilleures ventes Offilog,
et écrit UN JPEG PAR PRODUIT : crm/v2/oimg/<id>.jpg
→ lu à la demande par V2.offilogImgs (v2-boot.js), pour les produits du
  document en cours seulement. Même origine, donc affichable dans le PDF.
  (11/09/2026 : remplace le fichier unique offilog-img-data.js de 33 Mo.)
"""
import re, json, os, ssl, time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

SRC = "/Users/williammorel/JARVIS/APP/crm/v2/offilog-bestsellers-data.js"
OUT = "/Users/williammorel/JARVIS/APP/crm/v2/oimg"
ctx = ssl.create_default_context()
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"}

txt = open(SRC, encoding="utf-8").read()
arr = json.loads(re.search(r'const OFFILOG_BEST = (\[.*?\]);', txt, re.S).group(1))
jobs = [(str(x["id"]), x["img"]) for x in arr if x.get("img")]
print("à télécharger:", len(jobs), flush=True)

def thumb_url(u):
    # variante légère cart_default (~2 Ko)
    return re.sub(r'-(large|home|medium|small)_default/', '-cart_default/', u)

def fetch(job):
    pid, url = job
    u = thumb_url(url)
    for _ in range(2):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=15, context=ctx)
            b = r.read()
            if b and len(b) < 60000 and b[:3] == b"\xff\xd8\xff":   # un vrai JPEG seulement
                return pid, b
            return pid, None
        except Exception:
            time.sleep(0.4)
    return pid, None

out = {}
done = 0
t = time.time()
with ThreadPoolExecutor(max_workers=8) as ex:
    for pid, data in ex.map(fetch, jobs):
        done += 1
        if data:
            out[pid] = data
        if done % 500 == 0:
            print(f"  {done}/{len(jobs)} · {len(out)} ok · {time.time()-t:.0f}s", flush=True)

os.makedirs(OUT, exist_ok=True)
for pid, b in out.items():
    with open(os.path.join(OUT, pid + ".jpg"), "wb") as f:
        f.write(b)

tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print("OK ->", OUT, "({:.1f} Mo, {} images)".format(tot/1024/1024, len(out)), flush=True)

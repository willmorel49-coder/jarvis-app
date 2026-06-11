#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Télécharge les vignettes (cart_default ~2 Ko) des meilleures ventes Offilog,
les encode en base64 dans UN seul fichier : crm/v2/offilog-img-data.js
  const OFFILOG_IMG = { "<id>": "data:image/jpeg;base64,..." }
→ images même origine, donc affichables dans le PDF marketing (html2canvas).
"""
import re, json, base64, ssl, time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

SRC = "/Users/williammorel/JARVIS/APP/crm/v2/offilog-bestsellers-data.js"
OUT = "/Users/williammorel/JARVIS/APP/crm/v2/offilog-img-data.js"
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
            if b and len(b) < 60000:
                return pid, "data:image/jpeg;base64," + base64.b64encode(b).decode("ascii")
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

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Offilog — vignettes produits (base64, cart_default) pour PDF marketing\n")
    f.write("// {} images · clé = id produit\n".format(len(out)))
    f.write("const OFFILOG_IMG = " + json.dumps(out, ensure_ascii=False) + ";\n")
    f.write("try{window.OFFILOG_IMG=OFFILOG_IMG;}catch(e){}\n")

import os
print("OK ->", OUT, "({:.1f} Mo, {} images)".format(os.path.getsize(OUT)/1024/1024, len(out)), flush=True)

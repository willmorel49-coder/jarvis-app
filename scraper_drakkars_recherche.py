#!/usr/bin/env python3
"""Rattrapage par la recherche du site (Doofinder, public) des EAN Offilog sans prix Drakkars.

Règle PRUDENTE : le champ `references` d'un résultat liste les codes de TOUT le groupe
(toutes contenances) → un EAN trouvé dans un groupe à plusieurs variantes est AMBIGU et
écarté. On ne garde que le cas où un seul résultat porte l'EAN : un produit sans variante.
entrée : eans-a-chercher.txt · sortie incrémentale : doofinder.jsonl
"""
import json, sys, time, urllib.request, urllib.parse
from pathlib import Path

DIR = Path(__file__).parent
IN = DIR / (sys.argv[1] if len(sys.argv) > 1 else "eans-a-chercher.txt")
OUT = DIR / (sys.argv[2] if len(sys.argv) > 2 else "doofinder.jsonl")
URL = "https://eu1-search.doofinder.com/5/search?hashid=e01a3f678793d0047e4464ff164f3dd2&rpp=20&query="
HDR = {"Origin": "https://www.pharmaciedesdrakkars.com", "Referer": "https://www.pharmaciedesdrakkars.com/",
       "User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15"}


def search(ean):
    for essai in range(3):
        try:
            req = urllib.request.Request(URL + urllib.parse.quote(ean), headers=HDR)
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.load(r)
        except Exception:
            time.sleep(3 * (essai + 1))
    return None


done = set()
if OUT.exists():
    for l in OUT.open():
        try: done.add(json.loads(l)["ean"])
        except Exception: pass
eans = [e.strip() for e in IN.read_text().split() if e.strip() and e.strip() not in done]
print(len(eans), "EAN à chercher", flush=True)
for i, ean in enumerate(eans, 1):
    d = search(ean)
    rec = {"ean": ean, "ok": d is not None, "hits": []}
    if d:
        for r in d.get("results", []):
            refs = str(r.get("references", "")).split()
            if ean in refs:
                rec["hits"].append({"title": r.get("title"), "price": r.get("price"), "group": r.get("group_id"),
                                    "id": r.get("id"), "link": r.get("link"), "nrefs": len(refs),
                                    "dispo": r.get("availability")})
    with OUT.open("a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    if i % 200 == 0:
        print(i, flush=True)
    time.sleep(0.35)
print("FINI", flush=True)

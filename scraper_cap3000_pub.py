#!/usr/bin/env python3
"""Relevé des prix PUBLICS de Pharmacie Cap 3000, limité aux EAN du catalogue Offilog.

robots.txt lu le 29/10/2026 : seules les pages de recherche, de compte, de panier et
les paramètres de tri sont interdits ; les fiches produit sont autorisées. On ne visite
donc QUE les fiches déjà connues (adresses de crm/cap3000-data.js) — jamais la
recherche — à raison d'une fiche toutes les 1,5 s, sans contourner aucune protection.

  python3 scraper_cap3000_pub.py <sortie.jsonl>     (reprend là où il s'est arrêté)
Une ligne par fiche : {ean, url, http, prix, dispo}. Le relevé est ensuite traité par
scripts/generate_plateformes_pub.py.
"""
import json, re, sys, time, os
import requests

ROOT = os.path.dirname(os.path.abspath(__file__))
HDR = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
       "Accept-Language": "fr-FR,fr;q=0.9"}
DELAY = 1.5

def ean13(v):
    s = re.sub(r"\D", "", str(v or ""))
    if len(s) == 12: s = "0" + s
    return s if len(s) == 13 else ""

def offilog_eans():
    out = set()
    for f, rx in (("crm/v2/offilog-bestsellers-data.js", r'"ean":\s*"(\d{12,13})"'),
                  ("opso/offilog-live-data.js", r"ean:'(\d{12,13})'")):
        out |= {ean13(m) for m in re.findall(rx, open(os.path.join(ROOT, f), encoding="utf8").read())}
    out.discard("")
    return out

def fiches():
    src = open(os.path.join(ROOT, "crm/cap3000-data.js"), encoding="utf8").read()
    cible = offilog_eans()
    res, vus = [], set()
    for m in re.finditer(r'ean:"(\d{12,13})".*?url:"([^"]+)"', src):
        e = ean13(m.group(1))
        if e in cible and e not in vus:
            vus.add(e); res.append((e, m.group(2)))
    return res

def lire(html):
    p = re.search(r'id="our_price_display"[^>]*content="([\d.]+)"', html)
    d = re.search(r'itemprop="availability"\s+href="http://schema.org/(\w+)"', html)
    return (round(float(p.group(1)), 2) if p else None), (d.group(1) if d else None)

def main():
    sortie = sys.argv[1]
    deja = set()
    if os.path.exists(sortie):
        for l in open(sortie, encoding="utf8"):
            if l.strip(): deja.add(json.loads(l)["ean"])
    liste = [f for f in fiches() if f[0] not in deja]
    print(len(liste), "fiches à relever,", len(deja), "déjà faites", flush=True)
    s = requests.Session(); s.headers.update(HDR)
    with open(sortie, "a", encoding="utf8") as out:
        for i, (e, u) in enumerate(liste):
            rec = {"ean": e, "url": u, "http": None, "prix": None, "dispo": None}
            for essai in range(3):
                try:
                    r = s.get(u, timeout=25)
                    rec["http"] = r.status_code
                    if r.status_code == 200:
                        rec["prix"], rec["dispo"] = lire(r.text)
                    if r.status_code in (403, 429):
                        print("BLOCAGE", r.status_code, "→ arrêt immédiat", flush=True); return 3
                    break
                except Exception as ex:
                    rec["http"] = "err:" + type(ex).__name__
                    time.sleep(5)
            out.write(json.dumps(rec, ensure_ascii=False) + "\n"); out.flush()
            if i % 100 == 0: print(i, rec, flush=True)
            time.sleep(DELAY)
    return 0

if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Relevé COMPLET des prix publics Pharmacie des Drakkars (30/09/2026).

Source : sitemap-products.xml (toutes les fiches, médicaments compris — l'ancien
scraper ne parcourait que /parapharmacie/). Chaque fiche : JSON-LD Product OU
ProductGroup → on garde CHAQUE variante (gtin13 + prix), pas seulement la 1re.
Sortie incrémentale et reprenable : <dossier>/releve.jsonl (une ligne par fiche), puis
scripts/generate_drakkars_pub.js <dossier>/releve.jsonl <date> → crm/v2/drakkars-pub-data.js.
usage : python3 scraper_drakkars_pub.py <dossier de travail HORS dépôt> (y déposer urls.txt,
        extrait de https://www.pharmaciedesdrakkars.com/sitemap-products.xml)
robots.txt : User-agent * Allow / (vérifié le 30/09/2026).
"""
import json, re, sys, time, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests

DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent
URLS = DIR / "urls.txt"
OUT = DIR / "releve.jsonl"
WORKERS = 4
DELAY = 0.5  # par ouvrier → ~8 requêtes/s au plus
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
LD = re.compile(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', re.S)
lock = threading.Lock()
local = threading.local()


def sess():
    if not hasattr(local, "s"):
        local.s = requests.Session()
        local.s.headers.update({"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"})
    return local.s


def price(v):
    try:
        f = float(str(v).replace(",", "."))
        return f if f > 0 else None
    except Exception:
        return None


def offers_of(p):
    o = p.get("offers")
    if isinstance(o, list):
        o = o[0] if o else {}
    return o or {}


def parse(html, url):
    rows, crumbs = [], []
    for m in LD.findall(html):
        try:
            d = json.loads(m)
        except Exception:
            continue
        for d in (d if isinstance(d, list) else [d]):
            t = d.get("@type")
            if t == "BreadcrumbList":
                crumbs = [i.get("name") for i in d.get("itemListElement", [])]
            elif t in ("Product", "ProductGroup"):
                brand = (d.get("brand") or {}).get("name") if isinstance(d.get("brand"), dict) else d.get("brand")
                variants = d.get("hasVariant") or [d]
                for v in variants:
                    o = offers_of(v)
                    rows.append({
                        "ean": str(v.get("gtin13") or v.get("gtin") or v.get("sku") or ""),
                        "prix": price(o.get("price")),
                        "dispo": (o.get("availability") or "").rsplit("/", 1)[-1],
                        "nom": v.get("name") or d.get("name"),
                        "marque": brand,
                        "url": v.get("url") or url,
                    })
    return {"url": url, "cat": crumbs[:-1], "rows": rows}


def fetch(url):
    for essai in range(4):
        try:
            r = sess().get(url, timeout=25)
            if r.status_code == 200:
                res = parse(r.text, url)
                res["http"] = 200
                return res
            if r.status_code in (404, 410):
                return {"url": url, "http": r.status_code, "rows": []}
            time.sleep(5 * (essai + 1))
        except Exception:
            time.sleep(5 * (essai + 1))
    return {"url": url, "http": "echec", "rows": []}


def work(url):
    res = fetch(url)
    with lock:
        with OUT.open("a") as f:
            f.write(json.dumps(res, ensure_ascii=False) + "\n")
    time.sleep(DELAY)
    return res


def main():
    urls = [u.strip() for u in URLS.read_text().splitlines() if u.strip()]
    done = set()
    if OUT.exists():
        for line in OUT.open():
            try:
                j = json.loads(line)
                if j.get("http") in (200, 404, 410):
                    done.add(j["url"])
            except Exception:
                pass
    todo = [u for u in urls if u not in done]
    print(f"{len(urls)} fiches, {len(done)} déjà faites, {len(todo)} à faire", flush=True)
    n = 0
    t0 = time.time()
    with ThreadPoolExecutor(WORKERS) as ex:
        for res in ex.map(work, todo):
            n += 1
            if n % 250 == 0:
                print(f"{n}/{len(todo)}  {time.time()-t0:.0f}s", flush=True)
    print("FINI", n, flush=True)


if __name__ == "__main__":
    main()

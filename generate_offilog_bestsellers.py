#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrape offilog.fr /meilleures-ventes (connecté, prix B2B) → classement des
ventes décroissant, avec prix + photo + EAN + marque.
Sortie : crm/v2/offilog-bestsellers-data.js  (const OFFILOG_BEST = [...])
"""
import re, time, json, sys, signal
import requests
from bs4 import BeautifulSoup

class _TO(Exception):
    pass
def _alarm(sig, frm):
    raise _TO()
signal.signal(signal.SIGALRM, _alarm)

def fetch(sess, url, hard=55):
    """GET avec garde-fou temps dur : ne peut jamais bloquer > hard secondes."""
    signal.alarm(hard)
    try:
        return sess.get(url, timeout=(10, 30))
    finally:
        signal.alarm(0)

BASE = "https://offilog.fr"
EMAIL = "TESTVIP@offilog.fr"
PWD = "Azerty123"
OUT = "/Users/williammorel/JARVIS/APP/crm/v2/offilog-bestsellers-data.js"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}

def log(*a):
    print(*a, flush=True)

s = requests.Session(); s.headers.update(UA)

# 1. Login
r = s.get(BASE + "/connexion?back=my-account", timeout=30)
soup = BeautifulSoup(r.text, "html.parser")
form = [f for f in soup.find_all("form") if f.find("input", {"name": "password"})][0]
data = {i.get("name"): i.get("value", "") for i in form.find_all("input") if i.get("name")}
data.update({"email": EMAIL, "password": PWD, "submitLogin": "1"})
r = s.post(BASE + "/connexion?back=my-account", data=data, timeout=30,
           headers={"Referer": BASE + "/connexion?back=my-account"})
if not ("mon-compte" in r.url or "Déconnexion" in r.text or "déconnexion" in r.text):
    log("ECHEC LOGIN"); sys.exit(1)
log("Login OK")

def parse_price(txt):
    if not txt: return None
    m = re.search(r'([\d\s ]+[.,]\d{2})', txt.replace(" ", ""))
    if not m: return None
    v = m.group(1).replace(" ", "").replace(" ", "").replace(",", ".")
    try: return round(float(v), 2)
    except ValueError: return None

# 2. Pagination par lots de 300 (réponse ~1 Mo, télécharge vite, ne s'étrangle pas)
RPP = 300
seen = set(); best = []; rank = 0
for page in range(1, 60):  # garde-fou : 60 lots × 300 = 18 000 produits max
    url = BASE + "/meilleures-ventes?resultsPerPage=" + str(RPP) + "&page=" + str(page)
    rp = None
    for attempt in range(3):
        try:
            rp = fetch(s, url); break
        except (_TO, Exception) as e:
            log("  retry lot", page, "(", type(e).__name__, ")"); time.sleep(2)
    if rp is None:
        log("  lot", page, "échoué 3x → skip"); continue
    sp = BeautifulSoup(rp.text, "html.parser")
    prods = sp.select(".js-product-miniature, article.product-miniature")
    new_before = len(seen)
    for p in prods:
        pid = p.get("data-id-product")
        if pid in seen: continue
        seen.add(pid)
        a = p.select_one("a.product_name") or p.select_one("a.product-thumbnail")
        href = a.get("href") if a else ""
        name = (a.get("title") or a.get_text(strip=True)) if a else ""
        img_el = p.select_one("img")
        img = ""
        if img_el:
            img = img_el.get("data-full-size-image-url") or img_el.get("data-src") or img_el.get("src") or ""
        man = p.select_one(".manufacturer a")
        brand = man.get_text(strip=True) if man else ""
        pr_el = p.select_one(".price")
        price = parse_price(pr_el.get_text(strip=True)) if pr_el else None
        ean_m = re.findall(r'(\d{13})', href)
        ean = ean_m[0] if ean_m else ""
        cat_m = re.findall(r'offilog\.fr/([a-z0-9\-]+)/\d+-', href)
        cat = cat_m[0] if cat_m else ""
        rank += 1
        best.append({"rank": rank, "id": pid, "name": name, "brand": brand,
                     "price": price, "ean": ean, "img": img, "cat": cat, "url": href})
    added = len(seen) - new_before
    log("  lot", page, ":", len(prods), "vus,", added, "nouveaux →", len(best), "au total")
    if added == 0:
        log("  plus de nouveaux produits → fin"); break
    time.sleep(0.4)

log("TOTAL:", len(best), "produits")
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Offilog — Meilleures ventes (connecté, prix B2B) — scrape live\n")
    f.write("// {} produits classés par ventes décroissantes · prix + photo + EAN\n".format(len(best)))
    f.write("const OFFILOG_BEST = " + json.dumps(best, ensure_ascii=False) + ";\n")
    f.write("try{window.OFFILOG_BEST=OFFILOG_BEST;}catch(e){}\n")
import os
log("OK ->", OUT, "({:.0f} Ko)".format(os.path.getsize(OUT) / 1024))

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrape Pharmazon (sra-pharmazon.com, Magento) — connecté.
Pour chaque laboratoire : produits (sku, id, nom, image) + prix via l'API
/groupementprice/ajax/getprices/ (prix_final, prix_catalogue, remise, promo,
paliers) + EAN13 via la fiche produit.
Sortie : crm/v2/pharmazon-data.js  (const PHARMAZON = [...])
Utilise curl (TLS compatible) ; checkpoints réguliers.
"""
import subprocess, re, json, time, os, sys
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
JAR = "/tmp/pz_cookies.txt"
BASE = "https://www.sra-pharmazon.com"
OUT = "/Users/williammorel/JARVIS/APP/crm/v2/pharmazon-data.js"
# ⚠️ JAMAIS d'identifiant en clair dans ce fichier : le dépôt est PUBLIC.
# Ils se lisent depuis ~/.pharmazon.env (hors dépôt, permissions 600) :
#     PHARMAZON_EMAIL=...
#     PHARMAZON_PWD=...
def _identifiants():
    fichier = os.path.expanduser("~/.pharmazon.env")
    vals = {}
    if os.path.exists(fichier):
        with open(fichier, encoding="utf-8") as f:
            for ligne in f:
                ligne = ligne.strip()
                if ligne and not ligne.startswith("#") and "=" in ligne:
                    k, v = ligne.split("=", 1)
                    vals[k.strip()] = v.strip().strip('"').strip("'")
    email = os.environ.get("PHARMAZON_EMAIL") or vals.get("PHARMAZON_EMAIL")
    pwd = os.environ.get("PHARMAZON_PWD") or vals.get("PHARMAZON_PWD")
    if not email or not pwd:
        sys.exit(
            "Identifiants Pharmazon introuvables.\n"
            "Crée ~/.pharmazon.env avec :\n"
            "  PHARMAZON_EMAIL=ton.email@integralpharma.fr\n"
            "  PHARMAZON_PWD=ton-mot-de-passe\n"
            "puis : chmod 600 ~/.pharmazon.env"
        )
    return email, pwd


EMAIL, PWD = _identifiants()

def log(*a): print(*a, flush=True)

def curl(url, xhr=False, timeout=50, post=None, referer=None):
    cmd = ["curl", "-sL", "--connect-timeout", "20", "--max-time", str(timeout), "-A", UA, "-b", JAR, "-c", JAR]
    if xhr: cmd += ["-H", "X-Requested-With: XMLHttpRequest"]
    if referer: cmd += ["-e", referer]
    if post:
        for kv in post: cmd += ["--data-urlencode", kv]
    cmd.append(url)
    try:
        return subprocess.run(cmd, capture_output=True, text=True).stdout
    except Exception:
        return ""

# ── 1. LOGIN ──
def login():
    LOGIN = BASE + "/customer/account/login/"
    h = curl(LOGIN)
    fk = re.findall(r'name="form_key"[^>]*value="([^"]+)"', h)
    fk = fk[0] if fk else ""
    curl(BASE + "/customer/account/loginPost/", referer=LOGIN, post=[
        "form_key=" + fk, "login[username]=" + EMAIL, "login[password]=" + PWD])
    acc = curl(BASE + "/customer/account/")
    return "Mon compte" in acc or "logout" in acc.lower() or "morel" in acc.lower()

# ── 2. LISTE DES LABOS ──
def labos():
    h = curl(BASE + "/")
    sp = BeautifulSoup(h, "html.parser")
    out = {}
    for a in sp.find_all("a", href=re.compile(r'/laboratoire/labo/index/code/\d+/')):
        m = re.search(r'/code/(\d+)/', a.get("href", ""))
        nm = a.get_text(strip=True)
        if m and nm and len(nm) > 1:
            out.setdefault(m.group(1), nm)
    return out

# ── 3. PRODUITS D'UN LABO (paginé) ──
def labo_products(code, name):
    items, page, seen_first = [], 1, None
    while page <= 60:
        h = curl(BASE + "/laboratoire/labo/index/code/%s/?p=%d" % (code, page))
        sp = BeautifulSoup(h, "html.parser")
        forms = sp.select("form[data-sku], .product-item-info[data-sku], [data-sku]")
        page_items = []
        for f in forms:
            sku = f.get("data-sku")
            if not sku: continue
            pid = None
            inp = f.select_one("input[name='product']")
            if inp: pid = inp.get("value")
            nmel = f.select_one(".product-item-name a, .product-item-link, .product-item-name")
            nm = nmel.get_text(strip=True) if nmel else ""
            if not nm:
                img0 = f.select_one("img")
                nm = (img0.get("alt") if img0 else "") or ""
            imgel = f.select_one("img")
            img = ""
            if imgel: img = imgel.get("data-src") or imgel.get("src") or ""
            page_items.append({"sku": str(sku), "id": pid, "name": nm.strip(), "img": img, "labo": name})
        if not page_items: break
        if page_items[0]["sku"] == seen_first: break  # même page = fin
        seen_first = page_items[0]["sku"]
        items += page_items
        if len(page_items) < 12: break  # dernière page partielle
        page += 1
        time.sleep(0.05)
    # dédup par sku
    uniq, seen = [], set()
    for it in items:
        if it["sku"] in seen: continue
        seen.add(it["sku"]); uniq.append(it)
    return uniq

# ── 4. PRIX (API getprices, batch) ──
def fetch_prices(skus):
    out = {}
    for i in range(0, len(skus), 60):
        batch = skus[i:i + 60]
        qs = "&".join("skus[]=" + s for s in batch)
        r = curl(BASE + "/groupementprice/ajax/getprices/?" + qs, xhr=True)
        try:
            d = json.loads(r)
            out.update(d.get("prices", {}) or {})
        except Exception:
            pass
        time.sleep(0.1)
    return out

# ── 5. EAN via fiche produit ──
def fetch_ean(pid):
    if not pid: return ""
    d = curl(BASE + "/catalog/product/view/id/%s/" % pid, timeout=45)
    m = re.search(r'\b(\d{13})\b', d)
    return m.group(1) if m else ""

def write_out(rows, partial=False):
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// Pharmazon (sra-pharmazon.com) — offres labos, connecté%s\n" % (" [PARTIEL]" if partial else ""))
        f.write("// %d produits · prix final/catalogue + remise + promo + EAN\n" % len(rows))
        f.write("const PHARMAZON = " + json.dumps(rows, ensure_ascii=False) + ";\n")
        f.write("try{window.PHARMAZON=PHARMAZON;}catch(e){}\n")

def main():
    if not login():
        log("ECHEC LOGIN"); sys.exit(1)
    log("Login OK")
    L = labos()
    log("Labos:", len(L))
    # Listings
    products = []
    done = 0
    for code, name in L.items():
        try:
            ps = labo_products(code, name)
            products += ps
        except Exception as e:
            log("  labo", code, "err", e)
        done += 1
        if done % 25 == 0:
            log("  labos %d/%d · %d produits" % (done, len(L), len(products)))
    log("TOTAL produits (listings):", len(products))
    # Prix
    skus = list(dict.fromkeys([p["sku"] for p in products if p["sku"]]))
    log("Récup prix pour", len(skus), "SKU…")
    prices = fetch_prices(skus)
    log("Prix reçus:", len(prices))
    for p in products:
        pr = prices.get(p["sku"], {})
        p["prix_final"] = pr.get("prix_final")
        p["prix_catalogue"] = pr.get("prix_catalogue")
        p["remise"] = pr.get("groupement_remise")
        p["is_promo"] = bool(pr.get("is_promo"))
        p["tiers"] = pr.get("tiers") or []
    write_out(products, partial=True)  # checkpoint sans EAN
    log("Checkpoint écrit (sans EAN).")
    # EAN (threaded) — la partie longue
    ids = [(i, p["id"]) for i, p in enumerate(products) if p.get("id")]
    log("EAN à récupérer:", len(ids))
    t = time.time(); cnt = [0]
    def work(item):
        idx, pid = item
        ean = fetch_ean(pid)
        products[idx]["ean"] = ean
        cnt[0] += 1
        if cnt[0] % 500 == 0:
            log("  EAN %d/%d · %.0fs" % (cnt[0], len(ids), time.time() - t))
            write_out(products, partial=True)
        return None
    with ThreadPoolExecutor(max_workers=10) as ex:
        list(ex.map(work, ids))
    write_out(products, partial=False)
    log("OK ->", OUT, "(%.1f Mo, %d produits)" % (os.path.getsize(OUT) / 1024 / 1024, len(products)))

if __name__ == "__main__":
    main()

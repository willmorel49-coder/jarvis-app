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
import subprocess, re, json, time, os, sys, html
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
    # --compressed : une fiche produit pèse 2,3 Mo brute, 0,26 Mo compressée (mesuré le 18/11/2026)
    cmd = ["curl", "-sL", "--compressed", "--connect-timeout", "20", "--max-time", str(timeout), "-A", UA, "-b", JAR, "-c", JAR]
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
    # 18/11/2026 : « logout » et « Mon compte » figurent AUSSI sur la page « Connexion client » : l'ancien contrôle
    # disait OK sur un mot de passe refusé. Non connecté, /customer/account/ renvoie vers le formulaire (loginPost).
    return bool(acc) and "loginPost" not in acc

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
    items, page, deja = [], 1, set()
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
        # 18/11/2026 : Pharmazon répète le même produit en tête de CHAQUE page d'un labo : « 1er produit déjà vu = même
        # page » arrêtait tout à la page 2 (La Roche-Posay : 43 produits relevés sur 111). Fin de liste = une page qui
        # n'apporte aucun produit nouveau (au-delà de la dernière, le site resert une page déjà vue).
        nouveaux = [it for it in page_items if it["sku"] not in deja]
        if not nouveaux: break
        deja.update(it["sku"] for it in nouveaux)
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

# ── 5. EAN et CIP13 via fiche produit ──
# 18/11/2026 : la fiche porte un bloc « product-codes » (EAN, CIP7, CIP13), échappé en HTML (&#x5B;…&#x5D;). Le 1er nombre
# à 13 chiffres de la page, seul lu jusque-là, était souvent le CIP13 (cité en tête de page) alors qu'Offilog utilise l'EAN :
# CB12 spray relevé 3401360315396 (CIP13), fiche EAN 3700343900292. On garde les deux, comme pour Sagitta.
def codes_fiche(h):
    m = re.search(r'class="product-codes"\s+x-data="\{\s*codes:\s*(&#x5B;.*?&#x5D;)', h or "", re.S)
    if not m: return {}
    try:
        lst = json.loads(html.unescape(m.group(1)))
    except ValueError:
        return {}
    return {c.get("key"): str(c.get("value") or "").strip() for c in lst if isinstance(c, dict) and c.get("key")}

def fetch_codes(pid):
    """(ean, cip13) d'une fiche ; repli sur le 1er nombre à 13 chiffres si le bloc manque. cip13 = '' s'il égale l'EAN."""
    if not pid: return "", ""
    d = curl(BASE + "/catalog/product/view/id/%s/" % pid, timeout=45)
    c = codes_fiche(d)
    ean = c.get("ean") if re.fullmatch(r"\d{13}", c.get("ean") or "") else ""
    cip = c.get("cip13") if re.fullmatch(r"\d{13}", c.get("cip13") or "") else ""
    if not ean and not cip:
        m = re.search(r'\b(\d{13})\b', d or "")
        return (m.group(1) if m else ""), ""
    return (ean or cip), (cip if cip and cip != (ean or cip) else "")

def write_out(rows, partial=False):
    # ⚠️ 03/09/2026 — les prix négociés Pharmazon sont les conditions d'un
    # TIERS : ils ne vont JAMAIS dans OUT, qui part dans un dépôt PUBLIC
    # (règle §8). Deux fichiers : le catalogue (identité seule) dans le dépôt,
    # le tarif dans OUT_PRIX, à déposer sur Supabase (couvert par .gitignore).
    import os as _os, datetime as _dt
    OUT_PRIX = _os.path.join(_os.path.dirname(OUT), "pharmazon-prix.js")
    # date du relevé, lue par l'écran Concurrents (« Relevé du … ») : jamais écrite en dur dans l'app (18/11/2026)
    maj = _dt.date.today().isoformat()
    pub, tarif = [], {}
    for r in rows:
        ean = str(r.get("ean") or "")
        if ean and r.get("prix_final") is not None:
            tarif[ean] = [r["prix_final"], r.get("prix_catalogue") or 0, r.get("remise") or 0]
        pub.append({k: v for k, v in r.items() if k in ("sku", "id", "name", "img", "labo", "ean", "cip") and (k != "cip" or v)})
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// Pharmazon (sra-pharmazon.com) — CATALOGUE SEUL, SANS LES PRIX NÉGOCIÉS%s\n" % (" [PARTIEL]" if partial else ""))
        f.write("// %d produits · identité seulement (nom, labo, image, EAN, CIP13 s'il diffère) — relevé %s\n" % (len(pub), maj))
        f.write("// ⚠️ Les prix B2B d'un TIERS ne se republient jamais (règle §8).\n")
        f.write("const PHARMAZON = " + json.dumps(pub, ensure_ascii=False) + ";\n")
        f.write("try{window.PHARMAZON=PHARMAZON;window.PHARMAZON_MAJ=%s;}catch(e){}\n" % json.dumps(maj))
    with open(OUT_PRIX, "w", encoding="utf-8") as f:
        f.write("// Pharmazon — PRIX NÉGOCIÉS (tiers) — relevé %s — NE JAMAIS COMMITER.\n" % maj)
        f.write("// %d EAN · ean -> [prix_final, prix_catalogue, remise]\n" % len(tarif))
        f.write("const PHARMAZON_PRIX = " + json.dumps(tarif) + ";\n")
    # garde-fou : se RELIRE avant de rendre la main
    with open(OUT, encoding="utf-8") as f:
        if "prix_final" in f.read():
            sys.exit("ARRÊT : %s contient encore des prix — dépôt PUBLIC." % OUT)

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
        ean, cip = fetch_codes(pid)
        products[idx]["ean"] = ean
        if cip: products[idx]["cip"] = cip
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

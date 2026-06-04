#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrape_offilog.py — Extraction du catalogue Offilog (PrestaShop) vers JSON/CSV.

À LANCER EN LOCAL, depuis ta machine, avec ton compte (contourne login + anti-bot).

Installation :
    pip install requests beautifulsoup4 lxml

Usage :
    1. Renseigne EMAIL / PASSWORD ci-dessous (ou via variables d'env OFFILOG_EMAIL / OFFILOG_PWD)
    2. python3 scrape_offilog.py
    3. Récupère catalogue.json (à coller dans la constante CATALOGUE du module) et catalogue.csv

Si la connexion ou le parsing échoue : colle-moi le HTML d'UNE fiche produit
(clic droit > Afficher le code source) et je cale les sélecteurs exactement.
"""

import os, re, json, csv, time, sys
import requests
from bs4 import BeautifulSoup

# ----------------------------- CONFIG -----------------------------
BASE       = "https://offilog.fr"
EMAIL      = os.environ.get("OFFILOG_EMAIL", "TON_EMAIL_ICI")
PASSWORD   = os.environ.get("OFFILOG_PWD",   "TON_MDP_ICI")
DELAY      = 0.8          # pause (s) entre 2 requêtes — reste poli avec le serveur
MAX_PROD   = 0           # 0 = tout le catalogue, sinon limite (utile pour tester)
OUT_JSON   = "catalogue.json"
OUT_CSV    = "catalogue.csv"
# ------------------------------------------------------------------

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

session = requests.Session()
session.headers.update({"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"})


def login():
    """Connexion PrestaShop 1.7+ (controller=authentication).

    La détection de succès est fiable : on vérifie que la réponse pointe vers
    /my-account (PrestaShop redirige le compte connecté dessus) ET qu'un GET
    sur /my-account renvoie bien la page compte (pas la page de login).
    """
    url = f"{BASE}/connexion?back=my-account"
    # récupère d'abord la page (cookies + éventuel token)
    r = session.get(url, timeout=20)
    soup = BeautifulSoup(r.text, "lxml")
    data = {"email": EMAIL, "password": PASSWORD, "submitLogin": "1", "back": "my-account"}
    # PrestaShop ajoute parfois un token caché
    tok = soup.select_one("input[name=token]")
    if tok:
        data["token"] = tok.get("value", "")
    r = session.post(url, data=data, timeout=20, allow_redirects=True)

    # Détection fiable : on suit ensuite /my-account et on cherche un marqueur
    # de session active (lien déconnexion ou bloc compte client).
    check = session.get(f"{BASE}/my-account", timeout=20)
    check_soup = BeautifulSoup(check.text, "lxml")
    ok = bool(
        check_soup.select_one(".logout, a[href*='mylogout'], a[href*='logout']")
        or check_soup.select_one(".account, #identity-link, .account-list")
    ) and "my-account" in check.url
    print("[login]", "OK" if ok else "ÉCHEC — vérifie EMAIL/PASSWORD ou l'URL /connexion")
    return ok


def product_urls():
    """Découvre les URLs produit. Stratégie 1 : sitemap. Stratégie 2 : crawl catégories."""
    urls = set()
    # --- Stratégie 1 : sitemap PrestaShop ---
    for sm in ("/sitemap.xml", "/1_fr_0_sitemap.xml", "/index.php?fc=module&module=gsitemap&controller=sitemap"):
        try:
            r = session.get(BASE + sm, timeout=20)
            if r.status_code == 200 and "<loc>" in r.text:
                locs = re.findall(r"<loc>(.*?)</loc>", r.text)
                # heuristique fiche produit PrestaShop : /<id>-<slug>.html ou /<id>-<slug>
                for u in locs:
                    if re.search(r"/\d+-[\w%-]+(\.html)?$", u):
                        urls.add(u.strip())
                if urls:
                    print(f"[sitemap] {len(urls)} produits via {sm}")
                    return list(urls)
        except Exception as e:
            print("[sitemap] skip", sm, e)
        time.sleep(DELAY)

    # --- Stratégie 2 : crawl des pages catégorie ---
    print("[crawl] pas de sitemap exploitable, crawl des catégories…")
    r = session.get(BASE, timeout=20)
    soup = BeautifulSoup(r.text, "lxml")
    cats = set()
    # Sélecteur 1 : liens dont la classe contient "category" (priorité)
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        cls = a.get("class") or []
        cls_str = " ".join(cls).lower()
        if "category" in cls_str and re.search(r"/\d+-[\w%-]+$", href):
            cats.add(href)
    # Sélecteur 2 : fallback — tous les liens type catégorie présents dans le menu
    for a in soup.select("#top-menu a[href], .category a[href], nav a[href]"):
        href = a.get("href", "")
        if re.search(r"/\d+-", href):
            cats.add(href)

    for c in list(cats):
        page = 1
        while True:
            sep = "&" if "?" in c else "?"
            r = session.get(f"{c}{sep}page={page}", timeout=20)
            s = BeautifulSoup(r.text, "lxml")
            found = s.select("article.product-miniature a.product-thumbnail[href], .product-title a[href]")
            if not found:
                break
            for a in found:
                urls.add(a["href"])
            page += 1
            time.sleep(DELAY)
            if page > 50:
                break
    print(f"[crawl] {len(urls)} produits")
    return list(urls)


def num(txt):
    """Extrait un prix '12,34' depuis un texte."""
    if not txt:
        return ""
    m = re.search(r"(\d+[.,]\d{2})", txt.replace(" ", "").replace(" ", ""))
    return m.group(1).replace(".", ",") if m else ""


def parse_product(url):
    r = session.get(url, timeout=20)
    s = BeautifulSoup(r.text, "lxml")

    def itemprop(p):
        el = s.select_one(f"[itemprop={p}]")
        if not el:
            return ""
        return (el.get("content") or el.get_text(" ", strip=True)).strip()

    nom = itemprop("name") or (s.select_one("h1") and s.select_one("h1").get_text(strip=True)) or ""
    prix = num(itemprop("price")) or num((s.select_one(".current-price, .price") or s).get_text(" ", strip=True) if s.select_one(".current-price, .price") else "")
    marque = itemprop("brand")
    # référence / CIP : PrestaShop affiche souvent "Référence" ou SKU
    ref = ""
    rs = s.select_one("[itemprop=sku], .product-reference span, .product-reference")
    if rs:
        ref = rs.get("content") or rs.get_text(strip=True)
    # un CIP fait 7 ou 13 chiffres : on tente de l'isoler
    cipm = re.search(r"\b(\d{13}|\d{7})\b", s.get_text(" ", strip=True))
    cip = (cipm.group(1) if cipm else ref).strip()
    desc = itemprop("description")[:120]
    img = ""
    imel = s.select_one("img[itemprop=image], .product-cover img, #content img")
    if imel:
        img = imel.get("src") or imel.get("data-image-large-src") or ""

    return {
        "nom": nom,
        "labo": marque,
        "molecule": "",                    # à enrichir si présent sur la fiche
        "detail": desc,
        "cip": cip,
        "prixHabituel": prix,
        "prixPromo": prix,                 # ajuste si tu as un prix barré (.regular-price)
        "url": url,
        "image": img,
    }


def main():
    if EMAIL.startswith("TON_") or PASSWORD.startswith("TON_"):
        sys.exit("→ Renseigne EMAIL et PASSWORD en haut du script (ou via OFFILOG_EMAIL / OFFILOG_PWD).")
    if not login():
        sys.exit("Connexion impossible. Colle-moi le HTML de la page /connexion pour ajuster.")
    urls = product_urls()
    if MAX_PROD:
        urls = urls[:MAX_PROD]
    if not urls:
        sys.exit("Aucun produit trouvé. Colle-moi le HTML d'une page catégorie pour ajuster les sélecteurs.")

    catalogue = []
    for i, u in enumerate(urls, 1):
        try:
            p = parse_product(u)
            if p["nom"]:
                catalogue.append(p)
                print(f"  [{i}/{len(urls)}] {p['nom'][:40]:40}  {p['cip']:13}  {p['prixHabituel']}")
        except Exception as e:
            print(f"  [{i}] erreur sur {u}: {e}")
        time.sleep(DELAY)

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(catalogue, f, ensure_ascii=False, indent=2)
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(catalogue[0].keys()))
        w.writeheader()
        w.writerows(catalogue)

    print(f"\n✓ {len(catalogue)} produits → {OUT_JSON} / {OUT_CSV}")


if __name__ == "__main__":
    main()

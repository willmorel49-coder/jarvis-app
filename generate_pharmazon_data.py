"""Convertit OFFILOG/catalogue-pharmazon.csv en opso/pharmazon-data.js
Lookup par EAN/CIP13 et par nom normalisé (Gamme + Nom).
"""
import csv, json, re, unicodedata

CSV  = "OFFILOG/catalogue-pharmazon.csv"
OUT  = "opso/pharmazon-data.js"

def norm(s):
    if not s: return ""
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

by_ean = {}
by_nom = {}
with open(CSV, encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
        ean = (row.get("EAN") or row.get("cip13") or "").strip()
        try:
            prix_cat = float((row.get("Prix") or "0").replace(",", "."))
        except: prix_cat = 0
        try:
            prix_rem = float((row.get("Prix remisé") or "0").replace(",", "."))
        except: prix_rem = 0
        try:
            remise_pct = float((row.get("Remise client") or "0").replace(",", "."))
        except: remise_pct = 0
        prix_final = prix_rem if prix_rem > 0 else prix_cat
        if prix_final <= 0:
            continue
        entry = {
            "prix": round(prix_final, 2),
            "prix_cat": round(prix_cat, 2) if prix_cat else None,
            "remise": round(remise_pct, 1) if remise_pct else None,
        }
        if ean:
            by_ean[ean] = entry
        # Index par nom normalisé (Gamme + Nom = libellé produit complet)
        gamme = row.get("Gamme") or ""
        nom   = row.get("Nom") or ""
        nk = norm(f"{gamme} {nom}")
        if nk and nk not in by_nom:
            by_nom[nk] = entry["prix"]

js  = "// Catalogue Pharmazon — prix remisés (négociés grossiste)\n"
js += "// Généré depuis OFFILOG/catalogue-pharmazon.csv — ne pas éditer\n"
js += f"// {len(by_ean)} produits avec EAN · {len(by_nom)} clés nom normalisé\n\n"
js += "const PHARMAZON_DATA = " + json.dumps(by_ean, ensure_ascii=False) + ";\n"
js += "const PHARMAZON_NOM = " + json.dumps(by_nom, ensure_ascii=False) + ";\n"

with open(OUT, "w", encoding="utf-8") as f:
    f.write(js)

print(f"✓ {len(by_ean)} produits Pharmazon (EAN) + {len(by_nom)} (nom) écrits dans {OUT}")

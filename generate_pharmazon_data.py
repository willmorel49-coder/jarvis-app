"""Convertit OFFILOG/catalogue-pharmazon.csv en opso/pharmazon-data.js
Lookup par EAN/CIP13. On garde le prix remisé (réel) + prix catalogue.
"""
import csv, json

CSV  = "OFFILOG/catalogue-pharmazon.csv"
OUT  = "opso/pharmazon-data.js"

records = {}
with open(CSV, encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
        ean = (row.get("EAN") or row.get("cip13") or "").strip()
        if not ean:
            continue
        try:
            prix_cat   = float((row.get("Prix") or "0").replace(",", "."))
        except: prix_cat = 0
        try:
            prix_rem   = float((row.get("Prix remisé") or "0").replace(",", "."))
        except: prix_rem = 0
        try:
            remise_pct = float((row.get("Remise client") or "0").replace(",", "."))
        except: remise_pct = 0
        # Priorité : prix remisé si dispo et > 0, sinon prix catalogue
        prix_final = prix_rem if prix_rem > 0 else prix_cat
        if prix_final <= 0:
            continue
        records[ean] = {
            "prix": round(prix_final, 2),
            "prix_cat": round(prix_cat, 2) if prix_cat else None,
            "remise": round(remise_pct, 1) if remise_pct else None,
        }

# JS output
js = "// Catalogue Pharmazon — prix remisés (négociés grossiste)\n"
js += "// Générée depuis OFFILOG/catalogue-pharmazon.csv — ne pas éditer\n"
js += f"// {len(records)} produits avec EAN + prix\n\n"
js += "const PHARMAZON_DATA = " + json.dumps(records, ensure_ascii=False) + ";\n"

with open(OUT, "w", encoding="utf-8") as f:
    f.write(js)

print(f"✓ {len(records)} produits Pharmazon écrits dans {OUT}")

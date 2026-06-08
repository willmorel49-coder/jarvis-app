#!/usr/bin/env python3
"""Parse Ameli NB_2025_cip13_reg.CSV → crm/ameli-boxes-data.js

Source : STATS/NB_2025_cip13_reg.CSV (Open Medic Ameli 2025)
Colonnes : CIP13 ; l_cip13 ; BEN_REG ; nbc ; REM ; BSE ; BOITES

Agrege toutes regions par CIP13 :
  boites_total = sum(BOITES) - BEN_REG=0 (national déjà total, on l'utilise direct)
  rem_total    = sum(REM)
  bse_total    = sum(BSE)
  nbc_total    = sum(nbc) (patients distincts)

Output : crm/ameli-boxes-data.js avec window.AMELI_2025 = {CIP13: {b, ca, nbc, lib}}
"""
import csv
import json
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
IN_CSV = ROOT / "STATS" / "NB_2025_cip13_reg.CSV"
OUT_JS = ROOT / "crm" / "ameli-boxes-data.js"


def parse_num(s):
    """Format Ameli : 1.012,49 (point milliers + virgule decimale)."""
    if not s or s.strip() == "":
        return 0.0
    try:
        return float(s.strip().replace(".", "").replace(",", "."))
    except ValueError:
        return 0.0


def main():
    if not IN_CSV.exists():
        print(f"!! {IN_CSV} introuvable", file=sys.stderr)
        sys.exit(1)

    # Map CIP13 → agg. BEN_REG = codes INSEE region (0,5,11,24,27,28,32,
    # 44,52,53,75,76,84,93,99). Pour le total national on SOMME toutes les
    # regions par CIP13.
    agg = defaultdict(lambda: {"b": 0, "ca": 0.0, "rem": 0.0, "nbc": 0, "lib": ""})
    n_lines = 0
    with IN_CSV.open(encoding="utf-8") as f:
        reader = csv.reader(f, delimiter=";")
        header = next(reader)
        # Header attendu : CIP13;l_cip13;BEN_REG;nbc;REM;BSE;BOITES
        for row in reader:
            n_lines += 1
            if len(row) < 7:
                continue
            cip13 = row[0].strip()
            libelle = row[1].strip()
            ben_reg = row[2].strip()
            nbc = parse_num(row[3])
            rem = parse_num(row[4])
            bse = parse_num(row[5])
            boites = parse_num(row[6])
            if not cip13 or boites < 1:
                continue
            # Somme toutes regions confondues
            entry = agg[cip13]
            entry["b"] += int(boites)
            entry["ca"] += bse
            entry["rem"] += rem
            entry["nbc"] += int(nbc)
            if not entry["lib"]:
                entry["lib"] = libelle[:80]
            if n_lines % 20000 == 0:
                print(f"  {n_lines:,} lignes parsees, {len(agg):,} produits uniques")
    # Convert defaultdict → plain dict avec arrondi
    agg = {k: {"b": v["b"], "ca": round(v["ca"], 2), "rem": round(v["rem"], 2),
               "nbc": v["nbc"], "lib": v["lib"]} for k, v in agg.items() if v["b"] >= 5}

    print(f"\nTotal lignes : {n_lines:,}")
    print(f"Produits CIP13 nationaux : {len(agg):,}")
    # Stats globales
    total_boites = sum(p["b"] for p in agg.values())
    total_ca = sum(p["ca"] for p in agg.values())
    print(f"Total boites 2025 France : {total_boites:,}")
    print(f"Total CA SS 2025 France  : {total_ca:,.2f} €")

    # Top 10 pour verif
    top10 = sorted(agg.items(), key=lambda x: -x[1]["b"])[:10]
    print(f"\nTop 10 boites :")
    for cip, p in top10:
        print(f"  {cip}  {p['lib'][:50]:50s}  {p['b']:>12,} boites  {p['ca']:>14,.0f} €")

    # Write JS
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JS.open("w", encoding="utf-8") as f:
        f.write(f"// Ameli Open Medic 2025 — Boites vendues par CIP13 (France entiere)\n")
        f.write(f"// Source : STATS/NB_2025_cip13_reg.CSV (BEN_REG=0 total national)\n")
        f.write(f"// {len(agg):,} produits | {total_boites:,} boites | {total_ca:,.0f} EUR CA SS\n")
        f.write(f"const AMELI_2025 = ")
        f.write(json.dumps(agg, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
        f.write("if (typeof window !== 'undefined') {\n")
        f.write("  window.AMELI_2025 = AMELI_2025;\n")
        f.write("  window.AMELI_2025_TOTAL_BOITES = " + str(total_boites) + ";\n")
        f.write("  window.AMELI_2025_TOTAL_CA = " + str(round(total_ca, 2)) + ";\n")
        f.write("}\n")
    print(f"\n-> {OUT_JS} ({OUT_JS.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Catalogue Sagitta (CSV export grossiste) -> crm/v2/sagitta-prix.js

Tarif d'achat Sagitta par EAN, pour le comparatif d'achat de l'ecran
Offilog (comme Pharmazon). Prix net = Prix A HT x (1 - Remise1) —
formule verifiee contre la shortlist PDF Sagitta (176/179 concordants,
les 3 ecarts venant du parsing PDF).

SORTIE = CONDITIONS COMMERCIALES D'UN TIERS (regle §8) : le fichier est
dans .gitignore et se depose sur Supabase `donnees-protegees`, il ne
part JAMAIS dans le depot public.

Usage : python3 scripts/generate_sagitta_prix.py [--date AAAA-MM-JJ]
"""
import csv
import datetime
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "crm" / "v2" / "sagitta-prix.js"

# CONCURRENTS/ est gitignore : absent des worktrees, present dans ~/JARVIS/APP
CSV_CANDIDATS = [
    ROOT / "CONCURRENTS" / "SAGITTA" / "catalogue_général.csv",
    Path.home() / "JARVIS" / "APP" / "CONCURRENTS" / "SAGITTA" / "catalogue_général.csv",
]


def main():
    date = None
    args = sys.argv[1:]
    if "--date" in args:
        date = args[args.index("--date") + 1]

    src = None
    for c in CSV_CANDIDATS:
        if c.exists():
            src = c
            break
    if src is None:
        print("ERREUR : catalogue Sagitta introuvable :", [str(c) for c in CSV_CANDIDATS])
        sys.exit(1)
    if date is None:
        date = datetime.date.fromtimestamp(src.stat().st_mtime).isoformat()

    prix = {}
    with open(src, encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            ean = (r.get("EAN13") or "").strip()
            if not ean:
                continue
            try:
                tarif = float((r.get("Prix A HT") or "").replace(",", "."))
                rem = float((r.get("Remise1") or "0").replace(",", ".") or 0)
            except ValueError:
                continue
            if tarif <= 0:
                continue
            net = round(tarif * (1 - rem), 2)
            if rem > 0:
                prix[ean] = [net, round(tarif, 2), round(rem * 100, 2)]
            else:
                prix[ean] = [net]

    body = json.dumps(prix, separators=(",", ":"), ensure_ascii=False)
    out = (
        "// Sagitta — tarif d'achat grossiste par EAN — CONDITIONS D'UN TIERS\n"
        "// ⚠️ JAMAIS dans le dépôt public : Supabase `donnees-protegees` uniquement.\n"
        "// {ean: [prix net HT] ou [prix net HT, tarif brut HT, remise %]}\n"
        "// relevé " + date + " · " + str(len(prix)) + " EAN · generate_sagitta_prix.py\n"
        "window.SAGITTA_PRIX=" + body + ";\n"
        "window.SAGITTA_PRIX_MAJ=" + json.dumps(date) + ";\n"
    )
    OUT.write_text(out, encoding="utf-8")

    # relecture de controle : le fichier ecrit doit porter autant d'EAN
    relu = OUT.read_text(encoding="utf-8")
    n_relu = relu.count('":[')
    ok = n_relu == len(prix)
    print("source :", src)
    print("ecrit  :", OUT, "-", OUT.stat().st_size, "octets,", len(prix), "EAN, releve", date)
    print("relecture :", n_relu, "EAN —", "OK" if ok else "ECART !")
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()

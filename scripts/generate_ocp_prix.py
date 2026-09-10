#!/usr/bin/env python3
"""Catalogue OCP « Les Incontournables » (CSV extrait du flipbook) -> crm/v2/ocp-prix.js

Meilleur prix net OCP par code 13 (EAN13 = CIP13 pour ces produits), pour
le face-a-face « Catalogue & prix » et le comparatif d'achat Offilog —
miroir exact de generate_sagitta_prix.py.

Le CSV porte une ligne par (page, labo, produit, palier) : quand un code
apparait plusieurs fois (quadrimestrielle / annuelle / avec engagement),
on garde le NET LE PLUS BAS, comme ocp-prix-par-cip.json.

SORTIE = CONDITIONS COMMERCIALES D'UN TIERS (regle §8) : le fichier est
dans .gitignore et se depose sur Supabase `donnees-protegees`, il ne
part JAMAIS dans le depot public, et l'app OPSO ne le charge pas.

Usage : python3 scripts/generate_ocp_prix.py [--date AAAA-MM-JJ]
"""
import csv
import datetime
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "crm" / "v2" / "ocp-prix.js"
NOM_CSV = "ocp-incontournables-2026-09.csv"

# CONCURRENTS/ est gitignore : absent des worktrees, present dans ~/JARVIS/APP
CSV_CANDIDATS = [
    ROOT / "CONCURRENTS" / "OCP" / NOM_CSV,
    Path.home() / "JARVIS" / "APP" / "CONCURRENTS" / "OCP" / NOM_CSV,
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
        print("ERREUR : catalogue OCP introuvable :", [str(c) for c in CSV_CANDIDATS])
        sys.exit(1)
    if date is None:
        date = datetime.date.fromtimestamp(src.stat().st_mtime).isoformat()

    prix = {}      # code13 : [net, ppht, remise %]
    douteux = []   # lignes marquees « A VERIFIER » par l'extraction — gardees, signalees
    n_lignes = 0
    with open(src, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            n_lignes += 1
            code = (r.get("code13") or "").strip()
            if len(code) != 13 or not code.isdigit():
                continue
            try:
                net = float(r.get("net") or "")
                ppht = float(r.get("ppht") or "")
            except ValueError:
                continue
            if net <= 0:
                continue
            if (r.get("controle") or "").strip():
                douteux.append((r.get("page"), code, r.get("libelle"), r.get("controle")))
            remise = round((ppht - net) / ppht * 100, 2) if ppht > 0 else 0
            cur = prix.get(code)
            if cur is None or net < cur[0]:
                prix[code] = [round(net, 2), round(ppht, 2), remise]

    body = json.dumps(prix, separators=(",", ":"), ensure_ascii=False)
    out = (
        "// OCP — « Les Incontournables » sept-déc 2026, meilleur prix net par code 13 — CONDITIONS D'UN TIERS\n"
        "// ⚠️ JAMAIS dans le dépôt public : Supabase `donnees-protegees` uniquement. Jamais chargé côté OPSO.\n"
        "// OCP_PRIX {code13: [prix net HT, PPHT, remise %]} — net = meilleur palier du catalogue\n"
        "// relevé " + date + " · " + str(len(prix)) + " codes · generate_ocp_prix.py\n"
        "window.OCP_PRIX=" + body + ";\n"
        "window.OCP_PRIX_MAJ=" + json.dumps(date) + ";\n"
    )
    OUT.write_text(out, encoding="utf-8")

    # relecture de controle : le fichier ecrit doit porter autant d'entrees
    relu = OUT.read_text(encoding="utf-8")
    n = relu.count('":[')
    ok = n == len(prix)
    print("source :", src, "-", n_lignes, "lignes")
    print("ecrit  :", OUT, "-", OUT.stat().st_size, "octets,", len(prix), "codes, releve", date)
    print("relecture :", n, "codes —", "OK" if ok else "ECART !")
    for d in douteux:
        print("  A VERIFIER (garde) : p.%s %s %s — %s" % d)
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()

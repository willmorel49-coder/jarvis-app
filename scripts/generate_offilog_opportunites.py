#!/usr/bin/env python3
"""Tableau unique des opportunites Offilog (JSON interne) -> crm/v2/offilog-opportunites.js

Photo datee (17/11/2026) affichee dans l'onglet « Opportunites » de la porte
« Comparer nos prix » (ecran Offilog). Aucun recalcul : les lignes sont
celles du tableau unique, simplement mises en format compact.

SORTIE = PRIX D'ACHAT DE CONCURRENTS ET CONDITIONS DE TIERS (regle §8) : le
fichier est dans .gitignore et se depose sur Supabase `donnees-protegees`
(cle `offilogopp`), il ne part JAMAIS dans le depot public.

Usage : python3 scripts/generate_offilog_opportunites.py [chemin/tableau-unique.json]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "crm" / "v2" / "offilog-opportunites.js"
DEFAUT = Path.home() / "jarvis-preuves" / "opportunites-offilog-2026-11-17" / "comparatifs" / "tableau-unique" / "tableau-unique.json"

# Periodes affichees en tete de l'onglet (METHODE.md du tableau unique)
PERIODES = {
    "prix_offilog": "prix Offilog du 16 et 17/11",
    "prix_concurrents": "prix d'achat des concurrents de juin à octobre 2026",
}
SECTIONS = [  # (cle dans le JSON, cle dans le fichier)
    ("opportunites_solides", "solides"),
    ("moins_cher_sans_prix_public", "sanspublic"),
    ("moins_cher_marge_courte", "margecourte"),
    ("plus_cher", "pluscher"),
]
COLS = ["id", "marque", "produit", "prix_offilog", "concurrent", "prix_concurrent", "date_concurrent",
        "ecart_pct", "public_min", "public_min_ou", "marge_pct", "promo_pz", "sans_promo", "nb_sources"]


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAUT
    if not src.exists():
        print("ERREUR : tableau unique introuvable :", src)
        sys.exit(1)
    d = json.loads(src.read_text(encoding="utf-8"))
    out = {"date": d["date"], "periodes": PERIODES, "cols": COLS,
           "fragiles_exclus": d["nb_fragiles_exclus"]}
    for kj, kf in SECTIONS:
        out[kf] = [[(None if r.get(c) in ("", None) else r.get(c)) for c in COLS] for r in d[kj]]
        out[kf] = [[str(x) if c == "id" and x is not None else x for c, x in zip(COLS, row)] for row in out[kf]]
    body = json.dumps(out, separators=(",", ":"), ensure_ascii=False)
    texte = (
        "// Opportunités Offilog — photo du " + d["date"] + " — PRIX D'ACHAT DE CONCURRENTS (tiers)\n"
        "// ⚠️ JAMAIS dans le dépôt public : Supabase `donnees-protegees` uniquement.\n"
        "// colonnes : " + ",".join(COLS) + " · generate_offilog_opportunites.py\n"
        "window.OFFILOG_OPPORTUNITES=" + body + ";\n"
    )
    OUT.write_text(texte, encoding="utf-8")
    relu = OUT.read_text(encoding="utf-8").split("window.OFFILOG_OPPORTUNITES=")[1].rstrip().rstrip(";")
    r = json.loads(relu)
    ok = all(len(r[kf]) == len(d[kj]) for kj, kf in SECTIONS)
    print("source :", src)
    print("écrit  :", OUT, "-", OUT.stat().st_size, "octets")
    for kj, kf in SECTIONS:
        print("  ", kf, len(r[kf]), "/", len(d[kj]))
    print("relecture :", "OK" if ok else "ECART !")
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()

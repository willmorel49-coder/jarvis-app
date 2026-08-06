#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_pollen.py — Veille APPRO : signal AVANCÉ de demande (pollens).

Quand un pollen monte dans un département, la demande d'antihistaminiques et de
collyres y grimpe 1 à 3 jours après. C'est un signal de DEMANDE (pas de rupture),
utilisable pour anticiper les commandes saisonnières par secteur.

Source : Atmo France, indice pollen national (WFS GeoJSON, ODbL, aucune clé).
La donnée est par COMMUNE (~104 000) ; on agrège au DÉPARTEMENT (max du niveau
par taxon) pour rester léger et se coller aux secteurs commerciaux.

Écrit crm/v2/pollen.json. Python 3.9, urllib seul, aucune dépendance.
Remplace l'ex-RNSA (association liquidée le 26/03/2025).
"""
import io
import os
import json
import datetime
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "pollen.json")

WFS = ("https://data.atmo-france.org/geoserver/ind_pol/ows"
       "?service=WFS&version=2.0.0&request=GetFeature"
       "&typeName=ind_pol:ind_national_pol&outputFormat=application/json")

# code_<x> dans le flux -> (clé courte, libellé)
TAXONS = [
    ("code_gram", "gram", "Graminées"),
    ("code_ambr", "ambr", "Ambroisie"),
    ("code_boul", "boul", "Bouleau"),
    ("code_oliv", "oliv", "Olivier"),
    ("code_aul", "aul", "Aulne"),
    ("code_arm", "arm", "Armoise"),
]
NIVEAUX = {0: "nul", 1: "très faible", 2: "faible", 3: "moyen", 4: "élevé", 5: "très élevé"}


def to_int(v):
    try:
        return int(float(v))
    except Exception:
        return None


def main():
    req = urllib.request.Request(WFS, headers={"User-Agent": "Mozilla/5.0 (JARVIS veille appro)"})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.loads(r.read().decode("utf-8", "ignore"))

    feats = data.get("features", [])
    if not feats:
        raise SystemExit("Atmo France : aucune commune renvoyée, on ne réécrit pas le fichier.")

    # Agrégation par département : niveau MAX par taxon + drapeau alerte
    deps = {}          # "44" -> {"gram": 3, ...}, plus "_alerte": bool
    maj = None
    ech = None
    nat = {cle: 0 for _, cle, _ in TAXONS}
    nat_alerte = False

    for f in feats:
        p = f.get("properties", {})
        insee = str(p.get("code_zone") or "")
        if len(insee) < 2:
            continue
        dep = insee[:3] if insee[:2] in ("97", "98") else insee[:2]
        d = deps.setdefault(dep, {cle: 0 for _, cle, _ in TAXONS})
        for champ, cle, _ in TAXONS:
            n = to_int(p.get(champ)) or 0
            if n > d[cle]:
                d[cle] = n
            if n > nat[cle]:
                nat[cle] = n
        if p.get("alerte") in (True, "true", "True", 1):
            d["_alerte"] = True
            nat_alerte = True
        maj = maj or p.get("date_maj")
        ech = ech or p.get("date_ech")

    # National : taxons classés du plus haut au plus bas, avec libellé
    national = []
    for _, cle, lib in TAXONS:
        niv = nat[cle]
        national.append({"t": cle, "lib": lib, "niv": niv, "txt": NIVEAUX.get(niv, "?")})
    national.sort(key=lambda x: -x["niv"])

    # Départements : on ne garde que les taxons à niveau >= 3 (moyen et plus), c'est
    # là que la demande bouge. Un département sans rien de notable est omis.
    dep_out = {}
    for dep, d in deps.items():
        chauds = [{"t": cle, "lib": lib, "niv": d[cle]}
                  for _, cle, lib in TAXONS if d.get(cle, 0) >= 3]
        if chauds or d.get("_alerte"):
            chauds.sort(key=lambda x: -x["niv"])
            dep_out[dep] = {"a": bool(d.get("_alerte")), "p": chauds}

    out = {
        "maj": maj or datetime.datetime.utcnow().isoformat() + "Z",
        "echeance": ech,
        "source": "Atmo France (indice pollen national, ODbL)",
        "national": national,
        "departements": dep_out,
    }
    tmp = OUT + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)

    top = national[0]
    print("Pollen OK — %d communes agrégées en %d départements notables."
          % (len(feats), len(dep_out)))
    print("  national dominant : %s (%s), alerte=%s" % (top["lib"], top["txt"], nat_alerte))
    print("  échéance prévision : %s" % ech)
    print("→ %s (%d o)" % (OUT, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()

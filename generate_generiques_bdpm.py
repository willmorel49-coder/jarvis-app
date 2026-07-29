#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_generiques_bdpm.py — Veille APPRO : génériques (falaises de brevet en pratique).

Source : Base de Données Publique des Médicaments (BDPM / ANSM), miroir raw GitHub
betagouv/api-medicaments (gratuit, sans clé). On croise :
  - CIS_GENER_bdpm.txt : groupes génériques (princeps type 0 / génériques type 1-2-4)
  - CIS_CIP_bdpm.txt    : présentations → CIP13 + état de commercialisation

Produit crm/v2/generiques-bdpm.json :
  - princepsWithGeneric : liste des CIP13 de PRINCEPS commercialisés dont le groupe a
    au moins un générique commercialisé  → « tu achètes ce princeps, un générique existe :
    bascule possible » (croisé côté app avec le sell-in WML).
  - newGeneric : groupes ayant GAGNÉ un générique depuis le dernier passage (diff snapshot)
    = l'événement d'anticipation à mettre sur le radar (« un générique vient d'arriver »).

Snapshot crm/v2/_gener_snapshot.json (liste des group_id ayant déjà un générique) pour le diff.

Python 3.9. Zéro dépendance externe (urllib). Encodage BDPM = latin-1.
"""
import io
import os
import json
import datetime
import urllib.request

BASE = "https://raw.githubusercontent.com/betagouv/api-medicaments/master/data/"
GENER = BASE + "CIS_GENER_bdpm.txt"
CISCIP = BASE + "CIS_CIP_bdpm.txt"

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "generiques-bdpm.json")
SNAP = os.path.join(HERE, "crm", "v2", "_gener_snapshot.json")


def fetch_lines(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
    text = raw.decode("latin-1", "ignore")
    return [ln.split("\t") for ln in text.splitlines() if ln.strip()]


def digits13(v):
    s = "".join(ch for ch in str(v or "") if ch.isdigit())
    return s if len(s) == 13 else None


def main():
    gener = fetch_lines(GENER)      # [group_id, libelle, cis, type, ordre]
    ciscip = fetch_lines(CISCIP)    # [cis, cip7, lib, statut, etat_commerc, date, cip13, ...]

    # CIS -> liste de CIP13 commercialisés
    cis_to_cips = {}
    for row in ciscip:
        if len(row) < 7:
            continue
        cis = row[0].strip()
        etat = (row[4] or "")
        cip13 = digits13(row[6])
        if not cip13:
            continue
        if "Arr" in etat:           # « Arrêt de commercialisation » → on ignore
            continue
        cis_to_cips.setdefault(cis, []).append(cip13)

    # Groupes : princeps (type 0) vs génériques (type != 0)
    groups = {}   # gid -> {lib, princeps:set(cis), gen:set(cis)}
    for row in gener:
        if len(row) < 4:
            continue
        gid, lib, cis, typ = row[0].strip(), row[1].strip(), row[2].strip(), row[3].strip()
        g = groups.setdefault(gid, {"lib": lib, "princeps": set(), "gen": set()})
        if not g["lib"]:
            g["lib"] = lib
        if typ == "0":
            g["princeps"].add(cis)
        else:
            g["gen"].add(cis)

    princeps_with_generic = set()   # CIP13 de princeps commercialisés dont le groupe a un générique commercialisé
    gids_with_generic = []          # group_id ayant au moins un générique commercialisé
    new_detail = {}                 # gid -> {lib, cips:[princeps cips]}

    for gid, g in groups.items():
        gen_commercialise = any(cis in cis_to_cips for cis in g["gen"])
        if not gen_commercialise:
            continue
        gids_with_generic.append(gid)
        pcips = []
        for cis in g["princeps"]:
            for c in cis_to_cips.get(cis, []):
                princeps_with_generic.add(c)
                pcips.append(c)
        new_detail[gid] = {"lib": g["lib"], "cips": sorted(set(pcips))}

    gids_with_generic = sorted(set(gids_with_generic))

    # Diff snapshot : quels groupes ont GAGNÉ un générique depuis la dernière fois
    prev = []
    try:
        with io.open(SNAP, "r", encoding="utf-8") as f:
            prev = json.load(f).get("gids", [])
    except Exception:
        prev = []
    prev_set = set(prev)
    today = datetime.date.today().isoformat()
    new_gener = []
    if prev_set:   # pas au tout premier passage (sinon tout serait « nouveau »)
        for gid in gids_with_generic:
            if gid not in prev_set:
                d = new_detail.get(gid, {})
                new_gener.append({"gid": gid, "lib": d.get("lib", ""), "cips": d.get("cips", []), "since": today})

    out = {
        "generated": today,
        "source": "BDPM (ANSM) via betagouv/api-medicaments",
        "meta": {
            "nGroupes": len(groups),
            "nAvecGenerique": len(gids_with_generic),
            "nPrincepsCip": len(princeps_with_generic),
            "nNouveaux": len(new_gener),
        },
        "princepsWithGeneric": sorted(princeps_with_generic),
        "newGeneric": new_gener[:50],
    }
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    with io.open(SNAP, "w", encoding="utf-8") as f:
        json.dump({"generated": today, "gids": gids_with_generic}, f, ensure_ascii=False, separators=(",", ":"))

    print("OK · groupes=%d · avec générique=%d · princeps CIP=%d · nouveaux=%d" % (
        len(groups), len(gids_with_generic), len(princeps_with_generic), len(new_gener)))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_pivot.py — LA table de correspondance pivot (clé de jointure universelle).

Rend couplable TOUTE source externe avec nos données internes (WML sell-in, stock,
PROD_STATS, PPHT — toutes par CIP13). Une ligne par CIP13 :
  cis, molécule (DCI), groupe générique, princeps/générique, laboratoire,
  taux de remboursement, prix public officiel, commercialisé.

Source : API Médicaments FR (miroir BDPM, giygas.dev), export vérifié 200 sans clé,
~2,7 Mo gzip, MAJ 2×/jour. L'ATC (absent de la BDPM) sera ajouté plus tard via Open Medic.

Écrit :
  crm/v2/pivot.json        → { "<cip13>": {cis,dci,grp,gen,labo,remb,prix,co}, ... }
  crm/v2/pivot-index.json  → { grp: {gid:[cip13...]}, dci: {"MOLECULE":[cip13...]} }  (index inversés minces)

Python 3.9. urllib seul. Zéro clé.
"""
import io
import os
import re
import json
import datetime
import urllib.request

EXPORT = "https://medicaments-api.giygas.dev/v1/medicaments/export"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "pivot.json")
OUT_IDX = os.path.join(HERE, "crm", "v2", "pivot-index.json")


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip
            raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8", "ignore"))


def remb_int(v):
    m = re.search(r"(\d+)", str(v or ""))
    return int(m.group(1)) if m else None


def digits13(v):
    s = "".join(ch for ch in str(v or "") if ch.isdigit())
    return s if len(s) == 13 else None


def main():
    meds = fetch_json(EXPORT)
    pivot = {}
    idx_grp = {}
    idx_dci = {}
    for m in meds:
        cis = m.get("cis")
        labo = (m.get("titulaire") or "").strip()
        comps = m.get("composition") or []
        dci = ""
        if comps:
            # substance active en priorité (natureComposant SA), sinon la 1re
            act = [c for c in comps if str(c.get("natureComposant") or "").upper().startswith("SA")]
            dci = ((act[0] if act else comps[0]).get("denominationSubstance") or "").strip()
        gens = m.get("generiques") or []
        grp = gens[0].get("group") if gens else None
        gen = 1 if (gens and "nér" in str(gens[0].get("type") or "").lower()) else 0
        for p in (m.get("presentation") or []):
            cip = digits13(p.get("cip13"))
            if not cip:
                continue
            co = 1 if str(p.get("etatComercialisation") or "").startswith("Commercial") else 0
            row = {"cis": cis, "dci": dci, "grp": grp, "gen": gen, "labo": labo,
                   "remb": remb_int(p.get("tauxRemboursement")), "prix": p.get("prix"), "co": co}
            pivot[cip] = row
            if grp is not None:
                idx_grp.setdefault(str(grp), []).append(cip)
            if dci:
                idx_dci.setdefault(dci, []).append(cip)

    today = datetime.date.today().isoformat()
    out = {"generated": today, "source": "BDPM via giygas.dev", "n": len(pivot), "data": pivot}
    idx = {"generated": today, "grp": idx_grp, "dci": idx_dci}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    with io.open(OUT_IDX, "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · pivot CIP13=%d · groupes=%d · molécules=%d" % (len(pivot), len(idx_grp), len(idx_dci)))
    print("→ %s (%d Ko) · %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024, OUT_IDX, os.path.getsize(OUT_IDX) // 1024))


if __name__ == "__main__":
    main()

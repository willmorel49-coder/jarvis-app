#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_mitm.py — Veille APPRO : Médicaments d'Intérêt Thérapeutique Majeur (MITM).

Liste ANSM publique (BDPM CIS_MITM) des médicaments critiques : ceux dont une rupture
a des conséquences graves (stocks de sécurité obligatoires). Une rupture/tension sur un
MITM = priorité maximale à l'achat. (C'est la seule donnée qu'Aprobot exploite et pas
encore nous — sauf qu'eux l'ont figée en février ; nous, robot à jour.)

Source : base-donnees-publique.medicaments.gouv.fr/download/file/CIS_MITM.txt (CIS)
+ CIS_CIP_bdpm.txt (CIS→CIP13). Gratuit, sans clé. Restreint au catalogue (prod-stats).

Écrit crm/v2/mitm.json = { generated, n, cips:[cip13...] }. Python 3.9, urllib seul.
"""
import io
import os
import re
import json
import datetime
import urllib.request

BASE = "https://base-donnees-publique.medicaments.gouv.fr/download/file/"
MITM = BASE + "CIS_MITM.txt"
CISCIP = BASE + "CIS_CIP_bdpm.txt"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "mitm.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")


def fetch_lines(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("latin-1", "ignore").splitlines()


def digits13(v):
    s = "".join(ch for ch in str(v or "") if ch.isdigit())
    return s if len(s) == 13 else None


def catalogue_cips():
    try:
        txt = io.open(PRODSTATS, "r", encoding="utf-8").read()
        arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
        return set(str(p.get("c")) for p in arr if p.get("c"))
    except Exception:
        return set()


def main():
    mitm_cis = set()
    for ln in fetch_lines(MITM):
        c = ln.split("\t")[0].strip()
        if c:
            mitm_cis.add(c)

    cat = catalogue_cips()
    cips = set()
    for ln in fetch_lines(CISCIP):
        cols = ln.split("\t")
        if len(cols) < 7:
            continue
        if "Arr" in (cols[4] if len(cols) > 4 else ""):   # audit #11 : ignorer les présentations « Arrêt de commercialisation »
            continue
        if cols[0].strip() in mitm_cis:
            cip = digits13(cols[6])
            if cip and (not cat or cip in cat):
                cips.add(cip)

    out = {"generated": datetime.date.today().isoformat(), "source": "ANSM/BDPM CIS_MITM",
           "n": len(cips), "cips": sorted(cips)}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · MITM CIS=%d · CIP13 (catalogue=%d)=%d" % (len(mitm_cis), len(cat), len(cips)))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

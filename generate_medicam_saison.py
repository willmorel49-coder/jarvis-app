#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_medicam_saison.py — Veille APPRO : saisonnalité par PRODUIT (Medic'AM, 2 ans).

Medic'AM (Assurance Maladie) donne, par CIP13 et par mois, le nombre de boîtes
remboursées en France. Sur 2 années pleines, on reconstruit un indice saisonnier
mensuel par produit (moyenne du mois / moyenne annuelle) → « l'an dernier ce produit
montait en septembre → pré-commander en août ». Complète la saison ATC2 (SAISON) par
un angle PRODUIT + le vrai historique national.

Source : data.gouv « Medic'AM par type de prescripteur » (ZIP → .xls binaire), gratuit
sans clé. On restreint aux CIP de notre catalogue (prod-stats) pour un JSON léger.

Écrit crm/v2/saison-cip.json. Python 3.9 · urllib + xlrd.
"""
import io
import os
import re
import json
import zipfile
import datetime
import urllib.request

import xlrd

META = "https://www.data.gouv.fr/api/1/datasets/medicam-medicaments-rembourses-par-lassurance-maladie-par-type-de-prescripteur-donnees-interregimes/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "saison-cip.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")
YEARS = [2023, 2024]
MIN_BOITES = 240   # volume total mini sur la période pour être significatif


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip
            raw = gzip.decompress(raw)
    return raw


def catalogue_cips():
    """CIP13 de notre catalogue (PROD_STATS) pour restreindre la sortie."""
    try:
        txt = io.open(PRODSTATS, "r", encoding="utf-8").read()
        arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
        return set(str(p.get("c")) for p in arr if p.get("c"))
    except Exception:
        return set()


def resource_map():
    d = json.loads(fetch(META))
    out = {}
    for r in d.get("resources", []):
        t = (r.get("title") or "").lower()
        for y in YEARS:
            if "1er semestre %d" % y in t:
                out[(y, 1)] = r["url"]
            elif "2e semestre %d" % y in t:
                out[(y, 2)] = r["url"]
    return out


def read_xls(raw):
    z = zipfile.ZipFile(io.BytesIO(raw))
    name = [n for n in z.namelist() if n.lower().endswith(".xls")][0]
    wb = xlrd.open_workbook(file_contents=z.read(name))
    sh = None
    for s in wb.sheets():
        if "tous_presc" in s.name.lower():
            sh = s
            break
    return sh or max(wb.sheets(), key=lambda s: s.nrows * s.ncols)


def process(raw, sem, acc, seen):
    sh = read_xls(raw)
    hdr = [str(sh.cell_value(0, c)) for c in range(sh.ncols)]
    cip_c = next((i for i, h in enumerate(hdr) if h.strip().upper() == "CIP13"), 0)
    atc_c = next((i for i, h in enumerate(hdr) if "ATC" in h.upper() and "2" not in h and "code" in h.lower()), None)
    boites_cols = [i for i, h in enumerate(hdr) if "ombre de bo" in h]  # 6 colonnes mensuelles
    months = list(range(1, 7)) if sem == 1 else list(range(7, 13))
    for r in range(1, sh.nrows):
        try:
            cip = str(sh.cell_value(r, cip_c)).strip()
            cip = re.sub(r"\.0$", "", cip)
            cip = "".join(ch for ch in cip if ch.isdigit())
            if len(cip) != 13:
                continue
        except Exception:
            continue
        rec = acc.get(cip)
        if rec is None:
            rec = acc[cip] = {"m": [0.0] * 12, "atc": ""}
            if atc_c is not None:
                rec["atc"] = str(sh.cell_value(r, atc_c)).strip()
        for j, col in enumerate(boites_cols[:len(months)]):
            try:
                v = float(sh.cell_value(r, col) or 0)
            except Exception:
                v = 0.0
            rec["m"][months[j] - 1] += v
        seen.add((cip, sem))


def main():
    cat = catalogue_cips()
    urls = resource_map()
    acc, seen = {}, set()
    ok = 0
    for (y, sem), url in sorted(urls.items()):
        try:
            process(fetch(url), sem, acc, seen)
            ok += 1
            print("  chargé %d S%d" % (y, sem))
        except Exception as e:
            print("  échec %d S%d : %s" % (y, sem, e))
    # Garde de complétude (audit #3) : il faut les 2 semestres × 2 ans, sinon la moyenne est
    # divisée par ~2 et TOUS les indices sont gonflés (faux « pic janvier »). On conserve alors
    # le JSON précédent plutôt que d'en publier un faux.
    expected = 2 * len(YEARS)
    if ok < expected:
        print("ABANDON : %d/%d fichiers Medic'AM chargés — saison-cip.json précédent conservé (évite un faux pic)." % (ok, expected))
        return

    data = {}
    for cip, rec in acc.items():
        if cat and cip not in cat:
            continue
        tot = sum(rec["m"])
        if tot < MIN_BOITES:
            continue
        mean = tot / 12.0
        if mean <= 0:
            continue
        idx = [round(v / mean, 2) for v in rec["m"]]
        peak = max(range(12), key=lambda i: idx[i]) + 1
        data[cip] = {"i": idx, "p": peak, "a": rec["atc"]}

    out = {"generated": datetime.date.today().isoformat(), "source": "Medic'AM %s" % "+".join(str(y) for y in YEARS),
           "n": len(data), "data": data}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · produits avec saison=%d (sur %d CIP Medic'AM, catalogue=%d)" % (len(data), len(acc), len(cat)))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

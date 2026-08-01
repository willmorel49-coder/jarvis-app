#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_saison.py — Copilote / feed #4 : SAISONNALITÉ (Medic'AM mensuel).

Agrège les boîtes remboursées par CLASSE THÉRAPEUTIQUE (ATC niveau 2) et par mois,
calcule un indice saisonnier (mois vs moyenne annuelle), et écrit crm/v2/saison-data.js.
Le Copilote en tire « ce mois-ci, ces familles montent ».

Source : Medic'AM (ANSM/CNAM) — mêmes fichiers que generate_ameli_avg. Gratuit.
Python 3.9 · xlrd.
"""
import io
import os
import datetime
import re
import sys
import zipfile
import unicodedata
import urllib.request

import xlrd

OUT = os.path.join(os.path.dirname(__file__), "crm", "v2", "saison-data.js")
BASE = "https://www.assurance-maladie.ameli.fr/sites/default/files/"
SEMESTERS = ["2026-01-a-04", "2025-07-a-12", "2025-01-a-06"]
SUFFIX = "_medic-am-par-type-de-prescripteur_serie-mensuelle.zip"
MONTHS_FR = ["", "janvier", "février", "mars", "avril", "mai", "juin",
             "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s).strip().lower()


def download(name):
    dest = "/tmp/" + name + SUFFIX
    if os.path.exists(dest) and os.path.getsize(dest) > 100000:
        return dest
    try:
        req = urllib.request.Request(BASE + name + SUFFIX, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        if len(data) < 100000:
            return None
        open(dest, "wb").write(data)
        return dest
    except Exception as e:
        sys.stderr.write("  ! %s : %s\n" % (name, e))
        return None


def parse(path, by_atc):
    """by_atc[atc2] = {'l': libellé, 'm': {YYYY-MM: boites}} — onglet tous_presc."""
    with open(path, "rb") as f:
        zf = zipfile.ZipFile(io.BytesIO(f.read()))
        xls = next((n for n in zf.namelist() if n.lower().endswith(".xls")), None)
        if not xls:
            return
        raw = zf.read(xls)
    book = xlrd.open_workbook(file_contents=raw)
    sheet = None
    for sh in book.sheets():
        if "tous_presc" in norm(sh.name):
            sheet = sh; break
    if sheet is None:
        return
    headers = [norm(sheet.cell_value(0, c)) for c in range(sheet.ncols)]
    # colonnes ATC2 (code + libellé) et boîtes par mois
    atc2_code = atc2_lib = None
    box_cols = {}
    for c, h in enumerate(headers):
        if h in ("code atc 2", "code atc2"): atc2_code = c
        elif h in ("libelle atc 2", "libelle atc2", "classe atc 2"): atc2_lib = c
        elif "nombre de boites" in h:
            m = re.search(r"(20\d{2})[-\s]?(\d{2})", h)
            if m: box_cols[c] = m.group(1) + "-" + m.group(2)
    if atc2_code is None or not box_cols:
        return
    for r in range(1, sheet.nrows):
        code = str(sheet.cell_value(r, atc2_code) or "").strip()
        if not code:
            continue
        lib = str(sheet.cell_value(r, atc2_lib) or "").strip() if atc2_lib is not None else code
        d = by_atc.setdefault(code, {"l": lib, "m": {}})
        if not d["l"] and lib:
            d["l"] = lib
        for c, ym in box_cols.items():
            try:
                v = float(sheet.cell_value(r, c) or 0)
            except Exception:
                v = 0.0
            if v > 0:
                d["m"][ym] = d["m"].get(ym, 0.0) + v


def main():
    by_atc = {}
    got = 0
    print("Téléchargement + parsing Medic'AM (saisonnalité ATC2)…")
    for name in SEMESTERS:
        p = download(name)
        if p:
            parse(p, by_atc); got += 1
    if not by_atc:
        sys.exit("Aucune donnée.")
    print("Classes ATC2 : %d (%d fichiers)" % (len(by_atc), got))

    out = {}
    for code, d in by_atc.items():
        months = d["m"]
        total = sum(months.values())
        if total < 200000:   # on garde les classes à volume significatif
            continue
        # moyenne par mois calendaire (1-12) sur les années dispo
        bym = {}
        for ym, v in months.items():
            mm = int(ym[5:7])
            bym.setdefault(mm, []).append(v)
        cal = {}
        for mm, vals in bym.items():
            cal[mm] = sum(vals) / len(vals)
        if len(cal) < 6:
            continue
        avg = sum(cal.values()) / len(cal)
        if avg <= 0:
            continue
        idx = [0] * 13   # idx[1..12]
        for mm in range(1, 13):
            idx[mm] = round((cal.get(mm, avg) / avg) * 100)   # 100 = moyenne
        out[code] = {"l": d["l"], "idx": idx, "tot": int(total)}

    print("Classes retenues : %d" % len(out))
    items = ",".join(
        '"%s":{l:"%s",idx:[%s]}'
        % (code, d["l"].replace('"', "'")[:44], ",".join(str(d["idx"][m]) for m in range(1, 13)))
        for code, d in sorted(out.items(), key=lambda x: -x[1]["tot"])
    )
    js = (
        "// Copilote — saisonnalité par classe thérapeutique (ATC2). idx[0..11] = indice\n"
        "// par mois (jan..déc), 100 = moyenne annuelle. Source: Medic'AM. Indicatif.\n"
        "// Généré par generate_saison.py — ne pas éditer.\n"
        "window.SAISON={meta:{gen:\"%s\",source:\"Medic'AM\"},data:{%s}};\n"
    ) % (datetime.date.today().isoformat(), items)
    open(OUT, "w", encoding="utf-8").write(js)
    print("Écrit %s (%d Ko, %d classes)" % (OUT, os.path.getsize(OUT) // 1024, len(out)))

    # contrôle : top classes qui montent en juillet (mois 7)
    ranked = sorted(out.items(), key=lambda x: -x[1]["idx"][7])[:5]
    print("Top classes en juillet :", [(d["l"][:26], d["idx"][7]) for _, d in ranked])


if __name__ == "__main__":
    main()

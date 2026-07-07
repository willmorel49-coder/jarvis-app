#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_tendance.py — Copilote / feed #5 : TENDANCE MARCHÉ (croissance sur un an).

Compare, par produit (CIP13), les boîtes remboursées France des mois disponibles en
2026 vs les MÊMES mois en 2025 (Medic'AM) → croissance YoY %. Écrit crm/v2/tendance-data.js.
Le Copilote en tire « marchés en croissance / en déclin » — une info que les commerciaux
n'ont pas.

Source : Medic'AM (mêmes fichiers que generate_ameli_avg). Gratuit. Python 3.9 · xlrd.
"""
import io
import os
import re
import sys
import zipfile
import unicodedata
import urllib.request

import xlrd

OUT = os.path.join(os.path.dirname(__file__), "crm", "v2", "tendance-data.js")
OUT_MOM = os.path.join(os.path.dirname(__file__), "crm", "v2", "momentum-data.js")
BASE = "https://www.assurance-maladie.ameli.fr/sites/default/files/"
SEMESTERS = ["2026-01-a-04", "2026-01-a-06", "2025-07-a-12", "2025-01-a-06"]
SUFFIX = "_medic-am-par-type-de-prescripteur_serie-mensuelle.zip"
MIN_2025 = 400        # volume plancher (sur les mois comparés) pour un signal fiable
MOM_WINDOW = 8        # nb de mois récents pour l'accélération (pente)
MIN_MOM_RECENT = 500  # volume plancher sur la fenêtre récente (anti-bruit)


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


def cip13(v):
    try:
        return str(int(float(v))).zfill(13)
    except Exception:
        s = re.sub(r"\D", "", str(v or ""))
        return s.zfill(13) if s else None


def parse(path, by_cip, months_seen):
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
    box_cols = {}
    for c, h in enumerate(headers):
        if "nombre de boites" in h:
            m = re.search(r"(20\d{2})[-\s]?(\d{2})", h)
            if m:
                box_cols[c] = (m.group(1), m.group(2))   # (year, month)
    for c, ym in box_cols.items():
        months_seen.add(ym)
    for r in range(1, sheet.nrows):
        cip = cip13(sheet.cell_value(r, 0))
        if not cip or len(cip) != 13:
            continue
        d = by_cip.setdefault(cip, {})
        for c, ym in box_cols.items():
            try:
                v = float(sheet.cell_value(r, c) or 0)
            except Exception:
                v = 0.0
            if v > 0:
                d[ym] = d.get(ym, 0.0) + v


def main():
    by_cip = {}
    months = set()
    print("Téléchargement + parsing Medic'AM (tendance YoY)…")
    for name in SEMESTERS:
        p = download(name)
        if p:
            parse(p, by_cip, months)
    if not by_cip:
        sys.exit("Aucune donnée.")

    # mois présents à la fois en 2025 et 2026 (mêmes mois calendaires)
    m2026 = set(mm for (yy, mm) in months if yy == "2026")
    m2025 = set(mm for (yy, mm) in months if yy == "2025")
    common = sorted(m2026 & m2025)
    if not common:
        sys.exit("Pas de mois comparables 2025/2026.")
    print("Mois comparés (2026 vs 2025) : %s" % ", ".join(common))

    data = {}
    for cip, mo in by_cip.items():
        s25 = sum(mo.get(("2025", mm), 0.0) for mm in common)
        s26 = sum(mo.get(("2026", mm), 0.0) for mm in common)
        if s25 < MIN_2025:
            continue
        growth = round((s26 / s25 - 1) * 100)
        # on borne pour éviter les valeurs délirantes (ruptures/relances)
        if growth > 300:
            growth = 300
        if growth < -95:
            growth = -95
        data[cip] = growth

    ups = sorted(data.items(), key=lambda x: -x[1])
    print("Produits avec tendance : %d" % len(data))
    print("Top hausses :", [(c, "+%d%%" % g) for c, g in ups[:4]])
    print("Top baisses :", [(c, "%d%%" % g) for c, g in ups[-4:]])

    items = ",".join('"%s":%d' % (c, g) for c, g in sorted(data.items()))
    js = (
        "// Copilote — tendance marché (croissance YoY %%) par CIP13, mois %s de 2026 vs 2025.\n"
        "// Source: Medic'AM. Indicatif. Généré par generate_tendance.py — ne pas éditer.\n"
        "window.TENDANCE={meta:{mois:\"%s\",source:\"Medic'AM\"},data:{%s}};\n"
    ) % ("/".join(common), "/".join(common), items)
    open(OUT, "w", encoding="utf-8").write(js)
    print("Écrit %s (%d Ko, %d produits)" % (OUT, os.path.getsize(OUT) // 1024, len(data)))

    # ── MOMENTUM / ACCÉLÉRATION : pente des ventes mensuelles sur la fenêtre récente ──
    # Signal « ça décolle EN CE MOMENT » (mois par mois), plus précoce que le YoY.
    window = sorted(months, key=lambda ym: ym[0] + ym[1])[-MOM_WINDOW:]
    n = len(window)
    sx = sum(range(n))
    sxx = sum(i * i for i in range(n))
    denom = n * sxx - sx * sx
    mom = {}
    for cip, mo in by_cip.items():
        ys = [mo.get(ym, 0.0) for ym in window]
        tot = sum(ys)
        if tot < MIN_MOM_RECENT or denom == 0:
            continue
        mean = tot / n
        if mean <= 0:
            continue
        sy = tot
        sxy = sum(i * ys[i] for i in range(n))
        slope = (n * sxy - sx * sy) / denom       # boîtes gagnées par mois
        pct = round(slope / mean * 100)           # %/mois vs volume moyen de la fenêtre
        if pct > 150:
            pct = 150
        if pct < -95:
            pct = -95
        if pct != 0:
            mom[cip] = pct

    upm = sorted(mom.items(), key=lambda x: -x[1])
    print("Produits avec momentum : %d" % len(mom))
    print("Top accélérations :", [(c, "+%d%%/mois" % g) for c, g in upm[:4]])
    mlabel = window[0][0] + "-" + window[0][1] + "→" + window[-1][0] + "-" + window[-1][1]
    mitems = ",".join('"%s":%d' % (c, g) for c, g in sorted(mom.items()))
    mjs = (
        "// Copilote — momentum/accélération (%% de progression par mois) par CIP13,\n"
        "// pente des ventes Medic'AM sur les %d derniers mois (%s). Généré par generate_tendance.py.\n"
        "window.MOMENTUM={meta:{fenetre:\"%s\",mois:%d,source:\"Medic'AM\"},data:{%s}};\n"
    ) % (MOM_WINDOW, mlabel, mlabel, MOM_WINDOW, mitems)
    open(OUT_MOM, "w", encoding="utf-8").write(mjs)
    print("Écrit %s (%d Ko, %d produits)" % (OUT_MOM, os.path.getsize(OUT_MOM) // 1024, len(mom)))


if __name__ == "__main__":
    main()

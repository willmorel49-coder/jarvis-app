#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_ameli_avg.py — Copilote pharmacien / module "Marché & moyenne par pharmacie".

Télécharge Medic'AM (par type de prescripteur, interrégimes) directement sur Ameli,
calcule la MOYENNE de boîtes remboursées / pharmacie / an par produit (CIP13),
sur les 12 derniers mois disponibles, et écrit crm/v2/ameli-avg-data.js.

Source : boîtes remboursées France (soins de ville, tous régimes, remboursables) —
onglet "tous_presc". À titre INDICATIF : boîtes remboursées ÷ nb d'officines
(NB_OFFICINES). Ne reflète pas les ventes réelles d'une officine (hors automédication
non remboursée). Voir docs/superpowers/specs/2026-07-03-ameli-moyenne-pharmacie-design.md.

Python 3.9. Dépend de xlrd (les fichiers Medic'AM sont des .xls binaires).
"""
import io
import os
import re
import sys
import zipfile
import unicodedata
import urllib.request

import xlrd

# ── Réglages ────────────────────────────────────────────────────────────────
NB_OFFICINES = 20000          # CNOP 1er janv. 2025 : 20 242 (métropole+DOM), en baisse ~1%/an
N_MONTHS = 12                 # fenêtre glissante
OUT = os.path.join(os.path.dirname(__file__), "crm", "v2", "ameli-avg-data.js")
TMP = "/tmp"
BASE = "https://www.assurance-maladie.ameli.fr/sites/default/files/"
# Semestres candidats (du + récent au + ancien) — le robot prend ceux qui existent
# jusqu'à couvrir 12 mois. Mettre à jour la liste quand un nouveau semestre sort.
SEMESTERS = [
    "2026-07-a-12", "2026-01-a-06", "2026-01-a-05", "2026-01-a-04", "2026-01-a-03",
    "2025-07-a-12", "2025-01-a-06",
]
SUFFIX = "_medic-am-par-type-de-prescripteur_serie-mensuelle.zip"
SANITY_MAX = 21500            # garde-fou : > n°1 France (paracétamol ~21k/officine/an) = suspect


def norm(s):
    """minuscule, sans accents, espaces compactés — pour comparer les en-têtes."""
    s = "" if s is None else str(s)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s).strip().lower()


def download(name):
    url = BASE + name + SUFFIX
    dest = os.path.join(TMP, name + SUFFIX)
    if os.path.exists(dest) and os.path.getsize(dest) > 100000:
        return dest
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        if len(data) < 100000:
            return None
        with open(dest, "wb") as f:
            f.write(data)
        return dest
    except Exception as e:
        sys.stderr.write("  ! %s : %s\n" % (name, e))
        return None


def cip13(v):
    """CIP13 stocké en flottant -> str 13 chiffres (zéro de tête préservé)."""
    try:
        n = int(float(v))
        return str(n).zfill(13)
    except Exception:
        s = re.sub(r"\D", "", str(v))
        return s.zfill(13) if s else None


def parse_zip(path, boxes_by_cip, months_seen):
    """Lit l'onglet *tous_presc*, ajoute les boîtes par CIP pour chaque mois."""
    with open(path, "rb") as f:
        zf = zipfile.ZipFile(io.BytesIO(f.read()))
        xls_name = next((n for n in zf.namelist() if n.lower().endswith(".xls")), None)
        if not xls_name:
            return
        raw = zf.read(xls_name)
    book = xlrd.open_workbook(file_contents=raw)
    sheet = None
    for sh in book.sheets():
        if "tous_presc" in norm(sh.name):
            sheet = sh
            break
    if sheet is None:
        return
    headers = [norm(sheet.cell_value(0, c)) for c in range(sheet.ncols)]
    # colonnes "nombre de boites remboursees YYYY-MM"
    box_cols = {}   # col_index -> "YYYY-MM"
    for c, h in enumerate(headers):
        if "nombre de boites" in h:
            m = re.search(r"(20\d{2})[-\s]?(\d{2})", h)
            if m:
                box_cols[c] = m.group(1) + "-" + m.group(2)
    if not box_cols:
        return
    for c, ym in box_cols.items():
        months_seen.add(ym)
    for r in range(1, sheet.nrows):
        cip = cip13(sheet.cell_value(r, 0))
        if not cip or len(cip) != 13:
            continue
        d = boxes_by_cip.setdefault(cip, {})
        for c, ym in box_cols.items():
            try:
                val = float(sheet.cell_value(r, c) or 0)
            except Exception:
                val = 0.0
            if val > 0:
                d[ym] = d.get(ym, 0.0) + val


def main():
    boxes_by_cip = {}
    months_seen = set()
    got = []
    print("Téléchargement + parsing Medic'AM (onglet tous_presc)…")
    for name in SEMESTERS:
        # on s'arrête dès qu'on a >= 12 mois distincts
        if len(months_seen) >= N_MONTHS and len(got) >= 2:
            break
        p = download(name)
        if not p:
            continue
        before = len(months_seen)
        parse_zip(p, boxes_by_cip, months_seen)
        if len(months_seen) > before:
            got.append(name)
            print("  · %s → %d mois cumulés" % (name, len(months_seen)))

    if not months_seen:
        sys.exit("Aucune donnée Medic'AM récupérée — vérifier les URLs/semestres.")

    # 12 derniers mois disponibles
    window = sorted(months_seen)[-N_MONTHS:]
    n_win = len(window)
    print("Fenêtre retenue : %s → %s (%d mois)" % (window[0], window[-1], n_win))

    data = {}
    suspects = 0
    for cip, mo in boxes_by_cip.items():
        total = sum(mo.get(ym, 0.0) for ym in window)
        if total <= 0:
            continue
        annual = total * 12.0 / n_win          # annualisation (si < 12 mois)
        avg = round(annual / NB_OFFICINES)
        if avg <= 0:
            continue
        if avg > SANITY_MAX:
            suspects += 1
        data[cip] = avg

    print("Produits avec moyenne : %d  (suspects >%d : %d)" % (len(data), SANITY_MAX, suspects))

    # écriture du fichier JS (compact, une valeur par CIP)
    periode = window[0] + "→" + window[-1]
    items = ",".join('"%s":%d' % (c, v) for c, v in sorted(data.items()))
    js = (
        "// Ameli Medic'AM — moyenne boîtes remboursées / pharmacie / an (INDICATIF)\n"
        "// Source: assurance-maladie.ameli.fr Medic'AM (interrégimes, tous prescripteurs, soins de ville)\n"
        "// Base: %d officines · fenêtre %s (%d mois annualisés) · remboursables uniquement\n"
        "// Généré par generate_ameli_avg.py — NE PAS éditer à la main.\n"
        "window.AMELI_AVG={meta:{periode:\"%s\",base:%d,mois:%d,source:\"Medic'AM\",unite:\"boites/pharmacie/an\"},data:{%s}};\n"
    ) % (NB_OFFICINES, periode, n_win, periode, NB_OFFICINES, n_win, items)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    kb = os.path.getsize(OUT) // 1024
    print("Écrit %s (%d Ko, %d produits)" % (OUT, kb, len(data)))

    # sanity-check paracétamol (CIP Doliprane 1000 cpr connus) — informatif
    for cip in ("3400935955838", "3400936801981", "3400930082935"):
        if cip in data:
            print("  sanity %s → %d boîtes/officine/an" % (cip, data[cip]))


if __name__ == "__main__":
    main()

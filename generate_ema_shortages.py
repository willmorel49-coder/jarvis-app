#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_ema_shortages.py — Veille APPRO : signal AMONT de rupture (Europe).

Une rupture évaluée au niveau européen précède souvent la déclaration française
(ANSM, déjà branchée). Croisé avec le catalogue par SUBSTANCE ACTIVE (INN), ça
donne quelques jours d'avance pour sécuriser l'appro d'un produit menacé.

Source : EMA, "Shortages catalogue" (xlsx public, aucune clé, maj chaque nuit).
Parsing xlsx en stdlib pure (zipfile + XML) — aucune dépendance à installer en CI.

Écrit crm/v2/ema-shortages.json. Python 3.9.
"""
import io
import os
import json
import zipfile
import datetime
import urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "ema-shortages.json")
URL = "https://www.ema.europa.eu/en/documents/report/medicines-output-shortages-report_en.xlsx"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def parse_xml_sur(brut):
    """Parse du XML en refusant DOCTYPE/entités : neutralise XXE et billion-laughs
    sans dépendance externe (defusedxml casserait le patron zéro-install en CI).
    Un xlsx légitime ne contient jamais de déclaration d'entité."""
    tete = brut[:4096].lower()
    if b"<!doctype" in tete or b"<!entity" in tete:
        raise SystemExit("XML suspect (DOCTYPE/ENTITY) — refusé.")
    return ET.fromstring(brut)


def cellules(row, shared):
    out = []
    for c in row.findall(NS + "c"):
        v = c.find(NS + "v")
        if v is None:
            out.append("")
        elif c.get("t") == "s":
            out.append(shared[int(v.text)])
        else:
            out.append(v.text or "")
    return out


def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (JARVIS veille appro)"})
    with urllib.request.urlopen(req, timeout=90) as r:
        brut = r.read()
    z = zipfile.ZipFile(io.BytesIO(brut))

    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = parse_xml_sur(z.read("xl/sharedStrings.xml"))
        for si in root.findall(NS + "si"):
            shared.append("".join(t.text or "" for t in si.iter(NS + "t")))

    sheet = parse_xml_sur(z.read("xl/worksheets/sheet1.xml"))
    rows = [cellules(r, shared) for r in sheet.findall(".//" + NS + "row")]

    # Repérer la ligne d'en-tête (contient "Medicine affected")
    h = None
    for i, row in enumerate(rows):
        if any("medicine affected" in (c or "").lower() for c in row):
            h = i
            break
    if h is None:
        raise SystemExit("EMA : en-tête introuvable, on ne réécrit pas le fichier.")

    def idx(nom):
        for j, c in enumerate(rows[h]):
            if nom.lower() in (c or "").lower():
                return j
        return -1

    ci = {k: idx(v) for k, v in {
        "med": "Medicine affected", "statut": "Supply shortage status",
        "inn": "International non-proprietary", "aire": "Therapeutic area",
        "forme": "Pharmaceutical forms", "alt": "Availability of alternatives",
        "debut": "Start of shortage", "fin": "Expected resolution date",
        "maj": "Last updated", "url": "Shortage URL"}.items()}

    def val(row, k):
        j = ci[k]
        return (row[j].strip() if 0 <= j < len(row) else "")

    items = []
    for row in rows[h + 1:]:
        med = val(row, "med")
        if not med:
            continue
        statut = val(row, "statut")
        items.append({
            "med": med,
            "inn": val(row, "inn").lower(),        # clé de couplage catalogue
            "en_cours": "ongoing" in statut.lower(),
            "aire": val(row, "aire"),
            "forme": val(row, "forme"),
            "alt": val(row, "alt"),                # alternative dispo ? Yes/No
            "debut": val(row, "debut"),
            "fin": val(row, "fin"),
            "maj": val(row, "maj"),
            "url": val(row, "url"),
        })

    en_cours = [x for x in items if x["en_cours"]]
    out = {
        "maj": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "source": "EMA — Shortages catalogue (public)",
        "n_total": len(items),
        "n_en_cours": len(en_cours),
        "ruptures": items,
    }
    tmp = OUT + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)

    print("EMA OK — %d ruptures (%d en cours)." % (len(items), len(en_cours)))
    for x in en_cours[:4]:
        print("  · %s (%s) — alt: %s" % (x["med"], x["inn"] or "?", x["alt"] or "?"))
    print("→ %s (%d o)" % (OUT, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()

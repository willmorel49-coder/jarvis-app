#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_ema_penuries.py — Fil d'anticipation (APPRO › Actu) : catalogue des pénuries de l'EMA.

L'Agence européenne des médicaments publie chaque nuit (06 h) un fichier Excel public des
pénuries évaluées au niveau européen (~90 lignes). Aucune clé. Réutilisation autorisée,
commerciale comprise, à condition de citer l'EMA (https://www.ema.europa.eu/en/about-us/legal-notice).
robots.txt contrôlé le 13/10/2026 : le dossier /documents/report/ n'est pas interdit.

Rapprochement avec le catalogue (fiable seulement) :
  - `cips`     : références dont la désignation commence par la marque ET dont la DCI (table pivot)
                 contient la substance de l'EMA ;
  - `cips_dci` : autres références de la même substance (alternatives disponibles au catalogue).
Rien n'est inventé : sans correspondance, les deux listes restent vides.

GARDE-FOU : téléchargement en échec, fichier illisible ou moins de MIN_LIGNES lignes
→ sortie en erreur (code 1) SANS toucher au JSON existant.

Écrit crm/v2/ema-penuries.json. Python 3.9 · urllib + openpyxl (comme generate_ema_generiques.py).
"""
import io
import os
import re
import sys
import json
import datetime
import unicodedata
import urllib.request

import openpyxl

URL = os.environ.get("EMA_PENURIES_URL",
                     "https://www.ema.europa.eu/en/documents/report/medicines-output-shortages-report_en.xlsx")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "ema-penuries.json")
PIVOT = os.path.join(HERE, "crm", "v2", "pivot.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")
MIN_LIGNES = 20
MAX_ALT = 40


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "JARVIS-robot/1.0 (veille approvisionnement)"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def mots(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).split()


def iso_date(v):
    if not v:
        return None
    if hasattr(v, "date"):
        return v.date().isoformat()
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(v))
    return "%s-%02d-%02d" % (m.group(3), int(m.group(2)), int(m.group(1))) if m else None


def catalogue():
    """[(cip, designation en mots, dci en texte normalisé)] pour les références du catalogue."""
    try:
        txt = io.open(PRODSTATS, "r", encoding="utf-8").read()
        arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
        piv = json.load(io.open(PIVOT, "r", encoding="utf-8"))
        data = piv.get("data", piv)
        res = []
        for p in arr:
            rec = data.get(str(p.get("c")))
            if rec and rec.get("dci"):
                res.append((str(p["c"]), mots(p.get("d")), " ".join(mots(rec["dci"]))))
        return res
    except Exception as e:
        print("AVERTISSEMENT : catalogue illisible (%s) — aucun rapprochement" % e)
        return []


def rapprocher(cat, nom, inn):
    marques = [mots(b)[0] for b in re.split(r"[/,]", nom) if mots(b) and len(mots(b)[0]) >= 4]
    sub = (mots(inn) or [""])[0]
    if len(sub) < 5:
        return [], []
    exact, alt = [], []
    for cip, des, dci in cat:
        if sub not in dci.split() and sub not in dci:
            continue
        if des and any(des[0].startswith(m) for m in marques):
            exact.append(cip)
        else:
            alt.append(cip)
    return exact, alt[:MAX_ALT]


def lire(contenu):
    wb = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True)
    rows = list(wb.active.iter_rows(values_only=True))
    hidx = next((i for i, r in enumerate(rows[:30]) if r and any(str(c).strip() == "Medicine affected" for c in r if c)), None)
    if hidx is None:
        raise ValueError("en-tête « Medicine affected » introuvable")
    H = {str(h).strip(): i for i, h in enumerate(rows[hidx]) if h}

    def g(r, prefix):
        for k, i in H.items():
            if k.startswith(prefix):
                return r[i] if i < len(r) else None
        return None
    gen = []
    for r in rows[hidx + 1:]:
        nom = str(g(r, "Medicine affected") or "").strip()
        if nom:
            gen.append((nom, r, g))
    return gen


def main():
    try:
        contenu = fetch(URL)
        lignes = lire(contenu)
    except Exception as e:
        print("ERREUR : %s — JSON existant conservé" % e)
        return 1
    if len(lignes) < MIN_LIGNES:
        print("ERREUR : %d lignes lues (< %d) — JSON existant conservé" % (len(lignes), MIN_LIGNES))
        return 1
    cat = catalogue()
    items = []
    for nom, r, g in lignes:
        inn = str(g(r, "International non-proprietary") or "").strip()
        exp = g(r, "Expected resolution date")
        exp_txt = g(r, "Expected resolution")
        cips, alt = rapprocher(cat, nom, inn)
        pub = iso_date(g(r, "First published"))
        items.append({
            "name": nom, "inn": inn,
            "status": str(g(r, "Supply shortage status") or "").strip(),
            "start": iso_date(g(r, "Start of shortage")) or pub,
            "start_is_pub": not iso_date(g(r, "Start of shortage")),
            "resolution": iso_date(exp), "resolution_txt": str(exp_txt).strip() if exp_txt not in (None, "") and not iso_date(exp) else "",
            "alternatives": str(g(r, "Availability of alternatives") or "").strip(),
            "updated": iso_date(g(r, "Last updated")),
            "url": str(g(r, "Shortage URL") or "").strip(),
            "cips": cips, "cips_dci": alt,
        })
    res = {"generated": datetime.date.today().isoformat(), "source": "EMA — European Medicines Agency (catalogue des pénuries)",
           "n": len(items), "items": items}
    tmp = OUT + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    n_us = sum(1 for x in items if x["cips"])
    print("OK · %d lignes · %d avec une référence du catalogue (marque + substance)" % (len(items), n_us))
    for x in items[:3]:
        print("  %s | %s | %s | début %s | fin %s%s" % (x["name"][:28], x["inn"][:24], x["status"], x["start"], x["resolution"] or "-", x["resolution_txt"]))
    print("→ %s (%d o)" % (OUT, os.path.getsize(OUT)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

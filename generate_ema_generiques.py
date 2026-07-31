#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_ema_generiques.py — Anticipation : génériques & biosimilaires en approche (EMA).

L'Agence européenne du médicament (EMA) publie un fichier quotidien de tous les médicaments
évalués/autorisés au niveau UE. Les lignes « Generic » ou « Biosimilar » avec une AMM récente
(ou un avis adopté sans AMM = en pipeline) = un générique/biosimilaire qui arrive sur le marché
FR dans les mois qui viennent → signal « préparer la bascule » 6-18 mois à l'avance. On restreint
aux MOLÉCULES que le réseau gère (DCI de notre catalogue via la table pivot) pour rester actionnable.

Source : https://www.ema.europa.eu/en/documents/report/medicines-output-medicines-report_en.xlsx
Gratuit, sans clé. Écrit crm/v2/ema-generiques.json. Python 3.9 · urllib + openpyxl.
"""
import io
import os
import re
import json
import datetime
import urllib.request

import openpyxl

URL = "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines-report_en.xlsx"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "ema-generiques.json")
PIVOT = os.path.join(HERE, "crm", "v2", "pivot.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")

RECENT_DAYS = 730   # AMM des 2 dernières années = « vient d'arriver / arrive »


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def catalogue_dci():
    """DCI (molécules) des CIP de notre catalogue, via la table pivot cip13→dci."""
    try:
        cat = set()
        txt = io.open(PRODSTATS, "r", encoding="utf-8").read()
        arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
        cips = set(str(p.get("c")) for p in arr if p.get("c"))
        piv = json.load(io.open(PIVOT, "r", encoding="utf-8"))
        data = piv.get("data", piv)
        for c in cips:
            rec = data.get(c)
            if rec and rec.get("dci"):
                cat.add(rec["dci"].strip().lower())
        return cat
    except Exception:
        return set()


def norm(s):
    return re.sub(r"[^a-z ]", "", str(s or "").lower()).strip()


def iso_date(v):
    if not v:
        return None
    if hasattr(v, "isoformat"):
        try:
            return v.date().isoformat()
        except Exception:
            return v.isoformat()[:10]
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(v))
    if m:
        return "%s-%02d-%02d" % (m.group(3), int(m.group(2)), int(m.group(1)))
    return None


def main():
    dci = catalogue_dci()
    wb = openpyxl.load_workbook(io.BytesIO(fetch(URL)), read_only=True, data_only=True)
    sh = wb.active
    rows = list(sh.iter_rows(values_only=True))
    hidx = next((i for i, r in enumerate(rows[:15]) if r and any("Name of medicine" == str(c).split("\n")[0].strip() for c in r if c)), 8)
    hdr = rows[hidx]
    H = {}
    for i, h in enumerate(hdr):
        if h:
            H[str(h).split("\n")[0].strip()] = i

    def col(name):
        for k, i in H.items():
            if k.lower() == name.lower():
                return i
        for k, i in H.items():
            if k.lower().startswith(name.lower()):
                return i
        return None

    ci_name = col("Name of medicine")
    ci_inn = col("International non-proprietary name (INN)")
    ci_gen = col("Generic")
    ci_bio = col("Biosimilar")
    ci_atc = col("ATC code (human)")
    ci_amm = col("Marketing authorisation date")
    ci_op = col("Opinion adopted date")
    ci_status = col("Medicine status")

    today = datetime.date.today()
    out = []
    for r in rows[hidx + 1:]:
        try:
            gx = str(r[ci_gen]).strip().lower() in ("yes", "true", "1") if ci_gen is not None else False
            bio = str(r[ci_bio]).strip().lower() in ("yes", "true", "1") if ci_bio is not None else False
            if not (gx or bio):
                continue
            inn = str(r[ci_inn] or "").strip() if ci_inn is not None else ""
            if dci and norm(inn) not in dci:
                continue   # molécule hors de notre catalogue
            amm = iso_date(r[ci_amm]) if ci_amm is not None else None
            op = iso_date(r[ci_op]) if ci_op is not None else None
            status = str(r[ci_status] or "").strip() if ci_status is not None else ""
            # pertinence : AMM récente (2 ans) OU avis adopté sans AMM (pipeline)
            recent = False
            if amm:
                try:
                    recent = (today - datetime.date.fromisoformat(amm)).days <= RECENT_DAYS
                except Exception:
                    recent = False
            pipeline = (not amm) and bool(op)
            if not (recent or pipeline):
                continue
            out.append({"inn": inn, "name": str(r[ci_name] or "").strip()[:40],
                        "type": "biosimilaire" if bio else "générique",
                        "atc": str(r[ci_atc] or "").strip() if ci_atc is not None else "",
                        "amm": amm, "opinion": op, "pipeline": pipeline, "status": status})
        except Exception:
            continue

    # dédupe par (inn, name), tri : pipeline d'abord, puis AMM la plus récente
    seen, dedup = set(), []
    out.sort(key=lambda x: (0 if x["pipeline"] else 1, x.get("amm") or "0000"), reverse=False)
    out.sort(key=lambda x: (x["pipeline"], x.get("amm") or ""), reverse=True)
    for x in out:
        k = (x["inn"].lower(), x["name"].lower())
        if k in seen:
            continue
        seen.add(k)
        dedup.append(x)

    res = {"generated": today.isoformat(), "source": "EMA — European Medicines Agency (medicines report)",
           "restreint_catalogue": bool(dci), "n": len(dedup), "items": dedup[:60]}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · catalogue DCI=%d · génériques/biosimilaires pertinents=%d" % (len(dci), len(dedup)))
    for x in dedup[:8]:
        print("  %s  %s  (%s)  AMM=%s%s" % (x["type"][:5], x["inn"][:22], x["name"][:20], x.get("amm"), " [pipeline]" if x["pipeline"] else ""))
    print("→ %s (%d o)" % (OUT, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()

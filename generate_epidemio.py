#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_epidemio.py — Veille APPRO : signaux de DEMANDE (Réseau Sentinelles).

Incidence hebdomadaire des pathologies qui font bouger le comptoir : grippe/IRA (3),
gastro-entérite (6), varicelle (7) — national + régional, cas pour 100 000 hab.
Permet d'anticiper le pic d'achat AVANT le rush (renforcer ORL/antipyrétiques,
antidiarrhéiques, antihistaminiques… selon ce qui monte et où).

Source : Réseau Sentinelles (Sentiweb), CSV ouverts, aucune clé.
Écrit crm/v2/epidemio.json. Python 3.9, urllib seul.
"""
import io
import os
import csv
import json
import datetime
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "epidemio.json")
BASE = "https://www.sentiweb.fr/datasets/all/"

INDIC = [
    {"code": 3, "label": "Grippe / IRA", "cat": "grippe"},
    {"code": 6, "label": "Gastro-entérite", "cat": "gastro"},
    {"code": 7, "label": "Varicelle", "cat": "varicelle"},
]


def fetch_rows(name):
    req = urllib.request.Request(BASE + name + ".csv", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        text = r.read().decode("utf-8", "ignore")
    lines = [ln for ln in text.splitlines() if ln and not ln.startswith("#")]
    return list(csv.DictReader(lines))


def to_int(v):
    try:
        return int(float(v))
    except Exception:
        return None


def main():
    out_indic = []
    week_ref = None
    for cfg in INDIC:
        # National : tendance semaine N vs N-1
        try:
            nat = fetch_rows("inc-%d-PAY" % cfg["code"])
        except Exception:
            continue
        nat = [r for r in nat if r.get("inc100") not in (None, "", "NA")]
        nat.sort(key=lambda r: r.get("week", ""), reverse=True)
        if not nat:
            continue
        cur, prev = nat[0], (nat[1] if len(nat) > 1 else None)
        week_ref = week_ref or cur.get("week")
        inc = to_int(cur.get("inc100"))
        pinc = to_int(prev.get("inc100")) if prev else None
        trend = None
        if inc is not None and pinc:
            trend = round((inc - pinc) / pinc * 100)
        # Régional : top régions de la dernière semaine
        regions = []
        try:
            rdd = fetch_rows("inc-%d-RDD" % cfg["code"])
            wk = cur.get("week")
            rdd = [r for r in rdd if r.get("week") == wk and r.get("inc100") not in (None, "", "NA")]
            rdd.sort(key=lambda r: to_int(r.get("inc100")) or 0, reverse=True)
            for r in rdd[:5]:
                regions.append({"c": r.get("geo_insee"), "n": r.get("geo_name"), "inc100": to_int(r.get("inc100"))})
        except Exception:
            pass
        out_indic.append({
            "code": cfg["code"], "label": cfg["label"], "cat": cfg["cat"],
            "inc100": inc, "prev": pinc, "trend": trend, "week": cur.get("week"),
            "regions": regions,
        })

    # tri : ce qui monte le plus d'abord
    out_indic.sort(key=lambda x: (x["trend"] if x["trend"] is not None else -999), reverse=True)
    out = {"generated": datetime.date.today().isoformat(), "source": "Réseau Sentinelles",
           "week": week_ref, "indicators": out_indic}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · semaine %s · %d indicateurs" % (week_ref, len(out_indic)))
    for i in out_indic:
        print("  %s : %s/100k (tendance %s%%) · top région %s" % (
            i["label"], i["inc100"], i["trend"], (i["regions"][0]["n"] if i["regions"] else "-")))
    print("→ %s (%d o)" % (OUT, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()

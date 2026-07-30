#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_odisse.py — Veille APPRO : signaux de demande fins (SurSaUD / Odissé, Santé publique France).

Passages aux urgences + actes SOS Médecins par PATHOLOGIE et par DÉPARTEMENT (grippe,
bronchiolite, gastro-entérite). Plus fin que le Réseau Sentinelles (déjà branché, régional) :
maille département + bronchiolite (absente de Sentinelles). Permet « la grippe monte dans
le 44/49 cette semaine → pré-positionner l'ORL sur le secteur avant la vague ».

Source : datasantepubliquefrance.opendatasoft.com (ODS v2.1, gratuit, sans clé).
Écrit crm/v2/odisse.json. Python 3.9, urllib seul.
"""
import io
import os
import json
import datetime
import urllib.parse
import urllib.request

BASE = "https://datasantepubliquefrance.opendatasoft.com/api/explore/v2.1/catalog/datasets/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "odisse.json")

PATHOS = [
    {"ds": "grippe-passages-aux-urgences-et-actes-sos-medecins", "label": "Grippe / IRA", "cat": "grippe", "age": "Tous âges"},
    {"ds": "bronchiolite-passages-aux-urgences-et-actes-sos-medecins", "label": "Bronchiolite", "cat": "bronchiolite", "age": "0 an"},
    {"ds": "gastro-enterite-aigue-passages-aux-urgences-et-actes-sos-medecins", "label": "Gastro-entérite", "cat": "gastro", "age": "Tous âges"},
]


def fetch_records(dataset, where=None, limit=100, order=None, refine=None):
    params = []
    params.append(("limit", str(min(limit, 100))))   # ODS v2.1 : 100 max par requête
    if where:
        params.append(("where", where))
    if order:
        params.append(("order_by", order))
    for rf in (refine or []):
        params.append(("refine", rf))
    url = BASE + dataset + "/records?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip
            raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8", "ignore")).get("results", [])


def taux_field(rec):
    for k in rec:
        if k.startswith("taux_passages_"):
            return k
    return None


def main():
    week = None
    out = []
    for p in PATHOS:
        age = p["age"]
        try:
            nat = fetch_records(p["ds"] + "-france", where='sursaud_cl_age_gene="%s"' % age, limit=6, order="date_complet desc")
        except Exception:
            nat = []
        nat = [r for r in nat if r.get("date_complet")]
        if not nat:
            continue
        tf = taux_field(nat[0])
        cur, prev = nat[0], (nat[1] if len(nat) > 1 else None)
        week = week or cur.get("semaine")
        val = cur.get(tf)
        pval = prev.get(tf) if prev else None
        trend = None
        if val is not None and pval:
            try:
                trend = round((val - pval) / pval * 100)
            except Exception:
                trend = None
        # départements chauds : on récupère les dernières semaines et on filtre côté Python (where AND fragile)
        hot = []
        try:
            deps = fetch_records(p["ds"] + "-departement", refine=["sursaud_cl_age_gene:" + age], order="date_complet desc", limit=100)
            if deps:
                date0 = deps[0].get("date_complet")
                deps = [d for d in deps if d.get("date_complet") == date0]
                df = taux_field(deps[0])
                deps = [d for d in deps if d.get(df) is not None and d.get("dep")]
                deps.sort(key=lambda d: d.get(df) or 0, reverse=True)
                for d in deps[:5]:
                    hot.append({"dep": d.get("dep"), "n": d.get("libgeo"), "taux": round(d.get(df) or 0, 1)})
        except Exception:
            pass
        out.append({"cat": p["cat"], "label": p["label"],
                    "passages": round(val, 1) if val is not None else None,
                    "prev": round(pval, 1) if pval is not None else None,
                    "trend": trend, "hotDeps": hot})

    out.sort(key=lambda x: (x["trend"] if x["trend"] is not None else -999), reverse=True)
    res = {"generated": datetime.date.today().isoformat(), "source": "SurSaUD / Odissé — Santé publique France",
           "week": week, "pathologies": out}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · semaine %s · %d pathologies" % (week, len(out)))
    for o in out:
        print("  %s : passages %s (tendance %s%%) · top dép %s" % (
            o["label"], o["passages"], o["trend"], (o["hotDeps"][0]["n"] if o["hotDeps"] else "-")))
    print("→ %s (%d o)" % (OUT, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()

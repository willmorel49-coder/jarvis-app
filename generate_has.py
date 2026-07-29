#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_has.py — Veille APPRO : anticipation réglementaire (HAS Commission de la Transparence).

L'avis SMR/ASMR de la HAS tombe 3-6 mois AVANT l'inscription au remboursement (JORF).
C'est le signal qui aurait fait voir venir Wegovy/Mounjaro des mois avant l'explosion.
On garde les avis RÉCENTS notables :
  - favorables (ASMR I-IV = vraie amélioration, ou SMR important en primo-inscription) → volume à venir, constituer le stock ;
  - SMR insuffisant / défavorable → risque de déremboursement (bascule vers l'OTC/NR).

Source : HAS « Évaluation des médicaments », CSV ouverts sur data.gouv (asmr + smr),
indexés par CIS + CIP13. Aucune clé. Diff mensuel = nouveaux avis = événement radar.

Écrit crm/v2/has-avis.json + snapshot crm/v2/_has_snapshot.json. Python 3.9, urllib seul.
"""
import io
import os
import csv
import json
import datetime
import urllib.request

META = "https://www.data.gouv.fr/api/1/datasets/evaluation-des-medicaments/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "has-avis.json")
SNAP = os.path.join(HERE, "crm", "v2", "_has_snapshot.json")
MONTHS = 18   # fenêtre : avis des ~18 derniers mois


def fetch(url, gz=False):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip
            raw = gzip.decompress(raw)
    return raw


def resource_urls():
    d = json.loads(fetch(META))
    urls = {}
    for r in d.get("resources", []):
        t = (r.get("title") or "").lower()
        if t.startswith("asmr"):
            urls["asmr"] = r["url"]
        elif t.startswith("smr"):
            urls["smr"] = r["url"]
    return urls


def read_csv(url):
    text = fetch(url).decode("utf-8", "ignore")
    rows = list(csv.reader(text.splitlines(), delimiter=";"))
    if not rows:
        return []
    def clean(x):
        return x.strip().strip("$").strip()
    header = [clean(h) for h in rows[0]]
    out = []
    for r in rows[1:]:
        if len(r) < len(header):
            continue
        out.append({header[i]: clean(r[i]) for i in range(len(header))})
    return out


def col(row, *keys):
    for k in row:
        kl = k.lower()
        for want in keys:
            if want in kl:
                return row[k]
    return ""


def parse_date(s):
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except Exception:
            pass
    return None


def cips13(s):
    return [c for c in (s or "").replace(" ", "").split("|") if len(c) == 13 and c.isdigit()]


def main():
    urls = resource_urls()
    cutoff = datetime.date.today() - datetime.timedelta(days=MONTHS * 31)

    # SMR par CIS (dernier avis)
    smr_by_cis = {}
    for row in read_csv(urls.get("smr", "")) if urls.get("smr") else []:
        cis = col(row, "code cis", "cis")
        val = col(row, "valeur smr", "smr")
        if cis and val:
            smr_by_cis[cis] = val

    items = []
    for row in read_csv(urls.get("asmr", "")) if urls.get("asmr") else []:
        cis = col(row, "code cis", "cis")
        d = parse_date(col(row, "date avis", "date"))
        if not d or d < cutoff:
            continue
        asmr = (col(row, "valeur asmr") or "").upper().strip()
        motif = col(row, "motif")
        smr = smr_by_cis.get(cis, "")
        spec = col(row, "nomination", "denomination", "spcialit", "spécialit", "libell")
        cips = cips13(col(row, "code cip", "cip"))
        # notable ? ASMR I-IV (vraie amélioration) OU SMR insuffisant (déremboursement)
        fav = asmr in ("I", "II", "III", "IV")
        derem = "insuffisant" in smr.lower()
        if not (fav or derem):
            continue
        items.append({
            "cis": cis, "cips": cips, "spec": spec, "date": d.isoformat(),
            "asmr": asmr, "smr": smr, "motif": motif,
            "cat": "derem" if derem and not fav else "reimb",
        })

    # dédup par CIS (garder l'avis le plus récent)
    best = {}
    for it in items:
        k = it["cis"]
        if k not in best or it["date"] > best[k]["date"]:
            best[k] = it
    items = sorted(best.values(), key=lambda x: x["date"], reverse=True)

    # diff : nouveaux CIS depuis le dernier passage
    prev = []
    try:
        with io.open(SNAP, "r", encoding="utf-8") as f:
            prev = json.load(f).get("cis", [])
    except Exception:
        prev = []
    prev_set = set(prev)
    cur_cis = [it["cis"] for it in items]
    for it in items:
        it["new"] = 0 if not prev_set else (1 if it["cis"] not in prev_set else 0)

    today = datetime.date.today().isoformat()
    n_fav = sum(1 for it in items if it["cat"] == "reimb")
    out = {"generated": today, "source": "HAS Commission de la Transparence",
           "meta": {"n": len(items), "nFav": n_fav, "nDerem": len(items) - n_fav,
                    "nNew": sum(it["new"] for it in items)},
           "items": items[:120]}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    with io.open(SNAP, "w", encoding="utf-8") as f:
        json.dump({"generated": today, "cis": cur_cis}, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · avis notables (18 mois)=%d · favorables=%d · déremb=%d · nouveaux=%d" % (
        len(items), n_fav, len(items) - n_fav, sum(it["new"] for it in items)))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

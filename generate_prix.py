#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_prix.py — Veille APPRO : baisses de prix officielles (BDPM prix public).

La BDPM (CIS_CIP_bdpm.txt) publie le prix public TTC officiel de chaque présentation.
Il n'y a pas d'historique dans le fichier : le robot garde son propre INSTANTANÉ des prix
(prix-snapshot.json, commité) et, à chaque passage, détecte les RÉFÉRENCES DONT LE PRIX A
BAISSÉ depuis la dernière fois. Les révisions tarifaires CEPS tombent souvent le 1er du mois
→ un produit qui baisse = stock qui se dévalorise / marge qui change → signal d'achat.

On restreint au catalogue réseau (prod-stats) et on classe par impact (baisse × vitesse de vente).

Source : base-donnees-publique.medicaments.gouv.fr/download/file/CIS_CIP_bdpm.txt
Gratuit, sans clé. Écrit crm/v2/prix.json + crm/v2/prix-snapshot.json. Python 3.9, urllib seul.
"""
import io
import os
import json
import datetime
import urllib.request

CISCIP = "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_CIP_bdpm.txt"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "prix.json")
SNAP = os.path.join(HERE, "crm", "v2", "prix-snapshot.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")

MIN_DROP_PCT = 1.0    # baisse mini pour être retenue (bruit d'arrondi sinon)
MAX_DROPS = 80        # taille du JSON servi


def fetch_lines(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("latin-1", "ignore").splitlines()


def digits13(v):
    s = "".join(ch for ch in str(v or "") if ch.isdigit())
    return s if len(s) == 13 else None


def to_price(v):
    v = (v or "").strip().replace(" ", "").replace(" ", "").replace(",", ".")
    if not v:
        return None
    try:
        p = round(float(v), 2)
        return p if p > 0 else None
    except ValueError:
        return None


def catalogue():
    """{cip13: {'d': designation, 'n': ventes}} depuis PROD_STATS (restreint + impact)."""
    try:
        txt = io.open(PRODSTATS, "r", encoding="utf-8").read()
        arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
        return {str(p.get("c")): {"d": p.get("d") or "", "n": p.get("n") or 0}
                for p in arr if p.get("c")}
    except Exception:
        return {}


def load_snapshot():
    try:
        return json.load(io.open(SNAP, "r", encoding="utf-8"))
    except Exception:
        return {}


def main():
    cat = catalogue()
    prev = load_snapshot()          # {cip: prix} du dernier passage
    cur = {}                        # {cip: prix} aujourd'hui
    meta = {}                       # {cip: {'d','remb','n'}}

    for ln in fetch_lines(CISCIP):
        cols = ln.split("\t")
        if len(cols) < 10:
            continue
        cip = digits13(cols[6])
        if not cip or (cat and cip not in cat):
            continue
        price = to_price(cols[9])   # col 10 = prix public TTC
        if price is None:
            continue
        cur[cip] = price
        info = cat.get(cip, {})
        meta[cip] = {"d": (info.get("d") or cols[2] or "").strip(),
                     "remb": (cols[8] or "").strip(),
                     "n": info.get("n", 0)}

    drops, ups = [], 0
    for cip, newp in cur.items():
        oldp = prev.get(cip)
        if not isinstance(oldp, (int, float)) or oldp <= 0:
            continue
        if newp < oldp:
            pct = round((oldp - newp) / oldp * 100, 1)
            if pct >= MIN_DROP_PCT:
                m = meta.get(cip, {})
                drops.append({"c": cip, "d": m.get("d", ""), "old": oldp, "new": newp,
                              "pct": pct, "remb": m.get("remb", ""), "n": m.get("n", 0)})
        elif newp > oldp:
            ups += 1

    # impact = ampleur de la baisse × vitesse de vente réseau (les baisses sur nos best-sellers d'abord)
    drops.sort(key=lambda x: x["pct"] * (1 + (x["n"] or 0)), reverse=True)
    baseline = not prev              # 1er passage : on amorce, aucune baisse à afficher

    out = {"generated": datetime.date.today().isoformat(),
           "source": "BDPM — prix public officiel (base-donnees-publique.medicaments.gouv.fr)",
           "nTracked": len(cur), "baseline": baseline,
           "nDown": len(drops), "nUp": ups, "drops": drops[:MAX_DROPS]}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    # snapshot mis à jour pour le prochain diff
    with io.open(SNAP, "w", encoding="utf-8") as f:
        json.dump(cur, f, ensure_ascii=False, separators=(",", ":"))

    print("OK · suivis=%d · baisses=%d · hausses=%d · %s" % (
        len(cur), len(drops), ups, "AMORCAGE (1er passage)" if baseline else "diff actif"))
    for d in drops[:6]:
        print("  -%.1f%%  %s  %.2f→%.2f  (ventes %d)" % (d["pct"], d["d"][:32], d["old"], d["new"], d["n"]))
    print("→ %s (%d o) · snapshot %s (%d o)" % (OUT, os.path.getsize(OUT), SNAP, os.path.getsize(SNAP)))


if __name__ == "__main__":
    main()

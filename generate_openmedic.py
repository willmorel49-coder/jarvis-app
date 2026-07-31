#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_openmedic.py — Veille APPRO/COMMERCIAL : demande nationale par produit (Open Medic).

Open Medic (Assurance Maladie) = boîtes remboursées en France par CIP13 sur une année pleine.
Croisé au sell-in réseau (WML) côté app, ça donne le « white space » : produits à forte
demande nationale où le réseau vend peu = potentiel de référencement / de poussée commerciale.
Complète AMELI_AVG (moyenne par pharmacie) par le VOLUME NATIONAL ABSOLU.

Téléchargement 2 étapes, gratuit sans clé :
  1) page listant les fichiers (jeton de session) : download2.php?Dir_Rep=<AN>_CIP13
  2) le fichier tokenisé NB_<AN>_cip13.CSV.gz (national, CIP13;l_cip13;nbc;REM;BSE;BOITES)
Restreint au catalogue réseau (prod-stats). Écrit crm/v2/openmedic.json. Python 3.9, urllib seul.
"""
import io
import os
import re
import gzip
import json
import datetime
import urllib.request

BASE = "https://open-data-assurance-maladie.ameli.fr/medicaments/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "openmedic.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        raw = r.read()
    return raw if binary else raw.decode("utf-8", "ignore")


def catalogue():
    try:
        txt = io.open(PRODSTATS, "r", encoding="utf-8").read()
        arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
        return set(str(p.get("c")) for p in arr if p.get("c"))
    except Exception:
        return set()


def digits(v):
    return "".join(ch for ch in str(v or "") if ch.isdigit())


def load_year(year, cat):
    """Retourne {cip13: boites} pour l'année, ou None si le millésime n'existe pas encore."""
    page = fetch(BASE + "download2.php?Dir_Rep=%d_CIP13" % year)
    m = re.search(r'download_file\.php\?token=[a-f0-9]+&file=[^"\']*NB_%d_cip13\.CSV\.gz' % year, page)
    if not m:
        return None
    raw = fetch(BASE + m.group(0).replace("&amp;", "&"), binary=True)
    txt = gzip.decompress(raw).decode("latin-1", "ignore")
    out = {}
    for i, ln in enumerate(txt.splitlines()):
        if i == 0:
            continue
        cols = ln.split(";")
        if len(cols) < 6:
            continue
        cip = digits(cols[0])
        if len(cip) != 13 or (cat and cip not in cat):
            continue
        b = digits(cols[5])   # BOITES (entier, séparateurs éventuels retirés)
        if b:
            out[cip] = int(b)
    return out


def main():
    cat = catalogue()
    this = datetime.date.today().year
    data, year = None, None
    for y in (this - 1, this - 2, this):   # le millésime N est publié à l'année N+1
        try:
            data = load_year(y, cat)
        except Exception as e:
            print("  échec %d : %s" % (y, e))
            data = None
        if data:
            year = y
            break

    if not data:
        print("ABANDON : aucun millésime Open Medic récupérable — openmedic.json précédent conservé.")
        return

    out = {"generated": datetime.date.today().isoformat(),
           "source": "Open Medic — Assurance Maladie (boîtes remboursées France)",
           "year": year, "n": len(data), "data": data}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    tot = sum(data.values())
    print("OK · millésime %d · %d produits du catalogue · %d boîtes nationales" % (year, len(data), tot))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

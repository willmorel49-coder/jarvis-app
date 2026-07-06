#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_nouveautes.py — Copilote / feed #6 : NOUVEAUTÉS (produits récemment arrivés).

Récupère la date d'AMM par produit (CIP13) depuis la Base de Données Publique des
Médicaments (BDPM, ANSM), et écrit crm/v2/nouveautes-data.js pour les produits
d'AMM récente (~36 derniers mois) et commercialisés. Le Copilote en tire « nouveautés
à ne pas rater » — pour être à l'affût avant les concurrents.

Sources gratuites : BDPM CIS_bdpm.txt (CIS→AMM/labo) + CIS_CIP_bdpm.txt (CIS→CIP13).
Python 3.9, stdlib only.
"""
import os
import re
import datetime
import urllib.request

ROOT = os.path.dirname(__file__)
OUT = os.path.join(ROOT, "crm", "v2", "nouveautes-data.js")
CIS_URL = "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_bdpm.txt"
CIP_URL = "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_CIP_bdpm.txt"
MONTHS = 36   # AMM des 36 derniers mois = "nouveauté"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "JARVIS/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("latin-1", "ignore")


def main():
    # borne temporelle (sans Date.now dans un contexte robot classique -> ok ici en local/CI)
    today = datetime.date.today()
    cutoff = datetime.date(today.year - MONTHS // 12, today.month, 1)

    print("Téléchargement BDPM…")
    cis_txt = fetch(CIS_URL)
    cip_txt = fetch(CIP_URL)

    # CIS -> {amm(date), nom, labo}
    cis = {}
    for line in cis_txt.splitlines():
        c = line.split("\t")
        if len(c) < 11:
            continue
        code, nom, etat, dt = c[0].strip(), c[1].strip(), c[6].strip(), c[7].strip()
        if "ommercialis" not in etat:            # seulement les commercialisés
            continue
        m = re.match(r"(\d{2})/(\d{2})/(\d{4})", dt)
        if not m:
            continue
        amm = datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if amm < cutoff:
            continue
        cis[code] = {"amm": amm.isoformat()[:7], "nom": nom, "labo": (c[10].strip() if len(c) > 10 else "")}

    print("CIS d'AMM récente commercialisés : %d" % len(cis))

    # CIS_CIP : CIS (col 0) -> CIP13 (col 6)
    data = {}
    for line in cip_txt.splitlines():
        c = line.split("\t")
        if len(c) < 7:
            continue
        code = c[0].strip()
        if code not in cis:
            continue
        cip = re.sub(r"\D", "", c[6])
        if len(cip) != 13:
            continue
        rec = cis[code]
        # garde la date la plus ancienne (1ère mise sur le marché) par CIP
        if cip not in data or rec["amm"] < data[cip]["amm"]:
            data[cip] = rec

    print("Produits (CIP13) nouveautés : %d" % len(data))
    def esc(s):
        return str(s).replace("\\", "").replace('"', "'")[:44]
    items = ",".join(
        '"%s":{amm:"%s",n:"%s",labo:"%s"}' % (c, r["amm"], esc(r["nom"]), esc(r["labo"]))
        for c, r in sorted(data.items())
    )
    js = (
        "// Copilote — nouveautés : produits d'AMM récente (%d mois) et commercialisés.\n"
        "// Source: BDPM (base-donnees-publique.medicaments.gouv.fr). Généré par generate_nouveautes.py.\n"
        "window.NOUVEAUTES={meta:{mois:%d,source:\"BDPM\"},data:{%s}};\n"
    ) % (MONTHS, MONTHS, items)
    open(OUT, "w", encoding="utf-8").write(js)
    print("Écrit %s (%d Ko, %d produits)" % (OUT, os.path.getsize(OUT) // 1024, len(data)))


if __name__ == "__main__":
    main()

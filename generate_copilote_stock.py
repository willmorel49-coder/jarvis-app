#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_copilote_stock.py — Copilote / stock global Intégral.

Stock disponible par produit (CIP13), GLOBAL = SOMME des 7 établissements
(CPR, HP, MSP, OPS, POS, SEP, SOP).
Source : crm/v2/etab-prices-data.js (generate_etab_prices.py — à lancer AVANT), qui porte le
stock de chaque site, remboursables compris, depuis les extractions de septembre 2026.
Jusqu'au 21/09/2026 la source était crm/stock.js, annoncé « consolidé » mais tiré de
« stock OPS 03 09 2026.xlsx » : le seul site OPS (427 444 unités contre 2,2 millions).
Un stock négatif sur un site compte pour 0 (même règle que les extractions par site).
Écrit crm/v2/stock-data.js = { CIP13 : stock global } (dispo>0).

Python 3.9, stdlib only.
"""
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "crm", "v2", "etab-prices-data.js")
OUT = os.path.join(ROOT, "crm", "v2", "stock-data.js")


def main():
    txt = open(SRC, encoding="utf-8").read()
    etab = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
    sites = sorted(etab["prices"])
    data = {}
    for site in sites:
        for code, pq in etab["prices"][site].items():
            q = int(pq[1] or 0)
            if q <= 0 or not code.isdigit() or len(code) > 13:
                continue
            code = code.zfill(13)  # un EAN à zéro de tête perd ce zéro dans certaines extractions
            data[code] = data.get(code, 0) + q
    if not data:
        raise SystemExit("Aucun stock lu dans %s" % SRC)
    items = ",".join('"%s":%d' % (c, v) for c, v in sorted(data.items()))
    tot = sum(data.values())
    # Date affichée (« stock arrêté au … ») = le relevé le PLUS ANCIEN des sites additionnés :
    # le total n'est jamais plus frais que son site le plus vieux.
    dates = etab.get("siteDates") or {}
    manquants = [s for s in sites if not dates.get(s)]
    if manquants:
        raise SystemExit("Date de relevé absente pour : %s" % ", ".join(manquants))
    gen = min(dates[s] for s in sites)
    js = (
        "// Copilote — stock Intégral global = somme des établissements (%s).\n"
        "// Source: crm/v2/etab-prices-data.js (stock par site). Généré par generate_copilote_stock.py.\n"
        "window.STOCK_IP={meta:{n:%d,unites:%d,etabs:\"tous\",sites:%s,siteDates:%s,gen:\"%s\"},data:{%s}};\n"
    ) % ("+".join(sites), len(data), tot, json.dumps(sites, separators=(",", ":")),
         json.dumps({s: dates[s] for s in sites}, separators=(",", ":")), gen, items)
    open(OUT, "w", encoding="utf-8").write(js)
    print("Écrit %s (%d Ko, %d réfs en stock, %d unités, %d sites, arrêté au %s)"
          % (OUT, os.path.getsize(OUT) // 1024, len(data), tot, len(sites), gen))


if __name__ == "__main__":
    main()

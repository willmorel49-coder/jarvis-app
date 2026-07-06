#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_copilote_stock.py — Copilote / feed stock.

Dérive une version ALLÉGÉE de l'inventaire Intégral (crm/stock.js, ~1,75 Mo) :
crm/v2/stock-data.js = { CIP13 : stock dispo } pour les produits en stock (dispo>0).
Sert au Copilote pour n'afficher que ce qu'Intégral a réellement (tous établissements
confondus). ~130 Ko. Python 3.9, stdlib only.
"""
import os
import re
import json

ROOT = os.path.dirname(__file__)
SRC = os.path.join(ROOT, "crm", "stock.js")
OUT = os.path.join(ROOT, "crm", "v2", "stock-data.js")


def main():
    txt = open(SRC, encoding="utf-8", errors="ignore").read()
    # crm/stock.js = objet JS (clés internes non quotées) → extraction regex ean + dispo.
    data = {}
    for ean, dispo in re.findall(r'ean:\s*"(\d{13})"[^}]*?dispo:\s*(-?\d+)', txt):
        d = int(dispo)
        if d > 0:
            data[ean] = data.get(ean, 0) + d
    items = ",".join('"%s":%d' % (c, v) for c, v in sorted(data.items()))
    tot = sum(data.values())
    js = (
        "// Copilote — stock Intégral disponible par CIP13 (tous établissements confondus).\n"
        "// Dérivé de crm/stock.js. %d références en stock. Généré par generate_copilote_stock.py.\n"
        "window.STOCK_IP={meta:{n:%d,unites:%d},data:{%s}};\n"
    ) % (len(data), len(data), tot, items)
    open(OUT, "w", encoding="utf-8").write(js)
    print("Écrit %s (%d Ko, %d réfs en stock, %d unités)"
          % (OUT, os.path.getsize(OUT) // 1024, len(data), tot))


if __name__ == "__main__":
    main()

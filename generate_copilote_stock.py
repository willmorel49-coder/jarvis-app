#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_copilote_stock.py — Copilote / stock global Intégral.

Stock disponible par produit (CIP13), GLOBAL = tous établissements confondus
(OPS, HP, CPR, POS, SEP, MSP, SOP réunis dans l'inventaire consolidé Intégral).
Source : crm/stock.js (« Inventaire stock Intégral Pharma », généré par generate_stock.py
depuis l'export ERP consolidé — princeps inclus, ~6370 réfs). Les extraits *_extrait.xlsx
par établissement ne couvrent QUE la parapharma/NR (2% des princeps) → inutilisables ici.
Écrit crm/v2/stock-data.js = { CIP13 : stock global } (dispo>0). ~114 Ko.

Python 3.9, stdlib only.
"""
import os
import re

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
    if not data:
        raise SystemExit("Aucun stock lu dans %s" % SRC)
    items = ",".join('"%s":%d' % (c, v) for c, v in sorted(data.items()))
    tot = sum(data.values())
    # Date de l'inventaire = date de dernière modif du fichier source (plus honnête que la date
    # du run) → surfacée dans la barre de fraîcheur de l'appro (« stock arrêté au … »).
    import datetime
    try:
        gen = datetime.date.fromtimestamp(os.path.getmtime(SRC)).isoformat()
    except Exception:
        gen = datetime.date.today().isoformat()
    js = (
        "// Copilote — stock Intégral global (tous établissements confondus : OPS+HP+CPR+POS+SEP+MSP+SOP).\n"
        "// Source: crm/stock.js (inventaire consolidé Intégral). Généré par generate_copilote_stock.py.\n"
        "window.STOCK_IP={meta:{n:%d,unites:%d,etabs:\"tous\",gen:\"%s\"},data:{%s}};\n"
    ) % (len(data), tot, gen, items)
    open(OUT, "w", encoding="utf-8").write(js)
    print("Écrit %s (%d Ko, %d réfs en stock, %d unités)"
          % (OUT, os.path.getsize(OUT) // 1024, len(data), tot))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_france_mois.py — Produits / « Le comptoir » : ventes France MOIS PAR MOIS par produit.

Boîtes remboursées France par CIP13 et par mois (Medic'AM, série mensuelle), pour tracer
dans la fiche produit nos ventes face au marché et notre part de marché mois par mois.
Mêmes fichiers et même lecture que generate_tendance.py (réutilisés, pas recopiés).
Écrit crm/v2/france-mois-data.js. Gratuit. Python 3.9 · xlrd.
"""
import datetime
import os
import sys

from generate_tendance import SEMESTERS, download, parse

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crm", "v2", "france-mois-data.js")
MIN_TOTAL = 100   # boîtes sur toute la période : en dessous, une part mensuelle n'a pas de sens


def main():
    # ⚠️ Deux fichiers couvrent les mêmes mois (2026-01-a-04 et 2026-01-a-06) : parse()
    # ADDITIONNE ce qu'on lui donne, ce qui doublait janvier-avril 2026. Chaque fichier
    # est donc lu à part, puis le plus récent remplace le plus ancien, mois par mois.
    by_cip, months = {}, set()
    for name in sorted(SEMESTERS):
        p = download(name)
        if not p:
            continue
        un, vus = {}, set()
        parse(p, un, vus)
        months |= vus
        for cip, mo in un.items():
            d = by_cip.setdefault(cip, {})
            for ym in vus:
                d[ym] = mo.get(ym, 0.0)
    if not by_cip:
        sys.exit("Aucune donnée Medic'AM.")
    mois = sorted(months, key=lambda ym: ym[0] + ym[1])
    # La série doit être continue : un trou fabriquerait une chute à zéro sur la courbe.
    for a, b in zip(mois, mois[1:]):
        ya, ma, yb, mb = int(a[0]), int(a[1]), int(b[0]), int(b[1])
        if (yb * 12 + mb) - (ya * 12 + ma) != 1:
            sys.exit("Mois manquant entre %s-%s et %s-%s." % (a[0], a[1], b[0], b[1]))
    lignes = []
    for cip in sorted(by_cip):
        vals = [int(round(by_cip[cip].get(ym, 0.0))) for ym in mois]
        if sum(vals) >= MIN_TOTAL:
            lignes.append('"%s":[%s]' % (cip, ",".join(str(v) for v in vals)))
    etiq = ",".join('"%s-%s"' % ym for ym in mois)
    js = (
        "// Produits — ventes France mois par mois (boîtes remboursées) par CIP13.\n"
        "// Source : Medic'AM (série mensuelle). Généré par generate_france_mois.py — ne pas éditer.\n"
        "window.FRANCE_MOIS={meta:{mois:[%s],gen:\"%s\",source:\"Medic'AM\"},data:{%s}};\n"
    ) % (etiq, datetime.date.today().isoformat(), ",".join(lignes))
    open(OUT, "w", encoding="utf-8").write(js)
    print("Écrit %s : %d produits, %s-%s → %s-%s, %d Ko" % (
        OUT, len(lignes), mois[0][0], mois[0][1], mois[-1][0], mois[-1][1], os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

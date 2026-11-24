#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_ansm_signalements.py — Étude par produit : le RISQUE DE RUPTURE appris sur le passé.

Source : ANSM, « Médicaments ayant fait l'objet d'un signalement de rupture ou de risque de rupture
de stock » — un fichier XLSX par année, gratuit, aucune clé. Depuis 2022, chaque signalement porte le
CIP13 de la présentation : on garde, par CIP, la date de chaque signalement (dates distinctes).
Les années 2019 à 2021 n'ont que le nom de la spécialité : écartées (rattachement par le nom = erreurs).

Rétro-test, refait à chaque passage (rien n'est écrit en dur) : pour chacune des deux dernières années
complètes Y, on prend ce qu'on savait fin Y-1 pour chaque présentation remboursée en France
(Medic'AM, crm/v2/etude-france/) —
  · MITM ou non (crm/v2/mitm.json, liste ANSM/BDPM des médicaments d'intérêt thérapeutique majeur),
  · nombre de signalements sur les deux années Y-2 et Y-1 (0, 1, 2, 3 et plus),
  · demande France en baisse de plus de 10 % (Y-1 face à Y-2) ou non —
et on regarde si elle a été signalée en Y. La part signalée par profil est le taux affiché sur la fiche.
Mesuré le 24/11/2026 sur 2024-2025 : de 4 % (non MITM, jamais signalé, demande en baisse) à 45 %
(MITM, 3 signalements ou plus, demande stable ou en hausse).

Écrit crm/v2/ansm-signalements.json (clés triées : même contenu = mêmes octets).
Python 3.9, dépend d'openpyxl. Lancé chaque lundi par .github/workflows/ruptures.yml.
"""
import io
import json
import os
import re
import sys
import urllib.request
import datetime
import collections

import openpyxl

ICI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ICI, "crm", "v2", "ansm-signalements.json")
ETUDE = os.path.join(ICI, "crm", "v2", "etude-france")
MITM = os.path.join(ICI, "crm", "v2", "mitm.json")
PAGE = "https://ansm.sante.fr/page/medicaments-ayant-fait-lobjet-dun-signalement-de-rupture-ou-de-risque-de-rupture-de-stock"
HOST = "https://ansm.sante.fr"
FENETRE = 2          # années d'historique regardées avant l'année prédite
BAISSE = -0.10       # demande France en baisse au-delà de 10 %


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def cip13(v):
    if v is None:
        return None
    if isinstance(v, float):
        v = int(v)
    s = re.sub(r"\D", "", str(v))
    return s.zfill(13) if 7 <= len(s) <= 13 else None


def fichiers_xlsx():
    html = fetch(PAGE).decode("utf-8", "ignore")
    if "signalement de rupture" not in html:
        raise SystemExit("Page ANSM inattendue (titre absent) : rien n'est écrit.")
    urls = sorted(set(re.findall(r'href="([^"]+\.xlsx)"', html, re.I)))
    return [u if u.startswith("http") else HOST + u for u in urls]


def lire(url, par_cip):
    """Ajoute à par_cip les dates de signalement des feuilles qui ont une colonne CIP."""
    wb = openpyxl.load_workbook(io.BytesIO(fetch(url)), read_only=True)
    n = 0
    for sh in wb.worksheets:
        lignes = sh.iter_rows(values_only=True)
        idx = None
        for i, r in enumerate(lignes):
            if i > 10:
                break
            entetes = [re.sub(r"\s+", " ", str(x or "")).strip().lower() for x in r]
            if entetes and entetes[0].startswith("date"):
                idx = {"date": 0}
                for j, h in enumerate(entetes):
                    if h == "cip":
                        idx["cip"] = j
                break
        if not idx or "cip" not in idx:
            continue          # 2019-2021 : pas de CIP
        for r in lignes:
            d, c = r[idx["date"]], cip13(r[idx["cip"]])
            if isinstance(d, datetime.datetime) and c:
                par_cip[c].add(d.strftime("%Y-%m-%d"))
                n += 1
    return n


def series_france():
    """Boîtes remboursées par CIP et par année civile (toutes prescriptions), depuis etude-france/."""
    vol = {}
    for f in sorted(os.listdir(ETUDE)):
        if not re.match(r"^\d\d\.json$", f):
            continue
        t = json.load(open(os.path.join(ETUDE, f), encoding="utf-8"))
        y, m = int(t["m0"][:4]), int(t["m0"][5:7])
        mois = []
        for _ in range(t["n"]):
            mois.append(y)
            m += 1
            if m == 13:
                y, m = y + 1, 1
        for c, l in t["d"].items():
            a = collections.Counter()
            for an, v in zip(mois, l[0]):
                if v and v > 0:
                    a[an] += v
            vol[c] = a
    return vol


def cle(mitm, n, baisse):
    return ("M" if mitm else "N") + "|" + ("3+" if n >= 3 else str(n)) + "|" + ("b" if baisse else "s")


def main():
    par_cip = collections.defaultdict(set)
    sources, total = [], 0
    for u in fichiers_xlsx():
        n = lire(u, par_cip)
        if n:
            sources.append(u)
            total += n
    annees = sorted({d[:4] for ds in par_cip.values() for d in ds})
    if len(annees) < FENETRE + 2:
        raise SystemExit("Moins de %d années avec CIP (%s) : rien n'est écrit." % (FENETRE + 2, annees))
    derniere = int(annees[-1])
    # Une année n'est complète que si elle a des signalements en décembre.
    if not any(d.startswith("%d-12" % derniere) for ds in par_cip.values() for d in ds):
        derniere -= 1
    vol, mitm = series_france(), set(json.load(open(MITM, encoding="utf-8"))["cips"])
    tests = [y for y in (derniere - 1, derniere) if y - FENETRE >= int(annees[0])]
    cases = collections.defaultdict(lambda: [0, 0])
    for Y in tests:
        for c, a in vol.items():
            if a[Y - 1] <= 0:
                continue
            ds = par_cip.get(c, ())
            n = sum(1 for d in ds if Y - FENETRE <= int(d[:4]) < Y)
            baisse = a[Y - 2] > 0 and a[Y - 1] / a[Y - 2] - 1 < BAISSE
            k = cle(c in mitm, n, baisse)
            cases[k][0] += 1
            cases[k][1] += any(d[:4] == str(Y) for d in ds)
    out = {
        "source": "ANSM — médicaments ayant fait l'objet d'un signalement de rupture ou de risque de rupture de stock",
        "page": PAGE,
        "fichiers": sources,
        "genere": datetime.date.today().isoformat(),
        "annees": [int(annees[0]), derniere],
        "signalements": total,
        "fenetre": [derniere - FENETRE + 1, derniere],
        "test": {"annees": tests, "fenetre": FENETRE, "baisse": BAISSE,
                 "lecture": "clé MITM(M/N)|signalements sur les 2 années d'avant|demande France en baisse (b) ou non (s) → [présentations, signalées l'année suivante]",
                 "cases": {k: v for k, v in cases.items()}},
        "lecture": "d : CIP13 → dates distinctes de signalement (AAMMJJ)",
        "d": {c: sorted(d[2:4] + d[5:7] + d[8:10] for d in ds if int(d[:4]) <= derniere) for c, ds in par_cip.items()},
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    print("ansm-signalements.json : %d signalements avec CIP, %d présentations, années %s à %d, rétro-test %s"
          % (total, len(out["d"]), annees[0], derniere, tests))
    for k in sorted(cases):
        n, s = cases[k]
        print("  %-8s %5d / %5d = %4.1f %%" % (k, s, n, 100.0 * s / n))


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Fabrique crm/v2/uga-contours-data.js : les contours des UGA (fond de « Ma carte », La carte de JARVIS).

Source : ~/JARVIS/SECTEUR MAPPING UGA /uga_zones_france.geojson (attention : un espace en fin de nom de dossier).
Le fichier source porte aussi le commercial, la couleur et des comptages : RIEN de cela n'est recopié ici (le fichier
produit est public). On ne garde que le code de l'UGA, son nom, et le contour simplifié.

Sortie : « var UGA_CONTOURS = {"49LPO": {"n": "Le Plessis-Grammont", "p": [ [ [ [lon, lat], ... ], ...trous ], ...polygones ]}, ... };
(var et jamais const : le fichier est chargé à la demande par V2.loadFiles). Coordonnées arrondies à 3 décimales (environ 100 m).

Relancer : /usr/bin/python3 scripts/fabriquer_uga_contours.py [--tolerance 0.006] [--source CHEMIN]
Python 3.9, shapely.
"""
import argparse
import json
import os
import sys

from shapely.geometry import shape, mapping

SOURCE = os.path.expanduser("~/JARVIS/SECTEUR MAPPING UGA /uga_zones_france.geojson")
SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "crm", "v2", "uga-contours-data.js")


def anneau(coords):
    out = []
    for c in coords:
        p = [round(c[0], 3), round(c[1], 3)]
        if not out or out[-1] != p:
            out.append(p)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tolerance", type=float, default=0.006)
    ap.add_argument("--source", default=SOURCE)
    ap.add_argument("--sortie", default=SORTIE)
    a = ap.parse_args()
    with open(a.source, encoding="utf-8") as f:
        g = json.load(f)
    res = {}
    nb_pts = 0
    for ft in g["features"]:
        pr = ft.get("properties") or {}
        code = pr.get("uga")
        if not code:
            continue
        geom = shape(ft["geometry"])
        if not geom.is_valid:
            geom = geom.buffer(0)
        simple = geom.simplify(a.tolerance, preserve_topology=True)
        if simple.is_empty:
            simple = geom
        m = mapping(simple)
        polys = m["coordinates"] if m["type"] == "MultiPolygon" else [m["coordinates"]]
        sortie = []
        for poly in polys:
            rings = [anneau(r) for r in poly]
            rings = [r for r in rings if len(r) >= 3]
            if rings:
                sortie.append(rings)
                nb_pts += sum(len(r) for r in rings)
        if sortie:
            res[code] = {"n": pr.get("name") or "", "p": sortie}
    corps = json.dumps(res, ensure_ascii=False, separators=(",", ":"))
    tete = ("// Contours simplifiés des UGA (fond de « Ma carte »). Fabriqué par scripts/fabriquer_uga_contours.py "
            "depuis le découpage des UGA (tolérance %s, 3 décimales). AUCUNE donnée commerciale : code, nom, contour.\n" % a.tolerance)
    with open(a.sortie, "w", encoding="utf-8") as f:
        f.write(tete + "var UGA_CONTOURS=" + corps + ";\n")
    print("%d UGA, %d points, %d octets -> %s" % (len(res), nb_pts, os.path.getsize(a.sortie), a.sortie))


if __name__ == "__main__":
    sys.exit(main())

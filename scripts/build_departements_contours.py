#!/usr/bin/env python3
"""Fond de carte des départements pour le bloc « Les concurrents » (Infos du jour).

Lit un GeoJSON des 96 départements métropolitains (contours IGN Admin Express,
Licence ouverte Etalab, version simplifiée de france-geojson) et écrit
crm/v2/departements-contours.json : un chemin SVG par département, déjà projeté
et simplifié. La page n'a plus qu'à choisir les départements à montrer.

Projection : équirectangulaire corrigée à 46,5° N. Le navigateur projette les
agences (lat/lon) avec EXACTEMENT la même formule — voir cncProj() dans v2-infos.js.
Usage : python3 scripts/build_departements_contours.py chemin/dep.geojson
"""
import json, math, pathlib, sys

K, LON0, LAT0 = 200.0, -5.5, 51.2
C = math.cos(math.radians(46.5))
TOL = 0.7   # tolérance de simplification, en unités de carte (~0,4 km)

def proj(lon, lat):
    return ((lon - LON0) * C * K, (LAT0 - lat) * K)

def dp(pts, tol):
    """Douglas-Peucker itératif."""
    if len(pts) < 3:
        return pts
    garde = [False] * len(pts); garde[0] = garde[-1] = True
    pile = [(0, len(pts) - 1)]
    while pile:
        a, b = pile.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy)
        imax, dmax = -1, 0.0
        for i in range(a + 1, b):
            # anneau fermé : premier point = dernier, la « corde » est un point
            d = (abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L if L
                 else math.hypot(pts[i][0] - x1, pts[i][1] - y1))
            if d > dmax:
                imax, dmax = i, d
        if dmax > tol:
            garde[imax] = True; pile += [(a, imax), (imax, b)]
    return [p for p, g in zip(pts, garde) if g]

def anneau(coords):
    pts = dp([proj(lon, lat) for lon, lat in coords], TOL)
    if len(pts) < 4:
        return ''
    out, prev = [], None
    for x, y in pts:
        q = (round(x), round(y))
        if q != prev:
            out.append('%d,%d' % q); prev = q
    return 'M' + 'L'.join(out) + 'Z' if len(out) >= 3 else ''

src = json.load(open(sys.argv[1], encoding='utf-8'))
deps = {}
for f in src['features']:
    g = f['geometry']
    polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    d = ''.join(anneau(p[0]) for p in polys)   # contour extérieur seul : aucun département n'a de trou utile
    deps[f['properties']['code']] = {'n': f['properties']['nom'], 'd': d}
sortie = {'source': 'IGN Admin Express (Licence ouverte Etalab), simplifié', 'k': K, 'lon0': LON0, 'lat0': LAT0,
          'c': round(C, 6), 'deps': deps}
p = pathlib.Path(__file__).resolve().parent.parent / 'crm' / 'v2' / 'departements-contours.json'
p.write_text(json.dumps(sortie, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
relu = json.loads(p.read_text(encoding='utf-8'))
print('écrit', p, len(relu['deps']), 'départements', p.stat().st_size // 1024, 'Ko')

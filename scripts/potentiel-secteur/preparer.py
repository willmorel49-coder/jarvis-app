#!/usr/bin/python3 -I
# Prépare potentiel-secteur-data.js (29/10/2026). Bibliothèque standard seulement.
# Usage : BRUT=<dossier des téléchargements> /usr/bin/python3 -I scripts/potentiel-secteur/preparer.py
# Aucune donnée de JARVIS n'est lue ici : ni ventes, ni officines, ni fichier protégé. Sources publiques seulement (LISEZMOI.md).
# Entrées (données non fiables, lues en simple texte/JSON, jamais exécutées) :
#   donnees-brutes/insee-iris/ex/DS_RP_POPULATION_PRINC_IRIS_2023_data.csv
#   donnees-brutes/ign-iris/iris-<dep>.json
#   outils/depense-par-age.json  (produit par calibrer-depense.py)
import csv, json, math, os, sys

ICI = os.path.dirname(os.path.abspath(__file__))
BRUT = os.environ['BRUT']
DEPTS = ['14', '35', '37', '44', '49', '50', '53', '72']
POP_CSV = BRUT + '/insee-iris/ex/DS_RP_POPULATION_PRINC_IRIS_2023_data.csv'
SORTIE = os.environ.get('SORTIE') or os.path.join(ICI, '..', '..', 'crm', 'v2', 'potentiel-secteur-data.js')
TOL_M = 60.0          # tolérance de simplification (mètres)
BANDES = {'Y_LT20': 0, 'Y20T64': 1, 'Y65T79': 2, 'Y_GE80': 3}   # 0-19, 20-64, 65-79, 80+

# 30/10/2026 — Blain (44015) : l'IGN la découpe en 4 quartiers, l'INSEE 2023 la traite en une seule commune
# (code 440150000, 10 376 habitants). On fusionne les 4 contours en UNE zone portant la ligne INSEE ;
# aucune répartition de population n'est inventée. Clé = code INSEE de la zone, valeur = quartiers IGN réunis.
FUSIONS = {'440150000': ('440150101', '440150102', '440150103', '440150104')}
FUSION_NOM = {'440150000': 'Blain'}   # nom_iris d'une commune non découpée = le nom de la commune

def dissoudre(polys):
    """Fusionne des polygones contigus (mêmes sommets sur la frontière commune) en un seul :
    les arêtes parcourues dans les deux sens (frontières intérieures) disparaissent, le reste est rechaîné."""
    aretes = set()
    for p in polys:
        for ring in p:
            for a, b in zip(ring, ring[1:]):
                aretes.add((tuple(a), tuple(b)))
    gardees = [e for e in aretes if (e[1], e[0]) not in aretes]
    suivant = {}
    for a, b in gardees:
        suivant.setdefault(a, []).append(b)
    assert all(len(v) == 1 for v in suivant.values()), 'fusion ambiguë : sommet partagé par plusieurs arêtes'
    vus = set()
    anneaux = []
    for a, b in sorted(gardees):
        if (a, b) in vus:
            continue
        ring = [list(a)]
        cur = (a, b)
        while cur not in vus:
            vus.add(cur)
            ring.append(list(cur[1]))
            cur = (cur[1], suivant[cur[1]][0])
        assert ring[0] == ring[-1], 'fusion : anneau non fermé'
        anneaux.append(ring)
    def aire(r):
        return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(r, r[1:])) / 2.0
    anneaux.sort(key=lambda r: -abs(aire(r)))
    ext = [r for r in anneaux if aire(r) * aire(anneaux[0]) > 0]
    trous = [r for r in anneaux if aire(r) * aire(anneaux[0]) < 0]
    assert len(ext) == 1, 'fusion : plusieurs polygones séparés (non contigus)'
    return [[ext[0]] + trous]

# ---------- population ----------
def lire_population():
    """code_iris(9 car.) -> [tot, b0, b1, b2, b3]. Communes non découpées : code commune + '0000'."""
    pop = {}
    with open(POP_CSV, newline='', encoding='utf-8') as f:
        r = csv.reader(f, delimiter=';')
        h = next(r)
        ix = {k: i for i, k in enumerate(h)}
        for row in r:
            g = row[ix['GEO']]
            if g[:2] not in DEPTS:
                continue
            if row[ix['SEX']] != '_T' or row[ix['IMMI']] != '_T' or row[ix['NATIONALITY_TYPE']] != '_T' or row[ix['HAR']] != '_T':
                continue
            if row[ix['RP_MEASURE']] != 'POP':
                continue
            age = row[ix['AGE']]
            if age != '_T' and age not in BANDES:
                continue
            code = g if row[ix['GEO_OBJECT']] == 'IRIS' else g + '0000'
            v = float(row[ix['OBS_VALUE']] or 0)
            e = pop.setdefault(code, [0.0, 0.0, 0.0, 0.0, 0.0])
            if age == '_T':
                e[0] = v
            else:
                e[1 + BANDES[age]] = v
    return pop

# ---------- géométrie ----------
def anneaux_poly(geom):
    """-> liste de polygones, chacun = liste d'anneaux [[lon,lat],...] (1er = extérieur)."""
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    return geom['coordinates']

def dans_anneau(x, y, ring):
    c = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c

def dans_multi(x, y, polys):
    for p in polys:
        if dans_anneau(x, y, p[0]):
            if not any(dans_anneau(x, y, h) for h in p[1:]):
                return True
    return False

def aire_centroide(ring):
    a = cx = cy = 0.0
    n = len(ring)
    for i in range(n - 1):
        x0, y0 = ring[i][0], ring[i][1]
        x1, y1 = ring[i + 1][0], ring[i + 1][1]
        w = x0 * y1 - x1 * y0
        a += w; cx += (x0 + x1) * w; cy += (y0 + y1) * w
    if abs(a) < 1e-18:
        return 0.0, ring[0][0], ring[0][1]
    return a / 2.0, cx / (3.0 * a), cy / (3.0 * a)

def point_interieur(polys):
    A = CX = CY = 0.0
    for p in polys:
        for k, ring in enumerate(p):
            a, cx, cy = aire_centroide(ring)
            s = 1 if k == 0 else -1
            sa = abs(a) * s
            A += sa; CX += cx * sa; CY += cy * sa
    if A != 0:
        cx, cy = CX / A, CY / A
        if dans_multi(cx, cy, polys):
            return cx, cy, False
    # centre de gravité hors du polygone : milieu du plus long segment horizontal intérieur
    ys = [pt[1] for p in polys for pt in p[0]]
    y0, y1 = min(ys), max(ys)
    best = (-1.0, None, None)
    for k in range(1, 40):
        y = y0 + (y1 - y0) * k / 40.0
        xs = []
        for p in polys:
            for ring in p:
                n = len(ring)
                for i in range(n - 1):
                    ya, yb = ring[i][1], ring[i + 1][1]
                    if (ya > y) != (yb > y):
                        xs.append(ring[i][0] + (y - ya) * (ring[i + 1][0] - ring[i][0]) / (yb - ya))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            L = xs[i + 1] - xs[i]
            xm = (xs[i] + xs[i + 1]) / 2.0
            if L > best[0] and dans_multi(xm, y, polys):
                best = (L, xm, y)
    if best[1] is None:
        return (CX / A if A else polys[0][0][0][0]), (CY / A if A else polys[0][0][0][1]), True
    return best[1], best[2], True

def douglas(pts, tol):
    """Douglas-Peucker itératif sur une liste de points déjà projetés (x,y en mètres)."""
    n = len(pts)
    if n < 3:
        return list(range(n))
    keep = [False] * n
    keep[0] = keep[n - 1] = True
    pile = [(0, n - 1)]
    while pile:
        a, b = pile.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        dmax, imax = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L2 == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > dmax:
                dmax, imax = d, i
        if dmax > tol and imax > 0:
            keep[imax] = True
            pile.append((a, imax)); pile.append((imax, b))
    return [i for i in range(n) if keep[i]]

def simplifier_anneau(ring, tol_m):
    k = 111320.0
    c = math.cos(math.radians(ring[0][1]))
    pts = [(p[0] * k * c, p[1] * k) for p in ring]
    # anneau fermé : on coupe en deux moitiés pour ne pas perdre le point de départ
    n = len(pts)
    m = n // 2
    i1 = douglas(pts[:m + 1], tol_m)
    i2 = douglas(pts[m:], tol_m)
    idx = i1 + [m + i for i in i2[1:]]
    out = [[round(ring[i][0], 5), round(ring[i][1], 5)] for i in idx]
    if out[0] != out[-1]:
        out.append(out[0])
    return out

def simplifier_geom(polys):
    res = []
    for p in polys:
        rings = []
        for k, ring in enumerate(p):
            s = simplifier_anneau(ring, TOL_M)
            if len(s) >= 4:
                rings.append(s)
            elif k == 0:
                rings = []
                break
        if rings:
            res.append(rings)
    return res

def main():
    taux = json.load(open(ICI + '/depense-par-age.json'))
    r = taux['eur_par_habitant_par_bande']   # 4 valeurs, mêmes bandes que BANDES
    pop = lire_population()
    iris = []
    feats = []
    sans_pop = []
    par_dep = {}
    vus = set()
    hors_poly = 0
    centre_dehors = []
    for d in DEPTS:
        data = json.load(open(BRUT + '/ign-iris/iris-%s.json' % d))
        membres = {q: c for c, qs in FUSIONS.items() for q in qs}   # quartier IGN -> zone fusionnée
        groupes = {}
        for f in data['features']:
            c = membres.get(f['properties']['code_iris'])
            if c:
                groupes.setdefault(c, []).append(f)
        for f in data['features']:
            p = f['properties']
            code = p['code_iris']
            vus.add(code)
            polys = anneaux_poly(f['geometry'])
            if code in membres:
                c = membres[code]
                if code != FUSIONS[c][0]:
                    continue   # la zone fusionnée prend la place du premier quartier ; les autres disparaissent
                assert len(groupes[c]) == len(FUSIONS[c]), 'fusion : quartier IGN manquant'
                polys = dissoudre([q for g in groupes[c] for q in anneaux_poly(g['geometry'])])
                code = c
                p = {'code_iris': c, 'nom_iris': FUSION_NOM[c], 'nom_commune': FUSION_NOM[c]}
                vus.update(FUSIONS[c]); vus.add(c)
            lon, lat, hors = point_interieur(polys)
            hors_poly += 1 if hors else 0
            if not dans_multi(lon, lat, polys):
                centre_dehors.append(code)
            e = pop.get(code)
            if e is None:
                sans_pop.append([code, p['nom_iris'], p['nom_commune']])
                e = [0.0, 0.0, 0.0, 0.0, 0.0]
            marche = sum(e[1 + i] * r[i] for i in range(4))
            iris.append([code, p['nom_iris'], p['nom_commune'], d, round(lat, 5), round(lon, 5),
                         round(e[0]), round(e[1]), round(e[2]), round(e[3]), round(e[4]), round(marche)])
            sg = simplifier_geom(polys)
            feats.append({'type': 'Feature', 'properties': {'code_iris': code},
                          'geometry': {'type': 'MultiPolygon', 'coordinates': sg}})
            par_dep[d] = par_dep.get(d, 0) + 1
    sans_contour = sorted([c for c in pop if c not in vus])
    meta = {
        'sources': {
            'population': "INSEE, Population - Principaux indicateurs - Iris, recensement 2023 (publié le 16/10/2026), Licence Ouverte 2.0",
            'contours': "IGN, Contours...IRIS (service WFS data.geopf.fr), Licence Ouverte 2.0",
            'depense': taux['source']},
        'annee': {'population': 2023, 'depense': taux['annee']},
        'depts': DEPTS,
        'depenseParAge': {'bandes': ['0-19 ans', '20-64 ans', '65-79 ans', '80 ans et +'],
                          'eurParHabitant': r, 'detail': taux},
        'colonnes': ['code_iris', 'nom_iris', 'nom_commune', 'dep', 'lat', 'lng', 'pop', 'pop0019', 'pop2064', 'pop6579', 'pop80p', 'marche'],
        'n': len(iris),
        'parDept': par_dep,
        'simplification_m': TOL_M,
        'sansPopulation': sans_pop,
        'populationSansContour': sans_contour,
    }
    out = {'meta': meta, 'iris': iris, 'geo': {'type': 'FeatureCollection', 'features': feats}}
    txt = 'window.POTENTIEL_SECTEUR=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    entete = ("// Potentiel d'un secteur — données préparées le 29/10/2026 par outils/preparer.py.\n"
              "// Population par quartier (IRIS) INSEE 2023 ; contours IGN simplifiés ; marché estimé = somme tranche d'âge x dépense par habitant.\n"
              "// Fichier généré : ne pas modifier à la main.\n")
    with open(SORTIE, 'w', encoding='utf-8') as f:
        f.write(entete + txt)
    print('quartiers', len(iris), par_dep)
    print('sans population', len(sans_pop), sans_pop[:10])
    print('population sans contour', len(sans_contour), sans_contour[:10])
    print('centre de gravite hors du quartier (point interieur utilise):', hors_poly)
    print('centre final hors du quartier (doit etre 0):', len(centre_dehors), centre_dehors[:5])
    print('octets', os.path.getsize(SORTIE))

main()

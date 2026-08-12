#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
national-histo.test.py — le modèle national doit garder la trace de ses passages.

`generate_national.py` réécrit `national.json` à chaque exécution mensuelle. Le fichier
ne contient que la photo du moment : volume France/an, saison, molécule. Aucune tendance.

Or c'est la TENDANCE du marché — « cette molécule progresse de 12 % sur un an » — qui
améliorerait vraiment la commande, bien plus que la saison (mesuré : la saison nationale
n'ajoute que 143 produits à la couverture existante). Elle ne peut se construire que par
accumulation : un mois non enregistré est perdu définitivement.

D'où `national-histo.json` : un point par (produit, mois), append-only, jamais purgé.
Format compact — colonnes parallèles — parce que 9 986 produits × N mois grossit vite.
"""
import os
import sys
import json
import shutil
import tempfile
import importlib.util

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RACINE, "generate_national.py")

spec = importlib.util.spec_from_file_location("gn", SRC)
gn = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gn)

ECHECS = []


def check(nom, cond, detail=""):
    if cond:
        print("  ok   %s" % nom)
    else:
        print("  ÉCHEC %s  %s" % (nom, detail))
        ECHECS.append(nom)


def lire(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def passe(tmp, data, mois):
    gn.HISTO = os.path.join(tmp, "national-histo.json")
    return gn.maj_histo(data, mois)


def scenario(nom, fn):
    tmp = tempfile.mkdtemp(prefix="nat-")
    print("\n▶ %s" % nom)
    try:
        fn(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def D(**kw):
    """Fabrique un jeu {cip: {v: volume}} minimal."""
    return {c: {"v": v, "s": [1.0] * 12, "d": "MOL", "g": 0} for c, v in kw.items()}


# ── 1. Premier passage : un point par produit ────────────────────────────────
def t1(tmp):
    n = passe(tmp, D(a=1000, b=2000), "2026-08")
    d = lire(os.path.join(tmp, "national-histo.json"))
    check("2 produits enregistrés", n == 2, repr(n))
    check("le mois est noté", d.get("mois") == ["2026-08"], repr(d.get("mois")))
    check("volumes rangés par produit", d["v"]["a"] == [1000] and d["v"]["b"] == [2000], repr(d["v"]))


# ── 2. Les mois s'empilent, alignés ──────────────────────────────────────────
def t2(tmp):
    passe(tmp, D(a=1000, b=2000), "2026-08")
    passe(tmp, D(a=1100, b=1900), "2026-09")
    d = lire(os.path.join(tmp, "national-histo.json"))
    check("2 mois", d["mois"] == ["2026-08", "2026-09"], repr(d["mois"]))
    check("série de a", d["v"]["a"] == [1000, 1100], repr(d["v"]["a"]))
    check("série de b", d["v"]["b"] == [2000, 1900], repr(d["v"]["b"]))


# ── 3. Un produit qui apparaît en cours de route est aligné par des trous ────
def t3(tmp):
    passe(tmp, D(a=1000), "2026-08")
    passe(tmp, D(a=1100, nouveau=500), "2026-09")
    d = lire(os.path.join(tmp, "national-histo.json"))
    check("le nouveau a un trou sur le 1er mois", d["v"]["nouveau"] == [None, 500], repr(d["v"]["nouveau"]))
    check("toutes les séries ont la longueur du nombre de mois",
          all(len(s) == 2 for s in d["v"].values()), repr({k: len(v) for k, v in d["v"].items()}))


# ── 4. Un produit qui disparaît garde son passé ──────────────────────────────
def t4(tmp):
    passe(tmp, D(a=1000, disparu=700), "2026-08")
    passe(tmp, D(a=1100), "2026-09")
    d = lire(os.path.join(tmp, "national-histo.json"))
    check("le disparu est toujours là", "disparu" in d["v"], repr(list(d["v"])))
    check("son passé est intact, complété par un trou", d["v"]["disparu"] == [700, None], repr(d["v"]["disparu"]))


# ── 5. Rejouer le MÊME mois ne duplique pas la colonne ───────────────────────
def t5(tmp):
    passe(tmp, D(a=1000), "2026-08")
    passe(tmp, D(a=1234), "2026-08")          # relance du robot le même mois
    d = lire(os.path.join(tmp, "national-histo.json"))
    check("toujours un seul mois", d["mois"] == ["2026-08"], repr(d["mois"]))
    check("la valeur est mise à jour, pas ajoutée", d["v"]["a"] == [1234], repr(d["v"]["a"]))


# ── 6. Un historique illisible ne fait pas perdre le mois ────────────────────
def t6(tmp):
    p = os.path.join(tmp, "national-histo.json")
    with open(p, "w", encoding="utf-8") as f:
        f.write("pas du json {{{")
    n = passe(tmp, D(a=1000), "2026-08")
    check("le robot continue", n == 1, repr(n))
    check("et le fichier est réparé", lire(p)["mois"] == ["2026-08"])


# ── 7. Le fichier existe même si le modèle est vide ──────────────────────────
def t7(tmp):
    passe(tmp, {}, "2026-08")
    p = os.path.join(tmp, "national-histo.json")
    check("écrit quand même (sinon git add échoue en bloc)", os.path.exists(p))


for nom, fn in [("1. premier passage", t1),
                ("2. empilement des mois", t2),
                ("3. produit apparu en cours de route", t3),
                ("4. produit disparu : passé conservé", t4),
                ("5. même mois rejoué", t5),
                ("6. historique illisible", t6),
                ("7. modèle vide", t7)]:
    scenario(nom, fn)

print("\n" + "=" * 60)
if ECHECS:
    print("ÉCHEC — %d vérification(s) : %s" % (len(ECHECS), " · ".join(ECHECS[:6])))
    sys.exit(1)
print("TOUT PASSE")

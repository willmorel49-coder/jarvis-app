#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
archive-evenements.test.py — un événement détecté une fois ne doit plus jamais disparaître.

Plusieurs robots détectent un ÉVÉNEMENT daté (une baisse de prix publiée au JO, un avis
CEPS avec sa date d'effet) puis réécrivent entièrement leur fichier au passage suivant.
Or les sources sont des fenêtres glissantes :

  · DILA JORFSIMPLE = 40 tarballs ≈ 20 jours. Passé ce délai, l'avis n'existe plus nulle part.
  · BDPM ne publie AUCUN historique de prix — d'où l'instantané que le robot garde lui-même.

`archive_evenements.archiver()` est le mécanisme commun : append-only, jamais purgé.
Le test charge la VRAIE fonction du fichier livré.
"""
import os
import sys
import json
import shutil
import tempfile
import importlib.util

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RACINE, "archive_evenements.py")

spec = importlib.util.spec_from_file_location("archive_evenements", SRC)
ae = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ae)

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


CLE = lambda e: (e.get("c"), e.get("date_effet"))


def scenario(nom, fn):
    tmp = tempfile.mkdtemp(prefix="arch-")
    print("\n▶ %s" % nom)
    try:
        fn(os.path.join(tmp, "archive.json"))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── 1. Le fichier est créé même sans événement ───────────────────────────────
def t1(p):
    tot, neufs = ae.archiver(p, [], CLE, "2026-08-12")
    check("écrit même avec zéro événement", os.path.exists(p))
    check("total = 0", tot == 0, repr(tot))
    check("nouveaux = 0", neufs == 0, repr(neufs))
    d = lire(p)
    check("structure exploitable", isinstance(d.get("evenements"), list), repr(list(d)))


# ── 2. Les événements s'accumulent, sans doublon ─────────────────────────────
def t2(p):
    j1 = [{"c": "3400933753672", "date_effet": "2026-07-01", "pfht": 1.97},
          {"c": "3400930006023", "date_effet": "2026-08-04", "pfht": 1193.28}]
    tot, neufs = ae.archiver(p, j1, CLE, "2026-08-12")
    check("2 événements au 1er passage", (tot, neufs) == (2, 2), repr((tot, neufs)))

    # lendemain : les 2 mêmes + 1 nouveau
    j2 = j1 + [{"c": "3400930233351", "date_effet": "2026-08-15", "pfht": 1.87}]
    tot, neufs = ae.archiver(p, j2, CLE, "2026-08-13")
    check("seul le nouveau est ajouté", (tot, neufs) == (3, 1), repr((tot, neufs)))

    # surlendemain : la source a glissé, les 2 premiers ont DISPARU d'elle
    tot, neufs = ae.archiver(p, [j2[2]], CLE, "2026-08-14")
    check("un événement sorti de la source reste archivé", tot == 3, repr(tot))
    check("rien de nouveau", neufs == 0, repr(neufs))
    cips = sorted(e["c"] for e in lire(p)["evenements"])
    check("les 3 CIP sont toujours là", len(cips) == 3, repr(cips))


# ── 3. La date de 1re observation est figée, pas réécrite ────────────────────
def t3(p):
    ev = [{"c": "3400930233351", "date_effet": "2026-08-15", "pfht": 1.87}]
    ae.archiver(p, ev, CLE, "2026-08-12")
    ae.archiver(p, ev, CLE, "2026-08-20")
    e = lire(p)["evenements"][0]
    check("vu le = 1re observation, pas la dernière", e.get("vu") == "2026-08-12", repr(e.get("vu")))
    check("les données de l'événement sont conservées", e.get("pfht") == 1.87, repr(e.get("pfht")))


# ── 4. Le contenu existant n'est JAMAIS réécrit par une version plus pauvre ──
def t4(p):
    ae.archiver(p, [{"c": "X", "date_effet": "2026-08-01", "pfht": 12.5, "d": "OFEV"}], CLE, "2026-08-12")
    # même clé, mais la source renvoie moins d'infos ce jour-là
    ae.archiver(p, [{"c": "X", "date_effet": "2026-08-01"}], CLE, "2026-08-13")
    e = lire(p)["evenements"][0]
    check("le prix d'origine survit", e.get("pfht") == 12.5, repr(e.get("pfht")))
    check("le libellé d'origine survit", e.get("d") == "OFEV", repr(e.get("d")))


# ── 5. Un fichier d'archive corrompu ne fait pas perdre la journée ───────────
def t5(p):
    with open(p, "w", encoding="utf-8") as f:
        f.write("{ ceci n'est pas du JSON")
    tot, neufs = ae.archiver(p, [{"c": "Y", "date_effet": "2026-08-01"}], CLE, "2026-08-12")
    check("le robot continue malgré l'archive illisible", tot == 1, repr(tot))
    check("et le fichier est réparé", isinstance(lire(p).get("evenements"), list))


# ── 6. Une clé incomplète ne crée pas de faux doublons ───────────────────────
def t6(p):
    # deux avis distincts sur le MÊME produit à deux dates d'effet différentes
    ae.archiver(p, [{"c": "Z", "date_effet": "2026-08-01", "pfht": 10.0},
                    {"c": "Z", "date_effet": "2026-09-01", "pfht": 9.0}], CLE, "2026-08-12")
    check("2 avis sur le même produit = 2 lignes", len(lire(p)["evenements"]) == 2)
    # un événement sans clé exploitable ne doit pas tout écraser
    tot, _ = ae.archiver(p, [{"pfht": 8.0}], CLE, "2026-08-13")
    check("un événement sans clé est ignoré, pas fusionné", tot == 2, repr(tot))


for nom, fn in [("1. fichier créé même vide", t1),
                ("2. accumulation sans doublon, source glissante", t2),
                ("3. date de 1re observation figée", t3),
                ("4. jamais réécrit par plus pauvre", t4),
                ("5. archive corrompue = journée sauvée", t5),
                ("6. clés multiples et clé absente", t6)]:
    scenario(nom, fn)

print("\n" + "=" * 60)
if ECHECS:
    print("ÉCHEC — %d vérification(s) : %s" % (len(ECHECS), " · ".join(ECHECS[:6])))
    sys.exit(1)
print("TOUT PASSE")

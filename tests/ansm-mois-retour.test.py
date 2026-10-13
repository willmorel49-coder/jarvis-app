#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ansm-mois-retour.test.py — le mois nommé dans le texte ANSM doit être celui qu'on garde.

Pourquoi : « fin octobre 2026. Un délai pouvant aller jusqu'à plusieurs semaines… »
donnait iso 2026-05 : le mot « semaines » contient « mai », et la recherche par
simple sous-chaîne le trouvait avant « octobre ». Le mois doit être cherché comme
un MOT entier. Charge la VRAIE fonction norm_date du fichier livré.
"""
import os
import sys
import importlib.util

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("gad", os.path.join(RACINE, "generate_ansm_dispo.py"))
gad = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gad)

CAS = [
    ("fin octobre 2026. Un délai pouvant aller jusqu'à plusieurs semaines est nécessaire", "2026-10", "fin"),
    ("courant septembre 2026", "2026-09", "mois"),
    ("début mai 2027", "2027-05", "début"),
    ("troisième trimestre 2027", "2027-07", "trimestre"),
    ("fin août 2026", "2026-08", "fin"),
]
ko = 0
for raw, iso, approx in CAS:
    r = gad.norm_date(raw)
    ok = r is not None and r["iso"] == iso and r["approx"] == approx
    print(("OK  " if ok else "FAIL"), raw[:50], "->", r and (r["iso"], r["approx"]))
    ko += 0 if ok else 1
sys.exit(1 if ko else 0)

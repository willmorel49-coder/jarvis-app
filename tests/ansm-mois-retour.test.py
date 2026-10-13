#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ansm-mois-retour.test.py — le mois nommé dans le texte ANSM doit être celui qu'on garde.

Pourquoi : « fin octobre 2026. Un délai pouvant aller jusqu'à plusieurs semaines… »
donnait iso 2026-05 : le mot « semaines » contient « mai », et la recherche par
simple sous-chaîne le trouvait avant « octobre ». Le mois doit être cherché comme
un MOT entier. Même règle pour « début / fin / mi » (« afin », « définitif »,
« finalement », « demi »… ne sont pas « fin » ni « mi ») et pour les trimestres
(« 3e », « 2ème », « T3 » étaient ignorés ; un semestre n'a pas de mois : année seule).
Charge la VRAIE fonction norm_date du fichier livré.
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
    # trimestres : 1er mois du trimestre, l'écran écrit « T3 2027 »
    ("3e trimestre 2027", "2027-07", "trimestre"),
    ("2ème trimestre 2027", "2027-04", "trimestre"),
    ("2eme trimestre 2027", "2027-04", "trimestre"),
    ("4ème trimestre 2026", "2026-10", "trimestre"),
    ("T3 2027", "2027-07", "trimestre"),
    ("1er trimestre 2027", "2027-01", "trimestre"),
    ("Premier trimestre 2027.", "2027-01", "trimestre"),
    # semestre : pas de mois honnête -> année seule
    ("premier semestre 2027", "2027", "année"),
    ("2ème semestre 2027", "2027", "année"),
    ("second semestre 2026", "2026", "année"),
    # début / fin / mi en mot entier
    ("courant octobre 2026 afin de couvrir les besoins", "2026-10", "mois"),
    ("novembre 2026, la situation sera définitive", "2026-11", "mois"),
    ("décembre 2026 mais finalement plus tard", "2026-12", "mois"),
    ("courant mars 2027 pour un demi-lot", "2027-03", "mois"),
    ("avril 2027 : mise à disposition progressive", "2027-04", "mois"),
    ("mi-octobre 2026", "2026-10", "mi"),
    ("mi novembre 2026", "2026-11", "mi"),
    ("début novembre 2026", "2026-11", "début"),
    ("debut novembre 2026", "2026-11", "début"),
    ("fin octobre 2026", "2026-10", "fin"),
    ("fin 2026.", "2026", "année"),
]
ko = 0
for raw, iso, approx in CAS:
    r = gad.norm_date(raw)
    ok = r is not None and r["iso"] == iso and r["approx"] == approx
    print(("OK  " if ok else "FAIL"), raw[:50], "->", r and (r["iso"], r["approx"]))
    ko += 0 if ok else 1
sys.exit(1 if ko else 0)

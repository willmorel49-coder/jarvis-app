#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ema-penuries-fr.test.py — les substances françaises des pénuries EMA ne viennent QUE de la BDPM.

Engagement affiché à l'utilisateur : « nom officiel français, repris de la base publique des
médicaments, pas une traduction automatique ; sans équivalent sûr, la substance reste en anglais ».
Charge la VRAIE fonction traduire() du générateur livré, avec une mini-BDPM en mémoire.
"""
import os
import sys
import importlib.util

os.environ["BDPM_BASE_URL"] = "http://127.0.0.1:9/"          # adresse morte : pour l'épreuve « BDPM injoignable »
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("gep", os.path.join(RACINE, "generate_ema_penuries.py"))
gep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gep)

NOMS = ["SÉMAGLUTIDE", "INSULINE DÉGLUDEC", "INSULINE ASPARTE", "CLAVULANIQUE (ACIDE)", "ACIDE CLAVULANIQUE", "AMOXICILLINE",
        "PHOSPHATE DE FLUDARABINE", "TRIOXYDE D'ARSENIC", "RISPÉRIDONE", "CHLORHYDRATE D'ESMOLOL", "ZZ SUBSTANCE VOISINE"]
noms = {}
for n in NOMS:
    noms.setdefault(gep.cle(n), n)
bdpm = (noms, {"111": {"SUBSTANCE VOISINE"}}, {"champix": {"111"}})

ko = []


def verifie(nom, obtenu, attendu):
    if obtenu != attendu:
        ko.append("%s : obtenu %r, attendu %r" % (nom, obtenu, attendu))


verifie("composants", gep.composants("atomoxetine;methylphenidate"), ["atomoxetine", "methylphenidate"])
verifie("virgule dans une parenthèse", gep.composants("Japanese encephalitis vaccine (inactivated, adsorbed)"), ["Japanese encephalitis vaccine (inactivated, adsorbed)"])
verifie("accents et casse", gep.traduire(bdpm, "semaglutide")[0], "sémaglutide")
verifie("règle insulin → insuline", gep.traduire(bdpm, "insulin degludec")[0], "insuline dégludec")
verifie("règle aspart → asparte", gep.traduire(bdpm, "insulin aspart")[0], "insuline asparte")
verifie("ordre des mots (acide)", gep.traduire(bdpm, "clavulanic acid")[0] in ("acide clavulanique", "clavulanique (acide)"), True)
verifie("sel : on ne choisit pas à la place de la BDPM", gep.traduire(bdpm, "fludarabine")[0], None)
verifie("sel : esmolol ≠ chlorhydrate d'esmolol", gep.traduire(bdpm, "esmolol")[0], None)
verifie("trioxyde", gep.traduire(bdpm, "arsenic trioxide")[0], "trioxyde d'arsenic")
verifie("association réussie", gep.traduire(bdpm, "amoxicillin;clavulanic acid")[0] is not None, True)
verifie("association : un seul échec = tout en anglais", gep.traduire(bdpm, "amoxicillin;fludarabine")[0], None)
verifie("aucune forme fabriquée", gep.traduire(bdpm, "zorbaxine")[0], None)
verifie("sans substance", gep.traduire(bdpm, "")[0], None)
verifie("BDPM absente", gep.traduire(None, "semaglutide")[0], None)
verifie("pont par spécialité (ressemblance)", gep.traduire(bdpm, "substance voisin", cis={"111"})[0], "substance voisine")
verifie("pont sans spécialité liée", gep.traduire(bdpm, "substance voisin", cis=set())[0], None)
verifie("BDPM injoignable → None, sans exception", gep.charger_bdpm(), None)

if ko:
    print("ECHEC :\n  " + "\n  ".join(ko))
    sys.exit(1)
print("OK · 17 cas : les substances françaises viennent de la BDPM ou restent en anglais")

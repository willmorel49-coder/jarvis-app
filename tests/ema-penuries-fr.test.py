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
verifie("sel : on ne choisit pas à la place de la BDPM", gep.traduire(bdpm, "fludarabine", table=False)[0], None)
verifie("sel : esmolol ≠ chlorhydrate d'esmolol", gep.traduire(bdpm, "esmolol", table=False)[0], None)
verifie("trioxyde", gep.traduire(bdpm, "arsenic trioxide")[0], "trioxyde d'arsenic")
verifie("association réussie", gep.traduire(bdpm, "amoxicillin;clavulanic acid")[0] is not None, True)
verifie("association : un seul échec = tout en anglais", gep.traduire(bdpm, "amoxicillin;fludarabine", table=False)[0], None)
verifie("aucune forme fabriquée", gep.traduire(bdpm, "zorbaxine")[0], None)
verifie("sans substance", gep.traduire(bdpm, "")[0], None)
verifie("BDPM absente", gep.traduire(None, "semaglutide")[0], None)
verifie("pont par spécialité (ressemblance)", gep.traduire(bdpm, "substance voisin", cis={"111"})[0], "substance voisine")
verifie("pont sans spécialité liée", gep.traduire(bdpm, "substance voisin", cis=set())[0], None)
verifie("BDPM injoignable → None, sans exception", gep.charger_bdpm(), None)

# ── Table de secours (13/10/2026) : la BDPM gagne, la table comble, l'inconnu reste en anglais ──
T = gep.TABLE_SUBSTANCES
bdpm_t = ({**noms, **{gep.cle("MÉCASERMINE"): "MÉCASERMINE"}}, {}, {})
sauve = T.get("mecasermin")
T["mecasermin"] = "valeur de table qui doit perdre"
verifie("table : la BDPM gagne quand elle a un nom", gep.traduire(bdpm_t, "mecasermin"), ("mécasermine", ["BDPM (règle)"]))
del T["mecasermin"]
verifie("table : sans entrée ni BDPM → anglais", gep.traduire(bdpm, "mecasermin")[0], None)
T["mecasermin"] = sauve
verifie("table : la BDPM n'a rien → la table sert", gep.traduire(bdpm, "parathyroid hormone"), ("hormone parathyroïdienne", ["table"]))
verifie("table : esmolol (BDPM n'a que le sel) → table", gep.traduire(bdpm, "esmolol"), ("esmolol", ["table"]))
verifie("table : substance inconnue des deux → anglais", gep.traduire(bdpm, "zorbaxine")[0], None)
verifie("table : tout ou rien (un composant inconnu)", gep.traduire(bdpm, "insulin human;zorbaxine")[0], None)
verifie("table : plusieurs substances, séparateur gardé", gep.traduire(bdpm, "atomoxetine;methylphenidate;lisdexamfetamine"),
        ("atomoxétine ; méthylphénidate ; lisdexamfétamine", ["table"] * 3))
verifie("table : association mixte BDPM + table", gep.traduire(bdpm, "semaglutide;insulin human"),
        ("sémaglutide ; insuline humaine", ["BDPM (règle)", "table"]))
verifie("table : sans BDPM la table ne sert pas", gep.traduire(None, "insulin human")[0], None)
verifie("table : désactivable", gep.traduire(bdpm, "insulin human", table=False)[0], None)
verifie("table : minuscules comme la BDPM", all(v == v.lower() for v in T.values()), True)
verifie("table : titre écrit à la main", gep.TABLE_TITRES["adhd medicines"], "Médicaments du TDAH")

# ── Parenthèses des titres (13/10/2026) : « Marque (substance) » → la substance passe en français ──
tp = lambda nom, inn, b=bdpm: gep.titre_parentheses(b, nom, inn)[0]
verifie("parenthèse = substance → traduite", tp("Fiasp PumpCart (insulin aspart)", "insulin aspart"), "Fiasp PumpCart (insuline asparte)")
verifie("parenthèse : casse ignorée", tp("Marque (Insulin Aspart)", "insulin aspart"), "Marque (insuline asparte)")
verifie("parenthèse : le reste du titre ne bouge pas (marque en anglais)", tp("Insuman Rapid, Basal and Comb 25 (insulin human)", "insulin human"),
        "Insuman Rapid, Basal and Comb 25 (insuline humaine)")
verifie("parenthèse : une des substances d'une association", tp("Marque (insulin aspart)", "semaglutide;insulin aspart"), "Marque (insuline asparte)")
verifie("parenthèse ≠ substance → inchangée", tp("Marque (various forms)", "insulin aspart"), None)
verifie("parenthèse : autre substance que la ligne → inchangée", tp("Marque (semaglutide)", "insulin aspart"), None)
verifie("parenthèse : substance sans nom français → inchangée", tp("Marque (zorbaxine)", "zorbaxine"), None)
verifie("parenthèse : BDPM absente → inchangée", gep.titre_parentheses(None, "Marque (insulin aspart)", "insulin aspart")[0], None)
verifie("parenthèse : Mycobutin reste traité par la table des titres", gep.TABLE_TITRES["mycobutin (rifabutin)"], "Mycobutin (rifabutine)")

if ko:
    print("ECHEC :\n  " + "\n  ".join(ko))
    sys.exit(1)
print("OK · 38 cas : BDPM d'abord, table écrite à la main en dernier recours, sinon anglais ; parenthèses des titres traduites")

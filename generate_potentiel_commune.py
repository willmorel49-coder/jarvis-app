#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_potentiel_commune.py — LE POTENTIEL, commune par commune.

Ce que le GERS ne sait pas faire : il dit ce que pèse un produit sur le marché,
jamais ce qu'une officine DEVRAIT vendre. Ici on l'estime.

Le raisonnement, en clair :
  1. Open Medic donne, pour chaque produit, les boîtes remboursées par TRANCHE D'ÂGE
     (0-19 / 20-59 / 60+). Agrégé par grande classe thérapeutique (ATC1), ça donne
     la consommation nationale d'un « 0-19 ans », d'un « 20-59 », d'un « 60+ ».
  2. L'INSEE donne la population par âge de chaque commune.
  3. Population locale × consommation par âge = boîtes ATTENDUES dans la commune.
  4. FINESS donne le nombre d'officines de la commune : on divise. C'est le potentiel
     d'UNE officine moyenne de cette commune, par classe thérapeutique.

⚠️ CE QUE CE CHIFFRE N'EST PAS. C'est une ESTIMATION calibrée sur des taux nationaux,
pas une mesure du marché réel d'une officine. Trois limites à écrire partout où le
chiffre s'affiche :
  · les gens ne vont pas toujours à la pharmacie de leur commune (zone de chalandise) ;
  · toutes les officines d'une commune sont supposées égales, ce qui est faux ;
  · les tranches d'âge de l'INSEE (0-19 / 20-64 / 65+) ne collent pas exactement à
    celles d'Open Medic (0-19 / 20-59 / 60+). Les 60-64 ans sont donc reconstitués
    en prenant la MOITIÉ de la tranche 55-64 de l'INSEE — hypothèse de répartition
    uniforme, honnête mais approximative. Le 0-19 ans, lui, coïncide exactement.

Le potentiel ne se compare qu'à lui-même : entre communes, entre classes. Il ne se
présente jamais comme « cette officine vaut X boîtes ».

Sources, toutes gratuites (Licence Ouverte / INSEE) :
  · crm/v2/marche-regional.json  (produit par âge — écrit par generate_marche_regional.py)
  · crm/v2/saison-cip.json       (code ATC par produit, déjà en place)
  · INSEE base IRIS « évolution et structure de la population » 2022
  · FINESS établissements (nombre d'officines par commune)

Écrit crm/v2/potentiel-commune.json. Python 3.9, urllib seul.
"""
import io
import os
import csv
import json
import zipfile
import datetime
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.join(HERE, "crm", "v2")
OUT = os.path.join(V2, "potentiel-commune.json")
CACHE = os.path.join(HERE, ".cache-potentiel")

INSEE_ZIP = "https://www.insee.fr/fr/statistiques/fichier/8647014/base-ic-evol-struct-pop-2022_csv.zip"
INSEE_CSV = "base-ic-evol-struct-pop-2022.CSV"
FINESS_CSV = "https://data-pipeline-open.s3.sbg.io.cloud.ovh.net/finess/finess_etablissements.csv"
UA = {"User-Agent": "Mozilla/5.0"}

# Les 14 classes ATC1 réellement présentes dans le catalogue, en clair.
ATC1 = {
    "A": "Digestif et métabolisme", "B": "Sang", "C": "Cardiovasculaire",
    "D": "Dermatologie", "G": "Génito-urinaire", "H": "Hormones",
    "J": "Anti-infectieux", "L": "Cancérologie et immunologie",
    "M": "Muscles et squelette", "N": "Système nerveux", "P": "Antiparasitaires",
    "R": "Respiratoire", "S": "Organes sensoriels", "V": "Divers",
}
ORDRE = sorted(ATC1)
BANDES = ["0-19", "20-59", "60+"]


def telecharger(url, nom):
    """Garde une copie locale : l'INSEE fait 24 Mo et FINESS 44 Mo, inutile de les
    reprendre à chaque essai. Le cache est HORS du dépôt."""
    os.makedirs(CACHE, exist_ok=True)
    chemin = os.path.join(CACHE, nom)
    if os.path.exists(chemin) and os.path.getsize(chemin) > 1000:
        return chemin
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=600) as r, io.open(chemin, "wb") as f:
        f.write(r.read())
    return chemin


def conso_par_age():
    """Boîtes remboursées par classe ATC1 et par tranche d'âge, France entière."""
    marche = json.load(io.open(os.path.join(V2, "marche-regional.json"), encoding="utf-8"))
    saison = json.load(io.open(os.path.join(V2, "saison-cip.json"), encoding="utf-8"))["data"]
    conso = {a: [0, 0, 0] for a in ORDRE}
    retenus, sans_atc, sans_age = 0, 0, 0
    for cip, d in marche["data"].items():
        ages = d.get("a")
        if not ages:
            sans_age += 1
            continue
        e = saison.get(cip) or {}
        code = str(e.get("a") or "")
        if not code or code[0] not in conso:
            sans_atc += 1
            continue
        retenus += 1
        for i in range(3):                      # l'index 3 est « âge inconnu » : écarté
            conso[code[0]][i] += ages[i]
    return conso, {"retenus": retenus, "sans_atc": sans_atc, "sans_age": sans_age}


def population_par_commune():
    """Agrège les IRIS à la commune. Rend {code_insee: [0-19, 20-59, 60+]}."""
    zchemin = telecharger(INSEE_ZIP, "insee.zip")
    pop = {}
    with zipfile.ZipFile(zchemin) as z:
        with z.open(INSEE_CSV) as f:
            texte = io.TextIOWrapper(f, encoding="latin-1", newline="")
            for row in csv.DictReader(texte, delimiter=";"):
                com = (row.get("COM") or "").strip()
                if not com:
                    continue
                def n(col):
                    try:
                        return float((row.get(col) or "0").replace(",", "."))
                    except ValueError:
                        return 0.0
                # 0-19 exact ; 60-64 reconstitué en prenant la moitié des 55-64
                demi = n("P22_POP5564") / 2.0
                jeunes = n("P22_POP0019")
                adultes = n("P22_POP2064") - demi
                seniors = n("P22_POP65P") + demi
                c = pop.setdefault(com, [0.0, 0.0, 0.0])
                c[0] += jeunes
                c[1] += max(adultes, 0.0)
                c[2] += seniors
    return pop


def officines_par_commune():
    """Compte les pharmacies d'officine de FINESS par code INSEE de commune."""
    chemin = telecharger(FINESS_CSV, "finess.csv")
    compte = {}
    with io.open(chemin, encoding="utf-8", errors="ignore", newline="") as f:
        for row in csv.DictReader(f, delimiter=";"):
            lib = (row.get("libcategetab") or "")
            if "Pharmacie d'Officine" not in lib:
                continue
            dep = (row.get("departement") or "").strip()
            com = (row.get("commune") or "").strip()
            if not dep or not com:
                continue
            code = (dep + com.zfill(3))[-5:] if len(dep) <= 2 else dep + com.zfill(3)
            compte[code] = compte.get(code, 0) + 1
    return compte


def main():
    conso, diag = conso_par_age()
    print("consommation : %d produits retenus, %d sans ATC, %d sans âge"
          % (diag["retenus"], diag["sans_atc"], diag["sans_age"]))

    pop = population_par_commune()
    print("INSEE : %d communes" % len(pop))
    tot = [sum(p[i] for p in pop.values()) for i in range(3)]
    print("population France : %.1f M (0-19) · %.1f M (20-59) · %.1f M (60+) · total %.1f M"
          % (tot[0] / 1e6, tot[1] / 1e6, tot[2] / 1e6, sum(tot) / 1e6))
    if not (60e6 < sum(tot) < 72e6):
        raise SystemExit("ECHEC : population France hors plage plausible, on n'écrit rien")

    offi = officines_par_commune()
    print("FINESS : %d officines dans %d communes" % (sum(offi.values()), len(offi)))

    # Taux de consommation : boîtes par habitant et par an, pour chaque classe et
    # chaque tranche d'âge. C'est le cœur du modèle.
    taux = {a: [conso[a][i] / tot[i] if tot[i] else 0.0 for i in range(3)] for a in ORDRE}

    # ── Les communes SANS pharmacie ────────────────────────────────────────────
    # 13,8 M de personnes vivent dans une commune sans officine. Elles consomment
    # quand même, et elles vont à la pharmacie d'à côté. Les ignorer sous-estimait
    # le potentiel de 22 % — et pas au hasard : l'erreur frappait exactement les
    # officines rurales, celles où l'enjeu est le plus fort. On redistribue donc la
    # population orpheline de chaque DÉPARTEMENT sur les communes du même département
    # qui ont une officine, au prorata de leur propre population.
    orphelins = {}
    for code, p in pop.items():
        if code in offi:
            continue
        dep = code[:3] if code[:2] in ("97", "98") else code[:2]
        o = orphelins.setdefault(dep, [0.0, 0.0, 0.0])
        for i in range(3):
            o[i] += p[i]
    base_dep = {}
    for code in offi:
        p = pop.get(code)
        if not p:
            continue
        dep = code[:3] if code[:2] in ("97", "98") else code[:2]
        base_dep[dep] = base_dep.get(dep, 0.0) + sum(p)

    data, sans_pop, ajoute = {}, 0, 0.0
    for code, nb in offi.items():
        p0 = pop.get(code)
        if not p0:
            sans_pop += 1
            continue
        dep = code[:3] if code[:2] in ("97", "98") else code[:2]
        part = (sum(p0) / base_dep[dep]) if base_dep.get(dep) else 0.0
        orph = orphelins.get(dep, [0.0, 0.0, 0.0])
        p = [p0[i] + orph[i] * part for i in range(3)]
        ajoute += sum(p) - sum(p0)
        attendu = []
        for a in ORDRE:
            boites = sum(taux[a][i] * p[i] for i in range(3))
            attendu.append(round(boites / nb))       # par officine de la commune
        data[code] = {"p": [round(x) for x in p], "o": nb, "a": attendu,
                      "pc": [round(x) for x in p0]}   # pc = population de la commune seule

    sortie = {
        "generated": datetime.date.today().isoformat(),
        "sources": "Open Medic (âge) + INSEE population 2022 + FINESS",
        "classes": [{"c": a, "n": ATC1[a]} for a in ORDRE],
        "bandes": BANDES,
        "champs": {"p": "population desservie (commune + part des communes sans officine du département)",
                   "pc": "population de la commune seule", "o": "officines de la commune",
                   "a": "boîtes/an attendues pour UNE officine, par classe ATC1"},
        "avertissement": ("Estimation calibrée sur des taux nationaux, jamais une mesure du "
                          "marché réel d'une officine : la clientèle déborde la commune, les "
                          "officines d'une même commune sont supposées égales, la population des "
                          "communes sans officine est répartie au prorata dans le département, "
                          "et la tranche "
                          "60-64 ans est reconstituée par moitié depuis les 55-64 de l'INSEE."),
        "taux_national": {a: [round(t, 6) for t in taux[a]] for a in ORDRE},
        "n": len(data),
        "data": data,
    }
    io.open(OUT, "w", encoding="utf-8").write(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")))
    print("écrit %s — %d communes, %.2f Mo" % (OUT, len(data), os.path.getsize(OUT) / 1e6))
    print("communes avec officine mais sans population INSEE : %d" % sans_pop)
    print("population redistribuée depuis les communes sans officine : %.1f M" % (ajoute / 1e6))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_marche_dm.py — LE MARCHÉ DES DISPOSITIFS MÉDICAUX, par région, en euros.

Open LPP (Assurance Maladie), le pendant d'Open Medic pour les dispositifs médicaux
inscrits à la Liste des Produits et Prestations : orthèses, pansements, contention,
incontinence, autocontrôle du glucose, maintien à domicile. Deux fichiers par année :
  · NB_AAAA_lpp_reg.CSV.gz          code LPP × région
  · NB_AAAA_lpp_age_sexe_reg.CSV.gz code LPP × âge × sexe × région

Ce que ça apporte : JARVIS était TOTALEMENT aveugle sur ce marché — 12 283 codes,
627 millions d'unités, 10,5 milliards d'euros remboursés en 2025.

⚠️ CE FICHIER NE SE RACCORDE PAS AU CATALOGUE. Il est indexé par CODE LPP, et nos
produits n'en portent pas : ni le catalogue, ni Offilog, ni les ventes. C'est donc
un marché vu par CATÉGORIE, pas par référence. Le dire partout où le chiffre
s'affiche — sinon quelqu'un croira lire ses propres ventes.

⚠️ IL MÉLANGE OFFICINE ET PRESTATAIRE. Les premières lignes en euros sont la PPC
(apnée du sommeil), les lits médicaux, les orthoprothèses : ce sont des prestataires,
pas le comptoir. Les catégories réellement officinales (orthèses petit appareillage,
autocontrôle du glucose, pansements) se lisent plus bas. Ne jamais présenter le total
comme un marché adressable par Intégral.

⚠️ LICENCE. Open Medic est déclaré en Licence Ouverte sur data.gouv ; Open LPP, publié
par le MÊME organisme (CNAM), n'a AUCUNE licence déclarée. Les données d'une
administration publique sont réutilisables par défaut et ce fichier ne contient que des
agrégats, mais le point est à confirmer avant toute diffusion externe.

⚠️ LE PIÈGE DU JETON. Le lien de téléchargement porte un jeton de SESSION :
   download_file.php?token=…&file=…
Une URL recopiée en dur expire et le robot tombe en panne en silence. Il faut donc,
à chaque exécution : appeler download2.php, LIRE le jeton dans la page rendue, puis
télécharger avec le MÊME cookie de session. C'est ce que fait fetch_annee().

⚠️ ON NE GARDE QUE LES 2 000 PREMIERS CODES. Ils pèsent 97 % des euros remboursés ;
les 10 283 autres alourdiraient le fichier pour rien, et l'app tourne sur iPhone.
Tableaux indexés par région, pas objets — sinon le fichier double de taille.

Écrit crm/v2/marche-dm.json. Python 3.9, urllib seul.
"""
import io
import os
import re
import csv
import gzip
import json
import datetime
import http.cookiejar
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "marche-dm.json")


BASE = "https://open-data-assurance-maladie.ameli.fr/LPP/"
UA = {"User-Agent": "Mozilla/5.0"}

# Codes BEN_REG réellement présents dans les fichiers. 5 regroupe les DOM.
#
# ⚠️ LA CORSE N'A PAS DE CODE. Le code INSEE « 94 » n'existe pas dans cette source :
# la nomenclature officielle de la CNAM (feuille BEN_REG du « descriptif des variables
# de la série Open Medic », assurance-maladie.ameli.fr/content/descriptif-des-variables-
# de-la-serie-open-medic) énonce 13 codes, dont « 93 = Provence-Alpes-Côte d'Azur ET
# CORSE ». Attendre un code 94 fabriquait une région à 0 € qui se lisait comme un
# marché vide. Recoupé le 27/09/2026 : la somme des 14 codes présents reconstitue le
# fichier national à 0,0001 % près — aucune région ne manque, la Corse est dans 93.
#
# 0 et 99 valent tous deux « inconnu » d'après la même nomenclature ; le fichier LPP
# émet réellement des lignes en « 0 ». On les replie sur 99, sinon elles sont jetées.
REGIONS = {
    "11": "Île-de-France", "24": "Centre-Val de Loire", "27": "Bourgogne-Franche-Comté",
    "28": "Normandie", "32": "Hauts-de-France", "44": "Grand Est",
    "52": "Pays de la Loire", "53": "Bretagne", "75": "Nouvelle-Aquitaine",
    "76": "Occitanie", "84": "Auvergne-Rhône-Alpes",
    "93": "Provence-Alpes-Côte d'Azur et Corse",
    "5": "Outre-mer", "99": "Région inconnue",
}
INCONNU = {"0", "99"}   # deux écritures du même « inconnu »
# Tranches d'âge réelles du fichier : 0 → 0-19 ans, 20 → 20-59, 60 → 60 et plus,
# 99 → âge inconnu. Il n'y en a pas d'autres : vérifié sur le fichier 2025.
AGES = {"0": "0-19", "20": "20-59", "60": "60+", "99": "inconnu"}


def num(s):
    """« 1.352,34 » → 1352.34. Le fichier est en format français : point pour les
    milliers, virgule pour les décimales. Inverser les deux divise un chiffre par
    mille sans lever d'erreur — c'est le genre de faute qui ne se voit pas."""
    s = (s or "").strip()
    if not s:
        return 0.0
    try:
        return float(s.replace(".", "").replace(",", "."))
    except ValueError:
        return 0.0


def nume(s):
    """« 1018584.23 » → 1018584.23. Open LPP écrit les nombres en format ANGLAIS,
    contrairement à Open Medic qui les écrit en français. Se tromper de convertisseur
    ne lève aucune erreur : ça divise simplement tout par cent, en silence."""
    s = (s or "").strip().strip('"')
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def ouvrir_session():
    cj = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def liens_de_lannee(op, annee):
    """Rend {nom_de_fichier: url_complète_avec_jeton} pour une année."""
    url = BASE + "download2.php?" + urllib.parse.urlencode({"Dir_Rep": "%s_LPP" % annee})
    req = urllib.request.Request(url, headers=UA)
    with op.open(req, timeout=60) as r:
        page = r.read().decode("utf-8", "ignore")
    liens = {}
    for href in re.findall(r'download_file\.php\?[^"\'>]+', page):
        href = href.replace("&amp;", "&")
        m = re.search(r"/([^/]+\.CSV\.gz)$", href)
        if m:
            liens[m.group(1)] = BASE + href
    return liens


def telecharger(op, url):
    req = urllib.request.Request(url, headers=UA)
    with op.open(req, timeout=300) as r:
        brut = r.read()
    if brut[:2] != b"\x1f\x8b":
        raise RuntimeError("le serveur n'a pas rendu un .gz (jeton expiré ?)")
    return gzip.decompress(brut).decode("latin-1")


def main():
    annee = int(os.environ.get("ANNEE", "2025"))
    op = ouvrir_session()
    liens = liens_de_lannee(op, annee)
    f_reg = "NB_%d_lpp_reg.CSV.gz" % annee
    f_age = "NB_%d_lpp_age_sexe_reg.CSV.gz" % annee
    for f in (f_reg, f_age):
        if f not in liens:
            raise SystemExit("ECHEC : %s absent de la page de l'année %d" % (f, annee))

    ordre = [c for c in REGIONS if c != "99"] + ["99"]
    iReg = {c: i for i, c in enumerate(ordre)}
    ordreAge = ["0", "20", "60", "99"]
    iAge = {a: i for i, a in enumerate(ordreAge)}

    # ── code LPP × région : quantités et euros remboursés ──────────────────────
    # Colonnes réelles : CODE_LPP;L_CODE_LPP;BEN_REG;NBC;REM;BSE;QTE
    # ⚠️ Les nombres sont ici en format ANGLAIS (« 1018584.23 »), pas français comme
    # dans Open Medic. Appliquer la conversion française diviserait tout par cent.
    par_code = {}
    libelle = {}
    lignes = 0
    for ligne in csv.reader(io.StringIO(telecharger(op, liens[f_reg])), delimiter=";"):
        lignes += 1
        if lignes == 1 or len(ligne) < 7:
            continue
        code = ligne[0].strip().strip('"')
        reg = ligne[2].strip()
        if reg in INCONNU:
            reg = "99"       # « 0 » et « 99 » sont le même « inconnu » (nomenclature CNAM)
        if reg not in iReg:
            continue
        e = par_code.setdefault(code, {"q": [0] * len(ordre), "e": [0.0] * len(ordre)})
        e["q"][iReg[reg]] += int(nume(ligne[6]))
        e["e"][iReg[reg]] += nume(ligne[4])
        if code not in libelle:
            libelle[code] = ligne[1].strip().strip('"')
    print("fichier région : %d lignes lues, %d codes LPP" % (lignes, len(par_code)))

    # On ne garde que les codes qui pèsent : 2 000 suffisent pour 97 % des euros.
    classe = sorted(par_code.items(), key=lambda kv: -sum(kv[1]["e"]))
    total_euros = sum(sum(v["e"]) for v in par_code.values())
    gardes = dict(classe[:2000])
    part = (sum(sum(v["e"]) for v in gardes.values()) / total_euros * 100) if total_euros else 0
    print("retenus : %d codes sur %d, soit %.1f %% des euros" % (len(gardes), len(par_code), part))

    # ── produit × âge : national, suffisant pour un taux de consommation ───────
    par_age = {}
    lignes_age = 0
    for ligne in csv.reader(io.StringIO(telecharger(op, liens[f_age])), delimiter=";"):
        lignes_age += 1
        if lignes_age == 1 or len(ligne) < 9:
            continue
        code = ligne[0].strip().strip('"')
        if code not in gardes:
            continue
        age = ligne[2].strip()
        if age not in iAge:
            continue
        a = par_age.setdefault(code, [0] * len(ordreAge))
        a[iAge[age]] += int(nume(ligne[8]))
    print("fichier âge   : %d lignes lues, %d codes retenus" % (lignes_age, len(par_age)))

    data = {}
    for code, e in gardes.items():
        data[code] = {
            "l": libelle.get(code, ""),
            "q": e["q"],
            "e": [round(x) for x in e["e"]],   # l'euro près suffit, le centime alourdit
            "a": par_age.get(code),
        }

    sortie = {
        "generated": datetime.date.today().isoformat(),
        "source": "Open LPP — Assurance Maladie (CNAM)",
        "licence": ("AUCUNE licence déclarée sur data.gouv.fr, contrairement à Open Medic "
                    "publié par le même organisme (Licence Ouverte). Données publiques "
                    "d'une administration, agrégées, sans réidentification possible — "
                    "mais le point reste à confirmer avant toute diffusion externe."),
        "annee": annee,
        "regions": [{"c": c, "n": REGIONS[c]} for c in ordre],
        "ages": [AGES[a] for a in ordreAge],
        "champs": {"l": "libellé du code LPP", "q": "quantités remboursées",
                   "e": "euros remboursés", "a": "quantités par tranche d'âge (national)"},
        "avertissement": ("Marché vu par CODE LPP, jamais par référence : nos produits ne "
                          "portent pas de code LPP, aucun raccordement au catalogue n'est "
                          "possible. Le total mélange officine et prestataire (PPC, lits "
                          "médicaux, orthoprothèses) : il n'est PAS un marché adressable."),
        "couverture": {"codes_total": len(par_code), "codes_retenus": len(gardes),
                       "part_euros": round(part, 1)},
        "n": len(data),
        "data": data,
    }
    io.open(OUT, "w", encoding="utf-8").write(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")))
    print("écrit %s — %d produits, %.1f Mo" % (OUT, len(data), os.path.getsize(OUT) / 1e6))
    print("euros couverts : %.1f %% du marché LPP" % part)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_marche_regional.py — LE MARCHÉ PAR RÉGION, en boîtes ET en euros.

Open Medic « bases complémentaires » (Assurance Maladie, Licence Ouverte Etalab,
gratuit, sans clé). Deux fichiers par année :
  · NB_AAAA_cip13_reg.CSV.gz          produit × région
  · NB_AAAA_cip13_age_sexe_reg.CSV.gz produit × âge × sexe × région

Ce que ça apporte que JARVIS n'avait pas :
  · la RÉGION (openmedic.json et Medic'AM sont nationaux)
  · les EUROS (REM = remboursé, BSE = base de remboursement), et plus seulement
    un nombre de boîtes — donc une vraie valeur de marché
  · la consommation par TRANCHE D'ÂGE, socle du potentiel par officine

⚠️ LE PIÈGE DU JETON. Le lien de téléchargement porte un jeton de SESSION :
   download_file.php?token=…&file=…
Une URL recopiée en dur expire et le robot tombe en panne en silence. Il faut donc,
à chaque exécution : appeler download2.php, LIRE le jeton dans la page rendue, puis
télécharger avec le MÊME cookie de session. C'est ce que fait fetch_annee().

⚠️ ON NE GARDE QUE LE CATALOGUE INTÉGRAL. Le fichier source fait 137 000 lignes par
année ; l'app tourne sur iPhone. On filtre sur les CIP du catalogue et on écrit des
tableaux indexés par région, pas des objets — sinon le fichier double de taille.

Écrit crm/v2/marche-regional.json. Python 3.9, urllib seul.
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
OUT = os.path.join(HERE, "crm", "v2", "marche-regional.json")
CATALOGUE = os.path.join(HERE, "crm", "v2", "catalogue-complet-data.js")

BASE = "https://open-data-assurance-maladie.ameli.fr/medicaments/"
UA = {"User-Agent": "Mozilla/5.0"}

# Codes BEN_REG réellement présents dans les fichiers. 5 regroupe les DOM,
# 99 = région inconnue (on la garde : l'exclure fausserait les totaux France).
REGIONS = {
    "11": "Île-de-France", "24": "Centre-Val de Loire", "27": "Bourgogne-Franche-Comté",
    "28": "Normandie", "32": "Hauts-de-France", "44": "Grand Est",
    "52": "Pays de la Loire", "53": "Bretagne", "75": "Nouvelle-Aquitaine",
    "76": "Occitanie", "84": "Auvergne-Rhône-Alpes", "93": "Provence-Alpes-Côte d'Azur",
    "94": "Corse", "5": "Outre-mer", "99": "Région inconnue",
}
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


def ouvrir_session():
    cj = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def liens_de_lannee(op, annee):
    """Rend {nom_de_fichier: url_complète_avec_jeton} pour une année."""
    url = BASE + "download2.php?" + urllib.parse.urlencode({"Dir_Rep": "%s_CIP13" % annee})
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


def cips_du_catalogue():
    """Les CIP13 du catalogue Intégral, remboursables ET non remboursables : on veut
    pouvoir MONTRER que le non-remboursable est absent de la source, pas le masquer."""
    txt = io.open(CATALOGUE, encoding="utf-8").read()
    m = re.search(r'"rows"\s*:\s*(\[.*?\])\s*[,}]\s*$', txt, re.S)
    if not m:
        m = re.search(r'rows\s*:\s*(\[.*)', txt, re.S)
        brut = m.group(1)
        prof, fin = 0, 0
        for i, ch in enumerate(brut):
            if ch == "[":
                prof += 1
            elif ch == "]":
                prof -= 1
                if prof == 0:
                    fin = i + 1
                    break
        rows = json.loads(brut[:fin])
    else:
        rows = json.loads(m.group(1))
    return {str(r[0]).strip(): (r[4] == "nr") for r in rows if r and r[0]}


def main():
    annee = int(os.environ.get("ANNEE", "2025"))
    op = ouvrir_session()
    liens = liens_de_lannee(op, annee)
    f_reg = "NB_%d_cip13_reg.CSV.gz" % annee
    f_age = "NB_%d_cip13_age_sexe_reg.CSV.gz" % annee
    for f in (f_reg, f_age):
        if f not in liens:
            raise SystemExit("ECHEC : %s absent de la page de l'année %d" % (f, annee))

    cat = cips_du_catalogue()
    print("catalogue Intégral : %d CIP13" % len(cat))

    ordre = [c for c in REGIONS if c != "99"] + ["99"]
    iReg = {c: i for i, c in enumerate(ordre)}
    ordreAge = ["0", "20", "60", "99"]
    iAge = {a: i for i, a in enumerate(ordreAge)}

    # ── produit × région : boîtes et euros remboursés ──────────────────────────
    par_cip = {}
    libelle = {}
    lignes = 0
    for ligne in csv.reader(io.StringIO(telecharger(op, liens[f_reg])), delimiter=";"):
        lignes += 1
        if lignes == 1 or len(ligne) < 7:
            continue
        cip = ligne[0].strip()
        if cip not in cat:
            continue
        reg = ligne[2].strip()
        if reg not in iReg:
            continue
        e = par_cip.setdefault(cip, {"b": [0] * len(ordre), "e": [0.0] * len(ordre)})
        e["b"][iReg[reg]] += int(num(ligne[6]))
        e["e"][iReg[reg]] += num(ligne[4])
        if cip not in libelle:
            libelle[cip] = ligne[1].strip()
    print("fichier région : %d lignes lues, %d CIP du catalogue retenus" % (lignes, len(par_cip)))

    # ── produit × âge : national, suffisant pour un taux de consommation ───────
    par_age = {}
    lignes_age = 0
    for ligne in csv.reader(io.StringIO(telecharger(op, liens[f_age])), delimiter=";"):
        lignes_age += 1
        if lignes_age == 1 or len(ligne) < 9:
            continue
        cip = ligne[0].strip()
        if cip not in cat:
            continue
        age = ligne[2].strip()
        if age not in iAge:
            continue
        a = par_age.setdefault(cip, [0] * len(ordreAge))
        a[iAge[age]] += int(num(ligne[8]))
    print("fichier âge   : %d lignes lues, %d CIP du catalogue retenus" % (lignes_age, len(par_age)))

    data = {}
    for cip, e in par_cip.items():
        data[cip] = {
            "b": e["b"],
            "e": [round(x) for x in e["e"]],   # l'euro près suffit, le centime alourdit
            "a": par_age.get(cip),
        }

    rb = sum(1 for c, nr in cat.items() if not nr)
    nr = len(cat) - rb
    couv_rb = sum(1 for c, nr_ in cat.items() if not nr_ and c in data)
    couv_nr = sum(1 for c, nr_ in cat.items() if nr_ and c in data)

    sortie = {
        "generated": datetime.date.today().isoformat(),
        "source": "Open Medic bases complémentaires — Assurance Maladie (Licence Ouverte)",
        "annee": annee,
        "regions": [{"c": c, "n": REGIONS[c]} for c in ordre],
        "ages": [AGES[a] for a in ordreAge],
        "champs": {"b": "boîtes remboursées", "e": "euros remboursés", "a": "boîtes par tranche d'âge (national)"},
        "couverture": {
            "catalogue_remboursable": rb, "couvert_remboursable": couv_rb,
            "catalogue_non_remboursable": nr, "couvert_non_remboursable": couv_nr,
        },
        "n": len(data),
        "data": data,
    }
    io.open(OUT, "w", encoding="utf-8").write(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")))
    print("écrit %s — %d produits, %.1f Mo" % (OUT, len(data), os.path.getsize(OUT) / 1e6))
    print("couverture remboursable : %d/%d (%.1f %%)" % (couv_rb, rb, couv_rb * 100.0 / max(rb, 1)))
    print("couverture NON remboursable : %d/%d (%.1f %%)" % (couv_nr, nr, couv_nr * 100.0 / max(nr, 1)))


if __name__ == "__main__":
    main()

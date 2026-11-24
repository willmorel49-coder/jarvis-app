#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_ansm_arrets.py — Étude par produit : les ARRÊTS DE COMMERCIALISATION ANNONCÉS à l'avance.

Source : data.gouv.fr, jeu « ANSM Open Data » (organisation ANSM), table presentation_evenement :
les événements de vie de chaque présentation (CIP13). On garde le code 102 « Arrêt de commercialisation
à venir » : la date d'arrêt que le laboratoire a déclarée à l'avance.
Ce n'est PAS une prédiction, c'est une annonce dont la tenue n'a pas pu être mesurée : le 24/11/2026,
sur 19 dates déjà passées, la BDPM n'en marquait qu'une comme arrêtée. La page data.gouv.fr porte la
mention « travaux en cours, ne pas utiliser ». Choix de Will (24/11/2026) : une ligne sur la fiche,
avec la source et la date du fichier.

L'adresse du fichier change à chaque mise à jour (mensuelle) : elle est relue dans l'API data.gouv.fr
(ressource « presentation_evenement », format csv). La date du fichier montrée sur la fiche est celle de
cette ressource (last_modified), jamais écrite en dur.

Écrit crm/v2/ansm-arrets.json (clés triées : même contenu = mêmes octets). Colonnes absentes ou moins de
MINI annonces = rien n'est écrit, l'ancien fichier reste en place.
Python 3.9, aucune dépendance. Lancé chaque lundi par .github/workflows/ruptures.yml.
"""
import csv
import io
import json
import os
import re
import sys
import urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ICI, "crm", "v2", "ansm-arrets.json")
API = "https://www.data.gouv.fr/api/1/datasets/ansm-open-data/"
PAGE = "https://www.data.gouv.fr/datasets/ansm-open-data"
TABLE = "presentation_evenement"
CODE = "102"         # « Arrêt de commercialisation à venir »
MINI = 100           # 425 annonces le 24/11/2026 : en dessous de 100, le fichier lu n'est pas le bon
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def ressource():
    d = json.loads(fetch(API).decode("utf-8"))
    r = [x for x in d.get("resources", []) if x.get("title") == TABLE and (x.get("format") or "").lower() == "csv"]
    if len(r) != 1:
        raise SystemExit("Ressource « %s » (csv) trouvée %d fois sur data.gouv.fr : rien n'est écrit." % (TABLE, len(r)))
    version = (r[0].get("last_modified") or "")[:10]
    if not ISO.match(version):
        raise SystemExit("Date de la ressource illisible (%r) : rien n'est écrit." % r[0].get("last_modified"))
    return r[0]["url"], version


def main():
    url, version = ressource()
    lec = csv.DictReader(io.StringIO(fetch(url).decode("utf-8-sig")))
    manque = {"cip", "code_evenement", "date_evenement", "date_modification"} - set(lec.fieldnames or [])
    if manque:
        raise SystemExit("Colonnes absentes %s : rien n'est écrit." % sorted(manque))
    d, modif = {}, {}
    for x in lec:
        if (x.get("code_evenement") or "").strip() != CODE:
            continue
        cip = re.sub(r"\D", "", x.get("cip") or "")
        de = (x.get("date_evenement") or "")[:10]
        dm = x.get("date_modification") or ""
        if len(cip) != 13 or not ISO.match(de):
            continue
        # Deux annonces pour une même présentation : la dernière modifiée l'emporte.
        if cip not in d or dm > modif[cip]:
            d[cip], modif[cip] = de, dm
    if len(d) < MINI:
        raise SystemExit("%d annonces seulement (minimum %d) : rien n'est écrit." % (len(d), MINI))
    out = {
        "source": "ANSM, données ouvertes (data.gouv.fr) — événements des présentations, « Arrêt de commercialisation à venir »",
        "page": PAGE,
        "fichier": url,
        "version": version,
        "lecture": "d : CIP13 → date d'arrêt de commercialisation annoncée par le laboratoire (AAAA-MM-JJ)",
        "d": d,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    ans = {}
    for v in d.values():
        ans[v[:4]] = ans.get(v[:4], 0) + 1
    print("ansm-arrets.json : %d présentations, fichier du %s, par année : %s" % (len(d), version, sorted(ans.items())))


if __name__ == "__main__":
    sys.exit(main())

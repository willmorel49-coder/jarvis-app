#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Etape 1 — chercher e-mails et sites web des officines dans OpenStreetMap.

Pourquoi OSM et pas du scraping : c'est une API publique faite pour ca, gratuite,
sans cle, licence ODbL (reutilisation autorisee avec attribution). On interroge
UNE fois par departement au lieu de 249 fois, par politesse pour un service
communautaire.

Entree  : scripts/mails/a-trouver.json  (officines sans e-mail)
Sortie  : scripts/mails/osm.json        (cip -> {email, site, tel})

RAPPROCHEMENT — la lecon du 10/08/2026 :
les coordonnees du CRM sont au niveau de la COMMUNE, pas de l'adresse (trois
officines de Nantes partagent le meme point). Un rayon de 250 m ne rapproche donc
RIEN. On filtre large sur la geographie (6 km = la commune et ses abords) et on
decide sur le NOM. Un nom qui correspond a deux pharmacies differentes est
rejete : ecrire a la mauvaise officine coute plus cher qu'une case vide.
Compatible Python 3.9.
"""
import json
import math
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ICI = Path(__file__).resolve().parent
# Miroirs, dans l'ordre. Le principal limite vite le debit ; Kumi tient la charge.
MIROIRS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = "JARVIS-IntegralPharma/1.0 (enrichissement annuaire officines; contact via integralpharma.fr)"
RAYON_M = 6000     # large : les coordonnees sont communales
PAUSE_S = 3

MOTS_VIDES = {"pharmacie", "pharmacien", "phie", "grande", "nouvelle", "centrale",
              "de", "du", "des", "la", "le", "les", "l", "d", "et", "a", "au", "aux",
              "selarl", "sarl", "snc", "scp"}


def mots(t):
    t = (t or "").lower().replace("’", "'")
    t = re.sub(r"[^a-z0-9àâäéèêëîïôöùûüç]+", " ", t)
    return set(m for m in t.split() if m not in MOTS_VIDES and len(m) > 2)


def distance_m(a_lat, a_lon, b_lat, b_lon):
    r = math.pi / 180
    dlat = (b_lat - a_lat) * r
    dlon = (b_lon - a_lon) * r
    s = (math.sin(dlat / 2) ** 2
         + math.cos(a_lat * r) * math.cos(b_lat * r) * math.sin(dlon / 2) ** 2)
    return 2 * 6371000 * math.asin(min(1, math.sqrt(s)))


def overpass(dep):
    """Interroge les miroirs jusqu'a ce que l'un reponde. None si aucun."""
    req = (
        "[out:json][timeout:180];"
        'area["ref:INSEE"="%s"]["admin_level"="6"]->.a;'
        'nwr["amenity"="pharmacy"](area.a);'
        "out center tags;" % dep
    )
    for url in MIROIRS:
        try:
            r = urllib.request.Request(url, data=req.encode("utf-8"),
                                       headers={"User-Agent": UA, "Accept": "application/json"})
            data = urllib.request.urlopen(r, timeout=200).read()
            return json.loads(data.decode("utf-8")).get("elements", [])
        except Exception:
            time.sleep(2)
            continue
    return None


def coord(el):
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    return lat, lon


def tag(tags, *cles):
    for c in cles:
        v = (tags.get(c) or "").strip()
        if v:
            return v
    return ""


def main():
    cibles = json.loads((ICI / "a-trouver.json").read_text(encoding="utf-8"))
    par_dep = {}
    for o in cibles:
        if o.get("lat") and o.get("lon"):
            par_dep.setdefault((o.get("cp") or "")[:2], []).append(o)

    sortie = ICI / "osm.json"
    trouve = json.loads(sortie.read_text(encoding="utf-8")) if sortie.exists() else {}

    deps = sorted(d for d in par_dep if len(d) == 2 and d.isdigit())
    print("%d departements, %d officines a enrichir" % (len(deps), sum(len(v) for v in par_dep.values())))

    echecs = []
    for i, dep in enumerate(deps, 1):
        elements = overpass(dep)
        if elements is None:
            echecs.append(dep)
            print("  %s (%d/%d) : aucun miroir n'a repondu" % (dep, i, len(deps)))
            continue

        n_ok = n_mail = n_site = ambigus = 0
        for o in par_dep[dep]:
            cles = mots(o["nom"])
            if not cles:
                continue
            cands = []
            for el in elements:
                lat, lon = coord(el)
                if lat is None or lon is None:
                    continue
                if distance_m(o["lat"], o["lon"], lat, lon) > RAYON_M:
                    continue
                if mots((el.get("tags") or {}).get("name")) & cles:
                    cands.append(el)
            if len(cands) != 1:           # 0 = introuvable, >1 = ambigu -> on s'abstient
                if len(cands) > 1:
                    ambigus += 1
                continue
            t = cands[0].get("tags") or {}
            fiche = {
                "email": tag(t, "contact:email", "email"),
                "site": tag(t, "contact:website", "website"),
                "tel": tag(t, "contact:phone", "phone"),
                "nom_osm": t.get("name", ""),
            }
            if not (fiche["email"] or fiche["site"]):
                continue
            trouve[o["cip"]] = fiche
            n_ok += 1
            n_mail += 1 if fiche["email"] else 0
            n_site += 1 if fiche["site"] else 0

        sortie.write_text(json.dumps(trouve, ensure_ascii=False, indent=1), encoding="utf-8")
        print("  %s (%d/%d) : %4d pharmacies OSM -> %2d utiles (%d mails, %d sites)%s"
              % (dep, i, len(deps), len(elements), n_ok, n_mail, n_site,
                 "  [%d ambigus ecartes]" % ambigus if ambigus else ""))
        time.sleep(PAUSE_S)

    if not sortie.exists():
        print("\nAUCUN resultat : rien n'a ete ecrit.")
        return 1

    # le script relit ce qu'il a ecrit avant de dire que c'est fait
    verif = json.loads(sortie.read_text(encoding="utf-8"))
    avec_mail = sum(1 for v in verif.values() if v.get("email"))
    avec_site = sum(1 for v in verif.values() if v.get("site"))
    print("\nRESULTAT : %d officines rapprochees" % len(verif))
    print("  e-mail direct : %d" % avec_mail)
    print("  site web      : %d   (l'etape 2 ira y chercher l'adresse)" % avec_site)
    if echecs:
        print("  departements sans reponse : %s — relancer le script les reprendra"
              % ", ".join(echecs))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_signaux.py — SIGNAUX AVANCÉS de demande : ce qui va se vendre, pas ce qui s'est vendu.

Deux sources, toutes deux vérifiées le 27/09/2026, gratuites et sans clé :

1. RÉSEAU SENTINELLES (sentiweb.fr) — incidence par RÉGION, chaque semaine.
   Complète Odissé au lieu de le répéter :
     · Odissé donne une part des PASSAGES aux urgences (« 3,3 % des passages »)
     · Sentinelles donne une vraie INCIDENCE : des cas pour 100 000 HABITANTS
   Les deux ne mesurent pas la même chose et ne se remplacent pas. Et Sentinelles
   porte la VARICELLE, absente d'Odissé.
   Codes région INSEE : les mêmes que marche-regional.json — la jointure est directe.

2. CALENDRIER SCOLAIRE OFFICIEL (data.education.gouv.fr, Licence Ouverte).
   Des dates connues à l'avance : la rentrée tire les antipoux, les départs en
   vacances tirent le mal des transports et la trousse de secours. Aucun modèle,
   aucune prédiction — un calendrier.

⚠️ MÉTÉO : ÉCARTÉE, ET CE N'EST PAS UN OUBLI. Open-Meteo répond sans clé et donne
16 jours de prévisions, mais ses conditions réservent l'API gratuite à un usage
NON COMMERCIAL (« You may only use the free API services for non-commercial
purposes »). JARVIS est un outil d'entreprise : on n'y a pas droit. Il faudra soit
une source sous Licence Ouverte (Météo-France, qui demande un jeton), soit un
abonnement — donc une décision de Will, pas un choix de robot.

⚠️ pollens.fr ne répond plus : l'adresse redirige vers atmo-france.org, il n'y a
plus d'API. Le robot de veille qui la cite est probablement cassé lui aussi.

Écrit crm/v2/signaux.json. Python 3.9, urllib seul.
"""
import io
import os
import json
import datetime
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "signaux.json")
UA = {"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"}

SENTI = "https://www.sentiweb.fr/api/v1/datasets/rest/incidence"
CAL = ("https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/"
       "fr-en-calendrier-scolaire/records")

# Indicateurs Sentinelles réellement servis (vérifiés : 13 régions chacun).
INDICS = [
    {"id": 7, "cat": "ira", "label": "Syndromes grippaux",
     "rayons": "ORL · antipyrétiques · tests"},
    {"id": 3, "cat": "diarrhee", "label": "Diarrhée aiguë",
     "rayons": "Antidiarrhéiques · réhydratation · probiotiques"},
    {"id": 25, "cat": "varicelle", "label": "Varicelle",
     "rayons": "Antihistaminiques · antiseptiques cutanés"},
]
UNITE = "cas pour 100 000 habitants"

# Ce qu'une date scolaire tire vraiment au comptoir. On reste sur ce qui se défend :
# pas de « rentrée = vitamines » inventé pour faire joli.
RAYONS_ECOLE = [
    ("rentr", "Antipoux · désinfection · petite pharmacie familiale"),
    ("toussaint", "Mal des transports · trousse de secours"),
    ("noël", "Mal des transports · trousse de secours"),
    ("hiver", "Mal des transports · protection froid · lèvres"),
    ("printemps", "Mal des transports · trousse de secours"),
    ("été", "Solaires · anti-moustiques · mal des transports · trousse de secours"),
    ("ascension", "Mal des transports · trousse de secours"),
]


def http(url):
    """⚠️ Sentiweb LIMITE le débit. Le 27/09/2026, quelques appels lourds ont suffi
    pour récolter des HTTP 429 — et un 429 lu sans regarder le code rend « 0 ligne »,
    c'est-à-dire un faux zéro impossible à distinguer d'une vraie absence de données.
    On lève donc une erreur EXPLICITE, et on espace les appels."""
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                import gzip
                raw = gzip.decompress(raw)
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise RuntimeError("débit limité par la source (HTTP 429) — on n'écrit rien")
        raise RuntimeError("HTTP %s sur %s" % (e.code, url.split("?")[0]))
    return json.loads(raw.decode("utf-8", "ignore"))


def sentinelles(precedent):
    """UN SEUL appel léger par indicateur (span=last, ~2 Ko). L'historique complet
    pèse 4 Mo et déclenche la limitation de débit : on ne le demande pas.

    Le MOUVEMENT vient de notre PROPRE relevé précédent, relu dans signaux.json.
    Zéro appel de plus, et la comparaison est réelle. Au premier passage il n'y a
    pas de tendance — on l'affiche « — » plutôt que d'inventer un zéro."""
    out, semaine = [], None
    for i, ind in enumerate(INDICS):
        if i:
            time.sleep(3)          # on espace : la source limite le débit
        d = http(SENTI + "?" + urllib.parse.urlencode(
            {"indicator": ind["id"], "span": "last", "geo": "RDD"}))
        lignes = [x for x in (d.get("data") or []) if x.get("inc100") is not None]
        if not lignes:
            print("ECHEC %s : aucune ligne" % ind["cat"])
            continue
        sems = sorted(set(x["week"] for x in lignes))
        cur = sems[-1]
        if semaine is None or cur > semaine:
            semaine = cur
        # Le relevé précédent, le nôtre, pour la même catégorie.
        av = None
        for x in (precedent.get("sentinelles") or []):
            if x.get("cat") == ind["cat"] and x.get("semaine") != _sem(cur):
                av = x
                break
        par_prec = {}
        if av:
            for r in (av.get("regions") or []):
                try:
                    par_prec[int(r["reg"])] = r.get("inc")
                except (KeyError, ValueError, TypeError):
                    pass
        regs = []
        for x in lignes:
            if x["week"] != cur:
                continue
            v = x.get("inc100") or 0
            p = par_prec.get(x.get("geo_insee"))
            regs.append({
                "reg": str(x.get("geo_insee")), "n": x.get("geo_name"),
                "inc": int(round(v)),
                "trend": (int(round((v - p) / p * 100)) if p else None),
            })
        regs.sort(key=lambda r: -r["inc"])
        fr = int(round(sum(r["inc"] for r in regs) / len(regs))) if regs else 0
        prevs = [par_prec.get(int(r["reg"])) for r in regs if par_prec.get(int(r["reg"]))]
        frp = (sum(prevs) / len(prevs)) if prevs else 0
        out.append({
            "cat": ind["cat"], "label": ind["label"], "rayons": ind["rayons"],
            "semaine": _sem(cur), "france": fr,
            "trend": (int(round((fr - frp) / frp * 100)) if frp else None),
            "regions": regs,
        })
        print("OK %-10s %s  France %4d %s  tendance %s"
              % (ind["cat"], _sem(cur), fr, UNITE,
                 ("%+d %%" % out[-1]["trend"]) if out[-1]["trend"] is not None else "—"))
    return out, (_sem(semaine) if semaine else None)


def _sem(w):
    """202638 -> « 2026-S38 »."""
    s = str(w)
    return "%s-S%s" % (s[:4], s[4:]) if len(s) == 6 else s


def ecole(n=6):
    """Les prochaines dates scolaires, toutes zones, à partir d'aujourd'hui."""
    auj = datetime.date.today()
    d = http(CAL + "?" + urllib.parse.urlencode({
        "limit": 100, "order_by": "start_date",
        "where": 'start_date >= date"%s"' % auj.isoformat(),
    }))
    vus, out = set(), []
    for r in (d.get("results") or []):
        lib = (r.get("description") or "").strip()
        zone = (r.get("zones") or "").strip()
        deb = (r.get("start_date") or "")[:10]
        if not lib or not deb:
            continue
        cle = lib + "|" + deb
        if cle in vus:
            continue
        vus.add(cle)
        try:
            jour = datetime.date.fromisoformat(deb)
        except ValueError:
            continue
        bas = lib.lower()
        rayons = ""
        for motif, ray in RAYONS_ECOLE:
            if motif in bas:
                rayons = ray
                break
        out.append({"lib": lib, "zone": zone, "debut": deb,
                    "fin": (r.get("end_date") or "")[:10],
                    "jours": (jour - auj).days, "rayons": rayons})
        if len(out) >= n:
            break
    for e in out:
        print("OK école  %-34s %-18s dans %3d j" % (e["lib"][:34], e["zone"][:18], e["jours"]))
    return out


def main():
    # On relit notre propre relevé précédent : c'est lui qui donne la tendance,
    # sans un seul appel de plus à une source qui limite le débit.
    try:
        precedent = json.load(io.open(OUT, encoding="utf-8"))
    except Exception:
        precedent = {}
    senti, semaine = sentinelles(precedent)
    time.sleep(2)
    ec = ecole()
    if not senti and not ec:
        raise SystemExit("ECHEC TOTAL : aucune source collectée, on n'écrit RIEN "
                         "(mieux vaut un fichier vieux qu'un fichier vide)")
    io.open(OUT, "w", encoding="utf-8").write(json.dumps({
        "generated": datetime.date.today().isoformat(),
        "semaine": semaine,
        "unite": UNITE,
        "note": ("Sentinelles mesure une INCIDENCE (%s). Odissé mesure une part des "
                 "PASSAGES aux urgences. Les deux ne se remplacent pas." % UNITE),
        "sources": "Réseau Sentinelles (sentiweb.fr) · Calendrier scolaire (Éducation nationale, Licence Ouverte)",
        "meteo": ("écartée : l'API gratuite d'Open-Meteo est réservée à un usage NON "
                  "commercial, ce que JARVIS n'est pas. Décision à prendre."),
        "sentinelles": senti,
        "ecole": ec,
    }, ensure_ascii=False, separators=(",", ":")))
    relu = json.load(io.open(OUT, encoding="utf-8"))
    print("écrit %s — %d indicateurs, %d dates scolaires, %.1f Ko"
          % (OUT, len(relu["sentinelles"]), len(relu["ecole"]), os.path.getsize(OUT) / 1000.0))


if __name__ == "__main__":
    main()

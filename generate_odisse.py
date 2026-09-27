#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_odisse.py — Veille APPRO : signaux de demande fins (SurSaUD, Santé publique France).

Passages aux urgences + actes SOS Médecins par PATHOLOGIE et par DÉPARTEMENT. Plus fin
que le Réseau Sentinelles (régional, 3 pathologies) : maille département, 11 pathologies.
Permet « la bronchiolite monte dans le 44/49 cette semaine → pré-positionner le rayon
avant la vague ».

⚠️ RÉÉCRIT LE 27/09/2026, LE ROBOT ÉTAIT CASSÉ. Santé publique France a SCINDÉ ses jeux
de données par géographie : `<patho>-passages-…-departement`. Les anciens identifiants
sans suffixe rendent 404. Le robot échouait donc en silence depuis le changement, et
`odisse.json` figeait la dernière collecte réussie sans que rien ne le signale.

⚠️ L'UNITÉ DES TAUX. Les `taux_passages_*` sont « POUR 100 000 PASSAGES » (documenté par
la source, champ `description`), PAS pour 100 000 habitants. Un taux de 16 667 veut dire
16,7 % des passages aux urgences, pas un département décimé. Lu brut, ce nombre est
ingérable et sera mal interprété : on écrit donc AUSSI le pourcentage, et l'unité voyage
avec la donnée pour qu'aucun écran ne puisse l'oublier.

⚠️ « Gestes auto-infligés » est disponible au même endroit et volontairement EXCLU :
en faire un signal de vente serait indécent.

Source : datasantepubliquefrance.opendatasoft.com (ODS v2.1, gratuit, sans clé).
Écrit crm/v2/odisse.json. Python 3.9, urllib seul.
"""
import io
import os
import json
import datetime
import urllib.parse
import urllib.request

BASE = "https://datasantepubliquefrance.opendatasoft.com/api/explore/v2.1/catalog/datasets/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "odisse.json")

# `age` = la classe d'âge qui porte le signal utile pour le comptoir. « Tous âges »
# par défaut ; les pathologies d'enfants se lisent sur leur tranche, sinon le signal
# se dilue dans une population qui n'est pas concernée.
PATHOS = [
    {"ds": "bronchiolite-passages-aux-urgences-et-actes-sos-medecins-departement",
     "label": "Bronchiolite", "cat": "bronchiolite", "age": "0 an",
     "rayons": "Pédiatrie, sérum physiologique, mouche-bébé"},
    {"ds": "grippe-passages-aux-urgences-et-actes-sos-medecins-departement",
     "label": "Grippe", "cat": "grippe", "age": "Tous âges",
     "rayons": "ORL, antipyrétiques, tests"},
    {"ds": "infections-respiratoires-aigues-ira-passages-aux-urgences-et-actes-sos-medecins-departement",
     "label": "Infections respiratoires", "cat": "ira", "age": "Tous âges",
     "rayons": "ORL, rhume, gorge"},
    {"ds": "gastro-enterite-aigue-passages-aux-urgences-et-actes-sos-medecins-departement",
     "label": "Gastro-entérite", "cat": "gastro", "age": "Tous âges",
     "rayons": "Antidiarrhéiques, réhydratation, probiotiques"},
    {"ds": "allergie-passages-aux-urgences-et-actes-sos-medecins-dep",
     "label": "Allergie", "cat": "allergie", "age": "Tous âges",
     "rayons": "Antihistaminiques, sérum physiologique, yeux"},
    {"ds": "asthme-passages-aux-urgences-et-actes-sos-medecins-dep",
     "label": "Asthme", "cat": "asthme", "age": "Tous âges",
     "rayons": "Respiratoire, chambres d'inhalation"},
    {"ds": "bronchite-passages-aux-urgences-et-actes-sos-medecins-departement",
     "label": "Bronchite", "cat": "bronchite", "age": "Tous âges",
     "rayons": "Toux, respiratoire"},
    {"ds": "pneumopathie-passages-aux-urgences-et-actes-sos-medecins-departement",
     "label": "Pneumopathie", "cat": "pneumopathie", "age": "Tous âges",
     "rayons": "Respiratoire"},
    {"ds": "pathologies-orl-passages-aux-urgences-et-actes-sos-medecins-departement",
     "label": "Pathologies ORL", "cat": "orl", "age": "Tous âges",
     "rayons": "ORL, gorge, oreilles"},
    {"ds": "covid-19-passages-aux-urgences-et-actes-sos-medecins-departement",
     "label": "COVID-19", "cat": "covid", "age": "Tous âges",
     "rayons": "Tests, masques, ORL"},
    {"ds": "traumatisme-passages-aux-urgences-et-actes-sos-medecins-departement",
     "label": "Traumatismes", "cat": "traumatisme", "age": "Tous âges",
     "rayons": "Premiers soins, pansements, contention"},
]
UNITE = "pour 100 000 passages aux urgences"


def fetch(dataset, params):
    url = BASE + dataset + "/records?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip
            raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8", "ignore"))


def taux_field(rec):
    for k in rec:
        if k.startswith("taux_passages_"):
            return k
    return None


def semaine_precedente(sem):
    """« 2026-S38 » -> « 2026-S37 ». Sur la S01 on ne devine pas l'année précédente :
    on rend None plutôt qu'un numéro inventé."""
    try:
        an, s = sem.split("-S")
        n = int(s)
        return "%s-S%02d" % (an, n - 1) if n > 1 else None
    except Exception:
        return None


def main():
    out = []
    semaine = None
    rates = []
    for p in PATHOS:
        # Dernière semaine disponible pour CETTE pathologie (elles ne sont pas
        # toujours publiées le même jour).
        try:
            der = fetch(p["ds"], [("limit", "1"), ("order_by", "semaine desc"),
                                  ("where", "sursaud_cl_age_gene=\"%s\"" % p["age"])])
        except Exception as e:
            print("ECHEC %s : %s" % (p["cat"], str(e)[:120]))
            rates.append(p["cat"])
            continue
        res = der.get("results") or []
        if not res:
            print("ECHEC %s : aucune ligne (classe d'âge « %s » absente ?)" % (p["cat"], p["age"]))
            rates.append(p["cat"])
            continue
        sem = res[0].get("semaine")
        tf = taux_field(res[0])
        if not tf:
            print("ECHEC %s : aucun champ taux_passages_*" % p["cat"])
            rates.append(p["cat"])
            continue
        if semaine is None or (sem or "") > semaine:
            semaine = sem

        def deps_de(s):
            d = fetch(p["ds"], [("limit", "100"), ("order_by", tf + " desc"),
                                ("where", "semaine=\"%s\" and sursaud_cl_age_gene=\"%s\"" % (s, p["age"]))])
            return [x for x in (d.get("results") or []) if x.get(tf) is not None]

        cour = deps_de(sem)
        prec_sem = semaine_precedente(sem)
        prec = deps_de(prec_sem) if prec_sem else []

        def moyenne(l):
            v = [x.get(tf) or 0 for x in l]
            return (sum(v) / len(v)) if v else 0.0

        m_cour, m_prec = moyenne(cour), moyenne(prec)
        trend = int(round((m_cour - m_prec) / m_prec * 100)) if m_prec > 0 else None

        hot = []
        for x in cour[:8]:
            t = x.get(tf) or 0
            hot.append({
                "dep": x.get("dep"), "n": x.get("libgeo"),
                "taux": round(t, 1),
                # Le pourcentage est ce qu'un humain lit sans se tromper d'unité.
                "pct": round(t / 1000.0, 1),
            })
        out.append({
            "cat": p["cat"], "label": p["label"], "age": p["age"], "rayons": p["rayons"],
            "semaine": sem, "moyenne": round(m_cour, 1), "moyennePct": round(m_cour / 1000.0, 1),
            "prec": round(m_prec, 1) if m_prec else None, "trend": trend,
            "hotDeps": hot,
        })
        print("OK %-14s %s  moyenne %.1f (%.1f %%)  tendance %s" %
              (p["cat"], sem, m_cour, m_cour / 1000.0, ("%+d %%" % trend) if trend is not None else "—"))

    if not out:
        raise SystemExit("ECHEC TOTAL : aucune pathologie collectée, on n'écrit RIEN "
                         "(mieux vaut un fichier vieux qu'un fichier vide)")
    if rates:
        print("⚠️ pathologies manquées : %s" % ", ".join(rates))

    io.open(OUT, "w", encoding="utf-8").write(json.dumps({
        "generated": datetime.date.today().isoformat(),
        "source": "SurSaUD — Santé publique France (passages aux urgences et actes SOS Médecins)",
        "week": semaine,
        "unite": UNITE,
        "note": ("Les taux sont %s, PAS pour 100 000 habitants : un taux de 16 667 = 16,7 %% "
                 "des passages. Le champ `pct` donne directement ce pourcentage." % UNITE),
        "manquantes": rates,
        "pathologies": out,
    }, ensure_ascii=False, separators=(",", ":")))
    # Un générateur qui écrit relit ce qu'il a écrit avant de dire que c'est fait.
    relu = json.load(io.open(OUT, encoding="utf-8"))
    print("écrit %s — %d pathologies, semaine %s, %.1f Ko"
          % (OUT, len(relu["pathologies"]), relu["week"], os.path.getsize(OUT) / 1000.0))


if __name__ == "__main__":
    main()

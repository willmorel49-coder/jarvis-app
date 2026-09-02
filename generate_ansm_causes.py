#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_ansm_causes.py — POURQUOI les médicaments tombent en rupture.

L'app savait QUELS produits sont en tension (generate_ansm_dispo.py, quotidien).
Elle ne savait pas POURQUOI. Ce robot comble ce trou avec la seule source qui
publie les causes : l'API GraphQL de data.ansm.sante.fr — non documentée, mais
dont les requêtes sont dans le dépôt OFFICIEL de l'ANSM
(github.com/dataoffice-ansm/datamed, src/graphql/queries.graphql).

⚠️ Le chiffre qui justifie ce robot : en 2024, **28 % des ruptures françaises ont pour
cause « Augmentation du volume de vente »** (1 150 cas sur 3 809). Un quart des ruptures
vient donc d'une demande qui monte — exactement ce que la prévision de « La courbe »
sait voir venir. C'est le pont entre prévoir et sécuriser.

⚠️ Licence : le portail place l'usage commercial sous autorisation. Arbitrage de Will,
le 02/09/2026, mot pour mot : « branche toi sur l'ansm cest pas commercial cest pour le
bien des patients ». L'usage est interne (aide à l'approvisionnement, continuité des
traitements), les données sont agrégées et publiques, et l'ANSM est citée à l'écran.

Écrit crm/v2/ansm-causes.json. Aucune dépendance : urllib seul.
"""
import io, os, json, ssl, datetime, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(HERE, "crm", "v2", "ansm-causes.json")
API = "https://data.ansm.sante.fr/api/graphql"

# Requête reprise TELLE QUELLE du dépôt officiel de l'ANSM (queries.graphql, query
# GlobalRuptures). Ne pas l'inventer : le schéma refuse tout champ deviné — 27 noms
# essayés à l'aveugle ont tous été rejetés avant qu'on trouve le fichier source.
REQUETE = """
query GlobalRuptures {
    getGlobalShortages {
        period { minYear maxYear }
        shortagesPerYear {
            year reportsCount casesWithMeasuresCount
            casesWithMeasuresCountPercent measuresCount
        }
        shortagesClassesPerYear { year value valuePercentClosed classification }
        shortagesCausesPerYear { year valuePercent value type definition }
        shortagesAtcPerYear { year reportsCount medicsCount code label }
        shortagesMeasuresPerYear { year value valuePercent type definition }
    }
}
"""

def interroge():
    corps = json.dumps({"query": REQUETE}).encode("utf-8")
    req = urllib.request.Request(
        API, data=corps, method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0",
                 "Accept": "application/json"})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=90, context=ctx) as r:
            d = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        # ⚠️ On ne réécrit JAMAIS le fichier à la baisse sur une panne réseau : mieux vaut
        # garder les causes d'hier que publier un fichier vide. Même règle que l'archive ANSM.
        print("échec de l'appel :", str(e)[:120])
        return None
    if "errors" in d:
        print("l'API refuse la requête :", str(d["errors"])[:200])
        return None
    return (d.get("data") or {}).get("getGlobalShortages")


def main():
    g = interroge()
    if not g:
        if os.path.exists(SORTIE):
            print("fichier existant conservé (aucune écriture à la baisse)")
            return 0
        print("aucune donnée et aucun fichier existant — rien à écrire")
        return 1

    annees = sorted({x["year"] for x in (g.get("shortagesCausesPerYear") or [])})
    # ⚠️ Une année incomplète passe pour un EFFONDREMENT des ruptures. Mesuré le
    # 02/09/2026 : les causes remontaient déjà 2025 (~1 400 cas) alors que le décompte
    # officiel des signalements s'arrêtait à 2024 (3 809 cas) — 2025 aurait été lue
    # comme « les ruptures ont chuté de 63 % ». Même piège que le mois d'export troué.
    # Le critère est celui de l'ANSM elle-même : une année n'est COMPLÈTE que si elle
    # figure dans `shortagesPerYear`, le décompte de référence.
    completes = sorted({x["year"] for x in (g.get("shortagesPerYear") or []) if x.get("reportsCount")})
    derniere = max(completes) if completes else (max(annees) if annees else None)
    partielles = [a for a in annees if a not in completes]
    encours = datetime.date.today().year

    causes = {}
    for x in (g.get("shortagesCausesPerYear") or []):
        causes.setdefault(str(x["year"]), []).append(
            {"c": x.get("type"), "n": x.get("value"), "p": x.get("valuePercent"),
             "d": x.get("definition")})
    for a in causes:
        causes[a].sort(key=lambda y: -(y["n"] or 0))

    mesures = {}
    for x in (g.get("shortagesMeasuresPerYear") or []):
        mesures.setdefault(str(x["year"]), []).append(
            {"t": x.get("type"), "n": x.get("value"), "p": x.get("valuePercent"),
             "d": x.get("definition")})
    for a in mesures:
        mesures[a].sort(key=lambda y: -(y["n"] or 0))

    classes = {}
    for x in (g.get("shortagesClassesPerYear") or []):
        classes.setdefault(str(x["year"]), {})[x.get("classification")] = x.get("value")

    atc = {}
    for x in (g.get("shortagesAtcPerYear") or []):
        atc.setdefault(str(x["year"]), []).append(
            {"code": x.get("code"), "l": x.get("label"),
             "n": x.get("reportsCount"), "refs": x.get("medicsCount")})
    for a in atc:
        atc[a].sort(key=lambda y: -(y["n"] or 0))

    out = {
        "generated": str(datetime.date.today()),
        "source": "ANSM — data.ansm.sante.fr (API publique du portail Datamed)",
        "annees": annees,
        "derniere_annee": derniere,
        "derniere_complete": derniere,
        "annees_partielles": partielles,
        "parAn": [{"a": x["year"], "n": x.get("reportsCount"),
                   "avecMesures": x.get("casesWithMeasuresCount"),
                   "pctMesures": x.get("casesWithMeasuresCountPercent")}
                  for x in sorted(g.get("shortagesPerYear") or [],
                                  key=lambda y: -y["year"])],
        "causes": causes,
        "mesures": mesures,
        "classes": classes,
        "atc": atc,
    }
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    with io.open(SORTIE, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"écrit : {SORTIE} ({os.path.getsize(SORTIE)/1024:.0f} Ko)")
    print(f"années couvertes : {annees[0]} → {annees[-1]} · dernière COMPLÈTE : {derniere}"
          + (f" · ⚠️ partielles, écartées de l'affichage : {partielles}" if partielles else ""))
    if atc:
        ra = str(derniere)
        print(f"classes therapeutiques les plus touchees en {ra} :")
        for a in atc.get(ra, [])[:4]:
            print(f"   {a['n']:5d} signalements · {a['refs']} references · {a['code']} {str(a['l'])[:42]}")
    ref = str(derniere)
    top = causes.get(ref, [])[:4]
    print(f"causes {ref} :")
    for c in top:
        print(f"   {c['p']:3.0f} %  ({c['n']} cas)  {c['c']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

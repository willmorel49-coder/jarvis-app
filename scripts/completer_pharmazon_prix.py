#!/usr/bin/env python3
"""Complète le tarif Pharmazon (fichier PROTÉGÉ pharmazon-prix.js) avec le catalogue du 14/05/2026.

Règle (29/10/2026) : on AJOUTE seulement les EAN absents du fichier en place — un prix déjà
présent (relevé du 03/09, plus récent) n'est JAMAIS écrasé. On ne garde que les EAN du
catalogue Offilog (seuls lus par l'écran). Les EAN ajoutés qui n'ont pas de fiche dans
l'identité publique crm/v2/pharmazon-data.js (nom, laboratoire, EAN : aucun prix) y sont
ajoutés aussi, sinon l'écran ne les rattache à rien.

  python3 scripts/completer_pharmazon_prix.py <pharmazon-prix.AVANT.js> <catalogue-pharmazon.csv> <pharmazon-prix.APRES.js>

Le tarif (conditions d'un TIERS, règle §8) n'est écrit QUE dans le chemin de sortie donné,
hors dépôt ; il se dépose ensuite sur Supabase (skill donnees-protegees-jarvis).
"""
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATE_CSV = "2026-05-14"


def ean13(v):
    s = re.sub(r"\D", "", str(v or ""))
    if len(s) == 12:
        s = "0" + s
    return s if len(s) == 13 else ""


def offilog_eans():
    out = set()
    for f, rx in (("crm/v2/offilog-bestsellers-data.js", r'"ean":\s*"(\d{12,13})"'),
                  ("opso/offilog-live-data.js", r"ean:'(\d{12,13})'")):
        out |= {ean13(m) for m in re.findall(rx, open(os.path.join(ROOT, f), encoding="utf8").read())}
    out.discard("")
    return out


def num(x):
    try:
        return float(str(x).replace(",", "."))
    except ValueError:
        return None


def main():
    avant, csvf, apres = sys.argv[1:4]
    t = open(avant, encoding="utf8").read()
    prix = json.loads(re.search(r"PHARMAZON_PRIX = (\{.*\});", t, re.S).group(1))
    n_avant = len(prix)
    cible = offilog_eans()
    ajouts, identites = {}, {}
    stats = {"lignes": 0, "ean_illisible": 0, "deja_present": 0, "hors_offilog": 0, "sans_prix": 0}
    for r in csv.DictReader(open(csvf, encoding="utf-8-sig"), delimiter=";"):
        stats["lignes"] += 1
        e = ean13(r["EAN"])
        if not e:
            stats["ean_illisible"] += 1
        elif e in prix:
            stats["deja_present"] += 1  # jamais écrasé
        elif e not in cible:
            stats["hors_offilog"] += 1
        else:
            remise, tarif = num(r["Remise client"]), num(r["Prix"])
            net = num(r["Prix remisé"])
            if not (net and net > 0):
                stats["sans_prix"] += 1
                continue
            v = [round(net, 2), round(tarif, 2) if tarif else 0, remise or 0]
            if e not in ajouts or v[0] < ajouts[e][0]:
                ajouts[e] = v
                identites[e] = {"name": r["Nom"].strip(), "labo": r["Laboratoire"].strip()}
    for e, v in ajouts.items():
        assert e not in prix
        prix[e] = v
    assert all(prix[e] == json.loads(re.search(r"PHARMAZON_PRIX = (\{.*\});", t, re.S).group(1))[e] for e in list(prix)[:n_avant])
    entete = ("// Pharmazon — PRIX NÉGOCIÉS (tiers) — 2026-09-03, complété le 29/10/2026 par le catalogue du %s\n"
              "// %d EAN (%d du relevé du 03/09 + %d ajoutés depuis le catalogue du %s, seulement les EAN absents) · ean -> [prix_final, prix_catalogue, remise]\n"
              "// ⚠️ NE JAMAIS COMMITER. Servi par adresse signée (Supabase).\n"
              % (DATE_CSV, len(prix), n_avant, len(ajouts), DATE_CSV))
    open(apres, "w", encoding="utf8").write(entete + "const PHARMAZON_PRIX = " + json.dumps(prix) + ";\n")
    # identité publique : seulement les EAN ajoutés qui n'ont pas de fiche
    chemin = os.path.join(ROOT, "crm/v2/pharmazon-data.js")
    src = open(chemin, encoding="utf8").read()
    m = re.search(r"const PHARMAZON = (\[.*\]);\n", src, re.S)
    cat = json.loads(m.group(1))
    connus = {ean13(o.get("ean")) for o in cat}
    nouveaux = 0
    for e, idt in identites.items():
        if e not in connus:
            cat.append({"sku": e, "id": None, "name": idt["name"], "img": "", "labo": idt["labo"], "ean": e})
            nouveaux += 1
    tete = src[:m.start()]
    tete = re.sub(r"// \d+ produits", "// %d produits" % len(cat), tete, count=1)
    reste = src[m.end():]
    open(chemin, "w", encoding="utf8").write(tete + "const PHARMAZON = " + json.dumps(cat, ensure_ascii=False) + ";\n" + reste)
    assert "prix_final" not in open(chemin, encoding="utf8").read(), "prix dans le fichier public"
    print("AVANT", n_avant, "APRES", len(prix), "ajoutés", len(ajouts), "fiches d'identité ajoutées", nouveaux, stats)


main()

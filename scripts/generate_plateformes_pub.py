#!/usr/bin/env python3
"""Génère les trois fichiers de prix PUBLICS (TTC) ajoutés à l'écran Offilog le 29/10/2026 :
  crm/v2/farmaline-pub-data.js   {ean13: prix}   + FARMALINE_PUB_MAJ
  crm/v2/maxipara-pub-data.js    {ean13: prix}   + MAXIPARA_PUB_MAJ
  crm/v2/cap3000-pub-data.js     {ean13: prix}   + CAP3000_PUB_MAJ

Même forme que crm/v2/drakkars-pub-data.js (ean -> prix TTC affiché sur le site).
Filtré aux EAN du catalogue Offilog (comme generate_drakkars_pub.js).

  python3 scripts/generate_plateformes_pub.py farmaline <concurrents-farmaline-data.js>
  python3 scripts/generate_plateformes_pub.py maxipara  <offilog_x_maxipara_3517.xlsx> <AAAA-MM-JJ>
  python3 scripts/generate_plateformes_pub.py cap3000   <releve.jsonl> <AAAA-MM-JJ>
  python3 scripts/generate_plateformes_pub.py cap3000-archive crm/cap3000-data.js 2026-06-05   (repli)

⚠️ MAXI PARA : le classeur contient AUSSI nos conditions (Prix_Achat_Offilog, Ecart_Prix,
Marge_%). Seules les colonnes EAN et Prix_Public sont lues, par leur nom d'en-tête ; le
fichier généré est relu en fin de script et refuse de se terminer s'il porte autre chose
qu'un EAN et un prix.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ean13(v):
    s = re.sub(r"\D", "", str(v if v is not None else ""))
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


def lire_farmaline(chemin):
    src = open(chemin, encoding="utf8").read()
    j = json.loads(src[src.index("{"):src.rindex("}") + 1])
    c = {n: i for i, n in enumerate(j["cols"])}
    stats = {"lignes": len(j["rows"]), "epuises": 0, "sans_prix": 0}
    paires = []
    for r in j["rows"]:
        if str(r[c["stock"]]).strip().lower() == "épuisé":
            stats["epuises"] += 1  # non achetable : même logique que les fiches Leclerc sans vendeur (01/10)
            continue
        if str(r[c["vendeur"]]).strip() != "Farmaline":
            stats["vendeur_tiers"] = stats.get("vendeur_tiers", 0) + 1  # place de marché : ce n'est pas le prix de Farmaline
            continue
        p = r[c["prix"]]
        if not (isinstance(p, (int, float)) and p > 0):
            stats["sans_prix"] += 1
            continue
        paires.append((r[c["ean13"]], round(float(p), 2)))
    return paires, j["maj"], stats


def lire_maxipara(chemin):
    import openpyxl
    ws = openpyxl.load_workbook(chemin, read_only=True, data_only=True)["Croisement Complet"]
    it = ws.iter_rows(values_only=True)
    ent = list(next(it))
    iE, iP = ent.index("EAN"), ent.index("Prix_Public")  # les SEULES colonnes lues
    paires, n = [], 0
    for r in it:
        n += 1
        p = r[iP]
        if isinstance(p, (int, float)) and p > 0:
            paires.append((r[iE], round(float(p), 2)))
    return paires, {"lignes": n}


def lire_cap3000(chemin):
    paires, st = [], {"lignes": 0, "http_non200": 0, "sans_prix": 0, "indisponibles": 0}
    for l in open(chemin, encoding="utf8"):
        if not l.strip():
            continue
        r = json.loads(l)
        st["lignes"] += 1
        if r["http"] != 200:
            st["http_non200"] += 1
            continue
        if not (r["prix"] and r["prix"] > 0):
            st["sans_prix"] += 1
            continue
        if r["dispo"] and r["dispo"] != "InStock":
            st["indisponibles"] += 1  # non achetable : écarté, comme Farmaline « épuisé »
            continue
        paires.append((r["ean"], r["prix"]))
    return paires, st


def lire_cap3000_archive(chemin):
    """Repli (29/10/2026) : le relevé frais a été bloqué (HTTP 403) après 164 fiches ; on garde les prix
    du 05/06/2026 de crm/cap3000-data.js, avec leur date. Aucun contournement du blocage."""
    t = open(chemin, encoding="utf8").read()
    paires = [(m.group(1), float(m.group(2))) for m in re.finditer(r'ean:"(\d+)"[^}]*?prix:([\d.]+)', t)]
    return paires, {"lignes": len(paires), "source": "relevé du 05/06/2026 (repli, relevé frais bloqué)"}


def main():
    quoi = sys.argv[1]
    cible = offilog_eans()
    if quoi == "farmaline":
        paires, maj, st = lire_farmaline(sys.argv[2])
        nom, label, site, srcl = "FARMALINE", "Farmaline (pharmacie en ligne belge, TVA belge)", "farmaline", "concurrents-farmaline-data.js (hors dépôt)"
    elif quoi == "maxipara":
        maj = sys.argv[3]
        paires, st = lire_maxipara(sys.argv[2])
        nom, label, site, srcl = "MAXIPARA", "Maxi Parapharmacie", "maxipara", "classeur Offilog x Maxipara, colonne Prix_Public seule"
    elif quoi == "cap3000":
        maj = sys.argv[3]
        paires, st = lire_cap3000(sys.argv[2])
        nom, label, site, srcl = "CAP3000", "Pharmacie Cap 3000", "cap3000", "scraper_cap3000_pub.py, fiches produit"
    elif quoi == "cap3000-archive":
        maj = sys.argv[3]
        paires, st = lire_cap3000_archive(sys.argv[2])
        nom, label, site, srcl = "CAP3000", "Pharmacie Cap 3000", "cap3000", "crm/cap3000-data.js"
    else:
        sys.exit("source inconnue")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", maj):
        sys.exit("date du relevé illisible : " + maj)
    out, bad, dup, hors = {}, 0, 0, 0
    for e, p in paires:
        e = ean13(e)
        if not e:
            bad += 1
        elif e not in cible:
            hors += 1
        elif e in out:
            dup += 1
            out[e] = min(out[e], p)  # plusieurs lignes pour un EAN : le prix le plus bas affiché
        else:
            out[e] = p
    chemin = os.path.join(ROOT, "crm/v2/%s-pub-data.js" % site)
    avant = len(re.findall(r'"\d{13}":', open(chemin, encoding="utf8").read())) if os.path.exists(chemin) else 0
    if avant and len(out) < avant * 0.7:
        sys.exit("ARRÊT : %d prix contre %d avant" % (len(out), avant))
    entete = ("// Prix PUBLICS (TTC) %s — pour l'écran Offilog (CRM et OPSO).\n"
              "// Relevé du %s (%s) · généré par scripts/generate_plateformes_pub.py\n"
              "// %d EAN du catalogue Offilog — %s ; %d EAN illisibles, %d doublons, %d hors catalogues Offilog.\n"
              "// Prix PUBLICS d'un site de vente : autorisés dans le dépôt public. Aucune condition commerciale ici.\n"
              % (label, maj, srcl, len(out), json.dumps(st, ensure_ascii=False), bad, dup, hors))
    corps = "const %s_PUB = %s;\nconst %s_PUB_MAJ = %s;\n" % (nom, json.dumps(out, separators=(",", ":")), nom, json.dumps(maj))
    open(chemin, "w", encoding="utf8").write(entete + corps)
    # Relecture : rien d'autre que « ean -> prix ».
    rel = open(chemin, encoding="utf8").read()
    m = re.search(r"const %s_PUB = (\{.*?\});\n" % nom, rel)
    d = json.loads(m.group(1))
    assert len(d) == len(out) and all(re.fullmatch(r"\d{13}", k) and isinstance(v, float) or isinstance(v, int) for k, v in d.items())
    for mot in ("Prix_Achat", "Ecart", "Marge", "Potentiel", "marge_pct", "prix_offilog"):
        assert mot not in rel, "colonne interdite dans le fichier : " + mot
    print("OK", chemin, len(out), "EAN", st, "mauvais", bad, "doublons", dup, "hors Offilog", hors)


main()

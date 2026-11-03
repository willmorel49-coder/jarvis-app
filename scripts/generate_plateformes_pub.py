#!/usr/bin/env python3
"""Génère les trois fichiers de prix PUBLICS (TTC) ajoutés à l'écran Offilog le 29/10/2026 :
  crm/v2/farmaline-pub-data.js   {ean13: prix}   + FARMALINE_PUB_MAJ
  crm/v2/maxipara-pub-data.js    {ean13: prix}   + MAXIPARA_PUB_MAJ
  crm/v2/cap3000-pub-data.js     {ean13: prix}   + CAP3000_PUB_MAJ
  crm/v2/citypharma-pub-data.js  {ean13: prix}   + CITYPHARMA_PUB_MAJ   (ajouté le 30/10/2026)

Même forme que crm/v2/drakkars-pub-data.js (ean -> prix TTC affiché sur le site).
Filtré aux EAN du catalogue Offilog (comme generate_drakkars_pub.js).

  python3 scripts/generate_plateformes_pub.py farmaline <concurrents-farmaline-data.js>
  python3 scripts/generate_plateformes_pub.py maxipara  <offilog_x_maxipara_3517.xlsx> <AAAA-MM-JJ>
  python3 scripts/generate_plateformes_pub.py cap3000   <releve.jsonl> <AAAA-MM-JJ>
  python3 scripts/generate_plateformes_pub.py citypharma <releve.jsonl> <AAAA-MM-JJ>
  python3 scripts/generate_plateformes_pub.py cap3000-archive crm/cap3000-data.js 2026-06-05   (repli)

⚠️ MAXI PARA : le classeur contient AUSSI nos conditions (Prix_Achat_Offilog, Ecart_Prix,
Marge_%). Seules les colonnes EAN et Prix_Public sont lues, par leur nom d'en-tête ; le
fichier généré est relu en fin de script et refuse de se terminer s'il porte autre chose
qu'un EAN et un prix.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 03/11/2026 : sous ces codes, Citypharma vend un AUTRE article que le produit Offilog (lot, contenance ou
# coffret différents) : l'écart de prix serait faux. Contrôle de tous les codes du relevé du 30/10, tri relu
# à la main. Les cas incertains (contenance absente d'un côté) sont gardés.
CITYPHARMA_ECARTES = frozenset((
    "0000030065949", "3264680045295", "3264680046322", "3264680046797", "3282770398670", "3282770399172", "3282770399929",
    "3282770401172", "3282770401790", "3282770401806", "3282771000428", "3282771000817", "3323034408800", "3337875920728",
    "3337875926836", "3337875940139", "3401060051624", "3401560315363", "3401599424715", "3428881124900", "3428881135401",
    "3461020003636", "3515450121320", "3515836528194", "3525722066587", "3578835501773", "3578835502053", "3578835502480",
    "3578835503975", "3578835504279", "3578835505375", "3595894546330", "3596200056192", "3596200069352", "3596490006815",
    "3614274826456", "3614790000002", "3614790000347", "3614790000743", "3614810010530", "3660398505081", "3664524001881",
    "3664524001904", "3664524002000", "3665606002741", "3667235000525", "3667235000686", "3700221303757", "3700221303764",
    "3700221303771", "3700399102855", "3700399103050", "3700399103128", "3700591910043", "3700591912276", "3700640502038",
    "3700695221274", "3700928802478", "3701129817957", "3701132602052", "3701145600793", "3701145601585", "3701145601882",
    "3701154700798", "3701399700140", "3701436915766", "3701436917548", "3701436930530", "3701436930790", "3701436932909",
    "3701436938727", "3760095251899", "3760095254654", "3760135013364", "3760155210484", "3760155211740", "3760155218022",
    "3760155218442", "3760155219005", "3760155219036", "3760155219739", "3760155220469", "3760283641839", "3760283642119",
    "3770008103320", "3770008103795", "3770016038188", "3770035034062", "4001638095587", "4001638590815", "4001638590839",
    "4005800270468", "4005800271755", "4005800375958", "4006000192963", "4046719318223", "5054563256058", "5054563256478",
    "5410765005533", "5420008561641", "5420008562068", "5430000427043", "5430000427319", "5430000427326", "7640178214484",
    "8700216470100", "8700216930666", "8718951775077",
))


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


def lire_citypharma(chemin):
    """Relevé de scraper_citypharma_pub.py : une ligne par produit et par rayon. Un produit présent dans
    plusieurs rayons (même id_product) ne compte qu'une fois ; les produits non achetables sont écartés,
    comme Farmaline « épuisé »."""
    paires, st, vus = [], {"lignes": 0, "doublons_rayons": 0, "non_achetables": 0, "sans_prix": 0}, set()
    for l in open(chemin, encoding="utf8"):
        if not l.strip():
            continue
        r = json.loads(l)
        st["lignes"] += 1
        if r["id"] in vus:
            st["doublons_rayons"] += 1
            continue
        vus.add(r["id"])
        if not r.get("achetable"):
            st["non_achetables"] += 1
            continue
        if not (isinstance(r.get("prix"), (int, float)) and r["prix"] > 0):
            st["sans_prix"] += 1
            continue
        paires.append((r["ean"], round(float(r["prix"]), 2)))
    st["produits"] = len(vus)
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
    ecartes = CITYPHARMA_ECARTES if quoi == "citypharma" else frozenset()
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
    elif quoi == "citypharma":
        maj = sys.argv[3]
        paires, st = lire_citypharma(sys.argv[2])
        nom, label, site, srcl = "CITYPHARMA", "Citypharma (boutique en ligne)", "citypharma", "scraper_citypharma_pub.py, listes de produits du site"
    elif quoi == "cap3000-archive":
        maj = sys.argv[3]
        paires, st = lire_cap3000_archive(sys.argv[2])
        nom, label, site, srcl = "CAP3000", "Pharmacie Cap 3000", "cap3000", "crm/cap3000-data.js"
    else:
        sys.exit("source inconnue")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", maj):
        sys.exit("date du relevé illisible : " + maj)
    out, bad, dup, hors, retires = {}, 0, 0, 0, set()
    for e, p in paires:
        e = ean13(e)
        if not e:
            bad += 1
        elif e not in cible:
            hors += 1
        elif e in ecartes:
            retires.add(e)
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
              % (label, maj, srcl, len(out), json.dumps(st, ensure_ascii=False), bad, dup, hors))
    if retires:
        entete += ("// %d EAN écartés : le site vend un autre article sous le même code (lot, contenance ou coffret), "
                   "liste CITYPHARMA_ECARTES du générateur.\n" % len(retires))
    entete += "// Prix PUBLICS d'un site de vente : autorisés dans le dépôt public. Aucune condition commerciale ici.\n"
    corps = "const %s_PUB = %s;\nconst %s_PUB_MAJ = %s;\n" % (nom, json.dumps(out, separators=(",", ":")), nom, json.dumps(maj))
    open(chemin, "w", encoding="utf8").write(entete + corps)
    # Relecture : rien d'autre que « ean -> prix ».
    rel = open(chemin, encoding="utf8").read()
    m = re.search(r"const %s_PUB = (\{.*?\});\n" % nom, rel)
    d = json.loads(m.group(1))
    assert len(d) == len(out) and all(re.fullmatch(r"\d{13}", k) and isinstance(v, float) or isinstance(v, int) for k, v in d.items())
    for mot in ("Prix_Achat", "Ecart", "Marge", "Potentiel", "marge_pct", "prix_offilog"):
        assert mot not in rel, "colonne interdite dans le fichier : " + mot
    print("OK", chemin, len(out), "EAN", st, "mauvais", bad, "doublons", dup, "hors Offilog", hors, "écartés", len(retires))


main()

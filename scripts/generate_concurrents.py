#!/usr/bin/env python3
"""Ressources concurrents (catalogues COMPLETS Sagitta + OCP) -> crm/v2/concurrents-*-data.js

Écran « Ressources concurrents » du CRM JARVIS (v2-concurrents.js). À la
différence de sagitta-prix.js / ocp-prix.js (prix seuls, pour le face-à-face),
ces fichiers portent le catalogue ENTIER : libellé, laboratoire, gamme, tous
les paliers OCP, la Marque Conseil OCP.

Découpé par source (règle de poids, > 500 Ko sinon) :
  crm/v2/concurrents-sagitta-data.js  window.CONCURRENTS_SAGITTA
  crm/v2/concurrents-ocp-data.js      window.CONCURRENTS_OCP
  crm/v2/concurrents-etudes-data.js   window.CONCURRENTS_ETUDES  (11/09/2026)
  crm/v2/concurrents-cooper-data.js   window.CONCURRENTS_COOPER  (11/09/2026)
  crm/v2/concurrents-farmaline-data.js window.CONCURRENTS_FARMALINE (12/09/2026)

Farmaline : pharmacie en ligne belge (groupe Redcare / Shop Apotheke). Prix PUBLICS
consommateur, pas des conditions d'achat : aucun verdict face à notre net. Collecte
`recoltes/08-farmaline/collecte-algolia.py` (index de recherche public du site,
148 361 produits, 93 640 EAN). On ne garde dans l'app que ce qui nous parle :
EAN connus de JARVIS (ventes, Offilog, Sagitta, OCP, Pharmazon) ou codes français
(préfixe 34). Le reste vit dans algolia-hits.jsonl sur le Mac.

Cooper : catalogue PRÉPARATOIRE 2023 (PDF public sur cooper.fr, CGV au
01/01/2023, dernière version en ligne au 10/09/2026). `pdftotext -layout`
→ texte, une ligne par déclinaison : code CPF, EAN 13, drapeau CMR (Â),
désignation (vide = même produit, autre conditionnement ; en minuscules =
origine ou composition, gardée en « détail »), division ou lot, statut
(A/C/E/CA/SA/T, composables), prix unitaire HT. Famille = titre de la page,
rayon = sous-titre au-dessus de l'en-tête de colonnes.

Études : `~/recherche-grossistes-2026-09/dataset.csv` (recherche de sept. 2026,
828 avantages commerciaux observés dans des sources publiques : décisions,
rapports, thèses, factures, CGV…). Décision Will 11/09/2026 : le dataset seul,
`supra-legaux.csv` reste sur le Mac. `NULL` → vide ; colonnes pharmacie et
bénéficiaire non reprises (pseudonymes de forum, sans intérêt pour l'écran).

Sagitta : les 3 exports CSV `;` (général / grossiste / para-OTC) sont fusionnés
par CIP13 (EAN13 sinon) : le général donne le socle, les deux détaillés
apportent Laboratoire / Gamme / TVA / QteMin et la famille de catalogue.
net = Prix A HT × (1 − Remise1), formule vérifiée (shortlist PDF, 176/179).

SORTIE = CONDITIONS COMMERCIALES DE TIERS (règle §8) : fichiers dans
.gitignore, déposés sur Supabase `donnees-protegees`, JAMAIS dans le dépôt
public, JAMAIS chargés côté OPSO.

Usage : /usr/bin/python3 scripts/generate_concurrents.py [--date-sagitta AAAA-MM-JJ] [--date-ocp AAAA-MM-JJ]
"""
import csv
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_SAG = ROOT / "crm" / "v2" / "concurrents-sagitta-data.js"
OUT_OCP = ROOT / "crm" / "v2" / "concurrents-ocp-data.js"
OUT_ETU = ROOT / "crm" / "v2" / "concurrents-etudes-data.js"
ETUDES_CSV = Path.home() / "recherche-grossistes-2026-09" / "dataset.csv"
OUT_COOP = ROOT / "crm" / "v2" / "concurrents-cooper-data.js"
COOPER_TXT = Path.home() / "recherche-concurrents-2026-09-11" / "recoltes" / "03-cooper-preparatoire-2023" / "catalogue-preparatoire-2023-texte.txt"
OUT_FARMA = ROOT / "crm" / "v2" / "concurrents-farmaline-data.js"
FARMA_JSONL = Path.home() / "recherche-concurrents-2026-09-11" / "recoltes" / "08-farmaline" / "algolia-hits.jsonl"
# fichiers où l'on lit les codes 13 que JARVIS connaît (publics ou protégés, présents en local)
FARMA_UNIVERS = ["crm/v2/prod-stats-data.js", "crm/offilog-data.js", "crm/v2/pharmazon-data.js",
                 "crm/v2/concurrents-sagitta-data.js", "crm/v2/concurrents-ocp-data.js"]

# CONCURRENTS/ est gitignoré : absent des worktrees, présent dans ~/JARVIS/APP
BASES = [ROOT / "CONCURRENTS", Path.home() / "JARVIS" / "APP" / "CONCURRENTS"]
SAG_FICHIERS = [
    ("general", "SAGITTA/catalogue_général.csv"),
    ("grossiste", "SAGITTA/catalogue_sagitta_grossiste-3.csv"),
    ("para-otc", "SAGITTA/catalogue_para-otc_(trié_par_labos)-3.csv"),
]
OCP_INCONT = "OCP/ocp-incontournables-2026-09.csv"
OCP_MC = "OCP/ocp-marque-conseil-2026-02.csv"


def trouver(rel):
    for b in BASES:
        p = b / rel
        if p.exists():
            return p
    print("ERREUR : fichier introuvable :", rel, "dans", [str(b) for b in BASES])
    sys.exit(1)


def fnum(s):
    s = (s or "").strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def date_de(p):
    return datetime.date.fromtimestamp(p.stat().st_mtime).isoformat()


def arg(nom):
    a = sys.argv[1:]
    return a[a.index(nom) + 1] if nom in a else None


# ── Sagitta ──────────────────────────────────────────────────────────────
def sagitta():
    # cle -> ligne ; cols fixes (tableau de tableaux, compact)
    COLS = ["cip13", "ean13", "libelle", "labo", "gamme", "tarif", "remise", "net", "tva", "colisage", "qtemin", "cat"]
    rows = {}
    ordre = []
    n_lues = 0
    dates = []
    for cat, rel in SAG_FICHIERS:
        p = trouver(rel)
        dates.append(date_de(p))
        with open(p, encoding="utf-8-sig", newline="") as fh:
            for r in csv.DictReader(fh, delimiter=";"):
                n_lues += 1
                cip = (r.get("CIP13") or "").strip()
                ean = (r.get("EAN13") or "").strip()
                tarif = fnum(r.get("Prix A HT"))
                if tarif is None or tarif <= 0:
                    continue
                rem = fnum(r.get("Remise1")) or 0.0
                cle = cip or ean
                if not cle:
                    continue
                net = round(tarif * (1 - rem), 2)
                labo = (r.get("Laboratoire") or "").strip()
                gamme = (r.get("Gamme") or "").strip()
                if gamme == "Non renseigné":
                    gamme = ""
                tva = fnum(r.get("TVA"))
                cur = rows.get(cle)
                if cur is None:
                    cur = {
                        "cip13": cip, "ean13": ean, "libelle": (r.get("Libellé") or "").strip(),
                        "labo": labo, "gamme": gamme, "tarif": round(tarif, 2),
                        "remise": round(rem * 100, 1), "net": net,
                        "tva": round(tva * 100, 1) if tva is not None else None,
                        "colisage": fnum(r.get("Colisage")), "qtemin": fnum(r.get("QteMin")),
                        "cat": cat,
                    }
                    rows[cle] = cur
                    ordre.append(cle)
                else:
                    # les fichiers détaillés enrichissent le socle du général
                    if labo and not cur["labo"]:
                        cur["labo"] = labo
                    if gamme and not cur["gamme"]:
                        cur["gamme"] = gamme
                    if tva is not None and cur["tva"] is None:
                        cur["tva"] = round(tva * 100, 1)
                    if cur["qtemin"] is None:
                        cur["qtemin"] = fnum(r.get("QteMin"))
                    if not cur["ean13"] and ean:
                        cur["ean13"] = ean
                    if cur["cat"] == "general":
                        cur["cat"] = cat
    data = [[rows[k][c] for c in COLS] for k in ordre]
    maj = arg("--date-sagitta") or max(dates)
    return COLS, data, maj, n_lues


# ── OCP ──────────────────────────────────────────────────────────────────
def ocp_incontournables():
    COLS = ["code13", "libelle", "labo", "section", "condition", "ppht", "net", "remise", "paliers", "page", "controle"]
    p = trouver(OCP_INCONT)
    data = []
    n = 0
    with open(p, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            n += 1
            code = (r.get("code13") or "").strip()
            net = fnum(r.get("net"))
            ppht = fnum(r.get("ppht"))
            if not code or net is None:
                continue
            data.append([
                code, (r.get("libelle") or "").strip(), (r.get("labo") or "").strip(),
                (r.get("section") or "").strip(), (r.get("condition") or "").strip(),
                ppht, net, fnum(r.get("remise_pct")), (r.get("nets_paliers") or "").strip(),
                (r.get("page") or "").strip(), (r.get("controle") or "").strip(),
            ])
    return COLS, data, arg("--date-ocp") or date_de(p), n


def ocp_marque_conseil():
    COLS = ["code13", "famille", "libelle", "descriptif", "pvc_ttc", "lppr", "tarif_lppr_ttc", "coef_marge_max", "folio"]
    p = trouver(OCP_MC)
    data = []
    n = 0
    with open(p, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            n += 1
            code = (r.get("code13") or "").strip()
            if not code:
                continue
            lppr = (r.get("lppr_individuel") or r.get("lppr_generique") or "").strip()
            data.append([
                code, (r.get("famille") or "").strip(), (r.get("libelle") or "").strip(),
                (r.get("descriptif") or "").strip(), fnum(r.get("pvc_ttc")), lppr,
                fnum(r.get("tarif_lppr_ttc")), fnum(r.get("coef_marge_max")), (r.get("folio") or "").strip(),
            ])
    return COLS, data, date_de(p), n


# ── Études (recherche conditions grossistes, sept. 2026) ─────────────────
def etudes():
    # (clé de sortie, colonne CSV) ; 'libelle' pour que l'écran tronque et titre la désignation
    MAP = [
        ("id", "id"), ("flux", "flux"), ("acteur", "grossiste_ou_fournisseur"), ("labo", "laboratoire"),
        ("medicament", "medicament"), ("cip13", "CIP13"), ("libelle", "designation"), ("periode", "date_ou_periode"),
        ("annee", "annee"), ("document", "type_document"), ("avantage", "type_avantage"), ("taux", "taux_pct"),
        ("montant", "montant"), ("assiette", "assiette"), ("seuil", "seuil_condition"), ("condition", "condition_particuliere"),
        ("plafond", "plafond_legal_applicable"), ("classification", "classification"), ("source", "source"),
        ("url", "url"), ("page", "page_ou_paragraphe"), ("extrait", "extrait_probant"), ("confiance", "confiance"),
    ]
    COLS = [m[0] for m in MAP]
    if not ETUDES_CSV.exists():
        print("ERREUR : fichier introuvable :", ETUDES_CSV)
        sys.exit(1)
    data = []
    n = 0
    with open(ETUDES_CSV, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            n += 1
            if not (r.get("id") or "").strip():
                continue
            row = []
            for cle, col in MAP:
                v = (r.get(col) or "").strip()
                if v == "NULL":
                    v = ""
                if cle in ("annee", "confiance"):
                    v = int(v) if v.isdigit() else None
                row.append(v)
            data.append(row)
    return COLS, data, date_de(ETUDES_CSV), n


# ── Cooper (catalogue préparatoire 2023, PDF public) ─────────────────────
# prix = milliers séparés par UNE espace (« 18 657,50 ») : un motif plus large
# avalait le lot « L 24 » dans le prix (24 56,95 → 2 456,95).
COOP_ROW = re.compile(r"^\s*(\d \d{3} \d{3})\s+(\d{13})\s+(Â\s+)?(.*?)\s+(\d{1,3}(?: \d{3})*,\d{2}) €\s*$")
# titres de page à unifier (casse ou coupure du titre selon la page)
COOP_FAMILLES = {"chimiques & excipients": "Chimiques & excipients", "huiles végétales": "Huiles végétales",
                 "matériel & articles": "Matériel & articles de conditionnement", "matériel & articles de conditionnement": "Matériel & articles de conditionnement",
                 "géluliers": "Géluliers", "géluliers classiques": "Géluliers", "équipement": "Équipement du préparatoire", "équipement du préparatoire": "Équipement du préparatoire"}
COOP_STATUT = re.compile(r"^[A-Z]{1,2}(/[A-Z]{1,2})*$")
# division ou lot : « 250 G », « 1K », « 0,50 G », « 25 L », « L 24 », « L1 »
COOP_DIVISION = re.compile(r"^(L ?\d+|\d+(,\d+)? ?[A-Z]{0,2}|\d+X\d+[A-Z]{0,2})$")
COOP_STATUTS = {"A": "Alimentaire", "C": "Cosmétique", "E": "Excipient", "CA": "Complément alimentaire", "SA": "Substance active", "T": "Technique"}


def titre(s):
    s = re.sub(r"\s+", " ", s.strip())
    return s if s != s.upper() else s.capitalize()


def cooper():
    COLS = ["code13", "cpf", "famille", "rayon", "libelle", "detail", "division", "statut", "cmr", "prix", "page"]
    if not COOPER_TXT.exists():
        print("ERREUR : fichier introuvable :", COOPER_TXT)
        sys.exit(1)
    # Page 46, « Pots à gélules transparents » : pdftotext éclate les deux
    # lignes colonne par colonne (codes, EAN, libellés, lots, prix sur des
    # lignes séparées). Relues à l'œil sur planches-rendues/ et recopiées ici.
    MAIN = [
        ["3401546771657", "2259100", "Conditionnement", "Pots à gélules transparents", "POT GELUL PLAST TRANSP 60 ML", "", "L 20", "", "", 13.99, 44],
        ["3401546771367", "2259102", "Conditionnement", "Pots à gélules transparents", "POT GELUL PLAST TRANSP 100 ML", "", "L 20", "", "", 22.90, 44],
    ]
    data = []
    n_ean = 0
    for page, texte in enumerate(COOPER_TXT.read_text(encoding="utf-8").split("\f"), 1):
        lignes = texte.split("\n")
        famille = ""
        rayon = ""
        prev = ""  # dernière ligne non vide (candidat rayon)
        libelle = ""
        for l in lignes:
            t = l.strip()
            if not t:
                continue
            if re.search(r"\d{13}", t):
                n_ean += 1
            m = COOP_ROW.match(l)
            if not m:
                if "CODE CPF" in t:
                    # un sous-titre, pas la fin d'une phrase de présentation
                    if prev and len(prev) < 70 and not prev.endswith("."):
                        rayon = titre(prev)
                        if rayon.casefold() == famille.casefold():
                            rayon = ""
                elif not famille and len(t) < 60:
                    famille = titre(t)
                    famille = COOP_FAMILLES.get(famille.casefold(), famille)
                prev = t
                continue
            cpf, ean, cmr, milieu, prix = m.groups()
            parts = [x for x in re.split(r"\s{2,}", milieu.strip()) if x]
            statut = ""
            if parts and COOP_STATUT.match(parts[-1]):
                statut = parts.pop()
            division = parts.pop() if parts and COOP_DIVISION.match(parts[-1]) else ""
            desig = " ".join(parts).strip()
            detail = ""
            # « péricarpe - Italie », « 1,8-cinéole » : origine ou composition,
            # pas un produit — la première lettre est une minuscule
            alpha = next((ch for ch in desig if ch.isalpha()), "")
            if desig and alpha.islower():
                detail, desig = desig, ""
            if desig:
                libelle = desig
            statut_l = " / ".join(COOP_STATUTS.get(x, x) for x in statut.split("/")) if statut else ""
            # page = numéro IMPRIMÉ en pied de planche (PDF − 2 : couverture et
            # sommaire ne sont pas numérotés) — vérifié sur les planches 32 et 46
            data.append([ean, cpf.replace(" ", ""), famille, rayon, libelle, detail, division, statut_l,
                         "CMR" if cmr else "", float(prix.replace(" ", "").replace(",", ".")), page - 2])
    # les deux lignes éclatées reprennent la famille lue sur leur page
    fam46 = next((r[2] for r in data if r[10] == 44), MAIN[0][2])
    for m in MAIN:
        m[2] = fam46
        data.append(list(m))
    # Un même EAN peut figurer deux fois (page « nouveautés » en tête, puis sa
    # famille) : on garde la ligne de la famille, la dernière lue.
    vus = {}
    for r in data:
        if r[0] in vus and vus[r[0]][9] != r[9]:
            print("ATTENTION Cooper : EAN %s à deux prix (%s p.%s / %s p.%s)" % (r[0], vus[r[0]][9], vus[r[0]][10], r[9], r[10]))
        vus[r[0]] = r
    data = list(vus.values())
    return COLS, data, "2023-01-01", n_ean


# ── Farmaline (pharmacie en ligne belge, prix publics) ───────────────────
def farmaline():
    COLS = ["ean13", "libelle", "marque", "labo", "conditionnement", "forme", "rayon", "tarif", "prix", "prix_ht", "remise", "stock", "vendeur", "lien", "connu"]
    if not FARMA_JSONL.exists():
        print("ERREUR : fichier introuvable :", FARMA_JSONL)
        sys.exit(1)
    univers = set()
    for rel in FARMA_UNIVERS:
        p = ROOT / rel
        if not p.exists():
            print("ERREUR : univers Farmaline, fichier absent :", p)
            sys.exit(1)
        univers |= set(re.findall(r"\b(\d{13})\b", p.read_text(encoding="utf-8", errors="ignore")))
    data = []
    n = 0
    vus = set()
    for l in open(FARMA_JSONL, encoding="utf-8"):
        n += 1
        r = json.loads(l)
        ean = str(r.get("ean") or "")
        if len(ean) != 13 or not ean.isdigit():
            continue
        connu = ean in univers
        if not connu and not ean.startswith("34"):
            continue
        if ean in vus:
            continue
        vus.add(ean)
        pr = r.get("prices") or {}
        rp = pr.get("retailPrice") or {}
        cat = r.get("primaryCategory") or []
        rayon = cat[-1].split("/")[-1] if cat else ""
        seller = ((r.get("best_offer") or {}).get("seller") or {}).get("name") or ""
        prix = r.get("price")
        tarif = r.get("listPrice")
        data.append([
            ean, r.get("productName") or "", r.get("brand") or "", r.get("manufacturer") or "",
            r.get("packSize") or "", r.get("pharmaForm") or "", rayon,
            round(tarif / 100, 2) if tarif else None, round(prix / 100, 2) if prix else None,
            rp.get("net"), r.get("discountInPercent") or None,
            "en stock" if r.get("inStock") else "épuisé", seller,
            "https://www.farmaline.be/" + (r.get("deeplink") or "").lstrip("/"),
            "connu" if connu else "code FR",
        ])
    return COLS, data, date_de(FARMA_JSONL), n, len(univers)


def coop_doublons(data, n_ean):
    # nombre de lignes EAN du texte qui ne sont pas dans la sortie = doublons retirés
    return n_ean - len(data)


def ecrire(out, var, obj, entete, attendu):
    body = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    out.write_text(
        "// " + entete + " — CONDITIONS DE TIERS\n"
        "// ⚠️ JAMAIS dans le dépôt public : Supabase `donnees-protegees` uniquement. Jamais chargé côté OPSO.\n"
        "// generate_concurrents.py\n"
        "window." + var + "=" + body + ";\n",
        encoding="utf-8",
    )
    # relecture de contrôle : on recompte les lignes dans ce qui a été écrit
    relu = json.loads(out.read_text(encoding="utf-8").split("=", 1)[1].rstrip().rstrip(";"))
    return relu, attendu(relu)


def main():
    cols, data, maj, n = sagitta()
    sag = {"maj": maj, "cols": cols, "rows": data}
    relu, ok = ecrire(OUT_SAG, "CONCURRENTS_SAGITTA", sag,
                      "Sagitta — catalogues général + grossiste + para-OTC fusionnés, tarif et remise",
                      lambda o: len(o["rows"]) == len(data))
    print("Sagitta  : %d lignes CSV lues -> %d références, maj %s, %d octets, relecture %s"
          % (n, len(data), maj, OUT_SAG.stat().st_size, "OK" if ok else "ÉCART !"))
    if not ok:
        sys.exit(1)

    ic, idata, imaj, ni = ocp_incontournables()
    mc, mdata, mmaj, nm = ocp_marque_conseil()
    ocp = {
        "incontournables": {"maj": imaj, "periode": "sept-déc 2026", "cols": ic, "rows": idata},
        "marqueConseil": {"maj": mmaj, "cols": mc, "rows": mdata},
    }
    relu, ok = ecrire(OUT_OCP, "CONCURRENTS_OCP", ocp,
                      "OCP — « Les Incontournables » (tous paliers) + Marque Conseil",
                      lambda o: len(o["incontournables"]["rows"]) == len(idata) and len(o["marqueConseil"]["rows"]) == len(mdata))
    print("OCP      : incontournables %d lignes -> %d, marque conseil %d -> %d, %d octets, relecture %s"
          % (ni, len(idata), nm, len(mdata), OUT_OCP.stat().st_size, "OK" if ok else "ÉCART !"))
    if not ok:
        sys.exit(1)

    ec, edata, emaj, ne = etudes()
    etu = {"maj": emaj, "cols": ec, "rows": edata}
    relu, ok = ecrire(OUT_ETU, "CONCURRENTS_ETUDES", etu,
                      "Études — avantages commerciaux observés (recherche conditions grossistes, sept. 2026)",
                      lambda o: len(o["rows"]) == len(edata))
    print("Études   : %d lignes CSV lues -> %d observations, maj %s, %d octets, relecture %s"
          % (ne, len(edata), emaj, OUT_ETU.stat().st_size, "OK" if ok else "ÉCART !"))
    if not ok:
        sys.exit(1)

    cc, cdata, cmaj, nc = cooper()
    coop = {"maj": cmaj, "cols": cc, "rows": cdata}
    relu, ok = ecrire(OUT_COOP, "CONCURRENTS_COOPER", coop,
                      "Cooper — catalogue préparatoire 2023 (matières premières, huiles essentielles, conditionnement, équipement), prix HT",
                      lambda o: len(o["rows"]) == len(cdata))
    print("Cooper   : %d lignes avec EAN dans le texte -> %d références, maj %s, %d octets, relecture %s"
          % (nc, len(cdata), cmaj, OUT_COOP.stat().st_size, "OK" if ok else "ÉCART !"))
    if not ok or nc != len(cdata) + coop_doublons(cdata, nc):
        print("ERREUR : des lignes EAN du catalogue Cooper n'ont pas été lues")
        sys.exit(1)

    fc, fdata, fmaj, nf, nu = farmaline()
    far = {"maj": fmaj, "cols": fc, "rows": fdata}
    relu, ok = ecrire(OUT_FARMA, "CONCURRENTS_FARMALINE", far,
                      "Farmaline.be — prix publics de la pharmacie en ligne belge, EAN connus de JARVIS + codes français",
                      lambda o: len(o["rows"]) == len(fdata))
    print("Farmaline: %d produits collectés, univers JARVIS %d codes -> %d références gardées, maj %s, %d octets, relecture %s"
          % (nf, nu, len(fdata), fmaj, OUT_FARMA.stat().st_size, "OK" if ok else "ÉCART !"))
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()

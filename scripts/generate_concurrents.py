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
# 29/09/2026 — eTradi (catalogue OCP juil.-déc. 2026) et shortlist Alliance Healthcare (févr.-avr. 2025),
# lus et contrôlés par ~/DPGS-documents/outils/etradi.py et alliance.py (net = formule imprimée dans le document).
OUT_ETRADI = ROOT / "crm" / "v2" / "concurrents-etradi-data.js"
ETRADI_CSV = Path.home() / "DPGS-documents" / "analyse" / "ETRADI-2026-09-27.csv"
OUT_ALLI = ROOT / "crm" / "v2" / "concurrents-alliance-data.js"
ALLI_CSV = Path.home() / "DPGS-documents" / "analyse" / "ALLIANCE-2026-09-27.csv"
# 05/10/2026 — ce que les chasses documentaires d'octobre ont rapporté (demande de Will : « alimenter le
# comparateur avec toute la data récupérée ») : shortlist Alliance mai-août 2025 (elle remplace févr.-avr.
# produit par produit), catalogue de la boutique Pharmafit (juillet 2026, prix d'un visiteur sans compte),
# catalogues mensuels Central Prom d'Astera - CERP (dernière offre connue par produit, 2025-2026).
CHASSES = Path.home() / "DPGS-documents" / "TARIFS-FRANCE-2026-09-30"
ALLI2_REMB = CHASSES / "travail-chasse-13" / "lettres-liseuses" / "fichiers" / "Alliance-Healthcare__shortlist-specialites-remboursees-mai-aout__2025-05.csv"
ALLI2_NR = CHASSES / "travail-chasse-13" / "lettres-liseuses" / "fichiers" / "Alliance-Healthcare__shortlist-specialites-non-remboursees-mai-aout__2025-05.csv"
PFIT_CSV = [CHASSES / "travail-chasse-12" / "pharmafit" / "fichiers" / "pharmafit__catalogue-boutique-anonyme-fusionne__2026-07.csv",
            CHASSES / "travail-chasse-13" / "archives-profondes" / "fichiers" / "pharmafit__boutique-gamme-mepilex-40-references-prix__2026-07.csv"]
OUT_PFIT = ROOT / "crm" / "v2" / "concurrents-pharmafit-data.js"
CPROM_CSV = Path.home() / "DPGS-documents" / "analyse" / "CENTRAL-PROM-2026-09-27.csv"
OUT_CERP = ROOT / "crm" / "v2" / "concurrents-cerp-data.js"
# 05/10/2026 (suite) — factures Epsilon d'un compte de DÉMONSTRATION, et conditions que d'autres groupements
# obtiennent des laboratoires (classeur consolidé, onglet « Conditions par produit », lu en lecture seule).
EPS_CSV = CHASSES / "travail-chasse-13" / "archives-profondes" / "fichiers" / "epsilon__factures-espace-client-demo-lignes-transcrites__2026-07.csv"
OUT_EPS = ROOT / "crm" / "v2" / "concurrents-epsilon-data.js"
GRP_XLSX = Path.home() / "DPGS-documents" / "CONDITIONS-CONCURRENTS-CONSOLIDE-2026-09-28-PRIX-EGAL-TAUX.xlsx"
GRP_CSV_DIR = Path.home() / "DPGS-documents" / "analyse"
OUT_GRP = ROOT / "crm" / "v2" / "concurrents-groupements-data.js"
# Dossier de tête du chemin « Document » -> nom lisible. Un dossier absent d'ici garde son nom tel quel (et est signalé).
GRP_NOMS = {"paraph": "Paraph", "aptiphar": "Aptiphar", "solipharm": "Solipharm", "flexipluspharma": "Flexi Plus Pharma",
            "DPGS": "DPGS", "alternativ-pharmaxv": "Alternativ PharmaXV"}
MOIS = ["JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE"]
MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
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
    # tarif = prix BARRÉ (best_offer.strike_price, seulement s'il dépasse le prix) ;
    # conseille = listPrice (prix conseillé, parfois SOUS le prix de vente : ce n'est pas
    # un prix barré) ; remise = best_offer.discount en %. Vérifié sur la récolte le 12/09.
    COLS = ["ean13", "libelle", "marque", "labo", "conditionnement", "forme", "rayon", "tarif", "conseille", "prix", "prix_ht", "remise", "stock", "vendeur", "lien", "connu"]
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
        bo = r.get("best_offer") or {}
        seller = (bo.get("seller") or {}).get("name") or ""
        prix = r.get("price")
        conseille = r.get("listPrice")
        strike = (bo.get("strike_price") or {}).get("amount")
        tarif = strike if (strike and prix and strike > prix) else None
        remise = bo.get("discount") if tarif else None
        data.append([
            ean, r.get("productName") or "", r.get("brand") or "", r.get("manufacturer") or "",
            r.get("packSize") or "", r.get("pharmaForm") or "", rayon,
            round(tarif / 100, 2) if tarif else None, round(conseille / 100, 2) if conseille else None,
            round(prix / 100, 2) if prix else None, rp.get("net"), remise or None,
            "en stock" if r.get("inStock") else "épuisé", seller,
            "https://www.farmaline.be/" + (r.get("deeplink") or "").lstrip("/"),
            "connu" if connu else "code FR",
        ])
    return COLS, data, date_de(FARMA_JSONL), n, len(univers)


# ── eTradi / Alliance : une ligne par palier → une ligne par produit ─────
# net = le MEILLEUR net parmi les paliers dont le calcul reproduit le document
# (contrôle « exacte… » ou « tranche désignée… ») ; les autres paliers restent
# visibles dans « paliers » mais ne font pas le verdict. remise = (ppht − net) / ppht,
# comme OCP. paliers / qtes : nets et quantités dans l'ordre des quantités.
def par_palier(path, fam_col, facture):
    if not path.exists():
        print("ERREUR : fichier introuvable :", path)
        sys.exit(1)
    COLS = ["code13", "libelle", "famille", "pfht", "ppht", "net"] + (["facture"] if facture else []) + ["remise", "paliers", "qtes", "page", "controle"]
    prod, ordre, n = {}, [], 0
    with open(path, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            n += 1
            code = (r.get("code_produit") or "").strip()
            net = fnum(r.get("prix_net"))
            if len(code) != 13 or net is None:
                continue
            q = fnum(r.get("quantite_a_commander") if facture else r.get("palier")) or 1
            if code not in prod:
                prod[code] = {"r": r, "p": [], "pages": []}
                ordre.append(code)
            ctl = (r.get("controle") or "").strip()
            pg = (r.get("page") or "").strip()
            if pg and pg not in prod[code]["pages"]:
                prod[code]["pages"].append(pg)
            t = (q, net, ctl.startswith("exacte") or ctl.startswith("tranche désignée"), ctl, fnum(r.get("prix_facture")) if facture else None)
            if t not in prod[code]["p"]:   # même produit imprimé sur plusieurs pages
                prod[code]["p"].append(t)
    data, n_sans = [], 0
    for code in ordre:
        r, ps = prod[code]["r"], sorted(prod[code]["p"], key=lambda x: (x[0], -x[1]))
        bons = [x[1] for x in ps if x[2]]
        net = min(bons) if bons else None
        if net is None:
            n_sans += 1
        ppht = fnum(r.get("prix"))
        ligne = [code, (r.get("nom") or "").strip(), (r.get(fam_col) or "").strip(), fnum(r.get("pfht")), ppht, net]
        if facture:
            ligne.append(ps[0][4])
        ligne += [round((ppht - net) / ppht * 100, 2) if (net is not None and ppht) else None,
                  "|".join("%g" % x[1] for x in ps), " · ".join("dès %g" % x[0] for x in ps),
                  " et ".join(prod[code]["pages"]), "; ".join(sorted({x[3] for x in ps if x[3] != "exacte"}))]
        data.append(ligne)
    return COLS, data, n, n_sans


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

    dpgs()
    chasses()


def alliance_mai_aout(cols, data):
    """Shortlist mai-août 2025 : elle remplace la ligne févr.-avr. du même produit, et ajoute les siens."""
    i = {c: n for n, c in enumerate(cols)}
    par_code = {r[0]: r + ["février-avril 2025"] for r in data}
    n_lu = n_rempl = 0
    for path, remb in ((ALLI2_REMB, True), (ALLI2_NR, False)):
        if not path.exists():
            print("ERREUR : fichier introuvable :", path)
            sys.exit(1)
        with open(path, encoding="utf-8-sig", newline="") as fh:
            for r in csv.DictReader(fh, delimiter=";"):
                code = (r.get("CIP13") or "").strip()
                ppht = fnum(r.get("PPHT"))
                if remb:
                    p1, p2, q = fnum(r.get("P1")), fnum(r.get("P2")), fnum(r.get("palier (unités)"))
                    ps = [x for x in ((1, p1), (q or 1, p2)) if x[1]]
                else:
                    ps = [(fnum(r.get("minimum de commande à la ligne")) or 1, fnum(r.get("prix net")))]
                    ps = [x for x in ps if x[1]]
                if len(code) != 13 or not ps or (r.get("contrôle") or "").strip() != "ok":
                    continue
                n_lu += 1
                n_rempl += code in par_code
                net = min(x[1] for x in ps)
                l = [None] * len(cols)
                l[i["code13"]], l[i["libelle"]] = code, (r.get("libellé") or "").strip()
                l[i["famille"]] = "spécialités remboursées" if remb else "spécialités non remboursées"
                l[i["pfht"]], l[i["ppht"]], l[i["net"]] = fnum(r.get("PFHT")), ppht, net
                l[i["facture"]] = fnum(r.get("prix unitaire facturé"))
                l[i["remise"]] = round((ppht - net) / ppht * 100, 2) if ppht else None
                l[i["paliers"]] = "|".join("%g" % x[1] for x in ps)
                l[i["qtes"]] = " · ".join("dès %g" % x[0] for x in ps)
                l[i["page"]], l[i["controle"]] = (r.get("page") or "").strip(), ""
                par_code[code] = l + ["mai-août 2025"]
    return cols + ["periode"], list(par_code.values()), n_lu, n_rempl


def pharmafit():
    cols, prod = ["code13", "libelle", "labo", "tarif", "remise", "net", "dispo"], {}
    n = 0
    for path in PFIT_CSV:
        if not path.exists():
            print("ERREUR : fichier introuvable :", path)
            sys.exit(1)
        with open(path, encoding="utf-8-sig", newline="") as fh:
            for r in csv.DictReader(fh, delimiter=";"):
                n += 1
                code, net = (r.get("cip") or "").strip(), fnum(r.get("netPrice"))
                if len(code) != 13 or not net or net <= 0:
                    continue
                labo = (r.get("lab") or "").strip()
                prod[code] = [code, (r.get("name") or "").strip().lstrip("# ").strip(), "" if labo == "—" else labo,
                              fnum(r.get("listPrice")), fnum(r.get("discountPct")) or 0, net, (r.get("statusLabel") or "").strip()]
    return cols, list(prod.values()), n


def central_prom():
    """Une ligne par produit : son catalogue Central Prom le plus récent (2025-2026), meilleur palier contrôlé."""
    cols = ["code13", "libelle", "ppht", "net", "remise", "qtes", "paliers", "periode", "page"]
    if not CPROM_CSV.exists():
        print("ERREUR : fichier introuvable :", CPROM_CSV)
        sys.exit(1)
    prod, n, sans_mois = {}, 0, set()
    with open(CPROM_CSV, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            n += 1
            code, net, an = (r.get("code_produit") or "").strip(), fnum(r.get("prix_net")), (r.get("annee") or "").strip()
            if len(code) != 13 or not net or an not in ("2025", "2026") or not (r.get("controle") or "").startswith("exacte"):
                continue
            doc = (r.get("document") or "").upper()
            m = [k for k, x in enumerate(MOIS) if x in doc]
            if not m:
                sans_mois.add(doc)
                continue
            quand = (int(an), max(m))
            prod.setdefault(code, {}).setdefault(quand, []).append((fnum(r.get("quantite")) or 1, net, r))
    if sans_mois:
        print("ERREUR : mois illisible dans le nom de", sorted(sans_mois))
        sys.exit(1)
    data = []
    for code, par in prod.items():
        quand = max(par)
        ps = sorted({(x[0], x[1]) for x in par[quand]}, key=lambda x: (x[0], -x[1]))
        r = min(par[quand], key=lambda x: x[1])[2]
        net, ppht = min(x[1] for x in ps), fnum(r.get("prix"))
        data.append([code, (r.get("nom") or "").strip(), ppht, net, round((ppht - net) / ppht * 100, 2) if ppht else None,
                     " · ".join("dès %g" % x[0] for x in ps), "|".join("%g" % x[1] for x in ps),
                     MOIS_FR[quand[1]] + " " + str(quand[0]), (r.get("page") or "").strip()])
    return cols, data, n


def chasses():
    c, d, n = pharmafit()
    o = {"maj": "2026-07-25", "periode": "juillet 2026", "cols": c, "rows": d}
    relu, ok = ecrire(OUT_PFIT, "CONCURRENTS_PHARMAFIT", o, "Pharmafit — catalogue de la boutique, juillet 2026, prix d'un visiteur sans compte", lambda x: len(x["rows"]) == len(d))
    print("Pharmafit : %d lignes lues -> %d produits à prix, %d octets, relecture %s" % (n, len(d), OUT_PFIT.stat().st_size, "OK" if ok else "ÉCART !"))
    if not ok:
        sys.exit(1)
    c, d, n = central_prom()
    o = {"maj": "2026-03-01", "periode": "2025-2026", "cols": c, "rows": d}
    relu, ok = ecrire(OUT_CERP, "CONCURRENTS_CERP", o, "Astera - CERP — catalogues mensuels Central Prom 2025-2026, dernière offre connue par produit", lambda x: len(x["rows"]) == len(d))
    print("Central Prom : %d lignes lues -> %d produits, %d octets, relecture %s" % (n, len(d), OUT_CERP.stat().st_size, "OK" if ok else "ÉCART !"))
    if not ok:
        sys.exit(1)
    c, d, n = epsilon()
    o = {"maj": "2026-07-27", "periode": "juillet 2026", "cols": c, "rows": d}
    relu, ok = ecrire(OUT_EPS, "CONCURRENTS_EPSILON", o, "Epsilon — deux factures d'un compte de DÉMONSTRATION (juillet 2026), un repère et non un tarif", lambda x: len(x["rows"]) == len(d))
    print("Epsilon : %d lignes lues -> %d produits, %d octets, relecture %s" % (n, len(d), OUT_EPS.stat().st_size, "OK" if ok else "ÉCART !"))
    if not ok:
        sys.exit(1)
    c, d, st = groupements()
    o = {"maj": "2026-09-28", "periode": "2025-2026", "cols": c, "rows": d}
    relu, ok = ecrire(OUT_GRP, "CONCURRENTS_GROUPEMENTS", o, "Conditions que des groupements obtiennent des laboratoires, documents 2025-2026", lambda x: len(x["rows"]) == len(d))
    print("Groupements : %d lignes lues, hors 2025-2026 %d, cohérence non exacte %d, exclues %s, gardées %d (dont %d sans libellé), %d octets, relecture %s"
          % (st["lues"], st["hors_millesime"], st["hors_coherence"], st["exclus"], st["gardees"], st["sans_libelle"], OUT_GRP.stat().st_size, "OK" if ok else "ÉCART !"))
    if st["inconnus"]:
        print("  dossiers gardés tels quels (nom lisible inconnu) :", st["inconnus"])
    if not ok:
        sys.exit(1)


def epsilon():
    """Une ligne par produit (la facture la plus récente l'emporte). Compte de DÉMONSTRATION : un repère, pas un tarif."""
    cols = ["code13", "libelle", "tarif", "remise", "net", "facture", "note"]
    if not EPS_CSV.exists():
        print("ERREUR : fichier introuvable :", EPS_CSV)
        sys.exit(1)
    prod, n = {}, 0
    with open(EPS_CSV, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            n += 1
            code, net = (r.get("CIP13 lu sur l'image") or "").strip(), fnum(r.get("PU net HT"))
            if len(code) != 13 or not code.isdigit() or not net or net <= 0:
                print("ERREUR : ligne Epsilon inutilisable :", code, r.get("désignation"))
                sys.exit(1)
            d = (r.get("date facture") or "").strip()
            quand = datetime.datetime.strptime(d, "%d/%m/%Y").date()
            cle_ok = (r.get("clé CIP valide") or "").strip() == "oui"
            ligne = [code, (r.get("désignation") or "").strip(), fnum(r.get("PU brut HT")), fnum(r.get("% remise")) or 0, net,
                     "%s du %s" % ((r.get("facture") or "").strip(), d), "" if cle_ok else "code à vérifier"]
            if code not in prod or quand >= prod[code][0]:
                prod[code] = (quand, ligne)
    return cols, [v[1] for v in sorted(prod.values(), key=lambda v: (v[0], v[1][1]))], n


def groupements():
    """Conditions par produit des groupements (2025-2026, cohérence « exacte »), hors grossistes déjà dans l'app."""
    import openpyxl
    if not GRP_XLSX.exists():
        print("ERREUR : fichier introuvable :", GRP_XLSX)
        sys.exit(1)
    wb = openpyxl.load_workbook(str(GRP_XLSX), read_only=True)
    junk = lambda t, code: len(t) < 3 or t == code or t.endswith(":") or t.replace(" ", "").isdigit()
    lib_doc, lib_code = {}, {}

    def noter(code, lib, doc):
        code, lib = str(code or "").strip(), re.sub(r"\s+", " ", str(lib or "")).strip()
        if not code or junk(lib, code):
            return
        lib = lib[:110]
        lib_doc.setdefault((code, doc), lib)
        lib_code.setdefault(code, lib)
    for ws in wb.worksheets:
        if not ws.title.endswith("détail"):
            continue
        it = ws.iter_rows(values_only=True)
        tete = [str(h or "") for h in next(it)]
        ic = next((k for k, h in enumerate(tete) if h.startswith("Code produit")), None)
        il = next((k for k, h in enumerate(tete) if h.startswith("Libellé")), None)
        idoc = tete.index("Document") if "Document" in tete else None
        if ic is None or il is None or idoc is None:
            print("  (onglet sans code/libellé/document, ignoré pour les libellés :", ws.title, ")")
            continue
        for r in it:
            noter(r[ic], r[il], str(r[idoc] or ""))
    for f in sorted(GRP_CSV_DIR.glob("*.csv")):
        with open(f, encoding="utf-8-sig", newline="") as fh:
            l1 = fh.readline()
            fh.seek(0)
            rd = csv.DictReader(fh, delimiter=";" if l1.count(";") > l1.count(",") else ",")
            col = "nom" if "nom" in (rd.fieldnames or []) else ("presentation" if "presentation" in (rd.fieldnames or []) else None)
            if col:
                for r in rd:
                    noter(r.get("code_produit"), r.get(col), r.get("document") or "")
    cols = ["code", "libelle", "groupement", "annee", "prix", "remise", "net", "qte", "periode", "document"]
    ws = wb["Conditions par produit"]
    n, exclus, hors_millesime, hors_coherence, vus, data, inconnus, sans_lib = 0, {}, 0, 0, set(), [], {}, 0
    fam_lues = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        code, mill, prix, rem, net, qte, per, coh, doc = (str(r[0] or "").strip(), str(r[1] or ""), r[3], r[4], r[5], r[6], r[7], str(r[8] or ""), str(r[10] or ""))
        if not code:
            continue
        n += 1
        dossier = doc.split("/")[0]
        fam_lues[dossier] = fam_lues.get(dossier, 0) + 1
        if mill not in ("2025", "2026"):
            hors_millesime += 1
            continue
        if not coh.startswith("exacte"):
            hors_coherence += 1
            continue
        low = doc.lower()
        fam = ("Central Prom (Astera - CERP)" if ("central-prom" in low or "centralprom" in low) else
               "eTradi / OCP" if (low.startswith("dpgs/plateformes-d-achat/") or "/ocp-" in low or low.startswith("ocp")) else
               "Alliance Healthcare" if "alliance-healthcare" in low else "")
        if fam:
            exclus[fam] = exclus.get(fam, 0) + 1
            continue
        nom = GRP_NOMS.get(dossier)
        if not nom:
            nom = dossier
            inconnus[dossier] = inconnus.get(dossier, 0) + 1
        base = doc.rsplit("/", 1)[-1]
        base = base.rsplit(".", 1)[0] if "." in base else base
        lib = lib_doc.get((code, doc)) or lib_code.get(code) or ""
        if not lib:
            sans_lib += 1
        ligne = [code, lib, nom, int(mill), prix, rem, net, qte if isinstance(qte, (int, float)) or qte is None else str(qte), per if per else "", base]
        cle = json.dumps(ligne, ensure_ascii=False)
        if cle in vus:
            continue
        vus.add(cle)
        data.append(ligne)
    data.sort(key=lambda l: (l[2], l[9], l[0]))
    stats = {"lues": n, "hors_millesime": hors_millesime, "hors_coherence": hors_coherence, "exclus": exclus,
             "gardees": len(data), "doublons": 0, "inconnus": inconnus, "sans_libelle": sum(1 for l in data if not l[1]), "dossiers_lus": fam_lues}
    return cols, data, stats


def dpgs():
    for nom, out, var, src, fam, fac, maj, per, ent in (
        ("eTradi", OUT_ETRADI, "CONCURRENTS_ETRADI", ETRADI_CSV, "section", False, "2026-07-01", "juillet-décembre 2026",
         "eTradi — catalogue OCP juillet-décembre 2026, tous paliers, net recalculé selon la page 41 du document"),
        ("Alliance", OUT_ALLI, "CONCURRENTS_ALLIANCE", ALLI_CSV, "famille", True, "2025-02-01", "février-avril 2025",
         "Alliance Healthcare — shortlists février-avril et mai-août 2025, tous paliers, net : PPHT moins taux × PFHT")):
        c, d, n, n_sans = par_palier(src, fam, fac)
        if nom == "Alliance":
            c, d, n2, n_rempl = alliance_mai_aout(c, d)
            maj, per = "2025-05-01", "février-août 2025"
            print("Alliance : shortlist mai-août 2025, %d produits lus dont %d remplacent leur ligne févr.-avr." % (n2, n_rempl))
        o = {"maj": maj, "periode": per, "cols": c, "rows": d}
        relu, ok = ecrire(out, var, o, ent, lambda x: len(x["rows"]) == len(d))
        print("%-9s: %d paliers lus -> %d produits (%d sans net contrôlé), %d octets, relecture %s"
              % (nom, n, len(d), n_sans, out.stat().st_size, "OK" if ok else "ÉCART !"))
        if not ok:
            sys.exit(1)


if __name__ == "__main__":
    main()

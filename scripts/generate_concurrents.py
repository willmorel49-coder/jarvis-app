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
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_SAG = ROOT / "crm" / "v2" / "concurrents-sagitta-data.js"
OUT_OCP = ROOT / "crm" / "v2" / "concurrents-ocp-data.js"
OUT_ETU = ROOT / "crm" / "v2" / "concurrents-etudes-data.js"
ETUDES_CSV = Path.home() / "recherche-grossistes-2026-09" / "dataset.csv"

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


if __name__ == "__main__":
    main()

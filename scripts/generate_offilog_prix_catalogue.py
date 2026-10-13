#!/usr/bin/env python3
"""Tarifs laboratoire (prix catalogue HT) -> crm/v2/offilog-prix-catalogue.js

Pour chaque produit Offilog (EAN 13 des meilleures ventes + du catalogue complet,
fichiers publics du depot), le prix catalogue HT du laboratoire AVANT reduction,
releve dans les tarifs que nous avons recus (OCP, Sagitta, Pharmazon, tableaux
de laboratoire). Le prix Offilog n'est PAS dans ce fichier : le pourcentage se
calcule dans la page (v2-offilog.js) avec le prix deja en memoire.

Regles (mesure : jarvis-preuves/offilog-prix-catalogue-2026-10-12/RAPPORT.md) :
- sources GARDEES : OCP Incontournables, Sagitta, Pharmazon, CENTRAL-PROM, PARAPH1,
  PARAPH, BRUTS2, les tableaux de laboratoire (NUTERGIA, PEDIACT...) et les tarifs
  PDF de laboratoire lus ici meme (TARIFS_LABO : PRANAROM, PILEJE, ARKOPHARMA, URGO,
  GILBERT, NUTERGIA, PIERRE FABRE, PURESSENTIEL ; pdftotext -layout) ;
- sources EXCLUES : tarif Integral (ppht), ETRADI, ALLIANCE (prix grossiste),
  FLASH-RESTE, OFFRE-FLASH, FLEXI-V2, ALTERNATIV (prix d'operations) ;
- prix retenu : annee la plus recente ; a annee egale OCP > Sagitta > Pharmazon >
  CENTRAL-PROM > PARAPH1 > PARAPH > BRUTS2 > les autres ;
- dans un tarif PDF, pour une meme source, un code ne garde que son annee la plus
  recente (une hausse annuelle n'est pas une contradiction) ;
- URGO = source de DERNIER RECOURS (decision de Will, 12/10) : un prix Urgo n'entre
  que si AUCUNE autre source ne porte le code, son niveau est force a `conteste`
  (la page affiche « a verifier ») et il ne confirme ni ne conteste jamais une autre source ;
- le classeur CONDITIONS-CONCURRENTS-GLOBAL (colonne Prix fausse) et PARAPH-OFFRES-FLASH
  (prix d'operation) ne sont PAS lus ;
- GILBERT = a verifier (decision de Will, 13/10) : tarif de base tres haut, Offilog y ressortait
  54 % dessous en mediane contre 33 % pour le reste. La source garde son rang, mais tout prix
  RETENU depuis ce tarif sort au niveau `conteste` : « a verifier » dans le CRM, rien cote OPSO ;
- niveau : confirme (une autre source a +-1 %), conteste (autre source d'une
  annee voisine a plus de 5 %), seul (une seule source), proche (le reste) ;
  nbSources = sources qui s'accordent a +-5 % avec le prix retenu.

SORTIE = TARIFS DE TIERS (regle §8) : le fichier est dans .gitignore et se depose
sur Supabase `donnees-protegees`, il ne part JAMAIS dans le depot public, et
l'app OPSO ne le charge pas.

SECOND FICHIER, pour l'espace OPSO : crm/v2/offilog-cat-opso.js = code 13 -> prix catalogue HT SEUL (un nombre ;
ni source, ni annee, ni niveau, ni date de tarif). Exclus : tout niveau `conteste` (donc tout ce qui vient des tarifs Urgo et Gilbert).
Le pourcentage se calcule dans la page avec le prix Offilog affiche sur la carte. Fichier hors git aussi, destine a
`donnees-protegees` (cle `offilogcatopso`). L'espace OPSO ne charge JAMAIS offilog-prix-catalogue.js.

Usage : /usr/bin/python3 scripts/generate_offilog_prix_catalogue.py [--date AAAA-MM-JJ]
Refuse d'ecrire si le volume tombe sous 80 % du fichier precedent, ou si un tarif PDF
est absent / lu en dessous de son plancher (jamais un fichier produit en silence avec
moins de donnees).
"""
import collections
import csv
import datetime
import glob
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
csv.field_size_limit(10 ** 9)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "crm" / "v2" / "offilog-prix-catalogue.js"
APP = Path.home() / "JARVIS" / "APP"
DPGS = Path.home() / "DPGS-documents" / "analyse"   # raccourci : toujours globber avec la barre finale
BEST = ROOT / "crm" / "v2" / "offilog-bestsellers-data.js"
LIVE = ROOT / "opso" / "offilog-live-data.js"
OUT_CAT = ROOT / "crm" / "v2" / "offilog-cat-opso.js"

EXCLUES = {"ETRADI", "ALLIANCE", "FLASH-RESTE", "OFFRE-FLASH", "FLEXI-V2", "ALTERNATIV"}
NO_PRICE_FILES = {"libelles-retrouves-2026-10-05.csv"}   # noms seulement, aucun prix
PRICE_COL = {"NUTERGIA": "pa_ht"}
ORDRE = ["OCP", "Sagitta", "Pharmazon", "CENTRAL-PROM", "PARAPH1", "PARAPH", "BRUTS2"]
BAD_CTRL = ["a verifier", "non appliqu", "non reproduit", "ne reconstruit pas", "meme ligne de prix",
            "aucun code produit", "illisible", "designee par le calcul", "annoncee alors que"]

# Tarifs PDF de laboratoire : (source, annee, chemin relatif a ~/DPGS-documents/, lecteur, plancher).
# plancher = 80 % du nombre de codes lus lors de la mesure du 12/10/2026 (lecteurs ameliores inclus) ; en dessous : arret.
# La liste elle-meme (chemins des documents) vit HORS du depot public : ~/.config/jarvis/offilog-tarifs-labo.json.
TARIFS_LABO_CFG = Path.home() / ".config" / "jarvis" / "offilog-tarifs-labo.json"
if not TARIFS_LABO_CFG.is_file():
    sys.exit("ERREUR : liste des tarifs de laboratoire introuvable : %s" % TARIFS_LABO_CFG)
TARIFS_LABO = [tuple(t) for t in json.loads(TARIFS_LABO_CFG.read_text(encoding="utf-8"))]
DERNIER_RECOURS = {"URGO"}   # n'entre que si aucune autre source ne porte le code ; niveau force a conteste
A_VERIFIER = {"GILBERT"}     # source ordinaire (meme rang, confirme et conteste comme avant), mais niveau force a conteste quand elle est RETENUE
DOCS_LABO = Path.home() / "DPGS-documents"   # raccourci : chemin complet donne a pdftotext, jamais find sans barre finale


def digits(s):
    return re.sub(r"\D", "", s or "")


def fnum(s):
    s = (str(s) if s is not None else "").strip().replace(",", ".").replace(" ", "").replace(" ", "")
    try:
        return float(s) if s else None
    except ValueError:
        return None


def strip_acc(s):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


def ctrl_ok(c):
    low = strip_acc((c or "").strip())
    return not any(k in low for k in BAD_CTRL)


def read_csv(path, delim=None, repair_col=None):
    """Lecture csv ; repair_col = colonne texte libre pouvant contenir des ';' non
    proteges (libelles Sagitta) : les champs en trop y sont refusionnes (reparation
    de LECTURE, aucune valeur n'est corrigee)."""
    with open(path, encoding="utf-8-sig", newline="") as fh:
        first = fh.readline()
        fh.seek(0)
        d = delim or (";" if first.count(";") > first.count(",") else ",")
        rd = csv.reader(fh, delimiter=d)
        head = next(rd)
        n = len(head)
        out = []
        for row in rd:
            if len(row) != n:
                if repair_col and len(row) > n and repair_col in head:
                    i = head.index(repair_col)
                    extra = len(row) - n
                    row = row[:i] + [d.join(row[i:i + extra + 1])] + row[i + extra + 1:]
                elif len(row) < n:
                    row = row + [""] * (n - len(row))
                else:
                    row = row[:n]
            out.append(dict(zip(head, row)))
        return out


# --- lecteurs des tarifs PDF (colonnes verifiees dans les PDF le 12/10/2026) ---
# Chacun rend ({code13: prix HT}, nombre de lignes a code NON lues). Une ligne n'est lue que si
# le code ET le prix sont sur la MEME ligne ; sinon elle reste non lue (comptee, jamais devinee).
PX = r"(\d{1,3}[,.]\d{2})"
E13 = r"(?<!\d)(\d{13})(?!\d)"


def lire_arko(lines):
    # « PRIX HT » : 1er montant ; le 2e est le prix public conseille
    d, rej = {}, 0
    for l in lines:
        m = re.search(r"(?<!\d)(\d{13}|\d{5} \d{7} \d)(?!\d)", l)
        if not m:
            continue
        p = re.search(PX + r" ?€\s+[A-Z]{1,4}\s+\d{1,2}(?:,\d)? ?%?\s+" + PX + r" ?€", l[m.end():])
        if p:
            d[m.group(1).replace(" ", "")] = fnum(p.group(1))
        else:
            rej += 1
    return d, rej


def lire_urgo(lines):
    # « TARIF 01/01/2025 » : DERNIER montant de la ligne ; deux codes possibles « A / B »
    d, rej = {}, 0
    for l in lines:
        ms = list(re.finditer(E13, l))
        if not ms:
            continue
        p = re.search(r"(\d+\.\d{2})\s+-?\d+\.\d ?%\s+(\d+\.\d{2})\s*$", l)
        v = fnum(p.group(2)) if p else None
        if v is None:
            q = re.match(r"^\s+(\d+\.\d{2})\s*$", l[ms[-1].end():])   # prix seul apres le dernier code
            v = fnum(q.group(1)) if q else None
        if v is None:
            rej += 1
        else:
            for m in ms:
                d[m.group(1)] = v
    return d, rej


def lire_gilbert(lines):
    # apres TVA et colisage : « TARIF DE BASE (EN € HT) » = 1er montant ; le 2e est le prix public conseille
    d, rej = {}, 0
    for l in lines:
        m = re.search(r"(?<!\d)(\d \d{3} \d{3} \d{3} \d{3}|\d,\d{3},\d{3},\d{3},\d{3}|\d{13})(?!\d)", l)
        if not m:
            continue
        p = re.search(r"(?:5,5|20|10|2,1|5\.5|2\.1) ?%\s+(\d{1,3})\s+" + PX + r"(?: ?€)?(?=\s|$)", l[m.end():])
        if p:
            d[re.sub(r"[ ,]", "", m.group(1))] = fnum(p.group(2))
        else:
            rej += 1
    return d, rej


def lire_nutergia(lines):
    # « P.A. HT » : 1er montant ; le 2e est le prix public TTC. Deux colonnes : une ligne peut porter deux produits
    d, rej = {}, 0
    for l in lines:
        tr = False
        for m in re.finditer(r"(?<!\d)(\d \d{6} \d{6})\*?(?!\d)\s+(?:\d{1,2}\s+)?" + PX + r" ?€\s+" + PX + r"(?: ?€)?", l):
            d[m.group(1).replace(" ", "")] = fnum(m.group(2))
            tr = True
        if not tr and re.search(r"(?<!\d)\d \d{6} \d{6}(?!\d)", l):
            rej += 1
    return d, rej


def lire_pfabre(lines):
    # « Tarif en € » : 1er montant (parfois suivi de **) ; le 2e est le prix moyen conseille ; TVA parfois absente
    d, rej = {}, 0
    for l in lines:
        m = re.search(r"(?<!\d)(\d \d{3} \d{3} \d{3} \d{3})(?!\d)", l)
        if not m:
            continue
        p = re.search(r"^\s+(?:\d{7}\s+)?" + PX + r"\**\s+" + PX + r"(?:\s+(?:20|5,5|10))?(?:\s|$)", l[m.end():])
        if p:
            d[m.group(1).replace(" ", "")] = fnum(p.group(1))
        else:
            rej += 1
    return d, rej


def lire_puress(lines):
    # « PUHT 2024 »
    d, rej = {}, 0
    for l in lines:
        m = re.search(E13, l)
        if not m:
            continue
        p = re.search(r"\d{1,2},\d{2} ?%\s+\d{1,3}\s+" + PX + r" ?€\s*$", l)
        if p:
            d[m.group(1)] = fnum(p.group(1))
        else:
            rej += 1
    return d, rej


def lire_pranarom(lines):
    # « Tarif HT Pharma » : code, [ACL], TVA, PCB, prix en fin de ligne
    d, rej = {}, 0
    for l in lines:
        m = re.search(r"(?<!\d)(\d{13})\s+(?:(\d{7}|\d{13})\s+)?(5,5|20|10|2,1|0)\s+(\d{1,3})\s+(\d{1,3},\d{2})\s*$", l)
        if m:
            d[m.group(1)] = fnum(m.group(5))
        elif re.search(E13, l):
            rej += 1
    return d, rej


def lire_pileje(lines):
    # « code puis prix € » sur la meme ligne (mise en page a deux colonnes : la fin de ligne n'est pas lue)
    d = {}
    tous = set()
    for l in lines:
        tous.update(re.findall(E13, l))
        for m in re.finditer(r"(?<!\d)(\d{13})[ \t]+(\d{1,3},\d{2})[ \t]*€", l):
            d[m.group(1)] = fnum(m.group(2))
    return d, len(tous - set(d))


LECTEURS = {"arko": lire_arko, "urgo": lire_urgo, "gilbert": lire_gilbert, "nutergia": lire_nutergia,
            "pfabre": lire_pfabre, "puress": lire_puress, "pranarom": lire_pranarom, "pileje": lire_pileje}


def lire_tarifs_labo():
    """Lit chaque PDF de TARIFS_LABO. Rend (candidats, lignes par source, stats par document).
    Arret net si pdftotext ou un PDF manque, ou si un document est lu sous son plancher."""
    exe = shutil.which("pdftotext") or ("/opt/homebrew/bin/pdftotext" if os.path.exists("/opt/homebrew/bin/pdftotext") else None)
    if not exe:
        sys.exit("ERREUR : pdftotext introuvable (brew install poppler) - tarifs de laboratoire non lus.")
    par_src = collections.defaultdict(dict)   # source -> code -> (annee, prix)
    lignes = collections.Counter()
    stats = []
    for src, an, rel, lecteur, plancher in TARIFS_LABO:
        pdf = DOCS_LABO / rel
        if not pdf.is_file():
            sys.exit("ERREUR : tarif %s %d introuvable : %s" % (src, an, pdf))
        r = subprocess.run([exe, "-layout", str(pdf), "-"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if r.returncode != 0:
            sys.exit("ERREUR : pdftotext a echoue sur %s (code %d)" % (pdf, r.returncode))
        txt = r.stdout.decode("utf-8", "replace").replace("​", "")
        d, rej = LECTEURS[lecteur](txt.splitlines())
        stats.append((src, an, len(d), rej))
        if len(d) < plancher:
            sys.exit("ERREUR : %s %d : %d codes lus, plancher %d - fichier NON ecrit." % (src, an, len(d), plancher))
        lignes[src] += len(d)
        for c, v in d.items():
            if v and v > 0 and (c not in par_src[src] or par_src[src][c][0] < an):
                par_src[src][c] = (an, v)
    cands = [(c, src, an, v) for src, u in par_src.items() for c, (an, v) in u.items()]
    return cands, lignes, stats


def produits_offilog():
    """EAN 13 des meilleures ventes et du catalogue complet (fichiers publics suivis par git)."""
    eans = set()
    for p, motif in ((BEST, r'"ean":"([^"]*)"'), (LIVE, r"ean:'([^']*)'")):
        if not p.exists():
            sys.exit("ERREUR : fichier produits introuvable : %s" % p)
        for m in re.findall(motif, p.read_text(encoding="utf-8")):
            e = digits(m)
            if len(e) == 13:
                eans.add(e)
    return eans


def ecrire_cat_opso(table):
    """Second fichier (espace OPSO) : code 13 -> prix catalogue HT SEUL, hors niveau `conteste`."""
    cat = {e: t[0] for e, t in table.items() if t[2] != "conteste"}
    excl = len(table) - len(cat)
    avant = OUT_CAT.read_text(encoding="utf-8").count('":') if OUT_CAT.exists() else 0
    if avant and len(cat) < 0.8 * avant:
        print("REFUS (prix catalogue OPSO) : %d codes seulement, le fichier precedent en portait %d (seuil 80 %%)." % (len(cat), avant))
        sys.exit(1)
    if len(cat) < 1000:
        sys.exit("REFUS (prix catalogue OPSO) : %d codes seulement, valeur anormalement basse." % len(cat))
    body = json.dumps({e: cat[e] for e in sorted(cat)}, separators=(",", ":"))
    out = (
        "// Prix catalogue HT du laboratoire par code 13 — espace OPSO. Un nombre par code : AUCUNE source, année ni niveau.\n"
        "// ⚠️ JAMAIS dans le dépôt public : Supabase `donnees-protegees` uniquement (clé offilogcatopso).\n"
        "// OFFILOG_CAT_OPSO {code13: prix HT} · " + str(len(cat)) + " codes · generate_offilog_prix_catalogue.py\n"
        "var OFFILOG_CAT_OPSO=" + body + ";\n"
    )
    OUT_CAT.write_text(out, encoding="utf-8")
    relu = OUT_CAT.read_text(encoding="utf-8")
    m = re.search(r"^var OFFILOG_CAT_OPSO=(\{.*\});$", relu, re.M)
    back = json.loads(m.group(1)) if m else {}
    ok = bool(m) and back == cat and all(isinstance(v, (int, float)) and v > 0 and len(k) == 13 for k, v in back.items())
    ok = ok and not re.search(r"(19|20)\d\d", relu.replace(m.group(1), "") if m else relu)   # aucune annee hors du corps (les codes en contiennent par hasard)
    ok = ok and all(table[k][2] != "conteste" for k in back)
    print("prix catalogue OPSO ecrits :", OUT_CAT, "-", OUT_CAT.stat().st_size, "octets,", len(cat), "codes (precedent :", avant or "aucun", ") | exclus conteste :", excl)
    print("  relecture prix catalogue OPSO :", "OK" if ok else "ECART !")
    if not ok:
        sys.exit(1)


def main():
    date = None
    args = sys.argv[1:]
    if "--date" in args:
        date = args[args.index("--date") + 1]
    if date is None:
        date = datetime.date.today().isoformat()

    union = produits_offilog()

    pharmazon = read_csv(APP / "OFFILOG" / "catalogue-pharmazon.csv", ";")
    sagitta = [(os.path.basename(p), read_csv(p, ";", "Libellé"))
               for p in sorted(glob.glob(str(APP / "CONCURRENTS" / "SAGITTA" / "*.csv")))]
    ocp = read_csv(APP / "CONCURRENTS" / "OCP" / "ocp-incontournables-2026-09.csv", ",")

    cip7 = collections.defaultdict(set)   # code 7 -> codes 13 (Pharmazon / Sagitta)
    for r in pharmazon:
        c7, c13 = digits(r.get("cip7")), digits(r.get("cip13"))
        if c7 and len(c13) == 13:
            cip7[c7.zfill(7)].add(c13)
    for _, rows in sagitta:
        for r in rows:
            c7, c13 = digits(r.get("CIP7")), digits(r.get("CIP13"))
            if c7 and len(c13) == 13:
                cip7[c7.zfill(7)].add(c13)

    def code13(raw):
        d = digits((raw or "").strip())
        if len(d) == 13:
            return d
        if len(d) == 7:
            eq = cip7.get(d)
            if eq and len(eq) == 1:
                return next(iter(eq))
        return None

    cands = []   # (code, source, annee ou None, valeur)
    rows_par_source = collections.Counter()

    for r in ocp:
        rows_par_source["OCP"] += 1
        c = code13(r.get("code13"))
        v = fnum(r.get("ppht"))
        if c and ctrl_ok(r.get("controle")) and v and v > 0:
            cands.append((c, "OCP", 2026, v))
    for _, rows in sagitta:
        rows_par_source["Sagitta"] += len(rows)
        for r in rows:
            v = fnum(r.get("Prix A HT"))
            if not v or v <= 0:
                continue
            for c in dict.fromkeys(x for x in (code13(r.get("CIP13")), code13(r.get("EAN13"))) if x):
                cands.append((c, "Sagitta", 2026, v))
    rows_par_source["Pharmazon"] += len(pharmazon)
    for r in pharmazon:
        v = fnum(r.get("Prix"))
        if not v or v <= 0:
            continue
        for c in dict.fromkeys(x for x in (code13(r.get("cip13")), code13(r.get("EAN"))) if x):
            cands.append((c, "Pharmazon", 2026, v))

    # datation des tableaux de laboratoire (annee par document)
    dat = {}
    dat_path = DPGS / "DATATION-2026-09-27.tsv"
    if dat_path.exists():
        for ln in open(dat_path, encoding="utf-8"):
            p = ln.rstrip("\n").split("\t")
            if len(p) >= 4 and re.fullmatch(r"(19|20)\d\d", p[0]):
                dat[p[3]] = int(p[0])

    def row_year(r):
        for c in ("annee", "millesime"):
            v = (r.get(c) or "").strip()
            if re.fullmatch(r"(?:19|20)\d\d", v):
                return int(v)
        if r.get("document") in dat:
            return dat[r["document"]]
        ys = re.findall(r"(?:19|20)\d\d", " ".join((r.get(c) or "") for c in ("periode", "colonne_prix")))
        return max(int(y) for y in ys) if ys else None

    fichiers = sorted(glob.glob(str(DPGS) + "/*.csv"))
    if not fichiers:
        sys.exit("ERREUR : aucun tableau DPGS lu dans %s/" % DPGS)
    for f in fichiers:
        bn = os.path.basename(f)
        if bn in NO_PRICE_FILES:
            continue
        src = bn.split("-2026-")[0]
        if src in EXCLUES:
            continue
        rows = read_csv(f)
        if not rows:
            continue
        rows_par_source[src] += len(rows)
        pcol = PRICE_COL.get(src, "prix")
        cc = "controle" if "controle" in rows[0] else ("coherence" if "coherence" in rows[0] else None)
        for r in rows:
            if src == "OCP-MARQUE-CONSEIL" and "TTC" in (r.get("nature") or ""):
                continue   # tarif LPPR TTC (remboursement), pas un prix catalogue HT
            c = code13(r.get("code_produit"))
            if not c or (cc and not ctrl_ok(r.get(cc))):
                continue
            v = fnum(r.get(pcol))
            if v and v > 0:
                cands.append((c, src, row_year(r), v))

    # tarifs PDF de laboratoire (lus ici) ; les sources de dernier recours (URGO) sont tenues a part
    labo, labo_lignes, labo_stats = lire_tarifs_labo()
    for src, an, nb, rej in labo_stats:
        print("tarif %-12s %d : %4d codes lus | %3d lignes a code non lues" % (src, an, nb, rej))
    for s_, n_ in labo_lignes.items():
        rows_par_source[s_] += n_
    recours = [k for k in labo if k[1] in DERNIER_RECOURS]
    cands += [k for k in labo if k[1] not in DERNIER_RECOURS]
    deja_porte = {k[0] for k in cands}
    cands += [k for k in recours if k[0] not in deja_porte]   # aucune autre source ne porte le code

    # rang de depart des sources
    autres = sorted([s for s in rows_par_source if s not in ORDRE], key=lambda s: (-rows_par_source[s], s))
    RANK = {s: i for i, s in enumerate(ORDRE)}
    for i, s in enumerate(autres):
        RANK[s] = len(ORDRE) + i

    par_code = collections.defaultdict(list)
    for c, s, a, v in cands:
        if c in union:
            par_code[c].append((s, a, round(v, 4)))

    def proche(a, b, tol):
        return abs(a - b) <= tol * a + 1e-12

    table = {}
    src_utilisees = []
    for code, cl in par_code.items():
        cl = sorted(set(cl), key=lambda k: (-(k[1] if k[1] else -1), RANK[k[0]], k[2]))
        s, a, v = cl[0]
        autres_src = [k for k in cl if k[0] != s]
        confirme = any(proche(v, k[2], 0.01) for k in autres_src)
        dissid = any(k[1] is not None and a is not None and abs(k[1] - a) <= 1 and not proche(v, k[2], 0.05) for k in cl[1:])
        if confirme:
            niveau = "confirme"
        elif len({k[0] for k in cl}) == 1 and len({(k[1], k[2]) for k in cl}) == 1:
            niveau = "seul"
        elif dissid:
            niveau = "conteste"
        else:
            niveau = "proche"
        nb = 1 + len({k[0] for k in autres_src if proche(v, k[2], 0.05)})
        if s not in src_utilisees:
            src_utilisees.append(s)
        if s in DERNIER_RECOURS or s in A_VERIFIER:
            niveau = "conteste"   # « a verifier » : jamais presente comme un prix sur
        table[code] = [v, a if a else 0, niveau, s, nb]

    ordre_src = sorted(src_utilisees, key=lambda s: RANK[s])
    idx = {s: i for i, s in enumerate(ordre_src)}
    for t in table.values():
        t[3] = idx[t[3]]

    # garde-fou volume
    avant = 0
    if OUT.exists():
        avant = OUT.read_text(encoding="utf-8").count('":[')
    if avant and len(table) < 0.8 * avant:
        print("REFUS : %d codes seulement, le fichier precedent en portait %d (seuil 80 %%)." % (len(table), avant))
        sys.exit(1)

    body = json.dumps({e: table[e] for e in sorted(table)}, separators=(",", ":"), ensure_ascii=False)
    out = (
        "// Prix catalogue HT des laboratoires (avant reduction) par code 13 — TARIFS DE TIERS\n"
        "// ⚠️ JAMAIS dans le dépôt public : Supabase `donnees-protegees` uniquement. Jamais chargé côté OPSO.\n"
        "// OFFILOG_PRIX_CAT {code13: [prix HT, année du tarif (0 = sans date), niveau, index de OFFILOG_PRIX_CAT_SRC, nb de sources d'accord à ±5 %]}\n"
        "// niveau : confirme | proche | seul | conteste. Aucun prix Offilog ici : le pourcentage se calcule dans la page.\n"
        "// relevé " + date + " · " + str(len(table)) + " codes · generate_offilog_prix_catalogue.py\n"
        "var OFFILOG_PRIX_CAT=" + body + ";\n"
        "var OFFILOG_PRIX_CAT_SRC=" + json.dumps(ordre_src, ensure_ascii=False) + ";\n"
        "var OFFILOG_PRIX_CAT_MAJ=" + json.dumps(date) + ";\n"
    )
    OUT.write_text(out, encoding="utf-8")

    # relecture de controle : le fichier ecrit doit porter autant d'entrees, valeurs identiques
    relu = OUT.read_text(encoding="utf-8")
    m = re.search(r"^var OFFILOG_PRIX_CAT=(\{.*\});$", relu, re.M)
    back = json.loads(m.group(1)) if m else {}
    ok = bool(m) and back == {e: table[e] for e in table} and relu.count('":[') == len(table)
    niv = collections.Counter(t[2] for t in table.values())
    print("produits Offilog (EAN 13) :", len(union))
    print("ecrit :", OUT, "-", OUT.stat().st_size, "octets,", len(table), "codes (precedent :", avant or "aucun", "), releve", date)
    print("couverture :", len(table), "/", len(union), "= %.1f %%" % (100 * len(table) / len(union)))
    print("niveaux :", dict(niv), "| sans date :", sum(1 for t in table.values() if not t[1]), "| avant 2026 :", sum(1 for t in table.values() if t[1] and t[1] < 2026))
    print("source retenue :", {ordre_src[i]: n for i, n in collections.Counter(t[3] for t in table.values()).most_common()})
    print("relecture :", "OK" if ok else "ECART !")
    if not ok:
        sys.exit(1)
    ecrire_cat_opso(table)


if __name__ == "__main__":
    main()

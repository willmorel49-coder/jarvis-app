#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_generiqueurs.py
========================
Construit une table CIP13 -> Genriqueur (laboratoire titulaire de l'AMM)
pour les medicaments GENERIQUES, a partir de la Base de Donnees Publique
des Medicaments (BDPM, gratuite, sans cle).

Sortie :
    crm/v2/generiqueurs-data.js  ->  window.GENERIQUEURS = {"<cip13>":"<Generiqueur>", ...}

Sources BDPM (fichiers texte tab-delimites, telechargeables sans cle) :
    - CIS_bdpm.txt        : [0]=CIS, [10]=titulaire (entreprise AMM = genriqueur)
    - CIS_CIP_bdpm.txt    : [0]=CIS, [6]=CIP13 (13 chiffres)
    - CIS_GENER_bdpm.txt  : [2]=CIS, [3]=type (0=princeps/referent, 1/2/4=generique)

Logique :
    Generique = CIS present dans CIS_GENER avec type != 0.
    Pour chaque CIS generique : titulaire (CIS_bdpm) normalise -> genriqueur ;
    CIP13 (CIS_CIP) -> cle (13 chiffres exacts, zeros de tete conserves).

Python 3.9 strict (pas de type hints X | Y).
"""

import os
import re
import sys
import json
import glob

# --------------------------------------------------------------------------
# Chemins
# --------------------------------------------------------------------------
APP_DIR = "/Users/williammorel/JARVIS/APP"
SCRATCH = "/private/tmp/claude-501/-Users-williammorel/f4b1647e-ffce-439a-9a3a-39081571be45/scratchpad"
OUT_JS = os.path.join(APP_DIR, "crm", "v2", "generiqueurs-data.js")
STATS_GLOB = os.path.join(APP_DIR, "STATS", "*_0[1-6]_2026.xlsx")

BDPM_BASE = "https://base-donnees-publique.medicaments.gouv.fr/download/file/"
BDPM_FILES = ["CIS_bdpm.txt", "CIS_CIP_bdpm.txt", "CIS_GENER_bdpm.txt"]


# --------------------------------------------------------------------------
# Telechargement (cache dans le scratchpad)
# --------------------------------------------------------------------------
def ensure_bdpm():
    """Retourne le repertoire contenant les 3 fichiers BDPM, les telecharge si absents."""
    try:
        import urllib.request
    except ImportError:
        urllib = None
    src_dir = SCRATCH if os.path.isdir(SCRATCH) else APP_DIR
    for name in BDPM_FILES:
        path = os.path.join(src_dir, name)
        if os.path.isfile(path) and os.path.getsize(path) > 10000:
            continue
        url = BDPM_BASE + name
        sys.stderr.write("Telechargement %s ...\n" % url)
        import urllib.request
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        with open(path, "wb") as f:
            f.write(data)
    return src_dir


# --------------------------------------------------------------------------
# Lecture robuste (latin-1 lit toujours sans erreur ; on ne garde que du texte
# ou des chiffres selon les colonnes utilisees).
# --------------------------------------------------------------------------
def read_rows(path):
    with open(path, "r", encoding="latin-1") as f:
        for line in f:
            yield line.rstrip("\n").rstrip("\r").split("\t")


CIP13_RE = re.compile(r"^\d{13}$")


# --------------------------------------------------------------------------
# Normalisation du titulaire -> nom de genriqueur court
# --------------------------------------------------------------------------
# Mapping par mot-cle (recherche insensible a la casse dans le titulaire brut).
# Ordre important : la premiere cle trouvee gagne.
KEYWORD_MAP = [
    ("BIOGARAN", "Biogaran"),
    ("EUROGENERICS", "EG Labo"),
    ("EG LABO", "EG Labo"),
    ("ZENTIVA", "Zentiva"),
    ("VIATRIS", "Viatris"),
    ("MYLAN", "Viatris"),
    ("ARROW", "Arrow"),
    ("TEVA", "Teva"),
    ("SANDOZ", "Sandoz"),
    ("CRISTERS", "Cristers"),
    ("ZYDUS", "Zydus"),
    ("SUBSTIPHARM", "Substipharm"),
    ("SUN PHARMA", "Sun"),
    ("ACCORD", "Accord"),
    ("KRKA", "Krka"),
    ("ALMUS", "Almus"),
    ("BGRLAB", "BGR"),
    ("BGR", "BGR"),
    ("SANOFI", "Sanofi"),
    ("SERVIER", "Servier"),
]

# Whitelist de mots-cles identifiant un titulaire PUR GENERIQUEUR.
# Sert au 2e passage (extension) : la BDPM (fichier GENER) ne flague pas
# tous les generiques reellement vendus ; on rattrape les CIP13 dont le
# titulaire est un generiqueur reconnu meme s'il est absent du fichier GENER.
# Ne contient QUE des laboratoires generiqueurs (jamais un labo de princeps
# comme Sanofi/Servier/Almirall/Pierre Fabre), pour ne pas polluer la table.
GENERIQUEUR_WHITELIST = [
    "BIOGARAN", "EUROGENERICS", "EG LABO", "ZENTIVA", "VIATRIS", "MYLAN",
    "ARROW", "TEVA", "SANDOZ", "CRISTERS", "ZYDUS", "SUBSTIPHARM",
    "SUN PHARMA", "ACCORD", "KRKA", "ALMUS", "BGR", "REDDY", "EVOLUPHARM",
    "EUGIA",
]

# Suffixes juridiques a retirer en fin de nom (pour les titulaires non mappes).
JURIDIC_SUFFIXES = [
    "LABORATOIRES", "LABORATOIRE", "LABO", "PHARMACEUTICALS", "PHARMACEUTICAL",
    "PHARMA", "SANTE", "FRANCE", "SASU", "SAS", "SARL", "SA", "GMBH", "LTD",
    "BV", "AG", "SPA", "SRL", "INTERNATIONAL", "GENERIQUES", "GENERICS",
    "EUROPE", "GROUP", "GROUPE",
]


def normalize_titulaire(raw):
    if raw is None:
        return ""
    up = raw.strip().upper()
    up = re.sub(r"\s+", " ", up)
    for kw, nice in KEYWORD_MAP:
        if kw in up:
            return nice
    # Retire les parentheses (pays d'origine, ex: "(ALLEMAGNE)", "(IRL)").
    up = re.sub(r"\([^)]*\)", " ", up)
    # Nettoyage generique : retire ponctuation de bord, suffixes juridiques.
    clean = re.sub(r"[.,;/]", " ", up)
    clean = re.sub(r"\s+", " ", clean).strip()
    tokens = clean.split(" ")
    # Retire les suffixes juridiques en fin de chaine (possiblement plusieurs).
    changed = True
    while changed and len(tokens) > 1:
        changed = False
        if tokens[-1] in JURIDIC_SUFFIXES:
            tokens.pop()
            changed = True
    name = " ".join(tokens).strip()
    if not name:
        name = clean
    # Titlecase propre.
    return titlecase(name)


def titlecase(s):
    out = []
    for w in s.split(" "):
        if not w:
            continue
        if len(w) <= 3 and w.isalpha() and w == w.upper():
            # sigle court (ex: EG, IPCA) -> garde en majuscules
            out.append(w)
        else:
            out.append(w[:1].upper() + w[1:].lower())
    return " ".join(out)


# --------------------------------------------------------------------------
# Construction
# --------------------------------------------------------------------------
def build():
    src_dir = ensure_bdpm()
    p_cis = os.path.join(src_dir, "CIS_bdpm.txt")
    p_cip = os.path.join(src_dir, "CIS_CIP_bdpm.txt")
    p_gen = os.path.join(src_dir, "CIS_GENER_bdpm.txt")

    # 1) CIS generiques (type != 0)
    generic_cis = set()
    for cols in read_rows(p_gen):
        if len(cols) < 4:
            continue
        cis = cols[2].strip()
        typ = cols[3].strip()
        if not cis or not typ:
            continue
        if typ != "0":
            generic_cis.add(cis)

    # 2) CIS -> titulaire (brut upper + nom normalise)
    cis_titulaire = {}     # cis -> nom normalise
    cis_is_gennaire = {}   # cis -> True si titulaire = generiqueur whitelist
    for cols in read_rows(p_cis):
        if len(cols) < 11:
            continue
        cis = cols[0].strip()
        titulaire = cols[10]
        if not cis:
            continue
        cis_titulaire[cis] = normalize_titulaire(titulaire)
        up = (titulaire or "").upper()
        cis_is_gennaire[cis] = any(k in up for k in GENERIQUEUR_WHITELIST)

    # 3) CIS -> CIP13
    #    Passage 1 : CIS generiques (regle BDPM officielle, type != 0).
    #    Passage 2 : CIS absents du fichier GENER mais dont le titulaire est un
    #                generiqueur reconnu (rattrapage des generiques que la BDPM
    #                n'a pas flagues). Marque comme 'ext'.
    result = {}
    n_cip_rows = 0
    n_ext = 0
    for cols in read_rows(p_cip):
        if len(cols) < 7:
            continue
        cis = cols[0].strip()
        cip13 = cols[6].strip()
        if not CIP13_RE.match(cip13):
            continue
        lab = cis_titulaire.get(cis)
        if not lab:
            continue
        if cis in generic_cis:
            n_cip_rows += 1
            result[cip13] = lab
        elif cis_is_gennaire.get(cis):
            n_ext += 1
            result.setdefault(cip13, lab)

    return generic_cis, result, n_cip_rows, n_ext


# --------------------------------------------------------------------------
# Validation contre les ventes reelles
# --------------------------------------------------------------------------
def validate(result):
    import pandas as pd
    files = sorted(glob.glob(STATS_GLOB))
    total = 0
    found = 0
    sample_missing = []
    for fp in files:
        try:
            df = pd.read_excel(fp, usecols=["ARTNATURE", "ARTCODEBARRE"])
        except Exception as e:
            sys.stderr.write("skip %s (%s)\n" % (fp, e))
            continue
        mask = df["ARTNATURE"].astype(str).str.contains("enerique", case=False, na=False)
        sub = df[mask]
        for cb in sub["ARTCODEBARRE"].dropna():
            try:
                cip = str(int(float(cb))).zfill(13)
            except (ValueError, TypeError):
                cip = str(cb).strip()
                if not cip.isdigit():
                    continue
                cip = cip.zfill(13)
            if len(cip) != 13:
                continue
            total += 1
            if cip in result:
                found += 1
            elif len(sample_missing) < 15:
                sample_missing.append(cip)
    pct = (100.0 * found / total) if total else 0.0
    return total, found, pct, sample_missing, len(files)


# --------------------------------------------------------------------------
# Ecriture du .js
# --------------------------------------------------------------------------
def write_js(result):
    # tri par cle pour un diff stable
    ordered = {k: result[k] for k in sorted(result.keys())}
    payload = json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("window.GENERIQUEURS = " + payload + ";\n")
    return os.path.getsize(OUT_JS)


def main():
    generic_cis, result, n_cip_rows, n_ext = build()
    size = write_js(result)

    # Stats
    from collections import Counter
    labs = Counter(result.values())
    print("=" * 60)
    print("BDPM -> generiqueurs")
    print("=" * 60)
    print("CIS generiques (type!=0)      : %d" % len(generic_cis))
    print("Lignes CIP13 de generiques    : %d" % n_cip_rows)
    print("CIP13 rattrapes (titulaire)   : %d" % n_ext)
    print("CIP13 mappes                  : %d" % len(result))
    print("Generiqueurs distincts        : %d" % len(labs))
    print("Fichier .js                   : %s (%d octets)" % (OUT_JS, size))
    print("-" * 60)
    print("TOP 15 generiqueurs par nb de CIP :")
    for i, (name, n) in enumerate(labs.most_common(15), 1):
        print("  %2d. %-24s %6d" % (i, name, n))
    print("-" * 60)

    # Validation ventes reelles
    try:
        total, found, pct, missing, nfiles = validate(result)
        print("VALIDATION ventes reelles (%d fichiers STATS)" % nfiles)
        print("  Lignes generiques (CIP13) : %d" % total)
        print("  Trouvees dans la table    : %d" % found)
        print("  COUVERTURE                : %.2f%%" % pct)
        if missing:
            print("  Exemples CIP non trouves  : %s" % ", ".join(missing[:10]))
    except Exception as e:
        print("Validation impossible : %s" % e)


if __name__ == "__main__":
    main()

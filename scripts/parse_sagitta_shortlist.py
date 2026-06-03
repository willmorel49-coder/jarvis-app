#!/usr/bin/env python3
"""Parse SHORT LIST NR - LNR PDF Sagitta -> crm/sagitta-shortlist-data.js

Extrait pour chaque produit : nom, laboratoire, CIP13, prix barre,
prix remise Sagitta, % remise, % trophee bonus eventuel.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

PDF = Path("CONCURRENTS/SAGITTA/SHORTLIST NR.pdf")
OUT = Path("crm/sagitta-shortlist-data.js")


def extract_text(pdf_path):
    r = subprocess.run(
        ["pdftotext", "-layout", str(pdf_path), "-"],
        capture_output=True, text=True, check=True
    )
    return r.stdout


def parse(text):
    """Le PDF Sagitta a un layout colonnaire : chaque produit fait un bloc
    de ~5-7 lignes avec nom, labo, categorie, prix barre, prix remise, CIP.
    On scan ligne par ligne et on agrege.
    """
    products = []
    # Regroupe en lignes propres
    lines = [l.rstrip() for l in text.split("\n")]

    # Etat courant
    cur = None
    last_pct_trophy = None
    last_pct_remise = None

    # On parcourt en cherchant des CIP13 (13 chiffres commencant par 34 ou 37 ou 40)
    cip_re = re.compile(r"\b(3[4-9]\d{11}|4\d{12})\b")
    prix_re = re.compile(r"(\d{1,3}[,.]\d{2})\s*€")
    pct_re  = re.compile(r"(\d{1,2})\s*%")

    # On itere par produit : un produit = "nom ligne" + jusqu'a CIP13
    # Strategie : on cumule un buffer jusqu'a rencontrer un CIP13 -> on cree produit
    buf = []
    for line in lines:
        if line.strip() == "":
            continue
        # Skip headers / footers
        if "Bienvenue sur PHARMAREM" in line:
            continue
        if "lacentralepharma.com" in line:
            continue
        if "Page " in line and "sur 27" in line:
            continue
        if line.strip() in ("FILTRER", "Trier par"):
            continue
        if re.match(r"^\s*Par laboratoires\b", line):
            continue
        if re.match(r"^\s*Par catégories\b", line):
            continue

        buf.append(line)
        m = cip_re.search(line)
        if m:
            block = "\n".join(buf)
            buf = []
            prod = parse_block(block, m.group(1))
            if prod:
                products.append(prod)

    # Dedup par CIP13 (garde le 1er)
    seen = set()
    uniq = []
    for p in products:
        if p["cip13"] in seen:
            continue
        seen.add(p["cip13"])
        uniq.append(p)
    return uniq


LABO_RE = re.compile(r"Laboratoire\s*:\s*([^\n]+?)(?:\s+Prix\b|$)")
CAT_RE  = re.compile(r"Catégorie\s*:\s*([^\n]+?)(?=\n|$)", re.S)
PRIX_BARRE_RE = re.compile(r"Prix\s+(\d{1,3}[,.]\d{2})\s*€")
PRIX_REMISE_RE = re.compile(r"Prix\s+remis[ée]\s*\n?\s*(\d{1,3}[,.]\d{2})\s*€", re.M)
PCT_TROPHY_RE = re.compile(r"(\d{1,2})\s*%\s*\n.*?(\d{1,2})\s*%", re.S)
PCT_SIMPLE_RE = re.compile(r"(\d{1,2})\s*%")


def num(s):
    return float(s.replace(",", "."))


def parse_block(block, cip):
    # On garde les lignes AVEC leur indentation (pdftotext -layout preserve les colonnes)
    raw_lines = block.split("\n")

    # Cherche la ligne "Laboratoire :" (premiere occurrence)
    labo_idx = None
    for i, l in enumerate(raw_lines):
        if "Laboratoire" in l and ":" in l:
            labo_idx = i
            break

    # Le nom est la derniere ligne non vide AVANT labo_idx
    # qui est positionnee dans la COLONNE CENTRE (indent >= 50 caracteres,
    # le menu gauche occupe les colonnes 0-50).
    name = ""
    if labo_idx is not None:
        for j in range(labo_idx - 1, -1, -1):
            l = raw_lines[j]
            if not l.strip():
                continue
            # Mesure l'indentation
            indent = len(l) - len(l.lstrip())
            # Doit etre dans la colonne du produit (indent >= 60)
            if indent < 50:
                continue
            cand = l.strip()
            # Skip "Catégorie" et autres metadata
            if cand.startswith(("Catégorie", "Prix ", "3", "4")) and not re.match(r"^[A-Z]{3,}", cand):
                continue
            name = cand
            break

    name = re.sub(r"\s+", " ", name).strip()
    # Enleve le suffixe pourcentage (ex: "PRODUIT 15 ml 14 %")
    name = re.sub(r"\s*\d{1,2}\s*%\s*$", "", name).strip()
    # Filtre noms qui sont en fait du chrome
    if name.startswith("Par ") or name.startswith("Catégorie"):
        return None
    if "Laboratoire" in name:
        return None
    if len(name) < 6:
        return None
    # Doit commencer par >= 3 majuscules (vrai nom de produit pharma)
    if not re.match(r"^[A-ZÉÈÊÀÂÎÔÛÇ&-]{3,}", name):
        return None

    # Labo
    labo = ""
    m = LABO_RE.search(block)
    if m:
        labo = re.sub(r"\s+", " ", m.group(1)).strip()
        labo = re.sub(r"\s*Prix\s+\d.*$", "", labo).strip()

    # Prix barre
    prix_barre = None
    m = re.search(r"Prix\s+(\d{1,3}[,.]\d{2})\s*€", block)
    if m:
        prix_barre = num(m.group(1))

    # Prix remise : recherche du nombre apres "Prix remisé"
    prix_remise = None
    m = re.search(r"Prix\s+remis[ée][^\d]*(\d{1,3}[,.]\d{2})\s*€", block, re.S)
    if m:
        prix_remise = num(m.group(1))

    # Pourcentages : on cherche tous les % du bloc
    pcts = [int(x) for x in PCT_SIMPLE_RE.findall(block)]
    pct_remise = pcts[0] if pcts else None
    pct_trophy = pcts[1] if len(pcts) >= 2 else None

    # Categorie (on filtre "SHORT LIST NR - LNR")
    categorie = ""
    m = CAT_RE.search(block)
    if m:
        c = re.sub(r"\s+", " ", m.group(1)).strip()
        # nettoie : enleve "SHORT LIST NR - LNR" en debut
        c = re.sub(r"^Catégorie\s*:\s*", "", c)
        c = c.replace("SHORT LIST NR - LNR", "").strip(" ,-•·")
        categorie = c

    return {
        "name": name,
        "labo": labo,
        "categorie": categorie,
        "cip13": cip,
        "prix_barre": prix_barre,
        "prix_sagitta": prix_remise,
        "remise_pct": pct_remise,
        "bonus_pct": pct_trophy,
    }


def main():
    if not PDF.exists():
        print(f"PDF introuvable : {PDF}", file=sys.stderr)
        sys.exit(1)
    text = extract_text(PDF)
    products = parse(text)
    print(f"Extracted : {len(products)} produits")
    if products:
        print("Sample :", json.dumps(products[0], ensure_ascii=False))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        f.write("// SAGITTA - SHORT LIST NR - LNR (parsed from PDF)\n")
        f.write(f"// Total : {len(products)} produits\n")
        f.write("const SAGITTA_SHORTLIST = ")
        f.write(json.dumps(products, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
    print(f"-> {OUT}")


if __name__ == "__main__":
    main()

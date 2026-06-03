#!/usr/bin/env python3
"""Parse MARKETING/L'integral.pdf + MARKETING/CATALOGUE ITP JUIN 2026 REPART2.pdf
-> crm/catalogues-marketing-data.js

Extrait des codes (CIP7 / CIP13 / EAN13) pour permettre filtrage Top ventes.
"""
import json
import re
import subprocess
import sys
from pathlib import Path


PDF_INT = Path("MARKETING/L'integral.pdf")
PDF_ITP = Path("MARKETING/CATALOGUE ITP JUIN 2026 REPART2.pdf")
OUT = Path("crm/catalogues-marketing-data.js")


def extract_text(pdf_path):
    r = subprocess.run(
        ["pdftotext", "-layout", str(pdf_path), "-"],
        capture_output=True, text=True, check=True
    )
    return r.stdout


# CIP7 = 7 chiffres (ancien systeme officinal), CIP13/EAN13 = 13 chiffres
CIP7_RE = re.compile(r"\b(\d{7})\b")
CIP13_RE = re.compile(r"\b(\d{13})\b")


def parse_integral(text):
    """L'integral : table avec col gauche CIP7 ou CIP13, libelle, prix HT.
    Format : whitespace + CODE + whitespace + LIBELLE + whitespace + PRIX €

    On scan ligne par ligne et on extrait les codes.
    """
    items = []
    lines = text.split("\n")
    section = ""

    # Sections detectees en majuscules sans chiffres
    section_re = re.compile(r"^\s*([A-ZÉÈÊÀÂÎÔÛÇ]{4,}(?:\s+[A-ZÉÈÊÀÂÎÔÛÇ-]+){0,4})\s*$")

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            continue
        # Detection section
        m_sec = section_re.match(line)
        if m_sec and "€" not in line and "Tarif" not in line:
            cand = m_sec.group(1).strip()
            if len(cand) >= 5 and not any(c.isdigit() for c in cand):
                section = cand
                continue

        # Cherche un code (CIP13 prioritaire, sinon CIP7) en debut de ligne
        # apres des espaces
        stripped = line.strip()
        code = None
        # CIP13 d'abord (plus specifique)
        m13 = re.match(r"^(\d{13})\b", stripped)
        if m13:
            code = m13.group(1)
        else:
            m7 = re.match(r"^(\d{7})\b", stripped)
            if m7:
                code = m7.group(1)
        if not code:
            continue
        # Extrait le libelle (texte entre code et prix)
        rest = stripped[len(code):].strip()
        # Cherche le prix en fin de ligne
        m_prix = re.search(r"([\d ]+[.,]\d{2})\s*€?\s*$", rest)
        if m_prix:
            libelle = rest[:m_prix.start()].strip()
            try:
                prix = float(m_prix.group(1).replace(" ", "").replace(",", "."))
            except ValueError:
                prix = None
        else:
            libelle = rest
            prix = None
        if not libelle or len(libelle) < 3:
            continue
        items.append({
            "code": code,
            "libelle": libelle[:120],
            "prix": prix,
            "section": section,
        })
    return items


def parse_itp(text):
    """ITP catalogue (dispositifs medicaux, pansements ConvaTec/Coloplast/…).
    Pas d'EAN13 ni de structure unique parsable. Strategie pragmatique :
    extraction des SECTIONS gamme (en-tetes type 'PANSEMENTS - X') + tous les
    blocs PPHT pour compter les produits.
    """
    items = []
    # Sections gamme : 'PANSEMENTS - CONVAFOAM' etc.
    sections_re = re.compile(r"PANSEMENTS\s*[-–]\s*([A-Z][A-Z\s&]+)")
    sections = set()
    for m in sections_re.finditer(text):
        s = m.group(1).strip()
        if 2 <= len(s) <= 40:
            sections.add(s)

    # Compte les blocs PPHT pour estimer nb produits
    pphts = re.findall(r"PPHT\s*=\s*([\d,.]+)\s*€", text)
    # Pour chaque PPHT on essaie de capturer le nom produit proche
    # Strategy : decoupe le texte en chunks autour de chaque PPHT
    pphts_with_ctx = []
    for m in re.finditer(r"PPHT\s*=\s*([\d,.]+)\s*€[^\n]*LPPR\s*=\s*([\d,.]+)", text):
        # contexte avant : 200 chars
        idx = m.start()
        ctx_before = text[max(0, idx - 250):idx]
        # cherche le dernier mot tout en MAJ de 4+ lettres en fin de contexte
        names = re.findall(r"\b([A-Z][A-Z&\-]{3,}(?:\s+[A-Z0-9][A-Z0-9&\-]+){0,5})\b", ctx_before)
        nom = ""
        for cand in reversed(names):
            cand_clean = cand.strip()
            if cand_clean.startswith(("PPHT", "LPPR", "TVA", "EAN", "PRIX", "REMISE")):
                continue
            if "PANSEMENT" in cand_clean and len(cand_clean) < 12:
                continue
            nom = cand_clean[:60]
            break
        try:
            ppht_f = float(m.group(1).replace(",", "."))
            lppr_f = float(m.group(2).replace(",", "."))
        except ValueError:
            continue
        if nom:
            pphts_with_ctx.append({
                "nom": nom,
                "ppht": ppht_f,
                "lppr": lppr_f,
                "remise_pct": 5,
            })
    # Dedup
    seen = set()
    items = []
    for it in pphts_with_ctx:
        key = it["nom"] + "_" + str(it["ppht"])
        if key in seen:
            continue
        seen.add(key)
        items.append(it)
    items.append({"_sections": sorted(sections), "_total_pphts": len(pphts)})
    return items


def itp_keywords(items):
    """Construit un set de mots-cles uniques pour matcher BENCHMARK / OFFILOG.
    Ex: 'CONVAFOAM', 'AQUACEL', 'MEPILEX', 'CONVATEC', etc.
    """
    kw = set()
    # Mots-cles connus dispositifs ITP/ConvaTec/Coloplast/Molnlycke/Urgo etc.
    common_brands = [
        "CONVAFOAM", "AQUACEL", "DUODERM", "VARIHESIVE", "GRANUFLEX", "STOMAHESIVE",
        "COMBIHESIVE", "ESTEEM", "ACTIVE LIFE", "NATURA", "SUR-FIT", "MOLDABLE",
        "MEPILEX", "MEPITEL", "MEPORE", "MEPILACE", "MEPISORB", "EXUFIBER",
        "URGOTUL", "URGOSTART", "URGOCLEAN", "URGOSORB", "URGOTRACT",
        "COMFEEL", "BIATAIN", "PUROL", "ASSURA", "SENSURA", "PEAKHOLD",
        "ALLEVYN", "ACTICOAT", "INTRASITE", "BACTIGRAS", "OPSITE",
        "TIELLE", "KALTOSTAT", "KENDALL", "ROLLER", "ZETUVIT",
    ]
    for kb in common_brands:
        kw.add(kb)
    # Ajoute aussi les noms extraits
    for it in items:
        if "nom" not in it:
            continue
        words = re.findall(r"[A-Z]{4,}", it["nom"])
        for w in words:
            if len(w) >= 5 and w not in ("PROD", "AVEC", "POUR", "SANS", "PANSEMENT",
                                          "BOITE", "TUBE", "FOAM", "BAND",
                                          "SMALL", "LARGE", "MEDIUM", "FRANCE",
                                          "EXTRA", "PLUS", "MULTI", "DUO"):
                kw.add(w)
    return sorted(kw)


def main():
    integral_items = []
    itp_items = []

    if PDF_INT.exists():
        print(f"Parse {PDF_INT}…")
        integral_items = parse_integral(extract_text(PDF_INT))
        # Dedup par code
        seen = set()
        uniq = []
        for it in integral_items:
            if it["code"] in seen:
                continue
            seen.add(it["code"])
            uniq.append(it)
        integral_items = uniq
        print(f"  -> {len(integral_items)} items L'INTEGRAL")
    else:
        print(f"!! {PDF_INT} introuvable")

    if PDF_ITP.exists():
        print(f"Parse {PDF_ITP}…")
        itp_items = parse_itp(extract_text(PDF_ITP))
        print(f"  -> {len(itp_items)} items CATALOGUE ITP")
    else:
        print(f"!! {PDF_ITP} introuvable")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        f.write("// Catalogues marketing — L'Integral + Catalogue ITP\n")
        f.write(f"// L'Integral : {len(integral_items)} produits (codes CIP7/CIP13)\n")
        f.write(f"// Catalogue ITP : {len(itp_items)} produits (EAN13)\n")
        f.write("// Genere par scripts/parse_catalogues_marketing.py\n")
        f.write("const CATALOGUE_INTEGRAL = ")
        f.write(json.dumps(integral_items, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
        f.write("const CATALOGUE_ITP_MARKETING = ")
        f.write(json.dumps(itp_items, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
        # Set de mots-cles ITP pour matching nom dans BENCHMARK/OFFILOG
        kw = itp_keywords(itp_items)
        f.write("const CATALOGUE_ITP_KEYWORDS = ")
        f.write(json.dumps(kw, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
        # Sets d'index rapides
        f.write("// Sets pour lookup O(1) cote front\n")
        f.write("if (typeof window !== 'undefined') {\n")
        f.write("  window.CATALOGUE_INTEGRAL = CATALOGUE_INTEGRAL;\n")
        f.write("  window.CATALOGUE_ITP_MARKETING = CATALOGUE_ITP_MARKETING;\n")
        f.write("  window.CATALOGUE_ITP_KEYWORDS = CATALOGUE_ITP_KEYWORDS;\n")
        f.write("  window.CATALOGUE_INTEGRAL_CODES = new Set(CATALOGUE_INTEGRAL.map(p => String(p.code)));\n")
        f.write("  // L'INTEGRAL contient parfois des CIP7 (7 chiffres). Pour matcher\n")
        f.write("  // les CIP13 BENCHMARK, on indexe aussi les 7 derniers chiffres.\n")
        f.write("  CATALOGUE_INTEGRAL.forEach(p => {\n")
        f.write("    var c = String(p.code);\n")
        f.write("    if (c.length === 7) window.CATALOGUE_INTEGRAL_CODES.add(c);\n")
        f.write("    if (c.length >= 13) window.CATALOGUE_INTEGRAL_CODES.add(c.slice(-7));\n")
        f.write("  });\n")
        f.write("  // Regex compile des mots-cles ITP pour match nom rapide\n")
        f.write("  window.CATALOGUE_ITP_REGEX = CATALOGUE_ITP_KEYWORDS.length\n")
        f.write("    ? new RegExp('\\\\b(' + CATALOGUE_ITP_KEYWORDS.join('|') + ')\\\\b', 'i')\n")
        f.write("    : null;\n")
        f.write("}\n")
    print(f"-> {OUT}")
    print(f"   ITP keywords : {len(itp_keywords(itp_items))}")


if __name__ == "__main__":
    main()

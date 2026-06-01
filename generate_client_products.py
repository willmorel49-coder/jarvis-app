#!/usr/bin/env python3
"""
Génère crm/client-products.js depuis le fichier XLS de synthèse par article.
Source : STATS/Statistiques de vente par client  Etat de synthèse par article.xls
"""

import xlrd
import json
import os
from collections import defaultdict

XLS_PATH = "/Users/williammorel/JARVIS/APP/STATS/Statistiques de vente par client  Etat de synthèse par article.xls"
OUT_PATH = "/Users/williammorel/JARVIS/APP/crm/client-products.js"
TOP_N = 20


def clean(s):
    """Nettoie les chaînes : retire les caractères nuls et espaces parasites."""
    if isinstance(s, str):
        return s.replace("\x00", "").strip()
    return s


def read_xls(path):
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(0)
    headers = [clean(str(sh.cell_value(0, c))) for c in range(sh.ncols)]
    print(f"Headers détectés : {headers}")

    rows = []
    for r in range(1, sh.nrows):
        row = {}
        for c, h in enumerate(headers):
            val = sh.cell_value(r, c)
            if isinstance(val, str):
                val = clean(val)
            row[h] = val
        rows.append(row)
    return headers, rows


def detect_columns(headers):
    """Détecte les noms de colonnes réels (insensible à la casse / espaces)."""
    mapping = {}
    targets = {
        "SUM_QTE": ["SUM_QTE", "SUMQTE", "QTE", "QUANTITE"],
        "SUM_CA": ["SUM_CA", "SUMCA", "CA", "CHIFFRE"],
        "SUM_MARGE": ["SUM_MARGE", "SUMMARGE", "MARGE"],
        "CLICODE": ["CLICODE", "CIP", "CODE_CLIENT", "CODECLIENT"],
        "CLISOCIETE": ["CLISOCIETE", "SOCIETE", "NOM", "CLIENT"],
        "ARTCODE": ["ARTCODE", "CODE_ARTICLE", "CODEARTICLE", "ART"],
        "ARTDESIGNATION": ["ARTDESIGNATION", "DESIGNATION", "LIBELLE", "DESC"],
    }
    upper_headers = {h.upper().replace(" ", "_").replace("-", "_"): h for h in headers}
    for key, candidates in targets.items():
        for c in candidates:
            if c in upper_headers:
                mapping[key] = upper_headers[c]
                break
        if key not in mapping:
            # Recherche partielle
            for c in candidates:
                for uh, orig in upper_headers.items():
                    if c in uh:
                        mapping[key] = orig
                        break
                if key in mapping:
                    break
    return mapping


def process(rows, col_map):
    # Groupe par CLICODE
    clients = defaultdict(list)
    for row in rows:
        cip_raw = row.get(col_map["CLICODE"], "")
        if isinstance(cip_raw, float):
            cip = str(int(cip_raw))
        else:
            cip = str(cip_raw).strip()

        if not cip or cip == "0":
            continue

        artcode_raw = row.get(col_map["ARTCODE"], "")
        if isinstance(artcode_raw, float):
            artcode = str(int(artcode_raw))
        else:
            artcode = str(artcode_raw).strip()

        designation = str(row.get(col_map["ARTDESIGNATION"], "")).strip()

        ca_raw = row.get(col_map["SUM_CA"], 0)
        try:
            ca = round(float(ca_raw), 2)
        except (ValueError, TypeError):
            ca = 0.0

        qte_raw = row.get(col_map["SUM_QTE"], 0)
        try:
            qte = int(float(qte_raw))
        except (ValueError, TypeError):
            qte = 0

        clients[cip].append({
            "artcode": artcode,
            "designation": designation,
            "qte": qte,
            "ca": ca,
        })

    # Trier chaque client par CA desc, garder top N
    result = {}
    total_ca_map = {}
    for cip, products in clients.items():
        products_sorted = sorted(products, key=lambda x: x["ca"], reverse=True)
        total_ca = round(sum(p["ca"] for p in products_sorted), 2)
        total_ca_map[cip] = total_ca
        result[cip] = products_sorted[:TOP_N]

    return result, total_ca_map


def write_js(client_products, total_ca_map, out_path):
    lines = [
        "// Top produits par client · source STATS detail synthèse par article",
        "// Généré par generate_client_products.py",
        "// Ne pas éditer manuellement — regénérer depuis le script.",
        "",
        "window.CLIENT_PRODUCTS = {",
    ]

    client_keys = sorted(client_products.keys())
    for i, cip in enumerate(client_keys):
        products = client_products[cip]
        comma = "," if i < len(client_keys) - 1 else ""
        lines.append(f'  "{cip}": [')
        for j, p in enumerate(products):
            p_comma = "," if j < len(products) - 1 else ""
            desig_escaped = p["designation"].replace("\\", "\\\\").replace('"', '\\"')
            artcode_escaped = p["artcode"].replace("\\", "\\\\").replace('"', '\\"')
            lines.append(
                f'    {{ artcode: "{artcode_escaped}", designation: "{desig_escaped}", qte: {p["qte"]}, ca: {p["ca"]} }}{p_comma}'
            )
        lines.append(f'  ]{comma}')

    lines.append("};")
    lines.append("")

    # Total CA par client
    lines.append("window.CLIENT_PRODUCTS_TOTAL_CA = {")
    for i, cip in enumerate(client_keys):
        comma = "," if i < len(client_keys) - 1 else ""
        lines.append(f'  "{cip}": {total_ca_map[cip]}{comma}')
    lines.append("};")
    lines.append("")

    content = "\n".join(lines)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)
    return len(content)


def main():
    print(f"Lecture de {XLS_PATH} ...")
    headers, rows = read_xls(XLS_PATH)
    print(f"  {len(rows)} lignes de données lues.")

    col_map = detect_columns(headers)
    print(f"  Colonnes détectées : {col_map}")

    missing = [k for k in ["SUM_CA", "CLICODE", "ARTCODE", "ARTDESIGNATION", "SUM_QTE"] if k not in col_map]
    if missing:
        print(f"ERREUR : colonnes manquantes : {missing}")
        print(f"Headers disponibles : {headers}")
        return

    print("Traitement des données ...")
    client_products, total_ca_map = process(rows, col_map)
    n_clients = len(client_products)
    n_products = sum(len(v) for v in client_products.values())
    print(f"  {n_clients} clients couverts.")
    print(f"  {n_products} produits inclus (top {TOP_N} par client).")

    # Exemple pour le 1er client
    first_cip = sorted(client_products.keys())[0]
    print(f"\nExemple client {first_cip} :")
    for p in client_products[first_cip][:3]:
        print(f"  {p}")

    print(f"\nÉcriture de {OUT_PATH} ...")
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    size = write_js(client_products, total_ca_map, OUT_PATH)
    size_kb = round(size / 1024, 1)
    print(f"  Fichier généré : {OUT_PATH} ({size_kb} Ko)")
    print("\nDONE")


if __name__ == "__main__":
    main()

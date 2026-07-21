#!/usr/bin/env python3
"""
Géocode les 517 pharmacies du CRM via l'API gratuite api-adresse.data.gouv.fr.
Sortie : crm/pharmacies-geo.js — fichier mappant cip -> {lat, lng}.

Usage: python3 geocode_pharmacies.py
"""

import csv
import io
import json
import re
import sys
import urllib.request

CLIENTS_FILE = "crm/clients-data.js"
OUTPUT_FILE = "crm/pharmacies-geo.js"
GEOCODE_URL = "https://data.geopf.fr/geocodage/search/csv/"  # Géoplateforme IGN (remplace la BAN décommissionnée, mêmes colonnes)


def extract_pharmacies(js_path):
    """Extrait les enregistrements pharmacie depuis le fichier JS."""
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Capture les objets {cip:"...", nom:"...", adresse:"...", cp:"...", ville:"..."}
    pattern = re.compile(
        r'\{\s*cip\s*:\s*"([^"]*)"\s*,'
        r'\s*nom\s*:\s*"([^"]*)"\s*,'
        r'\s*adresse\s*:\s*"([^"]*)"\s*,'
        r'\s*cp\s*:\s*"([^"]*)"\s*,'
        r'\s*ville\s*:\s*"([^"]*)"'
    )
    return [
        {"cip": cip, "nom": nom, "adresse": adresse, "cp": cp, "ville": ville}
        for cip, nom, adresse, cp, ville in pattern.findall(content)
    ]


def build_csv(pharmacies):
    """Construit un CSV adapté à l'API : adresse, cp, ville."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["cip", "adresse", "cp", "ville"])
    for p in pharmacies:
        writer.writerow([p["cip"], p["adresse"], p["cp"], p["ville"]])
    return buf.getvalue()


def geocode_bulk(csv_data):
    """POST au endpoint CSV, récupère la réponse géocodée."""
    boundary = "----geocodeboundary"
    body_lines = [
        f"--{boundary}",
        'Content-Disposition: form-data; name="data"; filename="pharmacies.csv"',
        "Content-Type: text/csv",
        "",
        csv_data,
        f"--{boundary}",
        'Content-Disposition: form-data; name="columns"',
        "",
        "adresse",
        f"--{boundary}",
        'Content-Disposition: form-data; name="columns"',
        "",
        "cp",
        f"--{boundary}",
        'Content-Disposition: form-data; name="columns"',
        "",
        "ville",
        f"--{boundary}",
        'Content-Disposition: form-data; name="postcode"',
        "",
        "cp",
        f"--{boundary}--",
        "",
    ]
    body = "\r\n".join(body_lines).encode("utf-8")
    req = urllib.request.Request(
        GEOCODE_URL,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    print(f"[geocode] POST {GEOCODE_URL} ({len(body)//1024} KB)...")
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read().decode("utf-8")


def parse_response(csv_text):
    """Parse la CSV de réponse, retourne {cip: {lat, lng, score, ville_match}}."""
    out = {}
    reader = csv.DictReader(io.StringIO(csv_text))
    for row in reader:
        cip = row.get("cip", "").strip()
        lat = row.get("latitude", "").strip()
        lng = row.get("longitude", "").strip()
        score = row.get("result_score", "").strip()
        if not cip or not lat or not lng:
            continue
        try:
            lat_f = float(lat)
            lng_f = float(lng)
            score_f = float(score) if score else 0
        except ValueError:
            continue
        out[cip] = {
            "lat": round(lat_f, 6),
            "lng": round(lng_f, 6),
            "score": round(score_f, 3),
        }
    return out


def write_output(geo_map, output_path, total):
    """Écrit le fichier JS d'output."""
    matched = len(geo_map)
    pct = (matched / total * 100) if total else 0
    header = (
        f"// JARVIS · pharmacies-geo.js\n"
        f"// Géocodage des pharmacies via api-adresse.data.gouv.fr.\n"
        f"// Généré par geocode_pharmacies.py.\n"
        f"// {matched} / {total} pharmacies géocodées ({pct:.1f}%).\n\n"
    )
    body = (
        "window.PHARMACIES_GEO = "
        + json.dumps(geo_map, ensure_ascii=False, indent=2, sort_keys=True)
        + ";\n"
    )
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(header + body)
    print(f"[geocode] {matched}/{total} pharmacies écrites dans {output_path}")


def main():
    print("[geocode] Lecture des pharmacies...")
    pharmacies = extract_pharmacies(CLIENTS_FILE)
    print(f"[geocode] {len(pharmacies)} pharmacies trouvées dans {CLIENTS_FILE}")
    if not pharmacies:
        print("[geocode] AUCUNE pharmacie trouvée — vérifie le regex d'extraction.")
        sys.exit(1)

    csv_data = build_csv(pharmacies)
    response = geocode_bulk(csv_data)
    geo_map = parse_response(response)
    write_output(geo_map, OUTPUT_FILE, len(pharmacies))


if __name__ == "__main__":
    main()

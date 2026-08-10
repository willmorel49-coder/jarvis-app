#!/usr/bin/env python3
"""
Generate crm/clients-data.js from CRM INTEGRAL PHARMA.csv
"""
import csv, re, os, sys, json
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).parent
SRC  = str(BASE / 'CRM INTEGRAL PHARMA.csv')
OUT  = str(BASE / 'crm' / 'clients-data.js')

def parse_euros(val):
    if not val: return 0
    digits = re.sub(r'[^\d]', '', str(val))
    return int(digits) if digits else 0

def js_str(s):
    return str(s or '').strip().replace('\\','\\\\').replace('"','\\"')

if not os.path.exists(SRC):
    print(f'ERREUR : fichier source introuvable → {SRC}')
    sys.exit(1)

# Try multiple encodings
raw = None
for enc in ('utf-8-sig', 'latin-1', 'cp1252'):
    try:
        with open(SRC, encoding=enc, errors='replace') as f:
            raw = f.read()
        break
    except Exception:
        continue

if raw is None:
    print(f'ERREUR : impossible de lire {SRC}')
    sys.exit(1)


def repare_accents(t):
    """Repare les accents massacres a l'export du CRM.

    Le CSV source est un UTF-8 valide, mais son contenu est faux : des octets
    Mac OS Roman ont ete relus comme du cyrillique (CP1251) puis reencodes.
    Resultat : "general" s'ecrit "gЋnЋral", "ST LO" s'ecrit "ST Lп".
    On refait le chemin inverse, caractere par caractere.
    Verifie le 10/08/2026 sur les 167 caracteres concernes.
    """
    out = []
    for ch in t:
        try:
            b = ch.encode('cp1251')
            if len(b) == 1 and b[0] >= 0x80:
                out.append(b.decode('mac_roman'))
                continue
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        out.append(ch)
    return ''.join(out)


raw = repare_accents(raw)

lines_raw = raw.splitlines()
print(f"Total lines: {len(lines_raw)}")

# Find header row (contains 'CIP')
header_idx = None
for i, line in enumerate(lines_raw):
    if 'CIP' in line and 'Pharmacie' in line:
        header_idx = i
        print(f"Header found at line {i}: {line[:80]}")
        break

if header_idx is None:
    # Try to find by scanning
    for i, line in enumerate(lines_raw):
        if 'Pharmacie' in line:
            header_idx = i
            print(f"Header (fallback) at line {i}: {line[:80]}")
            break

if header_idx is None:
    print("ERROR: could not find header row")
    exit(1)

# Parse as CSV from header row onward
data_lines = '\n'.join(lines_raw[header_idx:])
reader = csv.DictReader(data_lines.splitlines(), delimiter=';')

clients = []
for row in reader:
    # CIP can be labelled differently, try both
    cip = str(row.get('CIP', row.get('Cip', ''))).strip()
    if not cip or cip in ('', 'None', 'CIP'): continue

    nom = js_str(row.get('Pharmacie', ''))
    if not nom: continue

    adresse      = js_str(row.get('Adresse', ''))
    cp           = js_str(row.get('CP', ''))
    ville        = js_str(row.get('Villes', row.get('Ville', '')))
    email        = js_str(row.get('Email', ''))
    tel          = js_str(row.get('Téléphone', row.get('Tel', '')))
    potentiel_gx = parse_euros(row.get('Potentiel Gx', ''))
    ca2023       = parse_euros(row.get('CA 2023', ''))
    prochain_rdv = js_str(row.get('Prochain rdv', ''))
    commentaire  = js_str(row.get('Commentaires', ''))
    pelgraz      = js_str(row.get('Cibles Pelgraz perdues', ''))
    pelmeg       = js_str(row.get('Cibles Pelmeg sur 6 mois', ''))
    ecodage      = js_str(row.get('Ecodage accord', ''))
    gros1        = js_str(row.get('Gros 1', ''))
    gros2        = js_str(row.get('Gros 2', ''))

    clients.append({
        'cip': js_str(cip), 'nom': nom, 'adresse': adresse,
        'cp': cp, 'ville': ville, 'email': email, 'tel': tel,
        'potentielGx': potentiel_gx, 'ca2023': ca2023,
        'prochaineVisite': prochain_rdv if prochain_rdv else None,
        'commentaire': commentaire,
        'pelgraz': pelgraz, 'pelmeg': pelmeg,
        'ecodage': ecodage, 'gros1': gros1, 'gros2': gros2,
    })

print(f"Parsed {len(clients)} clients")
if clients:
    print(f"Sample: {clients[0]}")

# Write JS
today = datetime.now().strftime('%Y-%m-%d')
out_lines = [
    f'// Intégral Pharma — Secteur commercial',
    f'// Généré le {today} depuis CRM INTEGRAL PHARMA.csv',
    f'// {len(clients)} pharmacies secteur',
    'const CLIENTS = [',
]
for c in clients:
    pv = f'"{c["prochaineVisite"]}"' if c['prochaineVisite'] is not None else 'null'
    out_lines.append(
        f'  {{cip:"{c["cip"]}",nom:"{c["nom"]}",adresse:"{c["adresse"]}",'
        f'cp:"{c["cp"]}",ville:"{c["ville"]}",email:"{c["email"]}",tel:"{c["tel"]}",'
        f'potentielGx:{c["potentielGx"]},ca2023:{c["ca2023"]},'
        f'prochaineVisite:{pv},commentaire:"{c["commentaire"]}",'
        f'pelgraz:"{c["pelgraz"]}",pelmeg:"{c["pelmeg"]}",'
        f'ecodage:"{c["ecodage"]}",gros1:"{c["gros1"]}",gros2:"{c["gros2"]}"}},'
    )
out_lines.append('];')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out_lines) + '\n')

sz = os.path.getsize(OUT) / 1024
print(f"Written {OUT} ({sz:.0f} KB, {len(clients)} clients)")

"""Génère opso/opso-listing-2026.js à partir du fichier Excel adhérents.

17/11/2026 — nouvelle liste de Will (142 adhérentes, colonne « Début de contrat »).
Champ `debut` = mois d'adhésion « AAAA-MM » : un achat ne compte pour OPSO qu'à partir
de ce mois (choix de Will, 17/11/2026) — appliqué par V2.applyOpsoPerimeter (v2-boot.js)
et jeu_opso (decouper_par_commercial.py).
Le fichier contient titulaires, e-mails et téléphones : il reste HORS du dépôt
(.gitignore) et se redépose sur Supabase (clé `opsolisting`) après chaque génération.
"""
import openpyxl, json, os, re, warnings
warnings.filterwarnings('ignore')

XLSX = "opso/Opso santé/pharmacies-adherentes-2026-11.xlsx"
OUT  = "opso/opso-listing-2026.js"
PERIMETRE = {"Normandie Pharma": "NP", "Bretagne Pharma": "BP", "OPSO Pharma": "OPSO"}


def s(x):
    return str(x).strip() if x is not None else ''


def tel_fr(t):
    d = re.sub(r'\D', '', s(t))
    return ' '.join(d[i:i + 2] for i in range(0, len(d), 2)) if len(d) == 10 else s(t)


# Le code UGA n'est pas dans la nouvelle liste : repris de la liste précédente (même CIP, sinon même nom + ville).
ancien = []
if os.path.exists(OUT):
    m = re.search(r'const OPSO_LISTING_2026 = (\[.*\]);', open(OUT, encoding='utf-8').read(), re.S)
    ancien = json.loads(m.group(1)) if m else []
cle = lambda nom, ville: (s(nom).upper(), s(ville).upper())
uga_cip = {a['cip']: a.get('uga', '') for a in ancien}
uga_nom = {cle(a['nom'], a['ville']): a.get('uga', '') for a in ancien}

wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb["Pharmacies adhérentes"]
entete = [s(c) for c in next(ws.iter_rows(max_row=1, values_only=True))]
attendu = ['CIP', 'Pharmacie', 'Enseigne', 'Nom titulaire 1', 'Prénom titulaire 1', 'Nom titulaire 2', 'Prénom titulaire 2',
           'Nom titulaire 3', 'Prénom titulaire 3', 'Adresse', 'Code postal', 'Ville', 'Email', 'Téléphone', 'Début de contrat']
if entete[:15] != attendu:
    raise SystemExit('ARRÊT : colonnes inattendues %s' % entete)

records = []
for row in ws.iter_rows(min_row=2, values_only=True):
    cip, nom, enseigne, t1n, t1p, _t2n, _t2p, _t3n, _t3p, adr, cp, ville, email, tel, debut = row[:15]
    if not cip or not s(nom):
        continue
    try:
        cip = str(int(cip))
    except (TypeError, ValueError):
        cip = s(cip)
    d = re.fullmatch(r'(\d{2})/(\d{2})/(\d{4})', s(debut)) if not hasattr(debut, 'year') else None
    if hasattr(debut, 'year'):
        an, mois = debut.year, debut.month
    elif d:
        an, mois = int(d.group(3)), int(d.group(2))
    else:
        raise SystemExit('ARRÊT : début de contrat illisible pour %s (%r)' % (cip, debut))
    records.append({
        "cip": cip,
        "uga": uga_cip.get(cip) or uga_nom.get(cle(nom, ville), ''),
        "annee": an,
        "debut": '%04d-%02d' % (an, mois),
        "perimetre": PERIMETRE.get(s(enseigne), s(enseigne)),
        "nom": s(nom),
        "titulaire": ' '.join(filter(None, [s(t1n), s(t1p)])),
        "adresse": s(adr),
        "cp": s(cp).zfill(5) if cp else '',
        "ville": s(ville),
        "tel": tel_fr(tel),
        "email": s(email),
    })

if len({r['cip'] for r in records}) != len(records):
    raise SystemExit('ARRÊT : CIP en double')

# JS output
js = "// Liste officielle des adhérents OPSO Santé (fichier de Will du 17/11/2026)\n"
js += "// Générée depuis Excel — ne pas éditer à la main\n"
js += f"// {len(records)} adhérents\n\n"
js += "const OPSO_LISTING_2026 = " + json.dumps(records, ensure_ascii=False, indent=0) + ";\n"

with open(OUT, "w", encoding="utf-8") as f:
    f.write(js)

print(f"✓ {len(records)} adhérents écrits dans {OUT}")

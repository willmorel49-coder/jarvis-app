"""Génère opso/opso-listing-2026.js à partir du fichier Excel adhérents."""
import openpyxl, json, warnings
warnings.filterwarnings('ignore')

XLSX = "opso/Opso santé/2026 - Listing adhérents Groupe Opso Santé 2026_MAJ 12_01_2026-2.xlsx"
OUT  = "opso/opso-listing-2026.js"

wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb["Listing 2026"]

records = []
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0:
        continue
    cip, uga, annee, perimetre, nom, t1n, t1p, t2n, t2p, t3n, t3p, adr, cp, ville, tel, email, email2 = row[:17]
    if not cip or not nom:
        continue
    try:
        cip = str(int(cip))
    except:
        cip = str(cip).strip()
    nom = (nom or '').strip()
    if not nom or not cip:
        continue
    rec = {
        "cip": cip,
        "uga": (uga or '').strip() if isinstance(uga, str) else (str(uga) if uga else ''),
        "annee": (annee.year if hasattr(annee, 'year') else (lambda x: int(x) if str(x).isdigit() else str(x))(annee)) if annee else None,
        "perimetre": (perimetre or '').strip() if isinstance(perimetre, str) else '',
        "nom": nom,
        "titulaire": ' '.join(filter(None, [(t1n or '').strip(), (t1p or '').strip()])) if (t1n or t1p) else '',
        "adresse": (adr or '').strip() if isinstance(adr, str) else '',
        "cp": str(cp).zfill(5) if cp else '',
        "ville": (ville or '').strip() if isinstance(ville, str) else '',
        "tel": (tel or '').strip() if isinstance(tel, str) else '',
        "email": (email or '').strip() if isinstance(email, str) else '',
    }
    records.append(rec)

# JS output
js = "// Liste officielle des adhérents OPSO Santé 2026\n"
js += "// Générée depuis Excel — ne pas éditer à la main\n"
js += f"// {len(records)} adhérents\n\n"
js += "const OPSO_LISTING_2026 = " + json.dumps(records, ensure_ascii=False, indent=0) + ";\n"

with open(OUT, "w", encoding="utf-8") as f:
    f.write(js)

print(f"✓ {len(records)} adhérents écrits dans {OUT}")

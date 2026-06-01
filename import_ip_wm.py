#!/usr/bin/env python3
"""
Importe BASE DE DONNÉE IP WM.xlsx (feuille "BASE DONNÉE IP") dans crm/clients-data.js.

Stratégie :
- Garde les pharmacies existantes intactes (leurs CA/potentiels/commentaires enrichis).
- Ajoute les nouvelles trouvées dans le fichier Excel comme prospects froids.
- Filtre territoire : 8 dpts (14·35·37·44·49·50·53·72).
- Dédoublonnage par CIP.
- Met le groupement IP WM dans le champ `ecodage` du CRM.

Sortie :
- crm/clients-data.js mis à jour (en ajoutant les nouveaux à la fin)
- crm/clients-data.bak.js : sauvegarde de l'ancien

Usage : python3 import_ip_wm.py
"""

import openpyxl
import re
import shutil
from pathlib import Path

XLSX_PATH = 'BASE DE DONNÉE IP WM.xlsx'
CRM_JS_PATH = Path('crm/clients-data.js')
TERRITORY_DEPTS = {'14', '35', '37', '44', '49', '50', '53', '72'}


def read_xlsx_pharmacies():
    """Lit la feuille principale + déduplique par CIP."""
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)
    ws = wb['BASE DONNÉE IP']

    def clean_int_str(v):
        """Convertit une valeur Excel (int/float/str) en string sans '.0' final."""
        if v is None:
            return ''
        s = str(v).strip()
        if s.endswith('.0'):
            s = s[:-2]
        return s

    pharmacies = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[11] is None:
            continue
        cip = clean_int_str(row[11])
        if not cip:
            continue

        cp_precis = row[5]  # CP PRÉCIS (int 5 chiffres)
        cp_raw = row[4]     # CP (string court)
        cp_val = cp_precis if cp_precis else cp_raw
        if cp_val is None:
            continue
        cp = clean_int_str(cp_val)
        if cp.isdigit():
            cp = cp.zfill(5)
        cp = cp[:5]
        if len(cp) != 5:
            continue
        if cp[:2] not in TERRITORY_DEPTS:
            continue

        if cip in pharmacies:
            # Compléter avec données manquantes si la duplicata en a plus
            existing = pharmacies[cip]
            for key, idx in [('nom', 0), ('groupement', 1), ('pharmacien', 2),
                             ('adresse', 3), ('ville', 8), ('email', 9), ('tel', 10)]:
                if not existing.get(key) and row[idx]:
                    existing[key] = str(row[idx]).strip()
            continue

        pharmacies[cip] = {
            'cip': cip,
            'nom': str(row[0] or '').strip(),
            'groupement': str(row[1] or '').strip(),
            'pharmacien': str(row[2] or '').strip(),
            'adresse': str(row[3] or '').strip(),
            'cp': cp,
            'ville': str(row[8] or '').strip(),
            'email': str(row[9] or '').strip(),
            'tel': str(row[10] or '').strip(),
        }
    return pharmacies


def read_existing_crm():
    """Lit les CIPs existants dans crm/clients-data.js."""
    content = CRM_JS_PATH.read_text(encoding='utf-8')
    cips = set(re.findall(r'cip:"(\d+)"', content))
    return cips, content


def js_escape(s):
    """Échappe une chaîne pour insertion dans un literal JS double-quoted."""
    if s is None:
        return ''
    s = str(s)
    s = s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ').strip()
    return s


def build_new_record(p):
    """Construit un record JS aligné sur le format existant."""
    nom = js_escape(p['nom'])
    adresse = js_escape(p['adresse'])
    ville = js_escape(p['ville'])
    email = js_escape(p['email'])
    tel = js_escape(p['tel'])
    groupement = js_escape(p['groupement'])
    return (
        f'  {{cip:"{p["cip"]}",nom:"{nom}",adresse:"{adresse}",'
        f'cp:"{p["cp"]}",ville:"{ville}",email:"{email}",tel:"{tel}",'
        f'potentielGx:0,ca2023:0,prochaineVisite:null,commentaire:"",'
        f'pelgraz:"",pelmeg:"",ecodage:"{groupement}",gros1:"",gros2:""}},'
    )


def main():
    print('[import] Lecture BASE DE DONNÉE IP WM.xlsx...')
    all_pharmacies = read_xlsx_pharmacies()
    print(f'[import] {len(all_pharmacies)} pharmacies uniques dans tes 8 dpts')

    print('[import] Lecture crm/clients-data.js...')
    existing_cips, content = read_existing_crm()
    print(f'[import] {len(existing_cips)} CIPs déjà dans le CRM')

    new_pharmacies = {cip: p for cip, p in all_pharmacies.items() if cip not in existing_cips}
    print(f'[import] {len(new_pharmacies)} NOUVELLES pharmacies à importer (prospects froids)')

    if not new_pharmacies:
        print('[import] Rien à faire.')
        return

    # Backup
    backup = CRM_JS_PATH.with_suffix('.bak.js')
    shutil.copy(CRM_JS_PATH, backup)
    print(f'[import] Backup → {backup}')

    # Construit les nouveaux records
    new_records = [build_new_record(p) for p in new_pharmacies.values()]

    # Insère avant la dernière `];`
    last_bracket_idx = content.rfind('];')
    if last_bracket_idx == -1:
        print('[import] ERREUR : impossible de trouver `];` dans clients-data.js')
        return

    # Vérifie virgule trailing avant `];`
    pre = content[:last_bracket_idx].rstrip()
    if pre.endswith('}'):
        pre = pre + ','  # ajoute la virgule pour aligner avec les nouveaux records qui finissent par ','

    new_content = (
        pre + '\n'
        '  // ── Prospects importés depuis BASE DE DONNÉE IP WM ───────\n'
        + '\n'.join(new_records).rstrip(',') + '\n'
        '];'
    )

    CRM_JS_PATH.write_text(new_content, encoding='utf-8')
    new_total = len(re.findall(r'cip:"(\d+)"', new_content))
    print(f'[import] Écrit crm/clients-data.js — total : {new_total} pharmacies')
    print(f'[import] Pense à : 1) re-run geocode_pharmacies.py 2) re-déployer')


if __name__ == '__main__':
    main()

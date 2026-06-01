#!/usr/bin/env python3
"""
Sync les vrais clients depuis STATS/Statistiques de vente par client  Etat de synthèse général.xls
Format .xls, 49 clients distincts (plus exhaustif que WML).
Colonnes : SUM_QTE, SUM_CA, SUM_MARGE, CLICODE (cip), CLISOCIETE
"""

import re
import shutil
import openpyxl
import xlrd
from pathlib import Path

SRC = 'STATS/Statistiques de vente par client  Etat de synthèse général.xls'
CRM = Path('crm/clients-data.js')
IP_WM = 'BASE DE DONNÉE IP WM.xlsx'


def clean_str(v):
    if v is None: return ''
    if isinstance(v, str): return v.replace('\x00', '').strip()
    return str(v).strip()


def clean_cip(v):
    s = clean_str(v)
    if s.endswith('.0'):
        s = s[:-2]
    return s


def read_stats():
    """Lit les 49 clients agrégés."""
    wb = xlrd.open_workbook(SRC)
    ws = wb.sheet_by_index(0)
    clients = {}
    # Première ligne = headers (SUM_QTE, SUM_CA, SUM_MARGE, CLICODE, CLISOCIETE)
    for r in range(1, ws.nrows):
        sum_qte = ws.cell_value(r, 0)
        sum_ca = ws.cell_value(r, 1)
        cip = clean_cip(ws.cell_value(r, 3))
        nom = clean_str(ws.cell_value(r, 4))
        if not cip.isdigit():
            continue
        clients[cip] = {
            'nom': nom,
            'ca': float(sum_ca or 0),
            'qte': float(sum_qte or 0),
        }
    return clients


def lookup_ip_wm(cip):
    """Récupère adresse/CP/ville depuis BASE DE DONNÉE IP WM."""
    if not Path(IP_WM).exists():
        return None
    wb = openpyxl.load_workbook(IP_WM, read_only=True, data_only=True)
    ws = wb['BASE DONNÉE IP']
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[11] is None: continue
        row_cip = clean_cip(row[11])
        if row_cip != cip: continue
        cp_val = row[5] if row[5] else row[4]
        cp = clean_cip(cp_val) if cp_val else ''
        if cp.isdigit() and len(cp) < 5: cp = cp.zfill(5)
        return {
            'nom': clean_str(row[0]),
            'groupement': clean_str(row[1]),
            'adresse': clean_str(row[3]),
            'cp': cp[:5] if cp else '',
            'ville': clean_str(row[8]),
            'email': clean_str(row[9]),
            'tel': clean_cip(row[10]),
        }
    return None


def update_ca_field(rec_str, new_ca):
    """Replace ca2023 value in a record string."""
    return re.sub(r'(ca2023:)\d+', rf'\g<1>{int(round(new_ca))}', rec_str, count=1)


def build_new_client(cip, nom, ca):
    """Construit un nouveau record pour les CIPs absents du CRM."""
    extra = lookup_ip_wm(cip) or {}
    def esc(s):
        return (s or '').replace('\\', '\\\\').replace('"', '\\"')
    return (
        f'  {{cip:"{cip}",nom:"{esc(nom)}",adresse:"{esc(extra.get("adresse",""))}",'
        f'cp:"{extra.get("cp","")}",ville:"{esc(extra.get("ville",""))}",'
        f'email:"{esc(extra.get("email",""))}",tel:"{extra.get("tel","")}",'
        f'potentielGx:0,ca2023:{int(round(ca))},prochaineVisite:null,'
        f'commentaire:"Client STATS sync auto",pelgraz:"",pelmeg:"",'
        f'ecodage:"{esc(extra.get("groupement",""))}",gros1:"",gros2:""}},'
    )


def main():
    print(f'[stats] Lecture {SRC}')
    stats_clients = read_stats()
    print(f'[stats] {len(stats_clients)} clients distincts agrégés')

    print(f'[stats] Top 10 par CA :')
    for cip, info in sorted(stats_clients.items(), key=lambda x: -x[1]['ca'])[:10]:
        print(f'  CIP {cip:8s} · {info["nom"]:40s} · {info["ca"]:>12.0f} €')

    content = CRM.read_text(encoding='utf-8')
    existing_cips = set(re.findall(r'cip:"(\d+)"', content))
    print(f'[stats] CRM actuel : {len(existing_cips)} pharmacies')

    in_crm = [c for c in stats_clients if c in existing_cips]
    missing = [c for c in stats_clients if c not in existing_cips]
    print(f'[stats] Matchés dans CRM : {len(in_crm)} | Absents : {len(missing)}')

    # Backup
    shutil.copy(CRM, CRM.with_suffix('.bak.js'))

    # Update ca2023 pour tous les records existants (les non-clients passent à ca2023=0)
    def repl(m):
        rec = m.group(0)
        cip_m = re.search(r'cip:"(\d+)"', rec)
        if not cip_m: return rec
        cip = cip_m.group(1)
        if cip in stats_clients:
            return update_ca_field(rec, stats_clients[cip]['ca'])
        return update_ca_field(rec, 0)
    new_content = re.sub(r'\{cip:"\d+"[^}]*\}', repl, content)

    # Ajoute les manquants
    if missing:
        new_records = [build_new_client(cip, stats_clients[cip]['nom'], stats_clients[cip]['ca']) for cip in missing]
        last = new_content.rfind('];')
        pre = new_content[:last].rstrip()
        if pre.endswith('}'):
            pre += ','
        new_content = (
            pre + '\n'
            '  // ── Clients STATS sync (ajoutés auto) ───\n'
            + '\n'.join(new_records).rstrip(',') + '\n];'
        )

    CRM.write_text(new_content, encoding='utf-8')
    total = len(re.findall(r'cip:"(\d+)"', new_content))
    clients = sum(1 for m in re.finditer(r'ca2023:(\d+)', new_content) if int(m.group(1)) > 0)
    print(f'[stats] Écrit {CRM} — total {total}, clients (ca2023>0) {clients}')


if __name__ == '__main__':
    main()

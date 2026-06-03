"""
Import WML Excel files directly into Supabase.
Processes WML_01_2026.xlsx → WML_04_2026.xlsx
"""
import os, re, sys, warnings
warnings.filterwarnings('ignore')

import openpyxl
from supabase import create_client

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL  = 'https://iyvavhnlhxksokkerkos.supabase.co'
SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dmF2aG5saHhrc29ra2Vya29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjU2NTYsImV4cCI6MjA5MzE0MTY1Nn0.eMdW6vUdoyVpZbqKXp6FNYTajwKEf4x-Xyj5zj1igO4'
EMAIL         = 'demo@integralpharma.fr'
PASSWORD      = 'demo2026'

WML_FILES = [
    ('/Users/williammorel/JARVIS/APP/WML_01_2026.xlsx', 1, 2026),
    ('/Users/williammorel/JARVIS/APP/WML_02_2026.xlsx', 2, 2026),
    ('/Users/williammorel/JARVIS/APP/WML_03_2026.xlsx', 3, 2026),
    ('/Users/williammorel/JARVIS/APP/WML_04_2026.xlsx', 4, 2026),
]

PHARMA_COLORS = ['#11a63c','#059669','#0284C7','#7C3AED','#e8a317',
                 '#d04a4a','#0891B2','#6D28D9','#D97706','#DC2626']

# CIP → canonical name from opso-adherents.js
OPSO_CIP_TO_NOM = {
    '2004572': 'PHARMACIE DE KERMARIO',
    '2007776': 'PHARMACIE DU DAUPHIN',
    '2007823': "PHARMACIE DU PAYS D'AUGE",
    '2012770': 'PHARMACIE DE LA CHARENTONNE',
    '2013097': 'PHARMACIE DE LA REPUBLIQUE',
    '2028749': 'PHARMACIE DE TINCHEBRAY',
    '2074308': 'PHARMACIE CENTRE COLBERT',
    '2074968': 'PHARMACIE TREICH',
    '2075013': 'PHARMACIE DE DOZULE',
    '2075385': 'PHARMACIE DU LONG COURS',
    '2075406': 'PHARMACIE DE LA PLAGE',
    '2009885': 'PHARMACIE BURON SAINT CONTEST',
    '2075888': 'GRANDE PHARMACIE TROUVILLAISE',
    '2075914': 'PHARMACIE LE GAC',
    '2076017': 'PHARMACIE DE LA GRANDE DELLE',
    '2090838': "PHARMACIE DU POT D'ETAIN",
    '2134906': 'PHARMACIE DE BARFLEUR',
    '2144359': 'PHARMACIE DU PONT LOROIS',
    '2196103': 'PHARMACIE DE CAUDEBEC',
    '2280666': 'PHARMACIE DU CENTRE',
    '2004297': 'PHARMACIE DE CONDE SUR SARTHE',
    '2136044': 'PHARMACIE DES M',
    '2136107': 'PHARMACIE SAINT SAUVEURAISE',
    '2136311': 'PHARMACIE HAUTEMANIERE',
    '2198074': 'PHARMACIE SAINT GEORGES',
    '2283342': 'PHARMACIE DU SENEQUET',
    '2007561': 'PHARMACIE DE MAY',
    '2024372': 'PHARMACIE LE HAGUE DIKE',
    '2075170': 'PHARMACIE SAINT LEONARD',
    '2075673': 'PHARMACIE HUNAULT',
    '2197683': 'PHARMACIE DE LA VALLEE',
    '2000462': 'PHARMACIE DE FEREL',
    '2075961': 'PHARMACIE DE VILLERS SUR MER',
    '2143156': "PHARMACIE DE L'ESTRAN",
    '2144170': 'PHARMACIE FOSSEPREZ CASSIN',
    '2196522': 'PHARMACIE PIQUET',
    '2135433': 'PHARMACIE SAINT NICOLAS',
    '2074858': 'PHARMACIE DE LA MAIRIE DE COLOMBELLES',
    '2277145': 'PHARMACIE DE LA RIA',
    '2024126': 'PHARMACIE DU BOCAGE',
    '2007624': 'PHARMACIE SAINT PIERRE',
    '2025994': 'PHARMACIE DE BADEN',
    '2135559': 'PHARMACIE DE LESSAY',
    '2144411': 'PHARMACIE DE KERFONTAINE',
    '2144846': 'PHARMACIE DE RHUYS',
    '2198561': 'PHARMACIE DU CLOS SAINT MARC',
    # Extra from adherents
    '2007430': "PHARMACIE D'IFS CENTRE COMMERCIAL ROCADE SUD",
    '2012951': 'PHARMACIE DES CALINS',
    '2014648': 'PHARMACIE AUBRETON LAMBERT',
    '2020069': 'PHARMACIE HA',
    '2023934': 'PHARMACIE RIVE SUD',
    '2036812': 'PHARMACIE DE PARIS - LE MANS',
    '2036854': 'PHARMACIE DE PONTLIEUE',
    '2075123': 'PHARMACIE DU COEUR DE BOURG',
    '2075390': 'PHARMACIE DE LA MER',
    '2075741': 'PHARMACIE SAINT VIGOR',
    '2075830': 'PHARMACIE OMAHA BEACH TREVIERES',
    '2132631': 'PHARMACIE ALBIOL',
    '2133331': 'PHARMACIE QUILLET CA VAN',
    '2134602': 'PHARMACIE DES ALLUMETTES',
    '2135040': 'PHARMACIE HUMBERT',
    '2184009': 'PHARMACIE MEDICIS',
    '2254725': 'PHARMACIE LA MAISON BLANCHE',
    '2255666': 'PHARMACIE HENRI IV',
    '2262516': 'PHARMACIE DES BREDINS',
    '2266992': 'PHARMACIE DES MAUGES',
    '2267142': 'PHARMACIE DU BVD DE STRASBOURG',
    '2267650': 'PHARMACIE DU COEUR DE VILLE',
    '2279163': 'PHARMACIE GODARD',
    '2284351': 'PHARMACIE DU LYS',
    '2288398': 'PHARMACIE THIREAU',
}
# Portefeuille William Morel — 6 pharmacies actives uniquement
OPSO_CIPS = {
    '2136311',  # HAUTEMANIERE
    '2007430',  # IFS
    '2075385',  # LONG COURS
    '2013097',  # REPUBLIQUE (Honfleur)
    '2135433',  # SAINT NICOLAS
    '2075914',  # LE GAC
}

def classify_product(nature, afm_code, pu_net):
    n = (nature or '').lower()
    a = (afm_code or '').lower()
    if 'biosimilaire' in n: return 'biosim'
    if 'generique' in n:    return 'generique'
    if a in ('para', 'dm', 'dm_20'): return 'nr'
    try:
        p = float(pu_net or 0)
        if p > 468:  return 'ch'
        if p > 4.33: return 'mi'
    except: pass
    return 'pp'

def parse_wml_file(path, month, year):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    hdr = rows[0]
    col = {n: i for i, n in enumerate(hdr) if n}

    groups = {}
    for row in rows[1:]:
        def g(k): return row[col[k]] if k in col else None
        tc   = str(int(g('TIRCODE'))) if g('TIRCODE') else None
        nom  = str(g('TIRSOCIETE') or '').strip()
        if not tc or tc not in OPSO_CIPS:
            continue
        canonical_nom = OPSO_CIP_TO_NOM[tc]
        key = tc
        if key not in groups:
            groups[key] = {'tc': tc, 'nom': canonical_nom, 'rows': []}

        designation = str(g('PLVDESIGNATION') or '').strip()
        if not designation:
            continue

        try: qte     = float(g('PLVQTE') or 0)
        except: qte  = 0
        try: pu_brut = float(g('PLVPUBRUT') or 0)
        except: pu_brut = 0
        try: pu_net  = float(g('PLVPUNET') or 0)
        except: pu_net = 0
        try: mnt     = float(g('PLVMNTNETHT') or 0)
        except: mnt  = 0

        art_code  = str(g('ARTCODE') or '')
        nature    = str(g('ARTNATURE') or '')
        afm_code  = str(g('AFMCODE') or '')
        subfamily = str(g('ARTSOUSFAMILLE') or '')
        famille   = classify_product(nature, afm_code, pu_net)

        groups[key]['rows'].append({
            'art_designation': designation,
            'art_code':        art_code,
            'art_id':          None,
            'art_famille':     famille,
            'qte':             qte,
            'pu_brut':         pu_brut,
            'pu_net':          pu_net,
            'mnt_net_ht':      mnt,
        })
    return groups


def main():
    print('Connexion à Supabase...')
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    auth = sb.auth.sign_in_with_password({'email': EMAIL, 'password': PASSWORD})
    user_id = auth.user.id
    print(f'  Connecté : {EMAIL} (id={user_id[:8]}...)')

    # Charger les pharmacies existantes
    existing = sb.table('pharmacies').select('id,name,code,color').execute().data or []
    ph_by_code = {}
    ph_by_name = {}
    for p in existing:
        if p.get('code'): ph_by_code[str(p['code'])] = p
        ph_by_name[p['name'].upper().strip()] = p
    print(f'  {len(existing)} pharmacies existantes en base')

    color_idx = len(existing)

    for filepath, month, year in WML_FILES:
        fname = os.path.basename(filepath)
        print(f'\n── {fname} (mois {month}/{year}) ──────────────────')
        groups = parse_wml_file(filepath, month, year)
        print(f'  {len(groups)} pharmacies OPSO trouvées dans le fichier')

        for tc, group in sorted(groups.items()):
            nom   = group['nom']
            rows  = group['rows']
            print(f'  [{tc}] {nom} — {len(rows)} lignes')

            # Trouver ou créer la pharmacie
            ph = ph_by_code.get(tc) or ph_by_name.get(nom.upper().strip())
            if not ph:
                color = PHARMA_COLORS[color_idx % len(PHARMA_COLORS)]
                color_idx += 1
                insert_res = sb.table('pharmacies').insert({
                    'name': nom, 'code': tc, 'color': color
                }).execute()
                ph = insert_res.data[0]
                ph_by_code[tc] = ph
                ph_by_name[nom.upper().strip()] = ph
                print(f'    → Pharmacie créée (id={ph["id"][:8]}...)')
            else:
                print(f'    → Pharmacie existante (id={ph["id"][:8]}...)')

            ph_id = ph['id']

            # Supprimer l'import existant pour ce mois (CASCADE sur les ventes)
            old = sb.table('imports').select('id').eq('pharmacy_id', ph_id).eq('month', month).eq('year', year).execute().data
            for o in (old or []):
                sb.table('imports').delete().eq('id', o['id']).execute()
                print(f'    → Import précédent supprimé (id={o["id"][:8]}...)')

            # Créer l'enregistrement d'import
            imp_res = sb.table('imports').insert({
                'pharmacy_id': ph_id,
                'month':       month,
                'year':        year,
                'filename':    fname,
                'imported_by': user_id,
            }).execute()
            imp_id = imp_res.data[0]['id']

            # Insérer les ventes par batch de 500
            sales_rows = [{
                'import_id':      imp_id,
                'pharmacy_id':    ph_id,
                'month':          month,
                'year':           year,
                'art_designation':r['art_designation'],
                'art_code':       r['art_code'],
                'art_id':         r['art_id'],
                'art_famille':    r['art_famille'],
                'qte':            r['qte'],
                'pu_brut':        r['pu_brut'],
                'pu_net':         r['pu_net'],
                'mnt_net_ht':     r['mnt_net_ht'],
            } for r in rows]

            BATCH = 500
            total = 0
            for i in range(0, len(sales_rows), BATCH):
                chunk = sales_rows[i:i+BATCH]
                sb.table('sales').insert(chunk).execute()
                total += len(chunk)
            print(f'    → {total} lignes de ventes insérées')

    print('\n✓ Import terminé.')


if __name__ == '__main__':
    main()

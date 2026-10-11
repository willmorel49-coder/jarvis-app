#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""Produits dont la marge pour l'entreprise suit une règle à part (Pilotage > Marge produits).

Deux listes de codes CIP13, lues dans les fichiers de ventes (STATS/<CODE>_MM_AAAA.xlsx) :
  · generiques (PUBLIQUE) : nature DÉCLARÉE générique (colonne ARTNATURE) : « générique », « générique partenaire »,
    « autre générique », avec ou sans accent — les fichiers de ventes écrivent la nature de deux façons.
    Le nom d'un génériqueur ne suffit pas : Spasfon, Lamaline, Izalgi, Kardegic sont des princeps.
  · liste PRIVÉE : laboratoire DÉCLARÉ (colonne ARTCOLLECTION) contenant l'un des noms du réglage privé.
    Les noms, le montant par boîte et les libellés affichés ne sont PAS dans ce dépôt (public) : ils se lisent
    dans le réglage privé (voir PRIVE ci-dessous), et la liste sort dans un fichier PROTÉGÉ, jamais commité.
Un produit entre dans une liste quand la majorité de ses lignes renseignées le dit.

Sorties : crm/v2/marge-regles-data.js (window.MARGE_REGLES, public) et crm/v2/marge-regles-prive.js
          (window.MARGE_REGLES_PRIVE, couvert par .gitignore, à DÉPOSER dans l'espace Supabase « donnees-protegees »).
Usage   : /usr/bin/python3 generate_marge_regles.py [dossier STATS]
À relancer quand de nouveaux fichiers de ventes arrivent : un produit nouveau n'est dans aucune liste.
Code de sortie 3 : liste publique écrite, mais réglage privé illisible — le fichier protégé n'est PAS touché.
"""
import os, re, sys, json, datetime, warnings, unicodedata
from multiprocessing import Pool
warnings.filterwarnings('ignore')
import openpyxl

BASE = os.path.dirname(os.path.abspath(__file__))
STATS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'STATS')
SORTIE = os.path.join(BASE, 'crm', 'v2', 'marge-regles-data.js')
SORTIE_PRIVEE = os.path.join(BASE, 'crm', 'v2', 'marge-regles-prive.js')
# Réglage privé, HORS dépôt : {"reglages": chemin d'un fichier de réglages, "bloc": nom du bloc à y lire
# (clés actif, laboratoires_contenant, petit_par_boite), "libelle": …, "detail": … avec {boite}}.
PRIVE = os.environ.get('JARVIS_MARGE_PRIVE') or os.path.expanduser('~/.config/jarvis/marge-regles-prive.json')
LABOS = ()   # rempli par lire_prive() ; vide = aucune liste privée


def lire_prive():
    """Le réglage privé, ou None s'il est illisible ou incomplet (dit pourquoi)."""
    try:
        cfg = json.load(open(PRIVE, encoding='utf-8'))
        bloc = json.load(open(cfg['reglages'], encoding='utf-8'))[cfg['bloc']]
        labos = tuple(str(x).strip().upper() for x in bloc['laboratoires_contenant'] if str(x).strip())
        boite = float(bloc['petit_par_boite'])
        if not labos or not cfg.get('libelle') or '{boite}' not in cfg.get('detail', ''):
            raise ValueError('réglage incomplet')
        return {'actif': bool(bloc.get('actif', True)), 'labos': labos, 'boite': boite, 'libelle': cfg['libelle'],
                'detail': cfg['detail'].replace('{boite}', ('%.2f' % boite).replace('.', ',') + ' €')}
    except Exception as e:
        print('ATTENTION : réglage privé illisible (%s) : %s' % (PRIVE, e), flush=True)
        return None


def init_labos(labos):
    global LABOS
    LABOS = labos
RX_FICHIER = re.compile(r'^[A-Z]+_\d{2}_\d{4}\.xlsx$')


def est_generique(nature):
    n = unicodedata.normalize('NFD', str(nature or '').strip().lower())
    return 'generique' in ''.join(ch for ch in n if unicodedata.category(ch) != 'Mn')


def cip13(v):
    if v is None: return ''
    s = str(v).strip()
    if s.endswith('.0'): s = s[:-2]
    return re.sub(r'\D', '', s)


def lire(chemin):
    """{cip13: [lignes « générique », lignes à nature renseignée, lignes de la liste privée, lignes à laboratoire renseigné]}"""
    wb = openpyxl.load_workbook(chemin, read_only=True, data_only=True)
    it = wb.active.iter_rows(values_only=True)
    try:
        h = [str(x).strip() if x is not None else '' for x in next(it)]
    except StopIteration:
        wb.close(); return {}
    hi = {k: i for i, k in enumerate(h)}
    ic, inat, ilab = hi.get('ARTCODEBARRE'), hi.get('ARTNATURE'), hi.get('ARTCOLLECTION')
    res = {}
    if ic is not None:
        for r in it:
            c = cip13(r[ic]) if ic < len(r) else ''
            if len(c) != 13: continue
            a = res.get(c)
            if a is None: a = res[c] = [0, 0, 0, 0]
            nat = str(r[inat] or '').strip().lower() if (inat is not None and inat < len(r)) else ''
            lab = str(r[ilab] or '').strip().upper() if (ilab is not None and ilab < len(r)) else ''
            if nat:
                a[1] += 1
                if est_generique(nat): a[0] += 1
            if lab:
                a[3] += 1
                if any(x in lab for x in LABOS): a[2] += 1
    wb.close()
    return res


def main():
    fichiers = []
    for d in (STATS, os.path.join(STATS, 'hors-perimetre')):
        if os.path.isdir(d):
            fichiers += [os.path.join(d, f) for f in sorted(os.listdir(d)) if RX_FICHIER.match(f)]
    if not fichiers:
        sys.exit('ARRÊT : aucun fichier de ventes dans %s — %s n\'est pas touché.' % (STATS, os.path.basename(SORTIE)))
    print(len(fichiers), 'fichiers de ventes à lire', flush=True)
    prive = lire_prive()
    labos = prive['labos'] if (prive and prive['actif']) else ()
    tout = {}
    with Pool(4, initializer=init_labos, initargs=(labos,)) as pool:
        for i, res in enumerate(pool.imap_unordered(lire, fichiers), 1):
            for c, a in res.items():
                t = tout.get(c)
                if t is None: tout[c] = a
                else:
                    for k in range(4): t[k] += a[k]
            if i % 40 == 0: print(' ', i, '/', len(fichiers), flush=True)
    gen = sorted(c for c, a in tout.items() if a[1] and a[0] * 2 > a[1])
    su = sorted(c for c, a in tout.items() if a[3] and a[2] * 2 > a[3])
    partage = sum(1 for a in tout.values() if 0 < a[0] < a[1] or 0 < a[2] < a[3])
    if not gen or (labos and not su):
        sys.exit('ARRÊT : une liste sortirait vide (génériques %d, liste privée %d) — aucun fichier n\'est touché.'
                 % (len(gen), len(su)))
    with open(SORTIE, 'w', encoding='utf-8') as f:
        f.write('// Produits dont la marge pour l\'entreprise suit une règle à part (Pilotage > Marge produits).\n')
        f.write('// generiques : nature déclarée « générique » (aucune marge). Codes CIP13.\n')
        f.write('// Source : colonne ARTNATURE des fichiers de ventes de tous les commerciaux.\n')
        f.write('// Généré le %s par generate_marge_regles.py (%d fichiers lus). Ne pas modifier à la main.\n'
                % (datetime.date.today().strftime('%d/%m/%Y'), len(fichiers)))
        f.write('window.MARGE_REGLES = ' + json.dumps({'generiques': gen}, separators=(',', ':')) + ';\n')
    # relecture de ce qui vient d'être écrit
    txt = open(SORTIE, encoding='utf-8').read()
    relu = json.loads(txt[txt.index('{', txt.index('window.MARGE_REGLES')):txt.rindex('}') + 1])
    if relu != {'generiques': gen}:
        sys.exit('ARRÊT : le fichier relu ne correspond pas à ce qui a été calculé.')
    print('OK %s · %d produits vus · %d génériques · %d produits aux lignes partagées · %d Ko'
          % (os.path.basename(SORTIE), len(tout), len(gen), partage, os.path.getsize(SORTIE) // 1024))
    if prive is None:
        sys.exit(3)   # liste publique écrite ; le fichier protégé existant n'est pas touché
    # Fichier PROTÉGÉ : règle coupée (actif: false) = liste vide, la règle ne s'applique plus à l'écran.
    regle = {'boite': prive['boite'], 'libelle': prive['libelle'], 'detail': prive['detail'], 'cips': su}
    with open(SORTIE_PRIVEE, 'w', encoding='utf-8') as f:
        f.write('// ⚠️ NE JAMAIS COMMITER. Servi par adresse signée (Supabase, espace « donnees-protegees »).\n')
        f.write('// Généré le %s par generate_marge_regles.py (%d fichiers lus). Ne pas modifier à la main.\n'
                % (datetime.date.today().strftime('%d/%m/%Y'), len(fichiers)))
        f.write('window.MARGE_REGLES_PRIVE = ' + json.dumps({'petitReduit': regle}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    txt = open(SORTIE_PRIVEE, encoding='utf-8').read()
    relu = json.loads(txt[txt.index('{', txt.index('window.MARGE_REGLES_PRIVE')):txt.rindex('}') + 1])
    if relu != {'petitReduit': regle}:
        sys.exit('ARRÊT : le fichier protégé relu ne correspond pas à ce qui a été calculé.')
    print('OK %s (PROTÉGÉ, à déposer) · %d produits · %d octets'
          % (os.path.basename(SORTIE_PRIVEE), len(su), os.path.getsize(SORTIE_PRIVEE)))


if __name__ == '__main__':
    main()

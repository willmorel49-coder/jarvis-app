# -*- coding: utf-8 -*-
"""Contingentement labo + fournisseur manquant, lus dans les exports de stock.

Deux colonnes des exports `PRIX ET STOCKS ETABLISSEMENTS/stock *.xlsx` n'étaient
lues par personne :
  · contmode / contqte → le QUOTA labo (« 2 boîtes par mois »), 72 références.
  · artcollection      → le LABORATOIRE, y compris pour les références que la
                         BDPM ne couvre pas (para, DM, accessoires) et qui
                         restaient donc sans fournisseur dans APPRO.
  · lot / péremption   → le couloir ④ ÉCOULER d'ANTICIPER. Ces colonnes
                         N'EXISTENT PAS ENCORE dans les exports (vérifié le
                         28/09/2026 sur les 10 fichiers du dossier) : la lecture
                         est là, en attente, et n'écrit RIEN tant qu'elle ne
                         trouve pas les colonnes. Le jour où l'export les porte,
                         le couloir s'allume sans toucher au code.

→ crm/v2/appro-source.json  (window: chargé en différé par v2-appro.js)

⚠️ Le nom court passe par la MÊME normalisation que generate_pivot.py
(`short_labo`). Sans elle, « AMGEN », « AMGEN SA » et « AMGEN SAS » feraient
trois fournisseurs distincts dans un écran dont l'unité est « un fournisseur =
une commande » — donc trois commandes là où il y en a une.

⚠️ La date de l'export est ÉCRITE DANS LE FICHIER, jamais en dur dans la page :
c'est la date à laquelle le quota était vrai, et l'écran doit la montrer.

Python 3.9. openpyxl seul. 100 % local.
"""
import openpyxl, glob, os, io, json, re, datetime

# Dossier des exports. APPRO_SRC permet de faire tourner le générateur sur un
# dossier d'essai (sonde du couloir ④) sans jamais déposer de faux export à côté
# des vrais — un fichier d'essai oublié dans le dossier réel partirait en prod.
SRC = os.environ.get('APPRO_SRC') or os.path.expanduser('~/JARVIS/PRIX ET STOCKS ETABLISSEMENTS')
HERE = os.path.dirname(os.path.abspath(__file__))
# Destination = 1er argument, sinon le crm/v2 posé à côté du script.
# ⚠️ Le crm/v2 de ~/JARVIS/APP est une copie de travail qui peut dater : pour
# régénérer ce qui partira en production, donner le crm/v2 du dépôt en argument.
import sys
V2 = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, 'crm', 'v2')
OUT = os.path.join(V2, 'appro-source.json')
LABO_CIP = os.path.join(V2, 'labo-cip.json')
GENERIQUEURS = os.path.join(V2, 'generiqueurs-data.js')

# identique à generate_pivot.py — ne pas faire diverger
_LABO_STRIP = re.compile(r"\s+(AG|SA|SAS|SANTE|SANTÉ|EUROPE|EUROPHARM|PHARMA|INDUSTRIE|GMBH|LTD|BV|NEDERLAND|FRANCE)$", re.I)

def short_labo(l):
    if not l:
        return ''
    base = str(l).split('(')[0].strip()
    two = ' '.join(base.split()[:2])
    return _LABO_STRIP.sub('', two).strip()

def cip13(v):
    if v is None:
        return None
    s = re.sub(r'[^0-9]', '', str(v))
    return s if len(s) == 13 else None

def date_of(fn):
    """La date est dans le nom du fichier (…21092026.xlsx). À défaut, mtime."""
    m = re.search(r'(\d{2})(\d{2})(\d{4})', os.path.basename(fn))
    if m:
        try:
            return datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat()
        except ValueError:
            pass
    return datetime.date.fromtimestamp(os.path.getmtime(fn)).isoformat()

# ── Couloir ④ ÉCOULER : lot + date de péremption ───────────────────────────
# Le nom exact des colonnes n'est pas connu (l'export ne les porte pas encore),
# donc on les RECONNAÎT au lieu de les coder en dur : un export qui les nommera
# `artlot`/`artdlu` ou `lotnumero`/`dateperemption` sera lu sans modification.
RE_LOT = re.compile(r'lot', re.I)
RE_DLU = re.compile(r'dlu|dlc|perem|périm|expir|datelim', re.I)
RE_QLOT = re.compile(r'(lot.*(qte|quantit|stock|nb)|(qte|quantit|stock|nb).*lot)', re.I)
# `stocklot` est le nom demandé à l'éditeur : sans `stock` ni `nb` dans ce motif,
# il n'était pas vu comme la quantité (tous les lots à 0, sans erreur) et pouvait
# même être pris pour le NUMÉRO de lot s'il précédait `artlot` dans l'export.

def col_lot(hdr):
    """(i_lot, i_dlu, i_qte) ou (None, None, None) si l'export ne les porte pas.
    Une colonne de DLU ne doit pas être prise pour une colonne de lot : on teste
    la péremption D'ABORD et on l'exclut des candidates « lot »."""
    i_dlu = next((i for i, h in enumerate(hdr) if RE_DLU.search(h)), None)
    i_lot = next((i for i, h in enumerate(hdr) if RE_LOT.search(h) and i != i_dlu and not RE_QLOT.search(h)), None)
    if i_lot is None or i_dlu is None:
        return None, None, None
    i_q = next((i for i, h in enumerate(hdr) if RE_QLOT.search(h)), None)
    return i_lot, i_dlu, i_q

def dlu_iso(v):
    """Date de péremption → AAAA-MM-JJ. Une DLU vaut souvent « 03/2027 » : sans
    jour, la boîte est périmée le DERNIER jour du mois, jamais le premier —
    prendre le 1er retirerait un mois de vente à chaque lot."""
    if v is None or v == '':
        return None
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    s = str(v).strip()
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        return '%s-%s-%s' % m.groups()
    m = re.match(r'^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$', s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        y += 2000 if y < 100 else 0
        try:
            return datetime.date(y, mo, d).isoformat()
        except ValueError:
            return None
    m = re.match(r'^(\d{1,2})[/.-](\d{4})$', s)
    if m:
        mo, y = int(m.group(1)), int(m.group(2))
        if 1 <= mo <= 12:
            nxt = datetime.date(y + (mo == 12), (mo % 12) + 1, 1)
            return (nxt - datetime.timedelta(days=1)).isoformat()
    return None

def deja_connus():
    """CIP13 dont APPRO sait déjà nommer le fournisseur — on ne les réécrit pas."""
    know = set()
    try:
        know |= set(json.load(io.open(LABO_CIP, encoding='utf-8'))['data'].keys())
    except Exception as e:
        print('  ⚠ labo-cip.json illisible :', e)
    try:
        t = io.open(GENERIQUEURS, encoding='utf-8').read()
        know |= set(json.loads(t[t.index('{'):t.rindex('}') + 1]).keys())
    except Exception as e:
        print('  ⚠ generiqueurs-data.js illisible :', e)
    return know

def main():
    files = sorted(glob.glob(os.path.join(SRC, 'stock *.xlsx')))
    if not files:
        raise SystemExit('AUCUN export « stock *.xlsx » dans %s — rien écrit.' % SRC)

    know = deja_connus()
    print('fournisseurs déjà connus : %d CIP13' % len(know))

    labo, quota, lots, sources = {}, {}, {}, []
    QMODES = ('Semaine', 'Quinzaine', 'Mois')

    for fn in files:
        d = date_of(fn)
        wb = openpyxl.load_workbook(fn, read_only=True, data_only=True)
        ws = wb.active
        it = ws.iter_rows(values_only=True)
        hdr = [str(c).lower() if c is not None else '' for c in next(it)]
        ix = {h: i for i, h in enumerate(hdr)}
        i_cb, i_co, i_m, i_q = ix.get('artcodebarre'), ix.get('artcollection'), ix.get('contmode'), ix.get('contqte')
        i_de, i_di = ix.get('artdesignation'), ix.get('stockdispo')
        i_lot, i_dlu, i_lq = col_lot(hdr)
        nL = nQ = nP = 0
        for r in it:
            c = cip13(r[i_cb]) if i_cb is not None else None
            if not c:
                continue
            # ── fournisseur, seulement là où APPRO n'en a pas ──
            if i_co is not None and c not in know and c not in labo:
                sl = short_labo(r[i_co]) if str(r[i_co] or '') not in ('#N/A', 'None') else ''
                if sl:
                    labo[c] = sl
                    nL += 1
            # ── quota labo ──
            if i_m is not None and c not in quota:
                mode = str(r[i_m] or '').strip()
                if mode in QMODES:
                    try:
                        qte = int(float(r[i_q] or 0))
                    except (TypeError, ValueError):
                        qte = 0
                    try:
                        dispo = int(float(r[i_di] or 0)) if i_di is not None else 0
                    except (TypeError, ValueError):
                        dispo = 0
                    nom = str(r[i_de] or '').strip() if i_de is not None else ''
                    quota[c] = [mode, qte, dispo, nom]
                    nQ += 1
            # ── lot + péremption (couloir ④) : une référence a PLUSIEURS lots,
            #    donc on empile au lieu d'écraser comme pour le quota ──
            if i_lot is not None:
                iso = dlu_iso(r[i_dlu])
                num = str(r[i_lot] or '').strip()
                if iso and num:
                    try:
                        q = int(float(r[i_lq] or 0)) if i_lq is not None else 0
                    except (TypeError, ValueError):
                        q = 0
                    # Le NOM voyage avec le lot : une référence para/DM peut n'avoir
                    # jamais été vendue, donc être absente de l'index de l'écran —
                    # sans ce nom, le couloir afficherait un code à 13 chiffres nu.
                    nm = str(r[i_de] or '').strip() if i_de is not None else ''
                    ligne = [num, iso, q, nm]
                    ll = lots.setdefault(c, [])
                    if ligne not in ll:
                        ll.append(ligne)
                        nP += 1
        wb.close()
        sources.append({'f': os.path.basename(fn), 'd': d, 'labo': nL, 'quota': nQ, 'lots': nP})
        print('  %s (%s) : %d fournisseurs, %d quotas, %d lots%s'
              % (os.path.basename(fn), d, nL, nQ, nP,
                 '' if i_lot is not None else '  (pas de colonne lot/péremption dans cet export)'))

    asof = max(s['d'] for s in sources)
    out = {'generated': datetime.date.today().isoformat(),
           'source': 'exports de stock des établissements (colonnes contmode/contqte/artcollection)',
           'asof': asof, 'sources': sources,
           'nLabo': len(labo), 'nQuota': len(quota),
           'labo': labo, 'quota': quota}
    # Tant que l'export ne porte pas les lots, la clé est ABSENTE du fichier :
    # un `lots: {}` se lirait « aucun lot à écouler », ce qui est faux — on ne
    # sait pas. L'écran ④ garde alors son message d'attente.
    if lots:
        for v in lots.values():
            v.sort(key=lambda x: x[1])
        out['nLots'] = sum(len(v) for v in lots.values())
        out['lots'] = lots
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with io.open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('OK -> %s' % OUT)
    print('  fournisseurs comblés : %d · sous quota : %d · arrêté au %s · %.0f Ko'
          % (len(labo), len(quota), asof, os.path.getsize(OUT) / 1024))
    if lots:
        print('  lots datés : %d sur %d références' % (out['nLots'], len(lots)))
    else:
        print('  lots datés : aucun — les exports ne portent pas encore de colonne '
              'lot + péremption, le couloir ④ ÉCOULER reste en attente.')

if __name__ == '__main__':
    main()

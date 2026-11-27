# -*- coding: utf-8 -*-
"""Positions réelles des officines de la carte (27/11/2026, choix de Will : « toute la France »).

La base nationale place la plupart des prospects au centre de leur commune puis en spirale
autour (build_pharma_fr.py, « éclatement ») : mesuré le 27/11, plus de la moitié des officines
reliées avec certitude à leur fiche FINESS étaient à plus d'1 km de leur adresse.

Ce script écrit positions_reelles.json : id officine -> [lat, lng] à l'adresse officielle,
pour chaque officine reliée AVEC CERTITUDE à sa fiche FINESS. build_pharma_fr.py le relit à chaque
régénération (après le géocodage, avant POSITIONS_CORRIGEES), pour que la correction ne s'efface pas.

Lien officine -> FINESS : ~/JARVIS/ETUDES-ZONE/brut/liens.json (secteurs des commerciaux), sinon
~/fiches-officines/correspondance-id-finess.json (le reste de la France, même méthode).
Certitude : méthode sûre (correspondance des fiches, même téléphone, complément par téléphone ou
par n° FINESS, correction vérifiée à la main) ET même téléphone, même code postal ou même commune.
Jamais un lien par la distance (« moins de 150 m ») ni par le nom seul (« code postal + nom »).
Position : celle de la fiche FINESS quand elle est placée au numéro ou à la rue (précision 1 à 3) ; quand
FINESS n'a que la commune (précision 4), le point BPE 2025 (INSEE) du même SIRET ; sans BPE, le point ne bouge pas.
Mesuré le 27/11/2026 à l'Adresse nationale (Géoplateforme IGN) là où les deux sources divergent de plus de 300 m :
FINESS juste 7 fois sur 8 au numéro (BPE à 260 m-1,3 km), sur sa rue 9 fois sur 12 contre 3 pour BPE en précision 2 ;
en précision 4, BPE sur la bonne rue 3 fois sur 8, FINESS jamais. (L'étude de zone, e08_lier.py, prend BPE d'abord :
écart sans effet sur ses distances, médiane BPE-FINESS 11 m.)

  python3 positions_reelles.py              # écrit positions_reelles.json
  python3 positions_reelles.py --appliquer  # + replace les points de crm/v2/pharma-fr-data.js (rien d'autre ne change)
Python 3.9.
"""
import ast
import csv
import datetime
import io
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.abspath(__file__))
EZ = os.path.expanduser('~/JARVIS/ETUDES-ZONE/brut')
LIENS = os.path.join(EZ, 'liens.json')
FINESS = os.path.join(EZ, 'finess620.json')
BPE = os.path.join(EZ, 'bpe_secteur.csv')
CORR = os.path.expanduser('~/fiches-officines/correspondance-id-finess.json')
PHARMA_FR = os.path.join(ROOT, 'crm', 'v2', 'pharma-fr-data.js')
OUT = os.path.join(ROOT, 'positions_reelles.json')
PREFIXE = 'window.PHARMA_FR='


def methode_sure(m):
    if m in ('correspondance des fiches', 'telephone'):
        return True
    if m.startswith('corr:'):                      # correspondance des fiches, hors secteurs
        return True
    if m.startswith('complément'):
        return 'téléphone' in m or 'identifiant JARVIS = n° FINESS' in m
    return m.startswith('correction du')           # liens vérifiés à la main (annuaire des entreprises)


def tel9(s):
    d = re.sub(r'\D', '', str(s or ''))
    return d[-9:] if len(d) >= 9 else None


def commune(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', str(s or '').upper()) if unicodedata.category(c) != 'Mn')
    s = re.sub(r'\bSAINTE?\b', lambda m: 'STE' if m.group(0) == 'SAINTE' else 'ST', s)
    s = re.sub(r'\bCEDEX\b.*$', '', s)
    return re.sub(r'[^A-Z0-9]', '', s)


def lire_pharma_fr(chemin):
    txt = io.open(chemin, encoding='utf-8').read()
    i = txt.index(PREFIXE)
    corps = txt[i + len(PREFIXE):].rstrip()
    if corps.endswith(';'):
        corps = corps[:-1]
    return txt[:i], json.loads(corps), txt[i + len(PREFIXE) + len(corps):]


def positions_corrigees():
    """POSITIONS_CORRIGEES de build_pharma_fr.py, lue sans importer le script (son import relance proteger_conditions)."""
    src = io.open(os.path.join(ROOT, 'build_pharma_fr.py'), encoding='utf-8').read()
    for n in ast.parse(src).body:
        if isinstance(n, ast.Assign) and any(getattr(t, 'id', '') == 'POSITIONS_CORRIGEES' for t in n.targets):
            return ast.literal_eval(n.value)
    sys.exit('ARRÊT : POSITIONS_CORRIGEES introuvable dans build_pharma_fr.py')


def calculer():
    for f in (LIENS, FINESS, BPE, CORR, PHARMA_FR):
        if not os.path.exists(f):
            sys.exit('ARRÊT : source absente ' + f)
    _, data, _ = lire_pharma_fr(PHARMA_FR)
    pts = {}
    for p in data['p']:
        pts.setdefault(str(p[13]), p)
    liens = json.load(open(LIENS, encoding='utf-8'))['liens']
    corr = json.load(open(CORR, encoding='utf-8'))
    fin = {p['finess']: p for p in json.load(open(FINESS, encoding='utf-8'))}
    bpe = {}
    for r in csv.reader(open(BPE, encoding='utf-8'), delimiter=';'):
        if r[2] == 'D307' and r[3] and r[3] not in ('_Z', ''):
            bpe.setdefault(r[3], (float(r[0]), float(r[1])))     # même règle qu'e08_lier.py : premier point du SIRET
    pos, cpt = {}, {'officines': len(pts), 'sans_lien': 0, 'lien_non_sur': 0, 'autre_commune': 0,
                    'sans_position': 0, 'gardees': 0, 'par_bpe': 0, 'par_finess': 0}
    for oid, p in pts.items():
        if oid in liens:
            f, m = liens[oid]['finess'], liens[oid]['methode']
        elif oid in corr:
            f, m = corr[oid]['finess'], 'corr:' + corr[oid]['methode']
        else:
            cpt['sans_lien'] += 1
            continue
        if not methode_sure(m):
            cpt['lien_non_sur'] += 1
            continue
        q = fin.get(f)
        if not q:
            cpt['sans_position'] += 1
            continue
        meme_tel = tel9(p[9]) is not None and tel9(p[9]) == tel9(q['tel'])
        meme_cp = q['ligne'][:5] == str(p[8])
        meme_commune = commune(q['ligne'][6:]) == commune(p[7])
        if not (meme_tel or meme_cp or meme_commune):
            cpt['autre_commune'] += 1
            continue
        b = bpe.get(q['siret'])
        if q['lat'] is not None and str(q['precision']) in ('1', '2', '3'):
            lng, lat = q['lon'], q['lat']; cpt['par_finess'] += 1
        elif b:
            lng, lat = b; cpt['par_bpe'] += 1        # FINESS au centre de la commune : le point INSEE est meilleur
        else:
            cpt['sans_position'] += 1                 # ni adresse FINESS précise ni point INSEE : on ne touche pas
            continue
        pos[oid] = [round(lat, 5), round(lng, 5)]
    cpt['gardees'] = len(pos)
    return pos, cpt


def appliquer(pos):
    """Replace les points de pharma-fr-data.js : seules les deux premières cases (lat, lng) changent."""
    tete, data, queue = lire_pharma_fr(PHARMA_FR)
    avant = tete + PREFIXE + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + queue
    if avant != io.open(PHARMA_FR, encoding='utf-8').read():
        sys.exit('ARRÊT : relecture de pharma-fr-data.js non identique, rien écrit')
    pc = {str(k): v for k, v in positions_corrigees().items()}
    n = 0
    for p in data['p']:
        oid = str(p[13])
        cible = list(pc[oid]) if oid in pc else pos.get(oid)   # les corrections à la main restent prioritaires
        if cible and [p[0], p[1]] != cible:
            p[0], p[1] = cible[0], cible[1]
            n += 1
    io.open(PHARMA_FR, 'w', encoding='utf-8').write(
        tete + PREFIXE + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + queue)
    return n


def main():
    pos, cpt = calculer()
    out = {'meta': {'genere': datetime.date.today().isoformat(),
                    'regle': 'officine reliée avec certitude à sa fiche FINESS : position FINESS (numéro ou rue), '
                             'sinon point BPE du SIRET ; ni l\'un ni l\'autre : inchangée',
                    'comptes': cpt},
           'pos': dict(sorted(pos.items()))}
    with io.open(OUT, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('positions_reelles.json :', json.dumps(cpt, ensure_ascii=False))
    if '--appliquer' in sys.argv:
        print('points replacés dans pharma-fr-data.js :', appliquer(pos))


if __name__ == '__main__':
    main()

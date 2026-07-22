# -*- coding: utf-8 -*-
"""Robot « reprises récentes » — 100% gratuit, sans géocodage.

Télécharge le flux FINESS+ (ANS) des établissements, isole les officines
(catégorie 620), et détecte les CHANGEMENTS D'ENTITÉ JURIDIQUE (nofinessej)
d'un établissement (nofinesset) entre deux passages = reprise/rachat récent.
Relie ces reprises aux officines de l'app (pharma-fr-data.js) par nom+CP, et
écrit crm/v2/reprises.json ({officineId: "YYYY-MM"}), fetché frais par l app.

Snapshot persistant : crm/v2/_finess_ej_snapshot.json (petit, commité, pour
diffuser d'un run à l'autre). 1er run = snapshot seul, aucune reprise.

Python 3.9. Aucune dépendance externe (urllib + csv). Pensé pour GitHub Actions.
"""
import os
import io
import re
import csv
import json
import time
import unicodedata
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
FINESS_URL = 'https://data-pipeline-open.s3.sbg.io.cloud.ovh.net/finess/finess_etablissements.csv'
PHARMA_FR = os.path.join(ROOT, 'crm', 'v2', 'pharma-fr-data.js')
SNAP = os.path.join(ROOT, 'crm', 'v2', '_finess_ej_snapshot.json')
OUT = os.path.join(ROOT, 'crm', 'v2', 'reprises.json')   # JSON pur, fetché frais par l'app (cache-buster)

_STOP = ('PHARMACIE', 'PHARMACIES', 'PHARMA', 'PHIE', 'PHIES', 'GRANDE', 'NOUVELLE',
         'DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'L', 'D', 'SARL', 'SELARL', 'SELAS',
         'SNC', 'EURL', 'SA', 'SAS')


def name_key(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', str(s or '')) if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^A-Z0-9 ]', ' ', s.upper())
    return ' '.join(t for t in s.split() if t and t not in _STOP)


def cp5(s):
    d = re.sub(r'[^0-9]', '', str(s or ''))
    return d.zfill(5)[:5] if d else ''


def download_finess():
    print('[reprises] téléchargement FINESS+ …')
    req = urllib.request.Request(FINESS_URL, headers={'User-Agent': 'jarvis-reprises/1.0'})
    raw = urllib.request.urlopen(req, timeout=180).read().decode('utf-8', 'ignore')
    rd = csv.DictReader(io.StringIO(raw), delimiter=';')
    offs = {}   # nofinesset -> {ej, key}
    for r in rd:
        if (r.get('categetab') or '').strip() != '620':
            continue
        nofi = (r.get('nofinesset') or '').strip()
        ej = (r.get('nofinessej') or '').strip()
        if not nofi:
            continue
        cp = cp5(r.get('ligneacheminement') or '')
        nk = name_key(r.get('rs') or '')
        offs[nofi] = {'ej': ej, 'key': (nk + '|' + cp) if (nk and cp) else ''}
    print('[reprises] %d officines (620) dans FINESS+' % len(offs))
    return offs


def load_pharma_index():
    """clé nom+CP -> id officine app (depuis pharma-fr-data.js)."""
    try:
        txt = open(PHARMA_FR, encoding='utf-8').read()
    except Exception as e:
        print('[reprises] pharma-fr-data.js illisible :', e)
        return {}
    m = re.search(r'window\.PHARMA_FR\s*=\s*(\{.*\});', txt, re.S)
    if not m:
        return {}
    data = json.loads(m.group(1))
    idx = {}
    for p in data.get('p', []):
        # [lat,lng,uga,grp,seg,comm,nom,ville,cp,tel,tit,email,ca,id]
        nom, cp, _id = (p[6] if len(p) > 6 else ''), (p[8] if len(p) > 8 else ''), (p[13] if len(p) > 13 else '')
        nk = name_key(nom)
        if nk and cp and _id:
            idx.setdefault(nk + '|' + cp5(cp), str(_id))
    print('[reprises] %d officines app indexées (nom+CP)' % len(idx))
    return idx


def main():
    cur = download_finess()
    prev = {}
    if os.path.exists(SNAP):
        try:
            prev = json.load(open(SNAP, encoding='utf-8'))
        except Exception:
            prev = {}

    mois = time.strftime('%Y-%m')
    pharma_idx = load_pharma_index()
    reprises = {}
    n_changes = 0
    if prev:   # rien à comparer au 1er run
        for nofi, info in cur.items():
            old_ej = prev.get(nofi)
            if old_ej and info['ej'] and old_ej != info['ej']:   # entité juridique changée = reprise
                n_changes += 1
                app_id = pharma_idx.get(info['key'])
                if app_id:
                    reprises[app_id] = mois

    # conserver les reprises encore « récentes » déjà présentes (< 8 mois) pour ne pas les perdre entre 2 runs
    try:
        for k, v in json.load(open(OUT, encoding='utf-8')).items():
            try:
                y, mm = int(v[:4]), int(v[5:7])
                age = (int(mois[:4]) - y) * 12 + (int(mois[5:7]) - mm)
                if 0 <= age < 8:
                    reprises.setdefault(k, v)
            except Exception:
                pass
    except Exception:
        pass

    json.dump(reprises, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(cur_snapshot(cur), open(SNAP, 'w', encoding='utf-8'), separators=(',', ':'))
    print('[reprises] %d changement(s) EJ détecté(s) · %d reliés à une officine app -> reprises.json' % (n_changes, len(reprises)))


def cur_snapshot(cur):
    return {k: v['ej'] for k, v in cur.items() if v['ej']}


if __name__ == '__main__':
    main()

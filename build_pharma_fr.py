# -*- coding: utf-8 -*-
"""Copilote — carte nationale des pharmacies par UGA.

Lit `Base France Décembre 2024.xlsx` (base nationale ~23 000 officines),
EXCLUT la Corse (dép. 20 / 2A / 2B), géocode par commune (BAN gratuit, cache
STATS/geocode_cache.json), éclate les points d'une même commune (jitter
déterministe) et écrit crm/v2/pharma-fr-data.js (window.PHARMA_FR, compact).

100% gratuit (BAN api-adresse.data.gouv.fr). Python 3.9, openpyxl.
"""
import openpyxl
import json
import os
import io
import re
import csv
import math
import time
import urllib.request

ROOT = os.path.dirname(__file__)
SRC = os.path.join(ROOT, 'Base France Décembre 2024.xlsx')
CACHE = os.path.join(ROOT, 'STATS', 'geocode_cache.json')
OUT = os.path.join(ROOT, 'crm', 'v2', 'pharma-fr-data.js')
BAN = 'https://api-adresse.data.gouv.fr/search/csv/'


def norm(s):
    return ' '.join(str(s or '').strip().upper().split())


def is_corse(cp):
    cp = str(cp or '').strip()
    return cp[:2] in ('20', '2A', '2B')


def load_cache():
    try:
        return json.load(open(CACHE, encoding='utf-8'))
    except Exception:
        return {}


def wml_commercials():
    """ID officine (CRM) -> commercial. Nos clients réseau, comme la carte secteur."""
    path = os.path.join(ROOT, 'crm', 'v2', 'wml-officines-data.js')
    out = {}
    try:
        txt = open(path, encoding='utf-8').read()
    except Exception:
        return out
    for obj in re.findall(r'\{[^{}]*\}', txt):
        mid = re.search(r'"id":"?([\w-]+)"?', obj)
        mc = re.search(r'"comms":\[\s*"([^"]+)"', obj)
        if mid and mc:
            out[mid.group(1)] = mc.group(1)
    return out


def ban_bulk(rows):
    """rows = list of (ville, cp). Renvoie {(ville,cp):(lat,lng)} via BAN CSV."""
    out = {}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(['ville', 'cp'])
    for v, c in rows:
        w.writerow([v, c])
    body = buf.getvalue().encode('utf-8')
    boundary = '----banjarvis'
    parts = []
    for name, val in [('columns', 'ville'), ('postcode', 'cp')]:
        parts.append('--' + boundary)
        parts.append('Content-Disposition: form-data; name="%s"' % name)
        parts.append('')
        parts.append(val)
    parts.append('--' + boundary)
    parts.append('Content-Disposition: form-data; name="data"; filename="a.csv"')
    parts.append('Content-Type: text/csv')
    parts.append('')
    payload = ('\r\n'.join(parts) + '\r\n').encode('utf-8') + body + ('\r\n--' + boundary + '--\r\n').encode('utf-8')
    req = urllib.request.Request(BAN, data=payload, headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with urllib.request.urlopen(req, timeout=120) as r:
        txt = r.read().decode('utf-8', 'ignore')
    rd = csv.DictReader(io.StringIO(txt))
    for row in rd:
        try:
            lat = float(row['latitude']); lng = float(row['longitude'])
            sc = float(row.get('result_score') or 0)
        except (ValueError, TypeError, KeyError):
            continue
        if sc >= 0.3:
            out[(row['ville'], row['cp'])] = (round(lat, 5), round(lng, 5))
    return out


def main():
    wb = openpyxl.load_workbook(SRC, read_only=True)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    hdr = [str(c) for c in next(it)]
    ix = {h: i for i, h in enumerate(hdr)}
    ci = {k: ix.get(k) for k in ('ID', 'Etablissement', 'Titulaire', 'CP', 'Ville', 'UGA',
                                 'SEGMENTATION', 'Groupement', 'Téléphone', 'Email', 'Statut')}

    comm_by_id = wml_commercials()   # ID officine -> commercial (nos clients réseau)
    SEG_MAP = {'clients a': 'Client A', 'clients b': 'Client B', 'clients c': 'Client C', 'prospects': 'Prospect'}

    pharmas = []          # (name, tit, ville, cp, uga, grp, seg, tel, mail, comm)
    need = {}             # (ville,cp) -> None
    for r in it:
        if str(r[ci['Statut']] or '').strip().lower() == 'supprimée':
            continue
        cp = str(r[ci['CP']] or '').strip()
        if not cp or is_corse(cp):
            continue
        cp = cp.zfill(5)
        ville = norm(r[ci['Ville']])
        if not ville:
            continue
        tit = str(r[ci['Titulaire']] or '').strip()
        name = str(r[ci['Etablissement']] or tit or '').strip()
        uga = str(r[ci['UGA']] or '').strip()
        grp = str(r[ci['Groupement']] or '').strip() or '—'
        seg = SEG_MAP.get(str(r[ci['SEGMENTATION']] or '').strip().lower(), 'Non défini')
        tel = str(r[ci['Téléphone']] or '').strip()
        mail = str(r[ci['Email']] or '').strip()
        comm = comm_by_id.get(str(r[ci['ID']] or '').strip(), '')
        pharmas.append((name, tit, ville, cp, uga, grp, seg, tel, mail, comm))
        need[(ville, cp)] = None
    wb.close()
    print('Pharmacies (hors Corse) :', len(pharmas), '| communes uniques :', len(need))

    # géocodage : cache + BAN pour les manquantes
    cache = load_cache()
    coords = {}
    todo = []
    for (ville, cp) in need:
        key = cp + ' ' + ville
        if key in cache and cache[key]:
            coords[(ville, cp)] = tuple(cache[key])
        else:
            todo.append((ville, cp))
    print('En cache :', len(coords), '| à géocoder :', len(todo))
    CH = 1200
    for i in range(0, len(todo), CH):
        chunk = todo[i:i + CH]
        got = ban_bulk(chunk)
        for k, v in got.items():
            coords[k] = v
            cache[k[1] + ' ' + k[0]] = list(v)
        print('  géocodé %d/%d (+%d)' % (min(i + CH, len(todo)), len(todo), len(got)))
        time.sleep(0.4)
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)

    # éclatement des points d'une même commune (spirale déterministe)
    seen = {}
    ugas, grps, segs, comms = {}, {}, {}, {'': 0}   # comm index 0 = pas notre client
    P = []
    dropped = 0
    for (name, tit, ville, cp, uga, grp, seg, tel, mail, comm) in pharmas:
        c = coords.get((ville, cp))
        if not c:
            dropped += 1
            continue
        k = (ville, cp)
        idx = seen.get(k, 0); seen[k] = idx + 1
        lat, lng = c
        if idx:
            ring = int((math.sqrt(idx))) + 1
            ang = idx * 2.399963  # angle d'or
            rad = 0.0016 * ring
            lat = round(lat + rad * math.cos(ang), 5)
            lng = round(lng + rad * math.sin(ang) / max(0.3, math.cos(math.radians(lat))), 5)
        ui = ugas.setdefault(uga, len(ugas))
        gi = grps.setdefault(grp, len(grps))
        si = segs.setdefault(seg, len(segs))
        ki = comms.setdefault(comm, len(comms))
        P.append([lat, lng, ui, gi, si, ki, name[:40], ville[:22], cp, tel[:18], tit[:34], mail[:44]])

    inv = lambda d: [k for k, _ in sorted(d.items(), key=lambda x: x[1])]
    nClients = sum(1 for p in P if segs and inv(segs)[p[4]].startswith('Client'))
    data = {
        'meta': {'n': len(P), 'communes': len(need), 'clients': nClients,
                 'source': 'Base France 12/2024 · hors Corse · statut actif'},
        'uga': inv(ugas), 'grp': inv(grps), 'seg': inv(segs), 'comm': inv(comms), 'p': P,
    }
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write('// Copilote — carte nationale pharmacies (hors Corse) : UGA, groupement,\n')
        fh.write('// segmentation client/prospect, commercial réseau. build_pharma_fr.py.\n')
        fh.write('// Chaque point: [lat,lng,ugaIdx,grpIdx,segIdx,commIdx,nom,ville,cp,tel,titulaire,email]\n')
        fh.write('window.PHARMA_FR=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('OK ->', OUT, '(%.1f Mo, %d pts, %d clients, %d UGA, %d comm, %d dropped)'
          % (os.path.getsize(OUT) / 1048576.0, len(P), nClients, len(ugas), len(comms) - 1, dropped))


if __name__ == '__main__':
    main()

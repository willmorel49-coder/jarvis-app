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
STATS = os.path.join(ROOT, 'STATS')
CACHE = os.path.join(ROOT, 'STATS', 'geocode_cache.json')
ADDR_CACHE = os.path.join(ROOT, 'STATS', 'geocode_addr_cache.json')  # adresse exacte -> [lat,lng]
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
    """ID officine (CRM) -> commercial + CA. Nos clients réseau, comme la carte secteur."""
    path = os.path.join(ROOT, 'crm', 'v2', 'wml-officines-data.js')
    comm, ca = {}, {}
    try:
        txt = open(path, encoding='utf-8').read()
    except Exception:
        return comm, ca
    for obj in re.findall(r'\{[^{}]*\}', txt):
        mid = re.search(r'"id":"?([\w-]+)"?', obj)
        if not mid:
            continue
        mc = re.search(r'"comms":\[\s*"([^"]+)"', obj)
        mca = re.search(r'"ca":(\d+)', obj)
        if mc:
            comm[mid.group(1)] = mc.group(1)
        if mca:
            ca[mid.group(1)] = int(mca.group(1))
    return comm, ca


def load_addresses():
    """TIRCODE (CIP) -> 'rue, cp ville' depuis les fichiers STATS *_geolocalisation_*.xlsx."""
    import glob
    out = {}
    for path in glob.glob(os.path.join(STATS, '*_geolocalisation_*.xlsx')):
        try:
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        except Exception:
            continue
        ws = wb.active
        it = ws.iter_rows(values_only=True)
        hdr = [str(c) for c in next(it)]
        ix = {h: i for i, h in enumerate(hdr)}
        def g(r, k):
            i = ix.get(k)
            return str(r[i]).strip() if (i is not None and i < len(r) and r[i] is not None) else ''
        for r in it:
            code = g(r, 'TIRCODE')
            if not code:
                continue
            rue = g(r, 'ADRL3') or g(r, 'ADRL2') or g(r, 'ADRL1')
            cp = g(r, 'ADRCODEPOSTAL').zfill(5) if g(r, 'ADRCODEPOSTAL') else ''
            ville = g(r, 'ADRVILLE')
            if rue and (cp or ville):
                out[code] = (rue + ', ' + cp + ' ' + ville).strip(' ,')
        wb.close()
    return out


def ban_addr_bulk(rows):
    """rows = list of (id, adresse). Renvoie {id:(lat,lng)} via BAN CSV (adresse exacte)."""
    out = {}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(['id', 'adresse'])
    for i, a in rows:
        w.writerow([i, a])
    body = buf.getvalue().encode('utf-8')
    boundary = '----banjarvisA'
    parts = []
    for name, val in [('columns', 'adresse')]:
        parts += ['--' + boundary, 'Content-Disposition: form-data; name="%s"' % name, '', val]
    parts += ['--' + boundary, 'Content-Disposition: form-data; name="data"; filename="a.csv"', 'Content-Type: text/csv', '']
    payload = ('\r\n'.join(parts) + '\r\n').encode('utf-8') + body + ('\r\n--' + boundary + '--\r\n').encode('utf-8')
    req = urllib.request.Request(BAN, data=payload, headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with urllib.request.urlopen(req, timeout=180) as r:
        txt = r.read().decode('utf-8', 'ignore')
    for row in csv.DictReader(io.StringIO(txt)):
        try:
            lat = float(row['latitude']); lng = float(row['longitude']); sc = float(row.get('result_score') or 0)
        except (ValueError, TypeError, KeyError):
            continue
        if sc >= 0.4:
            out[row['id']] = (round(lat, 5), round(lng, 5))
    return out


def exact_coords():
    """{id:(lat,lng)} — adresse exacte géocodée (cache STATS/geocode_addr_cache.json)."""
    addr = load_addresses()
    try:
        cache = json.load(open(ADDR_CACHE, encoding='utf-8'))
    except Exception:
        cache = {}
    todo, coords = [], {}
    for cid, a in addr.items():
        if a in cache and cache[a]:
            coords[cid] = tuple(cache[a])
        else:
            todo.append((cid, a))
    print('Adresses exactes : %d connues | %d en cache | %d à géocoder' % (len(addr), len(coords), len(todo)))
    CH = 800
    for i in range(0, len(todo), CH):
        chunk = todo[i:i + CH]
        try:
            got = ban_addr_bulk(chunk)
        except Exception as e:
            print('  [addr] err', e); break
        for cid, a in chunk:
            if cid in got:
                coords[cid] = got[cid]
                cache[a] = list(got[cid])
        print('  adresses géocodées %d/%d' % (min(i + CH, len(todo)), len(todo)))
        time.sleep(0.4)
    json.dump(cache, open(ADDR_CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
    return coords


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

    comm_by_id, ca_by_id = wml_commercials()   # ID officine -> commercial + CA (nos clients réseau)
    EX = exact_coords()                          # ID officine -> (lat,lng) adresse exacte
    SEG_MAP = {'clients a': 'Client A', 'clients b': 'Client B', 'clients c': 'Client C', 'prospects': 'Prospect'}

    pharmas = []          # (name, tit, ville, cp, uga, grp, seg, tel, mail, comm, ca, id)
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
        _id = str(r[ci['ID']] or '').strip()
        comm = comm_by_id.get(_id, '')
        ca = ca_by_id.get(_id, 0)
        pharmas.append((name, tit, ville, cp, uga, grp, seg, tel, mail, comm, ca, _id))
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
    nExact = 0
    for (name, tit, ville, cp, uga, grp, seg, tel, mail, comm, ca, _id) in pharmas:
        ex = EX.get(_id)
        if ex:
            lat, lng = ex; nExact += 1   # adresse exacte : position réelle, pas de jitter
        else:
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
        P.append([lat, lng, ui, gi, si, ki, name[:40], ville[:22], cp, tel[:18], tit[:34], mail[:44], ca or 0, _id])

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
        fh.write('// Chaque point: [lat,lng,ugaIdx,grpIdx,segIdx,commIdx,nom,ville,cp,tel,titulaire,email,ca,id]\n')
        fh.write('window.PHARMA_FR=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('OK ->', OUT, '(%.1f Mo, %d pts, %d clients, %d adresses exactes, %d UGA, %d comm, %d dropped)'
          % (os.path.getsize(OUT) / 1048576.0, len(P), nClients, nExact, len(ugas), len(comms) - 1, dropped))


if __name__ == '__main__':
    main()

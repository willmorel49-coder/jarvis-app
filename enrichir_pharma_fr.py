# -*- coding: utf-8 -*-
"""Lot 3 — base carte « mélangée » (21/09/2026).

Part de crm/v2/pharma-fr-data.js (Base France 12/2024 + FINESS Corse) et
l'enrichit avec toutes les sources par-officine disponibles :
  - FINESS du jour (data-pipeline-open, CSV léger, categetab=620) : téléphone,
    UGA, dates d'ouverture/autorisation, ouvertures, preuve de fermeture ;
  - pharmacies_par_groupement.xlsx (national, ~17 500 officines) : groupement ;
  - crm/v2/wml-officines-data.js (1 934 clients CRM) : groupement des clients ;
  - crm/v2/mails-complement-data.js (133 officines) : e-mail / téléphone ;
  - crm/v2/parc-mouvements.json (généré aujourd'hui) : preuve de fermeture.

NE modifie PAS build_pharma_fr.py. NE touche AUCUN id existant. N'écrit AUCUN
CA / condition commerciale (colonne ca reste à 0). Écrit en sortie hors du
worktree pendant la mise au point (--out).

Format inchangé : window.PHARMA_FR={meta,uga,grp,seg,comm,p}
Point : [lat,lng,ugaIdx,grpIdx,segIdx,commIdx,nom,ville,cp,tel,titulaire,email,ca,id]

Usage :
  /usr/bin/python3 enrichir_pharma_fr.py --out /chemin/de/sortie.js
"""
import argparse
import csv
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
LIVE_APP = '/Users/williammorel/JARVIS/APP'  # dépôt vivant : STATS (gitignoré, hors worktree)
OUT_SORTIES = '/Users/williammorel/.claude/outils/sorties/carte-lot3-2026-09-21'

PHARMA_FR_IN = os.path.join(ROOT, 'crm', 'v2', 'pharma-fr-data.js')
WML = os.path.join(ROOT, 'crm', 'v2', 'wml-officines-data.js')
MAILS = os.path.join(ROOT, 'crm', 'v2', 'mails-complement-data.js')
PARC_MVT = os.path.join(ROOT, 'crm', 'v2', 'parc-mouvements.json')
GRP_MAP = '/Users/williammorel/JARVIS/GROUPEMENTS/data/output/pharmacies_par_groupement.xlsx'
FINESS_OLD = '/Users/williammorel/JARVIS/GROUPEMENTS/data/finess/finess1.csv'  # périmé (05/06 ou 12/05)
FINESS_TODAY = os.path.join(OUT_SORTIES, 'data', 'finess_etablissements.csv')  # téléchargé le jour même
GAN = 'https://data.geopf.fr/geocodage/search/csv/'  # Géoplateforme IGN (même appel que build_pharma_fr.py)

DATE_LIMITE_OUVERTURE = '2024-12-01'


# ───────────────────────── helpers repris de build_pharma_fr.py (mêmes règles) ─────────────────────────

_STOP = ('PHARMACIE', 'PHARMACIES', 'PHARMA', 'PHIE', 'PHIES', 'GRANDE', 'DE', 'DU',
         'DES', 'LA', 'LE', 'LES', 'L', 'D', 'SARL', 'SELARL', 'SELAS', 'SNC', 'EURL')


def norm(s):
    return ' '.join(str(s or '').strip().upper().split())


def name_key(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', str(s or '')) if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^A-Z0-9 ]', ' ', s.upper())
    return ' '.join(t for t in s.split() if t and t not in _STOP)


def cp5(s):
    d = re.sub(r'[^0-9]', '', str(s or ''))
    return d.zfill(5)[:5] if d else ''


def tel_key(s):
    """Téléphone normalisé (10 chiffres, 0033/+33 -> 0)."""
    d = re.sub(r'[^0-9]', '', str(s or ''))
    if d.startswith('33') and len(d) == 11:
        d = '0' + d[2:]
    if d.startswith('0033'):
        d = '0' + d[4:]
    return d if len(d) == 10 else ''


def grp_canon(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', str(s or '')) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^A-Z0-9]', '', s.upper())


def is_corse(cp):
    cp = str(cp or '').strip()
    return cp[:2] in ('20', '2A', '2B')


def log(*a):
    print(*a)
    sys.stdout.flush()


# ───────────────────────── chargement pharma-fr-data.js ─────────────────────────

def load_pharma_fr():
    txt = open(PHARMA_FR_IN, encoding='utf-8').read()
    m = re.search(r'window\.PHARMA_FR\s*=\s*(\{.*\});', txt, re.S)
    data = json.loads(m.group(1))
    return data


# ───────────────────────── FINESS du jour (data-pipeline-open) ─────────────────────────

def dep_metro_corse(d):
    d = (d or '').strip()
    return d in ('2A', '2B') or (d.isdigit() and 1 <= int(d) <= 95)


def load_finess_today():
    """Officines (620) FINESS du jour, métropole+Corse. Renvoie une liste de dicts."""
    csv.field_size_limit(10 ** 7)
    out = []
    with open(FINESS_TODAY, encoding='utf-8', errors='ignore') as f:
        rd = csv.DictReader(f, delimiter=';')
        for r in rd:
            if (r.get('categetab') or '').strip() != '620':
                continue
            if not dep_metro_corse(r.get('departement')):
                continue
            m = re.match(r'\s*(\d{5})\s+(.*)', r.get('ligneacheminement') or '')
            cp = m.group(1) if m else ''
            ville = norm(m.group(2)) if m else ''
            nom = (r.get('rs') or r.get('rslongue') or '').strip()
            voie = ' '.join(x for x in [r.get('numvoie', ''), r.get('typvoie', ''), r.get('voie', ''),
                                        r.get('compvoie', '')] if x).strip()
            adresse = (voie or r.get('lieuditbp') or '') + ', ' + cp + ' ' + ville
            out.append({
                'id': (r.get('nofinesset') or '').strip(),
                'nom': nom,
                'cp': cp,
                'ville': ville,
                'tel': (r.get('telephone') or '').strip(),
                'dateouv': (r.get('dateouv') or '').strip(),
                'dateautor': (r.get('dateautor') or '').strip(),
                'adresse': adresse.strip(' ,'),
            })
    return out


# ───────────────────────── mapping groupement national ─────────────────────────

def load_groupement_map():
    import openpyxl
    if not os.path.exists(GRP_MAP):
        log('  [grp] mapping absent :', GRP_MAP)
        return {}, {}
    wb = openpyxl.load_workbook(GRP_MAP, read_only=True, data_only=True)
    acc, canon = {}, {}
    for ws in wb.worksheets:
        if ws.title == 'Sommaire':
            continue
        canon.setdefault(grp_canon(ws.title), ws.title)
        it = ws.iter_rows(values_only=True)
        next(it, None)
        for r in it:
            nom = r[0] if len(r) > 0 else ''
            cp = r[3] if len(r) > 3 else ''
            nk, cc = name_key(nom), cp5(cp)
            if nk and cc:
                acc.setdefault((cc, nk), set()).add(ws.title)
    wb.close()
    out = {k: next(iter(v)) for k, v in acc.items() if len(v) == 1}
    log('  [grp] mapping : %d clés uniques (%d ambigües ignorées), %d groupements'
        % (len(out), sum(1 for v in acc.values() if len(v) > 1), len(canon)))
    return out, canon


# ───────────────────────── CRM : clients (groupement) + compléments mail/tel ─────────────────────────

def load_wml_groupements():
    """id CRM -> groupement (des 1 934 clients)."""
    out = {}
    try:
        txt = open(WML, encoding='utf-8').read()
    except Exception:
        return out
    for obj in re.findall(r'\{[^{}]*\}', txt):
        mid = re.search(r'"id":"?([\w-]+)"?', obj)
        mg = re.search(r'"groupement":"([^"]*)"', obj)
        if mid and mg and mg.group(1):
            out[mid.group(1)] = mg.group(1)
    return out


def load_mails_complement():
    """id -> {email, tel}."""
    out = {}
    try:
        txt = open(MAILS, encoding='utf-8').read()
    except Exception:
        return out
    for mid, body in re.findall(r'"(\d+)":\{([^}]*)\}', txt):
        e = re.search(r'email:"([^"]*)"', body)
        t = re.search(r'tel:"([^"]*)"', body)
        out[mid] = {'email': e.group(1) if e else '', 'tel': t.group(1) if t else ''}
    return out


def load_parc_mouvements():
    try:
        return json.load(open(PARC_MVT, encoding='utf-8'))
    except Exception:
        return {}


# ───────────────────────── FINESS périmé (05/06 ou date antérieure) : preuve de fermeture ─────────────────────────

def load_finess_old_ids():
    """Ensemble des n° FINESS (620) présents dans le snapshot périmé + index
    (cp, name_key) -> id — pour prouver qu'une officine EXISTAIT alors (sous un
    n° donné) et a disparu du snapshot du jour."""
    if not os.path.exists(FINESS_OLD):
        log('  [finess-old] absent :', FINESS_OLD)
        return set(), {}, ''
    csv.field_size_limit(10 ** 7)
    out = set()
    idx = {}
    idx_tel = {}
    maj = ''
    with open(FINESS_OLD, encoding='utf-8', errors='ignore') as f:
        first = f.readline()
        parts = first.strip().split(';')
        if len(parts) >= 4:
            maj = parts[3]
        f.seek(0)
        for row in csv.reader(f, delimiter=';'):
            if len(row) < 19 or row[0] != 'structureet' or row[18].strip() != '620':
                continue
            fid = row[1].strip()
            out.add(fid)
            m = re.match(r'\s*(\d{5})\s+(.*)', row[15] or '')
            if m:
                rs = (row[3] or row[4] or '').strip()
                cp = m.group(1)
                key = (cp, name_key(rs))
                if rs:
                    idx.setdefault(key, set()).add(fid)
                tk = tel_key(row[16] if len(row) > 16 else '')
                if tk:
                    idx_tel.setdefault((cp, tk), set()).add(fid)
    idx_uniq = {k: next(iter(v)) for k, v in idx.items() if len(v) == 1}
    idx_tel_uniq = {k: next(iter(v)) for k, v in idx_tel.items() if len(v) == 1}
    return out, idx_uniq, idx_tel_uniq, maj


# ───────────────────────── géocodage BAN (Géoplateforme IGN) ─────────────────────────

def ban_addr_bulk(rows):
    out = {}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(['id', 'adresse'])
    for i, a in rows:
        w.writerow([i, a])
    body = buf.getvalue().encode('utf-8')
    boundary = '----banjarvisEnrich'
    parts = []
    for name, val in [('columns', 'adresse')]:
        parts += ['--' + boundary, 'Content-Disposition: form-data; name="%s"' % name, '', val]
    parts += ['--' + boundary, 'Content-Disposition: form-data; name="data"; filename="a.csv"', 'Content-Type: text/csv', '']
    payload = ('\r\n'.join(parts) + '\r\n').encode('utf-8') + body + ('\r\n--' + boundary + '--\r\n').encode('utf-8')
    req = urllib.request.Request(GAN, data=payload, headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with urllib.request.urlopen(req, timeout=180) as r:
        txt = r.read().decode('utf-8', 'ignore')
    for row in csv.DictReader(io.StringIO(txt)):
        try:
            lat = float(row['latitude']); lng = float(row['longitude']); sc = float(row.get('result_score') or 0)
        except (ValueError, TypeError, KeyError):
            continue
        if sc >= 0.4:
            out[row['id']] = (round(lat, 5), round(lng, 5), sc)
    return out


def in_bbox_metro(lat, lng):
    return 41.0 <= lat <= 51.6 and -5.5 <= lng <= 9.8


# ───────────────────────── programme principal ─────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, help='fichier .js de sortie (JAMAIS le worktree pendant la mise au point)')
    ap.add_argument('--no-geocode', action='store_true', help='saute le géocodage des ouvertures (test rapide)')
    args = ap.parse_args()

    report = {}

    log('== 1. chargement pharma-fr-data.js actuel ==')
    data = load_pharma_fr()
    P = data['p']
    uga_l, grp_l, seg_l, comm_l = data['uga'], data['grp'], data['seg'], data['comm']
    n0 = len(P)
    ids0 = [p[13] for p in P]
    ids0_set = set(ids0)
    log('   %d points | %d id uniques (%d doublons préexistants, non touchés)'
        % (n0, len(ids0_set), n0 - len(ids0_set)))
    report['avant'] = {
        'n': n0, 'id_uniques': len(ids0_set),
        'tel_vide': sum(1 for p in P if not p[9]),
        'mail_vide': sum(1 for p in P if not p[11]),
        'grp_vide': sum(1 for p in P if grp_l[p[3]] == '—'),
        'uga_vide': sum(1 for p in P if not uga_l[p[2]]),
    }

    log('== 2. index de la carte par (cp, name_key) et (cp, tel) ==')
    idx_cp_name = {}
    idx_cp_tel = {}
    idx_ville_name = {}
    for i, p in enumerate(P):
        cp, nom, ville, tel = p[8], p[6], p[7], p[9]
        idx_cp_name.setdefault((cp, name_key(nom)), []).append(i)
        tk = tel_key(tel)
        if tk:
            idx_cp_tel.setdefault((cp, tk), []).append(i)
        idx_ville_name.setdefault((ville, name_key(nom)), []).append(i)

    log('== 3. FINESS du jour ==')
    fin = load_finess_today()
    log('   %d officines FINESS (620, métropole+Corse)' % len(fin))

    log('== 4. rapprochement id-carte <-> FINESS ==')
    match_a = 0  # cp+nom
    match_b = 0  # cp+tel
    match_c = 0  # ville+nom approché unique
    matched_carte_idx = set()   # indices carte déjà rapprochés
    matched_finess_id = set()   # n° FINESS déjà rapprochés
    fin_to_carte = {}           # finess id -> carte idx
    corr_table = {}             # carte id -> {finess, methode}

    for f in fin:
        key = (f['cp'], name_key(f['nom']))
        cands = idx_cp_name.get(key)
        if cands and len(cands) >= 1:
            ci = cands[0]
            if ci not in matched_carte_idx:
                matched_carte_idx.add(ci); matched_finess_id.add(f['id']); fin_to_carte[f['id']] = ci
                corr_table[P[ci][13]] = {'finess': f['id'], 'methode': 'cp+nom'}
                match_a += 1
                continue
    for f in fin:
        if f['id'] in matched_finess_id:
            continue
        tk = tel_key(f['tel'])
        if not tk:
            continue
        cands = idx_cp_tel.get((f['cp'], tk))
        if cands:
            ci = cands[0]
            if ci not in matched_carte_idx:
                matched_carte_idx.add(ci); matched_finess_id.add(f['id']); fin_to_carte[f['id']] = ci
                corr_table[P[ci][13]] = {'finess': f['id'], 'methode': 'cp+tel'}
                match_b += 1
                continue
    for f in fin:
        if f['id'] in matched_finess_id:
            continue
        cands = idx_ville_name.get((f['ville'], name_key(f['nom'])))
        if cands:
            uniq = [c for c in cands if c not in matched_carte_idx]
            if len(uniq) == 1:
                ci = uniq[0]
                matched_carte_idx.add(ci); matched_finess_id.add(f['id']); fin_to_carte[f['id']] = ci
                corr_table[P[ci][13]] = {'finess': f['id'], 'methode': 'ville+nom(unique)'}
                match_c += 1

    log('   méthode cp+nom       : %d' % match_a)
    log('   méthode cp+tel       : %d' % match_b)
    log('   méthode ville+nom(1) : %d' % match_c)
    log('   total rapprochés     : %d / %d FINESS (%.1f%%) | %d / %d carte (%.1f%%)'
        % (len(matched_finess_id), len(fin), 100.0 * len(matched_finess_id) / max(1, len(fin)),
           len(matched_carte_idx), n0, 100.0 * len(matched_carte_idx) / n0))
    report['rapprochement'] = {
        'finess_total': len(fin), 'carte_total': n0,
        'methode_cp_nom': match_a, 'methode_cp_tel': match_b, 'methode_ville_nom': match_c,
        'total_finess_matches': len(matched_finess_id), 'total_carte_matches': len(matched_carte_idx),
    }

    # contrôle Corse : les 126 officines de Corse ont déjà leur n° FINESS comme id
    corse_idx = [i for i, p in enumerate(P) if is_corse(p[8])]
    corse_ok = sum(1 for i in corse_idx if i in matched_carte_idx)
    log('   contrôle Corse : %d/%d officines corses rapprochées (%.1f%%)'
        % (corse_ok, len(corse_idx), 100.0 * corse_ok / max(1, len(corse_idx))))
    report['controle_corse'] = {'n': len(corse_idx), 'rapprochees': corse_ok}

    os.makedirs(OUT_SORTIES, exist_ok=True)
    json.dump(corr_table, open(os.path.join(OUT_SORTIES, 'C-correspondance-id-finess.json'), 'w', encoding='utf-8'),
               ensure_ascii=False, indent=0)

    log('== 5a. téléphone vide -> FINESS ==')
    n_tel_before = sum(1 for p in P if not p[9])
    n_tel_fill = 0
    fin_by_id = {f['id']: f for f in fin}  # index finess par id pour lookup O(1)
    for fid, ci in fin_to_carte.items():
        p = P[ci]
        if not p[9]:
            tel = fin_by_id[fid]['tel']
            if tel:
                p[9] = tel[:18]
                n_tel_fill += 1
    log('   téléphone vide avant %d -> comblés %d -> restant %d' % (n_tel_before, n_tel_fill, n_tel_before - n_tel_fill))

    log('== 5b. groupement vide -> mapping national puis CRM ==')
    grpmap, grpcanon = load_groupement_map()
    wml_grp = load_wml_groupements()
    n_grp_before = sum(1 for p in P if grp_l[p[3]] == '—')
    n_grp_fill_map = 0
    n_grp_fill_crm = 0
    idx_g = {g: i for i, g in enumerate(grp_l)}
    def grp_idx(name):
        c = grpcanon.get(grp_canon(name), name)
        if c not in idx_g:
            idx_g[c] = len(grp_l); grp_l.append(c)
        return idx_g[c]
    for p in P:
        if grp_l[p[3]] != '—':
            continue
        cp, nom = p[8], p[6]
        g2 = grpmap.get((cp, name_key(nom)))
        if g2:
            p[3] = grp_idx(g2)
            n_grp_fill_map += 1
            continue
        g3 = wml_grp.get(p[13])
        if g3:
            p[3] = grp_idx(g3)
            n_grp_fill_crm += 1
    n_grp_after = sum(1 for p in P if grp_l[p[3]] == '—')
    log('   groupement vide avant %d -> +%d (mapping national) +%d (CRM clients) -> restant %d'
        % (n_grp_before, n_grp_fill_map, n_grp_fill_crm, n_grp_after))

    log('== 5c. e-mail / téléphone vides -> mails-complement-data.js ==')
    mails = load_mails_complement()
    n_mail_before = sum(1 for p in P if not p[11])
    n_mail_fill = 0
    n_tel_fill2 = 0
    for p in P:
        c = mails.get(p[13])
        if not c:
            continue
        if not p[11] and c.get('email'):
            p[11] = c['email'][:44]
            n_mail_fill += 1
        if not p[9] and c.get('tel'):
            p[9] = c['tel'][:18]
            n_tel_fill2 += 1
    n_mail_after = sum(1 for p in P if not p[11])
    log('   e-mail vide avant %d -> comblés %d -> restant %d (+ %d téléphones en plus)'
        % (n_mail_before, n_mail_fill, n_mail_after, n_tel_fill2))

    log('== 5d. UGA vide -> UGA majoritaire du même CP sur la carte ==')
    from collections import Counter
    cp_uga_count = {}
    for p in P:
        u = uga_l[p[2]]
        if u:
            cp_uga_count.setdefault(p[8], Counter())[u] += 1
    n_uga_before = sum(1 for p in P if not uga_l[p[2]])
    n_uga_fill = 0
    idx_u = {u: i for i, u in enumerate(uga_l)}
    def uga_idx(name):
        if name not in idx_u:
            idx_u[name] = len(uga_l); uga_l.append(name)
        return idx_u[name]
    for p in P:
        if uga_l[p[2]]:
            continue
        cnt = cp_uga_count.get(p[8])
        if cnt:
            best = cnt.most_common(1)[0][0]
            p[2] = uga_idx(best)
            n_uga_fill += 1
    n_uga_after = sum(1 for p in P if not uga_l[p[2]])
    log('   UGA vide avant %d -> comblés %d -> restant %d (aucune officine au même CP)'
        % (n_uga_before, n_uga_fill, n_uga_after))

    log('== 5e. ouvertures : FINESS non rapprochées + date récente ==')
    unmatched_fin = [f for f in fin if f['id'] not in matched_finess_id]
    recents, anciennes = [], []
    for f in unmatched_fin:
        dmax = max(f['dateouv'] or '', f['dateautor'] or '')
        if dmax > DATE_LIMITE_OUVERTURE:
            recents.append(f)
        else:
            anciennes.append(f)
    log('   FINESS sans correspondance : %d (dont %d récentes -> candidates ouverture, %d anciennes -> probable défaut de rapprochement)'
        % (len(unmatched_fin), len(recents), len(anciennes)))
    json.dump([{'finess': a['id'], 'nom': a['nom'], 'cp': a['cp'], 'ville': a['ville'],
                'dateouv': a['dateouv'], 'dateautor': a['dateautor']} for a in anciennes[:30]],
              open(os.path.join(OUT_SORTIES, 'D-anciennes-non-rapprochees-exemple30.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)

    # Garde-fou anti-doublon (21/09/2026) : une officine REPRISE ou TRANSFÉRÉE reçoit un nouveau n° FINESS
    # et souvent une nouvelle raison sociale. Mesuré : 254 des 283 « récentes » tombaient dans un code
    # postal où la carte porte déjà une officine NON rapprochée (village à une seule pharmacie) — les
    # ajouter aurait créé des doublons. On n'ajoute donc que les ouvertures dont le code postal ne
    # contient AUCUNE officine de la carte restée sans correspondance ; les autres sont listées à part.
    cp_non_rapproche = set(P[i][8] for i in range(n0) if i not in matched_carte_idx)
    reprises_probables = [f for f in recents if f['cp'] in cp_non_rapproche]
    recents = [f for f in recents if f['cp'] not in cp_non_rapproche]
    log('   garde-fou doublon : %d reprises/transferts probables écartés, %d ouvertures franches gardées'
        % (len(reprises_probables), len(recents)))
    json.dump([{'finess': a['id'], 'nom': a['nom'], 'cp': a['cp'], 'ville': a['ville'],
                'dateouv': a['dateouv'], 'dateautor': a['dateautor']} for a in reprises_probables],
              open(os.path.join(OUT_SORTIES, 'G-reprises-probables.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)

    n_ouvertures_added = 0
    n_ouvertures_geocode_fail = 0
    if recents and not args.no_geocode:
        rows = [(f['id'], f['adresse']) for f in recents]
        got = {}
        CH = 400
        for i in range(0, len(rows), CH):
            chunk = rows[i:i + CH]
            try:
                g = ban_addr_bulk(chunk)
                got.update(g)
            except Exception as e:
                log('   [geocode ouvertures] erreur', e)
            time.sleep(0.3)
        log('   géocodées : %d / %d' % (len(got), len(recents)))
        for f in recents:
            g = got.get(f['id'])
            if not g:
                n_ouvertures_geocode_fail += 1
                continue
            lat, lng, sc = g
            if not in_bbox_metro(lat, lng) and not is_corse(f['cp']):
                n_ouvertures_geocode_fail += 1
                continue
            grp = grpmap.get((f['cp'], name_key(f['nom'])), '')
            if grp:
                grp = grpcanon.get(grp_canon(grp), grp)
            grp = grp or '—'
            gi = grp_idx(grp)
            ui = 0
            cnt = cp_uga_count.get(f['cp'])
            if cnt:
                ui = uga_idx(cnt.most_common(1)[0][0])
            si = seg_l.index('Prospect') if 'Prospect' in seg_l else len(seg_l)
            if si == len(seg_l):
                seg_l.append('Prospect')
            ki = 0  # pas notre client
            P.append([lat, lng, ui, gi, si, ki, f['nom'][:40], f['ville'][:22], f['cp'], f['tel'][:18], '', '', 0, f['id']])
            n_ouvertures_added += 1
    elif args.no_geocode:
        log('   --no-geocode : ouvertures NON géocodées, NON ajoutées (test rapide)')
    log('   ouvertures ajoutées : %d (échec géocodage/bbox : %d)' % (n_ouvertures_added, n_ouvertures_geocode_fail))

    log('== 5f. fermetures : preuve positive uniquement ==')
    wml_ids = set()
    try:
        txt = open(WML, encoding='utf-8').read()
        wml_ids = set(re.findall(r'"id":"?([\w-]+)"?', txt))
    except Exception:
        pass
    finess_old_ids, finess_old_idx, finess_old_idx_tel, old_maj = load_finess_old_ids()
    parc = load_parc_mouvements()
    parc_fermees_ids = set(x['finess'] for x in parc.get('fermetures', []))
    fin_ids_today = set(f['id'] for f in fin)
    log('   FINESS ancien (%s) : %d ids (%d clés cp+nom uniques) | parc-mouvements.json fermetures listées : %d'
        % (old_maj or '?', len(finess_old_ids), len(finess_old_idx), len(parc_fermees_ids)))

    unmatched_carte_idx = [i for i in range(n0) if i not in matched_carte_idx]  # sur les n0 pts d'origine
    fermees = []
    n_skip_client = 0
    for i in unmatched_carte_idx:
        p = P[i]
        cid = p[13]
        if cid in wml_ids:
            n_skip_client += 1
            continue  # un client du CRM n'est JAMAIS marqué fermé
        preuve = None
        # 1) l'id carte lui-même est un n° FINESS (cas Corse/ex-ouvertures) : présent hier, absent aujourd'hui
        if cid in finess_old_ids and cid not in fin_ids_today:
            preuve = 'id = n° FINESS %s, présent dans le snapshot du %s, absent du FINESS du jour' % (cid, old_maj or '?')
        elif cid in parc_fermees_ids:
            preuve = 'listée fermée dans parc-mouvements.json (id=n° FINESS)'
        else:
            # 2) rapprochement par (cp, nom) puis (cp, tel) avec le snapshot périmé -> n° FINESS d'alors
            old_fid = finess_old_idx.get((p[8], name_key(p[6]))) or finess_old_idx_tel.get((p[8], tel_key(p[9])))
            if old_fid:
                if old_fid in parc_fermees_ids:
                    preuve = 'rapprochée (cp+nom) au n° FINESS %s, listée fermée dans parc-mouvements.json' % old_fid
                elif old_fid not in fin_ids_today:
                    preuve = 'rapprochée (cp+nom) au n° FINESS %s, présent le %s, absent du FINESS du jour' % (old_fid, old_maj or '?')
        if preuve:
            fermees.append({'id': cid, 'nom': p[6], 'ville': p[7], 'cp': p[8], 'preuve': preuve})
    log('   officines carte sans correspondance FINESS : %d (dont %d clients CRM jamais marqués fermés)'
        % (len(unmatched_carte_idx), n_skip_client))
    log('   fermetures PROUVÉES : %d' % len(fermees))
    data['meta']['fermees'] = [f['id'] for f in fermees]
    json.dump(fermees, open(os.path.join(OUT_SORTIES, 'E-fermetures-prouvees.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)

    log('== 6. écriture ==')
    data['p'] = P
    data['uga'], data['grp'], data['seg'], data['comm'] = uga_l, grp_l, seg_l, comm_l
    nClients = sum(1 for p in P if seg_l[p[4]].startswith('Client'))
    data['meta']['n'] = len(P)
    data['meta']['clients'] = nClients
    data['meta']['source'] = data['meta'].get('source', '') + ' + enrichissement 21/09/2026 (FINESS du jour, groupements, CRM, e-mails)'
    out_path = args.out
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as fh:
        fh.write('// Copilote — carte nationale pharmacies (hors DOM-TOM) : UGA, groupement,\n')
        fh.write('// segmentation client/prospect, commercial réseau. build_pharma_fr.py +\n')
        fh.write('// enrichir_pharma_fr.py (lot 3, 21/09/2026) : FINESS du jour, groupements,\n')
        fh.write('// CRM, e-mails. Chaque point: [lat,lng,ugaIdx,grpIdx,segIdx,commIdx,nom,\n')
        fh.write('// ville,cp,tel,titulaire,email,ca,id]. meta.fermees = fermetures PROUVÉES.\n')
        fh.write('window.PHARMA_FR=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    taille = os.path.getsize(out_path)
    log('   -> %s (%.2f Mo)' % (out_path, taille / 1048576.0))

    log('== 7. contrôles ==')
    ids_after = [p[13] for p in P]
    ids_after_set = set(ids_after)
    ids_lost = ids0_set - ids_after_set
    ids_new_dup = Counter(ids_after)
    new_dups = {k: v for k, v in ids_new_dup.items() if v > 1 and k not in {'2261313', '2213060'}}
    hors_bbox = [p for p in P if not (is_corse(p[8]) or p[8][:2] in ('97', '98')) and not in_bbox_metro(p[0], p[1])]
    log('   lignes avant/après : %d -> %d (+%d)' % (n0, len(P), len(P) - n0))
    log('   id perdus : %d' % len(ids_lost))
    log('   id en double NOUVEAUX (hors les 2 préexistants) : %d' % len(new_dups))
    log('   points hors bbox métropole (hors DOM/Corse) : %d' % len(hors_bbox))
    log('   taille fichier : %.2f Mo %s' % (taille / 1048576.0, '⚠️ > 3,2 Mo' if taille > 3.2 * 1048576 else '(OK, < 3,2 Mo)'))

    report['apres'] = {
        'n': len(P),
        'tel_vide': sum(1 for p in P if not p[9]),
        'mail_vide': sum(1 for p in P if not p[11]),
        'grp_vide': sum(1 for p in P if grp_l[p[3]] == '—'),
        'uga_vide': sum(1 for p in P if not uga_l[p[2]]),
        'titulaire_vide': sum(1 for p in P if not p[10]),
    }
    report['avant']['titulaire_vide'] = sum(1 for p in P[:n0] if not p[10])
    report['controles'] = {
        'n_avant': n0, 'n_apres': len(P), 'id_perdus': len(ids_lost),
        'id_doublons_nouveaux': len(new_dups), 'hors_bbox': len(hors_bbox),
        'taille_octets': taille,
    }
    report['ouvertures'] = {'candidates_recentes': len(recents), 'anciennes_non_rapprochees': len(anciennes),
                             'ajoutees': n_ouvertures_added, 'echec_geocodage_ou_bbox': n_ouvertures_geocode_fail}
    report['fermetures'] = {'sans_correspondance': len(unmatched_carte_idx), 'clients_crm_jamais_fermes': n_skip_client,
                             'prouvees': len(fermees)}
    report['remplissage'] = {
        'tel': {'avant': n_tel_before, 'combles_finess': n_tel_fill, 'combles_mails': n_tel_fill2},
        'mail': {'avant': n_mail_before, 'combles': n_mail_fill},
        'groupement': {'avant': n_grp_before, 'combles_mapping': n_grp_fill_map, 'combles_crm': n_grp_fill_crm},
        'uga': {'avant': n_uga_before, 'combles': n_uga_fill},
    }
    json.dump(report, open(os.path.join(OUT_SORTIES, 'F-rapport-chiffres.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    log('== FINI ==')


if __name__ == '__main__':
    main()

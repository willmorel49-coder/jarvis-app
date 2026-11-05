# -*- coding: utf-8 -*-
"""Tarif fusionné : base = stock POS (21/09), ppht remplacé par celui d'OPS (05/11) quand OPS en a un > 0,
codes OPS-seuls ajoutés. afmcode : POS, sauf divergence POS/OPS -> arbitre BDPM (taux => REMBSS ;
CIP connu sans taux => code d'OPS ; CIP inconnu => POS).

Usage : python3 fusionner_tarifs.py POS.xlsx OPS.xlsx BDPM_CIS_CIP.txt SORTIE.xlsx
Colonnes de sortie = EXACTEMENT celles de POS. Colonnes de stock : conservées pour les lignes POS ;
laissées à 0 (stockdispo) / vides (autres) pour les lignes OPS-seules : le stock du fichier est celui du
site POS, et cette fusion est un fichier de TARIF (le stock des sites vit dans stock-data/etab-prices).
Python 3.9 + openpyxl."""
import sys
import warnings

import openpyxl

warnings.filterwarnings('ignore')
STOCK_COLS = ('stockreel', 'stockcde', 'stockrsv', 'stockdispo', 'stocklivrable')


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def cip_de(v):
    c = str(v if v is not None else '').strip()
    if c.endswith('.0'):
        c = c[:-2]
    return c


def lire(chemin):
    ws = openpyxl.load_workbook(chemin, read_only=True, data_only=True).active
    it = ws.iter_rows(values_only=True)
    h = list(next(it))
    return h, [list(r) for r in it]


def bdpm(chemin):
    for enc in ('utf-8', 'latin-1'):
        try:
            lignes = open(chemin, encoding=enc).read().splitlines()
            break
        except UnicodeDecodeError:
            continue
    d = {}
    for l in lignes:
        p = l.split('\t')
        if len(p) < 9:
            continue
        c = p[6].strip()
        if c:
            d[c] = d.get(c, '') or p[8].strip()
    return d


def main(pos, ops, bd, sortie):
    hp, rp = lire(pos)
    ho, ro = lire(ops)
    ip, io = hp.index('artcodebarre'), ho.index('artcodebarre')
    pp, po = hp.index('ppht'), ho.index('ppht')
    ap, ao = hp.index('afmcode'), ho.index('afmcode')
    B = bdpm(bd)
    O = {}      # cip -> ligne OPS retenue (1re avec ppht>0, sinon 1re)
    dup_ops = 0
    for r in ro:
        c = cip_de(r[io])
        if not c:
            continue
        if c in O:
            dup_ops += 1
            if num(O[c][po]) <= 0 < num(r[po]):
                O[c] = r
        else:
            O[c] = r
    st = dict(lignes_pos=len(rp), lignes_ops=len(ro), ppht_remplaces=0, ppht_identiques=0, ajoutes=0,
              ajoutes_ppht_pos=0, afm_arbitre_change=0, afm_diverge_garde_pos_bdpm_inconnu=0,
              afm_diverge_bdpm_confirme_pos=0, dup_ops=dup_ops)
    ex, sans_bdpm = [], []
    out = []
    vus = set()
    for r in rp:
        r = list(r) + [None] * (len(hp) - len(r))
        c = cip_de(r[ip])
        vus.add(c)
        o = O.get(c)
        if o is not None:
            if num(o[po]) > 0:
                if num(r[pp]) != num(o[po]):
                    st['ppht_remplaces'] += 1
                else:
                    st['ppht_identiques'] += 1
                r[pp] = o[po]
            a_pos, a_ops = r[ap], o[ao]
            if a_ops not in (None, '') and a_pos != a_ops:
                if c in B:
                    if B[c]:
                        cible = 'REMBSS'
                    else:   # CIP connu sans taux : le code non-REMBSS (celui d'OPS si aucun des deux ne l'est)
                        cible = a_ops if a_ops != 'REMBSS' else a_pos
                    if cible != a_pos:
                        st['afm_arbitre_change'] += 1
                        if len(ex) < 10:
                            ex.append((c, r[hp.index('artdesignation')], a_pos, a_ops, B[c] or '(sans taux)', cible))
                        r[ap] = cible
                    else:
                        st['afm_diverge_bdpm_confirme_pos'] += 1
                else:
                    st['afm_diverge_garde_pos_bdpm_inconnu'] += 1
                    sans_bdpm.append((c, a_pos, a_ops))
        out.append(r)
    for c, o in O.items():
        if c in vus:
            continue
        r = [None] * len(hp)
        for i, n in enumerate(hp):
            if n in ho and n not in STOCK_COLS:
                r[i] = o[ho.index(n)]
        r[hp.index('stockdispo')] = 0
        out.append(r)
        st['ajoutes'] += 1
        if num(o[po]) > 0:
            st['ajoutes_ppht_pos'] += 1
    wb = openpyxl.Workbook(write_only=True)
    ws = wb.create_sheet('Sheet1')
    ws.append(hp)
    for r in out:
        ws.append(r)
    wb.save(sortie)
    print('lignes écrites :', len(out), '(POS %d + ajoutées %d)' % (len(rp), st['ajoutes']))
    for k, v in st.items():
        print(' ', k, '=', v)
    print('10 exemples afmcode changés par BDPM (cip, libellé, POS, OPS, taux BDPM, retenu) :')
    for e in ex:
        print('  ', e)
    print('divergences laissées à POS faute de BDPM :', st['afm_diverge_garde_pos_bdpm_inconnu'])
    return st


if __name__ == '__main__':
    main(*sys.argv[1:5])

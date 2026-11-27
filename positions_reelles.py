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
Double preuve (choix de Will, 27/11/2026 2 h) pour les officines sans lien sûr : même téléphone dans la même commune (fiche
unique), ou le NOM de la pharmacie ET son TITULAIRE (annuaire RPPS : titulaire, nom + prénom, même code postal ou commune)
désignent la même fiche, sans que le téléphone en désigne une autre ; une fiche déjà prise par une autre officine ne se donne
pas. Mesuré sur 5 886 liens sûrs : 1 cas douteux. Le titulaire SEUL est écarté (faux 108 fois sur 7 642 : titulaires périmés).
La même double preuve, quand le téléphone la confirme, corrige un lien sûr qui désigne la mauvaise fiche (Pharmacies Necker
inversées à Paris, Pharmacie des Andelys : 3 cas le 27/11).
Annuaire des entreprises (passe 4, choix de Will, 27/11/2026 2 h 25), en dernier recours, même double preuve avec une 2e source :
parmi les fiches FINESS libres du code postal ou de la commune (et la fiche du lien pas sûr), la fiche unique dont le TITULAIRE
(nom + prénom) est dirigeant actuel de la société à l'annuaire, ou inscrit sur la fiche au RPPS, ET dont un NOM concorde (FINESS,
dénomination, enseigne ou nom commercial à l'annuaire) par un autre mot que le nom du pharmacien, ET dont la société et
l'établissement sont ACTIFS ; le téléphone ne désigne
pas une autre fiche ; un lien pas sûr n'est confirmé que si c'est sa propre fiche ; une fiche réclamée deux fois ne se donne pas.
Mesuré sur 2 293 liens sûrs qui avaient une concurrente libre dans leur commune : 2 292 justes, 1 seul écart (Pharmacie des Andelys,
dont l'ancien lien était faux : l'annuaire désigne la fiche corrigée le 27/11). Source : ~/JARVIS/ETUDES-ZONE/brut/annuaire-fiches.json
(recherche-entreprises.api.gouv.fr par n° FINESS, lu le 27/11/2026 ; outils dans ~/jarvis-preuves/carte-positions-passe4-2026-11-27/annuaire).
Position : celle de la fiche FINESS quand elle est placée au numéro ou à la rue (précision 1 à 3) ; quand
FINESS n'a que la commune (précision 4), le point BPE 2025 (INSEE) du même SIRET ; sans BPE, le point ne bouge pas.
Mesuré le 27/11/2026 à l'Adresse nationale (Géoplateforme IGN) là où les deux sources divergent de plus de 300 m :
FINESS juste 7 fois sur 8 au numéro (BPE à 260 m-1,3 km), sur sa rue 9 fois sur 12 contre 3 pour BPE en précision 2 ;
en précision 4, BPE sur la bonne rue 3 fois sur 8, FINESS jamais. (L'étude de zone, e08_lier.py, prend BPE d'abord :
écart sans effet sur ses distances, médiane BPE-FINESS 11 m.)

  python3 positions_reelles.py              # écrit positions_reelles.json
  python3 positions_reelles.py --appliquer  # + replace les points de crm/v2/pharma-fr-data.js et retire les non-officines
                                            #   de _NON_PH_IDS (build_pharma_fr.py) ; rien d'autre ne change
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
RPPS = os.path.join(EZ, 'rpps_noms.csv')      # ETUDES-ZONE/outils/filtre_rpps_noms.py (annuaire RPPS, data.gouv)
ANNUAIRE = os.path.join(EZ, 'annuaire-fiches.json')   # annuaire des entreprises par n° FINESS (passe 4, 27/11/2026)
LIENS_PROUVES = {}    # rempli par calculer() : id officine -> fiche FINESS retenue (lue par l'étude de zone pour rester alignée)
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


def jetons_nom(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', str(s or '').upper()) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^A-Z ]', ' ', s.replace('-', ' ')).split()


CIVILITES = {'MADAME', 'MONSIEUR', 'MME', 'M', 'MR', 'MLLE', 'DOCTEUR', 'DR'}
MOTS_VIDES = set('PHARMACIE PHARMACIES PHARMA PHIE PHCIE PH GRANDE NOUVELLE SELARL SELAS SELAFA SARL SAS EURL SNC SPFPL DE DU '
                 'DES LA LE LES L D ET EN AU AUX SUR SOUS SAINT ST STE SAINTE CENTRE CENTRALE PLACE RUE AVENUE'.split())


def titulaires(t):
    """'AUGEE Marie Claire (Madame)' -> [({'AUGEE'}, 'MARIE')] ; nom en capitales, prénom ensuite ; sans prénom : ignoré."""
    out = []
    for part in re.split(r'[,;/&]| ET ', str(t or '')):
        brut = re.sub(r'\(.*?\)', ' ', part).split()
        noms = {x for w in brut if w.isupper() and len(w) > 1 for x in jetons_nom(w) if x not in CIVILITES}
        pren = [x for w in brut if not w.isupper() for x in jetons_nom(w) if x not in CIVILITES]
        if noms and pren:
            out.append((noms, pren[0]))
    return out


def lire_rpps():
    """Titulaires d'officine (sections A et EA) de l'annuaire RPPS : jeton du nom -> [(nom, prénom, finess, cp, commune)]."""
    rp = {}
    for l in io.open(RPPS, encoding='utf-8'):
        _, nom, pre, f, sec, _, cp, com = l.rstrip('\n').split('|')
        if sec not in ('A', 'EA'):
            continue
        r = (set(jetons_nom(nom)), (jetons_nom(pre) or [None])[0], f, cp, commune(com))
        for t in r[0]:
            rp.setdefault(t, []).append(r)
    return rp


def par_titulaire(p, rp, fin):
    """La fiche FINESS unique où le titulaire de l'officine est inscrit, dans son code postal ou sa commune, sinon None."""
    trouves = set()
    for noms, pre in titulaires(p[10]):
        for t in noms:
            for nom, pr, f, cp, com in rp.get(t, ()):
                if (noms <= nom or nom <= noms) and pr == pre and (cp == str(p[8]) or com == commune(p[7])) and f in fin:
                    trouves.add(f)
    return trouves.pop() if len(trouves) == 1 else None


def dirigeant_concorde(noms, pre, nom, prenoms):
    dn, dp = set(jetons_nom(nom)), jetons_nom(prenoms)
    return bool(dn) and (noms <= dn or dn <= noms) and bool(dp) and dp[0] == pre


def nom_concorde(p, q):
    a = {w for w in jetons_nom(p[6]) if w not in MOTS_VIDES and len(w) > 2}
    b = {w for w in jetons_nom(q['nom']) + jetons_nom(q.get('rs_longue')) if w not in MOTS_VIDES and len(w) > 2}
    return bool(a & b)


def lire_pharma_fr(chemin):
    txt = io.open(chemin, encoding='utf-8').read()
    i = txt.index(PREFIXE)
    corps = txt[i + len(PREFIXE):].rstrip()
    if corps.endswith(';'):
        corps = corps[:-1]
    return txt[:i], json.loads(corps), txt[i + len(PREFIXE) + len(corps):]


def lire_constante(nom):
    """Une constante de build_pharma_fr.py, lue sans importer le script (son import relance proteger_conditions)."""
    src = io.open(os.path.join(ROOT, 'build_pharma_fr.py'), encoding='utf-8').read()
    for n in ast.parse(src).body:
        if isinstance(n, ast.Assign) and any(getattr(t, 'id', '') == nom for t in n.targets):
            return ast.literal_eval(n.value)
    sys.exit('ARRÊT : %s introuvable dans build_pharma_fr.py' % nom)


def positions_corrigees():
    return lire_constante('POSITIONS_CORRIGEES')


def calculer():
    for f in (LIENS, FINESS, BPE, CORR, PHARMA_FR, RPPS, ANNUAIRE):
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
    rp = lire_rpps()
    ann = json.load(open(ANNUAIRE, encoding='utf-8'))['fiches']
    zone = {}
    for q in fin.values():
        zone.setdefault(q['ligne'][:5], set()).add(q['finess'])
        zone.setdefault('co:' + commune(q['ligne'][6:]), set()).add(q['finess'])
    par_tel = {}
    for q in fin.values():
        if tel9(q['tel']):
            par_tel.setdefault(tel9(q['tel']), set()).add(q['finess'])
    lien = {}
    for oid in pts:
        if oid in liens:
            lien[oid] = (liens[oid]['finess'], liens[oid]['methode'])
        elif oid in corr:
            lien[oid] = (corr[oid]['finess'], 'corr:' + corr[oid]['methode'])
    prises = {}
    for oid, (f, _) in lien.items():
        prises.setdefault(f, set()).add(oid)

    def tel_commune(p):            # la fiche unique qui a le même téléphone, dans le même code postal ou la même commune
        ok = [f for f in par_tel.get(tel9(p[9]), ()) if fin[f]['ligne'][:5] == str(p[8]) or commune(fin[f]['ligne'][6:]) == commune(p[7])]
        return ok[0] if len(ok) == 1 else None

    def nom_titulaire(p):          # nom + titulaire sur la même fiche, et le téléphone n'en désigne pas une autre
        g = par_titulaire(p, rp, fin)
        if not g or not nom_concorde(p, fin[g]):
            return None
        t = tel9(p[9])
        return None if t and par_tel.get(t) and g not in par_tel[t] else g

    def par_annuaire(oid, p, f):   # nom + titulaire (annuaire des entreprises ou RPPS) sur une fiche libre, active, unique
        ts = titulaires(p[10])
        if not ts:
            return None
        cands = {g for g in zone.get(str(p[8]), set()) | zone.get('co:' + commune(p[7]), set()) if not (prises.get(g, set()) - {oid})}
        if f:
            cands.add(f)
        rpf = set()
        for noms, pre in ts:
            for t in noms:
                for nom, pr, g, cp, com in rp.get(t, ()):
                    if (noms <= nom or nom <= noms) and pr == pre and (cp == str(p[8]) or com == commune(p[7])):
                        rpf.add(g)
        ok = []
        for g in cands:
            a = ann.get(g)
            if not a or a['etat'] != 'A':
                continue
            tit = g in rpf or any(dirigeant_concorde(noms, pre, n, pr) for n, pr in a['dirigeants'] for noms, pre in ts)
            # le nom doit concorder par autre chose que le nom du pharmacien (« Pharmacie Dupont » = le titulaire, pas une 2e preuve)
            perso = {t for noms, _ in ts for t in noms} | {t for n, _ in a['dirigeants'] for t in jetons_nom(n)}
            mots = lambda x: {w for w in jetons_nom(x) if w not in MOTS_VIDES and len(w) > 2} - perso
            if tit and mots(p[6]) & mots(' '.join([fin[g]['nom'], fin[g].get('rs_longue') or '', a['noms']])):
                ok.append(g)
        g = ok[0] if len(ok) == 1 else None
        t = tel9(p[9])
        if g and t and par_tel.get(t) and g not in par_tel[t]:
            return None
        return None if (g and f and g != f) else g

    pos, cpt = {}, {'officines': len(pts), 'sans_lien': 0, 'lien_non_sur': 0, 'autre_commune': 0,
                    'sans_position': 0, 'gardees': 0, 'par_bpe': 0, 'par_finess': 0,
                    'double_preuve_telephone': 0, 'double_preuve_titulaire': 0, 'double_preuve_annuaire': 0,
                    'fiche_deja_prise': 0, 'fiche_reclamee_deux_fois': 0, 'lien_sur_corrige': 0}
    # 1er tour : les preuves par l'annuaire, pour écarter une fiche réclamée par deux officines (ou par une autre preuve du même calcul)
    reclames = {}
    for oid, p in pts.items():
        f, m = lien.get(oid, (None, ''))
        if f and methode_sure(m):
            continue
        g = tel_commune(p)
        if g:
            reclames.setdefault(g, set()).add(oid)
            continue
        g = nom_titulaire(p)
        if g and not (f and g != f):
            reclames.setdefault(g, set()).add(oid)
            continue
        if not (f and g):
            g = par_annuaire(oid, p, f)
            if g:
                reclames.setdefault(g, set()).add(oid)
    LIENS_PROUVES.clear()
    for oid, p in pts.items():
        f, m = lien.get(oid, (None, ''))
        if f and methode_sure(m):
            g = tel_commune(p)
            if g and g != f and nom_titulaire(p) == g:      # trois preuves contre le lien : il désignait la mauvaise fiche
                f = g; cpt['lien_sur_corrige'] += 1
        else:
            g = tel_commune(p)
            how = 'double_preuve_telephone'
            if not g:
                g = nom_titulaire(p); how = 'double_preuve_titulaire'
                if g and f and g != f:   # lien pas sûr : le titulaire doit confirmer la fiche déjà trouvée par le nom
                    g = None
                elif not g:
                    g = par_annuaire(oid, p, f); how = 'double_preuve_annuaire'
                    if g and len(reclames.get(g, ())) > 1:
                        cpt['fiche_reclamee_deux_fois'] += 1
                        continue
            if not g:
                cpt['lien_non_sur' if f else 'sans_lien'] += 1
                continue
            if prises.get(g, set()) - {oid}:
                cpt['fiche_deja_prise'] += 1
                continue
            f = g; cpt[how] += 1
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
        LIENS_PROUVES[oid] = f
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
    """Replace les points de pharma-fr-data.js (seules lat, lng changent), retire les non-officines de _NON_PH_IDS et recopie
    meta.fermees depuis fermetures_carte.json, comme le fait build_pharma_fr.py à la régénération (27/11/2026, choix de Will).
    Les autres fichiers sont liés par id."""
    tete, data, queue = lire_pharma_fr(PHARMA_FR)
    avant = tete + PREFIXE + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + queue
    if avant != io.open(PHARMA_FR, encoding='utf-8').read():
        sys.exit('ARRÊT : relecture de pharma-fr-data.js non identique, rien écrit')
    pc = {str(k): v for k, v in positions_corrigees().items()}
    exclus = {str(x) for x in lire_constante('_NON_PH_IDS')}
    avant_n = len(data['p'])
    data['p'] = [p for p in data['p'] if str(p[13]) not in exclus]
    retires = avant_n - len(data['p'])
    data['meta']['fermees'] = sorted(json.load(io.open(os.path.join(ROOT, 'fermetures_carte.json'), encoding='utf-8'))['officines'])
    n = 0
    for p in data['p']:
        oid = str(p[13])
        cible = list(pc[oid]) if oid in pc else pos.get(oid)   # les corrections à la main restent prioritaires
        if cible and [p[0], p[1]] != cible:
            p[0], p[1] = cible[0], cible[1]
            n += 1
    io.open(PHARMA_FR, 'w', encoding='utf-8').write(
        tete + PREFIXE + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + queue)
    return n, retires


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
        n, retires = appliquer(pos)
        print('points replacés dans pharma-fr-data.js :', n, '| non-officines retirées :', retires)


if __name__ == '__main__':
    main()

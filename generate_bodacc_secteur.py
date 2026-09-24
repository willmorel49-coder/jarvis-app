#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Robot quotidien du bloc « Dans ton secteur » (Infos du jour).

Interroge l'API ouverte du Bodacc (bodacc-datadila.opendatasoft.com), toute la
France, sur les 95 derniers jours, pour les sociétés d'officine de pharmacie, et
classe chaque annonce en 5 familles utiles au commercial (cession, procédure,
création, fermeture, dirigeant) — logique portée de trier.js (validée par Will
sur la maquette du 25/09/2026).

⚠️ Le dépôt est PUBLIC : aucun nom de personne physique n'est lu au-delà de son
   type (`listepersonnes.personne.typePersonne`), et aucune donnée client/CRM
   n'entre dans ce fichier — uniquement des annonces légales déjà publiques.

⚠️ Piège connu (relevé le 25/09/2026 sur ce même jeu de données) : le champ
   `raisonsociale` N'EXISTE PAS dans ce dataset — l'utiliser donne 0 résultat
   sans erreur, ce qui ressemble à un flux tari. Le nom de la société est dans
   `commercant`.

Sortie : crm/v2/bodacc-secteur.json = {"maj","n","ev":[{id,d,f,nom,ville,cp,dep,
depNom,detail,url}]}. Écrit même vide. Si l'API échoue totalement, le fichier
existant n'est PAS écrasé (sortie non nulle) — un flux capricieux ne doit
jamais effacer la veille du jour d'avant.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'crm', 'v2', 'bodacc-secteur.json')

API = ('https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/'
       'datasets/annonces-commerciales/records')
JOURS = 95
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Version/17.4 Safari/605.1.15')
TODAY = date.today()


def http(url, timeout=25):
    r = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    return urllib.request.urlopen(r, timeout=timeout).read()


def J(s):
    """JSON.parse tolérant : rend None au moindre pépin (jamais d'exception)."""
    try:
        return json.loads(s) if s else None
    except Exception:
        return None


def titre(s):
    return (s or '').split(',')[0].strip()


def euros(t):
    m = re.search(r'prix stipul[ée] de ([\d\s .,]+)\s*euros', t or '', re.I)
    if not m:
        return None
    n = m.group(1).replace(' ', '').replace(' ', '')
    if ',' in n and '.' not in n:
        n = n.replace(',', '.')
    else:
        n = n.replace(',', '')
    try:
        v = float(n)
        return v if v == v else None
    except Exception:
        return None


def _where(dmin, dmax):
    return ('(search(commercant,"officine de pharmacie") or '
            'search(commercant,"pharmacien d\'officine") or '
            'search(listepersonnes,"officine de pharmacie") or '
            'commercant like "%%PHARMACIE%%") '
            'and dateparution>="%s" and dateparution<="%s" '
            'and not familleavis_lib="Dépôts des comptes"' % (dmin, dmax))


def fetch_range(dmin, dmax, out):
    """Récupère toute la tranche [dmin, dmax] (pagination 100), en redécoupant
    la fenêtre de dates si l'API plafonne offset+limit à 10 000."""
    limit = 100
    offset = 0
    while True:
        if offset + limit > 10000:
            if dmax <= dmin:
                sys.stderr.write('  (BODACC) tranche non découpable %s..%s, tronquée\n' % (dmin, dmax))
                return
            mid = dmin + (dmax - dmin) // 2
            if mid == dmin:
                mid = dmin
            fetch_range(dmin, mid, out)
            fetch_range(mid + timedelta(days=1), dmax, out)
            return
        url = API + '?where=' + urllib.parse.quote(_where(dmin, dmax)) + \
            '&limit=%d&offset=%d&order_by=dateparution' % (limit, offset)
        d = json.loads(http(url))
        results = d.get('results', [])
        out.extend(results)
        total = d.get('total_count', len(results))
        offset += limit
        if offset >= total or not results:
            return


def trier(brut):
    """Porte trier.js : 5 familles, exclusions, dédoublonnage par nom (le plus
    récent gagne). Aucun nom de personne physique n'est lu."""
    out = []
    for r in brut:
        nom = titre(r.get('commercant'))
        if not re.search(r'PHARMA|SPFPL', nom, re.I) or re.search(r'GROUPEMENT|^GIE\b', nom, re.I):
            continue
        pers = J(r.get('listepersonnes'))
        pp = bool(pers and isinstance(pers.get('personne'), dict)
                  and pers['personne'].get('typePersonne') == 'pp')
        mod = (J(r.get('modificationsgenerales')) or {}).get('descriptif') or ''
        et = J(r.get('listeetablissements'))
        etab = None
        if et:
            e = et.get('etablissement')
            etab = (e[0] if isinstance(e, list) else e) if e else None
        fam = r.get('familleavis')
        f, detail = None, ''
        if fam == 'vente':
            f = 'cession'
            p = euros((etab or {}).get('origineFonds')) if etab else None
            if p:
                detail = 'Fonds vendu ' + (
                    ('%.1f M€' % (p / 1e6)).replace('.', ',') if p >= 1e6
                    else '%d k€' % round(p / 1e3))
            else:
                detail = 'Fonds vendu'
        elif fam == 'creation':
            if pp:
                continue
            act = (etab or {}).get('activite') or ''
            if re.search(r'SPFPL|HOLDING', nom, re.I) or re.search(r'parts sociales|participations', act, re.I):
                f, detail = 'holding', 'Holding de pharmaciens immatriculée'
            else:
                f, detail = 'creation', 'Nouvelle société d’officine'
        elif fam == 'collective':
            n = ((J(r.get('jugement')) or {}).get('nature') or '')
            if re.search(r'liquidation', n, re.I) and re.search(r'ouverture|prononçant|pronoçant', n, re.I):
                detail = 'Liquidation judiciaire'
            elif re.search(r'redressement', n, re.I) and re.search(r'ouverture', n, re.I):
                detail = 'Redressement judiciaire'
            elif re.search(r'sauvegarde', n, re.I) and re.search(r'ouverture', n, re.I):
                detail = 'Procédure de sauvegarde'
            elif re.search(r'plan de redressement|plan de sauvegarde', n, re.I):
                detail = 'Plan arrêté par le tribunal'
            else:
                continue
            f = 'procedure'
        elif fam == 'radiation':
            f, detail = 'fermeture', 'Société radiée'
        elif fam == 'modification':
            if re.search(r'cessation|dissolution', mod, re.I):
                f, detail = 'fermeture', 'Dissolution ou cessation'
            elif re.search(r'administration', mod, re.I):
                f, detail = 'dirigeant', 'Changement de dirigeant'
            else:
                continue
        else:
            continue
        out.append({
            'id': r.get('id'), 'd': r.get('dateparution'), 'f': f, 'nom': nom,
            'ville': titre(r.get('ville')), 'cp': titre(r.get('cp')),
            'dep': r.get('numerodepartement'), 'depNom': r.get('departement_nom_officiel'),
            'detail': detail, 'url': r.get('url_complete'),
        })
    vu, res = set(), []
    out.sort(key=lambda e: e['d'] or '', reverse=True)
    for e in out:
        k = e['nom']
        if k in vu:
            continue
        vu.add(k)
        res.append(e)
    return res


def main():
    dmin = (TODAY - timedelta(days=JOURS)).isoformat()
    dmax = TODAY.isoformat()
    brut = []
    try:
        fetch_range(date.fromisoformat(dmin), date.fromisoformat(dmax), brut)
    except Exception as e:
        sys.stderr.write('ECHEC BODACC secteur : %s\n' % str(e)[:200])
        # ⚠️ un flux capricieux ne doit jamais effacer la veille du jour d'avant.
        sys.exit(1)

    res = trier(brut)
    # les holdings rejoignent « creation » côté écran (comme la maquette)
    for e in res:
        if e['f'] == 'holding':
            e['f'] = 'creation'

    payload = {'maj': TODAY.isoformat(), 'n': len(res), 'ev': res}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(',', ':'))

    # relecture de contrôle (ce qui est mesuré doit être ce qui est écrit)
    with open(OUT, encoding='utf-8') as fh:
        relu = json.load(fh)
    cnt = {}
    for e in relu['ev']:
        cnt[e['f']] = cnt.get(e['f'], 0) + 1
    print('%d annonces brutes -> %d retenues' % (len(brut), relu['n']), cnt)
    will = ['49', '14', '72', '37', '50', '44']
    w = [e for e in relu['ev'] if e['dep'] in will]
    print('Départements 49/14/72/37/50/44 : %d annonces' % len(w))
    for e in w:
        print(' ', e['d'], e['f'], e['nom'], e['ville'], e['detail'])


if __name__ == '__main__':
    main()

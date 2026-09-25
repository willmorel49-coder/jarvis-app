# -*- coding: utf-8 -*-
"""Agences des grossistes-répartiteurs concurrents (Infos du jour › Les concurrents).

Lit le registre officiel des entreprises (recherche-entreprises.api.gouv.fr, SIRENE,
gratuit, sans clé) et écrit crm/v2/concurrents-implantations.json : pour chaque
concurrent, ses établissements ACTIFS au code NAF 46.46Z (commerce de gros de
produits pharmaceutiques), avec ville, département et coordonnées. La page place
ces agences sur la carte du secteur de chaque commercial.

⚠️ Interroger par NOM puis filtrer le SIREN : interrogée par SIREN seul, l'API rend
   `matching_etablissements` vide.
⚠️ Un contrôle qui échoue ne vide jamais le fichier : si l'API se tait, ou si le
   total s'effondre (moins de 60 % de la dernière lecture), on s'arrête sans écrire.

Robot mensuel (GitHub Actions). Python 3.9+, stdlib seulement. Aucune donnée client.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'crm', 'v2', 'concurrents-implantations.json')
API = ('https://recherche-entreprises.api.gouv.fr/search?q=%s&minimal=true'
       '&include=matching_etablissements,siege&per_page=10&limite_matching_etablissements=100')

# (clé, nom affiché, [(requête texte, SIREN)]). Décisions du 25/09/2026 :
# Phoenix OCP = un seul nom ; CERP Rouen + CERP RRM = « CERP » (fusionnées le 01/07/2024).
# Alliance : 421218132 (Répartition), PAS 808629620 (société de services).
ACTEURS = [
    ('phoenix', 'Phoenix OCP', [('PHOENIX OCP', '582137436')]),
    ('cerp', 'CERP', [("COMPAGNIE D'EXPLOITATION ET DE REPARTITION PHARMACEUTIQUE", '493265284')]),
    ('cerp-ba', 'CERP Bretagne Atlantique', [("COOPERATIVE D'EXPLOITATION ET DE REPARTITION PHARMACEUTIQUE", '495780348')]),
    ('alliance', 'Alliance Healthcare', [('ALLIANCE HEALTHCARE REPARTITION', '421218132')]),
    ('giphar', 'Giphar (Sogiphar)', [('SOGIPHAR', '310173968')]),
    ('sagitta', 'Sagitta', [('SAGITTA PHARMA', '534188941'), ('SAGITTA OCCITANIE', '821884384'),
                            ('SAGITTA NOUVELLE AQUITAINE', '851048280')]),
    ('drapier', 'Médiane · Mezegel · Medisca', [('MEDIANE REPARTITION', '977768548'),
                                               ('MEZEGEL REPARTITION', '949685143'), ('MEDISCA', '994320257')]),
    ('aredis', 'Aredis', [('AREDIS SAS', '451436083')]),
    ('rbp', 'RBP Pharma', [('RBP PHARMA SAS', '419582358')]),
]


def get(q):
    url = API % urllib.parse.quote(q)
    for essai in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'JARVIS-veille (robot mensuel, gratuit)'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            sys.stderr.write('essai %d rate pour %s : %s\n' % (essai + 1, q, e))
            time.sleep(2 + essai * 3)
    sys.exit('API muette pour « %s » : fichier laissé tel quel' % q)


def dep(cp):
    if cp.startswith('97'):
        return cp[:3]
    if cp.startswith('20'):
        return '2A' if int(cp) < 20200 else '2B'
    return cp[:2]


_NOMS = {}


def nom_commune(e):
    """Nom officiel AVEC accents (« Saint-Lô ») : le registre ne donne que des majuscules
    sans accent (« SAINT-LO »). Si l'API des communes se tait, on garde le nom du registre."""
    brut = (e.get('libelle_commune') or '').title()
    code = e.get('commune') or ''
    if not code:
        return brut
    if code not in _NOMS:
        try:
            req = urllib.request.Request('https://geo.api.gouv.fr/communes/%s?fields=nom' % code,
                                         headers={'User-Agent': 'JARVIS-veille (robot mensuel, gratuit)'})
            with urllib.request.urlopen(req, timeout=15) as r:
                _NOMS[code] = json.load(r).get('nom') or ''
        except Exception as err:
            sys.stderr.write('nom de commune %s non lu (%s) : nom du registre gardé\n' % (code, err))
            _NOMS[code] = ''
    # « Paris 5e Arrondissement » → « Paris 5e » : le mot ne dit rien de plus sur la carte.
    return (_NOMS[code] or brut).replace(' Arrondissement', '')


def coord(v):
    try:
        return round(float(v), 4)
    except (TypeError, ValueError):
        return None


def main():
    acteurs = []
    for cle, nom, entites in ACTEURS:
        agences = []
        for q, siren in entites:
            r = next((x for x in get(q).get('results', []) if x.get('siren') == siren), None)
            if not r:
                sys.exit('%s introuvable par « %s » : fichier laissé tel quel' % (siren, q))
            ets = r.get('matching_etablissements') or ([r['siege']] if r.get('siege') else [])
            for e in ets:
                if e.get('etat_administratif') != 'A' or e.get('activite_principale') != '46.46Z':
                    continue
                cp = e.get('code_postal') or ''
                if not cp:
                    continue
                agences.append({'ville': nom_commune(e), 'cp': cp, 'dep': dep(cp),
                                'lat': coord(e.get('latitude')), 'lon': coord(e.get('longitude'))})
            print('  %-30s %s retenus=%d' % (nom, siren, len(agences)))
            time.sleep(0.4)
        agences.sort(key=lambda g: (g['dep'], g['ville']))
        acteurs.append({'cle': cle, 'nom': nom, 'agences': agences})

    total = sum(len(a['agences']) for a in acteurs)
    try:
        avant = sum(len(a['agences']) for a in json.load(open(OUT, encoding='utf-8'))['acteurs'])
    except Exception:
        avant = 0
    if avant and total < 0.6 * avant:
        sys.exit('ECHEC : %d agences lues contre %d la dernière fois — lecture suspecte, fichier laissé tel quel' % (total, avant))

    sortie = {'maj': time.strftime('%Y-%m-%d'),
              'source': 'Registre officiel des entreprises (SIRENE), établissements actifs NAF 46.46Z',
              'acteurs': acteurs}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(sortie, f, ensure_ascii=False, separators=(',', ':'))
    relu = json.load(open(OUT, encoding='utf-8'))
    print('OK %d agences (%d concurrents) -> %s' % (sum(len(a['agences']) for a in relu['acteurs']), len(relu['acteurs']), OUT))


if __name__ == '__main__':
    main()

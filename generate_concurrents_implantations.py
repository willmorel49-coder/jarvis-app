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

Depuis le 14/10/2026, il refait AUSSI la carte des grossistes (onglet Concurrents) :
crm/v2/grossistes-points.json (un point par établissement, ouvert ou fermé) et les
compteurs de sites des fiches dans crm/v2/grossistes-data.js. Voir carte().

Robot mensuel (GitHub Actions). Python 3.9+, stdlib seulement. Aucune donnée client.
"""
import collections
import json
import os
import re
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


# ───────────────────── carte des grossistes (onglet Concurrents) ─────────────────────
# Fabriquée le 14/10/2026 par assembler.py (hors dépôt) ; ce robot la tient à jour.
# SIREN suivis : ceux déjà rattachés à une fiche sur la carte (rattachement vérifié le
# 14/10 : un même SIREN figure souvent dans plusieurs fiches, comme actionnaire), plus le
# SIREN PROPRE de toute fiche (societe_siren, financials.siren) qu'aucune autre ne revendique.
# Un SIREN illisible ou lu incomplet garde ses sites du passage précédent (signalé au journal).
DATA_JS = os.path.join(ROOT, 'crm', 'v2', 'grossistes-data.js')
POINTS = os.path.join(ROOT, 'crm', 'v2', 'grossistes-points.json')
API_P = ('https://recherche-entreprises.api.gouv.fr/search?q=%s&minimal=true'
         '&include=matching_etablissements,siege&per_page=25&limite_matching_etablissements=100&page=%d')
# Sites hors 46.46Z gardés (ouverts seulement), choix du 14/10/2026 : siège d'Alliance
# (70.10Z), logistique 52.10B de SIPR (CERP Réunion) et d'Ubipharm Guadeloupe.
HORS_NAF_GARDES = {'421218132', '310836986', '483272878'}
AUJ = time.strftime('%Y-%m-%d')


def _lire(url):
    """Réponse JSON, ou None si l'adresse se tait : jamais d'arrêt ici, l'appelant garde l'ancien."""
    for essai in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'JARVIS-veille (robot mensuel, gratuit)'})
            with urllib.request.urlopen(req, timeout=30) as r:
                time.sleep(0.35)
                return json.load(r)
        except Exception as e:
            sys.stderr.write('essai %d raté pour %s : %s\n' % (essai + 1, url[:110], e))
            time.sleep(2 + essai * 3)
    return None


def _entreprise(siren):
    """(entreprise avec ses établissements, '') ou (None, motif). Par SIREN pour le nom, puis par nom."""
    d = _lire(API_P % (siren, 1))
    r = next((x for x in (d or {}).get('results', []) if x.get('siren') == siren), None)
    if not r:
        return None, 'registre muet' if d is None else 'SIREN introuvable'
    vu = None
    for nom in [n for n in (r.get('nom_raison_sociale'), r.get('nom_complet')) if n]:
        for page in range(1, 5):
            d = _lire(API_P % (urllib.parse.quote(nom), page))
            x = next((x for x in (d or {}).get('results', []) if x.get('siren') == siren), None)
            if x and x.get('matching_etablissements'):
                return x, ''
            vu = vu or x
            if x or not d or page >= (d.get('total_pages') or 1):
                break
    return (vu, '') if vu else (None, 'établissements non lus')


def _ban(e, cp):
    """Coordonnées de l'adresse (Base Adresse Nationale) si le registre n'en donne pas ; score < 0,5 = rien."""
    adr = e.get('adresse') or ''
    fin = cp + ' ' + (e.get('libelle_commune') or '')
    rue = adr[:-len(fin)].strip() if adr.endswith(fin) else adr
    d = _lire('https://api-adresse.data.gouv.fr/search/?' + urllib.parse.urlencode({'q': rue, 'postcode': cp, 'limit': 1}))
    f = (d or {}).get('features') or []
    if not f or f[0]['properties'].get('score', 0) < 0.5:
        return None, None
    lon, lat = f[0]['geometry']['coordinates']
    return round(lat, 5), round(lon, 5)


def _coord5(v):
    try:
        return round(float(v), 5)
    except (TypeError, ValueError):
        return None


def _point(e, x, fid, fiche, avant):
    cp = e.get('code_postal') or ''
    naf = e.get('activite_principale') or ''
    ferme = e.get('etat_administratif') != 'A'
    if not cp or (naf != '46.46Z' and (ferme or x['siren'] not in HORS_NAF_GARDES)):
        return None
    siret = e.get('siret') or ''
    ancien = avant.get(siret) or {}
    lat, lon = _coord5(e.get('latitude')), _coord5(e.get('longitude'))
    if lat is None or lon is None:
        lat, lon = ancien.get('lat'), ancien.get('lon')
    if lat is None or lon is None:
        lat, lon = _ban(e, cp)
    ville = nom_commune(e)
    if _NOMS.get(e.get('commune') or '') == '' and ancien.get('ville'):
        ville = ancien['ville']   # l'API des communes s'est tue : le nom du mois dernier vaut mieux que « Saint Pierre »
    ens = e.get('liste_enseignes') or []
    enseigne = ' / '.join(ens) if ens else (e.get('nom_commercial') or '')
    return {'pid': siret, 'id': fid, 'groupe_id': fiche.get('groupe_id', ''), 'siret': siret, 'siren': x['siren'],
            'nom': enseigne or x.get('nom_raison_sociale') or x.get('nom_complet') or fiche.get('nom', ''),
            'ville': ville, 'cp': cp, 'dep': cp[:3] if cp[:2] in ('97', '98') else dep(cp),
            'lat': lat, 'lon': lon, 'ansm': 'introuvable', 'nous': fiche.get('groupe_id') == 'integral',
            'siege': bool(e.get('est_siege')), 'hors_naf': naf != '46.46Z', 'naf': naf,
            'ferme': ferme, 'date_fermeture': e.get('date_fermeture') or '',
            'rep': bool(fiche.get('repartiteur', True)), 'decisions': ancien.get('decisions', 0),
            'source': 'SIRENE via recherche-entreprises.api.gouv.fr (NAF %s)' % naf, 'maj': AUJ}


def _suivis(fiches, anciens, journal):
    """{SIREN: id de fiche}."""
    par_id = {g['id']: g for g in fiches}
    suivis = {}
    for p in anciens:
        suivis.setdefault(p['siren'], p['id'])
    propres = collections.defaultdict(set)
    for g in fiches:
        if g.get('fusionne_dans'):
            continue
        for s in (g.get('societe_siren'), (g.get('financials') or {}).get('siren')):
            s = str(s or '').replace(' ', '')
            if re.match(r'^\d{9}$', s):
                propres[s].add(g['id'])
    for s, ids in sorted(propres.items()):
        if s in suivis:
            continue
        if len(ids) == 1:
            suivis[s] = list(ids)[0]
        else:
            journal.append('SIREN %s revendiqué par plusieurs fiches (%s) : non suivi' % (s, ', '.join(sorted(ids))))
    for s, fid in list(suivis.items()):
        g = par_id.get(fid)
        if g and g.get('fusionne_dans'):
            suivis[s] = g['fusionne_dans']
        elif not g:
            journal.append('SIREN %s : la fiche « %s » n\'existe plus, sites gardés sous cette clé' % (s, fid))
    return suivis


def carte():
    txt = open(DATA_JS, encoding='utf-8').read()
    m = re.search(r'window\.GROSSISTES_DATA\s*=\s*(\{.*\})\s*;?\s*$', txt, re.S)
    if not m:
        sys.exit('grossistes-data.js illisible : carte laissée telle quelle')
    data = json.loads(m.group(1))
    fiches = data['grossistes']
    par_id = {g['id']: g for g in fiches}
    avant = json.load(open(POINTS, encoding='utf-8'))
    anciens = avant['points'] + avant['sans_coord']
    if not anciens:
        sys.exit('grossistes-points.json vide : rien pour savoir quels SIREN suivre, carte laissée telle quelle')
    par_siret = {p['siret']: p for p in anciens}
    journal = []
    suivis = _suivis(fiches, anciens, journal)
    pts = []
    muets = gardes = 0
    for siren, fid in sorted(suivis.items(), key=lambda t: (t[1], t[0])):
        fiche = par_id.get(fid) or {}
        x, motif = _entreprise(siren)
        muets = muets + 1 if motif == 'registre muet' else 0
        if muets >= 3:
            sys.exit('registre muet pour 3 SIREN de suite — carte laissée telle quelle')
        ets = []
        if x:
            ets = x.get('matching_etablissements') or ([x['siege']] if x.get('siege') else [])
            lus = sum(1 for e in ets if e.get('etat_administratif') == 'A')
            if lus != x.get('nombre_etablissements_ouverts'):
                x, motif = None, '%d sites ouverts lus pour %s annoncés' % (lus, x.get('nombre_etablissements_ouverts'))
        if not x:
            garde = [p for p in anciens if p['siren'] == siren]
            journal.append('%s (%s) : %s — %d site(s) du dernier passage gardé(s)' % (siren, fid, motif, len(garde)))
            pts.extend(garde)
            gardes += 1
            continue
        miens = [p for p in (_point(e, x, fid, fiche, par_siret) for e in ets) if p]
        pts.extend(miens)
        print('  %-28s %s ouverts=%d fermés=%d' % (fid, siren, sum(1 for p in miens if not p['ferme']), sum(1 for p in miens if p['ferme'])))

    # Contrôles : une lecture qui s'effondre ne remplace rien ; une baisse par acteur se signale.
    if gardes > 0.2 * len(suivis):
        sys.exit('%d SIREN sur %d non relus — la carte daterait d\'aujourd\'hui sans l\'être, laissée telle quelle'
                 % (gardes, len(suivis)))
    ouv = collections.Counter(p['id'] for p in pts if not p['ferme'])
    ouv_avant = collections.Counter(p['id'] for p in anciens if not p['ferme'])
    if sum(ouv.values()) < 0.6 * sum(ouv_avant.values()):
        sys.exit('%d sites ouverts lus contre %d la dernière fois — lecture suspecte, carte laissée telle quelle'
                 % (sum(ouv.values()), sum(ouv_avant.values())))
    for fid, n in sorted(ouv_avant.items()):
        if ouv.get(fid, 0) < 0.6 * n:
            journal.append('%s : %d sites ouverts contre %d le mois dernier (baisse de plus de 40 %%, à regarder)' % (fid, ouv.get(fid, 0), n))
    nouveaux = {p['siret'] for p in pts}
    for p in pts:
        a = par_siret.get(p['siret'])
        if not a and not p['ferme']:
            journal.append('nouveau site : %s à %s (%s)' % (p['nom'], p['ville'], p['id']))
        elif a and p['ferme'] and not a['ferme']:
            journal.append('fermé : %s à %s (%s), le %s' % (p['nom'], p['ville'], p['id'], p['date_fermeture'] or '?'))
    for a in anciens:
        if a['siret'] not in nouveaux:
            journal.append('disparu du registre : %s à %s (%s)' % (a['nom'], a['ville'], a['id']))

    pts.sort(key=lambda p: (p['id'], p['siret']))
    avec = [p for p in pts if p['lat'] is not None and p['lon'] is not None]
    sans = [p for p in pts if p['lat'] is None or p['lon'] is None]
    sortie = {'maj': AUJ, 'provisoire': '',
              'source': 'registre des entreprises (SIRENE) ; ANSM non téléchargeable (état au %s)' % AUJ,
              'nb_points': len(avec), 'nb_sans_coord': len(sans),
              'nb_ouverts': sum(1 for p in pts if not p['ferme']), 'nb_fermes': sum(1 for p in pts if p['ferme']),
              'nb_non_repartiteurs': sum(1 for p in pts if not p['rep']), 'points': avec, 'sans_coord': sans,
              'journal': journal}
    # Compteurs des fiches (liste des sites fermés, nombre de sites) : mêmes règles qu'assembler.py.
    for g in fiches:
        miens = [p for p in pts if p['id'] == g['id']]
        g['fermetures'] = sorted([{'ville': p['ville'], 'dep': p['dep'], 'date': p['date_fermeture'], 'siret': p['siret']}
                                  for p in miens if p['ferme']], key=lambda f: f['date'] or '', reverse=True)
        g['nb_fermes'] = len(g['fermetures'])
        g['nb_points'] = sum(1 for p in miens if not p['ferme'] and p['lat'] is not None and p['lon'] is not None)
        g['nb_sans_coord'] = sum(1 for p in miens if not p['ferme'] and (p['lat'] is None or p['lon'] is None))

    with open(POINTS, 'w', encoding='utf-8') as f:
        json.dump(sortie, f, ensure_ascii=False, separators=(',', ':'))
    with open(DATA_JS, 'w', encoding='utf-8') as f:
        f.write(txt[:m.start(1)] + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + txt[m.end(1):])
    relu = json.load(open(POINTS, encoding='utf-8'))
    assert relu['nb_points'] == len(relu['points']) and relu['nb_ouverts'] == sum(1 for p in relu['points'] + relu['sans_coord'] if not p['ferme'])
    for l in journal:
        print('  journal :', l)
    print('OK carte : %d sites ouverts, %d fermés, %d sans coordonnées (%d SIREN suivis) -> %s'
          % (relu['nb_ouverts'], relu['nb_fermes'], relu['nb_sans_coord'], len(suivis), POINTS))


if __name__ == '__main__':
    # Deux étapes indépendantes : l'échec de l'une n'empêche pas l'autre d'écrire son fichier,
    # mais le robot finit en échec (rouge sur GitHub) pour qu'on le voie.
    echecs = []
    for etape in (main, carte):
        try:
            etape()
        except SystemExit as fin:
            if fin.code not in (None, 0):
                sys.stderr.write('ECHEC %s : %s\n' % (etape.__name__, fin.code))
                echecs.append(etape.__name__)
    sys.exit(1 if echecs else 0)

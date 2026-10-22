#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LE CATALOGUE INTÉGRAL PHARMA EN ENTIER -> crm/v2/catalogue-complet-data.js

Pourquoi ce fichier existe : l'écran « Produits » ne connaissait que les
6 292 références que le réseau a réellement achetées (PROD_STATS, seuil
>= 3 pharmacies). Le catalogue en compte 16 305 (16 439 lignes, dédoublonnées
par code-barres). Les 10 013 autres — dont
tout ce qu'on référence sans encore le vendre — étaient INVISIBLES dans
l'app : impossible de les proposer à une officine, impossible d'en faire
une fiche marketing.

Sources (toutes locales, hors dépôt) :
  · STATS/stock et prix 22 06 2026.xlsx  — LE catalogue : désignation, labo,
    molécule, nature (Referent/Generique/Biosimilaire), AFMCODE, PPHT, stock.
  · crm/v2/prod-stats-data.js            — stats réseau (nb pharmacies, net réel).

⚠️ STATS/prix-recents.json a été ESSAYÉ comme source de prix, puis ÉCARTÉ le
01/09/2026. Sa colonne « ppht » vient de PLVPUBRUT des fichiers de ventes, qui
porte le prix RÉELLEMENT FACTURÉ — donc le prix d'offre quand une offre
laboratoire s'applique. Mesuré sur DOLIPRANE 1000MG BT8 : il annonçait un tarif
de 0,78 € là où le tarif grossiste est 1,06 € (0,78 = l'offre Opella). Un tarif
faux déplace le produit de tranche et fausse l'abandon de marge derrière. Le
fichier « stock et prix » reste la seule source du TARIF.
  · crm/v2/generiqueurs-data.js          — répertoire officiel des génériques
    (BDPM), 11 381 CIP13. C'est LUI qui dit qu'un produit est un générique
    quand la colonne `artnature` du fichier de prix est vide — 3 692 des
    références remboursables sont dans ce cas.

⚠️ Les règles de classement et d'abandon de marge sont celles de
`generate_prod_stats.py`, qui reste la source de vérité. Elles sont reprises
ici parce que ce script tourne seul — et un CONTRÔLE final les rejoue sur les
6 292 références dont le réseau connaît déjà la réponse. Si le calcul y fait
passer un générique pour un princeps, il lui collerait un abandon de marge
inventé : au-delà de 3 cas, le script refuse de publier.

⚠️ LIMITE CONNUE, mesurée : 49 références portent `artnature = Referent` chez
un laboratoire qui ne vend que du générique et sont absentes du répertoire
BDPM. Il y a des deux dans le lot — de vrais princeps distribués par un
génériqueur (LYRICA, PARLODEL chez Biogaran) et de vrais génériques mal
étiquetés (LEVONORGESTREL BGA). Aucune règle automatique ne les sépare : les
classer en bloc ferait perdre un abandon réel sur les premiers. Elles restent
donc au classement du fichier de prix.
"""
import datetime
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
from collections import Counter, defaultdict

import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from source_prix import source_prix, colonne_repli, ppht_reference  # noqa: E402  (choix de source commun, 14/10/2026)
XLSX = source_prix()
PPHT_REF = ppht_reference()
PROD_STATS = os.path.join(ROOT, 'crm', 'v2', 'prod-stats-data.js')
GENERIQUEURS = os.path.join(ROOT, 'crm', 'v2', 'generiqueurs-data.js')
OUT = os.path.join(ROOT, 'crm', 'v2', 'catalogue-complet-data.js')
ETAB = os.path.join(ROOT, 'crm', 'v2', 'etab-prices-data.js')


def stock_des_sites():
    """Stock = SOMME des établissements (même lecture que generate_copilote_stock.py,
    lancer generate_etab_prices.py AVANT). Rend (somme par CIP, CIP connus d'un relevé,
    date du relevé le plus ancien). Le stock du fichier de prix de juin ne sert plus que
    pour un produit qu'aucun relevé ne connaît."""
    txt = open(ETAB, encoding='utf-8').read()
    etab = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    somme, connus = {}, set()
    for site in sorted(etab['prices']):
        for code, pq in etab['prices'][site].items():
            if not code.isdigit() or len(code) > 13:
                continue
            code = code.zfill(13)
            connus.add(code)
            q = int(pq[1] or 0)
            if q > 0:
                somme[code] = somme.get(code, 0) + q
    dates = etab.get('siteDates') or {}
    manquants = [s for s in etab['prices'] if not dates.get(s)]
    if not somme or manquants:
        sys.exit('Stock des sites illisible (%s) : %s' % (ETAB, ', '.join(manquants) or 'aucun stock'))
    return somme, connus, min(dates[s] for s in etab['prices'])

# ── Règles métier (miroir de generate_prod_stats.py) ────────────────────
TAUX_COEUR = 0.0389          # abandon du cœur de gamme, base PGHT
SUFFIXES_GENERIQUEURS = [
    "BGR", "EG", "TEVA", "MYL", "SDZ", "ZTL", "ARW", "CRS", "ZDS", "ACD", "KRK",
    "ALM", "EVP", "SUN", "BIOGARAN", "VIATRIS", "SANDOZ", "ZENTIVA", "ARROW",
    "CRISTERS", "MYLAN", "ACCORD", "ZYDUS", "ALMUS", "EVOLUPHARM", "SUBSTIPHARM",
    "REDDY", "EUGIA", "KRKA",
]
# ⚠️ La borne de generate_prod_stats.py ne connaît que l'espace et le tiret.
# Le fichier de prix écrit aussi « BIMATOPR.SDZ » et « HYDROCHLOROT.ARW » : le
# point et la barre oblique séparent tout autant, et sans eux ces génériques
# repartaient en princeps — donc avec un abandon de marge qui n'existe pas.
RX_GENERIQUEUR = re.compile(
    r"(?:^|[\s\-./])(" + "|".join(SUFFIXES_GENERIQUEURS) + r")(?:[\s\-./]|$)")


def famille(cip, ppht, remb, nat, designation='', repertoire=None, labo='',
            labos_generiqueurs=()):
    """NR · Génériques · Biosimilaires · Princeps par tranche de prix."""
    if not remb:
        return 'nr'
    nl = (nat or '').lower()
    if 'biosimilaire' in nl:
        return 'biosim'
    if 'generique' in nl or 'générique' in nl:
        return 'gen'
    # Le répertoire officiel des génériques prime sur toute déduction : quand
    # la BDPM dit qu'un CIP est un générique, il n'y a rien à interpréter.
    if repertoire and cip in repertoire:
        return 'gen'
    if RX_GENERIQUEUR.search((designation or '').upper()):
        return 'gen'
    # Dernier filet, quand `artnature` est vide : le laboratoire. Ces maisons-là
    # ne vendent QUE du générique (mesuré : 96 à 100 % de leurs remboursables
    # sont au répertoire BDPM). Le reste est du générique trop récent ou trop
    # ancien pour y figurer — et devant le doute, on classe en générique :
    # sous-estimer notre offre est moins grave qu'annoncer au pharmacien un
    # abandon de marge qui n'existe pas.
    if not nl and labo in labos_generiqueurs:
        return 'gen'
    if ppht <= 4.33:
        return 'pr_low'
    if ppht <= 468:
        return 'pr_mid'
    return 'pr_high'


def abandon_ip(p):
    """ABANDON DE MARGE Intégral sur un princeps remboursable — jamais la MDL."""
    if p <= 0:
        return 0.0
    if p <= 4.33:
        return 0.18
    if p <= 468:
        return p * TAUX_COEUR
    return 19.50


def porte_abandon(f):
    return f.startswith('pr_')


def r2(x):
    return round(float(x) + 1e-9, 2)


def txt(v):
    if v is None:
        return ''
    s = str(v).strip()
    return '' if s in ('#N/A', 'None', 'nan') else s


def nombre(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


# Pont code-barres/CIP + fusions manuelles écrits par generate_etab_prices.py (à lancer AVANT) :
# un article fusionné (« RP » = remplacé par, ou même code-barres) se range sous le code gardé,
# sinon le comptoir montre encore deux lignes, l'ancienne à 0 stock.
PONT_JSON = os.path.join(ROOT, 'STATS', 'pont-codes.json')
try:
    ALIAS = json.load(open(PONT_JSON, encoding='utf-8'))['alias']
except (OSError, ValueError, KeyError):
    ALIAS = {}
    print('⚠️ %s absent : lancer generate_etab_prices.py avant — catalogue sans pont' % PONT_JSON)
# Libellé de l'article gardé (fusions-codes.csv) : quand seul l'ancien article figure au catalogue
# de juin (le remplaçant est né après), sa ligne repliée ne doit pas s'appeler « … - RP nnnnnnn ».
LIBELLES, RP_RE = {}, re.compile(r'\s*-?\s*\bRP\s*\d{7}\b')
try:
    import csv
    for _r in csv.DictReader(open(os.path.join(ROOT, 'fusions-codes.csv'), encoding='utf-8'), delimiter=';'):
        _g = _r['garde_code_barres'] or _r['garde_cip13']
        if _r['libelle']:
            LIBELLES[ALIAS.get(_g, _g)] = _r['libelle']
except OSError:
    pass


def lire_catalogue():
    ws = openpyxl.load_workbook(XLSX, read_only=True, data_only=True).active
    hh = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
    col = {n: hh.index(n) for n in
           ('artcodebarre', 'artdesignation', 'artcollection',
            'artnature', 'afmcode', 'ppht', 'stockdispo', 'artclasse')}
    # `artmol` : absente de `stock POS.xlsx` -> reprise par code-barres dans le fichier le plus
    # récent qui la porte (juin). Un produit né après reste sans molécule (vide, non inventée).
    mol_col = hh.index('artmol') if 'artmol' in hh else None
    mol_repli = {} if mol_col is not None else colonne_repli('artmol', exclure=XLSX)
    out = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        brut = str(r[col['artcodebarre']] or '').strip()
        if not (brut.isdigit() and len(brut) >= 12):
            continue
        cip = ALIAS.get(brut, brut)
        d = txt(r[col['artdesignation']])
        if not d:
            continue
        if cip != brut:  # ligne repliée : le nom de l'article gardé
            d = LIBELLES.get(cip) or RP_RE.sub('', d).strip()
        # Un CIP peut revenir sur deux lignes : on garde celle qui a du stock.
        # Fusion : la ligne de l'article GARDÉ (son propre code) prime sur celle d'un article replié.
        stock = int(nombre(r[col['stockdispo']]))
        if cip in out and (out[cip]['own'] and cip != brut or out[cip]['own'] == (cip == brut) and out[cip]['s'] >= stock):
            continue
        out[cip] = {
            'own': cip == brut,
            'c': cip,
            'd': d,
            'labo': txt(r[col['artcollection']]),
            'mol': txt(r[mol_col]) if mol_col is not None else txt(mol_repli.get(brut)),
            'nat': txt(r[col['artnature']]),
            'remb': txt(r[col['afmcode']]) == 'REMBSS',
            'afm': txt(r[col['afmcode']]),
            'ppht': PPHT_REF[cip] if cip in PPHT_REF else r2(nombre(r[col['ppht']])),   # 14/10 : ppht-data.js fait foi
            's': stock,
            'mitm': txt(r[col['artclasse']]).upper() == 'MITM',
        }
    return out


# ── Associations : la composition OFFICIELLE fait foi (décision de Will, 22/10/2026) ────────
# `artmol` étiquetait 917 associations d'une seule de leurs substances (TRAMADOL/PAR.SDZ →
# « PARACETAMOL », 257 associations rangées sous HYDROCHLOROTHIAZIDE) : « Toute la molécule »
# additionnait leurs clientes à celles de la substance seule. Et une même association portait
# jusqu'à six noms (losartan + HCTZ). Règle : la composition se lit dans la BDPM (substances
# « SA » du CIS) ; à partir de deux substances, UNE étiquette par composition, posée sur tous
# ses produits. Mesure et décision : ~/jarvis-preuves/associations-catalogue-2026-10-22/.
BDPM_BASE = 'https://base-donnees-publique.medicaments.gouv.fr/download/file/'  # comme generate_generiques_bdpm.py
BDPM_LOCAL = os.path.expanduser('~/bdpm-historique/data')  # copie de secours (le site répondait 503 le 22/10)
BDPM_FICHIERS = ('CIS_CIP_bdpm.txt', 'CIS_COMPO_bdpm.txt', 'CIS_bdpm.txt')
BDPM_AGE_MAX_J = 120        # la base se met à jour chaque mois : au-delà, elle est figée
CHANGEMENTS_MAX = 1500      # 917 associations mal nommées + variantes d'écriture mesurées le 22/10
# Au-delà de 3 substances (nutrition parentérale, sels de lavement, vitamines, allergènes), le nom
# officiel compte jusqu'à 25 substances et l'étiquette actuelle (« MACROGOL 3350 ») est celle du
# métier : 19 des 917 produits mesurés le 22/10, laissés tels quels et listés.
SUBSTANCES_MAX = 3
# Mots qui ne désignent jamais la substance elle-même : liaison, sel, hydratation.
MOTS_VIDES = {'DE', 'D', 'DU', 'DES', 'ET', 'EN', 'L', 'LA', 'LE', 'SOUS', 'FORME', 'BASE', 'SEL',
              'EXPRIME', 'EXPRIMEE', 'EQUIVALENT', 'A'}
SELS = {'CHLORHYDRATE', 'DICHLORHYDRATE', 'MONOCHLORHYDRATE', 'BROMHYDRATE', 'MALEATE',
        'HYDROGENOMALEATE', 'FUMARATE', 'HEMIFUMARATE', 'TARTRATE', 'HYDROGENOTARTRATE',
        'MESILATE', 'BESILATE', 'TOSILATE', 'SUCCINATE', 'SODIQUE', 'POTASSIQUE', 'CALCIQUE',
        'MAGNESIQUE', 'MAGNESIEN', 'ARGININE', 'TERT', 'BUTYLAMINE', 'ERBUMINE', 'HYDRATE',
        'HYDRATEE', 'MONOHYDRATE', 'MONOHYDRATEE', 'DIHYDRATE', 'DIHYDRATEE', 'TRIHYDRATE',
        'TRIHYDRATEE', 'HEMIHYDRATE', 'HEMIHYDRATEE', 'SESQUIHYDRATE', 'ANHYDRE', 'PENTAHYDRATE',
        'HEXAHYDRATE', 'DIGLUCONATE', 'SOLUTION', 'BASE', 'ELEMENT'}
# Ions et radicaux : écartés quand la substance a un autre mot (CLAVULANATE DE POTASSIUM →
# CLAVULANATE), gardés quand elle n'a qu'eux (CARBONATE DE CALCIUM).
IONS = {'SODIUM', 'POTASSIUM', 'CALCIUM', 'MAGNESIUM', 'ACIDE', 'SULFATE', 'CITRATE', 'ACETATE',
        'PHOSPHATE', 'CARBONATE', 'CHLORURE', 'OXYDE', 'HYDROXYDE'}


def sans_accent(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s or '')
                   if unicodedata.category(c) != 'Mn').upper().strip()


SYNONYMES = {'CHOLECALCIFEROL': 'COLECALCIFEROL'}   # les deux graphies coexistent dans la base


def mots(s):
    return [SYNONYMES.get(w, w) for w in re.split(r"[^A-Z0-9]+", sans_accent(s)) if w]


def coeur(nom):
    """Les mots qui désignent la substance (« CLAVULANATE DE POTASSIUM » → CLAVULANATE)."""
    w = [x for x in mots(nom) if x not in MOTS_VIDES and x not in SELS]
    return [x for x in w if x not in IONS] or w


def nom_officiel(sa, ft):
    """Nom sans sel, en capitales sans accent comme `artmol` : la fraction thérapeutique quand la
    base la donne (« CLAVULANIQUE (ACIDE) » → ACIDE CLAVULANIQUE), sinon la substance sans son sel."""
    n = sans_accent(ft or sa)
    n = re.sub(r"^(.*?)\s*\(ACIDE\)", r"ACIDE \1", n)
    n = re.sub(r"\s*\([^)]*\)", '', n)
    n = re.sub(r"\b(%s)\s+D(?:E\s+|'\s*)(?=\S)" % '|'.join(sorted(SELS | IONS - {'ACIDE'}, key=len, reverse=True)), '', n)
    w = [x for x in re.split(r"\s+", n.replace("'", "' ")) if x and x not in SELS]
    return re.sub(r"'\s+", "'", ' '.join(w)).strip() or sans_accent(sa)


def _lignes(raw):
    # Les fichiers officiels ne sont pas tous dans le même encodage (CIS_CIP en UTF-8,
    # CIS_COMPO en latin-1 au 22/10/2026) — même lecture que generate_generiques_bdpm.py.
    try:
        t = raw.decode('utf-8')
    except UnicodeDecodeError:
        t = raw.decode('latin-1', 'ignore')
    return [ln.split('\t') for ln in t.splitlines() if ln.strip()]


def _age_bdpm(ciscip, aujourdhui):
    """Âge du CONTENU (date de déclaration la plus récente non future), jamais de la copie."""
    best = ''
    for r in ciscip:
        p = (r[5] if len(r) > 5 else '').strip().split('/')
        if len(p) == 3 and len(p[2]) == 4 and p[2] + '-' + p[1] + '-' + p[0] <= aujourdhui.isoformat():
            best = max(best, p[2] + '-' + p[1] + '-' + p[0])
    return (aujourdhui - datetime.date.fromisoformat(best)).days if best else None, best


def lire_bdpm():
    """{cip13: cis}, {cis: [(code, nom SA, nom FT)]}, {cis homéopathiques}, libellé de la source.
    Téléchargement officiel d'abord, copie locale ensuite ; une base figée ou tronquée est
    refusée, et sans base valable le script s'arrête : le catalogue publié reste en place
    (le republier sans composition remettrait les 917 fausses étiquettes)."""
    essais = [('téléchargement officiel', lambda f: urllib.request.urlopen(
                  urllib.request.Request(BDPM_BASE + f, headers={'User-Agent': 'Mozilla/5.0'}),
                  timeout=180).read()),
              ('copie locale ' + BDPM_LOCAL, lambda f: open(os.path.join(BDPM_LOCAL, f), 'rb').read())]
    for nom, lire in essais:
        try:
            ciscip, compo_l, cis_l = (_lignes(lire(f)) for f in BDPM_FICHIERS)
        except Exception as e:  # noqa: BLE001 — panne du site ou copie absente : on passe à la suite
            print('  [bdpm] %s indisponible (%s)' % (nom, str(e)[:80]))
            continue
        age, dern = _age_bdpm(ciscip, datetime.date.today())
        if age is None or age > BDPM_AGE_MAX_J or len(ciscip) < 10000 or len(compo_l) < 10000:
            print('  [bdpm] %s refusée : dernière date %s (âge %s j), %d présentations, %d lignes de composition'
                  % (nom, dern or '?', age, len(ciscip), len(compo_l)))
            continue
        cip2cis = {r[6].strip(): r[0].strip() for r in ciscip if len(r) > 6 and len(r[6].strip()) == 13}
        ft = {}
        for r in compo_l:
            if len(r) > 7 and r[6].strip() == 'FT':
                ft[(r[0].strip(), r[1].strip(), r[7].strip())] = r[3].strip()
        compo = defaultdict(list)
        for r in compo_l:
            if len(r) > 7 and r[6].strip() == 'SA':
                cis, code = r[0].strip(), r[2].strip()
                if all(c != code for c, _, _ in compo[cis]):
                    compo[cis].append((code, r[3].strip(), ft.get((cis, r[1].strip(), r[7].strip()))))
        homeo = {r[0].strip() for r in cis_l if len(r) > 5 and 'homéo' in r[5].lower()}
        print('  [bdpm] %s · contenu au %s · %d présentations · %d compositions'
              % (nom, dern, len(cip2cis), len(compo)))
        return cip2cis, dict(compo), homeo, 'BDPM (%s) au %s' % (nom.split(' /')[0].split(' ~')[0], dern)
    sys.exit('ARRÊT : aucune base BDPM valable (site officiel puis %s). Catalogue NON régénéré.' % BDPM_LOCAL)


def _nomme(jeton, sub):
    """Le mot d'étiquette `jeton` désigne-t-il la substance (abréviations comprises : HYD, AC.CLAV) ?"""
    if len(jeton) < 3:
        return False
    for w in sub:
        if w.startswith(jeton) or jeton.startswith(w):
            return True
        n = 0
        while n < min(len(w), len(jeton)) and w[n] == jeton[n]:
            n += 1
        if n >= 6:
            return True
    return False


def _parts(etiq):
    return [p for p in re.split(r'\s*(?:/|\+)\s*', etiq or '') if p.strip()]


def _complete(etiq, subs):
    """« A/B » qui écrit chaque substance EN ENTIER, une partie par substance."""
    ps = [set(mots(p)) for p in _parts(etiq)]
    return len(ps) == len(subs) >= 2 and all(any(set(s) & p for p in ps) for s in subs) \
        and all(any(set(s) & p for s in subs) for p in ps)


def _compatible(etiq, subs):
    """« A/B » dont chaque partie désigne une des substances (abrégée ou non), et inversement."""
    ps = [mots(p) for p in _parts(etiq)]
    return len(ps) == len(subs) >= 2 and all(any(_nomme(j, s) for p in ps for j in p) for s in subs) \
        and all(any(_nomme(j, s) for s in subs for j in p) for p in ps)


def _racine(w):
    return re.sub(r'(ATE|IQUE)$', '', w) if len(w) > 7 else w   # CLAVULANATE ~ CLAVULANIQUE


def fractions(compo):
    """Les substances « SA » regroupées par molécule active : deux sels ou formes d'une même
    molécule (VALPROATE DE SODIUM + ACIDE VALPROIQUE) n'en font qu'une, et deux génériques qui
    n'ont pas le même sel (alendronate monosodique ou sodique) ont la même composition.
    Rend [(racines, mots de la substance, nom officiel)], dans l'ordre de la base."""
    out = []
    for _, sa, ft in compo:
        w = set(coeur(sa)) | set(coeur(ft or ''))
        # Un sel minéral seul (CHLORURE DE SODIUM) ne se confond pas avec un autre (DE POTASSIUM).
        r = {_racine(x) for x in w if x not in IONS} or {'+'.join(sorted(w))}
        nom = nom_officiel(sa, ft)
        for f in out:
            if f[0] & r:
                f[0] |= r
                f[1] |= w
                f[2] = min(f[2], nom, key=len)
                break
        else:
            out.append([r, w, nom])
    return out


def etiquette_composition(etiqs, fr):
    """L'étiquette UNIQUE d'une composition : l'« A/B » déjà utilisée la plus complète (toutes
    substances en entier), sinon la plus fréquente, sinon les noms officiels sans sel. None quand
    un nom officiel est inutilisable (souche de vaccin « A/MICHIGAN/105/2025… ») : rien ne change.
    `etiqs` = étiquettes actuelles de ses produits, `fr` = fractions(composition)."""
    subs = [sorted(f[1]) for f in fr]
    n = Counter(e for e in etiqs if e)
    for ok in (_complete, _compatible):
        c = sorted((e for e in n if ok(e, subs)), key=lambda e: (-n[e], e))
        if c:
            return c[0]
    noms = [f[2] for f in fr]
    if any('/' in x or len(x) > 40 for x in noms):
        return None
    return '/'.join(noms)


RX_ASSO_NOM = re.compile(r"^(.*?[A-Z]{3,}\.?/[A-Z]{3,})")  # « FOSINOPRIL/HYD.CRT … » → FOSINOPRIL/HYD


def corriger_associations(cat, cip2cis, compo, homeo):
    """Pose l'étiquette de sa composition sur chaque produit d'association. Modifie `cat` et rend
    le bilan. Ne touche JAMAIS un produit à une seule substance officielle, ni un produit dont
    l'étiquette ne nomme aucune de ses substances (étiquette sans rapport : à arbitrer par Will)."""
    groupes = defaultdict(list)
    bilan = {'changes': [], 'sans_rapport': [], 'vides': [], 'hors_bdpm': [], 'hors_bdpm_seuls': [],
             'nombreuses': [], 'illisibles': []}
    fr_de = {}
    for cip, o in cat.items():
        cis = cip2cis.get(cip)
        if cis and cis not in homeo and len(compo.get(cis, ())) >= 2:
            if cis not in fr_de:
                fr_de[cis] = fractions(compo[cis])
            fr = fr_de[cis]
            if len(fr) < 2:
                continue                          # une seule molécule sous deux sels : pas une association
            if len(fr) > SUBSTANCES_MAX:
                bilan['nombreuses'].append(cip)
            else:
                groupes[frozenset(frozenset(f[0]) for f in fr)].append(cip)
    # Deux compositions dont chaque molécule se retrouve chez l'autre n'en font qu'une, même quand
    # la base décrit l'une plus longuement (« CHOLECALCIFEROL CONCENTRAT (FORME PULVERULENTE) »).
    cles = sorted(groupes, key=lambda k: -len(groupes[k]))
    for i, a in enumerate(cles):
        if a not in groupes:
            continue
        for b in cles[i + 1:]:
            if b in groupes and len(a) == len(b) and all(sum(1 for y in b if x & y) == 1 for x in a) \
                    and all(sum(1 for x in a if x & y) == 1 for y in b):
                groupes[a] += groupes.pop(b)
    bilan['groupes'] = len(groupes)
    etiq_de = {}
    for cips in groupes.values():
        # L'ordre des noms officiels : celui de la présentation la plus représentée du groupe.
        cis_ = Counter(cip2cis[c] for c in cips).most_common()
        fr = fr_de[min(cis_, key=lambda x: (-x[1], x[0]))[0]]
        e = etiquette_composition([cat[c]['mol'] for c in cips], fr)
        if e is None:
            bilan['illisibles'] += cips
            continue
        subs = [sorted(f[1]) for f in fr]
        for c in cips:
            avant = cat[c]['mol']
            etiq_de[c] = e
            if avant == e:
                continue
            if not avant:
                # Produit né après juin, sans `artmol` : on ne lui invente rien (comme ailleurs).
                bilan['vides'].append(c)
            elif not any(_nomme(j, s) for s in subs for j in mots(avant)):
                bilan['sans_rapport'].append((c, cat[c]['d'], avant, e))
            else:
                bilan['changes'].append((c, cat[c]['d'], avant, e))
                cat[c]['mol'] = e
    # Les produits nommés « A/B » mais absents de la base : l'étiquette d'un frère de même
    # début de nom, quand ses frères n'en portent qu'une.
    for cip, o in cat.items():
        if cip in etiq_de or not o['mol'] or '/' in o['mol'] or (cip2cis.get(cip) in compo):
            continue
        m = RX_ASSO_NOM.match(sans_accent(o['d']))
        if not m:
            continue
        freres = {etiq_de[c] for c in etiq_de if sans_accent(cat[c]['d']).startswith(m.group(1))}
        if len(freres) == 1:
            e = freres.pop()
            bilan['hors_bdpm'].append((cip, o['d'], o['mol'], e))
            o['mol'] = e
        else:
            bilan['hors_bdpm_seuls'].append((cip, o['d'], o['mol'], sorted(freres)))
    # Garde-fous : rien de neuf sur une substance seule, pas de changement en série.
    for c, _, _, _ in bilan['changes']:
        if len(fractions(compo[cip2cis[c]])) < 2:
            sys.exit('ARRÊT : étiquette d\'association posée sur un produit à une seule substance (%s).' % c)
    n = len(bilan['changes']) + len(bilan['hors_bdpm'])
    if n > CHANGEMENTS_MAX:
        sys.exit('ARRÊT : %d étiquettes de molécule changeraient (plafond %d) — règle à revoir avant de publier.'
                 % (n, CHANGEMENTS_MAX))
    return bilan


def lire_prod_stats():
    s = open(PROD_STATS, encoding='utf-8').read()
    i = s.index('[')
    j = s.rindex(']')
    return {str(o['c']): o for o in json.loads(s[i:j + 1])}


def lire_repertoire():
    s = open(GENERIQUEURS, encoding='utf-8').read()
    return set(json.loads(s[s.index('{'):s.rindex('}') + 1]).keys())


def labos_generiqueurs(cat, repertoire, part=0.80, mini=20):
    """Les laboratoires qui ne vendent QUE du générique, DÉDUITS des données :
    part de leurs remboursables présents au répertoire officiel. Rien n'est
    écrit en dur — si Intégral change de fournisseurs, la liste suit."""
    tot, dedans = Counter(), Counter()
    for o in cat.values():
        if not o['remb'] or not o['labo']:
            continue
        tot[o['labo']] += 1
        if o['c'] in repertoire:
            dedans[o['labo']] += 1
    return {l: (tot[l], dedans[l]) for l in tot
            if tot[l] >= mini and dedans[l] / tot[l] >= part}


def main():
    for p in (XLSX, PROD_STATS, GENERIQUEURS):
        if not os.path.exists(p):
            sys.exit('Source manquante : ' + p)

    cat = lire_catalogue()
    cip2cis, compo, homeo, src_compo = lire_bdpm()
    assoc = corriger_associations(cat, cip2cis, compo, homeo)
    print('associations (%s) : %d compositions · %d étiquettes corrigées · %d hors base corrigées par un frère'
          % (src_compo, assoc['groupes'], len(assoc['changes']), len(assoc['hors_bdpm'])))
    print('   laissées telles quelles : %d sans molécule · %d étiquette sans rapport avec la composition '
          '(à arbitrer) · %d nommées « A/B » hors base sans frère · %d à plus de %d substances · '
          '%d au nom officiel inutilisable' % (
              len(assoc['vides']), len(assoc['sans_rapport']), len(assoc['hors_bdpm_seuls']),
              len(assoc['nombreuses']), SUBSTANCES_MAX, len(assoc['illisibles'])))
    for c, d, avant, e in assoc['sans_rapport'][:8]:
        print('     sans rapport : %s %-34s « %s » (composition : %s)' % (c, d[:34], avant, e))
    for c, d, avant, f in assoc['hors_bdpm_seuls']:
        print('     hors base : %s %-34s « %s » (frères : %s)' % (c, d[:34], avant, ', '.join(f) or 'aucun'))
    ps = lire_prod_stats()
    repertoire = lire_repertoire()
    generiqueurs = labos_generiqueurs(cat, repertoire)
    print('catalogue : %d références · stats réseau : %d · répertoire génériques : %d'
          % (len(cat), len(ps), len(repertoire)))
    print('laboratoires 100 %% générique déduits des données : %d (%s…)'
          % (len(generiqueurs),
             ', '.join(sorted(generiqueurs, key=lambda l: -generiqueurs[l][0])[:6])))

    stk_sites, stk_connus, stk_date = stock_des_sites()
    labos, mols = {}, {}
    rows = []
    fam_compte = Counter()
    faux_abandons, ecarts_fam, statut_change = [], [], []

    for cip in sorted(cat):
        o = cat[cip]
        ppht = o['ppht']
        f = calcule = famille(cip, ppht, o['remb'], o['nat'], o['d'],
                              repertoire, o['labo'], generiqueurs)
        # Quand le réseau connaît déjà le produit, sa famille EST celle que
        # l'app affiche partout ailleurs. On ne la recalcule pas : deux écrans
        # qui classent le même produit différemment, c'est un bug visible.
        if cip in ps and ps[cip].get('f'):
            f = ps[cip]['f']
            if f != calcule:
                ecarts_fam.append((cip, o['d'][:40], f, calcule))
                # Le seul sens dangereux : le réseau dit générique/biosimilaire
                # et mon calcul dit princeps. Ça collerait un abandon de marge
                # fictif à un produit qui n'en porte aucun.
                if not porte_abandon(f) and porte_abandon(calcule):
                    # 14/10/2026 — le réseau dit « nr » (relevé de juin) et le fichier de prix
                    # récent dit « remboursable » : le STATUT a changé dans la source, ce n'est
                    # pas une règle cassée. Le classement du réseau est retenu (aucun abandon
                    # publié) ; on le compte à part pour ne pas déclencher l'arrêt de sécurité.
                    if f == 'nr':
                        statut_change.append((cip, o['d'][:40], f, calcule))
                    else:
                        faux_abandons.append((cip, o['d'][:40], f, calcule))
        fam_compte[f] += 1

        # NET : le net réseau d'abord — c'est CELUI QUE L'APP AFFICHE déjà
        # partout ailleurs, et deux écrans qui donnent deux prix pour le même
        # produit, c'est un bug visible. Le barème ensuite, pour tout ce que le
        # réseau n'a jamais acheté ; et il NE S'APPLIQUE QU'AUX PRINCEPS.
        net = 0.0
        if cip in ps and nombre(ps[cip].get('net')) > 0:
            # ⚠️ On NE corrige PAS ce chiffre, même quand il dépasse le tarif du
            # 22/06 : c'est celui que l'app affiche déjà partout. Le « corriger »
            # posait un second prix pour 494 des 6 292 produits du réseau (jusqu'à
            # 18 € d'écart sur XGEVA) — deux vérités dans la même app. Un net
            # au-dessus du tarif veut dire que le tarif a bougé depuis, pas que
            # la facture est fausse ; les colonnes d'abandon savent se taire
            # toutes seules dans ce cas.
            net = r2(ps[cip]['net'])
        elif ppht > 0:
            net = r2(ppht - abandon_ip(ppht)) if porte_abandon(f) else ppht


        li = labos.setdefault(o['labo'], len(labos)) if o['labo'] else -1
        mi = mols.setdefault(o['mol'], len(mols)) if o['mol'] else -1
        st = ps.get(cip)
        rows.append([
            cip, o['d'], li, mi, f, ppht, net,
            stk_sites.get(cip, 0) if cip in stk_connus else o['s'],
            1 if o['mitm'] else 0,
            int(st['n']) if st and st.get('n') else 0,      # nb pharmacies acheteuses
        ])

    # ── Le contrôle qui compte ─────────────────────────────────────────
    # Les 6 292 produits que le réseau achète sont les seuls dont on connaisse
    # déjà la réponse. Si mon classement en fait des princeps là où l'app dit
    # générique, la même erreur frappe en silence les 10 000 autres — et
    # chacun ressort avec un abandon de marge inventé.
    # Au-delà de 3, ce n'est plus un accident de saisie mais une règle cassée :
    # la même erreur frappe alors en silence les 10 000 références que le
    # réseau ne connaît pas. (Mesuré : la borne de mot sans le point en
    # laissait passer 26 d'un coup.)
    if statut_change:
        print('\nℹ️  %d produit(s) « nr » au réseau et « remboursable » dans le fichier de prix récent '
              '(statut changé depuis juin) : classement du réseau retenu, aucun abandon publié.'
              % len(statut_change))
    if faux_abandons:
        print('\n⚠️  %d produit(s) que le réseau dit générique/biosimilaire et que '
              'le calcul dit princeps :' % len(faux_abandons))
        for e in faux_abandons[:12]:
            print('   %s %-40s réseau=%s calcul=%s' % e)
        print('   (le classement du réseau est retenu pour eux ; la cause est une '
              'colonne `artnature` fausse dans le fichier de prix)')
    if len(faux_abandons) > 3:
        sys.exit('Abandon de marge fictif en série — corriger la règle avant de publier.')

    labos_l = [''] * len(labos)
    for k, v in labos.items():
        labos_l[v] = k
    mols_l = [''] * len(mols)
    for k, v in mols.items():
        mols_l[v] = k

    meta = {
        'source': os.path.relpath(XLSX, ROOT),
        'arrete': time.strftime('%Y-%m-%d', time.localtime(os.path.getmtime(XLSX))),
        'stockSource': 'crm/v2/etab-prices-data.js (somme des établissements)',
        'stockArrete': stk_date,
        'molSource': 'artmol, associations selon la composition ' + src_compo,
        'n': len(rows),
        'enStock': sum(1 for r in rows if r[7] > 0),
        'connusReseau': sum(1 for r in rows if r[9] > 0),
        'cols': ['cip', 'd', 'labo', 'mol', 'fam', 'ppht', 'net', 'stock', 'mitm', 'nbPharm'],
    }
    # Une ligne JS par référence : Safari n'avale pas un fichier d'un seul bloc.
    corps = ',\n'.join(json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in rows)
    js = ('/* Catalogue Intégral Pharma COMPLET — généré par generate_catalogue_complet.py.\n'
          '   Ne pas éditer à la main. %d références au %s. */\n'
          'window.CATALOGUE_COMPLET={\n'
          'meta:%s,\n'
          'labos:%s,\n'
          'mols:%s,\n'
          'rows:[\n%s\n]};\n'
          % (len(rows), meta['arrete'],
             json.dumps(meta, ensure_ascii=False),
             json.dumps(labos_l, ensure_ascii=False, separators=(',', ':')),
             json.dumps(mols_l, ensure_ascii=False, separators=(',', ':')),
             corps))
    open(OUT, 'w', encoding='utf-8').write(js)

    print('\n→ %s · %.2f Mo' % (OUT, os.path.getsize(OUT) / 1048576))
    print('   %d références · %d en stock · %d déjà commandées par le réseau'
          % (meta['n'], meta['enStock'], meta['connusReseau']))
    print('   familles : ' + ' · '.join('%s %d' % kv for kv in fam_compte.most_common()))
    print('   %d laboratoires · %d molécules' % (len(labos_l), len(mols_l)))
    print('   contrôle : %d CIP communs avec le réseau · %d familles reprises '
          'du réseau · 0 abandon fictif en série'
          % (sum(1 for r in rows if r[0] in ps), len(ecarts_fam)))


if __name__ == '__main__':
    main()

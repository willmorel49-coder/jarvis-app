# -*- coding: utf-8 -*-
"""Veille ACTUALITÉS grossistes-répartiteurs (onglet Concurrents).

Agrège gratuitement (aucune clé) les news du secteur de la répartition pharmaceutique
française via Google News RSS (requêtes ciblées : secteur + chaque grossiste) + presse pro,
dédoublonne, tague par grossiste, et écrit crm/v2/grossistes-actu.json que le CRM lit.

Robot quotidien (GitHub Actions). Python 3.9+, stdlib seulement.
"""
import json
import os
import re
import sys
import html
import urllib.parse
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(__file__)
OUT = os.path.join(ROOT, 'crm', 'v2', 'grossistes-actu.json')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
GNEWS = 'https://news.google.com/rss/search?q=%s&hl=fr&gl=FR&ceid=FR:fr'

# Requêtes Google News : secteur global + un tag par grossiste (pour colorer/filtrer dans l'app).
# 'q' = requête ; 'tag' = grossiste rattaché ('' = secteur général).
QUERIES = [
    {'tag': '', 'q': '"répartition pharmaceutique" France'},
    {'tag': '', 'q': '"grossiste répartiteur" pharmacie'},
    {'tag': '', 'q': 'CSRP répartiteurs pharmacie'},
    # 25/09/2026 — un seul nom par concurrent (décision Will) : Phoenix OCP = 'ocp'
    # (l'ancien tag 'phoenix' y est fondu), CERP Rouen + CERP RRM = 'cerp' (fusion
    # du 01/07/2024 : la presse ne dit plus que « CERP », d'où la requête courte).
    {'tag': 'ocp', 'q': '"OCP" répartition pharmaceutique'},
    {'tag': 'ocp', 'q': '"Phoenix OCP"'},
    {'tag': 'cerp', 'q': '"CERP Rouen" OR Astera pharmacie'},
    {'tag': 'cerp', 'q': '"CERP RRM" pharmacie'},
    {'tag': 'cerp', 'q': '"CERP" répartition pharmaceutique'},
    {'tag': 'alliance', 'q': '"Alliance Healthcare" France pharmacie'},
    {'tag': 'ocp', 'q': '"Phoenix Pharma" France répartition'},
    {'tag': 'sagitta', 'q': 'Sagitta répartiteur pharmacie'},
    {'tag': 'cophana', 'q': 'Cophana grossiste pharmacie'},
    {'tag': 'welcoop', 'q': 'Welcoop pharmacie répartition'},
    {'tag': 'giphar', 'q': 'Giphar répartition pharmacie'},
    {'tag': '', 'q': 'short-liner grossiste pharmacie'},

    # Angles ajoutés le 04/08/2026. Les requêtes ci-dessus ne suivent que la
    # RÉPARTITION ; il manquait tout ce qui se passe en amont (laboratoires,
    # génériques, biosimilaires) et en face (groupements d'achat, rémunération
    # de l'officine) — c'est-à-dire exactement les sujets de discussion en
    # rendez-vous pharmacien. Testé sur 30 jours : 17 articles pertinents,
    # dont l'extension du « tiers payant contre génériques » aux biosimilaires
    # au 1er septembre, qu'aucune requête existante ne remontait.
    # Requêtes volontairement SIMPLES : Google News renvoie 0 résultat sur les
    # requêtes à rallonge avec plusieurs OR.
    {'tag': 'generique', 'q': 'substitution générique officine'},
    {'tag': 'generique', 'q': 'Zentiva OR Sandoz générique'},
    {'tag': 'generique', 'q': 'Biogaran pharmacie'},
    {'tag': 'biosimilaire', 'q': 'biosimilaire substitution officine'},
    {'tag': 'biosimilaire', 'q': 'tiers payant contre génériques'},
    {'tag': 'groupement', 'q': 'groupement pharmacies France'},
    {'tag': 'groupement', 'q': 'PharmaBest'},
    {'tag': 'groupement', 'q': 'Aprium pharmacie'},
    {'tag': 'marge', 'q': 'marge officine pharmacien rémunération'},
    {'tag': 'marge', 'q': 'honoraires dispensation pharmacien'},

    # 23/09/2026 : une commerciale rapporte que Sagitta rachèterait Médiane
    # Répartition (Carcassonne) et Mezegel Répartition (Hillion), deux petits
    # grossistes aux mêmes propriétaires. Rien dans la presse ce jour-là.
    {'tag': 'sagitta', 'q': '"Médiane Répartition"'},
    {'tag': 'sagitta', 'q': 'Mezegel Répartition'},
    {'tag': 'aredis', 'q': 'Aredis pharmacie'},
    {'tag': 'rbp', 'q': '"RBP Pharma"'},

    # 15/10/2026 soir — « creuse encore » : 100 requêtes testées, seules celles-ci ramènent des articles
    # neufs sur la répartition (détail : jarvis-preuves/concurrents-carte-2026-10-14/actu-ciblage/CREUSER.md).
    {'tag': '', 'q': 'CSRP répartition pharmaceutique'},
    {'tag': '', 'q': 'marge des grossistes médicaments'},
    {'tag': '', 'q': 'répartiteurs pharmaceutiques ventes directes laboratoires'},
    {'tag': '', 'q': 'répartiteur pharmaceutique nouveau site logistique'},
]

# Annonces OFFICIELLES (BODACC, gratuit, sans clé) : une cession ou un changement
# de dirigeant y paraît souvent avant la presse. Dépôts de comptes ignorés (bruit).
BODACC = 'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?where=%s&order_by=dateparution%%20desc&limit=20'
BODACC_SUIVIS = [
    {'siren': '977768548', 'nom': 'Médiane Répartition', 'tag': 'sagitta'},
    {'siren': '949685143', 'nom': 'Mezegel Répartition', 'tag': 'sagitta'},
    {'siren': '534188941', 'nom': 'Sagitta Pharma', 'tag': 'sagitta'},
    # 24/09/2026 : rumeur « Drapier crée un grossiste en Auvergne, repris par
    # Aredis ou RBP ». Au registre : ALVERNIA (Cournon-d'Auvergne, créée le
    # 30/07/2026, sans activité) et MEDISCA (Couchey, grossiste actif depuis
    # 03/2026). La reprise se lira comme un changement de président.
    {'siren': '108299611', 'nom': 'Alvernia', 'tag': 'drapier'},
    {'siren': '994320257', 'nom': 'Medisca', 'tag': 'drapier'},
    {'siren': '893833285', 'nom': 'Triorose (holding Drapier-Dupin)', 'tag': 'drapier'},
    {'siren': '897446050', 'nom': 'Miastra (holding Drapier)', 'tag': 'drapier'},
    {'siren': '451436083', 'nom': 'Aredis', 'tag': 'aredis'},
    {'siren': '419582358', 'nom': 'RBP Pharma', 'tag': 'rbp'},
]

# Filtre pertinence : au moins un mot du secteur (évite le bruit "alliance"/"phoenix" hors pharma).
KW = re.compile(r'pharmac|r[eé]partit|grossiste|officine|CERP|OCP|Alliance Healthcare|Phoenix Pharma|Giphar|Sagitta|Cophana|Welcoop|Astera|Alphega|labo|m[eé]dicament|g[eé]n[eé]rique|approvisionn|rupture'
                # Ajouts du 04/08/2026, pour les nouveaux angles (voir QUERIES).
                r'|biosimilaire|substitu|honoraire|groupement|tiers payant|remboursement|d[eé]livrance', re.I)

# Flux RSS DIRECTS gratuits (texte complet accessible) — priorité "accès libre".
FEEDS = [
    {'src': 'FSPF', 'url': 'https://www.fspf.fr/feed/', 'libre': True},
    {'src': 'ANSM · Actualités', 'url': 'https://ansm.sante.fr/rss/actualites?produitsSante=medicaments', 'libre': True},
    {'src': 'ANSM · Disponibilité', 'url': 'https://ansm.sante.fr/rss/disponibilite_produits_sante?produitsSante=medicaments', 'libre': True},
    # 25/09/2026 — testés en vrai le 24/09 (HTTP 200, articles du jour) : les
    # alertes de sécurité et rappels de l'ANSM, et Le Moniteur (en partie payant).
    {'src': 'ANSM · Sécurité', 'url': 'https://ansm.sante.fr/rss/informations_securite?produitsSante=medicaments', 'libre': True},
    {'src': 'Le Moniteur des pharmacies', 'url': 'https://www.lemoniteurdespharmacies.fr/feed/', 'libre': False},
]

# 25/09/2026 — un article venu d'un flux direct ou d'une requête « secteur » n'a pas
# de tag, même quand il nomme un concurrent : seuls 11 articles sur 119 en portaient
# un. On le reconnaît à son nom dans le titre ou le résumé. Ordre = du plus précis
# au plus large (« CERP Bretagne Atlantique » avant « CERP »).
NOMS = [
    ('cerp-ba', re.compile(r'CERP Bretagne', re.I)),
    ('cerp', re.compile(r'\bCERP\b|\bAstera\b')),
    ('ocp', re.compile(r'Phoenix (OCP|Pharma)|\bOCP\b')),
    ('alliance', re.compile(r'Alliance Healthcare', re.I)),
    ('giphar', re.compile(r'\b(So)?giphar\b', re.I)),
    ('drapier', re.compile(r'\bMedisca\b|\bAlvernia\b|C[ée]dric Drapier', re.I)),
    ('sagitta', re.compile(r'\bSagitta\b|M[ée]diane R[ée]partition|\bMezegel\b', re.I)),
    ('aredis', re.compile(r'\bAredis\b', re.I)),
    ('rbp', re.compile(r'\bRBP Pharma\b', re.I)),
    ('cophana', re.compile(r'\bCophana\b', re.I)),
    ('welcoop', re.compile(r'\bWelcoop\b', re.I)),
]


def tag_par_nom(row):
    txt = row.get('titre', '') + ' ' + row.get('resume', '')
    for tag, rx in NOMS:
        if rx.search(txt):
            return tag
    return ''
# Sources connues PAYANTES (mur d'abonnement) — on tague pour prévenir l'utilisateur.
PAYWALL = re.compile(r'moniteur des pharmacies|quotidien du pharmacien|apmnews|les echos|le figaro|mediapart|whatsupdoc|pharmaceutiques\b|l\'?usine|challenges', re.I)


# ── 15/10/2026 — ÉLARGISSEMENT : une requête par fiche de grossiste qui a de la presse ──────
# Will (14/10) : « je veux vraiment qu'on ait des actus, pas besoin de remonter dans le temps
# aussi loin ». 85 fiches sur 132 n'avaient aucune actualité. Le tag de ces articles = l'`id` de
# la fiche (ou le tag déjà lu par la fiche : sagitta, cerp, cerp-ba, drapier, aredis…).
# On n'interroge PAS les fiches sans presse en ligne (52 homonymes purs) et jamais SR Pharma,
# Nord Répartition, Pharmest ni les ip-* (ce sont nous).
#
# FILTRE ANTI-HOMONYMES, le même pour tous (un article n'est rattaché que s'il passe les 3 portes) :
#   1. porte « métier » : le titre contient pharmac*, répartit*, grossiste, officine, médicament
#      ou ANSM — hors du nom lui-même (« Comptoir Pharmaceutique… » ne se valide pas tout seul) ;
#   2. porte « nom » : le titre porte le nom de l'acteur (regex 'nom'), ou une formule de repli 'alt'
#      (ex. « deux grossistes-répartiteurs » pour l'amende ANSM de Medi-Live et d'Aredis, dont le
#      titre ne cite aucun des deux) ;
#   3. porte « lieu » : pour un nom courant (Delta, Epsilon, Straight, Atlantique, Alvernia…),
#      le titre porte aussi sa ville, sa région ou un mot de son groupe ('ctx').
# Sans résumé exploitable dans le flux Google (il ne répète que le titre), tout se juge sur le titre.
DATE_MINI = '2025-10-01'
# Homonymes déjà constatés : le CERP belge (Frasnes-lez-Buissenal, 28/10/2025) n'est pas le CERP français.
EXCLUS = re.compile(r'Belgique|Wallonie|Hainaut|Frasnes|Buissenal|Tournai|Li[eè]ge|Namur', re.I)
METIER = re.compile(r'pharmac|r[eé]partit|grossiste|officine|m[eé]dicament|\bANSM\b', re.I)

ACTEURS = [
    # 'brand': True = le nom est lui-même une marque du monde pharmaceutique (CERP, Giphar, Welcoop,
    # Laborex…) : il tient lieu de mot du métier (porte 1), sans quoi « CERP Réunion sanctionnée
    # d'une amende » serait écarté. Jamais pour un nom courant.
    # ── grands ──
    {'tag': 'cerp-ba', 'qs': ['CERP Bretagne Atlantique', 'CERP Bretagne', 'Atlantique Répartition'],
     'nom': r'CERP Bretagne|Pharmar|Ploufragan|Bretagne Atlantique', 'brand': True},
    {'tag': 'cerp', 'qs': ['CERP Rouen', 'Astera CERP', 'Astera pharmacie répartition', 'CERP Wissous entrepôt', 'CERP Rouen entrepôt'],
     'nom': r'\bAstera\b|\bCERP\b', 'brand': True, 'ctx': r'pharmac|r[eé]partit|grossiste|Rouen|Normandie|Rhin|Bronchain|CERP|Astera'},
    {'tag': 'sipr', 'qs': ['SIPR Réunion', 'CERP Réunion'],
     'nom': r'\bSIPR\b|CERP R[eé]union|CERP Oc[eé]an', 'brand': True},
    {'tag': 'epsilon', 'qs': ['Epsilon pharmacie', 'Gink\'GO', 'Apo\'Coop'],
     'nom': r'\bEpsilon\b', 'ctx': r"Gink'?\s?GO|Apo'?\s?Coop|Bourgogne|Franche|Dijon|Besan[cç]on|Chalon|Mâcon|r[eé]partiteur|grossiste"},
    {'tag': 'ginkgo', 'qs': ['Gink\'GO pharmacie', 'Gink\'GO alliance d\'achat'], 'nom': r"Gink'?\s?GO"},
    {'tag': 'apocoop', 'qs': ['Apo\'Coop pharmacie'], 'nom': r"Apo'?\s?Coop"},
    {'tag': 'd2p', 'qs': ['D2P Pharma', 'D2P grossiste'], 'nom': r'\bD2P\b', 'ctx': r'pharma|r[eé]partit|grossiste'},
    {'tag': 'drapier', 'qs': ['Medisca grossiste', 'Alvernia pharmacie'],
     'nom': r'\bMedisca\b|\bAlvernia\b', 'ctx': r'Couchey|Dijon|Bourgogne|C[ôo]te-d.Or|Auvergne|Cournon|Clermont|Drapier|r[eé]partit|grossiste'},
    {'tag': 'aredis', 'qs': ['Aredis ANSM', 'Distrinep'], 'nom': r'\bAredis\b|Distrinep',
     'alt': r'(sanctionne|inflige|amende).{0,40}deux grossistes'},
    {'tag': 'cophana', 'qs': ['Cophana'], 'nom': r'\bCophana\b', 'brand': True},
    {'tag': 'welcoop', 'qs': ['Welcoop', 'Welcoop coopérative pharmacie'], 'nom': r'\bWelcoop\b', 'brand': True},
    {'tag': 'giphar', 'qs': ['Giphar', 'Giphar officine'], 'nom': r'\bGiphar\b', 'brand': True},
    {'tag': 'sagitta', 'qs': ['Sagitta Pharma', 'Groupe Sterne pharmacie', 'Sirona Group Sagitta'],
     'nom': r'\bSagitta\b|Access Direct', 'brand': True},
    {'tag': 'alliance', 'qs': ['Alliance Healthcare logistique', 'Alliance Healthcare France'], 'nom': r'Alliance Healthcare', 'brand': True},
    {'tag': 'ocp', 'qs': ['Phoenix Pharma France', 'OCP répartiteur'], 'nom': r'Phoenix (OCP|Pharma)|\bOCP\b',
     'ctx': r'pharmac|r[eé]partit|grossiste|France|OCP'},
    # ── indépendants qui ont de la presse (DOSSIER-WEB du 14/10) ──
    {'tag': 'medi-live', 'qs': ['Medi-Live', 'Medi-Live ANSM grossiste'], 'nom': r'Medi[- ]Live',
     'alt': r'(sanctionne|inflige|amende).{0,40}deux grossistes'},
    {'tag': 'sirona-pharma', 'qs': ['Sirona-Pharma redressement judiciaire', 'Sirona-Pharma Segré'],
     'nom': r'Sirona[- ]Pharma'},
    {'tag': 'atlantique-repartition', 'qs': ['Atlantique Répartition', 'Atlantique Répartition Sterne'],
     'nom': r'Atlantique R[eé]partition', 'ctx': r'pharmac|Bretagne|Ploufragan|CERP|Sterne|Finist|Morbihan|Loire|Saint-Brieuc'},
    {'tag': 'pharmar', 'qs': ['Pharmar Ploufragan', 'Pharmar répartiteur'], 'nom': r'\bPharmar\b',
     'ctx': r'Ploufragan|Bretagne|CERP|Odillard|Hurault|r[eé]partit|grossiste'},
    {'tag': 'active-repartition', 'qs': ['Active Répartition pharmacie', 'Active Répartition grossiste'],
     'nom': r'Active R[eé]partition', 'ctx': r'pharmac|grossiste|FIDA|Delannoy|Lamarche|r[eé]partiteur'},
    {'tag': 'lispharma', 'qs': ['LIS Pharma', 'Francilienne Pharmaceutique'],
     'nom': r'LIS Pharma|Francilienne Pharmaceutique|Therelys', 'ctx': r'r[eé]partit|grossiste|Neuilly|pharmac|Francilienne|Therelys'},
    {'tag': 'straight', 'qs': ['Straight ZLZ grossiste', 'Straight Zemmar'], 'nom': r'\bStraight\b',
     'ctx': r'ZLZ|Zemmar|grossiste|r[eé]partiteur'},
    {'tag': 'ubipharm', 'qs': ['UbiPharm', 'UbiPharm Afrique pharmacie'], 'nom': r'Ubi\s?Pharm', 'brand': True},
    {'tag': 'sun-medical', 'qs': ['Sun Médical Luisant', 'Sun Medical pharmacie Chartres'],
     'nom': r'Sun M[eé]dical', 'ctx': r'Luisant|Chartres|Eure-et-Loir|pharmac|r[eé]partit'},
    {'tag': 'ambapharm', 'qs': ['Ambapharm'], 'nom': r'Ambapharm', 'brand': True},
    {'tag': 'mhgc', 'qs': ['MHGC Group', 'MHGC Puzo'], 'nom': r'\bMHGC\b|Puzo', 'ctx': r'Puzo|FFDP|grossiste|r[eé]partit|pharmac'},
    {'tag': 'aravis-repartition', 'qs': ['Aravis Répartition pharmacie'], 'nom': r'Aravis R[eé]partition'},
    {'tag': 'kalliste-pharma', 'qs': ['Kalliste Pharma'], 'nom': r'Kalliste', 'brand': True},
    {'tag': 'corsicapharm', 'qs': ['Corsicapharm'], 'nom': r'Corsicapharm', 'brand': True},
    {'tag': 'cophac', 'qs': ['Cophac Corse', 'Cophac pharmacie'], 'nom': r'\bCophac\b', 'brand': True},
    {'tag': 'pharmafit-provence', 'qs': ['Pharmafit Provence'], 'nom': r'Pharmafit', 'brand': True},
    {'tag': 'pharma-distribution', 'qs': ['Pharma Distribution Corse', 'Pharma Distribution Cipolli'], 'nom': r'Pharma Distribution',
     'ctx': r'Cipolli|r[eé]partit|grossiste|Corse|pharmac'},
    {'tag': 'unipharma-nc', 'qs': ['Unipharma Nouvelle-Calédonie', 'Unipharma Leroux'], 'nom': r'Unipharma',
     'ctx': r'Cal[eé]donie|Noum[eé]a|Leroux|r[eé]partit|grossiste'},
    {'tag': 'laborex', 'qs': ['Laborex', 'Laborex CFAO Healthcare'], 'nom': r'Laborex', 'brand': True},
    {'tag': 'alfa-pharma', 'qs': ['Alfa Pharma répartiteur'], 'nom': r'Alfa Pharma', 'ctx': r'r[eé]partit|grossiste|pharmac'},
    {'tag': 'clicpharma', 'qs': ['Clic Pharma grossiste'], 'nom': r'Clic Pharma', 'ctx': r'grossiste|r[eé]partit|pharmac'},
    {'tag': 'r3s', 'qs': ['Pharmasmile', 'R3S Pharmasmile'], 'nom': r'Pharmasmile|\bR3S\b', 'ctx': r'Pharmasmile|pharmac|r[eé]partit'},
]
for _a in ACTEURS:
    _a['nom_rx'] = re.compile(_a['nom'], re.I)
    _a['alt_rx'] = re.compile(_a['alt'], re.I) if _a.get('alt') else None
    _a['ctx_rx'] = re.compile(_a['ctx'], re.I) if _a.get('ctx') else None
PAUSE = 1.0   # secondes entre deux requêtes Google News du lot élargi (politesse, évite le blocage)


def passe_filtre(row, acteur):
    """Les trois portes anti-homonymes. Le titre seul fait foi (le résumé Google répète le titre)."""
    txt = row['titre'] + ' ' + row.get('resume', '')
    m = acteur['nom_rx'].search(txt)
    if not m and not (acteur.get('alt_rx') is not None and acteur['alt_rx'].search(txt)):
        return False
    if EXCLUS.search(txt):
        return False
    reste = acteur['nom_rx'].sub(' ', txt)          # le nom lui-même ne compte pas comme mot du métier
    if not METIER.search(reste) and not (acteur.get('brand') and m):
        return False
    if acteur['ctx_rx'] is not None and not acteur['ctx_rx'].search(txt):
        return False
    return True


def trop_vieux(row):
    return bool(row.get('date')) and row['date'][:10] < DATE_MINI


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/rss+xml,application/xml,text/xml,*/*'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()


def clean(s):
    s = html.unescape(s or '')
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def parse_date(s):
    s = (s or '').strip()
    for fmt in ('%a, %d %b %Y %H:%M:%S %Z', '%a, %d %b %Y %H:%M:%S %z', '%Y-%m-%dT%H:%M:%S%z'):
        try:
            d = datetime.strptime(s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            pass
    return None


def parse_feed(q):
    url = GNEWS % urllib.parse.quote(q['q'])
    try:
        raw = fetch(url)
    except Exception as e:
        sys.stderr.write('FAIL %s : %s\n' % (q['q'], e))
        return []
    i = raw.find(b'<?xml')
    if i < 0:
        i = raw.find(b'<rss')
    if i > 0:
        raw = raw[i:]
    try:
        root = ET.fromstring(raw)
    except Exception as e:
        sys.stderr.write('XML FAIL %s : %s\n' % (q['q'], e))
        return []
    out = []
    for it in root.iter('item'):
        titre = clean(it.findtext('title') or '')
        link = clean(it.findtext('link') or '')
        if not titre or not link:
            continue
        # Google News met "Titre - Source" : on isole la source
        src = ''
        src_el = it.find('source')
        if src_el is not None and src_el.text:
            src = clean(src_el.text)
        if src and titre.endswith(' - ' + src):
            titre = titre[:-(len(src) + 3)].strip()
        elif ' - ' in titre:
            parts = titre.rsplit(' - ', 1)
            if len(parts[1]) < 40:
                titre, src = parts[0].strip(), parts[1].strip()
        if not KW.search(titre + ' ' + q['q']):
            continue
        d = parse_date(it.findtext('pubDate') or '')
        resume = clean(it.findtext('description') or '')
        resume = re.sub(r'\s*<.*$', '', resume)          # Google News liste des articles liés -> on coupe
        if len(resume) > 240:
            resume = resume[:240].rsplit(' ', 1)[0] + '…'
        src = src or 'Google News'
        out.append({
            'titre': titre, 'url': link, 'source': src,
            'date': (d.astimezone(timezone.utc).isoformat() if d else ''),
            'tag': q['tag'], 'resume': resume, 'libre': not bool(PAYWALL.search(src)),
        })
        if len(out) >= 25:
            break
    return out


def parse_direct(feed):
    """Flux RSS direct gratuit (texte complet) -> items avec résumé, libre=True."""
    try:
        raw = fetch(feed['url'])
    except Exception as e:
        sys.stderr.write('FAIL direct %s : %s\n' % (feed['url'], e)); return []
    i = raw.find(b'<?xml')
    if i < 0:
        i = raw.find(b'<rss')
    if i > 0:
        raw = raw[i:]
    try:
        root = ET.fromstring(raw)
    except Exception as e:
        sys.stderr.write('XML FAIL direct %s : %s\n' % (feed['url'], e)); return []
    out = []
    for it in root.iter('item'):
        titre = clean(it.findtext('title') or ''); link = clean(it.findtext('link') or '')
        if not titre or not link or not KW.search(titre + ' ' + (it.findtext('description') or '')):
            continue
        resume = clean(it.findtext('description') or '')
        if len(resume) > 240:
            resume = resume[:240].rsplit(' ', 1)[0] + '…'
        d = parse_date(it.findtext('pubDate') or it.findtext('{http://purl.org/dc/elements/1.1/}date') or '')
        out.append({'titre': titre, 'url': link, 'source': feed['src'],
                    'date': (d.astimezone(timezone.utc).isoformat() if d else ''),
                    'tag': '', 'resume': resume, 'libre': feed.get('libre', True)})
        if len(out) >= 15:
            break
    return out


def parse_bodacc(suivi):
    """Annonces BODACC d'une société suivie -> items (hors dépôts de comptes)."""
    siren = suivi['siren']
    espace = '%s %s %s' % (siren[:3], siren[3:6], siren[6:])
    url = BODACC % urllib.parse.quote('registre like "%%%s%%"' % espace)
    try:
        rows = json.loads(fetch(url)).get('results', [])
    except Exception as e:
        sys.stderr.write('FAIL bodacc %s : %s\n' % (siren, e)); return []
    out = []
    for r in rows:
        # le filtre "like" peut attraper un autre numéro : on revérifie le SIREN exact
        if siren not in str(r.get('registre') or ''):
            continue
        if r.get('familleavis') == 'dpc':
            continue
        # plus de 2 ans : de l'histoire, pas de l'actualité (Aredis et RBP en ont depuis 2017)
        if (r.get('dateparution') or '') < (datetime.now(timezone.utc).date() - timedelta(days=730)).isoformat():
            continue
        detail = ''
        try:
            detail = (json.loads(r.get('modificationsgenerales') or '{}') or {}).get('descriptif') or ''
        except Exception:
            pass
        titre = '%s — %s (annonce officielle)' % (suivi['nom'], r.get('familleavis_lib') or 'Annonce')
        d = r.get('dateparution') or ''
        out.append({'titre': titre, 'url': r.get('url_complete') or 'https://www.bodacc.fr/',
                    'source': 'BODACC', 'date': (d + 'T08:00:00+00:00') if d else '',
                    'tag': suivi['tag'], 'resume': clean(detail)[:240], 'libre': True})
    return out



# ── 15/10/2026 — BODACC pour TOUTES les fiches concurrentes qui ont un SIREN ─────────────────
# Will (15/10) : donner de l'actualité aux fiches qui n'en ont aucune. Le registre officiel publie
# les changements de dirigeants, cessions, procédures collectives, créations et dépôts de comptes,
# par SIREN. Le tag de chaque article est « bodacc-<id de la fiche> » : il n'apparaît QUE dans la fiche
# visée (les tags habituels sont partagés : « sagitta » ou « cerp » iraient dans trois fiches).
# La liste des fiches est lue dans crm/v2/grossistes-data.js (lecture seule), donc une fiche nouvelle
# est suivie dès qu'elle a un SIREN ; elle n'affiche rien tant que son tag bodacc-<id> n'est pas dans tags_actu.
# Filtre SIREN EXACT côté serveur (registre="123456789") : « like %123 456 789% » ramassait des sociétés
# sans rapport (100+ faux résultats pour Aravis, mesuré le 15/10).
# Licence : jeu ouvert de la DILA ; le robots.txt du portail interdit /api/ aux robots génériques
# (gabarit Opendatasoft), usage ici = ~90 requêtes/jour, pauses, User-Agent identifié. Tranché par Will le 15/10/2026 : interface gardée (accès officiel décrit par l’État).
DATA_FICHES = os.path.join(ROOT, 'crm', 'v2', 'grossistes-data.js')
BODACC_SRC = 'BODACC (annonce légale)'
BODACC_API = os.environ.get('JARVIS_BODACC_API') or 'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records'
BODACC_MAX = 3            # annonces gardées par fiche (les plus récentes, hors dépôts de comptes)
BODACC_COMPTES_MAX = 1    # un dépôt de comptes (le dernier) seulement s'il reste de la place sous le plafond
BODACC_PAUSE = 0.7
UA_BODACC = 'JARVIS-veille/1.0 (veille registre officiel, ~90 requetes/jour)'
NOUS_IDS = ('sr-pharma', 'nord-repartition', 'pharmest')


def fiches_concurrentes():
    """[(id, nom, siren)] des fiches concurrentes (repartiteur != false, hors « nous ») ayant un SIREN."""
    try:
        txt = open(DATA_FICHES, encoding='utf-8').read()
        d = json.loads(txt[txt.index('window.GROSSISTES_DATA=') + len('window.GROSSISTES_DATA='):].rstrip().rstrip(';'))
        out = []
        for g in d['grossistes']:
            if g.get('repartiteur') is False or g['id'] in NOUS_IDS or g.get('groupe_id') == 'integral' or g['id'].startswith('ip-'):
                continue
            s = re.sub(r'\D', '', str(g.get('societe_siren') or (g.get('financials') or {}).get('siren') or ''))
            if len(s) == 9:
                out.append((g['id'], g.get('nom_aff') or g['id'], s))
        return out
    except Exception as e:
        sys.stderr.write('BODACC : liste des fiches illisible (%s) - articles BODACC précédents conservés\n' % e)
        return []


def _j(x):
    try:
        return json.loads(x) if isinstance(x, str) and x.strip() else {}
    except Exception:
        return {}


def _fr(d):
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', d or '')
    return '%s/%s/%s' % (m.group(3), m.group(2), m.group(1)) if m else (d or '')


def bodacc_texte(r, siren, nom):
    """(titre, résumé) en français clair, sans donnée personnelle. Libellés des procédures = ceux du jugement."""
    fam = r.get('familleavis')
    rect = {'rectificatif': 'Rectificatif - ', 'annulation': 'Annulation - '}.get(r.get('typeavis'), '')
    ville = (r.get('ville') or '').strip().title()
    lieu = ' (%s)' % ville if ville else ''
    if fam == 'collective':
        j = _j(r.get('jugement'))
        nature = (j.get('nature') or j.get('famille') or 'procédure collective').strip()
        titre = 'Procédure collective publiée au BODACC'
        res = '%s%s%s. Jugement du %s%s.' % (nom, lieu, ' : ' + nature[0].lower() + nature[1:] if nature else '', _fr(j.get('date')), ' (tribunal : %s)' % r['tribunal'] if r.get('tribunal') else '')
        return rect + titre, res.replace(' (tribunal : None)', '')
    if fam == 'vente':
        prec = [re.sub(r'\D', '', x) for x in re.findall(r'"numeroIdentification":\s*"([^"]+)"', r.get('listeprecedentproprietaire') or '')]
        role = 'cède' if siren in prec else 'reprend'
        titre = 'Cession de fonds de commerce publiée au BODACC'
        cat = (_j(r.get('acte')).get('vente') or {}).get('categorieVente') or ''
        return rect + titre, '%s%s %s un fonds de commerce%s.' % (nom, lieu, role, (' (' + cat[0].lower() + cat[1:] + ')') if cat else '')
    if fam == 'creation':
        return rect + 'Immatriculation publiée au BODACC', '%s%s : immatriculation au registre du commerce%s.' % (nom, lieu, (' le ' + _fr(_j(r.get('acte')).get('dateImmatriculation'))) if _j(r.get('acte')).get('dateImmatriculation') else '')
    if fam == 'radiation':
        return rect + 'Radiation publiée au BODACC', '%s%s : radiation du registre du commerce.' % (nom, lieu)
    if fam == 'dpc':
        cl = _j(r.get('depot')).get('dateCloture')
        return rect + 'Dépôt des comptes annuels publié au BODACC', '%s%s a déposé ses comptes%s.' % (nom, lieu, (' de l\'exercice clos le ' + _fr(cl)) if cl else '')
    if fam == 'modification':
        desc = (_j(r.get('modificationsgenerales')).get('descriptif') or '').lower()
        parts = []
        if 'administration' in desc or 'représentant permanent' in desc:
            parts.append('direction')
        if 'siège' in desc:
            parts.append('adresse du siège')
        if 'capital' in desc:
            parts.append('capital')
        if 'activité' in desc and 'mise en activité' not in desc:
            parts.append('activité')
        if 'mise en activité' in desc:
            parts.append('mise en activité')
        if parts == ['direction']:
            titre = 'Changement dans la direction publié au BODACC'
            res = '%s%s : modification de l\'administration (dirigeants, gérance ou représentant). Le nom n\'est pas dans l\'annonce, voir le lien.' % (nom, lieu)
        elif parts:
            titre = 'Modification publiée au BODACC : ' + ', '.join(parts)
            res = '%s%s : modification portant sur %s.' % (nom, lieu, ', '.join(parts))
        else:
            titre = 'Modification publiée au BODACC'
            res = '%s%s : %s' % (nom, lieu, clean(desc).capitalize() or 'modification du registre.')
        return rect + titre, res
    return rect + 'Annonce publiée au BODACC', '%s%s : %s.' % (nom, lieu, r.get('familleavis_lib') or 'annonce légale')


def bodacc_fiche(fid, nom, siren):
    """Annonces d'une fiche -> items (jusqu'à BODACC_MAX). Lève une exception si le registre est injoignable ou illisible."""
    q = BODACC_API + '?' + urllib.parse.urlencode({'where': 'registre="%s" and dateparution >= date\'%s\'' % (siren, DATE_MINI),
                                                     'order_by': 'dateparution desc', 'limit': 100})
    req = urllib.request.Request(q, headers={'User-Agent': UA_BODACC})
    with urllib.request.urlopen(req, timeout=45) as r:
        d = json.loads(r.read())
    rows = d['results']                       # KeyError si la réponse n'a pas la forme attendue = échec, pas "zéro annonce"
    if not isinstance(rows, list):
        raise ValueError('results illisible')
    vus, norm, comptes = set(), [], []
    for r in rows:
        if siren not in [re.sub(r'\D', '', str(x)) for x in (r.get('registre') or [])]:
            continue
        if not r.get('id') or r['id'] in vus or (r.get('dateparution') or '') < DATE_MINI:
            continue
        vus.add(r['id'])
        titre, res = bodacc_texte(r, siren, nom)
        it = {'titre': titre, 'url': r.get('url_complete') or 'https://www.bodacc.fr/',
              'source': BODACC_SRC, 'date': r['dateparution'] + 'T08:00:00+00:00',
              'tag': 'bodacc-' + fid, 'resume': res[:240], 'libre': True}
        (comptes if r.get('familleavis') == 'dpc' else norm).append(it)
    norm.sort(key=lambda x: x['date'], reverse=True)
    comptes.sort(key=lambda x: x['date'], reverse=True)
    pris = norm[:BODACC_MAX]
    if len(pris) < BODACC_MAX:
        pris += comptes[:min(BODACC_COMPTES_MAX, BODACC_MAX - len(pris))]
    return pris


def collecte_bodacc(precedents):
    """Items BODACC de toutes les fiches. Fiche en échec -> ses articles du passage précédent sont GARDÉS (jamais vidés)."""
    fiches = fiches_concurrentes()
    if not fiches:
        return list(precedents), {'fiches': 0, 'echecs': 0, 'gardes': len(precedents)}
    out, echecs = [], []
    for fid, nom, siren in fiches:
        time.sleep(BODACC_PAUSE)
        try:
            out += bodacc_fiche(fid, nom, siren)
        except Exception as e:
            sys.stderr.write('FAIL bodacc-fiche %s (%s) : %s\n' % (fid, siren, e))
            echecs.append('bodacc-' + fid)
    gardes = [p for p in precedents if p.get('tag') in echecs]
    for p in gardes:
        if not trop_vieux(p):
            out.append(p)
    if echecs:
        sys.stderr.write('BODACC : %d fiche(s) en échec sur %d, %d article(s) du passage précédent conservés\n' % (len(echecs), len(fiches), len(gardes)))
    return out, {'fiches': len(fiches), 'echecs': len(echecs), 'gardes': len(gardes)}


# ── 15/10/2026 soir — CIBLAGE : Will, mot pour mot : « dans les actus je veux que du ciblage sur les grossistes,
# là y a trop d'infos pas intéressantes ». Le fil gardait tout (ruptures de produits, prévention, génériques,
# groupements, comptes déposés…) : 142 articles sur 325 ne parlaient d'aucun grossiste. On ne SUPPRIME rien
# (le résumé du matin, generate_brief.py, lit les angles génériques/marge dans ce même fichier) : chaque article
# reçoit un champ « cible » que l'onglet Concurrents lit :
#   'fil'   = sujet = un grossiste-répartiteur ou la répartition → onglet « Actualité » ET fiche du grossiste ;
#   'fiche' = annonce légale de routine (comptes déposés, direction sans nom, adresse) → fiche seulement ;
#   ''      = hors sujet grossiste → ni l'un ni l'autre (reste lisible par le résumé du matin).
REPART = re.compile(r'r[ée]partit|grossiste|\bCSRP\b|vente directe', re.I)
# Un article sur un grossiste doit parler de son MÉTIER ou d'un événement de l'entreprise (lu dans le titre).
EVENEMENT = re.compile(r'r[ée]partit|grossiste|entrep[ôo]t|logisti|livr|\bsites?\b|investi|projet d.ampleur|implant|s.installe|ouvr|'
                       r'rach[èe]t|rachat|cession|c[èe]de|fusion|acqui|reprise|repren|croissance externe|capital|filiale|'
                       r'redressement|liquidation|sauvegarde|faillite|sanction|amende|condamn|\bANSM\b|DGCCRF|concurrence|'
                       r'nomm|nomination|directeur|directrice|pr[ée]sident|\bP?DG\b|fermeture|ferme\b|emploi|licenci|salari|'
                       r'gr[èe]ve|plan social|\bPSE\b|r[ée]sultats|chiffre d|e-commerce|vente en ligne|fourni|contingent|quota', re.I)
# Bruit déjà vu le 15/10 sous un tag de grossiste : filiales africaines, projets informatiques, fait divers.
BRUIT = re.compile(r'\baccident|percut|\bERP\b|\bSAP\b|S/4|\bcloud\b|Tchad|Guin[ée]e\b|Cameroun|S[ée]n[ée]gal|'
                   r'C[ôo]te d.Ivoire|Maroc|Gabon|Afrique|\b\d+ ans\b|installation officinale', re.I)
ETRANGER = re.compile(r'Le Desk|Telquel|Le360|M[ée]dias ?24|Hespress|L.[ÉE]conomiste|Tchadinfos|Guineematin|\.ma$|\.tn$|\.sn$', re.I)
BODACC_FIL = re.compile(r'proc[ée]dure collective|redressement|liquidation|sauvegarde|cession|fonds de commerce|'
                        r'immatriculation|cr[ée]ation|radiation|dissolution|fusion|absorption|mise en activit', re.I)


def noms_par_tag():
    """tag -> regex du nom du grossiste (NOMS + ACTEURS) : un article tagué doit nommer son grossiste."""
    out = {}
    for tag, rx in NOMS:
        out.setdefault(tag, []).append(rx)
    for a in ACTEURS:
        out.setdefault(a['tag'], []).append(a['nom_rx'])
    return out


def tags_grossistes():
    """Tous les tags_actu des fiches de grossistes (grossistes-data.js). Vide si illisible."""
    try:
        txt = open(DATA_FICHES, encoding='utf-8').read()
        d = json.loads(txt[txt.index('window.GROSSISTES_DATA=') + len('window.GROSSISTES_DATA='):].rstrip().rstrip(';'))
        return {t for g in d['grossistes'] if g.get('repartiteur') is not False for t in (g.get('tags_actu') or [])}
    except Exception as e:
        sys.stderr.write('CIBLAGE : liste des fiches illisible (%s)\n' % e)
        return set()


def cible(row, tags, noms):
    titre, txt = row.get('titre', ''), row.get('titre', '') + ' ' + row.get('resume', '')
    if (row.get('source') or '').startswith('BODACC'):
        return 'fil' if BODACC_FIL.search(txt) else 'fiche'
    if BRUIT.search(titre) or ETRANGER.search(row.get('source') or ''):
        return ''
    tag = row.get('tag') or ''
    if tag in tags:
        nomme = any(rx.search(txt) for rx in noms.get(tag, [])) or bool(REPART.search(titre))
        return 'fil' if nomme and EVENEMENT.search(titre) else ''
    return 'fil' if REPART.search(titre) else ''


def main():
    sortie = OUT
    if '--sortie' in sys.argv:                 # essai hors dépôt : python3 generate_grossistes_actu.py --sortie /chemin.json
        sortie = os.path.abspath(sys.argv[sys.argv.index('--sortie') + 1])
    try:
        precedents = [i for i in json.load(open(sortie, encoding='utf-8')).get('items', []) if i.get('source') == BODACC_SRC]
    except Exception:
        precedents = []
    seen, items = {}, []
    for feed in FEEDS:                 # flux directs gratuits d'abord (accès libre prioritaire)
        for row in parse_direct(feed):
            if row['url'] not in seen:
                seen[row['url']] = row; items.append(row)
    for suivi in BODACC_SUIVIS:
        for row in parse_bodacc(suivi):
            if row['url'] not in seen:
                seen[row['url']] = row; items.append(row)
    for q in QUERIES:
        for row in parse_feed(q):
            k = row['url']
            if k in seen:
                # même article croisé par 2 requêtes : garde le tag grossiste s'il en apparaît un
                if not seen[k].get('tag') and row.get('tag'):
                    seen[k]['tag'] = row['tag']
                continue
            seen[k] = row
            items.append(row)
    for row in items:
        if not row.get('tag'):
            row['tag'] = tag_par_nom(row)
    # 15/10/2026 — lot élargi : une fiche = ses requêtes, filtrées par les trois portes anti-homonymes.
    for a in ACTEURS:
        for qtxt in a['qs']:
            time.sleep(PAUSE)
            for row in parse_feed({'tag': a['tag'], 'q': qtxt}):
                if not passe_filtre(row, a) or trop_vieux(row):
                    continue
                k = row['url']
                if k in seen:
                    if not seen[k].get('tag'):
                        seen[k]['tag'] = a['tag']
                    continue
                seen[k] = row
                items.append(row)
    # Plus rien d'avant le 01/10/2025 (les articles sans date restent : le contrôle ne condamne pas).
    items = [r for r in items if not trop_vieux(r)]
    items = [r for r in items if not (r.get('tag') in ('cerp', 'cerp-ba') and EXCLUS.search(r['titre']))]
    # « Cerp Bretagne Atlantique » ramassé par une requête « cerp » portait le tag du CERP de Rouen.
    for r in items:
        if r.get('tag') == 'cerp' and re.search(r'Bretagne|Ploufragan|Brieuc|C[ôo]tes-d.Armor|Pharmar', r['titre'], re.I):
            r['tag'] = 'cerp-ba'
    # tri par date décroissante (sans date -> en bas)
    items.sort(key=lambda x: x.get('date') or '', reverse=True)
    items = items[:300]                # était 120 : les fiches élargies en ajoutent ~100 de plus
    # BODACC par fiche : plafond PROPRE (3 par fiche), hors du plafond de 300 pour ne jamais être poussé dehors.
    bod, bod_info = collecte_bodacc(precedents)
    # Deux fiches peuvent partager un SIREN (ocp/phoenix) : la clé de dédoublonnage est url + tag.
    # Une annonce déjà apportée par la liste historique BODACC_SUIVIS (même url) n'est pas redoublée.
    urls_suivis = {r['url'] for r in items if r.get('source') == 'BODACC'}
    for b in bod:
        cle = b['url'] + '#' + b['tag']
        if b['url'] not in urls_suivis and cle not in seen and not trop_vieux(b):
            seen[cle] = b
            items.append(b)
    items.sort(key=lambda x: x.get('date') or '', reverse=True)
    tags, noms = tags_grossistes(), noms_par_tag()
    for r in items:
        r['cible'] = cible(r, tags, noms) if tags else 'fil'      # liste des fiches illisible : on n'écarte rien
    data = {
        'maj': datetime.now(timezone.utc).isoformat(),
        'n': len(items),
        'bodacc': bod_info,
        'items': items,
        'note': 'Actualités agrégées via Google News RSS (secteur répartition pharmaceutique + grossistes). Gratuit, sans clé.',
    }
    with open(sortie, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print('OK %d actualités grossistes -> %s' % (len(items), sortie))


if __name__ == '__main__':
    main()

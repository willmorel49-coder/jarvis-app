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


def main():
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
    # tri par date décroissante (sans date -> en bas)
    items.sort(key=lambda x: x.get('date') or '', reverse=True)
    items = items[:120]
    data = {
        'maj': datetime.now(timezone.utc).isoformat(),
        'n': len(items),
        'items': items,
        'note': 'Actualités agrégées via Google News RSS (secteur répartition pharmaceutique + grossistes). Gratuit, sans clé.',
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print('OK %d actualités grossistes -> %s' % (len(items), OUT))


if __name__ == '__main__':
    main()

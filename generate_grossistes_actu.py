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
from datetime import datetime, timezone

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
    {'tag': 'ocp', 'q': '"OCP" répartition pharmaceutique'},
    {'tag': 'cerp-rouen', 'q': '"CERP Rouen" OR Astera pharmacie'},
    {'tag': 'cerp-rrm', 'q': '"CERP RRM" pharmacie'},
    {'tag': 'alliance', 'q': '"Alliance Healthcare" France pharmacie'},
    {'tag': 'phoenix', 'q': '"Phoenix Pharma" France répartition'},
    {'tag': 'sagitta', 'q': 'Sagitta répartiteur pharmacie'},
    {'tag': 'cophana', 'q': 'Cophana grossiste pharmacie'},
    {'tag': 'welcoop', 'q': 'Welcoop pharmacie répartition'},
    {'tag': 'giphar', 'q': 'Giphar répartition pharmacie'},
    {'tag': '', 'q': 'short-liner grossiste pharmacie'},
]

# Filtre pertinence : au moins un mot du secteur (évite le bruit "alliance"/"phoenix" hors pharma).
KW = re.compile(r'pharmac|r[eé]partit|grossiste|officine|CERP|OCP|Alliance Healthcare|Phoenix Pharma|Giphar|Sagitta|Cophana|Welcoop|Astera|Alphega|labo|m[eé]dicament|g[eé]n[eé]rique|approvisionn|rupture', re.I)

# Flux RSS DIRECTS gratuits (texte complet accessible) — priorité "accès libre".
FEEDS = [
    {'src': 'FSPF', 'url': 'https://www.fspf.fr/feed/', 'libre': True},
    {'src': 'ANSM · Actualités', 'url': 'https://ansm.sante.fr/rss/actualites?produitsSante=medicaments', 'libre': True},
    {'src': 'ANSM · Disponibilité', 'url': 'https://ansm.sante.fr/rss/disponibilite_produits_sante?produitsSante=medicaments', 'libre': True},
]
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
                    'tag': '', 'resume': resume, 'libre': True})
        if len(out) >= 15:
            break
    return out


def main():
    seen, items = {}, []
    for feed in FEEDS:                 # flux directs gratuits d'abord (accès libre prioritaire)
        for row in parse_direct(feed):
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

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Veille « Infos du matin » — robot quotidien GRATUIT (tourne dans GitHub Actions).
Agrège des flux RSS publics officiels/pro et écrit crm/v2/infos-jour.json.
Aucune clé API, aucune dépendance (stdlib only). L'app CRM lit le JSON (même origine).

Sources :
  - ANSM disponibilité (ruptures/tensions MITM)  -> cat "ruptures" (+ DCI entre crochets)
  - ANSM actualités médicaments                  -> cat "reglementaire"
  - ANSM informations de sécurité médicaments     -> cat "securite"
  - Le Moniteur des pharmacies (RSS)              -> cat "profession"
"""
import urllib.request, json, re, os, sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'crm', 'v2', 'infos-jour.json')

FEEDS = [
    {'cat': 'ruptures',      'source': 'ANSM · Disponibilité', 'url': 'https://ansm.sante.fr/rss/disponibilite_produits_sante?produitsSante=medicaments', 'max': 12},
    {'cat': 'securite',      'source': 'ANSM · Sécurité',      'url': 'https://ansm.sante.fr/rss/informations_securite?produitsSante=medicaments', 'max': 5},
    {'cat': 'reglementaire', 'source': 'ANSM · Actualités',    'url': 'https://ansm.sante.fr/rss/actualites?produitsSante=medicaments', 'max': 5},
    {'cat': 'profession',    'source': 'Le Moniteur des pharmacies', 'url': 'https://www.lemoniteurdespharmacies.fr/feed/', 'max': 6},
]
UA = 'Mozilla/5.0 (compatible; JARVIS-veille/1.0; +integralpharma)'


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    return urllib.request.urlopen(req, timeout=20).read()


def clean(s):
    s = re.sub(r'<[^>]+>', '', s or '')          # retire le HTML éventuel
    s = (s.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
           .replace('&#39;', "'").replace('&rsquo;', "'").replace('&nbsp;', ' ')
           .replace('&quot;', '"').replace('&laquo;', '«').replace('&raquo;', '»'))
    return re.sub(r'\s+', ' ', s).strip()


def parse_date(s):
    s = (s or '').strip()
    for fmt in ('%a, %d %b %Y %H:%M:%S %z', '%a, %d %b %Y %H:%M:%S %Z', '%Y-%m-%dT%H:%M:%S%z'):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            pass
    return None


def dci_of(title):
    # ANSM met la DCI entre crochets en fin de titre : "... – [héparine calcique]"
    m = re.findall(r'\[([^\]]+)\]', title or '')
    return clean(m[-1]).lower() if m else ''


def items_from(feed):
    out = []
    try:
        raw = fetch(feed['url'])
    except Exception as e:
        sys.stderr.write('FAIL %s : %s\n' % (feed['url'], e))
        return out
    try:
        root = ET.fromstring(raw)
    except Exception as e:
        sys.stderr.write('XML FAIL %s : %s\n' % (feed['url'], e))
        return out
    for it in root.iter('item'):
        t = it.findtext('title') or ''
        link = it.findtext('link') or ''
        pub = it.findtext('pubDate') or it.findtext('{http://purl.org/dc/elements/1.1/}date') or ''
        d = parse_date(pub)
        titre = clean(t)
        if not titre:
            continue
        row = {
            'cat': feed['cat'], 'source': feed['source'],
            'titre': titre, 'url': clean(link),
            'date': (d.astimezone(timezone.utc).isoformat() if d else ''),
        }
        if feed['cat'] == 'ruptures':
            dci = dci_of(t)
            if dci:
                row['dci'] = dci
                row['titre'] = re.sub(r'\s*[–-]\s*\[[^\]]+\]\s*$', '', titre).strip()  # libellé sans la DCI
        out.append(row)
        if len(out) >= feed['max']:
            break
    return out


def main():
    items = []
    for f in FEEDS:
        items += items_from(f)
    # tri : ruptures d'abord, puis par date décroissante
    order = {'ruptures': 0, 'securite': 1, 'reglementaire': 2, 'profession': 3}
    items.sort(key=lambda r: (order.get(r['cat'], 9), r['date'] == '', _neg(r['date'])))
    payload = {
        'day': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'count': len(items),
        'sources': [f['source'] for f in FEEDS],
        'items': items,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(',', ':'))
    n_rupt = sum(1 for i in items if i['cat'] == 'ruptures')
    print('OK %d infos (%d ruptures) -> %s' % (len(items), n_rupt, OUT))


def _neg(iso):
    # pour trier par date décroissante en clé ascendante
    return '' if not iso else ''.join(str(255 - ord(c)) for c in iso[:19])


if __name__ == '__main__':
    main()

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
import urllib.request, json, re, os, sys, html
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, date, timedelta

WINDOW_DAYS = 7   # on garde la semaine glissante

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'crm', 'v2', 'infos-jour.json')

FEEDS = [
    {'cat': 'ruptures',      'source': 'ANSM · Disponibilité', 'url': 'https://ansm.sante.fr/rss/disponibilite_produits_sante?produitsSante=medicaments', 'max': 40},
    {'cat': 'securite',      'source': 'ANSM · Sécurité',      'url': 'https://ansm.sante.fr/rss/informations_securite?produitsSante=medicaments', 'max': 20},
    {'cat': 'reglementaire', 'source': 'ANSM · Actualités',    'url': 'https://ansm.sante.fr/rss/actualites?produitsSante=medicaments', 'max': 20},
    {'cat': 'profession',    'source': 'Le Quotidien du Pharmacien', 'url': 'https://www.lequotidiendupharmacien.fr/rss.xml', 'max': 35, 'filter': True},
    {'cat': 'profession',    'source': 'Le Moniteur des pharmacies', 'url': 'https://www.lemoniteurdespharmacies.fr/feed/', 'max': 25, 'filter': True},
    {'cat': 'profession',    'source': 'FSPF',                 'url': 'https://www.fspf.fr/feed/', 'max': 10, 'filter': True},
    {'cat': 'profession',    'source': 'Le Pharmacien de France', 'url': 'https://www.lepharmaciendefrance.fr/feed', 'max': 10, 'filter': True},
    {'cat': 'reglementaire', 'source': 'Le Quotidien du Médecin', 'url': 'https://www.lequotidiendumedecin.fr/rss.xml', 'max': 18, 'filter': True},
    {'cat': 'reglementaire', 'source': 'Leem',                 'url': 'https://www.leem.org/rss.xml', 'max': 8, 'filter': True},
    {'cat': 'profession',    'source': 'Egora',                'url': 'https://www.egora.fr/rss.xml', 'max': 8, 'filter': True},
]

# Pertinence "cœur de métier officine" : on ne garde de la presse pro que ce qui touche
# directement le comptoir, la distribution et l'économie de l'officine.
REL = re.compile(
    r'pharmac|officin|comptoir|g[ée]n[ée]riqu|substitu|biosimil|rupture|tension|approvision|'
    r'rembours|\bprix\b|honorair|convention|avenant|rosp|tarif|nomenclature|marge|grossist|'
    r'r[ée]partit|d[ée]livr|ordonnance|s[ée]rialis|vaccin|trod|d[ée]pist|entretien|bilan partag|'
    r'\bpda\b|lfss|ameli|cnam|ceps|m[ée]dicament|p[ée]nurie|missions?|garde', re.I)
def relevant(txt):
    return bool(REL.search(txt or ''))
UA = 'Mozilla/5.0 (compatible; JARVIS-veille/1.0; +integralpharma)'


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    return urllib.request.urlopen(req, timeout=20).read()


def clean(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')          # retire le HTML éventuel
    s = html.unescape(s)                           # décode toutes les entités (&#8217; &rsquo; …)
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
        # résumé : description, sinon content:encoded
        desc = it.findtext('description') or ''
        if not desc:
            enc = it.find('{http://purl.org/rss/1.0/modules/content/}encoded')
            desc = enc.text if (enc is not None and enc.text) else ''
        desc = clean(desc)
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
            m = re.search(r'Statut\s*:\s*(.+?)\s*-\s*A partir', desc)        # ex "Tension d'approvisionnement"
            if m: row['statut'] = m.group(1).strip()
            md = re.search(r'A partir du\s*([0-9/]{8,10})', desc)
            if md: row['depuis'] = md.group(1)
        else:
            r = re.sub(r'^Ce que vous allez apprendre\s*:?\s*', '', desc)    # préfixe template Le Moniteur
            if re.match(r'^(Publié|Mis à jour|Statut)\b', r):                 # métadonnées ANSM seules = pas un résumé
                r = ''
            if len(r) > 320:
                r = r[:320].rsplit(' ', 1)[0] + '…'
            row['resume'] = r
        # filtre pertinence officine pour la presse pro
        if feed.get('filter') and not relevant(titre + ' ' + (row.get('resume') or '')):
            continue
        out.append(row)
        if len(out) >= feed['max']:
            break
    return out


def keyof(it):
    return (it.get('url') or '').strip() or (it.get('source', '') + '|' + it.get('titre', ''))


def daystr(it, today):
    # jour de référence de l'item : sa date de publication sinon le jour où on l'a vu
    return (it.get('date') or '')[:10] or it.get('seen') or today


def main():
    today = date.today().isoformat()
    cutoff = (date.today() - timedelta(days=WINDOW_DAYS - 1)).isoformat()

    # 1) reprendre l'existant (accumulation semaine glissante)
    merged = {}
    try:
        old = json.load(open(OUT, encoding='utf-8'))
        for it in old.get('items', []):
            merged[keyof(it)] = it
    except Exception:
        pass

    # 2) fusionner les nouveautés (garde la 1ère date de découverte = "seen")
    fresh = 0
    for f in FEEDS:
        for it in items_from(f):
            k = keyof(it)
            if k in merged:
                it['seen'] = merged[k].get('seen') or daystr(merged[k], today)
            else:
                it['seen'] = (it.get('date') or '')[:10] or today
                fresh += 1
            merged[k] = it

    # 3) fenêtre 7 jours + drapeau "aujourd'hui"
    items = []
    for it in merged.values():
        d = daystr(it, today)
        if d < cutoff:
            continue
        it['day'] = d
        it['today'] = (d == today)
        items.append(it)

    # 4) tri : aujourd'hui d'abord, puis catégorie, puis date décroissante
    order = {'ruptures': 0, 'securite': 1, 'reglementaire': 2, 'profession': 3}
    items.sort(key=lambda r: (0 if r['today'] else 1, order.get(r['cat'], 9), _neg(r.get('date') or r['day'])))

    payload = {
        'day': today,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'window_days': WINDOW_DAYS,
        'count': len(items),
        'count_today': sum(1 for i in items if i['today']),
        'sources': [f['source'] for f in FEEDS],
        'items': items,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(',', ':'))
    n_rupt = sum(1 for i in items if i['cat'] == 'ruptures')
    print('OK %d infos sur %dj (%d aujourd\'hui, %d ruptures, %d nouvelles) -> %s'
          % (len(items), WINDOW_DAYS, payload['count_today'], n_rupt, fresh, OUT))


def _neg(iso):
    # tri par date décroissante via clé ascendante
    return '' if not iso else ''.join(str(255 - ord(c)) for c in iso[:19])


if __name__ == '__main__':
    main()

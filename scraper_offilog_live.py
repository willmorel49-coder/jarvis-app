#!/usr/bin/env python3
"""
Scraper Offilog — catalogue complet
Connexion : ***RETIRE*** / ***RETIRE***
Pagination via bouton "suivant" (pas le total déclaré, souvent absent)
Output    : offilog_live.json  +  offilog_live.xlsx  +  opso/offilog-live-data.js
"""
import re
import sys
import json
import time
import openpyxl
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime
from collections import Counter

BASE      = Path(__file__).parent
OUT_JSON  = BASE / 'offilog_live.json'
OUT_EXCEL = BASE / 'offilog_live.xlsx'
OUT_JS    = BASE / 'opso' / 'offilog-live-data.js'

LOGIN_URL = 'https://offilog.fr/connexion?back=my-account'
EMAIL     = '***RETIRE***
PASSWORD  = '***RETIRE***'

PER_PAGE  = 100
DELAY     = 0.35

# Toutes les catégories du nav Offilog (43 au total, inclut parents + feuilles)
# Les parents agrègent leurs sous-catégories → les doublons sont dédupliqués par id_product
CATEGORIES = [
    # ── Médicaments & OTC ─────────────────
    ('https://offilog.fr/1983-sante',              'Santé'),
    ('https://offilog.fr/1987-inconfort',           'Inconfort'),
    ('https://offilog.fr/2014-sexualite',           'Sexualité'),
    ('https://offilog.fr/2005-premiers-soins',      'Premiers soins'),
    ('https://offilog.fr/2073-allergies',           'Allergies'),
    ('https://offilog.fr/2076-complements-alimentaires', 'Compléments alimentaires'),
    ('https://offilog.fr/2169-aide-minceur',        'Aide Minceur'),
    ('https://offilog.fr/2077-sport',               'Sport'),
    ('https://offilog.fr/2163-materiel-medical',    'Matériel médical'),
    ('https://offilog.fr/2164-vision-et-yeux',      'Vision & Yeux'),
    ('https://offilog.fr/2196-anti-moustiques-et-insecticides', 'Anti-moustiques'),
    # ── Beauté & Soins ────────────────────
    ('https://offilog.fr/2079-beaute-et-soins',    'Beauté & Soins'),
    ('https://offilog.fr/2080-soins-du-visage',     'Soins du visage'),
    ('https://offilog.fr/2081-soins-du-corps',      'Soins du corps'),
    ('https://offilog.fr/2082-soins-des-cheveux',   'Capillaire'),
    ('https://offilog.fr/2083-maquillage',          'Maquillage'),
    ('https://offilog.fr/2084-parfums-eaux-de-toilette', 'Parfums'),
    ('https://offilog.fr/2085-soins-pour-hommes',   'Soin pour Homme'),
    # ── Hygiène ───────────────────────────
    ('https://offilog.fr/1943-hygiene',             'Hygiène'),
    ('https://offilog.fr/1951-hygiene-bucco-dentaire', 'Hygiène bucco-dentaire'),
    ('https://offilog.fr/1965-hygiene-intime',      'Hygiène intime'),
    ('https://offilog.fr/1947-douches-bains',       'Douches & Bains'),
    ('https://offilog.fr/1944-deodorants-anti-transpirants', 'Déodorants'),
    ('https://offilog.fr/2151-soins-des-oreilles-et-des-yeux', 'Soins Oreilles & Nez'),
    ('https://offilog.fr/2072-epilation-rasage',    'Épilation & Rasage'),
    # ── Bébé ──────────────────────────────
    ('https://offilog.fr/1778-bebe',               'Bébé'),
    ('https://offilog.fr/1807-grossesse-maternite', 'Grossesse & Maternité'),
    ('https://offilog.fr/1801-alimentation-bebe',   'Alimentation Bébé'),
    ('https://offilog.fr/2170-puericulture',        'Puériculture'),
    ('https://offilog.fr/1787-soins-du-bebe',       'Soins du Bébé'),
    ('https://offilog.fr/2171-changes-de-bebe',     'Changes de bébés'),
    # ── Vétérinaire ───────────────────────
    ('https://offilog.fr/2059-veterinaire',         'Vétérinaire'),
    ('https://offilog.fr/2062-complements-alimentaires-pour-animaux', 'Compléments animaux'),
    ('https://offilog.fr/2060-soins-hygiene-animale', 'Soins animaux'),
    # ── Solaire ───────────────────────────
    ('https://offilog.fr/2120-solaires',            'Solaire'),
    ('https://offilog.fr/2158-adulte',              'Solaire adulte'),
    ('https://offilog.fr/2159-enfant',              'Solaire enfant'),
    ('https://offilog.fr/2160-apres-soleil',        'Après-soleil'),
    ('https://offilog.fr/2161-preparations-et-entretien', 'Solaire préparation'),
    ('https://offilog.fr/2162-autobronzants',       'Auto-bronzants'),
    # ── Coffrets & Cadeaux ────────────────
    ('https://offilog.fr/2168-cadeaux',             'Coffrets & Cadeaux'),
    ('https://offilog.fr/2172-cadeaux-noel',        'Cadeaux Noël'),
    ('https://offilog.fr/2173-coffrets-laboratoire','Coffrets Laboratoires'),
    # ── Spéciaux ──────────────────────────
    ('https://offilog.fr/promotions',               'Promotions'),
    ('https://offilog.fr/nouveaux-produits',        'Nouveautés'),
]


def make_session():
    s = requests.Session()
    s.headers.update({'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    )})
    r = s.post(LOGIN_URL, data={
        'back': 'my-account', 'email': EMAIL,
        'password': PASSWORD, 'submitLogin': '1'
    }, timeout=20)
    if 'Déconnexion' not in r.text and 'mon-compte' not in r.url:
        print('ERREUR : login échoué')
        sys.exit(1)
    print(f'  ✓ Connecté : {EMAIL}')
    return s


def parse_price(text):
    if not text:
        return None
    text = text.strip().replace('\xa0', '').replace(' ', '').replace(' ', '').replace(',', '.').replace('€', '')
    try:
        return round(float(text), 4)
    except ValueError:
        return None


def has_next_page(soup):
    """Détecte s'il y a une page suivante dans la pagination."""
    # Bouton rel=next
    if soup.find('a', rel='next'):
        return True
    # Lien classe next
    nxt = soup.select_one('.pagination .next a, li.next a, a.next-page')
    if nxt:
        return True
    # Aria-label "Page suivante"
    if soup.find('a', {'aria-label': re.compile('suivant|next', re.I)}):
        return True
    return False


def scrape_page(s, url):
    """Retourne (produits, has_next)."""
    time.sleep(DELAY)
    try:
        r = s.get(url, timeout=25)
    except Exception as e:
        print(f'    ERREUR {url}: {e}')
        return [], False

    soup = BeautifulSoup(r.text, 'html.parser')
    articles = soup.find_all('article', class_='js-product-miniature')
    nxt = has_next_page(soup)

    products = []
    for art in articles:
        prod_id = art.get('data-id-product', '')

        name_a   = art.find('a', class_='product_name')
        nom      = name_a.get_text(strip=True) if name_a else ''
        prod_url = name_a['href'] if name_a and name_a.get('href') else ''

        ean = ''
        m = re.search(r'-(\d{8,13})\.html', prod_url)
        if m:
            ean = m.group(1)

        marque_el = art.find(class_='manufacturer')
        marque = marque_el.get_text(strip=True) if marque_el else ''

        prix_el = art.find(itemprop='price') or art.find(class_='price')
        prix = parse_price(prix_el.get_text()) if prix_el else None

        prix_barre_el = art.find(class_='regular-price') or art.find(class_='old-price')
        prix_barre = parse_price(prix_barre_el.get_text()) if prix_barre_el else None

        img_el = art.find('img')
        img_url = img_el.get('data-src') or img_el.get('src', '') if img_el else ''

        flags = [f.get_text(strip=True) for f in art.find_all(class_='product-flag')]

        products.append({
            'id_product': prod_id,
            'nom': nom,
            'marque': marque,
            'ean': ean,
            'prix': prix,
            'prix_barre': prix_barre,
            'en_promo': prix_barre is not None and prix_barre > 0,
            'flags': ','.join(flags),
            'url': prod_url,
            'img': img_url,
        })

    return products, nxt


def scrape_category(s, cat_url, cat_label, seen_ids):
    """Scrape toutes les pages via bouton suivant. Retourne les nouveaux produits."""
    new_prods = []
    page = 1

    while True:
        url = f'{cat_url}?resultsPerPage={PER_PAGE}&page={page}'
        prods, nxt = scrape_page(s, url)

        if not prods:
            break

        added = 0
        for prod in prods:
            prod['categorie'] = cat_label
            pid = prod['id_product']
            if pid and pid not in seen_ids:
                seen_ids.add(pid)
                new_prods.append(prod)
                added += 1
            elif not pid:
                new_prods.append(prod)
                added += 1

        if page == 1:
            print(f'    {len(prods)} produits p1 | +{added} nouveaux', flush=True)
        else:
            print(f'    p{page} +{added}', flush=True)

        if not nxt:
            break
        page += 1

    return new_prods


def generate_js(products, meta):
    """Génère opso/offilog-live-data.js."""
    lines = []
    for p in products:
        nom_e  = (p.get('nom','') or '').replace('\\','\\\\').replace("'","\\'").replace('\n',' ')
        marque = (p.get('marque','') or '').replace("'","\\'")
        cat    = (p.get('categorie','') or '').replace("'","\\'")
        ean    = str(p.get('ean','') or '')
        url    = (p.get('url','') or '').replace("'","\\'")
        img    = (p.get('img','') or '').replace("'","\\'")
        prix   = p.get('prix') or 0
        prix_b = p.get('prix_barre') or 'null'
        promo  = 'true' if p.get('en_promo') else 'false'
        pid    = str(p.get('id_product',''))
        lines.append(
            f"  {{id:'{pid}',nom:'{nom_e}',marque:'{marque}',cat:'{cat}',"
            f"ean:'{ean}',prix:{prix},prix_barre:{prix_b},promo:{promo},"
            f"url:'{url}',img:'{img}'}}"
        )

    content = (
        f"// Catalogue Offilog live — {meta['generated'][:10]}\n"
        f"// {meta['count']} produits · {meta['source']} · {meta['compte']}\n"
        f"const OFFILOG_LIVE = [\n"
        + ",\n".join(lines)
        + "\n];\n"
    )
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write(content)
    size_kb = len(content) // 1024
    print(f'JS  → {OUT_JS} ({size_kb} KB)')


def main():
    t0 = time.time()
    print('=' * 60)
    print('SCRAPER OFFILOG LIVE — Catalogue complet')
    print(f'Démarré le {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'{len(CATEGORIES)} catégories à scraper')
    print('=' * 60)

    s = make_session()

    all_products = []
    seen_ids     = set()

    for i, (cat_url, cat_label) in enumerate(CATEGORIES, 1):
        print(f'\n[{i}/{len(CATEGORIES)}] {cat_label}', flush=True)
        prods = scrape_category(s, cat_url, cat_label, seen_ids)
        all_products.extend(prods)
        print(f'  → +{len(prods)} · total : {len(all_products)}', flush=True)

    elapsed = int(time.time() - t0)
    print(f'\n{"="*60}')
    print(f'TOTAL : {len(all_products)} produits uniques — {elapsed//60}m{elapsed%60:02d}s')

    meta = {
        'generated': datetime.now().isoformat(),
        'source': 'offilog.fr',
        'compte': EMAIL,
        'count': len(all_products),
    }

    # JSON
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump({'meta': meta, 'products': all_products}, f, ensure_ascii=False, indent=2)
    print(f'JSON → {OUT_JSON}')

    # Excel
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Offilog Live'
    headers = ['id_product','nom','marque','ean','prix','prix_barre','en_promo','flags','categorie','url','img']
    ws.append(headers)
    for prod in all_products:
        ws.append([prod.get(h,'') for h in headers])
    wb.save(OUT_EXCEL)
    print(f'Excel → {OUT_EXCEL}')

    # JS pour l'app OPSO
    generate_js(all_products, meta)

    # Stats
    cats = Counter(p['categorie'] for p in all_products)
    print('\nTop catégories :')
    for cat, n in cats.most_common(20):
        print(f'  {cat:<42} {n:>5}')
    avec_ean  = sum(1 for p in all_products if p['ean'])
    avec_prix = sum(1 for p in all_products if p['prix'])
    print(f'\nAvec EAN  : {avec_ean}/{len(all_products)}')
    print(f'Avec prix : {avec_prix}/{len(all_products)}')
    print(f'Durée     : {elapsed//60}m{elapsed%60:02d}s')


if __name__ == '__main__':
    main()

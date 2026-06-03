#!/usr/bin/env python3
"""
Scraper E.Leclerc — prix parapharmacie via API batch EAN
Stratégie : requêtes directes à l'API stores/products-details-by-skus
Input  : offilog_live.json (8 394 EANs)
Output : leclerc_prices.json  +  opso/leclerc-data.js
"""
import json, time, requests
from pathlib import Path
from datetime import datetime
from collections import defaultdict

BASE     = Path(__file__).parent
IN_JSON  = BASE / 'offilog_live.json'
OUT_JSON = BASE / 'leclerc_prices.json'
OUT_JS   = BASE / 'opso' / 'leclerc-data.js'

STORE    = '0100-0000'
API_URL  = f'https://www.e.leclerc/api/rest/live-api/stores/{STORE}/products-details-by-skus'
BATCH    = 20
DELAY    = 0.4

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'fr-FR,fr;q=0.9',
    'Referer': 'https://www.e.leclerc/cat/parapharmacie',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
}

def fetch_batch(session, eans):
    params = [('skus', e) for e in eans]
    try:
        r = session.get(API_URL, params=params, timeout=20)
        if r.status_code == 200:
            return r.json()
        print(f'  Status {r.status_code}')
        return []
    except Exception as e:
        print(f'  ERREUR: {e}')
        return []

def extract_price(prod):
    for v in prod.get('variants', []):
        offers = v.get('offers', [])
        ean = next((a['value'] for a in v.get('attributes', []) if a['code'] == 'ean'), '')
        if offers:
            price = offers[0]['basePrice']['price']['price'] / 100
            # Check promo
            promo_price = None
            for o in offers:
                for af in o.get('additionalFields', []):
                    if af.get('code') == 'strikethrough-price':
                        promo_price = af.get('value')
            stock = offers[0].get('stock', 0)
            return {
                'ean': ean or prod.get('sku', ''),
                'nom': prod.get('label', ''),
                'prix': round(price, 2),
                'prix_barre': round(float(promo_price) / 100, 2) if promo_price else None,
                'promo': promo_price is not None,
                'stock': stock,
                'url': f'/fp/{ean}' if ean else '',
            }
    return None

def main():
    t0 = time.time()
    print('=' * 60)
    print('SCRAPER E.LECLERC — Prix parapharmacie par EAN')
    print(f'Démarré le {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 60)

    # Charger EANs Offilog
    with open(IN_JSON, encoding='utf-8') as f:
        data = json.load(f)
    products = data['products']
    eans = list(dict.fromkeys(p['ean'] for p in products if p.get('ean') and len(str(p['ean'])) >= 8))
    print(f'{len(eans)} EANs uniques à vérifier')

    # Requêtes par batch
    session = requests.Session()
    session.headers.update(HEADERS)

    results = {}  # ean → {nom, prix, ...}
    total_batches = (len(eans) + BATCH - 1) // BATCH

    for i in range(0, len(eans), BATCH):
        batch = eans[i:i + BATCH]
        batch_num = i // BATCH + 1
        prods = fetch_batch(session, batch)

        for prod in prods:
            info = extract_price(prod)
            if info and info['prix'] > 0:
                results[info['ean']] = info

        found = len([p for p in prods if p.get('variants')])
        time.sleep(DELAY)

        if batch_num % 20 == 0 or batch_num == total_batches:
            print(f'  Batch {batch_num}/{total_batches} — {len(results)} prix trouvés', flush=True)

    elapsed = int(time.time() - t0)
    print(f'\nTotal : {len(results)} prix E.Leclerc trouvés — {elapsed//60}m{elapsed%60:02d}s')

    # JSON
    meta = {
        'generated': datetime.now().isoformat(),
        'source': 'e.leclerc',
        'store': STORE,
        'count': len(results),
    }
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump({'meta': meta, 'prices': results}, f, ensure_ascii=False, indent=2)
    print(f'JSON → {OUT_JSON}')

    # JS
    def esc(s):
        return (s or '').replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ')

    lines = []
    for ean, p in results.items():
        lines.append(
            f"{{ean:'{esc(ean)}',nom:'{esc(p['nom'])}',prix:{p['prix']},"
            f"prix_b:{p['prix_barre'] or 'null'},promo:{'true' if p['promo'] else 'false'},"
            f"stock:{p['stock']},url:'{esc(p['url'])}'}}"
        )

    content = (
        f"// Prix E.Leclerc parapharmacie — {meta['generated'][:10]}\n"
        f"// {meta['count']} produits matchés EAN\n"
        f"const LECLERC_PRICES = [\n"
        + ',\n'.join(lines)
        + '\n];\n'
    )
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write(content)
    size_kb = len(content) // 1024
    print(f'JS  → {OUT_JS} ({size_kb} KB)')
    print(f'Durée : {elapsed//60}m{elapsed%60:02d}s')

if __name__ == '__main__':
    main()

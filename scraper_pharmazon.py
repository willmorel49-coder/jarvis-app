#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scraper PROPRE de pharmazon.fr (prix publics TTC + EAN).
- Source : sitemap officiel (robots.txt -> /pub/media/sitemap/sitemap.xml)
- Vrai navigateur (Playwright Chrome) : passe Cloudflare comme un visiteur normal.
  On NE contourne PAS de protection : navigation standard, rythme poli.
- Sortie incrémentale, reprenable : pharmazon_scrape.jsonl (1 produit/ligne).
- Champs : url, ean, name, brand, price, price_old, image, rayon.

Usage :
  python3 scraper_pharmazon.py            # run complet (sitemap entier)
  python3 scraper_pharmazon.py 30         # test : 30 premières URLs
"""
import asyncio, json, os, re, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "pharmazon_scrape.jsonl")
SITEMAP = "https://www.pharmazon.fr/pub/media/sitemap/sitemap.xml"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Safari/605.1.15")
CONCURRENCY = 5
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0

EXTRACT = r"""
() => {
  const q = (s,a) => { const e=document.querySelector(s); if(!e) return null; return (a? e.getAttribute(a): e.textContent||'').trim(); };
  const form = document.querySelector('#product_addtocart_form');
  let ean = form ? form.getAttribute('data-product-sku') : null;
  if (!ean) { const m=(document.body.innerHTML.match(/"product_id"\s*:\s*"(\d{13})"/)); ean = m? m[1]: null; }
  const price = q("meta[property='product:price:amount']","content");
  if (!price) return null; // pas une fiche produit
  const bc = Array.from(document.querySelectorAll('.breadcrumbs .item, nav.breadcrumbs a, .breadcrumbs li'))
              .map(e=>e.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
  // prix barré éventuel
  let oldp = q("[data-price-type='oldPrice'] .price") || q(".old-price .price") || null;
  return {
    ean: ean,
    name: q("h1") || q("meta[property='og:title']","content") || document.title,
    brand: (bc.length>=3 ? bc[1] : ''),
    rayon: (bc.length>=4 ? bc.slice(1,-1).join(' / ') : (bc.length>=3 ? bc[1] : '')),
    price: price,
    price_old: oldp,
    image: q("meta[property='og:image']","content") || ''
  };
}
"""

def fnum(v):
    if not v: return None
    try: return round(float(re.sub(r"[^\d.,]", "", str(v)).replace(",", ".")), 2)
    except Exception: return None

async def fetch_sitemap(ctx):
    pg = await ctx.new_page()
    await pg.goto(SITEMAP, wait_until="domcontentloaded", timeout=45000)
    body = await pg.content()
    await pg.close()
    locs = re.findall(r"<loc>(.*?)</loc>", body)
    # garder les pages .html (produits + catégories ; on filtre au scrape via price meta)
    return [l for l in locs if l.endswith(".html")]

async def scrape_one(ctx, url, sem, results, lock, idx, total):
    async with sem:
        pg = await ctx.new_page()
        try:
            await pg.goto(url, wait_until="domcontentloaded", timeout=40000)
            await pg.wait_for_timeout(400)
            data = await pg.evaluate(EXTRACT)
            if data and data.get("ean") and data.get("price"):
                rec = {
                    "url": url,
                    "ean": re.sub(r"\D", "", data["ean"])[:13],
                    "name": (data.get("name") or "").strip()[:160],
                    "brand": (data.get("brand") or "").strip()[:60],
                    "rayon": (data.get("rayon") or "").strip()[:120],
                    "price": fnum(data.get("price")),
                    "price_old": fnum(data.get("price_old")),
                    "image": data.get("image") or "",
                }
                if rec["ean"] and len(rec["ean"]) == 13 and rec["price"]:
                    async with lock:
                        results["f"].write(json.dumps(rec, ensure_ascii=False) + "\n")
                        results["f"].flush()
                        results["n"] += 1
        except Exception as e:
            async with lock:
                results["err"] += 1
        finally:
            await pg.close()
        if idx % 100 == 0:
            print("  %d/%d · %d produits · %d erreurs" % (idx, total, results["n"], results["err"]), flush=True)

async def main():
    done = set()
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            for line in f:
                try: done.add(json.loads(line)["url"])
                except Exception: pass
        print("Reprise : %d produits déjà scrapés" % len(done))

    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True)
        ctx = await b.new_context(locale="fr-FR", user_agent=UA)
        urls = await fetch_sitemap(ctx)
        print("Sitemap : %d pages .html" % len(urls))
        urls = [u for u in urls if u not in done]
        if LIMIT: urls = urls[:LIMIT]
        print("À scraper : %d" % len(urls))

        results = {"f": open(OUT, "a", encoding="utf-8"), "n": 0, "err": 0}
        lock = asyncio.Lock()
        sem = asyncio.Semaphore(CONCURRENCY)
        total = len(urls)
        tasks = [scrape_one(ctx, u, sem, results, lock, i + 1, total) for i, u in enumerate(urls)]
        await asyncio.gather(*tasks)
        results["f"].close()
        print("\n✅ Terminé : %d nouveaux produits · %d erreurs · fichier %s"
              % (results["n"], results["err"], os.path.relpath(OUT, ROOT)))
        await b.close()

if __name__ == "__main__":
    asyncio.run(main())

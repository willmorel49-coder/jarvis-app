#!/bin/bash
# Pipeline images nocturne — attend tous les scrapers, consolide, regenere, push

cd /Users/williammorel/JARVIS/APP
LOG=/tmp/log_pipeline_images.txt
exec >> $LOG 2>&1

echo ""
echo "══════════════════════════════════════════════════"
echo "PIPELINE IMAGES — Démarré $(date)"
echo "══════════════════════════════════════════════════"

# ── Attendre fin du scraper bestsellers ──────────────────────
echo "[1/6] Attente scraper bestsellers..."
while pgrep -f "scraper_bestsellers_offilog" > /dev/null; do
    sleep 10
done
echo "  ✓ Bestsellers terminé — $(date)"

# ── Dédupliquer bestsellers ───────────────────────────────────
echo "[2/6] Déduplication bestsellers..."
python3 -c "
import json
with open('bestsellers_offilog.json') as f:
    data = json.load(f)
prods = data['products']
print(f'  Avant dédup : {len(prods)} produits')
seen = set()
unique = []
rang = 1
for p in prods:
    k = p['ean'] or p['nom']
    if k not in seen:
        seen.add(k)
        p['rang'] = rang
        unique.append(p)
        rang += 1
data['products'] = unique
data['meta']['count'] = len(unique)
data['meta']['note'] = 'Deduplique par EAN'
with open('bestsellers_offilog.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f'  Après dédup : {len(unique)} produits uniques')
avec_img = sum(1 for p in unique if p.get('img'))
print(f'  Avec image  : {avec_img}')
" && echo "  ✓ Bestsellers dédupliqué"

# ── Attendre fin Drakkars (peut durer ~90 min) ───────────────
echo "[3/6] Attente scraper Drakkars..."
while pgrep -f "scraper_images_drakkars" > /dev/null; do
    COUNT=$(python3 -c "import json; d=json.load(open('images_drakkars.json')); print(len(d))" 2>/dev/null || echo "?")
    echo "  ... Drakkars en cours : $COUNT images — $(date +%H:%M)"
    sleep 120
done
echo "  ✓ Drakkars terminé — $(date)"

# ── Attendre fin Cap3000 (~52 min) ───────────────────────────
echo "[4/6] Attente scraper Cap3000..."
while pgrep -f "scraper_images_cap3000" > /dev/null; do
    COUNT=$(python3 -c "import json; d=json.load(open('images_cap3000.json')); print(len(d))" 2>/dev/null || echo "?")
    echo "  ... Cap3000 en cours : $COUNT images — $(date +%H:%M)"
    sleep 120
done
echo "  ✓ Cap3000 terminé — $(date)"

# ── Consolider toutes les images ──────────────────────────────
echo "[5/6] Consolidation images..."
python3 consolidate_images.py && echo "  ✓ images_by_ean.json généré"

# ── Mettre à jour generate_offilog.py pour lire images_by_ean ─
echo "[6/6] Régénération offilog-data.js et best-sellers matchés..."
python3 generate_offilog.py && echo "  ✓ offilog-data.js régénéré"

# ── Git push ─────────────────────────────────────────────────
echo "[7/7] Commit et push..."
git add crm/offilog-data.js bestsellers_offilog.json images_by_ean.json
git add images_drakkars.json images_cap3000.json generate_offilog.py
git add scraper_images_drakkars.py scraper_images_cap3000.py consolidate_images.py scraper_bestsellers_offilog.py
git commit -m "data: Pipeline images nocturne — enrichissement photos catalogue Offilog

- bestsellers_offilog.json : tous les produits Offilog triés par ventes
- images_drakkars.json : images scrappées depuis pharmaciedesdrakkars.com
- images_cap3000.json : images scrappées depuis pharmacie-cap3000.com
- images_by_ean.json : lookup consolidé EAN→image (toutes sources)
- generate_offilog.py : utilise images_by_ean.json pour enrichissement max

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push && echo "  ✓ PUSH RÉUSSI — $(date)"

echo ""
echo "══════════════════════════════════════════════════"
echo "PIPELINE TERMINÉ — $(date)"
echo "══════════════════════════════════════════════════"

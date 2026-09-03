#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_bestsellers.py — LES LISTES À PROPOSER.

Deux publics, une seule matière : les ventes réelles du réseau.

  · PROSPECT — une officine qui ne nous achète rien encore. On n'a aucun historique
    sur elle : on lui montre ce que le réseau achète le plus, par catégorie.
  · CLIENTE  — l'écran Produits calcule déjà, officine par officine, ce que ses
    confrères prennent et qu'elle ne prend pas (v2-produits-moteur.js). Ce fichier
    lui sert de référentiel commun : le même classement, les mêmes catégories.

⚠️ RÉÉCRIT LE 03/09/2026. L'ancienne version lisait `crm/benchmark-data.js` — un
fichier de comparaison, pas les ventes — et n'écrivait même pas sa date de génération
(`generated:""`). Elle classait donc sur une matière qui n'était pas celle du réseau.

Sources, toutes datées à l'exécution :
  · crm/v2/prod-stats-data.js  — ventes réseau agrégées par produit (rotation, prix, CA)
  · crm/v2/stock-data.js       — stock plateforme du jour
  · STOCKS|STATS/*.xlsx        — la sous-famille « Froid » (absente de PROD_STATS)

⚠️ CE FICHIER EST PUBLIC. Il est chargé par `crm/v2/decouvrir.html`, la page de
prospection accessible SANS connexion (HTTP 200 vérifié le 03/09/2026). Il ne doit donc
porter AUCUNE condition commerciale chiffrée — ni abandon de marge, ni prix net négocié —
et aucune information stratégique comme le niveau de stock. Seuls sortent : le libellé, le
CIP, la rotation par officine, le nombre d'officines qui en prennent, et le PPHT, qui est
un prix public. Le stock sert à FILTRER (on ne propose pas l'indisponible), jamais à
s'afficher.

⚠️ RÈGLE : on ne propose JAMAIS un produit qu'on n'a pas en stock. Une liste qui fait
briller une référence indisponible fait perdre la vente ET la confiance. Les produits
sans stock connu sont sortis des listes et comptés à part.
"""
import re, json, os, datetime, glob

ROOT = os.path.dirname(os.path.abspath(__file__))
PS    = os.path.join(ROOT, 'crm', 'v2', 'prod-stats-data.js')
STOCK = os.path.join(ROOT, 'crm', 'v2', 'stock-data.js')
OUT   = os.path.join(ROOT, 'crm', 'v2', 'bestsellers-data.js')

# Catégories NON CHEVAUCHANTES, dans l'ordre de priorité : un produit ne paraît qu'une fois.
# Le froid passe devant tout : c'est la contrainte logistique qui décide de la commande.
CATS = [
    ('froid',       'Chaîne du froid'),
    ('biosim',      'Biosimilaires'),
    ('generiques',  'Génériques'),
    ('princeps',    'Princeps & spécialités'),
    ('nr',          'Non remboursable'),
]
FAM_VERS_CAT = {'biosim': 'biosim', 'gen': 'generiques', 'nr': 'nr',
                'pr_low': 'princeps', 'pr_mid': 'princeps', 'pr_high': 'princeps'}
PAR_CAT = 12


def lire_js(chemin, motif):
    t = open(chemin, encoding='utf-8', errors='ignore').read()
    m = re.search(motif, t, re.S)
    if not m:
        raise SystemExit(f'[bestsellers] rien à lire dans {os.path.basename(chemin)}')
    return json.loads(m.group(1))


def froid_par_cip():
    """La sous-famille « Froid » vit dans le fichier de stock, pas dans PROD_STATS.
    Chemin non figé : le plus récent, daté par son nom (même règle que generate_stock.py)."""
    import openpyxl
    cands = []
    for d in ('STOCKS', 'STATS'):
        for f in glob.glob(os.path.join(ROOT, d, '*.xlsx')):
            b = os.path.basename(f)
            if b.startswith('~$') or 'stock' not in b.lower():
                continue
            m = re.search(r'(\d{2})[ _-](\d{2})[ _-](\d{4})', b)
            if m:
                try:
                    cands.append((datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1))), f))
                except ValueError:
                    pass
    if not cands:
        print('[bestsellers] ⚠️ aucun fichier catalogue — la catégorie Froid sera vide')
        return {}, None
    cands.sort(key=lambda x: x[0])
    dt, f = cands[-1]
    ws = openpyxl.load_workbook(f, read_only=True, data_only=True).active
    it = ws.iter_rows(values_only=True)
    h = [str(x) for x in next(it)]
    ic = h.index('artcodebarre')
    isf = h.index('artsousfamille') if 'artsousfamille' in h else None
    out = {}
    for r in it:
        c = str(r[ic] or '').strip()
        if len(c) == 13 and c.isdigit() and isf is not None:
            sf = str(r[isf] or '')
            if 'froid' in sf.lower():
                out[c] = 1
    print(f'[bestsellers] catalogue : {os.path.basename(f)} ({dt}) · {len(out)} réfs en chaîne du froid')
    return out, dt.isoformat()


def main():
    prods = lire_js(PS, r'PROD_STATS\s*=\s*(\[.*\])\s*;?\s*$')
    stock = lire_js(STOCK, r'data:(\{.*?\})\s*\}\s*;?\s*$')
    mstk  = re.search(r'gen:"([\d-]+)"', open(STOCK, encoding='utf-8').read())
    date_stock = mstk.group(1) if mstk else None
    froid, date_cat = froid_par_cip()
    print(f'[bestsellers] {len(prods)} produits · stock du {date_stock} ({len(stock)} réfs)')

    buckets = {k: [] for k, _ in CATS}
    sans_stock = 0
    for p in prods:
        cip = str(p.get('c') or '')
        # ⚠️ jamais un produit qu'on n'a pas : une liste qui promet l'indisponible coûte la vente
        dispo = stock.get(cip)
        if not dispo or dispo <= 0:
            sans_stock += 1
            continue
        cat = 'froid' if cip in froid else FAM_VERS_CAT.get(p.get('f'))
        if not cat:
            continue
        buckets[cat].append({
            'd': p.get('d', ''), 'c': cip,
            'q': int(round(p.get('rota') or 0)),      # boîtes par pharmacie et par an
            'n': int(p.get('n') or 0),                # nombre d'officines qui en prennent
            'p': round(float(p.get('ppht') or 0), 2), # prix grossiste public (PPHT)
        })

    cats = []
    for k, lab in CATS:
        # Le classement est la DIFFUSION (combien d'officines en prennent), pas le volume brut :
        # un produit que 500 officines achètent est un meilleur argument qu'un gros volume
        # concentré sur trois clients. Départage par la rotation.
        lst = sorted(buckets[k], key=lambda x: (-x['n'], -x['q']))[:PAR_CAT]
        if lst:
            cats.append({'key': k, 'label': lab, 'rows': lst})
        print(f'[bestsellers]   {lab:24s} {len(buckets[k]):5d} candidats → {len(lst)} retenus')

    out = {
        'generated': str(datetime.date.today()),
        'source': 'ventes réseau (prod-stats) × stock plateforme',
        'date_stock': date_stock,
        'date_catalogue': date_cat,
        'n_produits': sum(len(c['rows']) for c in cats),
        'ecartes_sans_stock': sans_stock,
        'lecture': 'q = boîtes par pharmacie et par an · n = officines du réseau qui en prennent · '
                   'p = prix grossiste public (PPHT)',
        'cats': cats,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// Les listes à proposer — meilleures ventes réseau EN STOCK, par catégorie.\n')
        f.write('// Généré par generate_bestsellers.py. Ne pas éditer à la main.\n')
        f.write('window.BESTSELLERS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'[bestsellers] écrit : {OUT} ({os.path.getsize(OUT)/1024:.0f} Ko)')
    print(f'[bestsellers] {out["n_produits"]} produits retenus · '
          f'{sans_stock} écartés faute de stock connu')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

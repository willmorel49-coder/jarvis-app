#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_offilog_marche.py — Écran Offilog · bloc « Le marché ».

Le classement « meilleures ventes » d'Offilog est un classement de VENTES RÉELLES du réseau
de pharmacies clientes — pas un institut, pas la France entière. Relevé une fois par mois et
archivé daté, il donne trois choses qu'aucune autre source gratuite ne donne sur la
parapharmacie : le rang de vente d'un produit, le podium de son rayon, et son évolution.

⚠️ Offilog ne publie AUCUN volume, seulement un ordre. Donc jamais de pourcentage de part de
marché ici : un « 12 % » serait inventé. On affiche des rangs, des places et des écarts de rang.

Entrées (hors dépôt, archive append-only du robot ~/offilog-marche/) :
  releves/<AAAA-MM-JJ>.json  {source, date, items:[{id, nom, marque, ean, ...}]} — l'ORDRE = le rang
  top-marche.json            liste d'EAN repérés « top vente » sur un tarif laboratoire
                             (repère indépendant du classement Offilog ; le nom de la
                             plateforme ne sort JAMAIS dans un livrable)

Sortie : crm/v2/offilog-marche-data.js — rangs datés + repère top marché. Aucun prix : ce
dépôt est PUBLIC. Python 3.9, bibliothèque standard seule.
"""
import os
import re
import sys
import glob
import json
import datetime

ARCHIVE = os.path.expanduser('~/offilog-marche')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'crm', 'v2', 'offilog-marche-data.js')
MIN_PRODUITS = 3000   # un relevé plus court est un relevé raté, pas un marché qui s'effondre


def charger_releves():
    """Tous les relevés datés, du plus ancien au plus récent. {date: {ean: rang}}."""
    out = []
    for p in sorted(glob.glob(os.path.join(ARCHIVE, 'releves', '*.json'))):
        date = os.path.basename(p)[:-5]
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date):
            print('  ignoré (nom de fichier non daté) : %s' % os.path.basename(p))
            continue
        items = json.load(open(p, encoding='utf-8')).get('items') or []
        if len(items) < MIN_PRODUITS:
            print('  ignoré (relevé incomplet, %d produits) : %s' % (len(items), date))
            continue
        rangs = {}
        for i, it in enumerate(items):
            ean = str(it.get('ean') or '')
            if len(ean) >= 8 and ean not in rangs:   # 1er vu = meilleur rang
                rangs[ean] = i + 1
        out.append((date, rangs))
    return out


def main():
    releves = charger_releves()
    if not releves:
        sys.exit('aucun relevé exploitable dans %s/releves/' % ARCHIVE)
    dates = [d for d, _ in releves]
    print('relevés retenus : %s' % ', '.join(dates))

    top = json.load(open(os.path.join(ARCHIVE, 'top-marche.json'), encoding='utf-8'))
    top = list(top.keys()) if isinstance(top, dict) else list(top)

    # Un EAN vu dans N'IMPORTE QUEL relevé garde sa ligne : un produit qui sort du classement
    # est une information, pas une ligne à supprimer.
    eans = set()
    for _, r in releves:
        eans.update(r)
    rangs = {}
    for ean in sorted(eans):
        serie = [r.get(ean) for _, r in releves]
        rangs[ean] = serie

    dernier = releves[-1][1]
    cor = [t for t in top if t in dernier]
    entete = (
        '// Offilog — LE MARCHÉ : rang de vente daté de chaque produit + repère « top vente ».\n'
        '// %d produits · %d relevés (%s) — généré le %s par generate_offilog_marche.py\n'
        '// Le classement = les ventes réelles du réseau de pharmacies clientes d\'Offilog.\n'
        '// Ce n\'est PAS la France entière, et Offilog ne publie aucun volume : jamais de\n'
        '// pourcentage de part de marché ici, uniquement des rangs et des écarts de rang.\n'
        '// `rangs` : EAN -> un rang par relevé, dans l\'ordre de `releves`. null = absent ce mois-là.\n'
        '// `top` : repère indépendant relevé sur un tarif laboratoire (%d EAN, %d présents au dernier relevé).\n'
        '// Aucun prix : ce dépôt est PUBLIC.\n'
        % (len(dernier), len(releves), ' → '.join(dates),
           datetime.date.today().strftime('%d/%m/%Y'), len(top), len(cor))
    )
    data = {'maj': dates[-1], 'releves': dates, 'n': len(dernier), 'rangs': rangs, 'top': cor}
    js = entete + 'const OFFILOG_MARCHE = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    js += 'try{window.OFFILOG_MARCHE=OFFILOG_MARCHE;}catch(e){}\n'
    open(OUT, 'w', encoding='utf-8').write(js)

    # Relire ce qu'on vient d'écrire : un fichier annoncé n'est pas un fichier valide.
    relu = open(OUT, encoding='utf-8').read()
    obj, _ = json.JSONDecoder().raw_decode(relu[relu.index('{'):])
    assert obj['releves'] == dates and len(obj['rangs']) == len(rangs), 'relecture incohérente'
    bouge = [abs(s[-1] - s[-2]) for s in obj['rangs'].values()
             if len(s) >= 2 and s[-1] and s[-2]]
    bouge.sort()
    print('écrit %s — %d octets · %d EAN · %d top marché' % (OUT, len(relu.encode()), len(rangs), len(cor)))
    if bouge:
        print('mouvement depuis le relevé précédent : médiane %d rangs · %d produits de plus de 100 rangs'
              % (bouge[len(bouge) // 2], sum(1 for x in bouge if x > 100)))


if __name__ == '__main__':
    main()

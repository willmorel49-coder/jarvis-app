# -*- coding: utf-8 -*-
"""Pont des codes produit — « un produit = un code » (22/09/2026).

STATS/pont-codes.json est écrit par generate_etab_prices.py : code-barres ↔ CIP13 rapprochés
dans les relevés de stock, plus les fusions manuelles de fusions-codes.csv (accord de Will).
Toute table produit publiée se range sous le code GARDÉ ; quand seul l'ancien code est connu,
sa donnée passe au code gardé. Sans cette règle, une vente rangée sous le code gardé ne
retrouvait plus son nom, son PPHT ni son statut froid (mesuré : 68 codes, 3 540 ventes)."""
import json, os

_ROOT = os.path.dirname(os.path.abspath(__file__))
_PONT = os.path.join(_ROOT, 'STATS', 'pont-codes.json')
_alias = None


def charger():
    global _alias
    if os.path.exists(_PONT):
        with open(_PONT, encoding='utf-8') as fh:
            _alias = json.load(fh)['alias']
    else:
        _alias = {}
        print('  [pont] %s absent : aucun code déplacé' % _PONT)
    return _alias


def canon(code):
    """Le code gardé d'un code produit (lui-même s'il n'est pas dans le pont)."""
    if _alias is None:
        charger()
    c = str(code or '')
    return _alias.get(c, c)


def rekey(d):
    """{code: valeur} → {code gardé: valeur}. Le code gardé l'emporte quand il est déjà
    présent ; sinon la valeur de l'ancien code passe au code gardé."""
    out = {}
    for c, v in d.items():
        if canon(c) == str(c):
            out[str(c)] = v
    for c, v in d.items():
        k = canon(c)
        if k not in out:
            out[k] = v
    return out

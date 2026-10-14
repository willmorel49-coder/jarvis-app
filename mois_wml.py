# -*- coding: utf-8 -*-
"""Mois des tableurs de ventes (STATS/<CODE>_MM_AAAA.xlsx) : un seul endroit pour la règle des années.

Un mois lu est un couple (année, mois). Dans une ligne de vente compactée, le mois vaut
`mois_compacte(annee, mois)` : 1..12 = 2026, 13 = janvier 2027, 14 = février 2027…
Importé par generate_wml_v2.py et decouper_par_commercial.py (generate_wml_v2.py, lui, n'est pas importable).
"""
AN0 = 2026   # origine du compteur de mois, ne change jamais (13 = janvier 2027 pour toujours)


def mois_compacte(annee, mois):
    return (annee - AN0) * 12 + mois


def nom_tableur(prefix, annee, mois):
    return '%s_%02d_%d.xlsx' % (prefix, mois, annee)


def borne(annee, mois, abbr, avec_annee):
    return '%s %d' % (abbr[mois - 1], annee) if avec_annee else abbr[mois - 1]


def periode(mois_lus, abbr):
    """« Jan-Sep 2026 » ; sur deux années : « Déc 2026-Jan 2027 »."""
    (a0, m0), (a1, m1) = mois_lus[0], mois_lus[-1]
    if a0 == a1:
        return '%s-%s %d' % (abbr[m0 - 1], abbr[m1 - 1], a0)
    return '%s-%s' % (borne(a0, m0, abbr, True), borne(a1, m1, abbr, True))

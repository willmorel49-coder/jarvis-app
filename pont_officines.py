# -*- coding: utf-8 -*-
"""Pont des codes officine — « une pharmacie = une fiche » (Will, 05/10/2026).

Quand une officine est reprise par un nouveau titulaire, l'outil de gestion ouvre un compte
neuf sous le code CIP nu (2060117) et renomme l'ancien compte « EX2060117 » (ou « 2060117EX »).
C'est la MÊME pharmacie : ses ventes passées se rangent sous le code nu, et la fiche garde
l'identité du nouveau titulaire. Sans cette règle, le CRM montrait deux fiches et l'historique
restait accroché à une fiche fantôme, sans ville ni code postal.

Les marques OLD, IN et INBIS suivent la même règle (arbitré le 05/10/2026) : mesuré sur les
ventes, ce sont des comptes successifs de la même pharmacie — même nom, même commercial, les
mois de l'un s'arrêtent là où ceux de l'autre commencent."""
import re

_REPRISE = re.compile(r'^(?:EX\s*(\d{7})|(\d{7})\s*(?:EX|OLD|INBIS|IN))$', re.I)


def code_officine(code):
    """(code gardé, ancien) : ancien = True quand la ligne vient du compte d'avant la reprise."""
    c = str(code or '').strip()
    m = _REPRISE.match(c)
    if m:
        return m.group(1) or m.group(2), True
    return c, False

# -*- coding: utf-8 -*-
"""Pont des codes officine — « une pharmacie = une fiche » (Will, 05/10/2026).

Quand une officine est reprise par un nouveau titulaire, l'outil de gestion ouvre un compte
neuf sous le code CIP nu (2060117) et renomme l'ancien compte « EX2060117 » (ou « 2060117EX »).
C'est la MÊME pharmacie : ses ventes passées se rangent sous le code nu, et la fiche garde
l'identité du nouveau titulaire. Sans cette règle, le CRM montrait deux fiches et l'historique
restait accroché à une fiche fantôme, sans ville ni code postal.

Les marques OLD, IN et INBIS suivent la même règle (arbitré le 05/10/2026) : mesuré sur les
ventes, ce sont des comptes successifs de la même pharmacie — même nom, même commercial, les
mois de l'un s'arrêtent là où ceux de l'autre commencent.

Parfois le compte neuf reçoit un code CIP DIFFÉRENT : aucune marque ne relie alors les deux.
Ces cas se rangent à la main dans _COMPTE_NEUF, un par un, après accord de Will. On garde alors
le code de l'ANCIEN compte, parce que c'est lui que connaissent la base nationale et les infos
publiques (pharma-fr-data.js, officines-infos-data.js : adresse, téléphone, SIREN, point sur la
carte) — mais l'identité reste celle du compte neuf, comme pour une reprise « EX »."""
import re

_REPRISE = re.compile(r'^(?:EX\s*(\d{7})|(\d{7})\s*(?:EX|OLD|INBIS|IN))$', re.I)

# code du compte neuf → code gardé. Rochemaure (53 avenue du Teil, Pauline G.) : 2063584IN
# janv.–mai, 2063584 mai–juin, 2063584INBIS juillet, puis 2011419 depuis août (Will, 05/10/2026).
_COMPTE_NEUF = {
    '2011419': '2063584',
}
_CODES_GARDES = set(_COMPTE_NEUF.values())


def code_officine(code):
    """(code gardé, ancien) : ancien = True quand la ligne vient du compte d'avant la reprise."""
    c = str(code or '').strip()
    m = _REPRISE.match(c)
    ancien = bool(m)
    if m:
        c = m.group(1) or m.group(2)
    if c in _COMPTE_NEUF:
        return _COMPTE_NEUF[c], False
    if c in _CODES_GARDES:
        return c, True
    return c, ancien


def codes_comptes(code):
    """Les codes sous lesquels chercher une officine dans une table rangée par code :
    le compte neuf d'abord (son identité prime), puis le code gardé."""
    c = str(code or '').strip()
    return [n for n, g in _COMPTE_NEUF.items() if g == c] + [c]

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
archive_evenements.py — mémoire commune des événements détectés par les robots.

POURQUOI CE FICHIER EXISTE
--------------------------
Plusieurs robots détectent un événement daté puis **réécrivent entièrement** leur fichier
au passage suivant. Tant que la source garde l'historique, ce n'est pas grave. Ici les
sources sont des fenêtres glissantes :

  · DILA JORFSIMPLE (avis CEPS, `generate_prix_futurs.py`) = 40 tarballs, soit ~20 jours.
    Passé ce délai l'avis — CIP13 + PFHT + date d'effet — n'existe plus **nulle part**.
  · La BDPM (`generate_prix.py`) ne publie **aucun** historique de prix : c'est
    précisément pour ça que le robot garde son propre instantané.

Autrement dit : ce que ces robots voient un jour et ne notent pas est perdu pour toujours.
Même défaut que le journal ANSM, corrigé le 12/08/2026 (voir `generate_ansm_dispo.py`).

CE QUE FAIT `archiver()`
------------------------
Un fichier append-only, jamais purgé, jamais réécrit à la baisse. Un événement déjà connu
n'est pas retouché : sa date de première observation (`vu`) et ses données d'origine font
foi, même si la source renvoie moins d'informations plus tard.

Le fichier est écrit **à chaque passage, même sans nouvel événement** : `git add` échoue
en bloc si un chemin n'existe pas, et le commit part alors amputé sans rien signaler.
"""
import io
import os
import json


def charger(chemin):
    """Événements déjà archivés. Une archive illisible ne doit pas faire perdre la journée."""
    try:
        with io.open(chemin, "r", encoding="utf-8") as f:
            evs = json.load(f).get("evenements", [])
            return evs if isinstance(evs, list) else []
    except Exception:
        return []


def archiver(chemin, evenements, cle, aujourdhui, note=None):
    """Ajoute les événements encore inconnus. Rend (total, nouveaux).

    `cle(ev)` doit rendre un identifiant stable de l'événement. Un événement dont la clé
    contient un `None` est ignoré : sans identifiant fiable il créerait un doublon à
    chaque passage, ou pire, écraserait un voisin.
    """
    connus = charger(chemin)
    vus = set()
    for e in connus:
        try:
            k = cle(e)
        except Exception:
            continue
        if k is not None and None not in tuple(k):
            vus.add(tuple(k))

    n_avant = len(connus)
    for ev in evenements or []:
        try:
            k = cle(ev)
        except Exception:
            continue
        if k is None:
            continue
        k = tuple(k)
        if None in k or k in vus:
            continue          # inconnu de clé, ou déjà archivé → on ne touche à rien
        vus.add(k)
        ligne = dict(ev)
        ligne["vu"] = aujourdhui      # date de PREMIÈRE observation, figée
        connus.append(ligne)

    sortie = {"generated": aujourdhui,
              "note": note or "événements archivés une fois pour toutes (append-only, "
                              "jamais purgé) — la source est une fenêtre glissante",
              "n": len(connus),
              "evenements": connus}
    d = os.path.dirname(chemin)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    with io.open(chemin, "w", encoding="utf-8") as f:
        json.dump(sortie, f, ensure_ascii=False, separators=(",", ":"))
    return len(connus), len(connus) - n_avant

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jeu-essentiels.test.py — le jeu de ventes « ESSENTIELS » (decouper_par_commercial.py, jeu_essentiels, 27/11/2026).

Pourquoi ce test existe : Arthur Le Houerou, commercial RESTREINT, entre dans l'app Essentiels Pharma (Will, 27/11/2026).
Il y charge ce jeu, pas les fichiers complets. Trois choses ne doivent jamais se tromper :
  1. le PÉRIMÈTRE : les officines que GRP_DEPART range sous « Essentiels Pharma », rien d'autre — même règle que
     V2.perimetreParAlias (CIP sans zéros de tête, rapprochement par code puis id) ;
  2. le CONTENU : toutes les ventes de ces officines, quel que soit le commercial ; aucun total du reste du réseau,
     aucune « notre marge » par client (marge-clients.js) ;
  3. le DOSSIER : sha256('ESSENTIELS')[:16], celui que l'écran calcule (groupements/config/essentiels.js `jeuVentes`)
     et que la règle serveur ouvre aux comptes de jarvis_acces_essentiels().

Le test charge la VRAIE fonction du fichier livré. Toutes les données sont INVENTÉES.
"""
import hashlib
import json
import os
import re
import sys
import tempfile
import importlib.util

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RACINE)
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('decouper_par_commercial', os.path.join(RACINE, 'decouper_par_commercial.py'))
dc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dc)

ECHECS = []


def check(nom, cond, detail=""):
    if cond:
        print("  ok   %s" % nom)
    else:
        print("  ÉCHEC %s  %s" % (nom, detail))
        ECHECS.append(nom)


def lire_ventes(rep):
    t = open(os.path.join(rep, 'wml-ventes-01.js'), encoding='utf-8').read()
    return json.loads(re.search(r'var c=(\[.*\]);for', t, re.S).group(1))


# ── données inventées ───────────────────────────────────────────────────────────────────────────
# GRP_DEPART : deux adhérentes Essentiels (dont une écrite AVEC un zéro de tête), une officine d'un autre groupement.
ALIAS = ("window.GRP_ALIAS = {};\n"
         "window.GRP_DEPART = {'0999001': 'Essentiels Pharma', '999002': 'Essentiels Pharma', '999003': 'Autre Groupe'};\n")
OFFICINES = [{'id': '999001', 'code': '999001', 'comms': ['Karine']},
             {'id': '999002', 'code': '999002', 'comms': ['Florent']},
             {'id': '999003', 'code': '999003', 'comms': ['Arthur']},
             {'id': '999004', 'code': '999004', 'comms': ['Arthur']}]
D_OFF = ['999001', '999002', '999003', '999004']
# [rang officine, mois, rang commercial, rang produit, quantité, prix, montant]
VENTES = [[0, 1, 0, 0, 2, 5.0, 10.0], [0, 2, 1, 1, 1, 7.0, 7.0],   # adhérente 1 : deux commerciaux différents
          [1, 1, 1, 0, 3, 2.0, 6.0],                                 # adhérente 2
          [2, 1, 2, 0, 9, 1.0, 9.0], [3, 2, 2, 1, 4, 1.0, 4.0]]      # hors Essentiels : jamais dans le jeu
OFF_CA = {'999001': [17, 1], '999002': [6, 1], '999003': [9, 1], '999004': [4, 1]}
CARTE = {'999001': {'m': [10, 7]}, '999002': {'m': [6, 0]}, '999003': {'m': [9, 0]}, '999004': {'m': [0, 4]}}
REP = {'act': {'1': 3, '2': 2}, 'nph': 4, 'no': 4, 'rg': {'999001': 1, '999003': 2, '999002': 3, '999004': 4},
       'rgg': {'999001': [1, 2], '999003': [1, 2]}}

tmp = tempfile.mkdtemp(prefix='jeu-essentiels-')
v2 = os.path.join(tmp, 'v2')
os.makedirs(v2)
open(os.path.join(v2, 'groupement-alias.js'), 'w', encoding='utf-8').write(ALIAS)
dc.V2, dc.SORTIE, dc.OFF_CA = v2, os.path.join(v2, 'ventes'), None

dc.jeu_essentiels(OFFICINES, D_OFF, VENTES, OFF_CA, '// tête\n', CARTE, '// tête\n', REP, REP)

dossier = hashlib.sha256(b'ESSENTIELS').hexdigest()[:16]
rep = os.path.join(dc.SORTIE, dossier)
check("dossier = sha256('ESSENTIELS')[:16] = 34a3ecf7b287f5f7 (celui que l'écran calcule)", dossier == '34a3ecf7b287f5f7' and os.path.isdir(rep), os.listdir(dc.SORTIE))
reglage = open(os.path.join(RACINE, 'groupements', 'config', 'essentiels.js'), encoding='utf-8').read()
check("le réglage de l'app Essentiels demande bien ce jeu (jeuVentes: 'ESSENTIELS')", "jeuVentes: 'ESSENTIELS'" in reglage)
check("la constante du script vaut la même chose", dc.ESSENTIELS == 'ESSENTIELS')

L = lire_ventes(rep)
check("périmètre : les deux adhérentes seules (zéro de tête ignoré), aucune ligne hors Essentiels", sorted({v[0] for v in L}) == [0, 1], L)
check("contenu : TOUTES leurs ventes, quel que soit le commercial (3 lignes, 2 commerciaux)", len(L) == 3 and {v[2] for v in L} == {0, 1}, L)
check("contenu : aucun total du reste du réseau (aucune ligne « 0 » / -1)", all(v[0] >= 0 for v in L), L)
check("montant = 23 € (10 + 7 + 6)", abs(sum(v[6] for v in L) - 23.0) < 1e-9, sum(v[6] for v in L))

fichiers = sorted(os.listdir(rep))
check("fichiers : ventes, index, agrégats vides, CA, carte — PAS de marge-clients.js",
      fichiers == ['carte-detail.js', 'grp-agregats.js', 'wml-officines-ca.js', 'wml-ventes-01.js', 'wml-ventes-index.js'], fichiers)
check("agrégats de groupement vides (rien du réseau)",
      open(os.path.join(rep, 'grp-agregats.js'), encoding='utf-8').read() == 'window.GRP_AGREGATS = {"P":[],"T":{},"E":{}};\n')
ca = open(os.path.join(rep, 'wml-officines-ca.js'), encoding='utf-8').read()
m = re.search(r'window\.WML_OFF_CA = \{n:(\d+), m:(\{[^{}]*\})', ca)
check("CA : les deux adhérentes seules", m and m.group(1) == '2' and sorted(json.loads(m.group(2))) == ['999001', '999002'], ca)
carte = json.loads(re.search(r'window\.CARTE_DETAIL=(\{.*\});', open(os.path.join(rep, 'carte-detail.js'), encoding='utf-8').read()).group(1))
check("carte : les deux adhérentes seules", sorted(carte) == ['999001', '999002'], sorted(carte))
idx = json.loads(re.search(r'window\.WML_TRANCHES_JEU = (\{.*\});', open(os.path.join(rep, 'wml-ventes-index.js'), encoding='utf-8').read()).group(1))
check("repères : rangs réseau gardés pour les adhérentes seules (1 et 3), comptes du réseau inchangés",
      idx['T']['rg'] == {'999001': 1, '999002': 3} and idx['T']['nph'] == 4 and idx['n'] == 1, idx['T'])

# Un GRP_DEPART sans aucune adhérente Essentiels : on S'ARRÊTE (un jeu vide = un écran à zéro sans le dire).
open(os.path.join(v2, 'groupement-alias.js'), 'w', encoding='utf-8').write("window.GRP_DEPART = {'999003': 'Autre Groupe'};\n")
try:
    dc.jeu_essentiels(OFFICINES, D_OFF, VENTES, OFF_CA, '', CARTE, '', REP, REP)
    arret = False
except SystemExit:
    arret = True
check("aucune adhérente dans GRP_DEPART : ARRÊT, rien de publié", arret)

print()
if ECHECS:
    print("ÉCHECS (%d) : %s" % (len(ECHECS), ", ".join(ECHECS)))
    sys.exit(1)
print("Tous les tests passent.")

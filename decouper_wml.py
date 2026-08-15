#!/usr/bin/env python3
"""Découpe wml-officines-data.js en morceaux digestes par un iPhone.

⚠️ 15/08/2026 — POURQUOI CE SCRIPT EXISTE
`wml-officines-data.js` faisait 17,4 Mo, dont **13,4 Mo de ventes sur UNE SEULE
LIGNE** (un littéral de 437 848 tableaux) et **3,6 Mo de logos en base64** qui
n'ont rien à faire dans un fichier de ventes.

Mesuré sur l'iPhone de Will : le fichier arrive entier (il est servi compressé,
6,3 Mo sur le réseau), mais Safari **abandonne la lecture en cours de route**.
Et comme les données ne sont publiées sur `window` qu'à la toute DERNIÈRE ligne
du fichier, il ne reste rien : l'app croyait le fichier chargé et retombait sur
de vieilles tables — 22 officines affichées au lieu de 690.

Ce découpage produit :
  wml-officines-data.js   les 691 officines + les 3 dictionnaires (petit)
  wml-ventes-NN.js        les ventes par tranches d'environ 1,5 Mo
  grp-logos-wml.js        les logos, chargés seulement quand on en a besoin

Chaque fichier se lit indépendamment. Le téléphone n'a plus jamais à avaler
13 Mo d'un coup, et le ramasse-miettes respire entre deux tranches.

Usage :  python3 decouper_wml.py [chemin/wml-officines-data.js]
Relançable sans risque : il refuse de tourner sur un fichier déjà découpé.

⚠️ À RELANCER après chaque `generate_wml_v2.py`, sinon le gros fichier revient.
"""
import json
import os
import sys

# Taille visée d'une tranche de ventes, en octets de JSON.
# 1,5 Mo : assez petit pour un iPhone, assez gros pour ne pas multiplier
# les requêtes (~9 fichiers pour 13,4 Mo).
TAILLE_TRANCHE = 1_500_000

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'crm', 'v2', 'wml-officines-data.js')
DOSSIER = os.path.dirname(SRC)


def lire_declaration(lignes, nom):
    """Récupère la valeur JSON de `const <nom> = <json>;` (une ligne = une déclaration)."""
    prefixes = ('const {} = '.format(nom), 'var {} = '.format(nom),
                'window.{}='.format(nom), 'window.{} = '.format(nom))
    for ligne in lignes:
        for p in prefixes:
            if ligne.startswith(p):
                brut = ligne[len(p):].rstrip()
                if brut.endswith(';'):
                    brut = brut[:-1]
                try:
                    return json.loads(brut)
                except json.JSONDecodeError:
                    # Fichier DÉJÀ découpé : il contient
                    # `window.WML_SALES = window.WML_SALES || [];`, qui n'est pas
                    # du JSON. On répond « absent » pour que le garde ci-dessous
                    # refuse proprement, au lieu de s'écrouler sur une trace.
                    return None
    return None


def ecrire(chemin, contenu):
    with open(chemin, 'w', encoding='utf-8') as f:
        f.write(contenu)
    return os.path.getsize(chemin)


def main():
    if not os.path.exists(SRC):
        sys.exit('Fichier introuvable : {}'.format(SRC))

    with open(SRC, encoding='utf-8') as f:
        lignes = f.read().split('\n')

    officines = lire_declaration(lignes, 'WML_OFFICINES')
    ventes = lire_declaration(lignes, 'WML_SALES')
    if officines is None or ventes is None:
        sys.exit('Ce fichier ne contient pas WML_OFFICINES et WML_SALES — déjà découpé ?')

    d_off = lire_declaration(lignes, 'WML_D_OFFICINES')
    d_com = lire_declaration(lignes, 'WML_D_COMMERCIAUX')
    d_pro = lire_declaration(lignes, 'WML_D_PRODUITS')
    logos = lire_declaration(lignes, 'GRP_LOGOS')

    print('Lu : {} officines · {} ventes · logos {}'.format(
        len(officines), len(ventes), 'oui' if logos else 'non'))

    compact = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))

    # ── 1. Découper les ventes D'ABORD ────────────────────────────────────
    # Il faut connaître le NOMBRE de tranches avant d'écrire l'en-tête, qui
    # l'annonce à l'app. On coupe sur le POIDS du JSON, pas sur un nombre de
    # lignes : elles n'ont pas toutes la même longueur.
    tranches, courante, poids = [], [], 0
    for v in ventes:
        t = compact(v)
        if courante and poids + len(t) > TAILLE_TRANCHE:
            tranches.append(courante)
            courante, poids = [], 0
        courante.append(v)
        poids += len(t) + 1
    if courante:
        tranches.append(courante)

    # ── 2. Les officines et les dictionnaires : petit, chargé en premier ──
    tete = [
        '// WML · officines + dictionnaires — découpé le 15/08/2026 (voir decouper_wml.py).',
        '// Les VENTES vivent dans wml-ventes-NN.js, les LOGOS dans grp-logos-wml.js :',
        '// un iPhone ne peut pas lire 13 Mo de ventes d\'un seul tenant.',
        'const WML_OFFICINES = ' + compact(officines) + ';',
    ]
    if d_off is not None:
        tete.append('const WML_D_OFFICINES = ' + compact(d_off) + ';')
        tete.append('const WML_D_COMMERCIAUX = ' + compact(d_com) + ';')
        tete.append('const WML_D_PRODUITS = ' + compact(d_pro) + ';')
    # ⚠️ WML_SALES est créé VIDE ici. Les tranches le remplissent ensuite.
    # Sans cette ligne, `loadData()` ne trouverait pas le tableau et retomberait
    # sur les anciennes tables — exactement la panne du 14/08.
    tete.append('window.WML_SALES = window.WML_SALES || [];')
    # ⚠️ Le NOMBRE de tranches est écrit ICI, par le script qui les fabrique.
    # Il ne doit surtout pas être recopié à la main dans v2-boot.js : une
    # tranche oubliée, ce sont des ventes manquantes SANS aucune erreur visible
    # — le genre de panne muette qui a coûté deux jours les 13 et 14/08.
    tete.append('window.WML_TRANCHES = {};'.format(len(tranches)))
    assigns = 'try{window.WML_OFFICINES=WML_OFFICINES;'
    if d_off is not None:
        assigns += ('window.WML_D_OFFICINES=WML_D_OFFICINES;'
                    'window.WML_D_COMMERCIAUX=WML_D_COMMERCIAUX;'
                    'window.WML_D_PRODUITS=WML_D_PRODUITS;')
    assigns += '}catch(e){}'
    tete.append(assigns)
    taille_tete = ecrire(SRC, '\n'.join(tete) + '\n')
    print('  {:<28} {:>8.2f} Mo'.format(os.path.basename(SRC), taille_tete / 1e6))

    # ── 3. Écrire les tranches ─────────────────────────────────────────────
    # On efface les tranches d'une exécution précédente qui seraient en trop
    # (si le fichier a maigri, il resterait des tranches orphelines chargées
    #  par l'app et donc des ventes en double).
    for vieux in sorted(os.listdir(DOSSIER)):
        if vieux.startswith('wml-ventes-') and vieux.endswith('.js'):
            n = vieux[len('wml-ventes-'):-3]
            if n.isdigit() and int(n) > len(tranches):
                os.remove(os.path.join(DOSSIER, vieux))
                print('  (retiré : {} — tranche devenue inutile)'.format(vieux))

    total = 0
    for i, tr in enumerate(tranches, 1):
        nom = 'wml-ventes-{:02d}.js'.format(i)
        # Le tableau est poussé ligne à ligne : le pic mémoire vaut UNE tranche,
        # pas la somme. `concat` aurait recopié tout le tableau à chaque fois.
        corps = (
            '// WML · ventes {}/{} — {} lignes. Découpé le 15/08/2026.\n'
            '(function(){{var a=window.WML_SALES||(window.WML_SALES=[]);'
            'var c={};for(var i=0;i<c.length;i++)a.push(c[i]);}})();\n'
        ).format(i, len(tranches), len(tr), compact(tr))
        total += ecrire(os.path.join(DOSSIER, nom), corps)
    print('  {:<28} {:>8.2f} Mo  ({} tranches)'.format(
        'wml-ventes-NN.js', total / 1e6, len(tranches)))

    # ── 3. Les logos : sortis du chemin de démarrage ───────────────────────
    if logos:
        nom = os.path.join(DOSSIER, 'grp-logos-wml.js')
        taille = ecrire(nom, (
            '// Logos de groupements — sortis de wml-officines-data.js le 15/08/2026.\n'
            '// 3,6 Mo d\'images en base64 n\'ont rien à faire dans un fichier de ventes :\n'
            '// ils sont désormais chargés à la demande, jamais au démarrage.\n'
            'window.GRP_LOGOS = ' + compact(logos) + ';\n'))
        print('  {:<28} {:>8.2f} Mo'.format('grp-logos-wml.js', taille / 1e6))

    print('\nLe plus gros fichier à lire fait maintenant {:.2f} Mo.'.format(
        max(taille_tete, max((os.path.getsize(os.path.join(DOSSIER, 'wml-ventes-{:02d}.js'.format(i)))
                              for i in range(1, len(tranches) + 1)), default=0)) / 1e6))
    print('Tranches ecrites : {} — le nombre est inscrit dans wml-officines-data.js, rien a recopier.'.format(len(tranches)))


if __name__ == '__main__':
    main()

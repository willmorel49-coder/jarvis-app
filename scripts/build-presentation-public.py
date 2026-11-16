#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Assemble le site public de la présentation groupements (dossier `presentation-public/`).

POURQUOI CE DOSSIER EXISTE
--------------------------
Le lien que Pascale envoie aux directions de groupements était :

    https://willmorel49-coder.github.io/jarvis-app/presentation-groupement/
             └─ pseudo GitHub ─┘  └ dépôt PUBLIC ┘

et l'aperçu du lien (balises og:) le répétait dans chaque mail. Même règle que
la prise de rendez-vous (19/08/2026) : rien de ce qui sort vers un tiers ne
porte l'identité technique de Will.

Ce dossier est déployé SEUL sur https://integral-pharma-presentation.vercel.app
(projet Vercel `integral-pharma-presentation`, déployé par la CLI, jamais branché
sur le dépôt : une intégration Git publierait toute la racine). Il ne contient
que la présentation et les sept fichiers qu'elle charge.

L'ANCIENNE ADRESSE RESTE VIVANTE
--------------------------------
Le lien github.io est déjà parti chez des groupements : on change ce qu'on
émet, jamais ce qui est déjà parti. `presentation-groupement/index.html` reste
la source ; ce script en tire la copie neutre.

Après toute retouche de la présentation (fichier maître
`site-integral/teaser/presentation-final-BC.html`, propagé vers
`presentation-groupement/index.html`) : rejouer ce script, puis redéployer
depuis `presentation-public/` (`vercel link --yes --project
integral-pharma-presentation` d'abord si le dossier vient d'un nouveau worktree).

Usage :
    python3 scripts/build-presentation-public.py              # (re)génère
    python3 scripts/build-presentation-public.py --verifier   # sort 1 si ça a dérivé
"""
import filecmp
import os
import re
import shutil
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIBLE = os.path.join(RACINE, 'presentation-public')
SOURCE = os.path.join(RACINE, 'presentation-groupement', 'index.html')
ADRESSE = 'https://integral-pharma-presentation.vercel.app/'

# Ce que charge réellement la page, relevé dans presentation-groupement/index.html
# le 16/11/2026 (Three.js et les polices viennent de cdnjs / Google Fonts).
FICHIERS = {
    'assets/clip3.mp4': 'site-integral/assets/clip3.mp4',
    'assets/logo.png': 'site-integral/assets/logo.png',
    'assets/siege-solaire.jpg': 'site-integral/assets/siege-solaire.jpg',
    'assets/siege.jpg': 'site-integral/assets/siege.jpg',
    'vendor/gsap.min.js': 'site-integral/vendor/gsap.min.js',
    'vendor/splitting.css': 'site-integral/vendor/splitting.css',
    'vendor/splitting.min.js': 'site-integral/vendor/splitting.min.js',
}

# Le cache du hook impeccable (chemins /Users + identifiant de session) ne doit
# jamais partir en ligne s'il apparaît un jour dans ce dossier.
GENERES = {
    '.gitignore': '.vercel\n',
    '.vercelignore': '.impeccable\n.gitignore\n.vercelignore\n',
}

# Toute trace de l'hébergement d'origine fait échouer la fabrication.
INTERDITS = re.compile(r'github\.io|willmorel49|jarvis-app|\.\./site-integral/')


def page_neutre():
    html = open(SOURCE, 'r', encoding='utf-8').read()
    html = html.replace('https://willmorel49-coder.github.io/jarvis-app/presentation-groupement/', ADRESSE)
    html = html.replace('https://willmorel49-coder.github.io/jarvis-app/site-integral/assets/', ADRESSE + 'assets/')
    html = html.replace('../site-integral/assets/', 'assets/')
    html = html.replace('../site-integral/vendor/', 'vendor/')
    return html


def construire(verifier=False):
    ecarts = []
    html = page_neutre()
    reste = sorted(set(INTERDITS.findall(html)))
    if reste:
        ecarts.append('la page garde une trace de l’hébergement d’origine : %s' % ', '.join(reste))

    contenus = dict(GENERES)
    contenus['index.html'] = html

    if not verifier:
        os.makedirs(CIBLE, exist_ok=True)

    for rel, contenu in contenus.items():
        dest = os.path.join(CIBLE, rel)
        if verifier:
            if not os.path.exists(dest):
                ecarts.append('manquant : presentation-public/%s' % rel)
            elif open(dest, 'r', encoding='utf-8').read() != contenu:
                ecarts.append('a dérivé : presentation-public/%s' % rel)
        else:
            open(dest, 'w', encoding='utf-8').write(contenu)

    for rel, src_rel in FICHIERS.items():
        src = os.path.join(RACINE, src_rel)
        dest = os.path.join(CIBLE, rel)
        if not os.path.exists(src):
            ecarts.append('SOURCE INTROUVABLE : %s' % src_rel)
            continue
        if verifier:
            if not os.path.exists(dest):
                ecarts.append('manquant : presentation-public/%s' % rel)
            elif not filecmp.cmp(src, dest, shallow=False):
                ecarts.append('a dérivé : presentation-public/%s (la source a changé)' % rel)
        else:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(src, dest)

    # Un fichier en TROP est aussi grave qu'un manquant : c'est par là qu'un
    # fichier de données partirait en ligne. `.vercel/` (liaison CLI) est ignoré.
    attendus = set(FICHIERS) | set(contenus)
    for dossier, sous, noms in os.walk(CIBLE):
        sous[:] = [d for d in sous if d != '.vercel']
        for n in noms:
            rel = os.path.relpath(os.path.join(dossier, n), CIBLE).replace(os.sep, '/')
            if rel not in attendus:
                ecarts.append('EN TROP dans presentation-public/ : %s' % rel)

    return ecarts


if __name__ == '__main__':
    mode_verif = '--verifier' in sys.argv
    pbs = construire(verifier=mode_verif)
    if pbs:
        for p in pbs:
            print('  ✗ %s' % p)
        if mode_verif:
            print('\nLe site public a dérivé de ses sources.')
            print('Rejoue : python3 scripts/build-presentation-public.py')
        sys.exit(1)
    print('presentation-public/ : %d fichiers, conforme.' % (len(FICHIERS) + len(GENERES) + 1))

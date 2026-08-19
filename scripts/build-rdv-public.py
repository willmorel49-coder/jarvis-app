#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Assemble le site public de prise de rendez-vous (dossier `rdv-public/`).

POURQUOI CE DOSSIER EXISTE
--------------------------
Le lien envoyé aux pharmaciens était :

    https://willmorel49-coder.github.io/jarvis-app/rdv/william
             └─ pseudo GitHub ─┘  └ dépôt PUBLIC ┘  └ prénom

Les trois se lisent d'un coup d'œil, et `jarvis-app` est public : qui recopie
l'adresse dans GitHub tombe sur tout le CRM. Ce n'était donc pas une question
d'apparence.

Ce dossier est déployé SEUL sur une adresse neutre. Il ne contient que ce qu'un
pharmacien doit charger — **aucun fichier de données**, aucun écran du CRM.
C'est ce qui fait que ce n'est pas un simple habillage : il n'y a rien d'autre
à trouver sur cette adresse.

CE QUI N'A PAS BOUGÉ, ET POURQUOI
---------------------------------
L'arborescence interne est recopiée **à l'identique** (`crm/v2/…`). Deux
fonctions de `rdv-public.js` et de `r.html` calculent la racine du site en
retirant `crm/v2/…` du chemin courant ; les aplatir aurait cassé le lien de
gestion que le pharmacien garde dans son agenda, y compris pour les rendez-vous
déjà pris. Zéro ligne modifiée dans la page du pharmacien, donc zéro risque
pour ce qui est en cours. Seules les adresses visibles changent.

DUPLICATION ET DÉRIVE
---------------------
Ces fichiers existent donc à deux endroits. C'est exactement le piège qui a
produit la panne du 13/08 (deux chemins qui font la même chose sans partager la
source). D'où : ce script est la SEULE façon de remplir `rdv-public/`, et le
gardien quotidien le rejoue en mode `--verifier` pour échouer bruyamment si les
deux copies divergent.

Usage :
    python3 scripts/build-rdv-public.py              # (re)génère
    python3 scripts/build-rdv-public.py --verifier   # sort 1 si ça a dérivé
"""
import filecmp
import os
import shutil
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIBLE = os.path.join(RACINE, 'rdv-public')

# Ce que charge réellement le navigateur du pharmacien, et rien d'autre.
# Vérifié en lisant rdv.html : quatre scripts, deux icônes.
FICHIERS = [
    'r.html',
    'rdv/william.html',
    'rdv/pascale.html',
    'crm/v2/rdv.html',
    'crm/v2/rdv-public.js',
    'crm/v2/v2-rdv-creneaux.js',
    'crm/v2/v2-rdv-ics.js',
    'crm/v2/vendor/supabase/supabase-2.112.2.min.js',
    'crm/v2/icons/icon-192.png',
    'crm/v2/icons/apple-touch-icon.png',
]

# La racine du site. Sans elle, ouvrir l'adresse nue tomberait sur un 404 de
# Vercel — un pharmacien qui efface la fin du lien mérite une phrase, pas une
# page d'erreur d'hébergeur. Volontairement muette : elle ne nomme personne et
# ne mène nulle part.
INDEX = '''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Prendre rendez-vous</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#FBFCFE;color:#10131C;padding:24px;
       font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .c{max-width:440px;background:#fff;border:1px solid #E3E8F0;border-radius:14px;padding:26px}
  h1{font-size:20px;font-weight:800;margin:0 0 10px}
  p{margin:0 0 12px;color:#5B6577}
</style>
</head>
<body>
  <div class="c">
    <h1>Prise de rendez-vous</h1>
    <p>Cette page s’ouvre depuis le lien que votre interlocuteur vous a envoyé.</p>
    <p>Si vous êtes arrivé ici, il manque probablement la fin de l’adresse :
       les messageries coupent parfois les liens longs en deux. Répondez à son
       message, il vous en renverra un.</p>
  </div>
</body>
</html>
'''

ROBOTS = 'User-agent: *\nDisallow: /\n'

# `cleanUrls` sert les adresses courtes de la signature et des mails :
# /rdv/william et /r, sans « .html ». L'en-tête noindex double le <meta> des
# pages : un moteur qui n'exécute pas le HTML le voit quand même.
VERCEL = '''{
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
    }
  ]
}
'''

GENERES = {'index.html': INDEX, 'robots.txt': ROBOTS, 'vercel.json': VERCEL}


def construire(verifier=False):
    ecarts = []

    def poser(rel, contenu=None, source=None):
        dest = os.path.join(CIBLE, rel)
        if verifier:
            if not os.path.exists(dest):
                ecarts.append('manquant : rdv-public/%s' % rel)
                return
            if contenu is not None:
                actuel = open(dest, 'r', encoding='utf-8').read()
                if actuel != contenu:
                    ecarts.append('a dérivé : rdv-public/%s' % rel)
            elif not filecmp.cmp(source, dest, shallow=False):
                ecarts.append('a dérivé : rdv-public/%s (la source a changé)' % rel)
            return
        os.makedirs(os.path.dirname(dest) or CIBLE, exist_ok=True)
        if contenu is not None:
            open(dest, 'w', encoding='utf-8').write(contenu)
        else:
            shutil.copy2(source, dest)

    if not verifier:
        os.makedirs(CIBLE, exist_ok=True)

    for rel in FICHIERS:
        src = os.path.join(RACINE, rel)
        if not os.path.exists(src):
            ecarts.append('SOURCE INTROUVABLE : %s' % rel)
            continue
        poser(rel, source=src)

    for rel, contenu in GENERES.items():
        poser(rel, contenu=contenu)

    # Un fichier en TROP dans rdv-public est aussi grave qu'un fichier manquant :
    # c'est comme ça qu'un jeu de données se retrouverait publié par accident.
    attendus = set(FICHIERS) | set(GENERES)
    for dossier, sous, noms in os.walk(CIBLE):
        # Les dossiers cachés ne sont jamais servis (`.vercel/` est la fiche de
        # liaison du CLI, `.gitignore` vient avec). Les ignorer ici, mais
        # SURTOUT pas les fichiers visibles : c'est par là qu'un jeu de données
        # se retrouverait publié.
        sous[:] = [d for d in sous if not d.startswith('.')]
        for n in noms:
            if n.startswith('.'):
                continue
            rel = os.path.relpath(os.path.join(dossier, n), CIBLE).replace(os.sep, '/')
            if rel not in attendus:
                ecarts.append('EN TROP dans rdv-public/ : %s' % rel)

    return ecarts


if __name__ == '__main__':
    mode_verif = '--verifier' in sys.argv
    pbs = construire(verifier=mode_verif)
    if pbs:
        for p in pbs:
            print('  ✗ %s' % p)
        if mode_verif:
            print('\nLe site public a dérivé de ses sources.')
            print('Rejoue : python3 scripts/build-rdv-public.py')
        sys.exit(1)
    print('rdv-public/ : %d fichiers, conforme.' % (len(FICHIERS) + len(GENERES)))

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_grp_logos_plus.py — complète les logos de groupements manquants.

Pourquoi un fichier À PART plutôt que de régénérer wml-officines-data.js :
ce dernier pèse 27 Mo et sa régénération demande les fichiers de ventes
sources. Ici on ajoute un petit fichier additif que la page fusionne au
chargement — zéro risque sur les données de ventes.

Ce que ça produit : crm/v2/grp-logos-plus.js  ->  window.GRP_LOGOS_PLUS
Les images sont encodées en base64 : AUCUNE requête réseau à l'exécution.
Le réseau n'est sollicité qu'ici, à la génération.

Sources de sites, dans cet ordre :
  1. crm/v2/groupement-info.js   (GRP_INFO[nom].site)
  2. crm/groupements-data.js     (GRP_PROSPECTS[].site)

Pour chaque site : on tente d'abord le vrai logo (og:image, puis une balise
<img> dont le nom contient « logo »), et on retombe sur le favicon Google
128px — gratuit, sans clé — si rien de mieux n'est trouvé.

Python 3.9 strict (pas de `X | Y`), aucune dépendance externe : urllib et re.
"""

import base64
import json
import os
import re
import subprocess
import sys
import unicodedata

RACINE = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(RACINE, 'crm', 'v2', 'grp-logos-plus.js')

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')
TAILLE_MIN = 700          # en dessous, c'est un favicon vide ou une erreur
TAILLE_MAX = 260 * 1024   # au-delà, on ne télécharge même pas
PLAFOND_UNITE = 14 * 1024  # poids retenu par logo, après réduction


def norm(x):
    v = unicodedata.normalize('NFD', str(x or '').lower())
    v = ''.join(c for c in v if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', v)


def curl(url, binaire=False, timeout=15):
    """curl plutôt qu'urllib : certains sites renvoient un faux 403 à urllib."""
    cmd = ['curl', '-sL', '--max-time', str(timeout), '-A', UA, url]
    try:
        r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    except Exception:
        return None
    if r.returncode != 0 or not r.stdout:
        return None
    return r.stdout if binaire else r.stdout.decode('utf-8', 'ignore')


def domaine(url):
    m = re.match(r'https?://([^/]+)', str(url or ''))
    return m.group(1) if m else None


def absolu(base, lien):
    if lien.startswith('http'):
        return lien
    if lien.startswith('//'):
        return 'https:' + lien
    d = domaine(base)
    if not d:
        return None
    if lien.startswith('/'):
        return 'https://' + d + lien
    return 'https://' + d + '/' + lien


def candidats_logo(site):
    """URL d'images à tenter, de la meilleure à la moins bonne."""
    out = []
    html = curl(site)
    if html:
        m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html, re.I)
        if not m:
            m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html, re.I)
        if m:
            u = absolu(site, m.group(1))
            if u:
                out.append(u)
        for m2 in re.finditer(r'<img[^>]+src=["\']([^"\']*logo[^"\']*)["\']', html, re.I):
            u = absolu(site, m2.group(1))
            if u and u not in out:
                out.append(u)
            if len(out) >= 4:
                break
    d = domaine(site)
    if d:
        out.append('https://www.google.com/s2/favicons?domain=' + d + '&sz=128')
    return out


def mime(donnees):
    if donnees[:8] == b'\x89PNG\r\n\x1a\n':
        return 'image/png'
    if donnees[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'
    if donnees[:4] == b'RIFF' and donnees[8:12] == b'WEBP':
        return 'image/webp'
    tete = donnees[:400].lstrip()
    if tete[:5] == b'<?xml' or tete[:4] == b'<svg':
        return 'image/svg+xml'
    return None


def reduire(donnees, ext):
    """Redimensionne avec `sips`, l'outil integre a macOS — gratuit, local.
    Une vignette s'affiche a 22 px de haut : au-dela de 96 px on transporte du
    poids pour rien. Le fichier complet doit rester sous la regle des 500 Ko."""
    import tempfile
    src = tempfile.NamedTemporaryFile(suffix='.' + ext, delete=False)
    src.write(donnees)
    src.close()
    dst = src.name + '.out.png'
    cmd = ['sips', '-s', 'format', 'png', '--resampleHeight', '96', src.name, '--out', dst]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(dst):
            with open(dst, 'rb') as f:
                red = f.read()
            if TAILLE_MIN <= len(red) < len(donnees):
                return red, 'image/png'
    except Exception:
        pass
    finally:
        for f in (src.name, dst):
            try:
                os.unlink(f)
            except Exception:
                pass
    return None, None


def recuperer(site):
    for url in candidats_logo(site):
        d = curl(url, binaire=True)
        if not d or len(d) < TAILLE_MIN or len(d) > TAILLE_MAX:
            continue
        t = mime(d)
        if not t:
            continue
        # Un SVG ne passe pas par sips : on ne le garde que s'il est deja leger.
        if t == 'image/svg+xml':
            if len(d) > PLAFOND_UNITE:
                continue
        elif len(d) > PLAFOND_UNITE:
            red, t2 = reduire(d, {'image/png': 'png', 'image/jpeg': 'jpg',
                                  'image/webp': 'webp'}.get(t, 'png'))
            if not red or len(red) > PLAFOND_UNITE:
                continue
            d, t = red, t2
        return 'data:' + t + ';base64,' + base64.b64encode(d).decode('ascii'), url, len(d)
    return None, None, 0


def lire_global(chemin, motif):
    """Extrait un littéral JS `window.X = {...}` ou `var X = [...]`."""
    with open(chemin, encoding='utf-8') as f:
        src = f.read()
    m = re.search(motif, src, re.S)
    if not m:
        return None
    return json.loads(m.group(1))


def main():
    manquants = json.loads(sys.argv[1]) if len(sys.argv) > 1 else None
    if not manquants:
        print('usage : generate_grp_logos_plus.py \'[["Nom","https://site"], ...]\'')
        return 1

    out = {}
    for nom, site in manquants:
        b64, source, taille = recuperer(site)
        if b64:
            out[nom] = b64
            print('  OK   %-34s %6d o   %s' % (nom[:34], taille, (source or '')[:60]))
        else:
            print('  --   %-34s rien d exploitable' % nom[:34])

    entete = (
        '// AUTO-GENERE par generate_grp_logos_plus.py — ne pas editer a la main.\n'
        '// Complement de logos de groupements, fusionne avec GRP_LOGOS (qui vit\n'
        '// dans wml-officines-data.js, 27 Mo, non regenere ici).\n'
        '// Images en base64 : AUCUNE requete reseau a l execution.\n'
        '// %d logos.\n' % len(out)
    )
    with open(SORTIE, 'w', encoding='utf-8') as f:
        f.write(entete + 'window.GRP_LOGOS_PLUS = ' + json.dumps(out, ensure_ascii=False) + ';\n')
    print('\n%d logos ecrits dans %s (%d Ko)'
          % (len(out), SORTIE, os.path.getsize(SORTIE) // 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())

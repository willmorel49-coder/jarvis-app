#!/usr/bin/env python3
"""Avance le jeton de version ?v= partout d'un coup, puis vérifie qu'il n'en reste aucun.

Même règle que nouveau_jeton() / bump_cache() du robot des stats
(~/stats-commercial/veille-stats.py) : le jeton AVANCE toujours. Il ne redescend
jamais et ne reprend jamais un jeton déjà servi, sinon les navigateurs qui l'ont
en cache ne rechargent pas. D'où la lecture de l'historique de sw.js : le jeton
posé ce matin par une autre session compte, même s'il n'est plus dans le fichier.
Tous les ?v= d'opso/v2/index.html sont réécrits, pas seulement ceux du jour :
du 16 au 19/10/2026, 13 suffixes y sont restés figés pendant 13 mises en ligne.

Usage, depuis un worktree, juste après `git pull --rebase origin main` :
  python3 scripts/jeton.py              avance le jeton
  python3 scripts/jeton.py --verifier   contrôle seulement que les 5 fichiers sont alignés
Hors périmètre, à monter à la main si besoin : rdv.html (ROBOT.md §8), les ?v= propres
à un fichier de données (pharmazon-data.js…), V2_DATAV, et PROTEGE_VER d'opso/ et
essentiels-pharma/ (skill donnees-protegees-jarvis).
"""
import os
import re
import subprocess
import sys
from datetime import datetime

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Chaque ?v= de ces pages est remplacé.
TOUS_LES_V = ['crm/v2/index.html', 'opso/v2/index.html']
# Ici, seul le jeton de la ligne visée (v2-boot.js en a deux : code et données).
MOTIFS = {
    'crm/v2/sw.js': r"(var VER\s*=\s*')([^']*)(')",
    'crm/v2/v2-boot.js': r"(var V\s*=\s*'\?v=)([^']*)(')",
    'crm/v2/v2-carte.js': r"(var CB\s*=\s*'\?v=)([^']*)(')",
}
FICHIERS = TOUS_LES_V + list(MOTIFS)


def suivant(anciens, jour):
    """nouveau_jeton() du robot : le jour + des lettres qui avancent (a… z, za… zz, zza…).
    Le plus avancé du jour est le plus long, puis le dernier dans l'alphabet : le
    résultat est donc toujours absent de `anciens`."""
    dujour = [j[len(jour):] for j in anciens if j.startswith(jour)]
    dujour = [s for s in dujour if re.fullmatch(r'[a-z]+', s)]
    if not dujour:
        return jour + 'a'
    dernier = max(dujour, key=lambda s: (len(s), s))
    if dernier[-1] < 'z':
        return jour + dernier[:-1] + chr(ord(dernier[-1]) + 1)
    return jour + dernier + 'a'


def lire(racine, rel):
    with open(os.path.join(racine, rel), encoding='utf-8') as f:
        return f.read()


def ecrire(racine, rel, txt):
    with open(os.path.join(racine, rel), 'w', encoding='utf-8') as f:
        f.write(txt)


def jetons_poses(racine):
    """{fichier: jetons distincts qu'il porte}."""
    poses = {rel: set(re.findall(r'\?v=([0-9a-zA-Z]+)', lire(racine, rel))) for rel in TOUS_LES_V}
    for rel, motif in MOTIFS.items():
        poses[rel] = {m.group(2) for m in re.finditer(motif, lire(racine, rel))}
    return poses


def jetons_du_diff(texte):
    """Les VER de sw.js lus dans une sortie de `git log -p` (lignes retirées comme ajoutées)."""
    return set(re.findall(r"^[-+ ]?var VER\s*=\s*'([0-9a-zA-Z]+)'", texte, re.M))


def deja_servis(racine):
    """Les jetons passés par sw.js dans les 300 derniers commits, ici et sur origin/main."""
    r = subprocess.run(['git', 'log', 'HEAD', 'origin/main', '-n', '300', '--format=', '-p', '--', 'crm/v2/sw.js'],
                       cwd=racine, capture_output=True, text=True)
    if r.returncode != 0:
        print('⚠️  Historique de sw.js illisible (%s) : seuls les jetons des fichiers comptent.'
              % r.stderr.strip(), file=sys.stderr)
        return set()
    return jetons_du_diff(r.stdout)


def poser(racine, jeton):
    """Remplace le jeton aux cinq endroits. Rend le nombre de remplacements."""
    total = 0
    for rel in TOUS_LES_V:
        txt, n = re.subn(r'\?v=[0-9a-zA-Z]+', '?v=' + jeton, lire(racine, rel))
        ecrire(racine, rel, txt)
        total += n
    for rel, motif in MOTIFS.items():
        txt, n = re.subn(motif, r'\g<1>%s\g<3>' % jeton, lire(racine, rel))
        if n == 0:
            raise RuntimeError('%s : la ligne du jeton est introuvable (motif %s)' % (rel, motif))
        ecrire(racine, rel, txt)
        total += n
    return total


def ecarts(racine, jeton):
    """Les fichiers où il reste autre chose que `jeton` (ou aucun jeton du tout)."""
    return sorted(rel for rel, js in jetons_poses(racine).items() if js != {jeton})


def main(args):
    if '--verifier' in args:
        poses = jetons_poses(RACINE)
        ref = sorted(poses['crm/v2/sw.js'])
        restants = ecarts(RACINE, ref[0]) if len(ref) == 1 else sorted(poses)
        if restants:
            for rel in restants:
                print('❌ %s : %s' % (rel, ', '.join(sorted(poses[rel])) or 'aucun jeton'))
            return 1
        print('✅ Jeton %s aligné dans les %d fichiers.' % (ref[0], len(FICHIERS)))
        return 0

    f = subprocess.run(['git', 'fetch', '-q', 'origin', 'main'], cwd=RACINE, capture_output=True, text=True)
    if f.returncode != 0:
        print('⚠️  git fetch impossible : je pars d\'origin/main tel qu\'il était au dernier fetch.', file=sys.stderr)
    poses = jetons_poses(RACINE)
    anciens = set().union(*poses.values()) | deja_servis(RACINE)
    avant = ', '.join(sorted(poses['crm/v2/sw.js']))
    jeton = suivant(anciens, datetime.now().strftime('%Y%m%d'))
    n = poser(RACINE, jeton)
    restants = ecarts(RACINE, jeton)
    if restants:
        print('❌ Jeton mal posé, il reste un autre jeton dans : %s' % ', '.join(restants), file=sys.stderr)
        return 1
    print('✅ Jeton %s → %s, posé %d fois dans %d fichiers :' % (avant, jeton, n, len(FICHIERS)))
    print('   git add ' + ' '.join(FICHIERS))
    print('   Après le push : bash scripts/attendre-prod.sh %s' % jeton)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

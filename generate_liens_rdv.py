#!/usr/bin/env /usr/bin/python3
# -*- coding: utf-8 -*-
"""Génère une page courte par commercial : /rdv/<prenom> → la prise de RDV.

Pourquoi ces pages existent : sans elles, le lien qu'un commercial colle dans
sa signature ressemble à

    …/crm/v2/rdv.html?c=a5517181-9568-43bf-bf79-6ab011555df8

ce qui fait amateur dans un mail à un pharmacien. Avec elles :

    …/rdv/william

Ces fichiers ne contiennent AUCUN secret — seulement le prénom. Le jeton reste
en base et se remplace sans toucher au lien.

Lecture de la liste : API d'administration Supabase, jeton dans
~/.config/jarvis/supabase-token (hors dépôt). Python 3.9 strict.
"""
import json
import os
import subprocess
import sys

RACINE = os.path.dirname(os.path.abspath(__file__))
DOSSIER = os.path.join(RACINE, 'rdv')
JETON = os.path.expanduser('~/.config/jarvis/supabase-token')
REF = 'iyvavhnlhxksokkerkos'

GABARIT = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Prendre rendez-vous</title>
<!-- Page de redirection : elle n'existe que pour offrir une adresse courte et
     lisible dans une signature de mail. Aucun secret ici, seulement le prénom.
     Générée par generate_liens_rdv.py — ne pas modifier à la main. -->
<link rel="canonical" href="../crm/v2/rdv.html?p=%(slug)s" />
<meta http-equiv="refresh" content="0; url=../crm/v2/rdv.html?p=%(slug)s" />
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#FBFCFE;color:#10131C;
       font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  a{color:#0050E6}
</style>
</head>
<body>
  <p>Un instant, nous ouvrons la prise de rendez-vous…<br />
     <a href="../crm/v2/rdv.html?p=%(slug)s">Continuer</a></p>
  <script>location.replace('../crm/v2/rdv.html?p=%(slug)s');</script>
</body>
</html>
"""


def slugs():
    """Les noms courts actifs, lus en base."""
    if not os.path.isfile(JETON):
        sys.exit("Jeton d'administration introuvable : %s" % JETON)
    with open(JETON) as f:
        tok = f.read().strip()
    req = {'query': "select slug from public.rdv_lien_public "
                    "where slug is not null order by slug;"}
    with open('/tmp/_liens.json', 'w') as f:
        json.dump(req, f)
    # curl et pas urllib : Cloudflare renvoie un faux 403 à l'agent de Python.
    out = subprocess.check_output([
        'curl', '-s', '-X', 'POST',
        'https://api.supabase.com/v1/projects/%s/database/query' % REF,
        '-H', 'Authorization: Bearer %s' % tok,
        '-H', 'Content-Type: application/json',
        '--data', '@/tmp/_liens.json'])
    os.remove('/tmp/_liens.json')
    data = json.loads(out.decode('utf-8'))
    if not isinstance(data, list):
        sys.exit('Réponse inattendue : %s' % str(data)[:200])
    return [r['slug'] for r in data if r.get('slug')]


def main():
    noms = slugs()
    if not noms:
        sys.exit('Aucun nom court en base — rien à générer.')
    if not os.path.isdir(DOSSIER):
        os.makedirs(DOSSIER)

    ecrits = []
    for s in noms:
        chemin = os.path.join(DOSSIER, '%s.html' % s)
        with open(chemin, 'w') as f:
            f.write(GABARIT % {'slug': s})
        ecrits.append(s)

    # Les pages d'anciens commerciaux ne sont PAS supprimées automatiquement :
    # un lien retiré d'une signature continue de circuler dans les mails déjà
    # partis. On les signale, la suppression reste une décision humaine.
    presents = set(f[:-5] for f in os.listdir(DOSSIER) if f.endswith('.html'))
    orphelins = sorted(presents - set(noms))

    print('%d page(s) générée(s) dans rdv/ : %s' % (len(ecrits), ', '.join(ecrits)))
    if orphelins:
        print('⚠️  page(s) sans commercial en base (à supprimer à la main si voulu) : %s'
              % ', '.join(orphelins))


if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""Fenêtre de la DILA effondrée (10/11/2026).

Le 08/11/2026 la DILA a publié une archive complète et effacé sa série de dumps quotidiens. Le robot
du 09/11 n'en a vu qu'un, sans avis de prix, et a écrit prix-futurs.json VIDE (83 changements la
veille) : le Brief Officinal et l'écran Appro perdaient toutes les baisses à venir, dont celles du
02/01/2027 (Xarelto). Ces essais passent par le vrai `main()`, DILA simulée, fichiers temporaires.
Lancer : python3 tests/prix-futurs-fenetre.test.py
"""
import io
import os
import sys
import json
import tarfile
import datetime
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import generate_prix_futurs as G  # noqa: E402

AUJ = datetime.date.today()


def j(n):
    return (AUJ + datetime.timedelta(days=n)).isoformat()


def tarball(xmls):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tf:
        for i, x in enumerate(xmls):
            data = x.encode('utf-8')
            info = tarfile.TarInfo('jorf/texte%d.xml' % i)
            info.size = len(data)
            tf.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def avis(date_publi, ligne):
    return ('<TEXTE><DATE_PUBLI>%s</DATE_PUBLI><CONTENU><p>Avis relatif aux prix de spécialités pharmaceutiques'
            '</p><p>%s</p></CONTENU></TEXTE>' % (date_publi, ligne))


CAT = [{'c': '3400927000001', 'd': 'XARELTO 20MG CPR'}, {'c': '3400927000002', 'd': 'RECENT PASSE'},
       {'c': '3400927000003', 'd': 'VIEUX PASSE'}, {'c': '3400927000004', 'd': 'DANS LE DUMP'}]
SNAP = {'3400927000001': 60.0, '3400927000002': 10.0, '3400927000003': 5.0, '3400927000004': 20.0}
ARCH = [
    # paru il y a 21 jours, effet dans 53 jours : DOIT rester (baisse à venir)
    {'c': '3400927000001', 'd': 'XARELTO', 'pfht': 40.0, 'ppttc': 50.0, 'ancien_ttc': None, 'sens': None,
     'date_effet': j(53), 'date_publi': j(-21), 'labo': 'Bayer', 'vu': j(-21)},
    # paru il y a 5 jours, effet passé de 3 jours : DOIT rester (fenêtre de parution de 20 jours)
    {'c': '3400927000002', 'd': 'R', 'pfht': 7.0, 'ppttc': 9.0, 'ancien_ttc': 10.0, 'sens': 'baisse',
     'date_effet': j(-3), 'date_publi': j(-5), 'labo': 'X', 'vu': j(-5)},
    # paru il y a 40 jours, effet passé de 30 jours : NE DOIT PAS revenir
    {'c': '3400927000003', 'd': 'V', 'pfht': 3.0, 'ppttc': 4.0, 'ancien_ttc': 5.0, 'sens': 'baisse',
     'date_effet': j(-30), 'date_publi': j(-40), 'labo': 'Y', 'vu': j(-40)},
    # même avis que celui du dump du jour : une seule fois, la version du dump
    {'c': '3400927000004', 'd': 'D', 'pfht': 1.0, 'ppttc': 1.5, 'ancien_ttc': 20.0, 'sens': 'baisse',
     'date_effet': j(10), 'date_publi': j(-2), 'labo': 'Z', 'vu': j(-2)},
]


def preparer(dossier, archive=ARCH, ancien=None):
    G.OUT = os.path.join(dossier, 'prix-futurs.json')
    G.ARCHIVE = os.path.join(dossier, 'prix-futurs-archive.json')
    G.SNAP = os.path.join(dossier, 'prix-snapshot.json')
    G.PRODSTATS = os.path.join(dossier, 'prod-stats-data.js')
    json.dump(SNAP, open(G.SNAP, 'w'))
    open(G.PRODSTATS, 'w').write('window.X = ' + json.dumps(CAT) + ';')
    if archive is not None:
        open(G.ARCHIVE, 'w').write(archive if isinstance(archive, str)
                                   else json.dumps({'generated': j(-1), 'n': len(archive), 'evenements': archive}))
    if ancien is not None:
        open(G.OUT, 'w').write(ancien)


def dila(dumps):
    """`dumps` = {nom: contenu ou Exception}. Rend un faux `fetch`."""
    def fetch(url, binary=True):
        if url == G.LIST:
            return ''.join('<a href="%s">%s</a>' % (n, n) for n in dumps)
        r = dumps[url[len(G.LIST):]]
        if isinstance(r, Exception):
            raise r
        return r
    return fetch


def lancer():
    try:
        G.main()
        return 0
    except SystemExit as e:
        return e.code


ANCIEN = json.dumps({'generated': j(-1), 'nTotal': 83, 'changes': [{'c': 'ancien'}]})
DUMP_VIDE = tarball(['<TEXTE><DATE_PUBLI>%s</DATE_PUBLI><CONTENU>arrêté sans rapport</CONTENU></TEXTE>' % j(-1)])
DUMP_PRIX = tarball([avis(j(-1), '34009 270 000 0 4 DANS LE DUMP 12,00 € 15,00 € %s'
                     % (AUJ + datetime.timedelta(days=10)).strftime('%d/%m/%Y'))])

# 1. Le cas du 09/11 : un seul dump, sans avis. Le fichier garde les baisses à venir.
with tempfile.TemporaryDirectory() as d:
    preparer(d, ancien=ANCIEN)
    G.fetch = dila({'JORFSIMPLE_20261108-210452.tar.gz': DUMP_VIDE})
    assert lancer() == 0
    r = json.load(open(G.OUT))
    par = {e['c']: e for e in r['changes']}
    assert set(par) == {'3400927000001', '3400927000002', '3400927000004'}, 'le vieil avis passé reste dehors'
    x = par['3400927000001']
    assert (x['d'], x['ppttc'], x['ancien_ttc'], x['sens'], x['date_effet']) == ('XARELTO 20MG CPR', 50.0, 60.0, 'baisse', j(53)), x
    assert 'vu' not in x, 'le champ interne de l\'archive ne sort pas'
    assert (r['nTotal'], r['nFutures'], r['nBaisses']) == (3, 2, 3), r
    assert len(json.load(open(G.ARCHIVE))['evenements']) == 4, 'archive intacte'

# 2. Avis présent à la fois dans le dump du jour et dans l'archive : une seule ligne, celle du dump.
with tempfile.TemporaryDirectory() as d:
    preparer(d)
    G.fetch = dila({'JORFSIMPLE_20261109-212854.tar.gz': DUMP_PRIX})
    assert lancer() == 0
    lignes = [e for e in json.load(open(G.OUT))['changes'] if e['c'] == '3400927000004']
    assert len(lignes) == 1 and lignes[0]['ppttc'] == 15.0, lignes

# 3. Aucun dump lisible : rien n'est écrit, le passage échoue.
with tempfile.TemporaryDirectory() as d:
    preparer(d, ancien=ANCIEN)
    G.fetch = dila({'JORFSIMPLE_20261110-002231.tar.gz': IOError('403'), 'JORFSIMPLE_20261109-212854.tar.gz': IOError('délai')})
    assert lancer() == 1
    assert open(G.OUT).read() == ANCIEN, 'le fichier d\'hier est gardé tel quel'
    G.fetch = dila({})
    assert lancer() == 1 and open(G.OUT).read() == ANCIEN, 'liste vide = même refus'

# 4. Archive présente mais illisible : le passage échoue sans rien écrire (ni le fichier, ni l'archive).
with tempfile.TemporaryDirectory() as d:
    preparer(d, archive='{"evenements": [ tronqué', ancien=ANCIEN)
    G.fetch = dila({'JORFSIMPLE_20261110-002231.tar.gz': DUMP_VIDE})
    try:
        G.main()
        raise AssertionError('une archive illisible devait arrêter le passage')
    except ValueError:
        pass
    assert open(G.OUT).read() == ANCIEN and open(G.ARCHIVE).read() == '{"evenements": [ tronqué'

# 5. Zéro partout (dumps et archive) alors que le fichier d'hier avait des lignes : refus.
with tempfile.TemporaryDirectory() as d:
    preparer(d, archive=[], ancien=ANCIEN)
    G.fetch = dila({'JORFSIMPLE_20261110-002231.tar.gz': DUMP_VIDE})
    assert lancer() == 1 and open(G.OUT).read() == ANCIEN

# 6. Contre-épreuve du refus : premier passage sans fichier d'hier, zéro est alors un vrai zéro.
with tempfile.TemporaryDirectory() as d:
    preparer(d, archive=[])
    G.fetch = dila({'JORFSIMPLE_20261110-002231.tar.gz': DUMP_VIDE})
    assert lancer() == 0 and json.load(open(G.OUT))['nTotal'] == 0

print('OK prix-futurs-fenetre : 6 cas')

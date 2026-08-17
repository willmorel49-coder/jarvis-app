#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gardien de la prise de rendez-vous — contrôle quotidien.

Pourquoi ce robot existe : le 12/08/2026, Pascale a reçu dans son CRM un lien
qui menait à un 404, et les mails de campagne partaient avec une adresse coupée
en deux. Personne ne l'a su avant qu'un humain essaie. La brique la plus fragile
— celle que voient les pharmaciens — était la seule qui n'était pas surveillée.

Ce script rejoue ce qu'un pharmacien fait vraiment, et sort en erreur si quoi
que ce soit casse. GitHub prévient alors par mail.

Python 3.9 strict, aucune dépendance, aucune clé.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

BASE = 'https://willmorel49-coder.github.io/jarvis-app'
SB = 'https://iyvavhnlhxksokkerkos.supabase.co'
UA = {'User-Agent': 'Mozilla/5.0 (compatible; JARVIS-gardien/1.0)'}

echecs = []
oks = []


def dire_ok(quoi):
    oks.append(quoi)
    print('  OK   %s' % quoi)


def dire_ko(quoi, detail):
    echecs.append((quoi, detail))
    print('  KO   %s  -> %s' % (quoi, detail))


def lire(url, timeout=25, entetes=None):
    """Renvoie (code, texte). Ne lève jamais."""
    req = urllib.request.Request(url, headers=dict(entetes or {}, **UA))
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.getcode(), r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read().decode('utf-8', 'replace')
        except Exception:
            return e.code, ''
    except Exception as e:
        return 0, str(e)


def poster(url, corps, entetes):
    req = urllib.request.Request(url, data=json.dumps(corps).encode(),
                                 headers=dict(entetes, **UA), method='POST')
    try:
        r = urllib.request.urlopen(req, timeout=25)
        return r.getcode(), r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read().decode('utf-8', 'replace')
        except Exception:
            return e.code, ''
    except Exception as e:
        return 0, str(e)


def cle_anon():
    """La clé publique du CRM, lue dans la page servie — pas recopiée ici."""
    code, html = lire(BASE + '/crm/v2/index.html')
    m = re.search(r"SUPABASE_ANON_KEY\s*=\s*'([^']+)'", html or '')
    return m.group(1) if m else None


print('── Pages publiques ' + '─' * 40)

for chemin, quoi in [
        ('/crm/v2/index.html', 'le CRM répond'),
        ('/crm/v2/rdv.html', 'la page du pharmacien répond'),
        ('/r.html', 'la page des liens courts répond'),
        ('/404.html', 'le filet des adresses inconnues répond')]:
    code, _ = lire(BASE + chemin)
    if code == 200:
        dire_ok('%s (%s)' % (quoi, chemin))
    else:
        dire_ko('%s (%s)' % (quoi, chemin), 'HTTP %s' % code)


print('── Liens des commerciaux ' + '─' * 34)

# Les pages générées doivent toutes répondre. C'est le contrôle qui aurait
# attrapé le lien mort de Pascale.
code, index = lire(BASE + '/crm/v2/index.html')
noms = []
try:
    import os
    dossier = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'rdv')
    noms = sorted(f[:-5] for f in os.listdir(dossier) if f.endswith('.html'))
except Exception as e:
    dire_ko('lecture du dossier rdv/', str(e))

if not noms:
    dire_ko('liens des commerciaux', 'aucune page dans rdv/ — plus personne ne peut réserver')
for n in noms:
    code, _ = lire('%s/rdv/%s' % (BASE, n))
    if code == 200:
        dire_ok('/rdv/%s' % n)
    else:
        dire_ko('/rdv/%s' % n, 'HTTP %s' % code)

# Un prénom qui n'a PAS de page doit quand même atterrir sur la réservation :
# c'est le filet posé après l'incident. S'il tombe, un nouveau commercial se
# retrouve avec un lien mort sans que personne le sache.
code, html = lire(BASE + '/rdv/zzz-controle-automatique')
if 'crm/v2/rdv.html?p=' in (html or ''):
    dire_ok('un prénom sans page est quand même redirigé (filet)')
else:
    dire_ko('filet des prénoms sans page', 'la redirection a disparu du 404')


print('── Cohérence du cache ' + '─' * 37)

# ⚠️ Réécrit le 17/08/2026. L'ancienne règle exigeait « UN SEUL jeton partout »
# et échouait donc en permanence : ce robot a envoyé un mail d'échec deux fois
# par jour pendant 5 jours (13 → 17/08), toujours pour le même faux motif. Un
# voyant qui s'allume tous les jours sans qu'on puisse agir finit par être
# ignoré — y compris le jour où il a raison.
#
# La vérité, c'est qu'il y a TROIS jetons indépendants, et c'est voulu :
#   · `index.html` + `sw.js`  → l'appli du commercial. Ces deux-là DOIVENT
#     être identiques : c'est le vrai verrou anti-cache, cassé deux fois.
#   · `rdv.html`              → la page publique du pharmacien, qui a son
#     propre lot de scripts et se déploie séparément.
#   · `var V` de `v2-boot.js` → les gros fichiers de données. Le fichier dit
#     lui-même « pas besoin de le suivre à chaque déploiement : quand VER de
#     sw.js change, l'activation du service worker efface tous les caches. »
# Comparer les trois entre eux n'a aucun sens. On ne contrôle donc que ce qui
# doit vraiment coïncider, et on AFFICHE les autres sans échouer.
jetons = {}
for chemin, motif in [
        ('/crm/v2/index.html', r'\?v=(2026\d{4}[a-z])'),
        ('/crm/v2/rdv.html', r'\?v=(2026\d{4}[a-z])'),
        ('/crm/v2/sw.js', r"VER\s*=\s*'(2026\d{4}[a-z])'"),
        ('/crm/v2/v2-boot.js', r"var V = '\?v=(2026\d{4}[a-z])'")]:
    code, txt = lire(BASE + chemin)
    jetons[chemin] = set(re.findall(motif, txt or ''))

app = jetons['/crm/v2/index.html'] | jetons['/crm/v2/sw.js']
if not app:
    dire_ko('jeton de version de l’appli', 'introuvable dans index.html et sw.js')
elif len(app) == 1:
    dire_ok('l’appli et son service worker portent le même jeton (%s)' % list(app)[0])
else:
    dire_ko('l’appli et son service worker divergent',
            'index.html=%s, sw.js=%s — des navigateurs garderont l’ancienne version'
            % (sorted(jetons['/crm/v2/index.html']), sorted(jetons['/crm/v2/sw.js'])))

# Chaque page doit être cohérente AVEC ELLE-MÊME : tous les scripts d'une même
# page portent le même jeton, sinon la page mélange deux générations de code.
for chemin in ('/crm/v2/rdv.html',):
    v = jetons[chemin]
    if len(v) == 1:
        dire_ok('la page du pharmacien est homogène (%s)' % list(v)[0])
    elif not v:
        dire_ko('jeton de %s' % chemin, 'aucun jeton trouvé')
    else:
        dire_ko('la page du pharmacien mélange %d jetons' % len(v), str(sorted(v)))

for chemin in ('/crm/v2/v2-boot.js',):
    v = sorted(jetons[chemin])
    print('  ·    jeton des fichiers de données : %s (indépendant, par conception)'
          % (v[0] if v else 'introuvable'))

# ── Le vrai risque, celui que l'ancienne règle ne voyait pas ────
# `v2-rdv-creneaux.js` et `v2-rdv-ics.js` sont chargés par LES DEUX pages, avec
# des jetons différents. Si l'un d'eux est modifié sans que `rdv.html` soit
# re-versionné, les pharmaciens qui ont déjà visité la page continuent de faire
# tourner l'ANCIEN moteur de créneaux depuis leur cache, pendant que le
# commercial voit le nouveau. Les deux ne proposent alors plus les mêmes
# horaires, et rien ne le signale.
# Ce contrôle a besoin de l'historique Git : il ne tourne que si on l'a.
try:
    import subprocess

    racine = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def dernier_commit(chemin):
        # `-C racine` plutôt qu'un chdir : le reste du script garde son
        # répertoire courant, quoi qu'il arrive ici.
        r = subprocess.run(['git', '-C', racine, 'log', '-1', '--format=%ct', '--', chemin],
                           capture_output=True, text=True, timeout=20)
        s = (r.stdout or '').strip()
        return int(s) if s.isdigit() else None

    t_page = dernier_commit('crm/v2/rdv.html')
    partages = ['crm/v2/v2-rdv-creneaux.js', 'crm/v2/v2-rdv-ics.js', 'crm/v2/rdv-public.js']
    if t_page is None:
        print('  ·    historique Git indisponible — contrôle des modules partagés sauté')
    else:
        en_retard = []
        for f in partages:
            t = dernier_commit(f)
            if t is not None and t > t_page:
                en_retard.append(os.path.basename(f))
        if en_retard:
            dire_ko('la page du pharmacien n’a pas été re-versionnée',
                    '%s a/ont changé après elle — les pharmaciens gardent l’ancien '
                    'moteur en cache. Monter le ?v= de rdv.html.' % ', '.join(en_retard))
        else:
            dire_ok('les modules partagés avec la page du pharmacien sont à jour')
except Exception as e:
    print('  ·    contrôle des modules partagés impossible (%s) — non bloquant' % e)


print('── Le service de réservation ' + '─' * 30)

cle = cle_anon()
if not cle:
    dire_ko('clé publique introuvable', 'index.html ne la contient plus')
else:
    ent = {'apikey': cle, 'Authorization': 'Bearer ' + cle, 'Content-Type': 'application/json'}

    # Un jeton bidon doit être REFUSÉ proprement : si la base est muette ou en
    # erreur, on le voit ici plutôt que par un pharmacien.
    code, txt = poster(SB + '/rest/v1/rpc/rdv_fenetre',
                       {'p_token': '00000000-0000-4000-8000-000000000000'}, ent)
    if code == 200 and '"ok"' in txt:
        dire_ok('la base répond et refuse un lien inconnu')
    else:
        dire_ko('la base de réservation', 'HTTP %s — %s' % (code, (txt or '')[:120]))

    # Les prénoms doivent se traduire en lien valide.
    ouverts = []
    for n in noms:
        code, txt = poster(SB + '/rest/v1/rpc/rdv_slug_token', {'p_slug': n}, ent)
        try:
            d = json.loads(txt)
        except Exception:
            d = {}
        if code == 200 and d.get('ok'):
            dire_ok('le lien de %s est ouvert' % n)
            ouverts.append(n)
        elif code == 200 and d.get('raison') == 'ferme':
            dire_ok('le lien de %s est fermé (choix du commercial)' % n)
        else:
            dire_ko('le lien de %s' % n, 'HTTP %s — %s' % (code, (txt or '')[:120]))

    # ── LE CONTRÔLE QUI MANQUAIT ────────────────────────────────────
    # Jusqu'au 17/08/2026, ce robot s'arrêtait ici : il vérifiait qu'un lien
    # s'ouvre et que des créneaux existent, JAMAIS qu'on puisse réserver.
    # C'est précisément le trou par lequel est passée la panne du 13/08 —
    # `rdv_poser_public` écrivait une valeur que la table refusait, le
    # pharmacien voyait ses créneaux puis se faisait jeter, et tous les
    # contrôles restaient au vert pendant des semaines.
    #
    # `rdv_controle_reservation` rejoue le parcours ENTIER côté serveur :
    # elle réserve vraiment, puis retire sa propre ligne dans la même
    # transaction, sans réveiller personne (le déclencheur de notification
    # reconnaît la transaction de contrôle).
    print('── La réservation, pour de vrai ' + '─' * 27)

    if not ouverts:
        dire_ko('réservation de bout en bout', 'aucun lien ouvert à éprouver')

    for n in ouverts:
        code, txt = poster(SB + '/rest/v1/rpc/rdv_controle_reservation', {'p_slug': n}, ent)
        try:
            d = json.loads(txt)
        except Exception:
            d = {}

        if code != 200 or not isinstance(d, dict):
            dire_ko('réserver chez %s' % n, 'HTTP %s — %s' % (code, (txt or '')[:120]))
            continue

        if not d.get('ok'):
            dire_ko('réserver chez %s' % n,
                    'bloqué à l\'étape « %s » : %s' % (d.get('etape', '?'), d.get('raison', '?')))
            continue

        # ⚠️ Le cas le plus grave n'est PAS l'échec de réservation : c'est une
        # réservation réussie dont la sonde n'a pas été retirée. Un faux
        # rendez-vous dans l'agenda d'un commercial est pire que la panne
        # qu'on cherchait — il faut le voir tout de suite.
        if not d.get('menage'):
            dire_ko('MÉNAGE APRÈS CONTRÔLE (%s)' % n,
                    'un rendez-vous de contrôle est resté en base le %s — À SUPPRIMER À LA MAIN'
                    % d.get('reserve_le', '?'))
            continue

        dire_ok('un pharmacien peut réserver chez %s (créneau %s, %s essai(s), rien laissé)'
                % (n, d.get('reserve_le', '?'), d.get('essais', '?')))

    # Filet de sécurité indépendant : même si la fonction jure avoir fait le
    # ménage, on regarde. Un contrôle qui se contente de sa propre parole
    # n'est pas un contrôle.
    code, txt = lire(SB + '/rest/v1/rdv?select=id,date,heure&nom=eq.CONTROLE%20AUTOMATIQUE%20JARVIS',
                     entetes=ent)
    if code in (200, 401, 403):
        # 401/403 = la table est bien fermée à la clé publique : c'est sain,
        # et ça veut dire qu'on ne peut pas vérifier par ici. On ne condamne
        # rien sur une lecture qu'on n'a pas le droit de faire.
        if code == 200:
            try:
                restes = json.loads(txt)
            except Exception:
                restes = []
            if restes:
                dire_ko('sondes de contrôle oubliées', '%d rendez-vous « CONTROLE AUTOMATIQUE JARVIS » en base' % len(restes))
            else:
                dire_ok('aucune sonde de contrôle oubliée en base')
        else:
            dire_ok('la table des rendez-vous reste fermée à la clé publique')
    else:
        dire_ko('vérification des sondes', 'HTTP %s' % code)


print('')
print('═' * 58)
print('%d contrôle(s) au vert, %d en échec' % (len(oks), len(echecs)))
if echecs:
    print('')
    print('CE QUI NE MARCHE PAS :')
    for quoi, detail in echecs:
        print('  · %s : %s' % (quoi, detail))
    sys.exit(1)
print('La prise de rendez-vous est opérationnelle.')
sys.exit(0)

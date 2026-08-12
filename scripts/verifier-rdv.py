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


def lire(url, timeout=25):
    """Renvoie (code, texte). Ne lève jamais."""
    req = urllib.request.Request(url, headers=UA)
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

# Un jeton désynchronisé = des navigateurs qui gardent l'ancienne version sans
# que rien ne le signale. Vécu deux fois.
jetons = {}
for chemin, motif in [
        ('/crm/v2/index.html', r'\?v=(2026\d{4}[a-z])'),
        ('/crm/v2/rdv.html', r'\?v=(2026\d{4}[a-z])'),
        ('/crm/v2/sw.js', r"VER\s*=\s*'(2026\d{4}[a-z])'"),
        ('/crm/v2/v2-boot.js', r"var V = '\?v=(2026\d{4}[a-z])'")]:
    code, txt = lire(BASE + chemin)
    trouves = set(re.findall(motif, txt or ''))
    jetons[chemin] = trouves

tous = set()
for v in jetons.values():
    tous |= v
if len(tous) == 1:
    dire_ok('un seul jeton de version partout (%s)' % list(tous)[0])
else:
    dire_ko('jetons de version désynchronisés', str({k: sorted(v) for k, v in jetons.items()}))


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
    for n in noms:
        code, txt = poster(SB + '/rest/v1/rpc/rdv_slug_token', {'p_slug': n}, ent)
        try:
            d = json.loads(txt)
        except Exception:
            d = {}
        if code == 200 and d.get('ok'):
            dire_ok('le lien de %s est ouvert' % n)
        elif code == 200 and d.get('raison') == 'ferme':
            dire_ok('le lien de %s est fermé (choix du commercial)' % n)
        else:
            dire_ko('le lien de %s' % n, 'HTTP %s — %s' % (code, (txt or '')[:120]))


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

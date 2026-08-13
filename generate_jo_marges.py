#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_jo_marges.py — Veille JOURNAL OFFICIEL, côté ARGENT d'Intégral.

POURQUOI CE ROBOT EXISTE
------------------------
Le 11/08/2026, le JO publie l'arrêté du 3 août 2026 qui fait passer le plancher
de la marge grossiste de 0,30 € à 0,22 € au 20 janvier 2027 — environ 308 000 €
par an pour Intégral. « Infos du matin » ne l'a pas vu.

Vérifié le 13/08/2026, et c'est la leçon de conception :
  · aucun des trois flux professionnels (USPO, FSPF, Le Moniteur) ne l'a relayé.
    Ils couvrent l'économie de l'OFFICINE ; la marge du GROSSISTE n'est pas leur
    sujet. Attendre que la presse pharmacien parle du métier de Will ne marche pas.
  · le titre de l'arrêté ne contient NI « grossiste », NI « répartiteur », NI
    « distribution en gros ». Il dit « prix et marges des médicaments remboursables ».
    Une liste de mots-clés écrite en vocabulaire métier passe à côté ; il faut le
    vocabulaire JURIDIQUE.

SOURCE
------
Open data DILA du Journal officiel : https://echanges.dila.gouv.fr/OPENDATA/JORF/
Gratuit, sans clé, sans compte. Une archive par édition (~6 Mo).

SORTIE
------
crm/v2/jo-marges.json — les textes retenus, avec leur date d'effet quand elle est
lisible, pour que l'app puisse afficher un compte à rebours au lieu d'une actu qui
disparaît au bout de 7 jours. Une réforme applicable dans 5 mois n'est pas une
nouvelle du jour : c'est une échéance.

⚠️ Le fichier de sortie est CUMULATIF : on relit l'existant et on fusionne. Un robot
qui réécrit sa sortie de zéro perd sa mémoire dès que la source ne garde pas
l'historique (piège déjà payé trois fois sur ce Mac).
"""

import json
import os
import re
import html
import sys
import tarfile
import io
import urllib.request
import datetime as dt

BASE = 'https://echanges.dila.gouv.fr/OPENDATA/JORF/'
SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm', 'v2', 'jo-marges.json')
UA = {'User-Agent': 'Mozilla/5.0 (veille JARVIS, usage interne)'}
JOURS_DEFAUT = 8          # marge de sécurité : le JO d'un jour peut arriver le lendemain
LIEN = 'https://www.legifrance.gouv.fr/jorf/id/'

# ── Ce qui touche l'argent d'un grossiste-répartiteur ────────────────────────
# Écrit en vocabulaire JURIDIQUE, pas en vocabulaire métier. Chaque motif est
# accompagné de ce qu'il attrape, pour qu'on puisse en retirer un sans deviner.
MOTIFS = [
    (r"prix et (?:aux )?marges des m[ée]dicaments", "arrêté prix & marges (le texte de 1987 qui fixe la marge grossiste)"),
    (r"marges? de distribution",                    "marge de distribution"),
    (r"distribution en gros",                       "distribution en gros"),
    (r"grossistes?[- ]r[ée]partiteurs?",            "grossiste-répartiteur"),
    (r"\br[ée]partiteurs?\b",                       "répartiteur"),
    (r"arr[êe]t[ée] du 4 ao[ûu]t 1987",             "modification de l'arrêté fondateur de 1987"),
    (r"honoraires? de dispensation",                "honoraire de dispensation"),
    (r"clause de sauvegarde",                       "clause de sauvegarde"),
    (r"contribution.{0,40}chiffre d'affaires.{0,40}(?:grossistes|r[ée]partiteurs)", "contribution sur le CA"),
    (r"L\.? ?138-9\b",                              "plafond des remises (L.138-9)"),
    (r"L\.? ?162-16-6\b",                           "prix des spécialités (L.162-16-6)"),
    (r"tarif forfaitaire de responsabilit[ée]",      "tarif forfaitaire de responsabilité (TFR)"),
]
MOTIFS = [(re.compile(p, re.I), quoi) for p, quoi in MOTIFS]

# On ne veut PAS des avis de prix produit par produit : il en tombe des centaines
# par mois, ils ont déjà leur propre robot (`prix.yml`), et ils noieraient le signal.
EXCLUS = re.compile(r"^avis relatif aux prix de sp[ée]cialit[ée]s pharmaceutiques", re.I)

MOIS = {'janvier': 1, 'février': 2, 'fevrier': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
        'juillet': 7, 'août': 8, 'aout': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11,
        'décembre': 12, 'decembre': 12}


def fetch(url, timeout=120):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()


def texte_brut(xml):
    return html.unescape(re.sub(r'<[^>]+>', ' ', xml))


def date_effet(txt, apres=None):
    """Cherche une date d'application. Rend None si rien de sûr — on n'invente pas.

    ⚠️ Un texte cite d'autres dates que la sienne. Sur l'arrêté du 3 août 2026, la
    première trouvée était le 27 mai 2026 : une date CITÉE, antérieure à la publication.
    Règle : une date d'application ne peut pas précéder la parution au JO. On ne garde
    donc que les dates postérieures, et parmi elles la plus proche.
    """
    trouvees = []
    for m in re.finditer(r"(?:compter du|en vigueur le|applicables? (?:au|le)|[àa] partir du)\s+"
                         r"(\d{1,2})(?:er)?\s+([a-zéûA-Zéû]+)\s+(\d{4})", txt, re.I):
        mois = MOIS.get(m.group(2).lower())
        if not mois:
            continue
        try:
            d = dt.date(int(m.group(3)), mois, int(m.group(1))).isoformat()
        except ValueError:
            continue
        if apres and d < apres:
            continue
        trouvees.append(d)
    return min(trouvees) if trouvees else None


def resume_bareme(txt):
    """Si le texte porte un barème de marge de la vente en gros, on en extrait les
    chiffres — c'est ça qui parle à un commercial, pas l'intitulé juridique.
    Rend None si on ne lit pas les trois valeurs : mieux vaut ne rien dire qu'à peu près."""
    if not re.search(r"vend en gros", txt, re.I):
        return None
    m = re.search(r"([\d,]+)\s*(?:avec un )?minimum de\s*([\d,]+)\s*€.{0,40}?plafond de\s*([\d,]+)\s*€", txt, re.I | re.S)
    if not m:
        return None
    return ("Marge grossiste : %s %% du prix fabricant, minimum %s € par boîte, plafond %s €."
            % (m.group(1).replace('0,0', '').rstrip(), m.group(2), m.group(3))) \
        if False else ("Nouveau barème de la marge grossiste : minimum %s € par boîte, plafond %s €."
                       % (m.group(2), m.group(3)))


def archives_recentes(jours):
    """Liste les archives JORF des N derniers jours."""
    page = fetch(BASE, timeout=60).decode('utf-8', 'replace')
    noms = sorted(set(re.findall(r'JORF_(\d{8}-\d{6})\.tar\.gz', page)))
    limite = (dt.date.today() - dt.timedelta(days=jours)).strftime('%Y%m%d')
    return [n for n in noms if n[:8] >= limite]


def scanner(stamp, plancher):
    """Ouvre une archive en mémoire et rend les textes qui nous concernent."""
    brut = fetch(BASE + 'JORF_%s.tar.gz' % stamp)
    trouves = {}
    # La fiche d'un texte ne contient que ses métadonnées : le contenu réel (et donc la
    # date d'application, écrite dans l'annexe de barème) vit dans des fichiers d'ARTICLES
    # rangés sous le MÊME chemin numéroté. On les collecte au passage pour les rattacher.
    articles = {}
    with tarfile.open(fileobj=io.BytesIO(brut), mode='r:gz') as tar:
        for membre in tar:
            if membre.isfile() and '/ARTI/' in membre.name and membre.name.endswith('.xml'):
                try:
                    a = tar.extractfile(membre).read().decode('utf-8', 'replace')
                except Exception:
                    continue
                cle = '/'.join(membre.name.split('/ARTI/')[1].split('/')[:-1])
                articles.setdefault(cle, []).append(texte_brut(a))
    with tarfile.open(fileobj=io.BytesIO(brut), mode='r:gz') as tar:
        for membre in tar:
            if not membre.isfile() or not membre.name.endswith('.xml'):
                continue
            try:
                xml = tar.extractfile(membre).read().decode('utf-8', 'replace')
            except Exception:
                continue
            # Le titre vit tantôt dans TITREFULL, tantôt dans TITRE_TXT.
            mt = re.search(r'<TITREFULL[^>]*>(.*?)</TITREFULL>', xml, re.S) \
                or re.search(r'<TITRE_TXT[^>]*>(.*?)</TITRE_TXT>', xml, re.S)
            if not mt:
                continue
            titre = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', mt.group(1)))).strip()
            if not titre or EXCLUS.match(titre):
                continue
            # ⚠️ Le filtre décisif. Une édition du JO ne contient pas que ses textes du
            # jour : elle republie aussi les versions consolidées des textes modifiés.
            # Sans ce garde-fou on remontait la loi sur la copropriété de 1965 et la LFSS
            # 1999, qui citent bien nos mots-clés — mais qui ne sont pas des nouvelles.
            mdp = re.search(r'<DATE_PUBLI>(\d{4}-\d{2}-\d{2})</DATE_PUBLI>', xml)
            if not mdp or mdp.group(1) < plancher:
                continue
            plein = texte_brut(xml)
            # Le motif affiché doit décrire CE texte. Un texte qui se contente de citer
            # l'arrêté de 1987 ne parle pas forcément des marges : on privilégie donc ce
            # que dit son TITRE, et on ne retombe sur le corps que s'il ne dit rien.
            par_titre = [quoi for rx, quoi in MOTIFS if rx.search(titre)]
            motifs = par_titre or [quoi for rx, quoi in MOTIFS if rx.search(plein)]
            if not motifs:
                continue
            mid = re.search(r'(JORFTEXT\d+)', membre.name) or re.search(r'(JORFTEXT\d+)', xml)
            cle = mid.group(1) if mid else titre[:90]
            if cle in trouves:
                continue
            trouves[cle] = {
                'id': cle,
                'titre': titre,
                'url': (LIEN + cle) if cle.startswith('JORFTEXT') else None,
                'jo': mdp.group(1),
                'signe_le': (re.search(r'<DATE_TEXTE>(\d{4}-\d{2}-\d{2})</DATE_TEXTE>', xml) or [None, None])[1]
                            if re.search(r'<DATE_TEXTE>(\d{4}-\d{2}-\d{2})</DATE_TEXTE>', xml) else None,
                'motifs': sorted(set(motifs)),
                'resume': resume_bareme(' '.join(articles.get('/'.join(membre.name.split('/TEXT/')[1].split('/')[:-1]), []))
                                        if '/TEXT/' in membre.name else ''),
                'date_effet': date_effet(plein, mdp.group(1)) or date_effet(
                    ' '.join(articles.get('/'.join(membre.name.split('/TEXT/')[1].split('/')[:-1]), []))
                    if '/TEXT/' in membre.name else '', mdp.group(1)),
            }
    return list(trouves.values())


def main():
    jours = int(sys.argv[1]) if len(sys.argv) > 1 else JOURS_DEFAUT

    # Mémoire : on repart de ce qui existe, on n'écrase jamais.
    anciens = {}
    if os.path.exists(SORTIE):
        try:
            for it in json.load(open(SORTIE, encoding='utf-8')).get('items', []):
                anciens[it['id']] = it
        except Exception as e:
            print('[jo] lecture de l\'existant impossible (%s) — on continue sans' % e)
    print('[jo] %d texte(s) déjà connus' % len(anciens))

    plancher = (dt.date.today() - dt.timedelta(days=jours)).isoformat()
    stamps = archives_recentes(jours)
    print('[jo] %d édition(s) à lire sur %d jours' % (len(stamps), jours))
    neufs = 0
    for s in stamps:
        try:
            for it in scanner(s, plancher):
                if it['id'] not in anciens:
                    neufs += 1
                    print('[jo] NOUVEAU · %s · %s' % (it['jo'], it['titre'][:90]))
                anciens[it['id']] = it
        except Exception as e:
            print('[jo] édition %s ignorée : %s' % (s, e))

    items = sorted(anciens.values(), key=lambda x: (x.get('jo') or ''), reverse=True)
    # On garde en tête ce qui n'est pas encore applicable : c'est ça qui compte.
    today = dt.date.today().isoformat()
    for it in items:
        it['a_venir'] = bool(it.get('date_effet') and it['date_effet'] > today)

    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    json.dump({
        'generated_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'source': 'Journal officiel · open data DILA',
        'count': len(items),
        'items': items,
    }, open(SORTIE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('[jo] %s · %d texte(s) au total, %d nouveau(x)' % (SORTIE, len(items), neufs))


if __name__ == '__main__':
    main()

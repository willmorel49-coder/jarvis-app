#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Etape 2 — lire l'adresse mail sur le site de l'officine (passe legere, sans navigateur).

Pourquoi pas Playwright tout de suite : la grande majorite des sites d'officines
sont du HTML statique. Un simple appel HTTP les lit en 200 ms la ou un navigateur
met 3 s. Playwright (etape 3) ne sert QUE pour ce que cette passe n'a pas su lire.

Regles de politesse, non negociables :
  - on se presente (User-Agent explicite avec un moyen de nous joindre) ;
  - on respecte robots.txt ;
  - une seule visite par domaine a la fois, avec une pause ;
  - on ne lit que des pages de contact publiques, rien d'autre.

Entree : scripts/mails/osm.json
Sortie : scripts/mails/sites.json  (cip -> {email, source})
Compatible Python 3.9.
"""
import json
import re
import signal
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from pathlib import Path

ICI = Path(__file__).resolve().parent
UA = "JARVIS-IntegralPharma/1.0 (annuaire officines; contact via integralpharma.fr)"
PAUSE_S = 1.5
TIMEOUT = 15

CHEMINS = ["", "/contact", "/nous-contacter", "/contactez-nous",
           "/mentions-legales", "/mentions", "/infos-pratiques", "/la-pharmacie"]

RX_MAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# adresses de prestataires, jamais celles de l'officine
REJET = re.compile(r"(sentry|wixpress|example|sentry\.io|@2x|\.png|\.jpg|\.gif|\.svg|"
                   r"godaddy|wordpress|squarespace|cloudflare|jimdo|weebly|shopify|"
                   r"webmaster@|noreply|no-reply|donotreply)", re.I)


# ⚠️ UNE LIMITE DE TEMPS PAR SITE, ET ELLE EST INDISPENSABLE.
# Mesure du 21/08/2026 : le script a tourne 34 minutes sur 21 sites, puis
# 10 de plus sans avancer d'un seul. Le `timeout=` d'urlopen ne couvre QUE
# les operations de socket — un serveur qui repond au compte-gouttes tient la
# lecture du corps ouverte indefiniment. Et `RobotFileParser.read()` n'avait,
# lui, aucun delai du tout.
# `signal.alarm` coupe le site entier, quoi qu'il fasse. Unix uniquement, ce
# qui est le cas ici comme en CI.
# ⚠️ BaseException, PAS Exception. `robots_ok` et `lire` finissent toutes
# deux par `except Exception: ...` — une alarme qui hérite d'Exception s'y
# fait avaler, le reveil est consomme, et le site continue de bloquer comme
# si de rien n'etait. Mesure : 45 s sans une seule ligne de progression.
class TropLong(BaseException):
    pass


def _sonner(signum, frame):
    raise TropLong()


class limite_de_temps(object):
    """with limite_de_temps(25): ... — leve TropLong au-dela."""

    def __init__(self, secondes):
        self.s = secondes

    def __enter__(self):
        self.avant = signal.signal(signal.SIGALRM, _sonner)
        signal.alarm(self.s)

    def __exit__(self, *a):
        signal.alarm(0)
        signal.signal(signal.SIGALRM, self.avant)
        return False


def robots_ok(base, chemin):
    """robots.txt fait foi. En cas de doute (fichier illisible), on s'autorise
    la page d'accueil et de contact : ce sont des pages publiques de contact.

    ⚠️ ON NE PASSE PLUS PAR rp.read(). Mesuré le 21/08/2026 : la methode de la
    bibliotheque standard appelle urlopen SANS delai maximum. Un serveur qui
    accepte la connexion et ne repond jamais bloque le script pour toujours —
    il a tourne 34 minutes sur 21 sites, sans une seule connexion ouverte,
    avant qu'on comprenne. On lit le fichier soi-meme, avec un delai, et on
    le donne a parse()."""
    try:
        r = urllib.request.Request(urllib.parse.urljoin(base, "/robots.txt"),
                                   headers={"User-Agent": UA})
        with urllib.request.urlopen(r, timeout=TIMEOUT) as rep:
            texte = rep.read(65536).decode("utf-8", "replace")
    except Exception:
        return True                      # illisible : on s'autorise le contact
    try:
        rp = urllib.robotparser.RobotFileParser()
        rp.parse(texte.splitlines())
        return rp.can_fetch(UA, urllib.parse.urljoin(base, chemin or "/"))
    except Exception:
        return True


def lire(url):
    try:
        r = urllib.request.Request(url, headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "fr-FR,fr;q=0.9",
        })
        with urllib.request.urlopen(r, timeout=TIMEOUT) as rep:
            ct = (rep.headers.get("Content-Type") or "").lower()
            if "html" not in ct and "text" not in ct:
                return ""
            brut = rep.read(600000)
        for enc in ("utf-8", "latin-1"):
            try:
                return brut.decode(enc)
            except UnicodeDecodeError:
                continue
        return brut.decode("utf-8", "replace")
    except Exception:
        return ""


def extraire(html, domaine):
    """Adresses trouvees, la plus credible d'abord (mailto:, puis meme domaine)."""
    if not html:
        return []
    trouves = []
    for m in re.findall(r'mailto:([^"\'>?\s]+)', html, re.I):
        trouves.append(urllib.parse.unquote(m))
    trouves += RX_MAIL.findall(html)
    vus, out = set(), []
    for e in trouves:
        e = e.strip().strip(".,;:").lower()
        if not RX_MAIL.fullmatch(e) or REJET.search(e) or e in vus:
            continue
        vus.add(e)
        out.append(e)
    # une adresse au meme domaine que le site est presque toujours la bonne
    d = (domaine or "").replace("www.", "")
    out.sort(key=lambda e: 0 if d and e.endswith("@" + d) else 1)
    return out


def main():
    src = ICI / "osm.json"
    if not src.exists():
        print("Lance d'abord 1-osm.py")
        return 1
    osm = json.loads(src.read_text(encoding="utf-8"))

    sortie = ICI / "sites.json"
    faits = json.loads(sortie.read_text(encoding="utf-8")) if sortie.exists() else {}

    a_faire = [(cip, v["site"]) for cip, v in osm.items()
               if v.get("site") and not v.get("email") and cip not in faits]
    print("%d sites a lire (%d deja traites)" % (len(a_faire), len(faits)))

    n_ok = 0
    for i, (cip, site) in enumerate(a_faire, 1):
        if not site.startswith("http"):
            site = "https://" + site
        p = urllib.parse.urlparse(site)
        base = "%s://%s" % (p.scheme, p.netloc)
        domaine = p.netloc.lower()

        mail, source = "", ""
        # Un site entier ne bloque pas la liste : au-dela de 25 s toutes pages
        # confondues, on passe. Une officine muette coute moins cher qu'un
        # script qui ne finit jamais.
        try:
            with limite_de_temps(25):
                for chemin in CHEMINS:
                    if not robots_ok(base, chemin):
                        continue
                    url = base + chemin if chemin else site
                    adresses = extraire(lire(url), domaine)
                    if adresses:
                        mail, source = adresses[0], url
                        break
                    time.sleep(0.4)
        except TropLong:
            mail, source = "", ""

        faits[cip] = {"email": mail, "source": source, "site": site}
        if mail:
            n_ok += 1
        print("  %3d/%3d %-42s %s" % (i, len(a_faire), domaine[:42], mail or "—"))
        sortie.write_text(json.dumps(faits, ensure_ascii=False, indent=1), encoding="utf-8")
        time.sleep(PAUSE_S)

    verif = json.loads(sortie.read_text(encoding="utf-8"))
    avec = sum(1 for v in verif.values() if v.get("email"))
    print("\nRESULTAT : %d adresses lues sur %d sites visites" % (avec, len(verif)))
    print("  %d sites muets -> etape 3 (navigateur) si ca vaut le coup" % (len(verif) - avec))
    return 0


if __name__ == "__main__":
    sys.exit(main())

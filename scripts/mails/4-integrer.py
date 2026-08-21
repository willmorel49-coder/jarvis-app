#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Etape 4 — consolider les trouvailles dans un jeu de donnees du CRM.

Fusionne, par ordre de confiance :
  1. sites.json      — adresse lue sur le site officiel de l'officine (passe HTTP)
  2. navigateur.json — idem, mais rendu par un vrai navigateur (Playwright)
  3. osm.json        — adresse renseignee dans OpenStreetMap

Sortie : crm/v2/mails-complement-data.js  (convention <sujet>-data.js)
Le CRM le lit comme une source de repli, apres CLIENTS et avant PHARMA_FR.

⚠️ Apres regeneration, monter le jeton de l'APP (index.html + sw.js), sinon le
   cache ressert l'ancien fichier. Verifie le 21/08/2026 : `mails-complement-data.js`
   est charge par index.html avec le jeton de l'app, PAS par le chargeur paresseux
   de v2-boot.js — la consigne d'origine visait le mauvais jeton.
Compatible Python 3.9.
"""
import json
import re
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent.parent
SORTIE = RACINE / "crm" / "v2" / "mails-complement-data.js"
RX_MAIL = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def charger(nom):
    f = ICI / nom
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}



# ═══════════════════════════════════════════════════════════════
#  LE FILTRE — ce qui ressemble a une adresse et n'en est pas une
# ═══════════════════════════════════════════════════════════════
# Mesure du 21/08/2026 sur 88 adresses ramassees : QUATRE auraient fait
# ecrire a la mauvaise personne, et RX_MAIL les acceptait toutes.
#   · email@domaine.com, monadresse@email.com — exemples laisses dans un gabarit
#   · 5e227d…@exceptions.doctolib.fr — une adresse technique d'un prestataire
#   · assistance@mypharmactiv.fr — le support d'un editeur de logiciel
#   · loustanauveigne@perso.alliadis.net attribuee a DEUX officines
#   · contact@pharmacie.me;pharmacie…@giphar.fr — deux adresses collees
#
# Un mail qui part au mauvais destinataire coute plus cher qu'une officine
# sans adresse : le pharmacien ne le lit pas, et celui qui le recoit se
# demande qui nous sommes. On jette au moindre doute.
#
# ⚠️ On ne jette PAS les domaines de groupement (giphar.fr, offisecure.com,
# perso.alliadis.net) : c'est la boite de l'officine chez son editeur, et
# chaque officine y a la sienne. Seule l'adresse EN DOUBLE est suspecte.

RX_GABARIT = re.compile(
    r"@(domaine|example|exemple|test|monsite|votresite|email|mail)\.|"
    r"^(email|mail|nom|prenom|votre|mon)(adresse)?@", re.I)

# Prestataires : leur adresse figure sur le site de l'officine, mais elle ne
# mene pas au pharmacien.
DOMAINES_TIERS = (
    "doctolib.fr", "mypharmactiv.fr", "wixpress.com", "sentry.io",
    "sitew.com", "wordpress.com", "googlemail.com",
)

# Boites de service d'un prestataire, jamais celles d'une officine.
LOCAUX_TIERS = ("assistance", "support", "webmaster", "noreply", "no-reply",
                "postmaster", "abuse", "privacy", "rgpd", "dpo")


def adresse_douteuse(mail):
    """Renvoie la raison du rejet, ou '' si l'adresse est acceptable."""
    if ";" in mail or "," in mail or " " in mail:
        return "plusieurs adresses collees"
    if RX_GABARIT.search(mail):
        return "exemple de gabarit"
    local, _, domaine = mail.partition("@")
    if any(domaine == d or domaine.endswith("." + d) for d in DOMAINES_TIERS):
        return "domaine d'un prestataire, pas de l'officine"
    if local in LOCAUX_TIERS:
        return "boite de service, pas celle du pharmacien"
    # 32 caracteres hexadecimaux : un identifiant technique, pas un nom.
    if re.fullmatch(r"[0-9a-f]{16,}", local):
        return "identifiant technique"
    return ""


def main():
    sites = charger("sites.json")
    navig = charger("navigateur.json")
    osm = charger("osm.json")

    # Premier passage : on rassemble, on filtre, et on COMPTE les rejets —
    # un filtre muet finit par jeter la moitie du fichier sans qu'on le sache.
    candidats, rejets = {}, {}
    for source, jeu, champ in (("site", sites, "email"),
                               ("site", navig, "email"),
                               ("osm", osm, "email")):
        for cip, v in jeu.items():
            mail = (v.get(champ) or "").strip().lower()
            if not mail or not RX_MAIL.match(mail):
                continue
            raison = adresse_douteuse(mail)
            if raison:
                rejets.setdefault(raison, []).append("%s %s" % (cip, mail))
                continue
            candidats.setdefault(cip, (mail, source))

    # ⚠️ UNE MEME ADRESSE POUR DEUX OFFICINES : l'une des deux est fausse, et
    # rien ne dit laquelle. On les jette TOUTES LES DEUX — ecrire au hasard a
    # l'une des deux serait pire que de n'ecrire a aucune.
    vus = {}
    for cip, (mail, _) in candidats.items():
        vus.setdefault(mail, []).append(cip)
    for mail, cips in vus.items():
        if len(cips) > 1:
            rejets.setdefault("meme adresse pour plusieurs officines", []).append(
                "%s -> %s" % (mail, ", ".join(cips)))
            for c in cips:
                candidats.pop(c, None)

    fiches = {}
    for cip, (mail, source) in candidats.items():
        fiches[cip] = {"email": mail, "source": source}

    if rejets:
        print("Adresses ecartees :")
        for raison, liste in sorted(rejets.items()):
            print("  %-44s %d" % (raison, len(liste)))
            for x in liste[:3]:
                print("      %s" % x)

    # les telephones trouves au passage : c'est cadeau, on les garde
    for cip, v in osm.items():
        tel = re.sub(r"[^0-9+]", "", v.get("tel") or "")
        if len(tel) >= 9:
            fiches.setdefault(cip, {})["tel"] = tel
            fiches[cip].setdefault("source", "osm")

    fiches = {k: v for k, v in fiches.items() if v.get("email") or v.get("tel")}

    lignes = [
        "// Complement d'annuaire officines — e-mails et telephones retrouves",
        "// Sources : site officiel de l'officine (lu publiquement) + OpenStreetMap (ODbL).",
        "// Genere par scripts/mails/4-integrer.py — ne pas editer a la main.",
        "// %d officines complementees." % len(fiches),
        "window.MAILS_COMPLEMENT = {",
    ]
    for cip in sorted(fiches):
        v = fiches[cip]
        bouts = []
        if v.get("email"):
            bouts.append('email:"%s"' % v["email"])
        if v.get("tel"):
            bouts.append('tel:"%s"' % v["tel"])
        bouts.append('src:"%s"' % v.get("source", "?"))
        lignes.append('  "%s":{%s},' % (cip, ",".join(bouts)))
    lignes.append("};")
    SORTIE.write_text("\n".join(lignes) + "\n", encoding="utf-8")

    # le generateur relit ce qu'il a ecrit avant de dire que c'est fait
    relu = SORTIE.read_text(encoding="utf-8")
    n_mail = relu.count('email:"')
    n_tel = relu.count('tel:"')
    print("ecrit : %s" % SORTIE.relative_to(RACINE))
    print("  officines complementees : %d" % len(fiches))
    print("  dont e-mail             : %d" % n_mail)
    print("  dont telephone          : %d" % n_tel)
    if len(fiches) and 'window.MAILS_COMPLEMENT = {' not in relu:
        print("  ERREUR : le fichier relu ne contient pas la declaration attendue")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

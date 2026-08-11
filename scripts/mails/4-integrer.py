#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Etape 4 — consolider les trouvailles dans un jeu de donnees du CRM.

Fusionne, par ordre de confiance :
  1. sites.json      — adresse lue sur le site officiel de l'officine (passe HTTP)
  2. navigateur.json — idem, mais rendu par un vrai navigateur (Playwright)
  3. osm.json        — adresse renseignee dans OpenStreetMap

Sortie : crm/v2/mails-complement-data.js  (convention <sujet>-data.js)
Le CRM le lit comme une source de repli, apres CLIENTS et avant PHARMA_FR.

⚠️ Apres regeneration, monter le jeton des donnees lazy dans v2-boot.js
   (`var V = '?v=...'`), sinon le cache ressert l'ancien fichier.
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


def main():
    sites = charger("sites.json")
    navig = charger("navigateur.json")
    osm = charger("osm.json")

    fiches = {}
    for source, jeu, champ in (("site", sites, "email"),
                               ("site", navig, "email"),
                               ("osm", osm, "email")):
        for cip, v in jeu.items():
            mail = (v.get(champ) or "").strip().lower()
            if not mail or not RX_MAIL.match(mail):
                continue
            fiches.setdefault(cip, {"email": mail, "source": source})

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

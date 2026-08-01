#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_national.py — MODÈLE NATIONAL d'anticipation (aucune donnée Intégral).

Fusionne trois flux publics déjà en place en une fiche par médicament :
  Open Medic     → volume France (boîtes remboursées / an)
  Medic'AM       → profil saisonnier mensuel (indice, 1.0 = moyenne annuelle)
  Table pivot    → molécule (DCI), existence d'un groupe générique

Raison d'être : l'anticipation d'APPRO était adossée aux données d'Intégral et héritait
de leurs défauts (stock arrêté au 01/06, 801 références jamais inventoriées, dernier mois
d'export partiel). Ici la demande et la saison viennent du marché français, toujours
complet et à jour. Le stock d'Intégral n'intervient que plus tard, côté application, pour
mesurer un écart.

⚠️ GARANTIE : ce robot n'ouvre AUCUN fichier Intégral (test t8-independance.py).

Écrit crm/v2/national.json. Python 3.9, bibliothèque standard seule. Aucune clé.
"""
import io
import os
import json
import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.join(HERE, "crm", "v2")
OUT = os.path.join(V2, "national.json")
MINI_BOITES = int(os.environ.get("NAT_MINI", "1000"))   # sous ce volume France : du bruit


def charger(nom):
    """Bloc `data` d'un fichier du dossier crm/v2, ou {} si absent/illisible."""
    try:
        with io.open(os.path.join(V2, nom), "r", encoding="utf-8") as f:
            return json.load(f).get("data") or {}
    except Exception:
        return {}


def fusionner(openmedic, saison, pivot, mini_boites=MINI_BOITES):
    """{cip13: {v, s[12], d, g}} — profil plat quand la saison est inconnue."""
    out = {}
    for cip, vol in openmedic.items():
        try:
            v = int(vol)
        except Exception:
            continue
        if v < mini_boites:
            continue
        s = (saison.get(cip) or {}).get("i")
        if not s or len(s) != 12:
            s = [1.0] * 12
        p = pivot.get(cip) or {}
        out[cip] = {
            "v": v,
            "s": [round(float(x), 2) for x in s],
            "d": (p.get("dci") or "")[:60],
            "g": 1 if p.get("grp") is not None else 0,
        }
    return out


def ecrire_si_complet(chemin, nouveau, seuil=0.8):
    """Jamais d'écrasement par du vide (même garde que generate_medicam_saison.py)."""
    n_new = len(nouveau.get("data") or {})
    n_old = 0
    try:
        with io.open(chemin, "r", encoding="utf-8") as f:
            n_old = len(json.load(f).get("data") or {})
    except Exception:
        n_old = 0
    if n_old and n_new < seuil * n_old:
        print("REFUS D'ECRIRE : %d entrees contre %d precedemment (< %d %%). "
              "Fichier precedent conserve." % (n_new, n_old, int(seuil * 100)))
        return False
    with io.open(chemin, "w", encoding="utf-8") as f:
        json.dump(nouveau, f, ensure_ascii=False, separators=(",", ":"))
    return True


def main():
    om = charger("openmedic.json")
    sai = charger("saison-cip.json")
    piv = charger("pivot.json")
    if not om:
        print("ABANDON : openmedic.json vide ou absent — modele non regenere.")
        raise SystemExit(1)

    data = fusionner(om, sai, piv)
    avec_saison = sum(1 for x in data.values() if x["s"] != [1.0] * 12)
    avec_dci = sum(1 for x in data.values() if x["d"])
    out = {
        "generated": datetime.date.today().isoformat(),
        "source": "Open Medic + Medic'AM + BDPM (marché français, sans donnée Intégral)",
        "n": len(data), "avecSaison": avec_saison, "avecDci": avec_dci,
        "data": data,
    }
    if not ecrire_si_complet(OUT, out):
        raise SystemExit(1)
    print("OK · %d medicaments modelises · %d avec profil saisonnier · %d avec molecule"
          % (len(data), avec_saison, avec_dci))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

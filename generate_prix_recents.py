#!/usr/bin/env python3
"""
Prix RÉELLEMENT facturés récemment, par CIP13 — la source la plus fraîche
pour le PPHT et le net IP.

Lit les fichiers de ventes des commerciaux (STATS/<PREFIXE>_<MM>_<AAAA>.xlsx :
une ligne par produit facturé, avec PLVPUBRUT = PPHT et PLVPUNET = net IP)
sur les 3 derniers mois présents, et garde pour chaque CIP13 :
  - le PPHT le plus fréquent à la date de facture la plus récente,
  - le net IP le plus fréquent parmi les lignes à ce PPHT (= la condition
    standard, pas les quelques remises particulières),
  - la date de la dernière facture, le nombre de lignes, le labo facturé.

Sortie : STATS/prix-recents.json (dossier STATS ignoré par git — ce fichier
porte des prix nets, il ne part JAMAIS dans le dépôt public).
Consommé par generate-biosimilaires.js. Aucune dépendance hors openpyxl.

    /usr/bin/python3 generate_prix_recents.py
"""
import collections
import glob
import json
import os
import re
import warnings

warnings.filterwarnings("ignore")
import openpyxl  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
STATS = os.path.join(ROOT, "STATS")
OUT = os.path.join(STATS, "prix-recents.json")
NB_MOIS = 3
COLS = ("ARTCODEBARRE", "PCVDATEEFFET", "PLVPUBRUT", "PLVPUNET")

# Mois disponibles (tous commerciaux confondus), les NB_MOIS plus récents.
mois = collections.defaultdict(list)
for f in glob.glob(os.path.join(STATS, "*_[0-9][0-9]_20[0-9][0-9].xlsx")):
    m = re.search(r"_(\d\d)_(\d{4})\.xlsx$", f)
    if m:
        mois[m.group(2) + "-" + m.group(1)].append(f)
retenus = sorted(mois)[-NB_MOIS:]
fichiers = sorted(f for k in retenus for f in mois[k])
print("→ mois retenus :", ", ".join(retenus), "·", len(fichiers), "fichiers")

# cip13 -> liste de (date ISO, ppht, net, labo, désignation)
lignes = collections.defaultdict(list)
for f in fichiers:
    wb = openpyxl.load_workbook(f, read_only=True)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    hdr = [str(h) for h in next(it)]
    ix = {h: i for i, h in enumerate(hdr)}
    if not all(c in ix for c in COLS):
        print("  ⚠ colonnes absentes, fichier ignoré :", os.path.basename(f))
        wb.close()
        continue
    n = 0
    for r in it:
        cb, d, ppht, net = (r[ix[c]] for c in COLS)
        if cb is None or d is None or ppht is None or net is None:
            continue
        try:
            ppht = round(float(ppht), 2)
            net = round(float(net), 2)
        except (TypeError, ValueError):
            continue
        if ppht <= 0 or net <= 0:
            continue
        cb = str(cb).strip()
        if not re.fullmatch(r"\d{13}", cb):
            continue
        labo = r[ix["ARTCOLLECTION"]] if "ARTCOLLECTION" in ix else None
        desig = r[ix["PLVDESIGNATION"]] if "PLVDESIGNATION" in ix else None
        date = d.date().isoformat() if hasattr(d, "date") else str(d)[:10]
        lignes[cb].append((date, ppht, net,
                           str(labo) if labo and str(labo) != "#N/A" else "",
                           str(desig or "")))
        n += 1
    wb.close()
    print("  %-22s %6d lignes" % (os.path.basename(f), n))

data = {}
for cb, L in lignes.items():
    derniere = max(x[0] for x in L)
    # PPHT : le plus fréquent sur le DERNIER MOIS facturé (tarif en vigueur).
    # Pas la dernière date seule : quand un tarif baisse (Eylea en juin 2026),
    # quelques factures gardent l'ancien prix pendant des semaines.
    au_dernier = [x for x in L if x[0][:7] == derniere[:7]]
    ppht = collections.Counter(x[1] for x in au_dernier).most_common(1)[0][0]
    # net : le plus fréquent parmi TOUTES les lignes à ce PPHT (condition standard)
    net = collections.Counter(x[2] for x in L if x[1] == ppht).most_common(1)[0][0]
    labo = collections.Counter(x[3] for x in L if x[3]).most_common(1)
    desig = collections.Counter(x[4] for x in L if x[4]).most_common(1)
    data[cb] = {
        "ppht": ppht, "net": net, "date": derniere, "n": len(L),
        "labo": labo[0][0] if labo else "", "design": desig[0][0] if desig else "",
    }

out = {"meta": {"mois": retenus, "nb_fichiers": len(fichiers), "nb_cip": len(data),
                "source": "fichiers de ventes commerciaux (PLVPUBRUT = PPHT, PLVPUNET = net IP)"},
       "data": data}
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
print("✓ %s · %d CIP13 avec un prix facturé" % (os.path.relpath(OUT, ROOT), len(data)))

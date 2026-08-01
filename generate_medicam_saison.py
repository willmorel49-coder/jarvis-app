#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_medicam_saison.py — Veille APPRO : saisonnalité par PRODUIT (Medic'AM, 2 ans).

Medic'AM (Assurance Maladie) donne, par CIP13 et par mois, le nombre de boîtes
remboursées en France. Sur 2 années pleines, on reconstruit un indice saisonnier
mensuel par produit (moyenne du mois / moyenne annuelle) → « l'an dernier ce produit
montait en septembre → pré-commander en août ». Complète la saison ATC2 (SAISON) par
un angle PRODUIT + le vrai historique national.

Source : data.gouv « Medic'AM par type de prescripteur » (ZIP → .xls binaire), gratuit
sans clé. Couvre TOUT le marché français : le modèle national doit voir aussi ce qu'Intégral
ne vend pas encore.

Écrit crm/v2/saison-cip.json. Python 3.9 · urllib + xlrd.
"""
import io
import os
import re
import json
import zipfile
import datetime
import urllib.request

import xlrd

META = "https://www.data.gouv.fr/api/1/datasets/medicam-medicaments-rembourses-par-lassurance-maladie-par-type-de-prescripteur-donnees-interregimes/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "saison-cip.json")
YEARS = [2023, 2024]
MIN_BOITES = 240   # volume total mini sur la période pour être significatif


def fetch(url):
    # assurance-maladie.ameli.fr renvoie HTTP 403 aux serveurs GitHub avec un User-Agent
    # minimal (panne du 2026-07-30, 4 fichiers sur 4). On se presente comme un vrai
    # navigateur : entetes completes + Referer data.gouv, d'ou provient le lien.
    req = urllib.request.Request(url, headers={
        "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Referer": "https://www.data.gouv.fr/",
        "Accept-Encoding": "gzip",
    })
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip
            raw = gzip.decompress(raw)
    return raw


def ecrire_si_complet(chemin, nouveau, seuil=0.8):
    """N'ecrit que si le resultat n'est pas une regression massive.

    Le 2026-07-30, les 4 telechargements Medic'AM ont echoue en HTTP 403 depuis les
    serveurs GitHub et le robot a quand meme ecrit un fichier vide, ecrasant 4 678
    produits — d'ou le « Pre-acheter 0 » du carnet d'achat pendant deux jours.

    Regle : sous `seuil` fois le volume precedent, on conserve l'ancien fichier et on
    le dit fort. Renvoie True si le fichier a ete ecrit.
    """
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


def resource_map():
    d = json.loads(fetch(META))
    out = {}
    for r in d.get("resources", []):
        t = (r.get("title") or "").lower()
        for y in YEARS:
            if "1er semestre %d" % y in t:
                out[(y, 1)] = r["url"]
            elif "2e semestre %d" % y in t:
                out[(y, 2)] = r["url"]
    return out


def read_xls(raw):
    z = zipfile.ZipFile(io.BytesIO(raw))
    name = [n for n in z.namelist() if n.lower().endswith(".xls")][0]
    wb = xlrd.open_workbook(file_contents=z.read(name))
    sh = None
    for s in wb.sheets():
        if "tous_presc" in s.name.lower():
            sh = s
            break
    return sh or max(wb.sheets(), key=lambda s: s.nrows * s.ncols)


def process(raw, sem, acc, seen):
    sh = read_xls(raw)
    hdr = [str(sh.cell_value(0, c)) for c in range(sh.ncols)]
    cip_c = next((i for i, h in enumerate(hdr) if h.strip().upper() == "CIP13"), 0)
    atc_c = next((i for i, h in enumerate(hdr) if "ATC" in h.upper() and "2" not in h and "code" in h.lower()), None)
    boites_cols = [i for i, h in enumerate(hdr) if "ombre de bo" in h]  # 6 colonnes mensuelles
    months = list(range(1, 7)) if sem == 1 else list(range(7, 13))
    for r in range(1, sh.nrows):
        try:
            cip = str(sh.cell_value(r, cip_c)).strip()
            cip = re.sub(r"\.0$", "", cip)
            cip = "".join(ch for ch in cip if ch.isdigit())
            if len(cip) != 13:
                continue
        except Exception:
            continue
        rec = acc.get(cip)
        if rec is None:
            rec = acc[cip] = {"m": [0.0] * 12, "atc": ""}
            if atc_c is not None:
                rec["atc"] = str(sh.cell_value(r, atc_c)).strip()
        for j, col in enumerate(boites_cols[:len(months)]):
            try:
                v = float(sh.cell_value(r, col) or 0)
            except Exception:
                v = 0.0
            rec["m"][months[j] - 1] += v
        seen.add((cip, sem))


def main():
    urls = resource_map()
    acc, seen = {}, set()
    ok = 0
    for (y, sem), url in sorted(urls.items()):
        try:
            process(fetch(url), sem, acc, seen)
            ok += 1
            print("  chargé %d S%d" % (y, sem))
        except Exception as e:
            print("  échec %d S%d : %s" % (y, sem, e))
    # Garde de complétude (audit #3) : il faut les 2 semestres × 2 ans, sinon la moyenne est
    # divisée par ~2 et TOUS les indices sont gonflés (faux « pic janvier »). On conserve alors
    # le JSON précédent plutôt que d'en publier un faux.
    expected = 2 * len(YEARS)
    if ok < expected:
        print("ABANDON : %d/%d fichiers Medic'AM chargés — saison-cip.json précédent conservé (évite un faux pic)." % (ok, expected))
        return

    data = {}
    for cip, rec in acc.items():
        tot = sum(rec["m"])
        if tot < MIN_BOITES:
            continue
        mean = tot / 12.0
        if mean <= 0:
            continue
        idx = [round(v / mean, 2) for v in rec["m"]]
        peak = max(range(12), key=lambda i: idx[i]) + 1
        data[cip] = {"i": idx, "p": peak, "a": rec["atc"]}

    out = {"generated": datetime.date.today().isoformat(), "source": "Medic'AM %s" % "+".join(str(y) for y in YEARS),
           "n": len(data), "data": data}
    if not ecrire_si_complet(OUT, out):
        raise SystemExit(1)   # echec VISIBLE : le robot doit rougir, pas passer inapercu
    print("OK · produits avec saison=%d (sur %d CIP Medic'AM, marché complet)" % (len(data), len(acc)))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

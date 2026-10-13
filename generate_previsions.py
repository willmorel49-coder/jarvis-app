#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_previsions.py — « La courbe » : ce que le MARCHÉ France va faire à 3, 6 et 12 mois,
par produit (CIP13), avec une fourchette. Écrit crm/v2/previsions.json.

Modèle : Chronos-2 (Amazon, Apache-2.0), choisi par backtest sur 9 472 produits (il bat la
moyenne des 3 derniers mois de 9 % à 3 mois et de 22 % à 12 mois). Entrées : Medic'AM
(Assurance Maladie, boîtes remboursées par CIP13 et par mois), 100 % publiques.

Ce script REMPLACE deux scripts qui n'existaient que dans ~/jarvis-preuves/appro-prediction/
(construire_serie.py + generate_previsions.py), lancés à la main depuis le 02/09/2026.

⚠️ Tourne en LOCAL (robot launchd ~/robot-previsions/) et pas sur GitHub : l'Assurance
Maladie refuse les adresses des serveurs de GitHub (HTTP 403 depuis le 06/08/2026), et Chronos-2
demande torch (plusieurs Go) + 480 Mo de poids de modèle.

Usage : generate_previsions.py [--sortie FICHIER] [--cache DOSSIER] [--modele chronos|persistance]
  --sortie  défaut crm/v2/previsions.json
  --cache   dossier des zip Medic'AM (défaut ~/robot-previsions/cache)
  --modele  « persistance » = remplaçant SANS prévision réelle, pour ESSAYER la chaîne quand
            Chronos n'est pas installé. Refuse d'écrire dans le fichier du CRM.

Sort en ERREUR (code 1) sans toucher au fichier existant si : téléchargement raté, mois
manquant, série tronquée, modèle indisponible, ou résultat plus maigre que l'existant.
"""
import argparse, datetime, io, json, os, re, sys, time, unicodedata, urllib.error, urllib.request, zipfile

import numpy as np
import xlrd

HERE = os.path.dirname(os.path.abspath(__file__))
CRM = os.path.join(HERE, "crm", "v2", "previsions.json")
BASE = "https://www.assurance-maladie.ameli.fr/sites/default/files/"
SUFFIX = "_medic-am-par-type-de-prescripteur_serie-mensuelle"
PREMIERE_ANNEE = 2021
MIN_12M = 100        # un produit sous 100 boîtes sur 12 mois n'est pas prévu (comme avant)


class Refus(Exception):
    pass


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s).strip().lower()


def cip13(v):
    try:
        return str(int(float(v))).zfill(13)
    except Exception:
        s = re.sub(r"\D", "", str(v or ""))
        return s.zfill(13) if s else None


# ───────────────────────── 1. téléchargement ─────────────────────────
def telecharge(nom, cache, definitif):
    """Rend le chemin du zip, ou None si l'adresse n'existe pas (404). Toute autre panne = Refus."""
    dest = os.path.join(cache, nom + ".zip")
    if definitif and os.path.exists(dest) and os.path.getsize(dest) > 100000:
        return dest
    for suffixe in (".zip", "_0.zip"):          # 2022 S1 est publié sous « _0.zip »
        url = BASE + nom + suffixe
        for essai in (1, 2, 3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=180) as r:
                    data = r.read()
                break
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    data = None
                    break
                if essai == 3:
                    raise Refus("%s : HTTP %s" % (url, e.code))
                time.sleep(5 * essai)
            except Exception as e:
                if essai == 3:
                    raise Refus("%s : %s" % (url, str(e)[:100]))
                time.sleep(5 * essai)
        if data is None:
            continue
        if len(data) < 100000:
            raise Refus("%s : fichier trop petit (%d octets)" % (url, len(data)))
        try:
            zipfile.ZipFile(io.BytesIO(data)).testzip()
        except Exception:
            raise Refus("%s : zip illisible" % url)
        os.makedirs(cache, exist_ok=True)
        tmp = dest + ".tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, dest)
        return dest
    return None


def semestres(aujourdhui):
    """(nom_complet, [noms partiels du plus complet au moins complet], clé) pour chaque semestre."""
    out = []
    for an in range(PREMIERE_ANNEE, aujourdhui.year + 1):
        for debut, fin in ((1, 6), (7, 12)):
            if datetime.date(an, debut, 1) > aujourdhui:
                continue
            plein = "%d-%02d-a-%02d%s" % (an, debut, fin, SUFFIX)
            partiels = ["%d-%02d-a-%02d%s" % (an, debut, m, SUFFIX) for m in range(fin - 1, debut - 1, -1)]
            out.append((plein, partiels, (an, debut)))
    return out


def lit_zip(chemin):
    """{cip: {'AAAA-MM': boîtes}} et l'ensemble des mois vus. Un mois présent mais à 0 est gardé à 0."""
    with open(chemin, "rb") as f:
        zf = zipfile.ZipFile(io.BytesIO(f.read()))
    xls = next((n for n in zf.namelist() if n.lower().endswith(".xls")), None)
    if not xls:
        raise Refus("%s : aucun .xls dans le zip" % os.path.basename(chemin))
    book = xlrd.open_workbook(file_contents=zf.read(xls))
    feuille = next((s for s in book.sheets() if "tous_presc" in norm(s.name)), None)
    if feuille is None:
        raise Refus("%s : feuille « tous prescripteurs » introuvable" % os.path.basename(chemin))
    cols = {}
    for c in range(feuille.ncols):
        h = norm(feuille.cell_value(0, c))
        if "nombre de boites" in h:
            m = re.search(r"(20\d{2})[-\s]?(\d{2})", h)
            if m:
                cols[c] = "%s-%s" % (m.group(1), m.group(2))
    if not cols:
        raise Refus("%s : aucune colonne de boîtes" % os.path.basename(chemin))
    serie = {}
    for r in range(1, feuille.nrows):
        cip = cip13(feuille.cell_value(r, 0))
        if not cip or len(cip) != 13:
            continue
        d = serie.setdefault(cip, {})
        for c, ym in cols.items():
            try:
                v = float(feuille.cell_value(r, c) or 0)
            except Exception:
                v = 0.0
            d[ym] = d.get(ym, 0.0) + v
    return serie, set(cols.values())


def construire_serie(cache, aujourdhui):
    series, mois_vus = {}, set()
    for plein, partiels, (an, debut) in semestres(aujourdhui):
        chemin = telecharge(plein, cache, True)
        if chemin is None:
            for p in partiels:                    # semestre en cours : le fichier le plus récent
                chemin = telecharge(p, cache, False)
                if chemin:
                    break
        if chemin is None:
            print("  semestre %d-%02d : pas encore publié" % (an, debut))
            continue
        s, vus = lit_zip(chemin)
        print("  %-62s %d produits, mois %s -> %s" % (os.path.basename(chemin)[:62], len(s), min(vus), max(vus)))
        mois_vus |= vus
        for cip, d in s.items():
            series.setdefault(cip, {}).update(d)      # le plus récent remplace, jamais d'addition
    if not series:
        raise Refus("aucune donnée Medic'AM")
    dernier = max(mois_vus)
    an, mo = int(dernier[:4]), int(dernier[5:])
    mois, a, m = [], PREMIERE_ANNEE, 1
    while (a, m) <= (an, mo):
        mois.append("%d-%02d" % (a, m))
        m += 1
        if m == 13:
            a, m = a + 1, 1
    manquants = [x for x in mois if x not in mois_vus]
    if manquants:
        raise Refus("mois absents des fichiers : %s" % manquants[:6])
    tot = lambda x: sum(series[c].get(x, 0.0) for c in series)
    ref = sorted(tot(x) for x in mois[-4:-1])[1]
    if tot(mois[-1]) < 0.5 * ref:
        raise Refus("dernier mois (%s) tronqué : %.0f boîtes contre ~%.0f" % (mois[-1], tot(mois[-1]), ref))
    complets = [c for c, d in series.items() if all(x in d for x in mois)]
    cips = [c for c in complets if sum(series[c][x] for x in mois[-12:]) >= MIN_12M]
    M = np.array([[series[c][x] for x in mois] for c in cips], dtype=float)
    print("%d mois (%s -> %s) · %d produits vus · %d présents sur tous les mois · %d retenus"
          % (len(mois), mois[0], mois[-1], len(series), len(complets), len(cips)))
    return cips, mois, M


# ───────────────────────── 2. prévision ─────────────────────────
def prevoir(M, H, modele):
    """Q de forme (produits, mois, [bas, médian, haut])."""
    if modele == "persistance":
        base = M[:, -3:].mean(1)
        Q = np.zeros((M.shape[0], H, 3))
        Q[:, :, 0] = base[:, None] * 0.8
        Q[:, :, 1] = base[:, None]
        Q[:, :, 2] = base[:, None] * 1.2
        return Q
    try:
        import torch
        from chronos import BaseChronosPipeline
    except Exception as e:
        raise Refus("Chronos-2 / torch indisponibles (%s)" % str(e)[:100])
    try:
        pipe = BaseChronosPipeline.from_pretrained("amazon/chronos-2", device_map="cpu")
        q, _ = pipe.predict_quantiles([torch.tensor(x, dtype=torch.float32) for x in M],
                                      prediction_length=H, quantile_levels=[0.1, 0.5, 0.9])
    except Exception as e:
        raise Refus("Chronos-2 a échoué (%s)" % str(e)[:100])
    return np.maximum(np.stack([t.numpy().reshape(H, 3) for t in q]), 0)


def calcule(cips, mois, M, modele, auj):
    dernier = mois[-1]
    an, mo = int(dernier[:4]), int(dernier[5:])
    retard = (auj.year - an) * 12 + (auj.month - mo)       # mois écoulés depuis la dernière donnée
    if retard < 0 or retard > 18:
        raise Refus("retard de publication aberrant : %d mois" % retard)
    H = retard + 12                                        # prédire jusqu'à aujourd'hui + 12 mois
    print("dernier mois connu : %s | aujourd'hui : %s | retard : %d mois -> on prédit %d mois"
          % (dernier, auj.strftime("%Y-%m"), retard, H))
    t0 = time.time()
    Q = prevoir(M, H, modele)
    print("%d produits x %d mois en %.0f s (modèle : %s)" % (len(cips), H, time.time() - t0, modele))

    # Base de comparaison = le rythme ACTUEL (3 derniers mois connus), pas la moyenne annuelle
    # (sur un générique en lancement, une base annuelle donne +2 199 %, vrai mais illisible).
    recent = M[:, -3:].mean(1)
    annuel = M[:, -12:].mean(1)
    data, ecartes = {}, 0
    for i, c in enumerate(cips):
        if recent[i] <= 0:
            ecartes += 1
            continue
        ligne, brut = [], {}
        for h in (3, 6, 12):
            fen = Q[i, retard:retard + h, :]               # la fenêtre qui commence AUJOURD'HUI
            if fen.shape[0] < h:
                fen = Q[i, -h:, :]
            base = recent[i] * h
            vals = [fen[:, k].sum() / base * 100 for k in (1, 0, 2)]    # médian, bas, haut — NON plafonnés
            if h == 3:
                brut = {"m": vals[0], "b": vals[1], "h": vals[2]}
            ligne += [min(999, int(round(v))) for v in vals]
        bas = int(round(recent[i] / annuel[i] * 100)) if annuel[i] > 0 else 100
        ligne.append(min(999, bas))                        # index 9 : bascule lancement / extinction
        # Fiabilité jugée sur les valeurs BRUTES : plafonner d'abord à 999 rendait « fiable »
        # une fourchette allant de 0 à l'infini.
        large = brut["m"] <= 0 or (brut["h"] - brut["b"]) / brut["m"] > 1.5
        base_instable = bas < 20 or bas > 500
        ligne.append(0 if (large or base_instable) else 1)
        data[c] = ligne
    print("produits écartés (aucun volume récent) : %d" % ecartes)
    source = "Medic'AM (boîtes remboursées France, par CIP13) — modèle Chronos-2"
    if modele != "chronos":
        source += " [ESSAI SANS MODÈLE : %s — ne jamais publier]" % modele
    return {
        "generated": str(auj),
        "source": source,
        "dernier_mois_reel": dernier,
        "retard_mois": retard,
        "n": len(data),
        "lecture": "par produit : [m3,b3,h3, m6,b6,h6, m12,b12,h12, bascule, fiable] — les 9 premiers en % du rythme des 3 DERNIERS MOIS connus (100 = stable) ; bascule = rythme 3 mois / rythme 12 mois en % (>200 lancement, <50 extinction) ; fiable = 0 si la fourchette est trop large pour décider.",
        "data": data,
    }


# ───────────────────────── 3. gardes et écriture ─────────────────────────
def verifie_et_ecrit(out, sortie, existant):
    if not out["data"] or any(len(v) != 11 for v in out["data"].values()):
        raise Refus("résultat vide ou lignes de mauvaise longueur")
    if sum(v[10] for v in out["data"].values()) < 0.2 * len(out["data"]):
        raise Refus("moins de 20 %% de produits fiables (%d sur %d) : prévision suspecte"
                    % (sum(v[10] for v in out["data"].values()), len(out["data"])))
    if os.path.exists(existant):
        try:
            avant = json.load(io.open(existant, encoding="utf-8"))
        except Exception:
            avant = None
        if avant:
            if out["n"] < 0.8 * avant.get("n", 0):
                raise Refus("%d produits contre %d avant (-%d %%)"
                            % (out["n"], avant["n"], 100 - 100 * out["n"] // avant["n"]))
            if out["dernier_mois_reel"] < avant.get("dernier_mois_reel", ""):
                raise Refus("dernier mois réel %s plus ancien que %s" % (out["dernier_mois_reel"], avant["dernier_mois_reel"]))
    os.makedirs(os.path.dirname(os.path.abspath(sortie)), exist_ok=True)
    tmp = sortie + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    os.replace(tmp, sortie)
    with io.open(sortie, encoding="utf-8") as f:
        r = json.load(f)
    if r.get("n") != out["n"] or len(r["data"]) != out["n"]:
        raise Refus("la relecture du fichier écrit ne correspond pas")
    print("écrit : %s (%.0f Ko, %d produits)" % (sortie, os.path.getsize(sortie) / 1024, out["n"]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sortie", default=CRM)
    ap.add_argument("--cache", default=os.path.expanduser("~/robot-previsions/cache"))
    ap.add_argument("--modele", default="chronos", choices=["chronos", "persistance"])
    a = ap.parse_args()
    try:
        if a.modele != "chronos" and os.path.abspath(a.sortie) == os.path.abspath(CRM):
            raise Refus("le modèle « %s » n'écrit jamais dans le fichier du CRM" % a.modele)
        auj = datetime.date.today()
        cips, mois, M = construire_serie(a.cache, auj)
        out = calcule(cips, mois, M, a.modele, auj)
        verifie_et_ecrit(out, a.sortie, CRM)
    except Refus as e:
        print("REFUSÉ, fichier existant conservé :", e)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

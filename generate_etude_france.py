#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_etude_france.py — « L'étude par produit » : boîtes remboursées FRANCE, mois par mois, par CIP13,
séparées en tous prescripteurs / prescripteurs de ville (médecins libéraux) / prescripteurs hospitaliers
(médecins salariés). Source : Medic'AM (Assurance Maladie), 100 % publique. Aucune donnée Intégral.

Lit les zip du robot (~/robot-previsions/cache/), feuilles *_tous_presc, *_presc_ville, *_presc_hopital,
en mémoire (rien n'est dézippé sur le disque). Même lecture que generate_previsions.py (lit_zip).
Tourne avec ~/robot-previsions/venv/bin/python (xlrd). Compatible Python 3.9.

Écrit un fichier par tranche de CIP (les 2 derniers chiffres du CIP13) : crm/v2/etude-france/NN.json
  { "m0": "2021-01", "n": 68, "d": { "<cip13>": [ [tous x n], [ville x n], [hopital x n] ] } }
et crm/v2/etude-france/index.json (mois, date, source, écart ville + hôpital face à tous).

Usage : generate_etude_france.py [--cache DOSSIER] [--sortie DOSSIER] [--un-seul-fichier CHEMIN]
  --un-seul-fichier : écrit AUSSI le même contenu en un seul fichier (pour mesurer le poids, jamais pour le CRM).
Sort en erreur (code 1) sans rien écrire si un mois manque ou si le dernier mois est tronqué.
"""
import argparse, glob, io, json, os, re, sys, unicodedata, zipfile
import xlrd

HERE = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(HERE, "crm", "v2", "etude-france")
CACHE = os.path.expanduser("~/robot-previsions/cache")
FEUILLES = ("tous_presc", "presc_ville", "presc_hopital")


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s).strip().lower()


def cip13(v):
    try:
        return str(int(float(v))).zfill(13)
    except Exception:
        s = re.sub(r"\D", "", str(v or ""))
        return s.zfill(13) if s else None


def lit_zip(chemin):
    """{feuille: {cip: {'AAAA-MM': boîtes}}} pour les trois feuilles. Un mois présent mais à 0 reste à 0."""
    with open(chemin, "rb") as f:
        zf = zipfile.ZipFile(io.BytesIO(f.read()))
    xls = next((n for n in zf.namelist() if n.lower().endswith(".xls")), None)
    if not xls:
        raise SystemExit("%s : aucun .xls" % chemin)
    book = xlrd.open_workbook(file_contents=zf.read(xls))
    out = {}
    for cle in FEUILLES:
        feuille = next((s for s in book.sheets() if cle in norm(s.name)), None)
        if feuille is None:
            raise SystemExit("%s : feuille %s introuvable" % (chemin, cle))
        cols = {}
        for c in range(len(feuille.row(0))):
            h = norm(feuille.cell_value(0, c))
            if "nombre de boites" in h:
                m = re.search(r"(20\d{2})[-\s]?(\d{2})", h)
                if m:
                    cols[c] = "%s-%s" % (m.group(1), m.group(2))
        if not cols:
            raise SystemExit("%s : %s : aucune colonne de boîtes" % (chemin, cle))
        serie = {}
        for r in range(1, feuille.nrows):
            ligne = feuille.row(r)
            cip = cip13(ligne[0].value)
            if not cip or len(cip) != 13:
                continue
            d = serie.setdefault(cip, {})
            for c, ym in cols.items():
                try:
                    v = float(ligne[c].value or 0) if c < len(ligne) else 0.0
                except Exception:
                    v = 0.0
                d[ym] = d.get(ym, 0.0) + v
        out[cle] = serie
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=CACHE)
    ap.add_argument("--sortie", default=SORTIE)
    ap.add_argument("--un-seul-fichier", default=None)
    a = ap.parse_args()
    zips = sorted(glob.glob(os.path.join(a.cache, "*medic-am-par-type-de-prescripteur_serie-mensuelle*.zip")))
    if not zips:
        sys.exit("aucun zip dans %s" % a.cache)
    tout = {k: {} for k in FEUILLES}
    mois_vus = set()
    for z in zips:
        r = lit_zip(z)
        for k in FEUILLES:
            for cip, d in r[k].items():
                tout[k].setdefault(cip, {}).update(d)   # le plus récent remplace, jamais d'addition
                mois_vus |= set(d.keys())
        print("  %s : %d produits (tous)" % (os.path.basename(z)[:30], len(r["tous_presc"])))
    mois = sorted(mois_vus)
    an, mo = int(mois[0][:4]), int(mois[0][5:])
    attendus = []
    while "%d-%02d" % (an, mo) <= mois[-1]:
        attendus.append("%d-%02d" % (an, mo))
        mo += 1
        if mo == 13:
            an, mo = an + 1, 1
    if attendus != mois:
        sys.exit("mois manquants : %s" % sorted(set(attendus) - set(mois)))
    n = len(mois)
    tot = lambda x: sum(d.get(x, 0.0) for d in tout["tous_presc"].values())
    ref = sorted(tot(x) for x in mois[-4:-1])[1]
    if tot(mois[-1]) < 0.5 * ref:
        sys.exit("dernier mois %s tronqué" % mois[-1])
    tranches, cips = {}, set(tout["tous_presc"]) | set(tout["presc_ville"]) | set(tout["presc_hopital"])
    ecart_max, nb_ecart, somme_t, somme_vh = 0.0, 0, 0.0, 0.0
    for cip in sorted(cips):   # ordre fixe : deux passages sur la même source donnent les mêmes octets (sinon 100 fichiers poussés pour rien)
        lignes = []
        for k in FEUILLES:
            d = tout[k].get(cip, {})
            lignes.append([int(round(d.get(x, 0.0))) for x in mois])
        if not any(lignes[0]) and not any(lignes[1]) and not any(lignes[2]):
            continue
        t, v, h = lignes
        somme_t += sum(t); somme_vh += sum(v) + sum(h)
        e = abs(sum(t) - sum(v) - sum(h))
        if e > 0:
            nb_ecart += 1
            ecart_max = max(ecart_max, e)
        tranches.setdefault(cip[-2:], {})[cip] = lignes
    os.makedirs(a.sortie, exist_ok=True)
    for f in glob.glob(os.path.join(a.sortie, "*.json")):
        os.remove(f)
    nb = 0
    for tr, d in sorted(tranches.items()):
        with open(os.path.join(a.sortie, tr + ".json"), "w") as f:
            json.dump({"m0": mois[0], "n": n, "d": d}, f, separators=(",", ":"))
        nb += len(d)
    index = {"source": "Medic'AM (Assurance Maladie), boîtes remboursées par CIP13 et par mois, par type de prescripteur",
             "mois": [mois[0], mois[-1]], "n": n, "produits": nb, "tranches": sorted(tranches),
             "lecture": "chaque CIP : [tous prescripteurs, ville (médecins libéraux), hôpital (médecins salariés)] x n mois à partir de m0",
             "ecart_ville_plus_hopital_vs_tous": {"produits_avec_ecart": nb_ecart, "ecart_max_boites": int(ecart_max),
                                                  "somme_tous": int(somme_t), "somme_ville_plus_hopital": int(somme_vh)}}
    with open(os.path.join(a.sortie, "index.json"), "w") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    if a.un_seul_fichier:
        un = {}
        for d in tranches.values():
            un.update(d)
        with open(a.un_seul_fichier, "w") as f:
            json.dump({"m0": mois[0], "n": n, "d": un}, f, separators=(",", ":"))
    print("%d produits, %d mois (%s -> %s), %d tranches" % (nb, n, mois[0], mois[-1], len(tranches)))
    print(json.dumps(index["ecart_ville_plus_hopital_vs_tous"]))


if __name__ == "__main__":
    main()

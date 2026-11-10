#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_prix_futurs.py — Veille APPRO : FUTURES baisses de prix (avis CEPS au Journal Officiel).

Le CEPS publie au JO les nouveaux prix (PFHT + PPTTC) des spécialités, souvent 4 à 20 jours
AVANT leur date d'effet. C'est LE signal « déstocker avant que ça baisse » que le diff BDPM
(rétrospectif) ne donne pas. On lit les dumps quotidiens ouverts de la DILA (JORFSIMPLE),
on garde les avis « prix de spécialités pharmaceutiques », on en extrait CIP13 + PFHT + PPTTC
+ date d'effet, restreints au catalogue réseau, et on compare au dernier prix public connu
(prix-snapshot.json) pour marquer baisse/hausse.

Source : https://echanges.dila.gouv.fr/OPENDATA/JORFSIMPLE/ (ouvert, sans clé).
Écrit crm/v2/prix-futurs.json. Python 3.9, urllib seul.
"""
import io
import os
import re
import sys
import gzip
import json
import html
import tarfile
import datetime
import urllib.request

from archive_evenements import archiver

LIST = "https://echanges.dila.gouv.fr/OPENDATA/JORFSIMPLE/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "prix-futurs.json")
ARCHIVE = os.path.join(HERE, "crm", "v2", "prix-futurs-archive.json")
SNAP = os.path.join(HERE, "crm", "v2", "prix-snapshot.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")

N_TARBALLS = 40          # ~20 jours (2 dumps/jour) — fenêtre glissante
# ⚠️ 09/11/2026 : la DILA a publié une archive complète (Freemium, 08/11 13 h 02) et EFFACÉ toute sa
# série de dumps quotidiens. Le robot n'en a plus vu qu'un, sans avis de prix, et a écrit un fichier
# vide (83 changements la veille). La fenêtre de la source peut donc s'effondrer n'importe quand :
# on la complète avec l'archive du robot. Un avis y reste utile tant qu'il est paru il y a moins de
# FENETRE_JOURS (l'ancienne fenêtre) OU que sa date d'effet n'est pas passée de plus de RECUL_EFFET_JOURS
# (l'écran Appro et le Brief Officinal affichent jusqu'à 7 jours après l'effet). Sans ce second critère,
# les baisses du 02/01/2027 parues le 20/10 (Xarelto, rivaroxaban) sortaient du fichier dès le 09/11.
FENETRE_JOURS = 20
RECUL_EFFET_JOURS = 7
MIN_DUMPS = 10           # en dessous, la DILA a remis sa série à zéro : on le signale
MOIS = {"janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
        "juillet": 7, "août": 8, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12, "decembre": 12}


def fetch(url, binary=True):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        raw = r.read()
    return raw if binary else raw.decode("utf-8", "ignore")


def catalogue():
    try:
        txt = io.open(PRODSTATS, "r", encoding="utf-8").read()
        arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
        return {str(p.get("c")): (p.get("d") or "") for p in arr if p.get("c")}
    except Exception:
        return {}


def load_snapshot():
    try:
        return json.load(io.open(SNAP, "r", encoding="utf-8"))
    except Exception:
        return {}


def price(s):
    try:
        return round(float(s.replace(" ", "").replace(".", "").replace(",", ".")), 2)
    except ValueError:
        return None


# « … entre en vigueur à compter du quatrième jour suivant la publication » (PRALUENT, JO du 10/09/2026).
RANGS = {"premier": 1, "deuxième": 2, "troisième": 3, "quatrième": 4, "cinquième": 5, "sixième": 6,
         "septième": 7, "huitième": 8, "neuvième": 9, "dixième": 10, "quinzième": 15}


def parse_effect_date(body, fallback):
    m = re.search(r"à compter du\s+(\d{1,2})(?:er)?\s+([a-zA-Zûéèê]+)\s+(20\d{2})", body)
    if m:
        mo = MOIS.get(m.group(2).lower())
        if mo:
            try:
                return datetime.date(int(m.group(3)), mo, int(m.group(1))).isoformat()
            except ValueError:
                pass
    m = re.search(r"à compter du\s+(\w+)\s+jour suivant (?:la|sa) publication", body)
    if m and m.group(1).lower() in RANGS and fallback:
        try:
            return (datetime.date.fromisoformat(fallback) + datetime.timedelta(days=RANGS[m.group(1).lower()])).isoformat()
        except ValueError:
            pass
    return fallback


def date_ligne(s):
    """« 01/11/2026 » (colonne « Date d'effet » d'une ligne du tableau) → « 2026-11-01 », sinon None."""
    try:
        j, mo, a = s.split("/")
        return datetime.date(int(a), int(mo), int(j)).isoformat()
    except (AttributeError, ValueError):
        return None


def parse_avis(xml, cat, snap, out, seen):
    if "prix de spécialités pharmaceutiques" not in xml and "prix des spécialités pharmaceutiques" not in xml:
        return
    dp = re.search(r"<DATE_PUBLI>([\d-]+)</DATE_PUBLI>", xml)
    date_publi = dp.group(1) if dp else None
    m = re.search(r"<CONTENU>(.*?)</CONTENU>", xml, re.S)
    body = m.group(1) if m else xml
    body = html.unescape(re.sub(r"<[^>]+>", " ", body))
    body = re.sub(r"\s+", " ", body)
    labo = ""
    lm = re.search(r"société\s+([A-ZÉÈÀ0-9][^,.;]{2,60}?)(?:,| les prix| le prix)", body)
    if lm:
        labo = lm.group(1).strip().title()
    date_effet = parse_effect_date(body, date_publi)
    # chaque ligne du tableau : CIP13 (avec espaces) … désignation … PFHT € PPTTC [€ Date d'effet]
    # ⚠️ 22/10/2026 : la date propre à la ligne prime. L'avis du 06/10/2026 fixe la baisse d'ELIQUIS au
    # 01/11/2026 dans cette colonne ; sans elle, la date de parution passait pour la date d'effet.
    for mt in re.finditer(r"(34009[\d ]{12,18}?)\s+(.+?)\s+(\d[\d ]*,\d{2})\s*€?\s+(\d[\d ]*,\d{2})(?:\s*€)?(?:\s+(\d{2}/\d{2}/20\d{2}))?", body):
        cip = "".join(ch for ch in mt.group(1) if ch.isdigit())
        if len(cip) != 13 or (cat and cip not in cat):
            continue
        pfht, ppttc = price(mt.group(3)), price(mt.group(4))
        if pfht is None or ppttc is None:
            continue
        effet = date_ligne(mt.group(5)) or date_effet
        key = cip + "|" + (effet or "")
        if key in seen:
            continue
        seen.add(key)
        old = snap.get(cip)
        desg = (cat.get(cip) or mt.group(2).strip())[:60]
        out.append({"c": cip, "d": desg, "pfht": pfht, "ppttc": ppttc,
                    "ancien_ttc": old if isinstance(old, (int, float)) else None,
                    "sens": sens_de(ppttc, old), "date_effet": effet, "date_publi": date_publi, "labo": labo})


def sens_de(ppttc, old):
    if isinstance(old, (int, float)) and old > 0:
        return "baisse" if ppttc < old - 0.005 else ("hausse" if ppttc > old + 0.005 else "stable")
    return None


def lire_archive():
    """Avis déjà archivés. Une archive présente mais illisible fait ÉCHOUER le passage (exception) :
    `archive_evenements.charger` rendrait [] en silence, le fichier perdrait tout ce que la DILA ne
    publie plus, et `archiver` réécrirait l'archive amputée."""
    if not os.path.exists(ARCHIVE):
        return []
    with io.open(ARCHIVE, "r", encoding="utf-8") as f:
        return json.load(f)["evenements"]


def depuis_archive(evs, cat, snap, seen, today):
    """Avis archivés encore utiles que les dumps du jour ne contiennent pas, réévalués comme un avis
    lu le jour même (désignation du catalogue, ancien prix et sens selon l'instantané actuel)."""
    jour = datetime.date.fromisoformat(today)
    parus_depuis = (jour - datetime.timedelta(days=FENETRE_JOURS)).isoformat()
    effet_depuis = (jour - datetime.timedelta(days=RECUL_EFFET_JOURS)).isoformat()
    repris = []
    for e in evs:
        cip, effet = str(e.get("c") or ""), e.get("date_effet") or ""
        if len(cip) != 13 or (cat and cip not in cat) or not isinstance(e.get("ppttc"), (int, float)):
            continue
        if (e.get("date_publi") or "") < parus_depuis and effet < effet_depuis:
            continue
        key = cip + "|" + effet
        if key in seen:
            continue
        seen.add(key)
        old = snap.get(cip)
        repris.append({"c": cip, "d": (cat.get(cip) or e.get("d") or "")[:60], "pfht": e.get("pfht"),
                       "ppttc": e["ppttc"], "ancien_ttc": old if isinstance(old, (int, float)) else None,
                       "sens": sens_de(e["ppttc"], old), "date_effet": e.get("date_effet"),
                       "date_publi": e.get("date_publi"), "labo": e.get("labo") or ""})
    return repris


def main():
    cat = catalogue()
    snap = load_snapshot()
    listing = fetch(LIST, binary=False)
    tarballs = sorted(set(re.findall(r"JORFSIMPLE_[\d-]+\.tar\.gz", listing)))[-N_TARBALLS:]
    out, seen = [], set()
    ok = 0
    for tb in tarballs:
        try:
            raw = fetch(LIST + tb)
            tf = tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz")
            for mem in tf.getmembers():
                if not mem.name.endswith(".xml"):
                    continue
                try:
                    data = tf.extractfile(mem).read().decode("utf-8", "ignore")
                except Exception:
                    continue
                if "spécialités pharmaceutiques" in data:
                    parse_avis(data, cat, snap, out, seen)
            ok += 1
        except Exception as e:
            print("  échec %s : %s" % (tb, e))

    # Une lecture ratée n'est pas un zéro : sans aucun dump lu, on garde le fichier d'hier et le passage
    # échoue (rouge dans GitHub), plutôt que d'annoncer « aucune baisse de prix ».
    if ok == 0:
        print("::error::aucun dump DILA lu (%d listé(s)) — %s GARDÉ tel quel, rien n'est écrit" % (len(tarballs), OUT))
        sys.exit(1)

    today = datetime.date.today().isoformat()
    repris = depuis_archive(lire_archive(), cat, snap, seen, today)
    out.extend(repris)
    if ok < MIN_DUMPS:
        print("::warning::la DILA ne publie que %d dump(s) (série remise à zéro) — %d avis repris de l'archive"
              % (ok, len(repris)))
    if not out:
        try:
            avant = json.load(io.open(OUT, "r", encoding="utf-8")).get("nTotal") or 0
        except Exception:
            avant = 0
        if avant:
            print("::error::0 changement de prix, dumps ET archive compris, alors que le fichier en avait %d — "
                  "GARDÉ tel quel, rien n'est écrit" % avant)
            sys.exit(1)
    # futures d'abord (date d'effet >= aujourd'hui), puis par date d'effet croissante
    out.sort(key=lambda x: (x.get("date_effet") or "9999"))
    futures = [x for x in out if (x.get("date_effet") or "") >= today]
    baisses = [x for x in out if x.get("sens") == "baisse"]

    res = {"generated": today, "source": "Avis CEPS au Journal Officiel (DILA JORFSIMPLE)",
           "nTotal": len(out), "nFutures": len(futures), "nBaisses": len(baisses),
           # 400 et non plus 120 (10/11/2026) : avec les baisses à venir reprises de l'archive on était à 115,
           # et le tri par date d'effet aurait coupé les plus lointaines — celles qu'il faut voir venir.
           "changes": out[:400]}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
    # La DILA ne garde que ~20 jours (N_TARBALLS) : un avis sorti de la fenêtre n'existe
    # plus nulle part. On archive donc `out` ENTIER — surtout pas `res["changes"]`, qui
    # est tronqué à 120 pour l'affichage (un plafond d'affichage n'est pas un plafond
    # d'enregistrement).
    n_arch, n_neuf = archiver(ARCHIVE, out, lambda e: (e.get("c"), e.get("date_effet")), today,
                              note="avis CEPS (CIP13, PFHT, date d'effet) archivés une fois "
                                   "pour toutes — la DILA ne publie qu'une fenêtre de ~20 jours")
    print("OK · %d dumps lus · %d changements de prix (catalogue, dont %d repris de l'archive) · %d à venir · %d baisses"
          % (ok, len(out), len(repris), len(futures), len(baisses)))
    print("archive des avis CEPS = %d (+%d aujourd'hui)" % (n_arch, n_neuf))
    for x in out[:6]:
        print("  %s  %s  PFHT %.2f  TTC %.2f  effet %s  [%s]" % (x["c"], x["d"][:26], x["pfht"], x["ppttc"], x.get("date_effet"), x.get("sens")))
    print("→ %s (%d o)" % (OUT, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()

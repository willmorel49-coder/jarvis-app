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
import gzip
import json
import html
import tarfile
import datetime
import urllib.request

LIST = "https://echanges.dila.gouv.fr/OPENDATA/JORFSIMPLE/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "prix-futurs.json")
SNAP = os.path.join(HERE, "crm", "v2", "prix-snapshot.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")

N_TARBALLS = 40          # ~20 jours (2 dumps/jour) — fenêtre glissante
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


def parse_effect_date(body, fallback):
    m = re.search(r"à compter du\s+(\d{1,2})(?:er)?\s+([a-zA-Zûéèê]+)\s+(20\d{2})", body)
    if m:
        mo = MOIS.get(m.group(2).lower())
        if mo:
            try:
                return datetime.date(int(m.group(3)), mo, int(m.group(1))).isoformat()
            except ValueError:
                pass
    return fallback


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
    # chaque ligne du tableau : CIP13 (avec espaces) … désignation … PFHT € PPTTC
    for mt in re.finditer(r"(34009[\d ]{12,18}?)\s+(.+?)\s+(\d[\d ]*,\d{2})\s*€?\s+(\d[\d ]*,\d{2})", body):
        cip = "".join(ch for ch in mt.group(1) if ch.isdigit())
        if len(cip) != 13 or (cat and cip not in cat):
            continue
        pfht, ppttc = price(mt.group(3)), price(mt.group(4))
        if pfht is None or ppttc is None:
            continue
        key = cip + "|" + (date_effet or "")
        if key in seen:
            continue
        seen.add(key)
        old = snap.get(cip)
        sens = None
        if isinstance(old, (int, float)) and old > 0:
            sens = "baisse" if ppttc < old - 0.005 else ("hausse" if ppttc > old + 0.005 else "stable")
        desg = (cat.get(cip) or mt.group(2).strip())[:60]
        out.append({"c": cip, "d": desg, "pfht": pfht, "ppttc": ppttc,
                    "ancien_ttc": old if isinstance(old, (int, float)) else None,
                    "sens": sens, "date_effet": date_effet, "date_publi": date_publi, "labo": labo})


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

    today = datetime.date.today().isoformat()
    # futures d'abord (date d'effet >= aujourd'hui), puis par date d'effet croissante
    out.sort(key=lambda x: (x.get("date_effet") or "9999"))
    futures = [x for x in out if (x.get("date_effet") or "") >= today]
    baisses = [x for x in out if x.get("sens") == "baisse"]

    res = {"generated": today, "source": "Avis CEPS au Journal Officiel (DILA JORFSIMPLE)",
           "nTotal": len(out), "nFutures": len(futures), "nBaisses": len(baisses),
           "changes": out[:120]}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · %d dumps lus · %d changements de prix (catalogue) · %d à venir · %d baisses" % (ok, len(out), len(futures), len(baisses)))
    for x in out[:6]:
        print("  %s  %s  PFHT %.2f  TTC %.2f  effet %s  [%s]" % (x["c"], x["d"][:26], x["pfht"], x["ppttc"], x.get("date_effet"), x.get("sens")))
    print("→ %s (%d o)" % (OUT, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()

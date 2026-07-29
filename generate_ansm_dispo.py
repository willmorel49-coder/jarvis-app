#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_ansm_dispo.py — Veille APPRO : disponibilités ANSM + DATES DE RETOUR.

La page ANSM « Disponibilités des produits de santé / médicaments » est rendue côté
serveur : un simple GET renvoie les ~285 signalements actifs (statut, DCI, domaine),
chaque ligne portant un data-href vers sa fiche. La FICHE porte le champ
« Date de remise à disposition prévue » (texte libre : « courant septembre 2026 »,
« fin octobre 2026 », « troisième trimestre 2027 », « indéterminée »).

Personne n'agrège proprement cette date future → différenciateur Jarvis.
On la scrape, on la normalise (mois/trimestre → ISO approché) et on l'expose par DCI
(jointure côté app via le pivot DCI→CIP13 avec le sell-in réseau + stock).

Écrit crm/v2/ansm-dispo.json. Python 3.9, urllib + html seuls. Aucune clé.
"""
import io
import os
import re
import json
import html
import datetime
import urllib.request

LIST_URL = "https://ansm.sante.fr/disponibilites-des-produits-de-sante/medicaments"
HOST = "https://ansm.sante.fr"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "ansm-dispo.json")
MAX_FICHES = int(os.environ.get("ANSM_MAX", "0"))   # 0 = toutes les tensions/ruptures

MOIS = {"janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5,
        "juin": 6, "juillet": 7, "août": 8, "aout": 8, "septembre": 9, "octobre": 10,
        "novembre": 11, "décembre": 12, "decembre": 12}
TRIM = {"premier": 1, "1er": 1, "deuxième": 4, "deuxieme": 4, "2ème": 4, "second": 4,
        "troisième": 7, "troisieme": 7, "3ème": 7, "quatrième": 10, "quatrieme": 10, "4ème": 10}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "ignore")


def txt(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def norm_date(raw):
    """« courant septembre 2026 » / « fin octobre 2026 » / « 3e trimestre 2027 » → {raw, iso, mois, annee, approx}."""
    if not raw:
        return None
    low = raw.lower()
    if "ind" in low and "termin" in low:   # indéterminée
        return None
    y = re.search(r"(20\d\d)", low)
    if not y:
        return None
    annee = int(y.group(1))
    # trimestre ?
    tm = re.search(r"(premier|deuxi[èe]me|second|troisi[èe]me|quatri[èe]me|[1-4]e?r?)\s*trimestre", low)
    if tm:
        key = tm.group(1).replace("è", "e")
        mois = TRIM.get(key)
        if mois:
            return {"raw": raw.strip(), "iso": "%04d-%02d" % (annee, mois), "mois": mois, "annee": annee, "approx": "trimestre"}
    for name, num in MOIS.items():
        if name in low:
            approx = "mois"
            if "début" in low or "debut" in low:
                approx = "début"
            elif "fin" in low:
                approx = "fin"
            elif "mi " in low or "mi-" in low:
                approx = "mi"
            return {"raw": raw.strip(), "iso": "%04d-%02d" % (annee, num), "mois": num, "annee": annee, "approx": approx}
    return {"raw": raw.strip(), "iso": "%04d" % annee, "mois": None, "annee": annee, "approx": "année"}


def parse_list(hh):
    rows = re.findall(r"<tr([^>]*)>(.*?)</tr>", hh, re.S)
    out = []
    for attrs, body in rows:
        sl = re.search(r'data-href="([^"]+)"', attrs)
        tds = re.findall(r"<td[^>]*>(.*?)</td>", body, re.S)
        if not sl or len(tds) < 5:
            continue
        spec_full = txt(tds[2])
        dci = ""
        mb = re.search(r"\[([^\]]+)\]", spec_full)
        if mb:
            dci = mb.group(1).strip()
        spec = re.sub(r"\s*-\s*\[[^\]]+\]\s*$", "", spec_full).strip()
        out.append({
            "slug": sl.group(1),
            "st": txt(tds[0]),
            "maj": txt(tds[1]),
            "spec": spec,
            "dci": dci,
            "dom": txt(tds[4]),
            "listDate": txt(tds[3]),
        })
    return out


def fiche_retour(slug):
    try:
        h = fetch(HOST + slug)
    except Exception:
        return None
    t = txt(h)
    m = re.search(r"Date de remise à disposition prévue\s*:?\s*(.+?)(?:Afin|$)", t)
    if not m:
        return None
    return norm_date(m.group(1)[:80])


def main():
    lst = parse_list(fetch(LIST_URL))
    by_statut = {}
    for it in lst:
        k = it["st"][:20]
        by_statut[k] = by_statut.get(k, 0) + 1

    # Dates de retour : on suit la fiche pour les tensions/ruptures (pas les déjà-remises ni arrêts)
    todo = [it for it in lst if "ension" in it["st"] or "upture" in it["st"]]
    if MAX_FICHES:
        todo = todo[:MAX_FICHES]
    n_dates = 0
    for it in todo:
        r = fiche_retour(it["slug"])
        if r:
            it["retour"] = r
            n_dates += 1

    today = datetime.date.today().isoformat()
    # on n'exporte pas le slug entier (poids) — juste ce qui sert au couplage
    items = [{"st": it["st"], "spec": it["spec"], "dci": it["dci"], "dom": it["dom"],
              "maj": it["maj"], "retour": it.get("retour")} for it in lst]
    out = {"generated": today, "source": "ANSM Disponibilités", "meta": {"n": len(lst), "byStatut": by_statut, "nDates": n_dates}, "items": items}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · signalements=%d · %s · dates de retour futures=%d" % (len(lst), by_statut, n_dates))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

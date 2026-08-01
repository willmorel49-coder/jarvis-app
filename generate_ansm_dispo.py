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
HISTO = os.path.join(HERE, "crm", "v2", "ansm-histo.json")
PIVOT = os.path.join(HERE, "crm", "v2", "pivot.json")
OUBLI_JOURS = 120   # on garde une ligne sortie de la liste ANSM 120 j (pour dire « revenu le … »)
MAX_FICHES = int(os.environ.get("ANSM_MAX", "0"))   # 0 = toutes les tensions/ruptures


def norm_dci(s):
    """Molécule normalisée (1er mot INN, sans parenthèses) pour la jointure floue ANSM↔pivot."""
    s = re.sub(r"\(.*?\)", " ", (s or "").upper())
    s = re.sub(r"[^A-ZÀ-Ü ]", " ", s)
    parts = [p for p in s.split() if len(p) > 3]
    return parts[0] if parts else ""


def load_subst_set():
    """Molécules (norm) qui ont un groupe générique, d'après la table pivot (couplage)."""
    try:
        with io.open(PIVOT, "r", encoding="utf-8") as f:
            data = json.load(f).get("data", {})
    except Exception:
        return set()
    out = set()
    for row in data.values():
        if row.get("grp") is not None:
            k = norm_dci(row.get("dci"))
            if k:
                out.add(k)
    return out

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


def histo_key(spec):
    """Clé stable d'un signalement (le libellé de spécialité, normalisé)."""
    s = re.sub(r"\s*-\s*\[[^\]]*\]\s*$", "", (spec or "")).lower()
    s = re.sub(r"[^a-z0-9]+", " ", s.replace("é", "e").replace("è", "e").replace("ê", "e")
               .replace("à", "a").replace("â", "a").replace("î", "i").replace("ô", "o")
               .replace("û", "u").replace("ç", "c"))
    return re.sub(r"\s+", " ", s).strip()[:90]


def maj_iso(maj):
    """« 29/07/2026 » → « 2026-07-29 » (date ANSM de dernière mise à jour du signalement)."""
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", maj or "")
    return "%s-%s-%s" % (m.group(3), m.group(2), m.group(1)) if m else None


def load_histo():
    try:
        with io.open(HISTO, "r", encoding="utf-8") as f:
            return json.load(f).get("items", {})
    except Exception:
        return {}


def maj_histo(lst, today):
    """Journal append-only « depuis quand ».

    Le fichier ANSM n'est qu'une photo du jour : il ne dit pas depuis combien de temps un
    produit est en tension. On tient donc notre propre registre, et on injecte la date de
    début dans chaque item (champs `since` / `sinceA`).

    Amorçage honnête : au 1er passage on ne peut pas inventer l'historique → on part de la
    date ANSM de dernière mise à jour du signalement (`maj`), marquée APPROCHÉE (`sinceA`=1).
    Dès qu'on observe NOUS-MÊMES un changement de statut, la date devient exacte (`sinceA`=0).
    """
    h = load_histo()
    vus = set()
    n_exact = 0
    for it in lst:
        k = histo_key(it.get("spec"))
        if not k:
            continue
        vus.add(k)
        st = it.get("st") or ""
        e = h.get(k)
        if not e:
            e = {"f": today, "s": st, "d": maj_iso(it.get("maj")) or today,
                 "a": 1 if maj_iso(it.get("maj")) else 0, "g": today}
            h[k] = e
        elif e.get("s") != st:
            e["p"] = e.get("s")          # statut précédent
            e["s"] = st
            e["d"] = today               # changement observé par nous → date EXACTE
            e["a"] = 0
            e["g"] = today
            e.pop("o", None)
        else:
            e["g"] = today
            e.pop("o", None)
        it["since"] = e["d"]
        it["sinceA"] = e.get("a", 0)
        if not e.get("a"):
            n_exact += 1
    # sorties de liste : on note la date de sortie, puis on purge au bout de OUBLI_JOURS
    limite = (datetime.date.fromisoformat(today) - datetime.timedelta(days=OUBLI_JOURS)).isoformat()
    for k in list(h.keys()):
        if k in vus:
            continue
        if not h[k].get("o"):
            h[k]["o"] = today
        if h[k].get("g", "") < limite:
            del h[k]
    with io.open(HISTO, "w", encoding="utf-8") as f:
        json.dump({"generated": today, "note": "journal append-only des signalements ANSM (date de début de statut)",
                   "items": h}, f, ensure_ascii=False, separators=(",", ":"))
    return len(h), n_exact


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

    # Couplage pivot : la molécule en tension a-t-elle un générique substituable ?
    subst = load_subst_set()
    n_subst = 0
    for it in lst:
        s = 1 if norm_dci(it.get("dci")) in subst else 0
        it["subst"] = s
        if s and ("ension" in it["st"] or "upture" in it["st"]):
            n_subst += 1

    today = datetime.date.today().isoformat()
    n_histo, n_exact = maj_histo(lst, today)
    # on n'exporte pas le slug entier (poids) — juste ce qui sert au couplage
    items = [{"st": it["st"], "spec": it["spec"], "dci": it["dci"], "dom": it["dom"],
              "maj": it["maj"], "retour": it.get("retour"), "subst": it.get("subst", 0),
              "since": it.get("since"), "sinceA": it.get("sinceA", 1)} for it in lst]
    out = {"generated": today, "source": "ANSM Disponibilités",
           "meta": {"n": len(lst), "byStatut": by_statut, "nDates": n_dates, "nSubst": n_subst,
                    "nHisto": n_histo, "nDepuisExact": n_exact},
           "items": items}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · signalements=%d · %s · dates de retour futures=%d · journal=%d lignes (dont %d dates exactes)" % (len(lst), by_statut, n_dates, n_histo, n_exact))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

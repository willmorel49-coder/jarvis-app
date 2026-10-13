#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_ema_penuries.py — Fil d'anticipation (APPRO › Actu) : catalogue des pénuries de l'EMA.

L'Agence européenne des médicaments publie chaque nuit (06 h) un fichier Excel public des
pénuries évaluées au niveau européen (~90 lignes). Aucune clé. Réutilisation autorisée,
commerciale comprise, à condition de citer l'EMA (https://www.ema.europa.eu/en/about-us/legal-notice).
robots.txt contrôlé le 13/10/2026 : le dossier /documents/report/ n'est pas interdit.

Rapprochement avec le catalogue (fiable seulement) :
  - `cips`     : références dont la désignation commence par la marque ET dont la DCI (table pivot)
                 contient la substance de l'EMA ;
  - `cips_dci` : autres références de la même substance (alternatives disponibles au catalogue).
Rien n'est inventé : sans correspondance, les deux listes restent vides.

GARDE-FOU : téléchargement en échec, fichier illisible ou moins de MIN_LIGNES lignes
→ sortie en erreur (code 1) SANS toucher au JSON existant.

SUBSTANCES EN FRANÇAIS (13/10/2026) : le JSON garde l'original anglais (`inn`, `name`) et gagne
`inn_fr` / `name_fr`. Un nom français n'est accepté que s'il EXISTE dans la Base de Données
Publique des Médicaments (fichier des compositions CIS_COMPO_bdpm.txt) après normalisation
(casse, accents, ponctuation, ordre des mots). Les règles de correspondance (insulin → insuline,
…in → …ine, …) ne servent qu'à PROPOSER un candidat ; la BDPM tranche. Association : composant par
composant, un seul échec = toute la ligne reste en anglais. BDPM injoignable : les pénuries sont
écrites quand même (source d'appoint, jamais bloquante) et la sortie le dit — voir GARDER LA VEILLE.
robots.txt de la BDPM contrôlé le 13/10/2026 : « Allow: / ».

TABLE DE SECOURS (13/10/2026, décision de Will : « Oui, la table ») : pour les quelques substances
que la BDPM ne rend pas, TABLE_SUBSTANCES / TABLE_TITRES donnent un français ÉCRIT À LA MAIN. Ce ne
sont PAS des noms officiels : ce sont des dénominations d'usage en pharmacie, utilisées en dernier
recours. Arbitrage : la BDPM gagne toujours ; la table ne sert que si la BDPM ne rend rien ; absent
des deux = anglais gardé. Une ligne qui doit un nom à la table porte `fr_table` (liste des champs
concernés : `inn_fr` et/ou `name_fr`) ; l'écran ignore ce champ. BDPM injoignable : la table ne sert pas
(voir GARDER LA VEILLE : les noms de la veille, déjà passés par la BDPM et la table, la remplacent).

GARDER LA VEILLE (13/10/2026) : BDPM injoignable ou douteuse → le générateur relit le ema-penuries.json
déjà en place (celui de la veille) AVANT de l'écraser et reprend `inn_fr`, `name_fr` et `fr_table` de la
ligne de la veille, seulement si `name` ET `inn` (anglais) sont strictement identiques : une traduction ne se
pose jamais sur une autre substance. Ligne nouvelle ou modifiée : anglais gardé. Fichier de la veille absent
ou illisible : tout en anglais, sans plantage. La sortie dit combien de lignes ont été reprises.

Écrit crm/v2/ema-penuries.json. Python 3.9 · urllib + openpyxl (comme generate_ema_generiques.py).
"""
import io
import os
import re
import sys
import json
import datetime
import unicodedata
import difflib
import itertools
import collections
import urllib.request

URL = os.environ.get("EMA_PENURIES_URL",
                     "https://www.ema.europa.eu/en/documents/report/medicines-output-shortages-report_en.xlsx")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "ema-penuries.json")
PIVOT = os.path.join(HERE, "crm", "v2", "pivot.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")
BDPM_BASE = os.environ.get("BDPM_BASE_URL", "https://base-donnees-publique.medicaments.gouv.fr/download/file/")
MIN_LIGNES = 20
MIN_SUBSTANCES_BDPM = 2000      # une BDPM qui en rend moins est douteuse : on ne traduit rien
SEUIL_PONT = 0.8                # ressemblance minimale pour proposer un nom pris dans la composition d'une spécialité
MAX_ALT = 40


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "JARVIS-robot/1.0 (veille approvisionnement)"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def mots(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).split()


def iso_date(v):
    if not v:
        return None
    if hasattr(v, "date"):
        return v.date().isoformat()
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(v))
    return "%s-%02d-%02d" % (m.group(3), int(m.group(2)), int(m.group(1))) if m else None


def catalogue():
    """[(cip, designation en mots, dci en texte normalisé)] pour les références du catalogue."""
    try:
        txt = io.open(PRODSTATS, "r", encoding="utf-8").read()
        arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
        piv = json.load(io.open(PIVOT, "r", encoding="utf-8"))
        data = piv.get("data", piv)
        res = []
        for p in arr:
            rec = data.get(str(p.get("c")))
            if rec and rec.get("dci"):
                res.append((str(p["c"]), mots(p.get("d")), " ".join(mots(rec["dci"]))))
        return res
    except Exception as e:
        print("AVERTISSEMENT : catalogue illisible (%s) — aucun rapprochement" % e)
        return []


def rapprocher(cat, nom, inn):
    marques = [mots(b)[0] for b in re.split(r"[/,]", nom) if mots(b) and len(mots(b)[0]) >= 4]
    sub = (mots(inn) or [""])[0]
    if len(sub) < 5:
        return [], []
    exact, alt = [], []
    for cip, des, dci in cat:
        if sub not in dci.split() and sub not in dci:
            continue
        if des and any(des[0].startswith(m) for m in marques):
            exact.append(cip)
        else:
            alt.append(cip)
    return exact, alt[:MAX_ALT]


# ── Substances en français (BDPM) ────────────────────────────────────────────────────────────
VIDES_FR = {"de", "d", "du", "des", "la", "le", "l"}
# Quelques mots dont le français n'est pas « mot anglais + e » ; ils ne servent qu'à proposer un candidat.
LEXIQUE = {"human": ["humain", "humaine"], "normal": ["normal", "normale"], "sodium": ["sodique", "sodium"],
           "oxide": ["oxyde"], "trioxide": ["trioxyde"], "dichloride": ["dichlorure"], "chloride": ["chlorure"],
           "activated": ["active"], "inactivated": ["inactive"], "adsorbed": ["adsorbe"], "inhibitor": ["inhibiteur"],
           "vaccine": ["vaccin"], "hormone": ["hormone"]}


# Traductions écrites à la main le 13/10/2026 — PAS des noms officiels, dernier recours seulement (voir
# l'en-tête du fichier). Clé : l'anglais de l'EMA en minuscules ; valeur : le français en minuscules,
# comme les noms que rend la BDPM. En cas de doute sur un terme, il n'est PAS ajouté ici.
TABLE_SUBSTANCES = {
    "human normal immunoglobulins": "immunoglobulines humaines normales",
    "human normal immunoglobulin": "immunoglobuline humaine normale",
    "concentrate of proteolytic enzymes enriched in bromelain": "concentré d'enzymes protéolytiques riches en bromélaïne",
    "parathyroid hormone": "parathormone",
    "esmolol": "esmolol",
    "insulin human": "insuline humaine",
    "pancreas powder": "poudre de pancréas",
    "pancrelipase": "pancrélipase",
    "fludarabine": "fludarabine",
    "atomoxetine": "atomoxétine",
    "methylphenidate": "méthylphénidate",
    "lisdexamfetamine": "lisdexamfétamine",
    "vindesine": "vindésine",
    "japanese encephalitis vaccine (inactivated, adsorbed)": "vaccin contre l'encéphalite japonaise (inactivé, adsorbé)",
    "mecasermin": "mécasermine",
}
# Titres qui ne sont pas une simple substance (clé : titre EMA exact en minuscules ; valeur : affichée telle quelle).
TABLE_TITRES = {
    "adhd medicines": "Médicaments du TDAH",
    "mycobutin (rifabutin)": "Mycobutin (rifabutine)",
    "eli lilly insulin (various forms)": "Insuline Eli Lilly (formes diverses)",
    "novonordisk insulin (human insulin) (various short-, rapid-, intermediate-, mixed- and long-acting forms)":
        "Insuline NovoNordisk (insuline humaine) (diverses formes d'action courte, rapide, intermédiaire, mixte et prolongée)",
    "perfusion solutions": "Solutions pour perfusion",
}


def cle_table(s):
    return " ".join(s.lower().split())


def fetch_texte(url):
    """Télécharge un fichier BDPM (encodage variable selon le fichier : UTF-8 ou latin-1)."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1", "ignore")


def cle(s):
    """Clé de comparaison : mots sans accents ni casse, sans mots vides, triés (l'ordre varie : « acide X » / « X (acide) »)."""
    return tuple(sorted(m for m in mots(s) if m not in VIDES_FR))


def charger_bdpm():
    """(noms, par_cis, cis_par_marque) ou None. noms : clé -> nom BDPM le plus employé."""
    try:
        compo = fetch_texte(BDPM_BASE + "CIS_COMPO_bdpm.txt")
        spec = fetch_texte(BDPM_BASE + "CIS_bdpm.txt")
    except Exception as e:
        print("AVERTISSEMENT : BDPM injoignable (%s) — noms de la veille repris si possible" % e)
        return None
    cnt = collections.Counter()
    par_cis = collections.defaultdict(set)
    for ln in compo.splitlines():
        f = ln.split("\t")
        if len(f) < 4 or not f[3].strip():
            continue
        nom = f[3].strip()
        cnt[nom] += 1
        par_cis[f[0].strip()].add(nom)
    noms = {}
    for nom, _ in cnt.most_common():
        noms.setdefault(cle(nom), nom)
    if len(noms) < MIN_SUBSTANCES_BDPM:
        print("AVERTISSEMENT : BDPM douteuse (%d substances < %d) — noms de la veille repris si possible" % (len(noms), MIN_SUBSTANCES_BDPM))
        return None
    marque = collections.defaultdict(set)
    for ln in spec.splitlines():
        f = ln.split("\t")
        if len(f) > 1 and mots(f[1]):
            marque[mots(f[1])[0]].add(f[0].strip())
    return noms, par_cis, marque


def candidats_mot(w):
    out = list(LEXIQUE.get(w, []))
    out += [w, w + "e"]
    if w.endswith("ic") and len(w) > 5:
        out.append(w[:-1] + "que")        # clavulanic → clavulanique
    if w.endswith("s") and len(w) > 4:
        out += [w[:-1], w[:-1] + "e"]
    return list(dict.fromkeys(out))


def par_regles(noms, comp):
    """Propose des candidats (règles régulières) ; seul un candidat PRÉSENT dans la BDPM est rendu."""
    mt = mots(comp)
    if not mt or len(mt) > 5:
        return None
    trouves = {}
    for combo in itertools.islice(itertools.product(*[candidats_mot(w) for w in mt]), 600):
        k = tuple(sorted(c for c in combo if c not in VIDES_FR))
        if k in noms:
            trouves[k] = noms[k]
    if len(trouves) == 1:
        return list(trouves.values())[0]
    k0 = tuple(sorted(mt))
    return trouves.get(k0)          # plusieurs candidats : on ne garde que la forme identique à l'anglais, sinon rien


def par_pont(par_cis, cis, comp):
    """Pont par spécialité : parmi les substances de la composition des CIS liés à la ligne, la seule qui ressemble."""
    e = " ".join(cle(comp))
    meilleur = []
    for n in {n for c in cis for n in par_cis.get(c, ())}:
        r = difflib.SequenceMatcher(None, e, " ".join(cle(n))).ratio()
        if r >= SEUIL_PONT:
            meilleur.append((r, n))
    meilleur.sort(reverse=True)
    if meilleur and (len(meilleur) == 1 or meilleur[0][0] - meilleur[1][0] >= 0.05):
        return meilleur[0][1]
    return None


def composants(inn):
    """Sépare « a;b », « a / b », « a, b » en dehors des parenthèses."""
    out, cur, prof = [], "", 0
    for ch in inn:
        prof += (ch == "(") - (ch == ")")
        if prof <= 0 and ch in ";/,":
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [c.strip() for c in out if c.strip()]


def traduire(bdpm, inn, cis=(), pont=True, table=True):
    """(texte français, [sources]) ou (None, raison). Tout ou rien : un composant sans équivalent = ligne en anglais."""
    if not bdpm or not inn:
        return None, ["pas de substance" if bdpm else "BDPM indisponible"]
    noms, par_cis, _ = bdpm
    res, src = [], []
    for c in composants(inn):
        fr, how = par_regles(noms, c), "BDPM (règle)"
        if fr is None and pont and cis:
            fr, how = par_pont(par_cis, cis, c), "pont CIS"
        if fr is None and table:
            fr, how = TABLE_SUBSTANCES.get(cle_table(c)), "table"     # dernier recours, après la BDPM
        if fr is None:
            return None, ["« %s » absent de la BDPM" % c]
        res.append(fr.lower())
        src.append(how)
    return " ; ".join(res), src


def titre_parentheses(bdpm, nom, inn, cis=()):
    """(13/10/2026) « Marque (substance) » : si une parenthèse est EXACTEMENT (casse près) une des substances `inn`
    de la ligne et qu'elle a un nom français, on la remplace ; le reste du titre ne bouge pas. (None, []) sinon."""
    subs = {cle_table(c) for c in composants(inn)}
    src_all, sortie = [], nom
    for m in reversed(list(re.finditer(r"\(([^()]*)\)", nom))):
        if cle_table(m.group(1)) not in subs:
            continue
        fr, src = traduire(bdpm, m.group(1).strip(), cis)
        if fr:
            sortie = sortie[:m.start(1)] + fr + sortie[m.end(1):]
            src_all += src
    return (sortie, src_all) if src_all else (None, [])


def cis_de(bdpm, nom, cips, pivot_data):
    """CIS reliés à la ligne : ceux des références rapprochées (table pivot) + ceux dont la marque est celle de l'EMA."""
    _, _, marque = bdpm
    out = {str(pivot_data[c]["cis"]) for c in cips if c in pivot_data and pivot_data[c].get("cis")}
    for b in re.split(r"[/,]", nom):
        m = mots(b)
        if m and len(m[0]) >= 4:
            out |= marque.get(m[0], set())
    return out


def charger_veille():
    """{(name, inn) -> ligne} du ema-penuries.json déjà en place ; {} si absent ou illisible. Une clé en double
    dont les traductions diffèrent est écartée (on ne devine pas)."""
    try:
        veille = {}
        tr = lambda y: (y.get("inn_fr"), y.get("name_fr"), y.get("fr_table"))
        for x in json.load(io.open(OUT, "r", encoding="utf-8"))["items"]:
            k = (x["name"], x["inn"])
            veille[k] = x if k not in veille or (veille[k] and tr(veille[k]) == tr(x)) else None
        return veille
    except Exception as e:
        print("AVERTISSEMENT : fichier de la veille illisible (%s) — rien à reprendre" % e)
        return {}


def pivot_data():
    try:
        piv = json.load(io.open(PIVOT, "r", encoding="utf-8"))
        return piv.get("data", piv)
    except Exception:
        return {}


def lire(contenu):
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(contenu), data_only=True)
    rows = list(wb.active.iter_rows(values_only=True))
    hidx = next((i for i, r in enumerate(rows[:30]) if r and any(str(c).strip() == "Medicine affected" for c in r if c)), None)
    if hidx is None:
        raise ValueError("en-tête « Medicine affected » introuvable")
    H = {str(h).strip(): i for i, h in enumerate(rows[hidx]) if h}

    def g(r, prefix):
        for k, i in H.items():
            if k.startswith(prefix):
                return r[i] if i < len(r) else None
        return None
    gen = []
    for r in rows[hidx + 1:]:
        nom = str(g(r, "Medicine affected") or "").strip()
        if nom:
            gen.append((nom, r, g))
    return gen


def main():
    try:
        contenu = fetch(URL)
        lignes = lire(contenu)
    except Exception as e:
        print("ERREUR : %s — JSON existant conservé" % e)
        return 1
    if len(lignes) < MIN_LIGNES:
        print("ERREUR : %d lignes lues (< %d) — JSON existant conservé" % (len(lignes), MIN_LIGNES))
        return 1
    cat = catalogue()
    bdpm = charger_bdpm()
    veille = {} if bdpm else charger_veille()      # lu AVANT l'écriture de OUT
    n_veille = 0
    piv = pivot_data()
    items = []
    trace = []
    for nom, r, g in lignes:
        inn = str(g(r, "International non-proprietary") or "").strip()
        exp = g(r, "Expected resolution date")
        exp_txt = g(r, "Expected resolution")
        cips, alt = rapprocher(cat, nom, inn)
        pub = iso_date(g(r, "First published"))
        cis = cis_de(bdpm, nom, cips, piv) if bdpm else ()
        inn_fr, src = traduire(bdpm, inn, cis) if inn else (None, ["pas de substance"])
        name_fr, src_nom = None, []
        if bdpm and (not inn or mots(nom) == mots(inn)):          # le titre n'est qu'une substance : on le traduit aussi
            name_fr, src_nom = traduire(bdpm, nom, pont=False)
            if name_fr and not inn:
                src = ["titre : " + ("table" if "table" in src_nom else "BDPM (règle)")]
        if bdpm and not name_fr and cle_table(nom) in TABLE_TITRES:    # titre qui n'est pas une substance : table, après la BDPM
            name_fr, src_nom = TABLE_TITRES[cle_table(nom)], ["table"]
            src = src + ["titre : table"] if inn else ["titre : table"]
        if bdpm and not name_fr and inn_fr:                            # 13/10/2026 : « Marque (substance) » → la parenthèse passe en français
            name_fr, src_nom = titre_parentheses(bdpm, nom, inn, cis)
        v = veille.get((nom, inn))                                     # BDPM injoignable : noms de la veille, si name ET inn identiques
        if v and (v.get("inn_fr") or v.get("name_fr")):
            inn_fr, name_fr, n_veille = v.get("inn_fr") or None, v.get("name_fr") or None, n_veille + 1
        fr_table = [k for k, ok in (("inn_fr", inn_fr and "table" in src), ("name_fr", name_fr and "table" in src_nom)) if ok]
        trace.append((nom, inn, inn_fr, name_fr, src))
        items.append({
            "name": nom, "inn": inn, "inn_fr": inn_fr or "", "name_fr": (name_fr[:1].upper() + name_fr[1:]) if name_fr else "",
            "status": str(g(r, "Supply shortage status") or "").strip(),
            "start": iso_date(g(r, "Start of shortage")) or pub,
            "start_is_pub": not iso_date(g(r, "Start of shortage")),
            "resolution": iso_date(exp), "resolution_txt": str(exp_txt).strip() if exp_txt not in (None, "") and not iso_date(exp) else "",
            "alternatives": str(g(r, "Availability of alternatives") or "").strip(),
            "updated": iso_date(g(r, "Last updated")),
            "url": str(g(r, "Shortage URL") or "").strip(),
            "cips": cips, "cips_dci": alt,
        })
        if v and v.get("fr_table") and (inn_fr or name_fr):
            fr_table = list(v["fr_table"])
        if fr_table:
            items[-1]["fr_table"] = fr_table      # nom écrit à la main (table de secours), pas un nom officiel BDPM
    res = {"generated": datetime.date.today().isoformat(), "source": "EMA — European Medicines Agency (catalogue des pénuries)",
           "n": len(items), "items": items}
    tmp = OUT + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)
    n_us = sum(1 for x in items if x["cips"])
    print("OK · %d lignes · %d avec une référence du catalogue (marque + substance)" % (len(items), n_us))
    if not bdpm:
        print("AVERTISSEMENT : BDPM indisponible — %d ligne(s) reprise(s) de la veille (noms français), %d en anglais" %
              (n_veille, len(items) - n_veille))
    n_tr = sum(1 for x in items if x["inn_fr"] or x["name_fr"])
    print("Substances : %d lignes, %d traduites (BDPM ou table de secours), %d gardées en anglais%s" %
          (len(items), n_tr, len(items) - n_tr, "" if bdpm else " — BDPM indisponible"))
    if os.environ.get("EMA_TRACE"):
        with io.open(os.environ["EMA_TRACE"], "w", encoding="utf-8") as f:
            for t in trace:
                f.write("\t".join([t[0], t[1], t[2] or "", t[3] or "", " + ".join(t[4])]) + "\n")
    print("dont %d lignes avec au moins un nom venu de la table de secours" % sum(1 for x in items if x.get("fr_table")))
    for x in items[:3]:
        print("  %s | %s | %s | début %s | fin %s%s" % (x["name"][:28], x["inn"][:24], x["status"], x["start"], x["resolution"] or "-", x["resolution_txt"]))
    print("→ %s (%d o)" % (OUT, os.path.getsize(OUT)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

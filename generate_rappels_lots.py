#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_rappels_lots.py — Veille APPRO/QUALITÉ : RAPPELS DE LOTS de MÉDICAMENTS (ANSM).

Complète generate_rappels.py (RappelConso = parapharma/cosmétique, GTIN commerciaux) qui
ne couvre PAS le médicament. Ici la source officielle du rappel de lot pharmaceutique :
page ANSM « Informations de sécurité » (rendue côté serveur, un simple GET).

Chaque carte de listing porte la catégorie (« RAPPEL DE PRODUIT »), le type de produit
(« Médicaments »), la date de publication et le niveau de rappel. La FICHE porte la pépite :
le CIP (souvent écrit espacé « 34009 301 763 4 4 ») et les NUMÉROS DE LOT + péremption.

CIP13 + n° de lot = le seul flux public qui se croise directement avec le stock Intégral :
« ce lot est rappelé ET on l'a en stock » → bloquer/retourner, ce n'est pas de la veille.

Écrit crm/v2/rappels-lots.json. Python 3.9, urllib + html seuls. Aucune clé, gratuit.
"""
import io
import os
import re
import json
import html
import datetime
import urllib.request

HOST = "https://ansm.sante.fr"
LIST = HOST + "/informations-de-securite/?page=%d"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "rappels-lots.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")
STOCK = os.path.join(HERE, "crm", "v2", "stock-data.js")

MAX_PAGES = int(os.environ.get("ANSM_RL_PAGES", "12"))   # 12 × 20 = 240 fiches balayées
MAX_AGE_DAYS = int(os.environ.get("ANSM_RL_DAYS", "540"))  # fenêtre 18 mois
PRODUITS = ("médicament", "vaccin", "produit biologique")  # on ignore les dispositifs médicaux
MAX_ITEMS = 120


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "ignore")


def txt(s):
    s = re.sub(r"<script.*?</script>", " ", s or "", flags=re.S | re.I)
    s = re.sub(r"<style.*?</style>", " ", s, flags=re.S | re.I)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def span(block, cls):
    m = re.search(r'<span class="%s[^"]*">(.*?)</span>' % cls, block, re.S)
    return txt(m.group(1)) if m else ""


def parse_list(h):
    """Cartes du listing → slug, catégorie, type de produit, date, titre, niveau de rappel."""
    out = []
    for block in re.findall(r"<article[^>]*class=\"[^\"]*article-item[^\"]*\"[^>]*>(.*?)</article>", h, re.S):
        a = re.search(r'href="(/informations-de-securite/[^"]+)"', block)
        if not a:
            continue
        out.append({
            "slug": a.group(1),
            "cat": span(block, "article-category"),
            "prod": span(block, "article-health-product"),
            "date": span(block, "article-date"),
            "titre": span(block, "article-title"),
            "niv": span(block, "article-content"),
        })
    return out


def content_block(h):
    """Corps de la fiche = TOUS les div.wysiwyg-content, chacun extrait en comptant les div
    imbriquées. Deux pièges rencontrés : un non-greedy s'arrête au 1er </div> (fiche vidée),
    et la liste des lots vit souvent dans un SECOND bloc (ex. Doliprane, 27 lots)."""
    h = re.sub(r"<script.*?</script>", " ", h, flags=re.S | re.I)
    parts = []
    for m in re.finditer(r'<div[^>]*class="[^"]*wysiwyg-content[^"]*"[^>]*>', h):
        start = m.end()
        depth, pos = 1, min(len(h), start + 20000)
        for tag in re.finditer(r"<(/?)div\b[^>]*>", h[start:]):
            depth += -1 if tag.group(1) else 1
            if depth == 0:
                pos = start + tag.start()
                break
        parts.append(h[start:pos])
    return " ".join(parts) if parts else h


def to_iso(d):
    """« PUBLIÉ LE 27/07/2026 » → 2026-07-27."""
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", d or "")
    return "%s-%s-%s" % (m.group(3), m.group(2), m.group(1)) if m else ""


def cips_of(t):
    """CIP13 écrits collés OU espacés (« 34009 301 763 4 4 »). On ne garde que du 13 chiffres."""
    out = []
    for m in re.finditer(r"3400\s*9[\s\d]{8,16}", t):
        digits = re.sub(r"\D", "", m.group(0))[:13]
        if len(digits) == 13 and digits not in out:
            out.append(digits)
    return out


TOKEN = r"[A-Z0-9][A-Z0-9\.\-/]{2,15}"
STOP_LOT = {"DE", "DES", "LES", "N", "MENTIONNES", "CONCERNES", "SUIVANTS", "EXP", "CIP", "PUIS"}


def _add_lot(out, seen, num, exp):
    num = (num or "").strip(" .;,-/")
    if len(num) < 3 or not re.search(r"\d", num) or num.upper() in STOP_LOT:
        return
    if len(re.sub(r"\D", "", num)) >= 13:      # un CIP n'est pas un lot
        return
    if re.match(r"^\d{2}/\d{4}$", num):        # une date n'est pas un lot
        return
    if num in seen:
        return
    seen.add(num)
    out.append({"n": num, "exp": re.sub(r"\s", "", exp) if exp else ""})


def lots_of(t):
    """Trois écritures ANSM rencontrées :
       « Lot M405432 (exp. 04/2027) » · « Lot 454702 – 09/2027 » · liste « L033 (EXP 08/2027) ; L034 … »."""
    out, seen = [], set()
    # 1) tout jeton suivi d'une péremption (couvre les listes séparées par ; ou ,)
    for m in re.finditer(r"(%s)\s*[-–—]?\s*\(?\s*(?:EXP|exp|[Pp]éremption|[Pp]ér|[Pp]er)\w*\.?\s*:?\s*\(?\s*(\d{2}\s*/\s*\d{4})" % TOKEN, t):
        _add_lot(out, seen, m.group(1), m.group(2))
    # 2) « Lot 454702 – 09/2027 »
    for m in re.finditer(r"[Ll]ots?\s*(?:n[°o]\s*)?:?\s*(%s)\s*[–—-]\s*(\d{2}\s*/\s*\d{4})" % TOKEN, t):
        _add_lot(out, seen, m.group(1), m.group(2))
    # 3) tableau « Lots | Date de péremption » : paires « 4F8986 31/12/2026 » (sans le mot « Lot »)
    tb = re.search(r"[Ll]ots?\s+Date de p[ée]remption\s*(.{10,3000}?)(?:Ce rappel|Ce d[ée]faut|$)", t, re.S)
    if tb:
        for m in re.finditer(r"(%s)\s+(\d{2}/\d{2}/\d{4})" % TOKEN, tb.group(1)):
            _add_lot(out, seen, m.group(1), m.group(2))
    # 4) « Lot XXX » sans péremption
    for m in re.finditer(r"[Ll]ots?\s*(?:n[°o]\s*)?:?\s*(%s)(?![\w/])" % TOKEN, t):
        _add_lot(out, seen, m.group(1), "")
    return out[:40]


def fiche(slug):
    try:
        h = fetch(HOST + slug)
    except Exception:
        return None
    body = txt(content_block(h))
    if len(body) > 8000:
        body = body[:8000]
    niv = re.search(r"Niveau de rappel\s*:?\s*([^.]{3,140})", body)
    motif = re.search(r"(?:fait suite (?:à|a)|en raison de|Ce rappel)\s+(.{20,260}?)(?:\.\s|$)", body)
    return {
        "cips": cips_of(body),
        "lots": lots_of(body),
        "niv": niv.group(1).strip() if niv else "",
        "motif": motif.group(1).strip() if motif else "",
    }


def catalogue():
    """CIP13 → (libellé, nb officines) depuis PROD_STATS."""
    try:
        t = io.open(PRODSTATS, "r", encoding="utf-8").read()
        arr = json.loads(t[t.index("["):t.rindex("]") + 1])
        return {str(p.get("c")): (p.get("d") or "", p.get("n") or 0) for p in arr if p.get("c")}
    except Exception:
        return {}


def stock():
    """CIP13 → unités en stock plateforme (STOCK_IP.data)."""
    try:
        t = io.open(STOCK, "r", encoding="utf-8").read()
        return {m.group(1): int(m.group(2)) for m in re.finditer(r'"(\d{13})":(\d+)', t)}
    except Exception:
        return {}


def main():
    cat, stk = catalogue(), stock()
    today = datetime.date.today()
    cutoff = today - datetime.timedelta(days=MAX_AGE_DAYS)
    cards, pages_lues = [], 0

    for pg in range(1, MAX_PAGES + 1):
        try:
            rows = parse_list(fetch(LIST % pg))
        except Exception:
            break
        if not rows:
            break
        pages_lues = pg
        dans_fenetre = 0
        for r in rows:
            iso = to_iso(r["date"])
            if iso:
                try:
                    if datetime.date.fromisoformat(iso) < cutoff:
                        continue
                except ValueError:
                    pass
            dans_fenetre += 1
            if "RAPPEL" not in (r["cat"] or "").upper():
                continue
            if not any(p in (r["prod"] or "").lower() for p in PRODUITS):
                continue
            r["iso"] = iso
            cards.append(r)
        # le listing est antéchronologique : on ne s'arrête que si TOUTE la page est hors fenêtre
        if dans_fenetre == 0:
            break

    items, n_cip, n_cat, n_stk, u_stk = [], 0, 0, 0, 0
    for c in cards[:MAX_ITEMS]:
        d = fiche(c["slug"]) or {"cips": [], "lots": [], "niv": "", "motif": ""}
        cips = d["cips"]
        if cips:
            n_cip += 1
        hits = [x for x in cips if x in cat]
        in_stock = [(x, stk[x]) for x in cips if stk.get(x)]
        if hits:
            n_cat += 1
        if in_stock:
            n_stk += 1
            u_stk += sum(q for _, q in in_stock)
        titre = c["titre"] or ""
        lab = ""
        if "–" in titre:
            lab = titre.rsplit("–", 1)[1].strip()
        items.append({
            "d": c["iso"],
            "t": titre[:120],
            "lab": lab[:60],
            "niv": (d["niv"] or c["niv"] or "").replace("Niveau de rappel :", "").strip()[:120],
            "motif": d["motif"][:220],
            "cips": cips[:8],
            "lots": d["lots"][:30], "nl": len(d["lots"]),
            "cat": [{"c": x, "d": cat[x][0][:40], "n": cat[x][1]} for x in hits[:6]],
            "stk": [{"c": x, "q": q} for x, q in in_stock[:6]],
            "url": HOST + c["slug"],
        })

    # les rappels qui touchent VRAIMENT le stock d'abord, puis le catalogue, puis la date
    items.sort(key=lambda x: (bool(x["stk"]), bool(x["cat"]), x["d"]), reverse=True)

    out = {
        "generated": today.isoformat(),
        "source": "ANSM — Informations de sécurité (rappels de lots médicaments)",
        "meta": {"nFiches": len(cards), "nPages": pages_lues, "nItems": len(items), "nAvecCip": n_cip,
                 "nCatalogue": n_cat, "nEnStock": n_stk, "unitesEnStock": u_stk,
                 "fenetreJours": MAX_AGE_DAYS},
        "items": items,
    }
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · rappels médicaments=%d · avec CIP=%d · au catalogue=%d · EN STOCK=%d (%d unités)"
          % (len(items), n_cip, n_cat, n_stk, u_stk))
    for it in items[:6]:
        flag = "STOCK" if it["stk"] else ("CATALOGUE" if it["cat"] else "         ")
        print("  %s %s  %s  lots=%d  cip=%s" % (flag, it["d"], it["t"][:52], len(it["lots"]), ",".join(it["cips"][:2]) or "-"))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()

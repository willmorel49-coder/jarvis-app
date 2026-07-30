#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_rappels.py — Veille APPRO/QUALITÉ : rappels de produits (RappelConso, DGCCRF).

Complète les rappels MÉDICAMENTS (ANSM, déjà branchés) par les rappels PARAPHARMA / NR :
cosmétiques, hygiène-beauté, produits bébé, compléments… Deux signaux :
  1) MATCH CATALOGUE (le + fort) : un GTIN rappelé = une réf que le réseau distribue
     → arrêter la distribution, prévenir le fournisseur. Toutes catégories.
  2) PARAPHARMA récent : rappels hygiène-beauté / bébés récents (pertinents comptoir).

Source : data.economie.gouv.fr — dataset rappelconso-v2-gtin-espaces (ODS v2.1, gratuit, sans clé).
Écrit crm/v2/rappels.json. Python 3.9, urllib seul.
"""
import io
import os
import json
import datetime
import urllib.parse
import urllib.request

DS = "rappelconso-v2-gtin-espaces"
BASE = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/" + DS + "/records"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "crm", "v2", "rappels.json")
PRODSTATS = os.path.join(HERE, "crm", "v2", "prod-stats-data.js")

PARA_CATS = {"hygiène-beauté"}   # cosmétiques/dermo vendus en officine (bébés-enfants = surtout jouets, hors sujet)
PARA_DAYS = 180          # fenêtre « récent » pour la liste parapharma
MAX_PAGES = 6            # 6 × 100 = 600 fiches les plus récentes balayées
MAX_PARA = 25


def fetch_page(offset):
    params = [("limit", "100"), ("offset", str(offset)), ("order_by", "date_publication desc")]
    url = BASE + "?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip
            raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8", "ignore")).get("results", [])


def gtins_of(rec):
    out = []
    for v in (rec.get("identification_produits") or []):
        s = "".join(ch for ch in str(v) if ch.isdigit())
        if len(s) == 13:
            out.append(s)
    return out


def catalogue():
    try:
        txt = io.open(PRODSTATS, "r", encoding="utf-8").read()
        arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
        return {str(p.get("c")): (p.get("n") or 0) for p in arr if p.get("c")}
    except Exception:
        return {}


def clip(s, n=90):
    s = (s or "").strip()
    return s[:n] + "…" if len(s) > n else s


def main():
    cat = catalogue()
    today = datetime.date.today()
    matched, para = [], []
    seen_fiche = set()

    for pg in range(MAX_PAGES):
        try:
            recs = fetch_page(pg * 100)
        except Exception:
            break
        if not recs:
            break
        for r in recs:
            fiche = r.get("numero_fiche")
            if fiche in seen_fiche:
                continue
            seen_fiche.add(fiche)
            dpub = (r.get("date_publication") or "")[:10]
            gts = gtins_of(r)
            item = {
                "d": clip(r.get("libelle") or r.get("modeles_ou_references"), 70),
                "marque": clip(r.get("marque_produit"), 40),
                "cat": r.get("categorie_produit") or "",
                "motif": clip(r.get("motif_rappel"), 110),
                "risque": clip(r.get("risques_encourus"), 60),
                "date": dpub,
                "url": r.get("lien_vers_la_fiche_rappel") or "",
            }
            hit = next((g for g in gts if g in cat), None)
            if hit:
                item["gtin"] = hit
                item["n"] = cat.get(hit, 0)
                matched.append(item)
            elif r.get("categorie_produit") in PARA_CATS:
                try:
                    age = (today - datetime.date.fromisoformat(dpub)).days
                except Exception:
                    age = 9999
                if age <= PARA_DAYS:
                    para.append(item)

    matched.sort(key=lambda x: (x.get("n", 0), x.get("date", "")), reverse=True)
    para.sort(key=lambda x: x.get("date", ""), reverse=True)

    out = {"generated": today.isoformat(),
           "source": "RappelConso (DGCCRF) — data.economie.gouv.fr",
           "nMatched": len(matched), "nPara": len(para),
           "matched": matched, "para": para[:MAX_PARA]}
    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("OK · catalogue=%d · rappels match catalogue=%d · parapharma récents=%d" % (len(cat), len(matched), len(para)))
    for m in matched[:5]:
        print("  MATCH %s  %s  (ventes %d) — %s" % (m.get("gtin"), m["d"][:30], m.get("n", 0), m["risque"]))
    for p in para[:3]:
        print("  para  %s  %s — %s" % (p["date"], p["d"][:30], p["risque"]))
    print("→ %s (%d o)" % (OUT, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()

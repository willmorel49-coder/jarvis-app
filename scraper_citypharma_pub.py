#!/usr/bin/env python3
"""Relevé des prix PUBLICS de la boutique en ligne Citypharma (pharmacie-citypharma.fr), TTC.

robots.txt lu le 30/10/2026 : « User-Agent: * / Allow: / » — rien d'interdit. On utilise le
mécanisme de la liste de produits du site lui-même (la même réponse JSON que celle que son
propre écran de liste demande), avec `curl` et son identité par défaut : aucun faux navigateur.
Une seule requête à la fois, 3 s entre deux, au plus 1 500 requêtes par lancement.
Premier code 403, 429 ou 503 (ou page qui n'est pas du JSON) : arrêt immédiat et définitif,
aucun nouvel essai, aucune autre identité, aucun contournement.

  python3 scraper_citypharma_pub.py <sortie.jsonl>     (reprend là où il s'est arrêté)
Une ligne par produit : {id, ean, nom, prix, prix_barre, achetable, cat, url, rayon, page}.
Le relevé est ensuite traité par scripts/generate_plateformes_pub.py (branche « citypharma »).
"""
import json, subprocess, sys, time, os

BASE = "https://pharmacie-citypharma.fr"
RAYONS = ["sante-bien-etre", "complements-alimentaires", "medecines-douces", "beaute-hygiene",
          "bebe-enfant-maman", "nutrition-minceur-sport", "orthopedie-contention", "veterinaire",
          "voyage", "medicaments"]
DELAY = 3.0
MAX_REQ = 1500


def demander(url):
    """Une requête `curl` par défaut. Rend (code HTTP, corps)."""
    r = subprocess.run(["curl", "-s", "--max-time", "40", "-w", "\n%{http_code}",
                        "-H", "Accept: application/json, text/javascript, */*; q=0.01",
                        "-H", "X-Requested-With: XMLHttpRequest", url],
                       capture_output=True, text=True)
    corps, _, code = r.stdout.rpartition("\n")
    return (int(code) if code.isdigit() else 0), corps


def ligne(p, rayon, page, pages):
    return {"id": p["id_product"], "ean": p.get("reference", ""), "nom": p["name"],
            "prix": p.get("price_amount"), "prix_barre": p.get("regular_price_amount"),
            "achetable": bool(p.get("add_to_cart_url")), "cat": p.get("category_name", ""),
            "url": p.get("url", ""), "rayon": rayon, "page": page, "pages": pages}


def main():
    sortie = sys.argv[1]
    faites, totaux = set(), {}
    if os.path.exists(sortie):
        for l in open(sortie, encoding="utf8"):
            if l.strip():
                r = json.loads(l)
                faites.add((r["rayon"], r["page"]))
                totaux[r["rayon"]] = r["pages"]
    n = 0
    with open(sortie, "a", encoding="utf8") as out:
        for rayon in RAYONS:
            page, total_pages = 1, totaux.get(rayon)
            while total_pages is None or page <= total_pages:
                if (rayon, page) in faites:
                    page += 1
                    continue
                if n >= MAX_REQ:
                    print("budget atteint", n, flush=True); return 0
                code, corps = demander("%s/fr/%s/?page=%d&from-xhr" % (BASE, rayon, page))
                n += 1
                if code == 0:  # aucune réponse HTTP (délai dépassé, réseau) : ce n'est pas un refus du site -> une seule reprise, après une pause
                    time.sleep(30)
                    code, corps = demander("%s/fr/%s/?page=%d&from-xhr" % (BASE, rayon, page))
                    n += 1
                if code in (403, 429, 503):
                    print("BLOCAGE", code, "→ arrêt immédiat et définitif", rayon, page, flush=True); return 3
                try:
                    d = json.loads(corps)
                except Exception:
                    print("réponse non JSON (code %s) → arrêt immédiat" % code, rayon, page, flush=True); return 4
                if code != 200:
                    print("code inattendu", code, "→ arrêt", rayon, page, flush=True); return 4
                total_pages = d["pagination"]["pages_count"]
                for p in d["products"]:
                    out.write(json.dumps(ligne(p, rayon, page, total_pages), ensure_ascii=False) + "\n")
                out.flush()
                if page % 10 == 1:
                    print(rayon, page, "/", total_pages, "req", n, flush=True)
                page += 1
                time.sleep(DELAY)
    print("terminé", n, "requêtes", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

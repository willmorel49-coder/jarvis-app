#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pharmazon-releve.test.py — generate_pharmazon.py : connexion vraiment contrôlée, date du relevé écrite, aucun prix dans le public.

Le 18/11/2026, login() a dit « connecté » alors que Pharmazon refusait le mot de passe : les mots « logout » et
« Mon compte » figurent aussi sur la page « Connexion client ». Et l'écran Concurrents affichait « Relevé du
14/05/2026 » écrit en dur. Ce test rejoue les deux cas, sans réseau ni identifiant (faux curl, faux bs4).
Lancer : python3 tests/pharmazon-releve.test.py
"""
import datetime
import importlib.util
import os
import re
import sys
import tempfile

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ["PHARMAZON_EMAIL"] = "essai@exemple.fr"
os.environ["PHARMAZON_PWD"] = "essai"
import bs4  # noqa: F401 — vraie lecture HTML pour les listes de produits (installée par ci.yml)
spec = importlib.util.spec_from_file_location("gp", os.path.join(RACINE, "generate_pharmazon.py"))
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

# ── 1. connexion : la page « Connexion client » ne doit JAMAIS passer pour une connexion réussie ──
PAGE_CONNEXION = ('<title>Connexion client</title><a href="/customer/account/logout/">x</a> Mon compte '
                  '<form action="https://www.sra-pharmazon.com/customer/account/loginPost/"><input name="form_key" value="abc"></form>')
PAGE_COMPTE = '<title>Mon compte</title><a href="/customer/account/logout/">Déconnexion</a> Bonjour'


def rejoue(compte):
    g.curl = lambda url, **k: compte if url.endswith("/customer/account/") else PAGE_CONNEXION
    return g.login()


assert rejoue(PAGE_CONNEXION) is False, "mot de passe refusé (renvoi vers « Connexion client ») pris pour une connexion"
assert rejoue(PAGE_COMPTE) is True, "vraie page « Mon compte » refusée"
assert rejoue("") is False, "réponse vide prise pour une connexion"

# ── 1 bis. liste d'un labo : Pharmazon répète le même produit en tête de chaque page (relevé du 18/11/2026) ──
def page(skus):
    return "".join('<form class="product-item" data-sku="%s"><input name="product" value="%s">'
                   '<a class="product-item-link">P %s</a></form>' % (s, s, s) for s in skus)


def liste(pages):
    g.time.sleep = lambda s: None
    g.curl = lambda url, **k: pages.get(int(url.rsplit("p=", 1)[1]), pages[max(pages)])
    return [it["sku"] for it in g.labo_products("62", "LABO")]


EN_TETE = "9884874"
p1 = [EN_TETE] + ["a%d" % i for i in range(12)]
p2 = [EN_TETE] + ["b%d" % i for i in range(12)]
p3 = [EN_TETE] + ["c%d" % i for i in range(5)]
vus = liste({1: page(p1), 2: page(p2), 3: page(p3)})
assert len(vus) == 30 and "b0" in vus and "c4" in vus, "liste coupée à la page 2 : %d produits au lieu de 30" % len(vus)
# au-delà de la dernière page, le site resert une page déjà vue : la liste s'arrête, sans doublon
vus = liste({1: page(p1), 2: page(p2), 3: page(p2)})
assert len(vus) == 25 and len(set(vus)) == 25, "fin de liste mal vue : %d produits" % len(vus)

# ── 1 ter. codes d'une fiche : EAN ET CIP13 du bloc « product-codes » (forme réelle relevée le 18/11 sur la fiche 24821) ──
def fiche(codes, tete=""):
    bloc = ",".join('&#x7B;&quot;key&quot;&#x3A;&quot;%s&quot;,&quot;label&quot;&#x3A;&quot;%s&quot;,&quot;value&quot;&#x3A;&quot;%s&quot;&#x7D;'
                    % (k, k.upper(), v) for k, v in codes)
    return tete + '<div class="product-codes"\n     x-data="{\n        codes: &#x5B;' + bloc + '&#x5D;, open: false }">'


CB12 = fiche([("ean", "3700343900292"), ("cip7", "6031539"), ("cip13", "3401360315396")],
             tete='<meta property="og:description" content="Ancien code 3401360315396">')
for page_fiche, attendu in [(CB12, ("3700343900292", "3401360315396")),  # l'ancien relevé gardait le CIP13 cité en tête de page
                            (fiche([("ean", "3401560221473"), ("cip13", "3401560221473")]), ("3401560221473", "")),
                            (fiche([("cip13", "3401161612823")]), ("3401161612823", "")),
                            ("<p>Code 3282770147797</p>", ("3282770147797", ""))]:  # pas de bloc : repli sur le 1er code
    g.curl = lambda url, **k: page_fiche
    assert g.fetch_codes("24821") == attendu, "codes lus %r au lieu de %r" % (g.fetch_codes("24821"), attendu)

# ── 2. fichiers écrits : date du relevé lue par l'écran, prix d'un tiers seulement dans le fichier protégé ──
with tempfile.TemporaryDirectory() as d:
    g.OUT = os.path.join(d, "pharmazon-data.js")
    g.write_out([{"sku": "S1", "id": "7", "name": "Gel 50 ml", "img": "", "labo": "LABO", "ean": "3401560221473",
                  "prix_final": 4.37, "prix_catalogue": 5.12, "remise": 14.6},
                 {"sku": "S2", "id": "8", "name": "Spray", "img": "", "labo": "CB12", "ean": "3700343900292", "cip": "3401360315396",
                  "prix_final": 3.1, "prix_catalogue": 0, "remise": 0}])
    pub = open(g.OUT, encoding="utf-8").read()
    assert '"cip": "3401360315396"' in pub, "CIP13 de la fiche absent du fichier public (identité, sans prix)"
    assert pub.count('"cip"') == 1, "champ cip vide écrit pour un produit sans CIP13 différent"
    prix = open(os.path.join(d, "pharmazon-prix.js"), encoding="utf-8").read()
    jour = datetime.date.today().isoformat()
    assert 'window.PHARMAZON_MAJ="%s"' % jour in pub, "date du relevé absente du fichier public"
    assert not re.search(r"prix_final|4\.37|5\.12|14\.6", pub), "un prix Pharmazon dans le fichier PUBLIC"
    assert '"3401560221473": [4.37, 5.12, 14.6]' in prix, "prix absent du fichier protégé"
    assert jour in prix.splitlines()[0], "date du relevé absente du fichier protégé"

# ── 3. l'écran lit la date dans le fichier, plus jamais en dur ──
conc = open(os.path.join(RACINE, "crm", "v2", "v2-concurrents.js"), encoding="utf-8").read()
bloc = conc[conc.index("pharmazon: {"):conc.index("etradi: {")]
assert "window.PHARMAZON_MAJ" in bloc and not re.search(r"maj: function \(\) \{ return '\d{4}-", bloc), "date Pharmazon écrite en dur"
print("pharmazon-releve.test.py : OK")

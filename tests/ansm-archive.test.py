#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
t-archive-ansm.py — le journal ANSM ne doit JAMAIS perdre un épisode terminé.

Pourquoi ce test existe : `ansm-histo.json` sert à dire « en tension depuis le … ».
Mais il écrase la date de début à chaque changement de statut, et supprime la ligne
120 j après sa sortie de la liste ANSM. Les deux effacent exactement la matière qui
permettrait un jour d'apprendre une durée de rupture (combien de temps ça dure, ce
qui revient vite, ce qui ne revient pas).

On exige donc un fichier d'archive append-only : un épisode CLOS = une ligne, avec
son statut, sa date de début, sa date de fin et sa durée en jours.

Le test charge les VRAIES fonctions du fichier livré (pas une copie) et redirige
les chemins d'écriture vers un dossier temporaire.
"""
import os
import sys
import json
import shutil
import tempfile
import importlib.util

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RACINE, "generate_ansm_dispo.py")

spec = importlib.util.spec_from_file_location("gad", SRC)
gad = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gad)

ECHECS = []


def check(nom, cond, detail=""):
    if cond:
        print("  ok   %s" % nom)
    else:
        print("  ÉCHEC %s  %s" % (nom, detail))
        ECHECS.append(nom)


def item(spec_lbl, statut, debut_officiel=None, maj=None):
    return {"spec": spec_lbl, "st": statut, "debutOfficiel": debut_officiel, "maj": maj}


def lire(chemin, cle):
    if not os.path.exists(chemin):
        return None
    with open(chemin, encoding="utf-8") as f:
        return json.load(f).get(cle)


def episodes(tmp):
    e = lire(os.path.join(tmp, "ansm-archive.json"), "episodes")
    return e if e is not None else []


def passe(tmp, lst, today):
    """Un passage du robot (comme la CI le fait une fois par jour)."""
    gad.HISTO = os.path.join(tmp, "ansm-histo.json")
    gad.ARCHIVE = os.path.join(tmp, "ansm-archive.json")
    return gad.maj_histo(lst, today)


def scenario(nom, fn):
    tmp = tempfile.mkdtemp(prefix="ansm-")
    print("\n▶ %s" % nom)
    try:
        fn(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── 1. Un changement de statut clôt l'épisode précédent ──────────────────────
def t1(tmp):
    lbl = "Amoxicilline Biogaran 1 g, comprime"
    passe(tmp, [item(lbl, "Rupture de stock", debut_officiel="2026-01-10")], "2026-01-15")
    check("rien d'archivé tant que rien n'est terminé", episodes(tmp) == [])

    # 40 jours plus tard le produit revient : l'épisode de rupture est TERMINÉ
    passe(tmp, [item(lbl, "Remise à disposition", debut_officiel="2026-01-10")], "2026-02-19")
    eps = episodes(tmp)
    check("l'épisode clos est archivé", len(eps) == 1, "trouvé %d" % len(eps))
    if not eps:
        return
    e = eps[0]
    check("statut de l'épisode conservé", e.get("st") == "Rupture de stock", repr(e.get("st")))
    check("date de début conservée", e.get("d") == "2026-01-10", repr(e.get("d")))
    check("date de fin = jour où on l'a observé", e.get("f") == "2026-02-19", repr(e.get("f")))
    check("durée calculée en jours", e.get("j") == 40, repr(e.get("j")))
    check("libellé conservé", (e.get("spec") or "").startswith("Amoxicilline"), repr(e.get("spec")))


# ── 2. La purge à 120 j archive avant de supprimer ───────────────────────────
def t2(tmp):
    lbl = "Tranxene 20 mg 2 ml, lyophilisat"
    passe(tmp, [item(lbl, "Tension d'approvisionnement", debut_officiel="2025-11-26")], "2026-01-05")
    # le signalement disparaît de la liste ANSM
    passe(tmp, [], "2026-01-06")
    check("toujours dans le journal juste après la sortie", lire(os.path.join(tmp, "ansm-histo.json"), "items"))
    # 121 jours plus tard : purge
    passe(tmp, [], "2026-05-10")
    restant = lire(os.path.join(tmp, "ansm-histo.json"), "items") or {}
    eps = episodes(tmp)
    check("purgé du journal courant", restant == {}, "reste %d entrée(s)" % len(restant))
    check("mais ARCHIVÉ avant la purge", len(eps) == 1, "trouvé %d" % len(eps))
    if eps:
        check("fin = date de sortie de liste, pas date de purge",
              eps[0].get("f") == "2026-01-06", repr(eps[0].get("f")))
        check("durée depuis le vrai début", eps[0].get("j") == 41, repr(eps[0].get("j")))


# ── 3. Append-only : ni écrasement ni doublon ────────────────────────────────
def t3(tmp):
    a = "Produit A 10 mg"
    b = "Produit B 20 mg"
    passe(tmp, [item(a, "Rupture de stock", debut_officiel="2026-01-01")], "2026-01-02")
    passe(tmp, [item(a, "Remise à disposition", debut_officiel="2026-01-01")], "2026-01-20")
    check("1 épisode après le 1er retour", len(episodes(tmp)) == 1)

    # passages suivants sans rien de nouveau : l'archive ne bouge pas
    passe(tmp, [item(a, "Remise à disposition", debut_officiel="2026-01-01")], "2026-01-21")
    passe(tmp, [item(a, "Remise à disposition", debut_officiel="2026-01-01")], "2026-01-22")
    check("aucun doublon sur passages répétés", len(episodes(tmp)) == 1,
          "trouvé %d" % len(episodes(tmp)))

    # un autre produit clôt un épisode : il s'AJOUTE, il n'écrase pas
    passe(tmp, [item(a, "Remise à disposition", debut_officiel="2026-01-01"),
                item(b, "Tension d'approvisionnement", debut_officiel="2026-02-01")], "2026-02-05")
    passe(tmp, [item(a, "Remise à disposition", debut_officiel="2026-01-01"),
                item(b, "Remise à disposition", debut_officiel="2026-02-01")], "2026-03-01")
    eps = episodes(tmp)
    check("le 2e épisode s'ajoute au 1er", len(eps) == 2, "trouvé %d" % len(eps))
    check("le 1er épisode est intact", any(e.get("j") == 19 for e in eps))


# ── 4. Le compte d'épisodes ne décroît jamais ────────────────────────────────
def t4(tmp):
    lbl = "Produit C 5 mg"
    n = 0
    # 3 allers-retours rupture → remise
    for i, (st, jour) in enumerate([("Rupture de stock", "2026-01-01"),
                                    ("Remise à disposition", "2026-02-01"),
                                    ("Rupture de stock", "2026-03-01"),
                                    ("Remise à disposition", "2026-04-01"),
                                    ("Tension d'approvisionnement", "2026-05-01")]):
        passe(tmp, [item(lbl, st)], jour)
        courant = len(episodes(tmp))
        check("passage %d : le compte ne baisse pas (%d → %d)" % (i + 1, n, courant), courant >= n)
        n = courant
    check("les 4 changements de statut ont produit 4 épisodes", n == 4, "trouvé %d" % n)


# ── 5. Une date de début approchée est signalée comme telle ──────────────────
def t5(tmp):
    lbl = "Produit D 1 mg"
    # pas de date officielle : le robot amorce sur la date de MAJ ANSM → approché
    passe(tmp, [item(lbl, "Rupture de stock", maj="10/01/2026")], "2026-01-15")
    passe(tmp, [item(lbl, "Remise à disposition", maj="10/01/2026")], "2026-02-10")
    eps = episodes(tmp)
    check("épisode archivé même sans date officielle", len(eps) == 1)
    if eps:
        check("marqué comme début approché", eps[0].get("a") == 1, repr(eps[0].get("a")))


# ── 6. Une ligne héritée de l'ANCIEN journal garde quand même son nom ────────
def t6(tmp):
    """Régression observée sur les vraies données du 12/08 : le 1er épisode clos est
    parti à l'archive sans nom de produit (« methylphenidate eg lp 18 mg », 273 j),
    parce que le libellé n'était écrit qu'APRÈS la clôture."""
    lbl = "Methylphenidate EG LP 18 mg, comprime"
    k = gad.histo_key(lbl)
    # on fabrique un journal d'AVANT le correctif : ni libellé, ni molécule, ni domaine
    os.makedirs(tmp, exist_ok=True)
    with open(os.path.join(tmp, "ansm-histo.json"), "w", encoding="utf-8") as f:
        json.dump({"generated": "2026-08-11", "items": {
            k: {"f": "2025-11-12", "s": "Tension d'approvisionnement",
                "d": "2025-11-12", "a": 0, "g": "2026-08-11"}}}, f)

    # aujourd'hui le produit revient → l'épisode se clôt dès ce passage
    passe(tmp, [{"spec": lbl, "st": "Remise à disposition",
                 "dci": "methylphenidate", "dom": "Psychiatrie"}], "2026-08-12")
    eps = episodes(tmp)
    check("épisode archivé", len(eps) == 1)
    if not eps:
        return
    e = eps[0]
    check("durée juste", e.get("j") == 273, repr(e.get("j")))
    check("le NOM du produit est là malgré l'ancien journal",
          (e.get("spec") or "").startswith("Methylphenidate"), repr(e.get("spec")))
    check("la molécule est là", e.get("dci") == "methylphenidate", repr(e.get("dci")))
    check("le domaine est là", e.get("dom") == "Psychiatrie", repr(e.get("dom")))


for nom, fn in [("1. changement de statut → épisode archivé", t1),
                ("2. purge 120 j → archivé avant suppression", t2),
                ("3. append-only, sans doublon", t3),
                ("4. le compte d'épisodes ne décroît jamais", t4),
                ("5. début approché signalé", t5),
                ("6. ligne héritée de l'ancien journal → nom conservé", t6)]:
    scenario(nom, fn)

print("\n" + "=" * 60)
if ECHECS:
    print("ÉCHEC — %d vérification(s) : %s" % (len(ECHECS), " · ".join(ECHECS[:6])))
    sys.exit(1)
print("TOUT PASSE")

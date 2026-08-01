# Modèle national d'anticipation APPRO — plan d'exécution

> **Pour l'exécutant :** SKILL REQUISE — utiliser `superpowers:executing-plans` (ou
> `superpowers:subagent-driven-development`) pour dérouler ce plan tâche par tâche.
> Les étapes sont en cases à cocher (`- [ ]`).

**Objectif :** rendre l'anticipation d'APPRO indépendante de la qualité des données d'Intégral,
en calculant la demande et la saisonnalité sur le seul marché français public, le stock ne
servant plus qu'à mesurer un écart.

**Architecture :** un robot mensuel produit `crm/v2/national.json` (volume France + profil
mensuel par CIP13) sans jamais lire un fichier Intégral. L'application charge ce fichier en
différé, le calibre par une part de marché à trois niveaux de fiabilité, puis affiche deux
listes séparées : vos références (écart cible/détenu) et hors catalogue (à référencer).

**Spéc :** `docs/superpowers/specs/2026-08-01-modele-national-appro-design.md`

**Technique :** Python 3.9+ (urllib, gzip, zipfile, xlrd — aucune autre dépendance),
JavaScript ES5 côté app (JARVIS est volontairement sans build), GitHub Actions.

## Contraintes globales

- **Aucune clé API, aucun service payant.** Sources publiques gratuites uniquement.
- **JARVIS n'a pas d'outil de build** : ne rien ajouter au dépôt (pas de package.json, pas de
  framework de test). Les tests sont des scripts autonomes dans le répertoire de travail
  temporaire, qui extraient les vraies fonctions du fichier livré via `new Function`.
- **Jamais `git add -A`** : ajouter les fichiers un par un.
- **Tout fichier de données > 500 Ko en chargement différé.**
- **Safari** : jamais de `backdrop-filter`, `background-clip:text`, ni flou sur grande surface.
- **Cache** : à chaque déploiement, bumper le jeton dans `crm/v2/index.html` (toutes les
  occurrences `?v=`), `crm/v2/sw.js` (`var VER`) et le repli `window.__APPRO_V` de
  `crm/v2/v2-appro.js`. Puis `bash scripts/attendre-prod.sh <jeton>`.
- **Vérification écran obligatoire** après déploiement, ordi **et** mobile 390 px, avec un
  profil Chrome **neuf** (un profil réutilisé sert une version en cache).
- **Ne jamais pousser sans le feu vert de Will.**

---

## Structure des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `generate_medicam_saison.py` | profil mensuel par CIP13 (Medic'AM) | modifier : téléchargement + garde + filtre |
| `generate_openmedic.py` | volume France par CIP13 (Open Medic) | modifier : retirer le filtre catalogue |
| `generate_national.py` | fusionne les deux en un modèle unique | **créer** |
| `.github/workflows/national.yml` | robot mensuel | **créer** |
| `crm/v2/national.json` | le modèle (~700 Ko) | produit par le robot |
| `crm/v2/v2-appro.js` | chargement différé, calibrage, 2 listes | modifier |

---

## Tâche 1 : la garde anti-écrasement (bloquant, corrige une panne en cours)

**Contexte prouvé :** le 2026-07-30, les 4 téléchargements Medic'AM ont échoué en `HTTP 403
Forbidden` depuis les serveurs GitHub, et le robot a **quand même** écrit un `saison-cip.json`
vide, passant de 4 678 produits à 0. C'est la cause du « Pré-acheter 0 » dans le carnet.

**Fichiers :**
- Modifier : `generate_medicam_saison.py` (fonction `main`)
- Test : `<scratch>/t7-garde-vide.py`

**Interfaces produites :** `ecrire_si_complet(chemin, nouveau_dict, seuil=0.8) -> bool`
— écrit `nouveau_dict` (structure `{"generated","source","n","data"}`) uniquement si
`len(nouveau["data"]) >= seuil * len(ancien["data"])`. Renvoie `True` si écrit, `False` sinon.
Réutilisée par la tâche 4.

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# <scratch>/t7-garde-vide.py
import io, json, os, sys, importlib.util, tempfile
spec = importlib.util.spec_from_file_location("g", "generate_medicam_saison.py")
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

ok = ko = 0
def verifie(titre, attendu, obtenu):
    global ok, ko
    if attendu == obtenu: print("  OK  " + titre); ok += 1
    else: print("  KO  %s\n      attendu %r, obtenu %r" % (titre, attendu, obtenu)); ko += 1

d = tempfile.mkdtemp(); p = os.path.join(d, "x.json")
plein = {"generated": "2026-07-30", "source": "t", "n": 100,
         "data": {str(i): 1 for i in range(100)}}
io.open(p, "w").write(json.dumps(plein))

vide = {"generated": "2026-08-01", "source": "t", "n": 0, "data": {}}
verifie("un fichier VIDE est refuse", False, g.ecrire_si_complet(p, vide))
verifie("l'ancien contenu est intact", 100, json.load(io.open(p))["n"])

tronque = {"generated": "2026-08-01", "source": "t", "n": 50,
           "data": {str(i): 1 for i in range(50)}}
verifie("un fichier a 50 % est refuse", False, g.ecrire_si_complet(p, tronque))

bon = {"generated": "2026-08-01", "source": "t", "n": 95,
       "data": {str(i): 1 for i in range(95)}}
verifie("un fichier a 95 % est accepte", True, g.ecrire_si_complet(p, bon))
verifie("le nouveau contenu est ecrit", 95, json.load(io.open(p))["n"])

neuf = os.path.join(d, "neuf.json")
verifie("un premier passage (pas d'ancien) est accepte", True, g.ecrire_si_complet(neuf, plein))

print("\nRESULTAT : %d reussite(s), %d echec(s)" % (ok, ko))
sys.exit(1 if ko else 0)
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `python3 <scratch>/t7-garde-vide.py`
Attendu : `AttributeError: module 'g' has no attribute 'ecrire_si_complet'`

- [ ] **Étape 3 : écrire l'implémentation minimale**

```python
def ecrire_si_complet(chemin, nouveau, seuil=0.8):
    """N'ecrit que si le resultat n'est pas une regression massive.

    Le 2026-07-30, 4 telechargements Medic'AM en 403 ont produit un fichier vide qui a
    ecrase 4 678 produits. Regle : sous `seuil` fois le volume precedent, on conserve
    l'ancien et on le dit fort.
    """
    n_new = len(nouveau.get("data") or {})
    n_old = 0
    try:
        with io.open(chemin, "r", encoding="utf-8") as f:
            n_old = len(json.load(f).get("data") or {})
    except Exception:
        n_old = 0
    if n_old and n_new < seuil * n_old:
        print("REFUS D'ECRIRE : %d entrees contre %d precedemment (<%d %%). "
              "Fichier precedent conserve." % (n_new, n_old, int(seuil * 100)))
        return False
    with io.open(chemin, "w", encoding="utf-8") as f:
        json.dump(nouveau, f, ensure_ascii=False, separators=(",", ":"))
    return True
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

Commande : `python3 <scratch>/t7-garde-vide.py`
Attendu : `RESULTAT : 6 reussite(s), 0 echec(s)`

- [ ] **Étape 5 : brancher la garde dans `main()`**

Remplacer le bloc d'écriture final de `generate_medicam_saison.py` par :

```python
    out = {"generated": datetime.date.today().isoformat(),
           "source": "Medic'AM %s" % "+".join(str(y) for y in YEARS),
           "n": len(data), "data": data}
    if not ecrire_si_complet(OUT, out):
        raise SystemExit(1)   # echec VISIBLE : le robot doit rougir, pas passer inapercu
    print("OK · produits avec saison=%d (sur %d CIP Medic'AM)" % (len(data), len(acc)))
```

- [ ] **Étape 6 : commit**

```bash
git add generate_medicam_saison.py
git commit -m "fix(robot): ne plus jamais ecraser un fichier de donnees par du vide

Le 30/07, 4 telechargements Medic'AM en HTTP 403 depuis les serveurs GitHub ont
produit un saison-cip.json vide qui a ecrase 4 678 produits — d'ou le « Pre-acheter 0 »
du carnet. ecrire_si_complet() refuse toute chute sous 80 % du volume precedent et
sort en echec visible."
```

---

## Tâche 2 : rétablir le téléchargement Medic'AM depuis les serveurs GitHub

**Contexte prouvé :** `assurance-maladie.ameli.fr` répond `403 Forbidden` aux serveurs GitHub
(fonctionne depuis le Mac de Will). Deux parades à tester dans l'ordre.

**Fichiers :**
- Modifier : `generate_medicam_saison.py` (fonction `fetch`)
- Test : le seul test valable est une exécution réelle en CI (`gh workflow run`)

- [ ] **Étape 1 : parade A — envoyer des entêtes de navigateur complets**

```python
def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/140.0 Safari/537.36"),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Referer": "https://www.data.gouv.fr/",
        "Accept-Encoding": "gzip",
    })
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip as _gz
            raw = _gz.decompress(raw)
    return raw
```

- [ ] **Étape 2 : vérifier en conditions réelles**

```bash
git add generate_medicam_saison.py && git commit -m "fix(robot): entetes navigateur completes pour Medic'AM (403 depuis les runners)"
git push origin HEAD:main
gh workflow run medicam-saison.yml
gh run watch $(gh run list --workflow=medicam-saison.yml --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
gh run view <ID> --log | grep -E "charge|echec|OK ·|REFUS"
```

Attendu : `chargé 2023 S1` … 4 fois, puis `OK · produits avec saison=4678` environ.
Si toujours `403` : passer à l'étape 3.

- [ ] **Étape 3 : parade B (si A échoue) — passer par le miroir data.gouv**

`resource_map()` renvoie aujourd'hui l'URL ameli directe. La remplacer par l'URL stable
data.gouv de la ressource, qui n'est pas servie par ameli :

```python
def resource_map():
    d = json.loads(fetch(META).decode("utf-8", "ignore"))
    out = {}
    for r in d.get("resources", []):
        t = (r.get("title") or "").lower()
        # url stable data.gouv (proxy) plutot que l'URL ameli directe, qui renvoie 403
        # aux serveurs GitHub. Repli sur l'URL directe si l'id manque.
        url = ("https://www.data.gouv.fr/fr/datasets/r/%s" % r["id"]) if r.get("id") else r["url"]
        for y in YEARS:
            if "1er semestre %d" % y in t:
                out[(y, 1)] = url
            elif "2e semestre %d" % y in t:
                out[(y, 2)] = url
    return out
```

Puis relancer l'étape 2.

- [ ] **Étape 4 : si A et B échouent tous les deux — arrêter et remonter à Will**

Ne pas contourner en lançant le robot depuis le Mac : ça réintroduit une étape manuelle.
Documenter l'échec et demander l'arbitrage.

---

## Tâche 3 : sources nationales sans filtre catalogue

**Contexte prouvé :** `generate_openmedic.py` (ligne 66) et `generate_medicam_saison.py`
(ligne 111) restreignent leur sortie aux CIP du catalogue Intégral. Le modèle ne peut donc pas
être indépendant tant que ce filtre existe.

**Fichiers :**
- Modifier : `generate_openmedic.py`, `generate_medicam_saison.py`
- Test : `<scratch>/t8-independance.py`

**Interfaces produites :** `crm/v2/openmedic.json` et `crm/v2/saison-cip.json` couvrent
désormais **tout** le marché (12 486 CIP13 mesurés pour Open Medic 2025).

- [ ] **Étape 1 : écrire le test d'indépendance qui échoue**

```python
# <scratch>/t8-independance.py — le robot ne doit JAMAIS lire un fichier Integral
import re, sys
INTERDITS = ["prod-stats-data.js", "stock-data.js", "wml-officines-data.js", "PROD_STATS"]
ok = ko = 0
for f in ["generate_openmedic.py", "generate_medicam_saison.py", "generate_national.py"]:
    try:
        src = open(f, encoding="utf-8").read()
    except FileNotFoundError:
        print("  KO  %s absent" % f); ko += 1; continue
    trouves = [m for m in INTERDITS if m in src]
    if trouves: print("  KO  %s lit encore : %s" % (f, ", ".join(trouves))); ko += 1
    else: print("  OK  %s n'ouvre aucun fichier Integral" % f); ok += 1
print("\nRESULTAT : %d reussite(s), %d echec(s)" % (ok, ko))
sys.exit(1 if ko else 0)
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Commande : `python3 <scratch>/t8-independance.py`
Attendu : 2 KO (les deux robots lisent `prod-stats-data.js`) + 1 KO (`generate_national.py`
n'existe pas encore).

- [ ] **Étape 3 : retirer le filtre d'Open Medic**

Dans `generate_openmedic.py` : supprimer la fonction `catalogue()`, la constante `PRODSTATS`,
l'argument `cat` de `load_year`, et remplacer la ligne 66 par :

```python
        if len(cip) != 13:
            continue
```

Adapter l'appel : `data = load_year(y)` et le message final :

```python
    print("OK · millesime %d · %d produits (marche francais complet) · %d boites" % (year, len(data), tot))
```

- [ ] **Étape 4 : retirer le filtre de Medic'AM saison**

Dans `generate_medicam_saison.py` : supprimer `catalogue_cips()` et `PRODSTATS`, puis
remplacer dans la boucle finale :

```python
    for cip, rec in acc.items():
        tot = sum(rec["m"])
        if tot < MIN_BOITES:
            continue
```

- [ ] **Étape 5 : relancer le test d'indépendance**

Commande : `python3 <scratch>/t8-independance.py`
Attendu : 2 OK + 1 KO (`generate_national.py`, créé en tâche 4).

- [ ] **Étape 6 : mesurer le poids réel avant de commiter**

```bash
python3 generate_openmedic.py && ls -la crm/v2/openmedic.json
python3 generate_medicam_saison.py && ls -la crm/v2/saison-cip.json
```

Attendu : Open Medic autour de 12 486 entrées. **Si un fichier dépasse 1,5 Mo**, réduire en
supprimant les références sous 1 000 boîtes/an France (bruit non actionnable) et le noter.

- [ ] **Étape 7 : commit**

```bash
git add generate_openmedic.py generate_medicam_saison.py crm/v2/openmedic.json crm/v2/saison-cip.json
git commit -m "feat(national): lever le filtre catalogue sur Open Medic et Medic'AM saison

Le modele national doit voir TOUT le marche francais (12 486 CIP13, 2,33 Md de boites),
y compris ce qu'Integral ne vend pas encore. Test d'independance t8 : ces robots
n'ouvrent plus aucun fichier Integral."
```

---

## Tâche 4 : le robot `generate_national.py`

**Fichiers :**
- Créer : `generate_national.py`
- Créer : `.github/workflows/national.yml`
- Test : `<scratch>/t9-national.py`

**Interfaces consommées :** `crm/v2/openmedic.json` (`{data:{cip:boites}}`),
`crm/v2/saison-cip.json` (`{data:{cip:{i:[12],p:mois,a:atc}}}`), `crm/v2/pivot.json`
(`{data:{cip:{dci,grp,gen,labo,prix,remb,co}}}`).

**Interfaces produites :** `crm/v2/national.json` =
`{"generated":"AAAA-MM-JJ","source":"...","n":N,"data":{cip:{"v":volAn,"s":[12 indices],"d":dci,"g":0|1}}}`
Consommé par la tâche 5.

- [ ] **Étape 1 : écrire le test qui échoue**

```python
# <scratch>/t9-national.py
import io, json, os, sys, tempfile, importlib.util
spec = importlib.util.spec_from_file_location("g", "generate_national.py")
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

ok = ko = 0
def verifie(titre, attendu, obtenu):
    global ok, ko
    if attendu == obtenu: print("  OK  " + titre); ok += 1
    else: print("  KO  %s\n      attendu %r, obtenu %r" % (titre, attendu, obtenu)); ko += 1

om = {"3400000000001": 1200000, "3400000000002": 500, "3400000000003": 90000}
sai = {"3400000000001": {"i": [0.9]*11 + [2.1], "p": 12, "a": "N02"}}
piv = {"3400000000001": {"dci": "macrogol", "grp": 42, "gen": 0},
       "3400000000003": {"dci": "edoxaban", "grp": None, "gen": 0}}

d = g.fusionner(om, sai, piv, mini_boites=1000)
verifie("un produit sous le seuil de bruit est ecarte", False, "3400000000002" in d)
verifie("le volume France est repris tel quel", 1200000, d["3400000000001"]["v"])
verifie("le profil mensuel est repris", 2.1, d["3400000000001"]["s"][11])
verifie("la molecule vient du pivot", "macrogol", d["3400000000001"]["d"])
verifie("le drapeau generique est pose", 1, d["3400000000001"]["g"])
verifie("sans groupe generique le drapeau est a 0", 0, d["3400000000003"]["g"])
verifie("un produit sans profil saisonnier est garde (profil plat)",
        [1.0]*12, d["3400000000003"]["s"])

print("\nRESULTAT : %d reussite(s), %d echec(s)" % (ok, ko))
sys.exit(1 if ko else 0)
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Commande : `python3 <scratch>/t9-national.py`
Attendu : `FileNotFoundError` / `No module named` — `generate_national.py` n'existe pas.

- [ ] **Étape 3 : écrire `generate_national.py`**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_national.py — MODELE NATIONAL d'anticipation (aucune donnee Integral).

Fusionne trois flux publics deja en place en une fiche par medicament :
  Open Medic     -> volume France (boites/an)
  Medic'AM       -> profil saisonnier mensuel (indice, 1.0 = moyenne annuelle)
  Table pivot    -> molecule, existence d'un groupe generique

Ce robot n'ouvre AUCUN fichier Integral (test d'independance t8). Le stock et les ventes
du reseau ne sont appliques que plus tard, cote application, comme derniere couche.

Ecrit crm/v2/national.json. Python 3.9, bibliotheque standard seule. Aucune cle.
"""
import io
import os
import json
import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.join(HERE, "crm", "v2")
OUT = os.path.join(V2, "national.json")
MINI_BOITES = int(os.environ.get("NAT_MINI", "1000"))   # sous ce volume France : bruit


def charger(nom):
    try:
        with io.open(os.path.join(V2, nom), "r", encoding="utf-8") as f:
            d = json.load(f)
        return d.get("data") or {}
    except Exception:
        return {}


def fusionner(openmedic, saison, pivot, mini_boites=MINI_BOITES):
    """{cip: {v, s[12], d, g}} — profil plat si la saison est inconnue."""
    out = {}
    for cip, vol in openmedic.items():
        try:
            v = int(vol)
        except Exception:
            continue
        if v < mini_boites:
            continue
        s = saison.get(cip, {}).get("i")
        if not s or len(s) != 12:
            s = [1.0] * 12
        p = pivot.get(cip) or {}
        out[cip] = {
            "v": v,
            "s": [round(float(x), 2) for x in s],
            "d": (p.get("dci") or "")[:60],
            "g": 1 if p.get("grp") is not None else 0,
        }
    return out


def ecrire_si_complet(chemin, nouveau, seuil=0.8):
    """Identique a generate_medicam_saison.py : jamais d'ecrasement par du vide."""
    n_new = len(nouveau.get("data") or {})
    n_old = 0
    try:
        with io.open(chemin, "r", encoding="utf-8") as f:
            n_old = len(json.load(f).get("data") or {})
    except Exception:
        n_old = 0
    if n_old and n_new < seuil * n_old:
        print("REFUS D'ECRIRE : %d entrees contre %d precedemment (<%d %%)."
              % (n_new, n_old, int(seuil * 100)))
        return False
    with io.open(chemin, "w", encoding="utf-8") as f:
        json.dump(nouveau, f, ensure_ascii=False, separators=(",", ":"))
    return True


def main():
    om = charger("openmedic.json")
    sai = charger("saison-cip.json")
    piv = charger("pivot.json")
    if not om:
        print("ABANDON : openmedic.json vide ou absent — modele non regenere.")
        raise SystemExit(1)
    data = fusionner(om, sai, piv)
    avec_saison = sum(1 for x in data.values() if x["s"] != [1.0] * 12)
    out = {"generated": datetime.date.today().isoformat(),
           "source": "Open Medic + Medic'AM + BDPM (marche francais, sans donnee Integral)",
           "n": len(data), "avecSaison": avec_saison, "data": data}
    if not ecrire_si_complet(OUT, out):
        raise SystemExit(1)
    print("OK · %d medicaments modelises · %d avec profil saisonnier" % (len(data), avec_saison))
    print("→ %s (%d Ko)" % (OUT, os.path.getsize(OUT) // 1024))


if __name__ == "__main__":
    main()
```

- [ ] **Étape 4 : lancer les tests**

Commandes :
```bash
python3 <scratch>/t9-national.py       # attendu : 7 reussites, 0 echec
python3 <scratch>/t8-independance.py   # attendu : 3 reussites, 0 echec
```

- [ ] **Étape 5 : produire le fichier réel et mesurer**

Commande : `python3 generate_national.py && ls -la crm/v2/national.json`
Attendu : autour de 12 000 médicaments, fichier **≤ 1 Mo**. Au-delà, remonter `NAT_MINI`.

- [ ] **Étape 6 : créer le robot mensuel**

```yaml
# .github/workflows/national.yml
name: Marché · modèle national d'anticipation

# Fusionne Open Medic + Medic'AM + pivot en un modele par medicament, SANS aucune
# donnee Integral. Depend des trois robots amont : on le lance apres eux dans le mois.

on:
  schedule:
    - cron: '17 6 8 * *'   # le 8 du mois, apres openmedic (le 5) et saison (le 6)
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: national
  cancel-in-progress: false

jobs:
  national:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Construire le modèle national
        run: python3 generate_national.py
      - name: Committer si changement
        run: |
          if git diff --quiet -- crm/v2/national.json; then
            echo "Pas de changement."
          else
            git config user.name  "JARVIS copilote"
            git config user.email "actions@users.noreplace.github.com"
            git add crm/v2/national.json
            git commit -m "data(marché): modèle national $(date -u +%Y-%m-%d)"
            git push
          fi
```

- [ ] **Étape 7 : valider le robot en conditions réelles**

```bash
gh workflow run national.yml
gh run watch $(gh run list --workflow=national.yml --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
```

- [ ] **Étape 8 : commit**

```bash
git add generate_national.py .github/workflows/national.yml crm/v2/national.json
git commit -m "feat(national): robot du modele national d'anticipation

Fusionne Open Medic (volume France) + Medic'AM (profil mensuel) + pivot (molecule,
groupe generique) en une fiche par medicament. N'ouvre aucun fichier Integral.
Garde anti-ecrasement identique a celle de la tache 1."
```

---

## Tâche 5 : chargement différé et calibrage à trois niveaux

**Fichiers :**
- Modifier : `crm/v2/v2-appro.js`
- Test : `<scratch>/t10-calibrage.js`

**Interfaces consommées :** `crm/v2/national.json` (tâche 4), `cipIndex()` existant
(fournit `vM` = vitesse mensuelle réseau et `nMois`).

**Interfaces produites :**
- `ensureNational()` — charge `national.json` en différé, pose `_natData`, appelle `approRerender()`.
- `partMarche(cip) -> {part: Number, niveau: 1|2|3, libelle: String}`
- `cibleNationale(cip, mois) -> {unites: Number, part: Number, niveau: Number} | null`

- [ ] **Étape 1 : écrire le test qui échoue**

```javascript
// <scratch>/t10-calibrage.js
const fs = require('fs');
const SRC = process.env.APPRO || 'wt-psa/crm/v2/v2-appro.js';
const src = fs.readFileSync(SRC, 'utf8');
function extraire(nom) {
  const i = src.indexOf('  function ' + nom + '(');
  if (i < 0) throw new Error('FONCTION ABSENTE : ' + nom);
  const j = src.indexOf('\n  function ', i + 5);
  return src.slice(i, j < 0 ? src.length : j) + '\n';
}
let ok = 0, ko = 0;
function verifie(t, a, o) {
  if (JSON.stringify(a) === JSON.stringify(o)) { console.log('  OK  ' + t); ok++; }
  else { console.log('  KO  ' + t + '\n      attendu ' + JSON.stringify(a) + ', obtenu ' + JSON.stringify(o)); ko++; }
}

const VENDU = '3400000000001', VOISIN = '3400000000002', INCONNU = '3400000000003';
const _natData = { data: {
  [VENDU]:   { v: 1200000, s: new Array(12).fill(1), d: 'macrogol', g: 1 },
  [VOISIN]:  { v: 600000,  s: new Array(12).fill(1), d: 'macrogol', g: 1 },
  [INCONNU]: { v: 300000,  s: new Array(12).fill(1), d: 'edoxaban', g: 0 },
} };
// vitesse reseau : 300/mois sur le produit vendu -> 3600/an sur 1 200 000 = 0,30 %
const idx = { [VENDU]: { vM: 300, nMois: 5 } };

const code = extraire('partGlobale') + extraire('partMarche') + extraire('cibleNationale');
const api = new Function('_natData', 'cipIndex', 'CIBLE', 'CIBLE_TENSION',
  code + '\n; return {partMarche:partMarche, cibleNationale:cibleNationale};')(
  _natData, () => idx, 21, 30);

const a = api.partMarche(VENDU);
verifie('produit vendu : niveau 1 (mesure)', 1, a.niveau);
verifie('produit vendu : part calculee sur le reel', 0.30, Math.round(a.part * 10000) / 100);

const b = api.partMarche(VOISIN);
verifie('meme molecule : niveau 2 (famille)', 2, b.niveau);

const c = api.partMarche(INCONNU);
verifie('aucun historique : niveau 3 (moyenne)', 3, c.niveau);
verifie('niveau 3 : la part reste strictement positive', true, c.part > 0);

const cb = api.cibleNationale(VENDU, 8);
verifie('cible = demande mensuelle / 30 x couverture cible (21 j)',
  Math.round(1200000 / 12 * 1 * a.part / 30 * 21), cb.unites);
verifie('la cible porte son niveau de fiabilite', 1, cb.niveau);
verifie('produit absent du modele : pas de cible', null, api.cibleNationale('3400999999999', 8));

console.log('\nRESULTAT : ' + ok + ' reussite(s), ' + ko + ' echec(s)');
process.exit(ko ? 1 : 0);
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Commande : `node <scratch>/t10-calibrage.js`
Attendu : `FONCTION ABSENTE : partGlobale`

- [ ] **Étape 3 : implémenter, à placer juste avant `function carnet(`**

```javascript
  // ═══ MODÈLE NATIONAL (crm/v2/national.json, robot mensuel) ═══
  // Volume France + profil saisonnier par CIP13, calculés SANS aucune donnée Intégral.
  // Le réel du réseau n'intervient qu'ici, en dernière couche, pour calibrer et comparer.
  var _natState = 0, _natData = null, _partGlob = null, _partFam = null;
  function ensureNational() {
    if (_natData || _natState) return;
    _natState = 1;
    try {
      var jour = new Date().toISOString().slice(0, 10);
      fetch('national.json?d=' + jour, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _natData = j || {}; _natState = 2; approRerender(); })
        .catch(function () { _natState = 2; });
    } catch (e) { _natState = 2; }
  }

  // Part de marché globale : total annualisé réseau ÷ total France, sur les produits communs.
  // Mesurée le 01/08/2026 à 0,28 % — recalculée à chaque chargement, jamais codée en dur.
  function partGlobale() {
    if (_partGlob != null) return _partGlob;
    var d = (_natData && _natData.data) || {}, idx = cipIndex();
    var ip = 0, nat = 0;
    _partFam = {};
    var famIp = {}, famNat = {};
    Object.keys(idx).forEach(function (c) {
      var n = d[c];
      if (!n || !n.v) return;
      var an = (idx[c].vM || 0) * 12;
      ip += an; nat += n.v;
      var f = n.d || '';
      if (f) { famIp[f] = (famIp[f] || 0) + an; famNat[f] = (famNat[f] || 0) + n.v; }
    });
    Object.keys(famIp).forEach(function (f) { if (famNat[f] > 0) _partFam[f] = famIp[f] / famNat[f]; });
    _partGlob = nat > 0 ? ip / nat : 0.0028;
    return _partGlob;
  }

  function partMarche(cip) {
    var d = (_natData && _natData.data) || {}, n = d[String(cip)];
    var glob = partGlobale();
    if (!n) return { part: glob, niveau: 3, libelle: 'estimé (moyenne)' };
    var idx = cipIndex(), o = idx[String(cip)];
    if (o && o.vM > 0 && n.v > 0) {
      return { part: (o.vM * 12) / n.v, niveau: 1, libelle: 'mesuré' };
    }
    var f = _partFam && n.d ? _partFam[n.d] : null;
    if (f > 0) return { part: f, niveau: 2, libelle: 'estimé (famille)' };
    return { part: glob, niveau: 3, libelle: 'estimé (moyenne)' };
  }

  // Stock cible en unités : demande France du mois × notre part, ramenée à la couverture cible.
  // mois = 1..12. Renvoie null si le produit n'est pas dans le modèle national.
  function cibleNationale(cip, mois) {
    var d = (_natData && _natData.data) || {}, n = d[String(cip)];
    if (!n || !n.v) return null;
    var pm = partMarche(cip);
    var indice = (n.s && n.s[(mois - 1 + 12) % 12]) || 1;
    var demandeMois = n.v / 12 * indice * pm.part;
    var idx = cipIndex(), o = idx[String(cip)];
    var couv = (o && o.rupt) ? CIBLE_TENSION : CIBLE;
    return { unites: Math.round(demandeMois / 30 * couv), part: pm.part, niveau: pm.niveau };
  }
```

- [ ] **Étape 4 : lancer les tests**

Commandes :
```bash
node <scratch>/t10-calibrage.js   # attendu : 8 reussites, 0 echec
node --check crm/v2/v2-appro.js
for t in t1 t2 t3 t4 t5 t6; do node <scratch>/$t*.js >/dev/null && echo "$t OK"; done
```

- [ ] **Étape 5 : appeler `ensureNational()` avec les autres chargements différés**

Dans `V2.pages.appro`, à côté de `ensureRappelsLots();` :

```javascript
      ensureNational(); // charge le modèle national d'anticipation (robot mensuel)
```

- [ ] **Étape 6 : commit**

```bash
git add crm/v2/v2-appro.js
git commit -m "feat(appro): couche modele national + calibrage a 3 niveaux de fiabilite

partMarche() choisit le meilleur niveau disponible (mesure / famille / moyenne) et
l'expose pour affichage. cibleNationale() convertit la demande France du mois en stock
cible via la couverture cible existante (21 j, 30 si tension)."
```

---

## Tâche 6 : les deux listes à l'écran

**Fichiers :**
- Modifier : `crm/v2/v2-appro.js` (espace *Anticiper*, carte `whiteSpaceCard`)
- Test : vérification à l'écran (le rendu ne se teste pas utilement en Node)

- [ ] **Étape 1 : liste A — écart cible/détenu dans *Anticiper***

Ajouter, et l'insérer dans `anticiperCockpit()` :

```javascript
  // Liste A : nos références, écart entre la cible nationale et ce qu'on détient.
  function ecartNational() {
    if (!_natData || !_natData.data) return '';
    var idx = cipIndex(), mois = new Date().getMonth() + 1, out = [];
    Object.keys(idx).forEach(function (c) {
      var cb = cibleNationale(c, mois);
      if (!cb || !cb.unites) return;
      var o = idx[c], ecart = cb.unites - (o.st || 0);
      if (ecart <= 0) return;
      out.push({ c: c, nom: o.d, cible: cb.unites, detenu: o.st, ecart: ecart,
                 niveau: cb.niveau, part: cb.part, unk: o.unk });
    });
    out.sort(function (a, b) { return b.ecart - a.ecart; });
    if (!out.length) return '';
    var LIB = { 1: 'mesuré', 2: 'estimé (famille)', 3: 'estimé (moyenne)' };
    var lignes = out.slice(0, 8).map(function (x) {
      return '<div class="ap-row"><div class="ap-nm"><b>' + esc(cap((x.nom || '').toLowerCase())) + '</b>' +
        '<small>cible ~' + fmt(x.cible) + ' u · détenu ' + (x.unk ? 'inconnu' : fmt(x.detenu)) +
        ' · part ' + (x.part * 100).toFixed(2).replace('.', ',') + ' % (' + LIB[x.niveau] + ')</small></div>' +
        '<div class="ap-mini"><b>−' + fmt(x.ecart) + '</b></div></div>';
    }).join('');
    return card('pilo', 'Écart au marché France',
      'ce que le marché national dit qu\'il faudrait tenir, comparé à ce que vous détenez',
      lignes, 'var(--ip-blue)') +
      '<div class="ap-foot" style="margin:0">Modèle national (Open Medic + Medic\'AM), calculé sans vos données. ' +
      'La part de marché utilisée est indiquée ligne par ligne : <b>mesuré</b> = sur vos ventes réelles, ' +
      '<b>estimé</b> = déduit. Le détenu vient de votre dernier inventaire.</div>';
  }
```

- [ ] **Étape 2 : liste B — enrichir la carte « Potentiel réseau » existante**

Dans `whiteSpaceCard()`, ajouter les produits **absents** de `cipIndex()` mais présents dans le
modèle national, triés par volume France, avec leur potentiel annuel :

```javascript
  // Liste B : hors catalogue — le modèle voit ce que nos données ne peuvent pas voir.
  function horsCatalogue() {
    if (!_natData || !_natData.data) return [];
    var idx = cipIndex(), d = _natData.data, glob = partGlobale(), out = [];
    Object.keys(d).forEach(function (c) {
      if (idx[c]) return;                       // deja au catalogue -> liste A
      var n = d[c];
      if (!n.v || n.v < 50000) return;          // sous 50 000 boites/an France : pas un enjeu
      out.push({ c: c, dci: n.d, vol: n.v, potentiel: Math.round(n.v * glob), gen: n.g });
    });
    out.sort(function (a, b) { return b.potentiel - a.potentiel; });
    return out.slice(0, 12);
  }
```

Affichage dans une section distincte de *Marché & négo*, **jamais** dans le carnet d'achat.

- [ ] **Étape 3 : contrôle syntaxe et non-régression**

```bash
node --check crm/v2/v2-appro.js
for t in t1 t2 t3 t4 t5 t6 t10; do node <scratch>/$t*.js >/dev/null && echo "$t OK" || echo "$t ECHEC"; done
```

- [ ] **Étape 4 : déployer et vérifier à l'écran**

```bash
TOK=20260802a
sed -i '' -E "s/\?v=[0-9a-zA-Z]+/?v=$TOK/g" crm/v2/index.html
sed -i '' -E "s/var VER = '[0-9a-zA-Z]+';/var VER = '$TOK';/" crm/v2/sw.js
sed -i '' "s/window.__APPRO_V || '<ancien>'/window.__APPRO_V || '$TOK'/" crm/v2/v2-appro.js
node --check crm/v2/v2-appro.js
git add crm/v2/v2-appro.js crm/v2/index.html crm/v2/sw.js
git commit -m "feat(appro): deux listes du modele national (ecart au marche + hors catalogue)"
# pousser UNIQUEMENT sur le feu vert de Will
bash scripts/attendre-prod.sh $TOK
```

Puis capture ordi 1440 px **et** mobile 390 px, avec un **profil Chrome neuf**, en vérifiant :
la carte « Écart au marché France » s'affiche, chaque ligne porte son niveau de fiabilité, la
liste hors catalogue est bien dans *Marché & négo* et **pas** dans le carnet, zéro erreur JS.

- [ ] **Étape 5 : mettre à jour la mémoire**

Ajouter à `project_jarvis_360_features.md` : le modèle national livré, les trois niveaux de
fiabilité, la part globale mesurée, et la panne 403 Medic'AM avec sa parade.

---

## Auto-relecture du plan

**Couverture de la spéc** — §3 préalable → tâches 1 et 2 · §4 marché mesuré → tâche 3 étape 6 ·
§5 architecture → tâches 4 et 5 · §6 robot et garanties G1/G2/G3 → tâches 1, 3 (test t8) et 4 ·
§7 calibrage → tâche 5 · §8 les deux listes → tâche 6 · §9 vérification → tests t7 à t10 +
étape écran · §10 risques → gardes des tâches 1 et 4, mesure de poids tâche 3 étape 6.

**Cohérence des noms** — `ecrire_si_complet` (tâches 1 et 4), `fusionner` (tâche 4),
`partGlobale` / `partMarche` / `cibleNationale` / `ensureNational` (tâche 5),
`ecartNational` / `horsCatalogue` (tâche 6). Les champs de `national.json` (`v`, `s`, `d`, `g`)
sont identiques entre la tâche 4 qui les écrit et la tâche 5 qui les lit.

**Écart assumé** — la spéc §6 prévoit `gen` sur `national.json` : c'est le champ `generated`,
déjà présent dans la sortie de la tâche 4, lu par le bandeau de fraîcheur existant.

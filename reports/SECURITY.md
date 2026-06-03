# Audit Sécurité — JARVIS APP (Intégral Pharma)

**Date** : 2026-06-03
**Auditeur** : sous-agent `security-auditor`
**Périmètre** : `/Users/williammorel/JARVIS/APP/` · repo public `willmorel49-coder/jarvis-app` · GH Pages
**Contexte RGPD** : app manipule 517 pharmacies (CRM) + 1027 fiches OPSO avec données personnelles (nom, adresse, email, tel, contact pharmacien, dirigeants).

---

## TL;DR (verdict global)

| Domaine | Verdict | Sévérité max trouvée |
|---------|---------|----------------------|
| Secrets exposés | 2 trouvailles | **CRITIQUE** (creds scrapers) |
| `.gitignore` | Mis à jour (143B → ~1.6 KB) | — |
| Données RGPD | Fuite massive en clair sur GH Pages | **CRITIQUE** |
| Dépendances CDN | SRI partiel (Leaflet OK, reste KO) | MOYEN |
| Supabase RLS | Activé partout — policies à durcir | MOYEN |

**3 actions urgentes** :
1. Faire rotation immédiate du mot de passe Offilog `Azerty123` (réutilisé 2 scripts → compromis dans l'historique git).
2. Retirer `clients-data.js` du chargement HTML public + le servir post-auth depuis Supabase (RGPD).
3. Restreindre la policy Supabase `marketing_sheets` aux fiches du user (déjà OK) et durcir les autres tables (pharmacies/imports/sales) actuellement en `authenticated` = trop large.

---

## Section A — Secrets exposés

### A.1 Inventaire

| # | Fichier | Ligne | Type | Sévérité | Statut |
|---|---------|-------|------|----------|--------|
| 1 | `crm/index.html` | 105-106 | `SUPABASE_URL` + `SUPABASE_ANON_KEY` (JWT public, role `anon`) | **OK (public by design)** | À conserver |
| 2 | `opso/index.html` | 292-293 | Idem clés Supabase | **OK (public by design)** | À conserver |
| 3 | `import_wml_supabase.py` | 12-13 | Idem clés Supabase + ligne 15 `PASSWORD = 'demo2026'` (compte demo CRM) | **CRITIQUE** | Voir A.2 |
| 4 | `scraper_bestsellers_offilog.py` | 23-24 | `TESTVIP@offilog.fr` / `Azerty123` (compte tiers Offilog) | **CRITIQUE** | Voir A.2 |
| 5 | `scraper_offilog_live.py` | 25-26 | `TESTVIP@offilog.fr` / `Azerty123` (idem, dupliqué) | **CRITIQUE** | Voir A.2 |
| 6 | `ROBOT.md` | 46-47 | Référence à la clé anon Supabase + crédentials demo | INFO | OK (documentation) |
| 7 | `docs/superpowers/plans/2026-04-30-crm-v2-supabase.md` | 277-279 | Mots de passe **anciens** (`Admin2024!`, `Manager2024!`, `Demo2024!`) | FAIBLE | Vérifier qu'ils ne sont plus actifs côté Supabase |

### A.2 Justification CRITIQUE

- **Mot de passe `demo2026`** (compte `demo@integralpharma.fr`) committé en clair dans `import_wml_supabase.py`. Si le repo est public sur GitHub, toute personne avec ce fichier peut se connecter au CRM et accéder à toutes les pharmacies (RLS ouvre l'accès à tout user authentifié — voir Section E).
- **`TESTVIP@offilog.fr` / `Azerty123`** : compte Offilog tiers. Mot de passe trivial, réutilisé probablement ailleurs. Hors RGPD (compte service), mais sa fuite est une violation des CGU Offilog et un risque de poursuite IP/contractuel.

### A.3 Distinction Anon Key vs Service Role

L'anon key Supabase exposée (`role: "anon"` dans le JWT payload) est **PUBLIC by design** : Supabase l'a conçue pour le front. Elle ne donne accès qu'à ce que les policies RLS autorisent. Tant que RLS est ON sur toutes les tables (Section E), l'exposition est acceptable.

**Aucune clé `service_role`** trouvée dans le repo. Recherche : `service_role|SERVICE_ROLE|sk_live|sk_test|AKIA…|ghp_…|xox[baprs]-` → 0 résultats côté code (seulement 1 mention dans un spec MD). 

### A.4 Caches / tokens / .env

- **0 fichier `.env*`** trouvé dans le repo.
- **0 fichier `tokens.json`, `credentials*`, `*.key`, `*.pem`** trouvé.
- Caches scrapers présents (`cache_societe.json`, `cache_sirene.json`, etc.) → **données dirigeants RGPD**, voir Section C.

---

## Section B — .gitignore (avant/après)

### B.1 État avant

```
.DS_Store
*.log
.env

# Robot-Memory snippet
ROBOT.local.md
CLAUDE.local.md
.env.local
.env.*.local
.claude/cache/
.claude/.tmp/
.superpowers/
```

→ **143 bytes**, 11 lignes utiles. Ne couvre PAS : caches scrapers, XLSX/CSV données client, secrets élargis, fichiers Office temp `~$`, `output/`, `node_modules/`, `__pycache__/`, `*.pyc`.

### B.2 Diff appliqué (résumé)

Ajouts (par catégorie) :

- **Secrets élargis** : `*.pem`, `*.key`, `secret*`, `credentials*`, `tokens*.json`, `service_role*`, `.env.*`
- **Caches** : `cache_*.json`, `__pycache__/`, `*.pyc`, `*.pyo`, `.pytest_cache/`
- **Office temp** : `~$*.xlsx`, `~$*.xls`, `~$*.docx`, `~$*.pptx`
- **Données RGPD brutes** : `CRM INTEGRAL PHARMA.csv`, `BASE DE DONNÉE IP WM.xlsx`, `LIVRET CLIENTS*.pdf`, `cache_societe.json`, `cache_sirene.json`, etc.
- **Sorties scrapers** : `output/`, `bestsellers_offilog.*`, `offilog_live.*`, `leclerc_prices.json`, `benchmark_*.xlsx`, `images_*.json`
- **Excel sources** : `WML_*.xlsx`, `2025-*medic-am*.xlsx`, `2026-*medic-am*.xlsx`, `ventes*.xlsx`, `stock*.xlsx`, `TOP*.xlsx`
- **Node/build** : `node_modules/`, `dist/`, `build/`, `.cache/`, `package-lock.json`, `yarn.lock`
- **OS/IDE** : `.vscode/`, `.idea/`

### B.3 Fichiers actuellement présents sur disque qui DEVRAIENT être ignorés

| Fichier | Raison | Action |
|---------|--------|--------|
| `.DS_Store` (14 KB) | OS Mac, déjà gitignore mais peut être tracké historiquement | `git rm --cached .DS_Store` si tracké |
| `CRM INTEGRAL PHARMA.csv` (66 KB) | Source RGPD brute (517 pharmacies email/tel/contact) | `git rm --cached` |
| `BASE DE DONNÉE IP WM.xlsx` (1.7 MB) | Idem | `git rm --cached` |
| `LIVRET CLIENTS (1).pdf` (273 KB) | Document client probablement RGPD | `git rm --cached` |
| `cache_societe.json`, `cache_sirene.json`, `cache_panorama.json`, `cache_agents.json`, `cache_sites.json`, `cache_labodata.json` | Dumps API scraping dirigeants pharmacie (RGPD) | `git rm --cached` |
| `~$WML_03_2026.xlsx`, `~$TOP IP DÉCROISSANT.xlsx` (165 B) | Fichiers Excel temp Office | `git rm --cached` |
| `output/*.xlsx`, `output/~$*.xlsx` | Sorties scrapers volumineuses (4+ fichiers) | `git rm --cached` |
| `WML_01..04_2026.xlsx`, `stock 27 04 2026.xlsx`, `ventes*.xlsx`, `bestsellers_offilog.xlsx`, `benchmark_*.xlsx`, `offilog_live.xlsx`, `2025/2026-*medic-am*.xlsx` | Sources métier lourdes, certaines avec données client | `git rm --cached` (à confirmer cas par cas) |
| `images_by_ean.json` (3.8 MB), `images_drakkars.json` (2 MB) | Snapshots images concurrent | `git rm --cached` |

> **Note** : `git rm --cached <file>` retire du suivi sans supprimer du disque local. À faire dans un commit dédié `chore(security): purge tracked sensitive files` après vérification que rien d'utile à l'app ne dépend de ces fichiers (l'app utilise `crm/clients-data.js` généré, pas le `.csv` source).

---

## Section C — Données RGPD exposées publiquement

### C.1 Le constat

`crm/clients-data.js` (265 KB · 517 pharmacies) est :

1. **Chargé directement** par `crm/index.html` ligne 79 : `<script src="clients-data.js?v=20260603h"></script>`.
2. **Servi sur GH Pages** : repo public, donc URL `https://willmorel49-coder.github.io/jarvis-app/crm/clients-data.js` est accessible **sans aucune authentification**.
3. **Contenu** (vérifié lignes 5-30) : `cip`, `nom`, `adresse`, `cp`, `ville`, **`email`** (perso/pro), **`tel`** (perso/pro), `potentielGx` (CA potentiel), `ca2023` (CA réalisé), **`commentaire`** (notes commerciales internes — ex: « NЋgociЋ 5 cassettes sup », « finalisation dossier »), `contact` (nom du pharmacien).

Idem pour `crm/clients-data.bak.js` (backup, 265 KB, mêmes données).
Idem `opso/opso-adherents.js` et `opso/wml-data.js` à vérifier (probablement aussi exposés).

### C.2 Analyse RGPD

**Données traitées = données à caractère personnel** (nom + email + tel + contact + commentaires nominatifs).
**Base légale** probable : intérêt légitime commercial.
**Mais** :

- Pas de mesure technique adéquate (Art. 32 RGPD « Sécurité du traitement ») — la donnée est lisible par tout internaute, pas seulement les commerciaux IP.
- Pas de minimisation (Art. 5.1.c) — l'email + tel + commentaires nominatifs sont publiés alors qu'un identifiant CIP + nom suffirait au front pour démarrer.
- Pas d'information des personnes concernées (Art. 13/14) sur le fait que leurs coordonnées sont publiées sur un site public.

**Risque concret** :
- **Sanctions CNIL** : amende administrative jusqu'à 4 % CA Intégral Pharma ou 20 M€.
- **Scraping ciblé** : 517 emails+tels de pharmaciens exfiltrables en 1 requête `curl`. Risque phishing, démarchage abusif, listes revendues.
- **Image** : si découvert (ex: par un confrère, un journaliste, un employé d'une pharmacie listée), réputationnel direct.

### C.3 Pourquoi l'auth Supabase ne protège PAS

L'auth login Supabase (`tryLogin` dans `crm/app.js`) sert à montrer le `#app`, mais le fichier JS est dans le HTML : il est **téléchargé AVANT** la vérification d'auth. Un attaquant n'a même pas besoin de l'app, juste de `wget https://.../crm/clients-data.js`.

### C.4 Recommandations (priorisées)

1. **IMMÉDIAT (J+0)** : retirer `<script src="clients-data.js">` du `index.html`. Charger les pharmacies via `sb.from('pharmacies').select(...)` après login (la table existe déjà selon le schema SQL).
2. **J+7** : migrer la table `pharmacies` Supabase avec les colonnes `email`, `tel`, `contact`, `commentaire`, `potentiel`, `ca2023`. Importer `clients-data.js` une fois en DB, puis supprimer le fichier statique.
3. **J+7** : retirer aussi `clients-data.bak.js` (dupliqué).
4. **J+30** : audit similaire pour `opso/opso-adherents.js`, `opso/wml-data.js`, `crm/groupements-data.js` (peuvent contenir des emails/contacts).
5. **J+30** : revue du schéma Supabase RLS pour que la table `pharmacies` ne soit lisible qu'aux utilisateurs IP authentifiés (voir Section E).
6. **Si déjà committé sur GitHub public** : envisager `git filter-repo` pour purger l'historique (ou rotation totale des données : nouvelle nomenclature, regénération depuis le `.csv` source local).

---

## Section D — Dépendances CDN

### D.1 Inventaire `crm/index.html`

| Lib | Version | CDN | SRI hash | Pinning |
|-----|---------|-----|----------|---------|
| Leaflet CSS | 1.9.4 | unpkg.com | OUI (`sha256-p4NxAoJBhIIN…`) | OUI |
| Leaflet JS | 1.9.4 | unpkg.com | OUI (`sha256-20nQCchB9co0…`) | OUI |
| Supabase JS | **2** (latest dans la majeure) | cdn.jsdelivr.net | **NON** | NON (pin flou) |
| Chart.js | 4.4.4 | cdn.jsdelivr.net | **NON** | OUI |
| SheetJS (xlsx) | 0.20.3 | cdn.jsdelivr.net | **NON** | OUI |
| html2pdf | 0.10.2 | cdn.jsdelivr.net | **NON** | OUI |
| DM Sans (Google Fonts) | dynamique | fonts.googleapis.com | NON (impossible CSS dynamique) | — |

### D.2 Risques

- **Supply chain** : sans SRI, si un CDN est compromis ou un mainteneur push une version malveillante de `@supabase/supabase-js@2`, l'attaque s'exécute sous le domaine de l'app et peut exfiltrer la session JWT user (qui donne accès aux pharmacies/sales/imports en lecture/écriture côté Supabase).
- **`@supabase/supabase-js@2`** : pin sur la majeure, pas une version exacte. Toute nouvelle release peut introduire un bug ou un changement de comportement non audité.

### D.3 Recommandations

1. Pinner chaque CDN sur une version EXACTE : `@supabase/supabase-js@2.45.4` au lieu de `@2`.
2. Générer les hashes SRI :
   ```bash
   curl -sL https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js | openssl dgst -sha384 -binary | openssl base64 -A
   ```
3. Ajouter `integrity="sha384-…" crossorigin="anonymous"` sur chaque `<script src>` CDN.
4. Considérer héberger les libs en local (`crm/vendor/`) — supprime la dépendance CDN totalement, gain de perf au passage.

---

## Section E — Supabase RLS

### E.1 Verdict tables

| Table | RLS | Policies | Verdict |
|-------|-----|----------|---------|
| `user_profiles` | ON | `auth.uid() = id` (select uniquement) | **OK** |
| `pharmacies` | ON | `auth.role() = 'authenticated'` (select+insert+delete) | **TROP LARGE** |
| `imports` | ON | `auth.role() = 'authenticated'` (select+insert+delete) | **TROP LARGE** |
| `sales` | ON | `auth.role() = 'authenticated'` (select+insert+delete) | **TROP LARGE** |
| `marketing_sheets` | ON | `auth.uid() = created_by` (CRUD scopé) | **OK** |

### E.2 Détail "trop large"

Les policies `pharmacies / imports / sales` autorisent **tout utilisateur authentifié** à lire/insérer/supprimer **tous** les enregistrements, sans filtre par `created_by` ou par `pharmacy_id` du user. Concrètement :

- Si un commercial junior est créé dans Supabase, il a accès à 100 % des pharmacies (pas seulement les siennes).
- Un user authentifié peut **supprimer toute la table** `sales` (DELETE sans clause WHERE imposée par la policy).
- Pas de policy `UPDATE` du tout sur ces 3 tables — un user authentifié peut-il updater ? À tester (selon Supabase si pas de policy UPDATE explicite et RLS ON, l'update est bloqué — vérifier).

### E.3 Recommandations

1. Restreindre `DELETE` aux rôles `admin` / `manager` (via `user_profiles.role`).
2. Pour les commerciaux : scope par `pharmacy_id IN (select unnest(pharmacy_ids) from user_profiles where id = auth.uid())`.
3. Ajouter une policy `UPDATE` explicite (sinon update impossible côté app).
4. Pour `pharmacies` : si la table doit lister TOUTES les pharmacies pour cartographie, exposer une view publique anonymisée (cip + nom + ville seulement) et garder les coords contact dans une table protégée par scope user.

---

## Section F — Top 5 actions immédiates (priorisées)

| # | Action | Sévérité | Effort | Délai |
|---|--------|----------|--------|-------|
| 1 | **Rotation mot de passe Offilog** `TESTVIP@offilog.fr` (compromis dans `scraper_bestsellers_offilog.py` et `scraper_offilog_live.py`) ; charger via env var Python `os.environ['OFFILOG_PWD']` | CRITIQUE | 15 min | J+0 |
| 2 | **Rotation mot de passe Supabase** `demo@integralpharma.fr` (compromis dans `import_wml_supabase.py`) ; charger via `.env` | CRITIQUE | 10 min | J+0 |
| 3 | **Retirer `clients-data.js` du HTML public** : charger les pharmacies via Supabase post-auth (Section C) | CRITIQUE RGPD | 4-8h | J+7 |
| 4 | **Durcir policies RLS** Supabase `pharmacies/imports/sales` (Section E) | MOYEN | 2h | J+7 |
| 5 | **Ajouter SRI hashes** sur les 4 CDN jsdelivr (Supabase, Chart.js, SheetJS, html2pdf) + pinner Supabase sur version exacte | MOYEN | 30 min | J+14 |

---

## Annexe — Commandes git pour nettoyer le tracking

```bash
# Vérifier ce qui est actuellement tracké et qu'on veut purger
git ls-files | grep -E "(cache_.*\.json|CRM INTEGRAL|BASE DE DONNÉE|LIVRET CLIENTS|WML_.*\.xlsx)"

# Retirer du tracking sans supprimer du disque
git rm --cached "CRM INTEGRAL PHARMA.csv"
git rm --cached "BASE DE DONNÉE IP WM.xlsx"
git rm --cached "LIVRET CLIENTS (1).pdf"
git rm --cached cache_*.json
git rm --cached "~$"*.xlsx

# Vérifier le diff
git status

# Commit
git commit -m "chore(security): untrack RGPD data + caches scrapers"
```

> **Attention** : si ces fichiers ont déjà été pushés sur le repo public GitHub, leur retrait du tracking ne les efface PAS de l'historique. Il faudra envisager `git filter-repo --invert-paths --path "..."` ou contacter GitHub Support pour purger les blobs sensibles. Sinon **considérer toutes ces données comme compromises** et planifier la rotation.

---

**Fin du rapport. Aucun commit créé. Validation utilisateur requise avant fix code applicatif.**

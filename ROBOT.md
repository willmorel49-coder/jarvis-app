# ROBOT.md — Intégral Pharma · JARVIS APP

> Fichier de référence Claude. Garder sous 200 lignes — extraire vers `.claude/skills/` si besoin.

---

## §1 Identité

| Champ | Valeur |
|-------|--------|
| Projet | Intégral Pharma · CRM + Catalogue |
| Repo | https://github.com/willmorel49-coder/jarvis-app |
| Prod CRM | https://willmorel49-coder.github.io/jarvis-app/crm/ |
| Prod Catalogue | https://willmorel49-coder.github.io/jarvis-app/ |
| Owner | William Morel |
| Langue réponse | Français |

**Philosophie produit :** CRM pharmacie vanille JS, zéro dépendance build. Tout doit fonctionner en ouvrant `index.html` directement.

---

## §2 Stack

| Couche | Techno |
|--------|--------|
| Frontend | Vanilla JS · HTML · CSS (dark mode, CSS variables) |
| Fonts | Space Grotesk + Inter (Google Fonts CDN) |
| Charts | Chart.js 4.4.4 (CDN) |
| Excel parsing | SheetJS 0.20.3 (CDN) |
| Auth + DB | Supabase (Auth · PostgreSQL · Storage bucket `excel-imports`) |
| Hosting | GitHub Pages (branche `main`, auto-deploy) |
| Scrapers | Python 3.9 · requests · BeautifulSoup · openpyxl |
| Données statiques | `crm/clients-data.js` · `crm/benchmark-data.js` · `crm/offilog-data.js` · `crm/drakkars-data.js` · `crm/cap3000-data.js` · `opso/leclerc-data.js` |

**Design tokens (dark mode) :**
`--bg #070B14` · `--blue #0057FF` · `--mint #00E5A0` · `--amber #FFB020` · `--rose #FF4D6D` · Font : Space Grotesk + Inter

---

## §3 Variables d'environnement

Clés publiques exposées dans `crm/index.html` (lignes ~152-153). Pas de `.env`.

| Variable | Valeur |
|----------|--------|
| `SUPABASE_URL` | `https://iyvavhnlhxksokkerkos.supabase.co` |
| `SUPABASE_ANON_KEY` | JWT `eyJ...` (voir index.html) |

---

## §4 Commandes

```bash
# Déploiement (GitHub Pages auto après push main)
git add . && git commit -m "feat: ..." && git push

# Pipeline données Offilog (inclut Drakkars, Cap3000, Leclerc, Ma Pharmacie)
python3 generate_offilog.py    # → crm/offilog-data.js (3 520 produits, 1 417 prix Leclerc)

# Scraping Drakkars
python3 scraper_drakkars.py    # → benchmark_drakkars.xlsx (~4-5h, FETCH_PRODUCT_PAGES=True)
python3 generate_drakkars.py   # → crm/drakkars-data.js

# Scraping Cap3000
python3 scraper_cap3000.py     # → benchmark_cap3000.xlsx (~7 min, EAN depuis PHP dump)
python3 generate_cap3000.py    # → crm/cap3000-data.js

# Scraping E.Leclerc (EAN par EAN depuis liste Offilog, ~45 min)
python3 scraper_leclerc.py     # → leclerc_prices.json + opso/leclerc-data.js
# Ensuite relancer generate_offilog.py pour intégrer dans crm/offilog-data.js
```

---

## §5 Git Strategy

| Élément | Convention |
|---------|-----------|
| Branche prod | `main` → push = déploiement immédiat |
| Branches Claude | `claude/<sujet>` |
| Commits | `feat:` `fix:` `chore:` `refactor:` `data:` `ux:` |
| PR | Draft sur branches `claude/` |

---

## §6 Skills disponibles

| Skill | Contenu |
|-------|---------|
| `.claude/skills/crm-structure.md` | Architecture app.js, pages, navigation, état global |
| `.claude/skills/crm-supabase.md` | Schema SQL complet, RLS, Storage, Auth |
| `.claude/skills/crm-offilog.md` | Pipeline Offilog × scrapers × matching EAN/nom |
| `.claude/skills/crm-design.md` | Tokens CSS, composants, conventions UI |

---

## §7 Workflow Claude

1. Lire `tasks/todo.md` si tâches en cours
2. Vanilla JS only — pas de framework, pas de build step, pas de npm
3. Scrapers Python : compatibilité **Python 3.9** stricte (pas de `X | Y` type hints)
4. Matching Offilog : **EAN prioritaire**, nom normalisé en fallback
5. Chaque modification fonctionnelle → `git push` immédiat sur `main`
6. Scrapers longs → lancer en background `&`, surveiller via log file

---

## §8 Pièges connus

| Piège | Règle |
|-------|-------|
| Python 3.9 | Pas de `float \| None` — utiliser `= None` sans annotation |
| Supabase anon key | Format JWT `eyJ...`, pas `sb_publishable_...` |
| Offilog Excel | Feuille `"Croisement Complet"`, pas la feuille active |
| SheetJS | Parser les colonnes **par nom**, pas par index |
| GitHub Pages | Délai 1-2 min après push avant mise en ligne |
| ip_app-8.html | Legacy — ne pas toucher |
| Libs JS | Ne pas ajouter sans accord explicite |
| DRAKKARS ean | Peut être `null` (EAN absent sur certains produits) — ne pas supposer que l'EAN est toujours présent |
| OFFILOG champs attendus vs réels | app.js ne lit PAS `role`, `ecart`, `marge_pct`, `potentiel`, `prix_maxi`, `saison` — ces champs sont dans les données mais non consommés par l'interface actuelle |
| BENCHMARK champs attendus vs réels | `offre_ip` et `remise_pct` SONT présents dans benchmark-data.js (V2) — pas d'incohérence |
| Leclerc lookup | EAN seulement (pas de nom norm) — leclEan Map dans benchMaps(). OFFILOG_LIVE n'a pas prix_leclerc : lookup en temps réel via leclEan.get(ean). CRM offilog-data.js a prix_leclerc pré-calculé. |
| Prix achat vs prix public | WML ca/qt = prix achat HT pharmacien. Drakkars/Cap3000/Leclerc = prix public TTC consommateur. Alerte = prix pub conc. < prix achat IP (scandaleux). |

---

## §9 État courant

| Indicateur | Valeur |
|-----------|--------|
| Auth Supabase | 1 compte actif : `demo@integralpharma.fr` / `***RETIRE***` (rôle admin) |
| Clients | 517 pharmacies · champs : cip, nom, adresse, cp, ville, email, tel, potentielGx, ca2023, prochaineVisite, commentaire, pelgraz, pelmeg, ecodage, gros1, gros2 |
| Benchmark | 10 500 produits IP · 1 090 matchés Ameli · champs : designation, cip13, categorie, ip_qty, ip_ca, ip_rank_qty, ip_rank_ca, prix_ht, prix_ip, remise_pct, offre_ip, is_froid, has_ameli, ameli_months[13], ameli_jan26, rot_pharma_jan26, ameli_total, yoy_jan, atc2 |
| Offilog | 3 520 produits · 1 417 Leclerc matchés (EAN) · 1 403 Cap3000 · 1 113 Drakkars — champs : prix_offilog, prix_live, prix_pharmacie, prix_drakkars, prix_cap3000, **prix_leclerc**, img, dans_offilog, role, saison, etc. |
| Drakkars | 13 393 produits scrapés · 9 483 avec EAN · 3 876 KB — scrape complet 2026-05-08 |
| Cap3000 | 7 828 produits · 7 828 avec prix et EAN — champs : nom, nom_norm, marque, ean, prix_affiche, prix, url · scrape frais 2026-05-08 |
| E.Leclerc | 3 643 prix via API EAN (43% des 8 393 EANs Offilog) → opso/leclerc-data.js + champ prix_leclerc dans offilog-data.js |
| Offilog Live | 8 393 produits scrapés live → opso/offilog-live-data.js (prix, promo, stock, cat, EAN) |
| Storage | Bucket `excel-imports` (uploads Excel archivés) |
| Données générées | clients-data.js : 2026-05-03 · benchmark-data.js : 2026-05-04 · offilog-data.js : 2026-05-09 · drakkars-data.js : 2026-05-09 · cap3000-data.js : 2026-05-08 · leclerc-data.js : 2026-05-08 |
| Veille concurrentielle | nAlerte CRM : produits Offilog où prix public conc. (Leclerc/Drak/Cap3000) < prix achat IP — dashboard, catalogue Offilog, fiche pharmacie (showPharmaDetail), fiche de visite (CRM + OPSO) |

**Backlog → voir `tasks/todo.md`**

---

## §10 Règles métier NON NÉGOCIABLES (tous agents, toutes features)

| Règle | Détail |
|-------|--------|
| Abandon de marge, jamais « remise » | Toujours dire/écrire « abandon de marge » (« remise » n'est pas légal pour ça). « Net remisé » toléré à l'oral. |
| Barème par tranche | Prix net grossiste : 0–4,33 € (petits prix) · 4,33–468 € · >468 €. Marge MDL (REMBOURSABLES uniquement) : 0,18 € fixe ≤4,33 € · 3,9 % jusqu'à 468 € · 19,50 € fixe au-delà. NR = marge libre. |
| NR & génériques | Prix libre → afficher UNIQUEMENT le prix net IP : aucun %, aucun abandon. Génériques : juste le prix (les génériqueurs gèrent leurs remises). Exception : offres Sanofi/UPSA = champ `offre_ip`. |
| Conditions commerciales | On MONTRE les remises/conditions à l'écran en rdv ; on ne les IMPRIME jamais sur un doc remis au pharmacien, ni sur un support public (site vitrine, LinkedIn). |
| Identité Intégral | « Groupe de grossistes français » / « grossiste-répartiteur ». NE PAS décrire Intégral comme un « groupement » (les groupements = les groupes d'achat des pharmacies = la feature Groupements, autre chose). |
| Ton & positionnement | Pro, jamais familier ni auto-promo agressive. Soutenir pharmaciens ET patients (cf. positionnement LinkedIn). |
| 2 marques distinctes | CRM Intégral Pharma (bleu) ≠ OPSO/Normandie Pharma (vert). Ne pas mélanger chartes ni logos. |

> **Génériqueurs partenaires** (confirmé par Will le 04/08/2026) : **EG · Zentiva · Zydus · Teva**.
> ⚠️ Cette liste commerciale n'est **PAS** la liste de détection des génériques (`SUFFIXES_GENERIQUEURS` dans `generate_prod_stats.py`), qui est volontairement bien plus large. Intégral n'abandonne de marge sur **aucun** générique, partenaire ou non : réduire la détection aux 4 partenaires collerait un abandon fictif aux produits Biogaran, Mylan ou Sandoz.
>
> **Wegovy / Mounjaro** (confirmé le 04/08/2026) : **redevenus REMBOURSABLES** au 15/06/2026 — exclus du catalogue NR, soumis au barème d'abandon comme tout princeps.

## §11 Mode de travail avec Will

1. **Autonomie** (Will l'a explicitement autorisée) : ne pas s'arrêter pour demander « je continue ? ». Finir le lot entier, puis faire un rapport. S'arrêter UNIQUEMENT pour : action irréversible, changement de périmètre, ou info que seul Will a.
2. **Nouveau design / refonte visuelle** : NE JAMAIS coder directement une direction. D'abord 5-6 **variantes numérotées** dans une page HTML avec sélecteur, déployer, donner le lien, attendre les numéros choisis. Après 2 rejets visuels → exiger 2-3 références (Pinterest/Dribbble/screenshots).
3. **Livraison** : jamais dire « c'est en ligne » sans preuve. Après un push touchant `crm/v2/` : `bash scripts/attendre-prod.sh <token ?v=>` (attend que la nouvelle version soit VRAIMENT servie), ouvrir/screenshoter la page modifiée (mobile 390px si UI), PUIS finir le message par l'**URL prod exacte cliquable**.
4. **PDF / fiches** : générer le vrai PDF et vérifier chaque page (rien de coupé, pas de page blanche d'entête) AVANT de livrer.
5. **Avant tout push touchant `crm/v2/`** : réflexe gardien-deploiement (syntaxe + `?v=` bumpé + `sw.js` VER synchro) ; si UI modifiée → verif-mobile.
6. **Poids** : l'app a déjà figé le Mac/Safari de Will. Tout nouveau `*-data.js` > 500 Ko → chargé en différé (`V2.loadFiles`), jamais dans le boot.

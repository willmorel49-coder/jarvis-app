# Todo — Intégral Pharma CRM

## En cours


## Backlog réunion commerciaux (2026-07-08)
> « Les plus utilisés » : **Opportunités produits** + **Infos du matin**.

### A. Prix & fiches (commercial, sensible)
- [ ] Abandon de marge sur **princeps petits prix** (aujourd'hui souvent « — »)
- [ ] **PPHT + prix IP net** sur fiches collégiales/marketing — visible à l'écran devant le client, **jamais imprimé/communiqué** l'abandon de marge
- [ ] Vocabulaire : toujours « **abandon de marge** », jamais « remise » (audit écran + PDF)

### B. Groupements & clients
- [ ] Ranger les groupements par **ordre alphabétique**
- [ ] **PUC Pharma → Les Officinales** (renommage données)
- [ ] **Sous-groupes Giphar** (hiérarchie groupement/sous-groupe)
- [ ] **Fiche groupement complète** : grossistes + génériqueurs, modifiable sur la fiche (listes déroulantes), s'actualise
- [ ] **Coin notes** groupement + fiche client, avec **auteur + date** (partagé équipe → Supabase)
- [ ] **Mois par mois par catégorie** sous le CA pharma

### C. Plateforme & équipe
- [ ] **Installer l'appli** (téléphone + ordi) + proposer les **mises à jour**
- [ ] **Remontée équipe** : popup → page « Remontées/améliorations » (partagé, auteur → Supabase)

### D. Développer les 2 outils phares
- [ ] Infos du matin — à développer
- [ ] Opportunités produits — à développer

### Décisions / dépendances
- Notes + remontée = données **partagées** entre commerciaux → Supabase, auteur = compte connecté
- Fiche groupement éditable → modèle de données + persistance (Supabase)
- Mois-par-mois catégories → dépend de la dispo des ventes mensuelles par catégorie/pharmacie

## Backlog (ancien)
- [ ] Maxipara : scraper live prix site maxipara.fr (script frère à récupérer)
- [ ] Améliorer taux de matching Offilog (EAN manquants dans Excel source)
- [ ] Ajouter d'autres comptes utilisateurs Supabase Auth si besoin

## Fait ✓
- [x] Migration auth localStorage → Supabase
- [x] Scraper Drakkars (13 409 produits, EAN via JSON-LD)
- [x] Scraper Cap3000 (7 718 produits, EAN via PHP dump)
- [x] Onglet Offilog : colonnes Drakkars + Cap3000, filtre marque + univers
- [x] Dashboard M vs M-1 par pharmacie
- [x] Export CSV par pharmacie
- [x] Storage Excel : upload/download/delete imports
- [x] Supabase Storage : bucket `excel-imports` créé (confirmé §9 ROBOT.md)
- [x] Benchmark V2 : 13 mois Ameli + prix IP + offre_ip + remise_pct (benchmark-data.js généré le 2026-05-04)

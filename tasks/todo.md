# Todo — Intégral Pharma CRM

## En cours


## Backlog
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

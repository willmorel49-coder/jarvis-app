# Todo — Intégral Pharma CRM

## En cours


## Backlog
- [ ] Maxipara : scraper live prix site maxipara.fr (script frère à récupérer)
- [ ] Supabase Storage : créer bucket `excel-imports` dans le dashboard
- [ ] Ajouter d'autres comptes utilisateurs Supabase Auth si besoin
- [ ] Améliorer taux de matching Offilog (EAN manquants dans Excel source)

## Fait ✓
- [x] Migration auth localStorage → Supabase
- [x] Scraper Drakkars (13 409 produits, EAN via JSON-LD)
- [x] Scraper Cap3000 (7 718 produits, EAN via PHP dump)
- [x] Onglet Offilog : colonnes Drakkars + Cap3000, filtre marque + univers
- [x] Dashboard M vs M-1 par pharmacie
- [x] Export CSV par pharmacie
- [x] Storage Excel : upload/download/delete imports

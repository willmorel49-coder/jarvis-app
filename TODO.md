# TODO — Intégral Pharma CRM

## V2 — Supabase (priorité haute)
- [ ] Créer projet Supabase (integralpharma)
- [ ] Migrer auth localStorage → Supabase Auth
- [ ] Créer tables PostgreSQL (pharmacies, imports, sales, users)
- [ ] Migrer données localStorage → Supabase
- [ ] Row Level Security pour les rôles (admin/manager/commercial)
- [ ] Supabase Storage pour archiver les fichiers Excel originaux
- [ ] Accès multi-utilisateurs réel (chacun voit ses données)

## Features CRM — Priorité haute
- [ ] Comparaison périodes (mois M vs M-1) sur le dashboard
- [ ] Graphique évolution CA par pharmacie (line chart)
- [ ] Export CSV / PDF d'un rapport pharmacie
- [ ] Filtre par période sur tous les écrans
- [ ] Recherche globale (produit + pharmacie)

## Features CRM — Priorité moyenne
- [ ] Fiche pharmacie : graphique évolution mensuelle
- [ ] Vue produit : quelles pharmacies achètent ce produit
- [ ] Alertes : pharmacies sans achat depuis X mois
- [ ] Tableau de bord manager : vue équipe commerciale
- [ ] Import automatique depuis email (parsing pièce jointe)

## Features CRM — Priorité basse
- [ ] Mode hors-ligne (Service Worker + IndexedDB)
- [ ] Notifications push (nouvelles données)
- [ ] Dark/light mode toggle
- [ ] Application mobile native (PWA manifest)
- [ ] API Supabase → intégration ERP externe

## App Catalogue (ip_app-8.html — legacy)
- [ ] Connecter au même Supabase que le CRM
- [ ] Synchroniser les données produits
- [ ] Mettre à jour index.html → pointer vers crm/

## Infra
- [ ] Configurer domaine custom (ex: crm.integralpharma.fr)
- [ ] GitHub Actions : tests automatiques
- [ ] Backup automatique Supabase
- [ ] Monitoring uptime

## Fait ✅
- [x] App catalogue mobile premium (ip_app-8.html)
- [x] Repo GitHub + GitHub Pages
- [x] CRM V1 : auth, import Excel, dashboard, pharmacies, produits, admin
- [x] Design system dark mode (Space Grotesk, glassmorphism)
- [x] Détection automatique pharmacie depuis nom de fichier
- [x] Documentation projet (CLAUDE.md, README, DESIGN, LESSONS, AGENT)

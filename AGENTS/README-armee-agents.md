# Armée de 20 agents — CRM JARVIS (Intégral Pharma)

20 sous-agents Claude Code, chacun avec un rôle précis sans recouvrement, **alignés sur l'app JARVIS réelle** : CRM web **vanilla JS zéro build** (GitHub Pages, Supabase auth-only) + générateurs **Python 3.9** qui produisent les fichiers de données `.js`, + projet **GROUPEMENTS** (prospection).

## Utilisation

- Ils vivent dans `.claude/agents/` (versionnés dans le repo). `/agents` pour les lister.
- Appelle-les par leur nom, ou laisse `tech-lead-orchestrator` déléguer.

## Les 6 escouades

**ARCHI & PILOTAGE**
- `tech-lead-orchestrator` : découpe une demande, délègue, tient le plan (lit ROBOT.md)
- `architect-reviewer` : valide le design avant build (séparation données/logique/piliers, zéro dépendance)
- `codebase-cartographer` : cartographie le repo (piliers v2-*.js, générateurs, données, GROUPEMENTS)

**BUILD DATA / GÉNÉRATEURS**
- `data-pipeline-engineer` : générateurs Python (ventes WML, mix marketing, PPHT, photos), scraping groupements
- `pharma-data-modeler` : CIP13/EAN/afmcode, matching benchmark/ventes/PPHT, jointures fiables
- `python-refactorer` : qualité des générateurs Python (3.9 strict), sans changer la sortie
- `doc-report-engineer` : documents commerciaux — fiches/catalogues PDF (html2pdf, charte IP), exports

**FRONT / UI**
- `dashboard-frontend-dev` : piliers v2-*.js (vanilla JS), intégration data, responsive/PWA, cache busting
- `dataviz-specialist` : graphes du pilotage (Chart.js), couleurs cohérentes, formats FR
- `ui-ux-polish` : finition, hiérarchie, ergonomie, tokens CSS, règles UX de Will

**QUALITÉ & SÉCURITÉ**
- `code-reviewer` : relecture façon PR (conventions JARVIS, cache, sécurité), triée par priorité
- `test-engineer` : vérifs générateurs + règles métier (MDL, PPHT, bestPrice), `node --check`
- `data-quality-validator` : dernier rempart avant déploiement (prix/remises/doublons/totaux)
- `security-auditor` : secrets Supabase (anon OK, jamais service_role), données client, PDF privés, historique
- `performance-optimizer` : gros `.js`, rendu, lazy-load, génération PDF

**MÉTIER & CONFORMITÉ**
- `pharma-domain-expert` : barème MDL (remboursables), marge libre NR/PPHT, tranches prix IP, offre labo, froid
- `rgpd-compliance-officer` : données clients nominatives + app publique, minimisation, exposition

**DEVEX & LIVRAISON**
- `devops-ci-engineer` : déploiement GitHub Pages (push main), cache `?v=` + sw.js, .gitignore, git propre
- `docs-writer` : ROBOT.md, skills, et explications côté Will en **français simple**
- `bug-hunter` : cause racine, écarts de chiffres (chaîne .xlsx → générateur → .js → affichage)

## Par où commencer

Noyau couvrant 80 % des cas : `tech-lead-orchestrator`, `pharma-domain-expert`, `data-quality-validator`, `code-reviewer`, `bug-hunter`, `security-auditor` (avant chaque push), `dashboard-frontend-dev`. Les autres = situationnels.

## Coût

Chaque sous-agent tourne dans son propre contexte (un workflow très multi-agents peut consommer beaucoup plus de tokens). Délègue quand ça fait gagner du temps réel ou de la fiabilité ; pour une petite correction, reste en session principale.

## Stack réelle (ces agents en tiennent compte)

Vanilla JS / HTML / CSS (zéro build) · Supabase (auth + profils) · GitHub Pages · Chart.js, SheetJS, html2pdf, Leaflet (CDN) · générateurs Python 3.9 (openpyxl, pandas) · projet GROUPEMENTS (sqlite, scrapers). **Pas de framework, pas de dépendance externe ajoutée sans accord.**

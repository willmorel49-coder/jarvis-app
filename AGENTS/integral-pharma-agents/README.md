# Armee de 20 agents - Appli Integral Pharma

20 sous-agents Claude Code, prets a deposer dans ton repo. Chacun a un role precis, sans recouvrement, pense pour une appli d'analytics pharma (Python + dashboard web).

## Installation (2 min)

1. Copie le dossier `.claude/` a la racine de ton repo (au meme niveau que `CLAUDE.md`).
2. Ouvre Claude Code dans le projet et tape `/agents` pour verifier qu'ils sont charges.
3. C'est tout. Tu peux les appeler par leur nom, ou laisser le `tech-lead-orchestrator` deleguer.

Scope projet : versionne `.claude/agents/` dans Git -> toute l'equipe (Arthur, Karine, Samuel) en profite.

## Les 6 escouades

ARCHI & PILOTAGE
- tech-lead-orchestrator : decoupe une demande, delegue, tient ROADMAP.md (Opus)
- architect-reviewer : valide le design avant le build (Opus)
- codebase-cartographer : cartographie le repo (Haiku)

BUILD DATA / BACKEND
- python-refactorer : qualite du code Python, sans changer le comportement
- data-pipeline-engineer : ETL, scraping, enrichissement, recalibrage CRM
- excel-report-engineer : exports .xlsx a TON standard (Top 20, medailles, vert/rouge)
- pharma-data-modeler : CIP13/artcode/afmcode, normalisation, jointures fiables

FRONT / DASHBOARD
- dashboard-frontend-dev : composants, etat, integration data, responsive
- dataviz-specialist : le bon graphe pour la bonne donnee
- ui-ux-polish : finition, hierarchie, ergonomie

QUALITE & SECURITE
- code-reviewer : relecture facon PR, triee par priorite
- test-engineer : pytest, golden-file sur les sorties Excel
- data-quality-validator : dernier rempart avant livraison d'un chiffre
- security-auditor : secrets (tokens.json), donnees client, dependances (Opus)
- performance-optimizer : gros volumes, pandas, generation Excel

METIER & CONFORMITE
- pharma-domain-expert : bareme marges, coef NR, 5 categories, biosimilaires (Opus)
- rgpd-compliance-officer : donnees client sensibles, minimisation, conservation

DEVEX & LIVRAISON
- devops-ci-engineer : GitHub Actions, synchro VS Code/Claude Code/mobile
- docs-writer : README, CLAUDE.md, methodos pour les collegues
- bug-hunter : cause racine, ecarts de chiffres

## Franc-parler : par ou commencer

20 agents, c'est plus que ce que la plupart des projets utilisent vraiment. Ne les cable pas tous en daily driver. Le noyau a activer en premier (couvre 80% des cas) :

1. tech-lead-orchestrator  (le cerveau)
2. pharma-domain-expert     (ton vrai differentiateur metier)
3. excel-report-engineer    (ton livrable signature)
4. data-quality-validator   (zero chiffre faux chez Vincent)
5. code-reviewer            (filet de securite permanent)
6. bug-hunter               (quand ca casse)
7. security-auditor         (avant chaque push - tu manipules de l'encours client)

Les 13 autres = situationnels. Tu les appelles quand le besoin tombe (refonte, perf, RGPD, nouveau module front...). Ils restent dispos sans te polluer.

## Strategie de modeles (deja reglee dans les fichiers)

- Opus = jugement et coordination : orchestrateur, archi, metier, securite.
- Sonnet = build et review : la majorite.
- Haiku = exploration/recherche rapide : cartographe.

Tu peux forcer un defaut global :
`export CLAUDE_CODE_SUBAGENT_MODEL="sonnet"`

## Le vrai cout (a savoir)

Chaque sous-agent tourne dans son propre contexte. Un workflow tres "multi-agents" peut consommer jusqu'a ~7x les tokens d'une session simple. Logique entrepreneuriale : delegue quand ca te fait gagner du temps reel ou de la fiabilite, pas par reflexe. Pour une petite correction, reste en session principale.

## Hypothese de stack

Ces agents partent du principe : Python (pandas, openpyxl) + dashboard web (HTML/JS ou React). Si ton appli est en React seul, Next.js, ou autre, dis-le moi : je retune les agents de build et front en quelques minutes.

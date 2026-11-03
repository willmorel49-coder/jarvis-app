# Améliorations du setup Claude Code — JARVIS — novembre 2026

Audit du 03/11/2026, sur `origin/main` 93308e50. Rien n'a été installé ni modifié dans la configuration :
ce fichier propose, Will décide.
Légende : ✅ vérifié (commande lancée ou page officielle citée) · ❓ supposé ou non vérifié.
Notes de veille complètes (hors dépôt) : `~/jarvis-preuves/audit-setup-2026-11/veille.md` et `handshakes.txt`.

## 0. Ce que la consigne d'audit suppose et qui n'est plus vrai

| Consigne | Réalité dans le dépôt ✅ |
|---|---|
| Règle L001, format `Lxxx` | N'existe pas. `tasks/lessons.md` suit le format `date \| erreur \| règle`, dernière entrée le 06/05/2026. Les vraies leçons vivent dans la mémoire Claude, `~/.claude/JOURNAL.md` et les skills. |
| `ip_app.html` mono-fichier | Le fichier s'appelle `ip_app-8.html` (legacy, ROBOT.md §8 : « ne pas toucher »). Non concerné par cet audit. |
| Serveurs déjà utilisés : Netlify, Notion | JARVIS n'est pas sur Netlify (GitHub Pages publié par `ci.yml` + relais `crm-jarvis.vercel.app`). Notion est interdit (CLAUDE.md §12) : non étudié. |
| `recalc.py` | Absent du dépôt. |
| 30 derniers commits | 29 sur 30 sont des robots : l'analyse a été étendue à 30 jours (966 commits, dont 508 faits par des sessions). |

## 1. État des lieux ✅

**Serveurs MCP** (`claude mcp list`, 03/11) :
- Utilisateur : `context7`, `playwright` (locaux), `github` (distant, jeton dans un en-tête, **lecture et écriture**).
- Projet : `supabase` et `datagouv` sont dans un `.mcp.json` **non suivi par git**, présent seulement dans `~/JARVIS/APP` (branche périmée). Absent d'`origin/main`, donc absent de tous les worktrees où se fait le travail. État « en attente d'approbation ». ⚠️ Ce `supabase`-là n'a **pas** l'option lecture seule.
- 14 connecteurs claude.ai, dont Gmail, Google Drive et Notion (branchés mais interdits d'usage, décision du 15/08/2026).

**Hooks** (`~/.claude/settings.json`) : 22 branchements. `garde-registre.py` y est déclaré **4 fois** dans la même entrée. Aucun contrôle de syntaxe JS pendant la session : le hook ECC `stop-format-typecheck` ne traite que TypeScript et les projets dotés d'un formateur. `ci.yml` contrôle la syntaxe, mais seulement sous `crm/`, et seulement après le push.

**Sous-agents** : 22 dans le dépôt (`.claude/agents/`), 4 chez l'utilisateur. Appels mesurés dans tout l'historique des sessions (`~/.claude/projects/**/*.jsonl`) :
`general-purpose` 1 780 · `gardien-deploiement` 757 · `verif-mobile` 34 · `chercheur-open-source` 5 · **les 20 autres agents du dépôt : 0 appel.**

🔴 **Doublons de nom** : `gardien-deploiement` et `verif-mobile` existent aux deux endroits. Version du dépôt : 10/07/2026, 32 lignes, **sans** le contrôle `opso/v2/index.html` (13 mises en ligne ratées du 16 au 19/10). Version utilisateur : 60 et 75 lignes, à jour. La doc officielle est claire : *« When multiple subagents share the same name, Claude Code uses the one from the higher-priority location »*, et le dossier du **projet** passe avant celui de l'utilisateur (https://code.claude.com/docs/en/sub-agents). **Dans chaque worktree JARVIS, c'est donc la vieille version qui tourne.** Pour les skills, c'est l'inverse : l'utilisateur l'emporte (https://code.claude.com/docs/en/skills).

**Commandes et skills** : aucune commande dans le dépôt (README vide). Deux skills sur place (`fx-bank`, `jarvis-conventions`), alors que ROBOT.md §6 en annonce quatre autres, qui n'existent pas.

**Tâches refaites à la main** (30 jours) :
- **Jeton de cache `?v=`** : 218 commits de session le mentionnent, 82 commits ne font que ça (`fix/chore(cache)`), et 266 commits touchent `crm/v2/sw.js`. La logique existe déjà dans le robot des stats (`bump_cache` de `~/stats-commercial/veille-stats.py`), mais les sessions la refont à la main.
- **Messages de commit** : 83 sur 508 sortent de la convention (52 sans type, surtout les 09, 14, 29 et 30/10 ; 31 avec un type hors liste : `offilog:`, `texte:`, `appro:`…).

## 2. Propositions classées par gain / effort

| # | Type | Nom | Problème concret résolu dans JARVIS | Gain | Effort | Risque données | Handshake | Installation |
|---|---|---|---|---|---|---|---|---|
| 1 | agent | Retirer les 2 doublons périmés du dépôt | Le gardien de juillet masque celui d'octobre dans chaque worktree | Élevé | 2 min | Aucun | — | `git rm .claude/agents/gardien-deploiement.md .claude/agents/verif-mobile.md` |
| 2 | hook | `node --check` après chaque écriture d'un `.js` | Erreur de syntaxe vue au push seulement, et hors `crm/` jamais vue ; un CI rouge bloque aussi les autres sessions | Élevé | 10 min | Aucun | — | §5.2 (testé ✅) |
| 3 | MCP | Supabase officiel, **lecture seule**, limité au projet | Jeton de gestion mort deux fois (11/09, 28/10) ; lecture SQL aujourd'hui par Safari piloté | Élevé | 5 min + une connexion de Will | ⚠️ lit toutes les tables ❓ ; les résultats passent par Anthropic (hors UE ❓) | 401 ✅ (vivant, exige OAuth) | §5.3 |
| 4 | commande | `/jeton` + `scripts/jeton.py` | 82 commits « jeton seul » en 30 j ; piège `opso/v2` | Élevé | ~1 h | Aucun | — | §3 « À construire » |
| 5 | MCP | data.gouv.fr (officiel) | Trouver et vérifier les jeux publics (BDPM, Sirene, BAN…) sans écrire de scraper | Moyen | 2 min (même fichier que #3) | Aucun si aucune requête ne contient un nom d'officine | 200 ✅ (v1.30.0, 10 outils en lecture seule, sans clé) | §5.3 |
| 6 | règle | Corriger ROBOT.md (5 points) | Lu à chaque session, il prescrit `git add .` (bloqué), cite 4 skills inexistantes et le push direct sur `main` | Moyen | 10 min | Diminue | — | §5.5 |
| 7 | hook git | `commit-msg` : format `type(portée): sujet` | 83 messages hors convention en 30 j | Moyen | 15 min | Aucun | — | §5.4 |
| 8 | config | GitHub MCP en lecture seule | CLAUDE.md §12 : « jeton en lecture seule par défaut » ; les pushes passent par `git` | Moyen | 2 min | Diminue | 401 ✅ | §5.7 |
| 9 | agent | Archiver les 20 agents jamais appelés | ~5,3 Ko de descriptions relues à chaque session (≈ 1 300 à 1 500 jetons, estimation ❓) | Faible-moyen | 5 min | Aucun | — | `git mv` vers `.claude/agents-archive/` (non chargé) |
| 10 | hook | Blocage d'un nom de client réel dans docs, tests et messages de commit | Dépôt PUBLIC | Moyen | 1 à 2 h | Diminue | — | §3 « À construire » |
| 11 | config | Dédoublonner `garde-registre.py` (×4) | Lisibilité. La doc ne garantit le dédoublonnage qu'entre fichiers différents ❓ | Faible | 2 min | Aucun | — | §5.6 |
| 12 | règle | `tasks/lessons.md` renvoie vers les vraies sources | Fichier figé depuis mai : une session qui le lit croit tout savoir | Faible | 5 min | Aucun | — | une ligne d'en-tête |

### À faire tout de suite (3)

1. **Retirer les deux agents périmés du dépôt** (#1). Les versions de `~/.claude/agents/` prennent alors le relais dans tous les worktrees.
   ```bash
   git rm .claude/agents/gardien-deploiement.md .claude/agents/verif-mobile.md
   git commit -m "chore(agents): le gardien et verif-mobile à jour (~/.claude) ne sont plus masqués"
   ```
2. **Hook `node --check`** (#2) : créer `.claude/hooks/verif-syntaxe-js.mjs` et compléter `.claude/settings.json` comme au §5.2. Essai fait sur copie : fichier correct, code 0 ; fichier cassé, code 2 avec le message ; `vendor/` et `.md` ignorés ; JSON illisible, aucun blocage ; 0,13 s sur `v2-boot.js`.
3. **Supabase en lecture seule et data.gouv.fr dans un `.mcp.json` suivi** (#3 et #5), comme au §5.3. Puis, une seule fois : lancer `claude` dans un worktree JARVIS, accepter les deux serveurs, taper `/mcp`, choisir `supabase` puis « Authenticate », et se connecter dans le navigateur. Aucun jeton à copier (doc Supabase : *« You don't need a personal access token »*). **Ne pas approuver** le `.mcp.json` actuel de `~/JARVIS/APP` : il n'a pas `read_only=true`.

## 3. À construire nous-mêmes

**A. `scripts/jeton.py` + `/jeton`** (#4). Reprendre la logique déjà éprouvée du robot (`nouveau_jeton`, `bump_cache`) au lieu de la réécrire.
```
scripts/jeton.py                 # avance le jeton partout, vérifie qu'il n'en reste aucun
.claude/commands/jeton.md        # « /jeton » : lance le script, montre le diff, rappelle attendre-prod.sh
tests/jeton.test.py              # cas « b existe → c », « prod en avance sur le dépôt », opso/v2 décroché
```
```python
#!/usr/bin/env python3
"""Avance le jeton de cache ?v= dans tous les fichiers d'un coup.
Même logique que bump_cache() de ~/stats-commercial/veille-stats.py : le jeton
AVANCE toujours (jamais redescendre), et opso/v2/index.html est réécrit en entier
(du 16 au 19/10, 13 suffixes y sont restés en arrière pendant 13 mises en ligne)."""
import re, subprocess, sys, urllib.request

PROD = 'https://crm-jarvis.vercel.app/crm/v2/index.html'
TOUS_LES_V = ['crm/v2/index.html', 'opso/v2/index.html']        # chaque ?v= remplacé
MOTIFS = {
    'crm/v2/sw.js': r"(var VER\s*=\s*')[^']*(')",
    'crm/v2/v2-boot.js': r"(var V = '\?v=)[^']*(')",            # à confirmer sur le fichier
}

def jeton_en_prod():
    html = urllib.request.urlopen(PROD, timeout=20).read().decode('utf-8')
    return sorted(set(re.findall(r'\?v=([0-9a-zA-Z]+)', html)))

def suivant(anciens):
    ...  # copier nouveau_jeton() du robot, avec ses 5 cas de test

def main():
    ...  # 1. lire la prod  2. choisir le suivant  3. remplacer  4. git grep -c <ancien> == 0
    return 0

if __name__ == '__main__':
    sys.exit(main())
```

**B. Serveur MCP BDPM local** (aucun n'existe ✅ : rien dans awesome-remote-mcp-servers, rien d'officiel). Gain moyen ❓ : le besoin réel (combien de sessions réécrivent un script jetable pour lire la BDPM) n'a pas été mesuré.
```
outils/mcp-bdpm/
  serveur.py      # 3 outils en lecture seule
  README.md       # source : base-donnees-publique.medicaments.gouv.fr (CIS_CIP_bdpm.txt, CIS_GENER_bdpm.txt)
```
```python
from mcp.server.fastmcp import FastMCP     # SDK officiel ; exige Python >= 3.10 ❓ (le Mac a 3.9 en /usr/bin)
mcp = FastMCP("bdpm")

@mcp.tool()
def cip13(code: str) -> dict:
    """Libellé, prix, taux de remboursement d'un CIP13 (CIS_CIP_bdpm.txt)."""
    ...

@mcp.tool()
def groupe_generique(cis: str) -> list:
    """Princeps et génériques du même groupe (CIS_GENER_bdpm.txt)."""
    ...

if __name__ == "__main__":
    mcp.run()
```
Installation : `claude mcp add bdpm --scope project -- uv run outils/mcp-bdpm/serveur.py`. Gratuit, 100 % local, aucune clé.

**C. Hook « nom de client réel »** (#10). Bloquer un commit seulement sur `tasks/`, `docs/`, `tests/`, les `*.md` et le message de commit. Les fichiers de données du CRM contiennent des noms d'officines par nature : les inclure noierait le contrôle sous les fausses alertes. La liste des noms vit **hors du dépôt** (`~/.config/jarvis/noms-proteges.txt`). Le hook se branche en PreToolUse avec `"if": "Bash(git commit *)"`, champ documenté (https://code.claude.com/docs/en/hooks), et bloque avec le code 2.

## 4. Écartés

- **Notion, Gmail, Google Drive** : interdits (CLAUDE.md §12).
- **Netlify MCP** : JARVIS n'est pas sur Netlify.
- **Microsoft 365 « Work IQ »** : exige une licence Copilot et une facturation à l'usage ❓ (sources tierces, à confirmer sur learn.microsoft.com). `ms-365-mcp-server` (communautaire) : les mails clients passeraient par un outil tiers non audité.
- **MCP Légifrance communautaires** (pylegifrance, fr-eli-mcp, french-law-mcp) : non officiels, maintenance non vérifiée. Le robot du Journal officiel couvre déjà le besoin.
- **insee-mcp** : non officiel (auteur individuel), clé INSEE requise.
- **Vérif Entreprise FR** : paiement en crypto (x402) et serveur anonyme.
- **LibreJustice** : éditeur non identifié.
- **Browserbase** : navigateur dans le cloud, alors que Playwright tourne déjà en local.
- **Firecrawl** : gratuit jusqu'à 1 000 crédits par mois, avec une clé. Aucun besoin que Playwright et les robots ne couvrent déjà, et les pages visitées passeraient par un tiers.
- **Bright Data, Apify, Tavily, Exa** : tarifs non vérifiés, aucun besoin identifié.
- **Sentry** : gratuit jusqu'à 5 000 erreurs, connexion OAuth (401 ✅). Le CRM a déjà son capteur d'erreurs (audit du 23/06/2026 ❓), et l'hébergement en UE n'est pas vérifié.
- **MCP Excel / PDF tiers** (PDFOven, SheetRender…) : payants ou anonymes. Les skills `xlsx` et `pdf` sont déjà installées.
- **Hook `recalc.py` après un `.xlsx`** : `recalc.py` n'existe pas. Les `.xlsx` sont écrits par des scripts Python lancés en Bash, qu'un hook Write/Edit ne verrait jamais, et LibreOffice n'est pas installé.
- **Sous-agent « veilleur ANSM »** : 33 workflows GitHub Actions font déjà la veille ANSM, BDPM, EMA et JO chaque jour, sans toucher au quota Claude.
- **Sous-agent « analyste XLSX pharma »** : `pharma-data-modeler` et `data-quality-validator` existent déjà et n'ont jamais été appelés. Un agent de plus n'y changerait rien.

## 5. Diffs proposés (NON appliqués)

### 5.2 Hook `node --check`
Nouveau fichier `.claude/hooks/verif-syntaxe-js.mjs` (version testée) :
```js
// PostToolUse : `node --check` sur chaque .js/.mjs écrit, pour voir une erreur de
// syntaxe tout de suite plutôt qu'au push (ci.yml ne contrôle que crm/).
import { spawnSync } from 'node:child_process';
let brut = '';
process.stdin.on('data', (c) => (brut += c)).on('end', () => {
  let f = '';
  try { f = JSON.parse(brut).tool_input?.file_path || ''; } catch { return; }
  if (!/\.m?js$/.test(f) || f.includes('/vendor/')) return;
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(`Erreur de syntaxe dans ${f} :\n${r.stderr}`);
    process.exit(2);
  }
});
```
`.claude/settings.json` :
```diff
       "Bash(npm publish:*)"
     ]
-  }
+  },
+  "hooks": {
+    "PostToolUse": [
+      {
+        "matcher": "Write|Edit|MultiEdit",
+        "hooks": [
+          { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/verif-syntaxe-js.mjs" }
+        ]
+      }
+    ]
+  }
 }
```
Doc ✅ : le chemin arrive dans `tool_input.file_path`. En PostToolUse, le code 2 *« shows stderr to Claude; the tool already ran »* : Claude voit l'erreur et la corrige, rien n'est annulé.

### 5.3 `.mcp.json` suivi par git (nouveau fichier à la racine)
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=iyvavhnlhxksokkerkos&read_only=true"
    },
    "datagouv": { "type": "http", "url": "https://mcp.data.gouv.fr/mcp" }
  }
}
```
Doc Supabase ✅ : `read_only=true` = *« Execute all queries as a read-only Postgres user »* ; `project_ref` = *« Scope to a specific project »*. L'identifiant du projet est déjà public (ROBOT.md §3). Le hook `garde-donnees.py` surveille déjà `mcp__supabase__execute_sql`.

### 5.4 `.git/hooks/commit-msg` (local, commun à tous les worktrees, non publié)
```sh
#!/bin/sh
# Messages de commit au format de ROBOT.md §5 : type(portée): sujet
premiere=$(head -1 "$1")
echo "$premiere" | grep -qE '^(Merge |Revert )' && exit 0
echo "$premiere" | grep -qE '^(feat|fix|chore|refactor|data|ux|docs|test|ci|perf)(\([^)]+\))?!?: .+' && exit 0
echo "Message refusé : « $premiere »" >&2
echo "Format attendu : type(portée): sujet — feat fix chore refactor data ux docs test ci perf" >&2
exit 1
```
À vérifier avant de l'activer : les robots qui commitent depuis le Mac (atelier des stats, robots `robot-*`) écrivent bien `data(...)`. Ceux de GitHub Actions ne passent pas par ce hook.

### 5.5 ROBOT.md
```diff
-| Prod CRM | https://willmorel49-coder.github.io/jarvis-app/crm/ |
+| Prod CRM | https://crm-jarvis.vercel.app (adresse neutre, la seule à donner) — source : GitHub Pages |
@@ §4
-git add . && git commit -m "feat: ..." && git push
+# Depuis un worktree créé sur origin/main (jamais depuis ~/JARVIS/APP, branche périmée)
+git add <fichiers précis> && git commit -m "feat(portée): ..." && git pull --rebase origin main && git push origin HEAD:main
@@ §6
-| `.claude/skills/crm-structure.md` | Architecture app.js, pages, navigation, état global |
-| `.claude/skills/crm-supabase.md` | Schema SQL complet, RLS, Storage, Auth |
-| `.claude/skills/crm-offilog.md` | Pipeline Offilog × scrapers × matching EAN/nom |
-| `.claude/skills/crm-design.md` | Tokens CSS, composants, conventions UI |
+| `.claude/skills/jarvis-conventions/` | Conventions du dépôt |
+| `.claude/skills/fx-bank/` | Effets visuels vanilla stables sous Safari |
+| `~/.claude/skills/` | `donnees-protegees-jarvis`, `refresh-stats-commercial`, `pharma-metier`, `livraison-preuve` |
@@ §7
-5. Chaque modification fonctionnelle → `git push` immédiat sur `main`
+5. Chaque modification fonctionnelle : `node --test tests/*.test.mjs`, gardien-deploiement, puis push sur `main` depuis le worktree
@@ §8 (nouvelle ligne)
+| Agents et skills du même nom | Agent : la version du dépôt l'emporte sur `~/.claude/agents/`. Skill : l'inverse. Un agent ne vit qu'à UN endroit. |
```

### 5.6 `~/.claude/settings.json` : garder une seule déclaration de `garde-registre.py` sur 4

### 5.7 GitHub MCP en lecture seule (`~/.claude.json`, entrée `github`)
```diff
   "headers": {
-    "Authorization": "Bearer …"
+    "Authorization": "Bearer …",
+    "X-MCP-Readonly": "true"
   }
```
Doc GitHub ✅ : *« Enables only "read" tools. »* À ne faire que si aucune routine ne crée d'issue ou de PR par ce serveur (les pushes passent par `git`).

## 6. Vérifié / supposé

- ✅ Vérifié par commande : liste MCP, hooks, agents, comptes d'appels d'agents, statistiques de commits, handshakes (data.gouv.fr 200, Supabase 401, GitHub 401, Sentry 401, Firecrawl 200, Browserbase 200, Netlify 401), test du hook `node --check`.
- ✅ Vérifié par page officielle (03/11/2026) : priorité projet/utilisateur des agents et des skills, champ `if` des hooks, entrée PostToolUse, approbation `.mcp.json`, options Supabase et GitHub.
- ❓ Non vérifié : lieu de transit des données (UE ou hors UE) pour **tous** les serveurs ; dédoublonnage d'un hook répété dans un **même** fichier ; priorité entre une commande `/` de projet et une commande utilisateur du même nom ; l'accès de l'utilisateur Postgres en lecture seule de Supabase aux tables protégées par RLS ; la version de Python exigée par le SDK MCP ; le coût réel en jetons des descriptions d'agents (estimé, pas mesuré).

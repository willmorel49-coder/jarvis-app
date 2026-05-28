# Audit Parité UX/UI · Jarvis App

> Généré 28/05/2026 23:58:24

## Score santé : **54/100**

| Bot | Score | Findings |
|-----|------:|---------:|
| 🎨 Token Bot | 31/100 | 67 |
| 🌈 Palette Bot | 62/100 | 174 |
| ✒️ Typo Bot | 75/100 | 7 |
| 📐 Spacing Bot | 54/100 | 3 |
| 🧩 Component Bot | 13/100 | 7 |
| ♿ A11y Bot | 37/100 | 10 |
| 🧭 Nav Bot | 100/100 | 4 |
| 🔘 Radius Bot | 57/100 | 5 |

## Plan d'action priorisé

Trié par impact / effort (score décroissant).

### 1. Bootstrap a11y sur catalogue
*♿ A11y Bot · impact 3/3 · effort 2/3 · score 15.0*

Ajouter aria-label, role=dialog+aria-modal sur modales, .sr-only, focus visible. Score actuel 37/100.

### 2. Aligner les composants canoniques sur les 3 surfaces
*🧩 Component Bot · impact 3/3 · effort 3/3 · score 10.0*

Score 13/100. Définir une convention .card / .modal / .btn / .kpi / .badge / .pill réutilisée partout.

### 3. Extraire les couleurs partagées en tokens
*🌈 Palette Bot · impact 2/3 · effort 2/3 · score 10.0*

174 couleurs hardcodées détectées. Identifier celles utilisées ≥3 fois dans ≥2 surfaces et créer un token commun.

### 4. Renommer/préfixer --amber
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --amber a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 5. Renommer/préfixer --amber-bg
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --amber-bg a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 6. Renommer/préfixer --amber-g
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --amber-g a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 7. Renommer/préfixer --bg
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --bg a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 8. Renommer/préfixer --bg3
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --bg3 a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 9. Renommer/préfixer --bg4
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --bg4 a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 10. Renommer/préfixer --blue
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --blue a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 11. Renommer/préfixer --blue-bg
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --blue-bg a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 12. Renommer/préfixer --blue-g
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --blue-g a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 13. Renommer/préfixer --blue-glow
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --blue-glow a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 14. Renommer/préfixer --blue-l
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --blue-l a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

### 15. Renommer/préfixer --blue2
*🎨 Token Bot · impact 3/3 · effort 3/3 · score 10.0*

Le token --blue2 a des valeurs très différentes par surface. Si la collision est intentionnelle (brand par app), aucune action. Sinon, préfixer (ex: --opso-blue / --crm-blue).

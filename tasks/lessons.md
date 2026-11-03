# Lessons — Intégral Pharma CRM

> ⚠️ Fichier quasi figé depuis le 06/05/2026 : il ne contient PAS l'essentiel des leçons. Les vraies sources sont
> `ROBOT.md` §8 (pièges du dépôt), la mémoire Claude de Will, `~/.claude/JOURNAL.md` et les skills (`~/.claude/skills/`).

Format : `[date] | erreur observée | règle`

---

2026-05-06 | `float | None` type hint crash Python 3.9 | Jamais d'annotations union `X | Y` — utiliser `= None` sans annotation
2026-05-06 | Clé Supabase `sb_publishable_...` invalide → login bloqué | La clé anon Supabase est un JWT `eyJ...` long, jamais un `sb_publishable_`
2026-05-06 | Scraper Drakkars : `#container-item` semblait vide → produits dans `<a>` directs | Toujours tester le parsing HTML avec un extrait Bash avant de coder le scraper
2026-05-06 | Cap3000 : classe `.product-miniature` absente → 0 produits | Classe réelle : `li.ajax_block_product` + données complètes dans `<pre>` PHP caché
2026-05-06 | Apothical médicaments (0 match Offilog) — source médicaments ≠ parapharmacie | Ne pas intégrer une source avant de vérifier le overlap de catégories
2026-05-06 | Offilog Excel : `wb.active` retourne mauvaise feuille | Toujours cibler par nom : `wb['Croisement Complet']`
2026-11-03 | `.claude/agents/gardien-deploiement.md` du dépôt (10/07, sans contrôle opso/v2) masque celui de `~/.claude/agents/` (19/10) : pour un agent, la version du PROJET l'emporte | Un agent ne vit qu'à UN endroit ; pour une skill c'est l'inverse (la version utilisateur l'emporte) — voir tasks/ameliorations_2026-11.md

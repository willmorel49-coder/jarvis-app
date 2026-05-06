# Lessons — Intégral Pharma CRM

Format : `[date] | erreur observée | règle`

---

2026-05-06 | `float | None` type hint crash Python 3.9 | Jamais d'annotations union `X | Y` — utiliser `= None` sans annotation
2026-05-06 | Clé Supabase `sb_publishable_...` invalide → login bloqué | La clé anon Supabase est un JWT `eyJ...` long, jamais un `sb_publishable_`
2026-05-06 | Scraper Drakkars : `#container-item` semblait vide → produits dans `<a>` directs | Toujours tester le parsing HTML avec un extrait Bash avant de coder le scraper
2026-05-06 | Cap3000 : classe `.product-miniature` absente → 0 produits | Classe réelle : `li.ajax_block_product` + données complètes dans `<pre>` PHP caché
2026-05-06 | Apothical médicaments (0 match Offilog) — source médicaments ≠ parapharmacie | Ne pas intégrer une source avant de vérifier le overlap de catégories
2026-05-06 | Offilog Excel : `wb.active` retourne mauvaise feuille | Toujours cibler par nom : `wb['Croisement Complet']`

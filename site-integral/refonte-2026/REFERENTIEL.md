# Référentiel de vérité — maquettes site Intégral Pharma

> Source unique pour juger la cohérence des 10 maquettes. Établi le 31/07/2026 à partir des données réelles de Will (carte `map-component.html`, `index-final.html`, `ROBOT.md`).
> Les maquettes ont le DROIT d'être très différentes visuellement — c'est le but. Elles n'ont PAS le droit de raconter des choses différentes.

---

## 1. Identité — formulation exacte

✅ **« groupe de grossistes-répartiteurs français indépendant »**

- ⛔ INTERDIT : le mot **« groupement »** (dans le métier, un groupement = un groupe d'achat de pharmacies, c'est autre chose).
- 🟡 Toléré mais moins bon : « groupe de grossistes français indépendant » (il manque « répartiteurs »).

## 2. Conditions commerciales — règle du patron

⛔ **Aucune condition commerciale sur un support public.** Ni chiffrée, ni formulée.

Sont INTERDITS sur les maquettes : tout pourcentage, taux ou montant de remise ; les mots **« franco »**, **« engagement »** (au sens condition), **« remise »** ; et toute promesse de gain financier du type « plus de marge », « nette sur facture », « vous encaissez la marge ».

Le mot juste pour parler de marge en interne est **« abandon de marge »**, jamais « remise » — mais il n'a rien à faire sur un site public.

## 3. Le réseau — 9 implantations, noms et villes exacts

| # | Nom | Ville | Dép. | Statut |
|---|-----|-------|------|--------|
| 1 | Hyères Pharma | Hyères | 83 | **SIÈGE** |
| 2 | Ouest Pharma Services | St-Étienne-de-Montluc | 44 | site |
| 3 | Comptoir Pharmaceutique du Rhône | Saint-Maurice-l'Exil | 38 | site |
| 4 | Sud Ouest Pharma | Montayral | 47 | site |
| 5 | Pharm'Occitanie Services | Villeneuve-lès-Béziers | 34 | site |
| 6 | Sud Est Pharma | Le Cannet-des-Maures | 83 | site |
| 7 | Mistral Santé Pharma | Flassans-sur-Issole | 83 | site |
| 8 | Escale Pharma | Chilly-Mazarin | 91 | site |
| 9 | Pharmest | Metz | 57 | **PARTENAIRE** |

⚠️ **Point de vocabulaire non tranché** : 8 entités Intégral + 1 partenaire = 9 points. Dire **« neuf implantations »** est exact ; dire « neuf agences » est discutable. À harmoniser partout. Question ouverte pour Will.

## 4. Les 3 VALEURS — toujours les mêmes, dans cet ordre

**Confiance · Engagement · Respect**

⚠️ **Confirmé par Will le 31/07/2026.** Ce sont les VRAIES valeurs de la maison.
Les « quatre piliers » Transparence / Proximité / Liberté / 100 % français qui circulaient dans les maquettes récentes étaient une **invention d'agent**, pas une donnée de marque. Ne jamais les réintroduire.

**Leçon à retenir** : ne jamais traiter le contenu d'une maquette générée comme une source de vérité. La vérité vient de Will, des documents officiels, ou des maquettes qu'il a lui-même validées.

Textes validés :
- **Confiance** — La transparence d'abord. Une relation claire, tenue dans la durée, où la parole donnée vaut engagement.
- **Engagement** — Présents dans la durée, à vos côtés quand il le faut. Un partenaire ne disparaît pas après la vente.
- **Respect** — Du pharmacien comme du patient. On défend l'officine indépendante, parce qu'elle soigne un territoire.

## 5. Chiffres autorisés

- **14 000+ références** au catalogue
- **9 implantations**
- **100 % français**

Aucun autre chiffre ne doit apparaître sans source. Pas de « X clients », pas de « X ans », pas de taux de satisfaction inventé.

## 6. LE MÉTIER — hiérarchie à respecter absolument

⚠️ **Corrigé par Will le 01/08/2026.** Une erreur de hiérarchie avait déséquilibré les 9 maquettes.

**LE MÉTIER, c'est : grossiste-répartiteur national.** Approvisionner les officines françaises, tous les jours, depuis neuf implantations. Catalogue, disponibilité, préparation, livraison, service. **C'est 100 % du discours principal.**

**L'accompagnement de projets** (transfert d'officine · agrandissement · cession de parts · optimisation) est une **petite activité annexe**. On peut la mentionner en une ligne, jamais lui donner une section dédiée, jamais la mettre dans le menu principal, jamais lui consacrer plus de ~5 % de la page.

**Le test** : un pharmacien qui parcourt le site doit comprendre en dix secondes qu'Intégral **le livre**. S'il croit lire un cabinet de conseil en transmission d'officine, la page est ratée.

## 7. Coordonnées

**758 Chemin de la Source, 83400 Hyères** · **contact@integralpharma.fr** · © 2026 Intégral Pharma

⚠️ **Corrigé par Will le 01/08/2026** : le contact du site public est celui de **l'entreprise**, jamais celui d'une personne. Pascale Prieto (direction commerciale France) est le contact des **invitations groupement** — elle n'a rien à faire sur la vitrine. Aucun numéro de téléphone public n'est validé à ce jour : ne pas en inventer, s'en tenir à l'adresse mail.

## 8. Marque — valeurs de référence

| Élément | Valeur |
|---------|--------|
| Bleu | `#0050E6` (⚠️ `#0057FF` est le bleu du CRM, pas celui du site) |
| Orange | `#F39A1B` |
| Encre | `#0A0E1A` |
| Clair | `#F8FAFC` |
| Titres | Fraunces (italique pour les accents) |
| Texte | DM Sans |
| Surtitres | DM Mono |
| Logo | `assets/logo-web.png` (18 Ko) — ⛔ PAS `logo.png` (108 Ko) |
| Photo siège | `assets/siege-web.jpg` (435 Ko) — ⛔ PAS `siege.jpg` (1 394 Ko) |

## 9. Règles techniques non négociables

- ⛔ JAMAIS `background-clip:text`, `backdrop-filter`, `filter:blur` sur grande surface (le Mac de Will plante)
- Maximum **1** `<video autoplay>` par page
- Toujours un repli `@media (prefers-reduced-motion: reduce)`
- Une révélation au scroll doit être masquée par une classe posée **en JS**, jamais en CSS seul (sinon page blanche si le script casse)
- Aucun CDN : toutes les librairies sont dans `vendor/` en local
- ⚠️ Fichiers vendor morts, ne pas les charger : `ogl.umd.js.CASSE-*` et `cobe.js.CASSE-*`. Utiliser `ogl.mjs` et `cobe.mjs`.

## 10. Ton

Professionnel, jamais familier, jamais auto-promo agressive. On soutient les pharmaciens **et** les patients. Haut de gamme et sérieux — pas playful, pas néon, pas gadget (directions déjà rejetées par Will : acide-playful, nuit-neon).

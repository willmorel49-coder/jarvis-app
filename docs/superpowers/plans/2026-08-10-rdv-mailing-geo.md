# Prise de RDV par mailing calée sur la géographie — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skill projet obligatoire :** lire `jarvis-conventions` avant de toucher un fichier de `crm/v2/`.
> **Cahier des charges :** `docs/superpowers/specs/2026-08-10-rdv-mailing-geo-design.md`

**Goal:** Un pharmacien client reçoit un mail de son commercial, clique, choisit lui-même un créneau parmi des jours filtrés par proximité avec les rendez-vous déjà posés, et repart avec son invitation agenda.

**Architecture:** Le moteur de créneaux est un fichier JavaScript pur (`v2-rdv-creneaux.js`), sans DOM et sans `V2`, testé en ligne de commande par `node --test` et chargé tel quel par le navigateur. La page du pharmacien (`rdv.html`) est autonome : elle ne charge pas le bundle CRM et ne contient aucune donnée client. Elle appelle trois fonctions Postgres `SECURITY DEFINER` sur le Supabase existant ; aucune table n'est lisible par `anon`. Le mail part de la boîte du commercial via `mailto:`.

**Tech Stack:** Vanilla JS (ES5, pas de build), Supabase JS 2 par CDN, Postgres/PL-pgSQL, GitHub Pages, `node --test` pour les tests unitaires.

## Global Constraints

Ces contraintes s'appliquent à **toutes** les tâches, sans rappel.

- **Zéro dépendance, zéro npm, zéro build, zéro service payant, zéro clé API.** Ne rien ajouter à `vendor/`.
- **ES5 uniquement** dans `crm/v2/*.js` : `var`, `function`, pas de fléchées, pas de `const`/`let`, pas de template literals, pas d'`async/await`. Les fichiers de tests (`tests/*.mjs`) peuvent être modernes.
- **`V2.esc(s)` sur tout texte injecté dans du HTML.** Sans exception : un nom de pharmacie avec une apostrophe casse la page.
- **`V2.toast(msg)` pour tout retour utilisateur.** Jamais `alert()`.
- **`V2.fmtEur(n)` / `V2.fmtNum(n)`** pour tout montant ou nombre affiché dans le CRM.
- **Token de cache** : format `?v=AAAAMMJJ<lettre>`. Une seule valeur dans tout `index.html`, **identique** à `var VER` de `sw.js`. Valeur actuelle : `20260806d`. Nouvelle valeur pour ce chantier : `20260810a` (incrémenter la lettre si plusieurs déploiements le même jour).
- **Safari, Mac de Will** : interdits absolus — `backdrop-filter`, `filter: blur` sur grande surface, `background-clip: text` sur du grand texte, plus d'une `<video autoplay>`. Repli `@media (prefers-reduced-motion: reduce)` obligatoire dès qu'il y a une animation.
- **Mobile** : cibles tactiles ≥ 44 px, champs de saisie ≥ 16 px (sinon iOS zoome), aucun débordement horizontal à 390 px.
- **Vocabulaire pharma** : dire « abandon de marge », jamais le mot commercial habituel. **Aucune condition commerciale chiffrée** dans un mail ou sur la page publique.
- **Git** : ajouter les fichiers **un par un**. `git add -A`, `git add .` et `git add --all` sont interdits et bloqués par un hook.
- **Branche de travail** : `feature/rdv-mailing`.
- **Supabase** : projet `iyvavhnlhxksokkerkos`. Les migrations passent par l'outil MCP `mcp__supabase__apply_migration`. La clé anon est au format JWT `eyJ...`.

## Carte des fichiers

| Fichier | Responsabilité unique |
|---|---|
| `docs/supabase/rdv.sql` | Tables, RLS, fonctions publiques. Source de vérité du schéma, rejouable. |
| `crm/v2/v2-rdv-creneaux.js` | **Le moteur.** Règle géographique + grille horaire. Pur : entrées → sorties, aucun DOM, aucun réseau, aucun `V2`. |
| `crm/v2/v2-rdv-ics.js` | Fabrication du fichier `.ics`. Pur, même contrat. |
| `crm/v2/rdv.html` + `crm/v2/rdv-public.js` | La page du pharmacien. Autonome, aucune donnée client embarquée. |
| `crm/v2/v2-rdv-dispo.js` | Écran « Mes disponibilités » du commercial. |
| `crm/v2/v2-rdv.js` | Écran « Rendez-vous » + création d'un lien + ouverture du mail. |
| `crm/v2/v2-rdv-modeles.js` | Les trois modèles de mail et leur remplissage. Pur. |
| `crm/v2/v2-campagne.js` | Écran Campagne : filtres, aperçu, file d'attente d'envoi. |
| `tests/rdv-creneaux.test.mjs` | Tests du moteur. |
| `tests/rdv-ics.test.mjs` | Tests du `.ics`. |
| `tests/rdv-modeles.test.mjs` | Tests des modèles de mail. |

Modifiés : `crm/v2/index.html`, `crm/v2/sw.js`, `crm/v2/v2-app.js`, `crm/v2/v2-pharma.js`, `.github/workflows/ci.yml`.

## Découpage en deux lots

**Lot 1 — le socle (tâches 1 à 7).** À la fin, le circuit est complet et utilisable : depuis une fiche officine, le commercial ouvre un mail pré-rempli, le pharmacien réserve, le rendez-vous apparaît dans JARVIS avec son invitation agenda. Un seul modèle de mail, un envoi à la fois.

**Lot 2 — la campagne (tâches 8 à 11).** Les trois modèles, l'envoi par liste avec file d'attente, les relances, le « ne plus solliciter », et le branchement sur la tournée existante.

---

# LOT 1 — LE SOCLE

---

### Task 1: Schéma de base et verrous d'accès

**Files:**
- Create: `docs/supabase/rdv.sql`

**Interfaces:**
- Consumes: rien.
- Produces: les tables `rdv_dispo`, `rdv_blocage`, `rdv`, `rdv_lien`, `rdv_opposition` sur le projet `iyvavhnlhxksokkerkos`. Contrainte `rdv_creneau_unique` sur `(user_id, date, heure)` où `statut = 'confirme'`. Aucune fonction publique encore.

- [ ] **Step 1: Écrire le fichier de schéma**

Créer `docs/supabase/rdv.sql` :

```sql
-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Prise de RDV par mailing
-- Rejouable : tout est en "if not exists" / "create or replace".
-- ═══════════════════════════════════════════════════════════════

-- Disponibilités : une ligne par commercial
create table if not exists public.rdv_dispo (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  jours             jsonb not null default
                      '{"1":[["09:00","12:30"],["14:00","18:00"]],
                        "2":[["09:00","12:30"],["14:00","18:00"]],
                        "3":[["09:00","12:30"],["14:00","18:00"]],
                        "4":[["09:00","12:30"],["14:00","18:00"]],
                        "5":[["09:00","12:30"],["14:00","18:00"]]}'::jsonb,
  duree_min         int  not null default 45,
  marge_route_min   int  not null default 15,
  horizon_jours     int  not null default 21,
  delai_min_jours   int  not null default 3,
  rayon_chaud_km    int  not null default 25,
  rayon_max_km      int  not null default 60,
  vitesse_kmh       int  not null default 50,
  maj_le            timestamptz not null default now()
);

-- Demi-journées bloquées (réunion, congés)
create table if not exists public.rdv_blocage (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  date     date not null,
  moment   text not null default 'journee'
             check (moment in ('matin','apres_midi','journee')),
  motif    text,
  cree_le  timestamptz not null default now()
);
create index if not exists rdv_blocage_user_date on public.rdv_blocage (user_id, date);

-- Les rendez-vous
create table if not exists public.rdv (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  cip          text,
  nom          text not null,
  adresse      text,
  cp           text,
  ville        text,
  lat          double precision,
  lon          double precision,
  date         date not null,
  heure        time not null,
  duree_min    int  not null default 45,
  statut       text not null default 'confirme'
                 check (statut in ('confirme','annule','a_rappeler')),
  origine      text not null default 'mailing'
                 check (origine in ('mailing','manuel')),
  contact_nom  text,
  contact_tel  text,
  message      text,
  cree_le      timestamptz not null default now()
);
-- Un créneau ne part qu'une fois : c'est ce verrou qui gère deux clics simultanés.
create unique index if not exists rdv_creneau_unique
  on public.rdv (user_id, date, heure) where statut = 'confirme';
create index if not exists rdv_user_date on public.rdv (user_id, date);

-- Les jetons envoyés par mail
create table if not exists public.rdv_lien (
  token        uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  cip          text,
  nom          text not null,
  adresse      text,
  cp           text,
  ville        text,
  lat          double precision,
  lon          double precision,
  contact_nom  text,
  modele       text not null default 'routine'
                 check (modele in ('bilan','offre','routine')),
  cree_le      timestamptz not null default now(),
  expire_le    timestamptz not null default (now() + interval '21 days'),
  envoye_le    timestamptz,
  consomme_le  timestamptz
);
create index if not exists rdv_lien_user on public.rdv_lien (user_id, cree_le desc);

-- Officines à ne plus solliciter
create table if not exists public.rdv_opposition (
  user_id  uuid not null references auth.users(id) on delete cascade,
  cip      text not null,
  motif    text,
  date     timestamptz not null default now(),
  primary key (user_id, cip)
);

-- ── Verrous ────────────────────────────────────────────────────
-- anon n'a AUCUN accès direct : pas de policy pour lui, nulle part.
alter table public.rdv_dispo      enable row level security;
alter table public.rdv_blocage    enable row level security;
alter table public.rdv            enable row level security;
alter table public.rdv_lien       enable row level security;
alter table public.rdv_opposition enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rdv_dispo','rdv_blocage','rdv','rdv_lien','rdv_opposition'] loop
    execute format('drop policy if exists %I on public.%I', t || '_mine', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_mine', t);
  end loop;
end $$;
```

- [ ] **Step 2: Appliquer la migration**

Utiliser l'outil MCP `mcp__supabase__apply_migration` sur le projet `iyvavhnlhxksokkerkos`, nom de migration `rdv_socle`, avec le contenu du fichier ci-dessus.

- [ ] **Step 3: Vérifier que les tables existent et que `anon` est bien enfermé**

Via `mcp__supabase__execute_sql` :

```sql
select tablename,
       (select count(*) from pg_policies p
         where p.schemaname='public' and p.tablename=t.tablename) as policies
from pg_tables t
where schemaname='public' and tablename like 'rdv%'
order by tablename;
```

Attendu : 5 lignes (`rdv`, `rdv_blocage`, `rdv_dispo`, `rdv_lien`, `rdv_opposition`), **1 policy chacune**.

Puis :

```sql
select has_table_privilege('anon','public.rdv','select') as anon_peut_lire;
```

Attendu : `false`. Si `true`, exécuter `revoke all on public.rdv from anon;` (idem pour les quatre autres tables) et refaire le contrôle.

- [ ] **Step 4: Vérifier qu'il ne reste pas d'avertissement de sécurité**

Utiliser `mcp__supabase__get_advisors` avec `type: "security"`. Aucun avertissement nouveau ne doit concerner une table `rdv*`. Corriger si c'est le cas.

- [ ] **Step 5: Commit**

```bash
git add docs/supabase/rdv.sql
git commit -m "RDV : schema de base, RLS, verrou anti-double-reservation"
```

---

### Task 2: Le moteur de créneaux (règle géographique)

C'est le cœur du chantier. Fichier pur, testé en ligne de commande avant d'exister dans le navigateur.

**Files:**
- Create: `crm/v2/v2-rdv-creneaux.js`
- Test: `tests/rdv-creneaux.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces: l'objet `V2RDV` (navigateur) / `module.exports` (Node) avec :
  - `V2RDV.DEFAUT_DISPO` → objet de réglages par défaut
  - `V2RDV.distanceKm(a, b, coef)` → `number | null` — `a` et `b` sont `{lat, lon}`
  - `V2RDV.trajetMin(km, dispo)` → `number` (minutes)
  - `V2RDV.grille(plages, dureeMin)` → `number[]` (minutes depuis minuit)
  - `V2RDV.libres(occupesDuJour, officine, dispo, plages)` → `number[]`
  - `V2RDV.jour(dateISO, occupesDuJour, officine, dispo, plages)` → `{date, score, creneaux} | null`
  - `V2RDV.proposer(p)` → `[{date, score, creneaux: ['09:00', …]}]`, 3 jours max, 3 créneaux max par jour, créneaux triés croissants.
    `p` = `{officine:{lat, lon}, dispo, blocages:[{date, moment}], occupes:[{date, heure, duree_min, lat, lon}], aujourdhui:'AAAA-MM-JJ'}`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/rdv-creneaux.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../crm/v2/v2-rdv-creneaux.js');

const D = M.DEFAUT_DISPO;
const PLAGES = [['09:00', '12:30'], ['14:00', '18:00']];
const NANTES = { lat: 47.2184, lon: -1.5536 };
const NANTES_10KM = { lat: 47.3084, lon: -1.5536 };   // ~10 km au nord
const ANGERS = { lat: 47.4784, lon: -0.5632 };        // ~78 km à vol d'oiseau

test('distance : Nantes → Angers, majoree du coefficient route', () => {
  const km = M.distanceKm(NANTES, ANGERS, 1.3);
  assert.ok(km > 95 && km < 106, `attendu ~101 km, obtenu ${km}`);
});

test('distance : coordonnees manquantes → null', () => {
  assert.equal(M.distanceKm(NANTES, { lat: null, lon: null }, 1.3), null);
  assert.equal(M.distanceKm(null, ANGERS, 1.3), null);
});

test('grille : 45 min par pas de 15, sans deborder la plage', () => {
  const g = M.grille([['09:00', '10:30']], 45);
  assert.deepEqual(g, [540, 555, 570, 585, 600, 615]);   // 09:00 → 10:15
});

test('journee vide : score 2, toute la grille est libre', () => {
  const j = M.jour('2026-08-18', [], NANTES, D, PLAGES);
  assert.equal(j.score, 2);
  assert.equal(j.creneaux.length, M.grille(PLAGES, D.duree_min).length);
});

test('officine a 10 km d un RDV pose : jour prioritaire, score 0', () => {
  const occ = [{ heure: '10:00', duree_min: 45, ...NANTES_10KM }];
  const j = M.jour('2026-08-18', occ, NANTES, D, PLAGES);
  assert.equal(j.score, 0);
  assert.equal(j.creneaux.length > 0, true);
});

test('officine a 10 km : le premier creneau propose est colle au voisin', () => {
  const occ = [{ heure: '10:00', duree_min: 45, ...NANTES_10KM }];
  const j = M.jour('2026-08-18', occ, NANTES, D, PLAGES);
  // voisin 10:00-10:45, trajet ~13+15=28 min → au plus pres : 11:15 ou 09:00
  const premier = j.creneaux[0];
  assert.ok(Math.abs(premier - 600) <= 90, `attendu proche de 10:00, obtenu ${premier}`);
});

test('officine a 100 km d un RDV pose : jour ecarte', () => {
  const loin = { lat: 48.1113, lon: -1.6800 };          // Rennes, ~100 km
  const occ = [{ heure: '10:00', duree_min: 45, ...loin }];
  assert.equal(M.jour('2026-08-18', occ, NANTES, D, PLAGES), null);
});

test('creneau qui chevauche un RDV pose, trajet compris, est retire', () => {
  const occ = [{ heure: '10:00', duree_min: 45, ...NANTES_10KM }];
  const libres = M.libres(occ, NANTES, D, PLAGES);
  assert.equal(libres.includes(600), false, '10:00 doit etre pris');
  assert.equal(libres.includes(585), false, '09:45 empiete sur le trajet');
});

test('officine sans coordonnees : jamais ecartee', () => {
  const loin = { lat: 48.1113, lon: -1.6800 };
  const occ = [{ heure: '10:00', duree_min: 45, ...loin }];
  const j = M.jour('2026-08-18', occ, { lat: null, lon: null }, D, PLAGES);
  assert.notEqual(j, null);
  assert.equal(j.score, 2);
});

test('proposer : respecte le delai de 3 jours et l horizon de 21 jours', () => {
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: [], occupes: [], aujourdhui: '2026-08-10' });
  assert.ok(r.length > 0);
  r.forEach(j => {
    assert.ok(j.date >= '2026-08-13', `${j.date} est trop tot`);
    assert.ok(j.date <= '2026-08-31', `${j.date} depasse l horizon`);
  });
});

test('proposer : 3 jours max, 3 creneaux max, tries croissants', () => {
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: [], occupes: [], aujourdhui: '2026-08-10' });
  assert.ok(r.length <= 3);
  r.forEach(j => {
    assert.ok(j.creneaux.length <= 3);
    const copie = j.creneaux.slice().sort();
    assert.deepEqual(j.creneaux, copie);
  });
});

test('proposer : le jour ou un voisin est deja pose est retenu', () => {
  const occ = [{ date: '2026-08-25', heure: '10:00', duree_min: 45, ...NANTES_10KM }];
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: [], occupes: occ, aujourdhui: '2026-08-10' });
  assert.equal(r.some(j => j.date === '2026-08-25'), true,
    'le jour ou un voisin est deja pose doit faire partie des trois retenus');
});

test('proposer : un jour bloque toute la journee disparait', () => {
  const bl = [{ date: '2026-08-13', moment: 'journee' }];
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: bl, occupes: [], aujourdhui: '2026-08-10' });
  assert.equal(r.some(j => j.date === '2026-08-13'), false);
});

test('proposer : un blocage du matin ne laisse que l apres-midi', () => {
  const bl = [{ date: '2026-08-13', moment: 'matin' }];
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: bl, occupes: [], aujourdhui: '2026-08-10' });
  const jour = r.find(j => j.date === '2026-08-13');
  assert.notEqual(jour, undefined);
  jour.creneaux.forEach(h => assert.ok(h >= '14:00', `${h} devrait etre l apres-midi`));
});

test('proposer : samedi et dimanche ne sont jamais proposes', () => {
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: [], occupes: [], aujourdhui: '2026-08-10' });
  r.forEach(j => {
    const d = new Date(j.date + 'T00:00:00Z').getUTCDay();
    assert.ok(d >= 1 && d <= 5, `${j.date} tombe un week-end`);
  });
});

test('proposer : agenda entierement bloque → tableau vide, pas une erreur', () => {
  const bl = [];
  for (let i = 0; i <= 25; i++) {
    const d = new Date(Date.UTC(2026, 7, 10));
    d.setUTCDate(d.getUTCDate() + i);
    bl.push({ date: d.toISOString().slice(0, 10), moment: 'journee' });
  }
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: bl, occupes: [], aujourdhui: '2026-08-10' });
  assert.deepEqual(r, []);
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd /Users/williammorel/JARVIS/APP && node --test tests/rdv-creneaux.test.mjs`
Expected: échec — `Cannot find module '../crm/v2/v2-rdv-creneaux.js'`.

- [ ] **Step 3: Écrire le moteur**

Créer `crm/v2/v2-rdv-creneaux.js` :

```js
/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Moteur de créneaux de rendez-vous (V2RDV)
   Règle « aimant » : le premier RDV posé fixe la zone du jour, les
   officines voisines viennent s'y greffer, les lointaines sont écartées.
   Fichier PUR : aucun DOM, aucun réseau, aucun V2.*. Il tourne aussi
   bien dans le navigateur que sous `node --test`.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  M.DEFAUT_DISPO = {
    jours: {
      '1': [['09:00', '12:30'], ['14:00', '18:00']],
      '2': [['09:00', '12:30'], ['14:00', '18:00']],
      '3': [['09:00', '12:30'], ['14:00', '18:00']],
      '4': [['09:00', '12:30'], ['14:00', '18:00']],
      '5': [['09:00', '12:30'], ['14:00', '18:00']]
    },
    duree_min: 45, marge_route_min: 15, horizon_jours: 21, delai_min_jours: 3,
    rayon_chaud_km: 25, rayon_max_km: 60, vitesse_kmh: 50, coef_route: 1.3
  };

  var PAS = 15;          // granularité des créneaux, en minutes
  var ECART_MIN = 60;    // écart souhaité entre deux créneaux proposés le même jour
  var MIDI = 12 * 60;

  function hm2min(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function min2hm(m) {
    var h = Math.floor(m / 60), x = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (x < 10 ? '0' : '') + x;
  }
  function isoPlus(iso, n) {
    var p = String(iso).split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function jourSemaine(iso) {
    var p = String(iso).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();   // 0 = dimanche
  }
  function fusionner(dispo) {
    var out = {}, k;
    for (k in M.DEFAUT_DISPO) if (M.DEFAUT_DISPO.hasOwnProperty(k)) out[k] = M.DEFAUT_DISPO[k];
    if (dispo) for (k in dispo) if (dispo.hasOwnProperty(k) && dispo[k] != null) out[k] = dispo[k];
    return out;
  }

  // Distance à vol d'oiseau (haversine) majorée du coefficient route. null si une
  // coordonnée manque — l'appelant doit traiter ce cas, jamais le confondre avec 0.
  M.distanceKm = function (a, b, coef) {
    if (!a || !b || a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s))) * (coef == null ? 1.3 : coef);
  };

  M.trajetMin = function (km, dispo) {
    var d = fusionner(dispo);
    return Math.round(km / d.vitesse_kmh * 60) + d.marge_route_min;
  };

  // Toutes les heures de début possibles d'une journée, en minutes depuis minuit.
  M.grille = function (plages, dureeMin) {
    var out = [];
    (plages || []).forEach(function (p) {
      var deb = hm2min(p[0]), fin = hm2min(p[1]);
      for (var t = deb; t + dureeMin <= fin; t += PAS) out.push(t);
    });
    return out;
  };

  // Un créneau est libre s'il ne chevauche aucun RDV du jour, temps de route compris.
  M.libres = function (occupesDuJour, officine, dispo, plages) {
    var d = fusionner(dispo), duree = d.duree_min;
    var occ = occupesDuJour || [];
    return M.grille(plages, duree).filter(function (t) {
      for (var i = 0; i < occ.length; i++) {
        var o = occ[i], ot = hm2min(o.heure), od = o.duree_min || duree;
        var km = M.distanceKm(officine, o, d.coef_route);
        var tr = km == null ? d.marge_route_min : M.trajetMin(km, d);
        if (!(t + duree + tr <= ot || ot + od + tr <= t)) return false;
      }
      return true;
    });
  };

  // Note une journée : 0 = prioritaire (voisin proche), 1 = possible, 2 = journée
  // encore vide. null = jour écarté (trop loin, ou plus aucun créneau libre).
  M.jour = function (dateISO, occupesDuJour, officine, dispo, plages) {
    var d = fusionner(dispo);
    var libres = M.libres(occupesDuJour, officine, d, plages);
    if (!libres.length) return null;
    var occ = occupesDuJour || [];
    if (!occ.length) return { date: dateISO, score: 2, creneaux: libres };

    var dmin = null, proche = null;
    occ.forEach(function (o) {
      var km = M.distanceKm(officine, o, d.coef_route);
      if (km == null) return;
      if (dmin == null || km < dmin) { dmin = km; proche = o; }
    });
    // Officine sans coordonnées, ou RDV du jour sans coordonnées : pas d'aimant,
    // mais surtout pas d'exclusion.
    if (dmin == null) return { date: dateISO, score: 2, creneaux: libres };
    if (dmin > d.rayon_max_km) return null;

    if (dmin <= d.rayon_chaud_km) {
      var ot = hm2min(proche.heure);
      libres.sort(function (a, b) { return Math.abs(a - ot) - Math.abs(b - ot); });
      return { date: dateISO, score: 0, creneaux: libres };
    }
    var matin = hm2min(proche.heure) < MIDI;
    var meme = libres.filter(function (t) { return (t < MIDI) === matin; });
    if (!meme.length) return null;
    return { date: dateISO, score: 1, creneaux: meme };
  };

  // Retire les plages couvertes par un blocage de demi-journée.
  function plagesDuJour(dateISO, dispo, blocages) {
    var d = fusionner(dispo);
    var plages = d.jours[String(jourSemaine(dateISO))];
    if (!plages || !plages.length) return null;
    var bl = (blocages || []).filter(function (b) { return b.date === dateISO; });
    for (var i = 0; i < bl.length; i++) {
      if (bl[i].moment === 'journee') return null;
      if (bl[i].moment === 'matin') plages = plages.filter(function (p) { return hm2min(p[0]) >= MIDI; });
      if (bl[i].moment === 'apres_midi') plages = plages.filter(function (p) { return hm2min(p[0]) < MIDI; });
    }
    return plages.length ? plages : null;
  }

  // Garde au plus `max` créneaux, en préférant les espacer d'au moins une heure.
  function espacer(creneaux, max) {
    var gardes = [];
    creneaux.forEach(function (t) {
      if (gardes.length >= max) return;
      var ok = gardes.every(function (g) { return Math.abs(g - t) >= ECART_MIN; });
      if (ok) gardes.push(t);
    });
    creneaux.forEach(function (t) {                     // complète si l'écart était trop exigeant
      if (gardes.length >= max) return;
      if (gardes.indexOf(t) === -1) gardes.push(t);
    });
    return gardes.sort(function (a, b) { return a - b; });
  }

  M.proposer = function (p) {
    var d = fusionner(p && p.dispo);
    var officine = (p && p.officine) || {};
    var occupes = (p && p.occupes) || [];
    var blocages = (p && p.blocages) || [];
    var aujourdhui = (p && p.aujourdhui) || new Date().toISOString().slice(0, 10);

    var parDate = {};
    occupes.forEach(function (o) {
      if (!o || !o.date) return;
      (parDate[o.date] = parDate[o.date] || []).push(o);
    });

    var jours = [];
    for (var i = d.delai_min_jours; i <= d.horizon_jours; i++) {
      var iso = isoPlus(aujourdhui, i);
      var plages = plagesDuJour(iso, d, blocages);
      if (!plages) continue;
      var j = M.jour(iso, parDate[iso] || [], officine, d, plages);
      if (j) jours.push(j);
    }

    jours.sort(function (a, b) { return a.score - b.score || (a.date < b.date ? -1 : 1); });

    return jours.slice(0, 3).map(function (j) {
      return {
        date: j.date,
        score: j.score,
        creneaux: espacer(j.creneaux, 3).map(min2hm)
      };
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };

  M._min2hm = min2hm;
  M._hm2min = hm2min;

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2RDV = M;
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent tous**

Run: `cd /Users/williammorel/JARVIS/APP && node --test tests/rdv-creneaux.test.mjs`
Expected: `# pass 16`, `# fail 0`.

- [ ] **Step 5: Vérifier la syntaxe comme le fait la CI**

Run: `node --check crm/v2/v2-rdv-creneaux.js`
Expected: aucune sortie.

- [ ] **Step 6: Commit**

```bash
git add crm/v2/v2-rdv-creneaux.js
git add tests/rdv-creneaux.test.mjs
git commit -m "RDV : moteur de creneaux (regle geographique) + 16 tests"
```

---

### Task 3: Le fichier d'invitation agenda (.ics)

**Files:**
- Create: `crm/v2/v2-rdv-ics.js`
- Test: `tests/rdv-ics.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces: `V2ICS.build(rdv)` → `string`, où `rdv` = `{uid, date:'AAAA-MM-JJ', heure:'HH:MM', duree_min, titre, lieu, description, organisateur:'Prénom Nom'}`. Et `V2ICS.dataUrl(texte)` → `string` (URL `data:` prête pour un lien de téléchargement).

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/rdv-ics.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ICS = require('../crm/v2/v2-rdv-ics.js');

const BASE = {
  uid: 'abc-123',
  date: '2026-08-18',
  heure: '10:30',
  duree_min: 45,
  titre: 'Rendez-vous Integral Pharma',
  lieu: '64 rue de la Rabaterie, 37700 ST PIERRE DES CORPS',
  description: 'Visite commerciale',
  organisateur: 'William Morel'
};

test('structure minimale d un .ics', () => {
  const s = ICS.build(BASE);
  assert.ok(s.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(s.trimEnd().endsWith('END:VCALENDAR'));
  assert.ok(s.includes('BEGIN:VEVENT'));
  assert.ok(s.includes('UID:abc-123'));
});

test('debut et fin calcules a partir de la duree', () => {
  const s = ICS.build(BASE);
  assert.ok(s.includes('DTSTART:20260818T103000'), 'debut attendu 10:30');
  assert.ok(s.includes('DTEND:20260818T111500'), 'fin attendue 11:15');
});

test('passage a l heure suivante gere', () => {
  const s = ICS.build({ ...BASE, heure: '11:45', duree_min: 45 });
  assert.ok(s.includes('DTEND:20260818T123000'));
});

test('les virgules et points-virgules sont echappes', () => {
  const s = ICS.build({ ...BASE, lieu: '64 rue A, 37700 TOURS; bat B' });
  assert.ok(s.includes('LOCATION:64 rue A\\, 37700 TOURS\\; bat B'));
});

test('les retours a la ligne de la description sont echappes', () => {
  const s = ICS.build({ ...BASE, description: 'ligne 1\nligne 2' });
  assert.ok(s.includes('ligne 1\\nligne 2'));
});

test('aucune ligne ne depasse 75 octets', () => {
  const s = ICS.build({ ...BASE, description: 'x'.repeat(400) });
  s.split('\r\n').forEach(l => {
    assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `ligne trop longue : ${l.length}`);
  });
});

test('les lignes repliees commencent par une espace', () => {
  const s = ICS.build({ ...BASE, description: 'y'.repeat(400) });
  const lignes = s.split('\r\n');
  const suite = lignes.find(l => l.startsWith(' '));
  assert.notEqual(suite, undefined, 'aucune ligne de continuation trouvee');
});

test('dataUrl produit un lien telechargeable', () => {
  const u = ICS.dataUrl(ICS.build(BASE));
  assert.ok(u.startsWith('data:text/calendar;charset=utf-8,'));
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd /Users/williammorel/JARVIS/APP && node --test tests/rdv-ics.test.mjs`
Expected: échec — module introuvable.

- [ ] **Step 3: Écrire le générateur**

Créer `crm/v2/v2-rdv-ics.js` :

```js
/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Invitation agenda (V2ICS)
   Produit un .ics standard, lisible par Outlook, Gmail et Apple Calendrier.
   Heure « flottante » (sans fuseau) : les deux parties sont en France, et
   ça évite d'embarquer un bloc VTIMEZONE pour rien.
   Fichier PUR : aucun DOM, aucun réseau.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  function ech(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  // RFC 5545 : 75 octets par ligne, les suivantes commencent par une espace.
  function plier(ligne) {
    var out = [], cur = '', n = 0;
    for (var i = 0; i < ligne.length; i++) {
      var c = ligne.charAt(i);
      var taille = encodeURIComponent(c).replace(/%[0-9A-F]{2}/g, 'x').length;
      if (n + taille > 75) { out.push(cur); cur = ' '; n = 1; }
      cur += c; n += taille;
    }
    out.push(cur);
    return out;
  }

  function stamp(date, heure) {
    return String(date).replace(/-/g, '') + 'T' + String(heure).replace(':', '') + '00';
  }
  function plusMinutes(heure, minutes) {
    var p = String(heure).split(':');
    var t = (+p[0]) * 60 + (+p[1]) + (+minutes || 0);
    var h = Math.floor(t / 60) % 24, m = t % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  M.build = function (rdv) {
    var r = rdv || {};
    var fin = plusMinutes(r.heure, r.duree_min || 45);
    var lignes = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//JARVIS//RDV//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + ech(r.uid),
      'DTSTAMP:' + stamp(r.date, r.heure),
      'DTSTART:' + stamp(r.date, r.heure),
      'DTEND:' + stamp(r.date, fin),
      'SUMMARY:' + ech(r.titre),
      'LOCATION:' + ech(r.lieu),
      'DESCRIPTION:' + ech(r.description),
      'ORGANIZER;CN=' + ech(r.organisateur) + ':MAILTO:noreply@integralpharma.fr',
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    var out = [];
    lignes.forEach(function (l) { out = out.concat(plier(l)); });
    return out.join('\r\n') + '\r\n';
  };

  M.dataUrl = function (texte) {
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(texte);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2ICS = M;
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent**

Run: `cd /Users/williammorel/JARVIS/APP && node --test tests/rdv-ics.test.mjs`
Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 5: Brancher les tests sur la CI**

Modifier `.github/workflows/ci.yml` : insérer cette étape **juste après** l'étape « Contrôle syntaxe » et **avant** l'installation de Playwright.

```yaml
      - name: Tests unitaires (moteur de créneaux, .ics, modèles de mail)
        run: node --test tests/
```

Puis ajouter `tests/**` à la liste `paths` des deux déclencheurs `push` et `pull_request` du fichier, pour que la CI se déclenche aussi quand seuls les tests changent.

- [ ] **Step 6: Vérifier que la commande de la CI passe en local**

Run: `cd /Users/williammorel/JARVIS/APP && node --test tests/`
Expected: `# pass 24`, `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add crm/v2/v2-rdv-ics.js
git add tests/rdv-ics.test.mjs
git add .github/workflows/ci.yml
git commit -m "RDV : generation .ics + tests + etape node --test dans la CI"
```

---

### Task 4: Les trois portes ouvertes au public (fonctions SQL)

**Files:**
- Modify: `docs/supabase/rdv.sql` (ajout en fin de fichier)

**Interfaces:**
- Consumes: les tables de la tâche 1.
- Produces: trois fonctions appelables par `anon` :
  - `rdv_fenetre(p_token uuid)` → `jsonb` : `{ok, officine:{nom, lat, lon}, commercial:{prenom, tel}, dispo:{…}, blocages:[…], occupes:[{date, heure, duree_min, lat, lon}]}` ou `{ok:false, raison:'inconnu'|'expire'|'consomme'}`
  - `rdv_poser(p_token uuid, p_date date, p_heure time, p_nom text, p_tel text)` → `jsonb` : `{ok:true, rdv:{…}, commercial:{prenom, tel}}` ou `{ok:false, raison:'pris'|'hors_grille'|'expire'|'consomme'|'inconnu'}`
  - `rdv_preference(p_token uuid, p_texte text, p_nom text, p_tel text)` → `jsonb` : `{ok:true}` ou `{ok:false, raison:…}`

- [ ] **Step 1: Écrire les fonctions**

Ajouter à la fin de `docs/supabase/rdv.sql` :

```sql
-- ═══════════════════════════════════════════════════════════════
-- Les trois seules portes ouvertes au public.
-- SECURITY DEFINER + search_path figé. Aucune table n'est lisible
-- directement par anon : tout passe par ces fonctions.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.rdv_fenetre(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  l public.rdv_lien;
  d public.rdv_dispo;
  v_prenom text; v_tel text;
begin
  select * into l from public.rdv_lien where token = p_token limit 1;
  if not found                 then return jsonb_build_object('ok', false, 'raison', 'inconnu');  end if;
  if l.consomme_le is not null  then return jsonb_build_object('ok', false, 'raison', 'consomme'); end if;
  if l.expire_le <= now()       then return jsonb_build_object('ok', false, 'raison', 'expire');   end if;

  select * into d from public.rdv_dispo where user_id = l.user_id;

  select coalesce(p.first_name, p.full_name, 'votre commercial'), p.phone
    into v_prenom, v_tel
    from public.user_profiles p where p.id = l.user_id;

  return jsonb_build_object(
    'ok', true,
    'officine',   jsonb_build_object('nom', l.nom, 'lat', l.lat, 'lon', l.lon,
                                     'ville', l.ville, 'contact', l.contact_nom),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', v_tel),
    'dispo', case when d.user_id is null then null else jsonb_build_object(
        'jours', d.jours, 'duree_min', d.duree_min, 'marge_route_min', d.marge_route_min,
        'horizon_jours', d.horizon_jours, 'delai_min_jours', d.delai_min_jours,
        'rayon_chaud_km', d.rayon_chaud_km, 'rayon_max_km', d.rayon_max_km,
        'vitesse_kmh', d.vitesse_kmh) end,
    'blocages', coalesce((
        select jsonb_agg(jsonb_build_object('date', b.date, 'moment', b.moment))
          from public.rdv_blocage b
         where b.user_id = l.user_id and b.date >= current_date), '[]'::jsonb),
    -- Points anonymes : ni nom, ni CIP, ni chiffre. Coordonnées arrondies au km.
    'occupes', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'date', r.date, 'heure', to_char(r.heure, 'HH24:MI'),
                 'duree_min', r.duree_min,
                 'lat', round(r.lat::numeric, 2), 'lon', round(r.lon::numeric, 2)))
          from public.rdv r
         where r.user_id = l.user_id and r.statut = 'confirme' and r.date >= current_date), '[]'::jsonb)
  );
end $$;

create or replace function public.rdv_poser(
  p_token uuid, p_date date, p_heure time, p_nom text, p_tel text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  l public.rdv_lien;
  d public.rdv_dispo;
  v_id uuid; v_duree int; v_ok boolean := false;
  v_plage jsonb; v_deb time; v_fin time;
  v_prenom text; v_tel text;
begin
  select * into l from public.rdv_lien where token = p_token limit 1;
  if not found                 then return jsonb_build_object('ok', false, 'raison', 'inconnu');  end if;
  if l.consomme_le is not null  then return jsonb_build_object('ok', false, 'raison', 'consomme'); end if;
  if l.expire_le <= now()       then return jsonb_build_object('ok', false, 'raison', 'expire');   end if;
  if p_date < current_date      then return jsonb_build_object('ok', false, 'raison', 'hors_grille'); end if;

  select * into d from public.rdv_dispo where user_id = l.user_id;
  v_duree := coalesce(d.duree_min, 45);

  -- Le jour est-il bloqué ?
  if exists (select 1 from public.rdv_blocage b
              where b.user_id = l.user_id and b.date = p_date
                and (b.moment = 'journee'
                  or (b.moment = 'matin'      and p_heure <  time '12:00')
                  or (b.moment = 'apres_midi' and p_heure >= time '12:00')))
  then return jsonb_build_object('ok', false, 'raison', 'hors_grille'); end if;

  -- L'horaire tombe-t-il dans une plage travaillée, durée comprise ?
  for v_plage in
    select jsonb_array_elements(
             coalesce(d.jours, '{}'::jsonb) -> to_char(extract(isodow from p_date), 'FM9'))
  loop
    v_deb := (v_plage ->> 0)::time;
    v_fin := (v_plage ->> 1)::time;
    if p_heure >= v_deb and (p_heure + (v_duree || ' minutes')::interval) <= v_fin then
      v_ok := true;
    end if;
  end loop;
  if not v_ok then return jsonb_build_object('ok', false, 'raison', 'hors_grille'); end if;

  begin
    insert into public.rdv (user_id, cip, nom, adresse, cp, ville, lat, lon,
                            date, heure, duree_min, statut, origine, contact_nom, contact_tel)
    values (l.user_id, l.cip, l.nom, l.adresse, l.cp, l.ville, l.lat, l.lon,
            p_date, p_heure, v_duree, 'confirme', 'mailing',
            coalesce(nullif(p_nom, ''), l.contact_nom), nullif(p_tel, ''))
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'raison', 'pris');
  end;

  update public.rdv_lien set consomme_le = now() where token = p_token;

  select coalesce(p.first_name, p.full_name, 'votre commercial'), p.phone
    into v_prenom, v_tel
    from public.user_profiles p where p.id = l.user_id;

  return jsonb_build_object('ok', true,
    'rdv', jsonb_build_object('id', v_id, 'date', p_date, 'heure', to_char(p_heure, 'HH24:MI'),
                              'duree_min', v_duree, 'nom', l.nom,
                              'adresse', concat_ws(', ', l.adresse, l.cp, l.ville)),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', v_tel));
end $$;

create or replace function public.rdv_preference(
  p_token uuid, p_texte text, p_nom text, p_tel text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare l public.rdv_lien;
begin
  select * into l from public.rdv_lien where token = p_token limit 1;
  if not found                 then return jsonb_build_object('ok', false, 'raison', 'inconnu');  end if;
  if l.consomme_le is not null  then return jsonb_build_object('ok', false, 'raison', 'consomme'); end if;
  if l.expire_le <= now()       then return jsonb_build_object('ok', false, 'raison', 'expire');   end if;

  insert into public.rdv (user_id, cip, nom, adresse, cp, ville, lat, lon,
                          date, heure, duree_min, statut, origine, contact_nom, contact_tel, message)
  values (l.user_id, l.cip, l.nom, l.adresse, l.cp, l.ville, l.lat, l.lon,
          current_date, time '00:00', 0, 'a_rappeler', 'mailing',
          coalesce(nullif(p_nom, ''), l.contact_nom), nullif(p_tel, ''), left(coalesce(p_texte, ''), 500));

  update public.rdv_lien set consomme_le = now() where token = p_token;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.rdv_fenetre(uuid)                              to anon, authenticated;
grant execute on function public.rdv_poser(uuid, date, time, text, text)        to anon, authenticated;
grant execute on function public.rdv_preference(uuid, text, text, text)         to anon, authenticated;
```

- [ ] **Step 2: Vérifier les noms de colonnes de `user_profiles` avant d'appliquer**

Les fonctions lisent `first_name`, `full_name` et `phone`. Ces noms doivent être confirmés, sinon la migration échouera.

Via `mcp__supabase__execute_sql` :

```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='user_profiles' order by ordinal_position;
```

Adapter les occurrences de `p.first_name, p.full_name, p.phone` aux colonnes réelles. S'il n'existe aucune colonne de téléphone, remplacer `p.phone` par `null::text`.

- [ ] **Step 3: Appliquer la migration**

`mcp__supabase__apply_migration`, projet `iyvavhnlhxksokkerkos`, nom `rdv_fonctions_publiques`, contenu = le bloc ci-dessus (corrigé à l'étape 2).

- [ ] **Step 4: Tester les fonctions sur un jeu réel**

Via `mcp__supabase__execute_sql`. **Créer d'abord une ligne de disponibilité**, sinon `rdv_poser` répondra `hors_grille` (aucune plage travaillée connue) :

```sql
insert into public.rdv_dispo (user_id)
select id from auth.users order by created_at limit 1
on conflict (user_id) do nothing;

insert into public.rdv_lien (user_id, cip, nom, adresse, cp, ville, lat, lon, modele)
select id, '9999999', 'PHARMACIE TEST', '1 rue du Test', '44000', 'NANTES', 47.2184, -1.5536, 'routine'
  from auth.users order by created_at limit 1
returning token;
```

Puis, en remplaçant `<TOKEN>` :

```sql
select public.rdv_fenetre('<TOKEN>');
select public.rdv_poser('<TOKEN>', current_date + 7, time '10:00', 'M. Test', '0600000000');
select public.rdv_poser('<TOKEN>', current_date + 8, time '10:00', 'M. Test', '');
```

Attendu : la première renvoie `ok:true` avec `occupes: []`. La deuxième `ok:true`. La troisième `{"ok":false,"raison":"consomme"}`.

⚠️ `current_date + 7` peut tomber un samedi ou un dimanche — dans ce cas le retour attendu est `hors_grille`. Choisir une date en semaine.

Contrôle du verrou anti-doublon — créer un second jeton et viser le créneau déjà pris :

```sql
select public.rdv_poser('<TOKEN_2>', current_date + 7, time '10:00', 'M. Autre', '');
```

Attendu : `{"ok":false,"raison":"pris"}`.

- [ ] **Step 5: Nettoyer le jeu d'essai**

```sql
delete from public.rdv       where cip = '9999999';
delete from public.rdv_lien  where cip = '9999999';
select count(*) as reste from public.rdv where cip = '9999999';
```

Attendu : `reste = 0`.

⚠️ Ne supprimer **que** les lignes de CIP `9999999`. Aucune autre donnée ne doit être touchée.

- [ ] **Step 6: Commit**

```bash
git add docs/supabase/rdv.sql
git commit -m "RDV : trois fonctions publiques (fenetre, poser, preference)"
```

---

### Task 5: La page du pharmacien

**Files:**
- Create: `crm/v2/rdv.html`
- Create: `crm/v2/rdv-public.js`

**Interfaces:**
- Consumes: `V2RDV.proposer` (tâche 2), `V2ICS.build` / `V2ICS.dataUrl` (tâche 3), `rdv_fenetre` / `rdv_poser` / `rdv_preference` (tâche 4).
- Produces: une page autonome accessible à `crm/v2/rdv.html?t=<token>`. Elle ne charge **ni** `v2-boot.js`, **ni** aucun `*-data.js`, **ni** le service worker.

- [ ] **Step 1: Écrire la page**

Créer `crm/v2/rdv.html` :

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<title>Prendre rendez-vous</title>
<style>
  :root { --bleu:#0050E6; --encre:#0B1220; --gris:#5B6577; --bord:#E3E8F0; --fond:#F6F8FC; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--fond); color:var(--encre);
         font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width:560px; margin:0 auto; padding:24px 18px 56px; }
  .carte { background:#fff; border:1px solid var(--bord); border-radius:16px; padding:20px; margin-bottom:14px; }
  h1 { font-size:22px; margin:0 0 6px; letter-spacing:-.01em; }
  .sub { color:var(--gris); margin:0 0 20px; }
  .jour { font-weight:600; margin:0 0 10px; }
  .creneaux { display:flex; flex-wrap:wrap; gap:10px; }
  .cr { min-height:48px; min-width:96px; padding:12px 16px; font-size:17px; font-weight:600;
        background:#fff; color:var(--bleu); border:1.5px solid var(--bleu); border-radius:12px; cursor:pointer; }
  .cr:active { background:var(--bleu); color:#fff; }
  .lien { display:inline-block; min-height:44px; padding:12px 0; color:var(--bleu); background:none;
          border:0; font-size:16px; text-decoration:underline; cursor:pointer; }
  .btn { display:inline-block; min-height:48px; padding:14px 22px; background:var(--bleu); color:#fff;
         border:0; border-radius:12px; font-size:17px; font-weight:600; text-decoration:none; cursor:pointer; }
  label { display:block; font-weight:600; margin:14px 0 6px; }
  input, textarea { width:100%; font-size:16px; padding:12px; border:1px solid var(--bord);
                    border-radius:10px; font-family:inherit; }
  .err { color:#B42318; }
  .ok { font-size:19px; font-weight:600; }
  @media (prefers-reduced-motion: reduce) { * { animation:none !important; transition:none !important; } }
</style>
</head>
<body>
  <div class="wrap" id="app"><div class="carte">Chargement…</div></div>
  <!-- Version FIGÉE + empreinte : voir l'étape 2 pour obtenir les deux valeurs. -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<VERSION>/dist/umd/supabase.min.js"
          integrity="<EMPREINTE>" crossorigin="anonymous"></script>
  <script>
    window.SUPABASE_URL = 'https://iyvavhnlhxksokkerkos.supabase.co';
    window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dmF2aG5saHhrc29ra2Vya29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjU2NTYsImV4cCI6MjA5MzE0MTY1Nn0.eMdW6vUdoyVpZbqKXp6FNYTajwKEf4x-Xyj5zj1igO4';
  </script>
  <script src="v2-rdv-creneaux.js?v=20260810a"></script>
  <script src="v2-rdv-ics.js?v=20260810a"></script>
  <script src="rdv-public.js?v=20260810a"></script>
</body>
</html>
```

- [ ] **Step 2: Figer la version de la librairie et calculer son empreinte**

Le reste du CRM charge `@supabase/supabase-js@2`, un numéro de version flottant : le fichier servi peut changer sans prévenir. C'est acceptable derrière un mot de passe, pas sur une page ouverte à des pharmaciens. Ici on fige la version **et** on vérifie l'empreinte du fichier : si le CDN sert autre chose, le navigateur refuse de l'exécuter.

```bash
V=$(curl -s https://registry.npmjs.org/@supabase/supabase-js/latest | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "version = $V"
echo "integrity = sha384-$(curl -sL https://cdn.jsdelivr.net/npm/@supabase/supabase-js@$V/dist/umd/supabase.min.js | openssl dgst -sha384 -binary | openssl base64 -A)"
```

Reporter les deux valeurs dans `rdv.html` à la place de `<VERSION>` et `<EMPREINTE>`.

Puis vérifier que la page charge bien la librairie : ouvrir `rdv.html` en local et contrôler que `window.supabase` existe et qu'aucune erreur d'intégrité n'apparaît en console. Si le navigateur refuse le script, c'est que l'empreinte ne correspond pas — la recalculer, ne jamais retirer l'attribut pour « faire passer ».

- [ ] **Step 3: Écrire la logique de la page**

Créer `crm/v2/rdv-public.js` :

```js
/* ═══════════════════════════════════════════════════════════════════
   Page publique de prise de rendez-vous (pharmacien).
   Autonome : ne charge ni le bundle CRM, ni aucune donnée client.
   Trois appels seulement : rdv_fenetre, rdv_poser, rdv_preference.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var token = new URLSearchParams(window.location.search).get('t') || '';
  var sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  var F = null;      // la fenêtre renvoyée par rdv_fenetre
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function libelle(iso) {
    var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return JOURS[d.getUTCDay()] + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1];
  }
  function carte(html) { return '<div class="carte">' + html + '</div>'; }
  function secours(msg) {
    var tel = F && F.commercial && F.commercial.tel;
    app.innerHTML = carte('<p class="err">' + esc(msg) + '</p>' +
      (tel ? '<p>Vous pouvez joindre ' + esc(F.commercial.prenom) +
             ' au <a href="tel:' + esc(String(tel).replace(/[^0-9+]/g, '')) + '">' + esc(tel) + '</a>.</p>' : ''));
  }

  function demarrer() {
    if (!token) return secours('Ce lien est incomplet.');
    sb.rpc('rdv_fenetre', { p_token: token }).then(function (r) {
      if (r.error) return secours('Le service est momentanément indisponible. Merci de réessayer dans un instant.');
      F = r.data || {};
      if (!F.ok) {
        if (F.raison === 'consomme') return secours('Ce rendez-vous est déjà confirmé. Merci !');
        if (F.raison === 'expire')   return secours('Ce lien a expiré.');
        return secours('Ce lien n’est pas valide.');
      }
      afficherCreneaux();
    }).catch(function () {
      secours('Le service est momentanément indisponible. Merci de réessayer dans un instant.');
    });
  }

  function afficherCreneaux() {
    var jours = window.V2RDV.proposer({
      officine: F.officine,
      dispo: F.dispo,
      blocages: F.blocages || [],
      occupes: F.occupes || [],
      aujourdhui: new Date().toISOString().slice(0, 10)
    });
    var h = '<div class="carte"><h1>Prendre rendez-vous</h1>' +
            '<p class="sub">' + esc(F.commercial.prenom) + ' vous propose de passer à ' +
            esc(F.officine.nom) + '. Choisissez le moment qui vous arrange.</p></div>';
    if (!jours.length) {
      h += carte('<p>Aucun créneau ne se libère dans les trois prochaines semaines.</p>' +
                 '<button class="btn" id="pref">Dites-moi vos préférences</button>');
    } else {
      jours.forEach(function (j) {
        h += '<div class="carte"><p class="jour">' + esc(libelle(j.date)) + '</p><div class="creneaux">' +
             j.creneaux.map(function (c) {
               return '<button class="cr" data-d="' + esc(j.date) + '" data-h="' + esc(c) + '">' +
                      esc(c.replace(':', 'h')) + '</button>';
             }).join('') + '</div></div>';
      });
      h += carte('<button class="lien" id="pref">Aucun ne me convient →</button>');
    }
    app.innerHTML = h;
    Array.prototype.forEach.call(app.querySelectorAll('.cr'), function (b) {
      b.addEventListener('click', function () { formulaire(b.getAttribute('data-d'), b.getAttribute('data-h')); });
    });
    var p = document.getElementById('pref');
    if (p) p.addEventListener('click', formulairePreference);
  }

  function formulaire(date, heure) {
    app.innerHTML = carte(
      '<h1>' + esc(libelle(date)) + ' à ' + esc(heure.replace(':', 'h')) + '</h1>' +
      '<label for="nom">Votre nom</label><input id="nom" autocomplete="name" />' +
      '<label for="tel">Votre téléphone (facultatif)</label><input id="tel" type="tel" autocomplete="tel" />' +
      '<p style="margin-top:18px"><button class="btn" id="go">Confirmer ce rendez-vous</button></p>' +
      '<button class="lien" id="retour">← revenir aux créneaux</button>');
    document.getElementById('retour').addEventListener('click', afficherCreneaux);
    document.getElementById('go').addEventListener('click', function () {
      var b = this; b.disabled = true; b.textContent = 'Enregistrement…';
      sb.rpc('rdv_poser', {
        p_token: token, p_date: date, p_heure: heure,
        p_nom: document.getElementById('nom').value || '',
        p_tel: document.getElementById('tel').value || ''
      }).then(function (r) {
        if (r.error) {
          b.disabled = false; b.textContent = 'Confirmer ce rendez-vous';
          return secours('Enregistrement impossible. Merci de réessayer.');
        }
        var d = r.data || {};
        if (!d.ok) {
          if (d.raison === 'pris') { rechargerApresConflit(); return; }
          return secours('Ce créneau n’est plus disponible.');
        }
        confirme(d);
      }).catch(function () {
        b.disabled = false; b.textContent = 'Confirmer ce rendez-vous';
        secours('Enregistrement impossible. Merci de réessayer.');
      });
    });
  }

  // Le créneau est parti entre l'affichage et le clic : on recharge la fenêtre.
  function rechargerApresConflit() {
    app.innerHTML = carte('<p>Ce créneau vient d’être pris. Voici les créneaux à jour…</p>');
    demarrer();
  }

  function confirme(d) {
    var r = d.rdv;
    var ics = window.V2ICS.build({
      uid: r.id, date: r.date, heure: r.heure, duree_min: r.duree_min,
      titre: 'Rendez-vous ' + (d.commercial.prenom || '') + ' · Intégral Pharma',
      lieu: r.adresse, description: 'Rendez-vous pris depuis le lien reçu par mail.',
      organisateur: d.commercial.prenom || 'Intégral Pharma'
    });
    app.innerHTML = carte(
      '<p class="ok">C’est noté : ' + esc(libelle(r.date)) + ' à ' + esc(r.heure.replace(':', 'h')) + '.</p>' +
      '<p>' + esc(d.commercial.prenom) + ' vous attend à ' + esc(r.nom) + '.</p>' +
      '<p style="margin-top:18px"><a class="btn" download="rendez-vous.ics" href="' +
        window.V2ICS.dataUrl(ics) + '">Ajouter à mon agenda</a></p>' +
      (d.commercial.tel ? '<p style="margin-top:14px">Un empêchement ? Appelez ' + esc(d.commercial.prenom) +
        ' au <a href="tel:' + esc(String(d.commercial.tel).replace(/[^0-9+]/g, '')) + '">' +
        esc(d.commercial.tel) + '</a>.</p>' : ''));
  }

  function formulairePreference() {
    app.innerHTML = carte(
      '<h1>Quand vous arrangerait-il ?</h1>' +
      '<label for="pt">Votre préférence</label>' +
      '<textarea id="pt" rows="3" placeholder="Ex. plutôt les mardis matin, ou après le 15 septembre"></textarea>' +
      '<label for="pn">Votre nom</label><input id="pn" autocomplete="name" />' +
      '<label for="pp">Votre téléphone</label><input id="pp" type="tel" autocomplete="tel" />' +
      '<p style="margin-top:18px"><button class="btn" id="pgo">Envoyer</button></p>' +
      '<button class="lien" id="pretour">← revenir aux créneaux</button>');
    document.getElementById('pretour').addEventListener('click', afficherCreneaux);
    document.getElementById('pgo').addEventListener('click', function () {
      var b = this; b.disabled = true; b.textContent = 'Envoi…';
      sb.rpc('rdv_preference', {
        p_token: token,
        p_texte: document.getElementById('pt').value || '',
        p_nom: document.getElementById('pn').value || '',
        p_tel: document.getElementById('pp').value || ''
      }).then(function (r) {
        if (r.error || !r.data || !r.data.ok) {
          b.disabled = false; b.textContent = 'Envoyer';
          return secours('Envoi impossible. Merci de réessayer.');
        }
        app.innerHTML = carte('<p class="ok">C’est transmis.</p><p>' +
          esc(F.commercial.prenom) + ' vous rappelle pour convenir d’un moment.</p>');
      }).catch(function () { b.disabled = false; b.textContent = 'Envoyer'; secours('Envoi impossible.'); });
    });
  }

  demarrer();
})();
```

- [ ] **Step 4: Vérifier la syntaxe**

Run: `cd /Users/williammorel/JARVIS/APP && node --check crm/v2/rdv-public.js`
Expected: aucune sortie.

- [ ] **Step 5: Servir en local et vérifier la page avec un vrai jeton**

Créer un jeton d'essai (même requêtes qu'à la tâche 4, étape 4), puis :

```bash
cd /Users/williammorel/JARVIS/APP && python3 -m http.server 8080
```

Ouvrir `http://localhost:8080/crm/v2/rdv.html?t=<TOKEN>` avec le MCP `chrome-devtools` ou `playwright`, en **fenêtre de 390 px de large**.

Vérifier et capturer :
1. Trois jours s'affichent, avec jusqu'à trois horaires chacun.
2. Aucun débordement horizontal : `document.documentElement.scrollWidth <= 390`.
3. Aucune erreur dans la console.
4. Un clic sur un créneau ouvre le formulaire ; « Confirmer » affiche l'écran de confirmation.
5. Le bouton « Ajouter à mon agenda » télécharge un fichier ; l'ouvrir et vérifier que la date et l'heure correspondent.
6. Recharger la page avec le même jeton → message « Ce rendez-vous est déjà confirmé ».

- [ ] **Step 6: Vérifier les cas d'erreur**

- `rdv.html` sans paramètre `t` → « Ce lien est incomplet. »
- `rdv.html?t=00000000-0000-0000-0000-000000000000` → « Ce lien n'est pas valide. »

- [ ] **Step 7: Nettoyer le jeu d'essai**

```sql
delete from public.rdv      where cip = '9999999';
delete from public.rdv_lien where cip = '9999999';
```

⚠️ Uniquement le CIP `9999999`.

- [ ] **Step 8: Commit**

```bash
git add crm/v2/rdv.html
git add crm/v2/rdv-public.js
git commit -m "RDV : page publique du pharmacien (autonome, mobile, .ics)"
```

---

### Task 6: Écran « Mes disponibilités »

**Files:**
- Create: `crm/v2/v2-rdv-dispo.js`
- Modify: `crm/v2/index.html`
- Modify: `crm/v2/sw.js`

**Interfaces:**
- Consumes: `V2.sb()`, `V2.esc`, `V2.toast`, `V2.go`, `V2RDV.DEFAUT_DISPO`.
- Produces: `V2.pages.rdvdispo = { render: function (root) {…} }` et `V2.rdvDispo.charger()` → `Promise<{dispo, blocages}>`, réutilisé par la tâche 7.

- [ ] **Step 1: Vérifier comment l'identifiant de l'utilisateur connecté est exposé**

Run: `cd /Users/williammorel/JARVIS/APP && grep -n "V2.user" crm/v2/v2-boot.js | head -10`

Relever le chemin exact (`V2.user.id`, `V2.session.user.id`, autre). Le code ci-dessous suppose `V2.user.id` — **corriger la fonction `uid()` si ce n'est pas le cas.** Ne pas deviner.

- [ ] **Step 2: Écrire l'écran**

Créer `crm/v2/v2-rdv-dispo.js` :

```js
/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Mes disponibilités (pages.rdvdispo)
   Ce que le commercial règle une fois : ses jours, ses plages, la durée
   d'un RDV, et les demi-journées où il n'est pas disponible.
   C'est la matière que le moteur V2RDV utilise pour proposer des créneaux.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var NOMS = { '1': 'Lundi', '2': 'Mardi', '3': 'Mercredi', '4': 'Jeudi', '5': 'Vendredi' };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function defaut() { return JSON.parse(JSON.stringify(window.V2RDV.DEFAUT_DISPO)); }

  V2.rdvDispo = {
    charger: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve({ dispo: defaut(), blocages: [] });
      return Promise.all([
        c.from('rdv_dispo').select('*').eq('user_id', u).maybeSingle(),
        c.from('rdv_blocage').select('date,moment').eq('user_id', u)
          .gte('date', new Date().toISOString().slice(0, 10)).order('date')
      ]).then(function (r) {
        var d = (r[0] && r[0].data) || null;
        return { dispo: d || defaut(), blocages: (r[1] && r[1].data) || [] };
      }).catch(function () { return { dispo: defaut(), blocages: [] }; });
    },

    enregistrer: function () {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi pour enregistrer tes disponibilités.'); return; }
      var jours = {}, i;
      for (i = 1; i <= 5; i++) {
        var k = String(i);
        if (!document.getElementById('rd-j' + k).checked) continue;
        var m1 = document.getElementById('rd-m1-' + k).value;
        var m2 = document.getElementById('rd-m2-' + k).value;
        var a1 = document.getElementById('rd-a1-' + k).value;
        var a2 = document.getElementById('rd-a2-' + k).value;
        var plages = [];
        if (m1 && m2 && m1 < m2) plages.push([m1, m2]);
        if (a1 && a2 && a1 < a2) plages.push([a1, a2]);
        if (plages.length) jours[k] = plages;
      }
      var row = {
        user_id: u, jours: jours,
        duree_min: parseInt(document.getElementById('rd-duree').value, 10) || 45,
        marge_route_min: parseInt(document.getElementById('rd-marge').value, 10) || 15,
        maj_le: new Date().toISOString()
      };
      c.from('rdv_dispo').upsert(row, { onConflict: 'user_id' }).then(function (r) {
        V2.toast(r.error ? 'Enregistrement impossible.' : 'Disponibilités enregistrées.');
      });
    },

    bloquer: function (moment) {
      var c = sb(), u = uid(), date = document.getElementById('rd-bl').value;
      if (!c || !u || !date) { V2.toast('Choisis une date.'); return; }
      c.from('rdv_blocage').insert({ user_id: u, date: date, moment: moment }).then(function (r) {
        if (r.error) { V2.toast('Blocage impossible.'); return; }
        V2.toast('Indisponibilité enregistrée.');
        V2.go('rdvdispo');
      });
    },

    debloquer: function (date, moment) {
      var c = sb(), u = uid();
      if (!c || !u) return;
      c.from('rdv_blocage').delete().eq('user_id', u).eq('date', date).eq('moment', moment)
        .then(function () { V2.toast('Indisponibilité retirée.'); V2.go('rdvdispo'); });
    }
  };

  function ligneJour(k, plages) {
    var actif = !!(plages && plages.length);
    var m = (plages && plages[0]) || ['09:00', '12:30'];
    var a = (plages && plages[1]) || ['14:00', '18:00'];
    var ch = 'font-size:16px;min-height:44px';
    return '<div class="v2-card" style="padding:12px;margin-bottom:8px">' +
      '<label style="display:flex;align-items:center;gap:10px;min-height:44px;font-weight:600">' +
        '<input type="checkbox" id="rd-j' + k + '"' + (actif ? ' checked' : '') +
        ' style="width:22px;height:22px" /> ' + esc(NOMS[k]) + '</label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">' +
        '<input type="time" id="rd-m1-' + k + '" value="' + esc(m[0]) + '" style="' + ch + '" />' +
        '<input type="time" id="rd-m2-' + k + '" value="' + esc(m[1]) + '" style="' + ch + '" />' +
        '<input type="time" id="rd-a1-' + k + '" value="' + esc(a[0]) + '" style="' + ch + '" />' +
        '<input type="time" id="rd-a2-' + k + '" value="' + esc(a[1]) + '" style="' + ch + '" />' +
      '</div></div>';
  }

  V2.pages.rdvdispo = {
    render: function (root) {
      root.innerHTML = '<div class="v2-page"><h1 class="v2-h1">Mes disponibilités</h1>' +
        '<p class="v2-sub">Chargement…</p></div>';
      V2.rdvDispo.charger().then(function (st) {
        var d = st.dispo, k, h = '';
        for (k = 1; k <= 5; k++) h += ligneJour(String(k), d.jours && d.jours[String(k)]);
        var bl = (st.blocages || []).map(function (b) {
          return '<li style="min-height:44px;display:flex;align-items:center;gap:10px">' +
            esc(b.date) + ' · ' + esc(String(b.moment).replace('_', '-')) +
            ' <button class="v2-btn v2-btn-ghost" style="min-height:44px" onclick="V2.rdvDispo.debloquer(\'' +
            esc(b.date) + '\',\'' + esc(b.moment) + '\')">retirer</button></li>';
        }).join('');
        root.innerHTML = '<div class="v2-page">' +
          '<h1 class="v2-h1">Mes disponibilités</h1>' +
          '<p class="v2-sub">Ce que les pharmaciens pourront réserver. Matin, puis après-midi.</p>' + h +
          '<div class="v2-card" style="padding:12px;margin-bottom:8px">' +
            '<label style="font-weight:600;display:block">Durée d’un rendez-vous (minutes)</label>' +
            '<input type="number" id="rd-duree" value="' + esc(d.duree_min || 45) +
              '" style="font-size:16px;min-height:44px;width:120px" />' +
            '<label style="font-weight:600;margin-top:10px;display:block">Marge de route entre deux rendez-vous (minutes)</label>' +
            '<input type="number" id="rd-marge" value="' + esc(d.marge_route_min || 15) +
              '" style="font-size:16px;min-height:44px;width:120px" />' +
          '</div>' +
          '<p><button class="v2-btn v2-btn-primary" style="min-height:48px" onclick="V2.rdvDispo.enregistrer()">Enregistrer</button></p>' +
          '<h2 class="v2-h2">Je ne suis pas disponible</h2>' +
          '<div class="v2-card" style="padding:12px">' +
            '<input type="date" id="rd-bl" style="font-size:16px;min-height:44px" /> ' +
            '<button class="v2-btn" style="min-height:44px" onclick="V2.rdvDispo.bloquer(\'matin\')">Matin</button> ' +
            '<button class="v2-btn" style="min-height:44px" onclick="V2.rdvDispo.bloquer(\'apres_midi\')">Après-midi</button> ' +
            '<button class="v2-btn" style="min-height:44px" onclick="V2.rdvDispo.bloquer(\'journee\')">Toute la journée</button>' +
          '</div>' +
          (bl ? '<ul style="list-style:none;padding:0">' + bl + '</ul>'
              : '<p class="v2-sub">Aucune indisponibilité enregistrée.</p>') +
        '</div>';
      });
    }
  };
})();
```

- [ ] **Step 3: Déclarer les scripts et faire monter le token de cache**

Dans `crm/v2/index.html` :
1. Remplacer **toutes** les occurrences de `20260806d` par `20260810a`.
2. Ajouter, juste après la ligne `<script src="v2-remontees.js?v=20260810a"></script>` :

```html
  <!-- Prise de RDV : moteur de créneaux + invitation agenda + écrans -->
  <script src="v2-rdv-creneaux.js?v=20260810a"></script>
  <script src="v2-rdv-ics.js?v=20260810a"></script>
  <script src="v2-rdv-dispo.js?v=20260810a"></script>
```

Dans `crm/v2/sw.js`, ligne 13 : `var VER = '20260810a';`

- [ ] **Step 4: Vérifier que le token est cohérent partout**

```bash
cd /Users/williammorel/JARVIS/APP
grep -o '?v=[0-9a-z]*' crm/v2/index.html | sort -u
grep -n "^var VER" crm/v2/sw.js
```

Expected : la première commande ne renvoie **qu'une seule** valeur, `?v=20260810a`, et la seconde `var VER = '20260810a';`. Toute divergence rend la mise en ligne invisible.

- [ ] **Step 5: Vérifier l'écran**

```bash
cd /Users/williammorel/JARVIS/APP && python3 -m http.server 8080
```

Ouvrir `http://localhost:8080/crm/v2/index.html#rdvdispo` (fenêtre 390 px), se connecter, et vérifier :
1. Les cinq jours s'affichent, cochés, avec 09:00/12:30 et 14:00/18:00.
2. Décocher mercredi, changer la durée à 60, « Enregistrer » → message de confirmation.
3. Recharger la page → mercredi toujours décoché, durée toujours à 60.
4. Poser une indisponibilité « Matin » sur une date → elle apparaît dans la liste ; « retirer » la fait disparaître.
5. Aucune erreur console, aucun débordement horizontal.

- [ ] **Step 6: Commit**

```bash
git add crm/v2/v2-rdv-dispo.js
git add crm/v2/index.html
git add crm/v2/sw.js
git commit -m "RDV : ecran Mes disponibilites + declaration des scripts"
```

---

### Task 7: Écran « Rendez-vous » et envoi d'un mail depuis la fiche officine

À la fin de cette tâche, le circuit complet fonctionne. C'est le premier jalon livrable.

**Files:**
- Create: `crm/v2/v2-rdv.js`
- Modify: `crm/v2/v2-pharma.js` (autour de la ligne 1286, où sont construits les liens d'action de la fiche)
- Modify: `crm/v2/v2-app.js` (autour de la ligne 840, où sont construites les tuiles du lanceur)
- Modify: `crm/v2/index.html`

**Interfaces:**
- Consumes: `V2ICS` (tâche 3), `V2.sb()`, `V2.esc`, `V2.toast`, `V2.go`.
- Produces:
  - `V2.pages.rdv = { render: function (root) {…} }`
  - `V2.rdv.proposer(officine)` → crée un jeton et ouvre le mail. `officine` = `{cip, nom, adresse, cp, ville, email, contact, lat, lon}`.
  - `V2.rdv.ics(id)` → télécharge l'invitation d'un rendez-vous.
  - `V2.rdv.BASE_URL` → constante unique du lien public, à changer le jour de la bascule de domaine.

- [ ] **Step 1: Écrire l'écran et la création de lien**

Créer `crm/v2/v2-rdv.js` :

```js
/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Rendez-vous (pages.rdv)
   Crée le lien de réservation, ouvre le mail pré-rempli dans la boîte
   du commercial, et affiche ce que les pharmaciens ont réservé.
   Le lien public sort d'UNE constante : BASE_URL. Le jour où le domaine
   rdv.integralpharma.fr sera branché, c'est la seule ligne à changer.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function prenom() { return (V2.user && (V2.user.prenom || V2.user.first_name)) || ''; }
  function libelle(iso) {
    var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return JOURS[d.getUTCDay()] + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1];
  }
  function tel(s) { return String(s || '').replace(/[^0-9+]/g, ''); }

  // Géocodage gratuit sans clé (même service que la tournée et la carte).
  function geocode(q) {
    if (!q) return Promise.resolve(null);
    return fetch('https://data.geopf.fr/geocodage/search?limit=1&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var f = j && j.features && j.features[0];
        if (!f || !f.geometry) return null;
        return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
      })
      .catch(function () { return null; });
  }

  V2.rdv = {
    // Adresse publique de la page du pharmacien. Bascule de domaine = cette ligne.
    BASE_URL: 'https://willmorel49-coder.github.io/jarvis-app/crm/v2/rdv.html',

    proposer: function (o) {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi pour proposer un rendez-vous.'); return; }
      if (!o || !o.email) { V2.toast('Cette officine n’a pas d’adresse mail.'); return; }
      V2.toast('Préparation du mail…');

      var coord = (o.lat != null && o.lon != null)
        ? Promise.resolve({ lat: o.lat, lon: o.lon })
        : geocode([o.adresse, o.cp, o.ville].filter(Boolean).join(' '));

      coord.then(function (ll) {
        return c.from('rdv_lien').insert({
          user_id: u, cip: o.cip || null, nom: o.nom, adresse: o.adresse || null,
          cp: o.cp || null, ville: o.ville || null,
          lat: ll ? ll.lat : null, lon: ll ? ll.lon : null,
          contact_nom: o.contact || null, modele: 'routine'
        }).select('token').single();
      }).then(function (r) {
        if (r.error || !r.data) { V2.toast('Création du lien impossible.'); return; }
        var lien = V2.rdv.BASE_URL + '?t=' + r.data.token;
        var objet = 'Un moment pour se voir ?';
        var corps =
          'Bonjour' + (o.contact ? ' ' + o.contact : '') + ',\n\n' +
          'Je passe prochainement dans votre secteur et j’aimerais faire le point avec vous.\n\n' +
          'Plutôt que de vous appeler en plein rush, choisissez vous-même le moment qui vous arrange :\n' +
          lien + '\n\n' +
          'Trois créneaux vous seront proposés, ça prend dix secondes.\n\n' +
          'Bien à vous,\n' + prenom() +
          '\n\n— Si vous ne souhaitez plus recevoir ces propositions, répondez STOP à ce mail.';
        window.location.href = 'mailto:' + encodeURIComponent(o.email) +
          '?subject=' + encodeURIComponent(objet) + '&body=' + encodeURIComponent(corps);
        c.from('rdv_lien').update({ envoye_le: new Date().toISOString() })
          .eq('token', r.data.token).then(function () {});
      }).catch(function () { V2.toast('Création du lien impossible.'); });
    },

    ics: function (id) {
      var c = sb();
      if (!c) return;
      c.from('rdv').select('*').eq('id', id).single().then(function (r) {
        if (r.error || !r.data) { V2.toast('Rendez-vous introuvable.'); return; }
        var d = r.data;
        var texte = window.V2ICS.build({
          uid: d.id, date: d.date, heure: String(d.heure).slice(0, 5), duree_min: d.duree_min,
          titre: 'RDV ' + d.nom, lieu: [d.adresse, d.cp, d.ville].filter(Boolean).join(', '),
          description: 'Rendez-vous pris par le pharmacien depuis JARVIS.',
          organisateur: 'Intégral Pharma'
        });
        var a = document.createElement('a');
        a.href = window.V2ICS.dataUrl(texte);
        a.download = 'rdv-' + d.date + '.ics';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      });
    }
  };

  V2.pages.rdv = {
    render: function (root) {
      root.innerHTML = '<div class="v2-page"><h1 class="v2-h1">Rendez-vous</h1><p class="v2-sub">Chargement…</p></div>';
      var c = sb(), u = uid();
      if (!c || !u) {
        root.innerHTML = '<div class="v2-page"><h1 class="v2-h1">Rendez-vous</h1>' +
          '<p class="v2-sub">Connecte-toi pour voir tes rendez-vous.</p></div>';
        return;
      }
      var auj = new Date().toISOString().slice(0, 10);
      Promise.all([
        c.from('rdv').select('*').eq('user_id', u).eq('statut', 'confirme').gte('date', auj)
          .order('date').order('heure'),
        c.from('rdv').select('*').eq('user_id', u).eq('statut', 'a_rappeler')
          .order('cree_le', { ascending: false }),
        c.from('rdv_lien').select('*').eq('user_id', u).is('consomme_le', null)
          .not('envoye_le', 'is', null).order('envoye_le', { ascending: false })
      ]).then(function (r) {
        var venir = (r[0] && r[0].data) || [];
        var rappeler = (r[1] && r[1].data) || [];
        var attente = (r[2] && r[2].data) || [];
        var h = '<div class="v2-page"><h1 class="v2-h1">Rendez-vous</h1>';

        h += '<h2 class="v2-h2">À venir</h2>';
        h += venir.length ? venir.map(function (d) {
          return '<div class="v2-card" style="padding:12px;margin-bottom:8px">' +
            '<div style="font-weight:600">' + esc(libelle(d.date)) + ' · ' +
              esc(String(d.heure).slice(0, 5).replace(':', 'h')) + '</div>' +
            '<div>' + esc(d.nom) + (d.ville ? ' · ' + esc(d.ville) : '') + '</div>' +
            (d.contact_nom ? '<div class="v2-sub">' + esc(d.contact_nom) +
              (d.contact_tel ? ' · <a href="tel:' + esc(tel(d.contact_tel)) + '">' +
                esc(d.contact_tel) + '</a>' : '') + '</div>' : '') +
            '<button class="v2-btn" style="min-height:44px;margin-top:8px" onclick="V2.rdv.ics(\'' +
              esc(d.id) + '\')">Ajouter à mon agenda</button></div>';
        }).join('') : '<p class="v2-sub">Aucun rendez-vous pour l’instant.</p>';

        h += '<h2 class="v2-h2">À rappeler</h2>';
        h += rappeler.length ? rappeler.map(function (d) {
          return '<div class="v2-card" style="padding:12px;margin-bottom:8px">' +
            '<div style="font-weight:600">' + esc(d.nom) + '</div>' +
            (d.message ? '<div>« ' + esc(d.message) + ' »</div>' : '') +
            (d.contact_tel ? '<div><a href="tel:' + esc(tel(d.contact_tel)) + '">' +
              esc(d.contact_tel) + '</a></div>' : '') + '</div>';
        }).join('') : '<p class="v2-sub">Personne à rappeler.</p>';

        h += '<h2 class="v2-h2">Sans réponse</h2>';
        h += attente.length ? attente.map(function (l) {
          return '<div class="v2-card" style="padding:12px;margin-bottom:8px">' + esc(l.nom) +
            ' <span class="v2-sub">· envoyé le ' + esc(String(l.envoye_le).slice(0, 10)) + '</span></div>';
        }).join('') : '<p class="v2-sub">Rien en attente.</p>';

        h += '<p style="margin-top:18px"><button class="v2-btn" style="min-height:44px" ' +
             'onclick="V2.go(\'rdvdispo\')">Mes disponibilités</button></p></div>';
        root.innerHTML = h;
      });
    }
  };
})();
```

- [ ] **Step 2: Ajouter le bouton sur la fiche officine**

Ouvrir `crm/v2/v2-pharma.js` autour de la ligne 1286 et **lire les 30 lignes qui précèdent** pour relever les noms réels des variables (`p`, `email`, `links`) et des champs de l'officine. Ne pas deviner.

Juste après le `links.push(…mailto…)` existant, ajouter :

```js
      // Proposer un rendez-vous : crée le lien de réservation et ouvre le mail
      if (email) {
        var _o = { cip: p.cip, nom: p.nom, adresse: p.adresse, cp: p.cp, ville: p.ville,
                   email: email, contact: p.contact || '', lat: p.lat, lon: p.lon };
        links.push('<button class="v2-btn v2-btn-ghost ph-act-link" style="min-height:44px" ' +
          'onclick=\'V2.rdv.proposer(' + JSON.stringify(_o).replace(/'/g, '&#39;') + ')\'>Proposer un RDV</button>');
      }
```

- [ ] **Step 3: Ajouter la tuile dans le lanceur**

Vérifier d'abord les icônes disponibles :

Run: `cd /Users/williammorel/JARVIS/APP && grep -o "case '[a-z-]*'" crm/v2/v2-icons.js | sort -u | head -40`

Puis, dans `crm/v2/v2-app.js`, juste après le `P.push({ k: 'remontees', … })` (ligne ~840), ajouter — en remplaçant `'spark'` par une icône réellement présente si besoin :

```js
      if (V2.pages.rdv) {
        P.push({ k: 'rdv', cls: 'p3', accent: '#0050E6', ico: 'spark', tag: 'Terrain', t: 'Rendez-vous',
                 d: 'Envoie un lien de réservation à une officine : elle choisit son créneau, calé sur la géographie de ta journée.',
                 go: 'Voir mes rendez-vous' });
      }
```

- [ ] **Step 4: Déclarer le script**

Dans `crm/v2/index.html`, après la ligne `<script src="v2-rdv-dispo.js?v=20260810a"></script>` :

```html
  <script src="v2-rdv.js?v=20260810a"></script>
```

- [ ] **Step 5: Vérifier la syntaxe, les tests et le token**

```bash
cd /Users/williammorel/JARVIS/APP
node --check crm/v2/v2-rdv.js
node --check crm/v2/v2-pharma.js
node --check crm/v2/v2-app.js
node --test tests/
grep -o '?v=[0-9a-z]*' crm/v2/index.html | sort -u
grep -n "^var VER" crm/v2/sw.js
```

Expected : aucune erreur de syntaxe, `# fail 0`, une seule valeur `?v=20260810a`, `VER` identique.

- [ ] **Step 6: Vérifier le circuit complet à l'écran**

Serveur local, fenêtre 390 px :
1. Ouvrir une fiche officine qui a une adresse mail → le bouton « Proposer un RDV » est là.
2. Cliquer → la messagerie s'ouvre avec l'objet, le corps et le lien. **Ne pas envoyer.** Copier le lien.
3. Ouvrir le lien dans un autre onglet → la page du pharmacien s'affiche avec trois jours.
4. Réserver un créneau → écran de confirmation, fichier `.ics` téléchargeable.
5. Revenir dans JARVIS, page « Rendez-vous » → le rendez-vous est dans « À venir », avec le nom et le téléphone du contact.
6. Cliquer « Ajouter à mon agenda » → le fichier se télécharge ; l'ouvrir et vérifier la date.
7. Captures d'écran des trois écrans (fiche, page pharmacien, page Rendez-vous) à 390 px.

- [ ] **Step 7: Nettoyer le rendez-vous d'essai**

Supprimer **uniquement** les lignes créées pendant l'essai, ciblées par leur identifiant relevé à l'étape 6 :

```sql
delete from public.rdv      where id    = '<ID_RELEVE>';
delete from public.rdv_lien where token = '<TOKEN_RELEVE>';
```

⚠️ Jamais de `delete from public.rdv` sans clause, jamais de suppression par date. Cibler l'identifiant exact.

- [ ] **Step 8: Contrôle avant mise en ligne**

Lancer le sous-agent `gardien-deploiement` sur le diff de la branche : syntaxe, token de cache, synchronisation du service worker, secrets, `console.log` oubliés, `[skip ci]`. Verdict GO obligatoire.

- [ ] **Step 9: Commit**

```bash
git add crm/v2/v2-rdv.js
git add crm/v2/v2-pharma.js
git add crm/v2/v2-app.js
git add crm/v2/index.html
git commit -m "RDV : ecran Rendez-vous + bouton Proposer un RDV sur la fiche officine"
```

**Fin du lot 1.** Le circuit est complet et utilisable.

---

# LOT 2 — LA CAMPAGNE

---

### Task 8: Les trois modèles de mail

**Files:**
- Create: `crm/v2/v2-rdv-modeles.js`
- Test: `tests/rdv-modeles.test.mjs`

**Interfaces:**
- Consumes: rien (fichier pur).
- Produces: `V2MOD.liste()` → `[{cle, nom, description}]` et `V2MOD.rendre(cle, ctx)` → `{objet, corps}`.
  `ctx` = `{contact, nom_officine, ville, ca_annee, potentiel_gx, manque_a_gagne, mois_derniere_visite, prenom_commercial, tel_commercial, lien, texte_libre}`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/rdv-modeles.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MOD = require('../crm/v2/v2-rdv-modeles.js');

const CTX = {
  contact: 'Mme Tritsch', nom_officine: 'PHARMACIE RIVE SUD', ville: 'MURS ERIGNE',
  ca_annee: 43812, potentiel_gx: 423000, manque_a_gagne: 12000,
  mois_derniere_visite: 7, prenom_commercial: 'William', tel_commercial: '0600000000',
  lien: 'https://exemple.fr/rdv.html?t=abc', texte_libre: 'La gamme diabète arrive en septembre.'
};

test('trois modeles sont proposes', () => {
  const l = MOD.liste();
  assert.equal(l.length, 3);
  assert.deepEqual(l.map(m => m.cle).sort(), ['bilan', 'offre', 'routine']);
});

test('chaque modele produit un objet et un corps non vides', () => {
  MOD.liste().forEach(m => {
    const r = MOD.rendre(m.cle, CTX);
    assert.ok(r.objet.length > 5, `objet vide pour ${m.cle}`);
    assert.ok(r.corps.length > 50, `corps vide pour ${m.cle}`);
  });
});

test('le lien figure dans les trois modeles', () => {
  MOD.liste().forEach(m => {
    assert.ok(MOD.rendre(m.cle, CTX).corps.includes(CTX.lien), `lien absent de ${m.cle}`);
  });
});

test('la ligne STOP figure dans les trois modeles', () => {
  MOD.liste().forEach(m => {
    assert.ok(/STOP/.test(MOD.rendre(m.cle, CTX).corps), `mention STOP absente de ${m.cle}`);
  });
});

test('objet + corps tiennent sous 1200 caracteres', () => {
  MOD.liste().forEach(m => {
    const r = MOD.rendre(m.cle, CTX);
    assert.ok(r.objet.length + r.corps.length <= 1200, `${m.cle} est trop long`);
  });
});

test('aucun modele ne contient de condition commerciale chiffree', () => {   // vocab-ok
  MOD.liste().forEach(m => {
    const c = MOD.rendre(m.cle, CTX).corps.toLowerCase();
    assert.equal(/remise/.test(c), false, `${m.cle} emploie le mot interdit`);   // vocab-ok
    assert.equal(/abandon de marge/.test(c), false, `${m.cle} chiffre l abandon de marge`);
    assert.equal(/\d+\s*%/.test(c), false, `${m.cle} contient un pourcentage`);
  });
});

test('modele bilan : reprend les chiffres de l officine', () => {
  const r = MOD.rendre('bilan', CTX);
  assert.ok(r.corps.includes('43 812') || r.corps.includes('43812'), 'le CA doit apparaitre');
});

test('modele routine : reprend le nombre de mois', () => {
  assert.ok(MOD.rendre('routine', CTX).corps.includes('7'));
});

test('modele offre : reprend le texte libre', () => {
  assert.ok(MOD.rendre('offre', CTX).corps.includes('gamme diabète'));
});

test('champs manquants : pas de undefined dans le rendu', () => {
  MOD.liste().forEach(m => {
    const r = MOD.rendre(m.cle, { lien: 'x', prenom_commercial: 'W' });
    assert.equal(/undefined|null|NaN/.test(r.corps), false, `${m.cle} laisse passer un trou`);
    assert.equal(/undefined|null|NaN/.test(r.objet), false, `${m.cle} laisse passer un trou dans l objet`);
  });
});

test('cle inconnue : renvoie le modele routine plutot que de casser', () => {
  const r = MOD.rendre('nimportequoi', CTX);
  assert.ok(r.corps.length > 50);
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd /Users/williammorel/JARVIS/APP && node --test tests/rdv-modeles.test.mjs`
Expected: module introuvable.

- [ ] **Step 3: Écrire les modèles**

Créer `crm/v2/v2-rdv-modeles.js` :

```js
/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Modèles de mail de prise de rendez-vous (V2MOD)
   Trois motifs, six à huit lignes chacun. Aucune condition commerciale
   chiffrée : on parle des chiffres DU PHARMACIEN, jamais des nôtres.
   Fichier PUR : aucun DOM, aucun réseau.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  var STOP = '\n\n— Si vous ne souhaitez plus recevoir ces propositions, répondez STOP à ce mail.';

  function txt(v, repli) {
    if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return repli || '';
    return String(v);
  }
  function eur(n) {
    if (n == null || isNaN(n)) return '';
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
  }
  function salut(ctx) {
    var c = txt(ctx.contact);
    return 'Bonjour' + (c ? ' ' + c : '') + ',';
  }
  function signature(ctx) {
    var t = txt(ctx.tel_commercial);
    return '\n\nBien à vous,\n' + txt(ctx.prenom_commercial) + (t ? '\n' + t : '');
  }

  var MODELES = {
    bilan: {
      nom: 'Le bilan de son officine',
      description: 'Ses propres chiffres : ce qu’il fait avec nous, ce qu’il pourrait faire.',
      rendre: function (ctx) {
        var ca = eur(ctx.ca_annee), mq = eur(ctx.manque_a_gagne);
        var corps = salut(ctx) + '\n\n' +
          'J’ai repris le détail de ce que nous faisons ensemble' +
          (ca ? ' : ' + ca + ' cette année' : '') + '.' +
          (mq ? '\n\nEn regardant votre potentiel, je vois de la place pour aller chercher ' + mq +
                ' de plus, sans rien changer à vos habitudes de commande.'
              : '\n\nEn regardant votre potentiel, je vois de la place pour aller plus loin.') +
          '\n\nJe vous montre ça en quinze minutes ? Choisissez le moment qui vous arrange :\n' +
          txt(ctx.lien) + signature(ctx) + STOP;
        return { objet: 'Votre bilan · ' + txt(ctx.nom_officine, 'votre officine'), corps: corps };
      }
    },
    offre: {
      nom: 'La nouveauté du moment',
      description: 'Deux lignes de votre choix, réutilisées pour toute la liste.',
      rendre: function (ctx) {
        var corps = salut(ctx) + '\n\n' + txt(ctx.texte_libre, 'J’ai du nouveau à vous présenter.') +
          '\n\nJe passe prochainement dans votre secteur — dites-moi quand vous êtes disponible :\n' +
          txt(ctx.lien) + '\n\nÇa prend dix secondes.' + signature(ctx) + STOP;
        return { objet: 'Une nouveauté pour ' + txt(ctx.nom_officine, 'votre officine'), corps: corps };
      }
    },
    routine: {
      nom: 'La visite de routine',
      description: '« Ça fait X mois qu’on ne s’est pas vus. »',
      rendre: function (ctx) {
        var m = ctx.mois_derniere_visite;
        var corps = salut(ctx) + '\n\n' +
          (m ? 'Cela fait ' + m + ' mois que nous ne nous sommes pas vus, et j’aimerais faire le point avec vous.'
             : 'J’aimerais faire le point avec vous.') +
          '\n\nPlutôt que de vous appeler en plein rush, choisissez vous-même le moment :\n' +
          txt(ctx.lien) + '\n\nTrois créneaux vous seront proposés.' + signature(ctx) + STOP;
        return { objet: 'Un moment pour se voir ?', corps: corps };
      }
    }
  };

  M.liste = function () {
    return ['bilan', 'offre', 'routine'].map(function (k) {
      return { cle: k, nom: MODELES[k].nom, description: MODELES[k].description };
    });
  };

  M.rendre = function (cle, ctx) {
    var m = MODELES[cle] || MODELES.routine;
    return m.rendre(ctx || {});
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2MOD = M;
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent**

Run: `cd /Users/williammorel/JARVIS/APP && node --test tests/`
Expected: `# fail 0`.

Si le test « aucune condition commerciale chiffrée » échoue, corriger le **modèle**, jamais le test.

- [ ] **Step 5: Commit**

```bash
git add crm/v2/v2-rdv-modeles.js
git add tests/rdv-modeles.test.mjs
git commit -m "RDV : trois modeles de mail + tests (dont controle du vocabulaire pharma)"
```

---

### Task 9: Écran Campagne

**Files:**
- Create: `crm/v2/v2-campagne.js`
- Modify: `crm/v2/v2-rdv.js`
- Modify: `crm/v2/index.html`
- Modify: `crm/v2/v2-app.js`

**Interfaces:**
- Consumes: `V2MOD` (tâche 8), `V2.rdv.BASE_URL` (tâche 7), `V2.sb()`, la liste des officines, `V2.esc`, `V2.toast`.
- Produces: `V2.pages.campagne = { render: function (root) {…} }`, `V2.campagne.lancer()`, `V2.campagne.ouvrir()`, `V2.campagne.marquerEnvoye()`, `V2.campagne.passer()`, et dans `v2-rdv.js` la méthode `V2.rdv.preparerMail(officine, modele, texteLibre, callback)`.

- [ ] **Step 1: Relever comment la liste des officines et la dernière visite sont exposées**

Run:
```bash
cd /Users/williammorel/JARVIS/APP
grep -n "CLIENTS" crm/v2/*.js | head -10
grep -rn "prochaineVisite\|derniereVisite" crm/v2/*.js | head -10
```

Relever : le nom exact de la variable globale des officines du commercial, et le champ qui porte la date de dernière visite. Ces deux réponses conditionnent les filtres de l'étape 2. **Ne pas deviner** — si aucune globale n'existe, réutiliser le chargement que fait déjà `V2.pages.fiches`.

- [ ] **Step 2: Extraire la préparation du mail dans `v2-rdv.js`**

Dans `crm/v2/v2-rdv.js`, remplacer la méthode `proposer` par cette paire — `proposer` devient un appel à `preparerMail` avec le modèle `routine` :

```js
    preparerMail: function (o, modele, texteLibre, cb) {
      var fini = cb || function () {};
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi pour proposer un rendez-vous.'); fini(false); return; }
      if (!o || !o.email) { V2.toast('Cette officine n’a pas d’adresse mail.'); fini(false); return; }

      var coord = (o.lat != null && o.lon != null)
        ? Promise.resolve({ lat: o.lat, lon: o.lon })
        : geocode([o.adresse, o.cp, o.ville].filter(Boolean).join(' '));

      coord.then(function (ll) {
        return c.from('rdv_lien').insert({
          user_id: u, cip: o.cip || null, nom: o.nom, adresse: o.adresse || null,
          cp: o.cp || null, ville: o.ville || null,
          lat: ll ? ll.lat : null, lon: ll ? ll.lon : null,
          contact_nom: o.contact || null, modele: modele || 'routine'
        }).select('token').single();
      }).then(function (r) {
        if (r.error || !r.data) { V2.toast('Création du lien impossible.'); fini(false); return; }
        var m = window.V2MOD.rendre(modele || 'routine', {
          contact: o.contact, nom_officine: o.nom, ville: o.ville,
          ca_annee: o.ca_annee, potentiel_gx: o.potentiel_gx, manque_a_gagne: o.manque_a_gagne,
          mois_derniere_visite: o.mois_derniere_visite,
          prenom_commercial: prenom(), tel_commercial: (V2.user && V2.user.tel) || '',
          lien: V2.rdv.BASE_URL + '?t=' + r.data.token, texte_libre: texteLibre || ''
        });
        window.location.href = 'mailto:' + encodeURIComponent(o.email) +
          '?subject=' + encodeURIComponent(m.objet) + '&body=' + encodeURIComponent(m.corps);
        c.from('rdv_lien').update({ envoye_le: new Date().toISOString() })
          .eq('token', r.data.token).then(function () { fini(true); });
      }).catch(function () { V2.toast('Création du lien impossible.'); fini(false); });
    },

    proposer: function (o) { V2.rdv.preparerMail(o, 'routine', '', function () {}); },
```

⚠️ `preparerMail` attend les chiffres sous les noms `ca_annee`, `potentiel_gx`, `manque_a_gagne`, `mois_derniere_visite`. C'est à l'appelant (l'écran Campagne, étape 3) de faire la conversion depuis les noms réels relevés à l'étape 1 (`ca2023`, `potentielGx`, …).

Vérifier aussi que `V2.user.tel` existe ; sinon laisser la chaîne vide.

- [ ] **Step 3: Écrire l'écran Campagne**

Créer `crm/v2/v2-campagne.js` :

```js
/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Campagne de prise de RDV (pages.campagne)
   Trois étapes : le motif, la liste, puis la file d'attente d'envoi.
   Chaque mail part de la boîte du commercial : JARVIS le prépare, il
   relit et il envoie. C'est lui qui coche « envoyé ».
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  var ETAT = { modele: 'routine', texte: '', file: [], i: 0, envoyes: 0 };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }

  // ⚠️ Nom de la globale et champ de dernière visite : à confirmer à l'étape 1
  // de cette tâche avant d'écrire ces deux fonctions.
  function tousLesClients() { return (window.CLIENTS || []).slice(); }
  function moisDepuisVisite(c) {
    if (!c.prochaineVisite) return null;
    var d = new Date(c.prochaineVisite);
    if (isNaN(d.getTime())) return null;
    return Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }

  // Traduit une officine du CRM vers ce qu'attend V2.rdv.preparerMail.
  function versOfficine(c) {
    return {
      cip: c.cip, nom: c.nom, adresse: c.adresse, cp: c.cp, ville: c.ville,
      email: c.email, contact: c.contact || '', lat: c.lat, lon: c.lon,
      ca_annee: c.ca2023, potentiel_gx: c.potentielGx,
      manque_a_gagne: c.manqueAGagner, mois_derniere_visite: moisDepuisVisite(c)
    };
  }

  function filtrer(opts, opposes) {
    return tousLesClients().filter(function (c) {
      if (!c.email) return false;                                   // filtre obligatoire
      if (opposes.indexOf(String(c.cip)) !== -1) return false;       // ne plus solliciter
      if (opts.dept && String(c.cp || '').slice(0, 2) !== opts.dept) return false;
      if (opts.mois) {
        var m = moisDepuisVisite(c);
        if (m == null || m < opts.mois) return false;
      }
      return true;
    });
  }

  V2.campagne = {
    lancer: function () {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi pour lancer une campagne.'); return; }
      ETAT.modele = document.getElementById('cp-modele').value;
      ETAT.texte = (document.getElementById('cp-texte') || {}).value || '';
      var opts = {
        dept: (document.getElementById('cp-dept').value || '').trim(),
        mois: parseInt(document.getElementById('cp-mois').value, 10) || 0
      };
      c.from('rdv_opposition').select('cip').eq('user_id', u).then(function (r) {
        var opposes = ((r && r.data) || []).map(function (x) { return String(x.cip); });
        ETAT.file = filtrer(opts, opposes);
        ETAT.i = 0; ETAT.envoyes = 0;
        if (!ETAT.file.length) { V2.toast('Aucune officine ne correspond à ces filtres.'); return; }
        V2.campagne.afficherFile();
      });
    },

    afficherFile: function () {
      var root = document.getElementById('v2-root');
      if (ETAT.i >= ETAT.file.length) {
        root.innerHTML = '<div class="v2-page"><h1 class="v2-h1">Campagne terminée</h1>' +
          '<p class="v2-sub">' + ETAT.envoyes + ' mail(s) envoyé(s) sur ' + ETAT.file.length + '.</p>' +
          '<p><button class="v2-btn v2-btn-primary" style="min-height:48px" ' +
          'onclick="V2.go(\'rdv\')">Voir mes rendez-vous</button></p></div>';
        return;
      }
      var o = ETAT.file[ETAT.i];
      root.innerHTML = '<div class="v2-page">' +
        '<h1 class="v2-h1">' + (ETAT.i + 1) + ' / ' + ETAT.file.length + '</h1>' +
        '<div class="v2-card" style="padding:14px">' +
          '<div style="font-weight:600">' + esc(o.nom) + '</div>' +
          '<div class="v2-sub">' + esc(o.ville || '') + ' · ' + esc(o.email) + '</div></div>' +
        '<p style="margin-top:14px">' +
          '<button class="v2-btn v2-btn-primary" style="min-height:48px" onclick="V2.campagne.ouvrir()">Ouvrir le mail</button> ' +
          '<button class="v2-btn" style="min-height:48px" onclick="V2.campagne.passer()">Passer</button></p>' +
        '<p id="cp-apres" style="display:none;margin-top:10px">' +
          '<button class="v2-btn v2-btn-primary" style="min-height:48px" ' +
          'onclick="V2.campagne.marquerEnvoye()">Envoyé ✓ → suivant</button></p></div>';
    },

    ouvrir: function () {
      V2.rdv.preparerMail(versOfficine(ETAT.file[ETAT.i]), ETAT.modele, ETAT.texte, function (ok) {
        if (!ok) { V2.toast('Préparation impossible pour cette officine.'); return; }
        var e = document.getElementById('cp-apres');
        if (e) e.style.display = '';
      });
    },

    marquerEnvoye: function () { ETAT.envoyes++; ETAT.i++; V2.campagne.afficherFile(); },
    passer: function () { ETAT.i++; V2.campagne.afficherFile(); }
  };

  V2.pages.campagne = {
    render: function (root) {
      var mods = window.V2MOD.liste().map(function (m) {
        return '<option value="' + esc(m.cle) + '">' + esc(m.nom) + '</option>';
      }).join('');
      root.innerHTML = '<div class="v2-page">' +
        '<h1 class="v2-h1">Campagne de rendez-vous</h1>' +
        '<p class="v2-sub">Le mail part de ta boîte : tu relis, tu envoies.</p>' +
        '<div class="v2-card" style="padding:14px;margin-bottom:10px">' +
          '<label style="font-weight:600;display:block;margin-bottom:6px">Motif du mail</label>' +
          '<select id="cp-modele" style="font-size:16px;min-height:44px;width:100%">' + mods + '</select>' +
          '<label style="font-weight:600;display:block;margin:12px 0 6px">Texte libre (modèle « nouveauté » uniquement)</label>' +
          '<textarea id="cp-texte" rows="2" style="font-size:16px;width:100%" ' +
            'placeholder="Ex. La gamme diabète arrive en septembre."></textarea></div>' +
        '<div class="v2-card" style="padding:14px;margin-bottom:10px">' +
          '<label style="font-weight:600;display:block;margin-bottom:6px">Département (vide = tous)</label>' +
          '<input id="cp-dept" inputmode="numeric" maxlength="2" style="font-size:16px;min-height:44px;width:90px" />' +
          '<label style="font-weight:600;display:block;margin:12px 0 6px">Pas vues depuis au moins (mois, 0 = sans filtre)</label>' +
          '<input id="cp-mois" type="number" value="0" style="font-size:16px;min-height:44px;width:90px" /></div>' +
        '<p><button class="v2-btn v2-btn-primary" style="min-height:48px" ' +
          'onclick="V2.campagne.lancer()">Préparer la liste</button></p>' +
        '<p class="v2-sub">Les officines sans adresse mail et celles marquées « ne plus solliciter » ' +
          'sont exclues automatiquement.</p></div>';
    }
  };
})();
```

- [ ] **Step 4: Déclarer les scripts et ajouter la tuile**

Dans `crm/v2/index.html`, après `v2-rdv.js` :

```html
  <script src="v2-rdv-modeles.js?v=20260810a"></script>
  <script src="v2-campagne.js?v=20260810a"></script>
```

Dans `crm/v2/v2-app.js`, après la tuile `rdv` — même icône que celle vérifiée à la tâche 7 :

```js
      if (V2.pages.campagne) {
        P.push({ k: 'campagne', cls: 'p3', accent: '#0050E6', ico: 'spark', tag: 'Terrain', t: 'Campagne RDV',
                 d: 'Prépare une série de mails de prise de rendez-vous et envoie-les un par un depuis ta boîte.',
                 go: 'Lancer une campagne' });
      }
```

- [ ] **Step 5: Vérifier**

```bash
cd /Users/williammorel/JARVIS/APP
node --check crm/v2/v2-campagne.js
node --check crm/v2/v2-rdv.js
node --test tests/
grep -o '?v=[0-9a-z]*' crm/v2/index.html | sort -u
```

Puis à l'écran, fenêtre 390 px :
1. Ouvrir la page Campagne → le menu déroulant affiche les trois motifs.
2. Filtrer sur un département, « Préparer la liste » → le compteur `1 / N` s'affiche avec le nom d'une officine réelle.
3. « Ouvrir le mail » → la messagerie s'ouvre avec le bon motif. **Ne pas envoyer.**
4. « Envoyé ✓ → suivant » → passe à l'officine suivante.
5. « Passer » → saute sans compter comme envoyé.
6. Arriver au bout → écran « Campagne terminée » avec le décompte juste.

- [ ] **Step 6: Nettoyer les jetons créés pendant l'essai**

Relever les jetons créés puis supprimer **uniquement ceux-là**, par leur `token` :

```sql
select token, nom, cree_le from public.rdv_lien order by cree_le desc limit 10;
delete from public.rdv_lien where token in ('<T1>', '<T2>');
```

- [ ] **Step 7: Commit**

```bash
git add crm/v2/v2-campagne.js
git add crm/v2/v2-rdv.js
git add crm/v2/index.html
git add crm/v2/v2-app.js
git commit -m "RDV : ecran Campagne (motif, liste, file d envoi)"
```

---

### Task 10: Relances et « ne plus solliciter »

**Files:**
- Modify: `crm/v2/v2-rdv.js`

**Interfaces:**
- Consumes: `V2.rdv.BASE_URL` (tâche 7), la table `rdv_opposition` (tâche 1).
- Produces: `V2.rdv.relancer(token, nom, email)` et `V2.rdv.nePlusSolliciter(cip, nom)`.

- [ ] **Step 1: Ajouter les deux actions**

Dans `crm/v2/v2-rdv.js`, à l'intérieur de l'objet `V2.rdv`, ajouter :

```js
    // Relance : trois lignes, avec le MÊME lien (le jeton est encore valide).
    relancer: function (token, nom, email) {
      if (!email) { V2.toast('Pas d’adresse mail pour cette officine.'); return; }
      var corps = 'Bonjour,\n\n' +
        'Je me permets de revenir vers vous : le lien pour choisir un créneau est toujours actif.\n' +
        V2.rdv.BASE_URL + '?t=' + token + '\n\nBien à vous,\n' + prenom() +
        '\n\n— Si vous ne souhaitez plus recevoir ces propositions, répondez STOP à ce mail.';
      window.location.href = 'mailto:' + encodeURIComponent(email) +
        '?subject=' + encodeURIComponent('Petit rappel · ' + (nom || '')) +
        '&body=' + encodeURIComponent(corps);
    },

    nePlusSolliciter: function (cip, nom) {
      var c = sb(), u = uid();
      if (!c || !u || !cip) { V2.toast('Action impossible.'); return; }
      c.from('rdv_opposition').upsert({ user_id: u, cip: String(cip), motif: 'STOP' },
                                      { onConflict: 'user_id,cip' }).then(function (r) {
        V2.toast(r.error ? 'Enregistrement impossible.'
                         : (nom || 'Cette officine') + ' ne sera plus sollicitée.');
        V2.go('rdv');
      });
    },
```

- [ ] **Step 2: N'afficher « Sans réponse » qu'au-delà de 7 jours**

Dans `V2.pages.rdv.render`, remplacer la troisième promesse du `Promise.all` par :

```js
        c.from('rdv_lien').select('*').eq('user_id', u).is('consomme_le', null)
          .not('envoye_le', 'is', null)
          .lte('envoye_le', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
          .order('envoye_le', { ascending: false })
```

- [ ] **Step 3: Ajouter les boutons dans la section « Sans réponse »**

`rdv_lien` ne stocke pas l'adresse mail : on la retrouve par le CIP dans la liste des officines. Ajouter cette fonction juste avant le `map` de la section « Sans réponse » (adapter `window.CLIENTS` au nom relevé à la tâche 9, étape 1) :

```js
        function mailDe(cip) {
          var t = window.CLIENTS || [];
          for (var i = 0; i < t.length; i++) if (String(t[i].cip) === String(cip)) return t[i].email || '';
          return '';
        }
```

Puis remplacer le corps du `map` par :

```js
          var mail = mailDe(l.cip), n = String(l.nom).replace(/'/g, '');
          return '<div class="v2-card" style="padding:12px;margin-bottom:8px">' +
            '<div style="font-weight:600">' + esc(l.nom) + '</div>' +
            '<div class="v2-sub">envoyé le ' + esc(String(l.envoye_le).slice(0, 10)) + '</div>' +
            '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
              '<button class="v2-btn" style="min-height:44px" onclick="V2.rdv.relancer(\'' +
                esc(l.token) + '\',\'' + esc(n) + '\',\'' + esc(mail) + '\')">Relancer</button>' +
              '<button class="v2-btn v2-btn-ghost" style="min-height:44px" onclick="V2.rdv.nePlusSolliciter(\'' +
                esc(l.cip || '') + '\',\'' + esc(n) + '\')">Ne plus solliciter</button>' +
            '</div></div>';
```

- [ ] **Step 4: Vérifier**

```bash
cd /Users/williammorel/JARVIS/APP && node --check crm/v2/v2-rdv.js && node --test tests/
```

À l'écran : créer un jeton d'essai, forcer sa date d'envoi à il y a 10 jours, recharger la page Rendez-vous.

```sql
update public.rdv_lien set envoye_le = now() - interval '10 days' where token = '<TOKEN>';
```

Vérifier qu'il apparaît dans « Sans réponse » avec les deux boutons, cliquer « Relancer » (le mail s'ouvre — **ne pas envoyer**), puis « Ne plus solliciter » et contrôler en base :

```sql
select * from public.rdv_opposition where cip = '9999999';
```

Puis nettoyer, en ciblant uniquement le CIP d'essai :

```sql
delete from public.rdv_opposition where cip = '9999999';
delete from public.rdv_lien        where cip = '9999999';
```

- [ ] **Step 5: Commit**

```bash
git add crm/v2/v2-rdv.js
git commit -m "RDV : relances au-dela de 7 jours + ne plus solliciter"
```

---

### Task 11: Brancher la tournée existante

**Files:**
- Modify: `crm/v2/v2-rdv.js`
- Modify: `crm/v2/v2-tournee.js`

**Interfaces:**
- Consumes: `V2.pages.tournee` (fichier `crm/v2/v2-tournee.js`, déjà en place).
- Produces: `V2.rdv.tourneeDuJour(dateISO)`.

**Ce que le code de la tournée impose** (relevé dans `crm/v2/v2-tournee.js`) :
- Les arrêts sont des **indices dans `D.p`**, le tableau de `pharma-fr-data.js` — pas des objets `{lat, lon}`.
- Chaque point a la forme `[lat, lng, ugaIdx, grpIdx, segIdx, commIdx, nom, ville, cp, tel, titulaire, email, ca, id]` : `p[13]` est l'identifiant, `p[0]`/`p[1]` les coordonnées.
- La sélection automatique se fait ligne ~300 par `V2.tourneeSelect({…})`, **après** le géocodage de l'adresse de départ. Un point de départ reste donc obligatoire.
- `pharma-fr-data.js` est chargé en différé par `ensureData()` : la correspondance CIP → indice ne peut se faire qu'**après** ce chargement, donc à l'intérieur de `v2-tournee.js`, jamais dans `v2-rdv.js`.

- [ ] **Step 1: Passer la liste des CIP du jour**

Dans `V2.rdv`, ajouter — on ne transmet que des CIP, la résolution en indices appartient à la tournée :

```js
    // Reprend les RDV confirmés d'un jour et laisse la tournée existante
    // ordonner la route via OSRM. On ne passe que des CIP : c'est la tournée
    // qui les convertit en indices, une fois pharma-fr-data.js chargé.
    tourneeDuJour: function (dateISO) {
      var c = sb(), u = uid();
      if (!c || !u) return;
      c.from('rdv').select('cip,nom,date,heure').eq('user_id', u)
        .eq('statut', 'confirme').eq('date', dateISO).order('heure')
        .then(function (r) {
          var cips = ((r && r.data) || []).map(function (d) { return String(d.cip || ''); })
                       .filter(function (x) { return x; });
          if (!cips.length) { V2.toast('Aucun rendez-vous identifié ce jour-là.'); return; }
          V2.rdvCips = cips;          // consommé une seule fois par la tournée
          V2.go('tournee');
        });
    },
```

- [ ] **Step 2: Consommer cette liste dans la tournée**

Dans `crm/v2/v2-tournee.js`, remplacer le bloc `var idxs = V2.tourneeSelect({…}) || [];` (ligne ~300) par :

```js
        // Journée déjà fixée par des rendez-vous pris (V2.rdv.tourneeDuJour) :
        // on remplace la sélection automatique par ces officines-là, retrouvées
        // par leur identifiant dans D.p. Usage unique, pour qu'un retour
        // ultérieur sur la page rejoue bien la sélection normale.
        var idxs;
        if (V2.rdvCips && V2.rdvCips.length) {
          var voulus = {}, n;
          for (n = 0; n < V2.rdvCips.length; n++) voulus[String(V2.rdvCips[n])] = true;
          idxs = [];
          for (n = 0; n < D.p.length; n++) if (voulus[String(D.p[n][13])]) idxs.push(n);
          V2.rdvCips = null;
          if (!idxs.length) setMsg('ok', 'Ces officines ne sont pas dans la base nationale — sélection automatique.');
        }
        if (!idxs || !idxs.length) {
          idxs = V2.tourneeSelect({
            destLat: dest.lat, destLng: dest.lng,
            radiusKm: ST.radiusKm, maxStops: ST.maxStops,
            homeLat: home.lat, homeLng: home.lng
          }) || [];
        }
```

Le reste de la fonction (`idxs.filter(llOK)`, `orderStops`, `V2.osrmRoute`) ne change pas.

⚠️ Vérifier que `setMsg` est bien accessible à cet endroit du fichier ; sinon utiliser `V2.toast`.

- [ ] **Step 3: Ajouter le bouton dans la section « À venir »**

Dans `V2.pages.rdv.render`, remplacer la construction de la section « À venir » par un regroupement par jour :

```js
        var parJour = {};
        venir.forEach(function (d) { (parJour[d.date] = parJour[d.date] || []).push(d); });
        h += Object.keys(parJour).sort().map(function (date) {
          var lignes = parJour[date].map(function (d) {
            return '<div style="padding:6px 0">' +
              esc(String(d.heure).slice(0, 5).replace(':', 'h')) + ' · ' + esc(d.nom) +
              (d.ville ? ' · ' + esc(d.ville) : '') +
              ' <button class="v2-btn v2-btn-ghost" style="min-height:44px" onclick="V2.rdv.ics(\'' +
              esc(d.id) + '\')">agenda</button></div>';
          }).join('');
          return '<div class="v2-card" style="padding:12px;margin-bottom:8px">' +
            '<div style="font-weight:600">' + esc(libelle(date)) + '</div>' + lignes +
            (parJour[date].length > 1
              ? '<button class="v2-btn v2-btn-primary" style="min-height:44px;margin-top:8px" onclick="V2.rdv.tourneeDuJour(\'' +
                esc(date) + '\')">Composer ma tournée de ce jour</button>'
              : '') + '</div>';
        }).join('') || '<p class="v2-sub">Aucun rendez-vous pour l’instant.</p>';
```

- [ ] **Step 4: Vérifier**

```bash
cd /Users/williammorel/JARVIS/APP
node --check crm/v2/v2-rdv.js
node --check crm/v2/v2-tournee.js
node --test tests/
```

À l'écran : créer deux rendez-vous d'essai le même jour, avec les **CIP de deux vraies officines** présentes dans `pharma-fr-data.js` et distantes de quelques kilomètres (les relever dans la carte). Vérifier que :
1. Le bouton « Composer ma tournée de ce jour » apparaît sur le jour qui porte deux rendez-vous, et pas sur celui qui n'en porte qu'un.
2. La tournée s'ouvre, demande l'adresse de départ, puis affiche **exactement ces deux arrêts** — pas d'autres officines du secteur.
3. Revenir sur la tournée par le menu : la sélection automatique reprend la main (la liste a bien été consommée une seule fois).
4. Avec un CIP absent de la base nationale : message explicite et repli sur la sélection automatique, pas d'écran vide.

Capture des deux écrans.

Puis supprimer les deux rendez-vous d'essai **par leur identifiant**, jamais en masse.

- [ ] **Step 5: Contrôle avant mise en ligne**

Lancer le sous-agent `gardien-deploiement` sur le diff complet de la branche. Verdict GO obligatoire avant de pousser.

- [ ] **Step 6: Commit**

```bash
git add crm/v2/v2-rdv.js
git add crm/v2/v2-tournee.js
git commit -m "RDV : composer la tournee du jour depuis les rendez-vous pris"
```

---

## Mise en ligne (après le lot 1, puis après le lot 2)

- [ ] **Vérifier une dernière fois la cohérence du token de cache**

```bash
cd /Users/williammorel/JARVIS/APP
grep -o '?v=[0-9a-z]*' crm/v2/index.html | sort -u   # UNE seule valeur
grep -n "^var VER" crm/v2/sw.js                       # la même
node --test tests/                                    # 0 échec
```

- [ ] **Fusionner dans `main` et pousser**

```bash
git checkout main
git merge --no-ff feature/rdv-mailing -m "RDV par mailing cale sur la geographie"
git push origin main
```

Le message de commit ne doit **jamais** contenir `[skip ci]` : il bloquerait le déploiement en silence.

- [ ] **Attendre la mise en ligne réelle et le prouver**

```bash
cd /Users/williammorel/JARVIS/APP && bash scripts/attendre-prod.sh 20260810a
```

Un push réussi ne prouve rien. Tant que ce script n'a pas confirmé que la page servie porte le nouveau token, la livraison n'est pas faite.

- [ ] **Vérifier la page publique en ligne**

Ouvrir `https://willmorel49-coder.github.io/jarvis-app/crm/v2/rdv.html?t=<TOKEN>` avec un vrai jeton, depuis un téléphone ou une fenêtre de 390 px. Capture d'écran. C'est cette capture qui autorise à dire que c'est en ligne.

---

## Lot séparé : bascule vers `rdv.integralpharma.fr`

À faire quand quelqu'un chez Intégral aura la main sur les réglages du domaine. Les liens déjà envoyés continueront de fonctionner sur l'ancienne adresse.

1. Créer un fichier `CNAME` à la racine du dépôt contenant `rdv.integralpharma.fr`.
2. Faire ajouter chez l'hébergeur du domaine un enregistrement `CNAME` : `rdv` → `willmorel49-coder.github.io.`
3. Dans les réglages GitHub Pages du dépôt, renseigner le domaine et cocher « Enforce HTTPS ».
4. Changer **une seule ligne** : `V2.rdv.BASE_URL` dans `crm/v2/v2-rdv.js`.
5. Vérifier le cadenas et la page servie avant de dire que c'est fait.

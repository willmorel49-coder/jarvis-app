# JARVIS · Territoire + Agent — Design Spec

**Date** : 2026-05-25
**Statut** : Validé brainstorming, prêt pour implementation plan
**Périmètre** : CRM Intégral Pharma (`/crm/`). L'app OPSO Santé (`/opso/`) reste sur sa charte Normandie Pharma et n'est PAS touchée.

---

## §1 Vision

JARVIS n'est plus un CRM avec un menu à gauche. C'est **un copilote spatial** :
- La **carte de France** (centrée Manche/Bretagne aujourd'hui) est l'écran d'accueil.
- L'**orbe JARVIS** vit en bas, briefe, écoute, agit.
- Les features lourdes (catalogue, ventes, journal) s'ouvrent comme des **lentilles temporaires** par-dessus la carte, et se ferment d'un swipe down.

L'app fusionne avec l'écosystème Google déjà utilisé par Will : Google Maps (référencement des 517 pharmacies), Google Calendar (agenda commercial).

**Ce qu'on veut ressentir** : tu ouvres l'app le matin → tu vois ton territoire → JARVIS te dit ce qui t'attend → tu pars sur la route.
**Ce qu'on ne veut PAS** : un dashboard analytics SaaS générique avec sidebar à gauche.

## §2 Identité visuelle

**Mood** : Limpide (base Apple Maps) avec touches Glass (Vision Pro / iOS 17).

### Tokens (remplaçant DESIGN.md actuel)
```css
:root {
  /* Surface */
  --bg: #F7FAFF;        /* fond global lumineux */
  --surface: #FFFFFF;
  --surface-glass: rgba(255,255,255,.72);  /* sheets, lentilles */
  --surface-glass-strong: rgba(255,255,255,.88);
  --blur: 20px;          /* backdrop-filter standard */
  --blur-strong: 30px;   /* lentilles plein écran */

  /* Brand · Apple-blue + indigo signature */
  --blue: #007AFF;       /* primaire (était #0057FF — on s'aligne Apple system) */
  --indigo: #5856D6;     /* dégradé orb step 2 */
  --violet: #A855F7;     /* dégradé orb step 3 */
  --orb-gradient: conic-gradient(from 0deg, #007AFF, #5856D6, #A855F7, #007AFF);

  /* Statut pins */
  --pin-active: #007AFF;
  --pin-visited: #34C759;
  --pin-alert: #FF3B30;
  --pin-warm: #FF9F1C;
  --pin-prospect: #8E8E93;

  /* Texte (alignement SF system) */
  --text: #0B1F4D;
  --text-dim: #6B7A9F;
  --text-muted: #94A3B8;

  /* Bord */
  --border: rgba(11,31,77,.08);
  --border-glass: rgba(255,255,255,.6);

  /* Rayons */
  --r-sm: 10px;
  --r-md: 14px;
  --r-lg: 20px;     /* cards principales */
  --r-xl: 24px;     /* sheets, lentilles */
  --r-orb: 50%;
  --r-pill: 999px;

  /* Shadows douces bleues */
  --sh-card: 0 6px 20px rgba(11,31,77,.06);
  --sh-glass: 0 -10px 30px rgba(11,31,77,.06);
  --sh-orb: 0 0 0 4px rgba(0,122,255,.08), 0 4px 16px rgba(0,122,255,.25);
}
```

### Typographie
- **SF Pro Display** sur Apple devices, **Inter Display** en fallback : titres, KPIs, greetings (poids 600-800)
- **Inter** : body, tableaux, prompts (poids 400-600)
- **JetBrains Mono** : chiffres tabulaires dans tableaux et KPIs (`font-variant-numeric: tabular-nums`)
- Tailles :
  - `34px / 800 letter-spacing -.6px` titres écran (greeting "Manche · Sud")
  - `22px / 700` titres lentilles
  - `15px / 500` body
  - `11px / 700 uppercase letter-spacing 2px` labels signature ("JARVIS · MATINÉE")

### Motion language
- **Spring-based** (cubic-bezier `0.34, 1.56, 0.64, 1`) pour lentilles qui montent
- **Durée** : 350ms ouverture lentille, 250ms fermeture
- **Orb** : rotation continue 8s linear infinite + pulsation 2.5s ease-in-out infinite
- **Tap pin** : zoom carte 600ms ease-out, sheet morph 350ms spring
- **Respect** `prefers-reduced-motion` → désactive l'orb spin et les transitions

## §3 Architecture : Carte + Orb + 4 Lentilles + sheet Réglages

```
┌──────────────────────────────────────────┐
│  [Status bar iOS-like]                   │
│                                          │
│  Bonjour William                         │  ← Greeting Apple-style
│  Manche · Sud                            │
│  3 visites · 1 alerte                    │
│                                          │
│  ╔══════════════════════════════════╗    │
│  ║                                  ║    │
│  ║   Google Maps (Maps JS API)      ║    │  ← Le hub, toujours là
│  ║   Pins : pharmacies              ║    │
│  ║   Couleurs = statut              ║    │
│  ║   Cluster zoom out               ║    │
│  ║                                  ║    │
│  ╚══════════════════════════════════╝    │
│                                          │
│  ╭──────────────────────────────────╮    │
│  │  ━ (handle)                      │    │  ← Sheet JARVIS (glass)
│  │  ⬢ JARVIS · brief proactif       │    │
│  │  [   Demande à JARVIS…  ⬢  🎙  ] │    │  ← Prompt + orb + voix
│  ╰──────────────────────────────────╯    │
└──────────────────────────────────────────┘
       │
       │  swipe up sur sheet ou commande "catalogue"
       ▼
   Une lentille glisse plein écran par-dessus
   Swipe down → retour carte
```

**Vue d'ensemble** : 4 lentilles (Catalogue, Journal, RDV, Pilotage) + 1 sheet (Réglages). Une 5e surface est la **page publique de booking** (`/book/:user/:event_type`) — accessible sans auth, partagée par lien aux pharmaciens.

### Le hub (carte)
- **Google Maps JS API** comme moteur de carte (free credit $200/mo cover usage normal)
- **Pins custom** rendus en SVG ou Markers avancés Maps API :
  - Bleu plein (`--pin-active`) : pharmacie cliente active
  - Vert plein (`--pin-visited`) : visitée récemment (< 30j)
  - Orange (`--pin-warm`) : à relancer (> 90j)
  - Rouge pulsant (`--pin-alert`) : alerte prix critique (concurrent < achat IP)
  - Gris (`--pin-prospect`) : prospect non client
  - Pin "you" : position GPS de Will, blanc + cercle bleu intérieur
- **Cluster** quand zoom out (chiffre dans bulle bleue)
- **Tap pin** → carte zoom doucement sur la pharmacie, sheet se transforme en fiche pharmacie (header navy→blue, KPIs, dernières alertes, historique visites condensé, bouton "+ Visite")
- **Long-press pin** → menu rapide (Itinéraire Google Maps · Appeler · Email · Voir fiche)
- **Greeting** au-dessus de la carte : "Bonjour William · Manche · Sud · 3 visites · 1 alerte" (généré par JARVIS au matin)

### JARVIS Orb (présence permanente)
- **Forme** : cercle 36px (sheet) / 18px (prompt inline) / 88px (mode plein voix), `border-radius: 50%`
- **Background** : `conic-gradient(from 0deg, #007AFF, #5856D6, #A855F7, #007AFF)` + `radial-gradient` blanc top-left 30% pour effet lumière
- **États visuels** :
  - `idle` : rotation lente 8s + pulse subtile 2.5s
  - `thinking` : rotation rapide 2s + pulse vif
  - `listening` (voix) : pulse amplifié (scale 1 → 1.15) au rythme du volume audio (Web Audio API)
  - `speaking` : ondes concentriques émanent (animation halo)
- **Position** :
  - En bas du prompt (mini orb 18px)
  - Avatar des bubbles JARVIS dans la sheet (mini 18px)
  - Mode plein écran voix : centre, 88px, halo 3 anneaux
- **Halo** : un anneau extérieur en `conic-gradient` qui tourne en sens inverse + `filter: blur(8px)` pour effet luminescence

### Sheet JARVIS (toujours présente, bas d'écran)
- **Background** : `rgba(255,255,255,.72)` + `backdrop-filter: blur(20px)` + bordure `1px solid rgba(255,255,255,.6)`
- **Border-radius** : `24px 24px 0 0` (top corners)
- **Hauteurs** :
  - Compact (par défaut) : 110px — orb + 1 message + prompt
  - Étendue (drag up) : 60% écran — historique conversation + prompt
  - Pleine (drag up 2x) : 95% écran — passe en lentille Journal
- **Composants** :
  - Handle drag (`width: 32px; height: 4px; background: rgba(11,31,77,.15)`)
  - 1-3 messages JARVIS (badge orb mini + texte 12px, fond `rgba(0,122,255,.08)`)
  - Prompt bar : input rounded `--r-pill`, fond blanc, orb mini gauche, micro droite
- **Drag** : gesture handler vanilla JS (`touchmove` / `pointermove`)

### Les 4 lentilles
Toutes ont :
- Background `rgba(255,255,255,.88)` + `backdrop-filter: blur(30px)`
- Border-radius `24px 24px 0 0`
- Animation entrée : `translateY(100%) → 0` en 350ms spring
- Swipe down (`touchmove` Y > 100px ou `Escape`) → fermeture
- Header sticky : titre 22px + bouton fermeture top-right (X ou ⌃) + barre handle
- Footer optionnel sticky : actions contextuelles (filtres, export)

**Lentille 1 · Catalogue**
- Absorbe : Offilog (3520 produits), Benchmark IP (10500 lignes), Catalogue séparé, Alertes prix, Simulator
- Layout : recherche sticky top + segmented control [Produits · Benchmark · Alertes · Simulator] + grille/tableau selon onglet
- Grille produits : `pin-card` blanche, image 1:1, nom Inter 15/700, marque chip bleu soft, comparateur 5 lignes (IP / Offilog / Leclerc / Drakkars / Cap3000), best-price highlight vert, badge "ALERTE" rose si conc < achat IP
- Benchmark IP : tableau dense Inter, header sticky, sparkline 13 mois Ameli en SVG inline, virtual scroll
- Trigger JARVIS : "catalogue", "compare Dafalgan", "produits en alerte", "simule un panier"

**Lentille 2 · Journal**
- Absorbe : Fiche visite, Historique visites, Agenda, Prochaines visites
- Layout : timeline verticale type Cron/Notion Calendar
- Sections : Aujourd'hui · Cette semaine · Mois en cours · Historique
- Sync **Google Calendar** : événements de l'agenda Will (OAuth read+write) — créer un événement dans JARVIS → ajoute à GCal et inversement (lecture live + cache local)
- Fiche visite : form épuré (date, durée, pharmacie autocomplete via pins, produits abordés via catalogue, engagements textarea, prochaine visite date picker)
- Trigger JARVIS : "mes visites", "planifie demain matin", "résumé de la semaine", "fiche visite de la Phie Bocage"

**Lentille 3 · RDV (booking natif JARVIS)**
- Deux faces :
  - **Face commerciale** (interne, dans l'app) : tableau des bookings reçus + statut (confirmé / annulé / passé) + actions (replanifier, ajouter note), gestion des types d'événements (Visite découverte 30min, Point trimestriel 1h, Audit annuel 90min) avec durée, buffer, jours/heures dispo, lieu, description
  - **Face publique** (booking page sans auth, voir §4) : URL partageable type `https://willmorel49-coder.github.io/jarvis-app/book/will/visite-decouverte`, créneaux calculés depuis Google Calendar de Will avec respect des buffers et heures travaillées, formulaire pharmacien (nom, CIP officine, email, téléphone, message), confirmation écran + mail
- Intégration JARVIS :
  - À l'arrivée d'un booking : push notification soft (badge orb), JARVIS briefe "Phie Lefèvre a réservé pour mardi 10:30, je prépare l'argumentaire prix"
  - Suggestion intelligente côté pharmacien : JARVIS propose en priorité les créneaux qui optimisent la tournée (proches d'autres RDV déjà calés dans la même zone)
  - Réconciliation : le booking crée un événement GCal (custom property `jarvis_booking_id`) et un row Supabase `bookings`
- Trigger JARVIS : "mes RDV reçus", "partage mon lien Visite découverte", "qui a annulé cette semaine ?"

**Lentille 4 · Pilotage**
- Absorbe : WML ventes, Objectifs, Dashboard KPIs, Suivi commercial
- Layout : KPI grid hero (CA mois, vs objectif, top pharmacies, top produits) + bar chart 12 mois + table top pharmacies + table top produits
- Chart.js : palette `#007AFF` primaire, area soft `rgba(0,122,255,.12)`, gridlines très soft `rgba(11,31,77,.04)`, font 'Inter'
- Trigger JARVIS : "mon CA", "écart vs objectif", "top pharmacies du mois", "ventes WML mai"

**Sheet Réglages (pas une lentille)**
- Absorbe : Admin, Import data, Comptes, Sync Google
- Accès : tap sur l'orb mini en haut-gauche ou via "JARVIS, réglages"
- Sections : Profil (avatar, email Supabase), Synchronisations Google (Maps · Calendar, status synced), Import data (upload Excel WML, KML pharmacies), Comptes utilisateurs (admin only)
- N'est PAS accessible en commande JARVIS directe (pour rester un endroit "calme" qu'on visite peu)

## §4 Intégration Google ecosystem

### Google Maps JS API
- Embed via `<script async src="https://maps.googleapis.com/maps/api/js?key=...">`
- Clé API à provisionner par Will (Google Cloud Console, domain restriction `*.github.io`)
- Style personnalisé via `mapId` Cloud-based styling : style "Limpide" custom (gris doux, eau bleu pâle, roads blancs, POIs muets) qui matche la DA
- Markers : `google.maps.marker.AdvancedMarkerElement` avec SVG inline custom (pins JARVIS)
- MarkerClusterer pour les clusters
- Trafic et satellite : toggle via control custom en bas-droite

### Google Calendar (OAuth + sync)
- OAuth 2.0 client-side (PKCE flow) avec scope `https://www.googleapis.com/auth/calendar`
- Token stocké chiffré dans Supabase (table `user_oauth_tokens`)
- Lecture : tous les événements du calendar principal (filter par tag "Visite" si Will catégorise)
- Écriture : créer un événement quand une visite est planifiée dans JARVIS
- Sync incremental via `syncToken` Google API
- Réconciliation visites JARVIS ↔ événements GCal : match par titre + date OR via custom property `jarvis_visit_id`

### Booking JARVIS (page publique)
- Route : `/book/:user/:event_type` (statique HTML + JS) hébergée sur GitHub Pages
- Aucune auth requise pour le pharmacien
- Chargement :
  - Lit la config event type depuis Supabase (durée, buffer, jours/heures dispo, lieu, description)
  - Lit la free/busy de Will via Google Calendar API (endpoint `freeBusy.query` — utilise un service account ou la session OAuth de Will via Supabase Edge Function pour ne pas exposer la clé)
  - Calcule les créneaux disponibles côté client (avec respect buffer, lunch break, jours off)
- Affichage : style JARVIS bout en bout (orb visible, Limpide + Glass), calendrier mois + slots du jour sélectionné, formulaire (nom, CIP officine optionnel, email, tel, message), bouton "Confirmer ↵"
- Confirmation :
  - Row `bookings` créé en Supabase (`user_id`, `event_type`, `slot_start`, `slot_end`, `pharmacy_cip`, `lead_name`, `lead_email`, `lead_phone`, `notes`, `status='confirmed'`)
  - Event ajouté au Google Calendar de Will (via Edge Function avec son refresh token)
  - Email de confirmation envoyé via **Resend** (free tier 3000 mails/mois) au pharmacien + au commercial
  - Écran de confirmation animé (orb + tagline "JARVIS · vous êtes calé pour mardi 10:30")
- Anti-abuse :
  - Rate limit côté Edge Function (max 5 bookings par email / 24h)
  - Honeypot champ caché dans le form
  - Optionnel : Captcha Cloudflare Turnstile (gratuit) si abuse constaté
- Annulation : lien dans le mail de confirmation, page `/book/cancel/:token` → met le row Supabase en `status='canceled'`, supprime l'event GCal, mail au commercial

### Import KML / Google Maps "Mes lieux"
- Will exporte ses adresses depuis Google Takeout (Maps · Mes lieux · KML)
- Upload du KML dans Réglages → parse côté client (DOMParser)
- Match avec `clients-data.js` existants par adresse normalisée + CP
- Création des pharmacies manquantes
- Update des coordonnées GPS de toutes les pharmacies depuis le KML
- Setup unique au départ, puis Will gère côté JARVIS

## §5 Migration depuis CRM actuel

### Ce qui meurt (suppression)
- Sidebar gauche (`.sidebar`, `.nav-item`, navigation entre pages)
- Topbar avec recherche globale (la sheet JARVIS absorbe la recherche)
- Splash login custom (devient l'écran d'accueil avec orb pulsant pendant auth)
- Onglet Dashboard standalone (KPIs migrent dans Pilotage + greeting JARVIS)
- Onglet Clients dédié (517 pharmacies = pins sur carte)
- Onglet Catalogue séparé (fusionné dans Lentille Catalogue)
- Onglet Groupements (devient un filtre/coloration pins)
- Onglet Prospects (pins gris sur carte)
- Onglet Prioritaires (généré dynamiquement par JARVIS)
- Modale fiche pharmacie actuelle (remplacée par sheet bottom morphée depuis tap pin)
- `crm/styles-pharmacies.css`, `crm/styles-offilog.css` (refondés ou supprimés)
- Tout résidu DA Normandie Pharma (déjà nettoyé en commits précédents)

### Ce qui reste (conservation)
- `crm/app.js` data layer (Supabase auth, clients data, offilog data flow, benchmark data)
- Tous les `*-data.js` (clients, benchmark, offilog, drakkars, cap3000, groupements)
- Schema Supabase + bucket Storage
- Scrapers Python (zéro changement)
- Auth Supabase (compte `demo@integralpharma.fr`)
- Chart.js + SheetJS (CDN, on garde)

### Plan de migration
1. **Phase 1 · Shell + Carte** : nouveau `crm/index.html`, nouveau `crm/style.css` (tokens), Maps JS API intégrée, pins basiques rendus depuis `clients-data.js`, sheet bottom statique, orb idle. Plus de sidebar.
2. **Phase 2 · Orb + Sheet interactive** : prompt fonctionnel (text-only au début), greeting JARVIS au matin, brief proactif règle-based (pas LLM tout de suite), animations orb
3. **Phase 3 · Lentille Journal** : Google Calendar OAuth, lecture événements, fiche visite migrée. Drag de sheet vers le haut = ouvre Journal.
4. **Phase 4 · Lentille Catalogue** : migration Offilog + Benchmark + Alertes, virtual scroll, comparateur prix
5. **Phase 5 · Lentille RDV (interne)** : table `bookings` Supabase, gestion event types, vue côté commercial (interne app)
6. **Phase 6 · Page booking publique** : route `/book/:user/:event_type`, free/busy GCal, formulaire, Resend mail confirmation, écran orb
7. **Phase 7 · Lentille Pilotage** : KPIs CA, ventes WML, objectifs, charts
8. **Phase 8 · IA réelle** : connecter LLM (Anthropic Claude API) pour les commandes en langage naturel + briefing intelligent
9. **Phase 9 · Mode voix** : Web Speech API (reconnaissance + synthèse), mode CarPlay-friendly
10. **Phase 10 · Import KML** : workflow upload + matching pharmacies depuis Google Maps "Mes lieux"

Chaque phase = un dispatch d'agents et un commit déployable. Pas de big bang.

## §6 Stack technique

- **Frontend** : Vanilla JS (zéro framework, zéro build) — préservation philosophie ROBOT.md
- **Carte** : Google Maps JS API
- **Calendar** : Google Calendar API v3, OAuth 2.0 PKCE flow
- **IA** : Anthropic Claude API (`claude-sonnet-4-6` pour réponses, `claude-haiku-4-5` pour intents rapides). Clé API stockée en variable env Supabase Edge Function (pas en clair côté client)
- **Voix** : Web Speech API (`SpeechRecognition` + `SpeechSynthesis`)
- **Auth + DB** : Supabase (inchangé) + nouvelles tables : `bookings`, `event_types`, `user_oauth_tokens`
- **Mail transactionnel** : Resend API (free tier 3000 mails/mois) pour confirmations de booking
- **Edge Functions Supabase** : (1) proxy Claude API, (2) freeBusy GCal pour la page booking, (3) création/suppression event GCal, (4) envoi mails Resend
- **Hosting** : GitHub Pages (inchangé, push main = déploiement)
- **Fonts** : Google Fonts (Inter Display + Inter + JetBrains Mono) + fallback SF Pro système Apple

## §7 Out of scope (explicitement)

- **Pas de PWA installable** sur ce sprint (l'app reste web). Plus tard possible si Will veut.
- **Pas de mode offline complet**. Le KML local et le cache Supabase suffisent.
- **Pas de version desktop optimisée**. Mobile-first 430px, le desktop sera responsive ("centered phone-view" sur grand écran).
- **Pas de notifications push**. Le briefing JARVIS au matin = à l'ouverture de l'app.
- **Pas de multi-utilisateurs avec rôles fins** au-delà de l'existant Supabase (1 compte admin pour MVP).
- **Pas de refonte de l'app OPSO** (`/opso/` reste sur sa charte Normandie Pharma).

## §8 Anti-objectifs (ce qu'on évite explicitement)

- Sidebar à gauche → JAMAIS (c'est le "Claude template" que Will rejette)
- Bottom nav style native tab bar → NON (recrée une nav cachée)
- Onglets en haut → NON
- KPI dashboard plein écran → NON (KPIs naissent dans une lentille ou dans un brief JARVIS)
- Pop-ups modaux empilés → NON (sheet + lentilles sont la seule profondeur)
- Splash screen marketing → NON (l'app ouvre directement sur la carte, l'auth happens in-place)
- Tooltips/onboarding intrusifs → NON (l'app se comprend par l'usage, JARVIS guide à la demande)

## §9 Critères de succès

L'écran de l'app, ouvert sur n'importe quel device, est **immédiatement reconnaissable comme JARVIS** :
- L'orb visible et vivant
- La carte de France avec pins colorés JARVIS
- La sheet glass au fond
- Aucun chrome de navigation traditionnel
- Typo Inter Display / SF Pro

Un commercial qui le voit pour la première fois pense : *"c'est quoi cette app, je veux la même"*. Pas : *"ah, encore un CRM"*.

---

## Décisions liées (carnet)

| Question | Choix | Date |
|---|---|---|
| Métaphore d'app | Territoire + Agent (B + D) | 2026-05-25 |
| Profondeur Google Maps | C — Fusion totale (API + KML + Calendar) | 2026-05-25 |
| Architecture features non-spatiales | B — Lentilles | 2026-05-25 |
| Mood visuel | Limpide ++ avec touches Glass + | 2026-05-25 |
| Présence JARVIS | B — Orb gradient conic | 2026-05-25 |
| Nombre de lentilles | 4 (Catalogue · Journal · RDV · Pilotage) + sheet Réglages | 2026-05-25 |
| Booking RDV | B — Natif JARVIS (page publique stylée + Supabase + Resend) | 2026-05-25 |

## Références d'inspiration

- **Apple Maps** — pour la carte, le sheet drag, les pins
- **Things 3 / Cron Calendar** — pour le greeting calme et le typage
- **iOS 17 / visionOS** — pour le glass, la blur, la profondeur
- **Linear / Raycast** — pour la barre commande JARVIS (⌘K pattern)
- **Siri orb / Apple Intelligence shimmer** — base de l'orb JARVIS (notre version est gradient conic statique d'identité)
- **Granola** — pour l'inspiration "AI-native qui ne ressemble pas à un chatbot"

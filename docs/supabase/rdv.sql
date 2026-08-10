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
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

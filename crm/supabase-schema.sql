-- ═══════════════════════════════════════════════
-- INTÉGRAL PHARMA CRM — Supabase Schema V2
-- ═══════════════════════════════════════════════

-- 1. Profils utilisateurs (liés à Supabase Auth)
create table if not exists user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  role         text not null check (role in ('admin', 'manager', 'commercial')),
  pharmacy_ids uuid[] default null
);

-- 2. Pharmacies
create table if not exists pharmacies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null,
  color      text not null,
  created_at timestamptz default now()
);

-- 3. Imports
create table if not exists imports (
  id           uuid primary key default gen_random_uuid(),
  pharmacy_id  uuid references pharmacies(id) on delete cascade,
  month        int,
  year         int,
  filename     text not null,
  imported_at  timestamptz default now(),
  imported_by  uuid references auth.users(id),
  file_path    text
);

-- Ajout colonne file_path si migration depuis schema précédent
alter table imports add column if not exists file_path text;

-- 4. Ventes
create table if not exists sales (
  id              uuid primary key default gen_random_uuid(),
  import_id       uuid references imports(id) on delete cascade,
  pharmacy_id     uuid references pharmacies(id) on delete cascade,
  month           int,
  year            int,
  art_designation text,
  art_code        text,
  art_id          text,
  art_famille     text,
  qte             decimal(12,4) default 0,
  pu_brut         decimal(12,4) default 0,
  pu_net          decimal(12,4) default 0,
  mnt_net_ht      decimal(12,4) default 0
);

-- Migration : ajouter art_famille si absente (installations existantes)
alter table sales add column if not exists art_famille text;

-- ── ROW LEVEL SECURITY ────────────────────────

alter table user_profiles enable row level security;
alter table pharmacies     enable row level security;
alter table imports        enable row level security;
alter table sales          enable row level security;

-- user_profiles : chaque user voit uniquement son propre profil
create policy "own_profile_select" on user_profiles
  for select using (auth.uid() = id);

-- pharmacies : tout utilisateur authentifié peut lire/écrire/supprimer
create policy "auth_select" on pharmacies for select using (auth.role() = 'authenticated');
create policy "auth_insert" on pharmacies for insert with check (auth.role() = 'authenticated');
create policy "auth_delete" on pharmacies for delete using (auth.role() = 'authenticated');

-- imports : tout utilisateur authentifié peut lire/écrire/supprimer
create policy "auth_select" on imports for select using (auth.role() = 'authenticated');
create policy "auth_insert" on imports for insert with check (auth.role() = 'authenticated');
create policy "auth_delete" on imports for delete using (auth.role() = 'authenticated');

-- sales : tout utilisateur authentifié peut lire/écrire/supprimer
create policy "auth_select" on sales for select using (auth.role() = 'authenticated');
create policy "auth_insert" on sales for insert with check (auth.role() = 'authenticated');
create policy "auth_delete" on sales for delete using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════
-- 5. Marketing sheets (fiches commerciales IP)
-- ═══════════════════════════════════════════════
create table if not exists marketing_sheets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  theme text,
  color text,
  footer text,
  template text default 'offre',
  products jsonb default '[]'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_marketing_sheets_user on marketing_sheets(created_by);

alter table marketing_sheets enable row level security;

-- L'utilisateur authentifié peut tout lire/écrire SES fiches
create policy "user reads own sheets" on marketing_sheets
  for select using (auth.uid() = created_by);
create policy "user inserts own sheets" on marketing_sheets
  for insert with check (auth.uid() = created_by);
create policy "user updates own sheets" on marketing_sheets
  for update using (auth.uid() = created_by);
create policy "user deletes own sheets" on marketing_sheets
  for delete using (auth.uid() = created_by);

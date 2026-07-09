-- ═══════════════════════════════════════════════════════════════════
-- JARVIS CRM — Coin notes + Remontées équipe (partage entre commerciaux)
-- À coller dans Supabase → SQL Editor (projet iyvavhnlhxksokkerkos) → Run.
-- Tant que ces tables n'existent pas, l'app fonctionne en localStorage
-- (par appareil). Dès que ce SQL est passé, tout devient PARTAGÉ.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. COIN NOTES (fiches client + groupements) ──────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  scope_type  text not null check (scope_type in ('client','groupement')),
  scope_id    text not null,            -- pharmacyId (client) ou nom du groupement
  author_id   uuid not null references auth.users(id) on delete cascade,
  author_name text not null,            -- nom du commercial (affichage rapide)
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists notes_scope_idx on public.notes (scope_type, scope_id, created_at desc);

alter table public.notes enable row level security;

create policy notes_select on public.notes
  for select to authenticated using (true);                       -- toute l'équipe lit
create policy notes_insert on public.notes
  for insert to authenticated with check (author_id = auth.uid()); -- on écrit en son nom
create policy notes_delete on public.notes
  for delete to authenticated using (author_id = auth.uid());      -- on ne supprime que les siennes

-- ── 2. REMONTÉES / AMÉLIORATIONS ÉQUIPE ──────────────────────────────
create table if not exists public.improvements (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references auth.users(id) on delete set null,
  author_name text not null default '',
  body        text not null,
  status      text not null default 'nouveau' check (status in ('nouveau','en cours','fait')),
  votes       int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists improvements_created_idx on public.improvements (created_at desc);

alter table public.improvements enable row level security;

create policy improvements_select on public.improvements
  for select to authenticated using (true);
create policy improvements_insert on public.improvements
  for insert to authenticated with check (author_id = auth.uid());
create policy improvements_update on public.improvements
  for update to authenticated using (true) with check (true);      -- statut/vote par l'équipe
create policy improvements_delete on public.improvements
  for delete to authenticated using (author_id = auth.uid());

-- vote atomique (évite les collisions), appelé via rpc('increment_improvement_votes')
create or replace function public.increment_improvement_votes(imp_id uuid)
  returns int language sql security definer set search_path = public as $$
    update public.improvements set votes = votes + 1 where id = imp_id returning votes;
  $$;
grant execute on function public.increment_improvement_votes(uuid) to authenticated;

-- ── 3. PROFIL COMMERCIAL (grossistes / génériqueurs / LGO / robot…) ──
-- 1 ligne par fiche (client ou groupement), champs libres en jsonb.
create table if not exists public.profils (
  id              uuid primary key default gen_random_uuid(),
  scope_type      text not null check (scope_type in ('client','groupement')),
  scope_id        text not null,
  data            jsonb not null default '{}'::jsonb,   -- {gros1,gros2,gen1,gen2,lgo,robot,autre,…}
  updated_by      uuid references auth.users(id) on delete set null,
  updated_by_name text not null default '',
  updated_at      timestamptz not null default now(),
  unique (scope_type, scope_id)
);

alter table public.profils enable row level security;

create policy profils_select on public.profils
  for select to authenticated using (true);                     -- toute l'équipe lit
create policy profils_upsert_ins on public.profils
  for insert to authenticated with check (true);                -- toute l'équipe complète
create policy profils_upsert_upd on public.profils
  for update to authenticated using (true) with check (true);   -- et met à jour

-- ── 4. DROITS D'ACCÈS (indispensable) ────────────────────────────────
-- La RLS autorise les LIGNES, mais PostgreSQL exige aussi un GRANT au niveau
-- table. Sur ce projet les privilèges par défaut ne le font pas → sans ces
-- GRANT, un utilisateur connecté reçoit « permission denied for table » (42501).
grant select, insert, update, delete on public.notes        to authenticated;
grant select, insert, update, delete on public.improvements to authenticated;
grant select, insert, update, delete on public.profils      to authenticated;

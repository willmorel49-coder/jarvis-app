-- ═══════════════════════════════════════════════════════════════════
-- JARVIS CRM — Dernière visite (passage terrain sur une pharmacie)
-- À coller dans Supabase → SQL Editor (projet iyvavhnlhxksokkerkos) → Run.
-- Tant que cette table n'existe pas, l'app fonctionne en localStorage
-- (par appareil). Dès que ce SQL est passé, les visites deviennent PARTAGÉES.
-- ═══════════════════════════════════════════════════════════════════

-- ── VISITES (1 ligne par passage) ────────────────────────────────────
create table if not exists public.visites (
  id          uuid primary key default gen_random_uuid(),
  pharmacy_id text not null,                 -- id de la pharmacie (p[13] / clients-data)
  user_id     uuid,                          -- commercial (auth.users.id)
  visited_at  date not null default current_date,
  created_at  timestamptz default now()
);
create index if not exists visites_pharmacy_idx on public.visites (pharmacy_id);

alter table public.visites enable row level security;

create policy visites_select on public.visites
  for select to authenticated using (true);                        -- toute l'équipe lit
create policy visites_insert on public.visites
  for insert to authenticated with check (true);                   -- chacun enregistre ses passages

-- ── DROITS D'ACCÈS (indispensable) ───────────────────────────────────
-- La RLS autorise les LIGNES, mais PostgreSQL exige aussi un GRANT au niveau
-- table, sinon « permission denied for table » (42501).
grant select, insert, update, delete on public.visites to authenticated;

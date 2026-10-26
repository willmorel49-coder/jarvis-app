-- 26/10/2026 — mode « Prospection » de La carte (crm/v2/v2-carte-prospection.js) : Will SEUL.
-- Will : « un VRAI outil de prospection dans JARVIS, sur la carte, pour lui seul (il est le testeur) ».
-- Les tournées (tracés, clientes et leurs positions) ne sont NI dans le dépôt (public) NI dans un fichier servi :
-- elles vivent dans prospection_tournees, table SANS aucun droit pour anon/authenticated, que seule la fonction
-- jarvis_prospection_donnees() lit (security definer) — et elle ne répond que si jarvis_acces_prospection() dit oui.
-- Le DÉPÔT DES DONNÉES n'est pas ici : fichier daté hors dépôt (~/prospection-tournees/sql/…-donnees.sql).
-- Aucun claude-test dans la liste : un compte autre que Will doit recevoir « non » et null (preuve de verrou).
-- « Mail envoyé » et « relance » : table PRIVÉE (RLS propriétaire ET accès), aucun DELETE (on remet la date à null).
-- ⚠️ grant explicite sur la table de suivi : sans lui, 403 silencieux malgré la politique.
-- Rejouable.

create or replace function public.jarvis_acces_prospection()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'william.morel@me.com')
$$;
revoke all on function public.jarvis_acces_prospection() from public, anon;
grant execute on function public.jarvis_acces_prospection() to authenticated;

create table if not exists public.prospection_tournees (
  id      text primary key default 'courant',
  donnees jsonb not null,
  maj     timestamptz not null default now()
);
alter table public.prospection_tournees enable row level security;
revoke all on public.prospection_tournees from public, anon, authenticated;
-- (aucune politique : personne ne la lit en direct, seule la fonction ci-dessous passe)

create or replace function public.jarvis_prospection_donnees()
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select case when public.jarvis_acces_prospection()
              then (select t.donnees from public.prospection_tournees t where t.id = 'courant')
              else null end
$$;
revoke all on function public.jarvis_prospection_donnees() from public, anon;
grant execute on function public.jarvis_prospection_donnees() to authenticated;

create table if not exists public.prospection_suivi (
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cip            text not null,
  mail_envoye_le date,
  relance_le     date,
  maj            timestamptz not null default now(),
  primary key (user_id, cip)
);
alter table public.prospection_suivi enable row level security;
revoke all on public.prospection_suivi from public, anon;
grant select, insert, update on public.prospection_suivi to authenticated;

drop policy if exists prospection_suivi_select on public.prospection_suivi;
create policy prospection_suivi_select on public.prospection_suivi
  for select to authenticated
  using (user_id = auth.uid() and public.jarvis_acces_prospection());

drop policy if exists prospection_suivi_insert on public.prospection_suivi;
create policy prospection_suivi_insert on public.prospection_suivi
  for insert to authenticated
  with check (user_id = auth.uid() and public.jarvis_acces_prospection());

drop policy if exists prospection_suivi_update on public.prospection_suivi;
create policy prospection_suivi_update on public.prospection_suivi
  for update to authenticated
  using (user_id = auth.uid() and public.jarvis_acces_prospection())
  with check (user_id = auth.uid() and public.jarvis_acces_prospection());
-- Aucune politique ni droit DELETE, volontairement.

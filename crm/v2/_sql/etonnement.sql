-- 02/10/2026 — Rapport d'étonnement (crm/v2/v2-etonnement.js).
-- Will : « un outil que pour moi » pour consigner, question par question, ce que
-- ses collègues lui disent de l'app en entretien. Ce sont des propos tenus en
-- confiance : la table ne se lit et ne s'écrit QUE par son propriétaire, et
-- seuls les comptes de jarvis_acces_etonnement() peuvent en être propriétaires.
-- claude-test reste autorisé : c'est le compte des preuves, banni hors des
-- contrôles — et il ne voit que SES lignes, jamais celles de Will.
-- Rejouable. Aucune politique de suppression : on archive (colonne `archive`).

create or replace function public.jarvis_acces_etonnement()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) in ('william.morel@me.com',
                             'claude-test@integralpharma.fr'))
$$;
revoke all on function public.jarvis_acces_etonnement() from public, anon;
grant execute on function public.jarvis_acces_etonnement() to authenticated;

create table if not exists public.etonnement_entretiens (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type           text not null default 'entretien' check (type in ('entretien','guide')),
  personne       text not null default '',
  fonction       text not null default '',
  date_entretien date,
  statut         text not null default 'en cours' check (statut in ('en cours','termine')),
  reponses       jsonb not null default '{}'::jsonb,   -- { idQuestion: { t, imp, n } }
  archive        boolean not null default false,
  cree_le        timestamptz not null default now(),
  maj            timestamptz not null default now()
);
create index if not exists etonnement_owner_idx on public.etonnement_entretiens (owner_id, archive);

alter table public.etonnement_entretiens enable row level security;

drop policy if exists etonnement_select on public.etonnement_entretiens;
create policy etonnement_select on public.etonnement_entretiens
  for select to authenticated
  using (owner_id = auth.uid() and public.jarvis_acces_etonnement());

drop policy if exists etonnement_insert on public.etonnement_entretiens;
create policy etonnement_insert on public.etonnement_entretiens
  for insert to authenticated
  with check (owner_id = auth.uid() and public.jarvis_acces_etonnement());

drop policy if exists etonnement_update on public.etonnement_entretiens;
create policy etonnement_update on public.etonnement_entretiens
  for update to authenticated
  using (owner_id = auth.uid() and public.jarvis_acces_etonnement())
  with check (owner_id = auth.uid() and public.jarvis_acces_etonnement());

-- ⚠️ Une table créée en SQL brut ne reçoit AUCUN droit : sans ces lignes,
-- PostgREST répond 403 malgré des politiques justes. Pas de `delete`.
revoke all on table public.etonnement_entretiens from anon;
grant select, insert, update on table public.etonnement_entretiens to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Rattachements validés à la main (14/08/2026)
--
-- Le commercial écrit dans son agenda « Phie des javobins Le Mans » ;
-- le fichier dit « PHARMACIE DES JACOBINS ». JARVIS ne peut pas deviner.
-- Il lui demande une fois, et retient la correspondance ici.
--
-- ⚠️ Ce qui entre dans cette table : UNIQUEMENT un titre que le commercial
-- a lui-même désigné comme une officine. Les titres qu'il n'a pas
-- rattachés — médecin, famille, réunion — ne sont écrits nulle part.
-- C'est la seule exception à la règle « aucun titre en base », et elle
-- est consentie ligne par ligne.
--
-- La clé est le SEGMENT normalisé, pas le titre brut : « Appeler phie du
-- lys » et « Phie du lys » donnent tous deux « DU LYS » et se
-- reconnaissent l'un l'autre.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rdv_agenda_alias (
  id        bigserial primary key,
  user_id   uuid not null references auth.users(id) on delete restrict,
  cle       text not null,
  cip       text not null,
  archive   boolean not null default false,
  cree_le   timestamptz not null default now(),
  constraint rdv_alias_cle_len check (char_length(cle) between 1 and 200),
  constraint rdv_alias_cip_len check (char_length(cip) between 1 and 20)
);

-- Un seul rattachement vivant par clé et par commercial. Reposer le même
-- rattachement met à jour au lieu de dupliquer.
create unique index if not exists rdv_alias_unique
  on public.rdv_agenda_alias (user_id, cle) where (archive = false);

alter table public.rdv_agenda_alias enable row level security;

-- ⚠️ Une policy RLS SANS grant ne sert à rien : PostgREST répond 403 et
-- l'app bascule en silence sur un repli. Piège déjà payé sur ce projet.
revoke all on public.rdv_agenda_alias from anon, authenticated;
grant select, insert, update on public.rdv_agenda_alias to authenticated;
grant usage, select on sequence public.rdv_agenda_alias_id_seq to authenticated;

drop policy if exists rdv_alias_sien on public.rdv_agenda_alias;
create policy rdv_alias_sien on public.rdv_agenda_alias
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ⚠️ Pas de DELETE accordé : défaire un rattachement l'archive. Le hook
-- garde-donnees.py bloque les suppressions sur les tables de production.

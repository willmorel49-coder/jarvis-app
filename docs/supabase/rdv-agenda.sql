-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Agenda connecté, un par commercial (11/08/2026)
--
-- L'adresse secrète d'un agenda donne accès à TOUTE la vie privée de son
-- propriétaire : rendez-vous médicaux, familiaux, entretiens. Elle est donc
-- traitée comme un mot de passe :
--   · le commercial peut l'ÉCRIRE, jamais la RELIRE (privilège par colonne) ;
--   · aucun autre commercial ne voit quoi que ce soit de sa ligne ;
--   · seule la fonction serveur, avec la clé de service, peut la lire.
--
-- Et ce qu'on retient de son agenda se limite à « occupé de telle heure à
-- telle heure ». Aucun titre, aucun lieu, aucun participant : il n'existe
-- aucune colonne pour les écrire, donc la promesse ne peut pas être trahie.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rdv_agenda (
  user_id        uuid primary key references auth.users(id) on delete restrict,
  url            text not null,                    -- jamais relisible par le navigateur
  hote           text,                             -- « calendar.google.com » : affichable, lui
  actif          boolean not null default true,
  dernier_essai  timestamptz,
  dernier_ok     timestamptz,
  derniere_erreur text,
  evenements_lus int,
  plages_gardees int,
  maj_le         timestamptz not null default now(),
  constraint rdv_agenda_url_len  check (char_length(url) between 20 and 2000),
  constraint rdv_agenda_url_https check (url like 'https://%')
);

-- Les plages occupées relevées dans l'agenda extérieur.
-- Remplacées à chaque relève : on ne garde pas d'historique de la vie privée.
create table if not exists public.rdv_occupe (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete restrict,
  date        date not null,
  debut       time not null,
  fin         time not null,
  jour_entier boolean not null default false,
  releve_le   timestamptz not null default now()
);
create index if not exists rdv_occupe_user_date on public.rdv_occupe (user_id, date);

alter table public.rdv_agenda enable row level security;
alter table public.rdv_occupe enable row level security;

-- ───────────────────────────────────────────────────────────────
-- Droits. Rappel du piège déjà payé sur ce projet : une policy RLS
-- SANS grant ne sert à rien — l'app répond « permission denied »
-- alors que tout semble configuré.
-- ───────────────────────────────────────────────────────────────
revoke all on public.rdv_agenda from anon, authenticated;
revoke all on public.rdv_occupe from anon, authenticated;

-- Le commercial écrit son adresse et peut la remplacer…
grant insert (user_id, url, hote, actif), update (url, hote, actif, maj_le)
  on public.rdv_agenda to authenticated;
-- …mais ne peut relire QUE l'état, jamais l'adresse elle-même.
grant select (user_id, hote, actif, dernier_essai, dernier_ok,
              derniere_erreur, evenements_lus, plages_gardees, maj_le)
  on public.rdv_agenda to authenticated;
grant delete on public.rdv_agenda to authenticated;   -- « je débranche mon agenda »

grant select on public.rdv_occupe to authenticated;

drop policy if exists rdv_agenda_sien on public.rdv_agenda;
create policy rdv_agenda_sien on public.rdv_agenda
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists rdv_occupe_sien on public.rdv_occupe;
create policy rdv_occupe_sien on public.rdv_occupe
  for select to authenticated using (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- Débrancher son agenda efface aussi ce qui en a été relevé.
-- Sans ça, un commercial qui retire son lien continuerait d'être
-- « occupé » par les plages de la dernière relève, sans comprendre pourquoi.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_agenda_purge()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  delete from public.rdv_occupe where user_id = old.user_id;
  return old;
end $function$;

drop trigger if exists rdv_agenda_purge_t on public.rdv_agenda;
create trigger rdv_agenda_purge_t after delete on public.rdv_agenda
  for each row execute function public.rdv_agenda_purge();

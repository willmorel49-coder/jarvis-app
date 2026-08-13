-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Mes rendez-vous dans MON agenda, sans rien cliquer (13/08/2026)
--
-- Jusqu'ici, un rendez-vous pris restait dans JARVIS : pour l'avoir dans
-- son vrai agenda, il fallait ouvrir l'app et toucher « ajouter ». Un geste
-- oublié = un rendez-vous invisible le jour J.
--
-- Ce flux fait l'inverse de rdv_agenda : là on LISAIT l'agenda du
-- commercial, ici on lui PUBLIE le nôtre. Il s'y abonne une fois, et tout
-- arrive tout seul ensuite.
--
-- ⚠️ Le jeton de cette adresse donne à voir tous ses rendez-vous. Il se
-- traite comme un mot de passe : régénérable, et jamais partagé.
--
-- ⚠️ La fraîcheur ne dépend plus de nous mais du client d'agenda. iPhone
-- laisse choisir (jusqu'à 5 min). Google, lui, rafraîchit un abonnement
-- externe quand il veut — souvent plusieurs heures. C'est pour ça que
-- l'alerte sur le téléphone reste le canal « tout de suite », et le flux
-- le canal « je n'ai rien à faire ».
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rdv_flux (
  user_id       uuid primary key references auth.users(id) on delete restrict,
  token         uuid not null unique default gen_random_uuid(),
  actif         boolean not null default true,
  cree_le       timestamptz not null default now(),
  dernier_acces timestamptz
);

alter table public.rdv_flux enable row level security;

-- Rappel maison : une policy RLS SANS grant ne sert à rien.
revoke all on public.rdv_flux from anon, authenticated;
grant select, insert, update, delete on public.rdv_flux to authenticated;
grant select, insert, update, delete on public.rdv_flux to service_role;

drop policy if exists rdv_flux_sien on public.rdv_flux;
create policy rdv_flux_sien on public.rdv_flux
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Contrôle :
--   select user_id, actif, cree_le, dernier_acces from rdv_flux;

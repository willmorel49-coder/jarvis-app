-- ═══════════════════════════════════════════════════════════════════
-- JARVIS CRM — « À rappeler cette semaine » : les GESTES des commerciaux
-- À coller par Will dans Supabase → SQL Editor (projet iyvavhnlhxksokkerkos) → Run.
-- Aucune écriture en production depuis un agent.
--
-- Une ligne = un geste d'un commercial sur une officine pour un mois de ventes
-- (appelée, notée, pas pertinent). La LISTE n'est pas stockée : elle se
-- recalcule dans le navigateur (crm/v2/v2-decrochage-moteur.js) à partir des
-- ventes que le commercial a le droit de lire.
--
-- « revenue » / « toujours en baisse » ne s'écrivent PAS ici : ils se calculent
-- à chaque ouverture à partir des ventes (décision de Will : aucune écriture
-- automatique, seuls les gestes du commercial écrivent). D'où l'absence des
-- statuts de résultat et de la colonne `resultat_le` prévus dans le rapport.
--
-- Prérequis : la fonction public.jarvis_voit_toutes_ventes() (collée le
-- 23/10/2026, docs/supabase/ventes-table-restreints-2026-10-23.sql). Si elle
-- manque, le script s'arrête sur une erreur claire avant les règles d'accès :
-- coller ce fichier-là, puis relancer celui-ci (il se relance sans risque).
--
-- Tant que la table n'existe pas, l'app garde les gestes sur l'appareil
-- (même motif que visites.sql) et les renvoie dès qu'elle existe.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.decrochage_suivi (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),   -- le commercial
  pharmacy_id   text not null,                       -- même identifiant que visites.pharmacy_id
  mois_ref      text not null check (mois_ref ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),  -- dernier mois complet du calcul
  raison        text not null default 'baisse' check (raison in ('baisse', 'habitudes', 'reprise')),
  ecart_mensuel numeric,                             -- € par mois en jeu au moment du geste (historique)
  avant_mensuel numeric,                             -- niveau mensuel d'avant, pour mesurer « revenue » plus tard
  statut        text not null check (statut in ('appelee', 'notee', 'pas_pertinent')),
  motif         text check (motif is null or motif in
                  ('fermeture_reprise', 'change_grossiste', 'saisonnier', 'deja_traite', 'autre')),
  geste_le      timestamptz not null default now(),
  constraint decrochage_suivi_un_par_mois unique (user_id, pharmacy_id, mois_ref)
);
create index if not exists decrochage_suivi_pharmacy_idx on public.decrochage_suivi (pharmacy_id);

alter table public.decrochage_suivi enable row level security;

-- Lecture : ses propres lignes ; toutes les lignes pour qui voit toutes les ventes (direction).
drop policy if exists decrochage_suivi_select on public.decrochage_suivi;
create policy decrochage_suivi_select on public.decrochage_suivi
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.jarvis_voit_toutes_ventes()));

-- Écriture : uniquement ses propres lignes, jamais au nom d'un collègue.
drop policy if exists decrochage_suivi_insert on public.decrochage_suivi;
create policy decrochage_suivi_insert on public.decrochage_suivi
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists decrochage_suivi_update on public.decrochage_suivi;
create policy decrochage_suivi_update on public.decrochage_suivi
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Aucune politique de suppression : un geste ne s'efface pas, il se remplace
-- (même officine, même mois → mise à jour de la ligne).

-- ── DROITS D'ACCÈS (indispensable) ───────────────────────────────────
-- Une table créée en SQL brut ne reçoit AUCUN droit : sans ce grant, PostgREST
-- répond 403 et l'app bascule en silence sur « gardé sur cet appareil ».
-- Pas de droit de suppression, et rien pour le visiteur sans compte.
revoke all on table public.decrochage_suivi from anon, public;
grant select, insert, update on table public.decrochage_suivi to authenticated;

-- ── CONTRÔLE (à lire après le Run) ───────────────────────────────────
-- Doit rendre 3 lignes : select, insert, update — et aucune « DELETE ».
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'decrochage_suivi' order by policyname;

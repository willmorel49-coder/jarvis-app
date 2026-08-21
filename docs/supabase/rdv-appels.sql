-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — la trace des appels (21/08/2026)
--
-- POURQUOI. Mesuré le 20/08 sur les 12 départements du secteur : sur 2 416
-- officines, 1 514 n'ont AUCUNE adresse mail — et 1 380 d'entre elles (91 %)
-- ont un téléphone. Elles étaient donc écartées de tout le module : campagne,
-- envoi groupé, radar « Qui inviter ». Pas parce qu'on ne peut pas les
-- joindre, mais parce que le module ne savait faire que du mail.
--
-- OpenStreetMap ne rend que ~6 % d'adresses sur ces départements, et il
-- n'existe aucune source publique gratuite d'e-mails d'officines (vérifié sur
-- data.gouv.fr : le fichier national des pharmacies n'a pas de colonne de
-- contact). Chercher les mails rapporte ~150 officines ; ouvrir le téléphone
-- en rend 1 380.
--
-- CE QUE CETTE TABLE SERT, ET RIEN D'AUTRE : ne pas rappeler demain celle
-- qu'on a eue aujourd'hui. Sans elle, la liste d'appels remonterait les mêmes
-- officines en boucle et deviendrait inutilisable dès la deuxième journée.
--
-- ⚠️ CE QU'ELLE N'EST PAS : un journal d'activité. On n'y écrit ni durée, ni
-- compte rendu, ni qui a décroché. Le contenu d'un appel se note dans les
-- notes de l'officine, là où l'équipe le lit déjà.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rdv_appel (
  user_id    uuid not null references auth.users(id) on delete restrict,
  cip        text not null,
  appele_le  timestamptz not null default now(),
  -- Ce que l'appel a donné, tel que le commercial le déclare. `rappeler` est
  -- le cas le plus fréquent : personne au comptoir, on retente plus tard.
  issue      text not null default 'rappeler'
               check (issue in ('rdv', 'rappeler', 'refus', 'injoignable')),
  primary key (user_id, cip)
);
create index if not exists rdv_appel_recent on public.rdv_appel (user_id, appele_le desc);

alter table public.rdv_appel drop constraint if exists rdv_appel_cip_len;
alter table public.rdv_appel add  constraint rdv_appel_cip_len
  check (char_length(cip) between 3 and 20);

-- ───────────────────────────────────────────────────────────────
-- Les verrous
-- ⚠️ Le grant ET la policy : une policy sans grant répond « permission
-- denied » et l'app bascule en silence sur un repli (piège du 10/08).
-- ───────────────────────────────────────────────────────────────
alter table public.rdv_appel enable row level security;
revoke all on public.rdv_appel from anon;

-- Pas de `delete` : un appel passé est un fait, il ne se retire pas. Se
-- tromper d'issue se corrige en rappelant — donc par un `update`.
grant select, insert, update on public.rdv_appel to authenticated;
grant all on public.rdv_appel to service_role;

-- ⚠️ Lecture par TOUTE l'équipe, écriture par soi seul. Deux commerciaux
-- peuvent couvrir un même département : que l'un appelle une officine le
-- matin et l'autre l'après-midi, c'est exactement ce qu'il faut éviter — et
-- c'est déjà la règle de l'opposition (« une officine qui dit stop à Karine
-- ne doit plus recevoir les mails de Morgane »).
drop policy if exists rdv_appel_lecture on public.rdv_appel;
create policy rdv_appel_lecture on public.rdv_appel
  for select to authenticated using (true);

drop policy if exists rdv_appel_ecriture on public.rdv_appel;
create policy rdv_appel_ecriture on public.rdv_appel
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists rdv_appel_maj on public.rdv_appel;
create policy rdv_appel_maj on public.rdv_appel
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- Contrôle — tout doit être `true`.
-- ───────────────────────────────────────────────────────────────
select
  has_table_privilege('authenticated', 'public.rdv_appel', 'SELECT') as auth_lit,
  has_table_privilege('authenticated', 'public.rdv_appel', 'INSERT') as auth_ecrit,
  has_table_privilege('authenticated', 'public.rdv_appel', 'UPDATE') as auth_modifie,
  not has_table_privilege('authenticated', 'public.rdv_appel', 'DELETE') as pas_de_suppression,
  has_table_privilege('service_role',  'public.rdv_appel', 'SELECT') as svc_lit,
  (select relrowsecurity from pg_class where oid = 'public.rdv_appel'::regclass) as rls_active;

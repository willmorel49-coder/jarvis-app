-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — le secteur du jour (19/08/2026)
--
-- « Je dois pouvoir choisir aussi par jour vers quel département je serai sur
--   mon planning, que ça puisse adapter la géolocalisation. » (Will)
--
-- POURQUOI. La géographie d'une journée n'existait qu'À PARTIR du premier
-- rendez-vous posé — la règle « aimant ». Une journée encore vide n'avait pour
-- seule limite que le temps de route depuis le point de départ : le mardi où le
-- commercial sait qu'il sera dans le 44, une officine du 61 pouvait réserver,
-- et c'est lui qui découvrait le problème après coup.
--
-- ⚠️ TROIS PRUDENCES, écrites ici comme dans le moteur. Elles existent pour
-- qu'une déclaration ne puisse JAMAIS fermer un agenda par surprise :
--   1. un jour NON DÉCLARÉ n'a aucune contrainte — déclarer un mardi ne ferme
--      pas les lundis ;
--   2. une déclaration VIDE ne ferme rien — effacer les départements d'un jour,
--      c'est retirer la contrainte, pas se rendre injoignable ;
--   3. un code postal INCONNU passe — dans le doute on garde.
--
-- Rejouable : « if not exists » / « create or replace » partout.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. La déclaration : un jour, des départements
--    `restrict` comme partout ailleurs : un commercial qui part n'efface pas
--    silencieusement son historique (rdv-socle.sql).
-- ───────────────────────────────────────────────────────────────
create table if not exists public.rdv_secteur_jour (
  user_id       uuid not null references auth.users(id) on delete restrict,
  date          date not null,
  departements  text[] not null default '{}',
  maj_le        timestamptz not null default now(),
  primary key (user_id, date)
);
create index if not exists rdv_secteur_jour_date
  on public.rdv_secteur_jour (user_id, date);

-- Un département : 2 caractères, ou 3 en outre-mer. Le tableau reste court —
-- personne ne couvre quinze départements dans la même journée, et une liste
-- démesurée serait le signe d'une saisie qui a mal tourné.
alter table public.rdv_secteur_jour drop constraint if exists rdv_secteur_jour_deps;
alter table public.rdv_secteur_jour add  constraint rdv_secteur_jour_deps
  -- ⚠️ Postgres refuse une sous-requête dans un CHECK : on ne garde ici que ce
  -- qu'une expression simple sait dire — le nombre. Le format de chaque
  -- élément est contrôlé par le déclencheur ci-dessous.
  check (array_length(departements, 1) is null or array_length(departements, 1) <= 12);

-- La vraie garde de format, posée en TRIGGER puisque le CHECK ne peut pas
-- parcourir le tableau. Elle rejette « 4 », « quatre-vingt-quinze » ou un
-- collage accidentel, avec un message qui dit quoi corriger.
create or replace function public.rdv_secteur_jour_valide()
returns trigger language plpgsql as $$
declare x text;
begin
  foreach x in array coalesce(new.departements, '{}'::text[]) loop
    if char_length(x) < 2 or char_length(x) > 3 then
      raise exception 'département invalide : « % » (2 ou 3 caractères attendus)', x;
    end if;
  end loop;
  new.maj_le := now();
  return new;
end $$;

drop trigger if exists rdv_secteur_jour_valide_t on public.rdv_secteur_jour;
create trigger rdv_secteur_jour_valide_t
  before insert or update on public.rdv_secteur_jour
  for each row execute function public.rdv_secteur_jour_valide();

-- ───────────────────────────────────────────────────────────────
-- 2. Le département d'un code postal — MÊME RÈGLE QUE LE NAVIGATEUR
--    ⚠️ Deux règles écrites séparément finissent par diverger : le serveur
--    refuserait ce que la page vient d'afficher. Celle-ci est le miroir exact
--    de `V2RDV.departement` (v2-rdv-creneaux.js), commentaires compris.
--    Corse : « 2A »/« 2B » se ramènent à « 20 », qui est ce que porte le code
--    postal. Outre-mer : trois chiffres.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_departement(p_v text)
returns text language plpgsql immutable as $$
declare t text; deux text;
begin
  t := upper(regexp_replace(coalesce(p_v, ''), '[^0-9A-Za-z]', '', 'g'));
  if char_length(t) < 2 then return ''; end if;
  if substr(t, 1, 1) = '2' and substr(t, 2, 1) in ('A', 'B') then return '20'; end if;
  deux := substr(t, 1, 2);
  if char_length(t) >= 3 and deux in ('97', '98') then return substr(t, 1, 3); end if;
  return deux;
end $$;

-- Le verrou lui-même, appelé par les deux fonctions de réservation.
-- `true` = ce jour-là, cette officine est acceptable.
create or replace function public.rdv_secteur_ok(p_user uuid, p_date date, p_cp text)
returns boolean language plpgsql stable
set search_path to 'public' as $$
declare v_deps text[]; v_mien text; v_norm text[];
begin
  select departements into v_deps
    from public.rdv_secteur_jour where user_id = p_user and date = p_date;
  if not found then return true; end if;                       -- prudence 1
  if v_deps is null or array_length(v_deps, 1) is null then
    return true;                                               -- prudence 2
  end if;
  v_mien := public.rdv_departement(p_cp);
  if v_mien = '' then return true; end if;                     -- prudence 3
  select array_agg(public.rdv_departement(x)) into v_norm from unnest(v_deps) x;
  return v_mien = any(v_norm);
end $$;

-- ───────────────────────────────────────────────────────────────
-- 3. Les verrous de la table
--    ⚠️ Le grant ET la policy : une policy sans grant répond « permission
--    denied » et l'app bascule en silence sur un repli (piège du 10/08).
--    `anon` n'écrit jamais ici — mais les fonctions publiques la LISENT, et
--    elles sont SECURITY DEFINER : elles n'ont donc pas besoin du grant.
-- ───────────────────────────────────────────────────────────────
alter table public.rdv_secteur_jour enable row level security;
revoke all on public.rdv_secteur_jour from anon;
-- Ici le `delete` est accordé, et c'est réfléchi : retirer le secteur d'un
-- jour n'efface aucun historique — c'est un réglage d'agenda, au même titre
-- qu'une demi-journée bloquée (`rdv_blocage`, qui se supprime déjà).
grant select, insert, update, delete on public.rdv_secteur_jour to authenticated;
grant all on public.rdv_secteur_jour to service_role;

drop policy if exists rdv_secteur_jour_sien on public.rdv_secteur_jour;
create policy rdv_secteur_jour_sien on public.rdv_secteur_jour
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- 4. Contrôle — tout doit être `true`, et les trois prudences vérifiées
--    sur des cas dont on connaît déjà la réponse.
-- ───────────────────────────────────────────────────────────────
select
  has_table_privilege('authenticated', 'public.rdv_secteur_jour', 'SELECT') as auth_lit,
  has_table_privilege('authenticated', 'public.rdv_secteur_jour', 'INSERT') as auth_ecrit,
  has_table_privilege('service_role',  'public.rdv_secteur_jour', 'SELECT') as svc_lit,
  (select relrowsecurity from pg_class where oid = 'public.rdv_secteur_jour'::regclass) as rls,
  public.rdv_departement('44000') = '44'  as dep_metropole,
  public.rdv_departement('20000') = '20'  as dep_corse_cp,
  public.rdv_departement('2A')    = '20'  as dep_corse_lettre,
  public.rdv_departement('97400') = '974' as dep_outremer,
  public.rdv_departement('4')     = ''    as dep_illisible;

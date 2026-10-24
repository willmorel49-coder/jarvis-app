-- 24/10/2026 — Écran « Sécurité » (crm/v2/v2-securite.js), réservé au seul compte de Will.
-- Le dépôt est PUBLIC : ce fichier ne contient aucun constat, aucun point faible, aucun nom de personne.
-- Les lignes du plan d'action (securite_plan) s'insèrent depuis un fichier HORS dépôt.
-- Accès = william.morel@me.com UNIQUEMENT (ni claude-test, ni le rôle admin : 19 comptes l'ont).
-- Rejouable (create or replace / if not exists).

-- 1. Qui a le droit. Renvoie false (jamais d'erreur) pour tous les autres.
create or replace function public.jarvis_acces_securite()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select lower(u.email) = 'william.morel@me.com'
                   from auth.users u where u.id = auth.uid()), false)
$$;
revoke all on function public.jarvis_acces_securite() from public, anon;
grant execute on function public.jarvis_acces_securite() to authenticated;

-- 2. Le plan d'action (texte rangé ici, jamais dans le dépôt).
create table if not exists public.securite_plan (
  num      int primary key,
  titre    text not null,
  statut   text not null check (statut in ('fait','a_toi','en_attente','laisse','chaque_mois','a_faire')),
  detail   text not null default '',
  date_maj date,
  ordre    int not null default 0
);
alter table public.securite_plan enable row level security;
drop policy if exists securite_plan_select on public.securite_plan;
create policy securite_plan_select on public.securite_plan
  for select to authenticated using (public.jarvis_acces_securite());
-- Droits réglés comme documents_acces : rien pour un visiteur (=> 401), lecture seule pour un compte connecté.
revoke all on public.securite_plan from public, anon;
revoke insert, update, delete, truncate, references, trigger on public.securite_plan from authenticated;
grant select on public.securite_plan to authenticated;

-- 3. L'état, lu en direct. Chaque constat : libellé, valeur, attendu, ok.
create or replace function public.jarvis_securite_etat()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $fn$
declare
  r jsonb := '{}'::jsonb;
  constats jsonb := '[]'::jsonb;
  alertes jsonb := '[]'::jsonb;
  n_tables int; n_prot int; sans text[];
  lisibles text[];
  n_fonc int;
  ci_id uuid; ci_tab int; ci_sto int;
  v_ok boolean;
  seaux_ouverts text[]; seaux jsonb;
  n_test int;
  comptes jsonb; inactifs jsonb;
begin
  if not public.jarvis_acces_securite() then
    raise exception 'Accès réservé' using errcode = '42501';
  end if;

  -- Tables : combien, combien avec une protection par ligne, lesquelles sans.
  select count(*), count(*) filter (where c.relrowsecurity),
         coalesce(array_agg(c.relname order by c.relname) filter (where not c.relrowsecurity), '{}')
    into n_tables, n_prot, sans
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p');
  v_ok := (n_tables = n_prot);
  constats := constats || jsonb_build_object('cle','tables','libelle','Tables protégées',
    'valeur', n_prot || ' sur ' || n_tables, 'attendu', 'toutes', 'ok', v_ok, 'detail', to_jsonb(sans));
  if not v_ok then alertes := alertes || jsonb_build_object('cle','tables','texte', (n_tables - n_prot) || ' table(s) sans protection'); end if;

  -- Lisible par un visiteur sans compte : droit de lecture accordé au visiteur ET (pas de protection par ligne
  -- OU une règle permissive qui s'applique au visiteur et ne dépend ni de la connexion ni d'une fonction de contrôle).
  select coalesce(array_agg(c.relname order by c.relname), '{}') into lisibles
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m','f')
    and (has_table_privilege('anon', c.oid, 'SELECT')
         or exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                    and has_column_privilege('anon', c.oid, a.attnum, 'SELECT')))
    and (c.relkind not in ('r','p') or not c.relrowsecurity
         or exists (select 1 from pg_policies p
                    where p.schemaname = 'public' and p.tablename = c.relname and p.permissive = 'PERMISSIVE'
                      and p.cmd in ('SELECT','ALL') and (p.roles && array['anon','public']::name[])
                      and (p.qual is null or lower(p.qual) = 'true'
                           or p.qual !~* 'auth\.|jarvis_|current_user|session_user')));
  v_ok := (cardinality(lisibles) = 0);
  constats := constats || jsonb_build_object('cle','visiteur','libelle','Tables lisibles sans compte',
    'valeur', cardinality(lisibles)::text, 'attendu', '0', 'ok', v_ok, 'detail', to_jsonb(lisibles));
  if not v_ok then alertes := alertes || jsonb_build_object('cle','visiteur','texte', cardinality(lisibles) || ' table(s) lisible(s) sans compte'); end if;

  -- Espaces de fichiers : seul « marketing-media » doit être public.
  select coalesce(array_agg(b.name order by b.name) filter (where b.public and b.name <> 'marketing-media'), '{}'),
         coalesce(jsonb_agg(jsonb_build_object('nom', b.name, 'public', b.public) order by b.name), '[]')
    into seaux_ouverts, seaux from storage.buckets b;
  v_ok := (cardinality(seaux_ouverts) = 0 and exists (select 1 from storage.buckets where name = 'marketing-media' and public));
  constats := constats || jsonb_build_object('cle','fichiers','libelle','Espaces de fichiers',
    'valeur', (select count(*) filter (where public) || ' ouvert sur ' || count(*) from storage.buckets),
    'attendu', 'seul « marketing-media » est ouvert', 'ok', v_ok, 'detail', seaux);
  if cardinality(seaux_ouverts) > 0 then
    alertes := alertes || jsonb_build_object('cle','fichiers','texte','Espace de fichiers ouvert à tous : ' || array_to_string(seaux_ouverts, ', '));
  end if;

  -- Fonctions exécutables par un visiteur (hors extensions et hors déclencheurs).
  select count(*) into n_fonc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f','p')
    and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
  -- Référence = valeur mesurée avec CE critère le 24/10/2026 (32) : toute fonction neuve ouverte sans compte doit se voir.
  v_ok := (n_fonc <= 32);
  constats := constats || jsonb_build_object('cle','fonctions','libelle','Fonctions ouvertes sans compte',
    'valeur', n_fonc::text, 'attendu', '32 au plus', 'ok', v_ok);
  if not v_ok then alertes := alertes || jsonb_build_object('cle','fonctions','texte', n_fonc || ' fonctions ouvertes sans compte (32 au plus)'); end if;

  -- Verrou des ventes pour les commerciaux restreints.
  v_ok := exists (select 1 from pg_policies where schemaname='public' and tablename='sales' and policyname='ventes_restreints_ses_lignes');
  constats := constats || jsonb_build_object('cle','ventes','libelle','Ventes fermées aux commerciaux restreints',
    'valeur', case when v_ok then 'en place' else 'absent' end, 'attendu', 'en place', 'ok', v_ok);
  if not v_ok then alertes := alertes || jsonb_build_object('cle','ventes','texte','Le verrou des ventes n''est plus en place'); end if;

  -- Compte de contrôle des mises en ligne.
  select id into ci_id from auth.users where lower(email) = 'ci-lecture@jarvis-controle.invalid';
  select count(*) filter (where schemaname = 'public'), count(*) filter (where schemaname = 'storage')
    into ci_tab, ci_sto from pg_policies where policyname like 'jarvis\_lecture\_seule\_%';
  v_ok := (ci_id is not null and ci_tab >= 102 and ci_sto >= 3);
  constats := constats || jsonb_build_object('cle','controle','libelle','Compte de contrôle en lecture seule',
    'valeur', case when ci_id is null then 'absent' else 'présent · ' || ci_tab || ' + ' || ci_sto || ' règles' end,
    'attendu', 'présent · 102 + 3 règles au moins', 'ok', v_ok);
  if not v_ok then alertes := alertes || jsonb_build_object('cle','controle','texte','Le compte de contrôle est absent ou incomplet'); end if;

  -- Pharmacie de test.
  select count(*) into n_test from public.pharmacies where name = 'ZZZ-TEST-CLAUDE-A-SUPPRIMER';
  v_ok := (n_test = 0);
  constats := constats || jsonb_build_object('cle','test','libelle','Pharmacie de test',
    'valeur', case when n_test = 0 then 'absente' else 'encore là' end, 'attendu', 'absente', 'ok', v_ok);
  if not v_ok then alertes := alertes || jsonb_build_object('cle','test','texte','La pharmacie de test est encore dans la base'); end if;

  -- Comptes.
  select jsonb_build_object(
    'total', count(*),
    'par_role', coalesce((select jsonb_object_agg(role, n) from (select coalesce(up.role,'sans profil') as role, count(*) n
                          from auth.users u2 left join public.user_profiles up on up.id = u2.id group by 1) x), '{}'),
    'bloques', count(*) filter (where u.banned_until > now()),
    'double_auth', (select count(distinct user_id) from auth.mfa_factors where status = 'verified'),
    'connectes_30j', count(*) filter (where u.last_sign_in_at > now() - interval '30 days'))
    into comptes from auth.users u;

  select coalesce(jsonb_agg(jsonb_build_object('nom', coalesce(nullif(btrim(up.name),''), u.email),
                                               'derniere_connexion', u.last_sign_in_at)
                           order by u.last_sign_in_at nulls first), '[]')
    into inactifs
  from auth.users u left join public.user_profiles up on up.id = u.id
  where (u.banned_until is null or u.banned_until <= now())
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '90 days';

  return jsonb_build_object(
    'lu_a', now(), 'constats', constats, 'alertes', alertes,
    'comptes', comptes, 'inactifs', inactifs,
    'plan', coalesce((select jsonb_agg(to_jsonb(p) order by p.ordre, p.num) from public.securite_plan p), '[]'));
end
$fn$;
revoke all on function public.jarvis_securite_etat() from public, anon;
grant execute on function public.jarvis_securite_etat() to authenticated;

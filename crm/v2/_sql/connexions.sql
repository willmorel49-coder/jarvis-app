-- 24/10/2026 — relevé « Qui se connecte à JARVIS » (noms + adresses de connexion) : WILL SEUL.
-- claude-test n'est admis que pour la preuve en production (compte banni hors preuve).
create or replace function public.jarvis_acces_connexions()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) in ('william.morel@me.com',
                             'claude-test@integralpharma.fr'))
$$;
revoke all on function public.jarvis_acces_connexions() from public, anon;
grant execute on function public.jarvis_acces_connexions() to authenticated;

-- Le cas « connexions-jarvis… » passe EN TÊTE : sans lui, un fichier à la racine du seau
-- est lisible par tout compte connecté (dernière branche « objet !~ … then true »).
CREATE OR REPLACE FUNCTION public.jarvis_peut_lire_protege(objet text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with p as (
    select coalesce(commercial, '') as commercial,
           coalesce(voit_tous_commerciaux, false) as tous
    from public.user_profiles
    where id = auth.uid()
  )
  select case
    when objet like 'connexions-jarvis%' then public.jarvis_acces_connexions()
    when objet = 'marge-produits.js' then public.jarvis_acces_marge_produits()
    when objet in ('opso-stats-data.js', 'opso-contrat-data.js', 'opso-offilog-acces.js',
                  'opso-listing-2026.js', 'offilog-cat-opso.js')
      then public.jarvis_acces_opso()
    when objet like 'ventes/%' and public.jarvis_acces_opso()
         and split_part(objet, '/', 2) = left(encode(sha256(convert_to('OPSO', 'UTF8')), 'hex'), 16) then true
    when public.jarvis_est_opso() then
      objet in ('offilog-best-prix.js', 'offilog-live-prix.js',
                'opso-bench-conditions.js', 'opso-sagitta-cip.js')
      or (objet like 'ventes/%' and exists (select 1 from p where btrim(commercial) <> '')
          and split_part(objet, '/', 2) = (
            select left(encode(sha256(convert_to(commercial, 'UTF8')), 'hex'), 16) from p))
    when objet !~ '^(wml-ventes-[0-9]+\.js|wml-officines-ca\.js|carte-detail\.js|marge-clients\.js|ventes/.*)$' then true
    when exists (select 1 from p where tous or btrim(commercial) = '') then true
    when objet like 'ventes/%' then
      split_part(objet, '/', 2) = (
        select left(encode(sha256(convert_to(commercial, 'UTF8')), 'hex'), 16) from p)
    else false
  end
$function$;

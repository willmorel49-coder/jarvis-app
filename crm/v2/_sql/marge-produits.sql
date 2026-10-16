-- 14/10/2026 — Will : « fais moi un onglet que pour moi sur jarvis, moi seul ai l'accès » (« Notre marge par produit »).
-- marge-produits.js (racine du seau donnees-protegees) laisse deviner nos prix d'achat : il ne se lit QUE par les
-- comptes de jarvis_acces_marge_produits() — Will + claude-test (compte des preuves, banni hors des contrôles).
-- 16/10/2026 — Will ouvre l'écran à son « groupe restreint » : Karine, Pauline S., Pauline G., Florent.
-- Cas posé EN TÊTE de jarvis_peut_lire_protege : aucune autre branche (direction, voit_tous_commerciaux…) ne l'ouvre.
-- Le reste de la fonction = sa définition lue en production le 14/10/2026 (identique à opso-liste-blanche.sql).
-- Rejouable.
create or replace function public.jarvis_acces_marge_produits()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) in ('william.morel@me.com',
                             'karine.vezzaro@integralpharma.fr',
                             'pauline.soldevila@integralpharma.fr',
                             'pauline.guillaumin@integralpharma.fr',
                             'florent.mirabel@integralpharma.fr',
                             'claude-test@integralpharma.fr'))
$$;
revoke all on function public.jarvis_acces_marge_produits() from public, anon;
grant execute on function public.jarvis_acces_marge_produits() to authenticated;

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

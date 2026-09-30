-- 30/09/2026 — Will : « à ce site [l'espace OPSO] il doit y avoir que Emmanuel
-- Noblanc et moi qui y ont accès ». Les trois fichiers protégés que seul
-- opso/v2 charge (achats par officine OPSO, suivi de rémunération, accès de
-- test Offilog) ne se lisent plus qu'avec ces comptes. claude-test reste
-- autorisé : c'est le compte des preuves, banni hors des contrôles.
-- Même liste côté app : OPSO_ACCES dans crm/v2/v2-boot.js.
create or replace function public.jarvis_acces_opso()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) in ('emmanuel.noblanc@normandiepharma.fr',
                             'william.morel@me.com',
                             'claude-test@integralpharma.fr'))
$$;

create or replace function public.jarvis_peut_lire_protege(objet text)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  with p as (
    select coalesce(commercial, '') as commercial,
           coalesce(voit_tous_commerciaux, false) as tous
    from public.user_profiles
    where id = auth.uid()
  )
  select case
    when objet in ('opso-stats-data.js', 'opso-contrat-data.js', 'opso-offilog-acces.js')
      then public.jarvis_acces_opso()
    when objet !~ '^(wml-ventes-[0-9]+\.js|wml-officines-ca\.js|carte-detail\.js|ventes/.*)$' then true
    when exists (select 1 from p where tous or btrim(commercial) = '') then true
    when objet like 'ventes/%' then
      split_part(objet, '/', 2) = (
        select left(encode(sha256(convert_to(commercial, 'UTF8')), 'hex'), 16) from p)
    else false
  end
$function$;

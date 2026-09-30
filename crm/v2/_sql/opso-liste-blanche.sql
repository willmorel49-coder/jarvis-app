-- 30/09/2026 — Will : « Emmanuel doit voir uniquement ce qui concerne OPSO ».
-- Le rôle 'opso' ne lit plus QUE les fichiers protégés de son espace (liste blanche),
-- plus le jeu de ventes de SON profil (commercial='OPSO' → ventes/<sha256[:16]>/,
-- decouper_par_commercial.py jeu_opso : les 129 adhérents, aucun total du réseau).
-- Tout le reste (ventes complètes, bench/sagitta complets, pharma-fr-*, clients…) : refusé.
-- 30/09/2026 soir : + opso-listing-2026.js (129 adhérents, titulaire/e-mail/tél.), sorti du dépôt public.
-- Les autres comptes : règle inchangée (opso-acces-restreint.sql).
-- Carte écran → fichier : jarvis-preuves/opso-acces-2026-09-30/carte-opso-donnees.md.
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
    when objet in ('opso-stats-data.js', 'opso-contrat-data.js', 'opso-offilog-acces.js',
                  'opso-listing-2026.js')
      then public.jarvis_acces_opso()
    when public.jarvis_est_opso() then
      objet in ('offilog-best-prix.js', 'offilog-live-prix.js',
                'opso-bench-conditions.js', 'opso-sagitta-cip.js')
      or (objet like 'ventes/%' and exists (select 1 from p where btrim(commercial) <> '')
          and split_part(objet, '/', 2) = (
            select left(encode(sha256(convert_to(commercial, 'UTF8')), 'hex'), 16) from p))
    when objet !~ '^(wml-ventes-[0-9]+\.js|wml-officines-ca\.js|carte-detail\.js|ventes/.*)$' then true
    when exists (select 1 from p where tous or btrim(commercial) = '') then true
    when objet like 'ventes/%' then
      split_part(objet, '/', 2) = (
        select left(encode(sha256(convert_to(commercial, 'UTF8')), 'hex'), 16) from p)
    else false
  end
$function$;

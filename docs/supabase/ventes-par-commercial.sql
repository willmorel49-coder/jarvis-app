-- ═══════════════════════════════════════════════════════════════════════════
-- Confidentialité des ventes entre commerciaux — TEMPS 2, le vrai verrou (24/09/2026)
-- Demande de la DR (Pascale Prieto) : un commercial ne reçoit JAMAIS les ventes
-- des officines d'un collègue, même en fouillant son navigateur.
--
-- Seau « donnees-protegees » :
--   · fichiers COMPLETS (wml-ventes-NN.js, wml-officines-ca.js, carte-detail.js)
--       → seulement les comptes à accès total (commercial vide, ou voit_tous_commerciaux) ;
--   · ventes/<dossier>/…  (un jeu par commercial, decouper_par_commercial.py)
--       → accès total, OU le commercial dont c'est le dossier ;
--   · tout le reste du seau et les autres seaux : RIEN NE CHANGE.
-- <dossier> = 16 premiers caractères hexa du SHA-256 de user_profiles.commercial,
-- calculé à l'identique par le navigateur (v2-boot.js) et le script Python.
--
-- Règle RESTRICTIVE : elle s'ajoute (ET) aux règles existantes sans les modifier.
-- Idempotent : peut être recollé sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.jarvis_peut_lire_protege(objet text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select coalesce(commercial, '') as commercial,
           coalesce(voit_tous_commerciaux, false) as tous
    from public.user_profiles
    where id = auth.uid()
  )
  select case
    -- ni un fichier de ventes complet, ni un jeu par commercial : règle habituelle
    when objet !~ '^(wml-ventes-[0-9]+\.js|wml-officines-ca\.js|carte-detail\.js|ventes/.*)$' then true
    -- accès total (direction, DR, commercial vide)
    when exists (select 1 from p where tous or btrim(commercial) = '') then true
    -- commercial restreint : SON dossier uniquement
    when objet like 'ventes/%' then
      split_part(objet, '/', 2) = (
        select left(encode(sha256(convert_to(commercial, 'UTF8')), 'hex'), 16) from p)
    else false
  end
$$;

revoke all on function public.jarvis_peut_lire_protege(text) from public;
grant execute on function public.jarvis_peut_lire_protege(text) to authenticated;

drop policy if exists "ventes_par_commercial" on storage.objects;
create policy "ventes_par_commercial"
  on storage.objects
  as restrictive
  for select
  to authenticated
  using (bucket_id <> 'donnees-protegees' or public.jarvis_peut_lire_protege(name));

-- Contrôle (doit rendre une ligne « ventes_par_commercial », RESTRICTIVE, SELECT) :
select policyname, permissive, cmd from pg_policies
 where schemaname = 'storage' and tablename = 'objects' and policyname = 'ventes_par_commercial';

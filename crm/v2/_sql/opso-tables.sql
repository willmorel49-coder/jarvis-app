-- 30/09/2026 — Will : « Emmanuel doit voir uniquement ce qui concerne OPSO ».
-- Le rôle 'opso' n'a plus ni lecture ni écriture sur les tables du CRM Intégral
-- (aucun écran OPSO ne les affiche : carte-opso-donnees.md). Règles RESTRICTIVES :
-- elles s'ajoutent aux règles existantes sans rien changer pour les autres comptes.
create or replace function public.jarvis_est_opso()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.user_profiles where id = auth.uid() and role = 'opso') $$;
do $$ declare t text; begin
  foreach t in array array['pharmacies','sales','imports'] loop
    execute format('drop policy if exists pas_opso on public.%I', t);
    execute format('create policy pas_opso on public.%I as restrictive for all to authenticated using (not public.jarvis_est_opso()) with check (not public.jarvis_est_opso())', t);
  end loop; end $$;

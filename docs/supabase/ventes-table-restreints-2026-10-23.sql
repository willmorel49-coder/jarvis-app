-- 23/10/2026 — table historique `sales` : un commercial RESTREINT (commercial renseigné, sans « voit tous »)
-- ne lit plus que les lignes de SES pharmacies (user_profiles.pharmacy_ids). Même définition que
-- jarvis_peut_lire_protege() pour les fichiers ventes/. Décision de Will (question cliquée, 23/10).
-- Retour arrière : drop policy ventes_restreints_ses_lignes on public.sales;
create or replace function public.jarvis_voit_toutes_ventes() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(voit_tous_commerciaux, false) or btrim(coalesce(commercial, '')) = ''
                   from public.user_profiles where id = auth.uid()), false)
$$;
create or replace function public.jarvis_mes_pharmacies() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce((select pharmacy_ids from public.user_profiles where id = auth.uid()), '{}'::uuid[])
$$;
revoke all on function public.jarvis_voit_toutes_ventes() from public, anon;
revoke all on function public.jarvis_mes_pharmacies() from public, anon;
grant execute on function public.jarvis_voit_toutes_ventes() to authenticated, service_role;
grant execute on function public.jarvis_mes_pharmacies() to authenticated, service_role;
drop policy if exists ventes_restreints_ses_lignes on public.sales;
create policy ventes_restreints_ses_lignes on public.sales as restrictive for select to authenticated
  using ((select public.jarvis_voit_toutes_ventes()) or pharmacy_id = any ((select public.jarvis_mes_pharmacies())::uuid[]));

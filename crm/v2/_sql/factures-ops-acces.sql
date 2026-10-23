-- 23/10/2026 — Will : l'app de démonstration « Factures OPS » (données fictives) s'ouvre depuis le menu du compte JARVIS,
-- pour quatre personnes qui la testent + claude-test (compte des preuves, banni hors des contrôles).
-- Même forme que jarvis_acces_marge_produits() : c'est la base qui décide, aucun nom écrit dans le code (dépôt public).
-- Rejouable.
create or replace function public.jarvis_acces_factures_ops()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) in ('william.morel@me.com',
                             'arthur.lehouerou@integralpharma.fr',
                             'vincent.minchella@intermedical.com',
                             'pascale.prieto@integralpharma.fr',
                             'claude-test@integralpharma.fr'))
$$;
revoke all on function public.jarvis_acces_factures_ops() from public, anon;
grant execute on function public.jarvis_acces_factures_ops() to authenticated;

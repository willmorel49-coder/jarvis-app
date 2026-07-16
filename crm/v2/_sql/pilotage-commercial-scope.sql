-- ═══════════════════════════════════════════════════════════════════
-- Pilotage — confidentialité inter-commerciaux
-- Relie chaque compte à SON commercial (nom exact des données de ventes).
-- commercial NULL = super-admin (voit tout) : William, Pascale, Guy.
-- commercial renseigné = restreint (voit son CA + le global national).
-- À coller dans Supabase → SQL Editor. « Success. No rows returned » = normal.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Colonne (une seule fois)
alter table public.user_profiles add column if not exists commercial text;

-- 2) Comptes RESTREINTS (le nom doit matcher EXACTEMENT V2.commercials des données)
update public.user_profiles set commercial = 'Arthur'
  where id in (select id from auth.users where email ilike 'arthur.lehouerou@%');
update public.user_profiles set commercial = 'Pauline S.'
  where id in (select id from auth.users where email ilike 'pauline.soldevila@%');
update public.user_profiles set commercial = 'Manon'
  where id in (select id from auth.users where email ilike 'manon.dussurgey@%');
update public.user_profiles set commercial = 'Florent'
  where id in (select id from auth.users where email ilike 'florent.mirabel@%');
update public.user_profiles set commercial = 'Morgane'
  where id in (select id from auth.users where email ilike 'morgane.durigan-cueille@%');
-- Karine et Pauline G. : ces lignes ne feront effet que si/quand leurs comptes existent
update public.user_profiles set commercial = 'Karine'
  where id in (select id from auth.users where email ilike 'karine.vezzaro@%');
update public.user_profiles set commercial = 'Pauline G.'
  where id in (select id from auth.users where email ilike 'pauline.guillaumin@%');

-- 3) Super-admins : on s'assure qu'ils voient TOUT (commercial NULL)
update public.user_profiles set commercial = NULL
  where id in (select id from auth.users where email ilike 'william.morel@%'
                                            or email ilike 'guy.bourdon@%'
                                            or email ilike 'pascale.prieto@%'
                                            or email ilike 'demo@%');

-- 4) Utilisateurs « OPSO seulement » (Normandie Pharma) : pas d'accès au CRM Intégral.
--    S'ils ouvrent l'app Intégral, ils sont renvoyés vers l'espace OPSO.
alter table public.user_profiles add column if not exists opso_only boolean default false;
update public.user_profiles set opso_only = true
  where id in (select id from auth.users where email ilike 'emmanuel.noblanc@%');

-- Vérif (optionnel) : voir le mapping complet
-- select u.email, p.name, p.commercial, p.opso_only from public.user_profiles p join auth.users u on u.id=p.id order by p.opso_only desc, p.commercial nulls first;

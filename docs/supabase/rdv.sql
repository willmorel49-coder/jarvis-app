-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Prise de RDV par mailing
-- Rejouable : tout est en "if not exists" / "create or replace".
-- ═══════════════════════════════════════════════════════════════

-- Disponibilités : une ligne par commercial
create table if not exists public.rdv_dispo (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  jours             jsonb not null default
                      '{"1":[["09:00","12:30"],["14:00","18:00"]],
                        "2":[["09:00","12:30"],["14:00","18:00"]],
                        "3":[["09:00","12:30"],["14:00","18:00"]],
                        "4":[["09:00","12:30"],["14:00","18:00"]],
                        "5":[["09:00","12:30"],["14:00","18:00"]]}'::jsonb,
  duree_min         int  not null default 45,
  marge_route_min   int  not null default 15,
  horizon_jours     int  not null default 90,   -- 3 mois (13/08/2026) — voir rdv-horizon-3-mois.sql
  delai_min_jours   int  not null default 3,
  rayon_chaud_km    int  not null default 25,
  rayon_max_km      int  not null default 60,
  vitesse_kmh       int  not null default 50,
  -- Numéro donné au pharmacien en cas d'empêchement. Rangé ici et pas dans
  -- user_profiles : cette table nous appartient, l'autre est le socle de l'app.
  tel               text,
  maj_le            timestamptz not null default now()
);
alter table public.rdv_dispo add column if not exists tel text;

-- Demi-journées bloquées (réunion, congés)
create table if not exists public.rdv_blocage (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  date     date not null,
  moment   text not null default 'journee'
             check (moment in ('matin','apres_midi','journee')),
  motif    text,
  cree_le  timestamptz not null default now()
);
create index if not exists rdv_blocage_user_date on public.rdv_blocage (user_id, date);

-- Les rendez-vous
create table if not exists public.rdv (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  cip          text,
  nom          text not null,
  adresse      text,
  cp           text,
  ville        text,
  lat          double precision,
  lon          double precision,
  date         date not null,
  heure        time not null,
  duree_min    int  not null default 45,
  statut       text not null default 'confirme'
                 check (statut in ('confirme','annule','a_rappeler')),
  origine      text not null default 'mailing'
                 check (origine in ('mailing','manuel')),
  contact_nom  text,
  contact_tel  text,
  message      text,
  cree_le      timestamptz not null default now()
);
-- Un créneau ne part qu'une fois : c'est ce verrou qui gère deux clics simultanés.
create unique index if not exists rdv_creneau_unique
  on public.rdv (user_id, date, heure) where statut = 'confirme';
create index if not exists rdv_user_date on public.rdv (user_id, date);

-- Les jetons envoyés par mail
create table if not exists public.rdv_lien (
  token        uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  cip          text,
  nom          text not null,
  adresse      text,
  cp           text,
  ville        text,
  lat          double precision,
  lon          double precision,
  contact_nom  text,
  modele       text not null default 'routine'
                 check (modele in ('bilan','offre','routine')),
  cree_le      timestamptz not null default now(),
  expire_le    timestamptz not null default (now() + interval '21 days'),
  envoye_le    timestamptz,
  consomme_le  timestamptz
);
create index if not exists rdv_lien_user on public.rdv_lien (user_id, cree_le desc);

-- Officines à ne plus solliciter
create table if not exists public.rdv_opposition (
  user_id  uuid not null references auth.users(id) on delete cascade,
  cip      text not null,
  motif    text,
  date     timestamptz not null default now(),
  primary key (user_id, cip)
);

-- ── Verrous ────────────────────────────────────────────────────
-- anon n'a AUCUN accès direct : pas de policy pour lui, nulle part.
alter table public.rdv_dispo      enable row level security;
alter table public.rdv_blocage    enable row level security;
alter table public.rdv            enable row level security;
alter table public.rdv_lien       enable row level security;
alter table public.rdv_opposition enable row level security;

-- ⚠️ Deux choses distinctes, et il faut LES DEUX :
--   · le DROIT sur la table (grant) — sinon « permission denied », même connecté ;
--   · la POLICY RLS — qui restreint ensuite aux lignes de l'utilisateur.
-- Une policy sans grant ne sert à rien. Vérifier les deux sens : que anon ne
-- peut PAS lire, et que le commercial PEUT lire.
do $$
declare t text;
begin
  foreach t in array array['rdv_dispo','rdv_blocage','rdv','rdv_lien','rdv_opposition'] loop
    execute format('drop policy if exists %I on public.%I', t || '_mine', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_mine', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- Les trois seules portes ouvertes au public.
-- SECURITY DEFINER + search_path figé. Aucune table n'est lisible
-- directement par anon : tout passe par ces fonctions.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.rdv_fenetre(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  l public.rdv_lien;
  d public.rdv_dispo;
  v_prenom text;
begin
  select * into l from public.rdv_lien where token = p_token limit 1;
  if not found                 then return jsonb_build_object('ok', false, 'raison', 'inconnu');  end if;
  if l.consomme_le is not null  then return jsonb_build_object('ok', false, 'raison', 'consomme'); end if;
  if l.expire_le <= now()       then return jsonb_build_object('ok', false, 'raison', 'expire');   end if;

  select * into d from public.rdv_dispo where user_id = l.user_id;

  select nullif(split_part(coalesce(p.name, ''), ' ', 1), '')
    into v_prenom from public.user_profiles p where p.id = l.user_id;

  return jsonb_build_object(
    'ok', true,
    'officine',   jsonb_build_object('nom', l.nom, 'lat', l.lat, 'lon', l.lon,
                                     'ville', l.ville, 'contact', l.contact_nom),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', d.tel),
    'dispo', case when d.user_id is null then null else jsonb_build_object(
        'jours', d.jours, 'duree_min', d.duree_min, 'marge_route_min', d.marge_route_min,
        'horizon_jours', d.horizon_jours, 'delai_min_jours', d.delai_min_jours,
        'rayon_chaud_km', d.rayon_chaud_km, 'rayon_max_km', d.rayon_max_km,
        'vitesse_kmh', d.vitesse_kmh) end,
    'blocages', coalesce((
        select jsonb_agg(jsonb_build_object('date', b.date, 'moment', b.moment))
          from public.rdv_blocage b
         where b.user_id = l.user_id and b.date >= current_date), '[]'::jsonb),
    -- Points anonymes : ni nom, ni CIP, ni chiffre. Coordonnées arrondies au km.
    'occupes', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'date', r.date, 'heure', to_char(r.heure, 'HH24:MI'),
                 'duree_min', r.duree_min,
                 'lat', round(r.lat::numeric, 2), 'lon', round(r.lon::numeric, 2)))
          from public.rdv r
         where r.user_id = l.user_id and r.statut = 'confirme' and r.date >= current_date), '[]'::jsonb)
  );
end $$;

create or replace function public.rdv_poser(
  p_token uuid, p_date date, p_heure time, p_nom text, p_tel text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  l public.rdv_lien;
  d public.rdv_dispo;
  v_id uuid; v_duree int; v_ok boolean := false;
  v_plage jsonb; v_deb time; v_fin time;
  v_prenom text;
begin
  select * into l from public.rdv_lien where token = p_token limit 1;
  if not found                 then return jsonb_build_object('ok', false, 'raison', 'inconnu');  end if;
  if l.consomme_le is not null  then return jsonb_build_object('ok', false, 'raison', 'consomme'); end if;
  if l.expire_le <= now()       then return jsonb_build_object('ok', false, 'raison', 'expire');   end if;
  if p_date < current_date      then return jsonb_build_object('ok', false, 'raison', 'hors_grille'); end if;

  select * into d from public.rdv_dispo where user_id = l.user_id;
  v_duree := coalesce(d.duree_min, 45);

  -- Le jour est-il bloqué ?
  if exists (select 1 from public.rdv_blocage b
              where b.user_id = l.user_id and b.date = p_date
                and (b.moment = 'journee'
                  or (b.moment = 'matin'      and p_heure <  time '12:00')
                  or (b.moment = 'apres_midi' and p_heure >= time '12:00')))
  then return jsonb_build_object('ok', false, 'raison', 'hors_grille'); end if;

  -- L'horaire tombe-t-il dans une plage travaillée, durée comprise ?
  for v_plage in
    select jsonb_array_elements(
             coalesce(d.jours, '{}'::jsonb) -> to_char(extract(isodow from p_date), 'FM9'))
  loop
    v_deb := (v_plage ->> 0)::time;
    v_fin := (v_plage ->> 1)::time;
    if p_heure >= v_deb and (p_heure + (v_duree || ' minutes')::interval) <= v_fin then
      v_ok := true;
    end if;
  end loop;
  if not v_ok then return jsonb_build_object('ok', false, 'raison', 'hors_grille'); end if;

  begin
    insert into public.rdv (user_id, cip, nom, adresse, cp, ville, lat, lon,
                            date, heure, duree_min, statut, origine, contact_nom, contact_tel)
    values (l.user_id, l.cip, l.nom, l.adresse, l.cp, l.ville, l.lat, l.lon,
            p_date, p_heure, v_duree, 'confirme', 'mailing',
            coalesce(nullif(p_nom, ''), l.contact_nom), nullif(p_tel, ''))
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'raison', 'pris');
  end;

  update public.rdv_lien set consomme_le = now() where token = p_token;

  select nullif(split_part(coalesce(p.name, ''), ' ', 1), '')
    into v_prenom from public.user_profiles p where p.id = l.user_id;

  return jsonb_build_object('ok', true,
    'rdv', jsonb_build_object('id', v_id, 'date', p_date, 'heure', to_char(p_heure, 'HH24:MI'),
                              'duree_min', v_duree, 'nom', l.nom,
                              'adresse', concat_ws(', ', l.adresse, l.cp, l.ville)),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', d.tel));
end $$;

create or replace function public.rdv_preference(
  p_token uuid, p_texte text, p_nom text, p_tel text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare l public.rdv_lien;
begin
  select * into l from public.rdv_lien where token = p_token limit 1;
  if not found                 then return jsonb_build_object('ok', false, 'raison', 'inconnu');  end if;
  if l.consomme_le is not null  then return jsonb_build_object('ok', false, 'raison', 'consomme'); end if;
  if l.expire_le <= now()       then return jsonb_build_object('ok', false, 'raison', 'expire');   end if;

  insert into public.rdv (user_id, cip, nom, adresse, cp, ville, lat, lon,
                          date, heure, duree_min, statut, origine, contact_nom, contact_tel, message)
  values (l.user_id, l.cip, l.nom, l.adresse, l.cp, l.ville, l.lat, l.lon,
          current_date, time '00:00', 0, 'a_rappeler', 'mailing',
          coalesce(nullif(p_nom, ''), l.contact_nom), nullif(p_tel, ''), left(coalesce(p_texte, ''), 500));

  update public.rdv_lien set consomme_le = now() where token = p_token;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.rdv_fenetre(uuid)                       to anon, authenticated;
grant execute on function public.rdv_poser(uuid, date, time, text, text) to anon, authenticated;
grant execute on function public.rdv_preference(uuid, text, text, text)  to anon, authenticated;

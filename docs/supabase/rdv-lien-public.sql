-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Le lien de réservation permanent d'un commercial (12/08/2026)
--
-- Ce que ça change : le commercial colle SON lien dans sa signature de mail.
-- Une officine qui n'a reçu aucune campagne peut réserver toute seule.
--
-- LE PIÈGE, et sa réponse : un lien permanent ne sait pas QUI réserve. Or
-- toute la cohérence géographique du moteur repose sur la position de
-- l'officine. Sans elle, on proposerait Brest et Nantes le même matin.
-- La page demande donc le code postal AVANT d'afficher le moindre créneau,
-- et le convertit en coordonnées côté navigateur (géocodage gratuit, CORS
-- ouvert, vérifié).
--
-- Ces coordonnées viennent du visiteur, donc on ne leur fait pas confiance
-- pour la sécurité — seulement pour le confort. Le serveur revérifie la
-- grille horaire, le délai, l'horizon et le chevauchement, exactement comme
-- pour un lien de campagne.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rdv_lien_public (
  user_id  uuid primary key references auth.users(id) on delete restrict,
  token    uuid not null unique default gen_random_uuid(),
  actif    boolean not null default true,
  cree_le  timestamptz not null default now()
);

alter table public.rdv_lien_public enable row level security;
revoke all on public.rdv_lien_public from anon, authenticated;

-- Le commercial voit et régénère SON lien. `anon` n'a aucun accès direct :
-- la page publique passe exclusivement par les deux fonctions ci-dessous.
grant select, insert, update, delete on public.rdv_lien_public to authenticated;
grant select, insert, update, delete on public.rdv_lien_public to service_role;

drop policy if exists rdv_lien_public_sien on public.rdv_lien_public;
create policy rdv_lien_public_sien on public.rdv_lien_public
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- Ce que voit le pharmacien qui arrive par le lien permanent.
-- Même contenu que rdv_fenetre, mais l'officine est celle qu'il déclare.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_fenetre_publique(
  p_token uuid, p_lat double precision default null, p_lon double precision default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  lp public.rdv_lien_public;
  d  public.rdv_dispo;
  a  public.rdv_agenda;
  v_prenom text;
begin
  select * into lp from public.rdv_lien_public where token = p_token limit 1;
  if not found     then return jsonb_build_object('ok', false, 'raison', 'inconnu'); end if;
  if not lp.actif  then return jsonb_build_object('ok', false, 'raison', 'ferme');   end if;

  select * into d from public.rdv_dispo  where user_id = lp.user_id;
  select * into a from public.rdv_agenda where user_id = lp.user_id;

  select nullif(split_part(coalesce(p.name, ''), ' ', 1), '')
    into v_prenom from public.user_profiles p where p.id = lp.user_id;

  return jsonb_build_object(
    'ok', true,
    'officine',   jsonb_build_object('nom', null, 'lat', p_lat, 'lon', p_lon),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', d.tel),
    'dispo', case when d.user_id is null then null else jsonb_build_object(
        'jours', d.jours, 'duree_min', d.duree_min, 'marge_route_min', d.marge_route_min,
        'horizon_jours', d.horizon_jours, 'delai_min_jours', d.delai_min_jours,
        'rayon_chaud_km', d.rayon_chaud_km, 'rayon_max_km', d.rayon_max_km,
        'vitesse_kmh', d.vitesse_kmh,
        'depart', case when d.depart_lat is null then null
                       else jsonb_build_object('lat', d.depart_lat, 'lon', d.depart_lon) end) end,
    'blocages', coalesce((
        select jsonb_agg(jsonb_build_object('date', b.date, 'moment', b.moment))
          from public.rdv_blocage b
         where b.user_id = lp.user_id and b.date >= current_date), '[]'::jsonb),
    'occupes', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'date', r.date, 'heure', to_char(r.heure, 'HH24:MI'),
                 'duree_min', r.duree_min,
                 'lat', round(r.lat::numeric, 2), 'lon', round(r.lon::numeric, 2)))
          from public.rdv r
         where r.user_id = lp.user_id and r.statut = 'confirme' and r.date >= current_date), '[]'::jsonb),
    'agenda', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'date', o.date, 'debut', to_char(o.debut, 'HH24:MI'), 'fin', to_char(o.fin, 'HH24:MI')))
          from public.rdv_occupe o
         where o.user_id = lp.user_id and o.date >= current_date), '[]'::jsonb),
    'agenda_releve_le', a.dernier_ok
  );
end $function$;

-- ───────────────────────────────────────────────────────────────
-- La réservation depuis le lien permanent. Contrairement au lien de
-- campagne, celui-ci NE SE CONSOMME PAS : c'est une porte ouverte en
-- permanence. Les mêmes règles serveur s'appliquent malgré tout.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_poser_public(
  p_token uuid, p_date date, p_heure time without time zone,
  p_officine text, p_cp text, p_ville text,
  p_nom text, p_tel text,
  p_lat double precision default null, p_lon double precision default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  lp public.rdv_lien_public;
  d  public.rdv_dispo;
  v_id uuid; v_duree int; v_ok boolean := false;
  v_plage jsonb; v_deb time; v_fin time;
  v_prenom text; v_jours jsonb; v_delai int; v_horizon int;
  c_jours_defaut constant jsonb := '{"1":[["09:00","12:30"],["14:00","18:00"]],
                                     "2":[["09:00","12:30"],["14:00","18:00"]],
                                     "3":[["09:00","12:30"],["14:00","18:00"]],
                                     "4":[["09:00","12:30"],["14:00","18:00"]],
                                     "5":[["09:00","12:30"],["14:00","18:00"]]}'::jsonb;
begin
  if p_officine is null or char_length(btrim(p_officine)) < 2 then
    return jsonb_build_object('ok', false, 'raison', 'officine_manquante');
  end if;
  if char_length(p_officine) > 160 or coalesce(char_length(p_nom), 0) > 120
     or coalesce(char_length(p_tel), 0) > 30 or coalesce(char_length(p_cp), 0) > 10
     or coalesce(char_length(p_ville), 0) > 120 then
    return jsonb_build_object('ok', false, 'raison', 'trop_long');
  end if;

  select * into lp from public.rdv_lien_public where token = p_token limit 1;
  if not found    then return jsonb_build_object('ok', false, 'raison', 'inconnu'); end if;
  if not lp.actif then return jsonb_build_object('ok', false, 'raison', 'ferme');   end if;

  select * into d from public.rdv_dispo where user_id = lp.user_id;
  v_duree   := coalesce(d.duree_min, 45);
  v_delai   := coalesce(d.delai_min_jours, 3);
  v_horizon := coalesce(d.horizon_jours, 180);
  v_jours   := coalesce(d.jours, c_jours_defaut);
  if v_jours = '{}'::jsonb then v_jours := c_jours_defaut; end if;

  if p_date < current_date + v_delai then
    return jsonb_build_object('ok', false, 'raison', 'trop_tot');
  end if;
  if p_date > current_date + v_horizon then
    return jsonb_build_object('ok', false, 'raison', 'trop_loin');
  end if;

  if exists (select 1 from public.rdv_blocage b
              where b.user_id = lp.user_id and b.date = p_date
                and (b.moment = 'journee'
                  or (b.moment = 'matin'      and p_heure <  time '12:00')
                  or (b.moment = 'apres_midi' and p_heure >= time '12:00')))
  then return jsonb_build_object('ok', false, 'raison', 'hors_grille'); end if;

  for v_plage in
    select jsonb_array_elements(v_jours -> to_char(extract(isodow from p_date), 'FM9'))
  loop
    v_deb := (v_plage ->> 0)::time;
    v_fin := (v_plage ->> 1)::time;
    if p_heure >= v_deb and (p_heure + (v_duree || ' minutes')::interval) <= v_fin then
      v_ok := true;
    end if;
  end loop;
  if not v_ok then return jsonb_build_object('ok', false, 'raison', 'hors_grille'); end if;

  begin
    insert into public.rdv (user_id, cip, nom, cp, ville, lat, lon,
                            date, heure, duree_min, statut, origine, contact_nom, contact_tel)
    values (lp.user_id, null, btrim(p_officine), nullif(p_cp, ''), nullif(p_ville, ''),
            p_lat, p_lon, p_date, p_heure, v_duree, 'confirme', 'lien_public',
            nullif(p_nom, ''), nullif(p_tel, ''))
    returning id into v_id;
  exception
    when unique_violation    then return jsonb_build_object('ok', false, 'raison', 'pris');
    when exclusion_violation then return jsonb_build_object('ok', false, 'raison', 'pris');
  end;

  select nullif(split_part(coalesce(p.name, ''), ' ', 1), '')
    into v_prenom from public.user_profiles p where p.id = lp.user_id;

  return jsonb_build_object('ok', true,
    'rdv', jsonb_build_object('id', v_id, 'date', p_date, 'heure', to_char(p_heure, 'HH24:MI'),
                              'duree_min', v_duree, 'nom', btrim(p_officine),
                              'adresse', concat_ws(', ', p_cp, p_ville)),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', d.tel));
end $function$;

grant execute on function public.rdv_fenetre_publique(uuid, double precision, double precision)
  to anon, authenticated;
grant execute on function public.rdv_poser_public(
  uuid, date, time without time zone, text, text, text, text, text, double precision, double precision)
  to anon, authenticated;

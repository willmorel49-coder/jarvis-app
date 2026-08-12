-- ═══════════════════════════════════════════════════════════════
-- JARVIS · D'où le commercial part le matin (12/08/2026)
--
-- Le moteur calculait le temps de route ENTRE deux rendez-vous, mais
-- ignorait d'où le commercial démarre. Une journée encore vide proposait
-- donc 9 h à Brest à quelqu'un qui part de Nantes : trois heures de route
-- qui n'existaient nulle part dans le calcul.
--
-- Trois colonnes seulement, et toutes facultatives : sans point de départ,
-- le moteur se comporte exactement comme avant. On ne suppose rien.
-- ═══════════════════════════════════════════════════════════════
alter table public.rdv_dispo add column if not exists depart_label text;
alter table public.rdv_dispo add column if not exists depart_lat   double precision;
alter table public.rdv_dispo add column if not exists depart_lon   double precision;

alter table public.rdv_dispo drop constraint if exists rdv_dispo_depart_label_len;
alter table public.rdv_dispo add  constraint rdv_dispo_depart_label_len
  check (depart_label is null or char_length(depart_label) <= 160);

-- Latitude et longitude cohérentes, ou rien. Un point de départ à moitié
-- rempli ferait écarter des journées entières sur un calcul faux.
alter table public.rdv_dispo drop constraint if exists rdv_dispo_depart_complet;
alter table public.rdv_dispo add  constraint rdv_dispo_depart_complet
  check ((depart_lat is null and depart_lon is null)
      or (depart_lat between -90 and 90 and depart_lon between -180 and 180));

-- La page du pharmacien reçoit le point de départ pour calculer les créneaux
-- atteignables. Ce n'est pas une donnée sensible : c'est la ville d'où part
-- le commercial, pas son adresse — et l'écran ne demande qu'une ville.
create or replace function public.rdv_fenetre(p_token uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  l public.rdv_lien;
  d public.rdv_dispo;
  a public.rdv_agenda;
  v_prenom text;
begin
  select * into l from public.rdv_lien where token = p_token limit 1;
  if not found                  then return jsonb_build_object('ok', false, 'raison', 'inconnu');  end if;
  if l.consomme_le is not null  then return jsonb_build_object('ok', false, 'raison', 'consomme'); end if;
  if l.expire_le <= now()       then return jsonb_build_object('ok', false, 'raison', 'expire');   end if;

  select * into d from public.rdv_dispo  where user_id = l.user_id;
  select * into a from public.rdv_agenda where user_id = l.user_id;

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
        'vitesse_kmh', d.vitesse_kmh,
        'depart', case when d.depart_lat is null then null
                       else jsonb_build_object('lat', d.depart_lat, 'lon', d.depart_lon) end) end,
    'blocages', coalesce((
        select jsonb_agg(jsonb_build_object('date', b.date, 'moment', b.moment))
          from public.rdv_blocage b
         where b.user_id = l.user_id and b.date >= current_date), '[]'::jsonb),
    'occupes', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'date', r.date, 'heure', to_char(r.heure, 'HH24:MI'),
                 'duree_min', r.duree_min,
                 'lat', round(r.lat::numeric, 2), 'lon', round(r.lon::numeric, 2)))
          from public.rdv r
         where r.user_id = l.user_id and r.statut = 'confirme' and r.date >= current_date), '[]'::jsonb),
    'agenda', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'date', o.date,
                 'debut', to_char(o.debut, 'HH24:MI'),
                 'fin',   to_char(o.fin,   'HH24:MI')))
          from public.rdv_occupe o
         where o.user_id = l.user_id and o.date >= current_date), '[]'::jsonb),
    'agenda_releve_le', a.dernier_ok
  );
end $function$;

-- Le serveur doit appliquer la même règle que le navigateur, sinon un lien
-- rejoué poserait un RDV que le commercial ne peut pas honorer.
create or replace function public.rdv_atteignable(
  p_lat1 double precision, p_lon1 double precision,
  p_lat2 double precision, p_lon2 double precision,
  p_coef double precision default 1.3)
returns double precision
language sql immutable set search_path to 'public'
as $function$
  select case
    when p_lat1 is null or p_lon1 is null or p_lat2 is null or p_lon2 is null then null
    else 2 * 6371 * asin(least(1, sqrt(
      sin(radians(p_lat2 - p_lat1) / 2) ^ 2 +
      cos(radians(p_lat1)) * cos(radians(p_lat2)) * sin(radians(p_lon2 - p_lon1) / 2) ^ 2
    ))) * p_coef end
$function$;

-- ═══════════════════════════════════════════════════════════════
-- JARVIS · La page du pharmacien tient compte de l'agenda du commercial
--
-- rdv_fenetre renvoyait déjà les RDV JARVIS confirmés ("occupes", avec
-- leurs coordonnées, ce qui alimente la règle géographique). On y ajoute
-- les plages relevées dans son agenda extérieur ("agenda").
--
-- Ces plages-là n'ont PAS de coordonnées, et c'est voulu : elles bloquent
-- une heure, elles n'orientent jamais la zone de la journée. On ne sait pas
-- où le commercial est quand il déjeune, et on n'a pas à le savoir.
-- ═══════════════════════════════════════════════════════════════
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
        'vitesse_kmh', d.vitesse_kmh) end,
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
    -- Plages venues de l'agenda personnel : heures seulement, jamais de titre.
    'agenda', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'date', o.date,
                 'debut', to_char(o.debut, 'HH24:MI'),
                 'fin',   to_char(o.fin,   'HH24:MI')))
          from public.rdv_occupe o
         where o.user_id = l.user_id and o.date >= current_date), '[]'::jsonb),
    -- Permet à la page de rester honnête si la dernière relève est vieille :
    -- on continue de proposer des créneaux (mieux qu'une page qui paraît cassée),
    -- et c'est le serveur qui refusera un vrai conflit au moment de poser.
    'agenda_releve_le', a.dernier_ok
  );
end $function$;

-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — le secteur du jour, côté serveur (19/08/2026)
--
-- Suite de rdv-secteur-du-jour.sql. Ces quatre fonctions sont RE-CRÉÉES à
-- l'identique de leur version en production, avec deux ajouts et rien d'autre :
--
--   · les deux `rdv_fenetre*` renvoient les journées déclarées (`secteurs`),
--     et `rdv_fenetre` renvoie enfin le CODE POSTAL de l'officine — il était
--     déjà en base, il n'était simplement pas transmis, et sans lui le moteur
--     ne peut pas savoir dans quel département elle se trouve ;
--
--   · les deux `rdv_poser*` refusent une date hors du secteur déclaré. Le
--     navigateur écarte déjà ces journées, mais un onglet resté ouvert depuis
--     hier ne le sait pas. C'est le trou que le socle du 11/08 a fermé pour
--     toutes les autres règles : « le navigateur appliquait les règles, le
--     serveur le croyait sur parole. »
--
-- Généré à partir de pg_get_functiondef() : le corps d'origine n'a pas été
-- réécrit à la main, seules les lignes marquées ci-dessous ont été insérées.
-- ═══════════════════════════════════════════════════════════════

-- ─────────── rdv_fenetre ───────────
CREATE OR REPLACE FUNCTION public.rdv_fenetre(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- ⚠️ `cp` ajouté le 19/08/2026 : sans lui, le moteur ne peut pas savoir
    -- dans quel département se trouve l'officine, donc pas appliquer le
    -- secteur du jour. Il était déjà en base, il n'était juste pas renvoyé.
    'officine',   jsonb_build_object('nom', l.nom, 'lat', l.lat, 'lon', l.lon,
                                     'cp', l.cp,
                                     'ville', l.ville, 'contact', l.contact_nom),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', d.tel),
    'dispo', case when d.user_id is null then null else jsonb_build_object(
        'jours', d.jours, 'duree_min', d.duree_min, 'marge_route_min', d.marge_route_min,
        'horizon_jours', d.horizon_jours, 'delai_min_jours', d.delai_min_jours,
        'rayon_chaud_km', d.rayon_chaud_km, 'rayon_max_km', d.rayon_max_km,
        'vitesse_kmh', d.vitesse_kmh,
        'depart', case when d.depart_lat is null then null
                       else jsonb_build_object('lat', d.depart_lat, 'lon', d.depart_lon) end) end,
    'secteurs', coalesce((
        select jsonb_agg(jsonb_build_object('date', s.date, 'departements', s.departements))
          from public.rdv_secteur_jour s
         where s.user_id = l.user_id and s.date >= current_date), '[]'::jsonb),
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

-- ─────────── rdv_fenetre_publique ───────────
CREATE OR REPLACE FUNCTION public.rdv_fenetre_publique(p_token uuid, p_lat double precision DEFAULT NULL::double precision, p_lon double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'secteurs', coalesce((
        select jsonb_agg(jsonb_build_object('date', s.date, 'departements', s.departements))
          from public.rdv_secteur_jour s
         where s.user_id = lp.user_id and s.date >= current_date), '[]'::jsonb),
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

-- ─────────── rdv_poser ───────────
CREATE OR REPLACE FUNCTION public.rdv_poser(p_token uuid, p_date date, p_heure time without time zone, p_nom text, p_tel text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_code text;
  l public.rdv_lien;
  d public.rdv_dispo;
  v_id uuid; v_duree int; v_ok boolean := false;
  v_plage jsonb; v_deb time; v_fin time;
  v_prenom text; v_jours jsonb;
  v_delai int; v_horizon int;
  -- Mêmes valeurs que V2RDV.DEFAUT_DISPO côté navigateur ET que le
  -- "default" de la colonne rdv_dispo.jours : une seule vérité.
  c_jours_defaut constant jsonb := '{"1":[["09:00","12:30"],["14:00","18:00"]],
                                     "2":[["09:00","12:30"],["14:00","18:00"]],
                                     "3":[["09:00","12:30"],["14:00","18:00"]],
                                     "4":[["09:00","12:30"],["14:00","18:00"]],
                                     "5":[["09:00","12:30"],["14:00","18:00"]]}'::jsonb;
begin
  if p_nom is not null and char_length(p_nom) > 120 then
    return jsonb_build_object('ok', false, 'raison', 'nom_trop_long');
  end if;
  if p_tel is not null and char_length(p_tel) > 30 then
    return jsonb_build_object('ok', false, 'raison', 'tel_trop_long');
  end if;

  select * into l from public.rdv_lien where token = p_token limit 1;
  if not found                  then return jsonb_build_object('ok', false, 'raison', 'inconnu');  end if;
  if l.consomme_le is not null  then return jsonb_build_object('ok', false, 'raison', 'consomme'); end if;
  if l.expire_le <= now()       then return jsonb_build_object('ok', false, 'raison', 'expire');   end if;

  select * into d from public.rdv_dispo where user_id = l.user_id;
  v_duree   := coalesce(d.duree_min, 45);
  v_delai   := coalesce(d.delai_min_jours, 3);
  v_horizon := coalesce(d.horizon_jours, 180);
  v_jours   := coalesce(d.jours, c_jours_defaut);
  if v_jours = '{}'::jsonb then v_jours := c_jours_defaut; end if;

  -- Ces deux règles n'existaient QUE dans le navigateur.
  if p_date < current_date + v_delai then
    return jsonb_build_object('ok', false, 'raison', 'trop_tot');
  end if;
  if p_date > current_date + v_horizon then
    return jsonb_build_object('ok', false, 'raison', 'trop_loin');
  end if;

  if exists (select 1 from public.rdv_blocage b
              where b.user_id = l.user_id and b.date = p_date
                and (b.moment = 'journee'
                  or (b.moment = 'matin'      and p_heure <  time '12:00')
                  or (b.moment = 'apres_midi' and p_heure >= time '12:00')))
  then return jsonb_build_object('ok', false, 'raison', 'hors_grille'); end if;

  -- ⚠️ Le secteur du jour, contrôlé PAR LE SERVEUR. Le navigateur écarte déjà
  -- ces journées, mais un onglet resté ouvert depuis hier ne le sait pas — et
  -- c'est exactement le trou que le socle du 11/08 a fermé pour les autres
  -- règles : « le navigateur appliquait les règles, le serveur le croyait sur
  -- parole ». `rdv_secteur_ok` porte les trois prudences (jour non déclaré,
  -- déclaration vide, code postal inconnu) : elle ne ferme jamais par défaut.
  if not public.rdv_secteur_ok(l.user_id, p_date, l.cp) then
    return jsonb_build_object('ok', false, 'raison', 'hors_secteur');
  end if;

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
    insert into public.rdv (user_id, cip, nom, adresse, cp, ville, lat, lon,
                            date, heure, duree_min, statut, origine, contact_nom, contact_tel)
    values (l.user_id, l.cip, l.nom, l.adresse, l.cp, l.ville, l.lat, l.lon,
            p_date, p_heure, v_duree, 'confirme', 'mailing',
            coalesce(nullif(p_nom, ''), l.contact_nom), nullif(p_tel, ''))
    returning id, code into v_id, v_code;
  exception
    when unique_violation   then return jsonb_build_object('ok', false, 'raison', 'pris');
    when exclusion_violation then return jsonb_build_object('ok', false, 'raison', 'pris');
  end;

  update public.rdv_lien set consomme_le = now() where token = p_token;

  select nullif(split_part(coalesce(p.name, ''), ' ', 1), '')
    into v_prenom from public.user_profiles p where p.id = l.user_id;

  return jsonb_build_object('ok', true,
    'rdv', jsonb_build_object('id', v_id, 'code', v_code, 'date', p_date, 'heure', to_char(p_heure, 'HH24:MI'),
                              'duree_min', v_duree, 'nom', l.nom,
                              'adresse', concat_ws(', ', l.adresse, l.cp, l.ville)),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', d.tel));
end $function$;

-- ─────────── rdv_poser_public ───────────
CREATE OR REPLACE FUNCTION public.rdv_poser_public(p_token uuid, p_date date, p_heure time without time zone, p_officine text, p_cp text, p_ville text, p_nom text, p_tel text, p_lat double precision DEFAULT NULL::double precision, p_lon double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  lp public.rdv_lien_public;
  d  public.rdv_dispo;
  v_id uuid; v_duree int; v_ok boolean := false;
  v_plage jsonb; v_deb time; v_fin time;
  v_prenom text; v_jours jsonb; v_delai int; v_horizon int;
  v_code text;
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

  -- ⚠️ Le secteur du jour, contrôlé PAR LE SERVEUR. Le navigateur écarte déjà
  -- ces journées, mais un onglet resté ouvert depuis hier ne le sait pas — et
  -- c'est exactement le trou que le socle du 11/08 a fermé pour les autres
  -- règles : « le navigateur appliquait les règles, le serveur le croyait sur
  -- parole ». `rdv_secteur_ok` porte les trois prudences (jour non déclaré,
  -- déclaration vide, code postal inconnu) : elle ne ferme jamais par défaut.
  if not public.rdv_secteur_ok(lp.user_id, p_date, p_cp) then
    return jsonb_build_object('ok', false, 'raison', 'hors_secteur');
  end if;

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
    returning id, code into v_id, v_code;
  exception
    when unique_violation    then return jsonb_build_object('ok', false, 'raison', 'pris');
    when exclusion_violation then return jsonb_build_object('ok', false, 'raison', 'pris');
  end;

  select nullif(split_part(coalesce(p.name, ''), ' ', 1), '')
    into v_prenom from public.user_profiles p where p.id = lp.user_id;

  return jsonb_build_object('ok', true,
    'rdv', jsonb_build_object('id', v_id, 'code', v_code,
                              'date', p_date, 'heure', to_char(p_heure, 'HH24:MI'),
                              'duree_min', v_duree, 'nom', btrim(p_officine),
                              'adresse', concat_ws(', ', p_cp, p_ville)),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', d.tel));
end $function$;

-- Contrôle : les quatre fonctions portent bien leur ajout.
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('rdv_poser','rdv_poser_public')
      and pg_get_functiondef(p.oid) like '%hors_secteur%') as poser_verrouillees,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('rdv_fenetre','rdv_fenetre_publique')
      and pg_get_functiondef(p.oid) like '%secteurs%') as fenetres_completes,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='rdv_fenetre'
      and pg_get_functiondef(p.oid) like '%''cp'', l.cp%') as fenetre_donne_le_cp;

-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — réparation du socle (11/08/2026)
--
-- Cinq trous trouvés par l'audit du 11/08, tous côté serveur. Le navigateur
-- appliquait les règles, le serveur les croyait sur parole : un onglet resté
-- ouvert ou un appel direct passait au travers.
--
-- Appliqué alors que les 5 tables étaient VIDES — aucune donnée en jeu.
-- Rejouable : tout est en "create or replace" / "if not exists" / "drop if exists".
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Un commercial qui part n'emporte plus son historique
--    "on delete cascade" effaçait en silence ses RDV passés et à venir,
--    ses jetons, ET sa liste RGPD des officines qui ont dit non.
--    "restrict" fait échouer la suppression au lieu de détruire : on est
--    forcé de décider consciemment ce qu'on fait de l'historique.
-- ───────────────────────────────────────────────────────────────
alter table public.rdv            drop constraint if exists rdv_user_id_fkey;
alter table public.rdv            add  constraint rdv_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;

alter table public.rdv_dispo      drop constraint if exists rdv_dispo_user_id_fkey;
alter table public.rdv_dispo      add  constraint rdv_dispo_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;

alter table public.rdv_blocage    drop constraint if exists rdv_blocage_user_id_fkey;
alter table public.rdv_blocage    add  constraint rdv_blocage_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;

alter table public.rdv_lien       drop constraint if exists rdv_lien_user_id_fkey;
alter table public.rdv_lien       add  constraint rdv_lien_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;

alter table public.rdv_opposition drop constraint if exists rdv_opposition_user_id_fkey;
alter table public.rdv_opposition add  constraint rdv_opposition_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;

-- ───────────────────────────────────────────────────────────────
-- 2. Longueur maximale sur tout ce qu'un inconnu peut écrire
--    Les 3 fonctions publiques sont ouvertes à Internet et n'imposaient
--    aucune limite : un jeton valide suffisait à remplir la base gratuite.
-- ───────────────────────────────────────────────────────────────
alter table public.rdv drop constraint if exists rdv_contact_nom_len;
alter table public.rdv add  constraint rdv_contact_nom_len
  check (contact_nom is null or char_length(contact_nom) <= 120);

alter table public.rdv drop constraint if exists rdv_contact_tel_len;
alter table public.rdv add  constraint rdv_contact_tel_len
  check (contact_tel is null or char_length(contact_tel) <= 30);

-- ───────────────────────────────────────────────────────────────
-- 3. Empêcher deux rendez-vous qui se chevauchent
--    L'index unique ne couvrait que l'heure de DÉBUT identique : 09:00 et
--    09:15 avec des RDV de 45 min passaient tous les deux.
--    Une contrainte d'exclusion règle le cas à la racine, quelle que soit
--    la façon dont la ligne est insérée.
-- ───────────────────────────────────────────────────────────────
create extension if not exists btree_gist;

alter table public.rdv drop constraint if exists rdv_pas_de_chevauchement;
alter table public.rdv add  constraint rdv_pas_de_chevauchement
  exclude using gist (
    user_id with =,
    date    with =,
    -- make_interval() et date+heure sont IMMUTABLE ; la forme
    -- "(duree || ' minutes')::interval" ne l'est pas (elle dépend d'un
    -- réglage de session) et Postgres la refuse dans un index.
    tsrange('2000-01-01'::date + heure,
            '2000-01-01'::date + heure + make_interval(mins => coalesce(duree_min, 45))) with &&
  ) where (statut <> 'annule');

-- ───────────────────────────────────────────────────────────────
-- 4. Le serveur applique enfin SES propres règles
--    Ajouts : délai minimum, horizon, repli sur les horaires par défaut
--    quand le commercial n'a pas encore rempli son écran (sinon le
--    pharmacien voyait des créneaux refusés à chaque clic), et
--    un jeton annulé redevient utilisable pour reprendre un créneau.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_poser(
  p_token uuid, p_date date, p_heure time without time zone, p_nom text, p_tel text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
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
  v_horizon := coalesce(d.horizon_jours, 21);
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
    returning id into v_id;
  exception
    when unique_violation   then return jsonb_build_object('ok', false, 'raison', 'pris');
    when exclusion_violation then return jsonb_build_object('ok', false, 'raison', 'pris');
  end;

  update public.rdv_lien set consomme_le = now() where token = p_token;

  select nullif(split_part(coalesce(p.name, ''), ' ', 1), '')
    into v_prenom from public.user_profiles p where p.id = l.user_id;

  return jsonb_build_object('ok', true,
    'rdv', jsonb_build_object('id', v_id, 'date', p_date, 'heure', to_char(p_heure, 'HH24:MI'),
                              'duree_min', v_duree, 'nom', l.nom,
                              'adresse', concat_ws(', ', l.adresse, l.cp, l.ville)),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', d.tel));
end $function$;

-- ───────────────────────────────────────────────────────────────
-- 5. Le pharmacien peut enfin revoir, annuler et reprendre
--    Avant : le jeton était détruit à la réservation, il ne pouvait plus
--    rien faire — pas même relire la date de son rendez-vous.
--    rdv_mon_rdv  : ce que je vois quand je reviens sur mon lien
--    rdv_annuler  : j'annule ; le créneau est libéré et mon lien
--                   redevient utilisable pour en reprendre un autre.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_mon_rdv(p_token uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare l public.rdv_lien; r public.rdv; v_prenom text; d public.rdv_dispo;
begin
  select * into l from public.rdv_lien where token = p_token limit 1;
  if not found            then return jsonb_build_object('ok', false, 'raison', 'inconnu'); end if;
  if l.expire_le <= now() then return jsonb_build_object('ok', false, 'raison', 'expire');  end if;

  select * into r from public.rdv
   where user_id = l.user_id and cip = l.cip and statut = 'confirme'
   order by date, heure limit 1;
  if not found then return jsonb_build_object('ok', true, 'rdv', null); end if;

  select * into d from public.rdv_dispo where user_id = l.user_id;
  select nullif(split_part(coalesce(p.name, ''), ' ', 1), '')
    into v_prenom from public.user_profiles p where p.id = l.user_id;

  return jsonb_build_object('ok', true,
    'rdv', jsonb_build_object('id', r.id, 'date', r.date,
                              'heure', to_char(r.heure, 'HH24:MI'),
                              'duree_min', r.duree_min, 'nom', r.nom,
                              'adresse', concat_ws(', ', r.adresse, r.cp, r.ville)),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'), 'tel', d.tel));
end $function$;

create or replace function public.rdv_annuler(p_token uuid, p_motif text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare l public.rdv_lien; v_n int;
begin
  if p_motif is not null and char_length(p_motif) > 300 then
    return jsonb_build_object('ok', false, 'raison', 'motif_trop_long');
  end if;

  select * into l from public.rdv_lien where token = p_token limit 1;
  if not found            then return jsonb_build_object('ok', false, 'raison', 'inconnu'); end if;
  if l.expire_le <= now() then return jsonb_build_object('ok', false, 'raison', 'expire');  end if;

  update public.rdv
     set statut = 'annule',
         annule_le = now(),
         annule_motif = nullif(p_motif, '')
   where user_id = l.user_id and cip = l.cip and statut = 'confirme';
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', false, 'raison', 'aucun_rdv'); end if;

  -- Le lien redevient utilisable : le pharmacien qui annule veut le plus
  -- souvent décaler, pas disparaître. Sans ça il faudrait lui réécrire.
  update public.rdv_lien set consomme_le = null where token = p_token;

  return jsonb_build_object('ok', true, 'annules', v_n);
end $function$;

-- Colonnes nécessaires à l'annulation (ajoutées si absentes)
alter table public.rdv add column if not exists annule_le    timestamptz;
alter table public.rdv add column if not exists annule_motif text;

-- Les 3 fonctions publiques + les 2 nouvelles restent appelables sans compte
grant execute on function public.rdv_mon_rdv(uuid)       to anon, authenticated;
grant execute on function public.rdv_annuler(uuid, text) to anon, authenticated;

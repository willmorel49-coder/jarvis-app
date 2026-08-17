-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — le pharmacien peut gérer SON rendez-vous (17/08/2026)
--
-- LE MANQUE. Un pharmacien qui réserve par le LIEN PERMANENT — donc par un
-- envoi groupé en copie cachée, ou par le lien collé dans une signature — ne
-- peut plus rien faire ensuite. Ni relire la date, ni déplacer, ni annuler.
-- Il reçoit un fichier agenda, et c'est tout.
--
-- Pourquoi c'était invisible : `rdv_mon_rdv` et `rdv_annuler` retrouvent le
-- rendez-vous par `(user_id, cip)` à partir d'un jeton de CAMPAGNE. Or une
-- réservation par lien permanent enregistre **`cip = null`** (le lien ne sait
-- pas à quelle officine il parle, c'est le pharmacien qui se déclare). Ces
-- rendez-vous étaient donc introuvables par conception.
--
-- C'est la même famille de faute que la panne du 13/08 : deux chemins qui
-- font « la même chose » mais ne partagent pas la fonction. On corrige ici la
-- cause, pas le symptôme — le code de gestion est porté par le RENDEZ-VOUS,
-- donc il vaut pour les deux chemins, aujourd'hui et pour les suivants.
--
-- POURQUOI ÇA COMPTE, EN CLAIR. Un pharmacien qui ne peut pas annuler
-- n'annule pas : il n'est simplement pas là quand le commercial arrive. On
-- perd le déplacement ET le créneau, qui reste bloqué pour quelqu'un d'autre.
-- Pouvoir annuler n'est pas une politesse, c'est ce qui récupère le créneau.
--
-- COMMENT LE PHARMACIEN GARDE SON LIEN, SANS AUCUN MAIL. On n'a pas de
-- service d'envoi (règle du zéro coût), donc on ne peut rien lui écrire. Mais
-- il repart avec un fichier agenda : le lien de gestion est écrit DEDANS. Son
-- agenda devient sa confirmation, et il l'aura encore dans trois mois.
--
-- Rejouable : "if not exists" / "create or replace" partout.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Un code court porté par le rendez-vous
--    Même alphabet que `rdv_lien.code` : ni voyelle ni caractère ambigu
--    (0/O, 1/l/I), pour qu'il puisse être lu au téléphone si un pharmacien
--    appelle en disant « ça ne marche pas ».
-- ───────────────────────────────────────────────────────────────
alter table public.rdv add column if not exists code text;

create unique index if not exists rdv_code_uniq
  on public.rdv (code) where code is not null;

create or replace function public.rdv_code_gestion_neuf()
returns text
language plpgsql volatile set search_path to 'public'
as $function$
declare
  alpha constant text := '23456789bcdfghjkmnpqrstvwxz';
  v text; i int; essais int := 0;
begin
  loop
    v := '';
    for i in 1..8 loop
      v := v || substr(alpha, 1 + floor(random() * length(alpha))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rdv where code = v);
    essais := essais + 1;
    if essais > 50 then
      v := v || floor(random() * 900 + 100)::text;
      exit;
    end if;
  end loop;
  return v;
end $function$;

create or replace function public.rdv_code_gestion_auto()
returns trigger language plpgsql set search_path to 'public'
as $function$
begin
  if new.code is null then new.code := public.rdv_code_gestion_neuf(); end if;
  return new;
end $function$;

drop trigger if exists rdv_code_gestion_auto_t on public.rdv;
create trigger rdv_code_gestion_auto_t before insert on public.rdv
  for each row execute function public.rdv_code_gestion_auto();

-- Les rendez-vous déjà pris en reçoivent un : sinon eux resteraient ingérables.
update public.rdv set code = public.rdv_code_gestion_neuf() where code is null;

-- ───────────────────────────────────────────────────────────────
-- 2. Ce que le pharmacien voit avec son code
--    On rend le strict nécessaire : sa date, le prénom et le numéro de son
--    commercial, et de quoi reprendre un autre créneau. Rien sur les autres
--    rendez-vous, rien sur les autres officines.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_gerer(p_code text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  r public.rdv; d public.rdv_dispo; v_prenom text; v_slug text;
begin
  if p_code is null or char_length(p_code) not between 6 and 16 then
    return jsonb_build_object('ok', false, 'raison', 'inconnu');
  end if;

  select * into r from public.rdv where code = p_code limit 1;
  if not found then return jsonb_build_object('ok', false, 'raison', 'inconnu'); end if;

  select * into d from public.rdv_dispo where user_id = r.user_id;
  select nullif(split_part(coalesce(p.name, ''), ' ', 1), '')
    into v_prenom from public.user_profiles p where p.id = r.user_id;
  -- Le nom court sert à le renvoyer choisir un autre créneau après annulation.
  select lp.slug into v_slug
    from public.rdv_lien_public lp where lp.user_id = r.user_id and lp.actif limit 1;

  return jsonb_build_object(
    'ok', true,
    'statut', r.statut,
    'passe', (r.date < current_date),
    'rdv', jsonb_build_object('id', r.id, 'date', r.date,
                              'heure', to_char(r.heure, 'HH24:MI'),
                              'duree_min', r.duree_min, 'nom', r.nom,
                              'adresse', concat_ws(', ', r.adresse, r.cp, r.ville)),
    'commercial', jsonb_build_object('prenom', coalesce(v_prenom, 'votre commercial'),
                                     'tel', d.tel, 'slug', v_slug));
end $function$;

-- ───────────────────────────────────────────────────────────────
-- 3. Annuler avec son code
--    Vaut pour les DEUX chemins. Et comme pour l'annulation par jeton de
--    campagne, on rouvre le lien de campagne s'il y en avait un : quelqu'un
--    qui annule veut le plus souvent DÉCALER, pas disparaître.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_annuler_code(p_code text, p_motif text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare r public.rdv; v_n int; v_slug text;
begin
  if p_motif is not null and char_length(p_motif) > 300 then
    return jsonb_build_object('ok', false, 'raison', 'motif_trop_long');
  end if;
  if p_code is null or char_length(p_code) not between 6 and 16 then
    return jsonb_build_object('ok', false, 'raison', 'inconnu');
  end if;

  select * into r from public.rdv where code = p_code limit 1;
  if not found then return jsonb_build_object('ok', false, 'raison', 'inconnu'); end if;

  if r.statut <> 'confirme' then
    return jsonb_build_object('ok', false, 'raison', 'deja_annule');
  end if;
  -- Annuler un rendez-vous passé ne rend service à personne et fausserait
  -- l'historique : on refuse proprement plutôt que de faire semblant.
  if r.date < current_date then
    return jsonb_build_object('ok', false, 'raison', 'passe');
  end if;

  update public.rdv
     set statut = 'annule', annule_le = now(), annule_motif = nullif(p_motif, '')
   where id = r.id and statut = 'confirme';
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', false, 'raison', 'deja_annule'); end if;

  -- S'il venait d'une campagne, son jeton redevient utilisable.
  if r.cip is not null then
    update public.rdv_lien
       set consomme_le = null
     where user_id = r.user_id and cip = r.cip and consomme_le is not null;
  end if;

  select lp.slug into v_slug
    from public.rdv_lien_public lp where lp.user_id = r.user_id and lp.actif limit 1;

  return jsonb_build_object('ok', true, 'slug', v_slug);
end $function$;

-- Appelables sans compte : c'est un pharmacien, il n'en a pas.
grant execute on function public.rdv_gerer(text)               to anon, authenticated;
grant execute on function public.rdv_annuler_code(text, text)  to anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 3 bis. Les deux fonctions de réservation rendent le code
--    Sans ça, l'écran de confirmation ne peut pas donner au pharmacien le
--    lien qui lui permettra de revenir. On ajoute UNE clé au JSON de sortie ;
--    tout le reste est identique, mot pour mot.
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

grant execute on function public.rdv_poser_public(
  uuid, date, time without time zone, text, text, text, text, text, double precision, double precision)
  to anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 4. Contrôles
-- ───────────────────────────────────────────────────────────────
select
  (select count(*) from public.rdv where code is null)              as sans_code_doit_etre_0,
  (select count(distinct code) = count(*) from public.rdv
     where code is not null)                                        as codes_tous_uniques,
  has_function_privilege('anon', 'public.rdv_gerer(text)', 'EXECUTE')              as anon_peut_lire,
  has_function_privilege('anon', 'public.rdv_annuler_code(text, text)', 'EXECUTE') as anon_peut_annuler;

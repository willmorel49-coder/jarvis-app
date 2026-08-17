-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — le contrôle qui va JUSQU'À RÉSERVER (17/08/2026)
--
-- POURQUOI. Le robot `gardien-rdv.yml` vérifie qu'un lien s'ouvre et que la
-- base répond. Il ne va **pas jusqu'à réserver** — et c'est exactement le trou
-- par lequel est passée la panne du 13/08 : `rdv_poser_public` écrivait
-- `origine = 'lien_public'` alors que la table n'acceptait que ('mailing',
-- 'manuel'). Le pharmacien voyait ses créneaux, choisissait son horaire, et
-- se faisait refuser. **Aucune réservation par lien permanent n'avait jamais
-- abouti**, et tous les contrôles étaient au vert.
--
-- L'enjeu a grossi depuis : l'envoi groupé en copie cachée (17/08) repose
-- entièrement sur ce lien. Une réservation cassée, ce ne sont plus des
-- pharmaciens isolés, c'est un lot de 25 qui tape dans le mur d'un coup.
--
-- CE QUE FAIT CETTE FONCTION. Le parcours complet du pharmacien, côté
-- serveur : elle résout le nom court, lit la grille de disponibilités, choisit
-- un créneau réellement ouvert, et **appelle `rdv_poser_public` exactement
-- comme la page publique**. C'est le seul moyen d'éprouver les contraintes de
-- la table (celle qui a cassé), le verrou anti-chevauchement et les règles de
-- délai — un contrôle qui simule ne prouve rien.
--
-- TROIS PRÉCAUTIONS, parce qu'un gardien ne doit jamais salir ce qu'il garde :
--
--   1. **Il ne laisse RIEN.** La ligne de sonde est supprimée dans la même
--      transaction. Si le ménage échoue, la fonction le dit (`menage: false`)
--      et le robot part en erreur — mieux vaut une alerte de trop qu'un faux
--      rendez-vous oublié dans l'agenda d'un commercial.
--   2. **Il n'alerte personne.** Une insertion `confirme` déclenche une
--      notification push au commercial (`rdv_alerter`). Un robot quotidien lui
--      enverrait un faux rendez-vous chaque matin. La transaction est donc
--      marquée, et le déclencheur reconnaît cette marque.
--   3. **Il réserve LOIN.** Le créneau est cherché depuis l'horizon (≈ 6 mois)
--      en remontant, pas depuis demain : c'est la zone la moins disputée, donc
--      le risque de prendre la place d'un vrai pharmacien pendant la fraction
--      de seconde de la sonde est le plus faible possible.
--
-- Rejouable : tout est en "create or replace" / "if not exists".
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Le déclencheur d'alerte ignore la transaction de contrôle
--    Une seule ligne ajoutée. `set_config(..., true)` est LOCAL à la
--    transaction : la marque disparaît d'elle-même à la fin, et rien
--    d'extérieur ne peut la poser — aucune fonction exposée ne le permet.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_alerter()
returns trigger
language plpgsql security definer set search_path to 'public, extensions, vault'
as $function$
declare
  v_cle text;
begin
  -- ⚠️ Sonde du gardien : on enregistre pour de vrai (c'est tout l'intérêt),
  -- mais on ne réveille personne. Voir rdv_controle_reservation().
  if coalesce(current_setting('jarvis.controle', true), '') = 'on' then
    return new;
  end if;

  if new.statut is distinct from 'confirme' then return new; end if;
  if tg_op = 'UPDATE' and old.statut = 'confirme' then return new; end if;

  select decrypted_secret into v_cle
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_cle is null then return new; end if;   -- pas de coffre = pas d'alerte, jamais d'échec

  -- On n'attend pas la réponse : une notification qui ne part pas ne doit
  -- JAMAIS empêcher un rendez-vous d'être enregistré. Le pharmacien est en
  -- train de cliquer, c'est lui la priorité.
  perform net.http_post(
    url     := 'https://iyvavhnlhxksokkerkos.supabase.co/functions/v1/notifier',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_cle),
    body    := jsonb_build_object('rdv_id', new.id),
    timeout_milliseconds := 20000
  );
  return new;
end $function$;

-- ───────────────────────────────────────────────────────────────
-- 2. Le contrôle de bout en bout
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_controle_reservation(p_slug text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_token   uuid;
  v_uid     uuid;
  d         public.rdv_dispo;
  v_jours   jsonb;
  v_delai   int;
  v_horizon int;
  v_date    date;
  v_debut   date;
  v_plage   jsonb;
  v_heure   time;
  v_res     jsonb;
  v_id      uuid;
  v_raison  text;
  v_essais  int := 0;
  v_reste   int;
  c_jours_defaut constant jsonb := '{"1":[["09:00","12:30"],["14:00","18:00"]],
                                     "2":[["09:00","12:30"],["14:00","18:00"]],
                                     "3":[["09:00","12:30"],["14:00","18:00"]],
                                     "4":[["09:00","12:30"],["14:00","18:00"]],
                                     "5":[["09:00","12:30"],["14:00","18:00"]]}'::jsonb;
begin
  -- La marque qui empêche la notification. Locale à la transaction.
  perform set_config('jarvis.controle', 'on', true);

  -- ── Le lien ──────────────────────────────────────────────
  select lp.token, lp.user_id into v_token, v_uid
    from public.rdv_lien_public lp
   where lp.slug = p_slug and lp.actif
   limit 1;

  if v_token is null then
    return jsonb_build_object('ok', false, 'etape', 'lien',
      'raison', 'nom court inconnu, ou lien fermé par le commercial');
  end if;

  -- ── La grille ────────────────────────────────────────────
  select * into d from public.rdv_dispo where user_id = v_uid;
  v_delai   := coalesce(d.delai_min_jours, 3);
  v_horizon := coalesce(d.horizon_jours, 180);
  v_jours   := coalesce(d.jours, c_jours_defaut);
  if v_jours = '{}'::jsonb then v_jours := c_jours_defaut; end if;

  -- ── Chercher un créneau, EN PARTANT DE L'HORIZON ─────────
  -- On remonte depuis la date la plus lointaine autorisée : c'est la zone
  -- la moins disputée. 40 tentatives couvrent largement les week-ends,
  -- les demi-journées bloquées et les créneaux déjà pris.
  v_debut := current_date + v_horizon;
  while v_essais < 40 loop
    v_date := v_debut - v_essais;
    v_essais := v_essais + 1;
    if v_date < current_date + v_delai then
      exit;   -- on est redescendu sous le délai minimum : inutile de continuer
    end if;

    v_plage := v_jours -> to_char(extract(isodow from v_date), 'FM9');
    if v_plage is null or jsonb_array_length(v_plage) = 0 then
      continue;   -- jour non travaillé
    end if;

    v_heure := ((v_plage -> 0) ->> 0)::time;   -- début de la première plage

    v_res := public.rdv_poser_public(
      v_token, v_date, v_heure,
      'CONTROLE AUTOMATIQUE JARVIS', NULL, NULL,
      'gardien', NULL, NULL, NULL);

    if (v_res ->> 'ok')::boolean then
      v_id := ((v_res -> 'rdv') ->> 'id')::uuid;
      exit;
    end if;

    v_raison := v_res ->> 'raison';
    -- « pris » et « hors_grille » sont des refus NORMAUX sur un créneau
    -- donné : on essaie le jour précédent. Tout autre motif est un vrai
    -- problème et doit remonter tel quel.
    if v_raison not in ('pris', 'hors_grille') then
      return jsonb_build_object('ok', false, 'etape', 'reservation',
        'raison', v_raison, 'date', v_date, 'heure', to_char(v_heure, 'HH24:MI'));
    end if;
  end loop;

  if v_id is null then
    return jsonb_build_object('ok', false, 'etape', 'creneau',
      'raison', 'aucun créneau libre trouvé en 40 essais depuis l''horizon',
      'dernier_refus', v_raison);
  end if;

  -- ── Le ménage, dans la même transaction ──────────────────
  -- Ce n'est pas une suppression de donnée métier : c'est le retrait de la
  -- sonde que cette fonction vient elle-même de poser, deux instructions
  -- plus haut. Rien d'autre ne peut être visé — on filtre sur l'identifiant
  -- rendu par l'insertion.
  delete from public.rdv where id = v_id;
  get diagnostics v_reste = row_count;

  return jsonb_build_object(
    'ok', true,
    'reserve_le', to_char(v_date, 'YYYY-MM-DD') || ' ' || to_char(v_heure, 'HH24:MI'),
    'essais', v_essais,
    -- Si le ménage n'a pas retiré exactement une ligne, le robot doit hurler :
    -- un faux rendez-vous dans l'agenda d'un commercial est pire que la panne
    -- qu'on cherchait.
    'menage', (v_reste = 1)
  );
end $function$;

-- Le robot n'a AUCUNE clé, par conception : il appelle donc avec la clé
-- publique, comme un pharmacien. La fonction ne lit rien de confidentiel et
-- ne laisse rien derrière elle.
grant execute on function public.rdv_controle_reservation(text) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 3. Contrôles
-- ───────────────────────────────────────────────────────────────
-- a) La marque neutralise bien l'alerte : la ligne doit être présente.
select 'garde-fou alerte' as controle,
       position('jarvis.controle' in pg_get_functiondef(
         'public.rdv_alerter()'::regprocedure)) > 0 as pose;

-- b) La fonction existe et anon peut l'appeler.
select 'droit anon' as controle,
       has_function_privilege('anon', 'public.rdv_controle_reservation(text)', 'EXECUTE') as ok;

-- c) Aucun rendez-vous de contrôle ne doit JAMAIS subsister.
select 'sondes oubliees' as controle, count(*) as doit_etre_zero
  from public.rdv where nom = 'CONTROLE AUTOMATIQUE JARVIS';

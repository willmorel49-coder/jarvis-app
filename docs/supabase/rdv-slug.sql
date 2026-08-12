-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Un nom court à la place de l'identifiant illisible (12/08/2026)
--
-- Avant :  …/crm/v2/rdv.html?c=a5517181-9568-43bf-bf79-6ab011555df8
-- Après :  …/rdv/william
--
-- Le nom court n'est PAS un secret : il ne sert qu'à retrouver le jeton
-- actif du commercial. Le jeton, lui, reste en base et n'apparaît jamais
-- dans le lien. Conséquence utile : « Remplacer mon lien » continue de
-- fonctionner tout seul — le nom court ne bouge pas, le jeton derrière si.
-- ═══════════════════════════════════════════════════════════════

alter table public.rdv_lien_public add column if not exists slug text;

-- Minuscules, sans accent, sans espace : ce qui s'écrit dans une adresse.
alter table public.rdv_lien_public drop constraint if exists rdv_lien_public_slug_forme;
alter table public.rdv_lien_public add  constraint rdv_lien_public_slug_forme
  check (slug is null or slug ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$');

create unique index if not exists rdv_lien_public_slug_uniq
  on public.rdv_lien_public (slug) where slug is not null;

-- ───────────────────────────────────────────────────────────────
-- Fabrique un nom court à partir du prénom, et le rend unique en cas
-- d'homonyme (« pauline », puis « pauline-2 »). Deux Pauline dans
-- l'équipe : le cas est réel, pas théorique.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_slug_pour(p_user uuid)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_base text; v_essai text; n int := 1;
begin
  select lower(split_part(coalesce(p.name, ''), ' ', 1))
    into v_base from public.user_profiles p where p.id = p_user;
  -- Retire les accents puis tout ce qui n'est pas une lettre ou un chiffre.
  v_base := regexp_replace(
              translate(coalesce(nullif(v_base, ''), 'commercial'),
                        'àâäçéèêëîïôöùûüÿ', 'aaaceeeeiioouuuy'),
              '[^a-z0-9]', '', 'g');
  if v_base = '' then v_base := 'commercial'; end if;

  v_essai := v_base;
  while exists (select 1 from public.rdv_lien_public
                 where slug = v_essai and user_id <> p_user) loop
    n := n + 1;
    v_essai := v_base || '-' || n;
  end loop;
  return v_essai;
end $function$;

-- Attribue son nom court à chaque commercial qui n'en a pas encore.
update public.rdv_lien_public l
   set slug = public.rdv_slug_pour(l.user_id)
 where l.slug is null;

-- ───────────────────────────────────────────────────────────────
-- La page publique traduit le nom court en jeton. C'est le SEUL usage :
-- elle ne renvoie rien d'autre, et rien si le lien est fermé.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_slug_token(p_slug text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare l public.rdv_lien_public;
begin
  if p_slug is null or char_length(p_slug) > 32 then
    return jsonb_build_object('ok', false, 'raison', 'inconnu');
  end if;
  select * into l from public.rdv_lien_public where slug = lower(p_slug) limit 1;
  if not found   then return jsonb_build_object('ok', false, 'raison', 'inconnu'); end if;
  if not l.actif then return jsonb_build_object('ok', false, 'raison', 'ferme');   end if;
  return jsonb_build_object('ok', true, 'token', l.token);
end $function$;

grant execute on function public.rdv_slug_token(text) to anon, authenticated;

-- Un nouveau commercial reçoit son nom court sans que personne y pense.
create or replace function public.rdv_slug_auto()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.slug is null then new.slug := public.rdv_slug_pour(new.user_id); end if;
  return new;
end $function$;

drop trigger if exists rdv_slug_auto_t on public.rdv_lien_public;
create trigger rdv_slug_auto_t before insert on public.rdv_lien_public
  for each row execute function public.rdv_slug_auto();

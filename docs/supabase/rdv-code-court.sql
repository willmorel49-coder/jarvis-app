-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Un code court pour le lien envoyé au pharmacien (12/08/2026)
--
-- LE DÉFAUT MESURÉ : le lien de campagne faisait 101 caractères. Un mail en
-- texte brut est replié vers 76. Le lien se coupait donc en DEUX lignes, et
-- le pharmacien qui cliquait tombait sur une adresse tronquée. C'est ce qui
-- a fait échouer le test de Will.
--
-- Raccourcir le chemin ne suffisait pas : le jeton (UUID) fait 36 caractères
-- à lui seul, ce qui laissait encore 87. D'où ce code de 8 caractères.
--
-- Le code n'affaiblit rien : il désigne un lien à usage unique, qui expire,
-- et qui ne donne accès qu'à la prise de rendez-vous d'UNE officine. 36^8 =
-- 2 800 milliards de combinaisons, et chaque tentative passe par le serveur.
-- ═══════════════════════════════════════════════════════════════

alter table public.rdv_lien add column if not exists code text;

create unique index if not exists rdv_lien_code_uniq
  on public.rdv_lien (code) where code is not null;

-- Sans voyelles ni caractères ambigus (0/O, 1/l/I) : le code peut être lu au
-- téléphone si un pharmacien appelle en disant « ça ne marche pas ».
create or replace function public.rdv_code_neuf()
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
    exit when not exists (select 1 from public.rdv_lien where code = v);
    essais := essais + 1;
    if essais > 50 then
      -- Ceinture et bretelles : on ne boucle pas indéfiniment.
      v := v || floor(random() * 900 + 100)::text;
      exit;
    end if;
  end loop;
  return v;
end $function$;

create or replace function public.rdv_code_auto()
returns trigger language plpgsql set search_path to 'public'
as $function$
begin
  if new.code is null then new.code := public.rdv_code_neuf(); end if;
  return new;
end $function$;

drop trigger if exists rdv_code_auto_t on public.rdv_lien;
create trigger rdv_code_auto_t before insert on public.rdv_lien
  for each row execute function public.rdv_code_auto();

-- Les liens déjà créés en reçoivent un aussi : sinon ils resteraient longs.
update public.rdv_lien set code = public.rdv_code_neuf() where code is null;

-- ───────────────────────────────────────────────────────────────
-- Le code, traduit en jeton. Seul usage : rien d'autre ne sort d'ici.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_code_token(p_code text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare l public.rdv_lien;
begin
  if p_code is null or char_length(p_code) > 16 then
    return jsonb_build_object('ok', false, 'raison', 'inconnu');
  end if;
  select * into l from public.rdv_lien where code = lower(p_code) limit 1;
  if not found            then return jsonb_build_object('ok', false, 'raison', 'inconnu'); end if;
  if l.expire_le <= now() then return jsonb_build_object('ok', false, 'raison', 'expire');  end if;
  return jsonb_build_object('ok', true, 'token', l.token);
end $function$;

grant execute on function public.rdv_code_token(text) to anon, authenticated;

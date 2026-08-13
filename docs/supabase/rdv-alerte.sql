-- ═══════════════════════════════════════════════════════════════
-- JARVIS · L'alerte quand un pharmacien réserve (13/08/2026)
--
-- POURQUOI. Jusqu'ici, un rendez-vous pris ne prévenait personne. Le
-- commercial l'apprenait s'il pensait à ouvrir l'écran Rendez-vous — donc
-- parfois le jour même, parfois jamais.
--
-- LE CHOIX. Pas de mail : envoyer un mail depuis nos serveurs demanderait
-- un service d'envoi extérieur, donc un compte et une clé. On envoie une
-- notification sur le téléphone, avec nos propres clés VAPID, sans aucun
-- tiers et sans un centime.
--
-- ⚠️ SUR IPHONE, ça ne marche QUE si JARVIS a été ajouté à l'écran d'accueil
-- (« Partager » → « Sur l'écran d'accueil »). Ouvert dans l'onglet Safari,
-- iOS refuse les notifications web — ce n'est pas un réglage, c'est Apple.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Les téléphones abonnés. Un commercial peut en avoir plusieurs
--    (iPhone + ordinateur) : la clé, c'est l'adresse d'envoi (endpoint).
-- ───────────────────────────────────────────────────────────────
create table if not exists public.push_abo (
  id             bigserial primary key,
  user_id        uuid not null references auth.users(id) on delete restrict,
  endpoint       text not null unique,
  p256dh         text not null,
  auth           text not null,
  appareil       text,                    -- « iPhone de Will », pour s'y retrouver
  cree_le        timestamptz not null default now(),
  dernier_envoi  timestamptz,
  derniere_erreur text
);
create index if not exists push_abo_user on public.push_abo (user_id);

alter table public.push_abo enable row level security;

-- Rappel du piège déjà payé ici : une policy RLS SANS grant ne sert à rien.
revoke all on public.push_abo from anon, authenticated;
grant select, insert, update, delete on public.push_abo to authenticated;
grant select, insert, update, delete on public.push_abo to service_role;
grant usage, select on sequence public.push_abo_id_seq to authenticated;

drop policy if exists push_abo_sien on public.push_abo;
create policy push_abo_sien on public.push_abo
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────
-- 2. Le déclencheur. Dès qu'un rendez-vous confirmé apparaît, la base
--    appelle la fonction « notifier », qui pousse l'alerte.
--
--    Il ne se déclenche QUE sur un passage à « confirme » : sans ça, une
--    simple correction de numéro de téléphone re-sonnerait le téléphone.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_alerter()
returns trigger
language plpgsql security definer set search_path to 'public, extensions, vault'
as $function$
declare
  v_cle text;
begin
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

drop trigger if exists rdv_alerter_t on public.rdv;
create trigger rdv_alerter_t after insert or update of statut on public.rdv
  for each row execute function public.rdv_alerter();

-- ───────────────────────────────────────────────────────────────
-- Contrôles utiles :
--   select user_id, appareil, cree_le, dernier_envoi, derniere_erreur from push_abo;
--   select created, status_code, content from net._http_response order by created desc limit 5;
-- ───────────────────────────────────────────────────────────────

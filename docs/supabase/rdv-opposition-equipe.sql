-- ═══════════════════════════════════════════════════════════════
-- JARVIS · « Ne plus me solliciter » vaut pour TOUTE l'équipe (12/08/2026)
--
-- LE DÉFAUT : la clé de rdv_opposition était (user_id, cip). Une officine
-- qui dit stop à Karine continuait de recevoir les mailings de Morgane,
-- d'Arthur et de Florent. C'est exactement ce qui transforme une bonne
-- fonction en réclamation — et, sur une opposition à la prospection, ce
-- n'est pas seulement maladroit : le refus s'adresse à Intégral, pas à
-- la personne qui a envoyé le mail.
--
-- Appliqué pendant que la table est encore VIDE : aucune donnée en jeu.
-- On garde `user_id` pour savoir QUI a reçu le refus (utile au commercial
-- concerné), mais il ne fait plus partie de la clé de lecture.
-- ═══════════════════════════════════════════════════════════════

-- Une officine ne peut figurer qu'UNE fois, quel que soit le commercial.
drop index if exists public.rdv_opposition_user_cip_uniq;
alter table public.rdv_opposition drop constraint if exists rdv_opposition_pkey cascade;
alter table public.rdv_opposition drop constraint if exists rdv_opposition_user_id_cip_key;

create unique index if not exists rdv_opposition_cip_uniq
  on public.rdv_opposition (cip);

-- Qui a enregistré le refus, et quand : on le garde pour pouvoir en parler,
-- pas pour filtrer.
alter table public.rdv_opposition add column if not exists cree_le timestamptz default now();

-- ───────────────────────────────────────────────────────────────
-- Enregistrer un refus : il vaut désormais pour tout le monde.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_opposer(p_cip text, p_motif text default 'STOP')
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v_user uuid := auth.uid();
begin
  if v_user is null then return jsonb_build_object('ok', false, 'raison', 'connexion_requise'); end if;
  if p_cip is null or char_length(p_cip) < 3 or char_length(p_cip) > 20 then
    return jsonb_build_object('ok', false, 'raison', 'cip_invalide');
  end if;
  if coalesce(char_length(p_motif), 0) > 200 then
    return jsonb_build_object('ok', false, 'raison', 'motif_trop_long');
  end if;

  insert into public.rdv_opposition (user_id, cip, motif)
  values (v_user, p_cip, coalesce(nullif(p_motif, ''), 'STOP'))
  on conflict (cip) do update set motif = excluded.motif;

  return jsonb_build_object('ok', true);
end $function$;

-- La liste des officines à ne plus solliciter, pour TOUT le monde.
create or replace function public.rdv_opposes()
returns setof text
language sql security definer set search_path to 'public'
as $function$
  select cip from public.rdv_opposition where cip is not null
$function$;

grant execute on function public.rdv_opposer(text, text) to authenticated;
grant execute on function public.rdv_opposes() to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Remplacer les plages occupées SANS créer de doublons (14/08/2026)
--
-- ⚠️ Bug constaté en production le 14/08/2026 : 50 lignes dans rdv_occupe
-- au lieu de 25, CHAQUE créneau en double. L'écran affichait donc chaque
-- rendez-vous deux fois.
--
-- La cause : la fonction `relever` faisait un DELETE puis un INSERT, sans
-- rien pour empêcher deux relèves de se croiser. Or elles se croisent
-- vraiment — le robot passe toutes les 15 minutes, l'app relève quand un
-- écran s'ouvre, et le pharmacien en déclenche une en ouvrant son lien.
-- L'entrelacement suffit :
--     A supprime · B supprime · A insère 25 · B insère 25  →  50 lignes
--
-- La réponse : tout dans UNE transaction, et un verrou consultatif par
-- commercial pour que deux relèves du même agenda se fassent l'une après
-- l'autre. Le verrou est posé sur la transaction : il se libère seul, même
-- si la fonction échoue.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.rdv_occupe_remplacer(p_user uuid, p_plages jsonb)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n int;
begin
  -- Deux relèves du même agenda ne peuvent plus se chevaucher. Les relèves
  -- d'agendas DIFFÉRENTS ne s'attendent pas : le verrou porte sur l'id.
  perform pg_advisory_xact_lock(hashtext(p_user::text));

  delete from public.rdv_occupe where user_id = p_user;

  insert into public.rdv_occupe (user_id, date, debut, fin, jour_entier)
  select p_user,
         (e->>'date')::date,
         (e->>'debut')::time,
         (e->>'fin')::time,
         coalesce((e->>'jour_entier')::boolean, false)
  from jsonb_array_elements(coalesce(p_plages, '[]'::jsonb)) e;

  get diagnostics n = row_count;
  return n;
end $function$;

-- Seule la fonction serveur, avec la clé de service, relève un agenda.
-- Un commercial ne doit pas pouvoir réécrire ses propres heures occupées.
--
-- ⚠️ `revoke ... from public` retire AUSSI le droit à `service_role`, qui
-- l'héritait du rôle PUBLIC. Sans le `grant` qui suit, la fonction répond
-- `42501 permission denied` — et l'appel côté serveur échouait EN SILENCE :
-- la relève annonçait « 25 plages gardées » pendant que la base ne bougeait
-- pas d'une ligne. Même piège que « une policy RLS sans grant ne sert à
-- rien », déjà payé sur ce projet.
revoke all on function public.rdv_occupe_remplacer(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.rdv_occupe_remplacer(uuid, jsonb) to service_role;

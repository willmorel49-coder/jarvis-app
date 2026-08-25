-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — les journées ouvertes à la réservation (25/08/2026)
--
-- « on doit pouvoir choisir de donner accès à la prise de rdv que aux jours
--   où il y a 0 rdv » (Will), puis, interrogé sur la règle exacte :
--   « je veux décider jour par jour », pour « toute l'équipe ».
--
-- POURQUOI. Jusqu'ici, toute journée conforme à la grille horaire était
-- offerte aux pharmaciens. Un commercial dont l'agenda personnel est chargé
-- se voyait proposer des visites en marge de ses réunions, sans pouvoir dire
-- « cette journée-là, je ne prends personne ».
--
-- ⚠️ MÊMES PRUDENCES QUE LE SECTEUR DU JOUR (rdv-secteur-du-jour.sql) :
--   1. par défaut, RIEN NE CHANGE pour personne. `jours_choisis` vaut false :
--      toutes les journées restent ouvertes, comme avant. La fonctionnalité
--      est livrée à toute l'équipe mais ne s'active que sur décision.
--   2. en mode normal, `ouvert = false` ferme UNE journée ponctuellement ;
--      `ouvert` à NULL veut dire « pas d'avis », pas « fermé ».
--   3. en mode « je choisis mes jours », seules les journées explicitement
--      cochées (`ouvert = true`) sont offertes.
--
-- ⚠️ Le contrôle est POSÉ CÔTÉ SERVEUR, pas seulement dans le navigateur :
--    un lien de réservation ouvert dans un onglet resté ouvert la veille
--    contournerait un filtre purement visuel.
--
-- Rejouable : « if not exists » / « create or replace » partout.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. L'avis du commercial sur UNE journée.
--    On réutilise la table du secteur du jour : même clé (user_id, date),
--    même objet métier — « ce que je déclare pour ce jour-là ». Créer une
--    seconde table aurait fait deux endroits à lire, à écrire et à garder
--    d'accord ; c'est la famille de pannes du 13/08.
-- ───────────────────────────────────────────────────────────────
alter table public.rdv_secteur_jour
  add column if not exists ouvert boolean;                  -- NULL = pas d'avis

comment on column public.rdv_secteur_jour.ouvert is
  'true = journée offerte aux pharmaciens · false = fermée · NULL = pas d''avis (comportement par défaut)';

-- ───────────────────────────────────────────────────────────────
-- 2. Le mode, par commercial.
--    false (défaut) : tout est ouvert sauf ce qui est fermé à la main.
--    true            : rien n'est ouvert sauf ce qui est coché.
-- ───────────────────────────────────────────────────────────────
alter table public.rdv_dispo
  add column if not exists jours_choisis boolean not null default false;

comment on column public.rdv_dispo.jours_choisis is
  'true = seules les journées cochées (rdv_secteur_jour.ouvert) sont offertes aux pharmaciens';

-- ───────────────────────────────────────────────────────────────
-- 3. La règle, en UN SEUL endroit — appelée par le serveur ET reflétée par
--    le navigateur. Deux chemins qui décident la même chose finissent par
--    décider différemment : ici, le navigateur ne fait qu'afficher ce que
--    cette fonction autorise.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rdv_jour_ouvert(p_user uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    -- Mode « je choisis mes jours » : il faut un oui explicite.
    when coalesce((select jours_choisis from public.rdv_dispo where user_id = p_user), false)
      then coalesce((select ouvert from public.rdv_secteur_jour
                     where user_id = p_user and date = p_date), false)
    -- Mode normal : ouvert, sauf refus explicite. NULL ne ferme jamais.
    else coalesce((select ouvert from public.rdv_secteur_jour
                   where user_id = p_user and date = p_date), true)
  end;
$$;

revoke all on function public.rdv_jour_ouvert(uuid, date) from public;
grant execute on function public.rdv_jour_ouvert(uuid, date) to authenticated, anon, service_role;

-- ───────────────────────────────────────────────────────────────
-- 4. Droits de table. ⚠️ Une colonne ajoutée hérite des droits de la table,
--    mais on le redit : une table créée en SQL brut ne reçoit AUCUN droit,
--    et l'app bascule alors en silence sur un comportement dégradé (10/08).
-- ───────────────────────────────────────────────────────────────
grant select, insert, update on table public.rdv_secteur_jour to authenticated;
grant select, update           on table public.rdv_dispo       to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 5. LES QUATRE FONCTIONS TOUCHÉES — appliqué le 25/08/2026
--
-- ⚠️ Elles n'ont PAS été réécrites ici : elles ont été modifiées par
-- insertion à partir de `pg_get_functiondef()`, pour ne pas recopier 100
-- lignes à la main et risquer d'en perdre une au passage. Ce paragraphe
-- existe pour que le dépôt ne mente pas sur l'état réel de la base.
--
--   · rdv_poser        ─┐ un bloc ajouté JUSTE APRÈS le contrôle
--   · rdv_poser_public ─┘ `rdv_secteur_ok`, dans le même esprit :
--
--        if not public.rdv_jour_ouvert(<l|lp>.user_id, p_date) then
--          return jsonb_build_object('ok', false, 'raison', 'jour_ferme');
--        end if;
--
--   · rdv_fenetre           ─┐ deux ajouts à la réponse JSON :
--   · rdv_fenetre_publique  ─┘   - 'ouvert', s.ouvert  dans chaque entrée
--                                  de `secteurs` ;
--                                - 'jours_choisis', coalesce(d.jours_choisis,
--                                  false)  dans `dispo`.
--
-- POUR REJOUER ce même changement sur une base neuve, ou après un
-- rétablissement qui aurait ramené d'anciennes versions :
--
--   1. vérifier ce qui manque —
--        select proname, pg_get_functiondef(oid) like '%rdv_jour_ouvert%'
--          from pg_proc where proname in ('rdv_poser','rdv_poser_public');
--        select proname, pg_get_functiondef(oid) like '%jours_choisis%'
--          from pg_proc where proname in ('rdv_fenetre','rdv_fenetre_publique');
--   2. si l'une répond `false`, réinsérer le bloc correspondant ci-dessus
--      dans sa définition courante, puis rejouer le `create or replace`.
--
-- Le contrôle de bout en bout (`scripts/verifier-rdv.py`) rejoue une vraie
-- réservation : il tombe en rouge si l'une de ces fonctions a été perdue.

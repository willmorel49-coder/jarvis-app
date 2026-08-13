-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Le robot qui relit les agendas toutes les 15 minutes (13/08/2026)
--
-- POURQUOI. Jusqu'ici, l'agenda d'un commercial n'était relu que si un
-- pharmacien ouvrait un lien de campagne. Constaté en prod le 13/08/2026 :
-- le seul agenda branché n'avait pas bougé depuis 19 h. Les créneaux
-- proposés reposaient donc sur une photo de la veille — bloquer son jeudi
-- après-midi dans Google Agenda ne protégeait de rien.
--
-- Ce robot tourne côté base, sans machine allumée, sans service payant :
-- pg_cron déclenche, pg_net appelle la fonction « agenda », qui relit les
-- flux iCal et remplace les plages occupées.
--
-- ⚠️ LA CLÉ N'EST PAS DANS CE FICHIER. Le dépôt jarvis-app est PUBLIC. La
-- clé de service vit dans le coffre Supabase (vault), et n'en sort que
-- pendant l'exécution du cron. À poser UNE fois, hors dépôt :
--
--   select vault.create_secret('<clé de service>', 'service_role_key',
--                              'Robot de relève des agendas');
--
-- ⚠️ QUELLE clé : celle que la fonction reçoit dans SUPABASE_SERVICE_ROLE_KEY,
-- soit la clé secrète nouveau format « sb_secret_… », PAS l'ancienne clé
-- service_role au format JWT « eyJ… ». Le projet possède les deux et l'API les
-- liste toutes les deux ; se tromper donne un « interdit » que rien n'explique.
-- Correction :
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'service_role_key'), '<clé>');
--
-- ⚠️ ET CE QUE LE ROBOT NE PEUT PAS FAIRE. Il garantit que NOUS lisons
-- l'agenda toutes les 15 minutes. Il ne garantit pas que Google ait publié
-- la dernière minute dans son flux iCal : la fraîcheur de ce flux dépend de
-- Google seul. Pour vérifier ce que ça donne vraiment : ajouter un
-- événement dans son agenda, attendre, et regarder l'écran « Mon agenda ».
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Rejouable : on retire la version précédente sans échouer si elle n'existe pas.
do $$
begin
  perform cron.unschedule('rdv-agenda-releve');
exception when others then
  null;
end $$;

select cron.schedule(
  'rdv-agenda-releve',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://iyvavhnlhxksokkerkos.supabase.co/functions/v1/agenda',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (
                   select decrypted_secret from vault.decrypted_secrets
                    where name = 'service_role_key' limit 1)),
    body    := jsonb_build_object('action', 'relever_tous'),
    -- Un agenda chargé met quelques secondes ; 45 s couvre plusieurs
    -- commerciaux d'affilée sans jamais bloquer la base.
    timeout_milliseconds := 45000
  );
  $cron$
);

-- ───────────────────────────────────────────────────────────────
-- Contrôles utiles (à lancer à la main) :
--
--   -- le robot est-il programmé ?
--   select jobname, schedule, active from cron.job where jobname = 'rdv-agenda-releve';
--
--   -- ses derniers passages
--   select status, start_time, return_message from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'rdv-agenda-releve')
--    order by start_time desc limit 5;
--
--   -- ce que la fonction a répondu
--   select created, status_code, content from net._http_response order by created desc limit 5;
--
--   -- et surtout : l'agenda est-il frais ?
--   select hote, dernier_ok, derniere_erreur, plages_gardees from rdv_agenda;
-- ───────────────────────────────────────────────────────────────

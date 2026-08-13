-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Réparer la prise de RDV par lien permanent (13/08/2026)
--
-- LE BUG. `rdv_poser_public` — la fonction appelée quand un pharmacien
-- réserve depuis le lien permanent d'un commercial (rdv/william.html,
-- rdv/pascale.html) — enregistre le rendez-vous avec `origine =
-- 'lien_public'`. Or la table n'acceptait que 'mailing' et 'manuel' :
--
--   CHECK (origine = ANY (ARRAY['mailing', 'manuel']))
--
-- Résultat : le pharmacien voyait bien les créneaux, choisissait son
-- horaire, remplissait son nom… et recevait « Enregistrement impossible.
-- Merci de réessayer. » **Aucune réservation par lien permanent n'a
-- jamais pu aboutir.** Le bloc `exception` de la fonction n'attrape que
-- les conflits de créneau (unique/exclusion), pas une violation de
-- contrainte : l'erreur remontait donc brute jusqu'à la page.
--
-- Trouvé le 13/08/2026 en rejouant le parcours complet du pharmacien sur
-- la vraie page en ligne. Le chemin campagne (`origine = 'mailing'`)
-- n'est PAS touché, lui a toujours fonctionné.
--
-- LE CORRECTIF. On élargit la règle plutôt que de changer la valeur
-- écrite : distinguer un rendez-vous venu du lien permanent d'un
-- rendez-vous venu d'une campagne a une vraie valeur — c'est ce qui
-- permettra de savoir lequel des deux canaux fait signer.
-- ═══════════════════════════════════════════════════════════════

alter table public.rdv drop constraint if exists rdv_origine_check;

alter table public.rdv add constraint rdv_origine_check
  check (origine in ('mailing', 'manuel', 'lien_public'));

-- Contrôle : doit lister les trois valeurs.
select pg_get_constraintdef(oid) as regle
  from pg_constraint
 where conrelid = 'public.rdv'::regclass and conname = 'rdv_origine_check';

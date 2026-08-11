-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Droits du compte de service sur les tables RDV (11/08/2026)
--
-- LE PIÈGE, RENCONTRÉ POUR LA DEUXIÈME FOIS SUR CE PROJET :
-- une table créée par migration n'accorde AUCUN droit. Le 10/08 c'était
-- `authenticated` et l'app répondait « permission denied ». Aujourd'hui
-- c'est `service_role`, et c'est PIRE : la fonction serveur ne reçoit
-- aucune erreur, juste une liste vide. Elle répondait donc
-- « jeton inconnu » sur un jeton parfaitement valide.
--
-- `service_role` contourne la RLS, mais PAS les droits de table. Les deux
-- sont nécessaires. Toujours vérifier avec has_table_privilege(), jamais
-- supposer que « ça marche parce que c'est le compte de service ».
--
-- Conséquence utile : la sauvegarde peut enfin lire les rendez-vous de
-- TOUS les commerciaux (avec la clé de service), là où le robot actuel,
-- connecté comme un simple utilisateur, ne voyait que ses propres lignes.
-- ═══════════════════════════════════════════════════════════════
grant select, insert, update, delete on
  public.rdv, public.rdv_dispo, public.rdv_blocage, public.rdv_lien,
  public.rdv_opposition, public.rdv_agenda, public.rdv_occupe
  to service_role;

grant usage, select on sequence public.rdv_occupe_id_seq to service_role;

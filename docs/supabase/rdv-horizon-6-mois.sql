-- ═══════════════════════════════════════════════════════════════
-- JARVIS · L'horizon de réservation passe à SIX mois (13/08/2026)
--
-- Will : « il faut que ce soit un vrai agenda avec pilotage du mois en
-- cours mais aussi des suivants pendant 6 prochains mois ».
--
-- ⚠️ LA VALEUR VIT À QUATRE ENDROITS. N'en changer qu'une partie donne le
-- pire des défauts : une date affichée au pharmacien, qu'il choisit, et
-- que le serveur refuse ensuite avec « trop_loin ».
--   1. DEFAUT_DISPO.horizon_jours — crm/v2/v2-rdv-creneaux.js
--   2. la colonne rdv_dispo.horizon_jours, qui ÉCRASE le repli du n°1
--   3. le coalesce EN DUR de rdv_poser (rdv-socle.sql) et de
--      rdv_poser_public (rdv-lien-public.sql) — un `set default` ne le
--      couvre JAMAIS, il ne sert que si la ligne rdv_dispo est absente
--   4. le default de la table dans rdv.sql, pour une base reconstruite
--
-- Le 13/08 au matin, en passant de 21 à 90, les points 3 et 4 avaient été
-- oubliés et rattrapés par le sous-agent gardien-deploiement.
-- ═══════════════════════════════════════════════════════════════

alter table public.rdv_dispo alter column horizon_jours set default 180;

-- On ne touche qu'aux réglages laissés par défaut : si un commercial a
-- volontairement choisi une autre valeur un jour, on ne l'écrase pas.
update public.rdv_dispo set horizon_jours = 180 where horizon_jours in (21, 90);

select user_id, horizon_jours from public.rdv_dispo;

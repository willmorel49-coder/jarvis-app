-- ═══════════════════════════════════════════════════════════════
-- JARVIS · Réserver jusqu'à trois mois, plus seulement trois semaines
-- (13/08/2026)
--
-- POURQUOI. Une officine qui n'est pas disponible dans les trois prochaines
-- semaines n'avait aucune porte de sortie : elle refermait le lien, et le
-- rendez-vous se perdait. L'horizon passe donc à 90 jours.
--
-- ⚠️ LE PIÈGE. La valeur vit à TROIS endroits, et les trois doivent bouger :
--
--   1. `DEFAUT_DISPO.horizon_jours` dans crm/v2/v2-rdv-creneaux.js — le repli
--      côté navigateur.
--   2. la colonne `rdv_dispo.horizon_jours`, renvoyée par rdv_fenetre : elle
--      ÉCRASE le repli du navigateur. Ne changer que le JavaScript ne produit
--      donc AUCUN effet visible — vérifié le 13/08, la page continuait de
--      s'arrêter exactement 21 jours plus loin.
--   3. le repli EN DUR des fonctions qui ENREGISTRENT le rendez-vous :
--      `coalesce(d.horizon_jours, 21)` dans `rdv_poser` (rdv-socle.sql) et
--      `rdv_poser_public` (rdv-lien-public.sql). Celui-là ne sert que pour un
--      commercial qui n'a AUCUNE ligne dans rdv_dispo — un `alter column set
--      default` ne le couvre jamais.
--
-- Oublier le n°3 crée le pire des défauts : une date affichée au pharmacien,
-- qu'il choisit, et que le serveur refuse ensuite avec « trop_loin ». Avant ce
-- lot ce n'était pas un bug — les trois valaient 21. C'est en n'en changeant
-- qu'une partie qu'on casse la cohérence. Trouvé par le sous-agent
-- `gardien-deploiement`, pas par moi.
--
-- Vérifié après correction : réservation acceptée au 06/10/2026, soit J+54.
--
-- Ce que ça ne change pas : les TROIS dates mises en avant restent choisies
-- pour la cohérence de la tournée (règle « aimant »). Les trois mois ne
-- s'ouvrent que derrière « Voir d'autres dates ».
-- ═══════════════════════════════════════════════════════════════

-- Le repli pour les commerciaux qui n'ont pas encore réglé leurs dispos.
alter table public.rdv_dispo alter column horizon_jours set default 90;

-- Et les réglages déjà enregistrés : personne n'a jamais choisi 21 à la main,
-- c'était l'ancienne valeur par défaut. On ne touche donc qu'à celles-là,
-- pour ne pas écraser un réglage volontaire d'un commercial.
update public.rdv_dispo set horizon_jours = 90 where horizon_jours = 21;

select user_id, horizon_jours from public.rdv_dispo;

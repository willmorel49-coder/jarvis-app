-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — savoir si le pharmacien a ouvert le lien (25/08/2026)
--
-- POURQUOI. Mesuré le 25/08/2026 : 3 liens envoyés, 0 réservation. Entre le
-- clic de Will sur « Envoyer » et une réservation, il n'y avait AUCUNE trace.
-- Impossible de distinguer trois situations qui appellent trois réponses
-- très différentes :
--     · le mail n'est jamais arrivé            → vérifier l'adresse
--     · il est arrivé mais n'a pas été ouvert  → relancer, ou téléphoner
--     · le lien a été ouvert puis abandonné    → le problème est la page,
--                                                 ou les créneaux proposés
-- Relancer à l'aveugle quelqu'un qui n'a jamais reçu le mail ne sert à rien.
--
-- ⚠️ CE QU'ON NE MESURE PAS, ET CE N'EST PAS UN OUBLI.
-- Aucune adresse IP, aucune empreinte de navigateur, aucun pixel espion,
-- aucun service tiers. Trois colonnes seulement : la première ouverture, la
-- dernière, et combien de fois. C'est le strict nécessaire pour décider s'il
-- faut relancer — et rien qui permette de suivre une personne.
-- Le lien a été envoyé nominativement à cette officine : savoir qu'il a été
-- ouvert, c'est savoir que le mail est arrivé, pas surveiller quelqu'un.
--
-- ⚠️ Ce compteur ne dit PAS « le pharmacien a lu le mail » : il dit « le lien
-- a été ouvert ». Un mail peut être lu sans qu'on clique. Ne jamais présenter
-- « 0 ouverture » comme « il n'a pas lu ».
--
-- Rejouable : « if not exists » / « create or replace » partout.
-- ═══════════════════════════════════════════════════════════════

alter table public.rdv_lien
  add column if not exists vu_le          timestamptz,   -- première ouverture
  add column if not exists vu_dernier_le  timestamptz,   -- dernière ouverture
  add column if not exists vues           integer not null default 0;

comment on column public.rdv_lien.vu_le is
  'Première ouverture de la page par le pharmacien. NULL = jamais ouverte.';
comment on column public.rdv_lien.vues is
  'Nombre d''ouvertures de la page. Aucune donnée personnelle n''est collectée.';

-- Un index pour la seule question qu'on pose vraiment : « qu'est-ce qui a été
-- envoyé, jamais ouvert, et attend depuis longtemps ? »
create index if not exists rdv_lien_jamais_vu
  on public.rdv_lien (user_id, envoye_le)
  where vu_le is null and consomme_le is null;

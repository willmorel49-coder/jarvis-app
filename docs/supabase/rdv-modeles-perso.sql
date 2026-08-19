-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — les modèles de mail écrits par le commercial (19/08/2026)
--
-- POURQUOI. Les trois motifs (bilan / offre / routine) sont écrits une fois
-- pour huit personnes. Celui qui n'aime pas le texte n'avait qu'une sortie :
-- ne pas se servir du module. Ici chacun écrit les siens, avec des étiquettes
-- ({{officine}}, {{mois}}, {{ca}}…) que JARVIS remplit à l'envoi.
--
-- CE QUI RESTE IMPOSÉ CÔTÉ APPLICATION, et n'a donc pas de colonne ici :
-- la signature et la mention STOP sont ajoutées par le moteur. La mention
-- STOP est une promesse écrite que l'écran de suivi honore réellement ;
-- elle ne peut pas dépendre de ce qu'un auteur pense à recopier.
--
-- ⚠️ PAS DE DELETE POUR L'APPLICATION. Un modèle supprimé casserait la
-- lecture des envois passés qui le citent. Colonne `archive`, comme partout
-- ailleurs dans JARVIS.
--
-- Rejouable : tout est en "if not exists" / "drop … if exists".
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. La table
--    `restrict` et non `cascade` : un commercial qui part n'efface pas des
--    textes que l'équipe peut vouloir relire. Même règle que rdv-socle.sql.
-- ───────────────────────────────────────────────────────────────
create table if not exists public.rdv_modele (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete restrict,
  nom      text not null,
  objet    text not null,
  corps    text not null,
  archive  boolean not null default false,
  cree_le  timestamptz not null default now(),
  maj_le   timestamptz not null default now()
);
create index if not exists rdv_modele_user
  on public.rdv_modele (user_id, archive, maj_le desc);

-- Longueurs maximales. Ces textes viennent d'un commercial connecté, pas
-- d'un inconnu — mais une base gratuite se remplit aussi par accident, et
-- un corps de 200 000 caractères ne rentrerait dans aucun mail de toute façon.
alter table public.rdv_modele drop constraint if exists rdv_modele_nom_len;
alter table public.rdv_modele add  constraint rdv_modele_nom_len
  check (char_length(nom) between 2 and 80);

alter table public.rdv_modele drop constraint if exists rdv_modele_objet_len;
alter table public.rdv_modele add  constraint rdv_modele_objet_len
  check (char_length(objet) between 3 and 300);

alter table public.rdv_modele drop constraint if exists rdv_modele_corps_len;
alter table public.rdv_modele add  constraint rdv_modele_corps_len
  check (char_length(corps) between 20 and 6000);

-- ───────────────────────────────────────────────────────────────
-- 2. Les deux traces d'envoi doivent pouvoir NOMMER un modèle personnel
--    ⚠️ Sans ça, rien ne marche : `rdv_lien.modele` porte un CHECK limité
--    aux trois motifs, et l'insertion du jeton — donc la création du lien,
--    donc tout l'envoi — échouerait dès le premier modèle personnel.
--    On garde la contrainte, on l'élargit : « perso:<uuid> ».
--    Volontairement du texte libre et non une clé étrangère : la trace de
--    ce qui est parti doit survivre à l'archivage du modèle.
-- ───────────────────────────────────────────────────────────────
alter table public.rdv_lien  drop constraint if exists rdv_lien_modele_check;
alter table public.rdv_lien  add  constraint rdv_lien_modele_check
  check (modele in ('bilan','offre','routine')
         or (modele like 'perso:%' and char_length(modele) <= 48));

alter table public.rdv_envoi drop constraint if exists rdv_envoi_modele_check;
alter table public.rdv_envoi add  constraint rdv_envoi_modele_check
  check (modele in ('bilan','offre','routine')
         or (modele like 'perso:%' and char_length(modele) <= 48));

-- ───────────────────────────────────────────────────────────────
-- 3. Les verrous
--    ⚠️ Il faut LES DEUX : le grant ET la policy. Une policy sans grant
--    répond « permission denied » même connecté, et l'app bascule en
--    silence sur son repli local — piège payé le 10/08 sur maquette_notes.
--    `anon` n'a aucun accès : la page publique ne lit jamais un modèle.
-- ───────────────────────────────────────────────────────────────
alter table public.rdv_modele enable row level security;
revoke all on public.rdv_modele from anon;
grant select, insert, update on public.rdv_modele to authenticated;
grant all                    on public.rdv_modele to service_role;

-- Chacun ne voit et n'écrit QUE les siens. Un modèle est une façon de
-- parler, pas une donnée d'équipe : personne n'a à relire celle d'un autre.
drop policy if exists rdv_modele_sien on public.rdv_modele;
create policy rdv_modele_sien on public.rdv_modele
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- `maj_le` posé par le serveur : une horloge de navigateur peut être fausse,
-- et c'est cette colonne qui ordonne la liste.
create or replace function public.rdv_modele_touch()
returns trigger language plpgsql as $$
begin
  new.maj_le := now();
  return new;
end $$;

drop trigger if exists rdv_modele_touch_t on public.rdv_modele;
create trigger rdv_modele_touch_t before update on public.rdv_modele
  for each row execute function public.rdv_modele_touch();

-- ───────────────────────────────────────────────────────────────
-- 4. Contrôle — doit renvoyer `true` partout.
-- ───────────────────────────────────────────────────────────────
select
  has_table_privilege('authenticated', 'public.rdv_modele', 'SELECT') as auth_lit,
  has_table_privilege('authenticated', 'public.rdv_modele', 'INSERT') as auth_ecrit,
  has_table_privilege('authenticated', 'public.rdv_modele', 'UPDATE') as auth_modifie,
  not has_table_privilege('authenticated', 'public.rdv_modele', 'DELETE') as pas_de_delete,
  has_table_privilege('service_role',  'public.rdv_modele', 'SELECT') as svc_lit,
  (select relrowsecurity from pg_class where oid = 'public.rdv_modele'::regclass) as rls_active;

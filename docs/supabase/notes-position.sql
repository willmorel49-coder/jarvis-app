-- Réordonner les notes d'une fiche par drag & drop (demande Pauline G., 10/09/2026).
-- Ajoute une colonne d'ordre à la table `notes` et l'initialise avec l'ordre
-- actuellement affiché (plus récent en premier), pour ne rien changer à l'écran
-- tant que personne n'a encore glissé une note.
-- À exécuter UNE FOIS dans l'éditeur SQL Supabase.

alter table notes add column if not exists position integer;

update notes n
set position = sub.rn
from (
  select id, row_number() over (partition by scope_type, scope_id order by created_at desc) as rn
  from notes
) sub
where n.id = sub.id and n.position is null;

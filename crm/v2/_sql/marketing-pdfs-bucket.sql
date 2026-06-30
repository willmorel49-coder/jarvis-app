-- ════════════════════════════════════════════════════════════════
-- Stockage partagé des PDF Marketing (CRM JARVIS)
-- À coller UNE SEULE FOIS dans Supabase > SQL Editor > Run.
-- Crée le dossier partagé "marketing-pdfs" + les droits :
--   • lecture par tout le monde (pour ouvrir les PDF)
--   • ajout / suppression réservés aux comptes connectés
-- Après ça : onglet Marketing > Documents partagés fonctionne pour TOUS les comptes.
-- ════════════════════════════════════════════════════════════════

-- 1) Le "dossier" public
insert into storage.buckets (id, name, public)
values ('marketing-pdfs', 'marketing-pdfs', true)
on conflict (id) do update set public = true;

-- 2) Lecture publique (ouvrir / télécharger les PDF)
drop policy if exists "marketing_pdfs_read" on storage.objects;
create policy "marketing_pdfs_read"
  on storage.objects for select
  using ( bucket_id = 'marketing-pdfs' );

-- 3) Ajout réservé aux comptes connectés
drop policy if exists "marketing_pdfs_insert" on storage.objects;
create policy "marketing_pdfs_insert"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'marketing-pdfs' );

-- 4) Suppression réservée aux comptes connectés
drop policy if exists "marketing_pdfs_delete" on storage.objects;
create policy "marketing_pdfs_delete"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'marketing-pdfs' );

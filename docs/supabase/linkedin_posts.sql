-- Table des posts LinkedIn (rétroplanning éditorial)
create table if not exists public.linkedin_posts (
  id text primary key,
  date timestamptz,
  status text default 'idee',
  pillar text default 'produit',
  title text default '',
  body text default '',
  image_path text default '',
  format text default '',
  image_brief text default '',
  linkedin_url text default '',
  event_id text default '',
  event_name text default '',
  source text default 'manuel',
  owner text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Si la table existe déjà, ajouter la colonne format :
alter table public.linkedin_posts add column if not exists format text default '';
alter table public.linkedin_posts add column if not exists image_brief text default '';

alter table public.linkedin_posts enable row level security;

-- Accès aux utilisateurs authentifiés du CRM (aligné sur marketing_items)
create policy "li_auth_all" on public.linkedin_posts
  for all to authenticated using (true) with check (true);

-- Bucket de stockage des visuels (à créer aussi via l'UI Storage) :
--   insert into storage.buckets (id, name, public) values ('marketing-media','marketing-media', true)
--   on conflict do nothing;
-- Policies storage : lecture publique + écriture authentifiée sur le bucket 'marketing-media'.

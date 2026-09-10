-- Position libre de l'éditeur marketing (drag/resize des blocs de l'aperçu, interact.js)
-- Stocke {header:{x,y,w,h}, body:{...}, footer:{...}} — vide/absent = mise en page normale.
alter table public.marketing_items add column if not exists layout jsonb;
